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
