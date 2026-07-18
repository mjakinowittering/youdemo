<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import Editor from '$lib/components/Editor/Editor.svelte';

    const { Story } = defineMeta({
        title: 'Components/Editor/Editor',
        component: Editor,
        tags: ['autodocs'],
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        args: {
            // No blob URL in a static story — shows the composed shell (player
            // empty state + scrubber + toolbar + footer). The frame strip appears
            // once a real recording provides a duration; that path is covered by
            // the end-to-end app flow and the sub-component stories.
            videoUrl: null,
            onback: fn(),
            onexport: fn(),
            ondiscard: fn()
        }
    });
</script>

{#snippet template(args: ComponentProps<typeof Editor>)}
    <div class="h-256 bg-background text-foreground">
        <Editor {...args} />
    </div>
{/snippet}

<Story name="No video" />
