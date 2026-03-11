import { MOCK_DICTIONARY, searchDictionary } from './src/services/dictionaryService';
import { generateBatch } from './src/services/trainingService';

console.log("Testing Services...");

try {
    console.log("MOCK_DICTIONARY length:", MOCK_DICTIONARY.length);
    if (MOCK_DICTIONARY.length === 0) throw new Error("Dictionary is empty!");

    console.log("Testing search...");
    const results = searchDictionary("AAA");
    console.log("Search results:", results.length);

    console.log("Testing training batch generation...");
    const batch = generateBatch(5);
    console.log("Batch generated:", batch.length);
    console.log("First puzzle:", batch[0]?.id);

    console.log("SUCCESS: Services are stable.");
} catch (e) {
    console.error("FAILURE: Service crash detected.", e);
    process.exit(1);
}
