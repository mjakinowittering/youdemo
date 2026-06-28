import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Serves vendored WASM assets from node_modules in dev mode.
// The postbuild copy script only runs during build, so dev needs its own middleware.
function vendoredWasmDevPlugin() {
    const mounts: Record<string, string> = {
        '/mediapipe/wasm': 'node_modules/@mediapipe/tasks-vision/wasm'
    };
    return {
        name: 'vendored-wasm-dev-serve',
        configureServer(server: import('vite').ViteDevServer) {
            for (const [route, dir] of Object.entries(mounts)) {
                server.middlewares.use(route, (req, res, next) => {
                    const filename = (req.url ?? '').replace(/^\//, '');
                    if (!filename) return next();
                    try {
                        const content = readFileSync(resolve(`${dir}/${filename}`));
                        res.setHeader(
                            'Content-Type',
                            filename.endsWith('.wasm')
                                ? 'application/wasm'
                                : 'application/javascript'
                        );
                        res.end(content);
                    } catch {
                        next();
                    }
                });
            }
        }
    };
}

export default defineConfig({
    plugins: [tailwindcss(), sveltekit(), vendoredWasmDevPlugin()],
    test: {
        expect: { requireAssertions: true },
        projects: [
            {
                extends: './vite.config.ts',
                test: {
                    name: 'client',
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        instances: [{ browser: 'chromium', headless: true }]
                    },
                    include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
                    exclude: ['src/lib/server/**']
                }
            },

            {
                extends: './vite.config.ts',
                test: {
                    name: 'server',
                    environment: 'node',
                    include: ['src/**/*.{test,spec}.{js,ts}'],
                    exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
                }
            }
        ]
    }
});
