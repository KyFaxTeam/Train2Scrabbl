import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Target, Clock, Zap, ArrowLeft, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import confetti from 'canvas-confetti';
import type { SessionStats, WorldType } from '../../types/dictionary';
import { WORLD_NAMES } from '../../config/worlds';

interface SessionCompleteProps {
    stats: SessionStats;
    xpEarned: number;
    world: WorldType;
    onContinue: () => void;
    onBackToArena: () => void;
}

export const SessionComplete: React.FC<SessionCompleteProps> = ({
    stats,
    xpEarned,
    world,
    onContinue,
    onBackToArena,
}) => {
    // Celebrer si bon score
    useEffect(() => {
        if (stats.accuracy >= 70) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
            });
        }
    }, [stats.accuracy]);

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[400px] p-6"
        >
            {/* Header */}
            <motion.div
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                className="text-center mb-8"
            >
                <div className="text-5xl mb-4">
                    {stats.accuracy >= 80 ? '' : stats.accuracy >= 60 ? '' : ''}
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                    Session terminee !
                </h2>
                <p className="text-slate-500">
                    {WORLD_NAMES[world]}
                </p>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-xl p-4 shadow-md border border-slate-100"
                >
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Target className="w-4 h-4" />
                        <span className="text-xs">Tirages</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        {stats.total}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className={clsx(
                        "rounded-xl p-4 shadow-md border",
                        stats.accuracy >= 70
                            ? "bg-green-50 border-green-200"
                            : "bg-white border-slate-100"
                    )}
                >
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Trophy className="w-4 h-4" />
                        <span className="text-xs">Precision</span>
                    </div>
                    <div className={clsx(
                        "text-2xl font-bold",
                        stats.accuracy >= 70 ? "text-green-600" : "text-slate-800"
                    )}>
                        {stats.accuracy}%
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-xl p-4 shadow-md border border-slate-100"
                >
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs">Temps moyen</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        {formatTime(stats.averageTimeMs)}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-amber-50 rounded-xl p-4 shadow-md border border-amber-200"
                >
                    <div className="flex items-center gap-2 text-amber-600 mb-1">
                        <Zap className="w-4 h-4" />
                        <span className="text-xs">XP gagnes</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-600">
                        +{xpEarned}
                    </div>
                </motion.div>
            </div>

            {/* Rating breakdown */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex gap-4 mb-8 text-sm"
            >
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                    <span className="text-slate-600">{stats.again} rates</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-orange-400 rounded-full"></span>
                    <span className="text-slate-600">{stats.hard} difficiles</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                    <span className="text-slate-600">{stats.good} bien</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-400 rounded-full"></span>
                    <span className="text-slate-600">{stats.easy} faciles</span>
                </div>
            </motion.div>

            {/* Actions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex gap-3"
            >
                <button
                    onClick={onBackToArena}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour a l Arene
                </button>
                <button
                    onClick={onContinue}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/25"
                >
                    <RotateCcw className="w-4 h-4" />
                    Continuer
                </button>
            </motion.div>
        </motion.div>
    );
};

export default SessionComplete;
