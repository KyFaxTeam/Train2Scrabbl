import { useState, useCallback, useRef, useEffect } from 'react';

interface DragState {
    isDragging: boolean;
    draggedTile: { char: string; rackId: number } | null;
    ghostPosition: { x: number; y: number } | null;
}

/** En dessous de ce deplacement (px), le geste est un tap : c'est le `click` qui le traite. */
const SEUIL_GLISSER = 8;

const AU_REPOS: DragState = { isDragging: false, draggedTile: null, ghostPosition: null };

/**
 * Glisser-deposer au doigt (le bureau passe par le glisser-deposer HTML5).
 *
 * Un jeton lache sur une case du plateau (`data-cell="r-c"`) y est pose ; lache
 * sur une place du chevalet (`data-rack-slot="i"`), il y est range - c'est ainsi
 * qu'on reordonne ses lettres ou qu'on reprend un jeton du plateau.
 *
 * Le glisser ne commence qu'apres un vrai deplacement : un simple tap garde son
 * sens (choisir un jeton, retirer un jeton pose) au lieu de declencher un depot
 * sur place.
 */
export function useTouchDragDrop(
    onDrop: (rackId: number, row: number, col: number) => void,
    onRackDrop?: (rackId: number, slot: number) => void
) {
    const [dragState, setDragStateRaw] = useState<DragState>(AU_REPOS);
    const pending = useRef<{ char: string; rackId: number; x: number; y: number } | null>(null);
    // Copie lue par les gestionnaires d'evenements, tenue a jour a chaque changement
    const dragRef = useRef<DragState>(AU_REPOS);
    const setDragState = useCallback((next: DragState) => {
        dragRef.current = next;
        setDragStateRaw(next);
    }, []);

    const handleTouchStart = useCallback((e: React.TouchEvent, char: string, rackId: number) => {
        const touch = e.touches[0];
        pending.current = { char, rackId, x: touch.clientX, y: touch.clientY };
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        const p = pending.current;
        if (!dragRef.current.isDragging) {
            if (!p) return;
            if (Math.hypot(touch.clientX - p.x, touch.clientY - p.y) < SEUIL_GLISSER) return;
            setDragState({
                isDragging: true,
                draggedTile: { char: p.char, rackId: p.rackId },
                ghostPosition: { x: touch.clientX, y: touch.clientY },
            });
            return;
        }
        if (e.cancelable) e.preventDefault();
        setDragState({ ...dragRef.current, ghostPosition: { x: touch.clientX, y: touch.clientY } });
    }, [setDragState]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        pending.current = null;
        const tile = dragRef.current.draggedTile;
        if (!dragRef.current.isDragging || !tile) {
            setDragState(AU_REPOS);
            return;
        }
        // Le geste etait un glisser : le `click` qui suit ne doit pas compter comme un tap.
        if (e.cancelable) e.preventDefault();

        const touch = e.changedTouches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const cell = element?.closest('[data-cell]')?.getAttribute('data-cell');
        const slot = element?.closest('[data-rack-slot]')?.getAttribute('data-rack-slot');
        const rack = element?.closest('[data-rack]');

        if (cell) {
            const [row, col] = cell.split('-').map(Number);
            onDrop(tile.rackId, row, col);
        } else if (onRackDrop && slot != null) {
            onRackDrop(tile.rackId, Number(slot));
        } else if (onRackDrop && rack) {
            onRackDrop(tile.rackId, Number.MAX_SAFE_INTEGER);
        }

        setDragState(AU_REPOS);
    }, [onDrop, onRackDrop, setDragState]);

    // Pas de defilement de la page pendant un glisser
    useEffect(() => {
        if (!dragState.isDragging) return;
        const prevent = (e: TouchEvent) => {
            if (dragRef.current.isDragging) e.preventDefault();
        };
        document.addEventListener('touchmove', prevent, { passive: false });
        return () => document.removeEventListener('touchmove', prevent);
    }, [dragState.isDragging]);

    return { dragState, handleTouchStart, handleTouchMove, handleTouchEnd };
}
