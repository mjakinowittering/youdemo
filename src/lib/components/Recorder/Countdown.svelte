<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';

    import type { BlurIntensity } from '$lib/blurProcessor.js';

    import DockBand from './DockBand.svelte';

    interface Props {
        /** 3, 2, 1, 0; `+page.svelte` owns the tick, so the title can follow it. */
        count: number;
        /** Stops the share just picked and goes back to Setup or Review. */
        oncancel: () => void;
        micMuted?: boolean;
        camEnabled?: boolean;
        blurOn?: boolean;
        blurIntensity?: BlurIntensity;
    }

    let {
        count,
        oncancel,
        micMuted = false,
        camEnabled = true,
        blurOn = false,
        blurIntensity = 'default'
    }: Props = $props();

    // The arc drains a third each second: during "3" from full to two thirds left
    const R = 86;
    const CIRC = 540.4; // ≈ 2π × R
    const drained = (n: number) => Math.round((CIRC * (3 - n)) / 3);
</script>

<div class="flex min-h-0 flex-1 flex-col">
    <section
        data-section="stage"
        role="timer"
        class="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 bg-yd-sand"
    >
        <div class="relative grid size-50 place-items-center">
            <svg
                width="200"
                height="200"
                viewBox="0 0 200 200"
                class="absolute inset-0 -rotate-90"
                aria-hidden="true"
            >
                <circle
                    cx="100"
                    cy="100"
                    r={R}
                    class="fill-yd-card stroke-yd-rule"
                    stroke-width="10"
                />
                {#if count > 0}
                    {#key count}
                        <circle
                            cx="100"
                            cy="100"
                            r={R}
                            fill="none"
                            class="animate-drain stroke-yd-accent motion-reduce:animate-none"
                            stroke-width="10"
                            stroke-linecap="round"
                            stroke-dasharray={CIRC}
                            stroke-dashoffset={drained(count - 1)}
                            style="--from: {drained(count)}; --to: {drained(count - 1)}"
                        />
                    {/key}
                {/if}
                <circle
                    cx="100"
                    cy="100"
                    r="93"
                    fill="none"
                    class="stroke-yd-ink"
                    stroke-width="1.5"
                />
            </svg>
            <span class="relative text-[88px] leading-none font-extrabold">{count}</span>
        </div>
        <h1 class="text-screen text-balance">Recording starts in {count}</h1>
        <p class="text-lead text-yd-muted">
            Switch to what you want to show. Come back to this tab to stop.
        </p>
        <Button variant="ghost" onclick={oncancel}>Cancel</Button>
    </section>

    <DockBand {micMuted} {camEnabled} {blurOn} {blurIntensity} locked />
</div>
