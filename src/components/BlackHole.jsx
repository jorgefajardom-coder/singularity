import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, LinearFilter, Vector2, Vector3 } from "three";

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
import { ui } from "../data/content";
import { useLang } from "../lib/i18n";
import { useMusic } from "../lib/music";
import { useTelefono } from "../lib/telefono";
import { curvaParaShader } from "../lib/curvaInfinito";

const vertexShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Agujero negro trazado por geodésicas: cada píxel lanza un fotón hacia atrás y
// se integra su curvatura. La imagen superior del disco y la inferior aparecen
// solas; ninguna se dibuja a mano. El anillo de fotones también salía solo, y
// se apaga a propósito: ver `wound` más abajo.
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
const int   STEPS    = 180;
const float SPIN     = 0.17;   // arrastre de marco: el agujero gira de verdad
const float TILT0    = 0.092;  // el plano arranca mirando a la cámara
const float LEM_A    = 10.4;   // semianchura del ∞: cuadra con la del SVG del cargador

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float noise3(vec3 x) {
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
  for (int i = 0; i < 3; i++) { s += a * noise3(p); p = p * 2.03 + 13.7; a *= 0.5; }
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
vec3 starField(vec3 d) {
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

vec3 diskSample(vec3 hit, vec3 dir, vec3 e1, vec3 e2, vec3 nrm, float morph, out float opacity) {
  float u = dot(hit, e1), v = dot(hit, e2);
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
  vec3 orbit = normalize(cross(nrm, hit));
  float beta = 0.42 * sqrt(DISK_IN / r);
  float boost = 1.0 / max(1.0 - beta * dot(orbit, -dir), 0.35);
  boost = mix(1.0, pow(boost, 2.2), 0.28);

  opacity = clamp(edge * filament * 0.82, 0.0, 1.0);
  float glow = edge * filament * falloff * boost * (9.8 + uBass * 5.4 + uTreble * 1.6 + uPower * 4.4);
  vec3 plasma = ember(heat) * glow;
  if (esmalte <= 0.0) return plasma;
  opacity = mix(opacity, lamina.a, esmalte);
  return mix(plasma, sinTono(lamina.rgb) * lamina.a, esmalte);
}

void main() {
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
      float dt = clamp(min(r * 0.062, (r - horizon) * 0.30 + 0.012), 0.010, 0.95);
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
    col += starField(away) * trans * (2.15 + uTreble * 1.15) * (1.0 - uIsolation) * clear * cielo;
    // Mientras tanto, el fondo es el del cargador (--ink, #08070a), no negro.
    col += sinTono(vec3(0.031, 0.027, 0.039)) * trans * (1.0 - cielo) * (1.0 - uIsolation);
    // El titular es el fondo por el que pasan los fotones. Se vuelve a
    // proyectar la dirección de SALIDA del rayo: sin curvatura cae exactamente
    // donde lo pone el DOM, y cerca del horizonte se estira y desaparece.
    float ahead = dot(away, fwd);
    if (ahead > 0.02) {
      // En reposo la gravedad ya actúa casi entera sobre el titular: es lo que
      // lo mantiene curvado sin tocar nada. Los extras solo lo rematan.
      float warp = clamp(0.62 + uBass * 0.22 + uPower * 0.35 + length(uPointer) * 0.38, 0.0, 1.0);
      vec2 lensed = LENSE * vec2(dot(away, right), dot(away, up)) / ahead + shift;
      // El tirón de la lente se satura en curva, no de golpe: un recorte duro
      // daría a todos los píxeles el mismo desplazamiento y el titular se
      // movería en bloque en vez de deformarse. Así el gradiente sobrevive y
      // el texto se sigue arqueando sin llegar a salirse del encuadre.
      vec2 pull = lensed - screen;
      float reach = length(pull);
      pull *= (reach / (1.0 + reach / 0.80)) / max(reach, 1e-4);
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
    }
  }

  // Bruma cálida muy tenue: el halo que el disco deja en la óptica.
  float d = length(uv);
  col += vec3(1.0, 0.29, 0.04) * exp(-max(d - 0.17, 0.0) * 6.5) * 0.022 * diskFade * (0.55 + uBass * 0.9)
       * smoothstep(0.08, 0.55, uFormation);


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
  const dpr = Math.min(devicePixelRatio || 1, 2);
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

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
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
 * Paso en un Android (25-09-2026, video de Jorge): el agujero salia como un
 * rectangulo blanco opaco —el hero lavado y sin nombre, las marcas sobre
 * blanco, una elipse blanca pegada al astronauta— y en el computador, con el
 * mismo tamano de pantalla, se veia bien. No se puede probar en cada telefono,
 * asi que el lienzo se comprueba a si mismo: lee seis puntos del borde justo
 * despues de pintar (el buffer sigue intacto en esa misma tarea) y, si casi
 * todos son blanco opaco, se da por roto. En el borde nunca hay blanco de
 * verdad: el cielo es oscuro, el disco es ambar (azul bajo) y en los lienzos
 * aislados el fondo es transparente.
 */
const PUNTOS = [[0.03, 0.03], [0.97, 0.03], [0.03, 0.5], [0.97, 0.5], [0.03, 0.97], [0.97, 0.97]];
const PIXEL = new Uint8Array(4);
function pintaBlanco(ctx) {
  const w = ctx.drawingBufferWidth, h = ctx.drawingBufferHeight;
  if (!w || !h) return false;
  let blancos = 0;
  for (const [x, y] of PUNTOS) {
    ctx.readPixels(Math.floor(x * (w - 1)), Math.floor(y * (h - 1)), 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, PIXEL);
    if (PIXEL[0] > 200 && PIXEL[1] > 200 && PIXEL[2] > 200 && PIXEL[3] > 200) blancos++;
  }
  return blancos >= 4;
}

function Scene({ interaction, reduced, formation, sample, visual, lens, journey, espejo, espejoModo, hue = 0, disk = 1, white = 0, onRoto, ajusta = false }) {
  const elapsed = useRef(0);
  const rigid = useRef(0);
  const wound = useRef(0);
  const lastFormation = useRef(1);
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
    uCenter: { value: new Vector2() }, uScale: { value: 1 }, uTopDown: { value: 0 }, uIsolation: { value: 0 }, uFaceOn: { value: 0 },
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
    const copia = espejoModo === "sigue" ? espejo?.current : null;
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
    for (const band of ['bass','mid','treble']) {
      const target = reduced ? 0 : Math.min(1,Math.pow(Math.max(0,audio[band]-0.010),0.9)*1.25);
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
    const libre = !journey?.current || journey.current.p < 0.01;
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
    live.uScale.value = trip?.scale ?? 1;
    live.uTopDown.value = trip?.topDown ?? 0;
    live.uFaceOn.value = trip?.faceOn ? 1 : 0;
    live.uIsolation.value = trip?.isolation ?? 0;
    // Relevo directo del texto DOM a sus texturas, sin un intervalo oscuro.
    live.uText.value = lens.current.title;
    live.uCopy.value = lens.current.copy;
    // El titular lenseado vive pegado al agujero. En cuanto este se despega
    // para irse abajo, el relevo vuelve al DOM (ver `--lens-fade`).
    live.uReveal.value = (lens.current.title ? 1 : 0) * (trip?.lens ?? 1);
    visual.current.time=elapsed.current;
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

  /**
   * Resolucion que se adapta en el telefono. Cada pixel lanza un rayo de
   * hasta 180 pasos, asi que el coste va con el area del lienzo: si la media
   * de un tramo de fotogramas pasa de 1/40 s, la resolucion baja un 15 %,
   * hasta 0,6. Solo baja, nunca sube: subir y bajar se veria como un
   * parpadeo de nitidez. Se mide desde el fotograma 10 para no contar la
   * compilacion.
   */
  const { setDpr, viewport: { dpr: dprActual } } = useThree();
  const medida = useRef({ n: 0, t: 0 });
  const dprVivo = useRef(dprActual);
  useFrame((_, delta) => {
    if (!ajusta || !listo.current || pintados.current < 10) return;
    const m = medida.current;
    m.n++; m.t += Math.min(delta, 0.25);
    if (m.n < 30) return;
    const media = m.t / m.n;
    m.n = 0; m.t = 0;
    if (media > 1 / 40 && dprVivo.current > 0.6) {
      dprVivo.current = Math.max(0.6, dprVivo.current * 0.85);
      setDpr(dprVivo.current);
    }
  });

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
    if (renderer.compileAsync) renderer.compileAsync(escena, camara).then(hecho, hecho);
    else hecho();
    return () => { vivo = false; };
  }, [renderer, escena, camara]);

  // Con prioridad 1 r3f deja de pintar solo: pinta este callback, en todos
  // los lienzos del agujero. Ademas de esperar al shader, se salta el render
  // de lo que nadie ve, tras dos fotogramas para dejarlo caliente:
  //   - el del hero mientras el cargador lo tapa (`cubre`);
  //   - el del cargador en el selector (`oculto`), donde es invisible.
  // Los dos pintaban a pantalla completa cada fotograma del selector: en una
  // grafica integrada lo dejaban en ~10 fps.
  useFrame(({ gl, scene, camera }) => {
    if (!listo.current) return;
    const tapado = espejoModo === "sigue" ? espejo?.current?.cubre : journey?.current?.oculto;
    if (tapado && pintados.current > 1) return;
    pintados.current++;
    gl.render(scene, camera);
    if (pintados.current >= 3 && pintados.current <= 12 && pintaBlanco(gl.getContext())) onRoto?.();
  }, 1);

  return <mesh frustumCulled={false}><planeGeometry args={[2,2]} /><shaderMaterial
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
export default function BlackHole({ bare = false, className = "", formation, journey, lensSource, lensFrame, onLensReady, tint, dpr, disk = 1, white = 0, espejo, espejoModo }) {
  const { lang, tr } = useLang();
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
  const [roto, setRoto] = useState(false);
  // En el telefono, 1 y no 1,25: son muchos pixeles por rayo en una GPU de
  // movil, y la densidad de la pantalla ya disimula la diferencia. Ademas la
  // escena la baja sola si no llega (ver `ajusta` en Scene).
  const telefono = useTelefono();
  const dprLienzo = dpr ?? (telefono ? 1 : [1, 1.25]);
  const rotoRef = useRef(false);
  const romper = useCallback(() => {
    if (rotoRef.current) return;
    rotoRef.current = true;
    setRoto(true);
  }, []);
  useEffect(() => {
    if (roto) onLensReady?.(false);
  }, [roto, onLensReady]);
  useEffect(() => {
    const holder = root.current;
    if (!holder) return undefined;
    const perdido = () => romper();
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

    // Mientras siga encogido se conserva la textura buena y se vuelve a mirar
    // en el fotograma siguiente. El sondeo se apaga solo en cuanto pinta.
    const reintentar = () => {
      if (esperando || !alive) return;
      esperando = requestAnimationFrame(() => { esperando = 0; repaint(); });
    };

    const repaint = () => {
      if(!alive || !root.current || rotoRef.current) return;
      if(!enReposo()) { reintentar(); return; }
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
      if (esperando) cancelAnimationFrame(esperando);
      lens.current.title?.dispose(); lens.current.copy?.dispose();
      lens.current.title = null; lens.current.copy = null;
      onLensReady?.(false);
    };
  // `lang` entra en las dependencias a propósito: al cambiar de idioma el
  // titular no cambia de tamaño, así que el ResizeObserver no se entera y la
  // textura se quedaría con el texto del idioma anterior.
  },[lensSource,lensFrame,onLensReady,lang]);

  const reset = () => { interaction.current.down = false; interaction.current.point.set(0,0); };
  return <div ref={root} className={`blackhole ${bare ? "blackhole--bare" : ""} ${className}`}>
    <div className="blackhole__surface" role="button" tabIndex={0}
      aria-label={tr(ui.a11y.blackHole)}
      onPointerMove={(e) => {
        const r=e.currentTarget.getBoundingClientRect();
        interaction.current.point.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
      }}
      onPointerDown={(e) => { if(e.button !== 0) return; interaction.current.down=true; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerUp={reset} onPointerCancel={reset} onLostPointerCapture={reset} onPointerLeave={reset} onBlur={reset}
      // Solo Enter. Con Espacio tambien puesto, quien navega con teclado se
      // quedaba sin poder avanzar la pagina: este control es enfocable, esta
      // en la primera pantalla, y el preventDefault se comia el scroll. El
      // efecto es un adorno —acelera el disco mientras se mantiene—, asi que
      // no compensa quedarse con la tecla de avanzar pagina.
      onKeyDown={(e) => { if(e.key === "Enter") {e.preventDefault();interaction.current.down=true;} }}
      onKeyUp={(e) => {if(e.key === "Enter") {e.preventDefault();reset();}}}
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
      {roto ? <div className="blackhole__fallback" /> : <SceneBoundary><Canvas key="transparent-context" dpr={dprLienzo} resize={{ offsetSize: true, scroll: false }} frameloop={active ? "always" : "never"}
        gl={{antialias:false,alpha:true,powerPreference:"high-performance"}}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        fallback={<div className="blackhole__fallback" />}>
        <Scene interaction={interaction} reduced={reduced} formation={formation} journey={journey} sample={sample} visual={visual} lens={lens} espejo={espejo} espejoModo={espejoModo} hue={hueOf(tint)} disk={disk} white={white} onRoto={romper} ajusta={telefono && dpr === undefined} />
      </Canvas></SceneBoundary>}
    </div>
  </div>;
}
