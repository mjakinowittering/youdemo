<script lang="ts">
    import {
        ComputerScreenShareIcon,
        Delete02Icon,
        Move01Icon,
        RecordIcon,
        ScissorIcon,
        VideoReplayIcon
    } from '@hugeicons/core-free-icons';

    import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
    import Icon from '$lib/components/Icon.svelte';
    import ListCard from '$lib/components/ListCard.svelte';
    import { Button } from '$lib/components/ui/button/index.js';

    import type { BlurIntensity } from '$lib/blurProcessor.js';
    import type { BubblePosition } from '$lib/bubbleGeometry.js';
    import { formatElapsed } from '$lib/titles.js';
    import { cn, srcObject } from '$lib/utils.js';

    import DockBand from './DockBand.svelte';
    import SharePlaceholder from './SharePlaceholder.svelte';
    import WebcamBubble from './WebcamBubble.svelte';

    interface Props {
        /** Each take's length in seconds, in order. */
        takes: number[];
        /** The running share's name, from its track; empty once the share has ended. */
        shareLabel?: string;
        /** The running share itself, shown live. */
        shareStream?: MediaStream | null;
        /** The camera as previewed: blurred when blur is on. */
        cameraStream?: MediaStream | null;
        /** Blur is starting: the bubble dims the raw camera under a spinner. */
        blurLoading?: boolean;
        /** The discard confirmation is open. */
        discardOpen?: boolean;
        /** The bubble's framing check is showing, without hovering (stories). */
        bubbleEnlarged?: boolean;
        /** Record take N: straight to the countdown with a live share, else the picker first. */
        onrecord: () => void;
        /** Change (or Choose) what the next take shares. */
        onchangeshare: () => void;
        onedit: () => void;
        /** Confirmed: every take, cut and the crash store go. */
        ondiscard: () => void;
        micMuted?: boolean;
        camEnabled?: boolean;
        blurOn?: boolean;
        blurIntensity?: BlurIntensity;
        bubblePosition?: BubblePosition;
    }

    let {
        takes,
        shareLabel = '',
        shareStream = null,
        cameraStream = null,
        blurLoading = false,
        discardOpen = $bindable(false),
        bubbleEnlarged = false,
        onrecord,
        onchangeshare,
        onedit,
        ondiscard,
        micMuted = $bindable(false),
        camEnabled = $bindable(true),
        blurOn = $bindable(false),
        blurIntensity = $bindable<BlurIntensity>('default'),
        bubblePosition = $bindable<BubblePosition>('tr')
    }: Props = $props();

    let total = $derived(formatElapsed(takes.reduce((sum, d) => sum + d, 0)));
    let heading = $derived(
        `${takes.length} ${takes.length === 1 ? 'take' : 'takes'}, ${total} in total`
    );
    let discardBody = $derived(
        `${takes.length === 1 ? 'The take' : takes.length === 2 ? 'Both takes' : `All ${takes.length} takes`} (${total}) ${takes.length === 1 ? 'is' : 'are'} deleted from this browser, including the copy kept in case it crashes. This can't be undone.`
    );
</script>

<div class="flex min-h-0 flex-1 flex-col">
    <section data-section="stage" class="relative flex min-h-0 flex-1 bg-yd-sand">
        <div class="m-auto flex flex-col gap-6">
            <div class="flex flex-col gap-1.5">
                <span class="text-meta text-yd-muted uppercase">Recording paused</span>
                <h1 class="text-screen text-balance">{heading}</h1>
            </div>

            <div class="flex items-start gap-12">
                <div class="flex flex-col gap-3">
                    <!-- The next take's share, live, with the camera where it will sit.
                         Once the share ends, Setup's dashed placeholder. -->
                    <div
                        class={cn(
                            'relative grid h-87 w-155 place-items-center overflow-hidden rounded-control border-[1.5px] border-yd-ink bg-yd-card',
                            shareLabel ? 'border-solid' : 'border-dashed'
                        )}
                    >
                        {#if !shareLabel}
                            <SharePlaceholder />
                        {:else if shareStream}
                            <video
                                {@attach srcObject(shareStream)}
                                autoplay
                                muted
                                playsinline
                                aria-label="What the next take shares"
                                class="absolute inset-0 size-full object-cover"
                            ></video>
                        {:else}
                            <!-- Sized as the frame drawn, outline and all -->
                            <div
                                class="absolute top-0 left-0 h-87 w-155 bg-yd-rule"
                                data-compare-mask
                            ></div>
                        {/if}
                        {#if camEnabled}
                            <WebcamBubble
                                bind:position={bubblePosition}
                                stream={cameraStream}
                                loading={blurLoading}
                                slots="always"
                                enlargedSize={160}
                                enlarged={bubbleEnlarged}
                            />
                        {/if}
                    </div>

                    <div
                        class="flex h-14 w-155 items-center gap-2 rounded-notice border-[1.5px] border-solid border-yd-ink bg-yd-card px-3.5"
                    >
                        <Icon icon={ComputerScreenShareIcon} />
                        {#if shareLabel}
                            <!-- A long window or tab name is cut short, never Change -->
                            <span class="min-w-0 truncate text-small text-yd-ink">
                                Next take shares <b>{shareLabel}</b>
                            </span>
                        {:else}
                            <span class="text-small text-yd-ink">
                                Next take: choose what to share
                            </span>
                        {/if}
                        <span class="flex-1"></span>
                        <Button
                            variant="link"
                            class="min-h-8 shrink-0 text-small"
                            onclick={onchangeshare}
                        >
                            {shareLabel ? 'Change' : 'Choose'}
                        </Button>
                    </div>

                    {#if camEnabled}
                        <p class="flex items-center gap-2 text-small text-yd-muted">
                            <Icon icon={Move01Icon} size={18} />
                            Drag the bubble to move it for your next take. It snaps to the dashed spots.
                        </p>
                    {/if}
                </div>

                <div class="flex w-95 flex-col gap-3">
                    <div class="flex h-87 flex-col gap-5">
                        <ListCard label="Takes" class="min-h-0 flex-1">
                            {#each takes as duration, i (i)}
                                <li>
                                    <Icon icon={VideoReplayIcon} size={22} />
                                    <span class="font-semibold">Take {i + 1}</span>
                                    <span class="flex-1"></span>
                                    <span class="text-small text-yd-muted">
                                        {formatElapsed(duration)}
                                    </span>
                                </li>
                            {/each}
                            {#snippet footer()}
                                <Button variant="ghost" class="w-full" onclick={onrecord}>
                                    <Icon icon={RecordIcon} />Record take {takes.length + 1}
                                </Button>
                            {/snippet}
                        </ListCard>
                        <Button
                            variant="danger-ghost"
                            size="lg"
                            class="w-full"
                            onclick={() => (discardOpen = true)}
                        >
                            <Icon icon={Delete02Icon} />Discard recording
                        </Button>
                        <div
                            role="separator"
                            class="border-t-[1.5px] border-solid border-yd-ink"
                        ></div>
                    </div>
                    <Button variant="primary" size="lg" class="min-h-14 w-full" onclick={onedit}>
                        <Icon icon={ScissorIcon} />Edit and export
                    </Button>
                </div>
            </div>
        </div>
    </section>

    <DockBand bind:micMuted bind:camEnabled bind:blurOn bind:blurIntensity />
</div>

<ConfirmDialog
    bind:open={discardOpen}
    title="Discard this recording?"
    body={discardBody}
    cancelLabel="Keep recording"
    confirmLabel="Discard"
    confirmIcon={Delete02Icon}
    tone="danger"
    onconfirm={ondiscard}
/>
