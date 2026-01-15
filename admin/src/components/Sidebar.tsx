"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, Settings, MessageSquare, Bot, LogOut, ChevronRight, Activity, Smartphone, BarChart3, CalendarPlus, Bell } from "lucide-react";

const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: BarChart3, label: "Estatísticas", href: "/stats" },
    { icon: Calendar, label: "Agenda", href: "/calendar" },
    { icon: CalendarPlus, label: "Agendamentos", href: "/appointments" },
    { icon: Bell, label: "Lembretes", href: "/reminders" },
    { icon: MessageSquare, label: "Conversas", href: "/conversations" },
    { icon: Bot, label: "Simulador", href: "/simulator" },
    { icon: Smartphone, label: "Conexão WhatsApp", href: "/whatsapp" },
    { icon: Settings, label: "Configurações", href: "/settings" },
];

interface SidebarProps {
    isCollapsed?: boolean;
    onToggle?: () => void;
}

export function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
    const pathname = usePathname();

    return (
        <aside
            className={`bg-[#0f172a] border-r border-slate-800 h-screen fixed left-0 top-0 flex flex-col z-50 transition-all duration-300 ease-in-out ${isCollapsed ? "w-20" : "w-64"
                }`}
        >
            {/* Brand */}
            <div className={`p-6 pb-8 transition-all duration-300 ${isCollapsed ? 'px-4' : ''}`}>
                <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                        <Bot className="w-6 h-6 text-white" />
                    </div>

                    <div className={`transition-all duration-300 overflow-hidden ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                        <h1 className="font-bold text-xl text-slate-100 tracking-tight whitespace-nowrap">ZapBot</h1>
                        <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">Admin</span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-2 overflow-y-auto overflow-x-hidden">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={isCollapsed ? item.label : ""}
                            className={`group flex items-center gap-3 px-3 py-3.5 rounded-xl transition-all duration-300 relative overflow-hidden ${isActive
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20"
                                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
                                } ${isCollapsed ? 'justify-center' : ''}`}
                        >
                            {isActive && (
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-100 -z-10" />
                            )}
                            <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 shrink-0 ${isActive ? 'text-indigo-100' : 'text-slate-500 group-hover:text-slate-300'}`} />

                            <span className={`font-medium text-sm transition-all duration-300 whitespace-nowrap overflow-hidden ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
                                }`}>
                                {item.label}
                            </span>

                            {isActive && !isCollapsed && <ChevronRight className="w-4 h-4 ml-auto text-indigo-200 animate-in slide-in-from-left-2 shrink-0" />}
                        </Link>
                    );
                })}
            </nav>

            {/* Toggle Button */}
            <div className="p-3 border-t border-slate-800 flex justify-end">
                <button
                    onClick={onToggle}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                    {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronRight className="w-5 h-5 rotate-180" />}
                </button>
            </div>

            {/* User / Logout */}
            <div className="p-4 pt-2">
                <button
                    title={isCollapsed ? "Sair" : ""}
                    className={`flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 rounded-xl transition-colors group ${isCollapsed ? 'justify-center' : ''
                        }`}
                >
                    <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1 shrink-0" />
                    <span className={`font-medium text-sm transition-all duration-300 whitespace-nowrap overflow-hidden ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
                        }`}>
                        Sair
                    </span>
                </button>
            </div>
        </aside>
    );
}
