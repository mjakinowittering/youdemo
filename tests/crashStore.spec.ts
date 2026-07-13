import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clear, loadSegments, saveSegment } from '$lib/crashStore.js';

// ── Minimal in-memory fake of the OPFS surface crashStore uses ───────────────
// (navigator.storage.getDirectory → FileSystemDirectoryHandle with
// getFileHandle / removeEntry, plus createWritable / getFile).

class FakeWritable {
    private chunks: Blob[] = [];
    constructor(
        private store: Map<string, Blob>,
        private name: string
    ) {}
    async write(blob: Blob) {
        this.chunks.push(blob);
    }
    async close() {
        this.store.set(this.name, new Blob(this.chunks));
    }
}

class FakeFileHandle {
    constructor(
        private store: Map<string, Blob>,
        private name: string,
        private failWrite = false
    ) {}
    async createWritable() {
        if (this.failWrite) throw new Error('quota exceeded');
        return new FakeWritable(this.store, this.name);
    }
    async getFile(): Promise<Blob> {
        return this.store.get(this.name)!;
    }
}

class FakeDirectory {
    store = new Map<string, Blob>();
    failWriteFor = new Set<string>();
    async getFileHandle(name: string, opts?: { create?: boolean }) {
        if (!this.store.has(name)) {
            if (!opts?.create) throw new Error('NotFoundError');
            this.store.set(name, new Blob([]));
        }
        return new FakeFileHandle(this.store, name, this.failWriteFor.has(name));
    }
    async removeEntry(name: string) {
        if (!this.store.has(name)) throw new Error('NotFoundError');
        this.store.delete(name);
    }
}

const NAME = (i: number) => `crash-recording-${i}.webm`;

let dir: FakeDirectory;

function stubOPFS(getDirectory: () => Promise<FakeDirectory>) {
    vi.stubGlobal('navigator', { storage: { getDirectory } });
}

beforeEach(() => {
    dir = new FakeDirectory();
    stubOPFS(async () => dir);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('saveSegment', () => {
    it('persists a take under its contiguous index', async () => {
        await saveSegment(0, new Blob(['a']));
        await saveSegment(1, new Blob(['bb']));
        expect(dir.store.has(NAME(0))).toBe(true);
        expect(dir.store.get(NAME(1))!.size).toBe(2);
    });

    it('overwrites an existing index', async () => {
        await saveSegment(0, new Blob(['a']));
        await saveSegment(0, new Blob(['zzz']));
        expect(dir.store.get(NAME(0))!.size).toBe(3);
    });

    it('degrades silently when a write fails (quota exceeded)', async () => {
        dir.failWriteFor.add(NAME(0));
        await expect(saveSegment(0, new Blob(['a']))).resolves.toBeUndefined();
    });
});

describe('loadSegments', () => {
    it('reads contiguous takes back in order', async () => {
        await saveSegment(0, new Blob(['a']));
        await saveSegment(1, new Blob(['bb']));
        await saveSegment(2, new Blob(['ccc']));
        const blobs = await loadSegments();
        expect(blobs.map((b) => b.size)).toEqual([1, 2, 3]);
    });

    it('stops at the first missing index (drops a non-contiguous tail)', async () => {
        await saveSegment(0, new Blob(['a']));
        await saveSegment(1, new Blob(['b']));
        await saveSegment(3, new Blob(['d'])); // gap at 2
        const blobs = await loadSegments();
        expect(blobs.map((b) => b.size)).toEqual([1, 1]);
    });

    it('drops a half-written (empty) trailing take', async () => {
        await saveSegment(0, new Blob(['a']));
        await saveSegment(1, new Blob(['b']));
        dir.store.set(NAME(2), new Blob([])); // 0-byte partial write
        const blobs = await loadSegments();
        expect(blobs).toHaveLength(2);
    });

    it('returns an empty array when nothing was saved', async () => {
        expect(await loadSegments()).toEqual([]);
    });
});

describe('clear', () => {
    it('removes all contiguous take files', async () => {
        await saveSegment(0, new Blob(['a']));
        await saveSegment(1, new Blob(['b']));
        await saveSegment(2, new Blob(['c']));
        await clear();
        expect(dir.store.size).toBe(0);
        expect(await loadSegments()).toEqual([]);
    });

    it('is a no-op when there is nothing to clear', async () => {
        await expect(clear()).resolves.toBeUndefined();
        expect(dir.store.size).toBe(0);
    });
});

describe('OPFS unavailable (getDirectory throws)', () => {
    beforeEach(() => {
        stubOPFS(async () => {
            throw new Error('OPFS unsupported');
        });
    });

    it('saveSegment / clear no-op and loadSegments yields []', async () => {
        await expect(saveSegment(0, new Blob(['a']))).resolves.toBeUndefined();
        await expect(clear()).resolves.toBeUndefined();
        expect(await loadSegments()).toEqual([]);
    });
});
