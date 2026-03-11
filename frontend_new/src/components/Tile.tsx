import React from 'react';

interface TileProps {
    letter: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    active?: boolean;
    onClick?: () => void;
}

const points: Record<string, number> = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 10, L: 1, M: 2,
    N: 1, O: 1, P: 3, Q: 8, R: 1, S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
    '?': 0
};

const Tile: React.FC<TileProps> = ({ letter, size = 'sm', active = false, onClick }) => {
    const sizeClasses = {
        xs: 'w-5 h-5 text-[10px]',
        sm: 'w-6 h-6 text-xs',
        md: 'w-8 h-8 text-sm',
        lg: 'w-10 h-10 text-base',
    };

    const pointSize = {
        xs: 'text-[6px] bottom-0 right-0.5',
        sm: 'text-[7px] bottom-0.5 right-0.5',
        md: 'text-[8px] bottom-0.5 right-1',
        lg: 'text-[9px] bottom-1 right-1',
    };

    return (
        <div
            onClick={onClick}
            className={`
        ${sizeClasses[size]} 
        ${active
                    ? 'bg-yellow-200 -translate-y-0.5 shadow-lg'
                    : 'bg-scrabble-tile shadow-md'
                }
        text-scrabble-tileText
        relative flex items-center justify-center font-bold rounded 
        border-b-2 border-r border-scrabble-tileBorder
        cursor-pointer transition-all duration-150 select-none
      `}
        >
            <span>{letter}</span>
            <span className={`absolute ${pointSize[size]} font-normal opacity-60 leading-none`}>
                {points[letter] || 0}
            </span>
        </div>
    );
};

export default Tile;
