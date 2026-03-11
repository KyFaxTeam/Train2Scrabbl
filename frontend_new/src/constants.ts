export const BOARD_SIZE = 15;

export const TRIPLE_WORD_SCORE = [
    [0, 0], [0, 7], [0, 14],
    [7, 0], [7, 14],
    [14, 0], [14, 7], [14, 14]
];

export const DOUBLE_WORD_SCORE = [
    [1, 1], [1, 13],
    [2, 2], [2, 12],
    [3, 3], [3, 11],
    [4, 4], [4, 10],
    [7, 7],
    [10, 4], [10, 10],
    [11, 3], [11, 11],
    [12, 2], [12, 12],
    [13, 1], [13, 13]
];

export const TRIPLE_LETTER_SCORE = [
    [1, 5], [1, 9],
    [5, 1], [5, 5], [5, 9], [5, 13],
    [9, 1], [9, 5], [9, 9], [9, 13],
    [13, 5], [13, 9]
];

export const DOUBLE_LETTER_SCORE = [
    [0, 3], [0, 11],
    [2, 6], [2, 8],
    [3, 0], [3, 7], [3, 14],
    [6, 2], [6, 6], [6, 8], [6, 12],
    [7, 3], [7, 11],
    [8, 2], [8, 6], [8, 8], [8, 12],
    [11, 0], [11, 7], [11, 14],
    [12, 6], [12, 8],
    [14, 3], [14, 11]
];

export const LETTER_POINTS: Record<string, number> = {
    'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1, 'J': 8,
    'K': 10, 'L': 1, 'M': 2, 'N': 1, 'O': 1, 'P': 3, 'Q': 8, 'R': 1, 'S': 1, 'T': 1,
    'U': 1, 'V': 4, 'W': 10, 'X': 10, 'Y': 10, 'Z': 10,
    '?': 0
};

export type BonusType = 'TW' | 'DW' | 'TL' | 'DL' | null;

export const getBonusType = (row: number, col: number): BonusType => {
    if (TRIPLE_WORD_SCORE.some(([r, c]) => r === row && c === col)) return 'TW';
    if (DOUBLE_WORD_SCORE.some(([r, c]) => r === row && c === col)) return 'DW';
    if (TRIPLE_LETTER_SCORE.some(([r, c]) => r === row && c === col)) return 'TL';
    if (DOUBLE_LETTER_SCORE.some(([r, c]) => r === row && c === col)) return 'DL';
    return null;
};
