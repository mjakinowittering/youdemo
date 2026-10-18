<script lang="ts">
    import type { Snippet } from 'svelte';

    import { Badge } from '$lib/components/ui/badge/index.js';

    import { cn } from '$lib/utils.js';

    type PillVariant = 'plain' | 'sand' | 'on' | 'off' | 'rec';

    interface Props {
        variant?: PillVariant;
        class?: string;
        children: Snippet;
    }

    let { variant = 'plain', class: className, children }: Props = $props();

    const variants: Record<PillVariant, string> = {
        plain: 'bg-yd-card',
        sand: 'bg-yd-sand',
        on: 'bg-yd-success-tint',
        off: 'border-yd-danger bg-yd-danger-tint text-yd-danger',
        rec: 'bg-yd-ink text-yd-card'
    };
</script>

<Badge
    class={cn(
        'h-7 gap-1.5 overflow-visible rounded-full border-[1.5px] border-solid border-yd-ink px-3 py-0 text-pill leading-none font-bold tracking-[0.06em] text-yd-ink uppercase [&>svg]:size-auto!',
        variants[variant],
        className
    )}
>
    {#if variant === 'rec'}
        <span class="size-[9px] rounded-full bg-yd-rec"></span>
    {/if}
    {@render children()}
</Badge>
