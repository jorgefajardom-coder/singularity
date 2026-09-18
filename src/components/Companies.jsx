import { companies } from "../data/content";

/**
 * Tira de logos en movimiento continuo.
 *
 * Los logos vienen ya recortados y en gris claro (ver tools/prepare-logos.py),
 * así que la tira se lee como un conjunto aunque cada marca original tuviera
 * un fondo distinto. No llevan texto: el nombre queda en el `alt` para
 * lectores de pantalla y como tooltip al pasar el ratón.
 */
export default function Companies() {
  const items = companies.items ?? [];

  if (!items.length) return null;

  // Con solo cinco logos el carril es más corto que la pantalla y quedaría
  // un hueco al desplazarse. Repetimos la lista hasta llenar de sobra y
  // luego duplicamos ese bloque: así translateX(-50%) cae justo en la copia.
  const half = Array.from({ length: 4 }, () => items).flat();
  const loop = [...half, ...half];

  return (
    <section id="companies" className="section companies">
      <div className="logorail">
        <ul className="logorail__track">
          {loop.map((c, i) => {
            // Solo la primera pasada cuenta para lectores de pantalla
            const dup = i >= items.length;
            const Tag = c.href ? "a" : "div";

            return (
              <li key={`${c.name}-${i}`} aria-hidden={dup || undefined}>
                <Tag
                  className="company"
                  style={{ "--brand-scale": c.logoScale ?? 1 }}
                  title={c.name}
                  {...(c.href
                    ? { href: c.href, target: "_blank", rel: "noreferrer noopener" }
                    : {})}
                >
                  <img
                    className="company__logo"
                    style={{ scale: c.logoScale ?? 1 }}
                    src={c.logo}
                    alt={dup ? "" : c.name}
                    loading="lazy"
                  />
                  {!c.hideLabel && <span className="company__label" aria-hidden="true">{c.name}</span>}
                </Tag>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
