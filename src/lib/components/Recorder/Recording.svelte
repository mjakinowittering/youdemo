<script lang="ts">
    import { Square, Tv } from 'lucide-svelte';
    import { onDestroy, onMount } from 'svelte';

    import { buttonVariants } from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card/index.js';
    import * as Empty from '$lib/components/ui/empty/index.js';

    import type { BlurIntensity } from '$lib/blurProcessor.js';
    import { formatElapsed } from '$lib/titles.js';
    import { cn } from '$lib/utils.js';

    import ControlBar from './ControlBar.svelte';

    interface Props {
        onstop: () => void;
        onstreamended?: () => void;
        screenStream?: MediaStream | null;
        micMuted?: boolean;
        camEnabled?: boolean;
        blurOn?: boolean;
        blurIntensity?: BlurIntensity;
        elapsed?: number;
    }

    let {
        onstop,
        onstreamended = () => {},
        screenStream = null,
        micMuted = $bindable(false),
        camEnabled = $bindable(true),
        blurOn = $bindable(false),
        blurIntensity = $bindable<BlurIntensity>('default'),
        elapsed = $bindable(0)
    }: Props = $props();

    let timerInterval: ReturnType<typeof setInterval>;

    let formatted = $derived(formatElapsed(elapsed));

    function stop() {
        clearInterval(timerInterval);
        onstop();
    }

    onMount(() => {
        timerInterval = setInterval(() => {
            elapsed += 1;
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
    });
</script>

<div class="flex h-full flex-col bg-black/20">
    <div class="relative flex flex-1 items-center justify-center overflow-hidden">
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
                'max-w-xl flex-1 cursor-pointer items-center justify-center border-0 ring-2 ring-foreground/25 ring-offset-4 ring-offset-transparent transition-colors hover:ring-destructive focus-visible:ring-destructive focus-visible:outline-none'
            )}
        >
            <Empty.Root>
                <Empty.Media>
                    <Tv size={128} class="text-muted-foreground" />
                </Empty.Media>
                <Empty.Header>
                    <Empty.Title>Recording in progress</Empty.Title>
                    <Empty.Description>
                        Your screen and webcam are being captured. Click below when you're done.
                    </Empty.Description>
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
            <span class="size-2 animate-rec-pulse rounded-full bg-red-500"></span>
            <span class="font-semibold tracking-wide">REC</span>
            <span class="font-mono">{formatted}</span>
        </div>
    </div>

    <ControlBar bind:micMuted bind:camEnabled bind:blurOn bind:blurIntensity disabled={true} />
</div>
