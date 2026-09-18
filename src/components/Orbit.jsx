import { useEffect, useRef } from "react";
import { gsap } from "../lib/anim";
import { useLang } from "../lib/i18n";
import { createOrbitSpheres } from "../three/OrbitSpheres";
import CompanyMark from "./CompanyMark";

/**
 * Las marcas en órbita alrededor del agujero negro, cada una en su anillo.
 *
 * Los logos son DOM: siguen siendo enlaces reales con su `alt`, y mover unos
 * cuantos transforms por fotograma no le cuesta nada al navegador comparado
 * con volver a trazar geodésicas. La posición sale del mismo `journey` que
 * alimenta al shader, así que las dos capas comparten centro y punto de vista.
 *
 * La vista de canto y la cenital son la misma elipse: lo único que cambia es
 * cuánto se aplasta en Y. `squash` 0.11 es el plano visto casi de perfil; 1.0
 * es el círculo completo mirando desde arriba, que es cuando los anillos se
 * dibujan y la escena se lee como un sistema planetario.
 */

// Cuánto tarda cada marca en caer una vez le toca, y el desfase entre ellas:
// caen en fila, no todas a la vez.
const FALL_SPAN = 0.62;
const FALL_STEP = 0.085;

// Una marca por anillo, de dentro a fuera, como los planetas de un esquema
// del sistema solar. El primer anillo va vacío: deja aire entre el disco de
// acreción y la órbita más interior.
const INNER_RING = 0.2;
// El anillo interior arranca fuera del resplandor del disco: mas adentro la
// marca se lee sobre el naranja encendido y desaparece.
const radiusOf = (i, n) => (n > 1 ? 0.46 + (i / (n - 1)) * 0.48 : 0.7);


// Vuelta completa en ~50 s. Es giro propio, independiente del scroll: las
// marcas siguen orbitando aunque la página esté quieta.
const SPIN = 0.125;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const p = clamp01(x); return p * p * (3 - 2 * p); };
// Primero recuperan su forma de esfera; después empieza la absorción.
const collapseOf = (fall) => clamp01((fall - 0.24) / 0.76) ** 2;

export default function Orbit({ journey, items, note }) {
  const { tr } = useLang();
  const hud = useRef(null);
  const nodes = useRef([]);
  const rings = useRef([]);
  const sphereLayer = useRef(null);

  useEffect(() => {
    const layer = hud.current;
    if (!layer || !items.length) return;
    const n = items.length;
    const spheres = createOrbitSpheres(sphereLayer.current, n);

    const tick = (time) => {
      const j = journey.current;
      const t = time; // El ticker de GSAP entrega segundos.
      // La capa es `fixed`: su caja ES el viewport, igual que la del lienzo.
      const W = layer.clientWidth;
      const H = layer.clientHeight;
      if (!W || !H) return;

      // Fuera del viaje la capa no existe: ni se ve ni intercepta el puntero.
      const live = j.p > 0.001 && j.p < 0.999;
      layer.style.setProperty("--hud", live ? "1" : "0");
      layer.style.visibility = live ? "visible" : "hidden";
      if (!live) return;
      spheres.resize(W, H);
      // El rotulo no aparece hasta que el hero ha salido del todo (si no, se
      // solapa con su pie) y se retira en cuanto empiezan a caer.
      const caption = clamp01((j.p - 0.34) / 0.1) * clamp01(1 - j.fall * 2.6);
      layer.style.setProperty("--note", caption.toFixed(3));

      // Mismo convenio que el shader: fracción de media pantalla, +Y arriba.
      const cx = W * (0.5 + 0.5 * j.cx);
      const cy = H * (0.5 - 0.5 * j.cy);
      // De canto la órbita es ancha y baja; desde arriba se abre en círculo y
      // llega casi al borde, como en un esquema del sistema solar.
      // El limite en X deja sitio para la mitad de la marca mas grande, que va
      // en el anillo exterior: si no, se sale por el borde de la pantalla.
      const squash = 0.11 + 0.89 * j.topDown;
      const logoSize = Math.min(152, Math.max(68, W * 0.105));
      const margin = logoSize / 2 + 20;
      const rMax = Math.max(1, Math.min(W / 2 - margin, (Math.min(cy, H - cy) - margin) / squash));
      // Perspectiva: solo existe mientras se mira de canto. Desde arriba todas
      // las marcas están a la misma distancia y ninguna puede tapar a otra.
      const persp = 1 - j.topDown;
      // Antes de que empiece el viaje las marcas no pintan nada en pantalla.
      const present = clamp01(j.p / 0.16);
      // Los anillos solo se dibujan cuando hay algo que leer en ellos: de
      // canto serían rayas planas cruzando el disco encendido.
      const ringInk = j.topDown * j.topDown * present;

      const fallOf = (i) => clamp01((j.fall - i * FALL_STEP) / FALL_SPAN);

      for (let i = 0; i < n; i++) {
        const node = nodes.current[i];
        if (!node) continue;

        const factor = radiusOf(i, n);
        // La caída acelera: el radio se cierra como r^2 y el ángulo se dispara.
        const fall = fallOf(i);
        const drop = collapseOf(fall);
        const reveal = smooth((j.p - 0.10) / 0.20);
        const sphere = 1 - reveal * (1 - smooth(fall / 0.24));
        const r = rMax * factor * (1 - drop);

        // Conserva la separación angular mientras se leen las marcas.
        // La caída añade el giro individual cuando ya son esferas.
        const a = (i / n) * Math.PI * 2 + t * SPIN + j.p * 2.0 + drop * 6.4;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * squash;

        // +1 = delante del agujero, -1 = por detrás.
        // Todas las marcas miden lo mismo: el anillo dice a que distancia esta
        // cada una, no cuanto pesa. Lo unico que altera el tamano es la
        // perspectiva de canto y el encogimiento al caer.
        const depth = Math.sin(a);
        const size = (1 - 0.3 * persp * (0.5 - 0.5 * depth)) * (1 - drop * 0.92);

        // Eclipse: por detrás y cerca del eje, el agujero se la come de vista.
        const behind = persp * Math.max(0, -depth);
        const eclipse = behind * clamp01(1 - Math.abs(Math.cos(a)) / 0.5);
        const alpha = present * (1 - 0.88 * eclipse) * (1 - smooth((drop - 0.82) / 0.18));

        // Espaguetización: se estira en la dirección del centro mientras cae.
        const towards = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
        const stretch = 1 + drop * 1.9;
        const squeeze = 1 - drop * 0.6;

        node.style.opacity = alpha.toFixed(3);
        node.style.setProperty("--logo-opacity", (1 - sphere).toFixed(3));
        node.style.setProperty("--logo-scale", (1 - sphere * 0.7).toFixed(3));
        spheres.update(i, {
          x, y, z: depth * r * Math.sqrt(1 - squash * squash),
          radius: logoSize * 0.14 * size * (0.55 + sphere * 0.45),
          opacity: alpha * sphere,
        });
        const interactive = alpha > 0.06 && sphere < 0.5;
        node.style.pointerEvents = interactive ? "auto" : "none";
        if (node.tagName === "A") node.tabIndex = interactive ? 0 : -1;
        node.style.zIndex = String(100 + Math.round(depth * 50 * persp));
        node.style.transform =
          `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) ` +
          `rotate(${towards.toFixed(1)}deg) ` +
          `scale(${(size * stretch).toFixed(3)}, ${(size * squeeze).toFixed(3)}) ` +
          `rotate(${(-towards).toFixed(1)}deg)`;
      }

      // Cada anillo se cierra con la marca que lleva encima; el interior, que
      // va vacío, se va con la primera en caer.
      for (let k = 0; k <= n; k++) {
        const ring = rings.current[k];
        if (!ring) continue;
        const own = k < n;
        const factor = own ? radiusOf(k, n) : INNER_RING;
        const drop = collapseOf(fallOf(own ? k : 0));
        const r = rMax * factor * (1 - drop);

        ring.setAttribute("cx", cx.toFixed(1));
        ring.setAttribute("cy", cy.toFixed(1));
        ring.setAttribute("rx", Math.max(r, 0.1).toFixed(1));
        ring.setAttribute("ry", Math.max(r * squash, 0.1).toFixed(1));
        ring.style.opacity = (ringInk * (1 - drop)).toFixed(3);
      }
      spheres.render();
    };

    gsap.ticker.add(tick);
    return () => { gsap.ticker.remove(tick); spheres.dispose(); };
  }, [journey, items.length]);

  if (!items.length) return null;

  return (
    <section id="companies" className="orbit" aria-label={tr(note)}>
      <div className="orbit__hud" ref={hud}>
        <div className="orbit__spheres" ref={sphereLayer} aria-hidden="true" />
        <svg className="orbit__rings" aria-hidden="true">
          {[...items, INNER_RING].map((_, k) => (
            <ellipse key={k} ref={(el) => { rings.current[k] = el; }} />
          ))}
        </svg>

        <p className="orbit__note">{tr(note)}</p>

        {items.map((c, i) => (
          <CompanyMark
            key={c.name}
            company={c}
            className="orbiter"
            // El rótulo se separa del logo en proporción a lo que este crece.
            style={{ "--brand-scale": c.logoScale ?? 1 }}
            ref={(el) => { nodes.current[i] = el; }}
          />
        ))}
      </div>
    </section>
  );
}
