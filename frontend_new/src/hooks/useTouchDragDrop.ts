import { useState, useCallback, useRef, useEffect } from 'react';

interface DragState {
    isDragging: boolean;
    draggedTile: { char: string; rackId: number } | null;
    ghostPosition: { x: number; y: number } | null;
}

/**
 * Hook for touch-based drag and drop (mobile).
 * Desktop uses native HTML5 D&D via draggable + onDragStart/onDrop.
 * This hook handles touch events as a polyfill for mobile.
 */
export function useTouchDragDrop(
    onDrop: (rackId: number, row: number, col: number) => void
) {
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        draggedTile: null,
        ghostPosition: null,
    });

    const dragRef = useRef(dragState);
    dragRef.current = dragState;

    const handleTouchStart = useCallback((
        e: React.TouchEvent,
        char: string,
        rackId: number
    ) => {
        const touch = e.touches[0];
        setDragState({
            isDragging: true,
            draggedTile: { char, rackId },
            ghostPosition: { x: touch.clientX, y: touch.clientY },
        });
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!dragRef.current.isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        setDragState(prev => ({
            ...prev,
            ghostPosition: { x: touch.clientX, y: touch.clientY },
        }));
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!dragRef.current.isDragging || !dragRef.current.draggedTile) {
            setDragState({ isDragging: false, draggedTile: null, ghostPosition: null });
            return;
        }

        const touch = e.changedTouches[0];
        // Find the cell element under the touch point
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const cellElement = element?.closest('[data-cell]') as HTMLElement | null;

        if (cellElement) {
            const cellData = cellElement.getAttribute('data-cell');
            if (cellData) {
                const [row, col] = cellData.split('-').map(Number);
                onDrop(dragRef.current.draggedTile.rackId, row, col);
            }
        }

        setDragState({ isDragging: false, draggedTile: null, ghostPosition: null });
    }, [onDrop]);

    // Prevent scrolling while dragging
    useEffect(() => {
        if (!dragState.isDragging) return;
        const prevent = (e: TouchEvent) => {
            if (dragRef.current.isDragging) e.preventDefault();
        };
        document.addEventListener('touchmove', prevent, { passive: false });
        return () => document.removeEventListener('touchmove', prevent);
    }, [dragState.isDragging]);

    return {
        dragState,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
    };
}
