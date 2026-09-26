import { companies } from "../data/content";
import CompanyMark from "./CompanyMark";

/**
 * Las marcas para `prefers-reduced-motion`: la misma lista de la órbita, sin
 * el viaje alrededor del agujero negro. La tarjeta en sí la pinta
 * `CompanyMark`, compartida con `Orbit`.
 *
 * Solo se monta con movimiento reducido (ver Stage.jsx), así que va QUIETA y
 * con UNA copia de cada logo. Antes era una cinta en bucle con la lista
 * repetida ocho veces para que el desplazamiento no dejara huecos; con la
 * animación desactivada lo que quedaba eran ocho copias visibles de cada
 * marca en fila.
 */
export default function Companies() {
  const items = companies.items ?? [];

  if (!items.length) return null;

  return (
    <section id="companies" className="section companies">
      <div className="logorail logorail--quieta">
        <ul className="logorail__track">
          {items.map((c) => (
            <li key={c.name}>
              <CompanyMark company={c} className="company" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
