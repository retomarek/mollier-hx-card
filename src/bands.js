// Warning bands: orange / red ± offsets around the comfort zone.
// Same schema and defaults as the comfort-compass-card, where the bands are
// the severity stages (mild / moderate / severe). Keep both copies in sync.

// pyedautils defaults (temp_stage_limits, hum_stage_limits, hum_abs_stage_limits).
// Offsets around the comfort zone: K, %-points RH, g/kg.
export const DEFAULT_BANDS = {
    orange: { dt: 1.0, dphi: 5, dx: 1.0, color: '#E67E22', label: null },
    red: { dt: 2.5, dphi: 10, dx: 2.5, color: '#C0392B', label: null },
};

const num = (v, fb) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fb);

// `warning_bands: true` → defaults; an object overrides per band; anything
// falsy → null (no bands drawn).
export function parseWarningBands(cfg) {
    if (!cfg) return null;
    const src = cfg === true ? {} : cfg;
    const out = {};
    for (const key of ['orange', 'red']) {
        const d = DEFAULT_BANDS[key];
        const b = src[key] || {};
        out[key] = {
            dt: Math.abs(num(b.temperature, d.dt)),
            dphi: Math.abs(num(b.humidity, d.dphi)),
            dx: Math.abs(num(b.absolute_humidity, d.dx)),
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
