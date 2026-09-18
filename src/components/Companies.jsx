import { companies } from "../data/content";
import CompanyMark from "./CompanyMark";

/**
 * Tira de logos en movimiento continuo.
 *
 * Es la versión de la órbita para `prefers-reduced-motion`: la misma lista de
 * marcas, sin el viaje alrededor del agujero negro. La tarjeta en sí la pinta
 * `CompanyMark`, compartida con `Orbit`.
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
          {loop.map((c, i) => (
            <li key={`${c.name}-${i}`} aria-hidden={i >= items.length || undefined}>
              <CompanyMark company={c} className="company" duplicate={i >= items.length} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
