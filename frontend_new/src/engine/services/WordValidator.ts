import type { Lexicon } from '../models/Lexicon';
import { Board } from '../models/Board';
import { Direction, type Move } from '../models/Types';

export interface PlacementCheck {
    isValid: boolean;
    message: string;
    /**
     * Le mot principal REELLEMENT forme, lettres voisines comprises.
     * Poser ADA juste apres FOUR forme FOURADA, pas ADA.
     */
    mainWord: string;
    /** Mot principal etendu + mots transversaux, dans l'ordre de formation. */
    wordsFormed: string[];
}

/**
 * Validation d'un placement.
 *
 * Le trou repare ici : la version precedente validait `move.word` tel quel.
 * Elle verifiait la connexite et les mots transversaux, mais jamais le mot
 * principal PROLONGE par les lettres contigues dans sa propre direction. Poser
 * ADA a droite de FOUR passait donc pour valide alors que le coup forme
 * FOURADA, qui n'existe pas.
 *
 * Consequences mesurees sur 40 exercices generes avant correction :
 *   - 18 plateaux sur 40 contenaient au moins un mot inexistant
 *     (FOURADA, BAUDATAIT, LIAISOTRON...) ;
 *   - 3 exercices sur 40 avaient une solution attendue ILLEGALE : le joueur
 *     ne pouvait pas la trouver puisqu'elle n'existe pas.
 */
export class WordValidator {
    private lexicon: Lexicon;
    private board: Board;

    constructor(lexicon: Lexicon, board: Board) {
        this.lexicon = lexicon;
        this.board = board;
    }

    isValidWord(word: string): boolean {
        return this.lexicon.has(word);
    }

    validatePlacementComplete(move: Move, checkConnection: boolean = true): PlacementCheck {
        const invalid = (message: string): PlacementCheck =>
            ({ isValid: false, message, mainWord: '', wordsFormed: [] });

        const { word, row, col, direction } = move;
        const size = this.board.size;
        const vertical = direction === Direction.VERTICAL;

        const endRow = vertical ? row + word.length - 1 : row;
        const endCol = vertical ? col : col + word.length - 1;
        if (row < 0 || col < 0 || endRow >= size || endCol >= size) {
            return invalid('Placement hors du plateau');
        }

        // Grille de travail : on ne touche pas au plateau reel. L'ancienne
        // version ecrivait dans `board.grid` puis restaurait dans un `finally`,
        // ce qui laissait le plateau corrompu si une exception survenait avant.
        const grid = this.board.grid.map(line => [...line]);
        let placedCells = 0;
        let touchesExisting = false;

        for (let i = 0; i < word.length; i++) {
            const r = row + (vertical ? i : 0);
            const c = col + (vertical ? 0 : i);
            const existing = grid[r][c];
            if (existing !== null) {
                if (existing !== word[i]) {
                    return invalid(`La case (${r},${c}) porte deja un ${existing}`);
                }
                touchesExisting = true;
            } else {
                grid[r][c] = word[i];
                placedCells++;
            }
        }

        if (placedCells === 0) {
            return invalid('Aucune lettre posee');
        }

        if (checkConnection && !this.board.isEmpty()) {
            if (!touchesExisting && !this.hasNeighbour(word, row, col, vertical)) {
                return invalid('Le coup ne touche aucune lettre du plateau');
            }
        }

        const wordsFormed: string[] = [];

        const mainWord = this.readWord(grid, row, col, vertical, word.length);
        if (!this.isValidWord(mainWord)) {
            return { isValid: false, message: `Mot inexistant : ${mainWord}`, mainWord, wordsFormed: [mainWord] };
        }
        wordsFormed.push(mainWord);

        for (let i = 0; i < word.length; i++) {
            const r = row + (vertical ? i : 0);
            const c = col + (vertical ? 0 : i);
            if (this.board.grid[r][c] !== null) continue; // lettre deja presente : pas de mot transversal cree

            const crossWord = this.readWord(grid, r, c, !vertical, 1);
            if (crossWord.length <= 1) continue;
            if (!this.isValidWord(crossWord)) {
                return { isValid: false, message: `Mot croise inexistant : ${crossWord}`, mainWord, wordsFormed };
            }
            wordsFormed.push(crossWord);
        }

        return { isValid: true, message: 'Placement valide', mainWord, wordsFormed };
    }

    /** Le mot complet couvrant le segment donne, prolonge des deux cotes. */
    private readWord(
        grid: (string | null)[][],
        row: number,
        col: number,
        vertical: boolean,
        span: number
    ): string {
        const size = this.board.size;

        let start = vertical ? row : col;
        while (start > 0 && (vertical ? grid[start - 1][col] : grid[row][start - 1]) !== null) start--;

        let end = (vertical ? row : col) + span - 1;
        while (end < size - 1 && (vertical ? grid[end + 1][col] : grid[row][end + 1]) !== null) end++;

        let word = '';
        for (let i = start; i <= end; i++) {
            word += vertical ? grid[i][col] : grid[row][i];
        }
        return word;
    }

    /** Une des cases posees touche-t-elle une lettre deja sur le plateau ? */
    private hasNeighbour(word: string, row: number, col: number, vertical: boolean): boolean {
        for (let i = 0; i < word.length; i++) {
            const r = row + (vertical ? i : 0);
            const c = col + (vertical ? 0 : i);
            if (this.board.isAdjacentToLetter(r, c)) return true;
        }
        return false;
    }
}
