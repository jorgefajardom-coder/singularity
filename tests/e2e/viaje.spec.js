import { expect, test } from "@playwright/test";
import { LENTO, entrar, esMovil, perderGpu, sinGpuYa } from "./comun.js";

/**
 * EL VIAJE DEL AGUJERO Y LO QUE VA PEGADO A EL.
 *
 * Lo que se probaba a ojo y se rompia sin avisar:
 *   - que la orbita no asome dentro del hero;
 *   - que el agujero no se escape de sitio con scroll brusco de ida y vuelta;
 *   - que anillos, marcas y agujero compartan centro en todo el recorrido;
 *   - que girar el telefono a mitad de la orbita no deje geometria vieja;
 *   - que abrir y cerrar Proyectos no haga vibrar el scroll;
 *   - que un scroll rapido no despegue los modelos 3D de su hueco;
 *   - que dron y celda enseñen el mismo aviso de carga;
 *   - que volver de segundo plano con el contexto perdido degrade limpio.
 *
 * El estado del viaje se lee de `window.__viaje` (ver Stage.jsx).
 */

const viaje = (page) => page.evaluate(() => ({ ...window.__viaje.current }));

/** Rueda hasta que el progreso de la orbita quede cerca de `objetivo`. */
async function irAOrbita(page, objetivo) {
  const alto = await page.evaluate(() => document.querySelector(".orbit").offsetHeight);
  await page.mouse.move(page.viewportSize().width / 2, page.viewportSize().height / 2);
  for (let i = 0; i < 8; i++) {
    const { p } = await viaje(page);
    if (Math.abs(p - objetivo) < 0.02) break;
    await page.mouse.wheel(0, (objetivo - p) * alto);
    await page.waitForTimeout(1300);
  }
  await page.waitForTimeout(300);
  return viaje(page);
}

/** Anillos DOM contra el centro del agujero, con el marco del lienzo. */
const centros = (page) => page.evaluate(() => {
  const j = window.__viaje.current;
  const lienzo = document.querySelector(".stage__void");
  const w = lienzo.clientWidth, h = lienzo.clientHeight;
  const anillo = document.querySelector(".orbit__rings ellipse");
  return {
    esperado: { x: w * (0.5 + 0.5 * j.cx), y: h * (0.5 - 0.5 * j.cy) },
    anillo: { x: Number(anillo.getAttribute("cx")), y: Number(anillo.getAttribute("cy")) },
    w, h,
  };
});

/** La matriz del lienzo que viaja, como numeros. */
const matrizViajero = (page) => page.evaluate(() => {
  const t = getComputedStyle(document.querySelector(".stage__traveler")).transform;
  if (!t || t === "none") return [1, 0, 0, 1, 0, 0];
  const m = t.match(/matrix(3d)?\(([^)]+)\)/);
  const v = m[2].split(",").map(Number);
  return m[1] ? [v[0], v[1], v[4], v[5], v[12], v[13]] : v;
});

/**
 * Luminancia de una captura de pantalla, leida en la propia pagina (Playwright
 * no decodifica PNG). Devuelve una funcion de consulta serializada: se usa
 * dentro de `evaluate`.
 */
async function pixeles(page) {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const escala = img.width / innerWidth;
    window.__lum = (x, y) => {
      const i = (Math.round(y * escala) * c.width + Math.round(x * escala)) * 4;
      return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    };
    return true;
  }, png);
}

test("la orbita no asoma dentro del hero", async ({ page }) => {
  await entrar(page);
  await page.mouse.move(page.viewportSize().width / 2, page.viewportSize().height / 2);
  for (let i = 0; i < 12; i++) {
    const estado = await page.evaluate(() => ({
      fuera: window.__viaje.current.heroOut,
      visible: document.querySelector(".orbit__hud").style.visibility,
      opacidad: Math.max(...[...document.querySelectorAll(".orbiter")].map((n) => Number(n.style.opacity || 0))),
    }));
    // Hasta que el 30 % del hero ha salido no hay orbita: ni capa ni marcas.
    if (estado.fuera < 0.29) {
      expect(estado.visible, `heroOut ${estado.fuera}`).not.toBe("visible");
      expect(estado.opacidad).toBe(0);
    } else break;
    await page.mouse.wheel(0, 60);
    await page.waitForTimeout(250);
  }
});

test("el agujero no se escapa con scroll brusco de ida y vuelta", async ({ page }) => {
  test.setTimeout(240_000 * LENTO);
  await entrar(page);
  const reposo = await viaje(page);
  const { width: W, height: H } = page.viewportSize();
  await page.mouse.move(W / 2, H / 2);
  for (let i = 0; i < 16; i++) {
    await page.mouse.wheel(0, i % 2 ? -2600 : 3400);
    await page.waitForTimeout(90);
    const j = await viaje(page);
    for (const k of ["cx", "cy", "scale", "topDown", "p"]) expect(Number.isFinite(j[k]), `${k} = ${j[k]}`).toBe(true);
    expect(j.scale).toBeGreaterThan(0.2);
    expect(j.scale).toBeLessThan(10);
    expect(Math.abs(j.cy)).toBeLessThanOrEqual(1.5);
    const [a, , , d, tx, ty] = await matrizViajero(page);
    for (const v of [a, d, tx, ty]) expect(Number.isFinite(v)).toBe(true);
    expect(Math.abs(tx)).toBeLessThanOrEqual(2 * W + 1);
    expect(Math.abs(ty)).toBeLessThanOrEqual(4 * H + 1);
  }
  // De vuelta arriba, el agujero esta EXACTAMENTE donde empezo.
  for (let i = 0; i < 30 && (await page.evaluate(() => scrollY)) > 0; i++) {
    await page.mouse.wheel(0, -6000);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1500);
  const final = await viaje(page);
  expect(final.p).toBe(0);
  expect(final.cy).toBeCloseTo(reposo.cy, 3);
  expect(final.scale).toBeCloseTo(reposo.scale, 3);
  const [a, , , d, tx, ty] = await matrizViajero(page);
  expect([a, d, tx, ty]).toEqual([1, 1, 0, 0]);
});

test("anillos, marcas y agujero comparten centro en toda la orbita", async ({ page }) => {
  test.setTimeout(180_000 * LENTO);
  await entrar(page);
  const gpu = !(await sinGpuYa(page));
  for (const objetivo of [0.3, 0.45, 0.62, 0.8]) {
    await irAOrbita(page, objetivo);
    const c = await centros(page);
    expect(Math.abs(c.anillo.x - c.esperado.x), `p=${objetivo}`).toBeLessThanOrEqual(1);
    expect(Math.abs(c.anillo.y - c.esperado.y), `p=${objetivo}`).toBeLessThanOrEqual(1);
    // Vista cenital con la GPU de verdad: el centro de la sombra PINTADA por
    // el shader, medido en pixeles, cae en el centro de los anillos. De canto
    // no vale: el disco tapa la mitad de abajo de la sombra.
    const j = await viaje(page);
    if (!gpu || j.topDown < 0.97 || j.fall > 0.05) continue;
    await pixeles(page);
    const medido = await page.evaluate(({ x, y }) => {
      const oscuro = (px, py) => window.__lum(px, py) < 28;
      if (!oscuro(x, y)) return null;
      const tramo = (dx, dy) => { let n = 0; while (n < 400 && oscuro(x + dx * (n + 1), y + dy * (n + 1))) n++; return n; };
      const iz = tramo(-1, 0), de = tramo(1, 0), ar = tramo(0, -1), ab = tramo(0, 1);
      return { x: x + (de - iz) / 2, y: y + (ab - ar) / 2, r: (iz + de + ar + ab) / 4 };
    }, c.anillo);
    expect(medido, "el centro de los anillos no cae dentro de la sombra").not.toBeNull();
    // La vista "cenital" es de 80 grados, no 90 (a 90 la camara del shader
    // degenera): la sombra todavia sale un poco corrida del centro del
    // agujero, proporcional a su radio (medido: 6,5 px con 26 de radio en 320).
    const tolerancia = Math.max(6, 0.35 * medido.r);
    expect(Math.abs(medido.x - c.anillo.x)).toBeLessThanOrEqual(tolerancia);
    expect(Math.abs(medido.y - c.anillo.y)).toBeLessThanOrEqual(tolerancia);
  }
});

test("girar el telefono con la orbita activa rehace la geometria", async ({ page }, info) => {
  test.skip(info.project.name !== "movil-390", "basta con un telefono");
  test.setTimeout(180_000 * LENTO);
  await entrar(page);
  await irAOrbita(page, 0.45);
  for (const [w, h] of [[844, 390], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(900);
    const j = await viaje(page);
    for (const k of ["cx", "cy", "scale", "topDown"]) expect(Number.isFinite(j[k])).toBe(true);
    const c = await centros(page);
    expect(c.w).toBe(w);
    expect(Math.abs(c.anillo.x - c.esperado.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(c.anillo.y - c.esperado.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(c.anillo.x - w / 2)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
  }
});

/** Registra scrollY y la caja del boton en cada fotograma durante `ms`. */
const grabar = (page, selector, ms) => page.evaluate(({ selector, ms }) => new Promise((resolve) => {
  const boton = document.querySelector(selector);
  const muestras = [];
  const fin = performance.now() + ms;
  // Se mide con lo ya maquetado del fotograma (tras los rAF y los
  // ResizeObserver de la pagina), que es lo que se pinta: medir dentro de un
  // rAF propio leia el estado de ANTES de la correccion de Projects.
  const paso = () => {
    new ResizeObserver((_, o) => {
      o.disconnect();
      muestras.push({ y: scrollY, top: boton.getBoundingClientRect().top });
    }).observe(document.body);
    if (performance.now() < fin) requestAnimationFrame(paso); else setTimeout(() => resolve(muestras), 50);
  };
  requestAnimationFrame(paso);
}), { selector, ms });

function sinVibrar(muestras) {
  const top0 = muestras[0].top;
  const deriva = Math.max(...muestras.slice(2).map((m) => Math.abs(m.top - top0)));
  let cambios = 0, signo = 0;
  for (let i = 1; i < muestras.length; i++) {
    const d = muestras[i].y - muestras[i - 1].y;
    if (Math.abs(d) < 0.5) continue;
    if (signo && Math.sign(d) !== signo) cambios++;
    signo = Math.sign(d);
  }
  return { deriva, cambios };
}

test("abrir y cerrar Proyectos no hace vibrar el scroll", async ({ page }) => {
  test.setTimeout(120_000 * LENTO);
  await entrar(page);
  const selector = "#proj-btn-2";
  const boton = page.locator(selector);
  await boton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  for (const esperado of ["true", "false"]) {
    // Durante el plegado (0,9 s) el boton tocado se queda bajo el dedo y el
    // scroll no va y viene. Despues, al ABRIR, la pagina puede deslizarse a
    // proposito para encuadrar el visor (ver `encuadrar` en Projects.jsx).
    const grabacion = grabar(page, selector, 850);
    await boton.click();
    const r = sinVibrar(await grabacion);
    await expect(boton).toHaveAttribute("aria-expanded", esperado);
    expect(r.deriva, `deriva al ${esperado === "true" ? "abrir" : "cerrar"}`).toBeLessThanOrEqual(6);
    expect(r.cambios).toBeLessThanOrEqual(1);
    // Hasta que la pagina este quieta DE VERDAD (0,6 s sin moverse), no un
    // tiempo fijo: con varios navegadores a la vez, montar la celda congela
    // la pagina ~3 s y el plegado y el encuadre llegaban despues; el siguiente
    // clic caia en mitad de ellos y se media como vibracion.
    await page.waitForFunction(() => new Promise((ok) => {
      let y = scrollY, t = performance.now();
      const f = () => {
        if (Math.abs(scrollY - y) > 0.5) { y = scrollY; t = performance.now(); }
        if (performance.now() - t > 600) ok(true); else requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }), null, { timeout: 30_000 * LENTO });
    if (esperado === "true") {
      // El visor abierto se ve (Jorge, 27-09-2026: al abrir la celda la
      // pagina se quedaba donde no se veia). Solo cuando el visor va arriba
      // en la ficha; en pantalla estrecha va tras el texto y no se salta.
      const v = await page.evaluate((sel) => {
        const panel = document.querySelector(sel).closest(".proj__row").querySelector(".proj__panel");
        const visor = panel.querySelector(".modelo, .producto");
        if (!visor) return null;
        const r = visor.getBoundingClientRect(), pr = panel.getBoundingClientRect();
        return { arribaEnFicha: r.top - pr.top <= innerHeight * 0.3, top: r.top, bottom: r.bottom, alto: innerHeight };
      }, selector);
      if (v?.arribaEnFicha) {
        expect(v.top, "el visor empieza dentro de la pantalla").toBeGreaterThanOrEqual(0);
        // La zona 3D entera; el rotulo de abajo del visor puede quedar fuera.
        expect(v.bottom - 90, "la zona 3D del visor se ve").toBeLessThanOrEqual(v.alto);
      }
    }
  }
});

test("un scroll rapido no despega el dron de su hueco", async ({ page }) => {
  test.setTimeout(180_000 * LENTO);
  await entrar(page);
  test.skip(await sinGpuYa(page), "sin GPU no hay modelo que despegar");
  const hueco = page.locator(".producto__hueco").first();
  await hueco.scrollIntoViewIfNeeded();
  await expect(page.locator('.producto[data-listo="true"]')).toBeVisible({ timeout: 60_000 * LENTO });
  const { width: W, height: H } = page.viewportSize();
  await page.mouse.move(W / 2, H / 2);
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, i % 2 ? -700 : 700);
    await page.waitForTimeout(40);
  }
  await hueco.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  const caja = await hueco.boundingBox();
  await pixeles(page);
  // Lo que brilla alrededor del hueco (el dron) tiene su centro DENTRO del
  // hueco: un lienzo que va un fotograma por detras lo dejaria corrido.
  const centro = await page.evaluate((b) => {
    let sx = 0, sy = 0, n = 0;
    const x0 = Math.max(0, b.x - b.width * 0.5), x1 = Math.min(innerWidth - 1, b.x + b.width * 1.5);
    const y0 = Math.max(0, b.y - b.height * 0.5), y1 = Math.min(innerHeight - 1, b.y + b.height * 1.5);
    for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) {
      if (window.__lum(x, y) > 60) { sx += x; sy += y; n++; }
    }
    return n ? { x: sx / n, y: sy / n, n } : null;
  }, caja);
  expect(centro).not.toBeNull();
  expect(centro.x).toBeGreaterThanOrEqual(caja.x);
  expect(centro.x).toBeLessThanOrEqual(caja.x + caja.width);
  expect(centro.y).toBeGreaterThanOrEqual(caja.y);
  expect(centro.y).toBeLessThanOrEqual(caja.y + caja.height);
  expect(await page.evaluate(() => window.__gpuFallo ?? null)).toBeNull();
});

test("dron y celda enseñan el mismo aviso de carga", async ({ page }, info) => {
  test.skip(!["movil-375", "escritorio"].includes(info.project.name), "un telefono y el escritorio bastan");
  test.setTimeout(180_000 * LENTO);
  // Los .glb tardan: asi da tiempo a ver el aviso.
  await page.route(/\/models\/.*\.glb/, async (route) => {
    await new Promise((r) => setTimeout(r, 6000));
    await route.continue();
  });
  await entrar(page);
  const dron = page.locator(".producto").first();
  await dron.scrollIntoViewIfNeeded();
  // El mismo componente en los dos: misma clase y el mismo papel para los
  // lectores. Se mira mientras se ve (el del dron se va al llegar el modelo).
  const comprobar = async (aviso) => {
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveClass(/carga3d/);
    await expect(aviso).toHaveAttribute("role", "status");
  };
  await comprobar(dron.locator('[data-testid="loader-3d"]').first());
  await page.locator("#proj-btn-2").click();
  // Por la ficha y no por `.modelo`: el hueco que espera al chunk y el visor
  // de verdad son dos nodos distintos, y los dos tienen que llevar el aviso.
  const celda = page.locator("#proj-panel-2");
  await page.locator("#proj-btn-2").scrollIntoViewIfNeeded();
  await comprobar(celda.locator('[data-testid="loader-3d"]').first());
});

test("volver de segundo plano con el contexto perdido degrada limpio", async ({ page }, info) => {
  test.setTimeout(180_000 * LENTO);
  await entrar(page);
  test.skip(await sinGpuYa(page), "sin WebGL por hardware no hay contexto que perder");
  await irAOrbita(page, 0.35);
  // Se va a segundo plano, el sistema le quita los contextos y vuelve.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await perderGpu(page)).toBeGreaterThan(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => page.evaluate(() => window.__gpuFallo ?? null), { timeout: 20_000 * LENTO }).not.toBeNull();
  await expect(page.locator(".stage__void .blackhole__fallback").first()).toBeAttached();
  // Sin descuadres: anillos con el agujero, lienzo con un transform valido y
  // las marcas siguen en su orbita (con las esferas de respaldo).
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(800);
  const c = await centros(page);
  expect(Math.abs(c.anillo.x - c.esperado.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(c.anillo.y - c.esperado.y)).toBeLessThanOrEqual(1);
  for (const v of await matrizViajero(page)) expect(Number.isFinite(v)).toBe(true);
  const opacidad = await page.evaluate(() => Math.max(...[...document.querySelectorAll(".orbiter")].map((n) => Number(n.style.opacity || 0))));
  expect(opacidad).toBeGreaterThan(0);
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(page.viewportSize().width);
  if (esMovil(info)) expect(await page.locator("h1").textContent()).toContain("Jorge");
});

test("anclar la escena no despega el marco del agujero", async ({ page }) => {
  // Al desplegarse las galaxias la escena se ancla (Halo.jsx). Con el
  // `overflow: hidden` en el body, el marco sticky del agujero dejaba de
  // pegarse y el agujero de las manos desaparecia (su lienzo en y = -2687).
  await entrar(page);
  await page.mouse.move(page.viewportSize().width / 2, page.viewportSize().height / 2);
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(1500);
  const antes = await page.evaluate(() => document.querySelector(".stage__void").getBoundingClientRect().top);
  const anclado = await page.evaluate(async () => {
    document.body.classList.add("is-anchored");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const top = document.querySelector(".stage__void").getBoundingClientRect().top;
    document.body.classList.remove("is-anchored");
    return top;
  });
  expect(Math.abs(anclado - antes)).toBeLessThanOrEqual(1);
});

test("la intro no apaga el infinito antes de que su lienzo este listo", async ({ page }) => {
  test.setTimeout(120_000 * LENTO);
  await page.addInitScript(() => {
    window.__fases = [];
    new MutationObserver(() => {
      const fase = document.querySelector(".loader")?.dataset.phase;
      if (fase && window.__fases.at(-1)?.fase !== fase) {
        window.__fases.push({ fase, preparado: Boolean(window.__introPreparado), gpu: window.__gpuFallo ?? null });
      }
    }).observe(document, { subtree: true, attributes: true, childList: true });
  });
  await page.goto("./");
  await page.locator('.loader[data-phase="choose"]').waitFor({ timeout: 45_000 * LENTO });
  // Se pulsa en cuanto aparece el selector: es el caso que salia en negro.
  await page.locator(".loader__half--es").dispatchEvent("click");
  await page.locator(".loader").waitFor({ state: "detached", timeout: 45_000 * LENTO });
  const fases = await page.evaluate(() => window.__fases);
  const t = fases.find((f) => f.fase === "transforming");
  expect(t, JSON.stringify(fases)).toBeTruthy();
  // O el lienzo ya estaba listo, o no hay GPU / se acabo la espera y la
  // intro fue con el disco CSS: nunca el ∞ apagandose sobre un negro.
  const css = await page.evaluate(() => Boolean(document.querySelector(".loader__disco")) || Boolean(window.__gpuFallo));
  expect(t.preparado || t.gpu !== null || css, JSON.stringify(fases)).toBe(true);
  await expect(page.locator("h1")).toContainText("Jorge");
});
