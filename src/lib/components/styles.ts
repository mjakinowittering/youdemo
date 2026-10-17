/**
 * Class lists for floating primitives, shared by the app (where they float) and
 * the visual stories (where they render in place through bits-ui's
 * `ContentStatic`), so both draw the same chip and menu.
 */

/** Tooltip: ink chip, card text, 14/600, radius 10, no arrow. */
export const tooltipClass =
    'rounded-control bg-yd-ink px-3 py-1.5 text-small font-semibold text-yd-card';

/** DropdownMenu panel: card, ink outline, radius 14, the 0 4px 0 shadow; rows run edge to edge. */
export const menuClass =
    'min-w-[220px] rounded-notice border-[1.5px] border-solid border-yd-ink bg-yd-card p-0 text-yd-ink shadow-offset ring-0 outline-none';

/** A 44px menu row; the chosen one is accent-tint and 600 with a tick. */
export const menuItemClass =
    'flex min-h-11 items-center gap-2.5 rounded-control px-3 py-0 text-button font-normal text-yd-ink focus:bg-yd-base data-[state=checked]:bg-yd-accent-tint data-[state=checked]:font-semibold *:data-[slot=dropdown-menu-radio-item-indicator]:right-3 [&_svg]:size-[18px]!';
