import { describe, expect, it } from 'vitest';

import {
    cutPlan,
    joinPlan,
    keptRanges,
    maxKeyframeGap,
    needsNormalising,
    takeEnd,
    type PacketMeta,
    type TrackPackets
} from '$lib/remuxPlan.js';

const FRAME = 1 / 30;
const AUDIO = 0.02;

/** A take like the recorder's: 30 fps, a keyframe every 6 frames, 20 ms Opus packets. */
function take(seconds: number, keyEvery = 6): TrackPackets {
    const video: PacketMeta[] = [];
    for (let i = 0; i * FRAME < seconds - 1e-9; i++) {
        video.push({ ts: i * FRAME, dur: FRAME, key: i % keyEvery === 0 });
    }
    const audio: PacketMeta[] = [];
    for (let i = 0; i * AUDIO < seconds - 1e-9; i++) {
        audio.push({ ts: i * AUDIO, dur: AUDIO, key: true });
    }
    return { video, audio };
}

function isIncreasing(ts: number[]): boolean {
    return ts.every((t, i) => i === 0 || t >= ts[i - 1]);
}

describe('takeEnd', () => {
    it('is the later of the last video and audio packet ends', () => {
        const t: TrackPackets = {
            video: [{ ts: 0, dur: 1, key: true }],
            audio: [{ ts: 1, dur: 0.5, key: true }]
        };
        expect(takeEnd(t)).toBe(1.5);
    });

    it('is 0 for an empty take', () => {
        expect(takeEnd({ video: [], audio: [] })).toBe(0);
    });
});

describe('joinPlan', () => {
    it('places each take after the previous one ends', () => {
        const plan = joinPlan([take(1), take(2), take(1)]);
        expect(plan.duration).toBeCloseTo(4);
        const firstOfTake = (n: number) => plan.video.find((p) => p.take === n)!;
        expect(firstOfTake(0).ts).toBeCloseTo(0);
        expect(firstOfTake(1).ts).toBeCloseTo(1);
        expect(firstOfTake(2).ts).toBeCloseTo(3);
    });

    it('copies every packet exactly once, in order', () => {
        const takes = [take(1), take(1.5)];
        const plan = joinPlan(takes);
        expect(plan.video).toHaveLength(takes[0].video.length + takes[1].video.length);
        expect(plan.audio).toHaveLength(takes[0].audio.length + takes[1].audio.length);
        expect(isIncreasing(plan.video.map((p) => p.ts))).toBe(true);
        expect(isIncreasing(plan.audio.map((p) => p.ts))).toBe(true);
    });

    it('drops a packet that would step back in time at a seam', () => {
        const second = take(1);
        second.audio.unshift({ ts: -0.01, dur: AUDIO, key: true });
        const plan = joinPlan([take(1), second]);
        expect(isIncreasing(plan.audio.map((p) => p.ts))).toBe(true);
    });
});

describe('keptRanges', () => {
    it('inverts deletions, whatever their order', () => {
        expect(
            keptRanges(10, [
                { startTime: 6, endTime: 7 },
                { startTime: 2, endTime: 3 }
            ])
        ).toEqual([
            { start: 0, end: 2 },
            { start: 3, end: 6 },
            { start: 7, end: 10 }
        ]);
    });

    it('merges overlapping deletions and handles cuts at the ends', () => {
        expect(
            keptRanges(10, [
                { startTime: 0, endTime: 2 },
                { startTime: 1, endTime: 4 },
                { startTime: 9, endTime: 10 }
            ])
        ).toEqual([{ start: 4, end: 9 }]);
    });

    it('keeps nothing when everything is deleted', () => {
        expect(keptRanges(5, [{ startTime: 0, endTime: 5 }])).toEqual([]);
    });
});

describe('cutPlan', () => {
    it('with no cuts, copies the whole take unchanged', () => {
        const t = take(2);
        const plan = cutPlan(t, []);
        expect(plan.video.map((p) => p.index)).toEqual(t.video.map((_, i) => i));
        expect(plan.video.every((p, i) => Math.abs(p.ts - t.video[i].ts) < 1e-9)).toBe(true);
        expect(plan.duration).toBeCloseTo(2);
    });

    it('closes the gap left by a middle cut, starting the next range on a keyframe', () => {
        const t = take(4);
        // Keyframes every 0.2 s; the cut ends exactly on one.
        const plan = cutPlan(t, [{ startTime: 1, endTime: 2 }]);
        expect(plan.duration).toBeCloseTo(3);
        const resumed = plan.video.find((p) => p.ts >= 1 - 1e-9)!;
        expect(t.video[resumed.index].key).toBe(true);
        expect(t.video[resumed.index].ts).toBeCloseTo(2);
        expect(resumed.ts).toBeCloseTo(1);
    });

    it('snaps a kept range to the nearest keyframe, either way', () => {
        const t = take(4);
        const late = cutPlan(t, [{ startTime: 1, endTime: 2.05 }]); // nearest key 2.0, before
        const early = cutPlan(t, [{ startTime: 1, endTime: 2.15 }]); // nearest key 2.2, after
        const resumedAt = (plan: typeof late) =>
            t.video[plan.video.find((p) => p.ts >= 1 - 1e-9)!.index].ts;
        expect(resumedAt(late)).toBeCloseTo(2);
        expect(resumedAt(early)).toBeCloseTo(2.2);
    });

    it('starts at 0 when the opening is cut', () => {
        const plan = cutPlan(take(3), [{ startTime: 0, endTime: 1 }]);
        expect(plan.video[0].ts).toBeCloseTo(0);
        expect(plan.audio[0].ts).toBeCloseTo(0);
        expect(plan.duration).toBeCloseTo(2);
    });

    it('ends exactly where a cut at the end begins', () => {
        const plan = cutPlan(take(3), [{ startTime: 2.5, endTime: 3 }]);
        expect(plan.duration).toBeCloseTo(2.5);
        expect(plan.video.at(-1)!.ts).toBeLessThan(2.5);
    });

    it('keeps audio in step with video across several cuts', () => {
        const t = take(6);
        const plan = cutPlan(t, [
            { startTime: 4, endTime: 5 },
            { startTime: 1, endTime: 2 }
        ]);
        expect(plan.duration).toBeCloseTo(4);
        // Each output packet keeps the same offset from its source as its
        // video neighbour: source time − output time is shared per range.
        const offset = (track: 'video' | 'audio', at: number) => {
            const p = plan[track].find((x) => x.ts >= at - 1e-9)!;
            return t[track][p.index].ts - p.ts;
        };
        for (const at of [0, 1.5, 3.5]) {
            expect(offset('audio', at)).toBeCloseTo(offset('video', at), 1);
        }
        expect(isIncreasing(plan.video.map((p) => p.ts))).toBe(true);
        expect(isIncreasing(plan.audio.map((p) => p.ts))).toBe(true);
    });

    it('copies nothing when everything is cut', () => {
        const plan = cutPlan(take(2), [{ startTime: 0, endTime: 2 }]);
        expect(plan.video).toEqual([]);
        expect(plan.duration).toBe(0);
    });

    it('never repeats footage from before an earlier range ended', () => {
        const t = take(3, 30); // keyframes only every second
        const plan = cutPlan(t, [{ startTime: 1.1, endTime: 1.3 }]);
        const indices = plan.video.map((p) => p.index);
        expect(new Set(indices).size).toBe(indices.length);
    });
});

describe('maxKeyframeGap', () => {
    it('is the keyframe spacing for a recorder take', () => {
        expect(maxKeyframeGap(take(3).video)).toBeCloseTo(0.2);
    });

    it('includes the stretch after the last keyframe', () => {
        expect(maxKeyframeGap(take(2, 1000).video)).toBeCloseTo(2);
    });
});

describe('needsNormalising', () => {
    const cfg = (t: TrackPackets, config = 'vp9|1280x720') => ({ ...t, config });

    it('is false for matching, well-keyed takes', () => {
        expect(needsNormalising([cfg(take(2)), cfg(take(3))])).toBe(false);
    });

    it('is true when a take has different settings', () => {
        expect(needsNormalising([cfg(take(2)), cfg(take(2), 'vp9|1920x1080')])).toBe(true);
    });

    it('is true when a take has sparse keyframes', () => {
        expect(needsNormalising([cfg(take(2)), cfg(take(2, 1000))])).toBe(true);
    });
});
