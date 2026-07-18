<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { fn } from 'storybook/test';
    import type { ComponentProps } from 'svelte';

    import BrowserCheck from '$lib/components/BrowserCheck.svelte';

    const { Story } = defineMeta({
        title: 'Components/BrowserCheck/BrowserCheck',
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
    In production BrowserCheck derives its checks from live browser APIs
    (getDisplayMedia, MediaRecorder, getUserMedia, AudioContext), so on a
    fully-capable desktop browser it passes every check, calls `onpass()` on
    mount and renders nothing — leaving nothing to test in Storybook.

    Each capability is therefore an optional prop that defaults to the live
    detection. The stories below override those props to drive every rendered
    state deterministically, independent of the host browser.
-->
{#snippet template(args: ComponentProps<typeof BrowserCheck>)}
    <div class="h-256 bg-background text-foreground">
        <BrowserCheck {...args} />
    </div>
{/snippet}

<!-- All capabilities present: passes, fires onpass, renders nothing (guarded by `{#if !allPass}`). -->
<Story
    name="Supported"
    args={{
        hasScreenCapture: true,
        hasMediaRecorder: true,
        hasCameraAccess: true,
        hasAudioMixing: true
    }}
/>

<!-- Critical APIs present but optional ones missing: amber "Limited support" + Continue anyway. -->
<Story
    name="Limited support"
    args={{
        hasScreenCapture: true,
        hasMediaRecorder: true,
        hasCameraAccess: false,
        hasAudioMixing: false
    }}
/>

<!-- A critical API missing: red "Browser not supported", no way forward. -->
<Story
    name="Not supported"
    args={{
        hasScreenCapture: false,
        hasMediaRecorder: false,
        hasCameraAccess: false,
        hasAudioMixing: false
    }}
/>

<!-- Only screen capture missing: still blocks (critical), with a mix of check states. -->
<Story
    name="Screen capture missing"
    args={{
        hasScreenCapture: false,
        hasMediaRecorder: true,
        hasCameraAccess: true,
        hasAudioMixing: true
    }}
/>
