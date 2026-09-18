import { useEffect, useRef, useState } from "react";
import { nav, site, ui } from "../data/content";
import { useLang, LangToggle } from "../lib/i18n";
import MusicPlayer from "./MusicPlayer";
import { RollText } from "./ui";

/** Barra fija que se esconde al bajar y reaparece al subir. */
export default function Nav() {
  const { tr } = useLang();
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 160 && y > last.current);
      last.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="nav" data-hidden={hidden ? "true" : "false"}>
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
