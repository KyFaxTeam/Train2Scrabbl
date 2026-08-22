import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { generateBatch } from '../services/trainingService';
import type { Puzzle } from '../services/trainingService';
import { EngineWorkerClient, type InitProgress, type MoveReview } from '../engine/WorkerClient';
import { ArenaBoard } from '../components/Arena/ArenaBoard';
import { useLearningStore } from '../store/useLearningStore';
import { XPFeedback } from '../components/Learning/XPFeedback';
import { useTouchDragDrop } from '../hooks/useTouchDragDrop';
import type { XPReward, WordMastery } from '../types';
import { clsx } from 'clsx';
import confetti from 'canvas-confetti';
import { RefreshCw, Check, Eye, Flame, Star, Loader2, AlertTriangle } from 'lucide-react';

const LETTER_POINTS: Record<string, number> = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 10, L: 1, M: 2,
    N: 1, O: 1, P: 3, Q: 8, R: 1, S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
    '?': 0
};

const DIFFICULTY_LABEL: Record<Puzzle['metadata']['difficulty'], string> = {
    facile: 'Facile',
    moyen: 'Moyen',
    difficile: 'Difficile',
};

interface PlayResult {
    correct: boolean;
    title: string;
    playedWord: string;
    expectedWord: string;
    playedScore: number | null;
    bestScore: number | null;
    wordsFormed: string[];
    xp: XPReward;
    mastery?: WordMastery;
}

const TrainingPage: React.FC = () => {
    const { recordTestResult, sessionCorrectStreak, userProgress, startSession, endSession } = useLearningStore();

    const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
    const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
    const [placedTiles, setPlacedTiles] = useState<{ row: number; col: number; char: string; rackId: number }[]>([]);
    const [selectedRackTile, setSelectedRackTile] = useState<number | null>(null);
    const [rackTiles, setRackTiles] = useState<{ char: string; id: number; used: boolean }[]>([]);
    const [feedback, setFeedback] = useState<'idle' | 'checking' | 'refused' | 'success' | 'error'>('idle');
    const [refusal, setRefusal] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<InitProgress | null>(null);
    const [puzzleStartTime, setPuzzleStartTime] = useState<number>(Date.now());
    const [revealSolution, setRevealSolution] = useState(false);
    const [showXPFeedback, setShowXPFeedback] = useState(false);
    const [lastResult, setLastResult] = useState<PlayResult | null>(null);
    const batchToken = useRef(0);

    const currentPuzzle = puzzles[currentPuzzleIndex];

    // D&D: drop handler used by both desktop and touch
    const handleDropTile = useCallback((rackId: number, row: number, col: number) => {
        const puzzle = puzzles[currentPuzzleIndex];
        if (!puzzle) return;
        const isInitial = puzzle.boardConfig.initialTiles.some(t => t.row === row && t.col === col);
        if (isInitial) return;

        const existingPlaced = placedTiles.find(t => t.row === row && t.col === col);
        if (existingPlaced) {
            setPlacedTiles(prev => prev.filter(t => t !== existingPlaced));
            setRackTiles(prev => prev.map(t => t.id === existingPlaced.rackId ? { ...t, used: false } : t));
        }

        const rackTile = rackTiles.find(t => t.id === rackId);
        if (!rackTile) return;

        setPlacedTiles(prev => {
            const withoutOld = prev.filter(t => t.rackId !== rackId);
            return [...withoutOld, { row, col, char: rackTile.char, rackId }];
        });
        setRackTiles(prev => prev.map(t => t.id === rackId ? { ...t, used: true } : t));
        setSelectedRackTile(null);
        setRefusal(null);
    }, [puzzles, currentPuzzleIndex, placedTiles, rackTiles]);

    const { dragState, handleTouchStart, handleTouchMove, handleTouchEnd } = useTouchDragDrop(handleDropTile);

    useEffect(() => {
        startSession();
        startNewBatch();
        return () => { endSession(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setupPuzzle = (puzzle: Puzzle) => {
        setPlacedTiles([]);
        setFeedback('idle');
        setRefusal(null);
        setRevealSolution(false);
        setSelectedRackTile(null);
        setRackTiles(puzzle.rack.map((char, i) => ({ char, id: i, used: false })));
        setPuzzleStartTime(Date.now());
        setShowXPFeedback(false);
    };

    const startNewBatch = async () => {
        // Un lot arrivant par morceaux, il faut savoir a quel lot chaque
        // exercice appartient : sans ce jeton, le double montage de
        // `StrictMode` (et un clic de plus sur « nouveau lot ») empilaient deux
        // series dans la meme liste — l'ecran annoncait 1/10.
        const token = ++batchToken.current;

        try {
            setError(null);
            setPuzzles([]);
            setCurrentPuzzleIndex(0);
            EngineWorkerClient.getInstance().setProgressListener(setProgress);

            // Le premier exercice s'affiche des qu'il est pret, les suivants se
            // calculent pendant que le joueur cherche. Auparavant les cinq
            // etaient generes en serie avant le premier pixel utile.
            let first = true;
            await generateBatch(5, puzzle => {
                if (batchToken.current !== token) return;
                setPuzzles(prev => [...prev, puzzle]);
                if (first) {
                    first = false;
                    setupPuzzle(puzzle);
                    setProgress(null);
                }
            });
            if (batchToken.current !== token) return;
        } catch (e) {
            console.error('Echec du lot d entrainement', e);
            if (batchToken.current === token) {
                setError(e instanceof Error ? e.message : "Impossible de charger l entrainement.");
            }
        } finally {
            EngineWorkerClient.getInstance().setProgressListener(null);
            setProgress(null);
        }
    };

    const handleRackClick = (index: number) => {
        if (rackTiles[index].used || revealSolution) return;
        setSelectedRackTile(selectedRackTile === index ? null : index);
    };

    const handleBoardClick = (row: number, col: number) => {
        if (revealSolution) return;
        const existing = placedTiles.findIndex(t => t.row === row && t.col === col);
        if (existing !== -1) {
            handleTileRemove(row, col);
            return;
        }
        if (selectedRackTile !== null) {
            handleTilePlace(rackTiles[selectedRackTile].char, row, col);
            setSelectedRackTile(null);
        }
    };

    const handleTilePlace = (char: string, row: number, col: number) => {
        if (revealSolution) return;
        if (currentPuzzle?.boardConfig.initialTiles.some(t => t.row === row && t.col === col)) return;
        if (placedTiles.some(t => t.row === row && t.col === col)) return;

        const rackIndex = rackTiles.findIndex(t => t.char === char && !t.used);
        if (rackIndex === -1) return;
        setPlacedTiles(prev => [...prev, { row, col, char, rackId: rackTiles[rackIndex].id }]);
        setRackTiles(prev => prev.map((t, i) => i === rackIndex ? { ...t, used: true } : t));
        setRefusal(null);
    };

    const handleTileRemove = (row: number, col: number) => {
        const tileToRemove = placedTiles.find(t => t.row === row && t.col === col);
        if (!tileToRemove) return;
        setPlacedTiles(prev => prev.filter(t => t !== tileToRemove));
        setRackTiles(prev => prev.map(t => t.id === tileToRemove.rackId ? { ...t, used: false } : t));
        setRefusal(null);
    };

    const resetPlacement = () => {
        setPlacedTiles([]);
        setRackTiles(prev => prev.map(t => ({ ...t, used: false })));
        setSelectedRackTile(null);
        setRefusal(null);
        setFeedback('idle');
    };

    /** Cle de repetition espacee, au format attendu par le magasin :
     *  `tirage - lettre d extension - mot`. Le champ du milieu est vide ici
     *  (l entrainement ne travaille pas de rallonge), mais il doit exister :
     *  `updateAfterTest` decoupe la cle sur les tirets et prend `slice(2)` comme
     *  mot. Avec une cle en deux morceaux, le mot enregistre etait la chaine
     *  vide - et les revisions qui revenaient plus tard ne portaient sur rien. */
    const buildWordId = (puzzle: Puzzle) => `${[...puzzle.rack].sort().join('')}--${puzzle.solution.word}`;

    const enregistrer = async (puzzle: Puzzle, correct: boolean, review: MoveReview | null, title: string) => {
        const responseTime = Date.now() - puzzleStartTime;
        const { mastery, xp } = await recordTestResult(buildWordId(puzzle), correct, responseTime);

        setLastResult({
            correct,
            title,
            playedWord: review?.verdict.word ?? '(rien)',
            expectedWord: puzzle.solution.word,
            playedScore: review?.verdict.score ?? null,
            bestScore: review?.meilleur?.score ?? puzzle.solution.score,
            wordsFormed: review?.verdict.wordsFormed ?? [],
            xp,
            mastery,
        });

        if (correct) {
            setFeedback('success');
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        } else {
            setFeedback('error');
            setRevealSolution(true);
        }
        setShowXPFeedback(true);
    };

    const checkAnswer = async () => {
        const puzzle = puzzles[currentPuzzleIndex];
        if (!puzzle || feedback === 'checking' || revealSolution) return;

        setFeedback('checking');
        setRefusal(null);

        let review: MoveReview;
        try {
            review = await EngineWorkerClient.getInstance().checkMove(
                puzzle.boardConfig.initialTiles,
                placedTiles.map(t => ({ row: t.row, col: t.col, char: t.char })),
                puzzle.solution.word,
                puzzle.rack
            );
        } catch (e) {
            setFeedback('refused');
            setRefusal(e instanceof Error ? e.message : "Le moteur n a pas pu verifier ce coup.");
            return;
        }

        const { verdict } = review;

        // Un coup illegal n'est pas une mauvaise reponse : c'est un coup que
        // l'arbitre refuse. On le dit, et le joueur corrige - sans que la
        // repetition espacee enregistre un echec de memoire qui n'en est pas un.
        if (!verdict.legal) {
            setFeedback('refused');
            setRefusal(verdict.reason ?? "Ce coup n est pas jouable.");
            return;
        }

        const expected = puzzle.solution.word.toUpperCase();
        const played = (verdict.word ?? '').toUpperCase();

        if (played === expected) {
            await enregistrer(puzzle, true, review, 'Bien collé !');
            return;
        }

        // Le joueur a pose ses sept jetons et forme un autre mot valide : c'est
        // un autre scrabble du meme tirage, la competence visee est la meme.
        if (verdict.tilesUsed === puzzle.rack.length) {
            await enregistrer(puzzle, true, review, `Autre scrabble accepté : ${played}`);
            return;
        }

        await enregistrer(puzzle, false, review, `${played} est jouable, mais ce n'est pas un scrabble`);
    };

    const abandonner = async () => {
        const puzzle = puzzles[currentPuzzleIndex];
        if (!puzzle || revealSolution) return;
        await enregistrer(puzzle, false, null, 'Solution révélée');
    };

    /**
     * Sur une erreur, fermer la fenetre ne passe PAS a l'exercice suivant :
     * elle recouvre le plateau, et c'est justement le plateau qu'il faut
     * regarder - le coup attendu y est affiche. Le joueur enchaine ensuite avec
     * le bouton du bas, quand il a fini de le regarder.
     */
    const handleContinueAfterFeedback = () => {
        const correct = lastResult?.correct ?? false;
        // `lastResult` est remis a zero dans les deux cas : c'est lui qui monte
        // la fenetre. Sans cela, l'enveloppe `fixed inset-0` restait dans le DOM
        // a opacite nulle apres l'animation de sortie et interceptait les clics
        // sur le plateau — verifie dans le navigateur.
        setShowXPFeedback(false);
        setLastResult(null);
        if (correct) nextPuzzle();
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

    /** Les jetons du meilleur collage, pour montrer le coup sur le plateau. */
    const solutionTiles = useMemo(() => {
        if (!revealSolution || !currentPuzzle) return undefined;
        const { word, row, col, direction } = currentPuzzle.solution;
        const occupees = new Set(currentPuzzle.boardConfig.initialTiles.map(t => `${t.row},${t.col}`));

        return word.split('').map((char, i) => ({
            row: row + (direction === 'V' ? i : 0),
            col: col + (direction === 'H' ? i : 0),
            char,
        })).filter(t => !occupees.has(`${t.row},${t.col}`));
    }, [revealSolution, currentPuzzle]);

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
        // Le lexique pese 236 Ko : quelques secondes suffisent desormais. La
        // barre reste utile sur une connexion lente - et `received` peut
        // depasser `total` quand le serveur annonce la taille compressee.
        const pct = progress && progress.total
            ? Math.min(100, Math.round((progress.received / progress.total) * 100))
            : null;

        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-slate-500">
                <div className="w-full max-w-xs">
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className={clsx(
                                'h-full bg-emerald-500 transition-all duration-200',
                                pct === null && 'animate-pulse w-1/3'
                            )}
                            style={pct === null ? undefined : { width: pct + '%' }}
                        />
                    </div>
                </div>
                <p className="text-sm font-medium">
                    {progress
                        ? `Chargement du ${progress.step}${pct === null ? '' : ` — ${pct}%`}`
                        : 'Construction du plateau...'}
                </p>
                <p className="text-xs text-slate-400 text-center">
                    Le lexique (236 Ko) n est telecharge qu une fois, puis conserve sur l appareil.
                </p>
            </div>
        );
    }

    const rackRestant = rackTiles.filter(t => !t.used).length;

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* En-tete */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-4 py-3 flex justify-between items-center z-30">
                <div className="flex items-center gap-3">
                    <h1 className="text-lg font-bold text-slate-800">Entraînement</h1>
                    <span className="text-xs text-slate-400 font-medium">
                        {currentPuzzleIndex + 1}/{puzzles.length}
                    </span>
                    <span className={clsx(
                        'text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
                        currentPuzzle.metadata.difficulty === 'difficile' ? 'bg-red-100 text-red-600'
                            : currentPuzzle.metadata.difficulty === 'moyen' ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                    )}
                        title={`${currentPuzzle.metadata.legalPlacements} collages légaux de ce mot sur ce plateau`}
                    >
                        {DIFFICULTY_LABEL[currentPuzzle.metadata.difficulty]}
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
                    <button
                        onClick={startNewBatch}
                        title="Nouveau lot d exercices"
                        className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Plateau */}
            <div className="flex-1 overflow-auto flex justify-center items-start p-2 sm:p-4 lg:p-6">
                <ArenaBoard
                    initialTiles={currentPuzzle.boardConfig.initialTiles}
                    placedTiles={placedTiles}
                    solutionTiles={solutionTiles}
                    onCellClick={handleBoardClick}
                    onTilePlace={handleTilePlace}
                    onTileRemove={handleTileRemove}
                    onDropTile={handleDropTile}
                />
            </div>

            {/* Chevalet + commandes */}
            <div className="shrink-0 w-full p-2 sm:p-4 pb-20 sm:pb-4 flex justify-center">
                <div className="w-full max-w-xl bg-slate-900/85 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/20
                                p-3 sm:p-4 flex flex-col gap-2 z-40 border border-white/10">

                    {refusal && (
                        <div className="flex items-start gap-2 text-amber-200 bg-amber-500/15 border border-amber-400/30
                                        rounded-lg px-3 py-2 text-xs leading-snug">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                            <span>{refusal}</span>
                        </div>
                    )}

                    <div
                        className="flex justify-center gap-1.5 sm:gap-2"
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {rackTiles.map((tile, i) => (
                            <button
                                key={tile.id}
                                onClick={() => handleRackClick(i)}
                                draggable={!tile.used && !revealSolution}
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/rackId', String(tile.id));
                                    e.dataTransfer.setData('text/char', tile.char);
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                onTouchStart={(e) => {
                                    if (!tile.used && !revealSolution) handleTouchStart(e, tile.char, tile.id);
                                }}
                                disabled={tile.used || revealSolution}
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

                    {revealSolution ? (
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={() => { setLastResult(null); nextPuzzle(); }}
                                className="flex-1 py-2.5 rounded-xl font-bold text-base bg-slate-100 text-slate-800
                                           hover:bg-white transition-all flex items-center justify-center gap-2"
                            >
                                {currentPuzzleIndex < puzzles.length - 1 ? 'Exercice suivant' : 'Nouveau lot'}
                            </button>
                        </div>
                    ) : (
                    <div className="flex gap-2 items-center">
                        {/* Le libelle reste visible sur telephone : cache derriere
                            `hidden sm:inline`, la seule porte de sortie de
                            l'exercice n'etait plus qu'une icone muette. */}
                        <button
                            onClick={abandonner}
                            disabled={revealSolution}
                            aria-label="Voir la solution"
                            className="px-3 py-2.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/10
                                       disabled:opacity-30 transition-all text-sm font-medium flex items-center gap-1"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Solution</span>
                        </button>

                        {placedTiles.length > 0 && !revealSolution && (
                            <button
                                onClick={resetPlacement}
                                className="px-3 py-2.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/10
                                           transition-all text-sm font-medium"
                            >
                                Reprendre
                            </button>
                        )}

                        <button
                            onClick={checkAnswer}
                            disabled={feedback === 'checking' || revealSolution}
                            className={clsx(
                                "flex-1 py-2.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all",
                                feedback === 'refused'
                                    ? "animate-shake bg-red-500 text-white"
                                    : feedback === 'success'
                                        ? "bg-emerald-500 text-white"
                                        : "bg-gradient-to-r from-amber-500 to-amber-400 text-amber-950 hover:from-amber-400 hover:to-amber-300 shadow-lg shadow-amber-500/30",
                                (feedback === 'checking' || revealSolution) && 'opacity-60'
                            )}
                        >
                            {feedback === 'checking' ? <Loader2 className="w-5 h-5 animate-spin" />
                                : feedback === 'success' ? <Check className="w-5 h-5" />
                                    : 'VALIDER'}
                        </button>
                    </div>
                    )}

                    <p className="text-center text-[11px] text-white/35">
                        {revealSolution
                            ? `Le coup attendu est affiché en vert sur le plateau (${currentPuzzle.solution.score} pts).`
                            : rackRestant === 0
                                ? 'Tes sept jetons sont posés.'
                                : `${rackRestant} jeton${rackRestant > 1 ? 's' : ''} à placer — le meilleur collage vaut ${currentPuzzle.solution.score} points.`}
                    </p>
                </div>
            </div>

            {/* Fantome de glisser-deposer tactile */}
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

            {lastResult && (
                <XPFeedback
                    isOpen={showXPFeedback}
                    correct={lastResult.correct}
                    word={lastResult.title}
                    expectedWord={lastResult.correct ? undefined : lastResult.expectedWord}
                    xp={lastResult.xp}
                    mastery={lastResult.mastery}
                    continueLabel={lastResult.correct
                        ? (currentPuzzleIndex < puzzles.length - 1 ? 'Exercice suivant' : 'Nouveau lot')
                        : 'Voir le coup sur le plateau'}
                    details={
                        <div className="space-y-1.5 text-sm">
                            {lastResult.playedScore !== null && (
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Ton coup</span>
                                    <span className="font-bold text-slate-800">{lastResult.playedScore} pts</span>
                                </div>
                            )}
                            {lastResult.bestScore !== null && (
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Meilleur collage possible</span>
                                    <span className={clsx(
                                        'font-bold',
                                        lastResult.playedScore !== null && lastResult.playedScore >= lastResult.bestScore
                                            ? 'text-emerald-600' : 'text-slate-800'
                                    )}>
                                        {lastResult.bestScore} pts
                                    </span>
                                </div>
                            )}
                            {lastResult.wordsFormed.length > 1 && (
                                <p className="text-xs text-slate-500 pt-1">
                                    Mots formés : {lastResult.wordsFormed.join(', ')}
                                </p>
                            )}
                        </div>
                    }
                    onContinue={handleContinueAfterFeedback}
                />
            )}
        </div>
    );
};

export default TrainingPage;
