/**
 * "Le Réflexe" — le défi chronométré du monde Morphologie.
 *
 * Le mode Étude fait réviser des tirages ; il n'entraîne pas la décision qui
 * coûte le plus cher en partie : « j'ai les lettres — est-ce que je tente ? ».
 * Le classement hors ligne (scripts/lexical_morphology_ranking.py) chiffre
 * exactement cet écart : -EL se déclenche sur 28% des tirages mais ne paie que
 * dans 2,4% des cas, tandis que DE- paie 42,8% du temps. Un joueur qui traite
 * ces deux familles pareil perd du temps sur l'une et rate l'autre.
 *
 * D'où deux manches, une par maillon de la chaîne de décision :
 *
 *   SCANNER  un vrai tirage, quatre familles — laquelle paie ici ?
 *            Les distracteurs sont choisis parmi les familles dont les lettres
 *            SONT présentes : impossible de répondre en comptant les lettres,
 *            il faut avoir le réflexe du motif.
 *
 *   CROCHET  un radical et un affixe — la soudure existe-t-elle ?
 *            Banque pré-calculée sur l'ODS8 (public/data/morphology_drills.json).
 */

import type { DrawEntry } from '../types/dictionary';
import { FEATURED_FAMILIES, type AffixFamily } from '../data/morphologyFamilies';
import {
    formatFamilyLabel,
    getEntriesByAffixFamily,
    getEntryFamilies,
    getFamilyWords,
    getMorphologyFamily,
} from './arenaService';

// ============================================================================
// BANQUE DE CROCHETS
// ============================================================================

export interface DrillItem {
    stem: string;
    word: string;
    affix: string;
    /** Le mot soudé existe-t-il dans l'ODS8 ? */
    ok: boolean;
}

interface DrillFamily {
    id: string;
    label: string;
    kind: 'prefix' | 'suffix';
    canonical: string;
    reliability: number;
    items: DrillItem[];
}

let bankPromise: Promise<Map<string, DrillFamily>> | null = null;

/** Charge la banque d'exercices (~190 Ko), une seule fois par session. */
export function loadDrillBank(): Promise<Map<string, DrillFamily>> {
    if (!bankPromise) {
        const basePath = import.meta.env.BASE_URL || '/';
        bankPromise = fetch(`${basePath}data/morphology_drills.json`)
            .then(res => {
                if (!res.ok) throw new Error(`Banque indisponible (${res.status})`);
                return res.json();
            })
            .then((data: { families: DrillFamily[] }) =>
                new Map(data.families.map(f => [f.id, f]))
            )
            .catch(err => {
                // Sans la banque le défi reste jouable en manche Scanner seule :
                // on ne bloque pas la session pour un fichier statique manquant.
                bankPromise = null;
                throw err;
            });
    }
    return bankPromise;
}

// ============================================================================
// QUESTIONS
// ============================================================================

export interface ScannerQuestion {
    id: string;
    kind: 'scanner';
    draw: string;
    options: { familyId: string; label: string }[];
    answerId: string;
    /** Le mot qui justifie la bonne réponse — montré en correction. */
    proof: string;
}

export interface HookQuestion {
    id: string;
    kind: 'hook';
    familyId: string;
    familyLabel: string;
    affixKind: 'prefix' | 'suffix';
    stem: string;
    affix: string;
    word: string;
    ok: boolean;
}

export type ReflexQuestion = ScannerQuestion | HookQuestion;

/** Temps alloué : le crochet est un oui/non, le scanner demande de lire 4 chips. */
export const TIME_LIMIT_MS: Record<ReflexQuestion['kind'], number> = {
    scanner: 12000,
    hook: 8000,
};

// ============================================================================
// GÉNÉRATION
// ============================================================================

/** Les tirages sont triés par probabilité : on pioche dans la tête de liste. */
const PROBABLE_POOL = 400;

function shuffled<T>(items: T[], rng: () => number): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function sample<T>(items: T[], rng: () => number): T | undefined {
    return items.length ? items[Math.floor(rng() * items.length)] : undefined;
}

function letterCounts(draw: string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const letter of draw) counts.set(letter, (counts.get(letter) || 0) + 1);
    return counts;
}

/** Le tirage contient-il de quoi tenter au moins un affixe de la famille ? */
function rackAllows(counts: Map<string, number>, family: AffixFamily): boolean {
    return family.patterns.some(pattern => {
        const need = letterCounts(pattern);
        for (const [letter, n] of need) {
            if ((counts.get(letter) || 0) < n) return false;
        }
        return true;
    });
}

function buildScanner(
    entry: DrawEntry,
    family: AffixFamily,
    rng: () => number
): ScannerQuestion | null {
    // Uniquement les solutions 7L : une rallonge 7+1 prouverait la famille
    // avec une lettre absente du chevalet affiche.
    const proof = getFamilyWords(entry, family.id, 'solutions')[0];
    if (!proof) return null;

    // Un distracteur ne doit surtout pas être une seconde bonne réponse : on
    // exclut TOUTES les familles présentes dans le tirage, pas seulement celle
    // qu'on interroge.
    const present = new Set(getEntryFamilies(entry));
    const counts = letterCounts(entry.draw);
    const others = FEATURED_FAMILIES.filter(f => !present.has(f.id));

    // Les distracteurs dont les lettres sont là forcent à raisonner en motif.
    // À défaut (tirage pauvre), on complète avec le reste : mieux vaut une
    // question un peu plus facile que pas de question.
    const tempting = shuffled(others.filter(f => rackAllows(counts, f)), rng);
    const rest = shuffled(others.filter(f => !rackAllows(counts, f)), rng);
    const distractors = [...tempting, ...rest].slice(0, 3);
    if (distractors.length < 3) return null;

    const options = shuffled([family, ...distractors], rng).map(f => ({
        familyId: f.id,
        label: formatFamilyLabel(f),
    }));

    return {
        id: `scanner-${entry.id}-${family.id}`,
        kind: 'scanner',
        draw: entry.draw,
        options,
        answerId: family.id,
        proof,
    };
}

function buildHook(item: DrillItem, family: AffixFamily): HookQuestion {
    return {
        id: `hook-${family.id}-${item.word}`,
        kind: 'hook',
        familyId: family.id,
        familyLabel: formatFamilyLabel(family),
        affixKind: family.kind,
        stem: item.stem,
        affix: item.affix,
        word: item.word,
        ok: item.ok,
    };
}

export interface ReflexConfig {
    /** Famille imposée, ou null pour un mélange des familles en vedette. */
    familyId?: string | null;
    total?: number;
    rng?: () => number;
}

/**
 * Construit une manche.
 *
 * Les questions vont par paires sur une même famille : on repère le motif sur
 * un chevalet, puis on soude un crochet de la même famille. C'est le va-et-vient
 * d'une vraie partie, et cela borne la manche à six familles au lieu de douze —
 * sans quoi le bilan afficherait douze lignes à une question, dont aucune ne
 * voudrait dire quoi que ce soit.
 */
export async function buildReflexSession(
    config: ReflexConfig = {}
): Promise<ReflexQuestion[]> {
    const { familyId = null, total = 12, rng = Math.random } = config;

    const target = familyId ? getMorphologyFamily(familyId) : undefined;
    const families = target ? [target] : shuffled(FEATURED_FAMILIES, rng);
    if (families.length === 0) return [];

    let bank: Map<string, DrillFamily> | null = null;
    try {
        bank = await loadDrillBank();
    } catch (error) {
        console.error('Banque de crochets indisponible, manche Scanner seule', error);
    }

    const questions: ReflexQuestion[] = [];
    const usedDraws = new Set<string>();
    const usedHooks = new Set<string>();

    // On ne s'arrête pas au premier échec : une famille peut manquer de
    // crochets (TRANS- n'en a que 15) sans que la manche doive être amputée.
    let attempts = 0;
    while (questions.length < total && attempts < total * 12) {
        attempts++;
        const family = families[Math.floor(questions.length / 2) % families.length];
        const wantHook = bank !== null && questions.length % 2 === 1;

        if (wantHook) {
            const pool = bank!.get(family.id)?.items ?? [];
            const item = sample(pool.filter(i => !usedHooks.has(i.word)), rng);
            if (item) {
                usedHooks.add(item.word);
                questions.push(buildHook(item, family));
                continue;
            }
        }

        const entries = getEntriesByAffixFamily(family.id);
        if (entries.length === 0) continue;
        const entry = sample(
            entries.slice(0, PROBABLE_POOL).filter(e => !usedDraws.has(e.draw)),
            rng
        );
        if (!entry) continue;

        const question = buildScanner(entry, family, rng);
        if (question) {
            usedDraws.add(entry.draw);
            questions.push(question);
        }
    }

    return questions;
}

// ============================================================================
// SCORE
// ============================================================================

export interface ReflexAnswer {
    questionId: string;
    familyId: string;
    kind: ReflexQuestion['kind'];
    correct: boolean;
    elapsedMs: number;
    points: number;
}

export function familyOf(question: ReflexQuestion): string {
    return question.kind === 'scanner' ? question.answerId : question.familyId;
}

/**
 * Une bonne réponse rapporte une base, un bonus de série plafonné et un bonus
 * de vitesse. Le plafond de série évite qu'une manche se joue entièrement sur
 * les cinq premières réponses ; le bonus de vitesse est ce qui distingue le
 * défi du mode Étude, où l'on a tout le temps de réfléchir.
 */
export function scoreAnswer(
    question: ReflexQuestion,
    correct: boolean,
    elapsedMs: number,
    streak: number
): number {
    if (!correct) return 0;
    const limit = TIME_LIMIT_MS[question.kind];
    const speedBonus = elapsedMs < limit / 3 ? 5 : elapsedMs < limit / 2 ? 3 : 0;
    return 10 + Math.min(streak, 5) * 2 + speedBonus;
}

export interface ReflexSummary {
    total: number;
    correct: number;
    accuracy: number;
    points: number;
    bestStreak: number;
    averageMs: number;
    /** Précision par famille, triée du plus faible au plus solide. */
    byFamily: {
        familyId: string;
        label: string;
        asked: number;
        correct: number;
        accuracy: number;
        reliability: number;
    }[];
}

export function summarize(answers: ReflexAnswer[]): ReflexSummary {
    const correct = answers.filter(a => a.correct).length;
    const buckets = new Map<string, { asked: number; correct: number }>();

    let streak = 0;
    let bestStreak = 0;
    for (const answer of answers) {
        streak = answer.correct ? streak + 1 : 0;
        bestStreak = Math.max(bestStreak, streak);

        const bucket = buckets.get(answer.familyId) || { asked: 0, correct: 0 };
        bucket.asked++;
        if (answer.correct) bucket.correct++;
        buckets.set(answer.familyId, bucket);
    }

    const byFamily = [...buckets.entries()]
        .map(([familyId, bucket]) => {
            const family = getMorphologyFamily(familyId);
            return {
                familyId,
                label: family ? formatFamilyLabel(family) : familyId,
                asked: bucket.asked,
                correct: bucket.correct,
                accuracy: Math.round((bucket.correct / bucket.asked) * 100),
                reliability: family?.reliability ?? 0,
            };
        })
        .sort((a, b) => a.accuracy - b.accuracy);

    return {
        total: answers.length,
        correct,
        accuracy: answers.length ? Math.round((correct / answers.length) * 100) : 0,
        points: answers.reduce((sum, a) => sum + a.points, 0),
        bestStreak,
        averageMs: answers.length
            ? Math.round(answers.reduce((sum, a) => sum + a.elapsedMs, 0) / answers.length)
            : 0,
        byFamily,
    };
}
