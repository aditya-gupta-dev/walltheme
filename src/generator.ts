/**
 * ColorsGenerator — the orchestrator.
 *
 * image bytes → RGBA decode → pixel sampling → MCU quantize/score →
 * dynamic scheme → VS Code colors → applied INSTANTLY via
 * `workbench.colorCustomizations` + `editor.tokenColorCustomizations`
 * (no reload needed), plus a standalone theme JSON in globalStorage.
 *
 * Also owns the wallpaper/image watcher for auto-reload and state restore.
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
  SCHEME_COLOR_KEYS,
  schemeToHexMap,
  TonalPalette,
} from './theme/mcu';
import type { SchemeVariant } from './theme/mcu';
import { generateTheme } from './theme/vscode-theme';
import type { ThemeColors, VsCodeTheme } from './theme/vscode-theme';
import { decodeImage, extractPixels } from './wallpaper/image';
import { getWallpaperPath } from './wallpaper/detect';
import { ensureDirSync, expandHome } from './util/fs';
import { Logger } from './util/log';

export type GeneratorState = 'idle' | 'working' | 'ready' | 'error';
export type SourceKind = 'image' | 'wallpaper' | 'seed';

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

  constructor(private readonly ctx: vscode.ExtensionContext) {}

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

  /** "Reload Theme…" — open the image picker, then generate. */
  async generateFromPicker(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Use as theme source',
      title: 'WallTheme — choose an image to extract colors from',
      filters: { Images: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tif', 'tiff'] },
    });
    if (!uris || uris.length === 0) return;
    await this.ctx.workspaceState.update('walltheme.customImagePath', uris[0].fsPath);
    await this.generateFromPath(uris[0].fsPath, 'image picker');
  }

  /** "Wallpaper Theme" — detect the desktop wallpaper, then generate. */
  async generateFromWallpaper(): Promise<void> {
    this.setState('working');
    try {
      const override = vscode.workspace.getConfiguration('walltheme').get<string>('wallpaperPathOverride');
      const result = await getWallpaperPath(override);
      if (!result) {
        const msg = 'Could not detect your desktop wallpaper. Set `walltheme.wallpaperPathOverride` to your wallpaper image and try again.';
        Logger.error(msg);
        this.setState('error', msg);
        void vscode.window
          .showErrorMessage('WallTheme: wallpaper not detected', 'Open Settings')
          .then((choice) => {
            if (choice === 'Open Settings') {
              void vscode.commands.executeCommand('workbench.action.openSettings', 'walltheme.wallpaperPathOverride');
            }
          });
        return;
      }
      Logger.info(`wallpaper found via ${result.via}: ${result.filePath}`);
      await this.generateFromPath(result.filePath, `wallpaper (${result.via})`);
    } catch (err) {
      this.handleFailure('wallpaper theme failed', err);
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
  async reset(): Promise<void> {
    try {
      const saved = this.readPersisted();
      const dummy = Object.fromEntries(SCHEME_COLOR_KEYS.map((k) => [k, '#000000'])) as unknown as ThemeColors;
      const probe = generateTheme({ colors: dummy, isDark: true, syntaxStyle: 'material' });

      const wb = vscode.workspace.getConfiguration('workbench');
      const wbCustom = { ...(wb.get<Record<string, unknown>>('colorCustomizations') ?? {}) };
      for (const key of Object.keys(probe.colors)) delete wbCustom[key];
      await wb.update('colorCustomizations', Object.keys(wbCustom).length > 0 ? wbCustom : undefined, vscode.ConfigurationTarget.Global);

      const ed = vscode.workspace.getConfiguration('editor');
      await ed.update('tokenColorCustomizations', saved?.prevTokenCustomizations ?? undefined, vscode.ConfigurationTarget.Global);
      await ed.update('semanticTokenColorCustomizations', saved?.prevSemanticCustomizations ?? undefined, vscode.ConfigurationTarget.Global);

      try {
        fs.rmSync(this.stateFile, { force: true });
      } catch {
        // ignore
      }
      this.info = undefined;
      this.stopWatcher();
      this.setState('idle');
      Logger.info('theme reset — customizations removed');
      void vscode.window.showInformationMessage('WallTheme: theme reset. Your selected color theme is back in control.');
    } catch (err) {
      this.handleFailure('reset failed', err);
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
    const saved = this.readPersisted();
    if (!saved) return;
    try {
      await this.applyCustomizations(generateTheme({ colors: saved.colors, isDark: saved.isDark, syntaxStyle: saved.syntaxStyle }), saved);
      this.info = saved.info;
      this.setState('ready');
      Logger.info(`restored theme: ${saved.info.summary}`);

      // If VS Code's theme kind flipped (e.g. auto day/night), follow it.
      const cfg = vscode.workspace.getConfiguration('walltheme');
      if (cfg.get<boolean | null>('isDark') === null) {
        const sub = vscode.window.onDidChangeActiveColorTheme((theme) => {
          void this.regenerateForCurrentKind(saved, theme.kind === vscode.ColorThemeKind.Dark);
        });
        this.ctx.subscriptions.push(sub);
      }
      await this.startWatcher(saved.info.sourceKind, saved.info.source);
    } catch (err) {
      Logger.error('restore failed', err);
    }
  }

  private async regenerateForCurrentKind(saved: PersistedState, wantDark: boolean): Promise<void> {
    const setting = vscode.workspace.getConfiguration('walltheme').get<boolean | null>('isDark');
    if (setting !== null) return;
    if (wantDark === saved.isDark) return;
    if (saved.info.sourceKind === 'seed') {
      this.setState('working');
      try {
        await this.applySeed(argbFromHex(saved.info.seedHex.replace('#', '')), saved.info.seedHex, 'manual seed', 'seed');
      } catch (err) {
        this.handleFailure('regeneration failed', err);
      }
      return;
    }
    if (fs.existsSync(saved.info.source)) {
      await this.generateFromPath(saved.info.source, saved.info.via);
    }
  }

  // -------------------------------------------------------------------------
  // Pipeline
  // -------------------------------------------------------------------------

  async generateFromPath(imagePath: string, via: string): Promise<void> {
    this.setState('working');
    try {
      const source = expandHome(imagePath);
      const buf = fs.readFileSync(source);
      Logger.info(`decoding ${source} (${(buf.length / 1024).toFixed(0)} KiB)…`);

      const img = await decodeImage(buf);
      const pixels = extractPixels(img);
      Logger.info(`scoring ${pixels.length.toLocaleString()} sampled pixels…`);

      const scored = quantizeAndScore(pixels);
      const palette = scored.slice(0, 8).map((c) => hexFromArgb(c.argb).toUpperCase());
      const seedHex = hexFromArgb(scored[0].argb).toUpperCase();
      Logger.info(`seed color: ${seedHex}`);

      await this.applySeed(scored[0].argb, source, via, 'image', palette);
    } catch (err) {
      this.handleFailure(`generation failed for ${imagePath}`, err);
    }
  }

  private async applySeed(
    sourceArgb: number,
    source: string,
    via: string,
    sourceKind: SourceKind,
    palette?: string[],
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
    };

    await this.applyCustomizations(theme, persisted);
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
    const wbCustom = { ...(wb.get<Record<string, unknown>>('colorCustomizations') ?? {}) };
    for (const [key, value] of Object.entries(theme.colors)) wbCustom[key] = value;
    await wb.update('colorCustomizations', wbCustom, vscode.ConfigurationTarget.Global);

    const ed = vscode.workspace.getConfiguration('editor');
    // Snapshot what the user had, so Reset can restore it.
    if (persisted.prevTokenCustomizations === undefined) {
      persisted.prevTokenCustomizations = ed.get<unknown>('tokenColorCustomizations');
    }
    if (persisted.prevSemanticCustomizations === undefined) {
      persisted.prevSemanticCustomizations = ed.get<unknown>('semanticTokenColorCustomizations');
    }

    const tokCustom = { ...(ed.get<Record<string, unknown>>('tokenColorCustomizations') ?? {}) };
    tokCustom.textMateRules = theme.tokenColors;
    await ed.update('tokenColorCustomizations', tokCustom, vscode.ConfigurationTarget.Global);

    const semCustom = { ...(ed.get<Record<string, unknown>>('semanticTokenColorCustomizations') ?? {}) };
    const rules = { ...((semCustom.rules as Record<string, unknown> | undefined) ?? {}) };
    for (const [key, value] of Object.entries(theme.semanticTokenColors)) rules[key] = value;
    semCustom.rules = rules;
    await ed.update('semanticTokenColorCustomizations', semCustom, vscode.ConfigurationTarget.Global);
  }

  // -------------------------------------------------------------------------
  // Watcher
  // -------------------------------------------------------------------------

  private async startWatcher(sourceKind: SourceKind, imageSource: string): Promise<void> {
    this.stopWatcher();
    const cfg = vscode.workspace.getConfiguration('walltheme');
    if (!cfg.get<boolean>('autoReload', true)) return;
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
      if (this.watchMode === 'wallpaper') {
        const override = vscode.workspace.getConfiguration('walltheme').get<string>('wallpaperPathOverride');
        const result = await getWallpaperPath(override);
        return result ? `${result.filePath}:${fs.statSync(result.filePath).mtimeMs}` : 'none';
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
    } else if (this.watchMode === 'wallpaper') {
      await this.generateFromWallpaper();
    }
  }

  // -------------------------------------------------------------------------
  // Persistence helpers
  // -------------------------------------------------------------------------

  private readPersisted(): PersistedState | undefined {
    try {
      const raw = fs.readFileSync(this.stateFile, 'utf8');
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.version === 1 && parsed.colors && parsed.info) return parsed;
    } catch {
      // no state yet
    }
    return undefined;
  }

  private handleFailure(what: string, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    Logger.error(what, err);
    this.setState('error', msg);
    void vscode.window.showErrorMessage(`WallTheme: ${msg}`);
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
    this.stopWatcher();
    this.emitter.dispose();
  }
}
