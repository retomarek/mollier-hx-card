// Shared by retomarek/comfort-compass-card and retomarek/mollier-hx-card: keep both copies identical
// (`npm run check-shared`).
import { describe, expect, it } from 'vitest';
import { bandRanges, DEFAULT_BANDS, parseWarningBands } from '../src/bands.js';

describe('parseWarningBands', () => {
    it('true and {} give the defaults', () => {
        for (const cfg of [true, {}]) {
            const b = parseWarningBands(cfg);
            expect(b.orange).toMatchObject({ dt: 1, dphi: 5, dx: 1, color: DEFAULT_BANDS.orange.color });
            expect(b.red).toMatchObject({ dt: 2.5, dphi: 10, dx: 2.5, color: DEFAULT_BANDS.red.color });
        }
    });
    it('falsy means no bands', () => {
        expect(parseWarningBands(false)).toBeNull();
        expect(parseWarningBands(null)).toBeNull();
        expect(parseWarningBands(undefined)).toBeNull();
    });
    it('overrides single values and keeps the rest', () => {
        const b = parseWarningBands({ orange: { temperature: 0.5 }, red: { humidity: '12' } });
        expect(b.orange).toMatchObject({ dt: 0.5, dphi: 5, dx: 1 });
        expect(b.red).toMatchObject({ dt: 2.5, dphi: 12, dx: 2.5 });
    });
    it('uses absolute values and ignores non-numbers', () => {
        const b = parseWarningBands({ orange: { temperature: -2, humidity: 'x', absolute_humidity: '' } });
        expect(b.orange).toMatchObject({ dt: 2, dphi: 5, dx: 1 });
    });
    it('widens red so it always encloses orange', () => {
        const b = parseWarningBands({ orange: { temperature: 3, humidity: 15 }, red: { temperature: 1 } });
        expect(b.red.dt).toBe(3);
        expect(b.red.dphi).toBe(15);
    });
    it('keeps color and label strings', () => {
        const b = parseWarningBands({ red: { color: '#ff0000', label: 'Alarm' }, orange: { color: '' } });
        expect(b.red).toMatchObject({ color: '#ff0000', label: 'Alarm' });
        expect(b.orange.color).toBe(DEFAULT_BANDS.orange.color);
        expect(b.orange.label).toBeNull();
    });
});

describe('bandRanges', () => {
    const cz = { range_t: [20, 26], range_phi: [0.3, 0.65], range_x: [0, 0.012] };
    it('widens the comfort zone by the band offsets (internal units)', () => {
        const r = bandRanges(cz, parseWarningBands(true).orange);
        expect(r.range_t).toEqual([19, 27]);
        expect(r.range_phi[0]).toBeCloseTo(0.25, 10);
        expect(r.range_phi[1]).toBeCloseTo(0.7, 10);
        expect(r.range_x[0]).toBe(0);
        expect(r.range_x[1]).toBeCloseTo(0.013, 10);
    });
    it('clamps relative humidity to 0..1', () => {
        const r = bandRanges({ ...cz, range_phi: [0.02, 0.98] }, parseWarningBands(true).red);
        expect(r.range_phi).toEqual([0, 1]);
    });
});
