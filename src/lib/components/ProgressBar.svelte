<script lang="ts">
    import { Progress } from '$lib/components/ui/progress/index.js';

    import { cn } from '$lib/utils.js';

    interface Props {
        /** 0–100. Callers show it as text beside the bar too. */
        value: number;
        class?: string;
    }

    let { value, class: className }: Props = $props();
</script>

<!-- A 12px pill: ink outline, card track, tangerine fill closed by an ink edge.
     The fill is sized by width rather than the primitive's translate, so its ink
     edge lands on the same pixel as the design's. -->
<Progress
    {value}
    style="--fill: {value}%"
    class={cn(
        'h-3 rounded-full border-[1.5px] border-solid border-yd-ink bg-yd-card *:data-[slot=progress-indicator]:w-(--fill) *:data-[slot=progress-indicator]:flex-none *:data-[slot=progress-indicator]:transform-none! *:data-[slot=progress-indicator]:border-r-[1.5px] *:data-[slot=progress-indicator]:border-solid *:data-[slot=progress-indicator]:border-yd-ink *:data-[slot=progress-indicator]:bg-yd-accent',
        className
    )}
/>
