-- ============================================================================
-- Sprint 0 tarea 1-27: Widget hardening — allowed_domains + rate limit
-- ============================================================================
--
-- Origen: Informe técnico de Renzo sobre el Módulo de Chatbot Web V1
--   (`docs/Informes de programacion/Reporte-Modulo-Chatbot-Web-Renzo-V1.pdf` §3 🔴).
--
-- Vulnerabilidad cerrada:
--   La Server Action `getChatbotResponse` en `src/lib/actions/widget.ts` es un
--   endpoint público accesible desde cualquier dominio sin auth, sin CORS ni
--   rate limit. Conocer el `widgetId` (visible en el código fuente del sitio
--   del cliente) bastaba para vaciar el saldo OpenAI del tenant + llenar la
--   tabla `lead` y `chat_messages` de basura.
--
-- Solución:
--   Dos nuevas columnas en `web_widgets`:
--     - allowed_domains text[]: hosts permitidos para enviar mensajes
--       (validados contra Origin/Referer de la request). Si está vacío →
--       modo LEGACY: permite todos los orígenes con log warning. Si está
--       poblado → enforce estricto (rechaza orígenes fuera de la lista).
--       Decisión deliberada: NO deny-by-default como en 1-22 (tenants), ya
--       que romper widgets en producción de clientes es peor que el riesgo
--       residual durante la ventana de migración. Una tarea de Sprint 1
--       forzará la migración a allowlists pobladas.
--     - rate_limit_per_minute integer: límite de peticiones por minuto por
--       (widgetId, IP). Aplicado SIEMPRE desde el inicio (sliding window
--       Redis). Por defecto 5 req/min — generoso para uso humano legítimo,
--       letal para bots.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.web_widgets
  ADD COLUMN IF NOT EXISTS allowed_domains text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute integer NOT NULL DEFAULT 5;

COMMENT ON COLUMN public.web_widgets.allowed_domains IS
  'Hosts permitidos (Origin/Referer) para invocar el widget. Vacío = legacy ALLOW. Poblado = enforce. Soporta wildcards de subdominio (*.ejemplo.com).';

COMMENT ON COLUMN public.web_widgets.rate_limit_per_minute IS
  'Rate limit por (widgetId, IP) en peticiones/minuto. Default 5. Sliding window Redis. Cuando se excede, getChatbotResponse devuelve error sin llamar OpenAI.';

-- Validación: el rate limit debe ser positivo (1 req/min es el mínimo razonable).
ALTER TABLE public.web_widgets
  DROP CONSTRAINT IF EXISTS web_widgets_rate_limit_positive;

ALTER TABLE public.web_widgets
  ADD CONSTRAINT web_widgets_rate_limit_positive
  CHECK (rate_limit_per_minute > 0);
