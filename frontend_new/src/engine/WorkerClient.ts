import type { SituationEntrainement } from './models/Situation';
import type { MoveVerdict, PlacedTile, Placement } from './services/MoveChecker';

export interface InitProgress {
    step: string;
    received: number;
    total: number;
}

export interface MoveReview {
    verdict: MoveVerdict;
    /** Le meilleur scrabble du mot attendu, pour situer le coup joue. */
    meilleur: Placement | null;
}

/**
 * Le lexique pese 236 Ko transferes : l'init tient en une poignee de secondes.
 * On garde neanmoins un plafond genereux pour les connexions tres lentes -
 * au-dela, c'est que quelque chose est casse, et il vaut mille fois mieux le
 * dire que laisser tourner un spinner.
 */
const INIT_TIMEOUT_MS = 60_000;
const GENERATE_TIMEOUT_MS = 20_000;
const CHECK_TIMEOUT_MS = 10_000;

export class EngineWorkerClient {
    private static instance: EngineWorkerClient;
    private worker: Worker;
    private initPromise: Promise<void> | null = null;
    private isInitialized = false;
    private onProgress: ((progress: InitProgress) => void) | null = null;

    private resolvers: Map<string, { resolve: (value: unknown) => void, reject: (error: Error) => void }> = new Map();
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
    private track<T>(key: string, timeoutMs: number, label: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = window.setTimeout(() => {
                this.resolvers.delete(key);
                if (key === 'INIT') this.initPromise = null;
                reject(new Error(`${label} : delai depasse`));
            }, timeoutMs);

            this.resolvers.set(key, {
                resolve: (value: unknown) => { window.clearTimeout(timer); resolve(value as T); },
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
        // resolveur, sinon l'echec de chargement du lexique se perdait.
        if (type === 'ERROR' && callId === undefined) {
            this.initPromise = null;
            this.resolvers.get('INIT')?.reject(new Error(payload));
            this.resolvers.delete('INIT');
            return;
        }

        if (type === 'GENERATE_SUCCESS' || type === 'CHECK_SUCCESS' || type === 'TARGETS_SUCCESS' || type === 'ERROR') {
            const key = callId?.toString();
            if (key === undefined) return;
            const entry = this.resolvers.get(key);
            if (!entry) return;
            this.resolvers.delete(key);

            if (type === 'ERROR') entry.reject(new Error(payload));
            else entry.resolve({ payload, timeMs });
        }
    }

    /** Notifie l'avancement du telechargement du lexique. */
    public setProgressListener(listener: ((progress: InitProgress) => void) | null) {
        this.onProgress = listener;
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) return;
        if (!this.initPromise) {
            this.initPromise = this.track<void>('INIT', INIT_TIMEOUT_MS, 'Chargement du lexique')
                .then(() => undefined)
                .catch(error => {
                    this.initPromise = null;
                    throw error;
                });
            this.worker.postMessage({ type: 'INIT' });
        }
        return this.initPromise;
    }

    private async call<T>(type: string, payload: unknown, timeoutMs: number, label: string): Promise<{ result: T, timeMs: number }> {
        await this.initialize();

        const id = (++this.callId).toString();
        const pending = this.track<{ payload: T, timeMs: number }>(id, timeoutMs, label);
        this.worker.postMessage({ type, callId: id, payload });

        const { payload: result, timeMs } = await pending;
        return { result, timeMs };
    }

    public async generateNaturalFlow(
        targetWord: string,
        pool: string[],
        difficulty = 8
    ): Promise<{ result: SituationEntrainement | null, timeMs: number }> {
        return this.call<SituationEntrainement | null>(
            'GENERATE_NATURAL_FLOW',
            { targetWord, pool, difficulty },
            GENERATE_TIMEOUT_MS,
            `Generation de ${targetWord}`
        );
    }

    /** Des mots a travailler, tires dans le lexique du worker. */
    public async randomTargets(count: number, length = 7): Promise<string[]> {
        const { result } = await this.call<string[]>(
            'RANDOM_TARGETS',
            { count, length },
            CHECK_TIMEOUT_MS,
            'Choix des mots'
        );
        return result;
    }

    /**
     * Soumet le coup du joueur a l'arbitre du moteur : alignement, contiguite,
     * raccordement au plateau, mots formes, score. Le lexique vit dans le
     * worker - c'est donc lui qui tranche.
     */
    public async checkMove(
        initialTiles: PlacedTile[],
        placedTiles: PlacedTile[],
        expectedWord: string,
        rack: string[]
    ): Promise<MoveReview> {
        const { result } = await this.call<MoveReview>(
            'CHECK_MOVE',
            { initialTiles, placedTiles, expectedWord, rack },
            CHECK_TIMEOUT_MS,
            'Verification du coup'
        );
        return result;
    }
}
