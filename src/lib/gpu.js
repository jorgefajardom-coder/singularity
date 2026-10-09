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
 * La red AHORA, no al cargar la pagina. El resto del perfil no cambia en una
 * visita, pero la red si: se sale del wifi y se sigue con datos. Lo consulta
 * quien va a lanzar una descarga grande justo antes de lanzarla.
 */
export function redCara(win = typeof window === "undefined" ? undefined : window) {
  const red = win?.navigator?.connection;
  if (!red) return perfil.datosCaros;
  return Boolean(red.saveData) || /(^|-)(2g|3g)$/.test(red.effectiveType || "");
}

/**
 * Presupuesto de rendimiento. No es decorativo: lo leen el codigo (densidad,
 * pasos del shader) y las pruebas (tests/movil.spec.js), que fallan si la
 * pagina se sale de el.
 */
export const PRESUPUESTO = {
  // Fotograma objetivo: 60 fps en escritorio, 30 en telefono.
  fotogramaMs: { escritorio: 16.7, movil: 33.3 },
  // Lienzos WebGL vivos a la vez como maximo, con la pagina ya recorrida.
  // En el telefono: agujero del hero + esferas de la orbita + lienzo 3D de
  // Proyectos (el del cargador ya se ha ido cuando llegan los otros).
  contextos: { escritorio: 10, movil: 3 },
  // Densidad de los lienzos 3D en telefono: arranca en 1 y solo sube si
  // sobra. Por debajo de 1 el titular, que lo dibuja el shader, se pixelaba.
  dprMovil: 1,
  dprMovilMax: 1.5,
  // Pasos por rayo del agujero negro.
  pasosAgujero: { escritorio: 180, movil: 128 },
  // Peso maximo de lo que se precarga sin que nadie lo pida (MB). El telefono
  // tambien baja la celda (~15 MB) mientras se recorre la pagina: a 5 MB solo
  // entraba el dron y la celda se bajaba y decodificaba al abrirla, que era
  // una espera eterna (Jorge, 26-09-2026). Con poca memoria, solo el dron.
  precargaMaxMB: { escritorio: 20, movil: 20, memoriaBaja: 5 },
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
const oyentes = new Set();

export function marcarGpuFallo(motivo = "desconocido") {
  if (fallo) return;
  fallo = true;
  // Se registra: si la pagina degrada, que quede rastro de por que.
  console.warn(`[singularity] 3D desactivado en esta visita: ${motivo}`);
  if (typeof window !== "undefined") window.__gpuFallo = motivo;
  oyentes.forEach((f) => f());
}

export const gpuFallo = () => fallo;

const suscribir = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
const leer = () => fallo;

/** true en cuanto cualquier lienzo WebGL de la pagina ha fallado. */
export function useGpuFallo() {
  return useSyncExternalStore(suscribir, leer, leer);
}

/**
 * WebGL POR SOFTWARE cuenta como no tener GPU.
 *
 * Cuando el navegador no puede usar la grafica (bloqueada, sin controlador,
 * escritorio remoto) no dice que no hay WebGL: lo emula en la CPU con
 * SwiftShader o llvmpipe. Funciona, pero el agujero negro a pantalla completa
 * va a un fotograma cada varios segundos: la intro de 2 s se quedaba casi un
 * minuto en "transformando" (medido en CI, 26-09-2026). Mejor el respaldo CSS.
 */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function revisarRenderer(gl) {
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const nombre = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    if (SOFTWARE.test(nombre)) marcarGpuFallo(`render por software (${nombre})`);
  } catch {
    // Sin poder preguntar, se sigue: la autocomprobacion de cada lienzo avisa.
  }
}

// `?sin-gpu` en la URL fuerza el camino sin WebGL (para probarlo a mano y en
// las pruebas, en cualquier maquina).
if (typeof location !== "undefined" && /[?&]sin-gpu(=|&|$)/.test(location.search)) {
  marcarGpuFallo("forzado con ?sin-gpu");
}

/**
 * Sin WebGL de ninguna clase (desactivado por politica, por el usuario o por
 * el aparato), r3f no avisa a nadie: el `WebGLRenderer` revienta dentro de una
 * promesa suya, fuera de React, y ningun limite de error lo ve. El lienzo se
 * quedaba vacio, `romper` no se llamaba y el titular seguia "lenseado", o sea
 * transparente: el hero sin nombre (tambien en produccion, 27-09-2026). Y el
 * cargador esperaba 20 s un lienzo que no iba a pintar.
 *
 * Se pregunta una vez al arrancar, antes de montar ningun lienzo. WebGL2 y no
 * WebGL1: three r180 ya no sabe usar el 1. El contexto de prueba se suelta al
 * momento para no ocupar sitio en el tope de contextos del telefono.
 */
if (typeof document !== "undefined" && !fallo) {
  let hay;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    hay = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    hay = false;
  }
  if (!hay) marcarGpuFallo("el navegador no crea contextos WebGL2");
}

// Y por si falla despues (un contexto que se niega a mitad de visita, cuando
// ya hay muchos abiertos): el mismo error, escapado como promesa rechazada de
// r3f, tambien pasa todo al respaldo.
if (typeof window !== "undefined") {
  const esContexto = (e) => /creating WebGL context|WebGL context could not be created/i.test(String(e?.message ?? e ?? ""));
  window.addEventListener("unhandledrejection", (ev) => { if (esContexto(ev.reason)) marcarGpuFallo("no se pudo crear un contexto WebGL"); });
  window.addEventListener("error", (ev) => { if (esContexto(ev.error ?? ev.message)) marcarGpuFallo("no se pudo crear un contexto WebGL"); });
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
