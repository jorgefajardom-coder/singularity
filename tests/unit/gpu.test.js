import { describe, expect, it, vi } from "vitest";
import { PRESUPUESTO, calcularPerfil, gpuFallo, marcarGpuFallo, vigilarContexto } from "../../src/lib/gpu.js";

/** Una ventana de mentira con lo que mira `calcularPerfil`. */
function ventana({ ua = "", coarse = false, fine = true, w = 1920, h = 1080, memoria, nucleos, red = {} } = {}) {
  return {
    matchMedia: (q) => ({ matches: q === "(pointer: coarse)" ? coarse : q === "(any-pointer: fine)" ? fine : false }),
    screen: { width: w, height: h },
    navigator: { userAgent: ua, deviceMemory: memoria, hardwareConcurrency: nucleos, connection: red },
  };
}

describe("perfil del aparato", () => {
  it("un escritorio no es movil", () => {
    expect(calcularPerfil(ventana()).movil).toBe(false);
  });

  it("un Android es movil aunque este en horizontal (900 px de ancho)", () => {
    const p = calcularPerfil(ventana({ ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile", coarse: true, fine: false, w: 900, h: 412 }));
    expect(p.movil).toBe(true);
  });

  it("tactil con pantalla pequena es movil aunque el agente no lo diga", () => {
    expect(calcularPerfil(ventana({ coarse: true, fine: false, w: 390, h: 844 })).movil).toBe(true);
  });

  it("un portatil tactil con raton no es movil", () => {
    expect(calcularPerfil(ventana({ coarse: true, fine: true, w: 1366, h: 768 })).movil).toBe(false);
  });

  it("ahorro de datos y 3G cuentan como datos caros", () => {
    expect(calcularPerfil(ventana({ red: { saveData: true } })).datosCaros).toBe(true);
    expect(calcularPerfil(ventana({ red: { effectiveType: "3g" } })).datosCaros).toBe(true);
    expect(calcularPerfil(ventana({ red: { effectiveType: "slow-2g" } })).datosCaros).toBe(true);
    expect(calcularPerfil(ventana({ red: { effectiveType: "4g" } })).datosCaros).toBe(false);
  });

  it("memoria baja por debajo de 4 GB", () => {
    expect(calcularPerfil(ventana({ memoria: 2 })).memoriaBaja).toBe(true);
    expect(calcularPerfil(ventana({ memoria: 8 })).memoriaBaja).toBe(false);
  });

  it("sin ventana (servidor) devuelve un perfil de escritorio", () => {
    expect(calcularPerfil(undefined).movil).toBe(false);
  });
});

describe("presupuesto", () => {
  it("el telefono va a densidad 1 como mucho y con menos pasos por rayo", () => {
    expect(PRESUPUESTO.dprMovil).toBeLessThanOrEqual(1);
    expect(PRESUPUESTO.pasosAgujero.movil).toBeLessThan(PRESUPUESTO.pasosAgujero.escritorio);
    expect(PRESUPUESTO.contextos.movil).toBeLessThanOrEqual(2);
  });
});

describe("fallo de la GPU", () => {
  it("la perdida de contexto de un lienzo marca la GPU como caida, una sola vez", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const lienzo = new EventTarget();
    const soltar = vigilarContexto(lienzo, "prueba");
    expect(gpuFallo()).toBe(false);
    lienzo.dispatchEvent(new Event("webglcontextlost"));
    expect(gpuFallo()).toBe(true);
    marcarGpuFallo("otra vez");
    expect(aviso).toHaveBeenCalledTimes(1);
    soltar();
    aviso.mockRestore();
  });
});
