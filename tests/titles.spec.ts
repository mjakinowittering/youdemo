import { describe, expect, it } from 'vitest';

import { APP_NAME, formatElapsed, titleFor } from '$lib/titles.js';

describe('formatElapsed', () => {
    it('pads to mm:ss', () => {
        expect(formatElapsed(0)).toBe('00:00');
        expect(formatElapsed(9)).toBe('00:09');
    });

    it('rolls over into minutes', () => {
        expect(formatElapsed(61)).toBe('01:01');
        expect(formatElapsed(600)).toBe('10:00');
        expect(formatElapsed(3599)).toBe('59:59');
    });
});

describe('titleFor', () => {
    it('names each static state', () => {
        expect(titleFor('check')).toBe(`Checking browser… | ${APP_NAME}`);
        expect(titleFor('setup')).toBe(`Ready to record | ${APP_NAME}`);
        expect(titleFor('review')).toBe(`Review recording | ${APP_NAME}`);
        expect(titleFor('editor')).toBe(`Editing | ${APP_NAME}`);
    });

    it('counts down', () => {
        expect(titleFor('countdown', { count: 3 })).toBe(`3… | ${APP_NAME}`);
        expect(titleFor('countdown', { count: 0 })).toBe(`0… | ${APP_NAME}`);
    });

    it('ticks the recording timer', () => {
        expect(titleFor('recording', { elapsed: 0 })).toBe(`● REC 00:00 | ${APP_NAME}`);
        expect(titleFor('recording', { elapsed: 42 })).toBe(`● REC 00:42 | ${APP_NAME}`);
        expect(titleFor('recording', { elapsed: 61 })).toBe(`● REC 01:01 | ${APP_NAME}`);
    });

    it('follows the Editor through joining, exporting and exported', () => {
        expect(titleFor('editor', { phase: 'joining', progress: 64 })).toBe(
            `Joining takes… 64% | ${APP_NAME}`
        );
        expect(titleFor('editor', { phase: 'exporting', progress: 64 })).toBe(
            `Exporting… 64% | ${APP_NAME}`
        );
        expect(titleFor('editor', { exported: true })).toBe(`Exported | ${APP_NAME}`);
        expect(titleFor('editor', { phase: 'failed' })).toBe(`Editing | ${APP_NAME}`);
    });

    it('falls back to zeroed defaults when no context is given', () => {
        expect(titleFor('recording')).toBe(`● REC 00:00 | ${APP_NAME}`);
        expect(titleFor('editor', { phase: 'exporting' })).toBe(`Exporting… 0% | ${APP_NAME}`);
    });

    it('lets an error pre-empt the state', () => {
        expect(titleFor('recording', { hasError: true, elapsed: 42 })).toBe(
            `Something went wrong | ${APP_NAME}`
        );
        expect(titleFor('check', { hasError: true })).toBe(`Something went wrong | ${APP_NAME}`);
    });
});
