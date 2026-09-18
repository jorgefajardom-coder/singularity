import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "../lib/anim";
import { asset } from "../lib/asset";

/**
 * Título "fantasma" como el de la referencia: el contorno se rellena
 * a medida que la sección entra en pantalla.
 */
export function GhostHeading({ children, className = "display display--lg", as: Tag = "h2" }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fill = el.querySelector(".ghost__fill");
    if (!fill) return;

    if (prefersReducedMotion()) {
      gsap.set(fill, { clipPath: "inset(0 0% 0 0)" });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        fill,
        { clipPath: "inset(0 100% 0 0)" },
        {
          clipPath: "inset(0 0% 0 0)",
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            end: "top 35%",
            scrub: 0.6,
          },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <Tag ref={ref} className={`${className} ghost`}>
      <span className="ghost__outline">{children}</span>
      <span className="ghost__fill" aria-hidden="true">
        {children}
      </span>
    </Tag>
  );
}

/**
 * Placeholder de imagen: degradado animado con "manchas" que recuerda a
 * un render 3D abstracto. Se usa mientras no coloques tus propios renders
 * en /public/images.
 */
export function Placeholder({ palette = ["#ff8224", "#db3208"], seed = 0, src, alt = "" }) {
  if (src) return <img src={asset(src)} alt={alt} loading="lazy" />;

  const [a, b] = palette;
  const x = 20 + ((seed * 37) % 60);
  const y = 25 + ((seed * 53) % 50);

  return (
    <div
      role="img"
      aria-label={alt || "Render 3D"}
      style={{
        width: "100%",
        height: "100%",
        background: [
          `radial-gradient(60% 70% at ${x}% ${y}%, ${a} 0%, transparent 62%)`,
          `radial-gradient(55% 65% at ${100 - x}% ${100 - y}%, ${b} 0%, transparent 60%)`,
          `linear-gradient(140deg, ${b}22, #08070a 78%)`,
        ].join(","),
        filter: "saturate(1.1)",
      }}
    />
  );
}

/** Iconos geométricos simples para el marquee y el footer. */
export function ShapeIcon({ shape = "circle", fill = "currentColor" }) {
  const paths = {
    circle: <circle cx="12" cy="12" r="9" />,
    square: <rect x="4" y="4" width="16" height="16" rx="3" />,
    triangle: <path d="M12 3 21 20H3z" />,
    arc: <path d="M3 21a9 9 0 0 1 18 0z" />,
    cross: <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" />,
    drop: <path d="M12 2c4 6 7 8.5 7 12a7 7 0 1 1-14 0c0-3.5 3-6 7-12z" />,
  };

  return (
    <svg viewBox="0 0 24 24" fill={fill} aria-hidden="true">
      {paths[shape] ?? paths.circle}
    </svg>
  );
}

/**
 * Texto que rueda sobre si mismo al pasar el puntero: cada letra sube y la
 * copia de abajo ocupa su sitio, con un retardo creciente que hace la ola.
 * Es CSS puro (ver `.roll` en global.css); el hover puede venir del propio
 * span o del enlace/boton que lo envuelve.
 */
export function RollText({ children, className = "" }) {
  const text = String(children ?? "");

  return (
    <span className={`roll ${className}`.trim()} aria-label={text}>
      <span aria-hidden="true">
        {[...text].map((char, i) => (
          <span className="roll__char" key={i} style={{ "--i": i }}>
            <span>{char === " " ? "\u00a0" : char}</span>
            <span>{char === " " ? "\u00a0" : char}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
