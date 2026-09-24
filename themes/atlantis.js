/* ATLANTIS (?theme=atlantis) — a glowing underwater CITY in deep-blue water. Same 7×7 ring blueprint, camera and lights as the
   farm (every farm slot id maps to a city piece, hero moved to the right-hand corner as in farm). Everything built here is
   procedural flat-shaded three.js (marble, gold, glass domes, bioluminescent glow), merged per material. Residents: procedural
   submarines + whales, and Quaternius Animated Fish (Dolphin, Fish2; CC0, already in assets/reef/). Distinct from the reef:
   navy water instead of turquoise, a marble mosaic floor instead of sand, a city of domes/columns/towers instead of coral + wrecks,
   drifting plankton + jellyfish instead of bubble streams. */
import * as THREE from 'three';
import { rngFrom, TEX, addSway, CAM_DIR, world, fx } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { ANIMCACHE, loader } from '../engine/kit.js';
import { G, Acc, seg, blob, _up, _q, _m, _s } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { FARM_SLOTS, FARM_ORDER } from './farm.js';
import { makeFish } from './reef.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z), EU = (x, y, z) => new THREE.Euler(x, y, z);
const AM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.72, metalness:0, flatShading:true, ...o });
const MAT = {
  marble:AM(0xEEF2F6), marbleB:AM(0xCBD7E4), marbleD:AM(0x8EA3BD), stone:AM(0x5D7593), rock:AM(0x4A5E7C), rockD:AM(0x34465F),
  gold:AM(0xF2C95E, { emissive:0x8A5A00, emissiveIntensity:.45, roughness:.38, metalness:.25 }),
  teal:AM(0x3FA7B8), roof:AM(0x2F7F9E),
  glass:new THREE.MeshStandardMaterial({ color:0xA6ECFF, emissive:0x2FB8E6, emissiveIntensity:.25, roughness:.08, transparent:true, opacity:.26, depthWrite:false }),
  winC:AM(0xCFFAFF, { emissive:0x49E2FF, emissiveIntensity:1.25 }),
  winW:AM(0xFFF3C8, { emissive:0xFFC75A, emissiveIntensity:1.1 }),
  core:AM(0xD8FDFF, { emissive:0x6FF0FF, emissiveIntensity:1.7 }),
  pool:AM(0x7FE9FF, { emissive:0x1FB4E0, emissiveIntensity:.95, roughness:.15 }),
  pearl:new THREE.MeshStandardMaterial({ color:0xFFFBF4, emissive:0xE8E2FF, emissiveIntensity:.7, roughness:.2 }),
  bubble:new THREE.MeshStandardMaterial({ color:0xE8FBFF, emissive:0x9FEFFF, emissiveIntensity:.5, roughness:.05, transparent:true, opacity:.55, depthWrite:false }),
  tessB:AM(0x3C7FC4), tessT:AM(0x39B8C9), tessG:AM(0xF2C95E, { emissive:0x6A4800, emissiveIntensity:.3 })
};
const NO_SHADOW = new Set([MAT.glass, MAT.bubble, MAT.core, MAT.pool]);
/* bioluminescent palettes: body / glow tip */
const BIO = { cyan:[0x2E8CA8, 0x7FF6FF], violet:[0x6B4FC4, 0xE3B8FF], pink:[0xC0508E, 0xFFB8E4], green:[0x2E9A7A, 0xA8FFD8], gold:[0xC08A2E, 0xFFE59A] };
const CM = {}; const cm = (hex, glow) => CM[hex+':'+glow] || (CM[hex+':'+glow] = glow ? AM(hex, { emissive:hex, emissiveIntensity:glow }) : AM(hex));
const SWM = {}; function swayMat(hex, h, amp, glow){ const k = hex+':'+h+':'+amp+':'+glow; if (SWM[k]) return SWM[k];
  const m = AM(hex, { side:THREE.DoubleSide, ...(glow ? { emissive:hex, emissiveIntensity:glow } : {}) }); addSway(m, h, amp); return SWM[k] = m; }
/* Acc.into + no shadows from glass / glow */
function into(acc, g){ const n0 = g.children.length; acc.into(g); g.children.slice(n0).forEach(m => { if (NO_SHADOW.has(m.material)) { m.castShadow = false; m.renderOrder = 3; } }); return g; }
function glow(g, x, y, z, sc, color = 0x9FF4FF, op = .8){
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false }));
  sp.position.set(x, y, z); sp.scale.setScalar(sc); sp.renderOrder = 9; g.add(sp); return sp; }

/* ── primitives ── */
const cyl = (a, mat, x, y, z, rt, rb, h, n = 12) => a.add(new THREE.CylinderGeometry(rt, rb, h, n), mat, _m.makeTranslation(x, y + h/2, z));
const box = (a, mat, x, y, z, w, h, d, ry = 0) => a.add(new THREE.BoxGeometry(w, h, d), mat, _m.compose(V3(x, y + h/2, z), _q.setFromEuler(EU(0, ry, 0)), _s));
const dome = (a, mat, x, y, z, r, sy = 1, n = 18) => a.add(new THREE.SphereGeometry(r, n, 8, 0, Math.PI*2, 0, Math.PI/2), mat, _m.compose(V3(x, y, z), _q.identity(), V3(1, sy, 1)));
const cone = (a, mat, x, y, z, r, h, n = 8) => a.add(new THREE.ConeGeometry(r, h, n), mat, _m.makeTranslation(x, y + h/2, z));
const ring = (a, mat, x, y, z, R, t) => a.add(new THREE.TorusGeometry(R, t, 5, 20).rotateX(Math.PI/2), mat, _m.makeTranslation(x, y, z));
function column(a, x, y, z, h, r = .04){
  box(a, MAT.marbleB, x, y, z, r*2.7, .03, r*2.7); cyl(a, MAT.marble, x, y + .03, z, r*.92, r, h - .07, 8); box(a, MAT.marbleB, x, y + h - .04, z, r*2.6, .04, r*2.6); }
function colRing(a, x, z, y, R, n, h, r, skip){ for (let i=0;i<n;i++){ const t = i/n*Math.PI*2 + .2; if (skip && skip(t)) continue; column(a, x + Math.cos(t)*R, y, z + Math.sin(t)*R, h, r); } }
/* window band on a round drum: n small glowing panes facing out */
function winBand(a, mat, x, z, y, R, n, w, h, off = 0){ for (let i=0;i<n;i++){ const t = i/n*Math.PI*2 + off;
  a.add(new THREE.BoxGeometry(w, h, .03), mat, _m.compose(V3(x + Math.cos(t)*R, y + h/2, z + Math.sin(t)*R), _q.setFromEuler(EU(0, Math.PI/2 - t, 0)), _s)); } }
function crystal(a, x, y, z, r){ a.add(new THREE.OctahedronGeometry(r, 0), MAT.core, _m.compose(V3(x, y + r*1.4, z), _q.identity(), V3(.7, 1.4, .7))); }
function bubbles(a, rng, n, x, z, y0, h){ for (let i=0;i<n;i++) a.add(new THREE.SphereGeometry(.02 + rng()*.025, 8, 6), MAT.bubble, _m.makeTranslation(x + (rng()-.5)*.08, y0 + i/n*h, z + (rng()-.5)*.08)); }
function polyps(a, rng, n, R, y = .02, cx = 0, cz = 0){ for (let i=0;i<n;i++){ const t = rng()*6.28, d = R*(.5 + rng()*.5), p = V3(cx + Math.cos(t)*d, y, cz + Math.sin(t)*d);
  const pal = Object.values(BIO)[i % 5]; seg(a, cm(pal[0]), p, _up, .04 + rng()*.05, .014, .01, 5); blob(a, cm(pal[1], .9), p.clone().setY(y + .06 + rng()*.03), .018); } }

/* ── coral towers (Sudoku / Math): grow a tier per stage, crowned with a crystal when ripe ── */
const TOWER = { Corn:['spiral','pink'], Carrot:['tiered','gold'], Lettuce:['bulb','cyan'], Beet:['twin','violet'] };
const TOWER_NAME = { Corn:'Spiral tower', Carrot:'Tiered tower', Lettuce:'Bulb tower', Beet:'Twin towers' };
function towerStack(a, kind, pal, stage, x, z, rng, rMul = 1){
  const [bc, tc] = BIO[pal], body = cm(bc), lip = cm(tc, .35); let y = .0;
  for (let i=0;i<stage;i++){ const r = (.24 - i*.028)*rMul, h = .15;
    if (kind === 'bulb') { a.add(new THREE.SphereGeometry(r*.95, 12, 8), body, _m.compose(V3(x, y + h*.55, z), _q.identity(), V3(1, .72, 1))); winBand(a, MAT.winC, x, z, y + h*.42, r*.93, 6, .045, .05, i); }
    else if (kind === 'spiral') { const tw = i*.5; a.add(new THREE.CylinderGeometry(r*.84, r, h, 6), body, _m.compose(V3(x + Math.sin(i*1.3)*.02, y + h/2, z), _q.setFromEuler(EU(0, tw, 0)), _s));
      winBand(a, MAT.winC, x, z, y + .05, r*.9, 3, .05, .06, tw); }
    else { cyl(a, body, x, y, z, r*.86, r, h, 10); winBand(a, kind === 'tiered' ? MAT.winW : MAT.winC, x, z, y + .045, r*.9, 5, .045, .06, i*.4); }
    cyl(a, lip, x, y + h, z, r*.98, r*1.06, .025, 12); y += h + .025; }
  if (stage >= 5) { cone(a, cm(tc, .5), x, y, z, .07*rMul, .14); crystal(a, x, y + .1, z, .045*rMul); }
  else { crystal(a, x, y, z, .028*rMul); }
  return y;
}
function fillTower(host, s, stage){
  host.clear();
  const r = rngFrom(s.x*31 + s.z*7 + 5), [kind, pal] = TOWER[s.crop], a = new Acc();
  let top;
  if (kind === 'twin') { top = towerStack(a, 'tiered', pal, stage, -.12, -.08, r, .72); towerStack(a, 'tiered', 'cyan', Math.max(1, stage - 1), .15, .12, r, .62);
    if (stage >= 3) box(a, MAT.gold, .02, .24, .02, .05, .03, .36, Math.PI/4); }
  else top = towerStack(a, kind, pal, stage, 0, 0, r);
  polyps(a, r, 3 + stage, .38, .0);
  into(a, host); if (stage >= 3) glow(host, kind === 'twin' ? -.12 : 0, top + .12, kind === 'twin' ? -.08 : 0, .3 + stage*.05, BIO[pal][1], .7);
  host.userData.stage = stage;
}

/* ── bioluminescent "trees" (Vocab): lantern coral, glow kelp, sea lilies ── */
function branch(a, body, tip, p, dir, len, r, depth, rng){
  const end = p.clone().addScaledVector(dir, len); seg(a, body, p, dir, len, r, r*.72, 5);
  if (depth <= 0) { blob(a, tip, end, r*2.1, 1, 1); return; }
  for (let i=0;i<2;i++){ const ax = V3(rng()-.5, 0, rng()-.5).cross(dir).normalize(); const nd = dir.clone().applyAxisAngle(ax.lengthSq() ? ax : V3(1,0,0), .5 + rng()*.35).lerp(_up, .3).normalize();
    branch(a, body, tip, end, nd, len*.78, r*.7, depth-1, rng); }
}
const TREE = {
  lantern(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z*13), pal = BIO[s.pal || 'violet'];
    blob(a, MAT.rock, V3(0, .02, 0), .2, .42, 0, r);
    branch(a, cm(pal[0]), cm(pal[1], 1.1), V3(0, .05, 0), _up.clone(), .3, .06, 4, r);
    polyps(a, r, 4, .36); into(a, g); glow(g, 0, .85, 0, .9, pal[1], .45); },
  kelp(g, s){ const a = new Acc(), r = rngFrom(s.x*17 + s.z*5), H = s.tall ? 1.5 : 1.25, n = s.tall ? 5 : 4;
    blob(a, MAT.rockD, V3(0, .02, 0), .2, .4, 0, r);
    for (let k=0;k<n;k++){ const h = H*(.62 + r()*.38), ph = r()*6, bx = (r()-.5)*.26, bz = (r()-.5)*.26;
      const pg = new THREE.PlaneGeometry(.09, h, 1, 12), pos = pg.attributes.position;
      for (let i=0;i<pos.count;i++){ const y = pos.getY(i) + h/2, w = 1 - .5*(y/h); pos.setXYZ(i, pos.getX(i)*w + Math.sin(y*5 + ph)*.045, y, Math.sin(y*3 + ph)*.03 + pos.getX(i)*.4); }
      a.add(pg, swayMat([0x1F6F7A, 0x2A8A86, 0x236E8C][k%3], H, .05, .12), _m.compose(V3(bx, .04, bz), _q.setFromEuler(EU(0, r()*3, 0)), _s));
      for (let b=1;b<4;b++) blob(a, cm(0x8CFFE8, 1.3), V3(bx + Math.sin(h*b/4*5 + ph)*.045, .04 + h*b/4.2, bz), .026); }
    into(a, g); glow(g, 0, H*.6, 0, .8, 0x8CFFE8, .35); },
  lily(g, s){ const a = new Acc(), r = rngFrom(s.x*11 + s.z*3), pal = BIO[s.pal || 'pink'];
    blob(a, MAT.rock, V3(0, .02, 0), .18, .45, 0, r);
    for (let k=0;k<3;k++){ const t = k*2.1 + r(), bx = Math.cos(t)*.13, bz = Math.sin(t)*.13, h = .7 + r()*.45; let p = V3(bx, .04, bz);
      const dir = V3(Math.cos(t)*.25, 1, Math.sin(t)*.25).normalize();
      for (let j=0;j<4;j++){ const d = dir.clone().lerp(V3(Math.cos(t + j)*.3, 1, Math.sin(t + j)*.3), .5).normalize(); seg(a, cm(0x7C8FB8), p, d, h/4, .024, .02, 5); p = p.clone().addScaledVector(d, h/4); }
      for (let i=0;i<7;i++){ const ang = i/7*Math.PI*2, d = V3(Math.cos(ang)*.8, .7, Math.sin(ang)*.8).normalize();
        seg(a, cm(pal[0]), p, d, .15, .02, .008, 4); blob(a, cm(pal[1], 1.2), p.clone().addScaledVector(d, .15), .016); }
      blob(a, cm(pal[1], 1), p.clone().setY(p.y + .02), .035); }
    polyps(a, r, 3, .34); into(a, g); glow(g, 0, .95, 0, .8, pal[1], .4); }
};

/* ── the city: buildings, water, paths, the palace ── */
const B = {
  greatdome(g){                                      // ring-1 hero: a glass dome over a glowing city, on a colonnade
    const a = new Acc(), r = rngFrom(3);
    cyl(a, MAT.marbleD, 0, 0, 0, .9, .93, .06, 24); cyl(a, MAT.marbleB, 0, .06, 0, .82, .86, .08, 24);
    for (let i=0;i<3;i++) box(a, MAT.marble, .6 + i*.06, .0, .6 + i*.06, .5, .14 - i*.045, .08, Math.PI/4);       // front steps
    cyl(a, MAT.marble, 0, .14, 0, .58, .6, .12, 24);
    colRing(a, 0, 0, .14, .7, 14, .48, .042);
    cyl(a, MAT.marbleB, 0, .62, 0, .76, .76, .06, 24); ring(a, MAT.gold, 0, .68, 0, .72, .018);
    // inside the dome: a tiny glowing city
    cyl(a, MAT.marble, 0, .26, 0, .12, .14, .5, 10); winBand(a, MAT.winC, 0, 0, .5, .13, 6, .04, .1); dome(a, MAT.teal, 0, .76, 0, .12); crystal(a, 0, .86, 0, .05);
    [[.3,.1,.22],[-.28,.18,.2],[.05,-.3,.18],[-.1,.32,.16],[.28,-.22,.2]].forEach(([x,z,h]) => { box(a, MAT.marble, x, .26, z, .12, h, .12); box(a, MAT.winW, x + .061, .3, z, .005, .05, .05); box(a, MAT.winW, x, .3, z + .061, .05, .05, .005); dome(a, MAT.roof, x, .26 + h, z, .07); });
    dome(a, MAT.glass, 0, .68, 0, .74, .82, 28);
    cone(a, MAT.gold, 0, 1.28, 0, .05, .2); blob(a, MAT.core, V3(0, 1.5, 0), .045);
    polyps(a, r, 5, .9, .02); into(a, g); glow(g, 0, .7, 0, 1.3, 0x8FF3FF, .55); glow(g, 0, 1.5, 0, .35, 0xCFFBFF, .9); },
  spire(g){ const a = new Acc();
    cyl(a, MAT.stone, 0, 0, 0, .3, .33, .06, 8); cyl(a, MAT.marbleB, 0, .06, 0, .22, .26, .12, 8);
    let y = .18; [[.17,.34],[.14,.3],[.11,.26],[.08,.2]].forEach(([rr, h], i) => { cyl(a, MAT.marble, 0, y, 0, rr*.85, rr, h, 8); winBand(a, i%2 ? MAT.winW : MAT.winC, 0, 0, y + h*.35, rr*.9, 4, .04, h*.35, i*.4);
      ring(a, MAT.gold, 0, y + h, 0, rr*.9, .012); y += h; });
    cone(a, MAT.gold, 0, y, 0, .06, .12); crystal(a, 0, y + .1, 0, .06);
    into(a, g); glow(g, 0, y + .2, 0, .6, 0x9FF4FF, .8); },
  bubblehouse(g){ const a = new Acc(), r = rngFrom(5);
    cyl(a, MAT.stone, 0, 0, 0, .36, .38, .05, 16); cyl(a, MAT.marble, 0, .05, 0, .28, .3, .16, 16);
    winBand(a, MAT.winW, 0, 0, .09, .29, 5, .06, .07, .3); box(a, MAT.teal, .2, .05, .2, .12, .13, .03, Math.PI/4);
    dome(a, MAT.roof, 0, .21, 0, .27, .9); dome(a, MAT.glass, 0, .21, 0, .31, 1.05);
    blob(a, MAT.core, V3(0, .43, 0), .04); bubbles(a, r, 4, .05, -.05, .55, .4);
    polyps(a, r, 3, .44); into(a, g); glow(g, 0, .35, 0, .5, 0xFFE9A8, .5); },
  temple(g){ const a = new Acc(), r = rngFrom(9);
    box(a, MAT.stone, 0, 0, 0, .78, .05, .66); box(a, MAT.marbleB, 0, .05, 0, .7, .06, .58);
    for (const cx of [-.27, -.09, .09, .27]) for (const cz of [-.2, .2]) column(a, cx, .11, cz, .42, .035);
    box(a, MAT.marble, 0, .12, 0, .38, .3, .26); box(a, MAT.winW, 0, .16, .131, .12, .18, .01);
    box(a, MAT.marbleB, 0, .53, 0, .72, .05, .56);
    a.add(new THREE.CylinderGeometry(.2, .2, .6, 3).rotateX(-Math.PI/2).scale(2.1, .55, 1), MAT.marble, _m.makeTranslation(0, .635, 0));
    blob(a, MAT.gold, V3(0, .75, 0), .03);
    polyps(a, r, 3, .44); into(a, g); },
  lanterntower(g){ const a = new Acc();
    box(a, MAT.stone, 0, 0, 0, .52, .05, .52); let y = .05;
    [[.34,.3],[.28,.26],[.22,.22]].forEach(([w, h]) => { box(a, MAT.marble, 0, y, 0, w, h, w);
      box(a, MAT.winW, w/2 + .004, y + h*.28, 0, .01, h*.46, .08); box(a, MAT.winW, 0, y + h*.28, w/2 + .004, .08, h*.46, .01);
      box(a, MAT.winW, -w/2 - .004, y + h*.28, 0, .01, h*.46, .08); box(a, MAT.winW, 0, y + h*.28, -w/2 - .004, .08, h*.46, .01);
      box(a, MAT.gold, 0, y + h, 0, w + .03, .02, w + .03); y += h + .02; });
    dome(a, MAT.teal, 0, y, 0, .13); cone(a, MAT.gold, 0, y + .11, 0, .03, .14); blob(a, MAT.core, V3(0, y + .3, 0), .035);
    into(a, g); glow(g, 0, y + .3, 0, .4, 0xFFE9A8, .8); },
  hall(g){ const a = new Acc(), r = rngFrom(12);          // an open colonnade round a glowing mosaic floor
    cyl(a, MAT.stone, 0, 0, 0, .44, .46, .05, 16); cyl(a, MAT.marbleB, 0, .05, 0, .4, .42, .04, 16); cyl(a, MAT.pool, 0, .09, 0, .22, .22, .006, 16);
    colRing(a, 0, 0, .09, .34, 8, .4, .032); ring(a, MAT.marble, 0, .5, 0, .34, .035); ring(a, MAT.gold, 0, .535, 0, .34, .012);
    dome(a, MAT.glass, 0, .5, 0, .36, .55, 16); blob(a, MAT.pearl, V3(0, .14, 0), .05);
    into(a, g); glow(g, 0, .2, 0, .6, 0x8FF3FF, .6); },
  fountain(g){ const a = new Acc(), r = rngFrom(21);    // Breathe: a bubble fountain
    cyl(a, MAT.marbleB, 0, 0, 0, .38, .4, .12, 8); cyl(a, MAT.pool, 0, .1, 0, .33, .33, .025, 16);
    column(a, 0, .1, 0, .26, .04); cyl(a, MAT.marble, 0, .36, 0, .15, .06, .07, 10); cyl(a, MAT.pool, 0, .425, 0, .13, .13, .01, 12);
    blob(a, MAT.pearl, V3(0, .47, 0), .045); bubbles(a, r, 6, 0, 0, .56, .6); bubbles(a, r, 3, .2, .12, .16, .3);
    into(a, g); glow(g, 0, .2, 0, .8, 0x7FE9FF, .5); },
  vent(g){ const a = new Acc(), r = rngFrom(33);          // Breathe: a glowing vent breathing bubbles
    blob(a, MAT.rock, V3(0, .05, 0), .3, .45, 1, r); blob(a, MAT.rockD, V3(-.05, .22, .02), .2, .9, 1, r); blob(a, MAT.rock, V3(.02, .42, 0), .14, 1, 1, r);
    cyl(a, MAT.rockD, 0, .5, 0, .09, .13, .12, 7); cyl(a, MAT.core, 0, .615, 0, .07, .07, .01, 10);
    bubbles(a, r, 7, 0, 0, .68, .7); polyps(a, r, 6, .4, .02);
    into(a, g); glow(g, 0, .66, 0, .7, 0x9FFFE8, .8); },
  moonpool(g){ const a = new Acc(), r = rngFrom(41);
    box(a, MAT.marbleB, 0, 0, 0, .8, .09, .8); box(a, MAT.pool, 0, .09, 0, .62, .005, .62);
    ring(a, MAT.gold, 0, .1, 0, .16, .012); blob(a, MAT.pearl, V3(0, .12, 0), .05, .5);
    for (const [x, z] of [[-.34, -.34], [.34, .34]]) { column(a, x, .09, z, .34, .03); blob(a, MAT.core, V3(x, .47, z), .045); }
    into(a, g); glow(g, -.34, .47, -.34, .35, 0x9FF4FF, .8); glow(g, .34, .47, .34, .35, 0x9FF4FF, .8); glow(g, 0, .14, 0, .8, 0x7FE9FF, .45); },
  anemones(g){ const a = new Acc(), t = new Acc(), r = rngFrom(51);
    [[-.18, -.12, 'violet', 1], [.2, -.05, 'cyan', .85], [-.02, .22, 'pink', .75]].forEach(([x, z, pk, k]) => { const pal = BIO[pk];
      blob(a, MAT.rock, V3(x, .02, z), .15*k, .5, 0, r); seg(a, cm(pal[0]), V3(x, .04, z), _up, .1*k, .07*k, .09*k, 9);
      for (let i=0;i<12;i++){ const ang = i/12*6.28, d = V3(Math.cos(ang)*.7, 1, Math.sin(ang)*.7).normalize(), p = V3(x + Math.cos(ang)*.06*k, .13*k, z + Math.sin(ang)*.06*k);
        _q.setFromUnitVectors(_up, d); t.add(new THREE.CylinderGeometry(.006, .018, .18*k, 5, 3).translate(0, .09*k, 0), swayMat(pal[0], .3, .09), _m.compose(p, _q, _s));
        blob(t, cm(pal[1], 1.3), p.clone().addScaledVector(d, .18*k), .016); } });
    polyps(a, r, 3, .42); into(a, g); into(t, g); glow(g, 0, .25, 0, .8, 0xD8B8FF, .35); },
  path(g, s){ const slab = new THREE.Mesh(G.path, MAT.marble); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
    const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0, T = [MAT.tessB, MAT.tessT, MAT.tessG];
    if (v === 0) { for (let i=0;i<16;i++){ const t = i/16*Math.PI*2; box(a, T[i%2], Math.cos(t)*.3, .035, Math.sin(t)*.3, .06, .01, .06, -t); }
      for (let i=0;i<8;i++){ const t = i/8*Math.PI*2; box(a, MAT.tessG, Math.cos(t)*.16, .035, Math.sin(t)*.16, .05, .01, .05, -t); } blob(a, MAT.pearl, V3(0, .05, 0), .04, .6); }
    else if (v === 1) { for (let i=0;i<5;i++) for (let j=0;j<5;j++) if ((i+j)%2) box(a, T[(i*j)%3], (i-2)*.17, .035, (j-2)*.17, .08, .01, .08);
      for (let i=0;i<3;i++) blob(a, MAT.pearl, V3((r()-.5)*.6, .05, (r()-.5)*.6), .03); }
    else { for (let i=0;i<7;i++) box(a, T[i%3], -.36 + i*.12, .035, -.36 + i*.12, .07, .01, .07, Math.PI/4);
      column(a, .28, .035, -.28, .36, .028); blob(a, MAT.core, V3(.28, .43, -.28), .04); }
    into(a, g); if (v === 2) glow(g, .28, .43, -.28, .35, 0x9FF4FF, .8); g.userData.ghostMode = 'marker'; },
  colrow(g, s){ const a = new Acc();                          // To-dos edge: a low colonnade with glowing orbs
    for (let i=0;i<s.len;i++){ const c = i - (s.len-1)/2;
      for (const o of [-.28, .28]) { const [x, z] = s.edge === 'w' ? [-.42, c + o] : [c + o, .42]; column(a, x, 0, z, .36, .034); blob(a, MAT.core, V3(x, .4, z), .03); }
      const [x, z] = s.edge === 'w' ? [-.42, c] : [c, .42]; box(a, MAT.marbleB, x, .36, z, s.edge === 'w' ? .08 : .66, .035, s.edge === 'w' ? .66 : .08); }
    into(a, g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz); },
  palace(g){                                        // Gita: the sunken palace, lit from within
    const a = new Acc(), r = rngFrom(99);
    box(a, MAT.stone, 0, 0, 0, 1.86, .07, 1.86); box(a, MAT.marbleD, 0, .07, 0, 1.7, .07, 1.7); box(a, MAT.marbleB, 0, .14, 0, 1.52, .06, 1.52);
    for (let i=0;i<3;i++) { box(a, MAT.marble, .78 - i*.04, 0, 0, .1, .2 - i*.06, .5); box(a, MAT.marble, 0, 0, .78 - i*.04, .5, .2 - i*.06, .1); }
    // main hall + colonnade + great dome
    cyl(a, MAT.marble, 0, .2, 0, .44, .46, .56, 20); winBand(a, MAT.winW, 0, 0, .3, .45, 10, .07, .2, .15);
    colRing(a, 0, 0, .2, .6, 16, .56, .04);
    cyl(a, MAT.marbleB, 0, .76, 0, .66, .66, .06, 24); ring(a, MAT.gold, 0, .82, 0, .64, .02);
    cyl(a, MAT.marble, 0, .82, 0, .42, .46, .16, 20); winBand(a, MAT.winC, 0, 0, .86, .43, 12, .05, .08);
    dome(a, MAT.gold, 0, .98, 0, .43, .95, 24); ring(a, MAT.marble, 0, 1.0, 0, .43, .02);
    for (let i=0;i<8;i++){ const t = i/8*Math.PI*2; a.add(new THREE.TorusGeometry(.42, .012, 4, 16, Math.PI/2), MAT.marbleB, _m.compose(V3(0, .98, 0), _q.setFromEuler(EU(0, t, 0)), V3(1, .95, 1))); }
    cyl(a, MAT.marble, 0, 1.38, 0, .06, .08, .1, 8); cone(a, MAT.gold, 0, 1.48, 0, .05, .24); blob(a, MAT.core, V3(0, 1.8, 0), .07);
    // four corner towers
    for (const [x, z] of [[-.64, -.64], [.64, -.64], [-.64, .64], [.64, .64]]) {
      cyl(a, MAT.marble, x, .2, z, .12, .14, .78, 10); winBand(a, MAT.winC, x, z, .5, .13, 4, .035, .16, Math.PI/4);
      ring(a, MAT.gold, x, .98, z, .13, .014); dome(a, MAT.teal, x, .98, z, .13, 1.1); cone(a, MAT.gold, x, 1.12, z, .025, .14); blob(a, MAT.core, V3(x, 1.28, z), .03); }
    // glowing forecourt pool
    cyl(a, MAT.pool, .52, .2, .52, .14, .14, .005, 14); ring(a, MAT.gold, .52, .205, .52, .14, .01);
    polyps(a, r, 7, .92, .02);
    into(a, g);
    glow(g, 0, 1.8, 0, .8, 0xCFFBFF, .95); glow(g, 0, .5, 0, 1.6, 0xFFD890, .35); glow(g, 0, 1.2, 0, 1.4, 0x8FF3FF, .35);
    for (const [x, z] of [[-.64, -.64], [.64, -.64], [-.64, .64], [.64, .64]]) glow(g, x, 1.28, z, .3, 0xCFFBFF, .8);
  }
};

/* blueprint: every farm slot id → a city piece (same cells, rings and order as the farm, hero in the right-hand corner) */
const MAP = {
  bigbarn:{ name:'Great dome', b:'greatdome' }, well:{ name:'Bubble fountain', b:'fountain' }, apple1:{ name:'Lantern coral', t:'lantern', pal:'cyan' },
  silo:{ name:'Crystal spire', b:'spire' }, silohouse:{ name:'Bubble house', b:'bubblehouse' }, coop:{ name:'Sea temple', b:'temple' },
  watertower:{ name:'Glow vent', b:'vent' }, pump:{ name:'Moon pool', b:'moonpool' }, apple2:{ name:'Glow kelp', t:'kelp' },
  berry1:{ name:'Sea lily', t:'lily', pal:'pink' }, peepal:{ name:'Sunken palace', b:'palace' }, smallbarn:{ name:'Lantern tower', b:'lanterntower' },
  openbarn:{ name:'Pearl hall', b:'hall' }, pond:{ name:'Glow anemones', b:'anemones' }, orange1:{ name:'Lantern coral', t:'lantern', pal:'violet' },
  apple3:{ name:'Glow kelp', t:'kelp' }, berry2:{ name:'Sea lily', t:'lily', pal:'green' }, orange2:{ name:'Lantern coral', t:'lantern', pal:'pink' },
  apple4:{ name:'Glow kelp', t:'kelp', tall:true }
};
const PATH_V = { path3_4:0, path1_2:1, path5_2:2, path3_5:1, path3_0:0, path2_6:2, path3_6:0 };
const SLOTS = FARM_SLOTS.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') return { ...s, kind:'tower', crop:f.crop, name:TOWER_NAME[f.crop], stages:5 };
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'city', b:'path', v, name:['Mosaic path','Pearl mosaic','Lamp path'][v] }; }
  if (f.kind === 'fence') return { ...s, kind:'city', b:'colrow', edge:f.edge, len:f.len, name:'Column row' };
  return { ...s, kind:'city', ...MAP[f.id] };
});

/* ── the look: marble mosaic tiles on a dark-stone block inside a DEEP navy water cube; plankton, jellyfish, soft cyan rays ── */
const TILE = { top:['#CFE6EC','#C4DDE5'], side:'#A7C3CF', soilTop:'#566F8E', soilBot:'#16223A' };
function tileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(38);
  g.fillStyle = '#F5F8FB'; g.fillRect(0,0,N,N);
  const n = 8, s = N/n;
  for (let i=0;i<n;i++) for (let j=0;j<n;j++){ const v = r(); g.fillStyle = v < .08 ? 'rgba(240,200,90,.35)' : v < .2 ? 'rgba(80,150,210,.14)' : `rgba(255,255,255,${.2 + r()*.3})`; g.fillRect(i*s + 2, j*s + 2, s - 4, s - 4); }
  g.strokeStyle = 'rgba(70,100,140,.16)'; g.lineWidth = 2;
  for (let i=0;i<=n;i++){ g.beginPath(); g.moveTo(i*s, 0); g.lineTo(i*s, N); g.stroke(); g.beginPath(); g.moveTo(0, i*s); g.lineTo(N, i*s); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const causticTex = (() => {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N), r = rngFrom(61);
  const P = Array.from({ length:16 }, () => [r()*N, r()*N]);
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){ let d1 = 1e9, d2 = 1e9;
    for (const [px,py] of P) for (let ox=-1;ox<=1;ox++) for (let oy=-1;oy<=1;oy++){ const dx = x - px - ox*N, dy = y - py - oy*N, d = dx*dx + dy*dy; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    const e = Math.sqrt(d2) - Math.sqrt(d1), v = Math.pow(Math.max(0, 1 - e/6), 2.6), i = (y*N + x)*4;
    im.data[i] = im.data[i+1] = im.data[i+2] = 255; im.data[i+3] = v*255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
const rayTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const v = g.createLinearGradient(0,0,0,256); v.addColorStop(0,'rgba(255,255,255,0)'); v.addColorStop(.3,'rgba(255,255,255,.6)'); v.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = v; g.fillRect(0,0,64,256); g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0,0,64,0); h.addColorStop(0,'rgba(0,0,0,0)'); h.addColorStop(.5,'rgba(0,0,0,1)'); h.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle = h; g.fillRect(0,0,64,256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const bubbleTex = (() => { const s = 64, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  const gr = g.createRadialGradient(s/2, s/2, s*.2, s/2, s/2, s*.46); gr.addColorStop(0,'rgba(255,255,255,.08)'); gr.addColorStop(.8,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(s/2, s/2, s*.46, 0, 6.3); g.fill();
  g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(s*.38, s*.36, s*.08, s*.05, -.6, 0, 6.3); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const WU = { uYb:{ value:0 }, uYt:{ value:2 } };
function waterMat(back){
  return new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side: back ? THREE.BackSide : THREE.FrontSide, uniforms:WU,
    vertexShader:'varying vec2 vUv; varying float vY; varying vec3 vN; void main(){ vUv = uv; vN = normal; vec4 w = modelMatrix * vec4(position,1.); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader:`uniform float uYb; uniform float uYt; varying vec2 vUv; varying float vY; varying vec3 vN;
      void main(){ float h = clamp((vY - uYb)/(uYt - uYb), 0., 1.);
        vec3 deep = vec3(.01,.10,.40), mid = vec3(.03,.28,.66), shallow = vec3(.14,.52,.86);
        vec3 col = h < .55 ? mix(deep, mid, h/.55) : mix(mid, shallow, (h-.55)/.45);
        float e = max(abs(vUv.x - .5), abs(vUv.y - .5)) * 2.;
        float rim = smoothstep(.93, 1., e);
        float top = step(.5, vN.y);
        float a = ${back ? '.30 + .18*(1.-h)' : '.30 + .24*(1.-h)'} + rim*${back ? '.10' : '.30'};
        if (top > .5) { col = mix(shallow, vec3(.75,.95,1.), .3); a = ${back ? '.08' : '.18'} + rim*.3; }
        col = mix(col, vec3(.55,.95,1.), rim*.6);
        gl_FragColor = vec4(col, a); }` });
}
function buildEnv(){
  const L = V.L, top = Math.max(1.35 + (V.ring-1)*.32, Math.max(...V.boxes.map(b => b.max.y)) + .12), yb = -.1;
  WU.uYb.value = yb; WU.uYt.value = top;
  const env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env; V.waterTop = top;
  const h = L/2 + .02; for (const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) V.framePts.push(V3(sx*(h+.04), top, sz*(h+.04)));
  const bx = new THREE.BoxGeometry(L + .08, top - yb, L + .08).translate(0, (top + yb)/2, 0);
  const back = new THREE.Mesh(bx, waterMat(true)); back.renderOrder = -1;
  const front = new THREE.Mesh(bx, waterMat(false)); front.renderOrder = 8;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(bx), new THREE.LineBasicMaterial({ color:0x9FF4FF, transparent:true, opacity:.6, depthWrite:false })); edges.renderOrder = 9;
  env.add(back, front, edges);
  const cmat = new THREE.MeshBasicMaterial({ map:causticTex, color:0x7FE9FF, transparent:true, opacity:.2, blending:THREE.AdditiveBlending, depthWrite:false });
  causticTex.repeat.set(L/1.2, L/1.2);
  const caus = new THREE.Mesh(new THREE.PlaneGeometry(L - .04, L - .04).rotateX(-Math.PI/2), cmat); caus.position.y = TILE_TOP + .004; caus.renderOrder = 1; env.add(caus); V.caustic = cmat;
  V.rays = []; const rr = rngFrom(8);
  for (let i=0;i<3;i++){ const w = .3 + rr()*.25, hh = (top - TILE_TOP)*.9;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, hh).translate(0, -hh/2, 0), new THREE.MeshBasicMaterial({ map:rayTex, color:0x9FDFFF, transparent:true, opacity:.28 + rr()*.1, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending }));
    s.rotation.set(0, Math.atan2(CAM_DIR.x, CAM_DIR.z), 0); s.rotateZ(.22); const m0 = L/2 - .5;
    s.position.set(-m0 + i*m0 + .2, top - .02, m0*(i%2 ? .4 : -.5)); s.renderOrder = 10; s.userData.base = s.material.opacity; s.userData.ph = i*2.1; env.add(s); V.rays.push(s); }
  // bioluminescent plankton: drifting glow motes through the whole cube
  V.plankton = []; const pr = rngFrom(17), cols = [0x8FFFF0, 0x9FD8FF, 0xC8A8FF, 0xA8FFC8];
  for (let i=0;i<26 + V.ring*12;i++){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:cols[i%4], transparent:true, opacity:.85, blending:THREE.AdditiveBlending, depthWrite:false }));
    sp.userData = { x:(pr()-.5)*(L - .3), z:(pr()-.5)*(L - .3), y:TILE_TOP + .25 + pr()*(top - .5), ph:pr()*6.28, sz:.06 + pr()*.07, sp:.2 + pr()*.3 };
    sp.renderOrder = 10; env.add(sp); V.plankton.push(sp); }
  drift(2.1);
}
function drift(t){
  if (!V) return;
  (V.plankton || []).forEach(p => { const u = p.userData; p.position.set(u.x + Math.sin(t*u.sp + u.ph)*.12, u.y + Math.sin(t*u.sp*.7 + u.ph*2)*.1, u.z + Math.cos(t*u.sp + u.ph)*.12);
    p.scale.setScalar(u.sz*(.8 + .35*Math.sin(t*2 + u.ph))); p.material.opacity = .55 + .35*Math.sin(t*1.3 + u.ph); });
  (V.rays || []).forEach(s => s.material.opacity = s.userData.base * (.7 + .3*Math.sin(t*.5 + s.userData.ph)));
  if (V.caustic) V.caustic.map.offset.set(Math.sin(t*.12)*.4 + t*.01, Math.cos(t*.1)*.35);
  MAT.core.emissiveIntensity = 1.5 + .35*Math.sin(t*1.4);
}
function bubbleBurst(pos, n = 10){
  for (let i=0;i<n;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: i%3 ? bubbleTex : TEX.glow, color: i%3 ? 0xFFFFFF : 0x9FF4FF, transparent:true, opacity:.95, depthWrite:false, blending: i%3 ? THREE.NormalBlending : THREE.AdditiveBlending })); s.renderOrder = 10;
    const a = i/n*6.28, d = .15 + Math.random()*.35, sz = .05 + Math.random()*.06, rise = 1 + Math.random()*.8; s.position.copy(pos); fx.add(s);
    tween(1300 + Math.random()*500, t => { const e = 1 - Math.pow(1-t, 2); s.position.set(pos.x + Math.cos(a)*d*e + Math.sin(t*9+i)*.04, pos.y + .1 + t*rise, pos.z + Math.sin(a)*d*e);
      s.scale.setScalar(sz*(.6 + t*.6)); s.material.opacity = .95*(1 - t*t); }, () => { fx.remove(s); s.material.dispose(); }); }
}
/* decor: little glowing polyps + seagrass on empty cells, a single lamp stone on waiting ones */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(23);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    const tuft = (px, pz, n) => { for (let i=0;i<n;i++){ const h = .1 + r()*.12, pg = new THREE.PlaneGeometry(.022, h, 1, 2).translate(0, h/2, 0);
      a.add(pg, swayMat([0x2F8A8A, 0x3A9C9A][i%2], .3, .12, .15), _m.compose(V3(px + (r()-.5)*.08, TILE_TOP, pz + (r()-.5)*.08), _q.setFromEuler(EU((r()-.5)*.4, r()*6, 0)), _s)); } };
    if (!sl || sl === 'later') { tuft(p.x - .2, p.z + .15, 5); tuft(p.x + .22, p.z - .2, 4); polyps(a, r, 4, .36, TILE_TOP, p.x, p.z);
      if (r() < .5) blob(a, MAT.rock, V3(p.x + (r()-.5)*.4, TILE_TOP + .02, p.z + (r()-.5)*.4), .07, .6, 0, r);
      into(a, grp); grp.userData.decor = 'meadow'; }
    else if (!placed.includes(sl.id) && AMBIENT()) { tuft(p.x + .3, p.z + .3, 3); if (sl.b !== 'path') polyps(a, r, 2, .4, TILE_TOP, p.x, p.z);
      into(a, grp); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else world.remove(grp);
  }
}

/* ── life: jellyfish (ambient), submarines + whales (procedural residents), dolphins + a fish school (Quaternius) ── */
function makeJelly(size, pk){
  const pal = BIO[pk], root = new THREE.Group(), bell = new THREE.Group(); root.add(bell);
  const bm = new THREE.MeshStandardMaterial({ color:pal[1], emissive:pal[0], emissiveIntensity:.9, transparent:true, opacity:.72, roughness:.2, depthWrite:false });
  const b = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 8, 0, Math.PI*2, 0, Math.PI/2), bm); b.scale.y = .8; bell.add(b);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(size*.95, size*.08, 4, 16).rotateX(Math.PI/2), cm(pal[1], 1.2)); bell.add(rim);
  const tm = new THREE.MeshBasicMaterial({ color:pal[1], transparent:true, opacity:.6, side:THREE.DoubleSide, depthWrite:false });
  for (let i=0;i<6;i++){ const t = i/6*Math.PI*2, L = size*(2.2 + (i%3)*.5), pg = new THREE.PlaneGeometry(size*.12, L, 1, 8).translate(0, -L/2, 0), pos = pg.attributes.position;
    for (let j=0;j<pos.count;j++){ const y = pos.getY(j); pos.setX(j, pos.getX(j) + Math.sin(y/size*2.2 + i)*size*.18); }
    const m = new THREE.Mesh(pg, tm); m.position.set(Math.cos(t)*size*.6, 0, Math.sin(t)*size*.6); m.rotation.y = -t; bell.add(m); }
  glow(root, 0, size*.3, 0, size*4, pal[1], .5);
  root.userData.bell = bell; return root;
}
function makeSub(len, hull){
  const g = new THREE.Group(), a = new Acc(), hm = cm(hull);
  a.add(new THREE.CapsuleGeometry(len*.2, len*.55, 6, 14).rotateX(Math.PI/2), hm, null);
  box(a, hm, 0, len*.16, -len*.04, len*.12, len*.16, len*.24); cyl(a, MAT.marbleD, 0, len*.32, len*.02, len*.012, len*.012, len*.14, 6);
  for (const z of [-len*.16, 0, len*.16]) for (const sx of [-1, 1]) a.add(new THREE.CylinderGeometry(len*.05, len*.05, .01, 12).rotateZ(Math.PI/2), MAT.winW, _m.makeTranslation(sx*len*.195, len*.03, z));
  box(a, hm, 0, -len*.02, -len*.46, len*.3, len*.03, len*.08); box(a, hm, 0, 0, -len*.46, len*.03, len*.24, len*.08);
  into(a, g);
  const prop = new THREE.Group(); prop.position.z = -len*.52; g.add(prop); const pa = new Acc();
  for (let i=0;i<3;i++) pa.add(new THREE.BoxGeometry(len*.03, len*.18, len*.01), MAT.gold, _m.compose(V3(0, 0, 0), _q.setFromEuler(EU(0, 0, i/3*Math.PI*2)), _s)); into(pa, prop);
  glow(g, 0, len*.02, len*.5, len*1.1, 0xFFF2C0, .75); g.userData.prop = prop; return g;
}
function makeWhale(len){
  const g = new THREE.Group(), a = new Acc(), body = cm(0x3F6FAE), belly = cm(0xD9E6F2), fin = cm(0x355F98);
  a.add(new THREE.SphereGeometry(1, 20, 12), body, _m.compose(V3(0, 0, 0), _q.identity(), V3(len*.17, len*.15, len*.42)));
  a.add(new THREE.SphereGeometry(1, 16, 10), belly, _m.compose(V3(0, -len*.045, len*.05), _q.identity(), V3(len*.14, len*.11, len*.34)));
  for (const sx of [-1, 1]) { a.add(new THREE.BoxGeometry(len*.2, len*.015, len*.07), fin, _m.compose(V3(sx*len*.19, -len*.06, len*.1), _q.setFromEuler(EU(0, sx*.5, sx*-.45)), _s));
    blob(a, cm(0x10223A), V3(sx*len*.12, len*.02, len*.3), len*.018); }
  box(a, fin, 0, len*.12, -len*.12, len*.015, len*.06, len*.09);
  for (let i=0;i<4;i++) blob(a, cm(0xBFE9FF, .6), V3((i-1.5)*len*.06, len*.1, len*.18 - i*.02*len), len*.012);
  into(a, g);
  const tail = new THREE.Group(); tail.position.z = -len*.34; g.add(tail); const ta = new Acc();
  ta.add(new THREE.SphereGeometry(1, 12, 8), body, _m.compose(V3(0, 0, -len*.1), _q.identity(), V3(len*.07, len*.07, len*.16)));
  for (const sx of [-1, 1]) ta.add(new THREE.BoxGeometry(len*.2, len*.014, len*.09), fin, _m.compose(V3(sx*len*.09, 0, -len*.25), _q.setFromEuler(EU(0, sx*-.5, 0)), _s));
  into(ta, tail); g.userData.tail = tail; return g;
}
const LEN = { Dolphin:.62, Fish2:.3, sub:.5, whale:1.1 };
async function loadFish(){ await Promise.all(['Fish1','Fish2','Dolphin'].map(async id => { if (!ANIMCACHE['_'+id]) ANIMCACHE['_'+id] = await loader.loadAsync('assets/reef/'+id+'.glb'); })); }
function makeSwimmer(id, len){
  if (id === 'sub') { const o = makeSub(len, 0xF4C84A); return { holder:o, mixer:null, kind:'sub' }; }
  if (id === 'sub2') { const o = makeSub(len, 0x4FC6C9); return { holder:o, mixer:null, kind:'sub' }; }
  if (id === 'whale') return { holder:makeWhale(len), mixer:null, kind:'whale' };
  if (id === 'jelly') return null;
  const f = makeFish(id, len); return f && { ...f, kind:'fish' };
}
function swimPos(u, t, out){ const a = t*u.sp + u.ph; return out.set(u.cx + Math.cos(a)*u.rx + u.ox, u.h + Math.sin(a*1.7 + u.ph)*u.bob, u.cz + Math.sin(a)*u.rz + u.oz); }
function addSwimmer(id, u, resident){
  const k = 1 + (V.ring-1)*.3, f = makeSwimmer(id, (u.len || LEN[id] || LEN.sub) * k); if (!f) return null;
  f.u = { cx:0, cz:0, rx:1, rz:1, ox:0, oz:0, h:1, bob:.06, sp:.4, ph:0, ...u }; f.resident = resident; f.arrive = resident ? 0 : 1;
  world.add(f.holder); (V.swim || (V.swim = [])).push(f); V.life.push(f.holder); return f;
}
function ambient(){
  V.swim = []; V.jellies = [];
  const R = V.ring, top = V.waterTop;
  [[-.6, .9, 'violet', .1], [1.1, -.4, 'pink', .085], [.2, -1.3, 'cyan', .075]].slice(0, R >= 2 ? 3 : 2).forEach(([x, z, pk, s], i) => {
    const j = makeJelly(s*(1 + (R-1)*.25), pk); j.userData.base = V3(x*R*.55, top*(.58 + i*.1), z*R*.55); j.userData.ph = i*2.3; world.add(j); V.jellies.push(j); V.life.push(j); });
  addSwimmer('Fish1', { cx:0, cz:0, rx:.8 + R*.45, rz:.6 + R*.4, h:top*.5, sp:-.3, ph:2.2, len:.36 });
  swim(2.1, 0);
}
function residentGroups(){
  const top = V.waterTop;
  return [
    () => [addSwimmer('sub', { cx:0, cz:0, rx:2.3, rz:2.0, h:top*.62, sp:.2, ph:.4, bob:.05 }, true), addSwimmer('sub2', { cx:.3, cz:-.2, rx:1.5, rz:1.7, h:top*.42, sp:-.26, ph:2.6, bob:.04, len:.42 }, true)],
    () => [addSwimmer('whale', { cx:0, cz:0, rx:2.5, rz:2.3, h:top*.84, sp:.12, ph:-1.2, bob:.08 }, true), addSwimmer('whale', { cx:0, cz:0, rx:2.5, rz:2.3, h:top*.8, sp:.12, ph:-.72, bob:.08, ox:.3, oz:.25, len:.6 }, true)],
    () => [0,1].map(i => addSwimmer('Dolphin', { cx:-.4, cz:.6, rx:1.6, rz:1.2, h:top*.55 + i*.12, sp:-.36, ph:i*.4, ox:i*.18, oz:-i*.12 }, true)),
    () => { const g = []; for (let i=0;i<8;i++) g.push(addSwimmer('Fish2', { cx:0, cz:0, rx:2.0, rz:1.7, h:top*.3, sp:.3, ph:1 + i*.1, ox:Math.sin(i*2.1)*.2, oz:Math.cos(i*1.7)*.18, bob:.04, len:.24 + (i%3)*.03 }, true)); return g; }
  ];
}
function swim(t, dt){
  if (!V) return;
  (V.swim || []).forEach(f => { const u = f.u, p = swimPos(u, t, V3(0,0,0)), q = swimPos(u, t + .05*Math.sign(u.sp || 1), V3(0,0,0));
    if (f.arrive < 1) { const from = f.from || (f.from = p.clone().add(V3(4.5, .6, 3.5))); const e = 1 - Math.pow(1 - f.arrive, 3); p.lerpVectors(from, p, e); }
    f.holder.position.copy(p); const d = q.sub(swimPos(u, t, V3(0,0,0))); f.holder.rotation.y = Math.atan2(d.x, d.z);
    if (f.kind === 'sub') f.holder.userData.prop.rotation.z = t*9;
    if (f.kind === 'whale') { f.holder.userData.tail.rotation.x = Math.sin(t*1.6 + u.ph)*.28; f.holder.rotation.x = Math.sin(t*1.6 + u.ph + 1)*.04; }
    if (f.mixer) f.mixer.update(dt); });
  (V.jellies || []).forEach(j => { const b = j.userData.base, ph = j.userData.ph, pulse = Math.sin(t*1.8 + ph);
    j.position.set(b.x + Math.sin(t*.2 + ph)*.25, b.y + Math.sin(t*.6 + ph)*.12 + Math.max(0, pulse)*.03, b.z + Math.cos(t*.17 + ph)*.25);
    j.userData.bell.scale.set(1 - pulse*.08, 1 + pulse*.1, 1 - pulse*.08); });
}
async function moveIn(walk){
  const groups = residentGroups(); V.residentsIn = true;
  for (let i=0;i<groups.length;i++){
    const sw = groups[i]().filter(Boolean);
    if (!walk) { sw.forEach(f => f.arrive = 1); continue; }
    await new Promise(res => tween(S.rm ? 1 : 1400, t => sw.forEach((f, j) => f.arrive = Math.min(1, Math.max(0, t*1.15 - j*.02))),
      () => { sw.forEach(f => f.arrive = 1); const p = sw[0].holder.position.clone(); sparkle(p, 10, 0x9FF4FF, .6); bubbleBurst(p, 8); res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = groups.length;
}

const ICON = '<svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 19.5h16" stroke="#2F6FB0" stroke-width="2" stroke-linecap="round"/><path d="M6.5 19V13a5.5 5.5 0 0 1 11 0v6" fill="#BFF3FF" stroke="#2F9BC9" stroke-width="1.8"/><path d="M12 7.5V4" stroke="#E7B43E" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="3.4" r="1.4" fill="#7FF0FF"/><path d="M9.5 19v-3.2M14.5 19v-3.2" stroke="#2F9BC9" stroke-width="1.6"/></svg>';
const SIL = '<g fill="currentColor"><rect x="10" y="112" width="108" height="8" rx="3"/><path d="M34 112V78a30 30 0 0 1 60 0v34z" opacity=".55"/><rect x="40" y="82" width="6" height="30"/><rect x="54" y="82" width="6" height="30"/><rect x="68" y="82" width="6" height="30"/><rect x="82" y="82" width="6" height="30"/><path d="M62 48h4v-18h-4z"/><circle cx="64" cy="26" r="5"/><rect x="12" y="62" width="12" height="50" rx="2"/><path d="M10 62a8 8 0 0 1 16 0z"/><rect x="104" y="70" width="12" height="42" rx="2"/><path d="M102 70a8 8 0 0 1 16 0z"/><circle cx="22" cy="24" r="3"/><circle cx="100" cy="34" r="2.4"/><circle cx="110" cy="18" r="1.8"/></g>';

export default {
  id:'atlantis', name:'Atlantis', title:'Your Atlantis',
  season:38, dates:'14–27 Jun', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'fountains & glow pools',  tag:'Fountain' },
    building:{ label:'domes & temples',         tag:'Building' },
    path:    { label:'mosaics & columns',       tag:'Mosaic' },
    crop:    { label:'coral towers',            tag:'Tower' },
    tree:    { label:'glow kelp & sea lilies',  tag:'Glow tree' },
    special: { label:'the sunken palace',       tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  // underwater rig: cool sea-green sky light, a softer blue-white key from the surface, teal fill, so the domes glow against deep water
  lights:{ hemi:{ sky:0xBDEBFF, ground:0x1F4E6E, intensity:1.45 }, sun:{ color:0xDDF4FF, intensity:1.9 }, fill:{ color:0x7CD4FF, intensity:.65 } },
  ground:{ tile:TILE, tileMap },
  icon:ICON, silhouette:SIL,
  album:{ image:'assets/atlantis/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#DCE7F6)' },
  css:'.phone[data-theme="atlantis"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#E1ECF9 58%,#C4D6F0 100%)}',

  async preload(){ await loadFish(); },
  build(g, s, opt){
    if (s.kind === 'tower') {             // Sudoku/Math → a coral tower on a marble plinth, a tier per stage
      const slab = new THREE.Mesh(G.field, MAT.marbleB); slab.position.y = .035; slab.scale.set(.96, .7, .96); slab.castShadow = slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab);
      const host = new THREE.Group(); host.position.y = .06; host.scale.setScalar(1.2); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillTower(host, s, st);
      fillTower(host, s, opt.stage ?? cropStage(s.id));
    } else if (s.t) TREE[s.t](g, s);
    else B[s.b](g, s);
  },
  scaleOf: s => s.kind === 'tower' ? 1.2 : 1,
  contact: s => !(s.b === 'path' || s.b === 'colrow'),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.cat === 'water',
  decor,
  env: buildEnv,
  ambient,
  tick(t, dt){ swim(t, dt); drift(t); },
  onImpact(pos, big){ bubbleBurst(pos, big ? 16 : 10); sparkle(pos.clone().setY(pos.y + .3), big ? 10 : 6, 0x9FF4FF, big ? 1 : .6); },

  residents:[ { id:'sub', name:'Submarines', n:2 }, { id:'whale', name:'Whales', n:2 }, { id:'Dolphin', name:'Dolphins', n:2 }, { id:'Fish2', name:'Fish school', n:8 } ],
  moveIn,
  residentThumb(d, thumbFor){
    if (d.id === 'sub' || d.id === 'whale') return thumbFor('atl:'+d.id, () => { const o = d.id === 'sub' ? makeSub(1, 0xF4C84A) : makeWhale(1); o.rotation.y = Math.PI/2 + .5; return o; }, 168);
    if (!ANIMCACHE['_'+d.id]) return '';
    return thumbFor('fish:'+d.id, () => { const f = makeFish(d.id, 1); f.mixer.update(.3); f.holder.rotation.y = Math.PI/2 + .5; return f.holder; }, 168); },
  residentRig(d){
    if (d.id === 'sub' || d.id === 'whale') { const o = d.id === 'sub' ? makeSub(LEN.sub*1.6, 0xF4C84A) : makeWhale(LEN.whale); return { obj:o, mixer:new THREE.AnimationMixer(o), clip:null, facing:Math.PI/2 }; }
    const f = makeFish(d.id, LEN[d.id]*1.6); if (!f) return null; if (f.clip) f.mixer.clipAction(f.clip).time = 0; return { obj:f.holder, mixer:f.mixer, clip:f.clip, facing:Math.PI/2 }; }
};
