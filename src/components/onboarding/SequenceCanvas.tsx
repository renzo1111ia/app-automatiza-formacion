"use client";

import React, { useCallback, useState, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  addEdge, 
  useNodesState, 
  useEdgesState,
  Connection,
  MarkerType,
  BackgroundVariant,
  useReactFlow,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { 
  LeadTriggerNode, ActionNode, DelayNode, LLMNode, APINode, 
  SubWorkflowNode, WebhookNode, WebhookResponseNode, WebhookWaitNode,
  TimeConditionNode, VoiceCallNode, TextAgentNode, WhatsAppNode, EndNode, ConditionNode
} from './nodes/TriggerNodes';
import { NodeConfigSidebar } from './NodeConfigSidebar';
import { 
    Save, Plus, Rocket, Trash2, 
    Phone, MessageSquare, BrainCircuit, 
    Globe, Clock, GitBranchPlus, Webhook, 
    Reply, Hourglass, Timer, Bot, CheckCircle2, MessageCircle
} from 'lucide-react';
import { cn } from "@/lib/utils";

// ─── NODE TYPES REGISTRY ─────────────────────────────────────────
const nodeTypes = {
  // New specialized nodes
  timeCondition: TimeConditionNode,
  voiceCall: VoiceCallNode,
  textAgent: TextAgentNode,
  whatsapp: WhatsAppNode,
  condition: ConditionNode,
  end: EndNode,
  // Legacy / generic nodes (keep backward compat)
  leadTrigger: LeadTriggerNode,
  webhookTrigger: WebhookNode,
  inboundWhatsApp: LeadTriggerNode,
  action: ActionNode,
  delay: DelayNode,
  llm: LLMNode,
  api: APINode,
  subWorkflow: SubWorkflowNode,
  webhookResponse: WebhookResponseNode,
  webhookWait: WebhookWaitNode
};

// ─── MINIMAL FLOW: Only the Entry Lead trigger
const createMinimalNodes = (): Node[] => [
  { 
    id: 'trigger-1', 
    type: 'leadTrigger', 
    position: { x: 400, y: 100 }, 
    data: { label: 'Entry Lead' } 
  }
];

// ─── DEFAULT FLOW: Lead → CondiciónHoraria → Llamada/WA → Espera → End
const createInitialNodes = (): Node[] => [
  { 
    id: 'trigger-1', 
    type: 'leadTrigger', 
    position: { x: 300, y: 50 }, 
    data: { label: 'Entry Lead' } 
  },
  { 
    id: 'time-1', 
    type: 'timeCondition', 
    position: { x: 260, y: 220 }, 
    data: { 
      label: 'Condición Horaria',
      config: { start: '09:00', end: '20:00', working_days: [1,2,3,4,5] }
    }
  },
  // Branch A: In-hours → Voice Call
  { 
    id: 'call-1', 
    type: 'voiceCall', 
    position: { x: 60, y: 480 }, 
    data: { 
      label: 'Llamada IA',
      config: { agentName: 'Sin Agente', provider: 'retell' }
    }
  },
  // Branch B: Out-of-hours → WhatsApp + Text Agent
  { 
    id: 'wa-1', 
    type: 'whatsapp', 
    position: { x: 480, y: 480 }, 
    data: { 
      label: 'WhatsApp',
      config: { templateId: 'contact_initial_v1' }
    }
  },
  // Delay after call
  { 
    id: 'delay-1', 
    type: 'delay', 
    position: { x: 60, y: 680 }, 
    data: { config: { duration: 27, hours: 27 } }
  },
  // Text agent for out-of-hours
  { 
    id: 'agent-1', 
    type: 'textAgent', 
    position: { x: 480, y: 680 }, 
    data: { 
      label: 'Agente Texto',
      config: { agentName: 'Sin Agente' }
    }
  },
  // Follow-up call after delay
  { 
    id: 'call-2', 
    type: 'voiceCall', 
    position: { x: 60, y: 880 }, 
    data: { 
      label: 'Llamada Seguimiento',
      config: { agentName: 'Sin Agente', provider: 'retell' }
    }
  },
  // End nodes
  { 
    id: 'end-1', 
    type: 'end', 
    position: { x: 60, y: 1060 }, 
    data: {}
  },
  { 
    id: 'end-2', 
    type: 'end', 
    position: { x: 480, y: 880 }, 
    data: {}
  },
];

const createInitialEdges = (): Edge[] => [
  // trigger → timeCondition
  { 
    id: 'e-trigger-time', source: 'trigger-1', target: 'time-1', 
    animated: true, 
    style: { stroke: '#f97316', strokeWidth: 2.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } 
  },
  // timeCondition → voiceCall (in-hours)
  { 
    id: 'e-time-call', source: 'time-1', target: 'call-1',
    sourceHandle: 'in-hours',
    label: 'Dentro horario',
    labelStyle: { fill: '#10b981', fontWeight: 700, fontSize: 10 },
    labelBgStyle: { fill: '#0a1f0f', fillOpacity: 0.9 },
    style: { stroke: '#10b981', strokeWidth: 2.5, strokeDasharray: '5,5' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' }
  },
  // timeCondition → whatsapp (out-of-hours)
  { 
    id: 'e-time-wa', source: 'time-1', target: 'wa-1',
    sourceHandle: 'out-of-hours',
    label: 'Fuera de horario',
    labelStyle: { fill: '#3b82f6', fontWeight: 700, fontSize: 10 },
    labelBgStyle: { fill: '#0a0f1f', fillOpacity: 0.9 },
    style: { stroke: '#3b82f6', strokeWidth: 2.5, strokeDasharray: '5,5' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
  },
  // voiceCall → delay
  { 
    id: 'e-call-delay', source: 'call-1', target: 'delay-1',
    style: { stroke: '#f59e0b', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' }
  },
  // whatsapp → textAgent
  { 
    id: 'e-wa-agent', source: 'wa-1', target: 'agent-1',
    style: { stroke: '#a855f7', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' }
  },
  // delay → call2 (follow-up)
  { 
    id: 'e-delay-call2', source: 'delay-1', target: 'call-2',
    style: { stroke: '#3b82f6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
  },
  // call2 → end
  { 
    id: 'e-call2-end', source: 'call-2', target: 'end-1',
    style: { stroke: '#6b7280', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' }
  },
  // textAgent → end
  { 
    id: 'e-agent-end', source: 'agent-1', target: 'end-2',
    style: { stroke: '#6b7280', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' }
  },
];

// ─── NODE MENU CONFIG ─────────────────────────────────────────────
const NODE_MENU = [
  {
    section: "🚀 Disparadores",
    items: [
      { type: 'leadTrigger', label: 'Entry Lead (CRM / Webhook)', icon: <Globe className="h-4 w-4" />, color: 'text-orange-400 hover:bg-orange-500/20' },
      { type: 'webhookTrigger', label: 'Webhook (Genérico)', icon: <Webhook className="h-4 w-4" />, color: 'text-orange-500 hover:bg-orange-600/20' },
      { type: 'inboundWhatsApp', label: 'Mensaje Entrante (WhatsApp)', icon: <MessageCircle className="h-4 w-4" />, color: 'text-emerald-400 hover:bg-emerald-500/20' },
    ]
  },
  {
    section: "⚙️ Lógica de Sistema",
    items: [
      { type: 'timeCondition', label: 'Condición Horaria', icon: <Timer className="h-4 w-4" />, color: 'text-yellow-400 hover:bg-yellow-500/20', data: { config: { start: '09:00', end: '20:00', working_days: [1,2,3,4,5] } } },
      { type: 'condition', label: 'Condición (IF/ELSE)', icon: <GitBranchPlus className="h-4 w-4" />, color: 'text-indigo-400 hover:bg-indigo-500/20' },
      { type: 'delay', label: 'Espera (Wait)', icon: <Clock className="h-4 w-4" />, color: 'text-amber-400 hover:bg-amber-500/20', data: { config: { duration: 2 } } },
    ]
  },
  {
    section: "📞 Canales de Contacto",
    items: [
      { type: 'voiceCall', label: 'Llamada IA (Voz)', icon: <Phone className="h-4 w-4" />, color: 'text-blue-400 hover:bg-blue-500/20', data: { config: { provider: 'retell' } } },
      { type: 'whatsapp', label: 'WhatsApp Template', icon: <MessageSquare className="h-4 w-4" />, color: 'text-emerald-400 hover:bg-emerald-500/20' },
      { type: 'textAgent', label: 'Agente de Texto IA', icon: <Bot className="h-4 w-4" />, color: 'text-purple-400 hover:bg-purple-500/20' },
    ]
  },
  {
    section: "🧠 Inteligencia",
    items: [
      { type: 'llm', label: 'LLM / Razonamiento', icon: <BrainCircuit className="h-4 w-4" />, color: 'text-fuchsia-400 hover:bg-fuchsia-500/20' },
      { type: 'api', label: 'Petición API / CRM', icon: <Globe className="h-4 w-4" />, color: 'text-cyan-400 hover:bg-cyan-500/20' },
    ]
  },
  {
    section: "🔗 Integración Avanzada",
    items: [
      { type: 'subWorkflow', label: 'Sub-Workflow', icon: <GitBranchPlus className="h-4 w-4" />, color: 'text-pink-400 hover:bg-pink-500/20' },
      { type: 'webhookResponse', label: 'Webhook Respuesta', icon: <Reply className="h-4 w-4" />, color: 'text-indigo-400 hover:bg-indigo-500/20' },
      { type: 'webhookWait', label: 'Webhook Espera', icon: <Hourglass className="h-4 w-4" />, color: 'text-pink-500 hover:bg-pink-600/20' },
    ]
  },
  {
    section: "🏁 Finalización",
    items: [
      { type: 'end', label: 'Fin de Flujo', icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-gray-400 hover:bg-gray-500/20' },
    ]
  }
];

// ─── COMPONENT ────────────────────────────────────────────────────
export function SequenceCanvas({ tenantId, workflowId }: { tenantId: string, workflowId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(createMinimalNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const { setViewport } = useReactFlow();

  // Close menu when clicking outside
  useEffect(() => {
    if (!isAddMenuOpen) return;
    const handleClickOutside = () => setIsAddMenuOpen(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isAddMenuOpen]);

  // Load existing graph for this workflow
  useEffect(() => {
    async function loadGraph() {
      try {
        const res = await fetch(`/api/orchestration/graph?workflowId=${workflowId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.graph_data && data.graph_data.nodes && data.graph_data.nodes.length > 0) {
            setNodes(data.graph_data.nodes || []);
            setEdges(data.graph_data.edges || []);
            if (data.graph_data.viewport) setViewport(data.graph_data.viewport);
          } else {
            // No saved graph: start with minimal entry node
            setNodes(createMinimalNodes());
            setEdges([]);
          }
        }
      } catch (error) {
        console.error("Failed to load graph:", error);
      }
    }
    if (workflowId) loadGraph();
  }, [workflowId, setNodes, setEdges, setViewport]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ 
      ...params, 
      animated: true, 
      style: { stroke: '#3b82f6', strokeWidth: 2.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
    }, eds)),
    [setEdges]
  );

  const onPublish = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch('/api/orchestration/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, workflowId, graphData: { nodes, edges } })
      });
      if (res.ok) {
        alert("✅ Secuencia Publicada con Éxito");
      } else {
        const err = await res.json();
        console.error("Publish failed:", err.error);
        alert("❌ Error al publicar: " + (err.error || "Error desconocido"));
      }
    } catch (error) { 
      console.error("Error publishing:", error);
      alert("❌ Error de red al publicar.");
    }
    finally { setIsPublishing(false); }
  };

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const onConfigSave = (newConfig: Record<string, unknown>) => {
    if (!selectedNode) return;
    setNodes((nds) => 
      nds.map((node) => 
        node.id === selectedNode.id 
          ? { ...node, data: { ...node.data, config: newConfig } } 
          : node
      )
    );
    setSelectedNode(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addNode = (type: string, extraData?: any) => {
    const id = `${type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data: { label: type, config: {}, ...(extraData || {}) }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const deleteSelected = () => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
      setEdges((eds) => eds.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
      setSelectedNode(null);
    } else if (selectedEdge) {
      setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdge.id));
      setSelectedEdge(null);
    }
  };

  const onDeploy = async () => {
    setIsPublishing(true);
    try {
      // First save it
      await onPublish();
      
      // Then call deploy specifically to activate it
      const res = await fetch('/api/orchestration/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, workflowId, status: 'ACTIVE' })
      });
      
      if (res.ok) {
        alert("🚀 Workflow Desplegado y Activo");
      } else {
        alert("⚠️ El flujo se guardó pero hubo un error al activarlo.");
      }
    } catch (error) {
      console.error("Error deploying:", error);
      alert("❌ Error crítico en el despliegue.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex-1 h-full w-full relative group">
      {/* ── Canvas Toolbar ─────────────────────────────────────── */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl opacity-40 hover:opacity-100 transition-all duration-500">
        <button 
          disabled={isPublishing}
          onClick={onPublish}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 font-bold hover:bg-white/10 hover:text-white transition-all text-xs",
            isPublishing && "opacity-50 cursor-not-allowed"
          )}
        >
          <Save className={cn("h-4 w-4", isPublishing && "animate-spin")} />
          {isPublishing ? "Guardando..." : "Guardar Borrador"}
        </button>

        <div className="h-4 w-px bg-white/10 mx-1" />

        {/* Add node menu */}
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsAddMenuOpen(!isAddMenuOpen); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors",
              isAddMenuOpen ? "bg-primary text-primary-foreground" : "hover:bg-white/5 text-white/60 hover:text-white"
            )}
          >
            <Plus className="h-4 w-4" />
            Agregar Nodo
          </button>

          {/* Dropdown */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute top-full left-0 mt-2 w-56 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl transition-all z-[100] origin-top-left overflow-auto max-h-[70vh]",
              isAddMenuOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
            )}
          >
            {NODE_MENU.map((group) => (
              <div key={group.section}>
                <p className="px-3 py-2 text-[9px] font-black text-white/20 uppercase tracking-widest border-b border-white/5 sticky top-0 bg-black/95 backdrop-blur-xl">
                  {group.section}
                </p>
                {group.items.map((item) => (
                  <button 
                    key={item.type}
                    onClick={() => { addNode(item.type, item.data); setIsAddMenuOpen(false); }} 
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-white/50 transition-colors text-left",
                      item.color
                    )}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={deleteSelected}
          className={cn(
            "p-2 rounded-xl transition-colors",
            (selectedNode || selectedEdge) ? "hover:bg-red-500/10 text-red-500" : "text-white/20 cursor-not-allowed"
          )} 
          title="Eliminar seleccionado (Nodo o Conexión)"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <div className="h-4 w-px bg-white/10 mx-1" />

        <button 
          onClick={onDeploy}
          disabled={isPublishing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all text-[10px]"
        >
          <Rocket className={cn("h-3.5 w-3.5", isPublishing && "animate-pulse")} /> 
          {isPublishing ? "Desplegando..." : "Desplegar Workflow"}
        </button>
      </div>

      {/* ── React Flow Canvas ──────────────────────────────────── */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.15 }}
        className="bg-[#0a0a0a]"
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={28} 
          size={1.2} 
          color="#222" 
          className="opacity-60"
        />
        <Controls 
          className="bg-black/60 border border-white/10 rounded-xl overflow-hidden fill-white" 
          showInteractive={false}
        />
        <MiniMap 
          className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden shadow-2xl" 
          nodeColor={(n: Node) => {
            if (n.type === 'leadTrigger') return '#f97316';
            if (n.type === 'timeCondition') return '#eab308';
            if (n.type === 'voiceCall') return '#3b82f6';
            if (n.type === 'textAgent') return '#a855f7';
            if (n.type === 'whatsapp') return '#10b981';
            if (n.type === 'action') return '#3b82f6';
            if (n.type === 'delay') return '#f59e0b';
            if (n.type === 'llm') return '#a855f7';
            if (n.type === 'api') return '#06b6d4';
            if (n.type === 'end') return '#6b7280';
            return '#fff';
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
        />
      </ReactFlow>

      {/* ── Node Configuration Sidebar ─────────────────────────── */}
      {selectedNode && (
        <NodeConfigSidebar 
          key={selectedNode.id}
          node={selectedNode}
          workflowId={workflowId}
          onSave={onConfigSave}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* ── Status Badge ───────────────────────────────────────── */}
      <div className="absolute bottom-5 right-5 z-50 pointer-events-none">
        <div className="p-4 rounded-2xl bg-black/50 backdrop-blur-md border border-white/5 space-y-1">
          <p className="text-[9px] font-black tracking-widest text-white/20 uppercase">Flow Engine</p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-[11px] font-bold text-emerald-400">Operational V2</p>
          </div>
          <p className="text-[9px] text-white/20 font-mono">{nodes.length} nodos · {edges.length} conexiones</p>
        </div>
      </div>
    </div>
  );
}
