/**
 * GET /api/admin/queues/* — Bull-board UI dashboard para BullMQ.
 *
 * Sprint 3 phase-02 Observabilidad (4-03): UI visual de colas Redis (waiting, active,
 * completed, failed, delayed, paused). Permite a admins reintentar jobs, ver payloads,
 * limpiar colas, etc. Catch-all route porque bull-board sirve assets (CSS, JS, img)
 * en sub-paths del basePath.
 *
 * AUTH: solo admin (requireApiAdmin). Sin auth, expone metadata sensible de leads.
 *
 * Integración: bull-board está diseñado para Express. Lo wrappeamos en un Express app
 * mínimo y pasamos `request`/`response` simulados desde el Route Handler de Next.js.
 *
 * Plan: phase-02-observabilidad-logging-metricas.md paso 6.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { getLeadQueue } from "@/lib/core/queue/lead-sequence-queue";
import { createLogger } from "@/lib/utils/logger";
import express, { type Express } from "express";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("admin.queues");

// Singleton Express app con bull-board montado. Se inicializa lazy en la primera request
// porque al import-time getLeadQueue() abriría conexión Redis incluso para `next build`.
let bullBoardApp: Express | null = null;

function getBullBoardApp(): Express {
  if (bullBoardApp) return bullBoardApp;

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/api/admin/queues");

  createBullBoard({
    queues: [new BullMQAdapter(getLeadQueue())],
    serverAdapter,
  });

  const app = express();
  app.use("/api/admin/queues", serverAdapter.getRouter());
  bullBoardApp = app;
  log.info("Bull-board app initialized");
  return app;
}

/**
 * Adapter Next.js → Express: invoca bull-board y devuelve la Response Next.js esperada.
 * bull-board responde via `res.send(html)` o `res.json(...)` etc — capturamos vía un
 * mock de res mínimo.
 */
async function handleRequest(req: NextRequest): Promise<Response> {
  const adminGuard = await requireApiAdmin();
  if (adminGuard instanceof NextResponse) return adminGuard;

  const app = getBullBoardApp();
  const url = new URL(req.url);

  // Construir un objeto request "Express-like" y un response capturador.
  return new Promise<Response>((resolve) => {
    let statusCode = 200;
    const headers: Record<string, string> = {};
    const bodyChunks: (string | Buffer)[] = [];
    let ended = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockReq: any = {
      method: req.method,
      url: url.pathname + url.search,
      originalUrl: url.pathname + url.search,
      path: url.pathname,
      headers: Object.fromEntries(req.headers.entries()),
      query: Object.fromEntries(url.searchParams.entries()),
      body: undefined,
      get: (name: string) => req.headers.get(name) ?? undefined,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockRes: any = {
      statusCode,
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      getHeader: (name: string) => headers[name.toLowerCase()],
      removeHeader: (name: string) => {
        delete headers[name.toLowerCase()];
      },
      status: (code: number) => {
        statusCode = code;
        mockRes.statusCode = code;
        return mockRes;
      },
      send: (body: string | Buffer) => {
        bodyChunks.push(body);
        finish();
      },
      json: (obj: unknown) => {
        headers["content-type"] = "application/json";
        bodyChunks.push(JSON.stringify(obj));
        finish();
      },
      end: (body?: string | Buffer) => {
        if (body) bodyChunks.push(body);
        finish();
      },
      write: (chunk: string | Buffer) => {
        bodyChunks.push(chunk);
        return true;
      },
      redirect: (urlTo: string) => {
        statusCode = 302;
        headers["location"] = urlTo;
        finish();
      },
    };

    function finish() {
      if (ended) return;
      ended = true;
      const body =
        bodyChunks.length === 0
          ? ""
          : bodyChunks.every((c) => typeof c === "string")
            ? bodyChunks.join("")
            : Buffer.concat(bodyChunks.map((c) => (typeof c === "string" ? Buffer.from(c) : c)));
      resolve(new Response(body, { status: statusCode, headers }));
    }

    try {
      app(mockReq, mockRes, () => {
        // next() llamado sin match: 404
        if (!ended) {
          statusCode = 404;
          bodyChunks.push("Not Found");
          finish();
        }
      });
    } catch (err) {
      log.error("Bull-board request failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      if (!ended) {
        statusCode = 500;
        bodyChunks.push("Internal Server Error");
        finish();
      }
    }
  });
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function PUT(req: NextRequest) {
  return handleRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleRequest(req);
}
