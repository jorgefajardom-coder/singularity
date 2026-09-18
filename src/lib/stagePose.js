/**
 * Dónde se queda quieto el agujero negro cuando no pasa nada.
 *
 * Lo necesitan dos sitios: el hero (Stage) lo usa como punto de partida del
 * viaje, y el cargador lo usa como punto de LLEGADA de la transformación. Si
 * cada uno tuviera el suyo, el fundido entre los dos lienzos cruzaría dos
 * agujeros negros de distinto tamaño y en distinto sitio, que es exactamente
 * lo que se veía: un aro suelto desplazado del disco durante medio segundo.
 */

// En reposo el agujero NO va centrado en la pantalla: se apoya en la mitad
// inferior para que el titular quepa entero encima sin que la lente se coma
// ninguna letra. El valor esta en fraccion de media pantalla y con la Y hacia
// arriba, que es el convenio del shader: -0.17 lo baja un 8.5 % del alto.
// Se queda justo debajo del titular: el hueco entre texto y disco es minimo.
const HERO_CY = -0.17;

// `uScale` multiplica las coordenadas en el shader, asi que un valor MAYOR lo
// aleja y lo achica.
const HERO_SCALE = 1.34;

/**
 * Los dos valores de arriba estan pensados para una ventana apaisada. En un
 * movil —alto y estrecho— el disco se encoge (el shader lo escala con el
 * aspecto) y el titular se va muy arriba, asi que entre ambos se abria un
 * hueco enorme. En vertical el disco se agranda y sube.
 */
export const heroBase = () => {
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  if (aspect < 0.85) return { cy: -0.04, scale: 1.0 };
  return { cy: HERO_CY, scale: HERO_SCALE };
};
