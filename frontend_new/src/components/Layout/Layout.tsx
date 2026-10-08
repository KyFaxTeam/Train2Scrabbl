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
        // `h-dvh` : la hauteur reellement visible. Sur Chrome Android, `100vh`
        // compte aussi la barre d'adresse : la page depassait de ~56 px et le
        // bas (le chevalet de l'entrainement) passait sous la barre de navigation.
        <div className="flex h-screen h-dvh w-screen overflow-hidden bg-lexis-bg">
            <Sidebar />

            <main className="flex-1 h-full relative overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto relative scroll-smooth">
                    {children}
                </div>

                {/* Barre de navigation telephone : dans le flux, sous le contenu,
                    et non plus posee par-dessus avec un espaceur a la bonne hauteur
                    devinee (80 px pour une barre qui en mesure 84). */}
                <MobileNav />
            </main>

            {/* Global Smart Popup for Learning Triggers */}
            <SmartPopup />
        </div>
    );
};
