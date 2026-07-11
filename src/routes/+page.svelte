<script lang="ts">
    import { base } from '$app/paths';
    import { untrack } from 'svelte';

    import BrowserCheck from '$lib/components/BrowserCheck.svelte';
    import Done from '$lib/components/Editor/Done.svelte';
    import Editor from '$lib/components/Editor/Editor.svelte';
    import Processing from '$lib/components/Editor/Processing.svelte';
    import ErrorScreen from '$lib/components/ErrorScreen.svelte';
    import Countdown from '$lib/components/Recorder/Countdown.svelte';
    import Recording from '$lib/components/Recorder/Recording.svelte';
    import Review from '$lib/components/Recorder/Review.svelte';
    import Setup from '$lib/components/Recorder/Setup.svelte';
    import type { BubblePosition } from '$lib/components/Recorder/WebcamBubble.svelte';
    import { Progress } from '$lib/components/ui/progress/index.js';
    import WelcomeModal from '$lib/components/WelcomeModal.svelte';

    import { createBlurProcessor } from '$lib/blurProcessor.js';
    import type { BlurIntensity, BlurProcessor } from '$lib/blurProcessor.js';
    import * as crashStore from '$lib/crashStore.js';
    import { deviceStore } from '$lib/deviceStore.svelte.js';
    import { start as recorderStart, stop as recorderStop } from '$lib/recorder.js';
    import type { DeletedRange } from '$lib/types.js';
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
    let editorVideoUrl = $state<string | null>(null);
    // Single combined source for the Editor + export. Built (stitched) from
    // `segments` on entering the Editor and cached until segments change.
    let editorBlob = $state<Blob | null>(null);
    let stitchProgress = $state(0);
    let outputBlob = $state<Blob | null>(null);

    // Export params (set when leaving editor → processing)
    let exportDeletedRanges = $state<DeletedRange[]>([]);

    // Device / recording controls — bound down through ControlBar into the leaf
    // controls (MicControl / CamControl / BlurControl) on each capture screen.
    let micMuted = $state(initialBool('ydMicMuted', false));
    let camEnabled = $state(initialBool('ydCamEnabled', true));
    let blurOn = $state(initialBool('ydBlurOn', false));
    let blurIntensity = $state<BlurIntensity>(initialBlurIntensity());
    let bubblePosition = $state<BubblePosition>('tr');

    // Blur processor — owned here so it outlives Setup. Created/destroyed
    // reactively by the $effect below; `blurReady` lets startRecording await an
    // in-flight creation so blur is guaranteed present in the recorded output.
    let processedWebcamStream = $state<MediaStream | null>(null);
    let blurProcessor: BlurProcessor | null = null;
    let blurReady: Promise<void> = Promise.resolve();

    // Duration tracking (across resume sessions). Not displayed yet — reserved
    // for a future "N clips / total duration" summary on Review.
    let sessionStartMs = 0;
    let totalElapsedSec = 0;

    function initialBool(key: string, fallback: boolean): boolean {
        try {
            const saved = localStorage.getItem(key);
            if (saved === 'true') return true;
            if (saved === 'false') return false;
        } catch {
            /* localStorage unavailable */
        }
        return fallback;
    }

    function initialBlurIntensity(): BlurIntensity {
        try {
            const saved = localStorage.getItem('ydBlurIntensity');
            if (saved === 'light' || saved === 'default' || saved === 'heavy') return saved;
        } catch {
            /* localStorage unavailable */
        }
        return 'default';
    }

    // Blur processor lifecycle — follows `blurOn` and the raw `webcamStream`.
    // Turning the camera off (Setup), releasing it on Review, or a full reset all
    // null `webcamStream`, tearing the processor down; re-acquiring it while
    // `blurOn` is still true rebuilds blur with no extra coupling.
    $effect(() => {
        const on = blurOn;
        const stream = webcamStream;
        if (!on || !stream) return;
        let cancelled = false;
        blurReady = (async () => {
            const p = await createBlurProcessor(
                stream,
                untrack(() => blurIntensity),
                base
            );
            if (cancelled) {
                p.destroy();
                return;
            }
            blurProcessor = p;
            processedWebcamStream = p.outputStream;
        })();
        return () => {
            cancelled = true;
            blurProcessor?.destroy();
            blurProcessor = null;
            processedWebcamStream = null;
            blurReady = Promise.resolve();
        };
    });

    // Persist the capture control choices so they're remembered across a full
    // reset (New Recording / Discard) and page reloads.
    $effect(() => {
        const values: [string, boolean][] = [
            ['ydMicMuted', micMuted],
            ['ydCamEnabled', camEnabled],
            ['ydBlurOn', blurOn]
        ];
        try {
            for (const [key, value] of values) localStorage.setItem(key, String(value));
        } catch {
            /* localStorage unavailable */
        }
    });

    // Persist intensity and apply it to a running processor in place (no restart).
    $effect(() => {
        const i = blurIntensity;
        try {
            localStorage.setItem('ydBlurIntensity', i);
        } catch {
            /* localStorage unavailable */
        }
        untrack(() => blurProcessor)?.setIntensity(i);
    });

    // ── camera lifecycle ───────────────────────────────────────────────────────
    // The webcam is live only during the capture flow (setup preview → countdown →
    // recording). It is released the moment a recording is captured (Review onward)
    // so the camera/red-dot isn't left running, and re-acquired on resume. Blur
    // follows automatically via the $effect above.

    function releaseCamera() {
        webcamStream?.getTracks().forEach((t) => t.stop());
        webcamStream = null;
    }

    async function armCamera() {
        if (!camEnabled) return;
        try {
            const deviceId = deviceStore.webcamDeviceId;
            webcamStream = await navigator.mediaDevices.getUserMedia({
                video: deviceId ? { deviceId: { ideal: deviceId } } : true
            });
        } catch {
            /* camera unavailable — record without webcam */
        }
    }

    // ── transitions ──────────────────────────────────────────────────────────

    async function handleBrowserPass() {
        // Recover any takes persisted to OPFS before a crash/reload. Multiple takes
        // are stitched into the Editor source by goToEditor, exactly as a normal
        // Edit → Editor transition would.
        const recovered = await crashStore.loadSegments();
        if (recovered.length > 0) {
            segments = recovered;
            await goToEditor();
            return;
        }
        appState = 'setup';
    }

    function goToCountdown() {
        appState = 'countdown';
    }

    async function startRecording() {
        // Ensure any in-flight blur processor creation has finished so the
        // blurred stream is locked into the recording from the first frame.
        await blurReady;
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
        // Persist this take to OPFS (one file per take) so a crash/reload can
        // recover the whole recording, not just the last take.
        crashStore.saveSegment(segments.length - 1, blob);
        // Recording captured — let the camera go until/unless the user resumes.
        releaseCamera();
        appState = 'review';
    }

    function resetToSetup() {
        if (screenStream) {
            screenStream.getTracks().forEach((t) => t.stop());
        }
        screenStream = null;
        // Keep micMuted / camEnabled / blurOn — these preferences are preserved
        // across a full reset (and reload). releaseCamera() nulls webcamStream,
        // which tears the blur processor down; it rebuilds on the next armCamera()
        // while blurOn is still true.
        releaseCamera();
        segments = [];
        editorBlob = null;
        bubblePosition = 'tr';
        if (editorVideoUrl) URL.revokeObjectURL(editorVideoUrl);
        editorVideoUrl = null;
        outputBlob = null;
        totalElapsedSec = 0;
        exportDeletedRanges = [];
        crashStore.clear();
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
            // Re-acquire the camera (released when the previous recording stopped);
            // blur rebuilds reactively if it was still on.
            await armCamera();
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

    function handleExport(deletedRanges: DeletedRange[]) {
        exportDeletedRanges = deletedRanges;
        appState = 'processing';
    }

    function handleProcessingDone(blob: Blob) {
        outputBlob = blob;
        crashStore.clear();
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
</script>

<WelcomeModal />

<div class="h-full">
    {#if hasError}
        <ErrorScreen error={errorMessage} />
    {:else if appState === 'check'}
        <BrowserCheck onpass={handleBrowserPass} />
    {:else if appState === 'setup'}
        <Setup
            bind:screenStream
            bind:webcamStream
            bind:bubblePosition
            bind:micMuted
            bind:camEnabled
            bind:blurOn
            bind:blurIntensity
            processedStream={processedWebcamStream}
            onstart={goToCountdown}
        />
    {:else if appState === 'countdown'}
        <Countdown oncomplete={startRecording} />
    {:else if appState === 'recording'}
        <Recording
            {screenStream}
            bind:micMuted
            bind:camEnabled
            bind:blurOn
            bind:blurIntensity
            onstop={stopRecording}
            onstreamended={handleStreamEnded}
        />
    {:else if appState === 'review'}
        <Review
            bind:micMuted
            bind:camEnabled
            bind:blurOn
            bind:blurIntensity
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
        <Editor
            videoUrl={editorVideoUrl}
            onback={backToReview}
            onexport={handleExport}
            ondiscard={discard}
        />
    {:else if appState === 'processing'}
        <Processing
            segments={editorBlob ? [editorBlob] : segments}
            deletedRanges={exportDeletedRanges}
            oncomplete={handleProcessingDone}
        />
    {:else if appState === 'done'}
        <Done videoBlob={outputBlob} onbacktoeditor={backToEditor} onnewrecording={newRecording} />
    {/if}
</div>
