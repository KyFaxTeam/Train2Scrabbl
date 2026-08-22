import { test, expect } from '@playwright/test';
test.describe('Worker raw logic stress', () => { test.setTimeout(120000); test('run', async ({page}) => { await page.goto('/training'); await page.waitForTimeout(2000); const res = await page.evaluate(async () => {
    return new Promise(resolve => {
        const worker = window['worker'] || window['engineWorker'];
        if (!worker) return resolve({error: 'no worker'});
        let times = [];
        let curStart = performance.now();
        const cb = (e) => {
            if (e.data.type === 'PUZZLE_GENERATED') {
                times.push(performance.now() - curStart);
                if (times.length < 50) {
                    curStart = performance.now();
                    worker.postMessage({type: 'GENERATE_PUZZLE', payload: {}});
                } else {
                    worker.removeEventListener('message', cb);
                    resolve({avg: times.reduce((a,b)=>a+b,0)/times.length, max: Math.max(...times), min: Math.min(...times), count: times.length});
                }
            }
        };
        worker.addEventListener('message', cb);
        curStart = performance.now();
        worker.postMessage({type: 'GENERATE_PUZZLE', payload: {}});
    });
}); console.log("STRESS TEST RAW WORKER RESULT", res); expect(res.avg).toBeLessThan(2000); }); });
