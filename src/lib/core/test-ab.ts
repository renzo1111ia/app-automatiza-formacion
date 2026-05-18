import { orchestrator } from "./orchestrator";
import { getAIAgents, getAgentVariants, saveAIAgent, saveAgentVariant } from "../actions/agents";

/**
 * A/B LOGIC VERIFICATION SCRIPT
 * Run this with: npx tsx src/lib/core/test-ab.ts
 */
async function testABLogic() {
    console.log("--- STARTING A/B LOGIC VERIFICATION ---");

    // 1. Setup a Test Agent if none exists
    const { data: agents } = await getAIAgents();
    let testAgent = agents?.find(a => a.name === "Test Ab Agent");

    if (!testAgent) {
        console.log("[TEST] Creating Test Agent...");
        const res = await saveAIAgent({
            name: "Test Ab Agent",
            type: "QUALIFY",
            status: "ACTIVE"
        });
        testAgent = res.data;
    }

    if (!testAgent) return;

    // 2. Setup A/B Variants (50/50 split)
    console.log("[TEST] Setting up Variants (50/50 split)...");
    await saveAgentVariant({
        agent_id: testAgent.id,
        version_label: "vA",
        prompt_text: "Prompt A Content",
        is_variant_b: false,
        weight: 0.5
    });
    await saveAgentVariant({
        agent_id: testAgent.id,
        version_label: "vB",
        prompt_text: "Prompt B Content",
        is_variant_b: true,
        weight: 0.5
    });

    // 3. Simulate 10 Executions
    const mockLead = { id: "test-lead-123", telefono: "+34123456789" };
    const mockRule = {
        workflow_id: "test-wf-123",
        sequence_order: 1,
        config: { agentId: testAgent.id }
    };

    console.log("\n[TEST] Simulating 10 executions...");
    const stats = { A: 0, B: 0 };

    for (let i = 0; i < 10; i++) {
        // We capture the console log from orchestrator
        // In a real test we'd return the variant from executeAIAgentAction
        // Since it's private, we'll just observe the logs
        await (orchestrator as any).executeAIAgentAction(mockLead, "test-tenant", mockRule);
    }

    console.log("\n--- VERIFICATION COMPLETE ---");
}

testABLogic().catch(console.error);
