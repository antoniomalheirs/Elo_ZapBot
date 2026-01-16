"use client";

import { Calendar, CheckCircle, Clock, XCircle, Plus, X, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

type Appointment = {
    id: string;
    dateTime: string;
    service: string;
    status: string;
    user: {
        name: string | null;
        phone: string;
    };
};

type Service = {
    name: string;
    price: number;
};

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [services, setServices] = useState<Service[]>([]);
    const [formLoading, setFormLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [formData, setFormData] = useState({
        clientName: '',
        clientPhone: '',
        service: '',
        date: '',
        time: '',
        notes: ''
    });

    // Fetch appointments
    const fetchAppointments = async () => {
        try {
            const res = await fetch('http://localhost:3000/appointments', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setAppointments(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch services from settings
    const fetchServices = async () => {
        try {
            const res = await fetch('http://localhost:3000/settings', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setServices(data.services || [
                    { name: 'Terapia Individual', price: 150 },
                    { name: 'Avaliação Psicológica', price: 800 }
                ]);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchAppointments();
        fetchServices();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);

        try {
            const res = await fetch('http://localhost:3000/appointments/create-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await res.json();

            if (result.success) {
                alert('✅ Agendamento criado com sucesso!');
                setShowModal(false);
                setFormData({ clientName: '', clientPhone: '', service: '', date: '', time: '', notes: '' });
                fetchAppointments(); // Refresh list
            } else {
                alert('❌ Erro: ' + result.error);
            }
        } catch (error) {
            alert('❌ Erro ao criar agendamento');
            console.error(error);
        } finally {
            setFormLoading(false);
        }
    };

    return (
        <div className="p-8">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Agendamentos</h1>
                    <p className="text-slate-400 mt-1">Gerencie consultas e horários.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Novo Agendamento
                </button>
            </header>

            {/* Abas */}
            <div className="flex gap-4 mb-6 border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'active'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    Próximos
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 px-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'history'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    Histórico
                </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 text-sm uppercase tracking-wider">
                            <th className="p-4 font-medium">Cliente</th>
                            <th className="p-4 font-medium">Serviço</th>
                            <th className="p-4 font-medium">Data e Hora</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-500">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                                </td>
                            </tr>
                        ) : (
                            appointments.filter(apt => {
                                const isPast = new Date(apt.dateTime) < new Date();
                                if (activeTab === 'active') {
                                    return apt.status === 'PENDING' || (apt.status === 'CONFIRMED' && !isPast);
                                }
                                return ['COMPLETED', 'CANCELLED'].includes(apt.status) || (apt.status === 'CONFIRMED' && isPast);
                            }).length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        {activeTab === 'active'
                                            ? 'Nenhum agendamento futuro.'
                                            : 'Nenhum histórico encontrado.'}
                                    </td>
                                </tr>
                            ) : (
                                appointments.filter(apt => {
                                    const isPast = new Date(apt.dateTime) < new Date();
                                    if (activeTab === 'active') {
                                        return apt.status === 'PENDING' || (apt.status === 'CONFIRMED' && !isPast);
                                    }
                                    return ['COMPLETED', 'CANCELLED'].includes(apt.status) || (apt.status === 'CONFIRMED' && isPast);
                                }).map((apt) => (
                                    <tr key={apt.id} className="group hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-medium text-slate-200">{apt.user.name || 'Sem nome'}</div>
                                            <div className="text-sm text-slate-500">{apt.user.phone}</div>
                                        </td>
                                        <td className="p-4 text-slate-300">
                                            <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs">
                                                {apt.service}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-300 font-mono text-sm">
                                            {new Date(apt.dateTime).toLocaleDateString('pt-BR')} às {new Date(apt.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="p-4">
                                            <StatusBadge status={apt.status} />
                                        </td>
                                        <td className="p-4 text-right">
                                            <button className="text-indigo-400 hover:text-indigo-300 font-medium text-sm">
                                                Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Novo Agendamento */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-100">Novo Agendamento</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Nome do Cliente</label>
                                <input
                                    type="text"
                                    value={formData.clientName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="João Silva"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Telefone *</label>
                                <input
                                    type="tel"
                                    value={formData.clientPhone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, clientPhone: e.target.value }))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="27999999999"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Serviço *</label>
                                <select
                                    value={formData.service}
                                    onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value }))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                >
                                    <option value="">Selecione...</option>
                                    {services.map((s) => (
                                        <option key={s.name} value={s.name}>{s.name} - R${s.price}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Data *</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Horário *</label>
                                    <input
                                        type="time"
                                        value={formData.time}
                                        onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Observações</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    rows={2}
                                    placeholder="Observações adicionais..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={formLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {formLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Criando...
                                    </>
                                ) : (
                                    <>
                                        <Calendar className="w-4 h-4" />
                                        Criar Agendamento
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const s = status.toUpperCase();
    if (s === 'CONFIRMED') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle className="w-3 h-3" /> Confirmado
            </span>
        );
    }
    if (s === 'PENDING') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-3 h-3" /> Pendente
            </span>
        );
    }
    if (s === 'CANCELLED') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <XCircle className="w-3 h-3" /> Cancelado
            </span>
        );
    }
    if (s === 'COMPLETED') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <CheckCircle className="w-3 h-3" /> Realizada
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600">
            {status}
        </span>
    );
}
