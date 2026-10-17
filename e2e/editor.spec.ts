import { SAMPLE_INTERVAL } from '../src/lib/editorMath';

import { expect, test } from './fixtures/app';

test('three takes open as one timeline, as long as all three together', async ({ app }) => {
    for (let i = 0; i < 3; i++) await app.recordTake(2);
    const takes = await app.readTakes(3);
    await app.openEditor();
    await expect(app.page).toHaveTitle('Editing | YouDemo');
    // The strip has one cell per SAMPLE_INTERVAL of the joined recording.
    const cells = await app.cells.count();
    expect(cells * SAMPLE_INTERVAL).toBeGreaterThan(3 * 2 - 0.5);
    expect(takes).toHaveLength(3);
});

test('cuts shorten the final duration and survive Back to review', async ({ app }) => {
    await app.recordTake(4);
    await app.openEditor();
    const before = await app.finalDuration();
    // 10 cells × 0.2 s = 2 s, enough to move the whole-second read-out.
    await app.cut(5, 14);
    const after = await app.finalDuration();
    expect(after).toBeLessThan(before);

    await app.exportAndDownload();
    await expect(app.page.getByText(/Saved youdemo-.*to your downloads/)).toBeVisible();
    await app.button('Back to review').click();
    await app.openEditor();
    expect(await app.finalDuration()).toBe(after);
    await expect(app.button(/^Restore cut, /)).toHaveCount(1);
});

test('a cut can be undone, redone and restored', async ({ app }) => {
    await app.recordTake(3);
    await app.openEditor();
    const full = await app.cells.count();
    await app.cut(4, 8);
    await expect(app.cells).toHaveCount(full - 5);
    await app.button('Undo').click();
    await expect(app.cells).toHaveCount(full);
    await app.button('Redo').click();
    await expect(app.cells).toHaveCount(full - 5);
    await app.button(/^Restore cut, /).click();
    await expect(app.cells).toHaveCount(full);
});

test('cutting every cell leaves nothing to export', async ({ app }) => {
    await app.recordTake(1.5);
    await app.openEditor();
    const last = (await app.cells.count()) - 1;
    await app.cut(0, last);
    await expect(app.cells).toHaveCount(0);
    expect(await app.finalDuration()).toBe(0);
});
