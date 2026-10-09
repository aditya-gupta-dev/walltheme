/**
 * Typed facade over @material/material-color-utilities — the exact library
 * matugen ports its algorithms from. Everything dominant-color related goes
 * through here so the rest of the extension never touches raw MCU types.
 */
import {
  Contrast,
  DynamicScheme,
  Hct,
  MaterialDynamicColors,
  QuantizerCelebi,
  Score,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeFruitSalad,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeRainbow,
  SchemeTonalSpot,
  SchemeVibrant,
  TonalPalette,
  Variant,
  argbFromHex,
  argbFromRgb,
  hexFromArgb,
} from '@material/material-color-utilities';

export { argbFromHex, argbFromRgb, hexFromArgb, Hct, TonalPalette, Contrast };

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface QuantizedCluster {
  argb: number;
  population: number;
}

/**
 * Dominant color extraction, matugen-style:
 *  1. Celebi (WSMeans + Wu) quantization to ≤ maxColors clusters
 *  2. Score clusters by weighted chroma × population with hue diversity
 *
 * Returns clusters ordered by score (best seed first).
 */
export function quantizeAndScore(pixels: number[], maxColors = 128, desired = 8): QuantizedCluster[] {
  const result = QuantizerCelebi.quantize(pixels, maxColors);
  const clusters: QuantizedCluster[] = [...result.entries()].map(([argb, population]) => ({
    argb,
    population,
  }));
  const scored = Score.score(result, { desired: Math.min(desired, Math.max(1, clusters.length)) });
  const byScore = new Map(scored.map((argb, index) => [argb, index]));
  const ordered = clusters
    .filter((c) => byScore.has(c.argb))
    .sort((a, b) => (byScore.get(a.argb) ?? 0) - (byScore.get(b.argb) ?? 0));
  if (ordered.length === 0) {
    // Degenerate image: fall back to the largest cluster.
    clusters.sort((a, b) => b.population - a.population);
    return clusters.slice(0, 1);
  }
  return ordered;
}

export function dominantSourceColor(pixels: number[]): number {
  return quantizeAndScore(pixels, 128, 1)[0]?.argb ?? argbFromRgb(103, 80, 164);
}

// ---------------------------------------------------------------------------
// Dynamic color schemes
// ---------------------------------------------------------------------------

export type SchemeVariant =
  | 'tonalSpot'
  | 'vibrant'
  | 'expressive'
  | 'content'
  | 'fidelity'
  | 'rainbow'
  | 'fruitSalad'
  | 'neutral'
  | 'monochrome'
  | 'contrast';

const VARIANT_MAP: Record<SchemeVariant, Variant> = {
  tonalSpot: Variant.TONAL_SPOT,
  vibrant: Variant.VIBRANT,
  expressive: Variant.EXPRESSIVE,
  content: Variant.CONTENT,
  fidelity: Variant.FIDELITY,
  rainbow: Variant.RAINBOW,
  fruitSalad: Variant.FRUIT_SALAD,
  neutral: Variant.NEUTRAL,
  monochrome: Variant.MONOCHROME,
  contrast: Variant.TONAL_SPOT,
};

/** Build any M3 dynamic scheme from a source color. */
export function buildScheme(opts: {
  sourceColorArgb: number;
  isDark: boolean;
  contrastLevel: number;
  variant: SchemeVariant;
}): DynamicScheme {
  const { sourceColorArgb, isDark, contrastLevel } = opts;
  const sourceColorHct = Hct.fromInt(sourceColorArgb);
  const variant = opts.variant;
  switch (variant) {
    case 'vibrant':
      return new SchemeVibrant(sourceColorHct, isDark, contrastLevel);
    case 'expressive':
      return new SchemeExpressive(sourceColorHct, isDark, contrastLevel);
    case 'content':
      return new SchemeContent(sourceColorHct, isDark, contrastLevel);
    case 'fidelity':
      return new SchemeFidelity(sourceColorHct, isDark, contrastLevel);
    case 'rainbow':
      return new SchemeRainbow(sourceColorHct, isDark, contrastLevel);
    case 'fruitSalad':
      return new SchemeFruitSalad(sourceColorHct, isDark, contrastLevel);
    case 'neutral':
      return new SchemeNeutral(sourceColorHct, isDark, contrastLevel);
    case 'monochrome':
      return new SchemeMonochrome(sourceColorHct, isDark, contrastLevel);
    case 'contrast':
      // High-contrast tonal spot: push contrast to maximum.
      return new SchemeTonalSpot(sourceColorHct, isDark, Math.max(contrastLevel, 1));
    case 'tonalSpot':
    default:
      return new SchemeTonalSpot(sourceColorHct, isDark, contrastLevel);
  }
}

export type SchemeColorKey =
  | 'primary'
  | 'onPrimary'
  | 'primaryContainer'
  | 'onPrimaryContainer'
  | 'secondary'
  | 'onSecondary'
  | 'secondaryContainer'
  | 'onSecondaryContainer'
  | 'tertiary'
  | 'onTertiary'
  | 'tertiaryContainer'
  | 'onTertiaryContainer'
  | 'error'
  | 'onError'
  | 'errorContainer'
  | 'onErrorContainer'
  | 'background'
  | 'onBackground'
  | 'surface'
  | 'onSurface'
  | 'surfaceVariant'
  | 'onSurfaceVariant'
  | 'outline'
  | 'outlineVariant'
  | 'shadow'
  | 'scrim'
  | 'inverseSurface'
  | 'inverseOnSurface'
  | 'inversePrimary'
  | 'surfaceDim'
  | 'surfaceBright'
  | 'surfaceContainerLowest'
  | 'surfaceContainerLow'
  | 'surfaceContainer'
  | 'surfaceContainerHigh'
  | 'surfaceContainerHighest';

export const SCHEME_COLOR_KEYS: readonly SchemeColorKey[] = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'secondary',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiary',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'error',
  'onError',
  'errorContainer',
  'onErrorContainer',
  'background',
  'onBackground',
  'surface',
  'onSurface',
  'surfaceVariant',
  'onSurfaceVariant',
  'outline',
  'outlineVariant',
  'shadow',
  'scrim',
  'inverseSurface',
  'inverseOnSurface',
  'inversePrimary',
  'surfaceDim',
  'surfaceBright',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
];

type RoleColor = { getArgb(scheme: DynamicScheme): number };

/** All M3 role colors of a scheme as hex. */
export function schemeToHexMap(scheme: DynamicScheme): Record<SchemeColorKey, string> {
  const out = {} as Record<SchemeColorKey, string>;
  for (const key of SCHEME_COLOR_KEYS) {
    const role = (MaterialDynamicColors as unknown as Record<string, RoleColor>)[key];
    out[key] = hexFromArgb(role.getArgb(scheme)).toUpperCase();
  }
  return out;
}

export interface TonalSet {
  name: string;
  tones: Record<number, string>;
}

/** Export the 5 core tonal palettes for a source color (like matugen templates). */
export function tonalPalettes(sourceColorArgb: number): Record<
  'primary' | 'secondary' | 'tertiary' | 'neutral' | 'neutralVariant',
  TonalSet
> {
  const hct = Hct.fromInt(sourceColorArgb);
  const mk = (hue: number, chroma: number, name: string): TonalSet => {
    const palette = TonalPalette.fromHueAndChroma(hue, chroma);
    const tones: Record<number, string> = {};
    for (const t of [0, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 85, 90, 95, 99, 100]) {
      tones[t] = hexFromArgb(palette.tone(t)).toUpperCase();
    }
    return { name, tones };
  };
  return {
    primary: mk(hct.hue, 48, 'primary'),
    secondary: mk(hct.hue, 16, 'secondary'),
    tertiary: mk(hct.hue + 60, 24, 'tertiary'),
    neutral: mk(hct.hue, 4, 'neutral'),
    neutralVariant: mk(hct.hue, 8, 'neutral-variant'),
  };
}
