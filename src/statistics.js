// Daily means from Home Assistant's long-term statistics, and the live
// sensor values. Shared with retomarek/comfort-compass-card and
// retomarek/mollier-hx-card: keep both copies identical.

// Re-fetch interval while the card is on screen: a new day appears in the
// statistics shortly after midnight, so hourly is plenty.
export const REFRESH_MS = 60 * 60 * 1000;
// After a failed fetch: retry soon, then back off (30 s, 1, 2, 4, 8, 10 min).
export const RETRY_MS = [30e3, 60e3, 120e3, 240e3, 480e3, 600e3];
// Upper bound for days_to_show (long-term statistics are kept forever, but
// a very long request is slow and the diagram gets crowded).
export const MAX_DAYS = 3650;

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
    const result = await hass.callWS({
        type: 'recorder/statistics_during_period',
        start_time: new Date(now - (days + 2) * DAY_MS).toISOString(),
        end_time: new Date(now).toISOString(),
        statistic_ids: [temperatureEntity, humidityEntity],
        period: 'day',
        types: ['mean'],
        // Convert to °C on the server, so Fahrenheit sensors work too.
        units: { temperature: '°C' },
    });
    const tRows = result?.[temperatureEntity] || [];
    const hRows = result?.[humidityEntity] || [];
    // `start` is epoch ms on current HA (ISO strings on old versions).
    const ts = (v) => (typeof v === 'number' ? v : Date.parse(v));
    const hUnit = hass.states?.[humidityEntity]?.attributes?.unit_of_measurement;
    const hFrac = humidityFraction(hRows.map((r) => r.mean), hUnit);
    const byDay = new Map();
    for (const r of tRows) byDay.set(ts(r.start), { date: new Date(ts(r.start)), t: r.mean });
    hRows.forEach((r, i) => {
        const e = byDay.get(ts(r.start));
        if (e) e.phi = hFrac[i];
    });
    return [...byDay.entries()]
        .filter(([start, e]) => start + DAY_MS <= now                  // completed days only
            && Number.isFinite(e.t) && Number.isFinite(e.phi))
        .map(([, e]) => e)
        .sort((a, b) => a.date - b.date)
        .slice(-days);
}

// Live sensor value in °C (state objects carry their own unit).
export function stateCelsius(stateObj) {
    const v = parseFloat(stateObj?.state);
    if (!Number.isFinite(v)) return NaN;
    return stateObj?.attributes?.unit_of_measurement === '°F' ? (v - 32) * 5 / 9 : v;
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

// Air pressure in Pa from the card config: `altitude` (m) wins when it is a real
// number; `pressure` is accepted in hPa (< 2000) or Pa. Throws on values outside
// what is physically sensible, so a wrong unit is caught instead of silently
// drawing nonsense.
export function pressureFromConfig(config, fallback = 101325) {
    const alt = config.altitude;
    if (alt !== undefined && alt !== null && alt !== '') {
        const a = Number(alt);
        if (!Number.isFinite(a) || a < -500 || a > 9000) {
            throw new Error(`altitude must be in metres between -500 and 9000 (got ${alt})`);
        }
        return 101325 * Math.pow(1 - 2.25577e-5 * a, 5.25588);
    }
    const pr = config.pressure;
    if (pr === undefined || pr === null || pr === '') return fallback;
    let p = Number(pr);
    if (Number.isFinite(p) && p > 0 && p < 2000) p *= 100;          // hPa → Pa
    if (!Number.isFinite(p) || p < 30000 || p > 110000) {
        throw new Error(`pressure must be in hPa (300–1100) or Pa (30000–110000) (got ${pr})`);
    }
    return p;
}

// days_to_show, 1..MAX_DAYS.
export function daysFromConfig(config, fallback) {
    const raw = config.days_to_show;
    if (raw === undefined || raw === null || raw === '') return fallback;
    const d = Math.round(Number(raw));
    if (!Number.isFinite(d) || d < 1) throw new Error(`days_to_show must be a whole number ≥ 1 (got ${raw})`);
    return Math.min(d, MAX_DAYS);
}
