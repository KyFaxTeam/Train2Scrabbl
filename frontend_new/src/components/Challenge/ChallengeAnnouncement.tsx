import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy } from 'lucide-react';
import { firebaseVerbsService } from '../../services/firebaseVerbsService';
import { CHALLENGE_START_MS, CHALLENGE_LOTS } from '../../services/challengeService';
import { playFanfare } from '../../utils/ceremonySound';
import { markPosterSeen, storedPlayerName } from './challengeFlags';
import { CountdownBlocks, PrizeCards, ChallengeRules } from './challengeUi';
import { useChallenge, useReached, START_LABEL } from './useChallenge';

/**
 * Affiche du Challenge 125 : plein écran, une seule fois par appareil, sur n'importe quelle page.
 * Pas montrée aux inscrits, ni une fois qu'un gagnant est connu.
 */
const ChallengeAnnouncement: React.FC = () => {
  const navigate = useNavigate();
  const { loaded, rows, winner } = useChallenge();
  const started = useReached(CHALLENGE_START_MS);
  const [dismissed, setDismissed] = useState(false);
  const [mySlug] = useState(() => {
    const name = storedPlayerName();
    return name ? firebaseVerbsService.slugify(name) : '';
  });
  const isMember = mySlug !== '' && rows.some((r) => r.slug === mySlug);
  const open = loaded && !isMember && !winner && !dismissed;

  // Déjà inscrit sur cet appareil : l'affiche ne reviendra plus
  useEffect(() => {
    if (isMember) markPosterSeen();
  }, [isMember]);

  const close = () => {
    markPosterSeen();
    setDismissed(true);
  };

  useEffect(() => {
    if (!open) return;
    const colors = ['#fbbf24', '#f59e0b', '#fde68a', '#fef3c7', '#10b981'];
    const fire = (opts: confetti.Options) => confetti({ zIndex: 250, colors, disableForReducedMotion: true, ...opts });
    const timers = [
      setTimeout(() => fire({ particleCount: 140, spread: 100, startVelocity: 45, origin: { y: 0.35 } }), 500),
      setTimeout(() => {
        fire({ particleCount: 70, angle: 60, spread: 60, startVelocity: 55, origin: { x: 0, y: 0.8 } });
        fire({ particleCount: 70, angle: 120, spread: 60, startVelocity: 55, origin: { x: 1, y: 0.8 } });
      }, 1000),
    ];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const accept = () => {
    playFanfare();
    close();
    navigate('/verbs', { state: { joinChallenge: true } });
  };

  const others = rows.slice(0, 3).map((r) => r.displayName);
  const moreCount = rows.length - others.length;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="challenge-poster"
          role="dialog"
          aria-modal="true"
          aria-label="Challenge 125"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] overflow-y-auto bg-slate-950/95 backdrop-blur-md"
        >
          {/* Halo & rayons tournants */}
          <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden flex items-center justify-center">
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(circle at 50% 30%, rgba(251,191,36,0.30), rgba(16,185,129,0.06) 40%, transparent 68%)' }}
            />
            <motion.div
              className="w-[140vmax] h-[140vmax] shrink-0 rounded-full"
              style={{
                background: 'repeating-conic-gradient(from 0deg, rgba(251,191,36,0.12) 0deg 7deg, transparent 7deg 22deg)',
                maskImage: 'radial-gradient(circle, black 10%, transparent 55%)',
                WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 55%)',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          <div className="relative min-h-full flex items-center justify-center px-4 py-8">
            <motion.div
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 170, damping: 18 }}
              className="w-full max-w-sm text-center"
            >
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-amber-300/90">Le club Faizers présente</p>

              <motion.div
                className="relative mx-auto mt-4 w-20 h-20 sm:w-24 sm:h-24"
                initial={{ rotate: -20, scale: 0.4 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.25 }}
              >
                <div aria-hidden className="absolute inset-0 rounded-full bg-amber-400/50 blur-2xl" />
                <div className="relative w-full h-full rounded-full bg-gradient-to-br from-amber-100 via-amber-400 to-amber-600 border-4 border-amber-200/80 shadow-[0_0_60px_rgba(251,191,36,0.55)] flex items-center justify-center">
                  <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-amber-950" strokeWidth={2.4} />
                </div>
              </motion.div>

              <h2 className="mt-4 text-4xl sm:text-5xl font-black tracking-tight leading-none bg-gradient-to-r from-amber-200 via-yellow-50 to-amber-300 bg-clip-text text-transparent">
                CHALLENGE {CHALLENGE_LOTS}
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {CHALLENGE_LOTS} lots de verbes · 30/30 à chaque lot · le premier l'emporte
              </p>

              <div className="mt-5">
                <PrizeCards />
              </div>

              <div className="mt-5">
                {started ? (
                  <p className="text-sm font-black text-emerald-300">C'est parti depuis {START_LABEL} !</p>
                ) : (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Départ {START_LABEL}</p>
                    <CountdownBlocks target={CHALLENGE_START_MS} />
                  </>
                )}
              </div>

              <div className="mt-5 rounded-2xl bg-white/[0.04] border border-white/10 p-3.5">
                <ChallengeRules />
              </div>

              {rows.length > 0 && (
                <p className="mt-4 text-xs text-slate-300">
                  <strong translate="no" className="notranslate text-white">{others.join(', ')}</strong>
                  {moreCount > 0 ? ` et ${moreCount} autre${moreCount > 1 ? 's' : ''}` : ''}{' '}
                  {rows.length > 1 ? 'sont déjà inscrits' : 'est déjà inscrit'}.
                </p>
              )}

              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={accept}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-base text-amber-950 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 hover:from-amber-400 hover:to-amber-500 shadow-[0_10px_40px_-8px_rgba(251,191,36,0.7)] border border-amber-100 transition"
                >
                  <Trophy className="w-5 h-5 shrink-0" />
                  Je relève le défi
                </button>
                <button onClick={close} className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition py-1.5">
                  Plus tard
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ChallengeAnnouncement;
