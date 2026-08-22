import type { SituationEntrainement } from './models/Situation';

export interface InitProgress {
    step: string;
    received: number;
    total: number;
}

/**
 * Le GADDAG pese 3,2 Mo transferes : sur une connexion faible l'init peut
 * legitimement durer une minute. Au-dela, c'est que quelque chose est casse -
 * et il vaut mille fois mieux le dire que laisser tourner un spinner.
 */
const INIT_TIMEOUT_MS = 120_000;
const GENERATE_TIMEOUT_MS = 20_000;

export class EngineWorkerClient {
    private static instance: EngineWorkerClient;
    private worker: Worker;
    private initPromise: Promise<void> | null = null;
    private isInitialized = false;
    private onProgress: ((progress: InitProgress) => void) | null = null;

    private resolvers: Map<string, { resolve: Function, reject: Function }> = new Map();
    private callId = 0;

    private constructor() {
        this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.handleMessage.bind(this);

        // Sans ce gestionnaire, un worker qui meurt (script introuvable, erreur
        // de parsing, memoire) ne rejetait rien du tout : la promesse d'init
        // restait pendante pour toujours et la page affichait "Chargement..."
        // sans fin ni message d'erreur.
        this.worker.onerror = (event) => {
            const message = event.message || 'Le moteur de jeu n a pas pu demarrer';
            this.isInitialized = false;
            this.initPromise = null;
            this.rejectAll(new Error(message));
        };
    }

    public static getInstance(): EngineWorkerClient {
        if (!EngineWorkerClient.instance) {
            EngineWorkerClient.instance = new EngineWorkerClient();
        }
        return EngineWorkerClient.instance;
    }

    private rejectAll(error: Error) {
        for (const { reject } of this.resolvers.values()) reject(error);
        this.resolvers.clear();
    }

    /** Enregistre un resolveur qui abandonne au bout de `timeoutMs`. */
    private track(key: string, timeoutMs: number, label: string) {
        return new Promise<any>((resolve, reject) => {
            const timer = window.setTimeout(() => {
                this.resolvers.delete(key);
                if (key === 'INIT') this.initPromise = null;
                reject(new Error(`${label} : delai depasse`));
            }, timeoutMs);

            this.resolvers.set(key, {
                resolve: (value: any) => { window.clearTimeout(timer); resolve(value); },
                reject: (error: Error) => { window.clearTimeout(timer); reject(error); },
            });
        });
    }

    private handleMessage(e: MessageEvent) {
        const { type, payload, callId, timeMs } = e.data;

        if (type === 'INIT_PROGRESS') {
            this.onProgress?.(payload as InitProgress);
            return;
        }

        if (type === 'INIT_SUCCESS') {
            this.isInitialized = true;
            this.resolvers.get('INIT')?.resolve(undefined);
            this.resolvers.delete('INIT');
            return;
        }

        // Une erreur sans callId vient de l'init : la router vers le bon
        // resolveur, sinon l'echec de chargement du dictionnaire se perdait.
        if (type === 'ERROR' && callId === undefined) {
            this.initPromise = null;
            this.resolvers.get('INIT')?.reject(new Error(payload));
            this.resolvers.delete('INIT');
            return;
        }

        if (type === 'GENERATE_SUCCESS' || type === 'ERROR') {
            const key = callId?.toString();
            if (key === undefined) return;
            const entry = this.resolvers.get(key);
            if (!entry) return;
            this.resolvers.delete(key);

            if (type === 'ERROR') entry.reject(new Error(payload));
            else entry.resolve({ payload, timeMs });
        }
    }

    /** Notifie l'avancement du telechargement du dictionnaire. */
    public setProgressListener(listener: ((progress: InitProgress) => void) | null) {
        this.onProgress = listener;
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) return;
        if (!this.initPromise) {
            this.initPromise = this.track('INIT', INIT_TIMEOUT_MS, 'Chargement du dictionnaire')
                .then(() => undefined)
                .catch(error => {
                    this.initPromise = null;
                    throw error;
                });
            this.worker.postMessage({ type: 'INIT' });
        }
        return this.initPromise;
    }

    public async generateNaturalFlow(targetWord: string, pool: string[], difficulty = 8): Promise<{ result: SituationEntrainement | null, timeMs: number }> {
        await this.initialize();

        const id = (++this.callId).toString();
        const pending = this.track(id, GENERATE_TIMEOUT_MS, `Generation de ${targetWord}`);

        this.worker.postMessage({
            type: 'GENERATE_NATURAL_FLOW',
            callId: id,
            payload: { targetWord, pool, difficulty }
        });

        const { payload, timeMs } = await pending;
        return { result: payload, timeMs };
    }
}
