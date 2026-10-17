<script lang="ts">
    import { Loading03Icon } from '@hugeicons/core-free-icons';

    import Icon from './Icon.svelte';
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
        <Icon icon={Loading03Icon} size={22} />
        <p class="text-row">{title}</p>
        <span class="flex-1"></span>
        <span class="text-row">{progress}%</span>
    </div>
    <ProgressBar value={progress} />
    <p class="text-small text-yd-muted">{note}</p>
</StageCard>
