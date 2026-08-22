/**
 * Source unique de vérité pour les Mondes de l'Arène.
 *
 * Ces tables étaient dupliquées dans StudySession, SessionComplete et
 * WorldBrowser, avec des libellés déjà divergents ("Exploration" vs
 * "Exploration Libre", accents présents ou non). Ajouter un monde obligeait
 * à éditer trois fichiers, et en oublier un ne casse rien au build tant que
 * les trois `Record<WorldType, …>` restent complets — donc l'oubli passe.
 */

import type { WorldType } from '../types/dictionary';

export const WORLD_NAMES: Record<WorldType, string> = {
    essentials: 'Les Indispensables',
    premium: 'Lettres Chères',
    vowels: 'Équilibre Voyelles',
    explorer: 'Exploration Libre',
    morphology: 'Morphologie',
};

/** Classe Tailwind de fond, pour l'état sélectionné des sous-catégories. */
export const WORLD_COLORS: Record<WorldType, string> = {
    essentials: 'bg-amber-500',
    premium: 'bg-purple-500',
    vowels: 'bg-blue-500',
    explorer: 'bg-emerald-500',
    morphology: 'bg-rose-500',
};
