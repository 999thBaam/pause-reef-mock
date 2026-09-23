/* JUNGLE KINGDOM (?theme=jungle) — a lost banyan kingdom on the farm's 7×7 ring blueprint (same cells, same ring counts
   6 / 15 / 19, same order) except the hero: the giant banyan takes the LEFT corner (cells 0..1 × 5..6) so nothing stands in
   front of it, and the two farm slots it displaces move to the old peepal corner (as oasis and diwali do).
   Deep leaf-litter green ground; mossy grey-green stone. No CC0 kit has jungle ruins or Indian jungle animals, so the vine
   temple, ruined tower, tree house, huts, archway, lookout, waterfall, pools, bamboo, banana plants, rainforest trees, the
   restoring shrines and stupas (Sudoku/Math: vine-covered ruins restored stage by stage), the banyan, and the tiger, sloth
   bear, monkeys and peacocks are procedural three.js geometry merged per material (Acc). Reused CC0 kit pieces (no new asset
   files): palms = Quaternius "Palm Trees" (assets/dino/palms.glb), ferns / big-leaf plants / rocks / mushrooms = Quaternius
   Stylized Nature MegaKit (kit a). */
import * as THREE from 'three';
import { rngFrom, TEX, addSway, world } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, seg, blob, _up } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { addButterflies, flyButterflies } from '../engine/life.js';
import { FARM, FARM_ORDER } from './farm.js';

/* ── materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.88, metalness:0, flatShading:true, ...o });
function tigerTex(){
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(404);
  g.fillStyle = '#E98A2C'; g.fillRect(0,0,N,N);
  for (let i=0;i<11;i++){ const y0 = 8 + i*N/11.5; g.fillStyle = '#2A1C14'; g.beginPath();
    for (let x=0;x<=N;x+=4){ const y = y0 + Math.sin(x*.09 + i*1.3)*3 + (r()-.5)*1.5; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    for (let x=N;x>=0;x-=4){ const w = 2.2 + Math.max(0, Math.sin(x/N*Math.PI*4 + i))*3.2; g.lineTo(x, y0 + Math.sin(x*.09 + i*1.3)*3 + w); }
    g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function thatchTex(){
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(12);
  g.fillStyle = '#D2AE68'; g.fillRect(0,0,N,N);
  for (let i=0;i<140;i++){ g.strokeStyle = r() < .5 ? 'rgba(120,80,30,.35)' : 'rgba(255,240,200,.35)'; g.lineWidth = 1; const x = r()*N, y = r()*N;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r()-.5)*2, y + 6 + r()*6); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const MAT = {
  stone:FM(0xA8A58E), stoneL:FM(0xC6C0A6), stoneD:FM(0x85826C), stoneW:FM(0xD9D0B4), moss:FM(0x6E9F3E), mossD:FM(0x4F8032),
  vine:FM(0x3F7A2C), leaf:FM(0x4E8F34), leafL:FM(0x74AE44), leafD:FM(0x2F6A2A), dark:FM(0x2E2A24),
  wood:FM(0x7A5234), woodD:FM(0x5A3A22), trunk:FM(0x8A6A4C), trunkD:FM(0x6A5038), bark:FM(0x9A8468), rope:FM(0xC9AE78),
  bamboo:FM(0xA5B94E), bambooD:FM(0x7F9A36), bambooN:FM(0x6C8430),
  thatch:new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:1, map:thatchTex(), flatShading:true }),
  earth:FM(0x8E6A44, { roughness:1 }), floor:FM(0x7E9A5A, { roughness:1 }), earthL:FM(0xA88458, { roughness:1 }), mud:FM(0x6E5236, { roughness:1 }),
  water:new THREE.MeshStandardMaterial({ color:0x3FB7B0, roughness:.15, metalness:0, emissive:0x0B5A5E, emissiveIntensity:.35 }),
  fall:new THREE.MeshStandardMaterial({ color:0xCFF5F2, roughness:.2, transparent:true, opacity:.78, emissive:0x3FB7B0, emissiveIntensity:.3, depthWrite:false, side:THREE.DoubleSide }),
  foam:FM(0xF4FFFD, { roughness:.4 }),
  pad:FM(0x5E9E3A), lotus:FM(0xF49AB4), lotusD:FM(0xE56F94), lotusY:FM(0xF7D24A),
  hibiscus:FM(0xE8454A), marigold:FM(0xF59A2E), frang:FM(0xFFF6E6), frangY:FM(0xF7D24A), banana:FM(0xE9D24A), fig:FM(0xB8434A),
  red:FM(0xC8383A), saffron:FM(0xF2A23A), gold:FM(0xF1C24E, { emissive:0x6A4A00, emissiveIntensity:.25, roughness:.4, metalness:.3 }),
  flame:FM(0xFFC857, { emissive:0xFF8A1F, emissiveIntensity:1.7 }), clay:FM(0xC8703E),
  mush:FM(0xF2E6CC), mushR:FM(0xD95A3A),
  // residents
  tiger:new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.85, map:tigerTex(), flatShading:true }),
  orange:FM(0xE98A2C), white:FM(0xF8F2E6), black:FM(0x241C18), bear:FM(0x3E3430), bearL:FM(0xC9A986), pink:FM(0xE88A8A),
  monkey:FM(0xA87850), monkeyL:FM(0xE8C9A6), monkeyF:FM(0xE9B6A0), eye:FM(0x1E1A18),
  peaB:FM(0x1F5FB8), peaT:FM(0x2E8E86), peaG:FM(0x3F9A48), peaGold:FM(0xD9B640), peaEye:FM(0x1E3E8A), hen:FM(0x8A7258), henL:FM(0xD9CBB0), leg:FM(0x8A8478)
};
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = FM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }

const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=12){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z)); }
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }
function km(g, kit, name, h, w, x=0, y=0, z=0, rot=0){ const tpl = KITCACHE[kit] && KITCACHE[kit][name]; if (!tpl) return null;
  const k = fitScale(tpl, h, w), o = addModel(g, name, k, x, y, z, rot, kit); if (o) o.userData.top = y + tpl.size.y*k; return o; }
function leafGeo(len, w, arch){ const g = new THREE.PlaneGeometry(w, len, 1, 5).translate(0, len/2, 0), p = g.attributes.position;
  for (let i=0;i<p.count;i++){ const y = p.getY(i), t = y/len, ww = Math.sin(Math.PI*Math.min(1, t*1.05 + .05));
    p.setXYZ(i, p.getX(i)*ww, y*(1 - arch*t*.5), arch*t*t*len*.9); } g.computeVertexNormals(); return g; }

/* ── jungle dressing ── */
/* a hanging vine: a thin wavy strand with leaves, from p hanging down len */
function vine(acc, p, len, rng, mat=MAT.vine){
  const pts = []; for (let i=0;i<=5;i++){ const t = i/5; pts.push(V3(p.x + Math.sin(t*5 + p.x*9)*.02, p.y - t*len, p.z + Math.cos(t*4 + p.z*7)*.02)); }
  acc.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, .007, 4), mat);
  for (let i=1;i<=Math.round(len*18);i++){ const t = i/(len*18); const q = pts[0].clone().lerp(pts[5], t);
    blob(acc, rng() < .5 ? MAT.leaf : MAT.leafL, V3(q.x + (rng()-.5)*.03, q.y, q.z + (rng()-.5)*.03), .016 + rng()*.008, .55); }
}
/* moss cushion on a top surface */
function moss(acc, rng, x, y, z, r=.1){ blob(acc, rng() < .5 ? MAT.moss : MAT.mossD, V3(x, y, z), r, .28, 1, rng); }
/* hibiscus / frangipani sprig */
function flowerBush(acc, rng, x, z, s=1, y=0, kind=0){
  blob(acc, MAT.leafD, V3(x, y + .06*s, z), .09*s, .75, 1, rng); blob(acc, MAT.leaf, V3(x + .04*s, y + .09*s, z - .03*s), .06*s, .8, 1, rng);
  const fm = [MAT.hibiscus, MAT.frang, MAT.marigold][kind % 3];
  for (let i=0;i<5;i++){ const a = rng()*6.28, rr = .07*s; blob(acc, fm, V3(x + Math.cos(a)*rr, y + .1*s + rng()*.05*s, z + Math.sin(a)*rr), .02*s, .7);
    if (kind % 3 === 1) blob(acc, MAT.frangY, V3(x + Math.cos(a)*rr, y + .12*s + rng()*.04*s, z + Math.sin(a)*rr), .008*s); }
}
function fern(g, x, z, s=1, y=0, rot=0){ return km(g, 'a', 'Fern_1', .26*s, .4*s, x, y, z, rot); }
function bigLeaf(g, x, z, s=1, y=0, rot=0){ return km(g, 'a', 'Plant_1_Big', .3*s, .42*s, x, y, z, rot); }
/* rainforest canopy blob cluster on sway materials */
function canopy(acc, rng, c, r, n=6, h=1.2, cols=[0x4E8F34, 0x3E7E2E, 0x6AA742]){
  for (let i=0;i<n;i++){ const a = i/n*6.28 + rng()*.6, d = i ? r*(.45 + rng()*.25) : 0;
    const geo = new THREE.IcosahedronGeometry(r*(i ? .55 + rng()*.2 : .72), 1), p = geo.attributes.position;
    for (let k=0;k<p.count;k++){ const f = 1 + (rng()-.5)*.22; p.setXYZ(k, p.getX(k)*f, p.getY(k)*f, p.getZ(k)*f); }
    acc.add(geo, swayMat(cols[i % cols.length], h, .018), at(c.x + Math.cos(a)*d, c.y + (i ? (rng()-.3)*r*.35 : r*.18), c.z + Math.sin(a)*d, rng()*6, 1, .62, 1)); }
}
/* pool with a mossy stone rim and lotus */
function lotus(acc, x, y, z, s=1, open=true){
  acc.add(new THREE.CylinderGeometry(.06*s, .06*s, .008, 12, 1, false, .3, 5.6), MAT.pad, at(x - .03*s, y, z + .02*s));
  if (!open) return;
  for (let i=0;i<7;i++){ const a = i/7*6.28; acc.add(new THREE.ConeGeometry(.014*s, .045*s, 4), i%2 ? MAT.lotus : MAT.lotusD, at(x + Math.cos(a)*.016*s, y + .02*s, z + Math.sin(a)*.016*s, 0, 1, 1, 1, Math.sin(a)*.6, -Math.cos(a)*.6)); }
  blob(acc, MAT.lotusY, V3(x, y + .02*s, z), .01*s);
}
function pond(acc, g, rng, rx, rz, x=0, z=0, lotuses=4, rocks=6){
  acc.add(new THREE.CylinderGeometry(1, 1.04, .04, 26), MAT.mud, at(x, 0, z, 0, rx + .07, 1, rz + .07));
  acc.add(new THREE.CylinderGeometry(1, 1, .02, 26), MAT.water, at(x, .035, z, 0, rx, 1, rz));
  for (let i=0;i<lotuses;i++){ const a = rng()*6.28, d = .3 + rng()*.45; lotus(acc, x + Math.cos(a)*rx*d, .048, z + Math.sin(a)*rz*d, .9 + rng()*.4, i % 2 === 0); }
  for (let i=0;i<rocks;i++){ const a = i/rocks*6.28 + rng()*.5; blob(acc, i%2 ? MAT.stone : MAT.stoneD, V3(x + Math.cos(a)*(rx + .03), .03, z + Math.sin(a)*(rz + .03)), .045 + rng()*.03, .6, 0, rng);
    if (i%2 === 0) moss(acc, rng, x + Math.cos(a)*(rx + .03), .06, z + Math.sin(a)*(rz + .03), .035); }
}

/* ── trees ── */
function rainTree(g, s){
  const a = new Acc(), r = rngFrom(s.x*5 + s.z*13 + 1), h = s.h || 1.35, base = V3(0, 0, 0);
  seg(a, MAT.bark, base, V3(.04, 1, -.02), h*.62, .07, .045, 8);
  for (let i=0;i<5;i++){ const ang = i/5*6.28 + .3; acc3(a, ang); }
  function acc3(acc, ang){ const d = V3(Math.cos(ang), 0, Math.sin(ang)); acc.add(new THREE.ConeGeometry(.012, .16, 3).rotateZ(Math.PI/2).translate(.08, 0, 0).scale(1, 5, 1), MAT.bark, at(d.x*.04, .08, d.z*.04, -ang)); }
  const top = V3(.025, h*.62, -.012);
  seg(a, MAT.trunkD, top, V3(.7, .8, .1), .26, .035, .02, 6); seg(a, MAT.trunkD, top, V3(-.6, .9, -.3), .24, .03, .02, 6);
  canopy(a, r, V3(.02, h*.78, 0), .34, 7, h);
  for (let i=0;i<3;i++){ const ang = i*2.2 + .5; vine(a, V3(Math.cos(ang)*.26, h*.72, Math.sin(ang)*.26), .28 + r()*.2, r); }
  if (s.fig) for (let i=0;i<10;i++){ const ang = r()*6.28, rr = .2 + r()*.18; blob(a, MAT.fig, V3(Math.cos(ang)*rr, h*.7 + r()*.2, Math.sin(ang)*rr), .022); }
  flowerBush(a, r, .24, .22, .8, 0, s.fig ? 0 : 1); a.into(g); fern(g, -.26, .2, .8, 0, r()*6);
}
function bananaPlant(acc, rng, x, z, h, fruit){
  seg(acc, MAT.bambooD, V3(x, 0, z), _up, h, .035, .026, 7);
  const m = swayMat(0x7DBA4A, h + .2, .04), m2 = swayMat(0x5E9E3A, h + .2, .04), top = V3(x, h, z);
  for (let i=0;i<6;i++){ const ang = i/6*6.28 + rng()*.5;
    acc.add(leafGeo(.3 + rng()*.1, .13, .9), i%2 ? m : m2, new THREE.Matrix4().compose(top, new THREE.Quaternion().setFromEuler(new THREE.Euler(.5 + rng()*.3, ang, 0, 'YXZ')), V3(1,1,1))); }
  if (fruit) { seg(acc, MAT.bambooD, top.clone().add(V3(.02, -.02, .02)), V3(.3, -1, .3), .12, .008, .006, 4);
    for (let i=0;i<4;i++) for (let k=0;k<4;k++){ const aa = k/4*6.28 + i*.4; acc.add(new THREE.CapsuleGeometry(.01, .04, 2, 5), MAT.banana, at(x + .05 + Math.cos(aa)*.022, h - .06 - i*.028, z + .05 + Math.sin(aa)*.022, aa, 1, 1, 1, .5, 0)); }
    acc.add(new THREE.ConeGeometry(.02, .05, 6).rotateX(Math.PI), MAT.fig, at(x + .06, h - .18, z + .06)); }
}
function bananaGrove(g, s){ const a = new Acc(), r = rngFrom(s.x*9 + s.z*2 + 4);
  bananaPlant(a, r, -.1, -.08, .62, true); bananaPlant(a, r, .2, .14, .44, false); bananaPlant(a, r, -.22, .24, .34, false);
  a.into(g); fern(g, .26, -.24, .8); bigLeaf(g, .02, .3, .7, 0, 1); }
function bambooClump(g, s){ const a = new Acc(), r = rngFrom(s.x*3 + s.z*11 + 6);
  for (let i=0;i<9;i++){ const px = (r()-.5)*.36, pz = (r()-.5)*.36, h = .7 + r()*.55, d = V3((r()-.5)*.12, 1, (r()-.5)*.12).normalize();
    const segs = 5, sl = h/segs; let p = V3(px, 0, pz);
    for (let k=0;k<segs;k++){ seg(a, i%2 ? MAT.bamboo : MAT.bambooD, p, d, sl*.96, .022, .02, 7); p = p.clone().addScaledVector(d, sl); cyl(a, MAT.bambooN, .024, .024, .012, p.x, p.y - .006, p.z, 7); }
    const lm = swayMat(0x86B84A, h + .2, .05);
    for (let k=0;k<4;k++){ const ang = r()*6.28; a.add(leafGeo(.14, .035, .8), lm, new THREE.Matrix4().compose(p.clone().add(V3(0, -k*.08, 0)), new THREE.Quaternion().setFromEuler(new THREE.Euler(1.1, ang, 0, 'YXZ')), V3(1,1,1))); } }
  a.into(g); }
function palm(g, s){ km(g, 'dino', s.model, s.h || 1.35, s.w || 1.15, 0, 0, 0, (s.rot||0)*Math.PI/180);
  const a = new Acc(), r = rngFrom(s.x*3 + s.z*7); flowerBush(a, r, .22, .22, .8, 0, 0); a.into(g); fern(g, -.24, .18, .8, 0, 2); }

/* ── growing pieces (Sudoku / Math): vine-covered ruins, restored stage by stage ── */
function rubble(acc, rng, n, rad, y=.07){ for (let i=0;i<n;i++){ const a = rng()*6.28, d = rng()*rad;
  acc.add(bx(.1 + rng()*.06, .06, .08 + rng()*.05), rng() < .5 ? MAT.stone : MAT.stoneD, at(Math.cos(a)*d, y + .03, Math.sin(a)*d, rng()*3, 1, 1, 1, (rng()-.5)*.5, (rng()-.5)*.5)); } }
function overgrow(acc, rng, n, rad, y){ for (let i=0;i<n;i++){ const a = rng()*6.28, d = rng()*rad; moss(acc, rng, Math.cos(a)*d, y, Math.sin(a)*d, .05 + rng()*.04);
  for (let k=0;k<3;k++) blob(acc, rng() < .5 ? MAT.leaf : MAT.vine, V3(Math.cos(a)*d + (rng()-.5)*.08, y + .03 + rng()*.03, Math.sin(a)*d + (rng()-.5)*.08), .025, .6); } }
function fillShrine(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 3), Y = .07;
  if (stage === 1) { rubble(a, r, 9, .3); overgrow(a, r, 6, .3, Y + .04); a.into(host); host.userData.stage = stage; return; }
  slab(a, MAT.stoneD, .66, .06, .66, 0, Y); slab(a, MAT.stone, .58, .05, .58, 0, Y + .06);
  slab(a, MAT.stoneL, .16, .025, .07, 0, Y, .36); slab(a, MAT.stoneL, .16, .025, .05, 0, Y + .025, .33);
  const T = Y + .11;
  if (stage === 2) { rubble(a, r, 5, .28, T); for (const [x, z] of [[-.2,-.2],[.2,.2]]) cyl(a, MAT.stone, .04, .04, .12, x, T, z, 8); overgrow(a, r, 5, .28, T); }
  else {
    const PH = stage === 3 ? .2 : .28;
    for (const [x, z] of [[-.2,-.2],[.2,-.2],[.2,.2],[-.2,.2]]) { cyl(a, MAT.stoneW, .035, .03, PH, x, T, z, 8); slab(a, MAT.stoneL, .08, .025, .08, x, T + PH, z); }
    if (stage === 3) { rubble(a, r, 3, .2, T); overgrow(a, r, 4, .25, T); vine(a, V3(-.2, T + PH + .02, .2), .16, r); }
    else {
      slab(a, MAT.stoneL, .54, .04, .54, 0, T + PH + .02); const R = T + PH + .06;
      if (stage === 4) { rubble(a, r, 2, .15, R); vine(a, V3(.26, R, .26), .22, r); moss(a, r, -.1, R, -.1, .08); }
      else { for (let i=0;i<4;i++) slab(a, i%2 ? MAT.stone : MAT.stoneL, .44 - i*.1, .06, .44 - i*.1, 0, R + i*.06);
        cyl(a, MAT.gold, .03, .012, .08, 0, R + .24, 0, 8); blob(a, MAT.gold, V3(0, R + .33, 0), .02);
        // marigold garlands on the eaves, a lamp inside, flowers at the steps
        for (const [x, z] of [[-.2,.27],[.2,.27],[.27,-.2],[.27,.2]]) { const c = new THREE.CatmullRomCurve3([V3(x - (z > .26 ? 0 : 0), R - .02, z), V3(x*.5, R - .07, z > .26 ? z + .01 : z*.5), V3(0, R - .02, z > .26 ? z : 0)]);
          for (let k=0;k<=6;k++){ const p = c.getPoint(k/6); blob(a, k%2 ? MAT.marigold : MAT.saffron, p, .012); } }
        cyl(a, MAT.clay, .03, .02, .02, 0, T, 0, 8); a.add(new THREE.ConeGeometry(.012, .035, 6), MAT.flame, at(0, T + .035, 0)); glowSprite(host, V3(0, T + .05, 0), .3, 0xFFB050, .6);
        flowerBush(a, r, -.3, .3, .6, Y, 0); flowerBush(a, r, .3, .32, .55, Y, 1); }
    }
  }
  a.into(host); host.userData.stage = stage;
}
function fillStupa(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*17 + s.z*5 + 9), Y = .07;
  if (stage === 1) { blob(a, MAT.earth, V3(0, Y - .02, 0), .3, .35, 1, r); rubble(a, r, 6, .28, Y + .03); overgrow(a, r, 7, .25, Y + .08); a.into(host); host.userData.stage = stage; return; }
  cyl(a, MAT.stoneD, .36, .36, .05, 0, Y, 0, 16); cyl(a, MAT.stone, .3, .3, .06, 0, Y + .05, 0, 16);
  const B = Y + .11;
  if (stage === 2) { a.add(new THREE.SphereGeometry(.24, 14, 6, 0, 6.28, 0, .55), MAT.stoneL, at(0, B - .2, 0)); rubble(a, r, 4, .25, B); overgrow(a, r, 6, .26, B); }
  else {
    const full = stage >= 4;
    a.add(new THREE.SphereGeometry(.24, 16, 10, 0, 6.28, 0, full ? Math.PI/2 : 1.0), MAT.stoneW, at(0, B, 0, 0, 1, 1.05, 1));
    if (!full) { rubble(a, r, 3, .2, B + .16); overgrow(a, r, 4, .2, B + .12); vine(a, V3(.18, B + .14, .14), .14, r); }
    else {
      a.add(new THREE.TorusGeometry(.24, .012, 5, 24).rotateX(Math.PI/2), MAT.stoneL, at(0, B + .03, 0));
      slab(a, MAT.stoneL, .1, .06, .1, 0, B + .25);
      if (stage === 4) { moss(a, r, .12, B + .18, .1, .06); vine(a, V3(-.16, B + .17, .12), .14, r); }
      else { seg(a, MAT.stoneD, V3(0, B + .31, 0), _up, .16, .012, .01, 6);
        for (let i=0;i<3;i++) cyl(a, MAT.gold, .06 - i*.015, .06 - i*.015, .012, 0, B + .34 + i*.045, 0, 10);
        for (let i=0;i<4;i++){ const ang = i/4*6.28 + .78; cyl(a, MAT.clay, .022, .016, .02, Math.cos(ang)*.33, Y + .11, Math.sin(ang)*.33, 8);
          a.add(new THREE.ConeGeometry(.01, .03, 6), MAT.flame, at(Math.cos(ang)*.33, Y + .145, Math.sin(ang)*.33)); }
        glowSprite(host, V3(0, B + .1, .3), .35, 0xFFB050, .45);
        for (let k=0;k<14;k++){ const ang = k/14*6.28; blob(a, k%2 ? MAT.marigold : MAT.frang, V3(Math.cos(ang)*.245, B + .035, Math.sin(ang)*.245), .014); } }
    }
  }
  a.into(host); host.userData.stage = stage;
}

/* ── named pieces ── */
const TEMPLE = { tiers:[[1.5, .2], [1.16, .2], [.84, .2]], top:.6 };
function temple(g){
  const a = new Acc(), r = rngFrom(33); let y = 0;
  TEMPLE.tiers.forEach(([w, h], i) => { slab(a, i%2 ? MAT.stone : MAT.stoneL, w, h, w, 0, y); slab(a, MAT.stoneD, w + .04, .03, w + .04, 0, y + h - .03);
    // blind niches along each tier face
    for (let k=-1;k<=1;k++) if (k) { slab(a, MAT.stoneD, .12, h*.55, .02, k*w*.3, y + h*.2, w/2 + .005); slab(a, MAT.stoneD, .02, h*.55, .12, w/2 + .005, y + h*.2, k*w*.3); }
    y += h; });
  // front stairs (+z)
  for (let i=0;i<6;i++) slab(a, MAT.stoneL, .3, .1*(i + 1), .1, 0, 0, .8 - i*.1);
  // sanctum on top, with a corbelled tower
  const T = TEMPLE.top; slab(a, MAT.stoneW, .5, .3, .5, 0, T); slab(a, MAT.dark, .14, .2, .02, 0, T, .251);
  for (let i=0;i<5;i++) slab(a, i%2 ? MAT.stone : MAT.stoneW, .5 - i*.08, .08, .5 - i*.08, 0, T + .3 + i*.08);
  a.add(new THREE.SphereGeometry(.07, 10, 6), MAT.stoneL, at(0, T + .72, 0, 0, 1, .55, 1)); cyl(a, MAT.gold, .025, .01, .1, 0, T + .74, 0, 8);
  // overgrowth: moss on every tier, vines down the faces, a strangler fig root over one corner, a sapling on the top
  TEMPLE.tiers.forEach(([w], i) => { const yy = TEMPLE.tiers.slice(0, i + 1).reduce((s, t) => s + t[1], 0);
    moss(a, r, w/2 - .1, yy, -w/2 + .12, .1); moss(a, r, -w/2 + .12, yy, w/2 - .15, .08);
    vine(a, V3(-w/2 + .04, yy, w/2 + .01), .14 + r()*.06, r); vine(a, V3(w/2 + .01, yy, .1*(i - 1)), .12 + r()*.08, r); });
  const root = new THREE.CatmullRomCurve3([V3(-.45, .86, -.2), V3(-.62, .5, -.3), V3(-.78, .18, -.36), V3(-.86, 0, -.3)]);
  a.add(new THREE.TubeGeometry(root, 10, .035, 6), MAT.bark); a.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-.45, .86, -.2), V3(-.5, .5, .1), V3(-.7, .15, .3), V3(-.78, 0, .44)]), 10, .025, 6), MAT.bark);
  canopy(a, r, V3(-.42, 1.05, -.24), .2, 4, 1.3);
  // lamps at the stair foot
  for (const x of [-.24, .24]) { cyl(a, MAT.stone, .05, .04, .12, x, 0, .82, 8); cyl(a, MAT.clay, .04, .03, .03, x, .12, .82, 8); a.add(new THREE.ConeGeometry(.016, .05, 6), MAT.flame, at(x, .17, .82)); glowSprite(g, V3(x, .19, .82), .35, 0xFFA040, .55); }
  a.into(g); fern(g, .66, .7, .9); fern(g, -.6, .72, .8, 0, 2); bigLeaf(g, .7, -.55, .9);
}
function tower(g){
  const a = new Acc(), r = rngFrom(41);
  slab(a, MAT.stoneD, .62, .06, .62);
  const H = [.2, .18, .16, .12];
  let y = .06; H.forEach((h, i) => { cyl(a, i%2 ? MAT.stone : MAT.stoneL, .28 - i*.04, .26 - i*.04, h, 0, y, 0, 8); y += h; });
  slab(a, MAT.dark, .1, .16, .02, 0, .08, .27);
  // broken crown: uneven blocks
  for (let i=0;i<6;i++){ const ang = i/6*6.28; if (i === 2) continue; slab(a, MAT.stone, .08, .05 + (i%3)*.04, .06, Math.cos(ang)*.12, y, Math.sin(ang)*.12, -ang); }
  moss(a, r, 0, y, 0, .12); canopy(a, r, V3(.03, y + .12, 0), .12, 3, y + .2);
  vine(a, V3(.2, y - .02, .12), .4, r); vine(a, V3(-.16, y - .1, .18), .3, r); vine(a, V3(.23, .5, -.08), .25, r);
  a.into(g); fern(g, -.24, .22, .75);
}
function treeHouse(g){
  const a = new Acc(), r = rngFrom(51), P = .5;
  seg(a, MAT.bark, V3(-.12, 0, -.1), V3(.03, 1, 0), 1.0, .07, .05, 8);
  for (const [x, z] of [[.22,.18],[.2,-.2],[-.24,.2]]) seg(a, MAT.woodD, V3(x, 0, z), _up, P, .018, .016, 6);
  slab(a, MAT.wood, .6, .035, .56, 0, P, 0);
  for (const [x, z] of [[.29,.27],[-.29,.27],[.29,-.27]]) seg(a, MAT.woodD, V3(x, P, z), _up, .12, .01, .01, 4);
  slab(a, MAT.woodD, .6, .014, .014, 0, P + .12, .27); slab(a, MAT.woodD, .014, .014, .56, .29, P + .12, 0);
  // hut on the platform
  slab(a, MAT.bamboo, .32, .2, .28, .06, P + .035, -.04); slab(a, MAT.dark, .08, .13, .01, .1, P + .035, .101);
  a.add(new THREE.ConeGeometry(.3, .24, 4).rotateY(Math.PI/4), MAT.thatch, at(.06, P + .35, -.04, 0, 1, 1, .9));
  // rope ladder
  for (const x of [.12, .2]) seg(a, MAT.rope, V3(x, 0, .3), _up, P, .004, .004, 3);
  for (let i=1;i<6;i++) slab(a, MAT.wood, .1, .012, .02, .16, i*P/6, .3);
  canopy(a, r, V3(-.12, 1.02, -.12), .3, 6, 1.2); vine(a, V3(-.35, .95, .05), .3, r);
  cyl(a, MAT.clay, .025, .02, .04, .22, P + .035, .2, 8); a.add(new THREE.CylinderGeometry(.022, .018, .05, 6), MAT.flame, at(-.12, P + .2, .1)); glowSprite(g, V3(-.12, P + .2, .1), .28, 0xFFB050, .55);
  a.into(g); fern(g, .28, .32, .7);
}
function hut(g, s){
  const a = new Acc(), r = rngFrom(s.x*7 + s.z + 61), P = .14;
  for (const [x, z] of [[-.22,-.2],[.22,-.2],[.22,.2],[-.22,.2]]) seg(a, MAT.woodD, V3(x, 0, z), _up, P, .025, .022, 6);
  slab(a, MAT.wood, .58, .03, .54, 0, P);
  for (let i=0;i<9;i++) seg(a, i%2 ? MAT.bamboo : MAT.bambooD, V3(-.2 + i*.05, P + .03, -.18), _up, .26, .02, .02, 6);
  slab(a, MAT.bamboo, .02, .26, .38, -.2, P + .03, 0); slab(a, MAT.bamboo, .02, .26, .38, .2, P + .03, 0);
  slab(a, MAT.bambooD, .4, .26, .02, 0, P + .03, .18); slab(a, MAT.dark, .12, .18, .01, -.06, P + .03, .192); slab(a, MAT.dark, .08, .07, .01, .12, P + .15, .192);
  a.add(new THREE.ConeGeometry(.42, .36, 4).rotateY(Math.PI/4), MAT.thatch, at(0, P + .44, 0, 0, 1, 1, .95));
  cyl(a, MAT.thatch, .05, .01, .1, 0, P + .6, 0, 6);
  for (let i=0;i<3;i++) slab(a, MAT.wood, .16, .02, .06, -.06, P*i/3, .3 - i*.04);
  cyl(a, MAT.clay, .045, .05, .07, .26, 0, .3, 10); cyl(a, MAT.clay, .03, .035, .05, .32, 0, .22, 10);
  a.add(new THREE.CylinderGeometry(.02, .016, .045, 6), MAT.flame, at(.12, P + .23, .22)); glowSprite(g, V3(.12, P + .24, .22), .26, 0xFFB050, .5);
  flowerBush(a, r, -.3, .3, .7, 0, 0); a.into(g);
}
function archway(g){
  const a = new Acc(), r = rngFrom(71);
  slab(a, MAT.stoneD, .74, .04, .3);
  for (const x of [-.26, .26]) { slab(a, MAT.stone, .16, .5, .2, x, .04); slab(a, MAT.stoneL, .2, .04, .24, x, .54); }
  const arc = new THREE.TorusGeometry(.26, .06, 6, 12, Math.PI); a.add(arc, MAT.stoneL, at(0, .56, 0, 0, 1, .9, 1.6));
  slab(a, MAT.stoneW, .12, .1, .16, 0, .74); slab(a, MAT.stone, .6, .05, .2, 0, .84); cyl(a, MAT.gold, .02, .008, .07, 0, .89, 0, 6);
  moss(a, r, -.2, .88, 0, .1); moss(a, r, .26, .58, .02, .08);
  vine(a, V3(-.1, .86, .1), .4, r); vine(a, V3(.2, .84, .1), .3, r); vine(a, V3(.34, .56, .1), .4, r);
  rubble(a, r, 3, .08, .04); a.into(g);
  fern(g, -.3, .26, .75); fern(g, .32, -.24, .7, 0, 2);
}
function lookout(g){
  const a = new Acc(), r = rngFrom(81), P = .72;
  for (const [x, z] of [[-.2,-.2],[.2,-.2],[.2,.2],[-.2,.2]]) seg(a, MAT.bambooD, V3(x, 0, z), V3(-x*.2, 1, -z*.2).normalize(), P + .02, .025, .022, 6);
  for (const yy of [.24, .5]) for (const [x0, z0, x1, z1] of [[-.2,.2,.2,.2],[.2,-.2,.2,.2]]) { const p0 = V3(x0*(1 - yy*.3), yy, z0*(1 - yy*.3)), p1 = V3(x1*(1 - yy*.3), yy, z1*(1 - yy*.3));
    seg(a, MAT.bamboo, p0, p1.clone().sub(p0), p0.distanceTo(p1), .012, .012, 5); }
  slab(a, MAT.wood, .4, .03, .4, 0, P);
  for (const [x, z] of [[-.18,-.18],[.18,-.18],[.18,.18],[-.18,.18]]) seg(a, MAT.bamboo, V3(x, P, z), _up, .26, .012, .012, 5);
  slab(a, MAT.bamboo, .38, .014, .014, 0, P + .12, .18); slab(a, MAT.bamboo, .014, .014, .38, .18, P + .12, 0);
  a.add(new THREE.ConeGeometry(.34, .2, 4).rotateY(Math.PI/4), MAT.thatch, at(0, P + .36, 0));
  for (const x of [.08, .15]) seg(a, MAT.bambooD, V3(x, 0, .34), V3(0, 1, -.17).normalize(), P + .04, .01, .01, 4);
  for (let i=1;i<7;i++) slab(a, MAT.bamboo, .09, .012, .015, .115, i*P/7, .34 - i*P/7*.17);
  a.add(new THREE.CylinderGeometry(.022, .018, .05, 6), MAT.flame, at(0, P + .2, 0)); glowSprite(g, V3(0, P + .2, 0), .3, 0xFFB050, .5);
  a.into(g); fern(g, -.28, .28, .75); bigLeaf(g, .3, -.28, .7);
}
/* water */
function lilyPool(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 2);
  cyl(a, MAT.stoneD, .4, .42, .08, 0, 0, 0, 10); cyl(a, MAT.stoneL, .38, .38, .03, 0, .08, 0, 10); cyl(a, MAT.water, .32, .32, .02, 0, .085, 0, 20);
  for (let i=0;i<4;i++){ const ang = i*1.7 + .4; lotus(a, Math.cos(ang)*.18, .107, Math.sin(ang)*.17, 1.1, i%2 === 0); }
  moss(a, r, -.3, .1, -.22, .07); moss(a, r, .3, .1, .2, .06); a.into(g); fern(g, -.36, .3, .7); bigLeaf(g, .38, -.3, .65, 0, 2); }
function waterfall(g){
  const a = new Acc(), r = rngFrom(91);
  pond(a, g, r, .3, .22, .04, .18, 3, 0);
  // rock cliff at the back
  const rocks = [[-.24, .2, -.22, .24], [.12, .28, -.24, .26], [-.02, .52, -.28, .2], [.26, .46, -.2, .16], [-.28, .42, -.12, .16], [.0, .7, -.3, .15]];
  rocks.forEach(([x, y, z, rr], i) => blob(a, i%2 ? MAT.stone : MAT.stoneD, V3(x, y*.9, z), rr, 1.1, 1, r));
  for (let i=0;i<4;i++) moss(a, r, -.25 + i*.16, .5 + (i%2)*.2, -.2, .07);
  // the fall: a curved sheet from the lip into the pool, foam at the foot
  const sheet = new THREE.PlaneGeometry(.14, .62, 1, 6), p = sheet.attributes.position;
  for (let i=0;i<p.count;i++){ const t = (p.getY(i) + .31)/.62; p.setZ(i, Math.pow(1 - t, 2)*.12 - .02); } sheet.computeVertexNormals();
  a.add(sheet, MAT.fall, at(.04, .4, -.02)); slab(a, MAT.fall, .14, .01, .06, .04, .7, -.08);
  for (let i=0;i<6;i++) blob(a, MAT.foam, V3(.04 + (r()-.5)*.16, .07, .1 + (r()-.5)*.08), .03 + r()*.02, .5);
  a.into(g); fern(g, -.34, .3, .8); fern(g, .36, -.02, .7, 0, 2); bigLeaf(g, .38, .34, .6);
}
function spout(g){
  const a = new Acc(), r = rngFrom(97);
  cyl(a, MAT.stoneD, .26, .28, .12, 0, 0, .06, 10); cyl(a, MAT.water, .22, .22, .01, 0, .1, .06, 14); lotus(a, .06, .115, .1, .9);
  for (const x of [-.22, -.12]) seg(a, MAT.bambooD, V3(x, 0, -.26), _up, .38, .016, .014, 5);
  seg(a, MAT.bamboo, V3(-.3, .36, -.26), V3(1, -.15, .9).normalize(), .42, .022, .02, 7);
  a.add(new THREE.CylinderGeometry(.008, .008, .23, 5), MAT.fall, at(.02, .22, .05));
  for (let i=0;i<3;i++) blob(a, MAT.foam, V3(.02 + (r()-.5)*.05, .11, .05 + (r()-.5)*.05), .018, .5);
  for (let i=0;i<5;i++){ const ang = i/5*6.28; blob(a, MAT.stone, V3(Math.cos(ang)*.3, .03, .06 + Math.sin(ang)*.3), .04, .6, 0, r); }
  a.into(g); fern(g, .3, -.26, .7); flowerBushG(g, r, -.3, .3);
}
function flowerBushG(g, r, x, z){ const a = new Acc(); flowerBush(a, r, x, z, .8, 0, 0); a.into(g); }
function lotusPond(g){ const a = new Acc(), r = rngFrom(111); pond(a, g, r, .4, .36, 0, 0, 7, 7);
  for (const [x, z] of [[-.34,-.3],[.36,-.26]]) for (let i=0;i<6;i++){ const L = .18 + r()*.12, d = V3((r()-.5)*.3, 1, (r()-.5)*.3).normalize(); seg(a, swayMat(0x6FA646, .3, .06), V3(x + (r()-.5)*.08, 0, z + (r()-.5)*.08), d, L, .01, .003, 4); }
  a.into(g); }
/* To-dos: paths and small props */
function path(g, s){
  const sl = new THREE.Mesh(G.path, MAT.earthL); sl.position.y = .0175; sl.receiveShadow = true; sl.userData.ghostHide = true; g.add(sl);
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0; g.userData.ghostMode = 'marker';
  if (v === 0) { [[-.22,-.24],[.14,-.18],[-.14,.14],[.2,.24]].forEach(([x, z]) => { a.add(new THREE.CylinderGeometry(.12, .13, .035, 9), r() < .5 ? MAT.stone : MAT.stoneL, at(x + (r()-.5)*.04, .05, z + (r()-.5)*.04, r()*3)); moss(a, r, x + .06, .065, z - .04, .03); }); }
  else if (v === 1) { a.add(new THREE.CylinderGeometry(.09, .1, .74, 10).rotateZ(Math.PI/2), MAT.bark, at(0, .12, 0, .5)); a.add(new THREE.CylinderGeometry(.075, .075, .01, 10), MAT.earthL, at(.33, .12, -.18, .5, 1, 1, 1, 0, Math.PI/2));
    moss(a, r, -.1, .2, .05, .07); for (const [x, z] of [[.1, -.02], [-.02, .06]]) { cyl(a, MAT.mush, .012, .012, .04, x, .18, z, 6); a.add(new THREE.SphereGeometry(.035, 8, 5, 0, 6.28, 0, 1.4), MAT.mushR, at(x, .21, z)); }
    for (let i=0;i<4;i++) blob(a, MAT.leafL, V3(-.25 + i*.06, .12 + (i%2)*.06, .1), .025, .5); }
  else if (v === 2) { cyl(a, MAT.stoneD, .1, .1, .05, 0, .035, 0, 8); cyl(a, MAT.stone, .035, .04, .22, 0, .085, 0, 8); slab(a, MAT.stoneL, .14, .1, .14, 0, .3);
    slab(a, MAT.flame, .06, .06, .145, 0, .32); a.add(new THREE.ConeGeometry(.12, .1, 4).rotateY(Math.PI/4), MAT.stone, at(0, .45, 0)); blob(a, MAT.stoneL, V3(0, .51, 0), .025);
    glowSprite(g, V3(0, .35, 0), .35, 0xFFB050, .5); moss(a, r, .05, .5, 0, .05); [[-.26, .24], [.26, -.22]].forEach(([x, z]) => blob(a, MAT.stone, V3(x, .06, z), .06, .6, 0, r)); }
  else if (v === 3) { a.into(g); fern(g, -.2, -.1, 1.1); fern(g, .2, .12, 1, 0, 2); km(g, 'a', 'Mushroom_Laetiporus', .12, .18, .22, .035, -.24); const b = new Acc(); flowerBush(b, r, -.1, .28, .7, .035, 1); b.into(g); return; }
  else if (v === 4) { const p0 = V3(-.34, .035, -.3), p1 = V3(.34, .035, .3);
    for (const [x, z] of [[-.3,-.3],[.3,.3]]) { seg(a, MAT.bark, V3(x, .035, z), _up, .62, .04, .03, 7); canopy(a, r, V3(x, .7, z), .12, 3, .8); }
    const c = new THREE.CatmullRomCurve3([V3(-.3, .6, -.3), V3(0, .35, 0), V3(.3, .6, .3)]); a.add(new THREE.TubeGeometry(c, 12, .008, 4), MAT.vine);
    for (let i=1;i<10;i++){ const p = c.getPoint(i/10); blob(a, i%2 ? MAT.leaf : MAT.leafL, p.add(V3(0, -.01, 0)), .02, .6); } void p0; void p1; }
  else { for (let i=0;i<4;i++) slab(a, i%2 ? MAT.stone : MAT.stoneL, .5, .04, .16, 0, .035 + i*.04, .24 - i*.16);
    moss(a, r, .2, .2, -.24, .05); moss(a, r, -.22, .08, .2, .04); rubble(a, r, 2, .3, .035); vine(a, V3(-.25, .2, -.3), .12, r); }
  a.into(g);
}
function bambooFence(g, s){
  const a = new Acc(), L = s.len;
  const run = (u, len) => s.edge === 'w' ? [ -.45, u, 0, len ] : [ u, .45, Math.PI/2, len ];
  for (let i=0;i<L;i++){ const [x, z, ry, len] = run(i - (L-1)/2, .96);
    for (const y of [.12, .24]) a.add(new THREE.CylinderGeometry(.013, .013, len, 6).rotateX(Math.PI/2), MAT.bamboo, at(x, y, z, ry)); }
  for (let i=0;i<=L*3;i++){ const [x, z] = run(i/3 - L/2, 0), h = i%3 ? .26 : .34; seg(a, i%3 ? MAT.bamboo : MAT.bambooD, V3(x, 0, z), _up, h, .02, .018, 6); if (!(i%3)) cyl(a, MAT.bambooN, .022, .022, .01, x, h - .005, z, 6); }
  const r = rngFrom(s.x*3 + s.z*5 + 1); for (let i=0;i<L;i++){ const [x, z] = run(i - (L-1)/2 + (r()-.5)*.4, 0); vine(a, V3(x, .26, z), .18, r); }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}

/* ── the hero (Gita): a giant banyan on a stone chabutra, aerial roots dropping from every limb, a swing ── */
const BANYAN = { limbs:[[.3, .9], [1.9, .82], [3.1, .86], [4.3, .8], [5.3, .88]], Y:1.02 };   // [angle, reach]
function banyan(g){
  const a = new Acc(), r = rngFrom(5), Y = BANYAN.Y;
  blob(a, MAT.earth, V3(0, -.1, 0), .98, .2, 2, r);
  cyl(a, MAT.stoneD, .5, .52, .1, 0, 0, 0, 12); cyl(a, MAT.stoneL, .46, .46, .06, 0, .1, 0, 12);
  for (let i=0;i<3;i++) slab(a, MAT.stoneL, .26, .05, .1, .52 + i*.06, 0, .52 + i*.06, Math.PI/4);
  // the trunk: a braid of stems
  for (let i=0;i<6;i++){ const ang = i/6*6.28, bx0 = Math.cos(ang)*.12, bz0 = Math.sin(ang)*.12;
    const c = new THREE.CatmullRomCurve3([V3(bx0*1.5, .16, bz0*1.5), V3(bx0, .45, bz0), V3(bx0*.6 + Math.cos(ang + 1)*.04, .75, bz0*.6 + Math.sin(ang + 1)*.04), V3(bx0*.8, Y, bz0*.8)]);
    a.add(new THREE.TubeGeometry(c, 10, .07, 7), i%2 ? MAT.bark : MAT.trunk); }
  // sacred threads on the trunk
  for (const [y, m] of [[.42, MAT.red], [.47, MAT.saffron], [.52, MAT.red]]) a.add(new THREE.TorusGeometry(.2, .01, 5, 18).rotateX(Math.PI/2), m, at(0, y, 0));
  // limbs, aerial roots, canopy
  BANYAN.limbs.forEach(([ang, reach], i) => {
    const d = V3(Math.cos(ang), 0, Math.sin(ang)), tip = V3(d.x*reach, Y + .12 + (i%2)*.06, d.z*reach);
    const c = new THREE.CatmullRomCurve3([V3(0, Y - .1, 0), V3(d.x*reach*.4, Y + .06, d.z*reach*.4), tip]); a.add(new THREE.TubeGeometry(c, 10, .05, 7), MAT.bark);
    for (const t of [.45, .72, .95]) { const p = c.getPoint(t), len = p.y + .02;
      seg(a, MAT.trunkD, V3(p.x, 0, p.z), _up, len, .02 + (t < .6 ? .012 : 0), .012, 5); blob(a, MAT.trunkD, V3(p.x, .02, p.z), .035, .4); }
    for (let k=0;k<3;k++){ const p = c.getPoint(.3 + k*.3); vine(a, V3(p.x + .06, p.y - .04, p.z + .06), .18 + r()*.2, r, MAT.trunkD); }
    canopy(a, r, V3(tip.x*.85, tip.y + .2, tip.z*.85), .42, 5, 1.9, [0x3E7E2E, 0x4E8F34, 0x2F6A2A]);
  });
  canopy(a, r, V3(0, Y + .5, 0), .55, 6, 1.9, [0x4E8F34, 0x3E7E2E, 0x5E9E3A]);
  // a swing from the front limb
  const sw = V3(Math.cos(.3)*.62, Y + .06, Math.sin(.3)*.62 + .12);
  for (const dz of [-.07, .07]) seg(a, MAT.rope, V3(sw.x - .04, .3, sw.z + dz), _up, Y - .24, .004, .004, 3);
  slab(a, MAT.wood, .08, .02, .2, sw.x - .04, .28, sw.z);
  // diyas and flowers on the platform
  for (let i=0;i<5;i++){ const ang = .2 + i*.35; const x = Math.cos(ang)*.38, z = Math.sin(ang)*.38;
    cyl(a, MAT.clay, .025, .018, .02, x, .16, z, 8); a.add(new THREE.ConeGeometry(.01, .03, 6), MAT.flame, at(x, .195, z)); }
  for (let k=0;k<10;k++){ const ang = -.5 + k*.22; blob(a, k%2 ? MAT.marigold : MAT.hibiscus, V3(Math.cos(ang)*.3, .17, Math.sin(ang)*.3), .018); }
  a.into(g);
  glowSprite(g, V3(.3, .25, .3), .8, 0xFFB050, .45); glowSprite(g, V3(0, 1.5, 0), 2.2, 0xFFF0B0, .16);
  fern(g, -.72, .6, .9); fern(g, .75, -.62, .85, 0, 2); bigLeaf(g, .8, .5, .8);
}

/* ── blueprint: the farm's cells with jungle pieces; the banyan takes the left corner ── */
const MAP = {
  bigbarn:{ name:'Vine temple', b:'temple' }, well:{ name:'Lily pool', b:'lily' }, apple1:{ name:'Rainforest tree', b:'rain', h:1.4 },
  silo:{ name:'Ruined tower', b:'tower' }, silohouse:{ name:'Tree house', b:'treehouse' }, coop:{ name:'Thatched hut', b:'hut' },
  watertower:{ name:'Waterfall', b:'fall' }, pump:{ name:'Bamboo spout', b:'spout' }, apple2:{ name:'Fig tree', b:'rain', h:1.15, fig:true },
  berry1:{ name:'Banana grove', b:'banana' }, peepal:{ name:'Giant banyan', b:'hero' },
  smallbarn:{ name:'Stone archway', b:'arch' }, openbarn:{ name:'Bamboo lookout', b:'lookout' },
  pond:{ name:'Lotus pond', b:'lotus' }, orange1:{ name:'Palm', b:'palm', model:'PalmTree_3', rot:20, h:1.35 },
  apple3:{ name:'Bamboo clump', b:'bamboo' }, berry2:{ name:'Banana grove', b:'banana' },
  orange2:{ name:'Rainforest tree', b:'rain', h:1.3 }, apple4:{ name:'Palm', b:'palm', model:'PalmTree_4', rot:200, h:1.45 }
};
const MOVE = { peepal:{ x:0, z:5 }, field1_5:{ x:1, z:1 }, fence3:{ x:0, z:0, edge:'w' } };   // hero to the left corner
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:5, path2_6:3, path3_6:4 };
const PATH_NAME = ['Stepping stones', 'Mossy log', 'Stone lantern', 'Fern hollow', 'Vine swing', 'Old steps'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d, ...(MOVE[f.id] || {}) };
  if (f.kind === 'field') { const shrine = f.crop === 'Corn' || f.crop === 'Beet';
    return shrine ? { ...s, kind:'shrine', name:'Overgrown shrine', stages:5 } : { ...s, kind:'stupa', name:'Fallen stupa', stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'jungle', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'jungle', b:'fence', edge:s.edge || f.edge, len:f.len, name:'Bamboo fence' };
  return { ...s, kind:'jungle', ...MAP[f.id] };
});
const BUILD = { temple, tower, treehouse:treeHouse, hut, arch:archway, lookout, lily:lilyPool, fall:waterfall, spout, lotus:lotusPond,
  rain:rainTree, banana:bananaGrove, bamboo:bambooClump, palm, path, fence:bambooFence, hero:banyan };

/* ── the ground: deep jungle green with leaf litter on a dark earth block ── */
const TILE = { top:['#6BA64A', '#64A045'], side:'#5C9A3F', soilTop:'#7A5230', soilBot:'#46301C' };
function tileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(61);
  g.fillStyle = '#FFFFFF'; g.fillRect(0,0,N,N);
  for (let i=0;i<70;i++){ const x = r()*N, y = r()*N, s = 3 + r()*5, a = r()*6.28;
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = r() < .6 ? 'rgba(40,80,20,.16)' : 'rgba(255,245,200,.22)';
    g.beginPath(); g.ellipse(0, 0, s, s*.45, 0, 0, 6.28); g.fill(); g.restore(); }
  for (let i=0;i<220;i++){ g.fillStyle = r() < .5 ? 'rgba(255,255,230,.35)' : 'rgba(30,70,20,.14)'; g.beginPath(); g.arc(r()*N, r()*N, .6 + r()*1.3, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/* decor: ferns, big-leaf plants, mushrooms and flowers on empty cells; a hint on waiting cells */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    const grass = (px, pz, k=1) => km(grp, 'a', r() < .5 ? 'Grass_Wispy_Tall' : 'Grass_Common_Tall', .16*k, .25*k, px, p.y, pz, r()*6);
    if (!sl || sl === 'later') {
      fern(grp, p.x - .18, p.z - .16, .9 + r()*.3, p.y, r()*6); bigLeaf(grp, p.x + .22, p.z + .1, .8 + r()*.3, p.y, r()*6);
      if (r() < .5) km(grp, 'a', 'Mushroom_Common', .08, .12, p.x - .26, p.y, p.z + .28, r()*6); else km(grp, 'a', 'Rock_Medium_2', .08, .16, p.x - .26, p.y, p.z + .26, r()*6);
      flowerBush(a, r, p.x + .1, p.z - .3, .6, p.y, Math.floor(r()*3)); if (AMBIENT()) grass(p.x - .3, p.z - .02, .8);
      grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { grass(p.x + .3, p.z + .3, .8); if (r() < .6) fern(grp, p.x - .3, p.z + .28, .6, p.y, r()*6); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if ((Math.abs(x-3) === V.ring && x > 3) || (Math.abs(z-3) === V.ring && z > 3)) { grass(p.x + .38, p.z + .38, .7); grp.userData.decor = 'rim'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ── ambient: butterflies by day, fireflies by night (banyan canopy + bamboo leaves sway via the sway shader) ── */
function addAmbient(){
  addButterflies();
  V.flies = []; const r = rngFrom(88), R = V.L/2;
  for (let i=0;i<18;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xE8FF8A, transparent:true, opacity:.9, blending:THREE.AdditiveBlending, depthWrite:false }));
    s.scale.setScalar(.07 + r()*.05); s.userData.u = { x:(r()*2 - 1)*R, z:(r()*2 - 1)*R, y:.2 + r()*.9, ph:r()*6, sp:.3 + r()*.4 }; s.renderOrder = 9;
    world.add(s); V.flies.push(s); V.life.push(s); }
  moveAmbient(2.1);
}
function moveAmbient(t){
  if (!V) return; flyButterflies(t); (V.butterflies || []).forEach(b => b.visible = !S.night);
  (V.flies || []).forEach(s => { const u = s.userData.u; s.visible = S.night;
    s.position.set(u.x + Math.sin(t*u.sp + u.ph)*.25, TILE_TOP + u.y + Math.sin(t*1.3 + u.ph)*.08, u.z + Math.cos(t*u.sp*.8 + u.ph)*.25);
    s.material.opacity = .45 + .45*Math.max(0, Math.sin(t*2.2 + u.ph*3)); });
}

/* ── residents: a tiger and a sloth bear pad in, monkeys drop onto the temple and the banyan, peacocks strut to the front ── */
const RES_SCALE = 1.5;
function legRig(g, acc, pts, mat, paw, len, r0){
  acc.into(g); const legs = [];
  for (const [x, y, z] of pts) { const L = new THREE.Group(), la = new Acc(); L.position.set(x, y, z);
    seg(la, mat, V3(0, 0, 0), V3(0, -1, 0), len, r0, r0*.85, 7); blob(la, paw, V3(0, -len, .01), r0*1.05, .6); la.into(L); g.add(L); legs.push(L); }
  g.userData.legs = legs; return g;
}
function makeTiger(){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.1, 14, 10), MAT.tiger, at(0, .22, 0, 0, 1, 2.1, .85, Math.PI/2));
  a.add(new THREE.SphereGeometry(.08, 10, 8), MAT.white, at(0, .18, .02, 0, .8, .5, 1.9));
  // head
  a.add(new THREE.SphereGeometry(.085, 12, 10), MAT.tiger, at(0, .28, .22, 0, 1.05, .95, 1, .3));
  blob(a, MAT.white, V3(0, .255, .29), .045, .75); blob(a, MAT.white, V3(-.035, .245, .28), .035, .7); blob(a, MAT.white, V3(.035, .245, .28), .035, .7);
  blob(a, MAT.pink, V3(0, .275, .318), .014, .7);
  for (const sx of [-1, 1]) { blob(a, MAT.eye, V3(sx*.035, .305, .29), .011); blob(a, MAT.white, V3(sx*.052, .3, .27), .016, .8);
    a.add(new THREE.SphereGeometry(.03, 8, 6), MAT.orange, at(sx*.06, .355, .2, 0, 1, 1, .5)); blob(a, MAT.white, V3(sx*.06, .355, .213), .016, 1); }
  const tail = new THREE.CatmullRomCurve3([V3(0, .25, -.2), V3(0, .2, -.3), V3(.03, .26, -.38), V3(.02, .33, -.4)]);
  a.add(new THREE.TubeGeometry(tail, 10, .016, 6), MAT.orange); blob(a, MAT.black, V3(.02, .335, -.4), .02, 1.2);
  return legRig(g, a, [[-.055, .17, .12], [.055, .17, .12], [-.055, .17, -.12], [.055, .17, -.12]], MAT.orange, MAT.white, .15, .028);
}
function makeBear(){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.12, 14, 10), MAT.bear, at(0, .21, 0, 0, 1, 1, 1.45));
  blob(a, MAT.bear, V3(0, .27, .06), .1, .9, 1);
  a.add(new THREE.SphereGeometry(.08, 12, 9), MAT.bear, at(0, .26, .2));
  a.add(new THREE.SphereGeometry(.045, 10, 8), MAT.bearL, at(0, .24, .27, 0, .9, .8, 1.3)); blob(a, MAT.black, V3(0, .25, .325), .017);
  for (const sx of [-1, 1]) { blob(a, MAT.eye, V3(sx*.032, .285, .265), .01); blob(a, MAT.bear, V3(sx*.06, .33, .19), .03, .9); blob(a, MAT.bearL, V3(sx*.06, .33, .2), .014, .9); }
  a.add(new THREE.ConeGeometry(.05, .06, 3).rotateX(Math.PI), MAT.frang, at(0, .23, .155, 0, 1.2, 1, .25, -.2));   // the sloth bear's pale V
  return legRig(g, a, [[-.065, .13, .1], [.065, .13, .1], [-.065, .13, -.1], [.065, .13, -.1]], MAT.bear, MAT.bear, .12, .04);
}
function makeMonkey(v=0){
  const g = new THREE.Group(), a = new Acc(), fur = MAT.monkey;
  blob(a, fur, V3(0, .08, 0), .06, 1.2, 1); blob(a, MAT.monkeyL, V3(0, .075, .03), .04, 1.1);
  a.add(new THREE.SphereGeometry(.05, 12, 9), fur, at(0, .17, .01));
  a.add(new THREE.SphereGeometry(.036, 10, 8), MAT.monkeyF, at(0, .165, .04, 0, 1, .9, .7));
  for (const sx of [-1, 1]) { blob(a, MAT.eye, V3(sx*.015, .178, .064), .007); blob(a, MAT.monkeyF, V3(sx*.05, .18, 0), .016, 1); }
  blob(a, MAT.eye, V3(0, .157, .068), .005);
  // arms hugging knees, legs folded, a long curled tail
  for (const sx of [-1, 1]) { seg(a, fur, V3(sx*.045, .12, .01), V3(-sx*.2, -.6, 1).normalize(), .08, .014, .012, 5); blob(a, fur, V3(sx*.035, .04, .06), .026, .8); }
  const tail = new THREE.CatmullRomCurve3([V3(0, .04, -.05), V3(.02, .01, -.14), V3(.1, .02, -.17), V3(.12, .08, -.12), V3(.08, .1, -.09)]);
  a.add(new THREE.TubeGeometry(tail, 12, .01, 5), fur);
  if (v) { const b = new THREE.Group(); void b; blob(a, MAT.banana, V3(.03, .1, .08), .018, 1.8); }
  a.into(g); return g;
}
function makePeacock(fan=true){
  const g = new THREE.Group(), a = new Acc(), body = fan ? MAT.peaB : MAT.hen;
  a.add(new THREE.SphereGeometry(.055, 12, 9), body, at(0, .14, 0, 0, .85, .9, 1.35, -.2));
  const neck = new THREE.CatmullRomCurve3([V3(0, .16, .04), V3(0, .21, .06), V3(0, .26, .06)]); a.add(new THREE.TubeGeometry(neck, 8, .017, 6), fan ? MAT.peaB : MAT.hen);
  blob(a, fan ? MAT.peaB : MAT.hen, V3(0, .27, .065), .024); a.add(new THREE.ConeGeometry(.007, .025, 5).rotateX(Math.PI/2), MAT.leg, at(0, .268, .092));
  if (!fan) blob(a, MAT.henL, V3(0, .15, .05), .035, .9);
  for (const sx of [-1, 1]) blob(a, MAT.eye, V3(sx*.013, .277, .075), .004);
  for (let i=0;i<3;i++){ const d = V3((i - 1)*.3, 1, -.3).normalize(); seg(a, MAT.eye, V3(0, .29, .06), d, .035, .002, .002, 3); blob(a, fan ? MAT.peaB : MAT.hen, V3(0, .29, .06).addScaledVector(d, .037), .006); }
  for (const sx of [-1, 1]) a.add(new THREE.SphereGeometry(.035, 7, 5), fan ? MAT.peaG : MAT.hen, at(sx*.04, .14, -.02, 0, .3, .6, 1.3));
  for (const sx of [-1, 1]) seg(a, MAT.leg, V3(sx*.015, 0, 0), _up, .1, .005, .005, 4);
  if (fan) { // the displayed train: a half-fan of feathers, each with an eye spot
    const n = 17;
    for (let i=0;i<n;i++){ const ang = -1.35 + i/(n - 1)*2.7, d = V3(Math.sin(ang), Math.cos(ang), -.25).normalize(), base = V3(0, .16, -.07), L = .22;
      seg(a, MAT.peaG, base, d, L, .004, .004, 3);
      const tip = base.clone().addScaledVector(d, L); a.add(new THREE.SphereGeometry(.03, 8, 6), i%2 ? MAT.peaG : MAT.peaT, at(tip.x, tip.y, tip.z - .005, 0, 1, 1.3, .25, 0, -ang));
      blob(a, MAT.peaGold, V3(tip.x, tip.y, tip.z + .004), .015, 1.2); blob(a, MAT.peaEye, V3(tip.x, tip.y, tip.z + .009), .008, 1.2); }
    a.add(new THREE.CircleGeometry(.17, 18, Math.PI*.12, Math.PI*.76).rotateZ(0), MAT.peaG, at(0, .17, -.075, 0, 1, 1, 1, -.25));
  } else a.add(new THREE.ConeGeometry(.04, .12, 6).rotateX(-Math.PI/2 - .3), MAT.hen, at(0, .13, -.1));
  a.into(g); return g;
}
/* spots: walkers on the free left column and the front-right cell; monkeys on the temple's second tier and a banyan limb */
const WALKERS = [
  { kind:'tiger', at:[0.28, 2.3], face:.9 }, { kind:'bear', at:[0.4, 4.25], face:.95 },
  { kind:'peacock', at:[5.05, 6.05], face:-.5, fan:true }, { kind:'peahen', at:[5.45, 6.35], face:-.9 }
];
function monkeySpots(){
  const tc = cellPos(2.5, 2.5), ty = TEMPLE.tiers[0][1] + TEMPLE.tiers[1][1], w1 = TEMPLE.tiers[1][0]/2;
  const bc = cellPos(0.5, 5.5), [ang, reach] = BANYAN.limbs[1];
  return [ { p:V3(tc.x + w1 - .14, TILE_TOP + ty, tc.z + w1 - .06), face:.6, v:1 },
           { p:V3(bc.x + Math.cos(ang)*reach*.62, TILE_TOP + BANYAN.Y + .11, bc.z + Math.sin(ang)*reach*.62), face:.4, v:0 },
           { p:V3(tc.x - w1 + .1, TILE_TOP + ty, tc.z + w1 - .1), face:1.2, v:0 } ];
}
function moveResidents(t){
  (V && V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'monkey') { const drop = 1 - e, bounce = r.arrive >= 1 ? Math.max(0, Math.sin(t*1.7 + u.ph))*.012 : 0;
      r.obj.position.set(u.p.x, u.p.y + drop*1.6 + bounce, u.p.z); r.obj.rotation.y = u.face + Math.sin(t*.6 + u.ph)*.15; return; }
    const walking = r.arrive < 1, p = u.from.clone().lerp(u.at, walking ? 1 - Math.pow(1 - r.arrive, 2.2) : 1);
    r.obj.position.set(p.x, TILE_TOP + (walking ? Math.abs(Math.sin(t*7))*.008 : 0), p.z);
    r.obj.rotation.y = walking ? Math.atan2(u.at.x - u.from.x, u.at.z - u.from.z) : u.face + Math.sin(t*.4 + u.ph)*.06;
    (r.obj.userData.legs || []).forEach((L, i) => L.rotation.x = walking ? Math.sin(t*7 + (i === 0 || i === 3 ? 0 : Math.PI))*.4 : 0);
  });
}
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.08))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(rs[0].obj.position.y + .45), 10, 0xFFF0B0, .6); res(); })); }
const MAKE = { tiger:() => makeTiger(), bear:() => makeBear(), peacock:() => makePeacock(true), peahen:() => makePeacock(false), monkey:v => makeMonkey(v) };
async function jungleMoveIn(walk){
  V.residentsIn = true; V.res = [];
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const gate = cellPos(3, 7.3);
  const walker = (w, i) => { const o = MAKE[w.kind](); o.scale.setScalar(RES_SCALE); return addRes(w.kind, o, { at:cellPos(...w.at), from:gate.clone().add(V3(-.5 + i*.3, 0, .2)), face:w.face, ph:i*1.7 }); };
  const groups = [
    async () => { const rs = [walker(WALKERS[0], 0)]; moveResidents(0); if (walk) await arrive(rs, 2400); },
    async () => { const rs = [walker(WALKERS[1], 1)]; moveResidents(0); if (walk) await arrive(rs, 2200); },
    async () => { const rs = monkeySpots().map((m, i) => { const o = makeMonkey(m.v); o.scale.setScalar(RES_SCALE); return addRes('monkey', o, { p:m.p, face:m.face, ph:i*2.3 }); });
      moveResidents(0); if (walk) await arrive(rs, 1500); },
    async () => { const rs = [walker(WALKERS[2], 2), walker(WALKERS[3], 3)]; moveResidents(0); if (walk) await arrive(rs, 1800); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length;
}

export default {
  id:'jungle', name:'Jungle kingdom', title:'Your jungle',
  season:32, dates:'22 Mar–4 Apr', nextIn:14,
  kits:['a', 'dino'],
  kitDefs:{ dino:{ file:'assets/dino/palms.glb', sway:true } },
  families:{
    water:   { label:'waterfalls, pools & lotus ponds', tag:'Water' },
    building:{ label:'temples, huts & tree houses',     tag:'Ruin' },
    path:    { label:'stones, logs, lanterns & fences', tag:'Trail' },
    crop:    { label:'shrines & stupas restored',       tag:'Restore' },
    tree:    { label:'rainforest trees, palms & bamboo', tag:'Tree' },
    special: { label:'the giant banyan',                tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:TILE, tileMap },
  ghost:{ color:'#FFFFFF', opacity:.4, emissive:.2, dash:'#FFFFFF', dashOpacity:.7 },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 3.2c-4.6 0-8.4 2.6-8.4 5.8 0 2 1.7 3.6 4 4.4 1.3.5 2.8.7 4.4.7s3.1-.2 4.4-.7c2.3-.8 4-2.4 4-4.4 0-3.2-3.8-5.8-8.4-5.8z" fill="#3F8A36"/><path d="M10.6 13.8V21M13.4 13.8V21" stroke="#8A6A4C" stroke-width="1.8" stroke-linecap="round"/><path d="M6.4 12.6V20M17.6 12.6V20" stroke="#8A6A4C" stroke-width="1" stroke-linecap="round"/><path d="M3 21h18" stroke="#6BA64A" stroke-width="1.6" stroke-linecap="round"/><circle cx="16.8" cy="7" r="1" fill="#E8454A"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M64 14c-30 0-52 14-52 32 0 12 12 20 28 24 7 2 16 3 24 3s17-1 24-3c16-4 28-12 28-24 0-18-22-32-52-32z"/><path d="M56 70h16v44H56z"/><path d="M28 64h3v50h-3zM97 64h3v50h-3zM42 70h3v44h-3zM83 70h3v44h-3z"/><path d="M8 114h112v6H8z"/><path d="M40 108h48v6H40z"/></g>',
  album:{ image:'assets/jungle/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E4F0D8)' },
  css:'.phone[data-theme="jungle"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#EEF6E4 58%,#D8EAC6 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'shrine' || s.kind === 'stupa') {
      const base = new THREE.Mesh(G.field, MAT.floor); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      const host = new THREE.Group(); host.scale.setScalar(1.12); g.add(host); g.userData.plants = host;
      const fill = s.kind === 'shrine' ? fillShrine : fillStupa; g.userData.regrow = st => fill(host, s, st); fill(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'jungle' ? 1 : 1.12,
  contact: s => s.kind === 'jungle' && !['path', 'fence', 'hero', 'lotus'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && s.v === 2),
  decor,
  ambient: addAmbient,
  tick(t){ moveAmbient(t); moveResidents(t); },

  residents:[ { id:'tiger', name:'Tiger', n:1 }, { id:'bear', name:'Sloth bear', n:1 }, { id:'monkey', name:'Monkeys', n:3 }, { id:'peacock', name:'Peacocks', n:2 } ],
  moveIn: jungleMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('jungle:'+d.id, () => { const o = d.id === 'monkey' ? makeMonkey(1) : MAKE[d.id](); o.rotation.y = .7; return o; }, 168); },
  /* sprite export: static rigs for the code-built residents (the app animates legs / bobbing) */
  residentRig(d){ const obj = d.id === 'monkey' ? makeMonkey(0) : MAKE[d.id](); obj.scale.setScalar(RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
