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
    /** Skip the first-visit welcome modal (default true). */
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

    card(name: string | RegExp) {
        return this.page.getByRole('button', { name });
    }

    /** Record one take: from Setup (first) or Review (resume). Ends on Review. */
    async recordTake(seconds: number): Promise<void> {
        const resume = this.card(/Resume recording/);
        if (await resume.isVisible()) await resume.click();
        else await this.card(/No screen selected/).click();
        await expect(this.page.getByText('REC', { exact: true })).toBeVisible({ timeout: 10_000 });
        await this.page.waitForTimeout(seconds * 1000);
        await this.card(/Recording in progress/).click();
        await expect(this.card(/Resume recording/)).toBeVisible({ timeout: 10_000 });
    }

    /** Review → Editor, waiting out any stitching and the thumbnail strip. */
    async openEditor(): Promise<void> {
        await this.card(/Edit recording/).click();
        await expect(this.exportButton).toBeVisible({ timeout: 60_000 });
        // The strip renders a partial window until it has measured its width;
        // wait until the cell count stops changing.
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

    get exportButton() {
        return this.page.getByRole('button', { name: 'Export & Download' });
    }

    /** Frame-strip cells in on-screen order (deleted ones are removed). */
    get cells() {
        return this.page.locator('div[role="button"].shrink-0');
    }

    /** The editor's "Final: m:ss" read-out, in seconds. */
    async finalDuration(): Promise<number> {
        const text = await this.page.getByText(/^Final: /).textContent();
        const [, m, s] = /Final: (\d+):(\d+)/.exec(text ?? '') ?? [];
        return Number(m) * 60 + Number(s);
    }

    /**
     * Cut cells `from`..`to` (inclusive, raw cell indices). Cut later ranges
     * first, or earlier cuts shift the on-screen positions of later cells.
     */
    async cut(from: number, to: number): Promise<void> {
        const before = await this.cells.count();
        if (this.deleted.some((d) => d.startTime < from * SAMPLE_INTERVAL)) {
            throw new Error('cut later ranges first');
        }
        await this.page.getByRole('button', { name: 'Cut' }).click();
        await this.cells.nth(from).click();
        await this.cells.nth(to).click();
        await this.page.getByRole('button', { name: 'Delete' }).click();
        await expect(this.cells).toHaveCount(before - (to - from + 1));
        this.deleted.push({
            startTime: from * SAMPLE_INTERVAL,
            endTime: (to + 1) * SAMPLE_INTERVAL
        });
    }

    /** Export, then return the auto-downloaded file. */
    async exportAndDownload(): Promise<{ filename: string; bytes: Buffer }> {
        const download = this.page.waitForEvent('download', { timeout: 90_000 });
        await this.exportButton.click();
        const file = await download;
        return { filename: file.suggestedFilename(), bytes: await readFile((await file.path())!) };
    }

    /** The takes crash recovery saved to OPFS, waiting for `count` to land. */
    async readTakes(count: number): Promise<Buffer[]> {
        await expect.poll(() => this.page.evaluate(opfsTakeCount), { timeout: 10_000 }).toBe(count);
        const b64 = await this.page.evaluate(readOpfsTakes);
        return b64.map((s) => Buffer.from(s, 'base64'));
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
