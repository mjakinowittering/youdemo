<script lang="ts">
    import { Clapperboard } from 'lucide-svelte';
    import { untrack } from 'svelte';

    import ControlBar from '$lib/components/ControlBar.svelte';
    import { buttonVariants } from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card/index.js';
    import * as Empty from '$lib/components/ui/empty/index.js';
    import WebcamBubble from '$lib/components/WebcamBubble.svelte';
    import type { BubblePosition } from '$lib/components/WebcamBubble.svelte';

    import type { BlurIntensity } from '$lib/blurProcessor.js';
    import { deviceStore } from '$lib/deviceStore.svelte.js';
    import { cn } from '$lib/utils.js';

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
    <div class="relative flex flex-1 items-center justify-center overflow-hidden bg-black/20">
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
            <Card.Root
                role="button"
                tabindex={0}
                onclick={pickScreen}
                onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        pickScreen();
                    }
                }}
                class={cn(
                    'max-w-xl flex-1 cursor-pointer items-center justify-center border-0 ring-2 ring-foreground/25 ring-offset-4 ring-offset-transparent transition-colors hover:ring-indigo-500 focus-visible:ring-indigo-500 focus-visible:outline-none'
                )}
            >
                <Empty.Root>
                    <Empty.Media>
                        <Clapperboard size={128} class="text-muted-foreground" />
                    </Empty.Media>
                    <Empty.Header>
                        <Empty.Title>No screen selected</Empty.Title>
                        <Empty.Description
                            >Choose a screen and recording starts straight away</Empty.Description
                        >
                    </Empty.Header>
                    <Empty.Content>
                        <div
                            class={cn(
                                buttonVariants({ size: 'lg' }),
                                'pointer-events-none bg-indigo-500 text-white'
                            )}
                        >
                            {picking ? 'Requesting…' : 'Start Recording'}
                        </div>
                        {#if pickError}
                            <p class="text-sm text-destructive">{pickError}</p>
                        {/if}
                    </Empty.Content>
                </Empty.Root>
            </Card.Root>
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
