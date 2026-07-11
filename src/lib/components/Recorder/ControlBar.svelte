<script lang="ts">
    import type { BlurIntensity } from '$lib/blurProcessor.js';

    import BlurControl from './Control/BlurControl.svelte';
    import CamControl from './Control/CamControl.svelte';
    import MicControl from './Control/MicControl.svelte';

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
