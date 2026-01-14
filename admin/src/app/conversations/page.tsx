"use client";

import { useState, useEffect } from 'react';
import { MessageCircle, Search, Loader2, User, ArrowLeft, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Conversation {
    id: string;
    userName: string;
    userPhone: string;
    state: string;
    lastMessage: string;
    lastMessageTime: string;
}

interface Message {
    id: string;
    direction: 'INBOUND' | 'OUTBOUND';
    content: string;
    intent?: string;
    createdAt: string;
}

export default function ConversationsPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchConversations = async (searchTerm?: string) => {
        setLoading(true);
        try {
            const url = searchTerm
                ? `http://localhost:3000/conversations?search=${encodeURIComponent(searchTerm)}`
                : 'http://localhost:3000/conversations';
            const res = await fetch(url, { cache: 'no-store' });
            const data = await res.json();
            setConversations(data);
        } catch (err) {
            console.error('Erro:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Tem certeza que deseja LIMPAR TODAS as conversas? Esta ação não pode ser desfeita.')) {
            return;
        }
        try {
            await fetch('http://localhost:3000/conversations/clear-all', { method: 'DELETE' });
            setConversations([]);
            setSelectedConvo(null);
            setMessages([]);
            alert('Todas as conversas foram limpas!');
        } catch (err) {
            console.error('Erro ao limpar:', err);
            alert('Erro ao limpar conversas');
        }
    };

    const handleSelectConvo = async (convo: Conversation) => {
        setSelectedConvo(convo);
        setLoadingMessages(true);
        try {
            const res = await fetch(`http://localhost:3000/conversations/${convo.id}/messages`, { cache: 'no-store' });
            const data = await res.json();
            setMessages(data);
        } catch (err) {
            console.error('Erro:', err);
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchConversations(search);
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="p-8 h-[calc(100vh-2rem)]">
            <header className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Histórico de Conversas</h1>
                    <p className="text-slate-400 mt-1">Veja todas as mensagens trocadas com pacientes.</p>
                </div>
                <button
                    onClick={handleClearAll}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg text-sm font-medium transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                    Limpar Tudo
                </button>
            </header>

            <div className="flex gap-6 h-[calc(100%-6rem)]">
                {/* Conversations List */}
                <div className="w-96 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
                    <form onSubmit={handleSearch} className="p-4 border-b border-slate-800">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Buscar por nome ou telefone..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </form>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="text-center text-slate-500 py-12">Nenhuma conversa encontrada.</div>
                        ) : (
                            conversations.map(convo => (
                                <button
                                    key={convo.id}
                                    onClick={() => handleSelectConvo(convo)}
                                    className={`w-full text-left p-4 border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${selectedConvo?.id === convo.id ? 'bg-slate-800' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center">
                                            <User className="w-5 h-5 text-indigo-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-100 font-medium truncate">{convo.userName}</p>
                                            <p className="text-slate-500 text-xs truncate">{convo.userPhone}</p>
                                        </div>
                                        <span className="text-xs text-slate-500">{formatTime(convo.lastMessageTime)}</span>
                                    </div>
                                    <p className="text-slate-400 text-sm mt-2 truncate">{convo.lastMessage || 'Sem mensagens'}</p>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat View */}
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
                    {selectedConvo ? (
                        <>
                            {/* Header */}
                            <div className="p-4 border-b border-slate-800 flex items-center gap-4">
                                <button onClick={() => setSelectedConvo(null)} className="lg:hidden p-2 hover:bg-slate-800 rounded-lg">
                                    <ArrowLeft className="w-5 h-5 text-slate-400" />
                                </button>
                                <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-slate-100 font-semibold">{selectedConvo.userName}</p>
                                    <p className="text-slate-500 text-xs">{selectedConvo.userPhone}</p>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center h-32">
                                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center text-slate-500 py-12">Nenhuma mensagem.</div>
                                ) : (
                                    messages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.direction === 'INBOUND' ? 'justify-start' : 'justify-end'}`}>
                                            <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.direction === 'INBOUND' ? 'bg-slate-800 text-slate-100' : 'bg-indigo-600 text-white'}`}>
                                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Clock className="w-3 h-3 text-slate-400" />
                                                    <span className="text-xs text-slate-400">{formatTime(msg.createdAt)}</span>
                                                    {msg.intent && <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">{msg.intent}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <MessageCircle className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                <p className="text-slate-500">Selecione uma conversa para ver as mensagens.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
