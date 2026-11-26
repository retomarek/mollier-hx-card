import { describe, expect, it } from 'vitest';
import '../src/mollier-hx-card.js';
import { parseComfortZone, parseLines, LINE_DEFAULTS } from '../src/card.js';

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
