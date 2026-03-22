import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Eye, CheckCircle, Flame, Target } from 'lucide-react';
import type { WorldProgress } from '../../services/progressService';

interface WorldProgressBarProps {
    progress: WorldProgress | null;
    isLoading?: boolean;
}

export const WorldProgressBar: React.FC<WorldProgressBarProps> = ({
    progress,
    isLoading = false
}) => {
    if (isLoading) {
        return (
            <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-b border-slate-200 animate-pulse">
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-2 flex-1 bg-slate-200 rounded-full" />
            </div>
        );
    }

    if (!progress) return null;

    return (
        <div className="px-4 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
            <div className="flex items-center gap-4">
                {/* Stats rapides */}
                <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 text-blue-600">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{progress.viewedEntries}</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{progress.masteredEntries}</span>
                    </div>
                    {progress.burnedEntries > 0 && (
                        <div className="flex items-center gap-1 text-purple-600">
                            <Flame className="w-3.5 h-3.5" />
                            <span>{progress.burnedEntries}</span>
                        </div>
                    )}
                    {progress.averageAccuracy > 0 && (
                        <div className="flex items-center gap-1 text-amber-600">
                            <Target className="w-3.5 h-3.5" />
                            <span>{progress.averageAccuracy}%</span>
                        </div>
                    )}
                </div>

                {/* Barre de progression */}
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.percentMastered}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                    />
                </div>

                {/* Pourcentage */}
                <span className="text-xs font-medium text-slate-600 min-w-[3rem] text-right">
                    {progress.percentMastered}%
                </span>
            </div>
        </div>
    );
};

interface WorldProgressCardProps {
    progress: WorldProgress;
    worldName: string;
    worldColor: string;
}

export const WorldProgressCard: React.FC<WorldProgressCardProps> = ({
    progress,
    worldName,
    worldColor
}) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <h3 className={clsx("font-semibold", worldColor)}>{worldName}</h3>
                <span className="text-sm text-slate-500">
                    {progress.masteredEntries}/{progress.totalEntries}
                </span>
            </div>

            {/* Barre de progression */}
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.percentMastered}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                />
            </div>

            {/* Stats détaillées */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-blue-50 rounded-lg p-2">
                    <div className="font-semibold text-blue-700">{progress.viewedEntries}</div>
                    <div className="text-blue-500">Vus</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2">
                    <div className="font-semibold text-emerald-700">{progress.masteredEntries}</div>
                    <div className="text-emerald-500">Maîtrisés</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2">
                    <div className="font-semibold text-amber-700">{progress.averageAccuracy}%</div>
                    <div className="text-amber-500">Précision</div>
                </div>
            </div>
        </div>
    );
};

export default WorldProgressBar;
