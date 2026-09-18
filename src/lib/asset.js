/**
 * Resuelve una ruta de /public respetando el `base` de Vite.
 *
 * Vite reescribe las rutas de lo que importa como módulo, pero NO las cadenas
 * que escribimos a mano en content.js ("/images/clients/miutab.png"). Al
 * publicar en un subdirectorio —GitHub Pages sirve este sitio en
 * /singularity/— esas rutas apuntarían a la raíz del dominio y todas las
 * imágenes, modelos y audio darían 404.
 *
 * Solo toca lo que empieza por "/": las URL completas (https://…), las de
 * objeto (blob:…) y las relativas se devuelven intactas.
 */
export const asset = (path) =>
  typeof path === "string" && path.startsWith("/")
    ? import.meta.env.BASE_URL + path.slice(1)
    : path;
