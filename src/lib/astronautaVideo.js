import { asset } from "./asset";

/**
 * EL ASTRONAUTA DE SOBRE MI SE CONVIERTE EN EL QUE MEDITA, EN VIDEO.
 *
 * Sustituye al fundido entre las dos imagenes (Jorge, 28-09-2026): suelta el
 * casco, se endereza flotando, cruza las piernas, junta las manos y cierra los
 * ojos. Es una secuencia de fotogramas con alfa pintada en un <canvas>, no un
 * <video>: el scroll tiene que poder ir a cualquier fotograma hacia delante y
 * hacia atras sin tirones, y Safari no reproduce WebM con alfa.
 *
 * Origen: `astronauta.mp4` (240 fotogramas, 720x1280, croma verde), recortado
 * con `.tmp/astro-nuevo/croma.py` y compuesto con `componer.py`: el casco, que
 * en el video sale cortado por el borde, se pinta entero en su trayectoria y
 * se aleja flotando (el lienzo va ampliado por la izquierda, por eso `CAJA`
 * empieza en x < 0); saturacion x1,10 y un poco de enfoque, que las imagenes
 * del sitio se veian mas vivas. 92 fotogramas, al 70 %.
 *
 * ENCAJE: el primer fotograma cae encima de `about-astronaut-gaze.webp` y el
 * ultimo encima de `stack-astronaut.webp` (solape de siluetas del 98-99 %,
 * `encaje.py`). En cada imagen, un punto del video (xv, yv) cae en
 * ((s*xv + tx)/W, (s*yv + ty)/H) de su caja.
 *
 * SIN TIRONES: los fotogramas se guardan comprimidos (~3 MB) y se decodifican
 * fuera del hilo principal (`createImageBitmap`), solo los que hacen falta.
 * Cambiar el `src` de una <img> en cada fotograma decodificaba en el hilo
 * principal: con el dedo, la pagina iba por delante, Lenis devolvia el scroll
 * y todo vibraba (Jorge, 28-09-2026). Entre dos fotogramas se funden segun la
 * posicion exacta del scroll: el movimiento es continuo.
 */
export const N_FOTOGRAMAS = 92;
// El tamano del lienzo (y del fotograma). Stage.jsx lo deja fijo en CSS y lo
// escala con `transform`: cambiar `width`/`height` en cada fotograma
// recalculaba la maqueta (tics en el telefono, 29-10-2026).
export const ANCHO = 648;
export const ALTO = 617;
const CAJA = [-254, 228, 672, 1110];
const ENCAJE = {
  inicio: { s: 1.6748, tx: -11.22, ty: -362.78, W: 1122, H: 1402 },
  fin: { s: 1.3433, tx: -157.04, ty: -346.2933, W: 604, H: 1000 },
};

const url = (i) => asset(`/images/astronauta-transicion/${String(i).padStart(3, "0")}.webp`);

/** Donde cae el fotograma (su caja recortada) sobre la caja de una imagen. */
function sobre(rect, e) {
  const k = e.s;
  return {
    left: rect.left + (rect.width * (k * CAJA[0] + e.tx)) / e.W,
    top: rect.top + (rect.height * (k * CAJA[1] + e.ty)) / e.H,
    width: (rect.width * k * (CAJA[2] - CAJA[0])) / e.W,
    height: (rect.height * k * (CAJA[3] - CAJA[1])) / e.H,
  };
}

/**
 * La caja del fotograma para un avance `m` (0 = encima de la imagen de Sobre
 * mi, 1 = encima de la del que medita), en coordenadas de la ventana.
 */
export function cajaFotograma(rectInicio, rectFin, m) {
  const a = sobre(rectInicio, ENCAJE.inicio);
  const b = sobre(rectFin, ENCAJE.fin);
  const l = (x, y) => x + (y - x) * m;
  return { left: l(a.left, b.left), top: l(a.top, b.top), width: l(a.width, b.width), height: l(a.height, b.height) };
}

// ---- Carga: comprimidos en memoria, decodificados bajo demanda -------------
const estado = { listo: false, cargando: null, blobs: [], mapas: new Map(), pedidos: new Map() };
export function precargarAstronauta() {
  if (estado.cargando) return estado.cargando;
  if (typeof createImageBitmap !== "function") return (estado.cargando = Promise.resolve(false));
  // Con reintentos: un solo fotograma que fallara (red lenta, un corte) dejaba
  // la secuencia sin terminar y la transformacion en el fundido para siempre.
  const una = async (i) => {
    for (let intento = 0; intento < 3; intento++) {
      try {
        const r = await fetch(url(i));
        if (r.ok) return await r.blob();
      } catch { /* se reintenta */ }
      await new Promise((ok) => setTimeout(ok, 800 * (intento + 1)));
    }
    return null;
  };
  // De cuatro en cuatro: todas a la vez competian con el resto de la pagina.
  estado.cargando = (async () => {
    const blobs = [];
    for (let i = 0; i < N_FOTOGRAMAS; i += 4) {
      blobs.push(...(await Promise.all(Array.from({ length: Math.min(4, N_FOTOGRAMAS - i) }, (_, k) => una(i + k)))));
    }
    estado.blobs = blobs;
    estado.listo = blobs.every(Boolean);
    return estado.listo;
  })();
  return estado.cargando;
}
export const astronautaListo = () => estado.listo;

// Pocos decodificados a la vez (cada uno son ~1,6 MB de pixeles): los que se
// estan pintando y sus vecinos. El resto se suelta.
const MAX_MAPAS = 8;
function pide(i) {
  if (i < 0 || i >= N_FOTOGRAMAS || estado.mapas.has(i) || estado.pedidos.has(i) || !estado.blobs[i]) return;
  estado.pedidos.set(i, createImageBitmap(estado.blobs[i]).then((m) => {
    estado.pedidos.delete(i);
    estado.mapas.set(i, m);
  }, () => estado.pedidos.delete(i)));
}
function suelta(cerca) {
  if (estado.mapas.size <= MAX_MAPAS) return;
  const lejos = [...estado.mapas.keys()].sort((a, b) => Math.abs(b - cerca) - Math.abs(a - cerca));
  for (const i of lejos.slice(0, estado.mapas.size - MAX_MAPAS)) { estado.mapas.get(i)?.close?.(); estado.mapas.delete(i); }
}
/** El mas cercano a `i` que ya este decodificado. */
function cercano(i) {
  if (estado.mapas.has(i)) return i;
  for (let d = 1; d < N_FOTOGRAMAS; d++) {
    if (estado.mapas.has(i - d)) return i - d;
    if (estado.mapas.has(i + d)) return i + d;
  }
  return -1;
}

/**
 * Pinta el fotograma `t` (fraccionario, 0..N-1) en el lienzo: los dos que lo
 * rodean fundidos segun la parte decimal. Si aun no estan decodificados, el
 * mas cercano que haya (y se piden para el siguiente fotograma). Devuelve si
 * lo pintado es exactamente lo pedido.
 */
export function pintaAstronauta(ctx, t) {
  const f = Math.max(0, Math.min(N_FOTOGRAMAS - 1, t));
  const a = Math.floor(f), b = Math.min(N_FOTOGRAMAS - 1, a + 1), frac = f - a;
  for (const i of [a, b, a - 1, b + 1, b + 2]) pide(i);
  suelta(a);
  const c = ctx.canvas;
  if (c.width !== ANCHO) { c.width = ANCHO; c.height = ALTO; }
  const ia = estado.mapas.has(a) ? a : cercano(a);
  if (ia < 0) return false;
  ctx.clearRect(0, 0, ANCHO, ALTO);
  ctx.globalAlpha = 1;
  ctx.drawImage(estado.mapas.get(ia), 0, 0, ANCHO, ALTO);
  const funde = frac > 0.02 && ia === a && estado.mapas.has(b);
  if (funde) {
    ctx.globalAlpha = frac;
    ctx.drawImage(estado.mapas.get(b), 0, 0, ANCHO, ALTO);
    ctx.globalAlpha = 1;
  }
  // Exacto: el fotograma pedido (y el siguiente, si hacia falta fundirlo).
  // Si no, quien llama vuelve a pintar en el siguiente fotograma.
  return ia === a && (frac <= 0.02 || funde);
}
