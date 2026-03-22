import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Filter } from 'lucide-react';
import type { DrawEntry, WorldType } from '../../types/dictionary';
import { getSubcategories } from '../../services/dictionaryService';
import { getWorldProgress, type WorldProgress } from '../../services/progressService';
import EntryCard from './EntryCard';
import SubCategorySelector from './SubCategorySelector';
import { WorldProgressBar } from './WorldProgress';

interface WorldBrowserProps {
    world: WorldType;
    entries: DrawEntry[];
    onBack: () => void;
}

const ENTRIES_PER_PAGE = 50;

export const WorldBrowser: React.FC<WorldBrowserProps> = ({
    world,
    entries,
    onBack
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(ENTRIES_PER_PAGE);
    const [worldProgress, setWorldProgress] = useState<WorldProgress | null>(null);
    const [progressLoading, setProgressLoading] = useState(true);

    const subcategories = useMemo(() => getSubcategories(world), [world]);

    // Load world progress
    useEffect(() => {
        const loadProgress = async () => {
            setProgressLoading(true);
            try {
                const progress = await getWorldProgress(world, entries);
                setWorldProgress(progress);
            } catch (e) {
                console.error('Failed to load world progress:', e);
            } finally {
                setProgressLoading(false);
            }
        };

        if (entries.length > 0) {
            loadProgress();
        }
    }, [world, entries]);

    // Get entries based on selected subcategory or all entries
    const activeEntries = useMemo(() => {
        if (selectedSubcategory) {
            const subcat = subcategories.find(s => s.id === selectedSubcategory);
            return subcat?.entries || [];
        }
        return entries;
    }, [selectedSubcategory, subcategories, entries]);

    // Filter by search
    const filteredEntries = useMemo(() => {
        if (!searchQuery.trim()) return activeEntries;

        const q = searchQuery.toUpperCase();
        return activeEntries.filter(entry =>
            entry.draw.includes(q) ||
            entry.solutions.some(s => s.includes(q))
        );
    }, [activeEntries, searchQuery]);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(ENTRIES_PER_PAGE);
    }, [selectedSubcategory, searchQuery]);

    const visibleEntries = filteredEntries.slice(0, visibleCount);
    const hasMore = visibleCount < filteredEntries.length;

    const worldNames: Record<WorldType, string> = {
        essentials: 'Les Indispensables',
        premium: 'Lettres Chères',
        vowels: 'Équilibre Voyelles',
        explorer: 'Exploration Libre'
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
                <div className="flex items-center gap-3 p-3">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>

                    <div className="flex-1">
                        <h2 className="font-semibold text-lg text-slate-800">
                            {worldNames[world]}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {filteredEntries.length.toLocaleString()} tirages
                        </p>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher..."
                            className="pl-9 pr-3 py-1.5 w-40 sm:w-56 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Progress Bar */}
                <WorldProgressBar
                    progress={worldProgress}
                    isLoading={progressLoading}
                />

                {/* Subcategories */}
                <SubCategorySelector
                    world={world}
                    subcategories={subcategories}
                    selectedId={selectedSubcategory}
                    onSelect={(id) => setSelectedSubcategory(
                        id === selectedSubcategory ? null : id
                    )}
                />
            </div>

            {/* Entries List */}
            <div className="flex-1 overflow-auto p-3">
                <div className="space-y-2">
                    {visibleEntries.map((entry, index) => (
                        <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index * 0.02, 0.5) }}
                        >
                            <EntryCard entry={entry} showTags={true} />
                        </motion.div>
                    ))}
                </div>

                {/* Load more */}
                {hasMore && (
                    <button
                        onClick={() => setVisibleCount(prev => prev + ENTRIES_PER_PAGE)}
                        className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
                    >
                        Charger plus ({filteredEntries.length - visibleCount} restants)
                    </button>
                )}

                {/* Empty state */}
                {filteredEntries.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        <Filter className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>Aucun tirage trouvé</p>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="mt-2 text-blue-600 hover:underline text-sm"
                            >
                                Effacer la recherche
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorldBrowser;
