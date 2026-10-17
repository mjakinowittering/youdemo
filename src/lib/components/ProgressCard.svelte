<script lang="ts">
    import { LoaderPinwheel } from '@lucide/svelte';

    import ProgressBar from './ProgressBar.svelte';
    import StageCard from './StageCard.svelte';

    interface Props {
        title: string;
        /** 0–100 */
        progress: number;
        note: string;
        class?: string;
    }

    let { title, progress, note, class: className }: Props = $props();
</script>

<!-- Joining and Exporting: a long job in the stage, with its percentage -->
<StageCard class={className}>
    <div class="flex items-center gap-2.5">
        <!-- The one Lucide icon (components.md): it still turns under reduced
             motion, at half speed, so the job still reads as running -->
        <LoaderPinwheel
            size={22}
            strokeWidth={1.5}
            aria-hidden="true"
            class="block shrink-0 animate-pinwheel motion-reduce:animate-pinwheel-slow"
        />
        <p class="text-row">{title}</p>
        <span class="flex-1"></span>
        <span class="text-row">{progress}%</span>
    </div>
    <ProgressBar value={progress} />
    <p class="text-small text-yd-muted">{note}</p>
</StageCard>
