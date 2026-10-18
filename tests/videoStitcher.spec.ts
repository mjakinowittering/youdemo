import { describe, expect, it, vi } from 'vitest';

import { renderEditedVideo, stitchSegments } from '$lib/videoStitcher.js';

// Nothing to do returns the recording itself, without reading it or reporting
// progress: the Editor then downloads it straight away, with no exporting phase.
describe('export with nothing to do', () => {
    const blob = new Blob(['not a webm'], { type: 'video/webm' });

    it('returns the take as is when there is only one', async () => {
        const onProgress = vi.fn();
        expect(await stitchSegments([blob], onProgress)).toBe(blob);
        expect(onProgress).not.toHaveBeenCalled();
    });

    it('returns the recording as is when there are no cuts', async () => {
        const onProgress = vi.fn();
        expect(await renderEditedVideo(blob, [], onProgress)).toBe(blob);
        expect(onProgress).not.toHaveBeenCalled();
    });
});
