import * as vscode from 'vscode';
import type { ColorsGenerator } from './generator';

/** Status bar item reflecting generator state; click opens the actions dropdown. */
export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor(private readonly generator: ColorsGenerator) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
    this.item.name = 'WallTheme';
    this.item.command = 'walltheme.openMenu';
    this.refresh();
    this.item.show();
  }

  refresh(): void {
    const { state, info, error } = this.generator.describeState();
    switch (state) {
      case 'working':
        this.item.text = '$(sync~spin) WallTheme';
        this.item.tooltip = 'WallTheme: generating theme…';
        this.item.backgroundColor = undefined;
        break;
      case 'ready':
        this.item.text = '$(paintcan) WallTheme';
        this.item.tooltip = new vscode.MarkdownString(
          `**WallTheme active**\n\n${info?.summary ?? ''}\n\nSource: ${info?.source ?? '—'} (${info?.via ?? '—'})\n\nClick to choose an image or manage your theme.`,
        );
        this.item.backgroundColor = undefined;
        break;
      case 'error':
        this.item.text = '$(paintcan) WallTheme!';
        this.item.tooltip = `WallTheme error: ${error ?? 'unknown'}\n\nClick to choose another image or retry.`;
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;
      case 'idle':
      default:
        this.item.text = '$(paintcan) WallTheme';
        this.item.tooltip = 'WallTheme: click to generate a theme from an image';
        this.item.backgroundColor = undefined;
        break;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
