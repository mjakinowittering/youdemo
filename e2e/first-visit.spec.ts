import { expect, test } from './fixtures/app';

test.describe('first visit', () => {
    test.use({ appOptions: { welcomed: false } });

    test('shows the welcome modal once, then remembers it was dismissed', async ({ app }) => {
        const { page } = app;
        const dialog = page.getByRole('dialog', { name: 'Welcome to YouDemo' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: "Let's begin" }).click();
        await expect(dialog).toBeHidden();
        expect(await page.evaluate(() => localStorage.getItem('ydWelcomed'))).toBe('true');

        await page.reload();
        await expect(app.card(/No screen selected/)).toBeVisible();
        await expect(dialog).toBeHidden();
    });
});

test('a browser without MediaRecorder is told it is not supported', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'MediaRecorder', { value: undefined });
    });
    await page.goto('./');
    await expect(page.getByText('Browser not supported')).toBeVisible();
    await expect(page.getByRole('button', { name: /No screen selected/ })).toBeHidden();
});
