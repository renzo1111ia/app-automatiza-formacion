// @ts-nocheck
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables first
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Mock OpenAI client prototype immediately to support offline testing with dummy API Key
OpenAI.Embeddings.prototype.create = async function(params: any) {
    console.log("[MOCK OpenAI] Generando embeddings ficticios para búsqueda KB...");
    return {
        data: [{
            embedding: new Array(1536).fill(0)
        }]
    };
};

let callCount = 0;
(OpenAI.Chat as any).Completions.prototype.create = async function(params: any) {
    if (params.response_format?.type === "json_object") {
        console.log("[MOCK OpenAI] completions.create llamada (JSON format). Retornando JSON de extracción...");
        return {
            id: `mock-json-completion-${Date.now()}`,
            choices: [{
                message: {
                    role: "assistant",
                    content: JSON.stringify({
                        user_name: "Francisco Romero",
                        RESUMEN_EJECUTIVO: "Interesado en cita informativa agendada para el lunes a las 11:30.",
                        qualified: "SI",
                        segmentacion: "AGENDADO",
                        estado_conversacion: "FINALIZADA",
                        ESTADO: "Cita agendada",
                        REGLA_APLICADA: "Sin requisitos",
                        QA_HANDLED: "SI",
                        QA_TOPIC: "General",
                        CURSE_NAME: null
                    })
                }
            }]
        };
    }

    callCount++;
    console.log(`[MOCK OpenAI] completions.create llamada #${callCount}. Modelo: ${params.model}`);
    if (callCount === 1) {
        console.log("[MOCK OpenAI] Retornando llamada a herramienta book_appointment...");
        return {
            id: "mock-completion-id-1",
            choices: [{
                message: {
                    role: "assistant",
                    content: null,
                    tool_calls: [{
                        id: "call_mock_123",
                        type: "function",
                        function: {
                            name: "book_appointment",
                            arguments: JSON.stringify({
                                date: "2026-06-15",
                                time: "11:30",
                                notes: "Cita informativa interesada por WhatsApp"
                            })
                        }
                    }]
                }
            }]
        };
    } else {
        console.log("[MOCK OpenAI] Retornando respuesta conversacional final...");
        return {
            id: "mock-completion-id-2",
            choices: [{
                message: {
                    role: "assistant",
                    content: "¡Excelente! Ya agendé tu cita informativa para el lunes a las 11:30 hora de Chile (17:30 hora de Madrid)."
                }
            }]
        };
    }
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:8100";

async function main() {
    console.log("=== INICIO DE TEST DE CONEXIÓN WHATSAPP (META) E IA ===");
    console.log("Supabase URL:", url);
    console.log("OpenAI API Key configurada:", !!process.env.OPENAI_API_KEY);

    const { whatsappBridge } = await import("./src/lib/integrations/whatsapp");
    const { generateAIWhatsAppResponse } = await import("./src/lib/core/processors/WhatsAppAIProcessor");
    const { getAuthServiceRoleKey } = await import("./src/lib/auth-config");
    const { AppointmentService } = await import("./src/lib/services/appointment-service");

    // Mock checkAvailability to always return slot as available
    AppointmentService.checkAvailability = async (tenantId: string, date: string, leadTimezone?: string) => {
        console.log(`[MOCK AppointmentService] checkAvailability for date: ${date}`);
        return {
            date: date,
            timezone: leadTimezone || "Europe/Madrid",
            available_slots: [
                {
                    time: "11:30",
                    madrid_time: "11:30",
                    advisor_id: "mock-advisor-id"
                }
            ]
        };
    };

    const serviceKey = getAuthServiceRoleKey();

    const supabase = createClient(url, serviceKey, {
        auth: { persistSession: false }
    });

    // 1. Obtener un tenant de prueba
    const tenantId = "122f5c53-d773-4306-9c79-eaa7b1d4f7f7"; // Demo - Academia AF
    const { data: tenant, error: tErr } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .single();

    if (tErr || !tenant) {
        console.error("No se pudo obtener el tenant de prueba:", tErr);
        return;
    }
    console.log(`Tenant seleccionado: '${tenant.name}' (ID: ${tenant.id})`);

    let config = tenant.config as any || {};
    let whatsappConfig = config?.whatsapp;

    if (!whatsappConfig || !whatsappConfig.accessToken || !whatsappConfig.phoneNumberId) {
        console.log("⚠️ El tenant no tiene configuración de WhatsApp válida. Inyectando configuración de prueba...");
        whatsappConfig = {
            accessToken: "EAAB_mock_token_for_whatsapp_testing_123456",
            phoneNumberId: "123456789012345",
            wabaId: "987654321098765"
        };
        config.whatsapp = whatsappConfig;
        
        // Guardar la configuración en la base de datos local
        const { error: updateErr } = await supabase
            .from("tenants")
            .update({ config })
            .eq("id", tenantId);
            
        if (updateErr) {
            console.error("No se pudo inyectar la configuración en la BD:", updateErr);
            return;
        }
        console.log("✅ Configuración de prueba inyectada con éxito en la base de datos local.");
    }

    console.log("\n--- 1. Validación de Credenciales de Meta ---");
    console.log("Phone Number ID:", whatsappConfig.phoneNumberId);
    console.log("WABA ID:", whatsappConfig.wabaId);
    console.log("Access Token configurado:", !!whatsappConfig.accessToken);

    // Intentar consultar plantillas en Meta para validar token y conexión
    if (whatsappConfig.accessToken && whatsappConfig.wabaId && !whatsappConfig.accessToken.startsWith("EAAB_mock")) {
        console.log("Probando conexión con Meta (llamada a message_templates)...");
        try {
            const templates = await whatsappBridge.getAvailableTemplates({
                accessToken: whatsappConfig.accessToken,
                phoneNumberId: whatsappConfig.phoneNumberId,
                wabaId: whatsappConfig.wabaId
            });
            console.log("✅ Conexión con Meta exitosa!");
            console.log(`Plantillas encontradas en Meta: ${templates.length}`);
        } catch (err: any) {
            console.warn("❌ La conexión directa con la API de Meta falló:", err.message);
        }
    } else {
        console.log("ℹ️ Usando credenciales de prueba. Se omitirá la petición real a Meta y se simulará el canal de salida.");
    }

    console.log("\n--- 2. Simulación de Mensaje Entrante y Flujo de IA ---");
    // Obtener un lead de prueba para este tenant
    const { data: lead, error: lErr } = await supabase
        .from("lead")
        .select("*")
        .eq("tenant_id", tenantId)
        .limit(1)
        .single();

    if (lErr || !lead) {
        console.error("No se pudo obtener un lead de prueba para el tenant:", lErr);
        return;
    }
    console.log(`Lead de prueba seleccionado: '${lead.nombre} ${lead.apellido}' (ID: ${lead.id}, Teléfono: ${lead.telefono})`);

    // Habilitar IA para el lead si está desactivada
    if (!lead.is_ai_enabled) {
        console.log("Habilitando IA para el lead de prueba temporalmente...");
        await supabase.from("lead").update({ is_ai_enabled: true }).eq("id", lead.id);
    }

    // Limpiar citas previas del lead para un test limpio
    console.log("Limpiando citas previas del lead para evitar colisiones en el test...");
    await supabase.from("appointments").delete().eq("lead_id", lead.id);

    // Mockear whatsappBridge.sendTextMessage para evitar fallos de conexión externa con Meta
    const originalSend = whatsappBridge.sendTextMessage;
    whatsappBridge.sendTextMessage = async (to: string, body: string, cfg: any) => {
        console.log(`\n>>> [MOCK OUTPUT] Mensaje enviado a WhatsApp (${to}):`);
        console.log(`"${body}"`);
        return { messages: [{ id: "mock-message-id" }] };
    };

    const testMessage = "Hola, me gustaría agendar una cita informativa para el próximo lunes a las 11:30";
    console.log(`\nMensaje enviado por el usuario: "${testMessage}"`);
    console.log("Llamando a generateAIWhatsAppResponse...");

    try {
        await generateAIWhatsAppResponse(tenantId, lead.id, testMessage, "test-incoming-msg-id");
        
        console.log("\n--- 3. Verificación de Agendamiento en Base de Datos ---");
        // Consultar si se creó la cita en la tabla de base de datos
        const { data: appointments } = await supabase
            .from("appointments")
            .select("id, scheduled_at, status")
            .eq("lead_id", lead.id);

        if (appointments && appointments.length > 0) {
            console.log("✅ Cita agendada correctamente por la IA en la BD!");
            appointments.forEach(a => {
                console.log(`- Cita ID: ${a.id} | Fecha/Hora: ${a.scheduled_at} | Estado: ${a.status}`);
            });
        } else {
            console.log("⚠️ No se registró ninguna cita en la tabla de base de datos. La IA podría haber respondido pidiendo confirmación o pidiendo datos adicionales.");
        }
    } catch (e: any) {
        console.error("Error crítico durante el procesamiento de la IA:", e.message);
    } finally {
        // Restaurar método original
        whatsappBridge.sendTextMessage = originalSend;
    }
}

main().catch(console.error);
