<script lang="ts">
    import type { Snippet } from 'svelte';

    import { cn } from '$lib/utils.js';

    interface Props {
        /** Names the list for assistive tech, as "Takes". */
        label?: string;
        class?: string;
        children: Snippet;
        /** Pinned under the rows behind a hairline; the rows then scroll. */
        footer?: Snippet;
    }

    let { label, class: className, children, footer }: Props = $props();
</script>

<!-- A card of hairline-divided rows; each child is an <li> -->
<div
    class={cn(
        'overflow-hidden rounded-card border-[1.5px] border-solid border-yd-ink bg-yd-card',
        footer && 'flex flex-col',
        className
    )}
>
    <ul
        aria-label={label}
        class={cn(
            '[&>li]:flex [&>li]:items-center [&>li]:gap-3.5 [&>li]:px-4.5 [&>li]:py-3.5 [&>li+li]:border-t [&>li+li]:border-solid [&>li+li]:border-yd-hairline',
            footer && 'min-h-0 flex-1 overflow-y-auto'
        )}
    >
        {@render children()}
    </ul>
    {#if footer}
        <div class="border-t border-solid border-yd-hairline px-3.5 py-3">
            {@render footer()}
        </div>
    {/if}
</div>
