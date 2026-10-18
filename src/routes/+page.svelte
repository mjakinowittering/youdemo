<script lang="ts">
    import { base } from '$app/paths';
    import { untrack } from 'svelte';

    import BrowserCheck from '$lib/components/BrowserCheck.svelte';
    import Editor from '$lib/components/Editor/Editor.svelte';
    import ErrorScreen from '$lib/components/ErrorScreen.svelte';
    import Countdown from '$lib/components/Recorder/Countdown.svelte';
    import Recording from '$lib/components/Recorder/Recording.svelte';
    import Review from '$lib/components/Recorder/Review.svelte';
    import Setup from '$lib/components/Recorder/Setup.svelte';

    import { createBlurProcessor } from '$lib/blurProcessor.js';
    import type { BlurIntensity, BlurProcessor } from '$lib/blurProcessor.js';
    import type { BubblePosition } from '$lib/bubbleGeometry.js';
    import { COUNTDOWN_FROM, startCountdown } from '$lib/countdown.js';
    import * as crashStore from '$lib/crashStore.js';
    import { deviceStore } from '$lib/deviceStore.svelte.js';
    import {
        currentCuts,
        emptyHistory,
        exportedFileShown,
        type CutHistory,
        type ExportedFile
    } from '$lib/editorMath.js';
    import { errorDetails, errorReason } from '$lib/errors.js';
    import {
        DISPLAY_MEDIA_OPTIONS,
        start as recorderStart,
        stop as recorderStop
    } from '$lib/recorder.js';
    import { titleFor } from '$lib/titles.js';
    import type { AppState, EditorPhase, ExportStep, Take } from '$lib/types.js';
    import { downloadBlob } from '$lib/utils.js';
    import { renderEditedVideo, stitchSegments, takeDuration } from '$lib/videoStitcher.js';

    // Anything unhandled pre-empts every screen with the error screen
    let appError = $state<unknown>(null);
    let hasError = $state(false);
    // The crash store holds takes, so the error screen can say they're safe
    let recordingSafe = $state(false);

    function showError(error: unknown) {
        appError = error;
        hasError = true;
        crashStore.loadSegments().then((saved) => (recordingSafe = saved.length > 0));
    }

    if (typeof window !== 'undefined') {
        window.onerror = (message, _source, _lineno, _colno, error) =>
            showError(error ?? new Error(String(message)));
        window.onunhandledrejection = (event) => showError(event.reason);
    }

    let appState = $state<AppState>('check');

    // Live values behind the dynamic titles. The countdown and recording ticks are
    // owned here (not in the screens), so the screens render a given moment from
    // props and the title has a single owner.
    let countdownValue = $state(COUNTDOWN_FROM);
    let recordingElapsed = $state(0);
    let tick: ReturnType<typeof setInterval> | undefined;
    let stopCountdown: (() => void) | undefined;

    // ── shares, camera and takes ─────────────────────────────────────────────────
    // The screen share outlives a take, so Record take N can reuse it. It ends when
    // the browser's "Stop sharing" bar is used, on entering the Editor, or on reset.
    let screenStream = $state<MediaStream | null>(null);
    // The running share's name (its track label); empty once it has ended.
    let shareLabel = $state('');
    // Picked for the take now counting down, so Cancel stops it again.
    let sharePickedForTake = false;
    let pickError = $state('');
    // Raw webcam stream: live from Setup through Review, so the dock's changes show
    // at once and every take reuses one capture.
    let webcamStream = $state<MediaStream | null>(null);
    // The recorder's composited canvas track, shown live on the Recording screen.
    let previewStream = $state<MediaStream | null>(null);
    let takes = $state<Take[]>([]);
    let discardOpen = $state(false);
    let editorVideoUrl = $state<string | null>(null);
    // Single combined source for the Editor + export. Built (joined) from
    // `takes` on entering the Editor and cached until the takes change.
    let editorBlob = $state<Blob | null>(null);
    // The Editor's phase, and the step and progress of joining or exporting
    // (0–100, rounded down so 100 shows only once the file exists)
    let editorPhase = $state<EditorPhase>('ready');
    let editorStep = $state<ExportStep>('reading');
    let editorProgress = $state(0);
    // The cuts, with undo and redo. Owned here so they survive Back to review.
    let cutHistory = $state<CutHistory>(emptyHistory());
    // The file just exported, for the Exported notice, and why an export failed
    let exported = $state<ExportedFile | null>(null);
    let exportError = $state<unknown>(null);

    // The document title for the current moment of the journey — the only place a
    // title is set. Rendered through `<svelte:head>` below.
    let pageTitle = $derived(
        titleFor(appState, {
            hasError,
            count: countdownValue,
            elapsed: recordingElapsed,
            phase: editorPhase,
            progress: editorProgress,
            exported: exportedFileShown(exported, cutHistory) !== null
        })
    );

    // Device / recording controls — bound down through the dock into the leaf
    // controls (MicControl / CamControl / BlurControl) on each capture screen.
    let micMuted = $state(initialBool('ydMicMuted', false));
    let camEnabled = $state(initialBool('ydCamEnabled', true));
    let blurOn = $state(initialBool('ydBlurOn', false));
    let blurIntensity = $state<BlurIntensity>(initialBlurIntensity());
    let bubblePosition = $state<BubblePosition>('tr');
    // Set the first time a take starts; until then Setup carries the welcome.
    let welcomed = $state(initialBool('ydWelcomed', false));

    // Blur processor — owned here so it outlives Setup. Created/destroyed
    // reactively by the $effect below; `blurReady` lets startRecording await an
    // in-flight creation so blur is guaranteed present in the recorded output.
    let processedWebcamStream = $state<MediaStream | null>(null);
    // True while a processor is being created, so Setup can show that blur is on
    // its way rather than silently previewing the raw camera.
    let blurLoading = $state(false);
    let blurProcessor: BlurProcessor | null = null;
    let blurReady: Promise<void> = Promise.resolve();

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

    // ── camera lifecycle ───────────────────────────────────────────────────────
    // The webcam is live on every capture screen, Setup through Review, and
    // released for the Editor. Turning the camera off, changing device or leaving
    // the capture screens re-runs this; blur follows through the effect below.
    let cameraWanted = $derived(
        camEnabled &&
            !hasError &&
            (appState === 'setup' ||
                appState === 'countdown' ||
                appState === 'recording' ||
                appState === 'review')
    );

    $effect(() => {
        if (!cameraWanted) return;
        const deviceId = deviceStore.webcamDeviceId;
        let cancelled = false;
        let acquired: MediaStream | null = null;
        navigator.mediaDevices
            .getUserMedia({ video: deviceId ? { deviceId: { ideal: deviceId } } : true })
            .then((stream) => {
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                acquired = stream;
                webcamStream = stream;
            })
            .catch(() => {
                /* camera unavailable — record without webcam */
            });
        return () => {
            cancelled = true;
            acquired?.getTracks().forEach((t) => t.stop());
            if (untrack(() => webcamStream) === acquired) webcamStream = null;
        };
    });

    // Blur processor lifecycle — follows `blurOn` and the raw `webcamStream`, so
    // the camera going off, changing or being released tears it down, and coming
    // back rebuilds it with no extra coupling.
    $effect(() => {
        const on = blurOn;
        const stream = webcamStream;
        if (!on || !stream) return;
        let cancelled = false;
        blurLoading = true;
        blurReady = (async () => {
            try {
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
            } finally {
                if (!cancelled) blurLoading = false;
            }
        })();
        return () => {
            cancelled = true;
            blurLoading = false;
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

    // ── the share ──────────────────────────────────────────────────────────────

    function stopShare() {
        screenStream?.getTracks().forEach((t) => t.stop());
        screenStream = null;
        shareLabel = '';
    }

    /** Opens the browser's picker. Resolves true once a new share is running. */
    async function chooseShare(): Promise<boolean> {
        pickError = '';
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia(DISPLAY_MEDIA_OPTIONS);
        } catch (err) {
            // Cancelling the picker is not an error
            if (err instanceof Error && err.name !== 'NotAllowedError') {
                pickError = 'Could not capture screen. Please try again.';
            }
            return false;
        }
        stopShare();
        const track = stream.getVideoTracks()[0];
        screenStream = stream;
        shareLabel = track?.label || 'your screen';
        track?.addEventListener('ended', () => handleShareEnded(stream));
        return true;
    }

    // "Stop sharing" in the browser's own bar
    function handleShareEnded(stream: MediaStream) {
        if (stream !== screenStream) return;
        if (appState === 'recording') {
            // Ends the take as Stop would: kept, saved, and on to Review
            void stopRecording();
        } else if (appState === 'countdown') {
            cancelCountdown();
            return;
        }
        stopShare();
    }

    // ── transitions ──────────────────────────────────────────────────────────

    async function handleBrowserPass() {
        // Recover any takes persisted to OPFS before a crash/reload. Multiple takes
        // are stitched into the Editor source by goToEditor, exactly as a normal
        // Edit → Editor transition would.
        const recovered = await crashStore.loadSegments();
        if (recovered.length > 0) {
            takes = await Promise.all(
                recovered.map(async (blob) => ({ blob, duration: await takeDuration(blob) }))
            );
            await goToEditor();
            return;
        }
        appState = 'setup';
    }

    // The countdown's beeps share one audio context, made in the click that starts
    // the take: made later (after the picker, often with YouDemo in the background
    // as the shared tab takes focus) it can start suspended and stay silent.
    let countdownAudio: AudioContext | null = null;

    function armBeep() {
        void countdownAudio?.close();
        try {
            countdownAudio = new AudioContext();
        } catch {
            // AudioContext unavailable — silent countdown
            countdownAudio = null;
        }
    }

    function releaseBeep() {
        void countdownAudio?.close();
        countdownAudio = null;
    }

    function beep() {
        const ctx = countdownAudio;
        if (!ctx) return;
        if (ctx.state === 'suspended') void ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    }

    // 3, 2, 1 a second each with a beep, then a brief 0 before recording starts
    function goToCountdown() {
        stopCountdown?.();
        appState = 'countdown';
        stopCountdown = startCountdown({
            oncount: (count) => {
                countdownValue = count;
                beep();
            },
            ondone: () => {
                releaseBeep();
                void startRecording();
            }
        });
    }

    /** Back to where the take was started from: Setup, or Review if takes exist. */
    function cancelCountdown() {
        stopCountdown?.();
        releaseBeep();
        if (sharePickedForTake) stopShare();
        sharePickedForTake = false;
        appState = takes.length > 0 ? 'review' : 'setup';
    }

    async function chooseAndCount() {
        armBeep();
        if (await chooseShare()) {
            sharePickedForTake = true;
            goToCountdown();
        } else {
            releaseBeep();
        }
    }

    async function startRecording() {
        if (appState !== 'countdown' || !screenStream) return;
        sharePickedForTake = false;
        if (!welcomed) {
            welcomed = true;
            try {
                localStorage.setItem('ydWelcomed', 'true');
            } catch {
                /* localStorage unavailable */
            }
        }
        recordingElapsed = 0;
        // Ensure any in-flight blur processor creation has finished so the
        // blurred stream is locked into the recording from the first frame.
        await blurReady;
        previewStream = await recorderStart({
            screenStream,
            webcamStream,
            micDeviceId: deviceStore.micDeviceId,
            bubblePosition,
            micMuted,
            camEnabled,
            processedWebcamStream
        });
        appState = 'recording';
        tick = setInterval(() => (recordingElapsed += 1), 1000);
    }

    async function stopRecording() {
        if (appState !== 'recording') return;
        clearInterval(tick);
        // Leave 'recording' at once, so Stop and a share ending can't both stop it
        appState = 'review';
        const take = await recorderStop();
        previewStream = null;
        takes = [...takes, take];
        // A new take invalidates any previously stitched Editor source, and the
        // file last exported no longer matches it.
        editorBlob = null;
        exported = null;
        // Persist this take to OPFS (one file per take) so a crash/reload can
        // recover the whole recording, not just the last take.
        crashStore.saveSegment(takes.length - 1, take.blob);
    }

    function recordNextTake() {
        if (!shareLabel) {
            void chooseAndCount();
            return;
        }
        armBeep();
        goToCountdown();
    }

    function resetToSetup() {
        clearInterval(tick);
        stopCountdown?.();
        releaseBeep();
        stopShare();
        previewStream = null;
        // Keep micMuted / camEnabled / blurOn — these preferences are preserved
        // across a full reset (and reload). The camera stays live for Setup.
        takes = [];
        editorBlob = null;
        bubblePosition = 'tr';
        if (editorVideoUrl) URL.revokeObjectURL(editorVideoUrl);
        editorVideoUrl = null;
        cutHistory = emptyHistory();
        exported = null;
        exportError = null;
        editorPhase = 'ready';
        resetProgress();
        countdownValue = COUNTDOWN_FROM;
        recordingElapsed = 0;
        discardOpen = false;
        crashStore.clear();
        appState = 'setup';
    }

    function resetProgress() {
        editorStep = 'reading';
        editorProgress = 0;
    }

    // Called per packet: state changes only when the step or the whole percent
    // does, so the Editor and the title redraw at most about a hundred times.
    function reportProgress(fraction: number, step: ExportStep) {
        editorStep = step;
        editorProgress = Math.floor(fraction * 100);
    }

    async function goToEditor() {
        // Editing doesn't need the share; the camera is released by its effect
        stopShare();
        // The Editor mounts at once; several takes are joined first, losslessly
        // (a packet copy), and the result is cached until the takes change.
        appState = 'editor';
        if (editorBlob) {
            editorPhase = 'ready';
            return;
        }
        try {
            if (takes.length > 1) {
                editorPhase = 'joining';
                resetProgress();
                editorBlob = await stitchSegments(
                    takes.map((t) => t.blob),
                    reportProgress
                );
            } else {
                editorBlob = takes[0].blob;
            }
            if (editorVideoUrl) URL.revokeObjectURL(editorVideoUrl);
            editorVideoUrl = URL.createObjectURL(editorBlob);
            editorPhase = 'ready';
        } catch (err) {
            showError(err);
        }
    }

    function backToReview() {
        appState = 'review';
    }

    // Export runs inside the Editor: a packet copy of the kept ranges, saved
    // straight to the downloads. The crash store is kept: Discard and New
    // recording clear it.
    async function exportVideo(filename: string) {
        if (!editorBlob) return;
        exported = null;
        const cuts = currentCuts(cutHistory);
        // No cuts: the joined recording is the file, so there is nothing to show
        if (cuts.length === 0) {
            downloadBlob(editorBlob, filename);
            exported = { name: filename, edits: cutHistory.edits };
            editorPhase = 'ready';
            return;
        }
        editorPhase = 'exporting';
        resetProgress();
        try {
            const blob = await renderEditedVideo(editorBlob, cuts, reportProgress);
            downloadBlob(blob, filename);
            exported = { name: filename, edits: cutHistory.edits };
            editorPhase = 'ready';
        } catch (err) {
            exportError = err;
            editorPhase = 'failed';
        }
    }
</script>

<svelte:head>
    <title>{pageTitle}</title>
</svelte:head>

{#if hasError}
    <ErrorScreen reason={errorReason(appError)} details={errorDetails(appError)} {recordingSafe} />
{:else if appState === 'check'}
    <BrowserCheck onpass={handleBrowserPass} />
{:else if appState === 'setup'}
    <Setup
        bind:micMuted
        bind:camEnabled
        bind:blurOn
        bind:blurIntensity
        bind:bubblePosition
        firstVisit={!welcomed}
        {pickError}
        cameraStream={processedWebcamStream ?? webcamStream}
        {blurLoading}
        onchoose={chooseAndCount}
    />
{:else if appState === 'countdown'}
    <Countdown
        count={countdownValue}
        oncancel={cancelCountdown}
        {micMuted}
        {camEnabled}
        {blurOn}
        {blurIntensity}
    />
{:else if appState === 'recording'}
    <Recording
        elapsed={recordingElapsed}
        take={takes.length + 1}
        {previewStream}
        {micMuted}
        {camEnabled}
        {blurOn}
        {blurIntensity}
        onstop={stopRecording}
    />
{:else if appState === 'review'}
    <Review
        bind:micMuted
        bind:camEnabled
        bind:blurOn
        bind:blurIntensity
        bind:bubblePosition
        bind:discardOpen
        takes={takes.map((t) => t.duration)}
        {shareLabel}
        shareStream={screenStream}
        cameraStream={processedWebcamStream ?? webcamStream}
        {blurLoading}
        onrecord={recordNextTake}
        onchangeshare={chooseShare}
        onedit={goToEditor}
        ondiscard={resetToSetup}
    />
{:else if appState === 'editor'}
    <Editor
        videoUrl={editorVideoUrl}
        phase={editorPhase}
        step={editorStep}
        progress={editorProgress}
        takeCount={takes.length}
        bind:history={cutHistory}
        bind:exported
        {exportError}
        onback={backToReview}
        onexport={exportVideo}
        ondiscard={resetToSetup}
    />
{/if}
