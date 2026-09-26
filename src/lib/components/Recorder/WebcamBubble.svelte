<script lang="ts">
    import LoaderCircle from '@lucide/svelte/icons/loader-circle';

    import {
        BUBBLE_FRAC,
        BUBBLE_POSITIONS,
        bubbleCoords,
        type BubblePosition
    } from '$lib/bubbleGeometry.js';

    interface Props {
        position?: BubblePosition;
        stream?: MediaStream | null;
        processedStream?: MediaStream | null;
        /** Blur is being set up — dims the raw preview under a spinner. */
        loading?: boolean;
        /** Screen frame aspect ratio (width / height). 0 → fill container. */
        screenAspect?: number;
    }

    let {
        position = $bindable('tr'),
        stream = null,
        processedStream = null,
        loading = false,
        screenAspect = 0
    }: Props = $props();

    let dragging = $state(false);
    let dragLeft = $state(0);
    let dragTop = $state(0);
    let cw = $state(0);
    let ch = $state(0);

    let containerEl: HTMLDivElement | undefined;
    let grabX = 0;
    let grabY = 0;

    // The letterboxed rect of the screen video inside the container (object-contain).
    // The bubble is sized and positioned against this rect — not the raw container —
    // so it lines up with the composited frame, which has no letterbox bars.
    let frame = $derived.by(() => {
        if (!cw || !ch) return { x: 0, y: 0, w: cw, h: ch };
        if (!screenAspect) return { x: 0, y: 0, w: cw, h: ch };
        const containerAspect = cw / ch;
        if (screenAspect > containerAspect) {
            const h = cw / screenAspect;
            return { x: 0, y: (ch - h) / 2, w: cw, h };
        }
        const w = ch * screenAspect;
        return { x: (cw - w) / 2, y: 0, w, h: ch };
    });

    let BUBBLE = $derived(frame.h * BUBBLE_FRAC);

    function coords(pos: BubblePosition): { x: number; y: number } {
        return bubbleCoords(pos, frame);
    }

    function nearest(left: number, top: number): BubblePosition {
        return BUBBLE_POSITIONS.reduce<BubblePosition>((best, pos) => {
            const { x, y } = coords(pos);
            const { x: bx, y: by } = coords(best);
            return Math.hypot(left - x, top - y) < Math.hypot(left - bx, top - by) ? pos : best;
        }, 'tr');
    }

    let snapTarget = $derived(dragging ? nearest(dragLeft, dragTop) : position);
    let bx = $derived(dragging ? dragLeft : coords(position).x);
    let by = $derived(dragging ? dragTop : coords(position).y);

    function setSrcObject(s: MediaStream | null) {
        return (node: HTMLVideoElement) => {
            node.srcObject = s;
            return () => {
                node.srcObject = null;
            };
        };
    }

    function attachContainer(node: HTMLDivElement) {
        containerEl = node;
        cw = node.clientWidth;
        ch = node.clientHeight;
        const ro = new ResizeObserver(() => {
            cw = node.clientWidth;
            ch = node.clientHeight;
        });
        ro.observe(node);
        return () => ro.disconnect();
    }

    function onpointerdown(e: PointerEvent) {
        if (!containerEl) return;
        const rect = containerEl.getBoundingClientRect();
        const { x, y } = coords(position);
        grabX = e.clientX - rect.left - x;
        grabY = e.clientY - rect.top - y;
        dragLeft = x;
        dragTop = y;
        dragging = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
    }

    function onpointermove(e: PointerEvent) {
        if (!dragging || !containerEl) return;
        const rect = containerEl.getBoundingClientRect();
        dragLeft = Math.max(
            frame.x,
            Math.min(frame.x + frame.w - BUBBLE, e.clientX - rect.left - grabX)
        );
        dragTop = Math.max(
            frame.y,
            Math.min(frame.y + frame.h - BUBBLE, e.clientY - rect.top - grabY)
        );
    }

    function onpointerup() {
        if (!dragging) return;
        position = snapTarget;
        dragging = false;
    }
</script>

<div class="pointer-events-none absolute inset-0" {@attach attachContainer}>
    {#if dragging}
        {#each BUBBLE_POSITIONS.filter((p) => p !== snapTarget) as pos (pos)}
            {@const c = coords(pos)}
            <div
                class="absolute rounded-full border-2 border-white/40 bg-white/10"
                style="left:{c.x}px;top:{c.y}px;width:{BUBBLE}px;height:{BUBBLE}px"
            ></div>
        {/each}
    {/if}

    {#if cw > 0}
        <div
            class="pointer-events-auto absolute cursor-grab overflow-hidden rounded-full bg-black/20 shadow-lg ring-2 ring-indigo-500 active:cursor-grabbing"
            style="left:{bx}px;top:{by}px;width:{BUBBLE}px;height:{BUBBLE}px"
            role="none"
            {onpointerdown}
            {onpointermove}
            {onpointerup}
            onpointercancel={onpointerup}
        >
            {#if processedStream ?? stream}
                <video
                    {@attach setSrcObject(processedStream ?? stream)}
                    autoplay
                    muted
                    playsinline
                    class="size-full object-cover"
                ></video>
            {:else}
                <div class="flex size-full items-center justify-center bg-muted">
                    <span class="text-xs text-muted-foreground">No cam</span>
                </div>
            {/if}
            {#if loading}
                <div
                    role="status"
                    class="absolute inset-0 flex items-center justify-center bg-black/50"
                >
                    <LoaderCircle class="size-8 animate-spin text-white" aria-hidden="true" />
                    <span class="sr-only">Loading background blur…</span>
                </div>
            {/if}
        </div>
    {/if}
</div>
