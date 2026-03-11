/**
 * Arena Session Service - Gere les sessions d'etude depuis l'Arene
 * 
 * Flow: Arene -> Selection tirages -> Session Study -> Resultats -> Retour Arene
 */

import type { 
    DrawEntry, 
    WorldType, 
    StudySession, 
    StudyResult, 
    StudyRating,
    SessionStats,
    StudySessionConfig 
} from '../types/dictionary';

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

const DEFAULT_CONFIG: StudySessionConfig = {
    maxEntries: 20,
    shuffleEntries: true,
    filterMastered: false,
};

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new study session
 */
export function createStudySession(
    world: WorldType,
    entries: DrawEntry[],
    subcategory?: string,
    config: Partial<StudySessionConfig> = {}
): StudySession {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Limit and optionally shuffle entries
    let sessionEntries = entries.slice(0, finalConfig.maxEntries);
    if (finalConfig.shuffleEntries) {
        sessionEntries = shuffleArray(sessionEntries);
    }
    
    return {
        id: generateSessionId(),
        world,
        subcategory,
        entries: sessionEntries,
        currentIndex: 0,
        startedAt: Date.now(),
        results: [],
    };
}

/**
 * Create a single-entry study session
 */
export function createSingleEntrySession(
    entry: DrawEntry,
    world: WorldType = 'explorer'
): StudySession {
    return {
        id: generateSessionId(),
        world,
        entries: [entry],
        currentIndex: 0,
        startedAt: Date.now(),
        results: [],
    };
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

/**
 * Get current entry in session
 */
export function getCurrentEntry(session: StudySession): DrawEntry | null {
    if (session.currentIndex >= session.entries.length) return null;
    return session.entries[session.currentIndex];
}

/**
 * Record a study result and advance to next entry
 */
export function recordStudyResult(
    session: StudySession,
    rating: StudyRating,
    responseTimeMs: number
): StudySession {
    const currentEntry = getCurrentEntry(session);
    if (!currentEntry) return session;
    
    const result: StudyResult = {
        entryId: currentEntry.id,
        rating,
        responseTimeMs,
        timestamp: Date.now(),
    };
    
    return {
        ...session,
        results: [...session.results, result],
        currentIndex: session.currentIndex + 1,
    };
}

/**
 * Check if session is complete
 */
export function isSessionComplete(session: StudySession): boolean {
    return session.currentIndex >= session.entries.length;
}

/**
 * Get number of remaining entries
 */
export function getRemainingCount(session: StudySession): number {
    return Math.max(0, session.entries.length - session.currentIndex);
}

/**
 * Get progress percentage (0-100)
 */
export function getProgressPercent(session: StudySession): number {
    if (session.entries.length === 0) return 100;
    return Math.round((session.currentIndex / session.entries.length) * 100);
}

// ============================================================================
// SESSION STATISTICS
// ============================================================================

/**
 * Calculate session statistics
 */
export function getSessionStats(session: StudySession): SessionStats {
    const results = session.results;
    
    if (results.length === 0) {
        return {
            total: 0,
            again: 0,
            hard: 0,
            good: 0,
            easy: 0,
            averageTimeMs: 0,
            accuracy: 0,
        };
    }
    
    const counts = {
        again: results.filter(r => r.rating === 'again').length,
        hard: results.filter(r => r.rating === 'hard').length,
        good: results.filter(r => r.rating === 'good').length,
        easy: results.filter(r => r.rating === 'easy').length,
    };
    
    const totalTimeMs = results.reduce((sum, r) => sum + r.responseTimeMs, 0);
    const correctCount = counts.good + counts.easy;
    
    return {
        total: results.length,
        ...counts,
        averageTimeMs: Math.round(totalTimeMs / results.length),
        accuracy: Math.round((correctCount / results.length) * 100),
    };
}

/**
 * Calculate XP earned from session
 */
export function calculateSessionXP(stats: SessionStats): number {
    // Base XP per entry studied
    const baseXP = stats.total * 5;
    
    // Bonus for correct answers
    const correctBonus = (stats.good * 5) + (stats.easy * 10);
    
    // Accuracy bonus
    const accuracyBonus = stats.accuracy >= 80 ? 20 : stats.accuracy >= 60 ? 10 : 0;
    
    return baseXP + correctBonus + accuracyBonus;
}

// ============================================================================
// RATING HELPERS
// ============================================================================

export const RATING_CONFIG: Record<StudyRating, {
    label: string;
    emoji: string;
    color: string;
    description: string;
}> = {
    again: {
        label: 'Rate',
        emoji: '',
        color: 'red',
        description: 'Je ne connaissais pas',
    },
    hard: {
        label: 'Difficile',
        emoji: '',
        color: 'orange',
        description: 'Je me suis trompe',
    },
    good: {
        label: 'Bien',
        emoji: '',
        color: 'green',
        description: 'Je connaissais',
    },
    easy: {
        label: 'Facile',
        emoji: '',
        color: 'blue',
        description: 'Tres facile',
    },
};
