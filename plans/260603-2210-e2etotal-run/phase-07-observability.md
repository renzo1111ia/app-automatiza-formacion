# Fase 07 — Observabilidad + Compliance + WCAG

- **Env**: vps
- **Estado**: 🟡 PASS con warning (1 fail conocido no-regresión)
- **Método**: specs sprint-3-close (health-version, security-headers, wcag) contra VPS.

## Resultados (13/14 verde, 6.2s)

| Área    | Check                                             | Resultado                           |
| ------- | ------------------------------------------------- | ----------------------------------- |
| Health  | `/api/health` 200 + status ok                     | 🟢                                  |
| Health  | no-cache `Cache-Control: no-store`                | 🟢                                  |
| Health  | público sin auth                                  | 🟢                                  |
| Version | `/api/version` 200 + metadata build               | 🔴 `commit:""` vacío (bug conocido) |
| Version | no-cache + público sin auth                       | 🟢                                  |
| Headers | home incluye todos los security headers           | 🟢                                  |
| Headers | CSP dominios LLM (Anthropic/OpenAI/Google)        | 🟢                                  |
| Headers | CSP `frame-ancestors 'none'` anti-clickjacking    | 🟢                                  |
| Headers | X-Frame-Options DENY                              | 🟢                                  |
| Headers | X-Content-Type-Options nosniff                    | 🟢                                  |
| WCAG    | skip-link 'Saltar al contenido principal' en body | 🟢                                  |
| WCAG    | skip-link → #main-content                         | 🟢                                  |
| WCAG    | skip-link visible on focus (Tab)                  | 🟢                                  |

## Sentry

✅ Ya validado E2E end-to-end el 26-05-2026 (memoria `project-sentry-vps-validated-260526.md`): event `4967d99e` recibido en dashboard Sentry desde VPS. No se re-provoca error en VPS producción en este run.

## Bug (no-regresión)

🟡 `E2E-260527-001-MED` / `SP-4-NEW-13` — `/api/version` devuelve `commit:""`, `branch:""`, `deployedAt:""`. Causa: Dokploy no inyecta `GIT_COMMIT_SHA` como Build Arg. **Acción usuario** en panel Dokploy. Pre-existente, no regresión de código. El test sprint-3-close lo marca fail porque espera commit poblado.

## Resultado

🟡 **PASS con warning** — 13/14 specs. Único fail = deuda de deploy conocida (Build Args Dokploy), no defecto de código. Observabilidad + headers + WCAG sólidos. 0 bugs nuevos.
