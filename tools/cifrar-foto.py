"""Cifra la foto de perfil para la tarjeta del pie (Footer.jsx).

La foto NO se publica como imagen: el repositorio es publico y cualquier
rastreador que recorra imagenes (.jpg/.png/.webp) o etiquetas <img> se la
llevaria. Aqui se pasa a WebP y se mezcla byte a byte con una secuencia
pseudoaleatoria; el resultado no es una imagen valida para nadie que no lo
descifre. `src/lib/fotoProtegida.js` hace la operacion inversa y la pinta en
un <canvas>.

No es criptografia fuerte (la clave va en el bundle): es para que la foto no
se pueda enlazar, indexar ni recolectar en bloque. Una captura de pantalla
sigue siendo posible, y por eso el lienzo lleva marca de agua.

Uso:  python tools/cifrar-foto.py models-src/foto-perfil.png
La original vive en models-src/ (ignorado por git) y NO debe subirse.
"""
import io
import sys
from pathlib import Path

from PIL import Image

SEMILLA = 0x4A41464D  # "JAFM"
DESTINO = Path(__file__).resolve().parent.parent / "public" / "data" / "p.dat"


def flujo(n, semilla=SEMILLA):
    x = semilla
    out = bytearray(n)
    for i in range(n):
        x = (x * 1103515245 + 12345) & 0x7FFFFFFF
        out[i] = (x >> 16) & 0xFF
    return out


def main(origen):
    im = Image.open(origen).convert("RGB")
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=92, method=6)
    datos = buf.getvalue()
    clave = flujo(len(datos))
    cifrado = bytes(a ^ b for a, b in zip(datos, clave))
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_bytes(cifrado)
    print(f"{origen} {im.size} -> {DESTINO} ({len(cifrado)} bytes)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "models-src/foto-perfil.png")
