import { css } from 'lit';

// The Mollier grid (vendored from pyedautils) is drawn on white with dark ink
// and white label halos, so it cannot follow a dark theme. Everything that is
// part of the chart — diagram, zone legend, comfort compass — therefore sits
// on one white "sheet" with fixed chart colours; only the card chrome around
// it follows the Home Assistant theme.
export default css`
    :host {
        display: block;
        height: 100%;
        --sheet-bg: #ffffff;
        --sheet-ink: #1f2733;
        --sheet-muted: #6a7482;
        --sheet-line: #e4e8ed;
    }
    ha-card {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
    .card-content {
        flex: 1;
        min-height: 0;
        padding: 16px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
    }
    .error {
        color: var(--error-color, #db4437);
        margin: 0;
    }
    .sheet {
        flex: 1 1 auto;
        min-height: 0;
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
    .diagram-wrap {
        container-type: size;
        position: relative;
        width: 100%;
        flex: 1 1 auto;
        min-height: 0;
        aspect-ratio: 600 / 420;
        display: grid;
        place-items: center;
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
        gap: 4px 18px;
        font-size: 12px;
        color: var(--sheet-muted);
        padding-inline: 4px;
    }
    .zone-legend span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    .swatch {
        display: inline-block;
        width: 18px;
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

    /* Comfort compass */
    .compass {
        flex: 0 0 auto;
        border-top: 1px solid var(--sheet-line);
        padding: 12px 4px 0;
        container-type: inline-size;
    }
    .compass-title {
        font-size: 15px;
        font-weight: 500;
    }
    .compass-body {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
        align-items: center;
        gap: 4px 16px;
    }
    @container (max-width: 420px) {
        .compass-body {
            grid-template-columns: minmax(0, 1fr);
        }
        .compass-glyph {
            max-width: 340px;
            justify-self: center;
        }
    }
    .compass-glyph {
        width: 100%;
        height: auto;
        display: block;
        font-family: inherit;
    }
    .compass-legend {
        display: flex;
        flex-direction: column;
        gap: 3px;
        font-size: 12px;
        line-height: 1.35;
        font-variant-numeric: tabular-nums;
    }
    .compass-legend .row {
        display: grid;
        grid-template-columns: 9px minmax(0, 1fr) auto 3.2em;
        column-gap: 8px;
        align-items: center;
    }
    .compass-legend .row .count {
        font-weight: 600;
        text-align: right;
    }
    .compass-legend .row .share {
        color: var(--sheet-muted);
        text-align: right;
    }
    .compass .seg {
        cursor: pointer;
        transition: opacity 0.12s;
    }
    .compass-glyph:hover .seg:not(:hover) {
        opacity: 0.55;
    }
    .compass-tip {
        position: absolute;
        pointer-events: none;
        display: none;
        padding: 5px 9px;
        border-radius: 4px;
        font-size: 12px;
        line-height: 1.4;
        white-space: nowrap;
        z-index: 10;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
        transform: translate(-50%, calc(-100% - 6px));
    }
    .compass-tip .tip-head {
        font-weight: 600;
    }
    @media (prefers-reduced-motion: reduce) {
        .compass .seg { transition: none; }
    }
    .compass-legend .dot {
        display: inline-block;
        width: 9px;
        height: 9px;
        border-radius: 50%;
    }
    .stage-key {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 10px;
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid var(--sheet-line);
        color: var(--sheet-muted);
        font-size: 11px;
    }
    .stage-key > span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
`;
