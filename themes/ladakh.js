/* LADAKH MONASTERY (?theme=ladakh) — a stark high-desert valley on the farm's 7×7 ring blueprint (same cells, same ring counts
   6 / 15 / 19, same order), hero moved to the LEFT corner (cells 0..1 × 5..6) as oasis does, so nothing stands in front of it.
   Ochre and tan barren ground, whitewashed buildings with battered (inward-leaning) walls, maroon kemar bands and black
   trapezoid window frames, white chortens, prayer wheels, a turquoise lake, an ice stupa, poplar and willow rows by the water,
   seabuckthorn, barley terraces and prayer-flag lines. No CC0 kit has this architecture, so every piece is procedural three.js
   geometry merged per material (Acc). Reused CC0 kit pieces (no new asset files): rocks + pebbles = Quaternius Stylized Nature
   MegaKit (kit a). Residents (yaks, a snow leopard, black-necked cranes) and the bar-headed geese are procedural too.
   Respectful: no figures, faces or statues, no script on flags, wheels or mani stones. */
import * as THREE from 'three';
import { rngFrom, TEX, addSway, world } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, seg, blob, _up } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { FARM, FARM_ORDER } from './farm.js';

/* ── materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.86, metalness:0, flatShading:true, ...o });
const MAT = {
  white:FM(0xF6F1E7), whiteD:FM(0xE4DBCB), maroon:FM(0x86292F), maroonD:FM(0x5E1C22), black:FM(0x2B2522),
  pane:FM(0x3A2C22, { emissive:0xFF9A40, emissiveIntensity:.22 }), roofLip:FM(0x6B4A2E), twig:FM(0x8E6C48),
  gold:FM(0xEDBE4E, { emissive:0x6A4A00, emissiveIntensity:.25, roughness:.4, metalness:.3 }), copper:FM(0xD99A48, { roughness:.45, metalness:.25 }),
  ochre:FM(0xD8AC72, { roughness:1 }), ochreL:FM(0xE6C58F, { roughness:1 }), ochreD:FM(0xB98653, { roughness:1 }),
  rock:FM(0xB48C62), rockD:FM(0x8E6C50), rockM:FM(0x9A7C72), rust:FM(0xA8663F),
  stone:FM(0xBDB3A2), stoneD:FM(0x908878), stoneL:FM(0xD6CEBF), bank:FM(0xC8A67A, { roughness:1 }),
  water:new THREE.MeshStandardMaterial({ color:0x2FC6C8, roughness:.15, metalness:0, emissive:0x0B6670, emissiveIntensity:.38 }),
  waterD:new THREE.MeshStandardMaterial({ color:0x1FA3B0, roughness:.15, metalness:0, emissive:0x08505A, emissiveIntensity:.35 }),
  jet:new THREE.MeshStandardMaterial({ color:0xE6FAFF, roughness:.2, transparent:true, opacity:.7, emissive:0x8FDCEA, emissiveIntensity:.3, depthWrite:false }),
  ice:FM(0xE4F4FA, { emissive:0x6CC4E0, emissiveIntensity:.12, roughness:.35 }), iceD:FM(0xB9E0EE, { emissive:0x4AA8CC, emissiveIntensity:.1, roughness:.35 }),
  flame:FM(0xFFC857, { emissive:0xFF8A1F, emissiveIntensity:1.7 }),
  trunk:FM(0xD2C8B4), trunkD:FM(0xA59378), bark:FM(0x7A5B40),
  berry:FM(0xF28A1E, { emissive:0x7A3000, emissiveIntensity:.2 }), sb:FM(0x9AAE88), sbD:FM(0x7E9470),
  scrub:FM(0x9FA27A), scrubD:FM(0x858A64),
  soil:FM(0x9A6A42, { roughness:1, map:TEX.furrow }), sprout:FM(0x8CC455), cloth:FM(0xC9A66E), apricot:FM(0xF09A2E), sheaf:FM(0xD9B04A),
  // residents + life
  yak:FM(0x33291F), yakD:FM(0x1F1813), yakW:FM(0xF0E9DD), horn:FM(0xEADFC8), nose:FM(0x4A3A34),
  leo:FM(0xD8CFBC), leoD:FM(0xBDB19A), spot:FM(0x8A8176), eye:FM(0x1E1A18), eyeL:FM(0x8FB8A4),
  crane:FM(0xD8D5CE), craneD:FM(0xA29E97), craneK:FM(0x26221F), craneR:FM(0xD8392E), leg:FM(0x3A3530),
  goose:FM(0xA9A398, { side:THREE.DoubleSide }), gooseH:FM(0xF7F4EE), gooseB:FM(0xF2A93A)
};
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = FM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }
const FLAG_HEX = [0x3F7CD6, 0xF6F4EE, 0xD8433A, 0x3E9E55, 0xF2C230];   // blue, white, red, green, yellow — plain, no script
const flagMat = i => swayMat(FLAG_HEX[i % 5], .6, .035);

const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=12){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z)); }
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }
function km(g, kit, name, h, w, x=0, y=0, z=0, rot=0){ const tpl = KITCACHE[kit] && KITCACHE[kit][name]; if (!tpl) return null;
  return addModel(g, name, fitScale(tpl, h, w), x, y, z, rot, kit); }

/* battered wall block: a square frustum, w × d at the foot, narrowing to tp at the top (Himalayan walls lean inward) */
function batter(a, mat, w, d, h, x=0, y=0, z=0, tp=.9, ry=0){
  a.add(new THREE.CylinderGeometry(tp, 1, h, 4, 1).rotateY(Math.PI/4), mat, at(x, y + h/2, z, ry, w/Math.SQRT2, 1, d/Math.SQRT2)); }
/* trapezoid window frame (wider at the sill), extruded toward +z */
const TRAP = {};
function trapGeo(w, h, dep=.012){ const k = w.toFixed(3)+':'+h.toFixed(3)+':'+dep; if (TRAP[k]) return TRAP[k];
  const s = new THREE.Shape(); s.moveTo(-w/2, 0); s.lineTo(w/2, 0); s.lineTo(w*.36, h); s.lineTo(-w*.36, h); s.closePath();
  return TRAP[k] = new THREE.ExtrudeGeometry(s, { depth:dep, bevelEnabled:false }); }
const faceAt = (face, cx, cy, cz, hd, u, off=0) => face === 'z' ? at(cx + u, cy, cz + hd + off) : at(cx + hd + off, cy, cz - u, Math.PI/2);
function win(a, face, cx, cy, cz, hd, u, w=.085, h=.1){
  a.add(trapGeo(w + .05, h + .035), MAT.black, faceAt(face, cx, cy - .02, cz, hd, u, 0));
  a.add(trapGeo(w*.6, h*.7), MAT.pane, faceAt(face, cx, cy, cz, hd, u, .008));
  a.add(bx(w + .06, .022, .035), MAT.maroon, faceAt(face, cx, cy + h + .028, cz, hd, u, .012));
}
/* a Ladakhi whitewashed house: battered walls, optional maroon kemar band, twig roof lip, black trapezoid windows */
function tHouse(a, o){
  const { W, D, H, x=0, y=0, z=0, tp=.9 } = o, tw = W*tp, td = D*tp, top = y + H;
  batter(a, o.wall || MAT.white, W, D, H, x, y, z, tp);
  if (o.band) batter(a, MAT.maroon, tw + .025, td + .025, o.band, x, top - o.band, z, .985);
  a.add(bx(tw + .07, .035, td + .07), MAT.roofLip, at(x, top + .0175, z));
  a.add(bx(tw + .03, .02, td + .03), MAT.whiteD, at(x, top + .045, z));
  const hd = (dd, yy) => dd/2*(1 - (1 - tp)*yy/H);
  for (const yy of (o.rows || [H*.52])) {
    for (const u of (o.winZ || [])) win(a, 'z', x, y + yy, z, hd(D, yy + .05), u, o.ww, o.wh);
    for (const u of (o.winX || [])) win(a, 'x', x, y + yy, z, hd(W, yy + .05), u, o.ww, o.wh); }
  if (o.door != null) { a.add(bx(.1, .17, .02), MAT.maroonD, faceAt('z', x, y + .085, z, hd(D, .08), o.door, .006));
    a.add(bx(.15, .025, .045), MAT.black, faceAt('z', x, y + .18, z, hd(D, .18), o.door, .012)); }
  if (o.wood) for (let i=0;i<5;i++) a.add(new THREE.CylinderGeometry(.017, .017, tw*.42, 5).rotateZ(Math.PI/2), MAT.twig,
    at(x - tw*.2, top + .075 + (i > 2 ? .03 : 0), z - td*.3 + (i % 3)*.036 + (i > 2 ? .018 : 0)));
  if (o.apricot) { const r = rngFrom(Math.round(x*97 + z*31 + 5)); a.add(bx(tw*.42, .008, td*.38), MAT.cloth, at(x + tw*.18, top + .06, z + td*.18));
    for (let i=0;i<10;i++) blob(a, MAT.apricot, new THREE.Vector3(x + tw*.18 + (r() - .5)*tw*.36, top + .07, z + td*.18 + (r() - .5)*td*.3), .014, .7); }
  if (o.gyaltsen) for (const [sx, sz] of o.gyaltsen) gyaltsen(a, x + sx*tw*.44, top + .055, z + sz*td*.44, o.gs || 1);
}
/* gyaltsen: the little cylindrical victory banner on a monastery roof corner */
function gyaltsen(a, x, y, z, s=1){
  cyl(a, MAT.black, .026*s, .03*s, .07*s, x, y, z, 8); a.add(new THREE.TorusGeometry(.028*s, .006*s, 4, 10).rotateX(Math.PI/2), MAT.maroon, at(x, y + .045*s, z));
  a.add(new THREE.SphereGeometry(.024*s, 8, 5, 0, Math.PI*2, 0, Math.PI/2), MAT.gold, at(x, y + .07*s, z));
  a.add(new THREE.ConeGeometry(.008*s, .04*s, 5), MAT.gold, at(x, y + .105*s, z));
}
/* chorten (stupa): stepped base, maroon band, dome, harmika, gold spire with rings, parasol, sun-and-moon finial. h ≈ .76·s */
const BUMPA = (() => { const p = [[0,0],[.8,0],[1,.18],[1.02,.45],[.9,.72],[.62,.92],[.3,1],[0,1]].map(([x,y]) => new THREE.Vector2(x, y)); return new THREE.LatheGeometry(p, 14); })();
function chorten(a, x, z, s=1, y=0, body=MAT.white){
  const st = (w, h, yy, m=body) => a.add(bx(w*s, h*s, w*s), m, at(x, y + (yy + h/2)*s, z));
  st(.38, .06, 0, MAT.whiteD); st(.31, .06, .06); st(.25, .05, .12); st(.21, .035, .17, MAT.maroon); st(.23, .02, .205);
  a.add(BUMPA, body, at(x, y + .225*s, z, 0, .13*s, .18*s, .13*s));
  st(.1, .05, .4, MAT.whiteD); st(.12, .015, .45, MAT.maroon);
  a.add(new THREE.CylinderGeometry(.02*s, .05*s, .2*s, 10), MAT.gold, at(x, y + .565*s, z));
  for (let i=0;i<3;i++) a.add(new THREE.TorusGeometry((.045 - i*.009)*s, .006*s, 4, 12).rotateX(Math.PI/2), MAT.gold, at(x, y + (.5 + i*.05)*s, z));
  a.add(new THREE.CylinderGeometry(.055*s, .04*s, .015*s, 10), MAT.gold, at(x, y + .67*s, z));
  a.add(new THREE.TorusGeometry(.022*s, .006*s, 4, 10, Math.PI), MAT.gold, at(x, y + .705*s, z, 0, 1, 1, 1, 0, Math.PI));
  blob(a, MAT.gold, new THREE.Vector3(x, y + .735*s, z), .014*s);
}
/* prayer wheel: a copper drum between maroon bands on a spindle (plain drum, no script) */
function wheel(a, x, y, z, s=1){
  seg(a, MAT.black, new THREE.Vector3(x, y, z), _up, .16*s, .006*s, .006*s, 4);
  cyl(a, MAT.copper, .045*s, .045*s, .09*s, x, y + .03*s, z, 12);
  for (const yy of [.03, .12]) a.add(new THREE.TorusGeometry(.046*s, .008*s, 4, 14).rotateX(Math.PI/2), MAT.maroon, at(x, y + yy*s, z));
  a.add(new THREE.TorusGeometry(.046*s, .004*s, 4, 14).rotateX(Math.PI/2), MAT.gold, at(x, y + .075*s, z));
  a.add(new THREE.ConeGeometry(.05*s, .035*s, 12), MAT.maroon, at(x, y + .137*s, z));
}
/* a string of plain prayer flags between two points, sagging; returns nothing, adds into acc */
function flagLine(a, p0, p1, n, sag=.06, fw=.065, fh=.08, off=0){
  const c = new THREE.QuadraticBezierCurve3(p0, p0.clone().lerp(p1, .5).add(new THREE.Vector3(0, -sag, 0)), p1);
  a.add(new THREE.TubeGeometry(c, 10, .0035, 3), MAT.stoneD);
  const ry = Math.atan2(-(p1.z - p0.z), p1.x - p0.x);
  for (let i=0;i<n;i++){ const t = (i + .5)/n, p = c.getPoint(t);
    a.add(new THREE.PlaneGeometry(fw, fh).translate(0, -fh/2, 0), flagMat(i + off), at(p.x, p.y - .004, p.z, ry)); }
}
function pole(a, x, z, h, y=0){ seg(a, MAT.twig, new THREE.Vector3(x, y, z), _up, h, .012, .009, 5);
  for (let i=0;i<5;i++){ const aa = i*1.26; blob(a, MAT.stone, new THREE.Vector3(x + Math.cos(aa)*.035, y + .015, z + Math.sin(aa)*.035), .022, .7); } }
/* organic pool: turquoise water on a tan bank with rocks */
function pool(acc, g, rng, rx, rz, x=0, z=0, rocks=6){
  acc.add(new THREE.CylinderGeometry(1, 1.06, .04, 28), MAT.bank, at(x, 0, z, 0, rx + .07, 1, rz + .07));
  acc.add(new THREE.CylinderGeometry(1, 1, .02, 28), MAT.water, at(x, .035, z, 0, rx, 1, rz));
  acc.add(new THREE.CylinderGeometry(1, 1, .021, 28), MAT.waterD, at(x + rx*.1, .036, z - rz*.1, 0, rx*.55, 1, rz*.5));
  for (let i=0;i<rocks;i++){ const a = rng()*6.28;
    km(g, 'a', ['Rock_Medium_1','Rock_Medium_2','Rock_Medium_3'][i%3], .06 + rng()*.05, .12 + rng()*.06, x + Math.cos(a)*(rx + .04), 0, z + Math.sin(a)*(rz + .04), rng()*6); }
}
function scrub(acc, x, z, s=1, y=0, rng=Math.random){ for (let i=0;i<3;i++) blob(acc, i%2 ? MAT.scrub : MAT.scrubD, new THREE.Vector3(x + (i-1)*.035*s, y + .025*s, z + ((i*7)%3 - 1)*.025*s), (.03 + i*.006)*s, .75); void rng; }

/* ── trees ── */
function poplarTree(a, x, z, h, tone=0, rng){
  seg(a, MAT.trunk, new THREE.Vector3(x, 0, z), _up, h*.32, .026*h, .02*h, 6);
  const geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position;
  for (let i=0;i<p.count;i++){ const f = 1 + (rng() - .5)*.2; p.setXYZ(i, p.getX(i)*f, p.getY(i)*f, p.getZ(i)*f); }
  const m = [swayMat(0x8DBA4A, 1.4, .016), swayMat(0xB8C94E, 1.4, .016), swayMat(0x74A444, 1.4, .016)][tone % 3];
  a.add(geo, m, at(x, h*.62, z, rng()*6, .12*h, .42*h, .12*h));
}
function poplarRow(g, s){
  const a = new Acc(), r = rngFrom(s.x*5 + s.z*13 + 1), h = s.h || 1.3;
  [[-.18, -.2, 1, 0], [.14, -.02, .9, 1], [-.08, .24, .78, 2]].slice(0, s.n || 3).forEach(([x, z, k, t]) => poplarTree(a, x, z, h*k, t + (s.tone || 0), r));
  scrub(a, .28, .3, .9); a.into(g);
}
function willow(g, s){
  const a = new Acc(), r = rngFrom(s.x*3 + s.z*17), h = s.h || .9;
  const base = new THREE.Vector3(0, 0, 0); seg(a, MAT.bark, base, new THREE.Vector3(.08, 1, -.04).normalize(), h*.34, .07, .05, 7);
  const top = new THREE.Vector3(.03, h*.34, -.015);
  for (let i=0;i<5;i++){ const aa = i/5*6.28; seg(a, MAT.bark, top, new THREE.Vector3(Math.cos(aa)*.5, 1, Math.sin(aa)*.5).normalize(), h*.18, .02, .012, 5); }
  const ms = [swayMat(0x86B24C, h, .02), swayMat(0x9EC45A, h, .02), swayMat(0x729E42, h, .02)];
  [[0, .62, 0, .3], [.2, .52, .1, .2], [-.18, .54, -.06, .21], [.04, .5, -.2, .2], [-.08, .5, .2, .19], [.18, .46, -.16, .16]].forEach(([x, y, z, rr], i) => {
    const geo = new THREE.IcosahedronGeometry(rr*h, 1), p = geo.attributes.position; for (let k=0;k<p.count;k++){ const f = 1 + (r() - .5)*.22; p.setXYZ(k, p.getX(k)*f, p.getY(k)*f*(p.getY(k) < 0 ? 1.35 : 1), p.getZ(k)*f); }
    a.add(geo, ms[i % 3], at(x*h, y*h, z*h)); });
  a.into(g);
}
function seabuckthorn(g, s){
  const a = new Acc(), r = rngFrom(s.x*9 + s.z*2 + 4);
  (s.v ? [[-.15, -.12, .2], [.16, .06, .17], [-.06, .22, .14], [.2, -.22, .12]] : [[-.1, -.1, .22], [.18, .14, .16], [-.2, .22, .13]]).forEach(([x, z, rr]) => {
    for (let k=0;k<3;k++) blob(a, k%2 ? MAT.sb : MAT.sbD, new THREE.Vector3(x + (r() - .5)*rr*.5, rr*(.7 + k*.25), z + (r() - .5)*rr*.5), rr*(.8 - k*.12), 1.1, 1, r);
    for (let k=0;k<12;k++){ const aa = r()*6.28, yy = rr*(.5 + r()*1.1); blob(a, MAT.berry, new THREE.Vector3(x + Math.cos(aa)*rr*.85, yy, z + Math.sin(aa)*rr*.85), .018); } });
  a.into(g);
}

/* ── growing pieces (Sudoku / Math) ── */
/* barley terrace: a dry-stone rim, furrowed soil, barley that sprouts, heads and turns gold */
function fillBarley(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 3);
  const gold = stage >= 5, green = swayMat(gold ? 0xE6C25A : stage >= 4 ? 0xA9C653 : 0x86BE4E, .3, .05), green2 = swayMat(gold ? 0xD4AA46 : 0x74AC44, .3, .05);
  const H = [0, .05, .09, .15, .2, .22][stage];
  for (let i=0;i<4;i++) for (let j=0;j<4;j++){ const px = (i - 1.5)*.19 + (r() - .5)*.03, pz = (j - 1.5)*.19 + (r() - .5)*.03;
    const n = stage === 1 ? 3 : 5;
    for (let k=0;k<n;k++){ const d = new THREE.Vector3((r() - .5)*.35, 1, (r() - .5)*.35).normalize(), L = H*(.75 + r()*.35);
      a.add(new THREE.ConeGeometry(.009, L, 3).translate(0, L/2, 0), k%2 ? green : green2, _M2.compose(_V.set(px, .07, pz), _Q2.setFromUnitVectors(_up, d), new THREE.Vector3(1,1,1)));
      if (stage >= 4 && k%2 === 0) { const tp = new THREE.Vector3(px, .07, pz).addScaledVector(d, L*.92);
        a.add(new THREE.CapsuleGeometry(.009, .03, 2, 4), green, _M2.compose(tp, _Q2.setFromUnitVectors(_up, d), new THREE.Vector3(1,1,1))); } } }
  if (stage >= 5) { cyl(a, MAT.sheaf, .05, .02, .09, .3, .07, .3, 7); cyl(a, MAT.sheaf, .045, .02, .08, .18, .07, .34, 7); a.into(host); host.userData.stage = stage; return; }
  a.into(host); host.userData.stage = stage;
}
/* prayer-flag line: two poles, then flags strung one line at a time; at stage 5 a tall darchen stands in the middle */
function fillFlags(host, s, stage){
  host.clear(); const a = new Acc(), v = (s.x + s.z) % 2;
  const P = v ? [[-.36, -.26], [.34, .3], [.3, -.34]] : [[-.36, .14], [.3, -.3], [-.12, -.36]];
  const hp = [0, .32, .38, .42, .46, .48][stage], y0 = .07;
  pole(a, P[0][0], P[0][1], hp, y0); pole(a, P[1][0], P[1][1], hp, y0);
  flagLine(a, new THREE.Vector3(P[0][0], y0 + hp, P[0][1]), new THREE.Vector3(P[1][0], y0 + hp, P[1][1]), [0, 3, 5, 7, 8, 8][stage], .08, .085, .1);
  if (stage >= 3) { const th = stage >= 5 ? .74 : .56; pole(a, P[2][0], P[2][1], th, y0);
    flagLine(a, new THREE.Vector3(P[2][0], y0 + th - .04, P[2][1]), new THREE.Vector3(P[1][0], y0 + hp, P[1][1]), stage === 3 ? 3 : 6, .06, .08, .095, 2);
    if (stage >= 4) flagLine(a, new THREE.Vector3(P[2][0], y0 + th - .04, P[2][1]), new THREE.Vector3(P[0][0], y0 + hp, P[0][1]), stage === 4 ? 3 : 6, .06, .08, .095, 4);
    if (stage >= 5) { for (let i=0;i<5;i++) a.add(new THREE.PlaneGeometry(.06, .085).translate(.032, 0, 0), flagMat(i), at(P[2][0] + .006, y0 + th - .1 - i*.085, P[2][1], .6));
      a.add(new THREE.SphereGeometry(.022, 8, 6), MAT.gold, at(P[2][0], y0 + th + .02, P[2][1])); } }
  a.into(host); host.userData.stage = stage;
}

/* ── named pieces ── */
/* Reading, ring 1 hero (2×2): whitewashed houses stacked up a low ochre hill, firewood and apricots on the roofs */
function stackedHouses(g){
  const a = new Acc(), r = rngFrom(12);
  batter(a, MAT.rock, 1.3, 1.1, .2, -.18, 0, -.22, .82); batter(a, MAT.ochreD, .9, .7, .14, -.28, .2, -.36, .8);
  for (let i=0;i<9;i++){ const aa = i/9*6.28; blob(a, i%2 ? MAT.rockD : MAT.rock, new THREE.Vector3(-.2 + Math.cos(aa)*.62, .04, -.22 + Math.sin(aa)*.5), .08 + r()*.04, .6, 0, r); }
  tHouse(a, { W:.56, D:.46, H:.42, x:-.3, y:.34, z:-.4, winZ:[-.12, .12], winX:[-.08, .12], band:.06, wood:true, gyaltsen:[[1, 1], [-1, 1]], gs:.9 });
  tHouse(a, { W:.58, D:.48, H:.44, x:.28, y:0, z:.18, winZ:[.14], winX:[-.1, .12], door:-.1, rows:[.26], apricot:true });
  tHouse(a, { W:.42, D:.38, H:.34, x:-.36, y:.02, z:.44, winZ:[.08], winX:[0], door:-.08, rows:[.2], wood:true });
  // steps up the hill between the houses, a little chorten on the shoulder
  for (let i=0;i<4;i++) slab(a, MAT.stoneL, .16, .05, .1, .0 - i*.02, i*.06, .1 - i*.1);
  chorten(a, .46, -.42, .55, 0);
  a.into(g);
}
function monkHouse(g){
  const a = new Acc();
  tHouse(a, { W:.6, D:.52, H:.46, winZ:[.14], winX:[-.12, .12], door:-.1, rows:[.28], band:.07, gyaltsen:[[1, 1], [-1, -1]], gs:.9 });
  wheel(a, .28, 0, .34, .8); blob(a, MAT.stone, new THREE.Vector3(-.3, .02, .32), .05, .6); a.into(g);
}
function bigChorten(g, s){
  const a = new Acc(), r = rngFrom(s.x*7 + s.z*3);
  slab(a, MAT.stoneD, .7, .04, .7, 0, 0, 0, .0); chorten(a, 0, 0, 1.2, .04);
  // butter-lamp niche + a heap of plain mani stones at the foot
  for (let i=0;i<6;i++) blob(a, i%2 ? MAT.stoneL : MAT.stone, new THREE.Vector3(.28 + (r() - .5)*.1, .03 + (i > 3 ? .04 : 0), .28 + (r() - .5)*.1), .04, .45, 0, r);
  cyl(a, MAT.gold, .02, .025, .03, -.26, .04, .3, 8); a.add(new THREE.ConeGeometry(.01, .025, 6), MAT.flame, at(-.26, .085, .3));
  glowSprite(g, new THREE.Vector3(-.26, .1, .3), .22, 0xFFB050, .55);
  a.into(g);
}
function wheelHall(g){
  const a = new Acc();
  slab(a, MAT.stoneD, .86, .04, .5, 0, 0, -.02);
  batter(a, MAT.white, .8, .2, .34, 0, .04, -.14, .92); slab(a, MAT.maroon, .76, .06, .19, 0, .32, -.14);
  slab(a, MAT.roofLip, .9, .035, .5, 0, .38, -.02); slab(a, MAT.whiteD, .86, .02, .46, 0, .415, -.02);
  for (const x of [-.4, .4]) seg(a, MAT.maroonD, new THREE.Vector3(x, .04, .2), _up, .34, .018, .016, 6);
  slab(a, MAT.whiteD, .78, .05, .1, 0, .04, .06);
  for (let i=0;i<6;i++) wheel(a, -.3 + i*.12, .09, .06, .95);
  gyaltsen(a, 0, .435, -.12, .9); a.into(g);
}
function chortenGate(g){
  const a = new Acc();
  for (const x of [-.26, .26]) { batter(a, MAT.white, .24, .4, .36, x, 0, 0, .9); slab(a, MAT.maroon, .22, .04, .37, x, .3, 0); }
  slab(a, MAT.roofLip, .8, .04, .44, 0, .36, 0); slab(a, MAT.whiteD, .74, .03, .4, 0, .4, 0);
  a.add(bx(.28, .012, .38), MAT.maroonD, at(0, .352, 0));   // painted ceiling under the span
  chorten(a, 0, 0, .62, .43);
  for (const x of [-.4, .4]) blob(a, MAT.stone, new THREE.Vector3(x, .02, .22), .04, .6);
  a.into(g);
}
function maniWall(g, s){
  const a = new Acc(), r = rngFrom(s.x*11 + s.z*5);
  batter(a, MAT.stoneD, .72, .22, .16, 0, 0, 0, .86);
  for (let i=0;i<9;i++){ const x = -.3 + i*.075; a.add(bx(.07, .1, .035), r() < .5 ? MAT.stoneL : MAT.stone, at(x + (r() - .5)*.01, .19, (r() - .5)*.03, (r() - .5)*.2, 1, 1, 1, -.25 + (r() - .5)*.2, 0));
    a.add(bx(.07, .1, .035), r() < .5 ? MAT.stoneL : MAT.stone, at(x + (r() - .5)*.01, .19, .05 + (r() - .5)*.02, (r() - .5)*.2, 1, 1, 1, .25, 0)); }
  chorten(a, -.42, 0, .45); chorten(a, .42, 0, .45);
  a.into(g);
}
/* Breathe: a water-driven prayer wheel hut over a little turquoise stream */
function waterWheel(g, s){
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*3);
  slab(a, MAT.bank, .98, .02, .26, 0, 0, .05, .5); slab(a, MAT.water, .98, .012, .16, 0, .014, .05, .5);
  for (let i=0;i<8;i++){ const t = i/7 - .5; blob(a, i%2 ? MAT.stone : MAT.stoneD, new THREE.Vector3(t*.9*Math.cos(.5) + (i%2 ? .1 : -.1)*Math.sin(.5), .02, .05 - t*.9*Math.sin(.5) + (i%2 ? .1 : -.1)*Math.cos(.5)), .035 + r()*.02, .6); }
  batter(a, MAT.white, .36, .34, .3, -.02, .02, -.02, .9); slab(a, MAT.maroon, .33, .05, .31, -.02, .26, -.02);
  slab(a, MAT.roofLip, .4, .03, .38, -.02, .32, -.02); gyaltsen(a, -.02, .35, -.02, .9);
  a.add(bx(.14, .18, .02), MAT.black, at(-.02, .12, .15)); wheel(a, -.02, .05, .17, .75);
  scrub(a, .3, -.3, 1); a.into(g);
}
/* Breathe: an ice stupa (artificial glacier cone) with a fountain pipe at the tip and meltwater pool */
function iceStupa(g, s){
  const a = new Acc(), r = rngFrom(s.x*5 + s.z*9 + 2);
  pool(a, g, r, .36, .34, 0, 0, 4);
  const geo = new THREE.ConeGeometry(.3, .86, 9, 5).translate(0, .43, 0), p = geo.attributes.position;
  for (let i=0;i<p.count;i++){ const y = p.getY(i); if (y > .85 || y < .01) continue; const f = 1 + (r() - .5)*.3; p.setXYZ(i, p.getX(i)*f, y + (r() - .5)*.04, p.getZ(i)*f); }
  a.add(geo, MAT.ice, at(0, .03, 0));
  for (let i=0;i<7;i++){ const aa = i/7*6.28; blob(a, MAT.iceD, new THREE.Vector3(Math.cos(aa)*.26, .08, Math.sin(aa)*.26), .08 + r()*.03, .8, 0, r); }
  seg(a, MAT.black, new THREE.Vector3(0, .8, 0), _up, .1, .01, .01, 5);
  a.add(new THREE.ConeGeometry(.05, .12, 8).rotateX(Math.PI), MAT.jet, at(0, .93, 0));
  a.into(g);
}
function pondPiece(g, s){
  const a = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 1);
  pool(a, g, r, .3, .27, .02, .04, 5); chorten(a, -.3, -.3, .38); scrub(a, .32, .32, 1);
  a.into(g);
}
function lakePiece(g){
  const a = new Acc(), r = rngFrom(71);
  pool(a, g, r, .42, .4, 0, 0, 6);
  for (let i=0;i<3;i++){ const aa = 3.6 + i*.35; scrub(a, Math.cos(aa)*.42, Math.sin(aa)*.4, .9); }
  a.into(g);
}
/* To-dos: paths and small props */
function path(g, s){
  const sl = new THREE.Mesh(G.path, MAT.ochreL); sl.position.y = .0175; sl.receiveShadow = true; g.add(sl);
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0;
  if (v === 0) { [[-.2,-.2],[.18,-.2],[-.18,.2],[.2,.19]].forEach(([x,z]) => a.add(new THREE.BoxGeometry(.28, .03, .26), r() < .5 ? MAT.stone : MAT.stoneL, at(x + (r()-.5)*.05, .045, z + (r()-.5)*.05, (r()-.5)*.3)));
    g.userData.ghostMode = 'marker'; }
  else if (v === 1) { slab(a, MAT.stoneD, .3, .04, .3, 0, .035, 0); batter(a, MAT.white, .22, .22, .12, 0, .075, 0, .9);
    for (const x of [-.12, .12]) seg(a, MAT.maroonD, new THREE.Vector3(x, .195, 0), _up, .24, .012, .012, 5);
    slab(a, MAT.maroon, .34, .03, .2, 0, .43, 0); wheel(a, 0, .195, 0, 1.25);
    cyl(a, MAT.gold, .015, .02, .025, .2, .035, .2, 8); a.add(new THREE.ConeGeometry(.008, .02, 6), MAT.flame, at(.2, .07, .2)); glowSprite(g, new THREE.Vector3(.2, .08, .2), .18, 0xFFB050, .5); }
  else if (v === 2) { // doko baskets + copper water jugs
    for (const [x, z, k] of [[-.14, -.1, 1], [.1, -.16, .85]]) { a.add(new THREE.CylinderGeometry(.08*k, .04*k, .2*k, 9, 1, true), MAT.twig, at(x, .035 + .1*k, z)); cyl(a, MAT.roofLip, .04*k, .04*k, .01, x, .035, z, 9); }
    for (const [x, z] of [[.14, .12], [-.04, .16]]) { cyl(a, MAT.copper, .045, .05, .07, x, .035, z, 10); cyl(a, MAT.copper, .03, .045, .04, x, .105, z, 10); }
    blob(a, MAT.stone, new THREE.Vector3(-.24, .06, .22), .05, .6); }
  else if (v === 3) { pole(a, 0, 0, .7, .035);   // darchen: a tall pole with a vertical flag
    for (let i=0;i<5;i++) a.add(new THREE.PlaneGeometry(.05, .08).translate(.026, 0, 0), flagMat(i), at(.006, .035 + .66 - i*.08, 0, .6));
    a.add(new THREE.SphereGeometry(.02, 8, 6), MAT.gold, at(0, .75, 0));
    for (let i=0;i<3;i++) { const p0 = new THREE.Vector3(0, .66, 0), aa = .6 + i*.9; flagLine(a, p0, new THREE.Vector3(Math.cos(aa)*.42, .06, Math.sin(aa)*.42), 5, .02, .05, .06, i); } }
  else if (v === 4) { // apricots drying on a mat
    a.add(bx(.56, .01, .44), MAT.cloth, at(0, .04, 0, .15));
    for (let i=0;i<26;i++) blob(a, i%5 ? MAT.apricot : MAT.berry, new THREE.Vector3((r() - .5)*.48, .05, (r() - .5)*.36), .02, .7);
    for (const [x, z] of [[.32, .28], [-.3, .3]]) blob(a, MAT.stone, new THREE.Vector3(x, .05, z), .045, .6); }
  else { // a curved dry-stone wall nook with a juniper-smoke burner
    for (let i=0;i<7;i++){ const aa = Math.PI*.9 + i*.14; blob(a, i%2 ? MAT.stone : MAT.stoneD, new THREE.Vector3(Math.cos(aa)*.34 + .1, .07, Math.sin(aa)*.34 + .1), .07, .75, 0, r);
      blob(a, MAT.stoneL, new THREE.Vector3(Math.cos(aa)*.34 + .1, .15, Math.sin(aa)*.34 + .1), .05, .6, 0, r); }
    batter(a, MAT.white, .12, .12, .16, .12, .035, .12, .75); a.add(new THREE.ConeGeometry(.04, .06, 4).rotateY(Math.PI/4), MAT.white, at(.12, .225, .12)); }
  a.into(g);
}
function stoneWall(g, s){
  const a = new Acc(), L = s.len, r = rngFrom(s.x*3 + s.z*7 + L);
  const run = u => s.edge === 'w' ? [-.45, u, 0] : [u, .45, Math.PI/2];
  for (let i=0;i<L;i++){ const [x, z, ry] = run(i - (L-1)/2);
    a.add(bx(.1, .12, .96), MAT.stoneD, at(x, .06, z, ry));
    for (let k=0;k<6;k++){ const u = -.4 + k*.16, px = s.edge === 'w' ? x : x + u, pz = s.edge === 'w' ? z + u : z;
      blob(a, k%2 ? MAT.stone : MAT.stoneL, new THREE.Vector3(px, .14, pz), .06, .55, 0, r); } }
  for (let i=0;i<=L;i+=L){ const [x, z] = run(i - L/2); chorten(a, x, z, .3); }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}
/* the hero (Gita): a cliffside gompa — whitewashed halls stacked up a rust-and-ochre crag, maroon upper bands,
   a gold roof, chortens at the foot, prayer flags strung from the roof down to the valley */
function gompa(g){
  const a = new Acc(), r = rngFrom(5);
  // the crag: three tiers of rock with craggy boulders around them
  batter(a, MAT.rock, 1.8, 1.7, .36, -.08, 0, -.1, .84); batter(a, MAT.rust, 1.2, 1.0, .34, -.28, .36, -.34, .82);
  batter(a, MAT.rockD, .72, .62, .2, -.44, .7, -.5, .8);
  for (let i=0;i<14;i++){ const aa = i/14*6.28; blob(a, [MAT.rock, MAT.rockD, MAT.rockM][i%3], new THREE.Vector3(-.08 + Math.cos(aa)*.84, .06 + (i%3)*.03, -.1 + Math.sin(aa)*.78), .12 + r()*.05, .7, 0, r); }
  for (let i=0;i<8;i++){ const aa = i/8*6.28; blob(a, i%2 ? MAT.rust : MAT.rockM, new THREE.Vector3(-.28 + Math.cos(aa)*.56, .38, -.34 + Math.sin(aa)*.48), .09 + r()*.04, .7, 0, r); }
  // top: the main assembly hall (dukhang) with a tall maroon band and a gold roof pavilion
  tHouse(a, { W:.66, D:.52, H:.46, x:-.42, y:.88, z:-.46, winZ:[-.14, .14], winX:[-.1, .12], rows:[.2], band:.14, gyaltsen:[[1, 1], [-1, 1], [1, -1]], gs:1.1 });
  const RY = .88 + .46 + .055;
  batter(a, MAT.maroon, .26, .24, .08, -.42, RY, -.48, .9);
  a.add(new THREE.ConeGeometry(.24, .16, 4).rotateY(Math.PI/4), MAT.gold, at(-.42, RY + .16, -.48));
  a.add(new THREE.CylinderGeometry(.02, .035, .08, 8), MAT.gold, at(-.42, RY + .27, -.48)); blob(a, MAT.gold, new THREE.Vector3(-.42, RY + .33, -.48), .025);
  // middle tier: monks' quarters on the rust ledge
  tHouse(a, { W:.72, D:.36, H:.36, x:-.12, y:.68, z:-.02, winZ:[-.2, 0, .2], winX:[0], rows:[.18], band:.06 });
  tHouse(a, { W:.36, D:.3, H:.3, x:.36, y:.36, z:-.4, winZ:[0], winX:[0], rows:[.14] });
  // lower tier: a long white hall on the first shelf, a porch door facing the camera
  tHouse(a, { W:.84, D:.34, H:.34, x:.08, y:.36, z:.32, winZ:[-.26, .26], winX:[0], rows:[.16], door:0 });
  // zigzag stone steps from the valley floor up the crag front
  for (let i=0;i<7;i++) slab(a, MAT.stoneL, .2, .052, .1, .62 - (i%2)*.04, i*.052, .76 - i*.068);
  // chortens at the foot, a row of prayer wheels by the steps
  chorten(a, -.66, .7, .5); chorten(a, -.38, .8, .38); chorten(a, .82, .08, .4, 0);
  slab(a, MAT.whiteD, .34, .06, .08, .72, 0, .9); for (let i=0;i<3;i++) wheel(a, .62 + i*.1, .06, .9, .7);
  // prayer flags from the hall roof down to a pole in the valley, and a second line across the ledge
  pole(a, .88, .78, .42);
  flagLine(a, new THREE.Vector3(-.2, RY + .02, -.28), new THREE.Vector3(.88, .44, .78), 16, .1, .06, .07);
  flagLine(a, new THREE.Vector3(-.74, RY - .02, -.24), new THREE.Vector3(-.82, .2, .62), 10, .06, .055, .065, 2);
  pole(a, -.82, .62, .2);
  // butter lamps glow in the hall porch
  a.into(g);
  glowSprite(g, new THREE.Vector3(.08, .46, .52), .36, 0xFFB050, .5);
  glowSprite(g, new THREE.Vector3(-.42, RY + .2, -.48), 1.2, 0xFFD27A, .22);
}

/* ── blueprint: the farm's cells with Ladakh pieces; the gompa takes the left corner ── */
const MAP = {
  bigbarn:{ name:'Hillside houses', b:'houses' }, well:{ name:'Water prayer wheel', b:'wwheel' },
  apple1:{ name:'Poplar grove', b:'poplar', h:1.35 },
  silo:{ name:'White chorten', b:'chorten' }, silohouse:{ name:'Prayer wheel hall', b:'whall' }, coop:{ name:"Monks' house", b:'monk' },
  watertower:{ name:'Ice stupa', b:'ice' }, pump:{ name:'Turquoise pond', b:'pond' }, apple2:{ name:'Willow', b:'willow' },
  berry1:{ name:'Seabuckthorn', b:'sbt', v:0 }, peepal:{ name:'Cliffside gompa', b:'hero' },
  smallbarn:{ name:'Mani wall', b:'mani' }, openbarn:{ name:'Chorten gate', b:'gate' },
  pond:{ name:'Turquoise lake', b:'lake' }, orange1:{ name:'Poplar grove', b:'poplar', h:1.45, tone:1 },
  apple3:{ name:'Willow', b:'willow', h:.95 }, berry2:{ name:'Seabuckthorn', b:'sbt', v:1 },
  orange2:{ name:'Poplar grove', b:'poplar', h:1.3, tone:2 }, apple4:{ name:'Poplar pair', b:'poplar', h:1.25, n:2, tone:1 }
};
const MOVE = { peepal:{ x:0, z:5 }, field1_5:{ x:1, z:1 }, fence3:{ x:0, z:0, edge:'w' } };   // hero to the left corner
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:0, path2_6:4, path3_6:5 };
const PATH_NAME = ['Flagstone walk', 'Prayer wheel', 'Baskets & jugs', 'Flag pole', 'Drying apricots', 'Stone nook'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d, ...(MOVE[f.id] || {}) };
  if (f.kind === 'field') return f.crop === 'Corn' ? { ...s, kind:'barley', name:'Barley terrace', stages:5 } : { ...s, kind:'flags', name:'Prayer flags', stages:5 };
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'ladakh', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'ladakh', b:'wall', edge:s.edge || f.edge, len:f.len, name:'Dry-stone wall' };
  return { ...s, kind:'ladakh', ...MAP[f.id] };
});
const BUILD = { houses:stackedHouses, monk:monkHouse, chorten:bigChorten, whall:wheelHall, gate:chortenGate, mani:maniWall,
  wwheel:waterWheel, ice:iceStupa, pond:pondPiece, lake:lakePiece, poplar:poplarRow, willow, sbt:seabuckthorn, path, wall:stoneWall, hero:gompa };

/* ── the ground: dry ochre earth with gravel on a rust-brown block ── */
const TILE = { top:['#DDB47C', '#D5AA70'], side:'#B98556', soilTop:'#A5704A', soilBot:'#5E3E2A' };
function tileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(61);
  g.fillStyle = '#FBF4EA'; g.fillRect(0,0,N,N);
  for (let i=0;i<14;i++){ g.fillStyle = 'rgba(150,95,45,.07)'; g.beginPath(); g.ellipse(r()*N, r()*N, 18 + r()*30, 10 + r()*18, r()*3, 0, 6.3); g.fill(); }
  for (let i=0;i<420;i++){ const k = r(); g.fillStyle = k < .4 ? 'rgba(255,255,255,.6)' : k < .8 ? 'rgba(120,80,45,.18)' : 'rgba(130,120,130,.22)';
    g.beginPath(); g.arc(r()*N, r()*N, .6 + r()*1.4, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/* decor: low ochre mounds, rocks, dry scrub on empty cells; a hint on waiting cells */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    const rock = (px, pz, k=1) => km(grp, 'a', ['Rock_Medium_1','Rock_Medium_2','Rock_Medium_3'][Math.floor(r()*3)], .08*k, .16*k, px, p.y, pz, r()*6);
    const pebble = (px, pz) => km(grp, 'a', 'Pebble_Round_' + (1 + Math.floor(r()*3)), .05, .1, px, p.y, pz, r()*6);
    if (!sl || sl === 'later') {
      blob(a, r() < .5 ? MAT.ochre : MAT.ochreD, new THREE.Vector3(p.x + (r()-.5)*.3, p.y - .03, p.z + (r()-.5)*.3), .28 + r()*.1, .26, 1, r);
      scrub(a, p.x + .24, p.z - .22, .9 + r()*.3, p.y); rock(p.x - .28, p.z + .24); pebble(p.x + .26, p.z + .28);
      if (AMBIENT()) scrub(a, p.x - .3, p.z - .26, .7, p.y);
      grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { scrub(a, p.x + .3, p.z + .3, .7, p.y); if (r() < .5) pebble(p.x - .3, p.z + .28); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if ((Math.abs(x-3) === V.ring && x > 3) || (Math.abs(z-3) === V.ring && z > 3)) { pebble(p.x + .38, p.z + .38); grp.userData.decor = 'rim'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ── env: a stark ridge line of banded ochre / rust / mauve mountains behind the back corner, only the tips snowed ── */
function ridgeGeo(R, H, seed, snowAt){
  const g = new THREE.ConeGeometry(R, H, 8, 6).translate(0, H/2, 0), p = g.attributes.position, r = rngFrom(seed);
  for (let i=0;i<p.count;i++){ const y = p.getY(i); if (y > H - 1e-3 || y < 1e-3) continue; const k = 1 + (r()-.5)*.36;
    p.setXYZ(i, p.getX(i)*k, y + (r()-.5)*H*.05, p.getZ(i)*k); }
  const ng = g.toNonIndexed(), q = ng.attributes.position, col = new Float32Array(q.count*3);
  const cs = new THREE.Color(0xF7F8FB), bands = [0xC99A62, 0xB27A4C, 0x9A7270, 0xC4925C, 0xA8663F].map(h => new THREE.Color(h));
  for (let f=0; f<q.count; f+=3){ const ym = (q.getY(f) + q.getY(f+1) + q.getY(f+2))/3, t = ym/H;
    const c = t > snowAt + Math.sin(f*.7)*.04 ? cs : bands[Math.max(0, Math.min(4, Math.floor(t*6 + ((f/3)%2)*.4)))];
    for (let k=0;k<3;k++) col.set([c.r, c.g, c.b], (f + k)*3); }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3)); ng.computeVertexNormals(); return ng;
}
const RIDGE_MAT = new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:.95, metalness:0 });
function buildEnv(){
  const L = V.L, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const c = -L/2 - .55, base = -.63, H = .7 + L*.24;
  [[0, 0, 1, .95, 5, .8], [1.15, -.35, .72, .62, 9, .84], [-.35, 1.15, .66, .58, 13, .85], [2.1, -.5, .5, .42, 17, .9], [-.5, 2.1, .46, .4, 21, .9]].forEach(([dx, dz, kh, kr, seed, sn]) => {
    const m = new THREE.Mesh(ridgeGeo((.8 + L*.09)*kr, H*kh, seed, sn), RIDGE_MAT); m.position.set(c + dx, base, c + dz); m.castShadow = m.receiveShadow = true; m.renderOrder = 0; env.add(m); });
  V.framePts.push(new THREE.Vector3(c, base + H, c));
}

/* ── ambient: a V of bar-headed geese crossing high above; prayer flags flutter via the sway shader ── */
function makeGoose(){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.035, 8, 6), MAT.goose, at(0, 0, 0, 0, .8, .7, 1.9));
  a.add(new THREE.CylinderGeometry(.009, .012, .07, 5).rotateX(Math.PI/2), MAT.gooseH, at(0, .01, .09));
  blob(a, MAT.gooseH, new THREE.Vector3(0, .015, .13), .016); a.add(new THREE.ConeGeometry(.006, .025, 4).rotateX(Math.PI/2), MAT.gooseB, at(0, .012, .15));
  a.into(g);
  const wg = new THREE.PlaneGeometry(.16, .06).rotateX(-Math.PI/2).translate(.08, 0, 0), w1 = new THREE.Mesh(wg, MAT.goose), w2 = new THREE.Mesh(wg, MAT.goose); w2.scale.x = -1;
  g.add(w1, w2); g.userData.wings = [w1, w2]; return g;
}
function addAmbient(){
  V.geese = [];
  for (let i=0;i<5;i++){ const k = i === 0 ? 0 : Math.ceil(i/2), side = i === 0 ? 0 : (i % 2 ? 1 : -1);
    const b = makeGoose(); b.scale.setScalar(.75 + V.ring*.08); b.userData.u = { dx:side*k*.2, dz:-k*.2, ph:i*.9 }; world.add(b); V.geese.push(b); V.life.push(b); }
  moveAmbient(2.1);
}
function moveAmbient(t){
  if (!V || !V.geese) return; const R = V.L/2 + 1.2, span = R*2, sp = .18, x0 = ((t*sp*1.0 + R) % span + span) % span - R;
  const dir = new THREE.Vector3(1, 0, -.35).normalize(), side = new THREE.Vector3(.35, 0, 1).normalize();
  V.geese.forEach(b => { const u = b.userData.u, h = TILE_TOP + 1.9 + V.ring*.3;
    const p = dir.clone().multiplyScalar(x0 + u.dz).addScaledVector(side, u.dx - .4); b.position.set(p.x, h + Math.sin(t*.8 + u.ph)*.04, p.z);
    b.rotation.y = Math.atan2(dir.x, dir.z); b.visible = !S.night; const f = Math.sin(t*5 + u.ph)*.45; b.userData.wings[0].rotation.z = f; b.userData.wings[1].rotation.z = -f; });
}

/* ── residents: two yaks plod in, a snow leopard pads to a rock at the front, black-necked cranes glide down to the lake ── */
const RES_SCALE = 1.5;
function legRig(g, pts, len, mat, dark, r0=.03){
  const legs = [];
  for (const [x, z] of pts) { const L = new THREE.Group(), la = new Acc(); L.position.set(x, len, z);
    seg(la, mat, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0), len, r0, r0*.7, 6); blob(la, dark, new THREE.Vector3(0, -len, .005), r0*.85, .8);
    la.into(L); g.add(L); legs.push(L); }
  g.userData.legs = legs;
}
function makeYak(v=0){
  const g = new THREE.Group(), a = new Acc(), body = v ? MAT.yakW : MAT.yak, dark = MAT.yakD, head = v ? MAT.yak : MAT.yak;
  a.add(new THREE.SphereGeometry(.13, 12, 9), body, at(0, .27, -.02, 0, .95, .85, 1.45));
  blob(a, body, new THREE.Vector3(0, .36, .08), .1, 1, 1);                                            // shoulder hump
  a.add(new THREE.CylinderGeometry(.13, .15, .12, 12, 1, true), v ? MAT.yakW : dark, at(0, .15, -.02, 0, .95, 1, 1.4));   // long shaggy skirt
  for (let i=0;i<10;i++){ const aa = i/10*6.28; a.add(new THREE.ConeGeometry(.03, .07, 4).rotateX(Math.PI), v && i%3 ? MAT.yakW : dark, at(Math.cos(aa)*.125, .1, -.02 + Math.sin(aa)*.18)); }
  a.add(new THREE.SphereGeometry(.07, 10, 8), head, at(0, .27, .22, 0, .85, .9, 1.1)); blob(a, MAT.nose, new THREE.Vector3(0, .24, .29), .035, .8);
  if (v) blob(a, MAT.yakW, new THREE.Vector3(0, .31, .27), .03, .7);   // white blaze
  for (const sx of [-1, 1]) { blob(a, MAT.eye, new THREE.Vector3(sx*.045, .29, .27), .008);
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(sx*.04, .32, .21), new THREE.Vector3(sx*.1, .34, .21), new THREE.Vector3(sx*.12, .4, .23), new THREE.Vector3(sx*.1, .44, .25)]);
    a.add(new THREE.TubeGeometry(c, 6, .011, 5), MAT.horn); blob(a, dark, new THREE.Vector3(sx*.075, .31, .19), .02, .5); }
  seg(a, dark, new THREE.Vector3(0, .3, -.2), new THREE.Vector3(0, -1, -.35), .12, .014, .01, 4); blob(a, v ? MAT.yakW : dark, new THREE.Vector3(0, .19, -.26), .04, 1.4);
  a.into(g); legRig(g, [[-.06, .12], [.06, .12], [-.06, -.15], [.06, -.15]], .12, dark, MAT.yakD, .03); return g;
}
function makeLeopard(){
  const g = new THREE.Group(), a = new Acc(), r = rngFrom(33);
  a.add(new THREE.CapsuleGeometry(.055, .2, 4, 10).rotateX(Math.PI/2), MAT.leo, at(0, .16, 0));
  a.add(new THREE.SphereGeometry(.055, 10, 8), MAT.leo, at(0, .2, .16, 0, 1, .9, 1)); blob(a, MAT.leoD, new THREE.Vector3(0, .18, .21), .03, .8);
  blob(a, MAT.eye, new THREE.Vector3(0, .185, .235), .008);
  for (const sx of [-1, 1]) { blob(a, MAT.eyeL, new THREE.Vector3(sx*.022, .215, .205), .008); a.add(new THREE.ConeGeometry(.018, .03, 4), MAT.leo, at(sx*.035, .25, .15)); }
  const tail = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .17, -.14), new THREE.Vector3(0, .09, -.26), new THREE.Vector3(.06, .05, -.38), new THREE.Vector3(.14, .08, -.42), new THREE.Vector3(.18, .14, -.38)]);
  a.add(new THREE.TubeGeometry(tail, 14, .028, 7), MAT.leo); blob(a, MAT.spot, tail.getPoint(1), .03);
  for (let i=0;i<22;i++){ const u = r()*.28 - .14, aa = r()*3 - 1.5; blob(a, MAT.spot, new THREE.Vector3(Math.sin(aa)*.056, .16 + Math.cos(aa)*.05, u), .012 + r()*.006, .6); }
  for (let i=0;i<5;i++) blob(a, MAT.spot, tail.getPoint(.2 + i*.15).add(new THREE.Vector3(0, .02, 0)), .014, .6);
  a.into(g); legRig(g, [[-.035, .11], [.035, .11], [-.035, -.11], [.035, -.11]], .11, MAT.leo, MAT.leoD, .022); return g;
}
function makeCrane(pose=0){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.055, 10, 8), MAT.crane, at(0, .26, 0, 0, .85, .8, 1.45, -.1));
  a.add(new THREE.ConeGeometry(.04, .09, 6).rotateX(-Math.PI/2), MAT.craneK, at(0, .26, -.09, 0, 1, .6, 1));
  for (const sx of [-1, 1]) a.add(new THREE.SphereGeometry(.04, 7, 5), MAT.craneD, at(sx*.036, .27, -.01, 0, .3, .6, 1.3));
  const neck = pose ? new THREE.CatmullRomCurve3([new THREE.Vector3(0, .28, .05), new THREE.Vector3(0, .31, .1), new THREE.Vector3(0, .26, .15), new THREE.Vector3(0, .2, .18)])
    : new THREE.CatmullRomCurve3([new THREE.Vector3(0, .28, .05), new THREE.Vector3(0, .36, .07), new THREE.Vector3(0, .43, .06), new THREE.Vector3(0, .47, .07)]);
  a.add(new THREE.TubeGeometry(neck, 10, .012, 6), MAT.craneK);
  const hp = neck.getPoint(1); blob(a, MAT.craneK, hp, .02, 1); blob(a, MAT.craneR, hp.clone().add(new THREE.Vector3(0, .014, 0)), .01, .6);
  a.add(new THREE.ConeGeometry(.007, .045, 5).rotateX(Math.PI/2), MAT.gooseB, at(hp.x, hp.y - .004, hp.z + .03));
  seg(a, MAT.leg, new THREE.Vector3(.013, 0, 0), _up, .22, .005, .005, 4); seg(a, MAT.leg, new THREE.Vector3(-.013, 0, 0), _up, .22, .005, .005, 4);
  a.into(g); return g;
}
const YAKS = [ { at:[0.32, 2.5], face:2.3, v:0 }, { at:[0.36, 3.7], face:1.2, v:1 } ];
const LEO = { at:[5.3, 6.02], face:-.7 };
const CRANES = [ [5.85, 1.9, .6, 0], [6.15, 2.25, -1.9, 1] ];
function moveResidents(t){
  (V && V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'walker') { const walking = r.arrive < 1, p = u.from.clone().lerp(u.at, walking ? 1 - Math.pow(1 - r.arrive, 2.2) : 1);
      r.obj.position.set(p.x, TILE_TOP + (walking ? Math.abs(Math.sin(t*6))*.01 : 0), p.z);
      r.obj.rotation.y = walking ? Math.atan2(u.at.x - u.from.x, u.at.z - u.from.z) : u.face;
      r.obj.userData.legs.forEach((L, i) => L.rotation.x = walking ? Math.sin(t*6 + (i === 0 || i === 3 ? 0 : Math.PI))*.4 : 0);
      r.obj.children[0].rotation.x = walking ? 0 : Math.sin(t*.9 + u.ph)*.012; }
    else if (r.kind === 'crane') { const fly = 1 - e;
      r.obj.position.set(u.at.x + fly*2.2, TILE_TOP + .02 + fly*2.4, u.at.z - fly*1.2);
      r.obj.rotation.y = u.face + Math.sin(t*.5 + u.ph)*.12; }
  });
}
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.07))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(TILE_TOP + .5), 10, 0xFFF0B0, .6); res(); })); }
async function ladakhMoveIn(walk){
  V.residentsIn = true; V.res = [];
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const gate = cellPos(3, 7.3);
  const groups = [
    async () => { const rs = YAKS.map((c, i) => { const o = makeYak(c.v); o.scale.setScalar(RES_SCALE*(i ? .94 : 1));
        return addRes('walker', o, { at:cellPos(...c.at), from:gate.clone().add(new THREE.Vector3(-.4*i, 0, .3*i)), face:c.face, ph:i*1.9 }); });
      moveResidents(0); if (walk) await arrive(rs, 2600); },
    async () => { const o = makeLeopard(); o.scale.setScalar(RES_SCALE);
      const rs = [addRes('walker', o, { at:cellPos(...LEO.at), from:gate.clone().add(new THREE.Vector3(1.4, 0, 0)), face:LEO.face, ph:.7 })];
      moveResidents(0); if (walk) await arrive(rs, 1600); },
    async () => { const rs = CRANES.map(([x, z, f, pose], i) => { const o = makeCrane(pose); o.scale.setScalar(RES_SCALE); return addRes('crane', o, { at:cellPos(x, z), face:f, ph:i*1.4 }); });
      moveResidents(0); if (walk) await arrive(rs, 1800); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length;
}
const RES_MAKE = { yak:() => makeYak(0), leopard:makeLeopard, crane:() => makeCrane(0) };

export default {
  id:'ladakh', name:'Ladakh', title:'Your monastery',
  season:30, dates:'11–24 Jan', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'streams, ponds & ice stupas',   tag:'Water' },
    building:{ label:'houses, chortens & wheel halls', tag:'Building' },
    path:    { label:'walks, wheels, flags & walls',  tag:'Path' },
    crop:    { label:'barley & prayer-flag lines',    tag:'Flags' },
    tree:    { label:'poplars, willows & seabuckthorn', tag:'Tree' },
    special: { label:'the cliffside gompa',           tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:TILE, tileMap },
  ghost:{ color:'#FFFDF6', opacity:.42, emissive:.2, dash:'#FFFFFF', dashOpacity:.72 },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M1.5 19 8 7l3.5 5 3-4.5L22.5 19z" fill="#C99A62"/><path d="M8 7l1.6 2.9-1.6-.7-1.5.8zM14.5 7.5l1.2 1.8-1.2-.4-1 .5z" fill="#fff"/><path d="M8.5 13.2h7l-.4 5H8.9z" fill="#F6F1E7"/><path d="M8.6 13.2h6.8v1.4H8.6z" fill="#86292F"/><path d="M11 16h2v2.2h-2z" fill="#2B2522"/><ellipse cx="18.5" cy="20" rx="3.4" ry="1" fill="#2FC6C8"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M2 118 38 52l18 26 20-36 50 76z"/><path d="M40 118V96l4-2h40l4 2v22z"/><path d="M50 94V76l3-2h24l3 2v18z"/><path d="M62 74V64h8v10z"/><path d="M60 64l6-8 6 8z"/><path d="M96 118h22v-4h-3v-4h-3v-5a5 5 0 0 0-5-5 5 5 0 0 0-5 5v5h-3v4h-3z"/><path d="M106 100V88h2v12z"/></g>',
  album:{ image:'assets/ladakh/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#F4E6D2)' },
  css:'.phone[data-theme="ladakh"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#F8EEE0 58%,#EDD9BD 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'barley' || s.kind === 'flags') {
      const base = new THREE.Mesh(G.field, s.kind === 'barley' ? MAT.stoneD : MAT.ochreL); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      if (s.kind === 'barley') { const soil = new THREE.Mesh(new THREE.BoxGeometry(.8, .01, .8), MAT.soil); soil.position.y = .072; soil.userData.ghostHide = true; g.add(soil); }
      const host = new THREE.Group(); host.scale.setScalar(1.12); g.add(host); g.userData.plants = host;
      const fill = s.kind === 'barley' ? fillBarley : fillFlags; g.userData.regrow = st => fill(host, s, st); fill(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'ladakh' ? 1 : 1.12,
  contact: s => s.kind === 'ladakh' && !['path', 'wall', 'hero'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && s.v === 1) || s.b === 'wwheel',
  decor,
  env: buildEnv,
  ambient: addAmbient,
  tick(t){ moveAmbient(t); moveResidents(t); },

  residents:[ { id:'yak', name:'Yaks', n:2 }, { id:'leopard', name:'Snow leopard', n:1 }, { id:'crane', name:'Black-necked cranes', n:2 } ],
  moveIn: ladakhMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('ladakh:'+d.id, () => { const o = RES_MAKE[d.id](); o.rotation.y = d.id === 'crane' ? .7 : 1.0; return o; }, 168); },
  /* sprite export: static rigs for the code-built residents (the app animates legs / bobbing) */
  residentRig(d){ const obj = RES_MAKE[d.id](); obj.scale.setScalar(RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
