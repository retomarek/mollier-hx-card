// Synthetic, reproducible room climates for the demo. Every preset has its own
// sensor entity ids (so the cards fetch again when it changes), a window of
// daily means and the live values the sliders start from.

const DAY_MS = 24 * 60 * 60 * 1000;
const P = 96034; // Pa, 450 m above sea level, as in the demo config

// Park–Miller generator: the same numbers on every load.
function rng(seed) {
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Saturation pressure (Magnus, Pa) and conversions between relative humidity
// (%) and absolute humidity (kg/kg dry air). Close enough for sample data.
const ps = (t) => 611.2 * Math.exp((17.62 * t) / (243.12 + t));
const xFromRh = (t, rh) => (0.622 * (rh / 100) * ps(t)) / (P - (rh / 100) * ps(t));
const rhFromX = (t, x) => clamp((100 * x * P) / (ps(t) * (0.622 + x)), 5, 99);

const localMidnight = (d) => {
    const m = new Date(d);
    m.setHours(0, 0, 0, 0);
    return m;
};
const dayOfYear = (d) => (d - new Date(d.getFullYear(), 0, 1)) / DAY_MS;
// +1 in mid-July, −1 in mid-January.
const season = (d) => Math.cos(((dayOfYear(d) - 200) / 365) * 2 * Math.PI);

// Swiss Plateau outside air, daily means.
function outdoor(d, r) {
    const s = season(d);
    const t = 9.5 + 10 * s + (r() - 0.5) * 7;
    const rh = clamp(79 - 11 * s + (r() - 0.5) * 18, 38, 97);
    return { t, rh, x: xFromRh(t, rh) };
}

const g = (gkg) => gkg / 1000;

export const PRESETS = [
    {
        id: 'living',
        name: 'Living room',
        hint: 'Mostly comfortable all year, a few warm summer days.',
        seed: 11,
        last: 'yesterday',
        days: 365,
        room(d, out, r) {
            const s = season(d);
            const t = 21.7 + 2.4 * Math.max(s, 0) + (r() - 0.5) * 1.8 + (r() < 0.05 ? 2.2 : 0);
            const x = out.x + g(2.6 + (r() - 0.5) * 1.2);
            return { t, rh: rhFromX(t, x) };
        },
        now: { t: 22.1, rh: 46, outT: 5.5, outH: 86 },
    },
    {
        id: 'dry_winter',
        name: 'Dry winter',
        hint: 'Heated to 23 °C and aired with cold outside air: far too dry.',
        seed: 23,
        last: '2026-03-10',
        days: 120,
        room(d, out, r) {
            const t = 22.9 + (r() - 0.5) * 1.6;
            const x = out.x + g(1.1 + (r() - 0.5) * 0.8);
            return { t, rh: rhFromX(t, x) };
        },
        now: { t: 23.2, rh: 24, outT: -1.5, outH: 82 },
    },
    {
        id: 'cellar',
        name: 'Damp cellar',
        hint: 'Cool walls and humid summer air: condensation and mould risk.',
        seed: 37,
        last: 'yesterday',
        days: 365,
        room(d, out, r) {
            const s = season(d);
            const t = 13 + 3.6 * s + (r() - 0.5) * 1.4;
            const x = Math.max(out.x, g(5)) + g(1.2 + (r() - 0.5) * 0.8);
            return { t, rh: rhFromX(t, x) };
        },
        now: { t: 12.4, rh: 74, outT: 5.5, outH: 86 },
    },
    {
        id: 'attic',
        name: 'Hot attic',
        hint: 'A room under the roof in summer: warm, often warm and dry.',
        seed: 41,
        last: '2026-09-20',
        days: 120,
        room(d, out, r) {
            const s = season(d);
            const heat = r() < 0.18 ? 2.5 + r() * 2 : 0;
            const t = 24.6 + 4.2 * s + (r() - 0.5) * 3 + heat;
            const x = out.x + g(0.8 + (r() - 0.5) * 1.0);
            return { t, rh: rhFromX(t, x) };
        },
        now: { t: 29.4, rh: 41, outT: 31, outH: 38 },
    },
    {
        id: 'new_build',
        name: 'New-build bedroom',
        hint: 'A bedroom in a building that is still drying out: humid, mould risk.',
        seed: 53,
        last: '2026-03-31',
        days: 180,
        room(d, out, r) {
            const t = 20.6 + (r() - 0.5) * 2 + (r() < 0.08 ? -1.8 : 0);
            const x = out.x + g(6.4 + (r() - 0.5) * 2.4);
            return { t, rh: rhFromX(t, x) };
        },
        now: { t: 20.8, rh: 70, outT: 3, outH: 88 },
    },
];

export function entities(preset) {
    return {
        t: `sensor.${preset.id}_temperature`,
        h: `sensor.${preset.id}_humidity`,
        outT: `sensor.${preset.id}_outside_temperature`,
        outH: `sensor.${preset.id}_outside_humidity`,
    };
}

// Daily means as Home Assistant's recorder returns them:
// { entity_id: [{ start: epoch ms of local midnight, mean }] }, oldest first.
// Presets that end "yesterday" also get today's (incomplete) bucket, which the
// cards leave out, like in Home Assistant.
export function dailyMeans(preset) {
    const r = rng(preset.seed);
    const ids = entities(preset);
    const out = { [ids.t]: [], [ids.h]: [], [ids.outT]: [], [ids.outH]: [] };
    const today = localMidnight(new Date());
    const lastDay =
        preset.last === 'yesterday'
            ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
            : localMidnight(new Date(`${preset.last}T12:00:00`));
    const count = preset.days + (preset.last === 'yesterday' ? 1 : 0);
    for (let i = preset.days - 1; i >= -(count - preset.days); i--) {
        const d = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() - i);
        const o = outdoor(d, r);
        const room = preset.room(d, o, r);
        const start = d.getTime();
        out[ids.t].push({ start, mean: +room.t.toFixed(2) });
        out[ids.h].push({ start, mean: +room.rh.toFixed(1) });
        out[ids.outT].push({ start, mean: +o.t.toFixed(2) });
        out[ids.outH].push({ start, mean: +o.rh.toFixed(1) });
    }
    return out;
}
