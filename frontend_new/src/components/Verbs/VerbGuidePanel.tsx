import React, { useState } from 'react';
import {
  GraduationCap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CloudRain,
  Plus,
  Repeat,
  BookMarked,
  ChevronDown,
  Search,
} from 'lucide-react';
import { MASTER_VERBS_DB } from '../../data/masterVerbsDb';
import { CHIP, TONE, getVerbFacts, type VerbFacts } from './verbFacts';
import { VerbInfo } from './VerbInfo';

// ============================================================
// Données du guide, calculées une fois depuis la base de verbes
// ============================================================
interface GuideVerb {
  word: string;
  details: string;
  facts: VerbFacts;
}

const ALL: GuideVerb[] = MASTER_VERBS_DB.map((v) => ({
  word: v.word,
  details: v.details,
  facts: getVerbFacts(v.word, v.details),
}));
const byWord = (a: GuideVerb, b: GuideVerb) => a.word.length - b.word.length || a.word.localeCompare(b.word);

const TRAPS = ALL.filter((v) => v.facts.participle && !v.facts.participle.valid).sort(byWord);
const PLAYABLE = ALL.filter((v) => v.facts.participle?.valid);
const INFINITIVE_ONLY = ALL.filter((v) => v.facts.infinitiveOnly).sort(byWord);
const DEFECTIVE = ALL.filter(
  (v) => !v.facts.infinitiveOnly && (v.facts.missingTenses.length > 0 || v.facts.flaggedDefective)
).sort(byWord);
const THIRD_PERSON = ALL.filter((v) => v.facts.thirdPersonOnly).sort(byWord);
const PRONOMINAL = ALL.filter((v) => v.facts.pronominal).sort(byWord);
const NO_A = ALL.filter(
  (v) => v.word.endsWith('ER') && !v.facts.backHooks.includes('A') && !v.facts.infinitiveOnly && v.facts.participle
).sort(byWord);
const WITH_FRONT = ALL.filter((v) => v.facts.frontHooks).length;

// ============================================================
// Petits éléments visuels
// ============================================================
const Tiles: React.FC<{ word: string; tone?: 'ok' | 'trap' | 'plain'; strike?: boolean }> = ({
  word,
  tone = 'plain',
  strike,
}) => {
  const color =
    tone === 'ok'
      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
      : tone === 'trap'
        ? 'bg-rose-50 border-rose-300 text-rose-800'
        : 'bg-amber-50 border-amber-300 text-amber-950';
  return (
    <span translate="no" className={`notranslate relative inline-flex gap-[3px] ${strike ? 'opacity-90' : ''}`}>
      {strike && <span aria-hidden className="absolute left-[-3px] right-[-3px] top-1/2 h-[2px] -translate-y-1/2 bg-rose-500 rounded-full rotate-[-4deg]" />}
      {word.split('').map((l, i) => (
        <span
          key={i}
          className={`w-6 h-7 sm:w-7 sm:h-8 rounded-[5px] border-b-2 border flex items-center justify-center text-xs sm:text-sm font-black ${color}`}
        >
          {l}
        </span>
      ))}
    </span>
  );
};

const WordCloud: React.FC<{
  verbs: GuideVerb[];
  onOpenVerb: (word: string) => void;
  initial?: number;
  label: (v: GuideVerb) => string;
  tone: string;
}> = ({ verbs, onOpenVerb, initial = 18, label, tone }) => {
  const [open, setOpen] = useState(false);
  const shown = open ? verbs : verbs.slice(0, initial);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 notranslate" translate="no">
        {shown.map((v) => (
          <button
            key={v.word}
            onClick={() => onOpenVerb(v.word)}
            className={`${CHIP} ${tone} py-1.5 px-2 text-[11px] hover:brightness-95 active:scale-95 transition`}
          >
            {label(v)}
          </button>
        ))}
      </div>
      {verbs.length > initial && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 py-1"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          {open ? 'Réduire' : `Voir les ${verbs.length} verbes`}
        </button>
      )}
    </div>
  );
};

const Section: React.FC<{
  id: string;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}> = ({ id, icon, iconClass, title, lead, children }) => (
  <section id={id} className="scroll-mt-36 bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-7">
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 ${iconClass}`}>{icon}</div>
      <div className="min-w-0">
        <h3 className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-snug">{lead}</p>
      </div>
    </div>
    <div className="mt-4 space-y-4 text-[13px] sm:text-sm text-slate-700 leading-relaxed">{children}</div>
  </section>
);

const Example: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex flex-wrap items-center gap-x-3 gap-y-2">{children}</div>
);

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs sm:text-[13px] text-amber-950 leading-snug">
    {children}
  </p>
);

// ============================================================
// Mini-quiz « Jouable ou piège ? »
// ============================================================
interface Question {
  word: string;
  form: string;
  valid: boolean;
}

function pickQuestion(previous?: string): Question {
  const pool = Math.random() < 0.5 ? TRAPS : PLAYABLE;
  let v = pool[Math.floor(Math.random() * pool.length)];
  if (v.word === previous) v = pool[(pool.indexOf(v) + 1) % pool.length];
  return { word: v.word, form: v.facts.participle!.form, valid: v.facts.participle!.valid };
}

// PUER est souvent donné intransitif, pourtant PUEE est valide : bonne première question
const FIRST_QUESTION: Question = { word: 'PUER', form: 'PUEE', valid: true };

const TrapQuiz: React.FC = () => {
  const [q, setQ] = useState<Question>(FIRST_QUESTION);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [score, setScore] = useState({ good: 0, total: 0, streak: 0 });

  const answered = answer !== null;
  const correct = answered && answer === q.valid;

  const choose = (saysValid: boolean) => {
    if (answered) return;
    const ok = saysValid === q.valid;
    setAnswer(saysValid);
    setScore((s) => ({ good: s.good + (ok ? 1 : 0), total: s.total + 1, streak: ok ? s.streak + 1 : 0 }));
  };
  const next = () => {
    setQ(pickQuestion(q.word));
    setAnswer(null);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-amber-300">
          Entraîne-toi : jouable ou piège ?
        </span>
        <span className="text-[11px] font-bold text-slate-300 tabular-nums">
          {score.total > 0 ? `${score.good}/${score.total}` : ''}
          {score.streak >= 3 && <span className="ml-1.5 text-amber-300">🔥 {score.streak}</span>}
        </span>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <Tiles word={q.form} tone={answered ? (q.valid ? 'ok' : 'trap') : 'plain'} strike={answered && !q.valid} />
        <p className="text-[11px] text-slate-400">
          forme en -EE du verbe <strong className="text-slate-200 notranslate" translate="no">{q.word}</strong>
        </p>
      </div>

      {!answered ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => choose(true)}
            className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] font-black text-sm flex items-center justify-center gap-1.5 transition"
          >
            <CheckCircle2 className="w-4 h-4" /> Jouable
          </button>
          <button
            onClick={() => choose(false)}
            className="h-12 rounded-xl bg-rose-500 hover:bg-rose-400 active:scale-[0.98] font-black text-sm flex items-center justify-center gap-1.5 transition"
          >
            <XCircle className="w-4 h-4" /> Piège
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          <p
            className={`rounded-xl px-3 py-2.5 text-xs sm:text-sm leading-snug ${
              correct ? 'bg-emerald-500/15 text-emerald-100' : 'bg-rose-500/15 text-rose-100'
            }`}
          >
            <strong>{correct ? 'Exact !' : 'Raté.'}</strong>{' '}
            <span translate="no" className="notranslate">
              {q.valid
                ? `${q.form} est valide : ${q.word} accepte un participe féminin.`
                : `${q.form} n'existe pas : le participe de ${q.word} est invariable (${q.form.slice(0, -1)} seulement).`}
            </span>
          </p>
          <button
            onClick={next}
            className="w-full h-11 rounded-xl bg-white text-slate-900 font-black text-sm hover:bg-slate-100 active:scale-[0.99] transition"
          >
            Question suivante →
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Panneau principal
// ============================================================
const TOC = [
  { id: 'guide-carte', label: 'Lire une carte' },
  { id: 'guide-ee', label: 'Le piège -EE' },
  { id: 'guide-rallonges', label: 'Rallonges' },
  { id: 'guide-defectifs', label: 'Défectifs' },
  { id: 'guide-impersonnels', label: '3ᵉ personne' },
  { id: 'guide-pronominaux', label: 'Pronominaux' },
  { id: 'guide-notations', label: 'vt, vi, déf.…' },
];

const GLOSSARY: { term: string; name: string; meaning: string; app: React.ReactNode }[] = [
  {
    term: 'vt',
    name: 'Transitif direct',
    meaning: 'Le verbe a un complément d\'objet (fêler un vase). Le participe s\'accorde : FELEE, FELEES.',
    app: (
      <>
        <span className={`${CHIP} ${TONE.vt}`}>vt</span>
        <span className={`${CHIP} ${TONE.ok}`}>✓ FELEE</span>
      </>
    ),
  },
  {
    term: 'vi',
    name: 'Intransitif',
    meaning:
      'Pas de complément d\'objet (fluer). Le participe reste en général invariable : FLUE mais pas FLUEE. Attention, certains vi ont aussi un emploi transitif (PUER : PUEE est valide).',
    app: (
      <>
        <span className={`${CHIP} ${TONE.vi}`}>vi</span>
        <span className={`${CHIP} ${TONE.trap}`}>
          ✗ <span className="line-through">FLUEE</span>
        </span>
      </>
    ),
  },
  {
    term: 'vt/vi',
    name: 'Transitif et intransitif',
    meaning: 'Les deux emplois existent, donc le participe féminin est jouable.',
    app: (
      <>
        <span className={`${CHIP} ${TONE.vt}`}>vt, vi</span>
        <span className={`${CHIP} ${TONE.ok}`}>✓ PUEE</span>
      </>
    ),
  },
  {
    term: 'vpr',
    name: 'Pronominal',
    meaning: 'Se conjugue avec « se » (s\'évanouir). Le participe s\'accorde : elle s\'est évanouie.',
    app: <span className={`${CHIP} ${TONE.pronominal}`}>pronominal</span>,
  },
  {
    term: 'v. impers.',
    name: 'Impersonnel',
    meaning: 'Ne se conjugue qu\'à la 3ᵉ personne du singulier : il neige, il neigera.',
    app: <span className={`${CHIP} ${TONE.impersonal}`}>3ᵉ pers. seulement</span>,
  },
  {
    term: 'déf.',
    name: 'Défectif',
    meaning: 'Il manque des temps ou des personnes (TRAIRE n\'a pas de passé simple).',
    app: <span className={`${CHIP} ${TONE.defective}`}>Pas de passé simple</span>,
  },
  {
    term: 'inf.',
    name: 'Infinitif seul',
    meaning: 'Seul l\'infinitif existe : ESTER, QUERIR, COURRE. Aucune forme conjuguée n\'est jouable.',
    app: <span className={`${CHIP} ${TONE.defective}`}>Infinitif seul</span>,
  },
];

export const VerbGuidePanel: React.FC<{ onOpenVerb: (word: string) => void }> = ({ onOpenVerb }) => {
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-950 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
          <span className="text-amber-300 text-[10px] sm:text-xs font-black tracking-widest uppercase">Guide des marques</span>
        </div>
        <h2 className="text-xl sm:text-3xl font-black leading-tight">Chaque pastille évite un mot refusé.</h2>
        <p className="text-emerald-100/90 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          Connaître un verbe ne suffit pas au Scrabble : il faut savoir quelles formes sont jouables. Les pastilles le
          disent en un coup d'œil, vérifiées sur la liste officielle de l'ODS 8.
        </p>
        <div className="grid grid-cols-3 gap-2 mt-4 sm:mt-5">
          {[
            { n: TRAPS.length, l: 'pièges en -EE' },
            { n: INFINITIVE_ONLY.length + DEFECTIVE.length + THIRD_PERSON.length, l: 'verbes incomplets' },
            { n: NO_A.length, l: 'verbes -ER sans +A' },
          ].map((s) => (
            <div key={s.l} className="rounded-xl bg-white/10 border border-white/10 px-2 py-2.5 text-center">
              <p className="text-lg sm:text-2xl font-black tabular-nums leading-none">{s.n}</p>
              <p className="text-[10px] sm:text-xs text-emerald-100/80 font-semibold mt-1 leading-tight">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sommaire */}
      <nav className="-mx-1 px-1 flex gap-1.5 overflow-x-auto no-scrollbar scrollbar-none pb-1" aria-label="Sommaire du guide">
        {TOC.map((t) => (
          <button
            key={t.id}
            onClick={() => jump(t.id)}
            className="shrink-0 px-3 py-2 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 transition"
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* 1. Lire une carte */}
      <Section
        id="guide-carte"
        icon={<Search className="w-5 h-5" />}
        iconClass="bg-slate-100 text-slate-700"
        title="Lire une carte verbe"
        lead="Toutes les pastilles d'une carte, dans l'ordre où elles apparaissent."
      >
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-3 sm:p-4 max-w-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-black text-slate-900 tracking-wide text-base notranslate" translate="no">
              ENTER
            </span>
            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md">5L</span>
          </div>
          <VerbInfo word="ENTER" details="Greffer." />
        </div>
        <ol className="space-y-2.5">
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
            <span>
              <span className={`${CHIP} ${TONE.vt} mr-1`}>vt</span> la nature : <strong>vt</strong> transitif,{' '}
              <strong>vi</strong> intransitif, <strong>vt, vi</strong> les deux (détail en bas de page).
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
            <span>
              <span className={`${CHIP} ${TONE.ok} mr-1`}>✓ ENTEE</span> la forme en -EE est jouable (ENTEE, ENTEES).
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
            <span>
              <span className={`${CHIP} ${TONE.hook} mr-1`}>D·R·T·V +</span> lettres à placer <strong>devant</strong> : DENTER,
              RENTER, TENTER, VENTER.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">4</span>
            <span>
              <span className={`${CHIP} ${TONE.hook} mr-1`}>+ A</span> lettre à placer <strong>derrière</strong> : ENTERA.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">5</span>
            <span>La définition, quand elle est connue.</span>
          </li>
        </ol>
        <Tip>
          Une pastille absente est aussi une information. JETER n'a pas de <strong>+ A</strong> : JETERA est refusé (on écrit
          JETTERA).
        </Tip>
      </Section>

      {/* 2. Le piège -EE */}
      <Section
        id="guide-ee"
        icon={<XCircle className="w-5 h-5" />}
        iconClass="bg-rose-50 text-rose-600"
        title="Le piège de la forme en -EE"
        lead={`Le plus rentable à connaître : ${plural(TRAPS.length, 'verbe')} ont un participe invariable.`}
      >
        <p>
          Quand un verbe a un complément d'objet, son participe s'accorde au féminin : on a <em>fêlé</em> une tasse, la tasse
          est <em>fêlée</em>. Quand il n'en a pas, le participe ne change jamais : le liquide a <em>flué</em>, jamais
          « fluée ».
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Example>
            <Tiles word="FELEE" tone="ok" />
            <span className={`${CHIP} ${TONE.ok}`}>✓ FELEE</span>
            <span className="text-xs text-slate-500 basis-full">Jouable, FELEES aussi.</span>
          </Example>
          <Example>
            <Tiles word="FLUEE" tone="trap" strike />
            <span className={`${CHIP} ${TONE.trap}`}>
              ✗ <span className="line-through">FLUEE</span>
            </span>
            <span className="text-xs text-slate-500 basis-full">Refusé. Seul FLUE est valide.</span>
          </Example>
        </div>
        <TrapQuiz />
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Les verbes à participe invariable</p>
          <WordCloud verbs={TRAPS} onOpenVerb={onOpenVerb} tone={TONE.trap} label={(v) => v.word} initial={24} />
        </div>
      </Section>

      {/* 3. Rallonges */}
      <Section
        id="guide-rallonges"
        icon={<Plus className="w-5 h-5" />}
        iconClass="bg-slate-100 text-slate-700"
        title="Les rallonges"
        lead={`Une lettre ajoutée devant ou derrière donne un autre mot valide. ${WITH_FRONT} verbes ont une rallonge avant.`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Example>
            <span className={`${CHIP} ${TONE.hook}`}>D·R·T·V +</span>
            <span className="text-xs">
              <strong>Avant</strong> : <span className="notranslate" translate="no">D+ENTER = DENTER</span>
            </span>
          </Example>
          <Example>
            <span className={`${CHIP} ${TONE.hook}`}>+ A</span>
            <span className="text-xs">
              <strong>Arrière</strong> : <span className="notranslate" translate="no">ENTER+A = ENTERA</span>
            </span>
          </Example>
        </div>
        <p>
          Presque tous les verbes en -ER prennent <strong>+ A</strong> (futur : il fêlera). Ceux qui ne le prennent pas
          changent de radical au futur (JETTERA, NOIERA, IRA) : ce sont des pièges classiques.
        </p>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Verbes en -ER sans + A</p>
          <WordCloud verbs={NO_A} onOpenVerb={onOpenVerb} tone={TONE.hook} label={(v) => v.word} />
        </div>
      </Section>

      {/* 4. Défectifs */}
      <Section
        id="guide-defectifs"
        icon={<AlertTriangle className="w-5 h-5" />}
        iconClass="bg-amber-50 text-amber-600"
        title="Les verbes défectifs"
        lead="Des temps ou des personnes n'existent pas. Poser une forme absente, c'est un mot refusé."
      >
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
            <span className={`${CHIP} ${TONE.defective} mr-1.5 normal-case tracking-normal`}>Infinitif seul</span>
            aucune forme conjuguée
          </p>
          <WordCloud verbs={INFINITIVE_ONLY} onOpenVerb={onOpenVerb} tone={TONE.defective} label={(v) => v.word} />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Conjugaison incomplète</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DEFECTIVE.map((v) => (
              <li key={v.word}>
                <button
                  onClick={() => onOpenVerb(v.word)}
                  className="w-full text-left rounded-xl bg-slate-50 hover:bg-amber-50/60 border border-slate-100 p-2.5 transition"
                >
                  <span className="font-black text-slate-900 text-sm notranslate" translate="no">
                    {v.word}
                  </span>
                  <div className="mt-1">
                    <VerbInfo word={v.word} details={v.details} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 5. 3e personne */}
      <Section
        id="guide-impersonnels"
        icon={<CloudRain className="w-5 h-5" />}
        iconClass="bg-sky-50 text-sky-600"
        title="3ᵉ personne seulement"
        lead="Surtout la météo : il neige, il bruine. Pas de je, tu, nous ni vous."
      >
        <Example>
          <Tiles word="NEIGERA" tone="ok" />
          <Tiles word="NEIGEONS" tone="trap" strike />
        </Example>
        <WordCloud verbs={THIRD_PERSON} onOpenVerb={onOpenVerb} tone={TONE.impersonal} label={(v) => v.word} initial={30} />
      </Section>

      {/* 6. Pronominaux */}
      <Section
        id="guide-pronominaux"
        icon={<Repeat className="w-5 h-5" />}
        iconClass="bg-fuchsia-50 text-fuchsia-600"
        title="Les verbes pronominaux"
        lead="Ils se conjuguent avec « se » : s'évanouir, s'enquérir."
      >
        <p>
          Leur participe s'accorde avec le sujet (elle s'est évanouie) : la forme féminine est donc en général jouable, même
          sans complément d'objet.
        </p>
        <WordCloud verbs={PRONOMINAL} onOpenVerb={onOpenVerb} tone={TONE.pronominal} label={(v) => v.word} />
      </Section>

      {/* 7. Notations du dictionnaire */}
      <Section
        id="guide-notations"
        icon={<BookMarked className="w-5 h-5" />}
        iconClass="bg-indigo-50 text-indigo-600"
        title="Les abréviations du dictionnaire"
        lead="Celles que tu croises dans l'ODS ou sur les sites de Scrabble, et leur pastille dans l'appli."
      >
        <ul className="divide-y divide-slate-100 -my-1">
          {GLOSSARY.map((g) => (
            <li key={g.term} className="py-3 flex items-start gap-3">
              <span className="w-16 sm:w-20 shrink-0 font-mono font-black text-indigo-700 text-sm pt-0.5">{g.term}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 text-sm">{g.name}</p>
                <p className="text-xs sm:text-[13px] text-slate-600 leading-snug mt-0.5">{g.meaning}</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400 notranslate" translate="no">
                  Dans l'appli : {g.app}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-400">
          Les pastilles sont vérifiées sur la liste officielle de l'ODS 8. Quelques verbes récents (ajouts de l'ODS 9) n'y
          figurent pas encore et n'ont pas de pastille.
        </p>
      </Section>
    </div>
  );
};
