<script lang="ts">
    import type { Snippet } from 'svelte';

    import { cn } from '$lib/utils.js';

    let {
        class: className,
        aspect = null,
        children
    }: {
        class?: string;
        /** The decoded video's width ÷ height, once known; the frame takes its shape. */
        aspect?: number | null;
        children: Snippet;
    } = $props();
</script>

<!-- The video in an ink frame with the bubble's hard shadow: its height the stage
     less 80px above and below (at most the stage's width less 24px a side, over
     the ratio), its width following from the video. The ratio sits on the inner
     box, which fills the height inside the 1.5px border, so the border never
     changes it. Until the video's size is known, the frame is 533:300 as drawn. -->
<div
    class={cn(
        'h-[min(100cqh-160px,(100cqw-51px)/var(--aspect)+3px)] overflow-hidden rounded-control border-[1.5px] border-solid border-yd-ink bg-yd-card shadow-bubble',
        !aspect && 'aspect-533/300',
        className
    )}
    style:--aspect={aspect ?? 533 / 300}
>
    <div class={['relative h-full', aspect ? 'aspect-(--aspect)' : 'w-full']}>
        {@render children()}
    </div>
</div>
