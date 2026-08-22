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
            
            await page.waitForTimeout(500);

            let nextBtn2 = page.locator('button', { hasText: /Passer/i }).first();
            if (await nextBtn2.isVisible()) {
                await nextBtn2.click({ force: true });
            } else {
                nextBtn2 = page.locator('button', { hasText: /Continuer|Suivant/i }).first();
                if (await nextBtn2.isVisible()) await nextBtn2.click({ force: true });
            }

            // Wait for new rack to render by checking that loading spinner is gone and tiles exist
            try {
                await expect(page.locator('.rack-tile').first()).toBeVisible({ timeout: 5000 });
                // We should also wait until 'Génération...' text disappears
                await expect(page.locator('text=Génération')).not.toBeVisible({ timeout: 5000 });
                const endTime = performance.now();
                times.push(endTime - startTime);
            } catch (e) {
                failures++;
            }
        }

        if (times.length > 0) {
            const avg = times.reduce((a, b) => a + b, 0) / times.length;        
            const max = Math.max(...times);
            const min = Math.min(...times);
            const p95 = times.sort((a,b)=>a-b)[Math.floor(times.length * 0.95)] || 0;
            const results = "\n=== STRESS TEST RESULTS ===\nPuzzles generated: " + times.length + "\nFailures: " + failures + "\nAverage Time (inc. UI render): " + avg.toFixed(2) + " ms/puzzle\nMin Time: " + min.toFixed(2) + " ms/puzzle\nMax Time: " + max.toFixed(2) + " ms/puzzle\nP95 Time: " + p95.toFixed(2) + " ms/puzzle\n===========================\n";
            console.log(results);
            fs.writeFileSync('stress-results.txt', results);

            expect(avg).toBeLessThan(2000);
            expect(failures).toBeLessThan(5);
        } else {
            throw new Error("No puzzles were generated successfully.");
        }
    });
});
