/**
 * Errors in words: what went wrong, said plainly, for the error screen and the
 * export-failed card. The technical message and stack still show underneath.
 */

/** The error's name, from an Error or anything else thrown. */
function nameOf(error: unknown): string {
    return error instanceof Error ? error.name : '';
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** What went wrong, for the error screen; recognised errors are explained. */
export function errorReason(error: unknown): string {
    switch (nameOf(error)) {
        case 'NotReadableError':
            return "YouDemo couldn't start your camera. Another app might be using it.";
        case 'NotAllowedError':
            return "YouDemo wasn't allowed to use your camera or microphone.";
        case 'NotFoundError':
            return "YouDemo couldn't find a camera or microphone.";
        case 'QuotaExceededError':
            return "This device doesn't have enough space left for YouDemo.";
        default:
            return 'YouDemo ran into an unexpected error.';
    }
}

/** Why an export didn't finish. */
export function exportFailureReason(error: unknown): string {
    const text = `${nameOf(error)} ${messageOf(error)}`.toLowerCase();
    if (text.includes('memory') || nameOf(error) === 'RangeError') {
        return 'The browser ran out of memory while applying your cut.';
    }
    if (nameOf(error) === 'QuotaExceededError') {
        return "There isn't enough space on this device to save the file.";
    }
    return 'Something stopped the file from being written.';
}

/** The error, with its stack, as copied by Copy error. */
export function errorDetails(error: unknown): string {
    if (error instanceof Error)
        return `${error.name}: ${error.message}\n${error.stack ?? ''}`.trim();
    return String(error);
}
