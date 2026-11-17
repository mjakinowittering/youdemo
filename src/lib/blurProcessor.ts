import {
    FilesetResolver,
    ImageSegmenter,
    type ImageSegmenterResult
} from '@mediapipe/tasks-vision';

import type { BlurMessage, BlurReply } from './blur.worker.js';
import { canProcessInWorker, frameTrack, trackFrames } from './trackFrames.js';

export type BlurIntensity = 'light' | 'default' | 'heavy';

interface BlurConfig {
    blurRadius: number;
}

const BLUR_CONFIG: Record<BlurIntensity, BlurConfig> = {
    light: { blurRadius: 4 },
    default: { blurRadius: 10 },
    heavy: { blurRadius: 20 }
};

export interface BlurProcessor {
    outputStream: MediaStream;
    setIntensity(intensity: BlurIntensity): void;
    destroy(): void;
}

/**
 * Blurs the background of `rawStream`'s video. In a Worker where the browser
 * can hand it the camera's frames; on the main thread otherwise, or if the
 * Worker can't start.
 */
export async function createBlurProcessor(
    rawStream: MediaStream,
    intensity: BlurIntensity,
    basePath: string = ''
): Promise<BlurProcessor> {
    if (canProcessInWorker()) {
        try {
            return await createWorkerBlur(rawStream, intensity, basePath);
        } catch (e) {
            console.error('Background blur is running on the main thread:', e);
        }
    }
    return createMainThreadBlur(rawStream, intensity, basePath);
}

// Every camera frame goes to the Worker as it arrives, and comes back blurred
// on a track of its own: no timer, and nothing on the main thread per frame.
async function createWorkerBlur(
    rawStream: MediaStream,
    intensity: BlurIntensity,
    basePath: string
): Promise<BlurProcessor> {
    const camera = rawStream.getVideoTracks()[0];
    const output = frameTrack();
    // A clone, so stopping it ends only the Worker's reading
    const source = camera?.clone();
    const frames = source ? trackFrames(source) : null;
    if (!source || !frames || !output) {
        source?.stop();
        output?.track.stop();
        throw new Error('The camera frames could not be read');
    }
    const worker = new Worker(new URL('./blur.worker.ts', import.meta.url), { type: 'module' });
    const tell = (message: BlurMessage, transfer: Transferable[] = []) =>
        worker.postMessage(message, transfer);
    const destroy = () => {
        worker.terminate();
        source.stop();
        output.track.stop();
    };
    try {
        await new Promise<void>((resolve, reject) => {
            worker.onmessage = ({ data }: MessageEvent<BlurReply>) =>
                data.type === 'ready' ? resolve() : reject(new Error(data.reason));
            worker.onerror = (e) => reject(new Error(e.message));
            tell(
                {
                    type: 'start',
                    frames,
                    output: output.writable,
                    assets: location.origin + basePath,
                    blurRadius: BLUR_CONFIG[intensity].blurRadius
                },
                [frames, output.writable]
            );
        });
    } catch (e) {
        destroy();
        throw e;
    }
    return {
        outputStream: new MediaStream([output.track]),
        setIntensity(newIntensity: BlurIntensity) {
            tell({ type: 'blurRadius', blurRadius: BLUR_CONFIG[newIntensity].blurRadius });
        },
        destroy
    };
}

async function createMainThreadBlur(
    rawStream: MediaStream,
    intensity: BlurIntensity,
    basePath: string
): Promise<BlurProcessor> {
    const vision = await FilesetResolver.forVisionTasks(`${basePath}/mediapipe/wasm`);

    const createSegmenter = (delegate: 'GPU' | 'CPU') =>
        ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `${basePath}/mediapipe/models/selfie_segmenter.tflite`,
                delegate
            },
            runningMode: 'VIDEO',
            outputCategoryMask: false,
            outputConfidenceMasks: true
        });

    // GPU is markedly faster to initialise and per-frame than CPU; fall back to
    // CPU where WebGL/GPU delegation is unavailable.
    let segmenter: ImageSegmenter;
    try {
        segmenter = await createSegmenter('GPU');
    } catch {
        segmenter = await createSegmenter('CPU');
    }

    const video = document.createElement('video');
    video.srcObject = rawStream;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    await new Promise<void>((resolve) => {
        if (video.readyState >= 2) {
            resolve();
            return;
        }
        video.oncanplay = () => resolve();
    });

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const outputStream = canvas.captureStream(0);
    const canvasTrack = outputStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;

    // Pre-allocate offscreen canvases and the mask buffer — reused every frame.
    // Allocating a fresh ImageData per frame (~1.2MB at 640×480) was ~36MB/s of
    // garbage; reusing one buffer removes that GC pressure.
    const maskCanvas = new OffscreenCanvas(width, height);
    const maskCtx = maskCanvas.getContext('2d')!;
    const tempCanvas = new OffscreenCanvas(width, height);
    const tempCtx = tempCanvas.getContext('2d')!;
    const maskImageData = maskCtx.createImageData(width, height);

    let currentConfig: BlurConfig = BLUR_CONFIG[intensity];
    let busy = false;

    function handleResult(result: ImageSegmenterResult) {
        const masks = result.confidenceMasks;
        if (!masks || masks.length === 0) {
            result.close();
            busy = false;
            return;
        }

        // Binary selfie segmenter: one mask (person confidence) or two (bg + person).
        // Last index is always the person/foreground confidence.
        const personMask = masks[masks.length - 1];
        const confidence = personMask.getAsFloat32Array();
        masks.forEach((m) => m.close());
        result.close();

        // 1. Draw blurred full frame as background
        ctx.save();
        ctx.filter = `blur(${currentConfig.blurRadius}px)`;
        ctx.drawImage(video, 0, 0, width, height);
        ctx.restore();

        // 2. Build soft alpha mask from person confidence (0.0–1.0 → 0–255)
        //    Confidence values already have soft edges at the person boundary.
        for (let i = 0; i < confidence.length; i++) {
            maskImageData.data[i * 4 + 3] = Math.round(confidence[i] * 255);
        }
        maskCtx.putImageData(maskImageData, 0, 0);

        // 3. Draw sharp frame into temp canvas, then clip to person mask
        tempCtx.clearRect(0, 0, width, height);
        tempCtx.drawImage(video, 0, 0, width, height);
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(maskCanvas, 0, 0);
        tempCtx.globalCompositeOperation = 'source-over';

        // 4. Composite sharp person over blurred background
        ctx.drawImage(tempCanvas, 0, 0);

        canvasTrack.requestFrame();
        busy = false;
    }

    function drawFrame() {
        // Skip if the previous segmentation is still in flight — otherwise slow
        // passes stack up and saturate the CPU/GPU.
        if (busy || video.readyState < 2) return;
        busy = true;
        try {
            // Callback form — required for VIDEO mode; synchronous form may not fire the graph.
            segmenter.segmentForVideo(video, performance.now(), handleResult);
        } catch {
            busy = false;
        }
    }

    const intervalId = setInterval(drawFrame, 1000 / 30);

    return {
        outputStream,
        setIntensity(newIntensity: BlurIntensity) {
            currentConfig = BLUR_CONFIG[newIntensity];
        },
        destroy() {
            clearInterval(intervalId);
            segmenter.close();
            video.pause();
            video.srcObject = null;
            outputStream.getTracks().forEach((t) => t.stop());
        }
    };
}
