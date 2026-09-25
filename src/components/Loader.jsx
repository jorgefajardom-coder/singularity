import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../lib/i18n";
import { gsap, prefersReducedMotion } from "../lib/anim";
import { heroBase } from "../lib/stagePose";
import { MITADES } from "../lib/curvaInfinito";
import { useMusic } from "../lib/music";

// El infinito es SVG y se dibuja sin tocar WebGL. El agujero negro llega
// despues, mientras el contador sube, para no bloquear el primer pintado.
const BlackHole = lazy(() => import("./BlackHole"));

// El ∞ de los idiomas: el trazado original, compartido con el shader (que lo
// usa para que su cinta tape a esta punto por punto). Ver curvaInfinito.js.
// Las capas desplazadas hacia abajo dan espesor sin cargar otra escena WebGL.
const HALVES = MITADES;

const LAYERS = [
  { name: "edge", offset: 7 },
  { name: "edge", offset: 5 },
  { name: "edge", offset: 3 },
  { name: "rim", offset: 0 },
  { name: "face", offset: 0 },
  { name: "light", offset: -0.8 },
];

/**
 * EL ∞ DEL SVG TIENE QUE MEDIR LO MISMO QUE LA CINTA DEL SHADER.
 *
 * En el relevo se cruzan dos dibujos del mismo ∞: el de arriba es este SVG y
 * el de abajo lo traza el shader (ver `uFormation` en BlackHole.jsx). El SVG
 * medía `min(78vw, 560px)` —un ancho de hoja de estilos, sin relacion con el
 * otro— y la cinta del shader crece con el ALTO del viewport. Resultado: al
 * relevar, la figura pegaba un salto de tamaño. Medido: 1,64x en 1536x639 y
 * 2,67x en 1920x1080. No es un desajuste fino, es que son dos figuras.
 *
 * Aqui el SVG se planta con la formula del shader, que es la unica que hay:
 *
 *   semiancho en pantalla = (LEM_A * LENSE / CAM_DIST) * px por unidad
 *   px por unidad         = alto del viewport / (2 * zoom)
 *
 * El zoom es el mismo `clamp(1.85 / aspecto, 1, 2.2)` del shader. Sale que los
 * pixeles por unidad dependen solo del ALTO, no del ancho, porque el shader
 * escala x por el aspecto y eso se cancela. Si alguna de las tres constantes
 * cambia alli, tiene que cambiar aqui.
 */
const LEM_A = 10.4;
const LENSE = 3.0;
const CAM_DIST = 26.0;
const VB_W = 205;
const VB_H = 105;
// Lo mas ancho que se deja crecer al ∞. En un movil en vertical la cinta del
// shader se sale de la pantalla, y un selector de idioma con los dos bucles
// medio fuera del encuadre no se puede usar: alli se encoge el SVG y se aleja
// la cinta lo mismo, para que sigan midiendo igual (ver `arranque`).
const MARGEN = 0.94;

export default function Loader({ onWarm, onEnter, onDone, onReady, espejo }) {
  const { lang, setLang } = useLang();
  const { prepare } = useMusic();
  const root = useRef(null);
  const numRef = useRef(null);
  const formation = useRef(0);
  // Misma forma que el `journey` de Stage: el agujero del cargador termina de
  // formarse ya colocado donde esta el del hero, para que el fundido entre los
  // dos lienzos cruce dos imagenes identicas.
  // `oculto`: en el selector este lienzo es invisible y no pinta (solo compila
  // y deja dos fotogramas hechos). `cubre`: el cargador, opaco, tapa al hero,
  // que tampoco pinta. Ver el ultimo useFrame de BlackHole.jsx.
  const travel = useRef({ cx: 0, cy: 0, scale: 1, topDown: 0, fall: 0, lens: 1, p: 0, oculto: true, cubre: true });
  const [phase, setPhase] = useState("loading");
  // A que escala arranca el agujero del cargador. Es 1 salvo cuando el ∞ no
  // cabe a su tamaño natural y hay que encogerlo: entonces la cinta del shader
  // tiene que salir encogida exactamente lo mismo.
  const arranque = useRef({ scale: 1 });

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

  /**
   * Plantar el ∞ donde y como lo va a dibujar el shader.
   *
   * Dos cosas, y las dos hacen falta para que el relevo no se note:
   *
   *   TAMAÑO  el ancho sale de la formula de arriba, no de la hoja de estilos.
   *   CENTRO  la curva NO esta centrada en su propio viewBox: la linea media va
   *           de 14,2 a 184,9 en x y de 13,8 a 80,3 en y, o sea centro
   *           (99,6 / 47,1) y no (102,5 / 52,5). El elemento quedaba centrado
   *           en pantalla pero la figura no, y el shader dibuja la suya
   *           centrada de verdad: sobraban 9 px en x y 11 en y.
   *
   * La curva se mide con getBBox en vez de meter esos numeros a mano, asi que
   * sigue cuadrando aunque algun dia se redibuje el trazo.
   */
  useLayoutEffect(() => {
    const svg = root.current?.querySelector(".loader__mark");
    if (!svg) return undefined;

    const encajar = () => {
      const trazos = svg.querySelectorAll(".loader__rim");
      if (!trazos.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      trazos.forEach((t) => {
        const b = t.getBBox();
        x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
        x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
      });
      if (!(x1 > x0)) return;

      const alto = window.innerHeight;
      const aspecto = window.innerWidth / Math.max(alto, 1);
      const zoom = Math.min(2.2, Math.max(1, 1.85 / Math.max(aspecto, 0.35)));
      const semiancho = (LEM_A * LENSE / CAM_DIST) * (alto / (2 * zoom));

      // Del ancho de la CURVA al del ELEMENTO, que lleva margen a los lados.
      const ideal = semiancho * 2 * (VB_W / (x1 - x0));
      const ancho = Math.min(ideal, window.innerWidth * MARGEN);
      svg.style.width = `${ancho.toFixed(1)}px`;
      // Y si ha habido que encogerlo, el agujero sale encogido lo mismo.
      // `uScale` MULTIPLICA las coordenadas del shader, asi que un valor MAYOR
      // aleja y achica.
      arranque.current.scale = ideal / ancho;

      // La correccion de que la curva no este en el centro del viewBox.
      const k = ancho / VB_W;
      const dx = (VB_W / 2 - (x0 + x1) / 2) * k;
      const dy = (VB_H / 2 - (y0 + y1) / 2) * k;
      svg.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    };

    encajar();
    // Las fuentes no le afectan; el tamaño de la ventana si.
    window.addEventListener("resize", encajar);
    return () => window.removeEventListener("resize", encajar);
  }, []);

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
    travel.current.oculto = false;
    // Mientras el cargador sea opaco tapa al lienzo del hero, que entonces no
    // se pinta (ver `cubre` en BlackHole.jsx). Se baja antes de irse.
    travel.current.cubre = true;
    // A la escala a la que se esta viendo el ∞, que en pantallas estrechas no
    // es 1 (ver `encajar`). Arrancando siempre en 1, la cinta del shader salia
    // mas grande que el SVG justo en el fotograma del relevo.
    const salida = arranque.current.scale;
    travel.current.scale = salida;
    const ctx = gsap.context(() => {
      gsap.set(hole,{opacity:1});
      // Las etiquetas y la junta se desvanecen: quitarlas de golpe era un
      // salto a la vista en el primer fotograma.
      const motion = {p:0};

      /**
       * La transformacion de la primera version de la intro (b515bf3), la que
       * Jorge eligio el 24-09-2026 como base. Va en tres tiempos, y el orden
       * es lo que la hace leerse como una transformacion y no como un cambiazo:
       *
       *   RELEVO  el ∞ del SVG se apaga. Debajo, en el mismo sitio y con la
       *           misma forma, ya esta el ∞ del shader: la figura parece
       *           cambiar de material, no ser sustituida.
       *   MORPH   el horizonte se abre en el cruce del ∞ y la figura se
       *           cierra en anillo, se tumba y se hace el agujero del hero.
       */
      // Sin respiro quieto entre el quemado y el morfo (Jorge: "no me dejes
      // frames congelados"): la figura empieza a transformarse en cuanto el
      // SVG empieza a apagarse encima.
      const MORPH_DUR = 1.8;
      const MORPH_AT = 0;
      // El cargador se retira con la figura ya practicamente formada y ya
      // colocada en la pose del hero (ver `travel`): lo de debajo es la misma
      // imagen, asi que el fundido no se nota.
      const LEAVE_AT = MORPH_AT + MORPH_DUR * 0.93;

      const timeline = gsap.timeline();
      // En desarrollo, para poder llevar la intro a un instante concreto:
      //   window.__intro.pause().time(1.2)
      if (import.meta.env.DEV) window.__intro = timeline;

      // Sin quemado: el SVG ya no se aclara ni echa resplandor antes del
      // relevo (Jorge, 24-09-2026: "quitale el brillo antes del shader").
      // Debajo esta la misma cinta con la misma forma, asi que basta con que
      // se apague encima.
      // La cinta del shader arranca con el mismo acabado que este SVG, capa
      // por capa (esmalteSVG en BlackHole.jsx): el SVG se retira enseguida
      // sobre una copia identica, y el cambio no se ve.
      timeline.to(".loader__label, .loader__seams", { opacity: 0, duration: 0.28, ease: "power1.out" }, 0);
      timeline.to(mark, { opacity: 0, duration: 0.15, ease: "none" }, 0.05);

      const rest = heroBase();
      timeline.to(motion,{
        p:1, duration:MORPH_DUR, ease:"none",
        onUpdate() {
          formation.current = motion.p;
          // El viaje al sitio del hero va en la segunda mitad del morfo y
          // termina antes que el fundido: si se movieran a la vez, lo que se
          // cruzaria son dos agujeros en distinto sitio.
          const settle = Math.min(1, Math.max(0, (motion.p - 0.44) / 0.41));
          const k = settle * settle * (3 - 2 * settle);
          travel.current.cy = rest.cy * k;
          travel.current.scale = salida + (rest.scale - salida) * k;
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
      // Unos fotogramas antes del fundido el hero vuelve a pintar, para que al
      // asomar tenga ya la imagen de este instante y no la de hace un segundo.
      timeline.call(() => { travel.current.cubre = false; }, null, LEAVE_AT - 0.12);
      timeline.to(root.current,{opacity:0,duration:0.34,ease:"power2.inOut",
        onComplete:() => done.current()}, LEAVE_AT);
    },root);
    return () => { ctx.kill(); formation.current=1; travel.current.cubre = false; };
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
          <BlackHole formation={formation} journey={travel} espejo={espejo} espejoModo="publica" />
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
