<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import Done from '$lib/components/Editor/Done.svelte';

    const { Story } = defineMeta({
        title: 'Components/Editor/Done',
        component: Done,
        tags: ['autodocs'],
        // Default template shared by every Story below (snippet defined in the markup).
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        args: {
            // Left null so the auto-download in onMount doesn't fire on every load.
            videoBlob: null,
            onbacktoeditor: fn(),
            onnewrecording: fn()
        }
    });
</script>

{#snippet template(args: ComponentProps<typeof Done>)}
    <div class="h-256 bg-background text-foreground">
        <Done {...args} />
    </div>
{/snippet}

<Story name="Default" />
