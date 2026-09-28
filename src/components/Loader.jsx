import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../lib/i18n";
import { gsap, prefersReducedMotion } from "../lib/anim";
import { REPOSO_MEDIDO, recalcularHeroBase } from "../lib/stagePose";
import { MITADES } from "../lib/curvaInfinito";
import { precargarPista, useMusic } from "../lib/music";
import { gpuFallo, useGpuFallo } from "../lib/gpu";

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

/**
 * SIN GPU la transformacion va en CSS, sin lienzo propio.
 *
 * La transformacion del ∞ al agujero es el shader, tambien en el telefono
 * (Jorge, 26-09-2026: el disco CSS "se ve horrible" y la transicion es la
 * pieza). Solo quien no tiene GPU —o la tiene por software, ver lib/gpu.js—
 * ve el ∞ apagarse sobre un disco CSS que crece hasta el sitio y el tamano del
 * agujero del hero.
 *
 * RADIO_UV es el radio del disco en coordenadas del shader (medido sobre el
 * agujero del hero), para que el disco CSS termine del mismo tamano.
 */
const RADIO_UV = 0.62;
// Lo mas que se espera al lienzo del cargador tras pulsar (ver `preparado`).
const ESPERA_MAX = 3500;
const SOMBRA_CY = 0.074;

// Cuanto vale cada hito del porcentaje (suman 100). Los lienzos pesan mas:
// compilar el shader es lo que mas tarda en una grafica integrada.
const PESOS = { fuentes: 10, pagina: 10, codigo: 20, lienzo: 30, hero: 25, musica: 5 };
// Lo mas rapido que sube el numero: de 0 a 100 en no menos de 1,5 s.
const VELOCIDAD_MAX = 100 / 1.5;
// Lo mas que se espera a la carga antes de dejar elegir idioma igualmente.
// Con la CPU de un telefono flojo (emulada a 6x) todo llega a los ~11 s.
const TOPE_CARGA = 20000;
// Lo mas que se espera, tras elegir idioma, a que el sitio se asiente (ver
// `asentar`) antes de arrancar la transformacion.
const ASENTAR_MAX = 2500;

export default function Loader({ onWarm, onEnter, onDone, onReady, onMorph, espejo, heroListo = false }) {
  const disco = useRef(null);
  const sinGpu = useGpuFallo();
  // El lienzo del cargador no llego a tiempo (ver `choose`): esta intro va
  // con el disco CSS, como sin GPU, en vez de apagar el ∞ sobre un negro.
  const [cssPorTiempo, setCssPorTiempo] = useState(false);
  const cssAhora = sinGpu || cssPorTiempo;
  // Se decide en el momento: la GPU puede darse por caida mientras se elige
  // idioma (el lienzo del cargador ya esta montado y la comprueba).
  const cssRef = useRef(cssAhora);
  cssRef.current = cssAhora;
  const introCss = () => gpuFallo() || cssRef.current;
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
  const morph = useRef(onMorph);
  morph.current = onMorph;

  // Todas las capas comparten el mismo progreso de trazado.
  const strokes = useMemo(() => ({ es: [], en: [] }), []);

  /**
   * EL PORCENTAJE ES LA CARGA DEL SITIO, NO UN ADORNO.
   *
   * Antes era una animacion fija de 1,5 s: llegaba a 100 con el 3D sin
   * descargar y los lienzos se montaban despues, detras del selector. Ahora
   * todo empieza a cargar en cuanto aparece el cargador y el ∞ no se cierra
   * hasta que lo que hay detras esta hecho (Jorge, 26-09-2026):
   *   fuentes, la pagina (hojas e imagenes), el codigo 3D, el lienzo del
   *   agujero del cargador y el del hero, los dos compilados, pintando y
   *   comprobados (`onPintado`, fotograma 6: la comprobacion lee pixeles y
   *   para la GPU, asi que tiene que ocurrir aqui y no en la transicion).
   * Los lienzos van uno detras de otro (ver `warm` mas abajo): compilando el
   * mismo shader a la vez se quitaban la GPU.
   *
   * TOPE_CARGA es la red de seguridad: un hito que no llega nunca (un lienzo
   * que falla dentro de su Aislado) no deja a nadie atrapado en el cargador.
   */
  const hitos = useRef({ fuentes: false, pagina: false, codigo: false, lienzo: false, hero: false, musica: false });
  const progresoReal = () => {
    let total = 0;
    for (const [k, peso] of Object.entries(PESOS)) if (hitos.current[k]) total += peso;
    return total;
  };
  const marcar = (k) => {
    if (hitos.current[k]) return;
    hitos.current[k] = true;
    if (import.meta.env.DEV) console.info(`[carga] ${k} ${Math.round(performance.now())} ms`);
    // Para medir en un telefono de verdad (tambien en produccion): cuando
    // llego cada hito, en ms desde la navegacion.
    if (typeof window !== "undefined") (window.__cargaHitos ??= {})[k] = Math.round(performance.now());
  };

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
      // Y el lienzo, desde YA. En el selector compila oculto y deja hechos un
      // par de fotogramas: con la escala por defecto (1) esos fotogramas son
      // un ∞ MAS GRANDE que el SVG, y en un telefono lento se veian al
      // destaparse el lienzo, hasta que llegaba el primero bueno: dos ∞ a la
      // vez durante ~0,7 s (video de Jorge, 27-09-2026).
      if (travel.current.oculto) travel.current.scale = arranque.current.scale;

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

    const pintar = (v) => {
      const p = v / 100;
      if (numRef.current) {
        numRef.current.textContent = String(Math.floor(v)).padStart(3, "0");
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
    };

    // El numero persigue a la carga REAL (`objetivo`, ver `hitos`) sin
    // adelantarla nunca, y como mucho a VELOCIDAD_MAX: con todo en cache
    // el ∞ se sigue dibujando entero en vez de aparecer de golpe.
    let mostrado = 0;
    const avanzar = (_t, dt) => {
      const objetivo = progresoReal();
      if (mostrado >= objetivo) return;
      mostrado = Math.min(objetivo, mostrado + (VELOCIDAD_MAX * dt) / 1000);
      pintar(mostrado);
      if (mostrado >= 100) {
        gsap.ticker.remove(avanzar);
        setPhase("choose");
      }
    };
    gsap.ticker.add(avanzar);

    return () => gsap.ticker.remove(avanzar);
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

    // Al pulsar la cinta (`esperando`) solo se para: deshacerla devolvia de
    // golpe las etiquetas a su estado inicial (~50 ms de estilos en el toque
    // de un telefono) y el fundido de retirada de `esperando` no llegaba a
    // verse. Ese efecto las lleva a 0 desde donde esten.
    return () => (fase.current === "esperando" ? ctx.kill() : ctx.revert());
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
    // Sin lienzo aqui nadie publica el espejo: el del hero lee `cubre` de
    // este objeto (y nada mas, no hay reloj que copiar).
    if (introCss() && espejo) espejo.current = travel.current;
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

      // Medido ahora, con el hero ya montado debajo, las fuentes puestas y el
      // titular ya en el idioma elegido. Stage tiene que enterarse: su pose
      // se calculo durante la carga, con el titular en el otro idioma (254
      // px contra 287 en 390x844), y el agujero acababa la intro corrido.
      const rest = recalcularHeroBase();
      window.dispatchEvent(new Event(REPOSO_MEDIDO));
      if (introCss() && disco.current) {
        // El mismo recorrido que el agujero del shader: nace en el cruce del
        // ∞ y, en la segunda mitad, baja a su sitio de reposo en el hero.
        const alto = window.innerHeight;
        const aspecto = window.innerWidth / Math.max(alto, 1);
        const zoom = Math.min(2.2, Math.max(1, 1.85 / Math.max(aspecto, 0.35)));
        const pxPorUnidad = alto / (2 * zoom);
        const radio = (RADIO_UV / rest.scale) * pxPorUnidad;
        // La sombra del agujero no cae en `cy`: la camara lo mira un poco
        // desde arriba y la sombra sale mas alta. Medido en 375x812: 0,074
        // de media pantalla por encima.
        const bajada = (rest.cy + SOMBRA_CY) * pxPorUnidad * zoom;
        const plano = disco.current.querySelector(".loader__disco-plano");
        gsap.set(disco.current, { width: radio * 2, height: radio * 2, xPercent: -50, yPercent: -50, scale: 0.08, opacity: 0, y: 0 });
        gsap.set(plano, { xPercent: -50, yPercent: -50, x: 0, y: 0, opacity: 0, scaleX: 0.3 });
        timeline.to(disco.current, { opacity: 1, duration: MORPH_DUR * 0.3, ease: "power1.out" }, MORPH_AT + 0.05);
        timeline.to(disco.current, { scale: 1, duration: MORPH_DUR * 0.8, ease: "power2.inOut" }, MORPH_AT + 0.05);
        timeline.to(disco.current, { y: -bajada, duration: MORPH_DUR * 0.41, ease: "power1.inOut" }, MORPH_AT + MORPH_DUR * 0.44);
        // El anillo se tumba: aparece el disco plano que cruza la sombra,
        // como en el agujero del hero.
        timeline.to(plano, { opacity: 1, scaleX: 1, duration: MORPH_DUR * 0.45, ease: "power2.out" }, MORPH_AT + MORPH_DUR * 0.48);
      }
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

      // El portafolio ya entro al elegir idioma (ver `asentado`): aqui solo
      // se revela durante el giro, y sus animaciones arrancan ahora.
      timeline.call(() => morph.current?.(), null, 0);
      // Unos fotogramas antes del fundido el hero vuelve a pintar, para que al
      // asomar tenga ya la imagen de este instante y no la de hace un segundo.
      timeline.call(() => { travel.current.cubre = false; }, null, LEAVE_AT - 0.12);
      timeline.to(root.current,{opacity:0,duration:0.34,ease:"power2.inOut",
        onComplete:() => done.current()}, LEAVE_AT);
    },root);
    return () => { ctx.kill(); formation.current=1; travel.current.cubre = false; };
  },[phase]);

  // "Listo" es el agujero PINTADO, no la fase: lo avisa el lienzo tras
  // compilar y comprobar sus primeros fotogramas (ver `onPintado` en
  // BlackHole.jsx). Sin lienzo en el cargador, lo que hay es el disco CSS.
  const pintado = useRef(false);
  const fase = useRef(phase);
  fase.current = phase;
  const listoRef = useRef(onReady);
  listoRef.current = onReady;
  const avisarPintado = useMemo(() => () => {
    pintado.current = true;
    marcar("lienzo");
    if (fase.current === "transforming") listoRef.current(true);
  }, []);

  /**
   * ¿Se puede ENSENAR ya el lienzo del cargador? Compilado y con sus dos
   * primeros fotogramas hechos (ver `onPreparado` en BlackHole.jsx).
   *
   * La transformacion no arranca hasta entonces. Antes arrancaba al pulsar el
   * idioma pasara lo que pasara, y si se pulsaba rapido —o con una grafica
   * integrada, que tarda 0,5-3 s en compilar el shader, o con la red lenta y
   * el chunk de three sin llegar— el ∞ del SVG se apagaba sobre un lienzo que
   * aun no pintaba: un segundo de negro y el hero de golpe, sin
   * transformacion (medido: pulsando al aparecer el selector, en escritorio,
   * negro de 0,25 a 1 s y ningun lienzo en el cargador). Ahora el ∞ se queda
   * en pantalla —las etiquetas se retiran, que es la respuesta al clic— hasta
   * que el lienzo esta, y si no llega en ESPERA_MAX la intro sigue con el
   * disco CSS.
   */
  const preparado = useRef(false);

  /**
   * TRAS ELEGIR IDIOMA, EL SITIO SE PREPARA ANTES DE LA TRANSFORMACION.
   *
   * Cambiar de idioma y entrar (`enter`) re-renderiza la pagina entera y
   * arranca las animaciones del hero: ~0,6 s de hilo principal en un telefono
   * (perfilado con la CPU a 4x). Se hacia en el primer instante del morfo, y
   * el morfo —que va por tiempo— salia en 9-11 fotogramas en vez de ~110:
   * "la transicion en celular no carga como deberia" (Jorge, 26-09-2026).
   * Ahora se entra al pulsar, con el ∞ quieto en pantalla (las etiquetas se
   * retiran, que es la respuesta al clic), y el morfo arranca cuando el
   * navegador vuelve a dar fotogramas seguidos, o a los ASENTAR_MAX.
   */
  const asentado = useRef(false);
  const seguir = () => {
    if (fase.current === "esperando" && asentado.current && (introCss() || preparado.current)) setPhase("transforming");
  };
  const avisarPreparado = useMemo(() => () => {
    preparado.current = true;
    // Para las pruebas y para medir en produccion cuanto tarda (ms).
    if (typeof window !== "undefined") window.__introPreparado = performance.now();
    // El agujero del cargador ya esta compilado: le toca al del hero, que
    // compila el mismo shader y a la vez le quitaba la GPU.
    warm.current?.();
    seguir();
  }, []);

  // Los hitos de la carga (ver `hitos`). Todo arranca con el cargador.
  useEffect(() => {
    let vivo = true;
    const si = (k) => () => { if (vivo) marcar(k); };
    if (document.fonts?.ready) document.fonts.ready.then(si("fuentes"), si("fuentes"));
    else marcar("fuentes");
    if (document.readyState === "complete") marcar("pagina");
    else window.addEventListener("load", si("pagina"), { once: true });
    // El codigo de los lienzos: el agujero (que trae three y r3f) y el lienzo
    // compartido de las vistas 3D de mas abajo, que asi ya esta descargado
    // cuando le llegue el turno.
    Promise.all([import("./BlackHole"), import("../three/ViewCanvas")]).then(si("codigo"), si("codigo"));
    // La pista suena al pulsar la cinta: tiene que estar ya decodificada. Si
    // falla, no bloquea (el reproductor deja reintentar).
    precargarPista().then(si("musica"), si("musica"));
    const tope = setTimeout(() => {
      if (!vivo) return;
      if (import.meta.env.DEV) console.warn("[carga] tope alcanzado", { ...hitos.current });
      Object.keys(PESOS).forEach(marcar);
    }, TOPE_CARGA);
    return () => { vivo = false; clearTimeout(tope); };
  }, []);
  // Sin GPU no hay lienzos que esperar: el hero entra igual (con su respaldo).
  useEffect(() => {
    if (!sinGpu) return;
    marcar("lienzo");
    marcar("hero");
    warm.current?.();
  }, [sinGpu]);
  useEffect(() => { if (heroListo) marcar("hero"); }, [heroListo]);
  useEffect(() => {
    if (phase !== "esperando") return undefined;
    let vivo = true;
    const ctx = gsap.context(() => {
      // El contador tambien: al dejar `choose` se deshace su animacion y el
      // "100" volvia a asomar.
      gsap.set(".loader__num", { opacity: 0 });
      gsap.to(".loader__label, .loader__seams, .loader__hint", { opacity: 0, duration: 0.28, ease: "power1.out" });
    }, root);
    // Asentado: tres fotogramas seguidos a menos de 40 ms (el re-render y las
    // animaciones que arranca `enter` ya han pasado).
    const ini = performance.now();
    let prev = ini, buenos = 0, raf = 0;
    const paso = (t) => {
      if (!vivo) return;
      buenos = t - prev < 40 ? buenos + 1 : 0;
      prev = t;
      if (buenos >= 3 || t - ini > ASENTAR_MAX) {
        asentado.current = true;
        seguir();
      } else raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    // Si el lienzo del cargador no llega, la intro sigue con el disco CSS.
    const tope = preparado.current || sinGpu ? 0 : setTimeout(() => {
      cssRef.current = true;
      setCssPorTiempo(true);
      seguir();
    }, ESPERA_MAX);
    return () => { vivo = false; cancelAnimationFrame(raf); clearTimeout(tope); ctx.revert(); };
  }, [phase, sinGpu]);
  useEffect(() => {
    if (phase === "transforming" && (introCss() || pintado.current)) onReady(true);
  },[phase,onReady]);
  useEffect(() => () => { if (introCss() && espejo) espejo.current = null; }, [espejo]);

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
    // Esperando al lienzo del cargador NO se montan los del hero: compilan el
    // mismo shader a la vez y le quitaban la GPU justo al que se espera (con
    // la cache de shaders vacia, primera visita: 2,2 s de espera en vez de
    // ~1,4). Se montan al arrancar la transformacion, como cuando se pulsa
    // antes del aviso de abajo.
    if (phase === "esperando") return;
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
    // Se entra YA, con el ∞ quieto delante (ver `asentado`).
    enter.current();
    setPhase("esperando");
  };

  const onKey = (e, code) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(code);
    }
  };

  return (
    <div className="loader" ref={root} data-phase={phase}>
      {/* Se monta desde el primer fotograma, invisible: compilarlo es parte
          de la carga que cuenta el porcentaje, y si el canvas arranca al
          pulsar, el SVG se apaga antes de que haya nada dibujado debajo. */}
      <div className="loader__singularity">
        {cssAhora ? (
          <div className="loader__disco" ref={disco} aria-hidden="true">
            <span className="loader__disco-sombra" />
            <span className="loader__disco-plano" />
          </div>
        ) : (
          <Suspense fallback={<div className="blackhole__fallback" />}>
            <BlackHole formation={formation} journey={travel} espejo={espejo} espejoModo="publica" onPintado={avisarPintado} onPreparado={avisarPreparado} />
          </Suspense>
        )}
      </div>
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
