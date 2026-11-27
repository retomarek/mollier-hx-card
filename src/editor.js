import { html, LitElement } from 'lit';
import { formatNumber, localize } from './localize/localize.js';
import { LINE_DEFAULTS, parseLines } from './card.js';
import {
    ALTITUDE_RANGE,
    ALTITUDE_RANGE_FT,
    elevationOf,
    MAX_DAYS,
    pressureAtAltitude,
    PRESSURE_INHG_RANGE,
    PRESSURE_PA_RANGE,
} from './statistics.js';
import { convertConfigUnits, mToFt, paToInhg, unitSystem, UNITS, UNITS_OPTIONS } from './units.js';

const LINE_KEYS = Object.keys(LINE_DEFAULTS);

// The editor uses HA's <ha-form> (loaded by HA's frontend at runtime — not on
// npm). The form's data model is flat; the YAML config is nested. The pair of
// configToData / dataToConfig translates between them.

const DEFAULTS = {
    days: 7,
    coloring: 'season',
    pressure: 101325, // only a suggestion when the user switches to pressure (sea level)
    altitude: 450, // only a suggestion when the user switches to altitude
    air_mode: 'home',
    convention: 'classical',
    x_min: 0, // g/kg
    x_max: 18, // g/kg
    y_min: -10, // °C
    y_max: 40, // °C
    comfort_t_min: 20,
    comfort_t_max: 26,
    comfort_phi_min: 30,
    comfort_phi_max: 65,
    comfort_x_min: 0,
    comfort_x_max: 12,
    // Warning-band offsets around the comfort zone (pyedautils defaults).
    orange_dt: 1,
    orange_dphi: 5,
    orange_dx: 1,
    red_dt: 2.5,
    red_dphi: 10,
    red_dx: 2.5,
};

// The values above are metric (°C, K, g/kg, m, Pa). With imperial units the
// form works in °F, °F, gr/lb, ft and inHg; these replace them (src/units.js
// has the same comfort zone and bands).
const IMPERIAL_DEFAULTS = {
    pressure: 29.92,
    altitude: 1500,
    x_min: 0, // gr/lb
    x_max: 180,
    y_min: 10, // °F
    y_max: 110,
    comfort_t_min: 68,
    comfort_t_max: 79,
    comfort_x_min: 0,
    comfort_x_max: 84,
    orange_dt: 2,
    orange_dx: 7,
    red_dt: 4.5,
    red_dx: 17.5,
};
const defaultsFor = (system) => (system === 'imperial' ? { ...DEFAULTS, ...IMPERIAL_DEFAULTS } : DEFAULTS);

// Home Assistant's elevation and the pressure there, in the units of `system`.
const homeAltitude = (hass, system) => {
    const e = elevationOf(hass);
    return e === null ? undefined : system === 'imperial' ? Math.round(mToFt(e)) : e;
};
const homePressure = (hass, system) => {
    const e = elevationOf(hass);
    if (e === null) return undefined;
    const pa = pressureAtAltitude(e);
    return system === 'imperial' ? Math.round(paToInhg(pa) * 100) / 100 : Math.round(pa);
};

export function configToData(config, hass = undefined) {
    const c = config || {};
    const system = unitSystem(c, hass);
    const D = defaultsFor(system);
    const hasAltitude = c.altitude !== undefined && c.altitude !== null && c.altitude !== '';
    const hasPressure = c.pressure !== undefined && c.pressure !== null && c.pressure !== '';
    const xr = c.x_range;
    const yr = c.temperature_range;
    const cz = c.comfort_zone && typeof c.comfort_zone === 'object' ? c.comfort_zone : null;
    return {
        units: UNITS_OPTIONS.includes(c.units) ? c.units : 'auto',
        header: c.title ?? '',
        temperature_entity: c.temperature_entity ?? '',
        humidity_entity: c.humidity_entity ?? '',
        days: c.days_to_show ?? D.days,
        coloring: c.coloring ?? D.coloring,
        // Neither altitude nor pressure: the elevation set in Home Assistant.
        air_mode: hasAltitude ? 'altitude' : hasPressure ? 'pressure' : 'home',
        // Suggestion when switching to a pressure: the one at Home Assistant's elevation.
        pressure: c.pressure ?? homePressure(hass, system) ?? D.pressure,
        // Suggestion when switching to an own altitude: Home Assistant's.
        altitude: c.altitude ?? homeAltitude(hass, system) ?? D.altitude,
        convention: c.convention ?? D.convention,
        x_min: xr?.[0] ?? D.x_min,
        x_max: xr?.[1] ?? D.x_max,
        y_min: yr?.[0] ?? D.y_min,
        y_max: yr?.[1] ?? D.y_max,
        comfort_enabled: !!cz,
        comfort_t_min: cz?.temperature?.[0] ?? D.comfort_t_min,
        comfort_t_max: cz?.temperature?.[1] ?? D.comfort_t_max,
        comfort_phi_min: cz?.humidity?.[0] ?? D.comfort_phi_min,
        comfort_phi_max: cz?.humidity?.[1] ?? D.comfort_phi_max,
        // The absolute-humidity limit is optional: only on when the zone has one.
        comfort_x_enabled: Array.isArray(cz?.absolute_humidity),
        comfort_x_min: cz?.absolute_humidity?.[0] ?? D.comfort_x_min,
        comfort_x_max: cz?.absolute_humidity?.[1] ?? D.comfort_x_max,
        ...Object.fromEntries(Object.entries(parseLines(c.lines)).map(([k, v]) => [`line_${k}`, v])),
        outdoor_temperature_entity: c.outdoor_temperature_entity ?? '',
        outdoor_humidity_entity: c.outdoor_humidity_entity ?? '',
        outdoor_weather_entity: c.outdoor_weather_entity ?? '',
        outdoor_history: c.outdoor_history === true,
        ventilation_line: c.ventilation_line !== false,
        show_legend: c.show_legend !== false,
        show_pressure: c.show_pressure === true,
        bands_enabled: !!c.warning_bands,
        orange_dt: c.warning_bands?.orange?.temperature ?? D.orange_dt,
        orange_dphi: c.warning_bands?.orange?.humidity ?? D.orange_dphi,
        orange_dx: c.warning_bands?.orange?.absolute_humidity ?? D.orange_dx,
        red_dt: c.warning_bands?.red?.temperature ?? D.red_dt,
        red_dphi: c.warning_bands?.red?.humidity ?? D.red_dphi,
        red_dx: c.warning_bands?.red?.absolute_humidity ?? D.red_dx,
        orange_label: c.warning_bands?.orange?.label ?? '',
        red_label: c.warning_bands?.red?.label ?? '',
    };
}

// Keys this form owns. Everything else in the existing config (grid_options,
// visibility, view_layout, card_mod, YAML-only options) is kept as it is.
const OWNED_KEYS = [
    'type',
    'temperature_entity',
    'humidity_entity',
    'title',
    'days_to_show',
    'coloring',
    'convention',
    'x_range',
    'temperature_range',
    'lines',
    'altitude',
    'pressure',
    'comfort_zone',
    'warning_bands',
    'outdoor_temperature_entity',
    'outdoor_humidity_entity',
    'outdoor_weather_entity',
    'outdoor_history',
    'ventilation_line',
    'show_legend',
    'show_pressure',
    'units',
];

// A cleared number field (undefined / null / '') falls back to the previous
// config value, then to the default, so a [min, max] pair never gets a null.
const isNum = (v) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));
const pickNum = (...candidates) => {
    for (const v of candidates) if (isNum(v)) return Number(v);
    return undefined;
};

export function dataToConfig(data, previous = {}, hass = undefined) {
    const units = UNITS_OPTIONS.includes(data.units) ? data.units : previous.units;
    const D = defaultsFor(unitSystem({ units }, hass));
    const config = { ...previous };
    for (const k of OWNED_KEYS) delete config[k];
    const prevX = previous.x_range;
    const prevY = previous.temperature_range;
    const prevCz = previous.comfort_zone && typeof previous.comfort_zone === 'object' ? previous.comfort_zone : {};
    const prevBands =
        typeof previous.warning_bands === 'object' && previous.warning_bands ? previous.warning_bands : {};
    const n = (field, prev) => pickNum(data[field], prev, D[field]);

    Object.assign(config, {
        type: 'custom:mollier-hx-card',
        temperature_entity: data.temperature_entity,
        humidity_entity: data.humidity_entity,
    });
    if (units === 'metric' || units === 'imperial') config.units = units;
    // Like the comfort-compass-card editor: defaults stay out of the YAML.
    const days = Math.min(MAX_DAYS, Math.max(1, Math.round(n('days', previous.days_to_show))));
    if (days !== D.days) config.days_to_show = days;
    const coloring = data.coloring || D.coloring;
    if (coloring !== D.coloring) config.coloring = coloring;
    const convention = data.convention || D.convention;
    if (convention !== D.convention) config.convention = convention;
    // Write the axis ranges only when they differ from the card defaults, so
    // the card follows future default changes.
    const x = [n('x_min', prevX?.[0]), n('x_max', prevX?.[1])];
    const y = [n('y_min', prevY?.[0]), n('y_max', prevY?.[1])];
    if (x[0] !== D.x_min || x[1] !== D.x_max) config.x_range = x;
    if (y[0] !== D.y_min || y[1] !== D.y_max) config.temperature_range = y;
    if (data.header) config.title = data.header;
    // Store only the lines that differ from the defaults, to keep YAML short.
    const lines = {};
    for (const k of LINE_KEYS) {
        const v = data[`line_${k}`];
        if (typeof v === 'boolean' && v !== LINE_DEFAULTS[k]) lines[k] = v;
    }
    if (Object.keys(lines).length) config.lines = lines;
    // Outside air: only what is set; defaults stay out of the YAML.
    for (const k of ['outdoor_temperature_entity', 'outdoor_humidity_entity', 'outdoor_weather_entity']) {
        if (data[k]) config[k] = data[k];
    }
    const hasOutdoor = data.outdoor_temperature_entity || data.outdoor_weather_entity;
    if (hasOutdoor && data.outdoor_history) config.outdoor_history = true;
    if (hasOutdoor && data.ventilation_line === false) config.ventilation_line = false;
    if (data.show_legend === false) config.show_legend = false;
    if (data.show_pressure === true) config.show_pressure = true;
    // Persist either pressure or altitude, never both; 'home' (the default)
    // writes neither, so the card takes the elevation set in Home Assistant.
    if (data.air_mode === 'altitude') {
        config.altitude = n('altitude', previous.altitude);
    } else if (data.air_mode === 'pressure') {
        config.pressure = n('pressure', previous.pressure);
    }
    if (data.comfort_enabled) {
        // Keep YAML-only keys of the zone; absolute_humidity only when switched on.
        const cz = {
            ...prevCz,
            temperature: [n('comfort_t_min', prevCz.temperature?.[0]), n('comfort_t_max', prevCz.temperature?.[1])],
            humidity: [n('comfort_phi_min', prevCz.humidity?.[0]), n('comfort_phi_max', prevCz.humidity?.[1])],
        };
        delete cz.absolute_humidity;
        if (data.comfort_x_enabled) {
            cz.absolute_humidity = [
                n('comfort_x_min', prevCz.absolute_humidity?.[0]),
                n('comfort_x_max', prevCz.absolute_humidity?.[1]),
            ];
        }
        config.comfort_zone = cz;
        if (data.bands_enabled) {
            // Keep YAML-only keys (color); an empty name falls back to the
            // translated default ("Warning band" / "Alarm band").
            const band = (k) => {
                const pb = prevBands[k] || {};
                const b = {
                    ...pb,
                    temperature: n(`${k}_dt`, pb.temperature),
                    humidity: n(`${k}_dphi`, pb.humidity),
                    absolute_humidity: n(`${k}_dx`, pb.absolute_humidity),
                };
                const name = (data[`${k}_label`] || '').trim();
                if (name) b.label = name;
                else delete b.label;
                return b;
            };
            config.warning_bands = { orange: band('orange'), red: band('red') };
        }
    }
    return config;
}

const bandRow = (key, U) => ({
    type: 'grid',
    schema: [
        {
            name: `${key}_dt`,
            selector: { number: { min: 0, step: 'any', mode: 'box', unit_of_measurement: U.delta.unit } },
        },
        {
            name: `${key}_dphi`,
            selector: { number: { min: 0, max: 100, step: 1, mode: 'box', unit_of_measurement: '%' } },
        },
        {
            name: `${key}_dx`,
            selector: { number: { min: 0, step: 'any', mode: 'box', unit_of_measurement: U.absHumidity.unit } },
        },
    ],
});

const tempSel = (U) => ({ number: { step: U.temperature.step, mode: 'box', unit_of_measurement: U.temperature.unit } });
const comfortFields = (U) => [
    {
        type: 'grid',
        schema: [
            { name: 'comfort_t_min', selector: tempSel(U) },
            { name: 'comfort_t_max', selector: tempSel(U) },
        ],
    },
    {
        type: 'grid',
        schema: [
            {
                name: 'comfort_phi_min',
                selector: { number: { min: 0, max: 100, step: 1, mode: 'box', unit_of_measurement: '%' } },
            },
            {
                name: 'comfort_phi_max',
                selector: { number: { min: 0, max: 100, step: 1, mode: 'box', unit_of_measurement: '%' } },
            },
        ],
    },
    { name: 'comfort_x_enabled', selector: { boolean: {} } },
];

const absSel = (U) => ({
    number: { min: 0, step: U.absHumidity.step, mode: 'box', unit_of_measurement: U.absHumidity.unit },
});
const comfortXFields = (U) => [
    {
        type: 'grid',
        schema: [
            { name: 'comfort_x_min', selector: absSel(U) },
            { name: 'comfort_x_max', selector: absSel(U) },
        ],
    },
];

function buildSchema(data, t, hass) {
    const system = unitSystem({ units: data.units }, hass);
    const U = UNITS[system];
    const imperial = system === 'imperial';
    const elevation = elevationOf(hass);
    return [
        { name: 'header', selector: { text: {} } },
        {
            type: 'grid',
            schema: [
                // Use the statistic selector so only entities with long-term
                // statistics (state_class: measurement) appear, and filter by
                // device_class to pre-narrow to the right sensor type.
                {
                    name: 'temperature_entity',
                    required: true,
                    selector: { statistic: { device_class: 'temperature' } },
                },
                { name: 'humidity_entity', required: true, selector: { statistic: { device_class: 'humidity' } } },
            ],
        },
        {
            type: 'grid',
            schema: [
                { name: 'days', selector: { number: { min: 1, max: MAX_DAYS, step: 1, mode: 'box' } } },
                {
                    name: 'coloring',
                    selector: {
                        select: {
                            mode: 'dropdown',
                            options: [
                                { value: 'season', label: t('editor.options.season') },
                                { value: 'age', label: t('editor.options.age') },
                                { value: 'chronological', label: t('editor.options.chronological') },
                            ],
                        },
                    },
                },
            ],
        },
        {
            type: 'grid',
            schema: [
                {
                    // auto: Home Assistant's unit system (°F = US customary → imperial).
                    name: 'units',
                    selector: {
                        select: {
                            mode: 'dropdown',
                            options: UNITS_OPTIONS.map((u) => ({ value: u, label: t(`editor.options.units_${u}`) })),
                        },
                    },
                },
                {
                    name: 'air_mode',
                    selector: {
                        select: {
                            mode: 'dropdown',
                            options: [
                                {
                                    value: 'home',
                                    label:
                                        elevation === null
                                            ? t('editor.options.home_unset')
                                            : imperial
                                              ? t('editor.options.home_ip', {
                                                    ft: formatNumber(hass, mToFt(elevation)),
                                                })
                                              : t('editor.options.home', { m: formatNumber(hass, elevation) }),
                                },
                                {
                                    value: 'altitude',
                                    label: t(imperial ? 'editor.options.altitude_ip' : 'editor.options.altitude'),
                                },
                                {
                                    value: 'pressure',
                                    label: t(imperial ? 'editor.options.pressure_ip' : 'editor.options.pressure'),
                                },
                            ],
                        },
                    },
                },
                ...(data.air_mode === 'altitude'
                    ? [
                          {
                              name: 'altitude',
                              selector: {
                                  number: {
                                      min: (imperial ? ALTITUDE_RANGE_FT : ALTITUDE_RANGE)[0],
                                      max: (imperial ? ALTITUDE_RANGE_FT : ALTITUDE_RANGE)[1],
                                      step: U.altitude.step,
                                      mode: 'box',
                                      unit_of_measurement: U.altitude.unit,
                                  },
                              },
                          },
                      ]
                    : data.air_mode === 'pressure'
                      ? [
                            {
                                name: 'pressure',
                                selector: {
                                    number: imperial
                                        ? {
                                              min: PRESSURE_INHG_RANGE[0],
                                              max: PRESSURE_INHG_RANGE[1],
                                              step: 0.01,
                                              mode: 'box',
                                              unit_of_measurement: 'inHg',
                                          }
                                        : {
                                              min: PRESSURE_PA_RANGE[0],
                                              max: PRESSURE_PA_RANGE[1],
                                              step: 1,
                                              mode: 'box',
                                              unit_of_measurement: 'Pa',
                                          },
                                },
                            },
                        ]
                      : []),
                {
                    name: 'convention',
                    selector: {
                        select: {
                            mode: 'dropdown',
                            options: [
                                { value: 'classical', label: t('editor.options.classical') },
                                { value: 'glueck', label: t('editor.options.glueck') },
                            ],
                        },
                    },
                },
            ],
        },
        {
            type: 'expandable',
            title: t('editor.sections.lines'),
            schema: [
                {
                    type: 'grid',
                    schema: [
                        ...LINE_KEYS.map((k) => ({ name: `line_${k}`, selector: { boolean: {} } })),
                        { name: 'show_legend', selector: { boolean: {} } },
                        { name: 'show_pressure', selector: { boolean: {} } },
                    ],
                },
            ],
        },
        {
            type: 'expandable',
            title: t('editor.sections.outdoor'),
            expanded: !!(data.outdoor_temperature_entity || data.outdoor_weather_entity),
            schema: [
                {
                    type: 'grid',
                    schema: [
                        {
                            name: 'outdoor_temperature_entity',
                            selector: { statistic: { device_class: 'temperature' } },
                        },
                        { name: 'outdoor_humidity_entity', selector: { statistic: { device_class: 'humidity' } } },
                    ],
                },
                { name: 'outdoor_weather_entity', selector: { entity: { domain: 'weather' } } },
                {
                    type: 'grid',
                    schema: [
                        { name: 'outdoor_history', selector: { boolean: {} } },
                        { name: 'ventilation_line', selector: { boolean: {} } },
                    ],
                },
            ],
        },
        {
            type: 'expandable',
            title: t('editor.sections.axes'),
            schema: [
                {
                    type: 'grid',
                    schema: [
                        {
                            name: 'x_min',
                            selector: { number: { step: 'any', mode: 'box', unit_of_measurement: U.absHumidity.unit } },
                        },
                        {
                            name: 'x_max',
                            selector: { number: { step: 'any', mode: 'box', unit_of_measurement: U.absHumidity.unit } },
                        },
                    ],
                },
                {
                    type: 'grid',
                    schema: [
                        {
                            name: 'y_min',
                            selector: { number: { step: 'any', mode: 'box', unit_of_measurement: U.temperature.unit } },
                        },
                        {
                            name: 'y_max',
                            selector: { number: { step: 'any', mode: 'box', unit_of_measurement: U.temperature.unit } },
                        },
                    ],
                },
            ],
        },
        {
            type: 'expandable',
            title: t('editor.sections.comfort'),
            expanded: !!data.comfort_enabled,
            schema: [
                { name: 'comfort_enabled', selector: { boolean: {} } },
                ...(data.comfort_enabled ? comfortFields(U) : []),
                ...(data.comfort_enabled && data.comfort_x_enabled ? comfortXFields(U) : []),
            ],
        },
        ...(data.comfort_enabled
            ? [
                  {
                      type: 'expandable',
                      title: t('editor.sections.bands'),
                      expanded: !!data.bands_enabled,
                      schema: [
                          { name: 'bands_enabled', selector: { boolean: {} } },
                          ...(data.bands_enabled
                              ? [
                                    { name: 'orange_label', selector: { text: {} } },
                                    bandRow('orange', U),
                                    { name: 'red_label', selector: { text: {} } },
                                    bandRow('red', U),
                                ]
                              : []),
                      ],
                  },
              ]
            : []),
    ];
}

export class MollierHxCardEditor extends LitElement {
    static get properties() {
        return {
            hass: { attribute: false },
            _config: { state: true },
        };
    }

    setConfig(config) {
        this._config = config;
    }

    render() {
        if (!this._config) return html``;
        const data = configToData(this._config, this.hass);
        const t = (key, vars) => localize(this.hass, key, vars);
        const schema = buildSchema(data, t, this.hass);
        return html`
            <ha-form
                .hass=${this.hass}
                .data=${data}
                .schema=${schema}
                .computeLabel=${(s) => t(`editor.fields.${s.name}`)}
                @value-changed=${this._valueChanged}
            ></ha-form>
        `;
    }

    _valueChanged(ev) {
        const data = ev.detail.value;
        const before = unitSystem(this._config, this.hass);
        const after = unitSystem({ units: data.units }, this.hass);
        let newConfig;
        if (before !== after) {
            // Switched the unit system: convert the zone, the bands, the axis
            // ranges and the air pressure so they keep their meaning.
            newConfig = convertConfigUnits({ ...this._config }, before, after);
            if (data.units === 'metric' || data.units === 'imperial') newConfig.units = data.units;
            else delete newConfig.units;
        } else {
            newConfig = dataToConfig(data, this._config, this.hass);
        }
        this.dispatchEvent(
            new CustomEvent('config-changed', {
                detail: { config: newConfig },
                bubbles: true,
                composed: true,
            }),
        );
    }
}
