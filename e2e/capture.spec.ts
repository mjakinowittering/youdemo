import { expect, test } from './fixtures/app';

test('picking a screen counts down, records, and stops to review', async ({ app }) => {
    const { page } = app;
    await app.card(/No screen selected/).click();
    await expect(page).toHaveTitle(/^[123]… \| YouDemo$/);
    await expect(page.getByText('REC', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveTitle(/^● REC \d\d:\d\d \| YouDemo$/);
    await page.waitForTimeout(1500);
    await app.card(/Recording in progress/).click();
    await expect(app.card(/Resume recording/)).toBeVisible();
    await expect(page).toHaveTitle('Review recording | YouDemo');
    await expect.poll(() => app.opfsTakeCount()).toBe(1);
});

test('resuming records further takes, each saved for crash recovery', async ({ app }) => {
    for (let i = 0; i < 3; i++) await app.recordTake(1.5);
    await expect.poll(() => app.opfsTakeCount()).toBe(3);
});

test('"Stop sharing" in the browser bar mid-recording returns to setup', async ({ app }) => {
    const { page } = app;
    await app.card(/No screen selected/).click();
    await expect(page.getByText('REC', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => window.__e2eDisplay!.stopSharing());
    await expect(app.card(/No screen selected/)).toBeVisible();
    await expect.poll(() => app.opfsTakeCount()).toBe(0);
});

test('discard returns to setup and forgets the takes', async ({ app }) => {
    await app.recordTake(1.5);
    await expect.poll(() => app.opfsTakeCount()).toBe(1);
    await app.card(/Discard recording/).click();
    await expect(app.card(/No screen selected/)).toBeVisible();
    await expect.poll(() => app.opfsTakeCount()).toBe(0);
});
