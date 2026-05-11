# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A Home Assistant custom Lovelace card distributed through HACS. Renders a Mollier hx (psychrometric) diagram from a temperature and humidity sensor pair, with a single data point that follows the live sensor values. Built with Lit + Parcel; rendering uses D3 (subpackages: `d3-selection`, `d3-scale`, `d3-shape`, `d3-axis`, `d3-array`).

The diagram math and D3 rendering code under `src/d3_mollier/` is **vendored verbatim** from [retomarek/pyedautils](https://github.com/retomarek/pyedautils) (`pyedautils/data/d3_mollier/`). Only ES6 imports/exports were added; do not refactor the contents — keep them in sync with upstream by re-copying when pyedautils updates.

## Commands

- `npm run build` — Parcel production build. Source is `src/index.js`, output is `dist/`.
- `npm run watch` — Parcel watch mode for local development.

There are no tests, linter, or typechecker configured.

## Architecture

The build produces a single JS bundle `dist/mollier-hx-card.js` that Home Assistant loads as a Lovelace resource. The entry point is `src/mollier-hx-card.js` — the filename intentionally matches the bundle name so Parcel's default-target naming produces the right output without extra config (see the script in `package.json`).

Two custom elements are registered in `src/mollier-hx-card.js`:

- `mollier-hx-card` (`src/card.js`) — the card itself. Extends `LitElement`. Config: `{ temperature_entity, humidity_entity, header?, pressure? }` (pressure defaults to 101325 Pa). The `set hass(hass)` setter parses both sensor states into `_t` (°C) and `_phi` (0..1, with auto-normalization from 0..100 RH%). `firstUpdated()` calls `drawHXCoordinates()` once into the `.mollier-host` div; `updated()` calls `_updatePoint()` which (re)positions a single `<circle id="data-point">` using `get_x_y(t, phi, p)` and locally-recreated D3 scales matching `DOMAIN_X`/`DOMAIN_Y`/`MARGIN`/`WIDTH`/`HEIGHT`.
- `mollier-hx-card-editor` (`src/editor.js`) — visual editor for the four config fields. On each input change it clones `_config` and dispatches a bubbling+composed `config-changed` CustomEvent. **Never mutate `_config` in place** — Home Assistant treats it as read-only and relies on the cloned object in the event detail.

The D3 rendering module under `src/d3_mollier/`:
- `mollier_functions.js` — pure thermodynamic math (`p_sat`, `enthalpy`, `get_x_y`, …). No D3 dependency.
- `CoordinateGenerator.js` — `drawHXCoordinates(d3Selection, W, H, margin, domainX, domainY, p)` appends an SVG with axes, iso-temperature, iso-density, iso-RH, and iso-enthalpy lines. The SVG gets `id="hx_mollier_diagram"`.
- `drawComfort.js` — `drawComfort()` and `createComfort()` for an optional comfort-zone polygon. Currently not invoked by `card.js` (single-sensor MVP).
- `d3.js` — namespace adapter that re-exports the d3-subpackage symbols the vendored files reference as `d3.scaleLinear`, `d3.line`, etc.

Lit + D3 coexistence: Lit owns the `<div class="mollier-host">` container; D3 mutates inside it imperatively. Keep `render()` deterministic so Lit doesn't tear down the SVG. The `_drawn` flag prevents re-drawing axes on every reactive update.

Styles live in `src/card.styles.js` as a tagged `css\`\`` template imported into `card.js`. The editor's styles are inlined.

`src/card.html` is a static reference of the rendered DOM shape; it is not imported or built — it exists as a layout sketch.

## Home Assistant integration notes

- `ha-card` is a Home Assistant-provided element; it is available at runtime in HA but not in this repo. Don't try to import or polyfill it.
- Service calls go through `this._hass.callService(domain, service, data)`.
- The card receives a fresh `hass` object on every state change in HA — the `set hass()` setter must stay cheap and idempotent.
