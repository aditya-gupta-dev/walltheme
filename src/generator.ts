/**
 * ColorsGenerator — the orchestrator.
 *
 * image bytes → RGBA decode → pixel sampling → MCU quantize/score →
 * dynamic scheme → VS Code colors → applied INSTANTLY via
 * `workbench.colorCustomizations` + `editor.tokenColorCustomizations`
 * (no reload needed), plus a standalone theme JSON in globalStorage.
 *
 * Also owns the chosen-image watcher for auto-reload and state restore.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {
  argbFromHex,
  buildScheme,
  Hct,
  hexFromArgb,
  quantizeAndScore,
  schemeToHexMap,
  TonalPalette,
} from './theme/mcu';
import type { SchemeVariant } from './theme/mcu';
import { generateTheme } from './theme/vscode-theme';
import { archiveTheme } from './theme/history';
import type { ThemeColors, VsCodeTheme } from './theme/vscode-theme';
import { decodeImage, extractPixels } from './image/decode';
import { ensureDirSync, expandHome } from './util/fs';
import { Logger } from './util/log';

export type GeneratorState = 'idle' | 'working' | 'ready' | 'error';
export type SourceKind = 'image' | 'seed';

export interface GenerationInfo {
  summary: string;
  source: string;
  via: string;
  palette: string[];
  isDark: boolean;
  variant: SchemeVariant;
  seedHex: string;
  sourceKind: SourceKind;
}

interface PersistedState {
  version: 1;
  colors: ThemeColors;
  isDark: boolean;
  syntaxStyle: string;
  variant: SchemeVariant;
  info: GenerationInfo;
  /** Editor token settings we replaced, restored on reset. */
  prevTokenCustomizations?: unknown;
  prevSemanticCustomizations?: unknown;
  tokenSnapshotCaptured?: boolean;
  appliedThemeLabel?: string;
  prevColorTheme?: string;
  prevWorkbenchCustomizations?: Record<string, unknown>;
  workbenchSnapshotCaptured?: boolean;
}

const THEME_DIR = 'walltheme-generated';
const ACCENT_ROLES: readonly (keyof ThemeColors)[] = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'inversePrimary',
];

/** Rebuild a color with scaled chroma (same hue + tone) — the "intensity" dial. */
function scaleChroma(argbHex: string, factor: number): string {
  const argb = argbFromHex(argbHex.replace('#', ''));
  const hct = Hct.fromInt(argb);
  const chroma = Math.min(200, Math.max(0, hct.chroma * factor));
  return hexFromArgb(TonalPalette.fromHueAndChroma(hct.hue, chroma).tone(hct.tone)).toUpperCase();
}

export class ColorsGenerator implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeState: vscode.Event<void> = this.emitter.event;

  private state: GeneratorState = 'idle';
  private info: GenerationInfo | undefined;
  private lastError: string | undefined;

  private watchTimer: NodeJS.Timeout | undefined;
  private watchMode: SourceKind | 'none' = 'none';
  private watchSource = '';
  private lastKey = '';
  private generationEpoch = 0;
  private application: Promise<void> | undefined;
  private activeSnapshot: PersistedState | undefined;
  private resetting = false;
  private readonly themeListener: vscode.Disposable;

  constructor(private readonly ctx: vscode.ExtensionContext) {
    this.themeListener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (this.resetting || !event.affectsConfiguration('workbench.colorTheme')) return;
      const saved = this.activeSnapshot ?? this.readPersisted();
      if (!saved) {
        if (this.state === 'working') void this.reset(false);
        return;
      }
      const selected = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme');
      if (selected === saved.appliedThemeLabel) return;
      void this.reset(false);
    });
  }

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  describeState(): { state: GeneratorState; info?: GenerationInfo; error?: string } {
    return { state: this.state, info: this.info, error: this.lastError };
  }

  private setState(state: GeneratorState, error?: string): void {
    this.state = state;
    if (error !== undefined) this.lastError = error;
    this.emitter.fire();
  }

  private get stateFile(): string {
    return path.join(this.ctx.globalStorageUri.fsPath, 'state.json');
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  /** "Generate Theme from Image…" (and legacy "Reload Theme…"). */
  async generateFromPicker(image?: vscode.Uri): Promise<void> {
    const uris = image ? [image] : await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: true,
      canSelectFolders: false,
      openLabel: 'Use as theme source',
      title: 'WallTheme — choose an image to extract colors from',
      filters: { Images: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tif', 'tiff'] },
    });
    if (!uris || uris.length === 0) return;
    if (uris[0].scheme !== 'file') {
      this.handleFailure('image selection failed', new Error('Choose a local image file.'));
      return;
    }
    await this.ctx.workspaceState.update('walltheme.customImagePath', uris[0].fsPath);
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'WallTheme: extracting image colors and applying theme…',
    }, () => this.generateFromPath(uris[0].fsPath, 'image picker'));
    if (this.state === 'ready') {
      void vscode.window.showInformationMessage(`WallTheme: theme applied from ${path.basename(uris[0].fsPath)}.`, 'Preview Palette')
        .then((choice) => {
          if (choice === 'Preview Palette') void this.previewPalette();
        });
    }
  }

  /** "Choose Source Color…" — build the palette from a hex seed. */
  async chooseSeedColor(): Promise<void> {
    const fallback = this.info?.seedHex ?? '#6750A4';
    const picked = await vscode.window.showInputBox({
      prompt: 'Seed color as hex (#RRGGBB) — the whole palette is derived from this hue',
      placeHolder: '#6750A4',
      value: fallback,
      validateInput: (v) => (/^#?[0-9a-fA-F]{6}$/.test(v.trim()) ? undefined : 'Enter a hex color like #6750A4'),
    });
    if (!picked) return;
    const hex = `#${picked.trim().replace('#', '').toUpperCase()}`;
    this.setState('working');
    try {
      await this.applySeed(argbFromHex(hex.slice(1)), hex, 'manual seed', 'seed');
    } catch (err) {
      this.handleFailure('seed theme failed', err);
    }
  }

  /** "Reset Theme" — remove our color customizations, restore previous settings. */
  async reset(notify = true): Promise<void> {
    if (this.resetting) return;
    this.resetting = true;
    this.generationEpoch++;
    this.stopWatcher();
    try {
      await this.application;
      const saved = this.activeSnapshot ?? this.readPersisted();
      if (!saved) {
        this.info = undefined;
        this.setState('idle');
        return;
      }
      const generated = generateTheme({ colors: saved.colors, isDark: saved.isDark, syntaxStyle: saved.syntaxStyle });

      const wb = vscode.workspace.getConfiguration('workbench');
      const wbCustom = { ...(wb.inspect<Record<string, unknown>>('colorCustomizations')?.globalValue ?? {}) };
      for (const [key, value] of Object.entries(generated.colors)) {
        if (saved.workbenchSnapshotCaptured && wbCustom[key] !== value) continue;
        if (saved.prevWorkbenchCustomizations && key in saved.prevWorkbenchCustomizations) {
          wbCustom[key] = saved.prevWorkbenchCustomizations[key];
        } else {
          delete wbCustom[key];
        }
      }
      await wb.update('colorCustomizations', Object.keys(wbCustom).length > 0 ? wbCustom : undefined, vscode.ConfigurationTarget.Global);

      const ed = vscode.workspace.getConfiguration('editor');
      await ed.update('tokenColorCustomizations', saved?.prevTokenCustomizations ?? undefined, vscode.ConfigurationTarget.Global);
      await ed.update('semanticTokenColorCustomizations', saved?.prevSemanticCustomizations ?? undefined, vscode.ConfigurationTarget.Global);

      // Preserve a theme chosen in the picker; manual Reset restores the original.
      if (wb.get<string>('colorTheme') === saved.appliedThemeLabel) {
        await wb.update('colorTheme', saved.prevColorTheme, vscode.ConfigurationTarget.Global);
      }

      try {
        fs.rmSync(this.stateFile, { force: true });
      } catch {
        // ignore
      }
      this.info = undefined;
      this.activeSnapshot = undefined;
      this.stopWatcher();
      this.setState('idle');
      Logger.info('theme reset — customizations removed');
      if (notify) void vscode.window.showInformationMessage('WallTheme: theme reset. Your selected color theme is back in control.');
    } catch (err) {
      this.handleFailure('reset failed', err);
    } finally {
      this.resetting = false;
    }
  }

  /** "Export Theme as JSON…" — save the standalone theme file anywhere. */
  async exportTheme(): Promise<void> {
    const saved = this.readPersisted();
    if (!saved) {
      void vscode.window.showWarningMessage('WallTheme: generate a theme first.');
      return;
    }
    const theme = generateTheme({ colors: saved.colors, isDark: saved.isDark, syntaxStyle: saved.syntaxStyle });
    theme.name = `WallTheme ${saved.isDark ? 'Dark' : 'Light'} (${saved.info.variant} · ${saved.info.seedHex})`;

    const target = await vscode.window.showSaveDialog({
      title: 'WallTheme — export theme JSON',
      defaultUri: vscode.Uri.file(path.join(os.homedir(), `walltheme-${saved.isDark ? 'dark' : 'light'}.json`)),
      filters: { 'VS Code theme': ['json'] },
    });
    if (!target) return;
    fs.writeFileSync(target.fsPath, JSON.stringify(theme, null, 2));
    Logger.info(`theme exported: ${target.fsPath}`);
    void vscode.window.showInformationMessage(`WallTheme: exported to ${target.fsPath}`);
  }

  /** "Preview Palette" — quick pick of the ranked extracted colors. */
  async previewPalette(): Promise<void> {
    const info = this.info;
    if (!info) {
      void vscode.window.showWarningMessage('WallTheme: generate a theme first.');
      return;
    }
    const items = info.palette.map((hex, i) => ({
      label: `${i === 0 ? '$(paintcan)' : '$(symbol-square)'}  ${hex}`,
      description: i === 0 ? 'seed color' : `accent #${i + 1}`,
      hex,
    }));
    const picked = await vscode.window.showQuickPick(items, {
      title: `WallTheme palette — ${info.summary} · source: ${info.source}`,
      placeHolder: 'Pick a color to copy it (Esc to close)',
    });
    if (!picked) return;
    await vscode.env.clipboard.writeText(picked.hex);
    const useAsSeed = await vscode.window.showInformationMessage(
      `Copied ${picked.hex} to clipboard.`,
      'Use as seed',
    );
    if (useAsSeed === 'Use as seed') {
      this.setState('working');
      try {
        await this.applySeed(argbFromHex(picked.hex.slice(1)), picked.hex, 'palette pick', 'seed');
      } catch (err) {
        this.handleFailure('seed theme failed', err);
      }
    }
  }

  /** Startup: re-apply the persisted theme instantly (no image decode). */
  async restoreOnActivation(): Promise<void> {
    const epoch = this.generationEpoch;
    const saved = this.readPersisted();
    if (!saved) return;
    if (!saved.appliedThemeLabel) {
      saved.prevColorTheme = vscode.workspace.getConfiguration('workbench').inspect<string>('colorTheme')?.globalValue;
      saved.appliedThemeLabel = `WallTheme ${saved.isDark ? 'Dark' : 'Light'}`;
      saved.workbenchSnapshotCaptured = true;
    }
    this.activeSnapshot = saved;
    if (saved.appliedThemeLabel && vscode.workspace.getConfiguration('workbench').get<string>('colorTheme') !== saved.appliedThemeLabel) {
      await this.reset(false);
      return;
    }
    try {
      this.application = this.applyCustomizations(generateTheme({ colors: saved.colors, isDark: saved.isDark, syntaxStyle: saved.syntaxStyle }), saved);
      await this.application;
      if (epoch !== this.generationEpoch) return;
      fs.writeFileSync(this.stateFile, JSON.stringify(saved, null, 2));
      this.info = saved.info;
      this.setState('ready');
      Logger.info(`restored theme: ${saved.info.summary}`);

      await this.startWatcher(saved.info.sourceKind, saved.info.source);
    } catch (err) {
      this.handleFailure('restore failed', err);
    }
  }

  // -------------------------------------------------------------------------
  // Pipeline
  // -------------------------------------------------------------------------

  async generateFromPath(imagePath: string, via: string): Promise<void> {
    const epoch = this.generationEpoch;
    this.setState('working');
    try {
      const source = expandHome(imagePath);
      const buf = fs.readFileSync(source);
      Logger.info(`decoding ${source} (${(buf.length / 1024).toFixed(0)} KiB)…`);

      const img = await decodeImage(buf);
      if (epoch !== this.generationEpoch) return;
      const pixels = extractPixels(img);
      Logger.info(`scoring ${pixels.length.toLocaleString()} sampled pixels…`);

      const scored = quantizeAndScore(pixels);
      const palette = scored.slice(0, 8).map((c) => hexFromArgb(c.argb).toUpperCase());
      const seedHex = hexFromArgb(scored[0].argb).toUpperCase();
      Logger.info(`seed color: ${seedHex}`);

      await this.applySeed(scored[0].argb, source, via, 'image', palette, epoch);
    } catch (err) {
      if (epoch !== this.generationEpoch) return;
      this.handleFailure(`generation failed for ${imagePath}`, err);
    }
  }

  private async applySeed(
    sourceArgb: number,
    source: string,
    via: string,
    sourceKind: SourceKind,
    palette?: string[],
    epoch = this.generationEpoch,
  ): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('walltheme');
    const variant = (cfg.get<string>('style') ?? 'tonalSpot') as SchemeVariant;
    const contrastLevel = cfg.get<number>('contrastLevel') ?? 0;
    const intensity = cfg.get<number>('intensity') ?? 1;
    const syntaxStyle = cfg.get<string>('syntaxStyle') ?? 'material';

    const setting = cfg.get<boolean | null>('isDark');
    const isDark = setting ?? this.currentThemeIsDark();

    const scheme = buildScheme({ sourceColorArgb: sourceArgb, isDark, contrastLevel, variant });
    const colors = this.applyIntensity(schemeToHexMap(scheme), intensity);

    const seedHex = hexFromArgb(sourceArgb).toUpperCase();
    const theme = generateTheme({ colors, isDark, syntaxStyle });
    theme.name = `WallTheme ${isDark ? 'Dark' : 'Light'} (${variant} · ${seedHex})`;

    // Write the standalone theme file (also handy for export/packaging).
    const outDir = path.join(this.ctx.globalStorageUri.fsPath, THEME_DIR);
    ensureDirSync(outDir);
    const previous = this.readPersisted();
    archiveTheme(path.join(outDir, 'generated-themes.json'), {
      generatedAt: new Date().toISOString(),
      source,
      seedHex,
      palette: palette ?? [seedHex],
      materialColors: colors,
      theme,
    }, previous ? {
      generatedAt: null,
      source: previous.info.source,
      seedHex: previous.info.seedHex,
      palette: previous.info.palette,
      materialColors: previous.colors,
      theme: generateTheme({ colors: previous.colors, isDark: previous.isDark, syntaxStyle: previous.syntaxStyle }),
    } : undefined);
    fs.writeFileSync(path.join(outDir, isDark ? 'walltheme-dark.json' : 'walltheme-light.json'), JSON.stringify(theme, null, 2));

    const info: GenerationInfo = {
      summary: `${isDark ? 'Dark' : 'Light'} · ${variant} · seed ${seedHex}`,
      source,
      via,
      palette: palette ?? [seedHex],
      isDark,
      variant,
      seedHex,
      sourceKind,
    };
    const persisted: PersistedState = {
      version: 1,
      colors,
      isDark,
      syntaxStyle,
      variant,
      info,
      // Keep the original snapshot when generating another image.
      tokenSnapshotCaptured: previous !== undefined,
      prevTokenCustomizations: previous?.prevTokenCustomizations,
      prevSemanticCustomizations: previous?.prevSemanticCustomizations,
      appliedThemeLabel: `WallTheme ${isDark ? 'Dark' : 'Light'}`,
      prevColorTheme: previous ? previous.prevColorTheme : vscode.workspace.getConfiguration('workbench').inspect<string>('colorTheme')?.globalValue,
      prevWorkbenchCustomizations: previous?.prevWorkbenchCustomizations,
      workbenchSnapshotCaptured: previous !== undefined,
    };

    if (epoch !== this.generationEpoch) return;
    this.activeSnapshot = persisted;
    this.application = this.applyCustomizations(theme, persisted);
    await this.application;
    if (epoch !== this.generationEpoch) return;
    ensureDirSync(path.dirname(this.stateFile));
    fs.writeFileSync(this.stateFile, JSON.stringify(persisted, null, 2));

    this.info = info;
    this.setState('ready');
    Logger.info(`theme applied: ${info.summary} (from ${via})`);
    await this.startWatcher(sourceKind, sourceKind === 'image' ? source : '');
  }

  private applyIntensity(map: Record<string, string>, intensity: number): ThemeColors {
    const colors = { ...map } as unknown as ThemeColors;
    if (intensity >= 0.95 && intensity <= 1.05) return colors;
    for (const role of ACCENT_ROLES) {
      colors[role] = scaleChroma(colors[role], intensity);
    }
    return colors;
  }

  // -------------------------------------------------------------------------
  // Instant-apply via settings (no reload required)
  // -------------------------------------------------------------------------

  private async applyCustomizations(theme: VsCodeTheme, persisted: PersistedState): Promise<void> {
    const wb = vscode.workspace.getConfiguration('workbench');
    if (!persisted.workbenchSnapshotCaptured) {
      persisted.prevWorkbenchCustomizations = wb.inspect<Record<string, unknown>>('colorCustomizations')?.globalValue;
      persisted.workbenchSnapshotCaptured = true;
    }
    if (persisted.appliedThemeLabel && wb.get<string>('colorTheme') !== persisted.appliedThemeLabel) {
      await wb.update('colorTheme', persisted.appliedThemeLabel, vscode.ConfigurationTarget.Global);
    }
    const wbCustom = { ...(wb.inspect<Record<string, unknown>>('colorCustomizations')?.globalValue ?? {}) };
    for (const [key, value] of Object.entries(theme.colors)) wbCustom[key] = value;
    await wb.update('colorCustomizations', wbCustom, vscode.ConfigurationTarget.Global);

    const ed = vscode.workspace.getConfiguration('editor');
    // Snapshot what the user had, so Reset can restore it.
    if (!persisted.tokenSnapshotCaptured) {
      persisted.prevTokenCustomizations = ed.inspect('tokenColorCustomizations')?.globalValue;
      persisted.prevSemanticCustomizations = ed.inspect('semanticTokenColorCustomizations')?.globalValue;
      persisted.tokenSnapshotCaptured = true;
    }

    const tokCustom = { ...(ed.inspect<Record<string, unknown>>('tokenColorCustomizations')?.globalValue ?? {}) };
    tokCustom.textMateRules = theme.tokenColors;
    // Theme-scoped settings take precedence over global syntax rules.
    if (persisted.appliedThemeLabel) {
      tokCustom[`[${persisted.appliedThemeLabel}]`] = { textMateRules: theme.tokenColors };
    }
    await ed.update('tokenColorCustomizations', tokCustom, vscode.ConfigurationTarget.Global);

    const semCustom = { ...(ed.inspect<Record<string, unknown>>('semanticTokenColorCustomizations')?.globalValue ?? {}) };
    const rules = { ...((semCustom.rules as Record<string, unknown> | undefined) ?? {}) };
    for (const [key, value] of Object.entries(theme.semanticTokenColors)) rules[key] = value;
    semCustom.rules = rules;
    if (persisted.appliedThemeLabel) {
      semCustom[`[${persisted.appliedThemeLabel}]`] = { enabled: true, rules: theme.semanticTokenColors };
    }
    await ed.update('semanticTokenColorCustomizations', semCustom, vscode.ConfigurationTarget.Global);
  }

  // -------------------------------------------------------------------------
  // Watcher
  // -------------------------------------------------------------------------

  private async startWatcher(sourceKind: SourceKind, imageSource: string): Promise<void> {
    this.stopWatcher();
    const cfg = vscode.workspace.getConfiguration('walltheme');
    if (sourceKind !== 'image' || !cfg.get<boolean>('autoReload', true)) return;
    const interval = Math.max(1000, cfg.get<number>('watchIntervalMs') ?? 5000);

    this.watchMode = sourceKind;
    this.watchSource = imageSource;
    this.lastKey = await this.currentKey();
    this.watchTimer = setInterval(() => {
      void this.poll();
    }, interval);
    Logger.info(`watcher started (${sourceKind}, every ${interval} ms)`);
  }

  private stopWatcher(): void {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = undefined;
    }
    this.watchMode = 'none';
    this.watchSource = '';
  }

  private async currentKey(): Promise<string> {
    try {
      if (this.watchMode === 'image' && this.watchSource) {
        const st = fs.statSync(this.watchSource);
        return `${this.watchSource}:${st.mtimeMs}`;
      }
    } catch {
      // unreadable — treat as unchanged
    }
    return '';
  }

  private async poll(): Promise<void> {
    if (this.state === 'working') return;
    const key = await this.currentKey();
    if (!key || key === this.lastKey) return;
    this.lastKey = key;
    Logger.info('source changed → regenerating');
    if (this.watchMode === 'image' && this.watchSource) {
      await this.generateFromPath(this.watchSource, 'watched image');
    }
  }

  // -------------------------------------------------------------------------
  // Persistence helpers
  // -------------------------------------------------------------------------

  private readPersisted(): PersistedState | undefined {
    try {
      const raw = fs.readFileSync(this.stateFile, 'utf8');
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.version === 1 && parsed.colors && parsed.info) {
        // Older image sources are restored as static images, without desktop detection.
        if (parsed.info.sourceKind !== 'seed') parsed.info.sourceKind = 'image';
        // Legacy state already contains the original token snapshots.
        parsed.tokenSnapshotCaptured = true;
        return parsed;
      }
    } catch {
      // no state yet
    }
    return undefined;
  }

  private handleFailure(what: string, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    Logger.error(what, err);
    this.setState('error', msg);
    void vscode.window.showErrorMessage(`WallTheme: ${msg}`, 'Show Logs').then((choice) => {
      if (choice === 'Show Logs') Logger.show();
    });
  }

  /** VS Code's current theme kind, used when `walltheme.isDark` is null. */
  private currentThemeIsDark(): boolean {
    switch (vscode.window.activeColorTheme.kind) {
      case vscode.ColorThemeKind.Light:
      case vscode.ColorThemeKind.HighContrastLight:
        return false;
      default:
        return true;
    }
  }

  dispose(): void {
    this.themeListener.dispose();
    this.stopWatcher();
    this.emitter.dispose();
  }
}
