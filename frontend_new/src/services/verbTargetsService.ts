import { firebaseVerbsService, type WordStat, type WordStatsTree } from './firebaseVerbsService';
import { getBatchWords, MASTER_TIER_BATCHES } from '../data/masterVerbsDb';

/**
 * Choix des verbes que l'entrainement fait travailler, conjugues.
 *
 * Trois viviers, dans cet ordre :
 *  1. les verbes du joueur : ratés, longs a trouver, saisies refusees, Betes noires ;
 *  2. les verbes durs pour le club : la meme mesure, cumulee sur tous les membres ;
 *  3. les verbes des lots que le joueur a valides - de quoi jouer tant que le
 *     suivi mot par mot n'a pas encore accumule d'historique.
 */

export type VerbSource = 'perso' | 'club' | 'lot';

export interface VerbCandidate {
  verbe: string;
  source: VerbSource;
  /** Phrase courte montree apres le coup : pourquoi ce verbe est revenu. */
  raison: string;
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

/** Difficulte d'un verbe d'apres son historique : echecs, hesitations, lenteur. */
function difficulte(s: { a: number; f: number; w: number; t: number }): number {
  if (!s.a) return 0;
  const tauxEchec = (s.f + 0.5 * s.w) / (s.a + 1);
  const tempsMoyen = s.t / s.a;
  return tauxEchec + Math.max(0, tempsMoyen - 5) / 15;
}

function cumul(parJoueur: Record<string, WordStat>) {
  const total = { a: 0, f: 0, w: 0, t: 0, joueurs: 0, rates: 0 };
  for (const s of Object.values(parJoueur || {})) {
    total.a += s.a || 0;
    total.f += s.f || 0;
    total.w += s.w || 0;
    total.t += s.t || 0;
    total.joueurs += 1;
    if (s.f > 0) total.rates += 1;
  }
  return total;
}

function raisonClub(c: ReturnType<typeof cumul>): string {
  if (c.rates > 1) return `Raté par ${c.rates} membres du club`;
  if (c.f > 0) return `Raté ${c.f} fois au club`;
  return `${Math.round(c.t / c.a)} s en moyenne pour le trouver au club`;
}

function raisonPerso(s: WordStat): string {
  if (s.f > 0) return `Tu l'as raté ${s.f} fois`;
  if (s.w > 0) return `${s.w} saisie${s.w > 1 ? 's' : ''} refusée${s.w > 1 ? 's' : ''} avant de le trouver`;
  return `Tu as mis ${Math.round(s.t / s.a)} s en moyenne à le trouver`;
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
 */
export async function verbesCandidats(combien: number): Promise<VerbCandidate[]> {
  const pseudo = pseudoCourant();
  const slug = pseudo ? firebaseVerbsService.slugify(pseudo) : null;

  const [arbre, profil] = await Promise.all([
    firebaseVerbsService.loadWordStats().catch(() => ({} as WordStatsTree)),
    slug ? firebaseVerbsService.loadPlayerProfile(slug, pseudo!).catch(() => null) : Promise.resolve(null),
  ]);

  const vus = new Set<string>();
  const perso: VerbCandidate[] = [];
  const club: VerbCandidate[] = [];

  if (slug) {
    const miens = Object.entries(arbre)
      .map(([verbe, joueurs]) => ({ verbe, s: joueurs?.[slug] }))
      .filter((x): x is { verbe: string; s: WordStat } => !!x.s && difficulte(x.s) > 0.25)
      .sort((x, y) => difficulte(y.s) - difficulte(x.s));
    for (const { verbe, s } of miens) {
      perso.push({ verbe, source: 'perso', raison: raisonPerso(s) });
      vus.add(verbe);
    }
    for (const verbe of profil?.blacklistedVerbs || []) {
      if (vus.has(verbe)) continue;
      perso.push({ verbe, source: 'perso', raison: 'Dans ton carnet des Bêtes noires' });
      vus.add(verbe);
    }
  }

  const durs = Object.entries(arbre)
    .map(([verbe, joueurs]) => ({ verbe, c: cumul(joueurs) }))
    .filter(({ verbe, c }) => !vus.has(verbe) && c.a > 0 && difficulte(c) > 0.25)
    .sort((x, y) => difficulte(y.c) - difficulte(x.c));
  for (const { verbe, c } of durs) {
    club.push({ verbe, source: 'club', raison: raisonClub(c) });
    vus.add(verbe);
  }

  // Moitie perso, moitie club, en alternance, chaque vivier pris dans son ordre
  // de difficulte - mais un peu brasse dans le haut du classement pour ne pas
  // servir toujours les memes.
  const tete = (l: VerbCandidate[]) => melanger(l.slice(0, combien * 2)).concat(l.slice(combien * 2));
  const a = tete(perso);
  const b = tete(club);
  const out: VerbCandidate[] = [];
  while ((a.length || b.length) && out.length < combien * 3) {
    if (a.length) out.push(a.shift()!);
    if (b.length) out.push(b.shift()!);
  }

  // Vivier de secours : les lots valides (ou les premiers lots pour un inconnu)
  if (out.length < combien * 3) {
    const lots = (profil?.validatedBatches || []).filter((n) => n >= 1 && n <= MASTER_TIER_BATCHES);
    const indices = lots.length ? lots.map((n) => n - 1) : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const verbes = melanger(indices.flatMap((i) => getBatchWords(i).map((v) => v.word)));
    for (const verbe of verbes) {
      if (out.length >= combien * 3) break;
      if (vus.has(verbe)) continue;
      vus.add(verbe);
      out.push({
        verbe,
        source: 'lot',
        raison: lots.length ? 'Un verbe de tes lots validés' : 'Un verbe des premiers lots',
      });
    }
  }

  return out;
}
