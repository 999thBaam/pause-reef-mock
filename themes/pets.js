/* PET PARK (?theme=pets) — a bright pastel, toy-like park where pets live and play, on the farm's 7×7 ring blueprint
   (FARM_SLOTS: every farm slot id maps to a pet-park piece, hero in the right-hand corner, so rings 6 / 15 / 19, order, pick-3,
   growth and expansion behave like the farm).
   The stars = Kenney Cube Pets 2.0 (CC0, animated: idle / walk / eat …; assets/pets/pet-*.glb): residents, the ambient pets that
   hop about from the first piece, and the carousel riders on the hero. Round + blossom trees and bushes = KayKit Forest Nature
   (shared kit b) re-tinted pastel with its own tint atlas (pink / lavender / gold / mint columns). Pet houses, café, vet, fountains,
   pools, the carrot patch, flower maze, agility course, benches, bowls, toys, swings, picket fences and the rainbow carousel are
   procedural toy geometry (rounded boxes, smooth normals), merged per material. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rngFrom, world } from '../engine/scene.js';
import { V, TH, placed, AMBIENT, cropStage } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, ANIMCACHE, addModel, fitScale, loadAnimal, modelBox } from '../engine/kit.js';
import { FARM_SLOTS, FARM_ORDER } from './farm.js';

const BK = 'petsb';   // KayKit Forest Nature (shared assets/kit-b), registered under our own id so its def can't clash

/* ── materials: pastel toy plastic ── */
const PM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.72, metalness:0, ...o });
const C = {
  cream:PM(0xFFF6E6), creamD:PM(0xF3E2C4), white:PM(0xFFFFFF), pink:PM(0xFFB3C7), pinkD:PM(0xF58AA8), coral:PM(0xFF8E8E),
  mint:PM(0xA8E6CF), mintD:PM(0x7ED0B0), lav:PM(0xC9B8F2), lavD:PM(0xA995E3), butter:PM(0xFFE49A), butterD:PM(0xF7CD62),
  sky:PM(0xA9D8F5), skyD:PM(0x7FC0EA), peach:PM(0xFFCBA4), wood:PM(0xE6BE8E), woodD:PM(0xC99A6A), door:PM(0x9A7AC8),
  glass:PM(0xDDF3FF, { roughness:.25, emissive:0x9FD3F0, emissiveIntensity:.25 }), ink:PM(0x5A4E6E),
  water:PM(0x8ED8F0, { roughness:.15, emissive:0x3AA0C8, emissiveIntensity:.22 }), waterL:PM(0xC9F0FF, { roughness:.1, emissive:0x7FD0EE, emissiveIntensity:.3 }),
  soil:PM(0xD9A77E, { roughness:.95 }), soilD:PM(0xC48E66, { roughness:.95 }), leaf:PM(0x8FD98A), leafD:PM(0x6CC46E), carrot:PM(0xFF9F4A),
  hedge:PM(0x9ADFA0), hedgeD:PM(0x7ACB86), sand:PM(0xFFF0D2, { roughness:.95 }), duck:PM(0xFFD84D), beak:PM(0xFF9A3C),
  red:PM(0xFF7B8A), orange:PM(0xFFB36B), yellow:PM(0xFFE36E), green:PM(0x9BE08E), blue:PM(0x8CC8FF), violet:PM(0xC4A4F4),
  kibble:PM(0xC98A5A), rope:PM(0xFFF3DA), metal:PM(0xE8EEF5, { roughness:.4 })
};
const RAINBOW = [C.red, C.orange, C.yellow, C.green, C.blue, C.violet];

/* ── geometry: a per-material accumulator that KEEPS smooth normals (the engine's Acc recomputes flat ones) ── */
class Acc2 {
  constructor(){ this.m = new Map(); }
  add(geo, mat, mx){ const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position','normal','uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2), 2));
    if (mx) g.applyMatrix4(mx); (this.m.get(mat) || this.m.set(mat, []).get(mat)).push(g); return this; }
  into(parent){ for (const [mat, list] of this.m) { const mesh = new THREE.Mesh(mergeGeometries(list), mat); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); } return parent; }
}
const _E = new THREE.Euler(), _Q = new THREE.Quaternion(), _P = new THREE.Vector3(), _S = new THREE.Vector3();
const at = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(_P.set(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), _S.set(sx, sy, sz));
const GC = new Map(), memo = (k, f) => GC.get(k) || GC.set(k, f()).get(k);
const rb = (w, h, d, r = .035) => memo('rb'+[w,h,d,r], () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, Math.min(w, h, d)/2 - 1e-3)));
const cyl = (rt, rbm, h, n = 20) => memo('c'+[rt,rbm,h,n], () => new THREE.CylinderGeometry(rt, rbm, h, n));
const sph = (r, n = 16) => memo('s'+[r,n], () => new THREE.SphereGeometry(r, n, Math.max(8, n*.75|0)));
const cone = (r, h, n = 16) => memo('k'+[r,h,n], () => new THREE.ConeGeometry(r, h, n));
const tor = (R, r, n = 28, arc = Math.PI*2) => memo('t'+[R,r,n,arc], () => new THREE.TorusGeometry(R, r, 10, n, arc));
const B = (a, mat, w, h, d, x, y, z, ry = 0, r) => a.add(rb(w, h, d, r), mat, at(x, y + h/2, z, ry));        // box standing on y
const CY = (a, mat, rt, rbm, h, x, y, z, n) => a.add(cyl(rt, rbm, h, n), mat, at(x, y + h/2, z));

/* gable roof: two slabs meeting at a ridge along x */
function roof(a, mat, w, d, y, pitch = .55, t = .06, ry = 0, ox = 0, oz = 0){
  const half = d/2 + .06, len = half/Math.cos(pitch), c = Math.cos(ry), s = Math.sin(ry);
  for (const sgn of [-1, 1]) { const lz = sgn*half/2, ly = y + Math.tan(pitch)*half/2;
    a.add(rb(w + .1, t, len, .025), mat, at(ox + lz*s, ly, oz + lz*c, ry, 1, 1, 1, sgn*pitch)); }
  return y + Math.tan(pitch)*half;
}
/* a round window / porthole on a wall facing +z (or +x with face 'x') */
function porthole(a, x, y, z, r, face = 'z'){ const m = face === 'z' ? at(x, y, z, 0, 1, 1, 1, Math.PI/2) : at(x, y, z, 0, 1, 1, 1, 0, Math.PI/2);
  a.add(cyl(r, r, .03, 20), C.glass, m); a.add(tor(r, .022, 24), C.white, face === 'z' ? at(x, y, z + .015) : at(x + .015, y, z, Math.PI/2)); }
function door(a, x, y, z, w, h, face = 'z', mat = C.door){
  if (face === 'z') { B(a, mat, w, h - w/2, .03, x, y, z); a.add(cyl(w/2, w/2, .03, 18), mat, at(x, y + h - w/2, z, 0, 1, 1, 1, Math.PI/2)); }
  else { B(a, mat, .03, h - w/2, w, x, y, z); a.add(cyl(w/2, w/2, .03, 18), mat, at(x, y + h - w/2, z, 0, 1, 1, 1, 0, Math.PI/2)); }
}
function bone(a, mat, x, y, z, ry = 0, k = 1){ const c = Math.cos(ry), s = Math.sin(ry), L = .09*k;
  a.add(cyl(.018*k, .018*k, L*2, 10), mat, at(x, y, z, ry, 1, 1, 1, 0, Math.PI/2));
  for (const e of [-1, 1]) for (const f of [-1, 1]) a.add(sph(.024*k, 10), mat, at(x + e*L*c + f*.018*k*s, y, z - e*L*s + f*.018*k*c)); }
function flowerDots(a, r, n, rad, y = 0, cx = 0, cz = 0){
  const P = [C.pink, C.white, C.lav, C.butter, C.peach];
  for (let i=0;i<n;i++){ const ang = r()*6.28, d = rad*(.3 + r()*.7), x = cx + Math.cos(ang)*d, z = cz + Math.sin(ang)*d, m = P[Math.floor(r()*P.length)];
    a.add(cyl(.004, .004, .05, 5), C.leafD, at(x, y + .025, z));
    for (let k=0;k<5;k++){ const q = k/5*6.28; a.add(sph(.012, 8), m, at(x + Math.cos(q)*.014, y + .052, z + Math.sin(q)*.014, 0, 1, .6, 1)); }
    a.add(sph(.009, 8), C.butterD, at(x, y + .056, z)); }
}

/* ── pastel re-tint of the KayKit forest atlas (column offsets 1 pink, 2 lavender, 3 gold, 4 mint) ── */
let TINT_TEX = null; const TINT_MATS = new Map();
function tinted(mat, t){ if (!t || !TINT_TEX || !mat.map) return mat; const k = mat.uuid + ':' + t;
  if (!TINT_MATS.has(k)) { const m2 = mat.clone(); const tx = TINT_TEX.clone(); tx.offset.set(t/8, 0); tx.needsUpdate = true; m2.map = tx; if (t === 4) { m2.emissive = new THREE.Color(0x4FA088); m2.emissiveIntensity = .35; } TINT_MATS.set(k, m2); }
  return TINT_MATS.get(k); }
function kitB(g, name, h, w, t, x = 0, y = 0, z = 0, rot = 0){
  const tpl = KITCACHE[BK] && KITCACHE[BK][name]; if (!tpl) { console.warn('missing', name); return null; }
  const o = addModel(g, name, fitScale(tpl, h, w), x, y, z, rot, BK); if (o && t) o.traverse(m => { if (m.isMesh) m.material = tinted(m.material, t); }); return o;
}

/* ── the cube pets (Kenney Cube Pets): shared clip fix-ups + a hop clip ── */
const PETS = { dog:'assets/pets/pet-dog.glb', cat:'assets/pets/pet-cat.glb', bunny:'assets/pets/pet-bunny.glb', pig:'assets/pets/pet-pig.glb',
               chick:'assets/pets/pet-chick.glb', parrot:'assets/pets/pet-parrot.glb' };
const CAP = { idle:'Idle', walk:'Walk', eat:'Eating', run:'Run', dance:'Dance' };
function fixPet(gltf){
  if (gltf.userData.petFixed) return gltf; gltf.userData.petFixed = true;
  gltf.animations.forEach(c => { if (CAP[c.name]) c.name = CAP[c.name]; });
  const walk = gltf.animations.find(c => c.name === 'Walk'), top = gltf.scene.children[0];
  if (walk && top) {                                                          // Hop = walk legs + a bounce on the top node
    const h = modelBox(gltf.scene).getSize(new THREE.Vector3()).y, n = 16, T = .56, times = [], vals = [];
    for (let i=0;i<=n;i++){ const t = i/n*T; times.push(t); vals.push(top.position.x, top.position.y + Math.abs(Math.sin(i/n*Math.PI))*h*.32, top.position.z); }
    const hop = new THREE.AnimationClip('Hop', T, [...walk.tracks.filter(k => !k.name.startsWith(top.name + '.position')).map(k => k.clone()),
      new THREE.VectorKeyframeTrack(top.name + '.position', times, vals)]);
    hop.resetDuration(); hop.duration = T; gltf.animations.push(hop);
  }
  return gltf;
}
const petGltf = kind => { const p = ANIMCACHE['pet-' + kind]; return p && p.__done ? p.__done : null; };
function petClone(kind){ const gltf = petGltf(kind); if (!gltf) return null; const o = gltf.scene.clone(true);
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; m.material = m.material.clone(); m.material.metalness = 0; m.material.roughness = .8; } }); return { o, gltf }; }
function fitPet(o, h){ const b = modelBox(o), k = h/(b.max.y - b.min.y); o.scale.setScalar(k); o.position.y = -b.min.y*k; return o; }

/* ═════════════ BUILDINGS (Reading / Lesson) ═════════════ */
function buildCafe(g){                      // 2×2 pet café: cream walls, pink roof, striped awning, bone sign, patio tables
  const a = new Acc2();
  B(a, C.mintD, 1.5, .06, 1.2, -.12, 0, -.12, 0, .03);                                          // plinth
  B(a, C.cream, 1.32, .62, 1.02, -.14, .06, -.14, 0, .05);
  const top = roof(a, C.pink, 1.32, 1.02, .68, .5, .07, 0, -.14, -.14);
  B(a, C.pinkD, 1.46, .05, .06, -.14, top - .02, -.14, 0, .02);                                  // ridge
  CY(a, C.butter, .07, .08, .26, .22, .72, -.3);                                                 // chimney
  for (let i=0;i<7;i++){ const x = -.72 + i*.19; a.add(cyl(.095, .095, .02, 14, ), i%2 ? C.white : C.pinkD, at(x, .58, .42, 0, 1, 1, .9, Math.PI/2 - .5)); }   // awning scallops
  B(a, C.pinkD, 1.34, .03, .22, -.14, .6, .42, 0, .015);
  B(a, C.glass, .34, .26, .03, -.47, .2, .375, 0, .02); B(a, C.glass, .34, .26, .03, .2, .2, .375, 0, .02);
  B(a, C.white, .38, .03, .05, -.47, .19, .39, 0, .01); B(a, C.white, .38, .03, .05, .2, .19, .39, 0, .01);
  door(a, -.14, .06, .38, .2, .38, 'z', C.lavD);
  porthole(a, .545, .38, -.14, .1, 'x'); porthole(a, .545, .38, -.44, .07, 'x');
  B(a, C.white, .5, .16, .05, -.14, .9, .45, 0, .06); bone(a, C.butterD, -.14, .98, .49, 0, 1.3);   // sign board + bone
  for (const [x, z, m] of [[.66, .5, C.sky], [.3, .68, C.mint]]) {                               // patio tables with parasols
    CY(a, C.white, .12, .12, .03, x, .2, z, 18); CY(a, C.white, .015, .015, .2, x, 0, z, 8); CY(a, C.white, .06, .07, .02, x, 0, z, 14);
    CY(a, C.white, .01, .01, .28, x, .2, z, 6); a.add(cone(.2, .09, 16), m, at(x, .52, z)); a.add(sph(.02, 8), C.pink, at(x, .57, z));
    CY(a, C.pink, .025, .03, .04, x + .04, .23, z - .02, 10);                                    // a cup
  }
  a.into(g);
}
function buildDogHouse(g){
  const a = new Acc2();
  B(a, C.butter, .5, .36, .56, 0, 0, 0, 0, .04);
  const top = roof(a, C.coral, .5, .56, .36, .6, .06, Math.PI/2);
  B(a, C.white, .06, .05, .7, 0, top - .03, 0, Math.PI/2, .02);
  door(a, 0, .0, .28, .2, .27, 'z', C.ink);
  bone(a, C.white, 0, .33, .295, 0, .9);
  CY(a, C.sky, .07, .055, .04, .22, 0, .33, 18); CY(a, C.kibble, .058, .058, .02, .22, .025, .33, 14);   // bowl + kibble
  a.into(g);
}
function buildCatTower(g){                  // scratching posts, a cubby with a round door, perches and a dangling pompom
  const a = new Acc2();
  B(a, C.lav, .56, .06, .56, 0, 0, 0, 0, .03);
  for (const [x, z, h] of [[-.16, -.16, .72], [.16, .14, .44], [.18, -.18, .9]]) CY(a, C.rope, .045, .045, h, x, .06, z, 14);
  B(a, C.pink, .34, .26, .3, -.1, .06, .1, 0, .05); porthole(a, -.1, .19, .255, .075, 'z'); a.add(cyl(.075, .075, .031, 20), C.ink, at(-.1, .19, .255, 0, 1, 1, 1, Math.PI/2));
  B(a, C.lavD, .34, .05, .3, .12, .5, .1, 0, .025); B(a, C.lav, .36, .05, .36, -.12, .78, -.12, 0, .025);
  B(a, C.pink, .3, .05, .3, .18, .96, -.18, 0, .025); a.add(tor(.1, .035, 20), C.pinkD, at(.18, 1.03, -.18, 0, 1, 1, 1, Math.PI/2));  // bed on top
  CY(a, C.white, .004, .004, .16, .08, .62, .23, 4); a.add(sph(.035, 12), C.butter, at(.08, .6, .23));
  a.into(g);
}
function buildHutch(g){                     // raised mint hutch on legs, wire front, ramp, carrots
  const a = new Acc2();
  for (const [x, z] of [[-.22, -.2], [.22, -.2], [-.22, .2], [.22, .2]]) B(a, C.woodD, .05, .16, .05, x, 0, z, 0, .015);
  B(a, C.mint, .54, .3, .46, 0, .16, 0, 0, .04);
  const top = roof(a, C.pink, .54, .46, .46, .45, .05);
  B(a, C.white, .6, .04, .05, 0, top - .02, 0, 0, .015);
  B(a, C.white, .24, .22, .02, .1, .2, .235, 0, .01);                                           // wire window
  for (let i=0;i<4;i++) B(a, C.metal, .008, .2, .025, .005 + i*.06, .21, .24, 0, .003);
  B(a, C.lavD, .16, .22, .02, -.15, .2, .235, 0, .02);
  a.add(rb(.12, .02, .3, .01), C.wood, at(-.15, .09, .36, 0, 1, 1, 1, .55));                      // ramp
  for (const [x, z, r] of [[.24, .34, .5], [.3, .3, -.4]]) { a.add(cone(.022, .1, 10), C.carrot, at(x, .03, z, 0, 1, 1, 1, Math.PI/2, r));
    a.add(cone(.012, .05, 6), C.leaf, at(x - .05*Math.sin(r), .03, z, 0, 1, 1, 1, -Math.PI/2, r)); }
  a.into(g);
}
function buildVet(g){                       // white cottage, sky roof, pink cross sign, heart window
  const a = new Acc2();
  B(a, C.white, .56, .42, .5, 0, 0, 0, 0, .04);
  const top = roof(a, C.sky, .56, .5, .42, .55, .06);
  B(a, C.skyD, .66, .04, .05, 0, top - .02, 0, 0, .015);
  door(a, -.08, 0, .255, .15, .28, 'z', C.skyD);
  B(a, C.glass, .13, .12, .02, .15, .18, .255, 0, .02); B(a, C.white, .02, .12, .03, .15, .18, .26, 0, .005);
  B(a, C.white, .22, .22, .04, 0, top - .04, .08, 0, .05);                                       // cross sign board
  B(a, C.coral, .14, .045, .02, 0, top + .03, .105, 0, .01); B(a, C.coral, .045, .14, .02, 0, top - .015, .105, 0, .01);
  porthole(a, .285, .22, 0, .07, 'x');
  a.into(g);
}
function buildBirdHouses(g){                // a pole with three little pastel bird houses
  const a = new Acc2();
  CY(a, C.mintD, .12, .14, .04, 0, 0, 0, 18); CY(a, C.wood, .03, .035, .92, 0, .04, 0, 10);
  B(a, C.wood, .5, .035, .035, 0, .6, 0, 0, .01);
  const H = [[-.2, .62, C.pink, C.lav], [.2, .62, C.butter, C.sky], [0, .96, C.sky, C.pink]];
  for (const [x, y, wall, rf] of H) {
    B(a, wall, .18, .18, .16, x, y, 0, 0, .025);
    roof(a, rf, .18, .16, y + .18, .7, .03, Math.PI/2, x, 0);
    a.add(cyl(.035, .035, .02, 14), C.ink, at(x, y + .1, .08, 0, 1, 1, 1, Math.PI/2));
    CY(a, C.white, .008, .008, .05, x, y + .03, .1, 5);
  }
  a.add(sph(.03, 10), C.sky, at(.24, .83, .08)); a.add(sph(.02, 8), C.sky, at(.26, .86, .1));    // a little blue bird on the roof
  a.into(g);
}

/* ═════════════ WATER (Breathe) ═════════════ */
function duckToy(a, x, y, z, k = 1, ry = 0){ const c = Math.cos(ry), s = Math.sin(ry);
  a.add(sph(.045*k, 12), C.duck, at(x, y + .03*k, z, ry, 1.2, .85, 1));
  a.add(sph(.03*k, 12), C.duck, at(x + .035*k*s, y + .08*k, z + .035*k*c));
  a.add(cone(.012*k, .03*k, 8), C.beak, at(x + .065*k*s, y + .08*k, z + .065*k*c, ry, 1, 1, 1, Math.PI/2)); }
function buildSprinkler(g){                 // tiered fountain in a round pastel basin, water droplets arcing out
  const a = new Acc2();
  CY(a, C.pink, .4, .42, .1, 0, 0, 0, 32); CY(a, C.water, .35, .35, .02, 0, .085, 0, 32);
  a.add(tor(.39, .03, 36), C.white, at(0, .1, 0, 0, 1, 1, 1, Math.PI/2));
  CY(a, C.white, .05, .07, .36, 0, .08, 0, 14); CY(a, C.white, .17, .1, .06, 0, .38, 0, 22); CY(a, C.waterL, .15, .15, .015, 0, .43, 0, 22);
  CY(a, C.white, .03, .04, .16, 0, .44, 0, 12); a.add(sph(.05, 14), C.sky, at(0, .64, 0));
  for (let i=0;i<8;i++){ const q = i/8*6.28;                                                   // spray arcs of droplets
    for (let j=1;j<=3;j++){ const d = .05 + j*.07, y = .64 + .08*j - .045*j*j; a.add(sph(.018 - j*.002, 8), C.waterL, at(Math.cos(q)*d, y, Math.sin(q)*d)); } }
  duckToy(a, .2, .09, .16, 1, .8);
  a.into(g);
}
function buildSplashPool(g){                // inflatable paddling pool, rubber duck, beach ball
  const a = new Acc2();
  a.add(tor(.33, .07, 32), C.sky, at(0, .07, 0, 0, 1, 1, 1, Math.PI/2)); a.add(tor(.33, .065, 32), C.pink, at(0, .19, 0, 0, 1, 1, 1, Math.PI/2));
  CY(a, C.white, .34, .34, .02, 0, 0, 0, 30); CY(a, C.water, .3, .3, .02, 0, .15, 0, 30);
  duckToy(a, -.08, .16, .05, 1.1, 1.2);
  beachBall(a, .3, .1, .3, .08);
  a.into(g);
}
function beachBall(a, x, y, z, r){ const cols = [C.coral, C.white, C.sky, C.white, C.butter, C.white];
  for (let i=0;i<6;i++) a.add(memo('bb'+r+i, () => new THREE.SphereGeometry(r, 6, 12, i/6*Math.PI*2, Math.PI*2/6)), cols[i], at(x, y + r, z)); }
function buildSplashPond(g){                // a round pond with stepping stones, lily pads and a toy boat
  const a = new Acc2(), r = rngFrom(41);
  CY(a, C.sand, .44, .46, .05, 0, 0, 0, 30); CY(a, C.water, .36, .36, .02, 0, .045, 0, 30);
  for (let i=0;i<14;i++){ const q = i/14*6.28 + r()*.2; a.add(sph(.05 + r()*.02, 10), [C.white, C.lav, C.pink][i%3], at(Math.cos(q)*.4, .05, Math.sin(q)*.4, 0, 1.2, .5, 1)); }
  for (const [x, z] of [[-.15, .12], [.12, -.16], [.16, .14]]) CY(a, C.leaf, .06, .06, .01, x, .06, z, 14);
  a.add(sph(.025, 10), C.pink, at(.16, .075, .14));
  B(a, C.coral, .14, .04, .07, -.05, .058, -.06, .6, .02); a.add(cone(.05, .09, 3), C.white, at(-.05, .14, -.06, .6));   // toy boat
  a.into(g);
}
function buildDuckPond(g){                  // bigger duck pond with a family of rubber ducks
  const a = new Acc2(), r = rngFrom(77);
  CY(a, C.mint, .46, .47, .04, 0, 0, 0, 30); CY(a, C.water, .4, .4, .02, 0, .035, 0, 30);
  for (let i=0;i<18;i++){ const q = i/18*6.28; a.add(sph(.045 + r()*.015, 10), i%2 ? C.white : C.pink, at(Math.cos(q)*.43, .045, Math.sin(q)*.43, 0, 1.2, .55, 1)); }
  duckToy(a, -.05, .05, .02, 1.5, .6); duckToy(a, .14, .05, -.12, 1, .4); duckToy(a, .2, .05, .02, 1, .9);
  for (const [x, z] of [[-.2, -.18], [-.22, .16]]) CY(a, C.leaf, .06, .06, .01, x, .05, z, 14);
  flowerDots(a, r, 4, .12, .02, .42, .36);
  a.into(g);
}

/* ═════════════ GROWING (Sudoku / Math) ═════════════ */
function fillCarrots(host, s, stage){
  host.clear(); const a = new Acc2(), r = rngFrom(s.x*31 + s.z*7 + 3);
  for (let i=0;i<3;i++) for (let j=0;j<3;j++){ const x = (i-1)*.26 + (r()-.5)*.03, z = (j-1)*.26 + (r()-.5)*.03;
    const k = [0, .45, .7, .9, 1.05, 1.2][stage] * (.9 + r()*.2);
    for (let l=0;l<3;l++){ const q = l/3*6.28 + r(); a.add(cone(.02*k, .16*k, 6), l%2 ? C.leaf : C.leafD, at(x + Math.cos(q)*.02*k, .06 + .08*k, z + Math.sin(q)*.02*k, 0, 1, 1, 1, Math.cos(q)*.35, Math.sin(q)*.35)); }
    if (stage >= 3) { const up = stage >= 5 ? .06 : stage >= 4 ? .03 : .0; a.add(cone(.05*k, .1*k, 12), C.carrot, at(x, .06 + up, z, 0, 1, 1, 1, Math.PI)); }
  }
  if (stage >= 5) { a.add(cone(.06, .2, 12), C.carrot, at(.34, .1, .3, 0, 1, 1, 1, Math.PI/2, .4)); a.add(cone(.02, .08, 6), C.leaf, at(.28, .09, .43, 0, 1, 1, 1, -.4, 1.5)); }   // a pulled carrot
  a.into(host); host.userData.stage = stage;
}
const MAZE = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1],[0,1]];
function fillMaze(host, s, stage){          // a little flower-hedge maze: walls rise, then bloom
  host.clear(); const a = new Acc2(), r = rngFrom(s.x*17 + s.z*5 + 11), h = [0, .05, .09, .13, .16, .18][stage];
  const walls = [[-.33, 0, .08, .74], [.33, 0, .08, .74], [0, -.33, .58, .08], [.1, .33, .38, .08], [0, 0, .08, .36], [-.12, .12, .2, .08]];
  walls.forEach(([x, z, w, d], i) => { if (stage < 2 && i > 3) return; B(a, i%2 ? C.hedge : C.hedgeD, w, h, d, x, .045, z, 0, .035); });
  if (stage >= 4) walls.forEach(([x, z, w, d]) => { const n = Math.round(Math.max(w, d)/.12); for (let k=0;k<n;k++){ const t = (k + .5)/n - .5;
    const m = [C.pink, C.white, C.lav, C.butter][Math.floor(r()*4)]; a.add(sph(.022, 8), m, at(x + (w > d ? t*w : (r()-.5)*.03), .045 + h + .01, z + (d > w ? t*d : (r()-.5)*.03))); } });
  if (stage >= 5) { CY(a, C.white, .01, .01, .22, .16, .045, -.12, 6); a.add(sph(.04, 12), C.pink, at(.16, .3, -.12)); }   // goal balloon in the middle
  a.into(host); host.userData.stage = stage;
}
function fillAgility(host, s, stage){       // agility course: cone → hurdle → tunnel → weave poles → A-frame + flag
  host.clear(); const a = new Acc2();
  CY(a, C.orange, .012, .045, .09, -.3, .04, .3, 10); CY(a, C.orange, .012, .045, .09, .3, .04, -.32, 10);
  if (stage >= 2) { for (const x of [-.12, .12]) CY(a, C.white, .012, .012, .18, x - .12, .04, .2, 8); a.add(cyl(.012, .012, .26, 8), C.coral, at(-.12, .18, .2, 0, 1, 1, 1, 0, Math.PI/2)); }
  if (stage >= 3) { a.add(memo('tun', () => new THREE.CylinderGeometry(.09, .09, .36, 18, 1, true)), C.lav, at(.14, .13, .14, .8, 1, 1, 1, 0, Math.PI/2));
    for (const d of [-.17, .17]) a.add(tor(.09, .015, 18), C.pinkD, at(.14 + Math.cos(.8)*d, .13, .14 - Math.sin(.8)*d, .8 + Math.PI/2)); }
  if (stage >= 4) for (let i=0;i<5;i++) CY(a, i%2 ? C.sky : C.white, .01, .01, .2, -.3 + i*.07, .04, -.12 + i*.02, 8);
  if (stage >= 5) { a.add(rb(.14, .02, .3, .01), C.butterD, at(.24, .13, -.24, -.4, 1, 1, 1, .7)); a.add(rb(.14, .02, .3, .01), C.mintD, at(.24 - .1*Math.sin(-.4), .13, -.24 + .1*Math.cos(-.4)*-1, -.4, 1, 1, 1, -.7));
    CY(a, C.white, .008, .008, .3, .38, .04, .02, 6); B(a, C.pink, .01, .06, .1, .38, .26, .07, 0, .004); }
  a.into(host); host.userData.stage = stage;
}
const FILL = { carrot:fillCarrots, maze:fillMaze, agility:fillAgility };

/* ═════════════ PATHS, PROPS, FENCES (To-dos) ═════════════ */
const PATH_GEO = new RoundedBoxGeometry(.97, .035, .97, 2, .015);
function pathSlab(g, s){
  const slab = new THREE.Mesh(PATH_GEO, C.sand); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
  const a = new Acc2(), r = rngFrom(s.x*13 + s.z*29);
  [[-.24,-.22],[.22,-.24],[-.2,.24],[.25,.2],[0,0]].forEach(([x, z], i) => a.add(cyl(.09 + r()*.03, .1, .016, 16), [C.pink, C.mint, C.lav, C.butter, C.white][(i + s.x) % 5], at(x + (r()-.5)*.08, .04, z + (r()-.5)*.08, 0, 1, 1, .85 + r()*.3)));
  a.into(g);
}
const PROPS = {
  bowls(a){ for (const [x, z, m] of [[-.12, .14, C.pink], [.12, .1, C.sky]]) { CY(a, m, .09, .065, .05, x, .035, z, 20); CY(a, x < 0 ? C.kibble : C.waterL, .075, .075, .02, x, .06, z, 16); }
    bone(a, C.butter, .05, .06, -.18, .5, 1.1); },
  ball(a){ beachBall(a, .12, .035, .1, .1); a.add(sph(.04, 12), C.yellow, at(-.2, .075, -.1)); },
  bench(a){ for (const x of [-.24, .24]) { B(a, C.white, .05, .14, .2, x, .035, .1, 0, .015); }
    B(a, C.pink, .6, .035, .2, 0, .175, .1, 0, .015); B(a, C.pink, .6, .14, .03, 0, .21, .0, 0, .015); B(a, C.pinkD, .62, .025, .035, 0, .35, .0, 0, .01); },
  toys(a){ B(a, C.sky, .1, .1, .1, -.14, .035, .08, .3, .025); B(a, C.pink, .1, .1, .1, -.02, .035, .16, -.2, .025); B(a, C.butter, .09, .09, .09, -.08, .135, .1, .5, .025);
    a.add(tor(.06, .02, 20), C.mint, at(.16, .06, -.05, 0, 1, 1, 1, Math.PI/2)); a.add(sph(.045, 12), C.coral, at(.18, .08, .14)); bone(a, C.white, -.1, .05, -.16, 1, 1.2); },
  swing(a){ for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(cyl(.018, .018, .6, 8), C.sky, at(sx*.28, .31, sz*.1, 0, 1, 1, 1, sz*.3, 0));
    a.add(cyl(.02, .02, .64, 8), C.skyD, at(0, .59, 0, 0, 1, 1, 1, 0, Math.PI/2));
    for (const x of [-.08, .08]) CY(a, C.rope, .005, .005, .4, x, .18, 0, 4); B(a, C.pink, .22, .03, .1, 0, .16, 0, 0, .012); },
  plain(){}
};
function buildFence(g, s){                  // white picket fence with pastel caps
  const a = new Acc2();
  for (let i=0;i<s.len;i++){ const o = i - (s.len-1)/2;
    for (let k=0;k<5;k++){ const t = -.4 + k*.2, px = s.edge === 'w' ? -.45 : o + t, pz = s.edge === 'w' ? o + t : .45;
      B(a, C.white, .06, .2, .04, px, 0, pz, s.edge === 'w' ? Math.PI/2 : 0, .015); a.add(cone(.04, .06, 4), [C.pink, C.mint, C.lav, C.butter, C.sky][(k + i) % 5], at(px, .23, pz, Math.PI/4)); }
    for (const y of [.07, .15]) B(a, C.white, s.edge === 'w' ? .03 : 1, .03, s.edge === 'w' ? 1 : .03, s.edge === 'w' ? -.45 : o, y, s.edge === 'w' ? o : .43, 0, .01);
  }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}

/* ═════════════ TREES (Vocab): KayKit round trees + parasols, pastel ═════════════ */
function buildTree(g, s){
  kitB(g, s.model, s.h, s.w, s.t, 0, 0, 0, (s.rot||0)*Math.PI/180);
  if (s.pair) kitB(g, s.pair, s.h*.55, s.w*.5, s.pt ?? s.t, .26, 0, .28, 1);
  const a = new Acc2(); flowerDots(a, rngFrom(s.x*7 + s.z*3), 3, .4, 0); a.into(g);
}

/* ═════════════ THE HERO (Gita): rainbow pet carousel ═════════════ */
const RIDERS = ['dog', 'cat', 'bunny', 'pig', 'chick', 'parrot'];
function buildCarousel(g){
  const a = new Acc2();
  // rainbow arch behind the carousel, facing the camera
  const arch = new THREE.Group(); arch.position.set(-.34, 0, -.34); arch.rotation.y = Math.PI/4; g.add(arch);
  const ra = new Acc2(); RAINBOW.forEach((m, i) => ra.add(tor(1.24 - i*.085, .045, 44, Math.PI), m, at(0, .16, 0)));
  for (const x of [-1, 1]) { ra.add(sph(.17, 14), C.white, at(x*1.0, .14, 0, 0, 1.4, .9, 1)); ra.add(sph(.13, 14), C.white, at(x*1.2, .12, .06, 0, 1.2, .8, 1)); ra.add(sph(.12, 14), C.white, at(x*.82, .1, .08, 0, 1.2, .8, 1)); }   // clouds at the feet
  ra.into(arch);
  // carousel
  CY(a, C.pinkD, .82, .84, .08, .08, 0, .08, 40); CY(a, C.cream, .76, .78, .06, .08, .08, .08, 40);
  for (let i=0;i<24;i++){ const q = i/24*6.28; a.add(sph(.022, 8), i%2 ? C.butter : C.white, at(.08 + Math.cos(q)*.8, .1, .08 + Math.sin(q)*.8)); }
  CY(a, C.lav, .1, .12, .86, .08, .14, .08, 18); for (let k=0;k<4;k++) a.add(tor(.105, .018, 18), C.white, at(.08, .3 + k*.18, .08, 0, 1, 1, 1, Math.PI/2));
  const roofY = .96;
  for (let i=0;i<12;i++) a.add(memo('cz'+i, () => new THREE.ConeGeometry(.84, .36, 12, 1, false, i/12*Math.PI*2, Math.PI*2/12)), i%2 ? C.white : C.pink, at(.08, roofY + .18, .08));
  for (let i=0;i<12;i++){ const q = (i + .5)/12*6.28; a.add(sph(.075, 12), i%2 ? C.pink : C.white, at(.08 + Math.sin(q)*.8, roofY - .01, .08 + Math.cos(q)*.8, 0, 1, .7, 1)); }   // scallops
  a.add(sph(.07, 14), C.butter, at(.08, roofY + .4, .08)); a.add(cone(.03, .12, 4), C.pinkD, at(.08, roofY + .5, .08, 0, 1, 1, 1));
  const rot = new THREE.Group(); rot.position.set(.08, 0, .08); g.add(rot); g.userData.spin = rot;       // the turning part: poles + rider pets
  const ra2 = new Acc2();
  RIDERS.forEach((kind, i) => { const q = i/RIDERS.length*6.28 + .3, x = Math.cos(q)*.56, z = Math.sin(q)*.56, h = .3 + (i%2)*.07;
    ra2.add(cyl(.016, .016, roofY - .14, 8), C.metal, at(x, .14 + (roofY - .14)/2, z)); ra2.add(sph(.03, 10), C.butter, at(x, roofY - .02, z));
    const p = petClone(kind); if (p) { fitPet(p.o, kind === 'chick' || kind === 'parrot' ? .22 : .3); const hold = new THREE.Group(); hold.add(p.o);
      hold.position.set(x, h - .14, z); hold.rotation.y = -q; rot.add(hold); }
    ra2.add(cyl(.07, .07, .03, 14), [C.sky, C.mint, C.butter, C.lav, C.peach, C.pink][i], at(x, h - .155, z)); });   // saddle discs
  ra2.into(rot);
  a.into(g);
  g.userData.lamp = [0, 1.3, 0];
}

/* ═════════════ BLUEPRINT: every farm slot id → a pet-park piece ═════════════ */
const MAP = {
  bigbarn:{ name:'Pet café', b:'cafe' },
  silo:{ name:'Cat tower', b:'cattower' }, silohouse:{ name:'Dog house', b:'doghouse' }, coop:{ name:'Bunny hutch', b:'hutch' },
  smallbarn:{ name:'Vet cottage', b:'vet' }, openbarn:{ name:'Bird houses', b:'birds' },
  well:{ name:'Sprinkler fountain', b:'sprinkler' }, watertower:{ name:'Splash pool', b:'pool' }, pump:{ name:'Splash pond', b:'splash' }, pond:{ name:'Duck pond', b:'duckpond' },
  apple1:{ name:'Blossom tree', b:'tree', model:'Tree_1_A_Color1', t:1, rot:20, h:1.15, w:.92 },
  apple2:{ name:'Mint round tree', b:'tree', model:'Tree_1_C_Color1', t:4, rot:140, h:1.2, w:.92 },
  berry1:{ name:'Lilac tree', b:'tree', model:'Tree_2_A_Color1', t:2, rot:0, h:1.15, w:.85, pair:'Bush_1_F_Color1', pt:1 },
  orange1:{ name:'Lemon parasol', b:'tree', model:'Tree_3_A_Color1', t:3, rot:0, h:1.2, w:.95 },
  apple3:{ name:'Blossom tree', b:'tree', model:'Tree_1_B_Color1', t:1, rot:260, h:1.1, w:.9 },
  berry2:{ name:'Mint round tree', b:'tree', model:'Tree_1_A_Color1', t:4, rot:90, h:1.0, w:.88, pair:'Bush_1_E_Color1', pt:2 },
  orange2:{ name:'Lilac parasol', b:'tree', model:'Tree_3_B_Color1', t:2, rot:200, h:1.2, w:.95 },
  apple4:{ name:'Blossom tree', b:'tree', model:'Tree_1_C_Color1', t:1, rot:60, h:1.1, w:.9 },
  peepal:{ name:'Rainbow carousel', b:'carousel' }
};
const PATH_V = { path3_4:['bowls','Food bowls'], path3_5:['ball','Ball path'], path1_2:['bench','Park bench'], path5_2:['toys','Toy pile'],
  path3_6:['swing','Swing'], path2_6:['bench','Park bench'], path3_0:['plain','Cream path'] };
const GROW = { field2_4:'carrot', field4_4:'agility', field1_3:'maze', field1_4:'carrot', field1_5:'agility', field2_5:'maze',
  field4_5:'carrot', field6_3:'agility', field6_4:'maze', field4_6:'carrot' };
const GROW_NAME = { carrot:'Carrot patch', maze:'Flower maze', agility:'Agility course' };
export const PETS_SLOTS = FARM_SLOTS.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') { const g = GROW[f.id]; return { ...s, kind:'grow', grow:g, name:GROW_NAME[g], stages:5 }; }
  if (f.kind === 'path') { const [v, name] = PATH_V[f.id] || ['plain', 'Cream path']; return { ...s, kind:'p', b:'path', v, name }; }
  if (f.kind === 'fence') return { ...s, kind:'p', b:'fence', edge:f.edge, len:f.len, name:'Picket fence' };
  return { ...s, kind:'p', ...MAP[f.id] };
});
const BUILD = { cafe:buildCafe, doghouse:buildDogHouse, cattower:buildCatTower, hutch:buildHutch, vet:buildVet, birds:buildBirdHouses,
  sprinkler:buildSprinkler, pool:buildSplashPool, splash:buildSplashPond, duckpond:buildDuckPond, tree:buildTree, carousel:buildCarousel,
  fence:buildFence, path(g, s){ pathSlab(g, s); const a = new Acc2(); (PROPS[s.v] || PROPS.plain)(a); a.into(g); if (s.v === 'plain') g.userData.ghostMode = 'marker'; } };

/* ═════════════ LOOK: pastel mint tiles, cream soil ═════════════ */
const PET_TILE = { top:['#B4EBCB','#A9E4C2'], side:'#96D8B2', soilTop:'#FBE3C6', soilBot:'#EBBF9B' };
function petTileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(171);
  g.fillStyle = '#F4FAF6'; g.fillRect(0,0,N,N);
  for (let i=0;i<12;i++){ const x = r()*N, y = r()*N, rad = 20 + r()*40, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, r() < .6 ? 'rgba(255,255,255,.5)' : 'rgba(80,150,120,.06)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0,0,N,N); }
  g.lineCap = 'round';
  for (let i=0;i<150;i++){ const x = r()*N, y = r()*N, len = 3 + r()*5, a = -Math.PI/2 + (r()-.5)*.9;
    g.strokeStyle = r() < .5 ? 'rgba(70,140,110,.12)' : 'rgba(255,255,255,.8)'; g.lineWidth = 1.2 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a)*len, y + Math.sin(a)*len); g.stroke(); }
  for (let i=0;i<22;i++){ g.fillStyle = ['rgba(255,190,210,.95)','rgba(255,255,255,.95)','rgba(210,190,250,.9)','rgba(255,230,150,.95)'][i%4];
    const x = 16 + r()*(N - 32), y = 16 + r()*(N - 32); for (let k=0;k<5;k++){ const q = k/5*6.28; g.beginPath(); g.arc(x + Math.cos(q)*2.4, y + Math.sin(q)*2.4, 1.7, 0, 6.3); g.fill(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ── decor: pastel mint tufts + little daisies; pastel bushes on some empty cells ── */
function petDecor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(23);
  const tufts = (grp, x, z, n) => { for (let j=0;j<n;j++){ const p = cellPos(x, z), q = r()*6.28, rad = .1 + r()*.36;
    kitB(grp, r() < .5 ? 'Grass_1_D_Color1' : 'Grass_1_B_Color1', .12 + r()*.06, .3, 4, p.x + Math.cos(q)*rad, p.y, p.z + Math.sin(q)*rad, r()*6.28); } };
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x, z), a = new Acc2();
    if (!sl || sl === 'later') { tufts(grp, x, z, 3);
      if (AMBIENT()) { flowerDots(a, r, 4, .4, p.y, p.x, p.z);
        if (r() < .45) kitB(grp, ['Bush_1_F_Color1','Bush_1_E_Color1','Bush_1_A_Color1'][Math.floor(r()*3)], .26 + r()*.1, .34, [1, 2, 4][Math.floor(r()*3)], p.x + (r()-.5)*.4, p.y, p.z + (r()-.5)*.4, r()*6); }
      grp.userData.decor = 'meadow'; }
    else if (!placed.includes(sl.id) && AMBIENT()) { tufts(grp, x, z, 1); if (sl.b !== 'path') flowerDots(a, r, 2, .38, p.y, p.x, p.z); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else { world.remove(grp); continue; }
    a.into(grp);
  }
}

/* ═════════════ AMBIENT: hopping pets, a bouncing ball, bubbles, a kite ═════════════ */
function bubbleTex(){
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  const gr = g.createRadialGradient(s/2, s/2, s*.3, s/2, s/2, s*.48); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(.75, 'rgba(210,190,255,.55)'); gr.addColorStop(.9, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0,0,s,s); g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(s*.36, s*.34, 5, 3.4, -.7, 0, 6.3); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let BUB_TEX = null;
const done = () => placed.length === TH().slots.length;
const worldAt = (cx, cz, y = 0) => { const p = cellPos(cx, cz); p.y += y; return p; };
function petsAmbient(){
  V.pp = { pets:[], bubbles:[], ball:null, kite:null };
  if (!done()) {                                     // 1–2 pets live here from the first piece; the full cast replaces them on completion
    const spots = [['bunny', 3.05, 4.05, 1.2], ...(V.ring >= 2 ? [['dog', 1.05, 2.1, 1.6]] : [])];
    spots.forEach(([kind, cx, cz, ph]) => { const p = petClone(kind); if (!p) return;
      fitPet(p.o, kind === 'dog' ? .4 : .36); const hold = new THREE.Group(); hold.add(p.o); const base = worldAt(cx, cz); hold.position.copy(base); world.add(hold);
      const mixer = new THREE.AnimationMixer(p.o), idle = p.gltf.animations.find(c => c.name === 'Idle'); if (idle) mixer.clipAction(idle).play();
      hold.userData = { base, ph, mixer, span:.16 }; V.pp.pets.push(hold); V.life.push(hold); });
  }
  // bouncing ball
  { const a = new Acc2(); beachBall(a, 0, 0, 0, .09); const ball = new THREE.Group(); a.into(ball); world.add(ball);
    const [cx, cz] = V.ring >= 3 ? [0.35, 4.45] : V.ring >= 2 ? [0.9, 4.6] : [3.42, 3.6]; ball.userData.base = worldAt(cx, cz);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(.08, 20).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color:0x2f4a3a, transparent:true, opacity:.18, depthWrite:false }));
    sh.position.copy(ball.userData.base).setY(TILE_TOP + .004); world.add(sh); ball.userData.sh = sh; V.pp.ball = ball; V.life.push(ball, sh); }
  // bubbles, drifting up from the sprinkler (or the middle of the land before it's placed)
  BUB_TEX = BUB_TEX || bubbleTex();
  const src = V.pieces.well ? worldAt(4, 2, .6) : worldAt(3.3, 3.6, .4);
  for (let i=0;i<7;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:BUB_TEX, transparent:true, depthWrite:false, opacity:.9 }));
    s.renderOrder = 10; s.userData = { src, ph:i/7, dx:(i%3 - 1)*.25, dz:((i*5)%3 - 1)*.2, k:.07 + (i%3)*.025 }; world.add(s); V.pp.bubbles.push(s); V.life.push(s); }
  // kite over the back-left corner, string down to the land
  { const kite = new THREE.Group();
    const shape = (pts, mat) => { const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat.clone()); m.material.side = THREE.DoubleSide; kite.add(m); };
    shape([[0,.2,0],[-.14,0,0],[0,0,.01]], C.pink); shape([[0,.2,0],[0,0,.01],[.14,0,0]], C.sky); shape([[-.14,0,0],[0,-.26,0],[0,0,.01]], C.butter); shape([[0,0,.01],[0,-.26,0],[.14,0,0]], C.mint);
    const tail = []; for (let i=0;i<5;i++){ const b = new THREE.Mesh(sph(.025, 8), [C.pinkD, C.lavD, C.skyD, C.butterD, C.mintD][i]); b.scale.set(1.6, .6, .6); kite.add(b); tail.push(b); }
    const L = V.L, base = new THREE.Vector3(-L/2 + .7, TILE_TOP + 1.55 + V.ring*.15, -L/2 + 1.1); kite.userData = { base, tail };
    kite.children.forEach(m => { m.castShadow = false; }); world.add(kite);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color:0xFFFFFF, transparent:true, opacity:.8 })); world.add(line); kite.userData.line = line;
    kite.userData.anchor = new THREE.Vector3(base.x - .15, TILE_TOP + .02, -L/2 + .12);
    V.pp.kite = kite; V.life.push(kite, line); V.framePts.push(base.clone().add(new THREE.Vector3(0, .3, 0))); }
  movePets(2.1, 0);
}
function movePets(t, dt){
  const P = V && V.pp; if (!P) return;
  const fin = done();
  P.pets.forEach(h => { const u = h.userData;
    if (fin) { if (h.parent) h.parent.remove(h); return; }
    u.mixer.update(dt || 0);
    const c = t*.45 + u.ph, n = Math.floor(c/3), k = c - n*3, fwd = n % 2 === 0;       // every ~6.6 s: two hops across, then sit
    const e = k < 1 ? k : 1, f = fwd ? e : 1 - e, dx = u.span*2, dz = u.span;
    h.position.set(u.base.x - dx + f*dx*2, u.base.y + (k < 1 ? Math.abs(Math.sin(k*Math.PI*2))*.1 : 0), u.base.z - dz + f*dz*2);
    h.rotation.y = k < 1 ? Math.atan2(fwd ? dx : -dx, fwd ? dz : -dz) : .75 + Math.sin(t*.7 + u.ph)*.25; });
  if (P.ball) { const b = P.ball, u = b.userData, ph = (t*1.1) % 1, y = Math.abs(Math.sin(ph*Math.PI))*.42, sq = y < .03 ? .8 : 1;
    b.position.set(u.base.x, u.base.y + y*1 + .0, u.base.z); b.scale.set(1/Math.sqrt(sq), sq, 1/Math.sqrt(sq)); b.rotation.y = t*.8;
    u.sh.scale.setScalar(1 - y*.9); }
  P.bubbles.forEach(s => { const u = s.userData, k = (t*.16 + u.ph) % 1;
    s.position.set(u.src.x + u.dx*k + Math.sin(t*1.3 + u.ph*9)*.06, u.src.y + k*1.3, u.src.z + u.dz*k + Math.cos(t*1.1 + u.ph*7)*.06);
    s.scale.setScalar(u.k*(.6 + k*.6)); s.material.opacity = .95*Math.min(1, k*6)*(k > .9 ? (1 - k)*10 : 1); });
  if (P.kite) { const kt = P.kite, u = kt.userData;
    kt.position.set(u.base.x + Math.sin(t*.6)*.18, u.base.y + Math.sin(t*.9)*.08, u.base.z + Math.cos(t*.5)*.1); kt.rotation.set(0, Math.PI/4, Math.sin(t*1.2)*.25);
    u.tail.forEach((b, i) => b.position.set(Math.sin(t*3 - i*.8)*.04*(i + 1)*.6, -.3 - i*.07, 0));
    const pa = u.line.geometry.attributes.position; pa.setXYZ(0, u.anchor.x, u.anchor.y, u.anchor.z); pa.setXYZ(1, kt.position.x, kt.position.y - .05, kt.position.z); pa.needsUpdate = true; }
  // carousel turns slowly once placed
  const hero = V.pieces && V.pieces.peepal; if (hero && hero.userData.spin) hero.userData.spin.rotation.y = t*.35;
}

/* ═════════════ RESIDENTS: the whole cube-pet cast hops in ═════════════ */
const RES = [
  { id:'pet-dog',    kind:'dog',    name:'Pup',     h:.52, at:[0.15, 2.6],  face:.7 },
  { id:'pet-cat',    kind:'cat',    name:'Kitty',   h:.52, at:[0.2, 3.75],  face:1.1 },
  { id:'pet-bunny',  kind:'bunny',  name:'Bunny',   h:.5, at:[0.2, 5.0],   face:.9 },
  { id:'pet-pig',    kind:'pig',    name:'Piglet',  h:.48, at:[1.25, 6.1],  face:.4 },
  { id:'pet-chick',  kind:'chick',  name:'Chick',   h:.36,  at:[3.05, 5.25], face:.8 },
  { id:'pet-parrot', kind:'parrot', name:'Parrot',  h:.4, at:[5.15, 6.15], face:-.3 }
].map(d => ({ ...d, file:PETS[d.kind], walk:'Hop' }));

export default {
  id:'pets', name:'Pet park', title:'Your pet park',
  season:17, dates:'11–24 May', nextIn:14,
  kits:['a', BK],
  kitDefs:{ [BK]:{ file:'assets/kit-b/kit-b.glb' } },
  families:{
    water:   { label:'pools, ponds & fountains', tag:'Water' },
    building:{ label:'pet houses & café',        tag:'House' },
    path:    { label:'paths, toys & fences',     tag:'Path' },
    crop:    { label:'carrots, mazes & agility', tag:'Grows' },
    tree:    { label:'pastel trees',             tag:'Tree' },
    special: { label:'the rainbow carousel',     tag:'Special' }
  },
  slots:PETS_SLOTS, order:FARM_ORDER,
  ground:{ tile:PET_TILE, tileMap:petTileMap },
  ghost:{ color:'#5E9C86', opacity:.34, emissive:.12, dash:.7 },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><ellipse cx="12" cy="15.5" rx="4.6" ry="3.8" fill="#F58AA8"/><circle cx="6" cy="10.5" r="2.1" fill="#F58AA8"/><circle cx="9.6" cy="6.8" r="2.1" fill="#F58AA8"/><circle cx="14.4" cy="6.8" r="2.1" fill="#F58AA8"/><circle cx="18" cy="10.5" r="2.1" fill="#F58AA8"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M20 118a44 44 0 0 1 88 0h-10a34 34 0 0 0-68 0z" opacity=".55"/><path d="M40 118V74h48v44z"/><path d="M34 76 64 50l30 26z"/><path d="M56 118v-18a8 8 0 0 1 16 0v18z" fill="#fff" opacity=".5"/><ellipse cx="64" cy="30" rx="11" ry="9"/><circle cx="50" cy="20" r="5"/><circle cx="58" cy="13" r="5"/><circle cx="70" cy="13" r="5"/><circle cx="78" cy="20" r="5"/></g>',
  album:{ image:'assets/pets/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E6F6EE)' },
  css:'.phone[data-theme="pets"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#F1FAF5 55%,#FCE6EE 100%)}',

  build(g, s, opt){
    if (s.kind === 'grow') {
      const slab = new THREE.Mesh(rb(.9, .06, .9, .03), s.grow === 'carrot' ? C.soil : s.grow === 'maze' ? C.mintD : C.sand);
      slab.position.y = .03; slab.castShadow = false; slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab);
      const host = new THREE.Group(); g.add(host); g.userData.plants = host;
      const fill = FILL[s.grow]; g.userData.regrow = st => fill(host, s, st); fill(host, s, opt.stage ?? cropStage(s.id));
    } else BUILD[s.b](g, s);
  },
  scaleOf: () => 1,
  contact: s => s.kind === 'p' && !['path', 'fence', 'splash', 'duckpond', 'pool'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special',
  decor: petDecor,
  ambient: petsAmbient,
  tick(t, dt){ movePets(t, dt); },

  residents: RES,
  async preload(){
    await Promise.all(Object.keys(PETS).map(async kind => { const pr = loadAnimal({ id:'pet-' + kind, file:PETS[kind] }); pr.__done = fixPet(await pr); }));
    if (!TINT_TEX) { TINT_TEX = await new THREE.TextureLoader().loadAsync('assets/kit-b/forest_texture_tints.webp'); TINT_TEX.flipY = false; TINT_TEX.colorSpace = THREE.SRGBColorSpace; }
  },
  residentThumb(d, thumbFor){
    return thumbFor('pets:' + d.kind, () => { const p = petClone(d.kind); if (!p) return new THREE.Group();
      const mx = new THREE.AnimationMixer(p.o), c = p.gltf.animations.find(x => x.name === 'Idle'); if (c) { mx.clipAction(c).play(); mx.update(.4); }
      p.o.rotation.y = .2; return p.o; }, 168);
  }
};
