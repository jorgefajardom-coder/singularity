import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { certifications, props3d, sections } from "../data/content";

const PropsView = lazy(() =>
  import("../three/Props3D").then((m) => ({ default: m.PropsView }))
);
import { useLang } from "../lib/i18n";
import { GhostHeading } from "./ui";

/**
 * Formación, dibujada como una carta celeste: dos constelaciones cuyas
 * ESTRELLAS forman la figura que les da nombre (un birrete para los títulos y
 * diplomas, una medalla para las certificaciones), y al lado su leyenda.
 * Los grupos viven en `certifications.groups` dentro de src/data/content.js,
 * cada uno en orden cronológico. Sin fechas, el orden se lee igual:
 *  - cada título es una estrella numerada (I, II, III…) y la leyenda va en
 *    ese orden;
 *  - las estrellas brillan más cuanto más recientes son y la última late;
 * Unos cometas con estela recorren los trazos de la figura. Al entrar en
 * pantalla la figura SE FORMA: empieza ampliada y se contrae hasta su sitio,
 * estrella a estrella en el orden de los trazos, y luego se dibujan las lineas.
 * Pasar por una línea de la leyenda enciende su estrella y al revés. Si un
 * item trae `href`, la línea enlaza al certificado; si trae `points` (y un
 * `lead` opcional), sus puntos clave salen en una tarjeta flotante al pasar
 * o al tocarla, sin mover nada de la página.
 */

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/**
 * Figuras en un lienzo de 100 x 80. `slots` son las estrellas con nombre, en
 * el orden en que se asignan a los títulos (el más antiguo, el primero);
 * `menores` completan el contorno; `trazos` son las líneas de la figura, con
 * índices sobre [...slots, ...menores]; `recorridos`, las cadenas de trazos
 * por las que corren los cometas; `relleno`, un poligono que va relleno. Si
 * hay menos títulos que slots, los que sobran se pintan como estrellas menores
 * y la figura sigue entera.
 */
const FIGURAS = {
  // Birrete: el tablero en rombo (I a IV, vuelta completa), el casquete
  // debajo y la borla, que cuelga del centro y termina en V: la graduación.
  birrete: {
    slots: [[4, 26], [50, 4], [96, 26], [50, 48], [84, 62]],
    menores: [[50, 26], [84, 32], [24, 36], [22, 54], [36, 62], [50, 65], [64, 62], [78, 54], [76, 36]],
    trazos: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [5, 6], [6, 4],
      [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13],
    ],
    // Por donde corren los cometas: el contorno del tablero (en bucle) y el
    // casquete (ida y vuelta).
    recorridos: [[0, 1, 2, 3, 0], [7, 8, 9, 10, 11, 12, 13]],
  },
  // Medalla: dos cintas (cada una una banda, con sus dos cantos) que bajan
  // en V hasta el disco, y dentro del disco una estrella de cinco puntas.
  // I y II en las puntas de las cintas, III en el canto del disco y IV en la
  // punta de la estrella.
  medalla: {
    slots: [[18, 2], [82, 2], [31.9, 49.1, -5.5, 1.2], [50, 46.5]],
    menores: [
      [31, 2], [69, 2],
      [50, 36], [61.2, 39.6], [68.1, 49.1], [68.1, 60.9], [61.2, 70.4], [50, 74], [38.8, 70.4], [31.9, 60.9], [38.8, 39.6],
      [58.1, 52.4], [55, 61.9], [45, 61.9], [41.9, 52.4],
    ],
    trazos: [
      [0, 4], [0, 14], [4, 6],
      [1, 5], [1, 7], [5, 6],
      [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 2], [2, 14], [14, 6],
      [3, 16], [16, 18], [18, 15], [15, 17], [17, 3],
    ],
    // La estrella del disco va rellena (trazada en orden de pentagrama).
    relleno: [3, 16, 18, 15, 17],
    // Cometas: el canto del disco y la estrella de dentro.
    recorridos: [[6, 7, 8, 9, 10, 11, 12, 13, 2, 14, 6], [3, 16, 18, 15, 17, 3]],
  },
};

/**
 * La formacion: la figura empieza AMPLIADA desde su centro y se contrae hasta
 * su tamano, asi que la forma se reconoce ya mientras se mueve. Cada estrella
 * sale en el orden en que se dibujan los trazos (`orden`).
 */
function vuelo([x, y], orden) {
  return {
    "--dx": `${((x - 50) * 0.85).toFixed(1)}px`,
    "--dy": `${((y - 40) * 0.85).toFixed(1)}px`,
    "--v": `${(orden * 0.06).toFixed(2)}s`,
  };
}

/** Orden de aparicion de cada estrella: el de los trazos, uno tras otro. */
function ordenDeTrazo(figura) {
  const total = figura.slots.length + figura.menores.length;
  const orden = new Array(total).fill(-1);
  let k = 0;
  for (const [a, b] of figura.trazos) {
    if (orden[a] < 0) orden[a] = k++;
    if (orden[b] < 0) orden[b] = k++;
  }
  return orden.map((o) => (o < 0 ? k++ : o));
}

/**
 * Un cometa con estela: la cabeza y cuatro puntos detras que la siguen con un
 * pequeno retraso, cada vez mas tenues. Las cadenas abiertas van y vuelven;
 * las cerradas dan vueltas.
 */
function Cometa({ puntos, dur, retraso }) {
  const cerrada = puntos[0] === puntos[puntos.length - 1];
  const ida = puntos.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const vuelta = cerrada ? "" : puntos.slice(0, -1).reverse().map(([x, y]) => ` L${x} ${y}`).join("");
  const ruta = ida + vuelta;
  return (
    <g className="constel__comet">
      {[0, 1, 2, 3, 4].map((k) => (
        <circle key={k} r={1.15 - k * 0.2} opacity={1 - k * 0.2}>
          <animateMotion
            dur={`${dur}s`}
            begin={`${-(retraso + 0.4 - k * 0.07).toFixed(2)}s`}
            repeatCount="indefinite"
            path={ruta}
          />
        </circle>
      ))}
    </g>
  );
}

/**
 * La ficha se abre hacia abajo si cabe en pantalla y, si no, hacia arriba
 * (descontando la barra fija de arriba). Se decide al abrirla, mirando donde
 * esta la linea en ese momento.
 */
function orientar(item) {
  const li = item.closest("li");
  const ficha = item.querySelector(".constel__ficha");
  if (!li || !ficha) return;
  const r = li.getBoundingClientRect();
  const alto = ficha.offsetHeight + 16;
  const barra = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 78;
  const abajo = innerHeight - r.bottom;
  const arriba = r.top - barra;
  li.toggleAttribute("data-arriba", abajo < alto && arriba > abajo);
}

export default function Certifications() {
  const { tr } = useLang();
  const groups = (certifications.groups ?? []).filter((g) => g.items?.length);

  if (!groups.length) return null;

  return (
    <section id="certifications" className="section certs">
      <Suspense fallback={null}>
        <PropsView className="certs__view" items={props3d.certs} parallax={-0.4} />
      </Suspense>

      <div className="shell" style={{ textAlign: "center" }}>
        <GhostHeading className="display display--md">{tr(sections.certifications.heading)}</GhostHeading>
      </div>

      <div className="shell">
        <div className="constels">
          {groups.map((g, i) => (
            <Constelacion key={i} label={tr(g.label)} figura={FIGURAS[g.figure] ?? FIGURAS.birrete} items={g.items} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Constelacion({ label, items, figura }) {
  const { tr } = useLang();
  const ref = useRef(null);
  const [lit, setLit] = useState(false);
  const [activo, setActivo] = useState(-1);

  // Se enciende al entrar y se apaga al volver a subir, como los demás
  // bloques: el scroll tiene que poder deshacerse.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setLit(true);
        else if (e.boundingClientRect.top > 0) setLit(false);
      },
      { rootMargin: "0px 0px -18% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const n = Math.min(items.length, figura.slots.length);
  const lista = items.slice(0, n);
  const todos = [...figura.slots, ...figura.menores];
  const menores = [...figura.slots.slice(n), ...figura.menores];
  const orden = ordenDeTrazo(figura);

  return (
    <div className="constel-group" data-lit={lit} style={{ "--n": n }}>
      <h3 className="constel__name">{label}</h3>
      <div className="constel" ref={ref}>
        <div className="constel__cielo">
        <svg className="constel__chart" viewBox="-6 -6 112 88" aria-hidden="true">
          {figura.trazos.map(([a, b], i) => (
            <line
              key={i}
              x1={todos[a][0]}
              y1={todos[a][1]}
              x2={todos[b][0]}
              y2={todos[b][1]}
              pathLength="1"
              style={{ "--i": i }}
            />
          ))}
          {figura.relleno ? (
            <path
              className="constel__relleno"
              d={figura.relleno.map((k, i) => `${i ? "L" : "M"}${todos[k][0]} ${todos[k][1]}`).join(" ") + " Z"}
            />
          ) : null}
          {menores.map(([x, y], i) => (
            <g key={`m${i}`} transform={`translate(${x} ${y})`}>
              <g className="constel__vuela" style={vuelo([x, y], orden[n + i])}>
                <circle className="constel__minor" r="1.05" />
              </g>
            </g>
          ))}
          {lista.map((c, i) => {
            // El numeral va arriba, salvo en las estrellas del borde superior
            // (debajo) o si la figura le da otro sitio (`[x, y, dx, dy]`).
            const [x, y, nx = 0, ny = y < 12 ? 8 : -4.6] = todos[i];
            const mag = n === 1 ? 1 : i / (n - 1);
            return (
              <g
                key={`s${i}`}
                className="constel__star"
                data-activo={activo === i || undefined}
                data-now={i === n - 1 || undefined}
                style={{ "--i": i, "--mag": mag }}
                transform={`translate(${x} ${y})`}
                onPointerEnter={() => setActivo(i)}
                onPointerLeave={() => setActivo(-1)}
              >
                <g className="constel__vuela" style={vuelo([x, y], orden[i])}>
                  <circle className="constel__halo" r="5" />
                  <circle className="constel__core" r={1.5 + mag * 1.1} />
                  <text className="constel__num" x={nx} y={ny}>
                    {ROMANOS[i] ?? i + 1}
                  </text>
                </g>
              </g>
            );
          })}
          {(figura.recorridos ?? []).map((cadena, k) => (
            <Cometa
              key={`c${k}`}
              puntos={cadena.map((p) => todos[p])}
              dur={3.2 + cadena.length * 0.55}
              retraso={k * 1.7}
            />
          ))}
        </svg>
        </div>

        <ol className="constel__legend">
          {lista.map((c, i) => {
            const title = tr(c.title);
            const ficha = c.points?.length > 0;
            const Tag = c.href ? "a" : "div";
            return (
              <li
                key={`${title}-${i}`}
                style={{ "--i": i }}
                data-activo={activo === i || undefined}
              >
                <Tag
                  className="constel__item"
                  onPointerEnter={(e) => { setActivo(i); if (ficha) orientar(e.currentTarget); }}
                  onPointerLeave={() => setActivo(-1)}
                  onFocus={(e) => { setActivo(i); if (ficha) orientar(e.currentTarget); }}
                  onBlur={() => setActivo(-1)}
                  {...(c.href
                    ? { href: c.href, target: "_blank", rel: "noreferrer noopener" }
                    : ficha
                      ? { tabIndex: 0 }
                      : {})}
                >
                  <span className="constel__roman" aria-hidden="true">{ROMANOS[i] ?? i + 1}</span>
                  <span className="constel__text">
                    <span className="constel__title">
                      {title}
                      {c.href ? <span className="constel__link" aria-hidden="true"> ↗</span> : null}
                    </span>
                    <span className="constel__meta">{tr(c.issuer)}</span>
                    {c.tags?.length ? (
                      <span className="constel__tags">
                        {c.tags.map((tag) => <span key={tr(tag)}>{tr(tag)}</span>)}
                      </span>
                    ) : null}
                  </span>
                  {ficha ? (
                    // Flota encima de la leyenda: no ocupa sitio, asi que al
                    // abrirse no mueve la figura ni el resto de la pagina.
                    <span className="constel__ficha" role="tooltip">
                      {c.lead ? <span className="constel__lead">{tr(c.lead)}</span> : null}
                      <span className="constel__puntos">
                        {c.points.map((p, k) => (
                          <span className="constel__punto" key={k}>
                            <strong>{tr(p.k)}</strong> {tr(p.v)}
                          </span>
                        ))}
                      </span>
                    </span>
                  ) : null}
                </Tag>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
