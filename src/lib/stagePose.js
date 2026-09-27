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
 * En vertical (telefono) el agujero se coloca a partir del TITULAR MEDIDO.
 *
 * Antes eran dos numeros fijos (cy -0.04, escala 1). En el telefono de Jorge
 * el titular quedaba a 2,4 radios de la sombra —en escritorio esta a 0,63—,
 * asi que apenas se deformaba (26-09-2026: "el hola soy jorge debe estar igual
 * de cerca y deformarse igual que en la version de escritorio"); y con la
 * letra del sistema mas grande, el texto de abajo se montaba en el anillo.
 *
 * Medido en escritorio (1536x639): el titular mide 7,74 radios de sombra de
 * ancho, y el titular PINTADO (el lenseado, no la caja del <h1>) termina 1,51
 * radios por encima del centro de la sombra. En vertical la lente sube el
 * texto pintado mucho mas que en escritorio (~50 px en 412x839), asi que para
 * que lo pintado quede a esos mismos 1,51 radios la caja del <h1> tiene que
 * quedar a solo 0,2 (ajustado midiendo capturas: 0,2 -> 1,52; 0,35 -> 1,65).
 * En vertical se busca la escala y la altura que reproducen esas dos
 * proporciones con el titular que haya de verdad (tamano de letra incluido).
 *
 * Del shader (medido y comprobado en los dos formatos):
 *   radio de la sombra en px  = R_UV / escala * alto / (2 * zoom)
 *   centro de la sombra en px = alto/2 - cy*alto/2 - (SUBE_UV / escala) * alto / (2 * zoom)
 * (SUBE_UV: la camara mira un poco desde arriba y la sombra sale mas alta que
 * el centro del agujero).
 */
const R_UV = 0.2895;
const SUBE_UV = 0.1537;
const DISTANCIA_R = 0.2;
// En apaisado (telefono en horizontal) la lente desplaza el texto como en
// escritorio: vale la distancia de la caja del <h1> medida alli.
const DISTANCIA_R_APAISADO = 0.633;
const ANCHO_R = 7.74;
const AGUJERO_ALTO_R = 2.7;

const VERTICAL = { cy: -0.04, scale: 1.0 };
let cache = null;

function medirVertical() {
  const titulo = document.querySelector(".hero__title");
  const hero = document.querySelector(".hero");
  if (!titulo || !hero) return null;
  // Lo que ocupa el disco por debajo del titular, para que el pie se ponga
  // justo debajo en el telefono (movil.css, `--agujero-alto`) en vez de al
  // fondo de la pantalla con un hueco negro en medio (Jorge, 27-09-2026).
  // Medido sobre los pixeles del disco en 360x740 y 390x844: el anillo
  // lenseado de abajo acaba a ~2,7 radios del borde del titular. Se escribe
  // ANTES de medir: mueve el titular.
  hero.style.setProperty("--agujero-alto", `${Math.round((titulo.getBoundingClientRect().width / ANCHO_R) * AGUJERO_ALTO_R)}px`);
  const t = titulo.getBoundingClientRect();
  const origen = hero.getBoundingClientRect().top;
  const ancho = t.width;
  const abajo = t.bottom - origen;
  if (!(ancho > 40) || !(abajo > 0)) return null;
  // El lienzo del agujero, no la ventana: en el movil la barra del
  // navegador cambia `innerHeight` y el lienzo (100svh) no.
  const lienzo = document.querySelector(".stage__void");
  const alto = lienzo?.clientHeight || window.innerHeight;
  const aspecto = (lienzo?.clientWidth || window.innerWidth) / Math.max(alto, 1);
  const zoom = Math.min(2.2, Math.max(1, 1.85 / Math.max(aspecto, 0.35)));
  const pxUnidad = alto / (2 * zoom);
  const distancia = aspecto < 0.85 ? DISTANCIA_R : DISTANCIA_R_APAISADO;
  let radio = ancho / ANCHO_R;
  // Lo que cuelga por debajo de la sombra (el anillo inferior lenseado) llega
  // a ~1,1 radios: no puede pisar el texto del pie. Si no cabe, se encoge.
  const pie = document.querySelector(".hero__meta");
  if (pie) {
    const tope = pie.getBoundingClientRect().top - origen - 12;
    const cabe = (tope - abajo) / (distancia + 1.2);
    if (cabe > 10) radio = Math.min(radio, cabe);
  }
  const scale = (R_UV * pxUnidad) / radio;
  const centro = abajo + distancia * radio;
  const cy = (alto / 2 - centro - (SUBE_UV / scale) * pxUnidad) / (alto / 2);
  return { cy, scale };
}

/**
 * El marco fisico del agujero: la caja de `.stage__void` (100svh). Todo lo que
 * se coloca sobre el agujero (marcas, anillos, esferas) mide con ESTE ancho y
 * alto, no con el de su propia capa: en el movil una capa `fixed` mide el
 * viewport de ese instante, que crece al esconderse la barra del navegador, y
 * el centro se descolocaba media barra respecto al del shader.
 */
export function marcoAgujero() {
  const lienzo = typeof document !== "undefined" ? document.querySelector(".stage__void") : null;
  const w = lienzo?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 0);
  const h = lienzo?.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 0);
  return { w, h };
}

/**
 * Donde pinta el shader el CENTRO del agujero, en pixeles del marco.
 *
 * Es la misma conversion que hace el shader (`uCenter`, fraccion de media
 * pantalla con la Y hacia arriba): el rayo del centro del lienzo sale por
 * `uCenter` y la camara apunta al agujero, asi que su centro cae ahi con
 * cualquier `scale` y cualquier inclinacion. OJO: no es el centro de la mancha
 * negra. De canto, la mitad cercana del disco tapa la parte de abajo de la
 * sombra y la mancha se ve mas alta (`SUBE_UV / scale`, lo que usa el reposo
 * del titular); las orbitas giran alrededor del agujero, no de la mancha, y
 * vistas desde arriba (donde se leen) las dos coinciden.
 */
export function centroAgujero(j, w, h) {
  return { x: w * (0.5 + 0.5 * j.cx), y: h * (0.5 - 0.5 * j.cy) };
}

/** Aviso de que alguien volvio a medir el reposo (el cargador, ver Loader.jsx). */
export const REPOSO_MEDIDO = "singularity:reposo";

/** Recalcula (al montar, con las fuentes cargadas, al cambiar de tamano). */
export function recalcularHeroBase() {
  cache = null;
  return heroBase();
}

export const heroBase = () => {
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  // Los dos numeros fijos valen para una pantalla apaisada de cierta altura.
  // Un telefono en horizontal (300-400 px de alto) tambien se mide: con los
  // fijos, titular, disco y pie se amontonaban.
  const bajo = window.innerHeight < 500;
  if (aspect >= 0.85 && !bajo) return { cy: HERO_CY, scale: HERO_SCALE };
  if (!cache) {
    const medido = typeof document !== "undefined" ? medirVertical() : null;
    if (!medido) return VERTICAL;
    cache = medido;
  }
  return cache;
};
