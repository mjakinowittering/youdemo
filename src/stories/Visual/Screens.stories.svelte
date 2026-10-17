<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import BrowserCheck from '$lib/components/BrowserCheck.svelte';
    import Countdown from '$lib/components/Recorder/Countdown.svelte';
    import Recording from '$lib/components/Recorder/Recording.svelte';
    import Review from '$lib/components/Recorder/Review.svelte';
    import Setup from '$lib/components/Recorder/Setup.svelte';

    import ScreenFrame from './ScreenFrame.svelte';

    // Each story renders a screen board in docs/design/reference/screens from
    // props and fixtures alone, for `npm run compare`: the boards' content (two
    // takes of 00:42 and 00:36, "Quarterly planning" shared, REC 01:12).
    const { Story } = defineMeta({
        title: 'Visual/Screens',
        parameters: { layout: 'fullscreen' }
    });

    const noop = () => {};
    const url = 'https://mjakinowittering.github.io/youdemo/';
    const takes = [42, 36];
</script>

<Story name="Phone not supported">
    {#snippet template()}
        <ScreenFrame width={390} height={844}>
            <BrowserCheck onpass={noop} hasScreenCapture={false} {url} shareable />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Limited support">
    {#snippet template()}
        <ScreenFrame>
            <BrowserCheck
                onpass={noop}
                hasScreenCapture
                hasMediaRecorder
                hasCameraAccess={false}
                hasAudioMixing={false}
            />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Setup first visit">
    {#snippet template()}
        <ScreenFrame>
            <Setup onchoose={noop} firstVisit blurOn />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Setup returning">
    {#snippet template()}
        <ScreenFrame>
            <Setup onchoose={noop} blurOn />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Countdown">
    {#snippet template()}
        <ScreenFrame>
            <Countdown count={3} oncancel={noop} blurOn />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Recording">
    {#snippet template()}
        <ScreenFrame>
            <Recording elapsed={72} take={2} onstop={noop} blurOn />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Review">
    {#snippet template()}
        <ScreenFrame>
            <Review
                {takes}
                shareLabel="Quarterly planning"
                micMuted
                blurOn
                onrecord={noop}
                onchangeshare={noop}
                onedit={noop}
                ondiscard={noop}
            />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Review discard dialog">
    {#snippet template()}
        <ScreenFrame>
            <Review
                {takes}
                shareLabel="Quarterly planning"
                micMuted
                blurOn
                discardOpen
                onrecord={noop}
                onchangeshare={noop}
                onedit={noop}
                ondiscard={noop}
            />
        </ScreenFrame>
    {/snippet}
</Story>
