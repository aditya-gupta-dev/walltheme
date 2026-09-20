import * as vscode from 'vscode';

/** Lazily-created shared output channel with log levels. */
export class Logger {
  private static channel: vscode.OutputChannel | undefined;

  static get(): vscode.OutputChannel {
    if (!Logger.channel) {
      Logger.channel = vscode.window.createOutputChannel('WallTheme');
    }
    return Logger.channel;
  }

  static info(msg: string): void {
    Logger.get().appendLine(`[info] ${new Date().toISOString()} ${msg}`);
  }

  static warn(msg: string): void {
    Logger.get().appendLine(`[warn] ${new Date().toISOString()} ${msg}`);
  }

  static error(msg: string, err?: unknown): void {
    const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    Logger.get().appendLine(`[error] ${new Date().toISOString()} ${msg}\n${detail}`);
  }

  static show(): void {
    Logger.get().show(true);
  }

  static dispose(): void {
    Logger.channel?.dispose();
    Logger.channel = undefined;
  }
}
