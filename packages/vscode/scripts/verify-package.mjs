import assert from 'node:assert/strict';
import fs from 'node:fs';
import yauzl from 'yauzl';

const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const file = process.argv[2] ?? `${manifest.name}-${manifest.version}.vsix`;
const names = new Set();
const contents = new Map();
await new Promise((resolve, reject) => {
  yauzl.open(file, { lazyEntries: true }, (error, zip) => {
    if (error) return reject(error);
    zip.on('error', reject);
    zip.on('end', resolve);
    zip.on('entry', entry => {
      names.add(entry.fileName);
      if (!/^extension\/(package\.json|assets\/icon\.png|dist\/themes\/[^/]+\.json)$/.test(entry.fileName)) {
        zip.readEntry();
        return;
      }
      zip.openReadStream(entry, (error, stream) => {
        if (error) return reject(error);
        const chunks = [];
        stream.on('error', reject);
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => { contents.set(entry.fileName, Buffer.concat(chunks)); zip.readEntry(); });
      });
    });
    zip.readEntry();
  });
});
for (const name of ['package.json', 'readme.md', 'changelog.md', 'support.md', 'LICENSE.txt', 'assets/icon.png', 'dist/extension.js']) {
  assert([...names].some(n => n.toLowerCase() === `extension/${name}`.toLowerCase()), `Missing ${name}`);
}
for (const name of names) {
  assert(!/\.(vsix|map)$|extension\/(src|test|scripts|\.git|\.github|\.agents|\.codex)\/|state\.json|generated-themes\.json/.test(name), `Unexpected release file: ${name}`);
}
const packaged = JSON.parse(contents.get('extension/package.json'));
assert.equal(packaged.publisher, manifest.publisher);
assert.equal(packaged.version, manifest.version);
assert.equal(packaged.repository.url, 'https://github.com/aditya-gupta-dev/walltheme.git');
assert.equal(packaged.icon, 'assets/icon.png');
assert.equal(packaged.license, 'MIT');
const icon = contents.get('extension/assets/icon.png');
assert(icon.equals(fs.readFileSync(manifest.icon)), 'Packaged icon differs from approved image');
assert.equal(icon.readUInt32BE(0), 0x89504e47);
assert(icon.readUInt32BE(16) >= 128 && icon.readUInt32BE(20) >= 128, 'Marketplace icon must be at least 128px');
for (const theme of packaged.contributes.themes) {
  assert.equal(theme.id ?? theme.label, theme.label, 'Theme settings must resolve by name');
  const themePath = `extension/${theme.path.replace(/^\.\//, '')}`;
  const generated = JSON.parse(contents.get(themePath));
  assert.equal(generated.name, theme.label, 'Release must contain clean default themes');
  assert(Object.keys(generated.colors).length > 100);
  assert(generated.tokenColors.length > 15);
  assert(generated.semanticHighlighting);
  assert.equal(Object.hasOwn(generated, 'source'), false);
}
assert(![...names].some(name => name.startsWith('extension/node_modules/')), 'Dependencies must be bundled; node_modules must not ship');
assert(!Object.hasOwn(packaged, 'optionalDependencies'), 'Native decoder dependencies must not ship');
console.log(`Validated ${file}: icon, metadata, default themes, docs, and no node_modules or personal files.`);
