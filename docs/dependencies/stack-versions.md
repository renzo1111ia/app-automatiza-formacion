---
title: "Stack Versions — Dependency Snapshot"
date: 2026-05-18
agent: Audit-Deps+Security (Sonnet)
source: package.json + npm outdated --json + npm ls --depth=0
---

# Stack Versions

> Versiones declaradas en `package.json`, instaladas (de `package-lock.json`/`npm ls`), y últimas disponibles en npm registry.
> Gap: `=` al día (o minor/patch menor), `M` major atrás, `m` minor atrás, `p` patch atrás.

---

## Framework Core

| Paquete              | Declarada | Instalada | Latest-stable | Gap | Notas                                                            |
| -------------------- | --------- | --------- | ------------- | --- | ---------------------------------------------------------------- |
| `next`               | `16.1.6`  | `16.1.6`  | `16.2.6`      | p   | **CVEs High** — middleware bypass, SSRF, DoS; actualizar urgente |
| `react`              | `19.2.3`  | `19.2.3`  | `19.2.6`      | p   | React 19 estable; patch disponible                               |
| `react-dom`          | `19.2.3`  | `19.2.3`  | `19.2.6`      | p   | Idem React                                                       |
| `typescript`         | `^5`      | `5.9.3`   | `6.0.3`       | M   | TS 6.0 — breaking changes; migración planificada                 |
| `eslint`             | `^9`      | `9.39.3`  | `10.4.0`      | M   | ESLint 10 — migración no urgente                                 |
| `eslint-config-next` | `16.1.6`  | `16.1.6`  | `16.2.6`      | p   | Debe acompañar a next                                            |

---

## Base de Datos / Supabase

| Paquete                 | Declarada | Instalada | Latest-stable | Gap | Notas                                                 |
| ----------------------- | --------- | --------- | ------------- | --- | ----------------------------------------------------- |
| `@supabase/supabase-js` | `^2.97.0` | `2.97.0`  | `2.106.0`     | m   | 9 minor versions atrás; actualizar para bugfixes auth |
| `@supabase/ssr`         | `^0.8.0`  | `0.8.0`   | `0.10.3`      | M   | v0 a v0.10 — revisar breaking changes SSR             |
| `pg`                    | `^8.20.0` | `8.20.0`  | `8.21.0`      | p   | Librería pg usada además de Supabase — 3-003          |
| `postgres`              | `^3.4.9`  | `3.4.9`   | `3.4.9`       | =   | Al día                                                |
| `@types/pg`             | `^8.20.0` | `8.20.0`  | `8.20.0`      | =   | Al día                                                |

> **NOTA**: la presencia de `pg` y `postgres` en producción además de `@supabase/supabase-js` confirma 3-003 (SQL directo sin ORM).

---

## LLM / IA

| Paquete                   | Declarada | Instalada | Latest-stable | Gap | Notas                                             |
| ------------------------- | --------- | --------- | ------------- | --- | ------------------------------------------------- |
| `langchain`               | `^1.2.39` | `1.2.39`  | `1.4.0`       | m   | 2 minor versions; actualizar para fixes langsmith |
| `@langchain/anthropic`    | `^1.3.26` | `1.3.26`  | `1.3.29`      | p   | Patch disponible                                  |
| `@langchain/openai`       | `^1.4.1`  | `1.4.1`   | `1.4.5`       | p   | Patch disponible                                  |
| `@langchain/google-genai` | `^2.1.26` | `2.1.26`  | `2.1.30`      | p   | Patch disponible                                  |

---

## AWS S3 SDK (solo MinIO storage)

> **AWS Bedrock descartado del stack 26-05-2026** (orden del usuario, no se trabajará con AWS). Solo se mantiene el SDK S3 porque MinIO se accede vía protocolo S3-compatible. Migración futura a Supabase Storage en evaluación.

| Paquete                         | Declarada   | Instalada  | Latest-stable | Gap | Notas                                   |
| ------------------------------- | ----------- | ---------- | ------------- | --- | --------------------------------------- |
| `@aws-sdk/client-s3`            | `^3.1031.0` | `3.1031.0` | `3.1048.0`    | m   | Cliente S3 para MinIO. No habla con AWS |
| `@aws-sdk/s3-request-presigner` | `^3.1031.0` | `3.1031.0` | `3.1048.0`    | m   | Idem                                    |

---

## Voz (Retell / Ultravox)

| Paquete      | Declarada | Instalada | Latest-stable | Gap | Notas                                          |
| ------------ | --------- | --------- | ------------- | --- | ---------------------------------------------- |
| `retell-sdk` | `^5.12.0` | `5.12.0`  | `5.25.1`      | m   | 13 patches; funcionalidades nuevas, actualizar |

> Ultravox no tiene SDK npm; se integra via fetch directo.

---

## Infraestructura / Queue

| Paquete   | Declarada | Instalada | Latest-stable | Gap | Notas                                                                           |
| --------- | --------- | --------- | ------------- | --- | ------------------------------------------------------------------------------- |
| `bullmq`  | `^5.73.0` | `5.73.0`  | `5.76.10`     | p   | CVE uuid en 5.66-5.76.1 — actualizar                                            |
| `ioredis` | `^5.10.1` | `5.10.1`  | `5.10.1`      | =   | Al día                                                                          |
| `redis`   | `^5.11.0` | `5.11.0`  | `5.12.1`      | p   | Patch disponible                                                                |
| `dotenv`  | `^17.3.1` | `17.3.1`  | `17.4.2`      | p   | Patch disponible                                                                |
| `axios`   | `^1.14.0` | `1.14.0`  | `1.16.1`      | m   | **CVEs High** — SSRF, prototype pollution, header injection; actualizar urgente |

---

## UI / Frontend

| Paquete                    | Declarada  | Instalada | Latest-stable | Gap | Notas                                             |
| -------------------------- | ---------- | --------- | ------------- | --- | ------------------------------------------------- |
| `framer-motion`            | `^12.38.0` | `12.38.0` | `12.39.0`     | p   | Patch disponible                                  |
| `lucide-react`             | `^0.575.0` | `0.575.0` | `1.16.0`      | M   | Major — breaking icon names; migración no urgente |
| `recharts`                 | `^3.7.0`   | `3.7.0`   | `3.8.1`       | m   | Minor disponible                                  |
| `@xyflow/react`            | `^12.10.2` | `12.10.2` | `12.10.2`     | =   | Al día                                            |
| `shadcn`                   | `^3.8.5`   | `3.8.5`   | `4.7.0`       | M   | Major disponible; migración planificada           |
| `tailwindcss`              | `^4`       | `4.2.1`   | `4.3.0`       | m   | Minor disponible                                  |
| `tailwind-merge`           | `^3.5.0`   | `3.5.0`   | `3.6.0`       | m   | Minor disponible                                  |
| `radix-ui`                 | `^1.4.3`   | `1.4.3`   | `1.4.3`       | =   | Al día                                            |
| `react-markdown`           | `^10.1.0`  | `10.1.0`  | `10.1.0`      | =   | Al día                                            |
| `mermaid`                  | `^11.15.0` | `11.15.0` | `11.15.0`     | =   | Al día                                            |
| `zod`                      | `^4.3.6`   | `4.3.6`   | `4.4.3`       | p   | Patch disponible                                  |
| `zustand`                  | `^5.0.11`  | `5.0.11`  | `5.0.13`      | p   | Patch disponible                                  |
| `date-fns`                 | `^4.1.0`   | `4.1.0`   | `4.2.1`       | m   | Minor disponible                                  |
| `date-fns-tz`              | `^3.2.0`   | `3.2.0`   | `3.2.0`       | =   | Al día                                            |
| `class-variance-authority` | `^0.7.1`   | `0.7.1`   | `0.7.1`       | =   | Al día                                            |
| `clsx`                     | `^2.1.1`   | `2.1.1`   | `2.1.1`       | =   | Al día                                            |

---

## Otros / Utilidades

| Paquete                   | Declarada  | Instalada | Latest-stable | Gap | Notas                                                                                                            |
| ------------------------- | ---------- | --------- | ------------- | --- | ---------------------------------------------------------------------------------------------------------------- |
| `crypto`                  | `^1.0.1`   | `1.0.1`   | `1.0.1`       | =   | **ADVERTENCIA**: este paquete npm es un stub deprecated. Node.js tiene crypto nativo; importar con `node:crypto` |
| `libphonenumber-js`       | `^1.12.42` | `1.12.42` | `1.13.2`      | m   | Minor disponible                                                                                                 |
| `countries-and-timezones` | `^3.9.0`   | `3.9.0`   | `3.9.0`       | =   | Al día                                                                                                           |
| `pdf-parse`               | `^2.4.5`   | `2.4.5`   | `2.4.5`       | =   | Al día                                                                                                           |
| `googleapis`              | `^171.4.0` | `171.4.0` | `171.4.0`     | =   | Al día                                                                                                           |
| `@dnd-kit/core`           | `^6.3.1`   | `6.3.1`   | `6.3.1`       | =   | Al día                                                                                                           |
| `@dnd-kit/sortable`       | `^10.0.0`  | `10.0.0`  | `10.0.0`      | =   | Al día                                                                                                           |

---

## DevDependencies

| Paquete                     | Declarada  | Instalada  | Latest-stable | Gap | Notas                                                      |
| --------------------------- | ---------- | ---------- | ------------- | --- | ---------------------------------------------------------- |
| `@anthropic-ai/claude-code` | `^2.1.143` | `2.1.143`  | `2.1.143`     | =   | En devDeps — innecesario en prod Docker                    |
| `prettier`                  | `^3.8.1`   | `3.8.1`    | `3.8.3`       | p   | Patch disponible                                           |
| `@types/node`               | `^20`      | `20.19.33` | `25.9.0`      | M   | TS types bloqueados en Node 20 — actualizar con TypeScript |
| `tsx`                       | `^4.21.0`  | `4.21.0`   | `4.22.2`      | p   | Patch disponible                                           |
| `tw-animate-css`            | `^1.4.0`   | `1.4.0`    | `1.4.0`       | =   | Al día                                                     |

---

## Paquetes extraneous detectados (npm ls --depth=0)

Los siguientes paquetes están instalados pero NO aparecen en `package.json`:

| Paquete                 | Versión  | Origen probable                 |
| ----------------------- | -------- | ------------------------------- |
| `@emnapi/core`          | `1.8.1`  | Dependencia transitiva huérfana |
| `@emnapi/runtime`       | `1.8.1`  | Idem                            |
| `@emnapi/wasi-threads`  | `1.1.0`  | Idem                            |
| `@napi-rs/wasm-runtime` | `0.2.12` | Idem                            |
| `@tybys/wasm-util`      | `0.10.1` | Idem                            |

> **Recomendación**: ejecutar `npm prune` para eliminar paquetes extraneous que no son dependencias directas ni transitivas válidas.
