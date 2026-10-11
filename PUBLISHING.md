# Publishing the WallTheme VS Code extension

This repository contains separate editor packages. These instructions publish `packages/vscode`; the Zed package is an initial greeting extension with its own [development instructions](packages/zed/README.md).

## Publisher account

1. Sign in with a Microsoft account at https://marketplace.visualstudio.com/manage/publishers/.
2. Create a publisher. Its ID is the account identifier that owns your extension, separate from your GitHub username.
3. The configured publisher ID is `aditya-gupta-dev`; `packages/vscode/package.json` uses this ID. The extension ID is `aditya-gupta-dev.walltheme`, which also determines its user storage location. The root `package.json` is a private workspace manifest and is not published.

You do not need a paid Azure subscription, verified domain, or a token for manual VSIX uploads.

## Build a release

Install Node.js 22+ and Bun 1.4+ for development and packaging. Run these commands from the repository root:

```bash
bun install --frozen-lockfile
bun run package
```

Packaging runs type checking and pipeline tests, creates clean default theme files, builds a production bundle, packages `packages/vscode/walltheme-0.1.0.vsix`, and checks its contents. One platform-independent VSIX works on Windows, macOS, and Linux without native decoder dependencies. Rust and the Zed extension are not required for a VS Code release.

The package includes the supplied PNG icon, the VS Code README, MIT license, changelog, support guide, bundled extension, and default themes. The shared TypeScript engine is bundled into the extension. Build preparation copies the root `LICENSE`, `CHANGELOG.md`, and `SUPPORT.md` into the VS Code package. The VSIX excludes the Zed package, tests, source maps, build tools, development files, node_modules, native binaries, and personal generated themes/history.

The GitHub build workflow checks the pipeline on Linux, Windows, and macOS and uploads a validated VSIX artifact. Builds do not publish automatically.

## Test the VSIX

```bash
code --install-extension packages/vscode/walltheme-0.1.0.vsix --force
```

Generate from PNG/JPEG, check light/dark modes, reload when prompted, open generated files, export JSON, and switch away with Ctrl+K Ctrl+T. Supported image formats are PNG/JPEG/GIF/BMP/TIFF, with no additional runtime needed. WebP/AVIF are unsupported. Confirm UI and code colors load after reload and existing custom settings remain unchanged.

## Upload to Marketplace

On your publisher management page, choose **New extension → Visual Studio Code**, upload the VSIX, and follow validation prompts. For later releases, increase the version in `packages/vscode/package.json`, update the root `CHANGELOG.md`, rebuild, and upload the new VSIX to the existing extension.

CLI publishing is optional. Build with `bun run package` first, then authenticate with `bunx vsce login aditya-gupta-dev` and run `bun run publish`. Do not put tokens in the repository or share them in chat. Microsoft recommends Entra ID authentication for automated publishing; global Azure DevOps PATs retire on December 1, 2026.

Official publishing guide: https://code.visualstudio.com/api/working-with-extensions/publishing-extension.
