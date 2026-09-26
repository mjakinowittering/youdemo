import { expect, test } from './fixtures/app';

test('opens ready to record', async ({ app }) => {
    await expect(app.card(/No screen selected/)).toBeVisible();
    await expect(app.page).toHaveTitle('Ready to record | YouDemo');
});

test.describe('cancelling the screen picker', () => {
    test.use({ appOptions: { cancel: true } });

    test('stays on setup with no error', async ({ app }) => {
        await app.card(/No screen selected/).click();
        await expect(app.card(/No screen selected/)).toBeVisible();
        await expect(app.page.getByText('Could not capture screen')).toBeHidden();
        await expect(app.page.getByText('REC', { exact: true })).toBeHidden();
    });
});

test('mic, camera and blur toggles survive a reload', async ({ app }) => {
    const { page } = app;
    await page.getByRole('button', { name: 'Mute microphone' }).click();
    // Blur first: its toggle is disabled while the camera is off.
    await page.getByRole('button', { name: 'Enable background blur' }).click();
    await page.getByRole('button', { name: 'Disable camera' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Unmute microphone' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable camera' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disable background blur' })).toBeVisible();
    expect(
        await page.evaluate(() => [
            localStorage.getItem('ydMicMuted'),
            localStorage.getItem('ydCamEnabled'),
            localStorage.getItem('ydBlurOn')
        ])
    ).toEqual(['true', 'false', 'true']);
});

test('the device menus list the fake camera and microphone', async ({ app }) => {
    const { page } = app;
    await page.getByRole('button', { name: 'Select camera' }).click();
    await expect(page.getByRole('menuitemradio').first()).toBeVisible();
    await expect(page.getByText('No cameras found')).toBeHidden();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Select microphone' }).click();
    await expect(page.getByRole('menuitemradio').first()).toBeVisible();
    await expect(page.getByText('No microphones found')).toBeHidden();
});

test('background blur loads its model and runtime without a 404', async ({ app }) => {
    const { page } = app;
    const failed: string[] = [];
    const mediapipe: string[] = [];
    page.on('response', (r) => {
        if (r.url().includes('mediapipe')) mediapipe.push(r.url());
        if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    await page.getByRole('button', { name: 'Enable background blur' }).click();
    await expect(page.getByRole('button', { name: 'Disable background blur' })).toBeVisible();
    await expect.poll(() => mediapipe.some((u) => u.endsWith('.tflite'))).toBe(true);
    await expect.poll(() => mediapipe.some((u) => u.endsWith('.wasm'))).toBe(true);
    expect(failed).toEqual([]);
    expect(mediapipe.every((u) => new URL(u).pathname.startsWith('/youdemo/'))).toBe(true);
});
