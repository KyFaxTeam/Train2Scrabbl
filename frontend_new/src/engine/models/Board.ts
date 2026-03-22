// @ts-nocheck

import { SquareType, Direction, type Move } from './Types';

export class Board {
    static readonly SIZE = 15;

    // Multipliers (row, col)
    static readonly TRIPLE_WORD_SCORE = [[0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14]];
    static readonly DOUBLE_WORD_SCORE = [[1, 1], [1, 13], [2, 2], [2, 12], [3, 3], [3, 11], [4, 4], [4, 10], [7, 7], [10, 4], [10, 10], [11, 3], [11, 11], [12, 2], [12, 12], [13, 1], [13, 13]];
    static readonly TRIPLE_LETTER_SCORE = [[1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9]];
    static readonly DOUBLE_LETTER_SCORE = [[0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14], [6, 2], [6, 6], [6, 8], [6, 12], [7, 3], [7, 11], [8, 2], [8, 6], [8, 8], [8, 12], [11, 0], [11, 7], [11, 14], [12, 6], [12, 8], [14, 3], [14, 11]];

    public size = Board.SIZE;
    public grid: (string | null)[][];
    public center: number;
    public used_multipliers: Set<string>;
    public total_score: number = 0;

    constructor() {
        this.center = Math.floor(this.size / 2);
        this.grid = Array(this.size).fill(null).map(() => Array(this.size).fill(null));
        this.used_multipliers = new Set();
    }

    public clone(): Board {
        const b = new Board();
        b.grid = this.grid.map(row => [...row]);
        b.used_multipliers = new Set(this.used_multipliers);
        b.total_score = this.total_score;
        return b;
    }

    public isEmpty(): boolean {
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (this.grid[i][j] !== null) return false;
            }
        }
        return true;
    }

    public isCenterOccupied(): boolean {
        return this.grid[this.center][this.center] !== null;
    }

    public getLetter(row: number, col: number): string | null {
        if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
            return this.grid[row][col];
        }
        return null;
    }

    public placeLetter(row: number, col: number, letter: string): void {
        if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
            this.grid[row][col] = letter;
        } else {
            throw new Error(`Position invalide : (${row}, ${col})`);
        }
    }

    public clearLetter(row: number, col: number): void {
        if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
            this.grid[row][col] = null;
        }
    }

    public isAdjacentToLetter(row: number, col: number): boolean {
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of directions) {
            if (this.isValidPosition(row + dr, col + dc) && this.getLetter(row + dr, col + dc) !== null) {
                return true;
            }
        }
        return false;
    }

    public getSquareType(row: number, col: number): SquareType {
        // const pos = [row, col];
        const isMatch = (arr: number[][]) => arr.some(p => p[0] === row && p[1] === col);

        if (row === this.center && col === this.center) return SquareType.START;
        if (isMatch(Board.TRIPLE_WORD_SCORE)) return SquareType.TRIPLE_WORD;
        if (isMatch(Board.DOUBLE_WORD_SCORE)) return SquareType.DOUBLE_WORD;
        if (isMatch(Board.TRIPLE_LETTER_SCORE)) return SquareType.TRIPLE_LETTER;
        if (isMatch(Board.DOUBLE_LETTER_SCORE)) return SquareType.DOUBLE_LETTER;

        return SquareType.NORMAL;
    }

    public getMultiplier(row: number, col: number): [number, number] { // [letterMult, wordMult]
        const key = `${row},${col}`;
        if (this.used_multipliers.has(key)) {
            return [1, 1];
        }

        const type = this.getSquareType(row, col);
        switch (type) {
            case SquareType.TRIPLE_WORD: return [1, 3];
            case SquareType.DOUBLE_WORD: return [1, 2];
            case SquareType.START: return [1, 2];
            case SquareType.TRIPLE_LETTER: return [3, 1];
            case SquareType.DOUBLE_LETTER: return [2, 1];
            default: return [1, 1];
        }
    }

    public getSquareMultipliers(row: number, col: number): { letterMultiplier: number, wordMultiplier: number } {
        const [l, w] = this.getMultiplier(row, col);
        return { letterMultiplier: l, wordMultiplier: w };
    }

    public useMultiplier(row: number, col: number): void {
        this.used_multipliers.add(`${row},${col}`);
    }

    public isValidPosition(row: number, col: number): boolean {
        return row >= 0 && row < this.size && col >= 0 && col < this.size;
    }

    public placeWord(row: number, col: number, word: string, direction: Direction): boolean {
        for (let i = 0; i < word.length; i++) {
            const r = direction === Direction.HORIZONTAL ? row : row + i;
            const c = direction === Direction.HORIZONTAL ? col + i : col;

            if (!this.isValidPosition(r, c)) return false;

            if (this.getLetter(r, c) === null) {
                this.placeLetter(r, c, word[i]);
                this.useMultiplier(r, c);
            } else if (this.getLetter(r, c) !== word[i]) {
                return false;
            }
        }
        return true;
    }

    public applyMove(move: Move, score: number): void {
        this.placeWord(move.row, move.col, move.word, move.direction);
        this.total_score += score;
    }
}
