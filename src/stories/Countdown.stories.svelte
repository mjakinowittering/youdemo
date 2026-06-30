<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import Countdown from '$lib/components/Countdown.svelte';

    const { Story } = defineMeta({
        title: 'Components/Countdown',
        component: Countdown,
        tags: ['autodocs'],
        // Default template shared by every Story below (snippet defined in the markup).
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        args: {
            oncomplete: fn()
        }
    });
</script>

<!--
    Countdown is an `absolute inset-0` overlay, so it needs a `relative`, sized
    ancestor to anchor against — mirroring the preview area it overlays in-app.
-->
{#snippet template(args: ComponentProps<typeof Countdown>)}
    <div class="dark relative h-screen bg-background text-foreground">
        <Countdown {...args} />
    </div>
{/snippet}

<Story name="Default" />
