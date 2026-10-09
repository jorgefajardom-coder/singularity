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

/** Un salto por enlace ancla en curso: los cerrojos de scroll no lo frenan. */
export const navegacion = { activa: false };

/**
 * ¿Va rapido el scroll AHORA? (px/ms, suavizado, de los ultimos eventos.)
 *
 * Los cerrojos de la pagina (el despliegue de las galaxias, el reparto del
 * Stack) estan para que se VEAN, y tienen sentido si el visitante llega
 * despacio. Un gesto rapido que cruzaba el punto justo se quedaba frenado en
 * seco a mitad de camino, 1,5-3 s (Jorge, 27-09-2026: "evitar que el hard
 * scroll nos modifique el comportamiento de la pagina"). Con esto, quien va
 * rapido ve la animacion igual pero sin que le paren.
 */
// Muestras (t, y) de los ultimos ~400 ms. La velocidad sale de la mas vieja
// a la mas nueva, no de dos eventos seguidos: el compositor entrega a veces
// varios `scroll` con la misma marca de tiempo y la cuenta daba 0 justo en el
// momento de decidir. Y con la pagina cargada (el Stack en un Redmi) los
// `scroll` llegan cada 80-230 ms: la ventana tiene que abarcar varios
// (medido el 27-09-2026).
const muestras = [];
let previa = null;
// Donde y cuando empezo el ultimo toque: el primer `scroll` de un gesto puede
// llegar tarde, y desde el inicio del toque se sabe lo rapido que fue.
let toque = null;
const velocidad = { v: 0, t: 0 };
if (typeof window !== "undefined") {
  window.addEventListener("scroll", () => {
    const t = performance.now();
    muestras.push([t, window.scrollY]);
    while (muestras.length > 1 && t - muestras[0][0] > 400) previa = muestras.shift();
    let [t0, y0] = muestras[0];
    // Una sola muestra reciente: se mide contra la anterior si no es de hace
    // mucho. Con el hilo ocupado el primer `scroll` de un gesto llegaba 0,5 s
    // tarde y ya 1.400 px mas abajo; sin esto la velocidad salia 0, saltaba
    // el cerrojo y la pagina volvia atras de golpe.
    if (muestras.length < 2) {
      const base = [toque, previa].filter((m) => m && t - m[0] < 1500).sort((x, y) => y[0] - x[0])[0];
      if (base) [t0, y0] = base;
      else { velocidad.v = 0; velocidad.t = t; return; }
    }
    if (t - t0 >= 12) velocidad.v = (window.scrollY - y0) / (t - t0);
    velocidad.t = t;
  }, { passive: true, capture: true });
  window.addEventListener("touchstart", () => { toque = [performance.now(), window.scrollY]; }, { passive: true, capture: true });
}
export const scrollRapido = (umbral = 1.5) =>
  typeof performance !== "undefined" && performance.now() - velocidad.t < 400 && Math.abs(velocidad.v) > umbral;

/**
 * El dedo desplaza la pagina el solo (Lenis no lleva el tacto): el scroll
 * corre en el hilo del compositor y lo que se coloca por JS llega un
 * fotograma tarde. Misma puerta que movil.css para los gestos.
 */
export const scrollTactil = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;

/**
 * Bloqueo de la pagina para el dedo, sin tocar el `overflow`.
 *
 * Con `overflow: hidden` en `html`, Chrome de Android saca (o esconde) la barra
 * de direcciones al volverse la pagina no desplazable: el viewport cambia de
 * alto y todo da un salto. Y el cerrojo que devuelve la pagina a su sitio
 * (`scrollTo` al moverse) deja que el dedo la arrastre y luego la regresa: un
 * brinco (Jorge, 27-09-2026: "bloquea el scroll en galaxias para que el
 * usuario no lo haga brincar"). Aqui el gesto se cancela antes de mover nada,
 * y un `scrollTo` a la misma altura corta la inercia de un gesto anterior.
 * Devuelve la funcion que lo suelta.
 */
export function frenarDedo() {
  const cancelar = (e) => { if (e.cancelable) e.preventDefault(); };
  window.scrollTo(0, window.scrollY);
  window.addEventListener("touchmove", cancelar, { passive: false });
  window.addEventListener("wheel", cancelar, { passive: false });
  document.documentElement.dataset.frenado = "true";
  return () => {
    window.removeEventListener("touchmove", cancelar);
    window.removeEventListener("wheel", cancelar);
    delete document.documentElement.dataset.frenado;
  };
}

/**
 * Adonde desplazarse para que el destino de un ancla se vea ENTERO.
 *
 * Si la seccion marca una pieza con `data-encuadre` (la tarjeta de Contacto),
 * se encuadra esa y no el borde de la seccion, que lleva su propio margen.
 * Cabe en lo que deja la barra: centrada en ese hueco. No cabe (el telefono):
 * su borde de arriba justo debajo de la barra. La barra se mide por su borde
 * de abajo, no por su alto, que no cuenta el margen que la separa del techo.
 */
export function destinoAncla(el) {
  const caja = el.querySelector("[data-encuadre]") || el;
  const bar = document.querySelector(".nav");
  const techo = bar ? Math.ceil(bar.getBoundingClientRect().bottom) : 0;
  const r = caja.getBoundingClientRect();
  const libre = window.innerHeight - techo;
  const margen = 12;
  const arriba = r.height + margen * 2 <= libre ? (libre - r.height) / 2 : margen;
  return Math.max(0, window.scrollY + r.top - techo - arriba);
}

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
    // queda encuadrado bajo la barra (ver `destinoAncla`).
    //
    // Durante el viaje `navegacion.activa` esta arriba: el despliegue de las
    // galaxias (Halo.jsx) y el reparto del Stack anclan la pagina al pasar, y
    // un salto a Contacto se quedaba varado en Meditacion (medido: y = 6336
    // con Contacto en 12022, el hash sin cambiar).
    let soltarNav = 0;
    const acabar = () => { clearTimeout(soltarNav); navegacion.activa = false; };
    const onClick = (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      let el;
      try { el = document.querySelector(id); } catch { return; }
      if (!el) return;
      e.preventDefault();
      navegacion.activa = true;
      clearTimeout(soltarNav);
      // Por si el viaje se interrumpe (rueda, dedo) y no llega su onComplete.
      soltarNav = setTimeout(acabar, 4000);
      lenis.start();
      const llegar = () => {
        if (location.hash !== id) history.pushState(null, "", id);
        acabar();
      };
      lenis.scrollTo(destinoAncla(el), {
        force: true,
        onComplete: () => {
          // Lo de encima puede haber cambiado de alto durante el viaje
          // (fijados de ScrollTrigger, imagenes que llegan): se vuelve a
          // medir y se corrige lo que falte.
          const y = destinoAncla(el);
          if (Math.abs(y - window.scrollY) > 2) lenis.scrollTo(y, { force: true, duration: 0.5, onComplete: llegar });
          else llegar();
        },
      });
    };
    document.addEventListener("click", onClick);

    return () => {
      acabar();
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
