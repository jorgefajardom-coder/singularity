import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas en navegador de verdad, contra el build de produccion (`vite
 * preview` sirve `dist/`). En local usan el Chrome instalado, sin descargar
 * navegadores; en CI, el Chromium de Playwright.
 *
 * WebGL headless: con `--use-angle=swiftshader` pinta por software en
 * cualquier maquina (CI incluida). Es lento, pero aqui no se mide velocidad,
 * sino que la pagina funcione, quepa y sobreviva a perder la GPU.
 */
const CI = Boolean(process.env.CI);
const PUERTO = 4173;

const telefono = (nombre, width, height) => ({
  name: nombre,
  use: {
    ...devices["Pixel 7"],
    viewport: { width, height },
    screen: { width, height },
  },
});

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 20_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  fullyParallel: false,
  workers: CI ? 1 : 2,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PUERTO}/singularity/`,
    channel: CI ? undefined : "chrome",
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
    trace: "retain-on-failure",
  },
  projects: [
    telefono("movil-320", 320, 640),
    telefono("movil-360", 360, 740),
    telefono("movil-375", 375, 812),
    telefono("movil-390", 390, 844),
    telefono("movil-412", 412, 915),
    telefono("movil-horizontal", 844, 390),
    { name: "escritorio", use: { viewport: { width: 1536, height: 639 } } },
  ],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}/singularity/`,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
