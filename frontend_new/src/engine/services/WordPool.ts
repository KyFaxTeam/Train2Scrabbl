import type { Lexicon } from '../models/Lexicon';

/**
 * Le vivier de mots qui MEUBLE le plateau d'entrainement (phase de
 * respiration). Il ne sert jamais a valider quoi que ce soit : la validation
 * passe par le lexique complet.
 *
 * Deux corrections mesurees par rapport a la version precedente :
 *
 * 1. L'echantillonnage faisait `[...arr].sort(() => 0.5 - Math.random())`.
 *    Cout mesure : 84 % du temps total de generation d'un exercice (8 appels,
 *    ~21 ms chacun sur un tableau de 8 000 a 32 000 mots, pour n'en garder que
 *    50 a 100). Le melange obtenu etait en prime biaise - un comparateur
 *    aleatoire n'est pas un ordre, le resultat depend de l'algorithme de tri.
 *    Un Fisher-Yates partiel fait le meme travail en 0,04 ms.
 *
 * 2. La liste de mots venait d'un fichier separe (word_pool.txt, 136 Ko gzip).
 *    Elle est desormais decoupee dans le lexique deja charge.
 */
export class WordPool {
    private readonly lexicon: Lexicon;

    constructor(lexicon: Lexicon) {
        this.lexicon = lexicon;
    }

    getMotsCourts(limit: number = 200): string[] {
        return this.sample(this.lexicon.wordsByLength(2, 4), limit);
    }

    getMotsMoyens(limit: number = 150): string[] {
        return this.sample(this.lexicon.wordsByLength(5, 6), limit);
    }

    getMotsLongs(limit: number = 100): string[] {
        return this.sample(this.lexicon.wordsByLength(7, 8), limit);
    }

    getMotsContenantLettre(lettre: string, minLen: number = 2, maxLen: number = 5): string[] {
        const cible = lettre.toUpperCase();
        return this.lexicon.wordsByLength(minLen, maxLen).filter(mot => mot.includes(cible));
    }

    /**
     * Fisher-Yates partiel : on ne melange que les `size` premieres positions,
     * sur une copie. Chaque sous-ensemble a la meme probabilite d'etre tire.
     */
    private sample(words: string[], size: number): string[] {
        if (size >= words.length) return [...words];

        const copy = [...words];
        const out: string[] = new Array(size);
        for (let i = 0; i < size; i++) {
            const j = i + Math.floor(Math.random() * (copy.length - i));
            const tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
            out[i] = copy[i];
        }
        return out;
    }
}
