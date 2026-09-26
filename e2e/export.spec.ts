import { computeEffectiveDuration } from '../src/lib/editorMath';
import type { DeletedRange } from '../src/lib/types';

import { expect, newAppPage, test, type AppOptions } from './fixtures/app';
import { checkContent, longestFreeze, losslessShare, maxFrameGap } from './lib/checks';
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
            const file = await app.exportAndDownload();
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
                    longestFreeze: longestFreeze(exported),
                    lossless: losslessShare(exported, takes),
                    content: checkContent(exported, takes, deleted),
                    frames: exported.frames.length,
                    duration: exported.duration
                })
            });
            await app.page.context().close();
        });

        test('plays, with the edited duration', () => {
            // The real-time re-encode can't keep up on a slow machine: the
            // reported jumpy export. bug/lossless-export makes this pass.
            test.fail(!!scenario.slowExport, 'real-time export drops frames when slow');
            expect(exported.playError).toBeNull();
            const joined = takes.reduce((sum, t) => sum + t.duration, 0);
            const expected = computeEffectiveDuration(joined, deleted);
            expect(exported.duration).toBeGreaterThan(expected - 0.3);
            expect(exported.duration).toBeLessThan(expected + 0.3);
        });

        test('is named youdemo-YYYY-MM-DD-HHMMSS.webm', () => {
            expect(filename).toMatch(/^youdemo-\d{4}-\d{2}-\d{2}-\d{6}\.webm$/);
        });

        test('is smooth: no stalls or frozen frames', () => {
            // The real-time re-encode can't keep up on a slow machine: the
            // reported jumpy export. bug/lossless-export makes this pass.
            test.fail(!!scenario.slowExport, 'real-time export drops frames when slow');
            expect(maxFrameGap(exported)).toBeLessThan(0.1);
            expect(longestFreeze(exported)).toBeLessThan(0.1);
        });

        test('shows the right footage at the right time', () => {
            // The real-time re-encode can't keep up on a slow machine: the
            // reported jumpy export. bug/lossless-export makes this pass.
            test.fail(!!scenario.slowExport, 'real-time export drops frames when slow');
            const report = checkContent(exported, takes, deleted);
            expect(report.unmatched / exported.frames.length).toBeLessThan(0.02);
            expect(report.deletedShown).toBe(0);
            expect(report.maxError).toBeLessThan(0.15);
        });

        test('seeks to the middle and shows a frame', () => {
            expect(exported.seek?.code).not.toBe(-1);
        });

        test('has a seek index', () => {
            // MediaRecorder never writes Cues, and every export is MediaRecorder
            // output today. bug/lossless-export makes this pass; remove the marker there.
            test.fail(true, 'MediaRecorder output has no Cues');
            expect(exported.hasCues).toBe(true);
        });

        test('keeps its audio for the whole video', () => {
            test.skip(!!scenario.options?.noMic, 'no audio source in this scenario');
            // The real-time re-encode can't keep up on a slow machine: the
            // reported jumpy export. bug/lossless-export makes this pass.
            test.fail(!!scenario.slowExport, 'real-time export drops frames when slow');
            expect(exported.audio).not.toBeNull();
            expect(Math.abs(exported.audio!.end - exported.duration)).toBeLessThan(0.15);
        });

        test('is lossless: every video frame is byte-identical to the recording', () => {
            const reencoded = takes.length > 1 || deleted.length > 0;
            // Joins and cuts re-encode through canvas + MediaRecorder today.
            // bug/lossless-export makes this pass; remove the marker there.
            test.fail(reencoded, 'export re-encodes joins and cuts');
            expect(losslessShare(exported, takes)).toBe(1);
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
exportScenario('no microphone and no screen audio', {
    takes: [3],
    options: { noMic: true }
});
