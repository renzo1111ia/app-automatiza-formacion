"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTenantStore } from "@/store/tenant";
import NextImage from "next/image";

import { 
    LayoutDashboard, Megaphone, MessageCircle, 
    Clock, History, Settings, X, ChevronDown, PlusCircle,
    Workflow, Bot, ShieldCheck, Terminal,
    Calendar, MessageSquare, FlaskConical, Mic, Globe, BookOpen, DollarSign
} from "lucide-react";
import { TenantSelector } from "./TenantSelector";

interface NavItem {
    label: string;
    href: string;
    icon?: React.ReactNode;
    subItems?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
    {
        label: "Gestión v2.0",
        href: "/dashboard/onboarding",
        icon: <Workflow className="h-5 w-5" strokeWidth={1.8} />,
        subItems: [
            {
                label: "Constructor",
                href: "/dashboard/onboarding",
                icon: <PlusCircle className="h-4 w-4" strokeWidth={1.8} />
            },
            {
                label: "Agentes AI",
                href: "/dashboard/agents",
                icon: <Bot className="h-4 w-4" strokeWidth={1.8} />
            },
            {
                label: "Knowledge Base",
                href: "/dashboard/knowledge",
                icon: <BookOpen className="h-4 w-4" strokeWidth={1.8} />
            },
            {
                label: "Agentes de Voz",
                href: "/dashboard/voice-agents",
                icon: <Mic className="h-4 w-4" strokeWidth={1.8} />
            },

            {
                label: "Conversaciones",
                href: "/dashboard/conversaciones",
                icon: <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
            },
            {
                label: "Chatbot Web",
                href: "/dashboard/web-chatbot",
                icon: <Globe className="h-4 w-4" strokeWidth={1.8} />
            },
            {
                label: "Calendario",
                href: "/dashboard/calendar",
                icon: <Calendar className="h-4 w-4" strokeWidth={1.8} />
            },
            {
                label: "Simulador",
                href: "/dashboard/simulator",
                icon: <FlaskConical className="h-4 w-4" strokeWidth={1.8} />
            },
            {
                label: "Playground",
                href: "/dashboard/playground",
                icon: <Terminal className="h-4 w-4" strokeWidth={1.8} />
            },
            {
                label: "Admin Panel",
                href: "/dashboard/admin",
                icon: <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
            },
        ]
    },
    {
        label: "Informes",
        href: "/dashboard",
        icon: <LayoutDashboard className="h-5 w-5" strokeWidth={1.8} />,
        subItems: [
            {
                label: "Llamadas",
                href: "/dashboard/minutos",
                icon: <Clock className="h-4 w-4" strokeWidth={1.8} />
            },
            {
                label: "WhatsApp",
                href: "/dashboard/whatsapp",
                icon: <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
            },
            {
                label: "Campañas",
                href: "/dashboard/campanas",
                icon: <Megaphone className="h-4 w-4" strokeWidth={1.8} />,
                subItems: [
                    {
                        label: "Ver Campañas",
                        href: "/dashboard/campanas",
                        icon: <Megaphone className="h-3.5 w-3.5" strokeWidth={1.8} />
                    },
                    {
                        label: "Crear Campañas",
                        href: "/dashboard/campanas/nuevo",
                        icon: <PlusCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                    }
                ]
            },
            {
                label: "Auditoría de IA",
                href: "/dashboard/logs",
                icon: <Terminal className="h-4 w-4" strokeWidth={1.8} />
            },
            {
                label: "Análisis de Costes",
                href: "/dashboard/costs",
                icon: <DollarSign className="h-4 w-4" strokeWidth={1.8} />
            },
            {
                label: "Historial",
                href: "/dashboard/historial",
                icon: <History className="h-4 w-4" strokeWidth={1.8} />
            },
        ]
    },
    {
        label: "Config",
        href: "/dashboard/settings",
        icon: <Settings className="h-5 w-5" strokeWidth={1.8} />
    },
    {
        label: "Documentación",
        href: "/dashboard/docs",
        icon: <BookOpen className="h-5 w-5" strokeWidth={1.8} />
    },
];

export function Sidebar({ isAdmin, mobileOpen, onMobileClose }: {
    isAdmin: boolean;
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [expandedItems, setExpandedItems] = useState<string[]>(["Informes", "Campañas"]);
    const isConfigured = useTenantStore((s) => s.isConfigured);

    // Close mobile sidebar on navigation
    useEffect(() => {
        if (mobileOpen && onMobileClose) {
            onMobileClose();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    const toggleExpand = (label: string) => {
        setExpandedItems(prev => 
            prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
        );
    };

    const visibleNavItems = NAV_ITEMS.filter(item => {
        if (item.href === "/dashboard/settings") {
            return isAdmin;
        }
        return true;
    });

    const NavLink = ({ item, depth = 0 }: { item: NavItem, depth?: number }) => {
        const hasSubItems = item.subItems && item.subItems.length > 0;
        const isExpanded = expandedItems.includes(item.label);
        const safePathname = pathname || "";
        const isActive = safePathname === item.href || (item.href !== "/dashboard" && safePathname.startsWith(item.href + "/"));
        
        return (
            <div key={item.label} className="space-y-1">
                <div className={cn(
                    "flex items-center gap-1 rounded-xl px-1 text-sm font-semibold transition-all duration-200 group",
                    isActive && !hasSubItems
                        ? "bg-grad-primary text-primary-foreground shadow-lg shadow-primary/30"
                        : "text-foreground/60 hover:bg-card/60 hover:text-foreground",
                    depth > 0 && !collapsed && "ml-4"
                )}>
                {/* Main Link Area (Icon + Label) */}
                    <Link 
                        href={item.href}
                        className="flex flex-1 items-center gap-3 px-2 py-2.5 outline-none"
                        onClick={() => {
                            if (!isExpanded && hasSubItems) toggleExpand(item.label);
                        }}
                    >
                        <span className="relative flex-shrink-0">
                            {item.icon}
                            {item.href === "/dashboard/settings" && !isConfigured && (
                                <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                                </span>
                            )}
                        </span>
                        {!collapsed && <span className="flex-1">{item.label}</span>}
                    </Link>

                    {/* Expand Toggle (Chevron Area) */}
                    {!collapsed && hasSubItems && (
                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleExpand(item.label);
                            }}
                            className="p-2 mr-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                            title={isExpanded ? "Contraer" : "Expandir"}
                            aria-label={isExpanded ? "Contraer submenú" : "Expandir submenú"}
                        >
                            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                        </button>
                    )}
                </div>
                
                {hasSubItems && isExpanded && !collapsed && (
                    <div className="space-y-1">
                        {item.subItems?.map(subItem => (
                            <NavLink key={subItem.label} item={subItem} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            {/* ── MOBILE: Overlay backdrop ───────────────────────────────── */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
                    onClick={onMobileClose}
                />
            )}

            {/* ── DESKTOP Sidebar / MOBILE Drawer ───────────────────────── */}
            <aside
                className={cn(
                    "relative hidden md:flex h-screen flex-col border-r border-border transition-all duration-300 bg-grad-surface",
                    collapsed ? "w-16" : "w-64",
                    "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:flex max-md:w-72 max-md:shadow-2xl",
                    mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full",
                    "max-md:transition-transform max-md:duration-300"
                )}
            >
                {/* Logo */}
                <div className={cn("flex h-16 md:h-20 items-center justify-between border-b border-border transition-all px-4")}>
                    {!collapsed ? (
                        <NextImage src="/logo.png" alt="App Automatiza" width={180} height={36} className="h-9 w-auto object-contain" />
                    ) : (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 mx-auto transition-colors">
                            <svg viewBox="0 0 24 24" className="h-7 w-7 text-primary" fill="currentColor">
                                <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" />
                            </svg>
                        </div>
                    )}
                    {onMobileClose && (
                        <button 
                            onClick={onMobileClose} 
                            className="md:hidden h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground/50 hover:bg-card transition-all"
                            title="Cerrar menú"
                            aria-label="Cerrar menú"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {isAdmin && <TenantSelector collapsed={collapsed} isAdmin={isAdmin} />}

                <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 mt-2">
                    {visibleNavItems.map((item) => (
                        <NavLink key={item.label} item={item} />
                    ))}
                </nav>

                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="hidden md:flex m-3 items-center justify-center rounded-xl py-2.5 text-muted-foreground/40 transition hover:bg-card hover:text-foreground"
                    title={collapsed ? "Expandir" : "Colapsar"}
                >
                    <svg
                        className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                </button>
            </aside>

            {/* ── MOBILE: Bottom Navigation Bar ─────────────────────────── */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur-md px-1 pb-safe">
                {[
                    NAV_ITEMS[0], // Informes
                    ...(NAV_ITEMS[0].subItems?.slice(0, 3) || []), // Minutos, WhatsApp, Campañas
                    NAV_ITEMS[1] // Config
                ].filter(Boolean).map((item) => {
                    const safePathname = pathname || "";
                    const active = safePathname === item.href || (item.href !== "/dashboard" && safePathname.startsWith(item.href + "/"));
                    return (
                        <Link
                            key={`${item.href}-${item.label}`}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center gap-0.5 px-2 py-2 min-w-[48px] rounded-xl transition-all",
                                active ? "text-primary" : "text-muted-foreground/40"
                            )}
                        >
                            <span className={cn(
                                "flex items-center justify-center h-9 w-9 rounded-xl transition-all",
                                active ? "bg-primary/10" : ""
                            )}>
                                {item.icon}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-tight">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}
