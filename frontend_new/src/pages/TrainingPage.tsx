import React, { useState, useEffect, useCallback } from 'react';
import { generateBatch } from '../services/trainingService';
import type { Puzzle } from '../services/trainingService';
import { ArenaBoard } from '../components/Arena/ArenaBoard';
import { useLearningStore } from '../store/useLearningStore';
import { XPFeedback } from '../components/Learning/XPFeedback';
import { useTouchDragDrop } from '../hooks/useTouchDragDrop';
import type { XPReward, WordMastery } from '../types';
import { clsx } from 'clsx';
import confetti from 'canvas-confetti';
import { RefreshCw, Check, HelpCircle, Flame, Star } from 'lucide-react';

const LETTER_POINTS: Record<string, number> = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 10, L: 1, M: 2,
    N: 1, O: 1, P: 3, Q: 8, R: 1, S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
    '?': 0
};

const TrainingPage: React.FC = () => {
    const { recordTestResult, sessionCorrectStreak, userProgress } = useLearningStore();

    const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
    const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
    const [placedTiles, setPlacedTiles] = useState<{ row: number; col: number; char: string; rackId: number }[]>([]);
    const [selectedRackTile, setSelectedRackTile] = useState<number | null>(null);
    const [rackTiles, setRackTiles] = useState<{ char: string; id: number; used: boolean }[]>([]);
    const [feedback, setFeedback] = useState<'idle' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [puzzleStartTime, setPuzzleStartTime] = useState<number>(Date.now());
    const [showXPFeedback, setShowXPFeedback] = useState(false);
    const [lastResult, setLastResult] = useState<{
        correct: boolean;
        word: string;
        expectedWord: string;
        xp: XPReward;
        mastery?: WordMastery;
    } | null>(null);

    // D&D: drop handler used by both desktop and touch
    const handleDropTile = useCallback((rackId: number, row: number, col: number) => {
        // Check cell is not occupied by initial tile
        const currentPuzzle = puzzles[currentPuzzleIndex];
        if (!currentPuzzle) return;
        const isInitial = currentPuzzle.boardConfig.initialTiles.some(
            t => t.row === row && t.col === col
        );
        if (isInitial) return;

        // If there's already a placed tile in this cell, remove it first
        const existingPlaced = placedTiles.find(t => t.row === row && t.col === col);
        if (existingPlaced) {
            setPlacedTiles(prev => prev.filter(t => t !== existingPlaced));
            setRackTiles(prev => prev.map(t => t.id === existingPlaced.rackId ? { ...t, used: false } : t));
        }

        // Check the rackId tile is still available (or was just from board drag)
        const rackTile = rackTiles.find(t => t.id === rackId);
        if (!rackTile) return;

        // Remove from old position if dragged from board
        setPlacedTiles(prev => {
            const withoutOld = prev.filter(t => t.rackId !== rackId);
            return [...withoutOld, { row, col, char: rackTile.char, rackId }];
        });
        setRackTiles(prev => prev.map(t => t.id === rackId ? { ...t, used: true } : t));
        setSelectedRackTile(null);
    }, [puzzles, currentPuzzleIndex, placedTiles, rackTiles]);

    // Touch D&D hook
    const { dragState, handleTouchStart, handleTouchMove, handleTouchEnd } = useTouchDragDrop(handleDropTile);

    // Load initial batch
    useEffect(() => {
        startNewBatch();
    }, []);

    const startNewBatch = async () => {
        try {
            setError(null);
            const batch = await generateBatch(5);
            setPuzzles(batch);
            setCurrentPuzzleIndex(0);
            if (batch.length > 0) {
                setupPuzzle(batch[0]);
            }
        } catch (e) {
            console.error("Error starting batch:", e);
            setError("Impossible de charger l'entraînement. Vérifiez que le serveur backend est lancé (port 8000).");
        }
    };

    const setupPuzzle = (puzzle: Puzzle) => {
        setPlacedTiles([]);
        setFeedback('idle');
        setSelectedRackTile(null);
        setRackTiles(puzzle.rack.map((char, i) => ({ char, id: i, used: false })));
        setPuzzleStartTime(Date.now());
        setShowXPFeedback(false);
    };

    const handleRackClick = (index: number) => {
        if (rackTiles[index].used) return;
        setSelectedRackTile(selectedRackTile === index ? null : index);
    };

    const handleBoardClick = (row: number, col: number) => {
        const existingTileIndex = placedTiles.findIndex(t => t.row === row && t.col === col);
        if (existingTileIndex !== -1) {
            handleTileRemove(row, col);
            return;
        }
        if (selectedRackTile !== null) {
            const tile = rackTiles[selectedRackTile];
            handleTilePlace(tile.char, row, col);
            setSelectedRackTile(null);
        }
    };

    const handleTilePlace = (char: string, row: number, col: number) => {
        const rackIndex = rackTiles.findIndex(t => t.char === char && !t.used);
        if (rackIndex === -1) return;
        setPlacedTiles(prev => [...prev, { row, col, char, rackId: rackTiles[rackIndex].id }]);
        setRackTiles(prev => prev.map((t, i) => i === rackIndex ? { ...t, used: true } : t));
    };

    const handleTileRemove = (row: number, col: number) => {
        const tileToRemove = placedTiles.find(t => t.row === row && t.col === col);
        if (!tileToRemove) return;
        setPlacedTiles(prev => prev.filter(t => t !== tileToRemove));
        setRackTiles(prev => prev.map(t => t.id === tileToRemove.rackId ? { ...t, used: false } : t));
    };

    const getPlacedWord = (): string => {
        if (placedTiles.length === 0) return '';
        const sorted = [...placedTiles].sort((a, b) => {
            if (a.row === b.row) return a.col - b.col;
            return a.row - b.row;
        });
        return sorted.map(t => t.char).join('');
    };

    const checkAnswer = async () => {
        const puzzle = puzzles[currentPuzzleIndex];
        if (!puzzle) return;

        const placedWord = getPlacedWord();
        const expectedWord = puzzle.solution.word;
        const isCorrect = placedWord.toUpperCase() === expectedWord.toUpperCase();
        const responseTime = Date.now() - puzzleStartTime;

        const draw = puzzle.rack.sort().join('');
        const appuiLetter = puzzle.boardConfig.initialTiles[0]?.char || 'X';
        const wordId = `${draw}-${appuiLetter}-${expectedWord}`;

        const { mastery, xp } = await recordTestResult(wordId, isCorrect, responseTime);

        setLastResult({
            correct: isCorrect,
            word: isCorrect ? placedWord : placedWord || '(rien)',
            expectedWord,
            xp,
            mastery
        });

        if (isCorrect) {
            setFeedback('success');
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        } else {
            setFeedback('error');
        }
        setShowXPFeedback(true);
    };

    const handleContinueAfterFeedback = () => {
        setShowXPFeedback(false);
        setLastResult(null);
        nextPuzzle();
    };

    const nextPuzzle = () => {
        if (currentPuzzleIndex < puzzles.length - 1) {
            const nextIndex = currentPuzzleIndex + 1;
            setCurrentPuzzleIndex(nextIndex);
            setupPuzzle(puzzles[nextIndex]);
        } else {
            startNewBatch();
        }
    };

    const currentPuzzle = puzzles[currentPuzzleIndex];

    if (error) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-500">
                <div className="text-red-500 font-bold text-lg">Oups!</div>
                <p className="text-center px-4">{error}</p>
                <button
                    onClick={startNewBatch}
                    className="px-6 py-2 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors"
                >
                    Réessayer
                </button>
            </div>
        );
    }

    if (!currentPuzzle) {
        return (
            <div className="h-full flex items-center justify-center text-slate-400 font-medium">
                Chargement...
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Header — compact */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-4 py-3 flex justify-between items-center z-30">
                <div className="flex items-center gap-3">
                    <h1 className="text-lg font-bold text-slate-800">Arena</h1>
                    <span className="text-xs text-slate-400 font-medium">
                        {currentPuzzleIndex + 1}/{puzzles.length}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {sessionCorrectStreak > 0 && (
                        <div className="flex items-center gap-1 text-amber-500" title="Combo">
                            <Flame className="w-4 h-4" />
                            <span className="font-bold text-sm">{sessionCorrectStreak}</span>
                        </div>
                    )}
                    {userProgress && (
                        <div className="flex items-center gap-1 text-emerald-600" title="XP">
                            <Star className="w-4 h-4" />
                            <span className="font-bold text-sm">{userProgress.totalXP}</span>
                        </div>
                    )}
                    <button onClick={startNewBatch} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Board area — takes all available space */}
            <div className="flex-1 overflow-auto flex justify-center items-start p-3 sm:p-4 lg:p-6">
                <div className="lg:scale-100 md:scale-95 sm:scale-90 scale-[0.78] origin-top transition-transform">
                    <ArenaBoard
                        initialTiles={currentPuzzle.boardConfig.initialTiles}
                        placedTiles={placedTiles}
                        onCellClick={handleBoardClick}
                        onTilePlace={handleTilePlace}
                        onTileRemove={handleTileRemove}
                        onDropTile={handleDropTile}
                    />
                </div>
            </div>

            {/* Floating Rack + Controls — fixed at bottom */}
            <div className="fixed bottom-16 sm:bottom-4 left-3 right-3 sm:left-auto sm:right-4 sm:w-auto z-40
                            bg-slate-900/85 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/20
                            p-3 sm:p-4 flex flex-col gap-3
                            border border-white/10">

                {/* Rack tiles */}
                <div
                    className="flex justify-center gap-1.5 sm:gap-2"
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {rackTiles.map((tile, i) => (
                        <button
                            key={tile.id}
                            onClick={() => handleRackClick(i)}
                            draggable={!tile.used}
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/rackId', String(tile.id));
                                e.dataTransfer.setData('text/char', tile.char);
                                e.dataTransfer.effectAllowed = 'move';
                            }}
                            onTouchStart={(e) => {
                                if (!tile.used) handleTouchStart(e, tile.char, tile.id);
                            }}
                            disabled={tile.used}
                            className={clsx(
                                "w-11 h-11 sm:w-12 sm:h-12 rounded-lg font-mono font-bold text-lg",
                                "flex items-center justify-center relative transition-all duration-150",
                                tile.used
                                    ? "bg-white/5 text-white/20 cursor-not-allowed scale-90"
                                    : selectedRackTile === i
                                        ? "bg-amber-500 text-amber-950 -translate-y-1.5 shadow-lg shadow-amber-500/40 ring-2 ring-white/60"
                                        : "bg-[#F7F0E6] text-[#4A3728] hover:bg-white hover:-translate-y-0.5 cursor-grab active:cursor-grabbing shadow-md"
                            )}
                        >
                            <span>{tile.char}</span>
                            {!tile.used && (
                                <span className="absolute bottom-0.5 right-1 text-[7px] font-normal opacity-60">
                                    {LETTER_POINTS[tile.char] || ''}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Action buttons row */}
                <div className="flex gap-2">
                    <button
                        onClick={() => nextPuzzle()}
                        className="px-3 py-2.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/10
                                   transition-all text-sm font-medium flex items-center gap-1"
                    >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Passer</span>
                    </button>

                    <button
                        onClick={checkAnswer}
                        className={clsx(
                            "flex-1 py-2.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all",
                            feedback === 'error'
                                ? "animate-shake bg-red-500 text-white"
                                : feedback === 'success'
                                    ? "bg-emerald-500 text-white"
                                    : "bg-gradient-to-r from-amber-500 to-amber-400 text-amber-950 hover:from-amber-400 hover:to-amber-300 shadow-lg shadow-amber-500/30"
                        )}
                    >
                        {feedback === 'success' ? <Check className="w-5 h-5" /> : "VALIDER"}
                    </button>
                </div>
            </div>

            {/* Touch drag ghost */}
            {dragState.isDragging && dragState.ghostPosition && dragState.draggedTile && (
                <div
                    className="fixed pointer-events-none z-50"
                    style={{
                        left: dragState.ghostPosition.x - 22,
                        top: dragState.ghostPosition.y - 44,
                    }}
                >
                    <div className="w-11 h-11 rounded-lg bg-amber-500 text-amber-950 font-mono font-bold text-lg
                                    flex items-center justify-center shadow-xl shadow-amber-500/50
                                    ring-2 ring-white/60 scale-110">
                        {dragState.draggedTile.char}
                    </div>
                </div>
            )}

            {/* XP Feedback Modal */}
            {lastResult && (
                <XPFeedback
                    isOpen={showXPFeedback}
                    correct={lastResult.correct}
                    word={lastResult.word}
                    expectedWord={lastResult.expectedWord}
                    xp={lastResult.xp}
                    mastery={lastResult.mastery}
                    onContinue={handleContinueAfterFeedback}
                />
            )}
        </div>
    );
};

export default TrainingPage;
