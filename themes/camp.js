/* MOUNTAIN CAMP (?theme=camp) — an alpine meadow camp on the farm's 7×7 ring blueprint (FARM_SLOTS: every farm slot id maps
   to a camp piece, hero in the right-hand corner, so rings 6 / 15 / 19, order, pick-3, growth and expansion behave like the farm).
   Tents, the bonfire, logs, axe, shovel, pot, backpack, torch = Quaternius Survival Pack (CC0, packed to assets/camp/camp.glb).
   Pines + aspens = Quaternius Stylized Nature MegaKit (kit a); firs, rocks, bushes = KayKit Forest Nature (kit b), both shared CC0.
   Log cabin, woodshed, lookout tower, boathouse, orange tent, waterfall, creek, lake + canoe, spring, bonfire stages, firewood
   stacks, berry + veg patches, trail props, split-rail fence, the summit cairn with prayer flags and the snowy peak backdrop are
   procedural flat-shaded geometry, merged per material (Acc). Residents = shared animated Stag / Deer / Fox / Wolf (assets/animals). */
import * as THREE from 'three';
import { rngFrom, TEX, world } from '../engine/scene.js';
import { V, TH, placed, AMBIENT, cropStage } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, blob } from '../engine/proc.js';
import { FARM_SLOTS, FARM_ORDER } from './farm.js';

const CK = 'camp';
/* a kit model fitted to [h, w] tiles */
function km(g, kit, name, h, w, x=0, y=0, z=0, rot=0){ const t = KITCACHE[kit] && KITCACHE[kit][name]; if (!t) { console.warn('missing', kit, name); return null; }
  return addModel(g, name, fitScale(t, h, w), x, y, z, rot, kit); }

const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.9, metalness:0, flatShading:true, ...o });
const C = {
  log:FM(0xA8653A), logD:FM(0x86502C), logE:FM(0xD39A62), plank:FM(0x9A5E35), plankD:FM(0x6E4226), door:FM(0x5C3722),
  roof:FM(0x4E6B3A), roofD:FM(0x3E5630), moss:FM(0x6E9A45), trim:FM(0xE9DCC0), red:FM(0xC9523B),
  stone:FM(0xA9A597), stoneD:FM(0x86837A), stoneL:FM(0xC8C3B4), rock:FM(0x8F8C86), snow:FM(0xF6F8FC, { roughness:1 }),
  dirt:FM(0xB48E62, { roughness:1 }), dirtD:FM(0x9A774F, { roughness:1 }), soil:FM(0x7A5234, { roughness:1 }),
  water:new THREE.MeshStandardMaterial({ color:0x4FB0D6, roughness:.15, metalness:0, emissive:0x0E3C55, emissiveIntensity:.3 }),
  waterL:new THREE.MeshStandardMaterial({ color:0x8FD6EE, roughness:.12, metalness:0, emissive:0x1C5A78, emissiveIntensity:.28, transparent:true, opacity:.9 }),
  foam:FM(0xF4FBFF, { roughness:.6 }),
  leaf:FM(0x4F8F3A), leafD:FM(0x3C7430), leafL:FM(0x7DB54A), berry:FM(0xC62F5C), blue:FM(0x4A5FC8), carrot:FM(0xF08A2E), pumpkin:FM(0xE8962E),
  canvasO:FM(0xE8793A), canvasOD:FM(0xC45E28), canoe:FM(0xC9523B), canoeIn:FM(0xE3C79A), shirt:FM(0x3F7FD0), skin:FM(0xE7B58C),
  glow:new THREE.MeshStandardMaterial({ color:0xFFD27A, emissive:0xFFA83A, emissiveIntensity:1.25, roughness:.6 }),
  flame:new THREE.MeshStandardMaterial({ color:0xFFC857, emissive:0xFF8A1F, emissiveIntensity:1.9, roughness:.5 }),
  flameC:new THREE.MeshStandardMaterial({ color:0xFFF1A8, emissive:0xFFD24A, emissiveIntensity:2.2, roughness:.5 }),
  ember:new THREE.MeshStandardMaterial({ color:0x6B2A18, emissive:0xE0521F, emissiveIntensity:.8, roughness:.8 }),
  metal:FM(0x5B5E66), rope:FM(0xD8C79A), gold:FM(0xF4C84A, { emissive:0x6A4A00, emissiveIntensity:.3 })
};
const FLAGS = [0x3F7FD0, 0xF7F4EC, 0xD9433B, 0x46A35A, 0xF4C84A].map(c => FM(c, { side:THREE.DoubleSide, roughness:.8 }));
const rbox = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const LOGX = (r, len) => new THREE.CylinderGeometry(r, r, len, 7).rotateZ(Math.PI/2);    // a log along x
function rockB(acc, x, y, z, r, rng, sy = .7, mat){ blob(acc, mat || (rng() < .5 ? C.stone : C.stoneD), new THREE.Vector3(x, y, z), r, sy, 0, rng); }

/* ── LOG CABIN: stacked round logs, green shingle gable roof along x, stone chimney, warm windows on the camera faces ── */
function cabin(acc, o){
  const { w = .7, d = .6, h = .42, pitch = .62, chimney = true, door = true, winX = 1, winZ = 1, cx = 0, cz = 0 } = o;
  const n = 5, r = h/(2*n);
  acc.add(rbox(w*1.04 + .06, .06, d*1.04 + .06), C.stone, at(cx, .03, cz));
  acc.add(rbox(w - r, h, d - r), C.logD, at(cx, .06 + h/2, cz));
  for (let i=0;i<n;i++){ const y = .06 + r + i*2*r;
    for (const sz of [-1, 1]) acc.add(LOGX(r, w + .1), i%2 ? C.log : C.logE, at(cx, y, cz + sz*d/2));
    for (const sx of [-1, 1]) acc.add(new THREE.CylinderGeometry(r, r, d + .1, 7).rotateX(Math.PI/2), i%2 ? C.logE : C.log, at(cx + sx*w/2, y + r*.6, cz)); }
  const top = .06 + h, rise = (d/2)*Math.tan(pitch), ov = .1, L = (d/2 + ov)/Math.cos(pitch);
  const gable = new THREE.Shape([new THREE.Vector2(-d/2, 0), new THREE.Vector2(d/2, 0), new THREE.Vector2(0, rise)]);
  const gg = new THREE.ExtrudeGeometry(gable, { depth:.05, bevelEnabled:false }).rotateY(Math.PI/2);
  for (const sx of [-1, 1]) acc.add(gg, C.plank, at(cx + sx*(w/2 - .03) - .025, top, cz));
  for (const sz of [-1, 1]) { const mid = new THREE.Vector3(cx, top + rise - Math.sin(pitch)*L/2 + .02, cz + sz*Math.cos(pitch)*L/2);
    acc.add(rbox(w + .2, .04, L), sz > 0 ? C.roof : C.roofD, at(mid.x, mid.y, mid.z, 0, 1, 1, 1, sz*pitch));
    for (let k=1;k<4;k++) acc.add(rbox(w + .21, .012, .02), C.roofD, at(mid.x, mid.y + .022 - (k-2)*Math.sin(pitch)*L/4, mid.z + sz*(k-2)*Math.cos(pitch)*L/4, 0, 1, 1, 1, sz*pitch)); }
  acc.add(LOGX(.03, w + .24), C.logD, at(cx, top + rise + .03, cz));
  if (chimney) { const chx = cx + w*.28, chz = cz - d*.18; acc.add(rbox(.13, rise + .24, .13), C.stone, at(chx, top + (rise + .24)/2 + .05, chz));
    acc.add(rbox(.16, .04, .16), C.stoneD, at(chx, top + rise + .3, chz)); }
  if (door) { acc.add(rbox(.16, .26, .03), C.door, at(cx - w*.18, .06 + .13, cz + d/2 + r*.9)); }
  const win = (x, y, z, ry) => { acc.add(rbox(.15, .15, .03), C.trim, at(x, y, z, ry)); acc.add(rbox(.11, .11, .035), C.glow, at(x, y, z, ry)); };
  const wy = .06 + h*.58;
  for (let i=0;i<winZ;i++) win(cx + (door ? w*.2 : 0) + (winZ > 1 ? (i - .5)*w*.35 : 0), wy, cz + d/2 + r*1.05, 0);
  for (let i=0;i<winX;i++) win(cx + w/2 + r*1.05, wy, cz + (winX > 1 ? (i - .5)*d*.45 : 0), Math.PI/2);
  return { top, rise, chimneyAt:[cx + w*.28, top + rise + .34, cz - d*.18] };
}
function woodpile(acc, x, z, rows = 3, len = .3, r = .04){ for (let i=0;i<rows;i++) for (let j=0;j<rows-i;j++)
  acc.add(new THREE.CylinderGeometry(r, r, len, 7).rotateX(Math.PI/2), (i + j)%2 ? C.logE : C.log, at(x + j*r*2.1 + i*r*1.05, .06 + r + i*r*1.8, z)); }
function tuftRing(acc, rng, half, n = 8){ for (let i=0;i<n;i++){ const a = rng()*6.28, d = half*(.82 + rng()*.16);
  acc.add(new THREE.ConeGeometry(.035, .1 + rng()*.06, 4), rng() < .5 ? C.leaf : C.leafL, at(Math.cos(a)*d, .05, Math.sin(a)*d, rng()*3)); } }

/* ── A-FRAME TENT (procedural, canvas colour) ── */
function aTent(acc, x, z, ry, mat, matD, s = 1){
  const w = .5*s, h = .42*s, d = .6*s, ang = Math.atan2(h, w/2), L = Math.hypot(h, w/2);
  const c = Math.cos(ry), sn = Math.sin(ry), P = (lx, ly, lz) => [x + lx*c + lz*sn, ly, z - lx*sn + lz*c];
  for (const sx of [-1, 1]) { const [px, py, pz] = P(sx*w/4, .04 + h/2, 0); acc.add(rbox(.02, L, d), sx > 0 ? mat : matD, at(px, py, pz, ry, 1, 1, 1, 0, sx*(Math.PI/2 - ang))); }
  const tri = new THREE.Shape([new THREE.Vector2(-w/2, 0), new THREE.Vector2(w/2, 0), new THREE.Vector2(0, h)]);
  const back = new THREE.ShapeGeometry(tri); { const [px, , pz] = P(0, 0, -d/2); acc.add(back, matD, at(px, .04, pz, ry + Math.PI)); }
  const door = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-w*.22, 0), new THREE.Vector2(w*.22, 0), new THREE.Vector2(0, h*.62)]));
  { const [px, , pz] = P(0, 0, d/2 - .005); acc.add(door, C.door, at(px, .04, pz, ry)); }
  { const [px, , pz] = P(0, 0, 0); acc.add(new THREE.CylinderGeometry(.012, .012, d + .1, 5).rotateX(Math.PI/2), C.logD, at(px, .04 + h + .01, pz, ry)); }
  acc.add(rbox(w + .14, .02, d + .12), C.dirtD, at(x, .02, z, ry));
}

/* ── GROWING PIECES (Sudoku / Math) ── */
/* bonfire, built log by log: stone ring → 2 logs → a teepee → lit → roaring, log seats round it */
function fillBonfire(host, s, stage){
  host.clear(); const acc = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 5), st = Math.min(5, stage);
  for (let i=0;i<9;i++){ const a = i/9*6.28 + r()*.2; rockB(acc, Math.cos(a)*.22, .06, Math.sin(a)*.22, .055 + r()*.015, r, .6); }
  acc.add(new THREE.CylinderGeometry(.17, .17, .015, 14), st >= 4 ? C.ember : C.soil, at(0, .06, 0));
  const nLogs = [0, 0, 3, 6, 7, 8][st];
  for (let i=0;i<nLogs;i++){ const a = i/Math.max(6, nLogs)*6.28 + .3, lean = .55;
    acc.add(new THREE.CylinderGeometry(.022, .026, .3, 6).translate(0, .15, 0), i%2 ? C.log : C.logD,
      at(Math.cos(a)*.1, .06, Math.sin(a)*.1, 0, 1, 1, 1, Math.sin(a)*lean, -Math.cos(a)*lean)); }
  if (st <= 2) woodpile(acc, .18, .3, st === 1 ? 3 : 2, .24, .034);
  acc.add(new THREE.CylinderGeometry(.44, .46, .02, 20), C.dirtD, at(0, .01, 0));
  if (st >= 4) { acc.add(new THREE.ConeGeometry(.09, .26*(st >= 5 ? 1.35 : 1), 7), C.flame, at(0, .06 + .13*(st >= 5 ? 1.35 : 1), 0));
    acc.add(new THREE.ConeGeometry(.05, .16*(st >= 5 ? 1.35 : 1), 6), C.flameC, at(.01, .06 + .08*(st >= 5 ? 1.35 : 1), .02)); }
  if (st >= 5) for (const [x, z, ry] of [[-.34, .12, 1.3], [.1, .36, .1], [.34, -.14, -1.2]]) {
    acc.add(new THREE.CylinderGeometry(.05, .05, .3, 8).rotateZ(Math.PI/2), C.log, at(x, .1, z, ry)); acc.add(new THREE.CircleGeometry(.05, 8).rotateY(Math.PI/2), C.logE, at(x + Math.cos(ry)*.151, .1, z - Math.sin(ry)*.151, ry)); }
  acc.into(host); host.userData.stage = stage;
}
/* firewood stack: a chopping block → rows of split logs rise → a full rack under a little roof, axe in the block */
function fillFirewood(host, s, stage){
  host.clear(); const acc = new Acc(), st = Math.min(5, stage);
  acc.add(new THREE.CylinderGeometry(.1, .11, .14, 9), C.log, at(.26, .13, .26)); acc.add(new THREE.CylinderGeometry(.1, .1, .01, 9), C.logE, at(.26, .205, .26));
  const rows = [1, 2, 3, 4, 5, 5][st], cols = st >= 3 ? 6 : 4;
  for (let i=0;i<rows;i++) for (let j=0;j<cols - (i%2);j++)
    acc.add(new THREE.CylinderGeometry(.04, .04, .32, 6).rotateX(Math.PI/2), (i*3 + j)%3 ? C.log : C.logD, at(-.3 + j*.085 + (i%2)*.042, .1 + i*.075, -.14));
  for (let i=0;i<rows;i++) for (let j=0;j<cols - (i%2);j++) acc.add(new THREE.CircleGeometry(.036, 6), C.logE, at(-.3 + j*.085 + (i%2)*.042, .1 + i*.075, .021));
  if (st >= 3) for (const sx of [-.38, .16]) acc.add(rbox(.035, .1 + rows*.075, .035), C.logD, at(sx, .06 + (.1 + rows*.075)/2, -.14));
  if (st >= 5) { acc.add(rbox(.66, .03, .44), C.roof, at(-.11, .56, -.14, 0, 1, 1, 1, .18)); }
  if (st <= 1) for (let i=0;i<3;i++) acc.add(new THREE.CylinderGeometry(.04, .04, .3, 6).rotateZ(Math.PI/2), C.log, at(-.1 + i*.02, .1, .2 + i*.09, i*.6));
  acc.into(host);
  if (st >= 2) km(host, CK, 'Axe', .24, .12, .26, .2, .26, .6);
  host.userData.stage = stage;
}
/* berry patch: bare soil + sprigs → bushes swell → berries ripen red and blue */
function fillBerry(host, s, stage){
  host.clear(); const acc = new Acc(), r = rngFrom(s.x*13 + s.z*17), st = Math.min(5, stage);
  const k = [.3, .3, .5, .72, .9, 1][st];
  for (const [x, z] of [[-.22, -.2], [.2, -.22], [-.2, .2], [.22, .2]]) {
    const sz = .17*k;
    if (st <= 1) { acc.add(new THREE.ConeGeometry(.03, .1, 4), C.leafL, at(x, .1, z)); continue; }
    blob(acc, C.leafD, new THREE.Vector3(x, .06 + sz*.8, z), sz, .85, 1, r); blob(acc, C.leaf, new THREE.Vector3(x + sz*.3, .06 + sz*1.1, z - sz*.2), sz*.7, .8, 1, r);
    if (st >= 4) for (let i=0;i<7;i++){ const a = r()*6.28, e = r()*.8; acc.add(new THREE.IcosahedronGeometry(.022, 0), (x + z) > 0 ? C.blue : C.berry,
      at(x + Math.cos(a)*sz*.95, .06 + sz*(.6 + e*.8), z + Math.sin(a)*sz*.95)); }
  }
  acc.into(host); if (st >= 5) km(host, CK, 'Pot', .1, .13, .02, .07, .02, .4);
  host.userData.stage = stage;
}
/* veg patch: furrows → sprouts → leafy rows → carrots + pumpkins */
function fillVeg(host, s, stage){
  host.clear(); const acc = new Acc(), r = rngFrom(s.x*7 + s.z*23), st = Math.min(5, stage);
  for (let row=0; row<3; row++){ const z = -.26 + row*.26;
    acc.add(rbox(.74, .04, .12), C.soil, at(0, .08, z));
    for (let i=0;i<4;i++){ const x = -.27 + i*.18 + (r()-.5)*.02, h = [.04, .05, .09, .14, .17, .18][st];
      if (row === 1 && st >= 4) { blob(acc, C.pumpkin, new THREE.Vector3(x, .14, z), .06 + (st - 4)*.02, .75, 0, null); acc.add(new THREE.ConeGeometry(.08, .03, 5), C.leaf, at(x + .05, .11, z + .04)); continue; }
      for (let j=0;j<3;j++) acc.add(new THREE.ConeGeometry(.018 + st*.004, h, 3), j ? C.leafL : C.leaf, at(x + (j - 1)*.025, .1 + h/2, z, j*2, 1, 1, 1, (j - 1)*.35));
      if (st >= 5 && row !== 1) acc.add(new THREE.ConeGeometry(.02, .06, 5).rotateX(Math.PI), C.carrot, at(x, .1, z + .03)); } }
  acc.into(host); host.userData.stage = stage;
}

/* ── named pieces ── */
const CB = {
  cabin2(g){                                             // ring-1 hero: the big log cabin with a porch, firewood, an axe in a stump
    const a = new Acc(), r = rngFrom(222);
    a.add(rbox(1.86, .02, 1.86), C.dirt, at(0, .01, 0)); const yard = new THREE.Group(); a.into(yard); yard.userData.ghostHide = true; g.add(yard);
    const b = new Acc();
    const cb = cabin(b, { w:1.16, d:.84, h:.6, pitch:.66, cx:-.12, cz:-.24, winX:2, winZ:2 });
    b.add(rbox(1.16, .04, .34), C.plank, at(-.12, .08, .36));
    for (const px of [-.66, .42]) b.add(rbox(.05, .42, .05), C.logD, at(px, .3, .5));
    b.add(rbox(1.34, .03, .42), C.roofD, at(-.12, .53, .36, 0, 1, 1, 1, .32));
    woodpile(b, .62, -.5, 3, .3, .042);
    b.add(new THREE.CylinderGeometry(.09, .1, .12, 9), C.log, at(.66, .12, .56));
    for (let i=0;i<7;i++) rockB(b, -.84 + r()*.2, .05, -.8 + i*.26, .05 + r()*.03, r, .6);
    tuftRing(b, r, .88, 10); b.into(g);
    km(g, CK, 'Axe', .22, .12, .66, .18, .56, .8); km(g, CK, 'WoodenTorch', .5, .1, .5, .03, .78, .2);
    km(g, 'a', 'Pine_5', .78, .44, -.78, .02, .66, .6);
    g.userData.smoke = [cb.chimneyAt];
  },
  woodshed(g, s){ const a = new Acc(), r = rngFrom(s.x*9 + s.z*5 + 1);
    const cb = cabin(a, { w:.62, d:.52, h:.38, cx:-.06, cz:-.08, winZ:1, winX:1 });
    woodpile(a, .18, .34, 2, .22, .035); tuftRing(a, r, .45, 6); a.into(g);
    km(g, CK, 'Shovel', .36, .14, -.38, .03, .34, .3);
    g.userData.smoke = [cb.chimneyAt]; },
  lookout(g){ const a = new Acc();                        // ranger lookout: braced legs, a glassed cab, a hip roof and a ladder
    const H = 1.02, s = .2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(new THREE.CylinderGeometry(.022, .03, H, 6), C.logD, at(sx*s, .06 + H/2, sz*s, 0, 1, 1, 1, sz*.05, -sx*.05));
    for (const y of [.3, .66]) for (const [sx, sz, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI/2], [-1, 0, Math.PI/2]]) {
      a.add(rbox(.02, .44, .02), C.log, at(sx*(s + .01), .06 + y, sz*(s + .01), ry, 1, 1, 1, 0, .78)); a.add(rbox(.44, .025, .025), C.logE, at(sx*(s + .01), .06 + y - .16, sz*(s + .01), ry)); }
    const y0 = .06 + H;
    a.add(rbox(.6, .04, .6), C.plankD, at(0, y0, 0));
    for (const [x, z, ry] of [[0, .28, 0], [0, -.28, 0], [.28, 0, Math.PI/2], [-.28, 0, Math.PI/2]]) a.add(rbox(.56, .12, .03), C.plank, at(x, y0 + .08, z, ry));
    a.add(rbox(.46, .2, .46), C.waterL, at(0, y0 + .24, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(rbox(.03, .24, .03), C.logD, at(sx*.23, y0 + .24, sz*.23));
    a.add(new THREE.ConeGeometry(.46, .22, 4).rotateY(Math.PI/4), C.roof, at(0, y0 + .47, 0));
    a.add(new THREE.CylinderGeometry(.012, .012, .16, 5), C.metal, at(0, y0 + .64, 0));
    for (const sx of [-1, 1]) a.add(rbox(.02, H + .06, .02), C.log, at(.07*sx + .02, .06 + H/2, .34, 0, 1, 1, 1, -.2));
    for (let i=0;i<8;i++) a.add(rbox(.16, .015, .02), C.logE, at(.02, .12 + i*.12, .345 - i*.024));
    a.into(g); },
  tent(g){ km(g, CK, 'Tent', .78, 1.02, 0, 0, -.04, -.5); const a = new Acc(); a.add(rbox(.9, .02, .86), C.dirtD, at(0, .01, 0)); const pad = new THREE.Group(); a.into(pad); pad.userData.ghostHide = true; g.add(pad);
    km(g, CK, 'Backpack', .26, .2, .34, .02, .34, -.6); km(g, CK, 'Pot', .09, .12, -.34, .02, .36, 0); },
  otent(g, s){ const a = new Acc(), r = rngFrom(s.x*3 + s.z*11);
    aTent(a, -.04, -.06, .35, C.canvasO, C.canvasOD, 1.25);
    for (let i=0;i<4;i++){ const ang = i/4*6.28; rockB(a, .3 + Math.cos(ang)*.07, .05, .3 + Math.sin(ang)*.07, .03, r, .6); }
    a.add(LOGX(.035, .3), C.log, at(-.26, .09, .34, .5)); a.into(g);
    km(g, CK, 'WoodenTorch', .42, .1, .38, .03, -.28, 0); },
  boathouse(g, s){ const a = new Acc(), r = rngFrom(71);   // plank boathouse over a strip of water, canoe inside
    a.add(rbox(.9, .03, .5), C.water, at(0, .03, .22)); for (let i=0;i<8;i++) rockB(a, -.45 + i*.13, .04, .47 + (r()-.5)*.04, .04 + r()*.02, r, .5);
    a.add(rbox(.78, .04, .62), C.plankD, at(0, .1, -.06));
    for (const sx of [-1, 1]) a.add(rbox(.04, .5, .6), C.plank, at(sx*.37, .35, -.06)); a.add(rbox(.78, .5, .04), C.plank, at(0, .35, -.36));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(new THREE.CylinderGeometry(.025, .025, .5, 6), C.logD, at(sx*.37, .1, -.06 + sz*.28));
    const pitch = .6, L = .46; for (const sx of [-1, 1]) a.add(rbox(L, .035, .76), sx > 0 ? C.roof : C.roofD, at(sx*Math.cos(pitch)*L/2, .6 + Math.sin(pitch)*L/2 - .01, -.06, 0, 1, 1, 1, 0, -sx*pitch));
    const gable = new THREE.Shape([new THREE.Vector2(-.39, 0), new THREE.Vector2(.39, 0), new THREE.Vector2(0, .26)]);
    a.add(new THREE.ShapeGeometry(gable), C.plankD, at(0, .6, .24));
    canoe(a, 0, .08, .22, Math.PI/2, .8, false);
    a.into(g); km(g, CK, 'Paddle', .08, .34, .28, .13, .42, 1.3); },
  spring(g){ const a = new Acc(), r = rngFrom(55);        // mountain spring: a clear pool in mossy rocks, a trickle over one stone
    a.add(new THREE.CylinderGeometry(.32, .34, .03, 22), C.water, at(0, .05, 0, 0, 1, 1, .9));
    for (let i=0;i<13;i++){ const ang = i/13*6.28 + r()*.2, d = .38; rockB(a, Math.cos(ang)*d, .06, Math.sin(ang)*d*.9, .07 + r()*.05, r, .75);
      if (i%3 === 0) a.add(new THREE.ConeGeometry(.03, .09, 4), C.leafL, at(Math.cos(ang)*(d + .06), .1, Math.sin(ang)*(d + .06)*.9)); }
    rockB(a, -.22, .14, -.24, .12, r, 1, C.stoneD); a.add(rbox(.07, .12, .02), C.waterL, at(-.14, .1, -.16, .8));
    a.add(new THREE.TorusGeometry(.08, .008, 3, 18).rotateX(Math.PI/2), C.foam, at(-.1, .068, -.1));
    a.into(g); },
  falls(g){ const a = new Acc(), r = rngFrom(66);          // waterfall: a rock cliff at the back, a white-blue sheet into a foaming pool
    for (const [x, z, s, sy] of [[-.26, -.28, .24, 1.9], [.02, -.34, .22, 2.4], [.28, -.26, .22, 1.7], [-.36, .0, .15, 1.2], [.36, .02, .14, 1.1]]) rockB(a, x, .06 + s*sy*.5, z, s, r, sy, r() < .5 ? C.rock : C.stoneD);
    for (const [x, z] of [[-.2, -.32], [.16, -.36]]) a.add(new THREE.ConeGeometry(.06, .1, 5), C.moss, at(x, .66, z));
    a.add(new THREE.CylinderGeometry(.3, .32, .03, 20), C.water, at(0, .05, .12, 0, 1.1, 1, .8));
    a.add(rbox(.2, .56, .03), C.waterL, at(.02, .34, -.12, 0, 1, 1, 1, .12));
    a.add(rbox(.24, .03, .08), C.foam, at(.02, .63, -.17));
    for (let i=0;i<6;i++) blob(a, C.foam, new THREE.Vector3(.02 + (r()-.5)*.24, .07, -.02 + (r()-.5)*.08), .04 + r()*.02, .5, 0, r);
    for (let i=0;i<7;i++){ const ang = .2 + i/6*2.7; rockB(a, Math.cos(ang)*.36, .05, .12 + Math.sin(ang)*.3, .05 + r()*.02, r, .6); }
    a.into(g); },
  creek(g){ const a = new Acc(), r = rngFrom(33);          // creek: a winding channel across the tile with stepping stones
    a.add(rbox(1, .012, .98), C.dirt, at(0, .006, 0));
    const pts = []; for (let i=0;i<=8;i++){ const t = i/8; pts.push([-.5 + t, Math.sin(t*5)*.12]); }
    for (let i=0;i<8;i++){ const [x0, z0] = pts[i], [x1, z1] = pts[i+1], len = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0);
      a.add(rbox(len + .04, .02, .3), C.water, at((x0 + x1)/2, .045, (z0 + z1)/2, ry)); a.add(rbox(len + .04, .014, .38), C.dirtD, at((x0 + x1)/2, .032, (z0 + z1)/2, ry)); }
    for (const [x, z] of [[-.08, -.04], [.08, .08], [.2, .0]]) a.add(new THREE.CylinderGeometry(.05, .055, .04, 8), C.stoneL, at(x, .06, z, r()*3));
    for (let i=0;i<9;i++){ const x = -.45 + i*.11, s = i%2 ? 1 : -1; rockB(a, x, .05, Math.sin((x + .5)*5)*.12 + s*(.2 + r()*.05), .035 + r()*.02, r, .6); }
    for (let i=0;i<4;i++) a.add(new THREE.ConeGeometry(.03, .14, 4), C.leafL, at(-.35 + i*.24, .1, -.36 + (i%2)*.72));
    a.into(g); },
  lake(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 11);   // mountain lake with reeds and a canoe
    a.add(new THREE.CylinderGeometry(.46, .47, .03, 28), C.dirtD, at(0, .02, 0, 0, 1, 1, .95));
    a.add(new THREE.CylinderGeometry(.42, .42, .02, 28), C.water, at(0, .045, 0, 0, 1, 1, .95));
    for (let i=0;i<16;i++){ const ang = i/16*6.28 + r()*.2; rockB(a, Math.cos(ang)*.45, .05, Math.sin(ang)*.43, .04 + r()*.025, r, .55); }
    for (let i=0;i<5;i++) a.add(new THREE.CylinderGeometry(.006, .008, .2 + r()*.08, 4), C.leafL, at(-.3 + (r()-.5)*.1, .14, .24 + (r()-.5)*.1));
    a.into(g);
    const boat = new THREE.Group(), b = new Acc(); canoe(b, 0, 0, 0, 0, .72, true); b.into(boat); boat.position.set(.06, .06, -.08); boat.rotation.y = .5;
    g.add(boat); g.userData.canoe = boat; },
  tree(g, s){ const tpl = s.kit;
    km(g, tpl, s.model, s.h || 1.3, s.w || .98, 0, 0, 0, (s.rot||0)*Math.PI/180);
    if (s.pair) km(g, tpl, s.pair, (s.h || 1)*.66, .5, .28, 0, .26, 1.1);
    const a = new Acc(), r = rngFrom(s.x*5 + s.z*11); rockB(a, -.3, .05, .26, .05, r, .6); a.add(new THREE.ConeGeometry(.03, .1, 4), C.leafL, at(.3, .1, -.28)); a.into(g); },
  path(g, s){ const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), alongX = (s.x + s.z)%2 === 0;
    const pts = []; for (let i=0;i<=6;i++){ const t = i/6; pts.push([-.5 + t, Math.sin(t*3.4 + s.x)*.1]); }       // a winding dirt trail across the tile
    for (let i=0;i<6;i++){ const [u0, v0] = pts[i], [u1, v1] = pts[i+1], len = Math.hypot(u1 - u0, v1 - v0), ang = Math.atan2(v1 - v0, u1 - u0);
      const cx = (u0 + u1)/2, cv = (v0 + v1)/2, [x, z, ry] = alongX ? [cx, cv, -ang] : [cv, cx, Math.PI/2 + ang];
      a.add(rbox(len + .06, .03, .3), C.dirt, at(x, .015, z, ry)); a.add(rbox(len + .05, .02, .38), C.dirtD, at(x, .008, z, ry)); }
    for (let i=0;i<5;i++){ const t = r(), side = r() < .5 ? -1 : 1, u = -.45 + t*.9, v = Math.sin((u + .5)*3.4 + s.x)*.1 + side*(.22 + r()*.06);
      rockB(a, alongX ? u : v, .04, alongX ? v : u, .025 + r()*.02, r, .6); }
    const v = s.v || 'plain';
    if (v === 'sign') { a.add(new THREE.CylinderGeometry(.022, .026, .56, 6), C.logD, at(.3, .31, -.3));
      a.add(rbox(.3, .08, .025), C.plank, at(.38, .5, -.3, .3)); a.add(new THREE.ConeGeometry(.045, .06, 3).rotateZ(-Math.PI/2), C.plank, at(.55, .5, -.24, .3));
      a.add(rbox(.26, .07, .025), C.plankD, at(.2, .38, -.3, 2.3)); a.add(rbox(.2, .012, .03), C.trim, at(.38, .5, -.3, .3)); }
    if (v === 'bench') { for (const sx of [-1, 1]) a.add(new THREE.CylinderGeometry(.04, .045, .14, 7), C.log, at(sx*.2, .1, -.3));
      a.add(new THREE.CylinderGeometry(.05, .05, .6, 8).rotateZ(Math.PI/2), C.logE, at(0, .2, -.3)); a.add(rbox(.6, .012, .08), C.log, at(0, .25, -.3)); }
    if (v === 'lantern') for (const [px, pz] of [[-.34, -.34], [.34, .34]]) { a.add(new THREE.CylinderGeometry(.018, .022, .44, 6), C.logD, at(px, .24, pz));
      a.add(rbox(.1, .03, .02), C.logD, at(px + .05, .45, pz)); a.add(rbox(.06, .08, .06), C.glow, at(px + .09, .39, pz)); a.add(new THREE.ConeGeometry(.05, .04, 4).rotateY(Math.PI/4), C.metal, at(px + .09, .45, pz)); }
    if (v === 'dock') { a.add(rbox(.7, .02, .42), C.water, at(.1, .045, -.22)); for (let i=0;i<6;i++) rockB(a, -.25 + i*.13, .05, -.44 + (i%2)*.03, .035, r, .5);
      for (let i=0;i<5;i++) a.add(rbox(.1, .025, .34), i%2 ? C.plank : C.plankD, at(-.14 + i*.11, .1, -.2));
      for (const [x, z] of [[-.2, -.37], [.32, -.37], [-.2, -.03], [.32, -.03]]) a.add(new THREE.CylinderGeometry(.02, .02, .14, 6), C.logD, at(x, .08, z));
      a.add(new THREE.CylinderGeometry(.006, .008, .5, 4), C.logD, at(.24, .3, -.26, 0, 1, 1, 1, -.7, .3)); }
    a.into(g);
    if (v === 'pack') { km(g, CK, 'Backpack', .3, .22, .28, .03, -.26, -.5); km(g, CK, 'Shovel', .4, .16, -.3, .03, -.3, .6); km(g, CK, 'WoodLog', .1, .3, .28, .03, .1, .4); }
    if (v === 'torch') km(g, CK, 'WoodenTorch', .5, .1, .34, .03, -.32);
    if (v === 'plain') g.userData.ghostMode = 'marker'; },
  fence(g, s){ const a = new Acc();                         // split-rail fence: posts + two rails per tile
    for (let i=0;i<s.len;i++){ const o = i - (s.len-1)/2;
      const P = (u, y) => s.edge === 'w' ? [-.45, y, o + u] : [o + u, y, .45];
      for (const u of [-.42, .42]) { const [x, y, z] = P(u, .16); a.add(new THREE.CylinderGeometry(.03, .035, .3, 6), C.logD, at(x, y, z)); }
      for (const y of [.13, .25]) { const [x, , z] = P(0, 0); a.add(new THREE.CylinderGeometry(.018, .02, .9, 5).rotateZ(Math.PI/2), C.log, at(x, y, z, s.edge === 'w' ? Math.PI/2 : 0, 1, 1, 1, 0, 0)); } }
    a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz); },
  cairn(g){                                              // Gita: the summit cairn on a mossy knoll, prayer flags strung from its tip to four poles
    const a = new Acc(), r = rngFrom(404);
    blob(a, C.rock, new THREE.Vector3(0, .02, 0), .74, .5, 1, r);                          // summit knoll: grey rock, a mossy cap, boulders
    blob(a, C.moss, new THREE.Vector3(.02, .12, .04), .66, .42, 1, r);
    for (const [x, z, rr] of [[-.55, .35, .2], [.5, .45, .17], [.35, -.55, .22], [-.62, -.3, .16], [.1, .68, .14], [.7, -.05, .15]]) rockB(a, x, .08, z, rr, r, .8, r() < .5 ? C.rock : C.stoneD);
    for (let i=0;i<10;i++){ const ang = r()*6.28, d = .82 + r()*.1; rockB(a, Math.cos(ang)*d, .04, Math.sin(ang)*d, .04 + r()*.03, r, .6); }
    let y = .4; for (let i=0;i<8;i++){ const rr = .28 - i*.027, hh = .11 - i*.006;           // the stacked cairn, ~0.8 tall
      a.add(new THREE.CylinderGeometry(rr*.88, rr, hh, 7), i%2 ? C.stoneL : C.stone, at((r()-.5)*.03, y + hh/2, (r()-.5)*.03, r()*3, 1, 1, .85 + r()*.2)); y += hh; }
    a.add(new THREE.OctahedronGeometry(.06, 0), C.stoneL, at(0, y + .05, 0, .4, 1, 1.5, 1)); const tip = y + .1;
    const poles = [[-.8, -.32], [.32, -.82], [.82, .32], [-.32, .82]], PH = .95;
    poles.forEach(([x, z]) => { a.add(new THREE.CylinderGeometry(.018, .024, PH, 6), C.logD, at(x, .02 + PH/2, z)); a.add(new THREE.SphereGeometry(.03, 6, 5), C.gold, at(x, .02 + PH + .01, z)); });
    poles.forEach(([x0, z0], p) => { const ay = .02 + PH - .03, n = 9, ry = -Math.atan2(-z0, -x0);
      a.add(new THREE.CylinderGeometry(.004, .004, Math.hypot(x0, z0), 3).rotateZ(Math.PI/2), C.rope, at(x0/2, (ay + tip)/2 - .03, z0/2, ry, 1, 1, 1, 0, Math.atan2(tip - ay, Math.hypot(x0, z0))));
      for (let i=1;i<n;i++){ const t = i/n, px = x0*(1 - t), pz = z0*(1 - t), py = ay + (tip - ay)*t - Math.sin(t*Math.PI)*.06;
        a.add(new THREE.PlaneGeometry(.11, .13).translate(0, -.065, 0), FLAGS[(i + p)%5], at(px, py, pz, ry + Math.PI/2)); } });
    for (let i=0;i<5;i++){ const ang = i/5*6.28 + .4, d = .34; a.add(new THREE.CylinderGeometry(.032, .026, .035, 8), C.gold, at(Math.cos(ang)*d, .36, Math.sin(ang)*d));   // butter lamps
      a.add(new THREE.SphereGeometry(.015, 6, 5), C.flameC, at(Math.cos(ang)*d, .39, Math.sin(ang)*d, 0, 1, 1.8, 1)); }
    a.into(g);
    km(g, 'a', 'Pine_3', .9, .45, .66, .12, -.62, .4);
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFF0B8, transparent:true, opacity:.8, blending:THREE.AdditiveBlending, depthWrite:false }));
    star.position.set(0, tip + .06, 0); star.scale.setScalar(.36); star.userData.glow = true; star.renderOrder = 9; g.add(star);
  }
};
/* canoe: a pointed hull (lathe-free: two stretched half-cones), thwarts; optional paddler */
function canoe(acc, x, y, z, ry, len = .72, paddler = false){
  const c = Math.cos(ry), s = Math.sin(ry), P = (lx, ly, lz) => [x + lx*c + lz*s, y + ly, z - lx*s + lz*c];
  const hull = new THREE.SphereGeometry(.5, 12, 6, 0, Math.PI*2, Math.PI/2, Math.PI/2);
  { const [px, py, pz] = P(0, .06, 0); acc.add(hull, C.canoe, at(px, py, pz, ry, len*.24, .16, len)); acc.add(new THREE.CircleGeometry(.5, 12).rotateX(-Math.PI/2), C.canoeIn, at(px, py + .002, pz, ry, len*.2, 1, len*.9)); }
  for (const u of [-.18, .18]) { const [px, py, pz] = P(0, .065, u*len); acc.add(rbox(len*.24, .012, .025), C.plank, at(px, py, pz, ry)); }
  if (paddler) { const [px, py, pz] = P(0, .06, .06*len); acc.add(new THREE.CylinderGeometry(.035, .045, .1, 8), C.shirt, at(px, py + .05, pz)); acc.add(new THREE.SphereGeometry(.032, 8, 6), C.skin, at(px, py + .13, pz));
    acc.add(new THREE.CylinderGeometry(.034, .034, .02, 8), C.red, at(px, py + .16, pz)); const [qx, qy, qz] = P(.07, .1, .08*len);
    acc.add(new THREE.CylinderGeometry(.006, .006, .3, 4), C.logD, at(qx, qy, qz, ry, 1, 1, 1, .5, .9)); }
}

/* blueprint: every farm slot id → a camp piece (same cells, same rings, same order; hero on the right as in the farm) */
const MAP = {
  bigbarn:{ name:'Log cabin', b:'cabin2' },
  silo:{ name:'Lookout tower', b:'lookout' }, silohouse:{ name:'Camp tent', b:'tent' }, coop:{ name:'Orange tent', b:'otent' },
  smallbarn:{ name:'Woodshed cabin', b:'woodshed' }, openbarn:{ name:'Boathouse', b:'boathouse' },
  well:{ name:'Mountain spring', b:'spring' }, watertower:{ name:'Waterfall', b:'falls' }, pump:{ name:'Creek', b:'creek' }, pond:{ name:'Lake & canoe', b:'lake' },
  apple1:{ name:'Tall pine', b:'tree', kit:'a', model:'Pine_1', rot:20, h:1.35, w:.9 },
  apple2:{ name:'Fir', b:'tree', kit:'a', model:'Pine_3', rot:140, h:1.45, w:.95, pair:'Pine_5' },
  berry1:{ name:'Young pines', b:'tree', kit:'a', model:'Pine_5', rot:0, h:.9, w:.62, pair:'Pine_5' },
  orange1:{ name:'Aspen', b:'tree', kit:'a', model:'CommonTree_2', rot:0, h:1.35, w:.95 },
  apple3:{ name:'Tall pine', b:'tree', kit:'a', model:'Pine_3', rot:260, h:1.4, w:.9 },
  berry2:{ name:'Aspen grove', b:'tree', kit:'a', model:'CommonTree_1', rot:90, h:1.1, w:.85, pair:'CommonTree_1' },
  orange2:{ name:'Fir', b:'tree', kit:'a', model:'Pine_3', rot:200, h:1.4, w:.95, pair:'Pine_5' },
  apple4:{ name:'Tall pine', b:'tree', kit:'a', model:'Pine_1', rot:60, h:1.25, w:.9 },
  peepal:{ name:'Summit cairn', b:'cairn' }
};
const PATH_V = { path3_4:['plain','Trail'], path3_5:['lantern','Lantern trail'], path1_2:['sign','Signpost'], path5_2:['dock','Fishing dock'],
  path3_6:['bench','Log bench'], path2_6:['pack','Backpack rest'], path3_0:['torch','Torch trail'] };
const GROW = { field2_4:'bonfire', field6_3:'bonfire', field1_3:'firewood', field2_5:'firewood', field6_4:'firewood',
  field4_4:'berry', field1_5:'berry', field4_6:'berry', field1_4:'veg', field4_5:'veg' };
const GROW_NAME = { bonfire:'Bonfire', firewood:'Firewood stack', berry:'Berry patch', veg:'Veg patch' };
const FILL = { bonfire:fillBonfire, firewood:fillFirewood, berry:fillBerry, veg:fillVeg };
export const CAMP = FARM_SLOTS.map((f, i) => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') { const g = GROW[f.id]; return { ...s, kind:'grow', grow:g, name:GROW_NAME[g], stages:5 }; }
  if (f.kind === 'path') { const [v, name] = PATH_V[f.id] || ['plain', 'Trail']; return { ...s, kind:'c', b:'path', v, name }; }
  if (f.kind === 'fence') return { ...s, kind:'c', b:'fence', edge:f.edge, len:f.len, name:'Split-rail fence' };
  return { ...s, kind:'c', ...MAP[f.id] };
});

/* ── the look: alpine meadow tiles, pine-green, rocky grey block ── */
const MEADOW_TILE = { top:['#86B95A','#7EB254'], side:'#6F9E4A', soilTop:'#9A958A', soilBot:'#57534C' };
function meadowTileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(83);
  g.fillStyle = '#EEF1EA'; g.fillRect(0,0,N,N);
  for (let i=0;i<14;i++){ const x = r()*N, y = r()*N, rad = 18 + r()*40, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, r() < .5 ? 'rgba(255,255,235,.35)' : 'rgba(60,90,40,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0,0,N,N); }
  g.lineCap = 'round';
  for (let i=0;i<200;i++){ const x = r()*N, y = r()*N, len = 4 + r()*6, a = -Math.PI/2 + (r()-.5)*.9;
    g.strokeStyle = r() < .55 ? 'rgba(60,100,50,.14)' : 'rgba(255,255,240,.75)'; g.lineWidth = 1.3 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a)*len, y + Math.sin(a)*len); g.stroke(); }
  for (let i=0;i<34;i++){ const e = Math.floor(r()*4), t = r()*N, d = 3 + r()*9;                 // rocky edges: grey stones round each tile rim
    const [x, y] = e === 0 ? [t, d] : e === 1 ? [t, N - d] : e === 2 ? [d, t] : [N - d, t], rx = 3 + r()*5;
    g.fillStyle = r() < .5 ? 'rgba(150,146,138,.75)' : 'rgba(185,180,170,.75)'; g.beginPath(); g.ellipse(x, y, rx, rx*.7, r()*3, 0, 6.3); g.fill(); }
  for (let i=0;i<18;i++){ g.fillStyle = ['rgba(255,255,255,.9)','rgba(244,200,74,.85)','rgba(183,162,240,.8)'][i%3]; g.beginPath(); g.arc(20 + r()*(N - 40), 20 + r()*(N - 40), 1.4 + r(), 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ── decor: meadow grass, wildflowers, a rock or sapling on empty cells; rocks along the outer rim ── */
function campDecor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19), lo = 3 - V.ring, hi = 3 + V.ring;
  const grass = (grp, x, z, n) => { for (let j=0;j<n;j++){ const p = cellPos(x, z), a = r()*6.28, rad = .1 + r()*.36;
    km(grp, 'a', r() < .5 ? 'Grass_Common_Short' : 'Grass_Wispy_Short', .16 + r()*.08, .4, p.x + Math.cos(a)*rad, p.y, p.z + Math.sin(a)*rad, r()*6.28); } };
  const flowers = (grp, x, z, n) => { for (let j=0;j<n;j++){ const p = cellPos(x, z), a = r()*6.28, rad = .1 + r()*.34;
    km(grp, 'a', r() < .5 ? 'Flower_3_Single' : 'Flower_4_Single', .14 + r()*.06, .2, p.x + Math.cos(a)*rad, p.y, p.z + Math.sin(a)*rad, r()*6.28); } };
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const rim = x === lo || x === hi || z === lo || z === hi;
    if (!sl || sl === 'later') { grass(grp, x, z, 4); if (AMBIENT()) { flowers(grp, x, z, 2);
        const q = r(), p = cellPos(x, z); if (q < .3) km(grp, 'a', 'Pine_5', .4 + r()*.15, .3, p.x + (r()-.5)*.4, p.y, p.z + (r()-.5)*.4, r()*6);
        else if (q < .6) km(grp, 'a', 'Rock_Medium_' + (1 + Math.floor(r()*3)), .12, .26, p.x + (r()-.5)*.4, p.y, p.z + (r()-.5)*.4, r()*6); }
      grp.userData.decor = 'meadow'; }
    else if (!placed.includes(sl.id) && AMBIENT()) { grass(grp, x, z, 2); if (sl.kind !== 'c' || sl.b !== 'path') flowers(grp, x, z, 1); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if (rim && (x === hi || z === hi)) { const p = cellPos(x, z); km(grp, 'a', 'Pebble_Round_' + (1 + Math.floor(r()*3)), .07, .16, p.x + (x === hi ? .42 : (r()-.5)*.6), p.y, p.z + (z === hi ? .42 : (r()-.5)*.6), r()*6); grp.userData.decor = 'rim'; }
    else world.remove(grp);
  }
}

/* ── env: a small snowy peak rising behind the back corner of the land ── */
function peakGeo(R, H, seed, snowAt){
  const g = new THREE.ConeGeometry(R, H, 9, 5).translate(0, H/2, 0), p = g.attributes.position, r = rngFrom(seed);
  for (let i=0;i<p.count;i++){ const y = p.getY(i); if (y > H - 1e-3 || y < 1e-3) continue; const k = 1 + (r()-.5)*.34;
    p.setXYZ(i, p.getX(i)*k, y + (r()-.5)*H*.06, p.getZ(i)*k); }
  const ng = g.toNonIndexed(), q = ng.attributes.position, col = new Float32Array(q.count*3), cs = new THREE.Color(0xF6F8FC), cr = new THREE.Color(0x8F8C86), cd = new THREE.Color(0x77746E), cg = new THREE.Color(0x6F9E4A);
  for (let f=0; f<q.count; f+=3){ const ym = (q.getY(f) + q.getY(f+1) + q.getY(f+2))/3, t = ym/H, c = t > snowAt + (Math.sin(f*.7)*.05) ? cs : t < .0 ? cg : (f/3)%2 ? cr : cd;
    for (let k=0;k<3;k++) col.set([c.r, c.g, c.b], (f + k)*3); }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3)); ng.computeVertexNormals(); return ng;
}
const PEAK_MAT = new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:.95, metalness:0 });
function buildEnv(){
  const L = V.L, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const c = -L/2 - .5, base = -.63, H = 1.15 + L*.3;
  const main = new THREE.Mesh(peakGeo(.85 + L*.1, H, 5, .6), PEAK_MAT); main.position.set(c, base, c); main.castShadow = true; main.receiveShadow = true; env.add(main);
  const side = new THREE.Mesh(peakGeo(.55 + L*.05, H*.6, 9, .64), PEAK_MAT); side.position.set(c + .95, base, c - .45); side.castShadow = side.receiveShadow = true; env.add(side);
  const side2 = new THREE.Mesh(peakGeo(.5 + L*.05, H*.5, 13, .66), PEAK_MAT); side2.position.set(c - .45, base, c + .9); side2.castShadow = side2.receiveShadow = true; env.add(side2);
  env.children.forEach(m => m.renderOrder = 0);
  V.framePts.push(new THREE.Vector3(c, base + H, c));
}

/* ── ambient: campfire + chimney smoke, a hawk circling; on completion the canoe paddles across the lake ── */
const SMOKE_MAT = () => new THREE.SpriteMaterial({ map:TEX.glow, color:0xD9D6CF, transparent:true, opacity:.5, depthWrite:false });
const HAWK_M = FM(0x6B4A2E, { side:THREE.DoubleSide }), HAWK_L = FM(0xE8DCC4, { side:THREE.DoubleSide });
function makeHawk(){
  const h = new THREE.Group(), body = new THREE.Mesh(new THREE.ConeGeometry(.035, .2, 5).rotateX(Math.PI/2), HAWK_M); h.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.028, 6, 5), HAWK_L); head.position.z = .11; h.add(head);
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(.07, .08).rotateX(-Math.PI/2), HAWK_M); tail.position.z = -.12; h.add(tail);
  const wg = new THREE.PlaneGeometry(.2, .08).rotateX(-Math.PI/2).translate(.1, 0, 0);
  const w1 = new THREE.Mesh(wg, HAWK_M), w2 = new THREE.Mesh(wg, HAWK_M); w2.scale.x = -1; h.add(w1, w2); h.userData.w = [w1, w2];
  h.scale.setScalar(1.5); return h;
}
function campAmbient(){
  V.smoke = []; V.hawks = []; V.canoes = [];
  Object.entries(V.pieces).forEach(([id, g]) => {
    (g.userData.smoke || []).forEach((q, j) => addSmoke(g, q, j, null));
    if (g.userData.slot && g.userData.slot.grow === 'bonfire') addSmoke(g, [0, .3, 0], 0, g.userData.plants);
    if (g.userData.canoe) V.canoes.push(g.userData.canoe);
  });
  const n = V.ring >= 2 ? 2 : 1;
  for (let i=0;i<n;i++){ const h = makeHawk(); h.userData.ph = i*3.1; h.userData.rad = .9 + V.ring*.55 - i*.4; h.userData.h = 1.7 + V.ring*.18 + i*.25;
    world.add(h); V.hawks.push(h); V.life.push(h); V.framePts.push(new THREE.Vector3(0, TILE_TOP + h.userData.h, 0)); }
  moveCamp(2.1);
}
function addSmoke(g, q, j, plants){ for (let i=0;i<4;i++){ const s = new THREE.Sprite(SMOKE_MAT()); s.renderOrder = 10;
  g.updateMatrixWorld(true); const p = new THREE.Vector3(...q).applyMatrix4(g.matrixWorld); s.userData = { p, ph:i/4 + j*.17, plants }; world.add(s); V.smoke.push(s); V.life.push(s); } }
function moveCamp(t){
  if (!V || !V.smoke) return;
  V.smoke.forEach(s => { const u = s.userData, k = ((t*.18 + u.ph) % 1 + 1) % 1, on = !u.plants || (u.plants.userData.stage || 0) >= 4;
    s.visible = on; s.position.set(u.p.x + Math.sin(t*.8 + u.ph*6)*.04 + k*.12, u.p.y + k*.8, u.p.z - k*.06); s.scale.setScalar(.12 + k*.3); s.material.opacity = .45*Math.sin(k*Math.PI); });
  V.hawks.forEach(h => { const u = h.userData, a = t*.28 + u.ph;
    h.position.set(Math.cos(a)*u.rad, TILE_TOP + u.h + Math.sin(a*2)*.06, Math.sin(a)*u.rad*.85); h.rotation.set(0, -a, 0); h.rotation.z = -.3;
    const f = Math.sin(a*3) > .6 ? Math.sin(t*14)*.5 : .12; u.w[0].rotation.z = f; u.w[1].rotation.z = -f; });
  const done = placed.length === TH().slots.length;
  V.canoes.forEach(b => { if (!done) return; const k = (Math.sin(t*.35) + 1)/2;          // across the lake and back, paddling
    b.position.set(-.18 + k*.34, .06 + Math.sin(t*2)*.006, .14 - k*.3); b.rotation.y = .5 + Math.sin(t*.35 + 1.57)*.25; });
}

export default {
  id:'camp', name:'Mountain camp', title:'Your camp',
  season:13, dates:'16–29 Mar', nextIn:14,
  kits:[CK, 'a'],
  kitDefs:{ [CK]:{ file:'assets/camp/camp.glb', flat:true } },
  families:{
    water:   { label:'lakes, falls & creeks', tag:'Water' },
    building:{ label:'cabins & tents',        tag:'Camp' },
    path:    { label:'trails & camp props',   tag:'Trail' },
    crop:    { label:'fires, wood & berries', tag:'Grows' },
    tree:    { label:'pines, firs & aspens',  tag:'Tree' },
    special: { label:'the summit cairn',      tag:'Special' }
  },
  slots:CAMP, order:FARM_ORDER,
  ground:{ tile:MEADOW_TILE, tileMap:meadowTileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M2.5 20 9 8l3.2 5.4L15 9l6.5 11z" fill="#5E8F48"/><path d="M9 8l-1.8 3.3 1.8-.9 1.6 1z" fill="#fff"/><path d="M12 20l3.4-6 3.4 6z" fill="#E8793A"/><path d="M14.3 20l1.1-2 1.1 2z" fill="#5C3722"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M4 118 46 40l20 34 16-26 42 70z"/><path d="M46 40l-10 18 10-5 9 6z" fill="#fff" opacity=".55"/><path d="M60 118l18-32 18 32z" fill="#fff" opacity=".35"/><path d="M100 118V96l-8 4 12-22 12 22-8-4v22z"/></g>',
  album:{ image:'assets/camp/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E7EFE0)' },
  css:'.phone[data-theme="camp"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#EEF3E6 58%,#DCE7D0 100%)}',

  build(g, s, opt){
    if (s.kind === 'grow') {
      if (s.grow === 'berry' || s.grow === 'veg') { const slab = new THREE.Mesh(G.field, C.soil); slab.position.y = .03; slab.scale.set(.96, .6, .96); slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab); }
      else if (s.grow === 'firewood') { const slab = new THREE.Mesh(new THREE.CylinderGeometry(.46, .46, .02, 20), C.dirtD); slab.position.y = .01; slab.scale.set(1, 1, .8); slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab); }
      const host = new THREE.Group(); g.add(host); g.userData.plants = host;
      const fill = FILL[s.grow]; g.userData.regrow = st => fill(host, s, st); fill(host, s, opt.stage ?? cropStage(s.id));
    } else CB[s.b](g, s);
  },
  scaleOf: () => 1,
  contact: s => s.kind === 'c' && !['path', 'fence', 'creek', 'spring', 'lake'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.v === 'lantern' || s.v === 'torch' || s.grow === 'bonfire',
  decor: campDecor,
  env: buildEnv,
  ambient: campAmbient,
  tick(t){ moveCamp(t); },

  residents:[ {id:'Stag',name:'Stag',h:1.1,at:[0.1,2.55],face:.4}, {id:'Deer',name:'Deer',h:.95,at:[0.2,3.85],face:2.3},
              {id:'Fox',name:'Fox',h:.58,at:[1.2,6.15],face:2.2}, {id:'Wolf',name:'Wolf',h:.7,at:[5.15,6.2],face:-.7} ],
  residentThumb: d => 'assets/thumbs/' + d.id + '.png'
};
