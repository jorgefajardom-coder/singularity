import { useCallback, useEffect, useRef, useState } from "react";
import { ui } from "../data/content";
import { useLang } from "../lib/i18n";
import { scroller } from "../lib/anim";
import { asset } from "../lib/asset";

/**
 * Pantalla de "sin conexion".
 *
 * Lo ya cargado sigue funcionando sin red (el agujero, la musica ya
 * decodificada), pero los modelos 3D de Proyectos, las imagenes que aun no
 * han llegado y el formulario de contacto no. Sin aviso, eso se veia como un
 * visor que no carga nunca o un envio que falla sin razon.
 *
 * `navigator.onLine` solo dice si hay una interfaz de red, no si hay
 * Internet, y en el telefono parpadea al cambiar de antena: se espera un
 * poco antes de enseñarla y, al volver, se comprueba con una peticion de
 * verdad antes de quitarla.
 */
const ESPERA_MS = 1500;

async function hayRed() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  try {
    const ctrl = new AbortController();
    const corte = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`${asset("/favicon.png")}?red=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: ctrl.signal });
    clearTimeout(corte);
    return r.ok;
  } catch {
    return false;
  }
}

export default function SinConexion() {
  const { tr } = useLang();
  const [visible, setVisible] = useState(false);
  const [probando, setProbando] = useState(false);
  const [aviso, setAviso] = useState(false);
  const retener = useRef(0);
  const boton = useRef(null);
  // Lenis solo se reanuda si lo paro esta pantalla: si ya estaba parado (el
  // cargador, una galaxia abierta), no es cosa suya.
  const paroLenis = useRef(false);

  const cerrar = useCallback((recuperada) => {
    setVisible(false);
    if (recuperada) {
      setAviso(true);
      window.setTimeout(() => setAviso(false), 2600);
    }
  }, []);

  const comprobar = useCallback(async () => {
    setProbando(true);
    const ok = await hayRed();
    setProbando(false);
    if (ok) cerrar(true);
  }, [cerrar]);

  useEffect(() => {
    const alPerder = () => {
      window.clearTimeout(retener.current);
      retener.current = window.setTimeout(() => {
        if (navigator.onLine === false) setVisible(true);
      }, ESPERA_MS);
    };
    const alVolver = async () => {
      window.clearTimeout(retener.current);
      if (await hayRed()) cerrar(true);
    };
    window.addEventListener("offline", alPerder);
    window.addEventListener("online", alVolver);
    if (navigator.onLine === false) alPerder();
    return () => {
      window.clearTimeout(retener.current);
      window.removeEventListener("offline", alPerder);
      window.removeEventListener("online", alVolver);
    };
  }, [cerrar]);

  // Mientras esta delante no se desplaza la pagina por debajo.
  useEffect(() => {
    const lenis = scroller.current;
    if (visible) {
      boton.current?.focus({ preventScroll: true });
      if (lenis && !document.documentElement.classList.contains("lenis-stopped")) {
        lenis.stop();
        paroLenis.current = true;
      }
      document.body.classList.add("is-offline");
    } else {
      document.body.classList.remove("is-offline");
      if (paroLenis.current) {
        paroLenis.current = false;
        lenis?.start();
      }
    }
  }, [visible]);

  return (
    <>
      {visible ? (
        <div className="offline" role="alertdialog" aria-modal="true" aria-labelledby="offline-titulo" aria-describedby="offline-texto">
          <div className="offline__card">
            <div className="offline__hole" aria-hidden="true"><span /></div>
            <p className="offline__eyebrow">{tr(ui.offline.eyebrow)}</p>
            <h2 id="offline-titulo" className="offline__title">{tr(ui.offline.title)}</h2>
            <p id="offline-texto" className="offline__text">{tr(ui.offline.text)}</p>
            <div className="offline__actions">
              <button ref={boton} type="button" className="btn" onClick={comprobar} disabled={probando}>
                {probando ? tr(ui.offline.checking) : tr(ui.offline.retry)}
              </button>
              <button type="button" className="offline__skip" onClick={() => cerrar(false)}>{tr(ui.offline.dismiss)}</button>
            </div>
          </div>
        </div>
      ) : null}
      <p className="offline-toast" data-show={aviso ? "true" : "false"} role="status" aria-live="polite">
        {aviso ? tr(ui.offline.back) : ""}
      </p>
    </>
  );
}
