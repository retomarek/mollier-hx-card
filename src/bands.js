// Warning bands: orange / red ± offsets around the comfort zone.
// Shared by retomarek/comfort-compass-card (where the bands are the severity
// stages mild / moderate / severe) and retomarek/mollier-hx-card (where they are
// drawn as dashed outlines around the comfort zone). Keep both copies identical;
// `npm run check-shared` compares them.

import { DEFAULT_BAND_VALUES, UNITS } from './units.js';

// pyedautils defaults (temp_stage_limits, hum_stage_limits, hum_abs_stage_limits).
// Offsets around the comfort zone, internal units: K, %-points RH, g/kg.
export const DEFAULT_BANDS = {
    orange: { dt: 1.0, dphi: 5, dx: 1.0, color: '#E67E22', label: null },
    red: { dt: 2.5, dphi: 10, dx: 2.5, color: '#C0392B', label: null },
};

const num = (v, fb) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fb);

// `warning_bands: true` → defaults; an object overrides per band; anything
// falsy → null (no bands drawn; the compass then uses the defaults). The
// config's offsets are in the units of `system` (metric: K and g/kg; imperial:
// °F and gr/lb); the result is always in K, %-points and g/kg.
export function parseWarningBands(cfg, system = 'metric') {
    if (!cfg) return null;
    const src = cfg === true ? {} : cfg;
    const u = UNITS[system] || UNITS.metric;
    const defaults = DEFAULT_BAND_VALUES[system] || DEFAULT_BAND_VALUES.metric;
    const out = {};
    for (const key of ['orange', 'red']) {
        const d = DEFAULT_BANDS[key];
        const dv = defaults[key];
        const b = src[key] || {};
        out[key] = {
            dt: Math.abs(u.delta.toK(num(b.temperature, dv.temperature))),
            dphi: Math.abs(num(b.humidity, dv.humidity)),
            dx: Math.abs(u.absHumidity.toGkg(num(b.absolute_humidity, dv.absolute_humidity))),
            color: typeof b.color === 'string' && b.color ? b.color : d.color,
            label: typeof b.label === 'string' && b.label ? b.label : null,
        };
    }
    // The red band must enclose the orange one, otherwise the stages overlap.
    out.red.dt = Math.max(out.red.dt, out.orange.dt);
    out.red.dphi = Math.max(out.red.dphi, out.orange.dphi);
    out.red.dx = Math.max(out.red.dx, out.orange.dx);
    return out;
}

// Absolute ranges (internal units: °C, 0..1, kg/kg) of a band around the
// parsed comfort zone, ready for createComfort().
export function bandRanges(cz, band) {
    return {
        range_t: [cz.range_t[0] - band.dt, cz.range_t[1] + band.dt],
        range_phi: [Math.max(0, cz.range_phi[0] - band.dphi / 100), Math.min(1, cz.range_phi[1] + band.dphi / 100)],
        range_x: [Math.max(0, cz.range_x[0] - band.dx / 1000), cz.range_x[1] + band.dx / 1000],
    };
}
