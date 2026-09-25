import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * LO QUE NO SE VE EN LA PRIMERA PANTALLA ESPERA A QUE TERMINE LA INTRO.
 *
 * Cada lienzo WebGL cuesta al crearse: el contexto (~100-180 ms en una grafica
 * integrada) y compilar su shader. Montados al arrancar, esos parones caian
 * encima del ∞ dibujandose y de las etiquetas del selector: medido en la
 * Intel UHD (25-09-2026), la esfera de la orbita paraba 180 ms el trazado del
 * ∞ y los seis agujeros del halo se compilaban durante la carga. Nada de eso
 * esta en pantalla hasta varias pantallas mas abajo.
 *
 * App marca el final de la intro; cada pieza pide turno con `useTrasIntro` y
 * entra en un momento libre, de una en una, para no juntar los parones.
 */
let terminada = false;
const oyentes = new Set();

export function marcarIntroTerminada() {
  if (terminada) return;
  terminada = true;
  oyentes.forEach((f) => f());
}

/** Si la intro ya termino (lectura directa, fuera de React). */
export const introTerminada = () => terminada;

const suscribir = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
const leer = () => terminada;

// Separacion entre turnos: lo que tarda en montarse un lienzo en la Intel.
const TURNO_MS = 350;

/**
 * true cuando le toca a esta pieza: intro terminada, `turno` huecos despues y
 * en un momento en que el navegador no tiene nada mejor que hacer.
 */
export function useTrasIntro(turno = 0) {
  const lista = useSyncExternalStore(suscribir, leer, leer);
  const [ya, setYa] = useState(false);
  useEffect(() => {
    if (!lista || ya) return undefined;
    let idle = null;
    const timer = setTimeout(() => {
      if (typeof requestIdleCallback === "function") {
        idle = requestIdleCallback(() => setYa(true), { timeout: 1000 });
      } else {
        setYa(true);
      }
    }, 600 + turno * TURNO_MS);
    return () => {
      clearTimeout(timer);
      if (idle !== null) cancelIdleCallback(idle);
    };
  }, [lista, ya, turno]);
  return ya;
}

/** Lo mismo como envoltorio, para usarlo dentro de un `.map`. */
export function EnSuTurno({ turno = 0, fallback = null, children }) {
  return useTrasIntro(turno) ? children : fallback;
}
