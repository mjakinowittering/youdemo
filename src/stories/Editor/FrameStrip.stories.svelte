<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import FrameStrip from '$lib/components/Editor/FrameStrip.svelte';

    // 50 contiguous cells (thumbnails omitted → pulse placeholders render).
    const visibleCells = Array.from({ length: 50 }, (_, i) => i);

    const { Story } = defineMeta({
        title: 'Components/Editor/FrameStrip',
        component: FrameStrip,
        tags: ['autodocs'],
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        args: {
            visibleCells,
            thumbnails: new Map<number, string>(),
            currentCell: 2,
            selectedCells: new Set<number>(),
            collapsingCells: new Set<number>(),
            paused: true,
            oncellclick: fn()
        }
    });
</script>

{#snippet template(args: ComponentProps<typeof FrameStrip>)}
    <div class="bg-background text-foreground">
        <FrameStrip {...args} />
    </div>
{/snippet}

<Story name="Default" />

<Story name="Selection" args={{ selectedCells: new Set([5, 6, 7, 8]) }} />

<Story name="Empty" args={{ visibleCells: [], currentCell: 0 }} />
