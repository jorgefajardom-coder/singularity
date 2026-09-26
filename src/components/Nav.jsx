import { useEffect, useState } from "react";
import { site, ui } from "../data/content";
import { useLang, LangToggle } from "../lib/i18n";
import MusicPlayer from "./MusicPlayer";

/**
 * Barra fija, visible en todo momento.
 *
 * Antes se escondía al bajar y reaparecía al subir. Se quitó a propósito: los
 * controles de música e idioma y el botón de contacto tienen que estar
 * siempre a mano, no solo cuando el visitante cambia de dirección.
 */
export default function Nav() {
  const { tr } = useLang();
  // Los paneles claros ("Qué hago" y "Contacto") pasan por debajo de la barra
  // y su texto claro se volvia ilegible sobre el papel. Cuando uno de ellos
  // esta detras, la barra se pone una franja oscura.
  const [onPaper, setOnPaper] = useState(false);

  useEffect(() => {
    const panels = document.querySelectorAll(".panel--paper");
    const bar = document.querySelector(".nav");
    if (!panels.length || !bar) return;

    // La raiz se recorta a la franja que ocupa la barra: intersecar ahi
    // significa literalmente "esto esta ahora mismo debajo de la barra". La
    // altura se mide, no se estima: con un porcentaje fijo la franja quedaba
    // mas corta que la barra y los paneles pasaban por debajo sin detectarse.
    //
    // El recorte depende del alto de la ventana y del de la barra, asi que
    // el observador se REHACE cuando cambia cualquiera de los dos: al girar
    // el telefono, al aparecer o esconderse la barra del navegador movil o
    // al cambiar la barra de alto (hay puntos de corte que la encogen).
    let observer = null;
    let medida = "";
    const visible = new Set();
    const montar = () => {
      const height = Math.ceil(bar.getBoundingClientRect().height) || 80;
      const rest = Math.max(0, window.innerHeight - height);
      const clave = `${height}/${rest}`;
      if (clave === medida) return;
      medida = clave;
      // El alto real de la barra, para `scroll-margin-top` de los anclas.
      document.documentElement.style.setProperty("--alto-barra", `${height + 8}px`);
      observer?.disconnect();
      visible.clear();
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target);
            else visible.delete(entry.target);
          }
          setOnPaper(visible.size > 0);
        },
        { rootMargin: `0px 0px -${rest}px 0px`, threshold: 0 }
      );
      panels.forEach((panel) => observer.observe(panel));
    };
    montar();
    let espera = 0;
    const alCambiar = () => { cancelAnimationFrame(espera); espera = requestAnimationFrame(montar); };
    window.addEventListener("resize", alCambiar);
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(alCambiar) : null;
    ro?.observe(bar);
    return () => {
      cancelAnimationFrame(espera);
      window.removeEventListener("resize", alCambiar);
      ro?.disconnect();
      observer?.disconnect();
    };
  }, []);

  return (
    <header className="nav" data-on-paper={onPaper ? "true" : "false"}>
      {/* El nombre completo donde cabe; el monograma cuando la barra se
          estrecha. Las dos formas van en el DOM y las alterna el CSS, para no
          depender de un listener de resize. `aria-hidden` en la que no se ve
          evita que un lector de pantalla lea el nombre dos veces. */}
      <a className="nav__mark" href="#top" aria-label={site.name}>
        <span className="nav__mark-full" aria-hidden="true">{site.name}</span>
        <span className="nav__mark-short" aria-hidden="true">{tr(site.short)}</span>
      </a>

      {/* Música e idioma comparten cápsula, centrada en la barra. El
          reproductor vive aquí y no flotando abajo, donde tapaba el indicador
          de scroll del hero. */}
      <div className="nav__controls">
        <MusicPlayer inline />
        <LangToggle />
      </div>

      {/* Sin enlaces de seccion: la barra se queda con la marca, los controles
          y el contacto. El recorrido del sitio es el scroll, y el pie sigue
          teniendo la navegacion completa para quien la quiera. */}
      <div className="nav__right">
        {/* En telefonos estrechos el texto se cambia por un sobre (ver
            global.css); el nombre accesible es el mismo en los dos casos. */}
        <a className="btn nav__contacto" href="#contact" aria-label={tr(ui.contactCta)}>
          <span className="nav__contacto-texto" aria-hidden="true">{tr(ui.contactCta)}</span>
          <svg className="nav__contacto-icono" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="3" y="5.5" width="18" height="13" rx="2" />
            <path d="m3.5 7 8.5 6 8.5-6" />
          </svg>
        </a>
      </div>
    </header>
  );
}
