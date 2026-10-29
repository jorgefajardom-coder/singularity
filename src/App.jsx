import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import SinConexion from "./components/SinConexion";
import { LangProvider } from "./lib/i18n";
import { MusicProvider } from "./lib/music";
import { marcarIntroTerminada, useTrasIntro } from "./lib/arranque";
import { useSmoothScroll, useReveal, ScrollTrigger, scroller, destinoAncla } from "./lib/anim";
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
  // Los lienzos WebGL se montan mientras sube el porcentaje, detras del
  // cargador, que es opaco y los tapa: son parte de la carga que cuenta.
  // Montarlos al empezar el morph costaba ~97 ms de parón justo en el
  // fotograma mas visible.
  const [warm, setWarm] = useState(false);
  // El cargador no se desmonta al entrar: se queda encima mientras se funde,
  // con el sitio ya montado debajo. Sin eso quedaría un negro entre los dos.
  const [introGone, setIntroGone] = useState(false);
  const [holeReady, setHoleReady] = useState(false);
  // El agujero del hero ya compilado: el cargador no cierra su ∞ sin el.
  const [heroListo, setHeroListo] = useState(false);
  // Arranco la transformacion: desde aqui cuentan las animaciones del hero.
  const [revelar, setRevelar] = useState(false);
  // Durante la intro los dos lienzos del agujero negro estan vivos a la vez.
  // Aqui el del cargador publica su estado y el del hero lo copia, para que el
  // relevo no cruce dos imagenes distintas (ver BlackHole.jsx).
  const espejo = useRef(null);
  const marcarHeroListo = useCallback(() => setHeroListo(true), []);

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
      if (lenis) lenis.scrollTo(destinoAncla(destino), { immediate: true, force: true });
      else destino.scrollIntoView();
    } else if (window.scrollY !== 0) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    // Da paso a los lienzos de mas abajo (ver lib/arranque.js).
    marcarIntroTerminada();
  }, [introGone]);

  // Si lo de encima del Stack cambia de alto DESPUES de medir (imagenes o
  // fuentes que llegan tarde en otra red, otro navegador), los tramos fijados
  // quedaban con posiciones viejas y la baraja podia quedarse fija encima de
  // otras secciones (video de otro equipo, 27-09-2026). No se refresca en
  // `load` a proposito (ver lib/anim.js): aqui solo tras la intro, solo si
  // `.stage` cambia de verdad y nunca con la pagina anclada.
  useEffect(() => {
    if (!introGone || typeof ResizeObserver !== "function") return undefined;
    const stage = document.querySelector(".stage");
    if (!stage) return undefined;
    let alto = stage.offsetHeight;
    let espera = 0;
    const revisar = () => {
      const ahora = stage.offsetHeight;
      if (Math.abs(ahora - alto) < 24) return;
      if (document.body.classList.contains("is-anchored") || document.documentElement.classList.contains("lenis-stopped")) {
        espera = window.setTimeout(revisar, 500);
        return;
      }
      alto = ahora;
      ScrollTrigger.refresh();
    };
    const ro = new ResizeObserver(() => { window.clearTimeout(espera); espera = window.setTimeout(revisar, 300); });
    ro.observe(stage);
    return () => { ro.disconnect(); window.clearTimeout(espera); };
  }, [introGone]);

  // En el telefono, las animaciones decorativas de una seccion lejos de la
  // pantalla se pausan (`data-fuera`, ver movil.css). El brillo de los "+" de
  // Proyectos (box-shadow), la franja "en obra" (background-position) y las
  // cartas del Stack seguian animando en Meditacion: estilo y repintado en
  // cada fotograma, y con cada repintado el telefono reordenaba sus ~100
  // capas. Eran los tics al desplazar (Redmi, 29-10-2026).
  useEffect(() => {
    if (!perfil.movil || typeof IntersectionObserver !== "function") return undefined;
    const secciones = ["#stack", "#projects"].map((s) => document.querySelector(s)).filter(Boolean);
    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) delete e.target.dataset.fuera;
        else e.target.dataset.fuera = "true";
      }
    }, { rootMargin: "50% 0px 50% 0px" });
    secciones.forEach((s) => obs.observe(s));
    // La fila de cartas del Stack, ademas, no se pinta hasta que va a entrar
    // en pantalla (`data-lejos`, ver movil.css). Justo debajo de Meditacion,
    // sin verse, el telefono la rasterizaba en cada fotograma (once cartas en
    // capa, con su vaiven y sus ilustraciones animadas) y la transformacion
    // del astronauta iba a 21 fps con parones de 400 ms; oculta, a 37 fps
    // (Redmi, 29-10-2026). `visibility` no cambia la maqueta ni el anclaje.
    const fila = document.querySelector(".posters");
    const obsFila = fila && new IntersectionObserver(([e]) => {
      if (e.isIntersecting) delete fila.dataset.lejos;
      else fila.dataset.lejos = "true";
    }, { rootMargin: "0px 0px 15% 0px" });
    obsFila?.observe(fila);
    return () => { obs.disconnect(); obsFila?.disconnect(); };
  }, []);

  // La pista arranca al pulsar la cinta del cargador (`entered` se enciende en
  // ese mismo clic), tambien en el telefono (Jorge, 26-09-2026). Ya viene
  // decodificada de la carga (ver `precargarPista`), asi que no compite con
  // la transformacion mas que por el analisis de cada fotograma.
  const musica = entered || introGone;

  // Lo que no depende de la intro, memorizado: pulsar la cinta (`entered`)
  // re-renderizaba la pagina entera en el mismo fotograma del toque, y eso es
  // lo que se espera antes de que empiece la transformacion (Jorge,
  // 28-09-2026). Con el idioma nuevo se re-renderiza igual (van por contexto).
  const barra = useMemo(() => <Aislado nombre="la barra"><Nav /></Aislado>, []);
  const secciones = useMemo(() => (
    <>
      <Aislado nombre="Areas"><Services /></Aislado>
      <Aislado nombre="Proyectos"><Projects /></Aislado>
      <Aislado nombre="Formacion"><Certifications /></Aislado>
      <Aislado nombre="Contacto"><Contact /></Aislado>
    </>
  ), []);
  const pie = useMemo(() => <Aislado nombre="el pie"><Footer /></Aislado>, []);

  return (
    <LangProvider>
      <MusicProvider active={musica}>
      {!introGone ? <Loader espejo={espejo} onWarm={() => setWarm(true)} onEnter={() => setEntered(true)} onDone={() => setIntroGone(true)} onReady={setHoleReady} onMorph={() => setRevelar(true)} heroListo={heroListo} /> : null}

      <Starfield />

      <div ref={root} inert={!entered}>
        {barra}

        <main>
          {/* Hero y orbita comparten un solo agujero negro, que viaja de uno
              a otra con el scroll. */}
          <Aislado nombre="el hero"><Stage entered={entered} revelar={revelar || introGone} warm={warm} espejo={espejo} onListo={marcarHeroListo} /></Aislado>
          {secciones}
        </main>

        {pie}
      </div>

      {/* Canvas único para todas las vistas 3D. Va al final para que
          `root.current` ya exista cuando se monte. */}
      <Lienzo3D eventSource={root} />
      <Aislado nombre="el aviso de conexion"><SinConexion /></Aislado>
      </MusicProvider>
    </LangProvider>
  );
}
