/**
 * Sprint 0 tarea 1-27: Validación de Origin/Referer del Widget Chatbot.
 *
 * Origen: Informe técnico de Renzo Módulo Chatbot Web V1 §3 🔴.
 * Documentación: plans/260520-1342-sprint-0-hotfixes-seguridad/phase-06-otros-criticos.md §1-27.
 *
 * Comportamiento:
 *   - allowed_domains = []        → ALLOW (modo legacy, log warning una vez por widget)
 *   - allowed_domains = ['x.com'] → enforce: exige Origin o Referer cuyo host esté
 *                                   en la lista. Soporta wildcards de subdominio (*.x.com).
 *   - Origin/Referer ausentes (curl, bots) → si lista poblada, rechaza; si vacía, ALLOW.
 */

const legacyWarnedWidgets = new Set<string>();

export interface OriginCheckResult {
  ok: boolean;
  reason?: string;
}

/**
 * Extrae el hostname de una URL (Origin o Referer). Devuelve null si la URL es
 * inválida o vacía. No incluye puerto.
 */
function extractHost(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Comprueba si `host` matchea un patrón de la allowlist. El patrón puede ser:
 *   - 'ejemplo.com'        → match exacto (case-insensitive).
 *   - '*.ejemplo.com'      → match de subdominio: cualquier `*.ejemplo.com` PERO no
 *                            `ejemplo.com` desnudo (común en CSP/CORS).
 */
function hostMatchesPattern(host: string, pattern: string): boolean {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('*.')) {
    const suffix = normalized.slice(2); // 'ejemplo.com'
    if (!suffix) return false;
    return host.endsWith(`.${suffix}`);
  }
  return host === normalized;
}

/**
 * Valida el Origin/Referer de la request del widget contra `allowedDomains` del widget.
 * Devuelve `{ ok: true }` si pasa, `{ ok: false, reason }` si no.
 *
 * @param requestHeaders   Headers del request (next/headers o equivalente).
 * @param allowedDomains   Lista de hosts/patrones del widget. [] = modo legacy.
 * @param widgetId         Sólo para deduplicar el warning de legacy en logs.
 */
export function validateWidgetOrigin(
  requestHeaders: { get(name: string): string | null },
  allowedDomains: string[] | null | undefined,
  widgetId: string,
): OriginCheckResult {
  const list = (allowedDomains ?? []).filter(d => typeof d === 'string' && d.trim().length > 0);

  // Modo LEGACY: sin allowlist configurada → ALLOW, con warning una vez por widget.
  if (list.length === 0) {
    if (!legacyWarnedWidgets.has(widgetId)) {
      legacyWarnedWidgets.add(widgetId);
      console.warn(
        `[widget-security] widget ${widgetId} sin allowed_domains configurado — modo LEGACY (ALLOW). Configurar para hardening.`,
      );
    }
    return { ok: true };
  }

  const originHeader = requestHeaders.get('origin');
  const refererHeader = requestHeaders.get('referer');
  const originHost = extractHost(originHeader) ?? extractHost(refererHeader);

  if (!originHost) {
    return {
      ok: false,
      reason: 'missing Origin/Referer header (allowlist enforced)',
    };
  }

  const matched = list.some(pattern => hostMatchesPattern(originHost, pattern));
  if (!matched) {
    return {
      ok: false,
      reason: `origin "${originHost}" not in allowed_domains`,
    };
  }

  return { ok: true };
}

/**
 * Sólo para tests. Limpia el set de warnings emitidos (permite re-emitir warning
 * en el test siguiente sin reiniciar el proceso).
 */
export function __resetLegacyWarnings(): void {
  legacyWarnedWidgets.clear();
}
