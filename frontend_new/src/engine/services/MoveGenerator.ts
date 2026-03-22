// @ts-nocheck
import { Board } from '../models/Board';
import { Gaddag } from '../models/Gaddag';
import { Rack } from '../models/Rack';
import { Direction } from '../models/Types';
import type { Move } from '../models/Types';
import { BoardUtils } from '../utils/BoardUtils';
import { ScoreCalculator } from './ScoreCalculator';
import { WordValidator } from './WordValidator';

export class MoveGenerator {
    private gaddag: Gaddag;
    private board: Board;
    private validator: WordValidator;
    private scoreCalculator: ScoreCalculator;
    private readonly blankLetter = '_';

    constructor(gaddag: Gaddag, board: Board) {
        this.gaddag = gaddag;
        this.board = board;
        this.validator = new WordValidator(gaddag, board);
        this.scoreCalculator = new ScoreCalculator(board);
    }

    generateMoves(rackStr: string): Move[] {
        const moves: Move[] = [];
        const rack = new Rack(rackStr);
        const constraints = this._analyzeBoard();

        for (const [posKey, directions] of Object.entries(constraints)) {
            const [rowStr, colStr] = posKey.split(',');
            const row = parseInt(rowStr, 10);
            const col = parseInt(colStr, 10);

            for (const [direction, validLetters] of Object.entries(directions)) {
                const dirEnum = direction as Direction;
                const prefix = this._getPrefix(row, col, dirEnum);
                // const suffix = this._getSuffix(row, col, dirEnum);

                let startNode = 0;

                if (prefix) {
                    const reversedPrefix = prefix.split('').reverse().join('');
                    for (const char of reversedPrefix) {
                        const targetNode = this.gaddag.getTransition(startNode, char);
                        if (!targetNode) {
                            startNode = 0; // Invalide
                            break;
                        }
                        startNode = targetNode;
                    }
                }

                if (!startNode && startNode !== 0) continue;

                let availableLetters = rack.getLetters();
                if (validLetters) {
                    availableLetters = new Set([...availableLetters].filter(l => validLetters.has(l)));
                }

                for (const letter of availableLetters) {
                    const tempRack = new Rack(rackStr);
                    tempRack.removeLetters(letter);

                    const words = this._findWords(row, col, dirEnum, letter, tempRack);

                    for (const word of words) {
                        let startRow = row;
                        let startCol = col;
                        if (dirEnum === Direction.HORIZONTAL) {
                            startCol -= prefix.length;
                        } else {
                            startRow -= prefix.length;
                        }

                        const move: Move = {
                            word,
                            row: startRow,
                            col: startCol,
                            direction: dirEnum
                        };
                        move.score = this.scoreCalculator.calculateMoveScore(move, true);
                        moves.push(move);
                    }
                }
            }
        }

        return moves;
    }

    private _analyzeBoard(): Record<string, Record<Direction, Set<string> | null>> {
        const constraints: Record<string, Record<Direction, Set<string> | null>> = {};

        const addConstraint = (row: number, col: number, direction: Direction, letters: Set<string> | null) => {
            const pos = `${row},${col}`;
            if (!constraints[pos]) constraints[pos] = { [Direction.HORIZONTAL]: null, [Direction.VERTICAL]: null };
            constraints[pos][direction] = letters;
        };

        const ASCIILetters = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(''));

        for (let row = 0; row < this.board.size; row++) {
            for (let col = 0; col < this.board.size; col++) {
                if (!this.board.getLetter(row, col) && !this._isInternalAnchor(row, col)) {
                    let adjacent = false;

                    [Direction.HORIZONTAL, Direction.VERTICAL].forEach(d => {
                        let hasCross = false;
                        if (d === Direction.HORIZONTAL) {
                            hasCross = (row > 0 && !!this.board.getLetter(row - 1, col)) ||
                                (row < this.board.size - 1 && !!this.board.getLetter(row + 1, col));
                        } else {
                            hasCross = (col > 0 && !!this.board.getLetter(row, col - 1)) ||
                                (col < this.board.size - 1 && !!this.board.getLetter(row, col + 1));
                        }

                        if (hasCross) {
                            adjacent = true;
                            const validLetters = this._getValidLetters(row, col, d);
                            if (validLetters && validLetters.size > 0) {
                                addConstraint(row, col, d, validLetters);
                            }
                        }
                    });

                    if (adjacent) {
                        [Direction.HORIZONTAL, Direction.VERTICAL].forEach(d => {
                            const pos = `${row},${col}`;
                            if (!constraints[pos] || !constraints[pos][d]) {
                                addConstraint(row, col, d, new Set(ASCIILetters));
                            }
                        });
                    }
                }
            }
        }

        return constraints;
    }

    private _getValidLetters(row: number, col: number, direction: Direction): Set<string> {
        let validLetters = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(''));

        const prefix = this._getPrefix(row, col, direction);
        // const suffix = this._getSuffix(row, col, direction);

        if (prefix || suffix) {
            let node = 0;

            if (prefix) {
                const reversedPrefix = prefix.split('').reverse().join('');
                for (const char of reversedPrefix) {
                    const targetNode = this.gaddag.getTransition(node, char);
                    if (!targetNode) return new Set();
                    node = targetNode;
                }
            }

            const delimTarget = this.gaddag.getTransition(node, '+');
            if (!delimTarget) return new Set();
            node = delimTarget;

            if (suffix) {
                for (const char of suffix) {
                    const targetNode = this.gaddag.getTransition(node, char);
                    if (!targetNode) return new Set();
                    node = targetNode;
                }
            }

            const validSet = new Set<string>();
            const transitions = this.gaddag.getTransitions(node);
            for (const char of transitions.keys()) {
                validSet.add(char);
            }
            return validSet;
        }

        return validLetters;
    }

    private _getPrefix(row: number, col: number, direction: Direction): string {
        return BoardUtils.getPrefix(this.board, row, col, direction);
    }

    private _getSuffix(row: number, col: number, direction: Direction): string {
        return BoardUtils.getSuffix(this.board, row, col, direction);
    }

    private _isInternalAnchor(row: number, col: number): boolean {
        const hasLeft = col > 0 && !!this.board.getLetter(row, col - 1);
        const hasRight = col < this.board.size - 1 && !!this.board.getLetter(row, col + 1);
        if (hasLeft && hasRight) return true;

        const hasUp = row > 0 && !!this.board.getLetter(row - 1, col);
        const hasDown = row < this.board.size - 1 && !!this.board.getLetter(row + 1, col);
        return hasUp && hasDown;
    }

    private _findWords(row: number, col: number, direction: Direction, letter: string, rack: Rack): string[] {
        const words: string[] = [];
        if (this._isInternalAnchor(row, col)) return words;

        const prefix = this._getPrefix(row, col, direction);
        let currentNode = 0;

        if (prefix) {
            const reversedPrefix = prefix.split('').reverse().join('');
            for (const char of reversedPrefix) {
                const targetNode = this.gaddag.getTransition(currentNode, char);
                if (!targetNode) return words;
                currentNode = targetNode;
            }
        }

        const delimTarget = this.gaddag.getTransition(currentNode, '+');
        if (!delimTarget) return words;
        currentNode = delimTarget;

        const exploreSuffixes = (node: number, usedLetters: string, remainingRack: Rack) => {
            if (this.gaddag.isTerminal(node)) {
                const word = prefix + letter + usedLetters;

                const move: Move = { word, row: direction === Direction.VERTICAL ? row - prefix.length : row, col: direction === Direction.HORIZONTAL ? col - prefix.length : col, direction };
                if (this.validator.validatePlacementComplete(move).isValid) {
                    words.push(word);
                }
            }

            const possibleRLetters = remainingRack.getLetters();

            for (const nextLetter of possibleRLetters) {
                if (nextLetter !== this.blankLetter) {
                    const targetNode = this.gaddag.getTransition(node, nextLetter);
                    if (targetNode) {
                        const tempRack = new Rack(remainingRack.toString());
                        if (tempRack.removeLetters(nextLetter)) {
                            exploreSuffixes(targetNode, usedLetters + nextLetter, tempRack);
                        }
                    }
                }
            }

            if (possibleRLetters.has(this.blankLetter)) {
                const tempRack = new Rack(remainingRack.toString());
                if (tempRack.removeLetters(this.blankLetter)) {
                    for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('')) {
                        const targetNode = this.gaddag.getTransition(node, char);
                        if (targetNode) {
                            exploreSuffixes(targetNode, usedLetters + char.toLowerCase(), tempRack);
                        }
                    }
                }
            }
        };

        const targetLetterNode = this.gaddag.getTransition(currentNode, letter);
        if (targetLetterNode) {
            exploreSuffixes(targetLetterNode, "", new Rack(rack.toString()));
        }

        return words;
    }
}
