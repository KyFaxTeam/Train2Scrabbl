import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Flame, Loader2, RotateCcw, Timer, X, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import confetti from 'canvas-confetti';
import Tile from '../Tile';
import { getDictionary } from '../../services/dictionaryService';
import { formatFamilyLabel, getMorphologyFamily } from '../../services/arenaService';
import { recordDailyActivity } from '../../services/statsService';
import {
    buildReflexSession,
    familyOf,
    scoreAnswer,
    summarize,
    TIME_LIMIT_MS,
    type ReflexAnswer,
    type ReflexQuestion,
} from '../../services/reflexService';

/** Durée de la correction avant la question suivante. */
const FEEDBACK_MS = 2000;
const QUESTIONS_PER_RUN = 12;

interface Verdict {
    correct: boolean;
    /** Réponse donnée : null quand le chrono a tranché à la place du joueur. */
    picked: string | null;
}

export const ReflexChallenge: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const familyId = searchParams.get('family');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [questions, setQuestions] = useState<ReflexQuestion[]>([]);
    const [index, setIndex] = useState(0);
    const [verdict, setVerdict] = useState<Verdict | null>(null);
    const [answers, setAnswers] = useState<ReflexAnswer[]>([]);
    const [streak, setStreak] = useState(0);
    const [points, setPoints] = useState(0);
    const [remaining, setRemaining] = useState(0);

    const askedAt = useRef<number>(Date.now());
    const startedAt = useRef<number>(Date.now());
    const recorded = useRef(false);
    // `verdict` ne suffit pas a barrer une seconde reponse : le chrono tourne
    // toutes les 100 ms et lit la valeur capturee au montage de l'effet, donc
    // il rappelle `answer` tant que React n'a pas re-rendu. Sans ce verrou
    // synchrone, un depassement de temps empile plusieurs reponses.
    const answered = useRef(false);

    const family = familyId ? getMorphologyFamily(familyId) : undefined;
    const question: ReflexQuestion | undefined = questions[index];
    const finished = questions.length > 0 && index >= questions.length;
    const limit = question ? TIME_LIMIT_MS[question.kind] : 0;

    // --- Chargement ---------------------------------------------------------
    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            setLoading(true);
            setError(null);
            try {
                // Le défi tire ses tirages des index de l'Arène : sans
                // dictionnaire chargé, ils sont vides.
                await getDictionary();
                const built = await buildReflexSession({
                    familyId,
                    total: QUESTIONS_PER_RUN,
                });
                if (cancelled) return;
                if (built.length === 0) {
                    setError("Pas assez d'exercices pour cette famille.");
                } else {
                    setQuestions(built);
                    askedAt.current = Date.now();
                    startedAt.current = Date.now();
                }
            } catch (err) {
                if (!cancelled) setError('Impossible de préparer le défi.');
                console.error('Reflex init failed', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        init();
        return () => { cancelled = true; };
    }, [familyId]);

    // --- Réponse ------------------------------------------------------------
    const answer = useCallback((picked: string | null) => {
        if (!question || answered.current) return;
        answered.current = true;

        const elapsedMs = Date.now() - askedAt.current;
        const expected = question.kind === 'scanner'
            ? question.answerId
            : (question.ok ? 'oui' : 'non');
        const correct = picked === expected;
        const gained = scoreAnswer(question, correct, elapsedMs, streak);

        setVerdict({ correct, picked });
        setStreak(correct ? streak + 1 : 0);
        setPoints(prev => prev + gained);
        setAnswers(prev => [...prev, {
            questionId: question.id,
            familyId: familyOf(question),
            kind: question.kind,
            correct,
            elapsedMs,
            points: gained,
        }]);
    }, [question, streak]);

    // --- Chrono -------------------------------------------------------------
    useEffect(() => {
        if (!question || verdict) return;

        askedAt.current = Date.now();
        answered.current = false;
        setRemaining(limit);

        const tick = window.setInterval(() => {
            const left = limit - (Date.now() - askedAt.current);
            setRemaining(Math.max(0, left));
            // Le temps écoulé compte comme une erreur : en partie aussi,
            // l'hésitation coûte le coup.
            if (left <= 0) answer(null);
        }, 100);

        return () => window.clearInterval(tick);
    }, [question, verdict, limit, answer]);

    // --- Enchaînement -------------------------------------------------------
    useEffect(() => {
        if (!verdict) return;
        const next = window.setTimeout(() => {
            setVerdict(null);
            setIndex(prev => prev + 1);
        }, FEEDBACK_MS);
        return () => window.clearTimeout(next);
    }, [verdict]);

    // --- Raccourcis clavier -------------------------------------------------
    useEffect(() => {
        if (!question || verdict) return;

        const onKey = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            if (question.kind === 'hook') {
                if (key === 'o' || key === 'arrowleft') answer('oui');
                if (key === 'n' || key === 'arrowright') answer('non');
                return;
            }
            const slot = Number(key);
            if (slot >= 1 && slot <= question.options.length) {
                answer(question.options[slot - 1].familyId);
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [question, verdict, answer]);

    // --- Fin de manche ------------------------------------------------------
    const summary = useMemo(() => summarize(answers), [answers]);

    useEffect(() => {
        if (!finished || recorded.current) return;
        recorded.current = true;

        if (summary.accuracy >= 80) {
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        }

        const duration = Math.round((Date.now() - startedAt.current) / 1000);
        recordDailyActivity(summary.total, summary.correct, duration, 'morphology')
            .catch(err => console.error('Failed to record reflex activity', err));
    }, [finished, summary]);

    const restart = () => {
        recorded.current = false;
        setAnswers([]);
        setIndex(0);
        setStreak(0);
        setPoints(0);
        setVerdict(null);
        setQuestions([]);
        setLoading(true);
        buildReflexSession({ familyId, total: QUESTIONS_PER_RUN })
            .then(built => {
                setQuestions(built);
                askedAt.current = Date.now();
                startedAt.current = Date.now();
            })
            .catch(err => {
                console.error('Reflex restart failed', err);
                setError('Impossible de préparer le défi.');
            })
            .finally(() => setLoading(false));
    };

    // ------------------------------------------------------------------------

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto mb-3" />
                    <p className="text-slate-500">Préparation du défi...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6">
                <p className="text-slate-600 mb-4">{error}</p>
                <button
                    onClick={() => navigate('/arena')}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour à l'Arène
                </button>
            </div>
        );
    }

    const progress = questions.length ? (index / questions.length) * 100 : 0;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Barre de session */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => navigate('/arena')}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            aria-label="Retour à l'Arène"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div className="min-w-0">
                            <h1 className="font-semibold text-slate-800 truncate">Le Réflexe</h1>
                            <p className="text-xs text-slate-500 truncate">
                                {family ? formatFamilyLabel(family) : 'Toutes familles'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        {streak >= 2 && (
                            <span className="flex items-center gap-1 text-sm font-semibold text-orange-500">
                                <Flame className="w-4 h-4" />{streak}
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                            <Zap className="w-4 h-4 text-amber-500" />{points}
                        </span>
                        <span className="text-sm text-slate-500 tabular-nums">
                            {Math.min(index + 1, questions.length)} / {questions.length}
                        </span>
                    </div>
                </div>

                <div className="mt-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-rose-500"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
            </div>

            <div className="flex-1 flex items-start sm:items-center justify-center p-4 overflow-auto">
                {/* Pas d'AnimatePresence ici : framer-motion suspend ses animations
                    quand l'onglet passe en arriere-plan, et une carte sortante y
                    resterait montee indefiniment - soit l'ecran se fige (mode
                    "wait"), soit deux questions se superposent. Une animation
                    d'entree suffit, et l'enchainement reste correct dans tous les
                    cas. */}
                {finished ? (
                    <ReflexSummaryCard
                        summary={summary}
                        onRestart={restart}
                        onBack={() => navigate('/arena')}
                    />
                ) : question ? (
                    <motion.div
                        key={question.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className="w-full max-w-xl"
                    >
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* Chrono */}
                            <div className="h-1 bg-slate-100">
                                <div
                                    className={clsx(
                                        'h-full transition-[width] duration-100 ease-linear',
                                        remaining < limit / 4 ? 'bg-red-500' : 'bg-rose-400'
                                    )}
                                    style={{ width: `${(remaining / limit) * 100}%` }}
                                />
                            </div>

                            {question.kind === 'scanner'
                                ? <ScannerCard question={question} verdict={verdict} onAnswer={answer} />
                                : <HookCard question={question} verdict={verdict} onAnswer={answer} />}
                        </div>
                    </motion.div>
                ) : null}
            </div>
        </div>
    );
};

// ============================================================================
// MANCHE 1 — LE SCANNER
// ============================================================================

const ScannerCard: React.FC<{
    question: Extract<ReflexQuestion, { kind: 'scanner' }>;
    verdict: Verdict | null;
    onAnswer: (picked: string) => void;
}> = ({ question, verdict, onAnswer }) => (
    <div className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-rose-500 mb-4">
            <Timer className="w-3.5 h-3.5" />
            Scanner — quelle famille paie ici ?
        </div>

        <div className="flex justify-center gap-1 sm:gap-1.5 mb-6">
            {question.draw.split('').map((letter, i) => (
                <Tile key={i} letter={letter} size="lg" />
            ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
            {question.options.map((option, i) => {
                const isAnswer = option.familyId === question.answerId;
                const isPicked = verdict?.picked === option.familyId;

                return (
                    <button
                        key={option.familyId}
                        onClick={() => onAnswer(option.familyId)}
                        disabled={verdict !== null}
                        className={clsx(
                            'flex items-center justify-between gap-2 px-3 py-3 rounded-xl border text-left font-semibold transition-colors',
                            !verdict && 'bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50',
                            verdict && isAnswer && 'bg-emerald-50 border-emerald-400 text-emerald-800',
                            verdict && isPicked && !isAnswer && 'bg-red-50 border-red-300 text-red-700',
                            verdict && !isAnswer && !isPicked && 'bg-white border-slate-200 text-slate-400'
                        )}
                    >
                        <span>{option.label}</span>
                        <span className="text-xs font-normal text-slate-400 tabular-nums">{i + 1}</span>
                    </button>
                );
            })}
        </div>

        <Feedback verdict={verdict}>
            {verdict?.correct
                ? <>Oui — <strong>{question.proof}</strong>.</>
                : <>C'était <strong>{question.options.find(o => o.familyId === question.answerId)?.label}</strong> : {question.proof}.</>}
        </Feedback>
    </div>
);

// ============================================================================
// MANCHE 2 — LE CROCHET
// ============================================================================

const HookCard: React.FC<{
    question: Extract<ReflexQuestion, { kind: 'hook' }>;
    verdict: Verdict | null;
    onAnswer: (picked: string) => void;
}> = ({ question, verdict, onAnswer }) => {
    const parts = question.affixKind === 'prefix'
        ? [question.affix, question.stem]
        : [question.stem, question.affix];

    return (
        <div className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-rose-500 mb-4">
                <Timer className="w-3.5 h-3.5" />
                Crochet — cette soudure existe-t-elle ?
            </div>

            {/* L'ordre est celui du DOM, pas un `order-*` CSS : une classe
                d'ordre ne deplace que le rendu visuel, si bien qu'un lecteur
                d'ecran - et le simple copier-coller - annoncaient "AGE + PIEGE"
                pour un suffixe, soit exactement l'inverse de ce qu'on enseigne. */}
            <div className="flex items-center justify-center gap-2 mb-2">
                {parts.map((part, i) => (
                    <React.Fragment key={part + i}>
                        {i > 0 && <span className="text-slate-300 font-bold">+</span>}
                        <span className={clsx(
                            'px-3 py-2 rounded-lg font-bold tracking-wide',
                            part === question.affix
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-800'
                        )}>
                            {part}
                        </span>
                    </React.Fragment>
                ))}
            </div>
            <p className="text-center text-xs text-slate-400 mb-6">
                famille {question.familyLabel}
            </p>

            <div className="grid grid-cols-2 gap-2">
                {(['oui', 'non'] as const).map(choice => {
                    const isAnswer = (choice === 'oui') === question.ok;
                    const isPicked = verdict?.picked === choice;

                    return (
                        <button
                            key={choice}
                            onClick={() => onAnswer(choice)}
                            disabled={verdict !== null}
                            className={clsx(
                                'flex items-center justify-center gap-2 px-3 py-3 rounded-xl border font-semibold uppercase transition-colors',
                                !verdict && 'bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50',
                                verdict && isAnswer && 'bg-emerald-50 border-emerald-400 text-emerald-800',
                                verdict && isPicked && !isAnswer && 'bg-red-50 border-red-300 text-red-700',
                                verdict && !isAnswer && !isPicked && 'bg-white border-slate-200 text-slate-400'
                            )}
                        >
                            {choice === 'oui' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            {choice}
                            <span className="text-xs font-normal text-slate-400">
                                {choice === 'oui' ? 'O' : 'N'}
                            </span>
                        </button>
                    );
                })}
            </div>

            <Feedback verdict={verdict}>
                {question.ok
                    ? <><strong>{question.word}</strong> est valide.</>
                    : <><strong>{question.word}</strong> n'existe pas.</>}
            </Feedback>
        </div>
    );
};

// ============================================================================

const Feedback: React.FC<{ verdict: Verdict | null; children: React.ReactNode }> = ({
    verdict,
    children,
}) => (
    <AnimatePresence>
        {verdict && (
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={clsx(
                    'mt-4 rounded-xl px-3 py-2.5 text-sm',
                    verdict.correct ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                )}
            >
                <span className="font-semibold mr-1">
                    {verdict.correct ? 'Juste' : verdict.picked === null ? 'Trop lent' : 'Raté'} —
                </span>
                {children}
            </motion.div>
        )}
    </AnimatePresence>
);

// ============================================================================
// BILAN
// ============================================================================

const ReflexSummaryCard: React.FC<{
    summary: ReturnType<typeof summarize>;
    onRestart: () => void;
    onBack: () => void;
}> = ({ summary, onRestart, onBack }) => {
    // `byFamily` est trié du plus faible au plus solide : la tête de liste est
    // le conseil du jour, à condition d'avoir assez de questions pour que le
    // chiffre veuille dire quelque chose.
    const weakest = summary.byFamily.find(f => f.asked >= 2 && f.accuracy < 100);
    // Un pourcentage ne se révise pas ; un couple radical/dérivé, si.
    const weakestFamily = weakest ? getMorphologyFamily(weakest.familyId) : undefined;
    const example = weakestFamily?.examples[0];
    // L'affixe se place du côté où il s'attache, sinon le modèle enseigne faux.
    const parts = example && weakestFamily
        ? (weakestFamily.kind === 'prefix'
            ? [example.affix, example.stem]
            : [example.stem, example.affix])
        : null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
        >
            <h2 className="text-xl font-bold text-slate-800 text-center">Manche terminée</h2>

            <div className="grid grid-cols-3 gap-3 my-6 text-center">
                <Metric label="Précision" value={`${summary.accuracy}%`} />
                <Metric label="Points" value={String(summary.points)} />
                <Metric label="Série" value={String(summary.bestStreak)} />
            </div>

            <p className="text-center text-sm text-slate-500 mb-6">
                {summary.correct} / {summary.total} bonnes réponses en {(summary.averageMs / 1000).toFixed(1)}s de moyenne
            </p>

            {weakest && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 mb-6 text-sm text-rose-900">
                    <span className="font-semibold">À retravailler : {weakest.label}</span>
                    {' — '}
                    {weakest.correct}/{weakest.asked} ici, et sur une vraie table cette famille
                    paie {Math.round(weakest.reliability)} fois sur 100 quand tu as les lettres.
                    {example && parts && (
                        <div className="mt-1 text-rose-700">
                            Le modèle à garder en tête : {parts[0]} + {parts[1]} ={' '}
                            <strong>{example.word}</strong>.
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-1.5 mb-6">
                {summary.byFamily.map(row => (
                    <div key={row.familyId} className="flex items-center gap-3 text-sm">
                        <span className="w-28 shrink-0 font-medium text-slate-700 truncate">{row.label}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={clsx('h-full', row.accuracy >= 70 ? 'bg-emerald-400' : 'bg-rose-400')}
                                style={{ width: `${row.accuracy}%` }}
                            />
                        </div>
                        <span className="w-14 text-right tabular-nums text-slate-500">
                            {row.correct}/{row.asked}
                        </span>
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={onRestart}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors"
                >
                    <RotateCcw className="w-4 h-4" />
                    Rejouer
                </button>
                <button
                    onClick={onBack}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    L'Arène
                </button>
            </div>
        </motion.div>
    );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-xl bg-slate-50 py-3">
        <div className="text-2xl font-bold text-slate-800 tabular-nums">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
    </div>
);

export default ReflexChallenge;
