import { Suspense, lazy, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { services, workAreas } from "../data/content";

// DIFERIDO, y no es un detalle de estilo. Halo cuelga de una cadena
// totalmente estatica —Halo <- Meditation <- Stage <- App—, asi que un
// `import` normal aqui mete BlackHole ENTERO dentro del chunk de arranque, y
// con el three (704 kB) y r3f (298 kB): `index.html` pasa a precargarlos y el
// cargador vuelve a tardar en pintarse, que es justo lo que se arreglo en su
// dia (ver los comentarios de App.jsx y de vite.config.js).
//
// Vite lo avisa, pero solo como WARNING —"dynamic import will not move module
// into another chunk"— y el build pasa igual. Si vuelve a aparecer en la
// salida de `vite build`, o si `dist/index.html` vuelve a listar `three`, es
// que alguien deshizo esto.
const BlackHole = lazy(() => import("./BlackHole"));
import { useLang } from "../lib/i18n";
import { prefersReducedMotion, scroller } from "../lib/anim";
import { EnSuTurno } from "../lib/arranque";
import { useTelefono } from "../lib/telefono";

/**
 * El sistema que orbita al personaje que medita.
 *
 * Un cuerpo por AREA de trabajo, y cada area son varios de los catorce
 * servicios. No se pierde ninguno: el area lleva la lista y al entrar a un
 * cuerpo se lee entera. Agrupar no es quitar, es dejar de pedirle a quien mira
 * que lea catorce rotulos girando a la vez.
 *
 * Las areas no duplican ni un servicio: viven en `content.js` como una lista
 * de claves —`services: ["web", "packaging"]`— que apunta a los servicios de
 * siempre. Cambiar un titulo alla lo cambia aqui solo.
 *
 * Los anillos interiores van vacios a proposito: son los que caen detras de la
 * cabeza y los que dan el aire entre el pelo y el primer cuerpo. Los cuerpos
 * se reparten por los tres de fuera y por la mitad de ARRIBA del sistema, que
 * es donde hay pantalla libre; abajo esta el busto.
 *
 * Lo unico que toca JavaScript es el zoom, y solo en el momento del clic.
 */

/** Diametros relativos: aureola compacta y seis orbitas concentricas. */
const RINGS = [0.28, 0.41, 0.52, 0.63, 0.74, 0.84, 0.95];

/**
 * Lo que se le pasa a cada agujero del halo en vez del viaje por la pagina.
 *
 *  · `isolation: 1` apaga el campo de estrellas del shader y deja el fondo
 *    TRANSPARENTE (ver `uIsolation` en BlackHole.jsx). Sin esto cada cuerpo
 *    era un rectangulo negro con su propio cielo estrellado pegado encima del
 *    de la pagina, recortado sobre el fondo. Es el mismo interruptor que usa
 *    el agujero que aterriza en las manos del astronauta.
 *  · `scale` es cuanto se aleja la camara: MENOS es mas grande. Tiene que
 *    dejar el disco ENTERO dentro de la caja cuadrada del boton, porque el
 *    lienzo la recorta: mas cerca, el disco se salia por los lados y con el
 *    zoom puesto se veia el canto recto del lienzo cruzando la pantalla. Y
 *    ademas tiene que dejar sitio LIBRE alrededor: ahi es donde van los
 *    anillos de las herramientas, y con el disco mas cerca los de dentro le
 *    caian encima.
 *  · `topDown: 1` sube la camara del plano ecuatorial —de canto, que es como
 *    se ha visto un agujero negro toda la vida— a ochenta grados, o sea casi
 *    en vertical. Desde ahi el disco se lee como un SISTEMA, con sus orbitas
 *    alrededor. De canto se ve como se ha visto un agujero negro toda la
 *    vida; desde arriba se ve el sistema.
 *
 * Es un objeto fijo y compartido por los seis: el shader solo lo lee.
 */
const CUERPO = { current: { isolation: 1, scale: 1.34, cy: 0, cx: 0, topDown: 1, faceOn: true, lens: 0 } };

/**
 * Tope de resolucion del lienzo ampliado.
 *
 * Con el zoom, la caja de 94 px se ve a 735: el lienzo tiene que pintarse a
 * ocho veces su caja para salir nitido. Mas de ahi no se gana nada —ya es
 * tamano real— y se paga en pixeles por fotograma.
 */
const DPR_MAX = 8;

/**
 * Cuanto se estira el borde exterior del disco, y cuanto se calienta su parte
 * interna hacia el blanco.
 *
 * El tamano de la SOMBRA no es un ajuste: sale de las geodesicas, es el radio
 * de captura de los fotones y no hay parametro que lo encoja. Lo que si se
 * puede es hacer el disco mas grande a su alrededor, y entonces el nucleo se
 * lee pequeno, que es lo que se pedia.
 *
 * `DISCO` decide la PROPORCION entre la sombra y el disco; el `scale` de
 * CUERPO, el tamano del conjunto en pantalla. Son dos cosas distintas y por
 * eso hay dos numeros: estirando solo el disco, el nucleo encoge pero el
 * agujero entero crece y se sale de su caja; alejando solo la camara, encoge
 * todo por igual y la sombra sigue ocupando lo mismo. Aqui el disco se estira
 * 2.8 veces —de ahi el nucleo pequeno— y la camara se ajusta hasta que el
 * conjunto vuelve a llenar la pantalla al ampliarlo.
 *
 * `BLANCO` sube el pico de la rampa al blanco. Solo la parte caliente —la de
 * dentro—, para que el filo brille en blanco y el disco conserve el color del
 * area hacia fuera; blanqueandolo entero, los seis saldrian iguales.
 */
const DISCO = 2.8;
const BLANCO = 0.8;

/**
 * Cuanto del lado corto del marco ocupa el cuerpo una vez ampliado.
 *
 * Pasa de 1: el agujero INUNDA la pantalla y se sale por los lados, que es
 * como se ve uno cuando se esta dentro. Quedandose por debajo de 1 se leia
 * como una ficha centrada con aire alrededor, y lo que se quiere es que ya no
 * haya nada mas.
 */
const ZOOM_FILL = 1.15;

const BY_ID = new Map(services.map((s) => [s.id, s]));
const AREAS = workAreas.map((area) => ({
  ...area,
  // Se resuelve al cargar el modulo, no en cada pintada: son seis listas fijas.
  items: area.services.map((key) => BY_ID.get(key)).filter(Boolean),
}));
const LAST_REVEAL = AREAS.reduce((last, area) => area.ring > last.ring ? area : last);

export default function Halo() {
  const { tr } = useLang();
  const labelId = useId();
  const root = useRef(null);
  const refs = useRef({});
  const [drawn, setDrawn] = useState(false);
  const [formed, setFormed] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [focus, setFocus] = useState(null);
  const anchored = deploying || Boolean(focus);
  // La escala del acercamiento, que tambien es la resolucion que necesita el
  // lienzo del cuerpo ampliado para no verse a escalones.
  const [zoom, setZoom] = useState(1);
  const reduced = prefersReducedMotion();
  // En el telefono los seis cuerpos no abren cada uno su lienzo WebGL: son
  // seis compilaciones del shader mas pesado de la pagina y seis contextos,
  // y en Android sumados a los demas pasaban el tope del navegador, que
  // suelta primero los mas viejos (el del hero). Ahi van pintados en CSS.
  const telefono = useTelefono();

  // Activa la apertura de los anillos y, despues, el destello de los cuerpos.
  useEffect(() => {
    if (reduced) {
      setDrawn(true);
      setFormed(true);
      return undefined;
    }
    const node = root.current;
    if (!node) return undefined;
    const portrait = node.closest(".meditation__portrait");
    let inView = false;
    let started = false;
    let goingUp = false;
    let lastY = window.scrollY;
    const sync = () => {
      if (document.body.classList.contains("is-anchored")) return;
      if (goingUp) {
        if (started) {
          started = false;
          setDrawn(false);
        }
        return;
      }
      if (started) return;
      // Stage escribe la opacidad durante el viaje. La interseccion por si
      // sola tambien detecta el halo cuando el retrato sigue invisible.
      const opacity = portrait ? Number(getComputedStyle(portrait).opacity) : 1;
      const bounds = portrait?.getBoundingClientRect();
      // Espera a la pose de reposo, no al fundido, que termina antes de que
      // llegue el cuerpo completo. En reposo el borde de abajo de la caja SIN
      // su `translateY` (`--retrato-y`, ver el CSS) toca el del viewport. Con
      // el busto eran un 11 % hacia abajo, fijo aqui como 0.89; con la figura
      // entera la caja va subida y ese numero ya no llegaba nunca.
      const ty = portrait
        ? (parseFloat(getComputedStyle(portrait).getPropertyValue("--retrato-y")) || 0) / 100 : 0;
      const waist = bounds ? bounds.top + bounds.height * (1 - ty) : Infinity;
      const atWaist = waist <= window.innerHeight + 1 && waist >= window.innerHeight - 2;
      // La aureola permanece; los aros se despliegan de nuevo al bajar.
      if (inView && opacity >= 0.99 && atWaist) {
        started = true;
        setDeploying(true);
        setDrawn(true);
        setFormed(true);
      }
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (document.body.classList.contains("is-anchored")) {
        lastY = y;
        return;
      }
      if (Math.abs(y - lastY) < 3) return;
      goingUp = y < lastY;
      lastY = y;
      sync();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting && entry.intersectionRatio >= 0.2;
        sync();
      },
      { threshold: 0.2 }
    );
    const visibility = new MutationObserver(sync);
    if (portrait) visibility.observe(portrait, { attributes: true, attributeFilter: ["style"] });
    observer.observe(node);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      visibility.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [reduced]);

  // El fin real de la animacion libera el scroll. Este respaldo evita que
  // una animacion cancelada deje la pagina bloqueada; usa los tiempos del CSS.
  useEffect(() => {
    if (!deploying) return undefined;
    if (reduced) {
      setDeploying(false);
      return undefined;
    }
    const last = refs.current[LAST_REVEAL.id];
    if (!last) { setDeploying(false); return undefined; }
    const style = getComputedStyle(last);
    const milliseconds = (value) => parseFloat(value) * (value.trim().endsWith("ms") ? 1 : 1000);
    const duration = milliseconds(style.animationDelay) + milliseconds(style.animationDuration);
    const timer = window.setTimeout(() => setDeploying(false), (Number.isFinite(duration) ? duration : 3000) + 200);
    return () => window.clearTimeout(timer);
  }, [deploying, reduced]);

  const salir = useCallback(() => {
    const node = root.current;
    if (node) {
      node.style.removeProperty("--zoom-s");
      node.style.removeProperty("--zoom-x");
      node.style.removeProperty("--zoom-y");
    }
    setZoom(1);
    setFocus(null);
  }, []);

  useEffect(() => {
    if (!focus) return undefined;
    const onKey = (e) => e.key === "Escape" && salir();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, salir]);

  /**
   * Con la camara dentro, la pagina se ancla.
   *
   * No es un capricho: la escena de esta seccion la escribe el scroll en cada
   * fotograma —la pose del astronauta, el fundido del retrato y el viaje del
   * agujero, todo en `follow()` de Stage.jsx—, asi que un solo golpe de rueda
   * mientras se esta mirando una galaxia de cerca le mueve el suelo por
   * debajo. Bloqueando el desplazamiento, lo que se ha ampliado se queda
   * donde estaba hasta salir.
   *
   * Clase propia y no `is-locked`: esa la escribe App.jsx para el cargador y
   * dos duenos sobre la misma clase acaban pisandose.
   */
  useLayoutEffect(() => {
    document.body.classList.toggle("is-anchored", anchored);
    if (!anchored) {
      scroller.current?.start();
      return undefined;
    }
    // Lenis no desplaza el documento, lleva el scroll por su cuenta: el
    // `overflow: hidden` de la clase no le afecta y hay que pararlo aparte.
    scroller.current?.stop();
    // Y ni con las dos cosas basta. `overflow: hidden` quita la barra y corta
    // la rueda, pero NO impide un desplazamiento por codigo —un `scrollTo`, un
    // enlace ancla del menu, que sigue ahi arriba—, y el marco de esta seccion
    // es `sticky`: si la pagina se corre, la galaxia ampliada se va de la
    // pantalla aunque no se haya movido ni un pixel dentro de ella. Medido:
    // 3508 -> 5200 y la galaxia en y = -1996. Asi que se apunta la altura al
    // entrar y se devuelve a ella cualquier intento de moverla.
    const anclaje = window.scrollY;
    const pin = () => {
      if (Math.abs(window.scrollY - anclaje) > 1) window.scrollTo(0, anclaje);
    };
    window.addEventListener("scroll", pin, { passive: true });
    return () => {
      window.removeEventListener("scroll", pin);
      document.body.classList.remove("is-anchored");
      scroller.current?.start();
    };
  }, [anchored]);

  /**
   * El acercamiento.
   *
   * No es una ficha que se abre: es la camara entrando. Se escala el halo
   * ENTERO y se desplaza para que el cuerpo pulsado quede en el centro del
   * marco, asi que lo que crece no es un icono sino el sistema, con sus
   * anillos y sus vecinos saliendose de cuadro. Eso es lo que lo hace leerse
   * como un acercamiento y no como abrir algo.
   *
   * El calculo va en el momento del clic y no en CSS porque depende de DONDE
   * este el cuerpo en su orbita justo entonces, que solo lo sabe el layout. Con
   * el halo escalado S alrededor de su centro H, un punto P acaba en
   * H + S*(P - H); para que ese destino sea el centro del marco F hay que
   * sumarle F - H - S*(P - H), que es la traslacion de abajo.
   *
   * Las orbitas son estaticas, asi que el cuerpo conserva su posicion durante
   * el acercamiento.
   */
  const entrar = useCallback((id) => {
    const node = root.current;
    const boton = refs.current[id];
    const marco = node?.closest(".meditation__frame");
    if (!node || !boton || !marco) return;

    const h = node.getBoundingClientRect();
    const b = boton.getBoundingClientRect();
    const f = marco.getBoundingClientRect();
    if (!b.width) return;

    const escala = (Math.min(f.width, f.height) * ZOOM_FILL) / b.width;
    const hx = h.left + h.width / 2;
    const hy = h.top + h.height / 2;
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;

    setZoom(escala);
    node.style.setProperty("--zoom-s", escala.toFixed(3));
    node.style.setProperty("--zoom-x", `${(f.left + f.width / 2 - hx - escala * (bx - hx)).toFixed(1)}px`);
    node.style.setProperty("--zoom-y", `${(f.top + f.height / 2 - hy - escala * (by - hy)).toFixed(1)}px`);
    setFocus(id);
  }, []);

  return (
    <>
      <div
        className="halo"
        ref={root}
        data-drawn={drawn ? "true" : "false"}
        data-formed={formed ? "true" : "false"}
        data-focus={focus ? "true" : "false"}
        style={{ "--ring-count": RINGS.length }}
        // Mientras no se ha trazado, la seccion esta fuera de pantalla y sus
        // botones no deben poder recibir el foco del teclado.
        inert={!drawn || deploying}
      >
        <svg className="halo__rings" viewBox="0 0 100 100" aria-hidden="true">
          {RINGS.map((f, i) => (
            <circle
              key={f}
              cx={i === 0 ? 50.25 : 50}
              cy={i === 0 ? 51 : 50}
              r={f * 50}
              style={{
                "--ring-i": i,
                // De cuanto arranca cada anillo para salir EXACTAMENTE del
                // borde de la aureola: la escala que lo encoge hasta el radio
                // de esta. El de dentro es la propia aureola, asi que le sale
                // 1 y no se mueve; solo enciende.
                "--from": (RINGS[0] / f).toFixed(4),
              }}
            />
          ))}
        </svg>

        {AREAS.map((b, i) => (
          <div
            key={b.id}
            className="halo__orbit"
            style={{
              "--orbit-d": `${RINGS[b.ring] * 100}%`,
              "--orbit-start": `${b.start}deg`,
              "--ring-i": b.ring,
            }}
          >
            <div
              className="halo__upright"
              style={{ "--orbit-start": `${b.start}deg` }}
            >
              <button
                type="button"
                className="halo__body"
                ref={(el) => { refs.current[b.id] = el; }}
                data-on={focus === b.id ? "true" : "false"}
                aria-pressed={focus === b.id}
                aria-label={tr(b.name)}
                style={{ "--body-size": b.size, "--body-ink": b.color }}
                onClick={() => (focus === b.id ? salir() : entrar(b.id))}
                onAnimationEnd={(event) => {
                  if (event.target === event.currentTarget && event.animationName === "halo-body-in" && b.id === LAST_REVEAL.id) {
                    setDeploying(false);
                  }
                }}
              >
                {/* El mismo agujero negro que sostiene el astronauta, clonado
                    y tenido con el color del area. No es un dibujo que se le
                    parece: es el shader entero —geodesicas, disco, aro de
                    fotones y lente— con el tono girado sobre el eje de los
                    grises, que es lo unico que cambia de uno a otro. */}
                <span className="halo__hole">
                  {telefono ? <span className="blackhole__fallback halo__plain" /> : <>
                  {/* Seis lienzos WebGL que estan varias pantallas mas abajo:
                      entran despues de la intro y de uno en uno (ver
                      lib/arranque.js). Montados al arrancar, se compilaban
                      encima del ∞ dibujandose. */}
                  <EnSuTurno turno={3 + i} fallback={<span className="blackhole__fallback" />}>
                  <Suspense fallback={<span className="blackhole__fallback" />}>
                    <BlackHole
                      bare
                      tint={b.color}
                      journey={CUERPO}
                      disk={DISCO}
                      white={BLANCO}
                      dpr={focus === b.id ? Math.min(Math.max(zoom, 1), DPR_MAX) : undefined}
                    />
                  </Suspense>
                  </EnSuTurno>
                  </>}
                </span>

                {/* El nombre sigue el arco interior del disco. El boton ya
                    aporta el nombre accesible; el SVG es solo visual. */}
                <svg className="halo__inscription" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                  <defs>
                    <path id={`${labelId}-${b.id}`} d="M 14 50 A 36 36 0 0 1 86 50" />
                  </defs>
                  <text textAnchor="middle" textLength="104" lengthAdjust="spacingAndGlyphs">
                    <textPath href={`#${labelId}-${b.id}`} startOffset="50%">{tr(b.name)}</textPath>
                  </text>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Dos salidas, y las dos hacen falta. La capa cubre todo lo que no es
          la galaxia y no pinta nada —ni fondo oscuro ni ficha—, para que se
          pueda salir pulsando fuera sin que se vea un marco. Pero con la
          galaxia inundando la pantalla, «fuera» casi no existe: por eso va
          ademas un boton que SE VE, que es lo unico que dice que de aqui se
          puede volver. */}
      {focus && (
        <>
          <button
            type="button"
            className="halo__exit"
            aria-label={tr({ es: "Alejar", en: "Zoom out" })}
            onClick={salir}
          />
          {/* Al body, y no donde cae en el arbol. Un `position: fixed` deja de
              ser fijo en cuanto algun ancestro tiene `transform` —y aqui
              `.meditation__portrait` lleva un `translateY`—, asi que el
              boton se colocaba respecto al retrato: medido, aparecia en x=312
              y 16 px por DEBAJO del borde de la pantalla, cortado. Sacandolo
              al body vuelve a tener la ventana como referencia. */}
          {/* El nombre del area y sus servicios.
              Colgaban de la caja del cuerpo, y eso funcionaba mientras el
              cuerpo ampliado cabia en pantalla. Ya no: ocupa 735 px de alto en
              una ventana de 639, asi que su borde de abajo —de donde colgaba
              el rotulo— cae fuera y el nombre desaparecia. Aqui van fijos al
              pie de la ventana, que es donde se leen pase lo que pase con el
              tamano del agujero. */}
          {createPortal(
            <div className="halo__card">
              <p className="halo__cardName">{tr(AREAS.find((a) => a.id === focus).name)}</p>
              <ul className="halo__cardList">
                {AREAS.find((a) => a.id === focus).items.map((s) => (
                  <li key={s.id}>{tr(s.title)}</li>
                ))}
              </ul>
            </div>,
            document.body
          )}
          {createPortal(
            <button type="button" className="halo__back" onClick={salir}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {tr({ es: "Volver", en: "Back" })}
            </button>,
            document.body
          )}
        </>
      )}
    </>
  );
}
