# Changelog

All notable changes to this card. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the card uses [Semantic Versioning](https://semver.org/). Until 1.0.0, released together with the [Comfort Compass Card](https://github.com/retomarek/comfort-compass-card), a minor version may change the configuration.

## [Unreleased]

## [0.1.0] - 2026-11-26

First public version. The earlier 0.1.0, 1.0.0 betas and release candidates were withdrawn; nobody needs to migrate.

### Added

- Mollier h,x diagram from the daily means of a temperature and a humidity sensor (Home Assistant long-term statistics): one point per day, coloured by season, by age or joined in time order (`coloring`), plus the live room point.
- Iso-lines to choose (`lines`: temperature, relative and absolute humidity, density, enthalpy), axis ranges (`x_range`, `temperature_range`), the air pressure from the elevation set in Home Assistant (`altitude` or `pressure` override it; `show_pressure` writes it above the diagram), `convention` (classical or Glück).
- Comfort zone (`comfort_zone`) and orange / red warning bands (`warning_bands`) with the same schema as the Comfort Compass Card.
- Outside air: current outside point from sensors or a weather entity, outside daily means (`outdoor_history`) and a ventilation line that tells whether airing dries the room or adds moisture (`ventilation_line`).
- Legend (`show_legend`), tooltips with dew point and water content, zoom up to 4× (pinch, buttons, double-click, ctrl + wheel).
- Sizing for masonry, sections (auto height or fixed rows) and panel views.
- Visual editor that writes only non-default values and keeps other keys.
- 14 languages (English and German by the author, the others machine-translated).
- Robust loading: a slow first load says so, a hanging request is retried, a missing sensor or empty statistics show a translated message.
- [Live demo](https://retomarek.github.io/mollier-hx-card/) of both cards, with sample rooms and the YAML to copy.

### Development

- Unit tests (vitest), ESLint and Prettier, CI on every push, and a check that the code shared with the Comfort Compass Card is identical in both repositories.

[Unreleased]: https://github.com/retomarek/mollier-hx-card/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/retomarek/mollier-hx-card/releases/tag/v0.1.0
