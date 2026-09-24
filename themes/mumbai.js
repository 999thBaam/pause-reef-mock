/* MUMBAI MONSOON (?theme=mumbai) — a wet city block in the rain. Own 7×7 blueprint (rings 6 / 14 / 20):
   glossy dark-wet paving with puddles, a chawl courtyard at the centre, art-deco blocks with eyebrow sunshades and rooftop
   water tanks, chai tapris, umbrella stalls and carts, gulmohar + coconut palms. The sea runs along the front-left (+z) edge
   (env: sea wall, tetrapods, rolling foam) and a local-train viaduct runs along the back-left (x=0) rim. Rain arrives in
   bursts on every drop (streaks + splash rings), never as a loop. Gita hero: a generic grand basalt sea arch (no text, not a
   replica) on the sea front at cells 0..1 × 5..6. Residents: a local train, crows, and a rainbow after the rain.
   Every piece is procedural flat-shaded three.js merged per material (Acc). Reused CC0 kit pieces only: two trees from the
   Quaternius Stylized Nature MegaKit (kit a) and grass tufts from the Quaternius farm kit. No new asset files. */
import * as THREE from 'three';
import { rngFrom, TEX, addSway, world, fx } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, OFF, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, seg, blob, _up } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';

/* ── materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.86, metalness:0, flatShading:true, ...o });
const MAT = {
  wet:FM(0x5B6672, { roughness:.32 }), wetD:FM(0x46505B, { roughness:.3 }), kerb:FM(0x9AA3AA, { roughness:.5 }), conc:FM(0xA7ADB2), concD:FM(0x7F868D),
  cream:FM(0xF4E8CF), creamD:FM(0xE2D2B2), peach:FM(0xF2B89A), mint:FM(0xA9D8C2), sky:FM(0x9CC7E3), lemon:FM(0xF3D98A), rose:FM(0xE8A3A8), lilac:FM(0xC4B5E0),
  ochre:FM(0xE3B866), sage:FM(0xB9CFA0), pinkW:FM(0xEBB3C0), white:FM(0xFBF7EE), whiteD:FM(0xE3DDD0),
  glass:FM(0x40546A, { roughness:.25 }), glow:FM(0xFFD89A, { emissive:0xFFA947, emissiveIntensity:.95 }), door:FM(0x3A5E8C), doorG:FM(0x3E8A6E), doorR:FM(0x9E3B3B),
  tile:FM(0xB5543A), tileD:FM(0x8E3E2A), tank:FM(0x2B2D33, { roughness:.6 }), tankB:FM(0x3E6FA8, { roughness:.6 }),
  wood:FM(0x8A5530), woodD:FM(0x5E3820), woodL:FM(0xB07A48), steel:FM(0xC9CED4, { roughness:.35, metalness:.4 }), iron:FM(0x3E454E, { roughness:.5, metalness:.3 }),
  basalt:FM(0xD6B57F), basaltD:FM(0xB08C58), basaltL:FM(0xE8CFA0), jali:FM(0x9C7A4A),
  tarpB:FM(0x2F7FD0, { side:THREE.DoubleSide }), tarpY:FM(0xF2B632, { side:THREE.DoubleSide }), tarpR:FM(0xD9443C, { side:THREE.DoubleSide }),
  cloth:FM(0xD8343C, { side:THREE.DoubleSide }), clothY:FM(0xF7C62E, { side:THREE.DoubleSide }), clothB:FM(0x3E7FD0, { side:THREE.DoubleSide }), clothP:FM(0xE86AA0, { side:THREE.DoubleSide }), clothG:FM(0x3FAE7A, { side:THREE.DoubleSide }), clothW:FM(0xF6F2E8, { side:THREE.DoubleSide }),
  umb1:FM(0xE8364F, { side:THREE.DoubleSide }), umb2:FM(0xF7B32B, { side:THREE.DoubleSide }), umb3:FM(0x2E86DE, { side:THREE.DoubleSide }), umb4:FM(0x8E5BD6, { side:THREE.DoubleSide }), umb5:FM(0x2FB38A, { side:THREE.DoubleSide }), umbK:FM(0x2A2A30, { side:THREE.DoubleSide }),
  clay:FM(0xC4683A), clayD:FM(0x9E4A26), brass:FM(0xE3B34A, { roughness:.38, metalness:.3 }), chai:FM(0xC98A4E), yellow:FM(0xF5C43A), black:FM(0x24252A),
  leaf:FM(0x4E9A3A), leafD:FM(0x3B7F2E), leafL:FM(0x79B84A), bark:FM(0x6B4A34), barkL:FM(0x8C6A4E), coco:FM(0x6FA03A), cocoB:FM(0x7A5230),
  gul:FM(0xE8452C), gulL:FM(0xF26A2E), gulY:FM(0xF7A23A),
  steelG:FM(0x3F6A7A, { roughness:.5, metalness:.2 }), rail:FM(0x8B8F96, { roughness:.4, metalness:.4 }),
  maroon:FM(0x8E2B35), trainY:FM(0xF1CE72), trainR:FM(0x5A5F66), paper:[FM(0xFFFFFF), FM(0xFFE27A), FM(0xFFB3C6), FM(0xA9D8F5), FM(0xB9EBC9)],
  crow:FM(0x26272C), crowG:FM(0x5D6068), beak:FM(0x3A3A3A), frog:FM(0x7CC24A), tetra:FM(0xB4B8BC), tetraD:FM(0x959A9F)
};
const LAMPM = FM(0xFFF1C4, { emissive:0xFFD27A, emissiveIntensity:1.2 });
const GLOWM = new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFC870, transparent:true, opacity:.5, blending:THREE.AdditiveBlending, depthWrite:false });

const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=12){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z)); }
function dome(acc, mat, r, x, y, z, sy=1, n=10){ acc.add(new THREE.SphereGeometry(r, n, 5, 0, Math.PI*2, 0, Math.PI/2), mat, at(x, y, z, 0, 1, sy, 1)); }
function archGeo(w, h, depth=.02){
  const s = new THREE.Shape(), r = w/2; s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled:false, curveSegments:8 });
}
/* a framed window on a wall face: 'z' = the +z face at z=half, 'x' = the +x face at x=half */
function win(a, face, half, u, y, w, h, fill, frame=MAT.white, cx=0, cz=0){
  if (face === 'z') { a.add(bx(w + .03, h + .03, .012), frame, at(cx + u, y + h/2, cz + half + .004)); a.add(bx(w, h, .014), fill, at(cx + u, y + h/2, cz + half + .008)); }
  else { a.add(bx(.012, h + .03, w + .03), frame, at(cx + half + .004, y + h/2, cz - u)); a.add(bx(.014, h, w), fill, at(cx + half + .008, y + h/2, cz - u)); }
}
function glowAt(host, x, y, z, s=.3, mat=GLOWM){ const sp = new THREE.Sprite(mat); sp.position.set(x, y, z); sp.scale.setScalar(s); sp.renderOrder = 9; host.add(sp); }
function tank(a, x, y, z, s=1, mat=MAT.tank){ cyl(a, mat, .07*s, .07*s, .12*s, x, y, z, 12); dome(a, mat, .07*s, x, y + .12*s, z, .35); cyl(a, mat, .02*s, .02*s, .02*s, x, y + .14*s, z, 8); }
function base(g, mat=MAT.wet){ const m = new THREE.Mesh(G.path, mat); m.position.y = .0175; m.receiveShadow = true; g.add(m); return m; }
function lampPost(a, host, x, z, h=.62, dir=V3(0, 0, -1)){
  seg(a, MAT.iron, V3(x, 0, z), _up, h, .014, .01, 6);
  seg(a, MAT.iron, V3(x, h - .01, z), V3(dir.x*.9, .25, dir.z*.9), .14, .008, .008, 4);
  const lx = x + dir.x*.13, lz = z + dir.z*.13; a.add(new THREE.SphereGeometry(.032, 8, 6), LAMPM, at(lx, h + .005, lz, 0, 1, .8, 1));
  a.add(new THREE.ConeGeometry(.04, .03, 8), MAT.iron, at(lx, h + .035, lz));
  if (host) glowAt(host, lx, h, lz, .34);
}

/* ── art-deco block: rounded +x+z corner, eyebrow sunshades that wrap the corner, porthole, stepped crown, rooftop tanks ── */
function roundedBody(W, D, H, R){ const s = new THREE.Shape(), x0 = -W/2, x1 = W/2, y0 = -D/2, y1 = D/2;
  s.moveTo(x0, y0); s.lineTo(x1 - R, y0); s.absarc(x1 - R, y0 + R, R, -Math.PI/2, 0, false); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0);
  return new THREE.ExtrudeGeometry(s, { depth:H, bevelEnabled:false, curveSegments:10 }).rotateX(-Math.PI/2); }
function deco(g, o){
  const a = new Acc(), W = o.w || .72, D = o.d || .7, F = o.floors || 3, FH = .25, R = .2, wall = MAT[o.wall], trim = MAT[o.trim || 'white'];
  slab(a, MAT.concD, W + .06, .05, D + .06);
  const H = F*FH; a.add(roundedBody(W, D, H, R), wall, at(0, .05, 0));
  a.add(roundedBody(W + .02, D + .02, .05, R + .01), trim, at(0, .05, 0));
  for (let f=0; f<F; f++){ const y = .05 + f*FH;
    const lit = (f + (o.seed||0)) % 3 === 1;
    // windows on both faces, glowing on some floors
    for (const u of [-W/2 + .12, -W/2 + .3]) win(a, 'z', D/2, u, y + .06, .12, .12, lit && u > -.2 ? MAT.glow : MAT.glass, trim);
    for (const u of [-.2, 0]) win(a, 'x', W/2, u, y + .06, .12, .12, !lit && u < -.1 ? MAT.glow : MAT.glass, trim);
    // eyebrow sunshades that wrap the rounded corner
    const ey = y + .2;
    a.add(bx(W - R, .014, .06), trim, at(-R/2, ey, D/2 + .03)); a.add(bx(.06, .014, D - R), trim, at(W/2 + .03, ey, -R/2));
    a.add(new THREE.CylinderGeometry(R + .06, R + .06, .014, 12, 1, false, 0, Math.PI/2), trim, at(W/2 - R, ey, D/2 - R));
    // curved corner balcony (floors 1+)
    if (f > 0) { a.add(new THREE.CylinderGeometry(R + .05, R + .05, .02, 12, 1, false, 0, Math.PI/2), trim, at(W/2 - R, y, D/2 - R));
      a.add(new THREE.CylinderGeometry(R + .055, R + .055, .07, 12, 1, true, 0, Math.PI/2), trim, at(W/2 - R, y + .045, D/2 - R)); }
  }
  // speed lines on the corner + a porthole
  const yT = .05 + H;
  a.add(new THREE.TorusGeometry(.045, .012, 5, 14), trim, at(-W/2 + .21, yT - .12 + (F > 3 ? 0 : 0), D/2 + .006));
  // door with a little canopy
  win(a, 'z', D/2, o.doorU ?? -W/2 + .21, .05, .13, .17, MAT[o.door || 'door'], trim);
  slab(a, trim, .2, .016, .08, o.doorU ?? -W/2 + .21, .25, D/2 + .03);
  // parapet + stepped crown over the corner
  a.add(roundedBody(W + .015, D + .015, .05, R), trim, at(0, yT, 0));
  const cx = o.crownU ?? -.08;
  for (let i=0;i<3;i++) slab(a, i % 2 ? trim : wall, .24 - i*.07, .08, .05, cx, yT + .05 + i*.08, D/2 - .03);
  seg(a, MAT.iron, V3(cx, yT + .29, D/2 - .03), _up, .12, .005, .004, 4);
  tank(a, -W/2 + .14, yT + .05, -D/2 + .14, 1, o.tank === 'b' ? MAT.tankB : MAT.tank); tank(a, -W/2 + .3, yT + .05, -D/2 + .13, .8);
  // pot plants on the corner balcony
  if (F > 2) for (const [x, z] of [[W/2 - .06, D/2 - .02], [W/2 - .02, D/2 - .1]]) { cyl(a, MAT.clay, .018, .024, .04, x, .05 + FH + .02, z, 7); blob(a, MAT.leaf, V3(x, .05 + FH + .08, z), .03, 1, 0); }
  a.into(g);
  glowAt(g, (o.doorU ?? -W/2 + .21), .22, D/2 + .08, .22);
}

/* ── chawl block: long balcony corridors on the +z face, doors in a row, laundry on the rails, Mangalore-tile roof ── */
function chawlBlock(g, o){
  const a = new Acc(), W = o.w, D = o.d, F = o.floors || 3, FH = .27, wall = MAT[o.wall], CZ = .13;
  slab(a, MAT.concD, W + .06, .05, D + CZ + .06, 0, 0, CZ/2);
  slab(a, wall, W, F*FH, D, 0, .05);
  const r = rngFrom(o.seed || 3), doors = [MAT.door, MAT.doorG, MAT.doorR, MAT.door];
  const nU = Math.max(2, Math.round(W/.22)), du = W/nU;
  for (let f=0; f<F; f++){ const y = .05 + f*FH;
    for (let i=0;i<nU;i++){ const u = -W/2 + du*(i + .5);
      if (i % 2 === 0) win(a, 'z', D/2, u, y + .02, .08, .17, doors[(i + f) % 4], MAT.whiteD);
      else win(a, 'z', D/2, u, y + .08, .09, .09, (r() < .35) ? MAT.glow : MAT.glass, MAT.whiteD); }
    for (const u of (D > .4 ? [-.1, .1] : [0])) win(a, 'x', W/2, u, y + .08, .09, .09, r() < .3 ? MAT.glow : MAT.glass, MAT.whiteD);
    if (f > 0) {           // corridor floor + railing
      slab(a, MAT.creamD, W, .025, CZ, 0, y - .012, D/2 + CZ/2);
      const n = Math.round(W/.06); for (let k=0;k<=n;k++) slab(a, MAT.iron, .008, .1, .008, -W/2 + k*W/n, y + .013, D/2 + CZ - .005);
      slab(a, MAT.iron, W, .012, .014, 0, y + .11, D/2 + CZ - .005);
      // laundry hung over the rail
      const cl = [MAT.cloth, MAT.clothY, MAT.clothB, MAT.clothP, MAT.clothG, MAT.clothW];
      for (let k=0;k<Math.max(2, W/.18|0);k++) if (r() < .7) a.add(bx(.06 + r()*.04, .08 + r()*.04, .006), cl[(k + f) % 6], at(-W/2 + .06 + r()*(W - .12), y + .07, D/2 + CZ + .004));
      // pot plant
      if (r() < .8) { const x = -W/2 + .05 + r()*(W - .1); cyl(a, MAT.clay, .016, .02, .035, x, y + .013, D/2 + CZ - .04, 7); blob(a, MAT.leaf, V3(x, y + .07, D/2 + CZ - .04), .026, 1, 0); }
    }
    slab(a, MAT.whiteD, W + .01, .018, D + .01, 0, y + FH - .018);
  }
  // pillars under the corridor
  for (let k=0;k<=2;k++) slab(a, MAT.creamD, .03, F*FH - .02, .03, -W/2 + .02 + k*(W - .04)/2, .05, D/2 + CZ - .02);
  // tile roof over block + corridor
  const yR = .05 + F*FH, RH = .17, s = new THREE.Shape(), z0 = -(D/2 + .05), z1 = D/2 + CZ + .06;
  s.moveTo(-z1, 0); s.lineTo(-z0, 0); s.lineTo(-(z0 + z1)/2, RH); s.lineTo(-z1, 0);
  const roof = new THREE.ExtrudeGeometry(s, { depth:W + .08, bevelEnabled:false }).rotateY(Math.PI/2).translate(-(W + .08)/2, 0, 0);
  a.add(roof, MAT.tile, at(0, yR, 0));
  for (let k=1;k<6;k++) { const t = k/6; a.add(bx(W + .085, .008, .012), MAT.tileD, at(0, yR + RH*(1 - Math.abs(t*2 - 1)) - .002, z0 + (z1 - z0)*t)); }
  if (o.tank) tank(a, W/2 - .14, yR + .02, (z0 + z1)/2 - .06, .9, MAT.tankB);
  a.into(g);
}
function chawlRow(g, s){ chawlBlock(g, { w:.78, d:.5, floors:3, wall:s.o.wall, seed:s.x*7 + s.z, tank:s.o.tank }); }
/* ring-1 hero: an L-shaped chawl around a wet courtyard (tap, handcart, washing line, a gate lamp) */
function chawlCourt(g){
  const back = new THREE.Group(); chawlBlock(back, { w:1.8, d:.5, floors:3, wall:'ochre', seed:5, tank:true }); back.position.set(0, 0, -.62); g.add(back);
  const wing = new THREE.Group(); chawlBlock(wing, { w:1.0, d:.46, floors:3, wall:'sage', seed:9 }); wing.rotation.y = Math.PI/2; wing.position.set(-.64, 0, .38); g.add(wing);
  const a = new Acc();
  slab(a, MAT.wet, 1.18, .02, 1.18, .3, 0, .33);
  // tap with colourful pots in a queue
  seg(a, MAT.iron, V3(.08, .02, .02), _up, .2, .012, .012, 6); seg(a, MAT.iron, V3(.08, .2, .02), V3(1, 0, 0), .06, .008, .008, 4);
  [MAT.umb1, MAT.umb3, MAT.umb2, MAT.umb5].forEach((m, i) => { const x = .16 + i*.1; cyl(a, m, .04, .05, .09, x, .02, .06, 10); cyl(a, m, .025, .03, .02, x, .11, .06, 8); });
  // washing line across the court
  for (const [x, z] of [[.1, .76], [.82, .2]]) seg(a, MAT.woodD, V3(x, .02, z), _up, .42, .01, .009, 5);
  const cl = [MAT.cloth, MAT.clothY, MAT.clothB, MAT.clothP, MAT.clothW];
  for (let i=0;i<5;i++){ const t = (i + .7)/6; a.add(new THREE.PlaneGeometry(.08, .1), cl[i], at(.1 + (.72)*t, .37, .76 - .56*t, -Math.PI/4 + Math.PI/2)); }
  seg(a, MAT.whiteD, V3(.1, .42, .76), V3(.72, 0, -.56), .91, .003, .003, 3);
  // handcart
  slab(a, MAT.woodL, .3, .03, .16, .66, .09, .72, .5); for (const s of [-1, 1]) a.add(new THREE.TorusGeometry(.055, .012, 5, 12), MAT.iron, at(.66 + s*.06, .075, .72 + s*.1, .5 + Math.PI/2));
  seg(a, MAT.woodL, V3(.52, .1, .8), V3(-1, -.15, .5), .2, .008, .008, 4);
  // gate lamp + a bicycle-less stand of umbrellas drying
  lampPost(a, g, .86, .86, .5, V3(-.7, 0, -.7));
  for (const [x, m] of [[.4, MAT.umb4], [.55, MAT.umbK]]) { a.add(new THREE.ConeGeometry(.1, .06, 8, 1, true), m, at(x, .1, .88, 0, 1, 1, 1, .3)); seg(a, MAT.iron, V3(x, .02, .86), V3(0, 1, .3), .1, .004, .004, 3); }
  a.into(g);
}

/* ── Irani café: dark-wood ground floor, striped awning, bentwood chairs + round tables on the pavement ── */
function cafe(g){
  const a = new Acc(), W = .72, D = .64;
  slab(a, MAT.concD, W + .06, .05, D + .06, 0, 0, -.05);
  slab(a, MAT.woodD, W, .3, D, 0, .05, -.06);
  for (const u of [-.2, .08]) win(a, 'z', D/2 - .06, u, .08, .2, .2, MAT.glow, MAT.wood);
  win(a, 'x', W/2, .02, .08, .22, .2, MAT.glow, MAT.wood);
  slab(a, MAT.cream, W, .3, D, 0, .35, -.06); slab(a, MAT.white, W + .02, .02, D + .02, 0, .35, -.06);
  for (const u of [-.2, 0, .2]) win(a, 'z', D/2 - .06, u, .42, .1, .14, MAT.glass, MAT.doorG);
  for (const u of [-.1, .14]) win(a, 'x', W/2, u, .42, .1, .14, MAT.glass, MAT.doorG);
  slab(a, MAT.white, W + .04, .06, D + .04, 0, .65, -.06); tank(a, -.2, .71, -.2, .9);
  // striped awning on both street faces
  for (let i=0;i<8;i++) a.add(bx(W/8, .012, .16), i % 2 ? MAT.white : MAT.tarpR, at(-W/2 + W/16 + i*W/8, .33, D/2 - .06 + .07, 0, 1, 1, 1, .35));
  for (let i=0;i<7;i++) a.add(bx(.16, .012, D/7), i % 2 ? MAT.white : MAT.tarpR, at(W/2 + .07, .33, -D/2 - .06 + D/14 + i*D/7, 0, 1, 1, 1, 0, -.35));
  // two tables with bentwood chairs
  for (const [x, z] of [[-.16, .38], [.4, .06]]) {
    cyl(a, MAT.iron, .008, .008, .1, x, 0, z, 5); cyl(a, MAT.white, .06, .06, .012, x, .1, z, 12); cyl(a, MAT.chai, .012, .01, .02, x + .02, .112, z, 6);
    for (const d of [-1, 1]) { const cx = x + d*.1, cz = z; cyl(a, MAT.woodD, .03, .03, .01, cx, .065, cz, 10);
      for (const [lx, lz] of [[-.02, -.02], [.02, .02], [-.02, .02], [.02, -.02]]) seg(a, MAT.woodD, V3(cx + lx, 0, cz + lz), _up, .065, .004, .004, 3);
      a.add(new THREE.TorusGeometry(.028, .005, 4, 10, Math.PI), MAT.woodD, at(cx + d*.03, .09, cz, Math.PI/2)); } }
  a.into(g); glowAt(g, .1, .2, .3, .4);
}
/* ── old library: basalt Gothic hall with pointed windows, a gable and a slim spire tower (no clock, no text) ── */
function library(g){
  const a = new Acc(), W = .72, D = .64;
  slab(a, MAT.basaltD, W + .08, .06, D + .08);
  slab(a, MAT.basalt, W, .58, D, 0, .06);
  for (const y of [.3, .62]) slab(a, MAT.basaltD, W + .02, .025, D + .02, 0, y);
  for (const [y, lit] of [[.1, 1], [.36, 0]]) {
    for (const u of [-.2, 0, .2]) { a.add(archGeo(.1, .18, .012), MAT.basaltL, at(u, y, D/2)); a.add(archGeo(.075, .15, .016), lit && u ? MAT.glow : MAT.glass, at(u, y + .01, D/2 + .002)); }
    for (const u of [-.14, .14]) { a.add(archGeo(.1, .18, .012), MAT.basaltL, at(W/2, y, -u, Math.PI/2)); a.add(archGeo(.075, .15, .016), !lit ? MAT.glass : MAT.glow, at(W/2 + .002, y + .01, -u, Math.PI/2)); }
  }
  // slate roof
  const s = new THREE.Shape(); s.moveTo(-D/2 - .04, 0); s.lineTo(D/2 + .04, 0); s.lineTo(0, .22); s.lineTo(-D/2 - .04, 0);
  a.add(new THREE.ExtrudeGeometry(s, { depth:W + .04, bevelEnabled:false }).rotateY(Math.PI/2).translate(-(W + .04)/2, 0, 0), MAT.steelG, at(0, .64, 0));
  // front gable
  const gs = new THREE.Shape(); gs.moveTo(-.16, 0); gs.lineTo(.16, 0); gs.lineTo(0, .2); gs.lineTo(-.16, 0);
  slab(a, MAT.basalt, .32, .64, .08, .12, .0, D/2 + .03); a.add(new THREE.ExtrudeGeometry(gs, { depth:.08, bevelEnabled:false }), MAT.basalt, at(.12, .64, D/2 - .01));
  a.add(archGeo(.14, .28, .012), MAT.basaltL, at(.12, .06, D/2 + .07)); a.add(archGeo(.1, .24, .016), MAT.door, at(.12, .06, D/2 + .073));
  a.add(new THREE.TorusGeometry(.05, .012, 5, 14), MAT.basaltL, at(.12, .46, D/2 + .075)); a.add(new THREE.CircleGeometry(.04, 12), MAT.glow, at(.12, .46, D/2 + .076));
  // spire tower at the back-left corner
  const tx = -W/2 + .11, tz = -D/2 + .11;
  slab(a, MAT.basalt, .22, .98, .22, tx, 0, tz); slab(a, MAT.basaltD, .25, .03, .25, tx, .98, tz);
  for (const [u, face] of [[0, 'z'], [0, 'x']]) { if (face === 'z') { a.add(archGeo(.07, .14, .012), MAT.glass, at(tx, .76, tz + .111)); } else a.add(archGeo(.07, .14, .012), MAT.glass, at(tx + .111, .76, tz, Math.PI/2)); }
  for (const [px, pz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) a.add(new THREE.ConeGeometry(.02, .1, 4), MAT.basaltD, at(tx + px*.1, 1.06, tz + pz*.1, Math.PI/4));
  a.add(new THREE.ConeGeometry(.12, .36, 8), MAT.steelG, at(tx, 1.19, tz, Math.PI/8)); a.add(new THREE.SphereGeometry(.018, 6, 5), MAT.brass, at(tx, 1.38, tz));
  a.into(g); glowAt(g, .12, .2, D/2 + .12, .3);
}

/* ── Gita hero: a grand basalt arch on the sea front — a big central arch and two side arches through a solid gate,
   jali band, four corner turrets with domes, steps down to the sea wall. Generic: no text, no crest, not a replica. ── */
function seaArch(g){
  const a = new Acc();
  slab(a, MAT.basaltD, 1.84, .06, 1.84); slab(a, MAT.basaltL, 1.64, .05, 1.5, 0, .06, -.1);
  for (let i=0;i<3;i++) slab(a, i % 2 ? MAT.basaltL : MAT.basaltD, 1.4 - i*.1, .08 - i*.025, .12, 0, .0, .72 + i*.06);    // steps to the sea
  const W = 1.34, H = .88, D = .64, Y = .11, Z = -.12;
  const s = new THREE.Shape(); s.moveTo(-W/2, 0); s.lineTo(W/2, 0); s.lineTo(W/2, H); s.lineTo(-W/2, H); s.lineTo(-W/2, 0);
  const hole = (cx, w, h) => { const p = new THREE.Path(), r = w/2; p.moveTo(cx - r, 0); p.lineTo(cx + r, 0); p.lineTo(cx + r, h - r); p.absarc(cx, h - r, r, 0, Math.PI, false); p.lineTo(cx - r, 0); return p; };
  s.holes.push(hole(0, .4, .64), hole(-.45, .16, .38), hole(.45, .16, .38));
  a.add(new THREE.ExtrudeGeometry(s, { depth:D, bevelEnabled:false, curveSegments:12 }), MAT.basalt, at(0, Y, Z - D/2));
  // arch rims on the sea face and the city face, pilasters, a cornice and a jali band
  for (const fz of [Z + D/2 + .004, Z - D/2 - .016]) {
    a.add(new THREE.TorusGeometry(.215, .026, 5, 18, Math.PI), MAT.basaltL, at(0, Y + .44, fz + .01));
    for (const x of [-.45, .45]) a.add(new THREE.TorusGeometry(.09, .016, 4, 12, Math.PI), MAT.basaltL, at(x, Y + .3, fz + .01));
    for (const x of [-.26, .26, -.64, .64]) slab(a, MAT.basaltL, .05, H - .1, .02, x, Y, fz + .01);
  }
  slab(a, MAT.basaltD, W + .08, .04, D + .08, 0, Y + H, Z);
  for (let i=0;i<14;i++) for (const fz of [Z + D/2 + .03, Z - D/2 - .03]) slab(a, MAT.jali, .045, .07, .012, -W/2 + .09 + i*(W - .18)/13, Y + H + .05, fz);
  slab(a, MAT.basalt, W, .14, D, 0, Y + H + .04, Z); slab(a, MAT.basaltD, W + .06, .03, D + .06, 0, Y + H + .18, Z);
  for (let i=0;i<11;i++) for (const fz of [Z + D/2, Z - D/2]) slab(a, MAT.basaltL, .05, .05, .04, -W/2 + .06 + i*(W - .12)/10, Y + H + .21, fz);
  // central low dome on a drum
  cyl(a, MAT.basalt, .2, .2, .08, 0, Y + H + .21, Z, 16); dome(a, MAT.basaltL, .21, 0, Y + H + .29, Z, .9, 14); a.add(new THREE.ConeGeometry(.02, .09, 8), MAT.brass, at(0, Y + H + .5, Z));
  // four corner turrets with domes
  for (const [px, pz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) { const x = px*(W/2 + .01), z = Z + pz*(D/2 + .01);
    cyl(a, MAT.basalt, .1, .09, H + .3, x, Y - .02, z, 8); slab(a, MAT.basaltD, .22, .03, .22, x, Y + H + .28, z);
    for (const [qx, qz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) seg(a, MAT.basaltL, V3(x + qx*.06, Y + H + .31, z + qz*.06), _up, .12, .012, .012, 5);
    slab(a, MAT.basaltD, .19, .025, .19, x, Y + H + .43, z); dome(a, MAT.basaltL, .1, x, Y + H + .455, z, 1.15, 10); a.add(new THREE.ConeGeometry(.012, .07, 6), MAT.brass, at(x, Y + H + .6, z)); }
  // lamp posts by the steps + two planters
  lampPost(a, g, -.8, .62, .62, V3(.5, 0, .5)); lampPost(a, g, .8, .62, .62, V3(-.5, 0, .5));
  for (const x of [-.6, .6]) { slab(a, MAT.basaltD, .14, .08, .14, x, .11, .42); blob(a, MAT.leaf, V3(x, .24, .42), .08, .9, 0); blob(a, MAT.gul, V3(x + .03, .29, .44), .03, 1, 0); }
  a.into(g);
  glowAt(g, 0, Y + .3, Z + D/2 + .05, .7);
}

/* ── To-dos: chai tapri, umbrella stall, vada pav cart, taxi stand, promenade lamps, the local-train viaduct ── */
function chaiStall(g){
  base(g); const a = new Acc();
  slab(a, MAT.wood, .46, .26, .24, -.04, .035, -.2); slab(a, MAT.woodL, .5, .025, .28, -.04, .295, -.2);
  slab(a, MAT.yellow, .46, .06, .01, -.04, .2, -.075);
  // stove + kettle + glasses on a tray
  cyl(a, MAT.iron, .05, .05, .04, .1, .32, -.2, 10); a.add(new THREE.SphereGeometry(.05, 10, 8), MAT.steel, at(.1, .4, -.2, 0, 1, .9, 1));
  a.add(new THREE.ConeGeometry(.012, .07, 6), MAT.steel, at(.16, .41, -.2, 0, 1, 1, 1, 0, -1.1)); seg(a, MAT.iron, V3(.06, .44, -.2), V3(1, .6, 0), .07, .004, .004, 3);
  slab(a, MAT.steel, .16, .008, .08, -.12, .32, -.16); for (let i=0;i<5;i++) cyl(a, MAT.chai, .012, .014, .035, -.18 + i*.03, .328, -.16 + (i % 2)*.02, 7);
  for (let i=0;i<3;i++) { cyl(a, MAT.whiteD, .03, .03, .07, -.2 + i*.07, .32, -.26, 9); cyl(a, MAT.yellow, .028, .028, .03, -.2 + i*.07, .33, -.26, 9); }
  // tarp roof on bamboo poles
  for (const [x, z, h] of [[-.3, -.34, .64], [.22, -.34, .64], [-.3, .16, .5], [.22, .16, .5]]) seg(a, MAT.woodL, V3(x, .035, z), _up, h, .01, .01, 5);
  a.add(bx(.62, .01, .6), MAT.tarpB, at(-.04, .6, -.09, 0, 1, 1, 1, .25));
  // bench + a banana bunch hanging
  slab(a, MAT.woodL, .44, .02, .09, -.02, .13, .26); for (const x of [-.2, .16]) slab(a, MAT.woodD, .02, .1, .07, x, .035, .26);
  seg(a, MAT.iron, V3(.18, .6, -.1), V3(0, -1, 0), .08, .003, .003, 3); for (let i=0;i<6;i++) a.add(new THREE.CapsuleGeometry(.012, .05, 2, 5), MAT.yellow, at(.18 + Math.cos(i)*.025, .47, -.1 + Math.sin(i)*.025, 0, 1, 1, 1, .4*Math.cos(i), .4*Math.sin(i)));
  a.into(g); glowAt(g, .1, .36, -.18, .32); g.userData.ghostMode = 'marker';
}
function umbrella(a, x, y, z, r, mat, rx=0, rz=0, stick=.22){
  a.add(new THREE.ConeGeometry(r, r*.45, 8, 1, true), mat, at(x, y, z, 0, 1, 1, 1, rx, rz));
  const dir = new THREE.Vector3(0, -1, 0).applyEuler(new THREE.Euler(rx, 0, rz)); seg(a, MAT.iron, V3(x, y + r*.22, z), dir, stick, .005, .005, 3);
  a.add(new THREE.TorusGeometry(.018, .004, 3, 8, Math.PI), MAT.woodD, at(x + dir.x*stick, y + r*.22 + dir.y*stick - .01, z + dir.z*stick, 0, 1, 1, 1, 0, Math.PI));
}
function umbrellaStall(g){
  base(g); const a = new Acc();
  // A-frame rack with open umbrellas
  for (const x of [-.3, .26]) { seg(a, MAT.woodL, V3(x, .035, -.26), V3(0, 1, .25), .5, .01, .01, 4); seg(a, MAT.woodL, V3(x, .035, .0), V3(0, 1, -.25), .5, .01, .01, 4); }
  seg(a, MAT.woodL, V3(-.3, .5, -.14), V3(1, 0, 0), .56, .008, .008, 4);
  [[MAT.umb1, -.22, .5], [MAT.umb2, -.02, .56], [MAT.umb3, .18, .5], [MAT.umb4, -.12, .34], [MAT.umb5, .1, .34]].forEach(([m, x, y], i) => umbrella(a, x, y, -.1 + (i > 2 ? .08 : 0), .13, m, .5, (i - 2)*.12, .16));
  // bucket of closed umbrellas + one big open umbrella on the pavement
  cyl(a, MAT.tankB, .06, .07, .1, .28, .035, .26, 10);
  [MAT.umbK, MAT.umb1, MAT.umb3, MAT.umb4].forEach((m, i) => { const ang = i*1.6; a.add(new THREE.ConeGeometry(.02, .22, 6), m, at(.28 + Math.cos(ang)*.025, .2, .26 + Math.sin(ang)*.025, 0, 1, 1, 1, Math.cos(ang)*.15, Math.sin(ang)*.15)); });
  umbrella(a, -.22, .4, .22, .2, MAT.umb2, -.3, .2, .36);
  a.into(g); g.userData.ghostMode = 'marker';
}
function vadaCart(g){
  base(g); const a = new Acc();
  slab(a, MAT.tarpB, .46, .18, .24, 0, .12, -.04); slab(a, MAT.steel, .5, .02, .28, 0, .3, -.04);
  for (const s of [-1, 1]) a.add(new THREE.TorusGeometry(.075, .014, 5, 14), MAT.iron, at(s*.16, .11, .1, 0));
  for (const s of [-1, 1]) a.add(new THREE.TorusGeometry(.075, .014, 5, 14), MAT.iron, at(s*.16, .11, -.18, 0));
  seg(a, MAT.iron, V3(-.25, .3, .05), V3(-1, .1, 0), .14, .008, .008, 4);
  // wok with golden balls, a glass case of buns, a gas cylinder
  a.add(new THREE.SphereGeometry(.09, 12, 6, 0, Math.PI*2, Math.PI/2, Math.PI/2), MAT.iron, at(.12, .41, -.06)); cyl(a, MAT.chai, .07, .07, .01, .12, .39, -.06, 12);
  for (let i=0;i<5;i++) a.add(new THREE.SphereGeometry(.022, 7, 5), MAT.yellow, at(.1 + Math.cos(i*1.3)*.035, .41, -.06 + Math.sin(i*1.3)*.035));
  slab(a, MAT.white, .16, .1, .12, -.12, .32, -.08); slab(a, FM(0xBFD9E6, { roughness:.2 }), .15, .09, .11, -.12, .325, -.08);
  for (let i=0;i<4;i++) slab(a, MAT.woodL, .045, .03, .045, -.16 + (i % 2)*.07, .33 + (i > 1 ? .035 : 0), -.1);
  cyl(a, MAT.tarpR, .04, .04, .14, .3, .035, .22, 10); dome(a, MAT.tarpR, .04, .3, .175, .22, .6);
  // striped umbrella
  seg(a, MAT.iron, V3(-.02, .3, -.2), _up, .44, .008, .008, 4);
  for (let i=0;i<8;i++) a.add(new THREE.ConeGeometry(.34, .14, 2, 1, true, i*Math.PI/4, Math.PI/4), i % 2 ? MAT.white : MAT.umb5, at(-.02, .79, -.2));
  a.into(g); glowAt(g, .12, .45, -.06, .26); g.userData.ghostMode = 'marker';
}
function taxiStand(g){
  base(g, MAT.wetD); const a = new Acc();
  // kerb + bollards
  slab(a, MAT.kerb, .96, .04, .08, 0, .035, -.44); for (const x of [-.3, .3]) cyl(a, MAT.yellow, .02, .02, .12, x, .035, -.36, 8);
  // a black-and-yellow taxi (rounded 60s saloon, no text)
  const T = new Acc(), Y0 = .07;
  T.add(new THREE.CapsuleGeometry(.1, .3, 3, 10).rotateZ(Math.PI/2), MAT.black, at(0, Y0 + .08, 0, 0, 1, .55, .95));
  T.add(new THREE.CapsuleGeometry(.08, .12, 3, 10).rotateZ(Math.PI/2), MAT.yellow, at(-.02, Y0 + .15, 0, 0, 1, .7, .95));
  for (const s of [-1, 1]) T.add(bx(.2, .05, .005), MAT.glass, at(-.02, Y0 + .16, s*.087));
  T.add(bx(.005, .05, .14), MAT.glass, at(.1, Y0 + .16, 0, 0, 1, 1, 1, 0, -.4));
  for (const [x, z] of [[-.14, -.09], [.14, -.09], [-.14, .09], [.14, .09]]) T.add(new THREE.CylinderGeometry(.04, .04, .03, 12).rotateX(Math.PI/2), MAT.iron, at(x, Y0 + .04, z));
  for (const s of [-1, 1]) T.add(new THREE.SphereGeometry(.018, 6, 5), LAMPM, at(.24, Y0 + .08, s*.05));
  slab(T, MAT.steel, .14, .012, .12, -.02, Y0 + .215, 0); for (const x of [-.08, .04]) slab(T, MAT.steel, .012, .03, .12, x, Y0 + .215, 0);
  const car = new THREE.Group(); T.into(car); car.rotation.y = .5; car.position.set(.02, 0, .08); g.add(car);
  a.into(g); g.userData.ghostMode = 'marker';
}
function promenade(g, s){
  const a = new Acc(), L = s.len;
  slab(a, MAT.conc, L, .07, .07, 0, 0, .47);
  const n = L*6; for (let k=0;k<=n;k++) seg(a, MAT.steel, V3(-L/2 + k*L/n, .07, .47), _up, .13, .006, .006, 4);
  for (const y of [.14, .2]) seg(a, MAT.steel, V3(-L/2, y, .47), V3(1, 0, 0), L, .006, .006, 4);
  for (let i=0;i<L;i++) lampPost(a, g, -L/2 + i + .5, .47, .74, V3(0, 0, -1));
  a.into(g);
  const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}
const BRIDGE_X = -.66, DECK_Y = .5;
function trainBridge(g, s){
  const a = new Acc(), L = s.len, x = BRIDGE_X;
  for (let i=0;i<L;i++){ const z = -L/2 + i + .5;
    slab(a, MAT.conc, .1, DECK_Y + .7, .12, x, -.7, z); slab(a, MAT.concD, .3, .06, .16, x, DECK_Y - .06, z); }
  slab(a, MAT.concD, .3, .05, L, x, DECK_Y, 0);
  // steel truss sides
  for (const sx of [-1, 1]) { const px = x + sx*.14;
    slab(a, MAT.steelG, .02, .02, L, px, DECK_Y + .05, 0); slab(a, MAT.steelG, .02, .02, L, px, DECK_Y + .16, 0);
    for (let k=0;k<L*4;k++){ const z0 = -L/2 + k/4, dir = k % 2 ? V3(0, .11, .25) : V3(0, .11, -.25); seg(a, MAT.steelG, V3(px, DECK_Y + .06, k % 2 ? z0 : z0 + .25), dir, .27, .007, .007, 3); } }
  // rails + sleepers
  for (const dx of [-.05, .05]) slab(a, MAT.rail, .012, .012, L, x + dx, DECK_Y + .05, 0);
  for (let k=0;k<L*8;k++) slab(a, MAT.woodD, .14, .008, .03, x, DECK_Y + .05, -L/2 + (k + .5)/8);
  // overhead line masts
  for (let i=0;i<=L;i++){ const z = -L/2 + i; seg(a, MAT.iron, V3(x - .15, DECK_Y + .05, z), _up, .42, .008, .008, 4); seg(a, MAT.iron, V3(x - .15, DECK_Y + .44, z), V3(1, 0, 0), .2, .005, .005, 3); }
  seg(a, MAT.iron, V3(x, DECK_Y + .41, -L/2), V3(0, 0, 1), L, .003, .003, 3);
  a.into(g);
  const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}

/* ── water (Breathe): fountain, pyaau, coconut cart, rain barrel, street tap with a queue of pots ── */
const PUD_TEX = (() => { const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(17);
  const gr = g.createLinearGradient(0, 0, N, N); gr.addColorStop(0, '#EAF4FB'); gr.addColorStop(.5, '#B7D3E6'); gr.addColorStop(1, '#8FB3CE'); g.fillStyle = gr; g.fillRect(0, 0, N, N);
  const cols = ['rgba(120,140,165,.35)', 'rgba(169,216,194,.3)', 'rgba(242,184,154,.3)', 'rgba(90,105,130,.3)'];
  for (let i=0;i<6;i++){ g.fillStyle = cols[i % cols.length]; const x = r()*N, w = 6 + r()*12; g.fillRect(x, N*.45 + r()*N*.2, w, N*.5); }
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; for (let i=0;i<6;i++){ const x = r()*N, y = r()*N; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10 + r()*12, y - 4); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
const PUDDLE = new THREE.MeshStandardMaterial({ color:0xFFFFFF, map:PUD_TEX, roughness:.06, metalness:.1, emissive:0x5A7890, emissiveIntensity:.45, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-4 });
const RING = new THREE.MeshBasicMaterial({ color:0xFFFFFF, transparent:true, opacity:.55, depthWrite:false });
function puddleGeo(r, seed, sx=1, sz=1){ const s = new THREE.Shape(), rr = rngFrom(seed), n = 14, k = [];
  for (let i=0;i<n;i++) k.push(.82 + rr()*.3);
  for (let i=0;i<=n;i++){ const ang = i/n*Math.PI*2, q = k[i % n]*r; const x = Math.cos(ang)*q*sx, y = Math.sin(ang)*q*sz; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  const geo = new THREE.ShapeGeometry(s).rotateX(-Math.PI/2); const uv = geo.attributes.uv; for (let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*1.4 + .5, uv.getY(i)*1.4 + .5); return geo; }
function puddle(parent, x, y, z, r, seed, sx=1, sz=1){ const m = new THREE.Mesh(puddleGeo(r, seed, sx, sz), PUDDLE); m.position.set(x, y + .002, z); m.receiveShadow = true; parent.add(m); return m; }
const WATERM = new THREE.MeshStandardMaterial({ color:0x7FC3E0, roughness:.08, emissive:0x1C4C66, emissiveIntensity:.4 });
const JET = new THREE.MeshStandardMaterial({ color:0xDDF3FF, roughness:.1, transparent:true, opacity:.75, emissive:0x6FA8C8, emissiveIntensity:.3 });
function fountain(g){
  const a = new Acc();
  slab(a, MAT.wet, .9, .02, .9); puddle(g, .3, .02, .3, .14, 5);
  cyl(a, MAT.basaltD, .4, .4, .1, 0, .02, 0, 8); cyl(a, WATERM, .35, .35, .01, 0, .105, 0, 8);
  cyl(a, MAT.basalt, .06, .05, .2, 0, .1, 0, 8); cyl(a, MAT.basaltL, .16, .12, .04, 0, .3, 0, 8); cyl(a, WATERM, .14, .14, .01, 0, .335, 0, 8);
  cyl(a, MAT.basalt, .035, .03, .12, 0, .34, 0, 8); a.add(new THREE.SphereGeometry(.05, 10, 8), MAT.basaltL, at(0, .5, 0, 0, 1, 1.2, 1)); a.add(new THREE.ConeGeometry(.012, .05, 6), MAT.brass, at(0, .57, 0));
  for (let i=0;i<8;i++){ const ang = i/8*Math.PI*2; seg(a, JET, V3(Math.cos(ang)*.15, .33, Math.sin(ang)*.15), V3(Math.cos(ang), -.8, Math.sin(ang)), .28, .008, .012, 4); }
  seg(a, JET, V3(0, .59, 0), _up, .1, .01, .004, 5);
  a.into(g);
}
function pyaau(g){
  const a = new Acc();
  slab(a, MAT.conc, .7, .06, .5, 0, 0, -.05);
  slab(a, MAT.woodL, .6, .03, .2, 0, .14, -.1); for (const x of [-.26, .26]) slab(a, MAT.woodD, .03, .08, .16, x, .06, -.1);
  for (let i=0;i<3;i++){ const x = -.18 + i*.18; a.add(new THREE.SphereGeometry(.085, 12, 8), MAT.clay, at(x, .24, -.1, 0, 1, .9, 1)); cyl(a, MAT.clayD, .045, .04, .04, x, .31, -.1, 10); cyl(a, MAT.white, .06, .06, .012, x, .35, -.1, 10); }
  cyl(a, MAT.steel, .02, .018, .04, .16, .06, .14, 8); cyl(a, MAT.steel, .02, .018, .04, .22, .06, .12, 8);
  // tin roof on four poles
  for (const [x, z] of [[-.32, -.28], [.32, -.28], [-.32, .18], [.32, .18]]) seg(a, MAT.iron, V3(x, .06, z), _up, .5, .008, .008, 4);
  a.add(bx(.78, .012, .6), MAT.steelG, at(0, .57, -.05, 0, 1, 1, 1, .15)); slab(a, MAT.umb1, .78, .03, .01, 0, .5, .25);
  a.into(g); puddle(g, .28, .06, .22, .1, 3);
}
function cocoCart(g){
  const a = new Acc();
  slab(a, MAT.wet, .9, .02, .9);
  slab(a, MAT.woodL, .5, .04, .3, 0, .16, 0); for (const s of [-1, 1]) a.add(new THREE.TorusGeometry(.08, .014, 5, 14), MAT.iron, at(s*.14, .1, .16));
  for (const s of [-1, 1]) a.add(new THREE.TorusGeometry(.08, .014, 5, 14), MAT.iron, at(s*.14, .1, -.16));
  seg(a, MAT.iron, V3(-.25, .18, 0), V3(-1, .2, 0), .12, .008, .008, 4);
  const r = rngFrom(21); for (let i=0;i<16;i++){ const lvl = i < 9 ? 0 : i < 14 ? 1 : 2, x = (r() - .5)*(.36 - lvl*.1), z = (r() - .5)*(.2 - lvl*.06);
    a.add(new THREE.SphereGeometry(.05, 8, 6), MAT.coco, at(x, .24 + lvl*.07, z, r()*3, 1, 1.15, 1)); }
  for (let i=0;i<3;i++) { cyl(a, MAT.coco, .05, .045, .08, .3 + (i % 2)*.1, .02, .28 - i*.08, 8); seg(a, i % 2 ? MAT.umb1 : MAT.umb3, V3(.3 + (i % 2)*.1, .1, .28 - i*.08), V3(.2, 1, 0), .08, .004, .004, 3); }
  seg(a, MAT.iron, V3(.2, .2, -.12), _up, .5, .008, .008, 4);
  for (let i=0;i<8;i++) a.add(new THREE.ConeGeometry(.3, .12, 2, 1, true, i*Math.PI/4, Math.PI/4), i % 2 ? MAT.white : MAT.umb1, at(.2, .74, -.12));
  a.into(g);
}
function rainBarrel(g){
  const a = new Acc();
  slab(a, MAT.wet, .9, .02, .9);
  // a little tin-roofed shed with a rain chain into a blue drum
  slab(a, MAT.cream, .5, .38, .3, -.14, .02, -.26); win(a, 'z', .15, -.14, .12, .12, .16, MAT.doorG, MAT.white, 0, -.26);
  a.add(bx(.62, .014, .46), MAT.steelG, at(-.14, .44, -.2, 0, 1, 1, 1, .22));
  for (let i=0;i<7;i++) a.add(new THREE.TorusGeometry(.012, .004, 3, 6), MAT.brass, at(.14, .4 - i*.035, .02, i*.8));
  cyl(a, MAT.tankB, .1, .1, .22, .14, .02, .08, 14); cyl(a, WATERM, .09, .09, .01, .14, .235, .08, 14); a.add(new THREE.TorusGeometry(.1, .01, 4, 14).rotateX(Math.PI/2), MAT.tankB, at(.14, .24, .08));
  a.into(g); puddle(g, .3, .02, .28, .16, 9); puddle(g, -.2, .02, .2, .1, 12);
}
function streetTap(g){
  const a = new Acc();
  slab(a, MAT.conc, .5, .04, .5, -.18, 0, -.18);
  seg(a, MAT.steelG, V3(-.22, .04, -.22), _up, .3, .018, .018, 6); seg(a, MAT.steelG, V3(-.22, .3, -.22), V3(1, 0, 1), .08, .01, .01, 5);
  [MAT.umb1, MAT.umb2, MAT.umb3, MAT.umb5, MAT.umb4].forEach((m, i) => { const x = -.12 + i*.11, z = -.14 + i*.1; cyl(a, m, .045, .055, .1, x, i ? 0 : .04, z, 10); cyl(a, m, .028, .034, .025, x, (i ? 0 : .04) + .1, z, 8); });
  a.into(g); puddle(g, .2, 0, .2, .2, 14, 1.1, .8);
}

/* ── trees (Vocab/Chemistry): gulmohar in flame, coconut palms, a rain tree, a banyan ── */
function treeRing(a, r=.18){ a.add(new THREE.CylinderGeometry(r, r + .02, .05, 10), MAT.conc, at(0, .025, 0)); a.add(new THREE.CylinderGeometry(r - .03, r - .03, .01, 10), MAT.bark, at(0, .05, 0)); }
function gulmohar(g, s){
  const a = new Acc(), r = rngFrom(s.x*11 + s.z*5); treeRing(a);
  const top = V3(.02, .62, -.02); seg(a, MAT.bark, V3(0, .04, 0), V3(.03, 1, -.03), .6, .05, .035, 7);
  const tips = [];
  for (let i=0;i<5;i++){ const ang = i/5*Math.PI*2 + r(), d = V3(Math.cos(ang), .45, Math.sin(ang)); seg(a, MAT.bark, top, d, .36, .03, .015, 5); tips.push(top.clone().addScaledVector(d.normalize(), .36)); }
  for (const t of tips) { for (let k=0;k<4;k++) blob(a, [MAT.gul, MAT.gulL, MAT.leafD, MAT.gul][k], V3(t.x + (r() - .5)*.18, t.y + .02 + r()*.08, t.z + (r() - .5)*.18), .12 + r()*.05, .55, 1, r); }
  blob(a, MAT.gulL, V3(0, .86, 0), .18, .5, 1, r); blob(a, MAT.leafD, V3(-.1, .78, .1), .14, .5, 1, r);
  for (let i=0;i<12;i++) a.add(new THREE.CylinderGeometry(.02, .02, .004, 6), i % 2 ? MAT.gul : MAT.gulY, at((r() - .5)*.8, .006, (r() - .5)*.8));
  a.into(g);
}
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k]; const m = FM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }
function palm(g, s){
  const a = new Acc(), lf = new Acc(), r = rngFrom(s.x*7 + s.z*3); treeRing(a, .14);
  const H = s.h || 1.2, lean = V3(.12, 1, -.08).normalize(); let p = V3(0, .04, 0), d = lean.clone();
  for (let i=0;i<8;i++){ d.x += (.02 - i*.004); d.normalize(); seg(a, i % 2 ? MAT.barkL : MAT.bark, p, d, H/8, .04 - i*.002, .037 - i*.002, 7); p = p.clone().addScaledVector(d, H/8); }
  for (let i=0;i<4;i++) a.add(new THREE.SphereGeometry(.035, 7, 6), MAT.cocoB, at(p.x + Math.cos(i*1.6)*.04, p.y - .05, p.z + Math.sin(i*1.6)*.04));
  for (let i=0;i<9;i++){ const ang = i/9*Math.PI*2 + r()*.3, L = .5 + r()*.1, pg = new THREE.PlaneGeometry(.12, L, 1, 6).translate(0, L/2, 0), pp = pg.attributes.position;
    for (let j=0;j<pp.count;j++){ const y = pp.getY(j), t = y/L; pp.setXYZ(j, pp.getX(j)*(1 - .7*t) , y, -t*t*L*.7 + Math.abs(pp.getX(j))*.35); }
    lf.add(pg, swayMat(i % 2 ? 0x4E9A3A : 0x6DB548, 1.3, .03), at(p.x, p.y, p.z, ang, 1, 1, 1, .9)); }
  a.into(g); lf.into(g);
}
function kitTree(g, s){
  const a = new Acc(); treeRing(a, .2); a.into(g);
  if (s.banyan) { const b = new Acc(), r = rngFrom(s.x*5 + s.z); for (let k=0;k<9;k++){ const ang = k/9*Math.PI*2 + r()*.3, d = .28 + r()*.14; seg(b, MAT.bark, V3(Math.cos(ang)*d, .0, Math.sin(ang)*d), _up, .55 + r()*.25, .012, .006, 4); } b.into(g); }
  const t = KITCACHE.a && KITCACHE.a[s.model]; if (!t) return;
  addModel(g, s.model, fitScale(t, s.h || 1.3, s.wid || 1.05), 0, .04, 0, (s.rot || 0)*Math.PI/180, 'a');
}

/* ── Sudoku/Math: puddles with paper boats — a small puddle and one boat, growing to a wide puddle with a fleet, ripples and a frog ── */
function paperBoat(a, x, y, z, ry, mat, s=1){
  const hs = new THREE.Shape(); hs.moveTo(-.06, .028); hs.lineTo(.06, .028); hs.lineTo(.036, 0); hs.lineTo(-.036, 0); hs.lineTo(-.06, .028);
  a.add(new THREE.ExtrudeGeometry(hs, { depth:.045, bevelEnabled:false }).translate(0, 0, -.0225), mat, at(x, y, z, ry, s, s, s));
  const ss = new THREE.Shape(); ss.moveTo(-.036, .028); ss.lineTo(.036, .028); ss.lineTo(0, .082); ss.lineTo(-.036, .028);
  a.add(new THREE.ExtrudeGeometry(ss, { depth:.012, bevelEnabled:false }).translate(0, 0, -.006), mat, at(x, y, z, ry, s, s, s));
}
const PUD_R = [0, .2, .26, .32, .37, .41], BOATS = [0, 1, 2, 3, 4, 5];
function fillPuddle(host, s, stage){
  host.clear(); const st = Math.min(5, stage), r = rngFrom(s.x*31 + s.z*7 + 5), a = new Acc(), R = PUD_R[st];
  puddle(host, 0, .035, 0, R, s.x*3 + s.z, 1.05, .9);
  if (st >= 3) puddle(host, R*.8, .035, -R*.7, R*.35, s.x + s.z*5);
  for (let i=0;i<BOATS[st];i++){ const ang = i*2.3 + r(), d = i ? R*(.35 + r()*.3) : 0; paperBoat(a, Math.cos(ang)*d, .04, Math.sin(ang)*d*.85, r()*6.28, MAT.paper[(i + s.x) % 5], st >= 4 ? 1.15 : 1); }
  for (let i=0;i<Math.max(0, st - 2); i++){ const m = new THREE.Mesh(new THREE.RingGeometry(.04 + i*.03, .048 + i*.03, 20).rotateX(-Math.PI/2), RING); m.position.set(-R*.35 + i*.02, .039, R*.3); host.add(m); }
  if (st >= 5) { blob(a, MAT.frog, V3(-R*.9, .07, .05), .04, .8, 0); for (const sx of [-1, 1]) blob(a, MAT.white, V3(-R*.9 + sx*.018, .1, .08), .012, 1, 0); for (const sx of [-1, 1]) blob(a, MAT.black, V3(-R*.9 + sx*.018, .1, .09), .006, 1, 0);
    a.add(new THREE.CircleGeometry(.05, 8).rotateX(-Math.PI/2), MAT.leafL, at(R*.4, .038, R*.4)); }
  if (a.m.size) a.into(host); host.userData.stage = stage;
}

/* ── BLUEPRINT (own layout). Sea along +z (front-left), train viaduct along the x=0 rim (back-left). Rings 6 / 14 / 20. ── */
const SLOTS = [
  // ring 1: chawl courtyard, two puddles, a pyaau, a chai tapri, a gulmohar
  { id:'chawl',     cat:'building', gate:'lesson',   name:'Chawl courtyard', b:'chawlCourt', x:2, z:2, w:2, d:2 },
  { id:'pud3_4',    cat:'crop', gate:'sudoku',       name:'Paper boats', kind:'puddle', x:3, z:4, stages:5 },
  { id:'pyaau',     cat:'water', gate:'breathe',     name:'Water pots', b:'pyaau', x:4, z:3 },
  { id:'chai2_4',   cat:'path', gate:'todos',        name:'Chai tapri', b:'chai', x:2, z:4 },
  { id:'gul4_2',    cat:'tree', gate:'vocab',        name:'Gulmohar', b:'gulmohar', x:4, z:2 },
  { id:'pud4_4',    cat:'crop', gate:'mathtricks',   name:'Paper boats', kind:'puddle', x:4, z:4, stages:5 },
  // ring 2
  { id:'deco1_1',   cat:'building', gate:'lesson',   name:'Deco block', b:'deco', o:{ wall:'cream', trim:'white', floors:4, seed:0, door:'doorG' }, x:1, z:1 },
  { id:'deco2_1',   cat:'building', gate:'lesson',   name:'Mint deco flats', b:'deco', o:{ wall:'mint', trim:'white', floors:3, seed:1, tank:'b' }, x:2, z:1 },
  { id:'row3_1',    cat:'building', gate:'lesson',   name:'Chawl row', b:'chawlRow', o:{ wall:'pinkW', tank:true }, x:3, z:1 },
  { id:'pud4_1',    cat:'crop', gate:'sudoku',       name:'Paper boats', kind:'puddle', x:4, z:1, stages:5 },
  { id:'rain5_1',   cat:'tree', gate:'vocab',        name:'Rain tree', b:'kitTree', model:'CommonTree_1', rot:40, h:1.3, x:5, z:1 },
  { id:'cafe1_2',   cat:'building', gate:'lesson',   name:'Irani café', b:'cafe', x:1, z:2 },
  { id:'pud1_3',    cat:'crop', gate:'mathtricks',   name:'Paper boats', kind:'puddle', x:1, z:3, stages:5 },
  { id:'palm1_4',   cat:'tree', gate:'chemistry',    name:'Coconut palm', b:'palm', h:1.15, x:1, z:4 },
  { id:'umb5_2',    cat:'path', gate:'todos',        name:'Umbrella stall', b:'umbStall', x:5, z:2 },
  { id:'fount5_4',  cat:'water', gate:'breathe',     name:'Fountain', b:'fountain', x:5, z:4 },
  { id:'coco2_5',   cat:'water', gate:'breathe',     name:'Coconut cart', b:'coco', x:2, z:5 },
  { id:'pud3_5',    cat:'crop', gate:'sudoku',       name:'Paper boats', kind:'puddle', x:3, z:5, stages:5 },
  { id:'palm4_5',   cat:'tree', gate:'vocab',        name:'Coconut palm', b:'palm', h:1.25, x:4, z:5 },
  { id:'vada5_5',   cat:'path', gate:'todos',        name:'Snack cart', b:'vada', x:5, z:5 },
  // ring 3
  { id:'arch',      cat:'special', gate:'gita',      name:'Sea arch', b:'seaArch', x:0, z:5, w:2, d:2 },
  { id:'lib0_0',    cat:'building', gate:'lesson',   name:'Old library', b:'library', x:0, z:0 },
  { id:'deco1_0',   cat:'building', gate:'lesson',   name:'Sky deco tower', b:'deco', o:{ wall:'sky', trim:'white', floors:4, seed:2, crownU:-.12 }, x:1, z:0 },
  { id:'row2_0',    cat:'building', gate:'lesson',   name:'Chawl row', b:'chawlRow', o:{ wall:'lemon' }, x:2, z:0 },
  { id:'deco3_0',   cat:'building', gate:'lesson',   name:'Peach deco flats', b:'deco', o:{ wall:'peach', trim:'cream', floors:3, seed:1, door:'doorR' }, x:3, z:0 },
  { id:'banyan4_0', cat:'tree', gate:'chemistry',    name:'Banyan', b:'kitTree', model:'CommonTree_5', rot:80, h:1.3, wid:1.1, banyan:true, x:4, z:0 },
  { id:'pud5_0',    cat:'crop', gate:'mathtricks',   name:'Paper boats', kind:'puddle', x:5, z:0, stages:5 },
  { id:'row0_1',    cat:'building', gate:'lesson',   name:'Chawl row', b:'chawlRow', o:{ wall:'sage' }, x:0, z:1 },
  { id:'pud0_2',    cat:'crop', gate:'sudoku',       name:'Paper boats', kind:'puddle', x:0, z:2, stages:5 },
  { id:'gul0_3',    cat:'tree', gate:'vocab',        name:'Gulmohar', b:'gulmohar', x:0, z:3 },
  { id:'chai0_4',   cat:'path', gate:'todos',        name:'Chai tapri', b:'chai', x:0, z:4 },
  { id:'palm6_1',   cat:'tree', gate:'chemistry',    name:'Coconut palm', b:'palm', h:1.2, x:6, z:1 },
  { id:'deco6_2',   cat:'building', gate:'lesson',   name:'Lilac deco house', b:'deco', o:{ wall:'lilac', trim:'white', floors:2, seed:0 }, x:6, z:2 },
  { id:'barrel6_4', cat:'water', gate:'breathe',     name:'Rain barrel', b:'barrel', x:6, z:4 },
  { id:'tap6_6',    cat:'water', gate:'breathe',     name:'Street tap', b:'tap', x:6, z:6 },
  { id:'pud3_6',    cat:'crop', gate:'mathtricks',   name:'Paper boats', kind:'puddle', x:3, z:6, stages:5 },
  { id:'taxi5_6',   cat:'path', gate:'todos',        name:'Taxi stand', b:'taxi', x:5, z:6 },
  { id:'bridge',    cat:'path', gate:'todos',        name:'Train viaduct', b:'bridge', x:0, z:0, edge:'w', len:5 },
  { id:'prom1',     cat:'path', gate:'todos',        name:'Sea-wall lamps', b:'prom', x:2, z:6, edge:'s', len:2 },
  { id:'prom2',     cat:'path', gate:'todos',        name:'Sea-wall lamps', b:'prom', x:4, z:6, edge:'s', len:3 }
].map(s => ({ ...s, kind:s.kind || 'mum' }));
const ORDER = ['chawl','pud3_4','pyaau','chai2_4','gul4_2','pud4_4',
  'deco2_1','pud4_1','coco2_5','umb5_2','palm4_5','row3_1','pud3_5','cafe1_2','rain5_1','fount5_4','pud1_3','vada5_5','deco1_1','palm1_4',
  'arch','prom1','pud3_6','lib0_0','bridge','gul0_3','deco3_0','taxi5_6','pud5_0','row0_1','barrel6_4','palm6_1','prom2','chai0_4','deco1_0','pud0_2','tap6_6','banyan4_0','deco6_2','row2_0'];
const BUILD = { chawlCourt, chawlRow, deco:(g, s) => deco(g, s.o), cafe, library, seaArch, chai:chaiStall, umbStall:umbrellaStall, vada:vadaCart, taxi:taxiStand,
  prom:promenade, bridge:trainBridge, fountain, pyaau, coco:cocoCart, barrel:rainBarrel, tap:streetTap, gulmohar, palm, kitTree };

/* ── ground: dark wet paving with puddle sheen ── */
const TILE = { top:['#66727E', '#5E6A76'], side:'#505A64', soilTop:'#6E655A', soilBot:'#3A332C' };
function tileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(51);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  for (let y=0;y<4;y++) for (let x=0;x<4;x++){ const w = N/4, ox = y % 2 ? w/2 : 0;
    g.fillStyle = `rgba(${200 + r()*40|0},${205 + r()*40|0},${215 + r()*35|0},.35)`; g.fillRect(x*w + ox + 3, y*w + 3, w - 6, w - 6);
    g.strokeStyle = 'rgba(30,40,55,.28)'; g.lineWidth = 3; g.strokeRect(x*w + ox + 2, y*w + 2, w - 4, w - 4); if (ox) g.strokeRect(-w/2 + 2, y*w + 2, w - 4, w - 4); }
  // wet sheen: soft pale smears + a puddle glint
  for (let i=0;i<5;i++){ const x = r()*N, y = r()*N, rad = 20 + r()*40, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(210,230,245,.45)'); gr.addColorStop(1, 'rgba(210,230,245,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); }
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.lineCap = 'round';
  for (let i=0;i<10;i++){ const x = r()*N, y = r()*N; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + r()*10, y - 2 - r()*3); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ── env: the sea along the +z edge — a sea wall, tetrapods and rolling foam ── */
const seaTex = (() => { const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(8);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  for (let i=0;i<60;i++){ const x = r()*N, y = r()*N, w = 10 + r()*30; g.strokeStyle = `rgba(255,255,255,${.3 + r()*.4})`; g.lineWidth = 1.5 + r()*1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w/2, y - 3, x + w, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; })();
const SEA_TOP = new THREE.MeshStandardMaterial({ color:0x5B97A8, roughness:.12, emissive:0x173E4C, emissiveIntensity:.35, map:seaTex });
const SEA_SIDE = new THREE.MeshStandardMaterial({ color:0x3F7788, roughness:.3, emissive:0x0E2C38, emissiveIntensity:.3 });
const FOAM = new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.6, transparent:true, opacity:.85, emissive:0x9FB8C4, emissiveIntensity:.25 });
const SEA_Y = -.12; let SEA_W = .9;
function tetrapod(a, x, y, z, s, rot, mat){
  const dirs = [V3(0, 1, 0), V3(.94, -.33, 0), V3(-.47, -.33, .82), V3(-.47, -.33, -.82)], e = new THREE.Euler(rot, rot*1.7, rot*.6);
  for (const d of dirs) { d.applyEuler(e); seg(a, mat, V3(x, y, z), d, .12*s, .04*s, .022*s, 6); }
  a.add(new THREE.IcosahedronGeometry(.04*s, 0), mat, at(x, y, z));
}
function buildEnv(){
  const R = V.ring, h = R + .5, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const a = new Acc(), r = rngFrom(61 + R); SEA_W = .42 + .16*R;
  // sea wall coping along the block edge
  slab(a, MAT.conc, 2*h + .04, .05, .08, 0, TILE_TOP - .02, h + .02);
  // tetrapods piled against the wall
  const NT = Math.round(h*9);
  for (let i=0;i<NT;i++){ const x = -h + .1 + i*(2*h - .2)/(NT - 1) + (r() - .5)*.05, row = i % 3;
    tetrapod(a, x, SEA_Y + .03 + (row === 1 ? .08 : 0), h + .13 + row*.07 + r()*.03, 1.05 + r()*.25, r()*6, row === 1 ? MAT.tetra : MAT.tetraD); }
  a.into(env);
  const len = 2*h + .04;
  const sea = new THREE.Mesh(new THREE.BoxGeometry(len, SEA_Y + .62, SEA_W), [SEA_SIDE, SEA_SIDE, SEA_TOP, SEA_SIDE, SEA_SIDE, SEA_SIDE]);
  sea.position.set(0, -.62 + (SEA_Y + .62)/2, h + .02 + SEA_W/2); sea.receiveShadow = true; env.add(sea);
  seaTex.repeat.set(len*.6, SEA_W*.6);
  // foam crests, animated in tick
  V.foam = []; for (let i=0;i<3;i++){ const fa = new Acc(), f = new THREE.Group(); let x = -len/2 + .05;
    while (x < len/2 - .1) { const w = .15 + r()*.4; fa.add(new THREE.CapsuleGeometry(.014, w, 2, 6).rotateZ(Math.PI/2), FOAM, at(x + w/2, 0, (r() - .5)*.04)); x += w + .05 + r()*.12; }
    fa.into(f); f.children.forEach(m => m.castShadow = false); f.userData.ph = i/3; env.add(f); V.foam.push(f); }
  V.seaH = h; moveFoam(2.1);
  env.children.forEach(m => { if (m.isMesh) m.castShadow = false; });
  for (const sx of [-1, 1]) V.framePts.push(V3(sx*h, -.62, h + .02 + SEA_W), V3(sx*h, SEA_Y, h + .02 + SEA_W));
  // glossy wet paving on this theme's tiles only
  if (V.caps && V.caps.material) { V.caps.material.roughness = .42; V.caps.material.metalness = .05; }
}
function moveFoam(t){ if (!V || !V.foam) return; const h = V.seaH;
  V.foam.forEach(f => { const p = ((t*.12 + f.userData.ph) % 1 + 1) % 1; f.position.set(0, SEA_Y + .012, h + .02 + SEA_W - .06 - p*(SEA_W - .32)); f.scale.set(1, 1, .6 + p*1.2); }); }

/* decor: small puddles, grass in the cracks, gulmohar petals on empty cells; one puddle on waiting cells */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(29);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    const tuft = (n) => { for (let j=0;j<n;j++){ const ang = r()*6.28, d = .2 + r()*.25; addModel(grp, r() < .55 ? 'Grass_1' : 'Grass_2', .16*(.7 + r()*.5), p.x + Math.cos(ang)*d, p.y, p.z + Math.sin(ang)*d, r()*6.28, 'farm'); } };
    const petals = (n) => { for (let j=0;j<n;j++) a.add(new THREE.CylinderGeometry(.018, .018, .004, 6), j % 2 ? MAT.gul : MAT.gulY, at(p.x + (r()-.5)*.8, p.y + .003, p.z + (r()-.5)*.8)); };
    if (!sl || sl === 'later') { puddle(grp, p.x + (r() - .5)*.3, p.y, p.z + (r() - .5)*.3, .14 + r()*.12, x*9 + z); tuft(2); petals(3);
      if (r() < .5) { cyl(a, MAT.iron, .09, .09, .008, p.x + (r() - .5)*.4, p.y, p.z + (r() - .5)*.4, 14); }
      grp.userData.decor = 'meadow'; }
    else if (!placed.includes(sl.id) && AMBIENT()) { puddle(grp, p.x + (r() - .5)*.3, p.y, p.z + (r() - .5)*.3, .1 + r()*.06, x*5 + z*3); tuft(1); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ── rain: a burst of streaks + splash rings on every drop (event-only; frozen mid-fall on drop boards) ── */
const RAIN_MAT = new THREE.LineBasicMaterial({ color:0xF4FAFF, transparent:true, opacity:0, depthWrite:false });
function rainBurst(ms=1900, n=460){
  const h = (V ? V.ring : 3) + .9, r = rngFrom(Math.floor(performance.now()) & 1023), pos = new Float32Array(n*6), st = [];
  for (let i=0;i<n;i++) st.push([(r() - .5)*2*h, (r() - .5)*2*h + .3, r()*3.6, 2.6 + r()*1.2]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = RAIN_MAT.clone(), ls = new THREE.LineSegments(geo, mat); ls.renderOrder = 8; ls.frustumCulled = false; fx.add(ls);
  const rings = []; for (let i=0;i<22;i++){ const m = new THREE.Mesh(new THREE.RingGeometry(.03, .045, 16).rotateX(-Math.PI/2), RING.clone()); m.position.set((r() - .5)*2*(h - .9), TILE_TOP + .012, (r() - .5)*2*(h - .9)); m.userData.t0 = r()*.8; fx.add(m); rings.push(m); }
  const step = t => { const T = t*ms/1000;
    for (let i=0;i<n;i++){ const [x, z, y0, sp] = st[i], y = TILE_TOP + ((y0 - T*sp) % 3.6 + 3.6) % 3.6;
      pos.set([x, y, z, x + .03, y + .2, z - .03], i*6); }
    geo.attributes.position.needsUpdate = true; mat.opacity = .9*Math.min(1, t*6, (1 - t)*4);
    rings.forEach(m => { const u = Math.max(0, Math.min(1, (t - m.userData.t0)/.2)); m.scale.setScalar(.5 + u*2.2); m.material.opacity = u > 0 && u < 1 ? .6*(1 - u) : 0; }); };
  step(0);
  tween(S.rm ? 1 : ms, step, () => { fx.remove(ls); geo.dispose(); mat.dispose(); rings.forEach(m => { fx.remove(m); m.geometry.dispose(); m.material.dispose(); }); });
}

/* ── life: crows circling, rolling foam; on completion a local train on the viaduct, crows land, a rainbow after the rain ── */
function makeCrow(){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.035, 8, 6), MAT.crow, at(0, .045, 0, 0, .85, .85, 1.3));
  blob(a, MAT.crowG, V3(0, .07, .035), .024, 1, 1);
  a.add(new THREE.ConeGeometry(.009, .03, 5).rotateX(Math.PI/2), MAT.beak, at(0, .07, .068));
  a.add(bx(.035, .006, .06), MAT.crow, at(0, .05, -.06, 0, 1, 1, 1, -.35));
  for (const s of [-1, 1]) { a.add(new THREE.SphereGeometry(.02, 6, 4), MAT.crow, at(s*.028, .05, -.005, 0, .3, .7, 1.3)); seg(a, MAT.beak, V3(s*.01, 0, 0), _up, .02, .003, .003, 3); }
  blob(a, MAT.white, V3(.017, .076, .05), .005); blob(a, MAT.white, V3(-.017, .076, .05), .005);
  a.into(g); return g;
}
function makeFlyer(){ const g = new THREE.Group(), a = new Acc(); a.add(new THREE.SphereGeometry(.03, 7, 5), MAT.crow, at(0, 0, 0, 0, .8, .8, 1.3)); a.into(g);
  const wg = new THREE.PlaneGeometry(.11, .05).rotateX(-Math.PI/2).translate(.055, 0, 0), w1 = new THREE.Mesh(wg, MAT.crow), w2 = new THREE.Mesh(wg, MAT.crow); w2.scale.x = -1; g.add(w1, w2); g.userData.w = [w1, w2]; return g; }
function makeCoach(first){
  const g = new THREE.Group(), a = new Acc(), L = .7;
  slab(a, MAT.maroon, .2, .1, L, 0, .02, 0); slab(a, MAT.trainY, .205, .07, L, 0, .12, 0);
  a.add(new THREE.CylinderGeometry(.1, .1, L, 10, 1, false, -Math.PI/2, Math.PI).rotateX(Math.PI/2), MAT.trainR, at(0, .19, 0, 0, 1, .35, 1));
  for (const sx of [-1, 1]) { for (let i=0;i<5;i++) a.add(bx(.006, .045, .07), MAT.glass, at(sx*.103, .14, -L/2 + .1 + i*.125)); for (const dz of [-.22, .22]) a.add(bx(.007, .14, .07), MAT.black, at(sx*.103, .08, dz)); }
  for (const dz of [-L/2 + .1, L/2 - .1]) for (const sx of [-1, 1]) a.add(new THREE.CylinderGeometry(.025, .025, .02, 8).rotateZ(Math.PI/2), MAT.iron, at(sx*.08, .015, dz));
  if (first) { a.add(bx(.19, .06, .006), MAT.glass, at(0, .15, L/2 + .002)); for (const sx of [-1, 1]) a.add(new THREE.SphereGeometry(.012, 6, 5), LAMPM, at(sx*.06, .07, L/2 + .004));
    seg(a, MAT.iron, V3(0, .225, .1), V3(0, 1, -.6), .14, .004, .004, 3); seg(a, MAT.iron, V3(0, .225, -.1), V3(0, 1, .6), .14, .004, .004, 3); slab(a, MAT.iron, .12, .008, .01, 0, .345, 0); }
  a.into(g); return g;
}
function makeTrain(){ const g = new THREE.Group(); g.userData.coaches = []; for (let i=0;i<3;i++){ const c = makeCoach(i === 0); c.position.z = -i*.74; g.add(c); g.userData.coaches.push(c); } return g; }
const RB = [0xE8364F, 0xF79A1E, 0xF7D63A, 0x4CBF5A, 0x2E86DE, 0x7B4BE0];
const RB_MATS = RB.map(c => new THREE.MeshBasicMaterial({ color:c, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide }));
function makeRainbow(){ const g = new THREE.Group(); RB.forEach((c, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(1.9 - i*.07, .036, 5, 60, Math.PI), RB_MATS[i]); m.renderOrder = 1; g.add(m); }); return g; }
const RES_SCALE = 1.5;
const CROW_AT = [[-.9, 3.47, .215], [1.3, 3.47, .215], [2.6, 3.47, .215], [.25, .6, 0], [2.2, .3, 0]];
function addFlock(){
  V.flock = []; for (let i=0;i<3;i++){ const f = makeFlyer(); f.scale.setScalar(1.3); f.userData.u = { ph:i*2.1, rad:.9 + V.ring*.35 + (i%2)*.2, h:1.6 + i*.15, sp:.26 + i*.04 }; world.add(f); V.flock.push(f); V.life.push(f); }
  moveFlock(2.1);
}
function moveFlock(t){ (V && V.flock || []).forEach(f => { const u = f.userData.u, a = t*u.sp + u.ph;
  f.position.set(Math.cos(a)*u.rad, TILE_TOP + u.h + Math.sin(a*2.1)*.1, Math.sin(a)*u.rad*.7); f.rotation.y = -a;
  const fl = Math.sin(t*14 + u.ph)*.7; f.userData.w[0].rotation.z = fl; f.userData.w[1].rotation.z = -fl; }); }
const TRAIN_X = BRIDGE_X - OFF, TRAIN_Y = TILE_TOP + DECK_Y + .058, TRAIN_Z0 = -OFF - .5, TRAIN_Z1 = TRAIN_Z0 + 5;
function moveResidents(t){
  (V && V.res || []).forEach(r => { const u = r.u, e = r.arrive;
    if (r.kind === 'train') { const P = 7, p = (((t + u.ph)/P) % 1 + 1) % 1, head = TRAIN_Z0 - .1 + p*(5 + 2.4);
      r.obj.position.set(TRAIN_X, TRAIN_Y, 0);
      r.obj.userData.coaches.forEach((c, i) => { const z = head - i*.74*RES_SCALE*.66, f = Math.max(0, Math.min(1, Math.min(z - TRAIN_Z0 - .1, TRAIN_Z1 - z - .1)/.35));
        c.position.z = z; c.scale.set(RES_SCALE*.66*f + .0001, RES_SCALE*.66*Math.max(.001, f), RES_SCALE*.66); c.visible = f > .01 && e > 0; }); }
    else if (r.kind === 'crow') { const hop = Math.max(0, Math.sin(t*4 + u.ph)), fly = 1 - Math.min(1, e);
      r.obj.position.set(u.at.x + fly*1.2, u.y + hop*hop*.02 + fly*1.6, u.at.z - fly*.8); r.obj.rotation.x = e >= 1 ? Math.max(0, Math.sin(t*1.1 + u.ph*3))*.45 : 0; }
    else if (r.kind === 'rainbow') { RB_MATS.forEach(m => m.opacity = .42*Math.min(1, e)); }
  });
}
let _t = 0;
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => { rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.05))); moveResidents(_t); },
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(TILE_TOP + .6), 10, 0xFFF0B0, .6); res(); })); }
async function moveIn(walk){
  V.residentsIn = true; V.res = [];
  const add = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const groups = [
    async () => { if (walk) { rainBurst(2600, 380); await new Promise(r => setTimeout(r, S.rm ? 0 : 1800)); }
      const rb = makeRainbow(); rb.position.set(-2.1, TILE_TOP - .1, -2.1); rb.rotation.y = Math.PI/4; const rs = [add('rainbow', rb, {})];
      if (walk) await arrive(rs, 1600); },
    async () => { const rs = [add('train', makeTrain(), { ph:2.6 })]; if (walk) await arrive(rs, 900); },
    async () => { const rs = CROW_AT.map(([x, z, yy], i) => { const o = makeCrow(); o.scale.setScalar(RES_SCALE); o.rotation.y = i*1.3 + .4;
        return add('crow', o, { at:V3(x, 0, z), y:TILE_TOP + yy, ph:i*1.3 }); });
      if (walk) await arrive(rs, 1500); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length; moveResidents(_t || 2.1);
}

export default {
  id:'mumbai', name:'Mumbai rains', title:'Your Mumbai',
  season:31, dates:'6–19 Jul', nextIn:14,
  kits:['farm', 'a'],
  kitDefs:{ farm:{ file:'assets/farm/farm.glb', flat:true } },
  families:{
    water:   { label:'fountains, water pots & taps', tag:'Water' },
    building:{ label:'chawls, deco flats & cafés',   tag:'Building' },
    path:    { label:'stalls, carts & the viaduct',  tag:'Street' },
    crop:    { label:'puddles & paper boats',        tag:'Grows' },
    tree:    { label:'gulmohar, palms & rain trees', tag:'Tree' },
    special: { label:'the sea arch',                 tag:'Special' }
  },
  slots:SLOTS, order:ORDER,
  ground:{ tile:TILE, tileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M2 20c2-1.2 3.5-1.2 5 0s3 1.2 5 0 3.5-1.2 5 0 3 1.2 5 0v2H2z" fill="#5B97A8"/><path d="M5 18V8h14v10h-4.5v-4a2.5 2.5 0 0 0-5 0v4z" fill="#D6B57F"/><path d="M5 8V5.5h2.2V8zM16.8 8V5.5H19V8z" fill="#B08C58"/><path d="M9 8a3 3 0 0 1 6 0z" fill="#E8CFA0"/><path d="M1.5 10a3.5 3.5 0 0 1 7 0z" fill="#E8364F"/><path d="M5 10v4" stroke="#3E454E" stroke-width="1"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M4 122c10-5 18-5 28 0s18 5 28 0 18-5 28 0 18 5 28 0 10-3 8-2v6H4z" opacity=".55"/><path d="M26 108V52h76v56H76V82a12 12 0 0 0-24 0v26z"/><path d="M22 52V36h14v16zM92 52V36h14v16z"/><path d="M29 36c0-8 8-8 8 0zM92 36c0-8 8-8 8 0z"/><path d="M50 52a14 14 0 0 1 28 0z"/><path d="M104 70a14 14 0 0 1 22 0z" opacity=".85"/><path d="M114 70v22" stroke="currentColor" stroke-width="3"/></g>',
  album:{ image:'assets/mumbai/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E3EBF0)' },
  css:'.phone[data-theme="mumbai"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#EAF0F4 56%,#D3DEE6 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'puddle') {
      const b = base(g, MAT.wetD); b.userData.ghostHide = true;
      const host = new THREE.Group(); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillPuddle(host, s, st); fillPuddle(host, s, stage);
      g.userData.ghostMode = 'marker';
    } else BUILD[s.b](g, s);
  },
  contact: s => s.kind === 'mum' && !['prom', 'bridge', 'chai', 'umbStall', 'vada', 'taxi'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || ['chai', 'vada', 'prom', 'fountain'].includes(s.b),
  decor,
  env: buildEnv,
  onImpact(){ rainBurst(); },
  ambient(){ addFlock(); },
  tick(t){ _t = t; moveFlock(t); moveFoam(t); moveResidents(t); seaTex.offset.set(t*.01, -t*.025); },

  residents:[ { id:'train', name:'Local train', n:1 }, { id:'crow', name:'Crows', n:5 }, { id:'rainbow', name:'Rainbow', n:1 } ],
  moveIn,
  residentThumb(d, thumbFor){
    return thumbFor('mumbai:'+d.id, () => {
      if (d.id === 'train') { const o = makeTrain(); o.userData.coaches.forEach((c, i) => c.position.z = -i*.74); o.rotation.y = 1.15; return o; }
      if (d.id === 'rainbow') { const o = makeRainbow(); RB_MATS.forEach(m => m.opacity = .9); o.rotation.y = Math.PI/4; return o; }
      const o = makeCrow(); o.rotation.y = .7; return o; }, 168); },
  residentRig(d){
    const obj = d.id === 'train' ? makeTrain() : d.id === 'rainbow' ? makeRainbow() : makeCrow();
    if (d.id === 'crow') obj.scale.setScalar(RES_SCALE); if (d.id === 'train') obj.scale.setScalar(RES_SCALE*.66);
    return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
