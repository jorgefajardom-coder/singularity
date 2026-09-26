import { useEffect, useRef, useState } from "react";
import { site, socials, nav, ui } from "../data/content";
import { useLang } from "../lib/i18n";
import { pintarFoto } from "../lib/fotoProtegida";
import { enlaceCorreo } from "../lib/correo";
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

/**
 * El abanico se DESPLIEGA al entrar en pantalla: las postales empiezan
 * apiladas debajo de la tarjeta de la foto (la primera) y salen hacia su
 * sitio de una en una, de izquierda a derecha. Al salir de la pantalla se
 * recogen, para volver a desplegarse la proxima vez.
 *
 * Cada carta lleva en `--desde` cuanto le falta para quedar debajo de la
 * primera (se mide su `offsetLeft`, que no cambia con `translate`), y en
 * `--i` su turno; el movimiento lo hace el CSS con transiciones.
 */
function useDesplegar(fila) {
  useEffect(() => {
    const el = fila.current;
    if (!el) return undefined;
    const cartas = [...el.children];
    const medir = () => {
      const base = cartas[0]?.offsetLeft ?? 0;
      cartas.forEach((c, i) => {
        c.style.setProperty("--i", String(i));
        c.style.setProperty("--desde", `${base - c.offsetLeft}px`);
      });
    };
    medir();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver !== "function") {
      el.classList.add("is-desplegada");
      return undefined;
    }
    el.classList.add("is-plegable");
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) medir();
      el.classList.toggle("is-desplegada", e.isIntersecting);
    }, { threshold: 0.35 });
    obs.observe(el);
    window.addEventListener("resize", medir);
    return () => { obs.disconnect(); window.removeEventListener("resize", medir); };
  }, [fila]);
}

// Postales de viaje que acompanan a la de la foto, abiertas en abanico.
// Colombia va la primera, justo detras de la tarjeta de Jorge (26-09-2026).
const postales = [
  // Colombia no es un dibujo: una ilustracion hecha aparte (Valle del Cocora
  // con un oso de anteojos), con los mismos colores y matasellos.
  { lugar: "colombia", titulo: { es: "Colombia", en: "Colombia" }, pie: "4° N", giro: 3,
    imagen: "images/postal-colombia.webp" },
  { lugar: "canada", titulo: { es: "Canadá", en: "Canada" }, pie: "56° N", giro: 9 },
  { lugar: "miami", titulo: { es: "Miami", en: "Miami" }, pie: "25° N", giro: -5 },
  { lugar: "florida", titulo: { es: "Florida", en: "Florida" }, pie: "28° N", giro: 4 },
  { lugar: "china", titulo: { es: "China", en: "China" }, pie: "40° N", giro: -6 },
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
        {/* Dos renglones fijos ("Jorge Andres" / "Fajardo Mora"): partido
            donde cayera, el nombre ocupaba cuatro lineas en una cabecera de
            dos y se cortaba por arriba y por abajo. La letra se ajusta al
            ancho de la carta (ver `.footer__nombre` en el CSS). */}
        <h3 className="poster__titulo footer__nombre" aria-label={site.name}>
          <span aria-hidden="true">{site.name.split(" ").slice(0, 2).join(" ")}</span>
          <span aria-hidden="true">{site.name.split(" ").slice(2).join(" ")}</span>
        </h3>
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
  const firma = useRef(null);
  useDesplegar(firma);

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
            <a {...enlaceCorreo(site.email)}>{site.email}</a>
            <span>{tr(site.location)}</span>
            <span>{tr(site.role)}</span>
          </div>
        </div>

        {/* Se leen de izquierda a derecha: primero la tarjeta de Jorge,
            despues los viajes y al final "¿Y tu?" (Jorge, 26-09-2026). Cada
            una va por DEBAJO de la anterior, y al llegar al pie salen de
            debajo de la tarjeta de una en una (ver `useDesplegar`). */}
        <div className="footer__firma" ref={firma}>
          <TarjetaFoto />
          {postales.map((p, i) => <Postal key={p.lugar} {...p} vol={i + 1} />)}
          <Postal {...postalTu} />
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
