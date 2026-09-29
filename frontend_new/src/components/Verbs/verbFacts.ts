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
  const ppForm = word.endsWith('ER') ? `${word.slice(0, -2)}EE` : `${word.slice(0, -2)}IE`;

  return {
    participle: pp ? { form: ppForm, valid: pp === 'v' } : undefined,
    missingTenses: missing.length >= 4 ? [] : missing.split('').map((c) => TENSE_NAMES[c]).filter(Boolean),
    infinitiveOnly: missing.length >= 4,
    thirdPersonOnly: flags.includes('3'),
    pronominal: /\((pr|pronominal)\)|\[vpr\]/i.test(details),
    flaggedDefective: !missing && !pp && /^\s*\(d\)/i.test(details),
    frontHooks: front,
    backHooks: back,
    definition: cleanDefinition(details),
  };
}
