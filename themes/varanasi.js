/* VARANASI GHATS (?theme=varanasi) — sandstone ghat steps down to a river at dusk. Own 7×7 blueprint (rings 6 / 14 / 20):
   the river runs down column x=4 (front-right third of the plot), the city (temples, tall pastel havelis, a pathshala, ghat
   umbrellas) climbs the left bank, the empty sand bank on the right has beached boats, kites and marigold beds (as on the real
   east bank). The Gita hero, the aarti platform, sits at cells 2..3 × 5..6 on the water's edge: only river is in front of it.
   The river, its ghat steps and the sand bank are one env layer (V.env) so they scale with the land and survive impacts.
   No CC0 kit has Indian architecture, so every piece is procedural flat-shaded three.js merged per material (Acc).
   Reused CC0 kit pieces only: peepal / neem / banyan trees (Quaternius Stylized Nature MegaKit, kit a), grass tufts (Quaternius
   farm kit). Residents (rowing boats, Ganges river dolphins, pigeons) are procedural. No new asset files. */
import * as THREE from 'three';
import { rngFrom, TEX, addSway, world } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, OFF, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, M, Acc, seg, blob, _up } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';

/* ── materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.86, metalness:0, flatShading:true, ...o });
const MAT = {
  sand:FM(0xE8CFA2), sandD:FM(0xCFAE7C), stone:FM(0xE2C79A), stoneD:FM(0xC7A575), stoneR:FM(0xD39A6A), red:FM(0xC9674A), redD:FM(0xA24B35),
  white:FM(0xFBF4E6), whiteD:FM(0xE9DCC6), lime:FM(0xFFFCF4),
  pink:FM(0xF3A9B4), blue:FM(0x7FB6D9), blueD:FM(0x4F86B8), yellow:FM(0xF4CE6A), yellowD:FM(0xD9A93E), mint:FM(0x9CD7BF), ochre:FM(0xEBB46A), saffron:FM(0xF39A2E),
  maroon:FM(0x8E2F3A), turq:FM(0x4FB7B0), indigo:FM(0x3E5BA8), green:FM(0x3F9E5A), greenD:FM(0x2E6E3F),
  wood:FM(0x8A5530), woodD:FM(0x5E3820), woodL:FM(0xB07A48), bamboo:FM(0xC9A263), straw:FM(0xD8B070), strawD:FM(0xB88E4E),
  door:FM(0x6B3A22), glow:FM(0xFFD08A, { emissive:0xFF9A3C, emissiveIntensity:1.0 }),
  clay:FM(0xC4683A), clayD:FM(0x9E4A26), brass:FM(0xE3B34A, { roughness:.38, metalness:.3 }), gold:FM(0xF0C348, { emissive:0x5A4000, emissiveIntensity:.3, roughness:.4, metalness:.3 }),
  cloth:FM(0xD8343C, { side:THREE.DoubleSide }), clothY:FM(0xF7C62E, { side:THREE.DoubleSide }), clothB:FM(0x3E7FD0, { side:THREE.DoubleSide }), clothP:FM(0xE86AA0, { side:THREE.DoubleSide }), clothG:FM(0x3FAE7A, { side:THREE.DoubleSide }),
  rope:FM(0xD9BE8A), soil:FM(0x8A5A33, { roughness:1 }),
  leaf:FM(0x4E9A3A), leafD:FM(0x3B7F2E), leafL:FM(0x79B84A), dona:FM(0x5E9A3E),
  marigold:FM(0xF79A1E, { emissive:0x6A2A00, emissiveIntensity:.15 }), marigoldY:FM(0xF7C62E, { emissive:0x5A3C00, emissiveIntensity:.12 }), rose:FM(0xE0405A),
  lotus:FM(0xF6A6C4), lotusD:FM(0xE77AA4), pad:FM(0x5FA844),
  flag:FM(0xFF8A1E, { side:THREE.DoubleSide, emissive:0x7A2E00, emissiveIntensity:.25 }), black:FM(0x2A2320),
  grey:FM(0xA9A7B4), greyD:FM(0x6E6D7C), teal:FM(0x2AA38C), dolphin:FM(0xB9A9AE), dolphinB:FM(0xE9CFCB), kite1:FM(0xE8364F, { side:THREE.DoubleSide }), kite2:FM(0x2E86DE, { side:THREE.DoubleSide }), kite3:FM(0xF7B32B, { side:THREE.DoubleSide }),
  paper:FM(0xFFB55A, { emissive:0xFF7A1A, emissiveIntensity:.95 }), iron:FM(0x4A4E58, { roughness:.5, metalness:.3 })
};
const RIVER = new THREE.MeshStandardMaterial({ color:0x3F8FB2, roughness:.14, metalness:0, emissive:0x173E4C, emissiveIntensity:.35 });
const FLAME = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ color:0xFFD36A, emissive:0xFF9A1F, emissiveIntensity:1.7, roughness:.6 }));
const GLOW = [0, 1, 2].map(() => new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFB450, transparent:true, opacity:.55, blending:THREE.AdditiveBlending, depthWrite:false }));

const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=12){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z)); }
function dome(acc, mat, r, x, y, z, sy=1){ acc.add(new THREE.SphereGeometry(r, 10, 5, 0, Math.PI*2, 0, Math.PI/2), mat, at(x, y, z, 0, 1, sy, 1)); }
function archGeo(w, h, depth=.02){
  const s = new THREE.Shape(), r = w/2; s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled:false, curveSegments:8 });
}
/* arched door/window on a wall face ('z' = +z face, 'x' = +x face) */
function arch(acc, face, half, u, y0, w, h, frame, fill, cx=0, cz=0){
  const put = (geo, mat, off) => acc.add(geo, mat, face === 'z' ? at(cx + u, y0, cz + half + off) : at(cx + half + off, y0, cz - u, Math.PI/2));
  put(archGeo(w + .045, h + .03, .012), frame, 0); put(archGeo(w, h, .016), fill, .004);
}
let _fl = 0;
function diya(acc, x, y, z, s=1, parent=null, glow=0){
  acc.add(new THREE.CylinderGeometry(.034*s, .022*s, .022*s, 9), MAT.clay, at(x, y + .011*s, z));
  acc.add(new THREE.SphereGeometry(.016*s, 6, 5), FLAME[_fl++ % 3], at(x, y + .035*s, z, 0, 1, 1.9, 1));
  if (parent && glow) { const sp = new THREE.Sprite(GLOW[_fl % 3]); sp.position.set(x, y + .04*s, z); sp.scale.setScalar(glow); sp.renderOrder = 9; parent.add(sp); }
}
function garland(acc, a, b, sag=.06, n=12, mats=[MAT.marigold, MAT.marigoldY], r=.018){
  for (let i=0;i<=n;i++){ const t = i/n, p = a.clone().lerp(b, t); p.y -= Math.sin(t*Math.PI)*sag; acc.add(new THREE.IcosahedronGeometry(r, 0), mats[i % mats.length], at(p.x, p.y, p.z)); }
}
function matka(acc, x, y, z, s=1, mat=MAT.clay){
  acc.add(new THREE.SphereGeometry(.08*s, 10, 7), mat, at(x, y + .07*s, z, 0, 1, .85, 1));
  acc.add(new THREE.CylinderGeometry(.04*s, .05*s, .04*s, 10), mat, at(x, y + .14*s, z));
  acc.add(new THREE.TorusGeometry(.042*s, .01*s, 5, 10).rotateX(Math.PI/2), MAT.clayD, at(x, y + .16*s, z));
}
function bell(acc, x, y, z, s=1){ acc.add(new THREE.CylinderGeometry(.018*s, .04*s, .06*s, 10, 1, true), MAT.brass, at(x, y - .03*s, z)); acc.add(new THREE.SphereGeometry(.012*s, 6, 4), MAT.brass, at(x, y - .065*s, z)); seg(acc, MAT.rope, V3(x, y, z), _up, .05*s, .003, .003, 3); }
function flagOn(acc, x, y, z, len=.36, ry=-.8){ seg(acc, MAT.woodD, V3(x, y, z), _up, len, .008, .007, 5);
  const fl = new THREE.Shape(); fl.moveTo(0, 0); fl.lineTo(.3, -.06); fl.lineTo(0, -.15); fl.lineTo(0, 0);
  const fg = new THREE.ShapeGeometry(fl), fp = fg.attributes.position; for (let i=0;i<fp.count;i++) fp.setZ(i, Math.sin(fp.getX(i)*12)*.02);
  acc.add(fg, MAT.flag, at(x, y + len, z, ry)); }

/* a nagara shikhara: curved tiers, ribbed faces, amalaka + gold kalash (no idol, no script) */
function shikhara(a, cx, cz, y0, base, tiers, th, mat, matD, flag=true){
  for (let i=0;i<tiers;i++){ const t = i/tiers, w = base*(1 - Math.pow(t, 1.5)*.62), y = y0 + i*th;
    a.add(bx(w, th*.84, w), mat, at(cx, y + th*.42, cz)); a.add(bx(w*1.04, th*.16, w*1.04), matD, at(cx, y + th*.92, cz));
    const rw = w*.36; a.add(bx(rw, th*.84, w + .06), mat, at(cx, y + th*.42, cz)); a.add(bx(w + .06, th*.84, rw), mat, at(cx, y + th*.42, cz));
    if (i % 2 === 0 && i < tiers - 3) for (const [px, pz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) a.add(new THREE.ConeGeometry(.04*base/.8*(1 - t*.6), .09*base/.8, 4), matD, at(cx + px*w*.42, y + th + .025, cz + pz*w*.42, Math.PI/4)); }
  const yT = y0 + tiers*th, k = base/.8;
  a.add(new THREE.CylinderGeometry(.17*k, .17*k, .06*k, 16), MAT.stoneD, at(cx, yT + .04*k, cz)); a.add(new THREE.TorusGeometry(.17*k, .03*k, 6, 16).rotateX(Math.PI/2), matD, at(cx, yT + .04*k, cz));
  a.add(new THREE.SphereGeometry(.055*k, 10, 8), MAT.gold, at(cx, yT + .12*k, cz, 0, 1, .9, 1)); a.add(new THREE.ConeGeometry(.022*k, .09*k, 8), MAT.gold, at(cx, yT + .2*k, cz));
  if (flag) flagOn(a, cx - .02, yT + .12*k, cz - .02, .42*k);
  return yT;
}

/* ── tall pastel ghat houses: 2–3 storeys, arched windows (some lit), a jharokha, roof chhatri, rooftop washing line ── */
function ghatHouse(g, o){
  const a = new Acc(), W = o.w || .7, D = o.d || .66, F = o.floors || 2, FH = .3, wall = MAT[o.wall], trim = MAT[o.trim || 'white'], sh = MAT[o.shutter || 'turq'];
  slab(a, MAT.stoneD, W + .08, .05, D + .08);
  for (let f=0; f<F; f++){ const y = .05 + f*FH, inset = f === F - 1 && F > 2 ? .04 : 0;
    slab(a, wall, W - inset, FH, D - inset, 0, y); slab(a, trim, W + .03 - inset, .03, D + .03 - inset, 0, y + FH - .03);
    const lit = (f + (o.seed||0)) % 2 === 0;
    for (const u of (W > .8 ? [-.26, 0, .26] : [-.16, .14])) arch(a, 'z', (D - inset)/2, u, y + .07, .1, .17, trim, (lit && u > 0) ? MAT.glow : sh);
    for (const u of [-.14, .16]) arch(a, 'x', (W - inset)/2, u, y + .07, .1, .17, trim, (!lit && u < 0) ? MAT.glow : sh);
  }
  if (!o.noDoor) arch(a, 'z', D/2, o.doorU ?? -.16, .05, .16, .24, trim, MAT.door);
  const yR = .05 + F*FH;
  // parapet with little merlons
  for (const [w, d, x, z] of [[W, .04, 0, D/2 - .02], [.04, D, W/2 - .02, 0], [W, .04, 0, -D/2 + .02], [.04, D, -W/2 + .02, 0]]) slab(a, wall, w, .07, d, x, yR, z);
  for (let i=0;i<5;i++) { slab(a, trim, .05, .04, .05, -W/2 + .06 + i*(W - .12)/4, yR + .07, D/2 - .02); slab(a, trim, .05, .04, .05, W/2 - .02, yR + .07, -D/2 + .06 + i*(D - .12)/4); }
  // jharokha: a projecting balcony window with a little dome
  const jy = .05 + FH*(F - 1) + .04, ju = o.jharokha ?? .12;
  slab(a, trim, .24, .04, .12, ju, jy, D/2 + .05); slab(a, sh, .2, .16, .09, ju, jy + .04, D/2 + .03); slab(a, trim, .26, .025, .14, ju, jy + .2, D/2 + .05);
  dome(a, trim, .09, ju, jy + .22, D/2 + .04, .9);
  // roof: chhatri or dome + washing line with colourful cloth
  const cx = o.cx ?? -W/2 + .18, cz = -D/2 + .18;
  if (o.roof !== 'dome') { for (const [px, pz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) seg(a, MAT.white, V3(cx + px*.07, yR, cz + pz*.07), _up, .17, .01, .01, 5);
    slab(a, MAT.white, .2, .025, .2, cx, yR + .17); dome(a, MAT.white, .09, cx, yR + .195, cz); a.add(new THREE.ConeGeometry(.015, .06, 6), MAT.gold, at(cx, yR + .3, cz)); }
  else { cyl(a, trim, .13, .13, .06, 0, yR, -.05, 12); dome(a, MAT.white, .13, 0, yR + .06, -.05, 1.1); a.add(new THREE.ConeGeometry(.018, .08, 6), MAT.gold, at(0, yR + .22, -.05)); }
  if (o.line !== false) { const lx0 = W/2 - .1, lz0 = D/2 - .12, lz1 = -D/2 + .12;
    for (const z of [lz0, lz1]) seg(a, MAT.woodD, V3(lx0, yR, z), _up, .16, .006, .006, 4);
    [MAT.cloth, MAT.clothY, MAT.clothB, MAT.clothP].forEach((m, i) => { const z = lz0 - (i + .6)*(lz0 - lz1)/4.4; a.add(new THREE.PlaneGeometry(.08, .09), m, at(lx0, yR + .105, z, Math.PI/2)); }); }
  diya(a, (o.doorU ?? -.16) - .13, .05, D/2 + .07, 1, g, .2); diya(a, (o.doorU ?? -.16) + .13, .05, D/2 + .07, 1);
  for (let i=0;i<4;i++) diya(a, -W/2 + .1 + i*(W - .2)/3, yR + .11, D/2 - .02, .75);
  if (o.pots) { matka(a, W/2 + .07, 0, D/2 - .05, .8); matka(a, W/2 + .06, 0, D/2 - .22, .65, MAT.brass); }
  if (o.flag) flagOn(a, -W/2 + .06, yR + .07, D/2 - .06, .4, -.4);
  a.into(g);
}
/* the palace ghat: a tall sandstone mansion with twin corner chhatris (back corner = skyline) */
function palace(g){
  const a = new Acc(), W = .8, D = .78, H = 1.02;
  slab(a, MAT.stoneD, W + .1, .06, D + .1); slab(a, MAT.stoneR, W, H, D, 0, .06);
  for (const y of [.36, .7]) slab(a, MAT.whiteD, W + .03, .03, D + .03, 0, .06 + y - .03);
  for (const [f, lit] of [[0, 0], [1, 1], [2, 0]]) { const y = .12 + f*.34;
    for (const u of [-.22, 0, .22]) arch(a, 'z', D/2, u, y, .11, .19, MAT.whiteD, lit && u !== 0 ? MAT.glow : MAT.maroon);
    for (const u of [-.2, .2]) arch(a, 'x', W/2, u, y, .11, .19, MAT.whiteD, !lit && u > 0 ? MAT.glow : MAT.maroon); }
  const yR = .06 + H; slab(a, MAT.whiteD, W + .04, .04, D + .04, 0, yR);
  for (const [px, pz] of [[1, 1], [-1, 1], [1, -1]]) { const cx = px*(W/2 - .1), cz = pz*(D/2 - .1);
    for (const [qx, qz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) seg(a, MAT.white, V3(cx + qx*.06, yR + .04, cz + qz*.06), _up, .15, .01, .01, 5);
    slab(a, MAT.white, .17, .02, .17, cx, yR + .19); dome(a, MAT.white, .08, cx, yR + .21, cz); a.add(new THREE.ConeGeometry(.013, .05, 6), MAT.gold, at(cx, yR + .3, cz)); }
  cyl(a, MAT.stoneR, .16, .16, .14, -.1, yR + .04, -.1, 12); dome(a, MAT.white, .17, -.1, yR + .18, -.1, 1.15); a.add(new THREE.ConeGeometry(.02, .09, 6), MAT.gold, at(-.1, yR + .38, -.1));
  // long balcony on the river face
  slab(a, MAT.whiteD, .1, .03, D - .1, W/2 + .04, .42); for (let i=0;i<6;i++) seg(a, MAT.white, V3(W/2 + .08, .45, -D/2 + .1 + i*(D - .2)/5), _up, .08, .006, .006, 4); slab(a, MAT.white, .02, .015, D - .1, W/2 + .08, .53);
  arch(a, 'z', D/2, -.22, .06, .15, .24, MAT.whiteD, MAT.door);
  flagOn(a, -.1, yR + .38, -.1, .3);
  for (let i=0;i<5;i++) diya(a, -W/2 + .08 + i*(W - .16)/4, yR + .04, D/2 - .03, .75);
  a.into(g);
}
/* small shrine: white cell with a mini shikhara, bell and marigolds */
function shrine(g, s){
  const a = new Acc(), big = !!s.big, W = big ? .6 : .46, H = big ? .34 : .28;
  slab(a, MAT.stoneD, W + .18, .05, W + .18); slab(a, MAT.stone, W + .08, .05, W + .08, 0, .05);
  const Y = .1; slab(a, big ? MAT.stoneR : MAT.white, W, H, W, 0, Y); slab(a, MAT.saffron, W + .03, .03, W + .03, 0, Y + H - .03);
  arch(a, 'x', W/2, 0, Y + .02, .14, .22, MAT.saffron, MAT.glow); arch(a, 'z', W/2, 0, Y + .06, .1, .14, MAT.saffron, big ? MAT.redD : MAT.whiteD);
  shikhara(a, 0, 0, Y + H, W*.95, big ? 8 : 6, big ? .1 : .075, big ? MAT.stoneR : MAT.white, big ? MAT.redD : MAT.whiteD);
  bell(a, W/2 + .07, Y + H - .02, .15, 1.1); seg(a, MAT.woodD, V3(W/2 + .07, Y + H - .02, .15), V3(-1, 0, 0), .07, .005, .005, 3);
  for (let k=0;k<5;k++) a.add(new THREE.IcosahedronGeometry(.03, 1), k%2 ? MAT.marigold : MAT.marigoldY, at(W/2 + .12 + Math.cos(k*1.3)*.035, .06 + (k === 4 ? .035 : 0), -.1 + Math.sin(k*1.3)*.035));
  diya(a, W/2 + .09, .05, -.02, 1, g, .2); diya(a, .08, .05, W/2 + .09, 1);
  a.into(g);
}
function pathshala(g){
  const a = new Acc(), W = .74, D = .5, H = .44;
  slab(a, MAT.stoneD, W + .12, .06, D + .34, 0, 0, .08);
  slab(a, MAT.yellow, W, H, D, 0, .06, -.06); slab(a, MAT.lime, W + .004, .08, D + .004, 0, .06, -.06);
  slab(a, MAT.maroon, W + .12, .04, D + .36, 0, .06 + H, .06);
  for (let i=0;i<5;i++){ const x = -W/2 + .04 + i*(W - .08)/4; seg(a, MAT.white, V3(x, .06, D/2 + .16), _up, H, .022, .022, 8); }
  for (let i=0;i<4;i++) { const x = -W/2 + .04 + (i + .5)*(W - .08)/4; a.add(archGeo(.14, .1, .01).rotateZ(Math.PI), MAT.white, at(x, .06 + H, D/2 + .15)); }
  arch(a, 'z', D/2 - .06, -.18, .06, .16, .28, MAT.maroon, MAT.door); arch(a, 'z', D/2 - .06, .14, .18, .14, .18, MAT.maroon, MAT.glow);
  arch(a, 'x', W/2, -.06, .18, .12, .18, MAT.maroon, MAT.turq);
  const yP = .1 + H; slab(a, MAT.yellow, W + .12, .06, .04, 0, yP, D/2 + .22); slab(a, MAT.yellow, .04, .06, D + .36, W/2 + .04, yP, .06);
  dome(a, MAT.white, .1, -.18, yP, -.12, 1); a.add(new THREE.ConeGeometry(.014, .06, 6), MAT.gold, at(-.18, yP + .15, -.12));
  // low reading desks (blank) on the veranda
  for (const x of [-.2, .06]) { slab(a, MAT.wood, .16, .03, .09, x, .06 + .06, D/2 + .02); a.add(bx(.12, .012, .08), MAT.lime, at(x, .06 + .1, D/2 + .02, 0, 1, 1, 1, -.4)); }
  bell(a, W/2 - .04, .06 + H - .01, D/2 + .16, 1.2);
  diya(a, W/2 + .02, .06, D/2 + .3, 1, g, .2);
  a.into(g);
}

/* ── the ring-1 hero building: a sandstone ghat temple on a stepped plinth, steps running down to the river on the +x side ── */
function ghatTemple(g){
  const a = new Acc();
  slab(a, MAT.stoneD, 1.84, .08, 1.84); slab(a, MAT.stone, 1.62, .08, 1.62, -.06, .08);
  for (let i=0;i<4;i++) slab(a, i%2 ? MAT.stone : MAT.stoneD, .08, .16 - i*.04, 1.5, .78 + i*.07, .0);    // steps toward the river
  const Y = .16, sx = -.3, sz = -.2;
  slab(a, MAT.stoneR, .78, .56, .78, sx, Y); slab(a, MAT.redD, .84, .05, .84, sx, Y); slab(a, MAT.whiteD, .84, .045, .84, sx, Y + .5);
  for (const [px, pz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) slab(a, MAT.redD, .09, .56, .09, sx + px*.37, Y, sz + pz*.37);
  arch(a, 'x', .39, -sz, Y + .04, .22, .38, MAT.whiteD, MAT.glow, sx, 0);
  arch(a, 'z', .39, 0, Y + .14, .14, .22, MAT.whiteD, MAT.redD, sx, sz);
  shikhara(a, sx, sz, Y + .56, .76, 9, .125, MAT.stoneR, MAT.redD);
  // mandapa with a stepped roof and bells, open to the river
  const mx = .3, mz = .25, my = Y;
  for (const [px, pz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) { const p = V3(mx + px*.2, my, mz + pz*.22);
    slab(a, MAT.whiteD, .07, .04, .07, p.x, my, p.z); seg(a, MAT.white, p.clone().setY(my + .04), _up, .36, .024, .024, 8); slab(a, MAT.whiteD, .08, .04, .08, p.x, my + .4, p.z); }
  slab(a, MAT.white, .54, .05, .6, mx, my + .44, mz); slab(a, MAT.saffron, .56, .02, .62, mx, my + .49, mz);
  for (let i=0;i<4;i++) slab(a, i%2 ? MAT.whiteD : MAT.white, .44 - i*.1, .05, .5 - i*.12, mx, my + .51 + i*.05, mz);
  a.add(new THREE.SphereGeometry(.035, 8, 6), MAT.gold, at(mx, my + .75, mz));
  for (const z of [-.08, .08]) bell(a, mx + .12, my + .4, mz + z, 1.1);
  garland(a, V3(mx + .2, my + .42, mz - .22), V3(mx + .2, my + .42, mz + .22), .08, 14);
  garland(a, V3(sx + .4, Y + .45, sz - .15), V3(sx + .4, Y + .45, sz + .15), .04, 8);
  // diyas along the plinth edge and down the steps
  for (let i=0;i<9;i++) diya(a, -.82 + i*.2, .16, .74, 1, i%2 ? g : null, .18);
  for (const z of [-.5, -.2, .1, .4]) { diya(a, .78, .16, z, 1, g, .16); diya(a, .92, .08, z + .1, .9); }
  for (const [x, z] of [[-.78, .74], [.66, -.74]]) for (let k=0;k<5;k++) a.add(new THREE.IcosahedronGeometry(.035, 1), k%2 ? MAT.marigold : MAT.marigoldY, at(x + Math.cos(k*1.3)*.04, .1 + (k===4 ? .04 : 0), z + Math.sin(k*1.3)*.04));
  matka(a, -.74, .16, -.1, .9, MAT.brass); matka(a, -.74, .16, .08, .75);
  const dg = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFB050, transparent:true, opacity:.75, blending:THREE.AdditiveBlending, depthWrite:false }));
  dg.position.set(sx + .44, Y + .2, 0); dg.scale.setScalar(.55); dg.renderOrder = 9; g.add(dg);
  a.into(g);
}

/* ── Gita hero: the grand aarti platform — five wooden takhts under saffron umbrellas, tiered brass lamps, a bell frame,
   sky lamps (akash deep) in baskets on tall bamboo poles, conch-free and idol-free ── */
function aartiPlatform(g){
  const a = new Acc(), glowHost = g;
  slab(a, MAT.stoneD, 1.86, .07, 1.86); slab(a, MAT.stone, 1.7, .07, 1.7, -.03, .07);
  for (let i=0;i<3;i++) slab(a, i%2 ? MAT.stone : MAT.stoneD, .08, .12 - i*.04, 1.6, .84 + i*.07, .0);
  const Y = .14;
  // five takhts in a row facing the river, each with a tall tiered brass lamp
  const takht = (x, z, big) => {
    const w = big ? .34 : .26;
    slab(a, MAT.woodD, w, .09, w, x, Y, z); slab(a, big ? MAT.saffron : MAT.maroon, w + .02, .016, w + .02, x, Y + .09, z);
    const ly = Y + .106; cyl(a, MAT.brass, .045, .035, .025, x, ly, z, 10); seg(a, MAT.brass, V3(x, ly, z), _up, big ? .42 : .32, .011, .009, 6);
    const tiers = big ? 4 : 3;
    for (let t=0;t<tiers;t++){ const ry = ly + .1 + t*.075, rr = (tiers - t)*.036 + .01;
      a.add(new THREE.TorusGeometry(rr, .007, 4, 14).rotateX(Math.PI/2), MAT.brass, at(x, ry, z));
      const n = 4 + (tiers - t)*2; for (let k=0;k<n;k++){ const ang = k/n*Math.PI*2; a.add(new THREE.SphereGeometry(.015, 6, 4), FLAME[(k + t) % 3], at(x + Math.cos(ang)*rr, ry + .018, z + Math.sin(ang)*rr, 0, 1, 1.8, 1)); } }
    a.add(new THREE.SphereGeometry(.022, 6, 4), FLAME[0], at(x, ly + (big ? .44 : .34), z, 0, 1, 1.8, 1));
    const sp = new THREE.Sprite(GLOW[Math.abs(Math.round(z*10)) % 3]); sp.position.set(x, ly + .22, z); sp.scale.setScalar(big ? .75 : .5); sp.renderOrder = 9; glowHost.add(sp);
    for (const d of [-1, 1]) diya(a, x + w/2 - .04, Y + .106, z + d*(w/2 - .05), .7);
  };
  for (const [z, big] of [[-.7, 0], [-.35, 0], [0, 1], [.35, 0], [.7, 0]]) takht(.48, z, big);
  // a grand canopy over the central takht: four bamboo poles, saffron roof with a frill, a gold finial, hanging bells
  const cx = .42, cz = 0, ch = .92;
  for (const [px, pz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) { seg(a, MAT.bamboo, V3(cx + px*.26, Y, cz + pz*.26), _up, ch, .014, .012, 6); garland(a, V3(cx + px*.26, Y + ch - .02, cz + pz*.26), V3(cx + px*.26, Y + .12, cz + pz*.26), 0, 12); }
  slab(a, MAT.maroon, .6, .03, .6, cx, Y + ch, cz);
  a.add(new THREE.ConeGeometry(.44, .26, 4, 1), MAT.saffron, at(cx, Y + ch + .16, cz, Math.PI/4));
  for (let i=0;i<16;i++){ const t = i/16, side = Math.floor(t*4), u = (t*4 - side)*.6 - .3; const [x, z] = [[u, .3], [.3, -u], [-u, -.3], [-.3, u]][side];
    a.add(new THREE.ConeGeometry(.03, .06, 3).rotateX(Math.PI), i%2 ? MAT.marigold : MAT.lime, at(cx + x, Y + ch - .03, cz + z)); }
  a.add(new THREE.SphereGeometry(.04, 8, 6), MAT.gold, at(cx, Y + ch + .32, cz)); a.add(new THREE.ConeGeometry(.02, .1, 8), MAT.gold, at(cx, Y + ch + .4, cz));
  flagOn(a, cx - .05, Y + ch + .3, cz - .05, .32, -.6);
  for (const [x, z] of [[-.2, -.2], [.2, .2], [-.2, .2], [.2, -.2]]) bell(a, cx + x, Y + ch - .01, cz + z, 1.2);
  // bell frame across the back, with a garland
  const bz = -.74, bx0 = -.76, bx1 = .2;
  for (const x of [bx0, bx1]) seg(a, MAT.woodD, V3(x, Y, bz), _up, .66, .018, .016, 6);
  seg(a, MAT.wood, V3(bx0, Y + .66, bz), V3(1, 0, 0), bx1 - bx0, .014, .014, 6);
  for (let i=0;i<5;i++) bell(a, bx0 + .12 + i*(bx1 - bx0 - .24)/4, Y + .65, bz, 1.5 - (i%2)*.35);
  garland(a, V3(bx0, Y + .62, bz + .02), V3(bx1, Y + .62, bz + .02), .1, 20);
  // sky lamps (akash deep): tall bamboo poles with a glowing basket
  for (const [x, z, h] of [[-.8, .72, 1.25], [-.2, -.82, 1.45], [-.84, -.3, 1.1]]) {
    seg(a, MAT.bamboo, V3(x, Y, z), _up, h, .014, .01, 5); seg(a, MAT.bamboo, V3(x, Y + h - .04, z), V3(1, 0, 1), .1, .006, .006, 4);
    const lx = x + .07, ly = Y + h - .14, lz = z + .07; seg(a, MAT.rope, V3(lx, ly + .1, lz), _up, .06, .003, .003, 3);
    a.add(new THREE.CylinderGeometry(.06, .045, .09, 8, 1, true), MAT.strawD, at(lx, ly + .045, lz)); a.add(new THREE.SphereGeometry(.03, 6, 5), FLAME[1], at(lx, ly + .06, lz));
    const sp = new THREE.Sprite(GLOW[2]); sp.position.set(lx, ly + .05, lz); sp.scale.setScalar(.4); sp.renderOrder = 9; glowHost.add(sp); }
  // flower heaps, pots and a row of diyas down to the water
  for (let i=0;i<8;i++) diya(a, .9, .12 - (i%2)*.04, -.7 + i*.2, 1, i%2 ? null : glowHost, .16);
  for (let i=0;i<6;i++) diya(a, -.72 + i*.18, Y, .8, .9);
  for (const [x, z] of [[-.3, .3], [-.45, -.4], [.0, .62]]) for (let k=0;k<6;k++) a.add(new THREE.IcosahedronGeometry(.032, 1), [MAT.marigold, MAT.marigoldY, MAT.rose][k%3], at(x + Math.cos(k*1.2)*.045, Y + .02 + (k===5 ? .035 : 0), z + Math.sin(k*1.2)*.045));
  matka(a, -.5, Y, .1, .8, MAT.brass); matka(a, -.38, Y, .2, .65, MAT.brass);
  a.into(g);
}

/* ── water (Breathe): moored boats, a stepped kund, a hand pump, beached boats, kites on the sand ── */
function hullGeo(len=.62, beam=.16, depth=.09){
  const gm = new THREE.CylinderGeometry(beam, beam, len, 12, 6, false, 0, Math.PI).rotateZ(-Math.PI/2), p = gm.attributes.position;
  for (let i=0;i<p.count;i++){ const x = p.getX(i), t = Math.min(1, Math.abs(x)/(len/2)); let y = p.getY(i), z = p.getZ(i);
    z *= 1 - t*t*.88; y = y*(depth/beam)*(1 - t*t*.5) + t*t*.05; p.setXYZ(i, x, y, z); }
  gm.computeVertexNormals(); return gm;
}
const HULL = hullGeo(), HULL_S = hullGeo(.5, .13, .075);
const HULLM = [FM(0x3F6FB0, { side:THREE.DoubleSide }), FM(0xC9463C, { side:THREE.DoubleSide }), FM(0x2E9C88, { side:THREE.DoubleSide }), FM(0xE3A33A, { side:THREE.DoubleSide })];
function boat(a, x, y, z, ry, col=0, canopy=false, small=false, tilt=0){
  const L = small ? .5 : .62, B = small ? .13 : .16;
  a.add(small ? HULL_S : HULL, HULLM[col % 4], at(x, y + (small ? .075 : .09), z, ry, 1, 1, 1, tilt));
  const s = Math.sin(ry), c = Math.cos(ry), P = (u, v, h) => [x + u*c + v*s, y + h, z - u*s + v*c];
  a.add(bx(L*.82, .012, B*1.6), MAT.woodL, at(...P(0, 0, (small ? .075 : .09) + .005), ry, 1, 1, 1, tilt));   // gunwale rim / deck
  for (const u of [-.14, .08]) a.add(bx(.03, .02, B*1.7), MAT.wood, at(...P(u, 0, (small ? .075 : .09) + .015), ry));
  if (canopy) { for (const [u, v] of [[-.12,-.07],[.12,-.07],[-.12,.07],[.12,.07]]) seg(a, MAT.bamboo, V3(...P(u, v, .1)), _up, .16, .006, .006, 4);
    a.add(bx(.3, .015, .2), MAT.clothY, at(...P(0, 0, .26), ry)); a.add(bx(.32, .03, .005), MAT.cloth, at(...P(0, .1, .245), ry)); }
  return P;
}
function mooredBoats(g, s){
  waterPatch(g, s); const a = new Acc(), W = TILE_TOP*0 + .025;
  seg(a, MAT.woodD, V3(-.2, W - .02, -.05), _up, .34, .016, .014, 6); seg(a, MAT.woodD, V3(-.2, W - .02, .3), _up, .3, .016, .014, 6);
  boat(a, .12, W - .03, -.16, .15, 0, true); boat(a, .18, W - .03, .24, -.1, 1, false, true);
  seg(a, MAT.rope, V3(-.2, W + .22, -.05), V3(1, -.5, -.3), .3, .004, .004, 3); seg(a, MAT.rope, V3(-.2, W + .2, .3), V3(1, -.5, -.2), .3, .004, .004, 3);
  // oars laid across
  for (const z of [-.24, -.08]) seg(a, MAT.woodL, V3(-.04, W + .11, z), V3(1, .05, 0), .34, .008, .008, 4);
  diya(a, .1, W + .105, -.16, .9, g, .16);
  a.into(g);
}
function kund(g){
  const a = new Acc(), T = .16;
  const ring = (s, y, h, mat, t=.07) => { slab(a, mat, s, h, t, 0, y, s/2 - t/2); slab(a, mat, s, h, t, 0, y, -s/2 + t/2); slab(a, mat, t, h, s - 2*t, s/2 - t/2, y); slab(a, mat, t, h, s - 2*t, -s/2 + t/2, y); };
  ring(.86, 0, T, MAT.stone, .1); ring(.88, T, .03, MAT.stoneD, .12);
  [[.66, .11], [.52, .07], [.4, .035]].forEach(([s, y], i) => ring(s, 0, y, i % 2 ? MAT.stoneD : MAT.stone, .07));
  slab(a, RIVER, .28, .03, .28, 0, 0);
  a.add(new THREE.CylinderGeometry(.05, .05, .01, 10), MAT.pad, at(.05, .035, -.04));
  for (let i=0;i<8;i++){ const ang = i/8*Math.PI*2; a.add(new THREE.SphereGeometry(.022, 6, 4), i%2 ? MAT.lotus : MAT.lotusD, at(-.05 + Math.cos(ang)*.02, .055, .05 + Math.sin(ang)*.02, -ang, .6, 1.6, .8, 0, .5)); }
  for (const [px, pz] of [[-1,-1],[1,-1]]) { const cx = px*.36, cz = pz*.36;
    for (const [qx, qz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) seg(a, MAT.white, V3(cx + qx*.05, T + .03, cz + qz*.05), _up, .15, .01, .01, 5);
    slab(a, MAT.white, .15, .02, .15, cx, T + .18, cz); dome(a, MAT.white, .07, cx, T + .2, cz); }
  for (const [x, z, y] of [[.26, .26, .11], [-.26, .26, .11], [.3, .36, T + .03], [-.3, .38, T + .03]]) diya(a, x, y, z, .9, g, .15);
  a.into(g);
}
function handPump(g){
  const a = new Acc();
  slab(a, MAT.stoneD, .5, .05, .5); slab(a, MAT.stone, .42, .02, .42, 0, .05); slab(a, RIVER, .2, .004, .16, .06, .07, .08);
  cyl(a, MAT.iron, .04, .035, .34, -.06, .07, -.06, 10); seg(a, MAT.iron, V3(-.06, .3, -.06), V3(1, 0, 1), .15, .012, .01, 6);
  seg(a, MAT.iron, V3(-.06, .41, -.06), V3(-1, .35, -1), .24, .01, .01, 5); a.add(new THREE.SphereGeometry(.03, 8, 6), MAT.iron, at(-.06, .43, -.06));
  matka(a, .1, .07, .1, .85, MAT.brass); matka(a, -.24, 0, .22, .8); matka(a, .24, 0, -.2, .7, MAT.clayD);
  a.add(new THREE.CylinderGeometry(.06, .05, .08, 10, 1, true), MAT.teal, at(.2, .11, .2));
  diya(a, -.2, .05, -.2, 1, g, .16);
  a.into(g);
}
function beachedBoat(g, s){
  const a = new Acc(), c = s.v || 0;
  boat(a, -.02, -.02, .02, .6 + c*.8, c + 2, false, false, .12);
  for (const [x, z, d] of [[.24, -.24, V3(-.3, .02, 1)], [.2, -.3, V3(-.2, .02, 1)]]) seg(a, MAT.woodL, V3(x, .015, z), d, .36, .008, .008, 4);
  seg(a, MAT.woodD, V3(-.3, 0, .3), _up, .18, .014, .012, 5); seg(a, MAT.rope, V3(-.3, .14, .3), V3(1, -.3, -.8), .28, .004, .004, 3);
  if (c) { a.add(new THREE.TorusGeometry(.08, .025, 5, 12).rotateX(Math.PI/2), MAT.rope, at(.28, .02, .26)); }
  else { matka(a, .28, 0, .28, .6); }
  a.into(g);
}
function kites(g){
  const a = new Acc();
  slab(a, MAT.sandD, .3, .015, .22, -.1, 0, .1);
  // charkhi (spool) + a kite leaning on it + one flying on its string
  seg(a, MAT.bamboo, V3(-.18, .03, .1), V3(1, 0, 0), .16, .01, .01, 4);
  for (const x of [-.16, -.04]) a.add(new THREE.TorusGeometry(.05, .008, 4, 10), MAT.woodD, at(x, .08, .1, Math.PI/2));
  a.add(new THREE.CylinderGeometry(.035, .035, .1, 10), MAT.clothP, at(-.1, .08, .1, 0, 1, 1, 1, 0, Math.PI/2));
  const kite = (x, y, z, s, m, ry, rx) => { const sh = new THREE.Shape(); sh.moveTo(0, .1); sh.lineTo(.08, 0); sh.lineTo(0, -.1); sh.lineTo(-.08, 0); sh.lineTo(0, .1);
    a.add(new THREE.ShapeGeometry(sh), m, at(x, y, z, ry, s, s, s, rx)); a.add(new THREE.ConeGeometry(.02*s, .05*s, 3), m, at(x, y - .12*s, z, ry)); };
  kite(.14, .12, -.1, 1, MAT.kite1, .8, -.9);
  seg(a, MAT.woodL, V3(.24, 0, .26), V3(-.1, 1, -.1), .82, .01, .007, 4);
  kite(.18, .98, .2, 1.1, MAT.kite2, .6, 0); garland(a, V3(-.08, .1, .1), V3(.17, .96, .2), .0, 24, [MAT.lime], .004);
  kite(-.26, .74, -.22, .9, MAT.kite3, .9, .2); garland(a, V3(-.12, .1, .1), V3(-.26, .72, -.22), .0, 18, [MAT.lime], .004);
  a.into(g);
}

/* ── To-dos: ghat umbrellas (the iconic bamboo chhatris over a wooden takht), lanes, a flower stall, rope-and-bell edges ── */
function umbrella(g, s){
  const a = new Acc(), v = s.v || 0, cols = [[MAT.straw, MAT.strawD], [MAT.straw, MAT.saffron]][v % 2];
  const base = new THREE.Mesh(G.path, MAT.stone); base.position.y = .0175; base.receiveShadow = true; g.add(base);
  slab(a, MAT.woodD, .46, .09, .36, .02, .035, .06); slab(a, MAT.clothB, .4, .012, .3, .02, .125, .06);
  seg(a, MAT.bamboo, V3(-.1, .035, -.08), V3(.06, 1, .05), .72, .016, .012, 6);
  a.add(new THREE.ConeGeometry(.42, .22, 16, 1, true), cols[0], at(-.06, .75, -.05)); a.add(new THREE.CylinderGeometry(.42, .42, .02, 16, 1, true), cols[1], at(-.06, .64, -.05)); a.add(new THREE.ConeGeometry(.025, .06, 6), MAT.strawD, at(-.06, .88, -.05));
  for (let i=0;i<8;i++){ const ang = i/8*Math.PI*2; seg(a, MAT.bamboo, V3(-.06, .79, -.05), V3(Math.cos(ang), -.35, Math.sin(ang)), .47, .004, .004, 3); }
  if (v === 0) { matka(a, .16, .135, .12, .55, MAT.brass); a.add(new THREE.CylinderGeometry(.05, .05, .012, 10), MAT.clothY, at(-.1, .135, .12)); }
  else { a.add(bx(.12, .012, .08), MAT.lime, at(-.06, .14, .1, .3)); for (let k=0;k<4;k++) a.add(new THREE.IcosahedronGeometry(.02, 0), k%2 ? MAT.marigold : MAT.marigoldY, at(.14 + k*.02, .14, .14)); }
  diya(a, .32, .035, .34, 1, g, .18);
  a.into(g); g.userData.ghostMode = 'marker';
}
const laneTex = (() => { const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(31);
  g.fillStyle = '#EAD3AC'; g.fillRect(0, 0, N, N);
  for (let y=0;y<4;y++) for (let x=0;x<3;x++){ const w = N/3, h = N/4, ox = y%2 ? w/2 : 0;
    g.fillStyle = `rgba(${150 + r()*40|0},${100 + r()*30|0},${60 + r()*20|0},.2)`; g.fillRect(x*w + ox + 2, y*h + 2, w - 4, h - 4);
    g.strokeStyle = 'rgba(110,70,40,.28)'; g.lineWidth = 2; g.strokeRect(x*w + ox + 2, y*h + 2, w - 4, h - 4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
const LANE = new THREE.MeshStandardMaterial({ color:0xF2DDB8, roughness:1, map:laneTex });
function lane(g, s){
  const m = new THREE.Mesh(G.path, s.sand ? MAT.sandD : LANE); m.position.y = .0175; m.receiveShadow = true; g.add(m);
  const a = new Acc(), v = s.v || 0;
  if (v === 0) {           // lamp post + pot stack
    seg(a, MAT.woodD, V3(-.32, .035, -.3), _up, .6, .016, .014, 6); a.add(new THREE.OctahedronGeometry(.06, 0), MAT.paper, at(-.26, .56, -.24, .4, 1, 1.25, 1));
    seg(a, MAT.woodD, V3(-.32, .62, -.3), V3(1, 0, 1), .09, .007, .007, 4);
    const sp = new THREE.Sprite(GLOW[0]); sp.position.set(-.26, .56, -.24); sp.scale.setScalar(.34); sp.renderOrder = 9; g.add(sp);
    matka(a, .1, .035, -.1, 1); matka(a, .26, .035, -.02, .8, MAT.clayD); matka(a, .16, .19, -.06, .65); diya(a, .28, .035, .3, 1, g, .18);
  } else if (v === 1) {    // takht platform on the sand with a folded cloth + petals
    slab(a, MAT.wood, .5, .1, .34, 0, .035, -.04); slab(a, MAT.clothG, .44, .012, .28, 0, .135, -.04);
    for (const [x, z] of [[-.22,-.18],[.22,-.18],[-.22,.1],[.22,.1]]) slab(a, MAT.woodD, .04, .035, .04, x, 0, z);
    a.add(bx(.14, .03, .1), MAT.clothY, at(.1, .15, -.04, .3)); matka(a, -.14, .15, -.06, .5, MAT.brass);
    for (let i=0;i<5;i++) a.add(new THREE.CylinderGeometry(.018, .018, .005, 6), i%2 ? MAT.marigold : MAT.marigoldY, at(-.3 + i*.14, .04, .3 - (i%2)*.06));
  } else {                 // flower stall: baskets of marigold garlands under a little awning
    for (const [x, z] of [[-.3,-.2],[.3,-.2]]) seg(a, MAT.bamboo, V3(x, .035, z), _up, .5, .012, .012, 5);
    for (let i=0;i<7;i++) a.add(bx(.1, .015, .3), i%2 ? MAT.clothP : MAT.lime, at(-.3 + i*.1, .52, -.08, 0, 1, 1, 1, -.35));
    slab(a, MAT.wood, .6, .12, .24, 0, .035, -.14);
    for (const x of [-.18, .02, .2]) { a.add(new THREE.CylinderGeometry(.08, .06, .06, 10, 1, true), MAT.strawD, at(x, .185, -.12));
      for (let k=0;k<6;k++) a.add(new THREE.IcosahedronGeometry(.026, 1), [MAT.marigold, MAT.marigoldY, MAT.rose][(k + (x*10|0)) % 3], at(x + Math.cos(k)*.035, .22 + (k === 5 ? .02 : 0), -.12 + Math.sin(k)*.035)); }
    garland(a, V3(-.3, .46, .02), V3(.3, .46, .02), .1, 18); garland(a, V3(-.3, .4, .02), V3(.3, .4, .02), .06, 16, [MAT.rose, MAT.marigoldY]);
    diya(a, .3, .035, .3, 1, g, .18);
  }
  a.into(g); g.userData.ghostMode = 'marker';
}
function ropeEdge(g, s){
  const a = new Acc();
  for (let i=0;i<=s.len;i++){ const u = i - s.len/2; const p = s.edge === 'w' ? V3(-.45, 0, u) : V3(u, 0, .45);
    seg(a, MAT.bamboo, p, _up, .44, .016, .014, 6); a.add(new THREE.SphereGeometry(.024, 8, 6), MAT.brass, at(p.x, .45, p.z)); diya(a, p.x + (s.edge === 'w' ? .06 : 0), 0, p.z + (s.edge === 'w' ? 0 : -.06), .9); }
  for (let i=0;i<s.len;i++){ const u0 = i - s.len/2, u1 = u0 + 1;
    const A = s.edge === 'w' ? V3(-.45, .42, u0) : V3(u0, .42, .45), B = s.edge === 'w' ? V3(-.45, .42, u1) : V3(u1, .42, .45);
    garland(a, A, B, .1, 16); garland(a, A.clone().setY(.34), B.clone().setY(.34), .06, 10, [MAT.rope], .01);
    const m = A.clone().lerp(B, .5); bell(a, m.x, .32, m.z, 1); }
  a.into(g);
  const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}

/* ── trees (Vocab): peepal, neem, banyan with aerial roots, banana, tulsi ── */
function kitTree(g, name, h, w, rot){ const t = KITCACHE.a && KITCACHE.a[name]; if (!t) return null; return addModel(g, name, fitScale(t, h, w), 0, .04, 0, rot, 'a'); }
function treeRing(a, r=.2, mat=MAT.stone){ a.add(new THREE.CylinderGeometry(r, r + .02, .05, 12), mat, at(0, .025, 0)); a.add(new THREE.TorusGeometry(r, .012, 4, 16).rotateX(Math.PI/2), MAT.saffron, at(0, .05, 0)); }
function tree(g, s){
  const a = new Acc(); treeRing(a, s.sand ? .16 : .22, s.sand ? MAT.sandD : MAT.stone);
  if (!s.sand) { diya(a, .2, .05, .12, 1, g, .16); for (let k=0;k<3;k++) seg(a, MAT.rope, V3(Math.cos(k*2.1)*.07, .05, Math.sin(k*2.1)*.07), _up, .22, .004, .004, 3); }
  if (s.banyan) { const r = rngFrom(s.x*5 + s.z); for (let k=0;k<9;k++){ const ang = k/9*Math.PI*2 + r()*.3, d = .28 + r()*.14, h = .55 + r()*.25;
    seg(a, MAT.woodD, V3(Math.cos(ang)*d, .04, Math.sin(ang)*d), _up, h, .012, .006, 4); } }
  a.into(g);
  kitTree(g, s.model || 'CommonTree_1', s.h || 1.3, s.wid || 1.02, (s.rot||0)*Math.PI/180);
}
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k]; const m = FM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }
function banana(g, s){
  const a = new Acc(), r = rngFrom(s.x*7 + s.z*3), lf = new Acc();
  treeRing(a, .2, MAT.sandD);
  for (const [x, z, k] of [[0, 0, 1], [-.17, .12, .65], [.15, -.12, .5]]) {
    const H = .62*k; seg(a, MAT.leafD, V3(x, .04, z), _up, H, .05*k, .035*k, 7);
    for (let i=0;i<7;i++){ const ang = i/7*Math.PI*2 + r()*.5, L = (.42 + r()*.12)*k, pg = new THREE.PlaneGeometry(.16*k, L, 1, 5).translate(0, L/2, 0), p = pg.attributes.position;
      for (let j=0;j<p.count;j++){ const y = p.getY(j), t = y/L; p.setXYZ(j, p.getX(j)*(1 - .6*t*t), y, -t*t*L*.55 + Math.abs(p.getX(j))*.3); }
      lf.add(pg, swayMat(i%2 ? 0x5DAA3C : 0x74BD48, 1, .05), at(x, .04 + H - .02, z, ang, 1, 1, 1, .5)); } }
  a.into(g); lf.into(g);
}
function tulsi(g){
  const a = new Acc();
  slab(a, MAT.stoneD, .42, .05, .42);
  slab(a, MAT.white, .32, .3, .32, 0, .05); slab(a, MAT.saffron, .36, .04, .36, 0, .35); slab(a, MAT.saffron, .34, .03, .34, 0, .05);
  slab(a, MAT.white, .28, .06, .28, 0, .39); for (const [x, z] of [[-1,-1],[1,-1],[1,1],[-1,1]]) a.add(new THREE.ConeGeometry(.03, .08, 4), MAT.saffron, at(x*.13, .49, z*.13, Math.PI/4));
  arch(a, 'z', .16, 0, .1, .1, .14, MAT.saffron, MAT.glow); arch(a, 'x', .16, 0, .1, .1, .14, MAT.saffron, MAT.black);
  diya(a, 0, .1, .15, .9, g, .2); diya(a, .15, .1, 0, .9);
  slab(a, MAT.soil, .24, .02, .24, 0, .44);
  const r = rngFrom(9); for (let i=0;i<22;i++){ const ang = r()*6.28, d = r()*.08, y = .47 + r()*.24;
    blob(a, i%3 ? MAT.leafD : MAT.leaf, V3(Math.cos(ang)*d*(1.2 - (y-.47)), y, Math.sin(ang)*d*(1.2 - (y-.47))), .04 - (y - .47)*.06, 1, 0, r); }
  for (let i=0;i<7;i++){ const ang = i*.9, y = .62 + (i%3)*.05; a.add(new THREE.ConeGeometry(.012, .06, 5), MAT.maroon, at(Math.cos(ang)*.06, y, Math.sin(ang)*.06)); }
  a.into(g);
}

/* ── Sudoku/Math: floating diya trails on the river (grow from 3 leaf-cup lamps to a glowing river of light), marigold beds ── */
const TRAIL = (() => { const out = []; for (let i=0;i<26;i++){ const t = i/25; out.push([.1 + Math.sin(t*5.2 + 1)*.24 + (i%3 - 1)*.06, -.46 + t*.92]); } return out; })();
const TRAIL_N = [0, 4, 8, 13, 19, 26];
function donaLamp(acc, host, x, y, z, s, k, glow){
  acc.add(new THREE.CylinderGeometry(.06*s, .036*s, .026*s, 8), MAT.dona, at(x, y + .01, z));
  acc.add(new THREE.TorusGeometry(.046*s, .012*s, 4, 10).rotateX(Math.PI/2), k % 2 ? MAT.marigold : MAT.marigoldY, at(x, y + .026*s, z));
  acc.add(new THREE.SphereGeometry(.018*s, 6, 5), FLAME[k % 3], at(x, y + .045*s, z, 0, 1, 1.9, 1));
  if (glow) { const sp = new THREE.Sprite(GLOW[k % 3]); sp.position.set(x, y + .05*s, z); sp.scale.setScalar(.26*s); sp.renderOrder = 9; host.add(sp); }
}
function fillTrail(host, s, stage){
  host.clear(); const st = Math.min(5, stage), a = new Acc(), r = rngFrom(s.z*17 + 3), y = RIVER_Y - TILE_TOP, flip = s.z % 2 ? -1 : 1;
  const n = TRAIL_N[st];
  for (let i=0;i<n;i++){ const [x, z] = TRAIL[i]; donaLamp(a, host, x + (r() - .5)*.03, y, z*flip + (r() - .5)*.03, st >= 4 ? 1.05 : 1, i, st >= 3 ? i % 3 === 0 : i === 0); }
  if (st >= 3) for (let i=0;i<st*3;i++) a.add(new THREE.CylinderGeometry(.016, .016, .004, 6), [MAT.marigold, MAT.marigoldY, MAT.rose][i%3], at(-.1 + r()*.5, y + .002, (r() - .5)*.9));
  if (st >= 5) { a.add(new THREE.CylinderGeometry(.07, .07, .008, 12), MAT.pad, at(.34, y, -.3*flip));
    for (let i=0;i<8;i++){ const ang = i/8*Math.PI*2; a.add(new THREE.SphereGeometry(.026, 6, 4), i%2 ? MAT.lotus : MAT.lotusD, at(.34 + Math.cos(ang)*.024, y + .03, -.3*flip + Math.sin(ang)*.024, -ang, .6, 1.6, .8, 0, .5)); } }
  if (a.m.size) a.into(host); host.userData.stage = stage;
}
function fillMarigold(host, s, stage){
  host.clear();
  const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 5), st = Math.min(stage, 5);
  for (let i=0;i<3;i++) for (let j=0;j<3;j++){
    const x = (i-1)*.27 + (r()-.5)*.04, z = (j-1)*.27 + (r()-.5)*.04, y = .07;
    if (st === 1) { for (let k=0;k<2;k++) a.add(new THREE.ConeGeometry(.02, .06, 4), MAT.leafL, at(x + (k ? .015 : -.015), y + .03, z, 0, 1, 1, .4, 0, k ? -.4 : .4)); continue; }
    const R = [0, 0, .06, .085, .1, .11][st];
    blob(a, MAT.leafD, V3(x, y + R*.7, z), R, .8, 0, r); blob(a, MAT.leaf, V3(x + .02, y + R*1.05, z - .01), R*.7, .8, 0, r);
    const nF = [0, 0, 0, 3, 5, 7][st];
    for (let k=0;k<nF;k++){ const ang = k/nF*Math.PI*2 + r(), d = R*(k === nF - 1 && st === 5 ? 0 : .7), fy = y + R*1.35 + (k === nF - 1 && st === 5 ? .03 : 0);
      if (st === 3 && k > 0) a.add(new THREE.SphereGeometry(.018, 6, 4), MAT.leafL, at(x + Math.cos(ang)*d, fy, z + Math.sin(ang)*d));
      else a.add(new THREE.IcosahedronGeometry(st === 5 ? .036 : .03, 1), k % 3 === 1 ? MAT.marigoldY : MAT.marigold, at(x + Math.cos(ang)*d, fy, z + Math.sin(ang)*d, 0, 1, .75, 1)); }
  }
  if (st >= 5) { const bk = new THREE.Group(), ba = new Acc(); ba.add(new THREE.CylinderGeometry(.08, .06, .06, 10, 1, true), MAT.strawD, at(0, .03, 0));
    for (let k=0;k<6;k++) ba.add(new THREE.IcosahedronGeometry(.03, 1), k%2 ? MAT.marigold : MAT.marigoldY, at(Math.cos(k)*.04, .065, Math.sin(k)*.04)); ba.into(bk); bk.position.set(.42, .07, .42); host.add(bk); }
  a.into(host); host.userData.stage = stage;
}

/* ── BLUEPRINT (own layout). River = column x=4, city x=0..3, sand bank x=5..6. Rings 6 / 14 / 20. ── */
const RIVER_X = 4;
const SLOTS = [
  // ring 1: ghat temple, two diya trails, moored boats, a ghat umbrella, a tulsi planter
  { id:'temple',  cat:'building', gate:'lesson',  name:'Ghat temple',  b:'ghatTemple', x:2, z:2, w:2, d:2 },
  { id:'diya4_3', cat:'crop', gate:'sudoku',     name:'Diya trail', kind:'trail', x:4, z:3, stages:5 },
  { id:'boats',   cat:'water', gate:'breathe',   name:'Moored boats', b:'moored', x:4, z:2 },
  { id:'umb3_4',  cat:'path', gate:'todos',      name:'Ghat umbrella', b:'umbrella', x:3, z:4, v:0 },
  { id:'tulsi',   cat:'tree', gate:'vocab',      name:'Tulsi planter', b:'tulsi', x:2, z:4 },
  { id:'diya4_4', cat:'crop', gate:'mathtricks', name:'Diya trail', kind:'trail', x:4, z:4, stages:5 },
  // ring 2
  { id:'haveli',  cat:'building', gate:'lesson', name:'Pink haveli', b:'house', o:{ wall:'pink', trim:'white', shutter:'turq', floors:3, w:.78, d:.72, pots:true, flag:true }, x:1, z:1 },
  { id:'bluehouse',cat:'building',gate:'lesson', name:'Blue house',  b:'house', o:{ wall:'blue', trim:'white', shutter:'maroon', floors:3, w:.68, d:.66, roof:'dome', seed:1 }, x:2, z:1 },
  { id:'umb3_1',  cat:'path', gate:'todos',      name:'Ghat umbrella', b:'umbrella', x:3, z:1, v:1 },
  { id:'diya4_1', cat:'crop', gate:'sudoku',     name:'Diya trail', kind:'trail', x:4, z:1, stages:5 },
  { id:'neem5_1', cat:'tree', gate:'vocab',      name:'Neem tree', b:'tree', model:'CommonTree_2', rot:120, h:1.2, sand:true, x:5, z:1 },
  { id:'shrine',  cat:'building', gate:'lesson', name:'Little shrine', b:'shrine', x:1, z:2 },
  { id:'kund',    cat:'water', gate:'breathe',   name:'Stepped kund', b:'kund', x:1, z:3 },
  { id:'peepal1_4',cat:'tree', gate:'vocab',     name:'Peepal tree', b:'tree', model:'CommonTree_1', rot:30, h:1.3, x:1, z:4 },
  { id:'beach5_2',cat:'water', gate:'breathe',   name:'Beached boat', b:'beached', v:0, x:5, z:2 },
  { id:'takht5_3',cat:'path', gate:'todos',      name:'Sandbank takht', b:'lane', v:1, sand:true, x:5, z:3 },
  { id:'mari5_4', cat:'crop', gate:'mathtricks', name:'Marigold bed', kind:'marigold', x:5, z:4, stages:5 },
  { id:'lane1_5', cat:'path', gate:'todos',      name:'Lantern lane', b:'lane', v:0, x:1, z:5 },
  { id:'diya4_5', cat:'crop', gate:'sudoku',     name:'Diya trail', kind:'trail', x:4, z:5, stages:5 },
  { id:'banana5_5',cat:'tree', gate:'chemistry', name:'Banana plants', b:'banana', x:5, z:5 },
  // ring 3
  { id:'aarti',   cat:'special', gate:'gita',    name:'Aarti platform', b:'aarti', x:2, z:5, w:2, d:2 },
  { id:'palace',  cat:'building', gate:'lesson', name:'Palace ghat', b:'palace', x:0, z:0 },
  { id:'yellowhouse',cat:'building',gate:'lesson',name:'Yellow house', b:'house', o:{ wall:'yellow', trim:'white', shutter:'indigo', floors:3, w:.72, d:.7, seed:2, cx:.14 }, x:1, z:0 },
  { id:'spire',   cat:'building', gate:'lesson', name:'Red temple', b:'shrine', big:true, x:2, z:0 },
  { id:'peepal3_0',cat:'tree', gate:'vocab',     name:'Peepal tree', b:'tree', model:'CommonTree_3', rot:200, h:1.25, x:3, z:0 },
  { id:'diya4_0', cat:'crop', gate:'mathtricks', name:'Diya trail', kind:'trail', x:4, z:0, stages:5 },
  { id:'neem6_0', cat:'tree', gate:'vocab',      name:'Neem tree', b:'tree', model:'CommonTree_2', rot:300, h:1.15, sand:true, x:6, z:0 },
  { id:'pump',    cat:'water', gate:'breathe',   name:'Hand pump', b:'pump', x:0, z:1 },
  { id:'pathshala',cat:'building',gate:'lesson', name:'Pathshala', b:'pathshala', x:0, z:2 },
  { id:'banyan',  cat:'tree', gate:'chemistry',  name:'Banyan tree', b:'tree', model:'CommonTree_5', rot:80, h:1.35, wid:1.1, banyan:true, x:0, z:4 },
  { id:'mint',    cat:'building', gate:'lesson', name:'Mint house', b:'house', o:{ wall:'mint', trim:'white', shutter:'maroon', floors:2, w:.72, d:.7, seed:1, jharokha:-.1 }, x:0, z:5 },
  { id:'stall',   cat:'path', gate:'todos',      name:'Flower stall', b:'lane', v:2, x:1, z:6 },
  { id:'diya4_6', cat:'crop', gate:'sudoku',     name:'Diya trail', kind:'trail', x:4, z:6, stages:5 },
  { id:'mari5_6', cat:'crop', gate:'sudoku',     name:'Marigold bed', kind:'marigold', x:5, z:6, stages:5 },
  { id:'mari6_1', cat:'crop', gate:'mathtricks', name:'Marigold bed', kind:'marigold', x:6, z:1, stages:5 },
  { id:'beach6_2',cat:'water', gate:'breathe',   name:'Beached boat', b:'beached', v:1, x:6, z:2 },
  { id:'mari6_4', cat:'crop', gate:'sudoku',     name:'Marigold bed', kind:'marigold', x:6, z:4, stages:5 },
  { id:'kites',   cat:'water', gate:'breathe',   name:'Kites on the sand', b:'kites', x:6, z:5 },
  { id:'rope1',   cat:'path', gate:'todos',      name:'Bell rope', b:'rope', x:0, z:2, edge:'w', len:2 },
  { id:'rope2',   cat:'path', gate:'todos',      name:'Bell rope', b:'rope', x:0, z:6, edge:'s', len:2 }
].map(s => ({ ...s, kind:s.kind || 'vns' }));
const ORDER = ['temple','diya4_3','boats','umb3_4','tulsi','diya4_4',
  'haveli','diya4_1','kund','beach5_2','peepal1_4','umb3_1','mari5_4','bluehouse','neem5_1','diya4_5','shrine','takht5_3','banana5_5','lane1_5',
  'aarti','diya4_0','palace','pump','rope1','peepal3_0','mari6_1','yellowhouse','beach6_2','diya4_6','pathshala','neem6_0','stall','mari5_6','spire','kites','banyan','mari6_4','mint','rope2'];
const BUILD = { ghatTemple, aarti:aartiPlatform, house:(g, s) => ghatHouse(g, s.o), palace, shrine, pathshala, moored:mooredBoats, kund, pump:handPump,
  beached:beachedBoat, kites, umbrella, lane, rope:ropeEdge, tree, banana, tulsi };

/* ── ground: sandstone ghat paving; the river + ghat steps + sand bank are env ── */
const TILE = { top:['#E9CFA2', '#F0DAB2'], side:'#CFA776', soilTop:'#B4845A', soilBot:'#5E3E26' };
function tileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(41);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  g.strokeStyle = 'rgba(140,95,50,.2)'; g.lineWidth = 3;
  for (const y of [N/2]) { g.beginPath(); g.moveTo(8, y); g.lineTo(N - 8, y); g.stroke(); }
  g.beginPath(); g.moveTo(N*.38, 8); g.lineTo(N*.38, N/2); g.moveTo(N*.7, N/2); g.lineTo(N*.7, N - 8); g.stroke();
  g.strokeStyle = 'rgba(140,95,50,.14)'; g.strokeRect(8, 8, N - 16, N - 16);
  for (let i=0;i<260;i++){ g.fillStyle = r() < .5 ? 'rgba(255,255,255,.5)' : 'rgba(120,70,30,.1)'; g.beginPath(); g.arc(r()*N, r()*N, .6 + r()*1.4, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const RIVER_Y = TILE_TOP + .025, STEP_X0 = RIVER_X - OFF - .58, STEP_W = .26, STEPS = 5, STEP_H = .026;
const riverTex = (() => { const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(8);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  for (let i=0;i<70;i++){ const x = r()*N, y = r()*N, w = 10 + r()*30; g.strokeStyle = `rgba(255,255,255,${.35 + r()*.4})`; g.lineWidth = 1.5 + r()*1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w/2, y - 3, x + w, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; })();
const RIVER_TOP = new THREE.MeshStandardMaterial({ color:0x4FA4C6, roughness:.12, metalness:0, emissive:0x173E4C, emissiveIntensity:.35, map:riverTex });
const sandTex = (() => { const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(13);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  for (let i=0;i<9;i++){ g.strokeStyle = 'rgba(170,120,60,.16)'; g.lineWidth = 3; g.beginPath(); for (let x=0;x<=N;x+=8){ const y = i*30 + 10 + Math.sin(x*.05 + i)*5; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  for (let i=0;i<200;i++){ g.fillStyle = r() < .5 ? 'rgba(255,255,255,.5)' : 'rgba(140,90,40,.12)'; g.fillRect(r()*N, r()*N, 1.5, 1.5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
const SANDBANK = new THREE.MeshStandardMaterial({ color:0xF1DDB0, roughness:1, map:sandTex });
function buildEnv(){
  const R = V.ring, h = R + .5, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const z0 = -h + .02, z1 = h - .02, len = z1 - z0, a = new Acc();
  // ghat steps on the city bank, down to the water (with saris drying on them)
  for (let i=0;i<STEPS;i++){ const x = STEP_X0 + i*STEP_W/STEPS, top = TILE_TOP + (STEPS - i)*STEP_H + .005;
    a.add(bx(STEP_W/STEPS + .005, top - TILE_TOP + .02, len), i%2 ? MAT.stoneD : MAT.stone, at(x + STEP_W/STEPS/2, TILE_TOP - .02 + (top - TILE_TOP + .02)/2, 0)); }
  const r = rngFrom(71 + R);
  const cl = [MAT.cloth, MAT.clothY, MAT.clothB, MAT.clothP, MAT.clothG];
  for (let i=0;i<R*3;i++){ const k = Math.floor(r()*3) + 1, x = STEP_X0 + k*STEP_W/STEPS + .03, top = TILE_TOP + (STEPS - k)*STEP_H + .006, z = z0 + .3 + r()*(len - .6);
    a.add(bx(.035, .004, .22 + r()*.12), cl[i % 5], at(x, top, z)); }
  for (let i=0;i<R*2;i++){ const k = Math.floor(r()*4), x = STEP_X0 + k*STEP_W/STEPS + .03, top = TILE_TOP + (STEPS - k)*STEP_H + .005, z = z0 + .2 + r()*(len - .4);
    if (r() < .5) diya(a, x, top, z, .8); else matka(a, x, top, z, .4, MAT.brass); }
  // river: a water slab from the foot of the steps to the sand bank, with its cross-section on the block faces
  const wx0 = STEP_X0 + STEP_W, wx1 = RIVER_X - OFF + .5 + (R >= 2 ? .12 : 0), ww = wx1 - wx0;
  const top = new THREE.Mesh(new THREE.BoxGeometry(ww, RIVER_Y - TILE_TOP + .03, len + .02), [RIVER, RIVER, RIVER_TOP, RIVER, RIVER, RIVER]);
  worldUV(top.geometry, wx0 + ww/2, 0);
  top.position.set(wx0 + ww/2, TILE_TOP - .03 + (RIVER_Y - TILE_TOP + .03)/2, 0); top.receiveShadow = true; env.add(top); V.riverTex = riverTex; riverTex.repeat.set(1, 1);
  for (const sz of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(ww, .5), RIVER); f.position.set(wx0 + ww/2, RIVER_Y - .25, sz*(h + .021)); f.rotation.y = sz > 0 ? 0 : Math.PI; env.add(f); }
  if (R === 1) { const f = new THREE.Mesh(new THREE.PlaneGeometry(len, .5), RIVER); f.position.set(h + .021, RIVER_Y - .25, 0); f.rotation.y = Math.PI/2; env.add(f); }
  // sand bank (x=5..6): a soft sand skin that meets the water on a low slope
  if (R >= 2) { const sx0 = wx1 - .06, sx1 = h - .02, sw = sx1 - sx0;
    const sb = new THREE.Mesh(new RoundedBoxGeometryLite(sw, .016, len), SANDBANK); sb.position.set(sx0 + sw/2, TILE_TOP + .008, 0); sb.receiveShadow = true; env.add(sb);
    sandTex.repeat.set(sw*.8, len*.8); }
  a.into(env); env.children.forEach(m => { if (m.isMesh) m.castShadow = false; });
}
function RoundedBoxGeometryLite(w, h, d){ return new THREE.BoxGeometry(w, h, d); }
/* river UVs in world units, so a piece's own water patch lines up with the river ripples exactly */
function worldUV(geo, ox, oz){ const p = geo.attributes.position, uv = geo.attributes.uv; for (let i=0;i<p.count;i++) uv.setXY(i, (p.getX(i) + ox)*.7, -(p.getZ(i) + oz)*.7); uv.needsUpdate = true; }
const PATCH = new THREE.MeshStandardMaterial({ color:0x4FA4C6, roughness:.12, metalness:0, emissive:0x173E4C, emissiveIntensity:.35, map:riverTex, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-4 });
/* a river piece carries its own cell of water (hidden in the ghost) so its pick card and sprite read as river */
function waterPatch(g, s){ const x0 = -.32, x1 = .5, geo = new THREE.PlaneGeometry(x1 - x0, 1).rotateX(-Math.PI/2).translate((x0 + x1)/2, 0, 0);
  worldUV(geo, RIVER_X - OFF, s.z - OFF); const m = new THREE.Mesh(geo, PATCH); m.position.y = RIVER_Y - TILE_TOP + .0005; m.receiveShadow = true; m.userData.ghostHide = true; g.add(m); }

/* decor: sparse grass + petals + the odd diya on empty city cells, dry grass on the bank, nothing on the river */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(23);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring || x === RIVER_X) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc(), bank = x > RIVER_X, y0 = p.y + (bank ? .016 : 0);
    const tuft = (n) => { for (let j=0;j<n;j++){ const ang = r()*6.28, d = .15 + r()*.3; addModel(grp, r() < .55 ? 'Grass_1' : 'Grass_2', .2*(.7 + r()*.5), p.x + Math.cos(ang)*d, y0, p.z + Math.sin(ang)*d, r()*6.28, 'farm'); } };
    const petals = (n) => { for (let j=0;j<n;j++) a.add(new THREE.CylinderGeometry(.018, .018, .005, 6), [MAT.marigold, MAT.marigoldY, MAT.rose][j%3], at(p.x + (r()-.5)*.8, y0 + .003, p.z + (r()-.5)*.8)); };
    if (!sl || sl === 'later') { tuft(bank ? 3 : 2); petals(bank ? 1 : 4);
      if (!bank && r() < .7) diya(a, p.x + (r()-.5)*.5, y0, p.z + (r()-.5)*.5, 1, grp, .2);
      if (!bank && r() < .5) matka(a, p.x + (r()-.5)*.5, y0, p.z + (r()-.5)*.5, .6, r() < .5 ? MAT.clay : MAT.brass);
      if (bank && r() < .6) blob(a, MAT.stoneD, V3(p.x + (r()-.5)*.5, y0 + .02, p.z + (r()-.5)*.5), .05, .6, 0, r);
      grp.userData.decor = 'meadow'; }
    else if (!placed.includes(sl.id) && AMBIENT()) { tuft(1); petals(2); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ── life: flickering flames, drifting ripples, a pigeon flock circling; on completion rowing boats, river dolphins, pigeons land ── */
function flicker(t){
  FLAME.forEach((m, i) => { const k = Math.sin(t*9.1 + i*2.1)*.5 + Math.sin(t*14.3 + i*4.7)*.3 + Math.sin(t*23 + i)*.2; m.emissiveIntensity = 1.7 + k*.35; });
  GLOW.forEach((m, i) => { m.opacity = .5 + .12*Math.sin(t*8.3 + i*2.6) + .06*Math.sin(t*17 + i); });
  riverTex.offset.set(t*.012, -t*.03);
}
function makePigeon(){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.035, 8, 6), MAT.grey, at(0, .045, 0, 0, .85, .85, 1.25));
  blob(a, MAT.teal, V3(0, .068, .032), .024, 1, 1);
  a.add(new THREE.ConeGeometry(.007, .018, 4).rotateX(Math.PI/2), MAT.rope, at(0, .066, .06));
  a.add(bx(.03, .006, .05), MAT.greyD, at(0, .05, -.055, 0, 1, 1, 1, -.3));
  for (const s of [-1, 1]) { a.add(new THREE.SphereGeometry(.02, 6, 4), MAT.greyD, at(s*.028, .05, -.005, 0, .3, .7, 1.3)); seg(a, MAT.clay, V3(s*.01, 0, 0), _up, .02, .003, .003, 3); }
  blob(a, MAT.black, V3(.016, .074, .048), .005); blob(a, MAT.black, V3(-.016, .074, .048), .005);
  a.into(g); return g;
}
function makeFlyer(){ const g = new THREE.Group(), a = new Acc(); a.add(new THREE.SphereGeometry(.03, 7, 5), MAT.grey, at(0, 0, 0, 0, .8, .8, 1.3)); a.into(g);
  const wg = new THREE.PlaneGeometry(.1, .05).rotateX(-Math.PI/2).translate(.05, 0, 0), w1 = new THREE.Mesh(wg, MAT.grey), w2 = new THREE.Mesh(wg, MAT.grey); w2.scale.x = -1; g.add(w1, w2); g.userData.w = [w1, w2]; return g; }
function makeRowBoat(col){
  const g = new THREE.Group(), a = new Acc(); boat(a, 0, 0, 0, Math.PI/2, col, col === 3); a.into(g);
  const rower = new Acc(); rower.add(new THREE.CylinderGeometry(.03, .045, .1, 8), MAT.lime, at(0, .14, -.14)); rower.add(new THREE.SphereGeometry(.028, 8, 6), MAT.clay, at(0, .215, -.14));
  rower.add(new THREE.CylinderGeometry(.034, .034, .012, 10), MAT.cloth, at(0, .24, -.14)); rower.into(g);
  const oars = []; for (const s of [-1, 1]) { const o = new THREE.Group(), oa = new Acc(); seg(oa, MAT.woodL, V3(0, 0, 0), V3(s, -.35, 0), .34, .007, .007, 4); oa.add(bx(.08, .006, .035), MAT.woodL, at(s*.3, -.11, 0)); oa.into(o); o.position.set(s*.12, .15, -.1); g.add(o); oars.push(o); }
  g.userData.oars = oars; return g;
}
function makeDolphin(){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.07, 10, 8), MAT.dolphin, at(0, 0, 0, 0, .75, .7, 2.1));
  a.add(new THREE.SphereGeometry(.05, 8, 6), MAT.dolphinB, at(0, -.02, .02, 0, .8, .55, 1.8));
  a.add(new THREE.ConeGeometry(.018, .16, 6).rotateX(Math.PI/2), MAT.dolphinB, at(0, -.005, .21));
  a.add(new THREE.ConeGeometry(.025, .05, 4), MAT.dolphin, at(0, .05, -.03, 0, .4, 1, 1.4, -.5));
  for (const s of [-1, 1]) a.add(new THREE.ConeGeometry(.02, .07, 4), MAT.dolphin, at(s*.06, -.03, .04, 0, .4, 1, 1, 1.2, s*1.1));
  a.add(new THREE.ConeGeometry(.035, .06, 4), MAT.dolphin, at(0, 0, -.17, 0, 1.9, .3, 1, -Math.PI/2));
  blob(a, MAT.black, V3(.035, .01, .12), .006); blob(a, MAT.black, V3(-.035, .01, .12), .006);
  a.into(g); return g;
}
const RES_SCALE = 1.5, RIVER_CX = RIVER_X - OFF + .12;
const PIGEON_AT = [[.85, 1.2, .95], [1.2, 1.3, .95], [2.3, 4.35, 0], [3.35, 5.15, .14], [5.3, 3.6, .016]];
function addFlock(){
  V.flock = []; for (let i=0;i<4;i++){ const f = makeFlyer(); f.scale.setScalar(1.3); f.userData.u = { ph:i*1.6, rad:.7 + V.ring*.35 + (i%2)*.2, h:1.5 + i*.12, sp:.28 + i*.03 }; world.add(f); V.flock.push(f); V.life.push(f); }
  moveFlock(2.1);
}
function moveFlock(t){ (V && V.flock || []).forEach(f => { const u = f.userData.u, a = t*u.sp + u.ph;
  f.position.set(-.6 + Math.cos(a)*u.rad, TILE_TOP + u.h + Math.sin(a*2.1)*.1, -.4 + Math.sin(a)*u.rad*.7); f.rotation.y = -a;
  const fl = Math.sin(t*16 + u.ph)*.7; f.userData.w[0].rotation.z = fl; f.userData.w[1].rotation.z = -fl; }); }
function moveResidents(t){
  const h = (V ? V.ring : 3) + .5 - .6;
  (V && V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'boat') { const span = 2*h, p = ((t*u.sp + u.ph) % 1 + 1) % 1, zz = u.dir > 0 ? -h + p*span : h - p*span;
      const z = e < 1 ? (u.dir > 0 ? -h - 1.2 : h + 1.2)*(1 - e) + u.z0*e : zz;
      r.obj.position.set(RIVER_CX + u.dx, RIVER_Y - .02 + Math.sin(t*2 + u.ph*6)*.006, z); r.obj.rotation.y = u.dir > 0 ? 0 : Math.PI;
      const fade = e < 1 ? 1 : Math.min(1, Math.min(p, 1 - p)*10); r.obj.scale.setScalar(RES_SCALE*.82*Math.max(.001, fade));
      const st = Math.sin(t*3.2 + u.ph*5); r.obj.userData.oars.forEach((o, i) => { o.rotation.x = st*.5; o.rotation.z = (i ? -1 : 1)*(.1 + Math.max(0, st)*.15); }); }
    else if (r.kind === 'dolphin') { const P = 5.5, p = (((t + u.ph)/P) % 1 + 1) % 1, jump = Math.min(1, p/.22), up = p < .22;
      const s = up ? Math.sin(jump*Math.PI) : 0;
      r.obj.position.set(RIVER_CX + u.dx, RIVER_Y - .1 + s*.28, u.z + (jump - .5)*.5*u.dir); r.obj.rotation.set(-(jump - .5)*2.2*u.dir, u.dir > 0 ? 0 : Math.PI, 0);
      r.obj.visible = e >= 1 ? up && s > .02 : true; if (e < 1) { r.obj.position.y = RIVER_Y - .1 + e*.3; r.obj.rotation.x = 0; } }
    else if (r.kind === 'pigeon') { const hop = Math.max(0, Math.sin(t*5 + u.ph)), fly = 1 - e;
      r.obj.position.set(u.at.x + Math.sin(t*.7 + u.ph)*.05 + fly*1.2, u.y + hop*hop*.025 + fly*1.8, u.at.z + Math.cos(t*.5 + u.ph)*.04 - fly*.8);
      r.obj.rotation.x = e >= 1 ? Math.max(0, Math.sin(t*1.3 + u.ph*3))*.5 : 0; }
  });
}
let _t = 0;
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.05))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(TILE_TOP + .5), 10, 0xFFF0B0, .6); res(); })); }
async function moveIn(walk){
  V.residentsIn = true; V.res = [];
  const add = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const groups = [
    async () => { const rs = [ add('boat', makeRowBoat(3), { dir:1, sp:.045, ph:.15, dx:.02, z0:-1.2 }), add('boat', makeRowBoat(0), { dir:-1, sp:.038, ph:.55, dx:.22, z0:1.3 }) ];
      if (walk) await arrive(rs, 2200); },
    async () => { const rs = [ add('dolphin', makeDolphin(), { dir:1, ph:-1.5, z:-.4, dx:.14 }), add('dolphin', makeDolphin(), { dir:-1, ph:-1.27, z:1.6, dx:.3 }) ];
      rs.forEach(r => r.obj.scale.setScalar(RES_SCALE)); if (walk) await arrive(rs, 1400); },
    async () => { const rs = PIGEON_AT.map(([x, z, yy], i) => { const o = makePigeon(); o.scale.setScalar(RES_SCALE); o.rotation.y = i*1.3 + .4;
        return add('pigeon', o, { at:cellPos(x, z), y:TILE_TOP + yy, ph:i*1.3 }); });
      if (walk) await arrive(rs, 1500); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length; moveResidents(_t || 2.1);
}

export default {
  id:'varanasi', name:'Varanasi ghats', title:'Your ghats',
  season:19, dates:'8–21 Jun', nextIn:14,
  kits:['farm', 'a'],
  kitDefs:{ farm:{ file:'assets/farm/farm.glb', flat:true } },
  families:{
    water:   { label:'boats, kunds & kites',       tag:'River' },
    building:{ label:'temples, havelis & pathshala', tag:'House' },
    path:    { label:'umbrellas, lanes & stalls',  tag:'Ghat' },
    crop:    { label:'diya trails & marigolds',    tag:'Grows' },
    tree:    { label:'peepal, neem & banyan',      tag:'Tree' },
    special: { label:'the aarti platform',         tag:'Special' }
  },
  slots:SLOTS, order:ORDER,
  ground:{ tile:TILE, tileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M3 20h18v-2H3z" fill="#5E9FB0"/><path d="M4 18h9v-2H6v-2H4z" fill="#C7A575"/><path d="M8 14V9h4v5z" fill="#D39A6A"/><path d="M10 3c-1.4 2-2 4-2 6h4c0-2-.6-4-2-6z" fill="#D39A6A"/><path d="M10 2.2v-1" stroke="#E3B34A" stroke-width="1.2"/><path d="M15.5 16.5c.4-1.2 1.2-2 2-2s1.6.8 2 2z" fill="#FFB020"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M8 120h112v-8H8z" opacity=".55"/><path d="M8 112h58v-10H20V92H8z"/><path d="M26 92V56h30v36z"/><path d="M41 12c-8 16-13 30-14 44h28c-1-14-6-28-14-44z"/><path d="M41 12V2l16 5-16 5z"/><path d="M62 92V70h20v22z" opacity=".85"/><path d="M78 104c4 6 26 6 32 0z"/><circle cx="96" cy="94" r="3"/></g>',
  album:{ image:'assets/varanasi/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#F7E6D4)' },
  css:'.phone[data-theme="varanasi"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#FBEEDD 56%,#EFD6C8 100%)}',
  ghost:{ color:'#FFFDF6', opacity:.42, emissive:.2, dash:'#FFFFFF', dashOpacity:.75 },

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'trail') { waterPatch(g, s);
      const host = new THREE.Group(); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillTrail(host, s, st); fillTrail(host, s, stage);
    } else if (s.kind === 'marigold') {
      const base = new THREE.Mesh(G.field, M.soil); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      const host = new THREE.Group(); host.scale.setScalar(1.15); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillMarigold(host, s, st); fillMarigold(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'marigold' ? 1.15 : 1,
  contact: s => s.kind === 'vns' && !['lane', 'rope', 'umbrella', 'moored'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.b === 'kund' || s.b === 'moored',
  decor,
  env: buildEnv,
  ambient(){ addFlock(); },
  tick(t){ _t = t; flicker(t); moveFlock(t); moveResidents(t); },

  residents:[ { id:'rowboat', name:'Rowing boats', n:2 }, { id:'dolphin', name:'River dolphins', n:2 }, { id:'pigeon', name:'Pigeons', n:5 } ],
  moveIn,
  residentThumb(d, thumbFor){
    return thumbFor('varanasi:'+d.id, () => { const o = d.id === 'rowboat' ? makeRowBoat(3) : d.id === 'dolphin' ? makeDolphin() : makePigeon();
      o.rotation.y = d.id === 'dolphin' ? .9 : .7; if (d.id === 'dolphin') o.rotation.x = -.3; return o; }, 168); },
  residentRig(d){
    const obj = d.id === 'rowboat' ? makeRowBoat(3) : d.id === 'dolphin' ? makeDolphin() : makePigeon();
    obj.scale.setScalar(RES_SCALE*(d.id === 'rowboat' ? .82 : 1)); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
