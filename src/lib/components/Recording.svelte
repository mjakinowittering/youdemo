<script lang="ts">
    import { ChevronDown, Mic, MicOff, RadioTower, Square, Video, VideoOff } from 'lucide-svelte';

    import * as Empty from '$lib/components/ui/empty/index.js';
    import { onDestroy, onMount } from 'svelte';

    import { buttonVariants } from '$lib/components/ui/button/button.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    import { deviceStore } from '$lib/deviceStore.svelte.js';
    import { cn } from '$lib/utils.js';

    interface Props {
        onstop: () => void;
        onstreamended?: () => void;
        screenStream?: MediaStream | null;
        micMuted?: boolean;
        camEnabled?: boolean;
        ontogglemic?: () => void;
        ontogglecam?: () => void;
    }

    let {
        onstop,
        onstreamended = () => {},
        screenStream = null,
        micMuted = false,
        camEnabled = true,
        ontogglemic = () => {},
        ontogglecam = () => {}
    }: Props = $props();

    let timerInterval: ReturnType<typeof setInterval>;
    let elapsed = $state(0);
    let micDevices = $state<MediaDeviceInfo[]>([]);
    let camDevices = $state<MediaDeviceInfo[]>([]);

    let micLabel = $derived(
        micDevices.find((d) => d.deviceId === deviceStore.micDeviceId)?.label ||
            'Default microphone'
    );
    let camLabel = $derived(
        camDevices.find((d) => d.deviceId === deviceStore.webcamDeviceId)?.label || 'Default camera'
    );

    let formatted = $derived(
        `${Math.floor(elapsed / 60)
            .toString()
            .padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`
    );

    onMount(async () => {
        document.title = '● REC 00:00 | YourDemo';
        timerInterval = setInterval(() => {
            elapsed += 1;
            const mm = Math.floor(elapsed / 60)
                .toString()
                .padStart(2, '0');
            const ss = (elapsed % 60).toString().padStart(2, '0');
            document.title = `● REC ${mm}:${ss} | YourDemo`;
        }, 1000);
        const devices = await navigator.mediaDevices
            .enumerateDevices()
            .catch(() => [] as MediaDeviceInfo[]);
        micDevices = devices.filter((d) => d.kind === 'audioinput');
        camDevices = devices.filter((d) => d.kind === 'videoinput');

        const track = screenStream?.getVideoTracks()[0];
        const handleTrackEnded = () => onstreamended();
        if (track) track.addEventListener('ended', handleTrackEnded);

        return () => {
            if (track) track.removeEventListener('ended', handleTrackEnded);
        };
    });

    onDestroy(() => {
        clearInterval(timerInterval);
        document.title = 'YourDemo';
    });
</script>

<div class="flex h-full flex-col">
    <div class="relative flex flex-1 items-center justify-center overflow-hidden bg-black/20">
        <Empty.Root>
            <Empty.Media>
                <RadioTower size={128} class="text-muted-foreground" />
            </Empty.Media>
            <Empty.Header>
                <Empty.Title>Recording in progress</Empty.Title>
            </Empty.Header>
        </Empty.Root>

        <div
            class="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-sm text-white backdrop-blur-sm"
        >
            <span class="rec-dot h-2 w-2 rounded-full bg-red-500"></span>
            <span class="font-semibold tracking-wide">REC</span>
            <span class="font-mono">{formatted}</span>
        </div>
    </div>

    <div class="flex items-center gap-2 border-t px-4 py-3">
        <Tooltip.Root>
            <Tooltip.Trigger>
                {#snippet child({ props })}
                    <div {...props} class="flex">
                        <Button
                            variant={micMuted ? 'destructive' : 'outline'}
                            size="sm"
                            class="rounded-r-none border-r-0"
                            onclick={ontogglemic}
                            aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                        >
                            {#if micMuted}
                                <MicOff class="size-4" />
                            {:else}
                                <Mic class="size-4" />
                            {/if}
                        </Button>
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger
                                class={cn(
                                    buttonVariants({ variant: 'outline', size: 'sm' }),
                                    'rounded-l-none px-2'
                                )}
                                aria-label="Select microphone"
                            >
                                <ChevronDown class="size-3" />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content>
                                <DropdownMenu.RadioGroup
                                    value={deviceStore.micDeviceId ?? undefined}
                                    onValueChange={(v) => (deviceStore.micDeviceId = v)}
                                >
                                    {#each micDevices as d (d.deviceId)}
                                        <DropdownMenu.RadioItem value={d.deviceId}>
                                            {d.label || 'Microphone'}
                                        </DropdownMenu.RadioItem>
                                    {/each}
                                </DropdownMenu.RadioGroup>
                                {#if micDevices.length === 0}
                                    <DropdownMenu.Item>No microphones found</DropdownMenu.Item>
                                {/if}
                            </DropdownMenu.Content>
                        </DropdownMenu.Root>
                    </div>
                {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
                <p>{micLabel}</p>
            </Tooltip.Content>
        </Tooltip.Root>

        <Tooltip.Root>
            <Tooltip.Trigger>
                {#snippet child({ props })}
                    <div {...props} class="flex">
                        <Button
                            variant={!camEnabled ? 'destructive' : 'outline'}
                            size="sm"
                            class="rounded-r-none border-r-0"
                            onclick={ontogglecam}
                            aria-label={camEnabled ? 'Disable camera' : 'Enable camera'}
                        >
                            {#if !camEnabled}
                                <VideoOff class="size-4" />
                            {:else}
                                <Video class="size-4" />
                            {/if}
                        </Button>
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger
                                class={cn(
                                    buttonVariants({ variant: 'outline', size: 'sm' }),
                                    'rounded-l-none px-2'
                                )}
                                aria-label="Select camera"
                            >
                                <ChevronDown class="size-3" />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content>
                                <DropdownMenu.RadioGroup
                                    value={deviceStore.webcamDeviceId ?? undefined}
                                    onValueChange={(v) => (deviceStore.webcamDeviceId = v)}
                                >
                                    {#each camDevices as d (d.deviceId)}
                                        <DropdownMenu.RadioItem value={d.deviceId}>
                                            {d.label || 'Camera'}
                                        </DropdownMenu.RadioItem>
                                    {/each}
                                </DropdownMenu.RadioGroup>
                                {#if camDevices.length === 0}
                                    <DropdownMenu.Item>No cameras found</DropdownMenu.Item>
                                {/if}
                            </DropdownMenu.Content>
                        </DropdownMenu.Root>
                    </div>
                {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
                <p>{camLabel}</p>
            </Tooltip.Content>
        </Tooltip.Root>

        <div class="flex-1"></div>

        <Button
            variant="destructive"
            onclick={() => {
                clearInterval(timerInterval);
                document.title = 'YourDemo';
                onstop();
            }}
        >
            <Square class="mr-1 size-4 fill-current" />
            Stop
        </Button>
    </div>
</div>

<style>
    .rec-dot {
        animation: rec-pulse 1.5s ease-in-out infinite;
    }

    @keyframes rec-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
    }
</style>
