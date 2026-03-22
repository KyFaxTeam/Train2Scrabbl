
export enum SquareType {
    NORMAL = 0,
    DOUBLE_LETTER = 1,
    TRIPLE_LETTER = 2,
    DOUBLE_WORD = 3,
    TRIPLE_WORD = 4,
    START = 5 // Case centrale
}

export enum Direction {
    HORIZONTAL = 'H',
    VERTICAL = 'V'
}

export interface Move {
    word: string;
    row: number;
    col: number;
    direction: Direction;
    score: number;
}
