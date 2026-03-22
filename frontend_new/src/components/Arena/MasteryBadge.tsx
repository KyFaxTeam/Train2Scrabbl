import React from 'react';
import { clsx } from 'clsx';
import { MasteryLevel } from '../../types';
import { Star, Eye, BookOpen, CheckCircle, Flame } from 'lucide-react';

interface MasteryBadgeProps {
    level: MasteryLevel;
    size?: 'xs' | 'sm' | 'md';
    showLabel?: boolean;
}

const MASTERY_CONFIG: Record<MasteryLevel, {
    icon: React.ReactNode;
    color: string;
    bg: string;
    label: string;
}> = {
    [MasteryLevel.UNSEEN]: {
        icon: <Eye className="w-3 h-3" />,
        color: 'text-slate-400',
        bg: 'bg-slate-100',
        label: 'Non vu',
    },
    [MasteryLevel.EXPOSED]: {
        icon: <Eye className="w-3 h-3" />,
        color: 'text-blue-500',
        bg: 'bg-blue-50',
        label: 'Vu',
    },
    [MasteryLevel.LEARNING]: {
        icon: <BookOpen className="w-3 h-3" />,
        color: 'text-amber-500',
        bg: 'bg-amber-50',
        label: 'En cours',
    },
    [MasteryLevel.REVIEWING]: {
        icon: <Star className="w-3 h-3" />,
        color: 'text-orange-500',
        bg: 'bg-orange-50',
        label: 'Révision',
    },
    [MasteryLevel.MASTERED]: {
        icon: <CheckCircle className="w-3 h-3" />,
        color: 'text-emerald-500',
        bg: 'bg-emerald-50',
        label: 'Maîtrisé',
    },
    [MasteryLevel.BURNED]: {
        icon: <Flame className="w-3 h-3" />,
        color: 'text-purple-500',
        bg: 'bg-purple-50',
        label: 'Expert',
    },
};

export const MasteryBadge: React.FC<MasteryBadgeProps> = ({
    level,
    size = 'sm',
    showLabel = false
}) => {
    const config = MASTERY_CONFIG[level];
    
    const sizeClasses = {
        xs: 'p-0.5',
        sm: 'p-1',
        md: 'p-1.5',
    };
    
    if (level === MasteryLevel.UNSEEN) {
        return null; // Ne pas afficher pour les non vus
    }
    
    return (
        <div className={clsx(
            "inline-flex items-center gap-1 rounded-full",
            config.bg,
            config.color,
            sizeClasses[size]
        )}>
            {config.icon}
            {showLabel && (
                <span className="text-xs font-medium pr-1">
                    {config.label}
                </span>
            )}
        </div>
    );
};

export default MasteryBadge;
