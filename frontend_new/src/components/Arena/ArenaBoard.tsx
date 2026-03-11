import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { BOARD_SIZE, getBonusType } from '../../constants';
import { BoardTile } from './BoardTile';
import { ArrowRight, ArrowDown } from 'lucide-react';

interface ArenaBoardProps {
    initialTiles: { row: number; col: number; char: string }[];
    placedTiles: { row: number; col: number; char: string; rackId: number }[];
    onCellClick: (row: number, col: number) => void;
    onTilePlace?: (char: string, row: number, col: number) => void;
    onTileRemove?: (row: number, col: number) => void;
}

// Minimal labels
const BONUS_LABELS: Record<string, string> = {
    'TW': '×3', 'DW': '×2', 'TL': '×3', 'DL': '×2', 'CENTER': '★'
};

const BONUS_STYLES: Record<string, { bg: string; text: string }> = {
    'TW': { bg: 'var(--color-bonus-tw)', text: 'text-red-800' },
    'DW': { bg: 'var(--color-bonus-dw)', text: 'text-orange-800' },
    'TL': { bg: 'var(--color-bonus-tl)', text: 'text-blue-800' },
    'DL': { bg: 'var(--color-bonus-dl)', text: 'text-blue-700' },
    'CENTER': { bg: 'var(--color-bonus-center)', text: 'text-purple-900' }
};

export const ArenaBoard: React.FC<ArenaBoardProps> = ({
    initialTiles,
    placedTiles,
    onCellClick,
    onTilePlace,
    onTileRemove
}) => {
    // Interaction state
    const [activeCell, setActiveCell] = useState<{ r: number, c: number } | null>(null);
    const [direction, setDirection] = useState<'H' | 'V'>('H');
    const boardRef = useRef<HTMLDivElement>(null);

    // Handle cell click
    const handleCellClick = (r: number, c: number) => {
        if (activeCell?.r === r && activeCell?.c === c) {
            // Toggle direction if clicking same cell
            setDirection(prev => prev === 'H' ? 'V' : 'H');
        } else {
            setActiveCell({ r, c });
        }
        onCellClick(r, c);
        // Focus board for keyboard events
        boardRef.current?.focus();
    };

    // Keyboard navigation & typing
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!activeCell) return;

        const { r, c } = activeCell;
        let nextR = r;
        let nextC = c;

        switch (e.key) {
            case 'ArrowUp': nextR = Math.max(0, r - 1); break;
            case 'ArrowDown': nextR = Math.min(BOARD_SIZE - 1, r + 1); break;
            case 'ArrowLeft': nextC = Math.max(0, c - 1); break;
            case 'ArrowRight': nextC = Math.min(BOARD_SIZE - 1, c + 1); break;
            case 'Backspace':
                if (onTileRemove) {
                    onTileRemove(r, c);
                    // Move back
                    if (direction === 'H') nextC = Math.max(0, c - 1);
                    else nextR = Math.max(0, r - 1);
                }
                break;
            default:
                // Typing a letter
                if (e.key.length === 1 && e.key.match(/[a-zA-Z]/)) {
                    if (onTilePlace) {
                        onTilePlace(e.key.toUpperCase(), r, c);
                        // Move forward
                        if (direction === 'H') nextC = Math.min(BOARD_SIZE - 1, c + 1);
                        else nextR = Math.min(BOARD_SIZE - 1, r + 1);
                    }
                }
                break;
        }

        if (nextR !== r || nextC !== c) {
            setActiveCell({ r: nextR, c: nextC });
            e.preventDefault();
        }
    }, [activeCell, direction, onTilePlace, onTileRemove]);

    const renderCell = (row: number, col: number) => {
        const bonus = getBonusType(row, col);
        const initialTile = initialTiles.find(t => t.row === row && t.col === col);
        const placedTile = placedTiles.find(t => t.row === row && t.col === col);
        const tile = initialTile || placedTile;

        const isActive = activeCell?.r === row && activeCell?.c === col;
        const bonusStyle = bonus ? BONUS_STYLES[bonus] : null;

        return (
            <div
                key={`${row}-${col}`}
                onClick={() => handleCellClick(row, col)}
                className={clsx(
                    "aspect-square flex items-center justify-center relative select-none cursor-pointer",
                    "rounded-[3px] transition-all duration-75",
                    isActive && "z-10 ring-2 ring-blue-400 ring-offset-1 shadow-lg", // Focus ring
                    !tile && !isActive && "hover:brightness-95"
                )}
                style={{
                    backgroundColor: !tile && bonusStyle ? bonusStyle.bg : '#f4f4f4',
                }}
            >
                {/* Direction Indicator on Active Cell */}
                {isActive && !tile && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                        {direction === 'H' ? <ArrowRight size={16} /> : <ArrowDown size={16} />}
                    </div>
                )}

                {/* Bonus Label */}
                {!tile && bonus && (
                    <span className={clsx(
                        "text-[10px] font-bold opacity-80",
                        bonusStyle?.text
                    )}>
                        {BONUS_LABELS[bonus]}
                    </span>
                )}

                {/* Tile */}
                {tile && (
                    <BoardTile
                        letter={tile.char}
                        isAnchor={!!initialTile}
                        isPlaced={!!placedTile}
                    />
                )}
            </div>
        );
    };

    return (
        <div
            ref={boardRef}
            tabIndex={0} // Make focusable
            onKeyDown={handleKeyDown}
            className="bg-white p-3 rounded-xl inline-block outline-none"
            style={{
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                border: '1px solid #e2e8f0'
            }}
        >
            <div
                className="grid gap-[2px] rounded-lg overflow-hidden bg-[#d9d9d9] border border-[#d9d9d9]"
                style={{
                    gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(24px, 34px))`,
                    gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(24px, 34px))`,
                }}
            >
                {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, i) => {
                    const row = Math.floor(i / BOARD_SIZE);
                    const col = i % BOARD_SIZE;
                    return renderCell(row, col);
                })}
            </div>
        </div>
    );
};
