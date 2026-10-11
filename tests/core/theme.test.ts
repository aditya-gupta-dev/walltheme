import { describe, expect, test } from 'bun:test';
import { applyIntensity, argbFromHex, buildScheme, Contrast, generateSyntaxColors, Hct, schemeToHexMap } from '@walltheme/core';

describe('editor-neutral theme roles', () => {
  test('syntax kinds remain readable without an editor adapter', () => {
    for (const isDark of [true, false]) {
      const colors = schemeToHexMap(buildScheme({ sourceColorArgb: argbFromHex('1A5E63'), isDark, contrastLevel: 0, variant: 'tonalSpot' }));
      for (const style of ['material', 'rainbow', 'monochrome', 'vibrant']) {
        const syntax = generateSyntaxColors(colors, style);
        expect(Object.keys(syntax)).toContain('keyword');
        expect(Object.keys(syntax)).toContain('string');
        const background = Hct.fromInt(argbFromHex(colors.surface)).tone;
        for (const [kind, hex] of Object.entries(syntax)) {
          const contrast = Contrast.ratioOfTones(Hct.fromInt(argbFromHex(hex)).tone, background);
          expect(contrast).toBeGreaterThanOrEqual(kind === 'comment' ? 3 : 4.5);
        }
      }
    }
  });

  test('intensity changes accents while preserving surfaces and source palette', () => {
    const colors = schemeToHexMap(buildScheme({ sourceColorArgb: argbFromHex('D8842B'), isDark: true, contrastLevel: 0, variant: 'vibrant' }));
    const original = { ...colors };
    const softened = applyIntensity(colors, 0.5);
    expect(Hct.fromInt(argbFromHex(softened.primary)).chroma).toBeLessThan(Hct.fromInt(argbFromHex(colors.primary)).chroma);
    expect(softened.surface).toBe(colors.surface);
    expect(softened.onSurface).toBe(colors.onSurface);
    expect(colors).toEqual(original);
    expect(applyIntensity(colors, 1)).toEqual(original);
  });
});
