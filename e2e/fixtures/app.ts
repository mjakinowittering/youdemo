import { readFile } from 'node:fs/promises';

import { SAMPLE_INTERVAL } from '../../src/lib/editorMath';
import type { DeletedRange } from '../../src/lib/types';
import { test as base, expect, type Browser, type Page, type TestInfo } from '@playwright/test';

import {
    BARCODE,
    CODE_MS,
    HEIGHT,
    installFakeDisplay,
    WIDTH,
    type FakeDisplayOptions
} from './fakeDisplay';

export interface AppOptions extends FakeDisplayOptions {
    /** Mark the welcome as seen, so Setup opens as for a returning visitor (default true). */
    welcomed?: boolean;
}

/** Drives the app through its screens by role and visible text; no test hooks. */
export class App {
    /** Cuts made so far, in raw (joined-timeline) seconds, for the checks. */
    readonly deleted: DeletedRange[] = [];

    constructor(readonly page: Page) {}

    static async prepare(page: Page, opts: AppOptions = {}): Promise<App> {
        await page.addInitScript(installFakeDisplay, {
            ...opts,
            width: WIDTH,
            height: HEIGHT,
            barcode: BARCODE,
            codeMs: CODE_MS
        });
        if (opts.welcomed !== false) {
            await page.addInitScript(() => localStorage.setItem('ydWelcomed', 'true'));
        }
        return new App(page);
    }

    async goto(): Promise<void> {
        await this.page.goto('./');
    }

    button(name: string | RegExp, exact = false) {
        return this.page.getByRole('button', { name, exact });
    }

    /** Setup's one action; its picker starts the countdown. */
    get chooseButton() {
        return this.button('Choose what to share');
    }

    get stopButton() {
        return this.button('Stop recording');
    }

    /** Review's heading, "2 takes, 00:04 in total". */
    get reviewHeading() {
        return this.page.getByRole('heading', { name: /^\d+ takes?, \d\d:\d\d in total$/ });
    }

    /** The footer's Export, which opens the dialog. */
    get exportButton() {
        return this.page.getByRole('button', { name: 'Export', exact: true }).first();
    }

    /**
     * Record one take: from Setup (first) or Review (Record take N, reusing the
     * live share unless `newShare` picks again with Change). Ends on Review.
     */
    async recordTake(seconds: number, newShare = false): Promise<void> {
        const next = this.button(/^Record take \d+$/);
        if (newShare && (await next.isVisible())) {
            const picked = await this.pickerCalls();
            await this.button('Change').click();
            await expect.poll(() => this.pickerCalls()).toBe(picked + 1);
        }
        if (await next.isVisible()) await next.click();
        else await this.chooseButton.click();
        await expect(this.stopButton).toBeVisible({ timeout: 10_000 });
        await this.page.waitForTimeout(seconds * 1000);
        await this.stopButton.click();
        await expect(this.reviewHeading).toBeVisible({ timeout: 10_000 });
    }

    /** Review → Editor, waiting out any joining and the frame strip. */
    async openEditor(): Promise<void> {
        await this.button('Edit and export').click();
        await expect(this.exportButton).toBeEnabled({ timeout: 60_000 });
        // The strip renders once the video's duration is known; wait until the
        // frame count stops changing.
        let last = -1;
        await expect
            .poll(
                async () => {
                    const n = await this.cells.count();
                    const settled = n > 0 && n === last;
                    last = n;
                    return settled;
                },
                { intervals: [300], timeout: 10_000 }
            )
            .toBe(true);
    }

    /** Frames of the strip in on-screen order (cut ones are left out). */
    get cells() {
        return this.page.getByRole('button', { name: /^Frame \d+$/ });
    }

    /** The "mm:ss after cuts" label, in seconds. */
    async finalDuration(): Promise<number> {
        const text = await this.page.getByText(/after cuts$/).textContent();
        const [, m, s] = /(\d+):(\d+) after cuts/.exec(text ?? '') ?? [];
        return Number(m) * 60 + Number(s);
    }

    /**
     * Cut cells `from`..`to` (inclusive, raw cell indices) in trim mode. Cut
     * later ranges first, or earlier cuts shift the on-screen positions of
     * later cells.
     */
    async cut(from: number, to: number): Promise<void> {
        const before = await this.cells.count();
        if (this.deleted.some((d) => d.startTime < from * SAMPLE_INTERVAL)) {
            throw new Error('cut later ranges first');
        }
        await this.button('Trim', true).click();
        await this.cells.nth(from).click();
        await this.cells.nth(to).click();
        await this.button(/^Remove /).click();
        await expect(this.cells).toHaveCount(before - (to - from + 1));
        await this.button('Done trimming').click();
        this.deleted.push({
            startTime: from * SAMPLE_INTERVAL,
            endTime: (to + 1) * SAMPLE_INTERVAL
        });
    }

    /** Export, then return the auto-downloaded file. */
    async exportAndDownload(): Promise<{ filename: string; bytes: Buffer }> {
        const download = this.page.waitForEvent('download', { timeout: 90_000 });
        await this.exportButton.click();
        await this.page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'Export', exact: true })
            .click();
        const file = await download;
        return { filename: file.suggestedFilename(), bytes: await readFile((await file.path())!) };
    }

    /** The takes crash recovery saved to OPFS, waiting for `count` to land. */
    async readTakes(count: number): Promise<Buffer[]> {
        await expect.poll(() => this.page.evaluate(opfsTakeCount), { timeout: 10_000 }).toBe(count);
        const b64 = await this.page.evaluate(readOpfsTakes);
        return b64.map((s) => Buffer.from(s, 'base64'));
    }

    /** How many times the screen picker has been opened. */
    async pickerCalls(): Promise<number> {
        return this.page.evaluate(() => window.__e2eDisplay!.calls);
    }

    async opfsTakeCount(): Promise<number> {
        return this.page.evaluate(opfsTakeCount);
    }
}

// crashStore.ts file naming: crash-recording-<n>.webm, contiguous from 0.
async function opfsTakeCount(): Promise<number> {
    const root = await navigator.storage.getDirectory();
    let n = 0;
    for (;;) {
        try {
            const file = await (await root.getFileHandle(`crash-recording-${n}.webm`)).getFile();
            if (file.size === 0) return n;
            n++;
        } catch {
            return n;
        }
    }
}

async function readOpfsTakes(): Promise<string[]> {
    const root = await navigator.storage.getDirectory();
    const out: string[] = [];
    for (let n = 0; ; n++) {
        let file: File;
        try {
            file = await (await root.getFileHandle(`crash-recording-${n}.webm`)).getFile();
        } catch {
            return out;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
            bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        out.push(btoa(bin));
    }
}

/**
 * A fresh context with the project's settings, for `beforeAll` blocks that
 * share one recording across several tests (fixtures aren't available there).
 */
export async function newAppPage(
    browser: Browser,
    testInfo: TestInfo,
    opts: AppOptions = {}
): Promise<App> {
    const { baseURL, viewport, permissions } = testInfo.project.use;
    const context = await browser.newContext({
        baseURL,
        viewport,
        permissions,
        acceptDownloads: true
    });
    return App.prepare(await context.newPage(), opts);
}

export const test = base.extend<{ appOptions: AppOptions; app: App }>({
    appOptions: [{}, { option: true }],
    app: async ({ page, appOptions }, use) => {
        const app = await App.prepare(page, appOptions);
        await app.goto();
        await use(app);
    }
});

export { expect };
