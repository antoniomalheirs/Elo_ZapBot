"use client";

import { useState, useEffect } from 'react';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
    parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Search, Calendar as CalendarIcon, Clock, X, User } from 'lucide-react';

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

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    // Calendar logic
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            fetchAppointments();
        }, 500);
        return () => clearTimeout(timer);
    }, [currentDate, search]);

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            // Se não tiver search, manda datas. Se tiver search, backend ignora datas (global)
            if (!search) {
                query.append('startDate', startDate.toISOString());
                query.append('endDate', endDate.toISOString());
            }

            if (search) query.append('search', search);

            const res = await fetch(`http://localhost:3000/appointments?${query.toString()}`, { cache: 'no-store' });
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

    const selectedDayAppointments = appointments.filter(apt =>
        isSameDay(parseISO(apt.dateTime), selectedDate)
    );

    const clearSearch = () => {
        setSearch('');
        // Retornar ao estado normal
    };

    return (
        <div className="p-8 h-screen flex flex-col">
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-2">
                        <CalendarIcon className="w-8 h-8 text-indigo-500" />
                        Calendário
                    </h1>
                    <p className="text-slate-400 mt-1">
                        {search ? 'Resultados da Busca Global' : 'Visão mensal e agenda diária.'}
                    </p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Buscar (Nome ou Tel)..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all focus:w-80"
                    />
                    {search && (
                        <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </header>

            {/* MODO BUSCA (Search Results) */}
            {search ? (
                <div className="flex-1 overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-slate-200 mb-6 flex items-center gap-2">
                        Resultados encontrados: <span className="text-indigo-400">{appointments.length}</span>
                    </h2>

                    {loading ? (
                        <p className="text-slate-500">Buscando...</p>
                    ) : appointments.length === 0 ? (
                        <p className="text-slate-500">Nenhum agendamento encontrado para "{search}".</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {appointments.map(apt => (
                                <div key={apt.id} className="bg-slate-950 border border-slate-800 p-5 rounded-xl hover:border-indigo-500/50 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2 text-indigo-400 font-medium">
                                            <CalendarIcon className="w-4 h-4" />
                                            {format(parseISO(apt.dateTime), "d 'de' MMMM, yyyy", { locale: ptBR })}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs border uppercase
                                            ${apt.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                apt.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                    apt.status === 'COMPLETED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                        'bg-slate-800 text-slate-300 border-slate-700'
                                            }`}>
                                            {apt.status === 'COMPLETED' ? 'REALIZADA' : apt.status}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-100">{apt.user.name || 'Sem nome'}</h3>
                                    <p className="text-sm text-slate-500 mb-4">{apt.user.phone}</p>

                                    <div className="flex p-3 bg-slate-900 rounded-lg gap-3">
                                        <div className="text-center md:text-left">
                                            <p className="text-xs text-slate-500 uppercase font-bold">Horário</p>
                                            <p className="text-slate-200">{format(parseISO(apt.dateTime), 'HH:mm')}</p>
                                        </div>
                                        <div className="w-px bg-slate-800 mx-2"></div>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase font-bold">Serviço</p>
                                            <p className="text-slate-200">{apt.service}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* MODO CALENDARIO (Normal View) */
                <div className="flex flex-1 gap-6 overflow-hidden">
                    {/* Lado Esquerdo: Grade */}
                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col p-4">
                        <div className="flex justify-between items-center mb-4 px-2">
                            <h2 className="text-xl font-bold text-slate-200 capitalize">
                                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                            </h2>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 mb-2 text-center text-slate-500 text-sm font-medium uppercase">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                <div key={day} className="py-2">{day}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 flex-1 gap-1">
                            {calendarDays.map((day, idx) => {
                                const dayAppointments = appointments.filter(apt => isSameDay(parseISO(apt.dateTime), day));
                                const isSelected = isSameDay(day, selectedDate);
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                const isToday = isSameDay(day, new Date());

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedDate(day)}
                                        className={`
                        border rounded-xl p-2 cursor-pointer transition-all flex flex-col
                        ${isSelected
                                                ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-500/10'
                                                : 'bg-slate-950/30 border-slate-800 hover:border-slate-600 hover:bg-slate-800'
                                            }
                        ${!isCurrentMonth && 'opacity-30'}
                    `}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full 
                            ${isToday ? 'bg-indigo-500 text-white' : 'text-slate-400'}
                        `}>
                                                {format(day, 'd')}
                                            </span>
                                            {dayAppointments.length > 0 && (
                                                <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-md">
                                                    {dayAppointments.length}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-1 mt-2 overflow-hidden">
                                            {dayAppointments.slice(0, 3).map(apt => (
                                                <div key={apt.id} className={`h-1.5 rounded-full w-full
                                                    ${apt.status === 'CONFIRMED' ? 'bg-emerald-500/50' :
                                                        apt.status === 'PENDING' ? 'bg-amber-500/50' :
                                                            apt.status === 'COMPLETED' ? 'bg-blue-500/50' :
                                                                'bg-slate-700'
                                                    }
                                                `}></div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Lado Direito: Agenda Diária */}
                    <div className="w-96 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col p-6">
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-slate-200">Agenda do Dia</h3>
                            <p className="text-indigo-400 font-medium capitalize">
                                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                            {selectedDayAppointments.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                    <CalendarIcon className="w-12 h-12 mb-3 opacity-20" />
                                    <p>Sem agendamentos</p>
                                </div>
                            ) : (
                                selectedDayAppointments.map(apt => (
                                    <div key={apt.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl hover:border-slate-700 transition-colors group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                                {format(parseISO(apt.dateTime), 'HH:mm')}
                                            </span>
                                            <span className={`text-xs uppercase px-1.5 py-0.5 rounded border
                                                ${apt.status === 'CONFIRMED' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                                                    apt.status === 'PENDING' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                                        apt.status === 'COMPLETED' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                                                            'text-slate-500 border-transparent'
                                                }`}>
                                                {apt.status === 'COMPLETED' ? 'REALIZADA' : apt.status}
                                            </span>
                                        </div>
                                        <h4 className="font-medium text-slate-200 mb-1">{apt.user.name || 'Sem nome'}</h4>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                                            <span>{apt.service}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
