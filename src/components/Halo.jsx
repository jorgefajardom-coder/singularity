import { useCallback, useEffect, useRef, useState } from "react";
import { areas, bodies } from "../data/content";
import { useLang } from "../lib/i18n";
import { prefersReducedMotion } from "../lib/anim";

/**
 * El sistema que orbita al personaje que medita.
 *
 * Los anillos son los mismos que los de la zona de marcas: mismo trazo y los
 * mismos radios que reparte `radiusOf()` en Orbit.jsx. Lo que cambia es que
 * aqui llevan cuerpos encima, y cada cuerpo es un AREA del stack.
 *
 * Las areas no duplican ni una herramienta: viven en `content.js` como una
 * lista de claves —`groups: ["dev", "datos"]`— que apunta a los grupos del
 * stack de siempre. Anadir una herramienta alla la hace aparecer aqui sola.
 *
 * El anillo 0 va vacio a proposito, igual que el interior de la orbita de
 * marcas: cae justo detras de la cabeza y es el que da el aire entre el pelo y
 * el primer cuerpo.
 *
 * El giro es todo CSS: son transformaciones compuestas y no pasan por el
 * ticker de GSAP, que en esta seccion ya esta ocupado llevando el agujero
 * negro hasta las manos (ver Stage.jsx). Lo unico que toca JavaScript es el
 * zoom, y solo en el momento del clic.
 */

// Mismos radios que `radiusOf(i, n)` en Orbit.jsx con n = 5, mas el interior.
const RINGS = [0.34, 0.46, 0.58, 0.7, 0.82, 0.94];

const SYSTEM = [...areas, ...bodies];

/** Cuanto del lado corto del marco ocupa el cuerpo una vez ampliado. */
const ZOOM_FILL = 0.34;

/**
 * Un brazo de espiral logaritmica, r = a * e^(b*theta), que es la curva con la
 * que se describen los brazos de una galaxia de verdad.
 *
 * Esto NO se puede hacer con un `conic-gradient`: un degradado conico reparte
 * color por angulo, asi que sus «brazos» son cunas rectas que salen del centro.
 * A tamano de icono colaba, pero el zoom llega a 10x y lo que se veia era un
 * cometa. Una curva SVG se mantiene nitida a cualquier escala y ademas se
 * enrolla, que es justo lo que distingue una galaxia de una mancha.
 *
 * Se calcula una sola vez al cargar el modulo: son dos cadenas de texto.
 */
function arm(turns = 2.05, b = 0.29, n = 56) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * turns * Math.PI * 2;
    const r = 3.4 * Math.exp(b * th);
    pts.push(`${(50 + r * Math.cos(th)).toFixed(1)} ${(50 + r * Math.sin(th)).toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
}

const SPIRAL = arm();

/** El cuerpo: una galaxia, o un planeta cuando lleva anillos o lunas. */
function Shape({ body }) {
  const kind = body.kind ?? "galaxy";
  return (
    <span className="halo__shape" data-kind={kind} aria-hidden="true">
      {kind === "galaxy" ? (
        <svg className="halo__disc" viewBox="0 0 100 100">
          {/* Dos pasadas por brazo: una ancha y apagada que hace el cuerpo del
              brazo, y otra fina y clara encima que le da el filo. Cuatro
              trazos en total, y con eso ya se lee el enrollado. */}
          <g className="halo__arms">
            <path className="halo__arm halo__arm--glow" d={SPIRAL} />
            <path className="halo__arm halo__arm--glow" d={SPIRAL} transform="rotate(180 50 50)" />
            <path className="halo__arm" d={SPIRAL} />
            <path className="halo__arm" d={SPIRAL} transform="rotate(180 50 50)" />
            <path className="halo__arm halo__arm--edge" d={SPIRAL} />
            <path className="halo__arm halo__arm--edge" d={SPIRAL} transform="rotate(180 50 50)" />
          </g>
          <circle className="halo__bulge" cx="50" cy="50" r="9" />
        </svg>
      ) : (
        <span className="halo__sphere" />
      )}
      {kind === "ringed" && <span className="halo__belt" />}
      {kind === "moons" &&
        body.moons.map((m, i) => (
          <span
            key={i}
            className="halo__moonpath"
            style={{
              "--moon-d": m.r * 2,
              "--moon-size": m.size,
              "--moon-turn": `${m.turn}s`,
              "--moon-start": `${m.start}deg`,
            }}
          >
            <span className="halo__moon" />
          </span>
        ))}
    </span>
  );
}

export default function Halo() {
  const { tr } = useLang();
  const root = useRef(null);
  const refs = useRef({});
  const [drawn, setDrawn] = useState(false);
  const [focus, setFocus] = useState(null);
  const reduced = prefersReducedMotion();

  // Los anillos se trazan cuando la seccion entra en pantalla, no al montar:
  // esta a cuatro pantallas de la primera y dibujarlos antes gastaria la
  // animacion sin que nadie la vea.
  useEffect(() => {
    if (reduced) {
      setDrawn(true);
      return undefined;
    }
    const node = root.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setDrawn(true),
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  const salir = useCallback(() => {
    const node = root.current;
    if (node) {
      node.style.removeProperty("--zoom-s");
      node.style.removeProperty("--zoom-x");
      node.style.removeProperty("--zoom-y");
    }
    setFocus(null);
  }, []);

  useEffect(() => {
    if (!focus) return undefined;
    const onKey = (e) => e.key === "Escape" && salir();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, salir]);

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
   * Las orbitas se congelan al entrar (`animation-play-state` en el CSS): si
   * siguieran girando, el cuerpo se iria del centro mientras la camara viaja.
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
        data-focus={focus ? "true" : "false"}
        // Mientras no se ha trazado, la seccion esta fuera de pantalla y sus
        // botones no deben poder recibir el foco del teclado.
        inert={!drawn}
      >
        <svg className="halo__rings" viewBox="0 0 100 100" aria-hidden="true">
          {RINGS.map((f, i) => (
            <circle key={f} cx="50" cy="50" r={f * 50} pathLength="1" style={{ "--ring-i": i }} />
          ))}
        </svg>

        {SYSTEM.map((b) => (
          <div
            key={b.id}
            className="halo__orbit"
            style={{
              "--orbit-d": `${RINGS[b.ring] * 100}%`,
              "--orbit-turn": `${b.turn}s`,
              "--orbit-start": `${b.start}deg`,
              "--ring-i": b.ring,
            }}
          >
            <div
              className="halo__upright"
              style={{ "--orbit-turn": `${b.turn}s`, "--orbit-start": `${b.start}deg` }}
            >
              <button
                type="button"
                className="halo__body"
                ref={(el) => { refs.current[b.id] = el; }}
                data-on={focus === b.id ? "true" : "false"}
                aria-pressed={focus === b.id}
                style={{
                  "--body-size": b.size,
                  "--body-ink": b.color,
                  "--body-ink-2": b.color2 ?? b.color,
                  "--body-tilt": `${b.tilt ?? 0}deg`,
                  "--body-squash": b.squash ?? 1,
                  "--body-swirl": `${b.swirl ?? 70}s`,
                }}
                onClick={() => (focus === b.id ? salir() : entrar(b.id))}
              >
                <Shape body={b} />
                <span className="halo__label">{tr(b.name)}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Solo existe con el zoom puesto, y solo para poder salir pulsando
          fuera. No pinta nada: no es una capa oscura ni una ficha. */}
      {focus && (
        <button
          type="button"
          className="halo__exit"
          aria-label={tr({ es: "Alejar", en: "Zoom out" })}
          onClick={salir}
        />
      )}
    </>
  );
}
