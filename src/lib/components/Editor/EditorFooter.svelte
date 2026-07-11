<script lang="ts">
    import { ChevronLeft, Trash2 } from 'lucide-svelte';

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
        <ChevronLeft class="mr-1 size-4" />
        Back to Review
    </Button>
    <div class="flex-1"></div>
    <Button variant="destructive" size="lg" onclick={() => ondiscard?.()}>
        <Trash2 class="mr-1 size-4" />
        Discard
    </Button>
    <Button
        class="ml-2 bg-indigo-500 text-white hover:bg-indigo-600"
        onclick={() => onexport?.()}
        size="lg">Export & Download</Button
    >
</div>
