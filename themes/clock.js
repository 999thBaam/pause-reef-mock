/* CLOCKWORK (?theme=clock) — a warm brass-and-walnut clockwork world on the farm's 7×7 ring blueprint (same cells, same ring
   counts 6 / 15 / 19, same order). As in robots, the hero (the great clock tower) takes the LEFT corner (cells 0..1 × 5..6) so
   nothing stands in front of it; the two farm slots it displaces move to the old peepal corner.
   Look: honey parquet tiles on a walnut block with a brass band, cream enamel dials with tick marks only (no numerals, no
   text), verdigris-green domes and roofs, rose and copper accents. Cute and round, never grim steampunk: no soot, no rivets
   everywhere, no weapons.
   Gears sit on every tile (loose ones lie flat on the parquet and turn) and in most pieces; ALL of them share one clock whose
   speed rises with the number of pieces placed (3 pieces = a lazy tick, 40 = a happy whirr). Sudoku/Math pads grow gear
   towers tier by tier. The tower's bell swings and clockwork birds fly in at completion.
   No CC0 kit fits, so every piece and resident is procedural three.js merged per material (Acc); only the turning parts are
   separate meshes. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rngFrom, TEX, world } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { G, Acc, seg } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { FARM, FARM_ORDER } from './farm.js';

/* ── canvas textures ── */
function canvasTex(w, h, draw, rep){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
/* planks: soft lengthwise boards with faint grain (paths, floors) */
const PLANK = canvasTex(128, 128, (g, N) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  for (let i=0;i<4;i++){ g.fillStyle = i%2 ? 'rgba(120,70,30,.07)' : 'rgba(255,255,255,0)'; g.fillRect(i*N/4, 0, N/4, N);
    g.strokeStyle = 'rgba(90,50,20,.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(i*N/4, 0); g.lineTo(i*N/4, N); g.stroke();
    g.beginPath(); g.moveTo(i*N/4, (i*37)%N); g.lineTo((i+1)*N/4, (i*37)%N); g.stroke();
    g.strokeStyle = 'rgba(90,50,20,.07)'; g.lineWidth = 1; for (let k=0;k<3;k++){ g.beginPath(); g.moveTo(i*N/4 + 6 + k*9, 0); g.bezierCurveTo(i*N/4 + 10 + k*9, N*.3, i*N/4 + 2 + k*9, N*.6, i*N/4 + 7 + k*9, N); g.stroke(); } } }, true);

/* ── materials: walnut, honey wood, soft brass, copper, verdigris, cream enamel ── */
const PM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.55, metalness:0, ...o });
const BR = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.32, metalness:.22, ...o });
const MAT = {
  walnut:PM(0x8A5634, { roughness:.7 }), walnutD:PM(0x6A3F24, { roughness:.75 }), walnutL:PM(0xB07A4C, { roughness:.7 }),
  honey:PM(0xE2B274, { roughness:.7 }), honeyL:PM(0xF0CD96, { roughness:.7 }), plank:PM(0xE6BC82, { roughness:.8, map:PLANK }),
  brass:BR(0xF0C258), brassD:BR(0xC99A3A), brassL:BR(0xFFE09A), copper:BR(0xE39A68), copperD:BR(0xC07548),
  patina:PM(0x79C7AE, { roughness:.5 }), patinaD:PM(0x4FA58D, { roughness:.5 }), patinaL:PM(0xB9E6D6, { roughness:.5 }),
  rose:PM(0xF0A3A0), roseL:PM(0xFFD3CE), cream:PM(0xFFF4DF), enamel:PM(0xFFF8EA, { roughness:.35, emissive:0xFFF1D6, emissiveIntensity:.12 }),
  ink:PM(0x4B3526, { roughness:.6 }), leaf:PM(0x8CCB7A), leafD:PM(0x62A862), pot:PM(0xE58F6A),
  glass:new THREE.MeshStandardMaterial({ color:0xF2FBFF, roughness:.06, metalness:0, transparent:true, opacity:.3, depthWrite:false }),
  water:PM(0x76C8E8, { roughness:.12, emissive:0x2380A8, emissiveIntensity:.28 }),
  stream:PM(0xA8E4FA, { roughness:.08, transparent:true, opacity:.75, emissive:0x4AB0DD, emissiveIntensity:.35, depthWrite:false }),
  sand:PM(0xF3D28F, { roughness:.9 }), puff:PM(0xFFFFFF, { roughness:.95 }),
  glow:PM(0xFFEBB8, { emissive:0xFFB94A, emissiveIntensity:1.2 }), glowFace:PM(0xFFF6DE, { emissive:0xFFD27E, emissiveIntensity:.55, roughness:.4 }),
  sun:PM(0xFFE7A0, { emissive:0xFFAA3A, emissiveIntensity:1.3 })
};

/* ── helpers ── */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
/* a fresh matrix every call (no aliasing): position, Euler (YXZ), scale */
const AT = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V3(sx, sy, sz));
const sub = (M, x, y, z, rz=0, sx=1, sy=1, sz=1) => M.clone().multiply(AT(x, y, z, 0, sx, sy, sz, 0, rz));
const RB = new Map();
function rgeo(w, h, d, r){ const k = [w, h, d, r].join(); return RB.get(k) || RB.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w/2 - .001, h/2 - .001, d/2 - .001))).get(k); }
function rb(acc, mat, w, h, d, x=0, y=0, z=0, ry=0, r=.03){ acc.add(rgeo(w, h, d, r), mat, AT(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=18, ry=0){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, AT(x, y + h/2, z, ry)); }
function ball(acc, mat, x, y, z, r, sx=1, sy=1, sz=1){ acc.add(new THREE.SphereGeometry(r, 14, 10), mat, AT(x, y, z, 0, sx, sy, sz)); }
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }
const FACE = Math.PI/4;   // toward the camera corner
const onFace = (r, q=FACE) => [Math.sin(q)*r, Math.cos(q)*r];
const FM = (x, y, z, ry=FACE, rx=0) => AT(x, y, z, ry, 1, 1, 1, rx);   // a face frame: local +z points out

/* gear: extruded toothed ring with four round lightening holes, axis along z */
const GEARS = new Map();
function gearGeo(R, teeth, th=.04){
  teeth = teeth || Math.max(8, Math.round(R*70));
  const k = R+':'+teeth+':'+th; if (GEARS.has(k)) return GEARS.get(k);
  const s = new THREE.Shape(), n = teeth*4, rIn = R*.84;
  for (let i=0;i<=n;i++){ const a = i/n*Math.PI*2, r = (i%4 === 1 || i%4 === 2) ? R : rIn; i ? s.lineTo(Math.cos(a)*r, Math.sin(a)*r) : s.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
  const h = new THREE.Path(); h.absarc(0, 0, R*.2, 0, Math.PI*2, true); s.holes.push(h);
  if (R >= .07) for (let i=0;i<4;i++){ const q = i/4*Math.PI*2 + Math.PI/4, p = new THREE.Path(); p.absarc(Math.cos(q)*R*.52, Math.sin(q)*R*.52, R*.16, 0, Math.PI*2, true); s.holes.push(p); }
  const g = new THREE.ExtrudeGeometry(s, { depth:th, bevelEnabled:true, bevelThickness:th*.25, bevelSize:R*.03, bevelSegments:1, curveSegments:5 }).translate(0, 0, -th/2);
  GEARS.set(k, g); return g;
}
/* a static gear merged into an Acc (M = face frame) */
function gearA(acc, mat, M, R, th=.04, rz=0){ acc.add(gearGeo(R, 0, th), mat, M.clone().multiply(AT(0, 0, 0, 0, 1, 1, 1, 0, rz))); }
/* a TURNING gear: its own mesh, tagged for the shared clock. flat → lies on the ground (axis up). dir = ±1 so meshing pairs counter-turn */
const HUB = new THREE.CylinderGeometry(1, 1, 1, 14).rotateX(Math.PI/2);
function spinGear(parent, mat, x, y, z, R, { ry=FACE, rx=0, flat=false, dir=1, th=.04, hub=MAT.brassD, ph=0 } = {}){
  const o = new THREE.Group(); o.position.set(x, y, z); o.rotation.order = 'YXZ';
  if (flat) o.rotation.set(-Math.PI/2, 0, 0); else o.rotation.set(rx, ry, 0);
  const m = new THREE.Mesh(gearGeo(R, 0, th), mat); m.castShadow = m.receiveShadow = true; m.rotation.z = ph;
  m.userData.anim = { t:'spin', k:dir*.11/R, ph }; o.add(m);
  if (hub) { const h = new THREE.Mesh(HUB, hub); h.scale.set(R*.26, R*.26, th*1.6); h.castShadow = true; o.add(h); }
  parent.add(o); return o;
}
/* the dial: cream enamel face, brass rim, 12 tick marks (quarters longer), static 10:10 hands (a smile) unless hands:false */
function dial(acc, M, r, { face=MAT.enamel, rim=MAT.brass, hands=true, ticks=MAT.ink, th=.02 } = {}){
  acc.add(new THREE.CylinderGeometry(r, r, th, 28).rotateX(Math.PI/2), face, M);
  acc.add(new THREE.TorusGeometry(r, Math.max(.008, r*.09), 6, 28), rim, M);
  for (let i=0;i<12;i++){ const a = i/12*Math.PI*2, q = i%3 === 0, len = r*(q ? .22 : .12), rc = r*.8 - len/2;
    acc.add(new THREE.BoxGeometry(r*(q ? .075 : .045), len, .01), ticks, sub(M, Math.sin(a)*rc, Math.cos(a)*rc, th/2 + .002, -a)); }
  if (hands) { for (const [a, L, w] of [[-Math.PI/3, r*.45, r*.08], [Math.PI/3, r*.66, r*.055]])
      acc.add(new THREE.BoxGeometry(w, L, .01), ticks, sub(M, Math.sin(a)*L/2, Math.cos(a)*L/2, th/2 + .008, -a));
    acc.add(new THREE.CylinderGeometry(r*.08, r*.08, .012, 12).rotateX(Math.PI/2), MAT.brass, sub(M, 0, 0, th/2 + .012)); }
}
/* hands that turn (hero): a group on the face; minute hand fast, hour hand slow */
function turningHands(parent, M, r){
  const mk = (L, w, k) => { const p = new THREE.Group(); M.decompose(p.position, p.quaternion, p.scale);
    const inner = new THREE.Group(); p.add(inner); const m = new THREE.Mesh(new THREE.BoxGeometry(w, L, .014), MAT.ink); m.position.set(0, L/2, .02); inner.add(m);
    inner.userData.anim = { t:'hand', k }; parent.add(p); return inner; };
  mk(r*.46, r*.09, -.05); mk(r*.7, r*.06, -.6);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r*.08, 10, 8), MAT.brass); M.decompose(cap.position, cap.quaternion, cap.scale); parent.add(cap);
}
function puff(acc, x, y, z, s=1){ ball(acc, MAT.puff, x, y, z, .07*s); ball(acc, MAT.puff, x + .06*s, y + .02*s, z, .055*s); ball(acc, MAT.puff, x - .05*s, y + .01*s, z + .02*s, .05*s); ball(acc, MAT.puff, x + .01*s, y + .06*s, z, .05*s); }
function sprout(acc, x, y, z, s=1, pot=MAT.pot){ cyl(acc, pot, .04*s, .05*s, .06*s, x, y, z, 12); ball(acc, MAT.leaf, x - .02*s, y + .09*s, z, .03*s, 1.3, .7, 1); ball(acc, MAT.leafD, x + .02*s, y + .1*s, z, .028*s, 1.3, .7, 1); seg(acc, MAT.leafD, V3(x, y + .05*s, z), V3(0, 1, 0), .05*s, .005, .005, 4); }
function screw(acc, x, y, z, s=1, ry=0){ cyl(acc, MAT.brassD, .012*s, .012*s, .06*s, x, y, z, 8); cyl(acc, MAT.brass, .03*s, .03*s, .018*s, x, y + .06*s, z, 12, ry);
  acc.add(new THREE.BoxGeometry(.05*s, .005, .008*s), MAT.brassD, AT(x, y + .08*s, z, ry)); }
function coil(acc, mat, x, y, z, h, R, turns=5, tr=.012){ const pts = []; for (let i=0;i<=turns*10;i++){ const t = i/(turns*10), q = t*Math.PI*2*turns; pts.push(V3(x + Math.cos(q)*R, y + t*h, z + Math.sin(q)*R)); }
  acc.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns*20, tr, 5), mat); }
/* a pocket watch lying face-up */
function pocketWatch(acc, x, y, z, s=1, ry=0){ cyl(acc, MAT.brass, .07*s, .07*s, .025*s, x, y, z, 20);
  dial(acc, AT(x, y + .027*s, z, ry, 1, 1, 1, -Math.PI/2), .058*s, { th:.004, rim:MAT.brassL });
  acc.add(new THREE.TorusGeometry(.022*s, .007*s, 5, 12), MAT.brass, AT(x + Math.sin(ry)*.08*s, y + .012*s, z + Math.cos(ry)*.08*s, ry, 1, 1, 1, -Math.PI/2)); }
/* a few loose bits by a piece: screws, a tiny turning gear */
function bits(g, rng, x, z, s=1){ const a = new Acc();
  screw(a, x, 0, z, .9*s, rng()*3); screw(a, x + .06*s, 0, z - .05*s, .7*s, rng()*3); a.into(g);
  spinGear(g, [MAT.brass, MAT.copper, MAT.patina][Math.floor(rng()*3)], x - .06*s, .012, z + .05*s, .045*s, { flat:true, th:.02, dir:rng() < .5 ? 1 : -1, ph:rng()*6 }); }

/* ── the ground: honey parquet (basket weave) ── */
const TILE = { top:['#EBC287', '#E3B87C'], side:'#9A6238', soilTop:'#8E5A35', soilBot:'#5E3A22' };
function tileMap(){ return canvasTex(256, 256, (g, N) => {
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  const H = N/2;
  for (const [qx, qy, vert] of [[0, 0, 1], [H, 0, 0], [0, H, 0], [H, H, 1]]) {
    for (let i=0;i<4;i++){ g.fillStyle = i%2 ? 'rgba(150,90,40,.06)' : 'rgba(255,255,255,.12)';
      if (vert) g.fillRect(qx + i*H/4, qy, H/4, H); else g.fillRect(qx, qy + i*H/4, H, H/4);
      g.strokeStyle = 'rgba(110,60,25,.16)'; g.lineWidth = 2; g.beginPath();
      if (vert) { g.moveTo(qx + i*H/4, qy); g.lineTo(qx + i*H/4, qy + H); } else { g.moveTo(qx, qy + i*H/4); g.lineTo(qx + H, qy + i*H/4); } g.stroke(); }
    g.strokeStyle = 'rgba(110,60,25,.22)'; g.lineWidth = 3; g.strokeRect(qx + 1.5, qy + 1.5, H - 3, H - 3); }
  // a brass inlay dot in the middle of the tile
  g.fillStyle = 'rgba(255,214,120,.9)'; g.beginPath(); g.arc(H, H, 7, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(150,100,30,.4)'; g.lineWidth = 2; g.stroke();
}); }

/* ── env: the walnut block gets a brass band under the tiles and big half-sunk gears on its two front faces (they turn too) ── */
function buildEnv(){
  const L = V.L, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const a = new Acc(), half = (L + .04)/2 + .006, S2 = L + .07;
  for (const [x, z, w, d] of [[0, half, S2, .03], [0, -half, S2, .03], [half, 0, .03, S2], [-half, 0, .03, S2]]) {
    a.add(new THREE.BoxGeometry(w, .07, d), MAT.brass, AT(x, -.1, z)); a.add(new THREE.BoxGeometry(w, .035, d), MAT.walnutD, AT(x, -.56, z)); }
  const n = Math.round(L*3);
  for (let i=0;i<n;i++){ const u = -L/2 + (i + .5)*L/n;
    for (const [x, z, ry] of [[u, half + .016, 0], [half + .016, u, Math.PI/2]]) a.add(new THREE.CylinderGeometry(.014, .014, .012, 10).rotateX(Math.PI/2), MAT.brassD, AT(x, -.1, z, ry)); }
  a.into(env);
  // meshing pairs on each front face: a big brass gear and a smaller copper one, counter-turning
  const R1 = .23, R2 = .14;
  for (const [u, c] of [[-L*.26, 0], [L*.2, 1]]) {
    const ua = u, ub = u + (R1 + R2)*.9*(c ? -1 : 1);
    spinGear(env, c ? MAT.copper : MAT.brass, ua, -.33, half + .02, R1, { ry:0, dir:1, th:.035 });
    spinGear(env, c ? MAT.brass : MAT.patina, ub, -.28, half + .02, R2, { ry:0, dir:-1, th:.035, ph:.3 });
    spinGear(env, c ? MAT.copper : MAT.brass, half + .02, -.34, -ua*.8, R1, { ry:Math.PI/2, dir:-1, th:.035 });
    spinGear(env, c ? MAT.patina : MAT.copper, half + .02, -.28, -ub*.8, R2, { ry:Math.PI/2, dir:1, th:.035, ph:.3 }); }
  env.traverse(o => { if (o.isMesh) o.castShadow = false; });
  if (V.ring >= 3) { const c = cellPos(.5, 5.5); V.framePts.push(V3(c.x, TILE_TOP + 3.1, c.z)); }
}

/* ── buildings (Reading) ── */
/* gable roof prism: w along x, depth d along z, height h, standing on y */
function gable(acc, mat, w, d, h, x, y, z, ry=0){ const s = new THREE.Shape(); s.moveTo(-w/2, 0); s.lineTo(w/2, 0); s.lineTo(0, h); s.closePath();
  acc.add(new THREE.ExtrudeGeometry(s, { depth:d, bevelEnabled:false }).translate(0, 0, -d/2), mat, AT(x, y, z, ry)); }
/* Clockmaker's shop (2×2): a walnut house with a verdigris gable roof, a glowing bay window full of little clocks,
   a big dial in the gable, a turning gear on the side wall, a chimney puffing */
function shop(g){
  const a = new Acc();
  rb(a, MAT.walnutD, 1.72, .05, 1.72, 0, 0, 0, 0, .025);
  rb(a, MAT.cream, 1.2, .56, 1.0, -.08, .05, -.12, 0, .05);
  rb(a, MAT.walnut, 1.26, .08, 1.06, -.08, .05, -.12, 0, .03);
  for (const x of [-.66, .5]) for (const z of [-.6, .36]) rb(a, MAT.walnut, .08, .56, .08, x, .05, z, 0, .02);
  // roof: the gable faces the camera side (+z)
  gable(a, MAT.patina, 1.42, 1.18, .5, -.08, .61, -.12);
  rb(a, MAT.patinaD, .06, .06, 1.24, -.08, 1.08, -.12, 0, .02);
  for (let i=0;i<5;i++) a.add(new THREE.BoxGeometry(1.42 - i*.26, .018, 1.2), MAT.patinaL, AT(-.08, .66 + i*.09, -.12));
  dial(a, AT(-.08, .82, .48), .17);
  // bay window (+z): a glowing box with mullions and tiny clocks on shelves
  rb(a, MAT.walnut, .66, .06, .22, -.08, .1, .48, 0, .02);
  rb(a, MAT.glow, .6, .3, .16, -.08, .16, .47, 0, .02);
  for (const x of [-.3, -.08, .14]) rb(a, MAT.walnutL, .025, .32, .025, x, .16, .56, 0, .006);
  rb(a, MAT.walnutL, .66, .025, .025, -.08, .31, .56, 0, .006);
  rb(a, MAT.copper, .72, .05, .26, -.08, .46, .48, 0, .02);
  // door on the +x face with a round window
  rb(a, MAT.walnutL, .03, .36, .24, .53, .05, -.1, 0, .02); a.add(new THREE.CylinderGeometry(.05, .05, .012, 14).rotateZ(Math.PI/2), MAT.glow, AT(.55, .32, -.1));
  ball(a, MAT.brass, .555, .2, -.02, .018);
  // chimney + puff
  cyl(a, MAT.walnutL, .07, .07, .4, -.5, .9, -.45, 12); cyl(a, MAT.brass, .085, .085, .04, -.5, 1.28, -.45, 12); puff(a, -.46, 1.44, -.45, .9);
  // a bench and a potted plant by the window
  rb(a, MAT.walnutL, .34, .03, .1, .52, .16, .56, Math.PI/2*0, .01); for (const x of [.38, .66]) rb(a, MAT.walnutD, .03, .16, .08, x, 0, .56, 0, .005);
  sprout(a, -.62, 0, .66, 1.4); sprout(a, .72, 0, -.7, 1.3, MAT.rose);
  a.into(g);
  // a big gear turning on the side wall (+x), and a small one meshing
  spinGear(g, MAT.brass, .58, .7, -.42, .14, { ry:Math.PI/2, dir:1 }); spinGear(g, MAT.copper, .58, .52, -.24, .09, { ry:Math.PI/2, dir:-1, ph:.2 });
  glowSprite(g, V3(-.08, .3, .6), .8, 0xFFC56A, .35);
  const f = rngFrom(23); bits(g, f, .72, .72, 1);
}
/* Cuckoo house: a steep-roofed walnut chalet on a post, a dial on its front, a little cuckoo peeking from its round door,
   pine-cone weights on chains below */
function cuckoo(g){
  const a = new Acc(), r = rngFrom(41), q = FACE;
  rb(a, MAT.walnutD, .44, .05, .44, 0, 0, 0, q, .02);
  cyl(a, MAT.walnut, .05, .06, .38, 0, .05, 0, 10);
  rb(a, MAT.honey, .42, .36, .3, 0, .42, 0, q, .03);
  // steep roof along the face direction
  const roof = (s) => { const [ox, oz] = [Math.cos(q)*s*.12, -Math.sin(q)*s*.12]; a.add(new THREE.BoxGeometry(.3, .03, .42), MAT.walnut, AT(ox, .87, oz, q, 1, 1, 1, 0, -s*.75)); };
  roof(-1); roof(1); ball(a, MAT.brass, 0, .95, 0, .025);
  const [fx, fz] = onFace(.155);
  dial(a, FM(fx, .6, fz), .1);
  // the cuckoo door: a round opening with a rose bird peeking out
  const [dx, dz] = onFace(.16); a.add(new THREE.CylinderGeometry(.045, .045, .01, 14).rotateX(Math.PI/2), MAT.ink, FM(dx, .78, dz));
  const [bx, bz] = onFace(.2); ball(a, MAT.rose, bx, .78, bz, .035); ball(a, MAT.ink, bx + Math.cos(q)*.015 + Math.sin(q)*.028, .79, bz - Math.sin(q)*.015 + Math.cos(q)*.028, .006);
  a.add(new THREE.ConeGeometry(.012, .035, 6).rotateX(Math.PI/2), MAT.brass, FM(...[bx + Math.sin(q)*.035, .775, bz + Math.cos(q)*.035]));
  // carved leaves either side
  for (const s of [-1, 1]) { const [lx, lz] = onFace(.155); ball(a, MAT.leafD, lx + Math.cos(q)*s*.15, .5, lz - Math.sin(q)*s*.15, .04, 1, 1.4, .5); }
  // weights on chains
  for (const s of [-1, 1]) { const [cx, cz] = onFace(.1); const x = cx + Math.cos(q)*s*.07, z = cz - Math.sin(q)*s*.07, y0 = .42 - (s > 0 ? .08 : .14);
    cyl(a, MAT.brassD, .004, .004, .42 - y0, x, y0, z, 4); ball(a, MAT.brass, x, y0 - .02, z, .03, 1, 1.6, 1); }
  a.into(g); bits(g, r, .3, .3, .8);
}
/* Music box: an open honey box with a turning pinned drum inside and a turning carousel of three birds on top; a key on its side */
function musicBox(g){
  const a = new Acc(), r = rngFrom(51), q = FACE;
  rb(a, MAT.walnutD, .62, .05, .5, 0, 0, 0, q, .02);
  rb(a, MAT.honey, .56, .26, .42, 0, .05, 0, q, .04);
  rb(a, MAT.rose, .58, .04, .44, 0, .2, 0, q, .02);
  // open lid leaning back, its inside rose with a small mirror
  const [lx, lz] = onFace(-.24); a.add(rgeo(.56, .03, .4, .015), MAT.honeyL, AT(lx, .48, lz, q, 1, 1, 1, -1.25));
  // top plate + carousel post
  rb(a, MAT.brassL, .44, .02, .3, 0, .31, 0, q, .01); cyl(a, MAT.brass, .015, .015, .22, 0, .33, 0, 8);
  a.into(g);
  // carousel (turns around y) with three tiny birds on poles and a striped canopy
  const car = new THREE.Group(); car.position.y = .33; car.userData.anim = { t:'yaw', k:.35 }; g.add(car);
  const c = new Acc(); cyl(c, MAT.cream, .14, .14, .025, 0, 0, 0, 20);
  for (let i=0;i<3;i++){ const t = i/3*Math.PI*2, x = Math.cos(t)*.1, z = Math.sin(t)*.1; cyl(c, MAT.brassD, .005, .005, .2, x, 0, z, 5);
    ball(c, [MAT.rose, MAT.patina, MAT.copper][i], x, .09, z, .028, 1.3, 1, 1); }
  c.add(new THREE.ConeGeometry(.17, .08, 12), MAT.rose, AT(0, .24, 0)); ball(c, MAT.brass, 0, .29, 0, .02); c.into(car);
  // pinned drum visible at the front edge
  const [dx, dz] = onFace(.17); const drum = new THREE.Group(); drum.position.set(dx, .16, dz); drum.rotation.order = 'YXZ'; drum.rotation.set(0, q + Math.PI/2, 0);
  const inner = new THREE.Group(); inner.userData.anim = { t:'spin', k:1.2 }; drum.add(inner); g.add(drum);
  const d = new Acc(); d.add(new THREE.CylinderGeometry(.045, .045, .3, 14).rotateX(Math.PI/2), MAT.brass); for (let i=0;i<14;i++){ const t = i*2.4; ball(d, MAT.brassL, Math.cos(t)*.046, Math.sin(t)*.046, -.13 + i*.02, .007); } d.into(inner);
  // wind-up key on the side (turns slowly)
  const [kx, kz] = onFace(.3, q + Math.PI/2); const key = new THREE.Group(); key.position.set(kx, .18, kz); key.rotation.y = q + Math.PI/2; g.add(key);
  const kin = new THREE.Group(); kin.userData.anim = { t:'spin', k:.4 }; key.add(kin); const k2 = new Acc(); windKey(k2, .8); k2.into(kin);
  bits(g, r, -.3, .3, .8);
}
/* a wind-up key in the local xy plane, stem along +z (for spinning about z) */
function windKey(acc, s=1){ acc.add(new THREE.CylinderGeometry(.012*s, .012*s, .08*s, 8).rotateX(Math.PI/2), MAT.brassD, AT(0, 0, .04*s));
  for (const sx of [-1, 1]) acc.add(new THREE.TorusGeometry(.04*s, .013*s, 6, 14), MAT.brass, AT(sx*.045*s, 0, .09*s));
  acc.add(new THREE.SphereGeometry(.018*s, 10, 8), MAT.brassL, AT(0, 0, .09*s)); }
/* Wind-up house: a round walnut cottage with a verdigris cone roof, glowing round windows and a big brass key on top */
function windHouse(g){
  const a = new Acc(), r = rngFrom(61);
  cyl(a, MAT.walnutD, .4, .42, .05, 0, 0, 0, 24);
  cyl(a, MAT.cream, .3, .31, .38, 0, .05, 0, 24); cyl(a, MAT.walnut, .32, .32, .05, 0, .05, 0, 24); cyl(a, MAT.walnut, .33, .33, .04, 0, .41, 0, 24);
  a.add(new THREE.ConeGeometry(.4, .34, 24), MAT.patina, AT(0, .62, 0)); a.add(new THREE.TorusGeometry(.36, .02, 6, 28).rotateX(Math.PI/2), MAT.patinaD, AT(0, .47, 0));
  for (const t of [FACE, FACE + 1.2, FACE - 1.2]) { const [x, z] = onFace(.305, t); a.add(new THREE.CylinderGeometry(.06, .06, .012, 16).rotateX(Math.PI/2), MAT.glow, FM(x, .25, z, t));
    a.add(new THREE.TorusGeometry(.064, .012, 6, 16), MAT.brass, FM(x, .25, z, t)); }
  const [dx, dz] = onFace(.29, FACE + .55); rb(a, MAT.walnutL, .14, .22, .03, dx, .05, dz, FACE + .55, .02);
  a.into(g);
  // the big key on the roof ridge, turning about the vertical
  const key = new THREE.Group(); key.position.y = .82; key.rotation.x = -Math.PI/2; g.add(key);
  const kin = new THREE.Group(); kin.userData.anim = { t:'spin', k:.25 }; key.add(kin); const k2 = new Acc(); windKey(k2, 1.9); k2.into(kin);
  glowSprite(g, V3(0, .25, 0), .8, 0xFFC56A, .22); bits(g, r, .33, .33, .8);
}
/* Orrery: a brass stand under a glowing sun, three little planets on arms turning round it */
function orrery(g){
  const a = new Acc(), r = rngFrom(71);
  cyl(a, MAT.walnutD, .36, .38, .05, 0, 0, 0, 24); cyl(a, MAT.walnut, .3, .32, .1, 0, .05, 0, 24);
  a.add(new THREE.TorusGeometry(.31, .015, 6, 30).rotateX(Math.PI/2), MAT.brass, AT(0, .15, 0));
  cyl(a, MAT.brass, .04, .05, .38, 0, .15, 0, 12); ball(a, MAT.sun, 0, .66, 0, .1);
  a.add(new THREE.TorusGeometry(.35, .01, 6, 36).rotateX(Math.PI/2 - .18), MAT.brassL, AT(0, .62, 0));
  a.into(g);
  const arms = new THREE.Group(); arms.position.y = .53; arms.userData.anim = { t:'yaw', k:.5 }; g.add(arms);
  const b = new Acc();
  [[.3, .1, MAT.patina, .045, 0], [.22, .02, MAT.rose, .035, 2.2], [.36, .14, MAT.copper, .055, 4.1]].forEach(([R, y, m, pr, t]) => {
    const x = Math.cos(t)*R, z = Math.sin(t)*R; seg(b, MAT.brassD, V3(0, 0, 0), V3(x, y, z), Math.hypot(R, y), .006, .006, 4); ball(b, m, x, y, z, pr);
    if (m === MAT.copper) b.add(new THREE.TorusGeometry(pr*1.6, .006, 4, 20).rotateX(Math.PI/2 - .4), MAT.brassL, AT(x, y, z)); });
  b.into(arms);
  glowSprite(g, V3(0, .66, 0), .7, 0xFFB94A, .5); bits(g, r, .33, -.3, .8);
}
/* Spring works: an open walnut shed with a copper roof, a giant coil spring and a bench of gears */
function springWorks(g){
  const a = new Acc(), r = rngFrom(81), q = FACE;
  rb(a, MAT.walnutD, .78, .05, .66, 0, 0, 0, q, .02);
  for (const [u, v] of [[-.32, -.26], [.32, -.26], [-.32, .26], [.32, .26]]) { const x = Math.cos(q)*u + Math.sin(q)*v, z = -Math.sin(q)*u + Math.cos(q)*v; cyl(a, MAT.walnut, .025, .025, .56, x, .05, z, 8); }
  const rf = (s) => { const x = -Math.sin(q)*s*.16, z = -Math.cos(q)*s*.16; a.add(new THREE.BoxGeometry(.8, .03, .38), MAT.copper, AT(x, .66, z, q, 1, 1, 1, s*-.42)); };
  rf(-1); rf(1); a.add(new THREE.CylinderGeometry(.02, .02, .82, 8).rotateZ(Math.PI/2), MAT.copperD, AT(0, .74, 0, q));
  coil(a, MAT.brass, -.12, .05, -.02, .42, .1, 7, .016); cyl(a, MAT.brassD, .12, .12, .03, -.12, .05, -.02, 16); cyl(a, MAT.brassD, .12, .12, .03, -.12, .47, -.02, 16);
  rb(a, MAT.walnutL, .26, .03, .14, .16, .18, .12, q, .01); for (const s of [-1, 1]) rb(a, MAT.walnutD, .03, .18, .12, .16 + Math.cos(q)*s*.1, 0, .12 - Math.sin(q)*s*.1, q, .005);
  gearA(a, MAT.copper, AT(.14, .23, .1, 0, 1, 1, 1, -Math.PI/2), .05, .015); gearA(a, MAT.patina, AT(.22, .23, .16, 0, 1, 1, 1, -Math.PI/2), .035, .015);
  a.into(g);
  bits(g, r, -.32, .33, .7);
}

/* ── water / calm (Breathe) ── */
/* Water clock: three brass bowls stepping down a walnut post, water pouring bowl to bowl into a round pool */
function waterClock(g){
  const a = new Acc(), r = rngFrom(91);
  cyl(a, MAT.walnut, .36, .38, .08, 0, 0, 0, 26); cyl(a, MAT.water, .32, .32, .01, 0, .075, 0, 26);
  a.add(new THREE.TorusGeometry(.34, .025, 6, 28).rotateX(Math.PI/2), MAT.brass, AT(0, .085, 0));
  cyl(a, MAT.walnutL, .035, .04, .72, -.12, .05, -.12, 10);
  const B = [[-.12, .72, -.12, .12], [.0, .5, .02, .1], [.1, .3, .12, .085]];
  B.forEach(([x, y, z, R], i) => { a.add(new THREE.SphereGeometry(R, 18, 8, 0, Math.PI*2, Math.PI/2, Math.PI/2), [MAT.brass, MAT.copper, MAT.brass][i], AT(x, y, z));
    cyl(a, MAT.water, R*.92, R*.92, .008, x, y - .012, z, 18); a.add(new THREE.TorusGeometry(R, .01, 5, 18).rotateX(Math.PI/2), MAT.brassL, AT(x, y, z));
    if (i) seg(a, MAT.brassD, V3(-.12, y - .02, -.12), V3(x + .12, 0, z + .12), Math.hypot(x + .12, z + .12), .01, .01, 4);
    const nx = i < 2 ? B[i+1] : [.14, .09, .16]; const sx = x + (nx[0] - x)*.7, sz = z + (nx[2] - z)*.7;
    const c = new THREE.CatmullRomCurve3([V3(x + (nx[0]-x)*.45, y - .01, z + (nx[2]-z)*.45), V3(sx, y - .05, sz), V3(nx[0], nx[1] + .01, nx[2])]);
    a.add(new THREE.TubeGeometry(c, 8, .012, 6), MAT.stream); });
  ball(a, MAT.brassL, -.12, .8, -.12, .03);
  for (let i=0;i<5;i++) ball(a, MAT.stream, .14 + (r()-.5)*.1, .085, .16 + (r()-.5)*.1, .018, 1.4, .3, 1.4);
  a.into(g);
}
/* Brass fountain: a round basin, a two-tier fountain, jets, and a little gear crown turning on top */
function fountain(g){
  const a = new Acc(), r = rngFrom(93);
  cyl(a, MAT.cream, .42, .43, .12, 0, 0, 0, 30); cyl(a, MAT.water, .37, .37, .01, 0, .115, 0, 30);
  a.add(new THREE.TorusGeometry(.4, .03, 6, 32).rotateX(Math.PI/2), MAT.brass, AT(0, .125, 0));
  cyl(a, MAT.patina, .06, .08, .3, 0, .1, 0, 14);
  a.add(new THREE.SphereGeometry(.22, 22, 8, 0, Math.PI*2, Math.PI/2, Math.PI/2), MAT.brass, AT(0, .42, 0)); cyl(a, MAT.water, .2, .2, .008, 0, .405, 0, 22);
  cyl(a, MAT.patina, .035, .05, .22, 0, .4, 0, 12);
  a.add(new THREE.SphereGeometry(.12, 18, 6, 0, Math.PI*2, Math.PI/2, Math.PI/2), MAT.copper, AT(0, .66, 0)); cyl(a, MAT.water, .11, .11, .006, 0, .65, 0, 18);
  for (let i=0;i<8;i++){ const t = i/8*Math.PI*2, c = new THREE.CatmullRomCurve3([V3(Math.cos(t)*.2, .42, Math.sin(t)*.2), V3(Math.cos(t)*.28, .36, Math.sin(t)*.28), V3(Math.cos(t)*.31, .12, Math.sin(t)*.31)]);
    a.add(new THREE.TubeGeometry(c, 8, .01, 5), MAT.stream); }
  for (let i=0;i<5;i++){ const t = i/5*Math.PI*2, c = new THREE.CatmullRomCurve3([V3(Math.cos(t)*.1, .66, Math.sin(t)*.1), V3(Math.cos(t)*.15, .6, Math.sin(t)*.15), V3(Math.cos(t)*.18, .41, Math.sin(t)*.18)]);
    a.add(new THREE.TubeGeometry(c, 8, .008, 5), MAT.stream); }
  a.into(g);
  spinGear(g, MAT.brassL, 0, .74, 0, .08, { flat:true, th:.025, dir:1 });
  { const b = new Acc(); cyl(b, MAT.brassD, .01, .01, .08, 0, .72, 0, 6); ball(b, MAT.brassL, 0, .8, 0, .025); b.into(g); }
  bits(g, r, .34, .34, .7);
}
/* Hourglass: a big hourglass of pale sand in a walnut frame, gently calm */
function hourglass(g){
  const a = new Acc(), r = rngFrom(95), q = FACE;
  rb(a, MAT.walnutD, .44, .05, .44, 0, 0, 0, q, .02);
  cyl(a, MAT.walnut, .2, .2, .06, 0, .05, 0, 6, q); cyl(a, MAT.walnut, .2, .2, .06, 0, .78, 0, 6, q);
  for (let i=0;i<3;i++){ const t = i/3*Math.PI*2 + q; cyl(a, MAT.walnutL, .018, .018, .67, Math.cos(t)*.16, .11, Math.sin(t)*.16, 8); ball(a, MAT.brass, Math.cos(t)*.16, .86, Math.sin(t)*.16, .025); }
  const prof = []; for (let i=0;i<=16;i++){ const t = i/16, y = t*.66, w = .025 + .11*Math.pow(Math.abs(Math.cos(t*Math.PI)), .7); prof.push(new THREE.Vector2(w, y)); }
  a.add(new THREE.LatheGeometry(prof, 20), MAT.glass, AT(0, .11, 0));
  // sand: a heap in the lower bulb, a smaller cone left in the top, a thin stream between
  const low = []; for (let i=0;i<=8;i++){ const t = i/8; low.push(new THREE.Vector2(.12*(1 - t*t)*.95 + .001, t*.17)); } a.add(new THREE.LatheGeometry(low, 18), MAT.sand, AT(0, .12, 0));
  a.add(new THREE.ConeGeometry(.085, .12, 18).rotateX(Math.PI), MAT.sand, AT(0, .58, 0));
  cyl(a, MAT.sand, .006, .006, .2, 0, .3, 0, 5);
  a.into(g); bits(g, r, .3, -.3, .7);
}
/* Cog pond: a pond with a gear-toothed brass rim, lily pads and a wind-up toy boat */
function cogPond(g){
  const a = new Acc(), r = rngFrom(97);
  a.add(gearGeo(.45, 22, .07), MAT.brass, AT(0, .035, 0, 0, 1, 1, 1, -Math.PI/2));
  cyl(a, MAT.water, .4, .4, .02, 0, .045, 0, 30);
  for (const [x, z, s] of [[-.18, .1, 1], [.12, -.2, .8], [-.05, -.24, .7]]) { a.add(new THREE.CylinderGeometry(.07*s, .07*s, .008, 14, 1, false, .4, Math.PI*1.8), MAT.leaf, AT(x, .07, z)); }
  ball(a, MAT.roseL, -.18, .085, .1, .025, 1, .7, 1);
  // toy boat
  rb(a, MAT.rose, .16, .05, .08, .14, .06, .12, FACE, .02); rb(a, MAT.cream, .07, .06, .05, .14, .11, .12, FACE, .015);
  cyl(a, MAT.brass, .018, .018, .06, .12, .17, .1, 10);
  a.into(g);
}

/* ── tall landmarks (Vocab): cog pines, pendulum trees, armillary trees ── */
function cogPine(g, s){
  const r = rngFrom(s.x*5 + s.z*13 + 1), h = s.h || 1.2, a = new Acc();
  cyl(a, MAT.pot, .12, .14, .09, 0, 0, 0, 14); cyl(a, MAT.walnut, .03, .045, h*.3, 0, .09, 0, 8);
  a.into(g);
  const tiers = 5, pal = s.alt ? [MAT.patina, MAT.patinaD, MAT.patinaL] : [MAT.patinaD, MAT.patina, MAT.leaf];
  for (let i=0;i<tiers;i++){ const t = i/(tiers - 1), R = .34 - t*.24, y = .12 + h*.22 + t*h*.62;
    spinGear(g, pal[i%3], 0, y, 0, R, { flat:true, th:.06, dir:i%2 ? 1 : -1, hub:MAT.walnut, ph:i }); }
  const b = new Acc(); cyl(b, MAT.walnut, .02, .025, h*.62, 0, .09 + h*.25, 0, 8);
  gearA(b, MAT.brassL, FM(0, .2 + h*.9, 0), .07, .025); ball(b, MAT.glow, 0, .2 + h*.9, .015, .02);
  b.into(g); glowSprite(g, V3(0, .2 + h*.9, 0), .3, 0xFFC56A, .3);
  bits(g, r, .28, .26, .7);
}
function pendulumTree(g, s){
  const a = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 5), h = s.h || 1.2;
  cyl(a, MAT.walnutD, .13, .15, .06, 0, 0, 0, 14);
  const trunk = new THREE.CatmullRomCurve3([V3(0, .05, 0), V3(.03, h*.3, 0), V3(-.02, h*.5, .01)]); a.add(new THREE.TubeGeometry(trunk, 8, .045, 8), MAT.walnut);
  const Y = h*.5 + .2;
  ball(a, MAT.patina, 0, Y, 0, .3, 1, .88, 1); ball(a, MAT.patinaL, -.1, Y + .12, .12, .14); ball(a, MAT.patinaD, .16, Y - .05, -.08, .16);
  a.add(new THREE.TorusGeometry(.31, .012, 6, 30).rotateX(Math.PI/2), MAT.brass, AT(0, Y - .06, 0));
  a.into(g);
  // three pendulums hang under the canopy and swing
  for (let i=0;i<3;i++){ const t = FACE + (i - 1)*1.0, [px, pz] = onFace(.2, t);
    const pv = new THREE.Group(); pv.position.set(px, Y - .16, pz); pv.rotation.y = t; g.add(pv);
    const sw = new THREE.Group(); sw.userData.anim = { t:'swing', amp:.28, f:2.2, ph:i*1.3 }; pv.add(sw);
    const b = new Acc(); cyl(b, MAT.brassD, .004, .004, .2, 0, -.2, 0, 4); b.add(new THREE.CylinderGeometry(.038, .038, .014, 16).rotateZ(Math.PI/2).rotateY(Math.PI/2), [MAT.brass, MAT.copper, MAT.brassL][i], AT(0, -.22, 0)); b.into(sw); }
  bits(g, r, .28, .28, .7);
}
function armillary(g, s){
  const a = new Acc(), r = rngFrom(s.x*11 + s.z*5 + 2), h = s.h || 1.1;
  cyl(a, MAT.walnutD, .14, .16, .06, 0, 0, 0, 16); cyl(a, MAT.walnut, .05, .07, h*.5, 0, .06, 0, 12); cyl(a, MAT.brass, .08, .06, .05, 0, .06 + h*.5, 0, 12);
  const Y = h*.5 + .34;
  ball(a, MAT.sun, 0, Y, 0, .07);
  a.add(new THREE.TorusGeometry(.26, .016, 6, 36), MAT.brass, AT(0, Y, 0, FACE));
  a.add(new THREE.TorusGeometry(.26, .016, 6, 36).rotateX(Math.PI/2), MAT.brassD, AT(0, Y, 0, 0, 1, 1, 1, .4));
  a.into(g);
  const ring = new THREE.Group(); ring.position.y = Y; ring.userData.anim = { t:'yaw', k:.4 }; g.add(ring);
  const b = new Acc(); b.add(new THREE.TorusGeometry(.22, .014, 6, 32), MAT.copper, AT(0, 0, 0, 0, 1, 1, 1, 0, .5)); ball(b, MAT.patina, .22*Math.cos(.5), .22*Math.sin(.5), 0, .035); b.into(ring);
  glowSprite(g, V3(0, Y, 0), .55, 0xFFB94A, .45); bits(g, r, .28, .28, .7);
}

/* ── growing pieces (Sudoku / Math): gear towers, one tier per stage ── */
function fillTower(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 3), Y = .07;
  const cols = [MAT.brass, MAT.copper, MAT.patina, MAT.brassL, MAT.rose];
  if (s.kind === 'stack') {
    // a walnut plinth, a brass axle growing, horizontal gears stacked on it, smaller each tier; a glowing lamp crowns stage 5
    cyl(a, MAT.walnut, .2, .22, .06, 0, Y, 0, 18);
    const top = Y + .06 + stage*.13; cyl(a, MAT.brassD, .018, .018, top - Y, 0, Y, 0, 8);
    if (stage >= 5) { cyl(a, MAT.brass, .05, .04, .04, 0, top, 0, 12); ball(a, MAT.glow, 0, top + .08, 0, .055); a.add(new THREE.ConeGeometry(.07, .06, 12), MAT.copper, AT(0, top + .16, 0)); }
    a.into(host);
    for (let i=0;i<stage;i++) spinGear(host, cols[i%4], 0, Y + .12 + i*.13, 0, .3 - i*.035, { flat:true, th:.045, dir:i%2 ? 1 : -1, hub:MAT.walnut, ph:i*.7 });
    if (stage >= 5) glowSprite(host, V3(0, top + .08, 0), .5, 0xFFC56A, .45);
  } else {
    // a walnut frame standing toward the camera; standing gears climb it in a zigzag, meshing; stage 5 = a dial on top
    const q = FACE, [bx, bz] = [0, 0];
    rb(a, MAT.walnut, .56, .06, .2, bx, Y, bz, q, .02);
    const H = .16 + stage*.13; for (const sx of [-1, 1]) rb(a, MAT.walnutL, .04, H, .04, Math.cos(q)*sx*.24, Y + .06, -Math.sin(q)*sx*.24, q, .01);
    rb(a, MAT.walnutL, .52, .04, .04, 0, Y + .06 + H, 0, q, .01);
    if (stage >= 5) { const [fx, fz] = onFace(.03); dial(a, FM(fx, Y + .06 + H + .14, fz), .12); cyl(a, MAT.brass, .01, .01, .04, 0, Y + .06 + H + .26, 0, 6); ball(a, MAT.glow, 0, Y + .06 + H + .31, 0, .025); }
    a.into(host);
    const P = [[-.1, .17, .12], [.1, .34, .1], [-.08, .5, .09], [.09, .64, .075]];
    for (let i=0;i<Math.min(stage, 4);i++){ const [u, y, R] = P[i], [fx, fz] = onFace(.02); spinGear(host, cols[(i + 1)%5], fx + Math.cos(q)*u, Y + y, fz - Math.sin(q)*u, R, { ry:q, dir:i%2 ? 1 : -1, th:.035, ph:i }); }
    if (stage >= 5) glowSprite(host, V3(0, Y + H + .37, 0), .35, 0xFFC56A, .45);
  }
  // spare parts in a tray: fewer as the tower takes them
  const b = new Acc(), left = Math.max(0, 5 - stage);
  for (let i=0;i<left;i++) screw(b, -.32 + (i%3)*.07, Y, .32 - Math.floor(i/3)*.07, .8, r()*3);
  if (b.m.size) b.into(host);
  host.userData.stage = stage;
}

/* ── To-dos: parquet walk, gear stepping stones, dial lamp, spring crate, bench, wind-up key; brass rails ── */
function path(g, s){
  const sl = new THREE.Mesh(G.path, MAT.plank); sl.position.y = .0175; sl.receiveShadow = true; sl.userData.ghostHide = true; g.add(sl);
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0, Y = .035; g.userData.ghostMode = 'marker';
  const trim = () => { for (const [x, z, w, d] of [[0, .47, .96, .025], [0, -.47, .96, .025], [.47, 0, .025, .96], [-.47, 0, .025, .96]]) a.add(new THREE.BoxGeometry(w, .012, d), MAT.brass, AT(x, Y, z)); };
  if (v === 0) { trim(); a.add(new THREE.BoxGeometry(.03, .01, .96), MAT.brassL, AT(0, Y, 0)); pocketWatch(a, .22, Y, -.2, 1.1, .6); a.into(g); return; }
  if (v === 1) { a.into(g); [[-.22, -.2, .12], [.16, -.12, .1], [-.1, .2, .1], [.24, .24, .09]].forEach(([x, z, R], i) =>
      spinGear(g, [MAT.brass, MAT.copper, MAT.patina, MAT.brassL][i], x, Y + .012, z, R, { flat:true, th:.025, dir:i%2 ? 1 : -1, ph:i })); return; }
  if (v === 2) { cyl(a, MAT.walnutD, .08, .09, .05, 0, Y); cyl(a, MAT.brassD, .018, .018, .5, 0, Y + .05, 0, 8);
    const [fx, fz] = onFace(.03); dial(a, FM(fx, Y + .42, fz), .075); ball(a, MAT.glow, 0, Y + .62, 0, .06); a.add(new THREE.ConeGeometry(.08, .06, 12), MAT.patina, AT(0, Y + .7, 0));
    a.into(g); glowSprite(g, V3(0, Y + .62, 0), .45, 0xFFC56A, .6); bits(g, r, -.24, .24, .6); return; }
  if (v === 3) { rb(a, MAT.honey, .28, .2, .24, -.08, Y, -.06, .3, .02); rb(a, MAT.walnut, .3, .03, .26, -.08, Y + .2, -.06, .3, .01);
    coil(a, MAT.brass, -.12, Y + .2, -.06, .14, .04, 5, .008); coil(a, MAT.copper, -.02, Y + .2, -.1, .1, .03, 4, .007);
    gearA(a, MAT.patina, AT(.18, Y + .012, .2, 0, 1, 1, 1, -Math.PI/2), .07, .02); a.into(g); return; }
  if (v === 4) { rb(a, MAT.walnutL, .44, .04, .16, 0, Y + .16, 0, FACE, .015); rb(a, MAT.walnutL, .44, .12, .03, -Math.sin(FACE)*.07, Y + .2, -Math.cos(FACE)*.07, FACE, .01);
    for (const s2 of [-1, 1]) { const ox = Math.cos(FACE)*s2*.18, oz = -Math.sin(FACE)*s2*.18; rb(a, MAT.brassD, .03, .16, .14, ox, Y, oz, FACE, .008); }
    a.into(g); const b = new Acc(); sprout(b, .26, Y, .26, 1.1); b.into(g); return; }
  // v5: a big wind-up key planted in the parquet, turning slowly
  cyl(a, MAT.brassD, .07, .08, .03, 0, Y, 0, 14); a.into(g);
  const key = new THREE.Group(); key.position.y = Y + .02; key.rotation.x = -Math.PI/2; g.add(key);
  const kin = new THREE.Group(); kin.userData.anim = { t:'spin', k:.3 }; key.add(kin); const k2 = new Acc(); windKey(k2, 2.6); k2.into(kin);
}
function fence(g, s){
  const a = new Acc(), L = s.len;
  const run = u => s.edge === 'w' ? [ -.45, u, Math.PI/2 ] : [ u, .45, 0 ];
  for (let i=0;i<=L*2;i++){ const [x, z] = run(i/2 - L/2); cyl(a, MAT.walnut, .03, .03, .26, x, 0, z, 10); ball(a, MAT.brass, x, .29, z, .035); cyl(a, MAT.brassD, .045, .045, .03, x, 0, z, 10); }
  for (let i=0;i<L;i++){ const [x, z, ry] = run(i - (L-1)/2);
    a.add(new THREE.CylinderGeometry(.018, .018, 1, 8).rotateZ(Math.PI/2), MAT.brass, AT(x, .23, z, ry)); a.add(new THREE.CylinderGeometry(.013, .013, 1, 8).rotateZ(Math.PI/2), MAT.copper, AT(x, .12, z, ry));
    for (const u of [-.25, .25]) { const [px, pz] = s.edge === 'w' ? [x, z + u] : [x + u, z]; a.add(new THREE.TorusGeometry(.045, .01, 5, 14), MAT.brassD, AT(px, .175, pz, ry)); } }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}

/* ── the hero (Gita): the great clock tower (2×2) — walnut and cream, four dials with turning hands, a pendulum swinging
   behind a glass window, a belfry with a bell (it rings at completion), a verdigris dome with a turning gear vane ── */
function tower(g){
  const a = new Acc(), q = FACE;
  // round terrace, steps toward the camera, lamps (in g, unscaled)
  cyl(a, MAT.walnutD, .92, .94, .05, 0, 0, 0, 40); cyl(a, MAT.honeyL, .88, .88, .04, 0, .05, 0, 40);
  a.add(new THREE.TorusGeometry(.86, .018, 6, 48).rotateX(Math.PI/2), MAT.brass, AT(0, .09, 0));
  const [sx, sz] = onFace(.95); rb(a, MAT.honey, .44, .045, .14, sx, 0, sz, q, .02);
  for (const s of [-1, 1]) { const [bx, bz] = onFace(.74); const x = bx + Math.cos(q)*s*.52, z = bz - Math.sin(q)*s*.52;
    cyl(a, MAT.walnutD, .02, .02, .34, x, .09, z, 8); ball(a, MAT.glow, x, .47, z, .045); a.add(new THREE.ConeGeometry(.055, .05, 10), MAT.patina, AT(x, .53, z)); }
  a.into(g);
  // the tower itself: square to the grid so two dials face the camera; built at unit scale, then scaled up
  const tw = new THREE.Group(); tw.position.y = .09; tw.scale.setScalar(1.18); g.add(tw);
  const b = new Acc();
  // base: walnut, an arched window on the +z face showing the pendulum, a keeper's door on the +x face
  rb(b, MAT.walnut, .8, .68, .8, 0, 0, 0, 0, .06);
  rb(b, MAT.walnutL, .86, .06, .86, 0, 0, 0, 0, .02); rb(b, MAT.walnutL, .86, .05, .86, 0, .66, 0, 0, .02);
  rb(b, MAT.honeyL, .28, .4, .02, 0, .1, .405, 0, .02); b.add(new THREE.CylinderGeometry(.14, .14, .02, 18, 1, false, -Math.PI/2, Math.PI).rotateX(Math.PI/2), MAT.honeyL, AT(0, .5, .405));
  b.add(new THREE.TorusGeometry(.14, .014, 6, 18, Math.PI), MAT.brass, AT(0, .5, .418));
  for (const x of [-.14, .14]) rb(b, MAT.brass, .02, .4, .02, x, .1, .415, 0, .006);
  rb(b, MAT.honey, .02, .34, .2, .405, .06, 0, 0, .02); b.add(new THREE.CylinderGeometry(.1, .1, .02, 16, 1, false, 0, Math.PI).rotateZ(Math.PI/2), MAT.honey, AT(.405, .4, 0));
  ball(b, MAT.brass, .42, .22, .06, .016);
  // clock storey: cream with walnut corner posts, a dial on every face
  rb(b, MAT.cream, .72, .72, .72, 0, .71, 0, 0, .05);
  for (const u of [-1, 1]) for (const v of [-1, 1]) rb(b, MAT.walnut, .08, .74, .08, u*.36, .7, v*.36, 0, .02);
  const dials = [];
  for (let i=0;i<4;i++){ const t = i*Math.PI/2, M = AT(Math.sin(t)*.365, 1.07, Math.cos(t)*.365, t);
    dial(b, M, .28, { hands:false, face:MAT.glowFace, rim:MAT.brass }); dials.push(sub(M, 0, 0, .012)); }
  rb(b, MAT.walnutL, .84, .06, .84, 0, 1.44, 0, 0, .02);
  // belfry posts, a brass ledge, the verdigris dome and finial
  for (const u of [-1, 1]) for (const v of [-1, 1]) cyl(b, MAT.walnut, .04, .04, .4, u*.3, 1.5, v*.3, 10);
  for (const [x, z, w, d] of [[0, .3, .6, .04], [0, -.3, .6, .04], [.3, 0, .04, .6], [-.3, 0, .04, .6]]) { const m = new THREE.BoxGeometry(w, .03, d); b.add(m, MAT.walnutL, AT(x, 1.62, z)); }
  rb(b, MAT.brass, .76, .05, .76, 0, 1.9, 0, 0, .02);
  b.add(new THREE.SphereGeometry(.37, 28, 14, 0, Math.PI*2, 0, Math.PI/2), MAT.patina, AT(0, 1.95, 0));
  for (let i=0;i<8;i++) b.add(new THREE.TorusGeometry(.372, .01, 4, 30, Math.PI/2), MAT.patinaD, AT(0, 1.95, 0, i/8*Math.PI*2));
  cyl(b, MAT.brass, .05, .04, .1, 0, 2.29, 0, 12); cyl(b, MAT.brassD, .012, .012, .2, 0, 2.37, 0, 6);
  b.into(tw);
  dials.forEach(M => turningHands(tw, M, .28));
  // the pendulum behind the window
  { const pv = new THREE.Group(); pv.position.set(0, .6, .38); tw.add(pv);
    const sw = new THREE.Group(); sw.userData.anim = { t:'swing', amp:.22, f:2.4, ph:0 }; pv.add(sw);
    const c = new Acc(); cyl(c, MAT.brassD, .008, .008, .38, 0, -.4, 0, 5); c.add(new THREE.CylinderGeometry(.07, .07, .02, 20).rotateX(Math.PI/2), MAT.brass, AT(0, -.42, 0)); c.into(sw); }
  // the bell (swings when the land is complete)
  { const pv = new THREE.Group(); pv.position.y = 1.84; pv.rotation.y = q; tw.add(pv); const sw = new THREE.Group(); sw.userData.anim = { t:'bell' }; pv.add(sw);
    const prof = [V2(.001, 0), V2(.14, 0), V2(.12, .04), V2(.09, .14), V2(.07, .22), V2(.001, .24)];
    const c = new Acc(); c.add(new THREE.LatheGeometry(prof, 20), MAT.brass, AT(0, -.26, 0)); ball(c, MAT.brassD, 0, -.28, 0, .035); cyl(c, MAT.brassD, .015, .015, .04, 0, -.04, 0, 6); c.into(sw); }
  // gear weathervane on top; two big gears turning half out of the +x wall
  spinGear(tw, MAT.brassL, 0, 2.52, 0, .09, { ry:q, dir:1, th:.025 });
  spinGear(tw, MAT.brass, .42, .46, -.12, .2, { ry:Math.PI/2, dir:1 }); spinGear(tw, MAT.copper, .42, .22, .16, .12, { ry:Math.PI/2, dir:-1, ph:.2 });
  glowSprite(tw, V3(0, 1.07, .3), 1.6, 0xFFE2A8, .16);
  for (const t of [0, Math.PI/2]) glowSprite(tw, V3(Math.sin(t)*.4, 1.07, Math.cos(t)*.4), .6, 0xFFD27E, .3);
  glowSprite(tw, V3(0, .3, .42), .4, 0xFFC56A, .3);
  for (const s of [-1, 1]) { const [bx, bz] = onFace(.74); glowSprite(g, V3(bx + Math.cos(q)*s*.52, .47, bz - Math.sin(q)*s*.52), .3, 0xFFC56A, .45); }
  const f = rngFrom(7); bits(g, f, .78, -.62, 1); bits(g, f, -.62, .78, .9);
}
const V2 = (x, y) => new THREE.Vector2(x, y);

/* ── blueprint: the farm's cells with clockwork pieces; the tower takes the left corner ── */
const MAP = {
  bigbarn:{ name:'Clockmaker’s shop', b:'shop' }, well:{ name:'Water clock', b:'waterClock' }, apple1:{ name:'Cog pine', b:'pine', h:1.2 },
  silo:{ name:'Cuckoo house', b:'cuckoo' }, silohouse:{ name:'Music box', b:'musicBox' }, coop:{ name:'Wind-up house', b:'windHouse' },
  watertower:{ name:'Brass fountain', b:'fountain' }, pump:{ name:'Hourglass', b:'hourglass' }, apple2:{ name:'Pendulum tree', b:'pend', h:1.25 },
  berry1:{ name:'Armillary tree', b:'armil', h:1.1 }, peepal:{ name:'Great clock tower', b:'hero' },
  smallbarn:{ name:'Orrery', b:'orrery' }, openbarn:{ name:'Spring works', b:'springs' },
  pond:{ name:'Cog pond', b:'pond' }, orange1:{ name:'Pendulum tree', b:'pend', h:1.3 },
  apple3:{ name:'Cog pine', b:'pine', alt:true, h:1.3 }, berry2:{ name:'Armillary tree', b:'armil', h:1.0 },
  orange2:{ name:'Cog pine', b:'pine', alt:true, h:1.15 }, apple4:{ name:'Pendulum tree', b:'pend', h:1.2 }
};
const MOVE = { peepal:{ x:0, z:5 }, field1_5:{ x:1, z:1 }, fence3:{ x:0, z:0, edge:'w' } };   // hero to the left corner
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:5, path2_6:4, path3_6:0 };
const PATH_NAME = ['Parquet walk', 'Gear stones', 'Dial lamp', 'Spring crate', 'Walnut bench', 'Wind-up key'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d, ...(MOVE[f.id] || {}) };
  if (f.kind === 'field') { const stack = f.crop === 'Corn' || f.crop === 'Beet';
    return stack ? { ...s, kind:'stack', name:'Gear tower', stages:5 } : { ...s, kind:'frame', name:'Cog ladder', stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'clk', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'clk', b:'fence', edge:s.edge || f.edge, len:f.len, name:'Brass rail' };
  return { ...s, kind:'clk', ...MAP[f.id] };
});
const BUILD = { shop, cuckoo, musicBox, windHouse, orrery, springs:springWorks, waterClock, fountain, hourglass, pond:cogPond,
  pine:cogPine, pend:pendulumTree, armil:armillary, path, fence, hero:tower };

/* decor: parquet, not grass — loose gears lying flat and TURNING, screws, springs, a pocket watch, potted ferns */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19), COL = [MAT.brass, MAT.copper, MAT.patina, MAT.brassL, MAT.rose];
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc(), Y = p.y;
    const spot = (rad=.3) => { const q = r()*6.28, d = .06 + r()*rad; return [p.x + Math.cos(q)*d, p.z + Math.sin(q)*d]; };
    if (!sl || sl === 'later') {
      // a meshing pair of flat gears (the signature: they turn faster as the land fills)
      const [gx, gz] = spot(.12), R1 = .13 + r()*.05, R2 = .08 + r()*.03, t = r()*6.28;
      spinGear(grp, COL[Math.floor(r()*5)], gx, Y + .014, gz, R1, { flat:true, th:.025, dir:1, ph:r()*6 });
      spinGear(grp, COL[Math.floor(r()*5)], gx + Math.cos(t)*(R1 + R2)*.9, Y + .014, gz + Math.sin(t)*(R1 + R2)*.9, R2, { flat:true, th:.025, dir:-1, ph:r()*6 });
      for (let i=0;i<2;i++){ const [sx, sz] = spot(); screw(a, sx, Y, sz, .9, r()*3); }
      const k = r();
      if (k < .3) { const [px, pz] = spot(.26); sprout(a, px, Y, pz, 1.3 + r()*.3, [MAT.pot, MAT.rose, MAT.patina][Math.floor(r()*3)]); }
      else if (k < .5) { const [px, pz] = spot(.26); pocketWatch(a, px, Y, pz, .9, r()*6); }
      else if (k < .65) { const [px, pz] = spot(.26); coil(a, MAT.brass, px, Y, pz, .08, .03, 4, .007); }
      grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) {
      screw(a, p.x + .32, Y, p.z + .32, .9); screw(a, p.x - .3, Y, p.z + .3, .8);
      spinGear(grp, COL[Math.floor(r()*5)], p.x + .3, Y + .012, p.z - .3, .08, { flat:true, th:.02, dir:1, ph:r()*6 });
      spinGear(grp, COL[Math.floor(r()*5)], p.x + .3 - .12, Y + .012, p.z - .3 - .04, .05, { flat:true, th:.02, dir:-1, ph:r()*6 });
      V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if ((Math.abs(x-3) === V.ring && x > 3) || (Math.abs(z-3) === V.ring && z > 3)) { screw(a, p.x + .38, Y, p.z + .38, .8); grp.userData.decor = 'rim'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ── the shared clock: every turning thing reads one phase whose speed rises with pieces placed ── */
let PH = null, lastN = -1;
const gearSpeed = () => .35 + 2.6*Math.min(1, placed.length/40);
function animWalk(o, t, ph){
  if (o.userData.ghost) return;
  const an = o.userData.anim;
  if (an) {
    if (an.t === 'spin') o.rotation.z = (an.ph || 0) + ph*an.k;
    else if (an.t === 'yaw') o.rotation.y = ph*an.k;
    else if (an.t === 'hand') o.rotation.z = ph*an.k;
    else if (an.t === 'swing') o.rotation.z = Math.sin(t*an.f + an.ph)*an.amp;
    else if (an.t === 'bell') o.rotation.z = V.residentsIn ? Math.sin(t*3.2)*.32 : 0;
  }
  const c = o.children; for (let i=0;i<c.length;i++) animWalk(c[i], t, ph);
}
function tick(t, dt){
  if (!V) return;
  const sp = gearSpeed();
  if (!dt || PH == null || lastN < 0) PH = t*sp; else PH += dt*sp;
  lastN = placed.length;
  animWalk(world, t, PH);
  moveResidents(t);
}

/* ── residents: clockwork birds — a flock flies in over the tower, a few hop on the parquet ── */
const BIRD_COL = [[MAT.rose, MAT.roseL], [MAT.patina, MAT.patinaL], [MAT.copper, MAT.honeyL], [MAT.brass, MAT.cream], [MAT.rose, MAT.cream]];
function makeBird(k=0){
  const g = new THREE.Group(), a = new Acc(), [b, l] = BIRD_COL[k % BIRD_COL.length];
  ball(a, b, 0, .09, 0, .07, .9, .85, 1.15); ball(a, l, 0, .075, .04, .05, .8, .7, .9);
  ball(a, b, 0, .15, .065, .048);
  a.add(new THREE.ConeGeometry(.016, .045, 8).rotateX(Math.PI/2), MAT.brass, AT(0, .145, .125));
  for (const sx of [-1, 1]) { ball(a, MAT.ink, sx*.03, .165, .1, .01); ball(a, MAT.roseL, sx*.036, .145, .095, .01, 1, .7, .5); }
  for (let i=0;i<3;i++) a.add(new THREE.BoxGeometry(.03, .008, .08), l, AT((i - 1)*.02, .11, -.1, (i - 1)*.35, 1, 1, 1, .35));
  for (const sx of [-1, 1]) cyl(a, MAT.brassD, .005, .005, .04, sx*.025, 0, 0, 5);
  a.into(g);
  g.userData.wings = [-1, 1].map(sx => { const pv = new THREE.Group(); pv.position.set(sx*.055, .11, 0); g.add(pv);
    const w = new Acc(); ball(w, l, sx*.05, 0, -.01, .055, 1.1, .22, .8); w.add(new THREE.BoxGeometry(.004, .006, .06), MAT.brass, AT(sx*.07, .012, -.01)); w.into(pv); pv.userData.sx = sx; return pv; });
  const key = new THREE.Group(); key.position.set(0, .165, -.03); key.rotation.x = -Math.PI/2; g.add(key);
  const kin = new THREE.Group(); key.add(kin); const kk = new Acc(); windKey(kk, .55); kk.into(kin); g.userData.key = kin;
  return g;
}
const RES_SCALE = 2.3;
function hopCells(){
  const occ = new Set(); SLOTS.forEach(sl => { if (isEdge(sl) || (sl.b === 'path')) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.add((sl.x+a)+','+(sl.z+b)); });
  const out = []; for (let z=1; z<GRID; z++) for (let x=1; x<GRID; x++) if (!occ.has(x+','+z)) out.push([x, z]);
  return out.sort((p, q) => (q[0] + q[1]) - (p[0] + p[1])).slice(0, 3);
}
function moveResidents(t){
  (V && V.res || []).forEach((r, j) => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3), o = r.obj;
    o.userData.key.rotation.z = t*3 + j;
    if (r.kind === 'fly') { const q = t*.45*u.dir + u.ph, R = u.R;
      const x = u.c.x + Math.cos(q)*R, z = u.c.z + Math.sin(q)*R*.8, y = u.y + Math.sin(t*1.7 + j)*.08 + (1 - e)*2.2;
      o.position.set(x + (1 - e)*1.5, y, z - (1 - e)*1.5);
      o.rotation.y = Math.atan2(-Math.sin(q)*u.dir, Math.cos(q)*.8*u.dir);
      o.userData.wings.forEach(w => w.rotation.z = w.userData.sx*(Math.sin(t*16 + j)*.7 + .2)); return; }
    o.userData.wings.forEach(w => w.rotation.z = w.userData.sx*.08);
    if (r.arrive < 1) { const p = u.from.clone().lerp(u.at, 1 - Math.pow(1 - r.arrive, 2.2)); o.position.set(p.x, TILE_TOP + Math.abs(Math.sin(r.arrive*30))*.08, p.z); o.rotation.y = Math.atan2(u.at.x - u.from.x, u.at.z - u.from.z); return; }
    // hop a little loop, stop, peck, hop on
    const cyc = (t*.5 + u.ph) % 3, q = u.ph*2 + Math.floor(t*.5 + u.ph)*1.1 + Math.min(cyc, 1.6)*.9, rr = .18;
    const hopping = cyc < 1.6;
    o.position.set(u.at.x + Math.cos(q)*rr, TILE_TOP + (hopping ? Math.abs(Math.sin(t*9 + j))*.07 : 0), u.at.z + Math.sin(q)*rr);
    o.rotation.y = -q + (hopping ? 0 : .6); o.rotation.x = hopping ? 0 : Math.max(0, Math.sin(t*6))*.35;
  });
}
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.3 - j*.08))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(rs[0].obj.position.y + .3), 10, 0xFFD27E, .6); res(); })); }
async function clockMoveIn(walk){
  V.residentsIn = true; V.res = [];
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const gate = cellPos(3, 7.4), tc = cellPos(.5, 5.5);
  const groups = [
    async () => { const hero = V.pieces.peepal; if (hero && walk) sparkle(hero.position.clone().setY(TILE_TOP + 2.1), 16, 0xFFD27E, .8); },
    async () => { const cs = [cellPos(3, 3), cellPos(3.2, 2.8), cellPos(2.6, 3.4), tc.clone()];
      const rs = [[2.1, 1.75, 1, 0], [1.5, 1.45, -1, 2], [2.5, 2.0, 1, 3.6], [.55, 2.95, -1, 1]].map(([R, y, dir, ph], i) => {
        const o = makeBird(i); o.scale.setScalar(RES_SCALE); return addRes('fly', o, { c:cs[i], R, y:TILE_TOP + y, dir, ph }); });
      moveResidents(0); if (walk) await arrive(rs, 2000); },
    async () => { const rs = hopCells().map(([x, z], i) => { const o = makeBird(i + 2); o.scale.setScalar(RES_SCALE);
        return addRes('hop', o, { at:cellPos(x, z), from:gate.clone().add(V3((i - 1)*.3, 0, i*.15)), ph:i*1.3 }); });
      moveResidents(0); if (walk) await arrive(rs, 2200); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = 2;
}
const MAKE = { bird:() => makeBird(0), hopper:() => makeBird(2) };

export default {
  id:'clock', name:'Clockwork', title:'Your clockwork',
  season:41, dates:'26 Jul–8 Aug', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'water clocks, fountains & hourglasses', tag:'Calm' },
    building:{ label:'shops, cuckoo houses & music boxes',    tag:'Workshop' },
    path:    { label:'parquet walks, lamps & brass rails',    tag:'Path' },
    crop:    { label:'gear towers',                           tag:'Gears' },
    tree:    { label:'cog pines & pendulum trees',            tag:'Tree' },
    special: { label:'the great clock tower',                 tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:TILE, tileMap },
  ghost:{ color:'#FFFFFF', opacity:.46, emissive:.24, dash:'#FFFFFF', dashOpacity:.8 },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><g fill="#F0C258"><circle cx="12" cy="12" r="9"/>' +
    Array.from({ length:10 }, (_, i) => `<rect x="10.6" y="0.8" width="2.8" height="3.4" rx=".6" transform="rotate(${i*36} 12 12)"/>`).join('') +
    '</g><circle cx="12" cy="12" r="6.6" fill="#FFF8EA"/><g stroke="#4B3526" stroke-width="1.3" stroke-linecap="round"><path d="M12 6.4v1.3M12 16.3v1.3M6.4 12h1.3M16.3 12h1.3"/><path d="M12 12 9.6 10.4M12 12l2.4-3.2"/></g><circle cx="12" cy="12" r="1" fill="#C99A3A"/></svg>',
  silhouette:'<g fill="currentColor"><rect x="60" y="4" width="8" height="12"/><path d="M40 40a24 24 0 0 1 48 0z"/><rect x="38" y="40" width="52" height="6"/><rect x="42" y="46" width="6" height="22"/><rect x="80" y="46" width="6" height="22"/><path d="M58 50h12l3 14H55z"/><rect x="36" y="68" width="56" height="42" rx="4"/><circle cx="64" cy="89" r="15" fill-opacity=".35"/><rect x="30" y="110" width="68" height="14" rx="3"/><circle cx="104" cy="104" r="12"/><circle cx="104" cy="104" r="4" fill-opacity=".35"/></g>',
  album:{ image:'assets/clock/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFBF2,#F3E4C8)' },
  css:'.phone[data-theme="clock"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#FBF3E4 58%,#F1E0C2 100%)}',
  env: buildEnv,

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'stack' || s.kind === 'frame') {
      const base = new THREE.Mesh(G.field, s.kind === 'stack' ? MAT.walnutL : MAT.patinaL); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      const host = new THREE.Group(); host.scale.setScalar(1.12); g.add(host); g.userData.plants = host;
      g.userData.regrow = st => fillTower(host, s, st); fillTower(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'clk' ? 1 : 1.12,
  contact: s => s.kind === 'clk' && !['path', 'fence', 'hero', 'pond'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && s.v === 2),
  decor,
  tick,

  residents:[ { id:'bird', name:'Clockwork birds', n:4 }, { id:'hopper', name:'Wind-up robins', n:3 } ],
  moveIn: clockMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('clock:'+d.id, () => { const o = MAKE[d.id](); o.scale.setScalar(3.2); o.rotation.y = .6; return o; }, 168); },
  residentRig(d){ const obj = MAKE[d.id](); obj.scale.setScalar(RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
