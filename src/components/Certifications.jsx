import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { certifications, props3d, sections } from "../data/content";

const PropsView = lazy(() =>
  import("../three/Props3D").then((m) => ({ default: m.PropsView }))
);
import { useLang } from "../lib/i18n";
import { GhostHeading } from "./ui";

/**
 * Certificaciones y formación, dibujadas en un mismo cielo como dos
 * constelaciones: títulos y diplomas por un lado, certificaciones por otro.
 * Los grupos viven en `certifications.groups` dentro de src/data/content.js,
 * cada uno en orden cronológico. Sin fechas, el orden se lee igual:
 *  - la figura sube: lo más antiguo abajo, lo más reciente arriba;
 *  - cada estrella lleva su numeral (I, II, III…) y brilla más cuanto más
 *    reciente es; la última late, es "el presente";
 *  - un cometa recorre el trazo en el sentido del tiempo.
 * Detrás, como en los atlas celestes antiguos, va la figura que da nombre a
 * la constelación (`figure` en los datos), en un trazo tenue.
 * Si un item trae `href`, la estrella se vuelve un enlace al certificado, y si
 * trae `detail`, la descripción aparece al pasar por encima (o al tocarla).
 */

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// Figuras de fondo, en un lienzo de 100x60 que se encaja en la constelación.
const FIGURAS = {
  // Birrete: el tablero en rombo, el casquete y la borla.
  birrete: [
    "M50 5 L95 21 L50 37 L5 21 Z",
    "M23 29 L23 45 Q50 57 77 45 L77 29",
    "M50 21 L85 25 L85 42",
    "M82 42 L85 50 L88 42 Z",
  ],
  // Medalla: dos cintas y el disco con su anillo.
  medalla: [
    "M36 1 L46 20 M64 1 L54 20",
    "M50 20 m-19 19 a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0",
    "M50 27 m-12 12 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0",
    "M50 31 L52.5 36.5 L58 37 L54 41 L55 47 L50 44 L45 47 L46 41 L42 37 L47.5 36.5 Z",
  ],
};

// La figura: una cresta que asciende. Alterna siempre alto/bajo (así las
// etiquetas vecinas caen a lados opuestos), sube de principio a fin y la más
// reciente es siempre la cima.
function posiciones(n, vertical) {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const onda = n === 1 ? 0 : (n - 1 - i) % 2 === 0 ? -1 : 1;
    // En vertical el tiempo baja con el scroll y el zigzag se queda en la
    // franja izquierda para que las etiquetas tengan sitio a la derecha.
    if (vertical) return [0.14 + onda * 0.08, 0.06 + 0.88 * t];
    return [0.08 + 0.84 * t, 0.66 - 0.26 * t + onda * 0.12];
  });
}

// Estrellas menores de fondo, siempre las mismas (pseudoazar con semilla):
// dan a la figura el aire de una carta celeste sin distraer.
function polvo(semilla, cuantas = 16) {
  let s = semilla;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: cuantas }, () => ({
    x: rnd(),
    y: rnd(),
    r: 0.6 + rnd() * 1.1,
    d: rnd() * 4,
  }));
}

export default function Certifications() {
  const { tr } = useLang();
  const groups = (certifications.groups ?? []).filter((g) => g.items?.length);
  const [vertical, setVertical] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const onChange = () => setVertical(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
        <div className="constels" data-vertical={vertical}>
          {groups.map((g, i) => (
            <Constelacion
              key={i}
              semilla={i * 7919 + 17}
              label={tr(g.label)}
              figura={FIGURAS[g.figure]}
              items={g.items}
              vertical={vertical}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Constelacion({ label, items, vertical, semilla, figura }) {
  const { tr } = useLang();
  const ref = useRef(null);
  const [lit, setLit] = useState(false);
  // El trazo se dibuja en píxeles reales del bloque: con un viewBox estirado
  // el `pathLength` se deforma y las líneas salen a trozos.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [fondo] = useState(() => polvo(semilla));

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const n = items.length;
  const pts = posiciones(n, vertical);
  const px = pts.map(([x, y]) => [x * size.w, y * size.h]);
  const ruta = px.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  return (
    <div className="constel-group" style={{ "--n": n }}>
      <h3 className="constel__name" data-lit={lit}>{label}</h3>
      <div
        ref={ref}
        className="constel"
        data-lit={lit}
        data-vertical={vertical}
        style={{ "--n": n }}
      >
        <svg className="constel__lines" viewBox={`0 0 ${size.w || 1} ${size.h || 1}`} aria-hidden="true">
          {figura && size.w ? (
            <svg className="constel__figure" viewBox="0 0 100 60" x="0" y="0" width={size.w} height={size.h}>
              {figura.map((d, i) => (
                <path key={i} d={d} vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
          ) : null}
          {fondo.map((p, i) => (
            <circle
              key={`f${i}`}
              className="constel__dust"
              cx={p.x * size.w}
              cy={p.y * size.h}
              r={p.r}
              style={{ "--d": `${p.d}s` }}
            />
          ))}
          {px.slice(1).map(([x, y], i) => (
            <line
              key={i}
              x1={px[i][0]}
              y1={px[i][1]}
              x2={x}
              y2={y}
              pathLength="1"
              style={{ "--i": i }}
            />
          ))}
          {size.w && n > 1 ? (
            <circle className="constel__comet" r="2.4">
              <animateMotion dur={`${2.2 + n * 0.9}s`} repeatCount="indefinite" path={ruta} />
            </circle>
          ) : null}
        </svg>

        <ul className="constel__stars">
          {items.map((c, i) => {
            const title = tr(c.title);
            const [x, y] = pts[i];
            const detail = c.detail ? tr(c.detail) : "";
            const Tag = c.href ? "a" : "div";
            // La etiqueta va hacia donde no hay trazo: encima de las estrellas
            // que quedan por arriba de sus vecinas y debajo de las demás; en
            // vertical, a la derecha.
            const vecinas = [pts[i - 1], pts[i + 1]].filter(Boolean);
            const media = vecinas.length
              ? vecinas.reduce((acc, p) => acc + p[1], 0) / vecinas.length
              : 1;
            const side = vertical ? "right" : y <= media ? "top" : "bottom";
            // Magnitud: de 0 (la más antigua) a 1 (la más reciente).
            const mag = n === 1 ? 1 : i / (n - 1);

            return (
              <li
                key={`${title}-${i}`}
                className="star"
                data-side={side}
                data-now={i === n - 1 || undefined}
                style={{ left: `${x * 100}%`, top: `${y * 100}%`, "--i": i, "--mag": mag }}
              >
                <Tag
                  className="star__hit"
                  {...(c.href
                    ? { href: c.href, target: "_blank", rel: "noreferrer noopener" }
                    : detail
                      ? { tabIndex: 0 }
                      : {})}
                >
                  <span className="star__dot" aria-hidden="true" />
                  <span className="star__label">
                    <span className="star__num" aria-hidden="true">{ROMANOS[i] ?? i + 1}</span>
                    <span className="star__title">
                      {title}
                      {c.href ? <span className="star__link" aria-hidden="true"> ↗</span> : null}
                    </span>
                    <span className="star__meta">{tr(c.issuer)}</span>
                  </span>
                  {detail ? <span className="star__detail">{detail}</span> : null}
                </Tag>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
