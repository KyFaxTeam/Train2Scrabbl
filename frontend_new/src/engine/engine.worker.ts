// @ts-nocheck

import { Gaddag } from './models/Gaddag';

import { WordPool } from './services/WordPool';
import { NaturalFlow } from './modules/NaturalFlow';

let gaddagInstance: Gaddag | null = null;
let wordPoolInstance: WordPool | null = null;

/**
 * Cache local du GADDAG.
 *
 * Le binaire fait 5,7 Mo (3,2 Mo transferes, gzip applique par GitHub Pages) et
 * mesure ~18 s a telecharger sur une connexion moyenne. GitHub Pages impose
 * `max-age=600` sur tous ses fichiers et ne laisse aucun moyen de changer cet
 * en-tete : passe dix minutes, le navigateur revalide. On le range donc
 * nous-memes dans le Cache Storage, ou il reste jusqu'a un changement de
 * version - la deuxieme visite ne touche plus au reseau.
 */
const CACHE_NAME = 'engine-assets-v1';

async function fetchWithCache(url: string, onProgress?: (received: number, total: number) => void) {
    const cache = 'caches' in self ? await caches.open(CACHE_NAME) : null;

    if (cache) {
        const hit = await cache.match(url);
        if (hit) return hit.arrayBuffer();
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Telechargement de ${url} impossible (HTTP ${response.status})`);
    }

    // On lit le flux nous-memes pour pouvoir annoncer la progression : sans
    // cela l'ecran affiche "Chargement..." pendant vingt secondes sans que rien
    // ne distingue un telechargement lent d'un plantage.
    const total = Number(response.headers.get('content-length')) || 0;
    if (!onProgress || !response.body) {
        const buffer = await response.arrayBuffer();
        if (cache) await cache.put(url, new Response(buffer));
        return buffer;
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

    if (cache) await cache.put(url, new Response(buffer));
    return buffer.buffer;
}

self.onmessage = async (e: MessageEvent) => {
    const { type, payload, callId } = e.data;

    try {
        if (type === 'INIT') {
            if (!gaddagInstance) {
                const baseUrl = import.meta.env.BASE_URL || '/';

                const gaddagBuffer = await fetchWithCache(
                    `${baseUrl}data/gaddag.bin`,
                    (received, total) => self.postMessage({
                        type: 'INIT_PROGRESS',
                        payload: { step: 'dictionnaire', received, total },
                    })
                );
                gaddagInstance = new Gaddag(gaddagBuffer);

                // word_pool.txt, et surtout PAS scrabble_dict.txt : ce dernier
                // est un index de tirages ("AEINOTU", "-AOUTIEN", "+Q ATONIQUE"),
                // dont aucune ligne ne fait 2 a 6 caracteres. Le vivier en
                // ressortait vide et le plateau d'entrainement restait nu.
                // Voir scripts/export_word_pool.py.
                const poolBuffer = await fetchWithCache(
                    `${baseUrl}data/word_pool.txt`,
                    (received, total) => self.postMessage({
                        type: 'INIT_PROGRESS',
                        payload: { step: 'vivier de mots', received, total },
                    })
                );
                const words = new TextDecoder()
                    .decode(poolBuffer)
                    .split('\n')
                    .map(w => w.trim())
                    .filter(w => w.length > 0);
                wordPoolInstance = new WordPool(words);

                self.postMessage({ type: 'INIT_SUCCESS', payload: { words: words.length } });
            } else {
                self.postMessage({ type: 'INIT_SUCCESS', payload: { words: 0 } });
            }
        }
        else if (type === 'GENERATE_NATURAL_FLOW') {
            if (!gaddagInstance || !wordPoolInstance) throw new Error('Not initialized');

            const { targetWord, pool, difficulty = 8 } = payload;
            const start = performance.now();

            const result = NaturalFlow.genererSituationNaturelle(
                targetWord,
                pool,
                gaddagInstance,
                wordPoolInstance,
                { profondeurRespiration: difficulty, distributionMots: { court: 0.5, moyen: 0.35, long: 0.15 }, maxTentatives: 15 }
            );

            self.postMessage({
                type: 'GENERATE_SUCCESS',
                payload: result,
                callId,
                timeMs: performance.now() - start
            });
        }
    } catch (err: any) {
        self.postMessage({ type: 'ERROR', payload: err.stack || err.message, callId });
    }
};
