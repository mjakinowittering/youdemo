<script lang="ts">
    import type { Snippet } from 'svelte';

    import { cn } from '$lib/utils.js';

    interface Props {
        class?: string;
        children: Snippet;
    }

    let { class: className, children }: Props = $props();
</script>

<!-- A card of hairline-divided rows; each child is an <li> -->
<ul
    class={cn(
        'overflow-hidden rounded-card border-[1.5px] border-solid border-yd-ink bg-yd-card [&>li]:flex [&>li]:items-center [&>li]:gap-3.5 [&>li]:px-[18px] [&>li]:py-3.5 [&>li+li]:border-t [&>li+li]:border-solid [&>li+li]:border-yd-hairline',
        className
    )}
>
    {@render children()}
</ul>
