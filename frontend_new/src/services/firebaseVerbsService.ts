import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  get,
  set,
  onValue,
  push,
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
          const data = snap.val() as PlayerVerbProfile;
          const profile: PlayerVerbProfile = {
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
          };
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
    score: number
  ): Promise<void> {
    let profile = await this.loadPlayerProfile(slug, playerName);
    if (!profile) {
      profile = await this.createPlayerProfile(playerName);
    }
    if (!profile.validatedBatches.includes(batchNumber)) {
      profile.validatedBatches.push(batchNumber);
      profile.validatedBatches.sort((a, b) => a - b);
    }
    profile.completedBatches = profile.validatedBatches.length;
    profile.masteredWordsCount = profile.completedBatches * 30;
    profile.currentBatch = Math.max(profile.currentBatch, batchNumber); // unlock next batch (batchNumber is 1-indexed)
    profile.drawIndex = 0;
    profile.drawWords = [];
    profile.activeSession = null;

    await this.savePlayerProfile(profile);

    // Nettoyage de la session active sur Firebase
    if (this.isConnected && this.db) {
      try {
        const sessionRef = ref(this.db, `verb_mastery/players/${slug}/activeSession`);
        await set(sessionRef, null);
      } catch (err) {
        console.warn('Erreur reset activeSession:', err);
      }
    }

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
