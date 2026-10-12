import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Timer, ShieldCheck, RotateCcw, UserCheck, ChevronRight, Loader2 } from 'lucide-react';
import {
  formatCountdown,
  formatFcfa,
  CHALLENGE_START_MS,
  CHALLENGE_LOTS,
  CHALLENGE_FIRST_PRIZE,
  CHALLENGE_FOLLOWER_PRIZE,
  CHALLENGE_FOLLOWER_PLACES,
  type ChallengeRankRow,
} from '../../services/challengeService';
import { useServerNow, START_LABEL, challengeDay } from './useChallenge';

const pad2 = (n: number) => String(n).padStart(2, '0');
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);

export const InlineCountdown: React.FC<{ target: number }> = ({ target }) => {
  const now = useServerNow();
  return <span className="tabular-nums">{formatCountdown(target - now)}</span>;
};

export const CountdownBlocks: React.FC<{ target: number }> = ({ target }) => {
  const now = useServerNow();
  const s = Math.max(0, Math.floor((target - now) / 1000));
  const parts: [number, string][] = [
    [Math.floor(s / 86400), 'jours'],
    [Math.floor((s % 86400) / 3600), 'heures'],
    [Math.floor((s % 3600) / 60), 'min'],
    [s % 60, 'sec'],
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-2" role="timer">
      {parts.map(([v, label]) => (
        <div key={label} className="rounded-xl bg-white/5 border border-amber-300/25 py-2">
          <div className="text-xl sm:text-2xl font-black text-amber-100 tabular-nums leading-none">{pad2(v)}</div>
          <div className="text-[9px] uppercase tracking-widest text-slate-400 mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
};

// ------------------------------------------------------------
// Briques d'affichage
// ------------------------------------------------------------

export const ChallengeRules: React.FC<{ className?: string }> = ({ className = '' }) => (
  <ul className={`space-y-2 text-left text-xs sm:text-[13px] text-slate-300 leading-snug ${className}`}>
    <li className="flex gap-2.5">
      <RotateCcw className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
      <span>
        Tout le monde repart du <strong className="text-white">lot 1</strong>, dans l'ordre. Ton compte actuel est gardé tel quel.
      </span>
    </li>
    <li className="flex gap-2.5">
      <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
      <span>
        Un lot ne compte qu'à <strong className="text-white">30/30</strong>. <strong className="text-white">Pas de Tie-Break</strong> : à 28 ou 29,
        on rejoue le lot entier.
      </span>
    </li>
    <li className="flex gap-2.5">
      <UserCheck className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
      <span>
        <strong className="text-white">Un seul pseudo par personne.</strong> Les gains sont remis après vérification par le club.
      </span>
    </li>
  </ul>
);

export const PrizeCards: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
    <div className="rounded-2xl bg-gradient-to-br from-amber-300/20 via-amber-400/10 to-transparent border border-amber-300/50 px-3 py-2.5 sm:py-3 text-center">
      <div className={`${compact ? 'text-xl sm:text-2xl' : 'text-4xl sm:text-5xl'} font-black leading-none bg-gradient-to-r from-amber-200 via-yellow-50 to-amber-300 bg-clip-text text-transparent`}>
        {CHALLENGE_FIRST_PRIZE.toLocaleString('fr-FR')} FCFA
      </div>
      <div className="text-[11px] sm:text-xs text-amber-100/90 font-semibold mt-1">au 1er qui valide les {CHALLENGE_LOTS} lots</div>
    </div>
    <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5 text-center">
      <div className={`${compact ? 'text-xl sm:text-2xl' : 'text-xl sm:text-2xl'} font-black text-white leading-none`}>
        {compact ? '' : '+ '}
        {CHALLENGE_FOLLOWER_PRIZE.toLocaleString('fr-FR')} FCFA
        <span className="text-xs font-bold text-slate-400"> × {CHALLENGE_FOLLOWER_PLACES}</span>
      </div>
      <div className="text-[11px] sm:text-xs text-slate-300 mt-1">du 2e au 5e, s'ils finissent dans les 3 jours après le 1er</div>
    </div>
  </div>
);

/** Une ligne qui dit où en est la course : avant le départ, pendant, après l'arrivée du 1er. */
const PhaseLine: React.FC<{ winner: ChallengeRankRow | null; followerDeadline: number | null; rows: ChallengeRankRow[] }> = ({
  winner,
  followerDeadline,
  rows,
}) => {
  const now = useServerNow();
  if (now < CHALLENGE_START_MS) {
    return (
      <span>
        Départ {START_LABEL} · dans <strong className="text-amber-200 tabular-nums">{formatCountdown(CHALLENGE_START_MS - now)}</strong>
      </span>
    );
  }
  if (!winner || followerDeadline === null) {
    return (
      <span>
        <strong className="text-amber-200">Jour {challengeDay(now)}</strong> · personne n'a encore fini les {CHALLENGE_LOTS} lots
      </span>
    );
  }
  const paidFollowers = rows.filter((r) => r.prize === CHALLENGE_FOLLOWER_PRIZE).length;
  const placesLeft = Math.max(0, CHALLENGE_FOLLOWER_PLACES - paidFollowers);
  if (now < followerDeadline && placesLeft > 0) {
    return (
      <span>
        <strong translate="no" className="notranslate text-white">{winner.displayName}</strong> a gagné les{' '}
        {formatFcfa(CHALLENGE_FIRST_PRIZE)} · {plural(placesLeft, 'place')} à {formatFcfa(CHALLENGE_FOLLOWER_PRIZE)} encore{' '}
        {placesLeft > 1 ? 'ouvertes' : 'ouverte'}, plus que{' '}
        <strong className="text-amber-200 tabular-nums">{formatCountdown(followerDeadline - now)}</strong>
      </span>
    );
  }
  return (
    <span>
      Challenge terminé · bravo à <strong translate="no" className="notranslate text-white">{winner.displayName}</strong> et aux finisseurs !
    </span>
  );
};

// ------------------------------------------------------------
// Classement (onglet Membres)
// ------------------------------------------------------------

export const ChallengeBoard: React.FC<{
  rows: ChallengeRankRow[];
  winner: ChallengeRankRow | null;
  followerDeadline: number | null;
  mySlug?: string;
  onJoin?: () => void;
}> = ({ rows, winner, followerDeadline, mySlug, onJoin }) => {
  const isMember = !!mySlug && rows.some((r) => r.slug === mySlug);
  return (
    <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 rounded-2xl sm:rounded-3xl p-4 sm:p-7 text-white shadow-xl ring-1 ring-amber-400/30 relative overflow-hidden">
      <div aria-hidden className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 shrink-0" />
              <span className="text-amber-300 text-[10px] sm:text-xs font-black tracking-widest uppercase">Challenge 125 · en direct</span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-snug">
              <PhaseLine winner={winner} followerDeadline={followerDeadline} rows={rows} />
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-bold text-slate-400">{plural(rows.length, 'inscrit')}</span>
        </div>

        <PrizeCards compact />

        <ol className="mt-4 space-y-1.5">
          {rows.length === 0 && (
            <li className="text-center text-xs text-slate-400 py-6">Personne n'est encore inscrit. Sois le premier !</li>
          )}
          {rows.map((r) => {
            const me = r.slug === mySlug;
            const pct = Math.min(100, (r.lots / CHALLENGE_LOTS) * 100);
            return (
              <li
                key={r.slug}
                className={`flex items-center gap-2.5 sm:gap-3 rounded-xl px-2.5 sm:px-3 py-2 ${
                  me ? 'bg-amber-300/15 ring-1 ring-amber-300/50' : 'bg-white/[0.04]'
                }`}
              >
                <span className="w-7 text-center font-black text-sm shrink-0 text-slate-300">
                  {r.finishRank === 1 ? '🏆' : r.finishRank ? `${r.finishRank}` : r.lots > 0 ? `${r.rank}` : '–'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span translate="no" className="notranslate font-bold text-sm truncate">
                      {r.displayName}
                    </span>
                    {me && <span className="text-[9px] bg-amber-300 text-amber-950 px-1.5 rounded-full font-black shrink-0">Moi</span>}
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${r.finishedAt ? 'bg-gradient-to-r from-amber-300 to-yellow-100' : 'bg-gradient-to-r from-emerald-400 to-amber-300'}`}
                      style={{ width: `${Math.max(r.lots > 0 ? 3 : 0, pct)}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {r.finishedAt ? (
                    <span
                      className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                        r.prize ? 'bg-gradient-to-r from-amber-300 to-yellow-200 text-amber-950' : 'bg-white/10 text-slate-200'
                      }`}
                    >
                      {r.prize ? formatFcfa(r.prize) : 'Fini'}
                    </span>
                  ) : (
                    <span className="text-xs font-black text-amber-100 tabular-nums">
                      {r.lots}
                      <span className="text-slate-500 font-semibold">/{CHALLENGE_LOTS}</span>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {!isMember && onJoin && !winner && (
          <button
            onClick={onJoin}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm text-amber-950 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 hover:from-amber-400 hover:to-amber-500 transition"
          >
            <Trophy className="w-4 h-4" /> Je relève le défi
          </button>
        )}
        <p className="mt-3 text-[10px] text-slate-500 leading-snug">
          À égalité de lots, le premier arrivé à ce nombre passe devant. Un lot compte seulement à 30/30.
        </p>
      </div>
    </section>
  );
};

// ------------------------------------------------------------
// Carte du participant (onglet Lots)
// ------------------------------------------------------------

export const ChallengeStatusCard: React.FC<{
  me: ChallengeRankRow;
  rows: ChallengeRankRow[];
  winner: ChallengeRankRow | null;
  followerDeadline: number | null;
  started: boolean;
  onShowBoard: () => void;
}> = ({ me, rows, winner, followerDeadline, started, onShowBoard }) => {
  const ahead = me.rank > 1 ? rows[me.rank - 2] : undefined;
  const behind = rows[me.rank];
  const pct = Math.min(100, (me.lots / CHALLENGE_LOTS) * 100);

  let gap: React.ReactNode = null;
  if (me.finishedAt) {
    gap = (
      <>
        Tu as fini le challenge : arrivée n°{me.finishRank}
        {me.prize ? <> · <strong className="text-amber-200">{formatFcfa(me.prize)}</strong></> : null} !
      </>
    );
  } else if (!started) {
    gap = <>En attendant le départ, révise le lot 1 ci-dessous : sa composition est déjà visible.</>;
  } else if (me.rank === 1) {
    gap =
      behind && behind.lots < me.lots ? (
        <>
          Tu mènes la course : {plural(me.lots - behind.lots, 'lot')} d'avance sur{' '}
          <strong translate="no" className="notranslate text-white">{behind.displayName}</strong>.
        </>
      ) : (
        <>Tu es en tête. Ne lâche rien !</>
      );
  } else if (ahead) {
    gap =
      ahead.lots === me.lots ? (
        <>
          À égalité avec <strong translate="no" className="notranslate text-white">{ahead.displayName}</strong> : ton prochain lot te fait
          passer devant.
        </>
      ) : (
        <>
          À {plural(ahead.lots - me.lots, 'lot')} de <strong translate="no" className="notranslate text-white">{ahead.displayName}</strong> (
          {ordinal(ahead.rank)}).
        </>
      );
  }

  return (
    <section className="rounded-3xl p-4 sm:p-6 text-white shadow-xl relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 ring-1 ring-amber-400/40">
      <div aria-hidden className="absolute -right-10 -top-12 w-48 h-48 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-200 to-amber-500 text-amber-950 flex items-center justify-center shrink-0 shadow">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Challenge 125</div>
              <div className="text-sm sm:text-base font-black leading-tight">
                {me.finishedAt ? 'Challenge terminé' : `Lot ${Math.min(CHALLENGE_LOTS, me.lots + 1)} sur ${CHALLENGE_LOTS}`}
              </div>
            </div>
          </div>
          {started ? (
            <div className="text-right shrink-0">
              <div className="text-2xl font-black text-amber-200 leading-none">{ordinal(me.finishRank ?? me.rank)}</div>
              <div className="text-[10px] text-slate-400">sur {rows.length}</div>
            </div>
          ) : (
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Départ dans</div>
              <div className="text-sm font-black text-amber-200">
                <InlineCountdown target={CHALLENGE_START_MS} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1">
          <span>{plural(me.lots, 'lot')} validé{me.lots > 1 ? 's' : ''}</span>
          <span className="text-slate-400">{CHALLENGE_LOTS - me.lots} restant{CHALLENGE_LOTS - me.lots > 1 ? 's' : ''}</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-yellow-100"
            initial={false}
            animate={{ width: `${Math.max(2, pct)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {gap && <p className="mt-3 text-xs sm:text-sm text-slate-200 leading-snug">{gap}</p>}
        {winner && !me.finishedAt && (
          <p className="mt-2 text-[11px] sm:text-xs text-amber-100/90 leading-snug flex items-start gap-1.5">
            <Timer className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-300" />
            <PhaseLine winner={winner} followerDeadline={followerDeadline} rows={rows} />
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400">30/30 obligatoire · pas de Tie-Break</span>
          <button
            onClick={onShowBoard}
            className="text-[11px] sm:text-xs font-black text-amber-200 hover:text-white flex items-center gap-0.5 transition"
          >
            Classement <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};

// ------------------------------------------------------------
// Bandeau d'invitation (page Verbes, non-inscrits)
// ------------------------------------------------------------

export const ChallengeJoinBanner: React.FC<{ count: number; started: boolean; onJoin: () => void }> = ({ count, started, onJoin }) => (
  <section className="rounded-3xl p-4 sm:p-5 text-white bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 ring-1 ring-amber-400/40 shadow-xl flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-200 to-amber-500 text-amber-950 flex items-center justify-center shrink-0 shadow">
        <Trophy className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Challenge 125</div>
        <div className="font-black text-sm sm:text-base leading-tight">
          {CHALLENGE_FIRST_PRIZE.toLocaleString('fr-FR')} FCFA au 1er qui valide les {CHALLENGE_LOTS} lots
        </div>
        <div className="text-[11px] text-slate-300 mt-0.5">
          {started ? (
            <>C'est parti · {plural(count, 'joueur')} en course</>
          ) : (
            <>
              Départ dans <strong className="text-amber-200"><InlineCountdown target={CHALLENGE_START_MS} /></strong> ·{' '}
              {plural(count, 'inscrit')}
            </>
          )}
        </div>
      </div>
    </div>
    <button
      onClick={onJoin}
      className="w-full sm:w-auto shrink-0 px-5 py-3 rounded-2xl font-black text-sm text-amber-950 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 hover:from-amber-400 hover:to-amber-500 shadow-lg transition"
    >
      Je relève le défi
    </button>
  </section>
);

// ------------------------------------------------------------
// Confirmation d'inscription
// ------------------------------------------------------------

export const ChallengeJoinModal: React.FC<{
  open: boolean;
  playerName: string;
  mainLots: number;
  alreadyMember: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onChangePlayer: () => void;
  onClose: () => void;
}> = ({ open, playerName, mainLots, alreadyMember, busy, error, onConfirm, onChangePlayer, onClose }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="challenge-join"
          role="dialog"
          aria-modal="true"
          aria-label="Inscription au Challenge 125"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/85 backdrop-blur-sm"
        >
          <div className="min-h-full flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-5 sm:p-6 text-white bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 ring-1 ring-amber-400/40 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-200 to-amber-500 text-amber-950 flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Challenge 125</div>
                  <h3 className="font-black text-lg leading-tight">
                    {alreadyMember ? 'Tu es inscrit !' : 'Inscription'}
                  </h3>
                </div>
              </div>

              {alreadyMember ? (
                <p className="text-sm text-slate-300 leading-relaxed">
                  <strong translate="no" className="notranslate text-white">{playerName}</strong> est déjà dans la course. Tes lots du challenge
                  t'attendent.
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Inscrire <strong translate="no" className="notranslate text-white">{playerName}</strong> au challenge ?
                    {mainLots > 0 && (
                      <>
                        {' '}
                        Tes {plural(mainLots, 'lot')} actuels restent sur ton compte : le challenge repart du lot 1, et chaque lot que tu y valides
                        s'ajoute aussi à ton compte.
                      </>
                    )}
                  </p>
                  <ChallengeRules className="mt-4" />
                </>
              )}

              {error && <p className="mt-3 text-xs font-bold text-rose-300">{error}</p>}

              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={alreadyMember ? onClose : onConfirm}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm text-amber-950 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 transition"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                  {alreadyMember ? 'Voir mes lots du challenge' : busy ? 'Inscription…' : "Je m'inscris"}
                </button>
                {!alreadyMember && (
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1 pt-1">
                    <button onClick={onChangePlayer} className="hover:text-white transition">
                      Ce n'est pas moi
                    </button>
                    <button onClick={onClose} className="hover:text-white transition">
                      Plus tard
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
