import { test, expect } from '@playwright/test';

/**
 * Couvre les deux ajouts : le monde Morphologie et le rebranchement de
 * StudySession (qui existait mais qu'aucune route n'atteignait).
 *
 * Ces parcours dependent d'animations framer-motion : `AnimatePresence
 * mode="wait"` ne monte l'ecran suivant qu'une fois l'animation de sortie
 * terminee, et celle-ci est pilotee par requestAnimationFrame. D'ou les
 * attentes sur elements plutot que sur des timeouts fixes.
 */

const DESKTOP_ONLY = 'parcours verifie sur desktop, la mise en page mobile masque les libelles';

// vite.config.ts fixe `base: '/Train2Scrabbl/'` et App.tsx en fait le basename
// du routeur : sans ce prefixe, aucune route ne matche et la page reste vide.
const BASE = '/Train2Scrabbl';
const route = (path: string) => `${BASE}${path}`;

test.describe('Monde Morphologie', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(route('/arena'));
        // Le dictionnaire (2,6 Mo) est parse puis indexe au premier rendu.
        await expect(page.getByRole('heading', { name: /Arène du Vocabulaire/ }))
            .toBeVisible({ timeout: 20000 });
    });

    test('le monde apparait dans le selecteur avec son compte', async ({ page }) => {
        const card = page.getByRole('button', { name: /Morphologie/ });
        await expect(card).toBeVisible({ timeout: 20000 });
        await expect(card).toContainText('Préfixes et suffixes');

        // Un sous-ensemble strict des 22 632 tirages : si le compte est egal au
        // total, l'appariement matche tout et ne filtre plus rien.
        // toLocaleString('fr') separe les milliers par une espace fine
        // insecable : on extrait les chiffres plutot que de parier sur
        // le caractere exact rendu par le navigateur.
        const label = (await card.textContent()) ?? '';
        const count = Number(label.split('tirages')[0].replace(/\D/g, ''));
        expect(count).toBeGreaterThan(10000);
        expect(count).toBeLessThan(22632);
    });

    test('les familles d affixes sont proposees en sous-categories', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name === 'mobile', DESKTOP_ONLY);

        await page.getByRole('button', { name: /Morphologie/ }).click();

        // Un prefixe et un suffixe : les deux tables d'appariement sont peuplees.
        await expect(page.getByRole('button', { name: /^DE- \/ DES-/ })).toBeVisible({ timeout: 20000 });
        await expect(page.getByRole('button', { name: /^-EUR \/ -EUSE/ })).toBeVisible();

        // Le trait d'union porte le sens : "DE-" prefixe, "-EUR" suffixe.
        const suffix = page.getByRole('button', { name: /^-EUR \/ -EUSE/ });
        await expect(suffix).toContainText('-EUR');
    });

    test('filtrer sur une famille reduit la liste', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name === 'mobile', DESKTOP_ONLY);

        await page.getByRole('button', { name: /Morphologie/ }).click();
        const header = page.locator('p', { hasText: /tirages$/ }).first();
        await expect(header).toBeVisible({ timeout: 20000 });

        const before = await header.textContent();
        await page.getByRole('button', { name: /^-EUR \/ -EUSE/ }).click();
        await expect(header).not.toHaveText(before ?? '', { timeout: 10000 });
    });
});

test.describe('Session d etude', () => {
    test('le bouton Etudier ouvre une session depuis un monde', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name === 'mobile', DESKTOP_ONLY);

        await page.goto(route('/arena'));
        await page.getByRole('button', { name: /Morphologie/ }).click({ timeout: 20000 });
        await page.getByRole('button', { name: 'Étudier' }).click();

        await expect(page).toHaveURL(/\/arena\/study\/morphology/);
        await expect(page.getByRole('heading', { name: /Mode Etude/ })).toBeVisible();
        await expect(page.getByText('1 / 20')).toBeVisible();
    });

    test('la route directe monte la session', async ({ page }) => {
        await page.goto(route('/arena/study/essentials'));
        await expect(page.getByRole('heading', { name: /Mode Etude/ })).toBeVisible({ timeout: 20000 });
        await expect(page.getByText('1 / 20')).toBeVisible();
    });

    test('reveler puis noter fait avancer la carte', async ({ page }) => {
        await page.goto(route('/arena/study/essentials'));
        await expect(page.getByText('1 / 20')).toBeVisible({ timeout: 20000 });

        const rack = page.locator('.bg-white\\/10').first();
        const firstDraw = await rack.textContent();

        await page.getByRole('button', { name: 'Révéler les solutions' }).click();
        await page.getByRole('button', { name: 'Good', exact: true }).click();

        // Quand le tirage a plus d'une page d'extensions, StudyCard refuse la
        // note et demande confirmation. C'est voulu : on la confirme.
        const skip = page.getByRole('button', { name: 'Ignorer et passer' });
        if (await skip.isVisible().catch(() => false)) {
            await skip.click();
        }

        await expect(page.getByText('2 / 20')).toBeVisible({ timeout: 10000 });

        // Le compteur peut avancer alors que la carte reste bloquee : c'est le
        // symptome d'une animation de sortie qui ne se termine pas. On verifie
        // donc que le tirage affiche a reellement change.
        await expect(rack).not.toHaveText(firstDraw ?? '', { timeout: 10000 });
        await expect(page.getByRole('button', { name: 'Révéler les solutions' })).toBeVisible();
    });

    test('une session ne resert pas toujours les memes tirages', async ({ page }) => {
        const firstOf = async () => {
            await page.goto(route('/arena/study/explorer'));
            await expect(page.getByText('1 / 20')).toBeVisible({ timeout: 20000 });
            return page.locator('.bg-white\\/10').first().textContent();
        };

        // `explorer` est trie alphabetiquement : couper avant de melanger
        // ramenait invariablement les 20 premiers tirages en AAA.
        const seen = new Set<string>();
        for (let i = 0; i < 4; i++) {
            seen.add((await firstOf()) ?? '');
        }
        expect(seen.size).toBeGreaterThan(1);
    });
});
