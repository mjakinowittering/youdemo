import { expect, test } from './fixtures/app';

test('choosing a share counts down, records, and stops to review', async ({ app }) => {
    const { page } = app;
    await app.chooseButton.click();
    await expect(page).toHaveTitle(/^[123]… \| YouDemo$/);
    await expect(app.stopButton).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveTitle(/^● REC \d\d:\d\d \| YouDemo$/);
    // The live preview plays the composited frame being encoded.
    const preview = page.getByLabel('Live recording preview');
    await expect(preview).toBeVisible();
    await expect
        .poll(() => preview.evaluate((v: HTMLVideoElement) => v.readyState))
        .toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(1500);
    await app.stopButton.click();
    await expect(app.reviewHeading).toHaveText(/^1 take, /);
    await expect(page).toHaveTitle('Review recording | YouDemo');
    await expect.poll(() => app.opfsTakeCount()).toBe(1);
});

test('Cancel during the countdown goes back to Setup', async ({ app }) => {
    await app.chooseButton.click();
    await app.button('Cancel').click();
    await expect(app.chooseButton).toBeVisible();
    await expect(app.stopButton).toBeHidden();
});

test('Record take N reuses the live share, and each take is saved', async ({ app }) => {
    const { page } = app;
    for (let i = 0; i < 3; i++) await app.recordTake(1.5);
    await expect(app.reviewHeading).toHaveText(/^3 takes, /);
    await expect(page.getByText(/^Next take shares /)).toBeVisible();
    // One picker, three takes
    expect(await app.pickerCalls()).toBe(1);
    await expect.poll(() => app.opfsTakeCount()).toBe(3);
});

test('"Stop sharing" in the browser bar mid-recording keeps the take', async ({ app }) => {
    const { page } = app;
    await app.chooseButton.click();
    await expect(app.stopButton).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__e2eDisplay!.stopSharing());
    await expect(app.reviewHeading).toHaveText(/^1 take, /);
    await expect(page.getByRole('list', { name: 'Takes' }).getByText('Take 1')).toBeVisible();
    await expect(page.getByText('Next take: choose what to share')).toBeVisible();
    await expect.poll(() => app.opfsTakeCount()).toBe(1);
});

test('Discard, once confirmed, returns to Setup and forgets the takes', async ({ app }) => {
    const { page } = app;
    await app.recordTake(1.5);
    await expect.poll(() => app.opfsTakeCount()).toBe(1);
    await app.button('Discard recording').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Keep recording' }).click();
    await expect(app.reviewHeading).toBeVisible();
    await app.button('Discard recording').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click();
    await expect(app.chooseButton).toBeVisible();
    await expect.poll(() => app.opfsTakeCount()).toBe(0);
});
