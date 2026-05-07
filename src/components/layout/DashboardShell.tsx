"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export function DashboardShell({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground transition-all duration-500">
            <Sidebar
                isAdmin={isAdmin}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />
            <div className="flex flex-1 flex-col overflow-hidden min-w-0 bg-background transition-all duration-500">
                <Topbar
                    title="Panel General"
                    onMenuClick={() => setMobileOpen(true)}
                />
                <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
