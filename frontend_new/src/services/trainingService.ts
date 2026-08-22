import { getDueForReview } from './learningStore';
import { EngineWorkerClient } from '../engine/WorkerClient';

export interface PuzzleSolution {
    word: string;
    row: number;
    col: number;
    direction: 'H' | 'V';
    score: number;
}

export interface Puzzle {
    id: string;
    rack: string[];
    boardConfig: {
        rows: number;
        cols: number;
        initialTiles: { row: number; col: number; char: string }[];
    };
    /** Le MEILLEUR collage du mot attendu, reference pour le debriefing. */
    solution: PuzzleSolution;
    metadata: {
        /**
         * `naturalityScore` a disparu : il valait 1 en dur. Ce qui suit est
         * mesure sur le plateau reellement produit.
         */
        wordsOnBoard: string[];
        tilesOnBoard: number;
        /** Nombre de collages legaux du mot : l'exercice n'a pas une reponse, il en a plusieurs. */
        legalPlacements: number;
        difficulty: 'facile' | 'moyen' | 'difficile';
        generationMs: number;
    };
}

interface TargetWord {
    word: string;
    draw: string;
}

/**
 * Les mots a faire travailler : d'abord ceux que la repetition espacee reclame,
 * puis des scrabbles tires dans le lexique du moteur.
 *
 * La page ne lit plus `scrabble_dict.txt` (2,68 Mo bruts, 757 Ko gzip) : cet
 * index de tirages contient exactement 32 230 solutions de sept lettres, soit
 * exactement les 32 230 mots de sept lettres de l'ODS8 - et le tirage d'un mot
 * n'est rien d'autre que ses lettres triees. Le fichier ne disait rien que le
 * lexique ne sache deja, et c'etait desormais le plus gros telechargement du
 * mode.
 */
const choisirMots = async (size: number, worker: EngineWorkerClient): Promise<TargetWord[]> => {
    const cibles: TargetWord[] = [];

    try {
        const dues = await getDueForReview();
        for (let i = dues.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [dues[i], dues[j]] = [dues[j], dues[i]];
        }
        for (const m of dues) {
            if (cibles.length >= size) break;
            // Les fiches d'avant la correction de la cle de repetition espacee
            // ont un `word` vide : la cle etait decoupee en trois champs alors
            // que l'entrainement n'en ecrivait que deux. Les servir revient a
            // demander au moteur de construire un exercice pour la chaine vide,
            // qui echoue quinze fois puis disparait sans un mot.
            if (!m.word || m.word.length < 2) continue;
            cibles.push({ word: m.word, draw: m.drawId || m.word });
        }
    } catch (e) {
        console.warn('Revisions indisponibles, on tire dans le dictionnaire', e);
    }

    if (cibles.length < size) {
        const mots = await worker.randomTargets(size - cibles.length, 7);
        for (const word of mots) {
            cibles.push({ word, draw: [...word].sort().join('') });
        }
    }

    if (cibles.length === 0) {
        throw new Error("Aucun mot a travailler : le lexique n a pas pu etre lu.");
    }

    return cibles;
};

/**
 * Genere le lot d'exercices.
 *
 * `onPuzzle` est appele des qu'un exercice est pret : la page affiche le
 * premier pendant que les suivants se calculent. La version precedente
 * generait les cinq en serie avant d'afficher quoi que ce soit, soit cinq fois
 * le temps de generation avant le premier pixel utile.
 */
export const generateBatch = async (
    size: number = 5,
    onPuzzle?: (puzzle: Puzzle, index: number) => void
): Promise<Puzzle[]> => {
    const worker = EngineWorkerClient.getInstance();
    await worker.initialize();
    const cibles = await choisirMots(size, worker);

    const puzzles: Puzzle[] = [];
    const echecs: string[] = [];

    for (const cible of cibles) {
        try {
            const { result, timeMs } = await worker.generateNaturalFlow(cible.word, cible.draw.split(''), 8);
            if (!result) {
                echecs.push(cible.word);
                continue;
            }

            const initialTiles: { row: number; col: number; char: string }[] = [];
            for (let r = 0; r < result.grille.length; r++) {
                for (let c = 0; c < result.grille[r].length; c++) {
                    const char = result.grille[r][c];
                    if (char !== null) initialTiles.push({ row: r, col: c, char });
                }
            }

            const best = result.solutions[0];
            const puzzle: Puzzle = {
                id: `${cible.draw}-${cible.word}-${Date.now()}-${puzzles.length}`,
                rack: result.tirage,
                boardConfig: { rows: 15, cols: 15, initialTiles },
                solution: {
                    word: best.mot,
                    row: best.position[0],
                    col: best.position[1],
                    direction: best.direction,
                    score: best.score,
                },
                metadata: {
                    wordsOnBoard: result.metadata.motsPlateau,
                    tilesOnBoard: result.metadata.jetonsPlateau,
                    legalPlacements: result.metadata.collagesLegaux,
                    difficulty: result.metadata.difficulte,
                    generationMs: Math.round(timeMs),
                },
            };

            onPuzzle?.(puzzle, puzzles.length);
            puzzles.push(puzzle);
        } catch (err) {
            console.error('Generation impossible pour', cible.word, err);
            echecs.push(cible.word);
        }
    }

    // Un lot vide n'est pas une reussite : c'est ce silence qui laissait la page
    // sur "Chargement..." indefiniment, sans erreur ni recours.
    if (puzzles.length === 0) {
        throw new Error(
            `Aucun exercice n a pu etre construit (${echecs.length} tentative(s) : ${echecs.slice(0, 3).join(', ')}).`
        );
    }

    return puzzles;
};
