<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import Processing from '$lib/components/Processing.svelte';

    const { Story } = defineMeta({
        title: 'Components/Processing',
        component: Processing,
        tags: ['autodocs'],
        // Default template shared by every Story below (snippet defined in the markup).
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        args: {
            // Empty by default so onMount does no real stitching/re-render work and
            // just settles on the finished state without touching MediaRecorder.
            segments: [],
            deletedRanges: [],
            oncomplete: fn()
        }
    });
</script>

{#snippet template(args: ComponentProps<typeof Processing>)}
    <div class="h-256 bg-background text-foreground">
        <Processing {...args} />
    </div>
{/snippet}

<Story name="Default" />
