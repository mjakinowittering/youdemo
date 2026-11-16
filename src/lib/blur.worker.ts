/**
 * Background blur, off the main thread: segments each webcam frame as it
 * arrives (MediaPipe, GPU), draws the person sharp over the blurred frame and
 * writes the result to the track the preview and the recorder show.
 */
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

import type { WorkerScope } from './trackFrames.js';

export type BlurMessage =
    | {
          type: 'start';
          frames: ReadableStream<VideoFrame>;
          output: WritableStream<VideoFrame>;
          /** Where `mediapipe/` is served, as an absolute URL. */
          assets: string;
          blurRadius: number;
      }
    | { type: 'blurRadius'; blurRadius: number };

/** Sent once: the segmenter is running, or why it can't. */
export type BlurReply = { type: 'ready' } | { type: 'failed'; reason: string };

const scope = self as unknown as WorkerScope<BlurMessage>;

let blurRadius = 0;

/**
 * Draws a confidence mask (a float texture, upright from the bottom row) as
 * alpha on the segmenter's own canvas, so a 2D canvas can clip with it. The
 * mask never leaves the GPU: reading it back and writing ~307k pixels in a
 * loop was the slowest part of each frame.
 */
function maskPainter(gl: WebGL2RenderingContext): (mask: WebGLTexture) => void {
    const shader = (type: number, source: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, source);
        gl.compileShader(s);
        return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(
        program,
        shader(
            gl.VERTEX_SHADER,
            `#version 300 es
            in vec2 corner;
            out vec2 uv;
            void main() {
                uv = vec2(corner.x * 0.5 + 0.5, 0.5 - corner.y * 0.5);
                gl_Position = vec4(corner, 0.0, 1.0);
            }`
        )
    );
    gl.attachShader(
        program,
        shader(
            gl.FRAGMENT_SHADER,
            `#version 300 es
            precision mediump float;
            uniform sampler2D mask;
            in vec2 uv;
            out vec4 colour;
            void main() {
                colour = vec4(0.0, 0.0, 0.0, texture(mask, uv).r);
            }`
        )
    );
    gl.bindAttribLocation(program, 0, 'corner');
    gl.linkProgram(program);

    // The context is MediaPipe's too: put back everything touched
    const array = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
    const buffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    const corners = gl.createVertexArray();
    gl.bindVertexArray(corners);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(array);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    return (mask) => {
        const before = {
            program: gl.getParameter(gl.CURRENT_PROGRAM),
            array: gl.getParameter(gl.VERTEX_ARRAY_BINDING),
            framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING),
            unit: gl.getParameter(gl.ACTIVE_TEXTURE),
            viewport: gl.getParameter(gl.VIEWPORT) as Int32Array,
            blend: gl.isEnabled(gl.BLEND),
            scissor: gl.isEnabled(gl.SCISSOR_TEST)
        };
        gl.activeTexture(gl.TEXTURE0);
        const texture = gl.getParameter(gl.TEXTURE_BINDING_2D);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.disable(gl.BLEND);
        gl.disable(gl.SCISSOR_TEST);
        gl.useProgram(program);
        gl.bindVertexArray(corners);
        gl.bindTexture(gl.TEXTURE_2D, mask);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.activeTexture(before.unit);
        gl.bindVertexArray(before.array);
        gl.useProgram(before.program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, before.framebuffer);
        gl.viewport(before.viewport[0], before.viewport[1], before.viewport[2], before.viewport[3]);
        if (before.blend) gl.enable(gl.BLEND);
        if (before.scissor) gl.enable(gl.SCISSOR_TEST);
    };
}

async function run(message: Extract<BlurMessage, { type: 'start' }>): Promise<void> {
    // Ours first, with alpha: the mask is drawn into it. MediaPipe then gets
    // this same context when it asks the canvas for one.
    const maskCanvas = new OffscreenCanvas(2, 2);
    const gl = maskCanvas.getContext('webgl2', { alpha: true, antialias: false });
    if (!gl) throw new Error('WebGL 2 is not available in a Worker');

    // The module build of the runtime: a module Worker has no importScripts
    const vision = await FilesetResolver.forVisionTasks(`${message.assets}/mediapipe/wasm`, true);
    const segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `${message.assets}/mediapipe/models/selfie_segmenter.tflite`,
            delegate: 'GPU'
        },
        canvas: maskCanvas,
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true
    });
    const paintMask = maskPainter(gl);
    scope.postMessage({ type: 'ready' } satisfies BlurReply);

    // Sized by the first frame, then reused for every one
    const out = new OffscreenCanvas(2, 2);
    const ctx = out.getContext('2d', { alpha: false })!;
    const person = new OffscreenCanvas(2, 2);
    const personCtx = person.getContext('2d')!;

    const reader = message.frames.getReader();
    const writer = message.output.getWriter();
    // One frame at a time: while one is segmented the track keeps only its
    // newest frame, so slow passes drop frames instead of stacking up
    for (;;) {
        const { done, value: frame } = await reader.read();
        if (done) return;
        const width = frame.displayWidth;
        const height = frame.displayHeight;
        if (out.width !== width || out.height !== height) {
            for (const canvas of [out, person, maskCanvas]) {
                canvas.width = width;
                canvas.height = height;
            }
        }
        let drawn = false;
        // Callback form — required for VIDEO mode; the masks only live inside it
        segmenter.segmentForVideo(frame, performance.now(), (result) => {
            // One mask (person) or two (background + person): the last is the person
            const mask = result.confidenceMasks?.at(-1);
            if (mask) {
                paintMask(mask.getAsWebGLTexture());

                // 1. The whole frame, blurred, as background
                ctx.filter = `blur(${blurRadius}px)`;
                ctx.drawImage(frame, 0, 0, width, height);
                ctx.filter = 'none';

                // 2. The sharp frame, kept only where the mask says person. Its
                //    confidence values are already soft at the person's edge.
                personCtx.globalCompositeOperation = 'source-over';
                personCtx.clearRect(0, 0, width, height);
                personCtx.drawImage(frame, 0, 0, width, height);
                personCtx.globalCompositeOperation = 'destination-in';
                personCtx.drawImage(maskCanvas, 0, 0, width, height);

                // 3. The sharp person over the blurred background
                ctx.drawImage(person, 0, 0);
                drawn = true;
            }
            result.close();
        });
        if (drawn) {
            const blurred = new VideoFrame(out, { timestamp: frame.timestamp, alpha: 'discard' });
            writer.write(blurred).catch(() => blurred.close());
        }
        frame.close();
    }
}

scope.onmessage = ({ data }) => {
    blurRadius = data.blurRadius;
    if (data.type === 'start') {
        run(data).catch((e: unknown) =>
            scope.postMessage({
                type: 'failed',
                reason: e instanceof Error ? e.message : String(e)
            } satisfies BlurReply)
        );
    }
};
