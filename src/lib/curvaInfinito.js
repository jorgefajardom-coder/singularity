/**
 * El ∞ de los idiomas, en un solo sitio.
 *
 * Lo dibujan DOS: el SVG del cargador (las dos mitades, ES y EN) y el shader
 * del agujero negro, que en el relevo tiene que tapar al SVG punto por punto
 * —"mismo tamano y misma disposicion", y sin engordar ni achicar la forma
 * original (Jorge, 24-09-2026)—. Asi que el shader no dibuja una lemniscata de
 * formula: recibe esta misma curva muestreada y mide la distancia a ella.
 *
 * Dos cintas con extremos coincidentes: la junta se ilumina, nunca se abre.
 */
export const MITADES = [
  { code: "es", label: "ES", d: "M100 50 C77 35 58 17 37 19 C6 22 7 79 38 80 C59 81 79 64 100 50", cx: 44 },
  { code: "en", label: "EN", d: "M100 50 C122 34 145 8 165 15 C195 25 188 79 164 80 C144 83 122 64 100 50", cx: 157 },
];

// Centro real de la curva en el viewBox y su semiancho: la linea media va de
// 14,2 a 184,9 en x y de 13,8 a 80,3 en y (ver `encajar` en Loader.jsx, que
// la mide con getBBox y la planta con la formula del shader).
const CENTRO_X = 99.55;
const CENTRO_Y = 47.05;
const SEMIANCHO = 85.35;

// Puntos por mitad: los justos para que la cinta no se vea poligonal a
// pantalla completa. El shader ya no los recorre (ver `campoDistancias`).
export const PUNTOS_POR_MITAD = 48;
export const PUNTOS = PUNTOS_POR_MITAD * 2;

function cubica(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/** Puntos de un trazado "M x y C ... C ..." (solo cubicas, que es lo que hay). */
function muestrear(d, n) {
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  const inicio = [nums[0], nums[1]];
  const tramos = [];
  let p0 = inicio;
  for (let i = 2; i + 5 < nums.length + 1; i += 6) {
    const p1 = [nums[i], nums[i + 1]], p2 = [nums[i + 2], nums[i + 3]], p3 = [nums[i + 4], nums[i + 5]];
    tramos.push([p0, p1, p2, p3]);
    p0 = p3;
  }
  // Reparto por longitud aproximada, para que los puntos queden parejos.
  const fino = [];
  tramos.forEach((c) => { for (let k = 0; k < 40; k++) fino.push(cubica(...c, k / 40)); });
  fino.push(p0);
  const acum = [0];
  for (let k = 1; k < fino.length; k++) acum.push(acum[k - 1] + Math.hypot(fino[k][0] - fino[k - 1][0], fino[k][1] - fino[k - 1][1]));
  const total = acum[acum.length - 1];
  const out = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const objetivo = (i / n) * total;
    while (k < acum.length - 2 && acum[k + 1] < objetivo) k++;
    const f = (objetivo - acum[k]) / Math.max(acum[k + 1] - acum[k], 1e-6);
    out.push([fino[k][0] + (fino[k + 1][0] - fino[k][0]) * f, fino[k][1] + (fino[k + 1][1] - fino[k][1]) * f]);
  }
  return out;
}

/**
 * La curva cerrada entera (ES y luego EN) en las coordenadas del shader:
 * x a la derecha, y hacia ARRIBA, en unidades de su semiancho (el ∞ va de -1
 * a 1). Plana, para pasarla tal cual como uniforme vec2[].
 */
export function curvaParaShader() {
  const plana = [];
  MITADES.forEach(({ d }) => {
    muestrear(d, PUNTOS_POR_MITAD).forEach(([x, y]) => {
      plana.push((x - CENTRO_X) / SEMIANCHO, -(y - CENTRO_Y) / SEMIANCHO);
    });
  });
  return plana;
}

/**
 * LA DISTANCIA A LA CURVA, YA CALCULADA, EN UNA REJILLA.
 *
 * El shader medía la distancia a la curva recorriendo sus 96 segmentos, y lo
 * hacia dentro del trazado de rayos: por cada pixel y cada cruce con el disco,
 * seis veces mientras la cinta lleva el acabado del SVG (tres capas de grosor,
 * borde y cara, bisel y la propia cinta). Unas 576 distancias a segmento por
 * cruce, a pantalla completa. Medido en produccion (25-09-2026): la GPU
 * tardaba 1,4 s en presentar el primer fotograma tras elegir idioma, y el
 * morfo entero (1,8 s) se quedaba en cinco fotogramas. Se veia apagarse el
 * SVG y aparecer el hero: la transformacion no llegaba a verse.
 *
 * La curva no cambia nunca, asi que su campo de distancias se calcula una vez
 * aqui y el shader lo lee de una textura. Ver `distCurva` en BlackHole.jsx,
 * que tiene que usar este mismo DOMINIO. Medido en la Intel UHD integrada
 * (la que usa Chrome por defecto en el portatil): el morfo pasa de 42-58
 * fotogramas a 148-186, y el peor hueco de ~500 ms a ~100. La imagen es la
 * misma: con el ∞ imitando al SVG, 28 pixeles de antialias distintos en toda
 * la pantalla.
 *
 * Se calcula por propagacion y no punto a punto: cada segmento siembra los
 * texeles que tiene al lado y dos barridos pasan a cada texel el segmento mas
 * cercano de sus vecinos. ~8 segmentos por texel en vez de 96: 40 ms frente a
 * 130, y contra la fuerza bruta el error maximo es 2e-4 unidades (0,06 px).
 */
export const DOMINIO = { x0: -1.6, y0: -1.2, ancho: 3.2, alto: 2.4, w: 640, h: 480 };

export function campoDistancias() {
  const c = curvaParaShader();
  const n = c.length / 2;
  const { x0, y0, ancho, alto, w, h } = DOMINIO;
  const hx = ancho / (w - 1), hy = alto / (h - 1);

  // Distancia al cuadrado del punto (px, py) al segmento k.
  const seg = (k, px, py) => {
    const k1 = (k + 1) % n;
    const ax = c[2 * k], ay = c[2 * k + 1];
    const bx = c[2 * k1] - ax, by = c[2 * k1 + 1] - ay;
    const qx = px - ax, qy = py - ay;
    let t = (qx * bx + qy * by) / (bx * bx + by * by);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = qx - bx * t, dy = qy - by * t;
    return dx * dx + dy * dy;
  };

  const id = new Int16Array(w * h).fill(-1);
  const d2 = new Float64Array(w * h).fill(Infinity);

  // Semilla: cada segmento, en su caja y dos texeles alrededor.
  for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n;
    const i0 = Math.max(0, Math.floor((Math.min(c[2 * k], c[2 * k1]) - x0) / hx) - 2);
    const i1 = Math.min(w - 1, Math.ceil((Math.max(c[2 * k], c[2 * k1]) - x0) / hx) + 2);
    const j0 = Math.max(0, Math.floor((Math.min(c[2 * k + 1], c[2 * k1 + 1]) - y0) / hy) - 2);
    const j1 = Math.min(h - 1, Math.ceil((Math.max(c[2 * k + 1], c[2 * k1 + 1]) - y0) / hy) + 2);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const p = j * w + i;
        const e = seg(k, x0 + i * hx, y0 + j * hy);
        if (e < d2[p]) { d2[p] = e; id[p] = k; }
      }
    }
  }

  // El texel p prueba el segmento que tiene su vecino q.
  const probar = (p, q, px, py) => {
    const k = id[q];
    if (k < 0 || k === id[p]) return;
    const e = seg(k, px, py);
    if (e < d2[p]) { d2[p] = e; id[p] = k; }
  };
  for (let pasada = 0; pasada < 2; pasada++) {
    for (let j = 0; j < h; j++) {
      const py = y0 + j * hy;
      for (let i = 0; i < w; i++) {
        const p = j * w + i, px = x0 + i * hx;
        if (i > 0) probar(p, p - 1, px, py);
        if (j > 0) {
          probar(p, p - w, px, py);
          if (i > 0) probar(p, p - w - 1, px, py);
          if (i < w - 1) probar(p, p - w + 1, px, py);
        }
      }
      for (let i = w - 2; i >= 0; i--) probar(j * w + i, j * w + i + 1, x0 + i * hx, py);
    }
    for (let j = h - 1; j >= 0; j--) {
      const py = y0 + j * hy;
      for (let i = w - 1; i >= 0; i--) {
        const p = j * w + i, px = x0 + i * hx;
        if (i < w - 1) probar(p, p + 1, px, py);
        if (j < h - 1) {
          probar(p, p + w, px, py);
          if (i < w - 1) probar(p, p + w + 1, px, py);
          if (i > 0) probar(p, p + w - 1, px, py);
        }
      }
      for (let i = 1; i < w; i++) probar(j * w + i, j * w + i - 1, x0 + i * hx, py);
    }
  }

  const out = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) out[p] = Math.sqrt(d2[p]);
  return out;
}
