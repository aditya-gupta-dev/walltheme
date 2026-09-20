# WallTheme — Material You for VS Code

Generate a complete VS Code color theme from your **desktop wallpaper** or **any image**, the same way [matugen](https://github.com/InioX/matugen) does it:

```
image → Celebi quantization → HCT seed scoring → Material tonal palettes → full VS Code theme
```

Powered by Google's official [`@material/material-color-utilities`](https://github.com/material-foundation/material-color-utilities) — the exact library matugen ports its algorithms from.

## Features

- **Wallpaper Theme** — detects your current desktop wallpaper (Linux via xdg-portal/gsettings/KDE/XFCE, macOS, Windows) and themes the editor from it
- **Reload Theme** — pick any image and generate a theme from it
- **Instant apply** — colors land via `workbench.colorCustomizations`, so the whole UI re-skins with **no reload or restart**
- **Full M3 schemes** — tonalSpot, vibrant, expressive, content, fidelity, rainbow, fruitSalad, neutral, monochrome, contrast (same set matugen exposes)
- **Auto reload** — watches your wallpaper and regenerates when it changes
- **Dark/light aware** — follows VS Code's theme kind, or force either
- **Export** — write a standalone `*.json` theme you can share or package
- **Reset** — one command restores your previous settings

## Usage

1. Open the folder in VS Code and press **F5** (Run Extension). An *Extension Development Host* window opens with WallTheme loaded.
2. Press `Ctrl+Shift+P` / `Cmd+Shift+P` and type `WallTheme`:

| Command | What it does |
| --- | --- |
| **WallTheme: Wallpaper Theme** | Read the desktop wallpaper → extract colors → apply |
| **WallTheme: Reload Theme…** | Open an image picker → extract colors → apply |
| **WallTheme: Choose Source Color…** | Seed the palette from a hex color |
| **WallTheme: Preview Palette** | Ranked extracted colors; click to copy or re-seed |
| **WallTheme: Export Theme as JSON…** | Save a shareable standalone theme file |
| **WallTheme: Reset Theme** | Remove all WallTheme customizations |

There's also a `$(paintcan) WallTheme` status bar item — click it to regenerate from the wallpaper.

### Installing permanently (VSIX)

```bash
bun install
bun run package          # produces walltheme-0.1.0.vsix
code --install-extension walltheme-0.1.0.vsix
```

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `walltheme.style` | `tonalSpot` | M3 scheme variant |
| `walltheme.isDark` | `null` | Force dark/light, or follow VS Code |
| `walltheme.contrastLevel` | `0` | −1 … 1 contrast adjustment |
| `walltheme.intensity` | `1` | Chroma scaling for accents (0.1–1.5) |
| `walltheme.syntaxStyle` | `material` | Token mapping: `material`, `rainbow`, `monochrome`, `vibrant` |
| `walltheme.autoReload` | `true` | Regenerate when the wallpaper changes |
| `walltheme.watchIntervalMs` | `5000` | Wallpaper poll interval |
| `walltheme.wallpaperPathOverride` | `""` | Hard override for unsupported desktops |

## How the theming works

The extension writes generated colors into `workbench.colorCustomizations` and `editor.tokenColorCustomizations` (global scope). This applies instantly and overrides the currently selected theme; your original theme is untouched and **Reset Theme** removes the overrides. The last theme is persisted and re-applied on startup.

## Development

```bash
bun install        # deps
bun run typecheck  # tsc --noEmit
bun test           # pipeline tests (bun:test)
bun run compile    # esbuild → dist/extension.js
bun run watch      # incremental rebuild
bun run gen:icon   # regenerate assets/icon.png
```

## Notes

- Wallpaper detection prefers the xdg-desktop-portal, so it works on GNOME, KDE Plasma, XFCE, Sway, Hyprland, etc. If your desktop isn't detected, set `walltheme.wallpaperPathOverride`.
- WebP/AVIF decoding requires the optional `sharp` dependency (installed by default; PNG/JPEG/GIF/BMP/TIFF work without it).

## License

MIT
