
import type { SituationEntrainement } from './models/Situation';

export class EngineWorkerClient {
    private static instance: EngineWorkerClient;
    private worker: Worker;
    private initPromise: Promise<void> | null = null;
    private isInitialized = false;

    private resolvers: Map<string, { resolve: Function, reject: Function }> = new Map();
    private callId = 0;

    private constructor() {
        this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.handleMessage.bind(this);
    }

    public static getInstance(): EngineWorkerClient {
        if (!EngineWorkerClient.instance) {
            EngineWorkerClient.instance = new EngineWorkerClient();
        }
        return EngineWorkerClient.instance;
    }

    private handleMessage(e: MessageEvent) {
        const { type, payload, callId, timeMs } = e.data;

        if (type === 'INIT_SUCCESS') {
            this.isInitialized = true;
            if (this.resolvers.has('INIT')) {
                const { resolve } = this.resolvers.get('INIT')!;
                this.resolvers.delete('INIT');
                resolve();
            }
        } else if (type === 'GENERATE_SUCCESS' || type === 'ERROR') {
            if (callId !== undefined && this.resolvers.has(callId.toString())) {
                const { resolve, reject } = this.resolvers.get(callId.toString())!;
                this.resolvers.delete(callId.toString());

                if (type === 'ERROR') {
                    reject(new Error(payload));
                } else {
                    resolve({ payload, timeMs });
                }
            }
        }
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) return;
        if (!this.initPromise) {
            this.initPromise = new Promise((resolve, reject) => {
                this.resolvers.set('INIT', { resolve, reject });
                this.worker.postMessage({ type: 'INIT' });
            });
        }
        return this.initPromise;
    }

    public async generateNaturalFlow(targetWord: string, pool: string[], difficulty = 8): Promise<{ result: SituationEntrainement | null, timeMs: number }> {
        await this.initialize();

        return new Promise((resolve, reject) => {
            const id = (++this.callId).toString();
            this.resolvers.set(id, { resolve, reject });

            this.worker.postMessage({
                type: 'GENERATE_NATURAL_FLOW',
                callId: id,
                payload: { targetWord, pool, difficulty }
            });
        });
    }
}

if (typeof window !== 'undefined') { (window as any).engineWorker = window.engineWorker || null; }
