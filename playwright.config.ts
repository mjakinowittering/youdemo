import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the production build, served under the same base
// path as GitHub Pages so asset 404s surface here, not after a deploy.
// Recording runs in real time, so one worker: parallel runs only add jitter.
export default defineConfig({
    testDir: 'e2e',
    workers: 1,
    timeout: 120_000,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: 'http://localhost:4173/youdemo/',
        acceptDownloads: true,
        trace: 'retain-on-failure',
        permissions: ['camera', 'microphone']
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Wide enough that the editor's frame strip renders every cell,
                // so cuts can be picked by position without scrolling.
                viewport: { width: 4000, height: 1000 },
                launchOptions: {
                    args: [
                        '--use-fake-device-for-media-stream',
                        '--use-fake-ui-for-media-stream',
                        '--autoplay-policy=no-user-gesture-required'
                    ]
                }
            }
        }
    ],
    webServer: {
        command: 'npm run build && npm run preview',
        env: { BASE_PATH: '/youdemo' },
        url: 'http://localhost:4173/youdemo/',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000
    }
});
