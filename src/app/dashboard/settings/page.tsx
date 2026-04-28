/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import {
    getTenants,
    createTenant,
    updateTenant,
    deleteTenant,
} from "@/lib/actions/tenant";
import { useTenantStore } from "@/store/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Plus, Trash2, Edit2, Check, X, Shield, Globe, Building2, Zap 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tenant } from "@/types/tenant";
import { KpiBuilder } from "./KpiBuilder";
import { IntegrationsManager } from "./IntegrationsManager";

export default function SettingsPage() {
    const { setTenant: setActiveTenant } = useTenantStore();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Tenant> & { password?: string; api_type?: 'internal' | 'client' }>({
        name: "",
        username: "",
        client_email: "",
        password: "",
        supabase_url: "",
        supabase_anon_key: "",
        api_type: "internal" as "internal" | "client",
        is_admin: false,
        config: {}
    });
    const [showNewForm, setShowNewForm] = useState(false);

    useEffect(() => {
        loadTenants();
    }, []);

    async function loadTenants() {
        setLoading(true);
        const data = await getTenants();
        setTenants(data);
        setLoading(false);
    }

    async function handleSaveNew(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const configObj = typeof editForm.config === "string" ? JSON.parse(editForm.config || "{}") : editForm.config;
            const result = await createTenant({ ...editForm, config: configObj });

            if (result.error) {
                alert(result.error);
                return;
            }

            setShowNewForm(false);
            setEditForm({ name: "", username: "", client_email: "", password: "", is_admin: false, config: {}, api_type: "internal", supabase_url: "", supabase_anon_key: "" });
            await loadTenants();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            alert("Error crítico: " + msg);
        } finally {
            setSaving(false);
        }
    }

    async function handleUpdate(id: string) {
        try {
            const configObj = typeof editForm.config === "string" ? JSON.parse(editForm.config || "{}") : editForm.config;
            const tenantObj = tenants.find(t => t.id === id);

            const result = await updateTenant(id, {
                ...editForm,
                config: configObj,
                auth_user_id: tenantObj?.auth_user_id
            });

            if (result.error) {
                alert(result.error);
                return;
            }

            setIsEditing(null);
            loadTenants();

            // Update the active store if this is the currently active client
            if (result.data) {
                const updated = result.data;
                const configToStore = typeof updated.config === 'string' ? JSON.parse(updated.config) : updated.config;
                setActiveTenant({
                    tenantId: updated.id,
                    tenantName: updated.name || "",
                    config: configToStore || {},
                    isAdmin: !!updated.is_admin,
                });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            alert("Error crítico: " + msg);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("¿Estás seguro de eliminar este cliente?")) return;
        try {
            await deleteTenant(id);
            loadTenants();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            alert("Error al eliminar cliente: " + msg);
        }
    }

    function startEdit(t: Tenant) {
        setIsEditing(t.id);
        setEditForm({
            name: t.name,
            username: t.username || "",
            client_email: t.client_email || "",
            password: "",
            is_admin: !!t.is_admin,
            supabase_url: t.supabase_url || "",
            supabase_anon_key: t.supabase_anon_key || "",
            api_type: t.supabase_url ? "client" : "internal",
            config: t.config as Record<string, unknown>
        });
    }

    return (
        <div className="mx-auto max-w-5xl space-y-10 pb-20">
            <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Configuración de Clientes</h1>
                <p className="mt-2 text-base font-medium text-slate-500">
                    Gestiona los clientes del sistema centralizado. Cada cliente tiene su propio espacio de datos aislado por Row Level Security.
                </p>
            </div>

            {/* Clients List */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Clientes Activos</h2>
                    {!showNewForm && (
                        <Button
                            onClick={() => {
                                setShowNewForm(true);
                                setEditForm({ 
                                    name: "", 
                                    username: "", 
                                    client_email: "", 
                                    password: "", 
                                    is_admin: false, 
                                    config: {}, 
                                    api_type: "internal",
                                    supabase_url: "",
                                    supabase_anon_key: ""
                                });
                            }}
                            title="Añadir nuevo cliente"
                            aria-label="Añadir nuevo cliente"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
                        </Button>
                    )}
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">Cliente</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">Infraestructura</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">Email de Acceso</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">Nivel</th>
                                <th className="px-6 py-4 text-right pr-8 text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-200">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold animate-pulse">
                                        Sincronizando infraestructura...
                                    </td>
                                </tr>
                            )}

                            {!loading && tenants.length === 0 && !showNewForm && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold">
                                        <Globe className="mx-auto h-12 w-12 text-slate-100 mb-4" />
                                        No se han detectado clientes configurados.
                                    </td>
                                </tr>
                            )}

                            {/* New Tenant Form */}
                            {showNewForm && (
                                <tr>
                                    <td colSpan={5} className="p-0">
                                        <div className="bg-blue-50/30 p-8 border-b border-blue-100 animate-in slide-in-from-top duration-300">
                                            <form onSubmit={handleSaveNew} className="space-y-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
                                                        Configurar Nuevo Entorno
                                                    </h3>
                                                    <div className="flex items-center gap-3">
                                                        {/* Role Toggle for New Form */}
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setEditForm({ ...editForm, is_admin: !editForm.is_admin })} 
                                                            className={cn(
                                                                "flex items-center gap-2 px-3 h-9 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest shadow-sm", 
                                                                editForm.is_admin ? "bg-blue-600 border-blue-600 text-white shadow-blue-500/20" : "bg-white border-slate-200 text-slate-400"
                                                            )}
                                                            title="Cambiar rol (Admin / Cliente)"
                                                        >
                                                            {editForm.is_admin ? <><Shield className="h-3 w-3" /> Admin</> : <><Building2 className="h-3 w-3" /> Cliente</>}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => setShowNewForm(false)}
                                                            title="Cerrar formulario"
                                                            aria-label="Cerrar formulario de nuevo cliente"
                                                            className="h-9 w-9 flex items-center justify-center rounded-xl bg-white text-slate-400 hover:text-red-500 border border-slate-100 shadow-sm transition-all"
                                                        >
                                                            <X className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">Nombre del Proyecto</Label>
                                                        <Input
                                                            value={editForm.name}
                                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                            className="h-12 bg-white rounded-xl focus:ring-blue-100"
                                                            placeholder="Ej: Proyecto México"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">Nombre de Usuario</Label>
                                                        <Input
                                                            value={editForm.username}
                                                            onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                                                            className="h-12 bg-white rounded-xl focus:ring-blue-100"
                                                            placeholder="Ej: juan.perez"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">Email de Acceso</Label>
                                                        <Input
                                                            value={editForm.client_email}
                                                            onChange={e => setEditForm({ ...editForm, client_email: e.target.value })}
                                                            className="h-12 bg-white rounded-xl focus:ring-blue-100"
                                                            placeholder="cliente@ejemplo.com"
                                                            type="email"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">Contraseña</Label>
                                                        <Input
                                                            value={editForm.password}
                                                            onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                                                            className="h-12 bg-white rounded-xl focus:ring-blue-100"
                                                            placeholder="••••••••"
                                                            type="password"
                                                            required={!isEditing}
                                                        />
                                                    </div>

                                                    {/* API Type Selector */}
                                                    {!editForm.is_admin && (
                                                        <div className="md:col-span-2 space-y-4 pt-4 border-t border-blue-100/30">
                                                            <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">Infraestructura de Datos</Label>
                                                            <div className="flex gap-4">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditForm({...editForm, api_type: 'internal', supabase_url: '', supabase_anon_key: ''})}
                                                                    className={cn(
                                                                        "flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                                                                        editForm.api_type === 'internal' 
                                                                            ? "bg-blue-600/5 border-blue-600 text-blue-600 shadow-lg shadow-blue-500/10" 
                                                                            : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                                                    )}
                                                                >
                                                                    <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", editForm.api_type === 'internal' ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-300")}>
                                                                        <Globe className="h-4 w-4" />
                                                                    </div>
                                                                    <span className="text-[10px] font-black uppercase tracking-widest mt-1 text-center">API Interna<br/>(Centralizada)</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditForm({...editForm, api_type: 'client'})}
                                                                    className={cn(
                                                                        "flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                                                                        editForm.api_type === 'client' 
                                                                            ? "bg-blue-600/5 border-blue-600 text-blue-600 shadow-lg shadow-blue-500/10" 
                                                                            : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                                                                    )}
                                                                >
                                                                    <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", editForm.api_type === 'client' ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-300")}>
                                                                        <Shield className="h-4 w-4" />
                                                                    </div>
                                                                    <span className="text-[10px] font-black uppercase tracking-widest mt-1 text-center">API del Cliente<br/>(Supabase Externo)</span>
                                                                </button>
                                                            </div>

                                                            {editForm.api_type === 'client' && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 animate-in fade-in duration-300">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-blue-600">Supabase URL</Label>
                                                                        <Input value={editForm.supabase_url} onChange={e => setEditForm({ ...editForm, supabase_url: e.target.value })} className="h-11 bg-white border-blue-100 font-bold" placeholder="https://xyz.supabase.co" required />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-blue-600">Anon Key</Label>
                                                                        <Input value={editForm.supabase_anon_key} onChange={e => setEditForm({ ...editForm, supabase_anon_key: e.target.value })} className="h-11 bg-white border-blue-100 font-bold" placeholder="eyJhb..." required />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Additional Config */}
                                                    {!editForm.is_admin && (
                                                        <div className="md:col-span-2 space-y-6 pt-4">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">Título Dashboard</Label>
                                                                    <Input 
                                                                        value={(() => { 
                                                                            try { 
                                                                                const conf = typeof editForm.config === 'string' ? JSON.parse(editForm.config || '{}') : (editForm.config || {}); 
                                                                                return (conf as Record<string, any>).dashboard_title || ""; 
                                                                            } catch { return ""; } 
                                                                        })()} 
                                                                        onChange={e => { 
                                                                            try { 
                                                                                const conf = typeof editForm.config === 'string' ? JSON.parse(editForm.config || '{}') : (editForm.config || {}); 
                                                                                (conf as Record<string, any>).dashboard_title = e.target.value; 
                                                                                setEditForm({ ...editForm, config: JSON.stringify(conf, null, 2) as any }); 
                                                                            } catch { } 
                                                                        }} 
                                                                        className="h-11 bg-white rounded-xl" 
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">Headers</Label>
                                                                    <Input 
                                                                        value={(() => { 
                                                                            try { 
                                                                                const conf = typeof editForm.config === 'string' ? JSON.parse(editForm.config || '{}') : (editForm.config || {}); 
                                                                                return ((conf as Record<string, any>).headers || []).join(", "); 
                                                                            } catch { return ""; } 
                                                                        })()} 
                                                                        onChange={e => { 
                                                                            try { 
                                                                                const conf = typeof editForm.config === 'string' ? JSON.parse(editForm.config || '{}') : (editForm.config || {}); 
                                                                                (conf as Record<string, any>).headers = e.target.value.split(",").map((s: string) => s.trim()).filter((s: string) => s !== ""); 
                                                                                setEditForm({ ...editForm, config: JSON.stringify(conf, null, 2) as any }); 
                                                                            } catch { } 
                                                                        }} 
                                                                        className="h-11 bg-white rounded-xl" 
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                                                <KpiBuilder 
                                                                    kpis={(editForm.config as Record<string, any>)?.kpis || []} 
                                                                    onChange={(kpis) => { 
                                                                        const current = (editForm.config as Record<string, any>) || {}; 
                                                                        setEditForm({ ...editForm, config: { ...current, kpis } }); 
                                                                    }} 
                                                                />
                                                            </div>

                                                            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                                                                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                                                    <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Servidodes Externos e Integraciones
                                                                </h3>
                                                                <IntegrationsManager 
                                                                    tenantId={isEditing || undefined}
                                                                    config={(editForm.config as Record<string, unknown>) || {}}
                                                                    onChange={(newConf) => {
                                                                        setEditForm({ ...editForm, config: newConf as any });
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex gap-3 pt-6">
                                                    <Button type="submit" disabled={saving} className="h-12 px-8 bg-blue-600 font-black text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                                                        {saving ? "Desplegando..." : "Desplegar Cliente"}
                                                    </Button>
                                                    <Button type="button" variant="ghost" onClick={() => setShowNewForm(false)} className="h-12 text-slate-400 font-bold rounded-xl hover:bg-slate-100">Descartar</Button>
                                                </div>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {tenants.map(t => (
                                <tr key={t.id} className={cn("transition-all duration-300", isEditing === t.id ? "bg-blue-50/50" : "hover:bg-slate-50/50")}>
                                    {isEditing === t.id ? (
                                        <td colSpan={5} className="p-8">
                                            <div className="flex items-center justify-between gap-6 mb-8">
                                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
                                                    <Edit2 className="h-4 w-4 text-blue-600" /> Editando: <span className="text-blue-600">{t.name}</span>
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <button type="button" onClick={() => setEditForm({ ...editForm, is_admin: !editForm.is_admin })} className={cn("flex items-center gap-2 px-3 h-8 rounded-lg border transition-all text-[10px] font-black uppercase tracking-widest shadow-sm", editForm.is_admin ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-400")}>
                                                        {editForm.is_admin ? "Admin" : "Cliente"}
                                                    </button>
                                                    <button onClick={() => handleUpdate(t.id)} className="h-8 px-4 bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg shadow-lg flex items-center gap-2 hover:bg-emerald-700 transition-all"><Check className="h-3 w-3" /> Guardar</button>
                                                    <button onClick={() => setIsEditing(null)} className="h-8 px-4 bg-white text-slate-400 font-bold text-[10px] uppercase tracking-widest rounded-lg border border-slate-100 hover:bg-slate-50 transition-all flex items-center gap-2"><X className="h-3 w-3" /> Cancelar</button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre del Proyecto</Label><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold" /></div>
                                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Usuario</Label><Input value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold" /></div>
                                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email</Label><Input value={editForm.client_email} onChange={e => setEditForm({ ...editForm, client_email: e.target.value })} className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold" /></div>
                                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pass</Label><Input value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" type="password" placeholder="Opcional" /></div>

                                                {!editForm.is_admin && (
                                                    <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100">
                                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Infraestructura</Label>
                                                        <div className="flex gap-4">
                                                            <button type="button" onClick={() => setEditForm({...editForm, api_type: 'internal', supabase_url: '', supabase_anon_key: ''})} className={cn("flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border-2 transition-all font-black text-[9px] uppercase tracking-widest", editForm.api_type === 'internal' ? "bg-blue-600/5 border-blue-600 text-blue-600" : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-400")}>
                                                                <Globe className="h-3 w-3" /> Interna
                                                            </button>
                                                            <button type="button" onClick={() => setEditForm({...editForm, api_type: 'client'})} className={cn("flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border-2 transition-all font-black text-[9px] uppercase tracking-widest", editForm.api_type === 'client' ? "bg-blue-600/5 border-blue-600 text-blue-600" : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-400")}>
                                                                <Shield className="h-3 w-3" /> Externa
                                                            </button>
                                                        </div>
                                                        {editForm.api_type === 'client' && (
                                                            <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                                                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-blue-600">URL</Label><Input value={editForm.supabase_url} onChange={e => setEditForm({ ...editForm, supabase_url: e.target.value })} className="h-10 bg-white border-blue-100" /></div>
                                                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-blue-600">Key</Label><Input value={editForm.supabase_anon_key} onChange={e => setEditForm({ ...editForm, supabase_anon_key: e.target.value })} className="h-10 bg-white border-blue-100" /></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {!editForm.is_admin && (
                                                <div className="md:col-span-2 space-y-6 pt-6 border-t border-slate-100 mt-6">
                                                    <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-inner">
                                                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mb-6 flex items-center gap-2">
                                                            <Zap className="h-4 w-4 text-blue-600" /> Integraciones de Voz y Mensajería
                                                        </h3>
                                                        <IntegrationsManager 
                                                            tenantId={isEditing || undefined}
                                                            config={(editForm.config as Record<string, unknown>) || {}}
                                                            onChange={(newConf) => {
                                                                    setEditForm({ ...editForm, config: newConf as any });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-blue-600">
                                                        <Building2 className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-900 tracking-tight">{t.name}</span>
                                                        {t.username && <span className="text-[10px] text-slate-500">@{t.username}</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-[10px] font-bold">
                                                {t.is_admin ? (
                                                    <span className="text-blue-600 flex items-center gap-1.5 uppercase tracking-widest"><Shield className="h-3 w-3" /> Sistema Central</span>
                                                ) : (
                                                    t.supabase_url ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-emerald-600 flex items-center gap-1.5 uppercase tracking-widest"><Globe className="h-3 w-3" /> API del Cliente</span>
                                                            <span className="text-[9px] font-mono text-slate-400 truncate max-w-[120px]">{t.supabase_url}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 flex items-center gap-1.5 uppercase tracking-widest"><Globe className="h-3 w-3" /> API Interna</span>
                                                    )
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{t.client_email || "-"}</td>
                                            <td className="px-6 py-4">
                                                {t.is_admin ? (
                                                    <span className="px-2 py-1 rounded-full bg-blue-50 text-[9px] font-black uppercase text-blue-600 border border-blue-100">Admin</span>
                                                ) : (
                                                    <span className="px-2 py-1 rounded-full bg-slate-50 text-[9px] font-black uppercase text-slate-400 border border-slate-100">Cliente</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right pr-8">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => startEdit(t)} 
                                                        title="Editar cliente"
                                                        aria-label={`Editar cliente ${t.name}`}
                                                        className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(t.id)} 
                                                        title="Eliminar cliente"
                                                        aria-label={`Eliminar cliente ${t.name}`}
                                                        className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Security Alert */}
            <div className="rounded-3xl bg-blue-600 p-8 flex items-center gap-6 shadow-xl shadow-blue-100 overflow-hidden relative text-white">
                <Shield className="h-10 w-10 text-blue-100 opacity-50" />
                <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em]">Protocolo de Seguridad Centralizada</h4>
                    <p className="text-sm font-medium text-blue-100 leading-relaxed max-w-2xl">
                        Cada entorno cargado aquí utiliza un túnel seguro. Los administradores centralizados pueden gestionar KPIs y flujos sin comprometer la integridad de los datos de cada cliente.
                    </p>
                </div>
            </div>
        </div>
    );
}
