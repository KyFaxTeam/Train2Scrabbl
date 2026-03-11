import React from 'react';
import { clsx } from 'clsx';

// French Scrabble letter points
const LETTER_POINTS: Record<string, number> = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 10, L: 1, M: 2,
    N: 1, O: 1, P: 3, Q: 8, R: 1, S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
    '?': 0
};

interface BoardTileProps {
    letter: string;
    isAnchor?: boolean;  // Fixed tile on board
    isPlaced?: boolean;  // User placed tile
    size?: 'sm' | 'md';
}

export const BoardTile: React.FC<BoardTileProps> = ({
    letter,
    isAnchor = false,
    isPlaced = false,
    size = 'md'
}) => {
    const points = LETTER_POINTS[letter.toUpperCase()] || 0;

    // Color based on points (like scrabble-solver)
    const getPointsColorClass = () => {
        if (isAnchor) return 'bg-slate-200 text-slate-700';
        if (points === 1) return 'bg-[var(--color-tile-1pt)] text-amber-900';
        if (points === 2) return 'bg-[var(--color-tile-2pt)] text-green-900';
        if (points <= 4) return 'bg-[var(--color-tile-3pt)] text-blue-900';
        return 'bg-[var(--color-tile-5pt)] text-red-900';
    };

    const sizeClasses = size === 'sm'
        ? 'w-[85%] h-[85%] text-sm'
        : 'w-[90%] h-[90%] text-lg';

    return (
        <div
            className={clsx(
                sizeClasses,
                "relative flex items-center justify-center font-bold font-mono rounded-[4px] select-none",
                "transition-all duration-100",
                getPointsColorClass()
            )}
            style={{
                boxShadow: isAnchor ? 'none' : 'inset -2px -2px 2px -1px rgba(34, 34, 34, 0.7)',
            }}
        >
            <span className="uppercase">{letter}</span>

            {/* Points in corner */}
            <span
                className={clsx(
                    "absolute font-normal leading-none",
                    size === 'sm' ? 'bottom-0 right-0.5 text-[7px]' : 'bottom-0.5 right-1 text-[9px]'
                )}
            >
                {points}
            </span>
        </div>
    );
};

export default BoardTile;
