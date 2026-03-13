import React, { useState, useRef, useCallback } from 'react';
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
    onDropTile?: (rackId: number, row: number, col: number) => void;
}

const BONUS_LABELS: Record<string, string> = {
    'TW': 'MT', 'DW': 'MD', 'TL': 'LT', 'DL': 'LD', 'CENTER': '★'
};

const BONUS_TEXT_COLORS: Record<string, string> = {
    'TW': 'text-red-100',
    'DW': 'text-rose-900/50',
    'TL': 'text-sky-100',
    'DL': 'text-sky-800/50',
    'CENTER': 'text-rose-900/50'
};

export const ArenaBoard: React.FC<ArenaBoardProps> = ({
    initialTiles,
    placedTiles,
    onCellClick,
    onTilePlace,
    onTileRemove,
    onDropTile
}) => {
    const [activeCell, setActiveCell] = useState<{ r: number, c: number } | null>(null);
    const [direction, setDirection] = useState<'H' | 'V'>('H');
    const [dragOverCell, setDragOverCell] = useState<{ r: number, c: number } | null>(null);
    const boardRef = useRef<HTMLDivElement>(null);

    const handleCellClick = (r: number, c: number) => {
        if (activeCell?.r === r && activeCell?.c === c) {
            setDirection(prev => prev === 'H' ? 'V' : 'H');
        } else {
            setActiveCell({ r, c });
        }
        onCellClick(r, c);
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
                    if (direction === 'H') nextC = Math.max(0, c - 1);
                    else nextR = Math.max(0, r - 1);
                }
                break;
            default:
                if (e.key.length === 1 && e.key.match(/[a-zA-Z]/)) {
                    if (onTilePlace) {
                        onTilePlace(e.key.toUpperCase(), r, c);
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

    // Drag & drop handlers for cells
    const handleDragOver = (e: React.DragEvent, r: number, c: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverCell({ r, c });
    };

    const handleDragLeave = () => {
        setDragOverCell(null);
    };

    const handleDrop = (e: React.DragEvent, r: number, c: number) => {
        e.preventDefault();
        setDragOverCell(null);
        const rackId = parseInt(e.dataTransfer.getData('text/rackId'), 10);
        const char = e.dataTransfer.getData('text/char');
        if (!isNaN(rackId) && char && onDropTile) {
            onDropTile(rackId, r, c);
        }
    };

    const renderCell = (row: number, col: number) => {
        const bonus = getBonusType(row, col);
        const isCenter = row === 7 && col === 7;
        const initialTile = initialTiles.find(t => t.row === row && t.col === col);
        const placedTile = placedTiles.find(t => t.row === row && t.col === col);
        const tile = initialTile || placedTile;

        const isActive = activeCell?.r === row && activeCell?.c === col;
        const isDragTarget = dragOverCell?.r === row && dragOverCell?.c === col;
        const bonusKey = isCenter && !bonus ? 'CENTER' : bonus;

        // Background color
        let bgColor = 'var(--color-cell-empty)';
        if (!tile && bonusKey) {
            bgColor = `var(--color-bonus-${bonusKey === 'CENTER' ? 'center' : bonusKey.toLowerCase()})`;
        }

        return (
            <div
                key={`${row}-${col}`}
                data-cell={`${row}-${col}`}
                onClick={() => handleCellClick(row, col)}
                onDragOver={(e) => handleDragOver(e, row, col)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, row, col)}
                className={clsx(
                    "aspect-square flex items-center justify-center relative select-none cursor-pointer",
                    "rounded-sm transition-all duration-75",
                    isActive && "z-10 ring-2 ring-amber-400 ring-offset-1",
                    isDragTarget && !tile && "z-10 ring-2 ring-amber-400 ring-offset-1 brightness-110",
                    !tile && !isActive && !isDragTarget && "hover:brightness-[0.92]"
                )}
                style={{ backgroundColor: bgColor }}
            >
                {/* Direction indicator */}
                {isActive && !tile && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-25 pointer-events-none">
                        {direction === 'H' ? <ArrowRight size={14} /> : <ArrowDown size={14} />}
                    </div>
                )}

                {/* Bonus label — minimal */}
                {!tile && bonusKey && (
                    <span className={clsx(
                        "text-[7px] font-semibold uppercase tracking-wide pointer-events-none",
                        bonusKey === 'CENTER' ? 'text-[16px] opacity-40' : 'opacity-50',
                        BONUS_TEXT_COLORS[bonusKey] || 'text-slate-500/50'
                    )}>
                        {BONUS_LABELS[bonusKey]}
                    </span>
                )}

                {/* Tile */}
                {tile && (
                    <BoardTile
                        letter={tile.char}
                        isAnchor={!!initialTile}
                        isPlaced={!!placedTile}
                        draggable={!!placedTile}
                        onDragStart={placedTile ? (e) => {
                            e.dataTransfer.setData('text/rackId', String(placedTile.rackId));
                            e.dataTransfer.setData('text/char', placedTile.char);
                            e.dataTransfer.setData('text/fromBoard', 'true');
                            e.dataTransfer.setData('text/fromRow', String(row));
                            e.dataTransfer.setData('text/fromCol', String(col));
                        } : undefined}
                    />
                )}
            </div>
        );
    };

    return (
        <div
            ref={boardRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="rounded-xl inline-block outline-none p-2 bg-[var(--color-board-gap)]"
            style={{
                boxShadow: 'var(--box-shadow-board)',
                border: '2px solid var(--color-board-border)'
            }}
        >
            <div
                className="grid gap-[1.5px] rounded-lg overflow-hidden"
                style={{
                    gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(22px, 32px))`,
                    gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(22px, 32px))`,
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
