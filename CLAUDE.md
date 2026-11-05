# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A Home Assistant custom Lovelace card distributed through HACS. Renders a Mollier hx (psychrometric) diagram from a temperature and humidity sensor pair, with a single data point that follows the live sensor values. Built with Lit + Parcel; rendering uses D3 (subpackages: `d3-selection`, `d3-scale`, `d3-shape`, `d3-axis`, `d3-array`).

The diagram math and D3 rendering code under `src/d3_mollierhx/` is **vendored verbatim** from [retomarek/pyedautils](https://github.com/retomarek/pyedautils) (`pyedautils/data/d3_mollierhx/`, commit noted in each file header). Only ES6 imports/exports and a `let i, dt` declaration in `coordinateGenerator.js` (strict mode) were added; do not refactor the contents — keep them in sync with upstream by re-copying when pyedautils updates. Upstream's `mollierChart.js` is **not** vendored: it targets D3 v5 (`d3.mouse`, datum-first event handlers) and the card has its own Lit-based renderer.

## Commands

- `npm run build` — Parcel production build. Source is `src/mollier-hx-card.js`, output is `dist/`.
- `npm run watch` — Parcel watch mode for local development.

There are no tests, linter, or typechecker configured.

## Architecture

The build produces a single JS bundle `dist/mollier-hx-card.js` that Home Assistant loads as a Lovelace resource. The entry point is `src/mollier-hx-card.js` — the filename intentionally matches the bundle name so Parcel's default-target naming produces the right output without extra config (see the script in `package.json`).

Two custom elements are registered in `src/mollier-hx-card.js`:

- `mollier-hx-card` (`src/card.js`) — the card itself. Extends `LitElement`. Config options are documented in README.md. On first `hass` it fetches daily means via `recorder/statistics_during_period` into `_dailyData`; `set hass()` also tracks the live sensor values as `_currentPoint`. `updated()` draws (in z-order) the grid via `drawHXCoordinates()` (only when domain/pressure/convention change), the comfort zone + warning bands (`#comfort-zone`), the daily points (`#data-points`) and the live point (`#current-point`), using D3 scales built from `MARGIN`/`WIDTH`/`HEIGHT` and the configured domains. The band legend is rendered by Lit below the diagram. Iso-line visibility (`lines`, `parseLines`/`LINE_DEFAULTS`, exported for the editor) is passed to `drawHXCoordinates` as its `opts`; the right-edge captions are re-laid out by `_layoutRightCaptions()` (even spacing, font from text length, no layout needed).

Sizing: `layout` (set by HA: `grid`/`panel`/unset) and `grid_options.rows` decide the mode, reflected as the `fixed-height` attribute. Fixed: fill the tile. Auto: 600:420 aspect ratio, max 480 px tall, centred. `getGridOptions()` = `{columns: 12, min_columns: 6, min_rows: 7}` without default rows, like HA's statistics graph.
- `mollier-hx-card-editor` (`src/editor.js`) — visual editor (HA `<ha-form>`), translating between the flat form data and the nested YAML config. On each input change it clones `_config` and dispatches a bubbling+composed `config-changed` CustomEvent. **Never mutate `_config` in place** — Home Assistant treats it as read-only and relies on the cloned object in the event detail.

`src/bands.js` — warning bands (± offsets around the comfort zone), same schema and defaults as the separate comfort-compass-card, where the bands are the severity stages.

The D3 rendering module under `src/d3_mollierhx/`:
- `mollierFunctions.js` — pure thermodynamic math (`p_sat`, `enthalpy`, `get_x_y`, …). No D3 dependency.
- `coordinateGenerator.js` — `drawHXCoordinates(d3Selection, W, H, margin, domainX, domainY, p)` appends an SVG with axes, iso-temperature, iso-density, iso-RH, and iso-enthalpy lines. The SVG gets `id="hx_mollier_diagram"`.
- `drawComfort.js` — `drawComfort()` and `createComfort()`; `card.js` uses `createComfort()` for the comfort zone and the warning bands.
- `d3.js` — namespace adapter that re-exports the d3-subpackage symbols the vendored files reference as `d3.scaleLinear`, `d3.line`, etc.

Lit + D3 coexistence: Lit owns the `<div class="mollier-host">` container; D3 mutates inside it imperatively. Keep `render()` deterministic so Lit doesn't tear down the SVG. The `_drawn` flag prevents re-drawing axes on every reactive update.

Translations live in `src/localize/` (`languages/en.json` is the base and per-key fallback; `localize(hass, key, vars)`, language from `hass.locale.language`). Every user-visible string in the card and editor goes through it; add new keys to `en.json` and `de.json` together. The vendored `coordinateGenerator.js` draws English captions; `card.js` swaps them after drawing via `DIAGRAM_CAPTIONS` (exact text match), so after re-vendoring check that those caption strings are unchanged upstream. The language is part of the grid redraw hash.

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
- `docs/logo.svg` is generated from real psychrometric curves; `docs/social-preview.png` is the GitHub social preview (upload it manually under *Settings → General → Social preview*; there is no API for it).
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
