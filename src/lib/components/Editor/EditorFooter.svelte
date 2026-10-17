<script lang="ts">
    import { ArrowLeft01Icon, Delete02Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon.svelte';
    import { Button } from '$lib/components/ui/button/index.js';

    interface Props {
        onback?: () => void;
        ondiscard?: () => void;
        onexport?: () => void;
    }

    let { onback, ondiscard, onexport }: Props = $props();
</script>

<div class="flex items-center border-t px-4 py-3">
    <Button variant="ghost" size="lg" onclick={() => onback?.()}>
        <Icon icon={ArrowLeft01Icon} class="mr-1 size-4" />
        Back to Review
    </Button>
    <div class="flex-1"></div>
    <Button variant="danger-ghost" size="lg" onclick={() => ondiscard?.()}>
        <Icon icon={Delete02Icon} class="mr-1 size-4" />
        Discard
    </Button>
    <Button
        class="ml-2 bg-indigo-500 text-white hover:bg-indigo-600"
        onclick={() => onexport?.()}
        size="lg">Export & Download</Button
    >
</div>
