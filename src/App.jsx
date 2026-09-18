import { useEffect, useRef, useState } from "react";
import ViewCanvas from "./three/ViewCanvas";
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
  // El cargador no se desmonta al entrar: se queda encima mientras se funde,
  // con el sitio ya montado debajo. Sin eso quedaría un negro entre los dos.
  const [introGone, setIntroGone] = useState(false);
  const [holeReady, setHoleReady] = useState(false);

  useSmoothScroll();
  useReveal(root);

  useEffect(() => {
    // Bloqueamos el scroll mientras el selector esta delante
    document.body.classList.toggle("is-locked", !introGone);
    if (entered) {
      window.scrollTo({ top: 0, behavior: "instant" });
      ScrollTrigger.refresh();
    }
  }, [entered, introGone]);

  return (
    <LangProvider>
      <MusicProvider active={holeReady}>
      {holeReady && !introGone && <MusicPlayer intro />}
      {!introGone ? <Loader onEnter={() => setEntered(true)} onDone={() => setIntroGone(true)} onReady={setHoleReady} /> : null}

      <div ref={root} inert={!entered}>
        <Nav />

        <main>
          {/* Hero y orbita comparten un solo agujero negro, que viaja de uno
              a otra con el scroll. */}
          <Stage entered={entered} />
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
      {entered && <ViewCanvas eventSource={root} />}
      </MusicProvider>
    </LangProvider>
  );
}
