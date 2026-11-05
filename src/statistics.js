// Daily means from Home Assistant's long-term statistics. Shared with
// retomarek/comfort-compass-card (keep both copies identical).

// Re-fetch interval while the card is on screen: a new day appears in the
// statistics shortly after midnight, so hourly is plenty.
export const REFRESH_MS = 60 * 60 * 1000;

// Mean temperature (°C, whatever the sensor's unit) and relative humidity
// (0..1) per completed local day, for the last `days` days. Today is left out:
// its mean would cover only part of the day.
// Returns [{ date, t, phi }] sorted by date; [] when there are no statistics.
export async function fetchDailyMeans(hass, temperatureEntity, humidityEntity, days) {
    const end = new Date();
    end.setHours(0, 0, 0, 0);                       // today's midnight: completed days only
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    const result = await hass.callWS({
        type: 'recorder/statistics_during_period',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        statistic_ids: [temperatureEntity, humidityEntity],
        period: 'day',
        types: ['mean'],
        // Convert to °C on the server, so Fahrenheit sensors work too.
        units: { temperature: '°C' },
    });
    const tRows = result?.[temperatureEntity] || [];
    const hRows = result?.[humidityEntity] || [];
    // `start` is epoch ms on current HA (ISO strings on old versions): key by the timestamp.
    const ts = (v) => (typeof v === 'number' ? v : Date.parse(v));
    const byDay = new Map();
    for (const r of tRows) byDay.set(ts(r.start), { date: new Date(ts(r.start)), t: r.mean });
    for (const r of hRows) {
        const e = byDay.get(ts(r.start));
        if (e) e.rh = r.mean;
    }
    return [...byDay.values()]
        .filter((e) => Number.isFinite(e.t) && Number.isFinite(e.rh))
        .map((e) => ({ date: e.date, t: e.t, phi: e.rh > 1 ? e.rh / 100 : e.rh }))
        .sort((a, b) => a.date - b.date);
}

// Live sensor value in °C (state objects carry their own unit).
export function stateCelsius(stateObj) {
    const v = parseFloat(stateObj?.state);
    if (!Number.isFinite(v)) return NaN;
    return stateObj?.attributes?.unit_of_measurement === '°F' ? (v - 32) * 5 / 9 : v;
}
