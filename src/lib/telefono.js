import { useEffect, useState } from "react";

/**
 * ¿Pantalla de telefono? Se mira en vivo, por si se gira el aparato.
 *
 * Es el mismo corte de 600 px de las reglas `@media` de global.css. Lo usan
 * los objetos 3D flotantes (que en una columna tapaban el texto) y el halo
 * (que en el telefono no abre seis lienzos WebGL propios).
 */
const TELEFONO = "(max-width: 600px)";

export function useTelefono() {
  const [es, setEs] = useState(() => typeof window !== "undefined" && window.matchMedia(TELEFONO).matches);
  useEffect(() => {
    const media = window.matchMedia(TELEFONO);
    const cambia = () => setEs(media.matches);
    cambia();
    media.addEventListener("change", cambia);
    return () => media.removeEventListener("change", cambia);
  }, []);
  return es;
}
