// @ts-nocheck
import { Board } from '../models/Board';
import { Direction, type Move } from '../models/Types';
import { BoardUtils } from '../utils/BoardUtils';

export class ScoreCalculator {
    static readonly BINGO_BONUS = 50;

    static readonly LETTER_VALUES: Record<string, number> = {
        'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1,
        'J': 8, 'K': 10, 'L': 1, 'M': 2, 'N': 1, 'O': 1, 'P': 3, 'Q': 8, 'R': 1,
        'S': 1, 'T': 1, 'U': 1, 'V': 4, 'W': 10, 'X': 10, 'Y': 10, 'Z': 10
    };

    private board: Board;

    constructor(board: Board) {
        this.board = board;
    }

    simulateMoveScore(move: Move): number {
        // Sauvegarde l'état
        const tempMultipliers = new Set(this.board.used_multipliers);
        const tempGrid = this.board.grid.map(row => [...row]);

        try {
            return this.calculateMoveScore(move, true);
        } finally {
            // Restaure l'état
            this.board.used_multipliers = tempMultipliers;
            this.board.grid = tempGrid;
        }
    }

    calculateMoveScore(move: Move, _simulate: boolean = false): number {
        // En Python, il y a la logique de bonus bingo.
        // Wait, le bonus bingo est de +50 si on utilise 7 lettres du chevalet.
        // Wait, "move.word" n'est pas le nombre de lettres jouées s'il y a des lettres déjà sur le plateau.
        // Need to check how many letters were placed.
        let lettersPlaced = 0;
        for (let i = 0; i < move.word.length; i++) {
            const r = move.row + (move.direction === Direction.VERTICAL ? i : 0);
            const c = move.col + (move.direction === Direction.HORIZONTAL ? i : 0);
            if (!this.board.getLetter(r, c)) {
                lettersPlaced++;
            }
        }

        const wordScore = this._calculateWordScore(move.word, move.row, move.col, move.direction);
        const crossScore = this._calculateCrossingWordsScore(move);

        let totalScore = wordScore + crossScore;
        if (lettersPlaced === 7) {
            totalScore += ScoreCalculator.BINGO_BONUS;
        }

        return totalScore;
    }

    private _calculateWordScore(word: string, row: number, col: number, direction: Direction): number {
        let letterScore = 0;
        let wordMultiplier = 1;

        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            const currentRow = row + (direction === Direction.VERTICAL ? i : 0);
            const currentCol = col + (direction === Direction.HORIZONTAL ? i : 0);

            if (!this.board.getLetter(currentRow, currentCol)) {
                const { letterMultiplier, wordMultiplier: wordMult } = this.board.getSquareMultipliers(currentRow, currentCol);
                const letterValue = ScoreCalculator.LETTER_VALUES[letter] || 0;
                letterScore += letterValue * letterMultiplier;
                wordMultiplier *= wordMult;
                this.board.useMultiplier(currentRow, currentCol);
            } else {
                const letterValue = ScoreCalculator.LETTER_VALUES[letter] || 0;
                letterScore += letterValue;
            }
        }

        return letterScore * wordMultiplier;
    }

    private _calculateCrossingWordsScore(move: Move): number {
        // Sauvegarder l'état
        const tempGrid = this.board.grid.map(row => [...row]);
        const tempMultipliers = new Set(this.board.used_multipliers);

        // Placer les lettres temporairement
        for (let i = 0; i < move.word.length; i++) {
            const letter = move.word[i];
            const r = move.row + (move.direction === Direction.VERTICAL ? i : 0);
            const c = move.col + (move.direction === Direction.HORIZONTAL ? i : 0);
            this.board.grid[r][c] = letter;
        }

        try {
            let crossScore = 0;
            for (let i = 0; i < move.word.length; i++) {
                const letter = move.word[i];
                const currentRow = move.row + (move.direction === Direction.VERTICAL ? i : 0);
                const currentCol = move.col + (move.direction === Direction.HORIZONTAL ? i : 0);

                // Vérifier si c'était une case vide avant
                if (tempGrid[currentRow][currentCol] === null) {
                    const crossDirection = move.direction === Direction.HORIZONTAL ? Direction.VERTICAL : Direction.HORIZONTAL;

                    const prefix = BoardUtils.getPrefix(this.board, currentRow, currentCol, crossDirection);
                    const suffix = BoardUtils.getSuffix(this.board, currentRow, currentCol, crossDirection);

                    if (prefix || suffix) {
                        const crossWord = prefix + letter + suffix;
                        const startRow = crossDirection === Direction.VERTICAL ? currentRow - prefix.length : currentRow;
                        const startCol = crossDirection === Direction.HORIZONTAL ? currentCol - prefix.length : currentCol;

                        const wordScore = this._calculateWordScore(crossWord, startRow, startCol, crossDirection);
                        crossScore += wordScore;
                    }
                }
            }
            return crossScore;
        } finally {
            this.board.grid = tempGrid;
            this.board.used_multipliers = tempMultipliers;
        }
    }
}
