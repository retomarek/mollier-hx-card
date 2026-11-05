import { html, LitElement } from 'lit';
import { localize } from './localize/localize.js';

// The editor uses HA's <ha-form> (loaded by HA's frontend at runtime — not on
// npm). The form's data model is flat; the YAML config is nested. The pair of
// configToData / dataToConfig translates between them.

const DEFAULTS = {
    days: 7,
    coloring: 'season',
    pressure: 96035,    // ISA pressure at 450 m a.s.l.
    altitude: 450,
    air_mode: 'altitude',
    convention: 'classical',
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
        bands_enabled: !!c.warning_bands,
        orange_dt: c.warning_bands?.orange?.temperature ?? DEFAULTS.orange_dt,
        orange_dphi: c.warning_bands?.orange?.humidity ?? DEFAULTS.orange_dphi,
        orange_dx: c.warning_bands?.orange?.absolute_humidity ?? DEFAULTS.orange_dx,
        red_dt: c.warning_bands?.red?.temperature ?? DEFAULTS.red_dt,
        red_dphi: c.warning_bands?.red?.humidity ?? DEFAULTS.red_dphi,
        red_dx: c.warning_bands?.red?.absolute_humidity ?? DEFAULTS.red_dx,
        show_compass: !!c.show_compass,
    };
}

function dataToConfig(data, previous) {
    const config = {
        type: 'custom:mollier-hx-card',
        temperature_entity: data.temperature_entity,
        humidity_entity: data.humidity_entity,
        days: data.days,
        coloring: data.coloring,
        convention: data.convention,
        domain_x: [data.x_min, data.x_max],
        domain_y: [data.y_min, data.y_max],
    };
    // Persist either pressure or altitude — never both — so the card knows
    // which input the user chose.
    if (data.air_mode === 'altitude') {
        config.altitude = data.altitude;
    } else {
        config.pressure = data.pressure;
    }
    if (data.header) config.header = data.header;
    if (data.comfort_enabled) {
        config.comfort_zone = {
            temperature: [data.comfort_t_min, data.comfort_t_max],
            humidity: [data.comfort_phi_min, data.comfort_phi_max],
            absolute_humidity: [data.comfort_x_min, data.comfort_x_max],
        };
        if (data.bands_enabled) {
            // Keep YAML-only keys (label, color) the form doesn't edit.
            const prev = typeof previous?.warning_bands === 'object' ? previous.warning_bands : {};
            config.warning_bands = {
                orange: { ...prev.orange, temperature: data.orange_dt, humidity: data.orange_dphi, absolute_humidity: data.orange_dx },
                red: { ...prev.red, temperature: data.red_dt, humidity: data.red_dphi, absolute_humidity: data.red_dx },
            };
        }
        if (data.show_compass) config.show_compass = true;
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
            expanded: !!(data.bands_enabled || data.show_compass),
            schema: [
                { name: 'bands_enabled', selector: { boolean: {} } },
                ...(data.bands_enabled ? [bandRow('orange'), bandRow('red')] : []),
                { name: 'show_compass', selector: { boolean: {} } },
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
