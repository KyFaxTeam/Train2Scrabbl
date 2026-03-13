import React from 'react';
import { clsx } from 'clsx';

const LETTER_POINTS: Record<string, number> = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 10, L: 1, M: 2,
    N: 1, O: 1, P: 3, Q: 8, R: 1, S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
    '?': 0
};

interface BoardTileProps {
    letter: string;
    isAnchor?: boolean;
    isPlaced?: boolean;
    size?: 'sm' | 'md';
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
}

export const BoardTile: React.FC<BoardTileProps> = ({
    letter,
    isAnchor = false,
    isPlaced = false,
    size = 'md',
    draggable = false,
    onDragStart,
}) => {
    const points = LETTER_POINTS[letter.toUpperCase()] || 0;

    const sizeClasses = size === 'sm'
        ? 'w-[85%] h-[85%] text-xs'
        : 'w-[90%] h-[90%] text-base';

    return (
        <div
            draggable={draggable}
            onDragStart={onDragStart}
            className={clsx(
                sizeClasses,
                "relative flex items-center justify-center font-bold font-mono select-none",
                "rounded transition-all duration-100",
                isAnchor && "bg-[var(--color-tile-anchor)] text-[var(--color-tile-anchor-text)]",
                isPlaced && "bg-[var(--color-tile-placed)] text-[var(--color-tile-placed-text)] cursor-grab active:cursor-grabbing",
                !isAnchor && !isPlaced && "bg-[var(--color-tile-anchor)] text-[var(--color-tile-anchor-text)]"
            )}
            style={{
                boxShadow: isPlaced
                    ? 'var(--color-tile-placed-shadow), inset 0 1px 0 rgba(255,255,255,0.3)'
                    : isAnchor
                        ? 'inset 0 -1px 1px rgba(0,0,0,0.08)'
                        : 'none',
            }}
        >
            <span className="uppercase leading-none">{letter}</span>
            <span
                className={clsx(
                    "absolute font-normal leading-none",
                    size === 'sm' ? 'bottom-0 right-0.5 text-[6px]' : 'bottom-0.5 right-1 text-[8px]'
                )}
            >
                {points > 0 && points}
            </span>
        </div>
    );
};

export default BoardTile;
