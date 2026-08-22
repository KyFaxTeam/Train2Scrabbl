import { Board } from '../models/Board';
import type { Lexicon } from '../models/Lexicon';
import { Direction } from '../models/Types';
import type {
    AnchorPoint,
    NaturalFlowConfig,
    Placement,
    SituationEntrainement,
    Solution,
} from '../models/Situation';
import { MoveChecker } from '../services/MoveChecker';
import { ScoreCalculator } from '../services/ScoreCalculator';
import { WordValidator } from '../services/WordValidator';
import { WordPool } from '../services/WordPool';

/**
 * Construction d'un plateau d'entrainement en trois temps :
 *
 *   ANCRE       on choisit une lettre du mot cible et une case ou elle tiendra,
 *               avec assez de place autour pour que le mot cible y rentre ;
 *   RESPIRATION on meuble le plateau de mots de decor, en verifiant apres
 *               chaque pose que le mot cible reste jouable ;
 *   COLLAGE     on enumere tous les placements legaux du mot cible et on garde
 *               le meilleur comme reference.
 *
 * Le fichier ne porte plus `@ts-nocheck` : il etait passe a travers le build
 * sans le moindre controle, ce qui a deja laisse passer une variable supprimee
 * mais encore lue.
 */
export class NaturalFlow {
    static phaseAnchor(motCible: string, lettreAppui: string, grille: Board): AnchorPoint {
        const positionsCandidates: { row: number; col: number; score: number }[] = [];

        for (let row = 0; row < grille.size; row++) {
            for (let col = 0; col < grille.size; col++) {
                const score = NaturalFlow._evaluerPositionAppui(grille, row, col, motCible);
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

    private static _evaluerPositionAppui(grille: Board, row: number, col: number, motCible: string): number {
        let score = 0;
        const motLen = motCible.length;

        const espaceH = grille.size;
        const espaceV = grille.size;
        if (espaceH < motLen && espaceV < motLen) return 0;

        score += Math.max(espaceH, espaceV) * 2;
        score += NaturalFlow._compterMultiplicateursAccessibles(grille, row, col, motLen) * 15;

        const center = Math.floor(grille.size / 2);
        score -= (Math.abs(row - center) + Math.abs(col - center)) * 0.5;

        if (row >= 3 && row <= 11 && col >= 3 && col <= 11) score += 10;

        const mult = grille.getSquareMultipliers(row, col);
        if (mult.wordMultiplier > 1) score += 20;
        if (mult.letterMultiplier > 1) score += 10;

        return score;
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
        lexicon: Lexicon,
        wordPool: WordPool,
        motCible: string,
        tirage: string[],
        profondeur: number = 8
    ): { grille: Board; motsPlaces: string[] } {
        const motsPlaces: string[] = [];
        const scoreCalc = new ScoreCalculator(grille);

        const distribution = [
            { category: 'court', proba: 0.50 },
            { category: 'moyen', proba: 0.35 },
            { category: 'long', proba: 0.15 },
        ];

        for (let coup = 0; coup < profondeur; coup++) {
            const categorie = NaturalFlow._choisirCategorie(distribution);
            let candidats: string[];

            // Ces tailles sont celles que l'ancienne version obtenait au final :
            // elle tirait 100/80/50 mots puis en re-echantillonnait 50 au plus.
            if (categorie === 'court') candidats = wordPool.getMotsCourts(50);
            else if (categorie === 'moyen') candidats = wordPool.getMotsMoyens(40);
            else candidats = wordPool.getMotsLongs(25);

            if (candidats.length === 0) continue;

            const validator = new WordValidator(lexicon, grille);
            const placement = NaturalFlow._trouverPlacementNaturel(grille, validator, candidats, anchor);
            if (!placement) continue;

            const grilleBackup = grille.grid.map(row => [...row]);
            NaturalFlow._appliquerPlacement(grille, placement);

            if (!NaturalFlow._ancreToujoursAccessible(grille, anchor, motCible.length)) {
                grille.grid = grilleBackup;
                continue;
            }

            // Apres chaque mot de decor, le mot cible doit rester jouable :
            // sans cette verification on fabrique des plateaux insolubles.
            const validatorNew = new WordValidator(lexicon, grille);
            const placementsCible = NaturalFlow._genererPlacementsPourMotCible(
                grille, motCible, [anchor.row, anchor.col], tirage, validatorNew, scoreCalc
            );

            if (placementsCible.length === 0) {
                grille.grid = grilleBackup;
                continue;
            }

            motsPlaces.push(placement.mot);
        }

        return { grille, motsPlaces };
    }

    private static _choisirCategorie(distribution: { category: string; proba: number }[]): string {
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
        validator: WordValidator,
        candidats: string[],
        anchor: AnchorPoint
    ): Placement | null {
        const placementsValides: { placement: Placement; score: number }[] = [];

        for (const mot of candidats) {
            const placements = NaturalFlow._genererPlacementsPourMot(mot, grille, validator);
            for (const placement of placements) {
                if (NaturalFlow._bloqueAncre(placement, anchor)) continue;
                placementsValides.push({ placement, score: NaturalFlow._scoreNaturalitePlacement(placement, grille) });
            }
        }

        if (placementsValides.length === 0) return null;

        placementsValides.sort((a, b) => b.score - a.score);
        const topK = placementsValides.slice(0, 5);
        return topK[Math.floor(Math.random() * topK.length)].placement;
    }

    private static _genererPlacementsPourMot(mot: string, grille: Board, validator: WordValidator): Placement[] {
        const placements: Placement[] = [];
        const casesOccupees = NaturalFlow._getOccupiedCells(grille);

        // Le placement n'est retenu que si le mot forme est EXACTEMENT `mot` :
        // un placement qui le prolonge en autre chose ecrit sur le plateau un
        // mot que personne n'a choisi.
        const retenir = (row: number, col: number, direction: 'H' | 'V') => {
            const dirEnum = direction === 'H' ? Direction.HORIZONTAL : Direction.VERTICAL;
            const check = validator.validatePlacementComplete(
                { word: mot, row, col, direction: dirEnum, score: 0 },
                casesOccupees.length > 0
            );
            if (check.isValid && check.mainWord === mot) {
                placements.push({ mot, position: [row, col], direction });
            }
        };

        if (casesOccupees.length === 0) {
            const center = Math.floor(grille.size / 2);
            const start = center - Math.floor(mot.length / 2);
            if (start >= 0 && start + mot.length <= grille.size) {
                retenir(center, start, 'H');
                retenir(start, center, 'V');
            }
            return placements;
        }

        for (const [anchorRow, anchorCol] of casesOccupees) {
            const lettreAncre = grille.getLetter(anchorRow, anchorCol);

            for (let i = 0; i < mot.length; i++) {
                if (mot[i] !== lettreAncre) continue;

                const startCol = anchorCol - i;
                if (startCol >= 0 && startCol + mot.length <= grille.size) retenir(anchorRow, startCol, 'H');

                const startRow = anchorRow - i;
                if (startRow >= 0 && startRow + mot.length <= grille.size) retenir(startRow, anchorCol, 'V');
            }
        }

        return placements;
    }

    private static _getOccupiedCells(grille: Board): [number, number][] {
        const occupied: [number, number][] = [];
        for (let row = 0; row < grille.size; row++) {
            for (let col = 0; col < grille.size; col++) {
                if (grille.getLetter(row, col)) occupied.push([row, col]);
            }
        }
        return occupied;
    }

    private static _bloqueAncre(placement: Placement, anchor: AnchorPoint): boolean {
        for (let i = 0; i < placement.mot.length; i++) {
            const posRow = placement.direction === 'H' ? placement.position[0] : placement.position[0] + i;
            const posCol = placement.direction === 'H' ? placement.position[1] + i : placement.position[1];

            if (posRow === anchor.row && posCol === anchor.col && placement.mot[i] !== anchor.letter) {
                return true;
            }
        }
        return false;
    }

    private static _scoreNaturalitePlacement(placement: Placement, grille: Board): number {
        let score = 0;
        const vertical = placement.direction === 'V';

        for (let i = 0; i < placement.mot.length; i++) {
            const r = placement.position[0] + (vertical ? i : 0);
            const c = placement.position[1] + (vertical ? 0 : i);

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
            if (!grille.getLetter(r, c)) grille.placeLetter(r, c, placement.mot[i]);
        }
    }

    private static _ancreToujoursAccessible(grille: Board, anchor: AnchorPoint, motLen: number): boolean {
        const { row, col } = anchor;

        let espaceH = 0;
        for (let c = col; c >= 0 && (grille.getLetter(row, c) === null || c === col); c--) espaceH++;
        for (let c = col + 1; c < grille.size && grille.getLetter(row, c) === null; c++) espaceH++;

        let espaceV = 0;
        for (let r = row; r >= 0 && (grille.getLetter(r, col) === null || r === row); r--) espaceV++;
        for (let r = row + 1; r < grille.size && grille.getLetter(r, col) === null; r++) espaceV++;

        return espaceH >= motLen || espaceV >= motLen;
    }

    private static _genererPlacementsPourMotCible(
        grille: Board,
        motCible: string,
        posAppui: [number, number],
        tirage: string[],
        validator: WordValidator,
        scoreCalc: ScoreCalculator
    ): Placement[] {
        const placements: Placement[] = [];
        const [row, col] = posAppui;
        const lettreAppui = grille.getLetter(row, col);

        if (!lettreAppui) return placements;

        for (let i = 0; i < motCible.length; i++) {
            if (motCible[i] !== lettreAppui) continue;

            const startColH = col - i;
            if (startColH >= 0 && startColH + motCible.length <= grille.size
                && NaturalFlow._peutJouerAvecTirage(motCible, grille, row, startColH, 'H', tirage)) {
                const check = validator.validatePlacementComplete(
                    { word: motCible, row, col: startColH, direction: Direction.HORIZONTAL, score: 0 }
                );
                if (check.isValid && check.mainWord === motCible) {
                    const score = scoreCalc.simulateMoveScore(
                        { word: motCible, row, col: startColH, direction: Direction.HORIZONTAL, score: 0 }
                    );
                    placements.push({ mot: motCible, position: [row, startColH], direction: 'H', score });
                }
            }

            const startRowV = row - i;
            if (startRowV >= 0 && startRowV + motCible.length <= grille.size
                && NaturalFlow._peutJouerAvecTirage(motCible, grille, startRowV, col, 'V', tirage)) {
                const check = validator.validatePlacementComplete(
                    { word: motCible, row: startRowV, col, direction: Direction.VERTICAL, score: 0 }
                );
                if (check.isValid && check.mainWord === motCible) {
                    const score = scoreCalc.simulateMoveScore(
                        { word: motCible, row: startRowV, col, direction: Direction.VERTICAL, score: 0 }
                    );
                    placements.push({ mot: motCible, position: [startRowV, col], direction: 'V', score });
                }
            }
        }

        return placements;
    }

    private static _peutJouerAvecTirage(
        mot: string,
        grille: Board,
        row: number,
        col: number,
        direction: 'H' | 'V',
        tirage: string[]
    ): boolean {
        const dispo = [...tirage];
        for (let i = 0; i < mot.length; i++) {
            const r = row + (direction === 'V' ? i : 0);
            const c = col + (direction === 'H' ? i : 0);
            const currentLettre = grille.getLetter(r, c);

            if (currentLettre) {
                if (currentLettre !== mot[i]) return false;
            } else {
                const idx = dispo.indexOf(mot[i]);
                if (idx !== -1) dispo.splice(idx, 1);
                else if (dispo.includes('_')) dispo.splice(dispo.indexOf('_'), 1);
                else return false;
            }
        }
        return true;
    }

    /** Les mots de deux lettres ou plus reellement lisibles sur le plateau. */
    static motsLisibles(grid: (string | null)[][]): string[] {
        const mots: string[] = [];
        const size = grid.length;

        for (let i = 0; i < size; i++) {
            let ligne = '';
            let colonne = '';
            for (let j = 0; j < size; j++) {
                ligne += grid[i][j] ?? ' ';
                colonne += grid[j][i] ?? ' ';
            }
            for (const segment of [...ligne.split(' '), ...colonne.split(' ')]) {
                if (segment.length >= 2) mots.push(segment);
            }
        }

        return mots;
    }

    static genererSituationNaturelle(
        motCible: string,
        tirage: string[],
        lexicon: Lexicon,
        wordPool: WordPool,
        config: NaturalFlowConfig = {
            profondeurRespiration: 8,
            distributionMots: { court: 0.5, moyen: 0.35, long: 0.15 },
            maxTentatives: 10,
        }
    ): SituationEntrainement | null {
        const jetonsMinimum = config.jetonsMinimum ?? 12;

        for (let tentative = 1; tentative <= config.maxTentatives; tentative++) {
            const grille = new Board();
            const lettreAppui = motCible[Math.floor(Math.random() * motCible.length)];
            const anchor = NaturalFlow.phaseAnchor(motCible, lettreAppui, grille);

            NaturalFlow._poserMotInitial(grille, anchor, wordPool);

            NaturalFlow.phaseBreathe(
                grille, anchor, lexicon, wordPool, motCible, tirage, config.profondeurRespiration
            );

            const jetons = NaturalFlow._getOccupiedCells(grille).length;
            if (jetons < jetonsMinimum) continue;

            // Enumeration exhaustive : la solution de reference est le MEILLEUR
            // collage possible, pas le premier trouve autour de l'appui.
            const checker = MoveChecker.fromGrid(lexicon, grille.grid);
            const collages = checker.findPlacements(motCible, tirage);
            if (collages.length === 0) continue;

            const solutions: Solution[] = collages.map(c => ({
                mot: motCible,
                position: [c.row, c.col],
                direction: c.direction,
                score: c.score,
            }));

            return {
                grille: grille.grid,
                tirage,
                solutions,
                meilleurScore: solutions[0].score,
                metadata: {
                    motCible,
                    jetonsPlateau: jetons,
                    motsPlateau: NaturalFlow.motsLisibles(grille.grid),
                    collagesLegaux: collages.length,
                    // Distribution mesuree sur 40 plateaux, apres correction du
                    // validateur : min 1, mediane 3, max 9 collages legaux.
                    // (Avant correction on en comptait 11 en mediane, mais la
                    // plupart formaient des mots inexistants.)
                    difficulte: collages.length <= 1 ? 'difficile' : collages.length <= 4 ? 'moyen' : 'facile',
                    tentatives: tentative,
                },
            };
        }

        return null;
    }

    /**
     * Premier mot du plateau, pose autour de l'ancre.
     *
     * L'ancienne version calculait `anchor.col - shift >= 0 ? anchor.col - shift
     * : anchor.col` : quand le mot debordait a gauche, la lettre d'appui ne
     * tombait plus sur l'ancre, et quand il debordait a droite `placeLetter`
     * levait "Position invalide" - une exception remontee au worker comme un
     * echec de generation. On borne la position, et a defaut on pose la seule
     * lettre d'appui.
     */
    private static _poserMotInitial(grille: Board, anchor: AnchorPoint, wordPool: WordPool): void {
        const candidats = wordPool.getMotsContenantLettre(anchor.letter, 3, 5);

        if (candidats.length > 0) {
            const mot = candidats[Math.floor(Math.random() * candidats.length)];
            const shift = mot.indexOf(anchor.letter);
            const startCol = anchor.col - shift;

            if (startCol >= 0 && startCol + mot.length <= grille.size) {
                NaturalFlow._appliquerPlacement(grille, { mot, position: [anchor.row, startCol], direction: 'H' });
                return;
            }
        }

        grille.placeLetter(anchor.row, anchor.col, anchor.letter);
    }
}
