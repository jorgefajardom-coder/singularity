import assert from 'node:assert/strict';
import fs from 'node:fs';
import draco3d from 'draco3d';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Matrix4, PropertyBinding, Vector3 } from 'three';
import { prepareAssembly, poseAssembly, disposeAssembly, presentationTime } from '../src/lib/modelAssembly.js';

// Decode the actual CAD vertices. Local bounding-box stand-ins grossly inflate
// rotated geometry and cannot validate the production choreography.
const bytes = fs.readFileSync(new URL('../public/models/celda-pieces.glb', import.meta.url));
const length = bytes.readUInt32LE(12);
const g = JSON.parse(bytes.subarray(20, 20 + length));
const binary = bytes.subarray(28 + length);
const d = await draco3d.createDecoderModule({});
const materials = g.materials.map(m => new MeshBasicMaterial({ name: m.name }));
const cache = new Map();
function geometry(p) {
  if (cache.has(p)) return cache.get(p);
  const ext = p.extensions.KHR_draco_mesh_compression, view = g.bufferViews[ext.bufferView];
  const decoder = new d.Decoder(), buffer = new d.DecoderBuffer(), mesh = new d.Mesh();
  const data = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  buffer.Init(new Int8Array(data), data.length);
  const status = decoder.DecodeBufferToMesh(buffer, mesh);
  assert(status.ok());
  const attr = decoder.GetAttributeByUniqueId(mesh, ext.attributes.POSITION);
  const values = new d.DracoFloat32Array();
  decoder.GetAttributeFloatForAllPoints(mesh, attr, values);
  const positions = Float32Array.from({length: values.size()}, (_, i) => values.GetValue(i));
  const result = new BufferGeometry();
  result.setAttribute('position', new Float32BufferAttribute(positions, 3));
  if (ext.attributes._PIECE !== undefined) {
    const labelAttribute = decoder.GetAttributeByUniqueId(mesh, ext.attributes._PIECE);
    const labels = new d.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(mesh, labelAttribute, labels);
    result.setAttribute('_piece', new Float32BufferAttribute(Float32Array.from({length: labels.size()}, (_, i) => labels.GetValue(i)), 1));
    const face = new d.DracoInt32Array();
    for (let i = 0; i < mesh.num_faces(); i++) {
      decoder.GetFaceFromMesh(mesh, i, face);
      const ids = [0, 1, 2].map(j => labels.GetValue(face.GetValue(j)));
      assert(ids.every(id => id === ids[0]), 'Triangle vertices must share one explosion trajectory');
    }
    d.destroy(face);
    d.destroy(labels);
  }
  for (const item of [values, status, mesh, buffer, decoder]) d.destroy(item);
  cache.set(p, result);
  return result;
}
function node(index) {
  const src = g.nodes[index], result = new Group();
  result.name = PropertyBinding.sanitizeNodeName(src.name || '');
  if (src.translation) result.position.fromArray(src.translation);
  if (src.rotation) result.quaternion.fromArray(src.rotation);
  if (src.scale) result.scale.fromArray(src.scale);
  if (src.matrix) result.applyMatrix4(new Matrix4().fromArray(src.matrix));
  if (src.mesh !== undefined) for (const p of g.meshes[src.mesh].primitives) result.add(new Mesh(geometry(p), materials[p.material]));
  for (const child of src.children || []) result.add(node(child));
  return result;
}
const scene = new Group();
for (const root of g.scenes[g.scene || 0].nodes) scene.add(node(root));
const cached = scene.clone(true);
scene.position.set(3, -1, 0.5);
scene.rotation.y = 0.4;
scene.scale.setScalar(0.6);
scene.updateMatrixWorld(true);
const initial = new Map();
scene.traverse(n => initial.set(n, { position: n.position.clone(), quaternion: n.quaternion.clone(), scale: n.scale.clone(), visible: n.visible, material: n.material }));


const parts=prepareAssembly(scene);
assert(parts.length > 170, 'The exploded model must expose additional components');
assert(new Set(parts.map(p=>p.node)).size < parts.length);
assert(parts.resources.length === 170);
assert(parts.every(p=>p.unit===undefined && p.unitBox===undefined));
poseAssembly(parts, 0);
assert(parts.every(p => p.node.visible === p.visible));
const end=Math.max(...parts.map(p=>p.end));
assert.equal(poseAssembly(parts,end),true);
function assertRest(){for(const [n,r]of initial){assert(n.position.equals(r.position));assert(n.quaternion.equals(r.quaternion));assert(n.scale.equals(r.scale));assert.equal(n.visible,r.visible);if(n.isMesh)assert.equal(n.material,r.material);}}
assert.equal(parts.elapsed.value,end);
for(const {geometry} of parts.resources){assert(geometry.attributes.assemblyOffset.array.every(Number.isFinite));assert(geometry.attributes.assemblyDelay.array.every(Number.isFinite));}
poseAssembly(parts,0);disposeAssembly(parts);assertRest();
const replay=prepareAssembly(scene);
assert.deepEqual(replay.map(p=>[p.delay,p.duration,p.offset.toArray()]),parts.map(p=>[p.delay,p.duration,p.offset.toArray()]));
poseAssembly(replay,0,true);assert(replay.elapsed.value > end);disposeAssembly(replay);assertRest();
console.log('PASS: independent components; visible explosion; final pose, replay and reduced motion preserved. Duration:',end.toFixed(2), 'Components:', parts.length);

