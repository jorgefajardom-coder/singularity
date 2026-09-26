import { useEffect, useSyncExternalStore } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { introTerminada } from "./arranque";

gsap.registerPlugin(ScrollTrigger);
// Sin el refresco automatico al evento `load`: caia en plena intro, con el ∞
// dibujandose, y medir la pagina entera ahi eran ~250 ms parados en una
// grafica integrada. Con el scroll bloqueado ademas mide mal; App refresca al
// terminar la intro (ver App.jsx), que es cuando las posiciones valen.
ScrollTrigger.config({ autoRefreshEvents: "visibilitychange,DOMContentLoaded,resize" });

export { gsap, ScrollTrigger };

// En desarrollo, para poder congelar una animacion desde la consola:
//   gsap.globalTimeline.pause()
if (import.meta.env.DEV && typeof window !== "undefined") window.gsap = gsap;

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * La misma pregunta, pero reactiva y compartida: una sola consulta `matchMedia`
 * para toda la pagina, y los componentes que la usan se enteran si el
 * visitante cambia el ajuste con la pagina abierta.
 */
const MOVIMIENTO = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
const suscribirMovimiento = (f) => {
  MOVIMIENTO?.addEventListener("change", f);
  return () => MOVIMIENTO?.removeEventListener("change", f);
};
const leerMovimiento = () => Boolean(MOVIMIENTO?.matches);
export function useReducedMotion() {
  return useSyncExternalStore(suscribirMovimiento, leerMovimiento, () => false);
}

/**
 * Lo que tapa la barra fija por arriba. Se mide: la barra cambia de alto
 * entre escritorio y telefono, y un numero fijo dejaba el titulo de la
 * seccion debajo de ella o muy separado.
 */
export function altoBarra() {
  const bar = document.querySelector(".nav");
  return bar ? Math.ceil(bar.getBoundingClientRect().height) : 0;
}

/**
 * Scroll suave (Lenis) sincronizado con el ticker de GSAP, para que
 * ScrollTrigger y el scroll inercial no peleen entre ellos.
 */
/**
 * El scroll suave, para quien necesite PARARLO.
 *
 * Lenis no desplaza el documento: lleva el scroll por su cuenta y lo aplica en
 * cada fotograma. Por eso un `overflow: hidden` en el body no lo detiene —lo
 * intente— y hace falta poder llamarle `stop()`. Lo usa Halo.jsx para anclar
 * la escena mientras la camara esta dentro de una galaxia.
 */
export const scroller = { current: null };

export function useSmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);
    scroller.current = lenis;

    // En desarrollo, para poder saltar a una sección desde la consola:
    // window.lenis.scrollTo('#contact')
    if (import.meta.env.DEV) window.lenis = lenis;

    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Enlaces ancla -> scroll suave. La URL se actualiza igual que con un
    // ancla normal (se puede copiar, compartir y volver atras), y el destino
    // queda por debajo de la barra, que se mide.
    const onClick = (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      let el;
      try { el = document.querySelector(id); } catch { return; }
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, {
        offset: -(altoBarra() + 8),
        onComplete: () => {
          if (location.hash !== id) history.pushState(null, "", id);
        },
      });
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(raf);
      scroller.current = null;
      lenis.destroy();
    };
  }, []);
}

/**
 * Anima todo lo que lleve [data-reveal] dentro de `scope` cuando entra en pantalla.
 * data-reveal="stagger" escalona los hijos directos.
 */
export function useReveal(scope) {
  useEffect(() => {
    const root = scope?.current ?? document.body;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) {
        gsap.set("[data-reveal]", { opacity: 1, y: 0 });
        return;
      }

      gsap.utils.toArray("[data-reveal]").forEach((el) => {
        const targets = el.dataset.reveal === "stagger" ? el.children : el;
        if (el.dataset.reveal === "stagger") {
          gsap.set(el, { opacity: 1, y: 0 });
          gsap.set(targets, { opacity: 0, y: 28 });
        }

        gsap.to(targets, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: el.dataset.reveal === "stagger" ? 0.08 : 0,
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            // Reversible: al subir, el bloque se retira y vuelve a entrar si se
            // baja otra vez. Con `once: true` la entrada se gastaba para
            // siempre y el scroll dejaba de poder deshacerse.
            toggleActions: "play none none reverse",
          },
        });
      });
    }, root);

    // Recalcular cuando las fuentes web cambian la altura del layout. Si
    // llegan durante la intro no hace falta: App refresca al terminarla.
    document.fonts?.ready.then(() => { if (introTerminada()) ScrollTrigger.refresh(); });

    return () => ctx.revert();
  }, [scope]);
}
