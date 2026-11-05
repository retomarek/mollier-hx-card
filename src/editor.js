import { html, LitElement } from 'lit';
import { localize } from './localize/localize.js';
import { LINE_DEFAULTS, parseLines } from './card.js';

const LINE_KEYS = Object.keys(LINE_DEFAULTS);

// The editor uses HA's <ha-form> (loaded by HA's frontend at runtime — not on
// npm). The form's data model is flat; the YAML config is nested. The pair of
// configToData / dataToConfig translates between them.

const DEFAULTS = {
    days: 7,
    coloring: 'season',
    pressure: 101325,   // the card's default when neither pressure nor altitude is set
    altitude: 450,      // only a suggestion when the user switches to altitude
    air_mode: 'pressure',
    convention: 'classical',
    x_min: 0,    // g/kg
    x_max: 18,   // g/kg
    y_min: -10,  // °C
    y_max: 40,   // °C
    comfort_t_min: 20,
    comfort_t_max: 26,
    comfort_phi_min: 30,
    comfort_phi_max: 60,
    comfort_x_min: 0,
    comfort_x_max: 12,
    // Warning-band offsets around the comfort zone (pyedautils defaults).
    orange_dt: 1, orange_dphi: 5, orange_dx: 1,
    red_dt: 2.5, red_dphi: 10, red_dx: 2.5,
};

function configToData(config) {
    const c = config || {};
    const hasAltitude = c.altitude !== undefined && c.altitude !== null;
    return {
        header: c.header ?? '',
        temperature_entity: c.temperature_entity ?? '',
        humidity_entity: c.humidity_entity ?? '',
        days: c.days ?? DEFAULTS.days,
        coloring: c.coloring ?? DEFAULTS.coloring,
        air_mode: hasAltitude ? 'altitude' : 'pressure',
        pressure: c.pressure ?? DEFAULTS.pressure,
        altitude: c.altitude ?? DEFAULTS.altitude,
        convention: c.convention ?? DEFAULTS.convention,
        x_min: c.domain_x?.[0] ?? DEFAULTS.x_min,
        x_max: c.domain_x?.[1] ?? DEFAULTS.x_max,
        y_min: c.domain_y?.[0] ?? DEFAULTS.y_min,
        y_max: c.domain_y?.[1] ?? DEFAULTS.y_max,
        comfort_enabled: !!c.comfort_zone,
        comfort_t_min: c.comfort_zone?.temperature?.[0] ?? DEFAULTS.comfort_t_min,
        comfort_t_max: c.comfort_zone?.temperature?.[1] ?? DEFAULTS.comfort_t_max,
        comfort_phi_min: c.comfort_zone?.humidity?.[0] ?? DEFAULTS.comfort_phi_min,
        comfort_phi_max: c.comfort_zone?.humidity?.[1] ?? DEFAULTS.comfort_phi_max,
        comfort_x_min: c.comfort_zone?.absolute_humidity?.[0] ?? DEFAULTS.comfort_x_min,
        comfort_x_max: c.comfort_zone?.absolute_humidity?.[1] ?? DEFAULTS.comfort_x_max,
        ...Object.fromEntries(Object.entries(parseLines(c.lines)).map(([k, v]) => [`line_${k}`, v])),
        outdoor_temperature_entity: c.outdoor_temperature_entity ?? '',
        outdoor_humidity_entity: c.outdoor_humidity_entity ?? '',
        outdoor_weather_entity: c.outdoor_weather_entity ?? '',
        outdoor_history: c.outdoor_history === true,
        ventilation_line: c.ventilation_line !== false,
        bands_enabled: !!c.warning_bands,
        orange_dt: c.warning_bands?.orange?.temperature ?? DEFAULTS.orange_dt,
        orange_dphi: c.warning_bands?.orange?.humidity ?? DEFAULTS.orange_dphi,
        orange_dx: c.warning_bands?.orange?.absolute_humidity ?? DEFAULTS.orange_dx,
        red_dt: c.warning_bands?.red?.temperature ?? DEFAULTS.red_dt,
        red_dphi: c.warning_bands?.red?.humidity ?? DEFAULTS.red_dphi,
        red_dx: c.warning_bands?.red?.absolute_humidity ?? DEFAULTS.red_dx,
        orange_label: c.warning_bands?.orange?.label ?? '',
        red_label: c.warning_bands?.red?.label ?? '',
    };
}

// Keys this form owns. Everything else in the existing config (grid_options,
// visibility, view_layout, card_mod, YAML-only options) is kept as it is.
const OWNED_KEYS = [
    'type', 'temperature_entity', 'humidity_entity', 'header', 'days', 'coloring', 'convention',
    'domain_x', 'domain_y', 'lines', 'altitude', 'pressure', 'comfort_zone', 'warning_bands',
    'outdoor_temperature_entity', 'outdoor_humidity_entity', 'outdoor_weather_entity', 'outdoor_history', 'ventilation_line',
];

function dataToConfig(data, previous = {}) {
    const config = { ...previous };
    for (const k of OWNED_KEYS) delete config[k];
    Object.assign(config, {
        type: 'custom:mollier-hx-card',
        temperature_entity: data.temperature_entity,
        humidity_entity: data.humidity_entity,
        days: data.days,
        coloring: data.coloring,
        convention: data.convention,
    });
    // Write the axis ranges only when they differ from the card defaults, so
    // the card follows future default changes.
    if (data.x_min !== DEFAULTS.x_min || data.x_max !== DEFAULTS.x_max) config.domain_x = [data.x_min, data.x_max];
    if (data.y_min !== DEFAULTS.y_min || data.y_max !== DEFAULTS.y_max) config.domain_y = [data.y_min, data.y_max];
    if (data.header) config.header = data.header;
    // Store only the lines that differ from the defaults, to keep YAML short.
    const lines = {};
    for (const k of LINE_KEYS) {
        if (data[`line_${k}`] !== LINE_DEFAULTS[k]) lines[k] = data[`line_${k}`];
    }
    if (Object.keys(lines).length) config.lines = lines;
    // Outside air: only what is set; defaults stay out of the YAML.
    for (const k of ['outdoor_temperature_entity', 'outdoor_humidity_entity', 'outdoor_weather_entity']) {
        if (data[k]) config[k] = data[k];
    }
    const hasOutdoor = data.outdoor_temperature_entity || data.outdoor_weather_entity;
    if (hasOutdoor && data.outdoor_history) config.outdoor_history = true;
    if (hasOutdoor && data.ventilation_line === false) config.ventilation_line = false;
    // Persist either pressure or altitude, never both. Do not write the default
    // pressure unless it was set before, so opening the editor changes nothing.
    if (data.air_mode === 'altitude') {
        config.altitude = data.altitude;
    } else if (previous.pressure !== undefined || data.pressure !== DEFAULTS.pressure) {
        config.pressure = data.pressure;
    }
    if (data.comfort_enabled) {
        config.comfort_zone = {
            temperature: [data.comfort_t_min, data.comfort_t_max],
            humidity: [data.comfort_phi_min, data.comfort_phi_max],
            absolute_humidity: [data.comfort_x_min, data.comfort_x_max],
        };
        if (data.bands_enabled) {
            // Keep YAML-only keys (label, color) the form doesn't edit.
            const prev = typeof previous.warning_bands === 'object' && previous.warning_bands ? previous.warning_bands : {};
            // Keep YAML-only keys (color); an empty name falls back to the
            // translated default ("Warning band" / "Alarm band").
            const band = (k) => {
                const b = { ...prev[k], temperature: data[`${k}_dt`], humidity: data[`${k}_dphi`], absolute_humidity: data[`${k}_dx`] };
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


const bandRow = (key) => ({
    type: 'grid',
    schema: [
        { name: `${key}_dt`, selector: { number: { min: 0, step: 0.5, mode: 'box', unit_of_measurement: 'K' } } },
        { name: `${key}_dphi`, selector: { number: { min: 0, max: 100, step: 1, mode: 'box', unit_of_measurement: '%' } } },
        { name: `${key}_dx`, selector: { number: { min: 0, step: 0.5, mode: 'box', unit_of_measurement: 'g/kg' } } },
    ],
});

const COMFORT_FIELDS = [
    {
        type: 'grid',
        schema: [
            { name: 'comfort_t_min', selector: { number: { step: 0.5, mode: 'box', unit_of_measurement: '°C' } } },
            { name: 'comfort_t_max', selector: { number: { step: 0.5, mode: 'box', unit_of_measurement: '°C' } } },
        ],
    },
    {
        type: 'grid',
        schema: [
            { name: 'comfort_phi_min', selector: { number: { min: 0, max: 100, step: 1, mode: 'box', unit_of_measurement: '%' } } },
            { name: 'comfort_phi_max', selector: { number: { min: 0, max: 100, step: 1, mode: 'box', unit_of_measurement: '%' } } },
        ],
    },
    {
        type: 'grid',
        schema: [
            { name: 'comfort_x_min', selector: { number: { min: 0, step: 0.5, mode: 'box', unit_of_measurement: 'g/kg' } } },
            { name: 'comfort_x_max', selector: { number: { min: 0, step: 0.5, mode: 'box', unit_of_measurement: 'g/kg' } } },
        ],
    },
];

function buildSchema(data, t) {
    return [
        { name: 'header', selector: { text: {} } },
        {
            type: 'grid',
            schema: [
                // Use the statistic selector so only entities with long-term
                // statistics (state_class: measurement) appear, and filter by
                // device_class to pre-narrow to the right sensor type.
                { name: 'temperature_entity', required: true, selector: { statistic: { device_class: 'temperature' } } },
                { name: 'humidity_entity', required: true, selector: { statistic: { device_class: 'humidity' } } },
            ],
        },
        {
            type: 'grid',
            schema: [
                { name: 'days', selector: { number: { min: 1, max: 365, step: 1, mode: 'box' } } },
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
                    name: 'air_mode',
                    selector: {
                        select: {
                            mode: 'dropdown',
                            options: [
                                { value: 'pressure', label: t('editor.options.pressure') },
                                { value: 'altitude', label: t('editor.options.altitude') },
                            ],
                        },
                    },
                },
                data.air_mode === 'altitude'
                    ? {
                        name: 'altitude',
                        selector: { number: { min: 0, max: 5000, step: 10, mode: 'box', unit_of_measurement: 'm' } },
                    }
                    : {
                        name: 'pressure',
                        selector: { number: { min: 50000, max: 110000, step: 1, mode: 'box', unit_of_measurement: 'Pa' } },
                    },
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
                    schema: LINE_KEYS.map((k) => ({ name: `line_${k}`, selector: { boolean: {} } })),
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
                        { name: 'outdoor_temperature_entity', selector: { statistic: { device_class: 'temperature' } } },
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
                        { name: 'x_min', selector: { number: { step: 1, mode: 'box', unit_of_measurement: 'g/kg' } } },
                        { name: 'x_max', selector: { number: { step: 1, mode: 'box', unit_of_measurement: 'g/kg' } } },
                    ],
                },
                {
                    type: 'grid',
                    schema: [
                        { name: 'y_min', selector: { number: { step: 1, mode: 'box', unit_of_measurement: '°C' } } },
                        { name: 'y_max', selector: { number: { step: 1, mode: 'box', unit_of_measurement: '°C' } } },
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
                ...(data.comfort_enabled ? COMFORT_FIELDS : []),
            ],
        },
        ...(data.comfort_enabled ? [{
            type: 'expandable',
            title: t('editor.sections.bands'),
            expanded: !!data.bands_enabled,
            schema: [
                { name: 'bands_enabled', selector: { boolean: {} } },
                ...(data.bands_enabled ? [
                    { name: 'orange_label', selector: { text: {} } },
                    bandRow('orange'),
                    { name: 'red_label', selector: { text: {} } },
                    bandRow('red'),
                ] : []),
            ],
        }] : []),
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
        const data = configToData(this._config);
        const t = (key) => localize(this.hass, key);
        const schema = buildSchema(data, t);
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
        const newConfig = dataToConfig(ev.detail.value, this._config);
        this.dispatchEvent(new CustomEvent('config-changed', {
            detail: { config: newConfig },
            bubbles: true,
            composed: true,
        }));
    }
}
