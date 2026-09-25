---
title: "8-01 — Análisis de duplicaciones reales en N adapters"
status: pending
priority: P3
estimation: 3-6h
phase_id: 8-01
sprint_id: SP-8
branch: feature/sprint-08-adapter-generalization
created: 2026-05-21
---

# Phase 01 — Análisis duplicaciones (8-01)

## Context Links

- [plan.md](plan.md) — overview Sprint 8
- Source phase legacy: `../260520-1342-sprint-4-post-mvp-crms/phase-05-adapter-pattern-generalization.md`

## Overview

- **Prioridad:** P3
- **Estado:** Pendiente — primer entregable Sprint 8
- **Descripción:** Auditoría manual de los N adapters productivos (HubSpot, Zoho, Sheets, Salesforce, GHL, AC) para identificar duplicaciones **reales** de código y patrones, no asumidas.

## Key Insights

- YAGNI strict: solo extraer lo que aparece duplicado en >=3 adapters
- Output: documento `analisis-duplicaciones-{date}.md` con tabla de patrones encontrados y propuestas de generalización
- No tomar decisiones de refactor en esta fase, solo documentar
- Identificar también lo que NO debe generalizarse (specifics de cada CRM)

## Requirements

**Funcionales:**

- Documento markdown con auditoría completa
- Tabla de patrones duplicados con frecuencia
- Tabla de patrones NO generalizables con motivación
- Propuesta de interfaz mínima (5-7 métodos)
- Propuesta de FieldMapper estructura

**No funcionales:**

- 0 cambios de código en esta fase (puro análisis)
- Documento revisable por humano antes de fase 8-02

## Architecture

```
Output:
  plans/260521-0000-sprint-8-generalization/reports/
    └── analisis-duplicaciones-{date}.md

Tabla esperada:
  | Patrón | Adapters que lo tienen | Variación | Generalizable |
  |--------|-----------------------|-----------|---------------|
  | upsert by email | 6/6 | nombres distintos | SI |
  | OAuth2 refresh | 5/6 (no AC) | jsforce vs axios | PARCIAL |
  | FieldMapper inline | 6/6 | strucutra muy similar | SI |
  | Webhook HMAC verify | 4/6 | algoritmo SHA256 | SI |
  | ...                                            |
```

## Related Code Files

**Crear:**

- `plans/260521-0000-sprint-8-generalization/reports/analisis-duplicaciones-{YYYYMMDD}.md`

**Leer (read-only):**

- `src/lib/integrations/hubspot/*`
- `src/lib/integrations/zoho/*`
- `src/lib/integrations/sheets/*`
- `src/lib/integrations/salesforce/*`
- `src/lib/integrations/ghl/*`
- `src/lib/integrations/activecampaign/*`

## Implementation Steps

1. Leer adapter HubSpot (Sprint 2)
2. Leer adapter Zoho (Sprint 2)
3. Leer adapter Sheets (Sprint 4) — si está completo
4. Leer adapter Salesforce (Sprint 5) — si está completo
5. Leer adapter GHL (Sprint 6) — si está completo
6. Leer adapter AC (Sprint 7)
7. Mapear cada método: upsertContact, upsertOpportunity, testConnection, etc.
8. Identificar patrones de:
   - OAuth flow (similitudes y diferencias)
   - FieldMapper structure
   - WritePolicy logic
   - Error handling (clases de errores, retries)
   - Webhook verify
9. Producir tabla de patrones duplicados (>=3 adapters)
10. Producir tabla de specifics NO generalizables (1-2 adapters)
11. Proponer interfaz mínima
12. Proponer FieldMapper structure
13. Revisar con `af-agents:adr` para validar dirección

## Todo List

- [ ] Read adapter HubSpot
- [ ] Read adapter Zoho
- [ ] Read adapter Sheets
- [ ] Read adapter Salesforce
- [ ] Read adapter GHL
- [ ] Read adapter AC
- [ ] Tabla patrones duplicados
- [ ] Tabla NO generalizables
- [ ] Propuesta interfaz mínima (5-7 métodos)
- [ ] Propuesta FieldMapper
- [ ] Propuesta WritePolicy
- [ ] Propuesta AdapterError tipados
- [ ] Documento markdown final
- [ ] Validar con `af-agents:adr`

## Success Criteria

- Documento con análisis completo de los N adapters productivos
- Tabla clara de patrones generalizables vs específicos
- Propuesta de interfaz que cubre los 6 adapters sin obligar a sobreabstraer
- Revisión y aprobación previa a fase 8-02

## Risk Assessment

| Riesgo                                                       | Prob  | Impacto | Mitigación                                        |
| ------------------------------------------------------------ | ----- | ------- | ------------------------------------------------- |
| Análisis tardío descubre que no había suficiente duplicación | Baja  | Medio   | Si pasa: abortar Sprint 8 y diferir               |
| Interfaz propuesta demasiado amplia                          | Media | Alto    | Iterar con feedback antes de implementar          |
| Algunos adapters no productivos                              | Media | Bajo    | Hacer análisis solo con los disponibles, mínimo 4 |

## Security Considerations

- No expongan tokens en ejemplos del documento
- Si hay credenciales hardcodeadas en algún adapter → marcar como bug a corregir

## Next Steps

- Habilita 8-02 (refactor base) con interfaz validada
