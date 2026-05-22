// Sprint 1 — Tarea 2-37 Logger estructurado con scrubbing PII basico.
// Reemplaza console.log/error en server actions criticas y widget.
// Para observabilidad completa (Pino/Sentry/OTEL): pendiente Sprint 3 tarea 4-03.

const LOG_LEVEL =
  process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");

const LEVEL_ORDER: Record<string, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

function shouldLog(level: string): boolean {
  return (LEVEL_ORDER[level] ?? 2) >= (LEVEL_ORDER[LOG_LEVEL] ?? 2);
}

// Scrubbing basico: oculta valores de claves sensibles en metadata.
const SENSITIVE_KEYS = [
  "password",
  "api_key",
  "apikey",
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "authorization",
  "credentials_cipher",
  "encryption_key",
];

function scrub(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(scrub);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
      out[k] = "[REDACTED]";
    } else if (typeof v === "object") {
      out[k] = scrub(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: string, scope: string, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    scope,
    msg: message,
    ...(meta ? { meta: scrub(meta) } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export interface Logger {
  trace: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export function createLogger(scope: string): Logger {
  return {
    trace: (m, meta) => emit("trace", scope, m, meta),
    debug: (m, meta) => emit("debug", scope, m, meta),
    info: (m, meta) => emit("info", scope, m, meta),
    warn: (m, meta) => emit("warn", scope, m, meta),
    error: (m, meta) => emit("error", scope, m, meta),
  };
}

export const logger = createLogger("app");
