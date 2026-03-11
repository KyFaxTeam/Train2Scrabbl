import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Swords, BarChart2, Compass } from 'lucide-react';
import { clsx } from 'clsx';

export const MobileNav: React.FC = () => {
    const location = useLocation();

    const navItems = [
        { path: '/', icon: BookOpen, label: 'Codex' },
        { path: '/arena', icon: Compass, label: 'Arena' },
        { path: '/training', icon: Swords, label: 'Train' },
        { path: '/stats', icon: BarChart2, label: 'Stats' },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 pb-safe z-50 px-6 py-2 flex justify-around items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={clsx(
                            "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200",
                            isActive ? "text-lexis-emerald" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <div className={clsx("p-1 rounded-lg transition-colors", isActive && "bg-lexis-emerald/10")}>
                            <Icon className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </Link>
                );
            })}
        </div>
    );
};
