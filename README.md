[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)

# Mollier hx Card

A custom [Home Assistant](https://www.home-assistant.io/) Lovelace card that draws a Mollier h-x (psychrometric) diagram from a temperature and humidity sensor pair. One dot per day is plotted from the recorder's daily-mean statistics, optionally coloured by season, age, or chronological order.

[![Open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=retomarek&repository=mollier-hx-card&category=Dashboard)

## Features

- Renders axes, iso-temperature, iso-density, iso-enthalpy and iso-relative-humidity lines.
- One point per day from `recorder/statistics_during_period` (long-term statistics).
- Three colouring modes — by season (northern-hemisphere calendar seasons), by age (opacity fade), or chronological (line connecting days in time order).
- Optional configurable indoor-comfort zone polygon.
- Optional orange/red **warning bands** around the comfort zone (dashed outlines, as in pyedautils).
- Optional **comfort compass**: an area-true glyph showing how the days split into *in range* and eight deviation directions (warm, humid, dry, cold and their mixes), graded mild / moderate / severe by the warning bands.
- Translated card, diagram captions and editor (English, German), following your Home Assistant language. English is the fallback.
- Configurable x and y axis ranges.
- Native-looking editor using HA's `<ha-form>` — entity pickers filtered to entities that have long-term statistics, expandable sections, dark-mode aware.
- Fully bundled; no CDN at runtime.

## Requirements

- The configured temperature and humidity sensors must have `state_class: measurement` so Home Assistant's recorder produces long-term statistics for them. Most native sensors (Zigbee, ESPHome, integrations like AirGradient or Netatmo) already do.

## Installation

### Marketplace / HACS (recommended)

From Home Assistant 2026.11 on, community cards are installed with the built-in **Marketplace** (Settings → Marketplace), which replaces HACS. On older versions use HACS. Both use the same catalog.

1. Search for **Mollier hx Card**.
   - Not listed yet? Marketplace: *Add from link* with `https://github.com/retomarek/mollier-hx-card`. HACS: three-dot menu → *Custom repositories*, type *Dashboard*.
2. Install it. The dashboard resource is added automatically.
3. Reload your browser.

Or use the badge above to open the repository directly inside your Home Assistant.

**Switching from a manual install:** remove your old resource (e.g. `/local/mollier-hx-card.js`) under *Settings → Dashboards → Resources* and delete the old file. If both are loaded, the browser refuses the second copy and the card may show an error.

### Manual

1. Download `mollier-hx-card.js` from the [latest release](https://github.com/retomarek/mollier-hx-card/releases) and copy it into `<config>/www/`
2. Add the resource: *Settings &rarr; Dashboards &rarr; three-dot menu &rarr; Resources &rarr; Add resource*
   - URL: `/local/mollier-hx-card.js`
   - Resource type: **JavaScript Module**
3. Hard-reload your browser (Ctrl+F5)

## Configuration

### Visual editor

Add a card to your dashboard, search for **Mollier hx card** in the custom card picker, and fill in the form.

### YAML

```yaml
type: custom:mollier-hx-card
temperature_entity: sensor.living_room_temperature
humidity_entity: sensor.living_room_humidity
header: Living room
days: 14
coloring: season
comfort_zone:
  temperature: [20, 26]
  humidity: [30, 60]
  absolute_humidity: [0, 12]
warning_bands:
  orange: { temperature: 1, humidity: 5, absolute_humidity: 1 }
  red: { temperature: 2.5, humidity: 10, absolute_humidity: 2.5 }
show_compass: true
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `temperature_entity` | string | — | **Required.** Entity ID of the temperature sensor. |
| `humidity_entity` | string | — | **Required.** Entity ID of the relative-humidity sensor. Values in either 0..1 or 0..100 are auto-detected. |
| `header` | string | — | Optional card header. |
| `days` | number | `7` | How many days of history to display. The recorder keeps long-term statistics for one year by default. |
| `coloring` | string | `season` | One of `season`, `age`, `chronological`. |
| `pressure` | number | `101325` | Ambient air pressure in Pa. Mutually exclusive with `altitude`. |
| `altitude` | number | — | Altitude in m above sea level. When set, the pressure is computed from the International Standard Atmosphere (valid up to ~5000 m) and overrides `pressure`. |
| `convention` | string | `classical` | Mollier coordinate convention. `classical` (per kg of dry air, Recknagel/Sprenger — isotherms tilt slightly *up* with x) or `glueck` (per kg of moist air — isotherms tilt slightly *down*). Physical quantities are identical; only the (x, y) parametrisation differs. |
| `domain_x` | `[min, max]` | `[0, 20]` | Visible range of the absolute-humidity axis, in **g/kg**. |
| `domain_y` | `[min, max]` | `[-20, 50]` | Visible range of the temperature axis, in **°C**. |
| `comfort_zone` | object | — | Optional. Draws a translucent yellow-green polygon for an indoor-comfort range. See below. |
| `warning_bands` | `true` \| object | — | Optional, needs `comfort_zone`. Dashed orange/red bands around the comfort zone. `true` uses the defaults. See below. |
| `show_compass` | boolean | `false` | Optional, needs `comfort_zone`. Shows the comfort compass below the diagram. |

#### `comfort_zone`

```yaml
comfort_zone:
  temperature: [20, 26]        # min, max in °C
  humidity: [30, 60]           # min, max in % RH
  absolute_humidity: [0, 12]   # min, max in g/kg
```

All three sub-ranges are required when the object is present. The polygon is the intersection of the three constraints; set `absolute_humidity: [0, 1000]` to make it effectively unbounded.

#### `warning_bands`

Each band is given as a **± offset around the comfort zone**: temperature in K, relative humidity in %-points, absolute humidity in g/kg. Missing values use the defaults (the stage limits of `pyedautils.comfort.comfort_compass_distribution`):

| Band | `temperature` | `humidity` | `absolute_humidity` | default `color` |
| --- | --- | --- | --- | --- |
| `orange` | 1 | 5 | 1 | `#E67E22` |
| `red` | 2.5 | 10 | 2.5 | `#C0392B` |

Optional `label` and `color` per band override the legend text and line colour.

#### Comfort compass

One count per day (the same daily means as the diagram). Each day is classified against the comfort zone; humidity counts as too high or too low if **either** the relative or the absolute limit is exceeded. The severity follows the warning bands: *mild* = inside the orange band, *moderate* = inside the red band, *severe* = outside. Without `warning_bands` the compass uses the default offsets above. The worse axis decides the stage.

The glyph is area-true: the green centre disc's area is the share of days in range, and each wedge's area is the share of days in that direction. Warm is at the top, cold at the bottom, humid on the right and dry on the left, the same orientation as the h,x diagram. Hover any segment for its count.

## How it works

The thermodynamic math and D3 rendering code under `src/d3_mollierhx/` is vendored from [retomarek/pyedautils](https://github.com/retomarek/pyedautils), so the output of this card is visually identical to `pyedautils.plots.plot_mollier_hx()`.

Daily means are fetched once per card via Home Assistant's `recorder/statistics_during_period` WebSocket API and rendered with D3 inside a Lit `LitElement` custom component.

## Translations

The card follows the language set in your Home Assistant profile. Available: English, German. Missing languages and missing keys fall back to English.

To add a language, copy `src/localize/languages/en.json` to `<language code>.json`, translate the values (keep the keys), register the file in `src/localize/localize.js` and open a pull request.

## License

[MIT](LICENSE)

## Credits

- [retomarek/pyedautils](https://github.com/retomarek/pyedautils) — diagram math, D3 rendering code, warning bands and comfort compass.
- Thermodynamic relations from chapter 2.1 / 2.2 of *Glück: Zustands- und Stoffwerte — Wasser — Dampf — Luft*.

## Contributing

PRs and feedback welcome. Open an issue for bugs or feature requests.
