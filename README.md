# WallTheme — Material You for VS Code

<img src="assets/icon.png" width="128" height="128" alt="WallTheme cat holding a paintbrush">

Generate a complete VS Code color theme from **an image**, the same way [matugen](https://github.com/InioX/matugen) does it:

```
image → Celebi quantization → HCT seed scoring → Material tonal palettes → full VS Code theme
```

Powered by Google's official [`@material/material-color-utilities`](https://github.com/material-foundation/material-color-utilities) — the exact library matugen ports its algorithms from.

## Features

- **Generate Theme from Image** — pick any image, extract a Material palette, and apply the generated theme
- **Theme dropdown** — click WallTheme in the status bar to choose an image or manage your theme
- **Standalone themes** — UI and code colors live in generated theme JSON; settings only select the theme name
- **Code colors** — the same image palette colors keywords, variables, parameters, functions, types, strings, numbers, and comments through TextMate and semantic token rules; both follow `walltheme.syntaxStyle`
- **Material schemes** — tonalSpot, vibrant, expressive, content, fidelity, rainbow, fruitSalad, and contrast
- **Auto reload** — watches your chosen image and regenerates when it changes
- **Dark/light aware** — follows VS Code's theme kind, or force either
- **Export** — write a standalone `*.json` theme you can share or package
- **JSON history** — every generated theme is saved in `walltheme-generated/generated-themes.json` under the extension's global storage, including extracted hex colors, Material roles, UI colors, and syntax rules
- **Reset** — one command restores your previous theme selection

## Usage

1. Install **WallTheme** from the Extensions view or use **Install from VSIX…**.
2. Press `Ctrl+Shift+P` / `Cmd+Shift+P` and type `WallTheme`:

Choose **WallTheme: Generate Theme from Image…**, then select your image. WallTheme extracts colors and writes a complete UI and syntax theme. In an installed extension, select **Reload Window** when prompted to load updated colors. No matugen installation needed.

| Command | What it does |
| --- | --- |
| **WallTheme: Generate Theme from Image…** | Pick an image, extract its palette, and apply the theme |
| **WallTheme: Open Theme Menu…** | Open the WallTheme actions dropdown |
| **WallTheme: Reload Theme…** | Open an image picker → extract colors → apply |
| **WallTheme: Choose Source Color…** | Seed the palette from a hex color |
| **WallTheme: Preview Palette** | Ranked extracted colors; click to copy or re-seed |
| **WallTheme: Export Theme as JSON…** | Save a shareable standalone theme file |
| **WallTheme: Open Generated Theme Files…** | View active JSON files or history with exact paths |
| **WallTheme: Reset Theme** | Restore the previous theme selection |

There's also a `$(paintcan) WallTheme` status bar item — click it to open the actions dropdown, then select **Generate Theme from Image…**.

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
| `walltheme.autoReload` | `true` | Regenerate when the chosen image changes |
| `walltheme.watchIntervalMs` | `5000` | Chosen-image poll interval |

## How the theming works

The extension writes a complete theme JSON containing UI colors, TextMate syntax rules, and semantic token colors. It registers the files as **WallTheme Dark** and **WallTheme Light**; the only theme application setting it changes is:

```json
{ "workbench.colorTheme": "WallTheme Dark" }
```

Choosing another theme with **Ctrl+K Ctrl+T** works normally and stops image watching. **Reset Theme** restores your previous selection. Existing user color customizations remain untouched and retain their normal VS Code precedence. On upgrade from older WallTheme versions, the previous generated settings overrides are removed once using saved originals.

VS Code watches theme files live in an Extension Development Host. Installed extensions show **Reload Window** after changing a theme file so cached colors are reliably refreshed. No automatic window reload occurs.

### Generated file locations

- **Active files:** `<WallTheme extension directory>/dist/themes/walltheme-dark.json` and `walltheme-light.json`. When running F5 from this project, these are under the project's `dist/themes/`. A normal installation puts them under `~/.vscode/extensions/walltheme.walltheme-<version>/dist/themes/`.
- **Backups and history:** `<VS Code global storage>/walltheme.walltheme/walltheme-generated/`, containing the latest `walltheme-dark.json` / `walltheme-light.json` and `generated-themes.json` history. On standard Linux VS Code, this is `~/.config/Code/User/globalStorage/walltheme.walltheme/walltheme-generated/`. Custom profiles and other operating systems use their respective VS Code storage locations.
- **State:** `state.json` next to the backup directory records the palette, source image, and previous theme selection.

Run **WallTheme: Open Generated Theme Files…** to view the exact active file or history path for your installation. Backups/history survive theme switching and Reset Theme. Extension updates may replace active files; saved state restores an active generated theme from its palette on startup. Previously overwritten themes from before history was introduced cannot be recovered.

## Development

```bash
bun install        # deps; development tooling requires Node.js 22+
bun run typecheck  # tsc --noEmit
bun test           # pipeline tests (bun:test)
bun run compile    # esbuild → dist/extension.js
bun run watch      # incremental rebuild
```

## Notes

- Supported formats: **PNG, JPEG, GIF, BMP, and TIFF**. WebP/AVIF are not supported; convert them to PNG/JPEG first. No standalone Node.js or native decoder installation is needed.
- This extension runs in desktop VS Code, including local UI windows connected to remote workspaces. Browser-only VS Code is not supported.
- Images and palettes stay local. WallTheme makes no network requests and collects no telemetry.
- Image decoding and resizing use bundled JavaScript. The VSIX contains no native decoder binaries or `node_modules` directory.

### Debugging

Press **F5**, then run **WallTheme: Generate Theme from Image…** in the **Extension Development Host** window. The generated theme applies to that window. The development launch disables other installed extensions to keep their background work out of the debug session.

If generation fails, select **Show Logs** in the error notification or open **View → Output → WallTheme** for the failure details.

## Publishing

See [PUBLISHING.md](PUBLISHING.md) for publisher setup, release checks, packaging, and uploading to Marketplace.

## License

MIT
