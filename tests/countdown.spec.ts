import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startCountdown, ZERO_HOLD_MS } from '$lib/countdown.js';

describe('startCountdown', () => {
    // The clock the countdown reads, moved apart from the fake timers so a tick
    // can arrive later than it was scheduled, as in a throttled background tab
    let clock = 0;
    let counts: number[];
    let doneAt: number | null;
    let stop: () => void;

    /** The next pending tick fires, but only once the clock reads `at`. */
    function tickArrivesAt(at: number): void {
        clock = at;
        vi.runOnlyPendingTimers();
    }

    beforeEach(() => {
        vi.useFakeTimers();
        clock = 0;
        counts = [];
        doneAt = null;
        stop = startCountdown({
            oncount: (count) => counts.push(count),
            ondone: () => (doneAt = clock),
            now: () => clock
        });
    });

    afterEach(() => {
        stop();
        vi.useRealTimers();
    });

    it('shows 3 at once', () => {
        expect(counts).toEqual([3]);
    });

    it('counts 3, 2, 1, 0 on the second and is done after the 0', () => {
        for (const at of [1000, 2000, 3000]) tickArrivesAt(at);
        expect(counts).toEqual([3, 2, 1, 0]);
        expect(doneAt).toBeNull();
        tickArrivesAt(3000 + ZERO_HOLD_MS);
        expect(doneAt).toBe(3000 + ZERO_HOLD_MS);
    });

    it('stays on time when ticks arrive late and unevenly', () => {
        tickArrivesAt(1400);
        expect(counts.at(-1)).toBe(2);
        tickArrivesAt(2950);
        expect(counts.at(-1)).toBe(1);
        // Scheduled for 3000 from the start, not 1000 after the late tick
        expect(vi.getTimerCount()).toBe(1);
        tickArrivesAt(3020);
        expect(counts).toEqual([3, 2, 1, 0]);
        tickArrivesAt(3400);
        expect(doneAt).toBe(3400);
    });

    it('jumps to the right number when a tick is very late', () => {
        tickArrivesAt(3100);
        expect(counts).toEqual([3, 0]);
        expect(doneAt).toBeNull();
        tickArrivesAt(3000 + ZERO_HOLD_MS);
        expect(doneAt).toBe(3000 + ZERO_HOLD_MS);
    });

    it('schedules each tick for the next whole second from the start', () => {
        tickArrivesAt(1400);
        clock = 1999;
        vi.advanceTimersByTime(599);
        expect(counts).toEqual([3, 2]);
        clock = 2000;
        vi.advanceTimersByTime(1);
        expect(counts).toEqual([3, 2, 1]);
    });

    it('stops on cancel', () => {
        stop();
        tickArrivesAt(5000);
        expect(counts).toEqual([3]);
        expect(doneAt).toBeNull();
    });
});
