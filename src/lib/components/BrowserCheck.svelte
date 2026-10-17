<script lang="ts">
    import {
        ArrowRight01Icon,
        Copy01Icon,
        LaptopIcon,
        Share08Icon,
        SmartphoneIcon
    } from '@hugeicons/core-free-icons';
    import { onMount } from 'svelte';

    import { tooltipClass } from '$lib/components/styles.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    import { canShare, copyLink, displayUrl, shareLink } from '$lib/share.js';

    import Icon from './Icon.svelte';
    import Pill from './Pill.svelte';
    import StatusList from './StatusList.svelte';

    let {
        onpass,
        hasScreenCapture = !!navigator.mediaDevices?.getDisplayMedia,
        hasMediaRecorder = typeof MediaRecorder !== 'undefined',
        hasCameraAccess = !!navigator.mediaDevices?.getUserMedia,
        hasAudioMixing = typeof AudioContext !== 'undefined' || 'webkitAudioContext' in window,
        url = location.href,
        shareable = canShare(navigator)
    }: {
        onpass: () => void;
        hasScreenCapture?: boolean;
        hasMediaRecorder?: boolean;
        hasCameraAccess?: boolean;
        hasAudioMixing?: boolean;
        /** The link to send to a computer. */
        url?: string;
        /** The share sheet exists; "Send the link" hides without it. */
        shareable?: boolean;
    } = $props();

    const blocking = $derived(!hasScreenCapture || !hasMediaRecorder);
    const allPass = $derived(!blocking && hasCameraAccess && hasAudioMixing);

    let copied = $state(false);

    async function copy() {
        copied = await copyLink(navigator, url);
        if (copied) setTimeout(() => (copied = false), 1500);
    }

    onMount(() => {
        if (allPass) onpass();
    });
</script>

{#if blocking}
    <!-- Screen capture or recording is missing: in practice, a phone -->
    <section
        data-section="stage"
        class="mx-auto flex w-full max-w-97.5 flex-1 flex-col gap-5.5 px-5 pt-8 pb-6"
    >
        <div class="flex items-center gap-2.5">
            <Icon icon={SmartphoneIcon} size={32} />
            <Icon icon={ArrowRight01Icon} size={20} />
            <Icon icon={LaptopIcon} size={36} />
        </div>
        <h1 class="text-screen text-[30px] text-balance">YouDemo needs a computer</h1>
        <p class="text-body text-yd-muted">
            YouDemo records your screen, and phones and tablets don't let websites do that.
        </p>
        <p class="text-body text-yd-muted">Open it on a computer in Chrome, Edge or Arc.</p>
        {#if shareable}
            <Button
                variant="primary"
                size="lg"
                class="w-full"
                onclick={() => shareLink(navigator, url)}
            >
                <Icon icon={Share08Icon} />Send the link to my computer
            </Button>
        {/if}
        <div
            class="flex flex-col gap-2.5 rounded-card border-[1.5px] border-solid border-yd-ink bg-yd-card px-4 py-3.5"
        >
            <span class="text-meta text-yd-muted uppercase">Or copy the link</span>
            <div class="flex items-center gap-2.5">
                <span class="min-w-0 flex-1 text-button font-semibold wrap-anywhere select-all">
                    {displayUrl(url)}
                </span>
                <Tooltip.Root open={copied}>
                    <Tooltip.Trigger>
                        {#snippet child({ props })}
                            <Button
                                {...props}
                                variant="ghost"
                                size="icon"
                                aria-label="Copy link"
                                onclick={copy}
                            >
                                <Icon icon={Copy01Icon} />
                            </Button>
                        {/snippet}
                    </Tooltip.Trigger>
                    <Tooltip.Content class={tooltipClass} arrowClasses="hidden"
                        >Copied</Tooltip.Content
                    >
                </Tooltip.Root>
            </div>
        </div>
        <p class="mt-auto text-small text-yd-muted">
            Nothing is uploaded. YouDemo runs entirely in your browser.
        </p>
    </section>
{:else if !allPass}
    <!-- Camera or audio mixing is missing: say which, in words, and carry on -->
    <section data-section="stage" class="flex min-h-0 flex-1 bg-yd-sand">
        <div class="m-auto flex w-140 flex-col gap-5.5">
            <Pill variant="sand" class="self-start">Browser check</Pill>
            <h1 class="text-screen text-balance">Some features aren't available in this browser</h1>
            <p class="text-lead text-yd-muted">
                You can still record your screen, just without your camera or system audio. Updating
                Chrome, Edge or Arc usually fixes this.
            </p>
            <StatusList
                rows={[
                    { name: 'Screen capture', available: hasScreenCapture },
                    { name: 'Recording', available: hasMediaRecorder },
                    { name: 'Camera', available: hasCameraAccess, optional: true },
                    { name: 'System audio mixing', available: hasAudioMixing, optional: true }
                ]}
            />
            <div class="flex items-center">
                <Button variant="primary" onclick={onpass}>
                    Continue without them<Icon icon={ArrowRight01Icon} size={18} />
                </Button>
            </div>
        </div>
    </section>
{/if}
