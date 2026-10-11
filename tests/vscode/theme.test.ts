import { describe, expect, test } from 'bun:test';
import { argbFromHex, buildScheme, schemeToHexMap, Contrast, Hct } from '@walltheme/core';
import { generateTheme } from '../../packages/vscode/src/theme/vscode-theme';

describe('scheme + theme generation', () => {
  test('keeps code text readable in dark and light schemes across syntax styles', () => {
    for (const isDark of [true, false]) {
      for (const seed of ['1A5E63', 'D8842B', '6750A4']) {
        const colors = schemeToHexMap(buildScheme({ sourceColorArgb: argbFromHex(seed), isDark, contrastLevel: 0, variant: 'tonalSpot' }));
        for (const syntaxStyle of ['material', 'rainbow', 'monochrome', 'vibrant']) {
          const theme = generateTheme({ colors, isDark, syntaxStyle });
          const backgroundTone = Hct.fromInt(argbFromHex(theme.colors['editor.background'])).tone;
          for (const rule of theme.tokenColors) {
            const tone = Hct.fromInt(argbFromHex(rule.settings.foreground!)).tone;
            expect(Contrast.ratioOfTones(tone, backgroundTone)).toBeGreaterThanOrEqual(3);
          }
          for (const hex of Object.values(theme.semanticTokenColors)) {
            expect(Contrast.ratioOfTones(Hct.fromInt(argbFromHex(hex)).tone, backgroundTone)).toBeGreaterThanOrEqual(3);
          }
        }
      }
    }
  });

  test('syntax and semantic code colors follow image seed and selected style together', () => {
    const make = (seed: string, syntaxStyle: string) => generateTheme({
      colors: schemeToHexMap(buildScheme({ sourceColorArgb: argbFromHex(seed), isDark: true, contrastLevel: 0, variant: 'tonalSpot' })),
      isDark: true, syntaxStyle,
    });
    const teal = make('1A5E63', 'material');
    const amber = make('D8842B', 'material');
    expect(teal.semanticTokenColors.variable).not.toBe(amber.semanticTokenColors.variable);
    expect(teal.semanticTokenColors.string).not.toBe(amber.semanticTokenColors.string);
    const mono = make('1A5E63', 'monochrome');
    expect(mono.semanticTokenColors.keyword).toBe(mono.colors['editor.foreground']);
    expect(mono.semanticTokenColors.keyword).not.toBe(teal.semanticTokenColors.keyword);
    expect(teal.semanticTokenColors['variable.readonly']).toBe(teal.semanticTokenColors.enumMember);
    for (const theme of [teal, amber, mono]) {
      const strings = theme.tokenColors.find(rule => rule.scope.includes('string.quoted'));
      expect(strings?.settings.foreground).toBe(theme.semanticTokenColors.string);
    }
  });

  test('produces a complete, valid dark theme', () => {
    const seed = argbFromHex('1A5E63');
    const scheme = buildScheme({ sourceColorArgb: seed, isDark: true, contrastLevel: 0, variant: 'tonalSpot' });
    const hexMap = schemeToHexMap(scheme);

    // All M3 roles present and hex-formatted.
    for (const [, hex] of Object.entries(hexMap)) {
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    }

    const theme = generateTheme({ colors: hexMap, isDark: true, syntaxStyle: 'material' });
    expect(theme.type).toBe('dark');
    expect(theme.semanticHighlighting).toBe(true);
    expect(Object.keys(theme.colors).length).toBeGreaterThan(150);
    expect(theme.tokenColors.length).toBeGreaterThan(15);
    expect(Object.keys(theme.semanticTokenColors).length).toBeGreaterThan(10);

    // JSON-serializable (what gets written to the theme file).
    const round = JSON.parse(JSON.stringify(theme)) as typeof theme;
    expect(round.colors['editor.background']).toMatch(/^#[0-9A-F]{6}([0-9A-F]{2})?$/);
  });

  test('light theme flips type', () => {
    const seed = argbFromHex('D8842B');
    const scheme = buildScheme({ sourceColorArgb: seed, isDark: false, contrastLevel: 0, variant: 'vibrant' });
    const theme = generateTheme({ colors: schemeToHexMap(scheme), isDark: false, syntaxStyle: 'rainbow' });
    expect(theme.type).toBe('light');
  });
});
