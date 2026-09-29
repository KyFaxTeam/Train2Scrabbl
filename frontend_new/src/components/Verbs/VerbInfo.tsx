import React from 'react';
import { getVerbFacts } from './verbFacts';

const chip = 'inline-flex items-center gap-1 rounded-md border px-1.5 py-[3px] text-[10px] sm:text-[11px] leading-none font-bold whitespace-nowrap';

/** Pastilles vérifiées sur l'ODS 8 + définition (si disponible). */
export const VerbInfo: React.FC<{ word: string; details?: string; clampDefinition?: boolean }> = ({
  word,
  details = '',
  clampDefinition = true,
}) => {
  const f = getVerbFacts(word, details);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-1 notranslate" translate="no">
        {f.participle &&
          (f.participle.valid ? (
            <span className={`${chip} bg-emerald-50 text-emerald-800 border-emerald-200`}>✓ {f.participle.form}</span>
          ) : (
            <span className={`${chip} bg-rose-50 text-rose-700 border-rose-200`}>
              ✗ <span className="line-through decoration-rose-400/70">{f.participle.form}</span>
            </span>
          ))}
        {f.infinitiveOnly && (
          <span className={`${chip} bg-amber-50 text-amber-900 border-amber-300`}>Infinitif seul</span>
        )}
        {f.missingTenses.length > 0 && (
          <span className={`${chip} bg-amber-50 text-amber-900 border-amber-300 whitespace-normal`}>
            Pas de {f.missingTenses.join(', ')}
          </span>
        )}
        {f.flaggedDefective && <span className={`${chip} bg-amber-50 text-amber-900 border-amber-300`}>Défectif</span>}
        {f.thirdPersonOnly && (
          <span className={`${chip} bg-sky-50 text-sky-800 border-sky-200`}>3ᵉ pers. seulement</span>
        )}
        {f.pronominal && <span className={`${chip} bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200`}>pronominal</span>}
        {f.frontHooks && (
          <span className={`${chip} bg-white text-slate-600 border-slate-300 font-mono tracking-tight`}>
            {f.frontHooks.split('').join('·')} +
          </span>
        )}
        {f.backHooks && (
          <span className={`${chip} bg-white text-slate-600 border-slate-300 font-mono tracking-tight`}>
            + {f.backHooks.split('').join('·')}
          </span>
        )}
      </div>
      {f.definition && (
        <p className={`mt-1 text-[11px] sm:text-xs text-slate-500 leading-snug ${clampDefinition ? 'line-clamp-2' : ''}`}>
          {f.definition}
        </p>
      )}
    </div>
  );
};

const LEGEND: { sample: React.ReactNode; className: string; text: React.ReactNode }[] = [
  {
    sample: '✓ FELEE',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    text: (
      <>
        <strong className="text-slate-800">Forme en -EE jouable</strong> : FELEE est valide au Scrabble.
      </>
    ),
  },
  {
    sample: (
      <>
        ✗ <span className="line-through decoration-rose-400/70">FLUEE</span>
      </>
    ),
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    text: (
      <>
        <strong className="text-slate-800">Piège</strong> : participe invariable, FLUE est valide mais pas FLUEE.
      </>
    ),
  },
  {
    sample: 'Pas de futur',
    className: 'bg-amber-50 text-amber-900 border-amber-300',
    text: (
      <>
        <strong className="text-slate-800">Verbe défectif</strong> : les temps cités n'existent pas (ESTER : infinitif seul).
      </>
    ),
  },
  {
    sample: '3ᵉ pers. seulement',
    className: 'bg-sky-50 text-sky-800 border-sky-200',
    text: (
      <>
        <strong className="text-slate-800">Impersonnel</strong> : NEIGE, NEIGERA… mais pas NEIGEONS.
      </>
    ),
  },
  {
    sample: 'D·R·T +',
    className: 'bg-white text-slate-600 border-slate-300 font-mono',
    text: (
      <>
        <strong className="text-slate-800">Rallonges avant</strong> : D+ENTER, R+ENTER, T+ENTER.
      </>
    ),
  },
  {
    sample: '+ A',
    className: 'bg-white text-slate-600 border-slate-300 font-mono',
    text: (
      <>
        <strong className="text-slate-800">Rallonges arrière</strong> : ENTER+A. Si le +A manque (JETER), JETERA est un piège.
      </>
    ),
  },
];

export const VerbLegend: React.FC<{ className?: string }> = ({ className = '' }) => (
  <details className={`group rounded-xl border border-slate-200 bg-slate-50/70 text-xs ${className}`}>
    <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-2 px-3 py-2.5 font-bold text-slate-600 hover:text-slate-900">
      <span>Comment lire les pastilles</span>
      <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
    </summary>
    <ul className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-slate-600">
      {LEGEND.map(({ sample, className: cls, text }, i) => (
        <li key={i} className="flex items-start gap-2 leading-snug">
          <span translate="no" className={`${chip} notranslate shrink-0 mt-px ${cls}`}>
            {sample}
          </span>
          <span>{text}</span>
        </li>
      ))}
      <li className="sm:col-span-2 text-[11px] text-slate-400 pt-1">
        Tout est vérifié automatiquement sur la liste officielle de l'ODS 8.
      </li>
    </ul>
  </details>
);
