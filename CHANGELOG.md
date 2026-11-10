# Changelog

All notable changes to this card. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the card uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0-rc.6] - 2026-11-10

### Added

- The legend lists the live room point ("Now", black dot) whenever it is shown; hover shows its temperature, humidity and absolute humidity.
- `show_legend` (default on): `false` hides the legend below the diagram. Editor switch under Lines.

### Changed

- Diagram code updated to pyedautils 0.0.34 (= d3-mollierhx v0.2.1). Nothing changes in the card: the update only adds the label placement for frequency contour lines, which the card does not draw.

## [1.0.0-rc.5] - 2026-11-06

### Changed

- Diagram code updated to pyedautils f9ba0da (= d3-mollierhx v0.2.0). The diagram looks the same: the caption layout (captions fitted to the height, x caption beside the end of the axis) and the room and outside points with their edge arrows, which the card used to adjust itself, are now part of the diagram code. With density and enthalpy lines switched on, the three right-edge captions share one font size.
- A value next to an edge arrow near a corner of the diagram stays inside the axes.

## [1.0.0-rc.4] - 2026-11-06

### Added

- Zoom with a mouse: + / − buttons over the diagram (shown on devices with a mouse), double-click to zoom in at the pointer or back to 1:1, ctrl + wheel. The 1:1 button appears to the left, so + and − never move under the pointer.

## [1.0.0-rc.3] - 2026-11-06

### Fixed

- Dates in tooltips follow the Home Assistant profile's date format (language, system, day-month-year …), like the rest of Home Assistant, e.g. 14.9.2026 instead of 9/14/2026 with a German language or the "System" format on a German or Swiss device.

## [1.0.0-rc.2] - 2026-11-06

Second release candidate for 1.0.0, from the mobile test.

### Added

- Zoom the diagram on touch devices: pinch (up to 4×), drag to pan, double-tap to zoom in / back, "1:1" button to reset; ctrl + wheel or trackpad pinch on a computer. Legend and title do not zoom.

### Changed

- Larger touch targets: 44 px for the live room and outside points, 24 px for daily points (on screen, whatever the diagram size).

## [1.0.0-rc.1] - 2026-11-06

Release candidate for 1.0.0: this code becomes 1.0.0 if no problems turn up.

### Changed

- Editor suggestion for a new comfort zone: relative humidity 30–65 % (was 30–60 %), as in pyedautils.

### Removed

- Aliases for the pre-1.0 option names. Use the names from the README (`title`, `days_to_show`, `x_range`, `temperature_range`, `lines.humidity`).

## [1.0.0-beta.8] - 2026-11-06

### Added

- Q&A discussions for questions and ideas (one short template); issues stay for bugs and features. README: "Questions and feedback".
- A missing room or outside entity is named above the diagram ("Entity not found: ...").
- Hint when the comfort zone looks like °F (temperatures above 45): the card expects °C.
- Visual editor: switch for the absolute-humidity limit of the comfort zone.

### Changed

- Options renamed for 1.0; the old names keep working: `header` → `title`, `days` → `days_to_show`, `domain_x` → `x_range`, `domain_y` → `temperature_range`, `lines.relative_humidity` → `lines.humidity`. The new name wins if both are set; the visual editor writes the new names and removes the old ones.
- `comfort_zone.absolute_humidity` is optional (no limit when left out); `temperature` and `humidity` are required.
- Invalid settings give a clear error instead of being ignored: `coloring`, `convention`, an incomplete `comfort_zone`, `days_to_show` below 1, an `altitude` or `pressure` out of range.
- `pressure` is accepted in hPa or Pa. `days_to_show` goes up to 3650 (also in the editor).
- Humidity sensors are read as %; a value is only taken as a fraction 0..1 when the sensor has no unit and all values are ≤ 1.
- The new-card picker suggests real temperature and humidity sensors with long-term statistics and no longer sets an altitude.
- The visual editor no longer adds an absolute-humidity limit to a comfort zone that had none, and a cleared number field falls back to the previous value or the default instead of writing an empty value.

### Fixed

- Errors no longer hide the diagram: the diagram with the current room and outside points is always drawn, messages appear in a line above it.
- A failed load is retried with a growing delay (30 s up to 10 min); a failed hourly refresh keeps the data already shown. Changing the sensors or the period clears the old points.
- Days in the tooltip are shown in Home Assistant's time zone and date format (were UTC dates).
- Comfort zone, bands, daily points and outside means are cut off at the axes instead of being drawn over them. A current room point outside the axes is shown as an arrow on the edge with its value, like the outside point.
- Tooltips of the daily points and the current room point open on tap too; tap again or on the diagram to close, and they close by themselves after 5 s.
- Captions and legend follow a language change without reloading the dashboard.
- README: long-term statistics are kept indefinitely, not for a year.

## [1.0.0-beta.7] - 2026-11-06

### Added

- Outside air (optional): current outside point from sensors or a weather entity, outside daily means (`outdoor_history`) and a ventilation line with "ventilating dries / adds moisture" in the legend. Points beyond the axes are shown as an arrow on the edge. Also in the visual editor, translated into all 14 languages.
- README: link to Wikipedia (Mollier diagram); the h,x diagram in five minutes, with the dew point and mould risk at cold surfaces and examples for ventilating in winter, heating less (comfort and energy) and airing a cellar in summer.

## [1.0.0-beta.6] - 2026-11-06

### Changed

- README starts with a banner (logo, name, claim); `npm run social-preview` renders it together with the social preview.

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

[Unreleased]: https://github.com/retomarek/mollier-hx-card/compare/v1.0.0-rc.6...HEAD
[1.0.0-rc.6]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-rc.6
[1.0.0-rc.5]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-rc.5
[1.0.0-rc.4]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-rc.4
[1.0.0-rc.3]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-rc.3
[1.0.0-rc.2]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-rc.2
[1.0.0-rc.1]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-rc.1
[1.0.0-beta.8]: https://github.com/retomarek/mollier-hx-card/compare/v1.0.0-beta.7...v1.0.0-beta.8
[1.0.0-beta.7]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-beta.7
[1.0.0-beta.6]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-beta.6
[1.0.0-beta.5]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-beta.5
[1.0.0-beta.3]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-beta.3
[1.0.0-beta.2]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-beta.1
[0.1.0]: https://github.com/retomarek/mollier-hx-card/releases/tag/v0.1.0
