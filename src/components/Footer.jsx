import { useEffect, useRef, useState } from "react";
import { site, socials, nav, ui } from "../data/content";
import { useLang } from "../lib/i18n";
import { pintarFoto } from "../lib/fotoProtegida";
import PostalArt from "./PostalArt";

// Como las cartas del Stack: se levanta y se inclina hacia el puntero.
function useInclinar(carta) {
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
  }, [carta]);
}

// Postales de viaje que acompanan a la de la foto, abiertas en abanico.
const postales = [
  { lugar: "canada", titulo: { es: "Canadá", en: "Canada" }, pie: "56° N", giro: 9 },
  { lugar: "miami", titulo: { es: "Miami", en: "Miami" }, pie: "25° N", giro: -5 },
  { lugar: "florida", titulo: { es: "Florida", en: "Florida" }, pie: "28° N", giro: 4 },
  { lugar: "china", titulo: { es: "China", en: "China" }, pie: "40° N", giro: -6 },
  // Colombia no es un dibujo: una ilustracion hecha aparte (Valle del Cocora
  // con un oso de anteojos), con los mismos colores y matasellos.
  { lugar: "colombia", titulo: { es: "Colombia", en: "Colombia" }, pie: "4° N", giro: 3,
    imagen: "images/postal-colombia.webp" },
];

// La postal en blanco de quien mira, que puede ser la siguiente del album:
// cierra el album por la izquierda, al otro lado de Canada. Lleva a Contacto.
const postalTu = {
  lugar: "tu", titulo: { es: "¿Y tú?", en: "You?" }, pie: { es: "PRÓXIMO", en: "NEXT" }, giro: -4,
  href: "#contact", etiqueta: { es: "¿Y tú? Escríbeme y sé la próxima postal", en: "You? Write to me and be the next postcard" },
};

function Postal({ lugar, titulo, pie, giro, vol, imagen, href, etiqueta }) {
  const { tr } = useLang();
  const carta = useRef(null);
  useInclinar(carta);

  // Como en el Stack: las piezas del dibujo se animan al entrar en pantalla.
  useEffect(() => {
    const el = carta.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(([e]) => el.classList.toggle("is-art-visible", e.isIntersecting), { threshold: 0.55 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = href ? "a" : "article";
  return (
    <Tag className={`poster footer__carta footer__postal${href ? " footer__tu" : ""}`} ref={carta}
      style={{ "--giro": `${giro}deg` }} {...(href ? { href, "aria-label": tr(etiqueta) } : {})}>
      <div className="poster__arte" aria-hidden="true">
        {imagen ? (
          <img className="poster__vector" src={`${import.meta.env.BASE_URL}${imagen}`} alt=""
            width="512" height="512" loading="lazy" decoding="async" draggable="false" />
        ) : (
          <PostalArt lugar={lugar} />
        )}
      </div>
      <header className="poster__cabeza">
        <h3 className="poster__titulo">{tr(titulo)}</h3>
      </header>
      <footer className="poster__pie" aria-hidden="true">
        <span>VOL. {vol ? String(vol).padStart(2, "0") : "??"}</span>
        <span className="poster__estrellas">✦ ✦ ✦</span>
        <span>{typeof pie === "string" ? pie : tr(pie)}</span>
      </footer>
    </Tag>
  );
}

/**
 * Tarjeta con la foto, igual que las del Stack. La foto va PROTEGIDA: llega
 * cifrada y se pinta en un <canvas> (ver lib/fotoProtegida.js), sin <img> que
 * guardar, arrastrar o recolectar, y con marca de agua para las capturas.
 */
function TarjetaFoto() {
  const { tr } = useLang();
  const carta = useRef(null);
  const lienzo = useRef(null);

  // Si la foto no llega, la tarjeta lo dice con sus iniciales en vez de
  // quedarse con un hueco negro, y el error queda en la consola.
  const [sinFoto, setSinFoto] = useState(false);
  useEffect(() => {
    const el = lienzo.current;
    if (!el) return undefined;
    let vivo = true;
    const pintar = () => vivo && pintarFoto(el, `© ${site.name}`)
      .then(() => { if (vivo) setSinFoto(false); })
      .catch((error) => {
        console.error("[singularity] no se pudo cargar la foto", error);
        if (vivo) setSinFoto(true);
      });
    pintar();
    const ro = new ResizeObserver(pintar);
    ro.observe(el);
    return () => { vivo = false; ro.disconnect(); };
  }, []);

  useInclinar(carta);

  // El bloqueo va solo sobre la imagen, no sobre la tarjeta entera: el
  // nombre y el texto de al lado se pueden seleccionar y copiar.
  const bloquear = (e) => e.preventDefault();

  return (
    <article className="poster footer__carta" ref={carta}>
      <div className="poster__arte footer__foto" data-sin-foto={sinFoto ? "true" : undefined}
        onContextMenu={bloquear} onDragStart={bloquear}>
        <canvas ref={lienzo} role="img" aria-label={site.name} />
        {sinFoto && <span className="footer__iniciales" aria-hidden="true">JAFM</span>}
      </div>
      <header className="poster__cabeza">
        <h3 className="poster__titulo">{site.name}</h3>
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
        {/* Columnas a la izquierda; a la derecha, la tarjeta como una postal. */}
        <div className="footer__cuerpo">
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

        {/* Solo la tarjeta: ya lleva el nombre y la foto. El nombre en grande
            se quito (Jorge, 25-09-2026) para aprovechar el espacio. */}
        <div className="footer__firma">
          <Postal {...postalTu} />
          {postales.map((p, i) => <Postal key={p.lugar} {...p} vol={i + 1} />)}
          <TarjetaFoto />
        </div>
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
