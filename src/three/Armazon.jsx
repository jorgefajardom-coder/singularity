import { Component, useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * LO QUE SE VE DENTRO DEL VISOR MIENTRAS EL MODELO NO ESTA, EN LOS DOS VISORES.
 *
 * La celda (ModelViewer) y el dron (ProductViewer) enseñan el mismo armazon
 * mientras baja su .glb, y el mismo aviso DOM debajo (components/Carga3D.jsx).
 * Antes el dron tenia un `Suspense fallback={null}`: hueco vacio, y un visor
 * en blanco parece roto.
 */
export function Armazon({ quieto }) {
  const piezas = useRef();
  const anillos = useRef();
  const tiempo = useRef(0);
  useFrame((_, dt) => {
    if (quieto) return;
    tiempo.current += Math.min(dt, 0.05);
    const t = tiempo.current;
    if (anillos.current) {
      anillos.current.rotation.y = t * 0.65;
      anillos.current.rotation.z = t * 0.18;
    }
    piezas.current?.children.forEach((pieza, i) => {
      const angle = i * Math.PI / 4 + t * 0.35;
      const radius = 0.68 + Math.sin(t * 1.8 + i * 0.65) * 0.13;
      pieza.position.set(Math.cos(angle) * radius, Math.sin(t * 1.8 + i) * 0.22, Math.sin(angle) * radius);
      pieza.rotation.set(t * 0.4 + i, t * 0.55, 0);
    });
  });
  return (
    <group scale={0.85}>
      <group ref={anillos} rotation={[0.5, 0, 0.2]}>
        {[0, 1, 2].map(i => (
          <mesh key={i} rotation={[i * Math.PI / 3, i * 0.6, 0]}>
            <torusGeometry args={[0.95 + i * 0.1, 0.012, 6, 64, Math.PI * 1.5]} />
            <meshBasicMaterial color={i === 1 ? "#ffd29b" : "#ff6a12"} />
          </mesh>
        ))}
      </group>
      <group ref={piezas}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[Math.cos(i * Math.PI / 4) * 0.68, 0, Math.sin(i * Math.PI / 4) * 0.68]}>
            <boxGeometry args={[0.16, 0.12, 0.2]} />
            <meshStandardMaterial color={i % 2 ? "#ffb066" : "#ff6a12"} metalness={0.35} roughness={0.4} />
          </mesh>
        ))}
      </group>
      <mesh rotation={[Math.PI / 4, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.22]} />
        <meshBasicMaterial color="#fff0df" wireframe />
      </mesh>
    </group>
  );
}

/**
 * Si el .glb no llega (red cortada, archivo roto), el fallo se queda en el
 * visor: sin esto subia hasta el `Aislado` de la seccion y se llevaba la
 * ficha entera de Proyectos.
 */
export class ErrorModelo extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}
