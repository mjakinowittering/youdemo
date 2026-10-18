import { describe, expect, it } from 'vitest';

import { stagedProgress } from '$lib/stagedProgress.js';

/** The reported fractions and stages, in order. */
function recorder(): {
    values: number[];
    stages: string[];
    report: (f: number, s: string) => void;
} {
    const values: number[] = [];
    const stages: string[] = [];
    return {
        values,
        stages,
        report: (f, s) => {
            values.push(f);
            stages.push(s);
        }
    };
}

function isMonotonic(values: number[]): boolean {
    return values.every((v, i) => i === 0 || v >= values[i - 1]);
}

describe('stagedProgress', () => {
    it('maps each stage into its share by weight', () => {
        const r = recorder();
        const p = stagedProgress(
            [
                ['scan', 0.3],
                ['write', 0.6],
                ['finish', 0.1]
            ],
            r.report
        );
        p.scan(0.5);
        p.scan(1);
        p.write(0.5);
        p.finish(1);
        expect(r.values[0]).toBeCloseTo(0.15);
        expect(r.values[1]).toBeCloseTo(0.3);
        expect(r.values[2]).toBeCloseTo(0.6);
        expect(r.stages).toEqual(['scan', 'scan', 'write', 'finish']);
    });

    it('normalises weights that do not sum to 1', () => {
        const r = recorder();
        const p = stagedProgress(
            [
                ['a', 1],
                ['b', 3]
            ],
            r.report
        );
        p.a(1);
        expect(r.values).toEqual([0.25]);
    });

    it('ends at exactly 1, and only when the last stage finishes', () => {
        const r = recorder();
        // Weights whose running sum is not exactly 1 in floating point
        const p = stagedProgress(
            [
                ['a', 0.1],
                ['b', 0.2],
                ['c', 0.7]
            ],
            r.report
        );
        p.a(1);
        p.b(1);
        p.c(0.999999);
        expect(r.values.at(-1)).toBeLessThan(1);
        p.c(1);
        expect(r.values.at(-1)).toBe(1);
    });

    it('never goes back, whatever order stages report in', () => {
        const r = recorder();
        const p = stagedProgress(
            [
                ['a', 1],
                ['b', 1]
            ],
            r.report
        );
        p.a(0.4);
        p.b(0.5);
        p.a(0.9);
        p.b(0.2);
        p.b(0.5);
        p.b(1);
        expect(isMonotonic(r.values)).toBe(true);
        expect(r.values.at(-1)).toBe(1);
    });

    it('clamps fractions outside 0–1 to the stage', () => {
        const r = recorder();
        const p = stagedProgress(
            [
                ['a', 1],
                ['b', 1]
            ],
            r.report
        );
        p.a(-1);
        p.a(2);
        expect(r.values).toEqual([0, 0.5]);
    });

    it('nests: a sub-stage stays inside its parent stage', () => {
        const r = recorder();
        const outer = stagedProgress(
            [
                ['read', 0.3],
                ['rest', 0.7]
            ],
            r.report
        );
        outer.read(1);
        const inner = stagedProgress(
            [
                ['write', 0.6],
                ['finish', 0.1]
            ],
            outer.rest
        );
        inner.write(1);
        expect(r.values.at(-1)).toBeCloseTo(0.3 + 0.7 * (0.6 / 0.7));
        inner.finish(1);
        expect(r.values.at(-1)).toBe(1);
        expect(isMonotonic(r.values)).toBe(true);
    });
});
