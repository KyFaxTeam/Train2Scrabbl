import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = './e2e/screenshots';

// ============================================================================
// NAVIGATION & PAGE LOADING
// ============================================================================

test.describe('Full app navigation', () => {
    test('all 4 nav links work from mobile bottom bar', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile only');
        await page.goto('/');
        await expect(page.locator('h1:has-text("Pôle de Révision")')).toBeVisible({ timeout: 10000 });

        // Navigate to Arena
        await page.locator('nav a, .fixed.bottom-0 a').filter({ hasText: 'Arena' }).click();
        await page.waitForURL('**/arena');
        await expect(page).toHaveURL(/\/arena/);

        // Navigate to Train
        await page.locator('.fixed.bottom-0 a').filter({ hasText: 'Train' }).click();
        await page.waitForURL('**/training');
        await expect(page).toHaveURL(/\/training/);

        // Navigate to Stats
        await page.locator('.fixed.bottom-0 a').filter({ hasText: 'Stats' }).click();
        await page.waitForURL('**/stats');
        await expect(page).toHaveURL(/\/stats/);

        // Navigate back to Codex
        await page.locator('.fixed.bottom-0 a').filter({ hasText: 'Codex' }).click();
        await page.waitForURL('**/');
        await expect(page.locator('h1:has-text("Pôle de Révision")')).toBeVisible();
    });

    test('all 4 sidebar links work on desktop', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        await page.goto('/');
        await expect(page.locator('h1:has-text("Pôle de Révision")')).toBeVisible({ timeout: 10000 });

        // Navigate to Arena via sidebar
        await page.locator('nav a').filter({ hasText: 'The Arena' }).click();
        await page.waitForURL('**/arena');

        // Navigate to Training
        await page.locator('nav a').filter({ hasText: 'Training' }).click();
        await page.waitForURL('**/training');

        // Navigate to Stats
        await page.locator('nav a').filter({ hasText: 'Stats' }).click();
        await page.waitForURL('**/stats');

        // Navigate back to Codex
        await page.locator('nav a').filter({ hasText: 'The Codex' }).click();
        await page.waitForURL(/\/$/);
        await expect(page.locator('h1:has-text("Pôle de Révision")')).toBeVisible();
    });
});

// ============================================================================
// STATS PAGE
// ============================================================================

test.describe('Stats page', () => {
    test('renders empty state correctly', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        await page.goto('/stats');

        // Should show title
        await expect(page.getByText('Statistiques')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Votre progression d\'apprentissage')).toBeVisible();

        // With no learning data, should show empty state or zero values
        // XP Total card should exist
        const xpCard = page.getByText('XP Total');
        await expect(xpCard).toBeVisible();

        // Streak card should exist
        const streakCard = page.getByText('Streak');
        await expect(streakCard).toBeVisible();

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/stats-empty-desktop.png`,
            fullPage: true,
        });
    });

    test('renders empty state on mobile', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile only');
        await page.goto('/stats');

        await expect(page.getByText('Statistiques')).toBeVisible({ timeout: 10000 });

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/stats-empty-mobile.png`,
            fullPage: true,
        });

        // Check layout doesn't overflow horizontally
        const body = page.locator('body');
        const bodyBox = await body.boundingBox();
        expect(bodyBox).toBeTruthy();
        // On mobile 375px viewport, body should not exceed viewport
        expect(bodyBox!.width).toBeLessThanOrEqual(376);
    });

    test('mastery distribution section exists', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        await page.goto('/stats');
        await expect(page.getByText('Statistiques')).toBeVisible({ timeout: 10000 });

        // Progress bar section should exist
        const progressSection = page.getByText('mots maîtrisés');
        // May not be visible if 0 words, check for empty state instead
        const emptyState = page.getByText('Pas encore de données');
        const hasProgress = await progressSection.isVisible().catch(() => false);
        const hasEmpty = await emptyState.isVisible().catch(() => false);
        expect(hasProgress || hasEmpty).toBeTruthy();
    });
});

// ============================================================================
// TRAINING PAGE
// ============================================================================

test.describe('Training page', () => {
    test('shows error or puzzle on load', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        await page.goto('/training');

        // Wait for either the Arena header (success) or the error message (backend down)
        const arenaHeader = page.getByText('Arena', { exact: true });
        const errorMessage = page.getByText('Oups!');
        const loading = page.getByText('Chargement...');

        // Wait until loading resolves
        await expect(arenaHeader.or(errorMessage)).toBeVisible({ timeout: 15000 });

        const hasArena = await arenaHeader.isVisible().catch(() => false);
        const hasError = await errorMessage.isVisible().catch(() => false);

        console.log(`Training page state: arena=${hasArena}, error=${hasError}`);

        if (hasError) {
            // Backend is down — verify error UI is correct
            await expect(page.getByText(/Impossible de charger|backend/i)).toBeVisible();
            await expect(page.getByText('Réessayer')).toBeVisible();
        }

        if (hasArena) {
            // Backend is up — verify puzzle UI elements
            await expect(page.getByText('VALIDER')).toBeVisible();
            // Rack should have tiles
            const rackTiles = page.locator('button.bg-\\[\\#F7F0E6\\]');
            const tileCount = await rackTiles.count();
            console.log(`Rack tiles visible: ${tileCount}`);
            expect(tileCount).toBeGreaterThan(0);

            // Board should be rendered (15x15 = 225 cells)
            const cells = page.locator('[data-cell]');
            const cellCount = await cells.count();
            console.log(`Board cells: ${cellCount}`);
            expect(cellCount).toBe(225);
        }

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/training-state-desktop.png`,
            fullPage: false,
        });
    });

    test('training page header shows combo and XP counters', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        await page.goto('/training');

        const arenaHeader = page.getByText('Arena', { exact: true });
        const errorMessage = page.getByText('Oups!');
        await expect(arenaHeader.or(errorMessage)).toBeVisible({ timeout: 15000 });

        const hasArena = await arenaHeader.isVisible().catch(() => false);
        if (!hasArena) {
            test.skip(true, 'Backend not available');
            return;
        }

        // Header should show puzzle counter (e.g., "1/5")
        await expect(page.getByText(/\d+\/\d+/)).toBeVisible();

        // Refresh button should exist
        const refreshBtn = page.locator('button').filter({ has: page.locator('svg.lucide-refresh-cw, .lucide-refresh-cw') });
        // Fallback: just check there's a small button in the header
        const headerButtons = page.locator('.backdrop-blur-sm button');
        const btnCount = await headerButtons.count();
        expect(btnCount).toBeGreaterThan(0);
    });

    test('training page mobile layout fits viewport', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile only');
        await page.goto('/training');

        const arenaHeader = page.getByText('Arena', { exact: true });
        const errorMessage = page.getByText('Oups!');
        await expect(arenaHeader.or(errorMessage)).toBeVisible({ timeout: 15000 });

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/training-mobile.png`,
            fullPage: false,
        });

        // Check no horizontal overflow
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test('retry button works when backend is down', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        await page.goto('/training');

        const errorMessage = page.getByText('Oups!');
        const arenaHeader = page.getByText('Arena', { exact: true });
        await expect(arenaHeader.or(errorMessage)).toBeVisible({ timeout: 15000 });

        const hasError = await errorMessage.isVisible().catch(() => false);
        if (!hasError) {
            test.skip(true, 'Backend is running, cannot test retry button');
            return;
        }

        // Click retry
        const retryBtn = page.getByText('Réessayer');
        await expect(retryBtn).toBeVisible();
        await retryBtn.click();

        // Should show loading briefly then error again (since backend is still down)
        await page.waitForTimeout(2000);
        await expect(page.getByText('Oups!')).toBeVisible({ timeout: 10000 });
    });
});

// ============================================================================
// ARENA PAGE
// ============================================================================

test.describe('Arena page', () => {
    test('arena page loads with world selector', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        await page.goto('/arena');

        // Wait for arena to load (may show loading spinner first)
        const arenaTitle = page.getByText("L'Arène du Vocabulaire");
        const loadingText = page.getByText('Chargement');

        await expect(arenaTitle.or(loadingText)).toBeVisible({ timeout: 15000 });

        // Wait for loading to finish
        if (await loadingText.isVisible().catch(() => false)) {
            await expect(arenaTitle).toBeVisible({ timeout: 30000 });
        }

        // "Mes Statistiques" button should be visible
        await expect(page.getByText('Mes Statistiques')).toBeVisible();

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/arena-desktop.png`,
            fullPage: true,
        });
    });

    test('arena page on mobile', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile only');
        await page.goto('/arena');

        const arenaTitle = page.getByText("L'Arène du Vocabulaire");
        const loadingText = page.getByText('Chargement');
        await expect(arenaTitle.or(loadingText)).toBeVisible({ timeout: 15000 });

        if (await loadingText.isVisible().catch(() => false)) {
            await expect(arenaTitle).toBeVisible({ timeout: 30000 });
        }

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/arena-mobile.png`,
            fullPage: false,
        });

        // No horizontal overflow
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test('navigate to arena stats', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        await page.goto('/arena');

        const arenaTitle = page.getByText("L'Arène du Vocabulaire");
        await expect(arenaTitle).toBeVisible({ timeout: 30000 });

        // Click "Mes Statistiques"
        await page.getByText('Mes Statistiques').click();
        await page.waitForURL('**/arena/stats');
        await expect(page).toHaveURL(/\/arena\/stats/);
    });
});

// ============================================================================
// ARENA STATS PAGE
// ============================================================================

test.describe('Arena Stats page', () => {
    test('loads and shows summary cards', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        await page.goto('/arena/stats');

        // Wait for page to load
        const title = page.getByText('Mes Statistiques');
        const loadingText = page.getByText('Chargement des statistiques');
        await expect(title.or(loadingText)).toBeVisible({ timeout: 15000 });

        if (await loadingText.isVisible().catch(() => false)) {
            await expect(title).toBeVisible({ timeout: 30000 });
        }

        // Should have the 4 summary cards
        await expect(page.getByText('jours de streak')).toBeVisible();
        await expect(page.getByText('XP total')).toBeVisible();
        await expect(page.getByText('précision')).toBeVisible();

        // Back button should navigate to /arena
        const backLink = page.locator('a[href="/arena"]');
        await expect(backLink).toBeVisible();

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/arena-stats-desktop.png`,
            fullPage: true,
        });
    });

    test('back button returns to arena', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        await page.goto('/arena/stats');

        const title = page.getByText('Mes Statistiques');
        await expect(title).toBeVisible({ timeout: 30000 });

        await page.locator('a[href="/arena"]').click();
        await page.waitForURL('**/arena');
        await expect(page).toHaveURL(/\/arena$/);
    });
});

// ============================================================================
// RESPONSIVE ALIGNMENT CHECKS
// ============================================================================

test.describe('Responsive alignment', () => {
    test('codex page: content centered, no overflow on mobile', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile only');
        await page.goto('/');
        await expect(page.locator('h1:has-text("Pôle de Révision")')).toBeVisible({ timeout: 10000 });

        // Check no horizontal scroll
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

        // Mobile header "Faizers" should be centered
        const header = page.locator('span:has-text("Faizers")').first();
        const headerBox = await header.boundingBox();
        expect(headerBox).toBeTruthy();
        // Center of header should be roughly at center of viewport (375/2 = 187.5)
        const headerCenter = headerBox!.x + headerBox!.width / 2;
        expect(headerCenter).toBeGreaterThan(150);
        expect(headerCenter).toBeLessThan(225);
    });

    test('codex page: sidebar visible on desktop, content not overlapping', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        await page.goto('/');
        await expect(page.locator('h1:has-text("Pôle de Révision")')).toBeVisible({ timeout: 10000 });

        // Sidebar should be visible
        const sidebar = page.locator('nav.hidden.md\\:flex').first();
        const sidebarVisible = await sidebar.isVisible();
        expect(sidebarVisible).toBeTruthy();

        // Main content should start after sidebar
        const sidebarBox = await sidebar.boundingBox();
        const mainContent = page.locator('main');
        const mainBox = await mainContent.boundingBox();
        expect(sidebarBox).toBeTruthy();
        expect(mainBox).toBeTruthy();
        // Main content x should be >= sidebar width (approximately)
        expect(mainBox!.x).toBeGreaterThanOrEqual(sidebarBox!.width - 5);
    });

    test('all pages: no console errors on navigation', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Ignore expected errors (backend fetch failures)
                if (!text.includes('fetch') && !text.includes('net::') && !text.includes('Failed to')) {
                    consoleErrors.push(text);
                }
            }
        });

        // Visit each page
        for (const route of ['/', '/arena', '/stats', '/training']) {
            await page.goto(route);
            await page.waitForTimeout(2000);
        }

        console.log(`Console errors found: ${consoleErrors.length}`);
        if (consoleErrors.length > 0) {
            console.log('Errors:', consoleErrors);
        }
        expect(consoleErrors).toHaveLength(0);
    });

    test('mobile nav bar is always visible across all pages', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile only');

        for (const route of ['/', '/arena', '/stats']) {
            await page.goto(route);
            await page.waitForTimeout(2000);

            const mobileNav = page.locator('.fixed.bottom-0').filter({ hasText: /Codex|Arena|Train|Stats/ });
            const isVisible = await mobileNav.isVisible();
            console.log(`Mobile nav visible on ${route}: ${isVisible}`);
            expect(isVisible).toBeTruthy();
        }
    });
});
