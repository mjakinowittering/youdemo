import { describe, expect, it, vi } from 'vitest';

import { canShare, copyLink, displayUrl, shareLink } from '$lib/share.js';

const url = 'https://mjakinowittering.github.io/youdemo/';

describe('canShare', () => {
    it('is true where the share sheet exists', () => {
        expect(canShare({ share: async () => {} })).toBe(true);
    });

    it('is false where it does not, so the button hides', () => {
        expect(canShare({} as Pick<Navigator, 'share'>)).toBe(false);
    });
});

describe('shareLink', () => {
    it('shares the title and link', async () => {
        const share = vi.fn(async () => {});
        expect(await shareLink({ share }, url)).toBe(true);
        expect(share).toHaveBeenCalledWith({ title: 'YouDemo', url });
    });

    it('resolves false when the sheet is dismissed', async () => {
        const share = async () => {
            throw new DOMException('Share canceled', 'AbortError');
        };
        expect(await shareLink({ share }, url)).toBe(false);
    });
});

describe('copyLink', () => {
    it('writes the link to the clipboard', async () => {
        const writeText = vi.fn(async () => {});
        const nav = { clipboard: { writeText } } as unknown as Pick<Navigator, 'clipboard'>;
        expect(await copyLink(nav, url)).toBe(true);
        expect(writeText).toHaveBeenCalledWith(url);
    });

    it('resolves false where the clipboard is refused', async () => {
        const nav = {
            clipboard: { writeText: async () => Promise.reject(new Error('denied')) }
        } as unknown as Pick<Navigator, 'clipboard'>;
        expect(await copyLink(nav, url)).toBe(false);
    });
});

describe('displayUrl', () => {
    it('drops the protocol and trailing slash', () => {
        expect(displayUrl(url)).toBe('mjakinowittering.github.io/youdemo');
    });
});
