import { firebaseVerbsService, type WordStat, type WordStatsTree, type PlayerVerbProfile } from './firebaseVerbsService';
import { getBatchWords, MASTER_TIER_BATCHES, TOTAL_BATCHES } from '../data/masterVerbsDb';

/**
 * Choix des verbes que l'entrainement fait travailler, conjugues.
 *
 * Perimetre : les verbes des lots 1 jusqu'au lot ou en est le joueur (le lot en
 * cours compris). Jamais au-dela : au lot 15, pas de verbe du lot 23.
 *
 * Ordre, du plus prioritaire au moins prioritaire :
 *  1. ses Betes noires et ses rates (carnet, tirages rates, exercices passes) ;
 *  2. les rates collectifs : verbes rates par plusieurs membres ;
 *  3. les Betes noires du club : verbes dans le carnet d'autres membres ;
 *  4. les verbes trouves lentement (par lui, puis par le club) ;
 *  5. le reste de ses lots, au hasard.
 * Dans chaque groupe, les plus durs d'abord - le haut un peu brasse pour varier.
 * Un verbe reussi a l'entrainement ces trois derniers jours redescend au groupe 5.
 */

export type VerbSource = 'perso' | 'club' | 'lent' | 'lot';

export interface VerbCandidate {
  verbe: string;
  source: VerbSource;
  /** Phrase courte montree apres le coup : pourquoi ce verbe est revenu, et son lot. */
  raison: string;
}

/** Le joueur n'est pas connecte (ou son profil est introuvable). */
export class AucunVerbeJoue extends Error {
  readonly connecte: boolean;
  constructor(connecte: boolean) {
    super(connecte ? 'Aucun verbe joué pour le moment.' : 'Joueur non connecté.');
    this.connecte = connecte;
  }
}

export const PSEUDO_KEY = 'faizers_verb_user';

export function pseudoCourant(): string | null {
  try {
    const p = localStorage.getItem(PSEUDO_KEY);
    return p && p.trim() ? p.trim() : null;
  } catch {
    return null;
  }
}

const TROIS_JOURS = 3 * 24 * 3600 * 1000;
/** Au-dela de ce temps moyen (s), un verbe trouve compte comme « lent ». */
const SEUIL_LENT = 8;

type Cumul = { a: number; f: number; w: number; t: number };
const vide = (): Cumul => ({ a: 0, f: 0, w: 0, t: 0 });

function ajouter(total: Cumul, s?: WordStat) {
  if (!s) return;
  total.a += s.a || 0;
  total.f += s.f || 0;
  total.w += s.w || 0;
  total.t += s.t || 0;
}

function melanger<T>(t: T[]): T[] {
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Le lot en cours du joueur (1-indexe) : celui qui suit le plus haut lot valide. */
function lotEnCours(profil: PlayerVerbProfile): number {
  const valides = profil.validatedBatches || [];
  const haut = Math.max(profil.currentBatch || 0, ...valides, 0);
  const plafond = valides.filter((n) => n <= MASTER_TIER_BATCHES).length >= MASTER_TIER_BATCHES
    ? TOTAL_BATCHES
    : MASTER_TIER_BATCHES;
  return Math.min(haut + 1, plafond);
}

/**
 * Une liste ordonnee de verbes candidats, plus longue que necessaire : certains
 * n'ont aucune forme conjuguee de sept lettres (verbes longs) et seront ecartes.
 *
 * @throws AucunVerbeJoue si le joueur n'est pas connecte.
 */
export async function verbesCandidats(combien: number): Promise<VerbCandidate[]> {
  const pseudo = pseudoCourant();
  if (!pseudo) throw new AucunVerbeJoue(false);
  const slug = firebaseVerbsService.slugify(pseudo);

  const [tirages, exos, membres] = await Promise.all([
    firebaseVerbsService.loadWordStats().catch(() => ({} as WordStatsTree)),
    firebaseVerbsService.loadTrainingStats().catch(() => ({} as WordStatsTree)),
    firebaseVerbsService.loadAllPlayers().catch(() => ({} as Record<string, PlayerVerbProfile>)),
  ]);
  const profil = membres[slug];
  if (!profil) throw new AucunVerbeJoue(false);

  // Perimetre : lots 1 .. lot en cours, chaque verbe avec son numero de lot
  const lotDe = new Map<string, number>();
  const dernierLot = lotEnCours(profil);
  for (let n = 1; n <= dernierLot; n++) {
    for (const v of getBatchWords(n - 1)) if (!lotDe.has(v.word)) lotDe.set(v.word, n);
  }

  const monCarnet = new Set(profil.blacklistedVerbs || []);
  const carnetsClub = new Map<string, number>();
  for (const [s, p] of Object.entries(membres)) {
    if (s === slug || !p) continue;
    for (const v of p.blacklistedVerbs || []) carnetsClub.set(v, (carnetsClub.get(v) || 0) + 1);
  }

  type Classe = { c: VerbCandidate; d: number };
  const groupes: Classe[][] = [[], [], [], []];
  const reste: VerbCandidate[] = [];
  const maintenant = Date.now();

  for (const [verbe, lot] of lotDe) {
    const etiquette = ` · lot ${lot}`;
    const moi = vide();
    ajouter(moi, tirages[verbe]?.[slug]);
    ajouter(moi, exos[verbe]?.[slug]);

    const club = vide();
    const rateurs = new Set<string>();
    for (const arbre of [tirages, exos]) {
      for (const [s, st] of Object.entries(arbre[verbe] || {})) {
        if (s === slug) continue;
        ajouter(club, st);
        if ((st.f || 0) > 0) rateurs.add(s);
      }
    }

    // Reussi a l'entrainement il y a peu : on le laisse reposer
    const exo = exos[verbe]?.[slug];
    if (exo?.r === 1 && maintenant - (exo.last || 0) < TROIS_JOURS) {
      reste.push({ verbe, source: 'lot', raison: `Réussi récemment, on y revient${etiquette}` });
      continue;
    }

    // 1. Ses Betes noires et ses rates
    if (monCarnet.has(verbe) || moi.f > 0) {
      const raison = monCarnet.has(verbe) ? 'Dans ton carnet des Bêtes noires' : `Tu l'as raté ${moi.f} fois`;
      groupes[0].push({ c: { verbe, source: 'perso', raison: raison + etiquette }, d: (monCarnet.has(verbe) ? 1 : 0) + moi.f / (moi.a + 1) });
      continue;
    }
    // 2. Rates collectifs
    if (rateurs.size >= 2) {
      groupes[1].push({ c: { verbe, source: 'club', raison: `Raté par ${pluriel(rateurs.size, 'membre')} du club${etiquette}` }, d: rateurs.size + club.f / (club.a + 1) });
      continue;
    }
    // 3. Betes noires du club
    const nbCarnets = carnetsClub.get(verbe) || 0;
    if (nbCarnets > 0) {
      groupes[2].push({ c: { verbe, source: 'club', raison: `Bête noire de ${pluriel(nbCarnets, 'membre')} du club${etiquette}` }, d: nbCarnets });
      continue;
    }
    // 4. Trouves lentement : par lui d'abord (ponderation x2), puis par le club
    const lentMoi = moi.a ? moi.t / moi.a : 0;
    const lentClub = club.a ? club.t / club.a : 0;
    if (lentMoi >= SEUIL_LENT || lentClub >= SEUIL_LENT) {
      const raison = lentMoi >= SEUIL_LENT
        ? `Tu as mis ${Math.round(lentMoi)} s en moyenne à le trouver`
        : `${Math.round(lentClub)} s en moyenne au club pour le trouver`;
      groupes[3].push({ c: { verbe, source: 'lent', raison: raison + etiquette }, d: lentMoi >= SEUIL_LENT ? lentMoi * 2 : lentClub });
      continue;
    }
    // 5. Le reste
    reste.push({ verbe, source: 'lot', raison: `Un verbe de ton lot ${lot}` });
  }

  const ordonner = (l: Classe[]) => {
    const tri = l.sort((x, y) => y.d - x.d).map((x) => x.c);
    return melanger(tri.slice(0, combien * 2)).concat(tri.slice(combien * 2));
  };

  // Large : les verbes sans forme de sept lettres seront ecartes apres conjugaison
  const plafond = combien * 40;
  const out = groupes.flatMap(ordonner).concat(melanger(reste));
  return out.slice(0, plafond);
}
