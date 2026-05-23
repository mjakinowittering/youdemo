import fixWebmDuration from 'fix-webm-duration';

export type BubblePosition = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'rc' | 'bc' | 'lc';

export interface RecorderOptions {
    screenStream: MediaStream;
    webcamDeviceId: string | null;
    micDeviceId: string | null;
    bubblePosition: BubblePosition;
    micMuted: boolean;
    camEnabled: boolean;
}

export interface CutRegion {
    id: string;
    start: number;
    end: number;
}

export interface ExportOptions {
    segments: Blob[];
    trimStart: number;
    trimEnd: number;
    cuts: CutRegion[];
}

// ─── constants ────────────────────────────────────────────────────────────────

const BUBBLE = 200;
const PAD = 20;

// ─── singleton state ──────────────────────────────────────────────────────────

let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
let _screenVideo: HTMLVideoElement | null = null;
let _webcamVideo: HTMLVideoElement | null = null;
let _rafId: number | null = null;
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
let _frameCount = 0;
let _lastFpsLog = 0;
let _canvasCaptureTrack: CanvasCaptureMediaStreamTrack | null = null;
let _framePushCount = 0;
let _lastFrameLog = 0;

// ─── helpers ──────────────────────────────────────────────────────────────────

function bubbleCoords(pos: BubblePosition, w: number, h: number): { x: number; y: number } {
    const cx = w / 2 - BUBBLE / 2;
    const cy = h / 2 - BUBBLE / 2;
    switch (pos) {
        case 'tl':
            return { x: PAD, y: PAD };
        case 'tr':
            return { x: w - BUBBLE - PAD, y: PAD };
        case 'bl':
            return { x: PAD, y: h - BUBBLE - PAD };
        case 'br':
            return { x: w - BUBBLE - PAD, y: h - BUBBLE - PAD };
        case 'tc':
            return { x: cx, y: PAD };
        case 'rc':
            return { x: w - BUBBLE - PAD, y: cy };
        case 'bc':
            return { x: cx, y: h - BUBBLE - PAD };
        case 'lc':
            return { x: PAD, y: cy };
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

function drawFrame(): void {
    if (!_ctx || !_canvas || !_screenVideo) return;
    const w = _canvas.width;
    const h = _canvas.height;

    _frameCount++;
    const now = Date.now();
    if (now - _lastFpsLog >= 1000) {
        console.log('[Recorder] Compositing fps:', _frameCount);
        _frameCount = 0;
        _lastFpsLog = now;
    }

    if (_screenVideo.readyState >= 2) {
        _ctx.drawImage(_screenVideo, 0, 0, w, h);
    }

    if (_camEnabled && _webcamVideo && _webcamVideo.readyState >= 2) {
        console.log('[Recorder] Drawing webcam frame — readyState:', _webcamVideo.readyState);
        const { x, y } = bubbleCoords(_bubblePos, w, h);
        _ctx.save();
        _ctx.beginPath();
        _ctx.arc(x + BUBBLE / 2, y + BUBBLE / 2, BUBBLE / 2, 0, Math.PI * 2);
        _ctx.clip();
        _ctx.drawImage(_webcamVideo, x, y, BUBBLE, BUBBLE);
        _ctx.restore();
    } else if (_camEnabled && _webcamVideo) {
        console.log(
            '[Recorder] Webcam not ready yet — skipping draw, readyState:',
            _webcamVideo.readyState
        );
    }

    _canvasCaptureTrack?.requestFrame();
    _framePushCount++;
    const nowPush = Date.now();
    if (nowPush - _lastFrameLog >= 1000) {
        console.log('[Recorder] Frames pushed to stream this second:', _framePushCount);
        _framePushCount = 0;
        _lastFrameLog = nowPush;
    }

    _rafId = requestAnimationFrame(drawFrame);
}

function cleanup(): void {
    if (_screenStream) {
        _screenStream.getTracks().forEach((track) => {
            track.stop();
            console.log('[Recorder] Screen track stopped:', track.kind, track.label);
        });
        _screenStream = null;
    }
    if (_screenVideo) {
        _screenVideo.srcObject = null;
        _screenVideo = null;
    }

    if (_userStream) {
        _userStream.getTracks().forEach((track) => {
            track.stop();
            console.log('[Recorder] Webcam/mic track stopped:', track.kind, track.label);
        });
        _userStream = null;
    }
    if (_webcamVideo) {
        _webcamVideo.srcObject = null;
        _webcamVideo = null;
    }

    console.log('[Recorder] Closing AudioContext — state was:', _audioCtx?.state);
    _audioCtx?.close();
    _audioCtx = null;
    console.log('[Recorder] AudioContext closed');
    _micNode = null;
    _destination = null;
    _recorder = null;
    _canvas = null;
    _ctx = null;
    _canvasCaptureTrack = null;
    console.log('[Recorder] stop() complete — all resources released');
}

// ─── public API ───────────────────────────────────────────────────────────────

export async function start(options: RecorderOptions): Promise<void> {
    const { screenStream, webcamDeviceId, micDeviceId, bubblePosition, micMuted, camEnabled } =
        options;
    _camEnabled = camEnabled;
    _bubblePos = bubblePosition;
    _chunks = [];

    // Canvas sized to screen track
    const track = screenStream.getVideoTracks()[0];
    const trackSettings = track.getSettings();
    console.log(
        '[Recorder] Screen track settings:',
        trackSettings.width,
        trackSettings.height,
        trackSettings.frameRate
    );
    _canvas = document.createElement('canvas');
    _canvas.width = trackSettings.width ?? 1920;
    _canvas.height = trackSettings.height ?? 1080;
    _ctx = _canvas.getContext('2d')!;
    console.log('[Recorder] Canvas dimensions set to:', _canvas.width, _canvas.height);

    // Screen video for drawImage
    _screenStream = screenStream;
    _screenVideo = document.createElement('video');
    _screenVideo.srcObject = screenStream;
    _screenVideo.muted = true;
    _screenVideo.addEventListener('loadedmetadata', () => {
        if (!_canvas!.width) {
            _canvas!.width = _screenVideo!.videoWidth;
            _canvas!.height = _screenVideo!.videoHeight;
            console.log(
                '[Recorder] Canvas dimensions from video:',
                _canvas!.width,
                _canvas!.height
            );
        }
    });
    await _screenVideo.play();

    // Audio graph
    _audioCtx = new AudioContext();
    _destination = _audioCtx.createMediaStreamDestination();

    const screenAudioTracks = screenStream.getAudioTracks();
    if (screenAudioTracks.length) {
        _audioCtx.createMediaStreamSource(new MediaStream(screenAudioTracks)).connect(_destination);
    }

    // Webcam + mic via getUserMedia — always request mic; request webcam only if camEnabled
    try {
        const userStream = await navigator.mediaDevices.getUserMedia({
            video: camEnabled
                ? webcamDeviceId
                    ? { deviceId: { ideal: webcamDeviceId } }
                    : true
                : false,
            audio: micDeviceId ? { deviceId: { ideal: micDeviceId } } : true
        });
        _userStream = userStream;

        const videoTracks = userStream.getVideoTracks();
        if (videoTracks.length && camEnabled) {
            _webcamVideo = document.createElement('video');
            _webcamVideo.srcObject = new MediaStream(videoTracks);
            _webcamVideo.muted = true;
            _webcamVideo.play();
        }

        const audioTracks = userStream.getAudioTracks();
        if (audioTracks.length) {
            _micNode = _audioCtx.createMediaStreamSource(new MediaStream(audioTracks));
            if (!micMuted) _micNode.connect(_destination);
        }
    } catch {
        // silently continue without user media
    }

    // Wait for both video elements to be drawable before starting
    const readyPromises: Promise<void>[] = [
        new Promise<void>((resolve) => {
            if (_screenVideo!.readyState >= 2) resolve();
            else _screenVideo!.addEventListener('canplay', () => resolve(), { once: true });
        })
    ];
    if (_webcamVideo) {
        readyPromises.push(
            new Promise<void>((resolve) => {
                if (_webcamVideo!.readyState >= 2) resolve();
                else _webcamVideo!.addEventListener('canplay', () => resolve(), { once: true });
            })
        );
    }
    await Promise.all(readyPromises);
    console.log('[Recorder] Both video elements ready — starting rAF loop and MediaRecorder');

    // Canvas stream + mixed audio → MediaRecorder
    const canvasStream = _canvas.captureStream(0); // 0 = manual frame control
    console.log('[Recorder] Canvas stream created in manual frame mode');
    _canvasCaptureTrack = canvasStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    _framePushCount = 0;
    _lastFrameLog = Date.now();
    _destination.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));

    const mimeType = getSupportedMimeType();
    console.log('[Recorder] Using mimeType:', mimeType);
    _recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 8_000_000,
        audioBitsPerSecond: 128_000
    });
    console.log(
        '[Recorder] MediaRecorder created — videoBitsPerSecond:',
        _recorder.videoBitsPerSecond
    );
    console.log(
        '[Recorder] MediaRecorder created — audioBitsPerSecond:',
        _recorder.audioBitsPerSecond
    );
    _recorder.ondataavailable = (e) => {
        if (e.data.size > 0) _chunks.push(e.data);
    };
    _recorder.start(500);
    console.log('[Recorder] MediaRecorder started with 500ms timeslice');
    _recordingStartTime = Date.now();

    _frameCount = 0;
    _lastFpsLog = Date.now();
    drawFrame();
}

export function stop(): Promise<Blob> {
    const durationMs = Date.now() - _recordingStartTime;
    return new Promise((resolve) => {
        console.log('[Recorder] stop() called — durationMs:', durationMs);
        if (!_recorder) {
            console.log('[Recorder] No MediaRecorder — resolving with empty blob');
            resolve(new Blob([], { type: 'video/webm' }));
            return;
        }
        console.log('[Recorder] Stopping MediaRecorder — state was:', _recorder.state);
        console.log('[Recorder] Cancelling requestAnimationFrame loop — rafId:', _rafId);
        if (_rafId !== null) {
            cancelAnimationFrame(_rafId);
            _rafId = null;
        }
        console.log('[Recorder] rAF loop cancelled');
        _recorder.onstop = async () => {
            console.log(
                '[Recorder] MediaRecorder stopped — building blob from',
                _chunks.length,
                'chunks'
            );
            const blob = new Blob(_chunks, { type: 'video/webm' });
            console.log('[Recorder] Blob built:', blob.size, 'bytes — fixing WebM duration...');
            const fixedBlob = await fixWebmDuration(blob, durationMs);
            console.log('[Recorder] Duration fixed — running cleanup()');
            cleanup();
            resolve(fixedBlob);
        };
        if (_recorder.state !== 'inactive') _recorder.stop();
        else {
            console.log('[Recorder] MediaRecorder already inactive — triggering onstop manually');
            _recorder.onstop(new Event('stop'));
        }
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
