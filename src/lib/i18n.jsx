import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "./anim";

const LANGS = ["es", "en"];
const STORAGE_KEY = "portfolio-lang";

const LangContext = createContext(null);

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {
    // localStorage puede fallar en modo incógnito; seguimos con el idioma del navegador
  }
  const nav = typeof navigator !== "undefined" ? navigator.language : "es";
  return nav?.toLowerCase().startsWith("en") ? "en" : "es";
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  // Aviso al resto de la app (y a los lectores de pantalla) del idioma activo
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // sin persistencia; no es crítico
    }
  }, [lang]);

  /**
   * Cambia el idioma.
   *
   * `animate: false` para cuando el sitio no se está viendo —el selector del
   * cargador lo tapa por completo—: ahí la entrada escalonada y su
   * `ScrollTrigger.refresh()` son trabajo invisible, y encima caen en el
   * mismo fotograma en el que arranca el morph del agujero negro.
   */
  const setLang = useCallback(
    (next, { animate = true } = {}) => {
      if (next === lang || !LANGS.includes(next)) return;

      if (!animate) {
        // Nadie está viendo el sitio: el re-render completo (cada SplitText
        // vuelve a partir su texto) puede ir troceado y sin bloquear el hilo,
        // que es justo lo que necesita el morph del cargador para ir fluido.
        startTransition(() => setLangState(next));
        return;
      }

      setLangState(next);

      if (prefersReducedMotion()) return;

      // El texto cambia de longitud, así que las secciones se recomponen:
      // una entrada escalonada disimula el salto y marca que algo cambió.
      //
      // Dos cuidados con esta animación:
      //
      // 1. El hero queda fuera (`:not(#top)`). Mientras una sección tiene
      //    opacity < 1 o un transform, crea un contexto de apilamiento y el
      //    z-index de su contenido deja de competir con el canvas 3D: el
      //    objeto del hero se subía por encima del titular.
      // 2. `clearProps` borra los estilos inline al terminar. Sin esto GSAP
      //    deja un `transform: translate(0,0)`, que basta para que ese
      //    contexto de apilamiento se quede para siempre y el bug persista.
      requestAnimationFrame(() => {
        gsap.fromTo(
          "main > section:not(#top), footer",
          { opacity: 0.2, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: "power2.out",
            stagger: 0.045,
            overwrite: "auto",
            clearProps: "opacity,transform",
            onComplete: () => ScrollTrigger.refresh(),
          }
        );
      });
    },
    [lang]
  );

  /**
   * Resuelve un texto bilingüe. Acepta tanto `t("hola", "hi")` como
   * una cadena normal, para poder mezclar sin romper nada.
   */
  const tr = useCallback(
    (value) => {
      if (value == null) return "";
      if (typeof value === "object" && (value.es !== undefined || value.en !== undefined)) {
        return value[lang] ?? value.es ?? value.en ?? "";
      }
      return value;
    },
    [lang]
  );

  const api = useMemo(() => ({ lang, setLang, tr }), [lang, setLang, tr]);

  return <LangContext.Provider value={api}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang debe usarse dentro de <LangProvider>");
  return ctx;
}

/**
 * Conmutador ES / EN.
 * El indicador viaja con un rebote elástico y se estira en el trayecto
 * (squash & stretch), para que el cambio se note sin ser molesto.
 */
export function LangToggle() {
  const { lang, setLang } = useLang();
  const wrapRef = useRef(null);
  const knobRef = useRef(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const knob = knobRef.current;
    if (!wrap || !knob) return;

    const active = wrap.querySelector(`[data-lang="${lang}"]`);
    if (!active) return;

    const x = active.offsetLeft;
    const width = active.offsetWidth;

    // En el primer render colocamos el indicador sin animar
    if (first.current || prefersReducedMotion()) {
      first.current = false;
      gsap.set(knob, { x, width, scaleX: 1 });
      return;
    }

    const tl = gsap.timeline();
    tl.to(knob, { width, duration: 0.45, ease: "power3.out" }, 0)
      .to(knob, { x, duration: 0.62, ease: "elastic.out(1, 0.62)" }, 0)
      .to(knob, { scaleX: 1.35, duration: 0.16, ease: "power2.out" }, 0)
      .to(knob, { scaleX: 1, duration: 0.42, ease: "elastic.out(1, 0.5)" }, 0.16);

    return () => tl.kill();
  }, [lang]);

  // Recolocar si cambia el ancho de la ventana
  useEffect(() => {
    const onResize = () => {
      const wrap = wrapRef.current;
      const knob = knobRef.current;
      const active = wrap?.querySelector(`[data-lang="${lang}"]`);
      if (!wrap || !knob || !active) return;
      gsap.set(knob, { x: active.offsetLeft, width: active.offsetWidth });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [lang]);

  return (
    <div
      className="langtoggle"
      ref={wrapRef}
      role="group"
      aria-label={lang === "es" ? "Idioma" : "Language"}
    >
      <span className="langtoggle__knob" ref={knobRef} aria-hidden="true" />
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          data-lang={code}
          className="langtoggle__btn"
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
