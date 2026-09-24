import { Suspense, lazy, useEffect, useRef, useState } from "react";

const BlackHole = lazy(() => import("./BlackHole"));
import Hero from "./Hero";
import Orbit from "./Orbit";
import Companies from "./Companies";
import About from "./About";
import Meditation from "./Meditation";
import { companies, sections } from "../data/content";
import { gsap, ScrollTrigger, prefersReducedMotion } from "../lib/anim";
import { heroBase } from "../lib/stagePose";

/**
 * Primera pantalla y órbita comparten un solo agujero negro.
 *
 * El lienzo es `sticky`: se queda pegado al viewport durante todo el bloque,
 * así que el agujero no se va con el hero sino que viaja. El scroll escribe en
 * `journey` (un ref, no estado: se lee 60 veces por segundo) y lo leen tanto el
 * shader como las marcas en órbita, que de este modo comparten un único origen
 * de coordenadas sin re-renderizar nada.
 *
 *   fase 1  DIVE  el agujero baja a la zona inferior y se aleja; las marcas
 *                 entran en órbita, vistas de canto
 *   fase 2  TURN  la cámara se levanta hasta mirar desde arriba y el agujero
 *                 vuelve al centro: la elipse se abre en círculo (planetario)
 *   fase 3  FALL  las órbitas se cierran y las marcas caen al horizonte
 */

const DIVE = [0.0, 0.3];
const TURN = [0.26, 0.64];
const FALL = [0.6, 1.0];
// Una vez se las ha tragado todas, el agujero se aleja en lugar de quedarse
// ocupando la pantalla antes de emprender el viaje hacia la mano.
const EXIT = [0.86, 1.0];

// La cara en las dos figuras, en fraccion de su caja: centro (x, y) y ancho.
// Medido sobre los tonos de piel de about-astronaut-gaze (caja
// `.about__float`) y de la figura que medita dentro de `.meditation__portrait`
// (ver `.meditation__image` en el CSS). El astronauta de Sobre mi se lleva su
// cara hasta la del que medita y ahi se transforma en el.
const ABOUT_FACE = { x: 0.481, y: 0.281, w: 0.341 };
const MEDITATION_FACE = { x: 0.486, y: 0.294, w: 0.522 };

// Cuanto se agranda el agujero al aterrizar en las manos. Ver el uso.
const LANDED_SCALE = 0.42;
// El lienzo que baja a las manos mide HAND_ROOM veces el hueco entre ellas, y
// el disco se dibuja en proporcion mas pequeno dentro: en pantalla sale del
// mismo tamano, pero ya no se da contra los bordes. Con el lienzo del tamano
// justo del hueco, el disco de canto (radio vertical ~0.59 en coordenadas del
// shader) medía 1,4 veces su alto y se cortaba arriba y abajo.
const HAND_ROOM = 4.2;
// En las manos del que medita el agujero va un 30 % mas grande que en las de
// Sobre mi.
const MEDITATION_GROWTH = 1.3;

const span = ([a, b], p) => Math.min(1, Math.max(0, (p - a) / (b - a)));
// Suaviza los extremos: sin esto cada fase arranca y frena de golpe.
const ease = (x) => x * x * (3 - 2 * x);

export default function Stage({ entered, warm, espejo }) {
  const stage = useRef(null);
  const copy = useRef(null);
  const carrier = useRef(null);
  const traveler = useRef(null);
  const [lensed, setLensed] = useState(false);
  const reduced = prefersReducedMotion();

  // Estado compartido shader <-> DOM. `cx`/`cy` van en fracción de media
  // pantalla con la Y hacia arriba, que es como los quiere el shader.
  const base = heroBase();
  const journey = useRef({ cx: 0, cy: base.cy, scale: base.scale, topDown: 0, fall: 0, lens: 1, p: 0 });
  const orbitPose = useRef({ cx: 0, cy: base.cy, scale: base.scale, topDown: 0, fall: 0, p: 0 });

  // Al girar el telefono o cambiar el tamano de la ventana, el reposo se
  // recalcula. Solo mientras el agujero sigue quieto: en pleno viaje manda
  // el scroll y pisarlo daria un salto.
  //
  // Se escribe en `orbitPose` y solo ahi: `journey` lo recalcula `follow()` a
  // partir de el en el fotograma siguiente, asi que escribirlo aqui tambien
  // no hacia nada y hacia pensar que el reposo vive en dos sitios.
  useEffect(() => {
    const onResize = () => {
      if (orbitPose.current.p > 0.001) return;
      const next = heroBase();
      orbitPose.current.cy = next.cy;
      orbitPose.current.scale = next.scale;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // En desarrollo, para poder leer la fase desde la consola:
  // window.journey  ->  { p, cy, scale, topDown, fall }
  if (import.meta.env.DEV && typeof window !== "undefined") window.journey = journey;

  useEffect(() => {
    if (!entered || !warm || reduced) return;
    const anchor = stage.current.querySelector(".about__singularity");
    const about = stage.current.querySelector(".about");
    const meditation = stage.current.querySelector(".meditation");
    const portrait = stage.current.querySelector(".meditation__portrait");
    const finalHand = stage.current.querySelector(".meditation__singularity");
    const originalFrame = stage.current.querySelector(".about__float");
    const originalPose = stage.current.querySelector(".about__pose");
    const originalImage = stage.current.querySelector(".about__astronaut");
    const finalImage = stage.current.querySelector(".meditation__image");
    const finalFrame = stage.current.querySelector(".meditation__frame");
    const finalStats = stage.current.querySelector(".meditation__stats");
    // El texto de Sobre mi (titulo, parrafos, boton) y sus objetos 3D. No el
    // astronauta: ese es el que se transforma.
    const aboutParts = [
      about.querySelector(".shell > .display"),
      about.querySelector(".about__copy"),
      about.querySelector(".about__view"),
    ].filter(Boolean);
    // Los dos avances van con `scrub: true`, igual que el de la orbita, y eso
    // NO es intercambiable por un numero. Un `scrub: 0.8` no es una funcion de
    // la posicion del scroll: es un filtro que persigue al objetivo con retardo,
    // y el retardo depende de la DIRECCION. Como `follow()` mezcla cada
    // fotograma un `pose` sin retardo (lo escribe la orbita, que ya iba con
    // `scrub: true`) con esta `t` retardada —`pose.cy * (1 - t)`,
    // `pose.scale * (1 - t) + t`—, el producto tomaba de vuelta valores que a la
    // ida no ocurrian nunca: a la misma altura de scroll el agujero aparecia
    // bajando a `scale(1)` sin desplazar y subiendo a `scale(0.89)` corrido de
    // sitio. Se veia como que el agujero se descentra al devolver el scroll.
    //
    // Ademas los dos numeros eran distintos entre si (0.8 y 0.65), asi que el
    // salto entre las dos manos y el viaje del lienzo tampoco iban acompasados.
    // El suavizado ya lo pone Lenis sobre el propio scroll; aqui sobra.
    const closing = { progress: 0 };
    const closeTween = gsap.to(closing, {
      progress: 1,
      ease: "none",
      scrollTrigger: {
        trigger: meditation,
        start: "top bottom",
        end: "top top",
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
    const motion = { progress: 0 };
    const tween = gsap.to(motion, {
      progress: 1,
      ease: "none",
      scrollTrigger: {
        trigger: about,
        start: "top bottom",
        end: "top top",
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
    // El lienzo y el reloj del shader son los mismos durante todo el viaje.
    // La mano se mide en cada fotograma para que el aterrizaje acompane
    // tambien su flotacion en reposo.
    const follow = () => {
      // Con la camara dentro de una galaxia la escena esta ANCLADA (lo escribe
      // Halo.jsx). Parar a Lenis no basta: esta funcion corre en el ticker de
      // GSAP y vuelve a medir el marco flotante del astronauta en cada
      // fotograma, asi que la figura y el agujero seguian meciendose aunque el
      // scroll no se moviera. Saliendo aqui se quedan exactamente donde
      // estaban, que es lo unico que se puede llamar anclar.
      if (document.body.classList.contains("is-anchored")) return;
      const layer = traveler.current;
      const holder = carrier.current;
      if (!layer || !holder) return;
      // La caja del lienzo se mide ANTES de tocar nada: si todavia no tiene
      // tamano, el fotograma se salta entero. Estaba mas abajo, despues de
      // haber escrito ya la pose del astronauta y de haber volcado `pose` en
      // `journey`, asi que al salirse dejaba `journey` con la pose de orbita
      // sin mezclar y el agujero saltaba a su sitio de la orbita.
      const box = holder.getBoundingClientRect();
      const w = holder.clientWidth;
      const h = holder.clientHeight;
      if (!w || !h) return;
      const t = ease(motion.progress);
      const closingProgress = ease(closing.progress);
      // Primero viaja y despues se transforma: con los dos tramos a la vez, a
      // mitad del fundido las dos caras estaban a 400 px una de otra y se
      // veian dos astronautas.
      const travel = ease(span([0, 0.5], closingProgress));
      const dissolve = ease(span([0.45, 0.9], closingProgress));
      // Meditacion es una seccion aparte: mientras el astronauta viaja hacia
      // ella, el resto de Sobre mi se retira. Como el que medita espera en su
      // sitio mientras su seccion entra (ver `lift`), sin esto el boton
      // "Trabajemos juntos" seguia asomando arriba con las galaxias ya fuera.
      const aboutFade = ease(span([0.2, 0.55], closingProgress));
      for (const el of aboutParts) {
        el.style.opacity = aboutFade > 0 ? String(1 - aboutFade) : "";
        el.style.pointerEvents = aboutFade > 0.5 ? "none" : "";
      }
      // El que medita espera ya en su sitio de reposo mientras su seccion
      // entra: se le resta lo que al marco (sticky) le falta para llegar
      // arriba. Si no, la cara de destino seguia subiendo con el scroll
      // durante el fundido y no habia forma de que las dos coincidieran. El
      // marco recorta, asi que mientras tanto deja ver lo que sale de el; y el
      // retrato, aun invisible, no puede quedarse interceptando clics encima
      // de Sobre mi.
      const lift = Math.max(0, finalFrame.getBoundingClientRect().top);
      portrait.style.transform = lift > 0 ? `translateY(var(--retrato-y)) translateY(${-lift}px)` : "";
      portrait.style.pointerEvents = lift > 0 ? "none" : "";
      // Los contadores salen con el astronauta (ver Meditation.jsx): esperan
      // con el en su sitio, o saldrian por debajo del borde de la pantalla.
      if (finalStats) finalStats.style.transform = lift > 0 ? `translateY(${-lift}px)` : "";
      finalFrame.style.overflow = lift > 0 ? "visible" : "";
      const origin = originalFrame.getBoundingClientRect();
      const destination = portrait.getBoundingClientRect();
      // Lleva la cara del astronauta de Sobre mi hasta la del que medita,
      // con su tamano, y ahi los funde: se lee como que uno se convierte en el
      // otro. La pose escala desde arriba al centro (`transform-origin` en el
      // CSS), asi que la cara se mide ya escalada.
      const faceScale = (MEDITATION_FACE.w * destination.width) / (ABOUT_FACE.w * origin.width);
      const poseScale = 1 + (faceScale - 1) * travel;
      const faceX = origin.left + origin.width * (0.5 + (ABOUT_FACE.x - 0.5) * poseScale);
      const faceY = origin.top + origin.height * ABOUT_FACE.y * poseScale;
      const poseX = (destination.left + destination.width * MEDITATION_FACE.x - faceX) * travel;
      const poseY = (destination.top + destination.height * MEDITATION_FACE.y - faceY) * travel;
      originalPose.style.transform = `translate3d(${poseX}px, ${poseY}px, 0) scale(${poseScale})`;
      originalPose.style.opacity = 1 - dissolve;
      // En el cruce, un destello: las dos figuras se aclaran y se desenfocan
      // un poco y vuelven a enfocarse ya convertidas. Cero en los extremos.
      const glow = Math.sin(Math.PI * dissolve);
      const flare = glow > 0.001 ? ` brightness(${(1 + 0.9 * glow).toFixed(3)}) blur(${(2.5 * glow).toFixed(2)}px)` : "";
      originalImage.style.filter = flare ? flare.trim() : "";
      // La del que medita lleva su propio `brightness(0.75)` en el CSS.
      finalImage.style.filter = flare ? `brightness(${(0.75 * (1 + 0.9 * glow)).toFixed(3)}) blur(${(2.5 * glow).toFixed(2)}px)` : "";
      portrait.style.opacity = dissolve;
      const pose = orbitPose.current;
      Object.assign(journey.current, pose);
      const firstHand = anchor.getBoundingClientRect();
      const lastHand = finalHand.getBoundingClientRect();
      // Va en las manos de Sobre mi mientras viaja (el ancla se mueve con la
      // pose) y cambia de manos durante la transformacion.
      const handMix = dissolve;
      const hand = {
        left: firstHand.left * (1 - handMix) + lastHand.left * handMix,
        top: firstHand.top * (1 - handMix) + lastHand.top * handMix,
        width: firstHand.width * (1 - handMix) + lastHand.width * handMix,
        height: firstHand.height * (1 - handMix) + lastHand.height * handMix,
      };
      // Con altura cero no hay logaritmo que valga: log(0) es -Infinito y, en
      // el arranque (t = 0), -Infinito * 0 da NaN. Un `scale(NaN)` no es que
      // se ignore, es que el navegador tira la declaracion entera, asi que el
      // lienzo se quedaba SIN transformar, a pantalla completa y encima de la
      // pagina. Mas adelante en el viaje daria `scale(0)` y desapareceria.
      const scale = hand.height > 0 ? Math.exp(Math.log((hand.height * HAND_ROOM) / h) * t) : 1;
      const arc = Math.sin(Math.PI * t) ** 2;
      const x = (hand.left + hand.width / 2 - w / 2) * t - w * 0.12 * arc;
      const y = (hand.top + hand.height / 2 - box.top - h / 2) * t - h * 0.16 * arc;
      layer.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
      // Vacia el shader mientras el lienzo todavia cubre el viewport, antes de
      // que ninguna traslacion ni escala ensenen sus bordes.
      journey.current.isolation = t > 0 ? 1 : ease(span([0.92, 1], pose.p));
      // La transformacion del DOM puede pintarse antes del siguiente fotograma
      // de WebGL. Se tapa el borde real del lienzo en esa misma pasada del DOM,
      // para que ni un fotograma viejo y opaco pueda ensenar esquinas.
      const edgeAlpha = t > 0 ? 0 : 1 - ease(span([0.86, 0.96], pose.p));
      const mask = `radial-gradient(ellipse 50% 50% at 50% 50%, #000 35%, rgba(0,0,0,${edgeAlpha}) 100%)`;
      layer.style.maskImage = mask;
      layer.style.webkitMaskImage = mask;
      holder.style.zIndex = t > 0 ? "2" : "0";
      holder.style.pointerEvents = t > 0 ? "none" : "auto";
      journey.current.cy = pose.cy * (1 - t);
      // `uScale` multiplica las coordenadas del shader, asi que un valor MENOR
      // agranda el agujero (ver stagePose.js). Al aterrizar no se queda en 1
      // sino en LANDED: entre las manos el agujero tiene que leerse, y a 1
      // era una chispa. El lienzo es la propia caja del hueco, asi que el
      // disco se recorta contra sus bordes y lo que queda es el aro.
      const growth = 1 + (MEDITATION_GROWTH - 1) * handMix;
      journey.current.scale = pose.scale * (1 - t) + (LANDED_SCALE * HAND_ROOM / growth) * t;
      journey.current.topDown = pose.topDown * (1 - t);
    };
    gsap.ticker.add(follow);
    return () => {
      gsap.ticker.remove(follow);
      tween.scrollTrigger.kill();
      tween.kill();
      closeTween.scrollTrigger.kill();
      closeTween.kill();
      // Se devuelve TODO lo que escribio `follow`, no solo la mitad. Si algun
      // dia la limpieza corre sin que se vuelva a enganchar el ticker, el
      // lienzo se quedaba encogido en la mano, con `pointer-events: none` y
      // por encima de la pagina, y el agujero del hero dejaba de responder.
      originalPose.style.transform = "";
      originalPose.style.opacity = "";
      originalImage.style.filter = "";
      finalImage.style.filter = "";
      portrait.style.transform = "";
      portrait.style.pointerEvents = "";
      if (finalStats) finalStats.style.transform = "";
      for (const el of aboutParts) { el.style.opacity = ""; el.style.pointerEvents = ""; }
      finalFrame.style.overflow = "";
      portrait.style.opacity = "";
      traveler.current?.style.removeProperty("transform");
      traveler.current?.style.removeProperty("mask-image");
      traveler.current?.style.removeProperty("-webkit-mask-image");
      carrier.current?.style.removeProperty("z-index");
      carrier.current?.style.removeProperty("pointer-events");
    };
  }, [entered, warm, reduced]);

  useEffect(() => {
    if (!entered || reduced || !stage.current) return;

    const ctx = gsap.context(() => {
      const hero = stage.current.querySelector(".hero");
      const runway = stage.current.querySelector(".orbit");
      if (!runway) return;

      // El titular lenseado está anclado al agujero; en cuanto este se despega
      // para bajar, el <h1> del DOM toma el relevo. El cruce se reparte en el
      // primer 40 % de pantalla para que no se vea ni doble ni vacío.
      ScrollTrigger.create({
        trigger: hero,
        start: "top top",
        end: "+=40%",
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          // Los dos titulares NO ocupan el mismo sitio: el del shader va
          // desplazado y ampliado por la lente. Fundiéndolos a la vez se leían
          // como un titular duplicado y descuadrado, así que se relevan en
          // serie: el del shader se apaga en la primera mitad del recorrido y
          // el del DOM entra en la segunda. Se cruzan en el punto medio, los
          // dos a cero: ni solape ni hueco.
          // El titular lenseado se va en cuanto se toca la rueda: ocupa media
          // pantalla y montado sobre el disco no se lee. A 0.15 del recorrido
          // ya no esta. El <h1> del DOM no lo releva —se quedaria un titular
          // suelto flotando mientras el hero sale—, solo sigue ahi, invisible,
          // para buscadores y lectores de pantalla.
          journey.current.lens = 1 - Math.min(1, p / 0.15);
          stage.current.style.setProperty("--void-veil", (1 - p).toFixed(3));
        },
      });

      ScrollTrigger.create({
        trigger: runway,
        start: "top bottom",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          const dive = ease(span(DIVE, p));
          const turn = ease(span(TURN, p));
          const exit = ease(span(EXIT, p));
          const j = orbitPose.current;
          j.p = p;
          // Baja a la zona inferior y luego vuelve al centro ya vista desde
          // arriba: de otro modo media órbita quedaría fuera de pantalla.
          // El apoyo del hero se desvanece con el primer tramo, para que el
          // viaje siga saliendo del mismo sitio en el que estaba parado.
          const rest = heroBase();
          j.cy = rest.cy * (1 - dive) - 0.46 * dive + 0.40 * turn;
          j.cx = 0;
          // En la vista cenital el agujero se queda del tamano de un sol en un
          // esquema del sistema solar: el protagonista pasan a ser las marcas.
          // Sale del tamano del hero y llega al de siempre (1.52) al acabar
          // el primer tramo, para que el viaje no de un salto de escala.
          j.scale = rest.scale * (1 - dive) + 1.52 * dive + 2.0 * turn + 1.1 * exit;
          j.topDown = turn;
          j.fall = span(FALL, p);
        },
      });
    }, stage);

    return () => ctx.revert();
  }, [entered, reduced]);

  return (
    <div className="stage" ref={stage}>
      {warm && (
        <div className="stage__void" ref={carrier}>
          <div className="stage__traveler" ref={traveler}>
          <Suspense fallback={null}>
            <BlackHole bare lensSource={copy} journey={journey} onLensReady={setLensed} espejo={espejo} espejoModo="sigue" />
          </Suspense>
          </div>
        </div>
      )}

      <Hero entered={entered} copyRef={copy} lensed={lensed} />

      {reduced ? (
        <Companies />
      ) : (
        <Orbit journey={journey} items={companies.items ?? []} note={sections.companies.note} />
      )}
      <About sharedHole={!reduced} />
      <Meditation reduced={reduced} />
    </div>
  );
}
