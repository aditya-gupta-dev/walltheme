# WallTheme for Zed

A minimal Rust/WebAssembly extension. It prints exactly `Hi` when Zed loads it.
Theme generation and application will be added later; the shared palette engine
lives in `../core`.

Zed's extension API currently has no general popup/message notification API, and
[extension slash commands have been removed](https://github.com/zed-industries/zed/blob/main/docs/src/extensions/slash-commands.md).
This greeting uses extension stdout, visible in the terminal that launches Zed
with `--foreground`. It does not show a toast or add a command to the command palette.

## Build without opening Zed

Install Rust with [rustup](https://rustup.rs/), then run from the repository root:

```sh
rustup target add wasm32-wasip2
cargo build --manifest-path packages/zed/Cargo.toml --target wasm32-wasip2 --release --locked
```

Output: `packages/zed/target/wasm32-wasip2/release/walltheme_zed.wasm`.

## Try it manually

1. Quit any existing Zed windows so its running process does not capture the launch.
2. From a terminal in this repository, run `zed --foreground .` yourself.
3. Open Zed's command palette and run **zed: install dev extension**.
4. Select this `packages/zed` directory, containing `extension.toml` and `Cargo.toml`.
5. After compilation and loading finish, find the line `Hi` in the launching terminal.

Zed builds and installs the source directory itself; there is no VSIX for this package.
The greeting runs once per extension initialization, so loading it again prints it again.
Development commands in this repository compile the extension without opening Zed.

See Zed's official [extension development and debugging documentation](https://zed.dev/docs/extensions/developing-extensions)
for dev installation and stdout behavior.
