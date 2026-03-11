import type { DictionaryCategory, DrawEntry, WorldType, SubCategory } from '../types/dictionary';
import { loadDictionary } from './loadDictionary';
import {
    enrichAllEntries,
    buildArenaIndexes,
    getEntriesByWorld,
    getEntriesByPremiumLetter,
    getEntriesByVowelCount,
    getEntriesByPremiumAndVowel,
    getEntriesByVowelAndFirstLetter,
    getTopProbabilityEntries,
    getSubcategories,
    getArenaStats,
    isArenaInitialized
} from './arenaService';

// Cache and indexes
let dictionaryPromise: Promise<DictionaryCategory[]> | null = null;
let prefixIndex: Map<string, DictionaryCategory[]> = new Map();
let drawIndex: Map<string, { category: DictionaryCategory; entry: DrawEntry }> = new Map();
let isIndexed = false;

const buildIndexes = (categories: DictionaryCategory[]) => {
    if (isIndexed) return;

    // Build prefix index (first 1-3 letters)
    for (const cat of categories) {
        for (let len = 1; len <= 3; len++) {
            const prefix = cat.prefix.substring(0, len);
            if (!prefixIndex.has(prefix)) {
                prefixIndex.set(prefix, []);
            }
            prefixIndex.get(prefix)!.push(cat);
        }

        // Build draw index for exact lookups
        for (const entry of cat.entries) {
            drawIndex.set(entry.draw, { category: cat, entry });
        }
    }

    // Enrichir les entrées avec les tags et construire les index Arena
    enrichAllEntries(categories);
    buildArenaIndexes(categories);

    isIndexed = true;
};

export const getDictionary = async (): Promise<DictionaryCategory[]> => {
    if (!dictionaryPromise) {
        dictionaryPromise = loadDictionary().then(cats => {
            buildIndexes(cats);
            return cats;
        });
    }
    return dictionaryPromise;
};

// ============================================================================
// API ARENA - Réexport des fonctions de navigation par Mondes
// ============================================================================

export {
    getEntriesByWorld,
    getEntriesByPremiumLetter,
    getEntriesByVowelCount,
    getEntriesByPremiumAndVowel,
    getEntriesByVowelAndFirstLetter,
    getTopProbabilityEntries,
    getSubcategories,
    getArenaStats,
    isArenaInitialized
};

export const findCategoryByDraw = async (draw: string): Promise<{ category: DictionaryCategory; entryId: string } | null> => {
    await getDictionary(); // Ensure loaded and indexed
    const q = draw.toUpperCase();
    const match = drawIndex.get(q);
    if (match) {
        return { category: match.category, entryId: match.entry.id };
    }
    return null;
};

export const searchDictionary = async (query: string): Promise<DictionaryCategory[]> => {
    const dict = await getDictionary();
    const q = query.toUpperCase().trim();

    // Empty query - return first 20 categories only to prevent overload
    if (!q) {
        return dict.slice(0, 20);
    }

    // Use prefix index for fast lookup
    if (q.length <= 3) {
        const indexed = prefixIndex.get(q);
        if (indexed && indexed.length > 0) {
            return indexed.slice(0, 20);
        }
    }

    // Exact draw lookup (7 letters)
    if (q.length === 7) {
        const exact = drawIndex.get(q);
        if (exact) {
            return [{
                prefix: exact.category.prefix,
                entries: [exact.entry]
            }];
        }
    }

    // Fallback: filter by prefix match (limit results)
    const catMatches = dict.filter(cat => cat.prefix.startsWith(q)).slice(0, 15);
    if (catMatches.length > 0) return catMatches;

    // Deep search with limit
    const results: DictionaryCategory[] = [];
    let count = 0;
    const maxResults = 50;

    for (const cat of dict) {
        if (count >= maxResults) break;

        const matchedEntries = cat.entries.filter(e =>
            e.draw.includes(q) ||
            e.solutions.some(s => s.includes(q))
        ).slice(0, 10);

        if (matchedEntries.length > 0) {
            results.push({ ...cat, entries: matchedEntries });
            count += matchedEntries.length;
        }
    }

    return results;
};

