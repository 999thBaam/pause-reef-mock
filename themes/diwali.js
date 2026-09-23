/* DIWALI LANES (?theme=diwali) — an Indian village on the night of lights, on the farm's 7×7 ring blueprint (same cells, same
   ring counts 6 / 15 / 19, same order) except the hero: the Gita temple moves to the LEFT corner (cells 0..1 × 5..6) so nothing
   can stand in front of it, and the two farm slots it displaces move to the old peepal corner.
   No CC0 kit has Indian architecture, so almost everything is procedural flat-shaded three.js geometry, merged per material
   (Acc) so every piece stays pre-renderable: painted flat-roofed houses with arched doors and rooftop diyas, the haveli,
   mithai shop, school, well, stepwell, lotus pond, water stand, banana plants, tulsi planter, rangoli (drawn in 5 stages on a
   canvas), marigold beds, lanes, torans, the shikhara temple, the peacock, sparrows, pigeons, sky lanterns and fireworks.
   Reused CC0 kit pieces: neem/mango trees (Quaternius MegaKit, kit a), coconut palms (Kenney Pirate Kit), grass tufts and
   meadow flowers (Quaternius farm kit), the cows (Quaternius animated Cow). No new asset files. */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { rngFrom, TEX, addSway, world, fx } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, OFF, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, ANIMCACHE, addModel, fitScale, loadAnimal, modelBox } from '../engine/kit.js';
import { G, M, Acc, seg, blob, _up, _q, _m, _s } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { tintedFlower } from '../engine/life.js';
import { FARM, FARM_ORDER } from './farm.js';

/* ── materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.86, metalness:0, flatShading:true, ...o });
const MAT = {
  plinth:FM(0xE9DCC4), stone:FM(0xD8C8AC), stoneD:FM(0xB9A586), white:FM(0xFBF6EC), whiteD:FM(0xEADFCB), lime:FM(0xFFFDF7),
  pink:FM(0xF4A7B6), pinkD:FM(0xD9788E), turq:FM(0x5CC6C0), turqD:FM(0x2E9C98), saffron:FM(0xF6A13A), saffronD:FM(0xD9761E),
  ochre:FM(0xF2C46B), ochreD:FM(0xC99A3E), maroon:FM(0x9B2F3A), indigo:FM(0x3E5BA8), green:FM(0x3F9E5A), greenD:FM(0x2E6E3F),
  wood:FM(0x8A5530), woodD:FM(0x5E3820), door:FM(0x6B3A22), doorGlow:FM(0xFFC878, { emissive:0xFF9A3C, emissiveIntensity:.9 }),
  clay:FM(0xC4683A), clayD:FM(0x9E4A26), brass:FM(0xE3B34A, { roughness:.4, metalness:.25 }), cloth:FM(0xD8343C),
  rope:FM(0xD9BE8A), soil:FM(0x7A4A2A, { roughness:1 }), water:new THREE.MeshStandardMaterial({ color:0x4FB3C9, roughness:.16, emissive:0x0D4454, emissiveIntensity:.35 }),
  leaf:FM(0x4E9A3A), leafD:FM(0x3B7F2E), leafL:FM(0x79B84A), marigold:FM(0xF79A1E, { emissive:0x6A2A00, emissiveIntensity:.15 }), marigoldY:FM(0xF7C62E, { emissive:0x5A3C00, emissiveIntensity:.12 }),
  lotus:FM(0xF6A6C4), lotusD:FM(0xE77AA4), pad:FM(0x5FA844), sweetO:FM(0xF6A623), sweetW:FM(0xFFF3DC), sweetG:FM(0x9ED08A), sweetP:FM(0xF7B4C4),
  bulbA:FM(0xFFE08A, { emissive:0xFFB53A, emissiveIntensity:1.4 }), bulbB:FM(0xFFB0A0, { emissive:0xFF5A48, emissiveIntensity:1.2 }), bulbC:FM(0xB8F0FF, { emissive:0x3FB6E6, emissiveIntensity:1.1 }),
  paper:FM(0xFFB55A, { emissive:0xFF7A1A, emissiveIntensity:.9 }), paperR:FM(0xFF7A70, { emissive:0xE63A2A, emissiveIntensity:.8 }),
  flag:FM(0xFF8A1E, { side:THREE.DoubleSide, emissive:0x7A2E00, emissiveIntensity:.25 }), black:FM(0x2A2320), slate:FM(0x2F4A3E),
  blue:FM(0x2F63C8), blueD:FM(0x1D3F8E), teal:FM(0x2AA38C), gold:FM(0xE8C040, { emissive:0x5A4000, emissiveIntensity:.25 }), brownB:FM(0x9A6A45), greyB:FM(0xA7A6B3), greyD:FM(0x6E6D7C),
  cowbell:FM(0xE3B34A)
};
/* three diya flame materials; tick() flickers them out of phase so the lights shimmer without per-diya work */
const FLAME = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ color:0xFFD36A, emissive:0xFF9A1F, emissiveIntensity:1.7, roughness:.6 }));
const GLOW = [0, 1, 2].map(() => new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFB450, transparent:true, opacity:.55, blending:THREE.AdditiveBlending, depthWrite:false }));
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = FM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }

const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
/* a box resting on y */
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=12){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z)); }

/* arched opening shape (w wide, h tall, semicircular top), facing +z */
function archGeo(w, h, depth=.02){
  const s = new THREE.Shape(), r = w/2; s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled:false, curveSegments:8 });
}
/* an arched door/window on a wall face. face: 'z' (+z) or 'x' (+x). u = position along the face, y0 = sill */
function arch(acc, face, halfD, u, y0, w, h, frame, fill){
  const put = (geo, mat, off) => acc.add(geo, mat, face === 'z' ? at(u, y0, halfD + off) : at(halfD + off, y0, -u, Math.PI/2));
  put(archGeo(w + .05, h + .035, .012), frame, .0);
  put(archGeo(w, h, .016), fill, .004);
}

/* ── diyas: terracotta cup + flame (+ optional glow sprite) ── */
let _fl = 0;
function diya(acc, x, y, z, s=1, parent=null, glow=0){
  acc.add(new THREE.CylinderGeometry(.034*s, .022*s, .022*s, 9), MAT.clay, at(x, y + .011*s, z));
  acc.add(new THREE.SphereGeometry(.016*s, 6, 5), FLAME[_fl++ % 3], at(x, y + .035*s, z, 0, 1, 1.9, 1));
  if (parent && glow) { const sp = new THREE.Sprite(GLOW[_fl % 3]); sp.position.set(x, y + .04*s, z); sp.scale.setScalar(glow); sp.renderOrder = 9; parent.add(sp); }
}
/* a string of marigold beads between two points, sagging */
function garland(acc, a, b, sag=.06, n=12, mats=[MAT.marigold, MAT.marigoldY], r=.018){
  for (let i=0;i<=n;i++){ const t = i/n, p = a.clone().lerp(b, t); p.y -= Math.sin(t*Math.PI)*sag;
    acc.add(new THREE.IcosahedronGeometry(r, 0), mats[i % mats.length], at(p.x, p.y, p.z)); }
}
/* toran: marigold beads + hanging mango leaves between two points */
function toran(acc, a, b, n=9){
  garland(acc, a, b, .015, n*2, [MAT.marigold, MAT.marigoldY], .016);
  for (let i=0;i<n;i++){ const t = (i + .5)/n, p = a.clone().lerp(b, t);
    const leaf = new THREE.ConeGeometry(.018, .07, 4).rotateX(Math.PI);
    acc.add(leaf, i % 2 ? MAT.leaf : MAT.leafL, at(p.x, p.y - .045, p.z, Math.atan2(b.x - a.x, b.z - a.z), 1, 1, .35)); }
}
/* clay pot (matka) */
function matka(acc, x, y, z, s=1, mat=MAT.clay){
  acc.add(new THREE.SphereGeometry(.08*s, 10, 7), mat, at(x, y + .07*s, z, 0, 1, .85, 1));
  acc.add(new THREE.CylinderGeometry(.04*s, .05*s, .04*s, 10), mat, at(x, y + .14*s, z));
  acc.add(new THREE.TorusGeometry(.042*s, .01*s, 5, 10).rotateX(Math.PI/2), MAT.clayD, at(x, y + .16*s, z));
}

/* ── houses: flat roof, parapet, painted walls, arched doors, a toran, a row of diyas on the roof ── */
function house(g, o){
  const a = new Acc(), W = o.w || .78, D = o.d || .74, H = o.h || .56, wall = MAT[o.wall], trim = MAT[o.trim], dr = MAT[o.door || 'door'];
  slab(a, MAT.plinth, W + .08, .05, D + .08);
  slab(a, wall, W, H, D, 0, .05);
  slab(a, MAT.lime, W + .004, .05, D + .004, 0, .05);                          // whitewashed dado
  slab(a, trim, W + .04, .04, D + .04, 0, .05 + H);                            // cornice
  const P = .1, yP = .09 + H;                                                  // parapet
  slab(a, wall, W, P, .04, 0, yP, D/2 - .02); slab(a, wall, W, P, .04, 0, yP, -D/2 + .02);
  slab(a, wall, .04, P, D, W/2 - .02, yP); slab(a, wall, .04, P, D, -W/2 + .02, yP);
  slab(a, trim, W + .02, .02, .06, 0, yP + P, D/2 - .02); slab(a, trim, .06, .02, D + .02, W/2 - .02, yP + P);
  slab(a, trim, W + .02, .02, .06, 0, yP + P, -D/2 + .02); slab(a, trim, .06, .02, D + .02, -W/2 + .02, yP + P);
  slab(a, MAT.stoneD, W - .08, .012, D - .08, 0, yP);                         // roof deck
  // front door (+z) and windows (+z beside the door, +x side)
  arch(a, 'z', D/2, o.doorU ?? -.1, .05, .2, .34, trim, dr);
  { const du = o.doorU ?? -.1; arch(a, 'z', D/2, du > 0 ? du - .27 : du + .27, .26, .12, .17, trim, MAT[o.shutter || 'indigo']); }
  arch(a, 'x', W/2, -.14, .24, .12, .18, trim, MAT[o.shutter || 'indigo']); arch(a, 'x', W/2, .16, .24, .12, .18, trim, MAT[o.shutter || 'indigo']);
  // painted dot band under the cornice (mandana-style, no script)
  for (let i=0;i<9;i++){ const u = -W/2 + .06 + i*(W - .12)/8; a.add(new THREE.SphereGeometry(.011, 5, 4), MAT.lime, at(u, .05 + H - .05, D/2 + .004)); }
  // toran over the door
  const du = o.doorU ?? -.1; toran(a, new THREE.Vector3(du - .15, .05 + .4, D/2 + .03), new THREE.Vector3(du + .15, .05 + .4, D/2 + .03), 5);
  // doorstep diyas + rooftop diya row on the two parapets the camera sees
  diya(a, du - .15, .05, D/2 + .09, 1.1, g, .22); diya(a, du + .15, .05, D/2 + .09, 1.1, g, .22);
  const yr = yP + P + .02, nF = 6;
  for (let i=0;i<nF;i++){ const u = -W/2 + .07 + i*(W - .14)/(nF-1); diya(a, u, yr, D/2 - .02, .8); }
  for (let i=1;i<nF-1;i++){ const u = -D/2 + .07 + i*(D - .14)/(nF-1); diya(a, W/2 - .02, yr, u, .8); }
  if (o.stair) { for (let i=0;i<4;i++) slab(a, MAT.stone, .1, .1 + i*.12, .12, -W/2 - .05, .0, -D/2 + .12 + i*.1); }
  if (o.pots) { matka(a, W/2 + .08, 0, D/2 - .05, .8); matka(a, W/2 + .06, 0, D/2 - .22, .65, MAT.clayD); }
  if (o.lantern) { seg(a, MAT.woodD, new THREE.Vector3(W/2 - .1, yr, -D/2 + .1), _up, .22, .01, .01, 5);
    a.add(new THREE.OctahedronGeometry(.07, 0), MAT.paper, at(W/2 - .1, yr + .18, -D/2 + .1, .4, 1, 1.3, 1)); }
  a.into(g);
}
function haveli(g){
  const a = new Acc(), W = 1.46, D = 1.3, H = .62;
  slab(a, MAT.plinth, W + .12, .07, D + .12); slab(a, MAT.stone, .5, .035, .12, .05, 0, D/2 + .1);
  slab(a, MAT.ochre, W, H, D, 0, .07); slab(a, MAT.lime, W + .004, .06, D + .004, 0, .07);
  slab(a, MAT.maroon, W + .05, .05, D + .05, 0, .07 + H); slab(a, MAT.stoneD, W - .08, .012, D - .08, 0, .12 + H);
  // big arched gate + windows on the front, jharokha balcony upstairs
  arch(a, 'z', D/2, .05, .07, .32, .46, MAT.maroon, MAT.door);
  arch(a, 'z', D/2, .05, .07, .22, .38, MAT.lime, MAT.doorGlow);                 // lit courtyard seen through the gate
  arch(a, 'z', D/2 + .002, .05, .07, .22, .38, MAT.maroon, MAT.door);              // (door leaves ajar are the frame below)
  for (const u of [-.46, .52]) arch(a, 'z', D/2, u, .3, .14, .22, MAT.maroon, MAT.turq);
  for (const u of [-.4, 0, .4]) arch(a, 'x', W/2, u, .3, .14, .22, MAT.maroon, MAT.turq);
  toran(a, new THREE.Vector3(-.16, .6, D/2 + .03), new THREE.Vector3(.26, .6, D/2 + .03), 7);
  // upper storey, set back
  const W2 = .9, D2 = .78, H2 = .42, y2 = .12 + H, x2 = -.18, z2 = -.2;
  slab(a, MAT.saffron, W2, H2, D2, x2, y2); slab(a, MAT.maroon, W2 + .05, .04, D2 + .05, x2, y2 + H2); slab(a, MAT.stoneD, W2 - .08, .012, D2 - .08, x2, y2 + H2 + .04);
  arch(a, 'z', D2/2 + z2, x2 - .2, y2 + .06, .13, .24, MAT.maroon, MAT.turq); arch(a, 'x', W2/2 + x2, -z2 - .0, y2 + .06, .13, .24, MAT.maroon, MAT.turq);
  // jharokha: a projecting window with a little dome
  const jx = x2 + .18, jz = z2 + D2/2 + .07;
  slab(a, MAT.white, .26, .05, .14, jx, y2 + .02, jz); slab(a, MAT.turq, .22, .18, .1, jx, y2 + .07, jz - .01);
  slab(a, MAT.white, .28, .03, .16, jx, y2 + .25, jz);
  a.add(new THREE.SphereGeometry(.1, 10, 5, 0, Math.PI*2, 0, Math.PI/2), MAT.white, at(jx, y2 + .28, jz, 0, 1.3, .9, .8));
  // parapets + diya rows on both roofs
  const yP = .12 + H, P = .09;
  const para = (w, d, x, z, y, mat) => { slab(a, mat, w, P, .04, x, y, z + d/2 - .02); slab(a, mat, .04, P, d, x + w/2 - .02, y, z);
    slab(a, mat, w, P, .04, x, y, z - d/2 + .02); slab(a, mat, .04, P, d, x - w/2 + .02, y, z); };
  para(W, D, 0, 0, yP, MAT.ochre); para(W2, D2, x2, z2, y2 + H2 + .04, MAT.saffron);
  for (let i=0;i<9;i++){ const u = -W/2 + .08 + i*(W - .16)/8; diya(a, u, yP + P, D/2 - .02, .85); }
  for (let i=1;i<8;i++){ const u = -D/2 + .08 + i*(D - .16)/8; diya(a, W/2 - .02, yP + P, u, .85); }
  for (let i=0;i<5;i++){ const u = x2 - W2/2 + .08 + i*(W2 - .16)/4; diya(a, u, y2 + H2 + .04 + P, z2 + D2/2 - .02, .8); }
  // rooftop chhatri
  const cx = x2 - .2, cz = z2 - .12, cy = y2 + H2 + .04;
  for (const [sx, sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) seg(a, MAT.white, new THREE.Vector3(cx + sx*.09, cy, cz + sz*.09), _up, .2, .014, .014, 5);
  slab(a, MAT.white, .26, .03, .26, cx, cy + .2); a.add(new THREE.SphereGeometry(.12, 10, 5, 0, Math.PI*2, 0, Math.PI/2), MAT.white, at(cx, cy + .23, cz, 0, 1, .9, 1));
  a.add(new THREE.ConeGeometry(.02, .08, 6), MAT.brass, at(cx, cy + .37, cz));
  // string of lights from the chhatri to the parapet corner
  const la = new THREE.Vector3(cx, cy + .22, cz), lb = new THREE.Vector3(W/2 - .03, yP + P + .02, D/2 - .03);
  for (let i=0;i<=10;i++){ const t = i/10, p = la.clone().lerp(lb, t); p.y -= Math.sin(t*Math.PI)*.08; a.add(new THREE.SphereGeometry(.014, 6, 4), [MAT.bulbA, MAT.bulbB, MAT.bulbC][i%3], at(p.x, p.y, p.z)); }
  // doorstep: rangoli dots + diyas + pots
  diya(a, -.16, .07, D/2 + .13, 1.2, g, .28); diya(a, .26, .07, D/2 + .13, 1.2, g, .28);
  matka(a, W/2 + .02, 0, D/2 + .02, .9); matka(a, W/2 - .14, 0, D/2 + .06, .7, MAT.brass);
  a.into(g);
}
function mithaiShop(g){
  const a = new Acc();
  slab(a, MAT.plinth, .84, .06, .76);
  slab(a, MAT.pink, .78, .56, .06, 0, .06, -.33); slab(a, MAT.pink, .06, .56, .66, -.36, .06, 0); slab(a, MAT.pink, .06, .56, .66, .36, .06, 0);
  slab(a, MAT.lime, .8, .05, .72, 0, .06, 0);
  slab(a, MAT.maroon, .86, .05, .76, 0, .62); slab(a, MAT.pinkD, .8, .07, .7, 0, .67);
  // striped awning, sloping to the front
  for (let i=0;i<8;i++){ const x = -.35 + i*.1; a.add(bx(.1, .018, .34), i%2 ? MAT.lime : MAT.saffron, at(x, .52, .5, 0, 1, 1, 1, .45)); }
  garland(a, new THREE.Vector3(-.4, .5, .66), new THREE.Vector3(.4, .5, .66), .05, 16);
  // counter with trays of sweets
  slab(a, MAT.wood, .66, .22, .24, 0, .06, .14); slab(a, MAT.woodD, .7, .025, .28, 0, .28, .14);
  const tray = (x, z) => a.add(new THREE.CylinderGeometry(.1, .09, .02, 14), MAT.brass, at(x, .305, z));
  tray(-.2, .14); tray(.02, .14); tray(.24, .14);
  for (let i=0;i<6;i++){ const [x, y, z] = [[-.24,0,.11],[-.17,0,.12],[-.2,0,.18],[-.23,.04,.14],[-.16,.0,.18],[-.2,.035,.13]][i]; a.add(new THREE.IcosahedronGeometry(.032, 1), MAT.sweetO, at(x, .345 + y, z)); }
  for (let i=0;i<6;i++){ a.add(bx(.05, .025, .05), i%2 ? MAT.sweetW : MAT.sweetG, at(-.03 + (i%3)*.055, .33, .1 + Math.floor(i/3)*.06, .3)); }
  for (let i=0;i<4;i++) a.add(new THREE.TorusGeometry(.03, .012, 5, 10).rotateX(Math.PI/2), MAT.sweetO, at(.2 + (i%2)*.06, .33 + (i>1?.02:0), .1 + Math.floor(i/2)*.07));
  // back shelf of tins + jars
  slab(a, MAT.woodD, .6, .02, .1, 0, .34, -.27);
  for (let i=0;i<5;i++){ cyl(a, [MAT.brass, MAT.sweetP, MAT.turq][i%3], .035, .035, .08, -.24 + i*.12, .36, -.27, 10); }
  diya(a, -.3, .06, .34, 1.1, g, .22); diya(a, .3, .06, .34, 1.1, g, .22);
  a.into(g);
}
function school(g){
  const a = new Acc(), W = .82, D = .56, H = .5;
  slab(a, MAT.plinth, W + .1, .06, D + .3, 0, 0, .08);
  slab(a, MAT.ochre, W, H, D, 0, .06, -.06); slab(a, MAT.green, W + .004, .16, D + .004, 0, .06, -.06);
  slab(a, MAT.greenD, W + .1, .04, D + .34, 0, .06 + H, .06);
  for (let i=0;i<4;i++) seg(a, MAT.lime, new THREE.Vector3(-W/2 + .06 + i*(W - .12)/3, .06, D/2 + .15), _up, H, .025, .025, 6);
  arch(a, 'z', D/2 - .06, -.2, .06, .16, .3, MAT.greenD, MAT.door); arch(a, 'z', D/2 - .06, .12, .2, .14, .18, MAT.greenD, MAT.turq);
  arch(a, 'x', W/2, -.1, .2, .12, .18, MAT.greenD, MAT.turq);
  // parapet + diya row
  const yP = .1 + H; slab(a, MAT.ochre, W + .1, .07, .04, 0, yP, D/2 + .21); slab(a, MAT.ochre, .04, .07, D + .34, W/2 + .03, yP, .06);
  for (let i=0;i<6;i++) diya(a, -W/2 + .02 + i*(W + .02)/5, yP + .07, D/2 + .21, .8);
  // bell on a frame + a blank slate on an easel
  const bxX = W/2 + .02, bzZ = D/2 + .32;
  seg(a, MAT.woodD, new THREE.Vector3(bxX - .1, 0, bzZ), _up, .36, .012, .012, 5); seg(a, MAT.woodD, new THREE.Vector3(bxX + .06, 0, bzZ), _up, .36, .012, .012, 5);
  slab(a, MAT.woodD, .2, .02, .03, bxX - .02, .36, bzZ);
  a.add(new THREE.CylinderGeometry(.025, .05, .07, 10, 1, true), MAT.brass, at(bxX - .02, .3, bzZ)); a.add(new THREE.SphereGeometry(.015, 6, 4), MAT.brass, at(bxX - .02, .27, bzZ));
  const sl = new THREE.Group(); const sa = new Acc(); slab(sa, MAT.wood, .24, .18, .02, 0, .12, 0); slab(sa, MAT.slate, .2, .14, .022, 0, .14, 0);
  seg(sa, MAT.woodD, new THREE.Vector3(-.09, 0, -.04), new THREE.Vector3(0, 1, .25), .32, .01, .01, 4); seg(sa, MAT.woodD, new THREE.Vector3(.09, 0, -.04), new THREE.Vector3(0, 1, .25), .32, .01, .01, 4);
  sa.into(sl); sl.position.set(-W/2 + .02, 0, D/2 + .34); sl.rotation.set(-.12, .5, 0); g.add(sl);
  toran(a, new THREE.Vector3(-.34, .5, D/2 + .21), new THREE.Vector3(.36, .5, D/2 + .21), 9);
  a.into(g);
}

/* ── water ── */
function well(g){
  const a = new Acc();
  a.add(new THREE.CylinderGeometry(.3, .32, .26, 16, 1, true), MAT.stone, at(0, .13, 0)); a.add(new THREE.CylinderGeometry(.22, .22, .26, 16, 1, true), MAT.stoneD, at(0, .13, 0));
  a.add(new THREE.RingGeometry(.22, .31, 16).rotateX(-Math.PI/2), MAT.plinth, at(0, .262, 0)); a.add(new THREE.CircleGeometry(.22, 16).rotateX(-Math.PI/2), MAT.water, at(0, .16, 0));
  a.add(new THREE.TorusGeometry(.3, .02, 5, 18).rotateX(Math.PI/2), MAT.saffron, at(0, .08, 0));
  for (const s of [-1, 1]) seg(a, MAT.woodD, new THREE.Vector3(s*.25, .26, 0), _up, .4, .022, .02, 6);
  seg(a, MAT.wood, new THREE.Vector3(-.28, .62, 0), new THREE.Vector3(1, 0, 0), .56, .016, .016, 6);
  a.add(new THREE.TorusGeometry(.05, .014, 5, 12), MAT.woodD, at(0, .62, 0)); seg(a, MAT.rope, new THREE.Vector3(0, .38, 0), _up, .24, .004, .004, 3);
  a.add(new THREE.CylinderGeometry(.045, .035, .07, 10), MAT.brass, at(0, .36, 0));
  garland(a, new THREE.Vector3(-.25, .6, .02), new THREE.Vector3(.25, .6, .02), .1, 12);
  matka(a, .3, 0, .3, 1); matka(a, .42, 0, .12, .8, MAT.brass); matka(a, -.32, 0, .32, .85, MAT.clayD);
  diya(a, .1, .262, .26, 1, g, .2); diya(a, -.2, .262, .18, 1, g, .2);
  a.into(g);
}
function stepwell(g){
  const a = new Acc(), T = .2;
  // outer rim, then square terraces stepping down into the water
  const ring = (s, y, h, mat, t=.07) => { slab(a, mat, s, h, t, 0, y, s/2 - t/2); slab(a, mat, s, h, t, 0, y, -s/2 + t/2); slab(a, mat, t, h, s - 2*t, s/2 - t/2, y); slab(a, mat, t, h, s - 2*t, -s/2 + t/2, y); };
  ring(.9, 0, T, MAT.stone, .1);
  ring(.92, T, .03, MAT.plinth, .12);
  const lv = [[.7, .15], [.56, .1], [.42, .05]]; lv.forEach(([s, y], i) => ring(s, 0, y, i % 2 ? MAT.stoneD : MAT.stone, .07));
  slab(a, MAT.water, .3, .03, .3, 0, 0);
  // little corner pavilions on the two back corners, diyas down the steps
  for (const [sx, sz] of [[-1, -1], [1, -1]]) { const cx = sx*.38, cz = sz*.38;
    for (const [px, pz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) seg(a, MAT.white, new THREE.Vector3(cx + px*.05, T + .03, cz + pz*.05), _up, .16, .01, .01, 5);
    slab(a, MAT.white, .15, .02, .15, cx, T + .19, cz); a.add(new THREE.SphereGeometry(.07, 8, 4, 0, Math.PI*2, 0, Math.PI/2), MAT.white, at(cx, T + .21, cz)); }
  for (const [x, z, y] of [[.28, .28, .15], [-.28, .28, .15], [.21, .0, .1], [0, .21, .1], [.3, .3, T + .03], [-.3, .38, T + .03], [.38, -.05, T + .03]]) diya(a, x, y, z, .9, g, .16);
  // lotus pads on the water
  a.add(new THREE.CylinderGeometry(.05, .05, .01, 10), MAT.pad, at(.05, .035, -.04)); lotus(a, -.06, .035, .06, .6);
  a.into(g);
}
function lotus(acc, x, y, z, s=1){
  acc.add(new THREE.CylinderGeometry(.07*s, .07*s, .008, 12), MAT.pad, at(x, y, z));
  for (let i=0;i<8;i++){ const ang = i/8*Math.PI*2; acc.add(new THREE.SphereGeometry(.028*s, 6, 4), i%2 ? MAT.lotus : MAT.lotusD,
    at(x + Math.cos(ang)*.026*s, y + .03*s, z + Math.sin(ang)*.026*s, -ang, .6, 1.6, .8, 0, .5)); }
  acc.add(new THREE.SphereGeometry(.016*s, 6, 4), MAT.marigoldY, at(x, y + .035*s, z));
}
function lotusPond(g){
  const a = new Acc();
  a.add(new THREE.CylinderGeometry(.44, .46, .09, 8), MAT.stone, at(0, .045, 0)); a.add(new THREE.CylinderGeometry(.36, .36, .092, 8), MAT.stoneD, at(0, .046, 0));
  a.add(new THREE.CylinderGeometry(.36, .36, .01, 8), MAT.water, at(0, .085, 0));
  a.add(new THREE.RingGeometry(.36, .45, 8).rotateX(-Math.PI/2), MAT.plinth, at(0, .092, 0));
  lotus(a, -.12, .09, .06, 1.1); lotus(a, .14, .09, -.1, 1); lotus(a, .05, .09, .18, .8);
  a.add(new THREE.CylinderGeometry(.06, .06, .008, 10), MAT.pad, at(-.16, .09, -.14)); a.add(new THREE.CylinderGeometry(.05, .05, .008, 10), MAT.pad, at(.2, .09, .12));
  // floating diyas on the water + diyas on the rim
  for (const [x, z] of [[.02, -.02], [-.05, -.18], [.2, .06]]) diya(a, x, .09, z, .9, g, .16);
  for (let i=0;i<8;i++){ const ang = i/8*Math.PI*2 + Math.PI/8; if (i === 5 || i === 6) continue; diya(a, Math.cos(ang)*.405, .092, Math.sin(ang)*.405, .8); }
  a.into(g);
}
function waterStand(g){          // pyau: a shaded stand of water pots for passers-by
  const a = new Acc();
  slab(a, MAT.plinth, .7, .05, .5);
  for (const [x, z] of [[-.3,-.24],[.3,-.24]]) seg(a, MAT.woodD, new THREE.Vector3(x, .05, z), _up, .62, .018, .018, 6);
  for (const [x, z] of [[-.3,.05],[.3,.05]]) seg(a, MAT.woodD, new THREE.Vector3(x, .05, z), _up, .5, .018, .018, 6);
  for (let i=0;i<7;i++) a.add(bx(.12, .02, .34), i%2 ? MAT.saffron : MAT.rope, at(-.33 + i*.11, .6, -.1, 0, 1, 1, 1, -.35, 0));
  slab(a, MAT.wood, .6, .04, .36, 0, .2); for (const [x, z] of [[-.25,-.14],[.25,-.14],[-.25,.14],[.25,.14]]) seg(a, MAT.woodD, new THREE.Vector3(x, .05, z), _up, .15, .014, .014, 5);
  for (const x of [-.18, 0, .18]) { matka(a, x, .24, -.02, 1.05); a.add(new THREE.CylinderGeometry(.045, .045, .012, 10), MAT.cloth, at(x, .41, -.02)); }
  a.add(new THREE.CylinderGeometry(.03, .025, .07, 10), MAT.brass, at(.24, .05, .22)); a.add(new THREE.CylinderGeometry(.03, .025, .07, 10), MAT.brass, at(.3, .05, .16));
  garland(a, new THREE.Vector3(-.33, .53, .06), new THREE.Vector3(.33, .53, .06), .06, 14);
  diya(a, -.24, .05, .2, 1, g, .2);
  a.into(g);
}

/* ── trees ── */
function kitTree(g, name, h, w, rot, kit='a'){ const t = KITCACHE[kit] && KITCACHE[kit][name]; if (!t) return null;
  return addModel(g, name, fitScale(t, h, w), 0, .04, 0, rot, kit); }
function treeRing(a, r=.2, mat=MAT.plinth){ a.add(new THREE.CylinderGeometry(r, r + .02, .05, 12), mat, at(0, .025, 0)); a.add(new THREE.TorusGeometry(r, .012, 4, 16).rotateX(Math.PI/2), MAT.saffron, at(0, .05, 0)); }
function neem(g, s){ const a = new Acc(); treeRing(a, .22); diya(a, .2, .05, .12, 1, g, .18); diya(a, .12, .05, .2, 1); a.into(g);
  kitTree(g, s.model || 'CommonTree_1', s.h || 1.3, 1.02, (s.rot||0)*Math.PI/180); }
function palm(g, s){ const a = new Acc(); treeRing(a, .16, MAT.stoneD); a.into(g); kitTree(g, s.model || 'palm-detailed-bend', 1.55, .95, (s.rot||0)*Math.PI/180, 'pirate'); }
function banana(g, s){
  const a = new Acc(), r = rngFrom(s.x*7 + s.z*3), lf = new Acc();
  treeRing(a, .2, MAT.soil);
  const stems = s.v ? [[0, 0, .95], [.18, .1, .6]] : [[0, 0, 1], [-.17, .12, .65], [.15, -.12, .5]];
  stems.forEach(([x, z, k]) => {
    const H = .62*k; seg(a, MAT.leafD, new THREE.Vector3(x, .04, z), _up, H, .05*k, .035*k, 7);
    for (let i=0;i<7;i++){ const ang = i/7*Math.PI*2 + r()*.5, L = (.42 + r()*.12)*k, pg = new THREE.PlaneGeometry(.16*k, L, 1, 5).translate(0, L/2, 0), p = pg.attributes.position;
      for (let j=0;j<p.count;j++){ const y = p.getY(j), t = y/L; p.setXYZ(j, p.getX(j)*(1 - .6*t*t) , y, -t*t*L*.55 + Math.abs(p.getX(j))*.3); }
      lf.add(pg, swayMat(i%2 ? 0x5DAA3C : 0x74BD48, 1, .05), at(x, .04 + H - .02, z, ang, 1, 1, 1, .5)); }
    if (k === 1) { for (let i=0;i<8;i++){ const yy = .04 + H - .12 - Math.floor(i/4)*.05, ang = (i%4)/4*Math.PI*2; a.add(new THREE.CylinderGeometry(.012, .01, .07, 5), i<4 ? MAT.sweetG : MAT.marigoldY, at(x + .05 + Math.cos(ang)*.025, yy, z + .03 + Math.sin(ang)*.025, 0, 1, 1, 1, .3)); }
      a.add(new THREE.ConeGeometry(.03, .08, 6).rotateX(Math.PI), MAT.maroon, at(x + .05, .04 + H - .24, z + .03)); }
  });
  a.into(g); lf.into(g);
}
function tulsi(g){
  const a = new Acc();
  slab(a, MAT.plinth, .42, .05, .42);
  slab(a, MAT.white, .32, .3, .32, 0, .05); slab(a, MAT.saffron, .36, .04, .36, 0, .35); slab(a, MAT.saffron, .34, .03, .34, 0, .05);
  slab(a, MAT.white, .28, .06, .28, 0, .39); for (const [x, z] of [[-1,-1],[1,-1],[1,1],[-1,1]]) a.add(new THREE.ConeGeometry(.03, .08, 4), MAT.saffron, at(x*.13, .49, z*.13, Math.PI/4));
  arch(a, 'z', .16, 0, .1, .1, .14, MAT.saffron, MAT.black); arch(a, 'x', .16, 0, .1, .1, .14, MAT.saffron, MAT.black);
  diya(a, 0, .1, .15, .9, g, .2); diya(a, .15, .1, 0, .9);
  slab(a, MAT.soil, .24, .02, .24, 0, .44);
  const r = rngFrom(9); for (let i=0;i<22;i++){ const ang = r()*6.28, d = r()*.08, y = .47 + r()*.24;
    blob(a, i%3 ? MAT.leafD : MAT.leaf, new THREE.Vector3(Math.cos(ang)*d*(1.2 - (y-.47)), y, Math.sin(ang)*d*(1.2 - (y-.47))), .04 - (y - .47)*.06, 1, 0, r); }
  for (let i=0;i<7;i++){ const ang = i*.9, y = .62 + (i%3)*.05; a.add(new THREE.ConeGeometry(.012, .06, 5), MAT.maroon, at(Math.cos(ang)*.06, y, Math.sin(ang)*.06)); }
  for (let i=0;i<5;i++) seg(a, MAT.woodD, new THREE.Vector3((r()-.5)*.06, .45, (r()-.5)*.06), new THREE.Vector3((r()-.5)*.6, 1, (r()-.5)*.6), .18, .008, .005, 4);
  a.into(g);
}

/* ── Sudoku/Math: rangoli drawn in 5 stages, and marigold beds that bloom ── */
const RANGOLI = [
  { petals:8,  pal:['#E8364F', '#F7B32B', '#2E86DE', '#1FAF8B', '#F279A6'] },
  { petals:12, pal:['#7B3FC4', '#F28C28', '#F6D04D', '#E8364F', '#22A6B3'] },
  { petals:10, pal:['#1FAF8B', '#F279A6', '#F7B32B', '#2E5FC4', '#F28C28'] }
];
const RTEX = new Map();
function rangoliTex(di, stage){
  const key = di + ':' + stage; if (RTEX.has(key)) return RTEX.get(key);
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), C = N/2, D = RANGOLI[di], P = D.pal, n = D.petals;
  g.fillStyle = '#A8653F'; g.fillRect(0, 0, N, N);
  const pol = (r, a) => [C + Math.cos(a)*r, C + Math.sin(a)*r];
  const petal = (a, r0, r1, wid) => { const [x0, y0] = pol(r0, a), [x1, y1] = pol(r1, a), [c1x, c1y] = pol((r0 + r1)/2*1.05, a - wid), [c2x, c2y] = pol((r0 + r1)/2*1.05, a + wid);
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(c1x, c1y, x1, y1); g.quadraticCurveTo(c2x, c2y, x0, y0); g.closePath(); };
  const circ = (r) => { g.beginPath(); g.arc(C, C, r, 0, Math.PI*2); };
  const s = stage;
  if (s >= 3) {                                           // colour goes in from the centre out
    circ(236); g.fillStyle = s >= 4 ? P[3] : '#A8653F'; g.fill();
    if (s >= 4) { circ(200); g.fillStyle = P[4]; g.fill(); for (let k=0;k<n*2;k++){ petal(k/(n*2)*Math.PI*2, 196, 236, .07); g.fillStyle = P[1]; g.fill(); } }
    circ(150); g.fillStyle = s >= 4 ? '#A8653F' : '#A8653F'; g.fill();
    for (let k=0;k<n;k++){ petal(k/n*Math.PI*2, 58, 190, .28); g.fillStyle = s >= 4 ? P[0] : P[0]; g.fill(); petal(k/n*Math.PI*2, 70, 150, .16); g.fillStyle = P[1]; g.fill(); }
    if (s >= 4) for (let k=0;k<n;k++){ petal((k + .5)/n*Math.PI*2, 60, 130, .2); g.fillStyle = P[2]; g.fill(); }
    circ(62); g.fillStyle = P[2]; g.fill(); circ(38); g.fillStyle = P[1]; g.fill(); circ(16); g.fillStyle = P[0]; g.fill();
  }
  if (s >= 2) {                                           // white outline (chalk / rice flour)
    g.strokeStyle = '#FFF8EC'; g.lineWidth = s >= 3 ? 5 : 6; g.lineJoin = 'round';
    for (let k=0;k<n;k++){ petal(k/n*Math.PI*2, 58, 190, .28); g.stroke(); if (s >= 4) { petal((k + .5)/n*Math.PI*2, 60, 130, .2); g.stroke(); } }
    circ(62); g.stroke(); if (s >= 3) { circ(38); g.stroke(); }
    if (s >= 4) { circ(200); g.stroke(); circ(236); g.stroke(); }
    else { g.setLineDash([10, 12]); circ(214); g.stroke(); g.setLineDash([]); }
  }
  if (s <= 2) {                                           // the dot grid everything starts from
    g.fillStyle = '#FFF8EC'; const sp = 36;
    for (let i=-7;i<=7;i++) for (let j=-7;j<=7;j++){ const x = C + i*sp, y = C + j*sp; if (Math.hypot(x - C, y - C) > 232) continue; g.beginPath(); g.arc(x, y, s === 1 ? 6 : 4.5, 0, 6.3); g.fill(); }
  } else {                                                // finishing dots
    g.fillStyle = '#FFF8EC'; for (let k=0;k<n*2;k++){ const [x, y] = pol(s >= 4 ? 218 : 175, k/(n*2)*Math.PI*2 + (s >= 4 ? Math.PI/(n*2) : 0)); g.beginPath(); g.arc(x, y, 6, 0, 6.3); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; RTEX.set(key, t); return t;
}
const RMATS = new Map();
function rangoliMat(di, st){ const k = di + ':' + st; if (!RMATS.has(k)) RMATS.set(k, new THREE.MeshStandardMaterial({ map:rangoliTex(di, st), roughness:1, metalness:0 })); return RMATS.get(k); }
const DISC = new THREE.CylinderGeometry(.43, .43, .012, 48);
function fillRangoli(host, s, stage){
  host.clear();
  const disc = new THREE.Mesh(DISC, rangoliMat(s.design, Math.min(5, stage))); disc.position.y = .062; disc.receiveShadow = true; host.add(disc);
  const a = new Acc();
  if (stage >= 5) for (let i=0;i<10;i++){ const ang = i/10*Math.PI*2; diya(a, Math.cos(ang)*.4, .068, Math.sin(ang)*.4, 1, host, i%2 ? .18 : 0); }
  if (stage >= 4) { const r = rngFrom(s.x*3 + s.z); for (let i=0;i<5;i++){ const ang = r()*6.28; a.add(new THREE.CylinderGeometry(.018, .018, .006, 6), i%2 ? MAT.marigold : MAT.marigoldY, at(Math.cos(ang)*.46, .062, Math.sin(ang)*.46)); } }
  if (stage >= 3) diya(a, 0, .068, 0, 1.2, host, .24);
  if (a.m.size) a.into(host);
  host.userData.stage = stage;
}
function fillMarigold(host, s, stage){
  host.clear();
  const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 5), st = Math.min(stage, 5);
  for (let i=0;i<3;i++) for (let j=0;j<3;j++){
    const x = (i-1)*.27 + (r()-.5)*.04, z = (j-1)*.27 + (r()-.5)*.04, y = .07;
    if (st === 1) { for (let k=0;k<2;k++) a.add(new THREE.ConeGeometry(.02, .06, 4), MAT.leafL, at(x + (k ? .015 : -.015), y + .03, z, 0, 1, 1, .4, 0, k ? -.4 : .4)); continue; }
    const R = [0, 0, .06, .085, .1, .11][st];
    blob(a, MAT.leafD, new THREE.Vector3(x, y + R*.7, z), R, .8, 0, r); blob(a, MAT.leaf, new THREE.Vector3(x + .02, y + R*1.05, z - .01), R*.7, .8, 0, r);
    const nF = [0, 0, 0, 3, 5, 7][st];
    for (let k=0;k<nF;k++){ const ang = k/nF*Math.PI*2 + r(), d = R*(k === nF - 1 && st === 5 ? 0 : .7), fy = y + R*1.35 + (k === nF - 1 && st === 5 ? .03 : 0);
      if (st === 3 && k > 0) a.add(new THREE.SphereGeometry(.018, 6, 4), MAT.leafL, at(x + Math.cos(ang)*d, fy, z + Math.sin(ang)*d));
      else a.add(new THREE.IcosahedronGeometry(st === 5 ? .036 : .03, 1), k % 3 === 1 ? MAT.marigoldY : MAT.marigold, at(x + Math.cos(ang)*d, fy, z + Math.sin(ang)*d, 0, 1, .75, 1)); }
  }
  if (st >= 5) { const bk = new THREE.Group(); const ba = new Acc(); ba.add(new THREE.CylinderGeometry(.08, .06, .06, 10, 1, true), MAT.rope, at(0, .03, 0));
    for (let k=0;k<6;k++) ba.add(new THREE.IcosahedronGeometry(.03, 1), k%2 ? MAT.marigold : MAT.marigoldY, at(Math.cos(k)*.04, .065, Math.sin(k)*.04)); ba.into(bk);
    bk.position.set(.42, .07, .42); host.add(bk); }
  a.into(host); host.userData.stage = stage;
}

/* ── To-dos: lanes (brick pavers + a prop) and toran garlands on the edges ── */
const laneTex = (() => { const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(12);
  g.fillStyle = '#F2E2CC'; g.fillRect(0, 0, N, N); const B = 32;
  for (let by=0; by<N/B; by++) for (let bx2=0; bx2<N/B; bx2++){ const hor = (bx2 + by) % 2 === 0;
    for (let k=0;k<2;k++){ const x = bx2*B + (hor ? 0 : k*B/2), y = by*B + (hor ? k*B/2 : 0), w = hor ? B : B/2, h = hor ? B/2 : B;
      g.fillStyle = `rgba(${150 + r()*40|0},${70 + r()*30|0},${40 + r()*20|0},.28)`; g.fillRect(x + 1.5, y + 1.5, w - 3, h - 3); } }
  g.strokeStyle = 'rgba(120,70,40,.25)'; g.lineWidth = 2; g.strokeRect(2, 2, N - 4, N - 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
const LANE = new THREE.MeshStandardMaterial({ color:0xE8B08A, roughness:1, map:laneTex });
function lampPost(a, g, x, z, h=.62){
  seg(a, MAT.woodD, new THREE.Vector3(x, .035, z), _up, h, .016, .014, 6); seg(a, MAT.woodD, new THREE.Vector3(x, .035 + h - .02, z), new THREE.Vector3(1, 0, 1), .12, .008, .008, 4);
  const lx = x + .085, lz = z + .085, ly = .035 + h - .12;
  a.add(new THREE.OctahedronGeometry(.07, 0), MAT.paper, at(lx, ly, lz, .4, 1, 1.25, 1));
  for (let i=0;i<3;i++) a.add(new THREE.PlaneGeometry(.012, .08), MAT.paperR, at(lx + (i-1)*.02, ly - .12, lz));
  const sp = new THREE.Sprite(GLOW[0]); sp.position.set(lx, ly, lz); sp.scale.setScalar(.36); sp.renderOrder = 9; g.add(sp);
}
function charpai(a, x, z, ry){
  const o = new THREE.Group(); const c = new Acc();
  for (const [px, pz] of [[-.2,-.11],[.2,-.11],[-.2,.11],[.2,.11]]) seg(c, MAT.woodD, new THREE.Vector3(px, 0, pz), _up, .12, .018, .014, 5);
  slab(c, MAT.wood, .46, .025, .03, 0, .11, -.12); slab(c, MAT.wood, .46, .025, .03, 0, .11, .12); slab(c, MAT.wood, .03, .025, .27, -.22, .11); slab(c, MAT.wood, .03, .025, .27, .22, .11);
  for (let i=0;i<8;i++) slab(c, MAT.rope, .41, .008, .012, 0, .118, -.1 + i*.029);
  for (let i=0;i<7;i++) slab(c, MAT.cloth, .012, .009, .22, -.18 + i*.06, .12, 0);
  c.add(new THREE.CylinderGeometry(.025, .02, .05, 8), MAT.brass, at(.13, .135, .04));
  c.into(o); o.position.set(x, .035, z); o.rotation.y = ry; a.__g.add(o);
}
function lane(g, s){
  const slabM = new THREE.Mesh(G.path, LANE); slabM.position.y = .0175; slabM.receiveShadow = true; g.add(slabM);
  const a = new Acc(); a.__g = g; const v = s.v || 0, r = rngFrom(s.x*13 + s.z*29);
  if (v === 0) { lampPost(a, g, -.34, -.3); matka(a, -.25, .035, -.36, .6); diya(a, .3, .035, .32, 1, g, .2); diya(a, .36, .035, .22, 1); }
  else if (v === 1) { charpai(a, .02, -.08, .5); matka(a, .32, .035, .3, .7); diya(a, -.3, .035, .34, 1, g, .2); }
  else if (v === 2) { matka(a, -.12, .035, -.1, 1.1); matka(a, .1, .035, -.14, .95, MAT.clayD); matka(a, -.02, .035, .08, .9); matka(a, -.02, .2, -.06, .7, MAT.clayD);
    diya(a, .28, .035, .28, 1, g, .2); diya(a, .18, .035, .34, 1); for (let i=0;i<4;i++) a.add(new THREE.CylinderGeometry(.034, .022, .02, 8), MAT.clay, at(.3 + (i%2)*.02, .045 + i*.02, -.3)); }
  else if (v === 3) {           // string lights between two poles
    for (const [x, z] of [[-.38, -.34], [.34, .36]]) seg(a, MAT.woodD, new THREE.Vector3(x, .035, z), _up, .56, .014, .012, 5);
    for (let i=0;i<=12;i++){ const t = i/12, x = -.38 + .72*t, z = -.34 + .7*t, y = .58 - Math.sin(t*Math.PI)*.14; a.add(new THREE.SphereGeometry(.018, 6, 4), [MAT.bulbA, MAT.bulbB, MAT.bulbC][i%3], at(x, y, z)); }
    diya(a, .3, .035, -.3, 1, g, .2); diya(a, -.3, .035, .3, 1, g, .2); }
  else if (v === 4) {           // toran arch over the lane
    for (const x of [-.4, .4]) { seg(a, MAT.woodD, new THREE.Vector3(x, .035, 0), _up, .58, .02, .018, 6); a.add(new THREE.SphereGeometry(.03, 8, 6), MAT.brass, at(x, .63, 0)); }
    slab(a, MAT.wood, .86, .03, .04, 0, .56, 0); toran(a, new THREE.Vector3(-.4, .55, .03), new THREE.Vector3(.4, .55, .03), 10);
    for (const x of [-.4, .4]) { garland(a, new THREE.Vector3(x, .55, .025), new THREE.Vector3(x, .1, .025), .0, 9); diya(a, x + (x < 0 ? .06 : -.06), .035, .12, 1, g, .2); } }
  else {                        // stone bench under a lantern
    slab(a, MAT.stone, .4, .03, .14, .02, .12, -.2); slab(a, MAT.stoneD, .05, .12, .12, -.14, .0, -.2); slab(a, MAT.stoneD, .05, .12, .12, .18, 0, -.2);
    lampPost(a, g, .34, -.34, .5); diya(a, -.28, .035, .28, 1, g, .2); matka(a, -.3, .035, -.28, .6); }
  for (let i=0;i<4;i++) a.add(new THREE.CylinderGeometry(.016, .016, .005, 6), i%2 ? MAT.marigold : MAT.marigoldY, at((r()-.5)*.7, .037, (r()-.5)*.7));
  a.into(g); g.userData.ghostMode = 'marker';
}
function toranEdge(g, s){
  const a = new Acc();
  for (let i=0;i<=s.len;i++){ const u = i - s.len/2; const p = s.edge === 'w' ? new THREE.Vector3(-.45, 0, u) : new THREE.Vector3(u, 0, .45);
    seg(a, MAT.woodD, p, _up, .46, .02, .018, 6); a.add(new THREE.SphereGeometry(.028, 8, 6), MAT.brass, at(p.x, .48, p.z)); diya(a, p.x + (s.edge === 'w' ? .06 : 0), 0, p.z + (s.edge === 'w' ? 0 : -.06), .9); }
  for (let i=0;i<s.len;i++){ const u0 = i - s.len/2, u1 = u0 + 1;
    const A = s.edge === 'w' ? new THREE.Vector3(-.45, .44, u0) : new THREE.Vector3(u0, .44, .45), B2 = s.edge === 'w' ? new THREE.Vector3(-.45, .44, u1) : new THREE.Vector3(u1, .44, .45);
    toran(a, A, B2, 9); garland(a, A.clone().setY(.4), B2.clone().setY(.4), .12, 16); }
  a.into(g);
  const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}

/* ── Gita: a small white shikhara temple, saffron flag, a ring of diyas. No idol, no script. ── */
function temple(g){
  const a = new Acc(), glowHost = g;
  // stepped plinth
  slab(a, MAT.stone, 1.84, .08, 1.84); slab(a, MAT.plinth, 1.62, .08, 1.62, 0, .08); slab(a, MAT.white, 1.4, .06, 1.4, 0, .16);
  const Y = .22, sx = -.2;                                  // sanctum centre x
  // garbhagriha
  slab(a, MAT.white, .84, .6, .84, sx, Y); slab(a, MAT.whiteD, .9, .05, .9, sx, Y); slab(a, MAT.saffron, .9, .045, .9, sx, Y + .54);
  for (const [px, pz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) slab(a, MAT.whiteD, .1, .6, .1, sx + px*.4, Y, pz*.4);
  arch(a, 'x', sx + .42, 0, Y + .04, .22, .4, MAT.saffron, MAT.doorGlow);   // the doorway glows warm; nothing inside is shown
  arch(a, 'z', .42, sx, Y + .14, .15, .24, MAT.saffron, MAT.whiteD);
  // shikhara: 8 courses on a curved profile, with a projecting central rib on each face, amalaka + kalash on top
  const base = .82, tiers = 9, th = .135, y0 = Y + .6;
  for (let i=0;i<tiers;i++){ const t = i/tiers, w = base*(1 - Math.pow(t, 1.5)*.62), y = y0 + i*th;
    a.add(new THREE.BoxGeometry(w, th*.84, w), MAT.white, at(sx, y + th*.42, 0));
    a.add(new THREE.BoxGeometry(w*1.04, th*.16, w*1.04), MAT.whiteD, at(sx, y + th*.92, 0));
    const rw = w*.36;                                       // central rib, slightly proud on all four faces
    a.add(new THREE.BoxGeometry(rw, th*.84, w + .07), MAT.white, at(sx, y + th*.42, 0)); a.add(new THREE.BoxGeometry(w + .07, th*.84, rw), MAT.white, at(sx, y + th*.42, 0));
    if (i % 2 === 0 && i < 6) { const cw = w*.5 + .04, h2 = .05;            // little miniature-spire accents (urushringa) on the corners
      for (const [px, pz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) a.add(new THREE.ConeGeometry(.045*(1 - t*.6), .1, 4), MAT.whiteD, at(sx + px*cw*.8, y + th + h2 - .02, pz*cw*.8, Math.PI/4)); }
  }
  const yTop = y0 + tiers*th;
  a.add(new THREE.CylinderGeometry(.13, .13, .04, 8), MAT.whiteD, at(sx, yTop + .02, 0));
  a.add(new THREE.CylinderGeometry(.19, .19, .07, 18), MAT.stone, at(sx, yTop + .075, 0));      // amalaka
  a.add(new THREE.TorusGeometry(.19, .035, 6, 18).rotateX(Math.PI/2), MAT.plinth, at(sx, yTop + .075, 0));
  a.add(new THREE.CylinderGeometry(.08, .1, .04, 10), MAT.whiteD, at(sx, yTop + .13, 0));
  a.add(new THREE.SphereGeometry(.06, 10, 8), MAT.brass, at(sx, yTop + .19, 0, 0, 1, .9, 1));    // kalash
  a.add(new THREE.ConeGeometry(.025, .1, 8), MAT.brass, at(sx, yTop + .28, 0));
  // saffron dhwaja: pole from the kalash, flag streaming toward the camera side
  const py = yTop + .2; seg(a, MAT.woodD, new THREE.Vector3(sx - .02, py, -.02), _up, .52, .01, .008, 5);
  const fl = new THREE.Shape(); fl.moveTo(0, 0); fl.lineTo(.62, -.12); fl.lineTo(0, -.3); fl.lineTo(0, 0);
  const fg = new THREE.ShapeGeometry(fl), fp = fg.attributes.position; for (let i=0;i<fp.count;i++){ const x = fp.getX(i); fp.setZ(i, Math.sin(x*9)*.03); }
  a.add(fg, MAT.flag, at(sx - .02, py + .52, -.02, -Math.PI/4 - .3));
  // mandapa: four pillars, a flat roof and a small stepped pyramidal roof, a bell
  const mx = .38, my = Y;
  for (const [px, pz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) { const p = new THREE.Vector3(mx + px*.18, my, pz*.22);
    slab(a, MAT.whiteD, .07, .04, .07, p.x, my, p.z); seg(a, MAT.white, p.clone().setY(my + .04), _up, .38, .025, .025, 8); slab(a, MAT.whiteD, .08, .04, .08, p.x, my + .42, p.z); }
  slab(a, MAT.white, .5, .05, .6, mx, my + .46); slab(a, MAT.saffron, .52, .02, .62, mx, my + .5);
  for (let i=0;i<4;i++) slab(a, i%2 ? MAT.whiteD : MAT.white, .42 - i*.1, .05, .5 - i*.12, mx, my + .52 + i*.05);
  a.add(new THREE.SphereGeometry(.035, 8, 6), MAT.brass, at(mx, my + .76, 0));
  seg(a, MAT.rope, new THREE.Vector3(mx + .05, my + .3, 0), _up, .16, .004, .004, 3); a.add(new THREE.CylinderGeometry(.02, .04, .06, 10, 1, true), MAT.brass, at(mx + .05, my + .27, 0));
  garland(a, new THREE.Vector3(mx + .18, my + .43, -.22), new THREE.Vector3(mx + .18, my + .43, .22), .08, 14);
  toran(a, new THREE.Vector3(sx + .45, Y + .47, -.15), new THREE.Vector3(sx + .45, Y + .47, .15), 6);
  // ring of diyas on the plinth edge, glowing
  const nD = 22; for (let i=0;i<nD;i++){ const t = i/nD, per = t*4, side = Math.floor(per), u = (per - side)*1.5 - .75;
    const [x, z] = [[u, .75], [.75, -u], [-u, -.75], [-.75, u]][side]; if (x > .7 && Math.abs(z) < .26) continue;
    diya(a, x, .16 + .06, z, 1.1, glowHost, i % 2 ? .24 : .18); }
  for (const z of [-.3, -.15, .15, .3]) { diya(a, .87, .0, z, 1, glowHost, .16); diya(a, .76, .08, z, 1); }
  // marigold heaps + a tulsi-coloured flower bed at the corners of the lower plinth
  for (const [x, z] of [[-.82, .82], [.82, .82], [-.82, -.82]]) for (let k=0;k<5;k++) a.add(new THREE.IcosahedronGeometry(.035, 1), k%2 ? MAT.marigold : MAT.marigoldY, at(x + Math.cos(k*1.3)*.04, .1 + (k===4 ? .04 : 0), z + Math.sin(k*1.3)*.04));
  // a warm glow inside the doorway
  const dg = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFB050, transparent:true, opacity:.8, blending:THREE.AdditiveBlending, depthWrite:false }));
  dg.position.set(sx + .42, Y + .2, 0); dg.scale.setScalar(.6); dg.renderOrder = 9; g.add(dg);
  a.into(g);
}

/* ── blueprint: the farm's cells with Diwali pieces; the Gita temple takes the left corner ── */
const MAP = {
  bigbarn:{ name:'Haveli', b:'haveli' }, well:{ name:'Village well', b:'well' }, apple1:{ name:'Neem tree', b:'neem', model:'CommonTree_1', rot:20 },
  silo:{ name:'Pink house', b:'house', o:{ wall:'pink', trim:'maroon', shutter:'turq', pots:true } },
  silohouse:{ name:'Mithai shop', b:'mithai' },
  coop:{ name:'Turquoise house', b:'house', o:{ wall:'turq', trim:'saffron', shutter:'maroon', lantern:true, doorU:.08 } },
  watertower:{ name:'Stepwell', b:'stepwell' }, pump:{ name:'Water stand', b:'waterstand' }, apple2:{ name:'Banana plants', b:'banana' },
  berry1:{ name:'Tulsi planter', b:'tulsi' }, peepal:{ name:'Temple', b:'temple' },
  smallbarn:{ name:'Village school', b:'school' }, openbarn:{ name:'Saffron house', b:'house', o:{ wall:'saffron', trim:'lime', shutter:'blue', stair:true } },
  pond:{ name:'Lotus pond', b:'lotuspond' }, orange1:{ name:'Coconut palm', b:'palm', model:'palm-detailed-bend', rot:200 },
  apple3:{ name:'Neem tree', b:'neem', model:'CommonTree_2', rot:260 }, berry2:{ name:'Banana plants', b:'banana', v:1 },
  orange2:{ name:'Coconut palm', b:'palm', model:'palm-detailed-straight', rot:40 }, apple4:{ name:'Mango tree', b:'neem', model:'CommonTree_3', rot:60, h:1.2 }
};
const MOVE = { peepal:{ x:0, z:5 }, field1_5:{ x:1, z:1 }, fence3:{ x:0, z:0, edge:'w' } };   // hero to the left corner
const LANE_V = { path3_4:0, path3_5:4, path1_2:1, path5_2:2, path3_0:3, path2_6:5, path3_6:3 };
const LANE_NAME = ['Lantern lane', 'Charpai corner', 'Clay pot stack', 'String-light lane', 'Toran arch', 'Lane bench'];
let _rd = 0;
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d, ...(MOVE[f.id] || {}) };
  if (f.kind === 'field') { const rg = f.crop === 'Corn' || f.crop === 'Lettuce';
    return rg ? { ...s, kind:'rangoli', design:(_rd++) % RANGOLI.length, name:'Rangoli', stages:5 } : { ...s, kind:'marigold', name:'Marigold bed', stages:5 }; }
  if (f.kind === 'path') { const v = LANE_V[f.id] ?? 0; return { ...s, kind:'diwali', b:'lane', v, name:LANE_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'diwali', b:'torans', edge:s.edge || f.edge, len:f.len, name:'Toran garland' };
  return { ...s, kind:'diwali', ...MAP[f.id] };
});
const BUILD = { haveli, well, stepwell, lotuspond:lotusPond, waterstand:waterStand, mithai:mithaiShop, school, temple, tulsi, banana,
  house:(g, s) => house(g, s.o), neem, palm, lane, torans:toranEdge };

/* ── the ground: terracotta and ochre courtyard tiles ── */
const TILE = { top:['#E4A676', '#EDC08A'], side:'#C98A58', soilTop:'#A5683F', soilBot:'#5C3822' };
function tileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(23);
  g.fillStyle = '#FBF4EA'; g.fillRect(0, 0, N, N);
  g.strokeStyle = 'rgba(150,80,40,.16)'; g.lineWidth = 3; g.strokeRect(20, 20, N - 40, N - 40);
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.strokeRect(26, 26, N - 52, N - 52);
  for (let i=0;i<4;i++){ const [x, y] = [[20,20],[N-20,20],[N-20,N-20],[20,N-20]][i]; g.fillStyle = 'rgba(150,80,40,.18)'; g.beginPath(); g.arc(x, y, 5, 0, 6.3); g.fill(); }
  for (let i=0;i<220;i++){ g.fillStyle = r() < .5 ? 'rgba(255,255,255,.45)' : 'rgba(120,60,20,.1)'; g.beginPath(); g.arc(r()*N, r()*N, .6 + r()*1.4, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/* decor: grass tufts, marigold flowers, petals and the odd diya on empty cells; a little on waiting cells */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    const tuft = (n) => { for (let j=0;j<n;j++){ const ang = r()*6.28, d = .15 + r()*.3; addModel(grp, r() < .55 ? 'Grass_1' : 'Grass_2', .22*(.7 + r()*.5), p.x + Math.cos(ang)*d, p.y, p.z + Math.sin(ang)*d, r()*6.28, 'farm'); } };
    const flowers = (n) => { for (let j=0;j<n;j++){ const ang = r()*6.28, d = .1 + r()*.32; tintedFlower(grp, r()<.5 ? 'Flower_3' : 'Flower_4', .2 + r()*.06, p.x + Math.cos(ang)*d, p.y, p.z + Math.sin(ang)*d, r()*6.28, [0xF79A1E, 0xF7C62E, 0xE8364F][Math.floor(r()*3)]); } };
    const petals = (n) => { for (let j=0;j<n;j++) a.add(new THREE.CylinderGeometry(.018, .018, .005, 6), j%2 ? MAT.marigold : MAT.marigoldY, at(p.x + (r()-.5)*.8, p.y + .003, p.z + (r()-.5)*.8)); };
    if (!sl || sl === 'later') { tuft(3); flowers(AMBIENT() ? 3 : 1); petals(4); if (r() < .6) { diya(a, p.x + (r()-.5)*.5, p.y, p.z + (r()-.5)*.5, 1, grp, .2); } grp.userData.decor = 'meadow'; }
    else if (!placed.includes(sl.id) && AMBIENT()) { tuft(1); petals(3); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if ((Math.abs(x-3) === V.ring && x > 3) || (Math.abs(z-3) === V.ring && z > 3)) { tuft(1); grp.userData.decor = 'rim'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ── ambient: flickering diyas + sky lanterns rising slowly ── */
function makeLantern(big=1){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.CylinderGeometry(.06, .042, .12, 8), MAT.paper, at(0, .06, 0)); a.add(new THREE.CylinderGeometry(.061, .061, .012, 8), MAT.paperR, at(0, .005, 0));
  a.into(g); g.children.forEach(m => { m.castShadow = false; });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFA040, transparent:true, opacity:.75, blending:THREE.AdditiveBlending, depthWrite:false }));
  sp.position.y = .05; sp.scale.setScalar(.42); sp.renderOrder = 9; g.add(sp); g.userData.glow = sp; g.scale.setScalar(big); return g;
}
function addLanterns(n, released){
  const R = V.ring, list = V.lanterns || (V.lanterns = []);
  for (let i=0;i<n;i++){ const o = makeLantern(released ? 1.1 : 1); const k = list.length;
    o.userData.u = { x:((k*.61) % 1 - .5)*(1 + R*1.1), z:((k*.37 + .3) % 1 - .5)*(1 + R*1.1) - .3, ph:(k*.29) % 1, sp:.035 + (k%3)*.008, sw:k*1.7, released, arrive:released ? 0 : 1 };
    world.add(o); list.push(o); V.life.push(o); }
}
function moveLanterns(t){
  (V && V.lanterns || []).forEach(o => { const u = o.userData.u, H = .8 + V.ring*.3;
    const f = u.released && u.arrive < 1 ? u.arrive*.5 : ((t*u.sp + u.ph) % 1 + 1) % 1;
    o.position.set(u.x + Math.sin(t*.4 + u.sw)*.12, TILE_TOP + .8 + f*H, u.z + Math.cos(t*.33 + u.sw)*.1);
    const fade = f > .8 ? (1 - f)/.2 : Math.min(1, f*6); o.userData.glow.material.opacity = .75*fade; o.visible = fade > .02; o.scale.setScalar((u.released ? 1.1 : 1)*(.6 + .4*fade)); });
}
function flicker(t){
  FLAME.forEach((m, i) => { const k = Math.sin(t*9.1 + i*2.1)*.5 + Math.sin(t*14.3 + i*4.7)*.3 + Math.sin(t*23 + i)*.2; m.emissiveIntensity = 1.7 + k*.35; });
  GLOW.forEach((m, i) => { m.opacity = .5 + .12*Math.sin(t*8.3 + i*2.6) + .06*Math.sin(t*17 + i); });
}

/* ── residents: two cows amble in, a peacock fans its tail by the temple, sparrows + pigeons, lanterns and gentle fireworks ── */
const RES_SCALE = 1.5;
function makePeacock(){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.06, 9, 7), MAT.blue, at(0, .13, .01, 0, .85, 1, 1.3, -.2));
  seg(a, MAT.blue, new THREE.Vector3(0, .15, .06), new THREE.Vector3(0, 1, .35), .12, .025, .018, 7);
  blob(a, MAT.blue, new THREE.Vector3(0, .27, .1), .03, 1, 1); a.add(new THREE.ConeGeometry(.01, .035, 5).rotateX(Math.PI/2), MAT.rope, at(0, .265, .135));
  blob(a, MAT.lime, new THREE.Vector3(.02, .275, .115), .008); blob(a, MAT.lime, new THREE.Vector3(-.02, .275, .115), .008);
  for (let i=0;i<3;i++){ const d = new THREE.Vector3((i-1)*.25, 1, -.2).normalize(); seg(a, MAT.blueD, new THREE.Vector3(0, .295, .095), d, .05, .003, .003, 3); blob(a, MAT.blue, new THREE.Vector3(0, .295, .095).addScaledVector(d, .052), .008); }
  for (const s of [-1, 1]) { seg(a, MAT.rope, new THREE.Vector3(s*.025, 0, 0), _up, .09, .006, .006, 4); a.add(new THREE.SphereGeometry(.035, 7, 5), MAT.brownB, at(s*.045, .13, -.02, 0, .35, .8, 1.3)); }
  a.into(g);
  // the fanned train: feathers from a pivot behind the body, each with an eye
  const tail = new THREE.Group(), ta = new Acc(); tail.position.set(0, .12, -.07); g.add(tail);
  const NF = 17; for (let i=0;i<NF;i++){ const ang = -1.35 + i/(NF-1)*2.7, L = .34 + Math.cos(ang)*.04;
    const dir = new THREE.Vector3(Math.sin(ang), Math.cos(ang), -.25).normalize();
    seg(ta, MAT.greenD, new THREE.Vector3(0, 0, 0), dir, L, .006, .004, 3);
    const tip = dir.clone().multiplyScalar(L*.93), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, .25, 1).normalize());
    const put = (geo, mat, sc, off) => ta.add(geo, mat, new THREE.Matrix4().compose(tip.clone().add(new THREE.Vector3(0, 0, off)), q, new THREE.Vector3(sc, sc*1.25, sc)));
    put(new THREE.CircleGeometry(.05, 8), MAT.green, 1, 0); put(new THREE.CircleGeometry(.03, 8), MAT.gold, 1, .003); put(new THREE.CircleGeometry(.018, 8), MAT.blueD, 1, .006);
    const mid = dir.clone().multiplyScalar(L*.6); ta.add(new THREE.CircleGeometry(.035, 6), MAT.teal, new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1.3, 1))); }
  ta.into(tail); tail.children.forEach(m => { m.material = m.material; });
  g.userData.tail = tail; return g;
}
function makeBird(pigeon){
  const g = new THREE.Group(), a = new Acc(), body = pigeon ? MAT.greyB : MAT.brownB, dark = pigeon ? MAT.greyD : MAT.woodD;
  a.add(new THREE.SphereGeometry(.035, 8, 6), body, at(0, .045, 0, 0, .85, .85, 1.25));
  blob(a, pigeon ? MAT.teal : MAT.plinth, new THREE.Vector3(0, .068, .032), .024, 1, 1);
  a.add(new THREE.ConeGeometry(.007, .018, 4).rotateX(Math.PI/2), MAT.rope, at(0, .066, .06));
  a.add(new THREE.BoxGeometry(.03, .006, .05), dark, at(0, .05, -.055, 0, 1, 1, 1, -.3));
  for (const s of [-1, 1]) { a.add(new THREE.SphereGeometry(.02, 6, 4), dark, at(s*.028, .05, -.005, 0, .3, .7, 1.3)); seg(a, MAT.rope, new THREE.Vector3(s*.01, 0, 0), _up, .02, .003, .003, 3); }
  blob(a, MAT.black, new THREE.Vector3(.016, .074, .048), .005); blob(a, MAT.black, new THREE.Vector3(-.016, .074, .048), .005);
  a.into(g); return g;
}
/* the festival cow: white coat (first cow), horns painted saffron. Materials must already be per-clone. */
function paintCow(obj, white){
  if (white) obj.traverse(o => { if (o.isMesh) { const n = o.material.name || ''; if (n === 'Main') o.material.color.setHex(0xEDE3D2); else if (n === 'Main_Light') o.material.color.setHex(0xFBF6EE); else if (n === 'Muzzle') o.material.color.setHex(0x8C7A6A); } });
  obj.traverse(o => { if (o.isMesh && o.material.name === 'Horns') o.material.color.setHex(0xE8762A); });   // horns painted for the festival
}
async function spawnCow(d){
  const gltf = await loadAnimal(d), obj = SkeletonUtils.clone(gltf.scene);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.metalness = 0; o.material.roughness = .85; } });
  const b = modelBox(obj), k = d.h / (b.max.y - b.min.y); obj.scale.setScalar(k); obj.userData.y0 = TILE_TOP - b.min.y*k; world.add(obj);
  const mixer = new THREE.AnimationMixer(obj), clips = {}; gltf.animations.forEach(c => clips[c.name.replace(/^.*\|/, '')] = c);
  paintCow(obj, d.white);
  const rec = { def:d, obj, mixer, clips, cur:null }; V.animals.push(rec); return rec;
}
function playClip(a, name){ const c = a.clips[name] || a.clips.Idle || Object.values(a.clips)[0]; if (!c) return; const act = a.mixer.clipAction(c);
  if (a.cur === act) return; act.reset().play(); if (a.cur) a.cur.crossFadeTo(act, .3, false); a.cur = act; }
const COWS = [ { id:'Cow', name:'Cows', h:.69, at:[0.25, 2.75], face:1.9, white:true }, { id:'Cow', name:'Cow', h:.62, at:[0.3, 3.95], face:1.2 } ];
const PEACOCK_AT = [5.1, 6.05], BIRDS = [[2.55, 4.5, .4, 0], [3.4, 5.55, 2.2, 1], [4.55, 3.55, -1, 0], [2.4, 3.9, 3.1, 1]];
/* gentle fireworks: a soft rising spark, then a slow bloom of warm motes that drift down and fade */
const FW_COL = [0xFFD27A, 0xFFB0C8, 0xB8F0E0, 0xFFE6A8];
function firework(pos, col, freezeAt){
  const n = 26, spr = [];
  for (let i=0;i<n;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:i%3 ? TEX.glow : TEX.star, color:col, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
    const th = i/n*Math.PI*2, ph = Math.acos(1 - 2*((i*.618) % 1)); s.userData.v = new THREE.Vector3(Math.sin(ph)*Math.cos(th), Math.cos(ph)*.8, Math.sin(ph)*Math.sin(th)); s.renderOrder = 11; fx.add(s); spr.push(s); }
  const rise = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:col, transparent:true, opacity:.9, blending:THREE.AdditiveBlending, depthWrite:false })); rise.scale.setScalar(.12); fx.add(rise);
  const step = t => { const tr = Math.min(1, t/.3), tb = Math.max(0, (t - .3)/.7);
    rise.position.set(pos.x, pos.y - 1.2*(1 - tr), pos.z); rise.material.opacity = t < .3 ? .9 : 0;
    spr.forEach(s => { const e = 1 - Math.pow(1 - tb, 3); s.position.copy(pos).addScaledVector(s.userData.v, e*.85).add(new THREE.Vector3(0, -tb*tb*.35, 0));
      s.material.opacity = tb > 0 ? .85*(1 - tb*tb) : 0; s.scale.setScalar(.17*(1 - tb*.4)); }); };
  if (freezeAt != null) { step(freezeAt); return; }
  tween(2600, step, () => { spr.concat(rise).forEach(s => { fx.remove(s); s.material.dispose(); }); });
}
function fireworksShow(freeze){
  const R = V.ring, pts = [[-1.6, 2.7, -1.2], [1.5, 3.0, -1.9], [.2, 3.3, .1], [2.2, 2.6, .9]];
  pts.forEach(([x, y, z], i) => { if (freeze) firework(new THREE.Vector3(x, y, z), FW_COL[i], [.55, .7, .45, .62][i]);
    else setTimeout(() => firework(new THREE.Vector3(x, y, z), FW_COL[i]), S.rm ? 0 : i*650); });
}
function moveResidents(t){
  (V && V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'peacock') { r.obj.position.set(u.at.x + (1 - e)*1.4, TILE_TOP, u.at.z + (1 - e)*.6); const tl = r.obj.userData.tail;
      tl.scale.setScalar(.25 + .75*Math.min(1, e*1.2)); tl.rotation.z = Math.sin(t*1.3)*.04; tl.rotation.x = Math.sin(t*9)*.015*(e >= 1 ? 1 : 0); }
    else if (r.kind === 'bird') { const hop = Math.max(0, Math.sin(t*5 + u.ph)); const fly = 1 - e;
      r.obj.position.set(u.at.x + Math.sin(t*.7 + u.ph)*.06 + fly*1.5, TILE_TOP + hop*hop*.03 + fly*1.6, u.at.z + Math.cos(t*.5 + u.ph)*.05 - fly*.8);
      r.obj.rotation.x = e >= 1 ? Math.max(0, Math.sin(t*1.3 + u.ph*3))*.5 : 0; }
  });
  moveLanterns(t);
}
async function diwaliMoveIn(walk){
  V.residentsIn = true; V.res = [];
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const groups = [
    async () => { const out = [];
      for (const d of COWS) { const c = await spawnCow(d), to = cellPos(d.at[0], d.at[1]), from = cellPos(3, 7.3); c.obj.position.set(to.x, c.obj.userData.y0, to.z); c.obj.rotation.y = d.face;
        if (!walk) { playClip(c, d.face > 1.5 ? 'Eating' : 'Idle'); c.mixer.update(.6); continue; }
        playClip(c, 'Walk'); const dir = to.clone().sub(from); c.obj.rotation.y = Math.atan2(dir.x, dir.z);
        out.push(new Promise(res => tween(S.rm ? 1 : Math.max(900, dir.length()*700), t => { const e = 1 - Math.pow(1 - t, 2.2); c.obj.position.set(from.x + dir.x*e, c.obj.userData.y0, from.z + dir.z*e); },
          () => { c.obj.rotation.y = d.face; playClip(c, d.face > 1.5 ? 'Eating' : 'Idle'); sparkle(to.clone().setY(TILE_TOP + .5), 10, 0xFFF0B0, .6); res(); }))); }
      await Promise.all(out); },
    async () => { const o = makePeacock(); o.scale.setScalar(RES_SCALE); o.rotation.y = .75; const r = addRes('peacock', o, { at:cellPos(...PEACOCK_AT) }); if (walk) await arrive([r], 1800); },
    async () => { const rs = BIRDS.map(([x, z, f, pg], i) => { const o = makeBird(!!pg); o.scale.setScalar(RES_SCALE); o.rotation.y = f; return addRes('bird', o, { at:cellPos(x, z), ph:i*1.3 }); }); if (walk) await arrive(rs, 1500); },
    async () => { addLanterns(5, true); V.lanterns.slice(-5).forEach(o => o.userData.u.arrive = walk ? 0 : 1); if (walk || S.celebrate) fireworksShow(!walk);
      if (walk) await new Promise(res => tween(S.rm ? 1 : 2600, t => V.lanterns.slice(-5).forEach(o => o.userData.u.arrive = t), () => { V.lanterns.slice(-5).forEach(o => { const u = o.userData.u; u.arrive = 1; u.released = false; u.ph = ((.5 - _t*u.sp) % 1 + 1) % 1; }); res(); })); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length;
}
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.05))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(TILE_TOP + .5), 10, 0xFFF0B0, .6); res(); })); }
let _t = 0;

export default {
  id:'diwali', name:'Diwali lanes', title:'Your lanes',
  season:11, dates:'16 Feb–1 Mar', nextIn:14,
  kits:['farm', 'a', 'pirate'],
  kitDefs:{ farm:{ file:'assets/farm/farm.glb', flat:true }, pirate:{ file:'assets/pirate/pirate-kit.glb', stripSuffix:true } },
  families:{
    water:   { label:'wells, stepwells & ponds', tag:'Water' },
    building:{ label:'houses, shops & school',   tag:'House' },
    path:    { label:'lanes, torans & lights',   tag:'Lane' },
    crop:    { label:'rangoli & marigolds',      tag:'Grows' },
    tree:    { label:'neem, banana & palms',     tag:'Tree' },
    special: { label:'the temple',               tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:TILE, tileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 3.5c1.8 2.3 2.4 4 2.4 5.2a2.4 2.4 0 0 1-4.8 0c0-1.2.6-2.9 2.4-5.2z" fill="#FFB020"/><path d="M12 7.2c.7.9.9 1.6.9 2a.9.9 0 0 1-1.8 0c0-.4.2-1.1.9-2z" fill="#FFF1B8"/><path d="M3.5 13.5h17c-.6 3.6-4 6-8.5 6s-7.9-2.4-8.5-6z" fill="#C4683A"/><path d="M3.5 13.5h17" stroke="#9E4A26" stroke-width="1.6" stroke-linecap="round"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M20 118v-10h88v10z"/><path d="M28 108V84h44v24z"/><path d="M76 108V88h26v20z" opacity=".85"/><path d="M50 22c-9 18-16 38-18 62h36c-2-24-9-44-18-62z"/><circle cx="50" cy="18" r="6"/><path d="M50 12V2l20 5-20 5z"/><path d="M74 88l15-10 15 10z"/></g>',
  album:{ image:'assets/diwali/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#FBEBD6)' },
  css:'.phone[data-theme="diwali"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#FDF1DF 58%,#F8E0BE 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'rangoli') {
      const base = new THREE.Mesh(G.field, MAT.stone); base.position.y = .035; base.scale.set(1, .8, 1); base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      const host = new THREE.Group(); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillRangoli(host, s, st); fillRangoli(host, s, stage);
    } else if (s.kind === 'marigold') {
      const base = new THREE.Mesh(G.field, M.soil); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      const host = new THREE.Group(); host.scale.setScalar(1.15); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillMarigold(host, s, st); fillMarigold(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'marigold' ? 1.15 : 1,
  contact: s => s.kind === 'diwali' && !['lane', 'torans'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.b === 'lotuspond' || s.b === 'stepwell',
  decor,
  ambient(){ addLanterns(3, false); moveLanterns(2.1); },
  tick(t){ _t = t; flicker(t); moveResidents(t); },

  residents:[ { id:'Cow', name:'Cows', h:.69, at:[0.25, 2.75], face:1.9, n:2 }, { id:'peacock', name:'Peacock', n:1 }, { id:'sparrow', name:'Sparrows', n:4 }, { id:'lantern', name:'Sky lanterns', n:5 } ],
  moveIn: diwaliMoveIn,
  async preload(){ if (!ANIMCACHE.__cow) ANIMCACHE.__cow = await loadAnimal({ id:'Cow' }); },
  residentThumb(d, thumbFor){
    if (d.id === 'Cow') { const gltf = ANIMCACHE.__cow; if (!gltf || !gltf.scene) return 'assets/thumbs/Cow.png';
      return thumbFor('diwali:Cow', () => { const o = SkeletonUtils.clone(gltf.scene); o.traverse(m => { if (m.isMesh) m.material = m.material.clone(); }); paintCow(o, true);
        const mx = new THREE.AnimationMixer(o), c = gltf.animations.find(x => /Idle/.test(x.name)); if (c) { mx.clipAction(c).play(); mx.update(.4); } o.rotation.y = -.35 + Math.PI/2; return o; }, 168); }
    return thumbFor('diwali:'+d.id, () => { const o = d.id === 'peacock' ? makePeacock() : d.id === 'sparrow' ? makeBird(false) : makeLantern(2);
      o.rotation.y = d.id === 'peacock' ? .5 : .8; return o; }, 168); },
  /* sprite export: the cow uses the engine's animated-animal path (null); the rest are static rigs the app animates */
  residentRig(d){ if (d.id === 'Cow') return null;
    const obj = d.id === 'peacock' ? makePeacock() : d.id === 'sparrow' ? makeBird(false) : makeLantern(1);
    if (d.id !== 'lantern') obj.scale.setScalar(RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
