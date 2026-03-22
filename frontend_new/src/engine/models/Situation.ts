
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
}

export interface NaturalityScore {
    ouverture: number;
    connexions: number;
    equilibre: number;
    global: number;
}

export interface Solution {
    mot: string;
    position: [number, number];
    direction: 'H' | 'V';
    score: number;
}

export interface SituationEntrainement {
    grille: (string | null)[][];
    tirage: string[];
    solutions: Solution[];
    meilleurScore: number;
    metadata: {
        naturelScore: number;
        motCible: string;
    };
}
