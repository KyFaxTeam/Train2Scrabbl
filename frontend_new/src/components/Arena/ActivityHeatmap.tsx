/**
 * ActivityHeatmap - GitHub-style contribution calendar
 * 
 * Displays 365 days of activity with color intensity based on review count
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Trophy } from 'lucide-react';
import type { DailyActivityRecord } from '../../types/dictionary';

interface ActivityHeatmapProps {
    data: DailyActivityRecord[];
    currentStreak: number;
    longestStreak: number;
}

// Color levels based on review count
const getColorLevel = (reviewCount: number): number => {
    if (reviewCount === 0) return 0;
    if (reviewCount <= 5) return 1;
    if (reviewCount <= 15) return 2;
    if (reviewCount <= 30) return 3;
    return 4;
};

const COLORS = [
    'bg-slate-100', // Level 0 - No activity
    'bg-emerald-200', // Level 1 - 1-5 reviews
    'bg-emerald-400', // Level 2 - 6-15 reviews
    'bg-emerald-500', // Level 3 - 16-30 reviews
    'bg-emerald-700', // Level 4 - 31+ reviews
];

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

interface CellData {
    date: string;
    count: number;
    dayOfWeek: number;
    weekIndex: number;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
    data,
    currentStreak,
    longestStreak,
}) => {
    const [hoveredCell, setHoveredCell] = useState<CellData | null>(null);

    // Generate 365 days of cells
    const { cells, monthLabels } = useMemo(() => {
        const activityMap = new Map<string, number>();
        data.forEach(d => activityMap.set(d.id, d.reviewCount));

        const today = new Date();
        const cells: CellData[] = [];
        const monthLabels: { month: string; weekIndex: number }[] = [];

        // Start from 365 days ago
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 364);

        // Adjust to start on a Sunday
        const startDayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - startDayOfWeek);

        let currentMonth = -1;
        let weekIndex = 0;

        for (let i = 0; i < 371; i++) { // Slightly more to fill the grid
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);

            if (date > today) break;

            const dateStr = date.toISOString().split('T')[0];
            const dayOfWeek = date.getDay();
            const month = date.getMonth();

            if (dayOfWeek === 0 && i > 0) {
                weekIndex++;
            }

            // Track month labels
            if (month !== currentMonth) {
                currentMonth = month;
                monthLabels.push({
                    month: MONTH_NAMES[month],
                    weekIndex,
                });
            }

            cells.push({
                date: dateStr,
                count: activityMap.get(dateStr) || 0,
                dayOfWeek,
                weekIndex,
            });
        }

        return { cells, monthLabels };
    }, [data]);

    // Calculate max week index for grid
    const maxWeekIndex = Math.max(...cells.map(c => c.weekIndex));

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            {/* Header with streaks */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                    Activité des 365 derniers jours
                </h3>
                <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="text-slate-600">Streak:</span>
                        <span className="font-bold text-orange-500">{currentStreak} jours</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span className="text-slate-600">Record:</span>
                        <span className="font-bold text-amber-500">{longestStreak} jours</span>
                    </div>
                </div>
            </div>

            {/* Heatmap Grid - Desktop */}
            <div className="hidden sm:block overflow-x-auto">
                <div className="relative min-w-[750px]">
                    {/* Month labels */}
                    <div className="flex mb-1 ml-8">
                        {monthLabels.map((m, i) => (
                            <div
                                key={i}
                                className="text-xs text-slate-400"
                                style={{
                                    position: 'absolute',
                                    left: `${32 + m.weekIndex * 14}px`,
                                }}
                            >
                                {m.month}
                            </div>
                        ))}
                    </div>

                    <div className="flex mt-4">
                        {/* Day labels */}
                        <div className="flex flex-col gap-[2px] mr-1 text-xs text-slate-400">
                            {[0, 1, 2, 3, 4, 5, 6].map(day => (
                                <div key={day} className="h-3 flex items-center">
                                    {day % 2 === 1 ? DAY_NAMES[day] : ''}
                                </div>
                            ))}
                        </div>

                        {/* Grid */}
                        <div className="flex gap-[2px]">
                            {Array.from({ length: maxWeekIndex + 1 }, (_, weekIdx) => (
                                <div key={weekIdx} className="flex flex-col gap-[2px]">
                                    {[0, 1, 2, 3, 4, 5, 6].map(dayIdx => {
                                        const cell = cells.find(
                                            c => c.weekIndex === weekIdx && c.dayOfWeek === dayIdx
                                        );

                                        if (!cell) {
                                            return (
                                                <div
                                                    key={dayIdx}
                                                    className="w-3 h-3 rounded-sm bg-transparent"
                                                />
                                            );
                                        }

                                        const colorLevel = getColorLevel(cell.count);

                                        return (
                                            <motion.div
                                                key={dayIdx}
                                                className={`w-3 h-3 rounded-sm ${COLORS[colorLevel]} cursor-pointer`}
                                                whileHover={{ scale: 1.3 }}
                                                onMouseEnter={() => setHoveredCell(cell)}
                                                onMouseLeave={() => setHoveredCell(null)}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile View - Last 30 days */}
            <div className="sm:hidden">
                <div className="flex flex-wrap gap-1">
                    {cells.slice(-30).map((cell, i) => {
                        const colorLevel = getColorLevel(cell.count);
                        return (
                            <motion.div
                                key={i}
                                className={`w-4 h-4 rounded-sm ${COLORS[colorLevel]}`}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setHoveredCell(cell)}
                            />
                        );
                    })}
                </div>
                <p className="text-xs text-slate-400 mt-2">30 derniers jours</p>
            </div>

            {/* Tooltip */}
            {hoveredCell && (
                <div className="mt-2 p-2 bg-slate-800 text-white text-xs rounded-lg inline-block">
                    <p className="font-medium">
                        {new Date(hoveredCell.date).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                        })}
                    </p>
                    <p>
                        {hoveredCell.count === 0
                            ? 'Aucune révision'
                            : `${hoveredCell.count} révision${hoveredCell.count > 1 ? 's' : ''}`}
                    </p>
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-end gap-1 mt-3 text-xs text-slate-500">
                <span>Moins</span>
                {COLORS.map((color, i) => (
                    <div key={i} className={`w-3 h-3 rounded-sm ${color}`} />
                ))}
                <span>Plus</span>
            </div>
        </div>
    );
};

export default ActivityHeatmap;
