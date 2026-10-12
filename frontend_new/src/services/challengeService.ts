import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  set,
  runTransaction,
  type Database,
  type Unsubscribe,
} from 'firebase/database';
import { FIREBASE_CONFIG, type ActiveSessionData } from './firebaseVerbsService';

// ============================================================
// Challenge 125 : le premier qui valide les 125 lots gagne 5 000 FCFA,
// les 4 suivants 1 000 FCFA s'ils finissent dans les 3 jours après lui.
// Tout le monde repart du lot 1 sur un parcours à part ; le compte habituel
// n'est pas touché (les lots validés pendant le challenge s'y ajoutent).
// ============================================================

/** Départ : lundi 12 octobre 2026, 20 h, heure du club (UTC+1). */
export const CHALLENGE_START_MS = Date.parse('2026-10-12T20:00:00+01:00');
export const CHALLENGE_LOTS = 125;
export const CHALLENGE_FIRST_PRIZE = 5000;
export const CHALLENGE_FOLLOWER_PRIZE = 1000;
/** Places payées après le premier (2e à 5e). */
export const CHALLENGE_FOLLOWER_PLACES = 4;
/** Délai laissé aux 2e-5e, compté depuis l'arrivée du premier. */
export const CHALLENGE_FOLLOWER_WINDOW_MS = 3 * 24 * 3600 * 1000;

const ROOT = 'verb_mastery/challenge125/participants';
/**
 * Parties en cours, à part : elles changent à chaque mot. Rangées avec les participants,
 * chaque téléphone recevrait en direct les parties de tous les autres (forfait et rendus inutiles).
 */
const SESSIONS = 'verb_mastery/challenge125/sessions';

export interface ChallengeParticipant {
  slug: string;
  displayName: string;
  joinedAt: number;
  /** Lots du challenge validés (numéros 1 à 125). */
  validatedBatches: number[];
  /** Index (0-based) du lot à jouer. */
  currentBatch: number;
  /** Heure (serveur) de la dernière validation : départage deux joueurs au même nombre de lots. */
  lastValidatedAt: number;
  /** Heure (serveur) de la validation du 125e lot. */
  finishedAt?: number;
}

export interface ChallengeRankRow extends ChallengeParticipant {
  lots: number;
  rank: number;
  /** Rang d'arrivée parmi ceux qui ont fini (1 = gagnant). */
  finishRank?: number;
  /** Gain en FCFA, si la place est payée. */
  prize?: number;
}

export function formatFcfa(n: number): string {
  return `${n.toLocaleString('fr-FR')} F`;
}

export function countChallengeLots(validated?: number[] | null): number {
  if (!Array.isArray(validated)) return 0;
  return new Set(validated.filter((b) => b >= 1 && b <= CHALLENGE_LOTS)).size;
}

function normalize(raw: unknown, slug: string): ChallengeParticipant {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<ChallengeParticipant>;
  return {
    slug,
    displayName: d.displayName || slug,
    joinedAt: typeof d.joinedAt === 'number' ? d.joinedAt : 0,
    validatedBatches: Array.isArray(d.validatedBatches) ? d.validatedBatches.filter((b) => typeof b === 'number') : [],
    currentBatch: typeof d.currentBatch === 'number' ? d.currentBatch : 0,
    lastValidatedAt: typeof d.lastValidatedAt === 'number' ? d.lastValidatedAt : 0,
    finishedAt: typeof d.finishedAt === 'number' ? d.finishedAt : undefined,
  };
}

/**
 * Classement : le plus de lots d'abord ; à égalité, celui qui y est arrivé le premier.
 * Ceux qui ont fini passent devant, dans l'ordre d'arrivée.
 */
export function rankChallenge(list: ChallengeParticipant[]): {
  rows: ChallengeRankRow[];
  winner: ChallengeRankRow | null;
  /** Fin du délai des 2e-5e (null tant que personne n'a fini). */
  followerDeadline: number | null;
} {
  const rows: ChallengeRankRow[] = list.map((p) => ({ ...p, lots: countChallengeLots(p.validatedBatches), rank: 0 }));
  rows.sort((a, b) => {
    const fa = a.finishedAt ?? Infinity;
    const fb = b.finishedAt ?? Infinity;
    if (fa !== fb) return fa - fb;
    if (b.lots !== a.lots) return b.lots - a.lots;
    if (a.lots > 0 && a.lastValidatedAt !== b.lastValidatedAt) return a.lastValidatedAt - b.lastValidatedAt;
    return a.joinedAt - b.joinedAt;
  });
  rows.forEach((r, i) => (r.rank = i + 1));

  const finishers = rows.filter((r) => r.finishedAt !== undefined);
  const winner = finishers[0] ?? null;
  const followerDeadline = winner ? winner.finishedAt! + CHALLENGE_FOLLOWER_WINDOW_MS : null;
  finishers.forEach((r, i) => {
    r.finishRank = i + 1;
    if (i === 0) r.prize = CHALLENGE_FIRST_PRIZE;
    else if (i <= CHALLENGE_FOLLOWER_PLACES && followerDeadline !== null && r.finishedAt! <= followerDeadline) {
      r.prize = CHALLENGE_FOLLOWER_PRIZE;
    }
  });
  return { rows, winner, followerDeadline };
}

/** « 2 j 05 h », « 3 h 12 min », « 4 min 09 s ». */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d} j ${pad(h)} h`;
  if (h > 0) return `${h} h ${pad(m)} min`;
  return `${m} min ${pad(sec)} s`;
}

class ChallengeService {
  private db: Database | null = null;
  /** Écart horloge serveur - horloge du téléphone : l'heure d'un téléphone mal réglé ne compte pas. */
  private serverOffset = 0;

  constructor() {
    try {
      const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
      this.db = getDatabase(app);
      onValue(ref(this.db, '.info/serverTimeOffset'), (snap) => {
        const v = snap.val();
        if (typeof v === 'number') this.serverOffset = v;
      });
    } catch (err) {
      console.warn('Challenge : Firebase indisponible', err);
    }
  }

  /** Heure du serveur Firebase (ms). */
  public now(): number {
    return Date.now() + this.serverOffset;
  }

  public subscribe(callback: (list: ChallengeParticipant[]) => void): Unsubscribe {
    if (!this.db) {
      callback([]);
      return () => {};
    }
    return onValue(
      ref(this.db, ROOT),
      (snap) => {
        const val = snap.exists() ? (snap.val() as Record<string, unknown>) : {};
        callback(Object.entries(val).map(([slug, raw]) => normalize(raw, slug)));
      },
      (err) => {
        console.warn('Challenge : lecture des participants impossible', err);
        callback([]);
      }
    );
  }

  /** Inscription (sans effet si le joueur est déjà inscrit). */
  public async join(slug: string, displayName: string): Promise<void> {
    if (!this.db) throw new Error('Firebase indisponible');
    const now = this.now();
    await runTransaction(ref(this.db, `${ROOT}/${slug}`), (cur) => {
      if (cur) return cur;
      return {
        slug,
        displayName: displayName.trim().toUpperCase(),
        joinedAt: now,
        currentBatch: 0,
        lastValidatedAt: 0,
      };
    });
  }

  /**
   * Enregistre un lot du challenge réussi à 30/30. Transaction : on part de l'état serveur
   * et on n'ajoute que ce lot ; l'heure d'arrivée au 125e lot n'est écrite qu'une fois.
   */
  public async recordValidation(slug: string, displayName: string, batchNumber: number): Promise<ChallengeParticipant | null> {
    if (!this.db) return null;
    const now = this.now();
    const result = await runTransaction(ref(this.db, `${ROOT}/${slug}`), (cur) => {
      const base: Partial<ChallengeParticipant> = cur && typeof cur === 'object' ? { ...cur } : { slug, displayName, joinedAt: now };
      const list: number[] = Array.isArray(base.validatedBatches) ? [...base.validatedBatches] : [];
      if (list.includes(batchNumber)) return base; // lot rejoué : ni le rang ni l'heure ne bougent
      list.push(batchNumber);
      list.sort((a, b) => a - b);
      base.validatedBatches = list;
      base.currentBatch = Math.min(CHALLENGE_LOTS - 1, Math.max(typeof base.currentBatch === 'number' ? base.currentBatch : 0, batchNumber));
      base.lastValidatedAt = now;
      if (countChallengeLots(list) >= CHALLENGE_LOTS && typeof base.finishedAt !== 'number') base.finishedAt = now;
      return base;
    });
    await this.saveActiveSession(slug, null);
    return result.committed && result.snapshot.exists() ? normalize(result.snapshot.val(), slug) : null;
  }

  /** Partie en cours du joueur (lui seul l'écoute). */
  public subscribeSession(slug: string, callback: (session: ActiveSessionData | null) => void): Unsubscribe {
    if (!this.db) {
      callback(null);
      return () => {};
    }
    return onValue(
      ref(this.db, `${SESSIONS}/${slug}`),
      (snap) => callback(snap.exists() ? (snap.val() as ActiveSessionData) : null),
      () => callback(null)
    );
  }

  public async saveActiveSession(slug: string, session: ActiveSessionData | null): Promise<void> {
    if (!this.db) return;
    try {
      await set(ref(this.db, `${SESSIONS}/${slug}`), session);
    } catch (err) {
      console.warn('Challenge : sauvegarde de la session impossible', err);
    }
  }
}

export const challengeService = new ChallengeService();
