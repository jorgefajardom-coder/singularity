import { useEffect, useRef, useState } from "react";
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
    <span className={`roll ${className}`.trim()}>
      {/* El texto real, no un aria-label: un span sin rol no admite nombre
          de autor y los lectores de pantalla lo ignoran. Ver SplitText.jsx. */}
      <span className="sr-only">{text}</span>
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

/**
 * Vídeo de YouTube que se ve y se reproduce SIN salir de la página, y que no
 * pide nada a Google hasta que le dan al play.
 *
 * Un <iframe> de YouTube puesto en el HTML baja del orden de un megabyte de
 * scripts y planta sus cookies en cuanto se pinta la página, aunque nadie lo
 * reproduzca. Aquí lo que hay de entrada es la miniatura —descargada UNA vez y
 * servida desde /images, no desde i.ytimg.com— con su botón de play encima; el
 * iframe se monta al pulsarlo, ya con autoplay y contra `youtube-nocookie.com`.
 *
 * Mismo criterio que el resto del sitio: nada de fuera se descarga hasta que
 * hace falta (ver el entorno de luces en Props3D.jsx).
 */
export function VideoEmbed({ id, src, poster, title, label, note }) {
  const [puesto, setPuesto] = useState(false);

  if (src) return (
    <div className="video">
      <video className="video__marco" controls playsInline preload="metadata"
        poster={poster ? asset(poster) : undefined}
        aria-label={title} src={asset(src) + '#t=0.1'}>
        <a href={asset(src)}>{title}</a>
      </video>
    </div>
  );
  if (!id) return null;

  return (
    <div className="video">
      {puesto ? (
        <iframe
          className="video__marco"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          className="video__play"
          onClick={() => setPuesto(true)}
          aria-label={`${label} — ${title}`}
        >
          {poster ? (
            <img className="video__poster" src={asset(poster)} alt="" width="960" height="540" loading="lazy" />
          ) : null}
          <span className="video__glifo" aria-hidden="true" />
          <span className="video__texto">
            <span className="video__label">{label}</span>
            <span className="video__nota">{note}</span>
          </span>
        </button>
      )}
    </div>
  );
}
