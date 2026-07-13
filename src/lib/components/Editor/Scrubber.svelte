<script lang="ts">
    import { Pause, Play } from 'lucide-svelte';

    import { Button } from '$lib/components/ui/button/index.js';

    import { formatTime, FRAME_RATE } from '$lib/editorMath.js';

    interface Props {
        paused?: boolean;
        effectiveCurrentTime?: number;
        effectiveDuration?: number;
        frameRate?: number;
        ontoggleplay?: () => void;
        onseek?: (effectiveTime: number) => void;
    }

    let {
        paused = true,
        effectiveCurrentTime = 0,
        effectiveDuration = 0,
        frameRate = FRAME_RATE,
        ontoggleplay,
        onseek
    }: Props = $props();
</script>

<div class="flex items-center gap-3 border-t px-4 py-2">
    <Button variant="ghost" size="icon-lg" onclick={() => ontoggleplay?.()}>
        {#if paused}
            <Play class="size-4" />
        {:else}
            <Pause class="size-4" />
        {/if}
    </Button>
    <span class="min-w-22.5 font-mono text-sm text-muted-foreground tabular-nums">
        {formatTime(effectiveCurrentTime)} / {formatTime(effectiveDuration)}
    </span>
    <input
        type="range"
        class="flex-1 accent-indigo-500"
        min="0"
        max={effectiveDuration || 1}
        step={1 / frameRate}
        value={effectiveCurrentTime}
        oninput={(e) => onseek?.(parseFloat(e.currentTarget.value))}
    />
</div>
