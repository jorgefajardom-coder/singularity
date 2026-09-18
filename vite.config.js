import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages en usuario.github.io/portfolio-3d  -> base: "/portfolio-3d/"
  // Vercel, Netlify o dominio propio                -> base: "/"
  base: "/",

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
