/**
 * Pure planning for lossless export: which recorded packets to copy, and at
 * what output timestamp. Works on packet metadata only — no DOM, no media
 * library — so joins and cuts are unit-tested in node. `videoStitcher.ts`
 * reads the packets, asks for a plan, and copies accordingly.
 */
import { SAMPLE_INTERVAL } from './editorMath.js';
import type { DeletedRange } from './types.js';

/** One encoded packet, as far as planning cares. Seconds. */
export interface PacketMeta {
    ts: number;
    dur: number;
    key: boolean;
}

/** A take's packets per track, in decode order. */
export interface TrackPackets {
    video: PacketMeta[];
    audio: PacketMeta[];
}

/** Copy packet `index` of take `take`'s track, stamped with output time `ts`. */
export interface Placement {
    take: number;
    index: number;
    ts: number;
}

export interface RemuxPlan {
    video: Placement[];
    audio: Placement[];
    duration: number;
}

/** Where a take ends: the later of its last video and last audio packet. */
export function takeEnd(take: TrackPackets): number {
    let end = 0;
    for (const p of [take.video.at(-1), take.audio.at(-1)]) {
        if (p) end = Math.max(end, p.ts + p.dur);
    }
    return end;
}

/**
 * Append a placement unless it would step back in time. A muxer rejects a
 * packet earlier than the one before it; this only drops the odd few-ms audio
 * packet at a seam.
 */
function place(track: Placement[], placement: Placement): void {
    const last = track.at(-1);
    if (last && placement.ts < last.ts) return;
    track.push(placement);
}

/** Takes back to back: each starts where the previous one ends. */
export function joinPlan(takes: TrackPackets[]): RemuxPlan {
    const plan: RemuxPlan = { video: [], audio: [], duration: 0 };
    takes.forEach((take, t) => {
        take.video.forEach((p, index) =>
            place(plan.video, { take: t, index, ts: plan.duration + p.ts })
        );
        take.audio.forEach((p, index) =>
            place(plan.audio, { take: t, index, ts: plan.duration + p.ts })
        );
        plan.duration += takeEnd(take);
    });
    return plan;
}

/** Invert deleted ranges into the kept ranges of a [0, duration] timeline. */
export function keptRanges(
    duration: number,
    deleted: DeletedRange[]
): { start: number; end: number }[] {
    const sorted = [...deleted].sort((a, b) => a.startTime - b.startTime);
    const kept: { start: number; end: number }[] = [];
    let cursor = 0;
    for (const d of sorted) {
        if (cursor < d.startTime)
            kept.push({ start: cursor, end: Math.min(d.startTime, duration) });
        cursor = Math.max(cursor, d.endTime);
    }
    if (cursor < duration) kept.push({ start: cursor, end: duration });
    return kept;
}

/**
 * Keep one take's packets outside `deleted`, closing the gaps. A copied stretch
 * must start on a keyframe, so each kept range starts at the keyframe nearest
 * its start (within half a keyframe interval when the recorder keys every
 * cell); its end is exact. Audio follows the same snapped ranges, so the
 * tracks stay in sync. A range with no keyframe before its end is dropped.
 */
export function cutPlan(take: TrackPackets, deleted: DeletedRange[]): RemuxPlan {
    const plan: RemuxPlan = { video: [], audio: [], duration: 0 };
    const keys = take.video.filter((p) => p.key).map((p) => p.ts);
    let previousEnd = 0;
    for (const range of keptRanges(takeEnd(take), deleted)) {
        // Never reach back before the last range's end: that would repeat footage.
        const candidates = keys.filter((k) => k >= previousEnd && k < range.end);
        if (candidates.length === 0) continue;
        const start = candidates.reduce((best, k) =>
            Math.abs(k - range.start) < Math.abs(best - range.start) ? k : best
        );
        const shift = plan.duration - start;
        take.video.forEach((p, index) => {
            if (p.ts >= start && p.ts < range.end)
                place(plan.video, { take: 0, index, ts: p.ts + shift });
        });
        take.audio.forEach((p, index) => {
            if (p.ts >= start && p.ts < range.end)
                place(plan.audio, { take: 0, index, ts: p.ts + shift });
        });
        plan.duration += range.end - start;
        previousEnd = range.end;
    }
    return plan;
}

/** Longest stretch of a track without a keyframe, including the run to its end. */
export function maxKeyframeGap(video: PacketMeta[]): number {
    let gap = 0;
    let lastKey = video[0]?.ts ?? 0;
    for (const p of video) {
        if (p.key) {
            gap = Math.max(gap, p.ts - lastKey);
            lastKey = p.ts;
        }
    }
    const last = video.at(-1);
    if (last) gap = Math.max(gap, last.ts + last.dur - lastKey);
    return gap;
}

/**
 * Whether the takes can be copied as they are. They can't when their encoder
 * settings differ (a resume picked a different-sized screen), or when one has
 * keyframes too sparse to cut on (a take recovered from before the recorder
 * keyed every cell). Then every take is re-encoded once, so they all match.
 * `config` is any string that is equal exactly when two takes' settings are.
 */
export function needsNormalising(takes: (TrackPackets & { config: string })[]): boolean {
    return takes.some(
        (t) => t.config !== takes[0].config || maxKeyframeGap(t.video) > 2 * SAMPLE_INTERVAL
    );
}
