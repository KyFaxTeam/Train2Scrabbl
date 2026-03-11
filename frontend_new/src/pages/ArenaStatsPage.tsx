/**
 * StatsPage - Main statistics dashboard for the Arena
 * 
 * Displays:
 * - Summary stats cards (streak, XP, reviews, accuracy)
 * - Activity heatmap (365 days)
 * - Forecast chart (30 days)
 * - Retention stats
 * - Interval distribution
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Flame,
    Zap,
    Target,
    BookOpen,
    Loader2,
    BarChart3,
    TrendingUp
} from 'lucide-react';
import type {
    HeatmapData,
    FutureDueData,
    RetentionStats,
    IntervalDistribution
} from '../types/dictionary';
import {
    getHeatmapData,
    getFutureDue,
    getRetentionStats,
    getIntervalDistribution,
    getSummaryStats
} from '../services/statsService';
import ActivityHeatmap from '../components/Arena/ActivityHeatmap';
import ForecastChart from '../components/Arena/ForecastChart';
import RetentionCard from '../components/Arena/RetentionCard';

interface SummaryStats {
    totalXP: number;
    currentStreak: number;
    totalReviews: number;
    accuracy: number;
}

const StatsPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
    const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
    const [futureDue, setFutureDue] = useState<FutureDueData[]>([]);
    const [retentionStats, setRetentionStats] = useState<RetentionStats | null>(null);
    const [intervalDist, setIntervalDist] = useState<IntervalDistribution[]>([]);

    useEffect(() => {
        const loadStats = async () => {
            setLoading(true);
            try {
                const [summary, heatmap, forecast, retention, intervals] = await Promise.all([
                    getSummaryStats(),
                    getHeatmapData(),
                    getFutureDue(30),
                    getRetentionStats(),
                    getIntervalDistribution(),
                ]);

                setSummaryStats(summary);
                setHeatmapData(heatmap);
                setFutureDue(forecast);
                setRetentionStats(retention);
                setIntervalDist(intervals);
            } catch (error) {
                console.error('Failed to load stats:', error);
            } finally {
                setLoading(false);
            }
        };

        loadStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-slate-500">Chargement des statistiques...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-slate-50">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/arena')}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-500" />
                        <h1 className="text-xl font-bold text-slate-800">
                            Mes Statistiques
                        </h1>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0 }}
                        className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-4 text-white"
                    >
                        <Flame className="w-5 h-5 mb-2 opacity-80" />
                        <div className="text-2xl font-bold">
                            {summaryStats?.currentStreak || 0}
                        </div>
                        <div className="text-sm opacity-80">jours de streak</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-4 text-white"
                    >
                        <Zap className="w-5 h-5 mb-2 opacity-80" />
                        <div className="text-2xl font-bold">
                            {summaryStats?.totalXP?.toLocaleString() || 0}
                        </div>
                        <div className="text-sm opacity-80">XP total</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-4 text-white"
                    >
                        <Target className="w-5 h-5 mb-2 opacity-80" />
                        <div className="text-2xl font-bold">
                            {summaryStats?.accuracy || 0}%
                        </div>
                        <div className="text-sm opacity-80">précision</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-4 text-white"
                    >
                        <BookOpen className="w-5 h-5 mb-2 opacity-80" />
                        <div className="text-2xl font-bold">
                            {summaryStats?.totalReviews?.toLocaleString() || 0}
                        </div>
                        <div className="text-sm opacity-80">révisions</div>
                    </motion.div>
                </div>

                {/* Heatmap */}
                {heatmapData && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <ActivityHeatmap
                            data={heatmapData.dailyActivity}
                            currentStreak={heatmapData.currentStreak}
                            longestStreak={heatmapData.longestStreak}
                        />
                    </motion.div>
                )}

                {/* Forecast Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <ForecastChart data={futureDue} daysToShow={14} />
                </motion.div>

                {/* Retention + Interval Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Retention Card */}
                    {retentionStats && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                        >
                            <RetentionCard stats={retentionStats} />
                        </motion.div>
                    )}

                    {/* Interval Distribution */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="bg-white rounded-xl p-4 shadow-sm border border-slate-200"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-lg font-semibold text-slate-800">
                                Distribution des Intervalles
                            </h3>
                        </div>

                        <div className="space-y-3">
                            {intervalDist.map((item, index) => (
                                <div key={item.range}>
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="text-slate-600">{item.range}</span>
                                        <span className="text-slate-800 font-medium">
                                            {item.count} ({item.percent}%)
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-indigo-500"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${item.percent}%` }}
                                            transition={{ duration: 0.5, delay: 0.1 * index }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {intervalDist.every(d => d.count === 0) && (
                            <p className="text-sm text-slate-500 text-center mt-4">
                                Pas encore de données de révision
                            </p>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default StatsPage;
