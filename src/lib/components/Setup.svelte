<script lang="ts">
    import { Monitor } from 'lucide-svelte';
    import { untrack } from 'svelte';

    import ControlBar from '$lib/components/ControlBar.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Empty from '$lib/components/ui/empty/index.js';
    import WebcamBubble from '$lib/components/WebcamBubble.svelte';
    import type { BubblePosition } from '$lib/components/WebcamBubble.svelte';

    import type { BlurIntensity } from '$lib/blurProcessor.js';
    import { deviceStore } from '$lib/deviceStore.svelte.js';

    interface Props {
        onstart: () => void;
        screenStream?: MediaStream | null;
        webcamStream?: MediaStream | null;
        micMuted?: boolean;
        camEnabled?: boolean;
        blurOn?: boolean;
        blurIntensity?: BlurIntensity;
        bubblePosition?: BubblePosition;
        processedStream?: MediaStream | null;
    }

    let {
        onstart,
        screenStream = $bindable(null),
        webcamStream = $bindable(null),
        micMuted = $bindable(false),
        camEnabled = $bindable(true),
        blurOn = $bindable(false),
        blurIntensity = $bindable<BlurIntensity>('default'),
        bubblePosition = $bindable<BubblePosition>('tr'),
        processedStream = null
    }: Props = $props();

    let pickError = $state('');
    let picking = $state(false);
    let screenAspect = $state(0);

    function setSrcObject(stream: MediaStream | null) {
        return (node: HTMLVideoElement) => {
            node.srcObject = stream;
            return () => {
                node.srcObject = null;
            };
        };
    }

    async function pickScreen() {
        try {
            pickError = '';
            picking = true;
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            screenStream = stream;
            // Recording auto-starts the moment a screen is picked — no separate
            // "Start Recording" step. Applies to any surface (tab, window, screen).
            onstart();
        } catch (err) {
            if (err instanceof Error && err.name !== 'NotAllowedError') {
                pickError = 'Could not capture screen. Please try again.';
            }
        } finally {
            picking = false;
        }
    }

    // Handle "Stop sharing" from browser share bar during Setup
    $effect(() => {
        const stream = screenStream;
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        if (!track) return;
        const handleEnded = () => {
            stream.getTracks().forEach((t) => t.stop());
            screenStream = null;
            screenAspect = 0;
        };
        track.addEventListener('ended', handleEnded);
        return () => track.removeEventListener('ended', handleEnded);
    });

    // Reactively manage webcam preview stream
    $effect(() => {
        const enabled = camEnabled;
        const deviceId = deviceStore.webcamDeviceId;

        if (!enabled) {
            untrack(() => {
                webcamStream?.getTracks().forEach((t) => t.stop());
                webcamStream = null;
            });
            return;
        }

        let cancelled = false;
        navigator.mediaDevices
            .getUserMedia({ video: deviceId ? { deviceId: { ideal: deviceId } } : true })
            .then((s) => {
                if (cancelled) {
                    s.getTracks().forEach((t) => t.stop());
                    return;
                }
                untrack(() => {
                    webcamStream?.getTracks().forEach((t) => t.stop());
                    webcamStream = s;
                });
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    });
</script>

<div class="flex h-full flex-col">
    <div class="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
        {#if screenStream}
            <video
                {@attach setSrcObject(screenStream)}
                autoplay
                muted
                playsinline
                onloadedmetadata={(e) => {
                    const v = e.currentTarget;
                    if (v.videoHeight) screenAspect = v.videoWidth / v.videoHeight;
                }}
                class="h-full w-full object-contain"
            ></video>
        {:else}
            <Empty.Root>
                <Empty.Media>
                    <Monitor size={128} class="text-white" />
                </Empty.Media>
                <Empty.Header>
                    <Empty.Title class="text-white">No screen selected</Empty.Title>
                    <Empty.Description class="text-white/60"
                        >Choose a screen and recording starts straight away</Empty.Description
                    >
                </Empty.Header>
                <Empty.Content>
                    <Button
                        class="bg-indigo-500 text-white hover:bg-indigo-600"
                        onclick={pickScreen}
                        disabled={picking}
                        size="lg"
                    >
                        {picking ? 'Requesting…' : 'Start Recording'}
                    </Button>
                    {#if pickError}
                        <p class="text-sm text-destructive">{pickError}</p>
                    {/if}
                </Empty.Content>
            </Empty.Root>
        {/if}

        {#if camEnabled}
            <WebcamBubble
                bind:position={bubblePosition}
                stream={webcamStream}
                {processedStream}
                {screenAspect}
            />
        {/if}
    </div>

    <ControlBar bind:micMuted bind:camEnabled bind:blurOn bind:blurIntensity disabled={false} />
</div>
