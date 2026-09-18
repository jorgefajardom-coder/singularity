import { Component, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { CanvasTexture, LinearFilter, Vector2 } from "three";
import { ui } from "../data/content";
import { useLang } from "../lib/i18n";
import { useMusic } from "../lib/music";

const vertexShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Agujero negro trazado por geodésicas: cada píxel lanza un fotón hacia atrás y
// se integra su curvatura. El anillo de fotones, la imagen superior del disco y
// la inferior aparecen solas; ninguna se dibuja a mano.
const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uRigid, uWind, uPower, uAspect, uFormation, uBass, uMid, uTreble, uReveal;
uniform float uScale, uTopDown;
uniform vec2 uPointer, uCenter;
uniform sampler2D uText, uCopy;

const float DISK_IN  = 2.05;   // borde interno, junto a la última órbita estable
const float DISK_OUT = 15.0;
const float CAM_DIST = 26.0;   // la cámara mira desde fuera del disco
const float LENSE    = 3.00;   // distancia focal: encuadra la sombra en pantalla
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

// Rampa de cuerpo negro recortada en ámbar: no llega nunca a blanco, así el
// disco conserva el color del hierro fundido incluso en los picos.
vec3 ember(float h) {
  h = clamp(h, 0.0, 1.0);
  vec3 c = mix(vec3(0.25, 0.010, 0.002), vec3(0.92, 0.085, 0.004), smoothstep(0.00, 0.35, h));
  c = mix(c, vec3(1.00, 0.255, 0.022), smoothstep(0.33, 0.62, h));
  c = mix(c, vec3(1.00, 0.430, 0.095), smoothstep(0.60, 0.85, h));
  c = mix(c, vec3(1.00, 0.560, 0.185), smoothstep(0.84, 1.00, h));
  return c;
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
  float spark = exp(-length(local - off * 0.7) * mix(15.0, 8.0, clamp(mag * 0.5, 0.0, 1.0)));
  vec3 tint = mix(vec3(0.72, 0.81, 1.00), vec3(1.00, 0.87, 0.70), hash31(cell + 57.1));
  return tint * spark * mag;
}

// Emisión en el punto donde el fotón cruza la superficie luminosa. Esa
// superficie es la MISMA a lo largo de toda la escena: al principio su contorno
// es una lemniscata de Bernoulli (el ∞) sobre un plano que mira a la cámara, y
// al final es el anillo del disco sobre el plano ecuatorial. No hay dos objetos
// ni dos motores: hay un conjunto de nivel que se transforma.
vec3 diskSample(vec3 hit, vec3 dir, vec3 e1, vec3 e2, vec3 nrm, float morph, out float opacity) {
  float u = dot(hit, e1), v = dot(hit, e2);
  float r = sqrt(u * u + v * v);
  float t = (r - DISK_IN) / (DISK_OUT - DISK_IN);
  float edge = smoothstep(0.0, 0.016, t) * smoothstep(1.0, 0.45, t);
  // Mientras es un ∞ el perfil radial del disco todavía no manda.
  edge = mix(1.0, edge, morph);

  // Lemniscata de Bernoulli  Q² = U²−V²   →   anillo  R = RMID.
  // Se interpolan las DISTANCIAS a una y a otra, no sus funciones implícitas:
  // |F| < w no es una banda de anchura uniforme y se hinchaba en el cruce del
  // ∞. Dividir por el gradiente la convierte en distancia de primer orden, y
  // mezclar dos campos de distancia transforma un contorno en el otro sin que
  // nada aparezca ni desaparezca por el camino.
  float U = u / LEM_A, V = v / LEM_A;
  float Q = U * U + V * V;
  float lem = Q * Q - (U * U - V * V);
  vec2  grad = vec2(2.0 * U * (2.0 * Q - 1.0), 2.0 * V * (2.0 * Q + 1.0));
  float toEight = abs(lem) / max(length(grad), 0.08);

  const float R_IN  = DISK_IN / LEM_A;
  const float R_OUT = DISK_OUT / LEM_A;
  const float RMID  = (R_IN + R_OUT) * 0.5;
  float toRing = abs(sqrt(Q) - RMID);

  float dist  = mix(toEight, toRing, morph);
  // La meseta de la banda (el 80 % interior) tiene que cubrir exactamente el
  // anillo DISK_IN..DISK_OUT; si no, se come la parte interna, que es la más
  // caliente y brillante del disco.
  // 0.088 ≈ el mismo grosor de trazo que el ∞ del SVG del cargador. Con la
  // cinta más fina, a mitad del fundido quedaba muy poca materia encendida y
  // se colaba un fotograma oscuro entre las dos figuras.
  float width = mix(0.088, (R_OUT - R_IN) / 1.6, morph);
  edge *= smoothstep(width, width * 0.80, dist);

  // Salida temprana: la geometría es barata y el ruido no. Cuando el cruce cae
  // fuera de la figura —lo habitual durante la fase de ∞ y en todo el exterior
  // del disco— se ahorran las tres octavas de fbm y el resto del sombreado.
  if (edge < 0.004) { opacity = 0.0; return vec3(0.0); }

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
  float spin = (uRigid + uWind * (shear - 1.0)) * morph;
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
  return ember(heat) * glow;
}

void main() {
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
  // El ∞ empieza plano y sin gravedad; la curvatura entra después, cuando la
  // figura ya se está cerrando en anillo, y es ella la que lo termina de doblar.
  float lens     = smoothstep(0.38, 0.96, uFormation);
  float morph    = smoothstep(0.26, 0.88, uFormation);
  // Repartir el cambio de perspectiva y suavizar también su aceleración.
  float tiltProgress = clamp((uFormation - 0.12) / 0.84, 0.0, 1.0);
  float tiltAmt = tiltProgress * tiltProgress * tiltProgress
                * (tiltProgress * (tiltProgress * 6.0 - 15.0) + 10.0);
  // El horizonte de sucesos se mueve con la música: los graves lo hinchan y
  // los agudos rizan su silueta, así que la sombra late en vez de estar quieta.
  float pulse    = 0.065 * uBass + 0.07 * uTreble * sin(atan(uv.y, uv.x) * 5.0 - uTime * 6.0);
  float horizon  = mix(0.04, 1.0, smoothstep(0.02, 0.70, uFormation)) * (1.0 + pulse);
  float diskFade = smoothstep(0.0, 0.08, uFormation);

  // Elevacion de la camara sobre el plano ecuatorial. De canto (5 grados) es
  // como se ve el disco toda la vida; uTopDown la sube a 80, que es donde se
  // lee como un sistema planetario. No llega a 90 a proposito: ahi la mirada
  // es paralela al eje Y y el producto vectorial que define el eje derecho
  // degenera.
  float inclBase = 0.092 + uPointer.y * 0.055 + sin(uTime * 0.17) * 0.010 * grow + uBass * 0.025;
  float incl = mix(inclBase, 1.40 + uPointer.y * 0.10, uTopDown);
  float yaw  = uPointer.x * 0.26 + sin(uTime * 0.13) * 0.020 * grow;

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
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up    = cross(right, fwd);
  vec3 dir   = normalize(fwd * LENSE + right * uv.x + up * uv.y);

  vec3 col = vec3(0.0);
  float trans = 1.0;
  bool captured = false;
  vec3 vel = dir;

  // Un rayo con parámetro de impacto grande no puede tocar ni el disco ni el
  // horizonte: se salta la integración entera y el fondo sale casi gratis.
  float impact = length(cross(camPos, dir));
  if (impact < DISK_OUT + 1.6) {
    vec3 pos = camPos;
    float side = dot(pos, nrm);
    vec3 mom = cross(pos, vel);
    // La curvatura también bombea: el anillo de fotones se abre con el golpe.
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
      float next = dot(pos, nrm);
      if (side * next < 0.0) {
        float f = side / (side - next);
        vec3 hit = mix(prev, pos, f);
        float rr = length(vec2(dot(hit, e1), dot(hit, e2)));
        // Cubre tanto el ∞ como el borde exterior del disco, el mayor de los dos.
        if (rr < max(DISK_OUT, LEM_A) + 1.0) {
          float op;
          vec3 e = diskSample(hit, normalize(vel), e1, e2, nrm, morph, op);
          col += trans * e * diskFade;
          trans *= 1.0 - op;
          if (trans < 0.02) break;
        }
      }
      side = next;
    }
  }

  if (!captured) {
    vec3 away = normalize(vel);
    col += starField(away) * trans * (1.05 + uTreble * 0.85);
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
      vec2 base = screen * (1.0 - uBass * 0.010);
      vec2 frame = 2.0 * vec2(uAspect, 1.0) * zoom;
      // El texto pequeño va en su propia capa con mucha menos lente: el mismo
      // desplazamiento que en un titular de 130 px se lee como curvatura, y en
      // uno de 14 px como un renglón tirado por la página.
      float bright = trans * uReveal * (2.05 + uBass * 0.7);
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
  col += vec3(1.0, 0.29, 0.04) * exp(-max(d - 0.17, 0.0) * 6.5) * 0.022 * diskFade * (0.55 + uBass * 0.9);


  // Reinhard extendido sobre el canal más alto: comprime el brillo sin que el
  // rojo se sature antes que el verde, que es lo que volvía amarillo el disco.
  const float WHITE = 1.85;
  float peak = max(col.r, max(col.g, col.b));
  float mapped = peak * (1.0 + peak / (WHITE * WHITE)) / (1.0 + peak);
  col = min(col * (mapped / max(peak, 1e-4)), vec3(1.0));
  col = pow(max(col, 0.0), vec3(0.92));
  col *= 1.0 - smoothstep(1.70, 3.30, d) * 0.28;
  gl_FragColor = vec4(col, 1.0);
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
  const ctx = canvas.getContext("2d");
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

function Scene({ interaction, reduced, formation, sample, visual, lens, journey }) {
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
    uCenter: { value: new Vector2() }, uScale: { value: 1 }, uTopDown: { value: 0 },
  }), []);
  useFrame((state, delta) => {
    if (!material.current) return;
    const live = material.current.uniforms;
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
    live.uPointer.value.lerp(interaction.current.point,smooth);
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
    // Relevo directo del texto DOM a sus texturas, sin un intervalo oscuro.
    live.uText.value = lens.current.title;
    live.uCopy.value = lens.current.copy;
    // El titular lenseado vive pegado al agujero. En cuanto este se despega
    // para irse abajo, el relevo vuelve al DOM (ver `--lens-fade`).
    live.uReveal.value = (lens.current.title ? 1 : 0) * (trip?.lens ?? 1);
    visual.current.time=elapsed.current;
    visual.current.x=live.uPointer.value.x;
    visual.current.y=live.uPointer.value.y;
  });
  return <mesh frustumCulled={false}><planeGeometry args={[2,2]} /><shaderMaterial
    ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
    depthTest={false} depthWrite={false} toneMapped={false}
  /></mesh>;
}

export default function BlackHole({ bare = false, className = "", formation, journey, lensSource, onLensReady }) {
  const { lang, tr } = useLang();
  const { sample } = useMusic();
  const root = useRef(null);
  const visual = useRef({time:0,x:0,y:0,bass:0,mid:0,treble:0});
  const lens = useRef({title:null,copy:null});
  const interaction = useRef({ point: new Vector2(), down: false });
  const [active, setActive] = useState(true);
  const [reduced, setReduced] = useState(false);
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
    const repaint = () => {
      if(!alive || !root.current) return;
      const box = root.current.getBoundingClientRect();
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
    return () => {
      alive = false; observer.disconnect();
      lens.current.title?.dispose(); lens.current.copy?.dispose();
      lens.current.title = null; lens.current.copy = null;
      onLensReady?.(false);
    };
  // `lang` entra en las dependencias a propósito: al cambiar de idioma el
  // titular no cambia de tamaño, así que el ResizeObserver no se entera y la
  // textura se quedaría con el texto del idioma anterior.
  },[lensSource,onLensReady,lang]);

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
      onKeyDown={(e) => { if(e.key === " " || e.key === "Enter") {e.preventDefault();interaction.current.down=true;} }}
      onKeyUp={(e) => {if(e.key === " " || e.key === "Enter") {e.preventDefault();reset();}}}
    >
      <SceneBoundary><Canvas dpr={[1,1.25]} frameloop={active ? "always" : "never"}
        gl={{antialias:false,alpha:false,powerPreference:"high-performance"}}
        fallback={<div className="blackhole__fallback" />}>
        <Scene interaction={interaction} reduced={reduced} formation={formation} journey={journey} sample={sample} visual={visual} lens={lens} />
      </Canvas></SceneBoundary>
    </div>
  </div>;
}
