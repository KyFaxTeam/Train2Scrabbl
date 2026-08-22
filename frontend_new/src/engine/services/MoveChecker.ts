import { Board } from '../models/Board';
import type { Lexicon } from '../models/Lexicon';
import { Direction } from '../models/Types';
import { ScoreCalculator } from './ScoreCalculator';
import { WordValidator } from './WordValidator';

export interface PlacedTile {
    row: number;
    col: number;
    char: string;
}

export interface MoveVerdict {
    /** `true` seulement si le coup est REELLEMENT jouable sur ce plateau. */
    legal: boolean;
    /** Pourquoi le coup est refuse, en une phrase adressee au joueur. */
    reason?: string;
    /** Le mot principal forme, lettres du plateau comprises. */
    word?: string;
    row?: number;
    col?: number;
    direction?: 'H' | 'V';
    /** Mot principal + mots transversaux crees par le coup. */
    wordsFormed?: string[];
    score?: number;
    tilesUsed: number;
}

export interface Placement {
    row: number;
    col: number;
    direction: 'H' | 'V';
    score: number;
}

/**
 * Arbitre du coup joue par l'utilisateur.
 *
 * Ce qui existait avant : `checkAnswer` triait les jetons poses par ligne puis
 * colonne, concatenait les lettres et comparait la chaine au mot attendu. Elle
 * ne verifiait ni l'alignement, ni la contiguite, ni le raccordement au
 * plateau, ni les mots transversaux. Les sept jetons eparpilles aux quatre
 * coins du plateau declenchaient les confettis, pourvu que l'ordre de lecture
 * donne les bonnes lettres.
 *
 * Ici on reconstitue le coup comme le ferait un arbitre : alignement, aucun
 * trou, raccordement au plateau, puis tous les mots formes dans le lexique.
 */
export class MoveChecker {
    private readonly board: Board;
    private readonly lexicon: Lexicon;

    constructor(lexicon: Lexicon, initialTiles: PlacedTile[]) {
        this.lexicon = lexicon;
        this.board = new Board();
        for (const tile of initialTiles) {
            this.board.placeLetter(tile.row, tile.col, tile.char.toUpperCase());
        }
    }

    /** Meme arbitre, a partir d'une grille brute (cote generateur). */
    static fromGrid(lexicon: Lexicon, grid: (string | null)[][]): MoveChecker {
        const checker = new MoveChecker(lexicon, []);
        checker.board.grid = grid.map(line => [...line]);
        return checker;
    }

    check(placed: PlacedTile[]): MoveVerdict {
        const refuse = (reason: string): MoveVerdict => ({ legal: false, reason, tilesUsed: placed.length });

        if (placed.length === 0) {
            return refuse('Aucune lettre posee : place tes jetons sur le plateau.');
        }

        for (const tile of placed) {
            if (!this.board.isValidPosition(tile.row, tile.col)) {
                return refuse('Une lettre est hors du plateau.');
            }
            if (this.board.getLetter(tile.row, tile.col) !== null) {
                return refuse('Une lettre est posee sur une case deja occupee.');
            }
        }

        const rows = new Set(placed.map(t => t.row));
        const cols = new Set(placed.map(t => t.col));
        if (rows.size > 1 && cols.size > 1) {
            return refuse('Toutes les lettres posees doivent etre sur une meme ligne ou une meme colonne.');
        }

        // Une seule lettre posee : la direction est ambigue. On essaie les deux
        // et on garde le meilleur coup legal.
        const directions: ('H' | 'V')[] =
            placed.length === 1 ? ['H', 'V'] : [rows.size === 1 ? 'H' : 'V'];

        let lastRefusal = 'Ce coup ne peut pas etre joue.';
        let best: MoveVerdict | null = null;

        for (const direction of directions) {
            const verdict = this.checkInDirection(placed, direction);
            if (verdict.legal) {
                if (!best || (verdict.score ?? 0) > (best.score ?? 0)) best = verdict;
            } else if (verdict.reason) {
                lastRefusal = verdict.reason;
            }
        }

        return best ?? refuse(lastRefusal);
    }

    private checkInDirection(placed: PlacedTile[], direction: 'H' | 'V'): MoveVerdict {
        const refuse = (reason: string): MoveVerdict => ({ legal: false, reason, tilesUsed: placed.length });
        const vertical = direction === 'V';

        const grid = this.board.grid.map(line => [...line]);
        for (const tile of placed) {
            grid[tile.row][tile.col] = tile.char.toUpperCase();
        }

        const fixed = vertical ? placed[0].col : placed[0].row;
        const varying = placed.map(t => (vertical ? t.row : t.col)).sort((a, b) => a - b);

        // Contiguite : les trous entre deux jetons poses doivent etre combles
        // par des lettres deja presentes sur le plateau.
        for (let i = varying[0]; i <= varying[varying.length - 1]; i++) {
            const cell = vertical ? grid[i][fixed] : grid[fixed][i];
            if (cell === null) {
                return refuse('Les lettres posees doivent se suivre, sans case vide entre elles.');
            }
        }

        // Raccordement : au moins un jeton pose touche une lettre du plateau.
        const connected = placed.some(tile => this.board.isAdjacentToLetter(tile.row, tile.col));
        if (!connected && !this.board.isEmpty()) {
            return refuse('Le coup doit toucher une lettre deja posee sur le plateau.');
        }

        // Mot principal, prolonge des deux cotes par les lettres contigues.
        let start = varying[0];
        while (start > 0 && (vertical ? grid[start - 1][fixed] : grid[fixed][start - 1]) !== null) start--;
        let end = varying[varying.length - 1];
        while (end < this.board.size - 1 && (vertical ? grid[end + 1][fixed] : grid[fixed][end + 1]) !== null) end++;

        let word = '';
        for (let i = start; i <= end; i++) {
            word += vertical ? grid[i][fixed] : grid[fixed][i];
        }

        if (word.length < 2) {
            return refuse('Un coup doit former un mot d au moins deux lettres.');
        }

        const row = vertical ? start : fixed;
        const col = vertical ? fixed : start;
        const dirEnum = vertical ? Direction.VERTICAL : Direction.HORIZONTAL;

        const validator = new WordValidator(this.lexicon, this.board);
        const check = validator.validatePlacementComplete({ word, row, col, direction: dirEnum, score: 0 }, true);
        if (!check.isValid) {
            return refuse(check.message);
        }

        return {
            legal: true,
            word: check.mainWord,
            row,
            col,
            direction,
            wordsFormed: check.wordsFormed,
            score: this.scoreOf(word, row, col, dirEnum),
            tilesUsed: placed.length,
        };
    }

    /**
     * Tous les placements legaux du mot cible sur ce plateau avec ce tirage,
     * du meilleur au moins bon.
     *
     * Sert a deux choses : mesurer l'ambiguite de l'exercice (mediane mesuree
     * sur 40 plateaux : 3 collages legaux, jamais un seul en general - il est
     * donc faux d'exiger une position precise) et connaitre le MEILLEUR
     * collage, pour dire au joueur ce que son coup valait face au meilleur
     * possible.
     */
    findPlacements(word: string, rack: string[]): Placement[] {
        const found: Placement[] = [];
        const validator = new WordValidator(this.lexicon, this.board);
        const upper = word.toUpperCase();

        for (const direction of ['H', 'V'] as const) {
            const vertical = direction === 'V';
            for (let row = 0; row < this.board.size; row++) {
                for (let col = 0; col < this.board.size; col++) {
                    if (vertical && row + upper.length > this.board.size) continue;
                    if (!vertical && col + upper.length > this.board.size) continue;

                    const available = [...rack];
                    let playable = true;
                    let placedCells = 0;

                    for (let i = 0; i < upper.length; i++) {
                        const r = row + (vertical ? i : 0);
                        const c = col + (vertical ? 0 : i);
                        const existing = this.board.getLetter(r, c);
                        if (existing !== null) {
                            if (existing !== upper[i]) { playable = false; break; }
                        } else {
                            const index = available.indexOf(upper[i]);
                            if (index === -1) { playable = false; break; }
                            available.splice(index, 1);
                            placedCells++;
                        }
                    }
                    if (!playable || placedCells === 0) continue;

                    const dirEnum = vertical ? Direction.VERTICAL : Direction.HORIZONTAL;
                    const check = validator.validatePlacementComplete({ word: upper, row, col, direction: dirEnum, score: 0 }, true);
                    // On exige que le mot forme soit EXACTEMENT le mot cible : un
                    // placement qui le prolonge en un autre mot valide est un
                    // autre coup, pas un collage du mot demande.
                    if (!check.isValid || check.mainWord !== upper) continue;

                    found.push({ row, col, direction, score: this.scoreOf(upper, row, col, dirEnum) });
                }
            }
        }

        return found.sort((a, b) => b.score - a.score);
    }

    /**
     * ScoreCalculator marque les cases bonus comme consommees au fil du calcul :
     * deux appels d'affilee sur le meme plateau sous-evalueraient le second. On
     * lui donne donc un plateau neuf a chaque fois.
     */
    private scoreOf(word: string, row: number, col: number, direction: Direction): number {
        const board = new Board();
        board.grid = this.board.grid.map(line => [...line]);
        return new ScoreCalculator(board).calculateMoveScore({ word, row, col, direction, score: 0 });
    }
}
