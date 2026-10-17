/**
 * One 0–1 progress fraction from a job's steps, each given its share by
 * weight. Each step gets a reporter taking its own 0–1; the combined fraction
 * never goes back and reaches exactly 1 only when the last step does.
 *
 * A reporter is itself a `(fraction) => void`, so a step splits into sub-steps
 * by passing it as `report` to another `stagedProgress`.
 */
export function stagedProgress<S extends string>(
    stages: [S, number][],
    report: (fraction: number, stage: S) => void
): Record<S, (fraction: number) => void> {
    const total = stages.reduce((sum, [, weight]) => sum + weight, 0);
    const reporters = {} as Record<S, (fraction: number) => void>;
    let last = 0;
    let start = 0;
    stages.forEach(([stage, weight], i) => {
        const from = start;
        const isLast = i === stages.length - 1;
        const to = isLast ? 1 : (start += weight / total);
        reporters[stage] = (fraction) => {
            const f = Math.min(1, Math.max(0, fraction));
            const value = isLast && f === 1 ? 1 : Math.min(to, from + (to - from) * f);
            if (value < last) return;
            last = value;
            report(value, stage);
        };
    });
    return reporters;
}
