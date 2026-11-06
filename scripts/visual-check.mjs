// Visual check: renders the built card in many dashboard situations and
// states (theme, language, width, fixed tile, missing sensor, failed fetch)
// and writes one PNG per case to tmp/visual/ (git-ignored).
//
//   npm run build && npm run visual-check            # all cases
//   npm run visual-check -- dark-en narrow-390       # only these cases
//
// Used by the visual-check skill (.claude/skills/visual-check). Chrome from
// $CHROME_PATH or PATH, like scripts/screenshots.mjs.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

// --- card-specific part -----------------------------------------------------
const TAG = 'mollier-hx-card';
const BUNDLE = 'dist/mollier-hx-card.js';
const BASE_CONFIG = {
    type: `custom:${TAG}`,
    temperature_entity: 'sensor.t',
    humidity_entity: 'sensor.h',
    title: 'Living room',
    days_to_show: 120,
    altitude: 450,
    comfort_zone: { temperature: [20, 26], humidity: [30, 65], absolute_humidity: [0, 12] },
    warning_bands: true,
};
// Selector inside the card's shadow root that exists once it has drawn.
const READY = '#hx_mollier_diagram';
// ---------------------------------------------------------------------------

// Outside air with sensors, daily means and the ventilation line.
const OUTDOOR = { outdoor_temperature_entity: 'sensor.ot', outdoor_humidity_entity: 'sensor.oh', outdoor_history: true };

// width: tile width; rows: sections row count (fixed height = rows*64-8 px);
// layout: what HA sets ('grid' in sections, 'panel', or null for masonry);
// data: 'ok' | 'empty' (no statistics) | 'error' (fetch fails); states: live sensor
// states (null = entity does not exist).
const CASES = [
    { name: 'dark-en', theme: 'dark', lang: 'en', width: 500, layout: 'grid' },
    { name: 'light-de', theme: 'light', lang: 'de', width: 500, layout: 'grid' },
    { name: 'narrow-390-masonry', theme: 'dark', lang: 'en', width: 390, layout: null },
    { name: 'full-width-1400', theme: 'dark', lang: 'en', width: 1400, layout: 'grid' },
    { name: 'fixed-7rows-500', theme: 'dark', lang: 'en', width: 500, layout: 'grid', rows: 7 },
    { name: 'fixed-7rows-1400', theme: 'light', lang: 'en', width: 1400, layout: 'grid', rows: 7 },
    { name: 'panel-1200x700', theme: 'dark', lang: 'en', width: 1200, height: 700, layout: 'panel' },
    { name: 'all-lines', theme: 'light', lang: 'en', width: 500, layout: 'grid', config: { lines: { density: true, enthalpy: true } } },
    { name: 'no-statistics', theme: 'dark', lang: 'en', width: 500, layout: 'grid', data: 'empty' },
    { name: 'fetch-error-de', theme: 'dark', lang: 'de', width: 500, layout: 'grid', data: 'error' },
    { name: 'sensor-unavailable', theme: 'dark', lang: 'en', width: 500, layout: 'grid', states: { 'sensor.t': 'unavailable' } },
    { name: 'outdoor-de', theme: 'light', lang: 'de', width: 500, layout: 'grid', config: OUTDOOR },
    { name: 'outdoor-off-axis', theme: 'dark', lang: 'en', width: 500, layout: 'grid', config: { ...OUTDOOR, temperature_range: [15, 30], x_range: [0, 15] } },
    { name: 'entity-missing', theme: 'dark', lang: 'en', width: 500, layout: 'grid', states: { 'sensor.t': null } },
    { name: 'room-off-axis', theme: 'light', lang: 'en', width: 500, layout: 'grid', states: { 'sensor.h': '75' }, config: { x_range: [0, 10], temperature_range: [15, 30] } },
    { name: 'fahrenheit-hint', theme: 'light', lang: 'de', width: 500, layout: 'grid', config: { comfort_zone: { temperature: [68, 79], humidity: [30, 65] } } },
    { name: 'outdoor-weather-only', theme: 'dark', lang: 'en', width: 390, layout: null, config: { outdoor_weather_entity: 'weather.home' } },
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(resolve(root, BUNDLE), 'utf8').replace(/<\/script/g, '<\\/script');
const outDir = resolve(root, 'tmp/visual');

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

const THEMES = {
    dark: { page: '#111111', card: '#1c1c1c', text: '#e1e1e1', muted: '#9b9b9b', divider: 'rgba(225,225,225,0.12)' },
    light: { page: '#fafafa', card: '#ffffff', text: '#212121', muted: '#727272', divider: 'rgba(0,0,0,0.12)' },
};

function html(c) {
    const th = THEMES[c.theme];
    const height = c.rows ? c.rows * 64 - 8 : c.height;
    const config = { ...BASE_CONFIG, ...(c.config || {}), ...(c.rows ? { grid_options: { rows: c.rows } } : {}) };
    const states = { 'sensor.t': '21.8', 'sensor.h': '43', 'sensor.ot': '6.8', 'sensor.oh': '89', ...(c.states || {}) };
    return `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 12px; background: ${th.page}; font-family: Roboto, "Noto Sans", sans-serif; color: ${th.text};
    --primary-text-color: ${th.text}; --secondary-text-color: ${th.muted}; --divider-color: ${th.divider};
    --ha-card-background: ${th.card}; --card-background-color: ${th.card}; --error-color: #db4437; }
  #slot { width: ${c.width}px; ${height ? `height: ${height}px;` : ''} outline: 1px dashed #d0f; }
</style></head><body><div id="slot"><${TAG} id="card"></${TAG}></div>
<script>
  customElements.define('ha-card', class extends HTMLElement {
    static get observedAttributes() { return ['header']; }
    constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML =
      '<style>:host{display:block;background:var(--ha-card-background);border-radius:12px;border:1px solid var(--divider-color);box-sizing:border-box}.h{font:400 24px Roboto,sans-serif;padding:16px 16px 0}</style><div class="h"></div><slot></slot>'; }
    set header(h) { this.setAttribute('header', h || ''); }
    attributeChangedCallback() { const h = this.getAttribute('header'), e = this.shadowRoot.querySelector('.h'); e.textContent = h || ''; e.hidden = !h; }
  });
</script>
<script>${bundle}</script>
<script>
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const end = new Date('2026-11-05T12:00:00Z'), tR = [], hR = [], oT = [], oH = [];
  for (let i = 120; i >= 1; i--) {
    const d = new Date(end.getTime() - i * 864e5); d.setUTCHours(0, 0, 0, 0);
    const s = Math.cos((((d - new Date(Date.UTC(2026, 0, 1))) / 864e5 - 200) / 365) * 2 * Math.PI);
    let t = 22.4 + 4.4 * Math.max(s, -0.2) + (rnd() - 0.5) * 2.6; if (rnd() < 0.08) t += 2.6;
    let rh = 47 + 10 * s + (rnd() - 0.5) * 16; if (s < 0.1 && rnd() < 0.3) rh -= 11;
    tR.push({ start: d.toISOString(), mean: +t.toFixed(2) }); hR.push({ start: d.toISOString(), mean: +Math.max(18, Math.min(80, rh)).toFixed(1) });
    oT.push({ start: d.toISOString(), mean: +(9 + 9 * Math.max(s, -0.4) + (rnd() - 0.5) * 6).toFixed(2) }); oH.push({ start: d.toISOString(), mean: +Math.min(98, 78 - 8 * s + (rnd() - 0.5) * 18).toFixed(1) });
  }
  const data = ${JSON.stringify(c.data || 'ok')};
  const card = document.getElementById('card');
  ${c.layout ? `card.layout = ${JSON.stringify(c.layout)};` : ''}
  card.setConfig(${JSON.stringify(config)});
  card.hass = {
    language: '${c.lang}', locale: { language: '${c.lang}' }, config: { time_zone: 'Europe/Zurich' }, themes: { darkMode: ${c.theme === 'dark'} },
    states: { ...Object.fromEntries(Object.entries(${JSON.stringify(states)}).filter(([, v]) => v !== null).map(([k, v]) => [k, { entity_id: k, state: v, attributes: {} }])),
      'weather.home': { entity_id: 'weather.home', state: 'cloudy', attributes: { temperature: 41, temperature_unit: '°F', humidity: 85 } } },
    callWS: async (msg) => {
      if (data === 'error') throw new Error('Connection lost');
      if (data === 'empty') return {};
      return msg.statistic_ids[0] === 'sensor.ot' ? { 'sensor.ot': oT, 'sensor.oh': oH } : { 'sensor.t': tR, 'sensor.h': hR };
    },
  };
</script></body></html>`;
}

const only = process.argv.slice(2);
const cases = only.length ? CASES.filter((c) => only.includes(c.name)) : CASES;
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
let failures = 0;
try {
    for (const c of cases) {
        const tab = await browser.newPage();
        const errors = [];
        tab.on('pageerror', (e) => errors.push(e.message));
        tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        await tab.setViewport({ width: c.width + 24, height: 900, deviceScaleFactor: 1 });
        await tab.setContent(html(c), { waitUntil: 'load' });
        let ready = true;
        try {
            await tab.waitForFunction((tag, sel) => document.querySelector(tag)?.shadowRoot?.querySelector(sel), { timeout: 8000 }, TAG, READY);
        } catch { ready = false; }
        await new Promise((r) => setTimeout(r, 300));
        const size = await tab.evaluate(() => { const r = document.getElementById('card').getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; });
        const file = resolve(outDir, `${c.name}.png`);
        await (await tab.$('#slot')).screenshot({ path: file });
        const problems = [...(ready ? [] : ['never became ready']), ...errors];
        if (problems.length) failures++;
        console.log(`${problems.length ? 'PROBLEM' : 'ok     '} ${c.name.padEnd(20)} card ${size.padEnd(10)} tmp/visual/${c.name}.png${problems.length ? '  ' + problems.join(' | ') : ''}`);
        await tab.close();
    }
} finally {
    await browser.close();
}
process.exitCode = failures ? 1 : 0;
