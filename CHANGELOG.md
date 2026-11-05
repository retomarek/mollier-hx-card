# Changelog

All notable changes to this card. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the card uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Translations for French, Italian, Spanish, Portuguese, Dutch, Polish, Swedish, Danish, Norwegian, Czech, Russian and Chinese (Simplified). They are machine-translated; corrections from native speakers are welcome as pull requests.

### Fixed

- The card no longer throws an error when it is drawn before it receives its configuration.

### Changed

- Build tools updated (Parcel 2.16, Puppeteer 25, Lit 3.3.3, GitHub actions checkout/setup-node v7).

## [1.0.0-beta.5] - 2026-11-05

Replaces 1.0.0-beta.4, which was published by mistake from the wrong commit and has no card file. Do not use beta.4.

### Added

- Names of the warning and alarm band can be set in the visual editor (empty = translated default).

### Changed

- Default axis ranges fit indoor climate: −10 to 40 °C and 0 to 18 g/kg (was −20 to 50 °C and 0 to 20 g/kg). The editor only writes the ranges when they differ from the defaults.
- README: why temperature and humidity belong together; installation via Marketplace / HACS only.

## [1.0.0-beta.3] - 2026-11-05

### Added

- Choose which iso-lines to show (`lines`, also in the editor). Density and enthalpy are off by default.
- Link to pyedautils, the Python Energy Data Analysis Utilities behind the card.
- Claude Code setup for contributors: `card-reviewer` agent, `visual-check` and `release` skills (`npm run visual-check`).

### Changed

- Sizing follows the dashboard: fills a sections tile with a fixed row count or panel view; otherwise keeps the 600:420 aspect ratio, capped at 480 px height and centred. Grid defaults: 12 columns, at least 6 columns and 7 rows; masonry size 10.
- Right-hand axis captions are stacked from the top of the axis and sized from their text, so "rel. humidity φ [%]" is no longer cut off.
- Minimum Home Assistant version is now 2024.11 (sections grid options).

### Fixed

- Fahrenheit sensors: statistics are requested in °C and the live point is converted.
- The diagram refreshes hourly and retries after a failed load, instead of keeping the data from page load.
- Only completed days are plotted; today's partial day no longer counts as a full day.
- A slow, outdated statistics response can no longer overwrite a newer one.
- The visual editor keeps settings it does not show (`grid_options`, `visibility`, `card_mod`, ...) and no longer writes an altitude or pressure on the first edit.
- The x-axis caption "x [g/kg]" no longer covers the last tick numbers; the right-hand captions start at the top of the axis; the legend fits on one line (limits shown on hover).
- "No statistics" is shown as a grey hint instead of an error.

### Removed

- The comfort compass moved to its own card, [comfort-compass-card](https://github.com/retomarek/comfort-compass-card). `show_compass` and `compass_scale` are ignored.

## [1.0.0-beta.2] - 2026-11-05

### Added

- Logo, social preview image and screenshots that are re-rendered automatically on every change.
- Issue templates, contributing guide, Dependabot.

### Changed

- Diagram, legend and comfort compass share one white chart sheet; the card frame follows the theme.
- Comfort compass zooms to its glyph and places each label at the end of its arm. `compass_scale: fixed` keeps a fixed scale for comparing rooms.
- Hover or tap a compass segment for days, share and the mild / moderate / severe split. The legend is more compact.
- Axis captions that would be clipped are shrunk to fit.

## [1.0.0-beta.1] - 2026-11-05

### Added

- Warning bands (`warning_bands`): orange and red dashed bands as ± offsets around the comfort zone.
- Comfort compass (`show_compass`), ported from pyedautils.
- Translations for card, diagram captions, compass and editor (English, German).
- Warning band and compass settings in the visual editor.
- Card version in the browser console, preview in the card picker.

### Changed

- Diagram code updated to pyedautils `data/d3_mollierhx`.
- Versioning switched to SemVer.

## [0.1.0] - 2025-05-27

- First release.

[Unreleased]: https://github.com/retomarek/mollier-hx-card/compare/v1.0.0-beta.5...HEAD
[1.0.0-beta.5]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-beta.5
[1.0.0-beta.3]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-beta.3
[1.0.0-beta.2]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-beta.1
[0.1.0]: https://github.com/retomarek/mollier-hx-card/releases/tag/v0.1.0
