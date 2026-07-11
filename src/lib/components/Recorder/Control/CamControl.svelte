<script lang="ts">
    import { ChevronDown, Video, VideoOff } from 'lucide-svelte';
    import { onMount } from 'svelte';

    import { buttonVariants } from '$lib/components/ui/button/button.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    import { deviceStore } from '$lib/deviceStore.svelte.js';
    import { cn } from '$lib/utils.js';

    interface Props {
        camEnabled?: boolean;
        disabled?: boolean;
    }

    let { camEnabled = $bindable(true), disabled = false }: Props = $props();

    let camDevices = $state<MediaDeviceInfo[]>([]);

    let camLabel = $derived(
        camDevices.find((d) => d.deviceId === deviceStore.webcamDeviceId)?.label || 'Default camera'
    );

    onMount(async () => {
        const devices = await navigator.mediaDevices
            .enumerateDevices()
            .catch(() => [] as MediaDeviceInfo[]);
        camDevices = devices.filter((d) => d.kind === 'videoinput');
        if (!deviceStore.webcamDeviceId && camDevices.length)
            deviceStore.webcamDeviceId = camDevices[0].deviceId;
    });
</script>

<Tooltip.Root>
    <Tooltip.Trigger>
        {#snippet child({ props })}
            <div {...props} class="flex">
                <Button
                    variant={!camEnabled ? 'destructive' : 'outline'}
                    size="lg"
                    class="rounded-r-none border-r-0"
                    {disabled}
                    onclick={() => (camEnabled = !camEnabled)}
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
                                size: 'lg'
                            }),
                            'rounded-l-none px-2'
                        )}
                        {disabled}
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
