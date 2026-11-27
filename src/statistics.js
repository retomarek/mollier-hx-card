// Daily means from Home Assistant's long-term statistics, and the live
// sensor values. Shared with retomarek/comfort-compass-card and
// retomarek/mollier-hx-card: keep both copies identical (`npm run check-shared`).

import { ftToM, inhgToPa } from './units.js';

// Re-fetch interval while the card is on screen: a new day appears in the
// statistics shortly after midnight, so hourly is plenty.
export const REFRESH_MS = 60 * 60 * 1000;
// After a failed fetch: retry soon, then back off (30 s, 1, 2, 4, 8, 10 min).
export const RETRY_MS = [30e3, 60e3, 120e3, 240e3, 480e3, 600e3];
// A statistics request that has not answered after FETCH_TIMEOUT_MS is given
// up (and retried): a busy Home Assistant, e.g. right after a restart, can
// leave it pending for minutes. After SLOW_MS the card says it is still loading.
export const FETCH_TIMEOUT_MS = 60e3;
export const SLOW_MS = 8e3;
// Upper bound for days_to_show (long-term statistics are kept forever, but
// a very long request is slow and the diagram gets crowded).
export const MAX_DAYS = 3650;

// Accepted air pressure and altitude, shared by the cards and their editors.
export const PRESSURE_PA_RANGE = [30000, 110000];
export const PRESSURE_HPA_RANGE = [300, 1100];
export const ALTITUDE_RANGE = [-500, 9000];
// The same in imperial units (config and editor): ft and inHg, from the
// metric limits so a converted value is always accepted.
export const ALTITUDE_RANGE_FT = [Math.floor(ALTITUDE_RANGE[0] / 0.3048), Math.ceil(ALTITUDE_RANGE[1] / 0.3048)];
export const PRESSURE_INHG_RANGE = [
    Math.floor((PRESSURE_PA_RANGE[0] / 3386.389) * 100) / 100,
    Math.ceil((PRESSURE_PA_RANGE[1] / 3386.389) * 100) / 100,
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Relative humidity as a fraction 0..1. Home Assistant humidity sensors report
// percent; a value is only taken as a fraction when the unit says nothing and
// all values of the series are ≤ 1.
export function humidityFraction(values, unit) {
    if (unit === '%') return values.map((v) => v / 100);
    const max = Math.max(...values.filter(Number.isFinite));
    return max <= 1 ? values : values.map((v) => v / 100);
}

// Mean temperature (°C, whatever the sensor's unit) and relative humidity
// (0..1) per completed day, for the last `days` days, in the day buckets of
// the Home Assistant server. The current, partial day is left out: it is the
// bucket that has not ended yet, which works in any browser time zone.
// Returns [{ date, t, phi }] sorted by date; [] when there are no statistics.
export async function fetchDailyMeans(hass, temperatureEntity, humidityEntity, days) {
    const now = Date.now();
    const result = await withTimeout(
        hass.callWS({
            type: 'recorder/statistics_during_period',
            start_time: new Date(now - (days + 2) * DAY_MS).toISOString(),
            end_time: new Date(now).toISOString(),
            statistic_ids: [temperatureEntity, humidityEntity],
            period: 'day',
            types: ['mean'],
            // Convert to °C on the server, so Fahrenheit sensors work too.
            units: { temperature: '°C' },
        }),
        FETCH_TIMEOUT_MS,
    );
    const tRows = result?.[temperatureEntity] || [];
    const hRows = result?.[humidityEntity] || [];
    // `start` is epoch ms on current HA (ISO strings on old versions).
    const ts = (v) => (typeof v === 'number' ? v : Date.parse(v));
    const hUnit = hass.states?.[humidityEntity]?.attributes?.unit_of_measurement;
    const hFrac = humidityFraction(
        hRows.map((r) => (typeof r.mean === 'number' ? r.mean : NaN)),
        hUnit,
    );
    const byDay = new Map();
    for (const r of tRows) byDay.set(ts(r.start), { date: new Date(ts(r.start)), t: r.mean });
    hRows.forEach((r, i) => {
        const e = byDay.get(ts(r.start));
        if (e) e.phi = hFrac[i];
    });
    return [...byDay.entries()]
        .filter(
            ([start, e]) =>
                start + DAY_MS <= now && // completed days only
                Number.isFinite(e.t) &&
                Number.isFinite(e.phi),
        )
        .map(([, e]) => e)
        .sort((a, b) => a.date - b.date)
        .slice(-days);
}

// Rejects with an Error whose `code` is 'timeout' when `promise` has not
// settled after `ms`. A late answer is ignored.
export function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(`no answer after ${Math.round(ms / 1000)} s`);
            err.code = 'timeout';
            reject(err);
        }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Live sensor value in °C (state objects carry their own unit).
export function stateCelsius(stateObj) {
    const v = parseFloat(stateObj?.state);
    if (!Number.isFinite(v)) return NaN;
    return stateObj?.attributes?.unit_of_measurement === '°F' ? ((v - 32) * 5) / 9 : v;
}

// Live relative humidity as a fraction 0..1, or NaN.
export function stateHumidity(stateObj) {
    const v = parseFloat(stateObj?.state);
    if (!Number.isFinite(v)) return NaN;
    return humidityFraction([v], stateObj?.attributes?.unit_of_measurement)[0];
}

// Entity ids from the list that do not exist in Home Assistant (typos,
// removed sensors). Empty while hass has no states yet.
export function missingEntities(hass, ids) {
    if (!hass?.states || !Object.keys(hass.states).length) return [];
    return ids.filter((id) => id && !hass.states[id]);
}

export const SEA_LEVEL_PA = 101325;

// Air pressure in Pa at an altitude in m (international standard atmosphere).
export function pressureAtAltitude(m) {
    return SEA_LEVEL_PA * Math.pow(1 - 2.25577e-5 * m, 5.25588);
}

const inRange = (v, [lo, hi]) => Number.isFinite(v) && v >= lo && v <= hi;

// Air pressure in Pa from the card config: `altitude` (m) wins when it is a real
// number; `pressure` is accepted in hPa (< 2000) or Pa. Throws on values outside
// what is physically sensible, so a wrong unit is caught instead of silently
// drawing nonsense. Neither set → `fallback` (null: take it from Home Assistant,
// see airPressure()). With the imperial unit system, `altitude` is in ft and
// `pressure` in inHg.
export function pressureFromConfig(config, fallback = SEA_LEVEL_PA, system = 'metric') {
    const imperial = system === 'imperial';
    const alt = config.altitude;
    if (alt !== undefined && alt !== null && alt !== '') {
        const a = Number(alt);
        const range = imperial ? ALTITUDE_RANGE_FT : ALTITUDE_RANGE;
        if (!inRange(a, range)) {
            throw new Error(
                `altitude must be in ${imperial ? 'feet' : 'metres'} between ${range[0]} and ${range[1]} (got ${alt})`,
            );
        }
        return pressureAtAltitude(imperial ? ftToM(a) : a);
    }
    const pr = config.pressure;
    if (pr === undefined || pr === null || pr === '') return fallback;
    if (imperial) {
        const inhg = Number(pr);
        if (!inRange(inhg, PRESSURE_INHG_RANGE)) {
            const [i0, i1] = PRESSURE_INHG_RANGE;
            throw new Error(`pressure must be in inHg (${i0}–${i1}) (got ${pr})`);
        }
        return inhgToPa(inhg);
    }
    let p = Number(pr);
    if (Number.isFinite(p) && p > 0 && p < 2000) p *= 100; // hPa → Pa
    if (!Number.isFinite(p) || p < PRESSURE_PA_RANGE[0] || p > PRESSURE_PA_RANGE[1]) {
        const [h0, h1] = PRESSURE_HPA_RANGE;
        const [p0, p1] = PRESSURE_PA_RANGE;
        throw new Error(`pressure must be in hPa (${h0}–${h1}) or Pa (${p0}–${p1}) (got ${pr})`);
    }
    return p;
}

// The elevation set in Home Assistant (Settings → System → General), in m, or
// null when it is missing or outside ALTITUDE_RANGE.
export function elevationOf(hass) {
    const e = hass?.config?.elevation;
    if (e === undefined || e === null || e === '' || typeof e === 'boolean') return null;
    const m = Number(e);
    return inRange(m, ALTITUDE_RANGE) ? m : null;
}

// The air pressure a card works with: `altitude` from the config, else
// `pressure` from the config, else the elevation set in Home Assistant, else
// sea level (config values in the units of `system`). Returns { pa, altitude
// (always m, or null when only a pressure is known),
// source: 'altitude' | 'pressure' | 'home' | 'default' }. The config must have
// passed pressureFromConfig() (it throws on invalid values).
export function airPressure(config, hass, system = 'metric') {
    const given = (v) => v !== undefined && v !== null && v !== '';
    if (given(config?.altitude)) {
        const altitude = system === 'imperial' ? ftToM(Number(config.altitude)) : Number(config.altitude);
        return { pa: pressureAtAltitude(altitude), altitude, source: 'altitude' };
    }
    if (given(config?.pressure)) {
        return { pa: pressureFromConfig(config, undefined, system), altitude: null, source: 'pressure' };
    }
    const elevation = elevationOf(hass);
    if (elevation !== null) return { pa: pressureAtAltitude(elevation), altitude: elevation, source: 'home' };
    // No (valid) elevation in Home Assistant: sea level, but no altitude to show.
    return { pa: SEA_LEVEL_PA, altitude: null, source: 'default' };
}

// days_to_show, 1..MAX_DAYS.
export function daysFromConfig(config, fallback) {
    const raw = config.days_to_show;
    if (raw === undefined || raw === null || raw === '') return fallback;
    const d = Math.round(Number(raw));
    if (!Number.isFinite(d) || d < 1) throw new Error(`days_to_show must be a whole number ≥ 1 (got ${raw})`);
    return Math.min(d, MAX_DAYS);
}
