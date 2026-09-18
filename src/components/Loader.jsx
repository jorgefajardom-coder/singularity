import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../lib/i18n";
import { gsap, prefersReducedMotion } from "../lib/anim";
import BlackHole from "./BlackHole";
import { useMusic } from "../lib/music";

// Dos cintas con extremos coincidentes: la junta se ilumina, nunca se abre.
// Las capas desplazadas hacia abajo dan espesor sin cargar otra escena WebGL.
const HALVES = [
  { code: "es", label: "ES", d: "M100 50 C77 35 58 17 37 19 C6 22 7 79 38 80 C59 81 79 64 100 50", cx: 44 },
  { code: "en", label: "EN", d: "M100 50 C122 34 145 8 165 15 C195 25 188 79 164 80 C144 83 122 64 100 50", cx: 157 },
];

const LAYERS = [
  { name: "edge", offset: 7 },
  { name: "edge", offset: 5 },
  { name: "edge", offset: 3 },
  { name: "rim", offset: 0 },
  { name: "face", offset: 0 },
  { name: "light", offset: -0.8 },
];

export default function Loader({ onWarm, onEnter, onDone, onReady }) {
  const { lang, setLang } = useLang();
  const { prepare } = useMusic();
  const root = useRef(null);
  const numRef = useRef(null);
  const formation = useRef(0);
  const [phase, setPhase] = useState("loading");

  const leaving = useRef(false);
  // La línea de tiempo se crea una vez; el ref mantiene fresco el callback.
  const enter = useRef(onEnter);
  enter.current = onEnter;
  const done = useRef(onDone);
  done.current = onDone;
  const warm = useRef(onWarm);
  warm.current = onWarm;

  // Todas las capas comparten el mismo progreso de trazado.
  const strokes = useMemo(() => ({ es: [], en: [] }), []);

  // Ocultar los trazos antes de pintar evita un destello de la figura completa.
  useLayoutEffect(() => {
    const all = [...strokes.es, ...strokes.en].filter(Boolean);
    if (all.length < 4) return;

    const lengths = new Map(all.map((el) => [el, el.getTotalLength()]));
    all.forEach((el) => {
      const L = lengths.get(el);
      el.style.strokeDasharray = `${L}`;
      el.style.strokeDashoffset = `${L}`;
    });

    if (prefersReducedMotion()) {
      all.forEach((el) => (el.style.strokeDashoffset = "0"));
      setPhase("choose");
      return;
    }

    const counter = { v: 0 };
    const tween = gsap.to(counter, {
      v: 100,
      duration: 2.2,
      ease: "power1.inOut",
      onUpdate() {
        const p = counter.v / 100;
        if (numRef.current) {
          numRef.current.textContent = String(Math.round(counter.v)).padStart(3, "0");
        }
        // Primero el bucle izquierdo, luego el derecho. Cada trazado
        // comienza y termina en el centro (M100 50), sin separar las piezas.
        const leftProgress = Math.min(1, p * 2);
        const rightProgress = Math.max(0, p * 2 - 1);
        strokes.es.forEach((el) => {
          el.style.strokeDashoffset = `${lengths.get(el) * (1 - leftProgress)}`;
        });
        strokes.en.forEach((el) => {
          el.style.strokeDashoffset = `${lengths.get(el) * (1 - rightProgress)}`;
        });
      },
      onComplete: () => setPhase("choose"),
    });

    return () => tween.kill();
  }, [strokes]);

  // Las juntas y las etiquetas aparecen manteniendo unida la silueta.
  useEffect(() => {
    if (phase !== "choose") return;

    if (prefersReducedMotion()) {
      gsap.set(root.current.querySelectorAll(".loader__label, .loader__hint, .loader__seams"), { opacity: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.to(".loader__num", { opacity: 0, scale: 0.85, duration: 0.3, ease: "power2.in" });
      tl.to(".loader__seams", { opacity: 1, duration: 0.5 }, 0.1);
      tl.to(".loader__label", { opacity: 1, duration: 0.45, stagger: 0.07 }, 0.25).to(
        ".loader__hint",
        { opacity: 1, duration: 0.45 },
        "<"
      );
    }, root);

    return () => ctx.revert();
  }, [phase]);

  useLayoutEffect(() => {
    if (phase !== "transforming") return;
    const mark = root.current.querySelector(".loader__mark");
    const hole = root.current.querySelector(".loader__singularity");
    formation.current=0;
    const ctx = gsap.context(() => {
      gsap.set(mark,{filter:"none"});
      gsap.set(hole,{opacity:1});
      gsap.set(".loader__label, .loader__seams",{opacity:0});
      const motion = {p:0};
      const transformDuration = 1.65;
      const timeline = gsap.timeline();
      timeline.to(motion,{
        p:1, duration:transformDuration, ease:"none",
        onUpdate() { formation.current=motion.p; },
        onComplete() { formation.current=1; },
      },0);
      // El ∞ del shader ya está debajo, en el mismo sitio y al mismo tamaño: al
      // apagar el del SVG no se ve un relevo, se ve cómo la figura se enciende.
      timeline.to(mark,{opacity:0,duration:0.18,ease:"power2.inOut"},0.10);
      // Preparar el portafolio desde el inicio y revelarlo durante el giro:
      // el fondo ya debe verse cuando el agujero termine de formarse.
      timeline.call(() => enter.current(), null, 0);
      timeline.to(root.current,{opacity:0,duration:transformDuration * 0.4,ease:"power2.inOut",
        onComplete:() => done.current()},transformDuration * 0.6);
    },root);
    return () => { ctx.kill(); formation.current=1; };
  },[phase]);

  useEffect(() => {
    if (phase === "transforming") onReady(true);
  },[phase,onReady]);

  // Mientras el visitante lee el selector no se anima nada, asi que es el
  // momento de pagar el coste de montar los lienzos del portafolio: quedan
  // detras del cargador, que los tapa por completo. `requestIdleCallback`
  // espera a que el hilo este libre para no estorbar a la entrada de las
  // etiquetas; el timeout garantiza que ocurra aunque nunca haya un hueco.
  useEffect(() => {
    if (phase !== "choose") return;
    const run = () => warm.current?.();
    if (typeof requestIdleCallback !== "function") {
      const t = setTimeout(run, 180);
      return () => clearTimeout(t);
    }
    const id = requestIdleCallback(run, { timeout: 600 });
    return () => cancelIdleCallback(id);
  }, [phase]);

  const choose = (code) => {
    if (phase !== "choose" || leaving.current) return;
    leaving.current = true;
    // Sin animación de cambio de idioma: el cargador tapa el sitio entero.
    setLang(code, { animate: false });
    void prepare();

    if (prefersReducedMotion()) {
      onReady(true);
      onEnter();
      onDone();
      return;
    }
    setPhase("transforming");
  };

  const onKey = (e, code) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(code);
    }
  };

  return (
    <div className="loader" ref={root} data-phase={phase}>
      {/* Se monta ya en la pantalla de selección, invisible: compilar este
          fragment shader cuesta varios fotogramas, y si el canvas arranca al
          pulsar, el SVG se apaga antes de que haya nada dibujado debajo. */}
      {(phase === "choose" || phase === "transforming") && <div className="loader__singularity">
        <BlackHole formation={formation} />
      </div>}
      <svg className="loader__mark" viewBox="0 0 205 105" role="group" aria-label={lang === "en" ? "Choose your language" : "Elige tu idioma"}>
        <defs>
          <clipPath id="loaderClip-es"><rect x="-20" y="-20" width="120" height="150" /></clipPath>
          <clipPath id="loaderClip-en"><rect x="100" y="-20" width="125" height="150" /></clipPath>
          <linearGradient id="loaderFace" gradientUnits="userSpaceOnUse" x1="15" y1="20" x2="190" y2="80">
            <stop offset="0%" stopColor="var(--accent-a)" />
            <stop offset="55%" stopColor="var(--accent-b)" />
            <stop offset="100%" stopColor="var(--accent-c)" />
          </linearGradient>
          <linearGradient id="loaderEdge" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="var(--accent-b)" />
            <stop offset="100%" stopColor="#3a0c02" />
          </linearGradient>
          <linearGradient id="loaderLight" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="48%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#2b0802" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {HALVES.map((half) => (
          <g
            key={half.code}
            className={`loader__half loader__half--${half.code}`}
            role={phase === "choose" ? "button" : undefined}
            tabIndex={phase === "choose" ? 0 : -1}
            aria-label={half.code === "es" ? "Español" : "English"}
            onClick={() => choose(half.code)}
            onKeyDown={(e) => onKey(e, half.code)}
          >
            {/* Zona de click amplia: el hueco del bucle también cuenta */}
            <ellipse className="loader__hit" cx={half.cx} cy="50" rx="43" ry="34" />

            <g clipPath={`url(#loaderClip-${half.code})`}>
            {LAYERS.map((layer, i) => (
              <path
                key={i}
                className={`loader__${layer.name}`}
                d={half.d}
                transform={`translate(0 ${layer.offset})`}
                ref={(el) => { strokes[half.code][i] = el; }}
              />
            ))}
            </g>

            <g className="loader__label" aria-hidden="true">
              <text x={half.code === "es" ? 48 : 154} y="47">{half.label}</text>
              <text className="loader__language-name" x={half.code === "es" ? 48 : 154} y="58" lang={half.code}>
                {half.code === "es" ? "Español" : "English"}
              </text>
            </g>
          </g>
        ))}
        <g className="loader__seams" aria-hidden="true">
          <path className="loader__joint" d="M100 42 L100 58" />
          <path className="loader__joint-glint" d="M101 42 L101 58" />
        </g>
      </svg>

      <div className="loader__feedback">
        <div className="loader__num" ref={numRef} aria-hidden="true">000</div>
        <p className="loader__hint">
          <span className="loader__hint-es" lang="es">Elige tu idioma</span>
          <span className="loader__hint-en" lang="en">Choose your language</span>
        </p>
      </div>
    </div>
  );
}
