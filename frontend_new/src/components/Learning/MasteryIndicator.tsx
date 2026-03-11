import React from 'react';
import { clsx } from 'clsx';
import { MasteryLevel } from '../../types';

interface MasteryIndicatorProps {
    level: MasteryLevel;
    testCount: number;
    correctCount: number;
    viewCount: number;
    compact?: boolean;
}

const levelToFilled: Record<MasteryLevel, number> = {
    [MasteryLevel.UNSEEN]: 0,
    [MasteryLevel.EXPOSED]: 1,
    [MasteryLevel.LEARNING]: 2,
    [MasteryLevel.REVIEWING]: 3,
    [MasteryLevel.MASTERED]: 4,
    [MasteryLevel.BURNED]: 5,
};

const levelColors: Record<MasteryLevel, string> = {
    [MasteryLevel.UNSEEN]: 'bg-slate-300',
    [MasteryLevel.EXPOSED]: 'bg-amber-400',
    [MasteryLevel.LEARNING]: 'bg-blue-400',
    [MasteryLevel.REVIEWING]: 'bg-orange-400',
    [MasteryLevel.MASTERED]: 'bg-green-500',
    [MasteryLevel.BURNED]: 'bg-purple-500',
};

export const MasteryIndicator: React.FC<MasteryIndicatorProps> = ({
    level,
    testCount,
    correctCount,
    viewCount,
    compact = false
}) => {
    const filled = levelToFilled[level];
    const totalDots = 5;
    const color = levelColors[level];

    // Tooltip text
    const getTooltip = () => {
        if (level === MasteryLevel.UNSEEN) return 'Jamais vu';
        if (level === MasteryLevel.EXPOSED) return `Vu ${viewCount}x, pas encore testé`;
        const accuracy = testCount > 0 ? Math.round((correctCount / testCount) * 100) : 0;
        return `${testCount} tests, ${accuracy}% correct`;
    };

    if (compact) {
        // Version compacte: juste un dot coloré
        return (
            <span
                className={clsx('w-2 h-2 rounded-full inline-block', color)}
                title={getTooltip()}
            />
        );
    }

    return (
        <div className="flex items-center gap-0.5" title={getTooltip()}>
            {Array.from({ length: totalDots }).map((_, i) => (
                <span
                    key={i}
                    className={clsx(
                        'w-1.5 h-1.5 rounded-full transition-colors',
                        i < filled ? color : 'bg-slate-200'
                    )}
                />
            ))}
        </div>
    );
};

// Version pour un mot non encore chargé (état par défaut)
export const MasteryIndicatorEmpty: React.FC = () => (
    <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-200" />
        ))}
    </div>
);
