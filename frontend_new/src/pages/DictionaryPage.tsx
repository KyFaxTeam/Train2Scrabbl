import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronRight, ChevronDown, BookOpen, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { searchDictionary, findCategoryByDraw } from '../services/dictionaryService';
import { useReadingPosition } from '../hooks/useReadingPosition';
import type { DrawEntry, DictionaryCategory } from '../types/dictionary';
import type { WordMastery } from '../types/learning';
import Tile from '../components/Tile';
import { useLearningStore } from '../store/useLearningStore';
import { getWordMastery } from '../services/learningStore';
import { MasteryIndicator, MasteryIndicatorEmpty } from '../components/Learning';

// --- Components ---

const EntryRow: React.FC<{ entry: DrawEntry; isHighlighted?: boolean }> = ({ entry, isHighlighted }) => {
    const [expanded, setExpanded] = useState(false);
    const [masteries, setMasteries] = useState<Map<string, WordMastery>>(new Map());
    const trackExtensionView = useLearningStore(state => state.trackExtensionView);
    const hasTracked = useRef(false);

    // Track views and load masteries when expanded
    useEffect(() => {
        if (expanded && entry.extensions.length > 0) {
            // Track each extension view (only once per expand)
            if (!hasTracked.current) {
                entry.extensions.forEach(ext => {
                    trackExtensionView(entry.draw, ext.letter, ext.word);
                });
                hasTracked.current = true;
            }

            // Load masteries for display
            const loadMasteries = async () => {
                const map = new Map<string, WordMastery>();
                for (const ext of entry.extensions) {
                    const wordId = `${entry.draw}-${ext.letter}-${ext.word}`;
                    const mastery = await getWordMastery(wordId);
                    if (mastery) {
                        map.set(wordId, mastery);
                    }
                }
                setMasteries(map);
            };
            loadMasteries();
        }

        // Reset tracking flag when collapsed
        if (!expanded) {
            hasTracked.current = false;
        }
    }, [expanded, entry.draw, entry.extensions, trackExtensionView]);

    return (
        <div
            id={`entry-${entry.id}`}
            className={clsx(
                "bg-white border rounded-lg transition-all mb-2",
                isHighlighted ? "border-lexis-gold ring-2 ring-lexis-gold/50 shadow-lg" : "border-slate-200 hover:border-scrabble-green/30",
                expanded ? "shadow-md" : "shadow-sm"
            )}
        >
            <div
                onClick={() => setExpanded(!expanded)}
                className="p-2 sm:p-3 flex items-center justify-between cursor-pointer"
            >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    {/* Tiles */}
                    <div className="flex gap-0.5">
                        {entry.draw.split('').map((char, i) => (
                            <Tile key={i} letter={char} size="xs" />
                        ))}
                    </div>
                    {/* Base words */}
                    {entry.solutions.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Minus className="w-3 h-3 text-red-400" />
                            <span className="font-medium">{entry.solutions[0]}</span>
                            {entry.solutions.length > 1 && (
                                <span className="text-slate-400">+{entry.solutions.length - 1}</span>
                            )}
                        </div>
                    )}
                </div>
                <ChevronRight className={clsx("w-4 h-4 text-slate-400 transition-transform flex-shrink-0", expanded && "rotate-90")} />
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
                        <div className="px-2 sm:px-3 pb-3 pt-0 border-t border-slate-100 bg-slate-50/50">
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {entry.extensions.map((ext, i) => {
                                    const wordId = `${entry.draw}-${ext.letter}-${ext.word}`;
                                    const mastery = masteries.get(wordId);

                                    return (
                                        <div key={i} className="flex items-center gap-2 text-xs bg-white p-1.5 rounded border border-slate-100">
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-100 text-green-700 font-bold text-[10px] border border-green-200">
                                                +{ext.letter}
                                            </span>
                                            <span className="text-slate-600 tracking-wide flex-1">{ext.word}</span>
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
                                        </div>
                                    );
                                })}
                                {entry.extensions.length === 0 && <span className="text-xs text-slate-400 italic">Aucune rallonge</span>}
                            </div>
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

    // Auto-scroll to highlighted entry
    useEffect(() => {
        if (highlightedEntryId && isOpen && contentRef.current) {
            const el = contentRef.current.querySelector(`#entry-${highlightedEntryId}`);
            if (el) {
                setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
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
                    <span className="text-xs sm:text-sm text-slate-500">
                        {category.entries.length} tirages
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

const ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

const DictionaryPage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const { position, savePosition } = useReadingPosition();
    const [highlightedEntry, setHighlightedEntry] = useState<string | null>(null);
    const [categories, setCategories] = useState<DictionaryCategory[]>([]);
    const [loading, setLoading] = useState(true);

    // Load dictionary
    useEffect(() => {
        let mounted = true;
        setLoading(true);

        const fetchData = async () => {
            try {
                const results = await searchDictionary(searchTerm);
                if (mounted) {
                    setCategories(results);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Error searching dictionary:", error);
                if (mounted) setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchData, 200);
        return () => {
            mounted = false;
            clearTimeout(timeoutId);
        };
    }, [searchTerm]);

    // Handle search input
    const handleSearch = async (val: string) => {
        setSearchTerm(val);

        if (val.length >= 7) {
            const result = await findCategoryByDraw(val);
            if (result) {
                savePosition(result.category.prefix, 0);
                setHighlightedEntry(result.entryId);
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
        const targetCat = categories.find(c => c.prefix.startsWith(char));
        if (targetCat) {
            scrollToCategory(targetCat.prefix);
        } else {
            // Search for it
            setSearchTerm(char);
        }
    };

    return (
        <div className="flex flex-col min-h-0 flex-1 bg-slate-50 relative">
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4 shadow-sm">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3">
                        <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-scrabble-green" />
                        <h1 className="text-lg sm:text-2xl font-bold text-slate-800">Le Codex</h1>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5" />
                        <input
                            type="text"
                            placeholder="Rechercher une catégorie (ex: AAB, ABC...)"
                            className="w-full pl-9 sm:pl-11 pr-3 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-scrabble-green/50 outline-none transition-all uppercase font-mono text-sm sm:text-base tracking-wider"
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Content Area - SCROLLABLE */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 scroll-smooth pb-20 lg:pb-6">
                <div className="max-w-2xl mx-auto">
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-scrabble-green"></div>
                        </div>
                    ) : categories.length > 0 ? (
                        categories.map((cat) => (
                            <CategoryCard
                                key={cat.prefix}
                                id={`category-${cat.prefix}`}
                                category={cat}
                                isOpen={position.openCategory === cat.prefix || searchTerm.length > 0}
                                onToggle={() => savePosition(position.openCategory === cat.prefix ? null : cat.prefix, 0)}
                                highlightedEntryId={highlightedEntry}
                            />
                        ))
                    ) : (
                        <div className="text-center py-12 text-slate-400">
                            Aucune catégorie trouvée.
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Index (Bottom horizontal strip) */}
            <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white/95 backdrop-blur border-t border-slate-200 z-40 safe-area-bottom">
                <div className="flex overflow-x-auto py-2 px-2 gap-1 no-scrollbar">
                    {ALPHABET.map(char => (
                        <button
                            key={char}
                            onClick={() => handleIndexClick(char)}
                            className="flex-shrink-0 w-8 h-8 text-xs font-bold text-slate-500 hover:text-scrabble-green hover:bg-scrabble-green/10 rounded-full transition-colors flex items-center justify-center"
                        >
                            {char}
                        </button>
                    ))}
                </div>
            </div>

            {/* Desktop Index (Right side vertical) */}
            <div className="fixed right-2 top-1/2 -translate-y-1/2 hidden lg:flex flex-col bg-white/80 backdrop-blur p-1.5 rounded-2xl shadow-md border border-slate-200 z-40 max-h-[80vh] overflow-y-auto no-scrollbar">
                {ALPHABET.map(char => (
                    <button
                        key={char}
                        onClick={() => handleIndexClick(char)}
                        className="w-7 h-7 text-[11px] font-bold text-slate-400 hover:text-scrabble-green hover:bg-scrabble-green/10 rounded-full transition-colors flex items-center justify-center"
                        title={`Aller à ${char}`}
                    >
                        {char}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default DictionaryPage;
