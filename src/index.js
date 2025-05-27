import { MollierHxCard } from "./card";
// import { ToggleCardWithToolchainEditor } from "./editor";

customElements.define(
    "mollier-hx-card",
    MollierHxCard
);
customElements.define(
    "mollier-hx-card-editor",
    MollierHxCardEditor
);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "mollier-hx-card",
    name: "Mollier hx card",
    description: "A custom card which creates a mollier hx diagram out of a temperature- and humidity sensor entity."
});