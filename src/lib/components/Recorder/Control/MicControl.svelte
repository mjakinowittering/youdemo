<script lang="ts">
    import { Mic01Icon, MicOff01Icon } from '@hugeicons/core-free-icons';
    import { onMount } from 'svelte';

    import MenuOptions from '$lib/components/MenuOptions.svelte';

    import { deviceStore } from '$lib/deviceStore.svelte.js';

    import DockControl from './DockControl.svelte';

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

<DockControl
    icon={micMuted ? MicOff01Icon : Mic01Icon}
    label={micMuted ? 'Muted' : 'Mic'}
    tone={micMuted ? 'off' : 'plain'}
    action={micMuted ? 'Unmute microphone' : 'Mute microphone'}
    menuLabel="Select microphone"
    tooltip={micLabel}
    {disabled}
    ontoggle={() => (micMuted = !micMuted)}
>
    {#snippet menu()}
        <MenuOptions
            options={micDevices.map((d) => ({
                value: d.deviceId,
                label: d.label || 'Microphone'
            }))}
            value={deviceStore.micDeviceId ?? undefined}
            onselect={(id) => (deviceStore.micDeviceId = id)}
            empty="No microphones found"
        />
    {/snippet}
</DockControl>
