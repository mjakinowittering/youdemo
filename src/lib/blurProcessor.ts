import {
    FilesetResolver,
    ImageSegmenter,
    type ImageSegmenterResult
} from '@mediapipe/tasks-vision';

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

export async function createBlurProcessor(
    rawStream: MediaStream,
    intensity: BlurIntensity,
    basePath: string = ''
): Promise<BlurProcessor> {
    const vision = await FilesetResolver.forVisionTasks(`${basePath}/mediapipe/wasm`);

    const segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `${basePath}/mediapipe/models/selfie_segmenter.tflite`,
            delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true
    });

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

    // Pre-allocate offscreen canvases — reused every frame
    const maskCanvas = new OffscreenCanvas(width, height);
    const maskCtx = maskCanvas.getContext('2d')!;
    const tempCanvas = new OffscreenCanvas(width, height);
    const tempCtx = tempCanvas.getContext('2d')!;

    let currentConfig: BlurConfig = BLUR_CONFIG[intensity];

    function handleResult(result: ImageSegmenterResult) {
        const masks = result.confidenceMasks;
        if (!masks || masks.length === 0) {
            result.close();
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
        const imageData = maskCtx.createImageData(width, height);
        for (let i = 0; i < confidence.length; i++) {
            imageData.data[i * 4 + 3] = Math.round(confidence[i] * 255);
        }
        maskCtx.putImageData(imageData, 0, 0);

        // 3. Draw sharp frame into temp canvas, then clip to person mask
        tempCtx.clearRect(0, 0, width, height);
        tempCtx.drawImage(video, 0, 0, width, height);
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(maskCanvas, 0, 0);
        tempCtx.globalCompositeOperation = 'source-over';

        // 4. Composite sharp person over blurred background
        ctx.drawImage(tempCanvas, 0, 0);

        canvasTrack.requestFrame();
    }

    function drawFrame() {
        if (video.readyState < 2) return;
        // Callback form — required for VIDEO mode; synchronous form may not fire the graph.
        segmenter.segmentForVideo(video, performance.now(), handleResult);
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
