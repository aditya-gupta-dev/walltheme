import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const prod = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode', 'sharp'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !prod,
  minify: prod,
  logLevel: 'info',
  // @material/material-color-utilities is ESM-only; bundling to CJS handles it.
  mainFields: ['module', 'main'],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[esbuild] watching for changes…');
} else {
  await esbuild.build(options);
}
