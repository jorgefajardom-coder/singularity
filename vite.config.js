import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // El sitio se publica en GitHub Pages, en el repo `singularity`, asi que
  // cuelga de un subdirectorio y los assets tienen que apuntar ahi.
  //   repo `singularity`                 -> base: "/singularity/"
  //   repo `usuario.github.io`           -> base: "/"
  //   Vercel, Netlify o dominio propio   -> base: "/"
  base: "/singularity/",

  plugins: [react()],

  // El puerto puede venir del entorno: asi conviven varios servidores de dev.
  server: {
    port: Number(process.env.PORT) || 5191,
  },

  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // three.js y drei cambian poco: en chunks aparte el navegador
        // los cachea entre despliegues.
        manualChunks: {
          three: ["three"],
          r3f: ["@react-three/fiber", "@react-three/drei"],
          motion: ["gsap", "lenis"],
        },
      },
    },
  },
});
