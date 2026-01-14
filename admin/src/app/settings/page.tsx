"use client";

import { Save, Clock, DollarSign, MapPin, Loader2, Check, Lock, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface BlockedSlot {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    reason?: string;
}

export default function SettingsPage() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [config, setConfig] = useState<any>({});

    // Blocked Slots State
    const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
    const [newBlock, setNewBlock] = useState({ date: '', startTime: '', endTime: '', reason: '' });
    const [blockLoading, setBlockLoading] = useState(false);

    // Fetch initial settings and blocked slots
    useEffect(() => {
        fetch('http://localhost:3000/settings', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setConfig(data))
            .catch(err => console.error("Erro ao carregar configs:", err));

        fetch('http://localhost:3000/appointments/blocked-slots', { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setBlockedSlots(data))
            .catch(err => console.error("Erro ao carregar bloqueios:", err));
    }, []);

    const handleAddBlock = async () => {
        if (!newBlock.date || !newBlock.startTime || !newBlock.endTime) return;
        setBlockLoading(true);
        try {
            const res = await fetch('http://localhost:3000/appointments/blocked-slots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBlock)
            });
            if (res.ok) {
                const created = await res.json();
                setBlockedSlots(prev => [...prev, created]);
                setNewBlock({ date: '', startTime: '', endTime: '', reason: '' });
            }
        } catch (e) { console.error(e); }
        setBlockLoading(false);
    };

    const handleDeleteBlock = async (id: string) => {
        try {
            await fetch(`http://localhost:3000/appointments/blocked-slots/${id}`, { method: 'DELETE' });
            setBlockedSlots(prev => prev.filter(b => b.id !== id));
        } catch (e) { console.error(e); }
    };

    const handleChange = (key: string, value: any) => {
        setConfig((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSuccess(false);

        try {
            const res = await fetch('http://localhost:3000/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 pb-28">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-100">Configurações</h1>
                <p className="text-slate-400 mt-1">Personalize as informações da sua clínica.</p>
            </header>

            <form onSubmit={handleSave} className="space-y-8">
                {/* Grid de 2 colunas para seções menores */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Seção Nome da Clínica */}
                    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                            </div>
                            <h2 className="text-xl font-semibold text-slate-200">Identidade da Clínica</h2>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Nome da Clínica</label>
                            <input
                                type="text"
                                placeholder="Ex: Clínica Psicologia Viva"
                                value={config.clinicName || ""}
                                onChange={(e) => handleChange('clinicName', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-violet-500 outline-none transition-all placeholder:text-slate-600 text-lg"
                            />
                            <p className="text-xs text-slate-500 mt-2">Este nome será usado na mensagem de boas-vindas do bot.</p>
                        </div>
                    </section>

                    {/* Seção Endereço (ATUALIZADA) */}
                    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-200">Localização</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm text-slate-400 mb-2">Endereço Completo</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Rua das Flores, 123 - Centro"
                                    value={config.clinicAddress || ""}
                                    onChange={(e) => handleChange('clinicAddress', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none transition-all placeholder:text-slate-600"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Cidade/Estado</label>
                                <input
                                    type="text"
                                    placeholder="Ex: São Paulo - SP"
                                    value={config.clinicCity || ""}
                                    onChange={(e) => handleChange('clinicCity', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none transition-all placeholder:text-slate-600"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-3">Este endereço será enviado pelo bot quando perguntarem "onde fica".</p>
                    </section>

                    {/* Seção Notificações (NOVO) */}
                    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                            </div>
                            <h2 className="text-xl font-semibold text-slate-200">Notificações</h2>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Celular do Administrador (com DDD)</label>
                            <input
                                type="text"
                                placeholder="Ex: 5511999999999"
                                value={config.adminPhone || ""}
                                onChange={(e) => handleChange('adminPhone', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-yellow-500 outline-none transition-all placeholder:text-slate-600"
                            />
                            <p className="text-xs text-slate-500 mt-2">Número que receberá avisos quando alguém pedir para falar com atendente. (Formato: 55 + DDD + Número)</p>
                        </div>
                    </section>

                    {/* Seção Horários de Funcionamento */}
                    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                <Clock className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-200">Horário de Funcionamento</h2>
                        </div>

                        {/* Dias da Semana */}
                        <div className="mb-6">
                            <label className="block text-sm text-slate-400 mb-3">Dias de Atendimento</label>
                            <div className="flex flex-wrap gap-2">
                                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day, idx) => {
                                    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                                    const isActive = config.workDays?.[dayKeys[idx]] ?? (idx < 5); // Default: Seg-Sex
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => {
                                                const newWorkDays = { ...(config.workDays || {}), [dayKeys[idx]]: !isActive };
                                                handleChange('workDays', newWorkDays);
                                            }}
                                            className={`px-4 py-2 rounded-lg font-medium transition-all ${isActive
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                }`}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">Selecione os dias que a clínica funciona.</p>
                        </div>

                        {/* Horário de Abertura e Fechamento */}
                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Abertura</label>
                                <input
                                    type="time"
                                    value={config.openTime || "09:00"}
                                    onChange={(e) => handleChange('openTime', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Fechamento</label>
                                <input
                                    type="time"
                                    value={config.closeTime || "18:00"}
                                    onChange={(e) => handleChange('closeTime', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Seção Horários de Agendamento do Bot - Full Width */}
                    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 lg:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="m9 16 2 2 4-4" /></svg>
                            </div>
                            <h2 className="text-xl font-semibold text-slate-200">Horários para Agendamento</h2>
                        </div>
                        <p className="text-sm text-slate-400 mb-4">Selecione os horários que o bot pode oferecer para agendar consultas.</p>

                        {/* Grid de Horários */}
                        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
                            {Array.from({ length: 12 }, (_, i) => i + 8).map((hour) => {
                                const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
                                const slots = config.availableSlots || ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
                                const isActive = slots.includes(timeSlot);
                                return (
                                    <button
                                        key={timeSlot}
                                        type="button"
                                        onClick={() => {
                                            const newSlots = isActive
                                                ? slots.filter((s: string) => s !== timeSlot)
                                                : [...slots, timeSlot].sort();
                                            handleChange('availableSlots', newSlots);
                                        }}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                            ? 'bg-cyan-600 text-white'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                            }`}
                                    >
                                        {timeSlot}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-slate-500 mt-3">O bot só oferecerá estes horários para novos agendamentos (08:00 a 19:00).</p>
                    </section>
                </div>

                {/* Seção Serviços Dinâmicos - Fora do Grid, Full Width */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-200">Serviços Disponíveis</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const services = config.services || [];
                                handleChange('services', [...services, { id: Date.now(), name: '', price: 0, duration: 60 }]);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" /></svg>
                            Adicionar Serviço
                        </button>
                    </div>

                    {/* Lista de Serviços */}
                    <div className="space-y-4">
                        {(config.services && Array.isArray(config.services) && config.services.length > 0
                            ? config.services.filter((s: any) => s !== null && s !== undefined)
                            : [
                                { id: 1, name: 'Terapia Individual', price: 150, duration: 60 },
                                { id: 2, name: 'Avaliação Psicológica', price: 800, duration: 120 }
                            ]
                        ).map((service: any, index: number) => (
                            <div key={service?.id || index} className="flex items-center gap-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="Nome do serviço"
                                        value={service?.name || ''}
                                        onChange={(e) => {
                                            const services = [...(config.services || [])];
                                            services[index] = { ...service, name: e.target.value };
                                            handleChange('services', services);
                                        }}
                                        className="w-full bg-transparent border-b border-slate-700 px-0 py-2 text-slate-100 focus:border-emerald-500 outline-none text-lg font-medium placeholder:text-slate-600"
                                    />
                                </div>
                                <div className="w-28">
                                    <label className="block text-xs text-slate-500 mb-1">Valor (R$)</label>
                                    <input
                                        type="number"
                                        value={service?.price || 0}
                                        onChange={(e) => {
                                            const services = [...(config.services || [])];
                                            services[index] = { ...service, price: Number(e.target.value) };
                                            handleChange('services', services);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="block text-xs text-slate-500 mb-1">Duração</label>
                                    <select
                                        value={service?.duration || 60}
                                        onChange={(e) => {
                                            const services = [...(config.services || [])];
                                            services[index] = { ...service, duration: Number(e.target.value) };
                                            handleChange('services', services);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value={30}>30 min</option>
                                        <option value={60}>1 hora</option>
                                        <option value={90}>1h30</option>
                                        <option value={120}>2 horas</option>
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const services = (config.services || []).filter((_: any, i: number) => i !== index);
                                        handleChange('services', services);
                                    }}
                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    title="Remover serviço"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                </button>
                            </div>
                        ))}

                        {(config.services || []).length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                                <p>Nenhum serviço cadastrado.</p>
                                <p className="text-sm mt-1">Clique em "Adicionar Serviço" para começar.</p>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-4">Estes serviços serão oferecidos pelo bot durante o agendamento.</p>
                </section>

                {/* Seção FAQ Dinâmico - Feature 7 */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                            </div>
                            <h2 className="text-xl font-semibold text-slate-200">Perguntas Frequentes (FAQ)</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const faqs = config.faqs || [];
                                handleChange('faqs', [...faqs, { id: Date.now(), question: '', answer: '', keywords: '' }]);
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                            Adicionar FAQ
                        </button>
                    </div>

                    <div className="space-y-4">
                        {(config.faqs && Array.isArray(config.faqs) && config.faqs.length > 0
                            ? config.faqs.filter((f: any) => f !== null && f !== undefined)
                            : []
                        ).map((faq: any, index: number) => (
                            <div key={faq?.id || index} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Pergunta (o que o cliente pode perguntar)</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Como funciona a primeira consulta?"
                                        value={faq?.question || ''}
                                        onChange={(e) => {
                                            const faqs = [...(config.faqs || [])];
                                            faqs[index] = { ...faq, question: e.target.value };
                                            handleChange('faqs', faqs);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Resposta do Bot</label>
                                    <textarea
                                        placeholder="Ex: Na primeira consulta faremos uma avaliação inicial..."
                                        value={faq?.answer || ''}
                                        onChange={(e) => {
                                            const faqs = [...(config.faqs || [])];
                                            faqs[index] = { ...faq, answer: e.target.value };
                                            handleChange('faqs', faqs);
                                        }}
                                        rows={2}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs text-slate-500 mb-1">Palavras-chave (separadas por vírgula)</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: primeira consulta, inicio, começar"
                                            value={faq?.keywords || ''}
                                            onChange={(e) => {
                                                const faqs = [...(config.faqs || [])];
                                                faqs[index] = { ...faq, keywords: e.target.value };
                                                handleChange('faqs', faqs);
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const faqs = (config.faqs || []).filter((_: any, i: number) => i !== index);
                                            handleChange('faqs', faqs);
                                        }}
                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all mt-5"
                                        title="Remover FAQ"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}

                        {(!config.faqs || config.faqs.length === 0) && (
                            <div className="text-center py-8 text-slate-500">
                                <p>Nenhuma pergunta frequente cadastrada.</p>
                                <p className="text-sm mt-1">Clique em "Adicionar FAQ" para criar respostas personalizadas.</p>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-4">O bot usará estas perguntas/respostas para atender os clientes.</p>
                </section>

                {/* SEÇÃO: Bloqueio de Horários */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
                                <Lock className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-slate-200">Bloqueio de Horários</h2>
                                <p className="text-xs text-slate-500">Bloqueie horários específicos (almoço, reuniões, feriados)</p>
                            </div>
                        </div>
                    </div>

                    {/* Formulário para adicionar bloqueio */}
                    <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Data</label>
                            <input
                                type="date"
                                value={newBlock.date}
                                onChange={(e) => setNewBlock(prev => ({ ...prev, date: e.target.value }))}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Início</label>
                            <input
                                type="time"
                                value={newBlock.startTime}
                                onChange={(e) => setNewBlock(prev => ({ ...prev, startTime: e.target.value }))}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Fim</label>
                            <input
                                type="time"
                                value={newBlock.endTime}
                                onChange={(e) => setNewBlock(prev => ({ ...prev, endTime: e.target.value }))}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                            />
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs text-slate-500 mb-1">Motivo (opcional)</label>
                            <input
                                type="text"
                                placeholder="Ex: Almoço, Reunião..."
                                value={newBlock.reason}
                                onChange={(e) => setNewBlock(prev => ({ ...prev, reason: e.target.value }))}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:ring-2 focus:ring-rose-500 outline-none placeholder:text-slate-600"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={handleAddBlock}
                                disabled={blockLoading || !newBlock.date || !newBlock.startTime || !newBlock.endTime}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {blockLoading ? 'Salvando...' : '+ Bloquear'}
                            </button>
                        </div>
                    </div>

                    {/* Lista de bloqueios existentes */}
                    <div className="space-y-2">
                        {blockedSlots.map((block) => (
                            <div key={block.id} className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800 group">
                                <div className="flex items-center gap-4">
                                    <span className="text-rose-400 font-medium">
                                        {new Date(block.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                    <span className="text-slate-300">{block.startTime} - {block.endTime}</span>
                                    {block.reason && <span className="text-slate-500 text-sm">({block.reason})</span>}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteBlock(block.id)}
                                    className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {blockedSlots.length === 0 && (
                            <p className="text-center text-slate-600 py-4">Nenhum horário bloqueado.</p>
                        )}
                    </div>
                </section>

                {/* SEÇÃO: Zona de Perigo */}
                <section className="bg-red-950/30 border border-red-900/50 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-red-300">Zona de Perigo</h2>
                            <p className="text-xs text-red-400/70">Ações irreversíveis - tenha cuidado!</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-red-950/50 rounded-lg border border-red-900/30">
                        <div>
                            <h3 className="text-sm font-medium text-red-300">Resetar Banco de Dados</h3>
                            <p className="text-xs text-red-400/60 mt-1">Remove todos os usuários, conversas, agendamentos e mensagens. Mantém as configurações.</p>
                        </div>
                        <button
                            type="button"
                            onClick={async () => {
                                if (confirm('⚠️ TEM CERTEZA?\n\nIsso vai APAGAR TODOS os dados:\n- Usuários\n- Conversas\n- Mensagens\n- Agendamentos\n- Lista de espera\n\nEssa ação NÃO PODE ser desfeita!')) {
                                    try {
                                        const res = await fetch('http://localhost:3000/settings/reset-database', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' }
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            alert('✅ Banco de dados resetado com sucesso!');
                                            window.location.reload();
                                        } else {
                                            alert('❌ Erro: ' + data.message);
                                        }
                                    } catch (e) {
                                        alert('❌ Erro de conexão');
                                    }
                                }
                            }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-all text-sm"
                        >
                            🗑️ Resetar Tudo
                        </button>
                    </div>
                </section>

                {/* Footer Actions */}
                <div className="sticky bottom-6 flex items-center justify-end gap-4 p-4 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-2xl shadow-2xl">
                    {success && (
                        <span className="flex items-center gap-2 text-emerald-400 text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
                            <Check className="w-4 h-4" /> Configurações salvas!
                        </span>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 active:scale-95"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>

            </form>
        </div>
    );
}
