<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import EditorToolbar from '$lib/components/Editor/EditorToolbar.svelte';

    const { Story } = defineMeta({
        title: 'Components/Editor/EditorToolbar',
        component: EditorToolbar,
        tags: ['autodocs'],
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        argTypes: {
            editMode: { control: 'boolean' },
            canDelete: { control: 'boolean' }
        },
        args: {
            editMode: false,
            canDelete: false,
            effectiveDuration: 48,
            ontogglecut: fn(),
            ondelete: fn()
        }
    });
</script>

{#snippet template(args: ComponentProps<typeof EditorToolbar>)}
    <div class="bg-background text-foreground">
        <EditorToolbar {...args} />
    </div>
{/snippet}

<Story name="Default" />

<Story name="Edit mode" args={{ editMode: true }} />

<Story name="Selection ready" args={{ editMode: true, canDelete: true }} />
