/** Run against the installed VS Code binary in an isolated test profile. */
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { PNG } from 'pngjs';

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('walltheme.walltheme');
  assert.ok(extension, 'WallTheme must be discovered');
  await extension.activate();
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
  const webp = path.join(dir, 'sample.webp');
  fs.writeFileSync(webp, Buffer.from('UklGRjQAAABXRUJQVlA4ICgAAACQAQCdASoIAAgAAUAmJaACdLoAA5gA/vPfZrQtCBz/5Bjt57ed2AAA', 'base64'));
  images.push(webp);
  for (const image of images) {
    await vscode.commands.executeCommand('walltheme.generateFromImage', vscode.Uri.file(image));
    const workbench = vscode.workspace.getConfiguration('workbench').get<Record<string, string>>('colorCustomizations');
    assert.match(workbench?.['editor.background'] ?? '', /^#[0-9A-F]{6}$/);
    const tokens = vscode.workspace.getConfiguration('editor').get<{ textMateRules: unknown[]; [key: string]: unknown }>('tokenColorCustomizations');
    assert.ok((tokens?.textMateRules.length ?? 0) > 15);
    const storage = path.join(process.env.WALLTHEME_TEST_USER_DATA!, 'User/globalStorage/walltheme.walltheme');
    const state = JSON.parse(fs.readFileSync(path.join(storage, 'state.json'), 'utf8'));
    assert.equal(state.info.source, image, 'New image must finish generation, not leave old theme');
    assert.equal(state.colors.background, workbench?.['editor.background']);
    const history = JSON.parse(fs.readFileSync(path.join(storage, 'walltheme-generated/generated-themes.json'), 'utf8'));
    assert.equal(history.themes.at(-1).source, image);
    const generated = history.themes.at(-1).theme;
    assert.deepEqual(tokens?.[`[${state.appliedThemeLabel}]`], { textMateRules: generated.tokenColors });
    const semantic = vscode.workspace.getConfiguration('editor').get<Record<string, unknown>>('semanticTokenColorCustomizations');
    assert.deepEqual(semantic?.[`[${state.appliedThemeLabel}]`], { enabled: true, rules: generated.semanticTokenColors });
    console.log(`PASS: applied UI/syntax colors and archived ${path.basename(image)}`);
  }
  await vscode.commands.executeCommand('walltheme.resetTheme');
  assert.deepEqual(vscode.workspace.getConfiguration('workbench').inspect('colorCustomizations')?.globalValue, previousWorkbench);
  assert.deepEqual(vscode.workspace.getConfiguration('editor').inspect('tokenColorCustomizations')?.globalValue, previousTokens);
  assert.deepEqual(vscode.workspace.getConfiguration('editor').inspect('semanticTokenColorCustomizations')?.globalValue, previousSemanticTokens);
  console.log('PASS: activation, generation, JSON history, and reset in real extension host');

  await vscode.workspace.getConfiguration('walltheme').update('autoReload', true, vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('walltheme').update('watchIntervalMs', 1000, vscode.ConfigurationTarget.Global);
  const storage = path.join(process.env.WALLTHEME_TEST_USER_DATA!, 'User/globalStorage/walltheme.walltheme');
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
}
