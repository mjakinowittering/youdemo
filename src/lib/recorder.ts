import fixWebmDuration from 'fix-webm-duration';
import { AUDIO_BPS_OPTIONS, VIDEO_BPS_OPTIONS } from './constants/VIDEO_BPS_OPTIONS';

export type BubblePosition = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'rc' | 'bc' | 'lc';

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

// Bubble geometry is expressed as a fraction of frame height so the preview
// (WebcamBubble.svelte) and the composited recording stay in sync regardless of
// resolution. These fractions MUST match the ones in WebcamBubble.svelte.
const BUBBLE_FRAC = 0.18;
const PAD_FRAC = 0.025;

// Cap the composited canvas so software VP9 encoding stays within a sane CPU
// budget — uncapped 1440p/4K compositing + encode is the main cause of renderer
// crashes ("white screen") during recording.
const MAX_DIM = 1920;

// ─── singleton state ──────────────────────────────────────────────────────────

let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
let _screenVideo: HTMLVideoElement | null = null;
let _webcamVideo: HTMLVideoElement | null = null;
let _intervalId: ReturnType<typeof setInterval> | null = null;
let _recorder: MediaRecorder | null = null;
let _chunks: BlobPart[] = [];
let _audioCtx: AudioContext | null = null;
let _micNode: MediaStreamAudioSourceNode | null = null;
let _destination: MediaStreamAudioDestinationNode | null = null;
let _camEnabled = false;
let _bubblePos: BubblePosition = 'tr';
let _recordingStartTime = 0;
let _screenStream: MediaStream | null = null;
let _userStream: MediaStream | null = null;
let _canvasCaptureTrack: CanvasCaptureMediaStreamTrack | null = null;
// Offscreen canvas the webcam bubble is masked on before being blitted to the
// main canvas — avoids the partial-coverage seam that `clip()` leaves at the
// circle edge (visible as straight "borders" once the canvas is resolution-capped).
let _bubbleCanvas: HTMLCanvasElement | null = null;
let _bubbleCtx: CanvasRenderingContext2D | null = null;
let _bubbleMask: CanvasGradient | null = null;

// ─── helpers ──────────────────────────────────────────────────────────────────

function bubbleMetrics(h: number): { bubble: number; pad: number } {
    return { bubble: h * BUBBLE_FRAC, pad: h * PAD_FRAC };
}

function bubbleCoords(pos: BubblePosition, w: number, h: number): { x: number; y: number } {
    const { bubble, pad } = bubbleMetrics(h);
    const cx = w / 2 - bubble / 2;
    const cy = h / 2 - bubble / 2;
    switch (pos) {
        case 'tl':
            return { x: pad, y: pad };
        case 'tr':
            return { x: w - bubble - pad, y: pad };
        case 'bl':
            return { x: pad, y: h - bubble - pad };
        case 'br':
            return { x: w - bubble - pad, y: h - bubble - pad };
        case 'tc':
            return { x: cx, y: pad };
        case 'rc':
            return { x: w - bubble - pad, y: cy };
        case 'bc':
            return { x: cx, y: h - bubble - pad };
        case 'lc':
            return { x: pad, y: cy };
    }
}

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

function videoReady(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve) => {
        if (video.readyState >= 2) resolve();
        else video.addEventListener('canplay', () => resolve(), { once: true });
    });
}

function drawFrame(): void {
    if (!_ctx || !_canvas || !_screenVideo) return;
    const w = _canvas.width;
    const h = _canvas.height;

    if (_screenVideo.readyState >= 2) {
        _ctx.drawImage(_screenVideo, 0, 0, w, h);
    }

    if (
        _camEnabled &&
        _webcamVideo &&
        _webcamVideo.readyState >= 2 &&
        _bubbleCanvas &&
        _bubbleCtx &&
        _bubbleMask
    ) {
        const d = _bubbleCanvas.width;
        const { x, y } = bubbleCoords(_bubblePos, w, h);
        const ix = Math.round(x);
        const iy = Math.round(y);

        // Centre-crop the webcam frame to a square — matches the preview's object-cover.
        const vw = _webcamVideo.videoWidth || d;
        const vh = _webcamVideo.videoHeight || d;
        const side = Math.min(vw, vh);
        const sx = (vw - side) / 2;
        const sy = (vh - side) / 2;

        // Mask the bubble on its own canvas: draw the square, then keep only the
        // feathered circle via destination-in. The result has a soft alpha edge,
        // so blitting it onto the main canvas blends cleanly — no clip() seam.
        const bc = _bubbleCtx;
        bc.globalCompositeOperation = 'source-over';
        bc.clearRect(0, 0, d, d);
        bc.drawImage(_webcamVideo, sx, sy, side, side, 0, 0, d, d);
        bc.globalCompositeOperation = 'destination-in';
        bc.fillStyle = _bubbleMask;
        bc.fillRect(0, 0, d, d);
        bc.globalCompositeOperation = 'source-over';

        _ctx.drawImage(_bubbleCanvas, ix, iy);
    }

    _canvasCaptureTrack?.requestFrame();
}

function cleanup(): void {
    // The screen stream is owned by the recorder; the raw webcam stream is owned
    // upstream (+page) and is intentionally NOT stopped here so it survives a
    // resume. Only the mic stream acquired below belongs to the recorder.
    if (_screenStream) {
        _screenStream.getTracks().forEach((t) => t.stop());
        _screenStream = null;
    }
    if (_screenVideo) {
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
    _bubbleCanvas = null;
    _bubbleCtx = null;
    _bubbleMask = null;
}

// ─── public API ───────────────────────────────────────────────────────────────

export async function start(options: RecorderOptions): Promise<void> {
    const { screenStream, webcamStream, micDeviceId, bubblePosition, micMuted, camEnabled } =
        options;
    _camEnabled = camEnabled;
    _bubblePos = bubblePosition;
    _chunks = [];

    // Screen video for drawImage
    _screenStream = screenStream;
    _screenVideo = document.createElement('video');
    _screenVideo.srcObject = screenStream;
    _screenVideo.muted = true;
    await _screenVideo.play();

    // Canvas — dimensions set after the screen video is ready (below).
    // alpha: false → opaque output, so the recorded WebM has no alpha plane.
    // VP9-with-alpha crashes ffmpeg.wasm during the multi-segment re-encode, and
    // the composite is always fully opaque anyway (the screen fills every frame).
    _canvas = document.createElement('canvas');
    _ctx = _canvas.getContext('2d', { alpha: false })!;

    // Audio graph: system audio (from the screen stream) + mic, mixed into one track
    _audioCtx = new AudioContext();
    await _audioCtx.resume().catch(() => {});
    _destination = _audioCtx.createMediaStreamDestination();

    const screenAudioTracks = screenStream.getAudioTracks();
    if (screenAudioTracks.length) {
        _audioCtx.createMediaStreamSource(new MediaStream(screenAudioTracks)).connect(_destination);
    }

    // Webcam video — reuse the stream already acquired upstream. Never open a
    // second camera capture (wasteful, and some webcams reject a concurrent open).
    const webcamVideoStream = options.processedWebcamStream ?? webcamStream;
    if (camEnabled && webcamVideoStream) {
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

    // Size the canvas now that the screen video's intrinsic dimensions are known
    const { width, height } = cappedDimensions(
        _screenVideo.videoWidth || 1920,
        _screenVideo.videoHeight || 1080
    );
    _canvas.width = width;
    _canvas.height = height;

    // Pre-build the bubble's offscreen canvas + feathered circular mask once the
    // frame height (and therefore bubble diameter) is known.
    if (camEnabled && _webcamVideo) {
        const d = Math.max(2, Math.round(height * BUBBLE_FRAC));
        _bubbleCanvas = document.createElement('canvas');
        _bubbleCanvas.width = d;
        _bubbleCanvas.height = d;
        _bubbleCtx = _bubbleCanvas.getContext('2d')!;
        const r = d / 2;
        const feather = Math.max(1, r * 0.03);
        _bubbleMask = _bubbleCtx.createRadialGradient(r, r, 0, r, r, r);
        _bubbleMask.addColorStop(0, 'rgba(0,0,0,1)');
        _bubbleMask.addColorStop(Math.max(0, (r - feather) / r), 'rgba(0,0,0,1)');
        _bubbleMask.addColorStop(1, 'rgba(0,0,0,0)');
    }

    // Canvas stream + mixed audio → MediaRecorder
    const canvasStream = _canvas.captureStream(0); // 0 = manual frame control
    _canvasCaptureTrack = canvasStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    _destination.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));

    _recorder = new MediaRecorder(canvasStream, {
        mimeType: getSupportedMimeType(),
        videoBitsPerSecond: VIDEO_BPS_OPTIONS['high'],
        audioBitsPerSecond: AUDIO_BPS_OPTIONS['high']
    });
    _recorder.ondataavailable = (e) => {
        if (e.data.size > 0) _chunks.push(e.data);
    };

    _intervalId = setInterval(drawFrame, 1000 / 30);
    _recorder.start(500);
    _recordingStartTime = Date.now();
}

export function stop(): Promise<Blob> {
    const durationMs = Date.now() - _recordingStartTime;
    return new Promise((resolve) => {
        if (!_recorder) {
            resolve(new Blob([], { type: 'video/webm' }));
            return;
        }
        if (_intervalId !== null) {
            clearInterval(_intervalId);
            _intervalId = null;
        }
        // Stop the screen stream immediately to release the browser sharing indicator.
        if (_screenStream) {
            _screenStream.getTracks().forEach((t) => t.stop());
            _screenStream = null;
        }
        if (_userStream) {
            _userStream.getTracks().forEach((t) => t.stop());
            _userStream = null;
        }
        _recorder.onstop = async () => {
            const blob = new Blob(_chunks, { type: 'video/webm' });
            const fixedBlob = await fixWebmDuration(blob, durationMs);
            cleanup();
            resolve(fixedBlob);
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
}

export function setBubblePosition(pos: BubblePosition): void {
    _bubblePos = pos;
}
