<script module lang="ts">
    import { defineMeta } from '@storybook/addon-svelte-csf';

    import BrowserCheck from '$lib/components/BrowserCheck.svelte';
    import EditorView from '$lib/components/Editor/EditorView.svelte';
    import ErrorScreen from '$lib/components/ErrorScreen.svelte';
    import Countdown from '$lib/components/Recorder/Countdown.svelte';
    import Recording from '$lib/components/Recorder/Recording.svelte';
    import Review from '$lib/components/Recorder/Review.svelte';
    import Setup from '$lib/components/Recorder/Setup.svelte';

    import { fixtureStrip } from './fixtures.js';
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
    const file = 'youdemo-2026-10-09-201512.webm';
    const cameraError =
        'NotReadableError: Could not start video source\n    at armCamera (+page.svelte:205:41)';

    // The Editor as drawn: playhead 00:16 of 01:18, one earlier cut of 1.4 s.
    // Display values as on the boards, even where they don't add up (journey.md,
    // Decisions 4).
    const editor = {
        phase: 'ready' as const,
        paused: true,
        time: '00:16 / 01:18',
        percent: 21,
        trimming: false,
        canUndo: true,
        canRedo: true,
        zoomLabel: '0.2 s a frame',
        canZoomIn: false,
        canZoomOut: true,
        selection: '',
        overview: { windowStart: 14, windowWidth: 16, cuts: [22], playhead: 21 },
        strip: fixtureStrip([
            ...(['frame', 'frame', 'frame', 'frame', 'cut', 'frame', 'frame', 'current'] as const),
            ...Array.from({ length: 8 }, () => 'frame' as const)
        ]),
        labels: { start: '00:12', middle: '00:15', end: '01:18 after cuts' },
        exportDetails: [
            { label: 'Length', value: '01:18' },
            { label: 'Cuts', value: '1' },
            { label: 'File', value: file }
        ],
        discardBody:
            "Both takes and your cut are deleted from this browser, including the copy kept in case it crashes. This can't be undone.",
        onback: noop,
        ontoggleplay: noop,
        onseek: noop,
        ontoggletrim: noop,
        onundo: noop,
        onredo: noop,
        onzoomin: noop,
        onzoomout: noop,
        onremove: noop,
        onpanto: noop,
        onpanby: noop,
        onframeclick: noop,
        onrestore: noop,
        ondismissexported: noop,
        onretry: noop,
        onconfirmexport: noop,
        onconfirmdiscard: noop,
        onconfirmnewrecording: noop
    };
    const trimmingStrip = fixtureStrip([
        ...(['frame', 'frame', 'frame', 'frame', 'cut', 'frame', 'frame', 'current'] as const),
        ...(['frame', 'frame', 'marked', 'marked', 'marked', 'frame', 'frame', 'frame'] as const)
    ]);
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

<Story name="Review framing check">
    {#snippet template()}
        <ScreenFrame>
            <Review
                {takes}
                shareLabel="Quarterly planning"
                micMuted
                blurOn
                bubbleEnlarged
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

{#snippet video()}
    <!-- Stands in for the video, sized as drawn -->
    <div class="absolute top-0 left-0 h-75 w-[533px] bg-yd-rule" data-compare-mask></div>
{/snippet}

<Story name="Editor joining takes">
    {#snippet template()}
        <ScreenFrame height={960}>
            <EditorView
                {...editor}
                phase="joining"
                progress={64}
                joiningTitle="Joining 2 takes"
                progressNote="The timeline fills in once they're joined."
                {video}
            />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Editor">
    {#snippet template()}
        <ScreenFrame height={960}>
            <EditorView {...editor} {video} />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Editor trimming">
    {#snippet template()}
        <ScreenFrame height={960}>
            <EditorView {...editor} trimming selection="0.6 s" strip={trimmingStrip} {video} />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Editor export dialog">
    {#snippet template()}
        <ScreenFrame height={960}>
            <EditorView {...editor} exportOpen {video} />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Editor exporting">
    {#snippet template()}
        <ScreenFrame height={960}>
            <EditorView
                {...editor}
                phase="exporting"
                progress={64}
                progressNote="Applying your cut. Editing unlocks when the file is saved."
                {video}
            />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Editor exported">
    {#snippet template()}
        <ScreenFrame height={960}>
            <EditorView {...editor} exportedFile={file} {video} />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Editor discard dialog">
    {#snippet template()}
        <ScreenFrame height={960}>
            <EditorView {...editor} discardOpen {video} />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Editor export failed">
    {#snippet template()}
        <ScreenFrame height={960}>
            <EditorView
                {...editor}
                phase="failed"
                failure={{
                    reason: 'The browser ran out of memory while applying your cut.',
                    details: 'RangeError: Array buffer allocation failed'
                }}
                {video}
            />
        </ScreenFrame>
    {/snippet}
</Story>

<Story name="Error">
    {#snippet template()}
        <ScreenFrame>
            <ErrorScreen
                reason="YouDemo couldn't start your camera. Another app might be using it."
                details={cameraError}
                recordingSafe
            />
        </ScreenFrame>
    {/snippet}
</Story>
