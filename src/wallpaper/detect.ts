/**
 * Wallpaper detection across platforms.
 *
 * Linux:   D-Bus org.freedesktop.impl.portal.Settings (one-shot read) with
 *          GNOME (gsettings), KDE (plasma appletsrc), XFCE (xfconf) fallbacks.
 * macOS:   `osascript` via System Events (safe, doesn't restart the Dock).
 * Windows: registry Wallpaper value (original path), then
 *          SystemParametersInfo (transcoded copy) as fallback.
 */
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { expandHome } from '../util/fs';
import { Logger } from '../util/log';

export interface WallpaperResult {
  /** Absolute path to a usable image file. */
  filePath: string;
  /** How the wallpaper was found (shown in UI / logs). */
  via: string;
}

function exec(cmd: string, args: string[], timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout.toString());
      },
    );
  });
}

function firstExisting(paths: string[]): string | undefined {
  return paths.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

const IMAGE_EXT = /\.(png|jpe?g|webp|bmp|gif|tiff?|avif|heic)$/i;

function looksLikeImage(p: string): boolean {
  return IMAGE_EXT.test(p) || p.startsWith('file://');
}

function uriToPath(uri: string): string {
  if (uri.startsWith('file://')) {
    try {
      const withoutQuery = uri.replace(/[?#].*$/, '');
      return decodeURIComponent(withoutQuery.slice('file://'.length));
    } catch {
      return uri.slice('file://'.length);
    }
  }
  return uri;
}

// ---------------------------------------------------------------------------
// Linux — xdg-desktop-portal (works on GNOME, KDE, Sway, Hyprland, ...)
// ---------------------------------------------------------------------------

interface DbusCli {
  cmd: string;
  args: string[];
}

/**
 * Read the `wallpaper` key of `org.freedesktop.appearance` via the portal
 * Settings interface. Reply is a variant: `(<"/path/file.png">,)`.
 */
const DBUS_CLI: DbusCli[] = [
  {
    cmd: 'busctl',
    args: [
      '--user',
      'call',
      'org.freedesktop.impl.portal.desktop.gnome',
      '/org/freedesktop/portal/desktop',
      'org.freedesktop.impl.portal.Settings',
      'ReadOne',
      'ss',
      'org.freedesktop.appearance',
      'wallpaper',
    ],
  },
  {
    cmd: 'gdbus',
    args: [
      'call',
      '--session',
      '--dest',
      'org.freedesktop.impl.portal.desktop.gnome',
      '--object-path',
      '/org/freedesktop/portal/desktop',
      '--method',
      'org.freedesktop.impl.portal.Settings.ReadOne',
      'org.freedesktop.appearance',
      'wallpaper',
    ],
  },
  {
    cmd: 'dbus-send',
    args: [
      '--session',
      '--print-reply',
      '--dest=org.freedesktop.impl.portal.desktop.gnome',
      '/org/freedesktop/portal/desktop',
      'org.freedesktop.impl.portal.Settings.ReadOne',
      'string:org.freedesktop.appearance',
      'string:wallpaper',
    ],
  },
];

function parseDbusWallpaper(out: string): string | null {
  // busctl/gdbus emit double-quoted strings; dbus-send quotes them too.
  const matches = [...out.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  for (const candidate of matches) {
    const unescaped = candidate.replace(/\\(.)/g, '$1');
    if (unescaped.startsWith('file://')) return uriToPath(unescaped);
    if (IMAGE_EXT.test(unescaped)) return unescaped;
  }
  // Some backends print single-quoted paths.
  const raw = out.match(/'([^']*)'/);
  if (raw && looksLikeImage(raw[1])) return uriToPath(raw[1]);
  return null;
}

async function linuxPortalWallpaper(): Promise<string | null> {
  for (const { cmd, args } of DBUS_CLI) {
    try {
      const out = await exec(cmd, args, 4000);
      const parsed = parseDbusWallpaper(out);
      if (parsed) return parsed;
    } catch (err) {
      Logger.warn(`wallpaper: ${cmd} portal read failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Linux — GNOME / Cinnamon / MATE (gsettings)
// ---------------------------------------------------------------------------

function readGsettingsValue(schema: string, key: string): Promise<string | null> {
  return exec('gsettings', ['get', schema, key], 4000)
    .then((out) => {
      const m = out.match(/'([^']+)'/);
      return m ? m[1] : null;
    })
    .catch(() => null);
}

async function linuxGnomeWallpaper(): Promise<string | null> {
  const dark = await readGsettingsValue('org.gnome.desktop.background', 'picture-uri-dark');
  const light = await readGsettingsValue('org.gnome.desktop.background', 'picture-uri');
  const chosen = dark ?? light;
  return chosen ? uriToPath(chosen) : null;
}

// ---------------------------------------------------------------------------
// Linux — KDE Plasma (plasma-org.kde.plasma.desktop-appletsrc)
// ---------------------------------------------------------------------------

async function linuxKdeWallpaper(): Promise<string | null> {
  const cfg = path.join(expandHome('~'), '.config', 'plasma-org.kde.plasma.desktop-appletsrc');
  try {
    const content = fs.readFileSync(cfg, 'utf8');
    // Track [section] headers; the wallpaper lives under
    // [Containments][N][Wallpaper][org.kde.image][General] with Image=file://...
    let currentSection = '';
    for (const line of content.split('\n')) {
      const sectionMatch = line.match(/^\[(.+)\]\s*$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        continue;
      }
      const imageMatch = line.match(/^Image=(.*)$/);
      if (imageMatch && currentSection.includes('org.kde.image')) {
        const value = imageMatch[1].trim();
        // Skip slideshow placeholders — they aren't single files.
        if (value && !value.endsWith('/') && looksLikeImage(value)) {
          return uriToPath(value);
        }
      }
    }
  } catch (err) {
    Logger.warn(`wallpaper: KDE config read failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Linux — XFCE (xfconf-query)
// ---------------------------------------------------------------------------

async function linuxXfceWallpaper(): Promise<string | null> {
  const props = [
    '/backdrop/single-workspace-mode/last-image',
    '/backdrop/screen0/monitor0/workspace0/last-image',
    '/backdrop/screen0/monitor0/last-image',
  ];
  for (const prop of props) {
    try {
      const out = await exec('xfconf-query', ['-c', 'xfce4-desktop', '-p', prop], 4000);
      const p = out.trim();
      if (p && IMAGE_EXT.test(p)) return p;
    } catch {
      // property missing — try next
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// macOS
// ---------------------------------------------------------------------------

const MACOS_SCRIPT = 'tell application "System Events" to get picture of every desktop';

async function macosWallpaper(): Promise<string | null> {
  try {
    const out = await exec('osascript', ['-e', MACOS_SCRIPT], 6000);
    const first = out
      .split(',')
      .map((s) => s.trim())
      .find((s) => s.length > 0 && s !== 'missing value');
    return first ?? null;
  } catch (err) {
    Logger.warn(`wallpaper: osascript failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

/** SystemParametersInfoW(0x0073 = SPI_GETDESKWALLPAPER) via PowerShell + P/Invoke. */
function windowsSystemParametersWallpaper(): Promise<string | null> {
  return new Promise((resolve) => {
    const script = [
      "$code = @'",
      'using System;',
      'using System.Runtime.InteropServices;',
      'public class W {',
      '  [DllImport("user32.dll", CharSet = CharSet.Auto)]',
      '  public static extern int SystemParametersInfo(int uAction, int uParam, System.Text.StringBuilder lpString, int fuWinIni);',
      '}',
      "'@",
      'Add-Type -TypeDefinition $code',
      '$sb = New-Object System.Text.StringBuilder(260)',
      '[W]::SystemParametersInfo(0x0073, 0, $sb, 0) | Out-Null',
      '$sb.ToString()',
    ].join('\n');
    exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], 8000)
      .then((out) => {
        const p = out.trim();
        resolve(p.length > 0 ? p : null);
      })
      .catch(() => resolve(null));
  });
}

/** Registry `WallPaper` value — usually the ORIGINAL image, not the transcoded copy. */
async function windowsRegistryWallpaper(): Promise<string | null> {
  try {
    const out = await exec('reg.exe', ['query', 'HKCU\\Control Panel\\Desktop', '/v', 'WallPaper'], 4000);
    // Output shape: `    Wallpaper    REG_SZ    C:\Users\...\bg.jpg`
    const m = out.match(/WallPaper\s+REG_SZ\s+(.+)/);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

function fixWindowsPath(p: string): string {
  return p.replace(/^"|"$/g, '').replace(/\\\\/g, '\\');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getWallpaperPath(override?: string): Promise<WallpaperResult | null> {
  if (override && override.trim().length > 0) {
    const expanded = expandHome(override.trim());
    try {
      if (fs.existsSync(expanded)) return { filePath: expanded, via: 'override' };
    } catch {
      // fall through
    }
    Logger.warn(`wallpaper override not found: ${expanded}`);
  }

  switch (process.platform) {
    case 'linux': {
      const portal = await linuxPortalWallpaper();
      if (portal) return { filePath: portal, via: 'portal' };
      const gnome = await linuxGnomeWallpaper();
      if (gnome) return { filePath: gnome, via: 'gsettings' };
      const kde = await linuxKdeWallpaper();
      if (kde) return { filePath: kde, via: 'kde config' };
      const xfce = await linuxXfceWallpaper();
      if (xfce) return { filePath: xfce, via: 'xfconf' };
      return null;
    }
    case 'darwin': {
      const mac = await macosWallpaper();
      return mac ? { filePath: mac, via: 'osascript' } : null;
    }
    case 'win32': {
      const orig = await windowsRegistryWallpaper();
      if (orig) {
        const fixed = fixWindowsPath(orig);
        if (fs.existsSync(fixed)) return { filePath: fixed, via: 'registry' };
      }
      const api = await windowsSystemParametersWallpaper();
      if (api) {
        const fixed = fixWindowsPath(api);
        // The transcoded copy lives in AppData as a .tmp — still usable.
        if (fs.existsSync(fixed)) return { filePath: fixed, via: 'SystemParametersInfo' };
      }
      return null;
    }
    default:
      return null;
  }
}
