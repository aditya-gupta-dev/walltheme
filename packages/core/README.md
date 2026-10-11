# WallTheme shared engine

Private TypeScript workspace package, imported as `@walltheme/core`. It contains image decoding, pixel sampling, Material palette extraction, scheme generation, intensity adjustment, and readable syntax colors keyed by editor-neutral kinds.

```ts
import { argbFromHex, buildScheme, schemeToHexMap, applyIntensity, generateSyntaxColors } from '@walltheme/core';

const colors = applyIntensity(schemeToHexMap(buildScheme({
  sourceColorArgb: argbFromHex('1A5E63'),
  isDark: true,
  contrastLevel: 0,
  variant: 'tonalSpot',
})), 1);
const syntax = generateSyntaxColors(colors, 'material');
```

Editors map `colors` and `syntax` to their own schemas. The engine has no VS Code API or theme schema dependency. It uses Node-compatible JavaScript image decoders and Buffer. Rust/Wasm consumers will need a generation tool or JSON bridge rather than importing this TypeScript package directly.

Run `bun run check` from the repository root. Supported images: PNG/JPEG/GIF/BMP/TIFF.
