import fixWebmDuration from 'fix-webm-duration';

import type { BubblePosition } from '$lib/bubbleGeometry.js';
import { createBubble, drawComposite, type Bubble } from '$lib/composite.js';
import type { CompositorMessage } from '$lib/compositor.worker.js';
import { FRAME_RATE, SAMPLE_INTERVAL } from '$lib/editorMath.js';
import { canProcessInWorker, frameTrack, trackFrames } from '$lib/trackFrames.js';
import type { Take } from '$lib/types.js';
import { blackMargins, NO_MARGINS, type Margins } from '$lib/windowCrop.js';

export interface RecorderOptions {
    screenStream: MediaStream;
    /** Raw webcam stream acquired upstream (Setup) — reused, never re-acquired here. */
    webcamStream: MediaStream | null;
    micDeviceId: string | null;
    bubblePosition: BubblePosition;
    micMuted: boolean;
    camEnabled: boolean;
    /** Blurred webcam output; drawn in preference to the raw stream when present. */
    processedWebcamStream: MediaStream | null;
}

// ─── constants ────────────────────────────────────────────────────────────────

// Cap the composited canvas so software VP9 encoding stays within a sane CPU
// budget — uncapped 1440p/4K compositing + encode is the main cause of renderer
// crashes ("white screen") during recording.
const MAX_DIM = 1920;
/** Also the export fallback's re-encode bitrate (`videoStitcher.ts`). */
export const VIDEO_BITS_PER_SECOND = 5_000_000;
const AUDIO_BITS_PER_SECOND = 128_000;

/**
 * The screen picker request, shared by Setup and Resume. Excluding YouDemo's own
 * tab stops the live preview being recorded inside itself. Not yet in
 * TypeScript's DOM typings; Chromium supports it.
 */
export const DISPLAY_MEDIA_OPTIONS: DisplayMediaStreamOptions & { selfBrowserSurface: 'exclude' } =
    {
        // The recording is 30 fps; a faster share would only double the encoding
        video: { frameRate: { max: FRAME_RATE } },
        audio: true,
        selfBrowserSurface: 'exclude'
    };
// A keyframe on every editor cell, so export can cut by copying packets: a
// copied stretch must start on a keyframe. Chrome's default is a single
// keyframe at the start. Chrome keys the first frame at least this long after
// the last keyframe: half a frame short of a cell, so at 30 fps that's every
// 6th frame (0.2 s) — a full 200 ms would miss the 6th by a hair and make
// 7-frame groups. A duration, not a count: when the machine falls behind and
// frames come late, a count would stretch the groups past a cell.
const KEYFRAME_AFTER_MS = (SAMPLE_INTERVAL - 0.5 / FRAME_RATE) * 1000;
const FRAME_MS = 1000 / FRAME_RATE;
// The timer takes over drawing once the screen has sent nothing for this long
const SCREEN_QUIET_MS = 1.5 * FRAME_MS;

// ─── singleton state ──────────────────────────────────────────────────────────

// Compositing runs in a Worker, which reads the screen's and the webcam's frames
// as they arrive and writes the recording's frames to `_outputTrack`
let _worker: Worker | null = null;
let _outputTrack: MediaStreamTrack | null = null;
// Clones of the tracks the Worker reads, so stopping them ends only its reading
let _workerTracks: MediaStreamTrack[] = [];
// Where the browser can't do that, a timer draws the <video>s on this canvas
let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
let _canvasCaptureTrack: CanvasCaptureMediaStreamTrack | null = null;
let _bubble: Bubble | null = null;
let _intervalId: ReturnType<typeof setInterval> | null = null;
let _screenVideo: HTMLVideoElement | null = null;
let _webcamVideo: HTMLVideoElement | null = null;
let _recorder: MediaRecorder | null = null;
let _chunks: BlobPart[] = [];
let _audioCtx: AudioContext | null = null;
let _micNode: MediaStreamAudioSourceNode | null = null;
let _destination: MediaStreamAudioDestinationNode | null = null;
let _camEnabled = false;
let _bubblePos: BubblePosition = 'tr';
let _recordingStartTime = 0;
let _userStream: MediaStream | null = null;
// A window share's shadow margin, left out of every frame (windowCrop.ts)
let _isWindowShare = false;
let _margins: Margins = NO_MARGINS;

// ─── helpers ──────────────────────────────────────────────────────────────────

function getSupportedMimeType(): string {
    const types = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm'
    ];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';
}

/** Scale a source resolution down so its longest edge ≤ MAX_DIM, keeping even dimensions. */
function cappedDimensions(srcW: number, srcH: number): { width: number; height: number } {
    const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
    return {
        width: Math.max(2, Math.round((srcW * scale) / 2) * 2),
        height: Math.max(2, Math.round((srcH * scale) / 2) * 2)
    };
}

// Measures the margin a window share brought with it, from the frame showing now.
// Runs at start and when the window is resized, never per frame.
function measureMargins(): void {
    if (!_screenVideo || !_isWindowShare) return;
    const w = _screenVideo.videoWidth;
    const h = _screenVideo.videoHeight;
    if (!w || !h) return;
    const probe = document.createElement('canvas');
    probe.width = w;
    probe.height = h;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(_screenVideo, 0, 0);
    _margins = blackMargins(ctx.getImageData(0, 0, w, h).data, w, h);
    tellWorker({ type: 'margins', margins: _margins });
}

function tellWorker(message: CompositorMessage, transfer: Transferable[] = []): void {
    _worker?.postMessage(message, transfer);
}

// The frames of a clone of `track`, for the Worker to read; null where unsupported
function startWorkerTrack(track: MediaStreamTrack): ReadableStream<VideoFrame> | null {
    const clone = track.clone();
    const frames = trackFrames(clone);
    if (frames) _workerTracks.push(clone);
    else clone.stop();
    return frames;
}

function videoReady(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve) => {
        if (video.readyState >= 2) resolve();
        else video.addEventListener('canplay', () => resolve(), { once: true });
    });
}

// The fallback's frame, drawn from the <video>s on a timer
function drawFrame(): void {
    if (!_ctx || !_canvas || !_screenVideo) return;
    const picture = (video: HTMLVideoElement | null) =>
        video && video.readyState >= 2
            ? { source: video, width: video.videoWidth, height: video.videoHeight }
            : null;
    drawComposite(
        _ctx,
        _canvas.width,
        _canvas.height,
        picture(_screenVideo),
        _margins,
        _camEnabled ? picture(_webcamVideo) : null,
        _bubble,
        _bubblePos
    );
    _canvasCaptureTrack?.requestFrame();
}

function stopDrawing(): void {
    if (_intervalId !== null) {
        clearInterval(_intervalId);
        _intervalId = null;
    }
    _worker?.terminate();
    _worker = null;
    _workerTracks.forEach((t) => t.stop());
    _workerTracks = [];
}

function cleanup(): void {
    // The screen share and the raw webcam stream are owned upstream (+page) and
    // are intentionally NOT stopped here: both outlive a take, so the next take
    // can reuse them. Only the mic stream acquired below belongs to the recorder.
    if (_screenVideo) {
        _screenVideo.removeEventListener('resize', measureMargins);
        _screenVideo.srcObject = null;
        _screenVideo = null;
    }
    if (_userStream) {
        _userStream.getTracks().forEach((t) => t.stop());
        _userStream = null;
    }
    if (_webcamVideo) {
        _webcamVideo.srcObject = null;
        _webcamVideo = null;
    }
    _audioCtx?.close();
    _audioCtx = null;
    _micNode = null;
    _destination = null;
    _recorder = null;
    _canvas = null;
    _ctx = null;
    _canvasCaptureTrack = null;
    _bubble = null;
    _outputTrack?.stop();
    _outputTrack = null;
    _isWindowShare = false;
    _margins = NO_MARGINS;
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Starts recording. Resolves with a video-only stream of the composited canvas —
 * the very track being encoded — for the Recording screen's live preview.
 */
export async function start(options: RecorderOptions): Promise<MediaStream> {
    const { screenStream, webcamStream, micDeviceId, bubblePosition, micMuted, camEnabled } =
        options;
    _camEnabled = camEnabled;
    _bubblePos = bubblePosition;
    _chunks = [];

    // Screen video for drawImage
    _screenVideo = document.createElement('video');
    _screenVideo.srcObject = screenStream;
    _screenVideo.muted = true;
    await _screenVideo.play();

    // Audio graph: system audio (from the screen stream) + mic, mixed into one track
    _audioCtx = new AudioContext();
    await _audioCtx.resume().catch(() => {});
    _destination = _audioCtx.createMediaStreamDestination();

    // Keep the destination's audio track alive with continuous silence. With no
    // mic and no tab audio, an input-less destination feeds MediaRecorder an Opus
    // track with zero packets; Chromium then rejects the resulting WebM with
    // "The element has no supported sources" when it is loaded into the Editor.
    // A started silent source guarantees the track always carries samples. It is
    // inaudible — the destination is never connected to the speakers.
    const silence = _audioCtx.createConstantSource();
    silence.offset.value = 0;
    silence.connect(_destination);
    silence.start();

    const screenAudioTracks = screenStream.getAudioTracks();
    if (screenAudioTracks.length) {
        _audioCtx.createMediaStreamSource(new MediaStream(screenAudioTracks)).connect(_destination);
    }

    // Webcam video — reuse the stream already acquired upstream. Never open a
    // second camera capture (wasteful, and some webcams reject a concurrent open).
    const webcamVideoStream = options.processedWebcamStream ?? webcamStream;
    const webcamTrack = camEnabled ? (webcamVideoStream?.getVideoTracks()[0] ?? null) : null;
    const inWorker = canProcessInWorker();
    if (webcamTrack && webcamVideoStream && !inWorker) {
        _webcamVideo = document.createElement('video');
        _webcamVideo.srcObject = webcamVideoStream;
        _webcamVideo.muted = true;
        _webcamVideo.play().catch(() => {});
    }

    // Mic audio only — video is reused from upstream above.
    try {
        const micStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: micDeviceId ? { deviceId: { ideal: micDeviceId } } : true
        });
        _userStream = micStream;
        const audioTracks = micStream.getAudioTracks();
        if (audioTracks.length) {
            _micNode = _audioCtx.createMediaStreamSource(new MediaStream(audioTracks));
            if (!micMuted) _micNode.connect(_destination);
        }
    } catch {
        // continue without mic
    }

    // Wait for both video elements to be drawable before starting
    const readyPromises = [videoReady(_screenVideo)];
    if (_webcamVideo) readyPromises.push(videoReady(_webcamVideo));
    await Promise.all(readyPromises);

    // A window share is recorded without its shadow margin, measured again
    // whenever the window is resized; the canvas keeps its first size
    _isWindowShare = screenStream.getVideoTracks()[0]?.getSettings().displaySurface === 'window';
    measureMargins();
    _screenVideo.addEventListener('resize', measureMargins);

    // Size the canvas now that the screen video's intrinsic dimensions are known
    const { top, right, bottom, left } = _margins;
    const { width, height } = cappedDimensions(
        (_screenVideo.videoWidth || 1920) - left - right,
        (_screenVideo.videoHeight || 1080) - top - bottom
    );

    const screenTrack = screenStream.getVideoTracks()[0];
    const output = inWorker ? frameTrack() : null;
    const screenFrames = output && screenTrack ? startWorkerTrack(screenTrack) : null;
    let videoTrack: MediaStreamTrack;
    if (output && screenFrames) {
        // The Worker draws every screen frame as it arrives. A timer of our own
        // would sample the screen's 30 fps with a second 30 fps clock, repeating
        // some frames and missing others.
        const webcamFrames = webcamTrack ? startWorkerTrack(webcamTrack) : null;
        // What the screen shows now, in case it stays still and sends nothing
        const firstScreen = new VideoFrame(_screenVideo);
        _worker = new Worker(new URL('./compositor.worker.ts', import.meta.url), {
            type: 'module'
        });
        _worker.onerror = (e) => console.error('The recording stopped drawing:', e.message);
        tellWorker(
            {
                type: 'start',
                screen: screenFrames,
                webcam: webcamFrames,
                firstScreen,
                output: output.writable,
                width,
                height,
                margins: _margins,
                camEnabled,
                bubblePosition,
                frameMs: FRAME_MS,
                quietMs: SCREEN_QUIET_MS
            },
            [screenFrames, ...(webcamFrames ? [webcamFrames] : []), firstScreen, output.writable]
        );
        _outputTrack = videoTrack = output.track;
    } else {
        // alpha: false → opaque output, so the recorded WebM has no alpha plane,
        // which breaks tooling downstream; the screen fills every frame anyway.
        _canvas = document.createElement('canvas');
        _canvas.width = width;
        _canvas.height = height;
        _ctx = _canvas.getContext('2d', { alpha: false })!;
        if (_webcamVideo) _bubble = createBubble(document.createElement('canvas'), height);
        // 0 = manual frame control: drawFrame() asks for each frame
        _canvasCaptureTrack = _canvas
            .captureStream(0)
            .getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
        videoTrack = _canvasCaptureTrack;
        _intervalId = setInterval(drawFrame, FRAME_MS);
    }

    // The composited video + mixed audio → MediaRecorder
    const recorded = new MediaStream([videoTrack, ..._destination.stream.getAudioTracks()]);

    // Not yet in TypeScript's DOM typings; Chromium supports it.
    const mediaOptions: MediaRecorderOptions & { videoKeyFrameIntervalDuration: number } = {
        mimeType: getSupportedMimeType(),
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        videoKeyFrameIntervalDuration: KEYFRAME_AFTER_MS
    };
    _recorder = new MediaRecorder(recorded, mediaOptions);
    _recorder.ondataavailable = (e) => {
        if (e.data.size > 0) _chunks.push(e.data);
    };

    _recorder.start(500);
    _recordingStartTime = Date.now();
    return new MediaStream([videoTrack]);
}

/** Stops recording and resolves with the take: its WebM and duration. */
export function stop(): Promise<Take> {
    const durationMs = Date.now() - _recordingStartTime;
    return new Promise((resolve) => {
        if (!_recorder) {
            resolve({ blob: new Blob([], { type: 'video/webm' }), duration: 0 });
            return;
        }
        stopDrawing();
        if (_userStream) {
            _userStream.getTracks().forEach((t) => t.stop());
            _userStream = null;
        }
        _recorder.onstop = async () => {
            const blob = new Blob(_chunks, { type: 'video/webm' });
            const fixedBlob = await fixWebmDuration(blob, durationMs);
            cleanup();
            resolve({ blob: fixedBlob, duration: durationMs / 1000 });
        };
        if (_recorder.state !== 'inactive') _recorder.stop();
        else _recorder.onstop(new Event('stop'));
    });
}

export function setMicMuted(muted: boolean): void {
    if (!_micNode || !_destination) return;
    if (muted) {
        try {
            _micNode.disconnect(_destination);
        } catch {
            /* already disconnected */
        }
    } else {
        _micNode.connect(_destination);
    }
}

export function setCamEnabled(enabled: boolean): void {
    _camEnabled = enabled;
    tellWorker({ type: 'camEnabled', camEnabled: enabled });
}

export function setBubblePosition(pos: BubblePosition): void {
    _bubblePos = pos;
    tellWorker({ type: 'bubblePosition', bubblePosition: pos });
}
