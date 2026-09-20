# -*- coding: utf-8 -*-
"""Genera src/styles/starfield.svg con la misma ley que `starField()` del shader.

Cada estrella saca su magnitud de una cubica sobre un uniforme —muchas debiles
y unas pocas brillantes, como el cielo real— y su tinte de la misma mezcla
azul/ambar. Las estrellas se agrupan por (tamano, tinte) en un unico <path> con
subtrayectos de longitud cero y `stroke-linecap="round"`, que es lo que mantiene
el archivo en unos pocos kB en vez de 30.
"""
import io
import random

W, H = 1600, 900
N = 460
SEED = 20260919

# Los dos extremos del tinte del shader: mix(vec3(0.72,0.81,1.00), vec3(1.00,0.87,0.70), u)
COLD = (0.72, 0.81, 1.00)
WARM = (1.00, 0.87, 0.70)
TINTS = 3      # cubos de color
SIZES = 5      # cubos de tamano


def hexof(t):
    c = tuple(COLD[i] + (WARM[i] - COLD[i]) * t for i in range(3))
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(v * 255))) for v in c)


rnd = random.Random(SEED)
stars = []
for _ in range(N):
    x = rnd.random() * W
    y = rnd.random() * H
    mag = 0.22 + 1.85 * rnd.random() ** 3     # misma curva que el shader
    tint = rnd.random()
    stars.append((x, y, mag, tint))

# Cubos: el tamano del trazo es el diametro del punto.
def size_bucket(mag):
    return min(SIZES - 1, int((mag - 0.22) / 1.85 * SIZES))


groups = {}
for x, y, mag, tint in stars:
    key = (size_bucket(mag), min(TINTS - 1, int(tint * TINTS)))
    groups.setdefault(key, []).append((x, y))

parts = []
for (sb, tb), pts in sorted(groups.items()):
    frac = (sb + 0.5) / SIZES
    width = round(1.35 + 3.1 * frac, 2)             # diametro en unidades del viewBox
    opacity = round(min(1.0, 0.58 + 0.42 * frac), 2)
    colour = hexof((tb + 0.5) / TINTS)
    d = ''.join('M%d %dh0' % (round(x), round(y)) for x, y in pts)
    parts.append(
        '<path stroke="%s" stroke-width="%s" stroke-opacity="%s" stroke-linecap="round" d="%s"/>'
        % (colour, width, opacity, d)
    )

# Halo de las mas brillantes: mismo punto, trazo ancho y casi transparente.
bright = [(x, y) for x, y, mag, _ in stars if mag > 1.45]
if bright:
    d = ''.join('M%d %dh0' % (round(x), round(y)) for x, y in bright)
    parts.insert(0,
        '<path stroke="#fff4e6" stroke-width="9" stroke-opacity="0.1" '
        'stroke-linecap="round" d="%s"/>' % d)

svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
    'width="%d" height="%d" shape-rendering="geometricPrecision">'
    '<title>Campo de estrellas del fondo</title>%s</svg>'
) % (W, H, W, H, ''.join(parts))

io.open('src/styles/starfield.svg', 'w', encoding='utf-8', newline='\n').write(svg)
# --- Las que titilan -------------------------------------------------------
# El SVG de arriba es un fondo, y dentro de un `background-image` no se anima
# nada. Las que parpadean salen aparte, como elementos de verdad, y son pocas a
# proposito: el cielo se lee vivo con un punado. Cada una lleva su propio ritmo
# y su propia fase para que no se vea un pulso general.
TITILAN = 34

tw = []
for x, y, mag, tint in rnd.sample(stars, TITILAN):
    frac = (mag - 0.22) / 1.85
    tw.append((
        round(x / W * 100, 2),                    # x, en % del viewport
        round(y / H * 100, 2),                    # y
        round(1.4 + 2.6 * frac, 2),               # diametro en px
        hexof(tint),                              # color
        round(0.18 + 0.30 * rnd.random(), 2),     # opacidad en el valle
        round(2.6 + 5.4 * rnd.random(), 2),       # segundos por ciclo
        round(-8.0 * rnd.random(), 2),            # desfase (negativo: ya arrancadas)
    ))

js = (
    "// GENERADO por tools/gen-starfield.py. No editar a mano.\n"
    "// Las estrellas que parpadean, en porcentaje del viewport.\n"
    "// Las dibuja Starfield.jsx; las quietas van en styles/starfield.svg.\n"
    "export const twinkling = [\n"
    + "".join(
        '  { x: %s, y: %s, d: %s, c: "%s", lo: %s, dur: %s, delay: %s },\n' % t
        for t in tw)
    + "];\n"
)
io.open('src/components/twinkling.js', 'w', encoding='utf-8', newline='\n').write(js)

print('estrellas:', N, ' halos:', len(bright), ' grupos:', len(parts), ' bytes svg:', len(svg))
print('titilan:', TITILAN, ' bytes js:', len(js))
