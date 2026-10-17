import { expect, test } from './fixtures/app';

test('reloading mid-recording recovers the finished takes into the editor', async ({ app }) => {
    const { page } = app;
    await app.recordTake(2);
    await app.button(/^Record take \d+$/).click();
    await expect(app.stopButton).toBeVisible({ timeout: 10_000 });
    await page.reload();
    // The unfinished take is lost; the saved one opens straight in the editor.
    await expect(app.exportButton).toBeEnabled({ timeout: 30_000 });
    await expect(app.cells.first()).toBeVisible();
});

test('exporting keeps the takes; New recording starts from a clean slate', async ({ app }) => {
    const { page } = app;
    await app.recordTake(1.5);
    await app.openEditor();
    await app.exportAndDownload();
    await expect(page).toHaveTitle('Exported | YouDemo');
    await expect(page.getByText(/Saved youdemo-.*to your downloads/)).toBeVisible();
    // Export no longer clears crash recovery
    expect(await app.opfsTakeCount()).toBe(1);

    await app.button('New recording').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Start new' }).click();
    await expect(app.chooseButton).toBeVisible();
    expect(await app.opfsTakeCount()).toBe(0);
    await page.reload();
    await expect(app.chooseButton).toBeVisible();
});

test('an unexpected error shows the error screen, which reloads the app', async ({ app }) => {
    const { page } = app;
    await expect(app.chooseButton).toBeVisible();
    await page.evaluate(() => setTimeout(() => Promise.reject(new Error('e2e boom'))));
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    await expect(page).toHaveTitle('Something went wrong | YouDemo');
    await expect(page.getByText('YouDemo ran into an unexpected error.')).toBeVisible();
    await page.getByText('Technical details').click();
    await expect(page.getByText(/e2e boom/)).toBeVisible();
    await app.button('Reload YouDemo').click();
    await expect(app.chooseButton).toBeVisible();
});
