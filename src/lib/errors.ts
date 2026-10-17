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
