import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas en navegador de verdad, contra el build de produccion (`vite
 * preview` sirve `dist/`). En local usan el Chrome instalado, sin descargar
 * navegadores; en CI, el Chromium de Playwright.
 *
 * WebGL headless: en local con la grafica real (d3d11); en CI por software,
 * que la pagina detecta y trata como si no hubiera GPU. Aqui no se mide
 * velocidad, sino que la pagina funcione, quepa y sobreviva sin GPU.
 */
const CI = Boolean(process.env.CI);
const PUERTO = 4173;

// Local: las DOS graficas del portatil a la vez. Chrome elige la Intel
// integrada por defecto; `--force_high_performance_gpu` le hace usar la
// NVIDIA, sin tocar ningun ajuste de Windows. Escritorio se queda en la Intel
// (es la que tiene casi cualquier visitante, ver la memoria de rendimiento);
// los telefonos van a la NVIDIA y asi no se pelean por la misma GPU.
const GPU_LOCAL = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
const conGpu = (extra = []) => (CI ? {} : { launchOptions: { args: [...GPU_LOCAL, ...extra] } });

const telefono = (nombre, width, height) => ({
  name: nombre,
  use: {
    ...devices["Pixel 7"],
    viewport: { width, height },
    screen: { width, height },
    ...conGpu(["--force_high_performance_gpu"]),
  },
});

export default defineConfig({
  testDir: "tests/e2e",
  timeout: CI ? 300_000 : 90_000,
  expect: { timeout: CI ? 60_000 : 20_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  fullyParallel: true,
  // Los runners de GitHub para repos publicos traen 4 nucleos: 3 navegadores
  // a la vez y uno libre para el servidor de preview.
  // En local, 16 hilos y dos graficas (ver `conGpu`): 4 navegadores. Ojo: el
  // 27-09-2026 tandas seguidas de estos, con scripts de medicion encima,
  // inflaron pagefile.sys hasta 52 GB y llenaron el disco. Mirar el espacio
  // libre antes de cada tanda y no lanzar otros navegadores a la vez.
  workers: CI ? 3 : 4,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PUERTO}/singularity/`,
    channel: CI ? undefined : "chrome",
    // En local, la GPU de verdad: asi se prueba el camino WebGL. En CI no hay
    // grafica y WebGL va por software, que la pagina trata como "sin GPU"
    // (ver lib/gpu.js): alli se prueba el camino de respaldo.
    launchOptions: {
      args: CI
        ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
    },
    trace: "retain-on-failure",
  },
  projects: [
    telefono("movil-320", 320, 640),
    telefono("movil-360", 360, 740),
    telefono("movil-375", 375, 812),
    telefono("movil-390", 390, 844),
    telefono("movil-412", 412, 915),
    telefono("movil-horizontal", 844, 390),
    { name: "escritorio", use: { viewport: { width: 1536, height: 639 }, ...conGpu() } },
  ],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}/singularity/`,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
