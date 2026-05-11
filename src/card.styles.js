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
    /* width + height both 100 % in section layout (parent has a fixed height)
       — aspect-ratio is ignored there and the SVG's preserveAspectRatio handles
       proportional content scaling with letterboxing. In masonry layout the
       parent height is auto, so height: 100 % resolves to auto and the
       aspect-ratio fallback gives the wrap a width-based height. */
    .diagram-wrap {
        position: relative;
        width: 100%;
        height: 100%;
        aspect-ratio: 600 / 420;
    }
    .mollier-host {
        position: absolute;
        inset: 0;
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
