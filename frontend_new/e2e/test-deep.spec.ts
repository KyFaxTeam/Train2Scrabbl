import { test, expect } from '@playwright/test';

test('Test deep search fallback', async ({ page }) => {
    await page.goto('/Train2Scrabbl/codex');
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Recherche', exact: true }).click();
    await page.waitForTimeout(1000);

    const searchInput = page.locator('input[placeholder*="Rechercher"]');
    await searchInput.fill("WALLABY");
    await page.waitForTimeout(3000); // give time for the deep search
    
    const count = await page.locator('.font-medium').count();
    console.log(`Found ${count} tags with font-medium`);
    
    for(let i=0; i<count; i++) {
        console.log(await page.locator('.font-medium').nth(i).innerText());
    }
});
