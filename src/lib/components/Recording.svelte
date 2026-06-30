<script lang="ts">
    import { RadioTower, Square } from 'lucide-svelte';
    import { onDestroy, onMount } from 'svelte';

    import ControlBar from '$lib/components/ControlBar.svelte';
    import { buttonVariants } from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card/index.js';
    import * as Empty from '$lib/components/ui/empty/index.js';

    import type { BlurIntensity } from '$lib/blurProcessor.js';
    import { cn } from '$lib/utils.js';

    interface Props {
        onstop: () => void;
        onstreamended?: () => void;
        screenStream?: MediaStream | null;
        micMuted?: boolean;
        camEnabled?: boolean;
        blurOn?: boolean;
        blurIntensity?: BlurIntensity;
    }

    let {
        onstop,
        onstreamended = () => {},
        screenStream = null,
        micMuted = $bindable(false),
        camEnabled = $bindable(true),
        blurOn = $bindable(false),
        blurIntensity = $bindable<BlurIntensity>('default')
    }: Props = $props();

    let timerInterval: ReturnType<typeof setInterval>;
    let elapsed = $state(0);

    let formatted = $derived(
        `${Math.floor(elapsed / 60)
            .toString()
            .padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`
    );

    function stop() {
        clearInterval(timerInterval);
        document.title = 'YouDemo';
        onstop();
    }

    onMount(() => {
        document.title = '● REC 00:00 | YouDemo';
        timerInterval = setInterval(() => {
            elapsed += 1;
            const mm = Math.floor(elapsed / 60)
                .toString()
                .padStart(2, '0');
            const ss = (elapsed % 60).toString().padStart(2, '0');
            document.title = `● REC ${mm}:${ss} | YouDemo`;
        }, 1000);
    });

    // Detect the user ending screen share from the browser bar. In a $effect (not
    // the async onMount) so the listener is reliably torn down on unmount.
    $effect(() => {
        const track = screenStream?.getVideoTracks()[0];
        if (!track) return;
        const handleTrackEnded = () => onstreamended();
        track.addEventListener('ended', handleTrackEnded);
        return () => track.removeEventListener('ended', handleTrackEnded);
    });

    onDestroy(() => {
        clearInterval(timerInterval);
        document.title = 'YouDemo';
    });
</script>

<div class="flex h-full flex-col">
    <div class="relative flex flex-1 items-center justify-center overflow-hidden bg-black/20">
        <Card.Root
            role="button"
            tabindex={0}
            onclick={stop}
            onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    stop();
                }
            }}
            class={cn(
                'max-w-xl flex-1 cursor-pointer items-center justify-center border transition-colors hover:bg-muted/50 hover:ring-destructive focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-none'
            )}
        >
            <Empty.Root>
                <Empty.Media>
                    <RadioTower size={128} class="text-white" />
                </Empty.Media>
                <Empty.Header>
                    <Empty.Title class="text-white">Recording in progress</Empty.Title>
                </Empty.Header>
                <Empty.Content>
                    <div
                        class={cn(
                            buttonVariants({ variant: 'destructive', size: 'lg' }),
                            'pointer-events-none'
                        )}
                    >
                        <Square class="mr-1 size-4 fill-current" />
                        Stop Recording
                    </div>
                </Empty.Content>
            </Empty.Root>
        </Card.Root>

        <div
            class="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-sm text-white backdrop-blur-sm"
        >
            <span class="rec-dot h-2 w-2 rounded-full bg-red-500"></span>
            <span class="font-semibold tracking-wide">REC</span>
            <span class="font-mono">{formatted}</span>
        </div>
    </div>

    <ControlBar bind:micMuted bind:camEnabled bind:blurOn bind:blurIntensity disabled={true} />
</div>

<style>
    .rec-dot {
        animation: rec-pulse 1.5s ease-in-out infinite;
    }

    @keyframes rec-pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.3;
        }
    }
</style>
