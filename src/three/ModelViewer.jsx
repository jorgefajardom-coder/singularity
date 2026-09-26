import { Component, Suspense, use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { View, Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { assemblyRoot, planAssemblyIdle, prepareAssembly, poseAssembly, disposeAssembly, presentationTime } from "../lib/modelAssembly";
import { useLang } from "../lib/i18n";
import { asset } from "../lib/asset";
import { prefersReducedMotion } from "../lib/anim";
import { useGpuFallo } from "../lib/gpu";
import { useRegistrarVista } from "../lib/vistas";
import { ui } from "../data/content";

/**
 * Visor 3D para un proyecto que tiene modelo.
 *
 * A diferencia de los `Prop` de Props3D —que son adornos que flotan al margen
 * del texto—, esto es la pieza que se viene a ver: se puede girar con el raton
 * o el dedo, y mientras no la toquen gira sola.
 *
 * Se pinta en el lienzo global (un solo <Canvas> para todo el sitio, ver
 * ViewCanvas.jsx). `<View>` solo marca el hueco del DOM donde recortar.
 */

/**
 * LUZ PROPIA, distinta a la de los adornos de Props3D.
 *
 * Aquella esta hecha para bolas y nudos pequenos, con laca y mucho brillo:
 * ambiente 0,6, un direccional a 2,2 y dos focos de color a 30 y 20. Sobre una
 * celda entera —superficies grandes, planas y mate— eso no ilumina, quema: los
 * azules, amarillos y rojos que SI trae el modelo salian lavados a blanco.
 *
 * Esta es una luz de taller: una clave clara en alto, un relleno frio y flojo
 * por el otro lado para que las sombras no se cierren del todo, y un contra
 * ambar muy justo que ata la pieza a la paleta del sitio. El entorno se genera
 * en casa, como en Props3D, y a una intensidad que solo sirve para los reflejos
 * de los metales.
 */
function LucesTaller() {
  return (
    <>
      <ambientLight intensity={0.32} />
      <directionalLight position={[4, 7, 5]} intensity={1.5} />
      <directionalLight position={[-5, 3, -4]} intensity={0.45} color="#9fb6ff" />
      <pointLight position={[2, 1.5, 4]} intensity={9} color="#ff8224" />
      <Environment resolution={128}>
        <Lightformer intensity={0.9} position={[0, 5, -2]} scale={[10, 5, 1]} />
        <Lightformer intensity={0.5} color="#ffb066" position={[4, 0, 3]} scale={[6, 6, 1]} />
      </Environment>
    </>
  );
}

/**
 * EL MONTAJE.
 *
 * Explosionado visible desde el inicio, con llegada suave y escalonada.
 * Cada malla, incluidos los paneles de los cajones, tiene su propio recorrido.
 *
 * No hay animacion en el archivo: la celda viene de Unity y alli el movimiento
 * vive en el Animator, no en la malla. Esto se calcula aqui a partir de donde
 * esta cada pieza, asi que sigue funcionando si el modelo cambia.
 *
 * Las posiciones se miden en el espacio LOCAL del modelo y no en el del mundo:
 * muchas exportaciones de CAD traen todas las piezas en el origen con la
 * geometria horneada en los vertices, asi que mirar `position` no dice nada.
 */
function Ensamblaje({ objeto, plan, quieto, activo, montaje }) {
  const reloj = useRef(0);
  const terminado = useRef(false);
  const piezasRef = useRef([]);
  useLayoutEffect(() => {
    const piezas = prepareAssembly(objeto, plan);
    piezasRef.current = piezas;
    reloj.current = 0;
    terminado.current = quieto;
    montaje.current.active = !quieto;
    montaje.current.elapsed = 0;
    montaje.current.duration = Math.max(0, ...piezas.map(pieza => pieza.end));
    poseAssembly(piezas, presentationTime(piezas, 0).time, quieto);
    return () => { disposeAssembly(piezas); montaje.current.active = false; };
  }, [objeto, plan, quieto, montaje]);
  useFrame((_, dt) => {
    if (terminado.current || !activo) return;
    reloj.current += Math.min(dt, 0.05);
    const piezas = piezasRef.current;
    const frame = presentationTime(piezas, reloj.current);
    poseAssembly(piezas, frame.time, quieto);
    terminado.current = frame.complete;
    montaje.current.active = !terminado.current;
    montaje.current.elapsed = reloj.current;
  });
  return null;
}

/**
 * El modelo llega en las unidades en las que lo exportaron —una celda de
 * manufactura son metros, y son muchos—, asi que aqui se mide su caja y se
 * encaja EN EL HUECO, no en un cubo de tamaño fijo.
 *
 * Encajarlo en un cubo de lado 2 no servia: el tamaño que se ve depende de
 * cuanto mundo cabe en la vista, y eso lo decide la caja del DOM y la camara
 * compartida del lienzo. Salia una celda diminuta en medio de un recuadro
 * enorme. `viewport` da el ancho y el alto de ESTA vista en unidades de mundo,
 * y de ahi sale la escala.
 *
 * El ancho se mide con la diagonal de la planta y no con el lado mayor, porque
 * la figura gira: en diagonal ocupa mas que de frente, y midiendo solo el lado
 * se salia del encuadre a media vuelta.
 */
/**
 * CARGA Y PREPARACION, UNA VEZ POR MODELO.
 *
 * No se usa useGLTF: aqui no basta con bajar y decodificar el .glb. Lo que de
 * verdad hacia esperar al abrir el proyecto era todo lo de despues —medir la
 * celda y calcular la trayectoria de sus ~30.000 piezas—, y eso tambien tiene
 * que estar hecho antes de que nadie lo pida. La promesa de cada URL guarda el
 * modelo, su caja y el plan del despiece; `preloadModel` la lanza en segundo
 * plano y el visor la consume con `use()`, asi que si ya esta resuelta el
 * modelo aparece sin pasar por el armazon de carga.
 *
 * El .glb va comprimido con Draco. El decodificador se sirve desde /draco y
 * no del CDN de Google: el sitio no depende de terceros para pintarse, igual
 * que el entorno de luces se genera en casa (ver Props3D.jsx).
 */
const modelos = new Map();
// URL ya descargadas y preparadas: el visor de una de ellas no espera a nada.
const preparados = new Set();
let draco = null;

function cargar(url) {
  if (modelos.has(url)) return modelos.get(url);
  if (!draco) draco = new DRACOLoader().setDecoderPath(asset("/draco/"));
  const promesa = new GLTFLoader().setDRACOLoader(draco).loadAsync(url).then(async ({ scene }) => {
    // El suelo de 8 x 8 esta desplazado: incluirlo aleja la vista y hace que
    // la maquinaria orbite alrededor de un punto ajeno a la celda.
    scene.updateMatrixWorld(true);
    const caja = new Box3().setFromObject(assemblyRoot(scene), true);
    const plan = await planAssemblyIdle(scene);
    const listo = { scene, plan, tam: caja.getSize(new Vector3()), centro: caja.getCenter(new Vector3()) };
    // Marcada como cumplida a la manera de React: `use()` la lee al momento
    // en vez de suspender un ciclo y enseñar el armazon de carga.
    promesa.status = "fulfilled";
    promesa.value = listo;
    preparados.add(url);
    return listo;
  });
  // Si falla, se olvida: la proxima vez que lo pidan se vuelve a intentar.
  promesa.catch(() => modelos.delete(url));
  modelos.set(url, promesa);
  return promesa;
}

function Encajado({ url, repeticion, quieto, onReady, activo, montaje }) {
  const { scene: original, plan, tam, centro } = use(cargar(url));
  // La animacion cambia posiciones. No mutar la escena cacheada: al volver
  // a abrir, sus piezas desplazadas tambien falsearian el encuadre inicial.
  const { scene, floorMaterials } = useMemo(() => {
    const scene = original.clone(true), floorMaterials = [];
    scene.getObjectByName("Plane")?.traverse(mesh => {
      if (!mesh.isMesh) return;
      const finish = material => {
        if (material.name === "SafetyStripesMat") return material;
        const copy = material.clone();
        // Warm gray sampled visually from the simulation's video poster.
        copy.color.set("#646158");
        copy.roughness = 0.48;
        copy.metalness = 0.12;
        copy.envMapIntensity = 0.65;
        floorMaterials.push(copy);
        return copy;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(finish) : finish(mesh.material);
    });
    return { scene, floorMaterials };
  }, [original, repeticion]);
  useEffect(() => () => floorMaterials.forEach(material => material.dispose()), [floorMaterials]);

  const viewSize = useThree((s) => s.size);

  useEffect(() => { onReady(); }, [scene, onReady]);

  // Match this view's 35-degree camera at distance 6, not the global Canvas
  // viewport (which uses a different camera and used to crop the cabinets).
  const height = 12 * Math.tan(35 * Math.PI / 360);
  const width = height * (viewSize.width / Math.max(1, viewSize.height));
  const planta = Math.hypot(tam.x, tam.z) || 1;
  const alto = tam.y || 1;
  const escala = Math.min(width / (planta + 0.3), height / (alto + planta * 0.2)) * 1.20;

  const encuadre = useRef();
  const presentar = useCallback(() => {
    if (!encuadre.current) return;
    const active = !quieto && montaje.current.active;
    // Leave room for the exploded components, closing in as they dock.
    const t = active ? Math.max(0, Math.min(1, montaje.current.elapsed / Math.max(1, montaje.current.duration || 1))) : 1;
    const blend = t * t * t * (t * (t * 6 - 15) + 10);
    encuadre.current.scale.setScalar(escala * (0.85 + blend * 0.15));
  }, [quieto, montaje, escala]);
  useLayoutEffect(presentar, [presentar]);
  useFrame(presentar);

  return (
    <group ref={encuadre} scale={escala}>
      <primitive object={scene} position={[-centro.x, -centro.y, -centro.z]} />
      <Ensamblaje objeto={scene} plan={plan} quieto={quieto} activo={activo} montaje={montaje} />
    </group>
  );
}

/**
 * Lo que se ve mientras el .glb no existe o todavia esta bajando. No es un
 * hueco vacio a proposito: un visor en blanco parece roto.
 */
function Armazon({ quieto }) {
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

class ModelErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * El giro.
 *
 * `mando` es un ref y no estado: se escribe desde los eventos de puntero y se
 * lee 60 veces por segundo, y pasarlo por React seria re-renderizar el arbol
 * entero en cada movimiento del raton.
 *
 * Mientras nadie lo toca gira solo. En cuanto lo agarran, manda el puntero; y
 * al soltar, la velocidad que llevaba se va apagando antes de volver al giro
 * de siempre, para que no se pare en seco.
 */
function Girado({ mando, quieto, activo, repeticion, children }) {
  const grupo = useRef();
  useLayoutEffect(() => {
    if (!grupo.current) return;
    // Present the red-table side first, including every replay.
    grupo.current.rotation.set(0.16, 4.05, 0);
    Object.assign(mando.current, { dx: 0, dy: 0, giro: 0, agarrado: false });
  }, [repeticion, mando]);

  useFrame((_, dt) => {
    const g = grupo.current;
    if (!g || !activo) return;
    const m = mando.current;
    const paso = Math.min(dt, 0.05);

    // Lo que haya llegado del puntero se aplica SIEMPRE, se siga agarrando o
    // no. Estaba dentro del `if (m.agarrado)`, y asi se perdia el arrastre
    // entero cada vez que el dedo se levantaba antes de que diera tiempo a
    // pintar un fotograma: los eventos de puntero llegan mucho mas seguidos
    // que los fotogramas, asi que basta con un tiron rapido —o con que el
    // navegador se salte unos cuantos— para que el giro pedido se tirara a la
    // basura y el modelo no se moviera.
    if (m.dx || m.dy) {
      g.rotation.y += m.dx;
      // La inclinacion se topa: pasado el cenit la celda se ve del reves y ya
      // no se entiende que es.
      g.rotation.x = Math.max(-0.9, Math.min(0.9, g.rotation.x + m.dy));
      m.giro = m.dx;
      m.dx = 0;
      m.dy = 0;
    }

    // Con el dedo puesto no hay ni inercia ni giro propio: manda la mano.
    if (m.agarrado) return;

    // Lo que quedaba del arrastre, apagandose.
    m.giro *= Math.exp(-paso * 2.6);
    // Quien pide menos movimiento no recibe un objeto girando solo: lo gira si
    // quiere, y el resto del tiempo se queda quieto donde lo dejo.
    g.rotation.y += m.giro + (quieto ? 0 : paso * 0.1);
    // Y la inclinacion vuelve sola a la altura de partida.
    g.rotation.x += (0.16 - g.rotation.x) * (1 - Math.exp(-paso * 1.8));
  });

  return <group ref={grupo}>{children}</group>;
}

/**
 * Comprueba que el archivo esta ahi antes de pedirselo a three.js, para que un
 * modelo que todavia no se ha exportado no rompa la pagina. Mismo criterio que
 * en Props3D: el dev server de Vite responde 200 con un index.html para rutas
 * que no existen, asi que mirar el `ok` no basta.
 */
function useHayArchivo(url, conocido) {
  const [estado, setEstado] = useState(conocido ? "si" : url ? "mirando" : "no");

  useEffect(() => {
    if (!url || conocido) return undefined;
    setEstado("mirando");
    let vivo = true;
    fetch(url, { method: "HEAD" })
      .then((r) => {
        const tipo = r.headers.get("content-type") || "";
        if (vivo) setEstado(r.ok && !tipo.includes("text/html") ? "si" : "no");
      })
      .catch(() => vivo && setEstado("no"));
    return () => { vivo = false; };
  }, [url, conocido]);

  return conocido ? "si" : estado;
}

/**
 * Baja, decodifica y deja preparado el despiece antes de que nadie abra el
 * proyecto (ver `cargar`). Misma URL que `Encajado`: si difieren, la cache
 * no coincide y se hace dos veces.
 */
export function preloadModel(model) {
  cargar(asset(model)).catch(() => {});
}

export default function ModelViewer({ model, label, hint }) {
  const { tr } = useLang();
  const [modeloListo, setModeloListo] = useState(null);
  const [modeloFallido, setModeloFallido] = useState(null);
  const listo = modeloListo === model;
  const fallo = modeloFallido === model;
  const [repeticion, setRepeticion] = useState(0);
  const onReady = useCallback(() => setModeloListo(model), [model]);
  const onError = useCallback(() => setModeloFallido(model), [model]);
  const caja = useRef(null);
  const mando = useRef({ agarrado: false, dx: 0, dy: 0, giro: 0, x: 0, y: 0 });
  const montaje = useRef({ active: true, elapsed: 0 });
  const url = asset(model);
  // Si el modelo ya se preparo en segundo plano (ver `preloadModel`), no hay
  // que esperar a que el visor asome ni preguntar si el archivo existe: dentro
  // del acordeon que se esta abriendo, el visor mide 0 px y el observador
  // tardaba ~350 ms en darlo por visible.
  const yaPreparado = preparados.has(url);
  // Descargar y decodificar mientras el visitante se acerca a la seccion.
  const [asomado, setAsomado] = useState(yaPreparado);
  const [enPantalla, setEnPantalla] = useState(false);
  const gpuCaida = useGpuFallo();
  useRegistrarVista(caja);

  useEffect(() => {
    const el = caja.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver !== "function") { setAsomado(true); setEnPantalla(true); return undefined; }
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setAsomado(true); obs.disconnect(); }
    }, { rootMargin: "1800px" });
    const visible = new IntersectionObserver(([e]) => setEnPantalla(e.isIntersecting), { threshold: 0.05 });
    obs.observe(el);
    visible.observe(el);
    return () => { obs.disconnect(); visible.disconnect(); };
  }, []);

  const estado = useHayArchivo(asomado ? url : null, yaPreparado);
  const quieto = prefersReducedMotion();

  // Pixeles de arrastre a radianes. Con la caja mas ancha hace falta mover mas
  // el raton para dar la misma vuelta, que es lo que espera la mano.
  //
  // El desplazamiento se saca restando posiciones, NO de `movementX`: ese
  // campo lo rellena el navegador con el movimiento fisico del raton, viene
  // escalado por el zoom y el DPI de la pantalla, y hay entornos que
  // directamente lo dejan a cero. Restando `clientX` se mide lo que se ve.
  const girar = (e) => {
    const m = mando.current;
    if (!m.agarrado) return;
    const ancho = caja.current?.clientWidth || 600;
    m.dx += ((e.clientX - m.x) / ancho) * 3.2;
    m.dy += ((e.clientY - m.y) / ancho) * 3.2;
    m.x = e.clientX;
    m.y = e.clientY;
  };

  const agarrar = (e) => {
    const m = mando.current;
    m.agarrado = true;
    m.giro = 0;
    m.x = e.clientX;
    m.y = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const soltar = (e) => {
    mando.current.agarrado = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      className="modelo"
      ref={caja}
      data-listo={listo ? "true" : "false"}
      aria-busy={asomado && !listo && !fallo && estado !== "no"}
      onPointerDown={agarrar}
      onPointerMove={girar}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onPointerLeave={soltar}
    >
      {/* Sin GPU el hueco se queda con su aviso: el resto de la ficha (texto,
          enlaces, video) no depende del 3D. */}
      {gpuCaida ? (
        <>
          <div className="modelo__hueco" />
          <div className="modelo__carga" role="status"><span>{tr(ui.sin3d)}</span></div>
        </>
      ) : <>
      {/* El lienzo global no recibe eventos (`pointer-events: none`), asi que
          el arrastre lo captura este div y el 3D solo lee el resultado. */}
      <View className="modelo__hueco">
        <PerspectiveCamera
          makeDefault
          fov={35}
          position={[0, 0, 6]}
          onUpdate={camera => camera.lookAt(0, 0, 0)}
        />
        <LucesTaller />
        <Girado mando={mando} quieto={quieto} activo={enPantalla} repeticion={repeticion}>
          {estado === "si" ? (
            <ModelErrorBoundary key={url} onError={onError}>
              <Suspense fallback={<Armazon quieto={quieto || !enPantalla} />}>
                <Encajado url={url} repeticion={repeticion} quieto={quieto} onReady={onReady} activo={enPantalla} montaje={montaje} />
              </Suspense>
            </ModelErrorBoundary>
          ) : (
            <Armazon quieto={quieto || !enPantalla} />
          )}
        </Girado>
      </View>

      {/* Precargado, el modelo tarda unos cientos de ms en montarse: avisar
          de que se esta preparando solo seria un parpadeo. */}
      {!listo && !yaPreparado && (
        <div className="modelo__carga" role="status">
          <span>{fallo || (asomado && estado === "no")
            ? tr({ es: "No se pudo cargar el modelo", en: "Unable to load model" })
            : tr({ es: "Preparando la celda 3D", en: "Preparing the 3D cell" })}</span>
          {!fallo && estado !== "no" && <span className="modelo__progreso" aria-hidden="true" />}
        </div>
      )}
      </>}
      <div className="modelo__pie">
        <span className="modelo__nombre">{label}</span>
        <span className="modelo__ayuda">{hint}</span>
        {listo && !quieto && (
          <button type="button" className="modelo__repetir"
            onPointerDown={e => e.stopPropagation()}
            onClick={() => setRepeticion(n => n + 1)}>
            {tr({ es: "Repetir montaje", en: "Replay assembly" })}
          </button>
        )}
      </div>
    </div>
  );
}
