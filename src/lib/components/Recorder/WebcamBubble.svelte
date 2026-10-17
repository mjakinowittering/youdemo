<script lang="ts">
    import { ViewIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon.svelte';
    import Pill from '$lib/components/Pill.svelte';

    import {
        BUBBLE_POSITIONS,
        nextSpot,
        previewBubble,
        previewSpot,
        previewSpotStyle,
        SLOT_INSET,
        SLOT_SHRINK,
        type BubblePosition,
        type FrameSize
    } from '$lib/bubbleGeometry.js';

    import WebcamBubbleFace from './WebcamBubbleFace.svelte';

    interface Props {
        position?: BubblePosition;
        stream?: MediaStream | null;
        loading?: boolean;
        /** Bubble diameter and inset in px; both follow the frame (as recorded) when unset. */
        size?: number;
        inset?: number;
        /** "Drag to move" under the bubble. */
        hint?: boolean;
        /** Draw the empty dashed slots always, or only while dragging. */
        slots?: 'always' | 'dragging';
        /** Which empty slots to draw; every other spot by default. */
        slotPositions?: BubblePosition[];
        /** The framing check: on hover or focus the bubble grows to this diameter. */
        enlargedSize?: number;
        /** Shows the framing check without hovering, for stories. */
        enlarged?: boolean;
    }

    let {
        position = $bindable('tr'),
        stream = null,
        loading = false,
        size,
        inset,
        hint = false,
        slots = 'dragging',
        slotPositions,
        enlargedSize,
        enlarged = false
    }: Props = $props();

    // Measured: this overlay fills the frame's padding box; its parent is the frame.
    let frame = $state<FrameSize>({ innerW: 0, innerH: 0, outerW: 0, outerH: 0 });
    // The bubble and its hint, as laid out
    let groupW = $state(0);
    let groupH = $state(0);

    let auto = $derived(previewBubble(frame.innerH));
    let bubbleSize = $derived(size ?? auto.size);
    let bubbleInset = $derived(inset ?? auto.inset);
    let slotSize = $derived(bubbleSize - SLOT_SHRINK);

    let dragging = $state(false);
    let dragX = $state(0);
    let dragY = $state(0);
    let grabX = 0;
    let grabY = 0;
    // A press without a move is a click: the bubble stays where it was
    let moved = false;
    let overlay: HTMLDivElement | undefined;

    let hovered = $state(false);
    let focused = $state(false);
    // Back to scale while dragging, so where it lands is where it records
    let grown = $derived(
        enlargedSize !== undefined && (enlarged || hovered || focused) && !dragging
    );

    function spot(pos: BubblePosition) {
        return previewSpot(pos, frame, groupW, groupH, bubbleInset);
    }

    function nearest(x: number, y: number): BubblePosition {
        let best = position;
        let bestDistance = Infinity;
        for (const pos of BUBBLE_POSITIONS) {
            const s = spot(pos);
            const distance = Math.hypot(x - s.x, y - s.y);
            if (distance < bestDistance) [best, bestDistance] = [pos, distance];
        }
        return best;
    }

    let target = $derived(dragging ? nearest(dragX, dragY) : position);
    let at = $derived(dragging ? { x: dragX, y: dragY } : spot(position));
    let shownSlots = $derived(
        !grown && (slots === 'always' || dragging)
            ? (slotPositions ?? BUBBLE_POSITIONS.filter((p) => p !== target))
            : []
    );

    // The framing pill sits 8px off the side facing the middle, level with the outer edge
    const pillPlaces: Record<BubblePosition, string> = {
        tl: 'top-full mt-2 left-0',
        tc: 'top-full mt-2 left-1/2 -translate-x-1/2',
        tr: 'top-full mt-2 right-0',
        lc: 'top-full mt-2 left-0',
        rc: 'top-full mt-2 right-0',
        bl: 'bottom-full mb-2 left-0',
        bc: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
        br: 'bottom-full mb-2 right-0'
    };

    function measure(node: HTMLDivElement) {
        overlay = node;
        const update = () => {
            const parent = node.parentElement;
            frame = {
                innerW: node.clientWidth,
                innerH: node.clientHeight,
                outerW: parent?.offsetWidth ?? node.clientWidth,
                outerH: parent?.offsetHeight ?? node.clientHeight
            };
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(node);
        return () => ro.disconnect();
    }

    function onpointerdown(e: PointerEvent) {
        if (!overlay) return;
        const rect = overlay.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // An enlarged bubble shrinks back to scale centred under the pointer
        const w = grown ? bubbleSize : groupW;
        const h = grown ? bubbleSize : groupH;
        [grabX, grabY] = grown ? [w / 2, h / 2] : [x - at.x, y - at.y];
        dragX = Math.max(0, Math.min(frame.innerW - w, x - grabX));
        dragY = Math.max(0, Math.min(frame.innerH - h, y - grabY));
        dragging = true;
        moved = false;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
    }

    function onpointermove(e: PointerEvent) {
        if (!dragging || !overlay) return;
        moved = true;
        const rect = overlay.getBoundingClientRect();
        dragX = Math.max(0, Math.min(frame.innerW - groupW, e.clientX - rect.left - grabX));
        dragY = Math.max(0, Math.min(frame.innerH - groupH, e.clientY - rect.top - grabY));
    }

    function onpointerup(e: PointerEvent) {
        if (!dragging || !overlay) return;
        if (moved) position = target;
        dragging = false;
        if (!moved) return;
        // Grow again only if the pointer is still over the bubble where it landed
        const rect = overlay.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const s = spot(position);
        hovered = x >= s.x && x <= s.x + groupW && y >= s.y && y <= s.y + groupH;
    }

    function onkeydown(e: KeyboardEvent) {
        const next = nextSpot(position, e.key);
        if (!next) return;
        e.preventDefault();
        position = next;
    }
</script>

<!-- Fills the preview frame. The bubble sits at one of eight spots; dragging it
     shows the dashed slots and it snaps to the nearest on release. -->
<div class="pointer-events-none absolute inset-0" {@attach measure}>
    {#each shownSlots as pos (pos)}
        <div
            class="absolute rounded-full border-2 border-dashed border-yd-ink bg-yd-card/60"
            style="{previewSpotStyle(
                pos,
                frame,
                bubbleInset + SLOT_INSET
            )}; width: {slotSize}px; height: {slotSize}px"
        ></div>
    {/each}

    <div
        class="pointer-events-auto absolute cursor-grab touch-none active:cursor-grabbing"
        class:rounded-full={!hint}
        class:invisible={!frame.innerW || !groupW}
        style={dragging
            ? `left: ${dragX}px; top: ${dragY}px`
            : previewSpotStyle(position, frame, bubbleInset)}
        bind:offsetWidth={groupW}
        bind:offsetHeight={groupH}
        role="button"
        aria-roledescription="draggable"
        tabindex="0"
        aria-label="Camera preview. Drag or use the arrow keys to move."
        {onpointerdown}
        {onpointermove}
        {onpointerup}
        onpointercancel={onpointerup}
        onpointerenter={() => (hovered = true)}
        onpointerleave={() => (hovered = false)}
        onfocus={() => (focused = true)}
        onblur={() => (focused = false)}
        {onkeydown}
    >
        <WebcamBubbleFace
            size={grown && enlargedSize ? enlargedSize : bubbleSize}
            {stream}
            {loading}
            {hint}
        />
        {#if grown}
            <div class="pointer-events-none absolute {pillPlaces[position]}">
                <Pill><Icon icon={ViewIcon} size={14} />Check your framing</Pill>
            </div>
        {/if}
    </div>
</div>
