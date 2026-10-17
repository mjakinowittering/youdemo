<script lang="ts">
    import { BlurIcon, UserIcon } from '@hugeicons/core-free-icons';

    import MenuOptions from '$lib/components/MenuOptions.svelte';

    import type { BlurIntensity } from '$lib/blurProcessor.js';

    import DockControl from './DockControl.svelte';

    interface Props {
        blurOn?: boolean;
        intensity?: BlurIntensity;
        disabled?: boolean;
    }

    let {
        blurOn = $bindable(false),
        intensity = $bindable<BlurIntensity>('default'),
        disabled = false
    }: Props = $props();

    const intensities: { value: BlurIntensity; label: string }[] = [
        { value: 'light', label: 'Light' },
        { value: 'default', label: 'Default' },
        { value: 'heavy', label: 'Heavy' }
    ];

    let tooltip = $derived(
        !blurOn
            ? 'Background blur off'
            : intensity === 'default'
              ? 'Background blur'
              : `Background blur — ${intensities.find((i) => i.value === intensity)?.label}`
    );
</script>

<DockControl
    icon={blurOn ? BlurIcon : UserIcon}
    label={blurOn ? 'Blur on' : 'Blur off'}
    tone={blurOn ? 'on' : 'plain'}
    action={blurOn ? 'Disable background blur' : 'Enable background blur'}
    menuLabel="Select blur intensity"
    {tooltip}
    {disabled}
    ontoggle={() => (blurOn = !blurOn)}
>
    {#snippet menu()}
        <MenuOptions
            options={intensities}
            value={intensity}
            onselect={(value) => (intensity = value)}
        />
    {/snippet}
</DockControl>
