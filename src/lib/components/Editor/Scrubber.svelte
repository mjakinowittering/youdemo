<script lang="ts">
    import { PauseIcon, PlayIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Slider } from '$lib/components/ui/slider/index.js';

    import { cn } from '$lib/utils.js';

    interface Props {
        paused: boolean;
        /** "mm:ss / mm:ss", after cuts. */
        time: string;
        /** Playhead along the kept timeline, 0–100. */
        percent: number;
        disabled?: boolean;
        ontoggleplay: () => void;
        /** A new playhead, 0–100 along the kept timeline. */
        onseek: (percent: number) => void;
        class?: string;
    }

    let {
        paused,
        time,
        percent,
        disabled = false,
        ontoggleplay,
        onseek,
        class: className
    }: Props = $props();
</script>

<!-- Play/pause, the time, and the seek slider: 12 tall, ink outline, tangerine
     fill, a 22px card thumb on a 2px ink shadow. The 2px margin is the browser's
     own around a range input, which the design draws. -->
<div class={cn('flex items-center gap-3.5', className)}>
    <Button
        variant="ghost"
        size="icon"
        {disabled}
        aria-label={paused ? 'Play' : 'Pause'}
        onclick={ontoggleplay}
    >
        <Icon icon={paused ? PlayIcon : PauseIcon} />
    </Button>
    <span class="min-w-[110px] text-small font-semibold text-yd-ink">{time}</span>
    <Slider
        type="single"
        value={percent}
        max={100}
        step={0.1}
        {disabled}
        aria-label="Seek"
        onValueChange={onseek}
        class="m-0.5 h-3 flex-1 rounded-full border-[1.5px] border-solid border-yd-ink bg-yd-card **:data-[slot=slider-range]:bg-yd-accent *:data-[slot=slider-thumb]:size-[22px] *:data-[slot=slider-thumb]:border-2 *:data-[slot=slider-thumb]:border-solid *:data-[slot=slider-thumb]:border-yd-ink *:data-[slot=slider-thumb]:bg-yd-card *:data-[slot=slider-thumb]:shadow-offset-press *:data-[slot=slider-thumb]:ring-0 *:data-[slot=slider-thumb]:transition-none *:data-[slot=slider-thumb]:disabled:opacity-100 *:data-[slot=slider-track]:h-full *:data-[slot=slider-track]:bg-transparent data-disabled:opacity-100"
    />
</div>
