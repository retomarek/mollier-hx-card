// Shared by retomarek/comfort-compass-card and retomarek/mollier-hx-card: keep both copies identical
// (`npm run check-shared`).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ALTITUDE_RANGE,
    daysFromConfig,
    fetchDailyMeans,
    humidityFraction,
    MAX_DAYS,
    missingEntities,
    PRESSURE_PA_RANGE,
    pressureFromConfig,
    stateCelsius,
    stateHumidity,
    withTimeout,
} from '../src/statistics.js';

const DAY = 24 * 60 * 60 * 1000;

describe('humidityFraction', () => {
    it('divides percent by 100', () => {
        expect(humidityFraction([50, 100], '%')).toEqual([0.5, 1]);
    });
    it('keeps fractions when no unit is given and all values are ≤ 1', () => {
        expect(humidityFraction([0.4, 0.6], undefined)).toEqual([0.4, 0.6]);
    });
    it('treats values above 1 without unit as percent', () => {
        const [a, b] = humidityFraction([0.9, 40], undefined);
        expect(a).toBeCloseTo(0.009, 12);
        expect(b).toBeCloseTo(0.4, 12);
    });
    it('also treats ≤ 1 values as percent when the unit says %', () => {
        expect(humidityFraction([1], '%')).toEqual([0.01]);
    });
});

describe('live states', () => {
    const st = (state, unit) => ({ state, attributes: { unit_of_measurement: unit } });
    it('converts °F to °C', () => {
        expect(stateCelsius(st('68', '°F'))).toBeCloseTo(20, 10);
        expect(stateCelsius(st('21.5', '°C'))).toBe(21.5);
    });
    it('returns NaN for unavailable, unknown or missing states', () => {
        expect(stateCelsius(st('unavailable', '°C'))).toBeNaN();
        expect(stateCelsius(undefined)).toBeNaN();
        expect(stateHumidity(st('unknown', '%'))).toBeNaN();
    });
    it('gives relative humidity as a fraction', () => {
        expect(stateHumidity(st('45', '%'))).toBeCloseTo(0.45, 10);
    });
});

describe('missingEntities', () => {
    it('lists ids that are not in hass.states', () => {
        const hass = { states: { 'sensor.a': {} } };
        expect(missingEntities(hass, ['sensor.a', 'sensor.b', ''])).toEqual(['sensor.b']);
    });
    it('reports nothing while hass has no states yet', () => {
        expect(missingEntities({ states: {} }, ['sensor.a'])).toEqual([]);
        expect(missingEntities(undefined, ['sensor.a'])).toEqual([]);
    });
});

describe('pressureFromConfig', () => {
    it('falls back without pressure and altitude', () => {
        expect(pressureFromConfig({})).toBe(101325);
        expect(pressureFromConfig({ pressure: '' }, 100000)).toBe(100000);
    });
    it('accepts Pa and hPa', () => {
        expect(pressureFromConfig({ pressure: 96000 })).toBe(96000);
        expect(pressureFromConfig({ pressure: 960 })).toBe(96000);
        expect(pressureFromConfig({ pressure: '1013.25' })).toBeCloseTo(101325, 6);
    });
    it('lets altitude win over pressure (standard atmosphere)', () => {
        expect(pressureFromConfig({ altitude: 0, pressure: 90000 })).toBeCloseTo(101325, 6);
        expect(pressureFromConfig({ altitude: 450 })).toBeCloseTo(96034.6, 0);
    });
    it('accepts the documented range limits', () => {
        expect(pressureFromConfig({ pressure: PRESSURE_PA_RANGE[0] })).toBe(PRESSURE_PA_RANGE[0]);
        expect(pressureFromConfig({ pressure: PRESSURE_PA_RANGE[1] })).toBe(PRESSURE_PA_RANGE[1]);
        expect(() => pressureFromConfig({ altitude: ALTITUDE_RANGE[0] })).not.toThrow();
        expect(() => pressureFromConfig({ altitude: ALTITUDE_RANGE[1] })).not.toThrow();
    });
    it('throws on values outside the ranges or not numbers', () => {
        expect(() => pressureFromConfig({ pressure: 20000 })).toThrow(/pressure must be in hPa/);
        expect(() => pressureFromConfig({ pressure: 'abc' })).toThrow(/pressure/);
        expect(() => pressureFromConfig({ altitude: 10000 })).toThrow(/altitude must be/);
        expect(() => pressureFromConfig({ altitude: 'high' })).toThrow(/altitude/);
    });
});

describe('daysFromConfig', () => {
    it('uses the fallback when unset', () => {
        expect(daysFromConfig({}, 30)).toBe(30);
        expect(daysFromConfig({ days_to_show: null }, 7)).toBe(7);
    });
    it('rounds and caps', () => {
        expect(daysFromConfig({ days_to_show: '14.4' }, 30)).toBe(14);
        expect(daysFromConfig({ days_to_show: 99999 }, 30)).toBe(MAX_DAYS);
    });
    it('rejects values below 1 and non-numbers', () => {
        expect(() => daysFromConfig({ days_to_show: 0 }, 30)).toThrow(/days_to_show/);
        expect(() => daysFromConfig({ days_to_show: 'many' }, 30)).toThrow(/days_to_show/);
    });
});

describe('withTimeout', () => {
    afterEach(() => vi.useRealTimers());
    it('passes a result through', async () => {
        await expect(withTimeout(Promise.resolve(5), 1000)).resolves.toBe(5);
    });
    it('rejects with code "timeout" when the promise hangs', async () => {
        vi.useFakeTimers();
        const p = withTimeout(new Promise(() => {}), 60e3);
        vi.advanceTimersByTime(60e3);
        await expect(p).rejects.toMatchObject({ code: 'timeout' });
    });
});

describe('fetchDailyMeans', () => {
    const T = 'sensor.t';
    const H = 'sensor.h';
    // A fixed noon far from a daylight-saving change, so "today" and the
    // 24-hour day buckets are stable in every time zone and at any hour.
    const NOW = new Date(2026, 5, 15, 12, 0, 0);
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());
    // Day buckets at local midnight; bucket 0 is today (not completed yet).
    const midnight = new Date(2026, 5, 15).getTime();
    const day = (i) => midnight - i * DAY;

    const hassWith = (tRows, hRows, unit = '%') => ({
        states: { [H]: { attributes: { unit_of_measurement: unit } } },
        callWS: vi.fn(async () => ({ [T]: tRows, [H]: hRows })),
    });

    it('asks for daily means in °C', async () => {
        const hass = hassWith([], []);
        await fetchDailyMeans(hass, T, H, 30);
        expect(hass.callWS.mock.calls[0][0]).toMatchObject({
            type: 'recorder/statistics_during_period',
            statistic_ids: [T, H],
            period: 'day',
            types: ['mean'],
            units: { temperature: '°C' },
        });
    });

    it('pairs completed days, drops today and incomplete pairs, sorts by date', async () => {
        const hass = hassWith(
            [
                { start: day(0), mean: 22 }, // today: dropped
                { start: day(1), mean: 21 },
                { start: day(3), mean: 19 },
                { start: day(2), mean: 20 },
                { start: day(4), mean: 18 }, // no humidity: dropped
            ],
            [
                { start: day(0), mean: 50 },
                { start: day(1), mean: 40 },
                { start: day(2), mean: 45 },
                { start: day(3), mean: null }, // no value: the day is dropped, not read as 0 %
            ],
        );
        const days = await fetchDailyMeans(hass, T, H, 30);
        expect(days.map((d) => d.t)).toEqual([20, 21]);
        expect(days.map((d) => d.phi)).toEqual([0.45, 0.4]);
        expect(days[0].date).toBeInstanceOf(Date);
    });

    it('accepts ISO strings as start (older Home Assistant)', async () => {
        const iso = new Date(day(1)).toISOString();
        const days = await fetchDailyMeans(hassWith([{ start: iso, mean: 21 }], [{ start: iso, mean: 40 }]), T, H, 7);
        expect(days).toHaveLength(1);
    });

    it('keeps only the last `days` days', async () => {
        const rows = (v) => [1, 2, 3, 4, 5].map((i) => ({ start: day(i), mean: v + i }));
        const days = await fetchDailyMeans(hassWith(rows(10), rows(40)), T, H, 2);
        expect(days.map((d) => d.t)).toEqual([12, 11]);
    });

    it('returns [] when there are no statistics', async () => {
        const hass = { states: {}, callWS: async () => ({}) };
        await expect(fetchDailyMeans(hass, T, H, 7)).resolves.toEqual([]);
    });
});
