import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { certifications, props3d, sections } from "../data/content";

const PropsView = lazy(() =>
  import("../three/Props3D").then((m) => ({ default: m.PropsView }))
);
import { useLang } from "../lib/i18n";
import { GhostHeading } from "./ui";

/**
 * Certificaciones y formación, dibujadas como una sola constelación: cada
 * título es una estrella y el trazo las une en el orden de la lista.
 * La lista vive en `certifications.items` dentro de src/data/content.js.
 * Si un item trae `href`, la estrella se vuelve un enlace al certificado, y si
 * trae `detail`, la descripción aparece al pasar por encima (o al tocarla).
 * Si trae `star: [x, y]` (0-1), esa es su posición; si no, se reparte sola.
 */

// Alturas de la silueta por defecto, en fracción del lienzo. Un zigzag
// irregular que se lee como constelación y no como gráfica, pero que alterna
// siempre alto/bajo: así las etiquetas vecinas caen a lados opuestos.
const CURVA = [0.66, 0.3, 0.58, 0.2, 0.52, 0.28, 0.7, 0.36, 0.62, 0.24];

function posiciones(items, vertical) {
  const n = items.length;
  return items.map((c, i) => {
    if (c.star) return vertical ? [c.star[1], c.star[0]] : c.star;
    const a = n === 1 ? 0.5 : 0.1 + (0.8 * i) / (n - 1);
    const b = n === 1 ? 0.5 : CURVA[i % CURVA.length];
    // En vertical el eje largo es el alto; el zigzag se queda en la franja
    // izquierda para que las etiquetas tengan sitio a la derecha.
    return vertical ? [0.06 + b * 0.3, a] : [a, b];
  });
}

export default function Certifications() {
  const { tr } = useLang();
  const items = certifications.items ?? [];
  const ref = useRef(null);
  const [lit, setLit] = useState(false);
  // El trazo se dibuja en píxeles reales del bloque: con un viewBox estirado
  // el `pathLength` se deforma y las líneas salen a trozos.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [vertical, setVertical] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const onChange = () => setVertical(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  if (!items.length) return null;

  const pts = posiciones(items, vertical);

  return (
    <section id="certifications" className="section certs">
      <Suspense fallback={null}>
        <PropsView className="certs__view" items={props3d.certs} parallax={-0.4} />
      </Suspense>

      <div className="shell" style={{ textAlign: "center" }}>
        <GhostHeading className="display display--md">{tr(sections.certifications.heading)}</GhostHeading>
      </div>

      <div className="shell">
        <div
          ref={ref}
          className="constel"
          data-lit={lit}
          data-vertical={vertical}
          style={{ "--n": items.length }}
        >
          <svg className="constel__lines" viewBox={`0 0 ${size.w || 1} ${size.h || 1}`} aria-hidden="true">
            {pts.slice(1).map(([x, y], i) => (
              <line
                key={i}
                x1={pts[i][0] * size.w}
                y1={pts[i][1] * size.h}
                x2={x * size.w}
                y2={y * size.h}
                pathLength="1"
                style={{ "--i": i }}
              />
            ))}
          </svg>

          <ul className="constel__stars">
            {items.map((c, i) => {
              const title = tr(c.title);
              const [x, y] = pts[i];
              const detail = c.detail ? tr(c.detail) : "";
              const Tag = c.href ? "a" : "div";
              // La etiqueta va hacia donde no hay trazo: en horizontal, encima
              // de las estrellas que quedan por arriba de sus vecinas y debajo
              // de las que quedan por abajo; en vertical, a la derecha.
              const vecinas = [pts[i - 1], pts[i + 1]].filter(Boolean);
              const media = vecinas.length
                ? vecinas.reduce((acc, p) => acc + p[1], 0) / vecinas.length
                : 1;
              const side = vertical ? "right" : y <= media ? "top" : "bottom";

              return (
                <li
                  key={`${title}-${i}`}
                  className="star"
                  data-side={side}
                  style={{ left: `${x * 100}%`, top: `${y * 100}%`, "--i": i }}
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
    </section>
  );
}
