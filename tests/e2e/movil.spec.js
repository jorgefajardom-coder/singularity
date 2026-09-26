import { expect, test } from "@playwright/test";

/**
 * La pagina en los anchos de telefono que importan (320-412 y horizontal) y
 * en la pantalla de Jorge (1536x639). Lo que se comprueba es lo que ya se
 * rompio alguna vez en un telefono de verdad:
 *   - que se entra, el nombre se lee y no hay scroll horizontal;
 *   - que la barra cabe;
 *   - que no se abren mas contextos WebGL de los del presupuesto;
 *   - que si la GPU se cae la pagina sigue entera y usable.
 */

// Cuenta los contextos WebGL que la pagina crea y cuantos siguen vivos.
const CONTAR_CONTEXTOS = () => {
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

const esMovil = (info) => info.project.name.startsWith("movil");

async function entrar(page) {
  await page.addInitScript(CONTAR_CONTEXTOS);
  await page.goto("./");
  await page.locator('.loader[data-phase="choose"]').waitFor({ timeout: 45_000 });
  await page.locator(".loader__half--es").dispatchEvent("click");
  await page.locator(".loader").waitFor({ state: "detached", timeout: 45_000 });
}

const contextosVivos = (page) => page.evaluate(() => [...window.__gl.vivos].filter((c) => c.isConnected).length);

/** Baja la pagina entera con la rueda (Lenis ignora `scrollTo`). */
async function recorrer(page, alPaso) {
  await page.mouse.move(page.viewportSize().width / 2, page.viewportSize().height / 2);
  let antes = -1;
  let quieto = 0;
  for (let i = 0; i < 200 && quieto < 8; i++) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(250);
    if (alPaso) await alPaso();
    const y = await page.evaluate(() => window.scrollY);
    quieto = y === antes ? quieto + 1 : 0;
    antes = y;
  }
}

test("entra, el nombre se lee y no hay scroll horizontal", async ({ page }) => {
  await entrar(page);
  await expect(page.locator("h1")).toContainText("Jorge");
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }));
  expect(ancho.doc).toBeLessThanOrEqual(ancho.ventana);
});

test("la barra cabe y sus piezas no se pisan", async ({ page }) => {
  await entrar(page);
  const cajas = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    return { ancho: window.innerWidth, marca: r(".nav__mark"), controles: r(".nav__controls"), derecha: r(".nav__right") };
  });
  expect(cajas.marca.left).toBeGreaterThanOrEqual(0);
  expect(cajas.derecha.right).toBeLessThanOrEqual(cajas.ancho);
  expect(cajas.marca.right).toBeLessThanOrEqual(cajas.controles.left + 1);
  expect(cajas.controles.right).toBeLessThanOrEqual(cajas.derecha.left + 1);
  // Los controles no bajan de 36 px de alto: se tienen que poder tocar.
  expect(cajas.controles.height).toBeGreaterThanOrEqual(36);
});

/**
 * Regresion visual de la primera pantalla. Se hace con la GPU ya perdida: el
 * shader se mueve cada fotograma y no hay captura estable posible, mientras
 * que el respaldo CSS es quieto. De paso deja fijada la cara que ve quien no
 * tiene WebGL.
 */
test("captura de la primera pantalla sin GPU", async ({ page }) => {
  await entrar(page);
  expect(await perderGpu(page)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__gpuFallo ?? null)).not.toBeNull();
  await expect(page.locator(".stage__void .blackhole__fallback").first()).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page).toHaveScreenshot("primera-pantalla-sin-gpu.png", { animations: "disabled", maxDiffPixelRatio: 0.03 });
});

test("los contextos WebGL no pasan del presupuesto", async ({ page }, info) => {
  // WebGL por software es lento: recorrer la pagina entera lleva minutos.
  test.setTimeout(600_000);
  const tope = esMovil(info) ? 2 : 10;
  await entrar(page);
  let maximo = await contextosVivos(page);
  await recorrer(page, async () => { maximo = Math.max(maximo, await contextosVivos(page)); });
  expect(maximo).toBeLessThanOrEqual(tope);
  // Recorrer la pagina no puede dejar la GPU marcada como caida.
  expect(await page.evaluate(() => window.__gpuFallo ?? null)).toBeNull();
});

/** Pierde a proposito el contexto de todos los lienzos WebGL vivos. */
const perderGpu = (page) => page.evaluate(() => {
  let n = 0;
  for (const c of window.__gl.vivos) {
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    const ext = gl?.getExtension("WEBGL_lose_context");
    if (ext) { ext.loseContext(); n++; }
  }
  return n;
});

test("si la GPU se pierde, la pagina sigue entera y usable", async ({ page }) => {
  test.setTimeout(240_000);
  await entrar(page);
  const perdidos = await perderGpu(page);
  expect(perdidos).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__gpuFallo ?? null)).not.toBeNull();
  // El agujero pasa a su respaldo y el titular vuelve al DOM, legible.
  await expect(page.locator(".stage__void .blackhole__fallback")).toBeVisible();
  await expect(page.locator(".hero")).not.toHaveClass(/hero--lensed/);
  const tinta = await page.evaluate(() => getComputedStyle(document.querySelector(".hero__line")).color);
  expect(tinta).not.toMatch(/rgba\(.*,\s*0\)$/);
  // Ningun lienzo WebGL queda montado.
  await expect.poll(() => contextosVivos(page)).toBe(0);
  // Y el resto funciona: una ficha de Proyectos se abre.
  const boton = page.locator(".proj__btn").nth(1);
  await boton.scrollIntoViewIfNeeded();
  await boton.click();
  await expect(boton).toHaveAttribute("aria-expanded", "true");
});

test("las fichas cerradas no dejan enlaces enfocables", async ({ page }) => {
  await entrar(page);
  const enfocables = await page.evaluate(() => {
    const cerrados = [...document.querySelectorAll('.proj__row[data-open="false"] .proj__panel')];
    return cerrados.every((p) => p.inert);
  });
  expect(enfocables).toBe(true);
});
