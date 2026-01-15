"use client";

import { Bell, Clock, CheckCircle, Send, RefreshCw, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

type Reminder = {
    id: string;
    clientName: string;
    clientPhone: string;
    service: string;
    dateTime: string;
    reminderSent: boolean;
};

type RemindersData = {
    pending: Reminder[];
    sent: Reminder[];
    config: {
        reminderTime: string;
        nextRun: string;
    };
};

export default function RemindersPage() {
    const [data, setData] = useState<RemindersData | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'sent'>('pending');

    const fetchData = async () => {
        try {
            const res = await fetch('http://localhost:3000/appointments/reminders-status', { cache: 'no-store' });
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSendNow = async () => {
        setSending(true);
        try {
            const res = await fetch('http://localhost:3000/appointments/test-reminders');
            if (res.ok) {
                alert('✅ Lembretes disparados! Verifique os logs do backend.');
                fetchData(); // Refresh
            }
        } catch (error) {
            alert('❌ Erro ao enviar lembretes');
        } finally {
            setSending(false);
        }
    };

    const formatDateTime = (dt: string) => {
        const d = new Date(dt);
        return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    };

    return (
        <div className="p-8">
            <header className="mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
                            <Bell className="w-8 h-8 text-amber-400" />
                            Lembretes de Consulta
                        </h1>
                        <p className="text-slate-400 mt-1">Visualize lembretes pendentes e já enviados.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {data?.config && (
                            <div className="text-right">
                                <div className="text-sm text-slate-400">Horário configurado</div>
                                <div className="text-xl font-mono text-amber-400">{data.config.reminderTime}</div>
                            </div>
                        )}
                        <button
                            onClick={handleSendNow}
                            disabled={sending}
                            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            {sending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            Enviar Agora
                        </button>
                        <button
                            onClick={() => { setLoading(true); fetchData(); }}
                            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${activeTab === 'pending'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <Clock className="w-4 h-4" />
                    Pendentes
                    {data?.pending && (
                        <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                            {data.pending.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('sent')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${activeTab === 'sent'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <CheckCircle className="w-4 h-4" />
                    Enviados
                    {data?.sent && (
                        <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                            {data.sent.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Content */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-sm uppercase tracking-wider">
                                <th className="p-4 font-medium">Cliente</th>
                                <th className="p-4 font-medium">Serviço</th>
                                <th className="p-4 font-medium">Data da Consulta</th>
                                <th className="p-4 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {activeTab === 'pending' && data?.pending.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-500">
                                        ✅ Nenhum lembrete pendente para amanhã!
                                    </td>
                                </tr>
                            )}
                            {activeTab === 'sent' && data?.sent.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-500">
                                        Nenhum lembrete enviado nos últimos 7 dias.
                                    </td>
                                </tr>
                            )}
                            {(activeTab === 'pending' ? data?.pending : data?.sent)?.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-medium text-slate-200">{item.clientName}</div>
                                        <div className="text-sm text-slate-500">{item.clientPhone}</div>
                                    </td>
                                    <td className="p-4 text-slate-300">
                                        <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs">
                                            {item.service}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-300 font-mono text-sm">
                                        {formatDateTime(item.dateTime)}
                                    </td>
                                    <td className="p-4">
                                        {item.reminderSent ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                <CheckCircle className="w-3 h-3" /> Enviado
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                <Clock className="w-3 h-3" /> Pendente
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
