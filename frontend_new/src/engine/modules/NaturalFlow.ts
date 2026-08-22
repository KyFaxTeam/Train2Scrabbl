import { Board } from '../models/Board';
import type { Lexicon } from '../models/Lexicon';
import { Direction } from '../models/Types';
import type {
    NaturalFlowConfig,
    Placement,
    SituationEntrainement,
    Solution,
} from '../models/Situation';
import { MoveChecker } from '../services/MoveChecker';
import { WordValidator } from '../services/WordValidator';
import { WordPool } from '../services/WordPool';

/** Le couloir reserve au mot cible : sept cases vides, et rien qui le prolonge. */
interface Couloir {
    row: number;
    col: number;
    direction: 'H' | 'V';
    /** Cases du couloir + les deux cases qui le prolongeraient, interdites au decor. */
    interdites: Set<string>;
}

const cle = (row: number, col: number) => `${row},${col}`;

/**
 * Construction d'un plateau d'entrainement.
 *
 * Le mot cible doit se poser en SCRABBLE : les sept jetons du chevalet sur sept
 * cases vides, prime de 50 comprise. C'est ce que promettent le nom du mode et
 * son lien avec l'Arene, qui enseigne des tirages et leurs scrabbles.
 *
 * L'ancienne construction ne le permettait pas. Elle tirait une lettre du mot
 * cible, la plantait sur le plateau, et ne verifiait ensuite qu'une chose : que
 * le mot reste posable EN PASSANT PAR cette case. Le chevauchement etait donc
 * garanti par construction. Mesure sur 200 exercices de l'ancien generateur :
 *
 *   26 %   des exercices n'admettaient AUCUN placement a sept jetons : vider le
 *          chevalet y etait impossible, l'exercice ne pouvait pas etre reussi ;
 *   26 %   annoncaient une solution qui laissait un jeton au chevalet et
 *          perdait la prime - 23 points en moyenne, contre 84 pour un scrabble ;
 *   100 %  offraient au moins un placement a six jetons ou moins, que l'ancienne
 *          validation acceptait comme une reussite.
 *
 * (Un commentaire precedent avancait 85 % : le chiffre ne se reproduit pas,
 * c'est 26 % sur 200 exercices, banc `bench` sur le chemin de code du worker.)
 *
 * On procede maintenant a l'envers :
 *
 *   COULOIR      on reserve les sept cases ou le mot se posera, plus les deux
 *                cases qui le prolongeraient ;
 *   ACCROCHE     on plante un mot de decor perpendiculaire, colle au couloir,
 *                choisi pour que la soudure soit un mot (mesure : aucun des
 *                300 mots de sept lettres testes n'est sans accroche possible,
 *                mediane 22 911 candidates) ;
 *   RESPIRATION  on meuble le reste du plateau, le couloir restant interdit.
 *
 * Tout se joue sur DEUX plateaux menes de front : celui que verra le joueur, et
 * le meme avec le mot cible en place. Chaque mot de decor doit etre valide sur
 * les deux.
 *
 * Ce n'est pas une precaution theorique. En ne validant que le plateau AVEC le
 * mot cible, on obtenait ceci : trois mots verticaux formaient incidemment
 * P-O-R-E sur une ligne, le E etant une lettre du mot cible ; PORE est un mot,
 * le decor passait. Le mot cible retire, la ligne se lisait POR - un plateau
 * livre au joueur avec un mot qui n'existe pas. Mesure : 2 plateaux sur 60.
 *
 * Valider les deux plateaux ferme les deux cotes : le plateau livre ne contient
 * que des mots, et le coup du joueur n'en formera que des mots.
 */
export class NaturalFlow {
    // ------------------------------------------------------------------
    // Couloir
    // ------------------------------------------------------------------

    private static _choisirCouloir(longueur: number, taille: number): Couloir {
        const direction: 'H' | 'V' = Math.random() < 0.5 ? 'H' : 'V';
        const vertical = direction === 'V';

        // Le couloir reste dans la zone centrale : un scrabble colle au bord
        // n'a presque aucune facon de s'accrocher.
        const debut = 2 + Math.floor(Math.random() * (taille - longueur - 3));
        const fixe = 3 + Math.floor(Math.random() * (taille - 6));

        const row = vertical ? debut : fixe;
        const col = vertical ? fixe : debut;

        const interdites = new Set<string>();
        for (let i = -1; i <= longueur; i++) {
            const r = row + (vertical ? i : 0);
            const c = col + (vertical ? 0 : i);
            if (r >= 0 && r < taille && c >= 0 && c < taille) interdites.add(cle(r, c));
        }

        return { row, col, direction, interdites };
    }

    /**
     * Plante le mot de decor qui servira d'accroche : perpendiculaire au
     * couloir, colle a l'une de ses lettres, et tel que la soudure soit un mot.
     *
     * Exemple : le couloir porte un E en (7,9) ; on pose CHAT au-dessus, dans la
     * colonne 9, de sorte que la colonne se lise CHAT + E = CHATE... ou plutot
     * un mot qui existe - c'est le lexique qui tranche, pas nous.
     */
    private static _poserAccroche(
        grille: Board,
        avecCible: Board,
        lexicon: Lexicon,
        wordPool: WordPool,
        couloir: Couloir,
        motCible: string
    ): string | null {
        const vertical = couloir.direction === 'V';
        const taille = grille.size;
        const candidats = wordPool.getMotsCourts(60).concat(wordPool.getMotsMoyens(40));

        const positions = Array.from({ length: motCible.length }, (_, i) => i);
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        for (const mot of candidats) {
            for (const i of positions) {
                const hookRow = couloir.row + (vertical ? i : 0);
                const hookCol = couloir.col + (vertical ? 0 : i);
                const lettre = motCible[i];

                for (const avant of [true, false]) {
                    // `avant` : le decor precede la lettre du couloir, la soudure
                    // se lit `mot + lettre`. Sinon elle se lit `lettre + mot`.
                    const soudure = avant ? mot + lettre : lettre + mot;
                    if (!lexicon.has(soudure)) continue;

                    // Le decor s'etend perpendiculairement au couloir.
                    const pas = avant ? -1 : 1;
                    const debutRow = vertical ? hookRow : hookRow + pas * (avant ? mot.length : 1);
                    const debutCol = vertical ? hookCol + pas * (avant ? mot.length : 1) : hookCol;

                    const finRow = vertical ? debutRow : debutRow + mot.length - 1;
                    const finCol = vertical ? debutCol + mot.length - 1 : debutCol;
                    if (debutRow < 0 || debutCol < 0 || finRow >= taille || finCol >= taille) continue;

                    // La case qui prolongerait la soudure doit rester libre de
                    // bord : sinon le mot de decor deborderait du plateau.
                    const placement: Placement = {
                        mot,
                        position: [debutRow, debutCol],
                        direction: vertical ? 'H' : 'V',
                    };

                    let libre = true;
                    for (let k = 0; k < mot.length; k++) {
                        const r = debutRow + (vertical ? 0 : k);
                        const c = debutCol + (vertical ? k : 0);
                        if (couloir.interdites.has(cle(r, c)) || grille.getLetter(r, c) !== null) {
                            libre = false;
                            break;
                        }
                    }
                    if (!libre) continue;

                    NaturalFlow._appliquerPlacement(grille, placement);
                    NaturalFlow._appliquerPlacement(avecCible, placement);
                    return mot;
                }
            }
        }

        return null;
    }

    // ------------------------------------------------------------------
    // Respiration
    // ------------------------------------------------------------------

    static phaseBreathe(
        grille: Board,
        avecCible: Board,
        lexicon: Lexicon,
        wordPool: WordPool,
        interdites: Set<string>,
        profondeur: number = 8
    ): string[] {
        const motsPlaces: string[] = [];

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

            const placement = NaturalFlow._trouverPlacementNaturel(
                grille,
                new WordValidator(lexicon, grille),
                new WordValidator(lexicon, avecCible),
                candidats,
                interdites
            );
            if (!placement) continue;

            NaturalFlow._appliquerPlacement(grille, placement);
            NaturalFlow._appliquerPlacement(avecCible, placement);
            motsPlaces.push(placement.mot);
        }

        return motsPlaces;
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
        validatorAvecCible: WordValidator,
        candidats: string[],
        interdites: Set<string>
    ): Placement | null {
        const placementsValides: { placement: Placement; score: number }[] = [];

        for (const mot of candidats) {
            for (const placement of NaturalFlow._genererPlacementsPourMot(mot, grille, validator, validatorAvecCible, interdites)) {
                placementsValides.push({ placement, score: NaturalFlow._scoreNaturalitePlacement(placement, grille) });
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
        validator: WordValidator,
        validatorAvecCible: WordValidator,
        interdites: Set<string>
    ): Placement[] {
        const placements: Placement[] = [];
        const casesOccupees = NaturalFlow._getOccupiedCells(grille);

        const retenir = (row: number, col: number, direction: 'H' | 'V') => {
            const vertical = direction === 'V';

            // Le couloir du mot cible est intouchable : une seule lettre de
            // decor dedans, et le scrabble ne se pose plus.
            for (let k = 0; k < mot.length; k++) {
                const r = row + (vertical ? k : 0);
                const c = col + (vertical ? 0 : k);
                if (interdites.has(cle(r, c))) return;
            }

            const coup = {
                word: mot,
                row,
                col,
                direction: vertical ? Direction.VERTICAL : Direction.HORIZONTAL,
                score: 0,
            };

            // Le placement n'est retenu que si le mot forme est EXACTEMENT `mot`
            // - un placement qui le prolonge en autre chose ecrit sur le plateau
            // un mot que personne n'a choisi - ET si c'est vrai sur les deux
            // plateaux : celui que verra le joueur, et le meme avec le mot cible
            // en place. Voir l'exemple POR/PORE en tete de fichier.
            const check = validator.validatePlacementComplete(coup, true);
            if (!check.isValid || check.mainWord !== mot) return;

            const checkAvecCible = validatorAvecCible.validatePlacementComplete(coup, true);
            if (!checkAvecCible.isValid || checkAvecCible.mainWord !== mot) return;

            placements.push({ mot, position: [row, col], direction });
        };

        for (const [ancreRow, ancreCol] of casesOccupees) {
            if (interdites.has(cle(ancreRow, ancreCol))) continue; // pas d'appui sur le mot cible
            const lettreAncre = grille.getLetter(ancreRow, ancreCol);

            for (let i = 0; i < mot.length; i++) {
                if (mot[i] !== lettreAncre) continue;

                const startCol = ancreCol - i;
                if (startCol >= 0 && startCol + mot.length <= grille.size) retenir(ancreRow, startCol, 'H');

                const startRow = ancreRow - i;
                if (startRow >= 0 && startRow + mot.length <= grille.size) retenir(startRow, ancreCol, 'V');
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

    // ------------------------------------------------------------------
    // Assemblage
    // ------------------------------------------------------------------

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
        if (motCible.length < 2) return null;

        for (let tentative = 1; tentative <= config.maxTentatives; tentative++) {
            // Deux plateaux menes de front : `grille` est celui que verra le
            // joueur, `avecCible` porte en plus le mot a trouver. Chaque mot de
            // decor doit etre valide sur les deux.
            const grille = new Board();
            const avecCible = new Board();
            const couloir = NaturalFlow._choisirCouloir(motCible.length, grille.size);

            NaturalFlow._appliquerPlacement(avecCible, {
                mot: motCible,
                position: [couloir.row, couloir.col],
                direction: couloir.direction,
            });

            const accroche = NaturalFlow._poserAccroche(grille, avecCible, lexicon, wordPool, couloir, motCible);
            if (!accroche) continue;

            NaturalFlow.phaseBreathe(
                grille, avecCible, lexicon, wordPool, couloir.interdites, config.profondeurRespiration
            );

            const jetons = NaturalFlow._getOccupiedCells(grille).length;
            if (jetons < jetonsMinimum) continue;

            // Seuls les collages qui posent TOUT le chevalet comptent : c'est la
            // definition d'un scrabble, et la prime de 50 en depend.
            const checker = MoveChecker.fromGrid(lexicon, grille.grid);
            const collages = checker
                .findPlacements(motCible, tirage)
                .filter(p => p.tilesUsed === tirage.length);

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
                    difficulte: collages.length <= 1 ? 'difficile' : collages.length <= 3 ? 'moyen' : 'facile',
                    tentatives: tentative,
                },
            };
        }

        return null;
    }
}
