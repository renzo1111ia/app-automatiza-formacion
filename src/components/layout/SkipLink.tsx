/**
 * Skip-link de accesibilidad — Sprint 3 SP-4-WCAG-10.
 *
 * WCAG 2.4.1 Bypass Blocks: usuarios con teclado/screen reader necesitan saltarse
 * la navegación del sidebar sin tabbear por cada link.
 *
 * Comportamiento:
 * - `sr-only` por defecto (invisible visualmente, presente para AT).
 * - Visible on focus (Tab desde el inicio del documento lo hace visible).
 * - Al activar, salta el foco al `<main id="main-content">` del layout.
 *
 * Estilos: rounded badge contrastado en top-left, z-index máximo para asegurar visibilidad
 * por encima de cualquier sticky header.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only z-[9999] focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:rounded-lg focus:border focus:border-blue-700 focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg focus:outline-none"
    >
      Saltar al contenido principal
    </a>
  );
}
