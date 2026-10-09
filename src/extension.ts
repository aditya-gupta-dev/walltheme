import * as vscode from 'vscode';
import { ColorsGenerator } from './generator';
import { StatusBarManager } from './statusbar';
import { registerCommands } from './commands';
import { Logger } from './util/log';

/**
 * WallTheme — Material You for VS Code.
 *
 * Generates a complete color theme from a chosen image,
 * matugen-style: WSRGB quantization → HCT seed scoring → tonal palettes →
 * full UI and syntax theme saved as JSON and selected by name.
 */
export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  const generator = new ColorsGenerator(ctx);
  const status = new StatusBarManager(generator);

  ctx.subscriptions.push(generator, status, registerCommands(ctx, generator, status));

  Logger.info(`activated (host: ${vscode.env.appName} ${vscode.version})`);
  status.refresh();

  // Re-apply the last generated theme so the look survives restarts.
  await generator.restoreOnActivation();
}

export function deactivate(): void {
  Logger.dispose();
}
