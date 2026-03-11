import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { DrawEntry, WorldType, StudySession as StudySessionType, StudyRating } from '../../types/dictionary';
import { getDictionary, getEntriesByWorld, getSubcategories, getEntryById } from '../../services/dictionaryService';
import {
    createStudySession,
    createSingleEntrySession,
    getCurrentEntry,
    recordStudyResult,
    isSessionComplete,
    getProgressPercent,
    getSessionStats,
    calculateSessionXP,
} from '../../services/arenaSessionService';
import { recordDailyActivity } from '../../services/statsService';
import StudyCard from './StudyCard';
import SessionComplete from './SessionComplete';

const WORLD_NAMES: Record<WorldType, string> = {
    essentials: 'Les Indispensables',
    premium: 'Lettres Cheres',
    vowels: 'Equilibre Voyelles',
    explorer: 'Exploration',
};

interface StudySessionProps {
    singleEntry?: boolean;
}

export const StudySession: React.FC<StudySessionProps> = ({ singleEntry = false }) => {
    const { world, entryId } = useParams<{ world?: string; entryId?: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<StudySessionType | null>(null);
    const [currentEntry, setCurrentEntry] = useState<DrawEntry | null>(null);
    const [showComplete, setShowComplete] = useState(false);
    const sessionStartTime = useRef<number>(Date.now());

    const subcategory = searchParams.get('subcategory');

    // Initialize session
    useEffect(() => {
        const initSession = async () => {
            setLoading(true);
            try {
                await getDictionary();

                if (singleEntry && entryId) {
                    // Single entry mode
                    const entry = getEntryById(entryId);
                    if (entry) {
                        const newSession = createSingleEntrySession(entry);
                        setSession(newSession);
                        setCurrentEntry(entry);
                    }
                } else if (world) {
                    // World mode
                    const worldType = world as WorldType;
                    let entries: DrawEntry[] = [];

                    if (subcategory) {
                        const subs = getSubcategories(worldType);
                        const sub = subs.find(s => s.id === subcategory);
                        entries = sub?.entries || [];
                    } else {
                        entries = getEntriesByWorld(worldType);
                    }

                    if (entries.length > 0) {
                        const newSession = createStudySession(worldType, entries, subcategory || undefined);
                        setSession(newSession);
                        setCurrentEntry(getCurrentEntry(newSession));
                    }
                }
            } catch (error) {
                console.error('Failed to init study session:', error);
            } finally {
                setLoading(false);
            }
        };

        initSession();
    }, [world, entryId, subcategory, singleEntry]);

    const handleRate = async (rating: StudyRating) => {
        if (!session) return;

        const responseTimeMs = Date.now() - (session.startedAt + session.results.length * 5000); // approximation
        const updatedSession = recordStudyResult(session, rating, responseTimeMs);
        setSession(updatedSession);

        if (isSessionComplete(updatedSession)) {
            // Record activity to stats
            const stats = getSessionStats(updatedSession);
            const sessionDuration = Math.round((Date.now() - sessionStartTime.current) / 1000);
            const correctCount = stats.good + stats.easy;

            try {
                await recordDailyActivity(
                    stats.total,
                    correctCount,
                    sessionDuration,
                    world as WorldType
                );
            } catch (error) {
                console.error('Failed to record daily activity:', error);
            }

            setShowComplete(true);
            setCurrentEntry(null);
        } else {
            setCurrentEntry(getCurrentEntry(updatedSession));
        }
    };

    const handleContinue = () => {
        // Restart session with same parameters
        if (world) {
            navigate(0); // Reload page
        }
    };

    const handleBackToArena = () => {
        navigate('/arena');
    };

    const progress = session ? getProgressPercent(session) : 0;
    const stats = session ? getSessionStats(session) : null;
    const xpEarned = stats ? calculateSessionXP(stats) : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-slate-500">Chargement de la session...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6">
                <p className="text-slate-500 mb-4">Session non trouvee</p>
                <button
                    onClick={handleBackToArena}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour a l Arene
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleBackToArena}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div>
                            <h1 className="font-semibold text-slate-800">
                                Mode Etude
                            </h1>
                            <p className="text-xs text-slate-500">
                                {world ? WORLD_NAMES[world as WorldType] : 'Session'}
                            </p>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-sm font-medium text-slate-800">
                            {session.currentIndex + 1} / {session.entries.length}
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                <AnimatePresence mode="wait">
                    {showComplete && stats ? (
                        <SessionComplete
                            key="complete"
                            stats={stats}
                            xpEarned={xpEarned}
                            world={world as WorldType}
                            onContinue={handleContinue}
                            onBackToArena={handleBackToArena}
                        />
                    ) : currentEntry ? (
                        <motion.div
                            key={currentEntry.id}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.2 }}
                            className="w-full"
                        >
                            <StudyCard
                                entry={currentEntry}
                                onRate={handleRate}
                            />
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default StudySession;
