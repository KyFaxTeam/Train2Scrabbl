import { firebaseVerbsService, type WordStat, type WordStatsTree } from './firebaseVerbsService';
import { getBatchWords, MASTER_TIER_BATCHES } from '../data/masterVerbsDb';

/**
 * Choix des verbes que l'entrainement fait travailler, conjugues.
 *
 * Regle d'or : uniquement des verbes que le joueur connecte a DEJA joues - ceux
 * de ses lots valides, ceux qu'il a croises dans ses tirages, son carnet des
 * Betes noires. L'entrainement revient sur ce qu'il a appris, il ne lui apprend
 * pas de verbe nouveau.
 *
 * Parmi ces verbes, l'ordre :
 *  1. ses verbes difficiles : rates, longs a trouver, saisies refusees, passes ;
 *  2. ceux qui resistent au club (mesure cumulee sur tous les membres) ;
 *  3. les autres, au hasard.
 */

export type VerbSource = 'perso' | 'club' | 'lot';

export interface VerbCandidate {
  verbe: string;
  source: VerbSource;
  /** Phrase courte montree apres le coup : pourquoi ce verbe est revenu. */
  raison: string;
}

/** Le joueur n'est pas connecte, ou n'a encore joue aucun verbe. */
export class AucunVerbeJoue extends Error {
  constructor(public readonly connecte: boolean) {
    super(connecte ? 'Aucun verbe joué pour le moment.' : 'Joueur non connecté.');
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

type Cumul = { a: number; f: number; w: number; t: number };

/** Difficulte d'un verbe d'apres son historique : echecs, hesitations, lenteur. */
function difficulte(s: Cumul): number {
  if (!s.a) return 0;
  const tauxEchec = (s.f + 0.5 * s.w) / (s.a + 1);
  const tempsMoyen = s.t / s.a;
  return tauxEchec + Math.max(0, tempsMoyen - 5) / 15;
}

function ajouter(total: Cumul, s?: WordStat) {
  if (!s) return;
  total.a += s.a || 0;
  total.f += s.f || 0;
  total.w += s.w || 0;
  total.t += s.t || 0;
}

/** Historique d'un joueur sur un verbe : tirages de Verbes Club + exercices d'entrainement. */
function historique(slug: string, verbe: string, tirages: WordStatsTree, exos: WordStatsTree): Cumul {
  const c = { a: 0, f: 0, w: 0, t: 0 };
  ajouter(c, tirages[verbe]?.[slug]);
  ajouter(c, exos[verbe]?.[slug]);
  return c;
}

/** Historique du club sur un verbe, et combien de membres l'ont rate. */
function historiqueClub(verbe: string, tirages: WordStatsTree, exos: WordStatsTree) {
  const c = { a: 0, f: 0, w: 0, t: 0 };
  const rateurs = new Set<string>();
  for (const arbre of [tirages, exos]) {
    for (const [slug, s] of Object.entries(arbre[verbe] || {})) {
      ajouter(c, s);
      if ((s.f || 0) > 0) rateurs.add(slug);
    }
  }
  return { ...c, rateurs: rateurs.size };
}

function raisonPerso(s: Cumul): string {
  if (s.f > 0) return `Tu l'as raté ${s.f} fois`;
  if (s.w > 0) return `${s.w} saisie${s.w > 1 ? 's' : ''} refusée${s.w > 1 ? 's' : ''} avant de le trouver`;
  return `Tu as mis ${Math.round(s.t / s.a)} s en moyenne à le trouver`;
}

function raisonClub(c: ReturnType<typeof historiqueClub>): string {
  if (c.rateurs > 1) return `Raté par ${c.rateurs} membres du club`;
  if (c.f > 0) return `Raté ${c.f} fois au club`;
  return `${Math.round(c.t / c.a)} s en moyenne pour le trouver au club`;
}

function melanger<T>(t: T[]): T[] {
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

/**
 * Une liste ordonnee de verbes candidats, plus longue que necessaire : certains
 * n'ont aucune forme conjuguee de sept lettres (verbes longs) et seront ecartes.
 *
 * @throws AucunVerbeJoue si le joueur n'est pas connecte ou n'a rien joue.
 */
export async function verbesCandidats(combien: number): Promise<VerbCandidate[]> {
  const pseudo = pseudoCourant();
  if (!pseudo) throw new AucunVerbeJoue(false);
  const slug = firebaseVerbsService.slugify(pseudo);

  const [tirages, exos, profil] = await Promise.all([
    firebaseVerbsService.loadWordStats().catch(() => ({} as WordStatsTree)),
    firebaseVerbsService.loadTrainingStats().catch(() => ({} as WordStatsTree)),
    firebaseVerbsService.loadPlayerProfile(slug, pseudo).catch(() => null),
  ]);
  if (!profil) throw new AucunVerbeJoue(false);

  // Les verbes deja joues par CE joueur, et d'ou il les connait
  const deLots = new Set<string>();
  for (const n of profil.validatedBatches || []) {
    if (n >= 1 && n <= MASTER_TIER_BATCHES) for (const v of getBatchWords(n - 1)) deLots.add(v.word);
  }
  const joues = new Set<string>(deLots);
  for (const arbre of [tirages, exos]) {
    for (const [verbe, joueurs] of Object.entries(arbre)) if (joueurs?.[slug]) joues.add(verbe);
  }
  const betesNoires = new Set(profil.blacklistedVerbs || []);
  for (const v of betesNoires) joues.add(v);
  if (joues.size === 0) throw new AucunVerbeJoue(true);

  const perso: { c: VerbCandidate; d: number }[] = [];
  const club: { c: VerbCandidate; d: number }[] = [];
  const autres: VerbCandidate[] = [];

  for (const verbe of joues) {
    const moi = historique(slug, verbe, tirages, exos);
    const dMoi = difficulte(moi);
    if (dMoi > 0.25) {
      perso.push({ c: { verbe, source: 'perso', raison: raisonPerso(moi) }, d: dMoi });
      continue;
    }
    if (betesNoires.has(verbe)) {
      perso.push({ c: { verbe, source: 'perso', raison: 'Dans ton carnet des Bêtes noires' }, d: 0.3 });
      continue;
    }
    const nous = historiqueClub(verbe, tirages, exos);
    const dNous = difficulte(nous);
    if (dNous > 0.25) {
      club.push({ c: { verbe, source: 'club', raison: raisonClub(nous) }, d: dNous });
      continue;
    }
    autres.push({
      verbe,
      source: 'lot',
      raison: deLots.has(verbe) ? 'Un verbe de tes lots validés' : 'Un verbe que tu as déjà joué',
    });
  }

  // Chaque vivier dans son ordre de difficulte, le haut un peu brasse pour ne
  // pas servir toujours les memes ; perso et club en alternance.
  const ordonner = (l: { c: VerbCandidate; d: number }[]) => {
    const tri = l.sort((x, y) => y.d - x.d).map((x) => x.c);
    return melanger(tri.slice(0, combien * 2)).concat(tri.slice(combien * 2));
  };
  const a = ordonner(perso);
  const b = ordonner(club);
  const out: VerbCandidate[] = [];
  // Large : les verbes sans forme de sept lettres seront ecartes apres conjugaison
  const plafond = combien * 40;
  while ((a.length || b.length) && out.length < plafond) {
    if (a.length) out.push(a.shift()!);
    if (b.length) out.push(b.shift()!);
  }
  for (const c of melanger(autres)) {
    if (out.length >= plafond) break;
    out.push(c);
  }
  return out;
}
