import React, { useState, useEffect } from 'react';
import { generateBatch } from '../services/trainingService';
import type { Puzzle } from '../services/trainingService';
import { ArenaBoard } from '../components/Arena/ArenaBoard';
import { useAppStore } from '../store/useAppStore';
import { useLearningStore } from '../store/useLearningStore';
import { XPFeedback } from '../components/Learning/XPFeedback';
import type { XPReward, WordMastery } from '../types';
import { clsx } from 'clsx';
import confetti from 'canvas-confetti';
import { RefreshCw, Check, HelpCircle, Flame, Star } from 'lucide-react';

const TrainingPage: React.FC = () => {
    const { isSidebarOpen } = useAppStore();
    const { recordTestResult, sessionCorrectStreak, userProgress } = useLearningStore();

    const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
    const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
    const [placedTiles, setPlacedTiles] = useState<{ row: number; col: number; char: string; rackId: number }[]>([]);
    const [selectedRackTile, setSelectedRackTile] = useState<number | null>(null);
    const [rackTiles, setRackTiles] = useState<{ char: string; id: number; used: boolean }[]>([]);
    const [feedback, setFeedback] = useState<'idle' | 'success' | 'error'>('idle');

    const [error, setError] = useState<string | null>(null);

    // Timer pour mesurer le temps de réponse
    const [puzzleStartTime, setPuzzleStartTime] = useState<number>(Date.now());

    // Feedback XP modal
    const [showXPFeedback, setShowXPFeedback] = useState(false);
    const [lastResult, setLastResult] = useState<{
        correct: boolean;
        word: string;
        expectedWord: string;
        xp: XPReward;
        mastery?: WordMastery;
    } | null>(null);

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
        setPuzzleStartTime(Date.now()); // Reset timer pour ce puzzle
        setShowXPFeedback(false);
    };

    const handleRackClick = (index: number) => {
        if (rackTiles[index].used) return;
        setSelectedRackTile(selectedRackTile === index ? null : index);
    };

    const handleBoardClick = (row: number, col: number) => {
        // If clicking an existing placed tile, return it to rack
        const existingTileIndex = placedTiles.findIndex(t => t.row === row && t.col === col);
        if (existingTileIndex !== -1) {
            handleTileRemove(row, col);
            return;
        }

        // If placing a new tile from selected rack tile
        if (selectedRackTile !== null) {
            const tile = rackTiles[selectedRackTile];
            handleTilePlace(tile.char, row, col);
            setSelectedRackTile(null);
        }
    };

    const handleTilePlace = (char: string, row: number, col: number) => {
        // Find first available tile in rack matching char
        const rackIndex = rackTiles.findIndex(t => t.char === char && !t.used);
        if (rackIndex === -1) return; // Not in rack or already used

        setPlacedTiles(prev => [...prev, { row, col, char, rackId: rackTiles[rackIndex].id }]);
        setRackTiles(prev => prev.map((t, i) => i === rackIndex ? { ...t, used: true } : t));
    };

    const handleTileRemove = (row: number, col: number) => {
        const tileToRemove = placedTiles.find(t => t.row === row && t.col === col);
        if (!tileToRemove) return;

        setPlacedTiles(prev => prev.filter(t => t !== tileToRemove));
        setRackTiles(prev => prev.map(t => t.id === tileToRemove.rackId ? { ...t, used: false } : t));
    };

    // Reconstruit le mot placé par l'utilisateur
    const getPlacedWord = (): string => {
        if (placedTiles.length === 0) return '';

        // Trier par position (horizontal d'abord, puis vertical)
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

        // Construire le wordId: DRAW-APPUI-WORD
        const draw = puzzle.rack.sort().join('');
        const appuiLetter = puzzle.boardConfig.initialTiles[0]?.char || 'X';
        const wordId = `${draw}-${appuiLetter}-${expectedWord}`;

        // Enregistrer le résultat via le learning store
        const { mastery, xp } = await recordTestResult(wordId, isCorrect, responseTime);

        // Préparer le feedback
        setLastResult({
            correct: isCorrect,
            word: isCorrect ? placedWord : placedWord || '(rien)',
            expectedWord,
            xp,
            mastery
        });

        if (isCorrect) {
            setFeedback('success');
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        } else {
            setFeedback('error');
        }

        // Afficher le modal XP
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
                <div className="text-red-500 font-bold text-lg">Oups! Une erreur est survenue</div>
                <p>{error}</p>
                <button
                    onClick={startNewBatch}
                    className="px-4 py-2 bg-lexis-gold text-lexis-slate font-bold rounded-lg hover:bg-yellow-400"
                >
                    Réessayer
                </button>
            </div>
        );
    }

    if (!currentPuzzle) return <div className="h-full flex items-center justify-center text-slate-400 font-medium">Chargement de l'arène...</div>;

    return (
        <div className="h-full flex flex-col bg-lexis-bg overflow-hidden">
            {/* Header avec stats gamifiées */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10">
                <div>
                    <h1 className="text-xl font-bold text-lexis-slate">The Arena</h1>
                    <p className="text-sm text-slate-500">Puzzle {currentPuzzleIndex + 1} / {puzzles.length}</p>
                </div>

                {/* Stats de session */}
                <div className="flex items-center gap-4">
                    {sessionCorrectStreak > 0 && (
                        <div className="flex items-center gap-1 text-amber-500" title="Combo actuel">
                            <Flame className="w-5 h-5" />
                            <span className="font-bold">{sessionCorrectStreak}</span>
                        </div>
                    )}
                    {userProgress && (
                        <div className="flex items-center gap-1 text-emerald-600" title="XP total">
                            <Star className="w-5 h-5" />
                            <span className="font-bold">{userProgress.totalXP}</span>
                        </div>
                    )}
                    <button onClick={startNewBatch} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Game Area */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Board Container */}
                <div className="flex-1 overflow-auto p-4 flex justify-center items-start bg-slate-50/50">
                    <div className="scale-[0.65] sm:scale-[0.8] md:scale-90 lg:scale-100 origin-top transition-transform">
                        <ArenaBoard
                            initialTiles={currentPuzzle.boardConfig.initialTiles}
                            placedTiles={placedTiles}
                            onCellClick={handleBoardClick}
                            onTilePlace={handleTilePlace}
                            onTileRemove={handleTileRemove}
                        />
                    </div>
                </div>

                {/* Controls Container */}
                <div className="w-full lg:w-80 bg-white border-l border-slate-200 p-6 flex flex-col gap-6 shadow-xl z-20">

                    {/* Rack */}
                    <div className="bg-lexis-slate p-4 rounded-xl shadow-inner">
                        <div className="flex justify-center gap-2 flex-wrap">
                            {rackTiles.map((tile, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleRackClick(i)}
                                    disabled={tile.used}
                                    className={clsx(
                                        "w-10 h-10 rounded font-mono font-bold text-lg flex items-center justify-center transition-all shadow-sm",
                                        tile.used
                                            ? "bg-slate-700/50 text-slate-500 opacity-50 cursor-not-allowed"
                                            : selectedRackTile === i
                                                ? "bg-lexis-gold text-lexis-slate -translate-y-1 ring-2 ring-white"
                                                : "bg-slate-100 text-slate-800 hover:bg-white"
                                    )}
                                >
                                    {tile.char}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 mt-auto">
                        <button
                            onClick={checkAnswer}
                            className={clsx(
                                "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg",
                                feedback === 'error' ? "animate-shake bg-red-500 text-white" :
                                    feedback === 'success' ? "bg-green-500 text-white" :
                                        "bg-lexis-emerald text-white hover:bg-lexis-emerald-dark hover:shadow-lexis-emerald/20"
                            )}
                        >
                            {feedback === 'success' ? <Check /> : "VALIDATE"}
                        </button>

                        <button
                            onClick={() => nextPuzzle()}
                            className="w-full py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <HelpCircle className="w-4 h-4" /> Give Up
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal XP Feedback */}
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
