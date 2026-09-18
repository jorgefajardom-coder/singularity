import { Suspense, lazy, useEffect, useRef, useState } from "react";

const BlackHole = lazy(() => import("./BlackHole"));
import Hero from "./Hero";
import Orbit from "./Orbit";
import Companies from "./Companies";
import { companies, sections } from "../data/content";
import { gsap, ScrollTrigger, prefersReducedMotion } from "../lib/anim";

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
// ocupando la pantalla hasta que la galeria lo empuja fuera.
const EXIT = [0.86, 1.0];

const span = ([a, b], p) => Math.min(1, Math.max(0, (p - a) / (b - a)));
// Suaviza los extremos: sin esto cada fase arranca y frena de golpe.
const ease = (x) => x * x * (3 - 2 * x);

export default function Stage({ entered, warm }) {
  const stage = useRef(null);
  const copy = useRef(null);
  const [lensed, setLensed] = useState(false);
  const reduced = prefersReducedMotion();

  // Estado compartido shader <-> DOM. `cx`/`cy` van en fracción de media
  // pantalla con la Y hacia arriba, que es como los quiere el shader.
  const journey = useRef({ cx: 0, cy: 0, scale: 1, topDown: 0, fall: 0, lens: 1, p: 0 });

  // En desarrollo, para poder leer la fase desde la consola:
  // window.journey  ->  { p, cy, scale, topDown, fall }
  if (import.meta.env.DEV && typeof window !== "undefined") window.journey = journey;

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
          const j = journey.current;
          j.p = p;
          // Baja a la zona inferior y luego vuelve al centro ya vista desde
          // arriba: de otro modo media órbita quedaría fuera de pantalla.
          j.cy = -0.46 * dive + 0.40 * turn;
          j.cx = 0;
          // En la vista cenital el agujero se queda del tamano de un sol en un
          // esquema del sistema solar: el protagonista pasan a ser las marcas.
          j.scale = 1 + 0.52 * dive + 2.0 * turn + 1.1 * exit;
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
        <div className="stage__void">
          <Suspense fallback={null}>
            <BlackHole bare lensSource={copy} journey={journey} onLensReady={setLensed} />
          </Suspense>
        </div>
      )}

      <Hero entered={entered} copyRef={copy} lensed={lensed} />

      {reduced ? (
        <Companies />
      ) : (
        <Orbit journey={journey} items={companies.items ?? []} note={sections.companies.note} />
      )}
    </div>
  );
}
