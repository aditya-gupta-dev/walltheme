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
    vscode.commands.registerCommand('walltheme.reloadTheme', async () => {
      await generator.generateFromPicker();
      status.refresh();
    }),

    vscode.commands.registerCommand('walltheme.wallpaperTheme', async () => {
      await generator.generateFromWallpaper();
      status.refresh();
    }),

    vscode.commands.registerCommand('walltheme.resetTheme', async () => {
      await generator.reset();
      status.refresh();
    }),

    vscode.commands.registerCommand('walltheme.exportTheme', () => generator.exportTheme()),

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
