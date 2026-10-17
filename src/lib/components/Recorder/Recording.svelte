<script lang="ts">
    import { StopIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon.svelte';
    import Pill from '$lib/components/Pill.svelte';
    import { Button } from '$lib/components/ui/button/index.js';

    import type { BlurIntensity } from '$lib/blurProcessor.js';
    import { formatElapsed } from '$lib/titles.js';
    import { cn, srcObject } from '$lib/utils.js';

    import DockBand from './DockBand.svelte';

    interface Props {
        onstop: () => void;
        /** Seconds recorded; `+page.svelte` owns the tick, so the title can follow it. */
        elapsed: number;
        /** This take's number, from 1. */
        take: number;
        /** The composited frame being encoded, bubble and blur included. */
        previewStream?: MediaStream | null;
        micMuted?: boolean;
        camEnabled?: boolean;
        blurOn?: boolean;
        blurIntensity?: BlurIntensity;
    }

    let {
        onstop,
        elapsed,
        take,
        previewStream = null,
        micMuted = false,
        camEnabled = true,
        blurOn = false,
        blurIntensity = 'default'
    }: Props = $props();

    // The frame takes the recording's shape once known, so a window share isn't
    // letterboxed: as wide as drawn (820), or as tall (461) for a narrower one
    let videoWidth = $state(0);
    let videoHeight = $state(0);
    const aspect = $derived(videoWidth && videoHeight ? videoWidth / videoHeight : null);
</script>

<div class="flex min-h-0 flex-1 flex-col">
    <section data-section="stage" class="relative flex min-h-0 flex-1 bg-yd-sand">
        <div class="flex flex-1 flex-col items-center justify-center gap-[18px] p-6">
            <div class="flex w-205 max-w-full items-center gap-3.5">
                <Pill variant="rec"
                    >REC<span class="tracking-normal">{formatElapsed(elapsed)}</span></Pill
                >
                <span class="text-small text-yd-muted">Take {take}</span>
                <span class="flex-1"></span>
                <span class="text-small text-yd-muted">
                    Stopping the share in Chrome also ends the take
                </span>
            </div>
            <div
                class={cn(
                    'aspect-[820/461] max-w-full overflow-hidden rounded-control border-[1.5px] border-solid border-yd-ink bg-yd-card',
                    aspect && aspect < 820 / 461 ? 'h-[461px]' : 'w-205',
                    // The shape is the video's inside the outline, so no sliver of card shows
                    aspect && 'box-content'
                )}
                style={aspect ? `aspect-ratio: ${aspect}` : undefined}
            >
                {#if previewStream}
                    <video
                        {@attach srcObject(previewStream)}
                        autoplay
                        muted
                        playsinline
                        bind:videoWidth
                        bind:videoHeight
                        aria-label="Live recording preview"
                        class="size-full object-cover"
                    ></video>
                {:else}
                    <!-- Sized as the frame drawn, outline and all -->
                    <div class="h-[461px] w-205 bg-yd-rule" data-compare-mask></div>
                {/if}
            </div>
            <Button variant="danger" size="lg" onclick={onstop}>
                <Icon icon={StopIcon} />Stop recording
            </Button>
        </div>
    </section>

    <DockBand {micMuted} {camEnabled} {blurOn} {blurIntensity} locked />
</div>
