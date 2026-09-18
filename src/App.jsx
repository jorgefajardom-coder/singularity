import { Suspense, lazy, useEffect, useRef, useState } from "react";

// El stack 3D (three + r3f, 1,16 MB) se carga aparte. Si se importa de forma
// estatica, el navegador tiene que parsearlo entero ANTES de poder pintar el
// infinito del cargador, que es SVG y no necesita nada de eso: eran ~4 s de
// pantalla en negro. Asi el cargador aparece enseguida y el 3D llega mientras
// el contador sube.
const ViewCanvas = lazy(() => import("./three/ViewCanvas"));
import Nav from "./components/Nav";
import Stage from "./components/Stage";
import Gallery from "./components/Gallery";
import About from "./components/About";
import Stack from "./components/Stack";
import Services from "./components/Services";
import Projects from "./components/Projects";
import Certifications from "./components/Certifications";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import Loader from "./components/Loader";
import { LangProvider } from "./lib/i18n";
import { MusicProvider } from "./lib/music";
import MusicPlayer from "./components/MusicPlayer";
import { useSmoothScroll, useReveal, ScrollTrigger } from "./lib/anim";

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

  useSmoothScroll();
  useReveal(root);

  // Bloqueamos el scroll mientras el cargador esta delante
  useEffect(() => {
    document.body.classList.toggle("is-locked", !introGone);
  }, [introGone]);

  // El recalculo va SOLO aqui, cuando la pagina ya puede desplazarse. Hacerlo
  // tambien al arrancar el morph medía posiciones contra un body con
  // `overflow: hidden`, asi que salian mal y habia que repetirlo igualmente:
  // eran ~90 ms de parón en el fotograma mas visible de toda la intro.
  useEffect(() => {
    if (!introGone) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    ScrollTrigger.refresh();
  }, [introGone]);

  return (
    <LangProvider>
      <MusicProvider active={holeReady}>
      {holeReady && !introGone && <MusicPlayer intro />}
      {!introGone ? <Loader onWarm={() => setWarm(true)} onEnter={() => setEntered(true)} onDone={() => setIntroGone(true)} onReady={setHoleReady} /> : null}

      <div ref={root} inert={!entered}>
        <Nav />

        <main>
          {/* Hero y orbita comparten un solo agujero negro, que viaja de uno
              a otra con el scroll. */}
          <Stage entered={entered} warm={warm} />
          <Gallery />
          <About />
          <Stack />
          <Services />
          <Projects />
          <Certifications />
          <Contact />
        </main>

        <Footer />
      </div>

      {/* Canvas único para todas las vistas 3D. Va al final para que
          `root.current` ya exista cuando se monte. */}
      {warm && <Suspense fallback={null}><ViewCanvas eventSource={root} /></Suspense>}
      </MusicProvider>
    </LangProvider>
  );
}
