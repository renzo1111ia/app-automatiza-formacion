# Fase 04: Pruebas y Cierre

## Objetivo
Verificar el correcto funcionamiento de todo el flujo y aplicar la disciplina de cierre.

## Tareas
- [ ] **Tests Unitarios**: Escribir tests para el `FlowInterpreter` simulando la ejecución de diversos tipos de nodos.
- [ ] **Test E2E de Flujo**: Crear un flujo de prueba (Inicio → Respuesta → Condición → HTTP Request) y validar que se recorre correctamente.
- [ ] **Test de Prevención de Bucles (Red Team)**: Testear que un flujo cíclico simulado en el intérprete es abortado limpiamente al alcanzar la profundidad máxima (`max_execution_depth`) sin tumbar el proceso ni causar stack overflow.
- [ ] **Lint & Build**: Ejecutar `npm run lint` y `npm run build` para asegurar que no hay errores de TypeScript o compilación.
- [ ] **Verificación de Seguridad**: Ejecutar auditoría RLS en las nuevas tablas.
- [ ] **Revisión del Red Team**: Validar que el flujo es robusto contra loops infinitos de redirección entre nodos.
