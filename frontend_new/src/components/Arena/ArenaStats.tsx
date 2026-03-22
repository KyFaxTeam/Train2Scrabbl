import React from 'react';
import { motion } from 'framer-motion';
import { Eye, CheckCircle, Flame, Target, Zap, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';

interface ArenaStatsProps {
    stats: {
        totalViewed: number;
        totalMastered: number;
        totalBurned: number;
        averageAccuracy: number;
        streakDays: number;
    } | null;
    totalEntries: number;
}

export const ArenaStats: React.FC<ArenaStatsProps> = ({ stats, totalEntries }) => {
    if (!stats) return null;
    
    const percentViewed = Math.round((stats.totalViewed / Math.max(totalEntries, 1)) * 100);
    const percentMastered = Math.round((stats.totalMastered / Math.max(totalEntries, 1)) * 100);
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        >
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-blue-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-semibold text-slate-800">Ma Progression</h3>
                </div>
            </div>
            
            <div className="p-4">
                {/* Barre de progression globale */}
                <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">Progression globale</span>
                        <span className="font-medium text-emerald-600">{percentMastered}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full flex">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentMastered}%` }}
                                transition={{ duration: 0.8 }}
                                className="bg-emerald-500"
                            />
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(0, percentViewed - percentMastered)}%` }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                                className="bg-blue-300"
                            />
                        </div>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Maîtrisé
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-300" />
                            En cours
                        </span>
                    </div>
                </div>
                
                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                        icon={<Eye className="w-4 h-4" />}
                        value={stats.totalViewed}
                        label="Vus"
                        color="blue"
                    />
                    <StatCard
                        icon={<CheckCircle className="w-4 h-4" />}
                        value={stats.totalMastered}
                        label="Maîtrisés"
                        color="emerald"
                    />
                    <StatCard
                        icon={<Target className="w-4 h-4" />}
                        value={`${stats.averageAccuracy}%`}
                        label="Précision"
                        color="amber"
                    />
                    <StatCard
                        icon={<Flame className="w-4 h-4" />}
                        value={stats.totalBurned}
                        label="Experts"
                        color="purple"
                    />
                </div>
                
                {/* Streak */}
                {stats.streakDays > 0 && (
                    <div className="mt-4 flex items-center justify-center gap-2 p-2 bg-amber-50 rounded-lg">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium text-amber-700">
                            {stats.streakDays} jours consécutifs
                        </span>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

interface StatCardProps {
    icon: React.ReactNode;
    value: number | string;
    label: string;
    color: 'blue' | 'emerald' | 'amber' | 'purple';
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, color }) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        purple: 'bg-purple-50 text-purple-600',
    };
    
    return (
        <div className={clsx("rounded-lg p-3 text-center", colors[color])}>
            <div className="flex justify-center mb-1">{icon}</div>
            <div className="text-lg font-bold">{value}</div>
            <div className="text-xs opacity-80">{label}</div>
        </div>
    );
};

export default ArenaStats;
