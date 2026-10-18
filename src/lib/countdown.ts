/**
 * The countdown before a take: 3, 2, 1 a second each, then a brief 0 before
 * recording starts.
 *
 * Driven by the time elapsed since it started, not by counting ticks: Chrome
 * holds a background tab's timers to about once a second, and the countdown
 * mostly runs with YouDemo in the background (the shared tab takes focus). A
 * late tick then shows the right number, and can't drift or delay the start.
 */
export const COUNTDOWN_FROM = 3;
/** How long the 0 shows before recording starts. */
export const ZERO_HOLD_MS = 300;

export interface CountdownOptions {
    /** Each new value, from the first 3 down to 0. A late tick may skip one. */
    oncount: (count: number) => void;
    /** Once, when the 0 has shown for `ZERO_HOLD_MS`. */
    ondone: () => void;
    /** Milliseconds from a monotonic clock. */
    now?: () => number;
}

/** Starts the countdown; the returned function cancels it. */
export function startCountdown({
    oncount,
    ondone,
    now = () => performance.now()
}: CountdownOptions): () => void {
    const start = now();
    const doneAt = COUNTDOWN_FROM * 1000 + ZERO_HOLD_MS;
    let shown = COUNTDOWN_FROM;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function check(): void {
        const elapsed = now() - start;
        const count = Math.max(0, COUNTDOWN_FROM - Math.floor(elapsed / 1000));
        if (count !== shown) {
            shown = count;
            oncount(count);
        }
        if (elapsed >= doneAt) {
            ondone();
            return;
        }
        // Wake at the next whole second (or the end of the 0), measured from the start
        const next = count > 0 ? (COUNTDOWN_FROM - count + 1) * 1000 : doneAt;
        timer = setTimeout(check, next - elapsed);
    }

    oncount(shown);
    timer = setTimeout(check, 1000);
    return () => clearTimeout(timer);
}
