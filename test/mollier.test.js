import { describe, expect, it } from 'vitest';
import { createMollier } from '../src/d3_mollierhx/mollierFunctions.js';

// Reference values from pyedautils._mollier.get_x_y (same formulas, Python).
describe('mollierFunctions (vendored from pyedautils)', () => {
    const m = createMollier('classical');
    it.each([
        [21, 0.6, 101325, 0.009294202481502048],
        [0, 0.8, 101325, 0.003014605329191108],
        [21, 0.6, 96034.58, 0.009814284126792215],
    ])('x(%s °C, %s, %s Pa) matches pyedautils', (t, phi, p, x) => {
        expect(m.get_x_y(t, phi, p).x).toBeCloseTo(x, 9);
    });
    it('both conventions describe the same air', () => {
        const g = createMollier('glueck');
        expect(g.get_x_y(21, 0.6, 101325).x).toBeCloseTo(m.get_x_y(21, 0.6, 101325).x, 9);
    });
});
