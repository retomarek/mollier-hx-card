import { describe, expect, it } from 'vitest';
import '../src/mollier-hx-card.js';
import { cardSizeForHeight, parseComfortZone, parseLines, LINE_DEFAULTS } from '../src/card.js';

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
        [{ ...BASE, altitude: 12000 }, /altitude/],
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
