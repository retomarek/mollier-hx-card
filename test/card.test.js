import { describe, expect, it } from 'vitest';
import '../src/mollier-hx-card.js';
import {
    captionKeys,
    cardSizeForHeight,
    diagramLayout,
    parseComfortZone,
    parseLines,
    LINE_DEFAULTS,
} from '../src/card.js';
import { createMollier } from '../src/d3_mollierhx/mollierFunctions.js';
import { localize } from '../src/localize/localize.js';

const BASE = { type: 'custom:mollier-hx-card', temperature_entity: 'sensor.t', humidity_entity: 'sensor.h' };
const card = () => document.createElement('mollier-hx-card');

describe('registration', () => {
    it('registers the card, the editor and one card-picker entry', () => {
        expect(customElements.get('mollier-hx-card')).toBeDefined();
        expect(customElements.get('mollier-hx-card-editor')).toBeDefined();
        expect(window.customCards.filter((c) => c.type === 'mollier-hx-card')).toHaveLength(1);
    });
});

describe('parseComfortZone', () => {
    it('no zone without comfort_zone', () => {
        expect(parseComfortZone(undefined)).toBeNull();
        expect(parseComfortZone(false)).toBeNull();
    });
    it('converts units and sorts the pairs', () => {
        const cz = parseComfortZone({ temperature: [26, 20], humidity: ['65', 30], absolute_humidity: [12, 0] });
        expect(cz.range_t).toEqual([20, 26]);
        expect(cz.range_phi).toEqual([0.3, 0.65]);
        expect(cz.range_x).toEqual([0, 0.012]);
        expect(cz.hasX).toBe(true);
    });
    it('without absolute_humidity the zone is open in x', () => {
        const cz = parseComfortZone({ temperature: [20, 26], humidity: [30, 65] });
        expect(cz.hasX).toBe(false);
        expect(cz.range_x).toEqual([0, 1]);
    });
    it('rejects incomplete or wrong pairs', () => {
        expect(() => parseComfortZone({ humidity: [30, 65] })).toThrow(/comfort_zone.temperature/);
        expect(() => parseComfortZone({ temperature: [20, 26] })).toThrow(/comfort_zone.humidity/);
        expect(() => parseComfortZone({ temperature: [20, 26], humidity: [30, 65], absolute_humidity: [1] })).toThrow(
            /absolute_humidity/,
        );
        expect(() => parseComfortZone([20, 26])).toThrow(/object/);
    });
});

describe('parseLines', () => {
    it('defaults and boolean overrides only', () => {
        expect(parseLines(undefined)).toEqual(LINE_DEFAULTS);
        expect(parseLines({ density: true, humidity: 'no', unknown: true })).toEqual({
            ...LINE_DEFAULTS,
            density: true,
        });
    });
});

describe('setConfig', () => {
    it('accepts a minimal config', () => {
        expect(() => card().setConfig(BASE)).not.toThrow();
    });
    it.each([
        [{}, /temperature_entity is required/],
        [{ temperature_entity: 'sensor.t' }, /humidity_entity is required/],
        [{ ...BASE, coloring: 'rainbow' }, /coloring must be one of/],
        [{ ...BASE, convention: 'modern' }, /convention must be one of/],
        [{ ...BASE, days_to_show: 0 }, /days_to_show/],
        [{ ...BASE, altitude: 40000 }, /altitude/], // invalid in m and in ft
        [{ ...BASE, comfort_zone: { temperature: [20, 26] } }, /comfort_zone.humidity/],
    ])('rejects %j', (config, message) => {
        expect(() => card().setConfig(config)).toThrow(message);
    });
    it('keeps the previous config when a new one is rejected', () => {
        const c = card();
        c.setConfig({ ...BASE, title: 'Living room', coloring: 'age' });
        expect(() => c.setConfig({ ...BASE, coloring: 'rainbow' })).toThrow();
        expect(c._config.title).toBe('Living room');
        expect(c._coloring).toBe('age');
    });
});

describe('Home Assistant hooks', () => {
    it('stub config picks sensors with statistics', () => {
        const Card = customElements.get('mollier-hx-card');
        const s = (id, dc, sc) => [id, { entity_id: id, attributes: { device_class: dc, state_class: sc } }];
        const hass = {
            states: Object.fromEntries([
                s('sensor.no_stats', 'temperature', null),
                s('sensor.room_t', 'temperature', 'measurement'),
                s('sensor.room_h', 'humidity', 'measurement'),
            ]),
        };
        expect(Card.getStubConfig(hass)).toMatchObject({
            temperature_entity: 'sensor.room_t',
            humidity_entity: 'sensor.room_h',
        });
    });
    it('grid options: full width, auto height', () => {
        expect(card().getGridOptions()).toEqual({ columns: 12, min_columns: 6, min_rows: 7 });
    });
});

describe('cardSizeForHeight', () => {
    // Home Assistant's rows when auto height is switched off.
    const rowsFor = (n) => Math.ceil((n * 50 + 8) / 64);
    it('gives exactly the rows the card needs', () => {
        for (let h = 40; h <= 900; h += 7) {
            const need = Math.ceil((h + 8) / 64);
            expect(rowsFor(cardSizeForHeight(h)), `${h} px`).toBe(need);
        }
    });
    it('a card stretched to a 5-row neighbour stays at 5 rows', () => {
        expect(rowsFor(cardSizeForHeight(5 * 64 - 8))).toBe(5);
    });
});

describe('air pressure', () => {
    const withHass = (config, elevation, language = 'en') => {
        const c = card();
        c.setConfig(config);
        c.hass = { states: {}, locale: { language }, config: { elevation }, callWS: async () => ({}) };
        return c;
    };
    it('sea level without hass', () => {
        const c = card();
        c.setConfig(BASE);
        expect(c._pressure).toBe(101325);
    });
    it('the elevation set in Home Assistant when the config has neither altitude nor pressure', () => {
        expect(withHass(BASE, 1500)._pressure).toBeCloseTo(84556, 0);
    });
    it('altitude or pressure in the config win', () => {
        expect(withHass({ ...BASE, altitude: 0 }, 1500)._pressure).toBeCloseTo(101325, 6);
        expect(withHass({ ...BASE, pressure: 960 }, 1500)._pressure).toBe(96000);
    });
    it('follows a change of the elevation in Home Assistant', () => {
        const c = withHass(BASE, 0);
        c.hass = { states: {}, locale: { language: 'en' }, config: { elevation: 1500 }, callWS: async () => ({}) };
        expect(c._pressure).toBeCloseTo(84556, 0);
    });
    it('show_pressure text: altitude and pressure, or only the pressure', () => {
        expect(withHass(BASE, 1500)._airText()).toBe('1,500 m a.s.l. · 846 hPa');
        expect(withHass(BASE, 450, 'de')._airText()).toBe('450 m ü. M. · 960 hPa');
        expect(withHass({ ...BASE, pressure: 960 }, 1500)._airText()).toBe('960 hPa');
    });
    it('show_pressure must be a boolean', () => {
        expect(() => card().setConfig({ ...BASE, show_pressure: 'yes' })).toThrow(/show_pressure/);
    });

    it('an empty show_pressure is "not set"', () => {
        expect(() => card().setConfig({ ...BASE, show_pressure: null })).not.toThrow();
    });
    it("the text follows the profile's number format and leaves out an unknown altitude", () => {
        const c = card();
        c.setConfig(BASE);
        c.hass = {
            states: {},
            locale: { language: 'en', number_format: 'quote_decimal' },
            config: { elevation: 1500 },
            callWS: async () => ({}),
        };
        expect(c._airText()).toMatch(/^1['’]500 m a\.s\.l\. · 846 hPa$/); // ’ or ' depending on the ICU data
        c.hass = { states: {}, locale: { language: 'en' }, config: {}, callWS: async () => ({}) };
        expect(c._airText()).toBe('1,013 hPa');
    });
});

describe('imperial units', () => {
    const imperialHass = (extra = {}) => ({
        states: {},
        locale: { language: 'en' },
        config: { unit_system: { temperature: '°F' }, elevation: 450 },
        callWS: async () => ({}),
        ...extra,
    });
    it('auto: zone, axis ranges and altitude in °F, gr/lb and ft once Home Assistant is US customary', () => {
        const c = card();
        c.setConfig({
            ...BASE,
            comfort_zone: { temperature: [68, 77], humidity: [30, 60], absolute_humidity: [0, 84] },
            temperature_range: [32, 104],
            x_range: [0, 140],
        });
        c.hass = imperialHass();
        expect(c._units).toBe('imperial');
        expect(c._comfortZone.range_t[1]).toBeCloseTo(25, 6);
        expect(c._comfortZone.range_x[1]).toBeCloseTo(0.012, 10);
        expect(c._domainY[0]).toBeCloseTo(0, 6);
        expect(c._domainX[1]).toBeCloseTo(0.02, 10);
        expect(c._airText()).toMatch(/^1,476 ft a\.s\.l\. · 28\.36 inHg$/);
    });
    it('imperial defaults: 10–110 °F, 0–180 gr/lb', () => {
        const c = card();
        c.setConfig({ ...BASE, units: 'imperial' });
        expect(c._domainY[0]).toBeCloseTo(-12.22, 2);
        expect(c._domainY[1]).toBeCloseTo(43.33, 2);
        expect(c._domainX[1]).toBeCloseTo(180 / 7000, 10);
    });
    it('a zone that looks like °C with imperial units gives a hint', () => {
        const c = card();
        c.setConfig({ ...BASE, units: 'imperial', comfort_zone: { temperature: [20, 26], humidity: [30, 65] } });
        expect(c._unitHint).toBe('card.celsius_hint');
    });
});

describe('diagram layout by unit system', () => {
    it('metric: Mollier h,x diagram in SI with the unchanged margin', () => {
        expect(diagramLayout('metric')).toEqual({
            orientation: 'mollier',
            units: 'si',
            margin: { top: 30, right: 60, bottom: 40, left: 50 },
        });
    });
    it('imperial: ASHRAE psychrometric chart in IP units, room for the humidity-ratio axis on the right', () => {
        const L = diagramLayout('imperial');
        expect(L.orientation).toBe('psychrometric');
        expect(L.units).toBe('ip');
        expect(L.margin.right).toBeGreaterThanOrEqual(50);
    });
    it('captions: the *_ip translations with imperial units', () => {
        expect(captionKeys('metric').temperature).toBe('diagram.temperature');
        expect(captionKeys('imperial')).toEqual({
            temperature: 'diagram.temperature_ip',
            rel_humidity: 'diagram.rel_humidity_ip',
            density: 'diagram.density_ip',
            enthalpy: 'diagram.enthalpy_ip',
            x_axis: 'diagram.x_axis_ip',
        });
        const en = { locale: { language: 'en' } };
        const t = (key) => localize(en, key);
        expect(t('diagram.temperature_ip')).toBe('Dry-bulb temperature [°F]');
        expect(t('diagram.x_axis_ip')).toBe('Humidity ratio W [gr/lb]');
        expect(t('diagram.enthalpy_ip')).toBe('Enthalpy [Btu/lb]');
        expect(t('diagram.density_ip')).toBe('Density [lb/ft³]');
    });
});

describe('drawing in both orientations', () => {
    const days = (n) =>
        Array.from({ length: n }, (_, i) => ({ start: new Date(Date.UTC(2026, 6, 1 + i)).toISOString() }));
    const hassFor = (system, language = 'en') => ({
        states: {
            'sensor.t': { entity_id: 'sensor.t', state: '21', attributes: { unit_of_measurement: '°C' } },
            'sensor.h': { entity_id: 'sensor.h', state: '50', attributes: { unit_of_measurement: '%' } },
        },
        locale: { language },
        config: { unit_system: { temperature: system === 'imperial' ? '°F' : '°C' } },
        callWS: async () => ({
            'sensor.t': days(20).map((d, i) => ({ ...d, mean: 18 + i * 0.4 })),
            'sensor.h': days(20).map((d, i) => ({ ...d, mean: 35 + i })),
        }),
    });
    const drawn = async (system, language) => {
        const c = card();
        c.setConfig({ ...BASE, altitude: 0 });
        c.hass = hassFor(system, language);
        document.body.appendChild(c);
        await new Promise((r) => setTimeout(r, 0)); // statistics arrive
        await c.updateComplete;
        await c.updateComplete;
        return c;
    };
    const svgOf = (c) => c.renderRoot.querySelector('#hx_mollier_diagram');

    it('metric: x to the right, temperature up (the Mollier diagram)', async () => {
        const c = await drawn('metric');
        const P = c._plot();
        const m = createMollier('classical');
        const s = m.get_x_y(21, 0.5, 101325);
        const [px, py] = P.project(s.x, s.y);
        expect(px).toBeCloseTo((P.innerW * s.x) / 0.018, 6);
        expect(py).toBeCloseTo((P.innerH * (40 - s.y)) / 50, 6);
        expect(svgOf(c).querySelector('.hx-caption-temperature').textContent).toBe('Temperature ϑ [°C]');
        expect(svgOf(c).querySelector('.hx-axis-humidity')).toBeNull();
        c.remove();
    });

    it('imperial: temperature to the right, humidity ratio up (the psychrometric chart)', async () => {
        const c = await drawn('imperial', 'de');
        expect(c._units).toBe('imperial');
        const P = c._plot();
        const m = createMollier('classical');
        const s = m.get_x_y(21, 0.5, 101325);
        const [px, py] = P.project(s.x, s.y);
        // Default range 10..110 °F, 0..180 gr/lb.
        const y0 = ((10 - 32) * 5) / 9,
            y1 = ((110 - 32) * 5) / 9;
        expect(px).toBeCloseTo((P.innerW * (s.y - y0)) / (y1 - y0), 6);
        expect(py).toBeCloseTo(P.innerH * (1 - (s.x * 7000) / 180), 6);
        // The live point and every daily point are drawn inside the axes.
        const now = c.renderRoot.querySelector('#current-point circle:not(.hit)');
        expect(Number(now.getAttribute('cx'))).toBeCloseTo(px, 6);
        expect(Number(now.getAttribute('cy'))).toBeCloseTo(py, 6);
        const dots = [...c.renderRoot.querySelectorAll('#data-points circle:not(.hit)')];
        expect(dots.length).toBeGreaterThan(5);
        for (const d of dots) {
            expect(Number(d.getAttribute('cx'))).toBeGreaterThan(0);
            expect(Number(d.getAttribute('cx'))).toBeLessThan(P.innerW);
            expect(Number(d.getAttribute('cy'))).toBeGreaterThan(0);
            expect(Number(d.getAttribute('cy'))).toBeLessThan(P.innerH);
        }
        // Humidity-ratio axis on the right, translated IP captions.
        const svg = svgOf(c);
        expect(svg.querySelector('.hx-axis-humidity')).not.toBeNull();
        expect(svg.querySelector('.hx-caption-temperature').textContent).toBe('Trockenkugeltemperatur [°F]');
        expect(svg.querySelector('.hx-caption-x-axis').textContent).toBe('Wassergehalt W [gr/lb]');
        c.remove();
    });

    it('imperial: an off-axis room point gets an edge arrow labelled in °F', async () => {
        const c = card();
        c.setConfig({ ...BASE, altitude: 0, temperature_range: [32, 60] });
        c.hass = hassFor('imperial');
        document.body.appendChild(c);
        await c.updateComplete;
        const label = c.renderRoot.querySelector('#current-point .hx-edge-label');
        expect(label.textContent).toBe('69.8 °F · 50 %');
        c.remove();
    });
});
