<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import Review from '$lib/components/Review.svelte';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    const { Story } = defineMeta({
        title: 'Components/Review',
        component: Review,
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
            onresume: fn(),
            onedit: fn(),
            ondiscard: fn(),
            micMuted: false,
            camEnabled: true,
            blurOn: false,
            blurIntensity: 'default'
        }
    });
</script>

{#snippet template(args: ComponentProps<typeof Review>)}
    <Tooltip.Provider>
        <div class="dark h-screen bg-background text-foreground">
            <Review {...args} />
        </div>
    </Tooltip.Provider>
{/snippet}

<Story name="Default" />

<Story name="Mic muted" args={{ micMuted: true }} />

<Story name="Camera off" args={{ camEnabled: false }} />

<Story name="Blur on" args={{ blurOn: true, blurIntensity: 'heavy' }} />
