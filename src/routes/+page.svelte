<script lang="ts">
    import BrowserCheck from '$lib/components/BrowserCheck.svelte';
    import Countdown from '$lib/components/Countdown.svelte';
    import Done from '$lib/components/Done.svelte';
    import Editor from '$lib/components/Editor.svelte';
    import type { DeletedRange } from '$lib/components/Editor.svelte';
    import ErrorScreen from '$lib/components/ErrorScreen.svelte';
    import Processing from '$lib/components/Processing.svelte';
    import Recording from '$lib/components/Recording.svelte';
    import Review from '$lib/components/Review.svelte';
    import Setup from '$lib/components/Setup.svelte';
    import type { BubblePosition } from '$lib/components/WebcamBubble.svelte';

    import { deviceStore } from '$lib/deviceStore.svelte.js';
    import {
        start as recorderStart,
        stop as recorderStop,
        setCamEnabled,
        setMicMuted
    } from '$lib/recorder.js';

    let errorMessage = $state('');
    let hasError = $state(false);

    if (typeof window !== 'undefined') {
        window.onerror = (_message, _source, _lineno, _colno, error) => {
            errorMessage = `${_message}\n${error?.stack ?? ''}`;
            hasError = true;
        };
        window.onunhandledrejection = (event) => {
            errorMessage = `Unhandled Promise: ${event.reason?.message ?? event.reason}\n${event.reason?.stack ?? ''}`;
            hasError = true;
        };
    }

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
    let exportDeletedRanges = $state<DeletedRange[]>([]);
    let exportTotalDuration = $state(0);

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

    function resetToSetup() {
        if (screenStream) {
            screenStream.getTracks().forEach((t) => t.stop());
        }
        screenStream = null;
        segments = [];
        bubblePosition = 'tr';
        if (reviewVideoUrl) URL.revokeObjectURL(reviewVideoUrl);
        reviewVideoUrl = null;
        if (editorVideoUrl) URL.revokeObjectURL(editorVideoUrl);
        editorVideoUrl = null;
        outputBlob = null;
        totalElapsedSec = 0;
        exportDeletedRanges = [];
        appState = 'setup';
        document.title = 'YourDemo';
    }

    async function handleResume() {
        try {
            console.log('[Review] Resume clicked — showing screen picker');
            const newStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            console.log(
                '[Review] Screen picker confirmed — updating stream and starting countdown'
            );
            if (screenStream) {
                screenStream.getTracks().forEach((t) => t.stop());
            }
            screenStream = newStream;
            newStream.getVideoTracks()[0].addEventListener('ended', () => {
                handleStreamEnded();
            });
            appState = 'countdown';
        } catch {
            console.log('[Review] Screen picker cancelled — staying on review');
        }
    }

    function goToEditor() {
        console.log('[App] Edit & Export clicked — transitioning to editor');
        if (editorVideoUrl) URL.revokeObjectURL(editorVideoUrl);
        const stitched = new Blob(segments, { type: 'video/webm' });
        console.log(
            '[Editor] 3. Creating object URL from',
            segments.length,
            'segment(s) — total blob size:',
            stitched.size,
            'bytes'
        );
        editorVideoUrl = URL.createObjectURL(stitched);
        console.log('[Editor] 4. Object URL created:', editorVideoUrl);
        appState = 'editor';
        console.log('[App] State is now: editor');
    }

    function backToReview() {
        appState = 'review';
    }

    function handleExport(deletedRanges: DeletedRange[], totalDuration: number) {
        exportDeletedRanges = deletedRanges;
        exportTotalDuration = totalDuration;
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
        resetToSetup();
    }

    function discard() {
        resetToSetup();
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

{#if hasError}
    <div class="h-full">
        <ErrorScreen error={errorMessage} />
    </div>
{:else}
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
            onresume={handleResume}
            onedit={goToEditor}
            ondiscard={discard}
        />
    {:else if appState === 'editor'}
        <Editor videoUrl={editorVideoUrl} onback={backToReview} onexport={handleExport} />
    {:else if appState === 'processing'}
        <Processing
            {segments}
            deletedRanges={exportDeletedRanges}
            totalDuration={exportTotalDuration}
            oncomplete={handleProcessingDone}
        />
    {:else if appState === 'done'}
        <Done videoBlob={outputBlob} onbacktoeditor={backToEditor} onnewrecording={newRecording} />
    {/if}
</div>
{/if}
