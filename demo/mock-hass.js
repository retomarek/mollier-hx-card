// A small stand-in for Home Assistant's `hass` object: the states of the
// demo sensors, language, theme and the one WebSocket call the cards make
// (recorder/statistics_during_period). Like Home Assistant, the demo hands
// the cards a new object on every change.

const DAY_MS = 24 * 60 * 60 * 1000;

function sensor(entityId, state, unit, deviceClass, name) {
    return {
        entity_id: entityId,
        state: String(state),
        attributes: {
            unit_of_measurement: unit,
            device_class: deviceClass,
            state_class: 'measurement',
            friendly_name: name,
        },
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString(),
    };
}

// `rooms`: [{ ids: { t, h, outT, outH }, live: { t, rh, outT, outH }, name }],
// the sensors of every sample room (like a real Home Assistant, all of them
// exist at the same time). `stats`: { entity_id: [{ start, mean }] } for all.
export function createHass({ rooms, stats, language, dark, elevation, onFetch }) {
    const states = {};
    for (const { ids, live, name } of rooms) {
        states[ids.t] = sensor(ids.t, live.t.toFixed(1), '°C', 'temperature', `${name} temperature`);
        states[ids.h] = sensor(ids.h, Math.round(live.rh), '%', 'humidity', `${name} humidity`);
        states[ids.outT] = sensor(ids.outT, live.outT.toFixed(1), '°C', 'temperature', `${name} outside temperature`);
        states[ids.outH] = sensor(ids.outH, Math.round(live.outH), '%', 'humidity', `${name} outside humidity`);
    }
    return {
        language,
        locale: { language, number_format: 'language', time_format: 'language' },
        themes: { darkMode: dark },
        config: {
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            unit_system: { temperature: '°C' },
            // Settings → System → General → Elevation: the cards take it when
            // their config has neither altitude nor pressure.
            elevation,
        },
        states,
        async callWS(msg) {
            if (msg.type !== 'recorder/statistics_during_period') throw new Error(`Unsupported call ${msg.type}`);
            // The period the card asks for, in whole days (it asks for a little more
            // than days_to_show and drops today's incomplete bucket itself).
            const days = Math.ceil((Date.parse(msg.end_time) - Date.parse(msg.start_time)) / DAY_MS);
            const out = {};
            for (const id of msg.statistic_ids) if (stats[id]) out[id] = stats[id].slice(-days);
            onFetch?.(msg);
            // A short delay, like a real round trip.
            await new Promise((r) => setTimeout(r, 120));
            return out;
        },
    };
}
