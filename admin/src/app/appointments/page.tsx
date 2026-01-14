import { Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

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

async function getAppointments() {
    try {
        const res = await fetch('http://localhost:3000/appointments', { cache: 'no-store' });
        if (!res.ok) throw new Error('Falha ao buscar agendamentos');
        return res.json() as Promise<Appointment[]>;
    } catch (error) {
        console.error(error);
        return [];
    }
}

export default async function AppointmentsPage() {
    const appointments = await getAppointments();

    return (
        <div className="p-8">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Agendamentos</h1>
                    <p className="text-slate-400 mt-1">Gerencie consultas e horários.</p>
                </div>
                <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors">
                    Novo Agendamento
                </button>
            </header>

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
                        {appointments.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-500">
                                    Nenhum agendamento encontrado.
                                </td>
                            </tr>
                        ) : (
                            appointments.map((apt) => (
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
                        )}
                    </tbody>
                </table>
            </div>
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
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600">
            {status}
        </span>
    );
}
