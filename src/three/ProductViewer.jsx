import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { View, useGLTF, Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import { Box3, Color, Vector3 } from "three";
import { useLang } from "../lib/i18n";
import { asset } from "../lib/asset";
import { prefersReducedMotion } from "../lib/anim";

/**
 * Visor de un PRODUCTO (el dron, su empaque): flota sobre la pagina, sin
 * recuadro ni fondo, gira despacio, se arrastra para girarlo y se despieza.
 *
 * Mas sencillo que el de la celda (ModelViewer.jsx): aqui no hay miles de
 * piezas etiquetadas por vertice, sino unas pocas piezas con nombre (una por
 * grupo, ver tools/exportar-dron.py), y el despiece mueve cada una entera.
 *
 * `despiece` dice cuanto se aparta cada pieza, por prefijo de nombre:
 *   { prefijo: "helice", y: 0.5, radial: 0.08 }
 * `y` es la subida y `radial` la salida hacia fuera desde el centro, en las
 * unidades del modelo (el .glb viene a 1 de lado mayor). Las piezas se
 * apartan DE UNA EN UNA, en el orden de `despiece`, y vuelven al reves.
 *
 * Para piezas que van montadas sobre otra (los componentes de la PCB):
 *   { prefijo: "pcbc", y: 0.1, sigue: "pcb", juntas: true, lados: true }
 * `sigue` las lleva con esa pieza y despues las aparta de ella; `juntas`
 * les da un solo turno a todas (89 turnos no acabarian nunca); `lados`
 * manda hacia abajo las que van por debajo de la pieza que siguen.
 *
 * Para piezas que son a su vez un conjunto (cada motor, partido en eje,
 * campana, imanes...): `partes` suma a `y` lo de cada una segun el final
 * de su nombre (`motor_2_campana` -> `campana`), y `porGrupo` hace que las
 * partes de un mismo conjunto salgan en el mismo turno.
 *
 * `colores` repinta materiales del .glb (Fusion los exporta planos, sin
 * metal): { prefijo: "pcb", materiales: ["..."], color, metal, rugosidad }.
 * "" es la parte sin material, que three pinta blanca.
 */

const DRACO = () => asset("/draco/");

export function preloadProducto(model) {
  useGLTF.preload(asset(model), DRACO());
}

function Luces() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 6, 4]} intensity={1.7} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#9fb6ff" />
      {/* Un toque de ambar, justo: mas fuerte teñia de marron los grises. */}
      <pointLight position={[1.5, 1, 2.5]} intensity={1.4} color="#ff8224" />
      <Environment resolution={128}>
        <Lightformer intensity={1} position={[0, 4, -2]} scale={[8, 4, 1]} />
        <Lightformer intensity={0.5} color="#ffb066" position={[3, 0, 3]} scale={[5, 5, 1]} />
      </Environment>
    </>
  );
}

// Inclinacion hacia la camara (la misma que usa Girado).
const INCLINACION = 0.35;
// Borde de arriba del campo de la camara (35 grados), con un respiro minimo.
const TOPE = Math.tan((35 * Math.PI) / 360) * 0.985;

// Cuanto tarda el despiece entero, y que parte de ese tiempo se lleva cada
// pieza al moverse (el resto es el escalonado entre una y la siguiente).
const RECORRIDO = 2.4;
const TRAMO = 0.3;

// "pcb" es la placa y "pcbc_07" un componente: con `startsWith` a secas,
// la regla de la placa se llevaba tambien los componentes.
const esPieza = (nombre, prefijo) => nombre === prefijo || nombre.startsWith(prefijo + "_");

// Si `o` o alguno de sus padres es la pieza `prefijo`.
function deLaPieza(o, prefijo) {
  for (let p = o; p; p = p.parent) if (esPieza(p.name, prefijo)) return true;
  return false;
}

const suave = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function Modelo({ url, despiece, colores, abierto, onReady, giro, vaiven, alzado }) {
  const { scene: original } = useGLTF(url, DRACO());
  const scene = useMemo(() => {
    const copia = original.clone(true);
    // Los materiales se comparten con el original de la cache: se clonan
    // antes de repintarlos.
    copia.traverse((o) => {
      if (!o.isMesh) return;
      const regla = colores.find((c) => c.materiales.includes(o.material.name) && deLaPieza(o, c.prefijo));
      if (!regla) return;
      o.material = o.material.clone();
      o.material.color = new Color(regla.color);
      o.material.metalness = regla.metal ?? 1;
      o.material.roughness = regla.rugosidad ?? 0.35;
    });
    return copia;
  }, [original, colores]);
  const size = useThree((s) => s.size);

  // Piezas con su posicion de reposo y hacia donde se apartan.
  const { piezas, centro, tam, caja } = useMemo(() => {
    const caja = new Box3().setFromObject(scene);
    const centro = caja.getCenter(new Vector3());
    const piezas = [];
    scene.updateMatrixWorld(true);
    const centroDe = (prefijo) => {
      const b = new Box3();
      scene.traverse((o) => { if (o.name === prefijo) b.setFromObject(o); });
      return b.isEmpty() ? centro : b.getCenter(new Vector3());
    };
    scene.traverse((o) => {
      const regla = despiece.find((r) => esPieza(o.name, r.prefijo));
      if (!regla || !o.parent) return;
      // Una malla con varios materiales llega como grupo "pcb" con hijos
      // "pcb_1", "pcb_2"...: se mueve el grupo, no cada hijo otra vez.
      if (o.parent.name && despiece.some((r) => deLaPieza(o.parent, r.prefijo))) return;
      const reposo = o.position.clone();
      const mundo = new Box3().setFromObject(o).getCenter(new Vector3());
      const fuera = new Vector3(mundo.x - centro.x, 0, mundo.z - centro.z);
      if (fuera.lengthSq() > 1e-8) fuera.normalize().multiplyScalar(regla.radial || 0);
      // El desplazamiento se calcula en el mundo y se pasa al espacio del
      // padre de la pieza (la raiz del .glb puede venir escalada).
      const escala = o.parent.getWorldScale(new Vector3());
      const lado = regla.lados && mundo.y < centroDe(regla.sigue).y ? -1 : 1;
      const extra = regla.partes?.[o.name.split("_").pop()] ?? 0;
      const sube = ((regla.y || 0) + extra) * lado;
      const delta = new Vector3(fuera.x, sube, fuera.z).divide(escala);
      const grupo = regla.porGrupo ? o.name.split("_").slice(0, -1).join("_") : o.name;
      piezas.push({ o, reposo, delta, regla, grupo, sube: Math.max(0, sube), orden: despiece.indexOf(regla) });
    });
    // Orden de salida: el de `despiece`, y dentro de cada regla por nombre.
    piezas.sort((a, b) => a.orden - b.orden || a.o.name.localeCompare(b.o.name));
    // Un turno por pieza, salvo las reglas `juntas`, que comparten uno.
    let turnos = 0;
    piezas.forEach((p, i) => {
      const previa = piezas[i - 1];
      const junta = previa && previa.regla === p.regla && (p.regla.juntas || (p.regla.porGrupo && previa.grupo === p.grupo));
      if (!junta) turnos++;
      p.turno = turnos - 1;
    });
    // Las que siguen a otra pieza se llevan tambien su recorrido.
    for (const p of piezas) {
      if (!p.regla.sigue) continue;
      p.guia = piezas.find((q) => q.o.name === p.regla.sigue);
      if (p.guia) p.sube += p.guia.sube;
    }
    piezas.turnos = turnos;
    return { piezas, centro, tam: caja.getSize(new Vector3()), caja };
  }, [scene, despiece]);

  useEffect(() => { onReady(); }, [onReady]);

  // Encajar en el hueco. `alto` y `ancho` son el campo COMPLETO que ve la
  // camara (35 grados a distancia 6); con la mitad, el modelo salia a la mitad
  // de lo que cabe.
  const alto = 2 * 6 * Math.tan((35 * Math.PI) / 360);
  const ancho = alto * (size.width / Math.max(1, size.height));
  // Dos encajes: MONTADO, que llena el hueco, y DESPIEZADO, que reserva
  // todo el recorrido vertical (lo que sube y lo que baja). Con uno solo, el
  // modelo montado salia pequeño en medio de un hueco vacio. Al despiezar,
  // la vista se aleja lo justo; al montar, vuelve a acercarse. El 1.35 cubre
  // la inclinacion hacia la camara.
  const subida = Math.max(0, ...despiece.map((r) => (r.y || 0) + Math.max(0, ...Object.values(r.partes || {}))));
  const bajada = Math.min(0, ...despiece.map((r) => r.y || 0));
  // Lo que ocupa DE VERDAD en pantalla: ancho y fondo proyectados en todos
  // los angulos que puede alcanzar (vuelta entera, o el vaiven), y el alto con
  // la inclinacion hacia la camara. Con margenes fijos para el peor caso, la
  // caja salia en un tercio del hueco.
  let anchoVisto = 0, fondoVisto = 0;
  const pasos = 48;
  for (let k = 0; k <= pasos; k++) {
    const a = vaiven ? giro - vaiven + (2 * vaiven * k) / pasos : (2 * Math.PI * k) / pasos;
    const c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
    anchoVisto = Math.max(anchoVisto, tam.x * c + tam.z * sn);
    fondoVisto = Math.max(fondoVisto, tam.x * sn + tam.z * c);
  }
  const altoVisto = (h) => h * Math.cos(INCLINACION) + fondoVisto * Math.sin(INCLINACION);
  const montado = Math.min(ancho / (anchoVisto * 1.04), alto / (altoVisto(tam.y) * 1.06));
  const despiezado = Math.min(ancho / (anchoVisto * 1.1), alto / (altoVisto(tam.y + subida - bajada) * 1.1));

  const grupo = useRef();
  const t = useRef(0);
  const esquina = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    // Hacia `abierto` a ritmo fijo; cada pieza tiene su tramo del recorrido
    // y sale cuando le toca. Al volver, el mismo reloj las recoge al reves.
    const paso = Math.min(dt, 0.05) / RECORRIDO;
    t.current = abierto.current > t.current ? Math.min(abierto.current, t.current + paso) : Math.max(abierto.current, t.current - paso);
    const k = suave(t.current);
    const n = piezas.turnos;
    // Lo que han subido YA las piezas: la primera sube entera cuando el
    // reloj apenas empieza, y el borde de arriba tiene que contarla.
    let subido = 0;
    for (const p of piezas) {
      const inicio = n > 1 ? (p.turno / (n - 1)) * (1 - TRAMO) : 0;
      p.f = suave((t.current - inicio) / TRAMO);
    }
    for (const p of piezas) {
      p.o.position.copy(p.reposo).addScaledVector(p.delta, p.f);
      if (p.guia) p.o.position.addScaledVector(p.guia.delta, p.guia.f);
      subido = Math.max(subido, p.sube * Math.max(p.f, p.guia ? p.guia.f : 0));
    }
    if (grupo.current) {
      // Se aleja en cuanto algo sube, no al ritmo del reloj.
      const e = montado + (despiezado - montado) * Math.max(k, subida > 0 ? subido / subida : 0);
      grupo.current.scale.setScalar(e);
      grupo.current.position.y = -((subida + bajada) / 2) * e * k;
    }
    // Pegado ARRIBA del hueco, no centrado: centrado, el dron quedaba por
    // debajo del texto de al lado. Se proyectan las 8 esquinas de su caja en
    // ESTE fotograma (el encaje de arriba es para el peor angulo y deja
    // holgura) y se sube `alzado`, que envuelve el giro: subir el modelo
    // dentro del grupo inclinado lo acercaria tambien a la camara.
    const a = alzado.current;
    if (a && grupo.current) {
      a.position.y = 0;
      a.updateMatrixWorld(true);
      // `caja` esta en el espacio de `grupo`, antes de restar `centro`.
      const m = grupo.current.matrixWorld;
      let peor = -Infinity, py = 0, pz = 0;
      for (let i = 0; i < 8; i++) {
        esquina.set(
          i & 1 ? caja.max.x : caja.min.x,
          i & 2 ? caja.max.y + subido : caja.min.y,
          i & 4 ? caja.max.z : caja.min.z,
        ).sub(centro).applyMatrix4(m);
        // El que mas arriba se proyecta: altura / distancia a la camara.
        const r = esquina.y / (6 - esquina.z);
        if (r > peor) { peor = r; py = esquina.y; pz = esquina.z; }
      }
      a.position.y = TOPE * (6 - pz) - py;
    }
  });

  return (
    <group ref={grupo} scale={montado}>
      <primitive object={scene} position={[-centro.x, -centro.y, -centro.z]} />
    </group>
  );
}

function Girado({ mando, quieto, giro, vaiven, children }) {
  const g = useRef();
  const reloj = useRef(0);
  useFrame((_, dt) => {
    if (!g.current) return;
    const m = mando.current;
    const paso = Math.min(dt, 0.05);
    if (m.dx || m.dy) {
      g.current.rotation.y += m.dx;
      g.current.rotation.x = Math.max(-0.6, Math.min(0.9, g.current.rotation.x + m.dy));
      m.giro = m.dx;
      m.dx = m.dy = 0;
    }
    if (m.agarrado) return;
    m.giro *= Math.exp(-paso * 2.6);
    if (vaiven && !quieto) {
      // Se mece alrededor de su frente; si lo han girado a mano, vuelve.
      reloj.current += paso;
      const objetivo = giro + Math.sin(reloj.current * 0.35) * vaiven;
      g.current.rotation.y += m.giro + (objetivo - g.current.rotation.y) * (1 - Math.exp(-paso * 1.2));
    } else {
      g.current.rotation.y += m.giro + (quieto ? 0 : paso * 0.25);
    }
    g.current.rotation.x += (INCLINACION - g.current.rotation.x) * (1 - Math.exp(-paso * 1.8));
  });
  return <group ref={g} rotation={[INCLINACION, giro, 0]}>{children}</group>;
}

// `giro`: hacia donde mira al empezar (radianes en torno a la vertical).
// `vaiven`: si se da, en vez de girar entero se mece esa amplitud alrededor de
// `giro` (la caja abierta tiene que enseñar siempre el interior).
export default function ProductViewer({ model, label, despiece, colores = [], giro = -0.6, vaiven = 0 }) {
  const { tr } = useLang();
  const url = asset(model);
  const caja = useRef(null);
  const mando = useRef({ agarrado: false, dx: 0, dy: 0, giro: 0, x: 0, y: 0 });
  const abierto = useRef(0);
  const alzado = useRef(null);
  const [listo, setListo] = useState(false);
  const [despiezado, setDespiezado] = useState(false);
  const quieto = prefersReducedMotion();

  // La primera vez que se ve: se despieza y se vuelve a montar solo, para que
  // se entienda que se puede explorar. Una vez; despues manda el boton.
  useEffect(() => {
    const el = caja.current;
    if (!el || !listo || quieto || typeof IntersectionObserver !== "function") return undefined;
    let t1, t2;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      t1 = setTimeout(() => { abierto.current = 1; }, 400);
      t2 = setTimeout(() => { abierto.current = 0; }, 400 + RECORRIDO * 1000 + 1400);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => { obs.disconnect(); clearTimeout(t1); clearTimeout(t2); };
  }, [listo, quieto]);

  const alternar = () => {
    const siguiente = !despiezado;
    setDespiezado(siguiente);
    abierto.current = siguiente ? 1 : 0;
  };

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
    <div className="producto" ref={caja} data-listo={listo ? "true" : "false"}
      onPointerDown={agarrar} onPointerMove={girar} onPointerUp={soltar}
      onPointerCancel={soltar} onPointerLeave={soltar}>
      <View className="producto__hueco">
        <PerspectiveCamera makeDefault fov={35} position={[0, 0, 6]} onUpdate={(c) => c.lookAt(0, 0, 0)} />
        <Luces />
        <group ref={alzado}>
          <Girado mando={mando} quieto={quieto} giro={giro} vaiven={vaiven}>
            <Suspense fallback={null}>
              <Modelo url={url} despiece={despiece} colores={colores} abierto={abierto} onReady={() => setListo(true)} giro={giro} vaiven={vaiven} alzado={alzado} />
            </Suspense>
          </Girado>
        </group>
      </View>
      <div className="producto__pie">
        <span className="producto__nombre">{label}</span>
        <button type="button" className="producto__boton" onPointerDown={(e) => e.stopPropagation()}
          onClick={alternar} disabled={!listo} aria-pressed={despiezado}>
          {despiezado ? tr({ es: "Montar", en: "Assemble" }) : tr({ es: "Ver despiece", en: "Exploded view" })}
        </button>
      </div>
    </div>
  );
}
