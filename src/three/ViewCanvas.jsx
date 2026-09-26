import { useEffect, useRef } from "react";
import { Canvas, advance, useThree } from "@react-three/fiber";
import { View, Preload } from "@react-three/drei";
import { PRESUPUESTO, marcarGpuFallo, perfil, revisarRenderer } from "../lib/gpu";
import { useVistas } from "../lib/vistas";
import { gsap } from "../lib/anim";

/**
 * Un ÚNICO <Canvas> fijo a pantalla completa para todo el sitio.
 * Cada sección declara un <View> (ver src/three/Props3D.jsx) y drei se encarga
 * de recortar y renderizar esa porción en el hueco del DOM correspondiente.
 * Esto es mucho más barato que crear un canvas por sección.
 */
/**
 * Ojo: R3F aplica estilos INLINE al contenedor del canvas (position:relative,
 * width/height 100%), y esos ganan a cualquier clase CSS. Por eso el
 * posicionamiento va en la prop `style` y no en `className`.
 */
const CANVAS_STYLE = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  pointerEvents: "none",
  // Capa 3: por ENCIMA del contenido normal (z 1-2) para que los objetos
  // floten sobre los paneles claros, y por DEBAJO del titular del hero (4)
  // y del nav (50). No intercepta el puntero, y si WebGL cae se desmonta
  // entero (ver App.jsx), asi que nunca puede quedar un lienzo roto encima.
  zIndex: 3,
};

/**
 * EL LIENZO PINTA DESPUES DEL SCROLL, EN EL MISMO FOTOGRAMA.
 *
 * Cada <View> se coloca leyendo la caja de su hueco en el DOM. Con el bucle
 * propio de r3f (su `requestAnimationFrame`) el orden frente a Lenis —que
 * mueve el scroll desde el ticker de GSAP— era cuestion de suerte: si r3f
 * pintaba antes, leia la caja del fotograma anterior y el modelo iba un
 * fotograma por detras de su hueco; con un scroll rapido eso son decenas de
 * pixeles y el modelo se veia despegado. Aqui el lienzo no tiene bucle
 * (`frameloop="never"`) y lo pinta el ticker de GSAP, que ya ha pasado por
 * Lenis (se engancha antes, al montar App).
 *
 * Sin ninguna vista en pantalla no se pinta. Antes de parar se hace UN
 * fotograma mas: con las vistas fuera, ese fotograma limpia el lienzo y no
 * queda ningun objeto congelado encima de otra seccion.
 */
function Reloj({ activo }) {
  const get = useThree((s) => s.get);
  const estado = useRef({ activo, pendientes: 1, primero: true });
  useEffect(() => {
    const e = estado.current;
    e.activo = activo;
    if (!activo) e.pendientes = 1;
  }, [activo]);
  useEffect(() => {
    const e = estado.current;
    const pintar = (time) => {
      if (!e.activo && e.pendientes <= 0) return;
      if (!e.activo) e.pendientes--;
      const s = get();
      // El reloj de r3f arranca en 0 y el de GSAP no: sin igualarlos, el
      // primer fotograma llegaria con un `delta` de minutos.
      if (e.primero) { s.clock.elapsedTime = time; e.primero = false; }
      advance(time, false, s);
    };
    gsap.ticker.add(pintar);
    return () => gsap.ticker.remove(pintar);
  }, [get]);
  return null;
}

/**
 * Si el contexto se pierde, la GPU se da por caida en toda la visita (ver
 * lib/gpu.js): App desmonta este lienzo y cada visor enseña su respaldo.
 */
function Vigilar() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    revisarRenderer(gl.getContext());
    const perdido = () => marcarGpuFallo("contexto perdido (lienzo 3D)");
    canvas.addEventListener("webglcontextlost", perdido);
    return () => canvas.removeEventListener("webglcontextlost", perdido);
  }, [gl]);
  return null;
}

export default function ViewCanvas({ eventSource }) {
  const { visibles } = useVistas();
  const activo = visibles > 0;
  // En el telefono: densidad 1 como maximo, sin antialias (a esa densidad de
  // pantalla apenas se nota y es el doble de muestras) y la GPU por defecto,
  // no la de alto consumo. Tampoco se precompila todo al montar (`Preload`):
  // es un pico de trabajo por escenas que quiza no se vean nunca.
  const movil = perfil.movil;
  const opciones = useRef({
    antialias: !movil,
    alpha: true,
    powerPreference: movil ? "default" : "high-performance",
  });
  return (
    <Canvas
      style={CANVAS_STYLE}
      eventSource={eventSource}
      eventPrefix="client"
      dpr={movil ? [1, PRESUPUESTO.dprMovil] : [1, 2]}
      frameloop="never"
      gl={opciones.current}
      camera={{ fov: 35, position: [0, 0, 6] }}
    >
      <Vigilar />
      <Reloj activo={activo} />
      <View.Port />
      {!movil && <Preload all />}
    </Canvas>
  );
}
