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
