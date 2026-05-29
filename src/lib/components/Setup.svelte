<script lang="ts">
    import { ChevronDown, Mic, MicOff, Monitor, Video, VideoOff } from 'lucide-svelte';
    import { onMount, untrack } from 'svelte';

    import { buttonVariants } from '$lib/components/ui/button/button.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import * as Empty from '$lib/components/ui/empty/index.js';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';
    import WebcamBubble from '$lib/components/WebcamBubble.svelte';
    import type { BubblePosition } from '$lib/components/WebcamBubble.svelte';

    import { deviceStore } from '$lib/deviceStore.svelte.js';
    import { cn } from '$lib/utils.js';

    interface Props {
        onstart: () => void;
        screenStream?: MediaStream | null;
        micMuted?: boolean;
        camEnabled?: boolean;
        bubblePosition?: BubblePosition;
        ontogglemic?: () => void;
        ontogglecam?: () => void;
    }

    let {
        onstart,
        screenStream = $bindable(null),
        micMuted = false,
        camEnabled = true,
        bubblePosition = $bindable<BubblePosition>('tr'),
        ontogglemic = () => {},
        ontogglecam = () => {}
    }: Props = $props();

    let pickError = $state('');
    let picking = $state(false);
    let micDevices = $state<MediaDeviceInfo[]>([]);
    let camDevices = $state<MediaDeviceInfo[]>([]);
    let webcamStream = $state<MediaStream | null>(null);

    let micLabel = $derived(
        micDevices.find((d) => d.deviceId === deviceStore.micDeviceId)?.label ||
            'Default microphone'
    );
    let camLabel = $derived(
        camDevices.find((d) => d.deviceId === deviceStore.webcamDeviceId)?.label || 'Default camera'
    );

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
            // Chrome shifts focus to the picked tab immediately, stranding the user away
            // from the Start Recording button. Auto-start solves this for tab capture only.
            const track = stream.getVideoTracks()[0];
            if (track?.getSettings().displaySurface === 'browser') {
                onstart();
            }
        } catch (err) {
            if (err instanceof Error && err.name !== 'NotAllowedError') {
                pickError = 'Could not capture screen. Please try again.';
            }
        } finally {
            picking = false;
        }
    }

    onMount(async () => {
        const devices = await navigator.mediaDevices
            .enumerateDevices()
            .catch(() => [] as MediaDeviceInfo[]);
        micDevices = devices.filter((d) => d.kind === 'audioinput');
        camDevices = devices.filter((d) => d.kind === 'videoinput');
        if (!deviceStore.micDeviceId && micDevices.length)
            deviceStore.micDeviceId = micDevices[0].deviceId;
        if (!deviceStore.webcamDeviceId && camDevices.length)
            deviceStore.webcamDeviceId = camDevices[0].deviceId;
        return () => {
            webcamStream?.getTracks().forEach((t) => t.stop());
        };
    });

    // Handle "Stop sharing" from browser share bar during Setup
    $effect(() => {
        const stream = screenStream;
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        if (!track) return;
        const handleEnded = () => {
            stream.getTracks().forEach((t) => t.stop());
            screenStream = null;
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
                class="h-full w-full object-contain"
            ></video>
        {:else}
            <Empty.Root>
                <Empty.Media>
                    <Monitor size={128} class="text-muted-foreground" />
                </Empty.Media>
                <Empty.Header>
                    <Empty.Title>No screen selected</Empty.Title>
                    <Empty.Description
                        >Choose a screen to preview, then hit Record</Empty.Description
                    >
                </Empty.Header>
                <Empty.Content>
                    <Button
                        class="bg-indigo-500 text-white hover:bg-indigo-600"
                        onclick={pickScreen}
                        disabled={picking}
                    >
                        {picking ? 'Requesting…' : 'Choose Screen'}
                    </Button>
                    {#if pickError}
                        <p class="text-sm text-destructive">{pickError}</p>
                    {/if}
                </Empty.Content>
            </Empty.Root>
        {/if}

        {#if camEnabled}
            <WebcamBubble bind:position={bubblePosition} stream={webcamStream} />
        {/if}
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
                                    buttonVariants({
                                        variant: micMuted ? 'destructive' : 'outline',
                                        size: 'sm'
                                    }),
                                    'rounded-l-none px-2'
                                )}
                                aria-label="Select microphone"
                            >
                                <ChevronDown class="size-3" />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content class="w-sm">
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
                                    buttonVariants({
                                        variant: !camEnabled ? 'destructive' : 'outline',
                                        size: 'sm'
                                    }),
                                    'rounded-l-none px-2'
                                )}
                                aria-label="Select camera"
                            >
                                <ChevronDown class="size-3" />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content class="w-sm">
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

        {#if screenStream}
            <Button
                variant="ghost"
                size="sm"
                class="text-indigo-500 hover:text-indigo-600"
                onclick={pickScreen}
                disabled={picking}>Re-pick</Button
            >
        {/if}

        <Button
            class="bg-indigo-500 text-white hover:bg-indigo-600"
            onclick={onstart}
            disabled={!screenStream}>Start Recording</Button
        >
    </div>
</div>
