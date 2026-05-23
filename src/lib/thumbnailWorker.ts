/// <reference lib="WebWorker" />

// Superseded by main-thread video seeking in Editor.svelte.
// HTMLVideoElement is not available in Web Workers, so the keyframe-parsing
// approach this worker used was unreliable. Thumbnail generation now runs on
// the main thread using a hidden <video> element + seek/capture loop.

self.onmessage = () => {
    self.postMessage({ type: 'done' });
};
