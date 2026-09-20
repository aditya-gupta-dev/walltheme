/**
 * Generates assets/icon.png — a simple paintcan-inspired mark derived from
 * Material's default seed (#6750A4) and its tonal container colors.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const S = 128;
const png = new PNG({ width: S, height: S });

// Rounded-rect badge + droplet, drawn with simple SDFs.
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (edge, v) => {
  const t = clamp01((v - edge + 1) / 2);
  return t * t * (3 - 2 * t);
};

function roundedRectSDF(x, y, bx, by, w, h, r) {
  const qx = Math.abs(x - bx) - w + r;
  const qy = Math.abs(y - by) - h + r;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

function circleSDF(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r;
}

// Tones from the M3 purple seed: bg 90, container 80, on-container 20, seed 40.
const BG = [0xf3, 0xed, 0xf7]; // ~ primaryContainer tone 90
const BADGE = [0x67, 0x50, 0xa4]; // seed
const DROP = [0xd8, 0xbc, 0xfd]; // primaryContainer
const INK = [0x4a, 0x37, 0x7a]; // onPrimaryContainer-ish

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const idx = (S * y + x) << 2;
    let c = BG;

    const badge = roundedRectSDF(x + 0.5, y + 0.5, S / 2, S / 2, 108, 108, 26);
    if (badge < 0) {
      c = BADGE;
      // droplet inside
      const drop = circleSDF(x + 0.5, y + 0.5 + 6, S / 2, S / 2 - 6, 30);
      const tip = circleSDF(x + 0.5, y + 0.5 - 26, S / 2, S / 2 + 26, 12);
      if (drop < 0 || tip < 0) c = DROP;
      // little "A" stroke hint to evoke Material
      const bar = roundedRectSDF(x + 0.5, y + 0.5, S / 2, S / 2 + 22, 30, 5, 2.5);
      if (bar < 0 && (drop < 4 || tip < 4)) c = INK;
    }

    const alpha = clamp01(0.5 - badge) ; // 1 inside, 0 outside, AA on edge
    const a = Math.round(clamp01(smooth(0.5, 0.5 - badge)) * 255);
    png.data[idx] = c[0];
    png.data[idx + 1] = c[1];
    png.data[idx + 2] = c[2];
    png.data[idx + 3] = Math.max(a, Math.round(alpha * 255));
  }
}

mkdirSync('assets', { recursive: true });
writeFileSync('assets/icon.png', PNG.sync.write(png));
console.log('wrote assets/icon.png');
