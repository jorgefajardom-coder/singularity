"""Etapa 2 de 2: normaliza los logos en lienzos cuadrados con la misma
dimensión visible.

Lee lo que deja prepare-logos.py en tools/logos-src (marcas ya recortadas y en
gris) y escribe en public/images/clients, que es lo que consume el sitio.
Conserva la proporción de cada marca y su alfa original. Ejecutar desde la raíz:
    python tools/normalize-logos.py --preview
"""
from pathlib import Path
import sys
from PIL import Image

SRC = Path("tools/logos-src")
OUT = Path("public/images/clients")
HEIGHT = 512
VISIBLE = 430


def normalize(path):
    mark = Image.open(path).convert("RGBA")
    # Ignora residuos casi transparentes al medir el contorno visible.
    bounds = mark.getchannel("A").point(lambda a: 255 if a > 12 else 0).getbbox()
    if not bounds:
        raise ValueError(f"Logo vacío: {path}")
    mark = mark.crop(bounds)
    scale = VISIBLE / max(mark.size)
    size = tuple(max(1, round(side * scale)) for side in mark.size)
    mark = mark.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (HEIGHT, HEIGHT))
    # Sin máscara adicional: aplicarla otra vez eleva el alfa al cuadrado
    # y hace que los trazos suaves y las marcas grises pierdan presencia.
    canvas.paste(mark, ((HEIGHT - size[0]) // 2, (HEIGHT - size[1]) // 2))
    return canvas, size


def main():
    files = sorted(SRC.glob("*.png"))
    if not files:
        raise SystemExit(f"No hay logos en {SRC}")
    OUT.mkdir(parents=True, exist_ok=True)
    preview = Image.new("RGBA", (len(files) * 180 + 40, 200), (10, 9, 12, 255))
    for i, path in enumerate(files):
        canvas, size = normalize(path)
        # WebP con alfa: a calidad 90 pesa menos de la mitad que el PNG y el
        # error medio sobre el fondo del sitio no llega a 0,4 niveles de gris.
        canvas.save(OUT / path.with_suffix(".webp").name, "WEBP", quality=90, alpha_quality=100, method=6)
        print(f"{path.name}: marca {size}, lienzo {canvas.size}")
        shot = canvas.resize((144, 144), Image.Resampling.LANCZOS)
        preview.alpha_composite(shot, (38 + i * 180, 28))
    if "--preview" in sys.argv:
        preview.save("tools/logos-preview.png")


if __name__ == "__main__":
    main()
