<script lang="ts">
    import type { Snippet } from 'svelte';

    import { cn } from '$lib/utils.js';

    let { class: className, children }: { class?: string; children: Snippet } = $props();
</script>

<!-- The video in an ink frame, 533:300 as drawn, leaving 83px of stage above and
     below: exactly the design at 1280×960, larger on a taller window -->
<div
    class={cn(
        'relative aspect-[533/300] h-[calc(100%-166px)] max-w-[calc(100%-48px)] overflow-hidden rounded-control border-[1.5px] border-solid border-yd-ink bg-yd-card',
        className
    )}
>
    {@render children()}
</div>
