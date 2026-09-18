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

  return (
    <header className="nav">
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
