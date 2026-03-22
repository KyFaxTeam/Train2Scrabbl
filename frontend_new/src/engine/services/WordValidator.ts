import { Gaddag } from '../models/Gaddag';
import { Board } from '../models/Board';
import { Direction, type Move } from '../models/Types';
import { BoardUtils } from '../utils/BoardUtils';

export class WordValidator {
    private gaddag: Gaddag;
    private board: Board;

    constructor(gaddag: Gaddag, board: Board) {
        this.gaddag = gaddag;
        this.board = board;
    }

    isValidWord(word: string): boolean {
        return this.gaddag.contains(word);
    }

    validatePlacementComplete(move: Move, checkConnection: boolean = true): { isValid: boolean; message: string } {
        if (checkConnection && !BoardUtils.checkWordPlacement(this.board, move.word, move.row, move.col, move.direction)) {
            return { isValid: false, message: "Placement invalide (hors limites ou non connecté)" };
        }

        if (!this.isValidWord(move.word)) {
            return { isValid: false, message: `Le mot principal n'est pas dans le dictionnaire: ${move.word}` };
        }

        const wordsToCheck: string[] = [];

        // Temporarily place word to check crossed words
        const tempGrid = this.board.grid.map(row => [...row]);

        for (let i = 0; i < move.word.length; i++) {
            const r = move.row + (move.direction === Direction.VERTICAL ? i : 0);
            const c = move.col + (move.direction === Direction.HORIZONTAL ? i : 0);
            if (r < 0 || r >= this.board.size || c < 0 || c >= this.board.size) {
                return { isValid: false, message: "Hors limite" };
            }
            this.board.grid[r][c] = move.word[i];
        }

        try {
            for (let i = 0; i < move.word.length; i++) {
                const r = move.row + (move.direction === Direction.VERTICAL ? i : 0);
                const c = move.col + (move.direction === Direction.HORIZONTAL ? i : 0);

                if (tempGrid[r][c] === null) {
                    const crossDirection = move.direction === Direction.HORIZONTAL ? Direction.VERTICAL : Direction.HORIZONTAL;
                    const prefix = BoardUtils.getPrefix(this.board, r, c, crossDirection);
                    const suffix = BoardUtils.getSuffix(this.board, r, c, crossDirection);

                    if (prefix || suffix) {
                        const crossWord = prefix + move.word[i] + suffix;
                        wordsToCheck.push(crossWord);
                    }
                }
            }
        } finally {
            this.board.grid = tempGrid;
        }

        for (const word of wordsToCheck) {
            if (!this.isValidWord(word)) {
                return { isValid: false, message: `Mot croisé invalide: ${word}` };
            }
        }

        return { isValid: true, message: "Placement valide" };
    }
}
