<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import EditorFooter from '$lib/components/Editor/EditorFooter.svelte';

    const { Story } = defineMeta({
        title: 'Components/Editor/EditorFooter',
        component: EditorFooter,
        tags: ['autodocs'],
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        args: {
            onback: fn(),
            ondiscard: fn(),
            onexport: fn()
        }
    });
</script>

{#snippet template(args: ComponentProps<typeof EditorFooter>)}
    <div class="h-screen bg-background text-foreground">
        <EditorFooter {...args} />
    </div>
{/snippet}

<Story name="Default" />
