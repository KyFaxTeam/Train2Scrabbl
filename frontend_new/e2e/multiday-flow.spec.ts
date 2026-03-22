import { test, expect } from '@playwright/test';

const TEST_WORDS = ['AA', 'AH', 'DE', 'DO'];
const DAY1 = new Date('2026-03-01T10:00:00Z');
const DAY2 = new Date('2026-03-02T10:00:00Z');
const DAY4 = new Date('2026-03-04T10:00:00Z');

async function mockTrainingBatch(page: any, defaultWords: string[]) {
    await page.route('**/api/training/batch*', async (route: any) => {
        const body = route.request().postData() || '{}';
        const data = JSON.parse(body);
        const wordsToUse = data.words && data.words.length > 0 ? data.words : defaultWords;

        const puzzles = wordsToUse.map((word: string, i: number) => {
            const chars = word.split('');
            const rack = chars.concat(['A', 'E', 'I', 'O', 'U']).slice(0, 7);
            return {
                id: `mock-${i}`,
                rack,
                solution: { word, row: 7, col: 7, direction: 'H' },
                boardConfig: { rows: 15, cols: 15, initialTiles: [] }
            };
        });

        await route.fulfill({
            status: 200,
            json: { puzzles, count: puzzles.length, generationTimeMs: 10 }
        });
    });
}

test.describe('Multi-Day Learning Pipeline (Spaced Repetition & Streaks)', () => {

    test.beforeEach(async ({ page }) => {
        page.on('pageerror', e => console.error('PAGE ERROR =>', e.message));
        page.on('console', msg => { if (msg.type() !== 'info' && msg.type() !== 'warning') console.log('PAGE LOG =>', msg.text()); });
        await page.goto('/vite.svg');
        await page.evaluate(async () => {
            return new Promise<void>((resolve, reject) => {
                const req = indexedDB.deleteDatabase('scrabble-learning-db');
                req.onsuccess = () => resolve();
                req.onerror = () => reject();
            });
        });
    });

    test('Full SR pipeline: Learn -> Test -> Advancing days -> Catch up', async ({ page, isMobile }) => {
        test.skip(isMobile, 'Run multi-day flow on desktop only');
        test.slow();

        // ============================================
        // JOUR 1: DÉCOUVERTE ET 1er ENTRAÎNEMENT
        // ============================================
        console.log('--- DAY 1 ---');
        await page.clock.install({ time: DAY1 });

        // 1. CODEX: Voir 4 mots 
        await page.goto('/');
        await page.getByRole('button', { name: 'Recherche', exact: true }).click();
        const searchInput = page.locator('input[placeholder*="Rechercher"]');
        await expect(searchInput).toBeVisible();

        for (const w of TEST_WORDS) {
            await searchInput.fill(w);
            await page.waitForTimeout(300);
            const entry = page.locator('.cursor-pointer').filter({ hasText: new RegExp(`^${w}$`) }).first();
            if (await entry.isVisible()) {
                await entry.click();
                await page.waitForTimeout(200);
            }
        }

        // 2. TRAINING
        await mockTrainingBatch(page, TEST_WORDS);
        await page.goto('/training');

        for (let i = 0; i < TEST_WORDS.length; i++) {
            const word = TEST_WORDS[i];
            const isCorrect = i < 2; // FIRST TWO PASS, NEXT TWO FAIL

            await expect(page.locator('text=VALIDER')).toBeVisible();
            await page.locator('[data-cell="7-7"]').click();

            if (isCorrect) {
                await page.keyboard.type(word, { delay: 100 });
                await page.waitForTimeout(200);
            }
            // else submit empty

            await page.getByRole('button', { name: 'VALIDER' }).click();
            await expect(page.getByRole('button', { name: /Continuer/i })).toBeVisible();
            await page.getByRole('button', { name: /Continuer/i }).click();
        }

        // 3. VERIFY STATS D1
        await page.goto('/stats');
        await expect(page.locator('body')).toContainText(/1\s*jour de streak/is);

        // ============================================
        // JOUR 2: RÉVISIONS
        // ============================================
        console.log('--- DAY 2 ---');
        await page.clock.setFixedTime(DAY2);

        await page.goto('/stats');
        await expect(page.locator('body')).toContainText(/1\s*jour de streak/is);

        // Train
        await mockTrainingBatch(page, ['DE', 'DO']);
        await page.goto('/training');
        for (let i = 0; i < 2; i++) {
            const word = i === 0 ? 'DE' : 'DO';
            await expect(page.locator('text=VALIDER')).toBeVisible();
            await page.locator('[data-cell="7-7"]').click();
            await page.keyboard.type(word, { delay: 100 }); // Correct them this time
            await page.waitForTimeout(200);
            await page.getByRole('button', { name: 'VALIDER' }).click();
            await expect(page.getByRole('button', { name: /Continuer/i })).toBeVisible();
            await page.getByRole('button', { name: /Continuer/i }).click();
        }

        await page.goto('/stats');
        await expect(page.locator('body')).toContainText(/2\s*jours de streak/is);

        // ============================================
        // JOUR 4: OUBLI ( Bris de série )
        // ============================================
        console.log('--- DAY 4 ---');
        await page.clock.setFixedTime(DAY4);

        await page.goto('/'); // Go home instead of reload
        await page.waitForLoadState('networkidle');

        const dbg4 = await page.evaluate(async () => {
            return new Promise((resolve) => {
                const req = indexedDB.open('scrabble-learning-db');
                req.onsuccess = (e: any) => {
                    const db = e.target.result;
                    const tx = db.transaction('userProgress', 'readonly');
                    const store = tx.objectStore('userProgress');
                    const req2 = store.get('main');
                    req2.onsuccess = () => resolve(req2.result);
                };
            });
        });
        console.log('IDB ON DAY 4:', dbg4);

        await page.goto('/stats');
        const dbg = await page.evaluate(() => ({ d: new Date().toISOString(), l: localStorage.getItem('scrabble-learning-store') }));
        console.log('BROWSER AT DAY 4:', dbg);

        // Streak broken
        // At day 4, streak is 1 because we missed day 3
        await expect(page.locator('body')).toContainText(/1\s*jour de streak/is);

        // Rétention training
        await mockTrainingBatch(page, TEST_WORDS);
        await page.goto('/training');

        for (let i = 0; i < 4; i++) {
            await expect(page.locator('text=VALIDER')).toBeVisible();
            await page.getByRole('button', { name: 'VALIDER' }).click(); // Just fail them quickly
            await expect(page.getByRole('button', { name: /Continuer/i })).toBeVisible();
            await page.getByRole('button', { name: /Continuer/i }).click();
        }

        await page.goto('/stats');
        await expect(page.locator('body')).toContainText(/1\s*jour de streak/is); // restarted today
        await expect(page.locator('body')).toContainText(/Record:\s*2j/is); // historic max
    });
});