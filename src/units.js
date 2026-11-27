// Unit systems of the cards. Inside, everything stays SI: °C, relative
// humidity 0..1, kg/kg, Pa, m. The unit system only decides how the config is
// read and how values are shown:
//   metric:   °C, K (differences), %, g/kg, m, hPa / Pa
//   imperial: °F, °F (differences), %, gr/lb, ft, inHg   (US customary)
// Constants as in pyedautils (pyedautils/units.py). Shared by
// retomarek/comfort-compass-card and retomarek/mollier-hx-card: keep both
// copies identical (`npm run check-shared`).

import { formatNumber } from './localize/localize.js';

export const UNITS_OPTIONS = ['auto', 'metric', 'imperial'];

// 'metric' or 'imperial': the card's `units` option, else (auto) the unit
// system of Home Assistant, which uses °F only for US customary (the frontend
// decides the same way).
export function unitSystem(config, hass) {
    const u = config?.units;
    if (u === 'metric' || u === 'imperial') return u;
    return hass?.config?.unit_system?.temperature === '°F' ? 'imperial' : 'metric';
}

const FT_PER_M = 1 / 0.3048;
export const PA_PER_INHG = 3386.389;
const GR_PER_G = 7; // 7000 grains per pound, so g/kg × 7 = gr/lb

export const cToF = (c) => (c * 9) / 5 + 32;
export const fToC = (f) => ((f - 32) * 5) / 9;
export const mToFt = (m) => m * FT_PER_M;
export const ftToM = (ft) => ft / FT_PER_M;
export const paToInhg = (pa) => pa / PA_PER_INHG;
export const inhgToPa = (inhg) => inhg * PA_PER_INHG;

// Conversions between the units of the config (and the editor) and the
// internal ones, per unit system. Temperatures in °C, differences in K,
// absolute humidity in g/kg (the config's metric unit; kg/kg is only used
// deeper inside), altitude in m.
export const UNITS = {
    metric: {
        temperature: { unit: '°C', toC: (v) => v, fromC: (v) => v, step: 'any' },
        delta: { unit: 'K', toK: (v) => v, fromK: (v) => v, step: 'any' },
        absHumidity: { unit: 'g/kg', toGkg: (v) => v, fromGkg: (v) => v, step: 'any' },
        altitude: { unit: 'm', toM: (v) => v, fromM: (v) => v, step: 'any' },
    },
    imperial: {
        temperature: { unit: '°F', toC: fToC, fromC: cToF, step: 'any' },
        delta: { unit: '°F', toK: (v) => v / 1.8, fromK: (v) => v * 1.8, step: 'any' },
        absHumidity: { unit: 'gr/lb', toGkg: (v) => v / GR_PER_G, fromGkg: (v) => v * GR_PER_G, step: 'any' },
        altitude: { unit: 'ft', toM: ftToM, fromM: mToFt, step: 'any' },
    },
};

// Comfort zone and warning bands in the units of the config, per system. The
// imperial values are the metric ones, converted and rounded: 20–26 °C →
// 68–79 °F, 12 g/kg → 84 gr/lb, ±1 / ±2.5 K → ±2 / ±4.5 °F, ±1 / ±2.5 g/kg →
// ±7 / ±17.5 gr/lb.
export const DEFAULT_ZONES = {
    metric: { temperature: [20, 26], humidity: [30, 65], absolute_humidity: [0, 12] },
    imperial: { temperature: [68, 79], humidity: [30, 65], absolute_humidity: [0, 84] },
};
export const DEFAULT_BAND_VALUES = {
    metric: {
        orange: { temperature: 1, humidity: 5, absolute_humidity: 1 },
        red: { temperature: 2.5, humidity: 10, absolute_humidity: 2.5 },
    },
    imperial: {
        orange: { temperature: 2, humidity: 5, absolute_humidity: 7 },
        red: { temperature: 4.5, humidity: 10, absolute_humidity: 17.5 },
    },
};

// Values shown to the user, with their unit and in the user's number format:
// show(hass, 'imperial').temperature(21.5) → "70.7 °F".
export function show(hass, system) {
    const u = UNITS[system] || UNITS.metric;
    const num = (v, d) => formatNumber(hass, v, d);
    const imperial = system === 'imperial';
    return {
        system,
        temperature: (c, d = 1) => `${num(u.temperature.fromC(c), d)} ${u.temperature.unit}`,
        delta: (k, d = 1) => `${num(u.delta.fromK(k), d)} ${u.delta.unit}`,
        // x in kg/kg
        absHumidity: (x, d = imperial ? 0 : 1) => `${num(u.absHumidity.fromGkg(x * 1000), d)} ${u.absHumidity.unit}`,
        altitude: (m) => `${num(u.altitude.fromM(m), 0)} ${u.altitude.unit}`,
        pressure: (pa) => (imperial ? `${num(paToInhg(pa), 2)} inHg` : `${num(pa / 100, 0)} hPa`),
        units: {
            temperature: u.temperature.unit,
            delta: u.delta.unit,
            absHumidity: u.absHumidity.unit,
            altitude: u.altitude.unit,
        },
    };
}

// Converts the unit-bearing keys of a card config from one system to the
// other (used by the editors when the user switches `units`), so the zone,
// the bands, the axis ranges and the air pressure keep their meaning. Rounded
// finely enough that switching back and forth gives the same values again
// (°F and gr/lb to 0.1, °C, K and g/kg to 0.01). Keys the
// config does not have stay out.
export function convertConfigUnits(config, from, to) {
    if (from === to || !config) return config;
    const a = UNITS[from];
    const b = UNITS[to];
    const round = (v, step) => Math.round(v / step) * step;
    const r = (v) => +v.toFixed(4);
    const isNum = (v) => v !== null && v !== '' && typeof v !== 'boolean' && Number.isFinite(Number(v));
    const pair = (p, fn, step) =>
        Array.isArray(p) && p.length === 2 && p.every(isNum) ? p.map((v) => r(round(fn(Number(v)), step))) : p;
    const temp = (v) => b.temperature.fromC(a.temperature.toC(v));
    const delta = (v) => b.delta.fromK(a.delta.toK(v));
    const absH = (v) => b.absHumidity.fromGkg(a.absHumidity.toGkg(v));
    // Finer steps on the metric side, so imperial → metric → imperial is exact too.
    const tStep = to === 'imperial' ? 0.1 : 0.01;
    const absStep = to === 'imperial' ? 0.1 : 0.01;
    const out = { ...config };
    if (out.comfort_zone && typeof out.comfort_zone === 'object' && !Array.isArray(out.comfort_zone)) {
        const cz = { ...out.comfort_zone };
        if ('temperature' in cz) cz.temperature = pair(cz.temperature, temp, tStep);
        if ('absolute_humidity' in cz) cz.absolute_humidity = pair(cz.absolute_humidity, absH, absStep);
        out.comfort_zone = cz;
    }
    if (out.warning_bands && typeof out.warning_bands === 'object') {
        const wb = { ...out.warning_bands };
        for (const k of ['orange', 'red']) {
            if (!wb[k] || typeof wb[k] !== 'object') continue;
            const band = { ...wb[k] };
            if (isNum(band.temperature)) band.temperature = r(round(delta(Number(band.temperature)), tStep));
            if (isNum(band.absolute_humidity)) {
                band.absolute_humidity = r(round(absH(Number(band.absolute_humidity)), absStep));
            }
            wb[k] = band;
        }
        out.warning_bands = wb;
    }
    if ('temperature_range' in out) out.temperature_range = pair(out.temperature_range, temp, tStep);
    if ('x_range' in out) out.x_range = pair(out.x_range, absH, absStep);
    if (isNum(out.altitude)) out.altitude = r(round(b.altitude.fromM(a.altitude.toM(Number(out.altitude))), 1));
    if (isNum(out.pressure)) {
        // metric pressure is hPa (< 2000) or Pa (written as Pa, like the editor), imperial inHg
        const p = Number(out.pressure);
        const pa = from === 'imperial' ? inhgToPa(p) : p < 2000 ? p * 100 : p;
        out.pressure = to === 'imperial' ? r(round(paToInhg(pa), 0.01)) : Math.round(pa);
    }
    return out;
}
