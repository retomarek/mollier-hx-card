import { html, LitElement, nothing } from 'lit';
import * as d3 from './d3_mollierhx/d3.js';
import { drawHXCoordinates } from './d3_mollierhx/coordinateGenerator.js';
import { createComfort } from './d3_mollierhx/drawComfort.js';
import { createMollier } from './d3_mollierhx/mollierFunctions.js';
import { parseWarningBands, bandRanges, compassDistribution, renderCompass } from './compass.js';
import { localize, getLanguage, DIAGRAM_CAPTIONS } from './localize/localize.js';
import styles from './card.styles';

const DEFAULT_PRESSURE = 101325;
const DEFAULT_DAYS = 7;
const DEFAULT_COLORING = 'season';
const DEFAULT_CONVENTION = 'classical';
const VALID_CONVENTIONS = ['classical', 'glueck'];
// Internal units are kg/kg for x and °C for y; user config is expressed in
// g/kg (x) and °C (y) — see _parseDomainX below.
const DEFAULT_DOMAIN_X = [0.0, 0.020];
const DEFAULT_DOMAIN_Y = [-20.0, 50.0];
const MARGIN = { top: 30, right: 60, bottom: 40, left: 50 };
const WIDTH = 600;
const HEIGHT = 420;

// Match pyedautils' DEFAULT_SEASON_COLORS so the card looks identical to the
// Python plot. (At 0.4 opacity, more saturated tones are needed — a desaturated
// brown like #8d6e63 fades to near-grey on a white background.)
const SEASON_COLORS = {
    spring: '#2db27d',
    summer: '#febc2b',
    autumn: '#824b04',
    winter: '#365c8d',
};

function seasonForMonth(month /* 0-11 */) {
    if (month === 11 || month <= 1) return 'winter';
    if (month <= 4) return 'spring';
    if (month <= 7) return 'summer';
    return 'autumn';
}

// International Standard Atmosphere — converts altitude [m above sea level]
// to ambient pressure [Pa]. Valid up to ~11 km (troposphere). Standard
// reference state: p₀ = 101325 Pa, T₀ = 288.15 K, L = 0.0065 K/m.
function pressureFromAltitude(altitudeM) {
    return 101325 * Math.pow(1 - 2.25577e-5 * altitudeM, 5.25588);
}

// Convert a user-supplied 2-element [min, max] domain to internal units; users
// give x in g/kg and y in °C, internal x is kg/kg (scale 1/1000) and y is °C
// (scale 1). Falls back to the default when the value is missing or malformed.
function parseDomain(input, fallback, scale) {
    if (!Array.isArray(input) || input.length !== 2 || !input.every(Number.isFinite)) {
        return fallback;
    }
    const [a, b] = input.map(Number);
    if (a === b) return fallback;
    const lo = Math.min(a, b) * scale;
    const hi = Math.max(a, b) * scale;
    return [lo, hi];
}

// Convert user-facing units (°C, %, g/kg) to the kg/kg + 0..1 units that
// createComfort() expects. Returns null when the config is absent or malformed.
function parseComfortZone(cz) {
    if (!cz) return null;
    const t = cz.temperature, h = cz.humidity, x = cz.absolute_humidity;
    const ok = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
    if (!ok(t) || !ok(h) || !ok(x)) return null;
    return {
        range_t: [Number(t[0]), Number(t[1])],
        range_phi: [Number(h[0]) / 100, Number(h[1]) / 100],
        range_x: [Number(x[0]) / 1000, Number(x[1]) / 1000],
    };
}

export class MollierHxCard extends LitElement {
    _hass;
    _drawn = false;
    _fetchKey = null;
    _dailyData = [];

    static get properties() {
        return {
            _header: { state: true },
            _tempEntity: { state: true },
            _humEntity: { state: true },
            _pressure: { state: true },
            _days: { state: true },
            _coloring: { state: true },
            _comfortZone: { state: true },
            _warningBands: { state: true },
            _showCompass: { state: true },
            _compassFixed: { state: true },
            _domainX: { state: true },
            _domainY: { state: true },
            _convention: { state: true },
            _currentPoint: { state: true },
            _error: { state: true },
        };
    }

    setConfig(config) {
        if (!config.temperature_entity) {
            throw new Error("temperature_entity is required");
        }
        if (!config.humidity_entity) {
            throw new Error("humidity_entity is required");
        }
        this._header = config.header === "" || config.header === undefined ? nothing : config.header;
        this._tempEntity = config.temperature_entity;
        this._humEntity = config.humidity_entity;
        // Altitude takes precedence over an explicit pressure if both are set.
        if (Number.isFinite(Number(config.altitude))) {
            this._pressure = pressureFromAltitude(Number(config.altitude));
        } else {
            this._pressure = Number(config.pressure) || DEFAULT_PRESSURE;
        }
        this._days = Math.max(1, Number(config.days) || DEFAULT_DAYS);
        this._coloring = config.coloring || DEFAULT_COLORING;
        this._comfortZone = parseComfortZone(config.comfort_zone);
        this._warningBands = parseWarningBands(config.warning_bands);
        this._showCompass = !!config.show_compass;
        this._compassFixed = config.compass_scale === 'fixed';
        this._domainX = parseDomain(config.domain_x, DEFAULT_DOMAIN_X, 1 / 1000);
        this._domainY = parseDomain(config.domain_y, DEFAULT_DOMAIN_Y, 1);
        this._convention = VALID_CONVENTIONS.includes(config.convention)
            ? config.convention
            : DEFAULT_CONVENTION;
        this._mollier = createMollier(this._convention);
        if (this._hass) this._maybeFetch();
    }

    set hass(hass) {
        const firstAttach = !this._hass;
        this._hass = hass;
        if (firstAttach && this._tempEntity) this._maybeFetch();
        this._updateCurrentPoint();
    }

    _updateCurrentPoint() {
        if (!this._hass || !this._tempEntity || !this._humEntity || !this._mollier) {
            this._currentPoint = null;
            return;
        }
        const ts = this._hass.states[this._tempEntity];
        const hs = this._hass.states[this._humEntity];
        if (!ts || !hs) { this._currentPoint = null; return; }
        const t = parseFloat(ts.state);
        const rh = parseFloat(hs.state);
        if (!Number.isFinite(t) || !Number.isFinite(rh)) { this._currentPoint = null; return; }
        const phi = rh > 1 ? rh / 100 : rh;
        const xy = this._mollier.get_x_y(t, phi, this._pressure);
        if (!Number.isFinite(xy.x) || !Number.isFinite(xy.y)) { this._currentPoint = null; return; }
        // Only update when the on-screen position would visibly change — avoids
        // re-rendering on every hass state churn (which fires for unrelated
        // entities too).
        const next = { x: xy.x, y: xy.y, t, phi };
        const prev = this._currentPoint;
        if (prev && prev.x === next.x && prev.y === next.y) return;
        this._currentPoint = next;
    }

    async _maybeFetch() {
        const key = `${this._tempEntity}|${this._humEntity}|${this._days}`;
        if (key === this._fetchKey) return;
        this._fetchKey = key;
        try {
            const end = new Date();
            const start = new Date(end.getTime() - this._days * 86400000);
            start.setHours(0, 0, 0, 0);
            const result = await this._hass.callWS({
                type: 'recorder/statistics_during_period',
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                statistic_ids: [this._tempEntity, this._humEntity],
                period: 'day',
                types: ['mean'],
            });
            const tRows = result[this._tempEntity] || [];
            const hRows = result[this._humEntity] || [];
            if (tRows.length === 0 || hRows.length === 0) {
                this._error = { key: 'card.no_statistics' };
                this._dailyData = [];
                this.requestUpdate();
                return;
            }
            const byDay = new Map();
            for (const r of tRows) {
                const k = String(r.start).slice(0, 10);
                byDay.set(k, { date: new Date(r.start), t: r.mean });
            }
            for (const r of hRows) {
                const k = String(r.start).slice(0, 10);
                const e = byDay.get(k);
                if (e) e.rh = r.mean;
            }
            this._dailyData = Array.from(byDay.values())
                .filter(e => Number.isFinite(e.t) && Number.isFinite(e.rh))
                .map(e => ({
                    date: e.date,
                    t: e.t,
                    phi: e.rh > 1 ? e.rh / 100 : e.rh,
                }))
                .sort((a, b) => a.date - b.date);
            this._error = undefined;
            this.requestUpdate();
        } catch (err) {
            this._error = { key: 'card.fetch_failed', vars: { error: (err && err.message) || err } };
            this.requestUpdate();
        }
    }

    static styles = styles;

    render() {
        return html`
            <ha-card header="${this._header}">
                <div class="card-content">
                    ${this._error
                        ? html`<p class="error">${this._t(this._error.key, this._error.vars)}</p>`
                        : html`
                            <div class="sheet">
                                <div class="diagram-wrap">
                                    <div class="mollier-host"></div>
                                    <div class="tooltip"></div>
                                </div>
                                ${this._renderZoneLegend()}
                                ${this._renderCompass()}
                            </div>
                          `}
                </div>
            </ha-card>
        `;
    }

    _t(key, vars) {
        return localize(this._hass, key, vars);
    }

    _renderZoneLegend() {
        if (!this._comfortZone || !this._warningBands) return nothing;
        const b = this._warningBands;
        const fmt = (o) => `±${o.dt} K / ±${o.dphi} % / ±${o.dx} g/kg`;
        return html`
            <div class="zone-legend">
                <span><i class="swatch fill"></i>${this._t('card.comfort_zone')}</span>
                ${['orange', 'red'].map((k) => html`
                    <span title=${fmt(b[k])}>
                        <i class="swatch dash" style="border-color:${b[k].color}"></i>${b[k].label || `${this._t(k === 'orange' ? 'card.warning_band' : 'card.alarm_band')} (${fmt(b[k])})`}
                    </span>`)}
            </div>
        `;
    }

    _renderCompass() {
        if (!this._showCompass) return nothing;
        if (!this._comfortZone) {
            return html`<p class="hint">${this._t('card.needs_comfort_zone')}</p>`;
        }
        if (this._dailyData.length === 0) return nothing;
        const dist = compassDistribution(
            this._dailyData, this._comfortZone, this._warningBands, this._pressure, this._mollier);
        return renderCompass(dist, (key, vars) => this._t(key, vars), { fixedScale: this._compassFixed });
    }

    firstUpdated() {
        this._tryDraw();
        this._drawComfort();
        this._drawPoints();
        this._drawCurrentPoint();
    }

    updated() {
        this._tryDraw();
        this._drawComfort();
        this._drawPoints();
        this._drawCurrentPoint();
    }

    _tryDraw() {
        if (this._error) return;
        const host = this.renderRoot.querySelector('.mollier-host');
        if (!host) return;
        const hash = `${this._domainX[0]}|${this._domainX[1]}|${this._domainY[0]}|${this._domainY[1]}|${this._pressure}|${this._convention}|${getLanguage(this._hass)}`;
        const hasSvg = !!host.querySelector('svg');
        if (hasSvg && this._drawHash === hash) {
            this._drawn = true;
            return;
        }
        // Wipe everything and redraw — happens on first mount, after Lit re-mount,
        // or when domain/pressure/convention changed in the config.
        d3.select(host).selectAll('*').remove();
        drawHXCoordinates(d3.select(host), WIDTH, HEIGHT, MARGIN, this._domainX, this._domainY, this._pressure, this._mollier);
        // The vendored coordinate generator emits width/height attributes only,
        // so when the SVG is scaled responsively (height: auto), browsers crop
        // the bottom-right instead of scaling the content. Adding a viewBox
        // makes the internal coordinate system scale with the rendered size.
        d3.select(host).select('#hx_mollier_diagram')
            .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');
        // Translate the English captions the vendored generator draws.
        const t = (key) => this._t(key);
        const captions = [];
        d3.select(host).selectAll('#hx_mollier_diagram text').each(function () {
            const key = DIAGRAM_CAPTIONS[this.textContent];
            if (key) {
                this.textContent = t(key);
                captions.push(this);
            }
        });
        this._fitCaptions(host, captions);
        this._drawHash = hash;
        this._drawn = true;
    }

    // The vendored grid sizes its rotated axis captions for Tahoma; with other
    // fonts or longer translations they can run past the SVG edge and get
    // clipped. Shrink such a caption until it fits (needs layout, so it is
    // skipped while the card is hidden).
    _fitCaptions(host, captions) {
        const svgEl = host.querySelector('#hx_mollier_diagram');
        if (!svgEl) return;
        const box = svgEl.getBoundingClientRect();
        if (!box.width || !box.height) return;
        for (const el of captions) {
            let size = parseFloat(getComputedStyle(el).fontSize) || 12;
            for (let i = 0; i < 12; i++) {
                const r = el.getBoundingClientRect();
                const inside = r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5
                    && r.left >= box.left - 0.5 && r.right <= box.right + 0.5;
                if (inside) break;
                size *= 0.92;
                el.style.fontSize = `${size.toFixed(2)}px`;
            }
        }
    }

    _drawComfort() {
        if (!this._drawn) return;
        const host = this.renderRoot.querySelector('.mollier-host');
        if (!host) return;
        const svg = d3.select(host).select('#hx_mollier_diagram');
        if (svg.empty()) return;

        // Remove and re-append on every update so we run before _drawPoints
        // (called after us in updated()) and stay below the data-points layer.
        svg.select('#comfort-zone').remove();
        if (!this._comfortZone) return;

        const cz = this._comfortZone;
        const polygon = createComfort(cz.range_t, cz.range_phi, cz.range_x, this._pressure, this._mollier);
        if (!Array.isArray(polygon) || polygon.length === 0) return;
        // createComfort wraps the polygon in an extra array for the rangePhi[1] === 0
        // edge case; unwrap so d3.line gets a flat list of {x, y}.
        const points = Array.isArray(polygon[0]) ? polygon[0] : polygon;
        if (points.length < 2) return;

        const innerW = WIDTH - MARGIN.left - MARGIN.right;
        const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
        const xScale = d3.scaleLinear().range([0, innerW]).domain(this._domainX);
        const yScale = d3.scaleLinear().range([innerH, 0]).domain(this._domainY);
        const lineGen = d3.line().x(p => xScale(p.x)).y(p => yScale(p.y));

        svg.append('g')
            .attr('id', 'comfort-zone')
            .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
            .append('path')
            .datum(points)
            .attr('d', lineGen)
            .attr('fill', 'yellowgreen')
            .attr('fill-opacity', 0.4)
            .attr('stroke', 'yellowgreen');

        // Warning bands — dashed outline only, like pyedautils' drawBand().
        if (!this._warningBands) return;
        const group = svg.select('#comfort-zone');
        for (const key of ['orange', 'red']) {
            const band = this._warningBands[key];
            const r = bandRanges(cz, band);
            const pb = createComfort(r.range_t, r.range_phi, r.range_x, this._pressure, this._mollier);
            if (!Array.isArray(pb) || pb.length === 0) continue;
            const pts = Array.isArray(pb[0]) ? pb[0] : pb;
            if (pts.length < 2) continue;
            group.append('path')
                .datum(pts)
                .attr('class', `warning-band ${key}`)
                .attr('d', lineGen)
                .attr('fill', 'none')
                .attr('stroke', band.color)
                .attr('stroke-width', 1.8)
                .attr('stroke-dasharray', '7,4');
        }
    }

    _drawPoints() {
        if (!this._drawn || this._dailyData.length === 0) return;
        const host = this.renderRoot.querySelector('.mollier-host');
        const wrap = this.renderRoot.querySelector('.diagram-wrap');
        if (!host || !wrap) return;
        const svg = d3.select(host).select('#hx_mollier_diagram');
        if (svg.empty()) return;

        const innerW = WIDTH - MARGIN.left - MARGIN.right;
        const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
        const xScale = d3.scaleLinear().range([0, innerW]).domain(this._domainX);
        const yScale = d3.scaleLinear().range([innerH, 0]).domain(this._domainY);

        const points = this._dailyData.map((d, i) => {
            const xy = this._mollier.get_x_y(d.t, d.phi, this._pressure);
            return {
                cx: xScale(xy.x),
                cy: yScale(xy.y),
                x: xy.x,
                color: this._colorFor(d, i),
                opacity: this._opacityFor(d, i),
                date: d.date,
                t: d.t,
                phi: d.phi,
            };
        });

        svg.select('#data-points').remove();
        const layer = svg.append('g')
            .attr('id', 'data-points')
            .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

        if (this._coloring === 'chronological') {
            const line = d3.line().x(p => p.cx).y(p => p.cy);
            layer.append('path')
                .datum(points)
                .attr('d', line)
                .attr('fill', 'none')
                .attr('stroke', '#888')
                .attr('stroke-width', 1);
        }

        const tooltipEl = wrap.querySelector('.tooltip');
        const circles = layer.selectAll('circle')
            .data(points)
            .enter()
            .append('circle')
            .attr('cx', p => p.cx)
            .attr('cy', p => p.cy)
            .attr('r', 5)
            .attr('fill', p => p.color)
            .attr('opacity', p => p.opacity)
            .attr('shape-rendering', 'optimizeSpeed')
            .style('cursor', 'pointer');

        // Use native listeners + getBoundingClientRect for reliable positioning
        // (works regardless of responsive SVG scaling) and to bypass any d3 .on()
        // quirks inside HA's shadow DOM.
        if (tooltipEl) {
            circles.each(function (p) {
                const baseOpacity = p.opacity;
                const season = seasonForMonth(p.date.getMonth());
                const bg = SEASON_COLORS[season];
                const darkText = season !== 'winter' && season !== 'autumn';
                this.addEventListener('mouseover', () => {
                    const wrapRect = wrap.getBoundingClientRect();
                    const circleRect = this.getBoundingClientRect();
                    const dateStr = p.date.toISOString().slice(0, 10);
                    tooltipEl.innerHTML =
                        `${dateStr}<br>x: ${(p.x * 1000).toFixed(2)} g/kg`
                        + `<br>T: ${p.t.toFixed(2)} °C`
                        + `<br>φ: ${(p.phi * 100).toFixed(2)} %`;
                    tooltipEl.style.background = bg;
                    tooltipEl.style.color = darkText ? 'black' : 'white';
                    tooltipEl.style.left = (circleRect.left + circleRect.width / 2 - wrapRect.left) + 'px';
                    tooltipEl.style.top = (circleRect.top - wrapRect.top) + 'px';
                    tooltipEl.style.display = 'block';
                    this.setAttribute('r', 10);
                    this.setAttribute('opacity', 0.9);
                });
                this.addEventListener('mouseout', () => {
                    tooltipEl.style.display = 'none';
                    this.setAttribute('r', 5);
                    this.setAttribute('opacity', baseOpacity);
                });
            });
        }
    }

    _drawCurrentPoint() {
        if (!this._drawn) return;
        const host = this.renderRoot.querySelector('.mollier-host');
        const wrap = this.renderRoot.querySelector('.diagram-wrap');
        if (!host || !wrap) return;
        const svg = d3.select(host).select('#hx_mollier_diagram');
        if (svg.empty()) return;

        // Re-append on every update so this group stays last in paint order
        // (drawn on top of #data-points and #comfort-zone).
        svg.select('#current-point').remove();
        if (!this._currentPoint) return;

        const innerW = WIDTH - MARGIN.left - MARGIN.right;
        const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
        const xScale = d3.scaleLinear().range([0, innerW]).domain(this._domainX);
        const yScale = d3.scaleLinear().range([innerH, 0]).domain(this._domainY);

        const cx = xScale(this._currentPoint.x);
        const cy = yScale(this._currentPoint.y);

        const tooltipEl = wrap.querySelector('.tooltip');
        const layer = svg.append('g')
            .attr('id', 'current-point')
            .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

        const circle = layer.append('circle')
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', 6)
            .attr('fill', 'black')
            .attr('stroke', 'white')
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer');

        if (tooltipEl) {
            const t = this._currentPoint.t;
            const phi = this._currentPoint.phi;
            const x = this._currentPoint.x;
            const node = circle.node();
            node.addEventListener('mouseover', () => {
                const wrapRect = wrap.getBoundingClientRect();
                const r = node.getBoundingClientRect();
                tooltipEl.innerHTML =
                    `${this._t('card.now')}<br>x: ${(x * 1000).toFixed(2)} g/kg`
                    + `<br>T: ${t.toFixed(2)} °C`
                    + `<br>φ: ${(phi * 100).toFixed(2)} %`;
                tooltipEl.style.background = 'black';
                tooltipEl.style.color = 'white';
                tooltipEl.style.left = (r.left + r.width / 2 - wrapRect.left) + 'px';
                tooltipEl.style.top = (r.top - wrapRect.top) + 'px';
                tooltipEl.style.display = 'block';
                node.setAttribute('r', 10);
            });
            node.addEventListener('mouseout', () => {
                tooltipEl.style.display = 'none';
                node.setAttribute('r', 6);
            });
        }
    }

    _colorFor(d) {
        if (this._coloring === 'season') {
            return SEASON_COLORS[seasonForMonth(d.date.getMonth())];
        }
        if (this._coloring === 'age') {
            // Single base color, opacity does the fading (see _opacityFor).
            return '#e53935';
        }
        return '#3949ab';
    }

    _opacityFor(d, i) {
        // Match pyedautils: a constant 0.4 for season/chronological. The 'age'
        // mode is our own — it visualizes age via the opacity itself, so the
        // opacity has to vary there (25 % oldest → 100 % newest).
        if (this._coloring !== 'age') return 0.4;
        const n = this._dailyData.length;
        const t = n <= 1 ? 1 : i / (n - 1);
        return 0.25 + 0.75 * t;
    }

    static getConfigElement() {
        return document.createElement("mollier-hx-card-editor");
    }

    static getStubConfig() {
        return {
            temperature_entity: "sensor.living_room_temperature",
            humidity_entity: "sensor.living_room_humidity",
            header: "",
            days: 7,
            coloring: "season",
            altitude: 450,
        };
    }

    getCardSize() {
        return 3;
    }

    // Omit `rows` so HA defaults to Auto-height — the chart's natural 600:420
    // aspect ratio (via the CSS fallback) decides the card height. The user
    // can still toggle Auto-height off and pick row count in the layout tab.
    // Numeric column bounds keep HA's width slider functional; HA's own "Full
    // Width" toggle (when present) overrides these for cross-section span.
    getGridOptions() {
        return {
            columns: 12,
            min_columns: 4,
            max_columns: 12,
        };
    }
}
