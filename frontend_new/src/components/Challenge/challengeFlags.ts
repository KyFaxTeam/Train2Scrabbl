// Mémoire de l'appareil pour l'affiche du Challenge 125. Ce module n'importe pas
// Firebase : le Layout peut le lire au démarrage sans alourdir le premier écran.

const POSTER_SEEN_KEY = 'faizers_c125_affiche_vue';

/** L'affiche n'apparaît qu'une fois par appareil ; ensuite, le bandeau de la page Verbes prend le relais. */
export function isPosterSeen(): boolean {
  try {
    return localStorage.getItem(POSTER_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPosterSeen() {
  try {
    localStorage.setItem(POSTER_SEEN_KEY, '1');
  } catch {
    // stockage indisponible (navigation privée) : l'affiche pourra revenir, sans gravité
  }
}

/** Pseudo mémorisé sur cet appareil par la page Verbes. */
export function storedPlayerName(): string {
  try {
    return (localStorage.getItem('faizers_verb_user') || '').trim();
  } catch {
    return '';
  }
}
