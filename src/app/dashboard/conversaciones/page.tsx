"use client";

import AIAgentInbox from "@/components/agents/AIAgentInbox";

/**
 * Text Agents / Inbox Page
 * This page has been upgraded to the Premium AI-Integrated Inbox.
 */
export default function ConversacionesPage() {
    return (
        <div className="h-[calc(100vh-140px)] w-full">
            <AIAgentInbox />
        </div>
    );
}
