import { test, expect } from '@playwright/test';

test.describe('Worker Natural Flow Speed Test', () => {
    test.setTimeout(120000); // Need more time for testing
    test('Generate scenarios back to back and measure times', async ({ page }) => {
        page.on('console', msg => {
            console.log(`[Browser Console]: [${msg.type()}] ${msg.text()}`);
        });
        page.on('pageerror', err => {
            console.log(`[Browser PageError]: ${err.message}`);
        });
        page.on('worker', worker => {
            console.log(`[worker created]: ${worker.url()}`);
            worker.on('console', msg => console.log(`[Worker Console]: ${msg.text()}`));
        });


        // Navigate to the app to ensure React boots and populates window
        await page.goto('/');

        await page.waitForFunction('window.runSpeedTest !== undefined', { timeout: 30000 });

        const times = await page.evaluate(async () => {
            // @ts-ignore
            await window.runSpeedTest();
            return true;
        });

        expect(times).toBeTruthy();
    });
});
