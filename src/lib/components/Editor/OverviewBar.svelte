<script lang="ts">
    import { cn } from '$lib/utils.js';

    interface Props {
        /** The part of the recording the strip shows, in % of the whole. */
        windowStart: number;
        windowWidth: number;
        /** Where each cut sits, in %. */
        cuts: number[];
        /** The playhead, in %. */
        playhead: number;
        disabled?: boolean;
        /** Clicked or dragged at this point, 0–1 along the bar. */
        onpan: (fraction: number) => void;
        class?: string;
    }

    let {
        windowStart,
        windowWidth,
        cuts,
        playhead,
        disabled = false,
        onpan,
        class: className
    }: Props = $props();

    let dragging = false;

    function pan(e: PointerEvent) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onpan(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
    }
</script>

<!-- The whole recording in one outlined bar: the strip's window in accent-tint
     with ink edges, each cut a danger line, the playhead an ink line -->
<div
    role="presentation"
    aria-label="Whole recording"
    class={cn(
        'relative h-8 touch-none overflow-hidden rounded-control border-[1.5px] border-solid border-yd-ink bg-yd-card',
        !disabled && 'cursor-pointer',
        className
    )}
    onpointerdown={(e) => {
        if (disabled) return;
        dragging = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        pan(e);
    }}
    onpointermove={(e) => dragging && pan(e)}
    onpointerup={() => (dragging = false)}
    onpointercancel={() => (dragging = false)}
>
    <div
        class="absolute inset-y-0 border-x-2 border-solid border-yd-ink bg-yd-accent-tint"
        style="left: {windowStart}%; width: {windowWidth}%"
    ></div>
    {#each cuts as cut, i (i)}
        <div class="absolute inset-y-0 -ml-0.5 w-1 bg-yd-danger" style="left: {cut}%"></div>
    {/each}
    <div class="absolute -inset-y-px w-0.5 bg-yd-ink" style="left: {playhead}%"></div>
</div>
