import fs from 'fs';
import { performance } from 'perf_hooks';
import { Gaddag } from './src/engine/models/Gaddag.ts';
import { NaturalFlow } from './src/engine/modules/NaturalFlow.ts';

async function runStressTest() {
    console.log("Loading GADDAG from gaddag.bin...");
    const t0 = performance.now();
    const buffer = fs.readFileSync('./public/data/gaddag.bin');
    // Buffer -> ArrayBuffer
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const gaddag = new Gaddag(arrayBuffer);
    
    // We need words for word pool
    const dictText = fs.readFileSync('./public/data/scrabble_dict.txt', 'utf-8');
    const words = dictText.split('\n').map(w => w.trim()).filter(w => w.length > 0);

    console.log(`Initialized in ${(performance.now() - t0).toFixed(2)}ms`);

    const flow = new NaturalFlow(gaddag, words);
    
    console.log("Running stress test (1000 scenarios)...");
    const times = [];
    let failures = 0;
    
    for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        const puzzle = flow.generate_scenario({ minLength: 4, maxLength: 8 }, "any");
        const end = performance.now();
        if (puzzle) {
            times.push(end - start);
        } else {
            failures++;
        }
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);
    const p95 = times.sort((a,b)=>a-b)[Math.floor(times.length * 0.95)];
    
    console.log(`\n=== STRESS TEST RESULTS (Node / TS) ===`);
    console.log(`Generated: ${times.length}`);
    console.log(`Failures: ${failures}`);
    console.log(`Average Time: ${avg.toFixed(2)} ms/puzzle`);
    console.log(`Min Time: ${min.toFixed(2)} ms/puzzle`);
    console.log(`Max Time: ${max.toFixed(2)} ms/puzzle`);
    console.log(`P95 Time: ${p95.toFixed(2)} ms/puzzle`);
    console.log(`=========================================\n`);
}

runStressTest().catch(console.error);
