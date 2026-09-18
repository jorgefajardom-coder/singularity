import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  View,
  Float,
  Environment,
  Lightformer,
  MeshDistortMaterial,
  RoundedBox,
  useGLTF,
} from "@react-three/drei";

/* ------------------------------------------------------------------
   Iluminación compartida.
   El entorno se genera localmente con Lightformers: NO descarga ningún
   HDRI de internet, así que el sitio funciona offline y carga rápido.
   ------------------------------------------------------------------ */
export function Lights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} />
      <pointLight position={[-5, -2, 3]} intensity={30} color="#db3208" />
      <pointLight position={[5, 3, -2]} intensity={20} color="#ff8224" />
      <Environment resolution={128}>
        <Lightformer intensity={3} position={[0, 4, -3]} scale={[10, 4, 1]} />
        <Lightformer intensity={2} color="#ff6a12" position={[-4, 1, 2]} scale={[6, 6, 1]} />
        <Lightformer intensity={2} color="#ffb066" position={[4, -1, 2]} scale={[6, 6, 1]} />
      </Environment>
    </>
  );
}

/* ------------------------------------------------------------------
   Primitivas procedurales: lo que se ve mientras no tengas modelos.
   ------------------------------------------------------------------ */
function Procedural({ shape = "blob", color = "#ff8224" }) {
  const material = (
    <meshPhysicalMaterial
      color={color}
      roughness={0.18}
      metalness={0.05}
      clearcoat={1}
      clearcoatRoughness={0.15}
      envMapIntensity={1.1}
    />
  );

  switch (shape) {
    case "knot":
      return (
        <mesh castShadow>
          <torusKnotGeometry args={[0.7, 0.26, 180, 32]} />
          {material}
        </mesh>
      );
    case "torus":
      return (
        <mesh>
          <torusGeometry args={[0.75, 0.3, 48, 96]} />
          {material}
        </mesh>
      );
    case "capsule":
      return (
        <mesh>
          <capsuleGeometry args={[0.5, 0.8, 16, 32]} />
          {material}
        </mesh>
      );
    case "ico":
      return (
        <mesh>
          <icosahedronGeometry args={[0.9, 0]} />
          {material}
        </mesh>
      );
    case "box":
      return (
        <RoundedBox args={[1.2, 1.2, 1.2]} radius={0.28} smoothness={8}>
          {material}
        </RoundedBox>
      );
    case "blob":
    default:
      return (
        <mesh>
          <sphereGeometry args={[1, 96, 96]} />
          <MeshDistortMaterial
            color={color}
            distort={0.38}
            speed={1.6}
            roughness={0.15}
            metalness={0.05}
            envMapIntensity={1.2}
          />
        </mesh>
      );
  }
}

/* ------------------------------------------------------------------
   Carga de .glb exportado de Blender.
   Antes de pedirlo a three.js comprobamos que el archivo existe, para que
   un modelo que todavía no has creado no rompa la página: simplemente
   se queda la primitiva procedural.
   ------------------------------------------------------------------ */
function Gltf({ url, scale }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={scale} />;
}

function useFileExists(url) {
  const [state, setState] = useState(url ? "checking" : "absent");

  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url, { method: "HEAD" })
      .then((r) => {
        const type = r.headers.get("content-type") || "";
        // El dev server de Vite devuelve index.html (200) para rutas que no existen.
        const ok = r.ok && !type.includes("text/html");
        if (alive) setState(ok ? "present" : "absent");
      })
      .catch(() => alive && setState("absent"));
    return () => {
      alive = false;
    };
  }, [url]);

  return state;
}

/* ------------------------------------------------------------------
   Un objeto flotante: modelo si existe, primitiva si no.

   `position` NO va en unidades de three.js sino en coordenadas relativas
   al hueco de la sección: [-1, 1] en X y en Y, donde -1 es el borde
   izquierdo/inferior y 1 el derecho/superior. Así los objetos siguen
   encuadrados tanto en un monitor ancho como en un móvil.
   El tercer valor (profundidad) sí va en unidades del mundo.
   ------------------------------------------------------------------ */
export function Prop({
  model,
  fallback = "blob",
  color = "#ff8224",
  position = [0, 0, 0],
  scale = 1,
  speed = 1,
  spin = 0.15,
}) {
  const group = useRef();
  const status = useFileExists(model);
  const viewport = useThree((s) => s.viewport);

  const [nx = 0, ny = 0, z = 0] = position;

  // En vistas estrechas (móvil) el objeto ocuparía una fracción enorme del
  // ancho: lo encogemos y lo empujamos al borde, de modo que asome por fuera
  // del encuadre en vez de taparle el texto al usuario.
  const narrow = viewport.width < 5;
  const fit = Math.min(1, Math.max(0.45, viewport.width / 7.5)) * (narrow ? 0.75 : 1);
  const size = scale * fit;

  const edge = narrow ? 1.35 : 1;
  const px = Math.sign(nx) * Math.min(1.15, Math.abs(nx) * edge);

  const margin = size * 0.9;
  const x = px * Math.max(0, viewport.width / 2 - margin);
  const y = ny * Math.max(0, viewport.height / 2 - margin);

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * spin;
  });

  return (
    <Float speed={speed * 1.4} rotationIntensity={0.5} floatIntensity={1.1}>
      <group ref={group} position={[x, y, z]} scale={size}>
        {status === "present" ? (
          <Suspense fallback={<Procedural shape={fallback} color={color} />}>
            <Gltf url={model} scale={1} />
          </Suspense>
        ) : (
          <Procedural shape={fallback} color={color} />
        )}
      </group>
    </Float>
  );
}

/* ------------------------------------------------------------------
   Vista 3D reutilizable que se "pega" a un hueco del DOM.
   ------------------------------------------------------------------ */
export function PropsView({ items = [], className, parallax = 0 }) {
  const track = useRef(null);

  // <View> renderiza el div que marca el hueco y reenvía la ref;
  // los píxeles los pinta el canvas global.
  return (
    <View ref={track} className={className}>
      <Lights />
      <ParallaxGroup amount={parallax} track={track}>
        {items.map((p, i) => (
          <Prop key={i} {...p} />
        ))}
      </ParallaxGroup>
    </View>
  );
}

/**
 * Desplaza el grupo según cuánto ha avanzado SU sección por la pantalla
 * (no según el scroll absoluto de la página, que crecía sin límite).
 * progreso = +1 cuando la sección aparece por abajo, -1 cuando sale por arriba.
 */
function ParallaxGroup({ amount = 0, track, children }) {
  const ref = useRef();

  useFrame(() => {
    const el = track?.current;
    if (!ref.current || !amount || !el) return;

    const rect = el.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const progress = 1 - (2 * center) / window.innerHeight;

    const target = progress * amount;
    ref.current.position.y += (target - ref.current.position.y) * 0.08;
  });

  return <group ref={ref}>{children}</group>;
}

// Precarga opcional: descomenta cuando tengas el modelo del hero.
// useGLTF.preload('/models/hero.glb')
