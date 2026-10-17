<script lang="ts">
    import { Alert02Icon, Copy01Icon, RefreshIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon.svelte';
    import StageCard from '$lib/components/StageCard.svelte';
    import TechnicalDetails from '$lib/components/TechnicalDetails.svelte';
    import { Button } from '$lib/components/ui/button/index.js';

    interface Props {
        /** Why, in words. */
        reason: string;
        /** The error and its stack, under Technical details and for Copy error. */
        details: string;
        onretry: () => void;
    }

    let { reason, details, onretry }: Props = $props();
</script>

<StageCard class="w-130">
    <div class="flex items-center gap-2.5">
        <Icon icon={Alert02Icon} size={24} class="text-yd-danger" />
        <h2 class="text-dialog">Export didn't finish</h2>
    </div>
    <p class="text-body text-yd-muted">{reason} Your takes and cuts are still here.</p>
    <TechnicalDetails {details} />
    <div class="flex items-center gap-3.5">
        <Button variant="primary" onclick={onretry}><Icon icon={RefreshIcon} />Try again</Button>
        <Button variant="ghost" onclick={() => navigator.clipboard?.writeText(details)}>
            <Icon icon={Copy01Icon} />Copy error
        </Button>
    </div>
</StageCard>
