/* Shared piece primitives + a small procedural-geometry toolkit (merge-per-material accumulator, tubes, blobs).
   A procedural piece should end as one mesh per material (Acc.into) so it stays cheap and pre-renderable. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TEX } from './scene.js';

export const M = {
  soil:  new THREE.MeshStandardMaterial({ color:0x8A5A33, roughness:1, map:TEX.furrow }),
  sand:  new THREE.MeshStandardMaterial({ color:0xE2C699, roughness:1 }),
  stone: new THREE.MeshStandardMaterial({ color:0xB9AE9C, roughness:.95 }),
  water: new THREE.MeshStandardMaterial({ color:0x5CB7D8, roughness:.18, metalness:0, emissive:0x0E3C55, emissiveIntensity:.35 }),
  pad:   new THREE.MeshStandardMaterial({ color:0x6FAE45, roughness:.8 })
};
export const G = {
  field: new RoundedBoxGeometry(.9, .07, .9, 2, .03),
  path:  new RoundedBoxGeometry(.97, .035, .97, 2, .015),
  step:  new THREE.CylinderGeometry(.13, .14, .03, 9),
  rim:   new RoundedBoxGeometry(1.88, .05, 1.88, 3, .025),
  water: new THREE.CylinderGeometry(.74, .74, .02, 48),
  pebble:new THREE.SphereGeometry(.07, 8, 6),
  pad:   new THREE.CylinderGeometry(.075, .075, .012, 14)
};

/* geometry accumulator: everything a piece is made of, merged per material */
export class Acc {
  constructor(){ this.m = new Map(); }
  add(geo, mat, mx){ const g = (geo.index ? geo.toNonIndexed() : geo.clone()); for (const k of Object.keys(g.attributes)) if (!['position','normal','uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2), 2));
    if (mx) g.applyMatrix4(mx); (this.m.get(mat) || this.m.set(mat, []).get(mat)).push(g); }
  into(parent){ for (const [mat, list] of this.m) { const geo = mergeGeometries(list); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); } return parent; }
}
export const _up = new THREE.Vector3(0,1,0), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1,1,1);
export function seg(acc, mat, p, dir, len, r0, r1, radial=5){
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1).translate(0, len/2, 0);
  _q.setFromUnitVectors(_up, dir.clone().normalize()); acc.add(g, mat, _m.compose(p, _q, _s));
}
export function blob(acc, mat, p, r, sy=1, detail=0, rng=null){
  const g = new THREE.IcosahedronGeometry(r, detail);
  if (rng) { const a = g.attributes.position; for (let i=0;i<a.count;i++){ const k = 1 + (rng()-.5)*.22; a.setXYZ(i, a.getX(i)*k, a.getY(i)*k, a.getZ(i)*k); } }
  acc.add(g, mat, _m.compose(p, _q.identity(), new THREE.Vector3(1, sy, 1)));
}
export function perp(d, rng){ const a = new THREE.Vector3(rng()-.5, rng()-.5, rng()-.5).cross(d).normalize(); return a.lengthSq() ? a : new THREE.Vector3(1,0,0); }
