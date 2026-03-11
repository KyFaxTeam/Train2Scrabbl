/**
 * Learning System Types
 * Based on FSRS (Free Spaced Repetition Scheduler) principles
 */

/**
 * Niveau de maîtrise d'un mot
 */
export enum MasteryLevel {
    UNSEEN = 'unseen',       // Jamais consulté
    EXPOSED = 'exposed',     // Consulté mais pas testé
    LEARNING = 'learning',   // En cours d'apprentissage (<3 tests)
    REVIEWING = 'reviewing', // En révision (3+ tests, <80% correct)
    MASTERED = 'mastered',   // Maîtrisé (3+ tests, 80%+ correct)
    BURNED = 'burned'        // Expertise totale (10+ tests, 95%+ correct, stability > 30j)
}

/**
 * État de maîtrise d'un mot spécifique
 */
export interface WordMastery {
    wordId: string;           // Format: "DRAW-LETTER-WORD" ex: "AAABCCR-E-CACABERA"
    drawId: string;           // Le tirage ex: "AAABCCR"
    extensionLetter: string;  // La lettre d'appui ex: "E"
    word: string;             // Le mot résultant ex: "CACABERA"

    // Métriques de consultation (Dictionary/Codex)
    viewCount: number;        // Nombre de fois où l'extension a été révélée
    lastViewed: string | null; // ISO date string

    // Métriques de test (Training)  
    testCount: number;        // Nombre de fois testée
    correctCount: number;     // Réponses correctes
    lastTested: string | null; // ISO date string

    // FSRS-like parameters
    stability: number;        // Jours avant oubli probable (0.9 retention)
    difficulty: number;       // 0-1, plus haut = plus difficile
    dueDate: string | null;   // ISO date string - Prochaine révision recommandée

    // Niveau de maîtrise calculé
    masteryLevel: MasteryLevel;
}

/**
 * Statistiques par catégorie (préfixe)
 */
export interface CategoryStats {
    prefix: string;              // ex: "AAB"
    entriesTotal: number;
    entriesMastered: number;
    extensionsTotal: number;
    extensionsMastered: number;
    averageAccuracy: number;
}

/**
 * Achievement débloqué
 */
export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    unlockedAt: string; // ISO date string
    category: 'streak' | 'mastery' | 'exploration' | 'performance';
}

/**
 * Progression globale de l'utilisateur
 */
export interface UserProgress {
    // Stats globales
    totalXP: number;
    currentStreak: number;       // Jours consécutifs
    longestStreak: number;
    lastActiveDate: string | null; // ISO date string

    // Stats de session
    currentPerfectStreak: number; // Réponses correctes d'affilée
    fastAnswers: number;          // Réponses < 3 secondes

    // Achievements débloqués
    achievements: Achievement[];

    // Préférences d'apprentissage
    dailyGoal: number;           // XP cible par jour
    preferredSessionLength: number; // Minutes
}

/**
 * Trigger généré par le service intelligent
 */
export interface LearningTrigger {
    type: 'test_suggestion' | 'review_reminder' | 'new_word_intro' | 'achievement';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    payload: {
        message: string;
        words?: string[];
        action?: string;
        achievement?: Achievement;
    };
}

/**
 * Session d'entraînement préparée
 */
export interface TrainingSession {
    words: string[];           // IDs des mots à réviser
    estimatedTime: number;     // Temps estimé en secondes
    xpPotential: number;       // XP potentiel
    streakBonus: number;       // Bonus streak actuel
}

/**
 * Récompense XP calculée
 */
export interface XPReward {
    base: number;
    streakBonus: number;
    difficultyBonus: number;
    speedBonus: number;
    total: number;
    breakdown: string[];
}
