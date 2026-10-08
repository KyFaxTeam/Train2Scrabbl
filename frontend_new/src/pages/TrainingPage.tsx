import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { generateBatch } from '../services/trainingService';
import type { Puzzle, TrainingMode } from '../services/trainingService';
import { pseudoCourant } from '../services/verbTargetsService';
import { Rack3D } from '../components/Training/Rack3D';
import { EngineWorkerClient, type InitProgress, type MoveReview } from '../engine/WorkerClient';
import { ArenaBoard } from '../components/Arena/ArenaBoard';
import { useLearningStore } from '../store/useLearningStore';
import { XPFeedback } from '../components/Learning/XPFeedback';
import { useTouchDragDrop } from '../hooks/useTouchDragDrop';
import type { XPReward, WordMastery } from '../types';
import { clsx } from 'clsx';
import confetti from 'canvas-confetti';
import { RefreshCw, Check, Eye, Flame, Star, Loader2, AlertTriangle, Undo2, Shuffle, ArrowRight, ZoomIn, ZoomOut, X } from 'lucide-react';

const MODE_KEY = 'faizers_training_mode';
const ZOOM_KEY = 'faizers_training_zoom';

function modeInitial(): TrainingMode {
    try {
        return localStorage.getItem(MODE_KEY) === 'libre' ? 'libre' : 'verbes';
    } catch {
        return 'verbes';
    }
}

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
    const [mode, setMode] = useState<TrainingMode>(modeInitial);
    const pseudo = useMemo(() => pseudoCourant(), []);

    // Le plateau prend le plus grand carre qui tient dans l'espace libre. Sur un
    // ecran tout en hauteur (telephone) ce carre laisse du vide au-dessus et en
    // dessous : la loupe agrandit alors le plateau a toute la hauteur, et on le
    // fait defiler de cote. Les cases passent de ~24 a ~40 px a 375 px de large.
    const boardAreaRef = useRef<HTMLDivElement>(null);
    const boardScrollRef = useRef<HTMLDivElement>(null);
    const [area, setArea] = useState<{ w: number; h: number } | null>(null);
    // null : pas de choix du joueur - on zoome d'office sur telephone
    const [zoom, setZoom] = useState<boolean | null>(() => {
        try {
            const v = localStorage.getItem(ZOOM_KEY);
            return v === null ? null : v === '1';
        } catch { return null; }
    });
    const basculerZoom = () => {
        const z = !zoomActif;
        try { localStorage.setItem(ZOOM_KEY, z ? '1' : '0'); } catch { /* preference non conservee */ }
        setZoom(z);
    };
    useEffect(() => {
        const el = boardAreaRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setArea({ w: Math.floor(width), h: Math.floor(height) });
        });
        ro.observe(el);
        return () => ro.disconnect();
    });
    const MARGE = 8;
    const tailleAjustee = area ? Math.max(200, Math.min(area.w, area.h) - MARGE) : null;
    const tailleZoom = area ? Math.min(Math.max(area.w, area.h) - MARGE, 760) : null;
    // La loupe n'a de sens que si elle agrandit nettement le plateau
    const zoomUtile = !!(tailleAjustee && tailleZoom && tailleZoom > tailleAjustee * 1.2);
    // Telephone (zone etroite et plus haute que large) : loupe d'office
    const telephone = !!area && area.w < 520 && area.h > area.w * 1.1;
    const zoomActif = zoomUtile && (zoom ?? telephone);
    const boardSize = zoomActif ? tailleZoom : tailleAjustee;

    const currentPuzzle = puzzles[currentPuzzleIndex];

    /** Le joueur reprend la main apres un refus : le message et le bouton rouge s'effacent. */
    const effacerRefus = () => {
        setRefusal(null);
        setFeedback(f => (f === 'refused' ? 'idle' : f));
    };

    // D&D: drop handler used by both desktop and touch
    const handleDropTile = useCallback((rackId: number, row: number, col: number) => {
        const puzzle = puzzles[currentPuzzleIndex];
        if (!puzzle || revealSolution) return;
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
        effacerRefus();
    }, [puzzles, currentPuzzleIndex, placedTiles, rackTiles, revealSolution]);

    /**
     * Range un jeton a la place `slot` du chevalet. Venant du chevalet, il change
     * de place (on reordonne ses lettres) ; venant du plateau, il y est repris.
     */
    const handleRackDrop = useCallback((rackId: number, slot: number) => {
        if (revealSolution) return;
        setPlacedTiles(prev => prev.filter(t => t.rackId !== rackId));
        setRackTiles(prev => {
            const from = prev.findIndex(t => t.id === rackId);
            if (from === -1) return prev;
            const reste = prev.filter((_, i) => i !== from);
            reste.splice(Math.max(0, Math.min(slot, reste.length)), 0, { ...prev[from], used: false });
            return reste;
        });
        setSelectedRackTile(null);
        effacerRefus();
    }, [revealSolution]);

    const melangerChevalet = () => {
        setRackTiles(prev => {
            const a = [...prev];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        });
        setSelectedRackTile(null);
    };

    const { dragState, handleTouchStart, handleTouchMove, handleTouchEnd } = useTouchDragDrop(handleDropTile, handleRackDrop);

    useEffect(() => {
        startSession();
        startNewBatch();
        return () => { endSession(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setupPuzzle = (puzzle: Puzzle) => {
        setPlacedTiles([]);
        setFeedback('idle');
        effacerRefus();
        setRevealSolution(false);
        setSelectedRackTile(null);
        setRackTiles(puzzle.rack.map((char, i) => ({ char, id: i, used: false })));
        setPuzzleStartTime(Date.now());
        setShowXPFeedback(false);
    };

    const changerMode = (m: TrainingMode) => {
        if (m === mode) return;
        setMode(m);
        try { localStorage.setItem(MODE_KEY, m); } catch { /* preference non conservee */ }
        startNewBatch(m);
    };

    const startNewBatch = async (m: TrainingMode = mode) => {
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
            }, m);
            if (batchToken.current !== token) return;
        } catch (e) {
            console.error('Echec du lot d entrainement', e);
            if (batchToken.current === token) {
                setError(e instanceof Error ? e.message : "Impossible de charger l’entraînement.");
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
        effacerRefus();
    };

    const handleTileRemove = (row: number, col: number) => {
        const tileToRemove = placedTiles.find(t => t.row === row && t.col === col);
        if (!tileToRemove) return;
        setPlacedTiles(prev => prev.filter(t => t !== tileToRemove));
        setRackTiles(prev => prev.map(t => t.id === tileToRemove.rackId ? { ...t, used: false } : t));
        effacerRefus();
    };

    const resetPlacement = () => {
        setPlacedTiles([]);
        setRackTiles(prev => prev.map(t => ({ ...t, used: false })));
        setSelectedRackTile(null);
        effacerRefus();
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
        effacerRefus();

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
            setRefusal(e instanceof Error ? e.message : "Le moteur n’a pas pu vérifier ce coup.");
            return;
        }

        const { verdict } = review;

        // Un coup illegal n'est pas une mauvaise reponse : c'est un coup que
        // l'arbitre refuse. On le dit, et le joueur corrige - sans que la
        // repetition espacee enregistre un echec de memoire qui n'en est pas un.
        if (!verdict.legal) {
            setFeedback('refused');
            setRefusal(verdict.reason ?? "Ce coup n’est pas jouable.");
            return;
        }

        const expected = puzzle.solution.word.toUpperCase();
        const played = (verdict.word ?? '').toUpperCase();
        const scrabble = verdict.tilesUsed === puzzle.rack.length;

        // L'exercice est de poser un SCRABBLE : les sept jetons du chevalet. Un
        // mot de sept lettres joue a travers une lettre du plateau n'en consomme
        // que six - c'est un coup legal, mais pas celui qu'on demande, et il
        // laisse la prime de 50 sur la table.
        //
        // Ce coup-la est traite comme un coup illegal : refuse avec sa raison,
        // sans rien inscrire dans la repetition espacee. Le joueur a trouve un
        // mot, il n'a pas trouve LE scrabble - ce n'est pas un echec de memoire,
        // et l'enregistrer comme tel fausserait le calendrier de revision.
        if (!scrabble) {
            const restants = puzzle.rack.length - verdict.tilesUsed;
            setFeedback('refused');
            setRefusal(
                `${played} est jouable (${verdict.score} pts), mais ce n'est pas un scrabble : ` +
                `${restants} jeton${restants > 1 ? 's' : ''} reste${restants > 1 ? 'nt' : ''} au chevalet. ` +
                `Un scrabble pose les sept et rapporte la prime de 50.`
            );
            return;
        }

        if (played === expected) {
            await enregistrer(puzzle, true, review, 'Scrabble !');
            return;
        }

        // Sept jetons poses, autre mot valide : c'est un autre scrabble du meme
        // tirage, la competence visee est exactement la meme.
        await enregistrer(puzzle, true, review, `Autre scrabble accepté : ${played}`);
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

    // Loupe : on recentre la vue sur les jetons du plateau, la ou se joue le coup
    useLayoutEffect(() => {
        const el = boardScrollRef.current;
        if (!el || !area || !boardSize || !currentPuzzle) return;
        const tuiles = currentPuzzle.boardConfig.initialTiles;
        if (!zoomActif || tuiles.length === 0) {
            el.scrollTo({ left: 0, top: 0 });
            return;
        }
        const cols = tuiles.map(t => t.col);
        const rows = tuiles.map(t => t.row);
        const centre = (v: number[]) => (Math.min(...v) + Math.max(...v) + 1) / 2 / 15;
        el.scrollTo({
            left: centre(cols) * boardSize + MARGE / 2 - el.clientWidth / 2,
            top: centre(rows) * boardSize + MARGE / 2 - el.clientHeight / 2,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoomActif, currentPuzzle?.id, boardSize]);

    // Entree : valider le coup, ou passer a l'exercice suivant apres la correction
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Enter' || e.repeat || showXPFeedback) return;
            const cible = e.target as HTMLElement | null;
            if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA' || cible.tagName === 'BUTTON')) return;
            if (revealSolution) {
                e.preventDefault();
                setLastResult(null);
                nextPuzzle();
            } else if (placedTiles.length > 0 && feedback !== 'checking') {
                e.preventDefault();
                checkAnswer();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    if (error) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-500">
                <div className="text-red-500 font-bold text-lg">Oups!</div>
                <p className="text-center px-4">{error}</p>
                <button
                    onClick={() => startNewBatch()}
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
                    Le lexique (236 Ko) n’est téléchargé qu’une fois, puis conservé sur l’appareil.
                </p>
            </div>
        );
    }

    const origine = currentPuzzle.origine;
    const termine = revealSolution || feedback === 'success';

    const boutonsMode = (
        <div role="tablist" aria-label="Mode d'entraînement" className="flex bg-slate-100 rounded-full p-0.5 text-xs font-bold shrink-0">
            {([['verbes', 'Verbes du club'], ['libre', 'Libres']] as const).map(([m, label]) => (
                <button
                    key={m}
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => changerMode(m)}
                    className={clsx(
                        'px-3 py-1 rounded-full transition-colors whitespace-nowrap',
                        mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );

    const iconeHeader = 'p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors';
    const boutonRond = 'w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-full flex items-center justify-center transition-all';

    return (
        <div
            className="h-full flex flex-col bg-slate-50 overflow-hidden"
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* En-tete */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 pl-3 pr-1.5 sm:px-4 h-11 flex justify-between items-center gap-2 z-30 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <h1 className="hidden lg:block text-lg font-bold text-slate-800 mr-1">Entraînement</h1>
                    {boutonsMode}
                    <span className="text-xs text-slate-400 font-medium tabular-nums">
                        {currentPuzzleIndex + 1}/{puzzles.length}
                    </span>
                    <span className={clsx(
                        'hidden sm:inline text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
                        currentPuzzle.metadata.difficulty === 'difficile' ? 'bg-red-100 text-red-600'
                            : currentPuzzle.metadata.difficulty === 'moyen' ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                    )}
                        title={`${currentPuzzle.metadata.legalPlacements} collages légaux de ce mot sur ce plateau`}
                    >
                        {DIFFICULTY_LABEL[currentPuzzle.metadata.difficulty]}
                    </span>
                </div>
                <div className="flex items-center shrink-0">
                    {sessionCorrectStreak > 0 && (
                        <div className="flex items-center gap-1 text-amber-500 px-1.5" title="Combo">
                            <Flame className="w-4 h-4" />
                            <span className="font-bold text-sm">{sessionCorrectStreak}</span>
                        </div>
                    )}
                    {userProgress && (
                        <div className="hidden sm:flex items-center gap-1 text-emerald-600 px-1.5" title="XP">
                            <Star className="w-4 h-4" />
                            <span className="font-bold text-sm">{userProgress.totalXP}</span>
                        </div>
                    )}
                    {zoomUtile && (
                        <button
                            onClick={basculerZoom}
                            aria-label={zoomActif ? 'Voir tout le plateau' : 'Agrandir le plateau'}
                            title={zoomActif ? 'Voir tout le plateau' : 'Agrandir le plateau'}
                            aria-pressed={zoomActif}
                            className={clsx(iconeHeader, zoomActif && 'text-emerald-600 bg-emerald-50')}
                        >
                            {zoomActif ? <ZoomOut className="w-[18px] h-[18px]" /> : <ZoomIn className="w-[18px] h-[18px]" />}
                        </button>
                    )}
                    {!revealSolution && (
                        <button onClick={abandonner} title="Voir la solution" aria-label="Voir la solution" className={iconeHeader}>
                            <Eye className="w-[18px] h-[18px]" />
                        </button>
                    )}
                    <button onClick={() => startNewBatch()} title="Nouveau lot d'exercices" aria-label="Nouveau lot d'exercices" className={iconeHeader}>
                        <RefreshCw className="w-[18px] h-[18px]" />
                    </button>
                </div>
            </div>

            {/* Consigne, sur une ligne : en mode verbes, ce qu'on cherche sans dire lequel */}
            {mode === 'verbes' && origine && (
                <p className="shrink-0 px-3 pt-1.5 text-center text-[11px] sm:text-xs text-slate-500 leading-4 truncate">
                    {termine ? (
                        <>
                            <strong className="text-slate-800">{currentPuzzle.solution.word}</strong>
                            {' '}vient de <strong className="text-slate-800">{origine.verbe}</strong> · {origine.raison}
                        </>
                    ) : (
                        <>
                            Une <strong className="text-slate-700">conjugaison</strong> d'un verbe{' '}
                            {origine.source === 'perso' ? 'qui t’a résisté' : origine.source === 'club' ? 'qui résiste au club' : 'de tes lots'}{' '}
                            se cache ici
                        </>
                    )}
                </p>
            )}

            {/* Plateau */}
            <div ref={boardAreaRef} className="flex-1 min-h-0 relative">
                <div ref={boardScrollRef} className="absolute inset-0 overflow-auto overscroll-contain" style={{ scrollbarWidth: 'thin' }}>
                    <div
                        className="flex items-center justify-center"
                        style={area && boardSize ? { width: Math.max(area.w, boardSize + MARGE), height: Math.max(area.h, boardSize + MARGE) } : undefined}
                    >
                        <div style={{ width: boardSize ?? '100%' }}>
                            <ArenaBoard
                                fluid
                                initialTiles={currentPuzzle.boardConfig.initialTiles}
                                placedTiles={placedTiles}
                                solutionTiles={solutionTiles}
                                onCellClick={handleBoardClick}
                                onTilePlace={handleTilePlace}
                                onTileRemove={handleTileRemove}
                                onDropTile={handleDropTile}
                                onPlacedTouchStart={handleTouchStart}
                            />
                        </div>
                    </div>
                </div>

                {/* Refus de l'arbitre : par-dessus le bas du plateau, sans pousser la mise en page */}
                {refusal && (
                    <div role="alert" className="absolute left-2 right-2 bottom-2 z-20 mx-auto max-w-xl flex items-start gap-2 text-amber-950
                                    bg-amber-50/95 backdrop-blur border border-amber-300 shadow-lg rounded-xl px-3 py-2 text-xs leading-snug">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-amber-600" />
                        <span className="flex-1">{refusal}</span>
                        <button onClick={() => setRefusal(null)} aria-label="Fermer" className="-m-1 p-1 text-amber-700/70 hover:text-amber-900">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Chevalet : reprendre / melanger, les jetons, valider */}
            <div className="shrink-0 w-full px-2 pt-1 pb-2">
                <div className="mx-auto max-w-[520px] flex items-center gap-1.5 sm:gap-3">
                    {placedTiles.length > 0 && !revealSolution ? (
                        <button
                            onClick={resetPlacement}
                            aria-label="Reprendre les jetons posés"
                            title="Reprendre les jetons posés"
                            className={clsx(boutonRond, 'text-slate-600 bg-white border border-slate-200 shadow-sm hover:bg-slate-100')}
                        >
                            <Undo2 className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={melangerChevalet}
                            disabled={revealSolution}
                            aria-label="Mélanger le chevalet"
                            title="Mélanger le chevalet"
                            className={clsx(boutonRond, 'text-slate-600 bg-white border border-slate-200 shadow-sm hover:bg-slate-100 disabled:opacity-40')}
                        >
                            <Shuffle className="w-5 h-5" />
                        </button>
                    )}

                    <div className="flex-1 min-w-0">
                        <Rack3D
                            tiles={rackTiles}
                            selected={selectedRackTile}
                            disabled={revealSolution}
                            onTileClick={handleRackClick}
                            onTileTouchStart={handleTouchStart}
                            onDropOnSlot={handleRackDrop}
                        />
                    </div>

                    <button
                        onClick={revealSolution ? () => { setLastResult(null); nextPuzzle(); } : checkAnswer}
                        disabled={feedback === 'checking' || (!revealSolution && placedTiles.length === 0)}
                        aria-label={revealSolution ? 'Exercice suivant' : 'Valider le coup'}
                        title={revealSolution ? 'Exercice suivant (Entrée)' : 'Valider le coup (Entrée)'}
                        className={clsx(
                            boutonRond,
                            'disabled:opacity-35 disabled:shadow-none',
                            revealSolution
                                ? 'bg-slate-800 text-white hover:bg-slate-700 shadow-md'
                                : feedback === 'refused'
                                    ? 'animate-shake bg-red-500 text-white'
                                    : feedback === 'success'
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 shadow-[0_3px_0_#b45309] active:translate-y-[2px] active:shadow-[0_1px_0_#b45309]'
                        )}
                    >
                        {feedback === 'checking' ? <Loader2 className="w-5 h-5 animate-spin" />
                            : revealSolution ? <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
                                : <Check className="w-6 h-6" strokeWidth={3} />}
                    </button>
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
                                    <span className="text-slate-600">Meilleur scrabble possible</span>
                                    <span className={clsx(
                                        'font-bold',
                                        lastResult.playedScore !== null && lastResult.playedScore >= lastResult.bestScore
                                            ? 'text-emerald-600' : 'text-slate-800'
                                    )}>
                                        {lastResult.bestScore} pts
                                    </span>
                                </div>
                            )}
                            {origine && (
                                <p className="text-xs text-slate-600 pt-1">
                                    <strong>{lastResult.expectedWord}</strong> vient de <strong>{origine.verbe}</strong> · {origine.raison}
                                </p>
                            )}
                            {mode === 'verbes' && !pseudo && (
                                <p className="text-xs text-slate-400 pt-1">
                                    Connecte-toi dans Verbes Club : l'entraînement visera tes propres ratés.
                                </p>
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
