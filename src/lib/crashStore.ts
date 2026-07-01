const FILE_NAME = 'crash-recording.webm';

async function getRoot(): Promise<FileSystemDirectoryHandle | null> {
    try {
        return await navigator.storage.getDirectory();
    } catch {
        return null;
    }
}

export async function hasBlob(): Promise<boolean> {
    const root = await getRoot();
    if (!root) return false;
    try {
        await root.getFileHandle(FILE_NAME);
        return true;
    } catch {
        return false;
    }
}

export async function saveBlob(blob: Blob): Promise<void> {
    const root = await getRoot();
    if (!root) return;
    try {
        const handle = await root.getFileHandle(FILE_NAME, { create: true });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
    } catch {
        /* OPFS unavailable or quota exceeded — crash protection skipped */
    }
}

export async function loadBlob(): Promise<Blob | null> {
    const root = await getRoot();
    if (!root) return null;
    try {
        const handle = await root.getFileHandle(FILE_NAME);
        return await handle.getFile();
    } catch {
        return null;
    }
}

export async function deleteBlob(): Promise<void> {
    const root = await getRoot();
    if (!root) return;
    try {
        await root.removeEntry(FILE_NAME);
    } catch {
        /* already gone */
    }
}
