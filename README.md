[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)

# Mollier hx Card

A custom [Home Assistant](https://www.home-assistant.io/) Lovelace card that plots a Mollier hx (psychrometric) diagram from any temperature and humidity sensor pair. One dot per day is drawn from the long-term statistics of the configured sensors, with optional colouring by season, age, or chronological order.

![Screenshot placeholder](./docs/screenshot.png)

> Replace the screenshot above by adding a PNG at `docs/screenshot.png`.

## Features

- Renders axes, iso-temperature, iso-density, iso-enthalpy and iso-relative-humidity lines.
- Plots one point per day from the recorder's daily-mean statistics of the configured sensors.
- Three colouring modes:
  - **By season** — northern-hemisphere calendar seasons (Winter blue, Spring teal, Summer gold, Fall brown).
  - **By age** — points fade from 25 % opacity (oldest) to 100 % (newest).
  - **Chronological** — uniform colour with a thin line connecting the days in time order.
- Hover any point to see date, absolute humidity (g/kg), temperature (°C) and relative humidity (%).
- Fully bundled — no CDN requests, works offline.

## Requirements

- The configured temperature and humidity sensors must have `state_class: measurement` so Home Assistant's recorder produces long-term statistics for them. Most native sensors (e.g. from Zigbee, ESPHome, integrations like AirGradient or Netatmo) already do.

## Installation

### HACS (recommended)

1. In HACS &rarr; Frontend &rarr; *Custom repositories*, add `https://github.com/retomarek/mollier-hx-card` as type *Lovelace*.
2. Install **Mollier hx Card** from the list.
3. Hard-reload your browser (Ctrl+F5) so Home Assistant picks up the new module.

### Manual

1. Download `mollier-hx-card.js` from the [latest release](https://github.com/retomarek/mollier-hx-card/releases) and copy it into `<config>/www/`.
2. Add the resource: *Settings &rarr; Dashboards &rarr; three-dot menu &rarr; Resources &rarr; Add resource*
   - URL: `/local/mollier-hx-card.js`
   - Resource type: **JavaScript Module**
3. Hard-reload your browser (Ctrl+F5).

## Configuration

### Visual editor

Add a card to your dashboard, search for **Mollier hx card** in the custom card picker, and fill in the fields.

### YAML

```yaml
type: custom:mollier-hx-card
temperature_entity: sensor.living_room_temperature
humidity_entity: sensor.living_room_humidity
header: Living room
days: 14
coloring: season
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `temperature_entity` | string | — | **Required.** Entity ID of the temperature sensor. |
| `humidity_entity` | string | — | **Required.** Entity ID of the relative-humidity sensor. Values in either 0..1 or 0..100 are auto-detected. |
| `header` | string | — | Optional card header shown above the diagram. |
| `days` | number | `7` | How many days of history to display. The recorder keeps long-term statistics for one year by default. |
| `coloring` | string | `season` | One of `season`, `age`, `chronological`. |
| `pressure` | number | `101325` | Ambient air pressure in Pa. Only adjust this if you are above ~500 m. |
| `domain_x` | `[min, max]` | `[0, 20]` | Visible range of the absolute-humidity axis, in **g/kg**. |
| `domain_y` | `[min, max]` | `[-20, 50]` | Visible range of the temperature axis, in **°C**. |
| `comfort_zone` | object | — | Optional. Draws a translucent yellow-green polygon for an indoor-comfort range. See below. |

#### `comfort_zone`

```yaml
comfort_zone:
  temperature: [20, 26]        # min, max in °C
  humidity: [30, 60]           # min, max in % RH
  absolute_humidity: [0, 12]   # min, max in g/kg
```

All three sub-ranges are required when the object is present. The polygon is the intersection of the three constraints; if you only need a temperature/humidity rectangle, set `absolute_humidity: [0, 1000]` to make it effectively unbounded.

## How it works

The thermodynamic math and D3 rendering code under `src/d3_mollier/` is vendored from [retomarek/pyedautils](https://github.com/retomarek/pyedautils), the Python energy-data utilities library, so the output of this card is visually identical to `pyedautils.plots.plot_mollier_hx()`.

Daily means are fetched once per card via Home Assistant's `recorder/statistics_during_period` WebSocket API and rendered with D3 inside a Lit `LitElement` custom component.

## Credits

- [retomarek/pyedautils](https://github.com/retomarek/pyedautils) — diagram math and D3 rendering code.
- The thermodynamic relations follow chapter 2.1 / 2.2 of *Glück: Zustands- und Stoffwerte — Wasser — Dampf — Luft*.

## License

[MIT](./LICENSE) &copy; Reto Marek.
