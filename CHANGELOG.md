# Changelog

All notable changes to this card. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the card uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/retomarek/mollier-hx-card/compare/v1.0.0-beta.2...HEAD
[1.0.0-beta.2]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/retomarek/mollier-hx-card/releases/tag/v1.0.0-beta.1
[0.1.0]: https://github.com/retomarek/mollier-hx-card/releases/tag/v0.1.0
