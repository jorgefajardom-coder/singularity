import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Scroll suave (Lenis) sincronizado con el ticker de GSAP, para que
 * ScrollTrigger y el scroll inercial no peleen entre ellos.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);

    // En desarrollo, para poder saltar a una sección desde la consola:
    // window.lenis.scrollTo('#contact')
    if (import.meta.env.DEV) window.lenis = lenis;

    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Enlaces ancla -> scroll suave
    const onClick = (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -40 });
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(raf);
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

    // Recalcular cuando las fuentes web cambian la altura del layout
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => ctx.revert();
  }, [scope]);
}
