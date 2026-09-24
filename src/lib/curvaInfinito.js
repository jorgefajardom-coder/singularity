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

// Puntos por mitad. El shader recorre los segmentos uno a uno, asi que son
// los justos para que la cinta no se vea poligonal a pantalla completa.
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
