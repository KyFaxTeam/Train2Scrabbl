import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Clock, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import type { DrawEntry, StudyRating } from '../../types/dictionary';
import { RATING_CONFIG } from '../../services/arenaSessionService';
import Tile from '../Tile';

interface StudyCardProps {
    entry: DrawEntry;
    onRate: (rating: StudyRating) => void;
    onFlip?: () => void;
}

export const StudyCard: React.FC<StudyCardProps> = ({ entry, onRate, onFlip }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [startTime] = useState(Date.now());
    const [elapsed, setElapsed] = useState(0);

    // Timer
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Date.now() - startTime);
        }, 100);
        return () => clearInterval(interval);
    }, [startTime]);

    const handleFlip = () => {
        setIsFlipped(true);
        onFlip?.();
    };

    const handleRate = (rating: StudyRating) => {
        const responseTime = Date.now() - startTime;
        onRate(rating);
        // Reset for next card
        setIsFlipped(false);
    };

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const tenths = Math.floor((ms % 1000) / 100);
        return `${seconds}.${tenths}s`;
    };

    return (
        <div className="w-full max-w-lg mx-auto perspective-1000">
            <div
                className={clsx(
                    "relative w-full min-h-[400px] transition-transform duration-500 preserve-3d",
                    isFlipped && "rotate-y-180"
                )}
                style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
            >
                {/* Front - Question */}
                <div
                    className={clsx(
                        "absolute w-full h-full backface-hidden",
                        "bg-white rounded-2xl shadow-xl border-2 border-slate-200",
                        "flex flex-col items-center justify-center p-6"
                    )}
                    style={{ backfaceVisibility: 'hidden' }}
                >
                    {/* Timer */}
                    <div className="absolute top-4 right-4 flex items-center gap-1 text-slate-400 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>{formatTime(elapsed)}</span>
                    </div>

                    {/* Tirage */}
                    <div className="mb-8">
                        <div className="flex gap-2 justify-center">
                            {entry.draw.split('').map((char, i) => (
                                <Tile key={i} letter={char} size="lg" />
                            ))}
                        </div>
                    </div>

                    {/* Question */}
                    <p className="text-lg text-slate-600 mb-8 text-center">
                        Quels scrabbles peut-on former ?
                    </p>

                    {/* Flip button */}
                    <button
                        onClick={handleFlip}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/25"
                    >
                        <Eye className="w-5 h-5" />
                        Voir la reponse
                    </button>
                </div>

                {/* Back - Answer */}
                <div
                    className={clsx(
                        "absolute w-full h-full backface-hidden",
                        "bg-white rounded-2xl shadow-xl border-2 border-slate-200",
                        "flex flex-col p-6"
                    )}
                    style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                    }}
                >
                    {/* Tirage mini */}
                    <div className="flex gap-1 justify-center mb-4">
                        {entry.draw.split('').map((char, i) => (
                            <Tile key={i} letter={char} size="xs" />
                        ))}
                    </div>

                    {/* Solutions */}
                    <div className="flex-1 overflow-auto">
                        {entry.solutions.length > 0 && (
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-slate-500 mb-2">
                                    Scrabbles ({entry.solutions.length})
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {entry.solutions.map((word, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1 bg-red-100 text-red-700 rounded-lg font-medium"
                                        >
                                            {word}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {entry.extensions.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 mb-2">
                                    Extensions +1 ({entry.extensions.length})
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {entry.extensions.slice(0, 12).map((ext, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-sm"
                                        >
                                            +{ext.letter} {ext.word}
                                        </span>
                                    ))}
                                    {entry.extensions.length > 12 && (
                                        <span className="px-2 py-1 text-slate-400 text-sm">
                                            +{entry.extensions.length - 12} autres
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Rating buttons */}
                    <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-100">
                        {(['again', 'hard', 'good', 'easy'] as StudyRating[]).map((rating) => {
                            const config = RATING_CONFIG[rating];
                            return (
                                <button
                                    key={rating}
                                    onClick={() => handleRate(rating)}
                                    className={clsx(
                                        "flex flex-col items-center gap-1 py-3 rounded-xl transition-all",
                                        "hover:scale-105 active:scale-95",
                                        rating === 'again' && "bg-red-100 hover:bg-red-200 text-red-700",
                                        rating === 'hard' && "bg-orange-100 hover:bg-orange-200 text-orange-700",
                                        rating === 'good' && "bg-green-100 hover:bg-green-200 text-green-700",
                                        rating === 'easy' && "bg-blue-100 hover:bg-blue-200 text-blue-700"
                                    )}
                                >
                                    <span className="text-xl">{config.emoji}</span>
                                    <span className="text-xs font-medium">{config.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudyCard;
