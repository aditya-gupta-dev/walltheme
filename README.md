# WallTheme — Material You for VS Code

Generate a complete VS Code color theme from **any image**, the same way [matugen](https://github.com/InioX/matugen) does it:

```
image → Celebi quantization → HCT seed scoring → Material tonal palettes → full VS Code theme
```

Powered by Google's official [`@material/material-color-utilities`](https://github.com/material-foundation/material-color-utilities) — the exact library matugen ports its algorithms from.

## Features

- **Generate Theme from Image** — pick any image, extract a Material palette, and apply the generated theme
- **Theme dropdown** — click WallTheme in the status bar to choose an image or manage your theme
- **Instant apply** — colors land via `workbench.colorCustomizations`, so the whole UI re-skins with **no reload or restart**
- **Code colors** — the same image palette colors keywords, variables, parameters, functions, types, strings, numbers, and comments through TextMate and semantic token rules; both follow `walltheme.syntaxStyle`
- **Full M3 schemes** — tonalSpot, vibrant, expressive, content, fidelity, rainbow, fruitSalad, neutral, monochrome, contrast (same set matugen exposes)
- **Auto reload** — watches your chosen image and regenerates when it changes
- **Dark/light aware** — follows VS Code's theme kind, or force either
- **Export** — write a standalone `*.json` theme you can share or package
- **JSON history** — every generated theme is saved in `walltheme-generated/generated-themes.json` under the extension's global storage, including extracted hex colors, Material roles, UI colors, and syntax rules
- **Reset** — one command restores your previous settings

## Usage

1. Open the folder in VS Code and press **F5** (Run Extension). An *Extension Development Host* window opens with WallTheme loaded.
2. Press `Ctrl+Shift+P` / `Cmd+Shift+P` and type `WallTheme`:

Choose **WallTheme: Generate Theme from Image…**, then select your image. WallTheme extracts colors and applies the generated UI and syntax colors immediately. No matugen installation needed.

| Command | What it does |
| --- | --- |
| **WallTheme: Generate Theme from Image…** | Pick an image, extract its palette, and apply the theme |
| **WallTheme: Open Theme Menu…** | Open the WallTheme actions dropdown |
| **WallTheme: Reload Theme…** | Open an image picker → extract colors → apply |
| **WallTheme: Choose Source Color…** | Seed the palette from a hex color |
| **WallTheme: Preview Palette** | Ranked extracted colors; click to copy or re-seed |
| **WallTheme: Export Theme as JSON…** | Save a shareable standalone theme file |
| **WallTheme: Reset Theme** | Remove all WallTheme customizations |

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

The extension selects **WallTheme Dark** or **WallTheme Light** and writes generated colors into `workbench.colorCustomizations` and `editor.tokenColorCustomizations` (global scope). This applies instantly. Choosing another theme with **Ctrl+K Ctrl+T** clears WallTheme overrides, restores your previous custom colors and syntax settings, and stops image auto-reload. **Reset Theme** also restores the theme selected before generation. Generated theme history remains available.

The last generated theme is restored on startup only while its WallTheme entry remains selected.

Generation also appends the complete theme to `generated-themes.json`. Previous entries survive new generations and Reset Theme. The latest saved theme is included when history is first created; themes overwritten before this feature cannot be recovered.

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

- WebP/AVIF decoding requires the optional `sharp` dependency (installed by default) and standalone Node.js on PATH. PNG/JPEG/GIF/BMP/TIFF work without either.
- PNG/JPEG resizing uses JavaScript. Optional native decoders run in a separate process, so decoder failures cannot close the extension host.

### Debugging

Press **F5**, then run **WallTheme: Generate Theme from Image…** in the **Extension Development Host** window. The generated theme applies to that window. The development launch disables other installed extensions to keep their background work out of the debug session.

If generation fails, select **Show Logs** in the error notification or open **View → Output → WallTheme** for the failure details.

## License

MIT
