import React from 'react';
import { clsx } from 'clsx';
import { Info } from 'lucide-react';
import type { DrawTags } from '../../types/dictionary';

interface TagsDisplayProps {
    tags: DrawTags;
    variant?: 'compact' | 'full';
    className?: string;
}

const VALUE_COLORS = {
    low: 'bg-slate-100 text-slate-600',
    mid: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    premium: 'bg-purple-100 text-purple-700',
};

const VALUE_LABELS = {
    low: 'Facile',
    mid: 'Moyen',
    high: 'Difficile',
    premium: 'Premium',
};

export const TagsDisplay: React.FC<TagsDisplayProps> = ({
    tags,
    variant = 'compact',
    className
}) => {
    if (variant === 'compact') {
        return (
            <div className={clsx("flex items-center gap-1.5 flex-wrap", className)}>
                {/* Voyelles */}
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                    {tags.vowelCount}V
                </span>

                {/* Valeur */}
                <span className={clsx(
                    "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium",
                    VALUE_COLORS[tags.valueCategory]
                )}>
                    {tags.totalValue}pts
                </span>

                {/* Lettres premium */}
                {tags.hasPremium && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                        {tags.premiumLetters.join('')}
                    </span>
                )}

                {/* Rank probabilité */}
                {tags.probabilityRank && tags.probabilityRank <= 1000 && (
                    <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 cursor-help"
                        title={"Top probabilité #" + tags.probabilityRank + " calculée selon la fréquence d'apparition des lettres"}
                    >
                        #{tags.probabilityRank}
                    </span>
                )}
            </div>
        );
    }

    // Full variant
    return (
        <div className={clsx("bg-slate-50 rounded-lg p-3 space-y-2", className)}>
            <div className="grid grid-cols-2 gap-2 text-sm">
                {/* Voyelles / Consonnes */}
                <div className="flex items-center justify-between">
                    <span className="text-slate-500">Voyelles</span>
                    <span className="font-medium text-blue-600">{tags.vowelCount}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-slate-500">Consonnes</span>
                    <span className="font-medium text-slate-700">{tags.consonantCount}</span>
                </div>

                {/* Valeur */}
                <div className="flex items-center justify-between">
                    <span className="text-slate-500">Valeur</span>
                    <span className={clsx("font-medium", {
                        'text-slate-600': tags.valueCategory === 'low',
                        'text-blue-600': tags.valueCategory === 'mid',
                        'text-amber-600': tags.valueCategory === 'high',
                        'text-purple-600': tags.valueCategory === 'premium',
                    })}>
                        {tags.totalValue} pts ({VALUE_LABELS[tags.valueCategory]})
                    </span>
                </div>

                {/* Probabilité */}
                {tags.probabilityRank && (
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1 group relative cursor-help">
                            Probabilité
                            <Info className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-10">
                                Calculée selon la fréquence d'apparition<br />des lettres au Scrabble
                            </div>
                        </span>
                        <span className="font-medium text-amber-600">
                            Rank #{tags.probabilityRank.toLocaleString()}
                        </span>
                    </div>
                )}
            </div>

            {/* Lettres premium */}
            {tags.hasPremium && (
                <div className="pt-2 border-t border-slate-200">
                    <span className="text-xs text-slate-500 mr-2">Lettres chères:</span>
                    {tags.premiumLetters.map(letter => (
                        <span
                            key={letter}
                            className="inline-flex items-center justify-center w-6 h-6 rounded bg-purple-100 text-purple-700 font-bold text-sm mr-1"
                        >
                            {letter}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TagsDisplay;
