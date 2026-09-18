import { useEffect, useState } from "react";
import { nav, site, ui } from "../data/content";
import { useLang, LangToggle } from "../lib/i18n";
import MusicPlayer from "./MusicPlayer";
import { RollText } from "./ui";

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
    const height = Math.ceil(bar.getBoundingClientRect().height) || 80;
    const rest = Math.max(0, window.innerHeight - height);

    const visible = new Set();
    const observer = new IntersectionObserver(
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
    return () => observer.disconnect();
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

      <div className="nav__right">
        <nav className="nav__links" aria-label={tr(ui.navigation)}>
          {nav.map((item) => (
            <a key={item.href} href={item.href}>
              <RollText>{tr(item.label)}</RollText>
            </a>
          ))}
        </nav>
        <a className="btn" href="#contact">
          {tr(ui.contactCta)}
        </a>
      </div>
    </header>
  );
}
