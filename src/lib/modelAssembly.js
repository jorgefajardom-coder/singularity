import { Box3, BufferAttribute, BufferGeometry, Matrix3, Matrix4, Vector3 } from "three";

export function assemblyRoot(scene) {
  return scene.getObjectByName("completo_v2") || scene.getObjectByName("completo v2") || scene;
}

const DURATION = 2.6;

// Mallas que se despiezan, en orden de recorrido. El clon de una escena se
// recorre en el mismo orden que el original, y eso es lo que permite calcular
// el plan sobre uno y aplicarlo al otro.
function assemblyMeshes(root) {
  const out = [];
  for (const assembly of root.children) {
    if (assembly.name === "Plane") continue;
    assembly.traverse(node => {
      if (node.isMesh && !node.isSkinnedMesh && node.geometry.attributes.position) out.push({ assembly, node });
    });
  }
  return out;
}

/**
 * EL PLAN DEL DESPIECE: de donde sale cada pieza y en que orden llega.
 *
 * Es lo caro —recorre los ~3,7 millones de vertices de la celda— y no depende
 * de nada que cambie entre montajes: solo de la geometria y de donde esta cada
 * malla DENTRO de la escena. Por eso se calcula una vez, en segundo plano al
 * descargar el modelo (ver `planAssemblyIdle`), y abrir el proyecto o repetir
 * el montaje ya no lo paga.
 *
 * Es un generador que cede el paso tras cada malla, para poder repartirlo en
 * los ratos libres del navegador sin trabar el scroll.
 */
function* planSteps(scene) {
  scene.updateMatrixWorld(true);
  const root = assemblyRoot(scene);
  const toModel = new Matrix4().copy(scene.matrixWorld).invert();
  const bounds = new Box3().setFromObject(root).applyMatrix4(toModel);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3()).length() || 1;
  const meshes = [];
  const centers = new Map();
  let count = 0;

  for (const { assembly, node } of assemblyMeshes(root)) {
    if (!centers.has(assembly)) {
      centers.set(assembly, new Box3().setFromObject(assembly).getCenter(new Vector3()).applyMatrix4(toModel));
    }
    const assemblyCenter = centers.get(assembly);
    const positions = node.geometry.attributes.position;
    const labels = node.geometry.attributes._piece;
    const n = positions.count;
    const transform = toModel.clone().multiply(node.matrixWorld);
    const inverse = new Matrix3().setFromMatrix4(transform).invert();
    const e = transform.elements;

    // Caja de cada pieza en el espacio del modelo. Las etiquetas son enteros
    // seguidos desde 0, asi que un array plano sustituye al Map: con millones
    // de vertices, la busqueda por clave se comia buena parte del tiempo.
    let maxId = 0;
    if (labels) for (let i = 0; i < n; i++) { const id = labels.getX(i); if (id > maxId) maxId = id; }
    const mm = new Float64Array((maxId + 1) * 6);
    // Orden de primera aparicion: es el que tenia el despiece y el que decide
    // hacia donde sale cada pieza. Cambiarlo cambiaria la coreografia.
    const seen = new Uint8Array(maxId + 1);
    const firstSeen = [];
    for (let k = 0; k <= maxId; k++) {
      mm[k * 6] = mm[k * 6 + 1] = mm[k * 6 + 2] = Infinity;
      mm[k * 6 + 3] = mm[k * 6 + 4] = mm[k * 6 + 5] = -Infinity;
    }
    for (let i = 0; i < n; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const id = labels ? labels.getX(i) : 0;
      if (!seen[id]) { seen[id] = 1; firstSeen.push(id); }
      const o = id * 6;
      if (wx < mm[o]) mm[o] = wx;
      if (wy < mm[o + 1]) mm[o + 1] = wy;
      if (wz < mm[o + 2]) mm[o + 2] = wz;
      if (wx > mm[o + 3]) mm[o + 3] = wx;
      if (wy > mm[o + 4]) mm[o + 4] = wy;
      if (wz > mm[o + 5]) mm[o + 5] = wz;
    }

    // Una trayectoria por pieza: hacia fuera del centro de la celda, algo de
    // dispersion propia y un poco de altura.
    const parts = [];
    const byId = new Array(maxId + 1);
    for (const id of firstSeen) {
      const box = new Box3(new Vector3(mm[id * 6], mm[id * 6 + 1], mm[id * 6 + 2]), new Vector3(mm[id * 6 + 3], mm[id * 6 + 4], mm[id * 6 + 5]));
      const order = count++;
      const radial = assemblyCenter.clone().sub(center).setY(0);
      if (radial.lengthSq() < 1e-8) radial.set(1, 0, 0);
      radial.normalize().multiplyScalar(size * 0.1);
      const detail = box.getCenter(new Vector3()).sub(assemblyCenter);
      if (detail.lengthSq() < 1e-8) detail.set(Math.cos(order * 2.399963), 0.4, Math.sin(order * 2.399963));
      detail.normalize().multiplyScalar(size * (0.025 + order % 5 * 0.008));
      const modelOffset = radial.add(detail);
      modelOffset.y += size * (0.07 + order % 7 * 0.012);
      const part = { id, box, order, modelOffset, offset: modelOffset.clone().applyMatrix3(inverse) };
      byId[id] = part;
      parts.push(part);
    }

    // Por vertice: el desplazamiento de su pieza (en el espacio de la malla) y
    // su numero de orden. El retraso sale del orden en el propio shader.
    const offsets = new Float32Array(n * 3);
    const orders = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const part = byId[labels ? labels.getX(i) : 0];
      offsets[i * 3] = part.offset.x;
      offsets[i * 3 + 1] = part.offset.y;
      offsets[i * 3 + 2] = part.offset.z;
      orders[i] = part.order;
    }
    meshes.push({ vertices: n, parts, offsets, orders });
    yield;
  }
  return { meshes, count };
}

// Retraso de cada pieza a partir de su orden: la primera sale a los 0,45 s y
// la ultima 1,4 s despues. El shader hace la misma cuenta (ver `step`).
const delayOf = (order, count) => 0.45 + order / Math.max(1, count - 1) * 1.4;

/** El plan de una vez, sin repartir. */
export function planAssembly(scene) {
  const steps = planSteps(scene);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

/**
 * El plan repartido en los ratos libres del navegador: tantas mallas por hueco
 * como quepan, para no bloquear mas de unos milisegundos seguidos.
 */
export function planAssemblyIdle(scene) {
  const steps = planSteps(scene);
  const later = typeof requestIdleCallback === "function"
    ? (fn) => requestIdleCallback(fn, { timeout: 400 })
    : (fn) => setTimeout(() => fn(null), 16);
  return new Promise((resolve, reject) => {
    const work = (deadline) => {
      try {
        let step;
        do step = steps.next();
        while (!step.done && deadline && deadline.timeRemaining() > 4);
        if (step.done) resolve(step.value);
        else later(work);
      } catch (error) {
        reject(error);
      }
    };
    later(work);
  });
}

/**
 * Aplica el plan a una escena (normalmente un clon de la que se planifico).
 * Cada pieza recibe su recorrido en la GPU, con una llamada de dibujo por
 * material original en vez de miles de mallas.
 */
export function prepareAssembly(scene, plan) {
  scene.updateMatrixWorld(true);
  const meshes = assemblyMeshes(assemblyRoot(scene));
  // Un plan de OTRA geometria no sirve: se rehace aqui.
  if (!plan || meshes.length !== plan.meshes.length
    || meshes.some(({ node }, k) => node.geometry.attributes.position.count !== plan.meshes[k].vertices)) {
    plan = planAssembly(scene);
  }
  const parts = [];
  const resources = [];
  const elapsed = { value: 0 };
  const step = { value: 1.4 / Math.max(1, plan.count - 1) };

  meshes.forEach(({ node }, k) => {
    const mesh = plan.meshes[k];
    for (const p of mesh.parts) {
      const delay = delayOf(p.order, plan.count);
      parts.push({ node, id: p.id, box: p.box, offset: p.offset, modelOffset: p.modelOffset, order: p.order,
        rest: node.position.clone(), visible: node.visible, duration: DURATION, delay, end: delay + DURATION });
    }
    const source = node.geometry;
    // Copia LIGERA: comparte los atributos del original en vez de duplicar
    // decenas de megas de vertices en cada montaje.
    const geometry = new BufferGeometry();
    geometry.setIndex(source.index);
    for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
    for (const g of source.groups) geometry.addGroup(g.start, g.count, g.materialIndex);
    geometry.boundingBox = source.boundingBox;
    geometry.boundingSphere = source.boundingSphere;
    geometry.setAttribute("assemblyOffset", new BufferAttribute(mesh.offsets, 3));
    geometry.setAttribute("assemblyDelay", new BufferAttribute(mesh.orders, 1));

    const originalMaterial = node.material;
    const animate = original => {
      const material = original.clone();
      material.onBeforeCompile = shader => {
        shader.uniforms.assemblyElapsed = elapsed;
        shader.uniforms.assemblyStep = step;
        shader.vertexShader = "attribute vec3 assemblyOffset;\nattribute float assemblyDelay;\nuniform float assemblyElapsed;\nuniform float assemblyStep;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
          "#include <begin_vertex>\nfloat assemblyT = clamp((assemblyElapsed - (0.45 + assemblyDelay * assemblyStep)) / 2.6, 0.0, 1.0);\ntransformed += assemblyOffset * (1.0 - assemblyT * assemblyT * (3.0 - 2.0 * assemblyT));");
      };
      material.customProgramCacheKey = () => "individual-assembly-v2";
      return material;
    };
    node.geometry = geometry;
    node.material = Array.isArray(originalMaterial) ? originalMaterial.map(animate) : animate(originalMaterial);
    resources.push({ node, source, originalMaterial, geometry, frustumCulled: node.frustumCulled });
    // Rest-pose bounds do not contain the exploded vertices.
    node.frustumCulled = false;
  });

  parts.resources = resources;
  parts.elapsed = elapsed;
  return parts;
}
export function assemblyAmount(elapsed, delay, duration = DURATION) {
  const t = Math.max(0, Math.min(1, (elapsed - delay) / duration));
  return 1 - t * t * (3 - 2 * t);
}
export function presentationTime(parts, elapsed) {
  // Las piezas estan en orden de llegada: la ultima es la que acaba mas tarde.
  return { time: elapsed, complete: elapsed >= (parts.at(-1)?.end || 0) };
}
export function poseAssembly(parts, elapsed, reduced = false) {
  parts.elapsed.value = reduced || !Number.isFinite(elapsed) ? 1e6 : elapsed;
  return reduced || presentationTime(parts, elapsed).complete;
}
export function disposeAssembly(parts) {
  for (const { node, source, originalMaterial, geometry, frustumCulled } of parts.resources) {
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
    node.material = originalMaterial;
    node.geometry = source;
    node.frustumCulled = frustumCulled;
    geometry.dispose();
  }
}
