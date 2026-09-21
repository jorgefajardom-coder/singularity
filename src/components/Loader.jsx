import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../lib/i18n";
import { gsap, prefersReducedMotion } from "../lib/anim";
import { heroBase } from "../lib/stagePose";
import { useMusic } from "../lib/music";

// El infinito es SVG y se dibuja sin tocar WebGL. El agujero negro llega
// despues, mientras el contador sube, para no bloquear el primer pintado.
const BlackHole = lazy(() => import("./BlackHole"));

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
  // Misma forma que el `journey` de Stage: el agujero del cargador termina de
  // formarse ya colocado donde esta el del hero, para que el fundido entre los
  // dos lienzos cruce dos imagenes identicas.
  const travel = useRef({ cx: 0, cy: 0, scale: 1, topDown: 0, fall: 0, lens: 1, p: 0 });
  const [phase, setPhase] = useState("loading");

  // En desarrollo, para poder congelar el morfo y mirarlo fotograma a
  // fotograma:  gsap.globalTimeline.pause(); window.formation.current = 0.4
  if (import.meta.env.DEV && typeof window !== "undefined") window.formation = formation;

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
      duration: 1.5,
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
    travel.current.cy = 0;
    travel.current.scale = 1;
    const ctx = gsap.context(() => {
      gsap.set(hole,{opacity:1});
      gsap.set(".loader__label, .loader__seams",{opacity:0});
      const motion = {p:0};

      // La cinta del shader ENTRA MIENTRAS la del SVG se apaga, no despues.
      // Antes habia un hueco de un cuarto de segundo entre las dos en el que
      // no se veia nada: el ∞ se quemaba, la pantalla se quedaba en negro y
      // aparecia otro ∞ de la nada. Aqui las dos figuras se solapan medio
      // segundo, con el mismo tamano y el mismo grosor de trazo, asi que lo
      // que se ve es una sola cinta cambiando de material.
      const MORPH_AT = 0.26;
      const MORPH_DUR = 1.72;
      // El cargador se retira con la figura ya practicamente formada y ya
      // colocada en la pose del hero (ver `travel`): lo de debajo es la misma
      // imagen, asi que el fundido no se nota.
      const LEAVE_AT = MORPH_AT + MORPH_DUR * 0.93;

      const timeline = gsap.timeline();

      // El SVG se va ardiendo, no desvaneciendose sin mas.
      timeline.fromTo(mark,
        { filter: "brightness(1) drop-shadow(0 0 0 rgba(255, 106, 18, 0))" },
        { filter: "brightness(2.6) drop-shadow(0 0 46px rgba(255, 120, 30, 0.95))",
          duration: 0.46, ease: "power2.in" },
        0);
      timeline.to(mark, { opacity: 0, duration: 0.34, ease: "power2.inOut" }, 0.30);

      const rest = heroBase();
      timeline.to(motion,{
        p:1, duration:MORPH_DUR, ease:"none",
        onUpdate() {
          formation.current = motion.p;
          // El viaje al sitio del hero empieza cuando la figura ya es un
          // anillo y termina antes que el fundido: si se movieran a la vez,
          // lo que se cruzaria son dos agujeros en distinto sitio.
          const settle = Math.min(1, Math.max(0, (motion.p - 0.44) / 0.41));
          const k = settle * settle * (3 - 2 * settle);
          travel.current.cy = rest.cy * k;
          travel.current.scale = 1 + (rest.scale - 1) * k;
        },
        onComplete() {
          formation.current = 1;
          travel.current.cy = rest.cy;
          travel.current.scale = rest.scale;
        },
      }, MORPH_AT);

      // Preparar el portafolio desde el inicio y revelarlo durante el giro:
      // el fondo ya debe verse cuando el agujero termine de formarse.
      timeline.call(() => enter.current(), null, 0);
      timeline.to(root.current,{opacity:0,duration:0.34,ease:"power2.inOut",
        onComplete:() => done.current()}, LEAVE_AT);
    },root);
    return () => { ctx.kill(); formation.current=1; };
  },[phase]);

  useEffect(() => {
    if (phase === "transforming") onReady(true);
  },[phase,onReady]);

  // Montar los lienzos del portafolio cuesta ~90 ms de hilo principal: son dos
  // contextos WebGL con sus shaders. Se pagan detras del cargador, que es
  // opaco y los tapa, y lo mas lejos posible de cualquier animacion:
  //
  //   - en `choose`, un poco despues de que hayan entrado las etiquetas. Sin
  //     ese retardo el tiron caia justo al terminar de dibujarse el infinito,
  //     que es lo que se estaba viendo.
  //   - si el visitante pulsa antes de que llegue ese momento, se montan ya en
  //     `transforming`. Esta rama NO es opcional: cancelar el aviso sin montar
  //     nada dejaba el hero sin agujero negro para quien eligiera rapido.
  useEffect(() => {
    if (phase === "transforming") {
      warm.current?.();
      return;
    }
    if (phase !== "choose") return;

    let idle = null;
    const run = () => warm.current?.();
    const timer = setTimeout(() => {
      if (typeof requestIdleCallback === "function") {
        idle = requestIdleCallback(run, { timeout: 500 });
      } else {
        run();
      }
    }, 900);

    return () => {
      clearTimeout(timer);
      if (idle !== null) cancelIdleCallback(idle);
    };
  }, [phase]);

  const choose = (code) => {
    if (phase !== "choose" || leaving.current) return;
    leaving.current = true;
    // Sin animación de cambio de idioma: el cargador tapa el sitio entero.
    setLang(code, { animate: false });
    void prepare();

    if (prefersReducedMotion()) {
      // Montar los lienzos AQUI tambien. Sin movimiento el selector sale de
      // inmediato —no hay contador de 1,5 s que esperar—, asi que lo normal
      // es pulsar antes de los 900 ms del aviso de mas abajo; y al salir este
      // componente se limpia ese temporizador. El resultado era que quien
      // pide menos movimiento se quedaba sin el agujero negro del hero y sin
      // el ViewCanvas entero, o sea sin ningun objeto 3D en toda la pagina.
      warm.current?.();
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
        <Suspense fallback={null}>
          <BlackHole formation={formation} journey={travel} />
        </Suspense>
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
