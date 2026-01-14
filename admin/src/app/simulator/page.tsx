"use client";

import { useState, useRef, useEffect } from 'react';
import { Send, RefreshCcw, Cpu, MessageSquare, Bot, User, Zap } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'bot';
    content: string;
    timestamp: Date;
}

interface DebugInfo {
    intent: string;
    confidence: number;
    state: string;
    aiAnalysis?: any;
    ruleMatched?: boolean;
    flowProcessed?: boolean;
}

export default function SimulatorPage() {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'bot', content: 'Olá! Sou o ZapBot Simulator. 🤖\nPosso testar seus fluxos sem gastar mensagens reais.\n\nComo posso ajudar?', timestamp: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('http://localhost:3000/orchestrator/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: '5511999999999', // Test Number
                    message: userMsg.content
                })
            });

            const data = await res.json();

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'bot',
                content: data.response || '[Sem resposta]',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMsg]);
            setDebugInfo(data.debug ? { ...data.debug, intent: data.intent, confidence: data.confidence, state: data.state } : {
                intent: data.intent,
                confidence: data.confidence,
                state: data.state
            });

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'bot',
                content: '❌ Erro ao conectar com o backend.',
                timestamp: new Date()
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="h-screen bg-slate-950 text-slate-100 flex overflow-hidden">
            {/* Left: Chat Area */}
            <div className="flex-1 flex flex-col relative border-r border-slate-800">
                <header className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex justify-between items-center z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <Bot className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg">Simulador de Chat</h1>
                            <p className="text-xs text-slate-400">Ambiente de Teste (Sem WhatsApp)</p>
                        </div>
                    </div>
                    <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors">Voltar</a>
                </header>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                            </div>
                            <div className={`max-w-[70%] p-4 rounded-2xl ${msg.role === 'user'
                                ? 'bg-indigo-600 rounded-tr-none text-white'
                                : 'bg-slate-800 rounded-tl-none border border-slate-700'
                                }`}>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                                <span className="text-[10px] opacity-50 mt-2 block text-right">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 rounded-tl-none flex items-center gap-2">
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-slate-900 border-t border-slate-800">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Digite uma mensagem para testar..."
                            className="flex-1 bg-slate-800 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 text-slate-100 placeholder-slate-500"
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl disabled:opacity-50 transition-all active:scale-95"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Right: Debug Panel */}
            <div className="w-[350px] bg-slate-900 border-l border-slate-800 flex flex-col">
                <header className="p-4 border-b border-slate-800 flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-400" />
                    <h2 className="font-bold text-slate-200">Debug "Cérebro"</h2>
                </header>

                <div className="p-4 flex-1 overflow-y-auto space-y-6">
                    {!debugInfo ? (
                        <div className="text-center text-slate-500 mt-10">
                            <Zap className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">Envie uma mensagem para ver os dados de processamento.</p>
                        </div>
                    ) : (
                        <>
                            {/* Intent Card */}
                            <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Intenção Detectada</h3>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-indigo-400 font-mono font-bold text-lg">{debugInfo.intent}</span>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${debugInfo.confidence > 80 ? 'bg-emerald-500/20 text-emerald-400' :
                                            debugInfo.confidence > 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                                        }`}>
                                        {Math.round(debugInfo.confidence)}% Conf.
                                    </span>
                                </div>
                                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-500"
                                        style={{ width: `${debugInfo.confidence}%` }}
                                    />
                                </div>
                            </div>

                            {/* State Card */}
                            <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Estado da Conversa</h3>
                                <div className="flex items-center gap-2">
                                    <RefreshCcw className="w-4 h-4 text-violet-400" />
                                    <span className="text-slate-200 font-mono">{debugInfo.state}</span>
                                </div>
                            </div>

                            {/* Raw JSON */}
                            <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 overflow-hidden">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Dados Brutos (JSON)</h3>
                                <pre className="text-[10px] text-emerald-400/80 overflow-x-auto p-2 bg-slate-900 rounded font-mono">
                                    {JSON.stringify(debugInfo, null, 2)}
                                </pre>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
