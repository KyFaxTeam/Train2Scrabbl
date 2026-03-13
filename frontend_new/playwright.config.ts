import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:5173',
        headless: true,
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npx vite --port 5173',
        port: 5173,
        reuseExistingServer: true,
        timeout: 30000,
    },
    projects: [
        {
            name: 'desktop',
            use: { viewport: { width: 1280, height: 800 } },
        },
        {
            name: 'mobile',
            use: { viewport: { width: 375, height: 812 }, isMobile: true },
        },
    ],
});
