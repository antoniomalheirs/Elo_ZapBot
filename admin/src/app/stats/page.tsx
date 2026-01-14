"use client";

import { useEffect, useState } from 'react';
import {
    BarChart3, Calendar, Users, PhoneCall, Bot, TrendingUp, TrendingDown,
    MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, ArrowUpRight
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';

interface BusinessStats {
    handoffs: { today: number; week: number; month: number };
    newPatients: { today: number; week: number; month: number };
    messages: { today: number; week: number };
    appointments: { thisMonth: number; lastMonth: number; growth: number; byStatus: any[] };
    conversations: { byState: any[] };
    autoResolutionRate: number;
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

export default function StatsPage() {
    const [businessStats, setBusinessStats] = useState<BusinessStats | null>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [intentData, setIntentData] = useState<any[]>([]);
    const [reportsData, setReportsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [businessRes, chartRes, intentRes, reportsRes] = await Promise.all([
                    fetch('http://localhost:3000/orchestrator/stats/business', { cache: 'no-store' }),
                    fetch('http://localhost:3000/appointments/chart-data', { cache: 'no-store' }),
                    fetch('http://localhost:3000/orchestrator/stats/intents', { cache: 'no-store' }),
                    fetch('http://localhost:3000/appointments/reports', { cache: 'no-store' })
                ]);

                const business = await businessRes.json();
                const chart = await chartRes.json();
                const intents = await intentRes.json();
                const reports = await reportsRes.json();

                setBusinessStats(business);
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
    }, []);

    if (loading) {
        return (
            <div className="p-8 bg-[#0f172a] min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 bg-[#0f172a] min-h-screen text-slate-100">
            {/* Header */}
            <header className="border-b border-slate-800 pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-xl">
                        <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-100">Estatísticas Detalhadas</h1>
                        <p className="text-slate-400 text-sm">Análise completa do desempenho do sistema</p>
                    </div>
                </div>
            </header>

            {/* Summary Cards - Row 1 */}
            <section>
                <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    Resumo do Período
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <StatCard
                        label="Consultas Mês"
                        value={businessStats?.appointments.thisMonth || 0}
                        trend={businessStats?.appointments.growth}
                        icon={<Calendar className="w-5 h-5" />}
                        color="indigo"
                    />
                    <StatCard
                        label="Mês Anterior"
                        value={businessStats?.appointments.lastMonth || 0}
                        icon={<Calendar className="w-5 h-5" />}
                        color="slate"
                    />
                    <StatCard
                        label="Novos Pacientes"
                        value={businessStats?.newPatients.month || 0}
                        subValue={`Hoje: ${businessStats?.newPatients.today || 0}`}
                        icon={<Users className="w-5 h-5" />}
                        color="emerald"
                    />
                    <StatCard
                        label="Handoffs"
                        value={businessStats?.handoffs.month || 0}
                        subValue={`Semana: ${businessStats?.handoffs.week || 0}`}
                        icon={<PhoneCall className="w-5 h-5" />}
                        color="rose"
                    />
                    <StatCard
                        label="Resolução Bot"
                        value={`${businessStats?.autoResolutionRate || 0}%`}
                        icon={<Bot className="w-5 h-5" />}
                        color="cyan"
                    />
                    <StatCard
                        label="Mensagens Semana"
                        value={businessStats?.messages.week || 0}
                        subValue={`Hoje: ${businessStats?.messages.today || 0}`}
                        icon={<MessageSquare className="w-5 h-5" />}
                        color="violet"
                    />
                </div>
            </section>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Weekly Performance Chart */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                        Performance Semanal
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorAgendamentos" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorMensagens" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                    labelStyle={{ color: '#94a3b8' }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="Agendamentos" stroke="#818cf8" fill="url(#colorAgendamentos)" strokeWidth={2} />
                                <Area type="monotone" dataKey="Mensagens" stroke="#34d399" fill="url(#colorMensagens)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Appointments by Status */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        Consultas por Status (Mês)
                    </h3>
                    <div className="h-72 flex items-center">
                        <div className="w-1/2 h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={businessStats?.appointments.byStatus || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="count"
                                        nameKey="status"
                                    >
                                        {(businessStats?.appointments.byStatus || []).map((entry, index) => (
                                            <Cell key={index} fill={STATUS_COLORS[entry.status] || COLORS[index]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 space-y-2">
                            {(businessStats?.appointments.byStatus || []).map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[item.status] || COLORS[i] }} />
                                        <span className="text-slate-400">{item.status}</span>
                                    </div>
                                    <span className="font-semibold text-slate-200">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Conversation States */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-violet-400" />
                        Estados das Conversas
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={businessStats?.conversations.byState || []} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" stroke="#64748b" fontSize={12} />
                                <YAxis dataKey="state" type="category" stroke="#64748b" fontSize={10} width={120} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                    {(businessStats?.conversations.byState || []).map((entry, index) => (
                                        <Cell key={index} fill={STATE_COLORS[entry.state] || COLORS[index]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Intents */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                        <Bot className="w-5 h-5 text-pink-400" />
                        Top Intenções Detectadas
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={intentData.slice(0, 8)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" stroke="#64748b" fontSize={12} />
                                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={120} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                />
                                <Bar dataKey="value" fill="#818cf8" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Popular Hours & Services */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Popular Hours */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-cyan-400" />
                        Horários Mais Procurados
                    </h3>
                    <div className="space-y-3">
                        {(reportsData?.popularHours || []).slice(0, 6).map((item: any, i: number) => (
                            <div key={i} className="flex items-center gap-4">
                                <span className="text-slate-500 w-16 text-sm font-mono">{String(item.hour).padStart(2, '0')}:00</span>
                                <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                                        style={{ width: `${Math.min((item.count / (reportsData?.popularHours?.[0]?.count || 1)) * 100, 100)}%` }}
                                    />
                                </div>
                                <span className="text-cyan-400 font-semibold w-8 text-right">{item.count}</span>
                            </div>
                        ))}
                        {(!reportsData?.popularHours || reportsData.popularHours.length === 0) && (
                            <p className="text-slate-600 text-center py-8">Sem dados suficientes</p>
                        )}
                    </div>
                </div>

                {/* Popular Services */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                        Serviços Mais Agendados
                    </h3>
                    <div className="space-y-3">
                        {(reportsData?.popularServices || []).slice(0, 6).map((item: any, i: number) => (
                            <div key={i} className="flex items-center gap-4">
                                <span className="text-slate-400 flex-1 text-sm truncate">{item.name}</span>
                                <div className="w-32 h-4 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                                        style={{ width: `${Math.min((item.count / (reportsData?.popularServices?.[0]?.count || 1)) * 100, 100)}%` }}
                                    />
                                </div>
                                <span className="text-emerald-400 font-semibold w-8 text-right">{item.count}</span>
                            </div>
                        ))}
                        {(!reportsData?.popularServices || reportsData.popularServices.length === 0) && (
                            <p className="text-slate-600 text-center py-8">Sem dados suficientes</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({
    label, value, subValue, trend, icon, color
}: {
    label: string;
    value: number | string;
    subValue?: string;
    trend?: number;
    icon: React.ReactNode;
    color: 'indigo' | 'emerald' | 'rose' | 'cyan' | 'violet' | 'slate' | 'amber';
}) {
    const colorClasses = {
        indigo: 'from-indigo-500 to-blue-500 text-indigo-400',
        emerald: 'from-emerald-500 to-teal-500 text-emerald-400',
        rose: 'from-rose-500 to-pink-500 text-rose-400',
        cyan: 'from-cyan-500 to-blue-500 text-cyan-400',
        violet: 'from-violet-500 to-purple-500 text-violet-400',
        slate: 'from-slate-500 to-gray-500 text-slate-400',
        amber: 'from-amber-500 to-orange-500 text-amber-400'
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</span>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClasses[color].split(' ').slice(0, 2).join(' ')} bg-opacity-20`}>
                    <div className={colorClasses[color].split(' ')[2]}>{icon}</div>
                </div>
            </div>
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-2xl font-bold text-slate-100">{value}</p>
                    {subValue && <p className="text-xs text-slate-500">{subValue}</p>}
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
        </div>
    );
}
