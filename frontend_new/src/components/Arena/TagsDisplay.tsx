import React from 'react';
import { clsx } from 'clsx';
import type { DrawTags } from '../../types/dictionary';

interface TagsDisplayProps {
    tags: DrawTags;
    /**
     * Seule la forme compacte subsiste. La variante "full" (tableau voyelles /
     * consonnes / valeur / rang) répétait mot pour mot cette ligne et coûtait
     * deux lignes de hauteur sur chaque carte, au détriment des mots.
     */
    variant?: 'compact';
    className?: string;
}

export const TagsDisplay: React.FC<TagsDisplayProps> = ({ tags, className }) => (
    <div className={clsx('flex items-center gap-1.5 flex-wrap', className)}>
        {/* Voyelles — la répartition voyelles/consonnes est ce qui décide si un
            tirage est jouable ; le total de points, lui, se lit sur les jetons. */}
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
            {tags.vowelCount}V
        </span>

        {tags.hasPremium && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                {tags.premiumLetters.join('')}
            </span>
        )}

        {tags.probabilityRank && tags.probabilityRank <= 1000 && (
            <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 cursor-help"
                title={'Top probabilité #' + tags.probabilityRank + " calculée selon la fréquence d'apparition des lettres"}
            >
                #{tags.probabilityRank}
            </span>
        )}
    </div>
);

export default TagsDisplay;
