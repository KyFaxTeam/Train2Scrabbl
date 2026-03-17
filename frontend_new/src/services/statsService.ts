/**
 * Stats Service - Advanced statistics calculations for Arena Dashboard
 * 
 * Features:
 * - Heatmap data (365 days activity)
 * - Future due predictions (30 days)
 * - Retention rate calculations
 * - Interval distribution
 * - Streak calculations
 */

import type {
    DailyActivityRecord,
    HeatmapData,
    FutureDueData,
    RetentionStats,
    IntervalDistribution,
    WorldType
} from '../types/dictionary';
import type { WordMastery } from '../types';
import { MasteryLevel } from '../types';
import {
    getAllDailyActivity,
    getDailyActivityRange,
    updateDailyActivityWithSession,
    getUserProgress,
    getDB
} from './learningStore';

// ============================================================================
// HEATMAP DATA
// ============================================================================

/**
 * Get heatmap data for the last 365 days
 */
export async function getHeatmapData(): Promise<HeatmapData> {
    const activities = await getAllDailyActivity();

    // Sort by date
    activities.sort((a, b) => a.id.localeCompare(b.id));

    // Calculate streaks
    const { current, longest } = calculateStreak(activities);

    // Count active days
    const totalDaysActive = activities.filter(a => a.reviewCount > 0).length;

    return {
        dailyActivity: activities,
        currentStreak: current,
        longestStreak: longest,
        totalDaysActive,
    };
}

/**
 * Calculate current and longest streak from activity records
 */
export function calculateStreak(activities: DailyActivityRecord[]): { current: number; longest: number } {
    if (activities.length === 0) {
        return { current: 0, longest: 0 };
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Create a set of active dates for O(1) lookup
    const activeDates = new Set(
        activities.filter(a => a.reviewCount > 0).map(a => a.id)
    );

    // Calculate current streak (from today or yesterday backwards)
    let currentStreak = 0;
    let checkDate = activeDates.has(today) ? today : yesterday;

    if (activeDates.has(checkDate)) {
        currentStreak = 1;
        let date = new Date(checkDate);

        while (true) {
            date.setDate(date.getDate() - 1);
            const dateStr = date.toISOString().split('T')[0];

            if (activeDates.has(dateStr)) {
                currentStreak++;
            } else {
                break;
            }
        }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate: Date | null = null;

    const sortedDates = Array.from(activeDates).sort();

    for (const dateStr of sortedDates) {
        const date = new Date(dateStr);

        if (lastDate) {
            const diffDays = Math.round((date.getTime() - lastDate.getTime()) / 86400000);

            if (diffDays === 1) {
                tempStreak++;
            } else {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 1;
            }
        } else {
            tempStreak = 1;
        }

        lastDate = date;
    }

    longestStreak = Math.max(longestStreak, tempStreak);

    return { current: currentStreak, longest: longestStreak };
}

// ============================================================================
// FUTURE DUE PREDICTIONS
// ============================================================================

/**
 * Get future due predictions for the next N days
 */
export async function getFutureDue(daysAhead: number = 30): Promise<FutureDueData[]> {
    const db = await getDB();
    const allMasteries = await db.getAll('wordMasteries');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Initialize result array
    const futureDue: FutureDueData[] = [];

    for (let i = 0; i < daysAhead; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + i);
        const dateStr = targetDate.toISOString().split('T')[0];

        // Count words due on this date
        const dueCount = allMasteries.filter(m => {
            if (!m.dueDate) return false;
            const dueDate = m.dueDate.split('T')[0];
            return dueDate === dateStr;
        }).length;

        // Estimate 30 seconds per review
        const estimatedMinutes = Math.ceil(dueCount * 0.5);

        futureDue.push({
            date: dateStr,
            dueCount,
            estimatedMinutes,
        });
    }

    return futureDue;
}

// ============================================================================
// RETENTION STATISTICS
// ============================================================================

/**
 * Calculate retention statistics
 * - Overall retention: % of correct answers
 * - Mature retention: % for words with stability > 21 days
 * - Young retention: % for words with stability <= 21 days
 */
export async function getRetentionStats(): Promise<RetentionStats> {
    const db = await getDB();
    const allMasteries = await db.getAll('wordMasteries');

    // Filter masteries with test history
    const testedMasteries = allMasteries.filter(m => m.testCount > 0);

    if (testedMasteries.length === 0) {
        return {
            overallRetention: 0,
            matureRetention: 0,
            youngRetention: 0,
            retentionByWorld: {},
        };
    }

    // Calculate overall retention
    const totalCorrect = testedMasteries.reduce((sum, m) => sum + m.correctCount, 0);
    const totalTests = testedMasteries.reduce((sum, m) => sum + m.testCount, 0);
    const overallRetention = totalTests > 0 ? (totalCorrect / totalTests) * 100 : 0;

    // Mature = stability > 21 days
    const matureMasteries = testedMasteries.filter(m => m.stability > 21);
    const matureCorrect = matureMasteries.reduce((sum, m) => sum + m.correctCount, 0);
    const matureTests = matureMasteries.reduce((sum, m) => sum + m.testCount, 0);
    const matureRetention = matureTests > 0 ? (matureCorrect / matureTests) * 100 : 0;

    // Young = stability <= 21 days
    const youngMasteries = testedMasteries.filter(m => m.stability <= 21);
    const youngCorrect = youngMasteries.reduce((sum, m) => sum + m.correctCount, 0);
    const youngTests = youngMasteries.reduce((sum, m) => sum + m.testCount, 0);
    const youngRetention = youngTests > 0 ? (youngCorrect / youngTests) * 100 : 0;

    // By world: aggregate from dailyActivity records which track per-world stats
    const activities = await getAllDailyActivity();
    const retentionByWorld: Partial<Record<WorldType, number>> = {};
    const worlds: WorldType[] = ['essentials', 'premium', 'vowels', 'explorer'];

    for (const world of worlds) {
        let worldReviewed = 0;
        let worldCorrect = 0;
        for (const activity of activities) {
            if (activity.worlds[world]) {
                worldReviewed += activity.worlds[world]!.reviewed;
                worldCorrect += activity.worlds[world]!.correct;
            }
        }
        if (worldReviewed > 0) {
            retentionByWorld[world] = Math.round((worldCorrect / worldReviewed) * 1000) / 10;
        }
    }

    return {
        overallRetention: Math.round(overallRetention * 10) / 10,
        matureRetention: Math.round(matureRetention * 10) / 10,
        youngRetention: Math.round(youngRetention * 10) / 10,
        retentionByWorld,
    };
}

// ============================================================================
// INTERVAL DISTRIBUTION
// ============================================================================

/**
 * Get distribution of review intervals
 */
export async function getIntervalDistribution(): Promise<IntervalDistribution[]> {
    const db = await getDB();
    const allMasteries = await db.getAll('wordMasteries');

    // Define interval ranges
    const ranges = [
        { min: 0, max: 1, label: "Aujourd'hui" },
        { min: 1, max: 7, label: "1-7 jours" },
        { min: 7, max: 30, label: "1-4 semaines" },
        { min: 30, max: 90, label: "1-3 mois" },
        { min: 90, max: 365, label: "3-12 mois" },
        { min: 365, max: Infinity, label: "1+ an" },
    ];

    const total = allMasteries.length;

    if (total === 0) {
        return ranges.map(r => ({
            range: r.label,
            count: 0,
            percent: 0,
        }));
    }

    const distribution: IntervalDistribution[] = ranges.map(range => {
        const count = allMasteries.filter(m => {
            const stability = m.stability || 0;
            return stability >= range.min && stability < range.max;
        }).length;

        return {
            range: range.label,
            count,
            percent: Math.round((count / total) * 100 * 10) / 10,
        };
    });

    return distribution;
}

// ============================================================================
// RECORD ACTIVITY
// ============================================================================

/**
 * Record daily activity after a study session
 */
export async function recordDailyActivity(
    reviewCount: number,
    correctCount: number,
    sessionDuration: number,
    world?: WorldType
): Promise<void> {
    await updateDailyActivityWithSession(reviewCount, correctCount, sessionDuration, world);
}

// ============================================================================
// SUMMARY STATS
// ============================================================================

/**
 * Get summary stats for the stats page header
 */
export async function getSummaryStats(): Promise<{
    totalXP: number;
    currentStreak: number;
    totalReviews: number;
    accuracy: number;
}> {
    const progress = await getUserProgress();
    const activities = await getAllDailyActivity();

    const totalReviews = activities.reduce((sum, a) => sum + a.reviewCount, 0);
    const totalCorrect = activities.reduce((sum, a) => sum + a.correctCount, 0);
    const accuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;

    const { current } = calculateStreak(activities);

    return {
        totalXP: progress.totalXP,
        currentStreak: current,
        totalReviews,
        accuracy,
    };
}

/**
 * Get world-specific progress for the stats page
 */
export async function getWorldProgress(): Promise<Partial<Record<WorldType, {
    reviewed: number;
    correct: number;
    accuracy: number;
}>>> {
    const activities = await getAllDailyActivity();

    const worldStats: Partial<Record<WorldType, { reviewed: number; correct: number; accuracy: number }>> = {};
    const worlds: WorldType[] = ['essentials', 'premium', 'vowels', 'explorer'];

    for (const world of worlds) {
        let reviewed = 0;
        let correct = 0;

        for (const activity of activities) {
            if (activity.worlds[world]) {
                reviewed += activity.worlds[world]!.reviewed;
                correct += activity.worlds[world]!.correct;
            }
        }

        if (reviewed > 0) {
            worldStats[world] = {
                reviewed,
                correct,
                accuracy: Math.round((correct / reviewed) * 100),
            };
        }
    }

    return worldStats;
}
