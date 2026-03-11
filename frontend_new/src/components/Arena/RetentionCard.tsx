/**
 * RetentionCard - Display retention statistics
 * 
 * Shows overall, mature, and young retention rates
 */

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Brain, GraduationCap, Sprout } from 'lucide-react';
import type { RetentionStats } from '../../types/dictionary';

interface RetentionCardProps {
    stats: RetentionStats;
}

const getRetentionColor = (rate: number): string => {
    if (rate >= 75) return 'text-emerald-500';
    if (rate >= 60) return 'text-amber-500';
    return 'text-red-500';
};

const getRetentionBgColor = (rate: number): string => {
    if (rate >= 75) return 'bg-emerald-500';
    if (rate >= 60) return 'bg-amber-500';
    return 'bg-red-500';
};

const getRetentionLabel = (rate: number): string => {
    if (rate >= 90) return 'Excellent';
    if (rate >= 75) return 'Très bien';
    if (rate >= 60) return 'Bien';
    if (rate >= 40) return 'Moyen';
    return 'À améliorer';
};

export const RetentionCard: React.FC<RetentionCardProps> = ({ stats }) => {
    const { overallRetention, matureRetention, youngRetention } = stats;

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold text-slate-800">
                    Taux de Rétention
                </h3>
            </div>

            {/* Main retention rate */}
            <div className="text-center mb-6">
                <div className={`text-5xl font-bold ${getRetentionColor(overallRetention)}`}>
                    {overallRetention > 0 ? `${overallRetention}%` : '-'}
                </div>
                <p className="text-sm text-slate-500 mt-1">
                    {overallRetention > 0 ? getRetentionLabel(overallRetention) : 'Pas encore de données'}
                </p>
            </div>

            {/* Mature vs Young */}
            <div className="space-y-4">
                {/* Mature retention */}
                <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-blue-500" />
                            <span className="text-slate-600">Cartes matures</span>
                            <span className="text-xs text-slate-400">(intervalle &gt; 21j)</span>
                        </div>
                        <span className={`font-medium ${getRetentionColor(matureRetention)}`}>
                            {matureRetention > 0 ? `${matureRetention}%` : '-'}
                        </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                            className={`h-full ${getRetentionBgColor(matureRetention)}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${matureRetention}%` }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        />
                    </div>
                </div>

                {/* Young retention */}
                <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                            <Sprout className="w-4 h-4 text-emerald-500" />
                            <span className="text-slate-600">Cartes jeunes</span>
                            <span className="text-xs text-slate-400">(intervalle ≤ 21j)</span>
                        </div>
                        <span className={`font-medium ${getRetentionColor(youngRetention)}`}>
                            {youngRetention > 0 ? `${youngRetention}%` : '-'}
                        </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                            className={`h-full ${getRetentionBgColor(youngRetention)}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${youngRetention}%` }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        />
                    </div>
                </div>
            </div>

            {/* Insight */}
            <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                    {matureRetention > youngRetention ? (
                        <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                            Vos cartes matures sont bien mémorisées. Continuez !
                        </span>
                    ) : youngRetention > 0 ? (
                        <span className="flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-amber-500" />
                            Les nouvelles cartes demandent plus de révisions.
                        </span>
                    ) : (
                        <span className="flex items-center gap-1">
                            <Minus className="w-3 h-3 text-slate-400" />
                            Commencez à réviser pour voir vos statistiques !
                        </span>
                    )}
                </p>
            </div>
        </div>
    );
};

export default RetentionCard;
