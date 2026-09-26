import { computeEffectiveDuration } from '../src/lib/editorMath';
import type { DeletedRange } from '../src/lib/types';

import { expect, newAppPage, test, type AppOptions } from './fixtures/app';
import {
    checkContent,
    longestFreeze,
    losslessShare,
    maxFrameGap,
    maxKeyframeGap,
    takeLength
} from './lib/checks';
import { Inspector, type Inspection } from './lib/inspect';

interface Scenario {
    /** Seconds per take; more than one means pause/resume. */
    takes: number[];
    /** Raw cell ranges to cut, applied in order (later ranges first). */
    cuts?: [number, number][];
    /**
     * Slow the CPU by this factor while the export runs, as on a weaker machine.
     * (A hidden tab can't be reproduced: headless Chromium never hides a page,
     * and Playwright turns background throttling off.)
     */
    slowExport?: number;
    /** Takes differ in size, so export re-encodes them to one (not lossless). */
    normalised?: boolean;
    options?: AppOptions;
}

/**
 * Record, edit and export once in `beforeAll`, then check the exported file
 * from several angles, one test per property, so a report names exactly
 * which property broke.
 */
function exportScenario(title: string, scenario: Scenario): void {
    test.describe(title, () => {
        let exported: Inspection;
        let takes: Inspection[];
        let deleted: DeletedRange[];
        let filename: string;

        test.beforeAll(async ({ browser }, testInfo) => {
            testInfo.setTimeout(240_000);
            const app = await newAppPage(browser, testInfo, scenario.options);
            await app.goto();
            for (const seconds of scenario.takes) await app.recordTake(seconds);
            const takeFiles = await app.readTakes(scenario.takes.length);
            await app.openEditor();
            for (const [from, to] of scenario.cuts ?? []) await app.cut(from, to);
            deleted = [...app.deleted];

            const cdp = await app.page.context().newCDPSession(app.page);
            if (scenario.slowExport) {
                await cdp.send('Emulation.setCPUThrottlingRate', { rate: scenario.slowExport });
            }
            const started = Date.now();
            const file = await app.exportAndDownload();
            const exportMs = Date.now() - started;
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
            filename = file.filename;

            const inspector = await Inspector.open(await app.page.context().newPage());
            takes = [];
            for (const t of takeFiles) takes.push(await inspector.inspect(t));
            exported = await inspector.inspect(file.bytes);
            testInfo.annotations.push({
                type: 'baseline',
                description: JSON.stringify({
                    maxFrameGap: maxFrameGap(exported),
                    takeFrameGap: Math.max(...takes.map(maxFrameGap)),
                    longestFreeze: longestFreeze(exported),
                    lossless: losslessShare(exported, takes),
                    keyframeGap: Math.max(...takes.map(maxKeyframeGap)),
                    exportMs,
                    content: checkContent(exported, takes, deleted),
                    frames: exported.frames.length,
                    duration: exported.duration
                })
            });
            await app.page.context().close();
        });

        test('the takes have a keyframe on every editor cell', () => {
            // Cuts copy from the keyframe nearest the cut; see recorder.ts.
            for (const take of takes) expect(maxKeyframeGap(take)).toBeLessThan(0.22);
        });

        test('plays, with the edited duration', () => {
            expect(exported.playError).toBeNull();
            const joined = takes.reduce((sum, t) => sum + takeLength(t), 0);
            const expected = computeEffectiveDuration(joined, deleted);
            expect(exported.duration).toBeGreaterThan(expected - 0.3);
            expect(exported.duration).toBeLessThan(expected + 0.3);
        });

        test('is named youdemo-YYYY-MM-DD-HHMMSS.webm', () => {
            expect(filename).toMatch(/^youdemo-\d{4}-\d{2}-\d{2}-\d{6}\.webm$/);
        });

        test('is smooth: adds no stalls or frozen frames', () => {
            // Measured against the takes: the recorder's own timer can miss a
            // frame under load, and that is recording, not export. A cut may
            // add up to one frame at its seam.
            const allowance = 1 / 30 + 0.005;
            const takeGap = Math.max(...takes.map(maxFrameGap));
            const takeFreeze = Math.max(...takes.map(longestFreeze));
            expect(maxFrameGap(exported)).toBeLessThan(Math.max(0.1, takeGap + allowance));
            expect(longestFreeze(exported)).toBeLessThan(Math.max(0.1, takeFreeze + allowance));
        });

        test('shows the right footage at the right time', () => {
            const report = checkContent(exported, takes, deleted);
            expect(report.unmatched / exported.frames.length).toBeLessThan(0.02);
            expect(report.deletedShown).toBe(0);
            expect(report.maxError).toBeLessThan(0.15);
        });

        test('seeks to the middle and shows a frame', () => {
            expect(exported.seek?.code).not.toBe(-1);
        });

        test('has a seek index', () => {
            // A single uncut take is the recording itself, which MediaRecorder
            // writes without Cues; everything export writes has them.
            const untouched = scenario.takes.length === 1 && !scenario.cuts?.length;
            expect(exported.hasCues).toBe(!untouched);
        });

        test('keeps its audio for the whole video', () => {
            test.skip(!!scenario.options?.noMic, 'no audio source in this scenario');
            expect(exported.audio).not.toBeNull();
            expect(Math.abs(exported.audio!.end - exported.duration)).toBeLessThan(0.15);
        });

        test('is lossless: every video frame is byte-identical to the recording', () => {
            if (scenario.normalised) expect(losslessShare(exported, takes)).toBe(0);
            else expect(losslessShare(exported, takes)).toBe(1);
        });
    });
}

exportScenario('one take, no cuts', { takes: [3] });
exportScenario('three takes, no cuts', { takes: [2.5, 2.5, 2.5] });
exportScenario('three takes and a cut (the reported case)', {
    takes: [2.5, 2.5, 2.5],
    cuts: [[15, 22]]
});
exportScenario('one take, several cuts including start and end', {
    takes: [4],
    cuts: [
        [17, 19],
        [8, 11],
        [0, 2]
    ]
});
exportScenario('three takes, a cut across a take boundary', {
    takes: [2.5, 2.5, 2.5],
    cuts: [[10, 15]]
});
exportScenario('three takes and a cut, on a slow machine', {
    takes: [2.5, 2.5, 2.5],
    cuts: [[15, 22]],
    slowExport: 20
});
exportScenario('three takes of different screen sizes, and a cut', {
    takes: [2.5, 2.5, 2.5],
    cuts: [[15, 22]],
    normalised: true,
    options: {
        sizes: [
            [1280, 720],
            [1920, 1080],
            [1280, 720]
        ]
    }
});
exportScenario('no microphone and no screen audio', {
    takes: [3],
    options: { noMic: true }
});
