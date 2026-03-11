import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { MasteryLevel } from '../types';
import type { WordMastery, UserProgress, Achievement } from '../types';
import type { DailyActivityRecord, WorldType } from '../types/dictionary';

/**
 * Schema IndexedDB pour le learning store
 */
interface LearningDB extends DBSchema {
    wordMasteries: {
        key: string; // wordId
        value: WordMastery;
        indexes: {
            'by-draw': string;
            'by-mastery': MasteryLevel;
            'by-due': string;
        };
    };
    userProgress: {
        key: string; // 'main' - singleton
        value: UserProgress;
    };
    dailyActivity: {
        key: string; // YYYY-MM-DD
        value: DailyActivityRecord;
    };
}

const DB_NAME = 'scrabble-learning-db';
const DB_VERSION = 2; // Incremented for new store

let dbPromise: Promise<IDBPDatabase<LearningDB>> | null = null;

/**
 * Initialise et retourne la connexion à la base de données
 */
export const getDB = async (): Promise<IDBPDatabase<LearningDB>> => {
    if (!dbPromise) {
        dbPromise = openDB<LearningDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                // Store pour les WordMastery
                if (!db.objectStoreNames.contains('wordMasteries')) {
                    const wordStore = db.createObjectStore('wordMasteries', {
                        keyPath: 'wordId',
                    });
                    wordStore.createIndex('by-draw', 'drawId');
                    wordStore.createIndex('by-mastery', 'masteryLevel');
                    wordStore.createIndex('by-due', 'dueDate');
                }

                // Store pour UserProgress (singleton)
                if (!db.objectStoreNames.contains('userProgress')) {
                    db.createObjectStore('userProgress');
                }

                // Store pour DailyActivity (added in v2)
                if (!db.objectStoreNames.contains('dailyActivity')) {
                    db.createObjectStore('dailyActivity', { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
};

/**
 * Valeurs par défaut pour UserProgress
 */
export const DEFAULT_USER_PROGRESS: UserProgress = {
    totalXP: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    currentPerfectStreak: 0,
    fastAnswers: 0,
    achievements: [],
    dailyGoal: 50,
    preferredSessionLength: 10,
};

/**
 * Crée un WordMastery initial pour un mot
 */
export const createInitialWordMastery = (
    drawId: string,
    extensionLetter: string,
    word: string
): WordMastery => ({
    wordId: `${drawId}-${extensionLetter}-${word}`,
    drawId,
    extensionLetter,
    word,
    viewCount: 0,
    lastViewed: null,
    testCount: 0,
    correctCount: 0,
    lastTested: null,
    stability: 1, // 1 jour initial
    difficulty: 0.3, // Difficulté moyenne par défaut
    dueDate: null,
    masteryLevel: MasteryLevel.UNSEEN,
});

// ============ WORD MASTERY OPERATIONS ============

/**
 * Récupère un WordMastery par son ID
 */
export const getWordMastery = async (wordId: string): Promise<WordMastery | undefined> => {
    const db = await getDB();
    return db.get('wordMasteries', wordId);
};

/**
 * Récupère ou crée un WordMastery
 */
export const getOrCreateWordMastery = async (
    drawId: string,
    extensionLetter: string,
    word: string
): Promise<WordMastery> => {
    const wordId = `${drawId}-${extensionLetter}-${word}`;
    const db = await getDB();
    let mastery = await db.get('wordMasteries', wordId);

    if (!mastery) {
        mastery = createInitialWordMastery(drawId, extensionLetter, word);
        await db.put('wordMasteries', mastery);
    }

    return mastery;
};

/**
 * Met à jour un WordMastery
 */
export const updateWordMastery = async (mastery: WordMastery): Promise<void> => {
    const db = await getDB();
    await db.put('wordMasteries', mastery);
};

/**
 * Récupère tous les WordMastery d'un tirage
 */
export const getWordMasteriesByDraw = async (drawId: string): Promise<WordMastery[]> => {
    const db = await getDB();
    return db.getAllFromIndex('wordMasteries', 'by-draw', drawId);
};

/**
 * Récupère les mots par niveau de maîtrise
 */
export const getWordMasteriesByLevel = async (level: MasteryLevel): Promise<WordMastery[]> => {
    const db = await getDB();
    return db.getAllFromIndex('wordMasteries', 'by-mastery', level);
};

/**
 * Récupère les mots dus pour révision
 */
export const getDueForReview = async (): Promise<WordMastery[]> => {
    const db = await getDB();
    const now = new Date().toISOString();
    const all = await db.getAll('wordMasteries');

    return all.filter(m => m.dueDate && m.dueDate <= now);
};

/**
 * Compte les mots par niveau de maîtrise
 */
export const countByMasteryLevel = async (): Promise<Record<MasteryLevel, number>> => {
    const db = await getDB();
    const all = await db.getAll('wordMasteries');

    const counts: Record<MasteryLevel, number> = {
        [MasteryLevel.UNSEEN]: 0,
        [MasteryLevel.EXPOSED]: 0,
        [MasteryLevel.LEARNING]: 0,
        [MasteryLevel.REVIEWING]: 0,
        [MasteryLevel.MASTERED]: 0,
        [MasteryLevel.BURNED]: 0,
    };

    for (const m of all) {
        counts[m.masteryLevel]++;
    }

    return counts;
};

// ============ USER PROGRESS OPERATIONS ============

const USER_PROGRESS_KEY = 'main';

/**
 * Récupère la progression utilisateur
 */
export const getUserProgress = async (): Promise<UserProgress> => {
    const db = await getDB();
    const progress = await db.get('userProgress', USER_PROGRESS_KEY);
    return progress || { ...DEFAULT_USER_PROGRESS };
};

/**
 * Met à jour la progression utilisateur
 */
export const updateUserProgress = async (progress: UserProgress): Promise<void> => {
    const db = await getDB();
    await db.put('userProgress', progress, USER_PROGRESS_KEY);
};

/**
 * Ajoute des XP à la progression
 */
export const addXP = async (xp: number): Promise<UserProgress> => {
    const progress = await getUserProgress();
    progress.totalXP += xp;
    await updateUserProgress(progress);
    return progress;
};

/**
 * Met à jour le streak journalier
 */
export const updateStreak = async (): Promise<UserProgress> => {
    const progress = await getUserProgress();
    const today = new Date().toISOString().split('T')[0];
    const lastActive = progress.lastActiveDate?.split('T')[0];

    if (lastActive === today) {
        // Déjà actif aujourd'hui, pas de changement
        return progress;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastActive === yesterdayStr) {
        // Actif hier, continuer le streak
        progress.currentStreak += 1;
        progress.longestStreak = Math.max(progress.longestStreak, progress.currentStreak);
    } else {
        // Streak cassé, recommencer
        progress.currentStreak = 1;
    }

    progress.lastActiveDate = new Date().toISOString();
    await updateUserProgress(progress);
    return progress;
};

/**
 * Ajoute un achievement
 */
export const unlockAchievement = async (achievement: Achievement): Promise<void> => {
    const progress = await getUserProgress();

    // Éviter les doublons
    if (!progress.achievements.find(a => a.id === achievement.id)) {
        progress.achievements.push(achievement);
        await updateUserProgress(progress);
    }
};

/**
 * Réinitialise toutes les données (pour debug/test)
 */
export const resetAllData = async (): Promise<void> => {
    const db = await getDB();
    await db.clear('wordMasteries');
    await db.delete('userProgress', USER_PROGRESS_KEY);
};

// ============ DAILY ACTIVITY OPERATIONS ============

/**
 * Récupère l'activité d'un jour spécifique
 */
export const getDailyActivity = async (id: string): Promise<DailyActivityRecord | undefined> => {
    const db = await getDB();
    return db.get('dailyActivity', id);
};

/**
 * Sauvegarde l'activité d'un jour
 */
export const saveDailyActivity = async (record: DailyActivityRecord): Promise<void> => {
    const db = await getDB();
    await db.put('dailyActivity', record);
};

/**
 * Récupère toutes les activités
 */
export const getAllDailyActivity = async (): Promise<DailyActivityRecord[]> => {
    const db = await getDB();
    return db.getAll('dailyActivity');
};

/**
 * Récupère les activités dans une plage de dates
 */
export const getDailyActivityRange = async (
    startDate: string,
    endDate: string
): Promise<DailyActivityRecord[]> => {
    const db = await getDB();
    const all = await db.getAll('dailyActivity');
    return all.filter(a => a.id >= startDate && a.id <= endDate);
};

/**
 * Crée un enregistrement d'activité vide pour aujourd'hui
 */
export const createEmptyDailyActivity = (date: string): DailyActivityRecord => ({
    id: date,
    reviewCount: 0,
    newLearned: 0,
    correctCount: 0,
    totalAnswers: 0,
    sessionDuration: 0,
    worlds: {},
});

/**
 * Met à jour ou crée l'activité du jour avec de nouvelles données de session
 */
export const updateDailyActivityWithSession = async (
    reviewCount: number,
    correctCount: number,
    sessionDuration: number,
    world?: WorldType
): Promise<DailyActivityRecord> => {
    const today = new Date().toISOString().split('T')[0];
    const db = await getDB();

    let activity = await db.get('dailyActivity', today);

    if (!activity) {
        activity = createEmptyDailyActivity(today);
    }

    // Update totals
    activity.reviewCount += reviewCount;
    activity.correctCount += correctCount;
    activity.totalAnswers += reviewCount;
    activity.sessionDuration += sessionDuration;

    // Update world-specific stats
    if (world) {
        if (!activity.worlds[world]) {
            activity.worlds[world] = { reviewed: 0, correct: 0 };
        }
        activity.worlds[world]!.reviewed += reviewCount;
        activity.worlds[world]!.correct += correctCount;
    }

    await db.put('dailyActivity', activity);
    return activity;
};
