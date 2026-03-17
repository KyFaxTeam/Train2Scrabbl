import { MasteryLevel } from '../types';
import type {
    WordMastery,
    LearningTrigger,
    CategoryStats
} from '../types';
import {
    getOrCreateWordMastery,
    updateWordMastery,
    getDueForReview,
    getWordMasteriesByDraw,
    getWordMasteriesByLevel,
} from './learningStore';

/**
 * Service intelligent pour la gestion de l'apprentissage
 * Basé sur les principes de spaced repetition et testing effect
 */
class IntelligentLearningService {

    /**
     * Calcule le niveau de maîtrise basé sur les métriques
     */
    calculateMasteryLevel(m: WordMastery): MasteryLevel {
        if (m.viewCount === 0) return MasteryLevel.UNSEEN;
        if (m.testCount === 0) return MasteryLevel.EXPOSED;
        if (m.testCount < 3) return MasteryLevel.LEARNING;

        const accuracy = m.correctCount / m.testCount;

        if (m.testCount >= 10 && accuracy >= 0.95 && m.stability > 30) {
            return MasteryLevel.BURNED;
        }
        if (accuracy >= 0.8) return MasteryLevel.MASTERED;
        return MasteryLevel.REVIEWING;
    }

    /**
     * Appelé quand l'utilisateur RÉVÈLE une extension dans le Codex
     * Retourne un trigger si une action est suggérée
     */
    async onExtensionViewed(
        drawId: string,
        extensionLetter: string,
        word: string
    ): Promise<LearningTrigger | null> {
        const mastery = await getOrCreateWordMastery(drawId, extensionLetter, word);

        // Mettre à jour les métriques de vue
        mastery.viewCount++;
        mastery.lastViewed = new Date().toISOString();
        mastery.masteryLevel = this.calculateMasteryLevel(mastery);

        await updateWordMastery(mastery);

        // Logique de déclenchement de triggers

        // Règle 1: Après 3 consultations sans test → Suggestion de test
        if (mastery.viewCount === 3 && mastery.testCount === 0) {
            return {
                type: 'test_suggestion',
                priority: 'high',
                payload: {
                    message: `Vous avez consulté "${word}" 3 fois. Prêt à le tester?`,
                    words: [mastery.wordId],
                    action: 'quick_test'
                }
            };
        }

        // Règle 2: Après 5+ consultations sans test → Suggestion insistante
        if (mastery.viewCount >= 5 && mastery.testCount === 0) {
            return {
                type: 'test_suggestion',
                priority: 'urgent',
                payload: {
                    message: `La relecture passive est moins efficace que le test! Essayez "${word}"`,
                    words: [mastery.wordId],
                    action: 'start_training'
                }
            };
        }

        // Règle 3: Mot dû pour révision
        if (mastery.dueDate && new Date(mastery.dueDate) <= new Date()) {
            return {
                type: 'review_reminder',
                priority: 'medium',
                payload: {
                    message: `"${word}" est dû pour révision!`,
                    words: [mastery.wordId],
                    action: 'review'
                }
            };
        }

        return null;
    }

    /**
     * FSRS simplifié: Met à jour les paramètres après un test
     */
    async updateAfterTest(
        wordId: string,
        correct: boolean,
        responseTimeMs: number
    ): Promise<WordMastery> {
        const parts = wordId.split('-');
        const drawId = parts[0];
        const extensionLetter = parts[1];
        const word = parts.slice(2).join('-');

        const mastery = await getOrCreateWordMastery(drawId, extensionLetter, word);

        mastery.testCount++;
        if (correct) mastery.correctCount++;
        mastery.lastTested = new Date().toISOString();

        // Calcul FSRS simplifié
        if (correct) {
            // Réponse correcte → augmenter l'intervalle
            // Facteur basé sur le temps de réponse
            const factor = responseTimeMs < 3000 ? 2.5 : responseTimeMs < 8000 ? 2.0 : 1.5;
            mastery.stability = Math.min(mastery.stability * factor, 365);
            mastery.difficulty = Math.max(0, mastery.difficulty - 0.05);
        } else {
            // Réponse incorrecte → réduire l'intervalle drastiquement
            mastery.stability = Math.max(1, mastery.stability * 0.3);
            mastery.difficulty = Math.min(1, mastery.difficulty + 0.1);
        }

        // Calculer la nouvelle date due
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + Math.round(mastery.stability));
        mastery.dueDate = dueDate.toISOString();

        // Mise à jour niveau de maîtrise
        mastery.masteryLevel = this.calculateMasteryLevel(mastery);

        await updateWordMastery(mastery);

        return mastery;
    }

    /**
     * Prépare une session d'entraînement optimale
     */
    async prepareTrainingSession(maxWords: number = 20): Promise<{
        dueWords: WordMastery[];
        newWords: WordMastery[];
    }> {
        const dueWords = await getDueForReview();

        // Limiter et prioriser
        const dueSlots = Math.floor(maxWords * 0.7); // 70% révision
        const sortedDue = dueWords
            .sort((a, b) => {
                // Prioriser par date due (plus ancien d'abord)
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate.localeCompare(b.dueDate);
            })
            .slice(0, dueSlots);

        // 30% nouveaux mots : vus dans le Codex (EXPOSED) mais jamais testés
        const newSlots = maxWords - sortedDue.length;
        const exposedWords = await getWordMasteriesByLevel(MasteryLevel.EXPOSED);
        const newWords = exposedWords.slice(0, newSlots);

        return {
            dueWords: sortedDue,
            newWords,
        };
    }

    /**
     * Calcule les statistiques d'une catégorie
     */
    async getCategoryStats(prefix: string, allDrawIds: string[]): Promise<CategoryStats> {
        let extensionsTotal = 0;
        let extensionsMastered = 0;
        let totalCorrect = 0;
        let totalTests = 0;
        let entriesMastered = 0;

        for (const drawId of allDrawIds) {
            if (drawId.startsWith(prefix)) {
                const masteries = await getWordMasteriesByDraw(drawId);
                extensionsTotal += masteries.length || 1; // Au moins 1 si pas encore vu

                // Une entrée est maîtrisée si toutes ses extensions sont MASTERED ou BURNED
                const allMastered = masteries.length > 0 && masteries.every(
                    m => m.masteryLevel === MasteryLevel.MASTERED || m.masteryLevel === MasteryLevel.BURNED
                );
                if (allMastered) entriesMastered++;

                for (const m of masteries) {
                    if (m.masteryLevel === MasteryLevel.MASTERED || m.masteryLevel === MasteryLevel.BURNED) {
                        extensionsMastered++;
                    }
                    totalCorrect += m.correctCount;
                    totalTests += m.testCount;
                }
            }
        }

        return {
            prefix,
            entriesTotal: allDrawIds.filter(d => d.startsWith(prefix)).length,
            entriesMastered,
            extensionsTotal,
            extensionsMastered,
            averageAccuracy: totalTests > 0 ? totalCorrect / totalTests : 0,
        };
    }
}

// Singleton export
export const intelligentLearningService = new IntelligentLearningService();
