import { expect, test } from './fixtures/app';

test.describe('first visit', () => {
    test.use({ appOptions: { welcomed: false } });

    test('Setup carries the welcome until the first take starts', async ({ app }) => {
        const { page } = app;
        await expect(page.getByText('First time here')).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await app.recordTake(1);
        expect(await page.evaluate(() => localStorage.getItem('ydWelcomed'))).toBe('true');

        await page.getByRole('button', { name: 'Discard recording' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click();
        await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible();
        await expect(page.getByText('First time here')).toBeHidden();
    });
});

test('a browser that cannot record is sent to a computer', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'MediaRecorder', { value: undefined });
    });
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'YouDemo needs a computer' })).toBeVisible();
    await expect(
        page.getByText('mjakinowittering.github.io/youdemo').or(page.getByText(/localhost/))
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose what to share' })).toBeHidden();
});

test('a browser without audio mixing can carry on without it', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'AudioContext', { value: undefined });
    });
    await page.goto('./');
    await expect(page.getByText('System audio mixing')).toBeVisible();
    await page.getByRole('button', { name: 'Continue without them' }).click();
    await expect(page.getByRole('button', { name: 'Choose what to share' })).toBeVisible();
});
