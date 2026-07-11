<script lang="ts">
    import { Scissors, Trash2 } from 'lucide-svelte';

    import { Button } from '$lib/components/ui/button/index.js';

    import { formatTime } from '$lib/editorMath.js';

    interface Props {
        editMode?: boolean;
        canDelete?: boolean;
        effectiveDuration?: number;
        ontogglecut?: () => void;
        ondelete?: () => void;
    }

    let {
        editMode = false,
        canDelete = false,
        effectiveDuration = 0,
        ontogglecut,
        ondelete
    }: Props = $props();
</script>

<div class="flex items-center gap-2 border-t px-4 py-2">
    <Button
        variant={editMode ? 'default' : 'outline'}
        size="lg"
        onclick={() => ontogglecut?.()}
        class={editMode ? 'border-indigo-500 bg-indigo-500 text-white hover:bg-indigo-600' : ''}
    >
        <Scissors class="mr-1 size-4" />
        {editMode ? 'Selecting…' : 'Cut'}
    </Button>
    {#if canDelete}
        <Button variant="destructive" size="lg" onclick={() => ondelete?.()}>
            <Trash2 class="mr-1 size-4" />
            Delete
        </Button>
    {/if}
    <div class="flex-1"></div>
    <span class="text-sm text-muted-foreground">Final: {formatTime(effectiveDuration)}</span>
</div>
