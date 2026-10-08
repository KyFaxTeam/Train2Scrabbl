import React from 'react';
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
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
}

/**
 * Le chevalet en bois : sept jetons debout sur une reglette, legerement
 * inclines vers le joueur. Un jeton pose sur le plateau laisse sa place vide
 * sur le chevalet - on voit d'un coup d'oeil ce qui reste a poser.
 */
export const Rack3D: React.FC<Rack3DProps> = ({
    tiles, selected, disabled, onTileClick, onTileTouchStart, onTouchMove, onTouchEnd,
}) => (
    <div className="relative w-full max-w-[400px] select-none" style={{ perspective: '700px' }}>
        <div
            className="relative flex justify-center gap-[3px] sm:gap-1 px-2 pt-1 pb-[11px]"
            style={{ transform: 'rotateX(14deg)', transformOrigin: '50% 100%' }}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {tiles.map((tile, i) => {
                const actif = !tile.used && !disabled;
                const choisi = selected === i && !tile.used;
                return (
                    <button
                        key={tile.id}
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
                        aria-label={tile.used ? 'Jeton posé' : `Jeton ${tile.char}`}
                        aria-pressed={choisi}
                        className={clsx(
                            'relative flex-1 max-w-[50px] aspect-[0.92] rounded-[7px] transition-transform duration-150',
                            'font-mono font-black text-[clamp(17px,5.2vw,24px)] leading-none',
                            tile.used
                                ? 'border border-dashed border-amber-900/25 bg-amber-950/10'
                                : choisi
                                    ? '-translate-y-2.5 cursor-grab'
                                    : 'hover:-translate-y-1 cursor-grab active:cursor-grabbing'
                        )}
                        style={tile.used ? undefined : {
                            background: 'linear-gradient(170deg, #fffaf0 0%, #f6e8cf 55%, #ead6b2 100%)',
                            color: '#3d2a1a',
                            boxShadow: choisi
                                ? '0 3px 0 #c4a271, 0 0 0 2px #f59e0b, 0 12px 18px -4px rgba(245,158,11,.55)'
                                : '0 3px 0 #c4a271, 0 4px 0 #a9875a, 0 7px 10px -3px rgba(40,20,5,.55)',
                        }}
                    >
                        {!tile.used && (
                            <>
                                <span className="absolute inset-0 flex items-center justify-center">{tile.char}</span>
                                <span className="absolute bottom-[3px] right-[4px] text-[9px] font-bold opacity-60">
                                    {LETTER_POINTS[tile.char] || ''}
                                </span>
                            </>
                        )}
                    </button>
                );
            })}

            {/* Reglette : la levre avant du chevalet, devant le pied des jetons */}
            <div
                aria-hidden
                className="absolute left-0 right-0 bottom-0 h-[14px] rounded-[5px] -z-10"
                style={{
                    background: 'linear-gradient(180deg, #a26a35 0%, #7c4a1f 45%, #5b3413 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,220,170,.45), 0 6px 14px -4px rgba(30,15,0,.6)',
                }}
            />
        </div>
    </div>
);
