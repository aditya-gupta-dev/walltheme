import * as vscode from 'vscode';
import { ColorsGenerator } from './generator';
import { StatusBarManager } from './statusbar';
import { registerCommands } from './commands';
import { Logger } from './util/log';

/**
 * WallTheme — Material You for VS Code.
 *
 * Generates a complete color theme from the desktop wallpaper or any image,
 * matugen-style: WSRGB quantization → HCT seed scoring → tonal palettes →
 * full theme applied via workbench color customizations (instant, no reload).
 */
export function activate(ctx: vscode.ExtensionContext): void {
  const generator = new ColorsGenerator(ctx);
  const status = new StatusBarManager(generator);

  ctx.subscriptions.push(generator, status, registerCommands(ctx, generator, status));

  Logger.info(`activated (host: ${vscode.env.appName} ${vscode.version})`);
  status.refresh();

  // Re-apply the last generated theme so the look survives restarts.
  void generator.restoreOnActivation();
}

export function deactivate(): void {
  Logger.dispose();
}
