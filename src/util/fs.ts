import * as fs from 'fs';
import * as path from 'path';

export function normalizePath(p: string): string {
  return path.normalize(p);
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function isFile(p: string): Promise<boolean> {
  try {
    const st = await fs.promises.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

export function homePath(): string {
  return process.env.HOME || process.env.USERPROFILE || '';
}

export function expandHome(p: string): string {
  if (p === '~') return homePath();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(homePath(), p.slice(2));
  }
  return p;
}

export function cssSha1(input: string): string {
  // Tiny synchronous SHA-1 substitute — deterministic cache key only.
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${a}${b}`;
}

export function assertFileReadable(p: string): void {
  if (!fs.existsSync(p)) {
    throw new Error(`File not found: ${p}`);
  }
  // eslint-disable-next-line no-bitwise
  const mode = fs.statSync(p).mode;
  if (!(mode & 0o444)) {
    throw new Error(`File is not readable: ${p}`);
  }
}

/** Resolve the global storage dir, creating it if needed. */
export function ensureDirSync(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
