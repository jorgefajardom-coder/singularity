# -*- coding: utf-8 -*-
"""Recorta el fondo negro de una ilustracion y la guarda en WebP con alfa.

El fondo NO se quita por luminancia a secas: el traje tiene guantes, pelo y
sombras igual de oscuros que el fondo y saldrian agujereados. Se inunda desde
el borde sobre los pixeles oscuros, asi que solo desaparece el negro que esta
CONECTADO con el exterior. El alfa resultante se difumina un poco para que el
contorno no quede dentado.

    python tools/cutout-astronaut.py art/NOMBRE.png public/images/NOMBRE.webp
"""
import sys
from collections import deque

from PIL import Image, ImageFilter

UMBRAL = 26      # por encima de esto ya es figura
DIFUMINADO = 1.2  # radio del suavizado del contorno, en px
CALIDAD = 90


def recortar(origen, destino):
    im = Image.open(origen).convert('RGB')
    W, H = im.size
    px = im.load()

    fondo = bytearray(W * H)
    cola = deque()

    def sembrar(x, y):
        i = y * W + x
        if not fondo[i] and max(px[x, y]) < UMBRAL:
            fondo[i] = 1
            cola.append((x, y))

    for x in range(W):
        sembrar(x, 0)
        sembrar(x, H - 1)
    for y in range(H):
        sembrar(0, y)
        sembrar(W - 1, y)

    while cola:
        x, y = cola.popleft()
        if x > 0:
            sembrar(x - 1, y)
        if x < W - 1:
            sembrar(x + 1, y)
        if y > 0:
            sembrar(x, y - 1)
        if y < H - 1:
            sembrar(x, y + 1)

    alfa = Image.frombytes('L', (W, H), bytes(255 if not b else 0 for b in fondo))
    alfa = alfa.filter(ImageFilter.GaussianBlur(DIFUMINADO))
    im.putalpha(alfa)
    im.save(destino, 'WEBP', quality=CALIDAD, method=6)

    recortados = sum(fondo)
    print('%s -> %s' % (origen, destino))
    print('  fondo recortado: %.1f %% de la imagen' % (100.0 * recortados / (W * H)))


if __name__ == '__main__':
    recortar(sys.argv[1], sys.argv[2])
