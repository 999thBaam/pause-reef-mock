/* BEE KINGDOM (?theme=bees) — a honeycomb meadow on the farm's 7×7 ring blueprint (same cells, same ring counts 6 / 15 / 19,
   same order). As in jungle, the hero (the queen's hive) takes the LEFT corner (cells 0..1 × 5..6) so nothing stands in front
   of it, and the two farm slots it displaces move to the old peepal corner.
   Ground = waxy honeycomb tiles (canvas hex lattice) on an amber block. No CC0 kit has hives, skeps or honey, so every piece
   (honeycomb hall, wax tower, box hives, straw skep, beekeeper's hut, honey stall, bee bath, rain barrel, dew basin, lily pond,
   blossom / linden trees, sunflowers, hollyhocks, lavender, honey jars that fill and comb frames that cap stage by stage, the
   queen's hive) and the residents (a honey bear, bee swarms, the queen) are procedural three.js merged per material (Acc).
   Reused CC0 kit pieces (no new asset files): clover, flowers, grass, ferns = Quaternius Stylized Nature MegaKit (kit a). */
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
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.85, metalness:0, flatShading:true, ...o });
const MAT = {
  wax:FM(0xF4C94E), waxL:FM(0xFBE39A), waxD:FM(0xDDA232), cell:FM(0xB9781E),
  honey:FM(0xF2A51C, { roughness:.28, emissive:0x7A3E00, emissiveIntensity:.28 }),
  cap:FM(0xFCEAB0, { roughness:.6 }),
  glass:new THREE.MeshStandardMaterial({ color:0xFFF8EA, roughness:.08, metalness:0, transparent:true, opacity:.38, depthWrite:false }),
  glow:FM(0xFFD66B, { emissive:0xFFA41F, emissiveIntensity:1.25 }),
  straw:FM(0xE2B764), strawD:FM(0xC99A4C), strawL:FM(0xEFCF86),
  wood:FM(0x9A6A40), woodD:FM(0x6E4A2C), woodL:FM(0xC89A66),
  white:FM(0xF7F2E6), mint:FM(0xA6DCC6), pink:FM(0xF5B3C2), sky:FM(0xA9CBEB), butter:FM(0xF8E08E),
  roof:FM(0xCB6A45), roofD:FM(0xA8543A), cream:FM(0xF3E6CA), stone:FM(0xE4D6B8), stoneD:FM(0xC6B592), dark:FM(0x3A2A20),
  leaf:FM(0x6FAE45), leafL:FM(0x8CC458), leafD:FM(0x4E8F34), stem:FM(0x5E9A3A),
  bark:FM(0x8A6446), barkD:FM(0x6A4A32),
  sunY:FM(0xF7C531), sunO:FM(0xF09A27), sunC:FM(0x6A4424), lav:FM(0x9D84D6), lavD:FM(0x7E66C0),
  holly:FM(0xF28DB2), hollyL:FM(0xFBC4D6), clover:FM(0xFFF6F0), cloverP:FM(0xF2A8C8), daisy:FM(0xFFFDF6),
  red:FM(0xD9463B), redL:FM(0xF6E9E2), clay:FM(0xC8703E), terracotta:FM(0xD98A5A),
  water:new THREE.MeshStandardMaterial({ color:0x6CC6DE, roughness:.15, metalness:0, emissive:0x0E4C62, emissiveIntensity:.35 }),
  pad:FM(0x5E9E3A), bed:FM(0xA9CF7A, { roughness:1 }), cork:FM(0xC99C6A), dew:new THREE.MeshStandardMaterial({ color:0xE8FBFF, roughness:.05, transparent:true, opacity:.6, depthWrite:false }),
  gold:FM(0xF1C24E, { emissive:0x6A4A00, emissiveIntensity:.3, roughness:.35, metalness:.35 }),
  // bees + bear
  beeY:FM(0xF7C531), beeK:FM(0x2B2320), wing:FM(0xF4FAFF, { transparent:true, opacity:.8, side:THREE.DoubleSide, emissive:0xB8D8F0, emissiveIntensity:.25 }),
  eye:FM(0x1E1A18), bear:FM(0x9A6238), bearL:FM(0xE2BE8E), bearD:FM(0x5A3822), blush:FM(0xF0A08A)
};
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = FM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }

const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=12, ry=0){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z, ry)); }
/* hex prism with a FLAT face toward +z (three's 6-gon has a corner there, so turn it 30°) */
function hex(acc, mat, r, h, x=0, y=0, z=0){ cyl(acc, mat, r, r, h, x, y, z, 6, Math.PI/6); }
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }
function km(g, kit, name, h, w, x=0, y=0, z=0, rot=0){ const tpl = KITCACHE[kit] && KITCACHE[kit][name]; if (!tpl) return null;
  const k = fitScale(tpl, h, w), o = addModel(g, name, k, x, y, z, rot, kit); if (o) o.userData.top = y + tpl.size.y*k; return o; }
function leafGeo(len, w, arch){ const g = new THREE.PlaneGeometry(w, len, 1, 5).translate(0, len/2, 0), p = g.attributes.position;
  for (let i=0;i<p.count;i++){ const y = p.getY(i), t = y/len, ww = Math.sin(Math.PI*Math.min(1, t*1.05 + .05));
    p.setXYZ(i, p.getX(i)*ww, y*(1 - arch*t*.5), arch*t*t*len*.9); } g.computeVertexNormals(); return g; }
const drip = (acc, x, y, z, s=1) => { blob(acc, MAT.honey, V3(x, y - .02*s, z), .018*s, 1.9); blob(acc, MAT.honey, V3(x, y - .05*s, z), .012*s, 1.2); };

/* ── small things ── */
/* a static bee (for pieces): striped body, two wings, facing ry */
function bee(acc, x, y, z, s=1, ry=0){
  const m = new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V3(s, s, s)), add = (geo, mat, mx) => acc.add(geo, mat, m.clone().multiply(mx));
  add(new THREE.SphereGeometry(.03, 8, 6), MAT.beeY, at(0, 0, 0, 0, .9, .9, 1.25));
  add(new THREE.TorusGeometry(.026, .006, 4, 10), MAT.beeK, at(0, 0, -.006)); add(new THREE.TorusGeometry(.02, .006, 4, 10), MAT.beeK, at(0, 0, -.022));
  add(new THREE.SphereGeometry(.018, 8, 6), MAT.beeK, at(0, .004, .036));
  for (const sx of [-1, 1]) add(new THREE.SphereGeometry(.022, 6, 4), MAT.wing, at(sx*.022, .028, -.004, 0, .7, .18, 1, 0, sx*.5));
}
/* a flower sprig (procedural, deterministic): leaves + petals in one of the meadow colours */
const PETALS = () => [MAT.pink, MAT.daisy, MAT.sunY, MAT.lav, MAT.holly];
function flowers(acc, rng, x, z, s=1, y=0, kind=0){
  blob(acc, MAT.leafD, V3(x, y + .05*s, z), .075*s, .7, 1, rng); blob(acc, MAT.leaf, V3(x + .04*s, y + .07*s, z - .03*s), .05*s, .8, 1, rng);
  const fm = PETALS()[kind % 5];
  for (let i=0;i<6;i++){ const a = rng()*6.28, rr = .06*s; const p = V3(x + Math.cos(a)*rr, y + .09*s + rng()*.05*s, z + Math.sin(a)*rr);
    blob(acc, fm, p, .018*s, .6); blob(acc, MAT.sunY, p.clone().add(V3(0, .01*s, 0)), .007*s); }
}
function flowerSet(g, rng, x, z, s=1, kind=0, y=0){ const a = new Acc(); flowers(a, rng, x, z, s, y, kind); a.into(g); }
function clover(g, x, z, s=1, y=0, rot=0){ return km(g, 'a', 'Clover_1', .1*s, .26*s, x, y, z, rot); }
function flowerGroup(g, x, z, s=1, y=0, rot=0){ return km(g, 'a', 'Flower_4_Group', .2*s, .3*s, x, y, z, rot); }
/* coiled straw: a stack of tori tracing a profile [radius at t], t = 0 bottom … 1 top */
function coils(acc, y0, h, n, prof, tube=.042){
  for (let i=0;i<n;i++){ const t = (i + .5)/n, r = prof(t);
    acc.add(new THREE.TorusGeometry(Math.max(.02, r), tube, 6, 28).rotateX(Math.PI/2), i%2 ? MAT.straw : MAT.strawD, at(0, y0 + t*h, 0)); }
}
function honeyJar(acc, x, y, z, s, fill, capped){
  cyl(acc, MAT.glass, .07*s, .07*s, .15*s, x, y, z, 14);
  if (fill > 0) cyl(acc, MAT.honey, .064*s, .064*s, .145*s*fill, x, y + .003, z, 14);
  cyl(acc, MAT.glass, .055*s, .055*s, .02*s, x, y + .15*s, z, 14);
  if (capped) { cyl(acc, MAT.red, .06*s, .06*s, .022*s, x, y + .162*s, z, 14); acc.add(new THREE.CylinderGeometry(.066*s, .074*s, .02*s, 14, 1, true), MAT.redL, at(x, y + .158*s, z));
    acc.add(new THREE.TorusGeometry(.062*s, .005*s, 4, 16).rotateX(Math.PI/2), MAT.gold, at(x, y + .145*s, z)); }
}

/* ── the ground: waxy honeycomb tiles on an amber block ── */
const TILE = { top:['#F2CC6A', '#EEC45E'], side:'#E2A93C', soilTop:'#D9962E', soilBot:'#8A5418' };
function tileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0,0,N,N);
  const R = N/7.2, W = R*Math.sqrt(3);
  for (let row=-1; row<8; row++) for (let col=-1; col<6; col++){
    const cx = col*W + (row % 2 ? W/2 : 0), cy = row*R*1.5;
    const gr = g.createRadialGradient(cx - R*.25, cy - R*.3, 0, cx, cy, R); gr.addColorStop(0, 'rgba(255,255,245,.55)'); gr.addColorStop(.6, 'rgba(255,250,230,0)'); gr.addColorStop(1, 'rgba(150,90,10,.1)');
    g.beginPath(); for (let k=0;k<6;k++){ const a = Math.PI/6 + k*Math.PI/3; g.lineTo(cx + Math.cos(a)*R*.92, cy + Math.sin(a)*R*.92); } g.closePath();
    g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(160,95,15,.3)'; g.lineWidth = 3; g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ── buildings (Reading) ── */
/* Honeycomb hall (2×2): a cluster of wax hex towers, lit hex windows, an arched door, honey dripping from the eaves */
const HALL = [[0, 0, .92], [0, 1, .62], [1, 1, .52], [2, 1, .7], [3, 1, .48], [4, 1, .58], [5, 1, .66]];   // [face dir, ring, height]
function hall(g){
  const a = new Acc(), r = rngFrom(21), R = .3;
  hex(a, MAT.waxD, .95, .05, 0, 0, 0);
  HALL.forEach(([k, ring, h], i) => {
    const ang = k*Math.PI/3, d = ring ? R*Math.sqrt(3)*1.02 : 0, x = Math.sin(ang)*d, z = Math.cos(ang)*d;
    hex(a, i%2 ? MAT.wax : MAT.waxL, R*.98, h, x, .05, z); hex(a, MAT.waxD, R*1.02, .035, x, .05 + h, z); hex(a, MAT.cap, R*.8, .025, x, .085 + h, z);
    for (let j=0;j<3;j++){ const aa = r()*6.28; drip(a, x + Math.sin(aa)*R*.9, .07 + h, z + Math.cos(aa)*R*.9, 1.1); }
    if (i && k !== 0) { // a lit hex window on the outward face
      const fx = x + Math.sin(ang)*R*.86, fz = z + Math.cos(ang)*R*.86;
      a.add(new THREE.CylinderGeometry(.06, .06, .02, 6).rotateX(Math.PI/2), MAT.glow, at(fx, .05 + h*.55, fz, ang)); }
  });
  // the door on the front tower (+z), a landing board, a hex window on the centre tower
  const fz = R*Math.sqrt(3)*1.02 + R*.86;
  slab(a, MAT.woodD, .16, .2, .02, 0, .05, fz); a.add(new THREE.CylinderGeometry(.08, .08, .02, 12, 1, false, -Math.PI/2, Math.PI).rotateX(Math.PI/2), MAT.woodD, at(0, .25, fz));
  slab(a, MAT.wood, .26, .025, .12, 0, .05, fz + .06);
  a.add(new THREE.CylinderGeometry(.075, .075, .02, 6).rotateX(Math.PI/2), MAT.glow, at(.0, .72, R*.86 + .005));
  // a little crown of wax on the centre tower + a flag-less finial
  cyl(a, MAT.gold, .05, .02, .1, 0, 1.02, 0, 6); blob(a, MAT.gold, V3(0, 1.14, 0), .03);
  for (let i=0;i<5;i++) bee(a, (r()-.5)*1.3, .6 + r()*.6, (r()-.5)*1.3 + .2, 1.3, r()*6);
  a.into(g);
  glowSprite(g, V3(0, .15, fz + .05), .5, 0xFFB040, .45);
  const f = rngFrom(23); flowerSet(g, f, -.72, .72, 1, 0); flowerSet(g, f, .74, .66, .9, 2); clover(g, .8, -.7, 1.2); flowerGroup(g, -.8, -.5, 1);
}
function tower(g){
  const a = new Acc(), r = rngFrom(41);
  hex(a, MAT.waxD, .34, .05);
  [[.25, .3], [.21, .28], [.17, .24]].reduce((y, [rr, h], i) => { hex(a, i%2 ? MAT.wax : MAT.waxL, rr, h, 0, y, 0); hex(a, MAT.waxD, rr + .02, .025, 0, y + h, 0);
    for (let j=0;j<2;j++){ const aa = r()*6.28; drip(a, Math.sin(aa)*rr, y + h + .02, Math.cos(aa)*rr); }
    a.add(new THREE.CylinderGeometry(.045, .045, .02, 6).rotateX(Math.PI/2), MAT.glow, at(Math.sin(.5)*rr*.86, y + h*.5, Math.cos(.5)*rr*.86, .5));
    return y + h + .025; }, .05);
  a.add(new THREE.ConeGeometry(.2, .22, 6).rotateY(Math.PI/6), MAT.roof, at(0, 1.0, 0)); blob(a, MAT.gold, V3(0, 1.12, 0), .025);
  slab(a, MAT.woodD, .08, .12, .02, 0, .05, .23);
  bee(a, .25, .8, .1, 1.3, 1); bee(a, -.2, .55, .25, 1.3, 2.5);
  a.into(g); glowSprite(g, V3(.1, .55, .2), .35, 0xFFB040, .4); flowerSet(g, rngFrom(43), .3, .3, .8, 1);
}
function boxHive(g){
  const a = new Acc(), r = rngFrom(51);
  for (const [x, z] of [[-.16,-.14],[.16,-.14],[.16,.14],[-.16,.14]]) slab(a, MAT.woodD, .04, .12, .04, x, 0, z);
  const cols = [MAT.mint, MAT.pink, MAT.sky, MAT.butter]; let y = .12;
  [[.42, .14], [.42, .13], [.42, .1]].forEach(([w, h], i) => { slab(a, cols[i], w, h, w*.86, (i%2)*.01, y, 0); slab(a, MAT.white, w + .01, .012, w*.86 + .01, (i%2)*.01, y + h - .006, 0); y += h; });
  slab(a, MAT.roof, .5, .04, .44, 0, y); slab(a, MAT.roofD, .44, .03, .38, 0, y + .04);
  slab(a, MAT.dark, .2, .02, .02, 0, .14, .185); slab(a, MAT.wood, .26, .015, .1, 0, .12, .23);
  for (let i=0;i<4;i++) bee(a, (r()-.5)*.5, .2 + r()*.5, .3 + r()*.1, 1.3, r()*6);
  a.into(g); flowerSet(g, rngFrom(53), -.3, .32, .8, 2); clover(g, .3, .3, 1);
}
function skep(g){
  const a = new Acc(), r = rngFrom(61);
  cyl(a, MAT.woodD, .05, .05, .16, 0, 0, 0, 8); cyl(a, MAT.wood, .3, .3, .04, 0, .16, 0, 16);
  coils(a, .2, .5, 9, t => .26*Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.2))) + .03);
  blob(a, MAT.strawL, V3(0, .72, 0), .05, .7);
  a.add(new THREE.CylinderGeometry(.04, .04, .02, 12).rotateX(Math.PI/2), MAT.dark, at(0, .25, .27));
  for (let i=0;i<5;i++) bee(a, (r()-.5)*.6, .35 + r()*.5, .1 + r()*.3, 1.3, r()*6);
  a.into(g); flowerSet(g, rngFrom(63), .3, .3, .8, 0); flowerSet(g, rngFrom(64), -.32, .28, .7, 3);
}
function hut(g){
  const a = new Acc(), r = rngFrom(71);
  slab(a, MAT.stoneD, .6, .04, .52);
  slab(a, MAT.cream, .46, .3, .38, 0, .04); slab(a, MAT.woodD, .48, .025, .4, 0, .04);
  a.add(new THREE.ConeGeometry(.43, .3, 4).rotateY(Math.PI/4), MAT.roof, at(0, .49, 0, 0, 1, 1, .9));
  slab(a, MAT.clay, .07, .14, .07, .12, .44, -.08);
  slab(a, MAT.woodD, .12, .2, .02, -.08, .04, .19); blob(a, MAT.gold, V3(-.04, .14, .205), .01);
  a.add(new THREE.CylinderGeometry(.055, .055, .02, 6).rotateX(Math.PI/2), MAT.glow, at(.13, .22, .195));
  a.add(new THREE.CylinderGeometry(.05, .05, .02, 6).rotateX(Math.PI/2).rotateY(Math.PI/2), MAT.glow, at(.235, .22, 0));
  // a bench of jars by the door
  slab(a, MAT.wood, .2, .02, .08, .16, .1, .27); slab(a, MAT.woodD, .02, .1, .06, .08, 0, .27); slab(a, MAT.woodD, .02, .1, .06, .24, 0, .27);
  honeyJar(a, .12, .12, .27, .5, 1, true); honeyJar(a, .2, .12, .27, .5, .8, true);
  bee(a, -.25, .5, .2, 1.3, 1);
  a.into(g); flowerSet(g, rngFrom(73), -.3, .3, .7, 4); glowSprite(g, V3(.13, .22, .24), .3, 0xFFB040, .45);
}
function stall(g){
  const a = new Acc(), r = rngFrom(81);
  slab(a, MAT.wood, .5, .2, .24, 0, 0, .06); slab(a, MAT.woodL, .54, .025, .28, 0, .2, .06);
  for (const [x, z] of [[-.25,-.08],[.25,-.08],[-.25,.2],[.25,.2]]) slab(a, MAT.woodD, .03, .55, .03, x, 0, z);
  for (let i=0;i<6;i++) slab(a, i%2 ? MAT.white : MAT.sunY, .1, .025, .38, -.25 + i*.1 + .05, .58 + .02*Math.sin(i), .05, 0);
  a.add(bx(.6, .02, .03), MAT.sunY, at(0, .57, .25)); for (let i=0;i<6;i++) a.add(new THREE.CylinderGeometry(.045, .045, .02, 10, 1, false, 0, Math.PI).rotateX(Math.PI/2), i%2 ? MAT.white : MAT.sunY, at(-.25 + i*.1, .56, .26, 0, 1, 1, 1, 0, Math.PI));
  hex(a, MAT.waxL, .07, .02, 0, .62, .05); a.add(new THREE.CylinderGeometry(.07, .07, .02, 6).rotateX(Math.PI/2), MAT.wax, at(0, .7, .05));
  [[-.16, 1], [-.05, .9], [.06, 1], [.17, .7]].forEach(([x, f], i) => honeyJar(a, x, .225, .1 + (i%2)*.06, .55, f, true));
  cyl(a, MAT.terracotta, .08, .06, .12, .3, 0, .32, 12); drip(a, .3, .13, .39);
  bee(a, .1, .45, .3, 1.3, 2);
  a.into(g); flowerSet(g, rngFrom(83), -.32, .33, .7, 1);
}

/* ── water (Breathe) ── */
function bath(g){
  const a = new Acc(), r = rngFrom(91);
  cyl(a, MAT.stoneD, .16, .18, .04, 0, 0); cyl(a, MAT.stone, .06, .08, .26, 0, .04); cyl(a, MAT.stone, .34, .1, .08, 0, .28, 0, 18);
  cyl(a, MAT.water, .3, .3, .012, 0, .345, 0, 20);
  for (let i=0;i<6;i++){ const aa = i*1.1 + r(); blob(a, i%2 ? MAT.stone : MAT.stoneD, V3(Math.cos(aa)*.18, .355, Math.sin(aa)*.18), .03 + r()*.015, .6); }
  cyl(a, MAT.cork, .035, .035, .02, .06, .352, .08, 10); cyl(a, MAT.cork, .03, .03, .02, -.1, .352, -.04, 10);
  bee(a, .06, .39, .08, 1.2, 1); bee(a, -.1, .385, -.04, 1.2, 4);
  a.into(g); flowerSet(g, rngFrom(93), .3, .3, .8, 3); clover(g, -.28, .3, 1);
}
function barrel(g){
  const a = new Acc();
  const lathe = new THREE.LatheGeometry([0, .1, .2, .3, .4].map(t => new THREE.Vector2(.17 + Math.sin(t/.4*Math.PI)*.025, t)), 14);
  a.add(lathe, MAT.wood, at(-.08, 0, -.06));
  for (const y of [.06, .34]) a.add(new THREE.TorusGeometry(.18, .01, 4, 20).rotateX(Math.PI/2), MAT.barkD, at(-.08, y, -.06));
  cyl(a, MAT.water, .17, .17, .01, -.08, .39, -.06, 14);
  seg(a, MAT.barkD, V3(.04, .08, .08), V3(1, -.2, 1).normalize(), .08, .012, .01, 6);
  a.add(new THREE.CylinderGeometry(.006, .006, .06, 5), MAT.water, at(.1, .04, .14));
  hex(a, MAT.stone, .14, .05, .12, 0, .16); hex(a, MAT.water, .1, .052, .12, .005, .16);
  a.add(new THREE.CylinderGeometry(.06, .06, .008, 12, 1, false, .3, 5.6), MAT.pad, at(-.1, .398, -.1));
  bee(a, .14, .1, .18, 1.2, 1);
  a.into(g); flowerSet(g, rngFrom(95), -.3, .3, .8, 0); flowerGroup(g, .3, -.28, .9);
}
function basin(g){
  const a = new Acc(), r = rngFrom(97);
  hex(a, MAT.stoneD, .36, .1); hex(a, MAT.stone, .33, .04, 0, .1); hex(a, MAT.water, .28, .02, 0, .115);
  for (const [x, z] of [[-.1, .05], [.12, -.08]]) a.add(new THREE.CylinderGeometry(.07, .07, .008, 12, 1, false, .3, 5.6), MAT.pad, at(x, .14, z));
  for (let i=0;i<7;i++){ const aa = i/7*6.28; a.add(new THREE.ConeGeometry(.016, .045, 4), i%2 ? MAT.pink : MAT.hollyL, at(-.1 + Math.cos(aa)*.018, .16, .05 + Math.sin(aa)*.018, 0, 1, 1, 1, Math.sin(aa)*.6, -Math.cos(aa)*.6)); }
  blob(a, MAT.sunY, V3(-.1, .16, .05), .012);
  blob(a, MAT.dew, V3(.12, .155, -.08), .03, .8);
  bee(a, .2, .3, .15, 1.3, 2);
  a.into(g); flowerSet(g, rngFrom(99), .32, .32, .75, 2); clover(g, -.34, .3, 1);
}
function pond(g){
  const a = new Acc(), r = rngFrom(111);
  cyl(a, MAT.stoneD, .44, .46, .04, 0, 0, 0, 22); cyl(a, MAT.water, .4, .4, .02, 0, .035, 0, 22);
  for (let i=0;i<9;i++){ const aa = i/9*6.28 + r()*.3; blob(a, i%2 ? MAT.stone : MAT.stoneD, V3(Math.cos(aa)*.43, .04, Math.sin(aa)*.43), .045 + r()*.02, .6, 0, r); }
  for (let i=0;i<4;i++){ const aa = r()*6.28, d = .12 + r()*.18; const x = Math.cos(aa)*d, z = Math.sin(aa)*d;
    a.add(new THREE.CylinderGeometry(.065, .065, .008, 12, 1, false, .3, 5.6), MAT.pad, at(x, .05, z));
    if (i%2 === 0) { for (let k=0;k<7;k++){ const q = k/7*6.28; a.add(new THREE.ConeGeometry(.014, .04, 4), k%2 ? MAT.pink : MAT.daisy, at(x + Math.cos(q)*.015, .07, z + Math.sin(q)*.015, 0, 1, 1, 1, Math.sin(q)*.6, -Math.cos(q)*.6)); } blob(a, MAT.sunY, V3(x, .07, z), .01); } }
  for (let i=0;i<6;i++){ const L = .16 + r()*.1; seg(a, swayMat(0x6FA646, .3, .06), V3(-.38 + r()*.06, .03, -.3 + r()*.06), V3((r()-.5)*.3, 1, (r()-.5)*.3).normalize(), L, .01, .003, 4); }
  bee(a, .1, .2, .1, 1.2, 3);
  a.into(g);
}

/* ── trees & tall flowers (Vocab) ── */
function canopy(acc, rng, c, r, n, h, cols){
  for (let i=0;i<n;i++){ const ang = i/n*6.28 + rng()*.6, d = i ? r*(.45 + rng()*.25) : 0;
    const geo = new THREE.IcosahedronGeometry(r*(i ? .55 + rng()*.2 : .72), 1), p = geo.attributes.position;
    for (let k=0;k<p.count;k++){ const f = 1 + (rng()-.5)*.2; p.setXYZ(k, p.getX(k)*f, p.getY(k)*f, p.getZ(k)*f); }
    acc.add(geo, swayMat(cols[i % cols.length], h, .016), at(c.x + Math.cos(ang)*d, c.y + (i ? (rng()-.3)*r*.35 : r*.18), c.z + Math.sin(ang)*d, rng()*6, 1, .72, 1)); }
}
function blossom(g, s){
  const a = new Acc(), r = rngFrom(s.x*5 + s.z*13 + 1), h = s.h || 1.25, white = !!s.white;
  seg(a, MAT.bark, V3(0, 0, 0), V3(.05, 1, -.02), h*.5, .065, .045, 8);
  const top = V3(.03, h*.5, -.01); seg(a, MAT.barkD, top, V3(.7, .8, .2), .22, .035, .02, 6); seg(a, MAT.barkD, top, V3(-.6, .9, -.3), .2, .03, .02, 6);
  canopy(a, r, V3(.02, h*.72, 0), .36, 7, h, white ? [0xFFF3F4, 0xFBDCE4, 0xFFFFFF] : [0xF7B6C8, 0xF49AB4, 0xFBD0DC]);
  for (let i=0;i<14;i++){ const aa = r()*6.28, d = .1 + r()*.3; blob(a, white ? MAT.daisy : MAT.pink, V3(Math.cos(aa)*d, .075, Math.sin(aa)*d), .014, .3); }
  for (let i=0;i<3;i++) bee(a, (r()-.5)*.8, h*.55 + r()*.4, .3 + r()*.15, 1.3, r()*6);
  a.into(g); clover(g, -.28, .26, .9);
}
function linden(g, s){
  const a = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 2), h = s.h || 1.35;
  seg(a, MAT.bark, V3(0, 0, 0), _up, h*.46, .07, .05, 8);
  canopy(a, r, V3(0, h*.72, 0), .38, 8, h, [0x6FAE45, 0x5E9E3A, 0x86BE52]);
  for (let i=0;i<22;i++){ const aa = r()*6.28, e = r()*1.2 - .2, rr = .34; blob(a, MAT.butter, V3(Math.cos(aa)*rr*Math.cos(e), h*.72 + Math.sin(e)*rr*.6 + .04, Math.sin(aa)*rr*Math.cos(e)), .025, 1.3); }
  for (let i=0;i<3;i++) bee(a, (r()-.5)*.8, h*.5 + r()*.4, .35, 1.3, r()*6);
  a.into(g); flowerSet(g, rngFrom(s.x + 5), .28, .28, .75, 1);
}
function sunflowers(g, s){
  const a = new Acc(), r = rngFrom(s.x*3 + s.z*11 + 6);
  const spots = [[-.14, -.12, .95], [.14, -.06, .82], [-.02, .12, .7], [.22, .2, .55], [-.24, .2, .6]];
  spots.forEach(([x, z, h]) => {
    seg(a, MAT.stem, V3(x, 0, z), V3(0, 1, .04).normalize(), h, .018, .014, 6);
    for (let k=0;k<3;k++){ const ang = r()*6.28; a.add(leafGeo(.12, .08, .6), swayMat(0x5E9A3A, 1, .03), new THREE.Matrix4().compose(V3(x, h*(.25 + k*.2), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(1.1, ang, 0, 'YXZ')), V3(1,1,1))); }
    const face = V3(x, h, z + .02), tilt = .5;   // heads face the camera (+x+z), tipped a little down
    const m = new THREE.Matrix4().compose(face, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2 - tilt, Math.PI/4, 0, 'YXZ')), V3(1,1,1));
    a.add(new THREE.CylinderGeometry(.06, .07, .03, 16), MAT.sunC, m);
    for (let p=0;p<14;p++){ const q = p/14*6.28; a.add(new THREE.ConeGeometry(.028, .07, 4).rotateZ(-Math.PI/2).translate(.1, 0, 0).rotateY(q), p%2 ? MAT.sunY : MAT.sunO, m.clone().multiply(at(0, -.004, 0))); }
  });
  bee(a, .1, .8, .25, 1.3, 1); bee(a, -.18, .6, .3, 1.3, 3);
  a.into(g); clover(g, .3, -.3, .9);
}
function hollyhocks(g, s){
  const a = new Acc(), r = rngFrom(s.x*13 + s.z + 8);
  [[-.12, -.1, 1.0], [.12, -.04, .86], [0, .14, .72], [-.22, .18, .6], [.24, .2, .64]].forEach(([x, z, h], i) => {
    seg(a, MAT.stem, V3(x, 0, z), _up, h, .016, .01, 5);
    for (let k=0;k<3;k++){ const ang = r()*6.28; a.add(leafGeo(.1, .09, .5), swayMat(0x5E9A3A, 1, .03), new THREE.Matrix4().compose(V3(x, .06 + k*.08, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, ang, 0, 'YXZ')), V3(1,1,1))); }
    for (let k=0;k<7;k++){ const y = h*(.45 + k*.08), sz = .05*(1 - k*.09); const ang = r()*6.28;
      blob(a, k > 4 ? MAT.leafL : (i%2 ? MAT.holly : MAT.hollyL), V3(x + Math.cos(ang)*.02, y, z + Math.sin(ang)*.02), sz, .6); }
  });
  bee(a, .2, .75, .25, 1.3, 2); a.into(g); flowerSet(g, r, .3, .32, .6, 1);
}
function lavender(g, s){
  const a = new Acc(), r = rngFrom(s.x*17 + s.z*5 + 9);
  for (const [bx0, bz0, sc] of [[-.12, -.1, 1.1], [.16, .08, 1], [-.14, .2, .85], [.2, -.2, .8]]) {
    blob(a, MAT.leafD, V3(bx0, .09*sc, bz0), .15*sc, .7, 1, r);
    for (let k=0;k<14;k++){ const ang = r()*6.28, rr = r()*.12*sc, d = V3((r()-.5)*.4, 1, (r()-.5)*.4).normalize(), L = (.28 + r()*.14)*sc, p = V3(bx0 + Math.cos(ang)*rr, .08*sc, bz0 + Math.sin(ang)*rr);
      seg(a, swayMat(0x7FA86A, .6, .05), p, d, L, .006, .004, 3); const tip = p.clone().addScaledVector(d, L);
      a.add(new THREE.CapsuleGeometry(.014, .06, 2, 5), k%2 ? MAT.lav : MAT.lavD, at(tip.x, tip.y, tip.z)); }
  }
  for (let i=0;i<3;i++) bee(a, (r()-.5)*.6, .5 + r()*.25, .2 + r()*.15, 1.3, r()*6);
  a.into(g);
}

/* ── growing pieces (Sudoku / Math): honey jars that fill, a comb frame whose cells fill and cap, stage by stage ── */
const FILL = [0, 0, .28, .55, .85, 1];
function fillJars(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 3), Y = .07, f = FILL[stage], full = stage >= 5;
  slab(a, MAT.wood, .56, .03, .24, 0, Y + .13, -.1); for (const x of [-.24, .24]) slab(a, MAT.woodD, .04, .13, .2, x, Y, -.1);
  [[-.16, -.1, .72], [0, -.1, .72], [.16, -.1, .72]].forEach(([x, z, s0], i) => honeyJar(a, x, Y + .16, z, s0, Math.max(0, f - i*.08), full));
  [[-.12, .18, .95], [.14, .16, 1.05]].forEach(([x, z, s0], i) => honeyJar(a, x, Y, z, s0, Math.max(0, f - (i ? .12 : 0)), full));
  if (stage >= 3) { seg(a, MAT.woodL, V3(.3, Y + .01, .3), V3(-.3, 1, -.1).normalize(), .2, .008, .008, 5); blob(a, MAT.honey, V3(.25, Y + .2, .28), .025, 1.2); }
  if (stage >= 4) { cyl(a, MAT.terracotta, .06, .05, .09, -.3, Y, .3, 12); drip(a, -.3, Y + .1, .36); }
  const nb = [1, 1, 2, 3, 4][stage - 1] || 0; for (let i=0;i<nb;i++) bee(a, (r()-.5)*.5, Y + .38 + r()*.2, .1 + r()*.2, 1.3, r()*6);
  a.into(host);
  if (full) glowSprite(host, V3(0, Y + .2, .1), .7, 0xFFC040, .4);
  host.userData.stage = stage;
}
function fillComb(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*17 + s.z*5 + 9), Y = .07;
  const f = new Acc(); // the frame, turned to face the camera
  const COLS = 7, ROWS = 6, cr = .036, W = cr*Math.sqrt(3)*1.04, H = cr*1.56, fw = COLS*W + .06, fh = ROWS*H + .07;
  slab(f, MAT.wood, fw + .04, .035, .04, 0, fh + .1); slab(f, MAT.wood, fw, .03, .03, 0, .1);
  for (const x of [-fw/2, fw/2]) slab(f, MAT.woodD, .035, fh + .1, .035, x, 0);
  for (const x of [-fw/2, fw/2]) slab(f, MAT.woodD, .14, .025, .06, x, 0);
  f.add(bx(fw - .02, fh - .04, .02), MAT.waxD, at(0, .13 + (fh - .04)/2, 0));
  const n = COLS*ROWS, filled = Math.round(n*FILL[stage]), cappedN = stage >= 5 ? Math.round(n*.8) : stage === 4 ? Math.round(n*.25) : 0;
  let idx = 0;
  for (let row=0; row<ROWS; row++) for (let col=0; col<COLS; col++, idx++){
    const x = -((COLS - 1)*W)/2 + col*W + (row%2 ? W/2 : 0) - (row%2 ? W/4 : 0), y = .15 + cr + row*H;
    const m = idx < cappedN ? MAT.cap : idx < filled ? MAT.honey : MAT.cell;
    f.add(new THREE.CylinderGeometry(cr*.93, cr*.93, .03, 6).rotateX(Math.PI/2), m, at(x, y, .012));
  }
  if (filled > 0) drip(f, .1, .13, .02);
  const holder = new THREE.Group(); holder.rotation.y = Math.PI/4 - .25; holder.position.set(-.04, Y, -.06); f.into(holder); host.add(holder);
  cyl(a, MAT.woodL, .08, .07, .08, .26, Y, .26, 12); if (stage >= 3) cyl(a, MAT.honey, .07, .07, .005, .26, Y + .075, .26, 12);
  const nb = [1, 1, 2, 3, 4][stage - 1] || 0; for (let i=0;i<nb;i++) bee(a, (r()-.5)*.5, Y + .5 + r()*.2, .15 + r()*.15, 1.3, r()*6);
  a.into(host);
  if (stage >= 5) glowSprite(host, V3(0, Y + .3, 0), .7, 0xFFC040, .35);
  host.userData.stage = stage;
}

/* ── To-dos: hex pavers, clover, lanterns, flower borders, a bench, steps; a picket fence with climbing flowers ── */
function path(g, s){
  const sl = new THREE.Mesh(G.path, MAT.stone); sl.position.y = .0175; sl.receiveShadow = true; sl.userData.ghostHide = true; g.add(sl);
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0; g.userData.ghostMode = 'marker';
  if (v === 0) { [[-.2,-.2],[.16,-.12],[-.1,.18],[.24,.24]].forEach(([x, z], i) => hex(a, i%2 ? MAT.waxL : MAT.cap, .13, .03, x, .035, z)); a.into(g); clover(g, .26, -.3, .8, .035); return; }
  if (v === 1) { hex(a, MAT.waxL, .12, .03, -.18, .035, -.14); for (let i=0;i<7;i++){ const x = (r()-.5)*.6, z = (r()-.5)*.6; blob(a, i%3 ? MAT.clover : MAT.cloverP, V3(x, .12, z), .022, .8); }
    a.into(g); for (const [x, z] of [[.12, .1], [-.2, .22], [.22, -.18]]) clover(g, x, z, 1.2, .035, r()*6); return; }
  if (v === 2) { cyl(a, MAT.stoneD, .08, .08, .04, 0, .035); seg(a, MAT.woodD, V3(0, .075, 0), _up, .34, .018, .016, 6);
    seg(a, MAT.woodD, V3(0, .4, 0), V3(1, .1, 1).normalize(), .12, .01, .01, 4);
    hex(a, MAT.glow, .045, .08, .085, .34, .085); hex(a, MAT.woodD, .055, .015, .085, .42, .085); hex(a, MAT.woodD, .055, .015, .085, .33, .085);
    a.into(g); glowSprite(g, V3(.085, .38, .085), .4, 0xFFB040, .55); flowerSet(g, r, -.24, .24, .6, 3, .035); return; }
  if (v === 3) { a.into(g); flowerSet(g, r, -.2, -.18, .8, 0, .035); flowerSet(g, r, .2, .15, .75, 4, .035); flowerSet(g, r, -.18, .22, .7, 2, .035); flowerGroup(g, .22, -.22, .8, .035); return; }
  if (v === 4) { slab(a, MAT.wood, .44, .03, .14, 0, .17, 0, Math.PI/4); slab(a, MAT.wood, .44, .1, .025, -.05, .2, -.05, Math.PI/4);
    for (const d of [-.15, .15]) slab(a, MAT.woodD, .03, .135, .12, d*.707, .035, -d*.707, Math.PI/4);
    cyl(a, MAT.terracotta, .045, .035, .07, .06, .2, .06, 10); drip(a, .06, .27, .1, .8); a.into(g); clover(g, .25, .28, .8, .035); return; }
  for (let i=0;i<3;i++) hex(a, i%2 ? MAT.cap : MAT.waxL, .3 - i*.07, .05, 0, .035 + i*.05, 0);
  flowers(a, r, .3, .3, .5, .035, 0); a.into(g);
}
function fence(g, s){
  const a = new Acc(), L = s.len, r = rngFrom(s.x*3 + s.z*5 + 1);
  const run = u => s.edge === 'w' ? [ -.45, u, Math.PI/2 ] : [ u, .45, 0 ];
  for (let i=0;i<L;i++){ const [x, z, ry] = run(i - (L-1)/2); for (const y of [.1, .2]) a.add(bx(.96, .025, .015), MAT.white, at(x, y, z, ry)); }
  for (let i=0;i<=L*4;i++){ const [x, z, ry] = run(i/4 - L/2); a.add(bx(.05, .26, .02), MAT.white, at(x, .13, z, ry)); a.add(new THREE.ConeGeometry(.036, .05, 4).rotateY(Math.PI/4), MAT.white, at(x, .285, z, ry, 1, 1, .4)); }
  for (let i=0;i<L*5;i++){ const [x, z] = run((i + .5)/5 - L/2 + (r()-.5)*.1); blob(a, MAT.leafD, V3(x, .06 + r()*.14, z), .04, .8, 0, r); if (r() < .6) blob(a, PETALS()[i % 5], V3(x + (r()-.5)*.04, .1 + r()*.14, z + (r()-.5)*.04), .02, .7); }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}

/* ── the hero (Gita): the queen's hive — a three-tier golden skep palace on a hex dais, lit hex windows, a crown ── */
const QUEEN = { top:1.42 };
function queenHive(g){
  const a = new Acc(), r = rngFrom(5);
  hex(a, MAT.stoneD, .92, .08); hex(a, MAT.stone, .8, .06, 0, .08); hex(a, MAT.waxL, .66, .03, 0, .14);
  for (let i=0;i<3;i++) slab(a, MAT.stone, .24, .05, .1, .55 + i*.06, 0, .55 + i*.06, Math.PI/4);
  const Y = .17;
  coils(a, Y, .36, 6, t => .52 - t*.04, .05);
  a.add(new THREE.TorusGeometry(.49, .03, 6, 32).rotateX(Math.PI/2), MAT.gold, at(0, Y + .37, 0));
  coils(a, Y + .38, .3, 5, t => .42 - t*.05, .047);
  a.add(new THREE.TorusGeometry(.38, .028, 6, 32).rotateX(Math.PI/2), MAT.gold, at(0, Y + .69, 0));
  coils(a, Y + .7, .44, 7, t => .34*Math.sqrt(Math.max(0, 1 - Math.pow(t, 2))) + .03, .045);
  // crown on the top
  const C = Y + 1.14; cyl(a, MAT.gold, .1, .11, .05, 0, C, 0, 16);
  for (let i=0;i<8;i++){ const q = i/8*6.28; a.add(new THREE.ConeGeometry(.022, .07, 4), MAT.gold, at(Math.cos(q)*.09, C + .08, Math.sin(q)*.09)); blob(a, i%2 ? MAT.pink : MAT.sky, V3(Math.cos(q)*.1, C + .03, Math.sin(q)*.1), .012); }
  blob(a, MAT.gold, V3(0, C + .12, 0), .04);
  // lit hex windows round the two lower tiers; honey dripping from the gold bands
  for (let i=0;i<7;i++){ const q = i/7*6.28 + .2; if (Math.abs(q - Math.PI/4) < .5) continue;
    a.add(new THREE.CylinderGeometry(.065, .065, .03, 6).rotateX(Math.PI/2), MAT.glow, at(Math.sin(q)*.54, Y + .2, Math.cos(q)*.54, q)); }
  for (let i=0;i<6;i++){ const q = i/6*6.28 + .6; a.add(new THREE.CylinderGeometry(.05, .05, .03, 6).rotateX(Math.PI/2), MAT.glow, at(Math.sin(q)*.43, Y + .54, Math.cos(q)*.43, q)); }
  for (let i=0;i<10;i++){ const q = i/10*6.28 + r()*.3; drip(a, Math.sin(q)*.5, Y + .36, Math.cos(q)*.5, 1.3); if (i%2) drip(a, Math.sin(q)*.39, Y + .68, Math.cos(q)*.39, 1.1); }
  // the arched door facing the camera, a landing board
  const dq = Math.PI/4, dx = Math.sin(dq)*.54, dz = Math.cos(dq)*.54;
  a.add(bx(.16, .2, .04), MAT.woodD, at(dx, Y + .1, dz, dq)); a.add(new THREE.CylinderGeometry(.08, .08, .04, 12, 1, false, -Math.PI/2, Math.PI).rotateX(Math.PI/2), MAT.woodD, at(dx, Y + .2, dz, dq));
  a.add(bx(.3, .025, .16), MAT.gold, at(Math.sin(dq)*.62, Y, Math.cos(dq)*.62, dq));
  // flower ring on the dais + marigold-coloured flowers
  for (let i=0;i<16;i++){ const q = i/16*6.28; if (Math.abs(q - dq) < .35) continue; blob(a, PETALS()[i % 5], V3(Math.sin(q)*.72, .17, Math.cos(q)*.72), .03, .7); blob(a, MAT.leafD, V3(Math.sin(q)*.75, .15, Math.cos(q)*.75), .035, .5); }
  for (let i=0;i<9;i++){ const q = r()*6.28, d = .7 + r()*.35; bee(a, Math.sin(q)*d*.8, .6 + r()*.8, Math.cos(q)*d*.8, 1.4, q + 1.6); }
  a.into(g);
  glowSprite(g, V3(dx + .08, Y + .15, dz + .08), .6, 0xFFB040, .5); glowSprite(g, V3(0, 1, 0), 2.2, 0xFFE8A0, .16);
  const f = rngFrom(7); flowerSet(g, f, -.8, .8, 1, 0); flowerSet(g, f, .82, -.78, 1, 3); flowerGroup(g, .85, .55, 1.1); flowerGroup(g, -.6, -.85, 1); clover(g, -.85, .2, 1.2);
}

/* ── blueprint: the farm's cells with bee-kingdom pieces; the queen's hive takes the left corner ── */
const MAP = {
  bigbarn:{ name:'Honeycomb hall', b:'hall' }, well:{ name:'Bee bath', b:'bath' }, apple1:{ name:'Blossom tree', b:'blossom', h:1.25 },
  silo:{ name:'Wax tower', b:'tower' }, silohouse:{ name:'Box hive', b:'box' }, coop:{ name:'Straw skep', b:'skep' },
  watertower:{ name:'Rain barrel', b:'barrel' }, pump:{ name:'Dew basin', b:'basin' }, apple2:{ name:'Linden tree', b:'linden', h:1.3 },
  berry1:{ name:'Sunflowers', b:'sun' }, peepal:{ name:"Queen's hive", b:'hero' },
  smallbarn:{ name:"Beekeeper's hut", b:'hut' }, openbarn:{ name:'Honey stall', b:'stall' },
  pond:{ name:'Lily pond', b:'pond' }, orange1:{ name:'White blossom', b:'blossom', white:true, h:1.3 },
  apple3:{ name:'Hollyhocks', b:'holly' }, berry2:{ name:'Lavender', b:'lav' },
  orange2:{ name:'Linden tree', b:'linden', h:1.4 }, apple4:{ name:'Sunflowers', b:'sun' }
};
const MOVE = { peepal:{ x:0, z:5 }, field1_5:{ x:1, z:1 }, fence3:{ x:0, z:0, edge:'w' } };   // hero to the left corner
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:5, path2_6:4, path3_6:0 };
const PATH_NAME = ['Hex pavers', 'Clover patch', 'Hex lantern', 'Flower border', 'Garden bench', 'Wax steps'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d, ...(MOVE[f.id] || {}) };
  if (f.kind === 'field') { const jars = f.crop === 'Corn' || f.crop === 'Beet';
    return jars ? { ...s, kind:'jars', name:'Honey jars', stages:5 } : { ...s, kind:'comb', name:'Honey frame', stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'bee', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'bee', b:'fence', edge:s.edge || f.edge, len:f.len, name:'Picket fence' };
  return { ...s, kind:'bee', ...MAP[f.id] };
});
const BUILD = { hall, tower, box:boxHive, skep, hut, stall, bath, barrel, basin, pond,
  blossom, linden, sun:sunflowers, holly:hollyhocks, lav:lavender, path, fence, hero:queenHive };

/* decor: clover, flowers and grass on empty cells; a hint on waiting cells */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    const grass = (px, pz, k=1) => km(grp, 'a', r() < .5 ? 'Grass_Wispy_Short' : 'Grass_Common_Short', .14*k, .25*k, px, p.y, pz, r()*6);
    if (!sl || sl === 'later') {
      clover(grp, p.x - .22, p.z - .18, 1.2 + r()*.3, p.y, r()*6); flowerGroup(grp, p.x + .2, p.z + .14, 1.3 + r()*.3, p.y, r()*6);
      if (r() < .5) km(grp, 'a', 'Bush_Common_Flowers', .22, .34, p.x - .22, p.y, p.z + .2, r()*6); else flowerGroup(grp, p.x - .22, p.z + .22, 1.1, p.y, r()*6);
      flowers(a, r, p.x + .12, p.z - .26, .85, p.y, Math.floor(r()*5)); flowers(a, r, p.x - .02, p.z + .02, .7, p.y, Math.floor(r()*5)); flowers(a, r, p.x + .3, p.z + .3, .6, p.y, Math.floor(r()*5));
      if (AMBIENT()) grass(p.x - .3, p.z - .02, .8);
      grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { grass(p.x + .3, p.z + .3, .8); if (r() < .6) clover(grp, p.x - .3, p.z + .28, .8, p.y, r()*6); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if ((Math.abs(x-3) === V.ring && x > 3) || (Math.abs(z-3) === V.ring && z > 3)) { grass(p.x + .38, p.z + .38, .7); grp.userData.decor = 'rim'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ── live bees: a wing-flapping bee rig (ambient, swarms, the queen) ── */
function makeBee(queen=false){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.03, 10, 8), MAT.beeY, at(0, 0, 0, 0, .9, .9, queen ? 1.6 : 1.25));
  for (const [z, rr] of (queen ? [[-.008, .027], [-.026, .025], [-.042, .02]] : [[-.006, .026], [-.022, .02]])) a.add(new THREE.TorusGeometry(rr, .006, 4, 12), MAT.beeK, at(0, 0, z));
  a.add(new THREE.SphereGeometry(.019, 8, 6), MAT.beeK, at(0, .004, .038)); for (const sx of [-1, 1]) { blob(a, MAT.daisy, V3(sx*.009, .012, .052), .005); seg(a, MAT.beeK, V3(sx*.006, .018, .045), V3(sx*.4, 1, .6).normalize(), .025, .002, .002, 3); }
  if (queen) { cyl(a, MAT.gold, .014, .016, .012, 0, .024, .036, 8); for (let i=0;i<5;i++){ const q = i/5*6.28; a.add(new THREE.ConeGeometry(.004, .012, 3), MAT.gold, at(Math.cos(q)*.013, .04, .036 + Math.sin(q)*.013)); } }
  a.into(g);
  const wg = new THREE.SphereGeometry(.024, 8, 5).scale(.7, .15, 1).translate(.018, 0, -.004), w1 = new THREE.Mesh(wg, MAT.wing), w2 = new THREE.Mesh(wg, MAT.wing);
  w2.scale.x = -1; w1.position.y = w2.position.y = .026; g.add(w1, w2); g.userData.w1 = w1; g.userData.w2 = w2; return g;
}
const flap = (b, t) => { const f = .35 + Math.sin(t*48 + b.id)*.6; b.userData.w1.rotation.z = f; b.userData.w2.rotation.z = -f; };
function addAmbient(){
  addButterflies();
  V.bees = []; const r = rngFrom(88);
  for (let i=0;i<7;i++){ const b = makeBee(); b.scale.setScalar(1.6); b.userData.u = { rad:.5 + V.ring*.35 + r()*.5, h:.45 + r()*.6, sp:.35 + r()*.3, ph:r()*6.28, cx:(r()-.5)*V.ring, cz:(r()-.5)*V.ring };
    world.add(b); V.bees.push(b); V.life.push(b); }
  moveAmbient(2.1);
}
function moveAmbient(t){
  if (!V) return; flyButterflies(t); (V.butterflies || []).forEach(b => b.visible = !S.night);
  (V.bees || []).forEach(b => { const u = b.userData.u, q = t*u.sp + u.ph; b.visible = !S.night;
    const x = u.cx + Math.cos(q)*u.rad + Math.sin(q*3.1)*.12, z = u.cz + Math.sin(q)*u.rad*.8 + Math.cos(q*2.3)*.12;
    b.position.set(x, TILE_TOP + u.h + Math.sin(q*4.3)*.06, z); b.rotation.y = -q + Math.PI; flap(b, t); });
}

/* ── residents: a honey bear hops in and sits hugging a honey pot; three swarms buzz in; the queen settles on her hive ── */
const RES_SCALE = 1.5;
function makeBear(){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.13, 16, 12), MAT.bear, at(0, .14, 0, 0, 1, 1.05, .95));
  a.add(new THREE.SphereGeometry(.085, 12, 9), MAT.bearL, at(0, .13, .07, 0, 1, 1.1, .6));
  a.add(new THREE.SphereGeometry(.095, 14, 11), MAT.bear, at(0, .33, .02));
  a.add(new THREE.SphereGeometry(.045, 10, 8), MAT.bearL, at(0, .31, .1, 0, 1.1, .85, .8)); blob(a, MAT.bearD, V3(0, .325, .135), .016);
  for (const sx of [-1, 1]) { blob(a, MAT.eye, V3(sx*.035, .35, .09), .011); blob(a, MAT.blush, V3(sx*.055, .315, .085), .014, .5);
    blob(a, MAT.bear, V3(sx*.07, .41, 0), .032, .9); blob(a, MAT.bearL, V3(sx*.07, .41, .012), .017, .9);
    a.add(new THREE.SphereGeometry(.045, 10, 8), MAT.bear, at(sx*.075, .045, .1, 0, 1, .8, 1.3)); blob(a, MAT.bearL, V3(sx*.075, .045, .16), .026, 1);   // feet
    seg(a, MAT.bear, V3(sx*.1, .2, .02), V3(-sx*.5, -.3, 1).normalize(), .11, .035, .03, 8); }
  // the honey pot in its arms, a dipper, a drip on the chin
  cyl(a, MAT.terracotta, .05, .045, .09, 0, .1, .15, 12); cyl(a, MAT.honey, .042, .042, .006, 0, .186, .15, 12); a.add(new THREE.TorusGeometry(.045, .008, 4, 14).rotateX(Math.PI/2), MAT.clay, at(0, .19, .15));
  seg(a, MAT.woodL, V3(.02, .15, .15), V3(.3, 1, .2).normalize(), .13, .006, .006, 5); blob(a, MAT.honey, V3(.02, .31, .15), .01, 1.6);
  a.into(g); return g;
}
function makeSwarm(n=6, seed=1){
  const g = new THREE.Group(), r = rngFrom(seed); g.userData.bees = [];
  for (let i=0;i<n;i++){ const b = makeBee(); b.userData.o = { rad:.18 + r()*.18, h:(r()-.5)*.2, sp:1.6 + r()*1.2, ph:r()*6.28, tilt:(r()-.5)*.8 }; g.add(b); g.userData.bees.push(b); }
  orbit(g, 1.3); return g;
}
function orbit(g, t){ (g.userData.bees || []).forEach(b => { const o = b.userData.o, q = t*o.sp + o.ph;
  b.position.set(Math.cos(q)*o.rad, o.h + Math.sin(q*2 + o.tilt)*.06, Math.sin(q)*o.rad*.9); b.rotation.y = -q; flap(b, t); }); }
const BEAR_AT = [0.4, 4.35];
function swarmSpots(){
  const h = cellPos(0.5, 5.5), hall = cellPos(2.5, 2.5), tree = cellPos(4, 3);
  return [ V3(h.x + .15, TILE_TOP + 1.1, h.z + .1), V3(hall.x + .1, TILE_TOP + 1.25, hall.z + .1), V3(tree.x, TILE_TOP + 1.35, tree.z + .1) ];
}
function moveResidents(t){
  (V && V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'swarm') { r.obj.position.copy(u.p).add(V3(0, (1 - e)*2.2, 0)); orbit(r.obj, t); return; }
    if (r.kind === 'queen') { r.obj.position.copy(u.p).add(V3(0, (1 - e)*1.8 + Math.sin(t*2.2)*.03, 0)); r.obj.rotation.y = u.face + Math.sin(t*.5)*.3; flap(r.obj, t); return; }
    const walking = r.arrive < 1, p = u.from.clone().lerp(u.at, walking ? 1 - Math.pow(1 - r.arrive, 2.2) : 1);
    r.obj.position.set(p.x, TILE_TOP + (walking ? Math.abs(Math.sin(t*6))*.06 : 0), p.z);
    r.obj.rotation.y = walking ? Math.atan2(u.at.x - u.from.x, u.at.z - u.from.z) : u.face;
    r.obj.rotation.z = walking ? 0 : Math.sin(t*.9)*.04;
  });
}
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.08))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(rs[0].obj.position.y + .3), 10, 0xFFE08A, .6); res(); })); }
const MAKE = { bear:() => makeBear(), swarm:() => makeSwarm(6, 3), queen:() => { const q = makeBee(true); q.scale.setScalar(2.6); return q; } };
async function beesMoveIn(walk){
  V.residentsIn = true; V.res = [];
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const gate = cellPos(3, 7.3);
  const groups = [
    async () => { const o = makeBear(); o.scale.setScalar(RES_SCALE); const rs = [addRes('bear', o, { at:cellPos(...BEAR_AT), from:gate.clone(), face:.75 })]; moveResidents(0); if (walk) await arrive(rs, 2400); },
    async () => { const rs = swarmSpots().map((p, i) => { const o = makeSwarm(6 + i, 11 + i); o.scale.setScalar(RES_SCALE); return addRes('swarm', o, { p }); }); moveResidents(0); if (walk) await arrive(rs, 1600); },
    async () => { const h = cellPos(0.5, 5.5), o = MAKE.queen(); const rs = [addRes('queen', o, { p:V3(h.x, TILE_TOP + QUEEN.top + .12, h.z), face:.8 })]; moveResidents(0); if (walk) await arrive(rs, 1600); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length;
}

export default {
  id:'bees', name:'Bee kingdom', title:'Your hive',
  season:35, dates:'3–16 May', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'bee baths, barrels & lily ponds', tag:'Water' },
    building:{ label:'hives, skeps & honey halls',      tag:'Hive' },
    path:    { label:'hex pavers, clover & fences',     tag:'Path' },
    crop:    { label:'honey jars & comb frames',        tag:'Honey' },
    tree:    { label:'blossom trees & tall flowers',    tag:'Bloom' },
    special: { label:"the queen's hive",                tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:TILE, tileMap },
  ghost:{ color:'#FFFFFF', opacity:.42, emissive:.22, dash:'#FFFFFF', dashOpacity:.75 },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 3.5 19.4 7.8v8.4L12 20.5 4.6 16.2V7.8z" fill="#F2B632"/><path d="M12 7.2 15.8 9.4v4.4L12 16l-3.8-2.2V9.4z" fill="#FBE39A"/><ellipse cx="12" cy="12" rx="2.4" ry="1.9" fill="#2B2320"/><path d="M10.6 11.1v1.8M12 10.3v3.4M13.4 11.1v1.8" stroke="#F7C531" stroke-width=".9"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M24 118h80v-8H24z"/><path d="M30 110c0-8 4-12 6-14h56c2 2 6 6 6 14z"/><path d="M36 96c0-10 4-16 8-18h40c4 2 8 8 8 18z"/><path d="M44 78c0-22 8-38 20-38s20 16 20 38z"/><path d="M56 40l2-10 6 6 6-6 2 10z"/><circle cx="104" cy="44" r="6"/><circle cx="22" cy="60" r="5"/></g>',
  album:{ image:'assets/bees/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#F8EBC8)' },
  css:'.phone[data-theme="bees"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#FBF3DC 58%,#F4E2B0 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'jars' || s.kind === 'comb') {
      const base = new THREE.Mesh(G.field, MAT.bed); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      const host = new THREE.Group(); host.scale.setScalar(1.12); g.add(host); g.userData.plants = host;
      const fill = s.kind === 'jars' ? fillJars : fillComb; g.userData.regrow = st => fill(host, s, st); fill(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'bee' ? 1 : 1.12,
  contact: s => s.kind === 'bee' && !['path', 'fence', 'hero', 'pond'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && s.v === 2),
  decor,
  ambient: addAmbient,
  tick(t){ moveAmbient(t); moveResidents(t); },

  residents:[ { id:'bear', name:'Honey bear', n:1 }, { id:'swarm', name:'Bee swarms', n:3 }, { id:'queen', name:'Queen bee', n:1 } ],
  moveIn: beesMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('bees:'+d.id, () => { const o = MAKE[d.id](); if (d.id === 'queen') o.scale.setScalar(1); o.rotation.y = .7; return o; }, 168); },
  residentRig(d){ const obj = MAKE[d.id](); if (d.id !== 'queen') obj.scale.setScalar(RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
