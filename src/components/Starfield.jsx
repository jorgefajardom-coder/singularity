import { twinkling } from "./twinkling";

/**
 * Las estrellas que parpadean.
 *
 * El grueso del cielo NO pasa por aqui: son 460 estrellas quietas dentro de
 * `styles/starfield.svg`, puestas como fondo de `body::before`, que no cuestan
 * ni un nodo del DOM. Pero un `background-image` no se puede animar por
 * estrella, asi que las que titilan tienen que ser elementos de verdad. Son 34
 * a proposito: con ese punado el cielo ya se lee vivo, y son 34 capas
 * compuestas en vez de 460.
 *
 * Cada una trae su ritmo, su fase y su valle propios (ver la lista generada en
 * twinkling.js), que es lo que hace que el parpadeo se lea aleatorio en vez de
 * como un pulso de todo el cielo a la vez. El desfase viene en negativo para
 * que al cargar la pagina ya esten repartidas por su ciclo y ninguna arranque
 * desde el mismo punto.
 */
export default function Starfield() {
  return (
    <div className="starfield" aria-hidden="true">
      {twinkling.map((s, i) => (
        <span
          key={i}
          className="starfield__star"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.d}px`,
            height: `${s.d}px`,
            "--star-ink": s.c,
            "--star-low": s.lo,
            "--star-dur": `${s.dur}s`,
            "--star-delay": `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
