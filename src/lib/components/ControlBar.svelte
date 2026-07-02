<script lang="ts">
    import BlurControl from '$lib/components/Control/BlurControl.svelte';
    import CamControl from '$lib/components/Control/CamControl.svelte';
    import MicControl from '$lib/components/Control/MicControl.svelte';

    import type { BlurIntensity } from '$lib/blurProcessor.js';

    interface Props {
        micMuted?: boolean;
        camEnabled?: boolean;
        blurOn?: boolean;
        blurIntensity?: BlurIntensity;
        disabled?: boolean;
    }

    let {
        micMuted = $bindable(false),
        camEnabled = $bindable(true),
        blurOn = $bindable(false),
        blurIntensity = $bindable<BlurIntensity>('default'),
        disabled = false
    }: Props = $props();
</script>

<div class="flex items-center justify-center gap-2 border-t px-4 py-3">
    <MicControl bind:micMuted {disabled} />
    <CamControl bind:camEnabled {disabled} />
    <BlurControl bind:blurOn bind:intensity={blurIntensity} {camEnabled} {disabled} />
</div>
