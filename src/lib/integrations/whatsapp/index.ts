/**
 * src/lib/integrations/whatsapp/index.ts
 *
 * Central re-export for all WhatsApp integration modules.
 * Keeps backward compatibility with code that imports from
 * "@/lib/integrations/whatsapp" (the old flat file still exists at
 * "../whatsapp.ts" for INBOUND message handling).
 *
 * Sprint 5.7: Added client.ts (MetaWhatsAppClient) and variable-mapper.ts.
 */

// Outbound client (Sprint 5.7)
export * from "./client";
export { metaWhatsAppClient } from "./client";

// Variable mapper (Sprint 5.7)
export * from "./variable-mapper";
