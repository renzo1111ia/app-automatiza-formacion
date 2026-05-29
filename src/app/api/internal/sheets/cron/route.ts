// Sprint 4 - Endpoint cron manual para sheets.
//
// Dispara dos tareas de mantenimiento:
//   1. runWritebackOutbox(): procesa filas pending de sheets_writeback_outbox.
//   2. renewExpiringWatchChannels(): renueva canales Drive con TTL <24h.
//
// Auth: header `x-cron-secret` debe coincidir con CRON_SECRET (env). Para
// no exponer el endpoint a internet. En produccion lo invoca un cron
// externo (Dokploy schedule, GitHub Actions, etc.). En dev lo invoco
// manualmente desde el navegador o curl.

import { NextRequest, NextResponse } from "next/server";
import {
  renewExpiringWatchChannels,
  runWritebackOutbox,
} from "@/lib/integrations/sheets/outbox-processor";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("cron.sheets");

function authorize(req: NextRequest): boolean {
  const headerSecret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  // En dev local sin CRON_SECRET, permitir si no esta seteado (warning).
  if (!expected) {
    log.warn("CRON_SECRET no configurado - endpoint sin auth (solo dev)");
    return true;
  }
  return headerSecret === expected;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const [outbox, channels] = await Promise.all([
      runWritebackOutbox(),
      renewExpiringWatchChannels(),
    ]);
    return NextResponse.json({ ok: true, outbox, channels });
  } catch (err) {
    log.error("cron sheets falló", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// GET para health check del endpoint en si.
export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, service: "sheets-cron", endpoints: ["outbox", "channels"] });
}
