import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
    MessageSquare, Key, Phone, Mic, 
    PhoneCall, Zap, RefreshCw, CheckCircle2, Brain 
} from "lucide-react";
import { syncRetellResources } from "@/lib/actions/retell-sync";
import { syncWhatsAppTemplates } from "@/lib/actions/whatsapp-sync";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TelephonyConfig {
    provider?: string;
    credentials?: {
        accountSid?: string;
        authToken?: string;
        fromNumber?: string;
    };
}

interface WhatsAppTemplate {
    name: string;
    language: string;
    status: string;
}

interface WhatsAppConfig {
    accessToken: string;
    phoneNumberId: string;
    wabaId: string;
    verifyToken: string;
    templates?: WhatsAppTemplate[];
    lastSync?: string;
}

interface AWSConfig {
    kbId?: string;
    region?: string;
    s3Bucket?: string;
}

interface IntegrationsManagerProps {
    tenantId?: string;
    config: Record<string, unknown>; 
    onChange: (newConfig: Record<string, unknown>) => void;
}

export function IntegrationsManager({ tenantId, config, onChange }: IntegrationsManagerProps) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSyncingWA, setIsSyncingWA] = useState(false);

    // ── WhatsApp Config ──
    const whatsapp = (config?.whatsapp as WhatsAppConfig) || {
        accessToken: "",
        phoneNumberId: "",
        wabaId: "",
        verifyToken: ""
    };

    // ── Retell AI Config ──
    const retell = (config?.retell as { api_key?: string }) || {};
    const retellApiKey = retell.api_key || ""; 

    // ── Ultravox AI Config ──
    const ultravox = (config?.ultravox as { api_key?: string }) || {};
    const ultravoxApiKey = ultravox.api_key || "";

    // ── Telephony Config ──
    const telephony = (config?.telephony as TelephonyConfig) || {};

    const updateField = (category: string, fields: Record<string, unknown>) => {
        const categoryData = { ...((config[category] as Record<string, unknown>) || {}), ...fields };
        
        if (category === 'retell') {
            delete categoryData.apiKey;
            delete categoryData.agentId;
        }

        if (category === 'ultravox' && (categoryData as Record<string, unknown>).apiKey) {
            const data = categoryData as Record<string, unknown>;
            data.api_key = data.apiKey;
            delete data.apiKey;
        }

        onChange({
            ...config,
            [category]: categoryData
        });
    };

    const handleSync = async (apiKey: string) => {
        if (!apiKey) {
            alert("Por favor, introduce una API Key antes de sincronizar.");
            return;
        }
        setIsSyncing(true);
        try {
            const res = await syncRetellResources(apiKey);
            if (!res.success) {
                alert(res.error || "Error al sincronizar con Retell");
            }
        } catch {
            alert("Fallo crítico en la conexión con Retell.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleWASync = async () => {
        if (!tenantId) {
            alert("Primero debes guardar el cliente antes de sincronizar sus plantillas.");
            return;
        }
        if (!whatsapp.accessToken || !whatsapp.wabaId) {
            alert("Se requiere Access Token y WABA ID para sincronizar.");
            return;
        }

        setIsSyncingWA(true);
        try {
            const res = await syncWhatsAppTemplates(tenantId, whatsapp);
            if (res.success && res.data) {
                updateField('whatsapp', { 
                    templates: res.data,
                    lastSync: new Date().toISOString() 
                });
            } else {
                alert(res.error || "Error al sincronizar con Meta");
            }
        } catch (err: unknown) {
            const error = err as Error;
            alert("Error de conexión: " + error.message);
        } finally {
            setIsSyncingWA(false);
        }
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* ── SECTION: RETELL AI ── */}
            <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-500/20">
                            <PhoneCall className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Retell AI Integration</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-left">Motor de Voz Conversacional de Baja Latencia</p>
                        </div>
                    </div>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSync(retellApiKey)}
                        disabled={isSyncing || !retellApiKey}
                        className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest gap-2 bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100"
                    >
                        <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
                        {isSyncing ? "Sincronizando..." : "Sincronizar Recursos"}
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 text-left">
                            <Key className="h-3 w-3" /> API Key
                        </Label>
                        <Input 
                            value={retellApiKey}
                            onChange={(e) => updateField('retell', { api_key: e.target.value })}
                            type="password"
                            placeholder="key_..."
                            className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs"
                        />
                    </div>
                </div>
            </div>

            {/* ── SECTION: ULTRAVOX AI ── */}
            <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center border border-purple-500/20">
                            <Mic className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Ultravox AI Integration</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-left">Web-native Realtime Voice Inference</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 text-left">
                            <Key className="h-3 w-3" /> API Key
                        </Label>
                        <Input 
                            value={ultravoxApiKey}
                            onChange={(e) => updateField('ultravox', { api_key: e.target.value })}
                            type="password"
                            placeholder="Ultravox API Secret"
                            className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs"
                        />
                    </div>
                </div>
            </div>

            {/* ── SECTION: TELEPHONY ── */}
            <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center border border-orange-500/20">
                            <Phone className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Telephony Settings</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-left">External Voice Connectors (Outbound Streams)</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">Provider</Label>
                        <select 
                            title="Telephony Provider"
                            value={telephony.provider || "twilio"}
                            onChange={(e) => updateField('telephony', { provider: e.target.value })}
                            className="w-full h-11 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-bold"
                        >
                            <option value="twilio">Twilio (Recomendado)</option>
                            <option value="telnyx">Telnyx (Próximamente)</option>
                            <option value="plivo">Plivo (Próximamente)</option>
                        </select>
                    </div>
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">Account SID / API Key</Label>
                        <Input 
                            value={telephony.credentials?.accountSid || ""}
                            onChange={(e) => updateField('telephony', { credentials: { ...(telephony.credentials || {}), accountSid: e.target.value } })}
                            placeholder="AC..."
                            className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs"
                        />
                    </div>
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">Auth Token / API Secret</Label>
                        <Input 
                            value={telephony.credentials?.authToken || ""}
                            onChange={(e) => updateField('telephony', { credentials: { ...(telephony.credentials || {}), authToken: e.target.value } })}
                            type="password"
                            placeholder="••••••••"
                            className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs"
                        />
                    </div>
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">Default From Number</Label>
                        <Input 
                            value={telephony.credentials?.fromNumber || ""}
                            onChange={(e) => updateField('telephony', { credentials: { ...(telephony.credentials || {}), fromNumber: e.target.value } })}
                            placeholder="+1..."
                            className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                        />
                    </div>
                </div>
            </div>

            {/* ── SECTION: WHATSAPP ── */}
            <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Meta API (WhatsApp Cloud)</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-left">Configuraciones de mensajería empresarial</p>
                        </div>
                    </div>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={handleWASync}
                        disabled={isSyncingWA || !whatsapp.accessToken || !whatsapp.wabaId}
                        className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest gap-2 bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100"
                    >
                        <RefreshCw className={cn("h-3 w-3", isSyncingWA && "animate-spin")} />
                        {isSyncingWA ? "Sincronizando..." : "Sincronizar Plantillas"}
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">Access Token (Permanent)</Label>
                        <Input 
                            value={whatsapp.accessToken}
                            onChange={(e) => updateField('whatsapp', { accessToken: e.target.value })}
                            type="password"
                            placeholder="EAAB..."
                            className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs"
                        />
                    </div>
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">Phone Number ID</Label>
                        <Input 
                            value={whatsapp.phoneNumberId}
                            onChange={(e) => updateField('whatsapp', { phoneNumberId: e.target.value })}
                            placeholder="1234..."
                            className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                        />
                    </div>
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">WABA ID</Label>
                        <Input 
                            value={whatsapp.wabaId}
                            onChange={(e) => updateField('whatsapp', { wabaId: e.target.value })}
                            placeholder="WABA ID"
                            className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                        />
                    </div>
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">Verify Token (Para Webhook)</Label>
                        <Input 
                            value={whatsapp.verifyToken}
                            onChange={(e) => updateField('whatsapp', { verifyToken: e.target.value })}
                            placeholder="automatiza_for_2025"
                            className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-sm"
                        />
                    </div>
                    <div className="md:col-span-2 p-4 rounded-xl bg-slate-950/5 border border-dashed border-slate-200 dark:border-slate-800">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Webhook URL (Pega esto en Meta Dashboard)</p>
                        <code className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 break-all">
                            https://app.automatizaformacion.com/api/webhooks/whatsapp
                        </code>
                    </div>
                </div>

                {whatsapp.templates && whatsapp.templates.length > 0 && (
                    <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Plantillas Sincronizadas ({whatsapp.templates.length})
                            </h4>
                            {whatsapp.lastSync && (
                                <span className="text-[9px] text-slate-400 font-medium">Último sync: {new Date(whatsapp.lastSync).toLocaleString()}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {whatsapp.templates.slice(0, 6).map((tp, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={tp.name}>{tp.name}</span>
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                                        tp.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                                    )}>
                                        {tp.language} | {tp.status?.slice(0, 3)}
                                    </span>
                                </div>
                            ))}
                            {whatsapp.templates.length > 6 && (
                                <div className="flex items-center justify-center p-2 rounded-lg border border-dashed border-slate-200 text-[9px] font-bold text-slate-400">
                                    + {whatsapp.templates.length - 6} más...
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex gap-4 items-start text-left">
                <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                    <Zap className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Orquestación Multi-Agente</h4>
                    <p className="text-[11px] text-blue-700/70 dark:text-blue-300/60 font-medium leading-relaxed">
                        Estas credenciales permiten al orquestador central disparar llamadas y mensajes automáticos bajo la identidad de este cliente.
                    </p>
                </div>
            </div>

            {/* ── SECTION: AWS BEDROCK & S3 (KNOWLEDGE BASE) ── */}
            <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center border border-orange-500/20">
                        <Brain className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">AWS Intelligence (Knowledge Base)</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-left">Gestión de cerebro RAG y almacenamiento S3</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">Default Knowledge Base ID (Bedrock)</Label>
                        <Input 
                            value={(config?.aws as AWSConfig)?.kbId || ""}
                            onChange={(e) => updateField('aws', { kbId: e.target.value })}
                            placeholder="G9P0FC3S29"
                            className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs"
                        />
                    </div>
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">AWS Region</Label>
                        <Input 
                            value={(config?.aws as AWSConfig)?.region || "us-east-1"}
                            onChange={(e) => updateField('aws', { region: e.target.value })}
                            placeholder="us-east-1"
                            className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                        />
                    </div>
                    <div className="space-y-2 text-left">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">S3 Bucket Name</Label>
                        <Input 
                            value={(config?.aws as AWSConfig)?.s3Bucket || "automatiza-knowledge-base"}
                            onChange={(e) => updateField('aws', { s3Bucket: e.target.value })}
                            placeholder="nombre-del-bucket"
                            className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
