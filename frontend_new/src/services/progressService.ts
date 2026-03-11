/**
 * Progress Service - Calcul de la progression par monde/catégorie
 * 
 * Intègre avec learningStore pour calculer les statistiques de maîtrise.
 */

import { getDB } from './learningStore';
import { MasteryLevel } from '../types';
import type { WordMastery, WorldType, DrawEntry } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface WorldProgress {
    worldId: WorldType;
    totalEntries: number;
    viewedEntries: number;
    masteredEntries: number;
    burnedEntries: number;
    averageAccuracy: number;
    percentComplete: number;
    percentMastered: number;
}

export interface EntryProgress {
    drawId: string;
    totalExtensions: number;
    viewedExtensions: number;
    masteredExtensions: number;
    averageAccuracy: number;
    overallMastery: MasteryLevel;
}

export interface SubCategoryProgress {
    subcategoryId: string;
    totalEntries: number;
    masteredEntries: number;
    percentComplete: number;
}

// ============================================================================
// MASTERY CALCULATIONS
// ============================================================================

/**
 * Détermine le niveau de maîtrise global pour une entrée
 */
export function calculateOverallMastery(masteries: WordMastery[]): MasteryLevel {
    if (masteries.length === 0) return MasteryLevel.UNSEEN;
    
    const levels = masteries.map(m => m.masteryLevel);
    
    // Si tout est BURNED
    if (levels.every(l => l === MasteryLevel.BURNED)) return MasteryLevel.BURNED;
    
    // Si tout est MASTERED ou mieux
    if (levels.every(l => l === MasteryLevel.MASTERED || l === MasteryLevel.BURNED)) {
        return MasteryLevel.MASTERED;
    }
    
    // Si au moins un est REVIEWING
    if (levels.some(l => l === MasteryLevel.REVIEWING || l === MasteryLevel.MASTERED || l === MasteryLevel.BURNED)) {
        return MasteryLevel.REVIEWING;
    }
    
    // Si au moins un est LEARNING
    if (levels.some(l => l === MasteryLevel.LEARNING)) {
        return MasteryLevel.LEARNING;
    }
    
    // Si au moins un est EXPOSED
    if (levels.some(l => l === MasteryLevel.EXPOSED)) {
        return MasteryLevel.EXPOSED;
    }
    
    return MasteryLevel.UNSEEN;
}

/**
 * Calcule le pourcentage de maîtrise (0-100)
 */
export function calculateMasteryPercent(masteries: WordMastery[]): number {
    if (masteries.length === 0) return 0;
    
    const weights: Record<MasteryLevel, number> = {
        [MasteryLevel.UNSEEN]: 0,
        [MasteryLevel.EXPOSED]: 10,
        [MasteryLevel.LEARNING]: 30,
        [MasteryLevel.REVIEWING]: 60,
        [MasteryLevel.MASTERED]: 90,
        [MasteryLevel.BURNED]: 100,
    };
    
    const total = masteries.reduce((sum, m) => sum + weights[m.masteryLevel], 0);
    return Math.round(total / masteries.length);
}

// ============================================================================
// DATABASE QUERIES
// ============================================================================

/**
 * Récupère tous les WordMastery pour un tirage
 */
export async function getMasteriesForDraw(drawId: string): Promise<WordMastery[]> {
    try {
        const db = await getDB();
        return db.getAllFromIndex('wordMasteries', 'by-draw', drawId);
    } catch {
        return [];
    }
}

/**
 * Récupère tous les WordMastery
 */
export async function getAllMasteries(): Promise<WordMastery[]> {
    try {
        const db = await getDB();
        return db.getAll('wordMasteries');
    } catch {
        return [];
    }
}

// ============================================================================
// PROGRESS CALCULATIONS
// ============================================================================

/**
 * Calcule la progression pour une entrée spécifique
 */
export async function getEntryProgress(entry: DrawEntry): Promise<EntryProgress> {
    const masteries = await getMasteriesForDraw(entry.draw);
    
    const viewedExtensions = masteries.filter(m => m.viewCount > 0).length;
    const masteredExtensions = masteries.filter(
        m => m.masteryLevel === MasteryLevel.MASTERED || m.masteryLevel === MasteryLevel.BURNED
    ).length;
    
    const testedMasteries = masteries.filter(m => m.testCount > 0);
    const averageAccuracy = testedMasteries.length > 0
        ? testedMasteries.reduce((sum, m) => sum + (m.correctCount / m.testCount), 0) / testedMasteries.length
        : 0;
    
    return {
        drawId: entry.draw,
        totalExtensions: entry.extensions.length,
        viewedExtensions,
        masteredExtensions,
        averageAccuracy: Math.round(averageAccuracy * 100),
        overallMastery: calculateOverallMastery(masteries),
    };
}

/**
 * Calcule la progression pour un monde
 */
export async function getWorldProgress(
    worldId: WorldType,
    entries: DrawEntry[]
): Promise<WorldProgress> {
    const allMasteries = await getAllMasteries();
    const masteriesByDraw = new Map<string, WordMastery[]>();
    
    // Grouper par tirage
    for (const m of allMasteries) {
        const list = masteriesByDraw.get(m.drawId) || [];
        list.push(m);
        masteriesByDraw.set(m.drawId, list);
    }
    
    let viewedEntries = 0;
    let masteredEntries = 0;
    let burnedEntries = 0;
    let totalAccuracy = 0;
    let testedCount = 0;
    
    for (const entry of entries) {
        const masteries = masteriesByDraw.get(entry.draw) || [];
        
        if (masteries.some(m => m.viewCount > 0)) {
            viewedEntries++;
        }
        
        const overallMastery = calculateOverallMastery(masteries);
        if (overallMastery === MasteryLevel.MASTERED) masteredEntries++;
        if (overallMastery === MasteryLevel.BURNED) {
            masteredEntries++;
            burnedEntries++;
        }
        
        const testedMasteries = masteries.filter(m => m.testCount > 0);
        if (testedMasteries.length > 0) {
            const entryAccuracy = testedMasteries.reduce(
                (sum, m) => sum + (m.correctCount / m.testCount), 0
            ) / testedMasteries.length;
            totalAccuracy += entryAccuracy;
            testedCount++;
        }
    }
    
    return {
        worldId,
        totalEntries: entries.length,
        viewedEntries,
        masteredEntries,
        burnedEntries,
        averageAccuracy: testedCount > 0 ? Math.round((totalAccuracy / testedCount) * 100) : 0,
        percentComplete: Math.round((viewedEntries / entries.length) * 100),
        percentMastered: Math.round((masteredEntries / entries.length) * 100),
    };
}

/**
 * Récupère les statistiques globales de lArène
 */
export async function getGlobalArenaStats(): Promise<{
    totalViewed: number;
    totalMastered: number;
    totalBurned: number;
    averageAccuracy: number;
    streakDays: number;
}> {
    const allMasteries = await getAllMasteries();
    
    const viewedMasteries = allMasteries.filter(m => m.viewCount > 0);
    const masteredMasteries = allMasteries.filter(
        m => m.masteryLevel === MasteryLevel.MASTERED || m.masteryLevel === MasteryLevel.BURNED
    );
    const burnedMasteries = allMasteries.filter(m => m.masteryLevel === MasteryLevel.BURNED);
    
    const testedMasteries = allMasteries.filter(m => m.testCount > 0);
    const avgAccuracy = testedMasteries.length > 0
        ? testedMasteries.reduce((sum, m) => sum + (m.correctCount / m.testCount), 0) / testedMasteries.length
        : 0;
    
    return {
        totalViewed: viewedMasteries.length,
        totalMastered: masteredMasteries.length,
        totalBurned: burnedMasteries.length,
        averageAccuracy: Math.round(avgAccuracy * 100),
        streakDays: 0, // Sera récupéré du userProgress
    };
}
