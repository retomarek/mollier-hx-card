// Renders the brand images from HTML templates:
// - docs/social-preview.png (1280×640) from scripts/social-preview.html, with the
//   logo and docs/screenshot.png. Upload it manually under the repository's
//   Settings → General → Social preview (no API for it).
// - docs/banner.png (1280×320) from scripts/banner.html, the README header.
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
    for (const [tpl, out, height] of [['social-preview.html', 'social-preview.png', 640], ['banner.html', 'banner.png', 320]]) {
        const tab = await browser.newPage();
        await tab.setViewport({ width: 1280, height, deviceScaleFactor: 1 });
        await tab.goto(pathToFileURL(resolve(root, 'scripts', tpl)).href, { waitUntil: 'networkidle0' });
        await tab.evaluate(() => document.fonts.ready);
        await tab.screenshot({ path: resolve(root, 'docs', out) });
        console.log(`docs/${out}`);
        await tab.close();
    }
} finally {
    await browser.close();
}
