import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Minus, ChevronLeft, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import type { DrawEntry } from '../../types/dictionary';
import { formatFamilyLabel, getFamilyEvidence, getMorphologyFamily } from '../../services/arenaService';
import Tile from '../Tile';
import TagsDisplay from './TagsDisplay';
import { useLearningStore } from '../../store/useLearningStore';

interface EntryCardProps {
    entry: DrawEntry;
    showTags?: boolean;
    isHighlighted?: boolean;
    /** Famille d'affixes filtrée : la carte doit alors dire ce qui l'y range. */
    familyId?: string | null;
}

const ITEMS_PER_PAGE = 6;

export const EntryCard: React.FC<EntryCardProps> = ({
    entry,
    showTags = true,
    isHighlighted = false,
    familyId = null
}) => {
    const [expanded, setExpanded] = useState(false);
    const [page, setPage] = useState(0);
    const [viewedPages, setViewedPages] = useState<Set<number>>(new Set());
    const [showWarning, setShowWarning] = useState(false);
    
    const trackExtensionView = useLearningStore(state => state.trackExtensionView);
    const hasTracked = useRef(new Set<number>());

    const totalPages = Math.ceil(entry.extensions.length / ITEMS_PER_PAGE);

    // Un tirage peut appartenir a la famille par une rallonge 7+1, donc par une
    // lettre absente du chevalet. La preuve doit rester visible carte fermee,
    // sinon le filtre a l'air casse.
    const family = familyId ? getMorphologyFamily(familyId) : undefined;
    const evidence = useMemo(
        () => (family ? getFamilyEvidence(entry, family.id) : null),
        [entry, family]
    );

    const matched = useMemo(
        () => new Set(evidence?.extensions.map(e => e.word) ?? []),
        [evidence]
    );

    // Les rallonges de la famille filtree passent en page 1 - et UNIQUEMENT
    // dans ce cas : hors filtre, l'ordre par lettre est celui dans lequel on
    // apprend les rallonges, on n'y touche pas. Rien n'est retire ici : les
    // rallonges restantes suivent, la pagination et le suivi de lecture
    // portent toujours sur la liste complete.
    const currentExtensions = useMemo(() => {
        const ordered = matched.size > 0
            ? [...entry.extensions].sort((a, b) =>
                Number(matched.has(b.word)) - Number(matched.has(a.word)))
            : entry.extensions;
        return ordered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
    }, [entry.extensions, matched, page]);

    useEffect(() => {
        if (!expanded || entry.extensions.length === 0) return;
        
        if (!hasTracked.current.has(page)) {
            const pageExtensions = currentExtensions;
            pageExtensions.forEach(ext => {
                trackExtensionView(entry.draw, ext.letter, ext.word);
            });
            hasTracked.current.add(page);
            setViewedPages(prev => new Set(prev).add(page));
        }
    }, [expanded, page, currentExtensions, entry.extensions.length, entry.draw, trackExtensionView]);

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

                {/* Preuve d'appartenance a la famille filtree. Sur sa propre
                    ligne : dans l'entete elle devait etre masquee sous 640 px,
                    or c'est justement sur mobile qu'un tirage sans Q classe en
                    -IQUE laisse le plus perplexe. */}
                {family && evidence && (evidence.solutions.length > 0 || evidence.extensions.length > 0) && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold shrink-0">
                            {formatFamilyLabel(family)}
                        </span>
                        <span className="text-rose-700 font-medium truncate">
                            {evidence.solutions[0]
                                ?? `${evidence.extensions[0].word} (+${evidence.extensions[0].letter})`}
                        </span>
                    </div>
                )}
                
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
                            {/* Le bloc de stats deplie (voyelles, consonnes, valeur, rang)
                                repetait l'entete compacte "4V 7pts #1" : deux lignes de
                                hauteur pour zero information nouvelle, au detriment des
                                mots - qui sont ce qu'on vient reviser. */}

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
                                        <span>
                                            Extensions +1 ({entry.extensions.length})
                                            {evidence && evidence.extensions.length > 0 && (
                                                <span className="ml-1.5 text-rose-600 font-semibold">
                                                    dont {family && formatFamilyLabel(family)} :{' '}
                                                    {evidence.extensions
                                                        .map(e => `+${e.letter} ${e.word}`)
                                                        .join(', ')}
                                                </span>
                                            )}
                                        </span>
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 min-h-[60px]">
                                        {currentExtensions.map((ext, i) => (
                                            <motion.div
                                                key={`${page}-${i}`}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ duration: 0.2, delay: i * 0.05 }}
                                                className={clsx(
                                                    'flex items-center gap-1.5 px-2 py-1.5 rounded text-sm',
                                                    matched.has(ext.word)
                                                        ? 'bg-rose-50 ring-1 ring-rose-200'
                                                        : 'bg-emerald-50'
                                                )}
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
                                    
                                    {/* Pagination. L'ancienne version - deux
                                        chevrons gris et un "Page 2 sur 15" en
                                        text-slate-400 - se lisait comme une
                                        mention legale : rien ne signalait qu'il
                                        restait treize pages a parcourir. */}
                                    {totalPages > 1 && (
                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={clsx(
                                                            'h-full rounded-full transition-all duration-300',
                                                            progressPercent === 100 ? 'bg-emerald-500' : 'bg-emerald-400'
                                                        )}
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>
                                                <span className="shrink-0 text-[11px] font-semibold text-slate-500 tabular-nums">
                                                    {progressPercent}% vu{progressPercent === 100 ? ' ✅' : ''}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <button
                                                    onClick={handlePrevPage}
                                                    disabled={page === 0}
                                                    className="flex items-center gap-1 min-h-[40px] px-3 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                                                    aria-label="Extensions precedentes"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                    Prec.
                                                </button>

                                                <span className="text-sm font-semibold text-slate-700 tabular-nums">
                                                    Page {page + 1} / {totalPages}
                                                </span>

                                                <button
                                                    onClick={handleNextPage}
                                                    disabled={page >= totalPages - 1}
                                                    className="flex items-center gap-1 min-h-[40px] px-3 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                                                    aria-label="Extensions suivantes"
                                                >
                                                    Suivant
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
