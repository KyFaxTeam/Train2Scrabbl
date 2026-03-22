
export class Rack {
    private letters: string[];
    public readonly size: number;

    constructor(initialLetters: string | string[] = '', size: number = 7) {
        if (typeof initialLetters === 'string') {
            this.letters = initialLetters.toUpperCase().split('');
        } else {
            this.letters = [...initialLetters].map(c => c.toUpperCase());
        }
        this.size = size;
    }

    public getLetters(): string[] {
        return [...this.letters];
    }

    public setLetters(letters: string | string[]): void {
        this.letters = [];
        this.addLetters(letters);
    }

    public addLetters(newLetters: string | string[]): void {
        const toAdd = typeof newLetters === 'string' ? newLetters.toUpperCase().split('') : newLetters.map(c => c.toUpperCase());
        for (const l of toAdd) {
            if (this.letters.length < this.size) {
                this.letters.push(l);
            }
        }
    }

    public removeLetters(lettersToRemove: string | string[]): boolean {
        const toRemove = typeof lettersToRemove === 'string' ? lettersToRemove.toUpperCase().split('') : lettersToRemove.map(c => c.toUpperCase());
        
        // Check if we have all letters
        const tempRack = [...this.letters];
        for (const l of toRemove) {
            const index = tempRack.indexOf(l);
            if (index === -1) {
                // Try blank
                const blankIndex = tempRack.indexOf('_');
                if (blankIndex === -1 && tempRack.indexOf('?') === -1) return false;
                if (blankIndex !== -1) tempRack.splice(blankIndex, 1);
                else tempRack.splice(tempRack.indexOf('?'), 1);
            } else {
                tempRack.splice(index, 1);
            }
        }

        this.letters = tempRack;
        return true;
    }

    public hasLetter(letter: string): boolean {
        return this.letters.includes(letter.toUpperCase()) || this.letters.includes('_') || this.letters.includes('?');
    }

    public isEmpty(): boolean {
        return this.letters.length === 0;
    }

    public getAvailableLetters(): Set<string> {
        return new Set(this.letters);
    }

    public toString(): string {
        return this.letters.join('');
    }
}
