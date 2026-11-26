// End-to-end test of both cards (Mollier hx Card and Comfort Compass Card) in a
// real Home Assistant, started with Docker:
//
//   npm run e2e                          HA stable, builds both cards first
//   npm run e2e -- --ha beta             another image tag
//   npm run e2e -- --no-build --keep     reuse the builds, leave HA running
//
// Options: --ha <tag> (default stable), --port <n> (8124), --compass-dir <dir>
// (../comfort-compass-card), --no-build, --keep. Chrome from $CHROME_PATH or PATH.
// Screenshots and the HA log go to tmp/e2e/out/. Exit code 1 when a check fails.
//
// What it does: prepares a minimal HA config (e2e/ha-config) with both bundles
// in www/ and onboarding already done except the user, starts the container,
// creates the user and gets a token, imports 60 days of statistics for four
// sensors (the demo's living room, demo/presets.js), registers the bundles as
// dashboard resources, saves a dashboard with sections (auto and fixed rows),
// masonry and panel views, then opens every view in Chrome and checks the cards.

import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { dailyMeans, entities, PRESETS } from '../demo/presets.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
};
const TAG = opt('--ha', process.env.HA_TAG || 'stable');
const PORT = Number(opt('--port', 8124));
const COMPASS_DIR = resolve(root, opt('--compass-dir', '../comfort-compass-card'));
const BUILD = !args.includes('--no-build');
const KEEP = args.includes('--keep');
const HA = `http://127.0.0.1:${PORT}`;
const CONTAINER = `mollier-e2e-${PORT}`;
const WORK = join(root, 'tmp/e2e');
const CONFIG = join(WORK, 'ha-config');
const OUT = join(WORK, 'out');
const DAYS = 60;
const DASHBOARD = 'e2e-test';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[e2e]', ...a);
const failures = [];
const check = (ok, what) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
    if (!ok) failures.push(what);
};

// --- 1. builds and config ----------------------------------------------------------

function prepare() {
    if (BUILD) {
        log('building both cards');
        execSync('npm run -s build', { cwd: root, stdio: 'inherit' });
        execSync('npm run -s build', { cwd: COMPASS_DIR, stdio: 'inherit' });
    }
    if (existsSync(CONFIG)) {
        // Files written by HA in the container may belong to root on Linux.
        try {
            rmSync(CONFIG, { recursive: true, force: true });
        } catch {
            execSync(`docker run --rm -v "${WORK}:/w" alpine rm -rf /w/ha-config`);
        }
    }
    mkdirSync(join(CONFIG, 'www'), { recursive: true });
    mkdirSync(join(CONFIG, '.storage'), { recursive: true });
    mkdirSync(OUT, { recursive: true });
    cpSync(join(root, 'e2e/ha-config/configuration.yaml'), join(CONFIG, 'configuration.yaml'));
    cpSync(join(root, 'dist/mollier-hx-card.js'), join(CONFIG, 'www/mollier-hx-card.js'));
    cpSync(join(COMPASS_DIR, 'dist/comfort-compass-card.js'), join(CONFIG, 'www/comfort-compass-card.js'));
    // Onboarding done except the user, which the test creates (and so gets a token).
    writeFileSync(
        join(CONFIG, '.storage/onboarding'),
        JSON.stringify({
            version: 4,
            minor_version: 1,
            key: 'onboarding',
            data: { done: ['core_config', 'analytics', 'integration'] },
        }),
    );
}

// --- 2. Home Assistant in Docker ---------------------------------------------------------

function docker(...a) {
    return execFileSync('docker', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function startHa() {
    try {
        docker('rm', '-f', CONTAINER);
    } catch {
        /* not running */
    }
    log(`starting ghcr.io/home-assistant/home-assistant:${TAG} on ${HA}`);
    docker(
        'run',
        '-d',
        '--name',
        CONTAINER,
        '-p',
        `127.0.0.1:${PORT}:8123`,
        '-e',
        'TZ=Europe/Zurich',
        '-v',
        `${CONFIG}:/config`,
        `ghcr.io/home-assistant/home-assistant:${TAG}`,
    );
}

async function waitFor(what, fn, timeoutMs = 180e3, everyMs = 1000) {
    const until = Date.now() + timeoutMs;
    let last;
    while (Date.now() < until) {
        try {
            const v = await fn();
            if (v) return v;
        } catch (e) {
            last = e;
        }
        await sleep(everyMs);
    }
    throw new Error(`timed out waiting for ${what}${last ? `: ${last.message}` : ''}`);
}

async function login() {
    await waitFor('HTTP', async () => (await fetch(`${HA}/api/onboarding`)).ok);
    const clientId = `${HA}/`;
    const r = await fetch(`${HA}/api/onboarding/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: clientId,
            name: 'E2E',
            username: 'e2e',
            password: 'e2e-test-pw',
            language: 'en',
        }),
    });
    if (!r.ok) throw new Error(`onboarding/users: ${r.status} ${await r.text()}`);
    const { auth_code } = await r.json();
    const t = await fetch(`${HA}/auth/token`, {
        method: 'POST',
        body: new URLSearchParams({ grant_type: 'authorization_code', code: auth_code, client_id: clientId }),
    });
    if (!t.ok) throw new Error(`auth/token: ${t.status} ${await t.text()}`);
    return { ...(await t.json()), clientId };
}

// Minimal websocket client (Node's global WebSocket).
async function connect(token) {
    const ws = new WebSocket(`${HA.replace('http', 'ws')}/api/websocket`);
    let id = 0;
    const pending = new Map();
    await new Promise((res, rej) => {
        ws.onerror = () => rej(new Error('websocket error'));
        ws.onmessage = (ev) => {
            const m = JSON.parse(ev.data);
            if (m.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: token }));
            else if (m.type === 'auth_ok') res();
            else if (m.type === 'auth_invalid') rej(new Error(m.message));
            else if (m.type === 'result' && pending.has(m.id)) {
                const p = pending.get(m.id);
                pending.delete(m.id);
                if (m.success) p.res(m.result);
                else p.rej(new Error(`${m.error?.code}: ${m.error?.message}`));
            }
        };
    });
    const call = (msg) =>
        new Promise((res, rej) => {
            const mid = ++id;
            pending.set(mid, { res, rej });
            ws.send(JSON.stringify({ id: mid, ...msg }));
        });
    return { call, close: () => ws.close() };
}

// --- 3. data, resources, dashboard ---------------------------------------------------------

const living = PRESETS.find((p) => p.id === 'living');
const ids = entities(living);
const units = {
    [ids.t]: ['°C', 'temperature'],
    [ids.h]: ['%', 'unitless'],
    [ids.outT]: ['°C', 'temperature'],
    [ids.outH]: ['%', 'unitless'],
};

// Daily means of the demo's living room as hourly rows (only past hours: the
// recorder writes the current one itself).
function hourlyRows(daily) {
    const now = Date.now();
    const rows = [];
    for (const d of daily.slice(-(DAYS + 1))) {
        for (let h = 0; h < 24; h++) {
            const start = d.start + h * 3600e3;
            if (start + 3600e3 > now - 3600e3) continue;
            rows.push({ start: new Date(start).toISOString(), mean: d.mean, min: d.mean, max: d.mean });
        }
    }
    return rows;
}

async function importStatistics(ws) {
    const daily = dailyMeans(living);
    for (const [id, [unit, unitClass]] of Object.entries(units)) {
        const stats = hourlyRows(daily[id]);
        const base = { statistic_id: id, source: 'recorder', name: null, has_sum: false, unit_of_measurement: unit };
        try {
            await ws.call({
                type: 'recorder/import_statistics',
                metadata: { ...base, mean_type: 1, unit_class: unitClass },
                stats,
            });
        } catch (e) {
            // Older Home Assistant: has_mean instead of mean_type / unit_class.
            log(`import_statistics with mean_type failed (${e.message}), retrying with has_mean`);
            await ws.call({ type: 'recorder/import_statistics', metadata: { ...base, has_mean: true }, stats });
        }
    }
    await waitFor(
        'imported statistics',
        async () => {
            const r = await ws.call({
                type: 'recorder/statistics_during_period',
                start_time: new Date(Date.now() - 70 * 864e5).toISOString(),
                statistic_ids: [ids.t, ids.h],
                period: 'day',
                types: ['mean'],
            });
            return (r[ids.t]?.length || 0) >= DAYS - 2 && (r[ids.h]?.length || 0) >= DAYS - 2;
        },
        60e3,
    );
}

const compass = (extra = {}) => ({
    type: 'custom:comfort-compass-card',
    title: 'Compass',
    temperature_entity: ids.t,
    humidity_entity: ids.h,
    days_to_show: DAYS,
    ...extra,
});
const mollier = (extra = {}) => ({
    type: 'custom:mollier-hx-card',
    title: 'h,x',
    temperature_entity: ids.t,
    humidity_entity: ids.h,
    outdoor_temperature_entity: ids.outT,
    outdoor_humidity_entity: ids.outH,
    days_to_show: DAYS,
    comfort_zone: { temperature: [20, 26], humidity: [30, 65], absolute_humidity: [0, 12] },
    warning_bands: true,
    ...extra,
});

// Tile height of n rows in a sections grid (56 px rows, 8 px gaps).
const rowsPx = (n) => n * 56 + (n - 1) * 8;

const VIEWS = [
    {
        path: 'sections',
        view: {
            title: 'Sections',
            path: 'sections',
            type: 'sections',
            max_columns: 3,
            sections: [
                {
                    type: 'grid',
                    cards: [
                        compass({ title: 'Compass auto' }),
                        compass({ title: 'Compass 5 rows', grid_options: { columns: 6, rows: 5 } }),
                    ],
                },
                { type: 'grid', cards: [mollier({ title: 'h,x auto' })] },
                {
                    type: 'grid',
                    cards: [mollier({ title: 'h,x 8 rows', show_pressure: true, grid_options: { rows: 8 } })],
                },
            ],
        },
    },
    { path: 'masonry', view: { title: 'Masonry', path: 'masonry', cards: [compass(), mollier()] } },
    { path: 'panel', view: { title: 'Panel', path: 'panel', type: 'panel', cards: [mollier({ title: 'h,x panel' })] } },
];

async function setUpDashboard(ws) {
    for (const f of ['mollier-hx-card.js', 'comfort-compass-card.js']) {
        await ws.call({ type: 'lovelace/resources/create', res_type: 'module', url: `/local/${f}` });
    }
    await ws.call({
        type: 'lovelace/dashboards/create',
        url_path: DASHBOARD,
        title: 'E2E',
        mode: 'storage',
        require_admin: false,
        show_in_sidebar: true,
    });
    await ws.call({ type: 'lovelace/config/save', url_path: DASHBOARD, config: { views: VIEWS.map((v) => v.view) } });
}

// --- 4. browser checks ---------------------------------------------------------------------

function findChrome() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    for (const name of process.platform === 'win32'
        ? []
        : ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
        try {
            const p = execSync(`command -v ${name}`, { encoding: 'utf8' }).trim();
            if (p && existsSync(p)) return p;
        } catch {
            /* not found */
        }
    }
    for (const p of [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ]) {
        if (existsSync(p)) return p;
    }
    throw new Error('No Chrome/Chromium found. Set CHROME_PATH.');
}

// Runs in the page: every element matching `sel` in the document and all shadow roots.
const DEEP = `window.__deep = (sel, root = document) => {
    const out = [];
    const walk = (n) => {
        if (!n) return;
        if (n.querySelectorAll) out.push(...n.querySelectorAll(sel));
        const all = n.querySelectorAll ? n.querySelectorAll('*') : [];
        for (const el of all) if (el.shadowRoot) walk(el.shadowRoot);
    };
    walk(root);
    return out;
};`;

async function checkViews(tokens, haVersion) {
    const browser = await puppeteer.launch({
        executablePath: findChrome(),
        args: ['--no-sandbox', '--hide-scrollbars'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    // Logged in like the frontend after a login: tokens in localStorage.
    await page.evaluateOnNewDocument((t) => localStorage.setItem('hassTokens', JSON.stringify(t)), {
        hassUrl: HA,
        clientId: tokens.clientId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: 'Bearer',
        expires_in: tokens.expires_in,
        expires: Date.now() + tokens.expires_in * 1000,
    });
    await page.evaluateOnNewDocument(DEEP);

    const deep = (sel) => page.evaluate((s) => window.__deep(s).length, sel);
    const cardInfo = (tag) =>
        page.evaluate((tag) => {
            return window.__deep(tag).map((el) => {
                const r = el.getBoundingClientRect();
                const sr = el.shadowRoot;
                return {
                    title: el._config?.title,
                    w: Math.round(r.width),
                    h: Math.round(r.height),
                    glyph: !!sr?.querySelector('.glyph .seg'),
                    glyphW: Math.round(sr?.querySelector('.glyph')?.getBoundingClientRect().width || 0),
                    points: sr?.querySelectorAll('#data-points circle').length || 0,
                    grid: !!sr?.querySelector('#hx_mollier_diagram'),
                    air: sr?.querySelector('.air-info')?.textContent || '',
                    error: !!sr?.querySelector('.error, p.message.error'),
                };
            });
        }, tag);

    for (const { path } of VIEWS) {
        log(`view ${path}`);
        await page.goto(`${HA}/${DASHBOARD}/${path}`, { waitUntil: 'networkidle0', timeout: 90e3 });
        try {
            await page.waitForFunction(
                () =>
                    window
                        .__deep('mollier-hx-card')
                        .every((el) => el.shadowRoot?.querySelector('#data-points circle')) &&
                    window.__deep('comfort-compass-card').every((el) => el.shadowRoot?.querySelector('.glyph .seg')) &&
                    window.__deep('mollier-hx-card, comfort-compass-card').length > 0,
                { timeout: 60e3 },
            );
        } catch {
            /* reported by the checks below */
        }
        await sleep(800);
        await page.screenshot({ path: join(OUT, `${haVersion}-${path}.png`), fullPage: true });
        check((await deep('hui-error-card')) === 0, `${path}: no error card`);
        for (const c of await cardInfo('comfort-compass-card')) {
            check(c.glyph && !c.error, `${path} / ${c.title}: compass drawn`);
            check(c.glyphW > 0 && c.glyphW <= 381, `${path} / ${c.title}: glyph width ${c.glyphW} px within the cap`);
            if (/5 rows/.test(c.title))
                check(Math.abs(c.h - rowsPx(5)) <= 3, `${path} / ${c.title}: fills its tile (${c.h} px)`);
        }
        for (const c of await cardInfo('mollier-hx-card')) {
            check(c.grid && c.points >= DAYS - 5 && !c.error, `${path} / ${c.title}: diagram with ${c.points} days`);
            if (/8 rows/.test(c.title)) {
                check(Math.abs(c.h - rowsPx(8)) <= 3, `${path} / ${c.title}: fills its tile (${c.h} px)`);
                check(
                    /450/.test(c.air) && /hPa/.test(c.air),
                    `${path} / ${c.title}: altitude from Home Assistant ("${c.air}")`,
                );
            }
        }
    }

    // Card picker entries and the visual editors (ha-form with the statistic selector).
    log('editors');
    const picker = await page.evaluate(() => (window.customCards || []).map((c) => c.type));
    for (const t of ['comfort-compass-card', 'mollier-hx-card']) check(picker.includes(t), `card picker lists ${t}`);
    // The editors as a user opens them: dashboard in edit mode, "Edit" on the
    // card. HA loads ha-form and the selectors for its dialog (in a scoped
    // registry), so the editor is only checked there.
    for (const tag of ['comfort-compass-card', 'mollier-hx-card']) {
        await page.goto(`${HA}/${DASHBOARD}/masonry?edit=1`, { waitUntil: 'networkidle0', timeout: 90e3 });
        const opened = await page
            .waitForFunction(
                (tag) => {
                    const opts = window
                        .__deep('hui-card-options')
                        .find((o) => o.querySelector(tag) || window.__deep(tag, o).length);
                    const btn =
                        opts &&
                        [...opts.shadowRoot.querySelectorAll('ha-button, mwc-button, button')].find((b) =>
                            /edit|bearbeiten/i.test(b.textContent || b.label || ''),
                        );
                    if (btn) btn.click();
                    return !!btn;
                },
                { timeout: 30e3 },
                tag,
            )
            .then(() => true)
            .catch(() => false);
        check(opened, `${tag}: edit dialog opens`);
        const editor = await page
            .waitForFunction(
                (tag) => {
                    const ed = window.__deep(`${tag}-editor`)[0];
                    if (!ed) return false;
                    const pickers = window.__deep('ha-statistic-picker', ed.shadowRoot);
                    const shown = pickers.filter((p) => p.shadowRoot && p.getBoundingClientRect().height > 0);
                    const form = window.__deep('ha-form', ed.shadowRoot)[0];
                    return form && pickers.length >= 2 && shown.length === pickers.length && pickers.length;
                },
                { timeout: 30e3 },
                tag,
            )
            .then((h) => h.jsonValue())
            .catch(() => 0);
        check(editor >= 2, `${tag}: editor shows ha-form with ${editor} statistic pickers`);
        await page.screenshot({ path: join(OUT, `${haVersion}-editor-${tag}.png`) });
    }

    const ours = errors.filter((e) => /compass|mollier|hx-card/i.test(e));
    check(ours.length === 0, `no console errors from the cards${ours.length ? `: ${ours.join(' | ')}` : ''}`);
    if (errors.length) {
        writeFileSync(join(OUT, 'console-errors.txt'), `${errors.join('\n')}\n`);
        log(`other console errors (not counted): ${errors.length}, see tmp/e2e/out/console-errors.txt`);
    }
    await browser.close();
}

// --- run -------------------------------------------------------------------------------------

let started = false;
try {
    docker('version', '--format', '{{.Server.Version}}');
} catch {
    console.error('[e2e] Docker is not running: start Docker (Desktop) and try again.');
    process.exit(2);
}
try {
    prepare();
    startHa();
    started = true;
    const tokens = await login();
    const ws = await connect(tokens.access_token);
    const cfg = await waitFor('Home Assistant to run', async () => {
        const c = await ws.call({ type: 'get_config' });
        return c.state === 'RUNNING' && c;
    });
    log(`Home Assistant ${cfg.version} running, elevation ${cfg.elevation} m`);
    await importStatistics(ws);
    await setUpDashboard(ws);
    ws.close();
    await checkViews(tokens, cfg.version);
    writeFileSync(join(OUT, 'ha-version.txt'), `${cfg.version}\n`);
} catch (e) {
    failures.push(`setup: ${e.message}`);
    console.error('[e2e]', e);
} finally {
    if (started) {
        try {
            // docker logs writes HA's log to stderr.
            const r = spawnSync('docker', ['logs', CONTAINER], { encoding: 'utf8' });
            writeFileSync(join(OUT, 'ha.log'), `${r.stdout}${r.stderr}`);
        } catch {
            /* no log */
        }
        if (!KEEP) {
            try {
                docker('rm', '-f', CONTAINER);
            } catch {
                /* already gone */
            }
        } else log(`HA keeps running on ${HA} (container ${CONTAINER})`);
    }
}
console.log(failures.length ? `\n[e2e] ${failures.length} check(s) failed` : '\n[e2e] all checks passed');
process.exit(failures.length ? 1 : 0);
