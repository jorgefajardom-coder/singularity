import { useEffect, useRef, useState } from "react";
import { sections, stack, ui } from "../data/content";
import { useLang } from "../lib/i18n";
import { GhostHeading } from "./ui";

/**
 * Stack como una pared de posteres: uno por area, quietos y legibles a la
 * vez, en una fila que se recorre en horizontal (rueda o gesto lateral,
 * arrastre con el raton, flechas o el dedo).
 *
 * Sustituye a los dos carriles de tarjetas que se desplazaban solos: lucian,
 * pero el texto nunca estaba quieto y en una pantalla baja la segunda fila
 * quedaba cortada. Un stack se consulta buscando algo ("¿sabe CODESYS?"), asi
 * que todo tiene que poder leerse sin esperar a que pase.
 *
 * Cada poster lleva un motivo de linea propio de su area, en SVG y en la
 * paleta de fuego del sitio.
 */
export default function Stack() {
  const { tr } = useLang();
  const fila = useRef(null);
  const [bordes, setBordes] = useState({ inicio: true, fin: false });

  // Estado de las flechas: apagadas en los extremos.
  useEffect(() => {
    const el = fila.current;
    if (!el) return undefined;
    const medir = () => setBordes({
      inicio: el.scrollLeft <= 4,
      fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => { el.removeEventListener("scroll", medir); window.removeEventListener("resize", medir); };
  }, []);

  // Arrastrar con el raton, como se haria con el dedo. Solo raton: en tactil
  // el desplazamiento nativo ya lo hace, y mejor.
  useEffect(() => {
    const el = fila.current;
    if (!el) return undefined;
    let x0 = 0, s0 = 0, arrastrando = false;
    const abajo = (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      arrastrando = true;
      x0 = e.clientX;
      s0 = el.scrollLeft;
      el.classList.add("is-arrastrando");
    };
    const mueve = (e) => { if (arrastrando) el.scrollLeft = s0 - (e.clientX - x0); };
    const suelta = () => { arrastrando = false; el.classList.remove("is-arrastrando"); };
    el.addEventListener("pointerdown", abajo);
    window.addEventListener("pointermove", mueve);
    window.addEventListener("pointerup", suelta);
    return () => {
      el.removeEventListener("pointerdown", abajo);
      window.removeEventListener("pointermove", mueve);
      window.removeEventListener("pointerup", suelta);
    };
  }, []);

  const pasar = (sentido) => {
    const el = fila.current;
    const poster = el?.querySelector(".poster");
    if (!el || !poster) return;
    const paso = poster.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || 0);
    el.scrollBy({ left: sentido * paso * 2, behavior: "smooth" });
  };

  return (
    <section id="stack" className="section stack">
      <div className="shell stack__head">
        <GhostHeading className="display display--lg">{tr(sections.stack.heading)}</GhostHeading>
        <div className="stack__nav">
          <button type="button" className="stack__flecha" onClick={() => pasar(-1)} disabled={bordes.inicio}
            aria-label={tr(ui.stackPrev)}>←</button>
          <button type="button" className="stack__flecha" onClick={() => pasar(1)} disabled={bordes.fin}
            aria-label={tr(ui.stackNext)}>→</button>
        </div>
      </div>

      {/* `data-lenis-prevent-horizontal`: el gesto lateral del trackpad lo
          lleva el navegador sobre la fila; el vertical sigue siendo de Lenis
          y mueve la pagina, no se lo come la fila. */}
      <div className="posters" ref={fila} tabIndex={0} role="region" aria-label={tr(sections.stack.heading)}
        data-lenis-prevent-horizontal="">
        {stack.map((g, i) => (
          <article className="poster" key={g.key} data-area={g.key}>
            <header className="poster__cabeza">
              <span className="poster__num">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="poster__titulo">{tr(g.group)}</h3>
            </header>
            <Motivo area={g.key} />
            <ul className={`poster__lista${g.items.length > 6 ? " poster__lista--dos" : ""}`}>
              {g.items.map((item) => <li key={item.name}>{item.name}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Motivos de linea, uno por area. Todos en un viewBox de 200 x 120, dibujados
 * con `currentColor` y dos tonos de acento: el CSS les da el color.
 */
function Motivo({ area }) {
  const dibujo = MOTIVOS[area] || MOTIVOS.dev;
  return (
    <svg className="poster__motivo" viewBox="0 0 200 120" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {dibujo}
    </svg>
  );
}

const A = "var(--accent-a)";
const B = "var(--accent-b)";

const MOTIVOS = {
  // Codigo: los signos de etiqueta y lineas de texto sangradas.
  dev: (
    <>
      <path d="M38 38 L18 60 L38 82" stroke={B} strokeWidth="3" />
      <path d="M162 38 L182 60 L162 82" stroke={B} strokeWidth="3" />
      <path d="M112 30 L88 90" stroke={A} strokeWidth="3" />
      <path d="M56 44 H80 M60 56 H96 M60 68 H84 M56 80 H74" opacity=".55" />
      <path d="M122 44 H144 M126 56 H150 M126 68 H140" opacity=".55" />
    </>
  ),
  // Red neuronal: tres capas de nodos conectadas.
  ia: (
    <>
      {[[40, 30], [40, 60], [40, 90]].flatMap(([x1, y1]) => [[100, 20], [100, 48], [100, 72], [100, 100]].map(([x2, y2]) => (
        <path key={`${x1}${y1}${x2}${y2}`} d={`M${x1} ${y1} L${x2} ${y2}`} opacity=".35" />
      )))}
      {[[100, 20], [100, 48], [100, 72], [100, 100]].flatMap(([x1, y1]) => [[160, 45], [160, 75]].map(([x2, y2]) => (
        <path key={`b${x1}${y1}${x2}${y2}`} d={`M${x1} ${y1} L${x2} ${y2}`} opacity=".35" />
      )))}
      {[[40, 30], [40, 60], [40, 90], [100, 20], [100, 48], [100, 72], [100, 100]].map(([x, y]) => (
        <circle key={`n${x}${y}`} cx={x} cy={y} r="6" stroke={A} fill="var(--ink)" />
      ))}
      <circle cx="160" cy="45" r="8" stroke={B} fill={B} fillOpacity=".25" strokeWidth="2.2" />
      <circle cx="160" cy="75" r="8" stroke={B} strokeWidth="2.2" fill="var(--ink)" />
    </>
  ),
  // Flujo de integracion: nodos unidos por flechas.
  integra: (
    <>
      <rect x="14" y="46" width="36" height="28" rx="8" stroke={A} />
      <rect x="82" y="18" width="36" height="28" rx="8" stroke={A} />
      <rect x="82" y="74" width="36" height="28" rx="8" stroke={A} />
      <rect x="150" y="46" width="36" height="28" rx="14" stroke={B} strokeWidth="2.4" />
      <path d="M50 56 C66 56 66 32 82 32 M50 64 C66 64 66 88 82 88 M118 32 C134 32 134 56 150 56 M118 88 C134 88 134 64 150 64" opacity=".6" />
      <path d="M144 52 L150 56 L144 60" stroke={B} />
    </>
  ),
  // Logica de escalera: dos rieles, peldaños con contactos y una bobina.
  industrial: (
    <>
      <path d="M22 14 V106 M178 14 V106" stroke={A} strokeWidth="2.4" />
      {[34, 60, 86].map((y, k) => (
        <g key={y}>
          <path d={`M22 ${y} H62 M78 ${y} H118 M134 ${y} H${k === 1 ? 146 : 150} M${k === 1 ? 166 : 162} ${y} H178`} opacity=".6" />
          <path d={`M62 ${y - 9} V${y + 9} M78 ${y - 9} V${y + 9}`} stroke={B} strokeWidth="2.2" />
          {k === 1
            ? <circle cx="156" cy={y} r="10" stroke={B} strokeWidth="2.2" />
            : <path d={`M118 ${y - 9} V${y + 9} M134 ${y - 9} V${y + 9} M${k ? 120 : 132} ${y + 8} L${k ? 132 : 120} ${y - 8}`} stroke={A} />}
        </g>
      ))}
    </>
  ),
  // Placa: un chip con patas y pistas hacia los pads.
  electronica: (
    <>
      <rect x="74" y="36" width="52" height="48" rx="4" stroke={B} strokeWidth="2.4" />
      {[46, 60, 74].map((y) => <path key={`l${y}`} d={`M74 ${y} H64 M126 ${y} H136`} stroke={B} />)}
      <path d="M64 46 H44 L30 32 H14 M64 60 H14 M64 74 H46 L32 88 H14 M136 46 H154 L168 32 H186 M136 74 H152 L166 96 H186 M100 84 V104 M100 36 V16" opacity=".55" />
      {[[14, 32], [14, 60], [14, 88], [186, 32], [186, 96], [100, 104], [100, 16]].map(([x, y]) => (
        <circle key={`p${x}${y}`} cx={x} cy={y} r="4" stroke={A} />
      ))}
    </>
  ),
  // Cubo en alambre, en isometrica.
  tresd: (
    <>
      <path d="M100 14 L150 40 L150 92 L100 118 L50 92 L50 40 Z" stroke={A} strokeWidth="2" />
      <path d="M100 14 V66 M50 40 L100 66 L150 40 M100 66 V118" opacity=".5" />
      <path d="M50 40 L100 66 L100 118 L50 92 Z" stroke={B} fill={B} fillOpacity=".12" strokeWidth="2.2" />
    </>
  ),
  // Pelicula: fotogramas con perforaciones y el triangulo de reproducir.
  diseno: (
    <>
      <rect x="16" y="24" width="168" height="72" rx="6" stroke={A} />
      {[30, 54, 78, 102, 126, 150, 174].map((x) => (
        <g key={x} opacity=".55"><rect x={x - 5} y="30" width="8" height="6" rx="1.5" /><rect x={x - 5} y="84" width="8" height="6" rx="1.5" /></g>
      ))}
      <path d="M16 42 H184 M16 78 H184" opacity=".4" />
      <path d="M90 48 L114 60 L90 72 Z" stroke={B} fill={B} fillOpacity=".3" strokeWidth="2.2" />
    </>
  ),
  // Plano: circulo con ejes y una cota.
  cad: (
    <>
      <circle cx="100" cy="58" r="34" stroke={A} strokeWidth="2" />
      <circle cx="100" cy="58" r="14" stroke={B} strokeWidth="2.2" />
      <path d="M52 58 H148 M100 12 V104" strokeDasharray="6 4 1 4" opacity=".55" />
      <path d="M66 108 H134 M66 102 V114 M134 102 V114" opacity=".7" />
      <path d="M72 104 L66 108 L72 112 M128 104 L134 108 L128 112" opacity=".7" />
    </>
  ),
  // Datos: barras con una tendencia por encima.
  datos: (
    <>
      <path d="M20 104 H182 M20 104 V14" opacity=".5" />
      {[[36, 70], [60, 52], [84, 60], [108, 38], [132, 44], [156, 24]].map(([x, h]) => (
        <rect key={x} x={x} y={h + 10} width="14" height={94 - h} rx="2" stroke={A} />
      ))}
      <path d="M43 72 L67 54 L91 62 L115 40 L139 46 L163 22" stroke={B} strokeWidth="2.4" />
      <circle cx="163" cy="22" r="4" stroke={B} fill={B} />
    </>
  ),
  // Producto: tablero de tres columnas con tarjetas.
  producto: (
    <>
      {[18, 76, 134].map((x, c) => (
        <g key={x}>
          <path d={`M${x} 16 H${x + 48}`} stroke={c === 2 ? B : A} strokeWidth="2.4" />
          {Array.from({ length: 3 - c }, (_, k) => (
            <rect key={k} x={x} y={26 + k * 28} width="48" height="20" rx="4" stroke={c === 2 ? B : A} opacity={c === 1 && k === 0 ? 1 : 0.7} />
          ))}
        </g>
      ))}
      <path d="M68 36 C72 36 72 36 76 36" opacity=".5" />
    </>
  ),
};
