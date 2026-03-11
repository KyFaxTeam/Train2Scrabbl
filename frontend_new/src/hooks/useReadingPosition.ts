import { useState } from 'react';

const STORAGE_KEY = 'faizers_codex_position';

interface PositionState {
    openCategory: string | null;
    scrollOffset: number;
}

export const useReadingPosition = () => {
    const [position, setPosition] = useState<PositionState>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : { openCategory: null, scrollOffset: 0 };
        } catch {
            return { openCategory: null, scrollOffset: 0 };
        }
    });

    const savePosition = (category: string | null, offset: number) => {
        const newState = { openCategory: category, scrollOffset: offset };
        setPosition(newState);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    };

    return { position, savePosition };
};
