import { css } from 'lit';

// The Mollier grid (vendored from pyedautils) is drawn on white with dark ink
// and white label halos, so it cannot follow a dark theme. The diagram and its
// legend therefore sit on one white "sheet" with fixed chart colours; only the
// card chrome around it follows the Home Assistant theme.
export default css`
    :host {
        display: block;
        --sheet-bg: #ffffff;
        --sheet-ink: #1f2733;
        --sheet-muted: #6a7482;
        --sheet-line: #e4e8ed;
    }
    ha-card {
        display: flex;
        flex-direction: column;
    }
    /* Fixed mode: fill the tile the dashboard gives us. */
    :host([fixed-height]),
    :host([fixed-height]) ha-card {
        height: 100%;
    }
    .card-content {
        padding: 16px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
    }
    :host([fixed-height]) .card-content,
    :host([fixed-height]) .sheet {
        flex: 1 1 auto;
        min-height: 0;
    }
    .message {
        color: var(--secondary-text-color);
        margin: 0;
    }
    .error {
        color: var(--error-color, #db4437);
        margin: 0;
    }
    .sheet {
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: var(--sheet-bg);
        color: var(--sheet-ink);
        border-radius: 8px;
        padding: 8px 12px 12px;
        box-sizing: border-box;
    }
    /* Container-query sizing: the inner host fits the available space while
       preserving the chart's 600 : 420 aspect ratio. The fallback aspect-ratio
       on .diagram-wrap kicks in when the parent has no defined height (masonry
       layout) — in section/grid layout the flex sizing wins. */
    /* Auto mode: natural 600 : 420 aspect ratio, at most 480 px tall and
       centred. Fixed mode: take whatever height is left in the tile. In both
       the inner host keeps the aspect ratio inside the box (container query). */
    .diagram-wrap {
        container-type: size;
        position: relative;
        width: 100%;
        aspect-ratio: 600 / 420;
        max-height: 480px;
        display: grid;
        place-items: center;
    }
    :host([fixed-height]) .diagram-wrap {
        flex: 1 1 auto;
        /* Guard in case a host gives no definite height: never collapse. */
        min-height: 240px;
        aspect-ratio: auto;
        max-height: none;
    }
    .mollier-host {
        width: min(100cqw, calc(100cqh * 600 / 420));
        height: min(100cqh, calc(100cqw * 420 / 600));
    }
    .mollier-host svg {
        width: 100%;
        height: 100%;
        display: block;
    }
    .tooltip {
        position: absolute;
        pointer-events: none;
        display: none;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 10;
        transform: translate(-50%, calc(-100% - 6px));
    }
    .hint {
        color: var(--sheet-muted);
        margin: 0;
        font-size: 13px;
    }
    .muted {
        color: var(--sheet-muted);
        font-weight: 400;
    }
    .zone-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
        font-size: 12px;
        color: var(--sheet-muted);
        padding-inline: 4px;
    }
    .zone-legend span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
        cursor: help;
    }
    .swatch {
        display: inline-block;
        width: 14px;
        height: 10px;
        box-sizing: border-box;
    }
    .swatch.fill {
        background: rgba(154, 205, 50, 0.4);
        border: 1px solid yellowgreen;
    }
    .swatch.dash {
        height: 0;
        border-top: 2px dashed;
    }
`;
