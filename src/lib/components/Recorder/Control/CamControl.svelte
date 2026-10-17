<script lang="ts">
    import { Video01Icon, VideoOffIcon } from '@hugeicons/core-free-icons';
    import { onMount } from 'svelte';

    import MenuOptions from '$lib/components/MenuOptions.svelte';

    import { deviceStore } from '$lib/deviceStore.svelte.js';

    import DockControl from './DockControl.svelte';

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

<DockControl
    icon={camEnabled ? Video01Icon : VideoOffIcon}
    label={camEnabled ? 'Camera' : 'Camera off'}
    tone={camEnabled ? 'plain' : 'off'}
    action={camEnabled ? 'Disable camera' : 'Enable camera'}
    menuLabel="Select camera"
    tooltip={camLabel}
    {disabled}
    ontoggle={() => (camEnabled = !camEnabled)}
>
    {#snippet menu()}
        <MenuOptions
            options={camDevices.map((d) => ({ value: d.deviceId, label: d.label || 'Camera' }))}
            value={deviceStore.webcamDeviceId ?? undefined}
            onselect={(id) => (deviceStore.webcamDeviceId = id)}
            empty="No cameras found"
        />
    {/snippet}
</DockControl>
