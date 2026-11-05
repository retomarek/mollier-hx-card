// Translations. English (en.json) is the base and the fallback for every key;
// other languages only need the keys they translate. To add a language, copy
// en.json to languages/<code>.json, translate it and register it below.
import en from './languages/en.json';
import de from './languages/de.json';

const LANGUAGES = { en, de };

export function getLanguage(hass) {
    const lang = String(hass?.locale?.language || hass?.language || 'en').toLowerCase();
    if (LANGUAGES[lang]) return lang;
    const base = lang.split(/[-_]/)[0];
    return LANGUAGES[base] ? base : 'en';
}

const lookup = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// localize(hass, 'compass.names.ok') or localize(hass, 'card.fetch_failed', { error })
export function localize(hass, key, vars) {
    let value = lookup(LANGUAGES[getLanguage(hass)], key);
    if (typeof value !== 'string') value = lookup(en, key);
    if (typeof value !== 'string') return key;
    if (vars) value = value.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
    return value;
}

// Caption texts the vendored coordinateGenerator.js draws in English. The card
// swaps them after drawing so the vendored code stays verbatim.
export const DIAGRAM_CAPTIONS = {
    'x [g/kg]': 'diagram.x_axis',
    'Temperature ϑ [°C]': 'diagram.temperature',
    'rel. humidity φ [%]': 'diagram.rel_humidity',
    'Density ρ [kg/m³]': 'diagram.density',
    'Enthalpy [kJ/kg]': 'diagram.enthalpy',
};
