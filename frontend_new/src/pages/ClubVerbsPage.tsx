import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  BookOpen,
  Users,
  Search,
  RotateCcw,
  Play,
  Pause,
  Award,
  ShieldCheck,
  AlertCircle,
  Compass,
  Zap,
} from 'lucide-react';
import {
  MASTER_VERBS_DB,
  WORD_MAP,
  ANAGRAM_MAP,
  TOTAL_VERBS,
  BATCH_SIZE,
  TOTAL_BATCHES,
  getBatchWords,
  getAnagramRack,
  normalizeStr,
  buildTrainingSequence,
} from '../data/masterVerbsDb';
import {
  firebaseVerbsService,
  type PlayerVerbProfile,
  type ClubActivityEvent,
} from '../services/firebaseVerbsService';
import { addXP as addXPToDb, updateStreak } from '../services/learningStore';

type TabMode = 'training' | 'team' | 'codex';
type ScreenMode = 'selector' | 'preview' | 'quiz' | 'validation' | 'summary';

// Synthétiseur audio Web Audio API pour les chimes de réussite (zéro fichier externe)
function playChime(type: 'correct' | 'wrong' | 'victory') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'correct') {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'victory') {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C - E - G - C6
      notes.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, now + idx * 0.1);
        g.gain.setValueAtTime(0.2, now + idx * 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.3);
        o.start(now + idx * 0.1);
        o.stop(now + idx * 0.1 + 0.3);
      });
    }
  } catch {
    // Audio non critique
  }
}

export const ClubVerbsPage: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<TabMode>('training');
  const [screenMode, setScreenMode] = useState<ScreenMode>('selector');

  // Identité joueur
  const [playerName, setPlayerName] = useState<string>(() => {
    const saved = localStorage.getItem('faizers_verb_user');
    return (saved && saved.trim().toUpperCase() !== 'JOUEUR') ? saved.trim() : '';
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('faizers_verb_user');
    return !saved || saved.trim().toUpperCase() === 'JOUEUR';
  });
  const [typedAuthName, setTypedAuthName] = useState('');

  // Profil & Progression
  const [profile, setProfile] = useState<PlayerVerbProfile | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<number>(0); // 0-indexed (lot 1 = 0)

  // Données Club
  const [leaderboard, setLeaderboard] = useState<PlayerVerbProfile[]>([]);
  const [clubActivities, setClubActivities] = useState<ClubActivityEvent[]>([]);

  // Session de jeu (Entraînement ou Validation)
  const [isValidationSession, setIsValidationSession] = useState(false);
  const [isTieBreakSession, setIsTieBreakSession] = useState(false);
  const [sessionWords, setSessionWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(20);
  const [isPaused, setIsPaused] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [alternateMatch, setAlternateMatch] = useState<string | null>(null);
  const [sessionErrors, setSessionErrors] = useState<string[]>([]);
  const [validationScore, setValidationScore] = useState(0);

  // Réacteur Collectif Hebdomadaire
  const [weeklyEnergy, setWeeklyEnergy] = useState<number>(0);

  // Codex Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [lengthFilter, setLengthFilter] = useState<number | 'all'>('all');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Charger le profil lors du changement de joueur
  useEffect(() => {
    if (!playerName || playerName.toUpperCase() === 'JOUEUR') {
      setProfile(null);
      return;
    }
    const slug = firebaseVerbsService.slugify(playerName);
    firebaseVerbsService.loadPlayerProfile(slug, playerName).then((p) => {
      setProfile(p);
      setSelectedBatch(p.currentBatch || 0);
    });
  }, [playerName]);

  // Écouteurs temps réel Firebase Club
  useEffect(() => {
    const unsubLeaderboard = firebaseVerbsService.subscribeToLeaderboard((rows) => {
      setLeaderboard(rows);
    });
    const unsubActivity = firebaseVerbsService.subscribeToClubActivity((acts) => {
      setClubActivities(acts);
    });
    const unsubReactor = firebaseVerbsService.subscribeToReactor((pts) => {
      setWeeklyEnergy(pts);
    });

    return () => {
      unsubLeaderboard();
      unsubActivity();
      unsubReactor();
    };
  }, []);

  // Décompte chronomètre en session
  useEffect(() => {
    if (screenMode !== 'quiz' || isPaused || showSolution) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [screenMode, isPaused, showSolution, currentIndex]);

  // Focus sur l'input au changement de mot
  useEffect(() => {
    if (screenMode === 'quiz' && !showSolution) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [screenMode, currentIndex, showSolution]);

  // Statistiques du club calculées
  const clubTotalConqueredVerbs = useMemo(() => {
    const setOfConquered = new Set<string>();
    leaderboard.forEach((p) => {
      (p.validatedBatches || []).forEach((b) => {
        const words = getBatchWords(b - 1);
        words.forEach((w) => setOfConquered.add(w.word));
      });
    });
    return setOfConquered.size;
  }, [leaderboard]);

  const currentBatchWords = useMemo(() => {
    return getBatchWords(selectedBatch);
  }, [selectedBatch]);

  const targetWord = sessionWords[currentIndex] || '';
  const targetInfo = WORD_MAP[targetWord] || { length: targetWord.length, details: '' };
  const currentRack = useMemo(() => {
    return targetWord ? getAnagramRack(targetWord) : '';
  }, [targetWord]);

  // Joueur correspondant à la saisie dans le modal d'authentification
  const matchedPlayer = useMemo(() => {
    const clean = typedAuthName.trim().toUpperCase();
    if (!clean || clean === 'JOUEUR') return null;
    const targetSlug = firebaseVerbsService.slugify(clean);
    return leaderboard.find((p) => p.slug === targetSlug) || null;
  }, [typedAuthName, leaderboard]);

  const handleSelectPlayer = (name: string) => {
    const clean = name.trim().toUpperCase();
    if (clean && clean !== 'JOUEUR') {
      localStorage.setItem('faizers_verb_user', clean);
      setPlayerName(clean);
      setIsAuthModalOpen(false);
      setTypedAuthName('');
    }
  };

  const handleStartTraining = () => {
    const batchWords = getBatchWords(selectedBatch).map((w) => w.word);
    const sequence = buildTrainingSequence(batchWords);
    setSessionWords(sequence);
    setCurrentIndex(0);
    setSessionErrors([]);
    setIsValidationSession(false);
    setShowSolution(false);
    setTimeLeft(20);
    setIsPaused(false);
    setUserInput('');
    setScreenMode('quiz');
  };

  const handleStartValidation = () => {
    const batchWords = getBatchWords(selectedBatch).map((w) => w.word);
    const shuffled = [...batchWords].sort(() => Math.random() - 0.5);
    setSessionWords(shuffled);
    setCurrentIndex(0);
    setSessionErrors([]);
    setValidationScore(0);
    setIsValidationSession(true);
    setIsTieBreakSession(false);
    setShowSolution(false);
    setTimeLeft(15);
    setIsPaused(false);
    setUserInput('');
    setScreenMode('quiz');
  };

  const handleStartTieBreak = () => {
    const errorWords = [...sessionErrors];
    if (errorWords.length === 0) return;
    setSessionWords(errorWords);
    setCurrentIndex(0);
    setValidationScore(0);
    setIsValidationSession(false);
    setIsTieBreakSession(true);
    setShowSolution(false);
    setTimeLeft(12); // 12s par mot en tie-break mort subite
    setIsPaused(false);
    setUserInput('');
    setScreenMode('quiz');
  };

  const handleSubmitAnswer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetWord || showSolution) return;

    const normalizedInput = normalizeStr(userInput.trim());
    const validMatches = ANAGRAM_MAP[currentRack] || [];
    const matched = validMatches.find((v) => normalizeStr(v.word) === normalizedInput);
    const isCorrect = !!matched;

    if (isCorrect) {
      playChime('correct');
      setLastAnswerCorrect(true);
      setAlternateMatch(matched.word !== targetWord ? matched.word : null);
      if (isValidationSession || isTieBreakSession) {
        setValidationScore((prev) => prev + 1);
      }
      // Gain d'XP Solo & Réacteur Collectif Club
      addXPToDb(10);
      firebaseVerbsService.addReactorEnergy(1);
      displaySolutionAndAdvance(true);
    } else {
      playChime('wrong');
      setLastAnswerCorrect(false);
      setAlternateMatch(null);
      if (!sessionErrors.includes(targetWord)) {
        setSessionErrors((prev) => [...prev, targetWord]);
      }
      displaySolutionAndAdvance(false);
    }
  };

  const handleTimeExpired = () => {
    if (showSolution) return;
    playChime('wrong');
    setLastAnswerCorrect(false);
    setAlternateMatch(null);
    if (!sessionErrors.includes(targetWord)) {
      setSessionErrors((prev) => [...prev, targetWord]);
    }
    displaySolutionAndAdvance(false);
  };

  const displaySolutionAndAdvance = (wasCorrect: boolean) => {
    setShowSolution(true);
    if (timerRef.current) clearInterval(timerRef.current);

    // Enchaînement automatique après 2s (sauf si pause)
    autoAdvanceRef.current = setTimeout(() => {
      handleNextTurn();
    }, wasCorrect ? 1800 : 2600);
  };

  const handleNextTurn = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    setShowSolution(false);
    setUserInput('');

    if (currentIndex + 1 < sessionWords.length) {
      setCurrentIndex((prev) => prev + 1);
      setTimeLeft(isValidationSession ? 15 : isTieBreakSession ? 12 : 20);
    } else {
      // Fin de session
      finishSession();
    }
  };

  const finishSession = async () => {
    setScreenMode('summary');
    if (isValidationSession) {
      const finalScore = validationScore;
      const isSuccess = finalScore >= 27; // 90% de 30
      if (isSuccess && profile) {
        playChime('victory');
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
        addXPToDb(150);
        updateStreak();
        firebaseVerbsService.addReactorEnergy(25);
        await firebaseVerbsService.recordBatchValidation(
          profile.slug,
          profile.displayName,
          selectedBatch + 1,
          finalScore
        );
        const updated = await firebaseVerbsService.loadPlayerProfile(profile.slug, profile.displayName);
        setProfile(updated);
      }
    } else if (isTieBreakSession) {
      const needed = Math.min(3, sessionWords.length);
      const isSuccess = validationScore >= needed;
      if (isSuccess && profile) {
        playChime('victory');
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
        addXPToDb(100);
        updateStreak();
        firebaseVerbsService.addReactorEnergy(20);
        await firebaseVerbsService.recordBatchValidation(
          profile.slug,
          profile.displayName,
          selectedBatch + 1,
          27
        );
        const updated = await firebaseVerbsService.loadPlayerProfile(profile.slug, profile.displayName);
        setProfile(updated);
      }
    }
  };

  // Filtrage du Codex
  const filteredVerbs = useMemo(() => {
    return MASTER_VERBS_DB.filter((v) => {
      const matchesSearch =
        !searchQuery ||
        v.word.includes(normalizeStr(searchQuery)) ||
        v.details.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLength = lengthFilter === 'all' || v.length === lengthFilter;
      return matchesSearch && matchesLength;
    });
  }, [searchQuery, lengthFilter]);

  return (
    <div className="min-h-screen bg-slate-50 text-lexis-slate pb-20">
      {/* Header FAIZERS Club */}
      <div className="bg-white/95 border-b border-slate-200 sticky top-0 z-20 shadow-sm backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3.5 flex items-center justify-between gap-2">
          {/* Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-gradient-to-br from-blue-700 to-indigo-900 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-md font-black tracking-wider text-xs sm:text-base shrink-0">
              FZ
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="font-extrabold text-sm sm:text-xl tracking-tight text-lexis-slate truncate">
                  FAIZERS <span className="text-emerald-600 font-semibold text-xs sm:text-sm">VERBES</span>
                </h1>
                <span className="bg-emerald-100 text-emerald-800 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.2 rounded-full flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="hidden sm:inline">Firebase Club</span>
                  <span className="sm:hidden">ODS</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                3 742 verbes ODS • 125 lots progressifs • Sas de validation collective
              </p>
            </div>
          </div>

          {/* Profil Joueur & Stats Rapides */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => {
                setTypedAuthName(playerName);
                setIsAuthModalOpen(true);
              }}
              className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 transition text-left"
              title="Cliquer pour changer de joueur ou créer un profil"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] sm:text-xs font-bold shadow-sm notranslate" translate="no">
                {playerName ? playerName.slice(0, 1) : '?'}
              </div>
              <div className="notranslate" translate="no">
                <div className="text-[11px] sm:text-xs font-extrabold text-slate-800 flex items-center gap-1 leading-tight">
                  <span className="max-w-[65px] sm:max-w-[120px] truncate">{playerName || 'Pseudo'}</span>
                  <span className="text-[9px] bg-slate-200 text-slate-600 font-semibold px-1 py-0.2 rounded hidden sm:inline">
                    {playerName ? 'Changer' : 'Connexion'}
                  </span>
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-500 leading-tight">
                  {playerName && profile
                    ? `${profile.completedBatches || 0} lot${(profile.completedBatches || 0) > 1 ? 's' : ''}`
                    : 'Non connecté'}
                </div>
              </div>
            </button>

            <div className="bg-amber-50 border border-amber-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl flex items-center gap-1 text-amber-800 text-[11px] sm:text-xs font-bold">
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
              <span>Lot {selectedBatch + 1}<span className="hidden sm:inline"> / {TOTAL_BATCHES}</span></span>
            </div>
          </div>
        </div>

        {/* Barre d'onglets de navigation */}
        <div className="max-w-6xl mx-auto px-2 sm:px-4 flex gap-1.5 sm:gap-2 border-t border-slate-100 pt-1.5 sm:pt-2 overflow-x-auto no-scrollbar scrollbar-none">
          <button
            onClick={() => {
              setActiveTab('training');
              setScreenMode('selector');
            }}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all relative shrink-0 ${
              activeTab === 'training'
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Entraînement & Lots</span>
            <span className="sm:hidden">Entraînement</span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-normal">#{selectedBatch + 1}</span>
            {activeTab === 'training' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all relative shrink-0 ${
              activeTab === 'team'
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Évolution des membres</span>
            <span className="sm:hidden">Membres</span>
            <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
              Live
            </span>
            {activeTab === 'team' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('codex')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all relative shrink-0 ${
              activeTab === 'codex'
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Codex</span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-normal">({TOTAL_VERBS})</span>
            {activeTab === 'codex' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full"
              />
            )}
          </button>
        </div>
      </div>

      {/* Modal de Connexion / Création de Profil (attaché au body via Portal) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isAuthModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 max-w-sm sm:max-w-md w-full shadow-2xl border border-slate-200 my-auto"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm sm:text-base">
                        FZ
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight">Espace Joueur Club</h3>
                        <p className="text-[11px] sm:text-xs text-slate-500">Choisis ou crée ton prénom</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsAuthModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 font-bold text-base sm:text-lg rounded-lg hover:bg-slate-100 transition"
                      title="Fermer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3.5 sm:space-y-4">
                    <div>
                      <label className="text-[11px] sm:text-xs font-bold text-slate-600 mb-1 block uppercase tracking-wide">
                        Ton prénom ou pseudo :
                      </label>
                      <input
                        type="text"
                        value={typedAuthName}
                        onChange={(e) => setTypedAuthName(e.target.value.toUpperCase())}
                        placeholder="Ex: MARIE, ALEX, FARES..."
                        translate="no"
                        className="notranslate w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-base sm:text-lg font-bold sm:font-black uppercase tracking-normal sm:tracking-wider bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                        autoFocus
                        autoComplete="off"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck="false"
                      />
                    </div>

                    {/* Détection en direct */}
                    {matchedPlayer ? (
                      <div className="p-3 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-xl sm:rounded-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] sm:text-xs font-black text-emerald-800 uppercase flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            Joueur reconnu !
                          </span>
                          <span className="text-[11px] sm:text-xs font-bold text-emerald-700">
                            {matchedPlayer.completedBatches} lot(s) validé(s)
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Bon retour, <strong translate="no" className="notranslate">{matchedPlayer.displayName}</strong> ! Ton entraînement reprend au Lot {(matchedPlayer.currentBatch || 0) + 1}.
                        </p>
                        <button
                          onClick={() => handleSelectPlayer(matchedPlayer.displayName)}
                          className="w-full mt-2.5 sm:mt-3 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition"
                        >
                          Reprendre en tant que {matchedPlayer.displayName} ➔
                        </button>
                      </div>
                    ) : typedAuthName.trim().length > 0 && typedAuthName.trim().toUpperCase() !== 'JOUEUR' ? (
                      <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-xl sm:rounded-2xl">
                        <div className="text-[11px] sm:text-xs font-black text-blue-800 uppercase flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                          Nouveau membre au Club !
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Le prénom <strong translate="no" className="notranslate">{typedAuthName.trim()}</strong> n'est pas encore enregistré. Tu débuteras au Lot n°1.
                        </p>
                        <button
                          onClick={() => handleSelectPlayer(typedAuthName.trim())}
                          className="w-full mt-2.5 sm:mt-3 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition"
                        >
                          Créer le profil et commencer ➔
                        </button>
                      </div>
                    ) : null}

                    {/* Liste rapide des membres déjà enregistrés au club */}
                    {leaderboard.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                          Ou clique sur ton prénom dans le club :
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-32 sm:max-h-40 overflow-y-auto pr-1">
                          {leaderboard.map((p) => (
                            <button
                              key={p.slug}
                              onClick={() => handleSelectPlayer(p.displayName)}
                              translate="no"
                              className="notranslate px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-indigo-50 hover:border-indigo-200 border border-slate-200 rounded-lg sm:rounded-xl text-xs font-bold text-slate-700 hover:text-indigo-700 transition flex items-center gap-1.5"
                            >
                              <span translate="no" className="notranslate">{p.displayName}</span>
                              <span className="text-[10px] bg-white text-slate-500 px-1.5 py-0.2 rounded-full border border-slate-200 font-semibold">
                                {p.completedBatches || 0}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Contenu Principal */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* ============================================================ */}
        {/* ONGLET 1 : ENTRAÎNEMENT & SAS DE VALIDATION                  */}
        {/* ============================================================ */}
        {activeTab === 'training' && (
          <div>
            {/* Mode Sélecteur de lot & Aperçu */}
            {screenMode === 'selector' && (
              <div className="space-y-6">
                {/* Carte de Statut du Lot Actuel */}
                <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-xs uppercase tracking-widest font-black px-3 py-1 rounded-full">
                          Lot n°{selectedBatch + 1} sur {TOTAL_BATCHES}
                        </span>
                        {profile?.validatedBatches.includes(selectedBatch + 1) && (
                          <span className="bg-amber-400 text-amber-950 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                            <ShieldCheck className="w-3.5 h-3.5" /> Validé
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                        Programme de 30 verbes ODS
                      </h2>
                      <p className="text-emerald-100/80 text-sm mt-1 max-w-xl">
                        {currentBatchWords[0]?.length} à {currentBatchWords[currentBatchWords.length - 1]?.length} lettres • Répétez le lot, consolidez vos réflexes d'anagramme, puis passez le sas de validation.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <button
                        onClick={handleStartTraining}
                        className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-emerald-900 hover:bg-emerald-50 rounded-2xl font-black text-sm shadow-lg transition transform hover:-translate-y-0.5"
                      >
                        <Play className="w-4 h-4 fill-emerald-900" />
                        Entraînement (60 tirages)
                      </button>

                      <button
                        onClick={handleStartValidation}
                        className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 rounded-2xl font-black text-sm shadow-lg transition transform hover:-translate-y-0.5 border border-amber-300"
                      >
                        <Award className="w-4 h-4" />
                        Sas de Validation
                      </button>
                    </div>
                  </div>

                  {/* Sélecteur rapide de lots */}
                  <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-emerald-200">Naviguer dans les lots :</span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={selectedBatch <= 0}
                        onClick={() => setSelectedBatch((prev) => Math.max(0, prev - 1))}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg text-xs font-bold transition"
                      >
                        ← Lot précédent
                      </button>
                      <select
                        value={selectedBatch}
                        onChange={(e) => setSelectedBatch(Number(e.target.value))}
                        className="bg-white/10 text-white border border-white/20 rounded-lg text-xs font-bold px-2 py-1 focus:outline-none"
                      >
                        {Array.from({ length: TOTAL_BATCHES }).map((_, i) => (
                          <option key={i} value={i} className="text-slate-900 font-medium">
                            Lot n°{i + 1} {profile?.validatedBatches.includes(i + 1) ? '✓ (Validé)' : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={selectedBatch >= TOTAL_BATCHES - 1}
                        onClick={() => setSelectedBatch((prev) => Math.min(TOTAL_BATCHES - 1, prev + 1))}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg text-xs font-bold transition"
                      >
                        Lot suivant →
                      </button>
                    </div>
                  </div>
                </div>

                {/* Liste des 30 verbes du lot avec définitions */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-emerald-600" />
                      Composition du Lot n°{selectedBatch + 1} ({currentBatchWords.length} verbes)
                    </h3>
                    <span className="text-xs text-slate-400">Cliquez pour voir les détails ODS</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5">
                    {currentBatchWords.map((v) => (
                      <div
                        key={v.word}
                        className="p-2.5 sm:p-3 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-200 rounded-xl transition flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            translate="no"
                            className="notranslate font-black text-slate-800 tracking-wide text-sm sm:text-base"
                          >
                            {v.word}
                          </span>
                          <span className="bg-slate-200/70 text-slate-700 text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded">
                            {v.length}L
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-1 line-clamp-1">
                          {v.details || 'Verbe officiel Scrabble (ODS)'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Encadré Pédagogique : La Règle du Sas de Validation */}
                <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-amber-950 text-base">
                      La Philosophie du Club Faizers : L'Exigence et la Solidarité
                    </h4>
                    <p className="text-amber-900/80 text-sm mt-1 leading-relaxed">
                      Comme le théorisait le professeur <strong>K. Anders Ericsson</strong> et l'illustre champion de Scrabble <strong>Nigel Richards</strong>, une liste de mots n'est assimilée que si elle est rappelée sous pression temporelle.
                      Le <strong>Sas de Validation</strong> exige <strong>au moins 90% de bonnes réponses</strong> (27 sur 30). Une fois franchi, le lot est validé pour toujours dans la base de données du club, et votre contribution augmente la jauge collective de l'équipe !
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Mode Quiz (Entraînement ou Sas de Validation) */}
            {screenMode === 'quiz' && (
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Barre de progression & Header du tirage */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg ${
                        isValidationSession
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isValidationSession ? '⚡ Épreuve Officielle de Validation' : '🎯 Entraînement Double Passe'}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">
                        Verbe de {targetInfo.length} lettres
                      </span>
                    </div>

                    <div className="text-sm font-black text-slate-700">
                      Tirage {currentIndex + 1} / {sessionWords.length}
                    </div>
                  </div>

                  {/* Jauge animée */}
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <motion.div
                      className={`h-full ${
                        isValidationSession ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      initial={false}
                      animate={{
                        width: `${((currentIndex + 1) / sessionWords.length) * 100}%`,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                {/* Arène du Tirage */}
                <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-slate-200 shadow-lg text-center relative">
                  {/* Chrono */}
                  <div className="flex items-center justify-center gap-1.5 mb-4 sm:mb-6">
                    <Clock className={`w-5 h-5 ${timeLeft <= 5 ? 'text-red-500 animate-bounce' : 'text-slate-400'}`} />
                    <span className={`text-xl sm:text-2xl font-black font-mono tabular-nums ${
                      timeLeft <= 5 ? 'text-red-500' : 'text-slate-700'
                    }`}>
                      {timeLeft}s
                    </span>
                  </div>

                  {/* Tuiles de Scrabble (Rack Anagrammé) */}
                  <div className="flex items-center justify-center flex-wrap gap-1.5 sm:gap-2 mb-6 sm:mb-8 notranslate" translate="no">
                    {currentRack.split('').map((char, idx) => (
                      <motion.div
                        key={`${char}-${idx}`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        translate="no"
                        className={`${
                          currentRack.length >= 7
                            ? 'w-9 h-11 sm:w-13 sm:h-15 text-lg sm:text-2xl'
                            : 'w-10 h-12 sm:w-14 sm:h-16 text-xl sm:text-3xl'
                        } bg-[#f7e6c4] border-2 border-[#d2b887] text-[#4a3520] rounded-xl flex items-center justify-center font-black shadow-md select-none transform hover:-translate-y-1 transition notranslate`}
                      >
                        {char}
                      </motion.div>
                    ))}
                  </div>

                  {/* Formulaire de Saisie */}
                  {!showSolution ? (
                    <form onSubmit={handleSubmitAnswer} className="max-w-md mx-auto space-y-3 sm:space-y-4">
                      <div className="flex gap-1.5 sm:gap-2">
                        <input
                          ref={inputRef}
                          type="text"
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                          placeholder="Tapez l'infinitif..."
                          translate="no"
                          className="notranslate flex-1 px-3 sm:px-4 py-2.5 sm:py-3.5 text-center text-lg sm:text-xl font-black uppercase tracking-wider bg-slate-50 border-2 border-slate-300 rounded-xl sm:rounded-2xl focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                          autoComplete="off"
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck="false"
                        />
                        <button
                          type="submit"
                          className="px-4 sm:px-6 py-2.5 sm:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shadow-md transition shrink-0"
                        >
                          Valider
                        </button>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-400">
                        Appuyez sur Entrée pour valider directement
                      </p>
                    </form>
                  ) : (
                    /* Révélation de la Solution */
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`p-4 sm:p-6 rounded-2xl border-2 max-w-md mx-auto ${
                        lastAnswerCorrect
                          ? 'bg-emerald-50 border-emerald-300'
                          : 'bg-red-50 border-red-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {lastAnswerCorrect ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                            <span className="font-black text-emerald-800 text-base sm:text-lg">
                              Excellent réflexe !
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                            <span className="font-black text-red-800 text-base sm:text-lg">
                              Temps écoulé ou mot incorrect
                            </span>
                          </>
                        )}
                      </div>

                      <div
                        translate="no"
                        className="notranslate text-2xl sm:text-3xl font-black text-slate-900 tracking-wider my-2"
                      >
                        {targetWord}
                      </div>

                      {alternateMatch && (
                        <div
                          translate="no"
                          className="notranslate bg-amber-100 text-amber-900 border border-amber-300 rounded-xl p-2.5 my-2 text-xs font-bold text-center"
                        >
                          🌟 Superbe réflexe ! <strong>{alternateMatch}</strong> est une anagramme verbale officielle acceptée ! (La cible de base était {targetWord}).
                        </div>
                      )}

                      <p className="text-[11px] sm:text-xs text-slate-600 mb-4 max-w-xs mx-auto">
                        {targetInfo.details || 'Verbe officiel Scrabble (ODS)'}
                      </p>

                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => {
                            if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
                            setIsPaused(!isPaused);
                          }}
                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                          {isPaused ? 'Reprendre' : 'Pause'}
                        </button>

                        <button
                          onClick={handleNextTurn}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                        >
                          Suivant →
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Bouton pour quitter la session */}
                <div className="text-center">
                  <button
                    onClick={() => setScreenMode('selector')}
                    className="text-xs text-slate-400 hover:text-slate-600 font-semibold underline"
                  >
                    Quitter et revenir au menu du lot
                  </button>
                </div>
              </div>
            )}

            {/* Mode Bilan / Résumé de Session */}
            {screenMode === 'summary' && (
              <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-6">
                {isValidationSession ? (
                  validationScore >= 27 ? (
                    <div>
                      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trophy className="w-10 h-10 animate-bounce" />
                      </div>
                      <h2 className="text-3xl font-black text-slate-800">
                        🎉 FÉLICITATIONS {playerName} !
                      </h2>
                      <p className="text-emerald-700 font-extrabold text-lg mt-1">
                        Lot n°{selectedBatch + 1} Officiellement Validé !
                      </p>
                      <p className="text-slate-500 text-sm mt-2">
                        Score parfait : <strong className="text-slate-800">{validationScore} / 30</strong> (≥ 90%).
                        Votre exploit est enregistré sur Firebase et partagé avec tous les membres du club !
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-10 h-10" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-800">
                        {validationScore >= 25 ? 'Tout près du but !' : 'Presque là !'} Score : {validationScore} / 30
                      </h2>
                      <p className="text-slate-600 text-sm mt-2">
                        Le Sas de Validation requiert au moins <strong>27 / 30</strong>.
                      </p>

                      {/* Carte Spéciale Tie-Break de Sauvetage */}
                      {(validationScore === 25 || validationScore === 26) && (
                        <div className="bg-amber-100 border-2 border-amber-300 rounded-2xl p-4 text-center my-4">
                          <div className="flex items-center justify-center gap-1.5 text-amber-900 font-black text-sm uppercase">
                            <Zap className="w-4 h-4 text-amber-600 fill-amber-500 animate-bounce" />
                            Tie-Break de Sauvetage Disponible !
                          </div>
                          <p className="text-xs text-amber-800 mt-1 max-w-md mx-auto">
                            Tu es à un cheveu de certifier ton lot ! Affronte tes <strong>{sessionErrors.length} verbes manqués</strong> en mort subite (12s/mot). Réussis-en au moins 3 pour valider ton lot immédiatement !
                          </p>
                          <button
                            onClick={handleStartTieBreak}
                            className="mt-3 px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-extrabold text-xs rounded-xl shadow-md transition transform hover:-translate-y-0.5"
                          >
                            ⚡ Lancer le Tie-Break de Sauvetage ➔
                          </button>
                        </div>
                      )}
                    </div>
                  )
                ) : isTieBreakSession ? (
                  validationScore >= Math.min(3, sessionWords.length) ? (
                    <div>
                      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trophy className="w-10 h-10 animate-bounce" />
                      </div>
                      <h2 className="text-3xl font-black text-slate-800">
                        🎉 TIE-BREAK REMPORTÉ !
                      </h2>
                      <p className="text-emerald-700 font-extrabold text-lg mt-1">
                        Lot n°{selectedBatch + 1} Officiellement Sauvé & Validé !
                      </p>
                      <p className="text-slate-500 text-sm mt-2">
                        Tu as relevé le défi sous haute pression ({validationScore}/{sessionWords.length} réussis). Le lot est certifié et ton exploit est enregistré !
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-10 h-10" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-800">
                        Tie-Break Non Franchi ({validationScore}/{sessionWords.length})
                      </h2>
                      <p className="text-slate-600 text-sm mt-2">
                        Prends un court instant pour revoir les verbes ci-dessous, puis retente l'épreuve complète.
                      </p>
                    </div>
                  )
                ) : (
                  <div>
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800">
                      Entraînement Terminé !
                    </h2>
                    <p className="text-slate-600 text-sm mt-2">
                      Vous avez parcouru les 60 tirages de consolidation. Vous êtes maintenant prêt pour l'épreuve officielle du Sas de Validation !
                    </p>
                  </div>
                )}

                {/* Verbes manqués */}
                {sessionErrors.length > 0 && (
                  <div className="text-left bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase">
                      Verbes à retravailler ({sessionErrors.length}) :
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {sessionErrors.map((w) => (
                        <span
                          key={w}
                          className="bg-red-50 text-red-700 border border-red-200 text-xs font-black px-2.5 py-1 rounded-lg"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  {(isValidationSession && validationScore < 27) || (isTieBreakSession && validationScore < Math.min(3, sessionWords.length)) ? (
                    <button
                      onClick={handleStartValidation}
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm shadow transition"
                    >
                      <RotateCcw className="w-4 h-4 inline mr-1.5" />
                      Retenter le Sas de Validation
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedBatch((prev) => Math.min(TOTAL_BATCHES - 1, prev + 1));
                        setScreenMode('selector');
                      }}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow transition"
                    >
                      Passer au Lot suivant →
                    </button>
                  )}

                  <button
                    onClick={() => setScreenMode('selector')}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition"
                  >
                    Retour aux lots
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* ONGLET 2 : ÉVOLUTION DES MEMBRES                             */}
        {/* ============================================================ */}
        {activeTab === 'team' && (
          <div className="space-y-6 sm:space-y-8">
            {/* La Grande Pyramide Collective */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                  <span className="text-amber-300 text-[10px] sm:text-xs font-black tracking-widest uppercase">
                    La Jauge Collective du Club Faizers
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 mb-4">
                  <div>
                    <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
                      {clubTotalConqueredVerbs} <span className="text-slate-400 text-lg sm:text-xl font-normal">/ {TOTAL_VERBS}</span>
                    </h2>
                    <p className="text-slate-300 text-xs sm:text-sm mt-1">
                      Verbes uniques conquis par au moins un joueur du club.
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xl sm:text-2xl font-black text-emerald-400">
                      {((clubTotalConqueredVerbs / TOTAL_VERBS) * 100).toFixed(1)}%
                    </span>
                    <span className="text-[11px] sm:text-xs text-slate-400 block">du dictionnaire ODS conquis</span>
                  </div>
                </div>

                {/* Barre collective */}
                <div className="w-full bg-slate-800 rounded-full h-3.5 sm:h-4 overflow-hidden border border-slate-700 p-0.5">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(2, (clubTotalConqueredVerbs / TOTAL_VERBS) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Le Réacteur Hebdomadaire Faizers */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl sm:rounded-3xl p-4 sm:p-7 text-white shadow-lg relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-200 fill-yellow-200 animate-pulse" />
                    <span className="text-[10px] sm:text-xs uppercase font-black tracking-widest text-amber-100">
                      Le Réacteur de la Semaine • Énergie Collective
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-3xl font-black">
                    {weeklyEnergy} <span className="text-base sm:text-lg font-normal text-amber-100">/ 1 500 pts</span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-amber-100 mt-1 max-w-xl leading-relaxed">
                    Chaque tirage réussi rapporte <strong>1 pt</strong> (+25 pts par lot validé). Tous les membres font monter ensemble cette jauge !
                  </p>
                </div>

                <div className="w-full sm:w-56 bg-black/20 rounded-full h-3 sm:h-3.5 overflow-hidden p-0.5 shrink-0 border border-white/20">
                  <div
                    className="bg-white h-full rounded-full transition-all duration-500 shadow"
                    style={{ width: `${Math.min(100, Math.max(4, (weeklyEnergy / 1500) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Grille : Classement & Fil d'Activité en Direct */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tableau d'Honneur des Membres */}
              <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                      <Award className="w-5 h-5 text-indigo-600" />
                      Tableau d'Honneur des Faizers
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500">Mise à jour en temps réel via Firebase</p>
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    {leaderboard.length} joueur{leaderboard.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="overflow-x-auto -mx-1 sm:mx-0">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[10px] sm:text-xs font-bold uppercase">
                        <th className="pb-2.5 sm:pb-3 pl-1 sm:pl-2">Rang</th>
                        <th className="pb-2.5 sm:pb-3">Joueur</th>
                        <th className="pb-2.5 sm:pb-3 text-center">Lots</th>
                        <th className="pb-2.5 sm:pb-3 text-center">Verbes</th>
                        <th className="pb-2.5 sm:pb-3 text-right pr-1 sm:pr-2">En cours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaderboard.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                            Aucun joueur enregistré pour le moment. Connectez-vous et validez votre premier lot !
                          </td>
                        </tr>
                      ) : (
                        leaderboard.map((player, idx) => (
                          <tr
                            key={player.slug}
                            className={`hover:bg-slate-50 transition ${
                              player.slug === profile?.slug ? 'bg-emerald-50/50 font-bold' : ''
                            }`}
                          >
                            <td className="py-2.5 sm:py-3.5 pl-1 sm:pl-2 font-black text-slate-500">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                            </td>
                            <td className="py-2.5 sm:py-3.5 font-bold text-slate-800 notranslate" translate="no">
                              {player.displayName}
                              {player.slug === profile?.slug && (
                                <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                                  Moi
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 sm:py-3.5 text-center font-black text-indigo-600">
                              {player.completedBatches || 0}
                            </td>
                            <td className="py-2.5 sm:py-3.5 text-center font-black text-emerald-600">
                              {(player.completedBatches || 0) * BATCH_SIZE}
                            </td>
                            <td className="py-2.5 sm:py-3.5 text-right pr-1 sm:pr-2 text-[11px] sm:text-xs font-semibold text-slate-500">
                              Lot {(player.currentBatch || 0) + 1}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fil d'Activité en Direct */}
              <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                      Activité du Club en Direct
                    </h3>
                  </div>

                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {clubActivities.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs">
                        Le flux d'activité s'animera dès les premières validations de lots.
                      </div>
                    ) : (
                      clubActivities.map((act, i) => (
                        <div
                          key={act.id || i}
                          className="p-2.5 sm:p-3 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs"
                        >
                          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                            ✓
                          </div>
                          <div>
                            <p className="text-slate-800 leading-snug">
                              <strong translate="no" className="notranslate">{act.player}</strong> a validé le{' '}
                              <strong className="text-emerald-700">Lot #{act.batchNumber}</strong>
                              {act.score && ` (${act.score})`} !
                            </p>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                              {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Citation Motivante */}
                <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 italic">
                  « Le secret de la victoire réside dans le travail quotidien d'équipe. » — Club Faizers
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ONGLET 3 : CODEX DES 3 742 VERBES ODS                       */}
        {/* ============================================================ */}
        {activeTab === 'codex' && (
          <div className="space-y-6">
            {/* Moteur de Recherche & Filtres */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un verbe (ex: AGIR, CODER, DÉFINITION)..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              {/* Filtre Longueur */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setLengthFilter('all')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    lengthFilter === 'all'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tous ({TOTAL_VERBS})
                </button>
                {[4, 5, 6, 7, 8, 9].map((len) => (
                  <button
                    key={len}
                    onClick={() => setLengthFilter(len)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                      lengthFilter === len
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {len}L
                  </button>
                ))}
              </div>
            </div>

            {/* Compteur de résultats */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-2">
              <span>{filteredVerbs.length} verbe{filteredVerbs.length > 1 ? 's' : ''} trouvé{filteredVerbs.length > 1 ? 's' : ''}</span>
              <span>Triés par longueur puis par ordre alphabétique</span>
            </div>

            {/* Grille des Verbes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {filteredVerbs.slice(0, 120).map((v) => (
                <div
                  key={v.word}
                  className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span
                      translate="no"
                      className="notranslate font-black text-slate-900 tracking-wide text-base sm:text-lg"
                    >
                      {v.word}
                    </span>
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md">
                      {v.length}L
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1.5 line-clamp-2">
                    {v.details || 'Verbe du dictionnaire officiel du Scrabble (ODS).'}
                  </p>
                </div>
              ))}
            </div>

            {filteredVerbs.length > 120 && (
              <p className="text-center text-xs text-slate-400 py-4">
                Affichage des 120 premiers verbes. Utilisez la recherche pour affiner.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClubVerbsPage;
