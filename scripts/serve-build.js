import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

// Serves build/ the way GitHub Pages does: under BASE_PATH (match the build),
// index.html for directories, 404.html otherwise. Backs `npm run preview` and
// the E2E suite. Not `vite preview`: that serves SvelteKit's own output, which
// lacks the MediaPipe WASM that postbuild copies into build/.

const BASE = process.env.BASE_PATH ?? '';
const ROOT = 'build';
const PORT = Number(process.env.PORT ?? 4173);
const TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.tflite': 'application/octet-stream'
};

async function resolveFile(urlPath) {
    const path = join(ROOT, normalize(decodeURIComponent(urlPath)));
    try {
        const s = await stat(path);
        return s.isDirectory() ? join(path, 'index.html') : path;
    } catch {
        return null;
    }
}

createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const file = pathname.startsWith(BASE) ? await resolveFile(pathname.slice(BASE.length)) : null;
    try {
        const body = await readFile(file ?? join(ROOT, '404.html'));
        res.writeHead(file ? 200 : 404, {
            'content-type': TYPES[extname(file ?? '.html')] ?? 'application/octet-stream'
        });
        res.end(body);
    } catch {
        res.writeHead(404).end();
    }
}).listen(PORT, () => console.log(`Serving ${ROOT}/ at http://localhost:${PORT}${BASE}/`));
