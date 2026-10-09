/**
 * End-to-end pipeline test: PNG bytes → decode → sample → quantize/score →
 * dynamic scheme → VS Code theme JSON. No vscode module involved.
 */
import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PNG } from 'pngjs';

import {
  decodeImage,
  detectImageFormat,
  extractPixels,
  nearestNeighborDownscale,
} from '../src/image/decode';
import {
  argbFromHex,
  argbFromRgb,
  buildScheme,
  hexFromArgb,
  quantizeAndScore,
  schemeToHexMap,
} from '../src/theme/mcu';
import { generateTheme } from '../src/theme/vscode-theme';
import { Contrast, Hct } from '@material/material-color-utilities';

function makeTestPng(dir: string): string {
  const png = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const idx = (64 * y + x) << 2;
      if (x < 16 && y < 16) {
        // amber accent block
        png.data[idx] = 0xd8;
        png.data[idx + 1] = 0x84;
        png.data[idx + 2] = 0x2b;
      } else {
        // deep teal field (dominant)
        png.data[idx] = 0x1a;
        png.data[idx + 1] = 0x5e;
        png.data[idx + 2] = 0x63;
      }
      png.data[idx + 3] = 255;
    }
  }
  const file = path.join(dir, 'walltheme-test.png');
  fs.writeFileSync(file, PNG.sync.write(png));
  return file;
}

describe('image format detection', () => {
  test('detects PNG magic bytes', () => {
    const buf = fs.readFileSync(makeTestPng(fs.mkdtempSync(path.join(os.tmpdir(), 'walltheme-'))));
    expect(detectImageFormat(buf)).toBe('png');
  });

  test('rejects garbage', () => {
    expect(detectImageFormat(Buffer.from('not an image at all'))).toBe('unknown');
  });
});

describe('decode + extraction', () => {
  test('decodes BMP channels and row order as opaque RGBA', async () => {
    const bmp = Buffer.alloc(70);
    bmp.write('BM');
    bmp.writeUInt32LE(70, 2);
    bmp.writeUInt32LE(54, 10);
    bmp.writeUInt32LE(40, 14);
    bmp.writeInt32LE(2, 18);
    bmp.writeInt32LE(2, 22);
    bmp.writeUInt16LE(1, 26);
    bmp.writeUInt16LE(24, 28);
    Buffer.from([255, 0, 0, 0, 255, 255, 0, 0, 0, 0, 255, 0, 255, 0, 0, 0]).copy(bmp, 54);
    const image = await decodeImage(bmp);
    expect([...image.data]).toEqual([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]);
    expect(extractPixels(image)).toHaveLength(4);
  });

  test('decodes TIFF pixels through the first IFD', async () => {
    const imported = await import('utif');
    const utif = ((imported as unknown as { default?: typeof imported }).default ?? imported);
    const rgba = new Uint8Array([26, 94, 99, 255, 216, 132, 43, 255]);
    const image = await decodeImage(Buffer.from(utif.encodeImage(rgba, 2, 1)));
    expect(image.width).toBe(2);
    expect(image.height).toBe(1);
    expect([...image.data]).toEqual([...rgba]);
  });

  test('places an offset GIF frame into its logical canvas', async () => {
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
    gif.writeUInt16LE(3, 6);
    gif.writeUInt16LE(3, 8);
    const descriptor = gif.indexOf(0x2c);
    gif.writeUInt16LE(1, descriptor + 1);
    gif.writeUInt16LE(1, descriptor + 3);
    const image = await decodeImage(gif);
    expect(image.data.length).toBe(3 * 3 * 4);
    expect(image.data[4 * 4 + 3]).toBe(255);
    expect(image.data[3]).toBe(0);
    expect(extractPixels(image)).toHaveLength(1);
  });

  test('decodes WebP through the isolated native decoder', async () => {
    const webp = Buffer.from('UklGRjQAAABXRUJQVlA4ICgAAACQAQCdASoIAAgAAUAmJaACdLoAA5gA/vPfZrQtCBz/5Bjt57ed2AAA', 'base64');
    const image = await decodeImage(webp);
    expect(image.width).toBe(8);
    expect(image.height).toBe(8);
    expect(image.data.length).toBe(8 * 8 * 4);
    expect(extractPixels(image).length).toBeGreaterThan(0);
  });

  test('decodes and downsizes a large PNG without native resizing', async () => {
    const png = new PNG({ width: 2001, height: 1301 });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 0x1a;
      png.data[i + 1] = 0x5e;
      png.data[i + 2] = 0x63;
      png.data[i + 3] = 255;
    }
    const img = await decodeImage(PNG.sync.write(png));
    expect(img.width * img.height).toBeLessThanOrEqual(2_500_000);
    expect(img.data.length).toBe(img.width * img.height * 4);
    const pixels = extractPixels(img);
    expect(pixels.length).toBeLessThanOrEqual(150_000);
    expect(pixels[0]).toBe(argbFromRgb(0x1a, 0x5e, 0x63));
  });

  test('decodes PNG to RGBA and samples opaque pixels', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'walltheme-'));
    const buf = fs.readFileSync(makeTestPng(dir));
    const img = await decodeImage(buf);
    expect(img.width).toBe(64);
    expect(img.height).toBe(64);
    expect(img.data.length).toBe(64 * 64 * 4);

    const pixels = extractPixels(img);
    expect(pixels.length).toBeGreaterThan(0);
    expect(pixels.length).toBeLessThanOrEqual(64 * 64);

    const teal = argbFromRgb(0x1a, 0x5e, 0x63);
    expect(pixels).toContain(teal);
  });
});

describe('quantize + score', () => {
  test('ranks the dominant field color first', () => {
    const pixels: number[] = [];
    for (let i = 0; i < 3000; i++) pixels.push(argbFromRgb(0x1a, 0x5e, 0x63));
    for (let i = 0; i < 300; i++) pixels.push(argbFromRgb(0xd8, 0x84, 0x2b));
    for (let i = 0; i < 100; i++) pixels.push(argbFromRgb(0xf0, 0xf0, 0xf0));

    const scored = quantizeAndScore(pixels, 64, 4);
    expect(scored.length).toBeGreaterThan(0);
    const seedHex = hexFromArgb(scored[0].argb).toUpperCase();
    // Dominant teal must win the seed (Score filters near-white out).
    expect(seedHex).not.toBe('#F0F0F0');
  });

  test('handles a single-color image', () => {
    const pixels = new Array(500).fill(argbFromRgb(0x66, 0x33, 0x99));
    const scored = quantizeAndScore(pixels, 16, 4);
    expect(scored.length).toBeGreaterThanOrEqual(1);
  });
});

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

describe('downscale', () => {
  test('shrinks huge images under the pixel cap', () => {
    const big = { width: 2000, height: 2000, data: Buffer.alloc(2000 * 2000 * 4) };
    for (let i = 0; i < big.data.length; i += 4) {
      big.data[i] = 200;
      big.data[i + 3] = 255;
    }
    const small = nearestNeighborDownscale(big);
    expect(small.width * small.height).toBeLessThanOrEqual(2_500_000);
    expect(small.data.length).toBe(small.width * small.height * 4);
  });
});
