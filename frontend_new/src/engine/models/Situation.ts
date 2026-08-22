export interface AnchorPoint {
    row: number;
    col: number;
    letter: string;
}

export interface Placement {
    mot: string;
    position: [number, number]; // [row, col]
    direction: 'H' | 'V';
    score?: number;
}

export interface NaturalFlowConfig {
    profondeurRespiration: number;
    distributionMots: Record<string, number>;
    maxTentatives: number;
    /**
     * Nombre minimal de jetons sur le plateau pour qu'un exercice soit servi.
     * Un plateau a 4 jetons n'apprend rien : il n'y a pas de decision de
     * collage a prendre. Mediane mesuree sur la generation : 27 jetons.
     */
    jetonsMinimum?: number;
}

export interface Solution {
    mot: string;
    position: [number, number];
    direction: 'H' | 'V';
    score: number;
}

/**
 * Ce que le generateur sait de l'exercice qu'il vient de produire.
 *
 * `naturelScore` a ete retire : il valait `1` en dur, quoi qu'il arrive. Un
 * indicateur constant qui pretend mesurer le realisme d'un plateau est pire
 * qu'aucun indicateur. Les champs ci-dessous sont, eux, calcules sur le
 * plateau produit.
 */
export interface SituationMetadata {
    motCible: string;
    /** Lettres effectivement posees sur le plateau de depart. */
    jetonsPlateau: number;
    /** Mots reellement lisibles sur le plateau (lignes et colonnes). */
    motsPlateau: string[];
    /** Nombre de placements legaux du mot cible : mesure de l'ambiguite. */
    collagesLegaux: number;
    /** Deduite de `collagesLegaux` : moins il y a de collages, plus c'est dur. */
    difficulte: 'facile' | 'moyen' | 'difficile';
    /** Nombre de tentatives de generation qu'il a fallu. */
    tentatives: number;
}

export interface SituationEntrainement {
    grille: (string | null)[][];
    tirage: string[];
    /** Tous les collages legaux du mot cible, du meilleur au moins bon. */
    solutions: Solution[];
    meilleurScore: number;
    metadata: SituationMetadata;
}
