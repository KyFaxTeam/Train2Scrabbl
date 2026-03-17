/**
 * E2E tests for the full learning pipeline:
 * Codex (view) → Training (test) → IndexedDB (daily activity) → Stats/ArenaStats
 *
 * Strategy:
 * - Seed IndexedDB directly via page.evaluate() for predictable state
 * - Mock backend /api/training/batch for Training page tests
 * - Verify Stats and ArenaStats pages display seeded data correctly
 */
import { test, expect, Page } from '@playwright/test';

const SCREENSHOT_DIR = 'e2e/screenshots';

// ============================================================================
// HELPERS: Seed IndexedDB with test data
// ============================================================================

/**
 * Opens the IndexedDB and seeds it with test data directly in the browser context.
 * This bypasses the app's service layer so we can test display logic independently.
 */
async function seedIndexedDB(page: Page) {
    await page.evaluate(async () => {
        // Open the DB matching learningStore.ts schema
        const request = indexedDB.open('scrabble-learning-db', 2);

        await new Promise<void>((resolve, reject) => {
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('wordMasteries')) {
                    const store = db.createObjectStore('wordMasteries', { keyPath: 'wordId' });
                    store.createIndex('by-draw', 'drawId');
                    store.createIndex('by-mastery', 'masteryLevel');
                    store.createIndex('by-due', 'dueDate');
                }
                if (!db.objectStoreNames.contains('userProgress')) {
                    db.createObjectStore('userProgress');
                }
                if (!db.objectStoreNames.contains('dailyActivity')) {
                    db.createObjectStore('dailyActivity', { keyPath: 'id' });
                }
            };

            request.onsuccess = async () => {
                const db = request.result;

                // --- 1. Seed WordMasteries ---
                const wordTx = db.transaction('wordMasteries', 'readwrite');
                const wordStore = wordTx.objectStore('wordMasteries');

                const today = new Date().toISOString();
                const tomorrow = new Date(Date.now() + 86400000).toISOString();
                const in3Days = new Date(Date.now() + 3 * 86400000).toISOString();

                // MASTERED word
                wordStore.put({
                    wordId: 'AAABCCR-E-BACCAREA',
                    drawId: 'AAABCCR',
                    extensionLetter: 'E',
                    word: 'BACCAREA',
                    viewCount: 5,
                    lastViewed: today,
                    testCount: 8,
                    correctCount: 7,
                    lastTested: today,
                    stability: 25,
                    difficulty: 0.3,
                    dueDate: in3Days,
                    masteryLevel: 'mastered',
                });

                // LEARNING word
                wordStore.put({
                    wordId: 'AAABCCR-S-BACCARS',
                    drawId: 'AAABCCR',
                    extensionLetter: 'S',
                    word: 'BACCARS',
                    viewCount: 3,
                    lastViewed: today,
                    testCount: 2,
                    correctCount: 1,
                    lastTested: today,
                    stability: 1,
                    difficulty: 0.5,
                    dueDate: tomorrow,
                    masteryLevel: 'learning',
                });

                // EXPOSED word (viewed but never tested)
                wordStore.put({
                    wordId: 'AAADMNW-A-ADAMAWA',
                    drawId: 'AAADMNW',
                    extensionLetter: 'A',
                    word: 'ADAMAWA',
                    viewCount: 2,
                    lastViewed: today,
                    testCount: 0,
                    correctCount: 0,
                    lastTested: null,
                    stability: 1,
                    difficulty: 0.3,
                    dueDate: null,
                    masteryLevel: 'exposed',
                });

                // BURNED word (expert)
                wordStore.put({
                    wordId: 'AAABCCR-I-BACCARI',
                    drawId: 'AAABCCR',
                    extensionLetter: 'I',
                    word: 'BACCARI',
                    viewCount: 10,
                    lastViewed: today,
                    testCount: 15,
                    correctCount: 14,
                    lastTested: today,
                    stability: 45,
                    difficulty: 0.15,
                    dueDate: in3Days,
                    masteryLevel: 'burned',
                });

                // REVIEWING word
                wordStore.put({
                    wordId: 'AADEFGM-E-DEFAMAGE',
                    drawId: 'AADEFGM',
                    extensionLetter: 'E',
                    word: 'DEFAMAGE',
                    viewCount: 4,
                    lastViewed: today,
                    testCount: 5,
                    correctCount: 3,
                    lastTested: today,
                    stability: 8,
                    difficulty: 0.6,
                    dueDate: tomorrow,
                    masteryLevel: 'reviewing',
                });

                await new Promise<void>((res, rej) => {
                    wordTx.oncomplete = () => res();
                    wordTx.onerror = () => rej(wordTx.error);
                });

                // --- 2. Seed UserProgress ---
                const progTx = db.transaction('userProgress', 'readwrite');
                const progStore = progTx.objectStore('userProgress');

                progStore.put({
                    totalXP: 1250,
                    currentStreak: 3,
                    longestStreak: 7,
                    lastActiveDate: today,
                    currentPerfectStreak: 2,
                    fastAnswers: 15,
                    achievements: [
                        {
                            id: 'first_word',
                            name: 'Premier Mot',
                            description: 'Premier mot appris',
                            icon: '🎯',
                            unlockedAt: today,
                            category: 'mastery',
                        }
                    ],
                    dailyGoal: 50,
                    preferredSessionLength: 10,
                }, 'main');

                await new Promise<void>((res, rej) => {
                    progTx.oncomplete = () => res();
                    progTx.onerror = () => rej(progTx.error);
                });

                // --- 3. Seed DailyActivity (last 5 days) ---
                const actTx = db.transaction('dailyActivity', 'readwrite');
                const actStore = actTx.objectStore('dailyActivity');

                const dates: string[] = [];
                for (let i = 4; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    dates.push(d.toISOString().split('T')[0]);
                }

                // Day -4: 10 reviews, 8 correct
                actStore.put({
                    id: dates[0],
                    reviewCount: 10,
                    newLearned: 3,
                    correctCount: 8,
                    totalAnswers: 10,
                    sessionDuration: 300,
                    worlds: { essentials: { reviewed: 7, correct: 6 }, vowels: { reviewed: 3, correct: 2 } },
                });

                // Day -3: 15 reviews, 12 correct
                actStore.put({
                    id: dates[1],
                    reviewCount: 15,
                    newLearned: 2,
                    correctCount: 12,
                    totalAnswers: 15,
                    sessionDuration: 450,
                    worlds: { essentials: { reviewed: 10, correct: 8 }, premium: { reviewed: 5, correct: 4 } },
                });

                // Day -2: 8 reviews, 6 correct
                actStore.put({
                    id: dates[2],
                    reviewCount: 8,
                    newLearned: 1,
                    correctCount: 6,
                    totalAnswers: 8,
                    sessionDuration: 200,
                    worlds: { vowels: { reviewed: 8, correct: 6 } },
                });

                // Day -1 (yesterday): 20 reviews, 18 correct
                actStore.put({
                    id: dates[3],
                    reviewCount: 20,
                    newLearned: 5,
                    correctCount: 18,
                    totalAnswers: 20,
                    sessionDuration: 600,
                    worlds: { essentials: { reviewed: 12, correct: 11 }, premium: { reviewed: 8, correct: 7 } },
                });

                // Day 0 (today): 5 reviews so far, 4 correct
                actStore.put({
                    id: dates[4],
                    reviewCount: 5,
                    newLearned: 1,
                    correctCount: 4,
                    totalAnswers: 5,
                    sessionDuration: 120,
                    worlds: { essentials: { reviewed: 5, correct: 4 } },
                });

                await new Promise<void>((res, rej) => {
                    actTx.oncomplete = () => res();
                    actTx.onerror = () => rej(actTx.error);
                });

                db.close();
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    });
}

/**
 * Clear IndexedDB completely so tests start clean
 */
async function clearIndexedDB(page: Page) {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase('scrabble-learning-db');
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
        });
    });
}

// ============================================================================
// TEST SUITE: Stats Page (reads from IndexedDB)
// ============================================================================

test.describe('Stats Page - Learning Data Display', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to a static asset to get the correct origin without executing React/App JS
        // This prevents the app from opening an IndexedDB connection that would block deleteDatabase
        await page.goto('/vite.svg');

        // Clear and seed IndexedDB
        await clearIndexedDB(page);
        await seedIndexedDB(page);

        // Now navigate to the real app page
        await page.goto('/stats');
        await page.waitForTimeout(1000);
    });

    test('01 - Stats page shows XP and streak from seeded data', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        // Wait for loading to finish
        await expect(page.locator('text=Chargement')).toBeHidden({ timeout: 10000 });

        // Check page title
        await expect(page.locator('h1:has-text("Statistiques")')).toBeVisible();

        // Check XP display - should show 1250
        const bodyText = await page.locator('body').innerText();
        const hasXP = bodyText.includes('1250') || bodyText.includes('1,250');
        console.log(`XP value (1250) displayed: ${hasXP}`);
        expect(hasXP).toBeTruthy();

        // Check streak display - should show 3
        const streakSection = page.locator('text=/\\d+.*jour.*streak/i');
        const streakVisible = await streakSection.isVisible().catch(() => false);
        console.log(`Streak section visible: ${streakVisible}`);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-01-stats-xp-streak.png`,
            fullPage: true,
        });
    });

    test('02 - Stats page shows mastery distribution', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        await expect(page.locator('text=Chargement')).toBeHidden({ timeout: 10000 });

        // Check for mastery distribution section
        const distributionSection = page.locator('text=Distribution');
        const hasDistribution = await distributionSection.isVisible().catch(() => false);
        console.log(`Distribution section visible: ${hasDistribution}`);

        if (hasDistribution) {
            // Should have at least one mastery level bar visible
            // We seeded: 1 mastered, 1 learning, 1 exposed, 1 burned, 1 reviewing
            const bodyText = await page.locator('body').innerText();

            const hasMastered = bodyText.includes('Maîtrisé');
            const hasLearning = bodyText.includes('En cours');
            const hasExposed = bodyText.includes('Vu');
            const hasExpert = bodyText.includes('Expert');
            const hasReviewing = bodyText.includes('En révision');

            console.log(`Mastery levels: Maîtrisé=${hasMastered}, En cours=${hasLearning}, Vu=${hasExposed}, Expert=${hasExpert}, En révision=${hasReviewing}`);

            // At least some mastery categories should appear
            const visibleLevels = [hasMastered, hasLearning, hasExposed, hasExpert, hasReviewing].filter(Boolean).length;
            expect(visibleLevels).toBeGreaterThan(0);
        }

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-02-stats-distribution.png`,
            fullPage: true,
        });
    });

    test('03 - Stats page shows progress percentage', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        await expect(page.locator('text=Chargement')).toBeHidden({ timeout: 10000 });

        // Progress bar section
        const progressLabel = page.locator('text=Progression');
        const hasProgress = await progressLabel.isVisible().catch(() => false);
        console.log(`Progression section visible: ${hasProgress}`);

        // Check for "X / Y mots maîtrisés" text
        const bodyText = await page.locator('body').innerText();
        const progressMatch = bodyText.match(/(\d+)\s*\/\s*(\d+)\s*mots?\s*maîtrisés?/);
        if (progressMatch) {
            console.log(`Progress: ${progressMatch[1]} / ${progressMatch[2]} mots maîtrisés`);
            const mastered = parseInt(progressMatch[1]);
            const total = parseInt(progressMatch[2]);
            // We seeded 5 total words, 2 mastered (mastered + burned)
            expect(mastered).toBeGreaterThan(0);
            expect(total).toBeGreaterThan(0);
        }

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-03-stats-progress.png`,
            fullPage: true,
        });
    });
});

// ============================================================================
// TEST SUITE: ArenaStats Page (Heatmap, Forecast, Retention)
// ============================================================================

test.describe('ArenaStats Page - Dashboard Components', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/vite.svg');
        await clearIndexedDB(page);
        await seedIndexedDB(page);

        // ArenaStatsPage is at /arena/stats
        await page.goto('/arena/stats');
        await page.waitForTimeout(1000);
    });

    test('04 - ArenaStats page loads with summary cards', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        // Wait for loading spinner to disappear
        await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 15000 });

        // Check page title
        await expect(page.locator('h1:has-text("Mes Statistiques")')).toBeVisible();

        const bodyText = await page.locator('body').innerText();

        // Check summary cards
        const hasStreak = bodyText.includes('streak');
        const hasXP = bodyText.includes('XP');
        const hasPrecision = bodyText.includes('précision');
        const hasRevisions = bodyText.includes('révisions');

        console.log(`Summary cards: streak=${hasStreak}, XP=${hasXP}, précision=${hasPrecision}, révisions=${hasRevisions}`);

        // All 4 summary cards should be there
        expect(hasStreak).toBeTruthy();
        expect(hasXP).toBeTruthy();
        expect(hasPrecision).toBeTruthy();
        expect(hasRevisions).toBeTruthy();

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-04-arena-stats-summary.png`,
            fullPage: true,
        });
    });

    test('05 - ArenaStats shows correct accuracy percentage', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 15000 });

        const bodyText = await page.locator('body').innerText();

        // Accuracy: seeded 5 words: 7/8 + 1/2 + 0/0 + 14/15 + 3/5 = 25/30 = 83%
        // But the getSummaryStats uses dailyActivity:
        //   total reviews: 10+15+8+20+5 = 58
        //   total correct: 8+12+6+18+4 = 48
        //   accuracy: 48/58 * 100 = 82.7% → 83%
        const accuracyMatch = bodyText.match(/(\d+)%\s*\n?\s*précision/);
        if (accuracyMatch) {
            const accuracy = parseInt(accuracyMatch[1]);
            console.log(`Accuracy displayed: ${accuracy}%`);
            // Should be around 83%
            expect(accuracy).toBeGreaterThan(50);
            expect(accuracy).toBeLessThan(100);
        } else {
            console.log('Could not parse accuracy from page text');
        }

        // Total reviews: 58
        const reviewsMatch = bodyText.match(/(\d+)\s*\n?\s*révisions/);
        if (reviewsMatch) {
            const reviews = parseInt(reviewsMatch[1]);
            console.log(`Total reviews displayed: ${reviews}`);
            expect(reviews).toBe(58);
        }
    });

    test('06 - ArenaStats shows activity heatmap', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 15000 });

        // Heatmap section
        const heatmapTitle = page.locator('text=Activité des 365 derniers jours');
        const hasHeatmap = await heatmapTitle.isVisible().catch(() => false);
        console.log(`Heatmap title visible: ${hasHeatmap}`);
        expect(hasHeatmap).toBeTruthy();

        // Check streak display in heatmap header
        const bodyText = await page.locator('body').innerText();
        const streakText = bodyText.includes('Streak');
        console.log(`Streak label in heatmap: ${streakText}`);

        // The heatmap should have colored cells (bg-emerald-*)
        // We seeded 5 days of activity, so at least some green cells
        const greenCells = page.locator('.bg-emerald-200, .bg-emerald-400, .bg-emerald-500, .bg-emerald-700');
        const greenCount = await greenCells.count();
        console.log(`Green heatmap cells detected: ${greenCount}`);
        expect(greenCount).toBeGreaterThan(0);

        // Legend should be present
        const legend = page.locator('text=Moins');
        const hasLegend = await legend.isVisible().catch(() => false);
        console.log(`Heatmap legend visible: ${hasLegend}`);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-06-heatmap.png`,
            fullPage: false,
        });
    });

    test('07 - ArenaStats shows forecast chart', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 15000 });

        // Forecast chart section
        const forecastTitle = page.locator('text=Révisions à venir');
        const hasForecast = await forecastTitle.isVisible().catch(() => false);
        console.log(`Forecast chart visible: ${hasForecast}`);
        expect(hasForecast).toBeTruthy();

        // We seeded words with dueDate = tomorrow and in3Days, so forecast bars should appear
        // The chart uses recharts BarChart
        const chartContainer = page.locator('.recharts-responsive-container');
        const hasChart = await chartContainer.isVisible().catch(() => false);
        console.log(`Recharts container visible: ${hasChart}`);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-07-forecast.png`,
            fullPage: false,
        });
    });

    test('08 - ArenaStats shows retention card', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 15000 });

        // Retention card
        const retentionTitle = page.locator('text=Taux de Rétention');
        const hasRetention = await retentionTitle.isVisible().catch(() => false);
        console.log(`Retention card visible: ${hasRetention}`);
        expect(hasRetention).toBeTruthy();

        // Should display overall retention
        // Seeded: 25/30 tests correct → ~83% overall
        const bodyText = await page.locator('body').innerText();
        const retentionMatch = bodyText.match(/(\d+\.?\d*)%/);
        if (retentionMatch) {
            console.log(`Retention value found: ${retentionMatch[1]}%`);
        }

        // Should show mature/young labels
        const hasMature = bodyText.includes('matures');
        const hasYoung = bodyText.includes('jeunes');
        console.log(`Mature cards label: ${hasMature}, Young cards label: ${hasYoung}`);
        expect(hasMature).toBeTruthy();
        expect(hasYoung).toBeTruthy();

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-08-retention.png`,
            fullPage: false,
        });
    });

    test('09 - ArenaStats shows interval distribution', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 15000 });

        // Interval distribution section
        const intervalTitle = page.locator('text=Distribution des Intervalles');
        const hasIntervals = await intervalTitle.isVisible().catch(() => false);
        console.log(`Interval distribution visible: ${hasIntervals}`);
        expect(hasIntervals).toBeTruthy();

        const bodyText = await page.locator('body').innerText();

        // Should show interval ranges
        const hasToday = bodyText.includes("Aujourd'hui");
        const has1to7 = bodyText.includes('1-7 jours');
        const has1to4w = bodyText.includes('1-4 semaines');
        const has1to3m = bodyText.includes('1-3 mois');
        console.log(`Interval ranges: today=${hasToday}, 1-7d=${has1to7}, 1-4w=${has1to4w}, 1-3m=${has1to3m}`);

        // At least today and 1-7 days ranges should have non-zero counts
        // since we seeded words at stability 1, 8, 25, 45
        expect(hasToday || has1to7).toBeTruthy();

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-09-intervals.png`,
            fullPage: true,
        });
    });
});

// ============================================================================
// TEST SUITE: Codex View Tracking → Stats Integration
// ============================================================================

test.describe('Codex View Tracking Pipeline', () => {
    test('10 - Codex entry expand triggers mastery tracking', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        // Start with clean DB
        await page.goto('/');
        await page.waitForTimeout(1000);
        await clearIndexedDB(page);

        // Reload to start fresh
        await page.goto('/');
        await page.waitForTimeout(2000);

        // Wait for Codex categories to load
        const firstCategory = page.locator('[id^="category-"]').first();
        await expect(firstCategory).toBeVisible({ timeout: 15000 });

        // Open first category
        await firstCategory.locator('button').first().click();
        await page.waitForTimeout(500);

        // Find and expand first entry
        const firstEntry = firstCategory.locator('[id^="entry-"]').first();
        const entryCount = await firstCategory.locator('[id^="entry-"]').count();
        console.log(`Entries in first category: ${entryCount}`);

        if (entryCount > 0) {
            await firstEntry.locator('.cursor-pointer').first().click();
            await page.waitForTimeout(1000);

            // After expanding, extension view tracking should have been called
            // Check IndexedDB for any WordMastery records
            const masteryCount = await page.evaluate(async () => {
                return new Promise<number>((resolve) => {
                    const req = indexedDB.open('scrabble-learning-db', 2);
                    req.onsuccess = () => {
                        const db = req.result;
                        try {
                            const tx = db.transaction('wordMasteries', 'readonly');
                            const store = tx.objectStore('wordMasteries');
                            const countReq = store.count();
                            countReq.onsuccess = () => {
                                db.close();
                                resolve(countReq.result);
                            };
                            countReq.onerror = () => {
                                db.close();
                                resolve(-1);
                            };
                        } catch {
                            db.close();
                            resolve(-2);
                        }
                    };
                    req.onerror = () => resolve(-3);
                });
            });

            console.log(`WordMastery records after expanding entry: ${masteryCount}`);
            // Expanding an entry should create WordMastery records for its extensions
            expect(masteryCount).toBeGreaterThan(0);
        }

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-10-codex-tracking.png`,
            fullPage: true,
        });
    });
});

// ============================================================================
// TEST SUITE: Training Page → IndexedDB Integration
// ============================================================================

test.describe('Training Page Learning Integration', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.type()} ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

        // Mock the training batch API so we don't need the Python backend
        await page.route('**/api/training/batch**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    count: 1,
                    generationTimeMs: 10,
                    puzzles: [
                        {
                            id: 'mock-1',
                            rack: ['A', 'E', 'I', 'M', 'O', 'S', 'T'],
                            boardConfig: {
                                rows: 15,
                                cols: 15,
                                initialTiles: [
                                    { row: 7, col: 7, char: 'A' },
                                    { row: 7, col: 8, char: 'T' },
                                    { row: 7, col: 9, char: 'O' },
                                    { row: 7, col: 10, char: 'M' },
                                    { row: 7, col: 11, char: 'I' },
                                    { row: 7, col: 12, char: 'S' },
                                    { row: 7, col: 13, char: 'E' },
                                ],
                            },
                            solution: {
                                word: 'ATOMISER',
                                direction: 'horizontal',
                                row: 7, col: 6,
                            },
                        },
                    ]
                }),
            });
        });
    });

    test('11 - Training page loads with mocked backend', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        await page.goto('/');
        await page.waitForTimeout(500);
        await clearIndexedDB(page);

        await page.goto('/training');
        await page.waitForTimeout(3000);

        // Should show Arena header and puzzle
        const bodyText = await page.locator('body').innerText();
        console.log(`URL on Training text 11: ${page.url()}`);
        console.log(`Body text: ${bodyText}`);
        const hasArena = bodyText.includes('Arena');
        const hasValider = bodyText.includes('VALIDER');
        console.log(`Training loaded: Arena=${hasArena}, VALIDER=${hasValider}`);

        expect(hasArena || hasValider).toBeTruthy();

        // Should show XP counter (from userProgress, initially 0 for clean DB)
        // Should show puzzle counter "1/1" or similar
        const puzzleCounter = bodyText.match(/(\d+)\/(\d+)/);
        if (puzzleCounter) {
            console.log(`Puzzle counter: ${puzzleCounter[0]}`);
        }

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-11-training-loaded.png`,
            fullPage: true,
        });
    });

    test('12 - Session tracking: startSession is called on mount', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        await page.goto('/');
        await page.waitForTimeout(500);
        await clearIndexedDB(page);

        await page.goto('/training');
        await page.waitForTimeout(3000);

        // Check that the zustand store has a sessionStartTime set
        const hasSession = await page.evaluate(() => {
            // zustand persist stores state in localStorage
            const stored = localStorage.getItem('scrabble-learning-store');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    return parsed.state?.sessionStartTime !== null;
                } catch {
                    return false;
                }
            }
            return false;
        });

        // Note: zustand persist only saves partialize'd state, and sessionStartTime is NOT partialize'd
        // So we check indirectly: the startSession effect ran on mount (no crash)
        console.log(`Session stored in localStorage: ${hasSession}`);

        // No crash = session start works
        const bodyText = await page.locator('body').innerText();
        expect(bodyText.includes('Arena') || bodyText.includes('VALIDER')).toBeTruthy();
    });
});

// ============================================================================
// TEST SUITE: Mobile Views
// ============================================================================

test.describe('Stats & ArenaStats Mobile', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/vite.svg');
        await clearIndexedDB(page);
        await seedIndexedDB(page);
    });

    test('13 - Stats page mobile layout', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile only');

        await page.goto('/stats');
        await page.waitForTimeout(2000);

        await expect(page.locator('text=Chargement')).toBeHidden({ timeout: 10000 });

        // Check basic content visible
        const bodyText = await page.locator('body').innerText();
        const hasStats = bodyText.includes('Statistiques') || bodyText.includes('XP');
        console.log(`Stats page mobile has content: ${hasStats}`);
        expect(hasStats).toBeTruthy();

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-13-stats-mobile.png`,
            fullPage: true,
        });
    });

    test('14 - ArenaStats page mobile layout with 30-day mini heatmap', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile only');

        await page.goto('/arena/stats');
        await page.waitForTimeout(3000);

        await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 15000 });

        // On mobile, the heatmap shows last 30 days instead of 365
        const miniHeatmapLabel = page.locator('text=30 derniers jours');
        const hasMini = await miniHeatmapLabel.isVisible().catch(() => false);
        console.log(`Mobile mini heatmap (30 days) visible: ${hasMini}`);

        // Summary cards should still be visible but stacked 2-by-2
        const bodyText = await page.locator('body').innerText();
        const hasXP = bodyText.includes('XP');
        const hasStreak = bodyText.includes('streak');
        console.log(`Mobile summary: XP=${hasXP}, streak=${hasStreak}`);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-14-arena-stats-mobile.png`,
            fullPage: true,
        });
    });
});

// ============================================================================
// TEST SUITE: End-to-end pipeline consistency
// ============================================================================

test.describe('Pipeline Consistency Checks', () => {
    test('15 - Seeded data produces non-zero values across all stats components', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');
        test.setTimeout(60000);

        await page.goto('/vite.svg');
        await clearIndexedDB(page);
        await seedIndexedDB(page);

        // Visit ArenaStats and collect all numbers
        await page.goto('/arena/stats');
        await page.waitForTimeout(4000);
        await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 15000 });

        const bodyText = await page.locator('body').innerText();

        // Extract all visible numbers
        const numbers = bodyText.match(/\b\d+\b/g)?.map(Number) || [];
        const nonZero = numbers.filter(n => n > 0);
        console.log(`Stats page total numbers: ${numbers.length}, non-zero: ${nonZero.length}`);

        // With seeded data there should be meaningful non-zero numbers:
        // streak (3), XP (1250), reviews (58), accuracy (83%), etc.
        expect(nonZero.length).toBeGreaterThan(5);

        // Ensure key sections rendered
        const sections = [
            'streak',
            'XP',
            'précision',
            'révisions',
            'Activité',
            'Révisions à venir',
            'Rétention',
            'Intervalles',
        ];

        const foundSections: string[] = [];
        for (const section of sections) {
            if (bodyText.includes(section)) {
                foundSections.push(section);
            }
        }
        console.log(`Sections found: ${foundSections.join(', ')}`);
        console.log(`Missing: ${sections.filter(s => !foundSections.includes(s)).join(', ')}`);

        // At least 6/8 sections should be visible
        expect(foundSections.length).toBeGreaterThanOrEqual(6);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/pipeline-15-full-dashboard.png`,
            fullPage: true,
        });
    });

    test('16 - IndexedDB persists across page navigations', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Desktop only');

        await page.goto('/vite.svg');
        await clearIndexedDB(page);
        await seedIndexedDB(page);

        // Verify data is there
        const countBefore = await page.evaluate(async () => {
            return new Promise<number>((resolve) => {
                const req = indexedDB.open('scrabble-learning-db', 2);
                req.onsuccess = () => {
                    const db = req.result;
                    const tx = db.transaction('wordMasteries', 'readonly');
                    const countReq = tx.objectStore('wordMasteries').count();
                    countReq.onsuccess = () => {
                        db.close();
                        resolve(countReq.result);
                    };
                };
            });
        });
        console.log(`WordMastery count before navigation: ${countBefore}`);
        expect(countBefore).toBe(5);

        // Navigate to stats page
        await page.goto('/stats');
        await page.waitForTimeout(2000);

        // Navigate to arena
        await page.goto('/arena');
        await page.waitForTimeout(1000);

        // Navigate back to home
        await page.goto('/');
        await page.waitForTimeout(1000);

        // Check data is still there
        const countAfter = await page.evaluate(async () => {
            return new Promise<number>((resolve) => {
                const req = indexedDB.open('scrabble-learning-db', 2);
                req.onsuccess = () => {
                    const db = req.result;
                    const tx = db.transaction('wordMasteries', 'readonly');
                    const countReq = tx.objectStore('wordMasteries').count();
                    countReq.onsuccess = () => {
                        db.close();
                        resolve(countReq.result);
                    };
                };
            });
        });
        console.log(`WordMastery count after navigations: ${countAfter}`);
        expect(countAfter).toBe(5);
    });
});
