/**
 * Token color mapping strategies — decides which tonal role colors which
 * syntax token. Four styles: material (default), rainbow, monochrome, vibrant.
 */
import type { SchemeColorKey } from './mcu';

export interface TokenPalette {
  [scopeKind: string]: SchemeColorKey;
}

/**
 * Material You inspired mapping: each token kind maps to an M3 role.
 * Works in both dark and light themes because roles flip appropriately
 * (e.g. primaryContainer is dark in dark schemes, light in light schemes).
 */
export const MATERIAL_TOKENS: TokenPalette = {
  keyword: 'primary',
  keywordControl: 'tertiary',
  storageType: 'primary',
  function: 'primary',
  methodCall: 'onPrimaryContainer',
  typeClass: 'tertiary',
  typeInterface: 'onTertiaryContainer',
  variable: 'secondary',
  property: 'onPrimaryContainer',
  parameter: 'onSecondaryContainer',
  constant: 'secondary',
  string: 'tertiary',
  stringEscape: 'onTertiaryContainer',
  number: 'secondary',
  boolean: 'secondary',
  comment: 'outline',
  regex: 'onSecondaryContainer',
  tag: 'primary',
  attribute: 'tertiary',
  operator: 'onSurfaceVariant',
  punctuation: 'onSurfaceVariant',
  heading: 'primary',
  link: 'secondary',
  emphasis: 'onSurface',
  strong: 'onSurface',
  invalid: 'error',
  gutter: 'onSurfaceVariant',
};

/** Vibrant: high-chroma roles for every token kind. */
export const VIBRANT_TOKENS: TokenPalette = {
  keyword: 'primary',
  keywordControl: 'tertiary',
  storageType: 'primary',
  function: 'primary',
  methodCall: 'inversePrimary',
  typeClass: 'tertiary',
  typeInterface: 'onTertiaryContainer',
  variable: 'onSurface',
  property: 'onSurfaceVariant',
  parameter: 'inversePrimary',
  constant: 'secondary',
  string: 'tertiary',
  stringEscape: 'onTertiaryContainer',
  number: 'secondary',
  boolean: 'secondary',
  comment: 'outline',
  regex: 'onSecondaryContainer',
  tag: 'primary',
  attribute: 'tertiary',
  operator: 'onSurfaceVariant',
  punctuation: 'onSurfaceVariant',
  heading: 'primary',
  link: 'secondary',
  emphasis: 'onSurface',
  strong: 'inversePrimary',
  invalid: 'error',
  gutter: 'onSurfaceVariant',
};

/** Rainbow: distinct hue per token kind (uses rotated accent palettes). */
export const RAINBOW_TOKENS: TokenPalette = {
  keyword: 'primary',
  keywordControl: 'tertiary',
  storageType: 'primary',
  function: 'primary',
  methodCall: 'secondary',
  typeClass: 'tertiary',
  typeInterface: 'secondary',
  variable: 'onSurface',
  property: 'onSurfaceVariant',
  parameter: 'onSurface',
  constant: 'secondary',
  string: 'tertiary',
  stringEscape: 'onTertiaryContainer',
  number: 'secondary',
  boolean: 'tertiary',
  comment: 'outline',
  regex: 'onSecondaryContainer',
  tag: 'primary',
  attribute: 'tertiary',
  operator: 'onSurfaceVariant',
  punctuation: 'onSurfaceVariant',
  heading: 'primary',
  link: 'secondary',
  emphasis: 'onSurface',
  strong: 'primary',
  invalid: 'error',
  gutter: 'onSurfaceVariant',
};

/** Monochrome: grayscale syntax, only comments and errors escape. */
export const MONO_TOKENS: TokenPalette = {
  keyword: 'onSurface',
  keywordControl: 'outline',
  storageType: 'onSurface',
  function: 'onSurface',
  methodCall: 'onSurface',
  typeClass: 'onSurface',
  typeInterface: 'onSurface',
  variable: 'onSurface',
  property: 'onSurfaceVariant',
  parameter: 'onSurface',
  constant: 'onSurface',
  string: 'onSurfaceVariant',
  stringEscape: 'outline',
  number: 'onSurface',
  boolean: 'onSurface',
  comment: 'outline',
  regex: 'onSurfaceVariant',
  tag: 'onSurface',
  attribute: 'onSurfaceVariant',
  operator: 'onSurfaceVariant',
  punctuation: 'onSurfaceVariant',
  heading: 'onSurface',
  link: 'onSurfaceVariant',
  emphasis: 'onSurface',
  strong: 'onSurface',
  invalid: 'error',
  gutter: 'outline',
};

export const TOKEN_PALETTES: Record<string, TokenPalette> = {
  material: MATERIAL_TOKENS,
  rainbow: RAINBOW_TOKENS,
  monochrome: MONO_TOKENS,
  vibrant: VIBRANT_TOKENS,
};
