export interface Extension {
    letter: string;
    word: string;
}

// Tags calculés pour chaque tirage (navigation multi-dimensionnelle)
export interface DrawTags {
    vowelCount: number;           // Nombre de voyelles (1-6)
    consonantCount: number;       // Nombre de consonnes (1-6)
    totalValue: number;           // Somme des points des lettres (7-70+)
    valueCategory: 'low' | 'mid' | 'high' | 'premium';
    premiumLetters: string[];     // Lettres premium présentes (J,K,Q,W,X,Y,Z)
    hasPremium: boolean;          // Contient au moins une lettre premium
    firstLetter: string;          // Première lettre du tirage trié
    probabilityRank?: number;     // Rang de probabilité (1 = plus fréquent)
}

export interface DrawEntry {
    id: string;
    draw: string;       // The 7-letter draw (e.g., "AAABCCR")
    solutions: string[]; // Base words (e.g., "BACCARA")
    extensions: Extension[]; // Scrabble+1 extensions
    tags?: DrawTags;    // Tags calculés pour la navigation
}

export interface DictionaryCategory {
    prefix: string;     // e.g., "AAA"
    entries: DrawEntry[];
}

// Types pour les Mondes de l'Arène
export type WorldType = 'essentials' | 'premium' | 'vowels' | 'explorer' | 'morphology';

export interface WorldDefinition {
    id: WorldType;
    name: string;
    icon: string;
    description: string;
    detailedDescription: string;
    color: string;
}

export interface SubCategory {
    id: string;
    label: string;
    icon?: string;
    count: number;
    entries: DrawEntry[];
}

// ============================================================================
// STUDY SESSION TYPES
// ============================================================================

export type StudyRating = 'again' | 'hard' | 'good' | 'easy';

export interface StudyResult {
    entryId: string;
    rating: StudyRating;
    responseTimeMs: number;
    timestamp: number;
}

export interface StudySession {
    id: string;
    world: WorldType;
    subcategory?: string;
    entries: DrawEntry[];
    currentIndex: number;
    startedAt: number;
    results: StudyResult[];
}

export interface StudySessionConfig {
    maxEntries: number;       // Nombre max de tirages par session (20 par défaut)
    shuffleEntries: boolean;  // Mélanger l'ordre
    filterMastered: boolean;  // Exclure les maîtrisés
}

export interface SessionStats {
    total: number;
    again: number;
    hard: number;
    good: number;
    easy: number;
    averageTimeMs: number;
    accuracy: number; // % good + easy
}

// ============================================================================
// DAILY ACTIVITY TRACKING TYPES (Stats Dashboard)
// ============================================================================

export interface DailyActivityRecord {
    id: string; // YYYY-MM-DD
    reviewCount: number;
    newLearned: number;
    correctCount: number;
    totalAnswers: number;
    sessionDuration: number; // seconds
    worlds: Partial<Record<WorldType, { reviewed: number; correct: number }>>;
}

export interface HeatmapData {
    dailyActivity: DailyActivityRecord[];
    currentStreak: number;
    longestStreak: number;
    totalDaysActive: number;
}

export interface FutureDueData {
    date: string;
    dueCount: number;
    estimatedMinutes: number;
}

export interface RetentionStats {
    overallRetention: number;
    matureRetention: number;
    youngRetention: number;
    retentionByWorld: Partial<Record<WorldType, number>>;
}

export interface IntervalDistribution {
    range: string;
    count: number;
    percent: number;
}
