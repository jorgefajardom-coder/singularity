// Separate disconnected mesh components while preserving the corrected web model.
// Usage: node tools/split-celda-pieces.mjs input.glb output.glb
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import draco3d from 'draco3d';
import { Matrix4, Quaternion, Vector3, Matrix3, Box3 } from 'three';

const [input, output] = process.argv.slice(2);
// Quantization over each primitive's own box: 16 bits on the largest group
// (about 4 m) is 0.06 mm. 14 bits saved only 0.9 MB of 14.8.
const POSITION_BITS = Number(process.env.POSITION_BITS || 16);
const SPEED = Number(process.env.DRACO_SPEED || 2);
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
    // The piece label is an integer id: stored as a float Draco keeps it raw,
    // 32 bits per vertex, and alone it doubled the file.
    if (name === '_PIECE') { ids[name] = builder.AddUInt16Attribute(mesh, e.GENERIC, count, width, Uint16Array.from(values)); continue; }
    const type = name === 'POSITION' ? e.POSITION : name === 'NORMAL' ? e.NORMAL : name.startsWith('TEXCOORD') ? e.TEX_COORD : e.GENERIC;
    ids[name] = builder.AddFloatAttributeToMesh(mesh, type, count, width, values);
  }
  // Without quantization Draco stores an attribute as raw floats; UVs were
  // going out that way. POSITION_BITS is per primitive box, see the top.
  encoder.SetSpeedOptions(SPEED, SPEED);
  encoder.SetAttributeQuantization(e.POSITION, POSITION_BITS);
  encoder.SetAttributeQuantization(e.NORMAL, 10);
  encoder.SetAttributeQuantization(e.TEX_COORD, 12);
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
// Weld coincident seam vertices for connectivity only; retain original normals/UVs.
function components(data) {
  const pos=data.attrs.POSITION.values, count=pos.length/3;
  const parents=Int32Array.from({length:count},(_,i)=>i);
  function root(i){while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;}
  function join(a,b){a=root(a);b=root(b);if(a!==b)parents[b]=a;}
  const seams=new Map();
  for(let i=0;i<count;i++) {
    const key=[pos[i*3],pos[i*3+1],pos[i*3+2]].map(x=>Math.round(x*1e6)).join(',');
    if(seams.has(key))join(i,seams.get(key));else seams.set(key,i);
  }
  const ids=data.indices;
  for(let i=0;i<ids.length;i+=3){join(ids[i],ids[i+1]);join(ids[i],ids[i+2]);}
  const groups=new Map();
  for(let i=0;i<ids.length;i+=3){const key=root(ids[i]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(ids[i],ids[i+1],ids[i+2]);}
  const labels=new Float32Array(count); let id=0;
  for(const indices of groups.values()){for(const vertex of indices)labels[vertex]=id;id++;}
  // Include zero-area faces too: they become visible streaks if their vertices
  // receive different trajectories during the explosion.
  for(let i=0;i<ids.length;i+=3) assert(labels[ids[i]]===labels[ids[i+1]] && labels[ids[i]]===labels[ids[i+2]]);
  return {labels,count:id};
}
const floorMeshes=new Set();
function floor(i){const n=g.nodes[i];if(n.mesh!==undefined)floorMeshes.add(n.mesh);for(const c of n.children||[])floor(c);}
g.nodes.forEach((n,i)=>{if(n.name==='Plane')floor(i);});
let before=0,after=0;
for(let mi=0;mi<g.meshes.length;mi++) {
  if(floorMeshes.has(mi))continue;
  const mesh=g.meshes[mi]; let meshCount=0;
  for(const p of mesh.primitives) {
    before++;
    const data=decode(p), pieces=components(data);
    data.attrs._PIECE={width:1,values:pieces.labels};
    p.attributes._PIECE=g.accessors.length;
    assert(pieces.count<=65536);
    g.accessors.push({componentType:5123,type:'SCALAR',count:pieces.labels.length});
    encode(p,data);
    p.extras={...p.extras,explodedPieces:pieces.count};
    meshCount+=pieces.count;
  }
  after+=meshCount;
  console.log(mesh.name||mi,meshCount,'pieces');
}
// Remove obsolete compressed payloads left over from earlier model repairs.
const oldBinary=Buffer.concat(chunks), packed=[], offsets=new Map();let packedLength=0;
const used=new Set();
for(const mesh of g.meshes)for(const p of mesh.primitives)used.add(p.extensions.KHR_draco_mesh_compression.bufferView);
for(const image of g.images||[])if(image.bufferView!==undefined)used.add(image.bufferView);
for(const accessor of g.accessors)if(accessor.bufferView!==undefined)used.add(accessor.bufferView);
for(const index of used){const view=g.bufferViews[index], pad=(4-packedLength%4)%4;if(pad){packed.push(Buffer.alloc(pad));packedLength+=pad;}offsets.set(index,packedLength);packed.push(oldBinary.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength));packedLength+=view.byteLength;}
const remapViews=new Map();const views=[];
for(const index of used){remapViews.set(index,views.length);views.push({...g.bufferViews[index],byteOffset:offsets.get(index)});}
for(const mesh of g.meshes)for(const p of mesh.primitives){const ext=p.extensions.KHR_draco_mesh_compression;ext.bufferView=remapViews.get(ext.bufferView);}
for(const image of g.images||[])if(image.bufferView!==undefined)image.bufferView=remapViews.get(image.bufferView);
for(const accessor of g.accessors)if(accessor.bufferView!==undefined)accessor.bufferView=remapViews.get(accessor.bufferView);
g.bufferViews=views;
let bin=Buffer.concat(packed);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);g.buffers[0].byteLength=bin.length;
let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(output,Buffer.concat([header,json,bh,bin]));
console.log(JSON.stringify({before,after,bytes:fs.statSync(output).size}));
