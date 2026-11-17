import { expect, test } from './fixtures/app';
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
test('a take shows each screen frame once, in order', async ({ app, page }, testInfo) => {
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
    testInfo.annotations.push({
        type: 'cadence',
        description: JSON.stringify({
            frames: take.frames.length,
            fps: Math.round((take.frames.length / SECONDS) * 10) / 10,
            repeated,
            filled,
            outOfOrder,
            skipped
        })
    });

    expect(frames.length).toBeGreaterThan(take.frames.length * 0.98);
    // An unthrottled run keeps the screen's frame rate
    if (!THROTTLE) expect(take.frames.length).toBeGreaterThan(SECONDS * 27);
    expect(repeated).toBe(0);
    expect(outOfOrder).toBe(0);
    expect(skipped).toBeLessThanOrEqual(MAX_SKIPS);
});
