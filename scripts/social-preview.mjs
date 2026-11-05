// Renders docs/social-preview.png (1280×640) from scripts/social-preview.html,
// which shows the logo and docs/screenshot.png. Upload the PNG manually under
// the repository's Settings → General → Social preview (no API for it).
//
//   npm run screenshots && npm run social-preview

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function findChrome() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
        try {
            const p = execSync(`command -v ${name}`, { encoding: 'utf8' }).trim();
            if (p && existsSync(p)) return p;
        } catch { /* not found */ }
    }
    throw new Error('No Chrome/Chromium found. Set CHROME_PATH.');
}

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox', '--hide-scrollbars'] });
try {
    const tab = await browser.newPage();
    await tab.setViewport({ width: 1280, height: 640, deviceScaleFactor: 1 });
    await tab.goto(pathToFileURL(resolve(root, 'scripts/social-preview.html')).href, { waitUntil: 'networkidle0' });
    await tab.evaluate(() => document.fonts.ready);
    await tab.screenshot({ path: resolve(root, 'docs/social-preview.png') });
    console.log('docs/social-preview.png');
} finally {
    await browser.close();
}
