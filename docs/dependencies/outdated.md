---
title: "Outdated Dependencies"
date: 2026-05-18
agent: Audit-Deps+Security (Sonnet)
source: npm outdated --json
---

# Outdated Dependencies

> Paquetes con actualizaciones disponibles según `npm outdated`. Semver: `wanted` = versión dentro del rango declarado, `latest` = última publicada en npm.

---

## Tabla completa (npm outdated)

| Paquete                         | Instalada | Wanted   | Latest   | Tipo gap   | Criticidad                                               |
| ------------------------------- | --------- | -------- | -------- | ---------- | -------------------------------------------------------- |
| `next`                          | 16.1.6    | 16.1.6   | 16.2.6   | patch      | **CRITICAL** — CVEs High activos                         |
| `axios`                         | 1.14.0    | 1.16.1   | 1.16.1   | minor      | **HIGH** — CVEs High activos (SSRF, prototype pollution) |
| `@supabase/supabase-js`         | 2.97.0    | 2.106.0  | 2.106.0  | minor      | **Medium** — 9 versiones atrás, auth bugfixes            |
| `langchain`                     | 1.2.39    | 1.4.0    | 1.4.0    | minor      | **High** — langsmith CVEs en transitivas                 |
| `retell-sdk`                    | 5.12.0    | 5.25.1   | 5.25.1   | minor      | **Medium** — 13 patches, funcionalidades nuevas          |
| `@aws-sdk/client-s3`            | 3.1031.0  | 3.1048.0 | 3.1048.0 | minor      | **Medium** — solo MinIO, no AWS                          |
| `@aws-sdk/s3-request-presigner` | 3.1031.0  | 3.1048.0 | 3.1048.0 | minor      | **Medium** — Idem                                        |
| `@langchain/anthropic`          | 1.3.26    | 1.3.29   | 1.3.29   | patch      | Low                                                      |
| `@langchain/google-genai`       | 2.1.26    | 2.1.30   | 2.1.30   | patch      | Low                                                      |
| `@langchain/openai`             | 1.4.1     | 1.4.5    | 1.4.5    | patch      | Low                                                      |
| `@supabase/ssr`                 | 0.8.0     | 0.8.0    | 0.10.3   | major (v0) | **Medium** — fuera del rango declarado                   |
| `@tailwindcss/postcss`          | 4.2.1     | 4.3.0    | 4.3.0    | minor      | Low                                                      |
| `@types/node`                   | 20.19.33  | 20.19.41 | 25.9.0   | major      | Low (devDep)                                             |
| `bullmq`                        | 5.73.0    | 5.76.10  | 5.76.10  | patch      | **Medium** — CVE uuid en transitiva                      |
| `date-fns`                      | 4.1.0     | 4.2.1    | 4.2.1    | minor      | Low                                                      |
| `dotenv`                        | 17.3.1    | 17.4.2   | 17.4.2   | patch      | Low                                                      |
| `eslint`                        | 9.39.3    | 9.39.4   | 10.4.0   | major      | Low (devDep)                                             |
| `eslint-config-next`            | 16.1.6    | 16.1.6   | 16.2.6   | patch      | Low (debe acompañar next)                                |
| `framer-motion`                 | 12.38.0   | 12.39.0  | 12.39.0  | patch      | Low                                                      |
| `libphonenumber-js`             | 1.12.42   | 1.13.2   | 1.13.2   | minor      | Low                                                      |
| `lucide-react`                  | 0.575.0   | 0.575.0  | 1.16.0   | major      | Low (breaking icon names)                                |
| `pg`                            | 8.20.0    | 8.21.0   | 8.21.0   | patch      | Low                                                      |
| `prettier`                      | 3.8.1     | 3.8.3    | 3.8.3    | patch      | Low (devDep)                                             |
| `prettier-plugin-tailwindcss`   | 0.7.2     | 0.7.4    | 0.8.0    | major      | Low (devDep)                                             |
| `react`                         | 19.2.3    | 19.2.3   | 19.2.6   | patch      | Low                                                      |
| `react-dom`                     | 19.2.3    | 19.2.3   | 19.2.6   | patch      | Low                                                      |
| `recharts`                      | 3.7.0     | 3.8.1    | 3.8.1    | minor      | Low                                                      |
| `redis`                         | 5.11.0    | 5.12.1   | 5.12.1   | patch      | Low                                                      |
| `shadcn`                        | 3.8.5     | 3.8.5    | 4.7.0    | major      | Low (devDep, breaking)                                   |
| `tailwind-merge`                | 3.5.0     | 3.6.0    | 3.6.0    | minor      | Low                                                      |
| `tailwindcss`                   | 4.2.1     | 4.3.0    | 4.3.0    | minor      | Low                                                      |
| `tsx`                           | 4.21.0    | 4.22.2   | 4.22.2   | patch      | Low (devDep)                                             |
| `typescript`                    | 5.9.3     | 5.9.3    | 6.0.3    | major      | **Medium** — TS 6 breaking; migración planificada        |
| `zod`                           | 4.3.6     | 4.4.3    | 4.4.3    | patch      | Low                                                      |
| `zustand`                       | 5.0.11    | 5.0.13   | 5.0.13   | patch      | Low                                                      |

---

## Análisis de paquetes críticos

### `next` 16.1.6 → 16.2.6 (patch)

**Impacto de NO actualizar**: 9 CVEs activos incluyendo:

- `GHSA-c4j6-fc7j-m34r` — SSRF via WebSocket upgrades (CVSS 8.6 — Critical)
- `GHSA-492v-c6pp-mqqv` — Middleware bypass via dynamic route injection (CVSS 8.1)
- `GHSA-26hh-7cqf-hhc6` — Middleware/Proxy bypass en App Router (CVSS 7.5)
- `GHSA-36qx-fr4f-26g5` — Middleware bypass en i18n Pages Router (CVSS 7.5)
- `GHSA-q4gf-8mx6-v5v3` — DoS Server Components (CVSS 7.5)

**Impacto de actualizar**: Minor/patch — sin breaking changes. Fix disponible directamente con `npm update next eslint-config-next`.

**Recomendación**: **Actualizar inmediatamente**. El middleware de autenticación puede ser bypasseado con las vulnerabilidades activas.

---

### `axios` 1.14.0 → 1.16.1 (minor)

**Impacto de NO actualizar**: 12 CVEs incluyendo:

- `GHSA-pf86-5x62-jrwf` — Prototype Pollution — Response Tampering, credential injection (CVSS 7.4)
- `GHSA-6chq-wfr3-2hj9` — Header Injection via Prototype Pollution (CVSS 7.4)
- `GHSA-pmwg-cvhr-8vh7` — NO_PROXY bypass — SSRF (CVSS 7.2)
- `GHSA-q8qp-cvcw-x6jj` — Prototype pollution read-side gadgets (CVSS 7.4)

**Impacto de actualizar**: Minor — puede haber breaking changes en edge cases de configuración. Verificar uso en `src/lib/integrations/`.

**Recomendación**: **Actualizar urgente** — axios se usa en integraciones con servicios externos (WhatsApp, Retell, CRM).

---

### `@supabase/supabase-js` 2.97.0 → 2.106.0 (minor — 9 versiones)

**Impacto de NO actualizar**: Bugs acumulados en auth y realtime. No hay CVEs directos reportados pero es una brecha significativa.

**Impacto de actualizar**: API compatible; revisar changelog de breaking changes en auth helpers.

**Recomendación**: Actualizar en PR separado tras verificar tests de auth.

---

### `langchain` 1.2.39 → 1.4.0 (minor — 2 versiones)

**Impacto de NO actualizar**: Transitiva `langsmith` tiene 3 CVEs activos incluyendo `GHSA-3644-q5cj-c5c7` (High, CVSS 7.1) — deserialization de manifests no confiables.

**Impacto de actualizar**: Posibles cambios de API en chains/retrievers. Verificar uso en orchestrator.

**Recomendación**: Actualizar; revisar changelog.

---

### `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` 3.1031.0 → 3.1048.0 (minor — 17 patches)

**Nota 26-05-2026**: AWS Bedrock descartado del stack (orden usuario). Estos paquetes solo se mantienen para hablar con MinIO via protocolo S3-compatible. Migración futura a Supabase Storage en evaluación.

**Impacto de NO actualizar**: Transitiva `fast-xml-parser` tiene CVE moderado; `fast-xml-builder` tiene CVE High.

**Impacto de actualizar**: AWS SDK mantiene compatibilidad semver. Actualización segura.

**Recomendación**: Actualizar en bloque (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`).

---

### `typescript` 5.9.3 (instalado) → 6.0.3 (major)

**Impacto de NO actualizar**: Ninguno inmediato. TS 5.x es completamente funcional.

**Impacto de actualizar**: TS 6 tiene breaking changes en configuración y algunos tipos. Migración es trabajo planificado, no urgente.

**Recomendación**: Planificar migración en sprint dedicado, no mezclar con otras actualizaciones.

---

### `bullmq` 5.73.0 → 5.76.10 (patch)

**Impacto de NO actualizar**: Transitiva `uuid` tiene CVE moderate (buffer bounds check). Riesgo bajo en contexto de queue management.

**Recomendación**: Actualizar como parte de actualización general de patch-level.
