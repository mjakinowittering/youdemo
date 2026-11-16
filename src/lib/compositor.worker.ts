/**
 * The recorder's compositing, off the main thread: reads the screen's and the
 * webcam's frames as they arrive, draws one frame of the recording for every
 * screen frame, and writes it to the track MediaRecorder encodes. The page's
 * own work (layout, the Recording screen, a busy tab) can't hold a frame up.
 */
import type { BubblePosition } from './bubbleGeometry.js';
import { createBubble, drawComposite, type Bubble } from './composite.js';
import type { WorkerScope } from './trackFrames.js';
import type { Margins } from './windowCrop.js';

export type CompositorMessage =
    | {
          type: 'start';
          screen: ReadableStream<VideoFrame>;
          webcam: ReadableStream<VideoFrame> | null;
          /** What the screen shows at the start, drawn until its first frame arrives. */
          firstScreen: VideoFrame;
          output: WritableStream<VideoFrame>;
          width: number;
          height: number;
          margins: Margins;
          camEnabled: boolean;
          bubblePosition: BubblePosition;
          /** One frame of the recording, and how long a silent screen is quiet, in ms. */
          frameMs: number;
          quietMs: number;
      }
    | { type: 'margins'; margins: Margins }
    | { type: 'camEnabled'; camEnabled: boolean }
    | { type: 'bubblePosition'; bubblePosition: BubblePosition };

const scope = self as unknown as WorkerScope<CompositorMessage>;

let ctx: OffscreenCanvasRenderingContext2D | null = null;
let canvas: OffscreenCanvas | null = null;
let bubble: Bubble | null = null;
let writer: WritableStreamDefaultWriter<VideoFrame> | null = null;
let margins: Margins = { top: 0, right: 0, bottom: 0, left: 0 };
let camEnabled = false;
let bubblePosition: BubblePosition = 'tr';
// The newest frame of each, kept to redraw; the one before is closed
let lastScreen: VideoFrame | null = null;
let lastWebcam: VideoFrame | null = null;
let lastScreenAt = 0;

function drawFrame(): void {
    if (!ctx || !canvas || !writer) return;
    drawComposite(
        ctx,
        canvas.width,
        canvas.height,
        lastScreen && {
            source: lastScreen,
            width: lastScreen.displayWidth,
            height: lastScreen.displayHeight
        },
        margins,
        camEnabled && lastWebcam
            ? {
                  source: lastWebcam,
                  width: lastWebcam.displayWidth,
                  height: lastWebcam.displayHeight
              }
            : null,
        bubble,
        bubblePosition
    );
    // Opaque, like the canvas: an alpha plane breaks tooling downstream
    const frame = new VideoFrame(canvas, {
        timestamp: Math.round(performance.now() * 1000),
        alpha: 'discard'
    });
    writer.write(frame).catch(() => frame.close());
}

// One frame of the recording per screen frame, as it arrives
async function drawScreenFrames(reader: ReadableStreamDefaultReader<VideoFrame>): Promise<void> {
    for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        lastScreen?.close();
        lastScreen = value;
        lastScreenAt = performance.now();
        drawFrame();
    }
}

// The webcam only updates the bubble's picture; the screen sets the pace
async function keepWebcamFrames(reader: ReadableStreamDefaultReader<VideoFrame>): Promise<void> {
    for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        lastWebcam?.close();
        lastWebcam = value;
    }
}

scope.onmessage = ({ data }) => {
    if (data.type === 'margins') margins = data.margins;
    else if (data.type === 'camEnabled') camEnabled = data.camEnabled;
    else if (data.type === 'bubblePosition') bubblePosition = data.bubblePosition;
    else {
        canvas = new OffscreenCanvas(data.width, data.height);
        ctx = canvas.getContext('2d', { alpha: false });
        if (data.webcam) bubble = createBubble(new OffscreenCanvas(2, 2), data.height);
        writer = data.output.getWriter();
        ({ margins, camEnabled, bubblePosition } = data);
        lastScreen = data.firstScreen;
        lastScreenAt = performance.now();
        // Either stream ends with its track; the timer below draws on
        drawScreenFrames(data.screen.getReader()).catch(() => {});
        if (data.webcam) keepWebcamFrames(data.webcam.getReader()).catch(() => {});
        // While the screen is still it sends nothing, and the bubble has to keep
        // moving: then this timer draws, until a screen frame arrives
        const { frameMs, quietMs } = data;
        setInterval(() => {
            if (performance.now() - lastScreenAt > quietMs) drawFrame();
        }, frameMs);
    }
};
