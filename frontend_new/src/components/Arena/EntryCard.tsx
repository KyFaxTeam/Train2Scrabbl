import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import type { DrawEntry } from '../../types/dictionary';
import Tile from '../Tile';
import TagsDisplay from './TagsDisplay';

interface EntryCardProps {
    entry: DrawEntry;
    showTags?: boolean;
    isHighlighted?: boolean;
}

export const EntryCard: React.FC<EntryCardProps> = ({
    entry,
    showTags = true,
    isHighlighted = false
}) => {
    const [expanded, setExpanded] = useState(false);

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
                onClick={() => setExpanded(!expanded)}
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
                                    <h4 className="text-xs font-medium text-slate-500 mb-1.5">
                                        Scrabbles ({entry.solutions.length})
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
                                    <h4 className="text-xs font-medium text-slate-500 mb-1.5">
                                        Extensions ({entry.extensions.length})
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                        {entry.extensions.slice(0, 12).map((ext, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded text-sm"
                                            >
                                                <span className="font-bold text-emerald-600">
                                                    +{ext.letter}
                                                </span>
                                                <span className="text-emerald-700 truncate">
                                                    {ext.word}
                                                </span>
                                            </div>
                                        ))}
                                        {entry.extensions.length > 12 && (
                                            <span className="text-xs text-slate-400 col-span-full">
                                                +{entry.extensions.length - 12} autres
                                            </span>
                                        )}
                                    </div>
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
