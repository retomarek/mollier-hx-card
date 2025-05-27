class MollierHxCard extends HTMLElement {

    // private properties
    _config;
    _hass;
    _elements = {};

    // lifecycle

    constructor() {
        console.log("MollierHxCard.constructor()")
        super();
        this.doCard();
        this.doStyle();
        this.doAttach();
        this.doQueryElements();
        this.doListen();
    }

    // Configuration
    setConfig(config) {
        console.log("MollierHxCard.setConfig()")
        this._config = config;
        this.doCheckConfig();
        this.doUpdateConfig();
    }

    set hass(hass) {
        console.log("MollierHxCard.hass()")
        this._hass = hass;
        this.doUpdateHass()
    }

    connectedCallback() {
        console.log("MollierHxCard.connectedCallback()")
    }

    onClicked() {
        console.log("MollierHxCard.onClicked()");
        this.doToggle();
    }

    // accessors
    isOff() {
        return this.getState().state == 'off';
    }

    isOn() {
        return this.getState().state == 'on';
    }

    getHeader() {
        return this._config.header;
    }

    getEntityID() {
        return this._config.entity;
    }

    getState() {
        return this._hass.states[this.getEntityID()];
    }

    getAttributes() {
        return this.getState().attributes
    }

    getName() {
        const friendlyName = this.getAttributes().friendly_name;
        return friendlyName ? friendlyName : this.getEntityID();
    }


    // jobs
    doCheckConfig() {
        if (!this._config.temperature || !this._config.humidity || !this._config.entity) {
            throw new Error('Please define a temperature and humidity entity!');
        }
    }

    doStyle() {
        this._elements.style = document.createElement("style");
        this._elements.style.textContent = `
            .error {
                text-color: red;
            }
            .error.hidden { display: none; }
            .dl {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .dl.hidden { display: none; }
            .dt {
                display: flex;
                align-content: center;
                flex-wrap: wrap;
            }
            .dd {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, auto) minmax(0, 2fr));
                margin: 0;
            }
            .toggle {
                padding: 0.6em;
                border: grey;
                border-radius: 50%;
            }
            .toggle.on { background-color: green; }
            .toggle.off{ background-color: red; }
            .button {
                display: block;
                border: outset 0.2em;
                border-radius: 50%;
                border-color: silver;
                background-color: silver;
                width: 1.4em;
                height: 1.4em;
            }
            .value {
                padding-left: 0.5em;
                display: flex;
                align-content: center;
                flex-wrap: wrap;
            }
        `
    }

    doAttach() {
        this.attachShadow({ mode: "open" });
        this.shadowRoot.append(this._elements.style, this._elements.card);
    }

    doCard() {
        this._elements.card = document.createElement("ha-card");
        this._elements.card.innerHTML = `
                <div class="card-content">
                    <p class="error error hidden">
                    <dl class="dl">
                        <dt class="dt"></dt>
                        <dd class="dd">
                            <span class="toggle">
                                <span class="button"></span>
                            </span>
                            <span class="value">
                            </span>
                        </dd>
                    </dl>
                </div>
        `;
    }

    doQueryElements() {
        const card = this._elements.card;
        this._elements.error = card.querySelector(".error")
        this._elements.dl = card.querySelector(".dl")
        this._elements.topic = card.querySelector(".dt")
        this._elements.toggle = card.querySelector(".toggle")
        this._elements.value = card.querySelector(".value")
    }

    doListen() {
        this._elements.dl.addEventListener("click", this.onClicked.bind(this), false);
    }

    doUpdateConfig() {
        if (this.getHeader()) {
            this._elements.card.setAttribute("header", this.getHeader());
        } else {
            this._elements.card.removeAttribute("header");
        }
    }

    doUpdateHass() {
        if (!this.getState()) {
            this._elements.error.textContent = `${this.getEntityID()} is unavailable.`;
            this._elements.error.classList.remove("hidden");
            this._elements.dl.classList.add("hidden");
        } else {
            this._elements.error.textContent = "";
            this._elements.topic.textContent = this.getName();
            if (this.isOff()) {
                this._elements.toggle.classList.remove("on");
                this._elements.toggle.classList.add("off");
            } else if (this.isOn()) {
                this._elements.toggle.classList.remove("off");
                this._elements.toggle.classList.add("on");
            }
            this._elements.value.textContent = this.getState().state;
            this._elements.error.classList.add("hidden");
            this._elements.dl.classList.remove("hidden");
        }
    }

    doToggle() {
        this._hass.callService('input_boolean', 'toggle', {
            entity_id: this.getEntityID()
        });
    }

    // configuration defaults
    static getStubConfig() {
        return { temperature: "sensor.openweathermap_temperature", humidity: "sensor.openweathermap_humidity", entity: "input_boolean.test" }
    }


    // set hass(hass) {
    //     const entityIdTemp = this.config.temperature;
    //     const entityIdHum = this.config.humidity;
    //     const stateTemp = hass.states[entityIdTemp];
    //     const stateHum = hass.states[entityIdHum];
    //     const stateStrTemp = stateTemp ? stateTemp.state : 'unavailable';
    //     const stateStrHum = stateHum ? stateHum.state : 'unavailable';

    //     // done once
    //     if (!this.content) {
    //         // user makes sense here as every login gets it's own instance
    //         this.innerHTML = `
    //             <ha-card header="Hello ${hass.user.name}!">
    //                 <div class="card-content"></div>
    //             </ha-card>
    //         `;
    //         this.content = this.querySelector('div');
    //     }
    //     // done repeatedly
    //     this.content.innerHTML = `
    //         <p>The current temperature is ${stateStrTemp} °C.</p>
    //         <p>The current humidity is ${stateStrHum} %rH.</p>
    //     `;
    // }

}

customElements.define('mollier-hx-card', MollierHxCard);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "mollier-hx-card",
    name: "Mollier hx card",
    description: "A custom card which creates a mollier hx diagram out of a temperature- and humidity sensor entity."
});
