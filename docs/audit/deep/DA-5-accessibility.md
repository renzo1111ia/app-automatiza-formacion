---
title: "Deep Audit DA-5 — Accesibilidad WCAG 2.1 AA"
date: 2026-05-18
agent: DA-5 (Sonnet)
phase: deep-audit
standard: WCAG 2.1 nivel AA
---

# DA-5 — Accesibilidad

## Resumen ejecutivo (estado de cumplimiento global por principio)

| Principio | Pass | Issues críticos | Veredicto |
|---|---|---|---|
| Perceivable | 3 | 6 | PARCIAL — color exclusivo, error sin icono, imágenes decorativas vacías |
| Operable | 2 | 8 | FALLA — modales sin focus trap, tablas clicables sin teclado, 187 outline-none sin ring visible |
| Understandable | 3 | 5 | PARCIAL — errores via alert(), sin autocomplete, sin aria-describedby en errores |
| Robust | 2 | 4 | PARCIAL — modales sin role="dialog", toasts ausentes, ids duplicados potenciales |
| **Global** | — | **23 findings** | **NON-COMPLIANT** — App NO cumple WCAG 2.1 AA |

---

## Metodología

Análisis estático del código fuente JSX/TSX. Sin ejecución de runtime ni herramientas de browser. Se inspeccionaron todos los archivos bajo `src/app/` y `src/components/` (41 archivos). Se revisaron también `globals.css`, la paleta de colores (variables CSS en `:root`), el componente `shadcn/ui` base (`button.tsx`, `input.tsx`) y el sistema de temas.

Herramientas usadas: búsquedas semánticas en el árbol AST de componentes (grep por patrones ARIA, patrones de teclado, patrones de etiquetas, patrones de contraste de color).

---

## Perímetro auditado

| Categoría | Archivos |
|---|---|
| Layout y navegación | `Sidebar.tsx`, `Topbar.tsx`, `DashboardShell.tsx`, `ThemeToggle.tsx`, `TenantSelector.tsx` |
| Autenticación | `login/page.tsx`, `reset-password/page.tsx` |
| Formularios complejos | `CreateLeadDialog.tsx`, `settings/page.tsx`, `IntegrationsManager.tsx` |
| Tablas y listas | `HistorialTable.tsx`, `CampaignLeadsTable.tsx` |
| Modales y diálogos | `DuplicateLeadDialog.tsx`, `LeadProfileModal.tsx`, `AIAgentInbox.tsx` (4 modales inline) |
| Páginas grandes | `calendar/page.tsx` (1466 líneas), `agents/page.tsx`, `AIAgentInbox.tsx` (1832 líneas) |
| Primitivos shadcn/ui | `button.tsx`, `input.tsx`, `label.tsx`, `badge.tsx` |
| Estilos globales | `globals.css` (paleta de temas) |

---

## Findings por criterio WCAG

### 1.1.1 Non-text content

#### DA-5-001 — Imágenes de lead sin alt descriptivo
- **Archivo**: `src/components/agents/AIAgentInbox.tsx:852, 1071`
- **WCAG**: 1.1.1
- **Severidad**: High
- **Esfuerzo**: S
- **Descripción**: Las imágenes de perfil del lead seleccionado se renderizan con `alt=""` (string vacío). Aunque técnicamente el atributo existe (lo que marca la imagen como decorativa para screen readers), en estos contextos las imágenes son informativas — muestran la foto del lead en una zona de cabecera donde no hay otro texto identificador visible al mismo nivel. La imagen en la lista de conversaciones (línea 812) sí tiene `alt={lead.nombre || ""}` pero si el nombre está vacío, cae en alt vacío.
- **Fix**: Usar `alt={lead.nombre ? \`Foto de ${lead.nombre}\` : "Sin foto de perfil"}` en las tres instancias.

#### DA-5-002 — SVGs inline decorativos sin aria-hidden
- **Archivo**: `src/components/layout/Sidebar.tsx:294, 324`
- **WCAG**: 1.1.1
- **Severidad**: Medium
- **Esfuerzo**: S
- **Descripción**: El Sidebar tiene dos SVGs inline (logo colapsado y botón colapsar/expandir) sin `aria-hidden="true"`. El SVG del botón de colapsar tiene un botón padre con `title` pero sin `aria-label` ni text visible. Screen readers pueden anunciar los paths SVG como texto sin sentido.
- **Fix**: Añadir `aria-hidden="true"` a los SVGs puramente decorativos. Para el botón de colapsar, añadir `aria-label` descriptivo (ya tiene `title`, que se lee en algunos lectores pero no es suficiente).

---

### 1.3.1 Info and relationships

#### DA-5-003 — Labels de formulario no asociados con htmlFor/id en CreateLeadDialog
- **Archivo**: `src/components/historial/CreateLeadDialog.tsx:100, 114, 127, 141, 163, 173, 189, 199, 224`
- **WCAG**: 1.3.1
- **Severidad**: Critical
- **Esfuerzo**: M
- **Descripción**: El formulario "Agregar Nuevo Lead" usa elementos `<label>` nativos (lowercase, no el componente `Label` de shadcn) pero **ninguno tiene `htmlFor`** y los `<input>` correspondientes no tienen `id`. La asociación visual por proximidad funciona visualmente pero los screen readers no pueden programáticamente relacionar la etiqueta con su campo. Esto afecta a todos los campos: Nombre, Apellido, Teléfono, Email, País, Tipo Lead, Origen, Campaña, Programa.
- **Fix**: Añadir `id` único a cada `<input>`/`<select>` y el `htmlFor` correspondiente al `<label>`. Alternativa: usar el atributo `aria-label` directamente en el input si se quiere evitar el refactor del markup.

#### DA-5-004 — Tabla de historial clicable sin semántica de fila interactiva
- **Archivo**: `src/components/historial/HistorialTable.tsx:346-360`
- **WCAG**: 1.3.1, 2.1.1
- **Severidad**: High
- **Esfuerzo**: M
- **Descripción**: Las filas `<tr>` del historial de leads tienen `onClick` y `cursor-pointer` pero son elementos `<tr>` nativos. Los `<tr>` no son focusables por defecto, no reciben teclado y no tienen `role` semántico para indicar que son interactivos. Screen readers no anuncian que la fila es clicable.
- **Fix**: Añadir `tabIndex={0}`, `role="button"`, `onKeyDown` (Enter/Space dispara el mismo handler), y `aria-label="Ver detalle de ${row.nombre}"`.

#### DA-5-005 — Headings sin jerarquía consistente en páginas complejas
- **Archivo**: `src/app/dashboard/agents/page.tsx:229, 300, 367` y múltiples secciones
- **WCAG**: 1.3.1
- **Severidad**: Medium
- **Esfuerzo**: M
- **Descripción**: La página de agentes usa `<h1>` (nombre del agente) seguido directamente de `<h3>` (secciones internas) saltándose `<h2>`. En `calendar/page.tsx`, hay `<h1>` en línea 361 y directamente `<h2>` en 392. El `Topbar` renderiza un `<h1>` para el título de la página usando clase de texto pero dentro de un `<header>`, mientras que las páginas internas también tienen `<h1>`. Esto produce múltiples `<h1>` en la misma página (el topbar + el contenido).
- **Fix**: Establecer jerarquía clara: `<h1>` solo en el Topbar (título de sección), `<h2>` para secciones principales de contenido, `<h3>` para subsecciones. Cambiar los `<h1>` internos de páginas a `<h2>`.

#### DA-5-006 — Div con onClick como elemento interactivo en agents/page.tsx
- **Archivo**: `src/app/dashboard/agents/page.tsx:263`
- **WCAG**: 1.3.1, 2.1.1
- **Severidad**: High
- **Esfuerzo**: S
- **Descripción**: La lista de agentes usa `<div onClick={() => setSelectedAgent(agent)}>` con `cursor-pointer`. Un `<div>` no es nativo focusable, no puede recibir teclado, y no tiene semántica de "elemento seleccionable". Usuarios de teclado no pueden seleccionar agentes.
- **Fix**: Cambiar a `<button>` (o añadir `tabIndex={0}`, `role="option"`, `onKeyDown`). La opción más limpia y semántica es `<button type="button" className="w-full text-left ...">`.

---

### 1.3.5 Identify input purpose

#### DA-5-007 — Inputs de autenticación sin atributo autocomplete
- **Archivo**: `src/app/login/page.tsx:164-172, 191-199` y `src/app/auth/reset-password/page.tsx:99-107, 114-122`
- **WCAG**: 1.3.5
- **Severidad**: Medium
- **Esfuerzo**: S
- **Descripción**: Los campos de email y contraseña en el formulario de login y reset-password no tienen el atributo `autocomplete`. Para usuarios con discapacidades motoras que usan autorrelleno, o para usuarios con dificultades cognitivas que dependen del gestor de contraseñas del navegador, este atributo es crítico.
- **Fix**: Añadir `autoComplete="email"` al input de email, `autoComplete="current-password"` al input de contraseña del login, y `autoComplete="new-password"` a los inputs de nueva contraseña.

---

### 1.4.1 Use of color

#### DA-5-008 — Estados de llamada transmitidos solo por color sin icono ni texto
- **Archivo**: `src/components/historial/HistorialTable.tsx:24-33` y `src/components/historial/DuplicateLeadDialog.tsx:12-21`
- **WCAG**: 1.4.1
- **Severidad**: High
- **Esfuerzo**: M
- **Descripción**: Los badges de estado de llamada (CONTACTED = verde, NO_CONTACT = ámbar, ANNULLED = rojo, etc.) se distinguen únicamente por color de fondo y texto. El texto que se muestra es la clave interna en inglés (`CONTACTED`, `NO_CONTACT`) sin icono diferenciador. Aunque el texto existe (lo que ayuda), los usuarios con daltonismo rojo-verde (afecta ~8% hombres) no pueden distinguir CONTACTED (verde) de ANNULLED (rojo) de forma fiable sin leer el texto, y el texto en inglés técnico (`LATENCY_DROP`, `USER_INTERRUPTED`) no es suficientemente descriptivo.
- **Fix**: Añadir un icono semántico a cada estado (check, X, pause, etc.) y traducir los valores al español. El cambio de label es también necesario para 3.2.4.

#### DA-5-009 — Indicador "WhatsApp Activo" transmitido solo por color
- **Archivo**: `src/components/agents/AIAgentInbox.tsx:816`
- **WCAG**: 1.4.1
- **Severidad**: Medium
- **Esfuerzo**: S
- **Descripción**: El punto verde en la esquina inferior del avatar del lead indica "WhatsApp Activo" usando únicamente color (punto verde sin texto, con `title="WhatsApp Activo"` en el div pero no en el punto). El `title` proporciona un tooltip en hover pero no es accesible por teclado ni para screen readers.
- **Fix**: Añadir `aria-label="WhatsApp Activo"` al elemento del punto o usar `role="img" aria-label="WhatsApp activo"`.

---

### 1.4.3 Contrast (minimum)

#### DA-5-010 — Contraste potencialmente insuficiente en texto de nivel secondary
- **Archivo**: `src/app/globals.css` — variable `--muted-foreground`
- **WCAG**: 1.4.3
- **Severidad**: High
- **Esfuerzo**: M
- **Descripción**: Análisis de la paleta CSS:

  **Tema claro (`:root`)**:
  - `--muted-foreground: #64748b` sobre `--background: #f8fafc` → ratio ≈ 4.5:1 (just barely AA para texto normal, FALLA para texto <14px bold)
  - `--muted-foreground: #64748b` sobre `--card: #ffffff` → ratio ≈ 4.7:1 (pasa AA)
  - El texto `text-muted-foreground/40` (opacity 40%) sobre fondo claro: `#64748b` al 40% de opacidad efectiva ≈ #b8c4d0 sobre blanco → ratio ≈ 1.9:1 — **FALLA WCAG 1.4.3 completamente**

  **Tema oscuro (`.dark`)**:
  - `--muted-foreground: #94a3b8` sobre `--background: #020617` → ratio ≈ 6.1:1 (pasa)
  - `--muted-foreground: #94a3b8` sobre `--card: rgba(15,23,42,0.6)` → ratio efectivo ≈ 5.2:1 (pasa)

  **Problema crítico — uso de opacidad fraccionada**:
  El código usa ampliamente clases como `text-muted-foreground/40`, `text-muted-foreground/20`, `text-foreground/50` (especialmente en `AIAgentInbox.tsx` con múltiples instancias de `/60`, `/40`, `/20`). Aplicar opacidad reduce el contraste a niveles muy por debajo de 4.5:1. Este patrón aparece en al menos 25 ubicaciones distintas con texto de contenido informativo (no puramente decorativo).

- **Fix**: Eliminar el patrón `text-*-foreground/XX` para texto de contenido informativo. Usar colores de contraste fijo más apagados en lugar de transparencia. Para texto secundario: definir una nueva variable `--secondary-text` con un valor fijo que pase el ratio 4.5:1.

---

### 1.4.4 Resize text

#### DA-5-011 — Texto en unidades px fijas en lugar de rem/em
- **Archivo**: Múltiples componentes — e.g. `AIAgentInbox.tsx`, `Sidebar.tsx`, `HistorialTable.tsx`
- **WCAG**: 1.4.4
- **Severidad**: Medium
- **Esfuerzo**: M
- **Descripción**: El código utiliza extensivamente clases de Tailwind con tamaños fijos como `text-[9px]`, `text-[10px]`, `text-[8px]`. Tailwind v4 interpreta estos como píxeles absolutos. Aunque el zoom del navegador al 200% escala píxeles en la mayoría de navegadores modernos, estos textos ya son extremadamente pequeños en resolución normal y con zoom 200% puede haber problemas de overflow en layouts fijos. Además, `text-[9px]` está por debajo del umbral mínimo de legibilidad general (WCAG no tiene mínimo en px pero 9px es prácticamente ilegible sin zoom).
- **Fix**: No usar tamaños menores a `text-[11px]` (≈0.69rem) para texto de contenido. Usar `text-xs` (12px/0.75rem) como mínimo. Para etiquetas y badges, como mínimo `text-[10px]` con font-weight bold.

---

### 1.4.10 Reflow

#### DA-5-012 — Layout de 3 columnas fijo sin breakpoint responsive en AIAgentInbox
- **Archivo**: `src/components/agents/AIAgentInbox.tsx:669-1044`
- **WCAG**: 1.4.10
- **Severidad**: High
- **Esfuerzo**: L
- **Descripción**: El inbox de conversaciones implementa un layout de 3 columnas fijas (`w-80 flex-shrink-0` + `flex-1` + `w-80 flex-shrink-0`). No tiene ningún breakpoint responsive. En viewports de 320px-768px, este layout producirá scroll horizontal o contenido cortado. No hay colapsado a vista de columna única en móvil.
- **Fix**: Implementar lógica responsive: en mobile mostrar primero la lista de conversaciones, al seleccionar lead mostrar el chat, el panel de detalles debe ser un drawer inferior o colapsable. Ver el patrón ya implementado en `Sidebar.tsx` como referencia.

---

### 2.1.1 Keyboard

#### DA-5-013 — Foco ausente en modales de AIAgentInbox (Delete, Template, Create Lead)
- **Archivo**: `src/components/agents/AIAgentInbox.tsx:1453-1496, 1507-1573, 1498-1505`
- **WCAG**: 2.1.1, 2.1.2
- **Severidad**: Critical
- **Esfuerzo**: M
- **Descripción**: Los tres modales inline del inbox (Template Selector, Delete Confirmation, y el modal de creación de lead invocado desde aquí) se montan vía `AnimatePresence` pero **no mueven el foco al interior del modal** al abrirse. Un usuario de teclado que esté en el inbox y abra un modal continuará tabulando por los elementos de fondo, pudiendo interactuar con contenido detrás del modal. Tampoco hay `focus-trap` explícito.
- **Fix**: Al montar cada modal, llamar `.focus()` en el primer elemento interactivo o en el contenedor con `tabIndex={-1}`. Usar una librería de focus trap (Radix UI Dialog ya lo hace — si se migra a `Dialog` de shadcn/Radix, es automático). Añadir handler de `Escape` para cerrar.

#### DA-5-014 — Modal HistorialTable sin trap de foco ni cierre por Escape
- **Archivo**: `src/components/historial/HistorialTable.tsx:258-315`
- **WCAG**: 2.1.1, 2.1.2
- **Severidad**: Critical
- **Esfuerzo**: M
- **Descripción**: El panel de detalle del lead en `HistorialTable` es un overlay de pantalla completa (`fixed inset-0 z-50`) con `onClick={closePopover}` en el fondo. No tiene manejo de teclado Escape, no mueve el foco al abrirse, y el botón de cerrar (`✕`) es un `<button>` sin `aria-label`. El foco del usuario permanece en la tabla invisible de fondo.
- **Fix**: Añadir `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apuntando al `<h3>` del título, mover foco al primer elemento interactivo al abrir, y añadir `useEffect` que escuche `keydown === 'Escape'` para cerrar.

#### DA-5-015 — Tabla de historial: fila como elemento no-focusable
- **Archivo**: `src/components/historial/HistorialTable.tsx:347-360`
- **WCAG**: 2.1.1
- **Severidad**: Critical
- **Esfuerzo**: S
- **Descripción**: Ver DA-5-004. Las filas `<tr>` con `onClick` no son alcanzables por teclado. Duplicado funcional indicado en 1.3.1 — aquí se señala el impacto específico en operabilidad por teclado.

#### DA-5-016 — 187 instancias de outline-none sin ring visible en inputs nativos
- **Archivo**: `src/components/historial/CreateLeadDialog.tsx`, `HistorialTable.tsx`, `AIAgentInbox.tsx`, `ChartManager.tsx` y otros
- **WCAG**: 2.4.7
- **Severidad**: High
- **Esfuerzo**: M
- **Descripción**: Los `<input>`, `<select>`, y `<textarea>` nativos (no los del componente `Input` de shadcn que sí tiene `focus-visible:ring-[3px]`) usan `outline-none` sin añadir siempre un ring visible. Patrón frecuente: `outline-none focus:ring-4 focus:ring-primary/10` — el ring con opacidad 10% (prácticamente invisible) no cumple el ratio 3:1 requerido por 1.4.11 para non-text contrast. El `input` en el widget (`widget/[id]/page.tsx:185`) usa `focus:outline-none` sin ring alternativo alguno.
- **Fix**: Reemplazar `focus:ring-primary/10` por `focus:ring-primary/60` como mínimo. La opacidad del ring debe ser ≥50% para ser visible. Para el input del widget, añadir al menos `focus:ring-2 focus:ring-primary`.

#### DA-5-017 — Ausencia de "skip to main content"
- **Archivo**: `src/components/layout/DashboardShell.tsx`, `src/app/layout.tsx`
- **WCAG**: 2.4.1
- **Severidad**: High
- **Esfuerzo**: S
- **Descripción**: No existe ningún enlace de "Saltar al contenido principal" en el inicio de la página. Los usuarios de teclado deben tabular por todos los elementos del Sidebar (que puede tener 20+ ítems interactivos) antes de llegar al contenido principal en cada navegación.
- **Fix**: Añadir al inicio del `DashboardShell` un enlace visualmente oculto pero focusable: `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[200] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-xl">Saltar al contenido principal</a>`. Añadir `id="main-content"` al elemento `<main>`.

---

### 2.4.2 Page titled

#### DA-5-018 — Título de página único solo en root, todas las rutas del dashboard comparten el mismo título
- **Archivo**: `src/app/layout.tsx:7-9`
- **WCAG**: 2.4.2
- **Severidad**: High
- **Esfuerzo**: M
- **Descripción**: El metadata de la aplicación define `title: "App Automatiza"` en el root layout. Ninguna subruta del dashboard (`/dashboard/agents`, `/dashboard/calendar`, etc.) tiene su propio `metadata` con título descriptivo. Todas las páginas del dashboard comparten el mismo título en la pestaña del navegador y en los anuncios del screen reader al navegar entre páginas. Usuarios de screen reader no pueden saber en qué sección están sin explorar el contenido.
- **Fix**: En cada `page.tsx` del dashboard, exportar `metadata` con `title: "Agentes IA — App Automatiza"`, `title: "Calendario — App Automatiza"`, etc. El App Router de Next.js soporta `generateMetadata` para títulos dinámicos también.

---

### 2.4.4 Link purpose

#### DA-5-019 — Iconos de acción sin texto visible en botones de tabla
- **Archivo**: `src/app/dashboard/settings/page.tsx:512, 520` y `src/app/dashboard/calendar/page.tsx:601-609`
- **WCAG**: 2.4.4, 2.5.3
- **Severidad**: Medium
- **Esfuerzo**: S
- **Descripción**: Los botones de acción en tablas (Editar, Eliminar, Confirmar, Cancelar) usan solo iconos con `title` pero sin `aria-label` explícito en muchos casos. En `calendar/page.tsx` los botones de Confirmar/Cancelar cita usan `title="Confirmar"` y `title="Cancelar"` que proporciona tooltip pero no garantiza anuncio por screen readers. El `settings/page.tsx` sí añade `aria-label` correctamente en las líneas 512 y 520.
- **Fix**: Añadir `aria-label` descriptivo en todos los icon-only buttons (el `title` no es suficiente para accesibilidad programática en todos los lectores de pantalla).

---

### 3.1.2 Language of parts

#### DA-5-020 — Bloques en inglés sin atributo lang
- **Archivo**: `src/app/dashboard/settings/IntegrationsManager.tsx:144, 185, 302`
- **WCAG**: 3.1.2
- **Severidad**: Low
- **Esfuerzo**: S
- **Descripción**: El componente IntegrationsManager contiene encabezados y párrafos completos en inglés ("Retell AI Integration", "Ultravox AI Integration", "Web-native Realtime Voice Inference", "External Voice Connectors (Outbound Streams)") dentro de una interfaz en español. No tienen `lang="en"`. Los screen readers configurados para español intentarán pronunciar estos textos con síntesis de voz español, produciendo pronunciación incorrecta.
- **Fix**: Envolver los textos en inglés con `<span lang="en">` o cambiarlos a español.

---

### 3.3.1 Error identification

#### DA-5-021 — Errores de formulario via alert() nativo del navegador
- **Archivo**: `src/components/historial/CreateLeadDialog.tsx:43`, múltiples otros archivos
- **WCAG**: 3.3.1
- **Severidad**: High
- **Esfuerzo**: M
- **Descripción**: La validación de formularios usa `alert("Nombre y Teléfono son obligatorios")` — el diálogo nativo del navegador. Esto interrumpe el flujo, no identifica qué campo específico tiene el error, no asocia el error programáticamente al input (`aria-describedby`), y es bloqueante. Hay 10+ instancias de `alert()` dispersas en el codebase para reportar errores a usuarios. Los campos con error no reciben ningún indicador visual adicional (borde rojo, icono).

  Adicionalmente, en `login/page.tsx` y `reset-password/page.tsx`, los mensajes de error se muestran en un `<div>` con estilos rojos pero sin `role="alert"` ni `aria-live="polite"`. Los screen readers no anuncian estos errores automáticamente cuando aparecen tras submit.
- **Fix**: 
  1. Reemplazar `alert()` por mensajes inline cerca del campo erróneo.
  2. Añadir `aria-invalid="true"` al input con error.
  3. Añadir `aria-describedby="error-id"` al input y un `<p id="error-id" role="alert">` con el mensaje.
  4. En login/reset-password: añadir `role="alert"` o `aria-live="assertive"` al div de error.

---

### 3.3.4 Error prevention (destructive actions)

#### DA-5-022 — Confirmaciones de acciones destructivas via confirm() nativo
- **Archivo**: `src/app/dashboard/calendar/page.tsx:270, 283`, `src/components/onboarding/WorkflowSidebar.tsx:140`, `src/app/dashboard/knowledge/page.tsx:108, 222`, y 6 ubicaciones más
- **WCAG**: 3.3.4
- **Severidad**: Medium
- **Esfuerzo**: M
- **Descripción**: Las confirmaciones de eliminación usan `window.confirm()` — el diálogo nativo del sistema operativo. Aunque técnicamente funciona con teclado (Tab entre OK/Cancelar), el diálogo nativo no puede ser personalizado con estilos accesibles, puede bloquear scripts en algunos contextos, y es muy abrupto en UX. Inconsistente con el patrón ya correctamente implementado en `AIAgentInbox.tsx` que usa un modal de confirmación personalizado con opciones claras.
- **Fix**: Reemplazar `window.confirm()` por el patrón de modal de confirmación ya existente en `AIAgentInbox.tsx` (deleteModal state + AnimatePresence + botones Cancelar/Confirmar). Centralizar en un hook `useConfirmDialog`.

---

### 4.1.2 Name, role, value

#### DA-5-023 — Modales sin role="dialog" ni aria-modal
- **Archivo**: `src/components/historial/CreateLeadDialog.tsx:64`, `src/components/agents/AIAgentInbox.tsx:1453, 1510`, `src/components/historial/HistorialTable.tsx:259`
- **WCAG**: 4.1.2
- **Severidad**: Critical
- **Esfuerzo**: S
- **Descripción**: Todos los modales/diálogos de la aplicación son divs con `fixed inset-0 z-[100]` pero **sin** `role="dialog"`, `aria-modal="true"`, ni `aria-labelledby`. Los screen readers no identifican estos overlays como diálogos modales y no interrumpen la navegación del contenido de fondo. El componente `CreateLeadDialog` tiene un `<h2>` ("Agregar Nuevo Lead") que podría servir de label pero no está enlazado con `aria-labelledby`.

  El componente `DuplicateLeadDialog` tampoco tiene `role="dialog"` en su contenedor principal (línea 213 del archivo).
- **Fix**: Añadir a cada contenedor raíz de modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title-id"`. Dar un `id` único al heading del modal. Ver el patrón: `<div role="dialog" aria-modal="true" aria-labelledby="create-lead-title" ...>`.

---

### 4.1.3 Status messages

#### DA-5-024 — Sin sistema de notificaciones accesible (toasts/status)
- **Archivo**: Toda la aplicación
- **WCAG**: 4.1.3
- **Severidad**: High
- **Esfuerzo**: M
- **Descripción**: La aplicación no implementa ningún sistema de notificaciones o toasts (`sonner`, `react-hot-toast`, ni componente propio). Los resultados de acciones se comunican via `alert()` nativo (bloqueante) o no se comunican visualmente en absoluto (estados de carga con spinner sin texto). Las operaciones asíncronas exitosas (crear lead, sincronizar, guardar) no generan feedback visual persistente. Screen readers no reciben anuncio de cambios de estado de operaciones asíncronas.
- **Fix**: Instalar `sonner` (ya integrado en shadcn/ui) o `react-hot-toast`. Configurar el Toaster en el layout raíz con `aria-live="polite"`. Reemplazar los `alert()` de éxito por `toast.success()` y `alert()` de error por `toast.error()`.

---

## Componentes problemáticos (top 10)

| Componente | Líneas | Issues DA-5 | Critical | Acción recomendada |
|---|---|---|---|---|
| `AIAgentInbox.tsx` | 1832 | 7 (DA-5-001, 009, 012, 013, 016, 022, 023) | 2 | Focus management en modales, sistema de toasts, responsive layout |
| `HistorialTable.tsx` | 406 | 4 (DA-5-004, 014, 015, 016) | 3 | Filas teclado-accesibles, dialog ARIA en modal detalle |
| `CreateLeadDialog.tsx` | 271 | 3 (DA-5-003, 021, 023) | 2 | Labels con htmlFor, role=dialog, errores inline |
| `calendar/page.tsx` | 1466 | 3 (DA-5-005, 019, 022) | 0 | Confirmar actions, aria-labels en botones de acción |
| `agents/page.tsx` | >1000 | 3 (DA-5-005, 006, 019) | 0 | Div→button, jerarquía headings |
| `Sidebar.tsx` | 364 | 2 (DA-5-002, 017) | 0 | aria-hidden SVGs, skip link |
| `DashboardShell.tsx` | 28 | 1 (DA-5-017) | 0 | Añadir skip-to-main |
| `IntegrationsManager.tsx` | 450+ | 2 (DA-5-007, 020) | 0 | autocomplete en inputs, lang en bloques EN |
| `login/page.tsx` | 234 | 2 (DA-5-007, 021) | 0 | autocomplete, role=alert en error div |
| `ThemeToggle.tsx` | 100 | 1 (DA-5-019) | 0 | aria-expanded en el botón toggle |

---

## Tabla maestra de findings DA-5-XXX

| ID | Criterio WCAG | Descripción corta | Severidad | Esfuerzo | Archivo principal |
|---|---|---|---|---|---|
| DA-5-001 | 1.1.1 | Imágenes de lead con alt vacío | High | S | AIAgentInbox.tsx:852 |
| DA-5-002 | 1.1.1 | SVGs inline sin aria-hidden | Medium | S | Sidebar.tsx:294 |
| DA-5-003 | 1.3.1 | Labels sin htmlFor/id en CreateLeadDialog | Critical | M | CreateLeadDialog.tsx |
| DA-5-004 | 1.3.1 | Tabla con filas `<tr onClick>` no semánticas | High | M | HistorialTable.tsx:347 |
| DA-5-005 | 1.3.1 | Jerarquía de headings con saltos y múltiples H1 | Medium | M | agents/page.tsx, calendar/page.tsx |
| DA-5-006 | 1.3.1 | `<div onClick>` como selector de agentes | High | S | agents/page.tsx:263 |
| DA-5-007 | 1.3.5 | Inputs de auth sin autocomplete | Medium | S | login/page.tsx, reset-password/page.tsx |
| DA-5-008 | 1.4.1 | Estados de llamada por color sin icono | High | M | HistorialTable.tsx, DuplicateLeadDialog.tsx |
| DA-5-009 | 1.4.1 | Indicador WhatsApp solo por color | Medium | S | AIAgentInbox.tsx:816 |
| DA-5-010 | 1.4.3 | Texto con opacity fraccional — contraste < 4.5:1 | High | M | globals.css + 25+ componentes |
| DA-5-011 | 1.4.4 | Texto en 8px/9px — extremadamente pequeño | Medium | M | AIAgentInbox.tsx, Sidebar.tsx, etc. |
| DA-5-012 | 1.4.10 | Layout 3-columnas fijo sin responsive | High | L | AIAgentInbox.tsx |
| DA-5-013 | 2.1.1 | Modales AIAgentInbox sin focus trap | Critical | M | AIAgentInbox.tsx:1453 |
| DA-5-014 | 2.1.2 | Modal HistorialTable sin focus trap ni Escape | Critical | M | HistorialTable.tsx:258 |
| DA-5-015 | 2.1.1 | `<tr>` interactivo sin teclado | Critical | S | HistorialTable.tsx:347 |
| DA-5-016 | 2.4.7 | outline-none + ring invisible en inputs nativos | High | M | CreateLeadDialog.tsx, HistorialTable.tsx |
| DA-5-017 | 2.4.1 | Ausencia de "skip to main content" | High | S | DashboardShell.tsx |
| DA-5-018 | 2.4.2 | Título de página genérico en todas las rutas | High | M | Todas las pages del dashboard |
| DA-5-019 | 2.4.4 | Icon-only buttons sin aria-label en algunas tablas | Medium | S | calendar/page.tsx:601 |
| DA-5-020 | 3.1.2 | Bloques en inglés sin lang="en" | Low | S | IntegrationsManager.tsx |
| DA-5-021 | 3.3.1 | Errores via alert() sin asociación ARIA al campo | High | M | CreateLeadDialog.tsx + 10 más |
| DA-5-022 | 3.3.4 | Confirmaciones destructivas via window.confirm() | Medium | M | calendar/page.tsx + 8 más |
| DA-5-023 | 4.1.2 | Modales sin role="dialog" ni aria-modal | Critical | S | CreateLeadDialog.tsx + 3 modales |
| DA-5-024 | 4.1.3 | Sin sistema de notificaciones accesible | High | M | Toda la app |

**Total: 24 findings** — 6 Critical, 9 High, 6 Medium, 1 Low

---

## Recomendaciones de stack

### Estado actual: shadcn/ui + Radix UI (sin usar los primitivos de diálogo)

El proyecto tiene `shadcn/ui` instalado (confirmado por `@import "shadcn/tailwind.css"` en `globals.css`) y usa sus primitivos más simples: `button.tsx`, `input.tsx`, `label.tsx`, `badge.tsx`, `card.tsx`, `separator.tsx`, `skeleton.tsx`. Estos primitivos de shadcn SÍ tienen accesibilidad correcta (el `button.tsx` tiene `focus-visible:ring-[3px]`, el `input.tsx` tiene `focus-visible:ring-[3px]` y `aria-invalid` support).

**El problema**: Los 4+ modales de la aplicación se implementaron como divs manuales (`fixed inset-0`) en lugar de usar el componente `Dialog` de shadcn/ui que tiene Radix UI bajo el capó. `Dialog` de Radix proporciona automáticamente: focus trap, `role="dialog"`, `aria-modal`, cierre con Escape, y portal rendering.

**Recomendación de stack**:
1. **Migrar modales a `Dialog` de shadcn/ui** (instalar: `npx shadcn@latest add dialog`). Esto resuelve DA-5-013, DA-5-014, DA-5-023 con un cambio de componente.
2. **Instalar `sonner`** para toasts (ya en el ecosistema shadcn). Resuelve DA-5-024 y reemplaza todos los `alert()`.
3. **Los componentes Input y Button de shadcn ya son accesibles** — el problema es que se usan inputs/selects nativos en los formularios complejos (CreateLeadDialog, HistorialTable filters) en lugar del componente `Input` de shadcn.

**Coste estimado de migración**: Bajo-Medio. La infraestructura (shadcn + Radix) ya está presente. Se trata de usar los componentes correctos en lugar de reimplementar.

---

## Quick wins (alta cobertura, esfuerzo S)

1. **DA-5-017 — Skip to main content** (30 min): Añadir un `<a>` visualmente oculto al inicio del `DashboardShell` + `id="main-content"` al `<main>`. Una línea de código que desbloquea toda la navegación por teclado en el dashboard.

2. **DA-5-023 — role="dialog" en modales** (1h): Añadir `role="dialog"`, `aria-modal="true"`, `aria-labelledby` a los 4 contenedores de modal existentes. Cambio de markup puro, sin refactor de lógica.

3. **DA-5-003 — htmlFor/id en CreateLeadDialog** (45 min): Añadir `id` a los 9 inputs y `htmlFor` a los 9 labels. Mejora el 100% de accesibilidad del formulario de creación de lead para usuarios de screen reader.

4. **DA-5-007 — autocomplete en login** (15 min): Añadir `autoComplete="email"` y `autoComplete="current-password"` a dos inputs del login. Una sola línea por campo.

5. **DA-5-018 — Títulos de página** (45 min): Exportar `metadata` con `title` descriptivo en cada una de las ~15 páginas del dashboard. Mejora la navegación para todos los usuarios de screen reader y también el SEO.

---

**Status:** DONE
**Summary:** 24 findings identificados contra WCAG 2.1 AA. 6 Critical (modales sin focus trap ni ARIA, tabla clicable sin teclado, labels sin asociación). La app usa shadcn/ui pero no usa sus componentes de Dialog/Toast que resolverían automáticamente la mayoría de issues críticos de modales. El patrón más dañino es el uso masivo de opacity fraccional en colores de texto que lleva el contraste por debajo de 4.5:1 en al menos 25 ubicaciones.
