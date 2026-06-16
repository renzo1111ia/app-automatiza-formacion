import { z } from "zod";
import { Database } from "@/types/database";

// Zod schema for validation of node details
export const FlowNodeDataSchema = z.object({
  text: z.string().optional(),
  ifLabel: z.string().optional(),
  elseLabel: z.string().optional(),
  delay_value: z.number().optional(),
  delay_unit: z.enum(["minutos", "horas", "dias"]).optional(),
  command_type: z.string().optional(),
  fields: z.array(z.string()).optional(),
  target_variable: z.string().optional(),
  webhook_url: z.string().optional(),
  metadata_key: z.string().optional(),
  metadata_value: z.string().optional(),
  tag_name: z.string().optional(),
  event: z.string().optional(),
  method: z.string().optional(),
  url: z.string().optional(),
  headers: z.string().optional(),
  payload: z.string().optional(),
  action: z.string().optional(),
  table: z.string().optional(),
  mapping: z.string().optional(),
  model: z.string().optional(),
  task: z.string().optional(),
  instructions: z.string().optional(),
  label: z.string().optional(),
  validation: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  
  // Esperas inteligentes
  interrupt_on_reply: z.boolean().optional(),
  wait_condition_variable: z.string().optional(),
  
  // Condiciones/Filtros
  condition_variable: z.string().optional(),
  condition_operator: z.enum(["equals", "not_equals", "contains", "is_true", "is_false", "exists"]).optional(),
  condition_value: z.string().optional(),
  
  // CRM
  type: z.string().optional(),
  mappings: z.record(z.string(), z.string()).optional(),
  crm_mappings: z.string().optional(),
  api_url: z.string().optional(),
  api_key: z.string().optional(),
  operation: z.string().optional(),
  platform: z.string().optional(),
  ownerId: z.string().optional(),
  tagName: z.string().optional(),
  transitionId: z.string().optional(),
  timeout: z.number().optional(),
  max_retries: z.number().optional(),
  message: z.string().optional(),
}).catchall(z.unknown());

export type FlowNodeData = z.infer<typeof FlowNodeDataSchema>;

export const FlowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: FlowNodeDataSchema,
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

export type FlowNode = z.infer<typeof FlowNodeSchema>;

export const FlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

export type FlowEdge = z.infer<typeof FlowEdgeSchema>;

export const AgentFlowSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  nodes: z.array(FlowNodeSchema),
  edges: z.array(FlowEdgeSchema),
});

export type AgentFlow = z.infer<typeof AgentFlowSchema>;

export interface FlowWaitState {
  id?: string;
  tenant_id: string;
  lead_id: string;
  flow_id: string;
  current_node_id: string;
  scheduled_resume_at: Date;
  created_at?: Date;
}

export interface DatabaseWithFlows extends Omit<Database, "public"> {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      agent_flows: {
        Row: {
          id: string;
          tenant_id: string;
          agent_id: string;
          name: string;
          description: string | null;
          status: "DRAFT" | "PUBLISHED";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<{
          id: string;
          tenant_id: string;
          agent_id: string;
          name: string;
          description: string | null;
          status: "DRAFT" | "PUBLISHED";
          created_at: string;
          updated_at: string;
        }, "id" | "created_at" | "updated_at">;
        Update: Partial<{
          id: string;
          tenant_id: string;
          agent_id: string;
          name: string;
          description: string | null;
          status: "DRAFT" | "PUBLISHED";
          created_at: string;
          updated_at: string;
        }>;
      };
      flow_nodes: {
        Row: {
          flow_id: string;
          tenant_id: string;
          node_id: string;
          type: string;
          data: Record<string, unknown>;
          position: { x: number; y: number };
        };
        Insert: {
          flow_id: string;
          tenant_id: string;
          node_id: string;
          type: string;
          data?: Record<string, unknown>;
          position?: { x: number; y: number };
        };
        Update: Partial<{
          flow_id: string;
          tenant_id: string;
          node_id: string;
          type: string;
          data: Record<string, unknown>;
          position: { x: number; y: number };
        }>;
      };
      flow_edges: {
        Row: {
          flow_id: string;
          tenant_id: string;
          edge_id: string;
          source: string;
          target: string;
          source_handle: string | null;
          target_handle: string | null;
        };
        Insert: {
          flow_id: string;
          tenant_id: string;
          edge_id: string;
          source: string;
          target: string;
          source_handle?: string | null;
          target_handle?: string | null;
        };
        Update: Partial<{
          flow_id: string;
          tenant_id: string;
          edge_id: string;
          source: string;
          target: string;
          source_handle: string | null;
          target_handle: string | null;
        }>;
      };
      flow_wait_states: {
        Row: {
          id: string;
          tenant_id: string;
          lead_id: string;
          flow_id: string;
          current_node_id: string;
          scheduled_resume_at: string;
          created_at: string;
        };
        Insert: Omit<{
          id: string;
          tenant_id: string;
          lead_id: string;
          flow_id: string;
          current_node_id: string;
          scheduled_resume_at: string;
          created_at: string;
        }, "id" | "created_at">;
        Update: Partial<{
          id: string;
          tenant_id: string;
          lead_id: string;
          flow_id: string;
          current_node_id: string;
          scheduled_resume_at: string;
          created_at: string;
        }>;
      };
    };
  };
}
