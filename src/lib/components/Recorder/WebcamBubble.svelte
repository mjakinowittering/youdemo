<script lang="ts">
    export type BubblePosition = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'rc' | 'bc' | 'lc';

    const ALL_POSITIONS: BubblePosition[] = ['tl', 'tr', 'bl', 'br', 'tc', 'rc', 'bc', 'lc'];

    // Bubble geometry as a fraction of frame height, kept identical to recorder.ts
    // so the preview matches the composited recording at any resolution.
    const BUBBLE_FRAC = 0.18;
    const PAD_FRAC = 0.025;

    interface Props {
        position?: BubblePosition;
        stream?: MediaStream | null;
        processedStream?: MediaStream | null;
        /** Screen frame aspect ratio (width / height). 0 → fill container. */
        screenAspect?: number;
    }

    let {
        position = $bindable('tr'),
        stream = null,
        processedStream = null,
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
    let PAD = $derived(frame.h * PAD_FRAC);

    function coords(pos: BubblePosition): { x: number; y: number } {
        const left = frame.x + PAD;
        const right = frame.x + frame.w - BUBBLE - PAD;
        const top = frame.y + PAD;
        const bottom = frame.y + frame.h - BUBBLE - PAD;
        const cx = frame.x + frame.w / 2 - BUBBLE / 2;
        const cy = frame.y + frame.h / 2 - BUBBLE / 2;
        switch (pos) {
            case 'tl':
                return { x: left, y: top };
            case 'tr':
                return { x: right, y: top };
            case 'bl':
                return { x: left, y: bottom };
            case 'br':
                return { x: right, y: bottom };
            case 'tc':
                return { x: cx, y: top };
            case 'rc':
                return { x: right, y: cy };
            case 'bc':
                return { x: cx, y: bottom };
            case 'lc':
                return { x: left, y: cy };
        }
    }

    function nearest(left: number, top: number): BubblePosition {
        return ALL_POSITIONS.reduce<BubblePosition>((best, pos) => {
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
        {#each ALL_POSITIONS.filter((p) => p !== snapTarget) as pos (pos)}
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
        </div>
    {/if}
</div>
