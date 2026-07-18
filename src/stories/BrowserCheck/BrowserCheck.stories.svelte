<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import BrowserCheck from '$lib/components/BrowserCheck.svelte';

    const { Story } = defineMeta({
        title: 'Components/BrowserCheck',
        component: BrowserCheck,
        tags: ['autodocs'],
        // Default template shared by every Story below (snippet defined in the markup).
        render: template,
        parameters: {
            layout: 'fullscreen'
        },
        args: {
            onpass: fn()
        }
    });
</script>

<!--
    BrowserCheck derives its checks from live browser APIs (getDisplayMedia,
    MediaRecorder, getUserMedia, AudioContext) rather than props, so its rendered
    state depends on the browser running Storybook: a fully-capable browser passes
    all checks, calls `onpass()` on mount, and renders nothing. The single story
    below simply mounts the component in the standard screen shell.
-->
{#snippet template(args: ComponentProps<typeof BrowserCheck>)}
    <div class="h-256 bg-background text-foreground">
        <BrowserCheck {...args} />
    </div>
{/snippet}

<Story name="Default" />
