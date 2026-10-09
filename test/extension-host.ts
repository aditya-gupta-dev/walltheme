/** Run against the installed VS Code binary in an isolated test profile. */
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { PNG } from 'pngjs';

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('aditya-gupta-dev.walltheme');
  assert.ok(extension, 'WallTheme must be discovered');
  for (const theme of extension.packageJSON.contributes.themes) {
    assert.equal(theme.id ?? theme.label, theme.label, 'Settings must resolve WallTheme by its displayed name');
  }
  await extension.activate();
  const verificationFile = path.join(process.env.WALLTHEME_TEST_USER_DATA!, 'verify-theme-file.json');
  if (fs.existsSync(verificationFile)) {
    const expected = JSON.parse(fs.readFileSync(verificationFile, 'utf8'));
    await assertThemeRendered(expected.foreground);
    assert.deepEqual(vscode.workspace.getConfiguration('workbench').inspect('colorCustomizations')?.globalValue, expected.workbench);
    assert.deepEqual(vscode.workspace.getConfiguration('editor').inspect('tokenColorCustomizations')?.globalValue, expected.tokens);
    assert.deepEqual(vscode.workspace.getConfiguration('editor').inspect('semanticTokenColorCustomizations')?.globalValue, expected.semanticTokens);
    const state = JSON.parse(fs.readFileSync(expected.stateFile, 'utf8'));
    assert.equal(state.version, 2);
    fs.unlinkSync(verificationFile);
    console.log('PASS: renderer loaded standalone theme after restart; legacy overrides migrated and settings restored');
    return;
  }
  const commands = await vscode.commands.getCommands();
  assert.ok(commands.includes('walltheme.generateFromImage'));
  assert.ok(!commands.includes('walltheme.wallpaperTheme'));
  await vscode.workspace.getConfiguration('walltheme').update('autoReload', false, vscode.ConfigurationTarget.Global);
  // A previous failed test may have left an active theme in this temporary profile.
  await vscode.commands.executeCommand('walltheme.resetTheme');
  const previousTokens = vscode.workspace.getConfiguration('editor').inspect('tokenColorCustomizations')?.globalValue;
  const previousSemanticTokens = vscode.workspace.getConfiguration('editor').inspect('semanticTokenColorCustomizations')?.globalValue;
  const workbenchSettings = vscode.workspace.getConfiguration('workbench');
  const previousWorkbench = { ...(workbenchSettings.inspect<Record<string, unknown>>('colorCustomizations')?.globalValue ?? {}), 'editor.background': '#112233' };
  await workbenchSettings.update('colorCustomizations', previousWorkbench, vscode.ConfigurationTarget.Global);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'walltheme-host-'));
  const png = new PNG({ width: 2001, height: 1301 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0x1a;
    png.data[i + 1] = 0x5e;
    png.data[i + 2] = 0x63;
    png.data[i + 3] = 255;
  }
  const images = [path.join(dir, 'large.png')];
  fs.writeFileSync(images[0], PNG.sync.write(png));
  if (process.env.WALLTHEME_TEST_IMAGE) images.push(process.env.WALLTHEME_TEST_IMAGE);
  for (const image of images) {
    await vscode.commands.executeCommand('walltheme.generateFromImage', vscode.Uri.file(image));
    assert.deepEqual(vscode.workspace.getConfiguration('workbench').inspect('colorCustomizations')?.globalValue, previousWorkbench);
    const storage = path.join(process.env.WALLTHEME_TEST_USER_DATA!, 'User/globalStorage/aditya-gupta-dev.walltheme');
    const state = JSON.parse(fs.readFileSync(path.join(storage, 'state.json'), 'utf8'));
    assert.equal(state.info.source, image, 'New image must finish generation, not leave old theme');
    assert.equal(state.version, 2);
    const history = JSON.parse(fs.readFileSync(path.join(storage, 'walltheme-generated/generated-themes.json'), 'utf8'));
    assert.equal(history.themes.at(-1).source, image);
    const generated = history.themes.at(-1).theme;
    const themePath = path.join(extension.extensionUri.fsPath, 'dist/themes', `walltheme-${state.isDark ? 'dark' : 'light'}.json`);
    assert.deepEqual(JSON.parse(fs.readFileSync(themePath, 'utf8')), generated);
    assert.ok(generated.tokenColors.length > 15);
    assert.ok(Object.keys(generated.semanticTokenColors).length > 10);
    assert.equal(generated.semanticHighlighting, true);
    assert.deepEqual(vscode.workspace.getConfiguration('editor').inspect('tokenColorCustomizations')?.globalValue, previousTokens);
    assert.deepEqual(vscode.workspace.getConfiguration('editor').inspect('semanticTokenColorCustomizations')?.globalValue, previousSemanticTokens);
    console.log(`PASS: saved native UI/syntax theme and archived ${path.basename(image)}`);
  }
  await vscode.commands.executeCommand('walltheme.resetTheme');
  assert.deepEqual(vscode.workspace.getConfiguration('workbench').inspect('colorCustomizations')?.globalValue, previousWorkbench);
  assert.deepEqual(vscode.workspace.getConfiguration('editor').inspect('tokenColorCustomizations')?.globalValue, previousTokens);
  assert.deepEqual(vscode.workspace.getConfiguration('editor').inspect('semanticTokenColorCustomizations')?.globalValue, previousSemanticTokens);
  console.log('PASS: activation, generation, JSON history, and reset in real extension host');

  await vscode.workspace.getConfiguration('walltheme').update('autoReload', true, vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('walltheme').update('watchIntervalMs', 1000, vscode.ConfigurationTarget.Global);
  const storage = path.join(process.env.WALLTHEME_TEST_USER_DATA!, 'User/globalStorage/aditya-gupta-dev.walltheme');
  for (const selected of ['Default Dark Modern', 'Default Light Modern']) {
    await vscode.commands.executeCommand('walltheme.generateFromImage', vscode.Uri.file(images[0]));
    assert.match(vscode.workspace.getConfiguration('workbench').get<string>('colorTheme') ?? '', /^WallTheme (Dark|Light)$/);
    await vscode.workspace.getConfiguration('workbench').update('colorTheme', selected, vscode.ConfigurationTarget.Global);
    const deadline = Date.now() + 5000;
    while (fs.existsSync(path.join(storage, 'state.json')) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.ok(!fs.existsSync(path.join(storage, 'state.json')), 'Theme selection must deactivate WallTheme');
    assert.equal(vscode.workspace.getConfiguration('workbench').get('colorTheme'), selected);
    assert.deepEqual(vscode.workspace.getConfiguration('workbench').inspect('colorCustomizations')?.globalValue, previousWorkbench);
    assert.deepEqual(vscode.workspace.getConfiguration('editor').inspect('tokenColorCustomizations')?.globalValue, previousTokens);
    assert.deepEqual(vscode.workspace.getConfiguration('editor').inspect('semanticTokenColorCustomizations')?.globalValue, previousSemanticTokens);
    fs.writeFileSync(images[0], PNG.sync.write(png));
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.ok(!fs.existsSync(path.join(storage, 'state.json')), 'Watcher must not reapply WallTheme after switching');
    assert.ok(fs.existsSync(path.join(storage, 'walltheme-generated/generated-themes.json')));
    console.log(`PASS: switching to ${selected} restores settings and stops watcher`);
  }
  // Prepare legacy migration and a second-launch renderer check. Test mode caches themes.
  await vscode.workspace.getConfiguration('walltheme').update('autoReload', false, vscode.ConfigurationTarget.Global);
  await vscode.commands.executeCommand('walltheme.generateFromImage', vscode.Uri.file(images[0]));
  const stateFile = path.join(storage, 'state.json');
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const themeFile = path.join(extension.extensionUri.fsPath, 'dist/themes', `walltheme-${state.isDark ? 'dark' : 'light'}.json`);
  const generated = JSON.parse(fs.readFileSync(themeFile, 'utf8'));
  fs.writeFileSync(verificationFile, JSON.stringify({ foreground: generated.colors['editor.foreground'], workbench: previousWorkbench, tokens: previousTokens, semanticTokens: previousSemanticTokens, stateFile }));
  fs.writeFileSync(stateFile, JSON.stringify({ ...state, version: 1, prevWorkbenchCustomizations: previousWorkbench, workbenchSnapshotCaptured: true, prevTokenCustomizations: previousTokens, prevSemanticCustomizations: previousSemanticTokens }));
  await vscode.workspace.getConfiguration('workbench').update('colorCustomizations', { ...previousWorkbench, ...generated.colors }, vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('editor').update('tokenColorCustomizations', { textMateRules: generated.tokenColors }, vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('editor').update('semanticTokenColorCustomizations', { rules: generated.semanticTokenColors }, vscode.ConfigurationTarget.Global);
  console.log('PASS: prepared second-launch check for standalone rendering and legacy migration');

}

/** Observe actual renderer theme colors, independently of settings and saved JSON. */
async function assertThemeRendered(hex: string): Promise<void> {
  const expected = `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
  const panel = vscode.window.createWebviewPanel('walltheme.test', 'WallTheme render test', vscode.ViewColumn.One, { enableScripts: true });
  try {
    await new Promise<void>((resolve, reject) => {
      let actual = 'no webview message';
      const timer = setTimeout(() => { listener.dispose(); reject(new Error(`Renderer did not load file color ${hex}; saw ${actual}`)); }, 10_000);
      const listener = panel.webview.onDidReceiveMessage(message => {
        actual = message.color;
        if (message.color === expected) { clearTimeout(timer); listener.dispose(); resolve(); }
      });
      panel.webview.html = `<html><body><span id="probe">Theme test</span><script>
        const api = acquireVsCodeApi();
        setInterval(() => {
          const probe = document.getElementById('probe');
          probe.style.color = getComputedStyle(document.body).getPropertyValue('--vscode-editor-foreground');
          api.postMessage({color: getComputedStyle(probe).color});
        }, 50);
      </script></body></html>`;
    });
  } finally { panel.dispose(); }
}
