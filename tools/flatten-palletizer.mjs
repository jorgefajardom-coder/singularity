// Rectify the palletizer cabinet axes, preserving the connected robot and wheels.
// Usage: node tools/flatten-palletizer.mjs input.glb output.glb
import fs from 'node:fs';
import path from 'node:path';
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

const node = g.nodes.find(n => n.name === 'cajon+ruedas');
assert(node, 'Missing palletizer');
const child = g.nodes[node.children[0]];
const transform = matrix(node).multiply(matrix(child));
const parts = g.meshes[child.mesh].primitives.map(p => ({ p, data: decode(p) }));
const cabinet = parts.find(part => part.p.material === 9);
assert(cabinet, 'Missing cabinet reference faces');
// Area-weighted CAD face normals reject small bevels and tessellation noise.
const sums = [new Vector3(), new Vector3(), new Vector3()];
const positions = cabinet.data.attrs.POSITION.values;
const a = new Vector3(), b = new Vector3(), c = new Vector3();
for (let i = 0; i < cabinet.data.indices.length; i += 3) {
  const ids = cabinet.data.indices;
  a.fromArray(positions, ids[i]*3).applyMatrix4(transform);
  b.fromArray(positions, ids[i+1]*3).applyMatrix4(transform);
  c.fromArray(positions, ids[i+2]*3).applyMatrix4(transform);
  const normal = b.sub(a).cross(c.sub(a));
  const axis = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)].indexOf(Math.max(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)));
  if (Math.abs(normal.getComponent(axis)) < normal.length()*0.99) continue;
  if (normal.getComponent(axis) < 0) normal.negate();
  sums[axis].add(normal);
}
const [x,y,z] = sums.map(n => { assert(n.length() > 0); return n.normalize(); });
const correction = new Matrix4().set(x.x,x.y,x.z,0, y.x,y.y,y.z,0, z.x,z.y,z.z,0, 0,0,0,1);
assert(Math.abs(correction.determinant()-1) < 0.02, 'Unexpected cabinet deformation');
const bounds = new Box3(), v = new Vector3();
for (const part of parts) {
 const pos = part.data.attrs.POSITION.values;
 for (let i=0;i<pos.length;i+=3) bounds.expandByPoint(v.fromArray(pos,i).applyMatrix4(transform));
}
const pivot = bounds.getCenter(new Vector3());
// Keep the footprint centered and the lowest wheel point at its original height.
const worldCorrection = new Matrix4().makeTranslation(...pivot.toArray()).multiply(correction).multiply(new Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
let minimum = Infinity;
for (const part of parts) {
 const pos=part.data.attrs.POSITION.values;
 for(let i=0;i<pos.length;i+=3) minimum=Math.min(minimum,v.fromArray(pos,i).applyMatrix4(transform).applyMatrix4(worldCorrection).y);
}
worldCorrection.elements[13] += bounds.min.y-minimum;
const localCorrection = transform.clone().invert().multiply(worldCorrection).multiply(transform);
const normalCorrection = new Matrix3().getNormalMatrix(localCorrection);
for (const part of parts) {
 const pos=part.data.attrs.POSITION.values;
 for(let i=0;i<pos.length;i+=3) v.fromArray(pos,i).applyMatrix4(localCorrection).toArray(pos,i);
 const normals=part.data.attrs.NORMAL?.values;
 if(normals) for(let i=0;i<normals.length;i+=3) v.fromArray(normals,i).applyMatrix3(normalCorrection).normalize().toArray(normals,i);
}
const correctedNormal = y.clone().applyMatrix3(new Matrix3().getNormalMatrix(worldCorrection)).normalize();
assert(Math.abs(correctedNormal.x)<1e-10 && Math.abs(correctedNormal.z)<1e-10, 'Platform must be horizontal');

// Level all four working surfaces after rectification. Raising the wheeled
// assembly as a whole would lift its wheels off the floor, so extend only its
// cabinet and translate its robot without changing the robot's proportions.
function worldBounds(data, transform) {
 const box = new Box3(), point = new Vector3(), pos = data.attrs.POSITION.values;
 for (let i=0;i<pos.length;i+=3) box.expandByPoint(point.fromArray(pos,i).applyMatrix4(transform));
 return box;
}
const fixed = ['cajon:1', 'cajon:2', 'cajon:3'].map((name, i) => {
 const node = g.nodes.find(n => n.name === name), child = g.nodes[node.children[0]];
 const transform = matrix(node).multiply(matrix(child));
 const primitive = g.meshes[child.mesh].primitives.find(p => p.material === 9);
 return { node, robot: g.nodes.find(n => n.name === ['Alpha', 'Beta', 'Omega'][i]),
   top: worldBounds(decode(primitive), transform).max.y };
});
const target = Math.max(...fixed.map(c => c.top));
for (const item of fixed) {
 const delta = target - item.top;
 item.node.translation[1] += delta;
 assert(item.robot, 'Missing fixed robot');
 item.robot.translation[1] += delta;
}
const cabinetBounds = worldBounds(cabinet.data, transform);
const delta = target - cabinetBounds.max.y;
assert(Math.abs(delta) < 0.1, 'Unexpected cabinet height correction');
const bottom = cabinetBounds.min.y;
const stretch = (target - bottom) / (cabinetBounds.max.y - bottom);
const inverse = transform.clone().invert();
for (const part of parts) {
 const isCabinet = [9, 21].includes(part.p.material);
 const isRobot = part.p.material >= 16 && part.p.material <= 20;
 if (isCabinet || isRobot) {
  const change = isCabinet
   ? new Matrix4().makeTranslation(0, bottom, 0).multiply(new Matrix4().makeScale(1, stretch, 1)).multiply(new Matrix4().makeTranslation(0, -bottom, 0))
   : new Matrix4().makeTranslation(0, delta, 0);
  const local = inverse.clone().multiply(change).multiply(transform);
  const normal = new Matrix3().getNormalMatrix(local);
  const pos = part.data.attrs.POSITION.values, normals = part.data.attrs.NORMAL?.values;
  for (let i=0;i<pos.length;i+=3) v.fromArray(pos,i).applyMatrix4(local).toArray(pos,i);
  if (normals) for(let i=0;i<normals.length;i+=3) v.fromArray(normals,i).applyMatrix3(normal).normalize().toArray(normals,i);
 }
 encode(part.p, part.data);
}
assert(Math.abs(worldBounds(cabinet.data, transform).max.y-target) < 0.00005, 'Cabinet tops must match');
console.log('All four cabinet tops aligned at:', target, 'Palletizer extension:', delta);
g.buffers = [{ byteLength: length }];
const json = Buffer.from(JSON.stringify(g)), jsonPad = Buffer.alloc((4-json.length%4)%4, 32), binPad = Buffer.alloc((4-length%4)%4);
const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2,4); header.writeUInt32LE(28+json.length+jsonPad.length+length+binPad.length,8);
header.writeUInt32LE(json.length+jsonPad.length,12); header.writeUInt32LE(0x4e4f534a,16);
binHeader.writeUInt32LE(length+binPad.length); binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(output,Buffer.concat([header,json,jsonPad,binHeader,...chunks,binPad]));
console.log('Palletizer leveled; original tilt (degrees):', Math.acos(y.y)*180/Math.PI);
console.log('Corrected platform normal:', correctedNormal.toArray());
