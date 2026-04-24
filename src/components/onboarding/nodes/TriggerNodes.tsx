"use client";

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
    Zap, Clock, Phone, MessageSquare, 
    BrainCircuit, Globe, GitBranchPlus, Webhook, 
    Reply, Hourglass, Timer, Bot, CheckCircle2,
    ArrowRightLeft, Sun, Moon
} from 'lucide-react';
import { BaseNode } from './BaseNode';
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface NodeProps { data: any; selected?: boolean; }

// ─── DÍAS MAP ─────────────────────────────────────────────────────
const DAYS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

// ─── LEAD TRIGGER NODE ────────────────────────────────────────────
export const LeadTriggerNode = memo(({ data, selected }: NodeProps) => {
  return (
    <BaseNode label="Entry Lead" icon={<Zap className="h-4 w-4" />} colorClass="bg-orange-500" selected={selected}>
      <div className="flex flex-col gap-2">
        <p className="opacity-80 leading-relaxed font-bold">Ingesta vía Webhook</p>
        <div className="p-2 rounded-lg bg-black/40 border border-white/5 font-mono text-[10px] break-all">
          /api/webhooks/crm
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-orange-400/60 font-bold">
          <Globe className="h-3 w-3" />
          Prefijo → Timezone auto
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-orange-500 border-2 border-white" />
    </BaseNode>
  );
});

// ─── TIME CONDITION NODE ⭐ NUEVO ─────────────────────────────────
export const TimeConditionNode = memo(({ data, selected }: NodeProps) => {
  const start = data.config?.start || "09:00";
  const end = data.config?.end || "20:00";
  const workingDays: number[] = data.config?.working_days || [1,2,3,4,5];

  return (
    <div className={cn(
      "min-w-[260px] rounded-2xl bg-black/80 backdrop-blur-xl border-2 transition-all duration-300 shadow-2xl",
      selected ? "border-yellow-400 ring-4 ring-yellow-400/20 scale-105" : "border-yellow-500/30 hover:border-yellow-500/50",
    )}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-t-2xl border-b border-white/5 bg-yellow-500/10">
        <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-yellow-500/20 text-yellow-400">
          <Timer className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <span className="font-bold text-sm tracking-tight text-white/90 uppercase">Condición Horaria</span>
        </div>
        <ArrowRightLeft className="h-3.5 w-3.5 text-yellow-400/50" />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 text-xs text-white/60">
        {/* Time Range */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
            <Sun className="h-3 w-3 text-emerald-400" />
            <span className="font-black text-emerald-400 tabular-nums text-sm">{start}</span>
          </div>
          <div className="text-white/20 font-bold">→</div>
          <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
            <Moon className="h-3 w-3 text-blue-400" />
            <span className="font-black text-blue-400 tabular-nums text-sm">{end}</span>
          </div>
        </div>

        {/* Working Days */}
        <div className="flex gap-1 flex-wrap">
          {DAYS.map((d, i) => (
            <span key={i} className={cn(
              "text-[9px] font-black px-1.5 py-0.5 rounded-md border",
              workingDays.includes(i) 
                ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-300" 
                : "bg-white/5 border-white/5 text-white/20"
            )}>{d}</span>
          ))}
        </div>

        {/* Timezone Auto Note */}
        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-[9px] text-white/30 font-bold leading-relaxed">
          🌍 Se adapta al huso horario del lead según prefijo telefónico (+34, +52, +57...)
        </div>
      </div>

      {/* Footer decoration */}
      <div className="h-1 w-1/3 bg-yellow-400/40 mx-auto rounded-full mb-1 opacity-20" />

      {/* Handles */}
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-yellow-500 border-2 border-white" />

      {/* Bottom handles row */}
      <div className="relative w-full h-8">
        {/* Output A - Dentro del horario (left 30%) */}
        <div className="absolute left-[30%] bottom-0 -translate-x-1/2">
          <Handle 
            type="source" 
            id="in-hours"
            position={Position.Bottom} 
            className="!relative !left-0 !bottom-0 w-3 h-3 bg-emerald-500 border-2 border-white"
          />
         <span className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-black text-emerald-400 uppercase tracking-wider">Horario ✓</span>
        </div>

        {/* Output B - Fuera del horario (left 70%) */}
        <div className="absolute left-[70%] bottom-0 -translate-x-1/2">
          <Handle 
            type="source" 
            id="out-of-hours"
            position={Position.Bottom} 
            className="!relative !left-0 !bottom-0 w-3 h-3 bg-blue-500 border-2 border-white"
          />
         <span className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-black text-blue-400 uppercase tracking-wider">Fuera ✗</span>
        </div>
      </div>
    </div>
  );
});

// ─── VOICE CALL NODE ⭐ NUEVO ──────────────────────────────────────
export const VoiceCallNode = memo(({ data, selected }: NodeProps) => {
  const agentName = data.config?.agentName || "Sin Agente Configurado";
  const provider = data.config?.provider || "retell";

  return (
    <BaseNode 
      label="Llamada IA" 
      icon={<Phone className="h-4 w-4" />} 
      colorClass="bg-blue-500" 
      selected={selected}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-white border border-blue-500" />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
            provider === 'retell' 
              ? "bg-blue-500/20 border-blue-500/30 text-blue-400" 
              : "bg-violet-500/20 border-violet-500/30 text-violet-400"
          )}>
            {provider === 'retell' ? 'RETELL' : 'ULTRAVOX'}
          </span>
          <p className="font-bold text-white/90 truncate text-[11px]">{agentName}</p>
        </div>
        {data.config?.fromNumber && (
          <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-mono">
            <Phone className="h-3 w-3" />
            {data.config.fromNumber}
          </div>
        )}
        <div className="text-[9px] opacity-40 italic">Voice AI Agent → Lead qualificación</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-white border border-blue-500" />
    </BaseNode>
  );
});

// ─── TEXT AGENT NODE ⭐ NUEVO ──────────────────────────────────────
export const TextAgentNode = memo(({ data, selected }: NodeProps) => {
  const agentName = data.config?.agentName || "Sin Agente Configurado";
  const prompt = data.config?.prompt;

  return (
    <BaseNode 
      label="Agente de Texto" 
      icon={<Bot className="h-4 w-4" />} 
      colorClass="bg-purple-500" 
      selected={selected}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-white border border-purple-500" />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <BrainCircuit className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <p className="font-bold text-white/90 truncate text-[11px]">{agentName}</p>
        </div>
        {prompt && (
          <p className="text-[10px] opacity-50 line-clamp-2 italic">
            &quot;{prompt}&quot;
          </p>
        )}
        <div className="text-[9px] opacity-40 italic">AI Text Agent → Conversación asincrónica</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-white border border-purple-500" />
    </BaseNode>
  );
});

// ─── WHATSAPP NODE (mejorado) ─────────────────────────────────────
export const WhatsAppNode = memo(({ data, selected }: NodeProps) => {
  const templateName = data.config?.templateId || data.config?.template || "Sin Plantilla";

  return (
    <BaseNode 
      label="WhatsApp" 
      icon={<MessageSquare className="h-4 w-4" />} 
      colorClass="bg-emerald-500" 
      selected={selected}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-white border border-emerald-500" />
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[8px] uppercase border border-emerald-500/30">META API</span>
          <p className="font-mono text-[10px] truncate text-white/70">{templateName}</p>
        </div>
        {data.config?.variables && (
          <div className="text-[9px] opacity-40 italic">
            Variables: {JSON.stringify(data.config.variables).slice(0, 40)}...
          </div>
        )}
        <div className="text-[9px] opacity-40 italic">Template → Cloud API v20.0</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-white border border-emerald-500" />
    </BaseNode>
  );
});

// ─── LLM NODE (AI Logic – backward compat) ────────────────────────
export const LLMNode = memo(({ data, selected }: NodeProps) => {
  return (
    <BaseNode label="Agente de Texto" icon={<BrainCircuit className="h-4 w-4" />} colorClass="bg-purple-500" selected={selected}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-white border border-purple-500" />
      <div className="space-y-2">
        <p className="font-bold text-white/90">Razonamiento AI</p>
        <p className="text-[10px] opacity-50 line-clamp-2 italic">
          &quot;{data.config?.prompt || "Analizar intención del lead..."}&quot;
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-white border border-purple-500" />
    </BaseNode>
  );
});

// ─── API REQUEST NODE ─────────────────────────────────────────────
export const APINode = memo(({ data, selected }: NodeProps) => {
  return (
    <BaseNode label="Petición API" icon={<Globe className="h-4 w-4" />} colorClass="bg-cyan-500" selected={selected}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-white border border-cyan-500" />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold text-[9px] uppercase">POST</span>
          <p className="font-mono text-[10px] truncate">{data.config?.url || "https://api.crm.com/v1"}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-white border border-cyan-500" />
    </BaseNode>
  );
});

// ─── SUB-WORKFLOW NODE ────────────────────────────────────────────
export const SubWorkflowNode = memo(({ data, selected }: NodeProps) => {
  return (
    <BaseNode label="Vincular Flujo" icon={<GitBranchPlus className="h-4 w-4" />} colorClass="bg-pink-500" selected={selected}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-white border border-pink-500" />
      <div className="space-y-2">
        <p className="font-bold text-white/90">Disparar Sub-Workflow</p>
        <div className="p-2 rounded-lg bg-pink-500/10 border border-pink-500/20 text-[9px] font-black text-pink-400 uppercase tracking-widest">
          {data.config?.targetWorkflowId || "SELECCIONAR FLUJO"}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-white border border-pink-500" />
    </BaseNode>
  );
});

// ─── DELAY NODE ───────────────────────────────────────────────────
export const DelayNode = memo(({ data, selected }: NodeProps) => {
  const hours = data.config?.duration || data.config?.hours || 2;
  return (
    <BaseNode label="Espera" icon={<Clock className="h-4 w-4" />} colorClass="bg-amber-500" selected={selected}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-white border border-amber-500" />
      <div className="flex items-center justify-center py-2 h-12">
         <span className="text-2xl font-black tabular-nums">{hours}H</span>
      </div>
      <div className="text-[9px] opacity-30 text-center italic">Espera antes del siguiente paso</div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-white border border-amber-500" />
    </BaseNode>
  );
});

// ─── WEBHOOK TRIGGER NODE ─────────────────────────────────────────
export const WebhookNode = memo(({ data, selected }: NodeProps) => {
  const method = data.config?.method || 'POST';
  return (
    <BaseNode 
      label="Webhook (Entrada)" 
      icon={<Webhook className="h-4 w-4" />} 
      colorClass="bg-orange-600" 
      selected={selected}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
            method === 'GET' ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"
          )}>
            {method}
          </span>
          <p className="font-mono text-[9px] truncate opacity-60">/{data.config?.path || 'webhook'}</p>
        </div>
        <div className="p-1 px-2 rounded-md bg-black/40 border border-white/5 font-mono text-[8px] truncate text-white/40 italic">
           Configura la URL en el panel
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-white border border-orange-600 opacity-20" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-white border border-orange-600" />
    </BaseNode>
  );
});

// ─── WEBHOOK RESPONSE NODE ────────────────────────────────────────
export const WebhookResponseNode = memo(({ data, selected }: NodeProps) => {
  return (
    <BaseNode 
      label="Respuesta Webhook" 
      icon={<Reply className="h-4 w-4" />} 
      colorClass="bg-indigo-600" 
      selected={selected}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold text-[9px]">
            HTTP {data.config?.statusCode || 200}
          </span>
          <p className="text-[9px] font-mono opacity-50 truncate">JSON Response</p>
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-white border border-indigo-600" />
    </BaseNode>
  );
});

// ─── WEBHOOK WAIT NODE ────────────────────────────────────────────
export const WebhookWaitNode = memo(({ data, selected }: NodeProps) => {
  return (
    <BaseNode 
      label="Espera Callback" 
      icon={<Hourglass className="h-4 w-4" />} 
      colorClass="bg-pink-600" 
      selected={selected}
    >
      <div className="space-y-2">
        <p className="text-[10px] font-bold opacity-80 leading-tight">Pausa hasta recibir señal</p>
        <div className="p-1 px-2 rounded bg-black/40 border border-pink-500/20 text-[8px] font-mono text-pink-400/80 italic">
          URL dinámica generada
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-white border border-pink-600" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-white border border-pink-600" />
    </BaseNode>
  );
});

// ─── END NODE ⭐ NUEVO ────────────────────────────────────────────
export const EndNode = memo(({ data: _data, selected }: NodeProps) => {
  return (
    <div className={cn(
      "min-w-[180px] rounded-2xl bg-black/80 backdrop-blur-xl border-2 transition-all duration-300 shadow-2xl",
      selected ? "border-gray-400 ring-4 ring-gray-400/20 scale-105" : "border-white/10 hover:border-white/20",
    )}>
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-t-2xl border-b border-white/5 bg-gray-500/10">
        <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-500/20 text-gray-400">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <span className="font-bold text-sm tracking-tight text-white/90 uppercase">Fin de Flujo</span>
      </div>
      <div className="p-4 text-xs text-white/30 text-center italic">
        El lead ha completado esta secuencia
      </div>
      <div className="h-1 w-1/3 bg-gray-400/40 mx-auto rounded-full mb-1 opacity-20" />
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-white border border-gray-500" />
    </div>
  );
});

// ─── ACTION NODE (backward compat) ───────────────────────────────
export const ActionNode = memo(({ data, selected }: NodeProps) => {
  const isCall = data.action === 'CALL';
  return (
    <BaseNode 
      label={isCall ? "Llamada IA" : "WhatsApp"} 
      icon={isCall ? <Phone className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />} 
      colorClass={isCall ? "bg-blue-500" : "bg-emerald-500"} 
      selected={selected}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-white border border-blue-500" />
      <div className="space-y-2">
        <p className="font-bold text-white/90 truncate">{data.config?.agentId || data.config?.templateId || "Sin Configurar"}</p>
        <div className="text-[10px] opacity-40 italic">Target: {isCall ? "Voice AI Agent" : "Meta Template v1"}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-white border border-blue-500" />
    </BaseNode>
  );
});

// ─── Display Names ────────────────────────────────────────────────
LeadTriggerNode.displayName = 'LeadTriggerNode';
TimeConditionNode.displayName = 'TimeConditionNode';
VoiceCallNode.displayName = 'VoiceCallNode';
TextAgentNode.displayName = 'TextAgentNode';
WhatsAppNode.displayName = 'WhatsAppNode';
ActionNode.displayName = 'ActionNode';
LLMNode.displayName = 'LLMNode';
APINode.displayName = 'APINode';
SubWorkflowNode.displayName = 'SubWorkflowNode';
DelayNode.displayName = 'DelayNode';
WebhookNode.displayName = 'WebhookNode';
WebhookResponseNode.displayName = 'WebhookResponseNode';
WebhookWaitNode.displayName = 'WebhookWaitNode';
EndNode.displayName = 'EndNode';
