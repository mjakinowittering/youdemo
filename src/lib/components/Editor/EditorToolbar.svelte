<script lang="ts">
    import {
        Delete02Icon,
        RedoIcon,
        ScissorIcon,
        SearchAddIcon,
        SearchMinusIcon,
        UndoIcon
    } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon.svelte';
    import { buttonVariants } from '$lib/components/ui/button/button.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Toggle } from '$lib/components/ui/toggle/index.js';

    import { cn } from '$lib/utils.js';

    interface Props {
        trimming: boolean;
        canUndo: boolean;
        canRedo: boolean;
        /** "0.2 s a frame" */
        zoomLabel: string;
        canZoomIn: boolean;
        canZoomOut: boolean;
        /** The selection's length, "0.6 s"; empty when nothing is selected. */
        selection: string;
        /** Exporting: every control waits. */
        disabled?: boolean;
        ontoggletrim: () => void;
        onundo: () => void;
        onredo: () => void;
        onzoomin: () => void;
        onzoomout: () => void;
        onremove: () => void;
        class?: string;
    }

    let {
        trimming,
        canUndo,
        canRedo,
        zoomLabel,
        canZoomIn,
        canZoomOut,
        selection,
        disabled = false,
        ontoggletrim,
        onundo,
        onredo,
        onzoomin,
        onzoomout,
        onremove,
        class: className
    }: Props = $props();
</script>

<!-- Trim, Undo + Redo, then zoom; while trimming, the hint and Remove N s -->
<div class={cn('flex items-center gap-3.5', className)}>
    <Toggle
        pressed={trimming}
        onPressedChange={ontoggletrim}
        {disabled}
        class={cn(
            buttonVariants({ variant: 'ghost' }),
            'h-auto min-w-0 hover:bg-yd-card disabled:opacity-100 aria-pressed:bg-yd-ink aria-pressed:text-yd-card aria-pressed:hover:bg-yd-ink'
        )}
    >
        <Icon icon={ScissorIcon} class="size-5" />{trimming ? 'Trimming' : 'Trim'}
    </Toggle>
    <div class="flex items-center gap-2">
        <Button variant="ghost" disabled={disabled || !canUndo} onclick={onundo}>
            <Icon icon={UndoIcon} />Undo
        </Button>
        <Button
            variant="ghost"
            size="icon"
            disabled={disabled || !canRedo}
            aria-label="Redo"
            onclick={onredo}
        >
            <Icon icon={RedoIcon} />
        </Button>
    </div>
    <span class="flex-1"></span>
    {#if trimming}
        <p class="text-small font-semibold text-yd-ink">Select the frames to remove</p>
        <span class="flex-1"></span>
        <Button variant="danger" disabled={!selection} onclick={onremove}>
            <Icon icon={Delete02Icon} />{selection ? `Remove ${selection}` : 'Remove'}
        </Button>
    {:else}
        <span class="flex-1"></span>
        <div class="flex items-center gap-2">
            <span class="text-small text-yd-muted">{zoomLabel}</span>
            <Button
                variant="ghost"
                size="icon"
                disabled={disabled || !canZoomOut}
                aria-label="Zoom out"
                onclick={onzoomout}
            >
                <Icon icon={SearchMinusIcon} />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                disabled={disabled || !canZoomIn}
                aria-label="Zoom in"
                onclick={onzoomin}
            >
                <Icon icon={SearchAddIcon} />
            </Button>
        </div>
    {/if}
</div>
