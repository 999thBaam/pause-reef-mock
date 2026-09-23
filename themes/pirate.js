/* PIRATE ISLAND (?theme=pirate) — same 7×7 ring blueprint, camera and light rig as the farm; every farm slot id maps to an
   island piece, so the farm's order, rings, pick-3, growth and expansion work unchanged. Huts, towers, palms, dock, barrels,
   cannons, flags, the chest and the ship = Kenney Pirate Kit 2.1 (CC0, assets/pirate/). Tide pools, the waterfall, banana /
   pineapple beds, rope fences, torches, the pearl hoard and the residents (parrot, crabs, gulls) are procedural three.js
   geometry, merged per material so every piece stays pre-renderable. The island block sits in a turquoise shallow-water rim (env). */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rngFrom, TEX, addSway, world, fx } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, seg, blob, _up, _q, _m, _s } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { addButterflies, flyButterflies } from '../engine/life.js';
import { FARM_SLOTS as FARM, FARM_ORDER } from './farm.js';   // the farm blueprint with its hero moved to the right corner (see farm.js)

const PM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.8, metalness:0, flatShading:true, ...o });
const MAT = {
  sand:PM(0xF1DDB0, { roughness:1 }), wetSand:new THREE.MeshStandardMaterial({ color:0xD7B07A, roughness:1, map:TEX.furrow }),
  rock:PM(0xA69C94), rockD:PM(0x857B78), wood:PM(0x8A5A36), woodL:PM(0xB98552), rope:PM(0xD9C08E),
  pool:new THREE.MeshStandardMaterial({ color:0x3ED3D2, roughness:.15, metalness:0, emissive:0x0B6670, emissiveIntensity:.35 }),
  foam:PM(0xFFFFFF, { roughness:.6 }),
  shellA:PM(0xFFE6D2), shellB:PM(0xF7B7A3), star:PM(0xF2784B),
  gold:PM(0xF6C544, { emissive:0x7A5200, emissiveIntensity:.35, roughness:.45, flatShading:false }),
  flame:new THREE.MeshStandardMaterial({ color:0xFFC857, emissive:0xFF8A1F, emissiveIntensity:1.7 }),
  pearl:new THREE.MeshStandardMaterial({ color:0xFFFBF4, emissive:0xEDE3FF, emissiveIntensity:.5, roughness:.22, metalness:.05 }),
  pearlP:new THREE.MeshStandardMaterial({ color:0xF6E6FF, emissive:0xD9C6FF, emissiveIntensity:.45, roughness:.25, metalness:.05 }),
  // plants
  stem:PM(0x86A84C), pine:PM(0x5E9C5A), pineFruit:PM(0xE3A63B), pineUnripe:PM(0x9DBF4A), banana:PM(0xF4D34A), bud:PM(0x8E3E6B),
  // residents
  crab:PM(0xE8573F), crabD:PM(0xC0402F), white:PM(0xFFFFFF), black:PM(0x2B2B33), orange:PM(0xF29A38), grey:PM(0x9FA8B3),
  red:PM(0xE0322E), blue:PM(0x2F7BE0), yellow:PM(0xF6C531), bill:PM(0x3A3432)
};
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = PM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }

/* one Kenney model, fitted to h (height) and w (width) in tiles; returns the group with its top height */
function kp(g, name, h, w, x=0, y=0, z=0, rot=0){ const tpl = KITCACHE.pirate && KITCACHE.pirate[name]; if (!tpl) return null;
  const k = fitScale(tpl, h, w), o = addModel(g, name, k, x, y, z, rot, 'pirate'); if (o) o.userData.top = y + tpl.size.y*k; return o; }

/* ── little props ── */
function shells(acc, n, rng, rad=.34, y=.035, cx=0, cz=0){
  for (let i=0;i<n;i++){ const a = rng()*6.28, d = rad*(.35 + rng()*.65), p = new THREE.Vector3(cx + Math.cos(a)*d, y, cz + Math.sin(a)*d);
    acc.add(new THREE.ConeGeometry(.05, .028, 8, 1).translate(0, .014, 0), i%2 ? MAT.shellA : MAT.shellB, _m.compose(p, _q.setFromEuler(new THREE.Euler(0, rng()*6, 0)), new THREE.Vector3(1, .8, .78))); }
}
const STAR_GEO = (() => { const sh = new THREE.Shape(); for (let i=0;i<10;i++){ const a = i/10*Math.PI*2 - Math.PI/2, r = i%2 ? .026 : .075; i ? sh.lineTo(Math.cos(a)*r, Math.sin(a)*r) : sh.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
  return new THREE.ExtrudeGeometry(sh, { depth:.016, bevelEnabled:true, bevelSize:.008, bevelThickness:.008, bevelSegments:1 }).rotateX(-Math.PI/2); })();
function starfish(acc, p, rot){ acc.add(STAR_GEO, MAT.star, _m.compose(p, _q.setFromEuler(new THREE.Euler(0, rot, 0)), _s)); }
function glowSprite(parent, pos, scale, color, opacity=.8){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; s.userData.glow = true; parent.add(s); return s; }
/* tiki torch: pole, basket, flame (+ a glow sprite; sprites never show in ghosts) */
function torch(g, acc, x, z, h=.46){
  seg(acc, MAT.wood, new THREE.Vector3(x, 0, z), _up, h, .022, .018, 6);
  acc.add(new THREE.CylinderGeometry(.05, .03, .07, 7).translate(0, h + .02, 0), MAT.woodL, _m.makeTranslation(x, 0, z));
  acc.add(new THREE.ConeGeometry(.038, .11, 7).translate(0, h + .1, 0), MAT.flame, _m.makeTranslation(x, 0, z));
  glowSprite(g, new THREE.Vector3(x, h + .1, z), .42, 0xFFB060, .55);
}
/* a pool of turquoise water in a rock ring (tide pool / spring / waterfall basin) */
function rockPool(acc, rng, r, cx=0, cz=0, n=12){
  acc.add(new THREE.CylinderGeometry(r, r, .02, 28).translate(cx, .045, cz), MAT.pool);
  for (let i=0;i<n;i++){ const a = i/n*6.28 + rng()*.2; blob(acc, rng()<.6 ? MAT.rock : MAT.rockD, new THREE.Vector3(cx + Math.cos(a)*r*1.02, .05, cz + Math.sin(a)*r*1.02), .06 + rng()*.035, .7, 0, rng); }
}

/* ── growing beds (Sudoku / Math): banana plants, pineapples, palm saplings ── */
function leafGeo(len, w, arch){ const g = new THREE.PlaneGeometry(w, len, 1, 5).translate(0, len/2, 0), p = g.attributes.position;
  for (let i=0;i<p.count;i++){ const y = p.getY(i), t = y/len, ww = Math.sin(Math.PI*Math.min(1, t*1.05 + .05));
    p.setXYZ(i, p.getX(i)*ww, y*(1 - arch*t*.5), arch*t*t*len*.9); } g.computeVertexNormals(); return g; }
function bananaPlant(acc, p, st, rng){
  const h = .06 + st*.04, lm = swayMat(0x62B544, .5, .05), lm2 = swayMat(0x7BC655, .5, .05);
  seg(acc, MAT.stem, p, _up, h, .028, .022, 6);
  const n = Math.min(6, 1 + st);
  for (let i=0;i<n;i++){ const a = i/n*6.28 + rng(), len = .09 + st*.045;
    acc.add(leafGeo(len, .1 + st*.02, .75), i%2 ? lm : lm2, _m.compose(new THREE.Vector3(p.x, p.y + h*.92, p.z), _q.setFromEuler(new THREE.Euler(.35, a, 0, 'YXZ')), _s)); }
  if (st >= 5) { const b = new THREE.Vector3(p.x + .035, p.y + h*.75, p.z + .02);
    for (let i=0;i<6;i++){ const aa = i/6*6.28; acc.add(new THREE.CapsuleGeometry(.011, .045, 2, 5), MAT.banana,
      _m.compose(b.clone().add(new THREE.Vector3(Math.cos(aa)*.022, -(i%2)*.02, Math.sin(aa)*.022)), _q.setFromEuler(new THREE.Euler(Math.cos(aa)*.5, 0, Math.sin(aa)*.5)), _s)); }
    blob(acc, MAT.bud, b.clone().add(new THREE.Vector3(0, -.06, 0)), .018, 1.4); }
}
function pineapple(acc, p, st, rng){
  const s = .6 + st*.16, n = 9;
  for (let i=0;i<n;i++){ const a = i/n*6.28 + rng()*.3, d = new THREE.Vector3(Math.cos(a)*.75, 1, Math.sin(a)*.75).normalize(), L = (.07 + rng()*.03)*s;
    _q.setFromUnitVectors(_up, d); acc.add(new THREE.ConeGeometry(.012*s, L, 4).translate(0, L/2, 0), MAT.pine, _m.compose(p, _q, _s)); }
  if (st >= 3) { const fr = st >= 4 ? MAT.pineFruit : MAT.pineUnripe, fh = (st >= 5 ? .07 : .05)*s;
    acc.add(new THREE.SphereGeometry(fh*.62, 7, 5), fr, _m.compose(p.clone().setY(p.y + fh*.9), _q.identity(), new THREE.Vector3(1, 1.35, 1)));
    for (let i=0;i<5;i++){ const a = i/5*6.28, d = new THREE.Vector3(Math.cos(a)*.4, 1, Math.sin(a)*.4).normalize(); _q.setFromUnitVectors(_up, d);
      acc.add(new THREE.ConeGeometry(.008*s, .04*s, 4).translate(0, .02*s, 0), MAT.pine, _m.compose(p.clone().setY(p.y + fh*1.7), _q, _s)); } }
}
const BED = { Corn:'banana', Carrot:'pineapple', Lettuce:'sapling', Beet:'sapling' };
const BED_NAME = { banana:'Banana grove', pineapple:'Pineapple patch', sapling:'Palm saplings' };
function fillBed(host, s, stage){
  host.clear();
  const r = rngFrom(s.x*31 + s.z*7 + 5), kind = BED[s.crop], acc = new Acc();
  if (kind === 'sapling') {
    const spots = [[-.2,-.2],[.2,-.18],[-.18,.2],[.21,.2]];
    spots.forEach(([x,z], i) => { if (stage <= 1) { kp(host, 'grass-plant', .1, .16, x, .07, z, r()*6); return; }
      kp(host, i%2 ? 'palm-bend' : 'palm-straight', .1 + stage*.062, .42, x + (r()-.5)*.03, .07, z + (r()-.5)*.03, r()*6.28); });
    if (stage >= 5) for (let i=0;i<3;i++) acc.add(new THREE.SphereGeometry(.035, 7, 5), MAT.wood, _m.makeTranslation(-.02 + i*.05, .1, .02 - (i%2)*.05));
  } else {
    const n = kind === 'banana' ? 4 : 9;
    for (let i=0;i<n;i++){ const x = kind === 'banana' ? [-.2,.2,-.2,.2][i] : ((i%3)-1)*.27, z = kind === 'banana' ? [-.2,-.2,.2,.2][i] : (Math.floor(i/3)-1)*.27;
      const p = new THREE.Vector3(x + (r()-.5)*.03, .07, z + (r()-.5)*.03);
      kind === 'banana' ? bananaPlant(acc, p, stage, r) : pineapple(acc, p, stage, r); }
  }
  acc.m.size && acc.into(host); host.userData.stage = stage;
}

/* ── the hero: an open treasure chest overflowing with glowing pearls (our currency) ── */
function pearlHeap(list, n, rng, fn){ for (let i=0;i<n;i++){ const [p, r] = fn(i); list.push(new THREE.SphereGeometry(r, 14, 10).translate(p.x, p.y, p.z)); } }
function buildTreasure(g){
  const a = new Acc(), r = rngFrom(99);
  blob(a, MAT.sand, new THREE.Vector3(0, -.06, 0), .95, .2, 1, r);                       // a sand mound the chest is half dug into
  kp(g, 'palm-detailed-bend', 1.7, 1.2, -.55, 0, -.6, 2.6);
  kp(g, 'tool-shovel', .5, .2, .62, .02, -.35, .4).rotation.z = .35;
  const tpl = KITCACHE.pirate && KITCACHE.pirate.chest; if (!tpl) return;
  const k = fitScale(tpl, 1.0, 1.5), chest = new THREE.Group();
  const lidIdx = tpl.parts.reduce((bi, pt, i, arr) => { const y = new THREE.Vector3().setFromMatrixPosition(pt.local).y; return y > new THREE.Vector3().setFromMatrixPosition(arr[bi].local).y ? i : bi; }, 0);
  tpl.parts.forEach((pt, i) => { const m = new THREE.Mesh(pt.geo, pt.mat); m.applyMatrix4(i === lidIdx ? pt.local.clone().multiply(new THREE.Matrix4().makeRotationX(-1.95)) : pt.local);
    m.castShadow = m.receiveShadow = true; chest.add(m); });
  chest.scale.setScalar(k); chest.rotation.y = Math.PI/4 + .15; chest.position.set(.05, .06, .05); g.add(chest);
  const W = tpl.size.x*k, D = tpl.size.z*k, H = tpl.size.y*k*.62;                           // body height (the lid is the top ~40%)
  const heap = new THREE.Group(); heap.position.copy(chest.position); heap.rotation.y = chest.rotation.y; g.add(heap);
  const white = [], lil = [];
  pearlHeap(white, 58, r, i => { const u = (r()-.5)*W*.82, v = (r()-.5)*D*.72, dome = 1 - (u*u/(W*W*.2) + v*v/(D*D*.2)); return [new THREE.Vector3(u, H + Math.max(0, dome)*.36 + r()*.06, v), .07 + r()*.03]; });
  pearlHeap(lil, 12, r, i => { const u = (r()-.5)*W*.7, v = (r()-.5)*D*.6; return [new THREE.Vector3(u, H + .1 + r()*.12, v), .06 + r()*.02]; });
  // spilling over the front lip and onto the sand
  pearlHeap(white, 14, r, i => { const t = i/14, u = (r()-.5)*W*.6; return [new THREE.Vector3(u, H*(1 - t) + .04, D*.5 + .06 + t*.3 + r()*.05), .055 + r()*.02]; });
  pearlHeap(lil, 8, r, i => { const aa = -.9 + r()*1.8, d = D*.5 + .28 + r()*.25; return [new THREE.Vector3(Math.sin(aa)*d*.9, .05, Math.cos(aa)*d), .05 + r()*.015]; });
  [[white, MAT.pearl], [lil, MAT.pearlP]].forEach(([list, mat]) => { const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = true; m.receiveShadow = true; heap.add(m); });
  for (let i=0;i<14;i++){ const aa = -1.4 + r()*2.8, d = D*.5 + .2 + r()*.45;
    a.add(new THREE.CylinderGeometry(.035, .035, .012, 10), MAT.gold, _m.compose(new THREE.Vector3(Math.sin(aa + chest.rotation.y)*d, .02 + (i%3)*.01, Math.cos(aa + chest.rotation.y)*d), _q.setFromEuler(new THREE.Euler(r()*.5, 0, r()*.5)), _s)); }
  a.into(g);
  glowSprite(g, new THREE.Vector3(.05, H + .3, .05), 1.9, 0xEDE3FF, 1); glowSprite(g, new THREE.Vector3(.05, H + .25, .05), .9, 0xFFE9B0, .7);
  [[.15, .42, .2, .2], [-.25, .3, .1, .13], [.3, .2, -.2, .11]].forEach(([x,y,z,sc]) => { const sp = glowSprite(g, new THREE.Vector3(x, H + y, z), sc, 0xFFFFFF, .95); sp.material.map = TEX.star; });
  g.userData.pearl = heap;
}

/* ── named pieces ── */
const B = {
  captain(g){                                            // 2×2 hero building: a thatched hut on a plank deck, flag, barrels
    const deck = kp(g, 'structure-platform', .38, 1.9, 0, 0, 0, 0);
    const y = deck ? deck.userData.top - .02 : .3;
    kp(g, 'structure-roof', 1.0, 1.15, -.18, y, -.18, 0);
    kp(g, 'barrel', .26, .26, .55, y, .45, .3); kp(g, 'barrel', .26, .26, .3, y, .62, 1.1); kp(g, 'crate', .24, .3, .62, y, .12, .4);
    kp(g, 'flag-pirate-high', 1.5, .5, .62, y, -.62, -.6); },
  tidepool(g, s){ const a = new Acc(), r = rngFrom(s.x*5 + s.z);
    rockPool(a, r, .3, 0, 0, 12); starfish(a, new THREE.Vector3(.08, .058, -.04), 1.1); blob(a, MAT.rockD, new THREE.Vector3(-.1, .05, .08), .06, .6, 0, r);
    shells(a, 3, r, .44, .03); a.into(g); },
  spring(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z*3);
    kp(g, 'rocks-sand-b', .42, .55, -.18, 0, -.18, .6); rockPool(a, r, .24, .12, .12, 10);
    kp(g, 'grass-plant', .2, .22, .34, .03, -.2, 1); kp(g, 'grass', .14, .2, -.3, .03, .28, 2); a.into(g); },
  lagoon(g, s){ const a = new Acc(), r = rngFrom(71);
    rockPool(a, r, .36, .02, .04, 16); starfish(a, new THREE.Vector3(-.12, .058, .1), .4);
    kp(g, 'palm-bend', .9, .7, -.32, 0, -.32, .7); shells(a, 2, r, .45, .03); a.into(g); },
  waterfall(g, s){ const a = new Acc(), r = rngFrom(33);
    const rk = kp(g, 'rocks-c', .95, .8, -.12, 0, -.12, .3); const H = rk ? rk.userData.top : .9;
    kp(g, 'grass-plant', .22, .25, -.28, H*.82, -.2, 0);
    rockPool(a, r, .22, .18, .18, 10); a.into(g);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(.2, H*.78, 1, 6).translate(0, H*.39 + .04, 0), FALL_MAT);
    fall.position.set(.08, 0, .08); fall.rotation.y = Math.PI/4; fall.renderOrder = 2; g.add(fall);
    const foam = new Acc(); for (let i=0;i<6;i++){ const aa = i/6*6.28; blob(foam, MAT.foam, new THREE.Vector3(.14 + Math.cos(aa)*.07, .06, .14 + Math.sin(aa)*.07), .035, .5); } foam.into(g); },
  tower(g){ kp(g, 'tower-complete-large', 1.45, .8, 0, 0, 0, .4); kp(g, 'barrel', .24, .24, .34, 0, .3, 0); },
  hut(g){ kp(g, 'structure-roof', .95, .95, 0, 0, 0, .3); kp(g, 'barrel', .24, .24, .3, 0, .32, 0); },
  shed(g){ kp(g, 'structure-roof', .85, .95, 0, 0, 0, -.4); kp(g, 'boat-row-large', .26, .8, 0, 0, .02, Math.PI/4); kp(g, 'barrel', .22, .22, .36, 0, -.32, 0); },
  gate(g){ kp(g, 'castle-gate', .95, .95, 0, 0, 0, 0); const a = new Acc(); torch(g, a, .42, .38, .4); a.into(g); },
  jetty(g){ kp(g, 'structure-platform-dock', .3, 1.25, 0, -.05, -.22, Math.PI/2); kp(g, 'boat-row-small', .22, .6, .38, -.1, -.66, 0);
    kp(g, 'barrel', .22, .22, -.3, .18, .2, 0); },
  palm(g, s){ kp(g, s.m, s.h, s.w || .95, 0, 0, 0, (s.rot||0)*Math.PI/180); const a = new Acc(), r = rngFrom(s.x*3 + s.z*11);
    for (let i=0;i<2;i++) a.add(new THREE.SphereGeometry(.04, 7, 5), MAT.wood, _m.makeTranslation(.16 + i*.07, .04, .14 - i*.05));
    shells(a, 1, r, .38); a.into(g); },
  palms(g, s){ kp(g, 'palm-straight', 1.05, .6, -.14, 0, -.12, 0); kp(g, 'palm-bend', .8, .6, .18, 0, .16, 2.2); kp(g, 'grass-plant', .2, .24, .28, 0, -.24, 0); },
  path(g, s){ const slab = new THREE.Mesh(G.path, MAT.sand); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
    const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0;
    if (v === 0) { for (let i=0;i<5;i++){ const w = [MAT.wood, MAT.woodL][i%2]; a.add(new THREE.BoxGeometry(.86 - r()*.08, .03, .15), w, _m.compose(new THREE.Vector3((r()-.5)*.04, .05, -.36 + i*.18), _q.setFromEuler(new THREE.Euler(0, (r()-.5)*.08, 0)), _s)); }
      for (const x of [-.3, .3]) a.add(new THREE.BoxGeometry(.05, .03, .9), MAT.wood, _m.makeTranslation(x, .032, 0)); g.userData.ghostMode = 'marker'; }
    else if (v === 1) { kp(g, 'barrel', .32, .3, -.2, .035, -.14, .4); kp(g, 'crate', .26, .32, .18, .035, .12, .5); kp(g, 'bottle', .16, .08, -.22, .035, .26, 0); }
    else if (v === 2) { kp(g, 'cannon-mobile', .38, .66, 0, .035, 0, .9); kp(g, 'cannon-ball', .1, .1, .32, .035, .28); kp(g, 'cannon-ball', .1, .1, .38, .035, .16); }
    else if (v === 3) { kp(g, 'flag-pirate-high', 1.0, .4, -.12, .035, -.12, -.5); torch(g, a, .24, .2); }
    else if (v === 4) { torch(g, a, -.22, -.2); torch(g, a, .24, .22); starfish(a, new THREE.Vector3(.18, .045, -.18), 1); }
    else { kp(g, 'crate-bottles', .28, .34, -.1, .035, -.05, .3); kp(g, 'barrel', .26, .26, .24, .035, .24, 0); }
    shells(a, 2, r, .4, .04); a.into(g); },
  rope(g, s){ const a = new Acc(), n = s.len*2 + 1, L = s.len;
    const pos = i => { const t = -L/2 + i*(L/(n-1)); return s.edge === 'w' ? new THREE.Vector3(-.45, 0, t) : new THREE.Vector3(t, 0, .45); };
    for (let i=0;i<n;i++){ const p = pos(i); seg(a, MAT.wood, p, _up, .3, .03, .026, 6); blob(a, MAT.woodL, p.clone().setY(.31), .032, .6); }
    for (let i=0;i<n-1;i++){ const p0 = pos(i), p1 = pos(i+1);
      for (const hh of [.26, .15]) { const c = new THREE.CatmullRomCurve3([p0.clone().setY(hh), p0.clone().lerp(p1, .5).setY(hh - .05), p1.clone().setY(hh)]);
        a.add(new THREE.TubeGeometry(c, 8, .011, 5), MAT.rope); } }
    a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz); },
  treasure: buildTreasure
};
const FALL_TEX = (() => { const c = document.createElement('canvas'); c.width = 32; c.height = 128; const g = c.getContext('2d'), r = rngFrom(8);
  g.fillStyle = '#8FE6EA'; g.fillRect(0,0,32,128);
  for (let i=0;i<22;i++){ g.fillStyle = 'rgba(255,255,255,'+(.35 + r()*.5)+')'; g.fillRect(r()*30, r()*128, 1.5 + r()*2, 10 + r()*24); }
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
const FALL_MAT = new THREE.MeshBasicMaterial({ map:FALL_TEX, transparent:true, opacity:.88, side:THREE.DoubleSide, depthWrite:false });

/* blueprint: every farm slot id → an island piece (same cells, same rings, same order) */
const MAP = {
  bigbarn:{ name:"Captain's hut", b:'captain' }, well:{ name:'Tide pool', b:'tidepool' }, apple1:{ name:'Coconut palm', b:'palm', m:'palm-detailed-straight', h:1.4, rot:20 },
  silo:{ name:'Lookout tower', b:'tower' }, silohouse:{ name:'Beach hut', b:'hut' }, coop:{ name:'Boat shed', b:'shed' },
  watertower:{ name:'Waterfall', b:'waterfall' }, pump:{ name:'Freshwater spring', b:'spring' }, apple2:{ name:'Tall palm', b:'palm', m:'palm-straight', h:1.55, w:.8, rot:140 },
  berry1:{ name:'Palm cluster', b:'palms' }, peepal:{ name:'Treasure chest', b:'treasure' }, smallbarn:{ name:'Fort gate', b:'gate' },
  openbarn:{ name:'Jetty', b:'jetty' }, pond:{ name:'Lagoon', b:'lagoon' }, orange1:{ name:'Leaning palm', b:'palm', m:'palm-detailed-bend', h:1.3, rot:200 },
  apple3:{ name:'Coconut palm', b:'palm', m:'palm-detailed-straight', h:1.4, rot:260 }, berry2:{ name:'Palm cluster', b:'palms' },
  orange2:{ name:'Leaning palm', b:'palm', m:'palm-detailed-bend', h:1.3, rot:30 }, apple4:{ name:'Coconut palm', b:'palm', m:'palm-detailed-straight', h:1.4, rot:60 }
};
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:0, path2_6:5, path3_6:4 };
const PATH_NAME = ['Plank walk','Barrels & crates','Cannon','Pirate flag','Tiki torches','Cargo'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') { const kind = BED[f.crop]; return { ...s, kind:'bed', crop:f.crop, name:BED_NAME[kind], stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'isle', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'isle', b:'rope', edge:f.edge, len:f.len, name:'Rope fence' };
  return { ...s, kind:'isle', ...MAP[f.id] };
});

/* ── the look: sand tiles on a sandstone block, standing in a turquoise shallow-water rim ── */
const SAND_TILE = { top:['#F4E2B4','#EFD9A6'], side:'#E6C993', soilTop:'#D8B684', soilBot:'#7E5E43' };
function sandTileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(43);
  g.fillStyle = '#F6F1E8'; g.fillRect(0,0,N,N);
  for (let i=0;i<7;i++){ g.strokeStyle = 'rgba(160,120,60,.10)'; g.lineWidth = 3; g.beginPath();
    for (let x=0;x<=N;x+=6){ const y = (i+.5)*N/7 + Math.sin(x*.045 + i*1.3)*6; x ? g.lineTo(x,y) : g.moveTo(x,y); } g.stroke(); }
  for (let i=0;i<280;i++){ g.fillStyle = r()<.55 ? 'rgba(255,255,255,.6)' : 'rgba(150,105,50,.13)'; g.beginPath(); g.arc(r()*N, r()*N, .6 + r()*1.2, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const RIM = .62, WATER_Y = -.12, WUNI = { uH:{ value:1.5 }, uR:{ value:RIM }, uT:{ value:0 }, uDim:{ value:1 } };
const rimMat = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, uniforms:WUNI,
  vertexShader:'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader:`uniform float uH; uniform float uR; uniform float uT; uniform float uDim; varying vec2 vP;
    void main(){ vec2 q = abs(vP) - vec2(uH); float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.);   // distance from the block (rounded square)
      if (d < -.02) discard; float t = clamp(d/uR, 0., 1.);
      vec3 shallow = vec3(.36,.86,.84), deep = vec3(.22,.70,.84);
      vec3 col = mix(shallow, deep, smoothstep(.1, 1., t));
      float foam = smoothstep(.07, .0, d) + .55*smoothstep(.035, 0., abs(d - .13 - .025*sin(uT*1.4 + (vP.x + vP.y)*2.2)));
      float ripple = .5 + .5*sin(d*34. - uT*1.6 + sin((vP.x - vP.y)*3.)*1.2);
      col = mix(col, vec3(1.), clamp(foam, 0., 1.)*.85 + ripple*.05*(1. - t));
      float a = (1. - smoothstep(.45, 1., t)) * .92;
      gl_FragColor = vec4(col*uDim, a*mix(.75, 1., uDim)); }` });
const SHIP_AT = new THREE.Vector3(1.35, WATER_Y, -4.55);        // where the ship moors: off the north shore, by the jetty
function buildEnv(){
  const L = V.L, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  WUNI.uH.value = L/2 + .02; WUNI.uDim.value = S.night ? .42 : 1;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(L + 2*RIM + .2, L + 2*RIM + .2).rotateX(-Math.PI/2), rimMat);
  plane.position.y = WATER_Y; plane.renderOrder = 1; env.add(plane);
  const h = L/2 + RIM*.55; for (const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) V.framePts.push(new THREE.Vector3(sx*h, WATER_Y, sz*h));
  if (V.ring === 3) V.framePts.push(SHIP_AT.clone().add(new THREE.Vector3(-1.1, 0, -.4)), SHIP_AT.clone().add(new THREE.Vector3(1.1, 1.3, -.4)));
}
/* decor: dune grass, shells and pebbles on waiting cells; a little beach garden on cells nothing will use */
function islandDecor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    const grass = (px, pz, k=1) => kp(grp, r()<.5 ? 'grass' : 'grass-plant', (.13 + r()*.08)*k, .3*k, px + (r()-.5)*.1, TILE_TOP, pz + (r()-.5)*.1, r()*6);
    if (!sl || sl === 'later') {
      grass(p.x - .22, p.z + .15); grass(p.x + .24, p.z - .22, .8);
      if (r() < .45) starfish(a, new THREE.Vector3(p.x + (r()-.5)*.4, TILE_TOP + .01, p.z + (r()-.5)*.4), r()*6);
      else blob(a, MAT.rock, new THREE.Vector3(p.x + (r()-.5)*.35, TILE_TOP, p.z + (r()-.5)*.35), .07, .6, 0, r);
      shells(a, 2, r, .4, TILE_TOP + .01, p.x, p.z); a.into(grp); grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { grass(p.x + .3, p.z + .3, .8); shells(a, 2, r, .35, TILE_TOP + .01, p.x, p.z);
      a.into(grp); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else world.remove(grp);
  }
}

/* ── residents: a pirate ship moors by the jetty, a parrot lands on the lookout, crabs scuttle out, gulls wheel overhead ── */
function makeCrab(){ const g = new THREE.Group(), a = new Acc();
  blob(a, MAT.crab, new THREE.Vector3(0, .07, 0), .08, .55, 1); blob(a, MAT.crabD, new THREE.Vector3(0, .055, 0), .075, .4, 0);
  for (const sx of [-1, 1]) { for (let i=0;i<3;i++){ const p = new THREE.Vector3(sx*.06, .06, -.04 + i*.04), d = new THREE.Vector3(sx, -.9, 0).normalize(); seg(a, MAT.crabD, p, d, .09, .012, .008, 4); }
    const ap = new THREE.Vector3(sx*.05, .07, .07); seg(a, MAT.crab, ap, new THREE.Vector3(sx*.3, .3, 1).normalize(), .06, .014, .012, 4);
    blob(a, MAT.crab, ap.clone().add(new THREE.Vector3(sx*.025, .025, .06)), .03, .8);
    seg(a, MAT.crabD, new THREE.Vector3(sx*.025, .09, .045), _up, .045, .006, .006, 4); blob(a, MAT.white, new THREE.Vector3(sx*.025, .138, .045), .014); blob(a, MAT.black, new THREE.Vector3(sx*.025, .142, .056), .007); }
  a.into(g); return g; }
function makeGull(){ const g = new THREE.Group(), a = new Acc();
  blob(a, MAT.white, new THREE.Vector3(0, 0, 0), .06, 1); a.add(new THREE.SphereGeometry(.06, 8, 6), MAT.white, _m.compose(new THREE.Vector3(0, 0, -.03), _q.identity(), new THREE.Vector3(.85, .8, 1.9)));
  blob(a, MAT.white, new THREE.Vector3(0, .035, .1), .042); a.add(new THREE.ConeGeometry(.013, .06, 5).rotateX(Math.PI/2), MAT.orange, _m.makeTranslation(0, .03, .16));
  blob(a, MAT.black, new THREE.Vector3(.03, .05, .12), .008); blob(a, MAT.black, new THREE.Vector3(-.03, .05, .12), .008);
  a.add(new THREE.ConeGeometry(.04, .09, 4).rotateX(-Math.PI/2).scale(1, .3, 1), MAT.grey, _m.makeTranslation(0, .005, -.16)); a.into(g);
  const wg = new THREE.PlaneGeometry(.26, .09).rotateX(-Math.PI/2).translate(.13, 0, 0);
  const wm = new THREE.MeshStandardMaterial({ color:0xF4F6F8, roughness:.8, side:THREE.DoubleSide, flatShading:true });
  const w1 = new THREE.Mesh(wg, wm), w2 = new THREE.Mesh(wg, wm); w2.scale.x = -1; w1.position.y = w2.position.y = .02;
  const tip = new THREE.PlaneGeometry(.07, .08).rotateX(-Math.PI/2).translate(.23, .001, 0), t1 = new THREE.Mesh(tip, MAT.bill); w1.add(t1); const t2 = t1.clone(); w2.add(t2);
  [w1, w2].forEach(w => w.castShadow = true); g.add(w1, w2); g.userData.wings = [w1, w2]; return g; }
function makeParrot(){ const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.07, 8, 6), MAT.red, _m.compose(new THREE.Vector3(0, .1, 0), _q.setFromEuler(new THREE.Euler(-.35, 0, 0)), new THREE.Vector3(.85, 1.35, .85)));
  blob(a, MAT.red, new THREE.Vector3(0, .22, .03), .055, 1, 1); blob(a, MAT.white, new THREE.Vector3(.03, .225, .06), .026, 1); blob(a, MAT.white, new THREE.Vector3(-.03, .225, .06), .026, 1);
  blob(a, MAT.black, new THREE.Vector3(.04, .235, .075), .009); blob(a, MAT.black, new THREE.Vector3(-.04, .235, .075), .009);
  a.add(new THREE.ConeGeometry(.024, .06, 6).rotateX(Math.PI*.7), MAT.bill, _m.makeTranslation(0, .2, .1));
  for (const sx of [-1, 1]) { a.add(new THREE.SphereGeometry(.05, 7, 5), MAT.blue, _m.compose(new THREE.Vector3(sx*.055, .09, -.02), _q.setFromEuler(new THREE.Euler(-.5, 0, sx*.15)), new THREE.Vector3(.35, 1.4, .9)));
    a.add(new THREE.SphereGeometry(.03, 7, 5), MAT.yellow, _m.compose(new THREE.Vector3(sx*.06, .13, .01), _q.identity(), new THREE.Vector3(.35, 1, .9))); }
  a.add(new THREE.BoxGeometry(.04, .2, .012), MAT.red, _m.compose(new THREE.Vector3(0, -.03, -.07), _q.setFromEuler(new THREE.Euler(.45, 0, 0)), _s));
  a.add(new THREE.BoxGeometry(.03, .16, .01), MAT.blue, _m.compose(new THREE.Vector3(0, -.04, -.085), _q.setFromEuler(new THREE.Euler(.45, 0, 0)), _s));
  seg(a, MAT.bill, new THREE.Vector3(.02, 0, 0), _up, .04, .006, .006, 4); seg(a, MAT.bill, new THREE.Vector3(-.02, 0, 0), _up, .04, .006, .006, 4);
  a.into(g); return g; }
function makeShip(){ const g = new THREE.Group(); kp(g, 'ship-pirate-medium', 1.75, 2.3, 0, -.28, 0, Math.PI/2);
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ map:TEX.glow, color:0x7FE0DC, transparent:true, opacity:.7, depthWrite:false }));
  wake.position.y = .005; wake.renderOrder = 1; g.add(wake); return g; }
const RES_SCALE = 1.5;   // residents 1.5× (the brief's Animal-Crossing target)
function residentPlan(){
  const top = V.boxOf && V.boxOf.silo ? V.boxOf.silo.max.y : 1.5, tp = cellPos(2, 1);
  return {
    ship:{ at:SHIP_AT.clone(), from:SHIP_AT.clone().add(new THREE.Vector3(4.5, 0, -.6)) },
    parrot:{ at:new THREE.Vector3(tp.x + .05, top - .03, tp.z + .05), face:.8 },
    crabs:[[1.4, 6.2, .4], [4.6, 6.25, -.3], [6.25, 3.6, 1.2]].map(([x,z,f]) => ({ at:cellPos(x, z), face:f })),
    gulls:[0, 1, 2].map(i => ({ cx:.2, cz:-.2, r:2.1 + i*.45, h:2.2 + i*.28, sp:.32 + i*.05, ph:i*2.1 }))
  };
}
function gullPos(u, t, out){ const a = t*u.sp + u.ph; return out.set(u.cx + Math.cos(a)*u.r, TILE_TOP + u.h + Math.sin(a*2.3)*.1, u.cz + Math.sin(a)*u.r*.8); }
function addResident(kind, obj, u){ const r = { kind, obj, u, arrive:1 }; world.add(obj); (V.res || (V.res = [])).push(r); V.life.push(obj); return r; }
function moveResidents(t){
  (V && V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'ship') { r.obj.position.lerpVectors(u.from, u.at, e); r.obj.position.y = WATER_Y + Math.sin(t*1.3)*.02; r.obj.rotation.z = Math.sin(t*.9)*.03; }
    else if (r.kind === 'gull') { const p = gullPos(u, t, new THREE.Vector3()), q = gullPos(u, t + .05, new THREE.Vector3());
      if (e < 1) p.lerpVectors(p.clone().add(new THREE.Vector3(5, 2, -3)), p, e);
      r.obj.position.copy(p); r.obj.rotation.y = Math.atan2(q.x - p.x, q.z - p.z); r.obj.rotation.z = -.25;
      const f = Math.sin(t*6 + u.ph)*.5; r.obj.userData.wings[0].rotation.z = f; r.obj.userData.wings[1].rotation.z = -f; }
    else if (r.kind === 'crab') { const side = Math.sin(t*1.7 + u.ph)*.14, dx = Math.cos(u.face), dz = -Math.sin(u.face);
      r.obj.position.set(u.at.x + dx*side*e + (1 - e)*1.2, TILE_TOP, u.at.z + dz*side*e + (1 - e)*.8); r.obj.position.y = TILE_TOP + Math.abs(Math.sin(t*14 + u.ph))*.006; }
    else if (r.kind === 'parrot') { r.obj.position.copy(u.at).add(new THREE.Vector3((1 - e)*2.5, (1 - e)*1.5, (1 - e)*-1));
      r.obj.children[0].rotation.x = e < 1 ? 0 : Math.max(0, Math.sin(t*1.9))*.12; }
  });
  WUNI.uT.value = t; WUNI.uDim.value = S.night ? .42 : 1; FALL_TEX.offset.y = -t*.8;
}
function spawnGroup(i, plan){
  if (i === 0) { const o = makeShip(); o.scale.setScalar(1); o.rotation.y = 0; return [addResident('ship', o, plan.ship)]; }
  if (i === 1) { const o = makeParrot(); o.scale.setScalar(RES_SCALE); o.rotation.y = plan.parrot.face; return [addResident('parrot', o, plan.parrot)]; }
  if (i === 2) return plan.crabs.map((c, j) => { const o = makeCrab(); o.scale.setScalar(RES_SCALE*(1 - j*.08)); o.rotation.y = c.face; return addResident('crab', o, { ...c, ph:j*1.7 }); });
  return plan.gulls.map(u => { const o = makeGull(); o.scale.setScalar(RES_SCALE); return addResident('gull', o, u); });
}
async function pirateMoveIn(walk){
  const plan = residentPlan(); V.residentsIn = true; V.res = [];
  for (const p of plan.gulls) V.framePts.push(new THREE.Vector3(p.cx + p.r*.7, TILE_TOP + p.h, p.cz + p.r*.5));
  for (let i=0;i<4;i++){
    const rs = spawnGroup(i, plan);
    if (!walk) { rs.forEach(r => r.arrive = 1); continue; }
    rs.forEach(r => r.arrive = 0); moveResidents(U_T());
    await new Promise(res => tween(S.rm ? 1 : (i === 0 ? 2200 : 1300), t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.05))),
      () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(rs[0].obj.position.y + .5), 10, 0xFFF0B0, .6); res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = 4;
}
let _t = 0; const U_T = () => _t;

export default {
  id:'pirate', name:'Island', title:'Your island',
  season:5, dates:'27 Oct–9 Nov', nextIn:14,
  kits:['pirate'],
  kitDefs:{ pirate:{ file:'assets/pirate/pirate-kit.glb', stripSuffix:true } },
  families:{
    water:   { label:'pools & waterfalls',       tag:'Water' },
    building:{ label:'huts, towers & the jetty', tag:'Building' },
    path:    { label:'planks, cargo & torches',  tag:'Beach' },
    crop:    { label:'banana & pineapple beds',  tag:'Grove' },
    tree:    { label:'palm trees',               tag:'Palm' },
    special: { label:'the pearl chest',          tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:SAND_TILE, tileMap:sandTileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M3 18.5c3-1.6 6-1.6 9 0s6 1.6 9 0" fill="none" stroke="#2FB5C8" stroke-width="2" stroke-linecap="round"/><path d="M12 17c0-4 .5-7 2-9.5" fill="none" stroke="#9A6436" stroke-width="2" stroke-linecap="round"/><path d="M14 7.5c-2-1.8-5-1.6-6.5.2 2.2-.3 4 .2 6.5-.2zM14 7.5c1-2.3 3.8-3 5.8-1.8-2.2.3-3.8 1-5.8 1.8zM14 7.5c2.3-.5 4.8.6 5.5 2.8-1.8-1.1-3.4-1.8-5.5-2.8z" fill="#2FA36B"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M8 110c18-10 40-14 56-14s38 4 56 14v8H8z"/><path d="M60 98c0-24 4-44 14-60l6 3c-9 15-12 34-12 57z"/><path d="M77 40c-10-10-28-10-38 0 14-2 26 0 38 0zM77 40c4-14 20-20 34-14-14 2-24 6-34 14zM77 40c14-4 30 2 34 16-12-8-22-12-34-16zM77 40c-12 2-24 12-26 24 8-10 16-18 26-24z"/><circle cx="74" cy="46" r="4"/></g>',
  album:{ image:'assets/pirate/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E1F4F1)' },
  css:'.phone[data-theme="pirate"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#E8F6F2 58%,#CDEDE8 100%)}',

  build(g, s, opt){
    if (s.kind === 'bed') {             // Sudoku/Math → a tilled sand bed that grows like a crop field
      const slab = new THREE.Mesh(G.field, MAT.wetSand); slab.position.y = .035; slab.castShadow = slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab);
      const host = new THREE.Group(); host.scale.setScalar(1.25); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillBed(host, s, st);
      fillBed(host, s, opt.stage ?? cropStage(s.id));
    } else B[s.b](g, s);
  },
  scaleOf: s => s.kind === 'bed' ? 1.25 : 1,
  contact: s => s.kind === 'isle' && !['path','rope'].includes(s.b),
  nightLamp: s => s.cat==='building' || s.cat==='special' || (s.b === 'path' && (s.v === 3 || s.v === 4)),
  decor: islandDecor,
  env: buildEnv,
  ambient(){ addButterflies(); },
  tick(t, dt){ _t = t; flyButterflies(t); moveResidents(t); },

  residents:[ { id:'ship', name:'Pirate ship', n:1 }, { id:'parrot', name:'Parrot', n:1 }, { id:'crab', name:'Crabs', n:3 }, { id:'gull', name:'Seagulls', n:3 } ],
  moveIn: pirateMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('pirate:'+d.id, () => { const o = d.id === 'ship' ? makeShip() : d.id === 'parrot' ? makeParrot() : d.id === 'crab' ? makeCrab() : makeGull();
      if (d.id === 'ship') { o.children.at(-1).visible = false; o.rotation.y = -.5; } else o.rotation.y = d.id === 'gull' ? 2.4 : .7;
      return o; }, 168); },
  /* sprite export: a static rig per resident (no skeletal clips; the app animates them procedurally) */
  residentRig(d){ const obj = d.id === 'ship' ? makeShip() : d.id === 'parrot' ? makeParrot() : d.id === 'crab' ? makeCrab() : makeGull();
    if (d.id !== 'ship') obj.scale.setScalar(RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
