import { useEffect, useRef } from "react";
import { site, socials, nav, ui } from "../data/content";
import { useLang } from "../lib/i18n";
import { pintarFoto } from "../lib/fotoProtegida";

const SHAPES = [
  { clip: "polygon(50% 0, 100% 100%, 0 100%)", color: "#a82405" },
  { clip: "circle(50% at 50% 50%)", color: "#db3208" },
  { clip: "polygon(0 0, 100% 0, 100% 100%)", color: "#ff8224" },
  { clip: "ellipse(50% 32% at 50% 50%)", color: "#ff9a3c" },
  { clip: "polygon(0 100%, 50% 0, 100% 100%)", color: "#ff6a12" },
  { clip: "circle(50% at 50% 50%)", color: "#ffb066" },
];

/**
 * Tarjeta con la foto, igual que las del Stack. La foto va PROTEGIDA: llega
 * cifrada y se pinta en un <canvas> (ver lib/fotoProtegida.js), sin <img> que
 * guardar, arrastrar o recolectar, y con marca de agua para las capturas.
 */
function TarjetaFoto() {
  const { tr } = useLang();
  const carta = useRef(null);
  const lienzo = useRef(null);

  useEffect(() => {
    const el = lienzo.current;
    if (!el) return undefined;
    let vivo = true;
    const pintar = () => vivo && pintarFoto(el, `© ${site.name}`).catch(() => {});
    pintar();
    const ro = new ResizeObserver(pintar);
    ro.observe(el);
    return () => { vivo = false; ro.disconnect(); };
  }, []);

  // Como las cartas del Stack: se levanta y se inclina hacia el puntero.
  useEffect(() => {
    const el = carta.current;
    if (!el || !window.matchMedia("(hover: hover)").matches) return undefined;
    const mover = (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--ry", `${(((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(2)}deg`);
    };
    const soltar = () => { el.style.removeProperty("--rx"); el.style.removeProperty("--ry"); };
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerleave", soltar);
    return () => { el.removeEventListener("pointermove", mover); el.removeEventListener("pointerleave", soltar); };
  }, []);

  const bloquear = (e) => e.preventDefault();

  return (
    <article
      className="poster footer__carta"
      ref={carta}
      onContextMenu={bloquear}
      onDragStart={bloquear}
      onCopy={bloquear}
    >
      <div className="poster__arte footer__foto">
        <canvas ref={lienzo} role="img" aria-label={site.name} />
      </div>
      <header className="poster__cabeza">
        <h3 className="poster__titulo">Ing. J.A.F.M</h3>
      </header>
      <footer className="poster__pie" aria-hidden="true">
        <span>VOL. 00</span>
        <span className="poster__estrellas">✦ ✦ ✦</span>
        <span>{tr({ es: "BOGOTÁ", en: "BOGOTÁ" })}</span>
      </footer>
    </article>
  );
}

export default function Footer() {
  const { tr } = useLang();

  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer__firma">
          {/* En blanco solido: en contorno se perdia contra el fondo. */}
          <h2 className="display display--lg footer__name">{site.name}</h2>
          <TarjetaFoto />
        </div>

        <div className="footer__cols">
          <div className="footer__col">
            <h4>{tr(ui.navigation)}</h4>
            {nav.map((n) => (
              <a key={n.href} href={n.href}>
                {tr(n.label)}
              </a>
            ))}
          </div>

          <div className="footer__col">
            <h4>{tr(ui.social)}</h4>
            {socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer noopener">
                {s.label}
              </a>
            ))}
          </div>

          <div className="footer__col">
            <h4>{tr(ui.contact)}</h4>
            <a href={`mailto:${site.email}`}>{site.email}</a>
            <span>{tr(site.location)}</span>
            <span>{tr(site.role)}</span>
          </div>
        </div>

        <div className="footer__shapes" aria-hidden="true">
          {SHAPES.map((s, i) => (
            <i key={i} style={{ background: s.color, clipPath: s.clip }} />
          ))}
        </div>

        <div className="footer__legal">
          <span>
            © {new Date().getFullYear()} {site.name}
          </span>
        </div>
      </div>
    </footer>
  );
}
