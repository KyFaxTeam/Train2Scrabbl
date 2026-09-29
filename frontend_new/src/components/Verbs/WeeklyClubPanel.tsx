import React, { useEffect, useState } from 'react';
import { CalendarDays, Sparkles, Users, UserRound, ArrowRight, PartyPopper } from 'lucide-react';
import { MASTER_TIER_BATCHES, TOTAL_BATCHES, getBatchWords } from '../../data/masterVerbsDb';
import type { ClubActivityEvent } from '../../services/firebaseVerbsService';

/** Objectif hebdomadaire du club, en lots validés (semaine de lancement : 128 lots à 11 joueurs). */
const WEEKLY_LOT_GOAL = 75;

const DAY_MS = 24 * 60 * 60 * 1000;
const PODIUM_SIZE = 5;

/** Lundi 00:00 (heure locale) de la semaine contenant `now`, en ms. */
function startOfWeek(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

const MASTER_WORDS = new Set(
  Array.from({ length: MASTER_TIER_BATCHES }).flatMap((_, i) => getBatchWords(i).map((v) => v.word))
);

function batchMasterWords(batchNumber: number): string[] {
  if (batchNumber < 1 || batchNumber > TOTAL_BATCHES) return [];
  return getBatchWords(batchNumber - 1)
    .map((v) => v.word)
    .filter((w) => MASTER_WORDS.has(w));
}

interface WeeklyStats {
  lots: number;
  verbsGained: number;
  ranking: { player: string; lots: number }[];
}

/**
 * Statistiques de la semaine, dérivées du fil d'activité : rien à remettre à zéro,
 * la semaine se recalcule toute seule à partir de la date des validations.
 * Un même lot revalidé par un même joueur ne compte qu'une fois.
 */
function computeWeeklyStats(events: ClubActivityEvent[], weekStart: number): WeeklyStats {
  const lotsByPlayer = new Map<string, Set<number>>();
  const verbsBefore = new Set<string>();
  const verbsThisWeek = new Set<string>();

  for (const e of events) {
    if (e.type !== 'BATCH_VALIDATED' || !e.player || !e.timestamp) continue;
    const words = batchMasterWords(e.batchNumber);
    if (e.timestamp < weekStart) {
      words.forEach((w) => verbsBefore.add(w));
      continue;
    }
    const key = e.player.toUpperCase();
    if (!lotsByPlayer.has(key)) lotsByPlayer.set(key, new Set());
    lotsByPlayer.get(key)!.add(e.batchNumber);
    words.forEach((w) => verbsThisWeek.add(w));
  }

  let verbsGained = 0;
  verbsThisWeek.forEach((w) => {
    if (!verbsBefore.has(w)) verbsGained++;
  });

  const ranking = Array.from(lotsByPlayer, ([player, set]) => ({ player, lots: set.size })).sort(
    (a, b) => b.lots - a.lots || a.player.localeCompare(b.player)
  );

  return { lots: ranking.reduce((sum, r) => sum + r.lots, 0), verbsGained, ranking };
}

const fmtDay = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

export const WeeklyClubPanel: React.FC<{
  events: ClubActivityEvent[];
  membersCount: number;
  myName?: string;
  onStartTraining: () => void;
}> = ({ events, membersCount, myName, onStartTraining }) => {
  // Horloge à la minute : la semaine bascule d'elle-même le lundi à minuit
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const weekStartMs = startOfWeek(now);
  const weekStart = new Date(weekStartMs);
  const weekEnd = new Date(weekStartMs + 6 * DAY_MS);
  const daysLeft = Math.ceil((weekStartMs + 7 * DAY_MS - now) / DAY_MS);

  const stats = computeWeeklyStats(events, weekStartMs);

  const me = myName?.toUpperCase();
  const myIndex = me ? stats.ranking.findIndex((r) => r.player === me) : -1;
  const myLots = myIndex >= 0 ? stats.ranking[myIndex].lots : 0;
  const activeMembers = stats.ranking.length;
  const goalReached = stats.lots >= WEEKLY_LOT_GOAL;
  const pct = Math.min(100, (stats.lots / WEEKLY_LOT_GOAL) * 100);
  const maxLots = stats.ranking[0]?.lots || 1;

  const podium = stats.ranking.slice(0, PODIUM_SIZE).map((r, i) => ({ ...r, rank: i + 1 }));
  if (myIndex >= PODIUM_SIZE) podium.push({ ...stats.ranking[myIndex], rank: myIndex + 1 });

  return (
    <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-7 sm:pt-6">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight">Cette semaine au club</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Du {fmtDay(weekStart)} au {fmtDay(weekEnd)}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
            daysLeft <= 1 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {daysLeft <= 1 ? 'Dernier jour' : `Encore ${daysLeft} j`}
        </span>
      </div>

      {/* Objectif de la semaine */}
      <div className="px-4 sm:px-7 mt-4 sm:mt-5">
        <div className="flex items-end justify-between gap-3">
          <p className="text-slate-900">
            <span className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight">{stats.lots}</span>
            <span className="text-sm sm:text-base font-semibold text-slate-400"> / {WEEKLY_LOT_GOAL} lots</span>
          </p>
          <span
            className={`text-sm sm:text-base font-black tabular-nums pb-1 ${goalReached ? 'text-emerald-600' : 'text-indigo-600'}`}
          >
            {Math.floor((stats.lots / WEEKLY_LOT_GOAL) * 100)}%
          </span>
        </div>
        <div
          className="mt-2 h-3 sm:h-3.5 w-full rounded-full bg-slate-100 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={WEEKLY_LOT_GOAL}
          aria-valuenow={stats.lots}
          aria-label="Lots validés par le club cette semaine"
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              goalReached ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-indigo-500 to-violet-500'
            }`}
            style={{ width: `${stats.lots > 0 ? Math.max(3, pct) : 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-snug flex items-center gap-1.5">
          {goalReached ? (
            <>
              <PartyPopper className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong className="text-emerald-700">Objectif atteint !</strong>
                {stats.lots > WEEKLY_LOT_GOAL && ` ${plural(stats.lots - WEEKLY_LOT_GOAL, 'lot')} au-delà, bravo le club.`}
              </span>
            </>
          ) : (
            <span>
              Encore <strong className="text-slate-900">{plural(WEEKLY_LOT_GOAL - stats.lots, 'lot')}</strong> pour
              atteindre l'objectif du club.
            </span>
          )}
        </p>
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 px-4 sm:px-7 mt-4 sm:mt-5">
        <div className="rounded-xl sm:rounded-2xl bg-emerald-50 px-2 py-2.5 sm:p-3.5 text-center">
          <Sparkles className="w-4 h-4 text-emerald-600 mx-auto" />
          <p className="text-lg sm:text-2xl font-black text-emerald-700 tabular-nums mt-1 leading-none">
            +{stats.verbsGained}
          </p>
          <p className="text-[10px] sm:text-xs text-emerald-800/80 font-semibold mt-1 leading-tight">
            verbes gagnés pour la jauge
          </p>
        </div>
        <div className="rounded-xl sm:rounded-2xl bg-slate-50 px-2 py-2.5 sm:p-3.5 text-center">
          <Users className="w-4 h-4 text-slate-500 mx-auto" />
          <p className="text-lg sm:text-2xl font-black text-slate-800 tabular-nums mt-1 leading-none">
            {activeMembers}
            {membersCount > 0 && (
              <span className="text-xs sm:text-sm font-semibold text-slate-400">/{membersCount}</span>
            )}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 font-semibold mt-1 leading-tight">membres actifs</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl bg-indigo-50 px-2 py-2.5 sm:p-3.5 text-center">
          <UserRound className="w-4 h-4 text-indigo-600 mx-auto" />
          <p className="text-lg sm:text-2xl font-black text-indigo-700 tabular-nums mt-1 leading-none">
            {me ? myLots : '–'}
          </p>
          <p className="text-[10px] sm:text-xs text-indigo-800/80 font-semibold mt-1 leading-tight">
            {myLots > 1 ? 'lots validés par toi' : 'lot validé par toi'}
          </p>
        </div>
      </div>

      {/* Les plus actifs */}
      <div className="px-4 sm:px-7 mt-5 pb-4 sm:pb-6">
        {podium.length === 0 ? (
          <div className="rounded-xl sm:rounded-2xl border border-dashed border-slate-300 p-4 text-center">
            <p className="text-sm font-bold text-slate-800">La semaine démarre.</p>
            <p className="text-xs text-slate-500 mt-1">Personne n'a encore validé de lot. Ouvre le score !</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Les plus actifs de la semaine
            </p>
            <ol className="space-y-1.5">
              {podium.map((r) => {
                const isMe = r.player === me;
                return (
                  <li
                    key={r.player}
                    className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${
                      isMe ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-slate-50'
                    } ${r.rank > PODIUM_SIZE ? 'mt-3' : ''}`}
                  >
                    <span className="w-6 text-center text-sm font-black text-slate-500 shrink-0">
                      {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-800 truncate notranslate" translate="no">
                          {r.player}
                          {isMe && <span className="ml-1.5 text-[10px] font-bold text-emerald-700">(toi)</span>}
                        </span>
                        <span className="text-xs sm:text-sm font-black text-slate-700 tabular-nums shrink-0">
                          {plural(r.lots, 'lot')}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isMe ? 'bg-emerald-500' : 'bg-indigo-400'}`}
                          style={{ width: `${(r.lots / maxLots) * 100}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {me && myLots === 0 && (
          <button
            onClick={onStartTraining}
            className="mt-3 w-full flex items-center justify-between gap-3 rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white px-4 py-3 text-left transition"
          >
            <span className="text-xs sm:text-sm leading-snug">
              <strong className="block">Tu n'as encore rien validé cette semaine</strong>
              <span className="text-slate-300">Chaque lot fait avancer l'objectif du club.</span>
            </span>
            <ArrowRight className="w-5 h-5 shrink-0" />
          </button>
        )}

        <p className="mt-3 text-[10px] sm:text-[11px] text-slate-400 leading-snug">
          Remise à zéro chaque lundi à minuit. Un lot revalidé par le même joueur ne compte qu'une fois.
        </p>
      </div>
    </section>
  );
};
