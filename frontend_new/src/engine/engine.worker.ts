// @ts-nocheck

import { Gaddag } from './models/Gaddag';

import { WordPool } from './services/WordPool';
import { NaturalFlow } from './modules/NaturalFlow';

let gaddagInstance: Gaddag | null = null;
let wordPoolInstance: WordPool | null = null;

self.onmessage = async (e: MessageEvent) => {
    const { type, payload, callId } = e.data;

    try {
        if (type === 'INIT') {
            if (!gaddagInstance) {
                // Fetch dictionary binary
                const baseUrl = import.meta.env.BASE_URL || '/';
                const response = await fetch(`${baseUrl}data/gaddag.bin`);
                const buffer = await response.arrayBuffer();
                gaddagInstance = new Gaddag(buffer);

                const txtResponse = await fetch(`${baseUrl}data/scrabble_dict.txt`);
                const text = await txtResponse.text();
                const words = text.split('\n').filter(w => w.trim().length > 0);
                wordPoolInstance = new WordPool(words);

                self.postMessage({ type: 'INIT_SUCCESS' });
            }
        }
        else if (type === 'GENERATE_NATURAL_FLOW') {
            if (!gaddagInstance || !wordPoolInstance) throw new Error('Not initialized');

            const { targetWord, pool, difficulty = 8 } = payload;

            // This could loop a few times, so let's guarantee response.
            // Ideally we offload heavy computation in worker so UI doesn't freeze
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
