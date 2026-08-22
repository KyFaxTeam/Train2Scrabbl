/**
 * Le lexique du moteur : un test d'appartenance, rien de plus.
 *
 * Il remplace `gaddag.bin` (5,74 Mo bruts / 3,23 Mo transferes / ~18 s de
 * premiere visite). En dehors de MoveGenerator - casse et inutilise, voir le
 * commentaire en tete de ce fichier - la seule operation que le moteur
 * demandait au GADDAG etait `contains()`. On transportait un index de prefixes
 * de 3 Mo pour faire un `Set.has`.
 *
 * Ici : la liste ODS8 triee, front-codee, 236 Ko gzip (voir
 * scripts/export_lexicon.py). Elle est decodee en un seul bloc de texte plus un
 * index d'offsets, et interrogee par recherche dichotomique directement dans ce
 * bloc, sans allouer de sous-chaine.
 *
 * Pourquoi pas un `Set<string>` : mesure sur les 402 325 mots, un Set coute
 * 85 Mo de tas contre ~6,5 Mo pour bloc + index, pour un gain de 1,4 us par
 * appel. Une generation d'exercice fait ~1 700 appels : 2,4 ms de difference,
 * contre 78 Mo de memoire sur un telephone.
 */

const MAGIC = 'T2S-LEX1';

export class Lexicon {
    /** Tous les mots concatenes, separes par '\n', dans l'ordre alphabetique. */
    private readonly blob: string;
    /** offsets[i] = position du mot i dans `blob`. Taille n + 1. */
    private readonly offsets: Uint32Array;
    /** Longueur de chaque mot, pour filtrer par taille sans decouper le bloc. */
    private readonly lengths: Uint8Array;
    private readonly rangeCache = new Map<string, string[]>();

    readonly size: number;

    private constructor(blob: string, offsets: Uint32Array, lengths: Uint8Array) {
        this.blob = blob;
        this.offsets = offsets;
        this.lengths = lengths;
        this.size = lengths.length;
    }

    /**
     * Decode le format front-code produit par scripts/export_lexicon.py.
     * Leve si l'entete manque : un lexique tronque ou remplace par une page
     * d'erreur HTML doit s'annoncer, pas produire un moteur qui refuse tous les
     * mots en silence.
     */
    static fromFrontCoded(text: string): Lexicon {
        const lines = text.split('\n');
        if (lines[0]?.trim() !== MAGIC) {
            throw new Error(
                `Lexique illisible : entete « ${MAGIC} » attendue, « ${(lines[0] || '').slice(0, 20)} » recue`
            );
        }

        const count = lines.length - 1;
        const parts: string[] = new Array(count);
        const lengths = new Uint8Array(count);
        const offsets = new Uint32Array(count + 1);

        let previous = '';
        let offset = 0;
        let written = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const shared = line.charCodeAt(0) - 48;
            const word = previous.slice(0, shared) + line.slice(1);
            previous = word;

            parts[written] = word;
            lengths[written] = word.length;
            offsets[written] = offset;
            offset += word.length + 1; // +1 pour le '\n' de separation
            written++;
        }

        if (written === 0) throw new Error('Lexique vide');

        offsets[written] = offset;
        const blob = parts.slice(0, written).join('\n');

        return new Lexicon(blob, offsets.slice(0, written + 1), lengths.slice(0, written));
    }

    /** Test d'appartenance. Dichotomie dans le bloc, sans allocation. */
    has(word: string): boolean {
        const target = word.toUpperCase();
        let low = 0;
        let high = this.size - 1;

        while (low <= high) {
            const mid = (low + high) >> 1;
            const start = this.offsets[mid];
            const length = this.lengths[mid];

            let comparison = 0;
            const shortest = Math.min(length, target.length);
            for (let i = 0; i < shortest; i++) {
                const delta = this.blob.charCodeAt(start + i) - target.charCodeAt(i);
                if (delta !== 0) { comparison = delta; break; }
            }
            if (comparison === 0) comparison = length - target.length;

            if (comparison === 0) return true;
            if (comparison < 0) low = mid + 1;
            else high = mid - 1;
        }

        return false;
    }

    /**
     * Les mots dont la longueur est comprise entre `min` et `max`.
     * Materialise a la demande puis conserve : le vivier de decor n'utilise que
     * trois tranches (2-4, 5-6, 7-8), inutile de decouper les 402 325 mots.
     */
    wordsByLength(min: number, max: number): string[] {
        const key = `${min}-${max}`;
        const cached = this.rangeCache.get(key);
        if (cached) return cached;

        const words: string[] = [];
        for (let i = 0; i < this.size; i++) {
            const length = this.lengths[i];
            if (length >= min && length <= max) {
                const start = this.offsets[i];
                words.push(this.blob.slice(start, start + length));
            }
        }
        this.rangeCache.set(key, words);
        return words;
    }
}
