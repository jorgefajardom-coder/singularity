/**
 * Lo que comparten las pruebas de navegador (movil.spec.js, viaje.spec.js).
 */

// Cuenta los contextos WebGL que la pagina crea y cuantos siguen vivos.
export const CONTAR_CONTEXTOS = () => {
  const vivos = new Set();
  window.__gl = { vivos };
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (tipo, ...resto) {
    const ctx = original.call(this, tipo, ...resto);
    if (ctx && /webgl/.test(String(tipo)) && !this.__contado) {
      this.__contado = true;
      vivos.add(this);
      this.addEventListener("webglcontextlost", () => vivos.delete(this));
    }
    return ctx;
  };
};

export const esMovil = (info) => info.project.name.startsWith("movil");

// En CI el WebGL va por software en una maquina de dos nucleos: a 1536x639
// el shader del agujero y los seis del halo van a pocos fotogramas por
// segundo y la intro de 2 s tarda casi un minuto. Los tiempos se estiran
// alli; lo que se comprueba es lo mismo.
export const LENTO = process.env.CI ? 3 : 1;

/** ¿La pagina ya se dio por "sin GPU" (WebGL por software, en CI)? */
export const sinGpuYa = (page) => page.evaluate(() => /software|sin-gpu/.test(window.__gpuFallo || ""));

export async function entrar(page, ruta = "./") {
  await page.addInitScript(CONTAR_CONTEXTOS);
  await page.goto(ruta);
  await page.locator('.loader[data-phase="choose"]').waitFor({ timeout: 45_000 * LENTO });
  await page.locator(".loader__half--es").dispatchEvent("click");
  await page.locator(".loader").waitFor({ state: "detached", timeout: 45_000 * LENTO });
}

export const contextosVivos = (page) => page.evaluate(() => [...window.__gl.vivos].filter((c) => c.isConnected).length);

/** Pierde a proposito el contexto de todos los lienzos WebGL vivos. */
export const perderGpu = (page) => page.evaluate(() => {
  let n = 0;
  for (const c of window.__gl.vivos) {
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    const ext = gl?.getExtension("WEBGL_lose_context");
    if (ext) { ext.loseContext(); n++; }
  }
  return n;
});

