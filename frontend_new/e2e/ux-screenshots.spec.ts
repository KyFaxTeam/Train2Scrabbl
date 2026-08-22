import { test, expect } from '@playwright/test';

test.describe('UX Screenshots', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('Capture UX states', async ({ page }) => {
        const artifactsDir = 'e2e/screenshots/ux';

        // 1. Initial Load to /arena via proper base URL
        await page.goto('/Train2Scrabbl/arena');

        // Wait for the app to load and hide the loading screen
        await expect(page.locator('text=Chargement')).toBeHidden({ timeout: 15000 });
        await page.waitForTimeout(1000); // Give it a moment to render

        // --- ARENA / CODEX ---
        // Take initial arena screenshot
        await page.screenshot({ path: `${artifactsDir}/1_arena_home.png` });

        // Click on the first category "Les Indispensables"
        await page.locator('text=Les Indispensables').click();
        await page.waitForTimeout(500); // wait for category to expand

        // Click on the first entry card
        // We look for a card div. We know they cursor-pointer class and some shadow
        const entryCards = page.locator('div.cursor-pointer');
        await entryCards.first().click();
        await page.waitForTimeout(500); // wait for modal
        await page.screenshot({ path: `${artifactsDir}/2_codex_expanded.png` });

        // Click on "Suivant"
        const nextButton = page.locator('button:has-text("Suivant")');
        if (await nextButton.isVisible()) {
            await nextButton.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: `${artifactsDir}/3_codex_page2.png` });

            // Try to click "Terminer" (which should show warning)
            const terminerBtn = page.locator('button:has-text("Terminer")');
            if (await terminerBtn.isVisible()) {
                await terminerBtn.click();
                await page.waitForTimeout(500);
                await page.screenshot({ path: `${artifactsDir}/4_codex_warning.png` });
            }

            // Try to click the close button (SVG X icon usually top right) or background
            await page.keyboard.press('Escape');
        }

        // --- TRAINING ---
        await page.goto('/Train2Scrabbl/training');
        await expect(page.locator('text=Chargement')).toBeHidden({ timeout: 15000 });
        await page.waitForTimeout(1000);

        // We should be on word validation training
        const startBtn = page.locator('button:has-text("Nouvelle Partie")');
        if (await startBtn.isVisible()) {
            await startBtn.click();
            await page.waitForTimeout(500);
        }

        // Training front screenshot (before interacting)
        await page.screenshot({ path: `${artifactsDir}/5_training_front.png` });

        // Let's validate one word to flip it
        const checkBtn = page.locator('button[aria-label="Valider le mot"]');
        if (await checkBtn.isVisible()) {
            await checkBtn.click();
            await page.waitForTimeout(800); // flip animation
            await page.screenshot({ path: `${artifactsDir}/6_training_back.png` });
        }

        // Now let's try to cancel/quit early to see warning
        const quitBtn = page.locator('button:has-text("Quitter")');
        if (await quitBtn.isVisible()) {
            await quitBtn.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: `${artifactsDir}/7_training_warning.png` });
        }
    });
});
