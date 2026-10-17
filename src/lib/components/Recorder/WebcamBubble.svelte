<script lang="ts">
    import {
        BUBBLE_POSITIONS,
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
    }

    let {
        position = $bindable('tr'),
        stream = null,
        loading = false,
        size,
        inset,
        hint = false,
        slots = 'dragging',
        slotPositions
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
    let overlay: HTMLDivElement | undefined;

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
        slots === 'always' || dragging
            ? (slotPositions ?? BUBBLE_POSITIONS.filter((p) => p !== target))
            : []
    );

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
        grabX = e.clientX - rect.left - at.x;
        grabY = e.clientY - rect.top - at.y;
        dragX = at.x;
        dragY = at.y;
        dragging = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
    }

    function onpointermove(e: PointerEvent) {
        if (!dragging || !overlay) return;
        const rect = overlay.getBoundingClientRect();
        dragX = Math.max(0, Math.min(frame.innerW - groupW, e.clientX - rect.left - grabX));
        dragY = Math.max(0, Math.min(frame.innerH - groupH, e.clientY - rect.top - grabY));
    }

    function onpointerup() {
        if (!dragging) return;
        position = target;
        dragging = false;
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
                slotSize,
                slotSize,
                bubbleInset + SLOT_INSET
            )}; width: {slotSize}px; height: {slotSize}px"
        ></div>
    {/each}

    <div
        class="pointer-events-auto absolute cursor-grab touch-none active:cursor-grabbing"
        class:invisible={!frame.innerW || !groupW}
        style={dragging
            ? `left: ${dragX}px; top: ${dragY}px`
            : previewSpotStyle(position, frame, groupW, groupH, bubbleInset)}
        bind:offsetWidth={groupW}
        bind:offsetHeight={groupH}
        role="none"
        {onpointerdown}
        {onpointermove}
        {onpointerup}
        onpointercancel={onpointerup}
    >
        <WebcamBubbleFace size={bubbleSize} {stream} {loading} {hint} />
    </div>
</div>
