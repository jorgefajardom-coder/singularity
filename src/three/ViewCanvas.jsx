import { Canvas } from "@react-three/fiber";
import { View, Preload } from "@react-three/drei";
import { useTelefono } from "../lib/telefono";

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
  // y del nav (50). Si quieres que el objeto del hero tape el texto,
  // quita el z-index de .hero__title en global.css.
  zIndex: 3,
};

export default function ViewCanvas({ eventSource }) {
  // El lienzo cubre la pantalla entera y se limpia en cada fotograma aunque
  // no haya nada a la vista: en un telefono de densidad 3, a 2x eran ~2,5
  // millones de pixeles por fotograma. Con 1,5 el dron y la celda siguen
  // nitidos y el coste baja casi a la mitad.
  const telefono = useTelefono();
  return (
    <Canvas
      style={CANVAS_STYLE}
      eventSource={eventSource}
      eventPrefix="client"
      dpr={telefono ? [1, 1.5] : [1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 35, position: [0, 0, 6] }}
    >
      <View.Port />
      <Preload all />
    </Canvas>
  );
}
