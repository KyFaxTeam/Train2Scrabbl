import { Lexicon } from './models/Lexicon';
import { WordPool } from './services/WordPool';
import { MoveChecker, type PlacedTile } from './services/MoveChecker';
import { NaturalFlow } from './modules/NaturalFlow';

let lexicon: Lexicon | null = null;
let wordPool: WordPool | null = null;

/**
 * Cache local des donnees du moteur.
 *
 * GitHub Pages impose `max-age=600` sur tous ses fichiers et ne laisse aucun
 * moyen de changer cet en-tete : passe dix minutes, le navigateur revalide. On
 * range donc le lexique nous-memes dans le Cache Storage, ou il reste jusqu'a
 * un changement de version - la deuxieme visite ne touche plus au reseau, et le
 * mode reste jouable hors ligne.
 *
 * v2 : la v1 contenait gaddag.bin (5,74 Mo). Elle est effacee a l'init, sinon
 * ces 5,74 Mo resteraient sur l'appareil des joueurs pour toujours.
 */
const CACHE_NAME = 'engine-assets-v2';
const STALE_CACHES = ['engine-assets-v1'];

async function fetchWithCache(url: string, onProgress?: (received: number, total: number) => void) {
    const cache = 'caches' in self ? await caches.open(CACHE_NAME) : null;

    if (cache) {
        const hit = await cache.match(url);
        if (hit) return hit.text();
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Telechargement de ${url} impossible (HTTP ${response.status})`);
    }

    // On lit le flux nous-memes pour pouvoir annoncer la progression : sans
    // cela l'ecran affiche "Chargement..." sans que rien ne distingue un
    // telechargement lent d'un plantage.
    const total = Number(response.headers.get('content-length')) || 0;
    if (!onProgress || !response.body) {
        const text = await response.text();
        if (cache) await cache.put(url, new Response(text));
        return text;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onProgress(received, total);
    }

    const buffer = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
    }

    const text = new TextDecoder().decode(buffer);
    if (cache) await cache.put(url, new Response(text));
    return text;
}

async function purgerAnciensCaches() {
    if (!('caches' in self)) return;
    try {
        for (const name of STALE_CACHES) await caches.delete(name);
    } catch {
        // Un cache qu'on n'arrive pas a effacer ne doit pas empecher de jouer.
    }
}

async function initialiser() {
    if (lexicon && wordPool) return { mots: lexicon.size, cache: true };

    const baseUrl = import.meta.env.BASE_URL || '/';
    void purgerAnciensCaches();

    // lexicon.txt (236 Ko gzip) et non plus gaddag.bin (3,23 Mo transferes,
    // ~18 s) : hors MoveGenerator - casse et supprime - la seule operation que
    // le moteur demandait au GADDAG etait un test d'appartenance.
    // Voir scripts/export_lexicon.py.
    const text = await fetchWithCache(
        `${baseUrl}data/lexicon.txt`,
        (received, total) => self.postMessage({
            type: 'INIT_PROGRESS',
            payload: { step: 'lexique', received, total },
        })
    );

    self.postMessage({ type: 'INIT_PROGRESS', payload: { step: 'lexique', received: 1, total: 1 } });

    lexicon = Lexicon.fromFrontCoded(text);
    wordPool = new WordPool(lexicon);

    return { mots: lexicon.size, cache: false };
}

self.onmessage = async (e: MessageEvent) => {
    const { type, payload, callId } = e.data;

    try {
        if (type === 'INIT') {
            const info = await initialiser();
            self.postMessage({ type: 'INIT_SUCCESS', payload: info });
            return;
        }

        if (!lexicon || !wordPool) throw new Error('Moteur non initialise');

        if (type === 'GENERATE_NATURAL_FLOW') {
            const { targetWord, pool, difficulty = 8 } = payload;
            const start = performance.now();

            const result = NaturalFlow.genererSituationNaturelle(
                targetWord,
                pool,
                lexicon,
                wordPool,
                {
                    profondeurRespiration: difficulty,
                    distributionMots: { court: 0.5, moyen: 0.35, long: 0.15 },
                    maxTentatives: 15,
                }
            );

            self.postMessage({
                type: 'GENERATE_SUCCESS',
                payload: result,
                callId,
                timeMs: performance.now() - start,
            });
            return;
        }

        if (type === 'RANDOM_TARGETS') {
            // Les mots a travailler se tirent dans le lexique deja charge.
            // Auparavant la page telechargeait scrabble_dict.txt (2,68 Mo bruts,
            // 757 Ko gzip) pour y piocher des scrabbles - or l'index de tirages
            // contient exactement 32 230 solutions de sept lettres, soit
            // exactement les 32 230 mots de sept lettres de l'ODS8. Le tirage
            // d'un mot, c'est ses lettres triees : le fichier n'apprenait rien
            // que le lexique ne sache deja.
            const { count = 5, length = 7 } = payload ?? {};
            const mots = lexicon.wordsByLength(length, length);
            const choisis: string[] = [];
            for (let i = 0; i < count && mots.length > 0; i++) {
                choisis.push(mots[Math.floor(Math.random() * mots.length)]);
            }
            self.postMessage({ type: 'TARGETS_SUCCESS', payload: choisis, callId });
            return;
        }

        if (type === 'CHECK_MOVE') {
            const { initialTiles, placedTiles, expectedWord, rack } = payload as {
                initialTiles: PlacedTile[];
                placedTiles: PlacedTile[];
                expectedWord: string;
                rack: string[];
            };

            const checker = new MoveChecker(lexicon, initialTiles);
            const verdict = checker.check(placedTiles);
            const meilleur = checker.findPlacements(expectedWord, rack)[0] ?? null;

            self.postMessage({
                type: 'CHECK_SUCCESS',
                payload: { verdict, meilleur },
                callId,
            });
            return;
        }

        throw new Error(`Message inconnu : ${type}`);
    } catch (err) {
        const message = err instanceof Error ? (err.stack || err.message) : String(err);
        self.postMessage({ type: 'ERROR', payload: message, callId });
    }
};
