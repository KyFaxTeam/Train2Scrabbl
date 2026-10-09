import React, { useState } from 'react';
import { clsx } from 'clsx';

const LETTER_POINTS: Record<string, number> = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 10, L: 1, M: 2,
    N: 1, O: 1, P: 3, Q: 8, R: 1, S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
    '?': 0,
};

export interface RackTile {
    char: string;
    id: number;
    used: boolean;
}

interface Rack3DProps {
    tiles: RackTile[];
    selected: number | null;
    disabled: boolean;
    onTileClick: (index: number) => void;
    onTileTouchStart: (e: React.TouchEvent, char: string, id: number) => void;
    /** Un jeton (du chevalet ou du plateau) est lache sur la place `slot`. */
    onDropOnSlot: (rackId: number, slot: number) => void;
    /** Jeton en cours de glisser au doigt : sa place s'estompe. */
    enMain?: number | null;
}

/**
 * Le chevalet en bois : les jetons debout sur une reglette, legerement inclines
 * vers le joueur. Un jeton pose sur le plateau laisse sa place vide.
 *
 * Chaque place (`data-rack-slot`) recoit un jeton glisse : on reordonne ses
 * lettres, ou on reprend un jeton du plateau a l'endroit voulu.
 */
export const Rack3D: React.FC<Rack3DProps> = ({
    tiles, selected, disabled, onTileClick, onTileTouchStart, onDropOnSlot, enMain = null,
}) => {
    const [survol, setSurvol] = useState<number | null>(null);

    const lacher = (e: React.DragEvent, slot: number) => {
        e.preventDefault();
        e.stopPropagation();
        setSurvol(null);
        const rackId = parseInt(e.dataTransfer.getData('text/rackId'), 10);
        if (!isNaN(rackId)) onDropOnSlot(rackId, slot);
    };

    return (
        <div className="relative w-full select-none" style={{ perspective: '600px' }}>
            <div
                data-rack
                className="relative flex justify-center gap-[3px] px-1.5 pt-1 pb-[9px]"
                style={{ transform: 'rotateX(12deg)', transformOrigin: '50% 100%' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => lacher(e, Number.MAX_SAFE_INTEGER)}
            >
                {tiles.map((tile, i) => {
                    const actif = !tile.used && !disabled;
                    const choisi = selected === i && !tile.used;
                    return (
                        <div
                            key={tile.id}
                            data-rack-slot={i}
                            className={clsx(
                                'relative flex-1 min-w-0 max-w-[46px] aspect-[0.92] rounded-[6px] transition-[box-shadow]',
                                survol === i && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-transparent'
                            )}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setSurvol(i); }}
                            onDragLeave={() => setSurvol((s) => (s === i ? null : s))}
                            onDrop={(e) => lacher(e, i)}
                        >
                            {tile.used ? (
                                <div className="absolute inset-0 rounded-[6px] border border-dashed border-amber-900/25 bg-amber-950/[0.06]" />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onTileClick(i)}
                                    draggable={actif}
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/rackId', String(tile.id));
                                        e.dataTransfer.setData('text/char', tile.char);
                                        e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onTouchStart={(e) => { if (actif) onTileTouchStart(e, tile.char, tile.id); }}
                                    disabled={!actif}
                                    aria-label={`Jeton ${tile.char}`}
                                    aria-pressed={choisi}
                                    className={clsx(
                                        'absolute inset-0 rounded-[6px] transition-transform duration-150',
                                        'font-mono font-black leading-none text-[clamp(16px,5vw,23px)]',
                                        actif && 'cursor-grab active:cursor-grabbing',
                                        choisi ? '-translate-y-2' : actif && 'hover:-translate-y-0.5',
                                        enMain === tile.id && 'opacity-30'
                                    )}
                                    style={{
                                        touchAction: 'none',
                                        background: 'linear-gradient(170deg, #fffaf0 0%, #f6e8cf 55%, #ead6b2 100%)',
                                        color: '#3d2a1a',
                                        boxShadow: choisi
                                            ? '0 3px 0 #c4a271, 0 0 0 2px #f59e0b, 0 10px 16px -4px rgba(245,158,11,.6)'
                                            : '0 2px 0 #c4a271, 0 3px 0 #a9875a, 0 6px 8px -3px rgba(40,20,5,.5)',
                                    }}
                                >
                                    <span className="absolute inset-0 flex items-center justify-center">{tile.char}</span>
                                    <span className="absolute bottom-[2px] right-[3px] text-[8px] font-bold opacity-60">
                                        {LETTER_POINTS[tile.char] || ''}
                                    </span>
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* Reglette : le pied du chevalet, derriere la base des jetons */}
                <div
                    aria-hidden
                    className="absolute left-0 right-0 bottom-0 h-[12px] rounded-[5px] -z-10"
                    style={{
                        background: 'linear-gradient(180deg, #a26a35 0%, #7c4a1f 45%, #5b3413 100%)',
                        boxShadow: 'inset 0 1px 0 rgba(255,220,170,.45), 0 5px 12px -4px rgba(30,15,0,.55)',
                    }}
                />
            </div>
        </div>
    );
};
