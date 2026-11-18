import type { TestInfo } from '@playwright/test';

import { expect, test, type App } from './fixtures/app';
import { CODE_MS } from './fixtures/fakeDisplay';
import { Inspector } from './lib/inspect';

const SECONDS = 8;
// A content gap longer than this means a screen frame never reached the take
const SKIP_MS = 50;
// The fake screen's own 30 fps timer misses a paint now and then
const MAX_SKIPS = 6;
// When the screen sends nothing for a frame and a half the recorder redraws its
// last frame, to keep the bubble moving (SCREEN_QUIET_MS in recorder.ts). The
// fake screen stalls like that when its timer misses a paint, so the same
// picture this long after the last one is a stall filled in, not a repeat.
const FILL_MS = 45;
/** Slow the CPU by this factor for a manual run: `THROTTLE=4 npx playwright test cadence`. */
const THROTTLE = Number(process.env.THROTTLE ?? 0);

// Judder check: the fake screen stamps every frame with its capture time, so
// consecutive frames of the take say whether the recorder showed each screen
// frame once and in order.
async function recordAndCount(app: App, testInfo: TestInfo) {
    const { page } = app;
    if (THROTTLE) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    }
    await app.recordTake(SECONDS);
    const [file] = await app.readTakes(1);
    const inspector = await Inspector.open(await page.context().newPage());
    const take = await inspector.inspect(file);

    const frames = take.frames.filter((f) => f.code >= 0);
    let repeated = 0;
    let filled = 0;
    let outOfOrder = 0;
    let skipped = 0;
    for (let i = 1; i < frames.length; i++) {
        const gapMs = (frames[i].code - frames[i - 1].code) * CODE_MS;
        const stepMs = (frames[i].ts - frames[i - 1].ts) * 1000;
        if (gapMs === 0 && stepMs > FILL_MS) filled++;
        else if (gapMs === 0) repeated++;
        else if (gapMs < 0) outOfOrder++;
        else if (gapMs > SKIP_MS) skipped++;
    }
    const total = take.frames.length;
    testInfo.annotations.push({
        type: 'cadence',
        description: JSON.stringify({
            frames: total,
            fps: Math.round((total / SECONDS) * 10) / 10,
            repeated,
            filled,
            outOfOrder,
            skipped
        })
    });
    expect(frames.length).toBeGreaterThan(total * 0.98);
    return { total, repeated, outOfOrder, skipped };
}

test('a take shows each screen frame once, in order', async ({ app }, testInfo) => {
    const take = await recordAndCount(app, testInfo);
    // An unthrottled run keeps the screen's frame rate
    if (!THROTTLE) expect(take.total).toBeGreaterThan(SECONDS * 27);
    expect(take.repeated).toBe(0);
    expect(take.outOfOrder).toBe(0);
    expect(take.skipped).toBeLessThanOrEqual(MAX_SKIPS);
});

// Blur runs in a Worker of its own, so it costs the screen no frames. Without a
// GPU (CI, headless) segmenting is slow, which may only slow the bubble.
test('background blur leaves the screen its cadence', async ({ app }, testInfo) => {
    const { page } = app;
    await page.getByRole('button', { name: 'Enable background blur' }).click();
    await expect(page.getByRole('button', { name: 'Disable background blur' })).toBeVisible();
    const take = await recordAndCount(app, testInfo);
    if (!THROTTLE) expect(take.total).toBeGreaterThan(SECONDS * 24);
    expect(take.repeated).toBe(0);
    expect(take.outOfOrder).toBe(0);
});
