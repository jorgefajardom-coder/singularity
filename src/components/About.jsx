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

export default function About() {
  const { tr } = useLang();
  const figure = useRef(null);
  const drag = useRef(null);
  const offset = useRef({ x: 0, y: 0 });

  const moveFigure = (x, y) => {
    const el = figure.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const limit = Math.min(80, box.width * 0.18);
    offset.current = {
      x: Math.max(Math.max(-limit, -box.left + 8), Math.min(Math.min(limit, window.innerWidth - box.right - 8), x)),
      y: Math.max(-60, Math.min(60, y)),
    };
    el.style.setProperty("--astronaut-x", `${offset.current.x}px`);
    el.style.setProperty("--astronaut-y", `${offset.current.y}px`);
  };
  const stopDrag = (e) => {
    drag.current = null;
    e.currentTarget.removeAttribute("data-dragging");
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // El agujero NO lleva animacion propia de scroll: iba con su `scale` y su
  // `yPercent` en scrub, asi que se despegaba de la mano del astronauta y se
  // pasaba el rato cambiando de sitio. Ahora solo flota con la figura entera.

  return (
    <section id="about" className="section about">
      <Suspense fallback={null}>
        <PropsView className="about__view" items={props3d.about} parallax={0.6} />
      </Suspense>
      <div className="shell">
        <GhostHeading className="display display--lg">{tr(sections.about.heading)}</GhostHeading>

        <div className="about__layout">
          <div className="about__figure" ref={figure}>
            <div className="about__motion" role="button" tabIndex={0}
              aria-label={tr({ es: "Mover astronauta: arrastra o usa las flechas. Inicio restablece la posición.", en: "Move astronaut: drag or use arrow keys. Home resets the position." })}
              onPointerDown={(e) => {
                if (e.button !== 0 || !e.isPrimary) return;
                drag.current = { x: e.clientX, y: e.clientY, ...{ startX: offset.current.x, startY: offset.current.y } };
                e.currentTarget.setPointerCapture(e.pointerId);
                e.currentTarget.setAttribute("data-dragging", "true");
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                moveFigure(drag.current.startX + e.clientX - drag.current.x, drag.current.startY + e.clientY - drag.current.y);
              }}
              onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}
              onKeyDown={(e) => {
                const steps = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
                if (e.key === "Home" || e.key === "Escape") { e.preventDefault(); moveFigure(0, 0); }
                else if (steps[e.key]) { e.preventDefault(); moveFigure(offset.current.x + steps[e.key][0], offset.current.y + steps[e.key][1]); }
              }}>
            <div className="about__float">
              <img className="about__astronaut" src={`${import.meta.env.BASE_URL}images/about-astronaut-gaze.webp`} width="1122" height="1402" alt="" draggable={false} loading="lazy" decoding="async" />
              <div className="about__singularity" aria-hidden="true" inert>
                <Suspense fallback={<div className="blackhole__fallback" />}>
                  <BlackHole bare />
                </Suspense>
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

        <div className="about__cta about__cta--center">
          <a className="btn" href="#contact">
            {tr(ui.workTogether)}
          </a>
        </div>
          </div>
        </div>

        <div className="about__stats" data-reveal="stagger">
          {about.stats.map((s) => (
            <div className="about__stat" key={tr(s.label)}>
              <CountUp value={s.value} />
              <span>{tr(s.label)}</span>
            </div>
          ))}
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
function CountUp({ value }) {
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
      trigger: el,
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
  }, [parts, value]);

  if (!parts) return <b>{value}</b>;
  // El valor final va en `aria-label`: un lector de pantalla no tiene por que
  // oir la cuenta atras, solo la cifra.
  return <b ref={ref} aria-label={String(value)} />;
}
