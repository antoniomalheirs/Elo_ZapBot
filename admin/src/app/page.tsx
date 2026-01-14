"use client";

import { Calendar, MessageSquare, User, TrendingUp, Clock, Activity, ArrowUpRight, ArrowDownLeft, Users, PhoneCall, Bot, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

interface Stats {
  total: number;
  today: number;
  pending: number;
}

interface ChartData {
  days: string[];
  appointments: number[];
  messages: number[];
}

interface BusinessStats {
  handoffs: { today: number; week: number; month: number };
  newPatients: { today: number; week: number; month: number };
  messages: { today: number; week: number };
  appointments: { thisMonth: number; lastMonth: number; growth: number; byStatus: any[] };
  conversations: { byState: any[] };
  autoResolutionRate: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, pending: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [intentData, setIntentData] = useState<any[]>([]);
  const [nextAppointments, setNextAppointments] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);
  const [businessStats, setBusinessStats] = useState<BusinessStats | null>(null);
  const [wsStatus, setWsStatus] = useState<any>({ connected: false, qrCode: null });
  const [loading, setLoading] = useState(true);

  // Poll WhatsApp Status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('http://localhost:3000/whatsapp/status');
        const data = await res.json();
        setWsStatus(data);
      } catch (e) {
        setWsStatus({ connected: false });
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000); // 10s polling
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, chartRes, intentRes, nextRes, activityRes, reportsRes, businessRes] = await Promise.all([
          fetch('http://localhost:3000/appointments/stats', { cache: 'no-store' }),
          fetch('http://localhost:3000/appointments/chart-data', { cache: 'no-store' }),
          fetch('http://localhost:3000/orchestrator/stats/intents', { cache: 'no-store' }),
          fetch('http://localhost:3000/appointments/next?limit=5', { cache: 'no-store' }),
          fetch('http://localhost:3000/orchestrator/activity?limit=10', { cache: 'no-store' }),
          fetch('http://localhost:3000/appointments/reports', { cache: 'no-store' }),
          fetch('http://localhost:3000/orchestrator/stats/business', { cache: 'no-store' })
        ]);

        const statsData = await statsRes.json();
        const chartRaw: ChartData = await chartRes.json();
        const intents = await intentRes.json();
        const next = await nextRes.json();
        const activity = await activityRes.json();
        const reports = await reportsRes.json();
        const business = await businessRes.json();

        setStats(statsData);
        setIntentData(intents);
        setNextAppointments(next);
        setActivityFeed(activity);
        setReportsData(reports);
        setBusinessStats(business);

        // Transform chart data for Recharts
        const transformedChart = chartRaw.days.map((day, i) => ({
          name: day,
          Agendamentos: chartRaw.appointments[i],
          Mensagens: chartRaw.messages[i]
        }));
        setChartData(transformedChart);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Auto-refresh a cada 30 segundos
    const refreshInterval = setInterval(fetchData, 30000);
    return () => clearInterval(refreshInterval);
  }, []);

  const COLORS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#60a5fa'];

  return (
    <div className="p-8 space-y-8 bg-[#0f172a] min-h-screen text-slate-100 font-sans">
      {/* Header & Status */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Mission Control
          </h1>
          <p className="text-slate-400 mt-2 text-sm tracking-wide uppercase font-semibold">Visão Geral do Sistema</p>
        </div>

        <div className="flex items-center gap-4">
          <a href="/simulator" className="group px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-full font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 text-sm">
            <span>🎮 Simulador</span>
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </a>

          <div className={`px-4 py-2 rounded-full border flex items-center gap-3 transition-colors ${wsStatus.connected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${wsStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="font-semibold text-xs tracking-wide">{wsStatus.connected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
        </div>
      </header>

      {/* KPI Cards - Row 1: Main Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KPICard
          title="Consultas Hoje"
          value={stats.today.toString()}
          icon={<Calendar className="w-5 h-5 text-white" />}
          gradient="from-indigo-500 to-blue-500"
        />
        <KPICard
          title="Fila"
          value={stats.pending.toString()}
          icon={<Clock className="w-5 h-5 text-white" />}
          gradient="from-amber-500 to-orange-500"
        />
        <KPICard
          title="Total Mês"
          value={businessStats?.appointments.thisMonth.toString() || '0'}
          subtitle={businessStats?.appointments.growth !== undefined ?
            `${businessStats.appointments.growth >= 0 ? '↑' : '↓'} ${Math.abs(businessStats.appointments.growth)}%` : ''}
          icon={<TrendingUp className="w-5 h-5 text-white" />}
          gradient="from-violet-500 to-fuchsia-500"
        />
        <KPICard
          title="Handoffs"
          value={businessStats?.handoffs.month.toString() || '0'}
          subtitle={`Hoje: ${businessStats?.handoffs.today || 0}`}
          icon={<PhoneCall className="w-5 h-5 text-white" />}
          gradient="from-rose-500 to-pink-500"
        />
        <KPICard
          title="Novos Pacientes"
          value={businessStats?.newPatients.month.toString() || '0'}
          subtitle={`Hoje: ${businessStats?.newPatients.today || 0}`}
          icon={<UserPlus className="w-5 h-5 text-white" />}
          gradient="from-emerald-500 to-teal-500"
        />
        <KPICard
          title="Resolução Bot"
          value={`${businessStats?.autoResolutionRate || 0}%`}
          icon={<Bot className="w-5 h-5 text-white" />}
          gradient="from-cyan-500 to-blue-500"
        />
        <KPICard
          title="Cancelamentos"
          value={reportsData?.cancellationRate || '0%'}
          icon={<Activity className="w-5 h-5 text-white" />}
          gradient="from-slate-500 to-gray-600"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Charts & Upcoming */}
        <div className="lg:col-span-2 space-y-8">

          {/* Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-800 rounded-lg">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="font-semibold text-lg text-slate-100">Performance Semanal</h3>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorApts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="Agendamentos" stroke="#818cf8" fill="url(#colorApts)" strokeWidth={3} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming Appointments Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-800 rounded-lg">
                <Clock className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-lg text-slate-100">Próximos Agendamentos</h3>
            </div>

            <div className="overflow-hidden">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="border-b border-slate-800 text-xs uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="pb-3 pl-2">Paciente</th>
                    <th className="pb-3">Serviço</th>
                    <th className="pb-3">Data & Hora</th>
                    <th className="pb-3 text-right pr-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {nextAppointments.map((apt: any) => (
                    <tr key={apt.id} className="group hover:bg-slate-800/50 transition-colors">
                      <td className="py-4 pl-2 font-medium text-slate-200">{apt.user.name || apt.user.phone}</td>
                      <td className="py-4 text-slate-400">{apt.service}</td>
                      <td className="py-4 text-indigo-400 tabular-nums">
                        {new Date(apt.dateTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} •
                        {new Date(apt.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-4 text-right pr-2">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase tracking-wide">Confirmado</span>
                      </td>
                    </tr>
                  ))}
                  {nextAppointments.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-slate-600">Nenhum agendamento futuro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Activity & Intents */}
        <div className="space-y-8">

          {/* Real-time Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl h-[500px] flex flex-col">
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <div className="p-2 bg-slate-800 rounded-lg relative">
                <Activity className="w-5 h-5 text-amber-400" />
                <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
              </div>
              <h3 className="font-semibold text-lg text-slate-100">Atividade Recente</h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
              {activityFeed.map((msg: any) => (
                <div key={msg.id} className="flex gap-3 text-xs p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className={`mt-1 shrink-0 ${msg.direction === 'INBOUND' ? 'text-blue-400' : 'text-purple-400'}`}>
                    {msg.direction === 'INBOUND' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className={`font-bold ${msg.direction === 'INBOUND' ? 'text-blue-300' : 'text-purple-300'}`}>
                        {msg.direction === 'INBOUND' ? 'Cliente' : 'Bot'}
                      </span>
                      <span className="text-slate-500 text-[10px] tabular-nums">
                        {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-300 truncate">{msg.content}</p>
                    {msg.intent && (
                      <span className="inline-block mt-2 px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 text-[10px]">
                        {msg.intent}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {activityFeed.length === 0 && (
                <div className="text-center text-slate-600 py-10">Nada acontecendo agora...</div>
              )}
            </div>
          </div>

          {/* Intents Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-800 rounded-lg">
                <TrendingUp className="w-5 h-5 text-pink-400" />
              </div>
              <h3 className="font-semibold text-lg text-slate-100">Top Intenções</h3>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={intentData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                    {intentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Popular Hours */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-slate-800 rounded-lg">
                <Clock className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="font-semibold text-lg text-slate-100">Horários Populares</h3>
            </div>
            <div className="space-y-3">
              {reportsData?.popularHours?.slice(0, 4).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-slate-400">{String(item.hour).padStart(2, '0')}:00</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 bg-cyan-500/30 rounded-full" style={{ width: `${Math.min(item.count * 15, 100)}px` }}>
                      <div className="h-full bg-cyan-500 rounded-full" style={{ width: '100%' }} />
                    </div>
                    <span className="text-cyan-400 font-medium text-sm">{item.count}</span>
                  </div>
                </div>
              ))}
              {(!reportsData?.popularHours || reportsData.popularHours.length === 0) && (
                <p className="text-slate-600 text-sm">Sem dados suficientes</p>
              )}
            </div>
          </div>

          {/* Popular Services */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-slate-800 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-lg text-slate-100">Serviços Top</h3>
            </div>
            <div className="space-y-3">
              {reportsData?.popularServices?.slice(0, 4).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm truncate max-w-[120px]">{item.name}</span>
                  <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full text-xs font-medium">{item.count}</span>
                </div>
              ))}
              {(!reportsData?.popularServices || reportsData.popularServices.length === 0) && (
                <p className="text-slate-600 text-sm">Sem dados suficientes</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, gradient }: { title: string, value: string, icon: any, gradient: string }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl p-[1px] bg-slate-800 hover:bg-gradient-to-br transition-all duration-500 bg-gradient-to-br from-slate-700 to-slate-800">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br ${gradient} transition-opacity duration-500 blur-xl`}></div>
      <div className="relative h-full bg-slate-900 rounded-[23px] p-6 flex items-center justify-between overflow-hidden">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
        </div>
        <div className={`p-4 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
