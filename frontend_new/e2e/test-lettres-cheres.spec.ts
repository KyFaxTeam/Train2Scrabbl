import { test, expect } from '@playwright/test';

test('Revision and Training User Journey - Lettres chères', async ({ page }) => {
    test.setTimeout(180000);
    console.log('Starting journey: Revision -> Training');

    await page.goto('/Train2Scrabbl/codex');
    await page.waitForTimeout(1000);

    console.log('Switching to search...');
    await page.getByRole('button', { name: 'Recherche', exact: true }).click();
    await page.waitForTimeout(1000);

    const wordsToLearn = ['WALLABY', 'JACAMAR', 'ZAGAIES'];

    for (const word of wordsToLearn) {
        console.log(`Searching for ${word}...`);
        const searchInput = page.locator('input[placeholder*="Rechercher"]');
        await searchInput.fill('');
        await searchInput.fill(word);
        await page.waitForTimeout(1500);

        const categoryHeader = page.getByText(/tirage/i).first();
        if (await categoryHeader.isVisible({ timeout: 2000 })) {
            await categoryHeader.click();
            await page.waitForTimeout(500);
        }

        const wordText = page.locator(`span.font-medium`, { hasText: word }).first();
        if (await wordText.isVisible({ timeout: 2000 })) {
            await wordText.click();
            await page.waitForTimeout(500);
            console.log(`Viewed ${word}`);
        } else {
            console.log(`Could not find ${word} inside the category`);
        }
    }

    console.log('Navigating to Training...');
    await page.goto('/Train2Scrabbl/training');
    await page.waitForTimeout(3000);
    console.log('Training loaded');

    for (let i = 0; i < 3; i++) {
        console.log(`Playing turn ${i + 1}...`);
        await page.waitForTimeout(2000);

        // Try generic match if GetByRole fails
        const skipBtn = page.locator('button', { hasText: /Passer/i }).first();
        if (await skipBtn.isVisible()) {
            await skipBtn.click({ force: true });
            console.log('Clicked Passer');
            await page.waitForTimeout(1000);
        }

        const validerBtn = page.locator('button', { hasText: /VALIDER/i }).first();
        if (await validerBtn.isVisible()) {
            await validerBtn.click({ force: true });
            console.log('Clicked VALIDER');
            await page.waitForTimeout(1000);
        } else {
            const nextBtn2 = page.locator('button', { hasText: /Passer/i }).first();
            if (await nextBtn2.isVisible()) {
                await nextBtn2.click({ force: true });
                console.log('Clicked Passer (next)');
            }
        }
    }

    console.log('Journey completed successfully!');
});
