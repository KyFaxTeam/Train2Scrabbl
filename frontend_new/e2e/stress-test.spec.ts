import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.describe('Engine Performance Stress Test', () => {
    test.setTimeout(300000); // 5 minutes

    test('generate 20 rapid scenarios in Training', async ({ page }) => {
        console.log('Running stress test via Training UI...');

        await page.goto('/training');
        await page.waitForTimeout(2000); // Wait for initialization

        const LOOPS = 20;
        const times = [];
        let failures = 0;

        for (let i = 0; i < LOOPS; i++) {
            const startTime = performance.now();
            
            const skipBtn = page.locator('button', { hasText: /Passer/i }).first();
            if (await skipBtn.isVisible()) {
                await skipBtn.click({ force: true });
            }

            const validerBtn = page.locator('button', { hasText: /VALIDER/i }).first();
            if (await validerBtn.isVisible()) {
                await validerBtn.click({ force: true });
            }

            // Short wait allowing UI to unmount previous tiles
            await page.waitForTimeout(50);
            
            // Wait for new rack to render
            await expect(page.locator('.rack-tile').first()).toBeVisible({ timeout: 5000 }).catch(() => failures++);
            
            const endTime = performance.now();
            times.push(endTime - startTime);
        }

        if (times.length > 0) {
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            const max = Math.max(...times);
            const min = Math.min(...times);
            const p95 = times.sort((a,b)=>a-b)[Math.floor(times.length * 0.95)] || 0;
            
            const results = `
=== STRESS TEST RESULTS ===
Puzzles generated: ${times.length}
Failures: ${failures}
Average Time (inc. UI render): ${avg.toFixed(2)} ms/puzzle
Min Time: ${min.toFixed(2)} ms/puzzle
Max Time: ${max.toFixed(2)} ms/puzzle
P95 Time: ${p95.toFixed(2)} ms/puzzle
===========================
            `;
            console.log(results);
            fs.writeFileSync('stress-results.txt', results);
            
            expect(avg).toBeLessThan(1000); 
            expect(failures).toBeLessThan(5);
        } else {
            throw new Error("No puzzles were generated successfully.");
        }
    });
});
