import { useSyncExternalStore } from "react";

/**
 * PERFIL DE RENDIMIENTO Y ESTADO DE LA GPU, EN UN SOLO SITIO.
 *
 * Dos cosas que antes se mezclaban en `useTelefono` (el corte de 600 px de la
 * hoja de estilos):
 *
 *   - como se MAQUETA la pagina: eso sigue siendo cosa del ancho CSS
 *     (lib/telefono.js y las `@media`).
 *   - cuanto 3D AGUANTA el aparato: eso no lo dice el ancho. Un telefono en
 *     horizontal mide 800-900 px y pasaba por escritorio, con seis agujeros
 *     WebGL y el lienzo a densidad 2. Aqui se mira el aparato: puntero tactil,
 *     lado corto de la PANTALLA (no de la ventana, asi no cambia al girarlo),
 *     el agente de usuario, la memoria y la red.
 *
 * El perfil se calcula una vez por visita: un telefono no deja de serlo al
 * girarlo, y cambiar de perfil a media pagina obligaria a rehacer lienzos.
 */
export function calcularPerfil(win = typeof window === "undefined" ? undefined : window) {
  if (!win) {
    return { movil: false, datosCaros: false, memoriaBaja: false, nucleosPocos: false };
  }
  const mm = (q) => { try { return win.matchMedia(q).matches; } catch { return false; } };
  const nav = win.navigator || {};
  const tactil = mm("(pointer: coarse)") && !mm("(any-pointer: fine)");
  const lado = Math.min(win.screen?.width || 9999, win.screen?.height || 9999);
  const agente = nav.userAgentData?.mobile === true
    || /Android|iPhone|iPod|Mobile|Windows Phone/i.test(nav.userAgent || "");
  const red = nav.connection || {};
  const memoria = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  const nucleos = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null;
  return {
    // Telefono: por agente o por tacto + pantalla pequena. Una tableta con
    // teclado (puntero fino) o un portatil tactil no entran.
    movil: agente || (tactil && lado <= 600),
    // Ahorro de datos o red lenta: nada de descargas de megabytes sin pedirlas.
    datosCaros: Boolean(red.saveData) || /(^|-)(2g|3g)$/.test(red.effectiveType || ""),
    memoriaBaja: memoria !== null && memoria < 4,
    nucleosPocos: nucleos !== null && nucleos <= 4,
  };
}

export const perfil = calcularPerfil();

/**
 * Presupuesto de rendimiento. No es decorativo: lo leen el codigo (densidad,
 * pasos del shader) y las pruebas (tests/movil.spec.js), que fallan si la
 * pagina se sale de el.
 */
export const PRESUPUESTO = {
  // Fotograma objetivo: 60 fps en escritorio, 30 en telefono.
  fotogramaMs: { escritorio: 16.7, movil: 33.3 },
  // Lienzos WebGL vivos a la vez como maximo, con la pagina ya recorrida.
  contextos: { escritorio: 10, movil: 2 },
  // Densidad maxima de los lienzos 3D en telefono.
  dprMovil: 1,
  // Pasos por rayo del agujero negro.
  pasosAgujero: { escritorio: 180, movil: 128 },
  // Peso maximo de un modelo que se precarga sin que nadie lo pida (MB).
  precargaMaxMB: { escritorio: 20, movil: 5 },
};

/**
 * ¿Ha fallado la GPU en esta visita?
 *
 * Un lienzo que pierde el contexto o pinta blanco rara vez es un caso
 * aislado: en movil el navegador suelta contextos cuando hay demasiados, y
 * suelta primero los mas viejos. Degradar solo el lienzo que cayo dejaba a
 * los demas en la cola para caer despues, uno a uno, con un destello cada
 * vez. Aqui el primero que cae lo marca y TODAS las escenas WebGL pasan a su
 * respaldo DOM/CSS a la vez, hasta que se recargue la pagina. No se intenta
 * reconstruir tras `webglcontextrestored`: un estado a medias (unos lienzos
 * vueltos, otros no, texturas sin subir) es peor que un respaldo estable.
 */
let fallo = false;
let motivoFallo = null;
const oyentes = new Set();

export function marcarGpuFallo(motivo = "desconocido") {
  if (fallo) return;
  fallo = true;
  motivoFallo = motivo;
  // Se registra: si la pagina degrada, que quede rastro de por que.
  console.warn(`[singularity] 3D desactivado en esta visita: ${motivo}`);
  if (typeof window !== "undefined") window.__gpuFallo = motivo;
  oyentes.forEach((f) => f());
}

export const gpuFallo = () => fallo;
export const gpuMotivo = () => motivoFallo;

const suscribir = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
const leer = () => fallo;

/** true en cuanto cualquier lienzo WebGL de la pagina ha fallado. */
export function useGpuFallo() {
  return useSyncExternalStore(suscribir, leer, leer);
}

/**
 * Engancha la perdida de contexto de un lienzo al estado global. Devuelve la
 * funcion que desengancha. `preventDefault` NO se llama a proposito: no se
 * quiere que el navegador intente devolver el contexto (ver arriba).
 */
export function vigilarContexto(canvas, nombre) {
  if (!canvas) return () => {};
  const perdido = () => marcarGpuFallo(`contexto perdido (${nombre})`);
  canvas.addEventListener("webglcontextlost", perdido);
  return () => canvas.removeEventListener("webglcontextlost", perdido);
}
