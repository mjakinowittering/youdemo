import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Serves MediaPipe WASM files from node_modules in dev mode.
// vite-plugin-static-copy only runs during build, so dev needs its own middleware.
function mediapipeDevPlugin() {
    return {
        name: 'mediapipe-dev-serve',
        configureServer(server: import('vite').ViteDevServer) {
            server.middlewares.use('/mediapipe/wasm', (req, res, next) => {
                const filename = (req.url ?? '').replace(/^\//, '');
                if (!filename) return next();
                try {
                    const filePath = resolve(
                        `node_modules/@mediapipe/tasks-vision/wasm/${filename}`
                    );
                    const content = readFileSync(filePath);
                    res.setHeader(
                        'Content-Type',
                        filename.endsWith('.wasm') ? 'application/wasm' : 'application/javascript'
                    );
                    res.end(content);
                } catch {
                    next();
                }
            });
        }
    };
}

export default defineConfig({
    plugins: [tailwindcss(), sveltekit(), mediapipeDevPlugin()],
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
