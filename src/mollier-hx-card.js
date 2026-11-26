// Keep in sync with "version" in package.json.
const version = '0.1.1';
import { MollierHxCard } from './card';
import { MollierHxCardEditor } from './editor';

// A second copy of the bundle (e.g. loaded both from the Marketplace and by hand)
// must not throw: the first registration wins.
if (!customElements.get('mollier-hx-card')) customElements.define('mollier-hx-card', MollierHxCard);
if (!customElements.get('mollier-hx-card-editor')) customElements.define('mollier-hx-card-editor', MollierHxCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'mollier-hx-card'))
    window.customCards.push({
        type: 'mollier-hx-card',
        name: 'Mollier hx Card',
        description:
            'A Mollier h,x (psychrometric) diagram of your room climate, one point per day, with comfort zone, warning bands and outside air.',
        preview: true,
        documentationURL: 'https://github.com/retomarek/mollier-hx-card',
    });

console.info(
    `%c MOLLIER-HX-CARD %c v${version} `,
    'color: white; background: #3b6ea8; font-weight: 700;',
    'color: #3b6ea8; background: white; font-weight: 700;',
);
