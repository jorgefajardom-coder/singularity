// Align robot mounting heights and restore the exported safety marking.
// Usage: node tools/align-celda.mjs input.glb output.glb
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import draco3d from 'draco3d';
import { Matrix4, Quaternion, Vector3, Matrix3, Box3 } from 'three';

const [input, output] = process.argv.slice(2);
assert(input && output && path.resolve(input) !== path.resolve(output));
const bytes = fs.readFileSync(input), jsonLength = bytes.readUInt32LE(12);
const g = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binary = bytes.subarray(28 + jsonLength, 28 + jsonLength + g.buffers[0].byteLength);
const chunks = [binary]; let length = binary.length;
const d = await draco3d.createDecoderModule({}), e = await draco3d.createEncoderModule({});
function append(buffer) {
  const pad = (4 - length % 4) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
  const index = g.bufferViews.length;
  g.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: buffer.length });
  chunks.push(buffer); length += buffer.length; return index;
}
function matrix(n) {
  return n.matrix ? new Matrix4().fromArray(n.matrix) : new Matrix4().compose(
    new Vector3().fromArray(n.translation || [0, 0, 0]),
    new Quaternion().fromArray(n.rotation || [0, 0, 0, 1]),
    new Vector3().fromArray(n.scale || [1, 1, 1]));
}
function decode(p) {
  const ext = p.extensions.KHR_draco_mesh_compression, view = g.bufferViews[ext.bufferView];
  const decoder = new d.Decoder(), db = new d.DecoderBuffer(), mesh = new d.Mesh();
  const data = binary.subarray(view.byteOffset, view.byteOffset + view.byteLength);
  db.Init(new Int8Array(data), data.length);
  const status = decoder.DecodeBufferToMesh(db, mesh); assert(status.ok());
  const attrs = {};
  for (const [name, id] of Object.entries(ext.attributes)) {
    const attr = decoder.GetAttributeByUniqueId(mesh, id), values = new d.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(mesh, attr, values);
    attrs[name] = { width: attr.num_components(), values: Float32Array.from({ length: values.size() }, (_, i) => values.GetValue(i)) };
    d.destroy(values);
  }
  const indices = new Uint32Array(mesh.num_faces() * 3), face = new d.DracoInt32Array();
  for (let i = 0; i < mesh.num_faces(); i++) { decoder.GetFaceFromMesh(mesh, i, face); for (let j = 0; j < 3; j++) indices[i * 3 + j] = face.GetValue(j); }
  for (const x of [face, mesh, status, db, decoder]) d.destroy(x);
  return { attrs, indices };
}
function encode(p, geometry) {
  const mesh = new e.Mesh(), builder = new e.MeshBuilder(), encoder = new e.Encoder(), data = new e.DracoInt8Array();
  const count = geometry.attrs.POSITION.values.length / 3;
  builder.AddFacesToMesh(mesh, geometry.indices.length / 3, geometry.indices);
  const ids = {};
  for (const [name, { width, values }] of Object.entries(geometry.attrs)) {
    const type = name === 'POSITION' ? e.POSITION : name === 'NORMAL' ? e.NORMAL : name.startsWith('TEXCOORD') ? e.TEX_COORD : e.GENERIC;
    ids[name] = builder.AddFloatAttributeToMesh(mesh, type, count, width, values);
  }
  encoder.SetSpeedOptions(5, 5); encoder.SetAttributeQuantization(e.POSITION, 18); encoder.SetAttributeQuantization(e.NORMAL, 12);
  const size = encoder.EncodeMeshToDracoBuffer(mesh, data); assert(size > 0);
  const buffer = Buffer.from(Array.from({ length: size }, (_, i) => data.GetValue(i)));
  // Determine the actual encoded point count after Draco deduplication.
  const dec = new d.Decoder(), db = new d.DecoderBuffer(), check = new d.Mesh();
  db.Init(new Int8Array(buffer), buffer.length);
  const status = dec.DecodeBufferToMesh(db, check); assert(status.ok());
  // Draco discards degenerate faces already present in the imported CAD mesh.
  const indexCount = check.num_faces() * 3;
  assert(indexCount > 0 && indexCount <= geometry.indices.length);
  const positions = geometry.attrs.POSITION.values, box = new Box3(), v = new Vector3();
  for (let i = 0; i < positions.length; i += 3) box.expandByPoint(v.fromArray(positions, i));
  for (const [name, index] of Object.entries(p.attributes)) {
    // New accessors avoid modifying any other primitive sharing an accessor.
    const a = { ...g.accessors[index], count: check.num_points() };
    delete a.bufferView; delete a.byteOffset;
    if (name === 'POSITION') { a.min = box.min.toArray(); a.max = box.max.toArray(); }
    p.attributes[name] = g.accessors.length; g.accessors.push(a);
  }
  const indices = { ...g.accessors[p.indices], count: indexCount };
  delete indices.bufferView; delete indices.byteOffset;
  p.indices = g.accessors.length; g.accessors.push(indices);
  p.extensions.KHR_draco_mesh_compression = { bufferView: append(buffer), attributes: ids };
  for (const x of [status, check, db, dec]) d.destroy(x);
  for (const x of [data, encoder, builder, mesh]) e.destroy(x);
}
const assemblies = ['Alpha', 'Beta', 'Omega', 'cajon+ruedas'].map(name => {
  const node = g.nodes.find(n => n.name === name), child = g.nodes[node.children[0]];
  const transform = matrix(node).multiply(matrix(child));
  const parts = g.meshes[child.mesh].primitives.map(p => ({ p, data: decode(p) }));
  const robotParts = name === 'cajon+ruedas' ? parts.filter(({ p }) => p.material >= 16 && p.material <= 20) : parts;
  assert(robotParts.length > 0);
  let base = Infinity;
  const v = new Vector3();
  for (const { data } of robotParts) {
    const positions = data.attrs.POSITION.values;
    for (let i = 0; i < positions.length; i += 3) base = Math.min(base, v.fromArray(positions, i).applyMatrix4(transform).y);
  }
  return { name, node, transform, parts, robotParts, base };
});
const target = Math.max(...assemblies.map(a => a.base));
for (const a of assemblies) {
  const delta = target - a.base;
  if (a.name !== 'cajon+ruedas') {
    a.node.translation[1] += delta;
  } else {
    assert(delta > 0 && delta < 0.1, 'Unexpected mobile robot height');
    const inverse = a.transform.clone().invert(), v = new Vector3();
    for (const part of a.parts) {
      const robot = a.robotParts.includes(part);
      // These cabinet primitives are distinct from the wheel and motor meshes.
      const cabinet = [9, 21].includes(part.p.material);
      if (!robot && !cabinet) continue;
      const positions = part.data.attrs.POSITION.values;
      let top = -Infinity, bottom = Infinity;
      for (let i = 0; i < positions.length; i += 3) {
        const y = v.fromArray(positions, i).applyMatrix4(a.transform).y;
        top = Math.max(top, y); bottom = Math.min(bottom, y);
      }
      const stretch = 1 + delta / (top - bottom);
      for (let i = 0; i < positions.length; i += 3) {
        v.fromArray(positions, i).applyMatrix4(a.transform);
        v.y = robot ? v.y + delta : bottom + (v.y - bottom) * stretch;
        v.applyMatrix4(inverse).toArray(positions, i);
      }
      if (cabinet && part.data.attrs.NORMAL) {
        const normalTransform = new Matrix3().getNormalMatrix(inverse.clone().multiply(new Matrix4().makeScale(1, stretch, 1)).multiply(a.transform));
        const normals = part.data.attrs.NORMAL.values;
        for (let i = 0; i < normals.length; i += 3) v.fromArray(normals, i).applyMatrix3(normalTransform).normalize().toArray(normals, i);
      }
      encode(part.p, part.data);
    }
  }
  console.log(`${a.name}: base ${a.base.toFixed(6)} -> ${target.toFixed(6)}, lift ${delta.toFixed(6)}`);
}
// A small repeating PNG makes the safety marking portable to any glTF viewer.
function crc(bytes) { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
function pngChunk(type, bytes) {
  const name = Buffer.from(type), head = Buffer.alloc(4), tail = Buffer.alloc(4);
  head.writeUInt32BE(bytes.length); tail.writeUInt32BE(crc(Buffer.concat([name, bytes])));
  return Buffer.concat([head, name, bytes, tail]);
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(32); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
const pixels = Buffer.alloc(97);
for (let i = 0; i < 32; i++) pixels.set(i < 16 ? [255, 196, 0] : [18, 18, 18], 1 + i * 3);
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(pixels)), pngChunk('IEND', Buffer.alloc(0))]);
g.images ||= []; g.textures ||= []; g.samplers ||= [];
const imageIndex = g.images.length; g.images.push({ name: 'Safety yellow-black', mimeType: 'image/png', bufferView: append(png) });
const sampler = g.samplers.length; g.samplers.push({ magFilter: 9728, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
const texture = g.textures.length; g.textures.push({ source: imageIndex, sampler });
const floor = g.nodes.find(n => n.name === 'Plane');
const stripe = g.meshes[floor.mesh].primitives.find(p => g.materials[p.material].name === 'SafetyStripesMat');
assert(stripe);
const geometry = decode(stripe), positions = geometry.attrs.POSITION.values;
const uv = new Float32Array(positions.length / 3 * 2);
for (let i = 0; i < positions.length / 3; i++) { uv[i * 2] = (positions[i * 3] + positions[i * 3 + 2]) / 0.18; uv[i * 2 + 1] = 0.5; }
geometry.attrs.TEXCOORD_0 = { width: 2, values: uv };
stripe.attributes.TEXCOORD_0 = g.accessors.length;
g.accessors.push({ componentType: 5126, type: 'VEC2', count: uv.length / 2 });
encode(stripe, geometry);
g.materials[stripe.material] = { name: 'SafetyStripesMat', pbrMetallicRoughness: { baseColorTexture: { index: texture }, metallicFactor: 0, roughnessFactor: 0.9 }, doubleSided: true };
g.buffers = [{ byteLength: length }];
const json = Buffer.from(JSON.stringify(g)), jsonPad = Buffer.alloc((4-json.length%4)%4, 32), binPad = Buffer.alloc((4-length%4)%4);
const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2,4); header.writeUInt32LE(28+json.length+jsonPad.length+length+binPad.length,8);
header.writeUInt32LE(json.length+jsonPad.length,12); header.writeUInt32LE(0x4e4f534a,16);
binHeader.writeUInt32LE(length+binPad.length); binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(output,Buffer.concat([header,json,jsonPad,binHeader,...chunks,binPad]));
console.log('Safety marking restored; candidate written:', output);
