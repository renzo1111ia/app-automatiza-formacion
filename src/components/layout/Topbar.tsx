"use client";

import { useTenantStore } from "@/store/tenant";
import { logoutAction } from "@/lib/actions/auth";
import { Menu, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface TopbarProps {
    title: string;
    onMenuClick?: () => void;
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
    const { tenantName, config } = useTenantStore();

    async function handleLogout() {
        try {
            await logoutAction();
        } catch (e) {
            console.error("Logout error:", e);
        } finally {
            window.location.href = "/login";
        }
    }

    return (
        <header className="flex h-14 md:h-16 items-center justify-between border-b border-border bg-card/80 px-4 md:px-6 backdrop-blur-md shrink-0 transition-all duration-500">
            {/* Left: Hamburger (mobile) + Title */}
            <div className="flex items-center gap-3">
                {/* Mobile menu button */}
                <button
                    onClick={onMenuClick}
                    className="md:hidden h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all"
                    aria-label="Abrir menú"
                >
                    <Menu className="h-5 w-5" />
                </button>

                <div className="flex flex-col">
                    <h1 className="text-sm md:text-base font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight">
                        {(config?.dashboard_title as string) || title}
                    </h1>
                    {tenantName && (
                        <span className="text-[10px] uppercase tracking-widest text-blue-500 dark:text-blue-400 font-bold leading-none mt-0.5">
                            {tenantName}
                        </span>
                    )}
                </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
                <ThemeToggle />
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 rounded-xl px-2.5 md:px-3 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 transition hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500"
                    aria-label="Cerrar sesión"
                >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Cerrar sesión</span>
                </button>
            </div>
        </header>
    );
}
