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

test('cuts shorten the final duration and survive a round trip to Done', async ({ app }) => {
    // Back to Editor remounts the Editor, which owns deletedRanges, so the
    // cuts are lost. Remove this marker once +page.svelte keeps them.
    test.fail(true, 'Back to Editor drops the cuts');
    await app.recordTake(4);
    await app.openEditor();
    const before = await app.finalDuration();
    await app.cut(10, 14);
    const cells = await app.cells.count();
    // 5 cells × 0.2 s = 1 s; the read-out is whole seconds.
    expect(await app.finalDuration()).toBeLessThanOrEqual(before - 1 + 0.5);

    await app.exportAndDownload();
    await expect(app.page.getByText('Download started')).toBeVisible();
    await app.page.getByRole('button', { name: 'Back to Editor' }).click();
    await expect(app.exportButton).toBeVisible();
    await expect(app.cells).toHaveCount(cells);
});

test('cutting every cell leaves nothing to export', async ({ app }) => {
    await app.recordTake(1.5);
    await app.openEditor();
    const last = (await app.cells.count()) - 1;
    await app.cut(0, last);
    await expect(app.cells).toHaveCount(0);
    expect(await app.finalDuration()).toBe(0);
});
