<script lang="ts">
    import { ArrowDown01Icon, Mic01Icon, MicOff01Icon } from '@hugeicons/core-free-icons';
    import { onMount } from 'svelte';

    import Icon from '$lib/components/Icon.svelte';
    import { buttonVariants } from '$lib/components/ui/button/button.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    import { deviceStore } from '$lib/deviceStore.svelte.js';
    import { cn } from '$lib/utils.js';

    interface Props {
        micMuted?: boolean;
        disabled?: boolean;
    }

    let { micMuted = $bindable(false), disabled = false }: Props = $props();

    let micDevices = $state<MediaDeviceInfo[]>([]);

    let micLabel = $derived(
        micDevices.find((d) => d.deviceId === deviceStore.micDeviceId)?.label ||
            'Default microphone'
    );

    onMount(async () => {
        const devices = await navigator.mediaDevices
            .enumerateDevices()
            .catch(() => [] as MediaDeviceInfo[]);
        micDevices = devices.filter((d) => d.kind === 'audioinput');
        if (!deviceStore.micDeviceId && micDevices.length)
            deviceStore.micDeviceId = micDevices[0].deviceId;
    });
</script>

<Tooltip.Root>
    <Tooltip.Trigger>
        {#snippet child({ props })}
            <div {...props} class="flex">
                <Button
                    variant={micMuted ? 'danger-ghost' : 'outline'}
                    size="lg"
                    class="rounded-r-none border-r-0"
                    {disabled}
                    onclick={() => (micMuted = !micMuted)}
                    aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                    {#if micMuted}
                        <Icon icon={MicOff01Icon} class="size-4" />
                    {:else}
                        <Icon icon={Mic01Icon} class="size-4" />
                    {/if}
                </Button>
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger
                        class={cn(
                            buttonVariants({
                                variant: micMuted ? 'danger-ghost' : 'outline',
                                size: 'lg'
                            }),
                            'rounded-l-none px-2'
                        )}
                        {disabled}
                        aria-label="Select microphone"
                    >
                        <Icon icon={ArrowDown01Icon} class="size-3" />
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
