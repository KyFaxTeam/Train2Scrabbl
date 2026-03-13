import { test, expect } from '@playwright/test';

test.describe('UI renders correctly', () => {

    test('home page loads', async ({ page, isMobile }) => {
        await page.goto('/');
        await page.waitForTimeout(1000);
        const suffix = isMobile ? 'mobile' : 'desktop';
        await page.screenshot({ path: `e2e/screenshots/home-${suffix}.png`, fullPage: true });
        // Page should have rendered (body not empty)
        const body = await page.locator('body').innerHTML();
        expect(body.length).toBeGreaterThan(100);
    });

    test('training page loads', async ({ page, isMobile }) => {
        await page.goto('/training');
        await page.waitForTimeout(5000);
        const suffix = isMobile ? 'mobile' : 'desktop';
        await page.screenshot({ path: `e2e/screenshots/training-${suffix}.png`, fullPage: true });
        // The page should contain one of: loading text, error text, or arena content
        const bodyText = await page.locator('body').innerText();
        const hasExpectedContent = bodyText.includes('Chargement') ||
            bodyText.includes('Oups') ||
            bodyText.includes('Arena') ||
            bodyText.includes('VALIDER');
        expect(hasExpectedContent).toBeTruthy();
    });

    test('desktop sidebar is visible on wide viewport', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        await page.goto('/');
        await expect(page.locator('text=The Codex')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=The Arena')).toBeVisible();
        await expect(page.locator('text=Training')).toBeVisible();
    });

    test('mobile hides sidebar', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile only');
        await page.goto('/');
        await page.waitForTimeout(1000);
        // Sidebar spans should be hidden on mobile
        const codexSpan = page.locator('span.whitespace-nowrap:has-text("The Codex")');
        await expect(codexSpan).toBeHidden();
    });

    test('navigate to training from home', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only — sidebar nav');
        await page.goto('/');
        await page.click('text=Training');
        await page.waitForURL('**/training');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'e2e/screenshots/training-via-nav.png', fullPage: true });
    });
});
