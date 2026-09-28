import { expect, test } from './fixtures/app';

test('reloading mid-recording recovers the finished takes into the editor', async ({ app }) => {
    const { page } = app;
    await app.recordTake(2);
    await app.card(/Resume recording/).click();
    await expect(page.getByText('REC', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.reload();
    // The unfinished take is lost; the saved one opens straight in the editor.
    await expect(app.exportButton).toBeVisible({ timeout: 30_000 });
    await expect(app.cells.first()).toBeVisible();
});

test('New Recording after an export starts from a clean slate', async ({ app }) => {
    await app.recordTake(1.5);
    await app.openEditor();
    await app.exportAndDownload();
    await expect(app.page).toHaveTitle('Download ready | YouDemo');
    await app.page.getByRole('button', { name: 'New Recording' }).click();
    await expect(app.card(/No screen selected/)).toBeVisible();
    expect(await app.opfsTakeCount()).toBe(0);
    await app.page.reload();
    await expect(app.card(/No screen selected/)).toBeVisible();
});

test('the theme toggle persists across a reload', async ({ app }) => {
    const { page } = app;
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(html).not.toHaveClass(/dark/);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Toggle theme' })).toBeVisible();
    await expect(html).not.toHaveClass(/dark/);
});

test('an unexpected error shows the error screen, which reloads the app', async ({ app }) => {
    const { page } = app;
    await expect(app.card(/No screen selected/)).toBeVisible();
    await page.evaluate(() => setTimeout(() => Promise.reject(new Error('e2e boom'))));
    await expect(page.getByText('Something went wrong')).toBeVisible();
    await expect(page).toHaveTitle('Something went wrong | YouDemo');
    await expect(page.getByText('e2e boom')).toBeVisible();
    await page.getByRole('button', { name: 'Reload YouDemo' }).click();
    await expect(app.card(/No screen selected/)).toBeVisible();
});
