import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { SubCategory, WorldType } from '../../types/dictionary';

interface SubCategorySelectorProps {
    world: WorldType;
    subcategories: SubCategory[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

const WORLD_COLORS: Record<WorldType, string> = {
    essentials: 'bg-amber-500',
    premium: 'bg-purple-500',
    vowels: 'bg-blue-500',
    explorer: 'bg-emerald-500',
};

export const SubCategorySelector: React.FC<SubCategorySelectorProps> = ({
    world,
    subcategories,
    selectedId,
    onSelect
}) => {
    if (subcategories.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border-y border-slate-200">
            {subcategories.map((subcat) => {
                const isSelected = selectedId === subcat.id;
                
                return (
                    <motion.button
                        key={subcat.id}
                        onClick={() => onSelect(subcat.id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={clsx(
                            "relative px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                            isSelected
                                ? `${WORLD_COLORS[world]} text-white shadow-md`
                                : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:shadow-sm"
                        )}
                    >
                        <span className="mr-1">{subcat.icon}</span>
                        {subcat.label}
                        <span className={clsx(
                            "ml-1.5 text-xs",
                            isSelected ? "text-white/80" : "text-slate-400"
                        )}>
                            ({subcat.count.toLocaleString()})
                        </span>
                    </motion.button>
                );
            })}
        </div>
    );
};

export default SubCategorySelector;
