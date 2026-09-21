import { Suspense, lazy, useEffect, useMemo, useRef } from "react";
import { about, props3d, sections, ui } from "../data/content";
import { ScrollTrigger, gsap, prefersReducedMotion } from "../lib/anim";

const BlackHole = lazy(() => import("./BlackHole"));
const PropsView = lazy(() =>
  import("../three/Props3D").then((m) => ({ default: m.PropsView }))
);
import { useLang } from "../lib/i18n";
import { GhostHeading } from "./ui";
import SplitText from "./SplitText";

export default function About({ sharedHole = false }) {
  const { tr } = useLang();
  // El astronauta va anclado: no se arrastra. Solo flota, y el agujero negro
  // viaja con el en la mano, sin animacion propia de scroll que lo despegue.

  return (
    <section id="about" className="section about">
      <Suspense fallback={null}>
        <PropsView className="about__view" items={props3d.about} parallax={0.6} />
      </Suspense>
      <div className="shell">
        <GhostHeading className="display display--lg">{tr(sections.about.heading)}</GhostHeading>

        <div className="about__layout">
          <div className="about__figure" aria-hidden="true">
            <div className="about__float">
              {/* La pose es lo que Stage.jsx mueve y funde hacia el busto de la
                  seccion de meditacion; la flotacion en reposo vive en el
                  padre para que las dos no se pisen. */}
              <div className="about__pose">
                <img
                  className="about__astronaut"
                  src={`${import.meta.env.BASE_URL}images/about-astronaut-gaze.webp`}
                  width="1122"
                  height="1402"
                  alt=""
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                />
                {/* Con animacion no se monta nada aqui: el agujero que ocupa
                    este hueco es el que viaja desde el hero (ver Stage.jsx). */}
                <div className="about__singularity" inert={true}>
                  {!sharedHole && (
                    <Suspense fallback={<div className="blackhole__fallback" />}>
                      <BlackHole bare />
                    </Suspense>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="about__copy">

        {/* El texto se ilumina palabra a palabra al ritmo del scroll. */}
        <div className="about__body">
          {about.body.map((para, i) => (
            <SplitText key={i} variant="scrub" dimOpacity={0.55}>
              {tr(para)}
            </SplitText>
          ))}
        </div>

        {/* Pegado al bloque de texto y centrado SOBRE EL, no sobre la pagina.
            Colgando del `shell` caia en x=768 (el centro de la pantalla) con
            el texto centrado en 946: dos centros distintos, asi que el boton
            se leia suelto y torcido bajo el hueco entre el astronauta y la
            columna. Comparte la caja de `.about__body` —el `max-width` va en
            el CSS— para que los dos centros sean el mismo. */}
        <div className="about__cta about__cta--center">
          <a className="btn" href="#contact">
            {tr(ui.workTogether)}
          </a>
        </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Una cifra que sube hasta su valor al entrar en pantalla.
 *
 * El valor se escribe tal cual en content.js ("12+", "14", "50+"): aqui se
 * separa el numero de lo que lo rodea, para que el prefijo y el sufijo no se
 * pierdan y no haya que duplicar el dato.
 *
 * Se deja reversible a proposito: al volver a subir, la cifra se descuenta y
 * queda lista para repetirse. `toggleActions` con `reverse` al salir por
 * arriba es lo que lo consigue.
 */
export function CountUp({ value, triggerSelector }) {
  const ref = useRef(null);
  // "12+" -> ["", 12, "+"]. Si no hay numero, el texto se muestra sin animar.
  const parts = useMemo(() => {
    const m = String(value).match(/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/);
    if (!m) return null;
    return { pre: m[1], num: Number(m[2].replace(",", ".")), post: m[3] };
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !parts) return;

    if (prefersReducedMotion()) {
      el.textContent = String(value);
      return;
    }

    const counter = { v: 0 };
    const decimals = String(parts.num).includes(".") ? 1 : 0;
    const paint = () => {
      el.textContent = `${parts.pre}${counter.v.toFixed(decimals)}${parts.post}`;
    };
    paint();

    const tween = gsap.to(counter, {
      v: parts.num,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: paint,
      paused: true,
    });

    // Reversible, pero sin descontar a la vista: animar hacia atras dejaba la
    // cifra bajando en mitad de la pantalla, que se lee como un error. Al
    // salir por arriba vuelve a cero, y al bajar de nuevo cuenta otra vez.
    const trigger = ScrollTrigger.create({
      trigger: (triggerSelector && el.closest(triggerSelector)) || el,
      start: "top 92%",
      // `restart`, no `play`: un tween ya completado ignora `play()`, asi que
      // al bajar por segunda vez la cifra se quedaba clavada en cero.
      onEnter: () => tween.restart(),
      onLeaveBack: () => {
        tween.pause(0);
        paint();
      },
    });

    return () => {
      trigger.kill();
      tween.kill();
    };
  }, [parts, value, triggerSelector]);

  if (!parts) return <b>{value}</b>;
  // El valor final va en `aria-label`: un lector de pantalla no tiene por que
  // oir la cuenta atras, solo la cifra.
  return <b ref={ref} aria-label={String(value)} />;
}
