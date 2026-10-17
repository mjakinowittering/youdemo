import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { createTV } from 'tailwind-variants';

// The design's own type, shadow and radius utilities (layout.css), so merging
// reads `text-button` as a size, not a colour that cancels `text-yd-ink`.
const twMergeConfig = {
    extend: {
        theme: {
            text: [
                'display',
                'screen',
                'dialog',
                'row',
                'lead',
                'body',
                'button',
                'small',
                'meta',
                'pill',
                'wordmark'
            ],
            shadow: ['offset', 'offset-sm', 'offset-press', 'panel', 'bubble'],
            radius: ['frame', 'control', 'notice', 'card', 'panel']
        }
    }
};

const twMerge = extendTailwindMerge(twMergeConfig);

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** `tailwind-variants` with the same merge rules as {@link cn}. */
export const tv = createTV({ twMergeConfig });

/** `{@attach}` factory: plays a MediaStream in a `<video>`, detaching it on teardown. */
export function srcObject(stream: MediaStream | null): (node: HTMLVideoElement) => () => void {
    return (node) => {
        node.srcObject = stream;
        return () => {
            node.srcObject = null;
        };
    };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Download filename for an export: `youdemo-YYYY-MM-DD-HHMMSS.webm`, in local time. */
export function exportFilename(now: Date = new Date()): string {
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `youdemo-${date}-${time}.webm`;
}

/** Saves a blob to the user's downloads under `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    // Revoked after the click has been handled, so the download can start
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
