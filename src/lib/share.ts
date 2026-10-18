/**
 * Getting the link from a phone to a computer, on the blocking browser-check
 * screen. Takes the `navigator` as a parameter so it can be unit-tested.
 */

/** The share sheet exists (most phones); the "Send the link" button hides without it. */
export function canShare(nav: Pick<Navigator, 'share'>): boolean {
    return typeof nav.share === 'function';
}

/** Opens the share sheet with YouDemo's link. Resolves false if dismissed or failed. */
export async function shareLink(nav: Pick<Navigator, 'share'>, url: string): Promise<boolean> {
    try {
        await nav.share({ title: 'YouDemo', url });
        return true;
    } catch {
        return false;
    }
}

/** Copies the link. Resolves false where the clipboard is unavailable or refused. */
export async function copyLink(nav: Pick<Navigator, 'clipboard'>, url: string): Promise<boolean> {
    try {
        await nav.clipboard.writeText(url);
        return true;
    } catch {
        return false;
    }
}

/** The link as people read it: no protocol, no trailing slash. */
export function displayUrl(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
