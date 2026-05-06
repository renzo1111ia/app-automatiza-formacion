"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { 
    ReactFlow, 
    Background, 
    Controls, 
    Connection, 
    Node,
    Edge,
    addEdge, 
    useNodesState, 
    useEdgesState,
    Panel,
    Handle,
    Position,
    PanelPosition
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { 
    MessageSquare,
    HelpCircle,
    GitBranch,
    Calendar,
    Settings,
    Zap,
    Check,
    Timer,
    Terminal,
    Database,
    Link2,
    Trash2,
    X,
    Globe,
    Brain,
    Plus,
    Sparkles,
    Search,
    LayoutGrid,
    Layers,
    Activity,
    ArrowRight,
    Save,
    FileText,
    AlarmClock,
    LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AIAgent } from "@/types/database";
import { getAIAgents } from "@/lib/actions/agents";

interface FlowNodeData {
    text?: string;
    ifLabel?: string;
    elseLabel?: string;
    delay_value?: number;
    delay_unit?: string;
    command_type?: string;
    fields?: string[];
    target_variable?: string;
    webhook_url?: string;
    metadata_key?: string;
    metadata_value?: string;
    tag_name?: string;
    event?: string;
    method?: string;
    url?: string;
    headers?: string;
    payload?: string;
    action?: string;
    table?: string;
    mapping?: string;
    model?: string;
    task?: string;
    instructions?: string;
    label?: string;
    validation?: string;
    config?: Record<string, unknown>;
    // Wait properties
    interrupt_on_reply?: boolean;
    wait_condition_variable?: string;
    // Condition properties
    condition_variable?: string;
    condition_operator?: string;
    condition_value?: string;
    // CRM properties
    type?: string;
    mappings?: Record<string, string>;
    crm_mappings?: string;
    api_url?: string;
    api_key?: string;
    operation?: string;
    platform?: string;
    ownerId?: string;
    tagName?: string;
    transitionId?: string;
    timeout?: number;
    max_retries?: number;
    message?: string;
    [key: string]: unknown;
}

// ─── Custom Node Types ─────────────────────────────────────────────

const NodeWrapper = ({ title, icon: Icon, children, color, selected, type, headerColor }: { title: string; icon: LucideIcon; children: React.ReactNode; color: string; selected?: boolean; type?: string; headerColor: string }) => (
    <div className={cn(
        "rounded-2xl border-2 transition-all duration-500 min-w-[240px] shadow-2xl bg-slate-900/90 backdrop-blur-xl overflow-hidden",
        selected 
            ? "border-primary/60 ring-8 ring-primary/5 scale-[1.02] -translate-y-1 shadow-[0_0_40px_rgba(var(--primary-rgb),0.2)]" 
            : "border-white/5 hover:border-white/10 shadow-black/60",
    )}>
        {/* Progress bar style header */}
        <div className={cn("h-1 w-full relative overflow-hidden", headerColor)}>
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
        </div>
        
        <div className="px-5 py-5">
            <div className="flex items-center gap-3 mb-4">
                <div className={cn("p-2 rounded-xl shadow-lg shrink-0", color)}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-[7px] font-black uppercase tracking-[0.3em] text-white/20 block truncate mb-0.5">{type || "MODULO"}</span>
                    <span className="text-xs font-bold text-white tracking-tight truncate block">{title}</span>
                </div>
                {selected && (
                    <motion.div 
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),1)]" 
                    />
                )}
            </div>
            <div className="space-y-3">{children}</div>
        </div>
    </div>
);

const TriggerNode = ({ data, selected }: { data: { event?: string }; selected?: boolean }) => (
    <NodeWrapper title="Disparador" icon={Zap} color="bg-yellow-500/20 text-yellow-500" headerColor="bg-yellow-500" selected={selected} type="INICIO">
        <div className="px-2 py-1.5 bg-yellow-500/5 rounded-lg border border-yellow-500/10">
            <p className="text-[10px] text-yellow-200/50 font-medium leading-relaxed">
                {data.event || "Nueva entrada de lead"}
            </p>
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-yellow-500 border-2 border-slate-900" />
    </NodeWrapper>
);

const MessageNode = ({ data, selected }: { data: { text?: string }; selected?: boolean }) => (
    <NodeWrapper title="Respuesta Agente" icon={MessageSquare} color="bg-blue-500/20 text-blue-400" headerColor="bg-blue-500" selected={selected} type="SALIDA">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-2 border-slate-900" />
        <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 italic text-[10px] text-white/70 line-clamp-3">
            &quot;{data.text || "El agente responderá usando su conocimiento..."}&quot;
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-2 border-slate-900" />
    </NodeWrapper>
);

interface NodeSimulation {
    status: 'idle' | 'loading' | 'success' | 'error';
    result?: unknown;
    request?: unknown;
    error?: string;
    timestamp?: string;
}

const HTTPRequestNode = ({ data, selected }: { data: { method?: string; url?: string; simulation?: NodeSimulation }; selected?: boolean }) => {
    const sim = data.simulation;
    return (
        <NodeWrapper title="HTTP Request" icon={Globe} color="bg-orange-500/20 text-orange-400" headerColor="bg-orange-500" selected={selected} type="INTEGRACIÓN">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-orange-500 border-2 border-slate-900" />
            <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded">{data.method || "POST"}</span>
                    <span className="text-[10px] text-white/40 truncate flex-1">{data.url || "https://api..."}</span>
                </div>
                {sim && sim.status === 'success' && (
                    <div className="mt-2 p-1.5 bg-emerald-500/10 rounded border border-emerald-500/20 flex items-center gap-2 animate-in fade-in zoom-in-95">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[8px] font-bold text-emerald-400 uppercase">Respuesta: 200 OK</span>
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-orange-500 border-2 border-slate-900" />
        </NodeWrapper>
    );
};

const DatabaseNode = ({ data, selected }: { data: { action?: string; target?: string }; selected?: boolean }) => (
    <NodeWrapper title="Acción DB" icon={Database} color="bg-cyan-500/20 text-cyan-400" headerColor="bg-cyan-500" selected={selected} type="DATOS">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-cyan-500 border-2 border-slate-900" />
        <div className="p-2 bg-cyan-500/5 rounded-lg border border-cyan-500/10">
            <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-tighter">{data.action || "UPDATE_LEAD"} <span className="text-white/20">→</span> {data.target || "Status"}</p>
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-cyan-500 border-2 border-slate-900" />
    </NodeWrapper>
);

const AITaskNode = ({ data, selected }: { data: { task?: string; instructions?: string }; selected?: boolean }) => (
    <NodeWrapper title="Procesador IA" icon={Brain} color="bg-purple-500/20 text-purple-400" headerColor="bg-purple-500" selected={selected} type="CEREBRO">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-purple-500 border-2 border-slate-900" />
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-purple-200/60 font-black uppercase tracking-widest">
                <Sparkles className="w-3 h-3" />
                {data.task || "ANÁLISIS DE DATOS"}
            </div>
            <div className="p-2 bg-purple-500/5 rounded-lg border border-purple-500/10 text-[9px] text-white/50 italic line-clamp-3">
                {data.instructions || "Extraer información o validar criterios..."}
            </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-purple-500 border-2 border-slate-900" />
    </NodeWrapper>
);

const QuestionNode = ({ data, selected }: { data: { text?: string; validation?: string }; selected?: boolean }) => (
    <NodeWrapper title="Pregunta" icon={HelpCircle} color="bg-emerald-500/20 text-emerald-400" headerColor="bg-emerald-500" selected={selected} type="INTERACCIÓN">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-500 border-2 border-slate-900" />
        <div className="space-y-2">
            <p className="text-[10px] text-white/80 font-medium italic leading-relaxed">&quot;{data.text || "¿Cuál es tu duda?"}&quot;</p>
            {data.validation && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">{data.validation}</span>
                </div>
            )}
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500 border-2 border-slate-900" />
    </NodeWrapper>
);

const AIAgentNode = ({ data, selected }: { data: { agentId?: string; agentName?: string }; selected?: boolean }) => (
    <NodeWrapper title="Llamar otro Agente" icon={Brain} color="bg-indigo-500/20 text-indigo-400" headerColor="bg-indigo-500" selected={selected} type="CROSS_AGENT">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-500 border-2 border-slate-900" />
        <div className="space-y-2">
            <div className="p-2 bg-indigo-500/5 rounded-lg border border-indigo-500/10 text-[10px] font-bold text-indigo-300">
                Delegar a: {data.agentName || "Seleccionar..."}
            </div>
            <p className="text-[8px] text-white/30 uppercase tracking-widest font-black">Transfiere el control a otro experto</p>
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500 border-2 border-slate-900" />
    </NodeWrapper>
);

const MetaTemplateNode = ({ data, selected }: { data: { templateName?: string; language?: string }; selected?: boolean }) => (
    <NodeWrapper title="Plantilla Meta" icon={FileText} color="bg-green-500/20 text-green-400" headerColor="bg-green-500" selected={selected} type="WHATSAPP">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-green-500 border-2 border-slate-900" />
        <div className="space-y-2">
            <div className="flex items-center gap-1.5 p-1.5 bg-green-500/5 rounded border border-green-500/10">
                <span className="text-[9px] font-black uppercase text-green-400">{data.templateName || "N/A"}</span>
                <span className="text-[7px] text-white/20">({data.language || "es"})</span>
            </div>
            <p className="text-[8px] text-white/30 italic">Mapeo dinámico activado</p>
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-green-500 border-2 border-slate-900" />
    </NodeWrapper>
);

const ConditionNode = ({ data, selected }: { data: { ifLabel?: string; elseLabel?: string }; selected?: boolean }) => (
    <NodeWrapper title="Filtro" icon={GitBranch} color="bg-pink-500/20 text-pink-400" headerColor="bg-pink-500" selected={selected} type="LÓGICA">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-pink-500 border-2 border-slate-900" />
        <div className="flex justify-between items-center px-3 py-2 bg-pink-500/5 rounded-xl border border-pink-500/10">
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{data.ifLabel || "SÍ"}</span>
            <div className="w-[1px] h-3 bg-white/10 mx-2" />
            <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">{data.elseLabel || "NO"}</span>
        </div>
        <Handle type="source" position={Position.Bottom} id="if" className="w-3 h-3 bg-emerald-500 border-slate-900 border-2 left-[25%]" />
        <Handle type="source" position={Position.Bottom} id="else" className="w-3 h-3 bg-rose-500 border-slate-900 border-2 left-[75%]" />
    </NodeWrapper>
);

const WaitNode = ({ data, selected }: { data: { delay_value?: number; delay_unit?: string }; selected?: boolean }) => (
    <NodeWrapper title="Esperar" icon={Timer} color="bg-amber-500/10 text-amber-400" headerColor="bg-amber-500" selected={selected} type="TEMPORIZADOR">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500 border-2 border-slate-900" />
        <div className="flex flex-col items-center">
            <span className="text-[14px] font-black">{data.delay_value || 0}</span>
            <span className="text-[8px] uppercase tracking-widest text-white/30">{data.delay_unit || "minutos"}</span>
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-500 border-2 border-slate-900" />
    </NodeWrapper>
);

const CommandNode = ({ data, selected }: { data: { command_type?: string }; selected?: boolean }) => (
    <NodeWrapper title="Comando" icon={Terminal} color="bg-blue-500/20 text-blue-400" headerColor="bg-blue-500" selected={selected} type="SISTEMA">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-2 border-slate-900" />
        <div className="p-2 bg-blue-500/5 rounded-lg border border-blue-500/10 text-[10px] font-bold text-blue-400 uppercase">
            {data.command_type || "EJECUTAR_ACCION"}
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-2 border-slate-900" />
    </NodeWrapper>
);

const InactivityNode = ({ data, selected }: { data: { timeout?: number; max_retries?: number; message?: string }; selected?: boolean }) => (
    <NodeWrapper title="Inactividad" icon={AlarmClock} color="bg-red-500/20 text-red-400" headerColor="bg-red-500" selected={selected} type="RESCATE">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-red-500 border-2 border-slate-900" />
        <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-white/40">ESPERA:</span>
                <span className="text-red-400">{data.timeout || 30} min</span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-white/40">REINTENTOS:</span>
                <span className="text-red-400">{data.max_retries || 1}</span>
            </div>
            <div className="p-2 bg-red-500/5 rounded-lg border border-red-500/10 text-[9px] text-white/50 italic line-clamp-2">
                &quot;{data.message || "Enviando mensaje de rescate..."}&quot;
            </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-red-500 border-2 border-slate-900" />
    </NodeWrapper>
);

const CollectorNode = ({ data, selected }: { data: { fields?: string[]; target_variable?: string }; selected?: boolean }) => (
    <NodeWrapper title="Colector" icon={Database} color="bg-cyan-500/20 text-cyan-400" headerColor="bg-cyan-500" selected={selected} type="DATOS">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-cyan-500 border-2 border-slate-900" />
        <div className="space-y-1">
            <p className="text-[8px] font-black uppercase tracking-tighter text-cyan-300/40">Destino: {data.target_variable || "unified_data"}</p>
            <div className="flex flex-wrap gap-1">
                {(data.fields || ["array"]).map((f, idx) => (
                    <span key={idx} className="text-[7px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/10 uppercase font-black">{f}</span>
                ))}
            </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-cyan-500 border-2 border-slate-900" />
    </NodeWrapper>
);

const BookNode = ({ selected }: { selected?: boolean }) => (
    <NodeWrapper title="Agendar" icon={Calendar} color="bg-amber-500/10 text-amber-400" headerColor="bg-amber-500" selected={selected} type="CALENDARIO">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500 border-2 border-slate-900" />
        <p className="text-[10px] font-bold text-white/40">Cierra y agenda cita</p>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-500 border-2 border-slate-900" />
    </NodeWrapper>
);

const CRMNode = ({ data, selected }: { data: { type?: string; tagName?: string; ownerId?: string; mappings?: Record<string, string> }; selected?: boolean }) => (
    <NodeWrapper title="CRM Integration" icon={Database} color="bg-indigo-600/20 text-indigo-400" headerColor="bg-indigo-600" selected={selected} type="CRM">
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-600 border-2 border-slate-900" />
        <div className="space-y-1.5">
            <div className="p-2 bg-indigo-600/5 rounded-lg border border-indigo-600/10">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">
                    {data.type || "ACCION REQUERIDA"}
                </p>
                {data.mappings && (
                    <p className="text-[8px] text-white/30 italic mt-1">
                        {Object.keys(data.mappings).length} campos mapeados
                    </p>
                )}
            </div>
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-600 border-2 border-slate-900" />
    </NodeWrapper>
);

const CRM_PLATFORM_COLORS: Record<string, { color: string; bg: string; border: string }> = {
    zoho:       { color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
    hubspot:    { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    salesforce: { color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
    pipedrive:  { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
    custom:     { color: "text-slate-300",  bg: "bg-slate-500/10",  border: "border-slate-500/20" },
};

const CrmConnectNode = ({ data, selected }: { data: { platform?: string; operation?: string; api_url?: string; simulation?: NodeSimulation }; selected?: boolean }) => {
    const platform = data.platform || "zoho";
    const palette = CRM_PLATFORM_COLORS[platform] || CRM_PLATFORM_COLORS.custom;
    const platformLabel: Record<string, string> = {
        zoho: "Zoho CRM", hubspot: "HubSpot", salesforce: "Salesforce",
        pipedrive: "Pipedrive", custom: "API Custom"
    };
    const sim = data.simulation;
    return (
        <NodeWrapper title="Conectar BD / CRM" icon={Link2} color={`${palette.bg} ${palette.color}`} headerColor={palette.bg.replace("/10", "")} selected={selected} type="CONECTOR">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-violet-500 border-2 border-slate-900" />
            <div className="space-y-2">
                <div className={cn("px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider", palette.bg, palette.color, palette.border)}>
                    {platformLabel[platform] || "Plataforma"}
                </div>
                <p className="text-[9px] text-white/40 line-clamp-1 uppercase tracking-wide">{data.operation || "OPERACIÓN"}</p>
                
                {sim && sim.status === 'success' && (
                    <div className="p-1.5 bg-emerald-500/10 rounded border border-emerald-500/20 flex items-center justify-between animate-in fade-in zoom-in-95">
                        <span className="text-[8px] font-bold text-emerald-400 uppercase">Sincronizado</span>
                        <Check className="h-2 w-2 text-emerald-400" />
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-violet-500 border-2 border-slate-900" />
        </NodeWrapper>
    );
};

// ─── Component ─────────────────────────────────────────────────────

interface AgentFlowBuilderProps {
    initialFlow: { nodes: Node<FlowNodeData>[]; edges: Edge[] };
    onSave: (flow: { nodes: Node<FlowNodeData>[]; edges: Edge[] }) => void;
    onClose: () => void;
    agentName: string;
    isInline?: boolean;
}

export function AgentFlowBuilder({ initialFlow, onSave, onClose, agentName, isInline }: AgentFlowBuilderProps) {
    const [saving, setSaving] = useState(false);
    const [isNodeLibraryOpen, setIsNodeLibraryOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [aiAgents, setAiAgents] = useState<AIAgent[]>([]);
    const [precedingVariables, setPrecedingVariables] = useState<string[]>([]);
    const [nodeSimulations, setNodeSimulations] = useState<Record<string, NodeSimulation>>({});

    const handleTestNode = async (node: Node<FlowNodeData>) => {
        const id = node.id;
        setNodeSimulations(prev => ({
            ...prev,
            [id]: { status: 'loading' }
        }));

        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        try {
            let result: unknown = null;
            let request: unknown = null;

            if (node.type === 'flow_http') {
                const headersStr = (node.data.headers as string) || '{}';
                const payloadStr = (node.data.payload as string) || '{}';
                
                request = {
                    method: node.data.method || 'POST',
                    url: node.data.url || 'https://api.example.com',
                    headers: JSON.parse(headersStr),
                    body: JSON.parse(payloadStr)
                };
                // Mock result
                result = {
                    status: 200,
                    data: {
                        success: true,
                        id: "res_" + Math.random().toString(36).substr(2, 9),
                        message: "Request processed successfully",
                        received_at: new Date().toISOString()
                    }
                };
            } else if (node.type === 'flow_crm_connect') {
                const mappingsStr = (node.data.crm_mappings as string) || '{}';
                request = {
                    platform: node.data.platform,
                    operation: node.data.operation,
                    mappings: JSON.parse(mappingsStr)
                };
                result = {
                    success: true,
                    crm_id: "CRM_" + Math.random().toString(36).substr(2, 9),
                    sync_status: "COMPLETED",
                    platform: node.data.platform
                };
            }

            setNodeSimulations(prev => ({
                ...prev,
                [id]: { 
                    status: 'success', 
                    result, 
                    request,
                    timestamp: new Date().toLocaleTimeString()
                }
            }));
        } catch (err: unknown) {
            setNodeSimulations(prev => ({
                ...prev,
                [id]: { 
                    status: 'error', 
                    error: err instanceof Error ? err.message : String(err),
                    timestamp: new Date().toLocaleTimeString()
                }
            }));
        }
    };

    useEffect(() => {
        const loadAgents = async () => {
            const res = await getAIAgents();
            if (res.success && res.data) setAiAgents(res.data);
        };
        loadAgents();
    }, []);

    const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(
        initialFlow.nodes && initialFlow.nodes.length > 0 ? initialFlow.nodes : [
            { id: "start", type: "flow_trigger", position: { x: 250, y: 0 }, data: {} }
        ]
    );
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges || []);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Fetch variables from preceding nodes when a condition node is selected
    useEffect(() => {
        const fetchPrecedingVars = async () => {
            const node = nodes.find(n => n.id === selectedNodeId);
            if (node?.type === 'flow_condition') {
                // Find source node
                const edge = edges.find(e => e.target === node.id);
                if (edge) {
                    const sourceNode = nodes.find(n => n.id === edge.source);
                    if (sourceNode?.type === 'flow_ai_agent' && sourceNode.data.agentId) {
                        const { getAgentTrackedVariables } = await import("@/lib/actions/inbox");
                        const res = await getAgentTrackedVariables(sourceNode.data.agentId as string);
                        if (res.success && res.data) {
                            setPrecedingVariables(res.data);
                        } else {
                            setPrecedingVariables([]);
                        }
                    } else {
                        setPrecedingVariables(['nombre', 'email', 'telefono', 'pais', 'origen', 'segmentacion', 'tipo_lead']);
                    }
                }
            }
        };
        fetchPrecedingVars();
    }, [selectedNodeId, nodes, edges]);

    const handlePublish = async () => {
        setSaving(true);
        try {
            await onSave({ nodes, edges });
        } finally {
            setSaving(false);
        }
    };

    const nodeTypes = useMemo(() => ({
        flow_trigger: TriggerNode,
        flow_message: MessageNode,
        flow_question: QuestionNode,
        flow_condition: ConditionNode,
        flow_wait: WaitNode,
        flow_command: CommandNode,
        flow_collector: CollectorNode,
        flow_book: BookNode,
        flow_http: HTTPRequestNode,
        flow_db: DatabaseNode,
        flow_ai: AITaskNode,
        flow_crm: CRMNode,
        flow_crm_connect: CrmConnectNode,
        flow_ai_agent: AIAgentNode,
        flow_meta_template: MetaTemplateNode,
        flow_inactivity: InactivityNode,
    }), []);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "#7c3aed", strokeWidth: 2 } }, eds)),
        [setEdges]
    );

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
    }, []);

    // Update nodes with simulation data when they change
    useEffect(() => {
        setNodes(nds => nds.map(n => {
            if (nodeSimulations[n.id]) {
                return { ...n, data: { ...n.data, simulation: nodeSimulations[n.id] } };
            }
            return n;
        }));
    }, [nodeSimulations, setNodes]);

    const updateNodeData = (id: string, newData: Partial<FlowNodeData>) => {
        setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...newData } } : n));
    };

    const addNode = (type: string) => {
        const id = `${type}_${Date.now()}`;
        const newNode: Node<FlowNodeData> = {
            id,
            type,
            position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
            data: { 
                text: "", 
                ifLabel: "SÍ", 
                elseLabel: "NO",
                delay_value: 5,
                delay_unit: "minutos",
                command_type: "update_status",
                fields: ["leads", "responses"],
                target_variable: "unified_data",
                webhook_url: "",
                metadata_key: "",
                metadata_value: "",
                tag_name: "",
                event: "nueva_entrada",
                method: "POST",
                url: "",
                action: "SAVE_LEAD",
                model: "gpt-4o",
                task: "Clasificar intención",
                // CRM Connect defaults
                platform: "zoho",
                operation: "CREATE_OR_UPDATE_CONTACT",
                api_url: "",
                api_key: "",
                crm_mappings: JSON.stringify({
                    nombre: "{{nombre}}",
                    email: "{{email}}",
                    telefono: "{{telefono}}"
                }, null, 2),
            },
        };
        setNodes((nds) => nds.concat(newNode));
        setSelectedNodeId(id);
        setIsNodeLibraryOpen(false);
    };

    const nodeCategories = [
        {
            title: "Disparadores",
            icon: Zap,
            items: [
                { type: "flow_trigger", label: "Inicio de Chat", desc: "Se activa cuando llega un nuevo mensaje.", icon: MessageSquare },
                { type: "flow_trigger", label: "Webhook", desc: "Se activa mediante una URL externa.", icon: Globe },
            ]
        },
        {
            title: "Interacción",
            icon: MessageSquare,
            items: [
                { type: "flow_message", label: "Respuesta Agente", desc: "El agente responde usando su configuración.", icon: MessageSquare },
                { type: "flow_ai_agent", label: "Llamar otro Agente", desc: "Delega la conversación a otro agente experto.", icon: Brain },
                { type: "flow_meta_template", label: "Plantilla WhatsApp", desc: "Envía plantilla oficial de Meta.", icon: FileText },
                { type: "flow_question", label: "Hacer Pregunta", desc: "Solicita datos específicos.", icon: HelpCircle },
                { type: "flow_wait", label: "Esperar", desc: "Pausa el flujo temporalmente.", icon: Timer },
            ]
        },
        {
            title: "Lógica y Datos",
            icon: GitBranch,
            items: [
                { type: "flow_condition", label: "Filtrar (IF)", desc: "Ramifica según condiciones.", icon: Layers },
                { type: "flow_inactivity", label: "Inactividad", desc: "Seguimiento automático si no responden.", icon: AlarmClock },
                { type: "flow_collector", label: "Colector JSON", desc: "Agrupa variables en un objeto.", icon: Database },
                { type: "flow_book", label: "Agendar Cita", desc: "Cierra el flujo agendando.", icon: Calendar },
            ]
        },
        {
            title: "Integraciones",
            icon: Globe,
            items: [
                { type: "flow_http", label: "Petición HTTP", desc: "Conecta con cualquier API.", icon: Terminal },
                { type: "flow_db", label: "Acción DB", desc: "Guarda o lee de la base de datos.", icon: Activity },
                { type: "flow_ai", label: "Procesador IA", desc: "Análisis y validación de datos avanzada.", icon: Brain },
                { type: "flow_crm", label: "Integración CRM", desc: "Tag, Owner, Mapeo personalizado.", icon: Database },
                { type: "flow_crm_connect", label: "Conectar BD / CRM", desc: "Sincroniza con Zoho, HubSpot, Salesforce, Pipedrive o API propia.", icon: Link2 },
            ]
        }
    ];

    const filteredCategories = nodeCategories.map(cat => ({
        ...cat,
        items: cat.items.filter(item => 
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.desc.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(cat => cat.items.length > 0);

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    return (
        <div className={cn(
            isInline ? "absolute inset-0" : "fixed inset-0 z-[100] shadow-2xl",
            "bg-slate-950 flex flex-col animate-in fade-in duration-300 overflow-hidden text-white"
        )}>
            {/* Header */}
            {!isInline && (
                <div className="h-16 bg-slate-900/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-8 shrink-0 relative z-20">
                    <div className="flex items-center gap-4">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <GitBranch className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className={cn("font-black uppercase tracking-tight", isInline ? "text-base" : "text-lg")}>Flow Builder Pro</h2>
                                <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-[8px] font-black text-white/30 tracking-widest border border-white/5 uppercase">Beta 2.0</span>
                            </div>
                            <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest leading-none mt-0.5">Editando: <span className="text-primary/60">{agentName}</span></p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handlePublish}
                            disabled={saving}
                            className="h-10 px-6 rounded-xl bg-primary text-white font-black uppercase tracking-widest text-[10px] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 hover:shadow-primary/30 border-b-4 border-primary-foreground/20 disabled:opacity-50"
                        >
                            {saving ? "Guardando..." : "Publicar Cambios"}
                        </button>
                        <button 
                            onClick={onClose}
                            title="Cerrar panel"
                            className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/10 hover:border-red-500/20 group transition-all font-bold"
                        >
                            <X className="h-4 w-4 text-white/40 group-hover:text-red-400" />
                        </button>
                    </div>
                </div>
            )}

            {/* Canvas Area */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* ── Floatin Toolbar (Left) ── */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center p-2 gap-3 bg-slate-950/40 backdrop-blur-xl border border-white/10 rounded-[28px] shadow-2xl shadow-black/40">
                    <div className="p-2 mb-2 border-b border-white/5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                             <Activity className="h-3 w-3 text-primary" />
                        </div>
                    </div>
                    <QuickActionButton onClick={() => addNode('flow_trigger')} title="Inicio" color="text-yellow-400 bg-yellow-400/10" icon={Zap} />
                    <QuickActionButton onClick={() => addNode('flow_message')} title="Respuesta Agente" color="text-blue-400 bg-blue-400/10" icon={MessageSquare} />
                    <QuickActionButton onClick={() => addNode('flow_question')} title="Pregunta" color="text-emerald-400 bg-emerald-400/10" icon={HelpCircle} />
                    <QuickActionButton onClick={() => addNode('flow_condition')} title="Condición" color="text-pink-400 bg-pink-400/10" icon={GitBranch} />
                    <QuickActionButton onClick={() => addNode('flow_http')} title="API / HTTP" color="text-orange-400 bg-orange-400/10" icon={Globe} />
                    <QuickActionButton onClick={() => addNode('flow_db')} title="Base de Datos" color="text-cyan-400 bg-cyan-400/10" icon={Database} />
                    <QuickActionButton onClick={() => addNode('flow_ai')} title="Procesador IA" color="text-purple-400 bg-purple-400/10" icon={Brain} />
                    <QuickActionButton onClick={() => addNode('flow_crm_connect')} title="BD / CRM" color="text-violet-400 bg-violet-400/10" icon={Link2} />
                    
                    <div className="mt-2 pt-2 border-t border-white/5">
                        <button 
                            onClick={() => setIsNodeLibraryOpen(true)}
                            className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-primary/40 group"
                            title="Librería de Nodos"
                        >
                            <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-500" />
                        </button>
                    </div>
                </div>

                {/* ── Node Library Overlay ── */}
                <AnimatePresence>
                    {isNodeLibraryOpen && (
                        <div className="absolute inset-0 z-[100] flex items-center justify-center p-8 bg-slate-950/80 backdrop-blur-md">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="w-full max-w-5xl bg-slate-900 rounded-[32px] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                            >
                                {/* Library Header */}
                                <div className="p-8 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                            <LayoutGrid className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black uppercase tracking-tight">Librería de Nodos</h3>
                                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Selecciona el módulo que deseas añadir a tu flujo</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                                            <input 
                                                autoFocus
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Buscar módulo..."
                                                className="h-12 w-80 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 text-sm text-white focus:border-primary/50 outline-none transition-all font-bold placeholder:text-white/10"
                                            />
                                        </div>
                                        <button 
                                            onClick={() => setIsNodeLibraryOpen(false)}
                                            title="Cerrar librería"
                                            aria-label="Cerrar librería de módulos"
                                            className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/30 text-white/20 hover:text-red-400 transition-all"
                                        >
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>
                                </div>

                                {/* Library Content */}
                                <div className="flex-1 overflow-y-auto p-8 space-y-12 no-scrollbar">
                                    {filteredCategories.map((cat, idx) => (
                                        <div key={idx} className="space-y-6">
                                            <div className="flex items-center gap-3 px-2">
                                                <cat.icon className="h-4 w-4 text-white/30" />
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">{cat.title}</h4>
                                                <div className="flex-1 h-px bg-white/5 ml-2" />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {cat.items.map((item, itemIdx) => (
                                                    <button
                                                        key={itemIdx}
                                                        onClick={() => addNode(item.type)}
                                                        className="group p-6 rounded-[24px] bg-white/[0.02] border border-white/5 hover:bg-primary/10 hover:border-primary/30 text-left transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/10"
                                                    >
                                                        <div className="flex items-start gap-5">
                                                            <div className="h-12 w-12 rounded-2xl bg-white/5 group-hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors">
                                                                <item.icon className="h-6 w-6 text-white/40 group-hover:text-primary transition-colors" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h5 className="font-bold text-sm text-white group-hover:text-primary transition-colors">{item.label}</h5>
                                                                <p className="text-[11px] text-white/30 leading-relaxed mt-1 line-clamp-2">{item.desc}</p>
                                                            </div>
                                                            <ArrowRight className="h-4 w-4 text-white/10 group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <div className="flex-1 relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.2 }}
                        colorMode="dark"
                        className="selection:bg-primary/20"
                    >
                        <Background color="#1e293b" gap={32} size={1} />
                        <Panel position="bottom-right" className="!m-6">
                            <div className="flex flex-col gap-1 p-1.5 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
                                <Controls 
                                    showInteractive={false}
                                    className="!static !shadow-none !bg-transparent !border-none !m-0 [&_button]:!bg-transparent [&_button]:!border-none [&_button]:!outline-none [&_button:not(:last-child)]:!border-b [&_button:not(:last-child)]:!border-white/5 [&_path]:!fill-white/60 hover:[&_path]:!fill-primary transition-all [&_button]:!h-9 [&_button]:!w-9" 
                                />
                            </div>
                        </Panel>
                        
                        <Panel position={"top-right" as PanelPosition} className="m-6 flex items-center gap-3">
                            <button 
                                onClick={handlePublish}
                                disabled={saving}
                                className="h-11 px-8 rounded-2xl bg-primary text-white font-black uppercase tracking-[0.2em] text-[10px] hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-primary/40 border-b-4 border-primary-foreground/20 disabled:opacity-50 flex items-center gap-3"
                            >
                                <Save className="h-4 w-4" />
                                <span>{saving ? "Guardando..." : "Publicar Cambios"}</span>
                            </button>
                        </Panel>

                        <Panel position={"bottom-center" as PanelPosition} className="m-6">
                            <AnimatePresence>
                                {selectedNodeId && (
                                    <motion.button 
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 20 }}
                                        onClick={() => {
                                            setNodes((nds) => nds.filter((n) => !n.selected));
                                            setEdges((eds) => eds.filter((e) => !e.selected));
                                            setSelectedNodeId(null);
                                        }}
                                        className="flex items-center gap-3 px-6 py-3 rounded-full bg-red-500 text-white font-black uppercase tracking-[0.2em] text-[10px] hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-red-500/40 border-b-4 border-red-700/50"
                                   >
                                        <Trash2 className="h-4 w-4" />
                                        <span>Eliminar Selección</span>
                                   </motion.button>
                                )}
                            </AnimatePresence>
                        </Panel>
                    </ReactFlow>
                </div>

                {/* Properties Sidebar (Right) */}
                {selectedNode && (
                    <div className="w-80 bg-slate-900 border-l border-white/5 p-8 flex flex-col gap-8 animate-in slide-in-from-right-5 duration-300 overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Settings className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-black uppercase tracking-widest">Propiedades</h3>
                            </div>
                            <button 
                                onClick={() => setSelectedNodeId(null)} 
                                title="Cerrar propiedades"
                                aria-label="Cerrar panel de propiedades de nodo"
                                className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                            >
                                <X className="h-4 w-4 text-white/30" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Common: Label */}
                            <div className="space-y-3">
                                <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Identificador Nodo</label>
                                <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[10px] font-mono text-white/20">
                                    {selectedNode.id}
                                </div>
                            </div>

                            {/* Node Specific Configs */}
                            {selectedNode.type === 'flow_message' && (
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Texto del Mensaje</label>
                                    <textarea 
                                        value={selectedNode.data.text || ""}
                                        onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                        className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white/80 focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                        placeholder="Ej: Hola, ¿en qué puedo ayudarte?"
                                    />
                                </div>
                            )}

                            {selectedNode.type === 'flow_question' && (
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Pregunta al Usuario</label>
                                        <textarea 
                                            value={selectedNode.data.text || ""}
                                            onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                                            className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white/80 leading-relaxed focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                                            placeholder="Escribe la pregunta que el agente hará..."
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Validación de Respuesta</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['texto', 'email', 'telefono', 'numero', 'fecha'].map((v) => (
                                                <button
                                                    key={v}
                                                    onClick={() => updateNodeData(selectedNode.id, { validation: v })}
                                                    className={cn(
                                                        "py-2 px-3 rounded-xl text-[10px] font-bold uppercase transition-all border",
                                                        selectedNode.data.validation === v
                                                            ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20"
                                                            : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10"
                                                    )}
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'flow_inactivity' && (
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Tiempo de Espera (min)</label>
                                        <input 
                                            type="number"
                                            value={selectedNode.data.timeout || 30}
                                            onChange={(e) => updateNodeData(selectedNode.id, { timeout: parseInt(e.target.value) })}
                                            className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-6 text-xs text-white outline-none focus:border-red-500/40"
                                            title="Tiempo de espera en minutos"
                                            placeholder="30"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Máximo de Reintentos</label>
                                        <input 
                                            type="number"
                                            value={selectedNode.data.max_retries || 1}
                                            onChange={(e) => updateNodeData(selectedNode.id, { max_retries: parseInt(e.target.value) })}
                                            className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-6 text-xs text-white outline-none focus:border-red-500/40"
                                            title="Máximo de reintentos"
                                            placeholder="1"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Mensaje de Rescate</label>
                                        <textarea 
                                            value={selectedNode.data.message || ""}
                                            onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                                            className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white/80 leading-relaxed focus:border-red-500/40 focus:ring-4 focus:ring-red-500/10 outline-none transition-all"
                                            placeholder="Ej: Hola, ¿sigues ahí? Quería confirmar..."
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'flow_trigger' && (
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Evento de Activación</label>
                                    <select 
                                        value={selectedNode.data.event || "nueva_entrada"}
                                        onChange={(e) => updateNodeData(selectedNode.id, { event: e.target.value })}
                                        title="Seleccionar evento de activación"
                                        aria-label="Evento de activación del flujo"
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-4 text-xs text-white/80 focus:border-yellow-500/40 outline-none"
                                    >
                                        <option value="nueva_entrada">Nueva Entrada de Usuario</option>
                                        <option value="mensaje_recibido">Mensaje Específico Recibido</option>
                                        <option value="tiempo_inactivo">Tiempo de Inactividad</option>
                                        <option value="webhook">Webhook Externo</option>
                                    </select>
                                </div>
                            )}

                            {selectedNode.type === 'flow_condition' && (
                                <div className="space-y-4">
                                        <label htmlFor="flow-if-label" className="text-[9px] font-black uppercase tracking-widest text-white/30">Etiqueta SI (Verdad)</label>
                                        <input 
                                            id="flow-if-label"
                                            value={selectedNode.data.ifLabel || ""}
                                            onChange={(e) => updateNodeData(selectedNode.id, { ifLabel: e.target.value })}
                                            aria-label="Etiqueta para caso positivo"
                                            placeholder="SI"
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-emerald-400 font-bold"
                                        />
                                    <div className="space-y-3">
                                        <label htmlFor="flow-else-label" className="text-[9px] font-black uppercase tracking-widest text-white/30">Etiqueta NO (Falso)</label>
                                        <input 
                                            id="flow-else-label"
                                            value={selectedNode.data.elseLabel || ""}
                                            onChange={(e) => updateNodeData(selectedNode.id, { elseLabel: e.target.value })}
                                            aria-label="Etiqueta para caso negativo"
                                            placeholder="NO"
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-red-400 font-bold"
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-white/5 space-y-4">
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-pink-400">Variable a Filtrar</label>
                                            <select 
                                                value={selectedNode.data.condition_variable as string || ""}
                                                onChange={(e) => updateNodeData(selectedNode.id, { condition_variable: e.target.value })}
                                                title="Variable a filtrar"
                                                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white"
                                            >
                                                <option value="">-- Seleccionar Variable --</option>
                                                {precedingVariables.map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-pink-400">Operador</label>
                                            <select 
                                                value={selectedNode.data.condition_operator as string || "equals"}
                                                onChange={(e) => updateNodeData(selectedNode.id, { condition_operator: e.target.value })}
                                                title="Operador de comparación"
                                                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white"
                                            >
                                                <option value="equals">Es igual a</option>
                                                <option value="not_equals">Es distinto a</option>
                                                <option value="contains">Contiene</option>
                                                <option value="is_true">Es Verdadero</option>
                                                <option value="is_false">Es Falso</option>
                                                <option value="exists">Existe / Tiene valor</option>
                                            </select>
                                        </div>

                                        {(!['is_true', 'is_false', 'exists'].includes(selectedNode.data.condition_operator as string)) && (
                                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-pink-400">Valor de Comparación</label>
                                                <input 
                                                    value={selectedNode.data.condition_value as string || ""}
                                                    onChange={(e) => updateNodeData(selectedNode.id, { condition_value: e.target.value })}
                                                    className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white"
                                                    placeholder="Ej: cualificado, si, 5000..."
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'flow_wait' && (
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <label htmlFor="flow-wait-value" className="text-[9px] font-black uppercase tracking-widest text-white/30">Valor de Espera</label>
                                        <input 
                                            id="flow-wait-value"
                                            type="number"
                                            value={selectedNode.data.delay_value || 0}
                                            onChange={(e) => updateNodeData(selectedNode.id, { delay_value: parseInt(e.target.value) })}
                                            aria-label="Cantidad de tiempo de espera"
                                            placeholder="0"
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-amber-400 font-bold"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Unidad de Tiempo</label>
                                        <select 
                                            value={selectedNode.data.delay_unit || "minutos"}
                                            onChange={(e) => updateNodeData(selectedNode.id, { delay_unit: e.target.value })}
                                            title="Unidad de tiempo para la espera"
                                            aria-label="Unidad de tiempo"
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white/80 font-bold"
                                        >
                                            <option value="minutos">Minutos</option>
                                            <option value="horas">Horas</option>
                                            <option value="dias">Días</option>
                                        </select>
                                    </div>

                                    {/* Smart Wait Extensions */}
                                    <div className="pt-6 border-t border-white/5 space-y-6">
                                        <div className="flex items-center justify-between p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-tight text-amber-200">Interrumpir al responder</p>
                                                <p className="text-[8px] text-white/20 font-bold uppercase mt-0.5">Si el lead escribe, saltar espera</p>
                                            </div>
                                            <button 
                                                title={selectedNode.data.interrupt_on_reply ? "Desactivar interrupción" : "Activar interrupción"}
                                                onClick={() => updateNodeData(selectedNode.id, { interrupt_on_reply: !selectedNode.data.interrupt_on_reply })}
                                                className={cn("h-5 w-10 rounded-full transition-all relative", selectedNode.data.interrupt_on_reply ? "bg-amber-500" : "bg-white/10")}
                                            >
                                                <div className={cn("h-3 w-3 rounded-full bg-white absolute top-1 transition-all", selectedNode.data.interrupt_on_reply ? "right-1" : "left-1")} />
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-3 h-3 text-amber-500" />
                                                <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Condiciones Inteligentes</label>
                                            </div>
                                            
                                            <div className="space-y-3">
                                                <select 
                                                    value={selectedNode.data.wait_condition_variable as string || ""}
                                                    onChange={(e) => updateNodeData(selectedNode.id, { wait_condition_variable: e.target.value })}
                                                    title="Variable a monitorear durante la espera"
                                                    className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white"
                                                >
                                                    <option value="">-- No interrumpir por datos --</option>
                                                    {precedingVariables.map(v => (
                                                        <option key={v} value={v}>Saltar si se captura: {v}</option>
                                                    ))}
                                                </select>
                                                <p className="text-[8px] text-white/20 italic">La espera terminará inmediatamente si esta variable es capturada por la IA durante el intervalo.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'flow_command' && (
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Acción de Ejecución</label>
                                        <select 
                                            value={selectedNode.data.command_type || "update_status"}
                                            onChange={(e) => updateNodeData(selectedNode.id, { command_type: e.target.value })}
                                            title="Seleccionar tipo de comando a ejecutar"
                                            aria-label="Tipo de comando"
                                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white/80 font-bold"
                                        >
                                            <option value="update_status">Actualizar Estado Lead</option>
                                            <option value="trigger_webhook">Disparar Webhook (POST)</option>
                                            <option value="add_tag">Añadir Etiqueta (Tag)</option>
                                            <option value="update_metadata">Actualizar Metadatos (JSON)</option>
                                            <option value="human_handoff">Transferir a Humano</option>
                                            <option value="notify_admin">Notificar a Admin (WhatsApp)</option>
                                        </select>
                                    </div>

                                    {/* Conditional Command Fields */}
                                    {selectedNode.data.command_type === 'trigger_webhook' && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-red-400">URL del Webhook</label>
                                            <input 
                                                value={selectedNode.data.webhook_url || ""}
                                                onChange={(e) => updateNodeData(selectedNode.id, { webhook_url: e.target.value })}
                                                className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white/80"
                                                placeholder="https://api.tuservicio.com/hook"
                                            />
                                        </div>
                                    )}

                                    {selectedNode.data.command_type === 'add_tag' && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-red-400">Nombre de la Etiqueta</label>
                                            <input 
                                                value={selectedNode.data.tag_name || ""}
                                                onChange={(e) => updateNodeData(selectedNode.id, { tag_name: e.target.value })}
                                                className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white/80"
                                                placeholder="Ej: interesado_premium"
                                            />
                                        </div>
                                    )}

                                    {selectedNode.data.command_type === 'update_metadata' && (
                                        <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-red-400">Key</label>
                                                <input 
                                                    value={selectedNode.data.metadata_key || ""}
                                                    onChange={(e) => updateNodeData(selectedNode.id, { metadata_key: e.target.value })}
                                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white/80"
                                                    placeholder="budget"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-red-400">Value</label>
                                                <input 
                                                    value={selectedNode.data.metadata_value || ""}
                                                    onChange={(e) => updateNodeData(selectedNode.id, { metadata_value: e.target.value })}
                                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white/80"
                                                    placeholder="5000"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedNode.type === 'flow_crm' && (
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Acción CRM</label>
                                        <select 
                                            title="Seleccionar Acción CRM"
                                            value={(selectedNode.data.type as string) || "UPDATE_LEAD"}
                                            onChange={(e) => updateNodeData(selectedNode.id, { type: e.target.value })}
                                            className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-4 text-xs text-white/80 focus:border-indigo-500/40 outline-none"
                                        >
                                            <option value="UPDATE_LEAD">Actualizar Lead (Mapeado)</option>
                                            <option value="UPDATE_OWNER">Asignar Propietario</option>
                                            <option value="ADD_TAG">Añadir Etiqueta (Tag)</option>
                                            <option value="EXTERNAL_ACTION">Acción Externa (Blueprint/Workflow)</option>
                                        </select>
                                    </div>

                                    {(selectedNode.data.type === 'UPDATE_LEAD' || selectedNode.data.type === 'UPDATE_OWNER') && (
                                        <div className="space-y-4">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Mapeo de Campos CRM</label>
                                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                                {['nombre', 'apellido', 'email', 'telefono', 'pais', 'origen'].map(field => (
                                                    <div key={field} className="flex items-center gap-2 group">
                                                        <span className="w-16 text-[9px] text-white/40 uppercase">{field}</span>
                                                        <input 
                                                            value={(selectedNode.data.mappings as Record<string, string>)?.[field] || ""}
                                                            onChange={(e) => {
                                                                const newMappings = { ...(selectedNode.data.mappings as Record<string, string> || {}), [field]: e.target.value };
                                                                updateNodeData(selectedNode.id, { mappings: newMappings });
                                                            }}
                                                            placeholder={`ID de campo...`}
                                                            className="flex-1 h-8 bg-white/5 border border-white/10 rounded-lg px-2 text-[10px] text-white/80 group-hover:border-white/20 transition-colors"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {selectedNode.data.type === 'UPDATE_OWNER' && (
                                                <div className="space-y-2 pt-2 border-t border-white/5">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">ID del Propietario</label>
                                                    <input 
                                                        value={selectedNode.data.ownerId as string || ""}
                                                        onChange={(e) => updateNodeData(selectedNode.id, { ownerId: e.target.value })}
                                                        className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white/80"
                                                        placeholder="781577000..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedNode.data.type === 'ADD_TAG' && (
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Nombre de la Etiqueta</label>
                                            <input 
                                                value={selectedNode.data.tagName as string || ""}
                                                onChange={(e) => updateNodeData(selectedNode.id, { tagName: e.target.value })}
                                                className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white/80"
                                                placeholder="Ej: VirginIA"
                                            />
                                        </div>
                                    )}

                                    {selectedNode.data.type === 'EXTERNAL_ACTION' && (
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">ID de Transición / Acción</label>
                                            <input 
                                                value={selectedNode.data.transitionId as string || ""}
                                                onChange={(e) => updateNodeData(selectedNode.id, { transitionId: e.target.value })}
                                                className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white/80"
                                                placeholder="ID deBlueprint o Workflow"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                             {selectedNode.type === 'flow_collector' && (
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Variable de Destino (Array)</label>
                                        <input 
                                            value={selectedNode.data.target_variable || ""}
                                            onChange={(e) => updateNodeData(selectedNode.id, { target_variable: e.target.value })}
                                            className="w-full h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 text-xs text-indigo-400 font-bold"
                                            placeholder="unified_data"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Campos a Unificar (Separados por coma)</label>
                                        <textarea 
                                            value={selectedNode.data.fields?.join(", ") || ""}
                                            onChange={(e) => updateNodeData(selectedNode.id, { fields: e.target.value.split(",").map(f => f.trim()).filter(f => f !== "") })}
                                            className="w-full min-h-[80px] bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white/80"
                                            placeholder="nombre, email, presupuesto, fuente"
                                        />
                                        <p className="text-[8px] text-white/20 italic">Estos campos se empaquetarán en un objeto JSON dentro del array final.</p>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'flow_http' && (
                                <div className="space-y-5">
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Método y URL</label>
                                        <div className="flex gap-2">
                                            <select 
                                                id="http-method"
                                                value={selectedNode.data.method || "POST"}
                                                onChange={(e) => updateNodeData(selectedNode.id, { method: e.target.value })}
                                                title="Seleccionar método HTTP"
                                                className="w-24 h-11 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 text-[10px] font-black text-orange-400"
                                            >
                                                <option value="GET">GET</option>
                                                <option value="POST">POST</option>
                                                <option value="PUT">PUT</option>
                                                <option value="DELETE">DELETE</option>
                                            </select>
                                            <input 
                                                value={selectedNode.data.url || ""}
                                                onChange={(e) => updateNodeData(selectedNode.id, { url: e.target.value })}
                                                className="flex-1 h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white/80 font-mono"
                                                placeholder="https://api..."
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label htmlFor="http-headers" className="text-[9px] font-black uppercase tracking-widest text-white/30">Headers (JSON)</label>
                                        <textarea 
                                            id="http-headers"
                                            value={selectedNode.data.headers || '{\n  "Content-Type": "application/json"\n}'}
                                            onChange={(e) => updateNodeData(selectedNode.id, { headers: e.target.value })}
                                            title="Headers de la petición HTTP"
                                            placeholder='{\n  "Content-Type": "application/json"\n}'
                                            className="w-full min-h-[100px] bg-black/40 border border-white/5 rounded-2xl p-4 text-[10px] font-mono text-white/40 focus:text-white/80 transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label htmlFor="http-payload" className="text-[9px] font-black uppercase tracking-widest text-white/30">Body / Payload</label>
                                        <textarea 
                                            id="http-payload"
                                            value={selectedNode.data.payload || '{\n  "lead_id": "{{lead_id}}",\n  "status": "contacted"\n}'}
                                            onChange={(e) => updateNodeData(selectedNode.id, { payload: e.target.value })}
                                            title="Cuerpo de la petición HTTP"
                                            placeholder='{\n  "lead_id": "{{lead_id}}",\n  "status": "contacted"\n}'
                                            className="w-full min-h-[120px] bg-black/40 border border-white/5 rounded-2xl p-4 text-[10px] font-mono text-white/40 focus:text-white/80 transition-all outline-none"
                                        />
                                    </div>

                                    {/* Simulation Panel for HTTP */}
                                    <div className="pt-6 border-t border-white/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-orange-400">Prueba de Ejecución</label>
                                            {nodeSimulations[selectedNode.id]?.timestamp && (
                                                <span className="text-[8px] text-white/20">Last: {nodeSimulations[selectedNode.id].timestamp}</span>
                                            )}
                                        </div>
                                        
                                        <button 
                                            onClick={() => handleTestNode(selectedNode)}
                                            disabled={nodeSimulations[selectedNode.id]?.status === 'loading'}
                                            className="w-full h-11 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-widest hover:bg-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {nodeSimulations[selectedNode.id]?.status === 'loading' ? (
                                                <div className="h-3 w-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Activity className="w-3 h-3" />
                                            )}
                                            {nodeSimulations[selectedNode.id]?.status === 'loading' ? "Ejecutando..." : "Simular Petición"}
                                        </button>

                                        {nodeSimulations[selectedNode.id]?.status === 'success' && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">Resultado: 200 OK</span>
                                                        <Check className="h-3 w-3 text-emerald-400" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-[8px] text-white/30 uppercase font-black tracking-widest">Respuesta Recibida:</p>
                                                        <pre className="text-[9px] font-mono text-emerald-200/60 bg-black/20 p-2 rounded-lg overflow-x-auto">
                                                            {JSON.stringify(nodeSimulations[selectedNode.id].result, null, 2)}
                                                        </pre>
                                                    </div>
                                                </div>

                                                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                                    <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest mb-2">Variables Generadas:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.keys(nodeSimulations[selectedNode.id].result?.data || {}).map(key => (
                                                            <div key={key} className="px-2 py-0.5 bg-white/5 rounded border border-white/5 text-[8px] text-orange-200/50 font-mono">
                                                                {"{{" + key + "}}"}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'flow_db' && (
                                <div className="space-y-5">
                                    <div className="space-y-3">
                                        <label htmlFor="db-action" className="text-[9px] font-black uppercase tracking-widest text-white/30">Acción</label>
                                        <select 
                                            id="db-action"
                                            value={selectedNode.data.action || "SAVE_LEAD"}
                                            onChange={(e) => updateNodeData(selectedNode.id, { action: e.target.value })}
                                            title="Seleccionar acción de base de datos"
                                            className="w-full h-11 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-4 text-xs font-black text-cyan-400"
                                        >
                                            <option value="SAVE_LEAD">Guardar/Actualizar Lead</option>
                                            <option value="LOAD_CONTEXT">Cargar Contexto Histórico</option>
                                            <option value="UPDATE_VAR">Actualizar Variable Global</option>
                                            <option value="QUERY_CUSTOM">Consulta Personalizada</option>
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Tabla Destino</label>
                                        <input 
                                            value={selectedNode.data.table || "lead"}
                                            onChange={(e) => updateNodeData(selectedNode.id, { table: e.target.value })}
                                            className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white/80"
                                            placeholder="Nombre de la tabla..."
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label htmlFor="db-mapping" className="text-[9px] font-black uppercase tracking-widest text-white/30">Mapeo de Datos (Key: Value)</label>
                                        <textarea 
                                            id="db-mapping"
                                            value={selectedNode.data.mapping || '{\n  "nombre": "{{nombre}}",\n  "cualificacion": "{{score}}"\n}'}
                                            onChange={(e) => updateNodeData(selectedNode.id, { mapping: e.target.value })}
                                            title="Mapeo de datos para la base de datos"
                                            placeholder='{\n  "nombre": "{{nombre}}",\n  "cualificacion": "{{score}}"\n}'
                                            className="w-full min-h-[100px] bg-black/40 border border-white/5 rounded-2xl p-4 text-[10px] font-mono text-cyan-200/40 focus:text-cyan-200/80 transition-all outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'flow_ai_agent' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Seleccionar Cerebro Agente</label>
                                        <select 
                                            title="Seleccionar Agente de IA"
                                            value={selectedNode.data.agentId as string || ""}
                                            onChange={(e) => {
                                                const agent = aiAgents.find(a => a.id === e.target.value);
                                                updateNodeData(selectedNode.id, { 
                                                    agentId: e.target.value,
                                                    agentName: agent?.name || "Agente sin nombre"
                                                });
                                            }}
                                            className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl px-4 text-xs text-white/80 focus:border-indigo-500/40 outline-none"
                                        >
                                            <option value="">-- Seleccionar Agente --</option>
                                            {aiAgents.map(agent => (
                                                <option key={agent.id} value={agent.id}>{agent.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Exit Criteria Section */}
                                    <div className="p-5 rounded-[32px] bg-indigo-500/[0.03] border border-indigo-500/10 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Criterio de Salida (Escalamiento)</p>
                                        </div>
                                        <p className="text-[10px] text-white/30 leading-relaxed italic">
                                            Define la variable que, al cumplirse, hará que el agente finalice y el flujo continúe al siguiente nodo.
                                        </p>

                                        <div className="space-y-3 pt-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Variable de Disparo</label>
                                            <select 
                                                value={selectedNode.data.exit_variable as string || ""}
                                                onChange={(e) => updateNodeData(selectedNode.id, { exit_variable: e.target.value })}
                                                title="Variable que dispara la salida"
                                                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white outline-none"
                                            >
                                                <option value="">-- Siempre Continuar --</option>
                                                <option value="cualificado">Cualificado (True/False)</option>
                                                <option value="es_agendable">Es Agendable</option>
                                                <option value="interes_confirmado">Interés Confirmado</option>
                                                <option value="custom">Variable Personalizada...</option>
                                            </select>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Condición de Salida</label>
                                            <select 
                                                value={selectedNode.data.exit_condition as string || "is_true"}
                                                onChange={(e) => updateNodeData(selectedNode.id, { exit_condition: e.target.value })}
                                                title="Condición para salir del nodo"
                                                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white outline-none"
                                            >
                                                <option value="is_true">Es Verdadero (True)</option>
                                                <option value="exists">Tiene Valor (Cualquiera)</option>
                                                <option value="equals">Es igual a...</option>
                                            </select>
                                        </div>

                                        {selectedNode.data.exit_condition === 'equals' && (
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Valor Esperado</label>
                                                <input 
                                                    value={selectedNode.data.exit_value as string || ""}
                                                    onChange={(e) => updateNodeData(selectedNode.id, { exit_value: e.target.value })}
                                                    placeholder="Ej: Si"
                                                    className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                                        <p className="text-[10px] text-indigo-200/60 leading-relaxed font-medium">
                                            Este nodo invocará al agente seleccionado usando su configuración de <b>Memoria Autónoma</b> y <b>Base de Conocimiento.</b>
                                        </p>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'flow_meta_template' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-green-400">Nombre de la Plantilla (Meta)</label>
                                            <input 
                                                value={(selectedNode.data.templateName as string) || ""}
                                                onChange={(e) => updateNodeData(selectedNode.id, { templateName: e.target.value })}
                                                placeholder="Ej: bienvenida_esden"
                                                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-green-400">Idioma</label>
                                            <input 
                                                value={(selectedNode.data.language as string) || "es"}
                                                onChange={(e) => updateNodeData(selectedNode.id, { language: e.target.value })}
                                                placeholder="es"
                                                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Mapeo de Parámetros (Indice 1, 2...)</label>
                                            <textarea 
                                                value={(selectedNode.data.paramsMapping as string[] | undefined)?.join("\n") || ""}
                                                onChange={(e) => updateNodeData(selectedNode.id, { paramsMapping: e.target.value.split("\n") })}
                                                placeholder="Ej:&#10;{{nombre}}&#10;{{sede}}"
                                                className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-xl p-4 text-[11px] font-mono text-white/50"
                                            />
                                            <p className="text-[8px] text-white/20 italic">Pon una variable por línea. El sistema las mapeará por orden.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'flow_ai' && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20 mb-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Brain className="w-4 h-4 text-purple-400" />
                                                <span className="text-[10px] font-black uppercase tracking-tighter text-purple-400">Cerebro Neural v2.0</span>
                                            </div>
                                            <p className="text-[9px] text-white/40 leading-relaxed font-bold italic">Configura aquí la lógica cognitiva de este bloque.</p>
                                        </div>

                                        <div className="space-y-3">
                                            <label htmlFor="ai-mission" className="text-[9px] font-black uppercase tracking-widest text-white/30">Misión del Cerebro</label>
                                            <select 
                                                id="ai-mission"
                                                title="Misión del Cerebro"
                                                value={selectedNode.data.task || "custom"}
                                                onChange={(e) => updateNodeData(selectedNode.id, { task: e.target.value })}
                                                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white px-8 font-bold appearance-none relative focus:border-purple-500/50 outline-none"
                                            >
                                                <option value="custom" className="bg-slate-900">🧠 Prompt Libre (Libertad Total)</option>
                                                <option value="sentiment" className="bg-slate-900">🎭 Análisis de Sentimiento</option>
                                                <option value="scoring" className="bg-slate-900">⭐ Puntuación de Lead (0-100)</option>
                                                <option value="summary" className="bg-slate-900">📝 Resumir Conversación</option>
                                                <option value="extraction" className="bg-slate-900">🔍 Extraer Datos (JSON)</option>
                                                <option value="classification" className="bg-slate-900">🏷️ Clasificar por Categoría</option>
                                            </select>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-purple-400">Instrucciones / Brain Prompt</label>
                                                <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                                            </div>
                                            <textarea 
                                                value={selectedNode.data.instructions || ""}
                                                onChange={(e) => updateNodeData(selectedNode.id, { instructions: e.target.value })}
                                                className="w-full min-h-[200px] bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 text-[11px] text-purple-100 leading-relaxed outline-none focus:border-purple-500 transition-all font-mono"
                                                placeholder="Define aquí exactamente qué debe hacer la IA... Ej: 'Si el cliente pregunta por precios, dile que tenemos un descuento del 20% solo por hoy y guarda esto en la variable PROMO'."
                                            />
                                            <p className="text-[8px] text-white/20 uppercase font-black tracking-tighter mt-1">Este prompt es el cerebro del flujo. Tienes libertad total para programarlo.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'flow_book' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <div className="p-5 rounded-[32px] bg-amber-500/5 border border-amber-500/10 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-amber-500" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Configuración de Agendado</p>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Horario Disponible</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <span className="text-[8px] text-white/20 uppercase font-bold">Desde</span>
                                                    <input 
                                                        type="time" 
                                                        title="Hora de inicio disponible"
                                                        value={selectedNode.data.start_time as string || "09:00"}
                                                        onChange={(e) => updateNodeData(selectedNode.id, { start_time: e.target.value })}
                                                        className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-xs text-white outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[8px] text-white/20 uppercase font-bold">Hasta</span>
                                                    <input 
                                                        type="time" 
                                                        title="Hora de fin disponible"
                                                        value={selectedNode.data.end_time as string || "18:00"}
                                                        onChange={(e) => updateNodeData(selectedNode.id, { end_time: e.target.value })}
                                                        className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-xs text-white outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Intervalo de Citas</label>
                                            <select 
                                                title="Duración de la cita"
                                                value={selectedNode.data.slot_duration as number || 30}
                                                onChange={(e) => updateNodeData(selectedNode.id, { slot_duration: parseInt(e.target.value) })}
                                                className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs text-white outline-none"
                                            >
                                                <option value="15">15 Minutos</option>
                                                <option value="30">30 Minutos</option>
                                                <option value="45">45 Minutos</option>
                                                <option value="60">1 Hora</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-tight">Requiere Asesor</p>
                                                <p className="text-[8px] text-white/20 font-bold uppercase mt-0.5">Asignar automáticamente</p>
                                            </div>
                                            <button 
                                                title={selectedNode.data.require_advisor ? "Desactivar requerimiento de asesor" : "Activar requerimiento de asesor"}
                                                onClick={() => updateNodeData(selectedNode.id, { require_advisor: !selectedNode.data.require_advisor })}
                                                className={cn("h-5 w-10 rounded-full transition-all relative", selectedNode.data.require_advisor ? "bg-amber-500" : "bg-white/10")}
                                            >
                                                <div className={cn("h-3 w-3 rounded-full bg-white absolute top-1 transition-all", selectedNode.data.require_advisor ? "right-1" : "left-1")} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                                        <p className="text-[10px] text-amber-200/60 leading-relaxed font-medium">
                                            Este bloque cerrará la conversación y confirmará la cita según la disponibilidad detectada en este rango horario.
                                        </p>
                                    </div>
                                </div>
                            )}
                            {/* ── CRM Connect Node Properties ── */}
                            {selectedNode.type === 'flow_crm_connect' && (
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Plataforma / CRM</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {([
                                                { value: 'zoho',       label: 'Zoho CRM',  emoji: '🔴' },
                                                { value: 'hubspot',    label: 'HubSpot',   emoji: '🟠' },
                                                { value: 'salesforce', label: 'Salesforce',emoji: '🔵' },
                                                { value: 'pipedrive',  label: 'Pipedrive', emoji: '🟢' },
                                                { value: 'custom',     label: 'API Custom',emoji: '⚙️' },
                                            ] as const).map(p => {
                                                const pal = CRM_PLATFORM_COLORS[p.value];
                                                const isActive = (selectedNode.data.platform as string || 'zoho') === p.value;
                                                return (
                                                    <button
                                                        key={p.value}
                                                        onClick={() => updateNodeData(selectedNode.id, { platform: p.value })}
                                                        className={cn(
                                                            "px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-all text-left",
                                                            isActive
                                                                ? cn(pal.bg, pal.color, pal.border)
                                                                : "bg-white/5 text-white/30 border-white/5 hover:bg-white/10"
                                                        )}
                                                    >
                                                        {p.emoji} {p.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">Operación</label>
                                        <select
                                            value={selectedNode.data.operation as string || 'CREATE_OR_UPDATE_CONTACT'}
                                            onChange={(e) => updateNodeData(selectedNode.id, { operation: e.target.value })}
                                            title="Seleccionar operación CRM"
                                            className="w-full h-11 bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 text-[10px] font-black text-violet-400"
                                        >
                                            <option value="CREATE_OR_UPDATE_CONTACT">📋 Crear / Actualizar Contacto</option>
                                            <option value="CREATE_LEAD">➕ Crear Lead</option>
                                            <option value="UPDATE_DEAL">💼 Actualizar Negocio / Deal</option>
                                            <option value="SEARCH_CONTACT">🔍 Buscar Contacto</option>
                                            <option value="ADD_TAG">🏷️ Añadir Etiqueta</option>
                                            <option value="CUSTOM_WEBHOOK">🔗 Webhook Personalizado</option>
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">URL Base del CRM / API</label>
                                        <input
                                            value={selectedNode.data.api_url as string || ''}
                                            onChange={(e) => updateNodeData(selectedNode.id, { api_url: e.target.value })}
                                            placeholder="https://www.zohoapis.com/crm/v2/..."
                                            className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-[10px] font-mono text-white/70 focus:border-violet-500/40 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-white/30">API Key / Bearer Token</label>
                                        <input
                                            type="password"
                                            value={selectedNode.data.api_key as string || ''}
                                            onChange={(e) => updateNodeData(selectedNode.id, { api_key: e.target.value })}
                                            placeholder="••••••••••••"
                                            className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-[10px] font-mono text-white/70 focus:border-violet-500/40 outline-none"
                                        />
                                        <p className="text-[8px] text-white/20 italic">Authorization: Bearer &#123;token&#125;</p>
                                    </div>

                                    {/* Simulation Panel for CRM */}
                                    <div className="pt-6 border-t border-white/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-violet-400">Test de Sincronización</label>
                                            {nodeSimulations[selectedNode.id]?.timestamp && (
                                                <span className="text-[8px] text-white/20">Sync: {nodeSimulations[selectedNode.id].timestamp}</span>
                                            )}
                                        </div>
                                        
                                        <button 
                                            onClick={() => handleTestNode(selectedNode)}
                                            disabled={nodeSimulations[selectedNode.id]?.status === 'loading'}
                                            className="w-full h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest hover:bg-violet-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {nodeSimulations[selectedNode.id]?.status === 'loading' ? (
                                                <div className="h-3 w-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Link2 className="w-3 h-3" />
                                            )}
                                            {nodeSimulations[selectedNode.id]?.status === 'loading' ? "Probando..." : "Verificar Conexión"}
                                        </button>

                                        {nodeSimulations[selectedNode.id]?.status === 'success' && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                                <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">Sincronización Exitosa</span>
                                                        <Sparkles className="h-3 w-3 text-indigo-400" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-[8px] text-white/30 uppercase font-black tracking-widest">Payload Enviado:</p>
                                                        <pre className="text-[9px] font-mono text-indigo-200/60 bg-black/20 p-2 rounded-lg overflow-x-auto max-h-[100px]">
                                                            {JSON.stringify(nodeSimulations[selectedNode.id].request?.mappings, null, 2)}
                                                        </pre>
                                                    </div>
                                                    <div className="pt-2 border-t border-white/5">
                                                        <div className="flex items-center justify-between text-[8px] font-bold">
                                                            <span className="text-white/20 uppercase tracking-widest">ID Generado:</span>
                                                            <span className="text-indigo-400 font-mono">{nodeSimulations[selectedNode.id].result?.crm_id}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-auto pt-8 border-t border-white/5">
                             <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                 <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1 italic">Recordatorio</p>
                                 <p className="text-[10px] text-white/40 leading-relaxed font-bold">Los cambios en las propiedades se aplican instantáneamente al nodo en el canvas.</p>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function QuickActionButton({ onClick, icon: Icon, title, color }: { onClick: () => void; icon: LucideIcon; title: string, color: string }) {
    return (
        <button 
            onClick={onClick}
            title={title}
            className={cn(
                "h-10 w-10 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-lg border border-white/5",
                color
            )}
        >
            <Icon className="h-5 w-5" />
        </button>
    );
}

