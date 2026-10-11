# WallTheme

<img src="packages/vscode/assets/icon.png" width="128" height="128" alt="WallTheme cat holding a paintbrush">

Generate Material You themes from images. WallTheme separates the shared color engine from editor-specific integrations:

- **VS Code:** image selection, palette generation, UI and code themes, export, and saved theme history. See the [VS Code guide](packages/vscode/README.md).
- **Zed:** an initial extension that prints `Hi` to its launching terminal when it loads. Theme generation for Zed is not implemented yet. See the [Zed guide](packages/zed/README.md).

## Repository structure

```text
packages/
  core/             Shared TypeScript image, palette, and syntax-role engine
  vscode/           VS Code extension, UI, theme mapping, assets, and build scripts
  zed/              Rust/Wasm Zed extension

tests/
  core/             Shared engine tests
  vscode/           VS Code theme mapping and extension-host tests

.vscode/            VS Code development launch and build tasks
.github/workflows/  Continuous integration
```

`packages/core` handles image decoding, Material color extraction, scheme generation, and readable syntax colors. It has no VS Code API dependency. Editor packages own their theme formats, commands, settings, and file locations.

The VS Code package bundles the shared TypeScript engine. Zed extensions run as Rust/Wasm; the greeting extension does not load TypeScript. Future Zed theme generation can consume output from the shared engine through a separate generation tool, keeping editor-specific field mappings in the Zed integration.

## Development

Install Node.js 22+ and Bun 1.4+, then run commands from the repository root:

```bash
bun install
bun run typecheck
bun run test
bun run compile
bun run watch
```

Root commands coordinate the private Bun workspace. `compile` and `watch` build the VS Code extension into `packages/vscode/dist/`; `typecheck` and `test` cover the TypeScript engine and VS Code integration. `bun run check` runs both checks. Rust development commands are documented separately in the [Zed guide](packages/zed/README.md).

For VS Code, open this repository and press **F5**. The development host loads `packages/vscode` as the extension. Run **WallTheme: Generate Theme from Image…** there to test.

For Zed, follow the manual installation steps below. Build commands do not launch either editor.

## VS Code package

```bash
bun run package
code --install-extension packages/vscode/walltheme-0.1.0.vsix
```

The VSIX contains the compiled extension and shared engine, with no native image decoders or `node_modules` directory. Supported image formats are PNG, JPEG, GIF, BMP, and TIFF. WebP and AVIF are unsupported.

Generated active themes live in `<WallTheme extension directory>/dist/themes/`. During F5 development, that is `packages/vscode/dist/themes/`. Backups and hex-color history remain in the VS Code global storage directory under `aditya-gupta-dev.walltheme/walltheme-generated/`. Run **WallTheme: Open Generated Theme Files…** to find exact paths.

See [PUBLISHING.md](PUBLISHING.md) for Marketplace release steps. The publisher remains `aditya-gupta-dev` and the extension ID remains `aditya-gupta-dev.walltheme`.

## Zed extension

The initial Zed package prints `Hi` in the terminal running Zed with `--foreground` when it loads. Zed's public extension API does not provide general-purpose notification popups, so the greeting uses extension stdout.

With Rust installed through rustup:

```bash
rustup target add wasm32-wasip2
bun run compile:zed
```

Quit existing Zed windows, then run `zed --foreground .` yourself from the repository root:

1. Open the command palette and run **zed: install dev extension**.
2. Select this repository's `packages/zed` directory.
3. Find `Hi` in the launching terminal after the extension loads.

See the [Zed guide](packages/zed/README.md) for prerequisites and development details.

## License

MIT. Shared license and release notes live at the repository root.
