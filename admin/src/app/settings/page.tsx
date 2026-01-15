"use client";

import { Save, Clock, DollarSign, MapPin, Loader2, Check, Lock, Trash2, Brain, MessageSquare, AlertTriangle, Settings, Calendar, Activity } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState('geral');

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

    const tabs = [
        { id: 'geral', label: 'Geral', icon: Settings },
        { id: 'agendamento', label: 'Agendamento', icon: Calendar },
        { id: 'servicos', label: 'Serviços', icon: DollarSign },
        { id: 'ia', label: 'Inteligência', icon: Brain },
        { id: 'respostas', label: 'Respostas', icon: MessageSquare },
        { id: 'avancado', label: 'Avançado', icon: AlertTriangle },
    ];

    return (
        <div className="p-8 pb-28 min-h-screen bg-slate-950 text-slate-100">
            <header className="mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    Configurações do ZapBot
                </h1>
                <p className="text-slate-400 mt-2 text-lg">Personalize cada detalhe da sua inteligência artificial.</p>
            </header>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar com Abas */}
                <aside className="w-full lg:w-64 flex-shrink-0">
                    <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${isActive
                                        ? 'bg-violet-600/20 text-violet-300 shadow-[0_0_20px_rgba(124,58,237,0.1)] border border-violet-500/30'
                                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-violet-400' : ''}`} />
                                    <span className="font-medium">{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Conteúdo Principal */}
                <main className="flex-1">
                    <form onSubmit={handleSave} className="space-y-6">

                        {/* --- TAB: GERAL --- */}
                        {activeTab === 'geral' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                                <section className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl">
                                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                        <Settings className="w-5 h-5 text-blue-400" /> Identidade
                                    </h2>
                                    <div className="grid gap-6">
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-2">Nome da Clínica</label>
                                            <input
                                                type="text"
                                                value={config.clinicName || ""}
                                                onChange={(e) => handleChange('clinicName', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-violet-500 outline-none transition-all"
                                                placeholder="Ex: Clínica Saúde Total"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Endereço</label>
                                                <input
                                                    type="text"
                                                    value={config.clinicAddress || ""}
                                                    onChange={(e) => handleChange('clinicAddress', e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-violet-500 outline-none"
                                                    placeholder="Rua Exemplo, 123"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Cidade</label>
                                                <input
                                                    type="text"
                                                    value={config.clinicCity || ""}
                                                    onChange={(e) => handleChange('clinicCity', e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-violet-500 outline-none"
                                                    placeholder="São Paulo - SP"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl">
                                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-yellow-400" /> Notificações
                                    </h2>
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">Celular do Admin (Alertas)</label>
                                        <input
                                            type="text"
                                            value={config.adminPhone || ""}
                                            onChange={(e) => handleChange('adminPhone', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 outline-none"
                                            placeholder="5511999999999"
                                        />
                                        <p className="text-xs text-slate-500 mt-2">Recebe avisos de handoff e erros críticos.</p>
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* --- TAB: AGENDAMENTO --- */}
                        {activeTab === 'agendamento' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                                <section className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl">
                                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-indigo-400" /> Horários de Funcionamento
                                    </h2>

                                    <div className="mb-6">
                                        <label className="block text-sm text-slate-400 mb-3">Dias de Atendimento</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day, idx) => {
                                                const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                                                const isActive = config.workDays?.[dayKeys[idx]] ?? (idx < 5);
                                                return (
                                                    <button
                                                        key={day}
                                                        type="button"
                                                        onClick={() => {
                                                            const newWorkDays = { ...(config.workDays || {}), [dayKeys[idx]]: !isActive };
                                                            handleChange('workDays', newWorkDays);
                                                        }}
                                                        className={`px-4 py-2 rounded-lg font-medium transition-all ${isActive
                                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                            }`}
                                                    >
                                                        {day}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-2">Abertura</label>
                                            <input type="time" value={config.openTime || "09:00"} onChange={(e) => handleChange('openTime', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-2">Fechamento</label>
                                            <input type="time" value={config.closeTime || "18:00"} onChange={(e) => handleChange('closeTime', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-slate-800">
                                        <label className="block text-sm text-slate-400 mb-2">⏰ Horário de Envio dos Lembretes</label>
                                        <p className="text-xs text-slate-500 mb-3">Define em qual horário os lembretes de consulta serão enviados (1 dia antes).</p>
                                        <input
                                            type="time"
                                            value={config.reminderTime || "08:00"}
                                            onChange={(e) => handleChange('reminderTime', e.target.value)}
                                            className="w-48 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none"
                                        />
                                    </div>
                                </section>

                                <section className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl">
                                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                        <Check className="w-5 h-5 text-cyan-400" /> Slots Disponíveis
                                    </h2>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                        {Array.from({ length: 13 }, (_, i) => i + 7).map((hour) => { // 07:00 as 19:00
                                            const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
                                            const slots = config.availableSlots || ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
                                            const isActive = slots.includes(timeSlot);
                                            return (
                                                <button
                                                    key={timeSlot}
                                                    type="button"
                                                    onClick={() => {
                                                        const newSlots = isActive ? slots.filter((s: string) => s !== timeSlot) : [...slots, timeSlot].sort();
                                                        handleChange('availableSlots', newSlots);
                                                    }}
                                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                        }`}
                                                >
                                                    {timeSlot}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl">
                                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-rose-400" /> Bloqueios de Agenda
                                    </h2>

                                    <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                                        <input type="date" value={newBlock.date} onChange={(e) => setNewBlock(prev => ({ ...prev, date: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-none" />
                                        <input type="time" value={newBlock.startTime} onChange={(e) => setNewBlock(prev => ({ ...prev, startTime: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-none" />
                                        <input type="time" value={newBlock.endTime} onChange={(e) => setNewBlock(prev => ({ ...prev, endTime: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-none" />
                                        <input type="text" placeholder="Motivo (Opcional)" value={newBlock.reason} onChange={(e) => setNewBlock(prev => ({ ...prev, reason: e.target.value }))} className="flex-1 min-w-[150px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 outline-none" />
                                        <button type="button" onClick={handleAddBlock} disabled={blockLoading || !newBlock.date} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all disabled:opacity-50">+ Bloquear</button>
                                    </div>

                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                        {blockedSlots.map((block) => (
                                            <div key={block.id} className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800 group hover:border-rose-500/30 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-rose-400 font-bold">{new Date(block.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                                    <span className="text-slate-300">{block.startTime} - {block.endTime}</span>
                                                    {block.reason && <span className="text-slate-500 text-sm italic">({block.reason})</span>}
                                                </div>
                                                <button type="button" onClick={() => handleDeleteBlock(block.id)} className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                        {blockedSlots.length === 0 && <p className="text-center text-slate-600 py-4">Nenhum bloqueio ativo.</p>}
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* --- TAB: SERVIÇOS --- */}
                        {activeTab === 'servicos' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                                <section className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-xl font-semibold flex items-center gap-2">
                                            <DollarSign className="w-5 h-5 text-emerald-400" /> Catálogo de Serviços
                                        </h2>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const services = config.services || [];
                                                handleChange('services', [...services, { id: Date.now(), name: '', price: 0, duration: 60 }]);
                                            }}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-500/20"
                                        >
                                            + Novo Serviço
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {(config.services || [{ id: 1, name: 'Terapia', price: 150, duration: 60 }]).map((service: any, index: number) => (
                                            <div key={service?.id || index} className="flex flex-col md:flex-row items-center gap-4 p-4 bg-slate-950 rounded-xl border border-slate-800 hover:border-emerald-500/30 transition-colors">
                                                <div className="flex-1 w-full">
                                                    <input
                                                        type="text"
                                                        placeholder="Nome do serviço"
                                                        value={service?.name || ''}
                                                        onChange={(e) => {
                                                            const s = [...(config.services || [])];
                                                            s[index] = { ...service, name: e.target.value };
                                                            handleChange('services', s);
                                                        }}
                                                        className="w-full bg-transparent border-b border-slate-700 px-0 py-2 text-slate-100 focus:border-emerald-500 outline-none text-lg font-medium"
                                                    />
                                                </div>
                                                <div className="flex gap-4 w-full md:w-auto">
                                                    <div className="w-24">
                                                        <label className="text-xs text-slate-500">Valor (R$)</label>
                                                        <input type="number" value={service?.price || 0} onChange={(e) => {
                                                            const s = [...(config.services || [])];
                                                            s[index] = { ...service, price: Number(e.target.value) };
                                                            handleChange('services', s);
                                                        }} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm outline-none" />
                                                    </div>
                                                    <div className="w-24">
                                                        <label className="text-xs text-slate-500">Minutos</label>
                                                        <input type="number" value={service?.duration || 60} onChange={(e) => {
                                                            const s = [...(config.services || [])];
                                                            s[index] = { ...service, duration: Number(e.target.value) };
                                                            handleChange('services', s);
                                                        }} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm outline-none" />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const s = (config.services || []).filter((_: any, i: number) => i !== index);
                                                            handleChange('services', s);
                                                        }}
                                                        className="p-2 mt-4 text-slate-500 hover:text-red-400"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* --- TAB: INTELIGÊNCIA (NOVO) --- */}
                        {activeTab === 'ia' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                                <section className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-3 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-xl shadow-lg shadow-violet-500/20">
                                            <Brain className="w-8 h-8 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-semibold text-slate-100">Cérebro da IA</h2>
                                            <p className="text-sm text-slate-400">Defina a personalidade e o comportamento do seu assistente.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-violet-300 mb-2">Persona / Identidade</label>
                                            <p className="text-xs text-slate-500 mb-2">Descreva quem é o bot. Ex: "Você é a Kelly, uma secretária super animada e prestativa que adora usar emojis."</p>
                                            <textarea
                                                value={config.aiPersona || ""}
                                                onChange={(e) => handleChange('aiPersona', e.target.value)}
                                                rows={4}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-violet-500 outline-none resize-none leading-relaxed"
                                                placeholder="Digite aqui a personalidade do bot..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-violet-300 mb-2">Instruções de Comportamento</label>
                                            <p className="text-xs text-slate-500 mb-2">Regras que ele deve seguir. Ex: "Nunca passe valores por mensagem", "Sempre ofereça agendamento no final".</p>
                                            <textarea
                                                value={config.aiInstructions || ""}
                                                onChange={(e) => handleChange('aiInstructions', e.target.value)}
                                                rows={5}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-violet-500 outline-none resize-none leading-relaxed"
                                                placeholder="- Regra 1: ...\n- Regra 2: ..."
                                            />
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* --- TAB: RESPOSTAS (FAQ) --- */}
                        {activeTab === 'respostas' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                                <section className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-xl font-semibold flex items-center gap-2">
                                            <MessageSquare className="w-5 h-5 text-purple-400" /> Perguntas e Respostas
                                        </h2>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const faqs = config.faqs || [];
                                                handleChange('faqs', [...faqs, { id: Date.now(), question: '', answer: '', keywords: '' }]);
                                            }}
                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-all"
                                        >
                                            + Adicionar FAQ
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {(config.faqs || []).map((faq: any, index: number) => (
                                            <div key={faq?.id || index} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 group hover:border-purple-500/30 transition-colors">
                                                <input
                                                    type="text"
                                                    placeholder="Pergunta (Ex: Aceita convênio?)"
                                                    value={faq?.question || ''}
                                                    onChange={(e) => {
                                                        const f = [...(config.faqs || [])];
                                                        f[index] = { ...faq, question: e.target.value };
                                                        handleChange('faqs', f);
                                                    }}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none font-medium"
                                                />
                                                <textarea
                                                    placeholder="Resposta do Bot"
                                                    value={faq?.answer || ''}
                                                    onChange={(e) => {
                                                        const f = [...(config.faqs || [])];
                                                        f[index] = { ...faq, answer: e.target.value };
                                                        handleChange('faqs', f);
                                                    }}
                                                    rows={2}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none resize-none"
                                                />
                                                <div className="flex justify-between items-center">
                                                    <input
                                                        type="text"
                                                        placeholder="Palavras-chave (opcional)"
                                                        value={faq?.keywords || ''}
                                                        onChange={(e) => {
                                                            const f = [...(config.faqs || [])];
                                                            f[index] = { ...faq, keywords: e.target.value };
                                                            handleChange('faqs', f);
                                                        }}
                                                        className="w-2/3 bg-transparent text-xs text-slate-500 border-b border-transparent focus:border-slate-600 outline-none"
                                                    />
                                                    <button type="button" onClick={() => {
                                                        const f = (config.faqs || []).filter((_: any, i: number) => i !== index);
                                                        handleChange('faqs', f);
                                                    }} className="text-xs text-red-400 hover:text-red-300">Remover</button>
                                                </div>
                                            </div>
                                        ))}
                                        {(config.faqs || []).length === 0 && <p className="text-center text-slate-600">Nenhum FAQ cadastrado.</p>}
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* --- TAB: AVANÇADO (DANGER ZONE) --- */}
                        {activeTab === 'avancado' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                                <section className="p-6 bg-red-950/20 border border-red-900/50 rounded-2xl">
                                    <h2 className="text-xl font-semibold text-red-400 mb-2 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5" /> Zona de Perigo
                                    </h2>
                                    <p className="text-sm text-red-300/60 mb-6">Cuidado com as ações abaixo.</p>

                                    <div className="flex items-center justify-between p-4 bg-red-950/40 rounded-xl border border-red-900/30">
                                        <div>
                                            <h3 className="text-base font-medium text-red-200">Reset Total (Factory Reset)</h3>
                                            <p className="text-sm text-red-400/60 mt-1">Apaga TODOS os usuários, conversas, agendamentos e históricos.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (confirm('🚫 ATENÇÃO MÁXIMA 🚫\n\nVocê vai apagar TODO o banco de dados.\nIsso inclui histórico de clientes e agendamentos futuros.\n\nTem certeza absoluta?')) {
                                                    try {
                                                        const res = await fetch('http://localhost:3000/settings/reset-database', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' }
                                                        });
                                                        const data = await res.json();
                                                        if (data.success) {
                                                            alert('✅ Sistema resetado com sucesso.');
                                                            window.location.reload();
                                                        } else {
                                                            alert('❌ Erro: ' + data.message);
                                                        }
                                                    } catch (e) { alert('❌ Erro de conexão'); }
                                                }
                                            }}
                                            className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-lg shadow-red-600/20 transition-all"
                                        >
                                            💣 Resetar Dados
                                        </button>
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* Footer Flutuante */}
                        <div className="fixed bottom-6 right-8 flex items-center gap-4">
                            {success && (
                                <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/50 rounded-lg text-emerald-400 flex items-center gap-2 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-5 fade-in">
                                    <Check className="w-4 h-4" /> <strong>Salvo!</strong>
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-xl shadow-violet-500/30 hover:scale-105 active:scale-95"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {loading ? 'Salvando...' : 'Salvar Tudo'}
                            </button>
                        </div>
                    </form>
                </main>
            </div>
        </div>
    );
}
