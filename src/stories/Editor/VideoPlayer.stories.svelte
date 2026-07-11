<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import type { ComponentProps } from 'svelte';

    import VideoPlayer from '$lib/components/Editor/VideoPlayer.svelte';

    const { Story } = defineMeta({
        title: 'Components/Editor/VideoPlayer',
        component: VideoPlayer,
        tags: ['autodocs'],
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        args: {
            // No blob URL available in a static story — exercise the empty state.
            // Wiring (bind:paused / bind:currentTime / bind:duration and the
            // deleted-range skip) is verified end-to-end in the app.
            videoUrl: null,
            deletedRanges: []
        }
    });
</script>

{#snippet template(args: ComponentProps<typeof VideoPlayer>)}
    <div class="h-screen bg-background text-foreground">
        <VideoPlayer {...args} />
    </div>
{/snippet}

<Story name="No video" />
