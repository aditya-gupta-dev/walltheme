import * as fs from 'fs';
import type { ThemeColors, VsCodeTheme } from './vscode-theme';

export interface ArchivedTheme {
  generatedAt: string | null;
  source: string;
  seedHex: string;
  palette: string[];
  materialColors: ThemeColors;
  theme: VsCodeTheme;
}

/** Keep every generated palette, UI color and syntax rule in one JSON file. */
export function archiveTheme(file: string, entry: ArchivedTheme, previous?: ArchivedTheme): void {
  let themes: ArchivedTheme[] = [];
  if (fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as { version: number; themes: ArchivedTheme[] };
    if (saved.version !== 1 || !Array.isArray(saved.themes)) {
      throw new Error('Invalid generated theme history; existing file was preserved.');
    }
    themes = saved.themes;
  } else if (previous) {
    themes.push(previous);
  }
  themes.push(entry);
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ version: 1, themes }, null, 2));
  fs.renameSync(temporary, file);
}
