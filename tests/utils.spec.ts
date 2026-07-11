import { describe, expect, it } from 'vitest';

import { cn } from '$lib/utils.js';

describe('cn', () => {
    it('joins multiple class strings', () => {
        expect(cn('a', 'b', 'c')).toBe('a b c');
    });

    it('drops falsy / conditional values (clsx)', () => {
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
