import { html, LitElement, nothing } from 'lit';
import * as d3 from './d3_mollierhx/d3.js';
import { drawHXCoordinates } from './d3_mollierhx/coordinateGenerator.js';
import { createComfort } from './d3_mollierhx/drawComfort.js';
import { createMollier } from './d3_mollierhx/mollierFunctions.js';
import { parseWarningBands, bandRanges } from './bands.js';
import { localize, getLanguage, DIAGRAM_CAPTIONS, RIGHT_CAPTION_KEYS } from './localize/localize.js';
import { fetchDailyMeans, stateCelsius, REFRESH_MS } from './statistics.js';
import styles from './card.styles';

const DEFAULT_PRESSURE = 101325;
const DEFAULT_DAYS = 7;
const DEFAULT_COLORING = 'season';
const DEFAULT_CONVENTION = 'classical';
const VALID_CONVENTIONS = ['classical', 'glueck'];
// Internal units are kg/kg for x and °C for y; user config is expressed in
// g/kg (x) and °C (y) — see _parseDomainX below.
// Indoor climate range: -10..40 °C, 0..18 g/kg.
const DEFAULT_DOMAIN_X = [0.0, 0.018];
const DEFAULT_DOMAIN_Y = [-10.0, 40.0];
// Iso-line families the user can switch on and off (config key → option of
// the vendored drawHXCoordinates). Density and enthalpy are off by default.
export const LINE_DEFAULTS = {
    temperature: true,
    relative_humidity: true,
    absolute_humidity: true,
    density: false,
    enthalpy: false,
};
const LINE_OPTS = {
    temperature: 'showTemperature',
    relative_humidity: 'showRelHumidity',
    absolute_humidity: 'showAbsHumidity',
    density: 'showDensity',
    enthalpy: 'showEnthalpy',
};

export function parseLines(cfg) {
    const out = { ...LINE_DEFAULTS };
    if (cfg && typeof cfg === 'object') {
        for (const k of Object.keys(LINE_DEFAULTS)) {
            if (typeof cfg[k] === 'boolean') out[k] = cfg[k];
        }
    }
    return out;
}

const OUTDOOR_COLOR = '#2563eb';

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
            // Set by Home Assistant: "grid" in sections, "panel" in panel view,
            // unset in masonry. Reflected so the styles can switch modes.
            layout: { type: String, reflect: true },
            _fixedHeight: { type: Boolean, reflect: true, attribute: 'fixed-height' },
            _tempEntity: { state: true },
            _humEntity: { state: true },
            _pressure: { state: true },
            _days: { state: true },
            _coloring: { state: true },
            _comfortZone: { state: true },
            _warningBands: { state: true },
            _domainX: { state: true },
            _domainY: { state: true },
            _convention: { state: true },
            _lines: { state: true },
            _currentPoint: { state: true },
            _outdoorPoint: { state: true },
            _outdoorDays: { state: true },
            _error: { state: true },
        };
    }

    setConfig(config) {
        this._config = config;
        this._updateSizingMode();
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
        this._domainX = parseDomain(config.domain_x, DEFAULT_DOMAIN_X, 1 / 1000);
        this._domainY = parseDomain(config.domain_y, DEFAULT_DOMAIN_Y, 1);
        this._lines = parseLines(config.lines);
        this._convention = VALID_CONVENTIONS.includes(config.convention)
            ? config.convention
            : DEFAULT_CONVENTION;
        this._mollier = createMollier(this._convention);
        // Outside air (all optional): sensors for the live point and the daily
        // means, a weather entity as fallback for the live point.
        this._outT = config.outdoor_temperature_entity || null;
        this._outH = config.outdoor_humidity_entity || null;
        this._outW = config.outdoor_weather_entity || null;
        this._outHistory = config.outdoor_history === true;
        this._ventLine = config.ventilation_line !== false;
        if (this._hass) {
            this._maybeFetch();
            this._updateCurrentPoint();
        }
    }

    set hass(hass) {
        const firstAttach = !this._hass;
        this._hass = hass;
        if (firstAttach && this._tempEntity) this._maybeFetch();
        this._updateCurrentPoint();
    }

    // Live outside point: outside sensors first, the weather entity as fallback.
    _updateOutdoorPoint() {
        const hass = this._hass;
        if (!hass || !this._mollier || !(this._outT || this._outW)) { this._outdoorPoint = null; return; }
        let t = NaN, rh = NaN, source = null;
        if (this._outT && this._outH) {
            t = stateCelsius(hass.states[this._outT]);
            rh = parseFloat(hass.states[this._outH]?.state);
            source = 'sensor';
        }
        if ((!Number.isFinite(t) || !Number.isFinite(rh)) && this._outW) {
            const a = hass.states[this._outW]?.attributes || {};
            t = Number(a.temperature);
            if (a.temperature_unit === '°F') t = (t - 32) * 5 / 9;
            rh = Number(a.humidity);
            source = 'weather';
        }
        if (!Number.isFinite(t) || !Number.isFinite(rh)) { this._outdoorPoint = null; return; }
        const phi = rh > 1 ? rh / 100 : rh;
        const xy = this._mollier.get_x_y(t, phi, this._pressure);
        if (!Number.isFinite(xy.x) || !Number.isFinite(xy.y)) { this._outdoorPoint = null; return; }
        const prev = this._outdoorPoint;
        if (prev && prev.x === xy.x && prev.y === xy.y) return;
        this._outdoorPoint = { x: xy.x, y: xy.y, t, phi, source };
    }

    _updateCurrentPoint() {
        this._updateOutdoorPoint();
        if (!this._hass || !this._tempEntity || !this._humEntity || !this._mollier) {
            this._currentPoint = null;
            return;
        }
        const ts = this._hass.states[this._tempEntity];
        const hs = this._hass.states[this._humEntity];
        if (!ts || !hs) { this._currentPoint = null; return; }
        const t = stateCelsius(ts);
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

    // Loads the daily means once per entity/period combination; `force` re-fetches
    // (hourly timer, retry after an error). A response that arrives after the
    // config changed is dropped, so a slow old request cannot overwrite a newer one.
    async _maybeFetch(force = false) {
        if (!this._hass || !this._tempEntity || !this._humEntity) return;
        const outdoor = this._outHistory && this._outT && this._outH;
        const key = `${this._tempEntity}|${this._humEntity}|${this._days}|${outdoor ? `${this._outT}|${this._outH}` : ''}`;
        if (key === this._fetchKey && !force) return;
        this._fetchKey = key;
        try {
            const [days, outDays] = await Promise.all([
                fetchDailyMeans(this._hass, this._tempEntity, this._humEntity, this._days),
                // Outside history is optional: a failure there must not hide the room data.
                outdoor ? fetchDailyMeans(this._hass, this._outT, this._outH, this._days).catch(() => []) : [],
            ]);
            if (this._fetchKey !== key) return;
            this._dailyData = days;
            this._outdoorDays = outDays;
            this._error = days.length ? undefined : { key: 'card.no_statistics' };
        } catch (err) {
            if (this._fetchKey !== key) return;
            this._error = { key: 'card.fetch_failed', vars: { error: (err && err.message) || err } };
            this._fetchKey = null;                  // retry on the next timer tick
        }
        this.requestUpdate();
    }

    connectedCallback() {
        super.connectedCallback();
        clearInterval(this._refreshTimer);
        this._refreshTimer = setInterval(() => this._maybeFetch(true), REFRESH_MS);
        // Re-attached (e.g. back from another dashboard view): refresh once.
        if (this._wasConnected) this._maybeFetch(true);
        this._wasConnected = true;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearInterval(this._refreshTimer);
        this._refreshTimer = undefined;
    }

    // Two sizing modes (like HA's own chart and gauge cards):
    // - fixed: sections view with a row count, or panel view — fill the tile;
    // - auto: masonry, stacks, sections with auto rows — the diagram takes its
    //   natural aspect ratio, capped in height and centred, so a full-width
    //   card does not turn into a 1400 px tall chart.
    _updateSizingMode() {
        const rows = this._config?.grid_options?.rows;
        this._fixedHeight = this.layout === 'panel' || (this.layout === 'grid' && typeof rows === 'number');
    }

    willUpdate(changed) {
        if (changed.has('layout')) this._updateSizingMode();
    }

    static styles = styles;

    render() {
        // Rendered before setConfig (e.g. element attached first): nothing to draw yet.
        if (!this._config) return nothing;
        return html`
            <ha-card header="${this._header}">
                <div class="card-content">
                    ${this._error
                        ? html`<p class="${this._error.key === 'card.no_statistics' ? 'message' : 'error'}">${this._t(this._error.key, this._error.vars)}</p>`
                        : html`
                            <div class="sheet">
                                <div class="diagram-wrap">
                                    <div class="mollier-host"></div>
                                    <div class="tooltip"></div>
                                </div>
                                ${this._renderZoneLegend()}
                            </div>
                          `}
                </div>
            </ha-card>
        `;
    }

    _t(key, vars) {
        return localize(this._hass, key, vars);
    }

    // One short line: names only. The limits are in the hover title, so the
    // legend does not wrap at normal card widths.
    _renderZoneLegend() {
        const cz = this._comfortZone;
        const b = cz ? this._warningBands : null;
        const o = this._outdoorPoint;
        if (!cz && !o) return nothing;
        const r = (v) => Math.round(v * 10) / 10;
        const zone = cz ? `${r(cz.range_t[0])}–${r(cz.range_t[1])} °C · ${r(cz.range_phi[0] * 100)}–${r(cz.range_phi[1] * 100)} % · `
            + `${r(cz.range_x[0] * 1000)}–${r(cz.range_x[1] * 1000)} g/kg` : '';
        const fmt = (k) => `±${k.dt} K · ±${k.dphi} % · ±${k.dx} g/kg`;
        const eff = this._ventilationEffect();
        const outTitle = o ? `${o.t.toFixed(1)} °C · ${(o.phi * 100).toFixed(0)} % · ${(o.x * 1000).toFixed(1)} g/kg` : '';
        return html`
            <div class="zone-legend">
                ${cz ? html`<span title=${zone}><i class="swatch fill"></i>${this._t('card.comfort_zone')}</span>` : nothing}
                ${b ? ['orange', 'red'].map((k) => html`
                    <span title=${fmt(b[k])}>
                        <i class="swatch dash" style="border-color:${b[k].color}"></i>${b[k].label || this._t(k === 'orange' ? 'card.warning_band' : 'card.alarm_band')}
                    </span>`) : nothing}
                ${o ? html`<span title=${outTitle}><i class="swatch outdoor"></i>${this._t('card.outdoor')}${eff && this._ventLine && this._currentPoint
                    ? html`<span class="effect ${eff}">· ${this._t(`card.ventilation_${eff}`)}</span>` : nothing}</span>` : nothing}
            </div>
        `;
    }

    firstUpdated() {
        this.updated();
    }

    updated() {
        if (!this._config) return;
        this._tryDraw();
        this._drawComfort();
        this._drawOutdoorHistory();
        this._drawPoints();
        this._drawOutdoor();
        this._drawCurrentPoint();
    }

    _tryDraw() {
        if (this._error) return;
        const host = this.renderRoot.querySelector('.mollier-host');
        if (!host) return;
        const hash = `${this._domainX[0]}|${this._domainX[1]}|${this._domainY[0]}|${this._domainY[1]}|${this._pressure}|${this._convention}|${getLanguage(this._hass)}|${JSON.stringify(this._lines)}`;
        const hasSvg = !!host.querySelector('svg');
        if (hasSvg && this._drawHash === hash) {
            this._drawn = true;
            return;
        }
        // Wipe everything and redraw — happens on first mount, after Lit re-mount,
        // or when domain/pressure/convention changed in the config.
        d3.select(host).selectAll('*').remove();
        const lineOpts = {};
        for (const [k, opt] of Object.entries(LINE_OPTS)) lineOpts[opt] = this._lines[k];
        drawHXCoordinates(d3.select(host), WIDTH, HEIGHT, MARGIN, this._domainX, this._domainY, this._pressure, this._mollier, lineOpts);
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
                captions.push({ el: this, key });
            }
        });
        this._layoutRightCaptions(captions);
        this._placeXAxisCaption(captions);
        this._drawHash = hash;
        this._drawn = true;
    }

    // The vendored grid places the rotated right-edge captions (relative
    // humidity, density, enthalpy) at fixed offsets made for a ~700 px tall
    // chart; in the card's 420 px they run off the top. Stack the visible ones
    // from the top of the axis down and size the font from the text length.
    // Uses an estimated glyph width, so it works without layout (hidden
    // cards, editor preview) and gives the same result every time.
    _layoutRightCaptions(captions) {
        const RIGHT = RIGHT_CAPTION_KEYS;
        const right = captions
            .filter((c) => RIGHT.includes(c.key))
            .sort((a, b) => RIGHT.indexOf(a.key) - RIGHT.indexOf(b.key));
        if (!right.length) return;
        const axis = HEIGHT - MARGIN.top - MARGIN.bottom;
        const seg = axis / right.length;
        right.forEach(({ el }, i) => {
            // Rotated frame: x runs along the axis, 0 = middle, positive = up.
            // Each caption ends at the top of its segment, so the first one is
            // flush with the top of the diagram.
            const top = axis / 2 - seg * i;
            let text = el.textContent || '';
            const fit = (n) => (seg - 12) / (Math.max(n, 1) * 0.56);
            // Below 8 px the text is unreadable: shorten it instead (long translations).
            if (fit(text.length) < 8) {
                const max = Math.max(4, Math.floor((seg - 12) / (8 * 0.56)) - 1);
                text = `${text.slice(0, max).trimEnd()}…`;
                el.textContent = text;
            }
            el.setAttribute('x', top.toFixed(1));
            el.setAttribute('text-anchor', 'end');
            el.setAttribute('font-size', Math.max(8, Math.min(12, fit(text.length))).toFixed(2));
        });
    }

    // The vendored grid writes "x [g/kg]" at the right end of the x axis, on
    // top of the last tick numbers. Move it into the right margin, beside the
    // end of the axis, and drop the white box behind it.
    _placeXAxisCaption(captions) {
        const cap = captions.find((c) => c.key === 'diagram.x_axis');
        if (!cap) return;
        const innerW = WIDTH - MARGIN.left - MARGIN.right;
        const box = cap.el.previousElementSibling;
        if (box && box.tagName.toLowerCase() === 'rect') box.remove();
        const len = (cap.el.textContent || '').length;
        const room = MARGIN.right - 14;
        cap.el.setAttribute('x', (innerW + 12).toFixed(1));
        cap.el.setAttribute('text-anchor', 'start');
        cap.el.setAttribute('font-size', Math.min(11, room / (Math.max(len, 1) * 0.56)).toFixed(2));
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

    // Diagram helpers shared by the outside layers.
    _plot() {
        const host = this.renderRoot.querySelector('.mollier-host');
        const wrap = this.renderRoot.querySelector('.diagram-wrap');
        if (!this._drawn || !host || !wrap) return null;
        const svg = d3.select(host).select('#hx_mollier_diagram');
        if (svg.empty()) return null;
        const innerW = WIDTH - MARGIN.left - MARGIN.right;
        const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
        return {
            svg, wrap, innerW, innerH,
            xs: d3.scaleLinear().range([0, innerW]).domain(this._domainX),
            ys: d3.scaleLinear().range([innerH, 0]).domain(this._domainY),
        };
    }

    _dewPoint(t, phi) {
        return this._mollier.temperature_p_sat(phi * this._mollier.p_sat(t));
    }

    // 'dries' / 'humidifies' / 'neutral': does airing move the room point left or right?
    _ventilationEffect() {
        const o = this._outdoorPoint, r = this._currentPoint;
        if (!o || !r) return null;
        const dx = (o.x - r.x) * 1000;               // g/kg
        if (dx < -0.3) return 'dries';
        if (dx > 0.3) return 'humidifies';
        return 'neutral';
    }

    // Outside daily means: a faint second cloud below the room points.
    _drawOutdoorHistory() {
        const P = this._plot();
        if (!P) return;
        P.svg.select('#outdoor-history').remove();
        const days = this._outHistory ? (this._outdoorDays || []) : [];
        if (!days.length) return;
        const layer = P.svg.append('g')
            .attr('id', 'outdoor-history')
            .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
        for (const d of days) {
            const xy = this._mollier.get_x_y(d.t, d.phi, this._pressure);
            const cx = P.xs(xy.x), cy = P.ys(xy.y);
            if (!(cx >= 0 && cx <= P.innerW && cy >= 0 && cy <= P.innerH)) continue;
            layer.append('circle')
                .attr('cx', cx).attr('cy', cy).attr('r', 3.5)
                .attr('fill', OUTDOOR_COLOR).attr('fill-opacity', 0.28)
                .attr('stroke', OUTDOOR_COLOR).attr('stroke-opacity', 0.45).attr('stroke-width', 0.8);
        }
    }

    // Live outside point (hollow blue circle) and the ventilation line from the
    // room point to it. Outside the visible range the marker sits on the edge
    // with an arrow and the value, instead of changing the axes.
    _drawOutdoor() {
        const P = this._plot();
        if (!P) return;
        P.svg.select('#outdoor').remove();
        const o = this._outdoorPoint;
        if (!o) return;
        const layer = P.svg.append('g')
            .attr('id', 'outdoor')
            .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
        const rawX = P.xs(o.x), rawY = P.ys(o.y);
        const cx = Math.min(P.innerW, Math.max(0, rawX));
        const cy = Math.min(P.innerH, Math.max(0, rawY));
        const outside = cx !== rawX || cy !== rawY;

        const r = this._currentPoint;
        if (this._ventLine && r) {
            layer.append('line')
                .attr('x1', P.xs(r.x)).attr('y1', P.ys(r.y))
                .attr('x2', cx).attr('y2', cy)
                .attr('stroke', OUTDOOR_COLOR).attr('stroke-width', 1.6)
                .attr('stroke-dasharray', '4,3').attr('stroke-linecap', 'round');
        }

        let marker;
        if (!outside) {
            marker = layer.append('circle')
                .attr('cx', cx).attr('cy', cy).attr('r', 6)
                .attr('fill', 'white').attr('fill-opacity', 0.85)
                .attr('stroke', OUTDOOR_COLOR).attr('stroke-width', 2.5);
        } else {
            // Arrow on the edge, pointing to where the point really is.
            const ang = Math.atan2(rawY - cy, rawX - cx);
            const s = 7;
            const pts = [[s, 0], [-s * 0.6, -s * 0.75], [-s * 0.6, s * 0.75]]
                .map(([px, py]) => [cx - Math.cos(ang) * s + px * Math.cos(ang) - py * Math.sin(ang),
                                    cy - Math.sin(ang) * s + px * Math.sin(ang) + py * Math.cos(ang)]);
            marker = layer.append('polygon')
                .attr('points', pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '))
                .attr('fill', OUTDOOR_COLOR).attr('stroke', 'white').attr('stroke-width', 1);
            const label = `${o.t.toFixed(1)} °C · ${(o.phi * 100).toFixed(0)} %`;
            const below = rawY > P.innerH, above = rawY < 0;
            layer.append('text')
                .attr('x', Math.min(P.innerW - 2, Math.max(2, cx + (rawX > P.innerW ? -10 : rawX < 0 ? 10 : 0))))
                .attr('y', below ? cy - 12 : above ? cy + 20 : cy + 4)
                .attr('text-anchor', rawX > P.innerW ? 'end' : rawX < 0 ? 'start' : 'middle')
                .attr('font-size', 11).attr('font-weight', 600)
                .attr('fill', OUTDOOR_COLOR).attr('stroke', 'white').attr('stroke-width', 3).attr('paint-order', 'stroke')
                .text(label);
        }

        const tooltipEl = P.wrap.querySelector('.tooltip');
        if (tooltipEl && marker) {
            const node = marker.node();
            node.style.cursor = 'pointer';
            const show = () => {
                const wrapRect = P.wrap.getBoundingClientRect();
                const rr = node.getBoundingClientRect();
                const eff = this._ventilationEffect();
                tooltipEl.innerHTML = `${this._t('card.outdoor')}<br>x: ${(o.x * 1000).toFixed(2)} g/kg`
                    + `<br>T: ${o.t.toFixed(1)} °C<br>φ: ${(o.phi * 100).toFixed(0)} %`
                    + `<br>Td: ${this._dewPoint(o.t, o.phi).toFixed(1)} °C`
                    + (eff ? `<br>${this._t(`card.ventilation_${eff}`)}` : '');
                tooltipEl.style.background = OUTDOOR_COLOR;
                tooltipEl.style.color = 'white';
                tooltipEl.style.left = (rr.left + rr.width / 2 - wrapRect.left) + 'px';
                tooltipEl.style.top = (rr.top - wrapRect.top) + 'px';
                tooltipEl.style.display = 'block';
            };
            node.addEventListener('mouseover', show);
            node.addEventListener('click', show);
            node.addEventListener('mouseout', () => { tooltipEl.style.display = 'none'; });
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

    // Masonry: 1 unit = 50 px. With title and legend the card is about
    // 400–600 px tall depending on the column width.
    getCardSize() {
        return 10;
    }

    // Sections: full width by default, auto height (no default rows) like the
    // built-in statistics graph; at least 6 columns so the axes stay readable.
    getGridOptions() {
        return {
            columns: 12,
            min_columns: 6,
            // Title, legend and a readable diagram need about 440 px.
            min_rows: 7,
        };
    }
}
