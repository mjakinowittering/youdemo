import { expect, test, type Page } from '@playwright/test';

const PERMISSIONS = ['camera', 'microphone'] as const;

test.use({
    permissions: [...PERMISSIONS]
});

test.beforeEach(async ({ context }) => {
    await context.grantPermissions([...PERMISSIONS]);
});

async function mockScreenCapture(page: Page) {
    await page.evaluate(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        navigator.mediaDevices.getDisplayMedia = () => Promise.resolve(stream);
    });
}

async function dismissWelcome(page: Page) {
    await page.getByRole('dialog').getByRole('button', { name: "Let's begin" }).click();
}

async function recordClip(page: Page) {
    await mockScreenCapture(page);
    await page.getByRole('button', { name: 'Start Recording' }).click();
    await expect(page.getByText('Recording in progress')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Stop Recording' }).click();
    await expect(page.getByText('Edit recording')).toBeVisible();
}

async function goToEditor(page: Page) {
    await page.getByText('Edit recording').click();
    await expect(page.getByText('Export & Download')).toBeVisible({ timeout: 10000 });
}

async function exportVideo(page: Page) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export & Download' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/youdemo-\d{4}-\d{2}-\d{2}\.webm/);
    const blob = await download.createReadStream();
    expect(blob).not.toBeNull();
    return download;
}

test('app loads and shows Setup screen after dismissing welcome', async ({ page }) => {
    await page.goto('/');

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Welcome to YouDemo')).toBeVisible();

    await modal.getByRole('button', { name: "Let's begin" }).click();
    await expect(modal).not.toBeVisible();

    await expect(page.getByText('No screen selected')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
    await expect(page.getByText('YouDemo')).toBeVisible();
});

test('full record flow: setup → countdown → recording → review', async ({ page }) => {
    await page.goto('/');
    await dismissWelcome(page);
    await recordClip(page);
});

test('video can be exported and downloaded', async ({ page }) => {
    await page.goto('/');
    await dismissWelcome(page);
    await recordClip(page);
    await goToEditor(page);
    await exportVideo(page);

    await expect(page.getByText('Download started')).toBeVisible();
});

test('two recordings can be merged and exported', async ({ page }) => {
    await page.goto('/');
    await dismissWelcome(page);

    await recordClip(page);

    // Resume recording — mock screen capture again for the second segment
    await mockScreenCapture(page);
    await page.getByText('Resume recording').click();

    await expect(page.getByText('Recording in progress')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Stop Recording' }).click();
    await expect(page.getByText('Edit recording')).toBeVisible();

    await goToEditor(page);
    await exportVideo(page);

    await expect(page.getByText('Download started')).toBeVisible();
});

test('frames can be deleted and exported', async ({ page }) => {
    await page.goto('/');
    await dismissWelcome(page);
    await recordClip(page);
    await goToEditor(page);

    // Enter edit mode
    await page.getByRole('button', { name: 'Cut' }).click();
    await expect(page.getByText('Selecting…')).toBeVisible();

    // Click the first visible frame cell to set the anchor
    const cells = page.locator('.frame-cell');
    await cells.first().click();

    // Click a later cell to select a range
    await cells.nth(2).click();

    // Delete button should now appear
    const deleteBtn = page.getByRole('button', { name: 'Delete' });
    await expect(deleteBtn).toBeVisible();

    // Delete the selected range — auto-exits edit mode
    await deleteBtn.click();

    // Edit mode exited, Cut button back to default label
    await expect(page.getByRole('button', { name: /^Cut$/ })).toBeVisible();

    // Export the trimmed video
    await exportVideo(page);

    await expect(page.getByText('Download started')).toBeVisible();
});
