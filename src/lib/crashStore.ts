// Crash recovery via OPFS. Each recorded take is persisted as its own file
// (`crash-recording-<index>.webm`) as it is captured, so a tab/renderer crash or
// accidental reload can recover the whole recording — every take, not just the
// last — without re-encoding anything on the hot path. Indices are contiguous
// (0, 1, 2, …); every write path clears the set before a fresh recording begins.

const FILE_PREFIX = 'crash-recording-';
const FILE_SUFFIX = '.webm';

function fileName(index: number): string {
    return `${FILE_PREFIX}${index}${FILE_SUFFIX}`;
}

async function getRoot(): Promise<FileSystemDirectoryHandle | null> {
    try {
        return await navigator.storage.getDirectory();
    } catch {
        return null;
    }
}

export async function saveSegment(index: number, blob: Blob): Promise<void> {
    const root = await getRoot();
    if (!root) return;
    try {
        const handle = await root.getFileHandle(fileName(index), { create: true });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
    } catch {
        /* OPFS unavailable or quota exceeded — crash protection skipped */
    }
}

export async function loadSegments(): Promise<Blob[]> {
    const root = await getRoot();
    if (!root) return [];
    const blobs: Blob[] = [];
    // Read contiguous indices until one is missing (or a partial write left an
    // empty file). A half-written trailing take is simply dropped.
    for (let i = 0; ; i++) {
        try {
            const handle = await root.getFileHandle(fileName(i));
            const file = await handle.getFile();
            if (file.size === 0) break;
            blobs.push(file);
        } catch {
            break;
        }
    }
    return blobs;
}

export async function clear(): Promise<void> {
    const root = await getRoot();
    if (!root) return;
    for (let i = 0; ; i++) {
        try {
            await root.removeEntry(fileName(i));
        } catch {
            break;
        }
    }
}
