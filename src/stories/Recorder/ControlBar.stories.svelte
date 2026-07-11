<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import type { ComponentProps } from 'svelte';

    import ControlBar from '$lib/components/Recorder/ControlBar.svelte';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    const { Story } = defineMeta({
        title: 'Components/Recorder/ControlBar',
        component: ControlBar,
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
            disabled: { control: 'boolean' }
        },
        args: {
            micMuted: false,
            camEnabled: true,
            blurOn: false,
            blurIntensity: 'default',
            disabled: false
        }
    });
</script>

<!--
    ControlBar is the shared footer (Mic | Cam | Blur). Its controls use shadcn
    Tooltip, so a Tooltip.Provider ancestor is required. Framed in a full-height,
    dark-themed shell with the bar pinned to the bottom, mirroring how the capture
    screens host it. Wired in as the default `render` above.
-->
{#snippet template(args: ComponentProps<typeof ControlBar>)}
    <Tooltip.Provider>
        <div class="flex h-64 flex-col justify-end bg-background text-foreground">
            <ControlBar {...args} />
        </div>
    </Tooltip.Provider>
{/snippet}

<Story name="Default" />

<Story name="Mic muted" args={{ micMuted: true }} />

<Story name="Camera off" args={{ camEnabled: false }} />

<Story name="Blur on" args={{ blurOn: true, blurIntensity: 'heavy' }} />

<Story name="Disabled" args={{ disabled: true }} />
