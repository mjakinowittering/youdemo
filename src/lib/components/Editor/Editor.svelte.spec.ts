import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';

import { addCut, emptyHistory } from '$lib/editorMath.js';

import Editor from './Editor.svelte';

const name = 'youdemo-2026-10-17-215000.webm';

// Exported with one cut, so Undo has something to step to
function renderExported() {
    const history = addCut(emptyHistory(), { startTime: 1, endTime: 2 });
    return render(Editor, {
        videoUrl: null,
        phase: 'ready',
        takeCount: 1,
        history,
        exported: { name, edits: history.edits },
        onback: () => {},
        onexport: () => {},
        ondiscard: () => {}
    });
}

describe('the Exported notice', () => {
    it('stays through play, zoom and trim mode', async () => {
        const screen = renderExported();
        const notice = screen.getByRole('status');
        await expect.element(notice).toHaveTextContent(name);

        await screen.getByRole('button', { name: 'Play' }).click();
        await screen.getByRole('button', { name: 'Pause' }).click();
        await screen.getByRole('button', { name: 'Zoom out' }).click();
        await screen.getByRole('button', { name: 'Zoom in' }).click();
        await screen.getByRole('button', { name: 'Trim' }).click();
        await screen.getByRole('button', { name: 'Done trimming' }).click();

        await expect.element(notice).toHaveTextContent(name);
    });

    it('closes when the edit changes', async () => {
        const screen = renderExported();
        await expect.element(screen.getByRole('status')).toBeInTheDocument();

        await screen.getByRole('button', { name: 'Undo' }).click();

        await expect.element(screen.getByRole('status')).not.toBeInTheDocument();
    });

    it('closes when dismissed', async () => {
        const screen = renderExported();
        await screen.getByRole('button', { name: 'Dismiss' }).click();

        await expect.element(screen.getByRole('status')).not.toBeInTheDocument();
    });
});
