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
        height: 100%;
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
`;
