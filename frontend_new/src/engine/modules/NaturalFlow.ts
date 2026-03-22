// @ts-nocheck

import { Board } from '../models/Board';
import { Gaddag } from '../models/Gaddag';
import { Direction, type Move } from '../models/Types';
import type { AnchorPoint, NaturalFlowConfig, NaturalityScore, Placement, SituationEntrainement, Solution } from '../models/Situation';
import { ScoreCalculator } from '../services/ScoreCalculator';
import { WordValidator } from '../services/WordValidator';
import { WordPool } from '../services/WordPool';

export class NaturalFlow {
    static phaseAnchor(motCible: string, lettreAppui: string, grille: Board): AnchorPoint {
        const positionsCandidates: { row: number, col: number, score: number }[] = [];

        for (let row = 0; row < grille.size; row++) {
            for (let col = 0; col < grille.size; col++) {
                const score = NaturalFlow._evaluerPositionAppui(grille, row, col, motCible, lettreAppui);
                if (score > 0) {
                    positionsCandidates.push({ row, col, score });
                }
            }
        }

        positionsCandidates.sort((a, b) => b.score - a.score);

        if (positionsCandidates.length === 0) {
            const center = Math.floor(grille.size / 2);
            return { row: center, col: center, letter: lettreAppui };
        }

        const topCandidates = positionsCandidates.slice(0, 5);
        const best = topCandidates[Math.floor(Math.random() * topCandidates.length)];

        return { row: best.row, col: best.col, letter: lettreAppui };
    }

    private static _evaluerPositionAppui(grille: Board, row: number, col: number, motCible: string, lettreAppui: string): number {
        let score = 0;
        const motLen = motCible.length;

        const espaceH = NaturalFlow._calculerEspace(grille, row, col, Direction.HORIZONTAL);
        const espaceV = NaturalFlow._calculerEspace(grille, row, col, Direction.VERTICAL);

        if (espaceH < motLen && espaceV < motLen) return 0;

        score += Math.max(espaceH, espaceV) * 2;

        const multiplicateursProches = NaturalFlow._compterMultiplicateursAccessibles(grille, row, col, motLen);
        score += multiplicateursProches * 15;

        const center = Math.floor(grille.size / 2);
        const distanceCentre = Math.abs(row - center) + Math.abs(col - center);
        score -= distanceCentre * 0.5;

        if (row >= 3 && row <= 11 && col >= 3 && col <= 11) {
            score += 10;
        }

        const mult = grille.getSquareMultipliers(row, col);
        if (mult.wordMultiplier > 1) score += 20;
        if (mult.letterMultiplier > 1) score += 10;

        return score;
    }

    private static _calculerEspace(grille: Board, row: number, col: number, direction: Direction): number {
        if (direction === Direction.HORIZONTAL) {
            return col + (grille.size - 1 - col) + 1;
        } else {
            return row + (grille.size - 1 - row) + 1;
        }
    }

    private static _compterMultiplicateursAccessibles(grille: Board, row: number, col: number, motLen: number): number {
        let count = 0;

        for (let c = Math.max(0, col - motLen + 1); c < Math.min(grille.size, col + motLen); c++) {
            const mult = grille.getSquareMultipliers(row, c);
            if (mult.wordMultiplier > 1 || mult.letterMultiplier > 1) count++;
        }

        for (let r = Math.max(0, row - motLen + 1); r < Math.min(grille.size, row + motLen); r++) {
            const mult = grille.getSquareMultipliers(r, col);
            if (mult.wordMultiplier > 1 || mult.letterMultiplier > 1) count++;
        }

        return count;
    }

    static phaseBreathe(
        grille: Board,
        anchor: AnchorPoint,
        gaddag: Gaddag,
        wordPool: WordPool,
        motCible: string,
        tirage: string[],
        profondeur: number = 8
    ): { grille: Board, motsPlaces: string[] } {
        const motsPlaces: string[] = [];
        const scoreCalc = new ScoreCalculator(grille);

        const distribution = [
            { category: 'court', proba: 0.50 },
            { category: 'moyen', proba: 0.35 },
            { category: 'long', proba: 0.15 }
        ];

        for (let coup = 0; coup < profondeur; coup++) {
            const categorie = NaturalFlow._choisirCategorie(distribution);
            let candidats: string[] = [];

            if (categorie === 'court') candidats = wordPool.getMotsCourts(100);
            else if (categorie === 'moyen') candidats = wordPool.getMotsMoyens(80);
            else candidats = wordPool.getMotsLongs(50);

            if (candidats.length === 0) continue;

            const validator = new WordValidator(gaddag, grille);
            const placement = NaturalFlow._trouverPlacementNaturel(grille, gaddag, validator, candidats, anchor);

            if (placement) {
                const grilleBackup = grille.grid.map(row => [...row]);

                NaturalFlow._appliquerPlacement(grille, placement);

                if (!NaturalFlow._ancreToujoursAccessible(grille, anchor, motCible.length)) {
                    grille.grid = grilleBackup;
                    continue;
                }

                const validatorNew = new WordValidator(gaddag, grille);
                const placementsCible = NaturalFlow._genererPlacementsPourMotCible(
                    grille, motCible, [anchor.row, anchor.col], tirage, gaddag, validatorNew, scoreCalc
                );

                if (placementsCible.length === 0) {
                    grille.grid = grilleBackup;
                    continue;
                }

                motsPlaces.push(placement.mot);
            }
        }

        return { grille, motsPlaces };
    }

    private static _choisirCategorie(distribution: { category: string, proba: number }[]): string {
        const r = Math.random();
        let cumul = 0;
        for (const item of distribution) {
            cumul += item.proba;
            if (r <= cumul) return item.category;
        }
        return distribution[distribution.length - 1].category;
    }

    private static _trouverPlacementNaturel(
        grille: Board,
        gaddag: Gaddag,
        validator: WordValidator,
        candidats: string[],
        anchor: AnchorPoint
    ): Placement | null {
        const placementsValides: { placement: Placement, score: number }[] = [];

        const sampleSize = Math.min(50, candidats.length);
        const shuffled = [...candidats].sort(() => 0.5 - Math.random());
        const sampled = shuffled.slice(0, sampleSize);

        for (const mot of sampled) {
            const placements = NaturalFlow._genererPlacementsPourMot(mot, grille, gaddag, validator);
            for (const placement of placements) {
                if (NaturalFlow._bloqueAncre(placement, anchor, grille)) continue;

                const score = NaturalFlow._scoreNaturalitePlacement(placement, grille);
                placementsValides.push({ placement, score });
            }
        }

        if (placementsValides.length === 0) return null;

        placementsValides.sort((a, b) => b.score - a.score);
        const topK = placementsValides.slice(0, 5);
        return topK[Math.floor(Math.random() * topK.length)].placement;
    }

    private static _genererPlacementsPourMot(
        mot: string,
        grille: Board,
        gaddag: Gaddag,
        validator: WordValidator
    ): Placement[] {
        const placements: Placement[] = [];
        const casesOccupees = NaturalFlow._getOccupiedCells(grille);

        if (casesOccupees.length === 0) {
            const center = Math.floor(grille.size / 2);

            const startCol = center - Math.floor(mot.length / 2);
            if (startCol >= 0 && startCol + mot.length <= grille.size) {
                const isValid = validator.validatePlacementComplete({ word: mot, row: center, col: startCol, direction: Direction.HORIZONTAL } as any as any, false).isValid;
                if (isValid) placements.push({ mot, position: [center, startCol], direction: 'H' });
            }

            const startRow = center - Math.floor(mot.length / 2);
            if (startRow >= 0 && startRow + mot.length <= grille.size) {
                const isValid = validator.validatePlacementComplete({ word: mot, row: startRow, col: center, direction: Direction.VERTICAL } as any as any, false).isValid;
                if (isValid) placements.push({ mot, position: [startRow, center], direction: 'V' });
            }
            return placements;
        }

        for (const [anchorRow, anchorCol] of casesOccupees) {
            const lettreAncre = grille.getLetter(anchorRow, anchorCol);

            for (let i = 0; i < mot.length; i++) {
                if (mot[i] === lettreAncre) {
                    const startCol = anchorCol - i;
                    if (startCol >= 0 && startCol + mot.length <= grille.size) {
                        const isValid = validator.validatePlacementComplete({ word: mot, row: anchorRow, col: startCol, direction: Direction.HORIZONTAL } as any as any).isValid;
                        if (isValid) placements.push({ mot, position: [anchorRow, startCol], direction: 'H' });
                    }

                    const startRow = anchorRow - i;
                    if (startRow >= 0 && startRow + mot.length <= grille.size) {
                        const isValid = validator.validatePlacementComplete({ word: mot, row: startRow, col: anchorCol, direction: Direction.VERTICAL } as any as any).isValid;
                        if (isValid) placements.push({ mot, position: [startRow, anchorCol], direction: 'V' });
                    }
                }
            }
        }

        return placements;
    }

    private static _getOccupiedCells(grille: Board): [number, number][] {
        const occupied: [number, number][] = [];
        for (let row = 0; row < grille.size; row++) {
            for (let col = 0; col < grille.size; col++) {
                if (grille.getLetter(row, col)) {
                    occupied.push([row, col]);
                }
            }
        }
        return occupied;
    }

    private static _bloqueAncre(placement: Placement, anchor: AnchorPoint, grille: Board): boolean {
        for (let i = 0; i < placement.mot.length; i++) {
            const posRow = placement.direction === 'H' ? placement.position[0] : placement.position[0] + i;
            const posCol = placement.direction === 'H' ? placement.position[1] + i : placement.position[1];

            if (posRow === anchor.row && posCol === anchor.col) {
                if (placement.mot[i] !== anchor.letter) return true;
            }
        }
        return false;
    }

    private static _scoreNaturalitePlacement(placement: Placement, grille: Board): number {
        let score = 0;
        const dirEnum = placement.direction === 'H' ? Direction.HORIZONTAL : Direction.VERTICAL;

        for (let i = 0; i < placement.mot.length; i++) {
            const r = placement.position[0] + (dirEnum === Direction.VERTICAL ? i : 0);
            const c = placement.position[1] + (dirEnum === Direction.HORIZONTAL ? i : 0);

            if (!grille.getLetter(r, c)) {
                const mult = grille.getSquareMultipliers(r, c);
                if (mult.wordMultiplier > 1) score += 20;
                if (mult.letterMultiplier > 1) score += 10;
            }
        }

        if (placement.mot.length <= 4) score += 15;
        else if (placement.mot.length <= 6) score += 10;

        const center = Math.floor(grille.size / 2);
        const distCenter = Math.abs(placement.position[0] - center) + Math.abs(placement.position[1] - center);
        if (distCenter < 3) score -= 5;

        return score;
    }

    private static _appliquerPlacement(grille: Board, placement: Placement): void {
        for (let i = 0; i < placement.mot.length; i++) {
            const r = placement.position[0] + (placement.direction === 'V' ? i : 0);
            const c = placement.position[1] + (placement.direction === 'H' ? i : 0);
            if (!grille.getLetter(r, c)) {
                grille.placeLetter(r, c, placement.mot[i]);
            }
        }
    }

    private static _ancreToujoursAccessible(grille: Board, anchor: AnchorPoint, motLen: number): boolean {
        const row = anchor.row;
        const col = anchor.col;

        let espaceH = 0;
        let c = col;
        while (c >= 0 && (grille.getLetter(row, c) === null || c === col)) {
            espaceH++;
            c--;
        }
        c = col + 1;
        while (c < grille.size && grille.getLetter(row, c) === null) {
            espaceH++;
            c++;
        }

        let espaceV = 0;
        let r = row;
        while (r >= 0 && (grille.getLetter(r, col) === null || r === row)) {
            espaceV++;
            r--;
        }
        r = row + 1;
        while (r < grille.size && grille.getLetter(r, col) === null) {
            espaceV++;
            r++;
        }

        return espaceH >= motLen || espaceV >= motLen;
    }

    static phaseStage(
        grille: Board,
        motCible: string,
        lettreAppui: string,
        tirage: string[],
        gaddag: Gaddag
    ): { grille: Board, success: boolean, solution: Solution | null, message: string } {
        const validator = new WordValidator(gaddag, grille);
        const scoreCalc = new ScoreCalculator(grille);

        const positionsAppui = NaturalFlow._trouverLettreSurGrille(grille, lettreAppui);
        if (positionsAppui.length === 0) return { grille, success: false, solution: null, message: 'Lettre appui non trouvee' };

        for (const pos of positionsAppui) {
            const placementsPossibles = NaturalFlow._genererPlacementsPourMotCible(
                grille, motCible, pos, tirage, gaddag, validator, scoreCalc
            );

            if (placementsPossibles.length > 0) {
                const meilleur = placementsPossibles.reduce((max, obj) => (obj.score || 0) > (max.score || 0) ? obj : max, placementsPossibles[0]);
                const solution: Solution = {
                    mot: motCible,
                    direction: meilleur.direction as any,
                    position: meilleur.position,
                    score: meilleur.score || 0
                };
                return { grille, success: true, solution, message: 'Reussite' };
            }
        }
        return { grille, success: false, solution: null, message: 'Echec' };
    }

    private static _trouverLettreSurGrille(grille: Board, lettre: string): [number, number][] {
        const positions: [number, number][] = [];
        for (let row = 0; row < grille.size; row++) {
            for (let col = 0; col < grille.size; col++) {
                if (grille.getLetter(row, col) === lettre) {
                    positions.push([row, col]);
                }
            }
        }
        return positions;
    }

    private static _genererPlacementsPourMotCible(
        grille: Board,
        motCible: string,
        posAppui: [number, number],
        tirage: string[],
        gaddag: Gaddag,
        validator: WordValidator,
        scoreCalc: ScoreCalculator
    ): Placement[] {
        const placements: Placement[] = [];
        const [row, col] = posAppui;
        const _la = grille.getLetter(row, col);

        if (!lettreAppui) return placements;

        for (let i = 0; i < motCible.length; i++) {
            if (motCible[i] === lettreAppui) {
                const startColH = col - i;
                if (startColH >= 0 && startColH + motCible.length <= grille.size) {
                    if (NaturalFlow._peutJouerAvecTirage(motCible, grille, row, startColH, 'H', tirage)) {
                        const isValid = validator.validatePlacementComplete({ word: motCible, row, col: startColH, direction: Direction.HORIZONTAL } as any as any).isValid;
                        if (isValid) {
                            const score = scoreCalc.calculateMoveScore({ word: motCible, row, col: startColH, direction: Direction.HORIZONTAL } as any, true);
                            placements.push({ mot: motCible, position: [row, startColH], direction: 'H', score });
                        }
                    }
                }

                const startRowV = row - i;
                if (startRowV >= 0 && startRowV + motCible.length <= grille.size) {
                    if (NaturalFlow._peutJouerAvecTirage(motCible, grille, startRowV, col, 'V', tirage)) {
                        const isValid = validator.validatePlacementComplete({ word: motCible, row: startRowV, col, direction: Direction.VERTICAL } as any as any).isValid;
                        if (isValid) {
                            const score = scoreCalc.calculateMoveScore({ word: motCible, row: startRowV, col, direction: Direction.VERTICAL } as any, true);
                            placements.push({ mot: motCible, position: [startRowV, col], direction: 'V', score });
                        }
                    }
                }
            }
        }
        return placements;
    }

    private static _peutJouerAvecTirage(mot: string, grille: Board, row: number, col: number, direction: 'H' | 'V', tirage: string[]): boolean {
        const dispo = [...tirage];
        for (let i = 0; i < mot.length; i++) {
            const r = row + (direction === 'V' ? i : 0);
            const c = col + (direction === 'H' ? i : 0);
            const currentLettre = grille.getLetter(r, c);

            if (currentLettre) {
                if (currentLettre !== mot[i]) return false;
            } else {
                const idx = dispo.indexOf(mot[i]); // Doesn't handle blanks perfectly, but good enough for prototype if blanks aren't complex
                if (idx !== -1) {
                    dispo.splice(idx, 1);
                } else if (dispo.includes('_')) {
                    dispo.splice(dispo.indexOf('_'), 1);
                } else {
                    return false;
                }
            }
        }
        return true;
    }

    static genererSituationNaturelle(
        motCible: string,
        tirage: string[],
        gaddag: Gaddag,
        wordPool: WordPool,
        config: NaturalFlowConfig = { profondeurRespiration: 8, distributionMots: { court: 0.5, moyen: 0.35, long: 0.15 }, maxTentatives: 10 }
    ): SituationEntrainement | null {
        for (let t = 0; t < config.maxTentatives; t++) {
            const grille = new Board();
            const posLettre = Math.floor(Math.random() * motCible.length);
            const _la = motCible[posLettre];

            const anchor = NaturalFlow.phaseAnchor(motCible, lettreAppui, grille);
            const motInitial = NaturalFlow._trouverMotInitialAvecAncre(lettreAppui, wordPool);

            if (motInitial) {
                const posInitValide = validator => gaddag.contains(motInitial); // simplify valid logic for init... we just place it.
                // Just force place it centered over anchor for simplication in JS
                const shift = motInitial.indexOf(lettreAppui);
                NaturalFlow._appliquerPlacement(grille, { mot: motInitial, position: [anchor.row, anchor.col - shift >= 0 ? anchor.col - shift : anchor.col], direction: 'H' });
            } else {
                grille.placeLetter(anchor.row, anchor.col, anchor.letter);
            }

            const { grille: breathedGrille } = NaturalFlow.phaseBreathe(grille, anchor, gaddag, wordPool, motCible, tirage, config.profondeurRespiration);

            const stage = NaturalFlow.phaseStage(breathedGrille, motCible, lettreAppui, tirage, gaddag);
            if (stage.success && stage.solution) {
                return {
                    grille: stage.grille.grid,
                    tirage: tirage,
                    solutions: [stage.solution],
                    meilleurScore: stage.solution.score,
                    metadata: { motCible, naturelScore: 1 }
                };
            }
        }
        return null;
    }

    private static _trouverMotInitialAvecAncre(lettreAppui: string, wordPool: WordPool): string | null {
        const mots = wordPool.getMotsContenantLettre(lettreAppui, 3, 5);
        if (mots.length > 0) return mots[Math.floor(Math.random() * mots.length)];
        return null;
    }
}

