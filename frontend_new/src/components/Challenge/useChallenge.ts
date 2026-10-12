import { useEffect, useMemo, useState } from 'react';
import {
  challengeService,
  rankChallenge,
  CHALLENGE_START_MS,
  CHALLENGE_BONUS_DEADLINE_MS,
  type ChallengeParticipant,
} from '../../services/challengeService';

/** Participants en direct et classement calculé. */
export function useChallenge() {
  const [participants, setParticipants] = useState<ChallengeParticipant[] | null>(null);
  useEffect(() => challengeService.subscribe(setParticipants), []);
  const ranking = useMemo(() => rankChallenge(participants ?? []), [participants]);
  return { loaded: participants !== null, ...ranking };
}

/** Heure du serveur, rafraîchie à l'intervalle donné (à n'utiliser que dans de petits composants). */
export function useServerNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => challengeService.now());
  useEffect(() => {
    const t = setInterval(() => setNow(challengeService.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Vrai une fois l'heure (serveur) `target` passée. Revérifie toutes les 10 s : l'écart avec
 * l'horloge du serveur n'est connu qu'après le premier rendu.
 */
export function useReached(target: number | null): boolean {
  const [reached, setReached] = useState(() => target !== null && challengeService.now() >= target);
  useEffect(() => {
    if (target === null) return;
    const check = () => challengeService.now() >= target;
    const t = setInterval(() => {
      if (check()) {
        setReached(true);
        clearInterval(t);
      }
    }, 10_000);
    const left = target - challengeService.now();
    const exact = left > 0 && left < 2_000_000_000 ? setTimeout(() => setReached(check()), left + 100) : undefined;
    return () => {
      clearInterval(t);
      if (exact) clearTimeout(exact);
    };
  }, [target]);
  return reached;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** « lundi 12 octobre à 20 h » (heure de l'appareil, celle du club). */
function dayLabel(ms: number): string {
  const d = new Date(ms);
  const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const m = d.getMinutes();
  return `${day} à ${d.getHours()} h${m ? pad2(m) : ''}`;
}

export const START_LABEL = dayLabel(CHALLENGE_START_MS);
/** « samedi 24 octobre à 20 h » : fin des 1 000 FCFA pour tous. */
export const BONUS_DEADLINE_LABEL = dayLabel(CHALLENGE_BONUS_DEADLINE_MS);

export function challengeDay(now: number): number {
  return Math.floor((now - CHALLENGE_START_MS) / 86_400_000) + 1;
}
