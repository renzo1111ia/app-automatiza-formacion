"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * RevealOnScroll — Sprint 2B mejora UX (Bloque A feedback 25-05).
 *
 * Wrapper que aplica fade-in + translate-y cuando el elemento entra en viewport.
 * Usa IntersectionObserver una sola vez (unobserve tras el primer trigger) para
 * no re-animar si el usuario hace scroll de vuelta.
 *
 * Respeta `prefers-reduced-motion` — si el usuario lo tiene activado, el
 * contenido se renderiza ya visible sin animación (WCAG 2.2 AA SC 2.3.3).
 *
 * Uso:
 *   <RevealOnScroll>
 *     <MiComponente />
 *   </RevealOnScroll>
 *
 *   <RevealOnScroll delay={120} threshold={0.2}>
 *     <ChartCard ... />
 *   </RevealOnScroll>
 */
export function RevealOnScroll({
  children,
  delay = 0,
  threshold = 0.15,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  /** Retardo en ms antes de iniciar la animación (útil para cascadas). */
  delay?: number;
  /** Fracción del elemento visible para disparar (0..1). Default 0.15. */
  threshold?: number;
  className?: string;
  /** Tag HTML del wrapper. Default "div". */
  as?: "div" | "section" | "article" | "li";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Lazy initializer: detecta prefers-reduced-motion en el primer render.
  // Si el usuario lo tiene activo arrancamos con visible=true (sin animación).
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (visible) return; // ya está revelado (reduced-motion o trigger previo)
    const el = ref.current;
    if (!el) return;

    // Reaccionar a cambios runtime de prefers-reduced-motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMqChange = (e: MediaQueryListEvent) => {
      if (e.matches) setVisible(true);
    };
    mq.addEventListener("change", onMqChange);

    // Buscar el ancestro scrollable (e.g. <main class="overflow-y-auto"> del
    // layout dashboard). Si root=null el observer usaría window y no dispararía
    // dentro de containers scrollables custom.
    const findScrollRoot = (node: HTMLElement | null): Element | null => {
      let cur: HTMLElement | null = node?.parentElement ?? null;
      while (cur && cur !== document.body) {
        const cs = getComputedStyle(cur);
        if (
          (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
          cur.scrollHeight > cur.clientHeight
        ) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    };
    const root = findScrollRoot(el);
    const rootRect = root ? root.getBoundingClientRect() : null;
    const rect = el.getBoundingClientRect();
    const alreadyVisible = rootRect
      ? rect.top < rootRect.bottom && rect.bottom > rootRect.top
      : rect.top < window.innerHeight && rect.bottom > 0;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: IntersectionObserver | undefined;

    if (alreadyVisible) {
      timer = setTimeout(() => setVisible(true), delay);
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && observer) {
              timer = setTimeout(() => setVisible(true), delay);
              observer.unobserve(entry.target);
            }
          });
        },
        { root, threshold, rootMargin: "0px 0px -40px 0px" }
      );
      observer.observe(el);
    }

    return () => {
      mq.removeEventListener("change", onMqChange);
      if (timer) clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [delay, threshold, visible]);

  const Component = Tag as React.ElementType;

  return (
    <Component
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out will-change-[opacity,transform]",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className
      )}
    >
      {children}
    </Component>
  );
}
