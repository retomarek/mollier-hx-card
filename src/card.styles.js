import { css } from 'lit';

export default css`
    :host {
        display: block;
        height: 100%;
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
        gap: 12px;
    }
    .error {
        color: red;
    }
    /* Container-query sizing: the inner host fits the available space while
       preserving the chart's 600 : 420 aspect ratio. The fallback aspect-ratio
       on .diagram-wrap kicks in when the parent has no defined height (masonry
       layout) — in section/grid layout the height: 100 % wins. */
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
        color: var(--secondary-text-color);
        margin: 0;
    }
    .muted {
        color: var(--secondary-text-color, #8A94A6);
    }
    .zone-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
        font-size: 12px;
        color: var(--secondary-text-color);
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
    .compass {
        flex: 0 0 auto;
        border-top: 1px solid var(--divider-color, #e0e0e0);
        padding-top: 12px;
    }
    .compass-title {
        font-weight: 500;
        margin-bottom: 4px;
    }
    .compass-body {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 16px;
    }
    .compass-glyph {
        flex: 1 1 240px;
        max-width: 360px;
        min-width: 0;
        height: auto;
        font-family: inherit;
    }
    .compass-legend {
        flex: 1 1 200px;
        font-size: 13px;
        line-height: 1.6;
    }
    .compass-legend .dot {
        font-size: 14px;
    }
    .stage-key {
        margin-top: 6px;
    }
`;
