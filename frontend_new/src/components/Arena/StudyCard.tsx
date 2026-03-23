import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Minus, AlertCircle, ChevronLeft, Flag } from 'lucide-react';
import { clsx } from 'clsx';
import type { DrawEntry } from '../../types/dictionary';
import type { ReviewRating } from '../../types/learning';
import Tile from '../Tile';
import TagsDisplay from './TagsDisplay';
import RatingButtons from '../Learning/RatingButtons';
import { useLearningStore } from '../../store/useLearningStore';

interface StudyCardProps {
    entry: DrawEntry;
    onRate: (rating: ReviewRating) => void;
    showTags?: boolean;
    autoExpand?: boolean;
}

const ITEMS_PER_PAGE = 6;

export const StudyCard: React.FC<StudyCardProps> = ({
    entry,
    onRate,
    showTags = true,
    autoExpand = false
}) => {
    const [expanded, setExpanded] = useState(autoExpand);
    const [page, setPage] = useState(0);
    const [viewedPages, setViewedPages] = useState<Set<number>>(new Set());
    const [showWarning, setShowWarning] = useState(false);
    const [pendingRating, setPendingRating] = useState<ReviewRating | null>(null);

    const trackExtensionView = useLearningStore(state => state.trackExtensionView);
    const hasTracked = useRef(new Set<number>());

    const totalPages = Math.ceil(entry.extensions.length / ITEMS_PER_PAGE);

    useEffect(() => {
        if (!expanded || entry.extensions.length === 0) return;
        
        if (!hasTracked.current.has(page)) {
            const pageExtensions = entry.extensions.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
            pageExtensions.forEach(ext => {
                trackExtensionView(entry.draw, ext.letter, ext.word);
            });
            hasTracked.current.add(page);
            setViewedPages(prev => new Set(prev).add(page));
            setShowWarning(false);
        }
    }, [expanded, page, entry.extensions, entry.draw, trackExtensionView]);

    const handleNextPage = () => {
        if (page < totalPages - 1) setPage(p => p + 1);
    };

    const handlePrevPage = () => {
        if (page > 0) setPage(p => p - 1);
    };

    const handleRateClick = (rating: ReviewRating) => {
        if (entry.extensions.length > 0 && viewedPages.size < totalPages) {
            setPendingRating(rating);
            setShowWarning(true);
            return;
        }
        onRate(rating);
    };

    const confirmRating = () => {
        if (pendingRating) {
            onRate(pendingRating);
            setPendingRating(null);
            setShowWarning(false);
        }
    };

    // Calculate progress
    const viewedCount = Math.min((viewedPages.size) * ITEMS_PER_PAGE, entry.extensions.length);
    const progressPercent = entry.extensions.length > 0 
        ? Math.round((viewedCount / entry.extensions.length) * 100)
        : 100;

    const currentExtensions = entry.extensions.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full h-[85vh] sm:h-auto sm:min-h-[500px]">
            {/* Header / Drawing */}
            <div 
                className="p-5 bg-gradient-to-br from-indigo-900 to-indigo-800 text-white cursor-pointer relative"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex flex-col items-center justify-center gap-4">
                    <div className="flex gap-1.5 p-3 bg-white/10 rounded-xl backdrop-blur-sm -mx-2">
                        {entry.draw.split('').map((char, i) => (
                            <Tile key={i} letter={char} size="md" />
                        ))}
                    </div>
                    {showTags && entry.tags && (
                        <div className="flex justify-center -mt-1 -mb-1 scale-110">
                            <TagsDisplay tags={entry.tags} variant="compact" />
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 flex flex-col gap-4">
                <AnimatePresence mode="popLayout">
                    {!expanded ? (
                        <motion.div
                            key="collapsed"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3"
                        >
                            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                                <Flag className="w-5 h-5 text-slate-300" />
                            </div>
                            <span className="text-sm font-medium">Touchez pour révéler les solutions</span>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="expanded"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col gap-6"
                        >
                            {/* Warning Prompt (if shown) */}
                            {showWarning && pendingRating && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800"
                                >
                                    <div className="flex gap-2 mb-2">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-500" />
                                        <p className="text-sm font-medium">
                                            Vous n'avez pas vu toutes les extensions !
                                        </p>
                                    </div>
                                    <p className="text-sm mb-3">
                                        Il reste {entry.extensions.length - viewedCount} mots à découvrir. 
                                        Vous pouvez continuer à les lire ou ignorer et passer si vous les connaissez tous.
                                    </p>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setShowWarning(false)}
                                            className="flex-1 py-1.5 px-3 bg-amber-200 text-amber-900 rounded-md text-sm font-medium hover:bg-amber-300 transition-colors"
                                        >
                                            Continuer à lire
                                        </button>
                                        <button 
                                            onClick={confirmRating}
                                            className="flex-1 py-1.5 px-3 border border-amber-300 text-amber-800 rounded-md text-sm font-medium hover:bg-amber-100 transition-colors"
                                        >
                                            Ignorer et passer
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                            
                            {/* Base Words (Scrabbles) */}
                            {entry.solutions.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900 mb-2.5 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                        L'avant (Scrabbles 7 lettres)
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs ml-auto">
                                            {entry.solutions.length}
                                        </span>
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {entry.solutions.map((word, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-2 p-2.5 bg-red-50 text-red-900 rounded-lg border border-red-100/50 shadow-sm"
                                            >
                                                <span className="font-bold text-lg tracking-wide">{word}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Extensions (+1) */}
                            {entry.extensions.length > 0 && (
                                <div className="flex-1 flex flex-col">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                            L'après (Extensions +1)
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs ml-auto">
                                                {entry.extensions.length}
                                            </span>
                                        </h3>
                                    </div>

                                    {/* Pagination indicator */}
                                    {totalPages > 1 && (
                                        <div className="mb-3">
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1.5">
                                                <div 
                                                    className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300"
                                                    style={{ width: `${progressPercent}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between text-xs text-slate-500 font-medium">
                                                <span>{viewedCount} extensions vues</span>
                                                <span>{progressPercent}%</span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-2 gap-2 flex-grow auto-rows-max">
                                        {currentExtensions.map((ext, i) => (
                                            <motion.div
                                                key={`${page}-${i}`}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="flex items-center bg-emerald-50 rounded-lg border border-emerald-100 shadow-sm overflow-hidden"
                                            >
                                                <div className="flex items-center justify-center bg-emerald-100 text-emerald-700 font-bold px-3 py-2.5 text-lg w-10 shrink-0">
                                                    {ext.letter}
                                                </div>
                                                <div className="px-3 py-2 text-emerald-900 font-medium truncate flex-1">
                                                    {ext.word}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                    
                                    {/* Advanced Pagination UI */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between mt-4 bg-slate-50 rounded-lg p-1 border border-slate-100">
                                            <button
                                                onClick={handlePrevPage}
                                                disabled={page === 0}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all text-slate-600 font-medium text-sm"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                <span>Préc.</span>
                                            </button>
                                            
                                            <div className="text-sm font-semibold text-slate-500 bg-white px-3 py-1 rounded-md shadow-sm border border-slate-100">
                                                {page + 1} / {totalPages}
                                            </div>
                                            
                                            <button
                                                onClick={handleNextPage}
                                                disabled={page >= totalPages - 1}
                                                className={clsx(
                                                    "flex items-center gap-1.5 px-3 py-2 rounded-md transition-all font-medium text-sm",
                                                    page < totalPages - 1 
                                                        ? "text-emerald-700 bg-white shadow-sm hover:ring-2 hover:ring-emerald-100 text-emerald-600" 
                                                        : "text-slate-400 opacity-30"
                                                )}
                                            >
                                                <span>Suiv.</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Rating Action Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
                {!expanded ? (
                    <button
                        onClick={() => setExpanded(true)}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm transition-all focus:ring-4 focus:ring-indigo-100 outline-none"
                    >
                        Révéler les solutions
                    </button>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                            Évaluez votre rappel
                        </div>
                        <div className="w-full max-w-sm mx-auto">
                            <RatingButtons onRate={handleRateClick} className="w-full justify-between" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudyCard;
