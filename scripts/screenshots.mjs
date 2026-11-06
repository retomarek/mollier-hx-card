// Renders the built card (dist/mollier-hx-card.js) with deterministic sample
// data in headless Chrome and writes the README images to docs/.
//
//   npm run build && npm run screenshots
//
// Chrome is taken from $CHROME_PATH, else the first browser found on PATH.
// Runs locally and in .github/workflows/screenshots.yaml.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(resolve(root, 'dist/mollier-hx-card.js'), 'utf8');
const outDir = resolve(root, 'docs');
mkdirSync(outDir, { recursive: true });

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

// Home Assistant's default theme colours, enough for the card chrome.
const THEMES = {
    dark: { page: '#111111', card: '#1c1c1c', text: '#e1e1e1', muted: '#9b9b9b', divider: 'rgba(225,225,225,0.12)' },
    light: { page: '#fafafa', card: '#ffffff', text: '#212121', muted: '#727272', divider: 'rgba(0,0,0,0.12)' },
};

const SHOTS = [
    { file: 'screenshot.png', theme: 'dark', lang: 'en', header: 'Living room', width: 520 },
    { file: 'screenshot-light-de.png', theme: 'light', lang: 'de', header: 'Wohnzimmer', width: 520 },
];

const CONFIG = {
    type: 'custom:mollier-hx-card',
    temperature_entity: 'sensor.living_room_temperature',
    humidity_entity: 'sensor.living_room_humidity',
    days_to_show: 120,
    coloring: 'season',
    altitude: 450,
    comfort_zone: { temperature: [20, 26], humidity: [30, 60], absolute_humidity: [0, 12] },
    warning_bands: true,
    outdoor_temperature_entity: 'sensor.outside_temperature',
    outdoor_humidity_entity: 'sensor.outside_humidity',
};

function page(shot) {
    const c = THEMES[shot.theme];
    const config = { ...CONFIG, title: shot.header };
    return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap">
<style>
  html, body { margin: 0; background: ${c.page}; }
  body { padding: 16px; font-family: Roboto, "Noto Sans", sans-serif; color: ${c.text};
    --primary-text-color: ${c.text}; --secondary-text-color: ${c.muted}; --divider-color: ${c.divider};
    --ha-card-background: ${c.card}; --card-background-color: ${c.card}; }
  #wrap { width: ${shot.width}px; }
</style></head><body><div id="wrap"><mollier-hx-card id="card"></mollier-hx-card></div>
<script>
  // Minimal stand-in for Home Assistant's <ha-card>.
  customElements.define('ha-card', class extends HTMLElement {
    static get observedAttributes() { return ['header']; }
    constructor() {
      super();
      this.attachShadow({ mode: 'open' }).innerHTML =
        '<style>:host{display:block;background:var(--ha-card-background);border-radius:12px;border:1px solid var(--divider-color);overflow:hidden;color:var(--primary-text-color)}' +
        '.h{font:400 24px/1.3 Roboto,sans-serif;padding:20px 16px 4px}</style><div class="h"></div><slot></slot>';
    }
    attributeChangedCallback() {
      const h = this.getAttribute('header'), el = this.shadowRoot.querySelector('.h');
      el.textContent = h || ''; el.hidden = !h;
    }
  });
</script>
<script>${bundle.replace(/<\/script/g, '<\\/script')}</script>
<script>
  // Deterministic sample: 120 days of room climate, July to November.
  const T = ${JSON.stringify(CONFIG.temperature_entity)}, H = ${JSON.stringify(CONFIG.humidity_entity)};
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const end = new Date('2026-11-05T12:00:00Z'), tR = [], hR = [], oT = [], oH = [];
  for (let i = 120; i >= 1; i--) {
    const d = new Date(end.getTime() - i * 86400000); d.setUTCHours(0, 0, 0, 0);
    const doy = (d - new Date(Date.UTC(2026, 0, 1))) / 86400000;
    const season = Math.cos(((doy - 200) / 365) * 2 * Math.PI);
    let t = 22.4 + 4.4 * Math.max(season, -0.2) + (rnd() - 0.5) * 2.6; if (rnd() < 0.08) t += 2.6;
    let rh = 47 + 10 * season + (rnd() - 0.5) * 16; if (season < 0.1 && rnd() < 0.3) rh -= 11;
    tR.push({ start: d.toISOString(), mean: +t.toFixed(2) });
    hR.push({ start: d.toISOString(), mean: +Math.max(18, Math.min(80, rh)).toFixed(1) });
    // outside: summer to autumn, cooler and more humid than the room
    oT.push({ start: d.toISOString(), mean: +(9 + 9 * Math.max(season, -0.4) + (rnd() - 0.5) * 6).toFixed(2) });
    oH.push({ start: d.toISOString(), mean: +Math.min(98, 78 - 8 * season + (rnd() - 0.5) * 18).toFixed(1) });
  }
  const card = document.getElementById('card');
  card.setConfig(${JSON.stringify(config)});
  card.hass = {
    language: '${shot.lang}', locale: { language: '${shot.lang}' }, config: { time_zone: 'Europe/Zurich' },
    states: { [T]: { state: '21.8' }, [H]: { state: '43' },
      'sensor.outside_temperature': { state: '6.8', attributes: { unit_of_measurement: '°C' } }, 'sensor.outside_humidity': { state: '89' } },
    callWS: async (m) => (m.statistic_ids[0] === T ? { [T]: tR, [H]: hR }
      : { 'sensor.outside_temperature': oT, 'sensor.outside_humidity': oH }),
  };
</script></body></html>`;
}

const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
try {
    for (const shot of SHOTS) {
        const tab = await browser.newPage();
        await tab.setViewport({ width: shot.width + 32, height: 800, deviceScaleFactor: 2 });
        await tab.setContent(page(shot), { waitUntil: 'networkidle0' });
        await tab.evaluate(() => document.fonts.ready);
        // Wait until the card has drawn the diagram and the daily points.
        await tab.waitForFunction(() => {
            const root = document.querySelector('mollier-hx-card')?.shadowRoot;
            return root?.querySelector('#data-points circle');
        }, { timeout: 15000 });
        const el = await tab.$('#wrap');
        await el.screenshot({ path: resolve(outDir, shot.file) });
        console.log(`docs/${shot.file}`);
        await tab.close();
    }
} finally {
    await browser.close();
}
