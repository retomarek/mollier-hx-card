// Shared by retomarek/comfort-compass-card and retomarek/mollier-hx-card: keep both copies identical
// (`npm run check-shared`).
import { describe, expect, it } from 'vitest';
import { parseWarningBands } from '../src/bands.js';
import { airPressure, pressureFromConfig } from '../src/statistics.js';
import {
    cToF,
    convertConfigUnits,
    DEFAULT_BAND_VALUES,
    DEFAULT_ZONES,
    fToC,
    inhgToPa,
    paToInhg,
    show,
    unitSystem,
    UNITS,
} from '../src/units.js';

describe('unitSystem', () => {
    const hass = (temperature) => ({ config: { unit_system: { temperature } } });
    it("auto follows Home Assistant's unit system (°F = US customary)", () => {
        expect(unitSystem({}, hass('°F'))).toBe('imperial');
        expect(unitSystem({}, hass('°C'))).toBe('metric');
        expect(unitSystem({ units: 'auto' }, hass('°F'))).toBe('imperial');
        expect(unitSystem({}, undefined)).toBe('metric');
    });
    it('the option wins', () => {
        expect(unitSystem({ units: 'metric' }, hass('°F'))).toBe('metric');
        expect(unitSystem({ units: 'imperial' }, hass('°C'))).toBe('imperial');
    });
});

describe('conversions (as in pyedautils/units.py)', () => {
    it('known values', () => {
        expect(cToF(20)).toBe(68);
        expect(fToC(212)).toBe(100);
        expect(paToInhg(101325)).toBeCloseTo(29.921, 3);
        expect(inhgToPa(29.92)).toBeCloseTo(101320.8, 0);
        expect(UNITS.imperial.absHumidity.fromGkg(12)).toBe(84);
        expect(UNITS.imperial.delta.fromK(2.5)).toBeCloseTo(4.5, 10);
        expect(UNITS.imperial.altitude.fromM(450)).toBeCloseTo(1476.4, 1);
    });
    it('the imperial defaults are the metric ones, converted and rounded', () => {
        const u = UNITS.imperial;
        const m = DEFAULT_ZONES.metric;
        const i = DEFAULT_ZONES.imperial;
        expect(u.temperature.toC(i.temperature[0])).toBeCloseTo(m.temperature[0], 6);
        expect(Math.abs(u.temperature.toC(i.temperature[1]) - m.temperature[1])).toBeLessThan(0.2);
        expect(u.absHumidity.toGkg(i.absolute_humidity[1])).toBe(m.absolute_humidity[1]);
        expect(u.delta.toK(DEFAULT_BAND_VALUES.imperial.red.temperature)).toBeCloseTo(2.5, 10);
        expect(u.absHumidity.toGkg(DEFAULT_BAND_VALUES.imperial.red.absolute_humidity)).toBe(2.5);
    });
});

describe('show', () => {
    const hass = { locale: { language: 'en' } };
    it('values with their unit, per system', () => {
        const m = show(hass, 'metric');
        const i = show(hass, 'imperial');
        expect(m.temperature(21.5)).toBe('21.5 °C');
        expect(i.temperature(21.5)).toBe('70.7 °F');
        expect(m.absHumidity(0.0081)).toBe('8.1 g/kg');
        expect(i.absHumidity(0.0081)).toBe('57 gr/lb');
        expect(m.altitude(450)).toBe('450 m');
        expect(i.altitude(450)).toBe('1,476 ft');
        expect(m.pressure(96000)).toBe('960 hPa');
        expect(i.pressure(96000)).toBe('28.35 inHg');
    });
});

describe('warning bands in imperial units', () => {
    it('offsets in °F and gr/lb become K and g/kg', () => {
        const b = parseWarningBands({ orange: { temperature: 3.6, absolute_humidity: 14 } }, 'imperial');
        expect(b.orange.dt).toBeCloseTo(2, 10);
        expect(b.orange.dx).toBe(2);
        expect(b.red.dt).toBeCloseTo(2.5, 10); // default ±4.5 °F
        expect(b.red.dx).toBe(2.5); // default ±17.5 gr/lb
    });
    it('metric is unchanged', () => {
        expect(parseWarningBands(true, 'metric').orange).toMatchObject({ dt: 1, dphi: 5, dx: 1 });
    });
});

describe('air pressure in imperial units', () => {
    it('altitude in ft, pressure in inHg', () => {
        expect(pressureFromConfig({ altitude: 1476.38 }, null, 'imperial')).toBeCloseTo(96034.6, 0);
        expect(pressureFromConfig({ pressure: 28.35 }, null, 'imperial')).toBeCloseTo(96004, 0);
        expect(() => pressureFromConfig({ pressure: 960 }, null, 'imperial')).toThrow(/inHg/);
        expect(() => pressureFromConfig({ altitude: 40000 }, null, 'imperial')).toThrow(/feet/);
        const a = airPressure({ altitude: 1476.38 }, undefined, 'imperial');
        expect(a.altitude).toBeCloseTo(450, 2); // always m inside
        expect(a.source).toBe('altitude');
    });
});

describe('convertConfigUnits', () => {
    it('keeps the meaning when switching the unit system', () => {
        const metric = {
            type: 'x',
            comfort_zone: { temperature: [20, 26], humidity: [30, 65], absolute_humidity: [0, 12] },
            warning_bands: { orange: { temperature: 1, absolute_humidity: 1, color: '#f80' } },
            temperature_range: [-10, 40],
            x_range: [0, 18],
            altitude: 450,
        };
        const imperial = convertConfigUnits(metric, 'metric', 'imperial');
        expect(imperial.comfort_zone).toEqual({
            temperature: [68, 78.8],
            humidity: [30, 65],
            absolute_humidity: [0, 84],
        });
        expect(imperial.warning_bands.orange).toEqual({ temperature: 1.8, absolute_humidity: 7, color: '#f80' });
        expect(imperial.temperature_range).toEqual([14, 104]);
        expect(imperial.x_range).toEqual([0, 126]);
        expect(imperial.altitude).toBe(1476);
        expect(convertConfigUnits({ pressure: 960 }, 'metric', 'imperial').pressure).toBeCloseTo(28.35, 2);
        expect(convertConfigUnits({ pressure: 28.35 }, 'imperial', 'metric').pressure).toBe(96004); // Pa, like the editor writes
        expect(convertConfigUnits(metric, 'metric', 'metric')).toBe(metric);
    });
    it('switching back and forth gives the same values again', () => {
        const metric = {
            comfort_zone: { temperature: [17.5, 22.5], humidity: [30, 65], absolute_humidity: [0, 12.5] },
            warning_bands: {
                orange: { temperature: 0.5, absolute_humidity: 0.5 },
                red: { temperature: 3, absolute_humidity: 2.5 },
            },
            temperature_range: [-12, 37],
            x_range: [0, 17],
            altitude: 500,
            pressure: 96500,
        };
        const back = convertConfigUnits(convertConfigUnits(metric, 'metric', 'imperial'), 'imperial', 'metric');
        // The pressure goes through 0.01 inHg (34 Pa) steps.
        expect(Math.abs(back.pressure - metric.pressure)).toBeLessThan(20);
        expect({ ...back, pressure: metric.pressure }).toEqual(metric);
        const imperial = {
            comfort_zone: { temperature: [65, 77.5], humidity: [30, 65], absolute_humidity: [0, 85] },
            warning_bands: {
                orange: { temperature: 1.5, absolute_humidity: 5 },
                red: { temperature: 4, absolute_humidity: 15 },
            },
            temperature_range: [10, 110],
            x_range: [0, 180],
        };
        expect(convertConfigUnits(convertConfigUnits(imperial, 'imperial', 'metric'), 'metric', 'imperial')).toEqual(
            imperial,
        );
    });
    it('a converted altitude stays within the accepted range', () => {
        for (const altitude of [-500, 9000]) {
            const c = convertConfigUnits({ altitude }, 'metric', 'imperial');
            expect(() => pressureFromConfig(c, null, 'imperial')).not.toThrow();
        }
    });
});
