// Checks that the code shared by retomarek/comfort-compass-card and
// retomarek/mollier-hx-card is still identical in both repositories.
//
//   npm run check-shared                       compare with the sister's main branch on GitHub
//   npm run check-shared -- --local ../<repo>  compare with a local clone
//
// Exits with 1 and prints a short diff when a file differs. Shared with the
// sister repository: keep both copies identical.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Path in comfort-compass-card → path in mollier-hx-card.
const SHARED = [
    ['src/bands.js', 'src/bands.js'],
    ['src/statistics.js', 'src/statistics.js'],
    ['src/localize/localize.js', 'src/localize/localize.js'],
    ['src/units.js', 'src/units.js'],
    ['test/units.test.js', 'test/units.test.js'],
    ['src/vendor/mollierFunctions.js', 'src/d3_mollierhx/mollierFunctions.js'],
    ['test/statistics.test.js', 'test/statistics.test.js'],
    ['test/bands.test.js', 'test/bands.test.js'],
    ['test/localize.test.js', 'test/localize.test.js'],
    ['scripts/check-shared.mjs', 'scripts/check-shared.mjs'],
    ['.prettierrc.json', '.prettierrc.json'],
    ['eslint.config.js', 'eslint.config.js'],
    ['vitest.config.js', 'vitest.config.js'],
    ['.github/workflows/ci.yaml', '.github/workflows/ci.yaml'],
];

const self = JSON.parse(readFileSync('package.json', 'utf8')).name;
const isCompass = self === 'comfort-compass-card';
const sister = isCompass ? 'mollier-hx-card' : 'comfort-compass-card';
const pairs = SHARED.map(([c, m]) => (isCompass ? [c, m] : [m, c]));

const args = process.argv.slice(2);
const localIdx = args.indexOf('--local');
const localDir = localIdx >= 0 ? resolve(args[localIdx + 1] || `../${sister}`) : null;
const ref = process.env.SHARED_REF || 'main';

const norm = (s) => s.replace(/\r\n/g, '\n');

async function sisterFile(path) {
    if (localDir) return readFileSync(join(localDir, path), 'utf8');
    const url = `https://raw.githubusercontent.com/retomarek/${sister}/${ref}/${path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.text();
}

// First differing lines, enough to see what changed.
function shortDiff(a, b, max = 6) {
    const al = a.split('\n');
    const bl = b.split('\n');
    const out = [];
    for (let i = 0; i < Math.max(al.length, bl.length) && out.length < max; i++) {
        if (al[i] !== bl[i])
            out.push(
                `    ${i + 1}: here   ${JSON.stringify(al[i] ?? '')}`,
                `    ${i + 1}: sister ${JSON.stringify(bl[i] ?? '')}`,
            );
    }
    return out.join('\n');
}

let failed = 0;
const where = localDir ?? `github.com/retomarek/${sister}@${ref}`;
for (const [mine, theirs] of pairs) {
    try {
        const a = norm(readFileSync(mine, 'utf8'));
        const b = norm(await sisterFile(theirs));
        if (a === b) {
            console.log(`  same      ${mine}`);
        } else {
            failed++;
            console.log(`  DIFFERS   ${mine}  ↔  ${theirs}\n${shortDiff(a, b)}`);
        }
    } catch (err) {
        failed++;
        console.log(`  ERROR     ${mine}: ${err.message}`);
    }
}
console.log(failed ? `\n${failed} shared file(s) differ from ${where}.` : `\nAll shared files match ${where}.`);
process.exit(failed ? 1 : 0);
