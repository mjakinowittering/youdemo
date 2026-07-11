<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import Scrubber from '$lib/components/Editor/Scrubber.svelte';

    const { Story } = defineMeta({
        title: 'Components/Editor/Scrubber',
        component: Scrubber,
        tags: ['autodocs'],
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        argTypes: {
            paused: { control: 'boolean' }
        },
        args: {
            paused: true,
            effectiveCurrentTime: 12,
            effectiveDuration: 60,
            ontoggleplay: fn(),
            onseek: fn()
        }
    });
</script>

{#snippet template(args: ComponentProps<typeof Scrubber>)}
    <div class="h-screen bg-background text-foreground">
        <Scrubber {...args} />
    </div>
{/snippet}

<Story name="Paused" />

<Story name="Playing" args={{ paused: false, effectiveCurrentTime: 30 }} />

<Story name="Empty" args={{ effectiveCurrentTime: 0, effectiveDuration: 0 }} />
