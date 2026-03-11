/**
 * Arena Service - Navigation multi-dimensionnelle par Mondes
 * 
 * Gère le calcul des tags, les index et la navigation pour l'Arène du Vocabulaire.
 */

import type { DrawEntry, DrawTags, DictionaryCategory, WorldType, SubCategory } from '../types/dictionary';

// ============================================================================
// CONSTANTES
// ============================================================================

const VOWELS = 'AEIOUY';
const PREMIUM_LETTERS = 'JKQWXYZ';

const LETTER_VALUES: Record<string, number> = {
    E: 1, A: 1, I: 1, N: 1, O: 1, R: 1, S: 1, T: 1, U: 1, L: 1,
    D: 2, M: 2, G: 2,
    B: 3, C: 3, P: 3,
    F: 4, H: 4, V: 4,
    J: 8, Q: 8,
    K: 10, W: 10, X: 10, Y: 10, Z: 10
};

// Distribution des tuiles dans le sac Scrabble FR (sans jokers)
const TILE_COUNTS: Record<string, number> = {
    E: 15, A: 9, I: 8, N: 6, O: 6, R: 6, S: 6, T: 6, U: 6, L: 5,
    D: 3, M: 3, G: 2,
    B: 2, C: 2, P: 2,
    F: 2, H: 2, V: 2,
    J: 1, Q: 1, K: 1, W: 1, X: 1, Y: 1, Z: 1
};

const TOTAL_TILES = Object.values(TILE_COUNTS).reduce((a, b) => a + b, 0); // 100

// ============================================================================
// CALCUL DES TAGS
// ============================================================================

/**
 * Calcule les tags pour un tirage donné
 */
export function calculateTags(draw: string): DrawTags {
    const letters = draw.toUpperCase().split('');

    // Compter voyelles et consonnes
    const vowelCount = letters.filter(l => VOWELS.includes(l)).length;
    const consonantCount = 7 - vowelCount;

    // Calculer valeur totale
    const totalValue = letters.reduce((sum, l) => sum + (LETTER_VALUES[l] || 0), 0);

    // Déterminer catégorie de valeur
    let valueCategory: DrawTags['valueCategory'];
    if (totalValue <= 10) valueCategory = 'low';
    else if (totalValue <= 18) valueCategory = 'mid';
    else if (totalValue <= 25) valueCategory = 'high';
    else valueCategory = 'premium';

    // Extraire lettres premium
    const premiumLetters = [...new Set(letters.filter(l => PREMIUM_LETTERS.includes(l)))];

    return {
        vowelCount,
        consonantCount,
        totalValue,
        valueCategory,
        premiumLetters,
        hasPremium: premiumLetters.length > 0,
        firstLetter: letters[0] || 'A'
    };
}

// ============================================================================
// CALCUL DE PROBABILITÉ
// ============================================================================

// Cache pour les factorielles
const factorialCache: Map<number, number> = new Map([[0, 1], [1, 1]]);

function factorial(n: number): number {
    if (n < 0) return 0;
    if (factorialCache.has(n)) return factorialCache.get(n)!;
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
        factorialCache.set(i, result);
    }
    return result;
}

function combination(n: number, r: number): number {
    if (r < 0 || r > n) return 0;
    return factorial(n) / (factorial(r) * factorial(n - r));
}

/**
 * Calcule la probabilité de tirer exactement ces 7 lettres
 */
export function calculateProbability(draw: string): number {
    const counts: Record<string, number> = {};
    for (const char of draw.toUpperCase()) {
        counts[char] = (counts[char] || 0) + 1;
    }

    let ways = 1;
    for (const [char, count] of Object.entries(counts)) {
        const available = TILE_COUNTS[char] || 0;
        if (available < count) return 0; // Impossible
        ways *= combination(available, count);
    }

    const totalCombinations = combination(TOTAL_TILES, 7);
    return ways / totalCombinations;
}

// ============================================================================
// INDEX MULTI-DIMENSIONNELS
// ============================================================================

interface ArenaIndexes {
    // Toutes les entrées enrichies
    allEntries: DrawEntry[];

    // Monde "Les Indispensables" (Top 1000 par probabilité)
    topProbability: DrawEntry[];

    // Monde "Lettres Premium" (par lettre J,K,Q,W,X,Y,Z)
    byPremiumLetter: Map<string, DrawEntry[]>;
    allPremiumEntries: DrawEntry[];

    // Monde "Équilibre Voyelles" (par nombre 1V-6V)
    byVowelCount: Map<number, DrawEntry[]>;

    // Sous-index combinés
    premiumByVowel: Map<string, DrawEntry[]>;  // "J-3" -> entries
    vowelByFirstLetter: Map<string, DrawEntry[]>; // "3-A" -> entries

    // Index de recherche directe
    byDraw: Map<string, DrawEntry>;
}

let arenaIndexes: ArenaIndexes | null = null;

/**
 * Enrichit toutes les entrées avec leurs tags et calcule les probabilités
 */
export function enrichAllEntries(categories: DictionaryCategory[]): void {
    // Collecter toutes les entrées avec leurs probabilités
    const entriesWithProb: { entry: DrawEntry; prob: number }[] = [];

    for (const cat of categories) {
        for (const entry of cat.entries) {
            // Calculer les tags
            entry.tags = calculateTags(entry.draw);

            // Calculer la probabilité
            const prob = calculateProbability(entry.draw);
            entriesWithProb.push({ entry, prob });
        }
    }

    // Trier par probabilité décroissante et assigner les ranks
    entriesWithProb.sort((a, b) => b.prob - a.prob);
    entriesWithProb.forEach(({ entry }, index) => {
        if (entry.tags) {
            entry.tags.probabilityRank = index + 1;
        }
    });
}

/**
 * Construit tous les index pour la navigation par Mondes
 */
export function buildArenaIndexes(categories: DictionaryCategory[]): void {
    const allEntries: DrawEntry[] = [];
    const byPremiumLetter = new Map<string, DrawEntry[]>();
    const byVowelCount = new Map<number, DrawEntry[]>();
    const premiumByVowel = new Map<string, DrawEntry[]>();
    const vowelByFirstLetter = new Map<string, DrawEntry[]>();
    const byDraw = new Map<string, DrawEntry>();
    const allPremiumEntries: DrawEntry[] = [];

    // Initialiser les Maps
    for (const letter of PREMIUM_LETTERS) {
        byPremiumLetter.set(letter, []);
    }
    for (let v = 0; v <= 7; v++) {
        byVowelCount.set(v, []);
    }

    // Peupler les index
    for (const cat of categories) {
        for (const entry of cat.entries) {
            allEntries.push(entry);
            byDraw.set(entry.draw, entry);

            const tags = entry.tags;
            if (!tags) continue;

            // Index par voyelles
            const vowelList = byVowelCount.get(tags.vowelCount) || [];
            vowelList.push(entry);
            byVowelCount.set(tags.vowelCount, vowelList);

            // Index voyelles + première lettre (ex: "3-A")
            const vowelFirstKey = `${tags.vowelCount}-${tags.firstLetter}`;
            const vowelFirstList = vowelByFirstLetter.get(vowelFirstKey) || [];
            vowelFirstList.push(entry);
            vowelByFirstLetter.set(vowelFirstKey, vowelFirstList);

            // Index par lettre premium
            if (tags.hasPremium) {
                allPremiumEntries.push(entry);
                for (const pl of tags.premiumLetters) {
                    const premiumList = byPremiumLetter.get(pl) || [];
                    premiumList.push(entry);
                    byPremiumLetter.set(pl, premiumList);

                    // Index premium + voyelles (ex: "J-3")
                    const premVowelKey = `${pl}-${tags.vowelCount}`;
                    const premVowelList = premiumByVowel.get(premVowelKey) || [];
                    premVowelList.push(entry);
                    premiumByVowel.set(premVowelKey, premVowelList);
                }
            }
        }
    }

    // Créer le Top 1000 par probabilité
    const topProbability = [...allEntries]
        .filter(e => e.tags?.probabilityRank !== undefined)
        .sort((a, b) => (a.tags?.probabilityRank || Infinity) - (b.tags?.probabilityRank || Infinity))
        .slice(0, 1000);

    arenaIndexes = {
        allEntries,
        topProbability,
        byPremiumLetter,
        allPremiumEntries,
        byVowelCount,
        premiumByVowel,
        vowelByFirstLetter,
        byDraw
    };
}

// ============================================================================
// API PUBLIQUE
// ============================================================================

/**
 * Récupère les entrées pour un monde donné
 */
export function getEntriesByWorld(world: WorldType): DrawEntry[] {
    if (!arenaIndexes) return [];

    switch (world) {
        case 'essentials':
            return arenaIndexes.topProbability;
        case 'premium':
            return arenaIndexes.allPremiumEntries;
        case 'vowels':
        case 'explorer':
            return arenaIndexes.allEntries;
        default:
            return [];
    }
}

/**
 * Récupère les entrées pour une lettre premium spécifique
 */
export function getEntriesByPremiumLetter(letter: string): DrawEntry[] {
    if (!arenaIndexes) return [];
    return arenaIndexes.byPremiumLetter.get(letter.toUpperCase()) || [];
}

/**
 * Récupère les entrées pour un nombre de voyelles spécifique
 */
export function getEntriesByVowelCount(count: number): DrawEntry[] {
    if (!arenaIndexes) return [];
    return arenaIndexes.byVowelCount.get(count) || [];
}

/**
 * Récupère les entrées Premium filtrées par voyelles
 */
export function getEntriesByPremiumAndVowel(letter: string, vowelCount: number): DrawEntry[] {
    if (!arenaIndexes) return [];
    const key = `${letter.toUpperCase()}-${vowelCount}`;
    return arenaIndexes.premiumByVowel.get(key) || [];
}

/**
 * Récupère les entrées Voyelles filtrées par première lettre
 */
export function getEntriesByVowelAndFirstLetter(vowelCount: number, firstLetter: string): DrawEntry[] {
    if (!arenaIndexes) return [];
    const key = `${vowelCount}-${firstLetter.toUpperCase()}`;
    return arenaIndexes.vowelByFirstLetter.get(key) || [];
}

/**
 * Récupère les Top N entrées par probabilité
 */
export function getTopProbabilityEntries(limit: number = 1000): DrawEntry[] {
    if (!arenaIndexes) return [];
    return arenaIndexes.topProbability.slice(0, limit);
}

/**
 * Récupère les sous-catégories pour un monde donné
 */
export function getSubcategories(world: WorldType): SubCategory[] {
    if (!arenaIndexes) return [];

    switch (world) {
        case 'essentials':
            return [
                { id: 'top-100', label: 'Top 100', icon: '🏆', count: 100, entries: arenaIndexes.topProbability.slice(0, 100) },
                { id: 'top-500', label: 'Top 500', icon: '⭐', count: 500, entries: arenaIndexes.topProbability.slice(0, 500) },
                { id: 'top-1000', label: 'Top 1000', icon: '📚', count: 1000, entries: arenaIndexes.topProbability.slice(0, 1000) },
            ];

        case 'premium':
            return PREMIUM_LETTERS.split('').map(letter => {
                const entries = arenaIndexes!.byPremiumLetter.get(letter) || [];
                return {
                    id: `premium-${letter}`,
                    label: letter,
                    icon: '💎',
                    count: entries.length,
                    entries
                };
            });

        case 'vowels':
            return [1, 2, 3, 4, 5, 6].map(v => {
                const entries = arenaIndexes!.byVowelCount.get(v) || [];
                return {
                    id: `vowel-${v}`,
                    label: `${v} Voyelle${v > 1 ? 's' : ''}`,
                    icon: '🔵'.repeat(Math.min(v, 5)),
                    count: entries.length,
                    entries
                };
            }).filter(s => s.count > 0);

        case 'explorer':
            return []; // Pas de sous-catégories, navigation libre

        default:
            return [];
    }
}

/**
 * Récupère les statistiques globales
 */
export function getArenaStats() {
    if (!arenaIndexes) return null;

    return {
        totalEntries: arenaIndexes.allEntries.length,
        premiumEntries: arenaIndexes.allPremiumEntries.length,
        byVowelCount: Object.fromEntries(
            Array.from(arenaIndexes.byVowelCount.entries())
                .map(([k, v]) => [k, v.length])
        ),
        byPremiumLetter: Object.fromEntries(
            Array.from(arenaIndexes.byPremiumLetter.entries())
                .map(([k, v]) => [k, v.length])
        )
    };
}

/**
 * Vérifie si les index sont initialisés
 */
export function isArenaInitialized(): boolean {
    return arenaIndexes !== null;
}