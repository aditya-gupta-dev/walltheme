import { argbFromHex, Hct, hexFromArgb, TonalPalette } from './mcu';
import type { ThemeColors } from './types';

const ACCENT_ROLES: readonly (keyof ThemeColors)[] = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'inversePrimary',
];

/** Rebuild a color with scaled chroma (same hue + tone) — the "intensity" dial. */
function scaleChroma(argbHex: string, factor: number): string {
  const argb = argbFromHex(argbHex.replace('#', ''));
  const hct = Hct.fromInt(argb);
  const chroma = Math.min(200, Math.max(0, hct.chroma * factor));
  return hexFromArgb(TonalPalette.fromHueAndChroma(hct.hue, chroma).tone(hct.tone)).toUpperCase();
}

export function applyIntensity(map: ThemeColors, intensity: number): ThemeColors {
  const colors = { ...map };
  if (intensity >= 0.95 && intensity <= 1.05) return colors;
  for (const role of ACCENT_ROLES) colors[role] = scaleChroma(colors[role], intensity);
  return colors;
}
