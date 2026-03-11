import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLearningStore } from '../store/useLearningStore';
import {
    countByMasteryLevel,
    getDueForReview,
    getUserProgress
} from '../services/learningStore';
import { MasteryLevel, type UserProgress, type WordMastery } from '../types';
import { Star, Flame, Target, Clock, Trophy, Zap, BookOpen, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

// Couleurs cohérentes avec MasteryIndicator
const MASTERY_CONFIG: Record<MasteryLevel, { color: string; bg: string; label: string }> = {
    [MasteryLevel.BURNED]: { color: 'text-purple-600', bg: 'bg-purple-500', label: 'Expert' },
    [MasteryLevel.MASTERED]: { color: 'text-emerald-600', bg: 'bg-emerald-500', label: 'Maîtrisé' },
    [MasteryLevel.REVIEWING]: { color: 'text-orange-600', bg: 'bg-orange-500', label: 'En révision' },
    [MasteryLevel.LEARNING]: { color: 'text-blue-600', bg: 'bg-blue-500', label: 'En cours' },
    [MasteryLevel.EXPOSED]: { color: 'text-amber-600', bg: 'bg-amber-500', label: 'Vu' },
    [MasteryLevel.UNSEEN]: { color: 'text-slate-400', bg: 'bg-slate-300', label: 'Non vu' },
};

const StatsPage: React.FC = () => {
    const navigate = useNavigate();
    const { userProgress: storeProgress } = useLearningStore();

    const [progress, setProgress] = useState<UserProgress | null>(null);
    const [masteryCounts, setMasteryCounts] = useState<Record<MasteryLevel, number> | null>(null);
    const [dueWords, setDueWords] = useState<WordMastery[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setIsLoading(true);
        try {
            const [progressData, counts, due] = await Promise.all([
                getUserProgress(),
                countByMasteryLevel(),
                getDueForReview()
            ]);
            setProgress(progressData);
            setMasteryCounts(counts);
            setDueWords(due);
        } catch (e) {
            console.error('Failed to load stats:', e);
        }
        setIsLoading(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-slate-400">Chargement...</div>
            </div>
        );
    }

    const totalWords = masteryCounts
        ? Object.values(masteryCounts).reduce((a, b) => a + b, 0)
        : 0;

    const masteredWords = masteryCounts
        ? (masteryCounts[MasteryLevel.MASTERED] || 0) + (masteryCounts[MasteryLevel.BURNED] || 0)
        : 0;

    const progressPercent = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;

    return (
        <div className="h-full overflow-y-auto bg-lexis-bg">
            <div className="max-w-2xl mx-auto p-6 space-y-6">

                {/* Header */}
                <div className="text-center pb-2">
                    <h1 className="text-2xl font-bold text-lexis-slate">Statistiques</h1>
                    <p className="text-sm text-slate-500">Votre progression d'apprentissage</p>
                </div>

                {/* Hero Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <StatCard
                        icon={<Star className="w-6 h-6" />}
                        value={progress?.totalXP || 0}
                        label="XP Total"
                        color="emerald"
                    />
                    <StatCard
                        icon={<Flame className="w-6 h-6" />}
                        value={progress?.currentStreak || 0}
                        label={`jour${(progress?.currentStreak || 0) > 1 ? 's' : ''} de streak`}
                        color="amber"
                        sublabel={progress?.longestStreak ? `Record: ${progress.longestStreak}j` : undefined}
                    />
                </div>

                {/* Progress Bar */}
                {totalWords > 0 && (
                    <div className="bg-white rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Target className="w-5 h-5 text-lexis-emerald" />
                                <span className="font-semibold text-slate-700">Progression</span>
                            </div>
                            <span className="text-sm font-bold text-lexis-emerald">{progressPercent}%</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            {masteredWords} / {totalWords} mots maîtrisés
                        </p>
                    </div>
                )}

                {/* Mastery Distribution */}
                {masteryCounts && totalWords > 0 && (
                    <div className="bg-white rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <BookOpen className="w-5 h-5 text-blue-500" />
                            <span className="font-semibold text-slate-700">Distribution</span>
                        </div>
                        <div className="space-y-3">
                            {Object.entries(MASTERY_CONFIG)
                                .filter(([level]) => (masteryCounts[level as MasteryLevel] || 0) > 0)
                                .map(([level, config]) => {
                                    const count = masteryCounts[level as MasteryLevel] || 0;
                                    const percent = Math.round((count / totalWords) * 100);
                                    return (
                                        <div key={level} className="flex items-center gap-3">
                                            <span className={clsx("text-xs font-medium w-20", config.color)}>
                                                {config.label}
                                            </span>
                                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={clsx("h-full rounded-full transition-all", config.bg)}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-slate-500 w-8 text-right">{count}</span>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}

                {/* Due for Review */}
                {dueWords.length > 0 && (
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <Clock className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-700">À réviser</p>
                                    <p className="text-sm text-slate-500">{dueWords.length} mot{dueWords.length > 1 ? 's' : ''} en attente</p>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate('/training')}
                                className="flex items-center gap-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                            >
                                Réviser <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <MiniStatCard
                        icon={<Zap className="w-4 h-4" />}
                        value={progress?.fastAnswers || 0}
                        label="Réponses rapides"
                        color="blue"
                    />
                    <MiniStatCard
                        icon={<Trophy className="w-4 h-4" />}
                        value={progress?.achievements?.length || 0}
                        label="Achievements"
                        color="purple"
                    />
                </div>

                {/* Achievements */}
                {progress?.achievements && progress.achievements.length > 0 && (
                    <div className="bg-white rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Trophy className="w-5 h-5 text-amber-500" />
                            <span className="font-semibold text-slate-700">Achievements</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {progress.achievements.map(a => (
                                <div
                                    key={a.id}
                                    className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-200"
                                    title={a.description}
                                >
                                    <span>{a.icon}</span>
                                    <span className="text-sm font-medium text-slate-700">{a.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {totalWords === 0 && (
                    <div className="text-center py-12">
                        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="font-semibold text-slate-600 mb-2">Pas encore de données</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Explorez le dictionnaire et entraînez-vous pour voir vos statistiques.
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="px-4 py-2 bg-lexis-emerald text-white rounded-lg font-medium hover:bg-lexis-emerald-dark transition-colors"
                        >
                            Explorer le dictionnaire
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

// Composant StatCard
interface StatCardProps {
    icon: React.ReactNode;
    value: number | string;
    label: string;
    color: 'emerald' | 'amber' | 'blue' | 'purple';
    sublabel?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, color, sublabel }) => {
    const colorClasses = {
        emerald: 'text-emerald-600 bg-emerald-50',
        amber: 'text-amber-600 bg-amber-50',
        blue: 'text-blue-600 bg-blue-50',
        purple: 'text-purple-600 bg-purple-50',
    };

    return (
        <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className={clsx("inline-flex p-2 rounded-lg mb-3", colorClasses[color])}>
                {icon}
            </div>
            <div className="text-3xl font-bold text-slate-800">{value}</div>
            <div className="text-sm text-slate-500">{label}</div>
            {sublabel && <div className="text-xs text-slate-400 mt-1">{sublabel}</div>}
        </div>
    );
};

// Composant MiniStatCard
interface MiniStatCardProps {
    icon: React.ReactNode;
    value: number | string;
    label: string;
    color: 'emerald' | 'amber' | 'blue' | 'purple';
}

const MiniStatCard: React.FC<MiniStatCardProps> = ({ icon, value, label, color }) => {
    const colorClasses = {
        emerald: 'text-emerald-600',
        amber: 'text-amber-600',
        blue: 'text-blue-600',
        purple: 'text-purple-600',
    };

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className={clsx("p-2 bg-slate-50 rounded-lg", colorClasses[color])}>
                {icon}
            </div>
            <div>
                <div className="text-xl font-bold text-slate-800">{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
            </div>
        </div>
    );
};

export default StatsPage;
