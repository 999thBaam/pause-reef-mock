/* ANT FARM (?theme=ants) — the land is the lid of a glass-sided ant farm. Under the meadow tiles the two faces the camera sees
   are glass panes over a cut-away of the soil: strata, roots, pebbles and the colony's tunnels and chambers (eggs, seeds, a leaf
   garden). The tunnels dig deeper with every piece placed (the face texture is redrawn at each impact), and the queen's royal
   chamber appears at the bottom once the Gita piece lands. On top: an ant's-eye meadow of giant clover, dandelions, dew drops,
   acorn and sugar-cube stores, dig mounds that grow, crumb trails and twig fences.
   Blueprint = the farm's hero-right blueprint (every farm slot id maps to an ant-farm piece, so order and rings are unchanged).
   Everything is procedural three.js geometry (merged per material), plus a few tufts / flowers / ferns from the shared CC0
   Quaternius Stylized Nature MegaKit (kit a). No new asset files. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rngFrom, TEX, addSway, world } from '../engine/scene.js';
import { S, V, placed, cropStage, hooks } from '../engine/state.js';
import { TILE_TOP, cellPos, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, seg, blob, _up, _q, _m, _s } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { meadowDecor, addButterflies, flyButterflies, tintedFlower } from '../engine/life.js';
import { FARM_SLOTS as FARM, FARM_ORDER } from './farm.js';

const PM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.85, metalness:0, flatShading:true, ...o });
const SM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.7, metalness:0, ...o });
const MAT = {
  dirt:PM(0xA8703F), dirtL:PM(0xC99461), dirtD:PM(0x7A4A28), hole:SM(0x2A170C, { roughness:1 }), holeIn:SM(0x3A2213, { side:THREE.BackSide, roughness:1 }),
  bed:new THREE.MeshStandardMaterial({ color:0xB07A48, roughness:1, map:TEX.furrow }), crumb:PM(0xE8B96A), crust:PM(0xB9793A),
  twig:PM(0x8A5A36), twigL:PM(0xB98552), pebble:PM(0xB9B1A3), pebbleD:PM(0x938B80), sand:PM(0xE7CFA0, { roughness:1 }),
  leaf:PM(0x6FB041), leafD:PM(0x4F8C34), leafL:PM(0x9CCB5A), vein:PM(0xC6E08A),
  water:new THREE.MeshStandardMaterial({ color:0x7FD3F2, roughness:.05, metalness:0, transparent:true, opacity:.86, emissive:0x2E9CCB, emissiveIntensity:.45 }),
  pool:new THREE.MeshStandardMaterial({ color:0x5CC2DE, roughness:.12, metalness:0, emissive:0x0E4C65, emissiveIntensity:.35 }),
  shine:new THREE.MeshBasicMaterial({ color:0xFFFFFF }),
  capRed:SM(0xD9463B, { roughness:.35 }), capIn:SM(0xE9E2D6, { roughness:.4 }),
  acorn:SM(0xC98A3C), acornCap:PM(0x8A5A30), sugar:SM(0xFFFDF8, { roughness:.55 }), sugarS:SM(0xF1ECE2, { roughness:.6 }),
  mushStem:SM(0xF3E6CC), mushCap:SM(0xE4574A), spot:SM(0xFFF8EC),
  door:PM(0x5C3B22), win:new THREE.MeshStandardMaterial({ color:0xFFE3A0, emissive:0xFFB24A, emissiveIntensity:.9, roughness:.4 }),
  egg:SM(0xFFF6E0, { roughness:.45 }), seed:SM(0xE9C27A), seedD:SM(0xC9974E),
  petalY:PM(0xF4C84A), petalW:PM(0xFFFBF2), petalP:PM(0xF59BB8), petalR:PM(0xE8574B), disk:PM(0x6B4423), stem:PM(0x5E9E3A),
  moss:PM(0x6FAA3A), mossL:PM(0x8CC24E),
  gold:SM(0xF4C84A, { roughness:.3, emissive:0x6B4A08, emissiveIntensity:.3 }), glowW:new THREE.MeshStandardMaterial({ color:0xFFF1B8, emissive:0xFFD27A, emissiveIntensity:1.4 }),
  frame:PM(0xC9955E), frameD:PM(0x9A6A3C),
  // ants
  ant:SM(0x3A2A22, { roughness:.4 }), antRed:SM(0xB5462E, { roughness:.42 }), antQ:SM(0x6B3A26, { roughness:.38 }), antLeg:SM(0x2A1D17, { roughness:.6 }),
  eyeW:SM(0xFFFFFF, { roughness:.3 }), eye:SM(0x151515, { roughness:.3 }), cheek:SM(0xF4A7A0),
  lady:SM(0xE23B2E, { roughness:.3 }), ladyB:SM(0x1C1C1C, { roughness:.4 })
};
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = PM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }
function km(g, name, h, w, x=0, y=0, z=0, rot=0){ const tpl = KITCACHE.a && KITCACHE.a[name]; if (!tpl) return null;
  const k = fitScale(tpl, h, w); return addModel(g, name, k, x, y, z, rot, 'a'); }
function glowSprite(parent, pos, scale, color, opacity=.8){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; s.userData.glow = true; parent.add(s); return s; }
const V3 = (x,y,z) => new THREE.Vector3(x,y,z);
const Y = a => _q.setFromEuler(new THREE.Euler(0, a, 0));

/* ══════════ the ant: head, thorax, abdomen, six legs (two tripods that step in tick), antennae, big cute eyes ══════════ */
function makeAnt(len=.2, body=MAT.ant, opt = {}){
  const g = new THREE.Group(), a = new Acc(), L = len;
  a.add(new THREE.SphereGeometry(L*.24, 14, 10).scale(1, .82, 1.25), body, _m.makeTranslation(0, L*.2, -L*.3));
  if (opt.queen) a.add(new THREE.SphereGeometry(L*.3, 14, 10).scale(1, .8, 1.35), body, _m.makeTranslation(0, L*.2, -L*.52));
  for (let i=0;i<3;i++) a.add(new THREE.TorusGeometry(L*.2 - i*L*.03, L*.012, 4, 16).rotateX(Math.PI/2).rotateX(-.2), MAT.antLeg, _m.makeTranslation(0, L*.24 + i*L*.02, -L*(.3 + i*.08 + (opt.queen ? .12 : 0))));
  a.add(new THREE.SphereGeometry(L*.07, 8, 6), body, _m.makeTranslation(0, L*.19, -L*.08));
  a.add(new THREE.SphereGeometry(L*.12, 12, 8).scale(.9, .85, 1.2), body, _m.makeTranslation(0, L*.21, L*.05));
  a.add(new THREE.SphereGeometry(L*.17, 14, 10).scale(1, .92, .95), body, _m.makeTranslation(0, L*.27, L*.3));
  for (const sx of [-1, 1]) {
    a.add(new THREE.SphereGeometry(L*.075, 10, 8), MAT.eyeW, _m.makeTranslation(sx*L*.085, L*.31, L*.42));
    a.add(new THREE.SphereGeometry(L*.048, 8, 6), MAT.eye, _m.makeTranslation(sx*L*.09, L*.315, L*.47));
    a.add(new THREE.SphereGeometry(L*.04, 8, 6).scale(1, .6, .6), MAT.cheek, _m.makeTranslation(sx*L*.13, L*.22, L*.4));
    const b = V3(sx*L*.06, L*.4, L*.36), m = V3(sx*L*.16, L*.56, L*.44), t = V3(sx*L*.2, L*.6, L*.6);
    seg(a, MAT.antLeg, b, m.clone().sub(b), m.distanceTo(b), L*.014, L*.012, 4); seg(a, MAT.antLeg, m, t.clone().sub(m), t.distanceTo(m), L*.012, L*.01, 4);
    blob(a, body, t, L*.03);
  }
  if (opt.queen) { const cy = L*.43, cz = L*.3;                                      // a little gold tiara
    a.add(new THREE.CylinderGeometry(L*.09, L*.1, L*.035, 14, 1, true), MAT.gold, _m.makeTranslation(0, cy, cz));
    for (let i=0;i<5;i++){ const ang = i/5*6.28; a.add(new THREE.ConeGeometry(L*.022, L*.07, 5), MAT.gold, _m.makeTranslation(Math.cos(ang)*L*.09, cy + L*.045, cz + Math.sin(ang)*L*.09)); }
    blob(a, MAT.capRed, V3(0, cy + L*.02, cz + L*.1), L*.022); }
  if (opt.leaf) a.add(new THREE.SphereGeometry(L*.36, 10, 6).scale(1, .1, .75), opt.leaf, _m.compose(V3(0, L*.62, L*.05), _q.setFromEuler(new THREE.Euler(-.9, .2, .3)), _s));
  if (opt.egg) a.add(new THREE.SphereGeometry(L*.1, 10, 8).scale(1, 1.3, 1), MAT.egg, _m.makeTranslation(0, L*.3, L*.55));
  if (opt.seed) a.add(new THREE.SphereGeometry(L*.11, 10, 8).scale(1, .8, 1.5), MAT.seed, _m.makeTranslation(0, L*.28, L*.58));
  a.into(g);
  const legs = [new THREE.Group(), new THREE.Group()];
  for (let i=0;i<3;i++) for (const sx of [-1, 1]) {
    const la = new Acc(), z0 = L*(.12 - i*.1), hip = V3(sx*L*.07, L*.18, z0), knee = V3(sx*L*.25, L*.26, z0 + L*(.12 - i*.1)), foot = V3(sx*L*.36, 0, z0 + L*(.2 - i*.2));
    seg(la, MAT.antLeg, hip, knee.clone().sub(hip), knee.distanceTo(hip), L*.022, L*.018, 4);
    seg(la, MAT.antLeg, knee, foot.clone().sub(knee), foot.distanceTo(knee), L*.018, L*.012, 4);
    const lg = new THREE.Group(); lg.position.set(sx*L*.07, L*.18, z0); la.into(lg); lg.children.forEach(c => c.position.set(-sx*L*.07, -L*.18, -z0));
    legs[(i + (sx > 0 ? 1 : 0)) % 2].add(lg);
  }
  g.add(legs[0], legs[1]); g.userData.legs = legs;
  return g;
}
function stepLegs(ant, t){ const [a, b] = ant.userData.legs || []; if (!a) return; const w = Math.sin(t*18 + (ant.userData.ph||0))*.35;
  a.children.forEach(l => l.rotation.y = w); b.children.forEach(l => l.rotation.y = -w); }
function makeLadybird(len=.24){
  const g = new THREE.Group(), a = new Acc(), L = len;
  a.add(new THREE.SphereGeometry(L*.42, 18, 12, 0, Math.PI*2, 0, Math.PI*.5).scale(1, .8, 1.1), MAT.lady);
  a.add(new THREE.CylinderGeometry(L*.4, L*.4, L*.04, 18).scale(1, 1, 1.1), MAT.ladyB, _m.makeTranslation(0, L*.01, 0));
  a.add(new THREE.BoxGeometry(L*.012, L*.2, L*.9), MAT.ladyB, _m.makeTranslation(0, L*.25, 0));
  for (const [x,z] of [[.18,.15],[-.18,.15],[.2,-.18],[-.2,-.18],[0,-.32]]) a.add(new THREE.SphereGeometry(L*.07, 8, 6).scale(1, .5, 1), MAT.ladyB, _m.makeTranslation(x*L, L*.3 - Math.hypot(x,z)*L*.35, z*L));
  a.add(new THREE.SphereGeometry(L*.17, 12, 8), MAT.ladyB, _m.makeTranslation(0, L*.1, L*.44));
  for (const sx of [-1, 1]) { a.add(new THREE.SphereGeometry(L*.06, 8, 6), MAT.eyeW, _m.makeTranslation(sx*L*.08, L*.16, L*.56)); a.add(new THREE.SphereGeometry(L*.035, 8, 6), MAT.eye, _m.makeTranslation(sx*L*.085, L*.17, L*.6)); }
  a.into(g); return g;
}

/* ══════════ small builders ══════════ */
/* an earth mound (half-ellipsoid, crumbly) with an arched door facing the viewer */
function moundGeo(R, H, rng, phiStart=0, phiLen=Math.PI*2){
  const g = new THREE.SphereGeometry(1, 22, 10, phiStart, phiLen, 0, Math.PI/2), p = g.attributes.position;
  for (let i=0;i<p.count;i++){ const k = 1 + (Math.sin(p.getX(i)*9 + p.getZ(i)*7)*.5 + (rng() - .5))*.06; p.setXYZ(i, p.getX(i)*R*k, p.getY(i)*H, p.getZ(i)*R*k); }
  g.computeVertexNormals(); return g; }
const surf = (R, H, ang, y) => { const r = R*Math.sqrt(Math.max(0, 1 - (y/H)*(y/H))); return V3(Math.cos(ang)*r, y, Math.sin(ang)*r); };
function arch(a, p, w, h, ang, mat=MAT.hole){      // a dark arched doorway at p, facing outward along ang
  const q = Y(Math.PI/2 - ang);
  a.add(new THREE.PlaneGeometry(w, h*.55).translate(0, h*.275, 0), mat, _m.compose(p, q, _s));
  a.add(new THREE.CircleGeometry(w/2, 12, 0, Math.PI).translate(0, h*.55, 0), mat, _m.compose(p, q, _s));
  a.add(new THREE.TorusGeometry(w/2 + .015, .022, 5, 12, Math.PI).translate(0, h*.55, 0), MAT.dirtL, _m.compose(p, q, _s));
}
function roundWin(a, p, r, ang){ const q = Y(Math.PI/2 - ang);
  a.add(new THREE.CircleGeometry(r, 12), MAT.win, _m.compose(p, q, _s)); a.add(new THREE.TorusGeometry(r, .014, 4, 14), MAT.twig, _m.compose(p, q, _s)); }
function grains(a, n, rng, rad, cx=0, cz=0, y=.02, mats=[MAT.dirtL, MAT.dirt]){
  for (let i=0;i<n;i++){ const ang = rng()*6.28, d = rad*(.4 + rng()*.6); blob(a, mats[i%mats.length], V3(cx + Math.cos(ang)*d, y, cz + Math.sin(ang)*d), .022 + rng()*.02, .7); } }
function seeds(a, n, rng, rad, cx=0, cz=0, y=.03){
  for (let i=0;i<n;i++){ const ang = rng()*6.28, d = rad*rng(); a.add(new THREE.SphereGeometry(.05, 8, 6).scale(.8, .6, 1.3), i%3 ? MAT.seed : MAT.seedD, _m.compose(V3(cx + Math.cos(ang)*d, y, cz + Math.sin(ang)*d), Y(rng()*6), _s)); } }
function leafGeo(len, wid, cup=.25){ const g = new THREE.SphereGeometry(1, 16, 8), p = g.attributes.position;
  for (let i=0;i<p.count;i++){ const x = p.getX(i), z = p.getZ(i), y = p.getY(i); const taper = 1 - Math.pow(Math.abs(z), 2)*.25;
    p.setXYZ(i, x*wid*taper*(1 - Math.max(0, z)*.35), y*.035 + (x*x)*cup*wid, z*len); }
  g.computeVertexNormals(); return g; }
const DROP_GEO = new THREE.SphereGeometry(1, 28, 20).scale(1, .82, 1);
function dewDrop(g, a, p, r){ const d = new THREE.Mesh(DROP_GEO, MAT.water); d.scale.setScalar(r); d.position.set(p.x, p.y + r*.8, p.z); d.castShadow = true; g.add(d);
  a.add(new THREE.SphereGeometry(r*.22, 8, 6).scale(1, .6, 1), MAT.shine, _m.makeTranslation(p.x - r*.25, p.y + r*1.3, p.z + r*.3)); }

/* ══════════ pieces ══════════ */
const B = {
  hall(g){ const a = new Acc(), r = rngFrom(12), R = .88, H = 1.05;
    a.add(moundGeo(R, H, r), MAT.dirt);
    for (let i=0;i<46;i++){ const ang = r()*6.28, y = r()*H*.9, p = surf(R, H, ang, y); blob(a, i%2 ? MAT.dirtL : MAT.dirtD, p, .03 + r()*.03, .7); }
    for (const [ang, w, h] of [[Math.PI/4, .3, .34], [Math.PI/4 - .75, .2, .22], [Math.PI/4 + .75, .2, .22]]) {
      const p = surf(R, H, ang, 0).multiplyScalar(.99); arch(a, p, w, h, ang);
      const aw = surf(R, H, ang, h*.95).multiplyScalar(1.04);
      a.add(leafGeo(w*.75, w*.55, .1), MAT.leaf, _m.compose(aw, _q.setFromEuler(new THREE.Euler(-.5, Math.PI/2 - ang, 0, 'YXZ')), _s)); }
    for (const [ang, y, rr] of [[Math.PI/4 - .35, .55, .06], [Math.PI/4 + .4, .62, .055], [Math.PI/4, .82, .05], [Math.PI/4 - 1.2, .4, .05], [Math.PI/4 + 1.15, .45, .05]])
      roundWin(a, surf(R, H, ang, y).multiplyScalar(1.01), rr, ang);
    seg(a, MAT.twig, V3(0, H*.95, 0), _up, .45, .018, .014, 5);                     // a twig pole with a leaf pennant
    a.add(leafGeo(.18, .09, 0), MAT.leafL, _m.compose(V3(.1, H + .32, 0), _q.setFromEuler(new THREE.Euler(0, 0, Math.PI/2)), _s));
    grains(a, 14, r, .3, .75, .75); seeds(a, 5, r, .18, -.7, .72);
    a.into(g);
    const ant = makeAnt(.16, MAT.ant, { seed:true }); ant.position.set(.62, 0, .42); ant.rotation.y = Math.PI*.3; g.add(ant);
    km(g, 'Grass_Common_Tall', .3, .3, -.6, 0, -.5, 0); km(g, 'Flower_4_Group', .22, .3, .75, 0, -.35, 1); },
  acorn(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z);
    a.add(new THREE.SphereGeometry(.3, 22, 16).scale(1, 1.2, 1), MAT.acorn, _m.makeTranslation(0, .36, 0));
    a.add(new THREE.ConeGeometry(.1, .14, 12).rotateX(Math.PI), MAT.acorn, _m.makeTranslation(0, .03, 0));
    a.add(new THREE.SphereGeometry(.33, 20, 10, 0, Math.PI*2, 0, Math.PI*.5).scale(1, .6, 1), MAT.acornCap, _m.makeTranslation(0, .56, 0));
    for (let i=0;i<40;i++){ const ang = r()*6.28, t = r()*.9, rr = .33*Math.cos(t*Math.PI/2); blob(a, MAT.twig, V3(Math.cos(ang)*rr, .56 + Math.sin(t*Math.PI/2)*.2, Math.sin(ang)*rr), .03, .6); }
    seg(a, MAT.twig, V3(0, .74, 0), V3(.3, 1, 0), .14, .025, .018, 5);
    const d = V3(.22, .1, .22); a.add(new THREE.PlaneGeometry(.15, .08).translate(0, .04, 0), MAT.door, _m.compose(d, Y(Math.PI/4), _s));
    a.add(new THREE.CircleGeometry(.075, 12, 0, Math.PI).translate(0, .08, 0), MAT.door, _m.compose(d, Y(Math.PI/4), _s));
    roundWin(a, V3(.24, .45, .1), .045, Math.PI*.12);
    seeds(a, 4, r, .4, 0, 0); a.into(g); },
  sugar(g, s){ const a = new Acc(), r = rngFrom(s.x + s.z*3), cube = new RoundedBoxGeometry(.34, .34, .34, 2, .035);
    for (const [x,y,z,rot] of [[-.17,.17,-.1,.1],[.18,.17,-.14,-.12],[0,.17,.2,.05],[.02,.51,-.08,.4]]) a.add(cube, [MAT.sugar, MAT.sugarS][(x > 0 ? 1 : 0)], _m.compose(V3(x, y, z), Y(rot), _s));
    for (let i=0;i<10;i++) a.add(new THREE.BoxGeometry(.035, .035, .035), MAT.sugar, _m.compose(V3((r()-.5)*.8, .02, (r()-.5)*.8), Y(r()*3), _s));
    const d = V3(.12, .0, .37); a.add(new THREE.PlaneGeometry(.12, .08).translate(0, .04, 0), MAT.door, _m.compose(d, Y(.05), _s));
    a.add(new THREE.CircleGeometry(.06, 12, 0, Math.PI).translate(0, .08, 0), MAT.door, _m.compose(d, Y(.05), _s));
    roundWin(a, V3(.06, .53, .095), .04, Math.PI/2 - .4);
    a.into(g); const ant = makeAnt(.14, MAT.ant); ant.position.set(-.3, 0, .36); ant.rotation.y = 1.2; g.add(ant); },
  mushroom(g, s){ const a = new Acc(), r = rngFrom(s.x*3 + s.z*9);
    a.add(new THREE.CylinderGeometry(.15, .2, .52, 16).translate(0, .26, 0), MAT.mushStem);
    a.add(new THREE.SphereGeometry(.44, 22, 12, 0, Math.PI*2, 0, Math.PI*.5).scale(1, .62, 1), MAT.mushCap, _m.makeTranslation(0, .48, 0));
    a.add(new THREE.CylinderGeometry(.42, .38, .05, 22), MAT.spot, _m.makeTranslation(0, .48, 0));
    for (let i=0;i<9;i++){ const ang = i*2.4 + r(), t = .25 + r()*.6; const p = V3(Math.cos(ang)*.44*Math.cos(t), .48 + .27*Math.sin(t), Math.sin(ang)*.44*Math.cos(t)); blob(a, MAT.spot, p, .05, .45); }
    const d = V3(.13, 0, .13); a.add(new THREE.PlaneGeometry(.13, .1).translate(0, .05, 0), MAT.door, _m.compose(d.clone().multiplyScalar(1.02), Y(Math.PI/4), _s));
    a.add(new THREE.CircleGeometry(.065, 12, 0, Math.PI).translate(0, .1, 0), MAT.door, _m.compose(d.clone().multiplyScalar(1.02), Y(Math.PI/4), _s));
    roundWin(a, V3(.14, .33, -.05), .04, -.35);
    for (let i=0;i<3;i++) a.add(new THREE.CylinderGeometry(.07, .08, .02, 9), MAT.pebble, _m.makeTranslation(.25 + i*.1, .01, .25 + i*.1));
    a.into(g); },
  nursery(g, s){ const a = new Acc(), r = rngFrom(41), R = .42, H = .52;
    a.add(moundGeo(R, H, r), MAT.dirtL);
    for (let i=0;i<18;i++){ const ang = r()*6.28, y = r()*H*.85; blob(a, MAT.dirt, surf(R, H, ang, y), .025, .7); }
    arch(a, surf(R, H, Math.PI/4, 0), .16, .2, Math.PI/4);
    for (const [ang, y] of [[Math.PI/4 - .6, .3], [Math.PI/4 + .6, .3]]) { const p = surf(R, H, ang, y).multiplyScalar(1.01), q = Y(Math.PI/2 - ang);
      a.add(new THREE.CircleGeometry(.04, 12).scale(1, 1.35, 1), MAT.win, _m.compose(p, q, _s)); }
    a.add(leafGeo(.2, .14, .3), MAT.leafD, _m.compose(V3(-.28, .03, .3), Y(.5), _s));   // a leaf cradle full of eggs
    for (let i=0;i<7;i++) a.add(new THREE.SphereGeometry(.035, 10, 8).scale(1, 1.3, 1), MAT.egg, _m.makeTranslation(-.28 + (r()-.5)*.12, .07, .3 + (r()-.5)*.16));
    a.into(g); const ant = makeAnt(.14, MAT.ant, { egg:true }); ant.position.set(.36, 0, .02); ant.rotation.y = -.4; g.add(ant); },
  granary(g, s){ const a = new Acc(), r = rngFrom(s.x*11);
    for (const [x,z] of [[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3]]) seg(a, MAT.twig, V3(x, 0, z), V3(x*.2, 1, z*.2), .55 - (z > 0 ? .08 : 0), .03, .025, 5);
    a.add(leafGeo(.52, .42, .08), MAT.leaf, _m.compose(V3(0, .56, 0), _q.setFromEuler(new THREE.Euler(.15, .6, 0, 'YXZ')), _s));
    a.add(new THREE.BoxGeometry(.012, .012, .95), MAT.vein, _m.compose(V3(0, .6, 0), _q.setFromEuler(new THREE.Euler(.15, .6, 0, 'YXZ')), _s));
    for (let k=0;k<3;k++) seeds(a, 8, r, .15, (k-1)*.22, (k%2)*.1 - .05, .04 + (k === 1 ? .04 : 0));
    blob(a, MAT.pebble, V3(.34, .06, .3), .09, .6, 0, r);
    a.into(g); },
  // water (Breathe)
  dew(g, s){ const a = new Acc();
    a.add(leafGeo(.44, .3, .12), MAT.leaf, _m.compose(V3(0, .04, 0), Y(.7), _s));
    a.add(new THREE.BoxGeometry(.012, .01, .82), MAT.vein, _m.compose(V3(0, .05, 0), Y(.7), _s));
    a.into(g); const w = new Acc(); dewDrop(g, w, V3(.02, .06, .02), .2); dewDrop(g, w, V3(-.2, .05, .22), .07); dewDrop(g, w, V3(.24, .05, -.2), .055); w.into(g);
    km(g, 'Clover_1', .18, .3, -.35, 0, -.3, 1); },
  cap(g){ const a = new Acc(), n = 24, sh = new THREE.CylinderGeometry(.4, .42, .12, n*2, 1, true), p = sh.attributes.position;
    for (let i=0;i<p.count;i++){ const ang = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + (Math.cos(ang*n) > 0 ? .05 : 0); p.setX(i, p.getX(i)*k); p.setZ(i, p.getZ(i)*k); }
    sh.computeVertexNormals(); a.add(sh.translate(0, .06, 0), MAT.capRed);
    a.add(new THREE.CylinderGeometry(.4, .4, .02, 32), MAT.capIn, _m.makeTranslation(0, .01, 0));
    a.add(new THREE.TorusGeometry(.4, .025, 5, 32).rotateX(Math.PI/2), MAT.capRed, _m.makeTranslation(0, .12, 0));
    a.add(new THREE.CylinderGeometry(.37, .37, .02, 32), MAT.pool, _m.makeTranslation(0, .1, 0));
    a.add(leafGeo(.11, .07, .1), MAT.leafL, _m.compose(V3(.08, .115, -.06), Y(1), _s));
    a.into(g); const ant = makeAnt(.12, MAT.ant); ant.position.set(.08, .12, -.06); ant.rotation.y = 1; g.add(ant); },
  puddle(g, s){ const a = new Acc(), r = rngFrom(19), sh = new THREE.Shape();
    for (let i=0;i<=24;i++){ const ang = i/24*6.28, rr = .36 + Math.sin(ang*3 + 1)*.05 + Math.sin(ang*5)*.02; i ? sh.lineTo(Math.cos(ang)*rr, Math.sin(ang)*rr) : sh.moveTo(Math.cos(ang)*rr, Math.sin(ang)*rr); }
    a.add(new THREE.ShapeGeometry(sh).rotateX(-Math.PI/2), MAT.pool, _m.makeTranslation(0, .03, 0));
    for (let i=0;i<14;i++){ const ang = i/14*6.28 + r()*.2; blob(a, r() < .5 ? MAT.pebble : MAT.pebbleD, V3(Math.cos(ang)*.42, .03, Math.sin(ang)*.42), .04 + r()*.03, .6, 0, r); }
    a.add(leafGeo(.16, .09, .35), MAT.leafL, _m.compose(V3(.05, .045, .02), Y(.8), _s));                  // a leaf boat
    seg(a, MAT.twig, V3(.05, .05, .02), _up, .16, .008, .006, 4); a.add(leafGeo(.05, .04, 0), MAT.petalY, _m.compose(V3(.09, .17, .02), _q.setFromEuler(new THREE.Euler(0, 0, Math.PI/2)), _s));
    a.into(g); km(g, 'Grass_Common_Short', .2, .3, .35, 0, -.3, 0); },
  moss(g, s){ const a = new Acc(), r = rngFrom(s.x*5 + s.z*2);
    for (let i=0;i<16;i++){ const ang = r()*6.28, d = r()*.3; blob(a, i%3 ? MAT.moss : MAT.mossL, V3(Math.cos(ang)*d, .04, Math.sin(ang)*d), .09 + r()*.07, .55, 1, r); }
    for (let i=0;i<7;i++){ const ang = r()*6.28, d = .1 + r()*.25; seg(a, MAT.stem, V3(Math.cos(ang)*d, .08, Math.sin(ang)*d), _up, .08 + r()*.06, .006, .005, 3); }
    a.into(g); const w = new Acc();
    for (const [x,z,rr] of [[0,0,.1],[.18,-.12,.06],[-.15,.14,.07],[.2,.2,.05]]) dewDrop(g, w, V3(x, .1, z), rr);
    w.into(g); },
  // trees (Vocab): tall ant's-eye flowers and leaves
  clover(g, s){ const a = new Acc(), r = rngFrom(s.x*13 + s.z*3), H = 1.15, lm = swayMat(0x5FA83C, H, .03), sm = swayMat(0x6DAA40, H, .03);
    for (const [x,z,h] of [[0,0,1],[.18,.14,.72],[-.16,.12,.55]]) { const top = V3(x, H*h, z);
      seg(a, sm, V3(x, 0, z), V3(0, 1, 0), H*h, .022, .016, 5);
      for (let k=0;k<3;k++){ const ang = k/3*6.28 + r(), dir = V3(Math.cos(ang), 0, Math.sin(ang));
        for (const side of [-1, 1]) a.add(new THREE.SphereGeometry(.12*h + .04, 12, 6).scale(1, .1, .8), lm,
          _m.compose(top.clone().addScaledVector(dir, .13*h + .05).add(V3(-dir.z*side*.05, .02, dir.x*side*.05)), _q.setFromEuler(new THREE.Euler(.25, -ang + side*.35, 0, 'YXZ')), _s)); } }
    a.into(g); km(g, 'Grass_Common_Short', .2, .3, .3, 0, .3, 0); },
  dandelion(g, s){ const a = new Acc(), H = 1.3, sm = swayMat(0x6DAA40, H, .025);
    const c = new THREE.CatmullRomCurve3([V3(0,0,0), V3(.05, H*.5, .02), V3(.02, H, -.02)]); a.add(new THREE.TubeGeometry(c, 10, .02, 5), sm);
    const top = V3(.02, H + .05, -.02), ico = new THREE.IcosahedronGeometry(1, 1), p = ico.attributes.position, seen = new Set();
    for (let i=0;i<p.count;i++){ const d = V3(p.getX(i), p.getY(i), p.getZ(i)); const key = d.toArray().map(v => v.toFixed(2)).join(); if (seen.has(key)) continue; seen.add(key);
      seg(a, swayMat(0xFFFBF2, H + .3, .025), top, d, .22, .006, .004, 3); blob(a, swayMat(0xFFFFFF, H + .3, .025), top.clone().addScaledVector(d, .23), .035, 1); }
    blob(a, swayMat(0xC9B38A, H + .3, .025), top, .05);
    const c2 = new THREE.CatmullRomCurve3([V3(.12,0,.1), V3(.22, .35, .12), V3(.26, .6, .1)]); a.add(new THREE.TubeGeometry(c2, 8, .016, 5), sm);   // a yellow bloom beside it
    for (let i=0;i<14;i++){ const ang = i/14*6.28; a.add(new THREE.BoxGeometry(.03, .012, .1).translate(0, 0, .06), MAT.petalY, _m.compose(V3(.26, .62, .1), _q.setFromEuler(new THREE.Euler(-.35, ang, 0, 'YXZ')), _s)); }
    for (let i=0;i<4;i++){ const ang = i/4*6.28 + .4; a.add(leafGeo(.28, .06, .1), MAT.leafD, _m.compose(V3(Math.cos(ang)*.2, .03, Math.sin(ang)*.2), _q.setFromEuler(new THREE.Euler(-.3, Math.PI/2 - ang, 0, 'YXZ')), _s)); }
    a.into(g); },
  tulip(g, s){ const a = new Acc(), H = 1.05, col = s.x % 2 ? MAT.petalP : MAT.petalR;
    seg(a, swayMat(0x6DAA40, H, .025), V3(0,0,0), _up, H, .025, .02, 5);
    for (let i=0;i<5;i++){ const ang = i/5*6.28; a.add(new THREE.SphereGeometry(.13, 10, 8).scale(.7, 1.3, .45).translate(0, .12, .06), col, _m.compose(V3(0, H - .05, 0), _q.setFromEuler(new THREE.Euler(.18, ang, 0, 'YXZ')), _s)); }
    for (const sgn of [-1, 1]) a.add(leafGeo(.34, .08, .15), swayMat(0x5FA83C, H, .025), _m.compose(V3(sgn*.1, .3, 0), _q.setFromEuler(new THREE.Euler(-1.15, sgn*Math.PI/2, 0, 'YXZ')), _s));
    a.into(g); km(g, 'Clover_2', .15, .3, -.3, 0, .28, 0); },
  sunflower(g){ const a = new Acc(), H = 1.4, sm = swayMat(0x6DAA40, H, .02);
    seg(a, sm, V3(0,0,0), V3(.05, 1, .05), H, .04, .03, 6);
    const top = V3(.07, H, .07), q = _q.setFromEuler(new THREE.Euler(.7, Math.PI/4, 0, 'YXZ')).clone();
    const mx = (x, y, z, rot) => new THREE.Matrix4().compose(top, q, _s).multiply(new THREE.Matrix4().compose(V3(x, y, z), _q.setFromEuler(new THREE.Euler(0, 0, rot)), _s));
    a.add(new THREE.CylinderGeometry(.16, .16, .05, 20).rotateX(Math.PI/2), MAT.disk, mx(0, 0, .01, 0));
    for (let i=0;i<18;i++){ const ang = i/18*6.28; a.add(new THREE.SphereGeometry(.07, 8, 6).scale(.5, 1.5, .2).translate(0, .22, 0), swayMat(0xF4C84A, H + .3, .02), mx(0, 0, 0, ang)); }
    for (const [y, sgn] of [[.45, 1], [.8, -1]]) a.add(leafGeo(.2, .14, .2), sm, _m.compose(V3(sgn*.14, y, 0), _q.setFromEuler(new THREE.Euler(.2, sgn*Math.PI/2, 0, 'YXZ')), _s));
    a.into(g); },
  fern(g){ km(g, 'Fern_1', .95, .95, 0, 0, 0, .4); km(g, 'Mushroom_Common', .22, .25, .28, 0, .28, 0); },
  toadstools(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + 3);
    for (const [x,z,h] of [[-.1,-.08,.75],[.2,.15,.5],[-.22,.22,.36]]) {
      a.add(new THREE.CylinderGeometry(.05*h + .02, .07*h + .03, h*.8, 12).translate(x, h*.4, z), MAT.mushStem);
      a.add(new THREE.SphereGeometry(.2*h + .08, 16, 8, 0, Math.PI*2, 0, Math.PI*.5).scale(1, .7, 1), MAT.mushCap, _m.makeTranslation(x, h*.78, z));
      for (let i=0;i<5;i++){ const ang = r()*6.28, t = .3 + r()*.5, rr = (.2*h + .08); blob(a, MAT.spot, V3(x + Math.cos(ang)*rr*Math.cos(t), h*.78 + .7*rr*Math.sin(t), z + Math.sin(ang)*rr*Math.cos(t)), .025 + h*.02, .5); } }
    a.into(g); },
  tallgrass(g){ km(g, 'Grass_Wispy_Tall', 1.1, .9, 0, 0, 0, .3); km(g, 'Flower_3_Group', .3, .35, .25, 0, .25, 1); },
  // the hero (Gita): the queen's chamber, a big mound cut open towards the viewer
  queen(g){ const a = new Acc(), r = rngFrom(88), R = .98, H = 1.08, open = 1.9, ph0 = 3*Math.PI/4 + open/2;
    a.add(moundGeo(R, H, r, ph0, Math.PI*2 - open), MAT.dirt);
    a.add(moundGeo(R*.9, H*.9, r, ph0, Math.PI*2 - open), MAT.holeIn);
    // crumbly rim along both cut edges and round the doorway top
    for (const phi of [ph0, ph0 + Math.PI*2 - open]) for (let i=0;i<9;i++){ const th = i/8*Math.PI/2, p = V3(-Math.cos(phi)*Math.sin(Math.PI/2 - th)*R*.95, Math.sin(th)*H*.95, Math.sin(phi)*Math.sin(Math.PI/2 - th)*R*.95);
      blob(a, i%2 ? MAT.dirtL : MAT.dirt, p, .07, 1, 0, r); }
    for (let i=0;i<40;i++){ const phi = ph0 + r()*(Math.PI*2 - open), th = r()*1.3, p = V3(-Math.cos(phi)*Math.cos(th)*R, Math.sin(th)*H, Math.sin(phi)*Math.cos(th)*R); blob(a, i%2 ? MAT.dirtL : MAT.dirtD, p, .035, .7); }
    a.add(new THREE.CylinderGeometry(R*.88, R*.9, .05, 30), MAT.dirtL, _m.makeTranslation(0, .025, 0));
    a.add(leafGeo(.42, .3, .12), MAT.leafL, _m.compose(V3(.02, .06, .02), Y(Math.PI/4), _s));   // the leaf bed
    for (let i=0;i<14;i++){ const ang = -1.4 + r()*1.1, d = .45 + r()*.2; a.add(new THREE.SphereGeometry(.045, 10, 8).scale(1, 1.3, 1), MAT.egg, _m.makeTranslation(Math.cos(ang)*d, .08 + (i > 9 ? .06 : 0), Math.sin(ang)*d)); }
    seeds(a, 7, r, .16, -.45, .35, .06);
    for (const [ang, y] of [[-.5, .55], [1.4, .7], [.5, .85], [2.6, .5]]) { const p = V3(-Math.cos(ph0 + ang + .6)*R*.8, y, Math.sin(ph0 + ang + .6)*R*.8); a.add(new THREE.SphereGeometry(.035, 10, 8), MAT.glowW, _m.makeTranslation(p.x, p.y, p.z)); }
    // twig pole + gold bead on top
    seg(a, MAT.twig, V3(0, H*.96, 0), _up, .3, .02, .015, 5); a.add(new THREE.SphereGeometry(.06, 14, 10), MAT.gold, _m.makeTranslation(0, H*.96 + .32, 0));
    a.into(g);
    const q = makeAnt(.72, MAT.antQ, { queen:true }); q.position.set(-.02, .07, -.06); q.rotation.y = Math.PI/4; g.add(q); q.userData.legs.forEach(l => l.children.forEach(c => c.rotation.y = .15));
    const n1 = makeAnt(.2, MAT.ant, { egg:true }); n1.position.set(.52, .05, -.25); n1.rotation.y = -1.2; g.add(n1);
    const n2 = makeAnt(.2, MAT.ant, { seed:true }); n2.position.set(-.3, .05, .52); n2.rotation.y = 2.3; g.add(n2);
    glowSprite(g, V3(0, .45, 0), 1.3, 0xFFD48A, .5);
    km(g, 'Grass_Common_Tall', .28, .3, -.55, H*.55, -.55, 0); km(g, 'Flower_3_Group', .25, .3, .7, 0, -.55, 1); },
  // Sudoku / Math: dig sites (grow)
  path(g, s){ const slab = new THREE.Mesh(G.path, MAT.sand); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
    const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0; g.userData.ghostMode = 'marker';
    if (v === 0) { for (let i=0;i<9;i++) a.add(new RoundedBoxGeometry(.09, .06, .08, 1, .015), i%3 ? MAT.crumb : MAT.crust, _m.compose(V3((r()-.5)*.35, .06, -.38 + i*.095), Y(r()*3), _s)); }
    else if (v === 1) { for (let i=0;i<4;i++) blob(a, i%2 ? MAT.pebble : MAT.pebbleD, V3((i%2 ? .1 : -.1) + (r()-.5)*.05, .05, -.32 + i*.21), .12, .35, 0, r); }
    else if (v === 2) { for (let i=0;i<6;i++) seg(a, i%2 ? MAT.twig : MAT.twigL, V3(-.42, .05, -.37 + i*.15), V3(1, 0, (r()-.5)*.15), .84, .03, .026, 5); }
    else if (v === 3) { for (const [x,z] of [[-.3,-.28],[.3,.28]]) { seg(a, MAT.stem, V3(x, .035, z), V3(.1, 1, 0), .32, .01, .008, 4); a.add(new THREE.SphereGeometry(.06, 12, 8), MAT.glowW, _m.makeTranslation(x + .035, .38, z)); glowSprite(g, V3(x + .035, .38, z), .35, 0xFFE3A0, .7); }
      for (let i=0;i<5;i++) a.add(new RoundedBoxGeometry(.07, .05, .07, 1, .012), MAT.crumb, _m.compose(V3((r()-.5)*.25, .055, -.3 + i*.15), Y(r()*3), _s)); g.userData.ghostMode = undefined; }
    else { seeds(a, 9, r, .38, 0, 0, .05); blob(a, MAT.pebble, V3(.25, .06, -.2), .1, .6, 0, r); }
    a.into(g); },
  fence(g, s){ const a = new Acc(), n = s.len*3 + 1, L = s.len, r = rngFrom(s.x*3 + s.z*5 + L);
    const pos = i => { const t = -L/2 + i*(L/(n-1)); return s.edge === 'w' ? V3(-.45, 0, t) : V3(t, 0, .45); };
    for (let i=0;i<n;i++){ const p = pos(i); seg(a, i%2 ? MAT.twig : MAT.twigL, p, V3((r()-.5)*.1, 1, (r()-.5)*.1), .28 + r()*.08, .026, .02, 5); }
    for (let i=0;i<n-1;i++){ const p0 = pos(i), p1 = pos(i+1); for (const hh of [.2, .1]) seg(a, MAT.stem, p0.clone().setY(hh), p1.clone().sub(p0), p0.distanceTo(p1), .012, .012, 4);
      const m = p0.clone().lerp(p1, .5); a.add(leafGeo(.05, .03, 0), MAT.leafL, _m.compose(m.setY(.2), Y(r()*6), _s)); }
    a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz); }
};

/* dig sites (Sudoku / Math): a mound thrown up round a tunnel mouth, a stage per later piece */
function fillDig(host, s, stage){
  host.clear(); const st = Math.min(stage, 5), r = rngFrom(s.x*31 + s.z*7 + 5), a = new Acc();
  const R = .16 + st*.045, H = .05 + st*.05;
  const cone = new THREE.CylinderGeometry(R*.32, R, H, 16, 2, true), p = cone.attributes.position;
  for (let i=0;i<p.count;i++){ const k = 1 + (r() - .5)*.12; p.setX(i, p.getX(i)*k); p.setZ(i, p.getZ(i)*k); } cone.computeVertexNormals();
  a.add(cone.translate(0, H/2, 0), MAT.dirt);
  a.add(new THREE.CircleGeometry(R*.3, 14).rotateX(-Math.PI/2), MAT.hole, _m.makeTranslation(0, H + .002, 0));
  grains(a, 4 + st*3, r, R + .16, 0, 0, .02);
  if (st >= 3) { const c2 = new THREE.CylinderGeometry(.04, .12, .09, 12, 1, true).translate(0, .045, 0); a.add(c2, MAT.dirtL, _m.makeTranslation(-.27, 0, .22));
    a.add(new THREE.CircleGeometry(.035, 10).rotateX(-Math.PI/2), MAT.hole, _m.makeTranslation(-.27, .092, .22)); }
  if (st >= 4) seeds(a, 3 + st, r, .14, .26, -.24, .03);
  if (st >= 5) { a.add(leafGeo(.1, .07, .2), MAT.leafL, _m.compose(V3(.28, .03, .2), Y(.4), _s)); }
  a.into(host);
  if (st >= 2) { const ant = makeAnt(.13, MAT.ant, { seed:st >= 4 }); ant.position.set(R*.7, H*.35, R*.5); ant.rotation.set(-.3, Math.PI*.8, 0); host.add(ant); }
  host.userData.stage = stage;
}

/* blueprint: every farm slot id → an ant-farm piece (same cells, rings, order; hero in the right corner) */
const MAP = {
  bigbarn:{ name:'Colony hall', b:'hall' }, well:{ name:'Dew drop', b:'dew' }, apple1:{ name:'Giant clover', b:'clover' },
  silo:{ name:'Acorn store', b:'acorn' }, silohouse:{ name:'Sugar-cube store', b:'sugar' }, coop:{ name:'Mushroom house', b:'mushroom' },
  watertower:{ name:'Bottle-cap pond', b:'cap' }, pump:{ name:'Dewy moss', b:'moss' },
  apple2:{ name:'Dandelion', b:'dandelion' }, berry1:{ name:'Toadstools', b:'toadstools' },
  peepal:{ name:"Queen's chamber", b:'queen' }, smallbarn:{ name:'Nursery', b:'nursery' }, openbarn:{ name:'Seed granary', b:'granary' },
  pond:{ name:'Rain puddle', b:'puddle' }, orange1:{ name:'Tulip', b:'tulip' }, apple3:{ name:'Sunflower', b:'sunflower' },
  berry2:{ name:'Fern', b:'fern' }, orange2:{ name:'Tulip', b:'tulip' }, apple4:{ name:'Tall grass', b:'tallgrass' }
};
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:4, path2_6:0, path3_6:3 };
const PATH_NAME = ['Crumb trail', 'Pebble steps', 'Twig walk', 'Glow-berry path', 'Seed line'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') return { ...s, kind:'dig', name:f.crop === 'Lettuce' ? 'Deep dig' : 'Dig site', stages:5 };
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'ant', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'ant', b:'fence', edge:f.edge, len:f.len, name:'Twig fence' };
  return { ...s, kind:'ant', ...MAP[f.id] };
});

/* ══════════ the glass-sided cross-section: soil strata + tunnels on the two faces the camera sees ══════════ */
const TOP = -.05, BOT = -1.12, FH = TOP - BOT, PX = 128;          // face height in tiles, canvas px per tile
/* tunnel network per face, in face coords: s along the face (tiles, -3.5..3.5), d = depth below TOP (0..FH). need = progress needed */
function network(face){
  const r = rngFrom(face === 'z' ? 5 : 9), segs = [], rooms = [], paths = [];
  const shafts = face === 'z' ? [-1.05, .75, -2.7, 2.45] : [-.6, 1.05, 2.7, -2.55];
  shafts.forEach((s0, k) => {
    const n = 6, dEnd = FH*(.62 + r()*.24), pts = [[s0, 0]];
    for (let i=1;i<=n;i++) pts.push([pts[i-1][0] + (r() - .5)*.42, dEnd*i/n]);
    const base = k*.07, path = [];
    for (let i=0;i<n;i++){ const need = base + i*.105; segs.push({ a:pts[i], b:pts[i+1], need }); path.push(pts[i]); }
    path.push(pts[n]); paths.push({ pts:path, need:base });
    const kinds = ['eggs', 'seeds', 'leaf', 'larva', 'seeds', 'eggs'];
    [2, 4].forEach((bi, j) => { const side = (j + k) % 2 ? 1 : -1, p0 = pts[bi], len = .35 + r()*.3, p1 = [p0[0] + side*len*.55, p0[1] + .06], p2 = [p0[0] + side*len, p0[1] + .1 + r()*.08];
      const need = base + bi*.105 + .06; segs.push({ a:p0, b:p1, need }, { a:p1, b:p2, need });
      rooms.push({ s:p2[0] + side*.12, d:p2[1], rx:.2 + r()*.06, ry:.1, kind:kinds[(k*2 + j) % kinds.length], need:need + .03 }); });
    if (!(face === 'x' && k === 3)) rooms.push({ s:pts[n][0], d:pts[n][1], rx:.22, ry:.1, kind:kinds[(k + 3) % kinds.length], need:base + n*.105 });
  });
  if (face === 'x') rooms.push({ s:-2.55, d:FH*.8, rx:.42, ry:.17, kind:'queen', need:2 });           // shown once the hero is placed
  return { segs, rooms, paths };
}
const NET = { z:network('z'), x:network('x') };
const progress = () => .2 + .8*Math.min(1, placed.length/40);
function drawAnt(g, x, y, sc, rot){ g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = '#1E120B'; g.strokeStyle = '#1E120B'; g.lineWidth = 1.2*sc;
  for (const [cx, rr] of [[-5, 3.2], [0, 2.2], [4.4, 2.6]]) { g.beginPath(); g.ellipse(cx*sc, 0, rr*sc*1.2, rr*sc, 0, 0, 6.3); g.fill(); }
  for (const lx of [-1.5, 0, 1.5]) { g.beginPath(); g.moveTo(lx*sc, -4*sc); g.lineTo(lx*sc, 4*sc); g.stroke(); }
  g.beginPath(); g.moveTo(6*sc, -1*sc); g.lineTo(8.5*sc, -3.5*sc); g.moveTo(6*sc, 1*sc); g.lineTo(8.5*sc, 3.5*sc); g.stroke(); g.restore(); }
function drawFace(face, L){
  const W = Math.round(L*PX), H = Math.round(FH*PX), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const net = NET[face], p = progress(), hero = placed.includes('peepal'), X = s => (s + L/2)*PX, Yp = d => d*PX, r = rngFrom(face === 'z' ? 31 : 37);
  // strata
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#6B4226'); bg.addColorStop(.12, '#8A5A34'); bg.addColorStop(.4, '#A8703F'); bg.addColorStop(.75, '#B98450'); bg.addColorStop(1, '#C99461');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (const [y0, col] of [[.3, 'rgba(255,225,170,.12)'], [.55, 'rgba(90,50,20,.12)'], [.8, 'rgba(255,230,180,.16)']]) { g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
    for (let x=0;x<=W;x+=10) g.lineTo(x, H*y0 + Math.sin(x*.02 + y0*7)*5 + Math.sin(x*.07)*2); g.lineTo(W, H); g.fill(); }
  for (let i=0;i<W*.18;i++){ const x = r()*W, y = H*(.1 + r()*.88), rx = 1.5 + r()*4; g.fillStyle = r() < .5 ? 'rgba(255,240,215,.28)' : 'rgba(50,25,8,.22)'; g.beginPath(); g.ellipse(x, y, rx, rx*.7, 0, 0, 6.3); g.fill(); }
  for (let i=0;i<W*.012;i++){ const x = r()*W, y = H*(.2 + r()*.75), rx = 5 + r()*7; g.fillStyle = r() < .5 ? '#B9B1A3' : '#9B9286'; g.beginPath(); g.ellipse(x, y, rx, rx*.7, r(), 0, 6.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(x - rx*.25, y - rx*.25, rx*.3, rx*.2, 0, 0, 6.3); g.fill(); }
  g.strokeStyle = 'rgba(214,170,110,.75)'; g.lineCap = 'round';                             // roots hanging from the meadow
  for (let i=0;i<W/40;i++){ let x = r()*W, y = 0; g.lineWidth = 1.2 + r()*1.6; g.beginPath(); g.moveTo(x, y); const n = 4 + Math.floor(r()*4);
    for (let k=0;k<n;k++){ x += (r() - .5)*14; y += 5 + r()*7; g.lineTo(x, y); } g.stroke(); }
  // tunnels (a light rim of disturbed sand, then the dark hollow)
  const segs = net.segs.filter(sg => sg.need <= p), rooms = net.rooms.filter(rm => rm.kind === 'queen' ? hero : rm.need <= p);
  const tw = .1*PX;
  for (const [w, col] of [[tw + 6, 'rgba(232,196,140,.55)'], [tw, '#3A2213'], [tw*.45, '#4A2C18']]) {
    g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round';
    segs.forEach(sg => { g.beginPath(); g.moveTo(X(sg.a[0]), Yp(sg.a[1])); g.lineTo(X(sg.b[0]), Yp(sg.b[1])); g.stroke(); });
    rooms.forEach(rm => { g.fillStyle = col; g.beginPath(); g.ellipse(X(rm.s), Yp(rm.d), rm.rx*PX + (w - tw)/2, rm.ry*PX + (w - tw)/2, 0, 0, 6.3); g.fill(); });
    if (hero && face === 'x') { g.beginPath(); g.moveTo(X(-2.55), Yp(0)); g.bezierCurveTo(X(-2.2), Yp(FH*.3), X(-2.9), Yp(FH*.5), X(-2.55), Yp(FH*.75)); g.stroke(); }
  }
  // chamber contents
  rooms.forEach(rm => { const cx = X(rm.s), cy = Yp(rm.d) + rm.ry*PX*.45, rr = rngFrom(Math.round(rm.s*100 + rm.d*1000));
    if (rm.kind === 'queen') { const gl = g.createRadialGradient(cx, cy - 10, 4, cx, cy - 10, rm.rx*PX); gl.addColorStop(0, 'rgba(255,212,138,.75)'); gl.addColorStop(1, 'rgba(255,212,138,0)');
      g.fillStyle = gl; g.beginPath(); g.ellipse(cx, Yp(rm.d), rm.rx*PX, rm.ry*PX, 0, 0, 6.3); g.fill();
      g.fillStyle = '#7DBB4A'; g.beginPath(); g.ellipse(cx, cy + 2, 34, 6, 0, 0, 6.3); g.fill();
      g.fillStyle = '#6B3A26'; g.beginPath(); g.ellipse(cx - 12, cy - 8, 17, 11, 0, 0, 6.3); g.fill(); g.beginPath(); g.ellipse(cx + 6, cy - 9, 6, 5, 0, 0, 6.3); g.fill(); g.beginPath(); g.ellipse(cx + 16, cy - 11, 7, 6.5, 0, 0, 6.3); g.fill();
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(cx + 19, cy - 13, 2.6, 0, 6.3); g.fill(); g.fillStyle = '#151515'; g.beginPath(); g.arc(cx + 20, cy - 13, 1.4, 0, 6.3); g.fill();
      g.fillStyle = '#F4C84A'; g.beginPath(); g.moveTo(cx + 11, cy - 17); for (let k=0;k<4;k++){ g.lineTo(cx + 12.5 + k*3, cy - 23 + (k%2)*3); g.lineTo(cx + 14 + k*3, cy - 17); } g.fill();
      for (let k=0;k<9;k++){ g.fillStyle = '#FFF6E0'; g.beginPath(); g.ellipse(cx - 40 + (k%5)*6 + rr()*2, cy - (k > 4 ? 6 : 0), 3, 4.2, 0, 0, 6.3); g.fill(); }
      drawAnt(g, cx + 42, cy - 2, .9, Math.PI); return; }
    const n = rm.kind === 'leaf' ? 5 : 7;
    for (let k=0;k<n;k++){ const x = cx + (k - n/2)*rm.rx*PX*.24 + (rr() - .5)*3, y = cy - (k%2)*3;
      if (rm.kind === 'eggs') { g.fillStyle = '#FFF6E0'; g.beginPath(); g.ellipse(x, y, 2.6, 3.6, 0, 0, 6.3); g.fill(); }
      else if (rm.kind === 'seeds') { g.fillStyle = k%3 ? '#E9C27A' : '#C9974E'; g.beginPath(); g.ellipse(x, y, 4, 2.6, rr(), 0, 6.3); g.fill(); }
      else if (rm.kind === 'leaf') { g.fillStyle = k%2 ? '#7DBB4A' : '#5FA83C'; g.beginPath(); g.ellipse(x, y - 1, 5.5, 3, rr()*2, 0, 6.3); g.fill(); }
      else { g.fillStyle = '#FFF1D6'; g.beginPath(); g.ellipse(x, y, 4.2, 2.4, .3, 0, 6.3); g.fill(); } }
    if (rr() < .7) drawAnt(g, cx + rm.rx*PX*.55, cy - 3, .75, rr() < .5 ? 0 : Math.PI); });
  segs.forEach((sg, i) => { if (i % 3) return; const x = (X(sg.a[0]) + X(sg.b[0]))/2, y = (Yp(sg.a[1]) + Yp(sg.b[1]))/2; drawAnt(g, x, y, .7, Math.atan2(Yp(sg.b[1]) - Yp(sg.a[1]), X(sg.b[0]) - X(sg.a[0]))); });
  // soft vignette at the bottom
  const vg = g.createLinearGradient(0, H*.85, 0, H); vg.addColorStop(0, 'rgba(60,30,10,0)'); vg.addColorStop(1, 'rgba(60,30,10,.25)'); g.fillStyle = vg; g.fillRect(0, H*.85, W, H*.15);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/* glass: a faint tint plus two diagonal streaks */
const GLASS_TEX = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(220,240,255,.08)'; g.fillRect(0, 0, 256, 64);
  for (const [x, w, a] of [[40, 22, .35], [74, 8, .28], [170, 14, .22]]) { g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.moveTo(x, 64); g.lineTo(x + w, 64); g.lineTo(x + w + 30, 0); g.lineTo(x + 30, 0); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t; })();
/* face frames: face 'z' at z = +L/2 (s = x), face 'x' at x = +L/2 (s = z, and the plane's u runs along -z) */
function faceToWorld(face, L, s, d, out = 0){ const y = TOP - d; return face === 'z' ? V3(s, y, L/2 + out) : V3(L/2 + out, y, s); }
function buildEnv(){
  const L = V.L, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  V.soil.visible = false;
  const catcher = world.children.find(o => o.userData.ground === 'catcher'); if (catcher) catcher.position.y = BOT - .12;
  V.blob.position.y = BOT - .13;
  const dirt = new THREE.Mesh(new THREE.BoxGeometry(L + .02, FH, L + .02), new THREE.MeshStandardMaterial({ color:0x8A5A34, roughness:1 }));
  dirt.position.y = (TOP + BOT)/2; dirt.receiveShadow = true; env.add(dirt);
  V.faces = {};
  for (const face of ['z', 'x']) {
    const tex = drawFace(face, L), m = new THREE.Mesh(new THREE.PlaneGeometry(L, FH), new THREE.MeshStandardMaterial({ map:tex, roughness:.95, emissive:0xFFFFFF, emissiveMap:tex, emissiveIntensity:.08 }));
    if (face === 'x') { m.rotation.y = Math.PI/2; m.position.set(L/2 + .012, (TOP + BOT)/2, 0); tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; tex.offset.x = 1; }
    else m.position.set(0, (TOP + BOT)/2, L/2 + .012);
    m.receiveShadow = true; env.add(m); V.faces[face] = m;
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(L + .06, FH + .08), new THREE.MeshBasicMaterial({ map:GLASS_TEX, transparent:true, depthWrite:false }));
    GLASS_TEX.repeat.x = 1; if (face === 'x') { gl.rotation.y = Math.PI/2; gl.position.set(L/2 + .05, (TOP + BOT)/2 + .01, 0); } else gl.position.set(0, (TOP + BOT)/2 + .01, L/2 + .05);
    gl.renderOrder = 6; env.add(gl);
  }
  // the wooden frame: corner posts, a top lip under the tiles and a plinth
  const fa = new Acc(), h = L/2 + .06;
  for (const [x, z] of [[h, h], [h, -h], [-h, h]]) fa.add(new RoundedBoxGeometry(.12, FH + .2, .12, 2, .03), MAT.frame, _m.makeTranslation(x, (TOP + BOT)/2 - .04, z));
  fa.add(new RoundedBoxGeometry(L + .26, .14, L + .26, 2, .04), MAT.frameD, _m.makeTranslation(0, BOT - .06, 0));
  fa.add(new THREE.BoxGeometry(L + .14, .04, .06), MAT.frame, _m.makeTranslation(0, TOP - .06, h - .01));
  fa.add(new THREE.BoxGeometry(.06, .04, L + .14), MAT.frame, _m.makeTranslation(h - .01, TOP - .06, 0));
  fa.into(env);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) V.framePts.push(V3(sx*(h + .1), BOT - .14, sz*(h + .1)));
  tunnelAnts();
}
function onImpact(){
  if (!V || !V.faces) return; for (const face of ['z', 'x']) { const m = V.faces[face], old = m.material.map, t = drawFace(face, V.L);
    if (face === 'x') { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; } m.material.map = t; m.material.emissiveMap = t; m.material.needsUpdate = true; old.dispose(); }
  tunnelAnts();
}

/* ══════════ life: ants on trails (surface) and in the glass tunnels, ladybirds, butterflies ══════════ */
function trail(pts, n, opt = {}){
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V3(x, TILE_TOP + .005, z)), true, 'centripetal'), len = curve.getLength();
  const ants = []; for (let i=0;i<n;i++){ const a = opt.lady ? makeLadybird(opt.len || .22) : makeAnt(opt.len || .2, opt.mat || MAT.ant, { leaf:opt.leaf && i%2 === 0 ? MAT.leafL : null, seed:opt.seed && i%3 === 1 });
    a.userData.ph = i*1.7; world.add(a); V.life.push(a); ants.push(a); }
  const tr = { ants, curve, len, sp:opt.sp || .22, gap:opt.gap || .32, arrive:1 }; (V.trails || (V.trails = [])).push(tr); return tr;
}
function walkTrails(t){
  (V && V.trails || []).forEach(tr => tr.ants.forEach((a, i) => {
    const vis = tr.arrive*tr.ants.length > i; if (!vis) { a.scale.setScalar(.001); return; }
    const u = (((t*tr.sp - i*tr.gap)/tr.len) % 1 + 1) % 1, p = tr.curve.getPointAt(u), d = tr.curve.getTangentAt(u);
    a.position.copy(p); a.rotation.y = Math.atan2(d.x, d.z); stepLegs(a, t);
    const pop = Math.min(1, (tr.arrive*tr.ants.length - i)); a.scale.setScalar(Math.max(.001, pop)); }));
  (V && V.tants || []).forEach(ta => { const path = ta.path, n = path.length - 1, w = ((t*ta.sp + ta.ph) % (2*n) + 2*n) % (2*n), f = w < n ? w : 2*n - w, i = Math.min(n - 1, Math.floor(f)), k = f - i;
    const a = path[i], b = path[i + 1], s = a[0] + (b[0] - a[0])*k, dd = a[1] + (b[1] - a[1])*k, dir = w < n ? 1 : -1;
    const pos = faceToWorld(ta.face, V.L, s, dd, .03), fw = ta.face === 'z' ? V3((b[0] - a[0])*dir, -(b[1] - a[1])*dir, 0) : V3(0, -(b[1] - a[1])*dir, (b[0] - a[0])*dir);
    fw.normalize(); const up = ta.face === 'z' ? V3(0, 0, 1) : V3(1, 0, 0), x = up.clone().cross(fw);
    ta.ant.position.copy(pos); ta.ant.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, fw)); stepLegs(ta.ant, t); ta.ant.scale.setScalar(Math.max(.001, ta.arrive)); });
}
/* ants in the glass: each follows a revealed shaft down and back up (ambient ones are rebuilt as the tunnels deepen) */
function tunnelAnts(){
  (V.tants || []).filter(ta => !ta.resident).forEach(ta => world.remove(ta.ant));
  const res = (V.tants || []).filter(ta => ta.resident), p = progress(), L = V.L; V.tants = res;
  [['z', 0], ['x', 0], ['z', 1]].forEach(([face, k], i) => { const pth = NET[face].paths[k]; if (!pth) return;
    const pts = pth.pts.filter((q, j) => j === 0 || pth.need + (j - 1)*.105 <= p);
    if (pts.length < 2 || Math.abs(pts[0][0]) > L/2 - .15) return;
    const ant = makeAnt(.16, MAT.ant); ant.userData.ph = i*3; world.add(ant); V.life.push(ant);
    V.tants.push({ face, path:pts, ant, sp:.9 + i*.15, ph:i*2.3, arrive:1 }); });
}
const LOOP_A = [[.15, .15], [.05, .75], [-.55, 1.05], [-.95, .75], [-.55, .4]];                             // colony door ↔ first dig site
const LOOP_W = [[2.5, 2.5], [2.5, -1.2], [1.5, -2.5], [-1.2, -2.5], [-2.5, -1.2], [-2.5, 2.5], [.4, 2.95], [1.6, 2.6]];
const LOOP_L = [[2.2, -1.45], [2.95, -.4], [2.95, 2.95], [0, 2.95], [-.3, 2.5], [1.2, 2.45], [2.45, 1.6], [2.5, -.6]];
function ambientAnts(){
  V.trails = []; V.tants = []; V.ladies = [];
  trail(LOOP_A, 5, { len:.17, sp:.2, gap:.3, seed:true });
  addButterflies(); tunnelAnts(); walkTrails(2.1); flyButterflies(2.1);
}
function residentGroups(){
  return [
    () => { if (V.L < 7) return []; const tr = trail(LOOP_W, 12, { len:.22, sp:.28, gap:.42, seed:true }); tr.arrive = 0; return [tr]; },
    () => { if (V.L < 7) return []; const tr = trail(LOOP_L, 7, { len:.24, mat:MAT.antRed, leaf:true, sp:.24, gap:.5 }); tr.arrive = 0; return [tr]; },
    () => { const out = []; for (const [face, k] of [['x', 1], ['z', 2], ['x', 2], ['z', 3]]) { const pth = NET[face].paths[k]; if (!pth) continue;
      const ant = makeAnt(.16, MAT.antRed); world.add(ant); V.life.push(ant); const ta = { face, k, path:pth.pts, ant, sp:1, ph:k*1.3, arrive:0, resident:true }; V.tants.push(ta); out.push(ta); } return out; },
    () => { if (V.L < 7) return []; const tr = trail([[-1.6, 1.9], [-.9, 1.4], [-1.4, .9], [-2.1, 1.3]], 2, { lady:true, len:.26, sp:.08, gap:1.4 }); tr.arrive = 0; return [tr]; }
  ];
}
async function antsMoveIn(walk){
  const groups = residentGroups(); V.residentsIn = true;
  for (let i=0;i<groups.length;i++){
    const rs = groups[i]();
    if (!walk) { rs.forEach(f => f.arrive = 1); continue; }
    await new Promise(res => tween(S.rm ? 1 : 1500, t => rs.forEach(f => f.arrive = t), () => { rs.forEach(f => f.arrive = 1);
      const f = rs[0], p = f ? (f.ants ? f.ants[0].position.clone() : f.ant.position.clone()) : V3(0, .5, 0); sparkle(p.setY(p.y + .3), 10, 0xFFF0B0, .5); res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = groups.length;
}

/* decor: meadow tufts + flowers, and crumbs / pebbles / seeds on empty cells */
function antDecor(slots){
  meadowDecor(slots, { tuft: r => [r() < .5 ? 'Grass_Common_Short' : (r() < .5 ? 'Clover_1' : 'Grass_Wispy_Short'), 0], flowers:true });
  const r = rngFrom(23);
  world.children.filter(o => o.userData.decor === 'meadow').forEach(grp => { const [x, z] = grp.userData.cell, p = cellPos(x, z), a = new Acc();
    if (r() < .5) blob(a, MAT.pebble, V3(p.x + (r() - .5)*.5, TILE_TOP + .02, p.z + (r() - .5)*.5), .06, .6, 0, r);
    for (let i=0;i<2;i++) a.add(new RoundedBoxGeometry(.06, .04, .05, 1, .01), MAT.crumb, _m.compose(V3(p.x + (r() - .5)*.6, TILE_TOP + .02, p.z + (r() - .5)*.6), Y(r()*3), _s));
    a.into(grp); });
}

const ICON = '<svg viewBox="0 0 24 24" width="19" height="19"><rect x="3" y="8" width="18" height="13" rx="2" fill="#A8703F"/><rect x="3" y="6" width="18" height="3" rx="1.2" fill="#88C052"/><path d="M8 9v4h5v3h-3v3M13 13h4" fill="none" stroke="#3A2213" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17.5" cy="17.5" r="1.8" fill="#3A2213"/></svg>';
const SIL = '<g fill="currentColor"><rect x="14" y="44" width="100" height="74" rx="6" opacity=".45"/><rect x="10" y="36" width="108" height="12" rx="4"/><path d="M42 48v22h22v16h-12v14M64 70h20v12" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="88" cy="96" rx="10" ry="6"/><circle cx="46" cy="20" r="6"/><ellipse cx="58" cy="22" rx="5" ry="4"/><ellipse cx="72" cy="22" rx="9" ry="7"/></g>';

export default {
  id:'ants', name:'Ant farm', title:'Your ant farm',
  season:36, dates:'17–30 May', nextIn:14,
  kits:['a'],
  ground:{ tile:{ top:['#93C257','#8BBA50'], side:'#86AE4C', soilTop:'#8A5A34', soilBot:'#5B3A22' } },
  families:{
    water:   { label:'dew drops & puddles',  tag:'Water' },
    building:{ label:'mounds & stores',       tag:'Building' },
    path:    { label:'crumb trails & fences', tag:'Path' },
    crop:    { label:'dig sites',             tag:'Dig' },
    tree:    { label:'giant flowers',         tag:'Flower' },
    special: { label:"the queen's chamber",   tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  icon:ICON, silhouette:SIL,
  album:{ image:'assets/ants/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#F1E6D2)' },
  css:'.phone[data-theme="ants"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#F6EEDF 58%,#EADBC0 100%)}',

  build(g, s, opt){
    if (s.kind === 'dig') {
      const slab = new THREE.Mesh(G.field, MAT.bed); slab.position.y = .035; slab.castShadow = slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab);
      const host = new THREE.Group(); host.position.y = .07; host.scale.setScalar(1.2); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillDig(host, s, st);
      fillDig(host, s, opt.stage ?? cropStage(s.id));
    } else B[s.b](g, s, opt);
  },
  scaleOf: s => s.kind === 'dig' ? 1.2 : 1,
  contact: s => s.kind === 'ant' && !['path', 'fence', 'queen'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && s.v === 3),
  decor: antDecor,
  env: buildEnv,
  onImpact,
  ambient: ambientAnts,
  tick(t){ walkTrails(t); flyButterflies(t); },

  residents:[ { id:'workers', name:'Workers', n:12 }, { id:'leafcutters', name:'Leafcutters', n:7 }, { id:'diggers', name:'Diggers', n:4 }, { id:'ladybirds', name:'Ladybirds', n:2 } ],
  moveIn: antsMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('ants:'+d.id, () => { const o = d.id === 'ladybirds' ? makeLadybird(1) : makeAnt(1, d.id === 'workers' ? MAT.ant : MAT.antRed, { leaf:d.id === 'leafcutters' ? MAT.leafL : null, seed:d.id === 'workers' });
      o.rotation.y = .9; return o; }, 168); },
  residentRig(d){
    const o = d.id === 'ladybirds' ? makeLadybird(.26) : makeAnt(.22, d.id === 'workers' ? MAT.ant : MAT.antRed, { leaf:d.id === 'leafcutters' ? MAT.leafL : null });
    return { obj:o, mixer:new THREE.AnimationMixer(o), clip:null, facing:0 }; }
};
