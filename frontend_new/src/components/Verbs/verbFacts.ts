import { VERB_FORMS_RAW } from '../../data/verbForms';

/** Ce que l'ODS 8 dit d'un verbe (voir scripts/build_verb_forms.py). */
export interface VerbFacts {
  /** Participe passé féminin : forme testée et verdict. */
  participle?: { form: string; valid: boolean };
  /** Temps absents de l'ODS (verbe défectif), en toutes lettres. */
  missingTenses: string[];
  /** Défectif réduit à l'infinitif (ESTER, CHEVRER). */
  infinitiveOnly: boolean;
  thirdPersonOnly: boolean;
  pronominal: boolean;
  /** Défectif signalé par la source (3e groupe, non calculable). */
  flaggedDefective: boolean;
  frontHooks: string;
  backHooks: string;
  /** Définition nettoyée des codes de notation, vide si absente. */
  definition: string;
}

/** Styles partagés des pastilles (cartes, légende, guide). */
export const CHIP =
  'inline-flex items-center gap-1 rounded-md border px-1.5 py-[3px] text-[10px] sm:text-[11px] leading-none font-bold whitespace-nowrap';
export const TONE = {
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  trap: 'bg-rose-50 text-rose-700 border-rose-200',
  defective: 'bg-amber-50 text-amber-900 border-amber-300',
  impersonal: 'bg-sky-50 text-sky-800 border-sky-200',
  pronominal: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200',
  hook: 'bg-white text-slate-600 border-slate-300 font-mono tracking-tight',
} as const;

const TENSE_NAMES: Record<string, string> = {
  P: 'présent',
  I: 'imparfait',
  S: 'passé simple',
  F: 'futur',
  J: 'subj. imparfait',
  N: 'part. présent',
  Q: 'part. passé',
};

const PLACEHOLDER = /^Verbe (du dictionnaire )?officiel/i;
// Codes de notation hérités des sources ([-], [vi*], (+a), (d)…), désormais remplacés par les pastilles
const LEADING_CODES =
  /^(\s*(\[[^\]]*\]|\((\+[a-z,]+|d|i|pr|pronominal)\)|Transitif \(v\.t\.\)|Intransitif \(v\.i\.\))\s*[,|]?)+\s*/i;

function cleanDefinition(details: string): string {
  if (!details || PLACEHOLDER.test(details)) return '';
  return details
    .replace(LEADING_CODES, '')
    .replace(/\{[^}]*\}\s*,?\s*/g, '') // {laper} : anagrammes, déjà gérées par l'appli
    .replace(/>\s*[^|]*/g, '') // « > diène… » : renvois de la source
    .replace(/\s*\((pronominal)\)\s*/gi, ' ')
    .replace(/^[|,\s]+|[|,\s]+$/g, '')
    .replace(/\s*\|\s*/g, ' · ')
    .trim();
}

export function getVerbFacts(word: string, details = ''): VerbFacts {
  const [pp = '', missing = '', flags = '', back = '', front = ''] = (VERB_FORMS_RAW[word] || '').split('|');
  const sourceInfinitiveOnly = /^\s*\(i\)/i.test(details);
  const infinitiveOnly = missing.length >= 4 || sourceInfinitiveOnly;
  const ppForm = word.endsWith('ER') ? `${word.slice(0, -2)}EE` : `${word.slice(0, -2)}IE`;

  return {
    participle: pp && !infinitiveOnly ? { form: ppForm, valid: pp === 'v' } : undefined,
    missingTenses: infinitiveOnly ? [] : missing.split('').map((c) => TENSE_NAMES[c]).filter(Boolean),
    infinitiveOnly,
    thirdPersonOnly: flags.includes('3'),
    pronominal: /\((pr|pronominal)\)|\[vpr\]/i.test(details),
    flaggedDefective: !missing && !flags.includes('3') && /^\s*\(d\)/i.test(details),
    frontHooks: front,
    backHooks: back,
    definition: cleanDefinition(details),
  };
}
