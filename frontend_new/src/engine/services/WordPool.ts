export class WordPool {
    private allWords: string[];
    private cache: Record<string, string[]> = {};

    constructor(words: string[]) {
        this.allWords = words;
    }

    private extractWordsByLength(minLen: number, maxLen: number, limit?: number): string[] {
        const cacheKey = `${minLen}-${maxLen}`;
        if (!this.cache[cacheKey]) {
            this.cache[cacheKey] = this.allWords.filter(w => w.length >= minLen && w.length <= maxLen);
        }

        let words = this.cache[cacheKey];

        if (limit && words.length > limit) {
            return this.getRandomSample(words, limit);
        }
        return words;
    }

    getMotsCourts(limit: number = 200): string[] {
        return this.extractWordsByLength(2, 4, limit);
    }

    getMotsMoyens(limit: number = 150): string[] {
        return this.extractWordsByLength(5, 6, limit);
    }

    getMotsLongs(limit: number = 100): string[] {
        return this.extractWordsByLength(7, 8, limit);
    }

    getMotsContenantLettre(lettre: string, minLen: number = 2, maxLen: number = 5): string[] {
        const letterUpper = lettre.toUpperCase();
        return this.allWords.filter(w => w.includes(letterUpper) && w.length >= minLen && w.length <= maxLen);
    }

    private getRandomSample<T>(arr: T[], size: number): T[] {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, size);
    }
}
