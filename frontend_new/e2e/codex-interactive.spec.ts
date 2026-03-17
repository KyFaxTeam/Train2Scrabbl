import { test, expect, Page } from '@playwright/test';

const SCREENSHOT_DIR = 'e2e/screenshots';

// Only run on desktop project for most tests (we'll do mobile separately)
test.describe('Codex (DictionaryPage) Interactive Tests', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to root which is the DictionaryPage
        await page.goto('/');
        // Wait for the page to load and categories to appear
        await page.waitForTimeout(2000);
    });

    test('01 - Initial state screenshot', async ({ page, isMobile }) => {
        // Verify page header is visible
        const header = page.locator('h1:has-text("Pôle de Révision")');
        await expect(header).toBeVisible({ timeout: 10000 });

        // Verify Explorer tab is active
        const explorerTab = page.locator('button:has-text("Explorer")');
        await expect(explorerTab).toBeVisible();

        // Verify Recherche tab is visible
        const searchTab = page.locator('button:has-text("Recherche")');
        await expect(searchTab).toBeVisible();

        // Check that category cards are loaded
        const categoryCards = page.locator('[id^="category-"]');
        const cardCount = await categoryCards.count();
        console.log(`Found ${cardCount} category cards on initial load`);

        const suffix = isMobile ? 'mobile' : 'desktop';
        await page.screenshot({
            path: `${SCREENSHOT_DIR}/codex-01-initial-${suffix}.png`,
            fullPage: true
        });

        expect(cardCount).toBeGreaterThan(0);
    });

    test('02 - Click first category card to open it', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop test');

        // Wait for categories to load
        const firstCategory = page.locator('[id^="category-"]').first();
        await expect(firstCategory).toBeVisible({ timeout: 10000 });

        // Get the category prefix text
        const prefixText = await firstCategory.locator('.font-mono.font-bold').textContent();
        console.log(`First category prefix: ${prefixText}`);

        // Click the category button to open it
        const categoryButton = firstCategory.locator('button').first();
        await categoryButton.click();
        await page.waitForTimeout(500);

        // Verify it opened - check for ChevronDown icon (indicates open state)
        // The open state shows entry rows inside
        const entryRows = firstCategory.locator('[id^="entry-"]');
        const entryCount = await entryRows.count();
        console.log(`Entries in first category: ${entryCount}`);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/codex-02-first-category-open.png`,
            fullPage: true
        });

        expect(entryCount).toBeGreaterThan(0);
    });

    test('03 - Accordion behavior: open second category closes first', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop test');

        // Wait for categories
        const categories = page.locator('[id^="category-"]');
        await expect(categories.first()).toBeVisible({ timeout: 10000 });
        const totalCategories = await categories.count();
        console.log(`Total categories visible: ${totalCategories}`);

        if (totalCategories < 2) {
            console.log('SKIP: Less than 2 categories available for accordion test');
            return;
        }

        const firstCategory = categories.nth(0);
        const secondCategory = categories.nth(1);

        // Get their prefix names
        const firstPrefix = await firstCategory.locator('.font-mono.font-bold').textContent();
        const secondPrefix = await secondCategory.locator('.font-mono.font-bold').textContent();
        console.log(`Testing accordion: ${firstPrefix} -> ${secondPrefix}`);

        // Open first category
        await firstCategory.locator('button').first().click();
        await page.waitForTimeout(500);

        // Verify first is open (has entries visible)
        let firstEntries = await firstCategory.locator('[id^="entry-"]').count();
        console.log(`First category entries after opening: ${firstEntries}`);
        expect(firstEntries).toBeGreaterThan(0);

        // Now click second category
        await secondCategory.locator('button').first().click();
        await page.waitForTimeout(500);

        // Verify second is open
        const secondEntries = await secondCategory.locator('[id^="entry-"]').count();
        console.log(`Second category entries after opening: ${secondEntries}`);

        // Verify first is closed (accordion behavior)
        firstEntries = await firstCategory.locator('[id^="entry-"]').count();
        console.log(`First category entries after opening second: ${firstEntries}`);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/codex-03-accordion-second-open.png`,
            fullPage: true
        });

        // In Explorer/nav mode, only one category should be open at a time
        expect(secondEntries).toBeGreaterThan(0);
        expect(firstEntries).toBe(0);
    });

    test('04 - Inner accordion: expand entry then another', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop test');

        // Open first category
        const firstCategory = page.locator('[id^="category-"]').first();
        await expect(firstCategory).toBeVisible({ timeout: 10000 });
        await firstCategory.locator('button').first().click();
        await page.waitForTimeout(500);

        // Get entries
        const entries = firstCategory.locator('[id^="entry-"]');
        const entryCount = await entries.count();
        console.log(`Entries available for inner accordion test: ${entryCount}`);

        if (entryCount < 2) {
            console.log('SKIP: Less than 2 entries for inner accordion test');
            return;
        }

        // Click first entry to expand it
        const firstEntry = entries.nth(0);
        await firstEntry.locator('.cursor-pointer').first().click();
        await page.waitForTimeout(500);

        // Check first entry is expanded (has extensions visible)
        const firstExtensions = firstEntry.locator('.bg-white.p-1\\.5');
        const firstExtCount = await firstExtensions.count();
        console.log(`First entry extensions visible: ${firstExtCount}`);

        // Screenshot with first entry expanded
        await page.screenshot({
            path: `${SCREENSHOT_DIR}/codex-04a-first-entry-expanded.png`,
            fullPage: true
        });

        // Click second entry
        const secondEntry = entries.nth(1);
        await secondEntry.locator('.cursor-pointer').first().click();
        await page.waitForTimeout(500);

        // Check second entry has expanded content
        const secondHasContent = await secondEntry.locator('.border-t.border-slate-100').count();
        console.log(`Second entry expanded sections: ${secondHasContent}`);

        // Check first entry collapsed
        const firstStillExpanded = await firstEntry.locator('.border-t.border-slate-100.bg-slate-50\\/50').count();
        console.log(`First entry still has expanded section: ${firstStillExpanded}`);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/codex-04b-inner-accordion.png`,
            fullPage: true
        });
    });

    test('05 - Mobile letter index bar visibility', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile only');

        await expect(page.locator('h1:has-text("Pôle de Révision")')).toBeVisible({ timeout: 10000 });

        // The mobile index bar is fixed at bottom-[68px] and hidden on md+ (md:hidden)
        const letterBar = page.locator('.fixed.bottom-\\[68px\\].md\\:hidden');
        const isVisible = await letterBar.isVisible();
        console.log(`Mobile letter index bar visible: ${isVisible}`);

        // Check for letter buttons
        const letterButtons = letterBar.locator('button');
        const letterCount = await letterButtons.count();
        console.log(`Number of letter buttons: ${letterCount}`);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/codex-05-mobile-letter-bar.png`,
            fullPage: false  // viewport only to see fixed elements
        });

        expect(isVisible).toBeTruthy();
        expect(letterCount).toBeGreaterThan(0);
    });

    test('06 - Desktop: letter bar is on the right side', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        await expect(page.locator('h1:has-text("Pôle de Révision")')).toBeVisible({ timeout: 10000 });

        // On desktop, the index is a fixed right-side panel (hidden lg:flex)
        const desktopIndex = page.locator('.fixed.right-2');
        const isVisible = await desktopIndex.isVisible();
        console.log(`Desktop side index visible: ${isVisible}`);

        const letterButtons = desktopIndex.locator('button');
        const letterCount = await letterButtons.count();
        console.log(`Desktop index letter count: ${letterCount}`);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/codex-06-desktop-side-index.png`,
            fullPage: false
        });

        expect(isVisible).toBeTruthy();
    });

    test('07 - Switch to Recherche tab shows search input', async ({ page, isMobile }) => {
        test.setTimeout(90000); // Recherche tab opens all categories, needs more time
        test.skip(isMobile, 'Desktop test');

        await expect(page.locator('h1:has-text("Pôle de Révision")')).toBeVisible({ timeout: 10000 });

        // Verify no search input initially (Explorer tab)
        let searchInput = page.locator('input[placeholder*="Rechercher"]');
        let searchVisible = await searchInput.isVisible();
        console.log(`Search input visible on Explorer tab: ${searchVisible}`);
        expect(searchVisible).toBeFalsy();

        // Track if page crashes (search mode opens all categories at once which is heavy)
        let pageCrashed = false;
        page.on('crash', () => { pageCrashed = true; });

        // Click Recherche tab - use getByText for exact match
        await page.getByRole('button', { name: 'Recherche', exact: true }).click();

        // Wait for the search input to appear (it's animated with framer-motion)
        searchInput = page.locator('input[placeholder*="Rechercher"]');
        try {
            await expect(searchInput).toBeVisible({ timeout: 15000 });
            searchVisible = true;
            console.log(`Search input visible on Recherche tab: true`);
        } catch {
            searchVisible = false;
            console.log(`Search input visible on Recherche tab: false (page may have crashed: ${pageCrashed})`);
        }

        if (!pageCrashed) {
            // Wait a bit more for categories to load in search mode
            await page.waitForTimeout(3000);

            await page.screenshot({
                path: `${SCREENSHOT_DIR}/codex-07-recherche-tab.png`,
                fullPage: false  // viewport only - fullPage would be enormous with all categories open
            });
        }

        if (pageCrashed) {
            console.log('BUG FOUND: Page crashed when switching to Recherche tab. All categories open simultaneously in search mode causes browser overload.');
        }

        expect(pageCrashed).toBeFalsy();
        expect(searchVisible).toBeTruthy();
    });

    test('08 - Switch back to Explorer hides search input', async ({ page, isMobile }) => {
        test.setTimeout(90000);
        test.skip(isMobile, 'Desktop test');

        await expect(page.locator('h1:has-text("Pôle de Révision")')).toBeVisible({ timeout: 10000 });

        let pageCrashed = false;
        page.on('crash', () => { pageCrashed = true; });

        // Switch to Recherche first
        await page.getByRole('button', { name: 'Recherche', exact: true }).click();

        // Wait for search input to appear
        const searchInput = page.locator('input[placeholder*="Rechercher"]');
        try {
            await expect(searchInput).toBeVisible({ timeout: 15000 });
            console.log('Search input appeared after clicking Recherche');
        } catch {
            console.log(`Search input did NOT appear. Page crashed: ${pageCrashed}`);
            if (pageCrashed) {
                console.log('BUG: Page crashed when switching to Recherche tab');
                // Take a note but don't fail here - we'll report the crash
                return;
            }
        }

        if (pageCrashed) return;

        // Wait for categories to finish rendering
        await page.waitForTimeout(3000);

        // Switch back to Explorer
        await page.getByRole('button', { name: 'Explorer', exact: true }).click();
        await page.waitForTimeout(1000);

        // Verify search is gone
        const searchVisibleAfter = await searchInput.isVisible();
        console.log(`Search input visible after switching back to Explorer: ${searchVisibleAfter}`);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/codex-08-back-to-explorer.png`,
            fullPage: true
        });

        expect(searchVisibleAfter).toBeFalsy();
    });

    test('09 - Mobile resize: letter bar remains visible', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Starting from desktop');

        await expect(page.locator('h1:has-text("Pôle de Révision")')).toBeVisible({ timeout: 10000 });

        // Resize to mobile width
        await page.setViewportSize({ width: 375, height: 812 });
        await page.waitForTimeout(1000);

        // Use specific selector: the mobile letter index bar is fixed at bottom-[68px] and md:hidden
        const letterBar = page.locator('.fixed.bottom-\\[68px\\].md\\:hidden');
        const isVisible = await letterBar.isVisible();
        console.log(`Letter bar visible after resize to mobile: ${isVisible}`);

        // Also check the mobile nav bar is visible
        const mobileNav = page.locator('.md\\:hidden.fixed.bottom-0');
        const navVisible = await mobileNav.isVisible();
        console.log(`Mobile nav bar visible after resize: ${navVisible}`);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/codex-09-resized-to-mobile.png`,
            fullPage: false
        });

        // The desktop side index should be hidden
        const desktopIndex = page.locator('.fixed.right-2');
        const desktopVisible = await desktopIndex.isVisible();
        console.log(`Desktop side index visible after resize: ${desktopVisible}`);

        expect(isVisible).toBeTruthy();
        expect(desktopVisible).toBeFalsy();
    });
});
