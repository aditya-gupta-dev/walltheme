import * as vscode from 'vscode';
import type { ColorsGenerator } from './generator';
import type { StatusBarManager } from './statusbar';
import { Logger } from './util/log';

/** Register every command contributed in package.json. Returns a Disposable. */
export function registerCommands(
  ctx: vscode.ExtensionContext,
  generator: ColorsGenerator,
  status: StatusBarManager,
): vscode.Disposable {
  const registrations: vscode.Disposable[] = [
    vscode.commands.registerCommand('walltheme.generateFromImage', async (image?: vscode.Uri) => {
      await generator.generateFromPicker(image);
      status.refresh();
    }),

    vscode.commands.registerCommand('walltheme.openMenu', async () => {
      const picked = await vscode.window.showQuickPick([
        { label: '$(file-media) Generate Theme from Image…', description: 'Choose an image, extract colors, and apply', command: 'walltheme.generateFromImage' },
        { label: '$(symbol-color) Choose Source Color…', description: 'Generate from a hex color', command: 'walltheme.chooseSeed' },
        { label: '$(paintcan) Preview Palette', description: 'View extracted colors', command: 'walltheme.preview' },
        { label: '$(export) Export Theme as JSON…', description: 'Save the generated theme', command: 'walltheme.exportTheme' },
        { label: '$(go-to-file) Open Generated Theme Files…', description: 'View active files and history paths', command: 'walltheme.openThemeFiles' },
        { label: '$(discard) Reset Theme', description: 'Restore previous appearance', command: 'walltheme.resetTheme' },
      ], {
        title: 'WallTheme',
        placeHolder: 'Generate a VS Code theme from an image',
        matchOnDescription: true,
      });
      if (picked) await vscode.commands.executeCommand(picked.command);
    }),

    vscode.commands.registerCommand('walltheme.reloadTheme', async () => {
      await generator.generateFromPicker();
      status.refresh();
    }),

    vscode.commands.registerCommand('walltheme.resetTheme', async () => {
      await generator.reset();
      status.refresh();
    }),

    vscode.commands.registerCommand('walltheme.exportTheme', () => generator.exportTheme()),
    vscode.commands.registerCommand('walltheme.openThemeFiles', () => generator.openThemeFiles()),

    vscode.commands.registerCommand('walltheme.preview', () => generator.previewPalette()),

    vscode.commands.registerCommand('walltheme.chooseSeed', async () => {
      await generator.chooseSeedColor();
      status.refresh();
    }),
  ];

  // Keep the status bar in sync with generator state transitions.
  registrations.push(
    generator.onDidChangeState(() => status.refresh()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('walltheme')) {
        Logger.info('walltheme settings changed');
        status.refresh();
      }
    }),
  );

  return vscode.Disposable.from(...registrations);
}
