// Translations. English (en.json) is the base and the fallback for every key;
// other languages only need the keys they translate. To add a language, copy
// en.json to languages/<code>.json, translate it and register it below.
// en and de are written by the author; the others were machine-translated and
// are waiting for corrections from native speakers (pull requests welcome).
import en from './languages/en.json';
import de from './languages/de.json';
import fr from './languages/fr.json';
import it from './languages/it.json';
import es from './languages/es.json';
import pt from './languages/pt.json';
import nl from './languages/nl.json';
import pl from './languages/pl.json';
import sv from './languages/sv.json';
import da from './languages/da.json';
import nb from './languages/nb.json';
import cs from './languages/cs.json';
import ru from './languages/ru.json';
import zhHans from './languages/zh-Hans.json';

// Keys are lower-case Home Assistant language codes. A code like "pt-BR" or
// "de-CH" falls back to its base language ("pt", "de"), anything else to English.
const LANGUAGES = {
    en, de, fr, it, es, pt, nl, pl, sv, da, nb, cs, ru,
    'zh-hans': zhHans,
    no: nb,          // older Norwegian code
};

export function getLanguage(hass) {
    const lang = String(hass?.locale?.language || hass?.language || 'en').toLowerCase();
    if (LANGUAGES[lang]) return lang;
    const base = lang.split(/[-_]/)[0];
    return LANGUAGES[base] ? base : 'en';
}

const lookup = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// localize(hass, 'diagram.density') or localize(hass, 'card.fetch_failed', { error })
export function localize(hass, key, vars) {
    let value = lookup(LANGUAGES[getLanguage(hass)], key);
    if (typeof value !== 'string') value = lookup(en, key);
    if (typeof value !== 'string') return key;
    if (vars) value = value.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
    return value;
}
