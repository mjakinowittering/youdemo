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
    import { Progress } from '$lib/components/ui/progress/index.js';
    import type { BubblePosition } from '$lib/components/WebcamBubble.svelte';
    import WelcomeModal from '$lib/components/WelcomeModal.svelte';

    import type { BlurProcessor } from '$lib/blurProcessor.js';
    import { deviceStore } from '$lib/deviceStore.svelte.js';
    import {
        start as recorderStart,
        stop as recorderStop,
        setCamEnabled,
        setMicMuted
    } from '$lib/recorder.js';
    import { stitchSegments } from '$lib/videoStitcher.js';

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
        | 'stitching'
        | 'editor'
        | 'processing'
        | 'done';

    let appState = $state<AppState>('check');

    // Streams & blobs
    let screenStream = $state<MediaStream | null>(null);
    // Raw webcam stream — owned here so it outlives Setup and feeds the recorder /
    // blur processor across a resume, with deterministic teardown on full reset.
    let webcamStream = $state<MediaStream | null>(null);
    let segments = $state<Blob[]>([]);
    let reviewVideoUrl = $state<string | null>(null);
    let editorVideoUrl = $state<string | null>(null);
    // Single combined source for the Editor + export. Built (stitched) from
    // `segments` on entering the Editor and cached until segments change.
    let editorBlob = $state<Blob | null>(null);
    let stitchProgress = $state(0);
    let outputBlob = $state<Blob | null>(null);

    // Export params (set when leaving editor → processing)
    let exportDeletedRanges = $state<DeletedRange[]>([]);
    let exportTotalDuration = $state(0);

    // Device / recording controls
    let micMuted = $state(false);
    let camEnabled = $state(true);
    let bubblePosition = $state<BubblePosition>('tr');

    // Blur processor — owned here so it outlives Setup and can be destroyed on full reset
    let processedWebcamStream = $state<MediaStream | null>(null);
    let blurProcessor: BlurProcessor | null = null;

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
            webcamStream,
            micDeviceId: deviceStore.micDeviceId,
            bubblePosition,
            micMuted,
            camEnabled,
            processedWebcamStream
        });
        sessionStartMs = Date.now();
        appState = 'recording';
    }

    async function stopRecording() {
        const blob = await recorderStop();
        totalElapsedSec += Math.round((Date.now() - sessionStartMs) / 1000);
        segments = [...segments, blob];
        // A new segment invalidates any previously stitched Editor source.
        editorBlob = null;
        if (reviewVideoUrl) URL.revokeObjectURL(reviewVideoUrl);
        reviewVideoUrl = URL.createObjectURL(blob);
        appState = 'review';
    }

    function resetToSetup() {
        if (screenStream) {
            screenStream.getTracks().forEach((t) => t.stop());
        }
        screenStream = null;
        if (webcamStream) {
            webcamStream.getTracks().forEach((t) => t.stop());
        }
        webcamStream = null;
        segments = [];
        editorBlob = null;
        bubblePosition = 'tr';
        blurProcessor?.destroy();
        blurProcessor = null;
        processedWebcamStream = null;
        if (reviewVideoUrl) URL.revokeObjectURL(reviewVideoUrl);
        reviewVideoUrl = null;
        if (editorVideoUrl) URL.revokeObjectURL(editorVideoUrl);
        editorVideoUrl = null;
        outputBlob = null;
        totalElapsedSec = 0;
        exportDeletedRanges = [];
        appState = 'setup';
        document.title = 'YouDemo';
    }

    async function handleResume() {
        try {
            const newStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            if (screenStream) {
                screenStream.getTracks().forEach((t) => t.stop());
            }
            screenStream = newStream;
            newStream.getVideoTracks()[0].addEventListener('ended', () => {
                handleStreamEnded();
            });
            appState = 'countdown';
        } catch {
            // Screen picker cancelled — stay on review
        }
    }

    async function goToEditor() {
        try {
            // Build (once) a single combined source so the Editor timeline, scrubbing
            // and cuts span the whole recording. Multiple segments are joined natively
            // via stitchSegments (real-time); the result is cached until segments change.
            if (!editorBlob) {
                if (segments.length > 1) {
                    stitchProgress = 0;
                    appState = 'stitching';
                    editorBlob = await stitchSegments(segments, (f) => {
                        stitchProgress = Math.round(f * 100);
                    });
                } else {
                    editorBlob = segments[0];
                }
                if (editorVideoUrl) URL.revokeObjectURL(editorVideoUrl);
                editorVideoUrl = URL.createObjectURL(editorBlob);
            }
            appState = 'editor';
        } catch (err) {
            errorMessage =
                err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
            hasError = true;
        }
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
        // Only meaningful while actively capturing. A stopped screen track can fire
        // 'ended' late (e.g. as the browser tears down the capture, around export
        // time); ignore it once we've moved on to review/editor/processing/done so
        // it can't flash us back to setup.
        if (appState !== 'countdown' && appState !== 'recording') return;
        try {
            await recorderStop();
        } catch {
            /* stream may already be gone */
        }
        // Spec: stream ended → full reset → setup
        resetToSetup();
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

<WelcomeModal />

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
                bind:webcamStream
                bind:bubblePosition
                bind:processedStream={processedWebcamStream}
                {micMuted}
                {camEnabled}
                ontogglemic={toggleMic}
                ontogglecam={toggleCam}
                onstart={goToCountdown}
                onprocessorchange={(p) => {
                    blurProcessor = p;
                }}
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
        {:else if appState === 'stitching'}
            <div class="flex h-full flex-col items-center justify-center p-8">
                <div class="w-full max-w-sm space-y-3">
                    <div class="flex items-baseline justify-between text-sm">
                        <span class="text-muted-foreground">Combining recordings…</span>
                        <span class="font-mono tabular-nums">{stitchProgress}%</span>
                    </div>
                    <Progress value={stitchProgress} class="*:bg-indigo-500" />
                </div>
            </div>
        {:else if appState === 'editor'}
            <Editor videoUrl={editorVideoUrl} onback={backToReview} onexport={handleExport} />
        {:else if appState === 'processing'}
            <Processing
                segments={editorBlob ? [editorBlob] : segments}
                deletedRanges={exportDeletedRanges}
                totalDuration={exportTotalDuration}
                oncomplete={handleProcessingDone}
            />
        {:else if appState === 'done'}
            <Done
                videoBlob={outputBlob}
                onbacktoeditor={backToEditor}
                onnewrecording={newRecording}
            />
        {/if}
    </div>
{/if}
