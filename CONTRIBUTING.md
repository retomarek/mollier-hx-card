# Contributing

Bug reports, ideas and pull requests are welcome.

## Development

```bash
npm ci
npm run watch        # rebuilds dist/mollier-hx-card.js on every change
```

To try a build in Home Assistant, copy `dist/mollier-hx-card.js` to `<config>/www/` and add it as a dashboard resource (*Settings → Dashboards → Resources*, URL `/local/<file>.js`, type JavaScript module). Remove the Marketplace / HACS copy first so the card is not loaded twice.

Before a pull request:

```bash
npm run build          # commit dist/mollier-hx-card.js with your change
npm run screenshots    # optional: re-renders docs/*.png (needs Chrome or Chromium)
```

The screenshots are also re-rendered automatically on every push to `main`.

## Translations

English and German are written by the author; the other languages were machine-translated. Corrections by native speakers are very welcome: edit `src/localize/languages/<code>.json` and open a pull request. Keep the keys, placeholders like `{error}` and units (°C, g/kg, …) unchanged.

To add a language:

1. Copy `src/localize/languages/en.json` to `src/localize/languages/<code>.json`, using the language code Home Assistant uses (`fr`, `nl`, `pt-BR`, ...).
2. Translate the values and keep the keys.
3. Import and register the file in `src/localize/localize.js`.
4. Run `npm run build` and open a pull request.

Missing keys fall back to English, so a partial translation is fine.

## Diagram code from pyedautils

`src/d3_mollierhx/` is copied verbatim from [pyedautils](https://github.com/retomarek/pyedautils) (`pyedautils/data/d3_mollierhx`). Please change the diagram math or drawing there and re-copy it here, rather than editing these files.
