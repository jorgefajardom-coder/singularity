import { stack } from "../data/content";
import { useLang } from "../lib/i18n";
import { GhostHeading } from "./ui";

/**
 * Stack como dos carriles de tarjetas grandes que se desplazan hacia los
 * lados en sentidos opuestos, al estilo de la rejilla de la referencia.
 *
 * El movimiento es una animación CSS sobre el carril (no GSAP): así el
 * navegador la compone en la GPU y no cuesta nada aunque haya 20 tarjetas.
 * Cada carril duplica su contenido y se desplaza -50%, de modo que el bucle
 * es continuo y sin salto.
 *
 * Los degradados y chips usan tonos de fuego para seguir la paleta del sitio.
 */
export default function Stack() {
  const { tr } = useLang();

  // Dos filas alternando grupos, para que ambas queden parejas de largo
  const rows = [stack.filter((_, i) => i % 2 === 0), stack.filter((_, i) => i % 2 === 1)];

  return (
    <section id="stack" className="section stack">
      <div className="shell">
        <GhostHeading className="display display--lg">Stack</GhostHeading>
      </div>

      <div className="rails">
        {rows.map((row, r) => (
          <div className="rail" key={r} data-dir={r % 2 ? "right" : "left"}>
            <div className="rail__track">
              {[...row, ...row].map((group, i) => (
                <StackCard
                  key={`${tr(group.group)}-${i}`}
                  group={group}
                  label={tr(group.group)}
                  index={(i % row.length) * 2 + r + 1}
                  muted={i >= row.length}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Degradado a partir de los colores de las herramientas del grupo. */
function gradientFor(items) {
  const colors = items.map((i) => i.color);
  const [a, b = a, c = a] = colors;
  return [
    `radial-gradient(68% 78% at 24% 28%, ${a} 0%, transparent 62%)`,
    `radial-gradient(62% 72% at 78% 72%, ${b} 0%, transparent 60%)`,
    `radial-gradient(70% 60% at 60% 10%, ${c}99 0%, transparent 58%)`,
    `linear-gradient(150deg, ${a}33, #08070a 82%)`,
  ].join(",");
}

function StackCard({ group, label, index, muted }) {
  return (
    <article className="railcard" aria-hidden={muted || undefined}>
      <div className="railcard__art" style={{ background: gradientFor(group.items) }} />

      <div className="railcard__body">
        <span className="railcard__num">{String(index).padStart(2, "0")}</span>
        <h3 className="railcard__title">{label}</h3>

        <ul className="railcard__chips">
          {group.items.map((item) => (
            <li className="chip" key={item.name}>
              <i style={{ background: item.color }} aria-hidden="true" />
              {item.name}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
