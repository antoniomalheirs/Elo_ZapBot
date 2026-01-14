'use client';

import React, { useEffect, useState } from 'react';
import { Smartphone, RefreshCw, LogOut, CheckCircle, AlertTriangle, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';

export default function WhatsAppConnectionPage() {
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/whatsapp/status`);
            const data = await res.json();
            setStatus(data);
        } catch (error) {
            console.error('Erro ao buscar status:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (action: 'disconnect' | 'reconnect') => {
        if (!confirm(`Tem certeza que deseja ${action === 'disconnect' ? 'desconectar' : 'reconectar'}?`)) return;

        setActionLoading(true);
        try {
            await fetch(`${API_URL}/whatsapp/${action}`, { method: 'POST' });
            setTimeout(fetchStatus, 2000);
        } catch (error) {
            console.error(`Erro ao ${action}:`, error);
            alert(`Erro ao ${action}. Tente novamente.`);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="p-8 pb-28">
            {/* Standard Admin Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-100">Conexão WhatsApp</h1>
                <p className="text-slate-400 mt-1">Gerencie a conexão e o status do bot.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Status Card */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
                            <Smartphone className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-200">Status da Conexão</h2>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-slate-950/50 rounded-lg border border-slate-700 mb-6">
                        <div className={`w-3 h-3 rounded-full ${status?.connected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'}`} />
                        <div>
                            <h3 className="text-base font-medium text-slate-200">
                                {loading ? 'Verificando...' : status?.connected ? 'Conectado' : 'Desconectado'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {status?.connected
                                    ? `Sessão ativa: ${status?.pushName || status?.phone || 'Bot'}`
                                    : 'Aguardando autenticação'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {status?.connected ? (
                            <button
                                onClick={() => handleAction('disconnect')}
                                disabled={actionLoading}
                                className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                <LogOut className="w-4 h-4" />
                                {actionLoading ? 'Processando...' : 'Desconectar Dispositivo'}
                            </button>
                        ) : (
                            <button
                                onClick={() => handleAction('reconnect')}
                                disabled={actionLoading}
                                className="w-full flex items-center justify-center gap-2 p-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                                {actionLoading ? 'Reiniciando...' : 'Reiniciar Sessão'}
                            </button>
                        )}
                        <p className="text-xs text-center text-slate-600 mt-2">
                            Use "Reiniciar Sessão" para gerar um novo QR Code se estiver com problemas.
                        </p>
                    </div>
                </section>

                {/* QR Code Card */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[400px]">
                    {loading ? (
                        <div className="flex flex-col items-center gap-3">
                            <RefreshCw className="w-8 h-8 text-slate-600 animate-spin" />
                            <span className="text-slate-500 text-sm">Carregando status...</span>
                        </div>
                    ) : status?.connected ? (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-200">Tudo conectado!</h3>
                            <p className="text-slate-400 text-sm max-w-[200px]">
                                O bot está pronto e respondendo mensagens.
                            </p>
                        </div>
                    ) : status?.qrCode ? (
                        <div className="flex flex-col items-center space-y-6">
                            <div className="p-4 bg-white rounded-xl shadow-lg">
                                <QRCode value={status.qrCode} size={220} />
                            </div>
                            <div className="text-center">
                                <h3 className="text-slate-200 font-medium mb-1">Escaneie o QR Code</h3>
                                <p className="text-slate-500 text-xs">Abra o WhatsApp {'>'} Aparelhos Conectados {'>'} Conectar</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-3">
                            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
                                <QrCode className="w-6 h-6" />
                            </div>
                            <p className="text-slate-400 text-sm">QR Code indisponível.</p>
                            <button
                                onClick={() => handleAction('reconnect')}
                                className="text-indigo-400 text-xs hover:underline"
                            >
                                Tentar gerar novamente
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
