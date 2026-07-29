import { describe, expect, it } from 'vitest';

import { cn, exportFilename } from '$lib/utils.js';

describe('cn', () => {
    it('joins multiple class strings', () => {
        expect(cn('a', 'b', 'c')).toBe('a b c');
    });

    it('drops falsy / conditional values (clsx)', () => {
        // Intentional constant falsy conditional — exercises clsx's drop behaviour.
        // eslint-disable-next-line no-constant-binary-expression
        expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c');
    });

    it('flattens arrays and object maps', () => {
        expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
    });

    it('resolves conflicting Tailwind utilities, last one wins (tailwind-merge)', () => {
        expect(cn('p-2', 'p-4')).toBe('p-4');
        expect(cn('text-red-500', 'text-indigo-500')).toBe('text-indigo-500');
    });

    it('keeps non-conflicting utilities from a conflict pair', () => {
        expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });

    it('returns an empty string for no / empty input', () => {
        expect(cn()).toBe('');
        expect(cn('', false, undefined)).toBe('');
    });
});

describe('exportFilename', () => {
    it('formats local date and time as youdemo-YYYY-MM-DD-HHMMSS.webm', () => {
        expect(exportFilename(new Date(2026, 6, 25, 14, 30, 12))).toBe(
            'youdemo-2026-07-25-143012.webm'
        );
    });

    it('zero-pads every single-digit part', () => {
        expect(exportFilename(new Date(2026, 0, 2, 3, 4, 5))).toBe(
            'youdemo-2026-01-02-030405.webm'
        );
    });

    it('gives two recordings a second apart distinct names', () => {
        const first = exportFilename(new Date(2026, 6, 25, 14, 30, 12));
        const second = exportFilename(new Date(2026, 6, 25, 14, 30, 13));
        expect(first).not.toBe(second);
    });
});
