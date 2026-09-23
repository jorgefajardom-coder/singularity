import { Box3, BufferAttribute, Matrix3, Matrix4, Vector3 } from "three";

export function assemblyRoot(scene) {
  return scene.getObjectByName("completo_v2") || scene.getObjectByName("completo v2") || scene;
}

// Each connected component gets its own trajectory. The GPU moves vertices,
// keeping one draw call per original material instead of thousands of meshes.
export function prepareAssembly(scene) {
  scene.updateMatrixWorld(true);
  const root = assemblyRoot(scene);
  const toModel = new Matrix4().copy(scene.matrixWorld).invert();
  const bounds = new Box3().setFromObject(root).applyMatrix4(toModel);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3()).length() || 1;
  const parts = [];
  const resources = [];
  const elapsed = { value: 0 };
  for (const assembly of root.children) {
    if (assembly.name === "Plane") continue;
    const assemblyCenter = new Box3().setFromObject(assembly).getCenter(new Vector3()).applyMatrix4(toModel);
    assembly.traverse(node => {
      if (!node.isMesh || node.isSkinnedMesh) return;
      const source = node.geometry;
      const positions = source.attributes.position;
      if (!positions) return;
      const labels = source.attributes._piece;
      const transform = toModel.clone().multiply(node.matrixWorld);
      const inverse = new Matrix3().setFromMatrix4(transform).invert();
      const boxes = new Map(), point = new Vector3();
      for (let i = 0; i < positions.count; i++) {
        const id = labels ? labels.getX(i) : 0;
        if (!boxes.has(id)) boxes.set(id, new Box3());
        boxes.get(id).expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(transform));
      }
      const trajectories = new Map();
      for (const [id, box] of boxes) {
        const order = parts.length;
        const radial = assemblyCenter.clone().sub(center).setY(0);
        if (radial.lengthSq() < 1e-8) radial.set(1, 0, 0);
        radial.normalize().multiplyScalar(size * 0.1);
        const detail = box.getCenter(new Vector3()).sub(assemblyCenter);
        if (detail.lengthSq() < 1e-8) detail.set(Math.cos(order * 2.399963), 0.4, Math.sin(order * 2.399963));
        detail.normalize().multiplyScalar(size * (0.025 + order % 5 * 0.008));
        const modelOffset = radial.add(detail);
        modelOffset.y += size * (0.07 + order % 7 * 0.012);
        const part = { node, id, box, offset: modelOffset.clone().applyMatrix3(inverse), modelOffset, order,
          rest: node.position.clone(), visible: node.visible, duration: 2.6 };
        trajectories.set(id, part);
        parts.push(part);
      }
      const geometry = source.clone();
      const offsets = new Float32Array(positions.count * 3);
      const delays = new Float32Array(positions.count);
      for (let i = 0; i < positions.count; i++) {
        const part = trajectories.get(labels ? labels.getX(i) : 0);
        part.offset.toArray(offsets, i * 3);
        delays[i] = part.order;
      }
      geometry.setAttribute('assemblyOffset', new BufferAttribute(offsets, 3));
      geometry.setAttribute('assemblyDelay', new BufferAttribute(delays, 1));
      const originalMaterial = node.material;
      const animate = original => {
        const material = original.clone();
        material.onBeforeCompile = shader => {
          shader.uniforms.assemblyElapsed = elapsed;
          shader.vertexShader = 'attribute vec3 assemblyOffset;\nattribute float assemblyDelay;\nuniform float assemblyElapsed;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
            '#include <begin_vertex>\nfloat assemblyT = clamp((assemblyElapsed - assemblyDelay) / 2.6, 0.0, 1.0);\ntransformed += assemblyOffset * (1.0 - assemblyT * assemblyT * (3.0 - 2.0 * assemblyT));');
        };
        material.customProgramCacheKey = () => 'individual-assembly-v1';
        return material;
      };
      node.geometry = geometry;
      node.material = Array.isArray(originalMaterial) ? originalMaterial.map(animate) : animate(originalMaterial);
      resources.push({ node, source, originalMaterial, geometry, frustumCulled: node.frustumCulled });
      // Rest-pose bounds do not contain the exploded vertices.
      node.frustumCulled = false;
    });
  }
  for (const part of parts) {
    part.delay = 0.45 + part.order / Math.max(1, parts.length - 1) * 1.4;
    part.end = part.delay + part.duration;
  }
  for (const { geometry } of resources) {
    const delays = geometry.attributes.assemblyDelay;
    for (let i = 0; i < delays.count; i++) delays.setX(i, parts[delays.getX(i)].delay);
  }
  parts.resources = resources;
  parts.elapsed = elapsed;
  return parts;
}
export function assemblyAmount(elapsed, delay, duration = 2.6) {
  const t = Math.max(0, Math.min(1, (elapsed - delay) / duration));
  return 1 - t * t * (3 - 2 * t);
}
export function presentationTime(parts, elapsed) {
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
