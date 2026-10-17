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
        /** While a take counts down or records: every control dashed. */
        locked?: boolean;
    }

    let {
        micMuted = $bindable(false),
        camEnabled = $bindable(true),
        blurOn = $bindable(false),
        blurIntensity = $bindable<BlurIntensity>('default'),
        locked = false
    }: Props = $props();
</script>

<!-- Mic, camera and blur, each a toggle with a device (or intensity) menu -->
<div
    class="inline-flex items-start gap-3.5 rounded-panel border-[1.5px] border-solid border-yd-ink bg-yd-card px-3.5 pt-3 pb-2"
>
    <MicControl bind:micMuted disabled={locked} />
    <CamControl bind:camEnabled disabled={locked} />
    <BlurControl bind:blurOn bind:intensity={blurIntensity} disabled={locked} />
</div>
