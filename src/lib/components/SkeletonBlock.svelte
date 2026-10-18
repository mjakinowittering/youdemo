<script lang="ts">
    import { Skeleton } from '$lib/components/ui/skeleton/index.js';

    import { cn } from '$lib/utils.js';

    let { class: className }: { class?: string } = $props();
</script>

<!-- A `rule` block pulsing at 1.4s; still under reduced motion -->
<Skeleton
    class={cn(
        'shrink-0 animate-skeleton rounded-control bg-yd-rule motion-reduce:animate-none',
        className
    )}
/>
