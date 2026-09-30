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
  Lock,
  LockOpen,
  Crown,
  GraduationCap,
} from 'lucide-react';
import {
  MASTER_VERBS_DB,
  WORD_MAP,
  ANAGRAM_MAP,
  TOTAL_BATCHES,
  MASTER_TIER_BATCHES,
  ELITE_TIER_BATCHES,
  MASTER_TIER_VERBS,
  ELITE_TIER_VERBS,
  isEliteBatch,
  getBatchWords,
  getAnagramRack,
  normalizeStr,
} from '../data/masterVerbsDb';
import {
  firebaseVerbsService,
  type PlayerVerbProfile,
  type ClubActivityEvent,
} from '../services/firebaseVerbsService';
import { addXP as addXPToDb, updateStreak } from '../services/learningStore';
import { WeeklyClubPanel } from '../components/Verbs/WeeklyClubPanel';
import { VerbInfo, VerbLegend } from '../components/Verbs/VerbInfo';
import { VerbGuidePanel } from '../components/Verbs/VerbGuidePanel';

type TabMode = 'training' | 'team' | 'codex' | 'guide';
type ScreenMode = 'selector' | 'preview' | 'quiz' | 'validation' | 'summary';

// Synthétiseur audio Web Audio API pour les chimes de réussite (zéro fichier externe)
function playChime(type: 'correct' | 'wrong' | 'victory' | 'unlock' | 'fanfare') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (type === 'unlock' || type === 'fanfare') {
      playCeremony(ctx, type);
      return;
    }
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

// Sons de cérémonie du Panthéon : déclic de cadenas + fanfare de cuivres synthétiques
function playCeremony(ctx: AudioContext, type: 'unlock' | 'fanfare') {
  const master = ctx.createGain();
  master.gain.value = type === 'unlock' ? 0.12 : 0.16;
  master.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.03;

  const note = (freq: number, start: number, dur: number, wave: OscillatorType, vol: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2600;
    o.type = wave;
    o.frequency.setValueAtTime(freq, t0 + start);
    g.gain.setValueAtTime(0.0001, t0 + start);
    g.gain.exponentialRampToValueAtTime(vol, t0 + start + 0.025);
    g.gain.setValueAtTime(vol, t0 + start + dur * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
    o.connect(f);
    f.connect(g);
    g.connect(master);
    o.start(t0 + start);
    o.stop(t0 + start + dur + 0.05);
  };

  if (type === 'unlock') {
    // « clic-clac » métallique du cadenas qui cède
    note(1400, 0, 0.05, 'square', 0.6);
    note(2100, 0.07, 0.06, 'square', 0.5);
    note(880, 0.16, 0.25, 'triangle', 0.6);
    setTimeout(() => ctx.close().catch(() => undefined), 800);
    return;
  }

  // Ta-ta-ta TAAA… ta-TAAAA, puis accord final de do majeur
  const phrase: [number, number, number][] = [
    [392.0, 0, 0.13],
    [392.0, 0.15, 0.13],
    [392.0, 0.3, 0.13],
    [523.25, 0.45, 0.48],
    [659.25, 0.95, 0.16],
    [783.99, 1.13, 0.62],
  ];
  phrase.forEach(([freq, start, dur]) => {
    note(freq, start, dur, 'sawtooth', 0.45);
    note(freq * 2, start, dur, 'triangle', 0.18);
  });
  [523.25, 659.25, 783.99, 1046.5].forEach((freq) => note(freq, 1.85, 1.7, 'triangle', 0.32));
  note(130.81, 1.85, 1.7, 'sawtooth', 0.28);
  note(261.63, 1.85, 1.7, 'sawtooth', 0.2);
  setTimeout(() => ctx.close().catch(() => undefined), 4200);
}

// ============================================================
// Paliers : « Maître Club » (lots 1-125) puis « Panthéon ODS »
// ============================================================
/** Seuil de Certification d'un lot : 28/30 (93 %). Passé de 27 à 28 le 30/09/2026 ; les lots déjà validés restent acquis. */
const CERT_PASS_SCORE = 28;
const CERT_PASS_PCT = Math.floor((CERT_PASS_SCORE / 30) * 100);
/** Scores juste sous le seuil qui ouvrent le Tie-Break de sauvetage. */
const TIE_BREAK_MIN_SCORE = CERT_PASS_SCORE - 2;

const HAS_ELITE_TIER = ELITE_TIER_BATCHES > 0 && ELITE_TIER_VERBS > 0;
const MASTER_WORD_SET = new Set(
  Array.from({ length: MASTER_TIER_BATCHES }).flatMap((_, i) => getBatchWords(i).map((v) => v.word))
);
const ELITE_TEASER_WORDS = HAS_ELITE_TIER ? getBatchWords(MASTER_TIER_BATCHES).slice(0, 5).map((v) => v.word) : [];

/** « Aujourd'hui 14:05 », « Hier 22:31 » ou « lun. 28 sept. 09:54 ». */
function formatActivityTime(timestamp: number): string {
  const d = new Date(timestamp);
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (dayDiff === 0) return `Aujourd'hui ${time}`;
  if (dayDiff === 1) return `Hier ${time}`;
  return `${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

/** Nombre de verbes distincts couverts par une liste de lots validés (numéros 1-based). */
function countVerbsInBatches(validated?: number[] | null): number {
  if (!Array.isArray(validated)) return 0;
  const words = new Set<string>();
  validated.forEach((b) => {
    if (b >= 1 && b <= TOTAL_BATCHES) getBatchWords(b - 1).forEach((v) => words.add(v.word));
  });
  return words.size;
}

// Overrides de test UNIQUEMENT en dev : ?unlock=1, ?celebrate=1, ?lots=N (faux nombre de lots validés)
const DEV_QUERY = import.meta.env.DEV && typeof window !== 'undefined' ? window.location.search : '';
const DEV_FORCE_UNLOCK = /[?&](unlock|celebrate)=1(&|$)/.test(DEV_QUERY);
const DEV_FORCE_CELEBRATE = /[?&]celebrate=1(&|$)/.test(DEV_QUERY);
const DEV_FAKE_MASTER_LOTS: number | null = (() => {
  const m = DEV_QUERY.match(/[?&]lots=(\d+)/);
  return m ? Math.min(MASTER_TIER_BATCHES, Number(m[1])) : null;
})();

function countMasterValidated(validated?: number[] | null): number {
  if (!Array.isArray(validated)) return 0;
  return new Set(validated.filter((b) => b >= 1 && b <= MASTER_TIER_BATCHES)).size;
}

/** Vrai si le joueur a réellement validé les 125 lots du palier 1. */
function isPantheonMember(validated?: number[] | null): boolean {
  return countMasterValidated(validated) >= MASTER_TIER_BATCHES;
}

/** Accès au palier 2 (inclut les overrides de dev). */
function computePantheonUnlocked(validated?: number[] | null): boolean {
  if (DEV_FORCE_UNLOCK) return true;
  const count = DEV_FAKE_MASTER_LOTS ?? countMasterValidated(validated);
  return count >= MASTER_TIER_BATCHES;
}

/** Ramène un index de lot dans la plage autorisée pour ce joueur. */
function clampBatchIndex(index: number, unlocked: boolean): number {
  const max = (unlocked ? TOTAL_BATCHES : Math.min(TOTAL_BATCHES, MASTER_TIER_BATCHES)) - 1;
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(max, Math.floor(index)));
}

const pantheonSeenKey = (slug: string) => `faizers_pantheon_celebrated_${slug}`;
function readPantheonSeen(slug: string): boolean {
  try {
    return localStorage.getItem(pantheonSeenKey(slug)) === '1';
  } catch {
    return false;
  }
}
function writePantheonSeen(slug: string) {
  try {
    localStorage.setItem(pantheonSeenKey(slug), '1');
  } catch {
    // stockage indisponible (navigation privée) : non bloquant
  }
}

// Overlay plein écran de déblocage du Panthéon
const PantheonCelebration: React.FC<{
  open: boolean;
  playerName: string;
  onEnter: () => void;
  onClose: () => void;
}> = ({ open, playerName, onEnter, onClose }) => {
  const [lockOpened, setLockOpened] = useState(false);

  useEffect(() => {
    if (!open) {
      setLockOpened(false);
      return;
    }
    const colors = ['#fbbf24', '#f59e0b', '#fde68a', '#fef3c7', '#10b981', '#34d399'];
    const fire = (opts: confetti.Options) =>
      confetti({ zIndex: 250, colors, disableForReducedMotion: true, ...opts });
    const timers: ReturnType<typeof setTimeout>[] = [];
    let raf = 0;

    // 1) le cadenas tremble puis cède
    timers.push(setTimeout(() => playChime('unlock'), 850));
    timers.push(
      setTimeout(() => {
        setLockOpened(true);
        playChime('fanfare');
        fire({ particleCount: 150, spread: 100, startVelocity: 48, origin: { y: 0.45 } });
      }, 1100)
    );
    // 2) canons latéraux
    timers.push(
      setTimeout(() => {
        fire({ particleCount: 90, angle: 60, spread: 65, startVelocity: 60, origin: { x: 0, y: 0.8 } });
        fire({ particleCount: 90, angle: 120, spread: 65, startVelocity: 60, origin: { x: 1, y: 0.8 } });
      }, 1650)
    );
    // 3) pluie d'étoiles sur l'accord final
    timers.push(
      setTimeout(() => {
        fire({ particleCount: 120, spread: 170, startVelocity: 32, scalar: 1.25, shapes: ['star'], origin: { y: 0.3 } });
      }, 2950)
    );
    // 4) flux continu doré pendant ~2,5 s
    timers.push(
      setTimeout(() => {
        const end = Date.now() + 2500;
        const frame = () => {
          fire({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.65 } });
          fire({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.65 } });
          if (Date.now() < end) raf = requestAnimationFrame(frame);
        };
        frame();
      }, 3300)
    );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (typeof document === 'undefined') return null;

  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: lockOpened ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
    transition: { duration: 0.5, delay: lockOpened ? delay : 0 },
  });

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="pantheon-celebration"
          role="dialog"
          aria-modal="true"
          aria-label="Maître des Verbes Faizers"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/95 backdrop-blur-md"
        >
          {/* Halo & rayons tournants */}
          <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden flex items-center justify-center">
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(circle at 50% 38%, rgba(251,191,36,0.28), rgba(16,185,129,0.08) 38%, transparent 65%)' }}
            />
            <motion.div
              className="w-[140vmax] h-[140vmax] shrink-0 rounded-full"
              style={{
                background:
                  'repeating-conic-gradient(from 0deg, rgba(251,191,36,0.13) 0deg 7deg, transparent 7deg 22deg)',
                maskImage: 'radial-gradient(circle, black 10%, transparent 55%)',
                WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 55%)',
              }}
              initial={{ opacity: 0, rotate: 0 }}
              animate={{ opacity: lockOpened ? 1 : 0.35, rotate: 360 }}
              transition={{ rotate: { duration: 60, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.8 } }}
            />
          </div>

          <div className="relative min-h-full flex items-center justify-center px-4 py-10">
            <motion.div
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 170, damping: 18 }}
              className="w-full max-w-sm text-center"
            >
              {/* Médaillon : le cadenas qui s'ouvre */}
              <div className="relative mx-auto w-28 h-28 sm:w-32 sm:h-32 mb-7">
                <motion.div
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-amber-400/40 blur-2xl"
                  animate={lockOpened ? { scale: [1, 1.8, 1.35], opacity: [0.4, 1, 0.7] } : { scale: 1, opacity: 0.4 }}
                  transition={{ duration: 1.1 }}
                />
                <motion.div
                  className="relative w-full h-full rounded-full bg-gradient-to-br from-amber-100 via-amber-400 to-amber-600 border-4 border-amber-200/80 shadow-[0_0_60px_rgba(251,191,36,0.55)] flex items-center justify-center"
                  animate={
                    lockOpened
                      ? { rotate: 0, scale: [1, 1.18, 1] }
                      : { rotate: [0, -14, 14, -10, 10, -5, 5, 0], scale: 1 }
                  }
                  transition={lockOpened ? { duration: 0.55 } : { duration: 0.75, delay: 0.25 }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {lockOpened ? (
                      <motion.span
                        key="open"
                        initial={{ scale: 0.3, rotate: -35, opacity: 0, y: 6 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 13 }}
                      >
                        <LockOpen className="w-12 h-12 sm:w-14 sm:h-14 text-amber-950" strokeWidth={2.4} />
                      </motion.span>
                    ) : (
                      <motion.span key="closed" exit={{ scale: 0.5, opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                        <Lock className="w-12 h-12 sm:w-14 sm:h-14 text-amber-950" strokeWidth={2.4} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
                <AnimatePresence>
                  {lockOpened && (
                    <motion.div
                      className="absolute -top-8 left-1/2 -ml-5"
                      initial={{ y: -40, opacity: 0, rotate: -25 }}
                      animate={{ y: 0, opacity: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.3 }}
                    >
                      <Crown className="w-10 h-10 text-amber-300 fill-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.p {...reveal(0.15)} className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-amber-300">
                Palier 1 accompli · {MASTER_TIER_BATCHES} / {MASTER_TIER_BATCHES} lots
              </motion.p>
              <motion.h2
                {...reveal(0.3)}
                className="mt-2 text-3xl sm:text-4xl font-black leading-tight tracking-tight bg-gradient-to-r from-amber-200 via-yellow-50 to-amber-300 bg-clip-text text-transparent"
              >
                Maître des Verbes Faizers
              </motion.h2>
              <motion.p {...reveal(0.5)} className="mt-3 text-sm text-slate-300 leading-relaxed">
                Bravo{' '}
                <strong translate="no" className="notranslate text-white">
                  {playerName || 'champion'}
                </strong>{' '}
                ! Tu as certifié les {MASTER_TIER_VERBS.toLocaleString('fr-FR')} verbes du programme Maître Club.
              </motion.p>

              <motion.div {...reveal(0.65)} className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { v: String(MASTER_TIER_BATCHES), l: 'lots' },
                  { v: MASTER_TIER_VERBS.toLocaleString('fr-FR'), l: 'verbes' },
                  { v: `≥ ${CERT_PASS_SCORE}/30`, l: 'par lot' },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl bg-white/5 border border-amber-300/20 py-2">
                    <div className="text-base sm:text-lg font-black text-amber-200 leading-none">{s.v}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">{s.l}</div>
                  </div>
                ))}
              </motion.div>

              <motion.p {...reveal(0.8)} className="mt-4 text-xs sm:text-sm text-amber-100/80 leading-relaxed">
                {HAS_ELITE_TIER
                  ? `Le Panthéon ODS t'ouvre ses portes : ${ELITE_TIER_BATCHES} lots bonus, ${ELITE_TIER_VERBS.toLocaleString('fr-FR')} verbes rares du dictionnaire.`
                  : 'Le Panthéon ODS, palier bonus des verbes rares, ouvre bientôt ses portes. Ton accès est déjà réservé.'}
              </motion.p>

              <motion.div {...reveal(0.95)} className="mt-6 flex flex-col gap-2.5">
                <button
                  onClick={HAS_ELITE_TIER ? onEnter : onClose}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm sm:text-base text-amber-950 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 hover:from-amber-400 hover:to-amber-500 shadow-[0_10px_40px_-8px_rgba(251,191,36,0.7)] border border-amber-100 transition"
                >
                  <Crown className="w-5 h-5 shrink-0" />
                  {HAS_ELITE_TIER ? 'Entrer dans le Panthéon' : 'Continuer'}
                </button>
                {HAS_ELITE_TIER && (
                  <button onClick={onClose} className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition py-1">
                    Rester au palier 1 pour l'instant
                  </button>
                )}
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export const ClubVerbsPage: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<TabMode>('training');
  const [screenMode, setScreenMode] = useState<ScreenMode>('selector');

  // Identité joueur
  const [playerName, setPlayerName] = useState<string>(() => {
    const saved = localStorage.getItem('faizers_verb_user');
    if (saved && ['JOUEUR', 'ANTIGRAVITY', 'MEMBRE'].includes(saved.trim().toUpperCase())) {
      localStorage.removeItem('faizers_verb_user');
      return '';
    }
    return saved ? saved.trim() : '';
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('faizers_verb_user');
    return !saved || ['JOUEUR', 'ANTIGRAVITY', 'MEMBRE'].includes(saved.trim().toUpperCase());
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
  const [sessionErrors, setSessionErrors] = useState<string[]>([]);
  const [validationScore, setValidationScore] = useState(0);
  const [foundSolutions, setFoundSolutions] = useState<string[]>([]);

  // Codex Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [lengthFilter, setLengthFilter] = useState<number | 'all'>('all');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Paliers : Maître Club (1-125) → Panthéon ODS (126+)
  const [codexTier, setCodexTier] = useState<'master' | 'elite'>('master');
  const [pantheonHint, setPantheonHint] = useState(0); // >0 : message de verrou visible (sert aussi de clé d'animation)
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const pantheonHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const masterValidatedCount = DEV_FAKE_MASTER_LOTS ?? countMasterValidated(profile?.validatedBatches);
  const isPantheonUnlocked = computePantheonUnlocked(profile?.validatedBatches);
  const isPantheonBadge = isPantheonMember(profile?.validatedBatches) || DEV_FORCE_UNLOCK;
  const inPantheon = isEliteBatch(selectedBatch);
  const masterProgressPct = Math.min(100, (masterValidatedCount / MASTER_TIER_BATCHES) * 100);
  const eliteValidatedCount = (profile?.validatedBatches || []).filter((b) => b > MASTER_TIER_BATCHES).length;

  const triggerPantheonHint = () => {
    setPantheonHint((n) => n + 1);
    if (pantheonHintTimer.current) clearTimeout(pantheonHintTimer.current);
    pantheonHintTimer.current = setTimeout(() => setPantheonHint(0), 4500);
  };

  /** Seul point d'entrée pour changer de lot : applique le verrou du Panthéon. */
  const goToBatch = (target: number) => {
    if (isEliteBatch(target) && !isPantheonUnlocked) {
      triggerPantheonHint();
      setSelectedBatch(clampBatchIndex(target, false));
      return;
    }
    setSelectedBatch(clampBatchIndex(target, isPantheonUnlocked));
  };

  const enterPantheon = () => {
    setCelebrationOpen(false);
    if (!isPantheonUnlocked || !HAS_ELITE_TIER) {
      triggerPantheonHint();
      return;
    }
    // Premier lot Panthéon non encore validé (lot 126 par défaut)
    let target = MASTER_TIER_BATCHES;
    const validated = profile?.validatedBatches || [];
    while (target < TOTAL_BATCHES - 1 && validated.includes(target + 1)) target++;
    setActiveTab('training');
    setScreenMode('selector');
    setSelectedBatch(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openGuide = () => {
    setActiveTab('guide');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Depuis le guide : ouvre le Codex filtré sur ce verbe, dans le bon palier. */
  const openVerbInCodex = (word: string) => {
    const index = MASTER_VERBS_DB.findIndex((v) => v.word === word);
    setCodexTier(index >= MASTER_TIER_VERBS ? 'elite' : 'master');
    setLengthFilter('all');
    setSearchQuery(word);
    setActiveTab('codex');
    window.scrollTo({ top: 0 });
  };

  // Garde-fou global : aucun lot du palier 2 sans avoir validé les 125 lots du palier 1
  useEffect(() => {
    const clamped = clampBatchIndex(selectedBatch, isPantheonUnlocked);
    if (clamped !== selectedBatch) setSelectedBatch(clamped);
  }, [selectedBatch, isPantheonUnlocked]);

  // Célébration de déblocage : une seule fois par joueur (profil Firebase + localStorage)
  useEffect(() => {
    if (!profile || celebrationOpen) return;
    if (!isPantheonMember(profile.validatedBatches)) return;
    if (profile.pantheonCelebrated || readPantheonSeen(profile.slug)) return;
    const slug = profile.slug;
    const t = setTimeout(() => {
      writePantheonSeen(slug);
      firebaseVerbsService.markPantheonCelebrated(slug);
      setProfile((prev) => (prev && prev.slug === slug ? { ...prev, pantheonCelebrated: true } : prev));
      setCelebrationOpen(true);
    }, 900);
    return () => clearTimeout(t);
  }, [profile, celebrationOpen]);

  // Dev uniquement : ?celebrate=1 rejoue la célébration sans rien mémoriser
  useEffect(() => {
    if (!DEV_FORCE_CELEBRATE) return;
    const t = setTimeout(() => setCelebrationOpen(true), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => () => {
    if (pantheonHintTimer.current) clearTimeout(pantheonHintTimer.current);
  }, []);

  // Charger le profil lors du changement de joueur
  useEffect(() => {
    if (!playerName || ['JOUEUR', 'ANTIGRAVITY', 'MEMBRE'].includes(playerName.toUpperCase())) {
      setProfile(null);
      setIsAuthModalOpen(true);
      return;
    }
    const slug = firebaseVerbsService.slugify(playerName);
    firebaseVerbsService.loadPlayerProfile(slug, playerName).then((p) => {
      if (p) {
        setProfile(p);
        const unlocked = computePantheonUnlocked(p.validatedBatches);
        if (p.activeSession && typeof p.activeSession.batchIndex === 'number' && p.activeSession.currentIndex < 30) {
          setSelectedBatch(clampBatchIndex(p.activeSession.batchIndex, unlocked));
        } else {
          setSelectedBatch(clampBatchIndex(p.currentBatch || 0, unlocked));
        }
      } else {
        // Le profil n'existe pas ou plus sur Firebase -> vider le cache et inviter à créer
        localStorage.removeItem('faizers_verb_user');
        setPlayerName('');
        setProfile(null);
        setIsAuthModalOpen(true);
      }
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

    return () => {
      unsubLeaderboard();
      unsubActivity();
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
  // Jauge collective : objectif principal = verbes du palier 1, le Panthéon compte en bonus
  const { clubTotalConqueredVerbs, clubEliteConqueredVerbs } = useMemo(() => {
    const setOfConquered = new Set<string>();
    leaderboard.forEach((p) => {
      (p.validatedBatches || []).forEach((b) => {
        const words = getBatchWords(b - 1);
        words.forEach((w) => setOfConquered.add(w.word));
      });
    });
    let master = 0;
    setOfConquered.forEach((w) => {
      if (MASTER_WORD_SET.has(w)) master++;
    });
    return { clubTotalConqueredVerbs: master, clubEliteConqueredVerbs: setOfConquered.size - master };
  }, [leaderboard]);

  const currentBatchWords = useMemo(() => {
    return getBatchWords(selectedBatch);
  }, [selectedBatch]);

  const targetWord = sessionWords[currentIndex] || '';
  const targetInfo = WORD_MAP[targetWord] || { length: targetWord.length, details: '' };
  const currentRack = useMemo(() => {
    return targetWord ? getAnagramRack(targetWord) : '';
  }, [targetWord]);

  // Toutes les solutions verbales officielles pour ce tirage
  const allSolutions = useMemo(() => {
    if (!currentRack) return [];
    const matches = ANAGRAM_MAP[currentRack] || [];
    return Array.from(new Set(matches.map((v) => v.word)));
  }, [currentRack]);

  // Joueur correspondant à la saisie dans le modal d'authentification
  const matchedPlayer = useMemo(() => {
    const clean = typedAuthName.trim().toUpperCase();
    if (!clean || clean === 'JOUEUR') return null;
    const targetSlug = firebaseVerbsService.slugify(clean);
    return leaderboard.find((p) => p.slug === targetSlug) || null;
  }, [typedAuthName, leaderboard]);

  const handleSelectPlayer = async (name: string) => {
    const clean = name.trim().toUpperCase();
    if (clean && !['JOUEUR', 'ANTIGRAVITY', 'MEMBRE'].includes(clean)) {
      const slug = firebaseVerbsService.slugify(clean);
      let p = await firebaseVerbsService.loadPlayerProfile(slug, clean);
      if (!p) {
        p = await firebaseVerbsService.createPlayerProfile(clean);
      }
      localStorage.setItem('faizers_verb_user', clean);
      setPlayerName(clean);
      setProfile(p);
      const unlocked = computePantheonUnlocked(p.validatedBatches);
      if (p.activeSession && typeof p.activeSession.batchIndex === 'number' && p.activeSession.currentIndex < 30) {
        setSelectedBatch(clampBatchIndex(p.activeSession.batchIndex, unlocked));
      } else {
        setSelectedBatch(clampBatchIndex(p.currentBatch || 0, unlocked));
      }
      setIsAuthModalOpen(false);
      setTypedAuthName('');
    }
  };

  const handleStartValidation = () => {
    if (isEliteBatch(selectedBatch) && !isPantheonUnlocked) {
      triggerPantheonHint();
      return;
    }
    const batchWords = getBatchWords(selectedBatch).map((w) => w.word);
    const shuffled = [...batchWords].sort(() => Math.random() - 0.5);
    setSessionWords(shuffled);
    setCurrentIndex(0);
    setSessionErrors([]);
    setValidationScore(0);
    setFoundSolutions([]);
    setIsValidationSession(true);
    setIsTieBreakSession(false);
    setShowSolution(false);
    setTimeLeft(20);
    setIsPaused(false);
    setUserInput('');
    setScreenMode('quiz');

    // Sauvegarde initiale de la session
    if (profile) {
      const sessionData = {
        batchIndex: selectedBatch,
        currentIndex: 0,
        sessionWords: shuffled,
        validationScore: 0,
        sessionErrors: [],
        lastSaved: Date.now(),
      };
      firebaseVerbsService.saveActiveSession(profile.slug, sessionData);
      setProfile((prev) => prev ? { ...prev, activeSession: sessionData } : null);
    }
  };

  const handleResumeSession = () => {
    if (!profile?.activeSession) return;
    const session = profile.activeSession;
    if (isEliteBatch(session.batchIndex) && !isPantheonUnlocked) {
      triggerPantheonHint();
      return;
    }
    setSelectedBatch(session.batchIndex);
    setSessionWords(session.sessionWords);
    setCurrentIndex(session.currentIndex);
    setValidationScore(session.validationScore);
    setSessionErrors(session.sessionErrors || []);
    setFoundSolutions([]);
    setIsValidationSession(true);
    setIsTieBreakSession(false);
    setShowSolution(false);
    setTimeLeft(20);
    setIsPaused(false);
    setUserInput('');
    setScreenMode('quiz');
  };

  const handleRestartSession = () => {
    if (profile) {
      firebaseVerbsService.clearActiveSession(profile.slug);
      setProfile((prev) => prev ? { ...prev, activeSession: null } : null);
    }
    handleStartValidation();
  };

  const handleStartTieBreak = () => {
    const errorWords = [...sessionErrors];
    if (errorWords.length === 0) return;
    setSessionWords(errorWords);
    setCurrentIndex(0);
    setValidationScore(0);
    setFoundSolutions([]);
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
    if (!normalizedInput) return;

    const isMatch = allSolutions.includes(normalizedInput);

    if (isMatch) {
      if (foundSolutions.includes(normalizedInput)) {
        // Déjà entré
        setUserInput('');
        return;
      }

      const updatedFound = [...foundSolutions, normalizedInput];
      setFoundSolutions(updatedFound);
      setUserInput('');

      // Est-ce que toutes les solutions du tirage ont été trouvées ?
      if (updatedFound.length >= allSolutions.length) {
        playChime('correct');
        setLastAnswerCorrect(true);
        if (isValidationSession || isTieBreakSession) {
          setValidationScore((prev) => prev + 1);
        }
        addXPToDb(10 * allSolutions.length);
        displaySolutionAndAdvance(true);
      } else {
        // Solution partielle trouvée avec succès !
        playChime('correct');
        // Bonus de temps pour chercher les autres solutions
        setTimeLeft((prev) => Math.min(25, prev + 5));
      }
    } else {
      playChime('wrong');
      setUserInput('');
    }
  };

  const handleTimeExpired = () => {
    if (showSolution) return;
    playChime('wrong');
    setLastAnswerCorrect(false);
    if (!sessionErrors.includes(targetWord)) {
      setSessionErrors((prev) => [...prev, targetWord]);
    }
    displaySolutionAndAdvance(false);
  };

  const displaySolutionAndAdvance = (wasCorrect: boolean) => {
    setShowSolution(true);
    if (timerRef.current) clearInterval(timerRef.current);

    autoAdvanceRef.current = setTimeout(() => {
      handleNextTurn(wasCorrect);
    }, wasCorrect ? 1800 : 2800);
  };

  const handleNextTurn = (lastWasCorrect?: boolean) => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    setShowSolution(false);
    setUserInput('');
    setFoundSolutions([]);

    if (currentIndex + 1 < sessionWords.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setTimeLeft(isValidationSession ? 20 : isTieBreakSession ? 12 : 20);

      // Persistance en direct de la session
      if (profile && isValidationSession) {
        const nextScore = lastWasCorrect !== undefined 
          ? (lastWasCorrect ? validationScore + 1 : validationScore)
          : validationScore;
        const nextErrors = lastWasCorrect === false && !sessionErrors.includes(targetWord)
          ? [...sessionErrors, targetWord]
          : sessionErrors;

        const sessionData = {
          batchIndex: selectedBatch,
          currentIndex: nextIdx,
          sessionWords,
          validationScore: nextScore,
          sessionErrors: nextErrors,
          lastSaved: Date.now(),
        };
        firebaseVerbsService.saveActiveSession(profile.slug, sessionData);
        setProfile((prev) => prev ? { ...prev, activeSession: sessionData } : null);
      }
    } else {
      // Fin de session
      if (profile && isValidationSession) {
        firebaseVerbsService.clearActiveSession(profile.slug);
        setProfile((prev) => prev ? { ...prev, activeSession: null } : null);
      }
      finishSession();
    }
  };

  const finishSession = async () => {
    setScreenMode('summary');
    if (isValidationSession) {
      const finalScore = validationScore;
      const isSuccess = finalScore >= CERT_PASS_SCORE;
      if (isSuccess && profile) {
        playChime('victory');
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
        addXPToDb(150);
        updateStreak();
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
        await firebaseVerbsService.recordBatchValidation(
          profile.slug,
          profile.displayName,
          selectedBatch + 1,
          CERT_PASS_SCORE
        );
        const updated = await firebaseVerbsService.loadPlayerProfile(profile.slug, profile.displayName);
        setProfile(updated);
      }
    }
  };

  // Filtrage du Codex
  const filteredVerbs = useMemo(() => {
    return MASTER_VERBS_DB.filter((v, i) => {
      if ((codexTier === 'master') !== (i < MASTER_TIER_VERBS)) return false;
      const matchesSearch =
        !searchQuery ||
        v.word.includes(normalizeStr(searchQuery)) ||
        v.details.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLength = lengthFilter === 'all' || v.length === lengthFilter;
      return matchesSearch && matchesLength;
    });
  }, [searchQuery, lengthFilter, codexTier]);

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
                {MASTER_TIER_VERBS.toLocaleString('fr-FR')} verbes ODS • {MASTER_TIER_BATCHES} lots Maître Club
                {HAS_ELITE_TIER ? ' • + Panthéon bonus' : ''} • Certification collective
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
              <div
                className={`relative w-6 h-6 sm:w-7 sm:h-7 rounded-full text-white flex items-center justify-center text-[10px] sm:text-xs font-bold shadow-sm notranslate shrink-0 ${
                  isPantheonBadge && profile
                    ? 'bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-amber-950 ring-2 ring-amber-300 ring-offset-1'
                    : 'bg-indigo-600'
                }`}
                translate="no"
              >
                {playerName ? playerName.slice(0, 1) : '?'}
                {isPantheonBadge && profile && (
                  <Crown className="absolute -top-2.5 -right-1.5 w-3.5 h-3.5 text-amber-500 fill-amber-400 drop-shadow" aria-hidden />
                )}
              </div>
              <div className="notranslate" translate="no">
                <div className="text-[11px] sm:text-xs font-extrabold text-slate-800 flex items-center gap-1 leading-tight">
                  <span className="max-w-[65px] sm:max-w-[120px] truncate">{playerName || 'Pseudo'}</span>
                  {isPantheonBadge && profile && (
                    <span
                      className="text-[9px] bg-gradient-to-r from-amber-300 to-amber-500 text-amber-950 font-black px-1 sm:px-1.5 py-0.2 rounded hidden sm:inline-flex items-center gap-0.5 shrink-0"
                      title="Maître des Verbes Faizers : 125 lots validés, membre du Panthéon ODS"
                    >
                      <Crown className="w-2.5 h-2.5" aria-hidden />
                      <span>Panthéon</span>
                    </span>
                  )}
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

            <div
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl flex items-center gap-1 text-[11px] sm:text-xs font-bold border ${
                inPantheon ? 'bg-slate-900 border-amber-400 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              {inPantheon ? (
                <Crown className="w-3.5 h-3.5 text-amber-300 fill-amber-300 shrink-0" />
              ) : (
                <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
              )}
              <span>
                Lot {selectedBatch + 1}
                <span className="hidden sm:inline"> / {inPantheon ? TOTAL_BATCHES : MASTER_TIER_BATCHES}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Barre d'onglets de navigation */}
        <div className="max-w-6xl mx-auto px-2 sm:px-4 grid grid-cols-4 sm:flex gap-1 sm:gap-2 border-t border-slate-100 pt-1.5 sm:pt-2">
          <button
            onClick={() => {
              setActiveTab('training');
              setScreenMode('selector');
            }}
            className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 sm:px-4 py-1.5 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-bold transition-all relative min-w-0 sm:shrink-0 ${
              activeTab === 'training'
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Entraînement & Lots</span>
            <span className="sm:hidden">Entraînement</span>
            <span className="hidden sm:inline text-xs text-slate-400 font-normal">#{selectedBatch + 1}</span>
            {activeTab === 'training' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('team')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 sm:px-4 py-1.5 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-bold transition-all relative min-w-0 sm:shrink-0 ${
              activeTab === 'team'
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <span className="relative">
              <Users className="w-4 h-4 shrink-0" />
              <span className="sm:hidden absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" aria-label="En direct" />
            </span>
            <span className="hidden sm:inline">Évolution des membres</span>
            <span className="sm:hidden">Membres</span>
            <span className="hidden sm:inline bg-emerald-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
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
            className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 sm:px-4 py-1.5 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-bold transition-all relative min-w-0 sm:shrink-0 ${
              activeTab === 'codex'
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>Codex</span>
            <span className="hidden sm:inline text-xs text-slate-400 font-normal">({MASTER_TIER_VERBS})</span>
            {activeTab === 'codex' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 sm:px-4 py-1.5 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-bold transition-all relative min-w-0 sm:shrink-0 ${
              activeTab === 'guide'
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Guide des marques</span>
            <span className="sm:hidden">Guide</span>
            {activeTab === 'guide' && (
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

      {/* Célébration : déblocage du Panthéon ODS (portal) */}
      <PantheonCelebration
        open={celebrationOpen}
        playerName={profile?.displayName || playerName}
        onEnter={enterPantheon}
        onClose={() => setCelebrationOpen(false)}
      />

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
                <div
                  className={`rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden ${
                    inPantheon
                      ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 ring-1 ring-amber-400/40'
                      : 'bg-gradient-to-r from-emerald-800 to-teal-900'
                  }`}
                >
                  <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {inPantheon ? (
                          <span className="bg-amber-400/15 text-amber-200 border border-amber-300/40 text-xs uppercase tracking-widest font-black px-3 py-1 rounded-full flex items-center gap-1.5">
                            <Crown className="w-3.5 h-3.5 text-amber-300 fill-amber-300 shrink-0" />
                            Panthéon · Lot n°{selectedBatch + 1}
                          </span>
                        ) : (
                          <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-xs uppercase tracking-widest font-black px-3 py-1 rounded-full">
                            Lot n°{selectedBatch + 1} sur {MASTER_TIER_BATCHES}
                          </span>
                        )}
                        {profile?.validatedBatches.includes(selectedBatch + 1) && (
                          <span className="bg-amber-400 text-amber-950 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                            <ShieldCheck className="w-3.5 h-3.5" /> Validé
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                        {inPantheon ? 'Lot bonus : 30 verbes rares' : 'Programme de 30 verbes ODS'}
                      </h2>
                      <p className={`${inPantheon ? 'text-amber-100/80' : 'text-emerald-100/80'} text-sm mt-1 max-w-xl`}>
                        {currentBatchWords[0]?.length} à {currentBatchWords[currentBatchWords.length - 1]?.length} lettres • Révisez le lot, consolidez vos réflexes d'anagramme, puis passez la Certification officielle du lot.
                      </p>
                    </div>

                    <div className="w-full sm:w-auto">
                      {profile?.activeSession && profile.activeSession.batchIndex === selectedBatch && profile.activeSession.currentIndex < 30 ? (
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          <button
                            onClick={handleResumeSession}
                            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 rounded-2xl font-black text-sm sm:text-base shadow-xl transition transform hover:-translate-y-0.5 border border-amber-200"
                          >
                            <Play className="w-5 h-5 text-amber-950 fill-amber-950 shrink-0" />
                            <span>Reprendre le Lot (Tirage {profile.activeSession.currentIndex + 1}/30)</span>
                          </button>
                          <div className="flex items-center justify-between px-1 text-xs text-amber-200">
                            <span>Score en cours : {profile.activeSession.validationScore} / {profile.activeSession.currentIndex}</span>
                            <button
                              onClick={handleRestartSession}
                              className="underline hover:text-white transition font-medium"
                            >
                              Recommencer le lot
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={handleStartValidation}
                          className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 rounded-2xl font-black text-sm sm:text-base shadow-xl transition transform hover:-translate-y-0.5 border border-amber-200"
                        >
                          <Award className="w-5 h-5 text-amber-950 shrink-0" />
                          <span>Lancer la Certification (30 mots)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sélecteur rapide de lots */}
                  <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className={`text-xs ${inPantheon ? 'text-amber-200' : 'text-emerald-200'}`}>Naviguer dans les lots :</span>
                    <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
                      <button
                        disabled={selectedBatch <= 0}
                        onClick={() => goToBatch(selectedBatch - 1)}
                        aria-label="Lot précédent"
                        className="shrink-0 px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg text-xs font-bold transition whitespace-nowrap"
                      >
                        ←<span className="hidden sm:inline"> Lot précédent</span>
                      </button>
                      <select
                        value={selectedBatch}
                        onChange={(e) => goToBatch(Number(e.target.value))}
                        className="flex-1 sm:flex-none min-w-0 bg-white/10 text-white border border-white/20 rounded-lg text-xs font-bold px-2 py-1.5 focus:outline-none"
                      >
                        <optgroup label={`Palier 1 · Maître Club (${MASTER_TIER_BATCHES} lots)`} className="text-slate-900">
                          {Array.from({ length: Math.min(TOTAL_BATCHES, MASTER_TIER_BATCHES) }).map((_, i) => (
                            <option key={i} value={i} className="text-slate-900 font-medium">
                              Lot n°{i + 1} {profile?.validatedBatches.includes(i + 1) ? '✓ (Validé)' : ''}
                            </option>
                          ))}
                        </optgroup>
                        {HAS_ELITE_TIER && (
                          <optgroup
                            label={`Palier 2 · Panthéon ODS ${isPantheonUnlocked ? '👑' : `🔒 (${masterValidatedCount}/${MASTER_TIER_BATCHES})`}`}
                            className="text-slate-900"
                          >
                            {Array.from({ length: ELITE_TIER_BATCHES }).map((_, k) => {
                              const i = MASTER_TIER_BATCHES + k;
                              return (
                                <option key={i} value={i} disabled={!isPantheonUnlocked} className="text-slate-900 font-medium">
                                  {isPantheonUnlocked ? '👑' : '🔒'} Lot n°{i + 1}{' '}
                                  {profile?.validatedBatches.includes(i + 1) ? '✓ (Validé)' : ''}
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                      </select>
                      {(() => {
                        const nextLocked = HAS_ELITE_TIER && isEliteBatch(selectedBatch + 1) && !isPantheonUnlocked;
                        return (
                          <button
                            disabled={selectedBatch >= TOTAL_BATCHES - 1}
                            onClick={() => goToBatch(selectedBatch + 1)}
                            aria-label={nextLocked ? 'Lot suivant verrouillé (Panthéon)' : 'Lot suivant'}
                            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap disabled:opacity-30 ${
                              nextLocked ? 'bg-amber-400/20 text-amber-200 hover:bg-amber-400/30' : 'bg-white/10 hover:bg-white/20'
                            }`}
                          >
                            <span className="hidden sm:inline">Lot suivant </span>
                            {nextLocked ? <Lock className="w-3.5 h-3.5 inline -mt-0.5" /> : '→'}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Entrée du Panthéon ODS (palier 2) */}
                <div>
                  <motion.button
                    type="button"
                    onClick={() => {
                      if (isPantheonUnlocked && HAS_ELITE_TIER) {
                        if (inPantheon) goToBatch(MASTER_TIER_BATCHES - 1);
                        else enterPantheon();
                      } else {
                        triggerPantheonHint();
                      }
                    }}
                    aria-disabled={!(isPantheonUnlocked && HAS_ELITE_TIER)}
                    aria-describedby="pantheon-hint"
                    whileTap={{ scale: 0.985 }}
                    className={`group w-full text-left rounded-3xl p-4 sm:p-5 relative overflow-hidden border transition ${
                      isPantheonUnlocked
                        ? 'bg-gradient-to-br from-amber-50 via-white to-amber-100 border-amber-300 shadow-[0_8px_30px_-12px_rgba(245,158,11,0.6)] hover:border-amber-400'
                        : 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-amber-400/30 shadow-lg cursor-not-allowed'
                    }`}
                  >
                    {!isPantheonUnlocked && (
                      <div
                        aria-hidden
                        className="absolute right-0 top-0 w-32 h-32 rounded-full bg-amber-400/15 blur-2xl pointer-events-none"
                      />
                    )}
                    <div className="relative flex items-center gap-3 sm:gap-4">
                      <motion.div
                        key={pantheonHint}
                        animate={pantheonHint ? { rotate: [0, -16, 16, -10, 10, -4, 0] } : { rotate: 0 }}
                        transition={{ duration: 0.55 }}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                          isPantheonUnlocked
                            ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-md'
                            : 'bg-amber-400/10 border border-amber-300/40 text-amber-300'
                        }`}
                      >
                        {isPantheonUnlocked ? (
                          <Crown className="w-6 h-6 sm:w-7 sm:h-7 fill-amber-950/20" />
                        ) : (
                          <Lock className="w-6 h-6 sm:w-7 sm:h-7" />
                        )}
                      </motion.div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span
                            className={`text-[10px] font-black uppercase tracking-widest ${
                              isPantheonUnlocked ? 'text-amber-700' : 'text-amber-300/90'
                            }`}
                          >
                            Palier 2 · Bonus
                          </span>
                          {!HAS_ELITE_TIER && (
                            <span className="text-[9px] font-black uppercase bg-amber-400 text-amber-950 px-1.5 rounded">Bientôt</span>
                          )}
                        </div>
                        <h3
                          className={`font-black text-lg sm:text-xl leading-tight tracking-tight ${
                            isPantheonUnlocked ? 'text-slate-900' : 'text-white'
                          }`}
                        >
                          Panthéon ODS
                        </h3>
                        <p className={`text-[11px] sm:text-xs leading-snug ${isPantheonUnlocked ? 'text-slate-600' : 'text-slate-400'}`}>
                          {HAS_ELITE_TIER
                            ? `${ELITE_TIER_BATCHES} lots bonus · ${ELITE_TIER_VERBS.toLocaleString('fr-FR')} verbes rares du dictionnaire`
                            : 'Les verbes rares du dictionnaire, réservés aux Maîtres Club'}
                        </p>
                      </div>
                      {isPantheonUnlocked && HAS_ELITE_TIER && (
                        <span className="shrink-0 text-xs font-black text-amber-800 bg-amber-200/70 group-hover:bg-amber-300 px-2.5 py-1.5 rounded-xl transition whitespace-nowrap">
                          {inPantheon ? '← Palier 1' : 'Entrer →'}
                        </span>
                      )}
                    </div>

                    {isPantheonUnlocked ? (
                      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] sm:text-xs">
                        <span className="font-bold text-amber-800 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Maître des Verbes Faizers
                        </span>
                        {HAS_ELITE_TIER && (
                          <span className="text-slate-500 font-semibold">
                            {eliteValidatedCount} / {ELITE_TIER_BATCHES} lots Panthéon
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="relative mt-3.5">
                        {HAS_ELITE_TIER && ELITE_TEASER_WORDS.length > 0 && (
                          <div aria-hidden className="flex flex-wrap gap-1.5 mb-3 overflow-hidden max-h-6">
                            {ELITE_TEASER_WORDS.map((w) => (
                              <span
                                key={w}
                                className="notranslate text-[10px] font-black tracking-wider text-amber-100/80 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md blur-[3px] select-none"
                                translate="no"
                              >
                                {w}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs mb-1.5">
                          <span className="font-bold text-amber-200">
                            {masterValidatedCount} / {MASTER_TIER_BATCHES} lots validés
                          </span>
                          <span className="text-slate-400 font-semibold">
                            {Math.max(0, MASTER_TIER_BATCHES - masterValidatedCount)} restant
                            {MASTER_TIER_BATCHES - masterValidatedCount > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-amber-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(2, masterProgressPct)}%` }}
                            transition={{ duration: 0.9, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    )}
                  </motion.button>

                  <AnimatePresence>
                    {pantheonHint > 0 && !isPantheonUnlocked && (
                      <motion.div
                        id="pantheon-hint"
                        role="status"
                        initial={{ opacity: 0, y: -6, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -6, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900 leading-relaxed">
                          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>
                            Le Panthéon s'ouvre quand tu as validé les <strong>{MASTER_TIER_BATCHES} lots</strong> du palier Maître
                            Club (≥ {CERT_PASS_SCORE}/30 à chaque Certification). Il t'en reste{' '}
                            <strong>{Math.max(0, MASTER_TIER_BATCHES - masterValidatedCount)}</strong>.
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Liste des 30 verbes du lot avec définitions */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-emerald-600" />
                      Composition du Lot n°{selectedBatch + 1} ({currentBatchWords.length} verbes)
                    </h3>
                    <span className="hidden sm:inline text-xs text-slate-400">Cliquez pour voir les détails ODS</span>
                  </div>

                  <VerbLegend className="mb-4" onOpenGuide={openGuide} />

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5">
                    {currentBatchWords.map((v) => (
                      <div
                        key={v.word}
                        className="p-2.5 sm:p-3 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-200 rounded-xl transition flex flex-col justify-start"
                      >
                        <div className="flex items-center justify-between mb-1">
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
                        <VerbInfo word={v.word} details={v.details} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Encadré Pédagogique : La Règle de Certification */}
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
                      La <strong>Certification du Lot</strong> exige <strong>au moins {CERT_PASS_SCORE} bonnes réponses sur 30</strong> ({CERT_PASS_PCT} %). Une fois franchie, le lot est gravé pour toujours dans la base de données du club, et votre contribution augmente la jauge collective de l'équipe !
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Mode Quiz (Échauffement ou Certification) */}
            {screenMode === 'quiz' && (
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Barre de progression & Header du tirage */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5" /> Certification Officielle du Lot
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
                      className="h-full bg-amber-500"
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

                  {/* Indicateur Multi-Solutions */}
                  {allSolutions.length > 1 && (
                    <div className="mb-5 max-w-md mx-auto">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black uppercase tracking-wider mb-2.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{allSolutions.length} verbes à trouver ({foundSolutions.length} / {allSolutions.length} trouvés)</span>
                      </div>
                      <div className="flex items-center justify-center flex-wrap gap-2">
                        {allSolutions.map((sol, idx) => {
                          const isFound = foundSolutions.includes(sol);
                          return (
                            <div
                              key={sol}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                                isFound
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm'
                                  : 'bg-slate-100 text-slate-400 border border-dashed border-slate-300'
                              }`}
                            >
                              {isFound ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span translate="no" className="notranslate">{sol}</span>
                                </>
                              ) : (
                                <span>Verbe #{idx + 1}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Formulaire de Saisie */}
                  {!showSolution ? (
                    <form onSubmit={handleSubmitAnswer} className="max-w-md mx-auto space-y-3 sm:space-y-4">
                      <div className="flex gap-1.5 sm:gap-2">
                        <input
                          ref={inputRef}
                          type="text"
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                          placeholder={allSolutions.length > 1 ? `Tapez les ${allSolutions.length} verbes...` : "Tapez l'infinitif..."}
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
                        {allSolutions.length > 1 
                          ? 'Entrez chaque solution puis validez avec la touche Entrée (+5s bonus par verbe trouvé)' 
                          : 'Appuyez sur Entrée pour valider directement'}
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
                              {allSolutions.length > 1 ? 'Toutes les solutions trouvées !' : 'Excellent réflexe !'}
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                            <span className="font-black text-red-800 text-base sm:text-lg">
                              Temps écoulé ou incomplet
                            </span>
                          </>
                        )}
                      </div>

                      {/* Liste de toutes les solutions avec leurs définitions */}
                      <div className="space-y-2 my-3">
                        {allSolutions.map((sol) => {
                          const info = WORD_MAP[sol] || { details: '' };
                          const wasFound = foundSolutions.includes(sol);
                          return (
                            <div
                              key={sol}
                              className={`p-2.5 sm:p-3 rounded-xl border text-left transition ${
                                wasFound
                                  ? 'bg-emerald-100/70 border-emerald-300'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  translate="no"
                                  className={`notranslate font-black text-lg sm:text-xl tracking-wider ${
                                    wasFound ? 'text-emerald-900' : 'text-slate-800'
                                  }`}
                                >
                                  {wasFound ? '✓ ' : '• '}{sol}
                                </span>
                                <span
                                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                    wasFound
                                      ? 'bg-emerald-200 text-emerald-900'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {wasFound ? 'Trouvé' : 'Non trouvé'}
                                </span>
                              </div>
                              <div className="mt-1.5">
                                <VerbInfo word={sol} details={info.details} clampDefinition={false} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

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
                          onClick={() => handleNextTurn()}
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
                    Quitter le lot (progression sauvegardée)
                  </button>
                </div>
              </div>
            )}

            {/* Mode Bilan / Résumé de Session */}
            {screenMode === 'summary' && (
              <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-6">
                {isValidationSession ? (
                  validationScore >= CERT_PASS_SCORE ? (
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
                        Score parfait : <strong className="text-slate-800">{validationScore} / 30</strong> (≥ {CERT_PASS_SCORE}/30).
                        Votre exploit est enregistré sur Firebase et partagé avec tous les membres du club !
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-10 h-10" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-800">
                        {validationScore >= TIE_BREAK_MIN_SCORE ? 'Tout près du but !' : 'Presque là !'} Score : {validationScore} / 30
                      </h2>
                      <p className="text-slate-600 text-sm mt-2">
                        La Certification du Lot requiert au moins <strong>{CERT_PASS_SCORE} / 30</strong>.
                      </p>

                      {/* Carte Spéciale Tie-Break de Sauvetage */}
                      {validationScore >= TIE_BREAK_MIN_SCORE && validationScore < CERT_PASS_SCORE && (
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
                      Échauffement Terminé !
                    </h2>
                    <p className="text-slate-600 text-sm mt-2">
                      Vous avez parcouru les 30 tirages d'échauffement. Vous êtes prêt pour la Certification Officielle du Lot !
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
                  {(isValidationSession && validationScore < CERT_PASS_SCORE) || (isTieBreakSession && validationScore < Math.min(3, sessionWords.length)) ? (
                    <button
                      onClick={handleStartValidation}
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm shadow transition"
                    >
                      <RotateCcw className="w-4 h-4 inline mr-1.5" />
                      Retenter la Certification du Lot
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        goToBatch(selectedBatch + 1);
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
                      {clubTotalConqueredVerbs} <span className="text-slate-400 text-lg sm:text-xl font-normal">/ {MASTER_TIER_VERBS}</span>
                    </h2>
                    <p className="text-slate-300 text-xs sm:text-sm mt-1">
                      Verbes uniques du programme Maître Club conquis par au moins un joueur du club.
                    </p>
                    {clubEliteConqueredVerbs > 0 && (
                      <p className="text-amber-300 text-[11px] sm:text-xs mt-1 font-bold flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5 shrink-0" /> + {clubEliteConqueredVerbs} verbes bonus du Panthéon
                      </p>
                    )}
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xl sm:text-2xl font-black text-emerald-400">
                      {((clubTotalConqueredVerbs / MASTER_TIER_VERBS) * 100).toFixed(1)}%
                    </span>
                    <span className="text-[11px] sm:text-xs text-slate-400 block">du programme Maître Club conquis</span>
                  </div>
                </div>

                {/* Barre collective */}
                <div className="w-full bg-slate-800 rounded-full h-3.5 sm:h-4 overflow-hidden border border-slate-700 p-0.5">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(2, Math.min(100, (clubTotalConqueredVerbs / MASTER_TIER_VERBS) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Cette semaine au club (calculé depuis le fil d'activité) */}
            <WeeklyClubPanel
              events={clubActivities}
              membersCount={leaderboard.length}
              myName={profile?.displayName}
              onStartTraining={() => {
                setActiveTab('training');
                setScreenMode('selector');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />

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
                              {isPantheonMember(player.validatedBatches) && (
                                <Crown
                                  className="inline w-3.5 h-3.5 ml-1 -mt-0.5 text-amber-500 fill-amber-400"
                                  aria-label="Maître des Verbes (Panthéon)"
                                />
                              )}
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
                              {countVerbsInBatches(player.validatedBatches)}
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
                      clubActivities.slice(0, 20).map((act, i) => (
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
                              {formatActivityTime(act.timestamp)}
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
        {/* ONGLET 4 : GUIDE DES MARQUES                                 */}
        {/* ============================================================ */}
        {activeTab === 'guide' && <VerbGuidePanel onOpenVerb={openVerbInCodex} />}

        {/* ============================================================ */}
        {/* ONGLET 3 : CODEX (palier Maître Club + Panthéon bonus)      */}
        {/* ============================================================ */}
        {activeTab === 'codex' && (
          <div className="space-y-6">
            {/* Choix du palier */}
            {HAS_ELITE_TIER && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <button
                  onClick={() => setCodexTier('master')}
                  className={`min-w-0 px-2 sm:px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                    codexTier === 'master' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span className="truncate">Maître Club</span>
                  <span className={`text-[10px] font-semibold ${codexTier === 'master' ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {MASTER_TIER_VERBS.toLocaleString('fr-FR')}
                  </span>
                </button>
                <button
                  onClick={() => setCodexTier('elite')}
                  className={`min-w-0 px-2 sm:px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                    codexTier === 'elite' ? 'bg-slate-900 text-amber-200 shadow' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Crown className={`w-4 h-4 shrink-0 ${codexTier === 'elite' ? 'fill-amber-300 text-amber-300' : 'text-amber-500'}`} />
                  <span className="truncate">Panthéon</span>
                  <span className={`text-[10px] font-semibold ${codexTier === 'elite' ? 'text-amber-300/80' : 'text-slate-400'}`}>
                    +{ELITE_TIER_VERBS.toLocaleString('fr-FR')}
                  </span>
                </button>
              </div>
            )}

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
                  Tous ({codexTier === 'master' ? MASTER_TIER_VERBS : ELITE_TIER_VERBS})
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

            <VerbLegend onOpenGuide={openGuide} />

            {/* Grille des Verbes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {filteredVerbs.slice(0, 120).map((v) => (
                <div
                  key={v.word}
                  className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition flex flex-col"
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
                  <div className="mt-1.5">
                    <VerbInfo word={v.word} details={v.details} />
                  </div>
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
