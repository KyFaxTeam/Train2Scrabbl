
export class Gaddag {
    private buffer: Uint32Array;

    constructor(buffer: ArrayBuffer) {
        this.buffer = new Uint32Array(buffer);
    }

    /**
     * Map a character to its 5-bit code.
     * 'A'-'Z' -> 1-26
     * 'e' -> 27
     */
    public static charCode(char: string): number {
        if (char === 'e') return 27;
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) return code - 64; // A-Z
        if (code >= 97 && code <= 122) return code - 96; // a-z
        return 0;
    }

    /**
     * Check if a word is in the GADDAG.
     */
    public contains(word: string): boolean {
        let currentOffset = 0; // Root is always at offset 0
        
        // Follow the unreversed word
        for (let i = 0; i < word.length; i++) {
            currentOffset = this.getTransition(currentOffset, Gaddag.charCode(word[i]));
            if (currentOffset === 0) break;
        }

        if (currentOffset !== 0 && this.isTerminal(currentOffset)) {
             return true;
        }

        // Follow 'e' + word
        currentOffset = this.getTransition(0, Gaddag.charCode('e'));
        if (currentOffset === 0) return false;

        for (let i = 0; i < word.length; i++) {
            currentOffset = this.getTransition(currentOffset, Gaddag.charCode(word[i]));
            if (currentOffset === 0) return false;
        }

        return this.isTerminal(currentOffset);
    }

    /**
     * Get the target offset for a transition from a given node.
     * Returns 0 if transition doesn't exist.
     */
    public getTransition(nodeOffset: number, charCode: number): number {
        if (charCode === 0) return 0;
        
        const header = this.buffer[nodeOffset];
        const numTransitions = header & 0x7FFFFFFF;

        // Skip to transition words
        const start = nodeOffset + 1;
        for (let i = 0; i < numTransitions; i++) {
            const transWord = this.buffer[start + i];
            const transChar = transWord >>> 27;
            if (transChar === charCode) {
                return transWord & 0x07FFFFFF;
            }
        }
        return 0;
    }

    /**
     * Get all transitions from a node.
     */
    public getTransitions(nodeOffset: number): {char: string, target: number}[] {
        const header = this.buffer[nodeOffset];
        const numTransitions = header & 0x7FFFFFFF;
        const res = [];
        const start = nodeOffset + 1;

        for (let i = 0; i < numTransitions; i++) {
            const transWord = this.buffer[start + i];
            const transChar = transWord >>> 27;
            const target = transWord & 0x07FFFFFF;
            
            let ch = '';
            if (transChar === 27) ch = 'e';
            else if (transChar >= 1 && transChar <= 26) ch = String.fromCharCode(transChar + 64);
            
            if (ch) {
                res.push({ char: ch, target });
            }
        }
        return res;
    }

    public isTerminal(nodeOffset: number): boolean {
        return (this.buffer[nodeOffset] & 0x80000000) !== 0;
    }
}
