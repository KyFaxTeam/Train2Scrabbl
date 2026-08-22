import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, BarChart3 } from 'lucide-react';
import type { WorldType, DrawEntry } from '../types/dictionary';
import { getDictionary, getEntriesByWorld, getArenaStats, isArenaInitialized } from '../services/dictionaryService';
import { WorldSelector, WorldBrowser, ArenaStats } from '../components/Arena';
import { getGlobalArenaStats } from '../services/progressService';

const WORLDS: WorldType[] = ['essentials', 'premium', 'vowels', 'morphology', 'explorer'];

const ArenaPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Le monde vit dans l'URL : sans cela un monde ne se partage pas, et un
    // rafraichissement ramene toujours l'ecran de selection.
    const worldParam = searchParams.get('world') as WorldType | null;
    const [selectedWorld, setSelectedWorld] = useState<WorldType | null>(
        worldParam && WORLDS.includes(worldParam) ? worldParam : null
    );
    const [entries, setEntries] = useState<DrawEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Partial<Record<WorldType, number>> | null>(null);
    const [progressStats, setProgressStats] = useState<{
        totalViewed: number;
        totalMastered: number;
        totalBurned: number;
        averageAccuracy: number;
        streakDays: number;
    } | null>(null);

    // Initialize dictionary on mount
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                await getDictionary();

                // Get stats for each world
                const arenaStats = getArenaStats();
                if (arenaStats) {
                    setStats({
                        essentials: 1000, // Top 1000
                        premium: arenaStats.premiumEntries,
                        vowels: arenaStats.totalEntries,
                        morphology: arenaStats.morphologyEntries,
                        explorer: arenaStats.totalEntries
                    });
                }

                // Get progress stats
                const progress = await getGlobalArenaStats();
                setProgressStats(progress);
            } catch (error) {
                console.error('Failed to load dictionary:', error);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, []);

    // Load entries when world is selected
    useEffect(() => {
        if (selectedWorld && isArenaInitialized()) {
            const worldEntries = getEntriesByWorld(selectedWorld);
            setEntries(worldEntries);
        }
    }, [selectedWorld]);

    const handleSelectWorld = (world: WorldType) => {
        setSelectedWorld(world);
        setSearchParams({ world }, { replace: true });
    };

    const handleBack = () => {
        setSelectedWorld(null);
        setEntries([]);
        setSearchParams({}, { replace: true });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-slate-500">Chargement de l arène...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <AnimatePresence mode="wait">
                {!selectedWorld ? (
                    <motion.div
                        key="selector"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex-1"
                    >
                        <div className="p-4 sm:p-6">
                            <div className="text-center mb-6">
                                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
                                    L Arène du Vocabulaire
                                </h1>
                                <p className="text-slate-500">
                                    Choisissez votre monde d exploration
                                </p>

                                {/* Stats Button */}
                                <button
                                    onClick={() => navigate('/arena/stats')}
                                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
                                >
                                    <BarChart3 className="w-4 h-4" />
                                    Mes Statistiques
                                </button>
                            </div>

                            <WorldSelector
                                selectedWorld={selectedWorld}
                                onSelectWorld={handleSelectWorld}
                                stats={stats ?? undefined}
                            />

                            {/* Progress Stats */}
                            {progressStats && stats && (
                                <div className="mt-6 max-w-2xl mx-auto">
                                    <ArenaStats
                                        stats={progressStats}
                                        totalEntries={stats.explorer ?? 0}
                                    />
                                </div>
                            )}

                            {stats && (
                                <div className="mt-6 text-center text-sm text-slate-500">
                                    <p>
                                        {(stats.explorer ?? 0).toLocaleString()} tirages disponibles •{' '}
                                        {(stats.premium ?? 0).toLocaleString()} avec lettres chères •{' '}
                                        {(stats.morphology ?? 0).toLocaleString()} avec un affixe repéré
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="browser"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex-1 flex flex-col overflow-hidden"
                    >
                        <WorldBrowser
                            world={selectedWorld}
                            entries={entries}
                            onBack={handleBack}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ArenaPage;
