<script lang="ts">
    import {
        ComputerScreenShareIcon,
        Download04Icon,
        ScissorIcon
    } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon.svelte';
    import Pill from '$lib/components/Pill.svelte';
    import { Button } from '$lib/components/ui/button/index.js';

    import type { BlurIntensity } from '$lib/blurProcessor.js';
    import type { BubblePosition } from '$lib/bubbleGeometry.js';

    import DockBand from './DockBand.svelte';
    import SharePlaceholder from './SharePlaceholder.svelte';
    import WebcamBubble from './WebcamBubble.svelte';

    interface Props {
        /** Opens the browser's picker; the countdown follows. */
        onchoose: () => void;
        /** No take has ever started here: the welcome folds into the left column. */
        firstVisit?: boolean;
        /** Shown under the button when the picker failed for a reason other than cancel. */
        pickError?: string;
        /** The camera as previewed: blurred when blur is on. */
        cameraStream?: MediaStream | null;
        blurLoading?: boolean;
        micMuted?: boolean;
        camEnabled?: boolean;
        blurOn?: boolean;
        blurIntensity?: BlurIntensity;
        bubblePosition?: BubblePosition;
    }

    let {
        onchoose,
        firstVisit = false,
        pickError = '',
        cameraStream = null,
        blurLoading = false,
        micMuted = $bindable(false),
        camEnabled = $bindable(true),
        blurOn = $bindable(false),
        blurIntensity = $bindable<BlurIntensity>('default'),
        bubblePosition = $bindable<BubblePosition>('tr')
    }: Props = $props();

    const features = [
        {
            icon: ComputerScreenShareIcon,
            text: 'Share a tab, window or screen, with your camera in a bubble'
        },
        { icon: ScissorIcon, text: 'Trim the slow bits on a timeline' },
        { icon: Download04Icon, text: 'Export a .webm file to your downloads' }
    ];
</script>

{#snippet choose()}
    <div class="flex items-center" class:mt-2={firstVisit}>
        <Button variant="primary" size="lg" onclick={onchoose}>
            <Icon icon={ComputerScreenShareIcon} />Choose what to share
        </Button>
    </div>
    {#if pickError}
        <p class="text-small text-yd-danger" role="alert">{pickError}</p>
    {/if}
{/snippet}

<div class="flex min-h-0 flex-1 flex-col">
    <section data-section="stage" class="relative flex min-h-0 flex-1 bg-yd-sand">
        {#if firstVisit}
            <div class="flex w-115 shrink-0 flex-col gap-[22px] px-10 pt-10 pb-8">
                <Pill class="self-start">First time here</Pill>
                <h1 class="text-display text-balance">Record your screen, trim it, export it</h1>
                <p class="text-lead text-yd-muted">
                    Everything happens in this tab. Nothing is uploaded, and there's no account to
                    make.
                </p>
                <ul class="flex flex-col gap-3">
                    {#each features as { icon, text } (text)}
                        <li class="flex items-start gap-3">
                            <Icon {icon} size={22} />
                            <span class="text-body text-yd-ink">{text}</span>
                        </li>
                    {/each}
                </ul>
                {@render choose()}
            </div>
        {:else}
            <div class="flex w-115 shrink-0 flex-col justify-center gap-[18px] p-10">
                <h1 class="text-display text-balance">Ready when you are</h1>
                <p class="text-lead text-yd-muted">
                    Check your mic, camera and blur below, then choose what to share.
                </p>
                {@render choose()}
                <p class="text-small text-yd-muted">
                    Recording starts three seconds after you choose.
                </p>
            </div>
        {/if}

        <!-- Where the share will show; the camera bubble can be moved around it -->
        <div
            class="relative my-8 mr-8 grid min-w-0 flex-1 place-items-center self-stretch rounded-card border-[1.5px] border-dashed border-yd-ink"
        >
            <SharePlaceholder />
            {#if camEnabled}
                <WebcamBubble
                    bind:position={bubblePosition}
                    stream={cameraStream}
                    loading={blurLoading}
                    size={112}
                    inset={18}
                    hint
                />
            {/if}
        </div>
    </section>

    <DockBand bind:micMuted bind:camEnabled bind:blurOn bind:blurIntensity />
</div>
