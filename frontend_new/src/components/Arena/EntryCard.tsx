import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Minus, ChevronLeft, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import type { DrawEntry } from '../../types/dictionary';
import Tile from '../Tile';
import TagsDisplay from './TagsDisplay';
import { useLearningStore } from '../../store/useLearningStore';

interface EntryCardProps {
    entry: DrawEntry;
    showTags?: boolean;
    isHighlighted?: boolean;
}

const ITEMS_PER_PAGE = 6;

export const EntryCard: React.FC<EntryCardProps> = ({
    entry,
    showTags = true,
    isHighlighted = false
}) => {
    const [expanded, setExpanded] = useState(false);
    const [page, setPage] = useState(0);
    const [viewedPages, setViewedPages] = useState<Set<number>>(new Set());
    const [showWarning, setShowWarning] = useState(false);
    
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
        }
    }, [expanded, page, entry.extensions, entry.draw, trackExtensionView]);

    const handleToggle = () => {
        if (expanded && entry.extensions.length > 0) {
            // Check if they saw all pages
            if (viewedPages.size < totalPages) {
                if (!showWarning) {
                    setShowWarning(true);
                    return; // Prevent closing
                }
            }
        }
        setShowWarning(false);
        setExpanded(!expanded);
    };

    const handleNextPage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (page < totalPages - 1) setPage(p => p + 1);
        setShowWarning(false);
    };

    const handlePrevPage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (page > 0) setPage(p => p - 1);
        setShowWarning(false);
    };

    // Calculate progress
    const viewedCount = Math.min((viewedPages.size) * ITEMS_PER_PAGE, entry.extensions.length);
    const progressPercent = entry.extensions.length > 0 
        ? Math.round((viewedCount / entry.extensions.length) * 100)
        : 100;

    const currentExtensions = entry.extensions.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

    return (
        <div
            className={clsx(
                "bg-white border rounded-lg transition-all",
                isHighlighted
                    ? "border-amber-400 ring-2 ring-amber-200 shadow-lg"
                    : "border-slate-200 hover:border-slate-300",
                expanded ? "shadow-md" : "shadow-sm"
            )}
        >
            <div
                onClick={handleToggle}
                className="p-3 cursor-pointer"
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Tiles */}
                        <div className="flex gap-0.5 flex-shrink-0">
                            {entry.draw.split('').map((char, i) => (
                                <Tile key={i} letter={char} size="xs" />
                            ))}
                        </div>
                        
                        {/* Base words preview */}
                        {entry.solutions.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
                                <Minus className="w-3 h-3 text-red-400 flex-shrink-0" />
                                <span className="font-medium truncate">{entry.solutions[0]}</span>
                                {entry.solutions.length > 1 && (
                                    <span className="text-slate-400 flex-shrink-0">
                                        +{entry.solutions.length - 1}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Tags compact */}
                        {showTags && entry.tags && (
                            <TagsDisplay tags={entry.tags} variant="compact" />
                        )}
                        
                        <ChevronRight
                            className={clsx(
                                "w-4 h-4 text-slate-400 transition-transform",
                                expanded && "rotate-90"
                            )}
                        />
                    </div>
                </div>
                
                {/* Warning tooltip */}
                <AnimatePresence>
                    {showWarning && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2"
                        >
                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-800">
                                <p className="font-medium mb-1">Attention vous n'avez pas tout terminé !</p>
                                <p>Il vous reste <strong>{entry.extensions.length - viewedCount}</strong> mots à apprendre pour ce tirage. Quitter sans voir toutes les extensions signifierait que vous ne les avez pas apprises dans vos statistiques. Préférez-vous y retourner pour terminer ? Cliquez à nouveau sur l'en-tête pour quitter tout de même.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 pt-0 border-t border-slate-100">
                            {/* Full tags display */}
                            {entry.tags && (
                                <TagsDisplay tags={entry.tags} variant="full" className="mt-3" />
                            )}
                            
                            {/* Solutions (7 letters - scrabbles) */}
                            {entry.solutions.length > 0 && (
                                <div className="mt-3">
                                    <h4 className="text-xs font-medium text-slate-500 mb-1.5 flex justify-between">
                                        <span>Scrabbles ({entry.solutions.length})</span>
                                    </h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {entry.solutions.map((word, i) => (
                                            <span
                                                key={i}
                                                className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-sm font-medium"
                                            >
                                                {word}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Extensions */}
                            {entry.extensions.length > 0 && (
                                <div className="mt-3">
                                    <h4 className="text-xs font-medium text-slate-500 mb-1.5 flex justify-between items-center">
                                        <span>Extensions +1 ({entry.extensions.length})</span>
                                        {totalPages > 1 && (
                                            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                                                {progressPercent}% vu{progressPercent === 100 ? ' ✅' : ''}
                                            </span>
                                        )}
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 min-h-[60px]">
                                        {currentExtensions.map((ext, i) => (
                                            <motion.div
                                                key={`${page}-${i}`}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ duration: 0.2, delay: i * 0.05 }}
                                                className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-50 rounded text-sm"
                                            >
                                                <span className="font-bold text-emerald-600">
                                                    +{ext.letter}
                                                </span>
                                                <span className="text-emerald-800 font-medium truncate">
                                                    {ext.word}
                                                </span>
                                            </motion.div>
                                        ))}
                                    </div>
                                    
                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                                            <div className="text-xs font-medium text-slate-400">
                                                Page {page + 1} sur {totalPages}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={handlePrevPage}
                                                    disabled={page === 0}
                                                    className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                                    aria-label="Extensions précédentes"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={handleNextPage}
                                                    disabled={page >= totalPages - 1}
                                                    className={clsx(
                                                        "p-1.5 flex items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-emerald-200",
                                                        page < totalPages - 1 
                                                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 shadow-sm" 
                                                            : "text-slate-400 opacity-30 cursor-not-allowed"
                                                    )}
                                                    aria-label="Extensions suivantes"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default EntryCard;
