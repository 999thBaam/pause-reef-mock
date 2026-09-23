/* WINTER VILLAGE (?theme=winter) — a cozy snowbound hamlet on the farm's 7×7 ring blueprint (every farm slot id maps to a
   winter piece, so rings 6 / 15 / 19, order, pick-3, growth and expansion behave exactly like the farm).
   Trees, lanterns, presents, sleds, benches, the picket fence, the reindeer, wreaths and the decorated tree =
   Kenney Holiday Kit 2.0 (CC0, packed to assets/winter/winter.glb). Log cabins, the lodge, the cocoa stall, the sled shed,
   snowmen, igloos, ice ponds, the hot spring, the ice fountain, snowbanks, string lights, falling snow and steam are
   procedural flat-shaded geometry, merged per material (Acc) so every piece stays pre-renderable.
   Residents = the shared animated Stag / Deer / Fox / Husky (assets/animals, CC0). */
import * as THREE from 'three';
import { rngFrom, TEX, world, fx } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, blob } from '../engine/proc.js';
import { tween } from '../engine/motion.js';
import { FARM, FARM_ORDER } from './farm.js';

const WK = 'winter';
const tplOf = n => KITCACHE[WK] && KITCACHE[WK][n];
/* a Holiday Kit model fitted to [h, w] tiles */
function km(g, name, h, w, x=0, y=0, z=0, rot=0){ const t = tplOf(name); if (!t) { console.warn('missing', name); return null; }
  return addModel(g, name, fitScale(t, h, w), x, y, z, rot, WK); }

const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.9, metalness:0, flatShading:true, ...o });
const W = {
  snow:FM(0xF7FAFE, { roughness:1 }), snowB:FM(0xE3ECF7, { roughness:1 }), snowSh:FM(0xCFDDEE, { roughness:1 }),
  packed:FM(0xDCE6F2, { roughness:1 }), step:FM(0xA9A6BA), stepD:FM(0x8E8AA2),
  log:FM(0xA8653A), logD:FM(0x86502C), logE:FM(0xC98A57), plank:FM(0x9A5E35), plankD:FM(0x6E4226), door:FM(0x5C3722),
  trim:FM(0x2E8C6A), stone:FM(0x9C98AE), stoneD:FM(0x7F7B93), coal:FM(0x2B2A33), carrot:FM(0xF08A2E), twig:FM(0x6B4428),
  scarf:FM(0xD9433B), scarfB:FM(0x3F7FD0), hat:FM(0x34323D), hatBand:FM(0xD9433B),
  ice:new THREE.MeshStandardMaterial({ color:0xBFE4F6, roughness:.12, metalness:0, emissive:0x4A8FB8, emissiveIntensity:.18 }),
  iceD:FM(0x9CCDE8, { roughness:.2 }), iceGlow:new THREE.MeshStandardMaterial({ color:0xD6F3FF, roughness:.15, emissive:0x7CC8F0, emissiveIntensity:.35, flatShading:true }),
  hole:FM(0x2F6E9E, { roughness:.1 }), spring:new THREE.MeshStandardMaterial({ color:0x55CBD2, roughness:.12, emissive:0x136A77, emissiveIntensity:.35 }),
  glow:new THREE.MeshStandardMaterial({ color:0xFFD27A, emissive:0xFFA83A, emissiveIntensity:1.25, roughness:.6 }),
  flame:new THREE.MeshStandardMaterial({ color:0xFFC857, emissive:0xFF9A1F, emissiveIntensity:1.8 }),
  mug:FM(0xF3EDE3), cocoa:FM(0x6B3A1E), awnR:FM(0xD9433B), awnW:FM(0xF7F2EA), gold:FM(0xF4C84A, { emissive:0x6A4A00, emissiveIntensity:.3 }),
  wood:FM(0x8A5A34)
};
/* string-light bulbs: ONE material per colour; they glow softly while building, and twinkle once the village is complete */
const BULBS = [0xFF5A4E, 0xFFD24A, 0x4FD08A, 0x5AB4FF].map(c => new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:.55, roughness:.4 }));
const rbox = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/* ── snow helpers ── */
function mound(acc, x, z, r, h, rng, mat = W.snow){ const g = new THREE.IcosahedronGeometry(1, 1);
  if (rng) { const p = g.attributes.position; for (let i=0;i<p.count;i++){ const k = 1 + (rng()-.5)*.18; p.setXYZ(i, p.getX(i)*k, p.getY(i)*k, p.getZ(i)*k); } }
  acc.add(g, mat, at(x, 0, z, rng ? rng()*3 : 0, r, h, r*(rng ? .8 + rng()*.3 : 1))); }
function icicles(acc, x0, x1, y, z, rng, n = 7){ for (let i=0;i<n;i++){ const x = x0 + (x1-x0)*(i+.5)/n + (rng()-.5)*.03, h = .04 + rng()*.06;
  acc.add(new THREE.ConeGeometry(.012, h, 5).rotateX(Math.PI), W.iceD, at(x, y - h/2, z)); } }
function bulbs(acc, pts, y0, sag, n){                       // a catenary of bulbs between two points
  const [a, b] = pts; for (let i=0;i<=n;i++){ const t = i/n, y = y0 - Math.sin(t*Math.PI)*sag;
    acc.add(new THREE.SphereGeometry(.022, 6, 5), BULBS[i%4], at(a[0] + (b[0]-a[0])*t, y, a[1] + (b[1]-a[1])*t)); } }

/* ── LOG CABIN: stacked round logs, gable roof along x under a thick snow cap, glowing windows on the two faces the camera sees ── */
function cabin(acc, o){
  const { w = .7, d = .6, h = .42, pitch = .62, chimney = true, door = true, winX = 1, winZ = 1, cx = 0, cz = 0, rng } = o;
  const n = 5, r = h/(2*n);
  acc.add(rbox(w*1.04 + .06, .06, d*1.04 + .06), W.stone, at(cx, .03, cz));                          // foundation
  acc.add(rbox(w - r, h, d - r), W.logD, at(cx, .06 + h/2, cz));                                       // wall core
  for (let i=0;i<n;i++){ const y = .06 + r + i*2*r;
    for (const sz of [-1, 1]) acc.add(new THREE.CylinderGeometry(r, r, w + .1, 6).rotateZ(Math.PI/2), i%2 ? W.log : W.logE, at(cx, y, cz + sz*d/2));
    for (const sx of [-1, 1]) acc.add(new THREE.CylinderGeometry(r, r, d + .1, 6).rotateX(Math.PI/2), i%2 ? W.logE : W.log, at(cx + sx*w/2, y + r*.6, cz)); }
  const top = .06 + h, rise = (d/2)*Math.tan(pitch), ov = .1, L = (d/2 + ov)/Math.cos(pitch);
  const gable = new THREE.Shape([new THREE.Vector2(-d/2, 0), new THREE.Vector2(d/2, 0), new THREE.Vector2(0, rise)]);
  const gg = new THREE.ExtrudeGeometry(gable, { depth:.05, bevelEnabled:false }).rotateY(Math.PI/2);
  for (const sx of [-1, 1]) acc.add(gg, W.plank, at(cx + sx*(w/2 - .03) - .025, top, cz));
  for (const sz of [-1, 1]) {
    const mid = new THREE.Vector3(cx, top + rise - Math.sin(pitch)*L/2 + .02, cz + sz*Math.cos(pitch)*L/2);
    acc.add(rbox(w + .2, .035, L), W.plankD, at(mid.x, mid.y, mid.z, 0, 1, 1, 1, sz*pitch));
    acc.add(rbox(w + .24, .06, L + .03), W.snow, at(mid.x, mid.y + .045, mid.z + sz*.005, 0, 1, 1, 1, sz*pitch));
  }
  acc.add(new THREE.CylinderGeometry(.045, .045, w + .24, 7).rotateZ(Math.PI/2), W.snow, at(cx, top + rise + .06, cz));   // ridge drift
  if (rng) icicles(acc, cx - w/2 - .08, cx + w/2 + .08, top - .02 + .02, cz + d/2 + ov*.9, rng, Math.round(w*10));
  if (chimney) { const chx = cx + w*.28, chz = cz - d*.18; acc.add(rbox(.12, rise + .22, .12), W.stone, at(chx, top + (rise + .22)/2 + .05, chz));
    acc.add(rbox(.15, .05, .15), W.snow, at(chx, top + rise + .3, chz)); }
  if (door) { acc.add(rbox(.16, .26, .03), W.door, at(cx - w*.18, .06 + .13, cz + d/2 + r*.9));
    acc.add(rbox(.2, .03, .05), W.trim, at(cx - w*.18, .06 + .275, cz + d/2 + r*.9)); }
  const win = (x, y, z, ry) => { acc.add(rbox(.15, .15, .03), W.trim, at(x, y, z, ry)); acc.add(rbox(.11, .11, .035), W.glow, at(x, y, z, ry)); };
  const wy = .06 + h*.58;
  if (winZ) { for (let i=0;i<winZ;i++) win(cx + (door ? w*.2 : 0) + (winZ > 1 ? (i - .5)*w*.35 : 0), wy, cz + d/2 + r*1.05, 0); }
  if (winX) { for (let i=0;i<winX;i++) win(cx + w/2 + r*1.05, wy, cz + (winX > 1 ? (i - .5)*d*.45 : 0), Math.PI/2); }
  return { top, rise };
}
function snowSkirt(acc, rng, half, n = 10, y = 0){ for (let i=0;i<n;i++){ const a = rng()*6.28, d = half*(.8 + rng()*.2);
  mound(acc, Math.cos(a)*d, Math.sin(a)*d, .08 + rng()*.07, .05 + rng()*.03, rng); } }

/* ── SNOWMAN YARD (Sudoku/Math): a snowman built in stages — a rolling snowball → two balls → head, face + twig arms → scarf + hat → a little friend ── */
const BALL = new THREE.IcosahedronGeometry(1, 2);
function snowman(acc, x, z, st, k = 1, scarf = W.scarf, rot = 0){
  const R = [.15, .11, .08].map(v => v*k); let y = 0;
  const ball = (i) => { const r = R[i]; acc.add(BALL, W.snow, at(x, y + r*.92, z, 0, r, r*.95, r)); y += r*1.75; };
  if (st <= 1) { acc.add(BALL, W.snow, at(x, .085*k, z, 0, .09*k, .085*k, .09*k));                     // a snowball mid-roll, its track behind it
    acc.add(rbox(.1*k, .012, .3*k), W.snowSh, at(x - .12*k*Math.sin(rot+.9), .006, z - .12*k*Math.cos(rot+.9), rot + .9)); return; }
  ball(0); if (st >= 2) ball(1); if (st < 3) return;
  const hy = y + R[2]*.9; ball(2);
  const f = (dx, dy, dz) => new THREE.Vector3(x + dx, dy, z + dz), c = Math.cos(rot), s = Math.sin(rot);
  const face = (fx, fy, fz) => f(fx*c + fz*s, fy, -fx*s + fz*c);
  for (const ex of [-.032, .032]) { const p = face(ex*k, hy + .02*k, R[2]*.92); acc.add(new THREE.SphereGeometry(.012*k, 5, 4), W.coal, at(p.x, p.y, p.z)); }
  { const p = face(0, hy - .005*k, R[2]*1.05); acc.add(new THREE.ConeGeometry(.016*k, .09*k, 6).rotateX(Math.PI/2), W.carrot, at(p.x, p.y, p.z, rot)); }
  for (let i=0;i<3;i++){ const p = face(0, hy - R[2]*1.05 - R[1]*(.35 + i*.45), R[1]*.98); acc.add(new THREE.SphereGeometry(.011*k, 5, 4), W.coal, at(p.x, p.y, p.z)); }
  if (st >= 4) { acc.add(new THREE.TorusGeometry(R[2]*.85, .025*k, 5, 12).rotateX(Math.PI/2), scarf, at(x, hy - R[2]*.8, z));
    const p = face(R[2]*.5, hy - R[2]*1.25, R[2]*.7); acc.add(rbox(.04*k, .1*k, .02*k), scarf, at(p.x, p.y, p.z, rot, 1, 1, 1, 0, .25)); }
  for (const sx of [-1, 1]) { const p = face(sx*R[1]*1.05, y - R[2]*2 - R[1]*.9, 0);
    acc.add(new THREE.CylinderGeometry(.007*k, .01*k, .17*k, 4), W.twig, at(p.x + sx*.06*k*c, p.y + .04*k, p.z - sx*.06*k*s, rot, 1, 1, 1, 0, -sx*1.0)); }
  if (st >= 4) { const ty = y - .01*k;
    acc.add(new THREE.CylinderGeometry(.085*k, .085*k, .012*k, 12), W.hat, at(x, ty, z));
    acc.add(new THREE.CylinderGeometry(.055*k, .058*k, .09*k, 12), W.hat, at(x, ty + .05*k, z));
    acc.add(new THREE.CylinderGeometry(.059*k, .059*k, .02*k, 12), W.hatBand, at(x, ty + .018*k, z)); }
}
function fillYard(host, s, stage){
  host.clear(); const acc = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 5), st = Math.min(5, stage);
  const sc = s.v === 1 ? W.scarfB : W.scarf, rot = .55 + (r()-.5)*.3;
  snowman(acc, -.04, .02, st, 1.35, sc, rot);
  if (st >= 2) for (let i=0;i<(st >= 3 ? 3 : 2);i++) acc.add(BALL, W.snow, at(.3 - i*.1, .035, -.3 + i*.04, 0, .04, .035, .04));   // spare snowballs
  if (st >= 5) snowman(acc, .3, .28, 4, .62, sc === W.scarf ? W.scarfB : W.scarf, rot + .3);
  acc.into(host);
  host.userData.stage = stage;
}
/* ── IGLOO (Sudoku/Math): snow-block courses rise stage by stage until the dome closes; then a tunnel and a warm glow ── */
function fillIgloo(host, s, stage){
  host.clear(); const acc = new Acc(), r = rngFrom(s.x*17 + s.z*5 + 9), st = Math.min(5, stage), R = .33;
  const f = [0, .25, .5, .72, 1, 1][st];
  const dome = new THREE.SphereGeometry(R, 12, 5, 0, Math.PI*2, Math.PI/2*(1 - f), Math.PI/2*f);
  acc.add(dome, W.snowB, at(0, .04, -.02, .3));
  if (st <= 3) for (let i=0;i<3;i++) acc.add(rbox(.1, .07, .08), W.snow, at(.3 - i*.03, .075 + (i === 2 ? .07 : 0), .3 - (i%2)*.1, r()*2));   // block pile
  if (st >= 4) { acc.add(new THREE.CylinderGeometry(.13, .13, .2, 10, 1, false, 0, Math.PI).rotateX(Math.PI/2).rotateZ(Math.PI/2).rotateY(-Math.PI/2), W.snowB, at(0, .04, .3));
    acc.add(new THREE.CircleGeometry(.1, 10, 0, Math.PI), st >= 5 ? W.glow : W.coal, at(0, .04, .401)); }
  if (st >= 5) { acc.add(new THREE.CylinderGeometry(.012, .015, .22, 5), W.twig, at(.3, .15, .28)); acc.add(new THREE.SphereGeometry(.035, 8, 6), W.glow, at(.3, .27, .28)); }
  acc.into(host); host.userData.stage = stage;
}

/* ── named pieces ── */
const WB = {
  lodge(g){                                              // ring-1 hero: a two-gable mountain lodge on a snowy yard
    const a = new Acc(), r = rngFrom(222);
    a.add(rbox(1.86, .03, 1.86), W.packed, at(0, .015, 0));
    const yard = new THREE.Group(); a.into(yard); yard.userData.ghostHide = true; g.add(yard);
    const b = new Acc();
    cabin(b, { w:1.2, d:.86, h:.62, pitch:.66, cx:-.12, cz:-.22, winX:2, winZ:2, rng:r });
    b.add(rbox(1.2, .04, .34), W.plank, at(-.12, .08, .38));                                           // porch deck
    for (const px of [-.66, .42]) b.add(rbox(.05, .42, .05), W.logD, at(px, .3, .52));
    b.add(rbox(1.36, .03, .44), W.plankD, at(-.12, .53, .38, 0, 1, 1, 1, .32)); b.add(rbox(1.4, .05, .46), W.snow, at(-.12, .565, .385, 0, 1, 1, 1, .32));
    bulbs(b, [[-.66, .52], [.42, .52]], .47, .06, 11);
    // firewood stack
    for (let i=0;i<3;i++) for (let j=0;j<3-i;j++) b.add(new THREE.CylinderGeometry(.04, .04, .3, 6).rotateX(Math.PI/2), W.logE, at(.62 + j*.085 + i*.042, .1 + i*.07, -.55));
    b.add(rbox(.3, .03, .34), W.snow, at(.7, .32, -.55));
    snowSkirt(b, r, .88, 12); b.into(g);
    km(g, 'lantern', .62, .2, .72, .03, .34); km(g, 'bench-short', .24, .3, .72, .03, .72, -Math.PI/2);
    km(g, 'present-a-cube', .14, .12, -.72, .03, .76, .4); km(g, 'present-b-round', .12, .12, -.58, .03, .8, 1.1);
    km(g, 'tree-snow-c', .5, .34, -.8, .03, .45, .4);
  },
  cabin(g, s){ const a = new Acc(), r = rngFrom(s.x*9 + s.z*5 + 1);
    cabin(a, { w:.66, d:.56, h:.4, cx:-.04, cz:-.06, winZ:1, winX:1, chimney:!s.nochim, rng:r });
    snowSkirt(a, r, .45, 6);
    if (s.logs) for (let i=0;i<2;i++) for (let j=0;j<2-i;j++) a.add(new THREE.CylinderGeometry(.035, .035, .22, 6).rotateX(Math.PI/2), W.logE, at(.36 + i*.035 + j*.07 - .03, .06 + i*.06, .32));
    a.into(g);
    if (s.wreath) km(g, 'wreath-decorated', .14, .12, .12, .2, .27);
    if (s.logs) km(g, 'lantern', .45, .14, -.36, .03, .36);
    else km(g, 'present-a-rectangle', .1, .14, .34, .03, .36, .5); },
  stall(g){ const a = new Acc(), r = rngFrom(71);           // cocoa stall: counter, striped awning, steaming mugs
    a.add(rbox(.72, .3, .3), W.plank, at(0, .18, .05)); a.add(rbox(.78, .04, .36), W.plankD, at(0, .35, .08));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(rbox(.04, .62, .04), W.logD, at(sx*.36, .34, -.1 + sz*.2 + (sz > 0 ? .02 : 0)));
    for (let i=0;i<6;i++) a.add(rbox(.14, .03, .42), i%2 ? W.awnW : W.awnR, at(-.35 + i*.14, .68, .04, 0, 1, 1, 1, .28));
    a.add(rbox(.86, .05, .16), W.snow, at(0, .75, -.1, 0, 1, 1, 1, .28)); mound(a, -.2, -.12, .12, .05, r); a.m.get(W.snow).at(-1).translate(0, .76, 0);   // snow lies on the back of the awning only
    for (let i=0;i<6;i++) a.add(new THREE.ConeGeometry(.022, .05, 3).rotateX(Math.PI), i%2 ? W.awnW : W.awnR, at(-.35 + i*.14, .6, .27));
    for (const mx of [-.2, 0, .16]) { a.add(new THREE.CylinderGeometry(.03, .026, .06, 8), W.mug, at(mx, .4, .16)); a.add(new THREE.CylinderGeometry(.025, .025, .005, 8), W.cocoa, at(mx, .428, .16)); }
    a.add(new THREE.CylinderGeometry(.07, .08, .14, 10), W.stoneD, at(.25, .44, -.02));              // the cocoa pot
    a.add(rbox(.28, .08, .2), W.plankD, at(-.3, .04, .38)); a.add(rbox(.3, .03, .22), W.snow, at(-.3, .095, .38));
    snowSkirt(a, r, .44, 5); a.into(g);
    km(g, 'lantern-hanging', .2, .12, -.3, .42, .22);
    g.userData.steam = [[-.2, .45, .16], [.16, .45, .16], [.25, .52, -.02]]; },
  shed(g){ const a = new Acc(), r = rngFrom(81);           // sled shed: open-front lean-to with two sleds inside
    a.add(rbox(.8, .04, .62), W.plankD, at(0, .02, -.04));
    a.add(rbox(.8, .5, .05), W.plank, at(0, .27, -.34)); for (const sx of [-1, 1]) a.add(rbox(.05, .44, .62), W.plank, at(sx*.38, .24, -.04));
    for (const sx of [-1, 1]) a.add(rbox(.05, .46, .05), W.logD, at(sx*.38, .23, .27));
    a.add(rbox(.92, .035, .78), W.plankD, at(0, .52, -.02, 0, 1, 1, 1, .2)); a.add(rbox(.96, .07, .8), W.snow, at(0, .56, -.015, 0, 1, 1, 1, .2));
    icicles(a, -.44, .44, .45, .38, r, 8);
    snowSkirt(a, r, .46, 6); a.into(g);
    km(g, 'sled-long', .22, .52, -.14, .04, .0, .1); km(g, 'sled', .2, .42, .2, .04, .06, -.15); km(g, 'lantern', .42, .14, .34, .03, .38); },
  pond(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 11);   // frozen pond with a skating ring
    a.add(new THREE.CylinderGeometry(.44, .46, .04, 28), W.snowSh, at(0, .02, 0, 0, 1.02, 1, .92));
    a.add(new THREE.CylinderGeometry(.39, .39, .02, 28), W.ice, at(0, .045, 0, 0, 1.02, 1, .92));
    for (const rr of [.2, .28]) a.add(new THREE.TorusGeometry(rr, .004, 3, 36).rotateX(Math.PI/2), W.snow, at(.02, .056, 0, 0, 1.1, 1, .8));
    for (let i=0;i<14;i++){ const ang = i/14*6.28 + r()*.2; mound(a, Math.cos(ang)*.43*1.02, Math.sin(ang)*.43*.92, .06 + r()*.04, .04 + r()*.03, r); }
    if (s.hole) { a.add(new THREE.CylinderGeometry(.07, .07, .022, 14), W.hole, at(-.1, .048, .08)); a.add(rbox(.1, .08, .1), W.plank, at(.08, .09, .16)); a.add(new THREE.CylinderGeometry(.035, .03, .06, 8), W.stoneD, at(.16, .08, .02)); }
    a.into(g);
    if (!s.hole) { km(g, 'tree-snow-c', .42, .3, -.36, .03, -.32, .5); km(g, 'lantern', .45, .14, .38, .03, -.3); }
    else km(g, 'lantern', .45, .14, .34, .03, -.3); },
  spring(g){ const a = new Acc(), r = rngFrom(55);        // hot spring: steaming turquoise pool in snow-capped rocks
    a.add(new THREE.CylinderGeometry(.34, .36, .03, 22), W.spring, at(0, .05, 0, 0, 1, 1, .9));
    for (let i=0;i<12;i++){ const ang = i/12*6.28 + r()*.2, d = .38;
      blob(a, i%3 ? W.stone : W.stoneD, new THREE.Vector3(Math.cos(ang)*d, .05, Math.sin(ang)*d*.9), .08 + r()*.04, .75, 0, r);
      mound(a, Math.cos(ang)*d, Math.sin(ang)*d*.9 + .0, .06, .03, r); a.m.get(W.snow).at(-1).translate(0, .1, 0); }
    a.into(g); g.userData.steam = [[-.08, .1, .02], [.1, .1, -.08], [0, .1, .12]]; },
  fountain(g){ const a = new Acc(), r = rngFrom(66);       // ice fountain: a stone basin frozen mid-splash
    a.add(new THREE.CylinderGeometry(.36, .38, .12, 16), W.stone, at(0, .06, 0)); a.add(new THREE.CylinderGeometry(.31, .31, .02, 16), W.ice, at(0, .115, 0));
    a.add(new THREE.CylinderGeometry(.06, .08, .3, 8), W.stoneD, at(0, .25, 0)); a.add(new THREE.CylinderGeometry(.16, .06, .06, 12), W.stone, at(0, .42, 0));
    for (let i=0;i<8;i++){ const ang = i/8*6.28, h = .12 + (i%2)*.05; a.add(new THREE.ConeGeometry(.018, h, 5).rotateX(Math.PI), W.iceD, at(Math.cos(ang)*.15, .39 - h/2, Math.sin(ang)*.15)); }
    a.add(new THREE.OctahedronGeometry(.1, 0), W.iceGlow, at(0, .55, 0, .4, .8, 1.5, .8));
    for (let i=0;i<5;i++){ const ang = i/5*6.28 + .3; a.add(new THREE.OctahedronGeometry(.05, 0), W.iceGlow, at(Math.cos(ang)*.09, .5, Math.sin(ang)*.09, ang, .6, 1.4, .6, Math.cos(ang)*.5, Math.sin(ang)*.5)); }
    for (let i=0;i<10;i++){ const ang = i/10*6.28; mound(a, Math.cos(ang)*.35, Math.sin(ang)*.35, .06, .04, r, W.snow); a.m.get(W.snow).at(-1).translate(0, .12, 0); }
    a.into(g); },
  tree(g, s){ km(g, s.model, s.h || 1.3, s.w || .98, 0, 0, 0, (s.rot||0)*Math.PI/180);
    const a = new Acc(), r = rngFrom(s.x*5 + s.z*11); mound(a, .26, .24, .12, .05, r); mound(a, -.28, .18, .09, .04, r); a.into(g);
    if (s.pair) km(g, 'tree-snow-c', .62, .42, .3, 0, .28, 1.1); },
  path(g, s){ const slab = new THREE.Mesh(G.path, W.packed); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
    const a = new Acc(), r = rngFrom(s.x*13 + s.z*29);
    [[-.2,-.18],[.18,-.2],[-.16,.2],[.21,.17]].forEach(([x,z]) => a.add(G.step, r() < .5 ? W.step : W.stepD, at(x + (r()-.5)*.08, .045, z + (r()-.5)*.08, r()*3, 1 + r()*.2, 1, .85 + r()*.3)));
    for (let i=0;i<5;i++){ const e = i%2 ? -1 : 1, t = (r()-.5)*.8; mound(a, i < 3 ? t : e*.44, i < 3 ? e*.44 : t, .08 + r()*.04, .04 + r()*.02, r); }   // shovelled banks
    const v = s.v || 'plain';
    if (v === 'lights') { for (const [px, pz] of [[-.36, -.36], [.36, .36]]) { a.add(new THREE.CylinderGeometry(.018, .022, .5, 6), W.logD, at(px, .27, pz)); a.add(BALL, W.snow, at(px, .53, pz, 0, .03, .02, .03)); }
      bulbs(a, [[-.36, -.36], [.36, .36]], .5, .09, 12); }
    a.into(g);
    if (v === 'lamp') km(g, 'lantern', .62, .2, .33, .03, -.33);
    else if (v === 'gifts') { km(g, 'present-a-cube', .16, .14, .26, .03, -.26, .3); km(g, 'present-b-rectangle', .12, .2, .3, .03, -.02, 1.2); km(g, 'present-a-round', .13, .13, .06, .03, -.3, 2); km(g, 'candy-cane-red', .2, .08, -.34, .03, -.3, .4); }
    else if (v === 'sled') km(g, 'sled', .18, .36, .26, .03, -.24, .9);
    else if (v === 'bench') { km(g, 'bench', .24, .5, -.02, .03, -.3, 0); km(g, 'lantern', .5, .16, .36, .03, -.34); }
    if (v === 'plain') g.userData.ghostMode = 'marker'; },
  fence(g, s){ for (let i=0;i<s.len;i++){ const o = i - (s.len-1)/2;
      if (s.edge === 'w') km(g, 'cabin-fence', .24, .98, -.45, 0, o, Math.PI/2); else km(g, 'cabin-fence', .24, .98, o, 0, .45, 0); }
    const a = new Acc(), r = rngFrom(s.x*3 + s.z*7 + 2);
    for (let i=0;i<s.len*3;i++){ const t = (i + .5)/(s.len*3) - .5; s.edge === 'w' ? mound(a, -.36, t*s.len, .08, .045, r) : mound(a, t*s.len, .36, .08, .045, r); }
    a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz); },
  bigtree(g){                                            // Gita: the great winter tree, star on top, gifts and lanterns round it
    const a = new Acc(), r = rngFrom(404);
    a.add(new THREE.CylinderGeometry(.93, .95, .05, 40), W.packed, at(0, .025, 0));
    for (let i=0;i<40;i++){ const ang = r()*6.28, d = .66 + r()*.24, s = .06*(.8 + r()*.4);
      a.add(new THREE.CylinderGeometry(s, s*1.06, .02, 6), r() < .5 ? W.step : W.stepD, at(Math.cos(ang)*d, .055, Math.sin(ang)*d, r()*3)); }
    a.add(new THREE.CylinderGeometry(.44, .48, .1, 24), W.stone, at(0, .1, 0)); a.add(new THREE.CylinderGeometry(.42, .42, .03, 24), W.snow, at(0, .16, 0));
    for (let i=0;i<14;i++){ const ang = i/14*6.28 + r()*.2; mound(a, Math.cos(ang)*.93, Math.sin(ang)*.93, .08 + r()*.05, .05, r); }
    a.into(g);
    km(g, 'tree-decorated-snow', 1.95, 1.3, 0, .17, 0, .3);
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFE08A, transparent:true, opacity:.85, blending:THREE.AdditiveBlending, depthWrite:false }));
    star.position.set(0, 2.08, 0); star.scale.setScalar(.7); star.userData.glow = true; star.renderOrder = 9; g.add(star);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.star, color:0xFFFFFF, transparent:true, opacity:.95, blending:THREE.AdditiveBlending, depthWrite:false }));
    sp.position.set(0, 2.08, 0); sp.scale.setScalar(.34); sp.userData.glow = true; sp.renderOrder = 9; g.add(sp);
    [['present-a-cube', .5, .32, .2], ['present-b-rectangle', .32, .5, 1.1], ['present-a-round', -.1, .52, 2], ['present-b-cube', .52, -.05, .7], ['present-a-rectangle', -.44, .36, 2.6]]
      .forEach(([n, x, z, rot]) => km(g, n, .17, .2, x, .17, z, rot));
    [[-.72,-.72],[.72,-.72],[-.72,.72],[.72,.72]].forEach(([x,z]) => km(g, 'lantern', .72, .2, x, .05, z));
    km(g, 'reindeer', .62, .44, .78, .05, .1, -.4);
    km(g, 'candy-cane-red', .26, .1, -.82, .05, .1, .8); km(g, 'candy-cane-green', .26, .1, .1, .05, .84, -.4);
  }
};

/* blueprint: every farm slot id → a winter piece (same cells, same rings, same order) */
const MAP = {
  bigbarn:{ name:'Mountain lodge', b:'lodge' },
  silo:{ name:'Log cabin', b:'cabin' }, silohouse:{ name:'Cocoa stall', b:'stall' }, coop:{ name:'Sled shed', b:'shed' },
  smallbarn:{ name:"Woodcutter's cabin", b:'cabin', logs:true, nochim:false }, openbarn:{ name:'Wreath cabin', b:'cabin', wreath:true },
  well:{ name:'Skating pond', b:'pond' }, watertower:{ name:'Hot spring', b:'spring' }, pump:{ name:'Ice fountain', b:'fountain' }, pond:{ name:'Ice-fishing hole', b:'pond', hole:true },
  apple1:{ name:'Snowy fir', b:'tree', model:'tree-snow-a', rot:20 }, apple2:{ name:'Snowy spruce', b:'tree', model:'tree-snow-b', rot:140, h:1.4 },
  berry1:{ name:'Young firs', b:'tree', model:'tree-snow-c', rot:0, h:.9, w:.66, pair:true }, orange1:{ name:'Snowy pine', b:'tree', model:'tree-snow-b', rot:0, h:1.45 },
  apple3:{ name:'Snowy fir', b:'tree', model:'tree-snow-a', rot:260 }, berry2:{ name:'Young firs', b:'tree', model:'tree-snow-c', rot:90, h:.9, w:.66, pair:true },
  orange2:{ name:'Snowy spruce', b:'tree', model:'tree-snow-b', rot:200, h:1.35 }, apple4:{ name:'Snowy fir', b:'tree', model:'tree-snow-a', rot:60, h:1.25 },
  peepal:{ name:'Great winter tree', b:'bigtree' }
};
const PATH_V = { path3_4:['plain','Shovelled path'], path3_5:['lamp','Lamp-lit path'], path1_2:['gifts','Gift pile'], path5_2:['sled','Sled stop'],
  path3_6:['lights','String lights'], path2_6:['bench','Fireside bench'], path3_0:['lamp','Lamp-lit path'] };
const IGLOOS = new Set(['field1_4', 'field6_3', 'field4_6']);
export const WINTER = FARM.map((f, i) => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') return IGLOOS.has(f.id) ? { ...s, kind:'igloo', name:'Igloo', stages:5 } : { ...s, kind:'yard', name:'Snowman', v:i%2, stages:5 };
  if (f.kind === 'path') { const [v, name] = PATH_V[f.id] || ['plain', 'Shovelled path']; return { ...s, kind:'w', b:'path', v, name }; }
  if (f.kind === 'fence') return { ...s, kind:'w', b:'fence', edge:f.edge, len:f.len, name:'Picket fence' };
  return { ...s, kind:'w', ...MAP[f.id] };
});

/* ── the look: snow tiles with soft blue hollows, ice-blue sides ── */
const SNOW_TILE = { top:['#D9E5F3','#D1DFEF'], side:'#C6D6E9', soilTop:'#A6C4E2', soilBot:'#5A7AA3' };
function snowTileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(61);
  g.fillStyle = '#FAFCFF'; g.fillRect(0,0,N,N);
  for (let i=0;i<12;i++){ const x = r()*N, y = r()*N, rad = 24 + r()*46, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const hollow = r() < .5; gr.addColorStop(0, hollow ? 'rgba(150,180,225,.16)' : 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0,0,N,N); }
  for (let i=0;i<7;i++){ g.strokeStyle = 'rgba(160,185,225,.14)'; g.lineWidth = 2.5; g.beginPath();                 // wind ripples
    const y0 = r()*N, x0 = r()*N*.6; for (let x=0;x<=70;x+=5){ const y = y0 + Math.sin(x*.09 + i)*4; x ? g.lineTo(x0 + x, y) : g.moveTo(x0, y); } g.stroke(); }
  for (let i=0;i<160;i++){ g.fillStyle = r() < .6 ? 'rgba(255,255,255,.95)' : 'rgba(140,170,215,.22)'; g.beginPath(); g.arc(r()*N, r()*N, .6 + r()*1.2, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ── decor: snow drifts + a sapling or rock on empty cells, a drift on waiting cells ── */
function winterDecor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc(), sub = new THREE.Group(); sub.position.copy(p); grp.add(sub);
    if (!sl || sl === 'later') {
      for (let i=0;i<4;i++) mound(a, (r()-.5)*.7, (r()-.5)*.7, .07 + r()*.08, .035 + r()*.035, r);
      a.into(sub);
      if (AMBIENT()) { const q = r(); if (q < .45) km(sub, 'tree-snow-c', .34 + r()*.14, .3, (r()-.5)*.4, 0, (r()-.5)*.4, r()*6);
        else if (q < .7) km(sub, 'rocks-small', .12, .28, (r()-.5)*.4, 0, (r()-.5)*.4, r()*6); }
      grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { mound(a, .3, .3, .09, .045, r); mound(a, -.28, .3, .07, .035, r); a.into(sub); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else world.remove(grp);
  }
}

/* ── ambient: gentle falling snow + steam over the hot spring / cocoa; both only move while the loop is awake ── */
const flakeTex = (() => { const s = 32, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  const gr = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0,0,s,s); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const FLAKE_MAT = new THREE.SpriteMaterial({ map:flakeTex, color:0xFFFFFF, transparent:true, opacity:.95, depthWrite:false });
const STEAM_MAT = () => new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFFFFF, transparent:true, opacity:.5, depthWrite:false });
function winterAmbient(){
  V.flakes = []; V.steam = [];
  const R = V.ring + .5, top = 2.2 + V.ring*.25, r = rngFrom(88), n = 26 + V.ring*16;
  for (let i=0;i<n;i++){ const f = new THREE.Sprite(FLAKE_MAT); f.renderOrder = 10;
    f.userData = { x:(r()*2-1)*R, z:(r()*2-1)*R, ph:r(), sp:.06 + r()*.05, sz:.035 + r()*.035, wob:r()*6, top };
    world.add(f); V.flakes.push(f); V.life.push(f); }
  Object.entries(V.pieces).forEach(([id, g]) => (g.userData.steam || []).forEach((q, j) => addSteam(g, q, j)));
  moveSnow(2.1);
}
function addSteam(g, q, j){ for (let i=0;i<3;i++){ const s = new THREE.Sprite(STEAM_MAT()); s.renderOrder = 10;
  const p = new THREE.Vector3(...q).applyMatrix4(g.matrixWorld); s.userData = { p, ph:i/3 + j*.17 }; world.add(s); V.steam.push(s); V.life.push(s); } }
function moveSnow(t){
  if (!V || !V.flakes) return;
  V.flakes.forEach(f => { const u = f.userData, k = ((t*u.sp + u.ph) % 1 + 1) % 1, y = u.top - k*(u.top - TILE_TOP);
    f.position.set(u.x + Math.sin(t*.7 + u.wob)*.12, y, u.z + Math.cos(t*.5 + u.wob)*.08); f.scale.setScalar(u.sz);
    f.material.opacity = .95; });
  (V.steam || []).forEach(s => { const u = s.userData, k = ((t*.22 + u.ph) % 1 + 1) % 1;
    s.position.set(u.p.x + Math.sin(t + u.ph*6)*.03, u.p.y + k*.55, u.p.z); s.scale.setScalar(.1 + k*.22); s.material.opacity = .42*Math.sin(k*Math.PI); });
  const done = placed.length === TH().slots.length;
  BULBS.forEach((m, i) => m.emissiveIntensity = done ? .9 + .8*Math.max(0, Math.sin(t*3.1 + i*1.7)) : .55);
}
function snowPuff(pos, n = 12){
  for (let i=0;i<n;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:flakeTex, transparent:true, opacity:.95, depthWrite:false })); s.renderOrder = 10;
    const a = i/n*6.28, d = .25 + Math.random()*.4, sz = .05 + Math.random()*.06, rise = .25 + Math.random()*.35; s.position.copy(pos); fx.add(s);
    tween(900 + Math.random()*400, t => { const e = 1 - Math.pow(1-t, 2); s.position.set(pos.x + Math.cos(a)*d*e, pos.y + .05 + Math.sin(t*Math.PI)*rise, pos.z + Math.sin(a)*d*e);
      s.scale.setScalar(sz*(1 - t*.5)); s.material.opacity = .95*(1 - t*t); }, () => { fx.remove(s); s.material.dispose(); });
  }
}

export default {
  id:'winter', name:'Winter village', title:'Your winter',
  season:8, dates:'22 Dec–4 Jan', nextIn:14,
  kits:[WK],
  kitDefs:{ [WK]:{ file:'assets/winter/winter.glb', stripSuffix:true } },
  families:{
    water:   { label:'ponds & springs',      tag:'Ice' },
    building:{ label:'log cabins',           tag:'Cabin' },
    path:    { label:'paths, lamps & lights', tag:'Path' },
    crop:    { label:'snowmen & igloos',     tag:'Snow' },
    tree:    { label:'snowy firs',           tag:'Tree' },
    special: { label:'the great winter tree', tag:'Special' }
  },
  slots:WINTER, order:FARM_ORDER,
  ground:{ tile:SNOW_TILE, tileMap:snowTileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M5 12.5h10v7H5z" fill="#B7713F"/><path d="M3.6 13.2 10 7l6.4 6.2z" fill="#EAF2FB" stroke="#9FB9D6" stroke-width="1.1" stroke-linejoin="round"/><rect x="8.6" y="15" width="2.8" height="2.8" fill="#FFC45A"/><path d="M19 4v8M15.5 6l7 4M22.5 6l-7 4" stroke="#6FA8DC" stroke-width="1.5" stroke-linecap="round"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M14 118V76l30-24 30 24v42z"/><path d="M58 60h10v-20h-10z"/><path d="M92 20 72 58h10L66 88h52L102 58h10z"/><rect x="88" y="86" width="8" height="32"/><rect x="36" y="88" width="16" height="14" fill="#fff" opacity=".55"/></g>',
  album:{ image:'assets/winter/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E6EEF8)' },
  ghost:{ color:'#5E7797', opacity:.4, emissive:.06, dash:'#6F86A6', dashOpacity:.72, night:{ opacity:.3, emissive:.2, dashOpacity:.5 } },   // white ghosts vanish on snow: blue-grey
  css:'.phone[data-theme="winter"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#EAF1FA 58%,#D3E1F2 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'yard' || s.kind === 'igloo') {
      const slab = new THREE.Mesh(G.field, W.snowB); slab.position.y = .03; slab.scale.set(.96, .6, .96); slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab);
      const host = new THREE.Group(); g.add(host); g.userData.plants = host;
      const fill = s.kind === 'yard' ? fillYard : fillIgloo; g.userData.regrow = st => fill(host, s, st); fill(host, s, stage);
    } else WB[s.b](g, s);
  },
  scaleOf: () => 1,
  contact: s => s.kind === 'w' && !['path', 'fence'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.v === 'lamp' || s.v === 'lights' || s.b === 'spring',
  decor: winterDecor,
  ambient: winterAmbient,
  tick(t){ moveSnow(t); },
  onImpact(pos, big){ snowPuff(pos, big ? 18 : 12); },

  residents:[ {id:'Stag',name:'Stag',h:1.1,at:[0.1,2.55],face:.4}, {id:'Deer',name:'Deer',h:.95,at:[0.2,3.85],face:2.3},
              {id:'Fox',name:'Fox',h:.58,at:[1.2,6.15],face:2.2}, {id:'Husky',name:'Husky',h:.6,at:[5.15,6.2],face:-.7} ],
  residentThumb: d => 'assets/thumbs/' + d.id + '.png'
};
