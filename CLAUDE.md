# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A Home Assistant custom Lovelace card distributed through HACS. Renders a Mollier hx (psychrometric) diagram from a temperature and humidity sensor pair, with a single data point that follows the live sensor values. Built with Lit + Parcel; rendering uses D3 (subpackages: `d3-selection`, `d3-scale`, `d3-shape`, `d3-axis`, `d3-array`).

The diagram math and D3 rendering code under `src/d3_mollierhx/` is **vendored verbatim** from [retomarek/pyedautils](https://github.com/retomarek/pyedautils) (`pyedautils/data/d3_mollierhx/`, commit noted in each file header; currently f9ba0da, byte-identical to [hslu-ige-laes/d3-mollierhx](https://github.com/hslu-ige-laes/d3-mollierhx) v0.2.0 `src/`, whose README section "Options / API" documents the functions). Only a 3-line header, ES6 imports and an `export { ... }` block were added (line endings normalised to LF); do not refactor the contents — keep them in sync with upstream by re-copying when pyedautils updates, then check that `d3.js` still exports every `d3.*` symbol the files use. Upstream's `mollierChart.js` (stateful chart, D3 v7, uses `d3.pointer`, `d3.contours`, `d3.utcFormat`, ...) is **not** vendored: the card does not use it, it has its own Lit-based renderer with touch targets, tooltips and zoom.

## Commands

- `npm run build` — Parcel production build. Source is `src/mollier-hx-card.js`, output is `dist/`.
- `npm run watch` — Parcel watch mode for local development.

There are no tests, linter, or typechecker configured.

## Architecture

The build produces a single JS bundle `dist/mollier-hx-card.js` that Home Assistant loads as a Lovelace resource. The entry point is `src/mollier-hx-card.js` — the filename intentionally matches the bundle name so Parcel's default-target naming produces the right output without extra config (see the script in `package.json`).

Two custom elements are registered in `src/mollier-hx-card.js`:

- `mollier-hx-card` (`src/card.js`) — the card itself. Extends `LitElement`. Config options are documented in README.md. On first `hass` it fetches daily means via `recorder/statistics_during_period` into `_dailyData`; `set hass()` also tracks the live sensor values as `_currentPoint`. `updated()` draws (in z-order) the grid via `drawHXCoordinates()` (only when domain/pressure/convention change), the comfort zone + warning bands (`#comfort-zone`), the daily points (`#data-points`) and the live point (`#current-point`), using D3 scales built from `MARGIN`/`WIDTH`/`HEIGHT` and the configured `x_range` / `temperature_range`. The band legend is rendered by Lit below the diagram. Iso-line visibility (`lines`: temperature, humidity, absolute_humidity, density, enthalpy; `parseLines`/`LINE_DEFAULTS`, exported for the editor) is passed to `drawHXCoordinates` as its `opts`; the translated captions go in as `opts.captions` (keys `temperature`, `rel_humidity`, `density`, `enthalpy`, `x_axis` = the `diagram.*` translation keys); upstream lays them out for the height (right-edge captions stacked, x caption in the right margin).

Sizing: `layout` (set by HA: `grid`/`panel`/unset) and `grid_options.rows` decide the mode, reflected as the `fixed-height` attribute. Fixed: fill the tile. Auto: 600:420 aspect ratio, max 480 px tall, centred. `getGridOptions()` = `{columns: 12, min_columns: 6, min_rows: 7}` without default rows, like HA's statistics graph.
- `mollier-hx-card-editor` (`src/editor.js`) — visual editor (HA `<ha-form>`), translating between the flat form data and the nested YAML config. On each input change it clones `_config` and dispatches a bubbling+composed `config-changed` CustomEvent. **Never mutate `_config` in place** — Home Assistant treats it as read-only and relies on the cloned object in the event detail.

`src/bands.js` — warning bands (± offsets around the comfort zone), same schema and defaults as the separate comfort-compass-card, where the bands are the severity stages.

The D3 rendering module under `src/d3_mollierhx/`:
- `mollierFunctions.js` — pure thermodynamic math (`p_sat`, `enthalpy`, `get_x_y`, …). No D3 dependency.
- `coordinateGenerator.js` — `drawHXCoordinates(d3Selection, W, H, margin, domainX, domainY, p, mollier, opts)` appends an SVG with axes, iso-temperature, iso-density, iso-RH, and iso-enthalpy lines and the captions (`opts.captions`, defaults `HX_DEFAULT_CAPTIONS`). The SVG gets `id="hx_mollier_diagram"`.
- `drawComfort.js` — `drawComfort()` and `createComfort()` (`card.js` uses `createComfort()` for the comfort zone and the warning bands) and the overlay helpers: `card.js` uses `hxAddClipPath` (clip of the data layers), `hxDrawStatePoint` (live room point, edge arrow when off-axis), `hxDrawOutdoor` (outside point + ventilation line, `note: false` because the note is in the legend), `hxClampPoint` and `hxVentilationEffect`. Hit areas, tooltips and zoom are the card's own.
- `d3.js` — namespace adapter that re-exports the d3-subpackage symbols the vendored files reference as `d3.scaleLinear`, `d3.line`, etc.

Lit + D3 coexistence: Lit owns the `<div class="mollier-host">` container; D3 mutates inside it imperatively. Keep `render()` deterministic so Lit doesn't tear down the SVG. The `_drawn` flag prevents re-drawing axes on every reactive update.

Translations live in `src/localize/` (`languages/en.json` is the base and per-key fallback; `localize(hass, key, vars)`, language from `hass.locale.language`). Every user-visible string in the card and editor goes through it; add new keys to `en.json` and `de.json` together. The diagram captions are passed to the vendored `drawHXCoordinates` as `opts.captions` (no text replacement after drawing). The edge-arrow label (`{t} °C · {rh} %`) is upstream's default `state_value` text (units only, not translated). The language is part of the grid redraw hash.

Styles live in `src/card.styles.js` as a tagged `css\`\`` template imported into `card.js`. The editor's styles are inlined.

`src/card.html` is a static reference of the rendered DOM shape; it is not imported or built — it exists as a layout sketch.

## Releasing

Versioning is SemVer (`MAJOR.MINOR.PATCH`, e.g. `1.0.0`). Don't use Home Assistant-style CalVer: it reads like a Home Assistant version. The version lives in `package.json` and in the `version` constant in `src/mollier-hx-card.js` (console banner); bump both.

1. Bump `version` in `package.json`, run `npm run build`, commit `dist/` too (HACS falls back to `dist/` if a release has no asset).
2. Tag and publish a GitHub release named like the version (e.g. `v1.0.0`). `.github/workflows/release.yaml` builds and attaches `mollier-hx-card.js` to the release.
3. `.github/workflows/validate.yaml` runs the HACS validation action (`hacs/action`, category `plugin`); it must pass without `ignore` for inclusion in the catalog (`hacs/default`, file `plugin`). The catalog serves both HACS (< 2026.11) and the built-in Home Assistant Marketplace (>= 2026.11). The catalog review also requires an image in the README.
4. Marketplace installs to `www/community/mollier-hx-card/` and registers `/local/community/mollier-hx-card/mollier-hx-card.js?v=...` as a resource. `hacs.json` keys used: `name`, `filename`, `content_in_root`, `homeassistant`; `render_readme` is ignored by the Marketplace but kept for HACS.

## Screenshots and repo assets

- `npm run screenshots` (`scripts/screenshots.mjs`) renders the built bundle with deterministic sample data in headless Chrome (`puppeteer-core`, browser from `$CHROME_PATH` or PATH) and writes `docs/screenshot.png` (dark, English) and `docs/screenshot-light-de.png`. `.github/workflows/screenshots.yaml` runs it on every push to `main` that touches `src/` and commits changed images.
- The README references images by absolute `raw.githubusercontent.com` URLs, because the Marketplace / HACS render the README outside GitHub.
- `docs/logo.svg` is generated from real psychrometric curves; `docs/banner.png` (README header, from `scripts/banner.html`) and `docs/social-preview.png` (GitHub social preview, from `scripts/social-preview.html`) are rendered by `npm run social-preview`; the social preview (upload it manually under *Settings → General → Social preview*; there is no API for it).
- Dashboard cards cannot have their own icon in the Marketplace / HACS lists: the Marketplace frontend only loads brand icons for integrations (`repository-icon.ts`). The logo is for the README and GitHub.
- Keep `CHANGELOG.md` up to date; release notes are taken from it.

## Home Assistant integration notes

- `ha-card` is a Home Assistant-provided element; it is available at runtime in HA but not in this repo. Don't try to import or polyfill it.
- Service calls go through `this._hass.callService(domain, service, data)`.
- The card receives a fresh `hass` object on every state change in HA — the `set hass()` setter must stay cheap and idempotent.

## Claude Code setup

- `.claude/agents/card-reviewer.md`: read-only reviewer with the HA card, Lit, D3, translation and packaging checklist. Run it on a change before committing or releasing.
- `.claude/skills/visual-check/`: `npm run visual-check` renders the bundle in ~10 dashboard situations (`scripts/visual-check.mjs`, output in `tmp/visual/`); look at the images after any rendering, style or sizing change.
- `.claude/skills/release/`: release checklist (versions, changelog, workflows, HACS catalog).

## Config API (stable from 1.0)

Option names were settled before 1.0: `title`, `days_to_show`, `x_range`, `temperature_range`, `lines.humidity`, `outdoor_*`, `ventilation_line`, `comfort_zone`, `warning_bands`. There are no aliases for older names.0, renaming or changing an option is a breaking change (major version). Temperatures in the config are always °C (band offsets K); `pressure` accepts hPa or Pa; `altitude` in m; validation errors are thrown from `setConfig` (shared helpers in `src/statistics.js`).
