import { defineConfig } from '@playwright/test';


const isCI = !!process.env.CI;

export default defineConfig({
    testDir: 'e2e',
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    workers: isCI ? 1 : undefined,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5173',
        headless: isCI ? true : false
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !isCI,
        timeout: 30_000
    }
});
