<script lang="ts">
    import BrowserCheck from '$lib/components/BrowserCheck.svelte';
    import Setup from '$lib/components/Setup.svelte';
    import Countdown from '$lib/components/Countdown.svelte';
    import Recording from '$lib/components/Recording.svelte';
    import Review from '$lib/components/Review.svelte';
    import Editor from '$lib/components/Editor.svelte';
    import Processing from '$lib/components/Processing.svelte';
    import Done from '$lib/components/Done.svelte';
    import type { CutRegion } from '$lib/components/Editor.svelte';
    import type { BubblePosition } from '$lib/components/WebcamBubble.svelte';
    import {
        start as recorderStart,
        stop as recorderStop,
        setMicMuted,
        setCamEnabled
    } from '$lib/recorder.js';
    import { deviceStore } from '$lib/deviceStore.svelte.js';

    type AppState =
        | 'check'
        | 'setup'
        | 'countdown'
        | 'recording'
        | 'review'
        | 'editor'
        | 'processing'
        | 'done';

    let appState = $state<AppState>('check');

    // Streams & blobs
    let screenStream = $state<MediaStream | null>(null);
    let segments = $state<Blob[]>([]);
    let reviewVideoUrl = $state<string | null>(null);
    let editorVideoUrl = $state<string | null>(null);
    let outputBlob = $state<Blob | null>(null);

    // Export params (set when leaving editor → processing)
    let exportTrimStart = $state(0);
    let exportTrimEnd = $state(0);
    let exportCuts = $state<CutRegion[]>([]);

    // Device / recording controls
    let micMuted = $state(false);
    let camEnabled = $state(true);
    let bubblePosition = $state<BubblePosition>('tr');

    // Duration tracking (across resume sessions)
    let sessionStartMs = 0;
    let totalElapsedSec = $state(0);

    // ── transitions ──────────────────────────────────────────────────────────

    function goToSetup() {
        appState = 'setup';
    }

    function goToCountdown() {
        appState = 'countdown';
    }

    async function startRecording() {
        await recorderStart({
            screenStream: screenStream!,
            webcamDeviceId: deviceStore.webcamDeviceId,
            micDeviceId: deviceStore.micDeviceId,
            bubblePosition,
            micMuted,
            camEnabled
        });
        sessionStartMs = Date.now();
        appState = 'recording';
    }

    async function stopRecording() {
        console.log('[Recording] Calling recorder.stop()');
        const blob = await recorderStop();
        console.log('[Recording] recorder.stop() returned — blob size:', blob.size, 'bytes');
        totalElapsedSec += Math.round((Date.now() - sessionStartMs) / 1000);
        segments = [...segments, blob];
        if (reviewVideoUrl) URL.revokeObjectURL(reviewVideoUrl);
        reviewVideoUrl = URL.createObjectURL(blob);
        appState = 'review';
        console.log('[Recording] Transitioning to review state');
    }

    function resumeRecording() {
        appState = 'countdown';
    }

    function goToEditor() {
        console.log('[App] Edit & Export clicked — transitioning to editor');
        if (editorVideoUrl) URL.revokeObjectURL(editorVideoUrl);
        const stitched = new Blob(segments, { type: 'video/webm' });
        console.log('[Editor] 3. Creating object URL from', segments.length, 'segment(s) — total blob size:', stitched.size, 'bytes');
        editorVideoUrl = URL.createObjectURL(stitched);
        console.log('[Editor] 4. Object URL created:', editorVideoUrl);
        appState = 'editor';
        console.log('[App] State is now: editor');
    }

    function backToReview() {
        appState = 'review';
    }

    function handleExport(trimStart: number, trimEnd: number, cuts: CutRegion[]) {
        exportTrimStart = trimStart;
        exportTrimEnd = trimEnd;
        exportCuts = cuts;
        appState = 'processing';
    }

    function handleProcessingDone(blob: Blob) {
        outputBlob = blob;
        appState = 'done';
    }

    function backToEditor() {
        appState = 'editor';
    }

    function newRecording() {
        if (reviewVideoUrl) URL.revokeObjectURL(reviewVideoUrl);
        if (editorVideoUrl) URL.revokeObjectURL(editorVideoUrl);
        reviewVideoUrl = null;
        editorVideoUrl = null;
        outputBlob = null;
        segments = [];
        totalElapsedSec = 0;
        exportTrimStart = 0;
        exportTrimEnd = 0;
        exportCuts = [];
        appState = 'setup';
    }

    function discard() {
        if (reviewVideoUrl) URL.revokeObjectURL(reviewVideoUrl);
        reviewVideoUrl = null;
        segments = [];
        totalElapsedSec = 0;
        appState = 'setup';
    }

    async function handleStreamEnded() {
        try {
            await recorderStop();
        } catch {
            /* stream may already be gone */
        }
        screenStream?.getTracks().forEach((t) => t.stop());
        screenStream = null;
        if (reviewVideoUrl) URL.revokeObjectURL(reviewVideoUrl);
        reviewVideoUrl = null;
        segments = [];
        totalElapsedSec = 0;
        appState = 'setup';
    }

    function toggleMic() {
        micMuted = !micMuted;
        if (appState === 'recording') setMicMuted(micMuted);
    }

    function toggleCam() {
        camEnabled = !camEnabled;
        if (appState === 'recording') setCamEnabled(camEnabled);
    }
</script>

<div class="h-full">
    {#if appState === 'check'}
        <BrowserCheck onpass={goToSetup} />
    {:else if appState === 'setup'}
        <Setup
            bind:screenStream
            bind:bubblePosition
            {micMuted}
            {camEnabled}
            ontogglemic={toggleMic}
            ontogglecam={toggleCam}
            onstart={goToCountdown}
        />
    {:else if appState === 'countdown'}
        <Countdown oncomplete={startRecording} />
    {:else if appState === 'recording'}
        <Recording
            {screenStream}
            {micMuted}
            {camEnabled}
            ontogglemic={toggleMic}
            ontogglecam={toggleCam}
            onstop={stopRecording}
            onstreamended={handleStreamEnded}
        />
    {:else if appState === 'review'}
        <Review
            videoUrl={reviewVideoUrl}
            duration={totalElapsedSec}
            micEnabled={!micMuted}
            {camEnabled}
            onresume={resumeRecording}
            onedit={goToEditor}
            ondiscard={discard}
        />
    {:else if appState === 'editor'}
        <Editor videoUrl={editorVideoUrl} onback={backToReview} onexport={handleExport} />
    {:else if appState === 'processing'}
        <Processing
            {segments}
            trimStart={exportTrimStart}
            trimEnd={exportTrimEnd}
            cuts={exportCuts}
            oncomplete={handleProcessingDone}
        />
    {:else if appState === 'done'}
        <Done videoBlob={outputBlob} onbacktoeditor={backToEditor} onnewrecording={newRecording} />
    {/if}
</div>
