<script lang="ts">
    import { InformationCircleIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon.svelte';

    import type { BlurIntensity } from '$lib/blurProcessor.js';

    import CaptureDock from './CaptureDock.svelte';

    interface Props {
        micMuted?: boolean;
        camEnabled?: boolean;
        blurOn?: boolean;
        blurIntensity?: BlurIntensity;
        /** Countdown and Recording: the dock dashed, with a note why. */
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

<!-- The band under the stage on every capture screen -->
<div
    data-section="dock"
    class="flex shrink-0 flex-col items-center justify-center gap-1.5 border-t-[1.5px] border-solid border-yd-ink bg-yd-base px-6 pt-3.5 pb-3"
>
    <CaptureDock bind:micMuted bind:camEnabled bind:blurOn bind:blurIntensity {locked} />
    {#if locked}
        <p class="flex items-center gap-1.5 text-small text-yd-muted">
            <Icon icon={InformationCircleIcon} size={18} />
            Mic, camera and blur can change between takes
        </p>
    {/if}
</div>
