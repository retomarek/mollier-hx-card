// Live demo of the Comfort Compass Card and the Mollier hx Card: the real card
// bundles, fed by a simulated Home Assistant (mock-hass.js) with synthetic
// sensor history (presets.js). The controls change the card configs and the
// live sensor values; the YAML below the cards is what you would paste into
// a dashboard.

import { createHass } from './mock-hass.js';
import { dailyMeans, entities, PRESETS } from './presets.js';

// --- icons (Material Design Icons paths) ---------------------------------

const MDI = {
    check: 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z',
    menuDown: 'M7,10L12,15L17,10H7Z',
    thermometer: 'M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z',
    water: 'M12,20A6,6 0 0,1 6,14C6,10 12,3.25 12,3.25C12,3.25 18,10 18,14A6,6 0 0,1 12,20Z',
    waterPercent:
        'M12,3.25C12,3.25 6,10 6,14C6,17.32 8.69,20 12,20A6,6 0 0,0 18,14C18,10 12,3.25 12,3.25M14.47,9.97L15.53,11.03L9.53,17.03L8.47,15.97M9.75,10A1.25,1.25 0 0,1 11,11.25A1.25,1.25 0 0,1 9.75,12.5A1.25,1.25 0 0,1 8.5,11.25A1.25,1.25 0 0,1 9.75,10M14.25,14.5A1.25,1.25 0 0,1 15.5,15.75A1.25,1.25 0 0,1 14.25,17A1.25,1.25 0 0,1 13,15.75A1.25,1.25 0 0,1 14.25,14.5Z',
    home: 'M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z',
    tree: 'M11,21V16.74C10.53,16.91 10.03,17 9.5,17C7,17 5,15 5,12.5C5,11.23 5.5,10.09 6.36,9.27C6.13,8.73 6,8.13 6,7.5C6,5 8,3 10.5,3C12.06,3 13.44,3.8 14.25,5C14.33,5 14.41,5 14.5,5A5.5,5.5 0 0,1 20,10.5A5.5,5.5 0 0,1 14.5,16C14,16 13.5,15.93 13,15.79V21H11Z',
    calendar:
        'M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1M7,10H9V12H7V10M11,10H13V12H11V10M15,10H17V12H15V10Z',
    alert: 'M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z',
    palette:
        'M17.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,9A1.5,1.5 0 0,1 19,10.5A1.5,1.5 0 0,1 17.5,12M14.5,8A1.5,1.5 0 0,1 13,6.5A1.5,1.5 0 0,1 14.5,5A1.5,1.5 0 0,1 16,6.5A1.5,1.5 0 0,1 14.5,8M9.5,8A1.5,1.5 0 0,1 8,6.5A1.5,1.5 0 0,1 9.5,5A1.5,1.5 0 0,1 11,6.5A1.5,1.5 0 0,1 9.5,8M6.5,12A1.5,1.5 0 0,1 5,10.5A1.5,1.5 0 0,1 6.5,9A1.5,1.5 0 0,1 8,10.5A1.5,1.5 0 0,1 6.5,12M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A1.5,1.5 0 0,0 13.5,19.5C13.5,19.11 13.35,18.76 13.11,18.5C12.88,18.23 12.73,17.88 12.73,17.5A1.5,1.5 0 0,1 14.23,16H16A5,5 0 0,0 21,11C21,6.58 16.97,3 12,3Z',
    translate:
        'M12.87,15.07L10.33,12.56L10.36,12.53C12.1,10.59 13.34,8.36 14.07,6H17V4H10V2H8V4H1V6H12.17C11.5,7.92 10.44,9.75 9,11.35C8.07,10.32 7.3,9.19 6.69,8H4.69C5.42,9.63 6.42,11.17 7.67,12.56L2.58,17.58L4,19L9,14L12.11,17.11L12.87,15.07M18.5,10H16.5L12,22H14L15.12,19H19.87L21,22H23L18.5,10M15.88,17L17.5,12.67L19.12,17H15.88Z',
    brightness:
        'M12,18V6A6,6 0 0,1 18,12A6,6 0 0,1 12,18M20,15.31L23.31,12L20,8.69V4H15.31L12,0.69L8.69,4H4V8.69L0.69,12L4,15.31V20H8.69L12,23.31L15.31,20H20V15.31Z',
    mountain: 'M14,6L10.25,11L13.1,14.8L11.5,16C9.81,13.75 7,10 7,10L1,18H23L14,6Z',
    chevron: 'M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z',
    copy: 'M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z',
    circle: 'M12,2A10,10 0 1,0 22,12A10,10 0 0,0 12,2Z',
    label: 'M17.63,5.84C17.27,5.33 16.67,5 16,5H5A2,2 0 0,0 3,7V17A2,2 0 0,0 5,19H16C16.67,19 17.27,18.66 17.63,18.15L22,12L17.63,5.84Z',
    list: 'M3,4H7V8H3V4M9,5V7H21V5H9M3,10H7V14H3V10M9,11V13H21V11H9M3,16H7V20H3V16M9,17V19H21V17H9',
    ruler: 'M1.39,18.36L3.16,16.6L4.58,18L5.64,16.95L4.22,15.54L5.64,14.12L8.11,16.6L9.17,15.54L6.7,13.06L8.11,11.65L9.53,13.06L10.59,12L9.17,10.59L10.59,9.17L13.06,11.65L14.12,10.59L11.65,8.11L13.06,6.7L14.47,8.11L15.54,7.05L14.12,5.64L15.54,4.22L18,6.7L19.07,5.64L16.6,3.16L18.36,1.39L22.61,5.64L5.64,22.61L1.39,18.36Z',
    fan: 'M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z',
    history:
        'M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3',
    github: 'M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21V19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26V21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z',
    download: 'M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z',
    compass:
        'M14.19,14.19L6,18L9.81,9.81L18,6M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,10.9A1.1,1.1 0 0,0 10.9,12A1.1,1.1 0 0,0 12,13.1A1.1,1.1 0 0,0 13.1,12A1.1,1.1 0 0,0 12,10.9Z',
    chart: 'M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z',
    tune: 'M3,17V19H9V17H3M3,5V7H13V5H3M13,21V19H21V17H13V15H11V21H13M7,9V11H3V13H7V15H9V9H7M21,13V11H11V13H21M15,9H17V7H21V5H17V3H15V9Z',
    code: 'M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6Z',
};

const icon = (name, cls = 'icon') =>
    `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${MDI[name]}"/></svg>`;

// --- options ----------------------------------------------------------------

const LANGUAGES = [
    ['en', 'English'],
    ['de', 'Deutsch'],
    ['fr', 'Français'],
    ['it', 'Italiano'],
    ['es', 'Español'],
    ['pt', 'Português'],
    ['nl', 'Nederlands'],
    ['pl', 'Polski'],
    ['sv', 'Svenska'],
    ['da', 'Dansk'],
    ['nb', 'Norsk bokmål'],
    ['cs', 'Čeština'],
    ['ru', 'Русский'],
    ['zh-Hans', '简体中文'],
];

// comfort-compass-card/src/palettes.js (PALETTE_NAMES) with the English labels.
const PALETTES = [
    ['default', 'Default'],
    ['neon', 'Neon'],
    ['okabe_ito', 'Colour-blind safe (Okabe-Ito)'],
    ['tol_muted', 'Colour-blind safe, muted (Paul Tol)'],
    ['high_contrast', 'High contrast'],
    ['pastel', 'Pastel'],
    ['material', 'Material (Home Assistant colours)'],
    ['nord', 'Nord'],
    ['dracula', 'Dracula'],
    ['catppuccin', 'Catppuccin'],
    ['solarized', 'Solarized'],
    ['gruvbox', 'Gruvbox (retro)'],
    ['tokyo_night', 'Tokyo Night'],
    ['bauhaus', 'Bauhaus'],
    ['vintage', 'Vintage'],
    ['earth', 'Earth'],
    ['sunset', 'Sunset'],
    ['minimal', 'Minimal (only “in range” in colour)'],
];

// Card defaults (the editors write only values that differ from these).
const ZONE_DEFAULT = { t: [20, 26], rh: [30, 65], x: 12 };
const BANDS_DEFAULT = {
    orange: { temperature: 1, humidity: 5, absolute_humidity: 1 },
    red: { temperature: 2.5, humidity: 10, absolute_humidity: 2.5 },
};
const COMPASS_DEFAULT_DAYS = 30;
const MOLLIER_DEFAULT_DAYS = 7;
const DEFAULT_BREATHING = 55;

// --- state ------------------------------------------------------------------

const params = new URLSearchParams(location.search);
const startPreset = PRESETS.find((p) => p.id === params.get('preset')) || PRESETS[0];
const startTheme = params.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const browserLang = (navigator.language || 'en').toLowerCase();
const startLang =
    params.get('lang') ||
    (LANGUAGES.find(([c]) => c.toLowerCase() === browserLang || c.toLowerCase() === browserLang.split('-')[0]) || [
        'en',
    ])[0];

// Home Assistant's unit system in the demo: imperial for US visitors (or
// ?units=imperial), metric otherwise.
const startUnits =
    params.get('units') === 'imperial' || (params.get('units') !== 'metric' && browserLang === 'en-us')
        ? 'imperial'
        : 'metric';

const state = {
    units: startUnits,
    preset: startPreset,
    days: 120,
    // 'home': the elevation set in Home Assistant (nothing in the YAML);
    // 'own': `altitude` in the card config.
    airSource: 'home',
    altitude: 450,
    showPressure: false,
    dark: startTheme === 'dark',
    lang: startLang,
    zone: { t: [...ZONE_DEFAULT.t], rh: [...ZONE_DEFAULT.rh], x: ZONE_DEFAULT.x },
    bands: structuredClone(BANDS_DEFAULT),
    live: { ...startPreset.now },
    palette: params.get('palette') || 'default',
    scale: 'fit',
    showLabels: true,
    compassLegend: params.get('legend') === '1',
    mollierLegend: true,
    showCurrent: true,
    breathing: DEFAULT_BREATHING,
    nowLine: true,
    coloring: 'season',
    outdoorHistory: false,
    ventilation: true,
};

// Daily means of every sample room, generated once.
const stats = Object.assign({}, ...PRESETS.map(dailyMeans));

// --- card configs -----------------------------------------------------------

// The demo keeps its values metric; with imperial units (US customary in Home
// Assistant) the cards read their config in °F, °F differences, gr/lb and ft,
// so the YAML is converted (like the cards' editors do when switching units).
const imperial = () => state.units === 'imperial';
const toF = (c) => Math.round(((c * 9) / 5 + 32) * 2) / 2;
const toDeltaF = (k) => Math.round(k * 1.8 * 2) / 2;
const toGr = (g) => Math.round(g * 7 * 2) / 2;
const toFt = (m) => Math.round(m / 0.3048);
function inUnits(c) {
    if (!imperial()) return c;
    const out = { ...c };
    if (out.comfort_zone) {
        const cz = { ...out.comfort_zone };
        cz.temperature = cz.temperature.map(toF);
        if (cz.absolute_humidity) cz.absolute_humidity = cz.absolute_humidity.map(toGr);
        out.comfort_zone = cz;
    }
    if (out.warning_bands && typeof out.warning_bands === 'object') {
        const wb = {};
        for (const [k, b] of Object.entries(out.warning_bands)) {
            wb[k] = { ...b };
            if ('temperature' in b) wb[k].temperature = toDeltaF(b.temperature);
            if ('absolute_humidity' in b) wb[k].absolute_humidity = toGr(b.absolute_humidity);
        }
        out.warning_bands = wb;
    }
    if ('altitude' in out) out.altitude = toFt(out.altitude);
    return out;
}
// Slider labels in the units the cards show.
const tLabel = (c, d = 1) =>
    imperial() ? `${round((c * 9) / 5 + 32, d).toFixed(d)} °F` : `${round(c, d).toFixed(d)} °C`;
const dtLabel = (k) => (imperial() ? `± ${round(k * 1.8, 1)} °F` : `± ${k} K`);
const xLabel = (g) => (imperial() ? `${round(g * 7, 1)} gr/lb` : `${g} g/kg`);

const round = (v, d = 2) => +Number(v).toFixed(d);
const sameZone = () =>
    state.zone.t[0] === ZONE_DEFAULT.t[0] &&
    state.zone.t[1] === ZONE_DEFAULT.t[1] &&
    state.zone.rh[0] === ZONE_DEFAULT.rh[0] &&
    state.zone.rh[1] === ZONE_DEFAULT.rh[1] &&
    state.zone.x === ZONE_DEFAULT.x;
const zoneConfig = () => ({
    temperature: [...state.zone.t],
    humidity: [...state.zone.rh],
    absolute_humidity: [0, state.zone.x],
});
// Only the band values that differ from the defaults; {} when all are default.
function bandsDiff() {
    const out = {};
    for (const k of ['orange', 'red']) {
        for (const f of ['temperature', 'humidity', 'absolute_humidity']) {
            if (state.bands[k][f] !== BANDS_DEFAULT[k][f]) (out[k] ??= {})[f] = state.bands[k][f];
        }
    }
    return out;
}

function compassConfig() {
    const ids = entities(state.preset);
    const c = {
        type: 'custom:comfort-compass-card',
        title: state.preset.name,
        temperature_entity: ids.t,
        humidity_entity: ids.h,
    };
    if (state.days !== COMPASS_DEFAULT_DAYS) c.days_to_show = state.days;
    if (state.airSource === 'own') c.altitude = state.altitude;
    if (!sameZone()) c.comfort_zone = zoneConfig();
    const bands = bandsDiff();
    if (Object.keys(bands).length) c.warning_bands = bands;
    if (state.palette !== 'default') c.palette = state.palette;
    if (state.scale === 'fixed') c.scale = 'fixed';
    if (!state.showLabels) c.show_labels = false;
    if (state.compassLegend) c.show_legend = true;
    if (!state.showCurrent) c.show_current = false;
    if (state.showCurrent && state.breathing !== DEFAULT_BREATHING) c.breathing = state.breathing;
    if (!state.nowLine) c.show_current_legend = false;
    return inUnits(c);
}

function mollierConfig() {
    const ids = entities(state.preset);
    const c = {
        type: 'custom:mollier-hx-card',
        title: 'h,x diagram',
        temperature_entity: ids.t,
        humidity_entity: ids.h,
    };
    if (state.days !== MOLLIER_DEFAULT_DAYS) c.days_to_show = state.days;
    if (state.coloring !== 'season') c.coloring = state.coloring;
    if (state.airSource === 'own') c.altitude = state.altitude;
    c.comfort_zone = zoneConfig();
    const bands = bandsDiff();
    c.warning_bands = Object.keys(bands).length ? bands : true;
    c.outdoor_temperature_entity = ids.outT;
    c.outdoor_humidity_entity = ids.outH;
    if (state.outdoorHistory) c.outdoor_history = true;
    if (!state.ventilation) c.ventilation_line = false;
    if (!state.mollierLegend) c.show_legend = false;
    if (state.showPressure) c.show_pressure = true;
    return inUnits(c);
}

// --- YAML -------------------------------------------------------------------

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function scalar(v) {
    if (Array.isArray(v)) return `[${v.map(scalar).join(', ')}]`;
    if (typeof v === 'number') return String(round(v, 3));
    if (typeof v === 'boolean') return String(v);
    const s = String(v);
    return /^[A-Za-z_][\w.:,+ -]*$/.test(s) && !/^(true|false|yes|no|on|off|null)$/i.test(s) ? s : JSON.stringify(s);
}

function toYaml(obj, indent = 0) {
    const pad = ' '.repeat(indent);
    return Object.entries(obj)
        .map(([k, v]) =>
            v && typeof v === 'object' && !Array.isArray(v)
                ? `${pad}${k}:\n${toYaml(v, indent + 2)}`
                : `${pad}${k}: ${scalar(v)}`,
        )
        .join('\n');
}

// Plain YAML → highlighted HTML (keys, strings, numbers).
function highlight(yaml) {
    return yaml
        .split('\n')
        .map((line) => {
            const m = line.match(/^(\s*)([\w]+):(\s?)(.*)$/);
            if (!m) return esc(line);
            const [, sp, key, gap, val] = m;
            let v = esc(val);
            if (/^-?\d+(\.\d+)?$/.test(val) || /^(true|false)$/.test(val)) v = `<span class="n">${v}</span>`;
            else if (val.startsWith('[')) v = v.replace(/-?\d+(\.\d+)?/g, (n) => `<span class="n">${n}</span>`);
            else if (val) v = `<span class="s">${v}</span>`;
            return `${sp}<span class="k">${key}</span>:${gap}${v}`;
        })
        .join('\n');
}

// --- controls ---------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);
const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
};
const pct = (v, min, max) => `${((v - min) / (max - min)) * 100}%`;
const refreshers = []; // update the controls' displayed state after a change

function tileHead(ic, name) {
    return `<div class="tile-head"><span class="tile-icon">${icon(ic)}</span>
        <div class="tile-info"><div class="tile-name">${name}</div><div class="tile-state"></div></div></div>`;
}

// Single-value slider tile.
function slider({ ic, name, color, min, max, step, get, set, fmt, wide, enabled }) {
    const t = el(`<div class="card tile${wide ? ' wide' : ''}" style="--tile-color:${color}">${tileHead(ic, name)}
        <div class="slider"><div class="fill"></div><div class="handle"></div>
        <input type="range" min="${min}" max="${max}" step="${step}" aria-label="${name}"></div></div>`);
    const input = t.querySelector('input');
    const bar = t.querySelector('.slider');
    const show = () => {
        const v = get();
        input.value = v;
        bar.style.setProperty('--hi', pct(v, min, max));
        t.querySelector('.handle').style.left = pct(v, min, max);
        t.querySelector('.tile-state').textContent = fmt(v);
        const on = enabled ? enabled() : true;
        t.classList.toggle('disabled', !on);
        input.disabled = !on;
    };
    input.addEventListener('input', () => {
        set(Number(input.value));
        update();
    });
    refreshers.push(show);
    return t;
}

// Two-thumb slider tile for a [min, max] range.
function range({ ic, name, color, min, max, step, get, set, fmt, wide }) {
    const t = el(`<div class="card tile${wide ? ' wide' : ''}" style="--tile-color:${color}">${tileHead(ic, name)}
        <div class="slider dual"><div class="fill"></div><div class="handle lo"></div><div class="handle hi"></div>
        <input type="range" class="lo" min="${min}" max="${max}" step="${step}" aria-label="${name} minimum">
        <input type="range" class="hi" min="${min}" max="${max}" step="${step}" aria-label="${name} maximum"></div></div>`);
    const lo = t.querySelector('input.lo');
    const hi = t.querySelector('input.hi');
    const bar = t.querySelector('.slider');
    const show = () => {
        const [a, b] = get();
        lo.value = a;
        hi.value = b;
        bar.style.setProperty('--lo', pct(a, min, max));
        bar.style.setProperty('--hi', pct(b, min, max));
        t.querySelector('.handle.lo').style.left = pct(a, min, max);
        t.querySelector('.handle.hi').style.left = pct(b, min, max);
        t.querySelector('.tile-state').textContent = fmt(a, b);
    };
    const on = (which) => () => {
        let a = Number(lo.value);
        let b = Number(hi.value);
        if (b - a < step) {
            if (which === 'lo') a = b - step;
            else b = a + step;
        }
        set([round(a, 2), round(b, 2)]);
        update();
    };
    lo.addEventListener('input', on('lo'));
    hi.addEventListener('input', on('hi'));
    refreshers.push(show);
    return t;
}

// Toggle tile: the whole tile switches.
function toggle({ ic, name, color, get, set, on = 'On', off = 'Off', wide, enabled }) {
    const t = el(`<label class="card tile${wide ? ' wide' : ''}" style="--tile-color:${color}">
        <div class="tile-head"><span class="tile-icon">${icon(ic)}</span>
        <div class="tile-info"><div class="tile-name">${name}</div><div class="tile-state"></div></div>
        <span class="switch"><input type="checkbox" role="switch"><span class="track"></span><span class="knob"></span></span>
        </div></label>`);
    const input = t.querySelector('input');
    const show = () => {
        const v = get();
        input.checked = v;
        t.classList.toggle('off', !v);
        t.querySelector('.tile-state').textContent = v ? (typeof on === 'function' ? on() : on) : off;
        const en = enabled ? enabled() : true;
        t.classList.toggle('disabled', !en);
        input.disabled = !en;
    };
    input.addEventListener('change', () => {
        set(input.checked);
        update();
    });
    refreshers.push(show);
    return t;
}

// Select tile (dropdown feature).
function select({ ic, name, color, options, get, set, wide }) {
    const opts = options.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
    const t = el(`<div class="card tile${wide ? ' wide' : ''}" style="--tile-color:${color}">${tileHead(ic, name)}
        <div class="select"><select aria-label="${name}">${opts}</select>${icon('menuDown')}</div></div>`);
    const s = t.querySelector('select');
    const show = () => {
        s.value = get();
        t.querySelector('.tile-state').textContent = s.selectedOptions[0]?.textContent || '';
    };
    s.addEventListener('change', () => {
        set(s.value);
        update();
    });
    refreshers.push(show);
    return t;
}

// Segmented buttons tile (like the climate mode feature).
function segments({ ic, name, color, options, get, set, wide }) {
    const btns = options.map(([v, l]) => `<button type="button" data-v="${v}">${esc(l)}</button>`).join('');
    const t = el(`<div class="card tile${wide ? ' wide' : ''}" style="--tile-color:${color}">${tileHead(ic, name)}
        <div class="segments" role="group" aria-label="${name}">${btns}</div></div>`);
    const show = () => {
        const v = get();
        for (const b of t.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === v));
        t.querySelector('.tile-state').textContent = options.find(([o]) => o === v)?.[1] || '';
    };
    t.querySelector('.segments').addEventListener('click', (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        set(b.dataset.v);
        update();
    });
    refreshers.push(show);
    return t;
}

// A group of controls that folds like an expandable section in Home Assistant's
// card editor; `open` decides whether it starts unfolded.
function section(ic, title, sub, tiles, open = false) {
    const s = el(`<details class="section"${open ? ' open' : ''}><summary class="heading">${icon(ic)}<h2>${title}</h2>
        ${sub ? `<span class="sub">· ${sub}</span>` : ''}<span class="grow"></span>${icon('chevron', 'icon chevron')}</summary>
        <div class="tiles"></div></details>`);
    s.querySelector('.tiles').append(...tiles);
    return s;
}

const c1 = (v) => tLabel(v);
const C = {
    temp: 'var(--deep-orange-color)',
    hum: 'var(--blue-color)',
    abs: 'var(--cyan-color)',
    out: 'var(--green-color)',
    orange: 'var(--orange-color)',
    red: 'var(--red-color)',
    days: 'var(--indigo-color)',
    display: 'var(--purple-color)',
    now: 'var(--pink-color)',
    alt: 'var(--teal-color)',
};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
reducedMotion.addEventListener('change', () => update());

// The cards do not animate when the device asks for reduced motion, so the
// breathing marker stands still; say why (only shown then).
function motionNote() {
    const n = el(`<div class="tile-note wide" role="note">
        <b>The marker does not breathe here</b> because your device asks for reduced motion; Home Assistant shows it the same way.
        To see it, switch animations on: Windows <i>Settings → Accessibility → Visual effects → Animation effects</i>,
        macOS <i>System Settings → Accessibility → Display → Reduce motion</i> (off),
        iOS <i>Settings → Accessibility → Motion → Reduce Motion</i> (off),
        Android <i>Settings → Accessibility → Remove animations</i> (off).</div>`);
    refreshers.push(() => (n.hidden = !(reducedMotion.matches && state.showCurrent)));
    return n;
}

function buildControls() {
    const side = $('#controls');
    const bandSliders = (k, color, label) => [
        slider({
            ic: 'thermometer',
            name: `${label} ΔT`,
            color,
            min: 0,
            max: 6,
            step: 0.5,
            get: () => state.bands[k].temperature,
            set: (v) => setBand(k, 'temperature', v),
            fmt: dtLabel,
        }),
        slider({
            ic: 'waterPercent',
            name: `${label} ΔRH`,
            color,
            min: 0,
            max: 25,
            step: 1,
            get: () => state.bands[k].humidity,
            set: (v) => setBand(k, 'humidity', v),
            fmt: (v) => `± ${v} %`,
        }),
        slider({
            ic: 'water',
            name: `${label} Δx`,
            color,
            min: 0,
            max: 6,
            step: 0.5,
            get: () => state.bands[k].absolute_humidity,
            set: (v) => setBand(k, 'absolute_humidity', v),
            fmt: (v) => `± ${xLabel(v)}`,
            wide: true,
        }),
    ];

    side.append(
        section(
            'thermometer',
            'Live values',
            'move the “Now” marker',
            [
                slider({
                    ic: 'thermometer',
                    name: 'Room temperature',
                    color: C.temp,
                    min: 5,
                    max: 35,
                    step: 0.1,
                    get: () => state.live.t,
                    set: (v) => (state.live.t = v),
                    fmt: c1,
                }),
                slider({
                    ic: 'waterPercent',
                    name: 'Room humidity',
                    color: C.hum,
                    min: 5,
                    max: 98,
                    step: 1,
                    get: () => state.live.rh,
                    set: (v) => (state.live.rh = v),
                    fmt: (v) => `${v} %`,
                }),
                slider({
                    ic: 'tree',
                    name: 'Outside temperature',
                    color: C.out,
                    min: -15,
                    max: 38,
                    step: 0.5,
                    get: () => state.live.outT,
                    set: (v) => (state.live.outT = v),
                    fmt: c1,
                }),
                slider({
                    ic: 'tree',
                    name: 'Outside humidity',
                    color: C.out,
                    min: 10,
                    max: 100,
                    step: 1,
                    get: () => state.live.outH,
                    set: (v) => (state.live.outH = v),
                    fmt: (v) => `${v} %`,
                }),
            ],
            true,
        ),
        section('home', 'Comfort zone', 'both cards', [
            range({
                ic: 'thermometer',
                name: 'Temperature',
                color: C.temp,
                min: 14,
                max: 32,
                step: 0.5,
                get: () => state.zone.t,
                set: (v) => (state.zone.t = v),
                fmt: (a, b) => `${tLabel(a).replace(/ °[CF]$/, '')} – ${tLabel(b)}`,
                wide: true,
            }),
            range({
                ic: 'waterPercent',
                name: 'Relative humidity',
                color: C.hum,
                min: 10,
                max: 90,
                step: 1,
                get: () => state.zone.rh,
                set: (v) => (state.zone.rh = v),
                fmt: (a, b) => `${a} – ${b} %`,
                wide: true,
            }),
            slider({
                ic: 'water',
                name: 'Abs. humidity max.',
                color: C.abs,
                min: 6,
                max: 20,
                step: 0.5,
                get: () => state.zone.x,
                set: (v) => (state.zone.x = v),
                fmt: (v) => `≤ ${xLabel(v)}`,
            }),
        ]),
        section(
            'mountain',
            'Location',
            'altitude sets the air pressure',
            [
                segments({
                    ic: 'mountain',
                    name: 'Altitude from',
                    color: C.alt,
                    options: [
                        ['home', 'Home Assistant'],
                        ['own', 'Own altitude'],
                    ],
                    get: () => state.airSource,
                    set: (v) => (state.airSource = v),
                    wide: true,
                }),
                slider({
                    ic: 'mountain',
                    name: 'Altitude',
                    color: C.alt,
                    min: 0,
                    max: 4000,
                    step: 50,
                    get: () => state.altitude,
                    set: (v) => (state.altitude = v),
                    fmt: (v) =>
                        (imperial()
                            ? `${toFt(v)} ft · ${round((101325 * Math.pow(1 - 2.25577e-5 * v, 5.25588)) / 3386.389, 2)} inHg`
                            : `${v} m · ${Math.round((101325 * Math.pow(1 - 2.25577e-5 * v, 5.25588)) / 100)} hPa`) +
                        (state.airSource === 'home' ? ' · Settings → System → General' : ' · altitude in the YAML'),
                    wide: true,
                }),
            ],
            true,
        ),
        section('alert', 'Warning bands', 'mild · moderate · severe', [
            ...bandSliders('orange', C.orange, 'Orange'),
            ...bandSliders('red', C.red, 'Red'),
        ]),
        section('tune', 'Display', '', [
            segments({
                ic: 'ruler',
                name: 'Units (Home Assistant unit system)',
                color: C.display,
                options: [
                    ['metric', 'Metric'],
                    ['imperial', 'US customary'],
                ],
                get: () => state.units,
                set: (v) => (state.units = v),
                wide: true,
            }),
            segments({
                ic: 'brightness',
                name: 'Theme',
                color: C.display,
                options: [
                    ['light', 'Light'],
                    ['dark', 'Dark'],
                ],
                get: () => (state.dark ? 'dark' : 'light'),
                set: (v) => (state.dark = v === 'dark'),
            }),
            select({
                ic: 'translate',
                name: 'Language',
                color: C.display,
                options: LANGUAGES,
                get: () => state.lang,
                set: (v) => (state.lang = v),
            }),
            slider({
                ic: 'calendar',
                name: 'Days to show',
                color: C.days,
                min: 7,
                max: 365,
                step: 1,
                get: () => state.days,
                set: (v) => (state.days = v),
                fmt: (v) => `${v} days`,
                wide: true,
            }),
        ]),
        section('compass', 'Comfort compass', '', [
            select({
                ic: 'palette',
                name: 'Colour palette',
                color: C.display,
                options: PALETTES,
                get: () => state.palette,
                set: (v) => (state.palette = v),
                wide: true,
            }),
            segments({
                ic: 'ruler',
                name: 'Scale',
                color: C.display,
                options: [
                    ['fit', 'Fit'],
                    ['fixed', 'Fixed'],
                ],
                get: () => state.scale,
                set: (v) => (state.scale = v),
            }),
            toggle({
                ic: 'label',
                name: 'Labels',
                color: C.display,
                get: () => state.showLabels,
                set: (v) => (state.showLabels = v),
            }),
            toggle({
                ic: 'list',
                name: 'Legend',
                color: C.display,
                get: () => state.compassLegend,
                set: (v) => (state.compassLegend = v),
            }),
            toggle({
                ic: 'circle',
                name: '“Now” line',
                color: C.now,
                get: () => state.nowLine,
                set: (v) => (state.nowLine = v),
            }),
            toggle({
                ic: 'circle',
                name: 'Breathing marker',
                color: C.now,
                get: () => state.showCurrent,
                set: (v) => (state.showCurrent = v),
                on: () => (reducedMotion.matches ? 'Still (see below)' : 'Breathes'),
                off: 'Off',
            }),
            slider({
                ic: 'circle',
                name: 'Breathing strength',
                color: C.now,
                min: 10,
                max: 90,
                step: 5,
                get: () => state.breathing,
                set: (v) => (state.breathing = v),
                fmt: (v) => `${v} %`,
                enabled: () => state.showCurrent,
            }),
            motionNote(),
        ]),
        section('chart', 'h,x diagram', '', [
            segments({
                ic: 'palette',
                name: 'Colour days by',
                color: C.display,
                options: [
                    ['season', 'Season'],
                    ['age', 'Age'],
                    ['chronological', 'Time'],
                ],
                get: () => state.coloring,
                set: (v) => (state.coloring = v),
                wide: true,
            }),
            toggle({
                ic: 'mountain',
                name: 'Altitude & pressure',
                color: C.alt,
                get: () => state.showPressure,
                set: (v) => (state.showPressure = v),
                on: 'Shown above the diagram',
                off: 'Hidden',
            }),
            toggle({
                ic: 'list',
                name: 'Legend',
                color: C.display,
                get: () => state.mollierLegend,
                set: (v) => (state.mollierLegend = v),
            }),
            toggle({
                ic: 'fan',
                name: 'Ventilation line',
                color: C.out,
                get: () => state.ventilation,
                set: (v) => (state.ventilation = v),
            }),
            toggle({
                ic: 'history',
                name: 'Outside history',
                color: C.out,
                get: () => state.outdoorHistory,
                set: (v) => (state.outdoorHistory = v),
                wide: true,
            }),
        ]),
    );
}

// Red always encloses orange (the cards widen red too); keep the sliders honest.
function setBand(k, f, v) {
    state.bands[k][f] = v;
    if (k === 'orange' && state.bands.red[f] < v) state.bands.red[f] = v;
    if (k === 'red' && state.bands.orange[f] > v) state.bands.orange[f] = v;
}

function buildPresets() {
    const box = $('#presets');
    for (const p of PRESETS) {
        const b = el(`<button type="button" class="chip" data-id="${p.id}">${icon('check')}${esc(p.name)}</button>`);
        b.addEventListener('click', () => {
            state.preset = p;
            state.live = { ...p.now };
            update();
        });
        box.append(b);
    }
    refreshers.push(() => {
        for (const b of box.querySelectorAll('.chip'))
            b.setAttribute('aria-pressed', String(b.dataset.id === state.preset.id));
        $('#room-name').textContent = state.preset.name;
        $('#room-hint').textContent = state.preset.hint;
    });
}

// --- apply --------------------------------------------------------------------

const compass = $('#compass');
const mollier = $('#mollier');
window.__demo = { state, fetches: [] };

let frame = 0;
function update() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
        frame = 0;
        render();
    });
}

function render() {
    document.documentElement.classList.toggle('dark', state.dark);
    for (const r of refreshers) r();
    const cc = compassConfig();
    const mc = mollierConfig();
    try {
        compass.setConfig(cc);
        mollier.setConfig(mc);
    } catch (err) {
        console.error(err);
    }
    const hass = createHass({
        rooms: PRESETS.map((p) => ({
            ids: entities(p),
            name: p.name,
            live: p === state.preset ? state.live : p.now,
        })),
        stats,
        language: state.lang,
        dark: state.dark,
        // The simulated Home Assistant elevation follows the slider in both modes,
        // so switching to 'own' starts from the same value.
        elevation: state.altitude,
        units: state.units,
        onFetch: (msg) => window.__demo.fetches.push(msg.statistic_ids.join(',')),
    });
    compass.hass = hass;
    mollier.hass = hass;
    showYaml('#yaml-compass', cc);
    showYaml('#yaml-mollier', mc);
    const url = new URL(location.href);
    url.searchParams.set('preset', state.preset.id);
    history.replaceState(null, '', url);
}

const yamlText = new Map();
function showYaml(sel, config) {
    const text = toYaml(config);
    yamlText.set(sel, text);
    $(`${sel} pre`).innerHTML = highlight(text);
}

function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 1800);
}

function wireCopy() {
    for (const sel of ['#yaml-compass', '#yaml-mollier']) {
        $(`${sel} button`).addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(`${yamlText.get(sel)}\n`);
                toast('YAML copied to the clipboard');
            } catch {
                toast('Copying is not allowed here; select the text instead');
            }
        });
    }
    $('#theme-toggle').addEventListener('click', () => {
        state.dark = !state.dark;
        update();
    });
}

async function start() {
    buildPresets();
    buildControls();
    wireCopy();
    const ready = Promise.all([
        customElements.whenDefined('comfort-compass-card'),
        customElements.whenDefined('mollier-hx-card'),
    ]);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000));
    try {
        await Promise.race([ready, timeout]);
    } catch {
        $('#load-error').hidden = false;
    }
    render();
}

start();
