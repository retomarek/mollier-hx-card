// Shared by retomarek/comfort-compass-card and retomarek/mollier-hx-card: keep both copies identical
// (`npm run check-shared`).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatNumber, getLanguage, localize } from '../src/localize/localize.js';

// Paths from the repository root (vitest's root); import.meta.url is not a file URL under happy-dom.
const DIR = join(process.cwd(), 'src/localize/languages');
const load = (f) => JSON.parse(readFileSync(join(DIR, f), 'utf8'));
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'en.json');

// { a: { b: 'x' } } → { 'a.b': 'x' }
function flatten(obj, prefix = '', out = {}) {
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object') flatten(v, key, out);
        else out[key] = v;
    }
    return out;
}
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const en = flatten(load('en.json'));

describe('translations', () => {
    // English and German are written by the author and must be complete;
    // the machine translations may leave keys to the English fallback.
    it('de.json has every key of en.json', () => {
        const de = flatten(load('de.json'));
        expect(Object.keys(en).filter((k) => !(k in de))).toEqual([]);
    });

    it('are all registered in localize.js', () => {
        const src = readFileSync(join(process.cwd(), 'src/localize/localize.js'), 'utf8');
        for (const f of files) expect(src, f).toContain(`./languages/${f}`);
    });

    for (const f of files) {
        describe(f, () => {
            const flat = flatten(load(f));
            it('only has keys that exist in en.json', () => {
                expect(Object.keys(flat).filter((k) => !(k in en))).toEqual([]);
            });
            it('keeps the placeholders and line breaks of en.json', () => {
                for (const [k, v] of Object.entries(flat)) {
                    expect(typeof v, k).toBe('string');
                    expect(placeholders(v), k).toEqual(placeholders(en[k]));
                    // A label broken in two lines in English stays broken (longer words may add a break).
                    if (String(en[k]).includes('\n')) expect(v, `${k}: line break`).toContain('\n');
                }
            });
        });
    }
});

describe('localize', () => {
    const hass = (language) => ({ locale: { language } });
    it('falls back to the base language, then to English', () => {
        expect(getLanguage(hass('de-CH'))).toBe('de');
        expect(getLanguage(hass('pt-BR'))).toBe('pt');
        expect(getLanguage(hass('zh-Hans'))).toBe('zh-hans');
        expect(getLanguage(hass('xx'))).toBe('en');
        expect(getLanguage(undefined)).toBe('en');
    });
    it('fills placeholders and returns the key when nothing matches', () => {
        expect(localize(hass('en'), 'card.fetch_failed', { error: 'boom', s: 30 })).toContain('boom');
        expect(localize(hass('de'), 'card.fetch_failed', { error: 'boom', s: 30 })).toContain('boom');
        expect(localize(hass('en'), 'does.not.exist')).toBe('does.not.exist');
    });
});

describe('formatNumber', () => {
    const hass = (language, number_format) => ({ locale: { language, number_format } });
    it("follows the profile's number format, else the language", () => {
        expect(formatNumber(hass('en', 'language'), 1500)).toBe('1,500');
        expect(formatNumber(hass('de', 'language'), 1500)).toBe('1.500');
        expect(formatNumber(hass('en', 'decimal_comma'), 1500.5, 1)).toBe('1.500,5');
        // The Swiss separator is ’ in newer ICU data (Node 24), ' in older (Node 22).
        expect(formatNumber(hass('en', 'quote_decimal'), 1500)).toMatch(/^1['’]500$/);
        expect(formatNumber(hass('de', 'none'), 1500)).toBe('1500');
        expect(formatNumber(undefined, 2.345, 2)).toMatch(/2[.,]35/);
    });
});
