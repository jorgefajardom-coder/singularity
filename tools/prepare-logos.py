# -*- coding: utf-8 -*-
"""
Prepara los logos de clientes para la tira de "Empresas".

El problema: cada logo viene con un fondo distinto (blanco, negro, azul).
Sobre un sitio oscuro, poner un simple grayscale deja unos cuadrados
blancos que deslumbran y otros que desaparecen. Nunca queda parejo.

La solucion: sacar el fondo de cada uno y dejar la marca en un mismo gris
claro. Para eso NO usamos el brillo del pixel, sino su distancia al color
de fondo, que detectamos mirando las esquinas. Asi funciona igual con un
logo oscuro sobre blanco que con uno claro sobre negro, y los tonos
intermedios (el dorado de Uniagustiniana) no salen medio transparentes.

Uso:  python tools/prepare-logos.py
"""
import os

from PIL import Image

DL = r"C:\Users\J.A.F.M\Downloads"
OUT = os.path.join("public", "images", "clients")
SIZE = 512

# Gris claro comun para todas las marcas
INK = (243, 242, 238)

# Por debajo de esto se considera fondo (mata el ruido del JPEG)
FLOOR = 20
# Por encima de esto, opacidad total
CEIL = 90

os.makedirs(OUT, exist_ok=True)

LOGOS = [
    ("Icon Marketing logo.jpg", "be-an-icon.png"),
    ("miutab logo.jpg", "miutab.png"),
    ("Escudo-uniagustiniana.png", "uniagustiniana.png"),
    ("franco\u00b4s logo.jpg", "francos-photography.png"),
    ("khronos Ink.jpg", "khronos-ink.png"),
]


def lum(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def background_color(im):
    """Color de fondo = mediana de las cuatro esquinas."""
    w, h = im.size
    m = max(2, min(w, h) // 40)
    corners = [
        im.getpixel((m, m)),
        im.getpixel((w - 1 - m, m)),
        im.getpixel((m, h - 1 - m)),
        im.getpixel((w - 1 - m, h - 1 - m)),
    ]
    return tuple(sorted(c[i] for c in corners)[1] for i in range(3))


for src_name, out_name in LOGOS:
    src = os.path.join(DL, src_name)
    if not os.path.exists(src):
        print("FALTA:", src_name)
        continue

    im = Image.open(src)

    # Un PNG con transparencia ya trae el fondo quitado: lo componemos
    # sobre blanco para tratarlo igual que los demas
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        base = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(base, im)

    im = im.convert("RGB")
    if max(im.size) > SIZE:
        im.thumbnail((SIZE, SIZE), Image.LANCZOS)

    br, bg_, bb = background_color(im)
    bg_light = lum(br, bg_, bb) > 128

    w, h = im.size
    px = im.load()

    # Primera pasada: alfa (distancia al fondo) y valor de gris.
    # El gris NO es plano: sale de invertir la luminancia en los logos
    # sobre blanco y de conservarla en los que van sobre negro. Asi el
    # escudo de Uniagustiniana mantiene su relieve en vez de quedar
    # como una mancha solida.
    alpha = [[0] * w for _ in range(h)]
    value = [[0] * w for _ in range(h)]
    vmax = 1

    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = max(abs(r - br), abs(g - bg_), abs(b - bb))
            if d <= FLOOR:
                continue

            a = 255 if d >= CEIL else int((d - FLOOR) / (CEIL - FLOOR) * 255)
            l = lum(r, g, b)
            v = (255 - l) if bg_light else l

            alpha[y][x] = a
            value[y][x] = v
            if a > 128 and v > vmax:
                vmax = v

    # Segunda pasada: estiramos el rango para que la marca llegue al blanco
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dst = out.load()

    for y in range(h):
        for x in range(w):
            a = alpha[y][x]
            if not a:
                continue
            k = min(1.0, value[y][x] / vmax) ** 0.75
            g = int(60 + k * (INK[0] - 60))
            dst[x, y] = (g, g, g, a)

    out.save(os.path.join(OUT, out_name))
    print(
        "%-26s -> %-24s fondo=%s %s %s"
        % (src_name, out_name, (br, bg_, bb), "claro" if bg_light else "oscuro", out.size)
    )
