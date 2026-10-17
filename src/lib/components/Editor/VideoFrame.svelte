<script lang="ts">
    import type { Snippet } from 'svelte';

    import { cn } from '$lib/utils.js';

    let {
        class: className,
        aspect = null,
        children
    }: {
        class?: string;
        /** The video's width ÷ height, once known; the frame takes its shape. */
        aspect?: number | null;
        children: Snippet;
    } = $props();
</script>

<!-- The video in an ink frame with the bubble's hard shadow, 533:300 as drawn (or
     the recording's own shape),
     leaving 83px of stage above and below: exactly the design at 1280×960,
     larger on a taller window -->
<div
    class={cn(
        'relative aspect-533/300 h-[calc(100%-166px)] max-w-[calc(100%-48px)] overflow-hidden rounded-control border-[1.5px] border-solid border-yd-ink bg-yd-card shadow-bubble',
        className
    )}
    style={aspect ? `aspect-ratio: ${aspect}` : undefined}
>
    {@render children()}
</div>
