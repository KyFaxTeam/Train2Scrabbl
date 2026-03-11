import { API_ENDPOINTS, apiFetch } from '../config/api';

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

interface BatchResponse {
    puzzles: Puzzle[];
    generationTimeMs: number;
    count: number;
}

interface PuzzleResponse {
    puzzle: Puzzle;
    generationTimeMs: number;
}

interface HealthResponse {
    status: string;
    dictionarySize: number;
    gaddagReady: boolean;
}

/**
 * Check if the backend API is ready
 */
export const checkHealth = async (): Promise<HealthResponse> => {
    return apiFetch<HealthResponse>(API_ENDPOINTS.health);
};

/**
 * Generate a batch of training puzzles from the backend
 */
export const generateBatch = async (size: number = 5): Promise<Puzzle[]> => {
    try {
        const response = await apiFetch<BatchResponse>(
            `${API_ENDPOINTS.batch}?size=${size}`
        );
        return response.puzzles;
    } catch (error) {
        console.error('Failed to fetch puzzles from backend:', error);
        // Fallback: return empty array, let UI handle the error
        throw error;
    }
};

/**
 * Generate a puzzle for a specific word
 */
export const generateForWord = async (word: string, tirage?: string[]): Promise<Puzzle> => {
    const response = await apiFetch<PuzzleResponse>(
        API_ENDPOINTS.generate,
        {
            method: 'POST',
            body: JSON.stringify({ word, tirage }),
        }
    );
    return response.puzzle;
};

/**
 * Get a single random puzzle
 */
export const getRandomPuzzle = async (): Promise<Puzzle> => {
    const response = await apiFetch<PuzzleResponse>(API_ENDPOINTS.puzzle);
    return response.puzzle;
};
