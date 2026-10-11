import { TOKEN_PALETTES } from './tokens';
import { argbFromHex, Contrast, Hct, hexFromArgb } from './mcu';
import type { ThemeColors } from './types';

/** Readable foreground colors keyed by editor-neutral syntax kinds. */
export function generateSyntaxColors(colors: ThemeColors, style = 'material'): Record<string, string> {
  const palette = TOKEN_PALETTES[style] ?? TOKEN_PALETTES.material;
  const backgroundTone = Hct.fromInt(argbFromHex(colors.surface)).tone;
  return Object.fromEntries(Object.entries(palette).map(([kind, role]) => {
    const color = colors[role];
    const hct = Hct.fromInt(argbFromHex(color));
    const minimum = kind === 'comment' ? 3 : 4.5;
    if (Contrast.ratioOfTones(hct.tone, backgroundTone) >= minimum) return [kind, color];
    const tone = backgroundTone < 50
      ? Contrast.lighterUnsafe(backgroundTone, minimum + 0.1)
      : Contrast.darkerUnsafe(backgroundTone, minimum + 0.1);
    return [kind, hexFromArgb(Hct.from(hct.hue, hct.chroma, tone).toInt()).toUpperCase()];
  }));
}
