<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import Setup from '$lib/components/Setup.svelte';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    const { Story } = defineMeta({
        title: 'Components/Setup',
        component: Setup,
        tags: ['autodocs'],
        // Default template shared by every Story below (snippet defined in the markup).
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        argTypes: {
            micMuted: { control: 'boolean' },
            camEnabled: { control: 'boolean' },
            blurOn: { control: 'boolean' },
            blurIntensity: {
                control: { type: 'select' },
                options: ['light', 'default', 'heavy']
            },
            bubblePosition: {
                control: { type: 'select' },
                options: ['tl', 'tr', 'bl', 'br', 'tc', 'rc', 'bc', 'lc']
            }
        },
        args: {
            onstart: fn(),
            screenStream: null,
            webcamStream: null,
            processedStream: null,
            micMuted: false,
            camEnabled: true,
            blurOn: false,
            blurIntensity: 'default',
            bubblePosition: 'tr'
        }
    });
</script>

{#snippet template(args: ComponentProps<typeof Setup>)}
    <Tooltip.Provider>
        <div class="dark h-screen bg-background text-foreground">
            <Setup {...args} />
        </div>
    </Tooltip.Provider>
{/snippet}

<Story name="Default" />

<Story name="Mic muted" args={{ micMuted: true }} />

<Story name="Camera off" args={{ camEnabled: false }} />

<Story name="Blur on" args={{ blurOn: true, blurIntensity: 'heavy' }} />
