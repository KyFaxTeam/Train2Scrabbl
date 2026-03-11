import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            isSidebarOpen: true,
            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
            theme: 'light',
            toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
        }),
        {
            name: 'faizers-app-storage',
        }
    )
);
