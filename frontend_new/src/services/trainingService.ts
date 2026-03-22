// @ts-nocheck

import { API_ENDPOINTS, apiFetch } from '../config/api';
import { getDueForReview } from './learningStore';
import { getDictionary } from './dictionaryService';
import { EngineWorkerClient } from '../engine/WorkerClient';

export interface Puzzle {
    id: string;
    rack: string[];
    boardConfig: {
        rows: number;
        cols: number;
        initialTiles: { row: number; col: number; char: string }[];
    };
    solution: {
        word: string;
        row: number;
        col: number;
        direction: 'H' | 'V';
        score?: number;
    };
    metadata?: {
        naturalityScore: number;
        wordsOnBoard: string[];
        difficulty: 'easy' | 'medium' | 'hard';
    };
}





interface HealthResponse {
    status: string;
    dictionarySize: number;
    gaddagReady: boolean;
}

export const checkHealth = async (): Promise<HealthResponse> => {
    return apiFetch<HealthResponse>(API_ENDPOINTS.health);
};

const generateOfflineBatch = async (size: number): Promise<Puzzle[]> => {
    const puzzles: Puzzle[] = [];
    const targetWords: { word: string, draw: string, difficulty: 'easy' | 'medium' | 'hard' }[] = [];

    try {
        const dueMasteries = await getDueForReview();
        const shuffledDue = [...dueMasteries].sort(() => Math.random() - 0.5);
        for (const m of shuffledDue) {
            if (targetWords.length >= size) break;
            targetWords.push({
                word: m.word,
                draw: m.drawId || m.word.substring(0, 7),
                difficulty: m.difficulty > 0.6 ? 'hard' : m.difficulty > 0.3 ? 'medium' : 'easy'
            });
        }
    } catch (e) {
        console.warn('Failed to get due for review', e);
    }

    if (targetWords.length < size) {
        try {
            const dict = await getDictionary();
            let attempts = 0;
            while (targetWords.length < size && attempts < 100) {
                attempts++;
                const randomCatIndex = Math.floor(Math.random() * dict.length);
                const cat = dict[randomCatIndex];
                if (!cat?.entries?.length) continue;

                const randomEntryIndex = Math.floor(Math.random() * cat.entries.length);
                const entry = cat.entries[randomEntryIndex];
                if (!entry.solutions?.length) continue;

                const randomSolIndex = Math.floor(Math.random() * entry.solutions.length);
                const rWord = entry.solutions[randomSolIndex];
                targetWords.push({
                    word: rWord,
                    draw: entry.draw,
                    difficulty: 'medium'
                });
            }
        } catch (e) {
            console.warn('Failed to get dict for offline batch', e);
        }
    }

    const worker = EngineWorkerClient.getInstance();
    await worker.initialize();

    for (let i = 0; i < targetWords.length; i++) {
        const t = targetWords[i];
        let rack = t.draw.split('');

        try {
            const { result } = await worker.generateNaturalFlow(t.word, rack, 8);
            if (result) {
                const initialTiles = [];
                for (let r = 0; r < result.grille.length; r++) {
                    for (let c = 0; c < result.grille[r].length; c++) {
                        if (result.grille[r][c] !== null) {
                            initialTiles.push({ row: r, col: c, char: result.grille[r][c] as string });
                        }
                    }
                }

                const bestSolution = result.solutions[0];

                puzzles.push({
                    id: `offline-${Date.now()}-${i}`,
                    rack: result.tirage,
                    boardConfig: {
                        rows: 15,
                        cols: 15,
                        initialTiles
                    },
                    solution: {
                        word: bestSolution.mot,
                        row: bestSolution.position[0],
                        col: bestSolution.position[1],
                        direction: bestSolution.direction,
                        score: bestSolution.score
                    },
                    metadata: {
                        naturalityScore: result.metadata.naturelScore || 1,
                        wordsOnBoard: [t.word],
                        difficulty: t.difficulty
                    }
                });
            }
        } catch (err) {
            console.error('Failed to generate natural flow for word', t.word, err);
        }
    }

    return puzzles;
};

export const generateBatch = async (size: number = 5): Promise<Puzzle[]> => {
    return generateOfflineBatch(size);
};

export const generateForWord = async (word: string, tirage?: string[]): Promise<Puzzle> => {
    const worker = EngineWorkerClient.getInstance();
    await worker.initialize();

    const rack = tirage || word.split('').sort(() => Math.random() - 0.5);
    const { result } = await worker.generateNaturalFlow(word, rack, 8);
    if (!result) throw new Error('Worker failed to generate puzzle');

    const initialTiles = [];
    for (let r = 0; r < result.grille.length; r++) {
        for (let c = 0; c < result.grille[r].length; c++) {
            if (result.grille[r][c] !== null) {
                initialTiles.push({ row: r, col: c, char: result.grille[r][c] as string });
            }
        }
    }

    return {
        id: `offline-${Date.now()}`,
        rack: result.tirage,
        boardConfig: {
            rows: 15,
            cols: 15,
            initialTiles
        },
        solution: {
            word: result.solutions[0].mot,
            row: result.solutions[0].position[0],
            col: result.solutions[0].position[1],
            direction: result.solutions[0].direction,
            score: result.solutions[0].score
        },
        metadata: {
            naturalityScore: 1,
            wordsOnBoard: [word],
            difficulty: 'medium'
        }
    };
};

export const getRandomPuzzle = async (): Promise<Puzzle> => {
    const batch = await generateBatch(1);
    if (!batch.length) throw new Error('No puzzles generated');
    return batch[0];
};


