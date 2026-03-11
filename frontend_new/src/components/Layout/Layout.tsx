import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { SmartPopup } from '../Learning';
import { useLearningStore } from '../../store/useLearningStore';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const initialize = useLearningStore(state => state.initialize);

    // Initialize learning store on mount
    useEffect(() => {
        initialize();
    }, [initialize]);

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-lexis-bg">
            <Sidebar />

            <main className="flex-1 h-full relative overflow-hidden flex flex-col">
                {/* Mobile Header */}
                <div className="md:hidden h-[60px] bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-center sticky top-0 z-40">
                    <span className="font-bold text-lg text-slate-800 tracking-tight">Faizers</span>
                </div>

                <div className="flex-1 overflow-y-auto relative scroll-smooth">
                    {children}
                </div>

                {/* Spacer for Mobile Nav */}
                <div className="h-[80px] md:hidden shrink-0" />
            </main>

            <MobileNav />

            {/* Global Smart Popup for Learning Triggers */}
            <SmartPopup />
        </div>
    );
};
