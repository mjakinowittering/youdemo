<script lang="ts">
    import type { Snippet } from 'svelte';

    import * as Card from '$lib/components/ui/card/index.js';

    import { cn } from '$lib/utils.js';

    interface Props {
        class?: string;
        children: Snippet;
    }

    let { class: className, children }: Props = $props();
</script>

<!-- A raised card floating over the stage: card ground, ink outline, radius 16,
     the 8px panel shadow -->
<Card.Root
    class={cn(
        'w-110 gap-3.5 overflow-visible rounded-card border-[1.5px] border-solid border-yd-ink bg-yd-card p-6 text-body text-yd-ink shadow-panel ring-0',
        className
    )}
>
    {@render children()}
</Card.Root>
