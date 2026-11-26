// Builds the live demo of both cards into _site/ and serves it.
//
//   npm run demo                         build this card and ../comfort-compass-card, serve on :8123
//   npm run demo -- --port 9000
//   node scripts/demo.mjs --no-build --no-serve --compass-dir <dir>   (CI: only assemble _site/)
//
// The Comfort Compass Card is taken from <compass-dir>/dist/comfort-compass-card.js
// (built there first, unless --no-build).

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
};
const build = !args.includes('--no-build');
const serve = !args.includes('--no-serve');
const compassDir = resolve(root, opt('--compass-dir', '../comfort-compass-card'));
const port = Number(opt('--port', process.env.PORT || 8123));
const site = join(root, '_site');

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });

if (build) {
    run('npm run build', root);
    if (!existsSync(join(compassDir, 'node_modules'))) run('npm ci', compassDir);
    run('npm run build', compassDir);
}
const compassBundle = join(compassDir, 'dist/comfort-compass-card.js');
const mollierBundle = join(root, 'dist/mollier-hx-card.js');
for (const f of [compassBundle, mollierBundle]) {
    if (!existsSync(f)) throw new Error(`Missing ${f}. Run without --no-build, or build it first.`);
}

rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });
cpSync(join(root, 'demo'), site, { recursive: true });
cpSync(mollierBundle, join(site, 'mollier-hx-card.js'));
cpSync(compassBundle, join(site, 'comfort-compass-card.js'));
console.log(`Demo assembled in ${site}`);

if (serve) {
    const TYPES = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
    };
    createServer((req, res) => {
        const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        let file = normalize(join(site, path));
        if (file.startsWith(site) && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
        if (!file.startsWith(site) || !existsSync(file)) {
            res.writeHead(404).end('Not found');
            return;
        }
        res.writeHead(200, {
            'content-type': TYPES[extname(file)] || 'application/octet-stream',
            'cache-control': 'no-store',
        });
        res.end(readFileSync(file));
    }).listen(port, () => console.log(`Live demo: http://localhost:${port}/  (Ctrl+C to stop)`));
}
