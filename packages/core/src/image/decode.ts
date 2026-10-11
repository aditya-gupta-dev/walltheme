import type { Rgba } from '../theme/mcu';
import { argbFromRgb } from '../theme/mcu';

export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA8 buffer. */
  data: Buffer;
}

/** Upscale cap: decode at most ~2.5 MP for extraction speed. */
const MAX_PIXELS = 2_500_000;

type Decoder = (buf: Buffer) => Promise<DecodedImage>;

/** Detect format from magic bytes so extension lies don't matter. */
export function detectImageFormat(buf: Buffer): 'png' | 'jpeg' | 'gif' | 'bmp' | 'webp' | 'tiff' | 'unknown' {
  if (buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 6 && buf.toString('ascii', 0, 6) === 'GIF87a') return 'gif';
  if (buf.length >= 6 && buf.toString('ascii', 0, 6) === 'GIF89a') return 'gif';
  if (buf.length >= 2 && buf.toString('ascii', 0, 2) === 'BM') return 'bmp';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.length >= 4 && (buf.readUInt16BE(0) === 0x4d4d || buf.readUInt16BE(0) === 0x4949)) return 'tiff';
  return 'unknown';
}

async function decodePng(buf: Buffer): Promise<DecodedImage> {
  const { PNG } = await import('pngjs');
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: Buffer.from(png.data) };
}

async function decodeJpeg(buf: Buffer): Promise<DecodedImage> {
  const jpeg = await import('jpeg-js');
  const mod = ((jpeg as unknown as { default?: typeof jpeg }).default ?? jpeg) as typeof import('jpeg-js');
  const img = mod.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024 });
  return { width: img.width, height: img.height, data: Buffer.from(img.data) };
}

async function decodeBmp(buf: Buffer): Promise<DecodedImage> {
  const bmp = await import('bmp-js');
  const mod = ((bmp as unknown as { default?: typeof bmp }).default ?? bmp) as {
    decode: (b: Buffer) => { width: number; height: number; data: Buffer };
  };
  const decoded = mod.decode(buf);
  const { width, height } = decoded;
  const out = Buffer.alloc(width * height * 4);
  // bmp-js already orders rows top-down, but its bytes are ABGR.
  // Its alpha byte is unused (zero) for ordinary BMPs.
  for (let i = 0; i < out.length; i += 4) {
    out[i] = decoded.data[i + 3];
    out[i + 1] = decoded.data[i + 2];
    out[i + 2] = decoded.data[i + 1];
    out[i + 3] = 255;
  }
  return { width, height, data: out };
}

async function decodeGif(buf: Buffer): Promise<DecodedImage> {
  const { decompressFrames, parseGIF } = await import('gifuct-js');
  const gif = parseGIF(buf as unknown as ArrayBuffer);
  const frames = decompressFrames(gif, true);
  if (frames.length === 0) throw new Error('GIF has no frames');
  const { width, height } = gif.lsd;
  const frame = frames[0];
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < frame.dims.height; y++) {
    const targetY = frame.dims.top + y;
    if (targetY >= height) break;
    const count = Math.min(frame.dims.width, width - frame.dims.left);
    if (count <= 0) continue;
    Buffer.from(frame.patch.buffer, frame.patch.byteOffset + y * frame.dims.width * 4, count * 4)
      .copy(data, (targetY * width + frame.dims.left) * 4);
  }
  return { width, height, data };
}

async function decodeTiff(buf: Buffer): Promise<DecodedImage> {
  const imported = await import('utif');
  const UTIF = ((imported as unknown as { default?: unknown }).default ?? imported) as {
    decode: (b: Buffer) => { width: number; height: number }[];
    decodeImage: (b: Buffer, ifd: unknown, ifds: unknown[]) => void;
    toRGBA8: (ifd: unknown) => Uint8Array;
  };
  const ifds = UTIF.decode(buf);
  if (ifds.length === 0) throw new Error('TIFF has no IFDs');
  UTIF.decodeImage(buf, ifds[0], ifds);
  const rgba = UTIF.toRGBA8(ifds[0]);
  return { width: ifds[0].width, height: ifds[0].height, data: Buffer.from(rgba) };
}

const DECODERS: Partial<Record<string, Decoder>> = {
  png: decodePng,
  jpeg: decodeJpeg,
  bmp: decodeBmp,
  gif: decodeGif,
  tiff: decodeTiff,
};

/** Decode any supported image into RGBA8, downscaling very large inputs. */
export async function decodeImage(buf: Buffer): Promise<DecodedImage> {
  const format = detectImageFormat(buf);
  const decoder = DECODERS[format];

  if (format === 'unknown' || !decoder) {
    throw new Error('Unsupported image format. Choose a PNG, JPEG, GIF, BMP, or TIFF image.');
  }

  const decoded = await decoder(buf);
  if (decoded.width * decoded.height <= MAX_PIXELS) return decoded;
  // Downscale in JavaScript without native libraries.
  return nearestNeighborDownscale(decoded);
}

/** Box/nearest-neighbor downscale — no deps, good enough for color extraction. */
export function nearestNeighborDownscale(img: DecodedImage): DecodedImage {
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (img.width * img.height)));
  const w = Math.max(1, Math.floor(img.width * scale));
  const h = Math.max(1, Math.floor(img.height * scale));
  const out = Buffer.alloc(w * h * 4);
  const xRatio = img.width / w;
  const yRatio = img.height / h;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor(y * yRatio));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x * xRatio));
      const si = (sy * img.width + sx) * 4;
      const di = (y * w + x) * 4;
      out[di] = img.data[si];
      out[di + 1] = img.data[si + 1];
      out[di + 2] = img.data[si + 2];
      out[di + 3] = img.data[si + 3];
    }
  }
  return { width: w, height: h, data: out };
}

/** ARGB ints for MCU, skipping transparent + near-transparent pixels. */
export function extractPixels(img: DecodedImage, maxSamples = 150_000): number[] {
  const total = img.width * img.height;
  const step = Math.max(1, Math.ceil(total / maxSamples));
  const pixels: number[] = [];
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    const a = img.data[o + 3];
    if (a < 255) continue; // skip transparent-ish
    pixels.push(argbFromRgb(img.data[o], img.data[o + 1], img.data[o + 2]));
  }
  if (pixels.length === 0) {
    throw new Error('Image has no opaque pixels to analyze');
  }
  return pixels;
}

export type { Rgba };
