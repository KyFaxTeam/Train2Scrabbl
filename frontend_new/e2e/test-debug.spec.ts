import { test, expect } from '@playwright/test';

test('Revision and Training User Journey - Lettres chères', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/Train2Scrabbl/codex');
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Recherche', exact: true }).click();
    await page.waitForTimeout(1000);

    const wordsToLearn = ['AABLLWY', 'JACAMAR', 'ZARABES'];
    
    for (const word of wordsToLearn) {
        const searchInput = page.locator('input[placeholder*="Rechercher"]');
        await searchInput.fill(word);
        await page.waitForTimeout(1500); 

        // Let's just dump the innerText of the app to console
        const text = await page.innerText('.max-w-2xl');
        console.log(`Results for ${word}:`, text.substring(0, 200).replace(/\n/g, ' '));
    }
});
