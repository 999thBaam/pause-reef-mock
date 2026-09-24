/* PHOENIX — VOLCANO TO PARADISE (?theme=phoenix). The land STARTS as black, cooled lava rock with faint glowing cracks; every
   placed piece greens its own tile and the tiles around it (a spreading greening: black basalt → olive moss → lush grass),
   so the plot visibly heals piece by piece and is a lush paradise at 40/40. No volcano (that is dino's): the story here is
   the aftermath: hexagonal basalt columns, lava fields that cool into meadows, rain clouds, and a phoenix spring as the hero.
   Built on the farm's 7×7 ring blueprint (FARM_SLOTS: hero on the right, rings 6 / 15 / 19, FARM_ORDER).
   The greening is theme-side: decor() recolours the engine's tile instances (V.caps.setColorAt) from the placed pieces and
   lays per-cell ground (lava cracks / moss sprouts / grass + flowers); onImpact() runs a radial colour wave from the new piece
   and rebuilds that ground. Models: trees, grass, flowers, ferns, rocks = Quaternius Stylized Nature MegaKit (kit a), palms =
   Quaternius Ultimate Stylized Nature (assets/dino/palms.glb). All CC0 and already in assets/. Everything else (basalt
   columns, huts, seed dome, lookout, bird poles, rain clouds, pools, lava fields, the phoenix spring, the phoenix, parrots,
   hatchling turtles) is procedural three.js geometry merged per material (Acc), so every piece stays pre-renderable. */
import * as THREE from 'three';
import { rngFrom, TEX, world, fx } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, seg, blob } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { addButterflies, flyButterflies, tintedFlower } from '../engine/life.js';
import { FARM_SLOTS, FARM_ORDER } from './farm.js';

const PK = 'dino';                                       // palms kit id (same file + id as dino/oasis, loaded once)
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.9, metalness:0, flatShading:true, ...o });
const SM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.75, metalness:0, ...o });
const GLOW = (hex, em, k) => new THREE.MeshStandardMaterial({ color:hex, emissive:em, emissiveIntensity:k, roughness:.5, flatShading:true });
const M = {
  basalt:FM(0x4A444C), basaltL:FM(0x6A636B), basaltD:FM(0x332F36), crust:FM(0x2C282E), ash:FM(0x5E5A5C),
  lava:GLOW(0xFF7A1F, 0xFF4D00, 1.5), lavaDim:GLOW(0xC9582A, 0xB83A10, .7), ember:GLOW(0xFFC24A, 0xFF9A1F, 1.6),
  moss:FM(0x7E9A45), mossL:FM(0x9DBB57), grass:FM(0x86C052), leaf:FM(0x5FA544), leafD:FM(0x4A8C3A),
  thatch:FM(0xD9B46A), thatchD:FM(0xB89048), wood:FM(0x8A5A34), woodD:FM(0x6A4226), plank:FM(0xB98552),
  water:SM(0x4FC3DA, { roughness:.15, emissive:0x0E4A5A, emissiveIntensity:.35 }), foam:FM(0xEAF8FB, { roughness:.4 }),
  cloud:SM(0xFFFFFF, { roughness:1, emissive:0xE8F0FF, emissiveIntensity:.12 }), cloudD:SM(0xDCE6F2, { roughness:1 }),
  rain:new THREE.MeshStandardMaterial({ color:0x9FD8F0, roughness:.3, transparent:true, opacity:.75, emissive:0x3A8AB0, emissiveIntensity:.3 }),
  glass:new THREE.MeshStandardMaterial({ color:0xCFF3EE, roughness:.1, metalness:0, transparent:true, opacity:.38, depthWrite:false, side:THREE.DoubleSide }),
  win:GLOW(0xFFE3A0, 0xFFB24A, .9), pad:FM(0x5FAE4A), lotus:FM(0xF7A8C4), lotusC:FM(0xF6D55A),
  sand:FM(0xF1DDB0, { roughness:1 }), egg:SM(0xF4EAD2), eggC:SM(0xE8DCC0),
  // phoenix + flame tree
  fRed:GLOW(0xE8402A, 0xC8200A, .55), fOrange:GLOW(0xFF8A2A, 0xE85A0A, .6), fGold:GLOW(0xFFD24A, 0xFFA010, .75),
  pBody:GLOW(0xE84A2A, 0xB8200A, .45), pWing:GLOW(0xFF9A2A, 0xE86A0A, .55), pTip:GLOW(0xFFD85A, 0xFFB020, .9), eye:SM(0x23262B), beak:SM(0xF6C04A),
  // parrots, hatchlings
  parG:SM(0x3FBF5A), parB:SM(0x3E8DE0), parR:SM(0xE2463A), parY:SM(0xF6CB45),
  babyShell:SM(0x7E9A4A), babySkin:SM(0x9CCB8A), belly:SM(0xF1E3B0), spot:SM(0xD3E6A4)
};
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const hexG = (r, h) => new THREE.CylinderGeometry(r, r, h, 6).translate(0, h/2, 0);
const tpl = (n, kit) => KITCACHE[kit || 'a'] && KITCACHE[kit || 'a'][n];
function km(g, kit, name, h, w, x=0, y=0, z=0, rot=0){ const t = tpl(name, kit); if (!t) { console.warn('missing', name); return null; }
  return addModel(g, name, fitScale(t, h, w), x, y, z, rot, kit); }
function rock(acc, mat, x, y, z, r, sy, rng, ry=0){
  const g = new THREE.DodecahedronGeometry(r, 0), a = g.attributes.position;
  for (let i=0;i<a.count;i++){ const k = 1 + (rng()-.5)*.3; a.setXYZ(i, a.getX(i)*k, a.getY(i)*k, a.getZ(i)*k); }
  acc.add(g, mat, at(x, y, z, ry, 1, sy, 1)); }
/* a glowing lava crack: a jagged polyline of thin flat bars lying on the ground */
function crack(acc, mat, x, z, len, ang, rng, y=.004, w=.026){
  let px = x, pz = z, a = ang;
  for (let i=0;i<3;i++){ const l = len/3*(.7 + rng()*.6); a += (rng()-.5)*1.1;
    const cx = px + Math.cos(a)*l/2, cz = pz + Math.sin(a)*l/2;
    acc.add(new THREE.BoxGeometry(l, .008, w*(1 - i*.2)), mat, at(cx, y, cz, -a)); px += Math.cos(a)*l; pz += Math.sin(a)*l; } }
/* a cluster of hexagonal basalt columns */
function columns(acc, n, rng, spread, hMin, hMax, cx=0, cz=0, topMoss=0){
  for (let i=0;i<n;i++){ const a = rng()*6.28, d = Math.sqrt(rng())*spread, r = .07 + rng()*.035, h = hMin + rng()*(hMax - hMin);
    const x = cx + Math.cos(a)*d, z = cz + Math.sin(a)*d, ry = rng()*1.05;
    acc.add(hexG(r, h), i%3 ? M.basalt : M.basaltD, at(x, 0, z, ry));
    acc.add(hexG(r*.96, .012), rng() < topMoss ? M.moss : M.basaltL, at(x, h, z, ry)); } }

/* ══════════ THE GREENING: every placed piece greens its footprint and the tiles near it ══════════ */
const TOP_BLACK = ['#1F1C21', '#1A181C'], TOP_MOSS = ['#6F7143', '#686A3E'], TOP_GREEN = ['#88C052', '#80B84C'];
function cellsOf(s){ const out = [];
  if (isEdge(s)) { for (let i=0;i<s.len;i++) out.push(s.edge === 'w' ? [s.x, s.z + i] : [s.x + i, s.z]); return out; }
  for (let a=0;a<(s.w||1);a++) for (let b=0;b<(s.d||1);b++) out.push([s.x + a, s.z + b]); return out; }
/* one piece's greening at a distance d (in tiles) from its footprint: 1 on it, a soft ring beyond */
const reach = (d, big) => d < .01 ? 1 : Math.max(0, (big ? .42 : .3) - (d - 1)*(big ? .22 : .38));
function greenMap(){
  const th = TH(), done = placed.length >= th.slots.length, gm = {};
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++) gm[x+','+z] = done ? 1 : 0;
  if (done) return gm;
  const mx = {}, sum = {}; for (const k in gm) { mx[k] = 0; sum[k] = 0; }
  for (const id of placed) { const s = th.slots.find(q => q.id === id); if (!s) continue;
    const big = (s.w||1) > 1, cs = cellsOf(s), pow = s.kind === 'field' ? .35 + .13*cropStage(id) : (s.cat === 'special' ? 1.25 : 1);
    for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){ let d = 9;
      for (const [cx, cz] of cs) d = Math.min(d, Math.hypot(Math.max(0, Math.abs(cx - x)), Math.abs(cz - z)));
      const v = Math.min(1, reach(d, big || s.cat === 'special')*pow), k = x+','+z; mx[k] = Math.max(mx[k], v); sum[k] += v; } }
  // the strongest source greens a tile; every other nearby piece adds a little more (so busy areas heal first)
  for (const k in gm) gm[k] = Math.min(1, mx[k] + .22*(sum[k] - mx[k]));
  return gm; }
const band = g => g < .3 ? 0 : g < .7 ? 1 : 2;
const _c = new THREE.Color(), _c2 = new THREE.Color();
function tileColour(g, x, z, out){
  const i = (x+z)%2 ? 0 : 1, sm = t => t*t*(3 - 2*t);
  const cl = v => Math.max(0, Math.min(1, v));
  if (g < .6) out.set(TOP_BLACK[i]).lerp(_c2.set(TOP_MOSS[i]), sm(cl((g - .12)/.48))); else out.set(TOP_MOSS[i]).lerp(_c2.set(TOP_GREEN[i]), sm((g - .6)/.4));
  const r = rngFrom(x*13 + z*7)(); return out.offsetHSL(0, 0, (r - .5)*.03); }
function paintTiles(gm){
  if (!V || !V.caps) return; V.phxG = {};
  V.capCells.forEach(c => { const g = gm[c.x+','+c.z]; V.phxG[c.x+','+c.z] = g; V.caps.setColorAt(c.i, tileColour(g, c.x, c.z, _c)); });
  if (V.caps.instanceColor) V.caps.instanceColor.needsUpdate = true; }

/* per-cell ground: black cells get lava cracks + basalt pebbles, moss cells get sprouts, green cells get grass and flowers */
const HEAT_GEO = new THREE.PlaneGeometry(.95, .95).rotateX(-Math.PI/2);
const HEAT_MAT = new THREE.MeshBasicMaterial({ map:TEX.glow, color:0xFF5A10, transparent:true, opacity:.3, blending:THREE.AdditiveBlending, depthWrite:false });
const FLOWERS = [0xF59BB8, 0xF4C84A, 0xFFF4E0, 0xFF8A5A, 0xB7A2F0];
function groundDecor(slots){
  const gm = greenMap(); paintTiles(gm);
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; cellsOf(sl).forEach(([x,z]) => occ.set(x+','+z, sl)); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; cellsOf(sl).forEach(([x,z]) => occ.set(x+','+z, 'later')); });
  const done = placed.length >= TH().slots.length;
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    if (ringOf(x,z) > V.ring) continue;
    const key = x+','+z, sl = occ.get(key), r = rngFrom(x*41 + z*17 + 3), p = cellPos(x,z), gb = band(gm[key]);
    const isPlaced = sl && sl !== 'later' && placed.includes(sl.id);
    if (isPlaced) continue;
    const waiting = sl && sl !== 'later';
    const grp = new THREE.Group(); grp.userData.rg = ringOf(x,z); grp.userData.cell = [x,z]; grp.userData.phx = true; world.add(grp);
    grp.userData.decor = waiting ? 'waiting' : 'meadow'; if (waiting) V.cellDecor[key] = grp;
    const a = new Acc(), n = waiting ? .5 : 1;
    const off = () => { const ang = r()*6.28, rad = .1 + r()*.3; return [p.x + Math.cos(ang)*rad, p.z + Math.sin(ang)*rad]; };
    if (gb === 0) {
      // near-black basalt with glowing cracks: wider, hotter cracks (and wider still at night, when they are the only light)
      for (let i=0;i<Math.round(2*n + r()*1.4);i++){ const [cx, cz] = off(); crack(a, gm[key] > .15 ? M.lavaDim : M.lava, cx - .1, cz - .05, .3 + r()*.2, r()*6.28, r, TILE_TOP + .004, S.night ? .05 : .038); }
      for (let i=0;i<Math.round(2*n + r()*2);i++){ const [cx, cz] = off(); rock(a, r() < .5 ? M.basaltD : M.crust, cx, TILE_TOP + .02, cz, .04 + r()*.05, .6, r, r()*6); }
      if (!waiting && r() < .35) { const [cx, cz] = off(); const acc2 = a; columns(acc2, 3, r, .08, .08, .2, cx - p.x + p.x, cz); }
    } else if (gb === 1) {
      for (let i=0;i<Math.round(1*n + r());i++){ const [cx, cz] = off(); crack(a, M.lavaDim, cx - .08, cz, .18 + r()*.12, r()*6.28, r, TILE_TOP + .004, S.night ? .03 : .02); }
      for (let i=0;i<Math.round(1 + r()*1.5);i++){ const [cx, cz] = off(); rock(a, M.basalt, cx, TILE_TOP + .02, cz, .035 + r()*.04, .6, r, r()*6); }
      for (let i=0;i<Math.round(3*n + r()*2);i++){ const [cx, cz] = off(); const nm = r() < .5 ? 'Clover_1' : 'Grass_Wispy_Short';
        const t = tpl(nm); if (t) addModel(grp, nm, fitScale(t, .11, .3)*(.7 + r()*.5), cx, TILE_TOP, cz, r()*6.28, 'a'); }
    } else {
      for (let i=0;i<Math.round(4*n + r()*2);i++){ const [cx, cz] = off(); const nm = r() < .45 ? 'Grass_Common_Short' : (r() < .5 ? 'Clover_1' : 'Grass_Wispy_Short');
        const t = tpl(nm); if (t) addModel(grp, nm, fitScale(t, .18, .4)*(.7 + r()*.6), cx, TILE_TOP, cz, r()*6.28, 'a'); }
      const fl = waiting ? 1 : (done ? 4 : 2) + Math.floor(r()*2);
      for (let i=0;i<fl;i++){ const [cx, cz] = off(); tintedFlower(grp, r() < .5 ? 'Flower_3' : 'Flower_4', .2 + r()*.08, cx, TILE_TOP, cz, r()*6.28, FLOWERS[Math.floor(r()*FLOWERS.length)]); }
      if (!waiting && done && r() < .3) { const [cx, cz] = off(); km(grp, 'a', 'Fern_1', .26, .4, cx, TILE_TOP, cz, r()*6); }
    }
    a.into(grp);
    grp.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    if (S.night && gb === 0) {                        // night: the cooled lava breathes a faint orange heat through its cracks
      const hg = new THREE.Mesh(HEAT_GEO, HEAT_MAT); hg.position.set(p.x, TILE_TOP + .006, p.z); hg.renderOrder = 2; grp.add(hg); }
  }
}
function rebuildGround(){
  if (!V) return;
  world.children.filter(o => o.userData.phx).forEach(o => { world.remove(o); const [x,z] = o.userData.cell; if (V.cellDecor[x+','+z] === o) delete V.cellDecor[x+','+z]; });
  groundDecor(TH().slots.filter(sl => slotRing(sl) <= V.ring)); hooks.kick(); }
/* the drop: a green wave runs out from the new piece, tile by tile, then the ground is rebuilt for the new colours */
function greenWave(pos, big){
  if (!V || !V.caps) return;
  const from = { ...(V.phxG || {}) }, to = greenMap();
  const ring = new THREE.Mesh(new THREE.RingGeometry(.3, .46, 48).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color:0xB8F58A, transparent:true, opacity:.9, depthWrite:false }));
  ring.position.copy(pos).setY(TILE_TOP + .015); fx.add(ring);
  const cells = V.capCells.map(c => ({ ...c, d:Math.hypot(c.x - 3 - pos.x, c.z - 3 - pos.z), a:from[c.x+','+c.z] ?? 0, b:to[c.x+','+c.z] }));
  sparkle(pos.clone().setY(TILE_TOP + .2), big ? 16 : 10, 0xC8F59A, big ? 1.3 : .8);
  const step = t => {
    cells.forEach(c => { const u = Math.max(0, Math.min(1, (t - c.d*.1)/.35)); V.caps.setColorAt(c.i, tileColour(c.a + (c.b - c.a)*u, c.x, c.z, _c)); });
    V.caps.instanceColor.needsUpdate = true;
    ring.scale.setScalar(1 + t*(big ? 7 : 5)); ring.material.opacity = .85*(1 - t);
  };
  if (S.rm) { step(1); fx.remove(ring); rebuildGround(); return; }
  tween(1300, step, () => { fx.remove(ring); ring.material.dispose(); if (S.drop == null) rebuildGround(); });
}

/* ══════════ BLUEPRINT: the farm's cells, a healing volcanic isle ══════════ */
const MAP = {
  bigbarn:{ name:'Seed dome', b:'dome' },
  silo:{ name:'Lookout tower', b:'lookout' }, silohouse:{ name:'Basalt hut', b:'hut', v:0 }, coop:{ name:'Bird poles', b:'birdpole' },
  smallbarn:{ name:'Basalt hut', b:'hut', v:1 }, openbarn:{ name:'Rain shelter', b:'shelter' },
  well:{ name:'Rain cloud', b:'cloud', v:0 }, pump:{ name:'Rain cloud', b:'cloud', v:1 }, watertower:{ name:'Spring pool', b:'pool', v:0 }, pond:{ name:'Lily pool', b:'pool', v:1 },
  apple1:{ name:'Shade tree', b:'tree', t:'CommonTree_1' }, apple2:{ name:'Shade tree', b:'tree', t:'CommonTree_3' },
  apple3:{ name:'Flame tree', b:'flame' }, apple4:{ name:'Shade tree', b:'tree', t:'CommonTree_2' },
  orange1:{ name:'Coconut palm', b:'palm', t:'PalmTree_1' }, orange2:{ name:'Coconut palm', b:'palm', t:'PalmTree_3' },
  berry1:{ name:'Flowering bush', b:'bush' }, berry2:{ name:'Flowering bush', b:'bush' },
  peepal:{ name:'Phoenix spring', b:'phoenix' }
};
const FIELD = ['Lava field', 'Lava field', 'Cooling flow'];
const PATH_N = { path3_4:'Basalt steps', path3_5:'Basalt steps', path1_2:'Stepping columns', path5_2:'Basalt steps', path3_6:'Stepping columns', path2_6:'Basalt steps', path3_0:'Stepping columns' };
export const PHOENIX = FARM_SLOTS.map((f, i) => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') return { ...s, kind:'field', b:'field', name:FIELD[i%3], stages:5 };
  if (f.kind === 'path') return { ...s, kind:'path', b:'path', name:PATH_N[f.id] || 'Basalt steps' };
  if (f.kind === 'fence') return { ...s, kind:'fence', b:'ridge', edge:f.edge, len:f.len, name:'Basalt ridge' };
  return { ...s, kind:'p', ...MAP[f.id] };
});

/* ══════════ PIECES ══════════ */
function cloudPuff(a, x, y, z, s, r){
  for (let i=0;i<5;i++){ const ang = i/5*6.28 + r()*.4, d = s*.45; blob(a, i%2 ? M.cloud : M.cloudD, V3(x + Math.cos(ang)*d, y + (r()-.3)*s*.2, z + Math.sin(ang)*d*.7), s*(.45 + r()*.15), .72, 1, r); }
  blob(a, M.cloud, V3(x, y + s*.22, z), s*.6, .8, 1, r); }
function pool(a, r, rad, lily){
  a.add(new THREE.CylinderGeometry(rad, rad*1.02, .03, 28), M.water, at(0, .02, 0, 0, 1, 1, .9));
  for (let i=0;i<13;i++){ const ang = i/13*6.28; rock(a, i%2 ? M.basalt : M.basaltL, Math.cos(ang)*rad*1.02, .03, Math.sin(ang)*rad*.92, .06 + r()*.03, .75, r, r()*6); }
  if (lily) for (let i=0;i<4;i++){ const ang = r()*6.28, d = r()*rad*.6; a.add(new THREE.CylinderGeometry(.06, .06, .01, 12), M.pad, at(Math.cos(ang)*d, .04, Math.sin(ang)*d));
    if (i%2 === 0) { a.add(new THREE.ConeGeometry(.03, .04, 6), M.lotus, at(Math.cos(ang)*d, .065, Math.sin(ang)*d)); a.add(new THREE.SphereGeometry(.012, 6, 4), M.lotusC, at(Math.cos(ang)*d, .08, Math.sin(ang)*d)); } }
}
function flameCanopy(a, cx, cy, cz, R, r, n=26){
  for (let i=0;i<n;i++){ const u = r(), v = r(), th = u*6.28, ph = Math.acos(1 - v*1.3), d = R*(.75 + r()*.3);
    const p = V3(cx + Math.sin(ph)*Math.cos(th)*d, cy + Math.cos(ph)*d*.75, cz + Math.sin(ph)*Math.sin(th)*d);
    const dir = p.clone().sub(V3(cx, cy - R*.4, cz)).normalize();
    seg(a, [M.fOrange, M.fGold, M.fRed][i%3], p, dir, .07 + r()*.05, .05, .0, 5); }
  blob(a, M.fOrange, V3(cx, cy, cz), R*.86, .8, 1, r); blob(a, M.fGold, V3(cx - R*.2, cy + R*.3, cz + R*.2), R*.5, .7, 1, r); }
const B = {
  field(g, s, opt){                                        // Sudoku/Math: a lava field that cools into a meadow over 5 stages
    const host = new THREE.Group(); g.add(host); g.userData.plants = host;
    g.userData.regrow = st => fillField(host, s, st); fillField(host, s, opt.stage ?? cropStage(s.id)); },
  path(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 1);
    const pts = [[-.26,-.22],[.02,-.04],[.27,.22],[-.05,.3],[.28,-.28]];
    pts.forEach(([x, z], i) => { const rr = .11 + r()*.03, h = .03 + r()*.04, ry = r();
      a.add(hexG(rr, h), M.basalt, at(x, 0, z, ry)); a.add(hexG(rr*.95, .01), i%2 ? M.basaltL : M.ash, at(x, h, z, ry)); });
    a.into(g); g.userData.ghostMode = 'marker'; },
  ridge(g, s){ const a = new Acc(), r = rngFrom(s.x*3 + s.z*7 + 2), n = s.len*5;
    for (let i=0;i<n;i++){ const t = ((i + .5)/n - .5)*s.len, h = .12 + r()*.22 + (i%2)*.05, rr = .085 + r()*.02, ry = r();
      const [x, z] = s.edge === 'w' ? [-.42 + (r()-.5)*.05, t] : [t, .42 + (r()-.5)*.05];
      a.add(hexG(rr, h), i%3 ? M.basalt : M.basaltD, at(x, 0, z, ry)); a.add(hexG(rr*.96, .012), r() < .5 ? M.moss : M.basaltL, at(x, h, z, ry)); }
    a.into(g);
    for (let i=0;i<s.len*2;i++){ const t = ((i + .5)/(s.len*2) - .5)*s.len; const [x, z] = s.edge === 'w' ? [-.3, t] : [t, .3]; km(g, 'a', 'Fern_1', .16, .24, x, 0, z, r()*6); }
    const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz); },
  hut(g, s){ const a = new Acc(), r = rngFrom(s.v*11 + 5);
    a.add(new THREE.CylinderGeometry(.44, .46, .05, 18), M.ash, at(0, .025, 0));
    // basalt block wall: stacked rough stones
    for (let row=0; row<4; row++) for (let i=0;i<12;i++){ const ang = i/12*6.28 + row*.26; if (row < 3 && ang > .5 && ang < 1.1) continue;   // door gap facing the camera
      a.add(new THREE.BoxGeometry(.16, .085, .1), [M.basalt, M.basaltL, M.basaltD][(i + row)%3], at(Math.cos(ang)*.3, .09 + row*.085, Math.sin(ang)*.3, -ang + Math.PI/2)); }
    a.add(new THREE.CylinderGeometry(.27, .27, .34, 14), M.basaltD, at(0, .22, 0));
    a.add(new THREE.BoxGeometry(.12, .2, .02), M.woodD, at(Math.cos(.785)*.31, .15, Math.sin(.785)*.31, -.785 + Math.PI/2));
    a.add(new THREE.BoxGeometry(.09, .07, .02), M.win, at(Math.cos(-.2)*.31, .24, Math.sin(-.2)*.31, .2 + Math.PI/2));
    a.add(new THREE.ConeGeometry(.46, .38, 14), s.v ? M.thatchD : M.thatch, at(0, .58, 0));
    a.add(new THREE.ConeGeometry(.2, .16, 10), M.thatchD, at(0, .76, 0));
    a.into(g); km(g, 'a', 'Bush_Common_Flowers', .2, .3, .36, 0, .22, r()*6); },
  lookout(g){ const a = new Acc();
    for (const [x, z] of [[-.17,-.17],[.17,-.17],[-.17,.17],[.17,.17]]) seg(a, M.woodD, V3(x, 0, z), V3(-x*.3, 1, -z*.3), .78, .03, .025, 6);
    a.add(new THREE.BoxGeometry(.4, .04, .4), M.plank, at(0, .74, 0));
    for (const s2 of [-1, 1]) { a.add(new THREE.BoxGeometry(.4, .02, .02), M.wood, at(0, .86, s2*.19)); a.add(new THREE.BoxGeometry(.02, .02, .4), M.wood, at(s2*.19, .86, 0)); }
    a.add(new THREE.ConeGeometry(.34, .26, 4), M.thatch, at(0, 1.08, 0, Math.PI/4));
    for (let i=0;i<5;i++) a.add(new THREE.BoxGeometry(.14, .012, .03), M.woodD, at(.2, .12 + i*.13, .1, .3, 1, 1, 1, 0, .7));
    columns(a, 4, rngFrom(9), .3, .05, .14);
    a.into(g); },
  birdpole(g){ const a = new Acc(), r = rngFrom(33);
    [[-.18, .1, .9, M.parR], [.16, -.12, .7, M.parB], [.1, .24, .55, M.parY]].forEach(([x, z, h, col]) => {
      seg(a, M.woodD, V3(x, 0, z), V3(0,1,0), h, .03, .025, 6);
      a.add(new THREE.BoxGeometry(.16, .15, .15), M.plank, at(x, h, z)); a.add(new THREE.ConeGeometry(.14, .1, 4), col, at(x, h + .12, z, Math.PI/4));
      a.add(new THREE.CylinderGeometry(.03, .03, .02, 10).rotateX(Math.PI/2), M.crust, at(x + .0, h, z + .076));
      a.add(new THREE.CylinderGeometry(.008, .008, .06, 5).rotateX(Math.PI/2), M.woodD, at(x, h - .05, z + .1)); });
    columns(a, 3, r, .3, .05, .12);
    a.into(g); km(g, 'a', 'Bush_Common', .18, .28, -.28, 0, -.25, 1); },
  shelter(g){ const a = new Acc();
    for (const [x, z] of [[-.32,-.3],[.32,-.3],[-.32,.3],[.32,.3]]) seg(a, M.woodD, V3(x, 0, z), V3(0,1,0), .42, .035, .03, 6);
    a.add(new THREE.ConeGeometry(.62, .34, 4), M.thatch, at(0, .58, 0, Math.PI/4, 1, 1, 1));
    a.add(new THREE.BoxGeometry(.5, .05, .16), M.plank, at(0, .14, .12)); a.add(new THREE.BoxGeometry(.5, .04, .04), M.woodD, at(0, .08, .12));
    for (let i=0;i<6;i++) a.add(new THREE.CylinderGeometry(.006, .006, .14, 4), M.rain, at(-.45 + i*.18, .33, .36));
    a.into(g); km(g, 'a', 'Plant_1', .2, .3, -.2, 0, -.1, 2); },
  dome(g){ const a = new Acc(), r = rngFrom(71);                 // Reading: a seed dome, a glasshouse of saved seedlings
    a.add(new THREE.CylinderGeometry(.9, .93, .08, 6), M.basalt, at(0, .04, 0, .3)); a.add(new THREE.CylinderGeometry(.86, .86, .012, 6), M.basaltL, at(0, .086, 0, .3));
    const R = .66;
    for (let i=0;i<8;i++){ const ang = i/8*6.28;
      a.add(new THREE.TorusGeometry(R, .018, 5, 20, Math.PI).rotateY(ang), M.wood, at(0, .09, 0)); }
    a.add(new THREE.TorusGeometry(R, .025, 5, 32), M.woodD, at(0, .09, 0, 0, 1, 1, 1, Math.PI/2));
    a.add(new THREE.TorusGeometry(R*.72, .018, 5, 28), M.wood, at(0, .09 + R*.69, 0, 0, 1, 1, 1, Math.PI/2));
    a.add(new THREE.BoxGeometry(.2, .3, .06), M.woodD, at(.44, .24, .44, Math.PI/4));
    a.into(g);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 12, 0, 6.28, 0, Math.PI/2), M.glass); glass.position.y = .09; glass.renderOrder = 6; glass.castShadow = false; g.add(glass);
    km(g, 'a', 'CommonTree_5', .78, .6, -.08, .09, -.05, 1);
    for (const [x, z, n] of [[.3, -.2, 'Plant_1'], [-.32, .2, 'Bush_Common_Flowers'], [.18, .3, 'Fern_1'], [-.3, -.3, 'Plant_7']]) km(g, 'a', n, .22, .3, x, .09, z, r()*6);
    const b = new Acc(); for (let i=0;i<6;i++){ const ang = i/6*6.28 + .5; b.add(new THREE.CylinderGeometry(.06, .05, .07, 8), M.thatchD, at(Math.cos(ang)*.82, .12, Math.sin(ang)*.82)); b.add(new THREE.SphereGeometry(.05, 7, 5), M.leaf, at(Math.cos(ang)*.82, .19, Math.sin(ang)*.82)); }
    b.into(g); },
  cloud(g, s){ const a = new Acc(), r = rngFrom(s.v*19 + 4);        // Breathe: a rain cloud watering the ash
    cloudPuff(a, 0, .98, 0, .38, r);
    for (let i=0;i<14;i++){ const x = (r()-.5)*.5, z = (r()-.5)*.36; a.add(new THREE.CylinderGeometry(.009, .009, .18 + r()*.1, 4), M.rain, at(x, .22 + r()*.5, z)); }
    a.add(new THREE.CylinderGeometry(.3, .3, .012, 22), M.water, at(0, .012, 0, 0, 1, 1, .8));
    for (let i=0;i<3;i++) a.add(new THREE.TorusGeometry(.06 + i*.05, .006, 4, 20), M.foam, at((i-1)*.08, .02, (i%2)*.05, 0, 1, 1, 1, Math.PI/2));
    a.into(g); km(g, 'a', 'Grass_Common_Tall', .2, .3, .3, 0, -.18, 1); km(g, 'a', 'Clover_2', .1, .25, -.3, 0, .2, 2); },
  pool(g, s){ const a = new Acc(), r = rngFrom(s.v*23 + 8);
    pool(a, r, .34, s.v === 1);
    if (!s.v) { a.add(new THREE.ConeGeometry(.05, .16, 8), M.foam, at(0, .1, 0)); for (let i=0;i<5;i++) a.add(new THREE.SphereGeometry(.025, 6, 4), M.foam, at(Math.cos(i*1.26)*.07, .05, Math.sin(i*1.26)*.07)); }
    a.into(g); km(g, 'a', 'Grass_Wispy_Tall', .24, .3, -.36, 0, -.3, 1); if (s.v) km(g, 'a', 'Plant_7', .22, .3, .36, 0, .3, 1); },
  tree(g, s){ km(g, 'a', s.t, 1.3, .95, 0, 0, 0, s.x + s.z); },
  palm(g, s){ km(g, PK, s.t, 1.35, .9, 0, 0, 0, s.x*1.3); const a = new Acc(), r = rngFrom(s.x + 3); for (let i=0;i<3;i++) rock(a, M.basalt, (r()-.5)*.5, .03, (r()-.5)*.5, .05, .6, r, 0); a.into(g); },
  bush(g, s){ km(g, 'a', 'Bush_Common_Flowers', .55, .8, 0, 0, 0, s.x); },
  flame(g){ const a = new Acc(), r = rngFrom(88);
    seg(a, M.woodD, V3(0, 0, 0), V3(.08, 1, 0), .62, .07, .045, 7);
    for (const [dx, dz] of [[.3, .1], [-.25, .15], [.05, -.3]]) seg(a, M.woodD, V3(.03, .5, 0), V3(dx, .5, dz), .34, .035, .02, 5);
    flameCanopy(a, .05, .92, 0, .36, r); flameCanopy(a, .3, .84, .1, .2, r, 10); flameCanopy(a, -.22, .86, .12, .2, r, 10);
    for (let i=0;i<6;i++) a.add(new THREE.ConeGeometry(.03, .02, 5), M.fOrange, at((r()-.5)*.7, .012, (r()-.5)*.7, r()*6));
    a.into(g); },
  phoenix(g){                                             // Gita: the phoenix spring (the hero). A basalt ledge, a waterfall into a
    const a = new Acc(), r = rngFrom(404);                 // spring pool, a flame-feather tree and the phoenix on her nest
    a.add(new THREE.CylinderGeometry(.95, .97, .05, 30), M.ash, at(0, .025, 0));
    // the ledge: basalt columns rising toward the back-left
    for (let i=0;i<34;i++){ const u = r(), v = r(), x = -.8 + u*1.2, z = -.85 + v*.8; if (x + z > -.15) continue;
      const h = .25 + (-(x + z) - .15)*.55 + r()*.12, rr = .09 + r()*.03, ry = r();
      a.add(hexG(rr, h), i%3 ? M.basalt : M.basaltD, at(x, 0, z, ry)); a.add(hexG(rr*.96, .014), r() < .6 ? M.moss : M.basaltL, at(x, h, z, ry)); }
    // pool in front
    a.add(new THREE.CylinderGeometry(.5, .5, .035, 30), M.water, at(.28, .04, .3, 0, 1, 1, .85));
    for (let i=0;i<16;i++){ const ang = i/16*6.28; rock(a, i%2 ? M.basalt : M.basaltL, .28 + Math.cos(ang)*.5, .04, .3 + Math.sin(ang)*.43, .07 + r()*.03, .7, r, r()*6); }
    // waterfall: a glossy sheet from the ledge lip down into the pool, foam at its foot
    a.add(new THREE.BoxGeometry(.26, .62, .03), M.water, at(-.08, .34, -.02, -Math.PI/4));
    for (let i=0;i<5;i++) a.add(new THREE.BoxGeometry(.012, .6, .034), M.foam, at(-.08 + (i-2)*.05*Math.cos(Math.PI/4), .34, -.02 - (i-2)*.05*Math.sin(Math.PI/4) , -Math.PI/4));
    for (let i=0;i<7;i++) a.add(new THREE.SphereGeometry(.04 + r()*.03, 7, 5), M.foam, at(.02 + (r()-.5)*.25, .06, .08 + (r()-.5)*.12));
    // the phoenix tree: a twisting trunk on the ledge top, a canopy of flame feathers
    const tx = -.45, tz = -.5, ty = .72;
    seg(a, M.woodD, V3(tx, ty - .1, tz), V3(.12, 1, .06), .55, .08, .05, 7);
    seg(a, M.woodD, V3(tx + .05, ty + .3, tz), V3(.5, .6, .2), .32, .04, .025, 5);
    seg(a, M.woodD, V3(tx + .05, ty + .3, tz), V3(-.4, .6, .3), .3, .04, .025, 5);
    flameCanopy(a, tx + .08, ty + .72, tz + .03, .42, r, 34); flameCanopy(a, tx + .36, ty + .56, tz + .18, .22, r, 12); flameCanopy(a, tx - .2, ty + .56, tz + .2, .22, r, 12);
    // nest + glowing egg on the lip
    a.add(new THREE.TorusGeometry(.1, .04, 6, 14), M.thatchD, at(.12, .46, -.34, 0, 1, 1, 1, Math.PI/2));
    columns(a, 1, rngFrom(3), 0, .38, .38, .12, -.34);
    a.add(new THREE.SphereGeometry(.07, 12, 8), M.ember, at(.12, .52, -.34, 0, .85, 1.1, .85));
    // lush rim
    a.into(g);
    const bird = makePhoenix(); bird.scale.setScalar(.95); bird.position.set(tx + .1, ty + 1.12, tz + .05); bird.rotation.y = .8; g.add(bird);
    for (const [x, z, n, h] of [[.8, -.1, 'Fern_1', .26], [-.1, .8, 'Bush_Common_Flowers', .28], [.7, .7, 'Plant_1', .24], [.66, -.55, 'Grass_Common_Tall', .2], [-.7, .55, 'Fern_1', .24]]) km(g, 'a', n, h, .34, x, 0, z, r()*6);
    for (let i=0;i<5;i++) tintedFlower(g, 'Flower_3', .24, .05 + Math.cos(i)*.8, 0, .55 + Math.sin(i)*.3, i, FLOWERS[i]);
  }
};
function fillField(host, s, st){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 5);
  const slabMat = [null, M.crust, M.ash, M.moss, M.grass, M.grass][st];
  const slab = new THREE.Mesh(G.field, slabMat); slab.position.y = .035; slab.castShadow = slab.receiveShadow = true; host.add(slab);
  const top = .072;
  if (st <= 2) for (let i=0;i<(st === 1 ? 5 : 3);i++) crack(a, st === 1 ? M.lava : M.lavaDim, (r()-.5)*.6, (r()-.5)*.6, .32 + r()*.2, r()*6.28, r, top, st === 1 ? .034 : .02);
  if (st === 1) for (let i=0;i<4;i++) rock(a, M.basaltD, (r()-.5)*.7, top + .02, (r()-.5)*.7, .05 + r()*.04, .6, r, r()*6);
  if (st === 1) for (let i=0;i<3;i++) blob(a, M.ember, V3((r()-.5)*.5, top + .01, (r()-.5)*.5), .03, .5, 0, r);
  if (st === 2) for (let i=0;i<3;i++) rock(a, M.basalt, (r()-.5)*.7, top + .02, (r()-.5)*.7, .05, .6, r, r()*6);
  a.into(host);
  const put = (nm, h, n) => { for (let i=0;i<n;i++){ const t = tpl(nm); if (!t) return; addModel(host, nm, fitScale(t, h, .4)*(.75 + r()*.5), (r()-.5)*.64, top, (r()-.5)*.64, r()*6.28, 'a'); } };
  if (st === 2) put('Clover_1', .08, 3);
  if (st === 3) { put('Clover_1', .1, 4); put('Grass_Wispy_Short', .12, 3); }
  if (st >= 4) { put('Grass_Common_Short', .18, st === 5 ? 6 : 5); put('Clover_2', .12, 2); }
  if (st === 5) { for (let i=0;i<5;i++) tintedFlower(host, i%2 ? 'Flower_3' : 'Flower_4', .24, (r()-.5)*.6, top, (r()-.5)*.6, r()*6, FLOWERS[i]); put('Fern_1', .22, 1); }
  if (st === 4) { for (let i=0;i<2;i++) tintedFlower(host, 'Flower_4', .2, (r()-.5)*.6, top, (r()-.5)*.6, r()*6, FLOWERS[i+1]); }
}

/* ══════════ creatures: the phoenix, parrots, hatchling sea turtles ══════════ */
function wingGeo(len, wid){ const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(len*.5, wid*1.2, len, wid*.3); s.lineTo(len*.8, -wid*.2); s.quadraticCurveTo(len*.4, -wid*.3, 0, -wid*.6); s.closePath();
  return new THREE.ShapeGeometry(s, 6).rotateX(-Math.PI/2); }
function makePhoenix(){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.1, 12, 8), M.pBody, at(0, 0, 0, 0, .9, .9, 1.35));
  a.add(new THREE.SphereGeometry(.07, 12, 8), M.pBody, at(0, .09, .12));
  a.add(new THREE.ConeGeometry(.022, .07, 6).rotateX(Math.PI/2), M.beak, at(0, .08, .21));
  for (const sx of [-1, 1]) a.add(new THREE.SphereGeometry(.013, 6, 4), M.eye, at(sx*.045, .11, .17));
  for (let i=0;i<3;i++) seg(a, M.pTip, V3(0, .15, .1), V3((i-1)*.35, 1, -.4), .09, .014, .0, 5);            // crest
  for (let i=0;i<5;i++) seg(a, i%2 ? M.pTip : M.pWing, V3(0, -.02, -.12), V3((i-2)*.12, -.25 - (i%2)*.1, -1), .36 + (i%2)*.12, .03, .004, 5);   // long tail
  a.into(g);
  const wg = wingGeo(.36, .13);
  const w1 = new THREE.Group(), w2 = new THREE.Group();
  const m1 = new THREE.Mesh(wg, M.pWing), m2 = new THREE.Mesh(wg, M.pWing); m1.castShadow = m2.castShadow = true;
  [m1, m2].forEach(m => { m.material = M.pWing; }); m1.material.side = THREE.DoubleSide;
  const t1 = new THREE.Mesh(wingGeo(.2, .07), M.pTip), t2 = new THREE.Mesh(wingGeo(.2, .07), M.pTip); M.pTip.side = THREE.DoubleSide;
  t1.position.set(.16, .005, -.02); t2.position.set(.16, .005, -.02); m1.add(t1); m2.add(t2);
  w1.add(m1); w2.add(m2); w2.scale.x = -1; w1.position.set(.06, .04, 0); w2.position.set(-.06, .04, 0);
  w1.rotation.z = .7; w2.rotation.z = -.7; g.add(w1, w2); g.userData.wings = [w1, w2];
  return g;
}
function makeParrot(i){
  const col = [M.parR, M.parB, M.parG][i%3], acc = [M.parY, M.parY, M.parR][i%3], g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.07, 10, 7), col, at(0, 0, 0, 0, .85, .85, 1.3));
  a.add(new THREE.SphereGeometry(.05, 10, 7), col, at(0, .06, .08));
  a.add(new THREE.ConeGeometry(.018, .04, 6).rotateX(Math.PI/2 + .5), M.foam, at(0, .05, .135));
  for (const sx of [-1, 1]) a.add(new THREE.SphereGeometry(.01, 6, 4), M.eye, at(sx*.032, .075, .11));
  seg(a, acc, V3(0, -.01, -.08), V3(0, -.2, -1), .16, .025, .006, 5);
  a.into(g);
  const wg = wingGeo(.2, .08); col.side = THREE.DoubleSide;
  const w1 = new THREE.Group(), w2 = new THREE.Group(); w1.add(new THREE.Mesh(wg, col)); w2.add(new THREE.Mesh(wg, col)); w2.scale.x = -1;
  w1.position.set(.04, .03, 0); w2.position.set(-.04, .03, 0); g.add(w1, w2); g.userData.wings = [w1, w2];
  return g;
}
function makeBaby(){ const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.1, 14, 8, 0, Math.PI*2, 0, Math.PI*.5).scale(1.2, .75, 1), M.babyShell);
  a.add(new THREE.CylinderGeometry(.118, .118, .02, 16).scale(1.02, 1, .86), M.belly);
  for (let i=0;i<5;i++){ const ang = i/5*6.28; a.add(new THREE.SphereGeometry(.028, 6, 4).scale(1, .35, 1), M.spot, at(Math.cos(ang)*.06, .07, Math.sin(ang)*.05)); }
  a.add(new THREE.SphereGeometry(.055, 12, 8), M.babySkin, at(0, .02, .15));
  for (const sx of [-1, 1]) { a.add(new THREE.SphereGeometry(.016, 8, 6), M.eye, at(sx*.03, .045, .19));
    a.add(new THREE.SphereGeometry(.05, 8, 6).scale(1.4, .2, .55), M.babySkin, at(sx*.13, 0, .05, sx*.6)); }
  a.into(g); return g; }
/* flight/crawl paths (world units): circles around a centre, eased in from off-plot on arrival */
const FLY = {
  phoenix:{ cx:0, cz:-.4, r:2.3, h:2.7, sp:.4, ph:3.4, s:1.15 },
  parrot:[ { cx:0, cz:0, r:2.4, h:1.75, sp:.55, ph:.4 }, { cx:0, cz:0, r:2.55, h:1.9, sp:.55, ph:.72 }, { cx:-.4, cz:.5, r:1.8, h:1.55, sp:-.62, ph:2.2 } ],
  baby:[0,1,2,3].map(i => ({ cx:2.62, cz:-.9 + i*.02, r:.0, h:TILE_TOP + .01, sp:0, ph:i, line:i }))
};
function flyPos(u, t, out){ const a = t*u.sp + u.ph; return out.set(u.cx + Math.cos(a)*u.r, TILE_TOP + u.h + Math.sin(a*2.1)*.08, u.cz + Math.sin(a)*u.r*.8); }
/* hatchlings: a little line crawling out of the nest by the lily pool, down the right edge, and back (a slow shuttle) */
function crawlPos(u, t, out){ const k = (Math.sin(t*.18 + u.ph*.7) + 1)/2; return out.set(3.22 + Math.sin(t*1.3 + u.ph)*.04, u.h, -1.55 + k*2.2 + u.line*.24); }
function addFlyer(kind, obj, u, resident){ const f = { kind, obj, u, arrive:resident ? 0 : 1 }; world.add(obj); (V.flyers || (V.flyers = [])).push(f); V.life.push(obj); return f; }
function animateFlyers(t){
  (V && V.flyers || []).forEach(f => { const u = f.u, p = new THREE.Vector3(), q = new THREE.Vector3();
    if (f.kind === 'baby') { crawlPos(u, t, p); crawlPos(u, t + .05, q); } else { flyPos(u, t, p); flyPos(u, t + .03*Math.sign(u.sp || 1), q); }
    const d = q.sub(p);
    if (f.arrive < 1) { if (f.kind === 'baby') { f.obj.scale.setScalar((u.s || 1)*Math.max(.001, f.arrive)); }
      else { const from = f.from || (f.from = p.clone().add(V3(-3.5, 2.2, 4))); p.lerpVectors(from, p, 1 - Math.pow(1 - f.arrive, 3)); } }
    else if (f.kind === 'baby') f.obj.scale.setScalar(u.s || 1);
    f.obj.position.copy(p); if (d.lengthSq() > 1e-8) f.obj.rotation.y = Math.atan2(d.x, d.z);
    if (f.kind === 'baby') f.obj.rotation.z = Math.sin(t*6 + u.ph)*.08;
    const w = f.obj.userData.wings; if (w) { const fl = Math.sin(t*(f.kind === 'phoenix' ? 7 : 13) + u.ph*3)*.65 + .15; w[0].rotation.z = fl; w[1].rotation.z = -fl; }
    if (f.kind === 'phoenix' && f.trail) f.trail.forEach((s, i) => { flyPos(u, t - (i + 1)*.09, s.position); s.position.y -= .05; s.material.opacity = .55*(1 - i/f.trail.length)*(f.arrive); });
  });
}
function residentGroups(){
  return [
    () => { const b = makePhoenix(); b.scale.setScalar(FLY.phoenix.s); const f = addFlyer('phoenix', b, FLY.phoenix, true);
      f.trail = []; for (let i=0;i<7;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:i%2 ? 0xFFB020 : 0xFF6A2A, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
        s.scale.setScalar(.22 - i*.02); world.add(s); V.life.push(s); f.trail.push(s); } return [f]; },
    () => FLY.parrot.map((u, i) => { const b = makeParrot(i); b.scale.setScalar(1.5); return addFlyer('parrot', b, u, true); }),
    () => FLY.baby.map((u, i) => { const b = makeBaby(); u.s = 1.5*(1 - i*.06); b.scale.setScalar(.001); return addFlyer('baby', b, u, true); })
  ];
}
async function phoenixMoveIn(walk){
  const groups = residentGroups(); V.residentsIn = true;
  if (!walk) { groups.forEach(g => g().forEach(f => f.arrive = 1)); animateFlyers(2.1); V.arrived = groups.length; return; }
  for (let i=0;i<groups.length;i++){
    const rs = groups[i]();
    await new Promise(res => tween(S.rm ? 1 : 1500, t => { rs.forEach((f, j) => f.arrive = Math.min(1, Math.max(0, t*1.2 - j*.06))); },
      () => { rs.forEach(f => f.arrive = 1); sparkle(rs[0].obj.position.clone(), 10, i ? 0xE9F8FF : 0xFFC24A, .6); res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
}
function ambientLife(){ V.flyers = []; addButterflies(); }

export default {
  id:'phoenix', name:'Paradise', title:'Your paradise',
  season:23, dates:'16–29 Nov', nextIn:14,
  kits:['a', PK],
  kitDefs:{ [PK]:{ file:'assets/dino/palms.glb', sway:true } },
  families:{
    water:   { label:'rain clouds & springs',   tag:'Water' },
    building:{ label:'huts & the seed dome',     tag:'Building' },
    path:    { label:'basalt steps & ridges',    tag:'Path' },
    crop:    { label:'lava fields → meadows',    tag:'Meadow' },
    tree:    { label:'trees & palms',            tag:'Tree' },
    special: { label:'the phoenix spring',       tag:'Special' }
  },
  slots:PHOENIX, order:FARM_ORDER,
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M3 19h18l-2 2H5z" fill="#3A353D"/><path d="M12 18c-4-1-6-4-6-7 2 1 3 2 4 4-.5-3 0-6 2-9 2 3 2.5 6 2 9 1-2 2-3 4-4 0 3-2 6-6 7z" fill="#E8402A"/><path d="M12 16c-1.5-1-2-3-1-5 .5 1 1 1.5 1 2.5.3-1.5.8-2.5 1.5-3.5.7 2 .5 4-1.5 6z" fill="#FFD24A"/><path d="M4 19c1-2 3-3 5-2M20 19c-1-2-3-3-5-2" stroke="#6FB041" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M8 112h112v8H8z"/><path d="M16 112l6-18h8l4 18zM34 112l5-26h8l3 26zM96 112l4-22h8l4 22z"/><path d="M64 104c-18-4-28-18-28-34 10 4 16 10 20 18-2-16 2-32 10-46 8 14 12 30 10 46 4-8 10-14 20-18 0 16-10 30-32 34z"/><path d="M52 40c-8-6-20-6-28 0 8 0 14 4 18 10zM76 40c8-6 20-6 28 0-8 0-14 4-18 10z"/></g>',
  album:{ image:'assets/phoenix/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#EAF3DE)' },
  css:'.phone[data-theme="phoenix"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#F4F0E4 58%,#E6E9D6 100%)}',
  // night: a dim, warm-dark rig so the basalt reads near-black and only the cracks glow (engine/scene.js rigFor)
  lights:{ night:{ hemi:{ sky:0x34405E, ground:0x0C0A0E, intensity:.6 }, sun:{ color:0x9FB2E8, intensity:.55 }, fill:{ intensity:.12 } } },
  ground:{ tile:{ top:TOP_BLACK, side:'#221F24', soilTop:'#3A333B', soilBot:'#161318' } },
  ghost:{ opacity:.42, emissive:.24 },

  build(g, s, opt){ B[s.b](g, s, opt); },
  scaleOf: s => 1,
  contact: s => !['path', 'ridge', 'field', 'cloud'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.b === 'flame',
  decor: groundDecor,
  onImpact: greenWave,
  ambient: ambientLife,
  tick(t){ flyButterflies(t); animateFlyers(t); const k = (1 + Math.sin(t*1.7)*.35)*(S.night ? 1.7 : 1); M.lava.emissiveIntensity = 1.5*k; M.lavaDim.emissiveIntensity = S.night ? 1.3 : .7; M.ember.emissiveIntensity = 1.6*k; },

  residents:[ { id:'phoenix', name:'Phoenix', n:1 }, { id:'parrot', name:'Parrots', n:3 }, { id:'baby', name:'Hatchlings', n:4 } ],
  moveIn: phoenixMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('phoenix:'+d.id, () => { const o = d.id === 'phoenix' ? makePhoenix() : d.id === 'parrot' ? makeParrot(1) : makeBaby(); o.rotation.y = .9; return o; }, 168); },
  residentRig(d){ const o = d.id === 'phoenix' ? makePhoenix() : d.id === 'parrot' ? makeParrot(0) : makeBaby(); o.scale.setScalar(d.id === 'phoenix' ? 1.25 : 1.5);
    return { obj:o, mixer:new THREE.AnimationMixer(o), clip:null, facing:0 }; }
};
