import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { XPReward, WordMastery } from '../../types';

interface XPFeedbackProps {
    isOpen: boolean;
    correct: boolean;
    word: string;
    expectedWord?: string; // Pour afficher la bonne réponse si erreur
    xp: XPReward;
    mastery?: WordMastery;
    onContinue: () => void;
}

export const XPFeedback: React.FC<XPFeedbackProps> = ({
    isOpen,
    correct,
    word,
    expectedWord,
    xp,
    mastery,
    onContinue
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={onContinue}
                >
                    <motion.div
                        initial={{ scale: 0.8, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.8, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                    >
                        {/* Header */}
                        <div className={clsx(
                            "px-6 py-5 flex items-center gap-3",
                            correct ? "bg-emerald-500" : "bg-red-500"
                        )}>
                            <div className="p-2 bg-white/20 rounded-full">
                                {correct ? <Check className="w-6 h-6 text-white" /> : <X className="w-6 h-6 text-white" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-lg">
                                    {correct ? 'Excellent!' : 'Pas tout à fait...'}
                                </h3>
                                <p className="text-white/90 font-mono tracking-wider">{word}</p>
                            </div>
                        </div>

                        {/* XP Breakdown - seulement si correct */}
                        {correct && xp.total > 0 && (
                            <div className="px-6 py-4 space-y-2">
                                {xp.breakdown.map((line, i) => {
                                    const match = line.match(/^\+(\d+) XP/);
                                    const points = match ? match[0] : '';
                                    const reason = line.replace(/^\+\d+ XP\s*/, '').replace(/[()]/g, '');
                                    return (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600">{reason}</span>
                                            <span className="font-bold text-emerald-600">{points}</span>
                                        </div>
                                    );
                                })}
                                <div className="border-t border-slate-200 pt-2 mt-2 flex items-center justify-between">
                                    <span className="font-bold text-slate-800">Total</span>
                                    <span className="font-bold text-xl text-emerald-600">+{xp.total} XP</span>
                                </div>
                            </div>
                        )}

                        {/* Info révision - si correct et date dispo */}
                        {correct && mastery?.dueDate && (
                            <div className="px-6 pb-4">
                                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                                    <Clock className="w-4 h-4" />
                                    <span>Prochaine révision: {formatDueDate(mastery.dueDate)}</span>
                                </div>
                            </div>
                        )}

                        {/* Erreur: montrer la bonne réponse */}
                        {!correct && (
                            <div className="px-6 py-4">
                                {expectedWord && (
                                    <p className="text-slate-600 text-sm mb-2">
                                        Le mot attendu était: <span className="font-mono font-bold text-slate-800">{expectedWord}</span>
                                    </p>
                                )}
                                <p className="text-slate-500 text-xs">
                                    Ce mot sera reproposé bientôt pour renforcer votre mémoire.
                                </p>
                            </div>
                        )}

                        {/* Action */}
                        <div className="px-6 pb-6">
                            <button
                                onClick={onContinue}
                                className={clsx(
                                    "w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-colors",
                                    correct ? "bg-emerald-500 hover:bg-emerald-600" : "bg-slate-500 hover:bg-slate-600"
                                )}
                            >
                                Continuer <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

function formatDueDate(isoDate: string): string {
    const due = new Date(isoDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "aujourd'hui";
    if (diffDays === 1) return "demain";
    return `dans ${diffDays} jours`;
}
