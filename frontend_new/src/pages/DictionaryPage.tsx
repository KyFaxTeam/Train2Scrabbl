import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronRight, ChevronLeft, ChevronDown, BookOpen, Minus, CheckCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { searchDictionary, findCategoryByDraw, getAvailableFirstLetters, getCategoriesByFirstLetter } from '../services/dictionaryService';
import { useReadingPosition } from '../hooks/useReadingPosition';
import type { DrawEntry, DictionaryCategory } from '../types/dictionary';
import type { WordMastery } from '../types/learning';
import Tile from '../components/Tile';
import { useLearningStore } from '../store/useLearningStore';
import { getWordMastery } from '../services/learningStore';
import { MasteryIndicator, MasteryIndicatorEmpty } from '../components/Learning';

const ITEMS_PER_PAGE = 6;

const EntryRow: React.FC<{ entry: DrawEntry; isHighlighted?: boolean; isExpanded: boolean; onToggle: () => void }> = ({ entry, isHighlighted, isExpanded, onToggle }) => {
    const [masteries, setMasteries] = useState<Map<string, WordMastery>>(new Map());
    const trackExtensionView = useLearningStore(state => state.trackExtensionView);
    const [hasBeenViewed, setHasBeenViewed] = useState(false);
    
    // Pagination & Warning state
    const [page, setPage] = useState(0);
    const [viewedPages, setViewedPages] = useState<Set<number>>(new Set());
    const [showWarning, setShowWarning] = useState(false);
    
    const hasTracked = useRef(new Set<number>());

    const totalPages = Math.ceil(entry.extensions.length / ITEMS_PER_PAGE);

    // Initial check to see if any extensions are learned to render it visually "green" initially
    useEffect(() => {
        let isMounted = true;
        const checkInitialMastery = async () => {
            if (!entry.extensions || entry.extensions.length === 0) return;
            for (const ext of entry.extensions) {
                const wordId = `${entry.draw}-${ext.letter}-${ext.word}`;
                const m = await getWordMastery(wordId);
                if (m && isMounted) {
                    setHasBeenViewed(true);
                    break;
                }
            }
        };
        checkInitialMastery();
        return () => { isMounted = false; };
    }, [entry]);

    // Track views and load masteries when expanded and page changes
    useEffect(() => {
        if (isExpanded && entry.extensions.length > 0) {
            if (!hasTracked.current.has(page)) {
                const pageExtensions = entry.extensions.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
                
                // Track extension views for current page
                pageExtensions.forEach(ext => {
                    trackExtensionView(entry.draw, ext.letter, ext.word);
                });
                hasTracked.current.add(page);
                setViewedPages(prev => new Set(prev).add(page));
                setHasBeenViewed(true); // Mark as initially viewed

                // Load masteries for display
                let isMounted = true;
                const loadMasteries = async () => {
                    const map = new Map<string, WordMastery>();
                    for (const ext of pageExtensions) {
                        const wordId = `${entry.draw}-${ext.letter}-${ext.word}`;
                        const mastery = await getWordMastery(wordId);
                        if (mastery && isMounted) {
                            map.set(wordId, mastery);
                        }
                    }
                    if (isMounted) setMasteries(prev => new Map([...prev, ...map]));
                };
                loadMasteries();
                return () => { isMounted = false; };
            }
        }

        // Reset tracking states when completely collapsed?
        // Actually, maybe preserve them so scrolling back maintains state.
        if (!isExpanded) {
            setShowWarning(false);
        }
    }, [isExpanded, page, entry.draw, entry.extensions, trackExtensionView]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isExpanded && entry.extensions.length > 0) {
            if (viewedPages.size < totalPages) {
                if (!showWarning) {
                    setShowWarning(true);
                    return; // Prevent closing
                }
            }
        }
        setShowWarning(false);
        onToggle();
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
    const viewedCount = Math.min(viewedPages.size * ITEMS_PER_PAGE, entry.extensions.length);
    const progressPercent = entry.extensions.length > 0 
        ? Math.round((viewedCount / entry.extensions.length) * 100)
        : 100;

    const currentExtensions = entry.extensions.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

    return (
        <div
            id={`entry-${entry.id}`}
            className={clsx(
                "border rounded-lg transition-all mb-2",
                isHighlighted ? "border-lexis-gold ring-2 ring-lexis-gold/50 shadow-lg bg-white" :
                    (hasBeenViewed && !isExpanded) ? "border-green-300 bg-green-50/40" : "bg-white border-slate-200 hover:border-scrabble-green/30",
                isExpanded ? "shadow-md" : "shadow-sm"
            )}
        >
            <div
                onClick={handleToggle}
                className="p-2 sm:p-3 cursor-pointer"
            >
                <div className="flex items-center justify-between">
                    {/* Visual Feedback on left */}
                    <div className="w-6 flex justify-center opacity-70">
                        {hasBeenViewed ? <CheckCircle className="w-5 h-5 text-green-500" /> : null}
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center gap-1 sm:gap-2">
                        {/* Tiles Centered */}
                        <div className="flex gap-0.5 justify-center">
                            {entry.draw.split('').map((char, i) => (
                                <Tile key={i} letter={char} size="xs" />
                            ))}
                        </div>
                        {/* Base words */}
                        {entry.solutions.length > 0 && (
                            <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
                                <Minus className="w-3 h-3 text-red-400" />
                                <span className="font-medium">{entry.solutions[0]}</span>
                                {entry.solutions.length > 1 && (
                                    <span className="text-slate-400">+{entry.solutions.length - 1}</span>
                                )}
                            </div>
                        )}
                    </div>
                    {/* Expand icon pushed to the right */}
                    <div className="w-6 flex justify-center">
                        <ChevronRight className={clsx("w-5 h-5 text-slate-400 transition-transform flex-shrink-0", isExpanded && "rotate-90")} />
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
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-2 sm:px-3 pb-3 pt-0 border-t border-slate-100 bg-slate-50/50">
                            {entry.extensions.length > 0 && (
                                <div className="mt-2">
                                    <div className="flex justify-between items-center mb-2 px-1">
                                        <span className="text-xs font-medium text-slate-500">Extensions +1 ({entry.extensions.length})</span>
                                        {totalPages > 1 && (
                                            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                                                {progressPercent}% vu{progressPercent === 100 ? ' ✅' : ''}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 min-h-[60px]">
                                        {currentExtensions.map((ext, i) => {
                                            const wordId = `${entry.draw}-${ext.letter}-${ext.word}`;
                                            const mastery = masteries.get(wordId);

                                            return (
                                                <motion.div
                                                    key={`${page}-${i}`}
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ duration: 0.2, delay: i * 0.05 }}
                                                    className="flex items-center gap-2 text-xs bg-white p-1.5 rounded border border-slate-100 shadow-sm"
                                                >
                                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-100 text-green-700 font-bold text-[10px] border border-green-200">
                                                        +{ext.letter}
                                                    </span>
                                                    <span className="text-slate-700 font-medium tracking-wide flex-1 uppercase">{ext.word}</span>
                                                    {mastery ? (
                                                        <MasteryIndicator
                                                            level={mastery.masteryLevel}
                                                            testCount={mastery.testCount}
                                                            correctCount={mastery.correctCount}
                                                            viewCount={mastery.viewCount}
                                                        />
                                                    ) : (
                                                        <MasteryIndicatorEmpty />
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/60">
                                            <div className="text-xs font-medium text-slate-400 pl-1">
                                                Page {page + 1} sur {totalPages}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={handlePrevPage}
                                                    disabled={page === 0}
                                                    className="p-1.5 rounded-full hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-600 focus:outline-none"
                                                    aria-label="Extensions précédentes"
                                                >
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={handleNextPage}
                                                    disabled={page >= totalPages - 1}
                                                    className={clsx(
                                                        "px-3 py-1.5 flex items-center justify-center rounded-full transition-all focus:outline-none text-sm font-medium",
                                                        page < totalPages - 1 
                                                            ? "bg-scrabble-green text-white hover:bg-emerald-600 shadow-sm" 
                                                            : "text-slate-400 bg-slate-200 opacity-50 cursor-not-allowed"
                                                    )}
                                                    aria-label="Extensions suivantes"
                                                >
                                                    Plus <ChevronRight className="w-4 h-4 ml-1" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {entry.extensions.length === 0 && <span className="text-xs w-full block text-center py-3 text-slate-400 italic">Aucune rallonge</span>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const CategoryCard: React.FC<{
    category: DictionaryCategory;
    isOpen: boolean;
    onToggle: () => void;
    highlightedEntryId?: string | null;
    id?: string;
}> = ({ category, isOpen, onToggle, highlightedEntryId, id }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

    // Auto-scroll to highlighted entry
    useEffect(() => {
        if (highlightedEntryId && isOpen && contentRef.current) {
            const el = contentRef.current.querySelector(`#entry-${highlightedEntryId}`);
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setExpandedEntryId(highlightedEntryId);
                }, 100);
            }
        }
    }, [highlightedEntryId, isOpen]);

    return (
        <div id={id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-3">
            <button
                onClick={onToggle}
                className="w-full px-3 sm:px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className={clsx(
                        "px-2 py-1 rounded-md font-mono font-bold text-sm shadow-sm transition-colors",
                        isOpen ? "bg-scrabble-green text-white" : "bg-slate-100 text-slate-600"
                    )}>
                        {category.prefix}
                    </div>
                    <span className="text-xs sm:text-sm text-slate-500 font-medium">
                        {category.entries.length} tirage{category.entries.length > 1 ? 's' : ''}
                    </span>
                </div>
                {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div
                            ref={contentRef}
                            className="max-h-[60vh] overflow-y-auto bg-slate-50/50 p-2 sm:p-3 border-t border-slate-100"
                        >
                            {category.entries.map((entry) => (
                                <EntryRow
                                    key={entry.id}
                                    entry={entry}
                                    isHighlighted={highlightedEntryId === entry.id}
                                    isExpanded={expandedEntryId === entry.id}
                                    onToggle={() => setExpandedEntryId(prev => prev === entry.id ? null : entry.id)}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Main Page ---

const DictionaryPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'nav' | 'search'>('nav');
    const [searchTerm, setSearchTerm] = useState('');
    const { position, savePosition } = useReadingPosition();
    const [highlightedEntry, setHighlightedEntry] = useState<string | null>(null);
    const [openSearchCategory, setOpenSearchCategory] = useState<string | null>(null);
    const [categories, setCategories] = useState<DictionaryCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [availableLetters, setAvailableLetters] = useState<string[]>([]);

    useEffect(() => {
        let isMounted = true;
        getAvailableFirstLetters().then(letters => {
            if (isMounted) setAvailableLetters(letters);
        });
        return () => { isMounted = false; };
    }, []);

    // Load dictionary based on tab
    useEffect(() => {
        let mounted = true;
        setLoading(true);

        const fetchData = async () => {
            try {
                if (activeTab === 'nav') {
                    if (position.openCategory) {
                        const results = await getCategoriesByFirstLetter(position.openCategory[0]);
                        if (mounted) {
                            setCategories(results);
                            setLoading(false);
                            setTimeout(() => scrollToCategory(position.openCategory!), 100);
                        }
                    } else if (availableLetters.length > 0) {
                        const results = await getCategoriesByFirstLetter(availableLetters[0]);
                        if (mounted) {
                            setCategories(results);
                            setLoading(false);
                        }
                    } else {
                        // Letters not loaded yet
                        if (mounted) setLoading(false);
                    }
                } else {
                    if (searchTerm.trim().length === 0) {
                        // Don't load anything for empty search — show placeholder
                        if (mounted) {
                            setCategories([]);
                            setLoading(false);
                        }
                    } else {
                        const results = await searchDictionary(searchTerm);
                        if (mounted) {
                            setCategories(results);
                            setLoading(false);
                        }
                    }
                }
            } catch (error) {
                console.error("Error searching dictionary:", error);
                if (mounted) setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchData, activeTab === 'search' ? 200 : 0);
        return () => {
            mounted = false;
            clearTimeout(timeoutId);
        };
    }, [searchTerm, activeTab, availableLetters, position.openCategory]);

    const handleSearch = async (val: string) => {
        setSearchTerm(val);
        setOpenSearchCategory(null);

        if (val.length >= 7) {
            const result = await findCategoryByDraw(val);
            if (result) {
                setHighlightedEntry(result.entryId);
            } else {
                setHighlightedEntry(null);
            }
        } else {
            setHighlightedEntry(null);
        }
    };

    const scrollToCategory = (prefix: string) => {
        const el = document.getElementById(`category-${prefix}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleIndexClick = (char: string) => {
        setActiveTab('nav');
        // Hack to let UI transition state if we're jumping across letters
        savePosition(char + "...", 0);
        setCategories([]);
        setLoading(true);
        getCategoriesByFirstLetter(char).then(res => {
            setCategories(res);
            setLoading(false);
            if (res.length > 0) {
                savePosition(res[0].prefix, 0);
            }
        });
    };

    return (
        <div className="flex flex-col min-h-0 flex-1 bg-slate-50 relative">
            {/* Header with Tabs */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4 shadow-sm">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-scrabble-green" />
                            <h1 className="text-lg sm:text-2xl font-bold text-slate-800">Pôle de Révision</h1>
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('nav')}
                                className={clsx("px-3 py-1.5 text-sm font-medium rounded-md transition-all shadow-sm", activeTab === 'nav' ? "bg-white text-scrabble-green shadow" : "text-slate-500 hover:text-slate-700")}
                            >
                                Explorer
                            </button>
                            <button
                                onClick={() => setActiveTab('search')}
                                className={clsx("px-3 py-1.5 text-sm font-medium rounded-md transition-all", activeTab === 'search' ? "bg-white text-scrabble-green shadow" : "text-slate-500 hover:text-slate-700")}
                            >
                                Recherche
                            </button>
                        </div>
                    </div>

                    {activeTab === 'search' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="relative mt-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5" />
                            <input
                                type="text"
                                placeholder="Rechercher (ex: AAB, Z...)"
                                className="w-full pl-9 sm:pl-11 pr-3 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-scrabble-green/50 outline-none transition-all uppercase font-mono text-sm sm:text-base tracking-wider shadow-inner"
                                value={searchTerm}
                                onChange={(e) => handleSearch(e.target.value)}
                                autoFocus
                            />
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 scroll-smooth pb-36 md:pb-6">
                <div className="max-w-2xl mx-auto">
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-scrabble-green"></div>
                        </div>
                    ) : activeTab === 'search' && searchTerm.trim().length === 0 ? (
                        <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-3">
                            <Search className="w-12 h-12 text-slate-300 mx-auto" />
                            <p>Tapez un tirage ou des lettres pour chercher.</p>
                        </div>
                    ) : categories.length > 0 ? (
                        categories.map((cat) => (
                            <CategoryCard
                                key={cat.prefix}
                                id={`category-${cat.prefix}`}
                                category={cat}
                                isOpen={activeTab === 'search' ? openSearchCategory === cat.prefix : position.openCategory === cat.prefix}
                                onToggle={() => {
                                    if (activeTab === 'search') {
                                        setOpenSearchCategory(prev => prev === cat.prefix ? null : cat.prefix);
                                    } else {
                                        savePosition(position.openCategory === cat.prefix ? null : cat.prefix, 0);
                                    }
                                }}
                                highlightedEntryId={highlightedEntry}
                            />
                        ))
                    ) : (
                        <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-3">
                            <Search className="w-12 h-12 text-slate-300 mx-auto" />
                            <p>Aucun résultat.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Index */}
            {activeTab === 'nav' && availableLetters.length > 0 && (
                <div className="fixed bottom-[68px] left-0 right-0 md:hidden bg-white/95 backdrop-blur border-t border-slate-200 z-40">
                    <div className="flex overflow-x-auto py-2 px-2 gap-1 no-scrollbar justify-center">
                        {availableLetters.map(char => (
                            <button
                                key={char}
                                onClick={() => handleIndexClick(char)}
                                className={clsx(
                                    "flex-shrink-0 w-8 h-8 text-xs font-bold rounded-full transition-colors flex items-center justify-center",
                                    position.openCategory?.startsWith(char)
                                        ? "bg-scrabble-green text-white shadow-md scale-110"
                                        : "text-slate-500 hover:text-scrabble-green hover:bg-scrabble-green/10"
                                )}
                            >
                                {char}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Desktop Index */}
            {activeTab === 'nav' && availableLetters.length > 0 && (
                <div className="fixed right-2 top-1/2 -translate-y-1/2 hidden lg:flex flex-col bg-white/80 backdrop-blur p-1.5 rounded-2xl shadow-md border border-slate-200 z-40 max-h-[80vh] overflow-y-auto no-scrollbar">
                    {availableLetters.map(char => (
                        <button
                            key={char}
                            onClick={() => handleIndexClick(char)}
                            className={clsx(
                                "w-7 h-7 text-[11px] font-bold rounded-full transition-colors flex items-center justify-center my-0.5",
                                position.openCategory?.startsWith(char)
                                    ? "bg-scrabble-green text-white shadow-md scale-110"
                                    : "text-slate-400 hover:text-scrabble-green hover:bg-scrabble-green/10"
                            )}
                            title={`Aller à ${char}`}
                        >
                            {char}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DictionaryPage;