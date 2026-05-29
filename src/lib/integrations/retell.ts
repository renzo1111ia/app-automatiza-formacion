import Retell from "retell-sdk";

/**
 * RETELL AI VOICE BRIDGE
 * Native implementation for initiating AI voice calls using official retell-sdk.
 */

export interface RetellConfig {
  apiKey: string;
}

export class RetellBridge {
  /**
   * Initiates a new AI voice call.
   */
  public async createCall(
    to: string,
    agentId: string,
    from: string,
    metadata: Record<string, unknown> = {},
    dynamicVariables: Record<string, unknown> = {},
    config: RetellConfig
  ) {
    if (!config.apiKey) throw new Error("Missing Retell API Key");

    const retell = new Retell({ apiKey: config.apiKey });

    try {
      const callResponse = await retell.call.createPhoneCall({
        from_number: from,
        to_number: to,
        override_agent_id: agentId,
        metadata: metadata,
        retell_llm_dynamic_variables: dynamicVariables,
      });

      console.log(`[RETELL BRIDGE] Call initiated to ${to}. Call ID: ${callResponse.call_id}`);
      return callResponse;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[RETELL BRIDGE] Error creating call:", msg);
      throw error;
    }
  }

  /**
   * Retrieves status of a specific call.
   */
  public async getCall(callId: string, config: RetellConfig) {
    if (!config.apiKey) throw new Error("Missing Retell API Key");

    const retell = new Retell({ apiKey: config.apiKey });

    try {
      const callResponse = await retell.call.retrieve(callId);
      return callResponse;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[RETELL BRIDGE] Error getting call data:", msg);
      throw error;
    }
  }
}

export const retellBridge = new RetellBridge();
