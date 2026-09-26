import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { View, Preload } from "@react-three/drei";
import { PRESUPUESTO, marcarGpuFallo, perfil } from "../lib/gpu";
import { useVistas } from "../lib/vistas";

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
 * Sin ninguna vista en pantalla el lienzo deja de pintar en bucle. Antes de
 * parar hace UN fotograma mas: con las vistas fuera, ese fotograma limpia el
 * lienzo y no queda ningun objeto congelado encima de otra seccion.
 */
function Pausa({ activo }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!activo) invalidate();
  }, [activo, invalidate]);
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
      frameloop={activo ? "always" : "demand"}
      gl={opciones.current}
      camera={{ fov: 35, position: [0, 0, 6] }}
    >
      <Vigilar />
      <Pausa activo={activo} />
      <View.Port />
      {!movil && <Preload all />}
    </Canvas>
  );
}
