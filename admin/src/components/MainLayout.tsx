"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";

export function MainLayout({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="flex min-h-screen w-full">
            <Sidebar isCollapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

            <main
                className={`flex-1 min-h-screen transition-all duration-300 ease-in-out ${collapsed ? "ml-20" : "ml-64"
                    }`}
            >
                {children}
            </main>
        </div>
    );
}
