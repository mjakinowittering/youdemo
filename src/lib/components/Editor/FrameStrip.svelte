<script lang="ts">
    import { UndoIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon.svelte';
    import { Button } from '$lib/components/ui/button/index.js';

    import type { StripItem } from '$lib/editorMath.js';
    import { cn } from '$lib/utils.js';

    interface Props {
        /** The items in view; the rest are stood in for by `leading`. */
        items: StripItem[];
        /** Width in px of the items before those rendered. */
        leading?: number;
        /** How far the strip is panned, in px. */
        offset?: number;
        disabled?: boolean;
        onframeclick: (cell: number) => void;
        onrestore: (cut: number) => void;
        /** Wheel or trackpad: pan by this many px. */
        onpan?: (delta: number) => void;
        class?: string;
    }

    let {
        items,
        leading = 0,
        offset = 0,
        disabled = false,
        onframeclick,
        onrestore,
        onpan,
        class: className
    }: Props = $props();

    // Non-passive, so the page doesn't scroll while the strip pans
    function wheel(node: HTMLElement) {
        const handler = (e: WheelEvent) => {
            if (!onpan) return;
            e.preventDefault();
            onpan(Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
        };
        node.addEventListener('wheel', handler, { passive: false });
        return () => node.removeEventListener('wheel', handler);
    }
</script>

<!-- The row of frames and cut markers. It doesn't clip itself: the Editor puts it
     in an overflow-hidden band, and pans it by `offset`. -->
<div
    class={cn('flex w-max gap-0.75', className)}
    style:transform={offset ? `translateX(${-offset}px)` : undefined}
    {@attach wheel}
>
    {#if leading}<div class="shrink-0" style="width: {leading}px"></div>{/if}
    {#each items as item (item.kind === 'cut' ? `cut-${item.cut}` : item.cell)}
        {#if item.kind === 'cut'}
            <div class="relative mx-1 w-0.75 shrink-0 rounded-xs bg-yd-danger">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    class="absolute -top-5.5 left-1/2 -translate-x-1/2"
                    {disabled}
                    aria-label="Restore cut, {item.seconds} seconds"
                    onclick={() => onrestore(item.cut)}
                >
                    <Icon icon={UndoIcon} size={16} />
                </Button>
            </div>
        {:else}
            <!-- Clickable before its thumbnail arrives; until then, a skeleton -->
            <button
                type="button"
                class={cn(
                    'relative h-16 w-20 shrink-0 overflow-hidden rounded-frame border-[1.5px] border-solid',
                    item.thumb
                        ? 'border-yd-ink bg-yd-card'
                        : 'animate-skeleton border-yd-rule bg-yd-rule motion-reduce:animate-none',
                    item.current && 'z-1 outline-3 outline-offset-2 outline-yd-accent',
                    item.marked && 'border-yd-danger'
                )}
                {disabled}
                aria-pressed={item.marked}
                aria-label="Frame {item.cell}"
                onclick={() => onframeclick(item.cell)}
            >
                {#if item.thumb}
                    <!-- Sized as drawn: 77×61 inside the outline -->
                    <img
                        src={item.thumb}
                        alt=""
                        class="absolute top-0 left-0 h-15.25 w-19.25 object-cover"
                        data-compare-mask
                    />
                {/if}
                {#if item.marked}
                    <span class="absolute inset-0 bg-yd-danger-tint opacity-72"></span>
                {/if}
            </button>
        {/if}
    {/each}
</div>
