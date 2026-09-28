import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, GLSL3, HalfFloatType, LinearFilter, Mesh, NoBlending, Scene as Escena3D, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget } from "three";

// El arrastre por el puntero es cosa del hero. Fuera de el el agujero tiene
// que estar donde dice `journey`: en la orbita los aros (DOM) no saben nada
// del puntero y el agujero se salia de su centro hacia donde estuviera el
// raton; en las manos de los astronautas, igual.
const QUIETO = new Vector2(0, 0);
// El trazado del ∞ de los idiomas, para que la cinta del shader lo tape.
const CURVA = (() => {
  const plana = curvaParaShader();
  const out = [];
  for (let i = 0; i < plana.length; i += 2) out.push(new Vector2(plana[i], plana[i + 1]));
  return out;
})();
// Los segmentos en bloques de POR_GRUPO, cada uno con el circulo que lo
// envuelve (centro y radio), para que `distCurva` salte bloques enteros.
const POR_GRUPO = 8;
const GRUPOS = (() => {
  const out = [];
  for (let g = 0; g < CURVA.length / POR_GRUPO; g++) {
    const pts = [];
    for (let j = 0; j <= POR_GRUPO; j++) pts.push(CURVA[(g * POR_GRUPO + j) % CURVA.length]);
    const c = pts.reduce((a, p) => a.add(p), new Vector2()).divideScalar(pts.length);
    const r = Math.max(...pts.map((p) => p.distanceTo(c)));
    out.push(new Vector3(c.x, c.y, r));
  }
  return out;
})();
import { useLang } from "../lib/i18n";
import { useMusic } from "../lib/music";
import { PRESUPUESTO, marcarGpuFallo, perfil, revisarRenderer, useGpuFallo } from "../lib/gpu";
import { curvaParaShader } from "../lib/curvaInfinito";

// Pasos por rayo. En el telefono, menos: el coste del shader va con el area
// por los pasos, y los que se quitan son los del final, que solo recorren los
// rayos que rozan la esfera de fotones (y esos se apagan igual, ver `wound`).
// La precision se queda en highp: la integracion eleva r a la quinta, y en
// mediump (16 bits en muchas GPU moviles) eso desborda con r = 26.
// Interruptores de MEDICION por URL (solo para perfilar en un telefono):
// `?pasos=N`, `?paso=K` (factor del paso, 0.062 por defecto) y `?ruido=1`
// (una octava de ruido en vez de tres). Sin ellos, todo queda como siempre.
const PRUEBA = (() => {
  const q = typeof location === "undefined" ? "" : location.search;
  const num = (k) => { const m = new RegExp(`[?&]${k}=([0-9.]+)`).exec(q); return m ? Number(m[1]) : null; };
  return { pasos: num("pasos"), paso: num("paso"), ruido: num("ruido") };
})();
const PASOS = PRUEBA.pasos ?? (perfil.movil ? PRESUPUESTO.pasosAgujero.movil : PRESUPUESTO.pasosAgujero.escritorio);
const PASO_K = (PRUEBA.paso ?? 0.062).toFixed(4);
const OCTAVAS = PRUEBA.ruido === 1 ? 1 : 3;

const vertexShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Agujero negro trazado por geodésicas: cada píxel lanza un fotón hacia atrás y
// se integra su curvatura. La imagen superior del disco y la inferior aparecen
// solas; ninguna se dibuja a mano. El anillo de fotones también salía solo, y
// se apaga a propósito: ver `wound` más abajo.
// Compartidas por la traza y la composicion del modo partido (ver
// fragmentCompone): la composicion pinta las estrellas a resolucion completa.
const HASH31 = `float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
`;
const ESTRELLAS = `vec3 starField(vec3 d) {
  vec3 g = d * 132.0;
  vec3 cell = floor(g);
  float seed = hash31(cell + 3.77);
  if (seed < 0.945) return vec3(0.0);
  vec3 local = fract(g) - 0.5;
  vec3 off = vec3(hash31(cell), hash31(cell + 7.3), hash31(cell + 13.1)) - 0.5;
  float mag = 0.22 + 1.85 * pow(hash31(cell + 91.3), 3.0);
  // Titileo. Solo parpadea una parte —la que saca mas de 0.62 en su propio
  // hash—, y cada una con su ritmo y su fase: si parpadearan todas, o a la
  // vez, se leeria como un pulso de todo el cielo en lugar de como estrellas.
  // El resto se queda fija, que es lo que hace de referencia para que el
  // parpadeo de las otras se note. Mismo criterio que la capa DOM del resto de
  // la pagina (ver Starfield.jsx).
  float blinks = step(0.62, hash31(cell + 41.7));
  float rate   = 1.1 + 3.4 * hash31(cell + 5.9);
  float phase  = hash31(cell + 67.3) * 6.2831853;
  mag *= mix(1.0, 0.52 + 0.48 * sin(uTime * rate + phase), blinks);
  float spark = exp(-length(local - off * 0.7) * mix(15.0, 8.0, clamp(mag * 0.5, 0.0, 1.0)));
  vec3 tint = mix(vec3(0.72, 0.81, 1.00), vec3(1.00, 0.87, 0.70), hash31(cell + 57.1));
  return tint * spark * mag;
}
`;

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uRigid, uWind, uPower, uAspect, uFormation, uBass, uMid, uTreble, uReveal;
uniform float uHue;
// uDisk estira el borde EXTERIOR del disco y uWhite calienta su parte interna
// hasta el blanco. Los dos valen la identidad (1 y 0) en el agujero grande;
// solo los mueven los seis del halo. Ver los props de este componente.
uniform float uDisk, uWhite;
// DISK_OUT ya estirado. Es global y no constante porque depende del uniforme;
// main() lo fija antes de que nadie lo lea.
uniform float uScale, uTopDown, uIsolation, uFaceOn;
uniform vec2 uPointer, uCenter;
uniform float uArco;
uniform sampler2D uText, uCopy;
// El ∞ de los idiomas, el MISMO trazado del SVG del cargador, muestreado (ver
// curvaInfinito.js): x a la derecha, y arriba, en unidades de LEM_A. Y sus
// segmentos en bloques, con el circulo que envuelve a cada uno (xy centro, z
// radio).
const int CURVA_N = ${CURVA.length};
const int POR_GRUPO = ${POR_GRUPO};
const int GRUPOS_N = ${GRUPOS.length};
uniform vec2 uCurva[CURVA_N];
uniform vec3 uGrupos[GRUPOS_N];

const float DISK_IN  = 2.05;   // borde interno, junto a la última órbita estable
const float DISK_OUT = 15.0;
const float CAM_DIST = 26.0;   // la cámara mira desde fuera del disco
const float LENSE    = 3.00;   // distancia focal: encuadra la sombra en pantalla
float gOut;
const int   STEPS    = ${PASOS};
const float SPIN     = 0.17;   // arrastre de marco: el agujero gira de verdad
const float TILT0    = 0.092;  // el plano arranca mirando a la cámara
const float LEM_A    = 10.4;   // semianchura del ∞: cuadra con la del SVG del cargador

${HASH31}float noise3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i + vec3(0.0,0.0,0.0)), hash31(i + vec3(1.0,0.0,0.0)), f.x),
                 mix(hash31(i + vec3(0.0,1.0,0.0)), hash31(i + vec3(1.0,1.0,0.0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0.0,0.0,1.0)), hash31(i + vec3(1.0,0.0,1.0)), f.x),
                 mix(hash31(i + vec3(0.0,1.0,1.0)), hash31(i + vec3(1.0,1.0,1.0)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  // Tres octavas: la cuarta costaba lo mismo que las otras y aportaba menos
  // detalle que n3, que ya cubre la escala fina de los filamentos.
  float s = 0.0, a = 0.56;
  for (int i = 0; i < ${OCTAVAS}; i++) { s += a * noise3(p); p = p * 2.03 + 13.7; a *= 0.5; }
  return s;
}

// Gira el TONO alrededor del eje de los grises, que es la diagonal (1,1,1)
// normalizada. Es la rotacion de Rodrigues, y sirve aqui porque respeta la
// luminancia: el disco cambia de color sin cambiar de brillo, asi que el
// agujero de un area verde tiene exactamente la misma forma, el mismo
// contraste y el mismo aro que el de un area roja. Recolorear multiplicando
// por el color del area apagaria todo lo que no cae en ese canal.
vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(0.5773502691896258);
  float ca = cos(a), sa = sin(a);
  return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca);
}

// Rampa de cuerpo negro recortada en ámbar: no llega nunca a blanco, así el
// disco conserva el color del hierro fundido incluso en los picos.
//
// uHue la gira entera. En cero —el agujero grande, el del hero y el de las
// manos— queda tal cual estaba; los seis pequenos del halo le pasan cada uno
// el tono de su area. (Sin comillas invertidas: esto vive dentro de una
// plantilla de JavaScript y una sola la partiria en dos.)
vec3 ember(float h) {
  h = clamp(h, 0.0, 1.0);
  vec3 c = mix(vec3(0.25, 0.010, 0.002), vec3(0.92, 0.085, 0.004), smoothstep(0.00, 0.35, h));
  c = mix(c, vec3(1.00, 0.255, 0.022), smoothstep(0.33, 0.62, h));
  c = mix(c, vec3(1.00, 0.430, 0.095), smoothstep(0.60, 0.85, h));
  c = mix(c, vec3(1.00, 0.560, 0.185), smoothstep(0.84, 1.00, h));
  c = uHue == 0.0 ? c : hueShift(c, uHue);
  // El blanco entra solo en la parte CALIENTE, que es la de dentro: el nucleo
  // se pone al rojo blanco y el disco conserva el color del area hacia fuera.
  // Tenir tambien lo de fuera dejaria seis agujeros blancos iguales.
  return mix(c, vec3(1.0), uWhite * smoothstep(0.5, 1.0, h));
}

// Campo de estrellas: una por celda, con magnitud y color propios. La curva
// cúbica sobre la magnitud reparte como el cielo real, muchas tenues y unas
// pocas brillantes, en vez de una retícula de puntos todos iguales.
${ESTRELLAS}
// Emisión en el punto donde el fotón cruza la superficie luminosa. Esa
// superficie es la MISMA a lo largo de toda la escena: al principio su contorno
// es una lemniscata de Bernoulli (el ∞) sobre un plano que mira a la cámara, y
// al final es el anillo del disco sobre el plano ecuatorial. No hay dos objetos
// ni dos motores: hay un conjunto de nivel que se transforma.
// Distancia (en unidades de LEM_A) del punto p al trazado del ∞ de los idiomas.
//
// Exacta, segmento a segmento, pero sin recorrerlos todos: un bloque cuyo
// circulo ya queda mas lejos que la mejor distancia encontrada no puede
// mejorarla, y se salta entero. Recorrer los 96 segmentos en cada llamada,
// dentro del trazado de rayos, congelaba la intro en graficas integradas.
//
// (Se probo tambien leerla de una textura precalculada, 25-09-2026: iba mas
// rapido, pero en Chrome y Edge sobre la Intel el lienzo parpadeaba en negro
// un fotograma de vez en cuando, 6 de 9 pasadas. Con los segmentos, no.)
float distSegmento(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a, pa = p - a;
  return length(pa - ab * clamp(dot(pa, ab) / dot(ab, ab), 0.0, 1.0));
}
float distCurva(vec2 p) {
  float d = 1e3;
  for (int g = 0; g < GRUPOS_N; g++) {
    vec3 c = uGrupos[g];
    if (length(p - c.xy) - c.z >= d) continue;
    for (int j = 0; j < POR_GRUPO; j++) {
      int k = g * POR_GRUPO + j;
      int k1 = k + 1 < CURVA_N ? k + 1 : 0;
      d = min(d, distSegmento(p, uCurva[k], uCurva[k1]));
    }
  }
  return d;
}

// Lo contrario del tono de mas abajo (Reinhard con WHITE 1.85 y la curva de
// 0.92): que color hay que emitir para que en pantalla salga el color c.
vec3 sinTono(vec3 c) {
  const float W2 = 1.85 * 1.85;
  vec3 t = pow(max(c, 0.0), vec3(1.0 / 0.92));
  float m = max(t.r, max(t.g, t.b));
  if (m <= 0.0) return vec3(0.0);
  m = min(m, 0.999);
  float p = (-(1.0 - m) + sqrt((1.0 - m) * (1.0 - m) + 4.0 * m / W2)) * W2 * 0.5;
  return t * (p / m);
}

/*
 * El ACABADO del ∞ del SVG del cargador, capa por capa y en el mismo orden:
 * tres capas de grosor bajadas 7, 5 y 3 (degradado #loaderEdge), el borde
 * (--ember, 18 de ancho), la cara (#loaderFace, 16) y la luz del bisel
 * (#loaderLight, 14, subida 0.8). Es lo que la cinta del shader lleva puesto
 * al principio, para que el SVG se retire sobre una copia identica y el
 * cambio no se vea (Jorge: "no debe notarse el cambio a simple vista").
 * Devuelve el color en pantalla (rgb) y la cobertura (a). d es la distancia
 * de P0 al trazado, que quien llama ya tiene.
 */
vec4 esmalteSVG(vec2 P0, float d) {
  const float S = 85.35;               // unidades del viewBox por unidad de LEM_A
  const float AA = 0.0035;
  vec2 vb = vec2(99.55 + P0.x * S, 47.05 - P0.y * S);
  bool es = vb.x < 100.0;
  // Caja de cada mitad (las de objectBoundingBox de #loaderEdge y #loaderLight).
  vec2 c0 = es ? vec2(14.2, 17.0) : vec2(100.0, 13.8);
  vec2 c1 = es ? vec2(100.0, 80.3) : vec2(184.9, 80.3);
  vec4 o = vec4(0.0);

  // El resplandor de las dos mitades en la pantalla de eleccion (un
  // drop-shadow naranja en global.css, que se suma al de la animacion de
  // entrada). Va DEBAJO de la figura. Ancho e intensidad medidos contra el
  // SVG a 1536x639; en otras pantallas es el mismo halo difuso.
  float fuera = max(d - 9.0 / S, 0.0);
  float halo = 0.21 * exp(-0.5 * fuera * fuera / (0.056 * 0.056));

  // Lejos del trazado solo queda el halo. La capa que mas se aparta es la de
  // grosor bajada 7 (7/S) con 8.5/S de semiancho: por encima de 0.19 ninguna
  // capa puede tocar este punto (desigualdad triangular), asi que el
  // resultado es exactamente el mismo y se ahorran cuatro distancias.
  if (d > 0.19) return vec4(vec3(1.0, 0.416, 0.071), halo);

  // Grosor: tres capas desplazadas hacia abajo.
  for (int k = 0; k < 3; k++) {
    float bajada = k == 0 ? 7.0 : (k == 1 ? 5.0 : 3.0);
    vec2 q = vb - vec2(0.0, bajada);
    float cob = smoothstep(8.5 / S + AA, 8.5 / S - AA, distCurva(P0 + vec2(0.0, bajada / S)));
    vec2 b = (q - c0) / (c1 - c0);
    float t = clamp((0.3 * b.x + b.y) / 1.09, 0.0, 1.0);
    vec3 col = mix(vec3(1.0, 0.416, 0.071), vec3(0.227, 0.047, 0.008), t);
    o.rgb = mix(o.rgb, col, cob); o.a = cob + o.a * (1.0 - cob);
  }
  // Borde.
  float cob = smoothstep(9.0 / S + AA, 9.0 / S - AA, d);
  o.rgb = mix(o.rgb, vec3(0.49, 0.11, 0.016), cob); o.a = cob + o.a * (1.0 - cob);
  // Cara: degradado de (15, 20) a (190, 80) en el viewBox.
  cob = smoothstep(8.0 / S + AA, 8.0 / S - AA, d);
  float t = clamp(dot(vb - vec2(15.0, 20.0), vec2(175.0, 60.0)) / (175.0 * 175.0 + 60.0 * 60.0), 0.0, 1.0);
  vec3 cara = t < 0.55
    ? mix(vec3(1.0, 0.604, 0.235), vec3(1.0, 0.416, 0.071), t / 0.55)
    : mix(vec3(1.0, 0.416, 0.071), vec3(0.859, 0.196, 0.031), (t - 0.55) / 0.45);
  o.rgb = mix(o.rgb, cara, cob); o.a = cob + o.a * (1.0 - cob);
  // Luz del bisel: blanco arriba, nada a la mitad, sombra abajo.
  vec2 ql = vb + vec2(0.0, 0.8);
  cob = smoothstep(7.0 / S + AA, 7.0 / S - AA, distCurva(P0 + vec2(0.0, -0.8 / S)));
  vec2 b = (ql - c0) / (c1 - c0);
  float tl = clamp((0.2 * b.x + b.y) / 1.04, 0.0, 1.0);
  vec4 luz = tl < 0.48 ? vec4(1.0, 1.0, 1.0, 0.55 * (1.0 - tl / 0.48))
                       : vec4(0.169, 0.031, 0.008, 0.35 * (tl - 0.48) / 0.52);
  o.rgb = mix(o.rgb, luz.rgb, cob * luz.a);

  float a = o.a + halo * (1.0 - o.a);
  vec3 premul = o.rgb * o.a + vec3(1.0, 0.416, 0.071) * halo * (1.0 - o.a);
  return vec4(a > 0.0 ? premul / a : vec3(0.0), a);
}

// El plasma en un punto del plano (u, v) del disco. dop es el coseno entre
// la orbita de la materia y la direccion hacia la camara (el Doppler). Va
// aparte de la geometria para que el modo diferido (ver COMPONE) lo pueda
// calcular a resolucion completa con un impacto interpolado.
vec3 diskShade(float u, float v, float dop, float morph, out float opacity) {
  float r = sqrt(u * u + v * v);
  float t = (r - DISK_IN) / (gOut - DISK_IN);
  float edge = smoothstep(0.0, 0.016, t) * smoothstep(1.0, 0.45, t);
  // Mientras es una cinta el perfil radial del disco todavía no manda.
  edge = mix(1.0, edge, morph);

  // ∞   →   anillo  R = RMID.
  // Se interpolan las DISTANCIAS a uno y a otro: mezclar dos campos de
  // distancia transforma un contorno en el otro sin que nada aparezca ni
  // desaparezca por el camino. (Es la transformacion de la primera version de
  // la intro, b515bf3: la que Jorge eligio el 24-09-2026.)
  // La distancia al ∞ es la distancia al TRAZADO DEL SVG, segmento a
  // segmento: la cinta de plasma tapa asi al ∞ de los idiomas punto por
  // punto, con su forma original (Jorge: ni engordarla ni achicarla). Con el
  // disco ya formado no se usa, y el agujero del hero no paga el recorrido.
  // La misma distancia la usa el acabado del SVG (esmalteSVG): se calcula
  // una sola vez por cruce.
  float esmalte = 1.0 - smoothstep(0.02, 0.34, uFormation);
  vec2 P0 = vec2(u, v) / LEM_A;
  float dCurva = (morph < 0.999 || esmalte > 0.0) ? distCurva(P0) : 1e3;
  float toEight = morph < 0.999 ? dCurva : 1e3;

  const float R_IN  = DISK_IN / LEM_A;
  const float R_OUT = DISK_OUT / LEM_A;
  const float RMID  = (R_IN + R_OUT) * 0.5;
  // El anillo con las coordenadas SIN aplanar: el disco es redondo.
  float toRing = abs(r / LEM_A - RMID);

  // Con el disco formado ya no se mezcla: toEight vale 1e3 y, aun con peso
  // (1 - morph) de milesimas, sumaba ~0,9 a la distancia y el disco entero
  // desaparecia durante los dos o tres fotogramas que tarda morph en pasar
  // de 0,999 a 1. Era el parpadeo en negro del relevo al hero (25-09-2026).
  float dist = morph < 0.999 ? mix(toEight, toRing, morph) : toRing;

  // La meseta de la banda (el 80 % interior) tiene que cubrir exactamente el
  // anillo DISK_IN..DISK_OUT; si no, se come la parte interna, que es la más
  // caliente y brillante del disco.
  // 0.088 ≈ el mismo grosor de trazo que el ∞ del SVG del cargador: la cinta
  // del shader releva a la del SVG sin cambiar de grosor.
  // 0.125: medido contra la CARA del ∞ del SVG, que ya es la misma curva y es
  // lo unico que queda de el en el relevo (el borde y el grosor se apagan
  // antes). Con 0.088 la cinta de plasma se quedaba corta y en el fundido
  // asomaba el borde interior del SVG como un filo oscuro (24-09-2026).
  float width = mix(0.125, (R_OUT - R_IN) / 1.6, morph);
  edge *= smoothstep(width, width * 0.80, dist);

  // Salida temprana: la geometría es barata y el ruido no. Cuando el cruce cae
  // fuera de la figura —lo habitual durante la fase de ∞ y en todo el exterior
  // del disco— se ahorran las tres octavas de fbm y el resto del sombreado.
  // Al principio la cinta lleva el acabado del SVG (ver esmalteSVG), y el
  // plasma la invade mientras la figura ya se transforma.
  vec4 lamina = esmalte > 0.0 ? esmalteSVG(P0, dCurva) : vec4(0.0);
  if (edge < 0.004) {
    opacity = lamina.a * esmalte;
    return sinTono(lamina.rgb) * lamina.a * esmalte;
  }

  // Rotación diferencial: el interior se adelanta al exterior y cizalla la
  // materia. El exponente es más suave que el kepleriano real (1.5) a
  // propósito: con la caída física el disco exterior queda casi parado y es
  // justo la zona que más superficie ocupa, así que el giro no se percibía.
  // El giro llega en dos piezas, y las dos están acotadas a propósito:
  //
  //  · uRigid  gira el disco entero y viene ya envuelto en [0, 2π). Como todo
  //    lo que sigue es 2π-periódico, envolverlo es exacto: nunca se nota y el
  //    ángulo que reciben sin() y cos() jamás crece, así que no se degrada.
  //  · uWind   es el enrollado diferencial, y se satura. Si creciera sin
  //    límite, su gradiente radial acabaría siendo mayor que un píxel y la
  //    espiral se convertiría en ruido: el disco parecía quieto porque su
  //    textura ya no se resolvía, no porque hubiera dejado de girar.
  float shear = pow(DISK_IN / r, 0.95);
  // El plasma fluye desde el primer instante: con el giro a cero mientras
  // la figura era un ∞, la cinta parecia una imagen congelada.
  float spin = (uRigid + uWind * (shear - 1.0)) * mix(0.45, 1.0, morph);
  float a = atan(v, u) + spin;
  vec2 ring = vec2(cos(a), sin(a));

  float n1 = fbm(vec3(ring * 1.25, r * 0.42));
  float n2 = fbm(vec3(ring * 2.70, r * 3.10 + n1 * 1.1 + uMid * 0.45));
  float n3 = noise3(vec3(ring * 4.80, r * 13.5 + n1 * 2.2));
  // Filamentos largos en el sentido del giro y finos en el radial, agrupados
  // en brazos: sin ellos la cizalla lo mezcla todo y el giro no se percibe.
  float arms = 0.5 + 0.5 * sin(a * 2.0 + n1 * 4.2);
  float filament = (0.10 + 1.08 * n2 + 0.85 * pow(max(n3, 0.0), 3.0)) * (0.30 + 1.25 * arms)
                 + 0.40 * pow(arms, 5.0);

  float heat = clamp(pow(DISK_IN / r, 0.45) + (0.14 + uBass * 0.08) * (n2 - 0.5) + uTreble * 0.02, 0.0, 1.0);
  float falloff = pow(DISK_IN / r, 1.60);

  // Doppler relativista: el lado que viene hacia la cámara se enciende.
  float beta = 0.42 * sqrt(DISK_IN / r);
  float boost = 1.0 / max(1.0 - beta * dop, 0.35);
  boost = mix(1.0, pow(boost, 2.2), 0.28);

  opacity = clamp(edge * filament * 0.82, 0.0, 1.0);
  float glow = edge * filament * falloff * boost * (9.8 + uBass * 5.4 + uTreble * 1.6 + uPower * 4.4);
  vec3 plasma = ember(heat) * glow;
  if (esmalte <= 0.0) return plasma;
  opacity = mix(opacity, lamina.a, esmalte);
  return mix(plasma, sinTono(lamina.rgb) * lamina.a, esmalte);
}

vec3 diskSample(vec3 hit, vec3 dir, vec3 e1, vec3 e2, vec3 nrm, float morph, out float opacity) {
  return diskShade(dot(hit, e1), dot(hit, e2), dot(normalize(cross(nrm, hit)), -dir), morph, opacity);
}

#ifndef COMPONE
void main() {
#ifdef PARTIDO
  // Pasada de trazado del modo partido (ver PARTIDO en Scene): el titular no
  // se lee aqui, se dejan sus coordenadas y su brillo para la composicion.
  gTexto = vec4(-1.0);
  gCielo = vec4(0.0);
  float gBrillo = 0.0;
#endif
#ifdef DIFERIDO
  // Traza del modo diferido (ver COMPONE): los dos primeros cruces con el
  // disco (u, v, Doppler, angulo recorrido; -1 si no hay) en vez del color;
  // el cielo y el titular, SIN la transparencia acumulada, que depende del
  // plasma y la calcula la composicion. Por defecto, horizonte.
  gA = vec4(0.0, 0.0, 0.0, -1.0);
  gB = vec4(0.0, 0.0, 0.0, -1.0);
  gCielo = vec4(0.0, 0.0, 1.0, -1.0);
  gTexto = vec4(-1.0, -1.0, 0.0, 0.0);
  int nCruces = 0;
#endif
  // Lo primero: el borde exterior del disco, del que cuelgan tanto el perfil
  // radial como los dos cortes que deciden si un rayo se integra.
  gOut = DISK_OUT * uDisk;
  float zoom = clamp(1.85 / max(uAspect, 0.35), 1.0, 2.2);
  // El disco mide ~1.85 de media altura: si el marco es más estrecho que eso,
  // la cámara se aleja hasta que la figura entra entera.
  vec2 screen = (vUv - 0.5) * 2.0 * vec2(uAspect, 1.0) * zoom;
  // El agujero se deja arrastrar por el puntero; el titular, que vive detrás,
  // se queda quieto y por eso la lente lo recorre y lo deforma.
  vec2 shift = uPointer * vec2(0.46, 0.30) * (1.0 + uPower * 0.55) * smoothstep(0.55, 1.0, uFormation);
  // Con cada golpe el agujero entero crece: el pulso se ve aunque se mire de lejos.
  //
  // uCenter mueve el agujero por la pantalla sin tocar el lienzo (que sigue
  // cubriendo todo) y uScale lo aleja. Se expresa en fraccion de media
  // pantalla, +Y arriba, para que el DOM pueda situar las marcas en el mismo
  // punto con una sola conversion.
  vec2 center = uCenter * vec2(uAspect, 1.0) * zoom;
  vec2 uv = (screen * (1.0 - uBass * 0.021) - shift - center) * uScale;

  float grow     = smoothstep(0.0, 1.0, uFormation);
  // Los tiempos de la primera version de la intro (b515bf3), la elegida: el
  // ∞ empieza plano y sin gravedad, y el HORIZONTE se abre pronto, en el cruce
  // del ∞, mientras la figura todavia es un ∞. Despues se cierra en anillo, se
  // tumba y la curvatura lo termina de doblar.
  float lens     = smoothstep(0.38, 0.96, uFormation);
  float morph    = smoothstep(0.26, 0.88, uFormation);
  // Repartir el cambio de perspectiva y suavizar también su aceleración.
  float tiltProgress = clamp((uFormation - 0.12) / 0.84, 0.0, 1.0);
  float tiltAmt = tiltProgress * tiltProgress * tiltProgress
                * (tiltProgress * (tiltProgress * 6.0 - 15.0) + 10.0);
  // El horizonte de sucesos se mueve con la música: los graves lo hinchan y
  // los agudos rizan su silueta, así que la sombra late en vez de estar quieta.
  float pulse    = 0.065 * uBass + 0.07 * uTreble * sin(atan(uv.y, uv.x) * 5.0 - uTime * 6.0);
  // Desde 0: con 0.04 al principio quedaba un punto negro en el cruce del ∞
  // que el SVG no tiene, y delataba el relevo.
  float horizon  = mix(0.0, 1.0, smoothstep(0.02, 0.70, uFormation)) * (1.0 + pulse);
  // En la version original valia 0 con la formacion a 0, y mientras el SVG se
  // quemaba (con la formacion todavia en 0) la pantalla se quedaba en negro:
  // el hueco que se veia a los 0,75 s. La cinta de plasma tiene que estar ya
  // debajo cuando el SVG se apaga; mientras no toca verla, la tapa el cargador.
  float diskFade = 1.0;

  // Elevacion de la camara sobre el plano ecuatorial. De canto (5 grados) es
  // como se ve el disco toda la vida; uTopDown la sube a 80, que es donde se
  // lee como un sistema planetario. No llega a 90 a proposito: ahi la mirada
  // es paralela al eje Y y el producto vectorial que define el eje derecho
  // degenera.
  float inclBase = 0.092 + uPointer.y * 0.055 + sin(uTime * 0.17) * 0.010 * grow + uBass * 0.025;
  float incl = mix(inclBase, 1.40 + uPointer.y * 0.10, uTopDown);
  float yaw  = uPointer.x * 0.26 + sin(uTime * 0.13) * 0.020 * grow;
  incl = mix(incl, 1.57079632679, uFaceOn);
  yaw *= 1.0 - uFaceOn;

  // Plano de la materia: arranca de frente a la cámara (el ∞ se lee entero) y
  // se tumba hasta el ecuador, donde ya es el disco de acreción.
  //
  // No se interpola el ÁNGULO sino el escorzo. Lo que se ve al cambiar de vista
  // es cos(φ − TILT0), cuya derivada vale casi cero de frente y es máxima de
  // canto: por muy suave que sea la curva del parámetro, el plano parece
  // quedarse quieto y desplomarse al final. Interpolando el escorzo y
  // despejando el ángulo con acos, el aplastamiento avanza parejo en pantalla.
  float squash = mix(1.0, -sin(TILT0), tiltAmt);
  float pang = TILT0 - acos(clamp(squash, -1.0, 1.0));
  vec3 e1  = vec3(1.0, 0.0, 0.0);
  vec3 e2  = vec3(0.0, cos(pang), -sin(pang));
  vec3 nrm = vec3(0.0, sin(pang), cos(pang));

  vec3 camPos = vec3(sin(yaw) * cos(incl), sin(incl), cos(yaw) * cos(incl)) * CAM_DIST;
  vec3 fwd   = normalize(-camPos);
  // Base estable incluso al mirar el disco exactamente desde arriba.
  vec3 right = vec3(cos(yaw), 0.0, -sin(yaw));
  vec3 up    = cross(right, fwd);
  vec3 dir   = normalize(fwd * LENSE + right * uv.x + up * uv.y);

  vec3 col = vec3(0.0);
  float trans = 1.0;
  bool captured = false;
  vec3 vel = dir;
  // Angulo recorrido alrededor del agujero. Vive FUERA del bloque de
  // integracion porque lo necesita tambien el fondo: un rayo que se salta el
  // bucle no ha girado nada y se queda en cero.
  float swept = 0.0;

  // Un rayo con parámetro de impacto grande no puede tocar ni el disco ni el
  // horizonte: se salta la integración entera y el fondo sale casi gratis.
  float impact = length(cross(camPos, dir));
  if (impact < gOut + 1.6) {
    vec3 pos = camPos;
    float side = dot(pos, nrm);
    vec3 mom = cross(pos, vel);
    // El momento angular se conserva salvo por el arrastre, asi que
    // dφ = |L|/r²·dt sale de una division por paso.
    float angMom = length(mom);
    // La curvatura también bombea: con el golpe la sombra se abre.
    float h2 = dot(mom, mom) * lens * (1.0 + uBass * 0.28);
    float drag = SPIN * lens * (1.0 + uBass * 1.15 + uPower * 0.8);
    for (int i = 0; i < STEPS; i++) {
      float r2 = dot(pos, pos);
      float r = sqrt(r2);
      if (r < horizon) { captured = true; break; }
      if (r > CAM_DIST * 1.3 && dot(pos, vel) > 0.0) break;
      // El paso se acorta junto al horizonte, que es donde hace falta precisión
      // para que el filo de la sombra y el anillo de fotones salgan limpios;
      // lejos se alarga, porque allí la trayectoria es casi recta.
      float dt = clamp(min(r * ${PASO_K}, (r - horizon) * 0.30 + 0.012), 0.010, 0.95);
      vec3 prev = pos;
      vel += (-1.5 * h2 * pos / (r2 * r2 * r)) * dt;
      // Lense-Thirring: un agujero en rotación arrastra el espacio consigo, así
      // que el propio rayo gira alrededor del eje. Decae como 1/r^3, por eso
      // solo retuerce el fondo pegado al horizonte.
      vel += cross(vec3(0.0, drag / (r2 * r), 0.0), vel) * dt;
      pos += vel * dt;
      swept += angMom / max(r2, 1e-4) * dt;
      float next = dot(pos, nrm);
      if (side * next < 0.0) {
        float f = side / (side - next);
        vec3 hit = mix(prev, pos, f);
        float rr = length(vec2(dot(hit, e1), dot(hit, e2)));
        // Cubre tanto el ∞ como el borde exterior del disco, el mayor de los dos.
        if (rr < max(gOut, LEM_A) + 1.0) {
#ifdef DIFERIDO
          // Los cruces con mas de 4.5 rad ya estan apagados del todo (ver
          // wound): no cuentan. Sin plasma aqui no se sabe cuando el disco
          // se vuelve opaco, asi que el rayo sigue hasta escapar o caer.
          if (swept < 4.5 && nCruces < 2) {
            vec4 cruce = vec4(dot(hit, e1), dot(hit, e2), dot(normalize(cross(nrm, hit)), -normalize(vel)), swept);
            if (nCruces == 0) gA = cruce; else gB = cruce;
            nCruces++;
          }
#else
          float op;
          vec3 e = diskSample(hit, normalize(vel), e1, e2, nrm, morph, op);
          // Los rayos que pasan rozando la esfera de fotones dan vueltas
          // enteras alrededor del agujero y vuelven a cruzar el disco una y
          // otra vez. Todos esos cruces caen en la misma franja de pantalla
          // —la del borde de la sombra— y se apilan ahi en una raya fina y
          // dura: el anillo de fotones, que ademas sale moteado porque a esa
          // altura el paso de integracion ya no resuelve el giro. Se lee como
          // un aro dibujado encima, no como materia.
          //
          // Se apaga por angulo recorrido, que es lo unico que separa de
          // verdad un caso del otro: el disco directo llega girando menos de
          // media vuelta y su imagen doblada por debajo, poco mas de una; el
          // anillo necesita vueltas enteras. Por radio no se pueden separar,
          // porque el borde interno del disco esta justo donde pasan.
          float wound = 1.0 - smoothstep(2.9, 4.5, swept);
          col += trans * e * diskFade * wound;
          trans *= 1.0 - op;
          if (trans < 0.02) break;
#endif
        }
      }
      side = next;
    }
  }

  if (!captured) {
    vec3 away = normalize(vel);
    // La misma cuenta que apaga el anillo de fotones hay que hacersela al
    // FONDO, y esto es lo que quitaba la raya blanca punteada de dentro de la
    // sombra.
    //
    // Los rayos que rozan la esfera de fotones salen disparados en
    // direcciones que cambian muchisimo de un pixel al de al lado. Con una
    // muestra por pixel, el campo de estrellas —que son puntos diminutos y
    // muy brillantes— no se puede resolver ahi: lo que sale no son estrellas
    // sino aliasing, un punteado blanco apilado justo en el filo de la sombra.
    // Se veia como una linea dibujada encima del agujero.
    //
    // Por eso se apaga por angulo recorrido, igual que el disco: un rayo que
    // ha girado mas de dos radianes alrededor del agujero ya no esta mirando
    // al cielo de forma que se pueda muestrear, asi que se funde en vez de
    // aliasear. El fondo normal —que llega girando casi nada— no se toca.
    float clear = 1.0 - smoothstep(2.0, 3.6, swept);
    // El cielo entra despacio mientras el ∞ se transforma: el fondo del
    // cargador es liso, y aparecer de golpe delataba el relevo.
    float cielo = smoothstep(0.08, 0.55, uFormation);
#ifdef PARTIDO
    // Las estrellas son de un pixel: a media resolucion el reescalado las
    // borraba. Se deja la direccion de escape y su peso; las pinta la
    // composicion a resolucion completa.
    gCielo = vec4(away, trans * (2.15 + uTreble * 1.15) * (1.0 - uIsolation) * clear * cielo);
#elif defined(DIFERIDO)
    gCielo = vec4(away, (2.15 + uTreble * 1.15) * (1.0 - uIsolation) * clear * cielo);
#else
    col += starField(away) * trans * (2.15 + uTreble * 1.15) * (1.0 - uIsolation) * clear * cielo;
#endif
    // Mientras tanto, el fondo es el del cargador (--ink, #08070a), no negro.
    col += sinTono(vec3(0.031, 0.027, 0.039)) * trans * (1.0 - cielo) * (1.0 - uIsolation);
    // El titular es el fondo por el que pasan los fotones. Se vuelve a
    // proyectar la dirección de SALIDA del rayo: sin curvatura cae exactamente
    // donde lo pone el DOM, y cerca del horizonte se estira y desaparece.
    float ahead = dot(away, fwd);
    if (ahead > 0.02) {
      // En reposo la gravedad ya actúa casi entera sobre el titular: es lo que
      // lo mantiene curvado sin tocar nada. Los extras solo lo rematan.
      // Los golpes de la musica tiran del titular: el agujero deforma el texto
      // y los golpes tienen que notarse en el (Jorge, 27-09-2026).
      float warp = clamp(0.62 + uBass * 0.45 + uPower * 0.35 + length(uPointer) * 0.38, 0.0, 1.1);
      vec2 lensed = LENSE * vec2(dot(away, right), dot(away, up)) / ahead + shift;
      // El tirón de la lente se satura en curva, no de golpe: un recorte duro
      // daría a todos los píxeles el mismo desplazamiento y el titular se
      // movería en bloque en vez de deformarse. Así el gradiente sobrevive y
      // el texto se sigue arqueando sin llegar a salirse del encuadre.
      //
      // El tiron de arriba no es solo la lente: un rayo sin curvar ya da
      // (uScale-1)*screen - uScale*center, un zoom de toda la capa hacia un
      // punto que depende de la escala y de DONDE esta el agujero. Con el
      // recorte de abajo, ese zoom es buena parte del arco del nombre, y el
      // arco de diseno es el de escritorio (escala 1.34, centro -0.17). Aqui
      // se cambia por el de escritorio medido en radios del agujero, asi que:
      //   - en escritorio es la misma imagen aunque el agujero baje para dejar
      //     margen bajo la barra (Jorge, 27-09-2026: "sin cambiar como se
      //     deforma"), solo que mas abajo;
      //   - en el telefono el nombre se arquea como en escritorio en vez de
      //     salir casi plano (Jorge, 28-09-2026).
      // uArco a 0 en el telefono en horizontal: alli el agujero es diminuto
      // (el pie no le deja sitio) y este cambio ampliaba el nombre hasta
      // cortarlo por los lados.
      vec2 pull = lensed - screen + uArco * ((1.34 - uScale) * screen + (uScale - 0.34) * center
                + vec2(0.0, 0.17) * (1.34 / max(uScale, 0.05)));
      float reach = length(pull);
      // El recorte va en proporcion al agujero (su radio en pantalla es
      // R_UV / uScale): con 0.80 fijo, en el telefono —donde el agujero ocupa
      // mas unidades— el tiron se saturaba antes y el nombre salia casi
      // plano (Jorge, 28-09-2026: igual que en escritorio). En escritorio
      // uScale vale 1.34 y el recorte es el de siempre.
      float tope = 0.80 * 1.34 / max(uScale, 0.05);
      pull *= (reach / (1.0 + reach / tope)) / max(reach, 1e-4);
      // El texto NO late con la musica. Los graves siguen hinchando el disco
      // y el horizonte (ver uv y pulse mas arriba), pero escalar tambien
      // estas coordenadas empujaba el titular fuera del encuadre en cada
      // golpe. Ojo: nada de acentos graves aqui dentro, esto es una plantilla.
      vec2 base = screen;
      vec2 frame = 2.0 * vec2(uAspect, 1.0) * zoom;
      // El texto pequeño va en su propia capa con mucha menos lente: el mismo
      // desplazamiento que en un titular de 130 px se lee como curvatura, y en
      // uno de 14 px como un renglón tirado por la página.
      // El titular se frena por angulo recorrido, igual que el cielo, pero con
      // UN UMBRAL MUY DISTINTO, y esa diferencia es el asunto entero. Ojo:
      // nada de comillas invertidas en este bloque, que vive dentro de una
      // plantilla de JS.
      //
      // Un rayo RECTO que pasa cerca del agujero ya barre del orden de PI
      // radianes solo por ir de lejos a lejos: el angulo que ve el origen
      // entre la entrada y la salida. O sea que barrer ~3 NO significa haber
      // dado vueltas. Reutilizar aqui el umbral del cielo —que empieza a
      // apagar en 2.0, por DEBAJO de PI— apagaba rayos normales: medido a
      // 1536x639, el titular pasaba de 248.8 de luminancia media y 38137
      // pixeles casi blancos a 166.8 y 11. O sea de blanco a gris.
      //
      // Empezando a apagar en 4.2 (por encima de PI) y acabando en 6.0 (~2PI)
      // solo caen los que de verdad se han enrollado en la esfera de fotones,
      // que son los que no se pueden muestrear con un rayo por pixel y salian
      // como un punteado blanco por dentro del filo de la sombra. Medido en
      // cinco fotogramas: el titular se queda en 248.6-248.7 con ~38120 casi
      // blancos —identico al original sin frenar— y dentro de la sombra
      // quedan de 0 a 2 pixeles de brillo naranja con luminancia 13-21,
      // frente a los 26 de blanco puro (255) que habia.
      //
      // EL TITULAR VA BLANCO BRILLANTE. Si algun dia hay que tocar esto,
      // medir su luminancia media ANTES y DESPUES, no solo contar las rayas.
      float bright = trans * uReveal * (2.05 + uBass * 0.7) * (1.0 - smoothstep(4.2, 6.0, swept));
      vec2 tcA = (base + pull * warp) / frame + 0.5;
#ifdef PARTIDO
      gTexto = vec4(tcA, (base + pull * warp * 0.13) / frame + 0.5);
      gBrillo = bright;
#elif defined(DIFERIDO)
      // La capa pequena (uCopy) va en tcA escalado a 0.13 respecto al pixel:
      // la composicion la recalcula (ver COMPONE).
      gTexto = vec4(tcA, uReveal * (2.05 + uBass * 0.7) * (1.0 - smoothstep(4.2, 6.0, swept)), 0.0);
#else
      if (tcA.x > 0.0 && tcA.x < 1.0 && tcA.y > 0.0 && tcA.y < 1.0) {
        // La textura de canvas ya llega volteada: tc se usa tal cual.
        vec4 glyph = texture2D(uText, tcA);
        col += glyph.rgb * glyph.a * bright;
      }
      vec2 tcB = (base + pull * warp * 0.13) / frame + 0.5;
      if (tcB.x > 0.0 && tcB.x < 1.0 && tcB.y > 0.0 && tcB.y < 1.0) {
        vec4 glyph = texture2D(uCopy, tcB);
        col += glyph.rgb * glyph.a * bright;
      }
#endif
    }
  }

  // Bruma cálida muy tenue: el halo que el disco deja en la óptica.
  float d = length(uv);
  col += vec3(1.0, 0.29, 0.04) * exp(-max(d - 0.17, 0.0) * 6.5) * 0.022 * diskFade * (0.55 + uBass * 0.9)
       * smoothstep(0.08, 0.55, uFormation);

#ifdef PARTIDO
  // Color lineal (antes del tono) y, en alfa, el brillo del titular; -1 si
  // el rayo cae en el horizonte. Reescalado, el -1 se mezcla con sus vecinos
  // y el filo de la sombra sale suave en vez de a escalones.
  gColor = vec4(col, captured ? -1.0 : gBrillo);
  return;
#endif
#ifdef DIFERIDO
  return;
#endif

  // Reinhard extendido sobre el canal más alto: comprime el brillo sin que el
  // rojo se sature antes que el verde, que es lo que volvía amarillo el disco.
  const float WHITE = 1.85;
  float peak = max(col.r, max(col.g, col.b));
  float mapped = peak * (1.0 + peak / (WHITE * WHITE)) / (1.0 + peak);
  col = min(col * (mapped / max(peak, 1e-4)), vec3(1.0));
  col = pow(max(col, 0.0), vec3(0.92));
  col *= 1.0 - smoothstep(1.70, 3.30, d) * 0.28;
  // Keep the horizon opaque, but let the page show through empty space.
  // Isolate the disk before moving the canvas so its bounds never travel
  // with it as a black rectangle. Preserve the glow with straight alpha.
  float light = max(col.r, max(col.g, col.b));
  float diskAlpha = captured ? 1.0 : smoothstep(0.0, 0.12, light);
  float alpha = mix(1.0, diskAlpha, uIsolation);
#if !defined(PARTIDO) && !defined(DIFERIDO)
  gl_FragColor = vec4(col / max(alpha, 0.0001), alpha);
#endif
}
#endif

#ifdef COMPONE
/*
 * Composicion del modo diferido, a resolucion completa. La traza (baja
 * resolucion) dejo, por pixel, los dos primeros cruces del rayo con el disco.
 * Aqui el plasma se calcula en cada pixel de la pantalla con el impacto
 * interpolado: los filamentos salen con todo su detalle aunque el rayo se
 * haya trazado a media resolucion. El impacto cambia suave de un pixel a
 * otro, asi que interpolarlo es casi exacto; donde no (el filo del disco, el
 * de la sombra), el cruce no existe en todos los vecinos y se sombrea cada
 * vecino por separado y se mezclan: el filo sale suave, no a escalones.
 */
uniform sampler2D tA, tB, tCielo, tTexto, tDisco;
uniform vec2 uEsc, uTexel;

void capaDisco(sampler2D t, ivec2 c00, ivec2 c10, ivec2 c01, ivec2 c11, vec4 w, inout vec3 col, inout float trans) {
  vec4 a = texelFetch(t, c00, 0), b = texelFetch(t, c10, 0), c = texelFetch(t, c01, 0), d = texelFetch(t, c11, 0);
  vec4 ok = vec4(step(0.0, a.w), step(0.0, b.w), step(0.0, c.w), step(0.0, d.w));
  if (dot(ok, w) < 1e-4) return;
  vec3 e = vec3(0.0);
  float op = 0.0;
  // Interpolar solo vale si los cuatro son el MISMO trozo de disco. En el
  // borde de abajo de la imagen inferior, vecinos con "primer cruce" en
  // zonas distintas del disco daban, interpolados, un punto intermedio que no
  // existe (el interior caliente): una raya brillante horizontal.
  float salto = max(max(distance(a.xy, b.xy), distance(a.xy, c.xy)), max(distance(a.xy, d.xy), distance(b.xy, c.xy)));
  float giro = max(max(abs(a.w - b.w), abs(a.w - c.w)), abs(a.w - d.w));
  if (ok.x * ok.y * ok.z * ok.w > 0.5 && salto < 1.2 && giro < 0.6) {
    vec4 m = a * w.x + b * w.y + c * w.z + d * w.w;
    e = diskShade(m.x, m.y, m.z, 1.0, op) * (1.0 - smoothstep(2.9, 4.5, m.w));
  } else {
    float o;
    if (ok.x > 0.5) { e += diskShade(a.x, a.y, a.z, 1.0, o) * (1.0 - smoothstep(2.9, 4.5, a.w)) * w.x; op += o * w.x; }
    if (ok.y > 0.5) { e += diskShade(b.x, b.y, b.z, 1.0, o) * (1.0 - smoothstep(2.9, 4.5, b.w)) * w.y; op += o * w.y; }
    if (ok.z > 0.5) { e += diskShade(c.x, c.y, c.z, 1.0, o) * (1.0 - smoothstep(2.9, 4.5, c.w)) * w.z; op += o * w.z; }
    if (ok.w > 0.5) { e += diskShade(d.x, d.y, d.z, 1.0, o) * (1.0 - smoothstep(2.9, 4.5, d.w)) * w.w; op += o * w.w; }
  }
  col += trans * e;
  trans *= 1.0 - op;
}

void main() {
  gOut = DISK_OUT * uDisk;
  // Texel de la traza (que ocupa solo una parte de su textura, uEsc).
  vec2 p = vUv * uEsc / uTexel - 0.5;
  vec2 hi = floor(uEsc / uTexel) - 1.0;
  vec2 i0 = clamp(floor(p), vec2(0.0), hi);
  vec2 i1 = clamp(i0 + 1.0, vec2(0.0), hi);
  vec2 f = clamp(p - floor(p), 0.0, 1.0);
  vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  ivec2 c00 = ivec2(i0), c10 = ivec2(i1.x, i0.y), c01 = ivec2(i0.x, i1.y), c11 = ivec2(i1);

  vec3 col = vec3(0.0);
  float trans = 1.0;
#ifdef SOMBREA
  // Pasada intermedia: solo el plasma, a densidad 1. La composicion final va
  // a mas densidad (el titular) y lo amplia; calcular el plasma a esa
  // densidad cuadruplicaba el coste (Redmi: 35 -> 14 fps a densidad 2).
  capaDisco(tA, c00, c10, c01, c11, w, col, trans);
  capaDisco(tB, c00, c10, c01, c11, w, col, trans);
  gDisco = vec4(col, trans);
  return;
#else
  vec4 disco = texture(tDisco, vUv);
  col = disco.rgb;
  trans = disco.a;
#endif

  vec2 uvT = min(vUv * uEsc, uEsc - 0.5 * uTexel);
  vec4 cielo = texture(tCielo, uvT);
  float horizonte = clamp(-cielo.w, 0.0, 1.0);
  if (cielo.w > 0.001) col += starField(normalize(cielo.xyz)) * trans * cielo.w;
  vec4 tx = texture(tTexto, uvT);
  if (tx.z > 0.0) {
    float bright = trans * tx.z;
    vec2 tcA = tx.xy;
    if (tcA.x > 0.0 && tcA.x < 1.0 && tcA.y > 0.0 && tcA.y < 1.0) {
      vec4 glyph = texture(uText, tcA);
      col += glyph.rgb * glyph.a * bright;
    }
    // La capa pequena lleva el 13 % del desplazamiento de la grande.
    vec2 tcB = vUv + (tcA - vUv) * 0.13;
    if (tcB.x > 0.0 && tcB.x < 1.0 && tcB.y > 0.0 && tcB.y < 1.0) {
      vec4 glyph = texture(uCopy, tcB);
      col += glyph.rgb * glyph.a * bright;
    }
  }

  // El mismo encuadre que la traza, para la bruma y la vineta.
  float zoom = clamp(1.85 / max(uAspect, 0.35), 1.0, 2.2);
  vec2 screen = (vUv - 0.5) * 2.0 * vec2(uAspect, 1.0) * zoom;
  vec2 shift = uPointer * vec2(0.46, 0.30) * (1.0 + uPower * 0.55) * smoothstep(0.55, 1.0, uFormation);
  vec2 center = uCenter * vec2(uAspect, 1.0) * zoom;
  float dd = length((screen * (1.0 - uBass * 0.021) - shift - center) * uScale);
  col += vec3(1.0, 0.29, 0.04) * exp(-max(dd - 0.17, 0.0) * 6.5) * 0.022 * (0.55 + uBass * 0.9)
       * smoothstep(0.08, 0.55, uFormation);

  const float WHITE = 1.85;
  float peak = max(col.r, max(col.g, col.b));
  float mapped = peak * (1.0 + peak / (WHITE * WHITE)) / (1.0 + peak);
  col = min(col * (mapped / max(peak, 1e-4)), vec3(1.0));
  col = pow(max(col, 0.0), vec3(0.92));
  col *= 1.0 - smoothstep(1.70, 3.30, dd) * 0.28;
  float light = max(col.r, max(col.g, col.b));
  float diskAlpha = mix(smoothstep(0.0, 0.12, light), 1.0, horizonte);
  float alpha = mix(1.0, diskAlpha, uIsolation);
  gl_FragColor = vec4(col / max(alpha, 0.0001), alpha);
}
#endif
`;

/**
 * MODO PARTIDO (telefono). El trazado de rayos es lo caro y va con el numero
 * de pixeles; el titular, que es lo unico que se pixela al bajar resolucion,
 * no necesita el trazado, solo DONDE leerlo. Asi que se parte en dos:
 *
 *   1. `fragmentTraza`: el shader de siempre a baja resolucion, a una
 *      textura doble (MRT, media precision): el color lineal del disco y
 *      el cielo, y las coordenadas del titular deformado con su brillo.
 *   2. `fragmentCompone`: a resolucion completa, reescala esas texturas, lee
 *      el titular NITIDO en las coordenadas interpoladas y hace el tono.
 *
 * Medido en un Redmi Note 13 (Adreno 610, 27-09-2026): el trazado entero
 * iba a 11 fps con la resolucion ya en 0,75.
 */
const fragmentTraza = `
#define PARTIDO
layout(location = 0) out highp vec4 gColor;
layout(location = 1) out highp vec4 gTexto;
layout(location = 2) out highp vec4 gCielo;
` + fragmentShader;

// Modo diferido (ver COMPONE en el shader): traza a 4 salidas y composicion
// que sombrea el disco a resolucion completa.
const fragmentTrazaDiferida = `
#define DIFERIDO
layout(location = 0) out highp vec4 gA;
layout(location = 1) out highp vec4 gB;
layout(location = 2) out highp vec4 gCielo;
layout(location = 3) out highp vec4 gTexto;
` + fragmentShader;
const fragmentSombreaDiferido = `
#define COMPONE
#define SOMBREA
layout(location = 0) out highp vec4 gDisco;
#define gl_FragColor gDisco
` + fragmentShader;
const fragmentComponeDiferido = `
#define COMPONE
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
` + fragmentShader;

const fragmentCompone = `
#define NITIDEZ ${(() => { const m = /[?&]nitidez=([0-9.]+)/.exec(typeof location === "undefined" ? "" : location.search); return m ? Number(m[1]).toFixed(2) : "0.40"; })()}
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor, tTexto, uText, uCopy;
// La traza ocupa solo una parte de su textura (ver pasadas en Scene):
// uEsc es esa fraccion y uTexel el tamano de un texel de la textura entera.
uniform vec2 uEsc, uTexel;
uniform float uAspect, uPower, uFormation, uScale, uBass, uIsolation, uTime;
uniform sampler2D tCielo;
uniform vec2 uPointer, uCenter;

// B-spline cubica en 4 lecturas bilineales. Con la traza a media resolucion
// el bilineal dejaba escalones en el filo de la sombra y en los aros.
vec4 pesos(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x, y = s.y - 4.0 * s.x, z = s.z - 4.0 * s.y + 6.0 * s.x;
  return vec4(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
}
vec4 cubica(sampler2D t, vec2 uv) {
  vec2 p = uv / uTexel - 0.5;
  vec2 f = fract(p); p -= f;
  vec4 wx = pesos(f.x), wy = pesos(f.y);
  vec4 c = p.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(wx.xz + wx.yw, wy.xz + wy.yw);
  vec4 o = (c + vec4(wx.yw, wy.yw) / s) * uTexel.xxyy;
  // Sin salirse de la parte pintada: lo de fuera es de otro tamano.
  vec2 lim = uEsc - 0.5 * uTexel;
  o = clamp(o, 0.5 * uTexel.xxyy, lim.xxyy);
  vec4 a = texture2D(t, o.xz), b = texture2D(t, o.yz), cc = texture2D(t, o.xw), d = texture2D(t, o.yw);
  float sx = s.x / (s.x + s.y), sy = s.z / (s.z + s.w);
  return mix(mix(d, cc, sx), mix(b, a, sx), sy);
}

${HASH31}
${ESTRELLAS}
// Catmull-Rom en 9 lecturas bilineales: igual de limpia en los filos que la
// B-spline y bastante mas nitida (la B-spline promedia y difumina los aros).
// Tiene lobulos negativos, asi que se recorta a cero donde hace falta.
vec4 catmull(sampler2D t, vec2 uv) {
  vec2 p = uv / uTexel;
  vec2 t1 = floor(p - 0.5) + 0.5;
  vec2 f = p - t1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 lo = 0.5 * uTexel, hi = uEsc - 0.5 * uTexel;
  vec2 c0 = clamp((t1 - 1.0) * uTexel, lo, hi);
  vec2 c12 = clamp((t1 + w2 / w12) * uTexel, lo, hi);
  vec2 c3 = clamp((t1 + 2.0) * uTexel, lo, hi);
  return texture2D(t, vec2(c0.x, c0.y)) * w0.x * w0.y
       + texture2D(t, vec2(c12.x, c0.y)) * w12.x * w0.y
       + texture2D(t, vec2(c3.x, c0.y)) * w3.x * w0.y
       + texture2D(t, vec2(c0.x, c12.y)) * w0.x * w12.y
       + texture2D(t, vec2(c12.x, c12.y)) * w12.x * w12.y
       + texture2D(t, vec2(c3.x, c12.y)) * w3.x * w12.y
       + texture2D(t, vec2(c0.x, c3.y)) * w0.x * w3.y
       + texture2D(t, vec2(c12.x, c3.y)) * w12.x * w3.y
       + texture2D(t, vec2(c3.x, c3.y)) * w3.x * w3.y;
}

void main() {
  vec2 uvT = min(vUv * uEsc, uEsc - 0.5 * uTexel);
  // Mezcla de las dos: la B-spline sola difumina los aros y la Catmull-Rom
  // sola vuelve a ensenar la rejilla de la traza. Medido en el telefono
  // (27-09-2026), el 40 % de la nitida es el punto en que ni una ni otra.
  vec4 g = mix(cubica(tColor, vUv * uEsc), catmull(tColor, vUv * uEsc), NITIDEZ);
  vec3 col = max(g.rgb, 0.0);
  vec4 cielo = texture2D(tCielo, uvT);
  if (cielo.w > 0.001) col += starField(normalize(cielo.xyz)) * cielo.w;
  float bright = max(g.a, 0.0);
  // Cuanto de este pixel es horizonte (el -1 de la traza, ya mezclado).
  float horizonte = clamp(-g.a, 0.0, 1.0);
  if (bright > 0.0) {
    vec4 tc = texture2D(tTexto, uvT);
    if (tc.x > 0.0 && tc.x < 1.0 && tc.y > 0.0 && tc.y < 1.0) {
      vec4 glyph = texture2D(uText, tc.xy);
      col += glyph.rgb * glyph.a * bright;
    }
    if (tc.z > 0.0 && tc.z < 1.0 && tc.w > 0.0 && tc.w < 1.0) {
      vec4 glyph = texture2D(uCopy, tc.zw);
      col += glyph.rgb * glyph.a * bright;
    }
  }
  // El mismo encuadre que el trazado, solo para la vineta.
  float zoom = clamp(1.85 / max(uAspect, 0.35), 1.0, 2.2);
  vec2 screen = (vUv - 0.5) * 2.0 * vec2(uAspect, 1.0) * zoom;
  vec2 shift = uPointer * vec2(0.46, 0.30) * (1.0 + uPower * 0.55) * smoothstep(0.55, 1.0, uFormation);
  vec2 center = uCenter * vec2(uAspect, 1.0) * zoom;
  float d = length((screen * (1.0 - uBass * 0.021) - shift - center) * uScale);

  const float WHITE = 1.85;
  float peak = max(col.r, max(col.g, col.b));
  float mapped = peak * (1.0 + peak / (WHITE * WHITE)) / (1.0 + peak);
  col = min(col * (mapped / max(peak, 1e-4)), vec3(1.0));
  col = pow(max(col, 0.0), vec3(0.92));
  col *= 1.0 - smoothstep(1.70, 3.30, d) * 0.28;
  float light = max(col.r, max(col.g, col.b));
  float diskAlpha = mix(smoothstep(0.0, 0.12, light), 1.0, horizonte);
  float alpha = mix(1.0, diskAlpha, uIsolation);
  gl_FragColor = vec4(col / max(alpha, 0.0001), alpha);
}
`;

// El titular se rasteriza tal y como el DOM ya lo colocó: mismas cajas, misma
// tipografía. Así el texto lenseado cae exactamente donde estaría el <h1>, y
// basta con volverlo transparente para que el relevo no se note.
// El canvas solo admite palabras clave en fontStretch; con un porcentaje lo
// descarta y rasteriza más estrecho que el DOM. Se traduce al escalón más
// cercano de la escala CSS.
function stretchKeyword(value) {
  const pct = parseFloat(value);
  if (!pct) return value || "normal";
  const steps = [[50,"ultra-condensed"],[62.5,"extra-condensed"],[75,"condensed"],
    [87.5,"semi-condensed"],[100,"normal"],[112.5,"semi-expanded"],
    [125,"expanded"],[150,"extra-expanded"],[200,"ultra-expanded"]];
  return steps.reduce((a, b) => Math.abs(b[0]-pct) < Math.abs(a[0]-pct) ? b : a)[1];
}

// Divide un elemento en sus LÍNEAS VISUALES. Un párrafo que envuelve son
// varias cajas, y rasterizarlo como una sola línea lo estiraría de lado a lado.
function visualLines(el) {
  const raw = el.textContent || "";
  const node = el.firstChild;
  if (!node || node.nodeType !== 3 || !raw.trim()) {
    return [{ text: raw, rect: el.getBoundingClientRect() }];
  }
  const range = document.createRange();
  const box = (a, b) => { range.setStart(node, a); range.setEnd(node, b); return range.getBoundingClientRect(); };
  const cuts = [];
  let start = 0, top = null;
  for (let i = 0; i < raw.length; i++) {
    const r = box(i, i + 1);
    if (!r.width && !r.height) continue;
    if (top === null) top = r.top;
    else if (Math.abs(r.top - top) > 1) { cuts.push([start, i]); start = i; top = r.top; }
  }
  cuts.push([start, raw.length]);
  return cuts.map(([a, b]) => {
    while (a < b && /\s/.test(raw[a])) a++;
    while (b > a && /\s/.test(raw[b - 1])) b--;
    return { text: raw.slice(a, b), rect: box(a, b) };
  }).filter((l) => l.text);
}

// El texto se rasteriza tal y como el DOM ya lo colocó: mismas cajas, misma
// tipografía. Así el texto lenseado cae exactamente donde estaría el original,
// y basta con volverlo transparente para que el relevo no se note.
function paintLensText(source, box, group) {
  if (box.width < 2 || box.height < 2) return null;
  // Un grupo puede quedarse vacío: devuelve un lienzo en blanco para que su
  // sampler siga siendo válido en vez de quedar sin textura asignada.
  const nodes = source.querySelectorAll(`[data-lens-line][data-lens-group="${group}"]`);
  // Hasta 3: la lente estira el titular, y en un telefono de 2,75 a densidad
  // 2 los bordes salian blandos (Jorge, 27-09-2026: "se ve muy pixelado").
  const dpr = Math.min(devicePixelRatio || 1, 3);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(box.width * dpr);
  canvas.height = Math.round(box.height * dpr);
  // En memoria y no en la GPU, a proposito. Un lienzo 2D acelerado se BORRA
  // cuando la GPU se reinicia (pantalla que se apaga, ahorro de energia, un
  // driver que se recupera), y eso pasa con la pagina quieta un rato. three
  // recupera su contexto y vuelve a subir las texturas desde estos lienzos,
  // asi que el agujero volvia entero pero el titular subia en blanco: con
  // `uReveal` a 1 y el <h1> transparente, el nombre desaparecia para siempre.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.scale(dpr, dpr);
  ctx.textBaseline = "alphabetic";
  const theme = getComputedStyle(document.documentElement);
  for (const node of nodes) {
    const style = getComputedStyle(node);
    const size = parseFloat(style.fontSize);
    const upper = style.textTransform === "uppercase";
    const centered = style.textAlign === "center";
    // El color va en el atributo y no en el estilo calculado: cuando el texto
    // ya está oculto para ceder el sitio al lenseado, ese estilo es transparente.
    const ink = node.dataset.lensFill || "#fdf7f2";
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
    // La fuente es variable: sin el eje de ancho el texto saldría más estrecho.
    if ("fontStretch" in ctx) ctx.fontStretch = stretchKeyword(style.fontStretch);
    if ("letterSpacing" in ctx) ctx.letterSpacing = style.letterSpacing;
    ctx.textAlign = centered ? "center" : "left";
    for (const line of visualLines(node)) {
      const text = upper ? line.text.toUpperCase() : line.text;
      const rect = line.rect;
      const metrics = ctx.measureText(text);
      // Misma media interlínea que aplica CSS, para que la base caiga igual.
      const ascent = metrics.fontBoundingBoxAscent || size * 0.78;
      const descent = metrics.fontBoundingBoxDescent || size * 0.22;
      const y = rect.top - box.top + (rect.height - ascent - descent) / 2 + ascent;
      const x = rect.left - box.left + (centered ? rect.width / 2 : 0);
      if (ink === "accent") {
        // Texto con degradado recortado: se reconstruye con los acentos del tema.
        const g = ctx.createLinearGradient(rect.left - box.left, 0, rect.right - box.left, 0);
        g.addColorStop(0, theme.getPropertyValue("--accent-a").trim() || "#ff9a3c");
        g.addColorStop(1, theme.getPropertyValue("--accent-c").trim() || "#db3208");
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = ink;
      }
      ctx.fillText(text, x, y);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  return texture;
}

// Si el shader no compila o la escena revienta, no basta con pintar el
// respaldo aqui dentro: el titular tiene que volver al DOM y el resto de la
// pagina tiene que saber que la GPU no responde (ver `romper`).
class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) {
    console.error("[singularity] el agujero negro fallo", error);
    this.props.onFallo?.();
  }
  render() { return this.state.failed ? <div className="blackhole__fallback" /> : this.props.children; }
}

// Periodo común exacto de las tres frecuencias que usan uTime (6.0, 0.17 y
// 0.13 rad/s): 0.17·200π = 34π, 0.13·200π = 26π y 6·200π = 1200π son todos
// múltiplos de 2π, así que envolver el reloj aquí no se nota en absoluto.
const TIME_WRAP = 200 * Math.PI;
// Techo del enrollado diferencial, en radianes. Mide cuánto se adelanta el
// borde interno al externo, y es lo que decide si la espiral se lee o no: con
// ~22 el disco queda enrollado unas 3 vueltas, que es donde los brazos siguen
// siendo brazos. Muy por encima la espiral se cierra tanto que su gradiente
// radial pasa de Nyquist, el disco degenera en moteado y, al ser ya casi
// concéntrico, girarlo deja de notarse. Se alcanza en unos diez segundos y a
// partir de ahí la figura gira rígida, conservando su forma.
const WIND_MAX = 22;

/**
 * ¿La GPU esta pintando el lienzo de blanco?
 *
 * Paso en un Android (25-09-2026, video de Jorge): el agujero salia blanco
 * —el hero lavado y sin nombre, las marcas sobre blanco, una elipse blanca
 * pegada al astronauta— y en el computador, con el mismo tamano de pantalla,
 * se veia bien. No se puede probar en cada telefono, asi que el lienzo se
 * comprueba a si mismo: justo despues de pintar (el buffer sigue intacto en
 * esa misma tarea) lee una fila y una columna por el centro y cuenta los
 * pixeles casi blancos y opacos.
 *
 * Medido en el video: en los fotogramas rotos son del 24 al 100 % de la cruz;
 * un lienzo sano no pasa del 5 %, porque el disco es ambar (azul bajo), el
 * cielo oscuro, y el blanco del titular o del aro del halo son trazos finos.
 * Esquinas no sirve: en los lienzos aislados el fondo es transparente, y la
 * elipse blanca de Sobre mi las dejaba negras.
 */
const LIMITE_BLANCO = 0.18;
let fila = new Uint8Array(0), columna = new Uint8Array(0);
function pintaBlanco(ctx) {
  const w = ctx.drawingBufferWidth, h = ctx.drawingBufferHeight;
  if (w < 8 || h < 8) return 0;
  if (fila.length < w * 4) fila = new Uint8Array(w * 4);
  if (columna.length < h * 4) columna = new Uint8Array(h * 4);
  ctx.readPixels(0, h >> 1, w, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, fila);
  ctx.readPixels(w >> 1, 0, 1, h, ctx.RGBA, ctx.UNSIGNED_BYTE, columna);
  const blancos = (px, n) => {
    let c = 0;
    for (let i = 0; i < n * 4; i += 4) if (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235 && px[i + 3] > 235) c++;
    return c;
  };
  return (blancos(fila, w) + blancos(columna, h)) / (w + h);
}

const ahoraMs = () => performance.now();

/**
 * r3f COPIA los uniforms al crear su material: los de `uniforms` se quedaban
 * en sus valores iniciales (la traza pintaba el ∞ de la intro para siempre).
 * Los materiales del modo partido se enlazan una vez a los que r3f actualiza
 * de verdad, antes de compilarlos o pintarlos.
 */
function enlazar(pasadas, propio) {
  if (pasadas.enlazado || !propio?.uniforms) return;
  pasadas.enlazado = true;
  pasadas.traza.uniforms = propio.uniforms;
  pasadas.trazaD.uniforms = propio.uniforms;
  for (const k of Object.keys(propio.uniforms)) {
    pasadas.compone.uniforms[k] = propio.uniforms[k];
    pasadas.sombreaD.uniforms[k] = propio.uniforms[k];
    pasadas.componeD.uniforms[k] = propio.uniforms[k];
  }
}

function Scene({ interaction, reduced, formation, sample, visual, lens, journey, espejo, espejoModo, hue = 0, disk = 1, white = 0, onRoto, onPintado, onPreparado, ajusta = false }) {
  const elapsed = useRef(0);
  const rigid = useRef(0);
  const wound = useRef(0);
  const lastFormation = useRef(1);
  const revelado = useRef({ v: 0 });
  const material = useRef(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uRigid: { value: 0 }, uWind: { value: 0 },
    uFormation: { value: 0 },
    uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 },
    uPower: { value: 0 }, uAspect: { value: 1 }, uPointer: { value: new Vector2() },
    uText: { value: null }, uCopy: { value: null }, uReveal: { value: 0 },
    // Viaje por la pagina: donde esta el agujero, cuanto se aleja y desde
    // que altura se mira. Lo escribe el scroll (ver Stage.jsx).
    uCenter: { value: new Vector2() }, uArco: { value: 1 }, uScale: { value: 1 }, uTopDown: { value: 0 }, uIsolation: { value: 0 }, uFaceOn: { value: 0 },
    uHue: { value: hue }, uDisk: { value: disk }, uWhite: { value: white },
    uCurva: { value: CURVA }, uGrupos: { value: GRUPOS },
  }), []);
  // Pueden cambiar sin volver a montar el lienzo (el idioma, por ejemplo,
  // re-renderiza el arbol entero).
  useEffect(() => {
    uniforms.uHue.value = hue;
    uniforms.uDisk.value = disk;
    uniforms.uWhite.value = white;
  }, [hue, disk, white, uniforms]);
  // El que publica borra el espejo al irse. A partir de ahi el lienzo que
  // seguia continua con su propio reloj, ya sembrado con los ultimos valores
  // copiados, asi que no da ningun salto.
  useEffect(() => {
    if (espejoModo !== "publica" || !espejo) return undefined;
    return () => { espejo.current = null; };
  }, [espejo, espejoModo]);

  useFrame((state, delta) => {
    if (!material.current) return;
    const live = material.current.uniforms;

    /**
     * Relevo del cargador al hero.
     *
     * Durante la intro hay DOS lienzos pintando el mismo agujero: el del
     * cargador y el del hero, que ya esta montado detras. Cada uno llevaba su
     * propio reloj desde que monto, asi que el disco de uno iba girado
     * respecto al del otro; y el del cargador iba ademas por detras en el
     * morph. Medido con los dos en formation = 1: diferian en el 14,7 % de los
     * pixeles, con la sombra un 10 % mas pequena en el del cargador. El
     * fundido entre los dos era una doble exposicion, y eso es lo que se veia
     * como tiron o como cambio de tamano.
     *
     * Aqui el del hero deja de pensar por su cuenta y COPIA lo que publica el
     * del cargador. Las dos imagenes pasan a ser la misma, asi que el fundido
     * ya no cruza nada: lo unico que cambia durante el relevo es el titular,
     * que solo dibuja el del hero.
     */
    // Sin lienzo en el cargador (telefono, ver Loader.jsx) el espejo solo
    // lleva `cubre`: no hay reloj que copiar.
    const copia = espejoModo === "sigue" && espejo?.current?.time !== undefined ? espejo.current : null;
    if (copia) {
      elapsed.current = copia.time;
      rigid.current = copia.rigid;
      wound.current = copia.wound;
      lastFormation.current = copia.formation;
      visual.current.bass = copia.bass;
      visual.current.mid = copia.mid;
      visual.current.treble = copia.treble;
      live.uTime.value = copia.time;
      live.uRigid.value = copia.rigid;
      live.uWind.value = copia.wind;
      live.uFormation.value = copia.formation;
      live.uBass.value = copia.bass;
      live.uMid.value = copia.mid;
      live.uTreble.value = copia.treble;
      live.uPower.value = copia.power;
      live.uPointer.value.set(copia.px, copia.py);
      live.uCenter.value.set(copia.cx, copia.cy);
      live.uScale.value = copia.scale;
      live.uTopDown.value = copia.topDown;
      live.uFaceOn.value = copia.faceOn;
      live.uIsolation.value = copia.isolation;
      live.uAspect.value = state.size.width / Math.max(state.size.height, 1);
      // El titular no se copia: durante la intro no lo dibuja nadie, y entra
      // solo cuando este lienzo toma el mando.
      live.uText.value = lens.current.title;
      live.uCopy.value = lens.current.copy;
      live.uReveal.value = 0;
      visual.current.time = copia.time;
      return;
    }
    const dt = Math.min(delta, 0.05);
    const smooth = 1-Math.exp(-dt*7);
    const audio = sample();
    // Ataque rápido para los golpes y caída suave entre notas. La curva
    // amplifica también pistas suaves sin generar movimiento en silencio: sin
    // música el agujero no late, solo gira, que es su movimiento de base.
    // Reacciona a los GOLPES, no al volumen: cada banda contra su media de
    // ~1,2 s. Con el nivel a secas una pista siempre fuerte dejaba el disco
    // "subido" y quieto, y no se leia como musica (Jorge, 27-09-2026: "no veo
    // notoria la reaccion a la musica"). El nivel queda de fondo, suave.
    const lento = (visual.current.lento ??= { bass: 0, mid: 0, treble: 0 });
    const kLento = 1 - Math.exp(-dt / 1.2);
    for (const band of ['bass','mid','treble']) {
      // Los graves del agujero siguen al BOMBO (40-110 Hz), no a todo el
      // bajo: el bajo sostenido lo dejaba latiendo a destiempo (Jorge,
      // 27-09-2026: "que se active con el kick, no tanto con el bajo").
      const fuente = band === 'bass' ? (audio.kick ?? audio.bass) : audio[band];
      const a = Math.max(0, fuente - 0.010);
      lento[band] += (a - lento[band]) * kLento;
      const golpe = Math.max(0, a - lento[band]);
      const target = reduced ? 0 : band === 'bass' ? Math.min(1, a * 0.12 + golpe * 7.5) : Math.min(1, a * 0.25 + golpe * 6.0);
      const response = 1-Math.exp(-dt*(target>visual.current[band] ? 32 : 10));
      visual.current[band] += (target-visual.current[band])*response;
    }
    live.uFormation.value = formation?.current ?? 1;
    if(live.uFormation.value < lastFormation.current-0.1) {
      elapsed.current=0;
      rigid.current=0;
      wound.current=0;
    }
    lastFormation.current=live.uFormation.value;
    live.uPower.value += ((interaction.current.down ? 1 : 0)-live.uPower.value)*smooth;
    // Libre mientras el hero esta en pantalla. Con el progreso de la orbita
    // (p < 0.01) no valia en el telefono: ScrollTrigger mide con la ventana
    // sin la barra del navegador (791 en vez de 734 px) y arriba del todo ya
    // daba 0.035, asi que el agujero no seguia al dedo.
    const libre = !journey?.current || ((journey.current.heroOut ?? 0) < 0.08 && journey.current.p < 0.12);
    live.uPointer.value.lerp(libre ? interaction.current.point : QUIETO, smooth);
    if (!reduced) {
      const step = dt*(1+live.uPower.value*3);
      // El reloj se envuelve en su periodo exacto y el giro se acumula en doble
      // (los números de JS lo son), que aguanta días sin degradarse.
      elapsed.current = (elapsed.current+step) % TIME_WRAP;
      // Acumular el giro mantiene la velocidad base al pausar la música,
      // sin recalcular la posición pasada cuando decaen las bandas de audio.
      const rate = step*(2.1+visual.current.bass*4.6+visual.current.mid*3.2+live.uPower.value*1.5);
      rigid.current = (rigid.current+rate) % (2*Math.PI);
      wound.current += rate;
    }
    live.uTime.value = elapsed.current;
    live.uRigid.value = rigid.current;
    // La tangente hiperbólica hace que el enrollado se acerque al techo sin
    // llegar a tocarlo, en vez de cortarse de golpe.
    live.uWind.value = WIND_MAX*Math.tanh(wound.current/WIND_MAX);
    live.uBass.value = visual.current.bass;
    live.uMid.value = visual.current.mid;
    live.uTreble.value = visual.current.treble;
    live.uAspect.value = state.size.width/Math.max(state.size.height,1);
    const trip = journey?.current;
    live.uCenter.value.set(trip?.cx ?? 0, trip?.cy ?? 0);
    // Telefono en horizontal: sin el arco de escritorio (ver `pull`).
    live.uArco.value = state.size.height < 500 && state.size.width >= state.size.height * 0.85 ? 0 : 1;
    live.uScale.value = trip?.scale ?? 1;
    live.uTopDown.value = trip?.topDown ?? 0;
    live.uFaceOn.value = trip?.faceOn ? 1 : 0;
    live.uIsolation.value = trip?.isolation ?? 0;
    // Relevo directo del texto DOM a sus texturas, sin un intervalo oscuro.
    live.uText.value = lens.current.title;
    live.uCopy.value = lens.current.copy;
    // El titular lenseado vive pegado al agujero. En cuanto este se despega
    // para irse abajo, el relevo vuelve al DOM (ver `--lens-fade`).
    // El nombre entra fundiendose (~1,2 s, curva suave), no de golpe (Jorge,
    // 27-09-2026). El relevo con el scroll (`trip.lens`) sigue siendo directo.
    const aparece = revelado.current;
    aparece.v = lens.current.title ? Math.min(1, aparece.v + dt / 1.2) : 0;
    const suave = aparece.v * aparece.v * (3 - 2 * aparece.v);
    live.uReveal.value = suave * (trip?.lens ?? 1);
    visual.current.time=elapsed.current;
    if (import.meta.env.DEV && ajusta) window.__visual = visual.current;
    visual.current.x=live.uPointer.value.x;
    visual.current.y=live.uPointer.value.y;

    if (espejoModo === "publica" && espejo) {
      espejo.current = {
        cubre: !!trip?.cubre,
        time: elapsed.current, rigid: rigid.current, wound: wound.current,
        wind: live.uWind.value, formation: live.uFormation.value,
        bass: live.uBass.value, mid: live.uMid.value, treble: live.uTreble.value,
        power: live.uPower.value,
        px: live.uPointer.value.x, py: live.uPointer.value.y,
        cx: live.uCenter.value.x, cy: live.uCenter.value.y,
        scale: live.uScale.value, topDown: live.uTopDown.value,
        faceOn: live.uFaceOn.value, isolation: live.uIsolation.value,
      };
    }
  });
  /**
   * No pintar lo que nadie ve. Mientras el cargador es opaco (hasta que empieza
   * a fundirse, `cubre` en el espejo), el lienzo del hero queda debajo y
   * pintarlo era trabajo tirado: los dos lienzos a pantalla completa, con 180
   * pasos por pixel, justo en el colapso del ∞, que es cuando el shader se
   * vuelve caro. Ahi caian tareas de 64-122 ms (ver intro-y-titular).
   *
   * Sigue COPIANDO el espejo cada fotograma (el useFrame de arriba); solo se
   * salta el `render`. Antes pinta un par de fotogramas para tener el shader
   * compilado: compilarlo al reanudar seria meter el tiron en el fundido. Y el
   * cargador levanta `cubre` unos fotogramas antes de empezar a irse, asi que
   * cuando este lienzo asoma ya lleva la imagen al dia.
   */
  const pintados = useRef(0);
  const revision = useRef({ tramo: null, t: 0 });

  /**
   * Resolucion que se adapta en el telefono. Cada pixel lanza un rayo de
   * cientos de pasos, asi que el coste va con el area del lienzo.
   *
   * Es una escalera (`NIVELES`, solo dpr) y se arranca en 1: por debajo el
   * titular, que lo pinta este shader, se pixela, asi que se baja de 1 solo
   * si el telefono no llega. Los pasos no se tocan (ver `NIVELES`).
   *
   * Cada 20 fotogramas se mira la media del intervalo entre fotogramas:
   *   - por encima de 1/40 s: baja un escalon, y ya no vuelve a subir (subir
   *     y bajar se veria como un parpadeo de nitidez). Con el tope de 30 fps
   *     de abajo, un telefono que pinta a tiempo sigue dando ~16 ms de
   *     media: los pintados que no llegan son los que la suben;
   *   - por debajo de 1/55 s y sin haber bajado nunca: sube, para que el
   *     titular gane nitidez donde el telefono puede.
   * Se mide desde el fotograma 10 para no contar la compilacion, y no se mide
   * lo que no se pinta (`tapado`).
   */
  const { setDpr, gl: rendererPartido } = useThree();
  /**
   * Modo partido (ver `fragmentTraza`): solo en el telefono y si la GPU sabe
   * pintar en texturas de media precision. Ahi la escalera ya no mueve el dpr
   * del lienzo (el titular se queda nitido) sino la resolucion de la traza.
   * `?entero` lo apaga, para comparar.
   */
  const partido = useMemo(() => ajusta && !SIN_PARTIR && rendererPartido.capabilities.isWebGL2
    && (rendererPartido.extensions.has("EXT_color_buffer_float") || rendererPartido.extensions.has("EXT_color_buffer_half_float")), [ajusta, rendererPartido]);
  const escalera = partido ? TRAZAS : NIVELES;
  /**
   * En modo partido el lienzo sube de densidad: la traza ya no va atada a
   * ella (se mide en pixeles CSS, ver `pasadas`), y a densidad 1 el titular
   * salia pixelado en una pantalla de 2,75 (Jorge, 27-09-2026: "se ve muy
   * pixelado"). Lo que cuesta la subida es solo la composicion.
   */
  // La densidad alta la pone el <Canvas> (ver `dprLienzo`); sin modo partido
  // (una GPU sin texturas de media precision) el trazado entero a esa
  // densidad seria inviable, y se vuelve a la de siempre.
  useEffect(() => {
    if (ajusta && !partido && DPR_PARTIDO !== DPR_MOVIL) setDpr(DPR_MOVIL);
  }, [ajusta, partido, setDpr]);
  const medida = useRef({ n: 0, t: 0, bajo: false });
  const nivel = useRef(partido ? TRAZA_INICIAL : NIVEL_INICIAL);
  const aplicaNivel = useCallback((i) => {
    nivel.current = i;
    if (partido) {
      if (HUD) HUD.dpr = `1 · traza ${TRAZAS[i]}`;
      return;
    }
    setDpr(NIVELES[i]);
    if (HUD) HUD.dpr = NIVELES[i];
  }, [setDpr, partido]);
  const pasadas = useMemo(() => {
    if (!partido) return null;
    const rt = new WebGLRenderTarget(1, 1, { count: 3, type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
    // Sin mezcla: la traza escribe datos (un alfa de -1 incluido), no color.
    const traza = new ShaderMaterial({ glslVersion: GLSL3, uniforms, vertexShader, fragmentShader: fragmentTraza, blending: NoBlending, depthTest: false, depthWrite: false, toneMapped: false });
    const compone = new ShaderMaterial({
      uniforms: { ...uniforms, tColor: { value: rt.textures[0] }, tTexto: { value: rt.textures[1] }, tCielo: { value: rt.textures[2] }, uEsc: { value: new Vector2(1, 1) }, uTexel: { value: new Vector2(1, 1) } },
      vertexShader, fragmentShader: fragmentCompone, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    // Diferido (ver COMPONE): con el agujero ya formado. La intro sigue con
    // el color trazado, que lleva el acabado del SVG del cargador.
    const rtD = new WebGLRenderTarget(1, 1, { count: 4, type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
    const trazaD = new ShaderMaterial({ glslVersion: GLSL3, uniforms, vertexShader, fragmentShader: fragmentTrazaDiferida, blending: NoBlending, depthTest: false, depthWrite: false, toneMapped: false });
    // El plasma, a densidad 1 (ver SOMBREA), en su propia textura.
    const rtS = new WebGLRenderTarget(1, 1, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
    const deTraza = () => ({ tA: { value: rtD.textures[0] }, tB: { value: rtD.textures[1] }, tCielo: { value: rtD.textures[2] }, tTexto: { value: rtD.textures[3] }, uEsc: { value: new Vector2(1, 1) }, uTexel: { value: new Vector2(1, 1) } });
    const sombreaD = new ShaderMaterial({
      glslVersion: GLSL3, uniforms: { ...uniforms, ...deTraza() },
      vertexShader, fragmentShader: fragmentSombreaDiferido, blending: NoBlending, depthTest: false, depthWrite: false, toneMapped: false,
    });
    const componeD = new ShaderMaterial({
      glslVersion: GLSL3,
      uniforms: { ...uniforms, ...deTraza(), tDisco: { value: rtS.texture } },
      vertexShader, fragmentShader: fragmentComponeDiferido, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    if (HUD) HUD.dpr = `1 · traza ${TRAZAS[TRAZA_INICIAL]}`;
    return { rt, traza, compone, rtD, trazaD, rtS, sombreaD, componeD, tam: new Vector2() };
  }, [partido, uniforms]);
  useEffect(() => () => {
    if (!pasadas) return;
    for (const k of ["rt", "traza", "compone", "rtD", "trazaD", "rtS", "sombreaD", "componeD"]) pasadas[k].dispose();
  }, [pasadas]);
  const malla = useRef(null);
  useFrame((_, delta) => {
    if (!ajusta || CALIDAD_FIJA !== null || !listo.current || pintados.current < 10 || tapadoAhora.current) return;
    // Con el modo diferido la traza fija va sobrada (el plasma se sombrea
    // aparte) y bajarla se notaba: un scroll brusco daba unos fotogramas
    // pesados, la escalera bajaba y no volvia a subir (Jorge, 27-09-2026:
    // "cuando se sube de golpe el agujero negro pierde calidad").
    if (partido && !SIN_DIFERIR) return;
    const m = medida.current;
    m.n++; m.t += Math.min(delta, 0.25);
    if (m.n < 20) return;
    const media = m.t / m.n;
    // Con fotogramas saltados por el tope de 30 fps, una media baja no
    // demuestra que sobre GPU: solo se sube con la ventana pintada entera.
    const entera = !m.salto;
    m.n = 0; m.t = 0; m.salto = false;
    // Partido: se mide con el agujero quieto (el escalon que se ajusta es el
    // de reposo) y basta con ~20 fps, que para un disco que gira despacio es
    // fluido; moviendose ya va dos escalones mas abajo.
    const lento = partido ? 1 / 20 : 1 / 40;
    if (partido && ahoraMs() - (ultimo.current.mov ?? 0) < 1000) return;
    if (media > lento && nivel.current < escalera.length - 1) {
      m.bajo = true;
      aplicaNivel(nivel.current + 1);
    } else if (!m.bajo && entera && media < 1 / 55 && nivel.current > 0) {
      aplicaNivel(nivel.current - 1);
    }
  });
  useEffect(() => {
    if (ajusta && CALIDAD_FIJA !== null) aplicaNivel(Math.min(CALIDAD_FIJA, escalera.length - 1));
  }, [ajusta, aplicaNivel, escalera]);
  const tapadoAhora = useRef(false);
  // Para el tope de 30 fps: lo ultimo que se pinto y cuando.
  const ultimo = useRef({ t: 0, firma: "" });

  /**
   * Compilar sin congelar la pagina. Este shader tarda 0,5-3 s en compilar en
   * una grafica integrada, y el primer `render` lo hace de forma SINCRONA: el
   * hilo principal se quedaba parado todo ese rato, justo cuando entraban las
   * etiquetas del selector (medido en la Intel UHD, 25-09-2026). `compileAsync`
   * lo manda compilar en paralelo (KHR_parallel_shader_compile) y avisa al
   * terminar; hasta entonces el lienzo no pinta. Sin la extension resuelve en
   * el acto y todo queda como antes.
   */
  const { gl: renderer, scene: escena, camera: camara } = useThree();
  const listo = useRef(false);
  useEffect(() => {
    let vivo = true;
    const hecho = () => { if (vivo) listo.current = true; };
    if (!renderer.compileAsync) { hecho(); return () => { vivo = false; }; }
    const tareas = [renderer.compileAsync(escena, camara)];
    /**
     * Y los materiales del modo partido, todos, ya. Se compilaban la primera
     * vez que se usaban, y el diferido se estrena justo al terminar de
     * formarse el agujero: un fotograma de 1,7 s congelado entre la cinta y
     * el titular (Redmi, 27-09-2026). Cada traza se compila contra SU
     * objetivo (three guarda el programa segun donde se pinta) y con los
     * uniforms ya enlazados (ver `enlazar`): cambiarlos despues de compilar
     * los dejaria sin efecto.
     */
    const m = malla.current;
    if (pasadas && m) {
      enlazar(pasadas, m.material);
      const sola = (mat) => { const sc = new Escena3D(); const o = new Mesh(m.geometry, mat); o.frustumCulled = false; sc.add(o); return sc; };
      const antes = renderer.getRenderTarget();
      for (const [mat, rt] of [[pasadas.traza, pasadas.rt], [pasadas.trazaD, pasadas.rtD], [pasadas.sombreaD, pasadas.rtS], [pasadas.compone, null], [pasadas.componeD, null]]) {
        renderer.setRenderTarget(rt);
        tareas.push(renderer.compileAsync(sola(mat), camara));
      }
      renderer.setRenderTarget(antes);
    }
    Promise.all(tareas).then(hecho, hecho);
    return () => { vivo = false; };
  }, [renderer, escena, camara, pasadas]);

  // Con prioridad 1 r3f deja de pintar solo: pinta este callback, en todos
  // los lienzos del agujero. Ademas de esperar al shader, se salta el render
  // de lo que nadie ve, tras dos fotogramas para dejarlo caliente:
  //   - el del hero mientras el cargador lo tapa (`cubre`);
  //   - el del cargador en el selector (`oculto`), donde es invisible.
  // Los dos pintaban a pantalla completa cada fotograma del selector: en una
  // grafica integrada lo dejaban en ~10 fps.
  useFrame(({ gl, scene, camera }) => {
    if (!listo.current) return;
    // `oculto` tambien vale para el del hero: Stage lo levanta cuando el
    // lienzo, ya estampado en la portada del Stack, queda con opacidad 0.
    // Pintar a pantalla completa lo que nadie ve era el mayor gasto de GPU
    // de todo el recorrido de abajo.
    const tapado = (espejoModo === "sigue" && espejo?.current?.cubre) || journey?.current?.oculto;
    tapadoAhora.current = Boolean(tapado);
    // Tapado pinta SEIS fotogramas, no dos: la comprobacion de mas abajo
    // (`readPixels`, fotogramas 3 a 6) para la GPU, y con dos se hacia al
    // destaparse, o sea dentro de la transformacion de la intro. En un
    // telefono eso eran ~230 ms de la transicion (perfilado, CPU a 4x).
    // Asi se hace con el cargador delante y cuenta en su porcentaje.
    if (tapado && pintados.current > 5) return;
    /**
     * Tope de 30 fps en el telefono, pero solo con el agujero QUIETO en la
     * pagina (girando sin mas). El disco gira despacio y a 30 fps se ve igual
     * de suave; es la mitad de rayos por segundo, y menos calor, que es lo que
     * acaba bajando el reloj de la GPU a los pocos minutos. Mientras el scroll
     * lo mueve (centro, escala, inclinacion) o se toca, pinta a tope: ahi es
     * donde 30 fps se notarian como tirones contra la pagina.
     */
    const u = ultimo.current;
    if (ajusta && pintados.current > 6) {
      const v = material.current?.uniforms;
      const firma = v ? `${v.uCenter.value.x.toFixed(3)}|${v.uCenter.value.y.toFixed(3)}|${v.uScale.value.toFixed(3)}|${v.uTopDown.value.toFixed(3)}|${v.uPower.value > 0.01}` : "";
      const ahora = ahoraMs();
      // El scroll de la pagina tambien es movimiento para la resolucion de
      // la traza, aunque el agujero no cambie (el hero, fijo, mientras sube
      // el texto): con la traza alta ahi, el scroll iba a ~21 fps.
      const pagina = Math.round(window.scrollY);
      if (pagina !== u.pagina) { u.pagina = pagina; u.mov = ahora; }
      if (firma === u.firma && ahora - u.t < 30) { medida.current.salto = true; return; }
      if (firma !== u.firma) u.mov = ahora;
      u.firma = firma;
      u.t = ahora;
    }
    pintados.current++;
    const m = malla.current;
    if (pasadas && m) {
      const { tam } = pasadas;
      gl.getDrawingBufferSize(tam);
      // La textura mide lo del escalon mas alto y se pinta solo una parte
      // (su `viewport`): cambiar de escalon no reserva memoria.
      // En la intro, el escalon mas alto: el ∞ del shader releva al del SVG
      // del cargador y no puede verse mas blando que el (Jorge: "no debe
      // notarse el cambio"). Dura un par de segundos.
      const intro = (m.material.uniforms.uFormation?.value ?? 1) < 0.999;
      // Sin bajar al moverse: el salto de resolucion al empezar y al acabar
      // el scroll se veia como un desenfoque y un reenfoque (Jorge,
      // 27-09-2026: "se ve como si se desenfocara").
      const real = !intro && !SIN_DIFERIR;
      // Calentamiento: el primer fotograma (con el cargador delante) pinta
      // tambien el diferido entero, para que sus texturas y framebuffers de
      // varias salidas existan ya. Si no, se creaban al terminar de formarse
      // el agujero: un tiron de ~0,5 s aun con los shaders compilados.
      const modos = !pasadas.calentado && !real && !SIN_DIFERIR ? [true, false] : [real];
      pasadas.calentado = true;
      for (const diferido of modos) {
      const i = diferido ? nivel.current : intro ? TRAZAS.indexOf(0.75) : nivel.current;
      const rt = diferido ? pasadas.rtD : pasadas.rt;
      const traza = diferido ? pasadas.trazaD : pasadas.traza;
      const compone = diferido ? pasadas.componeD : pasadas.compone;
      const f = TRAZAS[i] ?? TRAZAS[TRAZA_INICIAL];
      // Las fracciones de TRAZAS son de pixeles CSS, no del lienzo, que va a
      // DPR_PARTIDO: la traza cuesta lo mismo suba o no la densidad.
      const css = 1 / Math.max(1, gl.getPixelRatio());
      const W = Math.max(1, Math.round(tam.x * TRAZAS[0] * css)), H = Math.max(1, Math.round(tam.y * TRAZAS[0] * css));
      if (rt.width !== W || rt.height !== H) rt.setSize(W, H);
      const w = Math.min(W, Math.max(1, Math.round(tam.x * f * css))), h = Math.min(H, Math.max(1, Math.round(tam.y * f * css)));
      rt.viewport.set(0, 0, w, h);
      compone.uniforms.uEsc.value.set(w / W, h / H);
      compone.uniforms.uTexel.value.set(1 / W, 1 / H);
      const propio = m.material;
      // r3f COPIA los uniforms al crear su material: los de `uniforms` se
      // quedaban en sus valores iniciales (la traza pintaba el ∞ de la intro
      // para siempre). Se enlazan una vez a los que r3f actualiza de verdad,
      // antes del primer pintado, que es cuando three los fija al programa.
      enlazar(pasadas, propio);
      m.material = traza;
      gl.setRenderTarget(rt);
      gl.render(scene, camera);
      if (diferido) {
        const { rtS, sombreaD } = pasadas;
        const sw = Math.max(1, Math.round(tam.x * css)), sh = Math.max(1, Math.round(tam.y * css));
        if (rtS.width !== sw || rtS.height !== sh) rtS.setSize(sw, sh);
        sombreaD.uniforms.uEsc.value.copy(compone.uniforms.uEsc.value);
        sombreaD.uniforms.uTexel.value.copy(compone.uniforms.uTexel.value);
        m.material = sombreaD;
        gl.setRenderTarget(rtS);
        gl.render(scene, camera);
      }
      m.material = compone;
      gl.setRenderTarget(null);
      gl.render(scene, camera);
      m.material = propio;
      }
    } else {
      gl.render(scene, camera);
    }
    if (HUD && ajusta) HUD.pintados++;
    // Compilado y con dos fotogramas hechos: ya se puede ENSENAR. Lo espera
    // el cargador antes de arrancar la transformacion (`onPintado` no vale
    // para eso: con el lienzo oculto no se pasa de dos fotogramas).
    if (pintados.current === 2) onPreparado?.();
    // `readPixels` detiene la tuberia de la GPU hasta que termina el
    // fotograma, asi que NO va en cada fotograma ni cada segundo. Se mira al
    // arrancar (fotogramas 3 a 6) y despues solo cuando el viaje cambia de
    // tramo —el blanco salio en un tramo concreto, al llegar a Sobre mi—, y
    // como mucho una vez cada dos segundos.
    const n = pintados.current;
    const trip = journey?.current;
    const tramo = trip ? Math.round((trip.isolation ?? 0) * 2) * 10 + Math.round((trip.topDown ?? 0) * 2) : 0;
    const revisa = revision.current;
    const cambiaTramo = n > 6 && tramo !== revisa.tramo && ahoraMs() - revisa.t > 2000;
    if ((n >= 3 && n <= 6) || cambiaTramo) {
      revisa.tramo = tramo;
      revisa.t = ahoraMs();
      const blanco = pintaBlanco(gl.getContext());
      if (import.meta.env.DEV) (window.__blanco ??= []).push(+blanco.toFixed(3));
      if (blanco > LIMITE_BLANCO) { onRoto?.("pinta blanco"); return; }
      // El agujero ya esta compilado y pintando bien: ahora si esta listo.
      if (n === 6) onPintado?.();
    }
  }, 1);

  return <mesh ref={malla} frustumCulled={false}><planeGeometry args={[2,2]} /><shaderMaterial
    ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
    transparent depthTest={false} depthWrite={false} toneMapped={false}
  /></mesh>;
}

/**
 * Cuanto hay que girar el tono para que el ambar del disco se vuelva el color
 * que se pide. El ambar de `ember()` esta en unos 25 grados, asi que la
 * rotacion es la diferencia; en radianes, que es lo que toma la formula.
 */
const AMBAR = 25;

// Densidad inicial en el telefono. A 0,75 el titular (que lo pinta este
// shader) salia pixelado; 1 es el suelo. Sube sola si sobra (ver `ajusta`).
const DPR_MOVIL = PRESUPUESTO.dprMovil;
// Densidad del lienzo en modo partido (ver Scene). `?dprp=N` para medir.
const DPR_PARTIDO = (() => {
  const m = typeof location === "undefined" ? null : /[?&]dprp=([0-9.]+)/.exec(location.search);
  const base = m ? Number(m[1]) : 2;
  return Math.min(base, typeof devicePixelRatio === "number" ? Math.max(1, devicePixelRatio) : 1);
})();

/**
 * Escalera de resolucion del telefono (dpr). Se arranca en `NIVEL_INICIAL`
 * (1) y `ajusta` sube o baja de uno en uno.
 *
 * Los pasos por rayo NO se tocan. Se probo a bajarlos (100, 84) antes que la
 * resolucion y la imagen del disco que se ve por DEBAJO de la sombra salia
 * cortada a franjas (Jorge, 27-09-2026): esos rayos pasan por debajo del
 * agujero y vuelven, son los mas largos de todos, y se quedaban sin pasos
 * antes de volver a cruzar el disco.
 */
const NIVELES = [PRESUPUESTO.dprMovilMax, 1.25, DPR_MOVIL, 0.9, 0.8, 0.75];
const NIVEL_INICIAL = 2;

/**
 * Escalera del modo partido: fraccion de la resolucion del lienzo a la que
 * se traza. El titular no depende de ella (se compone a resolucion completa),
 * asi que puede bajar mucho mas que el dpr.
 */
const TRAZAS = [1, 0.75, 0.6, 0.5, 0.42, 0.35];
// 0,75 en reposo: con el disco sombreado a resolucion completa (modo
// diferido) no se distingue de 1 y va mas fluido (Redmi Note 13: 35 frente
// a 30 fps de pagina, 27-09-2026).
const TRAZA_INICIAL = 1;

/**
 * `?fps` en la URL: un contador encima de la pagina con los fotogramas que
 * pinta de verdad el agujero del hero, la resolucion y los pasos. Es para
 * medir en el telefono, donde no hay herramientas de desarrollo a mano.
 * `?calidad=N` fija un escalon de `NIVELES` y apaga el ajuste, para comparar.
 */
const busqueda = typeof location === "undefined" ? "" : location.search;
const HUD = /[?&]fps(=|&|$)/.test(busqueda) ? { pintados: 0, dpr: NIVELES[NIVEL_INICIAL] } : null;
const SIN_PARTIR = /[?&]entero(=|&|$)/.test(busqueda);
// `?sin-diferir`: el modo partido con el color trazado, para comparar.
const SIN_DIFERIR = /[?&]sin-diferir(=|&|$)/.test(busqueda);
const CALIDAD_FIJA = (() => {
  const m = /[?&]calidad=(\d+)/.exec(busqueda);
  return m ? Number(m[1]) : null;
})();
if (HUD && typeof document !== "undefined") {
  const caja = document.createElement("div");
  caja.style.cssText = "position:fixed;left:8px;top:8px;z-index:9999;padding:6px 9px;border-radius:6px;background:rgba(0,0,0,.72);color:#9f9;font:600 12px/1.35 ui-monospace,monospace;pointer-events:none;white-space:pre";
  const pintar = () => { if (!caja.isConnected) document.body.append(caja); };
  let antes = performance.now();
  setInterval(() => {
    pintar();
    const ahora = performance.now();
    const fps = (HUD.pintados * 1000) / (ahora - antes);
    antes = ahora;
    HUD.pintados = 0;
    caja.textContent = `agujero ${fps.toFixed(0)} fps
dpr ${HUD.dpr}  pasos ${PASOS}${CALIDAD_FIJA !== null ? "  (fijo)" : ""}`;
  }, 1000);
}
// La GPU de alto consumo solo donde hay de donde tirar: en un telefono pedirla
// no da mas GPU, da mas calor y mas bateria.
const GL_OPCIONES = { antialias: false, alpha: true, powerPreference: perfil.movil ? "default" : "high-performance" };
function hueOf(hex) {
  if (!hex) return 0;
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return (((h - AMBAR) % 360) + 360) % 360 * Math.PI / 180;
}

/**
 * `dpr` es la resolucion del lienzo respecto a su caja CSS, y aqui no es un
 * ajuste de calidad: es lo unico que permite AMPLIAR un lienzo WebGL.
 *
 * Los seis agujeros del halo miden 94 px de caja y el zoom los lleva a 735
 * con una transformacion CSS, que escala el mapa de bits ya pintado y no
 * vuelve a pintarlo: se veia el agujero convertido en escalones. Subiendo el
 * dpr a la misma proporcion, el lienzo se repinta a tamano real y queda
 * nitido. Ver `entrar()` en Halo.jsx.
 */
export default function BlackHole({ bare = false, className = "", formation, journey, lensSource, lensFrame, onLensReady, onPintado, onPreparado, tint, dpr, disk = 1, white = 0, espejo, espejoModo }) {
  const { lang } = useLang();
  const { sample } = useMusic();
  const root = useRef(null);
  const visual = useRef({time:0,x:0,y:0,bass:0,mid:0,treble:0});
  const lens = useRef({title:null,copy:null});
  const interaction = useRef({ point: new Vector2(), down: false });
  const [active, setActive] = useState(true);
  const [reduced, setReduced] = useState(false);
  /**
   * Respaldo sin WebGL. Entra si el lienzo pinta blanco (ver `pintaBlanco`) o
   * si el navegador suelta el contexto —en movil pasa al abrir muchos lienzos
   * y los primeros en caer son los mas viejos, que son justo este—. Se queda
   * para toda la visita: volver a intentarlo seria arriesgar otro destello.
   * El titular vuelve al <h1> del DOM (`onLensReady(false)`), si no el nombre
   * desapareceria con el lienzo.
   */
  const [rotoAqui, setRoto] = useState(false);
  // Si cae cualquier otro lienzo de la pagina, este tambien pasa a su
  // respaldo (ver lib/gpu.js): quedarse vivo era esperar su turno para caer.
  const gpuCaida = useGpuFallo();
  const roto = rotoAqui || gpuCaida;
  // En el telefono arranca a 0,75 y sube hasta 1 solo si le sobra (ver
  // `ajusta` en Scene). Son muchos pixeles por rayo en una GPU de movil, y la
  // densidad de la pantalla ya disimula la diferencia.
  const movil = perfil.movil;
  const dprLienzo = dpr ?? (movil && !SIN_PARTIR ? DPR_PARTIDO : movil ? DPR_MOVIL : [1, 1.25]);
  const rotoRef = useRef(false);
  rotoRef.current = roto;
  const romper = useCallback((motivo = "lienzo roto") => {
    if (rotoRef.current) return;
    rotoRef.current = true;
    setRoto(true);
    marcarGpuFallo(`agujero negro: ${motivo}`);
  }, []);
  // Si ya no hay lienzo (roto o caido), nadie va a avisar de que pinto: el
  // respaldo cuenta como listo, para no dejar a nadie esperando (la musica).
  useEffect(() => {
    if (roto) onPintado?.();
  }, [roto, onPintado]);
  useEffect(() => {
    if (roto) onLensReady?.(false);
  }, [roto, onLensReady]);
  useEffect(() => {
    const holder = root.current;
    if (!holder) return undefined;
    const perdido = () => romper("contexto perdido");
    holder.addEventListener("webglcontextlost", perdido, true);
    return () => holder.removeEventListener("webglcontextlost", perdido, true);
  }, [romper]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync(); media.addEventListener("change",sync);
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting));
    observer.observe(root.current);
    return () => { observer.disconnect(); media.removeEventListener("change",sync); };
  }, []);
  // El texto que hay que lensear se re-rasteriza cuando cambia el tamaño, el
  // idioma o la tipografía; el resto del tiempo la textura se reutiliza.
  useEffect(() => {
    const target = lensSource?.current;
    if(!target || !root.current) return;
    let alive = true;
    let esperando = 0;

    /**
     * `getBoundingClientRect` devuelve la caja TRANSFORMADA, y este lienzo se
     * escala a ~1/12 durante el viaje a la mano del astronauta (ver `follow()`
     * en Stage.jsx). Rasterizar el titular ahi daba una textura de 53x48 con
     * los glifos fuera de encuadre; y como la textura NO es nula, `uReveal`
     * seguia a 1 y el <h1> del DOM seguia transparente, asi que al volver
     * arriba no habia titular ninguno. Tampoco se recuperaba solo: el
     * ResizeObserver vigila la caja de LAYOUT, y un transform no la cambia.
     *
     * Lo dispara cualquier repintado hecho a media pagina: cambiar de idioma
     * con el conmutador del nav, o redimensionar la ventana.
     */
    const enReposo = () => {
      const el = root.current;
      const caja = el.getBoundingClientRect();
      return Math.abs(caja.width - el.offsetWidth) <= 1
        && Math.abs(caja.height - el.offsetHeight) <= 1;
    };

    /**
     * Donde queda el lienzo con la pagina ARRIBA, que es donde se lee el
     * titular. El lienzo del hero es `sticky`: bajando se queda pegado arriba
     * mientras el <h1> sube con el scroll. Medir el texto contra la caja de
     * ese momento lo dejaba FUERA del lienzo: textura vacia, `uReveal` a 1 y
     * el <h1> transparente, o sea sin nombre y para siempre. Lo disparaba
     * cualquier repintado a media pagina, y el mas comun es la GPU que se
     * reinicia con la pagina quieta un rato (webglcontextrestored). Con
     * `lensFrame` (el bloque en cuyo borde superior descansa el lienzo) la
     * caja se mide en su sitio de reposo, pinte cuando pinte.
     */
    const cajaEnReposo = () => {
      const box = root.current.getBoundingClientRect();
      const frame = lensFrame?.current;
      if (!frame) return box;
      const top = frame.getBoundingClientRect().top;
      return { left: box.left, right: box.right, width: box.width, height: box.height, top, bottom: top + box.height };
    };

    // Mientras siga encogido se conserva la textura buena y se vuelve a
    // mirar cuando algo pueda haberlo cambiado: el siguiente desplazamiento
    // (el lienzo solo se encoge con el scroll) o, como mucho, un reintento
    // cada medio segundo durante unos segundos. Antes era un rAF que se
    // renovaba solo: con el agujero en la mano del astronauta y la pagina
    // quieta, sondeaba cada fotograma indefinidamente.
    let intentos = 0;
    const alDesplazar = () => { cancelar(); repaint(); };
    const cancelar = () => {
      if (esperando) clearTimeout(esperando);
      esperando = 0;
      window.removeEventListener("scroll", alDesplazar);
    };
    const reintentar = () => {
      if (esperando || !alive) return;
      window.addEventListener("scroll", alDesplazar, { passive: true, once: true });
      if (intentos++ < 8) esperando = setTimeout(() => { esperando = 0; window.removeEventListener("scroll", alDesplazar); repaint(); }, 500);
      else esperando = -1;
    };

    const repaint = () => {
      if(!alive || !root.current || rotoRef.current) return;
      if(!enReposo()) { reintentar(); return; }
      intentos = 0;
      const box = cajaEnReposo();
      if(!target.querySelector('[data-lens-line][data-lens-group="title"]')) return;
      const title = paintLensText(target, box, "title");
      const copy = paintLensText(target, box, "copy");
      if(!title || !copy) return;
      lens.current.title?.dispose();
      lens.current.copy?.dispose();
      lens.current.title = title;
      lens.current.copy = copy;
      onLensReady?.(true);
    };
    document.fonts?.ready.then(repaint) ?? repaint();
    const observer = new ResizeObserver(repaint);
    observer.observe(root.current);
    observer.observe(target);
    // Si la GPU se reinicia, se rasteriza de nuevo al recuperar el contexto en
    // vez de fiarse de lo que quede en los lienzos (ver paintLensText). El
    // evento no burbujea: se escucha en captura desde la caja.
    const holder = root.current;
    holder.addEventListener("webglcontextrestored", repaint, true);
    return () => {
      alive = false; observer.disconnect();
      holder.removeEventListener("webglcontextrestored", repaint, true);
      cancelar();
      lens.current.title?.dispose(); lens.current.copy?.dispose();
      lens.current.title = null; lens.current.copy = null;
      onLensReady?.(false);
    };
  // `lang` entra en las dependencias a propósito: al cambiar de idioma el
  // titular no cambia de tamaño, así que el ResizeObserver no se entera y la
  // textura se quedaría con el texto del idioma anterior.
  },[lensSource,lensFrame,onLensReady,lang]);

  const reset = () => { interaction.current.down = false; interaction.current.point.set(0,0); };
  /**
   * El dedo mueve el agujero del hero. Con raton lo lleva el puntero sobre el
   * lienzo (abajo), pero en tactil el gesto vertical es del scroll: el
   * navegador cancela el puntero en cuanto el dedo baja y el agujero no se
   * movia (Jorge, 27-09-2026: "el agujero en celular no se puede mover"). Se
   * escucha el dedo en toda la pagina, sin bloquear nada (pasivo): el
   * agujero va hacia donde esta el dedo, el disco acelera mientras se toca y
   * al soltar vuelve suave a su sitio. Solo en el hero (el Scene deja de
   * seguir el puntero en cuanto el agujero empieza a viajar) y no desde la
   * barra de arriba.
   */
  useEffect(() => {
    if (!movil || dpr !== undefined) return undefined;
    const fuera = (e) => e.target?.closest?.(".nav, .music-player, .offline");
    const mover = (e) => {
      const t = e.touches?.[0];
      const el = root.current;
      if (!activo || !t || !el) return;
      // Arrastrando el agujero la pagina no se mueve (Jorge, 27-09-2026: "al
      // mover el agujero con el dedo se activa el scroll"). Solo si el toque
      // empezo sobre el: desde el texto o el cielo, el dedo desplaza.
      if (e.cancelable && e.type === "touchmove") e.preventDefault();
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = Math.max(-1, Math.min(1, ((t.clientX - r.left) / r.width) * 2 - 1));
      const y = Math.max(-1, Math.min(1, 1 - ((t.clientY - r.top) / r.height) * 2));
      interaction.current.point.set(x, y);
    };
    // Solo cuenta un toque que EMPIEZA sobre el agujero: entre lo alto del
    // nombre y el texto de abajo. Tocar bajo "Scroll" tambien lo agarraba
    // (Jorge, 27-09-2026); ahi el dedo solo desplaza.
    let activo = false;
    const sobreAgujero = (t) => {
      const titulo = document.querySelector(".hero--singularity .hero__title")?.getBoundingClientRect();
      const pie = document.querySelector(".hero--singularity .hero__meta")?.getBoundingClientRect();
      if (!titulo || !pie) return false;
      return t.clientY >= titulo.top - 60 && t.clientY <= pie.top;
    };
    const inicio = (e) => {
      const t = e.touches?.[0];
      activo = Boolean(t) && !fuera(e) && sobreAgujero(t);
      if (!activo) return;
      mover(e);
      interaction.current.down = true;
    };
    const fin = () => { activo = false; interaction.current.down = false; interaction.current.point.set(0, 0); };
    const op = { passive: true, capture: true };
    // `passive: false` solo en el movimiento: es lo que deja cancelar el
    // scroll mientras se arrastra el agujero.
    const opMover = { passive: false, capture: true };
    document.addEventListener("touchstart", inicio, op);
    document.addEventListener("touchmove", mover, opMover);
    document.addEventListener("touchend", fin, op);
    document.addEventListener("touchcancel", fin, op);
    return () => {
      document.removeEventListener("touchstart", inicio, op);
      document.removeEventListener("touchmove", mover, opMover);
      document.removeEventListener("touchend", fin, op);
      document.removeEventListener("touchcancel", fin, op);
    };
  }, [movil, dpr]);
  return <div ref={root} className={`blackhole ${bare ? "blackhole--bare" : ""} ${className}`}>
    {/* Decorativo: pulsarlo acelera el disco, pero no es una accion. Sin
        `role="button"` ni foco, que anunciaban un boton que no hace nada y
        metian una parada de teclado en la primera pantalla. */}
    <div className="blackhole__surface" aria-hidden="true"
      onPointerMove={(e) => {
        // El dedo lo lleva el efecto de arriba, solo sobre el agujero; aqui
        // cualquier toque del lienzo (que cubre la pantalla entera) lo
        // agarraba, tambien bajo "Scroll".
        if (e.pointerType === "touch") return;
        const r=e.currentTarget.getBoundingClientRect();
        interaction.current.point.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
      }}
      onPointerDown={(e) => { if(e.button !== 0 || e.pointerType === "touch") return; interaction.current.down=true; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerUp={(e) => { if (e.pointerType !== "touch") reset(); }} onPointerCancel={(e) => { if (e.pointerType !== "touch") reset(); }}
      onLostPointerCapture={(e) => { if (e.pointerType !== "touch") reset(); }} onPointerLeave={(e) => { if (e.pointerType !== "touch") reset(); }}
    >
      {/* `scroll: false` no es un detalle de rendimiento. react-use-measure
          vuelve a medir la caja TRANSFORMADA en cada desplazamiento, y
          `.stage__traveler` escala este lienzo para meterlo en la mano del
          astronauta (ver Stage.jsx). Con la remedicion puesta se realimentaba:
          el rect encogido redimensionaba el lienzo, la misma escala lo volvia a
          encoger, y el agujero del hero acababa en 93 px tras un solo viaje
          hasta abajo, sin recuperarse al subir. El lienzo siempre cubre el
          viewport entero, asi que al desplazarse no hay nada que volver a
          medir; de los cambios de tamano ya se encarga el ResizeObserver. */}
      {roto ? <div className="blackhole__fallback" /> : <SceneBoundary onFallo={() => romper("la escena lanzo un error")}><Canvas key="transparent-context" dpr={dprLienzo} resize={{ offsetSize: true, scroll: false }} frameloop={active ? "always" : "never"}
        gl={GL_OPCIONES}
        onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); revisarRenderer(gl.getContext()); }}
        fallback={<div className="blackhole__fallback" />}>
        <Scene interaction={interaction} reduced={reduced} formation={formation} journey={journey} sample={sample} visual={visual} lens={lens} espejo={espejo} espejoModo={espejoModo} hue={hueOf(tint)} disk={disk} white={white} onRoto={romper} onPintado={onPintado} onPreparado={onPreparado} ajusta={(movil || CALIDAD_FIJA !== null) && dpr === undefined} />
      </Canvas></SceneBoundary>}
    </div>
  </div>;
}
