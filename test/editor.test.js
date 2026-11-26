import { describe, expect, it } from 'vitest';
import { configToData, dataToConfig } from '../src/editor.js';

const BASE = { type: 'custom:mollier-hx-card', temperature_entity: 'sensor.t', humidity_entity: 'sensor.h' };
const roundTrip = (c) => dataToConfig(configToData(c), c);

describe('editor mapping', () => {
    it('opening the editor changes nothing', () => {
        for (const c of [
            BASE,
            { ...BASE, title: 'Bedroom', days_to_show: 90, coloring: 'age', convention: 'glueck' },
            { ...BASE, altitude: 450 },
            { ...BASE, pressure: 96000 },
            { ...BASE, x_range: [0, 25], temperature_range: [-20, 45] },
            { ...BASE, lines: { density: true, humidity: false } },
            { ...BASE, comfort_zone: { temperature: [20, 26], humidity: [30, 65], absolute_humidity: [0, 12] } },
            { ...BASE, comfort_zone: { temperature: [21, 24], humidity: [35, 55] } },
            {
                ...BASE,
                comfort_zone: { temperature: [20, 26], humidity: [30, 65] },
                warning_bands: {
                    orange: { temperature: 1, humidity: 5, absolute_humidity: 1 },
                    red: { temperature: 2.5, humidity: 10, absolute_humidity: 2.5, label: 'Alarm' },
                },
            },
            {
                ...BASE,
                outdoor_temperature_entity: 'sensor.out_t',
                outdoor_humidity_entity: 'sensor.out_h',
                outdoor_history: true,
                ventilation_line: false,
            },
            { ...BASE, show_legend: false },
        ]) {
            expect(roundTrip(c), JSON.stringify(c)).toEqual(c);
        }
    });

    it('writes no defaults', () => {
        expect(dataToConfig(configToData(BASE), {})).toEqual(BASE);
    });

    it('keeps keys it does not own', () => {
        const c = { ...BASE, grid_options: { columns: 12, rows: 8 }, card_mod: { style: 'ha-card {}' } };
        expect(roundTrip(c)).toEqual(c);
    });

    it('a cleared field falls back instead of writing null', () => {
        const c = { ...BASE, days_to_show: 60, x_range: [0, 25] };
        const data = { ...configToData(c), days: undefined, x_max: '' };
        const out = dataToConfig(data, c);
        expect(out.days_to_show).toBe(60);
        expect(out.x_range).toEqual([0, 25]);
        expect(JSON.stringify(out)).not.toMatch(/null/);
    });

    it('writes either altitude or pressure, never both', () => {
        const data = { ...configToData({ ...BASE, pressure: 96000 }), air_mode: 'altitude', altitude: 600 };
        const out = dataToConfig(data, { ...BASE, pressure: 96000 });
        expect(out.altitude).toBe(600);
        expect(out).not.toHaveProperty('pressure');
    });
});
