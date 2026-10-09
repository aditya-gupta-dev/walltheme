import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const build = spawnSync('bun', ['run', 'package'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (build.status !== 0) process.exit(build.status ?? 1);
const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const vsix = path.resolve(`${manifest.name}-${manifest.version}.vsix`);
const publish = spawnSync(process.execPath, ['node_modules/@vscode/vsce/vsce', 'publish', '--packagePath', vsix], { stdio: 'inherit' });
if (publish.error) console.error(publish.error.message);
process.exit(publish.status ?? 1);
