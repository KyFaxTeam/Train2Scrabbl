import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLearningStore } from '../../store/useLearningStore';
import { X, Brain, ArrowRight, Clock } from 'lucide-react';
import { clsx } from 'clsx';

export const SmartPopup: React.FC = () => {
    const navigate = useNavigate();
    const currentTrigger = useLearningStore(state => state.currentTrigger);
    const dismissTrigger = useLearningStore(state => state.dismissTrigger);

    const handleAction = () => {
        if (currentTrigger?.payload.action === 'quick_test' ||
            currentTrigger?.payload.action === 'start_training' ||
            currentTrigger?.payload.action === 'review') {
            navigate('/training');
        }
        dismissTrigger();
    };

    const isUrgent = currentTrigger?.priority === 'urgent';

    return (
        <AnimatePresence>
            {currentTrigger && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
                        onClick={dismissTrigger}
                    />

                    {/* Popup */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-md"
                    >
                        <div className={clsx(
                            "bg-white rounded-2xl shadow-2xl overflow-hidden",
                            isUrgent && "ring-2 ring-amber-400"
                        )}>
                            {/* Header */}
                            <div className={clsx(
                                "px-6 py-4 flex items-center gap-3",
                                isUrgent ? "bg-amber-50" : "bg-emerald-50"
                            )}>
                                <div className={clsx(
                                    "p-2 rounded-full",
                                    isUrgent ? "bg-amber-100" : "bg-emerald-100"
                                )}>
                                    <Brain className={clsx(
                                        "w-5 h-5",
                                        isUrgent ? "text-amber-600" : "text-emerald-600"
                                    )} />
                                </div>
                                <h3 className="font-bold text-slate-800">
                                    {currentTrigger.type === 'test_suggestion'
                                        ? 'Prêt pour un test?'
                                        : currentTrigger.type === 'review_reminder'
                                            ? 'Révision suggérée'
                                            : 'Suggestion'}
                                </h3>
                                <button
                                    onClick={dismissTrigger}
                                    className="ml-auto p-1 hover:bg-white/50 rounded-full transition-colors"
                                >
                                    <X className="w-4 h-4 text-slate-400" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="px-6 py-5">
                                <p className="text-slate-600 mb-4">
                                    {currentTrigger.payload.message}
                                </p>

                                {isUrgent && (
                                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-4">
                                        <Clock className="w-4 h-4 flex-shrink-0" />
                                        <span>La science montre que tester est 2x plus efficace que relire!</span>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="px-6 pb-6 flex gap-3">
                                <button
                                    onClick={dismissTrigger}
                                    className="flex-1 py-3 rounded-xl font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    Plus tard
                                </button>
                                <button
                                    onClick={handleAction}
                                    className={clsx(
                                        "flex-1 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-colors",
                                        isUrgent
                                            ? "bg-amber-500 hover:bg-amber-600"
                                            : "bg-emerald-500 hover:bg-emerald-600"
                                    )}
                                >
                                    Tester <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
