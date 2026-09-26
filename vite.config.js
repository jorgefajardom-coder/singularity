import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // El sitio se publica en GitHub Pages, en el repo `singularity`, asi que
  // cuelga de un subdirectorio y los assets tienen que apuntar ahi.
  // OJO: las rutas de Pages distinguen mayusculas. Esto tiene que coincidir
  // EXACTAMENTE con el nombre del repo.
  //   repo `singularity`                 -> base: "/singularity/"
  //   repo `usuario.github.io`           -> base: "/"
  //   Vercel, Netlify o dominio propio   -> base: "/"
  base: "/singularity/",

  plugins: [react()],

  // Vitest: solo la logica. Las pruebas en navegador (tests/e2e) son de
  // Playwright y se lanzan aparte (`npm run test:e2e`).
  test: {
    include: ["tests/unit/**/*.test.js"],
  },

  // El puerto puede venir del entorno: asi conviven varios servidores de dev.
  server: {
    port: Number(process.env.PORT) || 5191,
  },

  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Reparto por RUTA, no por nombre de paquete. Con la forma de objeto
        // (`{ r3f: ["@react-three/fiber"] }`) React acababa dentro del chunk
        // de r3f, que es quien depende de el, y entonces el entry tenia que
        // descargar y ejecutar 482 kB de r3f solo para arrancar: el infinito
        // del cargador, que es SVG puro, no podia pintarse hasta entonces.
        //
        // El orden importa: "@react-three" contiene "react", asi que va antes.
        manualChunks(id) {
          const file = id.split("\\").join("/");
          // El ayudante `__vitePreload` (el que carga los chunks diferidos) va
          // en su PROPIO chunk. Rollup lo colocaba dentro del de r3f, asi que
          // el entry hacia `import{_}from"./r3f-*.js"` solo para tener esa
          // funcion: 298 kB que habia que bajar y ejecutar para arrancar, y
          // three detras por orden de ejecucion. Es exactamente el problema
          // que este `manualChunks` venia a resolver, sobreviviendo escondido
          // en un import de una sola letra.
          if (file.includes("vite/preload-helper")) return "preload";
          if (!file.includes("node_modules")) return;
          if (file.includes("@react-three")) return "r3f";
          if (file.includes("node_modules/three/")) return "three";
          if (/node_modules\/(react|react-dom|scheduler)\//.test(file)) return "react";
          if (/node_modules\/(gsap|lenis)\//.test(file)) return "motion";
        },
      },
    },
  },
});
