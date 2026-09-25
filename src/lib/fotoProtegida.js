/**
 * La foto de perfil llega cifrada (ver tools/cifrar-foto.py): un archivo que
 * no es una imagen para nadie que lo descargue suelto. Aqui se descifra en
 * memoria y se pinta en un <canvas>, sin <img> ni URL de imagen que copiar,
 * enlazar o indexar. Encima va una marca de agua discreta con el nombre.
 */
const SEMILLA = 0x4a41464d; // "JAFM", la misma que en el script

function descifrar(bytes) {
  let x = SEMILLA;
  for (let i = 0; i < bytes.length; i++) {
    // Math.imul para multiplicar en 32 bits igual que Python con la mascara.
    x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff;
    bytes[i] ^= (x >>> 16) & 0xff;
  }
  return bytes;
}

let pendiente = null;

/** Descarga y descifra una sola vez, aunque haya varias tarjetas. */
function cargar() {
  pendiente ??= fetch(`${import.meta.env.BASE_URL}data/p.dat`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
    .then((buf) => createImageBitmap(new Blob([descifrar(new Uint8Array(buf))], { type: "image/webp" })));
  return pendiente;
}

/**
 * Pinta la foto en `canvas` recortada a su caja (como `object-fit: cover`) y
 * con la marca de agua. Devuelve una promesa que resuelve al pintar.
 */
export async function pintarFoto(canvas, marca) {
  const bmp = await cargar();
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  const s = Math.max(w / bmp.width, h / bmp.height);
  const dw = bmp.width * s;
  const dh = bmp.height * s;
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
  if (marca) {
    // Marca de agua: baja, pequena y semitransparente. No estorba al verla,
    // pero viaja con cualquier captura.
    g.save();
    g.font = `600 ${Math.round(9 * dpr)}px system-ui, sans-serif`;
    g.textAlign = "right";
    g.fillStyle = "rgba(255, 246, 238, 0.55)";
    g.shadowColor = "rgba(0, 0, 0, 0.45)";
    g.shadowBlur = 3 * dpr;
    g.fillText(marca, w - 8 * dpr, h - 8 * dpr);
    g.restore();
  }
}
