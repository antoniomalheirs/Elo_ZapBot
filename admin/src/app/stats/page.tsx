"use client";

import React, { useEffect, useState } from 'react';
import {
    BarChart3, Calendar, Users, PhoneCall, Bot, TrendingUp, TrendingDown,
    MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, ArrowUpRight,
    Filter, Activity, RefreshCw, Zap, Download, Funnel
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, Legend, ComposedChart, Line
} from 'recharts';

interface BusinessStats {
    handoffs: { today: number; week: number; month: number };
    newPatients: { today: number; week: number; month: number };
    messages: { today: number; week: number };
    appointments: { thisMonth: number; lastMonth: number; growth: number; byStatus: any[] };
    conversations: { byState: any[] };
    autoResolutionRate: number;
}

interface AdvancedStats {
    period: string;
    conversion: { current: number; previous: number; diff: number };
    retention: { rate: number; newPatients: number; returning: number };
    heatmap: { day: number; hour: number; count: number }[];
    responseTime: { avg: number; diff: number };
    funnel?: { stage: string; count: number; fill: string }[];
    missedOpportunities?: number;
}

const COLORS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#a78bfa', '#fb923c'];

const STATUS_COLORS: Record<string, string> = {
    PENDING: '#fbbf24',
    CONFIRMED: '#34d399',
    CANCELLED: '#f87171',
    COMPLETED: '#818cf8',
    NO_SHOW: '#94a3b8'
};

const STATE_COLORS: Record<string, string> = {
    INIT: '#60a5fa',
    AUTO_ATTENDANCE: '#34d399',
    FAQ_FLOW: '#818cf8',
    SCHEDULING_FLOW: '#fbbf24',
    HUMAN_HANDOFF: '#f87171',
    COMPLETED: '#a78bfa',
    PAUSED: '#94a3b8'
};

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function StatsPage() {
    const [period, setPeriod] = useState('month');
    const [businessStats, setBusinessStats] = useState<BusinessStats | null>(null);
    const [advancedStats, setAdvancedStats] = useState<AdvancedStats | null>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [intentData, setIntentData] = useState<any[]>([]);
    const [reportsData, setReportsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            // setLoading(true); // Optional: show loading state on period change
            try {
                const [businessRes, advancedRes, chartRes, intentRes, reportsRes] = await Promise.all([
                    fetch('http://localhost:3000/orchestrator/stats/business', { cache: 'no-store' }),
                    fetch(`http://localhost:3000/orchestrator/stats/advanced?period=${period}`, { cache: 'no-store' }),
                    fetch('http://localhost:3000/appointments/chart-data', { cache: 'no-store' }),
                    fetch('http://localhost:3000/orchestrator/stats/intents', { cache: 'no-store' }),
                    fetch('http://localhost:3000/appointments/reports', { cache: 'no-store' })
                ]);

                const business = await businessRes.json();
                const advanced = await advancedRes.json();
                const chart = await chartRes.json();
                const intents = await intentRes.json();
                const reports = await reportsRes.json();

                setBusinessStats(business);
                setAdvancedStats(advanced);
                setIntentData(intents);
                setReportsData(reports);

                // Transform chart data
                const transformedChart = chart.days.map((day: string, i: number) => ({
                    name: day,
                    Agendamentos: chart.appointments[i],
                    Mensagens: chart.messages[i]
                }));
                setChartData(transformedChart);
            } catch (error) {
                console.error('Erro ao buscar estatísticas:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [period]);

    const handleExport = () => {
        if (!businessStats || !advancedStats) return;

        const csvContent = [
            ['Metrica', 'Valor'],
            ['Periodo', period],
            ['Total Consultas', businessStats.appointments.thisMonth],
            ['Novos Pacientes', businessStats.newPatients.month],
            ['Taxa Conversao', `${advancedStats.conversion.current}%`],
            ['Taxa Retencao', `${advancedStats.retention.rate}%`],
            ['Handoffs', businessStats.handoffs.month],
            ['Resolucao Bot', `${businessStats.autoResolutionRate}%`],
            ['Missed Opps', advancedStats.missedOpportunities || 0]
        ].map(e => e.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `zapbot_stats_${period}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const getHeatmapColor = (count: number, max: number) => {
        if (count === 0) return 'bg-slate-800/50';
        const intensity = Math.ceil((count / max) * 4);
        switch (intensity) {
            case 1: return 'bg-indigo-500/30';
            case 2: return 'bg-indigo-500/50';
            case 3: return 'bg-indigo-500/70';
            case 4: return 'bg-indigo-500';
            default: return 'bg-indigo-500';
        }
    };

    if (loading) {
        return (
            <div className="p-8 bg-[#0f172a] min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    const maxHeatmapValue = advancedStats?.heatmap.reduce((max, item) => Math.max(max, item.count), 0) || 1;

    return (
        <div className="p-8 space-y-8 bg-[#0f172a] min-h-screen text-slate-100">
            {/* Header & Filters */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-800 pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                        <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Estatísticas Avançadas</h1>
                        <p className="text-slate-400 text-sm font-medium">Análise de performance e inteligência de negócio</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                        {['week', 'month', 'year'].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === p
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                    }`}
                            >
                                {p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Ano'}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors font-medium text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Exportar CSV
                    </button>
                </div>
            </header>

            {/* Advanced Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Taxa de Conversão"
                    value={`${advancedStats?.conversion.current}%`}
                    trend={advancedStats?.conversion.diff}
                    icon={<RefreshCw className="w-5 h-5" />}
                    color="emerald"
                    info="Visitantes que agendaram"
                />
                <StatCard
                    label="Taxa de Retenção"
                    value={`${advancedStats?.retention.rate}%`}
                    subValue={`${advancedStats?.retention.returning} recorrentes`}
                    icon={<Users className="w-5 h-5" />}
                    color="violet"
                    info="Pacientes que retornaram"
                />
                <StatCard
                    label="Funnel Drop-off"
                    value={advancedStats?.missedOpportunities || 0}
                    icon={<Funnel className="w-5 h-5" />}
                    color="amber"
                    info="Oportunidades perdidas"
                    invertTrend // High number is bad
                />
                <StatCard
                    label="Handoffs"
                    value={businessStats?.handoffs.month || 0}
                    subValue={`Hoje: ${businessStats?.handoffs.today || 0}`}
                    icon={<PhoneCall className="w-5 h-5" />}
                    color="rose"
                />
            </div>

            {/* Charts Visualization Row 1: Funnel & Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sales Funnel */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                        <Funnel className="w-5 h-5 text-indigo-400" />
                        Funil de Conversão
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={advancedStats?.funnel || []} layout="vertical" margin={{ left: 40, right: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                <XAxis type="number" stroke="#64748b" hide />
                                <YAxis dataKey="stage" type="category" stroke="#94a3b8" fontSize={12} width={100} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#334155', opacity: 0.2 }}
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
                                    {advancedStats?.funnel?.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Heatmap Section */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-orange-400" />
                            Mapa de Calor
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="text-[10px]">Menos</span>
                            <div className="flex gap-0.5">
                                {[1, 2, 3, 4].map(i => <div key={i} className={`w-2 h-2 rounded-sm bg-indigo-500/${i * 25 + 25}`} />)}
                            </div>
                            <span className="text-[10px]">Mais</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <div className="min-w-[500px]">
                            <div className="grid grid-cols-[auto_repeat(24,1fr)] gap-0.5">
                                <div className="h-4"></div>
                                {/* Heatmap Hour Labels */}
                                {HOURS.filter(h => h % 3 === 0).map(h => (
                                    <div key={h} className="text-[9px] text-slate-500 col-span-3 text-center">{h}h</div>
                                ))}

                                {DAYS.map((day, dayIndex) => (
                                    <React.Fragment key={`day-${dayIndex}`}>
                                        <div className="text-[10px] font-medium text-slate-400 flex items-center h-6 pr-2">
                                            {day.slice(0, 1)}
                                        </div>
                                        {HOURS.map(hour => {
                                            const dataPoint = advancedStats?.heatmap.find(d => d.day === dayIndex && d.hour === hour);
                                            const count = dataPoint?.count || 0;
                                            return (
                                                <div
                                                    key={`${dayIndex}-${hour}`}
                                                    className={`h-6 rounded-sm transition-all hover:scale-125 relative group ${getHeatmapColor(count, maxHeatmapValue)}`}
                                                    title={`${day} ${hour}h: ${count} msgs`}
                                                />
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comparison Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                        Tendência e Comparativo
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorAgendamentos" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="Agendamentos" stroke="#818cf8" fill="url(#colorAgendamentos)" strokeWidth={3} />
                                <Area type="monotone" dataKey="Mensagens" stroke="#34d399" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-violet-400" />
                            Distribuição de Estados
                        </h3>
                        <span className="text-xs text-slate-500 font-medium bg-slate-800 px-2 py-1 rounded-full">Total: {businessStats?.conversations.byState.reduce((a, b) => a + b.count, 0)}</span>
                    </div>

                    <div className="space-y-4">
                        {businessStats?.conversations.byState.sort((a, b) => b.count - a.count).map((item: any, i: number) => (
                            <div key={i} className="group">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-400 group-hover:text-slate-200 transition-colors">{item.state}</span>
                                    <span className="font-medium text-slate-300">{item.count}</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${Math.max((item.count / (businessStats?.conversations.byState[0].count)) * 100, 5)}%`,
                                            backgroundColor: STATE_COLORS[item.state] || '#94a3b8'
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({
    label, value, subValue, trend, icon, color, invertTrend, info
}: {
    label: string;
    value: number | string;
    subValue?: string;
    trend?: number;
    icon: React.ReactNode;
    color: 'indigo' | 'emerald' | 'rose' | 'cyan' | 'violet' | 'slate' | 'amber';
    invertTrend?: boolean;
    info?: string;
}) {
    const colorClasses = {
        indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
        slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    };

    const isPositive = trend && trend >= 0;
    // If invertTrend is true, lower is better (e.g. response time, missed opps)
    const isGood = invertTrend ? !isPositive : isPositive;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all hover:shadow-lg group relative overflow-hidden">
            <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${colorClasses[color].split(' ')[1]}`}>
                {icon}
            </div>

            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg border ${colorClasses[color]}`}>
                    {icon}
                </div>
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</span>
            </div>

            <div className="flex items-end justify-between relative z-10">
                <div>
                    <h4 className="text-3xl font-bold text-slate-100 tracking-tight">{value}</h4>
                    {subValue && <span className="text-xs text-slate-500 font-medium">{subValue}</span>}
                </div>

                {trend !== undefined && (
                    <div className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full ${isGood ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            {info && (
                <div className="mt-3 pt-3 border-t border-slate-800/50">
                    <span className="text-[10px] text-slate-600 font-medium">{info}</span>
                </div>
            )}
        </div>
    );
}
