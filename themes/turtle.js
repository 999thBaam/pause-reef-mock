/* TURTLE ISLE (?theme=turtle) — the whole 7×7 land rides on the back of a great sea turtle, swimming in a round patch of sea.
   Same ring blueprint, camera and light rig as the farm (the hero-right blueprint: every farm slot id maps to an island piece,
   so order, rings, pick-3, growth and expansion work unchanged). The engine's soil block is swapped (in env) for the turtle:
   a domed, scute-patterned shell that morphs from the square land into an oval rim, a head poking out at the right-hand corner
   (the Gita lighthouse stands on it), four paddling flippers, a tail, and a turquoise sea with foam at the waterline.
   Models: palms / huts / boats / rocks = Kenney Pirate Kit, cottages / tower / lanterns = KayKit Medieval Hexagon (village kit),
   shade trees / flowers / grass = Quaternius Stylized Nature MegaKit (kit a), fish + manta = Quaternius Animated Fish (reef).
   All CC0 and already in assets/. The turtle, the conch house, the lighthouse, the shell gardens, pools, paths, fences and the
   baby turtles are procedural three.js geometry, merged per material so every piece stays pre-renderable. */
import * as THREE from 'three';
import { rngFrom, TEX, addSway, world, fx } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre, footprint } from '../engine/grid.js';
import { KITCACHE, ANIMCACHE, loader, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, seg, blob, _up, _q, _m, _s } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { meadowDecor, addButterflies, flyButterflies, tintedFlower } from '../engine/life.js';
import { FARM_SLOTS as FARM, FARM_ORDER } from './farm.js';
import { makeFish } from './reef.js';

const PM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.8, metalness:0, flatShading:true, ...o });
const SM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.75, metalness:0, ...o });
const MAT = {
  sand:PM(0xF1DDB0, { roughness:1 }), bed:new THREE.MeshStandardMaterial({ color:0xC9A478, roughness:1, map:TEX.furrow }),
  rock:PM(0xA69C94), rockD:PM(0x857B78), stone:PM(0xCFC6B8), wood:PM(0x8A5A36), woodL:PM(0xB98552), drift:PM(0xC8B79E), rope:PM(0xD9C08E),
  pool:new THREE.MeshStandardMaterial({ color:0x3ED3D2, roughness:.15, metalness:0, emissive:0x0B6670, emissiveIntensity:.35 }),
  foam:PM(0xFFFFFF, { roughness:.6 }), pad:PM(0x5FAE4A), lotus:PM(0xF7A8C4), lotusC:PM(0xF6D55A),
  shellA:PM(0xFFE6D2), shellB:PM(0xF7B7A3), shellC:PM(0xF9D48B), star:PM(0xF2784B),
  conch:SM(0xF6E2CC), conchR:SM(0xE9C3A4), conchLip:SM(0xF49A9A, { side:THREE.DoubleSide }), conchIn:SM(0xFFC2B8, { side:THREE.DoubleSide }),
  scallopA:PM(0xF7B08A, { side:THREE.DoubleSide }), scallopB:PM(0xF4D27A, { side:THREE.DoubleSide }), scallopC:PM(0xE7A6D8, { side:THREE.DoubleSide }),
  door:PM(0x7A4A2C), win:new THREE.MeshStandardMaterial({ color:0xFFE3A0, emissive:0xFFB24A, emissiveIntensity:.9, roughness:.4 }),
  white:SM(0xFFFBF4), red:SM(0xE4574A), redD:SM(0xB83F36), iron:PM(0x3F4A52),
  glass:new THREE.MeshStandardMaterial({ color:0xFFF3C4, emissive:0xFFC24A, emissiveIntensity:1.3, roughness:.3 }),
  pearl:new THREE.MeshStandardMaterial({ color:0xFFFBF4, emissive:0xEDE3FF, emissiveIntensity:.5, roughness:.22, metalness:.05 }),
  // the turtle
  skin:SM(0x6FA88A), skinD:SM(0x5A9277), spot:SM(0xD3E6A4), belly:SM(0xF1E3B0), eye:SM(0x23262B), eyeW:SM(0xFFFFFF), cheek:SM(0xF4A7A0),
  // baby turtles
  babyShell:SM(0x7E9A4A), babySkin:SM(0x9CCB8A)
};
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = PM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }

/* model helpers: fitted to h (height) and w (width) in tiles */
function km(kit, g, name, h, w, x=0, y=0, z=0, rot=0){ const tpl = KITCACHE[kit] && KITCACHE[kit][name]; if (!tpl) return null;
  const k = fitScale(tpl, h, w), o = addModel(g, name, k, x, y, z, rot, kit); if (o) o.userData.top = y + tpl.size.y*k; return o; }
const kp = (...a) => km('pirate', ...a), vm = (...a) => km('village', ...a), ka = (...a) => km('a', ...a);

/* ── little props ── */
function shells(acc, n, rng, rad=.34, y=.035, cx=0, cz=0){
  for (let i=0;i<n;i++){ const a = rng()*6.28, d = rad*(.35 + rng()*.65), p = new THREE.Vector3(cx + Math.cos(a)*d, y, cz + Math.sin(a)*d);
    acc.add(new THREE.ConeGeometry(.05, .028, 8, 1).translate(0, .014, 0), [MAT.shellA, MAT.shellB, MAT.shellC][i%3], _m.compose(p, _q.setFromEuler(new THREE.Euler(0, rng()*6, 0)), new THREE.Vector3(1, .8, .78))); }
}
const STAR_GEO = (() => { const sh = new THREE.Shape(); for (let i=0;i<10;i++){ const a = i/10*Math.PI*2 - Math.PI/2, r = i%2 ? .026 : .075; i ? sh.lineTo(Math.cos(a)*r, Math.sin(a)*r) : sh.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
  return new THREE.ExtrudeGeometry(sh, { depth:.016, bevelEnabled:true, bevelSize:.008, bevelThickness:.008, bevelSegments:1 }).rotateX(-Math.PI/2); })();
function starfish(acc, p, rot){ acc.add(STAR_GEO, MAT.star, _m.compose(p, _q.setFromEuler(new THREE.Euler(0, rot, 0)), _s)); }
function glowSprite(parent, pos, scale, color, opacity=.8, map=TEX.glow){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; s.userData.glow = true; parent.add(s); return s; }
function rockPool(acc, rng, r, cx=0, cz=0, n=12){
  acc.add(new THREE.CylinderGeometry(r, r, .02, 28).translate(cx, .045, cz), MAT.pool);
  for (let i=0;i<n;i++){ const a = i/n*6.28 + rng()*.2; blob(acc, rng()<.6 ? MAT.rock : MAT.rockD, new THREE.Vector3(cx + Math.cos(a)*r*1.02, .05, cz + Math.sin(a)*r*1.02), .06 + rng()*.035, .7, 0, rng); }
}

/* a spiral conch: a lathe body with a spiral groove, knobbed shoulder and a flared pink lip. h = height, origin at its base */
function conchGeo(h){
  const pts = [[0, 0], [.2, .02], [.34, .12], [.4, .3], [.36, .48], [.26, .62], [.17, .74], [.09, .86], [.035, .95], [0, 1]].map(([r, y]) => new THREE.Vector2(r*h*.75, y*h));
  const g = new THREE.LatheGeometry(pts, 26), p = g.attributes.position, v = new THREE.Vector3();
  for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), y = v.y/h, k = 1 + .09*Math.sin(a + y*26) * Math.min(1, y*3);
    p.setXYZ(i, v.x*k, v.y, v.z*k); }
  g.computeVertexNormals(); return g;
}
function conch(acc, p, h, rot, tilt=0, mats=[MAT.conch, MAT.conchLip]){
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, rot, 0, 'YXZ'));
  acc.add(conchGeo(h), mats[0], _m.compose(p, q, _s));
  const lip = new THREE.SphereGeometry(h*.32, 12, 8, 0, Math.PI*2, 0, Math.PI*.55).rotateX(Math.PI/2).scale(.7, 1.25, .6).translate(0, h*.4, h*.26);
  acc.add(lip, mats[1], _m.compose(p, q, _s));
  for (let i=0;i<6;i++){ const a = i/6*6.28 + .5, kn = new THREE.ConeGeometry(h*.045, h*.13, 5).rotateZ(-Math.PI/2).translate(h*.33, h*.5, 0).rotateY(a);
    acc.add(kn, mats[0], _m.compose(p, q, _s)); }
}
/* a scallop fan stood on its hinge */
const SCALLOP = (() => { const g = new THREE.CircleGeometry(1, 14, Math.PI*.12, Math.PI*.76), p = g.attributes.position;
  for (let i=0;i<p.count;i++){ const x = p.getX(i), y = p.getY(i), a = Math.atan2(y, x), r = Math.hypot(x, y); p.setZ(i, Math.sin(a*22)*.05*r - r*r*.18); }
  g.computeVertexNormals(); return g; })();
function scallop(acc, p, s, rot, mat){ acc.add(SCALLOP, mat, _m.compose(p, _q.setFromEuler(new THREE.Euler(-.25, rot, 0, 'YXZ')), new THREE.Vector3(s, s, s))); }

/* ── shell gardens (Sudoku / Math): conchs, scallops or blossoms rising out of a sandy bed, a stage per later piece ── */
const BED = { Corn:'conch', Carrot:'scallop', Lettuce:'bloom', Beet:'conch' };
const BED_NAME = { conch:'Conch garden', scallop:'Scallop garden', bloom:'Blossom garden' };
const BLOOM = [0xF59BB8, 0xFFB347, 0xF4C84A, 0xE77BD0];
function fillBed(host, s, stage){
  host.clear();
  const r = rngFrom(s.x*31 + s.z*7 + 5), kind = BED[s.crop], acc = new Acc(), st = Math.min(stage, 5);
  const spots = [[-.2,-.2],[.2,-.18],[-.18,.2],[.21,.21],[0,0]], n = st >= 3 ? 5 : 4;
  for (let i=0;i<n;i++){ const [x,z] = spots[i], p = new THREE.Vector3(x + (r()-.5)*.03, .06, z + (r()-.5)*.03);
    if (kind === 'conch') { const h = .07 + st*.045; conch(acc, p, h*(i === 4 ? 1.15 : 1), r()*6.28, st <= 1 ? 1.2 : .25 + r()*.25,
      i%2 ? [MAT.conchR, MAT.conchIn] : [MAT.conch, MAT.conchLip]); }
    else if (kind === 'scallop') { const sc = .05 + st*.03; scallop(acc, p, sc, r()*6.28, [MAT.scallopA, MAT.scallopB, MAT.scallopC][i%3]); if (st >= 3) scallop(acc, p.clone().add(new THREE.Vector3(.05, 0, .04)), sc*.7, r()*6.28, [MAT.scallopB, MAT.scallopC, MAT.scallopA][i%3]); }
    else { if (st <= 2) ka(host, st === 1 ? 'Clover_1' : 'Plant_1', .06 + st*.05, .22, p.x, p.y, p.z, r()*6.28);
      else tintedFlower(host, i%2 ? 'Flower_3_Group' : 'Flower_4_Group', .26 + (st-3)*.08, p.x, p.y, p.z, r()*6.28, BLOOM[(i + s.x) % BLOOM.length]); }
  }
  if (st >= 2) for (let i=0;i<10;i++){ const a = i/10*6.28, h = .05 + st*.02, pg = new THREE.PlaneGeometry(.02, h, 1, 2).translate(0, h/2, 0);   // sea-grass fringe
    acc.add(pg, swayMat([0x7DBB4A, 0x5FA24A][i%2], .3, .12), _m.compose(new THREE.Vector3(Math.cos(a)*.4, .06, Math.sin(a)*.4), _q.setFromEuler(new THREE.Euler(0, r()*6, 0)), _s)); }
  if (st >= 5) { acc.add(new THREE.SphereGeometry(.05, 14, 10), MAT.pearl, _m.makeTranslation(.02, .1, .03)); glowSprite(host, new THREE.Vector3(.02, .12, .03), .3, 0xEDE3FF, .7); }
  acc.m.size && acc.into(host); host.userData.stage = stage;
}

/* ── the turtle's head position for a land of side L (the Gita lighthouse stands on it at 7×7) ── */
const U_DIR = new THREE.Vector3(1, 0, -1).normalize(), V_DIR = new THREE.Vector3(1, 0, 1).normalize();   // head → screen right; v → towards the viewer
const SE = 4;                                                          // shell rim = a superellipse |x|^4 + |z|^4 = a^4 (rounded square)
const superR = (a, ang) => a / Math.pow(Math.pow(Math.abs(Math.cos(ang)), SE) + Math.pow(Math.abs(Math.sin(ang)), SE), 1/SE);
function turtleDims(L){ const s = .45 + .55*(L/7), a = L/2 + .55 + .42*s, D = .3 + .02*L;
  const y0 = -.085, rimY = y0 - D, waterY = rimY + .04, r45 = superR(a, Math.PI/4), headR = .28 + .32*s;
  return { a, r45, s, D, y0, rimY, waterY, headR, head:U_DIR.clone().multiplyScalar(r45 + headR*.72).setY(rimY + .3*s) }; }

/* ── the hero (Gita): a striped lighthouse on the turtle's head, a keeper's cottage + plank bridge on the land ── */
function lighthouse(g, x, y, z, H){
  const a = new Acc(), stripes = 5, r0 = .24*H/1.7, r1 = .16*H/1.7, bodyH = H*.66;
  for (let i=0;i<stripes;i++){ const t0 = i/stripes, t1 = (i+1)/stripes;
    a.add(new THREE.CylinderGeometry(r0 + (r1-r0)*t1, r0 + (r1-r0)*t0, bodyH/stripes, 20, 1).translate(x, y + bodyH*(t0 + t1)/2, z), i%2 ? MAT.red : MAT.white); }
  const gy = y + bodyH;
  a.add(new THREE.CylinderGeometry(r1*1.45, r1*1.25, .05, 20).translate(x, gy + .025, z), MAT.redD);
  for (let i=0;i<14;i++){ const ang = i/14*6.28; seg(a, MAT.iron, new THREE.Vector3(x + Math.cos(ang)*r1*1.38, gy + .05, z + Math.sin(ang)*r1*1.38), _up, .09, .008, .008, 4); }
  a.add(new THREE.TorusGeometry(r1*1.38, .01, 4, 20).rotateX(Math.PI/2).translate(x, gy + .14, z), MAT.iron);
  a.add(new THREE.CylinderGeometry(r1*.85, r1*.85, H*.13, 14).translate(x, gy + .05 + H*.065, z), MAT.glass);
  for (let i=0;i<6;i++){ const ang = i/6*6.28; seg(a, MAT.redD, new THREE.Vector3(x + Math.cos(ang)*r1*.87, gy + .05, z + Math.sin(ang)*r1*.87), _up, H*.13, .009, .009, 4); }
  const cy = gy + .05 + H*.13;
  a.add(new THREE.SphereGeometry(r1*1.02, 16, 8, 0, Math.PI*2, 0, Math.PI/2).translate(x, cy, z), MAT.red);
  seg(a, MAT.iron, new THREE.Vector3(x, cy + r1*.95, z), _up, .08, .012, .006, 5); blob(a, MAT.iron, new THREE.Vector3(x, cy + r1*.95 + .085, z), .018);
  a.add(new THREE.BoxGeometry(.09, .14, .03).translate(x, y + .08, z + r0*.96), MAT.door, _m.makeRotationY(0));
  for (const t of [.35, .62]) a.add(new THREE.CircleGeometry(.03, 10).translate(0, 0, 0), MAT.win, _m.compose(new THREE.Vector3(x + (r0 + (r1-r0)*t)*.72, y + bodyH*t, z + (r0 + (r1-r0)*t)*.72), _q.setFromEuler(new THREE.Euler(0, Math.PI/4, 0)), _s));
  a.into(g);
  const lampY = gy + .05 + H*.065;
  glowSprite(g, new THREE.Vector3(x, lampY, z), .75*H/1.7, 0xFFE0A0, .85);
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(.34*H/1.7, 1.5*H/1.7).translate(0, .75*H/1.7, 0),
    new THREE.MeshBasicMaterial({ map:TEX.beam, color:0xFFF1C8, transparent:true, opacity:.45, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }));
  beam.rotation.set(0, Math.PI/4, -Math.PI/2); beam.position.set(x, lampY, z); beam.renderOrder = 9; beam.userData.glow = true; beam.userData.ghostHide = true; g.add(beam);
  return lampY;
}
function buildLighthouse(g, s, opt){
  const thumb = opt && opt.stage === 3;          // pick-card thumbnail: keep it compact (lighthouse on its rock, no head offset)
  const a = new Acc(), r = rngFrom(99);
  // keeper's cottage + garden on the 2×2 footprint
  kp(g, 'structure-roof', .82, .8, -.45, 0, .38, .6);
  kp(g, 'rocks-sand-a', .3, .6, .5, 0, .5, 1.2);
  shells(a, 4, r, .9, .03); starfish(a, new THREE.Vector3(-.1, .045, -.2), .6);
  tintedFlower(g, 'Flower_3_Group', .3, -.62, .03, -.5, 1, 0xF59BB8); tintedFlower(g, 'Flower_4_Group', .28, -.1, .03, .75, 2, 0xF4C84A);
  let lx = .3, ly = 0, lz = -.3;
  if (!thumb) {
    const T = turtleDims(7), f = footprint(s), hx = T.head.x - f.cx, hz = T.head.z - f.cz;
    lx = hx; lz = hz; ly = T.head.y + T.headR*.86 - TILE_TOP;
    // a little grassy cap on the head for it to stand on, and a plank bridge down from the land
    a.add(new THREE.CylinderGeometry(.3, .34, .06, 18).translate(lx, ly - .01, lz), MAT.pad);
    const b0 = new THREE.Vector3(.6, .02, -.6), b1 = new THREE.Vector3(lx - .2, ly + .02, lz + .2), d = b1.clone().sub(b0), len = d.length();
    for (let i=0;i<7;i++){ const p = b0.clone().addScaledVector(d, (i + .5)/7);
      a.add(new THREE.BoxGeometry(.3, .025, len/7*.8), i%2 ? MAT.wood : MAT.woodL, _m.compose(p, _q.setFromUnitVectors(new THREE.Vector3(0,0,1), d.clone().normalize()), _s)); }
  } else { blob(a, MAT.rock, new THREE.Vector3(lx, .02, lz), .38, .35, 0, r); ly = .08; }
  a.into(g);
  lighthouse(g, lx, ly, lz, 1.7);
}

/* ── the conch house (ring-1 hero building): a giant conch with a round door, glowing windows and a garden ── */
function buildConchHouse(g){
  const a = new Acc(), r = rngFrom(7), H = 1.55;
  const body = conchGeo(H); a.add(body, MAT.conch, _m.compose(new THREE.Vector3(-.05, 0, -.1), _q.setFromEuler(new THREE.Euler(0, .4, 0)), _s));
  for (let i=0;i<7;i++){ const ang = i/7*6.28, kn = new THREE.ConeGeometry(.05, .16, 5).rotateZ(-Math.PI/2).translate(H*.75*.38, H*.42, 0).rotateY(ang);
    a.add(kn, MAT.conchR, _m.makeTranslation(-.05, 0, -.1)); }
  // flared pink lip around the doorway, facing the viewer
  const lip = new THREE.SphereGeometry(.42, 16, 10, 0, Math.PI*2, 0, Math.PI*.5).rotateX(Math.PI/2).scale(.95, 1.25, .5);
  a.add(lip, MAT.conchLip, _m.compose(new THREE.Vector3(.2, .38, .22), _q.setFromEuler(new THREE.Euler(0, Math.PI/4, 0)), _s));
  // door + windows
  const doorG = new THREE.CircleGeometry(.14, 16, 0, Math.PI).translate(0, .0, 0);
  a.add(new THREE.PlaneGeometry(.28, .16).translate(0, .08, 0), MAT.door, _m.compose(new THREE.Vector3(.37, .02, .39), _q.setFromEuler(new THREE.Euler(0, Math.PI/4, 0)), _s));
  a.add(doorG, MAT.door, _m.compose(new THREE.Vector3(.37, .18, .39), _q.setFromEuler(new THREE.Euler(0, Math.PI/4, 0)), _s));
  for (const [x,y,z,rr] of [[.44,.72,-.14,.075],[-.2,.95,.36,.06],[.28,1.02,.02,.05]]) {
    a.add(new THREE.CircleGeometry(rr, 12), MAT.win, _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(new THREE.Euler(0, Math.atan2(x + .05, z + .1), 0)), _s));
    a.add(new THREE.TorusGeometry(rr, .014, 4, 14), MAT.conchR, _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(new THREE.Euler(0, Math.atan2(x + .05, z + .1), 0)), _s)); }
  // stepping stones to the door, shells, a lantern
  for (let i=0;i<3;i++) a.add(new THREE.CylinderGeometry(.09, .1, .025, 9), MAT.stone, _m.makeTranslation(.52 + i*.16, .015, .54 + i*.16));
  shells(a, 5, r, .9, .03); starfish(a, new THREE.Vector3(-.6, .045, .65), .3);
  a.into(g);
  vm(g, 'lantern', .45, .16, .74, 0, .2, 0);
  tintedFlower(g, 'Flower_3_Group', .3, -.7, .03, .3, 0, 0xF59BB8); tintedFlower(g, 'Flower_4_Group', .3, .15, .03, .78, 1, 0xF4C84A);
  ka(g, 'Bush_Common_Flowers', .34, .5, -.68, 0, -.6, 1);
}

/* ── named pieces ── */
const FALL_TEX = (() => { const c = document.createElement('canvas'); c.width = 32; c.height = 128; const g = c.getContext('2d'), r = rngFrom(8);
  g.fillStyle = '#8FE6EA'; g.fillRect(0,0,32,128);
  for (let i=0;i<22;i++){ g.fillStyle = 'rgba(255,255,255,'+(.35 + r()*.5)+')'; g.fillRect(r()*30, r()*128, 1.5 + r()*2, 10 + r()*24); }
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
const FALL_MAT = new THREE.MeshBasicMaterial({ map:FALL_TEX, transparent:true, opacity:.88, side:THREE.DoubleSide, depthWrite:false });
const B = {
  conchhouse: buildConchHouse,
  lighthouse: buildLighthouse,
  tidepool(g, s){ const a = new Acc(), r = rngFrom(s.x*5 + s.z);
    rockPool(a, r, .3, 0, 0, 12); starfish(a, new THREE.Vector3(.08, .058, -.04), 1.1); blob(a, MAT.rockD, new THREE.Vector3(-.1, .05, .08), .06, .6, 0, r);
    conch(a, new THREE.Vector3(.3, .02, .3), .14, 2, .9); shells(a, 3, r, .44, .03); a.into(g); },
  falls(g){ const a = new Acc(), r = rngFrom(33);
    const rk = kp(g, 'rocks-c', .95, .8, -.12, 0, -.12, .3); const H = rk ? rk.userData.top : .9;
    kp(g, 'grass-plant', .22, .25, -.28, H*.82, -.2, 0);
    rockPool(a, r, .22, .18, .18, 10); a.into(g);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(.2, H*.78, 1, 6).translate(0, H*.39 + .04, 0), FALL_MAT);
    fall.position.set(.08, 0, .08); fall.rotation.y = Math.PI/4; fall.renderOrder = 2; fall.userData.ghostHide = true; g.add(fall);
    const foam = new Acc(); for (let i=0;i<6;i++){ const aa = i/6*6.28; blob(foam, MAT.foam, new THREE.Vector3(.14 + Math.cos(aa)*.07, .06, .14 + Math.sin(aa)*.07), .035, .5); } foam.into(g); },
  lily(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z*3);
    rockPool(a, r, .34, 0, 0, 14);
    for (let i=0;i<5;i++){ const ang = i*1.3 + r(), d = .1 + r()*.16; a.add(new THREE.CylinderGeometry(.07, .07, .012, 12, 1, false, .3, 5.7), MAT.pad, _m.makeTranslation(Math.cos(ang)*d, .06, Math.sin(ang)*d)); }
    for (const [x,z] of [[.08,-.05],[-.12,.1]]) { for (let i=0;i<6;i++){ const ang = i/6*6.28; a.add(new THREE.SphereGeometry(.03, 6, 4).scale(.6, .5, 1.3).translate(0, 0, .03), MAT.lotus,
      _m.compose(new THREE.Vector3(x, .08, z), _q.setFromEuler(new THREE.Euler(-.5, ang, 0, 'YXZ')), _s)); } blob(a, MAT.lotusC, new THREE.Vector3(x, .09, z), .018); }
    kp(g, 'grass-plant', .22, .24, .34, 0, -.3, 0); a.into(g); },
  lagoon(g, s){ const a = new Acc(), r = rngFrom(71);
    rockPool(a, r, .36, .02, .04, 16); starfish(a, new THREE.Vector3(-.12, .058, .1), .4);
    kp(g, 'palm-bend', .9, .7, -.32, 0, -.32, .7); shells(a, 2, r, .45, .03); a.into(g); },
  tower(g){ vm(g, 'building_tower_A_blue', 1.45, .82, 0, 0, 0, Math.PI*.25); },
  cottage(g, s){ vm(g, s.m, s.h || 1.0, .92, 0, 0, 0, (s.rot||0)*Math.PI/180); if (s.extra) kp(g, 'barrel', .24, .24, .34, 0, .32, 0); },
  hut(g){ kp(g, 'structure-roof', .95, .95, 0, 0, 0, .3); kp(g, 'boat-row-small', .2, .55, .12, 0, .36, .9); },
  shed(g){ kp(g, 'structure-roof', .85, .95, 0, 0, 0, -.4); kp(g, 'boat-row-large', .26, .8, 0, 0, .02, Math.PI/4); kp(g, 'barrel', .22, .22, .36, 0, -.32, 0); },
  palm(g, s){ kp(g, s.m, s.h, s.w || .95, 0, 0, 0, (s.rot||0)*Math.PI/180); const a = new Acc(), r = rngFrom(s.x*3 + s.z*11);
    for (let i=0;i<2;i++) a.add(new THREE.SphereGeometry(.04, 7, 5), MAT.wood, _m.makeTranslation(.16 + i*.07, .04, .14 - i*.05));
    shells(a, 1, r, .38); a.into(g); },
  palms(g){ kp(g, 'palm-straight', 1.05, .6, -.14, 0, -.12, 0); kp(g, 'palm-bend', .8, .6, .18, 0, .16, 2.2); kp(g, 'grass-plant', .2, .24, .28, 0, -.24, 0); },
  shade(g, s){ ka(g, s.m, s.h || 1.35, .95, 0, 0, 0, (s.rot||0)*Math.PI/180); ka(g, 'Bush_Common_Flowers', .22, .3, .3, 0, .28, 1); },
  path(g, s){ const slab = new THREE.Mesh(G.path, MAT.sand); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
    const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0;
    if (v === 0) { for (let i=0;i<8;i++){ const z = -.38 + i*.11; for (const x of [-.36, .36]) a.add(new THREE.ConeGeometry(.045, .03, 8).translate(0, .015, 0), [MAT.shellA, MAT.shellB, MAT.shellC][(i + (x > 0 ? 1 : 0))%3], _m.compose(new THREE.Vector3(x, .035, z), _q.setFromEuler(new THREE.Euler(0, r()*6, 0)), new THREE.Vector3(1, .8, .78))); }
      starfish(a, new THREE.Vector3(.1, .045, .12), r()*6); g.userData.ghostMode = 'marker'; }
    else if (v === 1) { for (let i=0;i<4;i++) a.add(new THREE.CylinderGeometry(.13, .14, .03, 9), MAT.stone, _m.makeTranslation((i%2 ? .08 : -.08) + (r()-.5)*.04, .045, -.33 + i*.22));
      shells(a, 3, r, .42, .04); g.userData.ghostMode = 'marker'; }
    else if (v === 2) { for (let i=0;i<5;i++){ a.add(new THREE.BoxGeometry(.86 - r()*.08, .03, .15), [MAT.drift, MAT.woodL][i%2], _m.compose(new THREE.Vector3((r()-.5)*.04, .05, -.36 + i*.18), _q.setFromEuler(new THREE.Euler(0, (r()-.5)*.1, 0)), _s)); }
      g.userData.ghostMode = 'marker'; }
    else if (v === 3) { vm(g, 'lantern', .5, .18, -.26, .035, -.24, 0); vm(g, 'lantern', .5, .18, .26, .035, .24, 0); shells(a, 3, r, .3, .04); starfish(a, new THREE.Vector3(.2, .045, -.2), 1); }
    else { kp(g, 'rocks-sand-a', .3, .6, -.08, .035, -.05, r()*6); conch(a, new THREE.Vector3(.26, .035, .26), .13, 1, .9); shells(a, 2, r, .42, .04); }
    shells(a, 2, r, .4, .04); a.into(g); },
  fence(g, s){ const a = new Acc(), n = s.len*2 + 1, L = s.len;
    const pos = i => { const t = -L/2 + i*(L/(n-1)); return s.edge === 'w' ? new THREE.Vector3(-.45, 0, t) : new THREE.Vector3(t, 0, .45); };
    for (let i=0;i<n;i++){ const p = pos(i); seg(a, MAT.drift, p, _up, .3 - (i%2)*.05, .032, .026, 6); blob(a, MAT.shellB, p.clone().setY(.31 - (i%2)*.05), .03, .6); }
    for (let i=0;i<n-1;i++){ const p0 = pos(i), p1 = pos(i+1);
      for (const hh of [.24, .14]) { const c = new THREE.CatmullRomCurve3([p0.clone().setY(hh), p0.clone().lerp(p1, .5).setY(hh - .05), p1.clone().setY(hh)]);
        a.add(new THREE.TubeGeometry(c, 8, .011, 5), MAT.rope); } }
    a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz); }
};

/* blueprint: every farm slot id → an isle piece (same cells, same rings, same order; hero in the right corner) */
const MAP = {
  bigbarn:{ name:'Conch house', b:'conchhouse' }, well:{ name:'Tide pool', b:'tidepool' },
  apple1:{ name:'Coconut palm', b:'palm', m:'palm-detailed-straight', h:1.4, rot:20 },
  silo:{ name:'Lookout tower', b:'tower' }, silohouse:{ name:'Blue cottage', b:'cottage', m:'building_home_A_blue', rot:200 },
  coop:{ name:"Fisher's hut", b:'hut' }, watertower:{ name:'Little waterfall', b:'falls' }, pump:{ name:'Lily pond', b:'lily' },
  apple2:{ name:'Leaning palm', b:'palm', m:'palm-detailed-bend', h:1.3, rot:140 }, berry1:{ name:'Palm cluster', b:'palms' },
  peepal:{ name:'Lighthouse', b:'lighthouse' }, smallbarn:{ name:'Green cottage', b:'cottage', m:'building_home_A_green', rot:180, extra:true },
  openbarn:{ name:'Boat shed', b:'shed' }, pond:{ name:'Lagoon', b:'lagoon' },
  orange1:{ name:'Shade tree', b:'shade', m:'CommonTree_1', h:1.4, rot:40 }, apple3:{ name:'Coconut palm', b:'palm', m:'palm-detailed-straight', h:1.4, rot:260 },
  berry2:{ name:'Palm cluster', b:'palms' }, orange2:{ name:'Shade tree', b:'shade', m:'CommonTree_2', h:1.35, rot:200 },
  apple4:{ name:'Leaning palm', b:'palm', m:'palm-detailed-bend', h:1.3, rot:60 }
};
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:4, path2_6:1, path3_6:3 };
const PATH_NAME = ['Shell path', 'Stepping stones', 'Driftwood walk', 'Lantern path', 'Rock garden'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') { const kind = BED[f.crop]; return { ...s, kind:'bed', crop:f.crop, name:BED_NAME[kind], stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'isle', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'isle', b:'fence', edge:f.edge, len:f.len, name:'Driftwood fence' };
  return { ...s, kind:'isle', ...MAP[f.id] };
});

/* ══════════ the turtle: shell dome (square land → oval rim), head, flippers, tail; the sea around it ══════════ */
const shellTex = (() => {
  const W = 1024, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const seam = '#3F3521';
  g.fillStyle = seam; g.fillRect(0, 0, W, H);
  const scute = (x, y, w, h, c0, c1) => { const gr = g.createRadialGradient(x + w/2, y + h*.55, 2, x + w/2, y + h*.55, Math.max(w, h)*.62);
    gr.addColorStop(0, c1); gr.addColorStop(1, c0); g.fillStyle = gr; g.beginPath(); g.roundRect(x + 4, y + 4, w - 8, h - 8, 14); g.fill();
    g.strokeStyle = 'rgba(255,240,200,.18)'; g.lineWidth = 2; for (let k=1;k<3;k++){ g.beginPath(); g.roundRect(x + 4 + k*9, y + 4 + k*7, w - 8 - k*18, h - 8 - k*14, 10); g.stroke(); } };
  const vC = H*.56, vM = H*.8;                    // costal scutes (t 0..0.7), marginal scutes (t 0.7..1), plastron below
  for (let i=0;i<16;i++) scute(i*W/16 + W/32, -30, W/16, vC + 30, i%2 ? '#6E5A2C' : '#76602F', i%2 ? '#C29A4E' : '#CDA658');
  scute(-W/32, -30, W/16, vC + 30, '#76602F', '#CDA658');
  for (let i=0;i<24;i++) scute(i*W/24, vC - 4, W/24, vM - vC + 8, '#5F6A34', '#A7AE5C');
  g.fillStyle = '#EFE0B0'; g.fillRect(0, vM + 2, W, H - vM);
  g.fillStyle = 'rgba(0,0,0,.08)'; for (let i=0;i<16;i++) g.fillRect(i*W/16, vM + 2, 3, H - vM);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping; return t; })();
const SHELL_MAT = new THREE.MeshStandardMaterial({ map:shellTex, roughness:.62, metalness:0 });
const TOP_MAT = new THREE.MeshStandardMaterial({ color:0x6E8F45, roughness:1 });
function shellGeometry(L, T){
  const M = 144, h0 = L/2 + .02, th = -Math.PI/4;
  const rings = [];                                // [t param 0..1 on the dome | extra lip/plastron rings], each: (theta) => [r, y, v]
  const N = 16;
  const rTop = a => h0 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
  const rRim = a => superR(T.a, a);
  for (let i=0;i<=N;i++){ const t = i/N; rings.push(a => [rTop(a) + (rRim(a) - rTop(a))*Math.pow(t, .7), T.y0 - T.D*Math.pow(t, 2.2), t*.8]); }
  rings.push(a => [rRim(a) + .05, T.rimY - .06, .81], a => [rRim(a) - .02, T.rimY - .14, .86], a => [rRim(a)*.72, T.rimY - .22, .94], a => [0, T.rimY - .25, 1]);
  const pos = [], uv = [], idx = [];
  rings.forEach((fn, j) => { for (let i=0;i<=M;i++){ const a = -Math.PI + i/M*Math.PI*2, [r, y, v] = fn(a);
    pos.push(Math.cos(a)*r, y, Math.sin(a)*r); uv.push(i/M, 1 - v); } });
  for (let j=0;j<rings.length-1;j++) for (let i=0;i<M;i++){ const a = j*(M+1) + i, b = a + M + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
/* the sea: a round patch of turquoise water, foam at the turtle's waterline, ripples, and a wake once it swims */
const SEA = { uA:{ value:5 }, uB:{ value:5 }, uR:{ value:6 }, uT:{ value:0 }, uDim:{ value:1 }, uSwim:{ value:0 } };
const seaMat = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, uniforms:SEA,
  vertexShader:'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader:`uniform float uA; uniform float uB; uniform float uR; uniform float uT; uniform float uDim; uniform float uSwim; varying vec2 vP;
    void main(){
      vec2 uv = vec2(dot(vP, vec2(.70710678, -.70710678)), dot(vP, vec2(.70710678, .70710678)));   // u = head direction, v = sideways
      vec2 ap = abs(vP) / uA; float q = pow(pow(ap.x, 4.) + pow(ap.y, 4.), .25);   // 1 at the shell rim (superellipse)
      float d = (q - 1.) * uA;                              // ~distance from the rim (tiles)
      float rr = length(vP) / uR;
      if (rr > 1.) discard;
      vec3 shallow = vec3(.36,.84,.82), deep = vec3(.16,.58,.80);
      vec3 col = mix(shallow, deep, smoothstep(0., 1.1, d));
      float foam = smoothstep(.1, .0, d) + .55*smoothstep(.04, 0., abs(d - .2 - .03*sin(uT*1.3 + atan(uv.y, uv.x)*5.)));
      float ripple = .5 + .5*sin(d*16. - uT*1.5 + sin(atan(uv.y, uv.x)*3.)*1.3);
      col = mix(col, vec3(1.), clamp(foam, 0., 1.)*.85 + ripple*.06*(1. - smoothstep(0., 1.2, d)));
      // wake: a V of foam trailing behind the tail while it swims
      float bu = -uv.x - uB*.95;
      if (bu > 0.) { float w = abs(abs(uv.y) - bu*.5 - .15); float wk = smoothstep(.07, 0., w) * smoothstep(2.2, .2, bu) * (.6 + .4*sin(bu*9. - uT*6.));
        col = mix(col, vec3(1.), wk*uSwim*.8); }
      float sp = step(.985, fract(sin(dot(floor(vP*9.), vec2(12.9898, 78.233)))*43758.5453)) * (.5 + .5*sin(uT*3. + vP.x*7.));
      col = mix(col, vec3(1.), sp*.35*(1. - rr));
      float a = (1. - smoothstep(.8, 1., rr)) * .93;
      gl_FragColor = vec4(col*uDim, a*mix(.8, 1., uDim)); }` });

function buildTurtle(L){
  const T = turtleDims(L), grp = new THREE.Group(), s = T.s;
  // the shell dome + a thin soil plate right under the tiles (fills the tile gaps)
  const shell = new THREE.Mesh(shellGeometry(L, T), SHELL_MAT); shell.castShadow = shell.receiveShadow = true; grp.add(shell);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(L + .02, .06, L + .02), TOP_MAT); plate.position.y = -.07; plate.receiveShadow = true; grp.add(plate);
  // head + neck, facing +u (screen right)
  const head = new THREE.Group(); head.position.copy(T.head); head.rotation.y = Math.PI/4; grp.add(head);   // local +x = U_DIR
  const a = new Acc(), R = T.headR;
  a.add(new THREE.CylinderGeometry(R*.62, R*.75, R*1.5, 14).rotateZ(Math.PI/2 - .25).translate(-R*.9, -R*.28, 0), MAT.skin);
  a.add(new THREE.SphereGeometry(R, 20, 14).scale(1.2, .92, 1), MAT.skin);
  for (const [x,y,z,r] of [[.2,.55,.5,.16],[-.25,.62,-.4,.13],[.5,.45,-.3,.12],[-.4,.3,.62,.12]]) a.add(new THREE.SphereGeometry(R*r, 8, 6).scale(1, .5, 1), MAT.spot, _m.makeTranslation(x*R, y*R*1.05, z*R));
  a.add(new THREE.SphereGeometry(R*.9, 16, 10, 0, Math.PI*2, Math.PI*.55, Math.PI*.45).scale(1.25, .7, .92), MAT.belly, _m.makeTranslation(R*.05, R*.05, 0));
  for (const sz of [-1, 1]) { a.add(new THREE.SphereGeometry(R*.3, 14, 10), MAT.eyeW, _m.makeTranslation(R*.62, R*.36, sz*R*.62));
    a.add(new THREE.SphereGeometry(R*.19, 12, 8), MAT.eye, _m.makeTranslation(R*.78, R*.4, sz*R*.72));
    a.add(new THREE.SphereGeometry(R*.06, 8, 6), MAT.eyeW, _m.makeTranslation(R*.9, R*.5, sz*R*.72));
    a.add(new THREE.SphereGeometry(R*.14, 8, 6).scale(1, .55, .6), MAT.cheek, _m.makeTranslation(R*.95, R*.02, sz*R*.62)); }
  a.add(new THREE.TorusGeometry(R*.3, R*.035, 4, 12, Math.PI*.7).rotateY(Math.PI/2).rotateX(Math.PI + Math.PI*.15).translate(R*1.17, -R*.05, 0), MAT.eye);
  a.into(head);
  const lids = [-1, 1].map(sz => { const l = new THREE.Mesh(new THREE.SphereGeometry(R*.33, 14, 8, 0, Math.PI*2, 0, Math.PI*.5), MAT.skinD);
    l.position.set(R*.62, R*.36, sz*R*.62); l.rotation.z = -.35; l.scale.y = .25; head.add(l); return l; });
  // flippers: front pair near the head, rear pair near the tail (pivot at the shell rim, paddled in tick)
  const rimPt = (ang, out) => { const r = superR(T.a, -Math.PI/4 + ang) + out;
    return U_DIR.clone().multiplyScalar(Math.cos(ang)*r).addScaledVector(V_DIR, Math.sin(ang)*r).setY(T.waterY + .01); };
  const flippers = [];
  // [angle on the rim from the head axis, pointing angle, length, width]
  for (const [ang, pt, len, wid] of [[.6, 1.2, 1.75, .56], [-.6, -1.2, 1.75, .56], [2.4, 2.7, 1.05, .4], [-2.4, -2.7, 1.05, .4]]) {
    const pv = new THREE.Group(); pv.position.copy(rimPt(ang, -.35*s)); grp.add(pv);
    const dir = U_DIR.clone().multiplyScalar(Math.cos(pt)).addScaledVector(V_DIR, Math.sin(pt));
    pv.rotation.y = Math.atan2(-dir.z, dir.x);
    const fa = new Acc(), Lf = len*s, Wf = wid*s;
    const fg = new THREE.SphereGeometry(1, 18, 8), fp = fg.attributes.position;      // a tapered paddle, swept back at the tip
    for (let i=0;i<fp.count;i++){ const x = fp.getX(i), u = (x + 1)/2; fp.setXYZ(i, u*Lf, fp.getY(i)*.13*s*(1.2 - u*.7), fp.getZ(i)*Wf*(1 - u*.55)*(u < .15 ? .75 : 1) - u*u*Wf*.9*Math.sign(pt)); }
    fg.computeVertexNormals(); fa.add(fg, MAT.skin);
    for (const [u, w, r] of [[.45, .1, .16], [.7, -.05, .12], [.3, -.2, .1]]) fa.add(new THREE.SphereGeometry(Wf*r, 8, 6).scale(1, .35, 1), MAT.spot, _m.makeTranslation(u*Lf, .05*s, (w - u*u*.9*Math.sign(pt))*Wf));
    const fl = new THREE.Group(); fa.into(fl); pv.add(fl); flippers.push({ fl, ph:pt > 0 ? 0 : Math.PI, front:Math.abs(ang) < 1.5 });
  }
  // tail
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.16*s, .5*s, 8).rotateZ(Math.PI/2), MAT.skin);
  tail.position.copy(U_DIR.clone().multiplyScalar(-(T.r45 + .05))).setY(T.waterY + .03); tail.rotation.y = Math.PI/4; tail.castShadow = true; grp.add(tail);
  return { grp, T, head, lids, flippers };
}
function buildEnv(){
  const L = V.L, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  V.soil.visible = false; V.blob.visible = false;                   // the turtle IS the block
  const tur = buildTurtle(L), T = tur.T; env.add(tur.grp); V.turtle = tur;
  const Rs = T.r45 + .9*T.s + .45;
  SEA.uA.value = T.a; SEA.uB.value = T.r45; SEA.uR.value = Rs; SEA.uDim.value = S.night ? .45 : 1; SEA.uSwim.value = V.swim ? 1 : 0;
  const sea = new THREE.Mesh(new THREE.CircleGeometry(Rs, 96).rotateX(-Math.PI/2), seaMat); sea.position.y = T.waterY; sea.renderOrder = 1; env.add(sea);
  // frame: the shell rim both ways, the head, the sea's soft edge (mostly)
  const e = Rs*.9; for (const d of [U_DIR, V_DIR]) for (const k of [-1, 1]) V.framePts.push(d.clone().multiplyScalar(k*e).setY(T.waterY));
  V.framePts.push(T.head.clone().addScaledVector(U_DIR, T.headR*1.9).setY(T.head.y + T.headR), T.head.clone().addScaledVector(U_DIR, T.headR*1.9).setY(T.waterY));
  paddle(2.1);
}
function paddle(t){
  const tur = V && V.turtle; if (!tur) return; const sw = V.swim ? 1 : 0, sp = sw ? 2.2 : .9, amp = sw ? .42 : .16;
  tur.flippers.forEach(f => { const w = Math.sin(t*sp + f.ph); f.fl.rotation.y = w*amp*(f.front ? 1 : .6); f.fl.rotation.x = Math.cos(t*sp + f.ph)*amp*.35; });
  tur.head.position.y = tur.T.head.y + Math.sin(t*.8)*.02*tur.T.s;
  // blink: a quick close every ~4 s (and a double blink on waking)
  const bt = (t + 1.3) % 4.2, blink = V.blinkUntil && V.blinkT < V.blinkUntil ? 1 : (bt < .16 ? Math.sin(bt/.16*Math.PI) : 0);
  tur.lids.forEach(l => l.scale.y = .25 + .75*blink);
  SEA.uT.value = t; SEA.uDim.value = S.night ? .45 : 1; SEA.uSwim.value += ((V.swim ? 1 : 0) - SEA.uSwim.value)*.05; FALL_TEX.offset.y = -t*.8;
}

/* decor: meadow tufts + flowers from the shared MegaKit, and a few shells/starfish on cells nothing will use */
function isleDecor(slots){
  meadowDecor(slots, { tuft: r => [r()<.5 ? 'Grass_Common_Short' : (r()<.5 ? 'Clover_1' : 'Grass_Wispy_Short'), 0], flowers:true });
  const r = rngFrom(23);
  world.children.filter(o => o.userData.decor === 'meadow').forEach(grp => { const [x,z] = grp.userData.cell, p = cellPos(x,z), a = new Acc();
    if (r() < .5) starfish(a, new THREE.Vector3(p.x + (r()-.5)*.4, TILE_TOP + .01, p.z + (r()-.5)*.4), r()*6);
    shells(a, 2, r, .38, TILE_TOP + .01, p.x, p.z); a.into(grp); });
}

/* ══════════ residents: the turtle wakes (blinks, paddles, a wake opens behind it), then fish, baby turtles and a manta join ══════════ */
async function loadFish(){ await Promise.all(['Fish1','Fish2','Fish3','Manta'].map(async id => { if (!ANIMCACHE['_'+id]) ANIMCACHE['_'+id] = await loader.loadAsync('assets/reef/'+id+'.glb'); })); }
function makeBaby(){ const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.1, 14, 8, 0, Math.PI*2, 0, Math.PI*.5).scale(1.2, .75, 1), MAT.babyShell);
  a.add(new THREE.CylinderGeometry(.118, .118, .02, 16).scale(1.02, 1, .86), MAT.belly);
  for (let i=0;i<5;i++){ const ang = i/5*6.28; a.add(new THREE.SphereGeometry(.028, 6, 4).scale(1, .35, 1), MAT.spot, _m.makeTranslation(Math.cos(ang)*.06, .07, Math.sin(ang)*.05)); }
  a.add(new THREE.SphereGeometry(.055, 12, 8), MAT.babySkin, _m.makeTranslation(0, .02, .15));
  for (const sx of [-1, 1]) { a.add(new THREE.SphereGeometry(.016, 8, 6), MAT.eye, _m.makeTranslation(sx*.03, .045, .19));
    a.add(new THREE.SphereGeometry(.05, 8, 6).scale(1.4, .2, .55), MAT.babySkin, _m.compose(new THREE.Vector3(sx*.13, 0, .05), _q.setFromEuler(new THREE.Euler(0, sx*.6, 0)), _s)); }
  a.into(g); return g; }
const RES_SCALE = 1.5;
function swimPos(u, t, out){ const a = t*u.sp + u.ph; return out.set(u.cx + Math.cos(a)*u.rx + (u.ox||0), u.h + Math.sin(a*1.7 + u.ph)*(u.bob||.03), u.cz + Math.sin(a)*u.rz + (u.oz||0)); }
function addSwimmer(kind, holder, mixer, u, resident){
  const f = { kind, holder, mixer, u, arrive:resident ? 0 : 1 }; world.add(holder); (V.swimmers || (V.swimmers = [])).push(f); V.life.push(holder); return f; }
function fish(id, u, resident, len){ const f = makeFish(id, len); if (!f) return null; return addSwimmer('fish', f.holder, f.mixer, u, resident); }
function swim(t, dt){
  (V && V.swimmers || []).forEach(f => { const u = f.u, p = swimPosUV(u, t, new THREE.Vector3()), q = swimPosUV(u, t + .05*Math.sign(u.sp || 1), new THREE.Vector3());
    const d = q.clone().sub(p);
    if (f.arrive < 1) { const from = f.from || (f.from = p.clone().add(new THREE.Vector3(4.2, 0, -3.6))); const e = 1 - Math.pow(1 - f.arrive, 3); p.lerpVectors(from, p, e); }
    f.holder.position.copy(p); f.holder.rotation.y = Math.atan2(d.x, d.z);
    if (f.kind === 'baby') f.holder.rotation.z = Math.sin(t*5 + u.ph)*.08;
    if (u.manta) f.holder.rotation.z = Math.sin(t*.8)*.12;
    if (f.mixer) f.mixer.update(dt); });
}
function seaRing(T){ return { rx:T.r45 + .5*T.s, rz:T.r45 + .45*T.s }; }
function ambientSea(){
  V.swimmers = []; const T = V.turtle.T, ring = seaRing(T), y = T.waterY - .05;
  // uv → world: the swim ellipse is laid along u/v, so rotate positions by 45° via cx/cz = 0 and swap in swimPos through a wrapper
  fish('Fish3', { cx:0, cz:0, rx:ring.rx*.72, rz:ring.rz*.72, h:y, sp:.35, ph:.4 }, false, .32);
  fish('Fish1', { cx:0, cz:0, rx:ring.rx, rz:ring.rz, h:y - .04, sp:-.22, ph:2.2 }, false, .38);
  addButterflies();
  swim(2.1, 0);
}
function residentGroups(){
  const T = V.turtle.T, ring = seaRing(T), y = T.waterY - .05;
  return [
    () => { V.swim = true; V.blinkT = 0; V.blinkUntil = .5; return []; },                                           // the turtle wakes and swims
    () => { const g = []; for (let i=0;i<7;i++) g.push(fish('Fish2', { cx:0, cz:0, rx:ring.rx*1.05, rz:ring.rz*1.05, h:y - .02, sp:.26, ph:1 + i*.1, ox:Math.sin(i*2.1)*.2, oz:Math.cos(i*1.7)*.2, bob:.02 }, true, .32 + (i%3)*.04)); return g; },
    () => [0,1,2].map(i => { const b = makeBaby(); b.scale.setScalar(RES_SCALE*1.7*(1 - i*.1)); return addSwimmer('baby', b, null, { cx:0, cz:0, rx:ring.rx + .15, rz:ring.rz + .15, h:T.waterY - .02, sp:.12, ph:1.15 + i*.2, bob:.01 }, true); }),
    () => { const m = makeFish('Manta', 1.1); if (!m) return []; return [addSwimmer('fish', m.holder, m.mixer, { cx:0, cz:0, rx:ring.rx*1.12, rz:ring.rz*1.12, h:y - .06, sp:-.14, ph:.6, manta:true }, true)]; }
  ].map(fn => () => (fn() || []).filter(Boolean));
}
async function turtleMoveIn(walk){
  const groups = residentGroups(); V.residentsIn = true;
  for (let i=0;i<groups.length;i++){
    const rs = groups[i]();
    if (!walk) { rs.forEach(f => f.arrive = 1); continue; }
    await new Promise(res => tween(S.rm ? 1 : (i === 0 ? 1600 : 1400), t => { V.blinkT = t; rs.forEach((f, j) => f.arrive = Math.min(1, Math.max(0, t*1.15 - j*.02))); },
      () => { rs.forEach(f => f.arrive = 1); const p = rs.length ? rs[0].holder.position.clone() : V.turtle.T.head.clone().setY(V.turtle.T.head.y + .5);
        sparkle(p, 10, 0xE9F8FF, .6); res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = groups.length;
}
/* the swim ellipses are defined in the turtle's frame (u along the head): rotate every swimmer's orbit by -45° */
const _swim = swimPos;
function swimPosUV(u, t, out){ _swim(u, t, out); const x = out.x, z = out.z; return out.set(x*U_DIR.x + z*V_DIR.x, out.y, x*U_DIR.z + z*V_DIR.z); }

export default {
  id:'turtle', name:'Turtle isle', title:'Your turtle isle',
  season:25, dates:'14–27 Sep', nextIn:14,
  kits:['a', 'pirate', 'village'],            // kit a first: meadow tufts + flowers; palms/huts pass kit 'pirate', cottages/lanterns 'village'
  kitDefs:{ pirate:{ file:'assets/pirate/pirate-kit.glb', stripSuffix:true }, village:{ file:'assets/village/village.glb' } },
  families:{
    water:   { label:'pools & waterfalls',     tag:'Water' },
    building:{ label:'cottages & the conch house', tag:'Building' },
    path:    { label:'shell paths & fences',   tag:'Path' },
    crop:    { label:'shell gardens',          tag:'Garden' },
    tree:    { label:'palms & shade trees',    tag:'Tree' },
    special: { label:'the lighthouse',         tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><ellipse cx="11" cy="14" rx="7.5" ry="5" fill="#9C7C45"/><path d="M5 13.5c2-3.5 10-3.5 12 0" fill="none" stroke="#6E8F45" stroke-width="2.2" stroke-linecap="round"/><circle cx="20" cy="13" r="2.4" fill="#86B77A"/><path d="M6 18.5l-2 2M16 18.5l2 2" stroke="#86B77A" stroke-width="2" stroke-linecap="round"/><rect x="10" y="4" width="2.2" height="6" rx=".6" fill="#E4574A"/><circle cx="11.1" cy="4" r="1.4" fill="#FFC24A"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M14 84c0-22 22-36 50-36s50 14 50 36c0 4-3 6-7 6H21c-4 0-7-2-7-6z"/><circle cx="116" cy="80" r="8"/><path d="M26 90l-12 12 8 2 14-10zM96 90l12 12-8 2-14-10z"/><rect x="58" y="16" width="10" height="30" rx="2"/><path d="M54 16h18l-9-8z"/><path d="M34 50c2-8 8-12 12-12s4 6 2 12zM82 50c0-8 6-14 10-12s2 8-2 12z"/><path d="M4 110c12-6 24-6 36 0s24 6 36 0 24-6 36 0 12 6 12 6v4H4z"/></g>',
  album:{ image:'assets/turtle/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E1F4F1)' },
  css:'.phone[data-theme="turtle"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#E8F6F2 58%,#CDEDE8 100%)}',

  async preload(){ await loadFish(); },
  build(g, s, opt){
    if (s.kind === 'bed') {
      const slab = new THREE.Mesh(G.field, MAT.bed); slab.position.y = .035; slab.castShadow = slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab);
      const rim = new Acc(), r = rngFrom(s.x*3 + s.z*5); for (let i=0;i<14;i++){ const a = i/14*6.28, rr = .43/Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
        rim.add(new THREE.ConeGeometry(.035, .025, 7).translate(0, .012, 0), [MAT.shellA, MAT.shellB, MAT.shellC][i%3], _m.compose(new THREE.Vector3(Math.cos(a)*rr, .065, Math.sin(a)*rr), _q.setFromEuler(new THREE.Euler(0, r()*6, 0)), _s)); }
      const rg = new THREE.Group(); rim.into(rg); rg.userData.ghostHide = true; g.add(rg);
      const host = new THREE.Group(); host.scale.setScalar(1.25); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillBed(host, s, st);
      fillBed(host, s, opt.stage ?? cropStage(s.id));
    } else B[s.b](g, s, opt);
  },
  scaleOf: s => s.kind === 'bed' ? 1.25 : 1,
  contact: s => s.kind === 'isle' && !['path','fence','lighthouse'].includes(s.b),
  nightLamp: s => s.cat==='building' || s.cat==='special' || (s.b === 'path' && s.v === 3),
  decor: isleDecor,
  env: buildEnv,
  ambient: ambientSea,
  tick(t, dt){ paddle(t); if (V && V.blinkUntil && !V.residentsIn) V.blinkUntil = 0; flyButterflies(t); swim(t, dt); },

  residents:[ { id:'wake', name:'Turtle', n:1 }, { id:'Fish2', name:'Blue tangs', n:7 }, { id:'baby', name:'Hatchlings', n:3 }, { id:'Manta', name:'Manta ray', n:1 } ],
  moveIn: turtleMoveIn,
  residentThumb(d, thumbFor){
    if (d.id === 'baby' || d.id === 'wake') return thumbFor('turtle:'+d.id, () => { if (d.id === 'baby') { const b = makeBaby(); b.rotation.y = .9; return b; }
      const t = buildTurtle(3); t.grp.remove(t.grp.children[1]); t.grp.rotation.y = 0; return t.grp; }, 168);
    if (!ANIMCACHE['_'+d.id]) return '';
    return thumbFor('fish:'+d.id, () => { const f = makeFish(d.id, 1); f.mixer.update(.3); f.holder.rotation.y = Math.PI/2 + .5; return f.holder; }, 168); },
  residentRig(d){
    if (d.id === 'baby') { const o = makeBaby(); o.scale.setScalar(RES_SCALE); return { obj:o, mixer:new THREE.AnimationMixer(o), clip:null, facing:0 }; }
    if (d.id === 'wake') { const t = buildTurtle(3); t.grp.remove(t.grp.children[1]); return { obj:t.grp, mixer:new THREE.AnimationMixer(t.grp), clip:null, facing:0 }; }
    const f = makeFish(d.id, d.id === 'Manta' ? 1.1 : .4); if (!f) return null; if (f.clip) f.mixer.clipAction(f.clip).time = 0; return { obj:f.holder, mixer:f.mixer, clip:f.clip, facing:Math.PI/2 }; }
};
