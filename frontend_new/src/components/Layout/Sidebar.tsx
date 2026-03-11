import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Swords, BarChart2, Settings, ChevronLeft, ChevronRight, Compass } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
    const location = useLocation();
    const { isSidebarOpen, toggleSidebar } = useAppStore();

    const navItems = [
        { path: '/', icon: BookOpen, label: 'The Codex' },
        { path: '/arena', icon: Compass, label: 'The Arena' },
        { path: '/training', icon: Swords, label: 'Training' },
        { path: '/stats', icon: BarChart2, label: 'Stats' },
    ];

    return (
        <motion.nav
            initial={false}
            animate={{ width: isSidebarOpen ? 240 : 80 }}
            className="hidden md:flex flex-col h-screen bg-lexis-surface border-r border-slate-200 sticky top-0 z-30 shadow-sm"
        >
            {/* Header */}
            <div className="p-6 flex items-center gap-3 border-b border-slate-100 h-[80px]">
                <div className="w-8 h-8 bg-lexis-emerald rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-lexis-emerald/20 shrink-0">
                    L
                </div>
                {isSidebarOpen && (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="font-bold text-xl text-lexis-slate tracking-tight"
                    >
                        Faizers
                    </motion.span>
                )}
            </div>

            {/* Navigation */}
            <div className="flex-1 py-6 px-3 space-y-2">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx(
                                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                                isActive
                                    ? "bg-lexis-emerald/10 text-lexis-emerald font-medium"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <Icon className={clsx("w-6 h-6 shrink-0 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-110")} />

                            {isSidebarOpen && (
                                <motion.span
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="whitespace-nowrap"
                                >
                                    {item.label}
                                </motion.span>
                            )}

                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute left-0 top-0 bottom-0 w-1 bg-lexis-emerald rounded-r-full"
                                />
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* Footer / Toggle */}
            <div className="p-4 border-t border-slate-100">
                <button
                    onClick={toggleSidebar}
                    className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-50 text-slate-400 transition-colors"
                >
                    {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
            </div>
        </motion.nav>
    );
};
