/**
 * ForecastChart - Bar chart of future revision predictions
 * 
 * Shows upcoming reviews for the next 14-30 days
 */

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock, Calendar } from 'lucide-react';
import type { FutureDueData } from '../../types/dictionary';

interface ForecastChartProps {
    data: FutureDueData[];
    daysToShow?: number;
}

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export const ForecastChart: React.FC<ForecastChartProps> = ({
    data,
    daysToShow = 14,
}) => {
    // Prepare chart data
    const chartData = data.slice(0, daysToShow).map((d, index) => {
        const date = new Date(d.date);
        const dayName = DAY_NAMES[date.getDay()];
        const dayNum = date.getDate();

        return {
            ...d,
            label: index === 0 ? "Auj." : index === 1 ? "Demain" : `${dayName} ${dayNum}`,
            isToday: index === 0,
            isTomorrow: index === 1,
        };
    });

    // Get tomorrow's data for the message
    const tomorrow = chartData.find(d => d.isTomorrow);
    const today = chartData.find(d => d.isToday);

    // Custom tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-800 text-white p-2 rounded-lg text-sm shadow-lg">
                    <p className="font-medium">{data.label}</p>
                    <p className="text-emerald-400">{data.dueCount} révisions</p>
                    <p className="text-slate-400">~{data.estimatedMinutes} min</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-semibold text-slate-800">
                        Révisions à venir
                    </h3>
                </div>
            </div>

            {/* Chart */}
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={50}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={false}
                            width={30}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="dueCount" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={
                                        entry.isToday
                                            ? '#3b82f6' // Blue for today
                                            : entry.isTomorrow
                                                ? '#f59e0b' // Amber for tomorrow
                                                : '#10b981' // Emerald for others
                                    }
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Summary messages */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                {today && today.dueCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-slate-600">
                            Aujourd'hui: <strong className="text-blue-600">{today.dueCount}</strong> révisions
                        </span>
                    </div>
                )}
                {tomorrow && tomorrow.dueCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="text-slate-600">
                            Demain: <strong className="text-amber-600">{tomorrow.dueCount}</strong> révisions
                            <span className="text-slate-400 ml-1">(~{tomorrow.estimatedMinutes} min)</span>
                        </span>
                    </div>
                )}
                {(!today || today.dueCount === 0) && (!tomorrow || tomorrow.dueCount === 0) && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Clock className="w-4 h-4" />
                        <span>Pas de révision prévue pour bientôt</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ForecastChart;
