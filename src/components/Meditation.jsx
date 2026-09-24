import { useEffect, useRef, useState } from "react";
import Halo from "./Halo";
import { about, sections, ui } from "../data/content";
import { CountUp } from "./About";
import { useLang } from "../lib/i18n";

/**
 * El astronauta con el agujero negro entre las manos: el final del viaje que
 * arranca en el hero (ver Stage.jsx).
 *
 * Aqui NO se monta ningun lienzo. Con animacion, el agujero que llega es el
 * mismo que viene viajando desde la primera pantalla, y aterriza en
 * `.meditation__singularity` sin que esta seccion sepa nada de el. Sin
 * animacion no hay viaje, asi que el hueco se rellena con el degradado
 * estatico de `.blackhole__fallback`: montar un tercer contexto WebGL aqui
 * —ademas del del hero y del de Sobre mi— le cargaba tres trazadores de
 * geodesicas a quien justamente ha pedido menos movimiento.
 */
export default function Meditation({ reduced }) {
  const { tr } = useLang();
  const frame = useRef(null);
  // Los contadores salen en cuanto aparece el astronauta que medita, y se
  // apagan, a cero, cuando se va. Su opacidad la escribe Stage.jsx durante
  // la transformacion desde Sobre mi: pasada la mitad, ya es el.
  const [cuentas, setCuentas] = useState(reduced);
  useEffect(() => {
    const retrato = frame.current?.querySelector(".meditation__portrait");
    if (reduced || !retrato) return undefined;
    const mirar = () => setCuentas(Number(retrato.style.opacity || 0) >= 0.5);
    const cambio = new MutationObserver(mirar);
    cambio.observe(retrato, { attributes: true, attributeFilter: ["style"] });
    mirar();
    return () => cambio.disconnect();
  }, [reduced]);

  return (
    <section className="meditation" aria-label={tr(sections.meditation.label)}>
      <div className="meditation__frame" ref={frame} data-cuentas={cuentas ? "true" : "false"}>
        <div className="meditation__portrait">
          <Halo />
          <img
            className="meditation__image"
            src={`${import.meta.env.BASE_URL}images/stack-astronaut.webp`}
            width="604"
            height="1000"
            alt={tr(ui.a11y.meditationImage)}
            decoding="async"
          />
          {/* `inert`, no `aria-hidden`: lo de dentro no debe recibir foco. Con
              aria-hidden el teclado seguiria parando aqui sin que ningun lector
              de pantalla pudiera anunciar en que ha parado. */}
          <div className="meditation__singularity" inert={true}>
            {reduced && <div className="blackhole__fallback" />}
          </div>
        </div>
        <div className="meditation__stats">
          {about.stats.map((stat, i) => (
            <div className="meditation__stat" key={stat.value} style={{ "--stat-i": i }}>
              <CountUp value={stat.value} play={cuentas} delay={i * 0.12} />
              <span>{i === 1 ? tr({ es: "Áreas", en: "Areas" }) : tr(stat.label)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
