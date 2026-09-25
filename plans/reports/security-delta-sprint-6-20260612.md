# Security Delta — Sprint 6 (Llamadas de Voz, v0.6.0)

- **Sprint:** Sprint 6 — `feature/sprint-06-llamadas-voz`
- **Tipo:** CLOSE-1.5 Security Delta (OWASP Top 10 2021), modo `delta`
- **Fecha:** 2026-06-12
- **Alcance:** `git diff developer` — Cambios en `src/app/dashboard/calls/page.tsx`, `src/app/api/calls/manual/route.ts`, `src/lib/actions/calls.ts`, `src/types/database.ts` y componentes de la lista de leads.
- **Ejecutor:** af-agents:security (delta)
- **Stack AF:** RLS multi-tenant Supabase self-hosted · Retell SDK integrador · Server Actions Next 16

---

## 1. Resumen ejecutivo

| Severidad | Nº  | Bloquea cierre |
| --------- | --- | -------------- |
| CRÍTICO   | 0   | —              |
| ALTO      | 0   | —              |
| MEDIO     | 1   | No             |
| BAJO      | 1   | No             |

**Veredicto: NO hay findings críticos ni altos. El cierre del Sprint 6 NO está bloqueado por seguridad.**

El diseño de la integración del marcador manual de llamadas está bien protegido contra el modelo de amenazas multi-tenant:

- **Aislamiento Multi-Tenant**: El endpoint `/api/calls/manual` no acepta `tenant_id` ciegamente del cliente para disparar la llamada. Valida activamente que el `leadId` solicitado pertenezca al `tenant_id` activo del usuario autenticado en la sesión, evitando vulnerabilidades de Broken Object Level Authorization (BOLA).
- **Server Actions protegidas**: La acción de servidor `getLeadById` obtiene el `tenantId` desde la sesión del comercial (`getActiveTenantId`) y realiza una verificación estricta `.eq("tenant_id", tenantId)` en la consulta a Supabase.
- **Reducción de Superficie de Ataque**: Se eliminaron los campos de entrada redundantes de API Keys en `IntegrationsManager.tsx`, previniendo la edición accidental de credenciales del sistema por parte de roles comerciales no autorizados y centralizando la gestión en la ruta protegida de administradores.

---

## 2. Tabla de findings

| ID        | Sev   | OWASP | Archivo:línea | Resumen |
| --------- | ----- | ----- | ------------- | ------- |
| S6-SEC-01 | MEDIO | A09   | `manual/route.ts:58-61` | Mensaje de excepción crudo retornado en las respuestas fallidas del API endpoint (fuga menor de detalles de stack/backend) |
| S6-SEC-02 | BAJO  | A03   | `manual/route.ts:40-42` | Falta de desinfección/normalización de caracteres no numéricos en `phoneNumber` antes de enviarlo a la API de Retell (posible inyección de caracteres de control en upstream) |

---

## 3. Detalle por finding

### S6-SEC-01 — MEDIO — A09 (Security Logging & Error Disclosure)

**Archivos:** `src/app/api/calls/manual/route.ts:58-61`

En el bloque `catch` del endpoint de llamada manual, se retorna el mensaje de la excepción (`err.message`) directamente al cliente:

```ts
} catch (err: any) {
  return NextResponse.json({ success: false, error: err.message }, { status: 500 });
}
```

* **Riesgo:** Si ocurre una excepción de la base de datos o del SDK de Retell que contiene URLs internas, nombres de tablas o detalles de infraestructura, se fugarían directamente al cliente.
* **Mitigación recomendada:** Capturar y registrar la excepción internamente con el logger seguro, y retornar un mensaje genérico al cliente (ej: `error: "Error interno al iniciar la llamada"`), a menos que sea un error controlado de validación.

### S6-SEC-02 — BAJO — A03 (Injection)

**Archivos:** `src/app/api/calls/manual/route.ts:40-42`

El número de teléfono se pasa directamente de la petición a la API de Retell.

* **Riesgo:** Aunque Retell valide el formato de llamada del lado del upstream, un número con caracteres maliciosos o de control podría causar comportamientos inesperados en las librerías de red internas.
* **Mitigación recomendada:** Limpiar el string `phoneNumber` para permitir únicamente dígitos y el carácter `+` al inicio antes de enviarlo a la API externa de Retell.
