import { Suspense, lazy, useEffect, useRef, useState } from "react";

// El stack 3D (three + r3f, 1,16 MB) se carga aparte. Si se importa de forma
// estatica, el navegador tiene que parsearlo entero ANTES de poder pintar el
// infinito del cargador, que es SVG y no necesita nada de eso: eran ~4 s de
// pantalla en negro. Asi el cargador aparece enseguida y el 3D llega mientras
// el contador sube.
const ViewCanvas = lazy(() => import("./three/ViewCanvas"));
import Nav from "./components/Nav";
import Stage from "./components/Stage";
import Starfield from "./components/Starfield";
import Services from "./components/Services";
import Projects from "./components/Projects";
import Certifications from "./components/Certifications";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import Loader from "./components/Loader";
import Aislado from "./components/Aislado";
import { LangProvider } from "./lib/i18n";
import { MusicProvider } from "./lib/music";
import { marcarIntroTerminada, useTrasIntro } from "./lib/arranque";
import { useSmoothScroll, useReveal, ScrollTrigger, scroller, altoBarra } from "./lib/anim";
import { perfil, useGpuFallo } from "./lib/gpu";
import { useVistas } from "./lib/vistas";

/**
 * El lienzo 3D compartido solo existe si alguna vista lo necesita. En el
 * telefono ademas espera a que haya una cerca: alli el unico 3D del lienzo
 * son los visores de Proyectos, y abrir su contexto al cargar la pagina era
 * un contexto WebGL mas, vivo durante todo el recorrido, para nada.
 */
function Lienzo3D({ eventSource }) {
  const listo = useTrasIntro(2);
  const fallo = useGpuFallo();
  const { cerca } = useVistas();
  const [pedido, setPedido] = useState(!perfil.movil);
  useEffect(() => { if (cerca > 0) setPedido(true); }, [cerca]);
  if (!listo || fallo || !pedido) return null;
  return (
    <Aislado nombre="el lienzo 3D">
      <Suspense fallback={null}><ViewCanvas eventSource={eventSource} /></Suspense>
    </Aislado>
  );
}

export default function App() {
  const root = useRef(null);
  // El sitio no se recorre hasta que el cargador entrega el idioma elegido
  const [entered, setEntered] = useState(false);
  // Los lienzos WebGL se montan ANTES de que el usuario elija idioma, detras
  // del cargador, que es opaco y los tapa. Montarlos al empezar el morph
  // costaba ~97 ms de parón justo en el fotograma mas visible.
  const [warm, setWarm] = useState(false);
  // El cargador no se desmonta al entrar: se queda encima mientras se funde,
  // con el sitio ya montado debajo. Sin eso quedaría un negro entre los dos.
  const [introGone, setIntroGone] = useState(false);
  const [holeReady, setHoleReady] = useState(false);
  // Durante la intro los dos lienzos del agujero negro estan vivos a la vez.
  // Aqui el del cargador publica su estado y el del hero lo copia, para que el
  // relevo no cruce dos imagenes distintas (ver BlackHole.jsx).
  const espejo = useRef(null);

  useSmoothScroll();
  useReveal(root);

  // Bloqueamos el scroll mientras el cargador esta delante. El `overflow` del
  // body no para a Lenis, que lleva el scroll por su cuenta: hay que pararlo.
  useEffect(() => {
    document.body.classList.toggle("is-locked", !introGone);
    const lenis = scroller.current;
    if (!introGone) lenis?.stop();
    else lenis?.start();
  }, [introGone]);

  // El recalculo va SOLO aqui, cuando la pagina ya puede desplazarse. Hacerlo
  // tambien al arrancar el morph medía posiciones contra un body con
  // `overflow: hidden`, asi que salian mal y habia que repetirlo igualmente:
  // eran ~90 ms de parón en el fotograma mas visible de toda la intro.
  useEffect(() => {
    if (!introGone) return;
    ScrollTrigger.refresh();
    // Si la URL trae un ancla (un enlace compartido a #contact, volver
    // atras), se respeta: se va ahi en vez de al principio. Sin ancla, la
    // intro termina en el hero, que es donde aterriza el agujero.
    let destino;
    try { destino = location.hash ? document.querySelector(decodeURIComponent(location.hash)) : null; } catch { destino = null; }
    const lenis = scroller.current;
    if (destino) {
      if (lenis) lenis.scrollTo(destino, { immediate: true, force: true, offset: -(altoBarra() + 8) });
      else destino.scrollIntoView();
    } else if (window.scrollY !== 0) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    // Da paso a los lienzos de mas abajo (ver lib/arranque.js).
    marcarIntroTerminada();
  }, [introGone]);

  // La musica y su analisis arrancan con el agujero ya pintado. En el
  // telefono, ademas, esperan a que termine la intro: decodificar audio y
  // analizarlo cada fotograma encima de la parte mas pesada de la
  // transformacion era competir por el mismo presupuesto de fotograma.
  const musica = perfil.movil ? introGone : holeReady || introGone;

  return (
    <LangProvider>
      <MusicProvider active={musica}>
      {!introGone ? <Loader espejo={espejo} onWarm={() => setWarm(true)} onEnter={() => setEntered(true)} onDone={() => setIntroGone(true)} onReady={setHoleReady} /> : null}

      <Starfield />

      <div ref={root} inert={!entered}>
        <Aislado nombre="la barra"><Nav /></Aislado>

        <main>
          {/* Hero y orbita comparten un solo agujero negro, que viaja de uno
              a otra con el scroll. */}
          <Aislado nombre="el hero"><Stage entered={entered} warm={warm} espejo={espejo} /></Aislado>
          <Aislado nombre="Areas"><Services /></Aislado>
          <Aislado nombre="Proyectos"><Projects /></Aislado>
          <Aislado nombre="Formacion"><Certifications /></Aislado>
          <Aislado nombre="Contacto"><Contact /></Aislado>
        </main>

        <Aislado nombre="el pie"><Footer /></Aislado>
      </div>

      {/* Canvas único para todas las vistas 3D. Va al final para que
          `root.current` ya exista cuando se monte. */}
      <Lienzo3D eventSource={root} />
      </MusicProvider>
    </LangProvider>
  );
}
