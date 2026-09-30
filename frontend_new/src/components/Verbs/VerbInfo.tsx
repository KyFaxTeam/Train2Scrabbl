import React from 'react';
import { ArrowRight } from 'lucide-react';
import { CHIP, TONE, getVerbFacts } from './verbFacts';

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
        {f.nature && (
          <span className={`${CHIP} ${f.nature === 'vi' ? TONE.vi : TONE.vt}`}>{f.nature}</span>
        )}
        {f.participle &&
          (f.participle.valid ? (
            <span className={`${CHIP} ${TONE.ok}`}>✓ {f.participle.form}</span>
          ) : (
            <span className={`${CHIP} ${TONE.trap}`}>
              ✗ <span className="line-through decoration-rose-400/70">{f.participle.form}</span>
            </span>
          ))}
        {f.infinitiveOnly && <span className={`${CHIP} ${TONE.defective}`}>Infinitif seul</span>}
        {f.missingTenses.length > 0 && (
          <span className={`${CHIP} ${TONE.defective} whitespace-normal`}>Pas de {f.missingTenses.join(', ')}</span>
        )}
        {f.flaggedDefective && <span className={`${CHIP} ${TONE.defective}`}>Défectif</span>}
        {f.thirdPersonOnly && <span className={`${CHIP} ${TONE.impersonal}`}>3ᵉ pers. seulement</span>}
        {f.pronominal && <span className={`${CHIP} ${TONE.pronominal}`}>pronominal</span>}
        {f.frontHooks && <span className={`${CHIP} ${TONE.hook}`}>{f.frontHooks.split('').join('·')} +</span>}
        {f.backHooks && <span className={`${CHIP} ${TONE.hook}`}>+ {f.backHooks.split('').join('·')}</span>}
      </div>
      {f.definition && (
        <p className={`mt-1 text-[11px] sm:text-xs text-slate-500 leading-snug ${clampDefinition ? 'line-clamp-2' : ''}`}>
          {f.definition}
        </p>
      )}
    </div>
  );
};

/** Aide-mémoire compact au-dessus des listes ; le détail est dans l'onglet Guide. */
export const VerbLegend: React.FC<{ className?: string; onOpenGuide?: () => void }> = ({
  className = '',
  onOpenGuide,
}) => (
  <div
    className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-[11px] text-slate-600 ${className}`}
  >
    <span className="flex items-center gap-1.5 notranslate" translate="no">
      <span className={`${CHIP} ${TONE.vt}`}>vt</span> transitif
    </span>
    <span className="flex items-center gap-1.5 notranslate" translate="no">
      <span className={`${CHIP} ${TONE.vi}`}>vi</span> intransitif
    </span>
    <span className="flex items-center gap-1.5 notranslate" translate="no">
      <span className={`${CHIP} ${TONE.ok}`}>✓ FELEE</span> jouable
    </span>
    <span className="flex items-center gap-1.5 notranslate" translate="no">
      <span className={`${CHIP} ${TONE.trap}`}>
        ✗ <span className="line-through decoration-rose-400/70">FLUEE</span>
      </span>
      piège
    </span>
    <span className="flex items-center gap-1.5 notranslate" translate="no">
      <span className={`${CHIP} ${TONE.hook}`}>+ A</span> rallonge
    </span>
    {onOpenGuide && (
      <button
        onClick={onOpenGuide}
        className="ml-auto inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900 py-1"
      >
        Toutes les marques <ArrowRight className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);
