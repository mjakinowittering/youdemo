<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import Recording from '$lib/components/Recording.svelte';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    const { Story } = defineMeta({
        title: 'Components/Recording',
        component: Recording,
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
            }
        },
        args: {
            onstop: fn(),
            onstreamended: fn(),
            screenStream: null,
            micMuted: false,
            camEnabled: true,
            blurOn: false,
            blurIntensity: 'default'
        }
    });
</script>

<!--
    Recording is `h-full`, so frame it in a full-height, dark-themed shell to
    mirror how the app shell hosts it. Wired in as the default `render` above.
-->
{#snippet template(args: ComponentProps<typeof Recording>)}
    <Tooltip.Provider>
        <div class="h-256 bg-background text-foreground">
            <Recording {...args} />
        </div>
    </Tooltip.Provider>
{/snippet}

<Story name="Default" />

<Story name="Mic muted" args={{ micMuted: true }} />

<Story name="Camera off" args={{ camEnabled: false }} />

<Story name="Blur on" args={{ blurOn: true, blurIntensity: 'heavy' }} />
