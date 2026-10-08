import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  get,
  set,
  onValue,
  push,
  runTransaction,
  Database,
  type Unsubscribe,
} from 'firebase/database';

export const FIREBASE_CONFIG = {
  projectId: "wwl-faizers",
  appId: "1:786855234991:web:09ac0a62936768c193f35a",
  databaseURL: "https://wwl-faizers-default-rtdb.europe-west1.firebasedatabase.app",
  storageBucket: "wwl-faizers.firebasestorage.app",
  apiKey: "AIzaSyCyO2jd_IWntdanzZLC8LDM7RaiHAcgiZQ",
  authDomain: "wwl-faizers.firebaseapp.com",
  messagingSenderId: "786855234991",
};

export interface ActiveSessionData {
  batchIndex: number;
  currentIndex: number; // 0 to 29
  sessionWords: string[];
  validationScore: number;
  sessionErrors: string[];
  lastSaved: number;
}

export interface PlayerVerbBadges {
  sniper?: boolean; // 3 lots consécutifs 30/30 du 1er coup
  lightning?: boolean; // Temps moyen < 4s sur un lot complet
}

export interface PlayerVerbProfile {
  displayName: string;
  slug: string;
  currentBatch: number; // 0-indexed (lot 1 = 0)
  completedBatches: number;
  validatedBatches: number[]; // e.g. [1, 2, 3]
  drawIndex: number; // 0 to 59
  drawWords: string[];
  masteredWordsCount: number;
  streakDays: number;
  lastActive: string;
  stats: {
    totalDrawsAttempted: number;
    totalDrawsCorrect: number;
    bestValidationScore: number;
  };
  activeSession?: ActiveSessionData | null;
  /** Célébration « Maître des Verbes » (déblocage du Panthéon) déjà montrée à ce joueur. */
  pantheonCelebrated?: boolean;
  /** Badges de prestige débloqués */
  badges?: PlayerVerbBadges;
  /** Nombre de lots 30/30 d'affilée (pour le badge Sniper) */
  streak30Count?: number;
  /** Carnet des Bêtes Noires (verbes ratés à réviser) */
  blacklistedVerbs?: string[];
}

export interface ClubActivityEvent {
  id?: string;
  player: string;
  type: 'BATCH_VALIDATED' | 'TRAINING_MILESTONE';
  batchNumber: number;
  score?: string;
  details?: string;
  timestamp: number;
}

/**
 * Historique d'un joueur sur un verbe, stocké sous `verb_mastery/word_stats/{VERBE}/{slug}`.
 * Clés courtes : le nœud grossit d'une entrée par verbe et par joueur.
 */
export interface WordStat {
  /** Tirages où ce verbe était à trouver */
  a: number;
  /** Tirages terminés sans l'avoir trouvé */
  f: number;
  /** Saisies refusées pendant ces tirages */
  w: number;
  /** Secondes passées au total sur ces tirages */
  t: number;
  /** Dernier passage (ms) */
  last: number;
}

/** `word_stats` tel que lu en base : verbe → joueur → historique. */
export type WordStatsTree = Record<string, Record<string, WordStat>>;

export interface ClubStats {
  totalBatchesValidated: number;
  totalWordsConquered: number;
  uniqueVerbsConqueredCount: number;
  activePlayersCount: number;
  lastUpdated: string;
}

class FirebaseVerbsService {
  private app: FirebaseApp | null = null;
  private db: Database | null = null;
  private isConnected = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!getApps().length) {
        this.app = initializeApp(FIREBASE_CONFIG);
      } else {
        this.app = getApp();
      }
      this.db = getDatabase(this.app);
      this.isConnected = true;
    } catch (err) {
      console.warn('Firebase Realtime Database initialisation fallback to local storage:', err);
      this.isConnected = false;
    }
  }

  public slugify(name: string): string {
    let s = (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    s = s.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    if (!s) s = 'MEMBRE';
    return s.slice(0, 60);
  }

  private normalizeProfile(raw: any, slug: string, defaultName: string): PlayerVerbProfile {
    const data = (raw || {}) as PlayerVerbProfile;
    return {
      displayName: data.displayName || defaultName,
      slug: slug,
      currentBatch: typeof data.currentBatch === 'number' ? data.currentBatch : 0,
      completedBatches: typeof data.completedBatches === 'number' ? data.completedBatches : 0,
      validatedBatches: Array.isArray(data.validatedBatches) ? data.validatedBatches : [],
      drawIndex: typeof data.drawIndex === 'number' ? data.drawIndex : 0,
      drawWords: Array.isArray(data.drawWords) ? data.drawWords : [],
      masteredWordsCount: typeof data.masteredWordsCount === 'number' ? data.masteredWordsCount : 0,
      streakDays: typeof data.streakDays === 'number' ? data.streakDays : 1,
      lastActive: data.lastActive || new Date().toISOString(),
      stats: data.stats || { totalDrawsAttempted: 0, totalDrawsCorrect: 0, bestValidationScore: 0 },
      activeSession: data.activeSession || null,
      pantheonCelebrated: data.pantheonCelebrated === true,
      badges: data.badges || {},
      streak30Count: typeof data.streak30Count === 'number' ? data.streak30Count : 0,
      blacklistedVerbs: Array.isArray(data.blacklistedVerbs) ? data.blacklistedVerbs : [],
    };
  }

  /** Remet à zéro la série Sniper sans réécrire le reste du profil. */
  public async resetStreak30(slug: string): Promise<void> {
    const localKey = `verb_player_${slug}`;
    try {
      const rawLocal = localStorage.getItem(localKey);
      if (rawLocal) {
        const p = JSON.parse(rawLocal);
        p.streak30Count = 0;
        localStorage.setItem(localKey, JSON.stringify(p));
      }
    } catch {}

    if (this.isConnected && this.db) {
      try {
        await set(ref(this.db, `verb_mastery/players/${slug}/streak30Count`), 0);
      } catch (err) {
        console.warn('Erreur reset streak30Count:', err);
      }
    }
  }

  public async loadPlayerProfile(slug: string, defaultName: string): Promise<PlayerVerbProfile | null> {
    if (!slug || ['ANTIGRAVITY', 'JOUEUR', 'MEMBRE'].includes(slug.toUpperCase())) {
      localStorage.removeItem(`verb_player_${slug}`);
      localStorage.removeItem('faizers_verb_user');
      return null;
    }

    const localKey = `verb_player_${slug}`;

    if (this.isConnected && this.db) {
      try {
        const playerRef = ref(this.db, `verb_mastery/players/${slug}`);
        const snap = await get(playerRef);
        if (snap.exists()) {
          const profile = this.normalizeProfile(snap.val(), slug, defaultName);
          localStorage.setItem(localKey, JSON.stringify(profile));
          return profile;
        } else {
          // Joueur inexistant sur Firebase (supprimé ou non encore créé)
          localStorage.removeItem(localKey);
          localStorage.removeItem('faizers_verb_user');
          return null;
        }
      } catch (err) {
        console.warn('Erreur lecture Firebase:', err);
      }
    }

    return null;
  }

  public async createPlayerProfile(displayName: string): Promise<PlayerVerbProfile> {
    const slug = this.slugify(displayName);
    const newProfile: PlayerVerbProfile = {
      displayName: displayName.trim().toUpperCase(),
      slug: slug,
      currentBatch: 0,
      completedBatches: 0,
      validatedBatches: [],
      drawIndex: 0,
      drawWords: [],
      masteredWordsCount: 0,
      streakDays: 1,
      lastActive: new Date().toISOString(),
      stats: {
        totalDrawsAttempted: 0,
        totalDrawsCorrect: 0,
        bestValidationScore: 0,
      },
      badges: {},
      streak30Count: 0,
      blacklistedVerbs: [],
    };
    await this.savePlayerProfile(newProfile);
    return newProfile;
  }

  public async savePlayerProfile(profile: PlayerVerbProfile): Promise<void> {
    const localKey = `verb_player_${profile.slug}`;
    profile.lastActive = new Date().toISOString();
    localStorage.setItem(localKey, JSON.stringify(profile));

    if (this.isConnected && this.db) {
      try {
        const playerRef = ref(this.db, `verb_mastery/players/${profile.slug}`);
        await set(playerRef, profile);
      } catch (err) {
        console.warn('Erreur sauvegarde profil Firebase:', err);
      }
    }
  }

  public async recordBatchValidation(
    slug: string,
    playerName: string,
    batchNumber: number,
    score: number,
    extraUpdates?: {
      badges?: PlayerVerbBadges;
      streak30Count?: number;
    }
  ): Promise<PlayerVerbProfile> {
    // Transaction sur le nœud du joueur : on part TOUJOURS de l'état serveur et on n'ajoute que ce lot.
    // Un set() du profil complet pouvait réécrire une liste périmée et effacer des lots déjà validés.
    const applyValidation = (data: any): PlayerVerbProfile => {
      const base: any = data && typeof data === 'object' ? { ...data } : {};
      const list: number[] = Array.isArray(base.validatedBatches) ? [...base.validatedBatches] : [];
      if (!list.includes(batchNumber)) list.push(batchNumber);
      list.sort((a, b) => a - b);
      base.displayName = base.displayName || playerName.trim().toUpperCase();
      base.slug = slug;
      base.validatedBatches = list;
      base.completedBatches = list.length;
      base.masteredWordsCount = list.length * 30;
      base.currentBatch = Math.max(typeof base.currentBatch === 'number' ? base.currentBatch : 0, batchNumber); // batchNumber 1-indexé = index du lot suivant
      base.drawIndex = 0;
      base.drawWords = [];
      base.activeSession = null;
      base.lastActive = new Date().toISOString();
      if (!base.stats) base.stats = { totalDrawsAttempted: 0, totalDrawsCorrect: 0, bestValidationScore: 0 };
      if (typeof base.streakDays !== 'number') base.streakDays = 1;
      if (extraUpdates?.badges) base.badges = { ...(base.badges || {}), ...extraUpdates.badges };
      if (typeof extraUpdates?.streak30Count === 'number') base.streak30Count = extraUpdates.streak30Count;
      return base;
    };

    let profile: PlayerVerbProfile | null = null;
    if (this.isConnected && this.db) {
      try {
        const playerRef = ref(this.db, `verb_mastery/players/${slug}`);
        const result = await runTransaction(playerRef, (current) => applyValidation(current));
        if (result.committed && result.snapshot.exists()) {
          profile = this.normalizeProfile(result.snapshot.val(), slug, playerName);
        }
      } catch (err) {
        console.warn('Erreur transaction validation de lot:', err);
      }
    }
    if (!profile) {
      // Hors-ligne : mise à jour du cache local uniquement
      let local: any = null;
      try {
        local = JSON.parse(localStorage.getItem(`verb_player_${slug}`) || 'null');
      } catch {}
      profile = this.normalizeProfile(applyValidation(local), slug, playerName);
    }
    localStorage.setItem(`verb_player_${slug}`, JSON.stringify(profile));

    // Publication de l'activité du club
    if (this.isConnected && this.db) {
      try {
        const activityRef = ref(this.db, 'verb_mastery/club_activity');
        await push(activityRef, {
          player: playerName,
          type: 'BATCH_VALIDATED',
          batchNumber: batchNumber,
          score: `${score}/30`,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.warn('Erreur ajout événement activité club:', err);
      }
    }

    return profile;
  }

  /**
   * Note un tirage terminé pour chacun de ses verbes : trouvé ou non, temps passé, saisies refusées.
   * Une transaction par verbe : deux appareils du même joueur ne s'écrasent pas.
   */
  public async recordWordAttempts(
    slug: string,
    results: { word: string; found: boolean }[],
    seconds: number,
    wrongInputs: number
  ): Promise<void> {
    if (!this.isConnected || !this.db || !slug) return;
    const t = Math.round(Math.min(seconds, 120) * 10) / 10;
    await Promise.all(
      results.map(({ word, found }) =>
        runTransaction(ref(this.db!, `verb_mastery/word_stats/${word}/${slug}`), (cur: WordStat | null) => {
          const s = cur || { a: 0, f: 0, w: 0, t: 0, last: 0 };
          return {
            a: (s.a || 0) + 1,
            f: (s.f || 0) + (found ? 0 : 1),
            w: (s.w || 0) + wrongInputs,
            t: Math.round(((s.t || 0) + t) * 10) / 10,
            last: Date.now(),
          };
        }).catch((err) => console.warn('Erreur suivi du verbe', word, err))
      )
    );
  }

  /** Tout l'historique mot par mot du club (quelques centaines de Ko au plus). */
  public async loadWordStats(): Promise<WordStatsTree> {
    if (!this.isConnected || !this.db) return {};
    try {
      const snap = await get(ref(this.db, 'verb_mastery/word_stats'));
      return snap.exists() ? (snap.val() as WordStatsTree) : {};
    } catch (err) {
      console.warn('Erreur lecture word_stats:', err);
      return {};
    }
  }

  public async saveActiveSession(slug: string, session: ActiveSessionData): Promise<void> {
    const localKey = `verb_player_${slug}`;
    const rawLocal = localStorage.getItem(localKey);
    if (rawLocal) {
      try {
        const p = JSON.parse(rawLocal);
        p.activeSession = session;
        p.lastActive = new Date().toISOString();
        localStorage.setItem(localKey, JSON.stringify(p));
      } catch {}
    }

    if (this.isConnected && this.db) {
      try {
        const sessionRef = ref(this.db, `verb_mastery/players/${slug}/activeSession`);
        await set(sessionRef, session);
      } catch (err) {
        console.warn('Erreur sauvegarde activeSession:', err);
      }
    }
  }

  public async clearActiveSession(slug: string): Promise<void> {
    const localKey = `verb_player_${slug}`;
    const rawLocal = localStorage.getItem(localKey);
    if (rawLocal) {
      try {
        const p = JSON.parse(rawLocal);
        delete p.activeSession;
        p.lastActive = new Date().toISOString();
        localStorage.setItem(localKey, JSON.stringify(p));
      } catch {}
    }

    if (this.isConnected && this.db) {
      try {
        const sessionRef = ref(this.db, `verb_mastery/players/${slug}/activeSession`);
        await set(sessionRef, null);
      } catch (err) {
        console.warn('Erreur clear activeSession:', err);
      }
    }
  }

  /** Mémorise que la célébration de déblocage du Panthéon a été montrée (une seule fois par joueur). */
  public async markPantheonCelebrated(slug: string): Promise<void> {
    const localKey = `verb_player_${slug}`;
    try {
      const rawLocal = localStorage.getItem(localKey);
      if (rawLocal) {
        const p = JSON.parse(rawLocal);
        p.pantheonCelebrated = true;
        localStorage.setItem(localKey, JSON.stringify(p));
      }
    } catch {}

    if (this.isConnected && this.db) {
      try {
        const flagRef = ref(this.db, `verb_mastery/players/${slug}/pantheonCelebrated`);
        await set(flagRef, true);
      } catch (err) {
        console.warn('Erreur sauvegarde pantheonCelebrated:', err);
      }
    }
  }

  /** Ajoute un verbe raté au carnet des bêtes noires du joueur */
  public async addBlacklistedVerb(slug: string, verb: string): Promise<void> {
    const localKey = `verb_player_${slug}`;
    try {
      const rawLocal = localStorage.getItem(localKey);
      if (rawLocal) {
        const p = JSON.parse(rawLocal);
        const list = Array.isArray(p.blacklistedVerbs) ? p.blacklistedVerbs : [];
        if (!list.includes(verb)) {
          p.blacklistedVerbs = [verb, ...list];
          localStorage.setItem(localKey, JSON.stringify(p));
        }
      }
    } catch {}

    if (this.isConnected && this.db) {
      try {
        const listRef = ref(this.db, `verb_mastery/players/${slug}/blacklistedVerbs`);
        const snap = await get(listRef);
        const current: string[] = snap.exists() && Array.isArray(snap.val()) ? snap.val() : [];
        if (!current.includes(verb)) {
          await set(listRef, [verb, ...current]);
        }
      } catch (err) {
        console.warn('Erreur ajout bête noire:', err);
      }
    }
  }

  /** Retire un verbe maîtrisé du carnet des bêtes noires du joueur */
  public async removeBlacklistedVerb(slug: string, verb: string): Promise<void> {
    const localKey = `verb_player_${slug}`;
    try {
      const rawLocal = localStorage.getItem(localKey);
      if (rawLocal) {
        const p = JSON.parse(rawLocal);
        p.blacklistedVerbs = (p.blacklistedVerbs || []).filter((w: string) => w !== verb);
        localStorage.setItem(localKey, JSON.stringify(p));
      }
    } catch {}

    if (this.isConnected && this.db) {
      try {
        const listRef = ref(this.db, `verb_mastery/players/${slug}/blacklistedVerbs`);
        const snap = await get(listRef);
        if (snap.exists() && Array.isArray(snap.val())) {
          const updated = snap.val().filter((w: string) => w !== verb);
          await set(listRef, updated);
        }
      } catch (err) {
        console.warn('Erreur suppression bête noire:', err);
      }
    }
  }

  public subscribeToLeaderboard(callback: (players: PlayerVerbProfile[]) => void): Unsubscribe {
    if (!this.isConnected || !this.db) {
      callback(this.getLocalLeaderboard());
      return () => {};
    }

    try {
      const playersRef = ref(this.db, 'verb_mastery/players');
      return onValue(
        playersRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.val();
            const list: PlayerVerbProfile[] = Object.values(val);
            const filtered = list.filter(
              (p) =>
                p &&
                p.slug &&
                !['JOUEUR', 'ANTIGRAVITY', 'MEMBRE'].includes(p.slug.toUpperCase()) &&
                !['JOUEUR', 'ANTIGRAVITY', 'MEMBRE'].includes(p.displayName?.toUpperCase())
            );
            filtered.sort((a, b) => (b.completedBatches || 0) - (a.completedBatches || 0));
            callback(filtered);
          } else {
            callback([]);
          }
        },
        (error) => {
          console.warn('Erreur écoute classement club:', error);
          callback([]);
        }
      );
    } catch (e) {
      callback([]);
      return () => {};
    }
  }

  public subscribeToClubActivity(callback: (events: ClubActivityEvent[]) => void): Unsubscribe {
    if (!this.isConnected || !this.db) {
      callback([]);
      return () => {};
    }

    try {
      const activityRef = ref(this.db, 'verb_mastery/club_activity');
      return onValue(activityRef, (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          const list: ClubActivityEvent[] = Object.keys(val).map((k) => ({
            id: k,
            ...val[k],
          }));
          const filtered = list.filter(
            (e) => e && e.player && e.player.toUpperCase() !== 'JOUEUR'
          );
          filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          // Historique complet : le fil n'en affiche que 20, les stats de la semaine en ont besoin
          callback(filtered);
        } else {
          callback([]);
        }
      });
    } catch {
      callback([]);
      return () => {};
    }
  }

  private getLocalLeaderboard(): PlayerVerbProfile[] {
    const rows: PlayerVerbProfile[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('verb_player_')) {
        try {
          const item = JSON.parse(localStorage.getItem(k) || '');
          if (
            item &&
            item.displayName &&
            item.displayName.toUpperCase() !== 'JOUEUR' &&
            item.slug?.toUpperCase() !== 'JOUEUR'
          ) {
            rows.push(item);
          }
        } catch (e) {
          // ignore
        }
      }
    }
    rows.sort((a, b) => (b.completedBatches || 0) - (a.completedBatches || 0));
    return rows;
  }
}

export const firebaseVerbsService = new FirebaseVerbsService();
