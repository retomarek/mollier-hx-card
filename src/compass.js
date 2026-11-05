// Comfort compass + warning bands.
//
// Port of pyedautils' comfort_compass_distribution() (pyedautils/comfort.py)
// and plot_comfort_compass() (pyedautils/plots/comfort.py) to Lit/SVG. The
// glyph is area-true: the green centre disc's area is the share of days in the
// comfort zone, each of the eight wedges' area is the share of days deviating
// in that direction, split radially into mild / moderate / severe.
//
// The severity stages are the warning bands: "mild" = outside the comfort
// zone but inside the orange band, "moderate" = inside the red band, "severe"
// = outside the red band. The same bands are drawn as dashed outlines in the
// Mollier diagram, so diagram and compass always agree.

import { html, svg, nothing } from 'lit';

// pyedautils defaults (temp_stage_limits, hum_stage_limits, hum_abs_stage_limits).
// Offsets around the comfort zone: K, %-points RH, g/kg.
export const DEFAULT_BANDS = {
    orange: { dt: 1.0, dphi: 5, dx: 1.0, color: '#E67E22', label: null },
    red: { dt: 2.5, dphi: 10, dx: 2.5, color: '#C0392B', label: null },
};

const num = (v, fb) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fb);

// `warning_bands: true` → defaults; an object overrides per band; anything
// falsy → null (no bands drawn, compass falls back to the defaults).
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

// --- classification (pyedautils.comfort.comfort_compass_distribution) ------

const DIRS = ['f', 'wf', 'w', 'wt', 't', 'ct', 'c', 'kf'];   // at 0,45,…,315° (0 = humid/right, CCW)
const STAGES = ['l', 'd', 's'];
const STATE_MAP = {
    '0,0': 'ok', '1,0': 'w', '1,1': 'wf', '0,1': 'f', '-1,1': 'kf',
    '-1,0': 'c', '-1,-1': 'ct', '0,-1': 't', '1,-1': 'wt',
};

function level(exc, l1, l2) {
    if (exc <= 0) return 0;
    if (exc <= l1) return 1;
    if (exc <= l2) return 2;
    return 3;
}

// records: [{t: °C, phi: 0..1}] (daily means) → {ok, f_l, f_d, …} counts.
export function compassDistribution(records, cz, bands, pressure, mollier) {
    const b = bands || parseWarningBands(true);
    const out = { ok: 0 };
    for (const k of DIRS) for (const st of STAGES) out[`${k}_${st}`] = 0;

    const [tLo, tHi] = cz.range_t;
    const hLo = cz.range_phi[0] * 100, hHi = cz.range_phi[1] * 100;
    const [xLo, xHi] = cz.range_x;
    const tl = [b.orange.dt, b.red.dt];
    const hl = [b.orange.dphi, b.red.dphi];
    const xl = [b.orange.dx / 1000, b.red.dx / 1000];

    for (const r of records) {
        const t = r.t, h = r.phi * 100;
        if (!Number.isFinite(t) || !Number.isFinite(h)) continue;
        const ti = t < tLo ? -1 : t > tHi ? 1 : 0;
        const tExc = ti === 1 ? t - tHi : ti === -1 ? tLo - t : 0;
        const tLevel = level(tExc, tl[0], tl[1]);

        // Humidity: relative OR absolute (comfort zone's x cap), like pyedautils with hum_abs_band.
        const xa = mollier.get_x_y(t, r.phi, pressure).x;
        const hi = (h > hHi || xa > xHi) ? 1 : (h < hLo || xa < xLo) ? -1 : 0;
        const relExc = hi === 1 ? h - hHi : hi === -1 ? hLo - h : 0;
        const absExc = hi === 1 ? xa - xHi : hi === -1 ? xLo - xa : 0;
        const hLevel = Math.max(level(relExc, hl[0], hl[1]), level(absExc, xl[0], xl[1]));

        const lvl = Math.max(tLevel, hLevel);
        const stage = lvl <= 1 ? 'l' : lvl <= 2 ? 'd' : 's';
        const state = STATE_MAP[`${ti},${hi}`];
        out[state === 'ok' ? 'ok' : `${state}_${stage}`] += 1;
    }
    return out;
}

// --- glyph (pyedautils.plots.comfort.plot_comfort_compass) -------------------

const OK_COLOR = '#22C55E';
const STAGE_COLORS = {
    w: { l: '#e49e93', d: '#cf6e60', s: '#b04336' },
    wf: { l: '#dc9dbb', d: '#c66d9a', s: '#a64278' },
    f: { l: '#baa7e2', d: '#9a7ccf', s: '#7954b3' },
    kf: { l: '#9eb0ea', d: '#7289da', s: '#4e63bf' },
    c: { l: '#82b9e5', d: '#3d96d4', s: '#0072af' },
    ct: { l: '#afb982', d: '#8b955f', s: '#69713d' },
    t: { l: '#d6a977', d: '#bf7f29', s: '#965d00' },
    wt: { l: '#e0a383', d: '#cb7545', s: '#ab4b00' },
};
const STAGE_GREYS = { l: '#b2b2b2', d: '#8e8e8e', s: '#6c6c6c' };
const THETA = [0, 45, 90, 135, 180, 225, 270, 315];
const R0 = 1.0;
const AREA = Math.PI * R0 * R0;
const WID_DEG = 40;
const WID_RAD = (WID_DEG * Math.PI) / 180;
const RMAX = Math.sqrt((2 * AREA) / WID_RAD) * 1.04;
const R_RANGE = RMAX * 1.15;         // fixed_scale: same reference-circle size in every card
const PX = 100;                      // screen radius of R_RANGE
const K = PX / R_RANGE;

const rad = (deg) => (deg * Math.PI) / 180;
// Polar (r in glyph units, deg CCW from east) → SVG coordinates (y down).
const pt = (r, deg) => [r * K * Math.cos(rad(deg)), -r * K * Math.sin(rad(deg))];
const f2 = (v) => v.toFixed(2);

function sectorPath(r1, r2, deg) {
    const a0 = deg - WID_DEG / 2, a1 = deg + WID_DEG / 2;
    const [ox0, oy0] = pt(r2, a0), [ox1, oy1] = pt(r2, a1);
    const R2 = r2 * K;
    let d = `M${f2(ox0)},${f2(oy0)}A${f2(R2)},${f2(R2)} 0 0 0 ${f2(ox1)},${f2(oy1)}`;
    if (r1 < 1e-9) return `${d}L0,0Z`;
    const [ix1, iy1] = pt(r1, a1), [ix0, iy0] = pt(r1, a0);
    const R1 = r1 * K;
    return `${d}L${f2(ix1)},${f2(iy1)}A${f2(R1)},${f2(R1)} 0 0 1 ${f2(ix0)},${f2(iy0)}Z`;
}

// Outward text placement per direction (plotly textposition in pyedautils).
const LABEL_POS = [
    { anchor: 'start', v: 'middle' }, { anchor: 'start', v: 'top' }, { anchor: 'middle', v: 'top' },
    { anchor: 'end', v: 'top' }, { anchor: 'end', v: 'middle' }, { anchor: 'end', v: 'bottom' },
    { anchor: 'middle', v: 'bottom' }, { anchor: 'start', v: 'bottom' },
];

// t(key, vars) is the card's localize() bound to hass.
export function renderCompass(dist, t) {
    const g = (k) => Number(dist[k] || 0);
    const total = Object.values(dist).reduce((a, v) => a + Number(v || 0), 0);
    const frac = (k) => (total ? g(k) / total : 0);
    const unit = (cnt) => (Math.round(cnt) === 1 ? t('compass.day') : t('compass.days'));
    const name = (k) => t(`compass.names.${k}`);
    const stage = (st) => t(`compass.stages.${st}`);
    const pct = (cnt) => (total ? ((cnt / total) * 100).toFixed(0) : '0');
    const tip = (name, cnt) => `${name}\n${Math.round(cnt)} ${unit(cnt)} (${pct(cnt)}%)`;

    const ok = frac('ok');
    const rGreen = R0 * Math.sqrt(Math.max(ok, 0));

    // Area-true stacked wedges: cumulative area (WID/2)(r²−rg²) = share·AREA.
    const wedges = [];
    let rMax = Math.max(rGreen, R0);
    DIRS.forEach((k, i) => {
        let cum = 0, rPrev = rGreen;
        for (const st of STAGES) {
            const cnt = g(`${k}_${st}`);
            cum += frac(`${k}_${st}`);
            const rNext = Math.sqrt(rGreen * rGreen + (2 * AREA * cum) / WID_RAD);
            if (rNext > rPrev + 1e-9) {
                wedges.push({ d: sectorPath(rPrev, rNext, THETA[i]), color: STAGE_COLORS[k][st], tip: tip(`${name(k)} · ${stage(st)}`, cnt) });
            }
            rPrev = rNext;
        }
        rMax = Math.max(rMax, rPrev);
    });
    const rLab = Math.min(rMax + 0.25, RMAX * 1.07);

    const labels = THETA.map((deg, i) => {
        const [x, y] = pt(rLab, deg);
        const lines = t(`compass.labels.${DIRS[i]}`).split('\n');
        const pos = LABEL_POS[i];
        const lh = 12;
        const first = pos.v === 'top' ? -(lines.length - 1) * lh - 2 : pos.v === 'bottom' ? lh : -((lines.length - 1) * lh) / 2 + 4;
        const dx = pos.anchor === 'start' ? 3 : pos.anchor === 'end' ? -3 : 0;
        return svg`<text x=${f2(x + dx)} y=${f2(y + first)} text-anchor=${pos.anchor} fill=${STAGE_COLORS[DIRS[i]].s} font-size="11">
            ${lines.map((l, j) => svg`<tspan x=${f2(x + dx)} dy=${j === 0 ? 0 : lh}>${l}</tspan>`)}</text>`;
    });

    const refCircle = svg`<circle r=${f2(R0 * K)} fill="none" stroke="#cccccc" stroke-width="0.8" stroke-dasharray="2,2"></circle>`;

    // Legend rows: in range first, then deviations by count (largest first).
    const rows = [{ k: 'ok', cnt: g('ok'), color: OK_COLOR, split: null }];
    const devs = [];
    for (const k of DIRS) {
        const cnt = STAGES.reduce((a, st) => a + g(`${k}_${st}`), 0);
        if (cnt > 0) devs.push({ k, cnt, color: STAGE_COLORS[k].d, split: STAGES.map((st) => pct(g(`${k}_${st}`))).join('/') });
    }
    devs.sort((a, b) => b.cnt - a.cnt);
    rows.push(...devs);

    return html`
        <div class="compass">
            <div class="compass-title">${t('compass.title')} <span class="muted">· ${Math.round(total)} ${unit(total)}</span></div>
            <div class="compass-body">
                <svg class="compass-glyph" viewBox="-175 -135 350 270" role="img" aria-label=${t('compass.title')}>
                    ${refCircle}
                    ${rGreen > 0 ? svg`<circle r=${f2(rGreen * K)} fill=${OK_COLOR} stroke="white" stroke-width="1.5"><title>${tip(name('ok'), g('ok'))}</title></circle>` : nothing}
                    ${wedges.map((w) => svg`<path d=${w.d} fill=${w.color} stroke="white" stroke-width="1.5"><title>${w.tip}</title></path>`)}
                    ${ok * 100 >= 15 ? svg`<text y="5" text-anchor="middle" fill="white" font-size="14" pointer-events="none">${(ok * 100).toFixed(0)}%</text>` : nothing}
                    ${labels}
                </svg>
                <div class="compass-legend">
                    ${rows.map((r) => html`
                        <div><span class="dot" style="color:${r.color}">●</span> ${name(r.k)} — <b>${Math.round(r.cnt)}</b> ${unit(r.cnt)}
                            <span class="muted">(${pct(r.cnt)}%${r.split ? html` → ${r.split}%` : nothing})</span></div>`)}
                    ${devs.length ? html`
                        <div class="stage-key">
                            ${STAGES.map((st, i) => html`${i ? html`<span class="muted"> / </span>` : nothing}<span class="dot" style="color:${STAGE_GREYS[st]}">●</span> <span class="muted">${stage(st)}</span>`)}
                        </div>` : nothing}
                </div>
            </div>
        </div>
    `;
}
