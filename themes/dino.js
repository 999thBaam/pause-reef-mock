/* DINO VALLEY (?theme=dino) — a lush jungle valley on the farm's 7×7 ring blueprint (same cells, same ring counts 6 / 15 / 19).
   Residents = Quaternius Animated Dinosaur Pack (6 rigged dinos, CC0, via Poly Pizza), recoloured to a storybook palette and
   with their clips renamed to Idle/Walk/… (assets/dino/*.glb). Palms = Quaternius Ultimate Stylized Nature "Palm Trees" (CC0,
   assets/dino/palms.glb). Ferns, conifers, grass = the shared MegaKit (kit a). Everything else (the volcano, cave, arches,
   fossil dig, nests + eggs, hot spring, waterfall, stepping stones, bones, logs, torches) is procedural flat-shaded geometry,
   merged per material (Acc) so every piece stays pre-renderable. */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { rngFrom, world, grassTileMap } from '../engine/scene.js';
import { S, V, cropStage } from '../engine/state.js';
import { edgeCentre, cellPos, TILE_TOP } from '../engine/grid.js';
import { KITCACHE, ANIMCACHE, addModel, fitScale, loadAnimal } from '../engine/kit.js';
import { Acc, seg, blob } from '../engine/proc.js';
import { meadowDecor, addButterflies, flyButterflies } from '../engine/life.js';

const DK = 'dino';
const tpl = (n, kit) => KITCACHE[kit] && KITCACHE[kit][n];
/* place a kit model fitted to [h, w] tiles */
function km(g, kit, name, h, w, x=0, y=0, z=0, rot=0){ const t = tpl(name, kit); if (!t) { console.warn('missing', name); return null; }
  return addModel(g, name, fitScale(t, h, w), x, y, z, rot, kit); }

const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.92, metalness:0, flatShading:true, ...o });
const DM = {
  basalt:FM(0x857570), basaltD:FM(0x665853), ochre:FM(0xC99A62), sandstone:FM(0xDDB77E), sandD:FM(0xB98E58),
  moss:FM(0x5FA544), mossL:FM(0x86C45A), dirt:FM(0x9A6B45, { roughness:1 }), dirtD:FM(0x7C5236, { roughness:1 }),
  bone:FM(0xF3E8D2), boneD:FM(0xD9CBB0), wood:FM(0x8A5A34), woodD:FM(0x6A4226), hide:FM(0xD9B07A), hideD:FM(0xB98A55),
  lava:new THREE.MeshStandardMaterial({ color:0xFF7A1F, emissive:0xFF5A00, emissiveIntensity:1.25, roughness:.6, flatShading:true }),
  lavaY:new THREE.MeshStandardMaterial({ color:0xFFD04A, emissive:0xFFB000, emissiveIntensity:1.4, roughness:.6 }),
  flame:new THREE.MeshStandardMaterial({ color:0xFFC857, emissive:0xFF9A1F, emissiveIntensity:1.8 }),
  water:new THREE.MeshStandardMaterial({ color:0x5CC3D8, roughness:.15, metalness:0, emissive:0x0E4A5A, emissiveIntensity:.35 }),
  spring:new THREE.MeshStandardMaterial({ color:0x6FD9CF, roughness:.12, metalness:0, emissive:0x136A66, emissiveIntensity:.4 }),
  foam:FM(0xEAF8FB, { roughness:.4 }),
  steam:new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:1, transparent:true, opacity:.55, depthWrite:false }),
  nest:FM(0xB08450), nestD:FM(0x8C6238),
  egg:[FM(0xF4EAD2, { flatShading:false }), FM(0xCFE6C4, { flatShading:false }), FM(0xF2D6B8, { flatShading:false })],
  spot:FM(0x9DB880, { flatShading:false }), crack:FM(0x5C4A38), pad:FM(0x6FAE45), reed:FM(0x7DAE4A)
};
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
/* a lumpy rock: low-poly dodecahedron with jittered verts */
function rock(acc, mat, x, y, z, r, sy=1, rng, ry=0, sx=1){
  const g = new THREE.DodecahedronGeometry(r, 0); if (rng) { const a = g.attributes.position;
    for (let i=0;i<a.count;i++){ const k = 1 + (rng()-.5)*.28; a.setXYZ(i, a.getX(i)*k, a.getY(i)*k, a.getZ(i)*k); } }
  acc.add(g, mat, at(x, y, z, ry, sx, sy, 1)); }
function torch(acc, x, z, h=.42){
  seg(acc, DM.woodD, V3(x, .03, z), V3(0,1,0), h, .022, .018, 6);
  acc.add(new THREE.CylinderGeometry(.045, .03, .06, 7), DM.wood, at(x, .03 + h, z));
  acc.add(new THREE.ConeGeometry(.04, .11, 7), DM.flame, at(x, .03 + h + .08, z));
}
function bone(acc, x, y, z, len, ry, r=.025, mat=DM.bone){
  acc.add(new THREE.CylinderGeometry(r, r, len, 6).rotateZ(Math.PI/2), mat, at(x, y, z, ry));
  for (const s of [-1, 1]) for (const o of [-1, 1]) acc.add(new THREE.SphereGeometry(r*1.25, 7, 5), mat, at(x + Math.cos(ry)*s*len/2 - Math.sin(ry)*o*r*.9, y, z - Math.sin(ry)*s*len/2 - Math.cos(ry)*o*r*.9));
}

/* ── BLUEPRINT: the farm's cells, dino-valley pieces ── */
const B = (id, name, kind, x, z, extra = {}) => ({ id, cat:'building', gate:'lesson', name, kind, x, z, ...extra });
const PALM = (id, name, x, z, model, rot, h = 1.35) => ({ id, cat:'tree', gate:'vocab', name, kind:'palm', model, x, z, rot, h });
export const DINO = [
  // ── ring 1: cave home (2×2 hero) + hot spring + palm + stepping stones + two nests ──
  { id:'cave', cat:'building', gate:'lesson', name:'Cave home', kind:'cave', x:2, z:2, w:2, d:2 },
  { id:'spring', cat:'water', gate:'breathe', name:'Hot spring', kind:'spring', x:4, z:2 },
  PALM('palm1', 'Palm tree', 4, 3, 'PalmTree_1', 20),
  { id:'stones3_4', cat:'path', gate:'todos', name:'Stepping stones', kind:'stones', x:3, z:4 },
  // ── ring 2 ──
  B('arch', 'Stone arch', 'arch', 2, 1),
  B('dig', 'Fossil dig', 'dig', 3, 1),
  B('nestrock', 'Nest cliff', 'nestrock', 4, 1),
  { id:'falls', cat:'water', gate:'breathe', name:'Waterfall', kind:'falls', x:5, z:1 },
  { id:'lake', cat:'water', gate:'breathe', name:'Reed lake', kind:'lake', x:5, z:4, reeds:true },
  { id:'treefern1', cat:'tree', gate:'vocab', name:'Tree fern', kind:'treefern', x:5, z:3, rot:30 },
  { id:'conifer1', cat:'tree', gate:'vocab', name:'Ancient conifer', kind:'conifer', model:'Pine_5', x:5, z:5, rot:0 },
  // ── ring 3 ──
  { id:'volcano', cat:'special', gate:'gita', name:'Volcano', kind:'volcano', x:0, z:0, w:2, d:2 },
  B('stones', 'Standing stones', 'menhirs', 2, 0),
  B('hut', 'Bone hut', 'hut', 4, 0),
  { id:'lagoon', cat:'water', gate:'breathe', name:'Lily lagoon', kind:'lake', x:6, z:2 },
  PALM('palm2', 'Tall palm', 5, 0, 'PalmTree_3', 0, 1.5),
  PALM('palm3', 'Palm tree', 6, 0, 'PalmTree_2', 200),
  { id:'treefern2', cat:'tree', gate:'vocab', name:'Tree fern', kind:'treefern', x:6, z:1, rot:140 },
  { id:'conifer2', cat:'tree', gate:'vocab', name:'Ancient conifer', kind:'conifer', model:'Pine_1', x:6, z:5, rot:60 },
  PALM('palm4', 'Twin palm', 6, 6, 'PalmTree_4', 60, 1.4),
  // Sudoku → dino nests (eggs pile up, crack, hatch) · Math tricks → fern patches that unfurl
  ...[[2,4],[4,4],[1,3],[1,4],[2,5],[4,5],[6,3]].map(([x,z],i) => ({ id:'nest'+x+'_'+z, cat:'crop', gate:'sudoku', name:'Dino nest', kind:'nest', egg:i%3, x, z, stages:5 })),
  ...[[1,5],[6,4],[4,6]].map(([x,z]) => ({ id:'ferns'+x+'_'+z, cat:'crop', gate:'mathtricks', name:'Fern patch', kind:'ferns', x, z, stages:5 })),
  // To-dos → stepping stones, bones, logs, torches, fences
  { id:'bones1_2', cat:'path', gate:'todos', name:'Bone trail', kind:'stones', bones:true, x:1, z:2 },
  { id:'torch5_2', cat:'path', gate:'todos', name:'Torch path', kind:'stones', torch:true, x:5, z:2 },
  { id:'stones3_5', cat:'path', gate:'todos', name:'Stepping stones', kind:'stones', x:3, z:5 },
  { id:'log', cat:'path', gate:'todos', name:'Fallen log', kind:'log', x:3, z:0 },
  { id:'boulders', cat:'path', gate:'todos', name:'Boulders', kind:'boulders', x:2, z:6 },
  { id:'torch3_6', cat:'path', gate:'todos', name:'Torch path', kind:'stones', torch:true, x:3, z:6 },
  { id:'fence1', cat:'path', gate:'todos', name:'Log fence', kind:'fence', fence:'log', x:0, z:2, edge:'w', len:2 },
  { id:'fence2', cat:'path', gate:'todos', name:'Bone fence', kind:'fence', fence:'bone', x:0, z:4, edge:'w', len:2 },
  { id:'fence3', cat:'path', gate:'todos', name:'Rock wall', kind:'fence', fence:'rock', x:0, z:6, edge:'s', len:2 },
  { id:'fence4', cat:'path', gate:'todos', name:'Log fence', kind:'fence', fence:'log', x:5, z:6, edge:'s', len:2 }
];
export const DINO_ORDER = ['cave','nest2_4','palm1','spring','stones3_4','nest4_4',
  'stones3_5','nestrock','nest1_3','arch','conifer1','bones1_2','nest4_5','falls','treefern1','nest1_4','dig','torch5_2','ferns1_5','lake','nest2_5',
  'volcano','torch3_6','lagoon','fence1','palm2','stones','nest6_3','treefern2','fence2','hut','boulders','conifer2','ferns6_4','palm4','fence3','ferns4_6','palm3','log','fence4'];

/* ── stepping stones on a dark jungle-dirt slab; + bones / a torch ── */
function buildStones(g, s){
  const acc = new Acc(), r = rngFrom(s.x*13 + s.z*29 + 7);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(.97, .035, .97), DM.dirt); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
  [[-.22,-.2],[.18,-.22],[-.16,.2],[.22,.18],[0,0]].forEach(([x,z],i) => { if (i === 4 && (s.bones || s.torch)) return;
    acc.add(new THREE.CylinderGeometry(.13, .15, .05, 8), i%2 ? DM.basalt : DM.sandD, at(x + (r()-.5)*.08, .05, z + (r()-.5)*.08, r()*3, 1 + r()*.25, 1, .85 + r()*.3)); });
  if (s.bones) { bone(acc, .05, .06, .02, .36, .6, .03); bone(acc, -.3, .05, .33, .2, 2.1, .02); acc.add(new THREE.SphereGeometry(.08, 8, 6), DM.bone, at(.3, .07, .32, 0, 1.2, .8, 1)); }
  if (s.torch) { torch(acc, .3, -.3, .5); torch(acc, -.3, .3, .5); }
  acc.into(g);
  if (!s.bones && !s.torch) g.userData.ghostMode = 'marker';
}
/* ── dino nest: a twig ring with eggs → more eggs → a crack → hatched (shells + a baby parasaurolophus) ── */
function eggGeo(){ const pts = []; for (let i=0;i<=10;i++){ const t = i/10, a = t*Math.PI; pts.push(new THREE.Vector2(Math.sin(a)*(t < .5 ? 1 : .78 + .22*Math.sin(a)), -Math.cos(a)*1.25)); }
  return new THREE.LatheGeometry(pts, 14); }
const EGG = eggGeo();
function nestBase(acc, r){
  acc.add(new THREE.TorusGeometry(.26, .075, 7, 16).rotateX(Math.PI/2), DM.nest, at(0, .09, 0, 0, 1, .8, 1));
  acc.add(new THREE.CylinderGeometry(.24, .2, .06, 14), DM.nestD, at(0, .06, 0));
  for (let i=0;i<14;i++){ const a = r()*6.28, d = .24 + r()*.08; seg(acc, i%2 ? DM.nest : DM.nestD, V3(Math.cos(a)*d, .1, Math.sin(a)*d), V3(-Math.sin(a), (r()-.5)*.3, Math.cos(a)), .16, .012, .01, 4); }
}
function fillNest(plants, s, stage){
  plants.clear(); const acc = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 5), st = Math.min(5, stage), em = DM.egg[s.egg||0];
  nestBase(acc, r);
  const n = [0, 1, 2, 3, 3, 2][st], k = [0, .065, .075, .085, .095, .095][st];
  const spots = [[-.07,-.04],[.08,-.05],[0,.08]];
  for (let i=0;i<n;i++){ const [x,z] = spots[i], tilt = (r()-.5)*.4;
    acc.add(EGG, em, at(x, .1 + k*1.2, z, r()*3, k, k, k, tilt, (r()-.5)*.3));
    for (let j=0;j<3;j++) acc.add(new THREE.SphereGeometry(k*.22, 6, 4), DM.spot, at(x + (r()-.5)*k*1.2, .1 + k*(1 + r()*1.2), z + k*.8, 0, 1, 1, .4));
    if (st === 4 && i === 0) for (let j=0;j<5;j++) acc.add(new THREE.BoxGeometry(k*.5, .012, .012), DM.crack, at(x - k*.5 + j*k*.25, .1 + k*1.5 + (j%2 ? .02 : -.02), z + k*.9, 0, 1, 1, 1, 0, j%2 ? .7 : -.7));
  }
  if (st >= 5) { // hatched: two shell halves + a baby triceratops
    acc.add(new THREE.SphereGeometry(.07, 10, 6, 0, 6.28, Math.PI/2, Math.PI/2), em, at(.12, .12, .1, 0, 1, 1.1, 1, .3));
    acc.add(new THREE.SphereGeometry(.065, 10, 6, 0, 6.28, Math.PI/2, Math.PI/2), em, at(-.12, .16, .12, 0, 1, 1.1, 1, Math.PI - .4));
  }
  acc.into(plants);
  if (st >= 5) { const b = baby(.3, 'Triceratops'); if (b) { b.position.set(.06, .09, .1); b.rotation.y = 2.36; plants.add(b); } }
  plants.userData.stage = stage;
}
/* a posed (static) baby from the animated pack: pre-renderable, the clip is sampled once */
function baby(h, id = 'Parasaurolophus'){
  const gltf = ANIMCACHE['__d_' + id]; if (!gltf) return null;
  const o = SkeletonUtils.clone(gltf.scene), mx = new THREE.AnimationMixer(o);
  const c = gltf.animations.find(x => x.name === 'Idle'); if (c) { mx.clipAction(c).play(); mx.update(.5); }
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
  const bx = new THREE.Box3().setFromObject(o), k = h / (bx.max.y - bx.min.y); o.scale.setScalar(k); o.position.y = -bx.min.y*k;
  const g = new THREE.Group(); g.add(o); return g;
}
/* ── fern patch: mossy ground, ferns unfurl + multiply (math tricks) ── */
function fillFerns(plants, s, stage){
  plants.clear(); const r = rngFrom(s.x*17 + s.z*5 + 9), st = Math.min(5, stage);
  const n = [0, 3, 4, 5, 5, 6][st], h = [0, .16, .24, .32, .38, .44][st];
  const pos = [[-.2,-.18],[.2,-.16],[0,.2],[-.22,.2],[.22,.22],[0,-.02]];
  for (let i=0;i<n;i++){ const [x,z] = pos[i]; km(plants, 'a', 'Fern_1', h*(.85 + r()*.3), .6, x, .05, z, r()*6.28); }
  if (st >= 4) km(plants, 'a', 'Mushroom_Laetiporus', .12, .2, .3, .05, -.32, 1);
  plants.userData.stage = stage;
}
function buildFerns(g, s, stage){
  const acc = new Acc(), r = rngFrom(s.x*3 + s.z*11);
  acc.add(new THREE.CylinderGeometry(.44, .46, .05, 10), DM.moss, at(0, .025, 0, r()*3, 1, 1, .95));
  rock(acc, DM.basalt, .33, .05, .3, .07, .7, r);
  const bed = new THREE.Group(); acc.into(bed); bed.userData.ghostHide = true; g.add(bed);
  const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillFerns(plants, s, st);
  fillFerns(plants, s, stage);
}
function buildNest(g, s, stage){
  const acc = new Acc(), r = rngFrom(s.x*5 + s.z*19);
  acc.add(new THREE.CylinderGeometry(.44, .46, .04, 10), DM.sandstone, at(0, .02, 0, r()*3));
  for (let i=0;i<5;i++){ const a = r()*6.28; rock(acc, i%2 ? DM.ochre : DM.sandD, Math.cos(a)*.38, .04, Math.sin(a)*.38, .05 + r()*.03, .6, r); }
  const bed = new THREE.Group(); acc.into(bed); bed.userData.ghostHide = true; g.add(bed);
  km(g, 'a', 'Fern_1', .22, .4, -.3, .03, .3, 1.2);
  const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillNest(plants, s, st);
  fillNest(plants, s, stage);
}

/* ── water ── */
function steam(acc, x, y, z, n, r, rng){ for (let i=0;i<n;i++) acc.add(new THREE.IcosahedronGeometry(.05 + i*.018, 1), DM.steam, at(x + (rng()-.5)*.08, y + i*.09, z + (rng()-.5)*.08)); }
function buildSpring(g){
  const acc = new Acc(), r = rngFrom(91);
  acc.add(new THREE.CylinderGeometry(.42, .45, .06, 18), DM.sandstone, at(0, .03, 0, 0, 1.05, 1, .95));
  acc.add(new THREE.CylinderGeometry(.33, .33, .02, 22), DM.spring, at(0, .07, 0, 0, 1.05, 1, .95));
  for (let i=0;i<13;i++){ const a = i/13*6.28 + r()*.2; rock(acc, i%3 ? DM.ochre : DM.basalt, Math.cos(a)*.38*1.05, .07, Math.sin(a)*.38*.95, .06 + r()*.03, .65, r); }
  acc.into(g);
  const st = new Acc(); steam(st, -.06, .16, -.02, 4, .05, r); steam(st, .12, .14, .1, 3, .04, r);
  const sm = new THREE.Group(); st.into(sm); sm.traverse(m => { if (m.isMesh) m.castShadow = false; }); sm.userData.ghostHide = true; g.add(sm);
  km(g, 'a', 'Fern_1', .26, .4, -.34, .05, .3, .4);
}
function buildLake(g, s){
  const acc = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 11);
  acc.add(new THREE.CylinderGeometry(.44, .46, .04, 26), DM.moss, at(0, .02, 0, 0, 1.05, 1, .95));
  acc.add(new THREE.CylinderGeometry(.37, .37, .02, 26), DM.water, at(0, .045, 0, 0, 1.05, 1, .95));
  for (let i=0;i<14;i++){ const a = i/14*6.28 + r()*.2; rock(acc, i%3 ? DM.basalt : DM.sandD, Math.cos(a)*.41*1.05, .045, Math.sin(a)*.41*.95, .055 + r()*.03, .55, r); }
  [[-.12,.06],[.14,-.12],[.05,.18]].forEach(([x,z]) => acc.add(new THREE.CylinderGeometry(.07, .07, .012, 12), DM.pad, at(x, .058, z)));
  acc.into(g);
  if (s.reeds) { km(g, 'a', 'Grass_Wispy_Tall', .34, .3, -.28, .04, -.22, .3); km(g, 'a', 'Grass_Wispy_Tall', .28, .24, .28, .04, .2, 1.2); }
  else km(g, 'a', 'Flower_3_Single', .16, .2, -.3, .04, .26, .4);
  km(g, 'a', 'Fern_1', .24, .36, .3, .04, -.28, 2);
}
function buildFalls(g){
  const acc = new Acc(), r = rngFrom(55);
  // back cliff: stacked basalt, mossy top
  rock(acc, DM.basalt, -.18, .25, -.2, .3, 1.5, r, .3, 1.2); rock(acc, DM.basaltD, .18, .22, -.26, .26, 1.4, r, 1); rock(acc, DM.basalt, -.3, .58, -.28, .2, 1.3, r, 2);
  rock(acc, DM.basaltD, .05, .62, -.3, .2, 1.2, r, .6);
  blob(acc, DM.moss, V3(-.12, .82, -.28), .2, .45, 0, r); blob(acc, DM.mossL, V3(.1, .78, -.3), .16, .4, 0, r);
  // falling sheet + pool
  acc.add(new THREE.BoxGeometry(.2, .66, .04), DM.water, at(0, .42, -.06, 0, 1, 1, 1, -.12));
  acc.add(new THREE.CylinderGeometry(.3, .32, .03, 20), DM.water, at(.02, .045, .16, 0, 1.2, 1, .9));
  for (let i=0;i<10;i++){ const a = i/10*6.28; rock(acc, DM.sandD, .02 + Math.cos(a)*.35, .04, .16 + Math.sin(a)*.3, .05, .6, r); }
  for (let i=0;i<6;i++) acc.add(new THREE.IcosahedronGeometry(.035 + r()*.025, 0), DM.foam, at((r()-.5)*.24, .08, .02 + r()*.1));
  acc.into(g);
  km(g, 'a', 'Fern_1', .26, .36, .34, .03, -.1, 1);
}

/* ── buildings ── */
function buildCave(g){   // ring-1 hero: a warm sandstone hill, mossy on top, a big dark cave mouth facing the camera, torches, bones, ferns
  const acc = new Acc(), r = rngFrom(222);
  acc.add(new THREE.CylinderGeometry(.95, .97, .04, 24), DM.dirt, at(0, .02, 0));
  const yard = new THREE.Group(); acc.into(yard); yard.userData.ghostHide = true; g.add(yard);
  const a2 = new Acc();
  // the hill sits back-left of the footprint; its front face is where the mouth opens
  rock(a2, DM.sandstone, -.28, .46, -.28, .6, 1.0, r, .4, 1.05); rock(a2, DM.ochre, .22, .32, -.5, .38, .95, r, 1.2);
  rock(a2, DM.ochre, -.52, .3, .2, .36, .9, r, 2); rock(a2, DM.sandD, -.02, .86, -.36, .32, .8, r, .8);
  rock(a2, DM.sandstone, .5, .2, -.18, .22, .9, r, 2.6); rock(a2, DM.sandD, -.25, .2, .5, .2, .9, r, 1.6);
  blob(a2, DM.moss, V3(-.26, 1.02, -.3), .32, .34, 1, r); blob(a2, DM.mossL, V3(.1, .98, -.42), .2, .32, 0, r);
  blob(a2, DM.moss, V3(-.6, .6, .18), .2, .4, 0, r);
  // stone frame around the mouth
  const C = Math.SQRT1_2, mx = .14, mz = .14;
  for (let i=0;i<9;i++){ const t = i/8*Math.PI, x = Math.cos(t)*.36, y = Math.sin(t)*.44;
    rock(a2, i%2 ? DM.basalt : DM.basaltD, mx + x*C, .02 + y, mz - x*C, .08, 1, r, i); }
  torch(a2, .62, -.08, .44); torch(a2, -.08, .62, .44);
  bone(a2, .62, .05, .56, .32, .8, .032); a2.add(new THREE.SphereGeometry(.08, 8, 6), DM.bone, at(.44, .08, .7, 0, 1.2, .85, 1));
  a2.into(g);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(.34, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color:0x2A1C18 }));
  mouth.position.set(mx + .02, .03, mz + .02); mouth.rotation.y = Math.PI/4; mouth.scale.set(1, 1.2, 1); mouth.userData.ghostHide = true; g.add(mouth);
  km(g, 'a', 'Fern_1', .34, .5, -.74, .03, .66, .3); km(g, 'a', 'Fern_1', .3, .45, .74, .03, -.66, 1.4); km(g, 'a', 'Fern_1', .22, .36, .34, .03, .78, 2.2);
}
function buildArch(g){
  const acc = new Acc(), r = rngFrom(31);
  for (const sx of [-1, 1]) { rock(acc, DM.sandstone, sx*.28, .16, 0, .15, 1.2, r, 0, .9); rock(acc, DM.ochre, sx*.3, .44, .0, .13, 1.3, r, 1, .85); rock(acc, DM.sandD, sx*.26, .7, 0, .12, 1.1, r); }
  rock(acc, DM.sandstone, 0, .88, 0, .2, .6, r, .2, 2.1); rock(acc, DM.ochre, -.16, .86, .02, .13, .7, r);
  blob(acc, DM.moss, V3(.05, 1.0, 0), .16, .35, 0, r);
  acc.into(g); g.children.at(-1).rotation.y = Math.PI/4;
  km(g, 'a', 'Fern_1', .22, .34, .32, .03, .3, .5);
}
function buildDig(g){
  const acc = new Acc(), r = rngFrom(71);
  acc.add(new THREE.BoxGeometry(.86, .05, .86), DM.sandstone, at(0, .025, 0));
  acc.add(new THREE.BoxGeometry(.66, .02, .66), DM.sandD, at(0, .055, 0));
  // pegs + rope square
  for (const [x,z] of [[-.4,-.4],[.4,-.4],[-.4,.4],[.4,.4]]) seg(acc, DM.wood, V3(x, .03, z), V3(0,1,0), .16, .016, .014, 5);
  for (const [x,z,ry] of [[0,-.4,0],[0,.4,0],[-.4,0,Math.PI/2],[.4,0,Math.PI/2]]) acc.add(new THREE.BoxGeometry(.8, .01, .01), DM.hideD, at(x, .17, z, ry));
  // skeleton: spine + ribs + skull
  for (let i=0;i<7;i++) acc.add(new THREE.SphereGeometry(.03, 6, 4), DM.bone, at(-.24 + i*.07, .08, -.02 + Math.sin(i*.6)*.02));
  for (let i=0;i<4;i++) for (const s of [-1, 1]) acc.add(new THREE.TorusGeometry(.09 - i*.012, .012, 5, 10, Math.PI*.8), DM.bone, at(-.14 + i*.07, .07, -.02, Math.PI/2, 1, 1, 1, s*Math.PI/2, 0));
  acc.add(new THREE.BoxGeometry(.14, .07, .1), DM.bone, at(.28, .09, -.02)); acc.add(new THREE.BoxGeometry(.08, .04, .08), DM.boneD, at(.37, .08, -.02));
  bone(acc, -.1, .07, .22, .24, .3, .022); bone(acc, .18, .07, .24, .2, 2.4, .02);
  // bucket + brush
  acc.add(new THREE.CylinderGeometry(.06, .05, .1, 10), DM.wood, at(.3, .1, .3));
  seg(acc, DM.woodD, V3(-.3, .06, .3), V3(1, .5, -.3), .2, .012, .012, 4);
  acc.into(g);
}
function buildNestRock(g){
  const acc = new Acc(), r = rngFrom(43);
  rock(acc, DM.basalt, 0, .22, 0, .3, 1.2, r, 0, 1.1); rock(acc, DM.basaltD, .05, .6, -.02, .24, 1.3, r, 1); rock(acc, DM.ochre, -.02, .9, 0, .2, .8, r, 2);
  blob(acc, DM.moss, V3(-.2, .3, .2), .13, .5, 0, r);
  acc.add(new THREE.TorusGeometry(.17, .05, 6, 14).rotateX(Math.PI/2), DM.nest, at(0, 1.07, 0));
  acc.add(new THREE.CylinderGeometry(.16, .12, .05, 12), DM.nestD, at(0, 1.05, 0));
  [[-.05,-.03],[.06,-.02],[0,.06]].forEach(([x,z],i) => acc.add(EGG, DM.egg[i%3], at(x, 1.13, z, 0, .06, .06, .06, (i-1)*.3)));
  acc.into(g);
  km(g, 'a', 'Fern_1', .24, .36, .3, .03, .28, 2.1);
}
function buildMenhirs(g){
  const acc = new Acc(), r = rngFrom(88);
  acc.add(new THREE.CylinderGeometry(.44, .46, .03, 12), DM.dirt, at(0, .015, 0));
  [[-.22,-.2,.75],[.24,-.18,.62],[-.2,.24,.55],[.22,.22,.7]].forEach(([x,z,h],i) => acc.add(new THREE.BoxGeometry(.16, h, .12, 1, 2, 1), i%2 ? DM.basalt : DM.basaltD, at(x, .03 + h/2, z, r()*3, 1, 1, 1, (r()-.5)*.12, (r()-.5)*.12)));
  acc.add(new THREE.BoxGeometry(.52, .08, .14), DM.basalt, at(.01, .75, -.19, 0, 1, 1, 1, 0, .1));
  rock(acc, DM.ochre, 0, .05, 0, .09, .6, r);
  torch(acc, 0, .0, .3);
  acc.into(g);
}
function buildHut(g){
  const acc = new Acc(), r = rngFrom(64);
  acc.add(new THREE.CylinderGeometry(.42, .44, .03, 14), DM.dirt, at(0, .015, 0));
  const tent = new THREE.ConeGeometry(.36, .78, 9, 1, true); acc.add(tent, DM.hide, at(0, .42, 0));
  acc.add(new THREE.ConeGeometry(.366, .2, 9, 1, true), DM.hideD, at(0, .15, 0, 0, 1.03, 1, 1.03));
  // bone poles poking out the top + tusks by the door
  for (let i=0;i<5;i++){ const a = i/5*6.28; seg(acc, DM.bone, V3(Math.cos(a)*.04, .7, Math.sin(a)*.04), V3(Math.cos(a)*.35, 1, Math.sin(a)*.35), .28, .016, .012, 5); }
  const door = new THREE.Mesh(new THREE.CircleGeometry(.14, 10, 0, Math.PI), new THREE.MeshBasicMaterial({ color:0x3A2A20 }));
  door.position.set(.23, .03, .23); door.rotation.y = Math.PI/4; door.rotation.x = -.25; g.add(door);
  for (const s of [-1, 1]) { const p = V3(.32 + s*.14, .03, .32 - s*.14); seg(acc, DM.bone, p, V3(.3, 1, .3), .3, .03, .012, 6); }
  acc.into(g);
}
/* ── trees ── */
function buildTreeFern(g, s){
  const acc = new Acc(), r = rngFrom(s.x*9 + s.z);
  seg(acc, DM.woodD, V3(0, .02, 0), V3(.08, 1, .02), .7, .07, .05, 7);
  for (let i=0;i<5;i++) acc.add(new THREE.TorusGeometry(.065 - i*.003, .014, 4, 8).rotateX(Math.PI/2), DM.wood, at(.008*i*1.1, .12 + i*.13, 0));
  acc.into(g);
  const top = new THREE.Group(); top.position.set(.056, .72, .014); g.add(top);
  for (let i=0;i<3;i++) km(top, 'a', 'Fern_1', .36 - i*.06, .95 - i*.2, 0, -.06 + i*.03, 0, i*1.3 + (s.rot||0)*Math.PI/180);
  km(g, 'a', 'Fern_1', .2, .36, -.24, .03, .22, 1);
}
/* ── the VOLCANO (Gita): a basalt cone in a jungle skirt, glowing crater, lava rivulets, smoke (ambient) ── */
function buildVolcano(g){
  const acc = new Acc(), r = rngFrom(404);
  acc.add(new THREE.CylinderGeometry(.95, .97, .04, 28), DM.dirtD, at(0, .02, 0));
  const prof = [[0,.02],[.92,.02],[.86,.14],[.72,.34],[.56,.66],[.42,1.0],[.32,1.26],[.34,1.32],[.27,1.31],[.2,1.2]].map(([x,y]) => new THREE.Vector2(x, y));
  const cone = new THREE.LatheGeometry(prof, 11); { const a = cone.attributes.position; for (let i=0;i<a.count;i++){ const y = a.getY(i); if (y > .05 && y < 1.25) { const k = 1 + (r()-.5)*.12; a.setX(i, a.getX(i)*k); a.setZ(i, a.getZ(i)*k); } } }
  acc.add(cone, DM.basalt, at(0, 0, 0));
  // lighter ash band + dark lower band rocks
  for (let i=0;i<9;i++){ const a = i/9*6.28 + r()*.3; rock(acc, i%2 ? DM.basaltD : DM.ochre, Math.cos(a)*.8, .1, Math.sin(a)*.8, .1 + r()*.06, .7, r); }
  // crater lava + glowing rivulets down the camera-facing slope (two straight runs per stream, following the profile)
  acc.add(new THREE.CylinderGeometry(.26, .2, .04, 14), DM.lava, at(0, 1.26, 0)); acc.add(new THREE.CylinderGeometry(.13, .13, .045, 12), DM.lavaY, at(0, 1.265, 0));
  const legs = [[[.3, 1.27], [.56, .66]], [[.56, .66], [.72, .34]], [[.72, .34], [.87, .12]]];
  for (const [ang, n] of [[Math.PI/4, 3], [Math.PI/4 + .75, 2], [Math.PI/4 - .8, 2]]) legs.slice(0, n).forEach(([[r0, y0], [r1, y1]], i) => {
    const p0 = V3(Math.sin(ang)*(r0 + .03), y0, Math.cos(ang)*(r0 + .03)), p1 = V3(Math.sin(ang)*(r1 + .03), y1, Math.cos(ang)*(r1 + .03));
    const pm = p0.clone().lerp(p1, .5), w = (i%2 ? -1 : 1)*.05; pm.x += Math.cos(ang)*w; pm.z -= Math.sin(ang)*w;   // a kink: lava meanders
    for (const [q0, q1, k] of [[p0, pm, 0], [pm, p1, 1]]) { const d = q1.clone().sub(q0);
      seg(acc, i ? DM.lava : DM.lavaY, q0, d, d.length() + .02, .058 - (i*2+k)*.007, .052 - (i*2+k)*.007, 6); } });
  acc.into(g);
  // jungle skirt: palms and ferns around the foot
  km(g, DK, 'PalmTree_5', 1.0, .7, -.72, .03, .5, .4); km(g, DK, 'PalmTree_2', .8, .6, .58, .03, -.72, 2);
  [[-.8,-.1],[.2,.84],[.82,.24],[-.3,-.8],[.72,.7],[-.62,.78]].forEach(([x,z],i) => km(g, 'a', 'Fern_1', .26 + (i%3)*.05, .45, x, .03, z, i*1.7));
  g.userData.volcano = true;
}

/* smoke puffs above the crater (only while the volcano stands), + butterflies */
function ensureSmoke(){
  if (V.smoke || !V.pieces || !V.pieces.volcano) return;
  const p = V.pieces.volcano.position; V.smoke = [];
  for (let i=0;i<5;i++){ const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.12, 1), new THREE.MeshStandardMaterial({ color:0xE9E4E0, roughness:1, transparent:true, opacity:.8, depthWrite:false, flatShading:true }));
    m.userData = { ph:i/5, base:p }; world.add(m); V.smoke.push(m); V.life.push(m); }
  puff(2.1);
}
function puff(t){ (V.smoke || []).forEach(m => { const u = m.userData, k = (t*.12 + u.ph) % 1, b = u.base;
  m.position.set(b.x + Math.sin(k*4 + u.ph*9)*.08 + k*.25, b.y + 1.32 + k*1.1, b.z + Math.cos(k*3)*.05 - k*.1);
  m.scale.setScalar(.5 + k*1.6); m.material.opacity = .85*(1 - k)*Math.min(1, k*6); }); }

/* residents: the animated pack, big and friendly. h = height in tiles (apatosaurus includes its neck) */
const RES = [
  { id:'TRex', name:'T. rex', h:.95, at:[5.2,6.1], face:-.7 },
  { id:'Triceratops', name:'Triceratops', h:.72, at:[0.15,2.2], face:.5 },
  { id:'Apatosaurus', name:'Apatosaurus', h:.95, at:[0.55,3.6], face:.05 },
  { id:'Stegosaurus', name:'Stegosaurus', h:.66, at:[1.3,6.2], face:1.9 },
  { id:'Parasaurolophus', name:'Parasaurolophus', h:.82, at:[0.2,5.15], face:.6 },
  { id:'Velociraptor', name:'Velociraptor', h:.45, at:[0.35,6.3], face:1.3 }
].map(d => ({ ...d, file:'assets/dino/' + d.id + '.glb' }));

export default {
  id:'dino', name:'Dino valley', title:'Your valley',
  season:7, dates:'8–21 Dec', nextIn:9,
  kits:['a', DK],
  kitDefs:{ [DK]:{ file:'assets/dino/palms.glb', sway:true } },
  families:{
    water:   { label:'springs & lakes',     tag:'Water' },
    building:{ label:'caves & stones',      tag:'Building' },
    path:    { label:'trails & torches',    tag:'Path' },
    crop:    { label:'nests & ferns',       tag:'Nest' },
    tree:    { label:'palms & tree ferns',  tag:'Tree' },
    special: { label:'the volcano',         tag:'Special' }
  },
  slots:DINO, order:DINO_ORDER,
  ground:{ tile:{ top:['#6DB24A','#66A945'], side:'#5E9E3F', soilTop:'#7A5040', soilBot:'#3E2C28' }, tileMap:grassTileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M3 20 9.5 8.5h5L21 20z" fill="#7A6A62"/><path d="M9.5 8.5h5l-1 2.2h-3z" fill="#FF7A1F"/><path d="M11.6 10.7l-1.8 4 1.4-.2-.9 3" fill="none" stroke="#FF7A1F" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="5" r="2" fill="#CFC8C2"/><circle cx="14.6" cy="3.4" r="1.4" fill="#E3DDD8"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M20 118 52 56h24l32 62z"/><circle cx="64" cy="40" r="10"/><circle cx="78" cy="28" r="7"/><path d="M92 118c0-14 6-24 16-26 6-1 10 2 12 6l-4 2c-2-3-5-4-8-3 2 4 2 10 0 21z"/></g>',
  album:{ image:'assets/dino/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E4F1DA)' },
  css:'.phone[data-theme="dino"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#EEF6E4 58%,#D8EBC8 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'palm') km(g, DK, s.model, s.h*(S.grow==='c' ? 1 : .85), 1.05, 0, 0, 0, (s.rot||0)*Math.PI/180);
    else if (s.kind === 'conifer') { km(g, 'a', s.model, 1.45, 1.0, 0, 0, 0, (s.rot||0)*Math.PI/180); km(g, 'a', 'Fern_1', .2, .34, .3, .03, .28, 1); }
    else if (s.kind === 'treefern') buildTreeFern(g, s);
    else if (s.kind === 'stones') buildStones(g, s);
    else if (s.kind === 'nest') buildNest(g, s, stage);
    else if (s.kind === 'ferns') buildFerns(g, s, stage);
    else if (s.kind === 'spring') buildSpring(g);
    else if (s.kind === 'lake') buildLake(g, s);
    else if (s.kind === 'falls') buildFalls(g);
    else if (s.kind === 'cave') buildCave(g);
    else if (s.kind === 'arch') buildArch(g);
    else if (s.kind === 'dig') buildDig(g);
    else if (s.kind === 'nestrock') buildNestRock(g);
    else if (s.kind === 'menhirs') buildMenhirs(g);
    else if (s.kind === 'hut') buildHut(g);
    else if (s.kind === 'volcano') buildVolcano(g);
    else if (s.kind === 'log') {
      const acc = new Acc(), r = rngFrom(12);
      acc.add(new THREE.CylinderGeometry(.13, .15, .82, 9).rotateZ(Math.PI/2), DM.wood, at(0, .15, 0, .6));
      acc.add(new THREE.CylinderGeometry(.1, .1, .01, 9).rotateZ(Math.PI/2), DM.hide, at(Math.cos(.6)*.415, .15, -Math.sin(.6)*.415, .6));
      blob(acc, DM.moss, V3(-.1, .26, .06), .1, .4, 0, r); blob(acc, DM.mossL, V3(.12, .25, -.06), .08, .4, 0, r);
      seg(acc, DM.woodD, V3(-.2, .2, .12), V3(-.3, 1, .6), .18, .03, .015, 5);
      acc.into(g); km(g, 'a', 'Mushroom_Laetiporus', .1, .16, .1, .2, .14, 0); km(g, 'a', 'Fern_1', .2, .3, -.3, .03, -.28, 2);
    } else if (s.kind === 'boulders') {
      const acc = new Acc(), r = rngFrom(33);
      acc.add(new THREE.CylinderGeometry(.44, .46, .03, 10), DM.dirt, at(0, .015, 0));
      rock(acc, DM.basalt, -.12, .16, -.08, .2, .8, r, .3); rock(acc, DM.basaltD, .2, .12, .14, .14, .85, r, 1); rock(acc, DM.ochre, -.22, .08, .26, .09, .8, r, 2);
      blob(acc, DM.moss, V3(-.12, .31, -.08), .12, .35, 0, r);
      acc.into(g); km(g, 'a', 'Fern_1', .2, .3, .28, .03, -.26, .4);
    } else if (s.kind === 'fence') {
      const acc = new Acc(), r = rngFrom(s.x*7 + s.z*13 + 1);
      for (let i=0;i<s.len;i++){ const o = i - (s.len-1)/2;
        const P = (u, y, v) => s.edge === 'w' ? V3(-.45 + v, y, o + u) : V3(o + u, y, .45 + v);   // u along the run, v across
        if (s.fence === 'log') {
          for (const u of [-.42, 0, .42]) { const p = P(u, .03, 0); seg(acc, DM.woodD, p, V3(0,1,0), .34, .045, .04, 7); acc.add(new THREE.ConeGeometry(.045, .06, 7), DM.wood, at(p.x, .4, p.z)); }
          for (const y of [.14, .27]) { const a = P(-.5, y, .04), d = s.edge === 'w' ? V3(0,0,1) : V3(1,0,0); seg(acc, DM.wood, a, d, 1, .026, .026, 6); }
        } else if (s.fence === 'bone') {
          for (let k=0;k<5;k++){ const u = -.4 + k*.2, p = P(u, .03, 0), lean = s.edge === 'w' ? V3(.25, 1, 0) : V3(0, 1, .25);
            seg(acc, DM.bone, p, lean, .3 + (k%2)*.08, .03, .01, 6); acc.add(new THREE.SphereGeometry(.04, 7, 5), DM.boneD, at(p.x, .05, p.z)); }
          const a = P(-.5, .12, .02), d = s.edge === 'w' ? V3(0,0,1) : V3(1,0,0); seg(acc, DM.hideD, a, d, 1, .012, .012, 4);
        } else {
          for (let k=0;k<5;k++){ const p = P(-.4 + k*.2, .1, 0); rock(acc, k%2 ? DM.basalt : DM.basaltD, p.x, p.y, p.z, .1 + r()*.03, .9, r, r()*3); }
          blob(acc, DM.moss, P(-.1, .2, 0), .09, .35, 0, r);
        }
      }
      acc.into(g);
      const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
    }
  },
  scaleOf: () => 1,
  contact: s => !['stones', 'fence', 'nest', 'ferns', 'lake', 'spring'].includes(s.kind),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || !!s.torch || s.kind === 'spring',
  decor(slots){ meadowDecor(slots, { tuft: r => { const q = r(); return q < .45 ? ['Grass_Common_Short', 0] : q < .8 ? ['Grass_Wispy_Short', 0] : q < .93 ? ['Fern_1', .12] : ['Clover_2', 0]; }, flowers:false }); },
  ambient(){ addButterflies(); V.smoke = null; ensureSmoke(); },
  tick(t){ flyButterflies(t); ensureSmoke(); puff(t); },

  residents:RES,
  async preload(){
    const all = await Promise.all(RES.map(d => loadAnimal(d)));
    RES.forEach((d, i) => { ANIMCACHE['__d_' + d.id] = all[i];
      /* the pack's rigs sit under a 300× armature + 100× mesh node: a fresh clone's lazy skinned bbox reads stale bone matrices,
         so the engine sized them ~1000× too small. Bake the true skinned bbox once; clones copy it (SkinnedMesh.copy). */
      const sc = all[i].scene; sc.updateMatrixWorld(true);
      sc.traverse(o => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); } }); });
  },
  residentThumb(d, thumbFor){
    const gltf = ANIMCACHE['__d_' + d.id]; if (!gltf) return '';
    return thumbFor('anim:dino:' + d.id, () => { const o = SkeletonUtils.clone(gltf.scene); const mx = new THREE.AnimationMixer(o);
      const c = gltf.animations.find(x => x.name === 'Idle'); if (c) { mx.clipAction(c).play(); mx.update(.4); } o.rotation.y = -.35 + Math.PI/2; return o; }, 168);
  }
};
