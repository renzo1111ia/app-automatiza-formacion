---
name: delegate
description: Delegar tareas a agentes especializados
---

# Task Delegation

Este skill permite delegar tareas a los agentes especializados.

## Uso

```
/delegate <agent> <task>
```

## Agentes disponibles

| Agente        | Alias         | Especialidad                 |
| ------------- | ------------- | ---------------------------- |
| @plan         | planning      | Planificación y arquitectura |
| @docs         | documentation | Documentación                |
| @db           | database      | Base de datos y Prisma       |
| @api          | api           | Endpoints y contratos        |
| @uxui         | uxui          | Interfaces y accesibilidad   |
| @security     | security      | Seguridad y auditoría        |
| @perf         | performance   | Optimización                 |
| @test         | testing       | Tests y validación           |
| @deploy       | deployment    | Despliegue                   |
| @git          | git           | Branching y versiones        |
| @productivity | productivity  | Métricas de tiempo           |

## Ejemplos

```
/delegate @db crear tabla products
/delegate @api endpoint POST /products
/delegate @test validar flujo de login
/delegate @security auditar RLS
```

## Proceso

1. @manager recibe la delegación
2. @productivity inicia tracking
3. Agente especializado ejecuta
4. @productivity registra tiempo
5. @manager valida resultado
