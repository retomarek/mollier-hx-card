import { html, LitElement } from 'lit';

// The editor uses HA's <ha-form> (loaded by HA's frontend at runtime — not on
// npm). The form's data model is flat; the YAML config is nested. The pair of
// configToData / dataToConfig translates between them.

const DEFAULTS = {
    days: 7,
    coloring: 'season',
    pressure: 101325,
    x_min: 0,    // g/kg
    x_max: 20,   // g/kg
    y_min: -20,  // °C
    y_max: 50,   // °C
    comfort_t_min: 20,
    comfort_t_max: 26,
    comfort_phi_min: 30,
    comfort_phi_max: 60,
    comfort_x_min: 0,
    comfort_x_max: 12,
};

function configToData(config) {
    const c = config || {};
    return {
        header: c.header ?? '',
        temperature_entity: c.temperature_entity ?? '',
        humidity_entity: c.humidity_entity ?? '',
        days: c.days ?? DEFAULTS.days,
        coloring: c.coloring ?? DEFAULTS.coloring,
        pressure: c.pressure ?? DEFAULTS.pressure,
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
    };
}

function dataToConfig(data) {
    const config = {
        type: 'custom:mollier-hx-card',
        temperature_entity: data.temperature_entity,
        humidity_entity: data.humidity_entity,
        days: data.days,
        coloring: data.coloring,
        pressure: data.pressure,
        domain_x: [data.x_min, data.x_max],
        domain_y: [data.y_min, data.y_max],
    };
    if (data.header) config.header = data.header;
    if (data.comfort_enabled) {
        config.comfort_zone = {
            temperature: [data.comfort_t_min, data.comfort_t_max],
            humidity: [data.comfort_phi_min, data.comfort_phi_max],
            absolute_humidity: [data.comfort_x_min, data.comfort_x_max],
        };
    }
    return config;
}

const LABELS = {
    header: 'Header',
    temperature_entity: 'Temperature entity',
    humidity_entity: 'Humidity entity',
    days: 'Days back',
    coloring: 'Coloring',
    pressure: 'Pressure',
    x_min: 'X min',
    x_max: 'X max',
    y_min: 'Y min',
    y_max: 'Y max',
    comfort_enabled: 'Show comfort zone',
    comfort_t_min: 'Temperature min',
    comfort_t_max: 'Temperature max',
    comfort_phi_min: 'Humidity min',
    comfort_phi_max: 'Humidity max',
    comfort_x_min: 'Absolute humidity min',
    comfort_x_max: 'Absolute humidity max',
};

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

function buildSchema(data) {
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
                                { value: 'season', label: 'By season' },
                                { value: 'age', label: 'By age' },
                                { value: 'chronological', label: 'Chronological' },
                            ],
                        },
                    },
                },
            ],
        },
        {
            name: 'pressure',
            selector: { number: { min: 50000, max: 110000, step: 1, mode: 'box', unit_of_measurement: 'Pa' } },
        },
        {
            type: 'expandable',
            title: 'Axes',
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
            title: 'Comfort zone',
            expanded: !!data.comfort_enabled,
            schema: [
                { name: 'comfort_enabled', selector: { boolean: {} } },
                ...(data.comfort_enabled ? COMFORT_FIELDS : []),
            ],
        },
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
        const schema = buildSchema(data);
        return html`
            <ha-form
                .hass=${this.hass}
                .data=${data}
                .schema=${schema}
                .computeLabel=${(s) => LABELS[s.name] || s.name}
                @value-changed=${this._valueChanged}
            ></ha-form>
        `;
    }

    _valueChanged(ev) {
        const newConfig = dataToConfig(ev.detail.value);
        this.dispatchEvent(new CustomEvent('config-changed', {
            detail: { config: newConfig },
            bubbles: true,
            composed: true,
        }));
    }
}
