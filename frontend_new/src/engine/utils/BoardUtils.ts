import { Board } from '../models/Board';
import { Direction } from '../models/Types';

export class BoardUtils {
    /**
     * Obtient le préfixe pour une position donnée.
     */
    static getPrefix(board: Board, row: number, col: number, direction: Direction): string {
        const prefix: string[] = [];
        let currentRow = row;
        let currentCol = col;

        while (true) {
            if (direction === Direction.HORIZONTAL) {
                currentCol -= 1;
            } else {
                currentRow -= 1;
            }

            if (!(0 <= currentRow && currentRow < board.size && 0 <= currentCol && currentCol < board.size)) {
                break;
            }

            const letter = board.getLetter(currentRow, currentCol);
            if (!letter) {
                break;
            }
            prefix.unshift(letter);
        }

        return prefix.join('');
    }

    /**
     * Obtient le suffixe pour une position donnée.
     */
    static getSuffix(board: Board, row: number, col: number, direction: Direction): string {
        const suffix: string[] = [];
        let currentRow = row;
        let currentCol = col;

        while (true) {
            if (direction === Direction.HORIZONTAL) {
                currentCol += 1;
            } else {
                currentRow += 1;
            }

            if (!(0 <= currentRow && currentRow < board.size && 0 <= currentCol && currentCol < board.size)) {
                break;
            }

            const letter = board.getLetter(currentRow, currentCol);
            if (!letter) {
                break;
            }
            suffix.push(letter);
        }

        return suffix.join('');
    }

    /**
     * Vérifie les règles de base pour le placement d'un mot.
     */
    static checkWordPlacement(board: Board, word: string, row: number, col: number, direction: Direction): boolean {
        const wordLength = word.length;

        // 1. Vérifie les limites du plateau
        if (direction === Direction.HORIZONTAL) {
            if (col < 0 || col + wordLength > board.size) {
                return false;
            }
        } else {
            if (row < 0 || row + wordLength > board.size) {
                return false;
            }
        }

        // 2. Vérifie le premier coup
        if (board.isEmpty()) {
            const center = Math.floor(board.size / 2);
            if (direction === Direction.HORIZONTAL) {
                return row === center && (col <= center && center < col + wordLength);
            } else {
                return col === center && (row <= center && center < row + wordLength);
            }
        }

        // 3. Vérifie les connexions
        let foundConnection = false;

        for (let i = 0; i < wordLength; i++) {
            const letter = word[i];
            const currentRow = row + (direction === Direction.VERTICAL ? i : 0);
            const currentCol = col + (direction === Direction.HORIZONTAL ? i : 0);

            const existing = board.getLetter(currentRow, currentCol);
            if (existing) {
                if (existing !== letter) {
                    return false;
                }
                foundConnection = true;
            } else if (board.isAdjacentToLetter(currentRow, currentCol)) {
                foundConnection = true;
            }
        }

        return foundConnection || (board.isEmpty() && wordLength > 0);
    }
}
