// Restore selected assemblies from the Unity export without reprocessing the
// rest of the web asset. Dependencies are supplied by the existing drei stack.
// Usage: node tools/repair-celda.mjs source.glb current.glb output.glb
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Matrix4, Matrix3, Quaternion, Vector3, Box3 } from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';

const [sourcePath, currentPath, outputPath] = process.argv.slice(2);
assert(sourcePath && currentPath && outputPath, 'Expected source, current and output GLB paths');
assert(path.resolve(outputPath) !== path.resolve(sourcePath), 'Never overwrite the source');
assert(path.resolve(outputPath) !== path.resolve(currentPath), 'Write a candidate before replacing the web asset');
function openGlb(file) {
  const fd = fs.openSync(file, 'r');
  const header = Buffer.alloc(20);
  fs.readSync(fd, header, 0, 20, 0);
  assert.equal(header.readUInt32LE(0), 0x46546c67);
  const bytes = Buffer.alloc(header.readUInt32LE(12));
  fs.readSync(fd, bytes, 0, bytes.length, 20);
  return { fd, json: JSON.parse(bytes), base: 28 + bytes.length };
}
const source = openGlb(sourcePath), current = openGlb(currentPath);
const src = source.json, out = structuredClone(current.json);
const bin = Buffer.alloc(out.buffers[0].byteLength);
fs.readSync(current.fd, bin, 0, bin.length, current.base);
const chunks = [bin];
let byteLength = bin.length;
function append(bytes) {
  const pad = (4 - byteLength % 4) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); byteLength += pad; }
  const view = out.bufferViews.length;
  out.bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length });
  chunks.push(bytes); byteLength += bytes.length;
  return view;
}
function accessor(index) {
  const a = src.accessors[index], v = src.bufferViews[a.bufferView];
  assert(!a.sparse && !a.normalized, 'Unexpected sparse or normalized source accessor');
  const types = { 5126: [Float32Array, 4, 'readFloatLE'], 5125: [Uint32Array, 4, 'readUInt32LE'], 5123: [Uint16Array, 2, 'readUInt16LE'], 5121: [Uint8Array, 1, 'readUInt8'] };
  const [Type, size, read] = types[a.componentType];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const stride = v.byteStride || width * size;
  const bytes = Buffer.alloc((a.count - 1) * stride + width * size);
  fs.readSync(source.fd, bytes, 0, bytes.length, source.base + (v.byteOffset || 0) + (a.byteOffset || 0));
  const values = new Type(a.count * width);
  for (let i = 0; i < a.count; i++) for (let j = 0; j < width; j++) values[i * width + j] = bytes[read](i * stride + j * size);
  return values;
}
function matrix(n) {
  return n.matrix ? new Matrix4().fromArray(n.matrix) : new Matrix4().compose(
    new Vector3().fromArray(n.translation || [0, 0, 0]),
    new Quaternion().fromArray(n.rotation || [0, 0, 0, 1]),
    new Vector3().fromArray(n.scale || [1, 1, 1]));
}
const encoderModule = await draco3d.createEncoderModule({});
const decoderModule = await draco3d.createDecoderModule({});
await MeshoptSimplifier.ready;
const materialMap = new Map();
const textureMap = new Map();
function texture(index) {
  if (textureMap.has(index)) return textureMap.get(index);
  const t = structuredClone(src.textures[index]);
  const img = structuredClone(src.images[t.source]);
  assert(img.bufferView !== undefined && !img.uri);
  const view = src.bufferViews[img.bufferView], bytes = Buffer.alloc(view.byteLength);
  fs.readSync(source.fd, bytes, 0, bytes.length, source.base + (view.byteOffset || 0));
  img.bufferView = append(bytes);
  out.images ||= []; out.textures ||= []; out.samplers ||= [];
  t.source = out.images.length; out.images.push(img);
  if (t.sampler !== undefined) {
    const sampler = structuredClone(src.samplers[t.sampler]);
    t.sampler = out.samplers.length; out.samplers.push(sampler);
  }
  const result = out.textures.length; out.textures.push(t);
  textureMap.set(index, result);
  return result;
}
function material(index) {
  if (index === undefined) return undefined;
  if (!materialMap.has(index)) {
    const m = structuredClone(src.materials[index]);
    const colorTexture = m.pbrMetallicRoughness?.baseColorTexture;
    if (colorTexture) colorTexture.index = texture(colorTexture.index);
    assert(!m.normalTexture && !m.emissiveTexture && !m.occlusionTexture && !m.pbrMetallicRoughness?.metallicRoughnessTexture);
    materialMap.set(index, out.materials.length);
    out.materials.push(m);
  }
  return materialMap.get(index);
}
const primitiveCache = new Map();
function geometry(primitive, exact) {
  const textured = !!src.materials[primitive.material]?.pbrMetallicRoughness?.baseColorTexture;
  const key = `${primitive.attributes.POSITION}:${primitive.indices}:${exact}:${textured}`;
  if (primitiveCache.has(key)) return primitiveCache.get(key);
  assert(primitive.mode === undefined || primitive.mode === 4);
  // Keep UVs for textured materials. The remaining materials use solid
  // colors; vertex colors and skinning must not be silently dropped.
  assert(Object.keys(primitive.attributes).every(k => ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TEXCOORD_1', 'TANGENT'].includes(k)), 'Unexpected vertex attributes');
  const positions = accessor(primitive.attributes.POSITION);
  const normals = primitive.attributes.NORMAL === undefined ? null : accessor(primitive.attributes.NORMAL);
  const uv = textured ? accessor(primitive.attributes.TEXCOORD_0) : null;
  let indices = primitive.indices === undefined ? Uint32Array.from({ length: positions.length / 3 }, (_, i) => i) : new Uint32Array(accessor(primitive.indices));
  const originalTriangles = indices.length / 3;
  let error = 0;
  // Arms remain exact. On tiny CAD components, cap simplification error at
  // 0.15% of each component's size rather than discarding entire components.
  if (!exact && !textured && indices.length > 6000) {
    [indices, error] = MeshoptSimplifier.simplify(indices, positions, 3,
      Math.max(600, Math.floor(indices.length * 0.025 / 3) * 3), 0.0015, ['Permissive']);
  }
  const [remap, count] = MeshoptSimplifier.compactMesh(indices);
  const compactPositions = new Float32Array(count * 3);
  const compactNormals = normals ? new Float32Array(count * 3) : null;
  const compactUv = uv ? new Float32Array(count * 2) : null;
  for (let i = 0; i < remap.length; i++) if (remap[i] !== 0xffffffff) {
    compactPositions.set(positions.subarray(i * 3, i * 3 + 3), remap[i] * 3);
    if (normals) compactNormals.set(normals.subarray(i * 3, i * 3 + 3), remap[i] * 3);
    if (uv) compactUv.set(uv.subarray(i * 2, i * 2 + 2), remap[i] * 2);
  }
  const result = { positions: compactPositions, normals: compactNormals, uv: compactUv, indices, originalTriangles, error };
  primitiveCache.set(key, result);
  return result;
}
function compressedPrimitive(parts, materialIndex) {
  const count = parts.reduce((sum, p) => sum + p.positions.length / 3, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
  const uv = parts[0].uv ? new Float32Array(count * 2) : null;
  const indices = new Uint32Array(parts.reduce((sum, p) => sum + p.indices.length, 0));
  let vertexOffset = 0, indexOffset = 0;
  for (const part of parts) {
    positions.set(part.positions, vertexOffset * 3);
    normals.set(part.normals, vertexOffset * 3);
    if (uv) uv.set(part.uv, vertexOffset * 2);
    for (let i = 0; i < part.indices.length; i++) indices[indexOffset + i] = part.indices[i] + vertexOffset;
    vertexOffset += part.positions.length / 3; indexOffset += part.indices.length;
  }
  const e = encoderModule, builder = new e.MeshBuilder(), mesh = new e.Mesh(), encoder = new e.Encoder(), bytes = new e.DracoInt8Array();
  builder.AddFacesToMesh(mesh, indices.length / 3, indices);
  const posId = builder.AddFloatAttributeToMesh(mesh, e.POSITION, count, 3, positions);
  const normalId = builder.AddFloatAttributeToMesh(mesh, e.NORMAL, count, 3, normals);
  const uvId = uv ? builder.AddFloatAttributeToMesh(mesh, e.TEX_COORD, count, 2, uv) : null;
  encoder.SetSpeedOptions(5, 5);
  encoder.SetAttributeQuantization(e.POSITION, 16);
  encoder.SetAttributeQuantization(e.NORMAL, 12);
  if (uv) encoder.SetAttributeQuantization(e.TEX_COORD, 14);
  const length = encoder.EncodeMeshToDracoBuffer(mesh, bytes);
  assert(length > 0, 'Draco encoding failed');
  const buffer = Buffer.alloc(length);
  for (let i = 0; i < length; i++) buffer[i] = bytes.GetValue(i);
  // Decode every result: Draco may deduplicate vertices during encoding.
  const d = decoderModule, decoder = new d.Decoder(), db = new d.DecoderBuffer(), decoded = new d.Mesh();
  db.Init(new Int8Array(buffer), buffer.length);
  const status = decoder.DecodeBufferToMesh(db, decoded);
  assert(status.ok(), status.error_msg());
  assert.equal(decoded.num_faces(), indices.length / 3);
  const decodedCount = decoded.num_points();
  const box = new Box3(), v = new Vector3();
  const values = new d.DracoFloat32Array();
  decoder.GetAttributeFloatForAllPoints(decoded, decoder.GetAttributeByUniqueId(decoded, posId), values);
  for (let i = 0; i < values.size(); i += 3) {
    v.set(values.GetValue(i), values.GetValue(i + 1), values.GetValue(i + 2));
    assert(v.toArray().every(Number.isFinite)); box.expandByPoint(v);
  }
  const start = out.accessors.length;
  out.accessors.push(
    { componentType: 5126, count: decodedCount, type: 'VEC3', min: box.min.toArray(), max: box.max.toArray() },
    { componentType: 5126, count: decodedCount, type: 'VEC3' },
    { componentType: 5125, count: indices.length, type: 'SCALAR' });
  const result = { attributes: { POSITION: start, NORMAL: start + 1 }, indices: start + 2,
    material: material(materialIndex), extensions: { KHR_draco_mesh_compression: { bufferView: append(buffer), attributes: { POSITION: posId, NORMAL: normalId } } } };
  if (uv) {
    result.attributes.TEXCOORD_0 = out.accessors.length;
    result.extensions.KHR_draco_mesh_compression.attributes.TEXCOORD_0 = uvId;
    out.accessors.push({ componentType: 5126, count: decodedCount, type: 'VEC2' });
  }
  for (const item of [values, decoded, db, decoder, status]) d.destroy(item);
  for (const item of [bytes, encoder, mesh, builder]) e.destroy(item);
  return result;
}
const names = ['Alpha', 'Beta', 'BasePrefab', 'PCBPrefab', 'Motor1Prefab', 'Motor2Prefab', 'Motor3Prefab', 'Motor4Prefab', 'TapaPrefab', 'Helice1Prefab', 'Helice2Prefab', 'Helice3Prefab', 'Helice4Prefab', 'CajaPrefab'];
const root = out.nodes.find(n => n.name === 'completo v2');
assert(root);
const report = [];
for (const name of names) {
  const node = src.nodes.find(n => n.name === name);
  assert(node, `Missing source assembly ${name}`);
  const grouped = new Map(), sourceBounds = new Box3(), restoredBounds = new Box3();
  let originalTriangles = 0, triangles = 0, pieces = 0;
  const exact = ['Alpha', 'Beta'].includes(name), v = new Vector3();
  function visit(n, parent) {
    const transform = parent.clone().multiply(matrix(n));
    if (n.mesh !== undefined) {
      pieces++;
      const normalMatrix = new Matrix3().getNormalMatrix(transform);
      for (const p of src.meshes[n.mesh].primitives) {
        const g = geometry(p, exact);
        originalTriangles += g.originalTriangles; triangles += g.indices.length / 3;
        assert(g.normals, 'Expected source normals');
        const positions = g.positions.slice(), normals = g.normals.slice(), indices = g.indices.slice();
        const original = accessor(p.attributes.POSITION);
        for (let i = 0; i < original.length; i += 3) sourceBounds.expandByPoint(v.fromArray(original, i).applyMatrix4(transform));
        for (let i = 0; i < positions.length; i += 3) {
          v.fromArray(positions, i).applyMatrix4(transform); restoredBounds.expandByPoint(v); v.toArray(positions, i);
          v.fromArray(normals, i).applyMatrix3(normalMatrix).normalize().toArray(normals, i);
        }
        if (transform.determinant() < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
        if (!grouped.has(p.material)) grouped.set(p.material, []);
        grouped.get(p.material).push({ positions, normals, indices, uv: g.uv });
      }
    }
    for (const child of n.children || []) visit(src.nodes[child], transform);
  }
  // The assembly's transform stays on its root. Bake descendants only, so
  // nested CAD scales and rotations are applied exactly once.
  for (const child of node.children || []) visit(src.nodes[child], new Matrix4());
  assert(node.mesh === undefined, 'Expected assembly root');
  if (exact) {
    assert.equal(triangles, originalTriangles);
    assert(sourceBounds.min.distanceTo(restoredBounds.min) < 1e-6);
    assert(sourceBounds.max.distanceTo(restoredBounds.max) < 1e-6);
  }
  const meshIndex = out.meshes.length;
  out.meshes.push({ name: `${name}_restored`, primitives: [...grouped].map(([m, parts]) => compressedPrimitive(parts, m)) });
  const childIndex = out.nodes.length;
  out.nodes.push({ name: `${name}_restored`, mesh: meshIndex });
  const replacement = { ...structuredClone(node), children: [childIndex] };
  const existing = out.nodes.findIndex(n => n.name === name);
  if (existing >= 0) out.nodes[existing] = replacement;
  else { root.children.push(out.nodes.length); out.nodes.push(replacement); }
  const item = { name, pieces, originalTriangles, triangles, sourceBounds: [sourceBounds.min.toArray(), sourceBounds.max.toArray()], restoredBounds: [restoredBounds.min.toArray(), restoredBounds.max.toArray()] };
  report.push(item);
  console.log(JSON.stringify({ name, pieces, originalTriangles, triangles }));
}
out.buffers = [{ byteLength }];
out.asset.generator = 'Portfolio restoration from Unity glTF; original assembly transforms preserved';
const json = Buffer.from(JSON.stringify(out));
const jsonPadding = Buffer.alloc((4 - json.length % 4) % 4, 0x20);
const binPadding = Buffer.alloc((4 - byteLength % 4) % 4);
const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + jsonPadding.length + byteLength + binPadding.length, 8);
header.writeUInt32LE(json.length + jsonPadding.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
binHeader.writeUInt32LE(byteLength + binPadding.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(outputPath, Buffer.concat([header, json, jsonPadding, binHeader, ...chunks, binPadding]));
fs.writeFileSync(`${outputPath}.report.json`, JSON.stringify(report, null, 2));
fs.closeSync(source.fd); fs.closeSync(current.fd);
console.log(`Validated ${report.length} assemblies; candidate: ${fs.statSync(outputPath).size} bytes`);
