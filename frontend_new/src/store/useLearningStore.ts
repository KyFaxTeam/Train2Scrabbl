import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
    WordMastery,
    UserProgress,
    LearningTrigger,
    XPReward
} from '../types';
import { intelligentLearningService } from '../services/intelligentLearningService';
import {
    getUserProgress,
    updateUserProgress,
    addXP as addXPToDb,
    updateStreak,
} from '../services/learningStore';

interface LearningState {
    // État en mémoire (cache)
    userProgress: UserProgress | null;
    currentTrigger: LearningTrigger | null;
    isLoading: boolean;

    // Session tracking
    sessionStartTime: number | null;
    sessionCorrectStreak: number;

    // Actions
    initialize: () => Promise<void>;
    trackExtensionView: (drawId: string, letter: string, word: string) => Promise<LearningTrigger | null>;
    recordTestResult: (wordId: string, correct: boolean, timeMs: number) => Promise<{
        mastery: WordMastery;
        xp: XPReward;
    }>;
    dismissTrigger: () => void;
    startSession: () => void;
    endSession: () => void;
}

/**
 * Calcule l'XP gagné pour une réponse
 */
function calculateXP(
    correct: boolean,
    mastery: WordMastery,
    responseTimeMs: number,
    progress: UserProgress | null
): XPReward {
    if (!correct) {
        return {
            base: 0,
            streakBonus: 0,
            difficultyBonus: 0,
            speedBonus: 0,
            total: 0,
            breakdown: []
        };
    }

    const breakdown: string[] = [];

    // Base XP
    const base = 10;
    breakdown.push('+10 XP (réponse correcte)');

    // Bonus difficulté
    const difficultyBonus = Math.round(mastery.difficulty * 15);
    if (difficultyBonus > 0) {
        breakdown.push(`+${difficultyBonus} XP (difficulté)`);
    }

    // Bonus vitesse
    let speedBonus = 0;
    if (responseTimeMs < 3000) {
        speedBonus = 5;
        breakdown.push('+5 XP (réponse rapide)');
    }

    // Bonus streak journalier
    const currentStreak = progress?.currentStreak || 0;
    const streakBonus = Math.min(currentStreak * 2, 20);
    if (streakBonus > 0) {
        breakdown.push(`+${streakBonus} XP (streak ${currentStreak}j)`);
    }

    const total = base + difficultyBonus + speedBonus + streakBonus;

    return { base, streakBonus, difficultyBonus, speedBonus, total, breakdown };
}

export const useLearningStore = create<LearningState>()(
    persist(
        (set, get) => ({
            userProgress: null,
            currentTrigger: null,
            isLoading: false,
            sessionStartTime: null,
            sessionCorrectStreak: 0,

            initialize: async () => {
                set({ isLoading: true });
                try {
                    const progress = await getUserProgress();
                    await updateStreak(); // Met à jour le streak si nouveau jour
                    const updatedProgress = await getUserProgress();
                    set({ userProgress: updatedProgress, isLoading: false });
                } catch (error) {
                    console.error('Failed to initialize learning store:', error);
                    set({ isLoading: false });
                }
            },

            trackExtensionView: async (drawId, letter, word) => {
                const trigger = await intelligentLearningService.onExtensionViewed(
                    drawId,
                    letter,
                    word
                );

                if (trigger) {
                    set({ currentTrigger: trigger });
                }

                return trigger;
            },

            recordTestResult: async (wordId, correct, timeMs) => {
                const state = get();

                // Mettre à jour la maîtrise du mot
                const mastery = await intelligentLearningService.updateAfterTest(
                    wordId,
                    correct,
                    timeMs
                );

                // Calculer l'XP
                const xp = calculateXP(correct, mastery, timeMs, state.userProgress);

                if (xp.total > 0) {
                    const updatedProgress = await addXPToDb(xp.total);
                    set({ userProgress: updatedProgress });
                }

                // Mettre à jour le streak de session
                if (correct) {
                    set({ sessionCorrectStreak: state.sessionCorrectStreak + 1 });
                } else {
                    set({ sessionCorrectStreak: 0 });
                }

                // Mettre à jour les fast answers si réponse rapide
                if (correct && timeMs < 3000 && state.userProgress) {
                    const progress = { ...state.userProgress };
                    progress.fastAnswers = (progress.fastAnswers || 0) + 1;
                    await updateUserProgress(progress);
                    set({ userProgress: progress });
                }

                return { mastery, xp };
            },

            dismissTrigger: () => {
                set({ currentTrigger: null });
            },

            startSession: () => {
                set({
                    sessionStartTime: Date.now(),
                    sessionCorrectStreak: 0
                });
            },

            endSession: () => {
                set({
                    sessionStartTime: null,
                    sessionCorrectStreak: 0
                });
            },
        }),
        {
            name: 'scrabble-learning-store',
            partialize: () => ({
                // Ne persister que certaines valeurs simples
                // Les données lourdes sont dans IndexedDB
            }),
        }
    )
);
