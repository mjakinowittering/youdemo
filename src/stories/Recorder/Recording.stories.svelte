<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import Recording from '$lib/components/Recorder/Recording.svelte';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    const { Story } = defineMeta({
        title: 'Components/Recorder/Recording',
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
            previewStream: null,
            micMuted: false,
            camEnabled: true,
            blurOn: false,
            blurIntensity: 'default'
        }
    });

    // Stands in for the recorder's composited canvas track: one static 16:9 frame.
    function fakePreview(): MediaStream {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d', { alpha: false })!;
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(1100, 140, 90, 0, Math.PI * 2);
        ctx.fill();
        return canvas.captureStream();
    }
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

<Story name="Live preview" args={{ previewStream: fakePreview() }} />

<Story name="Mic muted" args={{ micMuted: true }} />

<Story name="Camera off" args={{ camEnabled: false }} />

<Story name="Blur on" args={{ blurOn: true, blurIntensity: 'heavy' }} />
