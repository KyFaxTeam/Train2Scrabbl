import type { DictionaryCategory, DrawEntry } from '../types/dictionary';

export async function loadDictionary(): Promise<DictionaryCategory[]> {
    try {
        const basePath = import.meta.env.BASE_URL || '/';
        const response = await fetch(`${basePath}data/scrabble_dict.txt`);
        if (!response.ok) {
            throw new Error(`Failed to load dictionary: ${response.statusText}`);
        }
        const text = await response.text();
        return parseDictionaryFormat(text);
    } catch (error) {
        console.error("Error loading dictionary:", error);
        return [];
    }
}

export function parseDictionaryFormat(text: string): DictionaryCategory[] {
    const categories: DictionaryCategory[] = [];
    const lines = text.split('\n');

    let currentCategory: DictionaryCategory | null = null;
    let currentEntry: DrawEntry | null = null;
    let currentPrefix = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('-')) {
            // Base word
            if (currentEntry) {
                currentEntry.solutions.push(line.substring(1).trim());
            }
        } else if (line.startsWith('++')) {
            // +2 extension - ignore for now
            continue;
        } else if (line.startsWith('+')) {
            // +1 extension
            if (currentEntry) {
                const parts = line.substring(1).trim().split(/\s+/);
                if (parts.length >= 2) {
                    const letter = parts[0];
                    const word = parts[1];
                    currentEntry.extensions.push({ letter, word });
                }
            }
        } else {
            // Key (sorted letters)
            // Check if we need a new category
            const prefix = line.substring(0, 3);
            if (prefix !== currentPrefix) {
                currentPrefix = prefix;
                currentCategory = {
                    prefix: currentPrefix,
                    entries: []
                };
                categories.push(currentCategory);
            }

            currentEntry = {
                id: line,
                draw: line,
                solutions: [],
                extensions: []
            };

            if (currentCategory) {
                currentCategory.entries.push(currentEntry);
            }
        }
    }

    return categories;
}
