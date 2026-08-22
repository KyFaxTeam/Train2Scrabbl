import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Diamond, CircleDot, Compass, Blocks } from 'lucide-react';
import { clsx } from 'clsx';
import type { WorldType } from '../../types/dictionary';

interface WorldConfig {
    id: WorldType;
    name: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    bgGradient: string;
    count?: number;
}

const WORLDS: WorldConfig[] = [
    {
        id: 'essentials',
        name: 'Les Indispensables',
        description: 'Top 1000 par probabilité',
        icon: <Trophy className="w-6 h-6" />,
        color: 'text-amber-600',
        bgGradient: 'from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200',
    },
    {
        id: 'premium',
        name: 'Lettres Chères',
        description: 'J, K, Q, W, X, Y, Z',
        icon: <Diamond className="w-6 h-6" />,
        color: 'text-purple-600',
        bgGradient: 'from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200',
    },
    {
        id: 'vowels',
        name: 'Équilibre Voyelles',
        description: 'De 1V à 6V',
        icon: <CircleDot className="w-6 h-6" />,
        color: 'text-blue-600',
        bgGradient: 'from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200',
    },
    {
        id: 'morphology',
        name: 'Morphologie',
        description: 'Préfixes et suffixes',
        icon: <Blocks className="w-6 h-6" />,
        color: 'text-rose-600',
        bgGradient: 'from-rose-50 to-rose-100 hover:from-rose-100 hover:to-rose-200',
    },
    {
        id: 'explorer',
        name: 'Exploration Libre',
        description: 'Navigation alphabétique',
        icon: <Compass className="w-6 h-6" />,
        color: 'text-emerald-600',
        bgGradient: 'from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200',
    },
];

interface WorldSelectorProps {
    selectedWorld: WorldType | null;
    onSelectWorld: (world: WorldType) => void;
    stats?: Partial<Record<WorldType, number>>;
}

export const WorldSelector: React.FC<WorldSelectorProps> = ({
    selectedWorld,
    onSelectWorld,
    stats
}) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
            {WORLDS.map((world) => {
                const isSelected = selectedWorld === world.id;
                const count = stats?.[world.id];
                
                return (
                    <motion.button
                        key={world.id}
                        onClick={() => onSelectWorld(world.id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={clsx(
                            "relative p-4 rounded-xl border-2 transition-all duration-200",
                            "bg-gradient-to-br",
                            world.bgGradient,
                            isSelected
                                ? "border-current shadow-lg ring-2 ring-current/20"
                                : "border-transparent shadow-sm hover:shadow-md"
                        )}
                    >
                        <div className={clsx("flex flex-col items-center gap-2", world.color)}>
                            {world.icon}
                            <h3 className="font-semibold text-sm text-center">
                                {world.name}
                            </h3>
                            <p className="text-xs text-slate-500 text-center">
                                {world.description}
                            </p>
                            {count !== undefined && (
                                <span className="text-xs font-medium bg-white/60 px-2 py-0.5 rounded-full">
                                    {count.toLocaleString()} tirages
                                </span>
                            )}
                        </div>
                        
                        {isSelected && (
                            <motion.div
                                layoutId="world-indicator"
                                className="absolute inset-0 border-2 border-current rounded-xl"
                                initial={false}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        )}
                    </motion.button>
                );
            })}
        </div>
    );
};

export default WorldSelector;
