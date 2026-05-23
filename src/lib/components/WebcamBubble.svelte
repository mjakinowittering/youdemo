<script lang="ts">
    export type BubblePosition = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'rc' | 'bc' | 'lc';

    const ALL_POSITIONS: BubblePosition[] = ['tl', 'tr', 'bl', 'br', 'tc', 'rc', 'bc', 'lc'];
    const BUBBLE = 200;
    const PAD = 20;

    interface Props {
        position?: BubblePosition;
        stream?: MediaStream | null;
    }

    let { position = $bindable('tr'), stream = null }: Props = $props();

    let dragging = $state(false);
    let dragLeft = $state(0);
    let dragTop = $state(0);
    let cw = $state(0);
    let ch = $state(0);

    let containerEl: HTMLDivElement | undefined;
    let grabX = 0;
    let grabY = 0;

    function coords(pos: BubblePosition): { x: number; y: number } {
        const cx = cw / 2 - BUBBLE / 2;
        const cy = ch / 2 - BUBBLE / 2;
        switch (pos) {
            case 'tl':
                return { x: PAD, y: PAD };
            case 'tr':
                return { x: cw - BUBBLE - PAD, y: PAD };
            case 'bl':
                return { x: PAD, y: ch - BUBBLE - PAD };
            case 'br':
                return { x: cw - BUBBLE - PAD, y: ch - BUBBLE - PAD };
            case 'tc':
                return { x: cx, y: PAD };
            case 'rc':
                return { x: cw - BUBBLE - PAD, y: cy };
            case 'bc':
                return { x: cx, y: ch - BUBBLE - PAD };
            case 'lc':
                return { x: PAD, y: cy };
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
        dragLeft = Math.max(0, Math.min(cw - BUBBLE, e.clientX - rect.left - grabX));
        dragTop = Math.max(0, Math.min(ch - BUBBLE, e.clientY - rect.top - grabY));
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
            class="pointer-events-auto absolute cursor-grab overflow-hidden rounded-full bg-black shadow-lg ring-2 ring-white/30 active:cursor-grabbing"
            style="left:{bx}px;top:{by}px;width:{BUBBLE}px;height:{BUBBLE}px"
            role="none"
            {onpointerdown}
            {onpointermove}
            {onpointerup}
            onpointercancel={onpointerup}
        >
            {#if stream}
                <video
                    {@attach setSrcObject(stream)}
                    autoplay
                    muted
                    playsinline
                    class="h-full w-full object-cover"
                ></video>
            {:else}
                <div class="flex h-full w-full items-center justify-center bg-muted">
                    <span class="text-xs text-muted-foreground">No cam</span>
                </div>
            {/if}
        </div>
    {/if}
</div>
