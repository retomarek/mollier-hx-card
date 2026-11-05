// Keep in sync with "version" in package.json.
const version = "1.0.0-beta.2";
import { MollierHxCard } from "./card";
import { MollierHxCardEditor } from "./editor";

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
    description: "A custom card which creates a mollier hx diagram out of a temperature- and humidity sensor entity.",
    preview: true,
    documentationURL: "https://github.com/retomarek/mollier-hx-card"
});

console.info(
    `%c MOLLIER-HX-CARD %c v${version} `,
    "color: white; background: #3b6ea8; font-weight: 700;",
    "color: #3b6ea8; background: white; font-weight: 700;"
);
