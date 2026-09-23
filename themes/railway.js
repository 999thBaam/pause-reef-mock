/* RAILWAY VALLEY (?theme=railway) — a green valley where the to-dos lay a model railway, one track piece at a time.
   The ten track slots form ONE loop (2..4 × 4 + the front row 1..4 × 6, closed by the curves at x 1 and 4), so the line
   is complete exactly when the land is: a little green tank engine shuttles on whatever connected track exists, and at
   40/40 a full passenger train (engine + three coaches) runs the whole loop with steam puffs.
   Locomotives, coaches and wagons = Kenney Train Kit 1.1 (CC0), packed to assets/railway/railway.glb. Track, station,
   signal box, engine shed, goods shed, signals, level crossing, river, lake, wheat and the mountain tunnel are procedural
   flat-shaded geometry merged per material (Acc). Cottages + crates = Kenney/KayKit pieces in the village kit, water tower +
   apple trees = the farm kit (Quaternius), trees + tufts = the shared MegaKit (kit a); residents = the train + the farm
   Sheep and the shared Cow (all CC0, see assets/railway/LICENSES.md). */
import * as THREE from 'three';
import { rngFrom, world } from '../engine/scene.js';
import { S, V, placed, cropStage, hooks } from '../engine/state.js';
import { cellPos, TILE_TOP } from '../engine/grid.js';
import { KITCACHE, ANIMCACHE, addModel, fitScale, loadAnimal, modelBox } from '../engine/kit.js';
import { Acc } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { meadowDecor } from '../engine/life.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const RK = 'railway', VK = 'village';
const tpl = (kit, n) => KITCACHE[kit] && KITCACHE[kit][n];
function fit(g, kit, name, h, w, x=0, y=0, z=0, rot=0){ const t = tpl(kit, name); if (!t) { console.warn('missing', name); return null; }
  return addModel(g, name, fitScale(t, h, w), x, y, z, rot, kit); }
const TRAIN_K = .2;                 // Kenney train units → tiles: a 2.6-unit engine ≈ .52 tiles

const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.9, metalness:0, flatShading:true, ...o });
const RM = {
  ballast:FM(0xCBBFA8, { roughness:1 }), ballastD:FM(0xB3A58D, { roughness:1 }), sleeper:FM(0xA8683F), rail:FM(0xAFB2CC, { roughness:.55 }),
  stone:FM(0xE9E0CD), stoneD:FM(0xC9BDA5), stoneDD:FM(0xA89C86), brick:FM(0xC8674A), brickD:FM(0xA9533C),
  cream:FM(0xF6EBD3), creamD:FM(0xE4D3B2), roof:FM(0x4E6B8C), roofD:FM(0x3E5775), roofR:FM(0xB8513E), roofRD:FM(0x9A4232),
  wood:FM(0xB27A4B), woodD:FM(0x86573A), green:FM(0x2F6B4F), greenL:FM(0x3F8A63), glass:FM(0x9FD4EE, { roughness:.3 }),
  win:FM(0x35506B, { roughness:.4 }), white:FM(0xFFFFFF), red:FM(0xD9463B), yellow:FM(0xF4C84A), ink:FM(0x2E3440), metal:FM(0x8E9AAB),
  lamp:FM(0xFFE7A0, { emissive:0xFFB940, emissiveIntensity:.9 }), face:FM(0xFFF8E7, { emissive:0x5A4A20, emissiveIntensity:.12 }),
  gold:FM(0xF4C84A, { emissive:0x6A4A00, emissiveIntensity:.25 }),
  water:new THREE.MeshStandardMaterial({ color:0x5CC3E6, roughness:.15, metalness:0, emissive:0x0E4660, emissiveIntensity:.35 }),
  foam:FM(0xF4FBFF, { emissive:0x9FC7D8, emissiveIntensity:.3, roughness:.4 }),
  bank:FM(0x7FAF5A, { roughness:1 }), bankD:FM(0x6A9A4A, { roughness:1 }), reed:FM(0x5E9A3E), cattail:FM(0x7A4A2A),
  rock:FM(0x9D9A93), rockL:FM(0xBDB8AE), snow:FM(0xFBFBFF), grassM:FM(0x78B04F), grassMD:FM(0x5F9A43),
  soil:FM(0x8A5A33, { roughness:1 }), soilD:FM(0x6E4428, { roughness:1 }), dark:FM(0x1E2230, { roughness:1 }),
  sprout:FM(0x8CCB5A), wheatG:FM(0x9CC65A), wheatY:FM(0xD9C35A), wheat:FM(0xEDC35A), wheatD:FM(0xD4A542), mulch:FM(0x8C6A45, { roughness:1 }),
  hedge:FM(0x5DAA4A), hedgeD:FM(0x4A9140), bloomP:FM(0xF7A1C4), bloomW:FM(0xFFF6E0),
  steam:null
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const oriY = (dx, dz) => Math.atan2(-dz, dx);          // rotation that turns local +x along (dx, dz)
/* hip roof over a w×d box: a 4-sided cone turned 45° and stretched */
function hipRoof(acc, mat, x, y, z, w, d, h){ acc.add(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI/4), mat, at(x, y + h/2, z, 0, w, h, d)); }
/* ── TRACK: straight or quarter-curve between two cell edges (n/s/e/w), rails + sleepers on a ballast bed ── */
const EDGE = { n:[0,-.5], s:[0,.5], w:[-.5,0], e:[.5,0] };
function trackPath(a, b){
  const A = EDGE[a], B = EDGE[b];
  if (A[0] === -B[0] && A[1] === -B[1]) return { len:1, at:t => ({ x:A[0] + (B[0]-A[0])*t, z:A[1] + (B[1]-A[1])*t, dx:B[0]-A[0], dz:B[1]-A[1] }) };
  const C = [A[0] + B[0], A[1] + B[1]], a0 = Math.atan2(A[1]-C[1], A[0]-C[0]), a1 = Math.atan2(B[1]-C[1], B[0]-C[0]);
  let d = a1 - a0; if (d > Math.PI) d -= 2*Math.PI; if (d < -Math.PI) d += 2*Math.PI; const sg = Math.sign(d);
  return { len:Math.PI/4, at:t => { const q = a0 + d*t; return { x:C[0] + .5*Math.cos(q), z:C[1] + .5*Math.sin(q), dx:-Math.sin(q)*sg, dz:Math.cos(q)*sg }; } };
}
const GAUGE = .17;
function layTrack(acc, a, b, y0 = 0, bed = true){
  const P = trackPath(a, b), N = P.len > .9 ? 6 : 8;
  if (bed) for (let i=0;i<N;i++){ const q = P.at((i+.5)/N); acc.add(box(P.len/N + .012, .026, .32), i%2 ? RM.ballast : RM.ballastD, at(q.x, y0 + .013, q.z, oriY(q.dx, q.dz))); }
  const ns = Math.round(P.len/.105);
  for (let i=0;i<ns;i++){ const q = P.at((i+.5)/ns); acc.add(box(.05, .022, .27), RM.sleeper, at(q.x, y0 + .036, q.z, oriY(q.dx, q.dz))); }
  for (const sd of [-1, 1]) for (let i=0;i<N;i++){
    const p0 = P.at(i/N), p1 = P.at((i+1)/N), off = (q) => { const l = Math.hypot(q.dx, q.dz); return [q.x - q.dz/l*sd*GAUGE/2, q.z + q.dx/l*sd*GAUGE/2]; };
    const [x0, z0] = off(p0), [x1, z1] = off(p1), L = Math.hypot(x1-x0, z1-z0) + .004;
    acc.add(box(L, .026, .022), RM.rail, at((x0+x1)/2, y0 + .06, (z0+z1)/2, oriY(x1-x0, z1-z0)));
  }
}

/* The loop, in travel order: [cell x, cell z, entry edge, exit edge]. Ring 1 = the station straight, ring 2 = the curves'
   side legs, ring 3 = the front row with the level crossing. It only closes with the last track piece. */
const LOOP = [[2,4,'w','e'],[3,4,'w','e'],[4,4,'w','s'],[4,5,'n','s'],[4,6,'n','w'],[3,6,'e','w'],[2,6,'e','w'],[1,6,'e','n'],[1,5,'s','n'],[1,4,'s','e']];
const trackId = (x, z) => 'track'+x+'_'+z;
const TRACK_NAME = { '2,4':'Station line', '3,4':'Station line', '4,4':'Curved track', '4,5':'Straight track', '4,6':'Curved track',
  '3,6':'Level crossing', '2,6':'Straight track', '1,6':'Curved track', '1,5':'Straight track', '1,4':'Curved track' };

/* ── BLUEPRINT ── */
const B = (id, name, kind, x, z, extra = {}) => ({ id, cat:'building', gate:'lesson', name, kind, x, z, ...extra });
const Tr = (id, name, model, x, z, rot, extra = {}) => ({ id, cat:'tree', gate:'vocab', name, kind:'tree', model, x, z, rot, ...extra });
export const RAIL = [
  // ── ring 1: the station, the station line, the water tower and a first wheat field ──
  B('station', 'Valley station', 'station', 2, 2, { w:2, d:2 }),
  { id:'watertower', cat:'water', gate:'breathe', name:'Water tower', kind:'watertower', x:4, z:2 },
  ...LOOP.map(([x,z,a,b]) => ({ id:trackId(x,z), cat:'path', gate:'todos', name:TRACK_NAME[x+','+z], kind:'track', a, b, crossing: x===3 && z===6, x, z })),
  // ── ring 2 ──
  B('signalbox', 'Signal box', 'signalbox', 2, 1),
  B('cottage3_1', 'Cottage', 'cottage', 3, 1, { model:'building_home_A_red', rot:200 }),
  B('shed', 'Engine shed', 'shed', 4, 1),
  Tr('oak1_1', 'Oak tree', 'CommonTree_1', 1, 1, 30),
  Tr('oak5_2', 'Oak tree', 'CommonTree_2', 5, 2, 200),
  { id:'hedge5_3', cat:'tree', gate:'vocab', name:'Hedgerow', kind:'hedgerow', x:5, z:3 },
  { id:'bench1_3', cat:'path', gate:'todos', name:'Lamp & bench', kind:'bench', x:1, z:3 },
  { id:'signal5_4', cat:'path', gate:'todos', name:'Signal', kind:'signal', x:5, z:4 },
  { id:'lake', cat:'water', gate:'breathe', name:'Lake', kind:'lake', x:5, z:5 },
  // ── ring 3 ──
  { id:'tunnel', cat:'special', gate:'gita', name:'Mountain tunnel', kind:'tunnel', x:5, z:0, w:2, d:2 },   // right corner: nothing stands in front of it
  { id:'fall6_2', cat:'water', gate:'breathe', name:'Waterfall pool', kind:'river', shape:'pool', x:6, z:2 },
  { id:'river6_3', cat:'water', gate:'breathe', name:'River', kind:'river', shape:'ns', x:6, z:3 },
  { id:'bridge6_4', cat:'water', gate:'breathe', name:'Stone bridge', kind:'river', shape:'ns', bridge:true, x:6, z:4 },
  { id:'river6_5', cat:'water', gate:'breathe', name:'River bend', kind:'river', shape:'nw', x:6, z:5 },
  B('cottage0_2', 'Cottage', 'cottage', 0, 2, { model:'building_home_B_yellow', rot:110 }),
  B('cottage0_5', 'Cottage', 'cottage', 0, 5, { model:'building_home_A_green', rot:100 }),
  B('goods', 'Goods shed', 'goods', 4, 0),
  Tr('pine0_0', 'Pine tree', 'Pine_3', 0, 0, 0),
  Tr('oak2_0', 'Oak tree', 'CommonTree_3', 2, 0, 90),
  Tr('birch6_6', 'Oak tree', 'CommonTree_5', 6, 6, 60),
  { id:'signal5_6', cat:'path', gate:'todos', name:'Distant signal', kind:'signal', x:5, z:6 },
  // Sudoku / Math → wheat fields and orchards that grow in five stages
  ...[[4,3,'wheat'],[2,5,'wheat'],[3,5,'orchard'],[1,2,'orchard'],[0,3,'wheat'],[0,4,'orchard'],[3,0,'wheat']]
    .map(([x,z,k],i) => ({ id:k+x+'_'+z, cat:'crop', gate:i%3===2?'mathtricks':'sudoku', name:k==='wheat'?'Wheat field':'Apple orchard', kind:k, x, z, stages:5 }))
];
export const RAIL_ORDER = ['station','wheat4_3','track2_4','watertower','track3_4','track4_4',
  'track4_5','signalbox','orchard3_5','oak1_1','track1_4','bench1_3','wheat2_5','lake','cottage3_1','signal5_4','orchard1_2','oak5_2','track1_5','shed','hedge5_3',
  'tunnel','fall6_2','track4_6','cottage0_5','river6_3','wheat0_3','track3_6','pine0_0','bridge6_4','goods','orchard0_4','track2_6','river6_5','cottage0_2','signal5_6','oak2_0','wheat3_0','birch6_6','track1_6'];

/* ── pieces ── */
function buildTrack(g, s){
  const acc = new Acc(); layTrack(acc, s.a, s.b);
  if (s.crossing) {       // a farm lane crosses: planked crossing, white-red barriers and a crossbuck
    const lane = new Acc(); lane.add(box(.34, .02, 1), RM.soil, at(0, .01, 0)); const lg = new THREE.Group(); lane.into(lg); lg.userData.ghostHide = true; g.add(lg);
    for (let i=0;i<5;i++) acc.add(box(.06, .016, .3), RM.wood, at(-.12 + i*.06, .062, 0));
    for (const sd of [-1, 1]) { const x = sd*.3, z = sd*.3;
      acc.add(box(.05, .12, .05), RM.stoneD, at(x - sd*.0, .06, z + sd*.14));
      acc.add(box(.03, .03, .3), RM.white, at(x + sd*.0, .13, z + sd*.14 - sd*.15));
      for (let k=0;k<3;k++) acc.add(box(.034, .034, .05), RM.red, at(x, .13, z + sd*.14 - sd*(.04 + k*.1)));
      acc.add(box(.02, .34, .02), RM.white, at(-x, .17, z + sd*.08));
      acc.add(box(.2, .03, .01), RM.white, at(-x, .32, z + sd*.08, 0, 1, 1, 1, 0, .7)); acc.add(box(.2, .03, .01), RM.white, at(-x, .32, z + sd*.08, 0, 1, 1, 1, 0, -.7));
      acc.add(new THREE.SphereGeometry(.022, 8, 6), RM.red, at(-x, .26, z + sd*.08 + sd*.012)); }
  }
  acc.into(g);
}
/* VALLEY STATION (ring-1 hero, 2×2): a stone platform along the station line, a cream hip-roofed station house with a clock,
   a blue canopy on green posts, benches, lamps, flower tubs and milk churns. The track runs past its front (+z) edge. */
function buildStation(g){
  const acc = new Acc(), r = rngFrom(31);
  const yard = new Acc(); yard.add(box(1.94, .04, 1.94), RM.grassMD, at(0, .02, 0)); const yg = new THREE.Group(); yard.into(yg); yg.userData.ghostHide = true; g.add(yg);
  // platform along the front edge
  acc.add(box(1.9, .12, .56), RM.stone, at(0, .06, .66)); acc.add(box(1.9, .012, .05), RM.yellow, at(0, .126, .9));
  for (let i=0;i<9;i++) acc.add(box(.2, .006, .5), i%2 ? RM.stoneD : RM.stone, at(-.84 + i*.21, .124, .64));
  // station house
  const hx = -.12, hz = -.1, W = 1.3, D = .62, H = .5;
  acc.add(box(W + .06, .06, D + .06), RM.stoneD, at(hx, .07, hz));
  acc.add(box(W, H, D), RM.cream, at(hx, .1 + H/2, hz));
  acc.add(box(W + .02, .05, D + .02), RM.creamD, at(hx, .1 + H - .02, hz));
  for (const sx of [-1, 1]) acc.add(box(.06, H, .06), RM.creamD, at(hx + sx*(W/2 - .01), .1 + H/2, hz + D/2 - .01));
  hipRoof(acc, RM.roofR, hx, .1 + H, hz, W + .2, D + .22, .36);
  acc.add(box(.07, .2, .07), RM.brickD, at(hx - .4, .1 + H + .28, hz - .08)); acc.add(box(.07, .2, .07), RM.brickD, at(hx + .38, .1 + H + .26, hz + .06));
  // front: door + windows
  acc.add(box(.16, .28, .02), RM.woodD, at(hx, .24, hz + D/2 + .005));
  [-.44, -.24, .24, .44].forEach(x => { acc.add(box(.13, .17, .02), RM.win, at(hx + x, .34, hz + D/2 + .006)); acc.add(box(.15, .02, .03), RM.white, at(hx + x, .25, hz + D/2 + .01)); });
  [-.15, .15].forEach(z => acc.add(box(.02, .17, .12), RM.win, at(hx + W/2 + .006, .34, hz + z)));
  // gable dormer with the clock facing the platform
  acc.add(box(.36, .26, .1), RM.cream, at(hx, .1 + H + .1, hz + D/2 + .02)); hipRoof(acc, RM.roofRD, hx, .1 + H + .22, hz + D/2 + .02, .44, .18, .14);
  acc.add(new THREE.CylinderGeometry(.09, .09, .02, 22).rotateX(Math.PI/2), RM.face, at(hx, .1 + H + .1, hz + D/2 + .075));
  acc.add(new THREE.TorusGeometry(.09, .012, 6, 22), RM.gold, at(hx, .1 + H + .1, hz + D/2 + .08));
  acc.add(box(.012, .06, .01), RM.ink, at(hx, .1 + H + .12, hz + D/2 + .09)); acc.add(box(.05, .01, .01), RM.ink, at(hx + .02, .1 + H + .1, hz + D/2 + .09));
  // canopy over the platform: blue roof on green posts with a valance
  const cy = .56; acc.add(box(1.7, .035, .44), RM.roof, at(0, cy, .6, 0, 1, 1, 1, .12)); acc.add(box(1.72, .05, .015), RM.roofD, at(0, cy - .04, .83));
  for (let i=0;i<14;i++) acc.add(box(.1, .03, .012), RM.white, at(-.8 + i*.123, cy - .075, .835));
  [-.75, -.25, .25, .75].forEach(x => { acc.add(new THREE.CylinderGeometry(.018, .022, cy - .12, 8), RM.green, at(x, .12 + (cy - .12)/2, .76)); acc.add(box(.1, .02, .02), RM.green, at(x, cy - .04, .74)); });
  // station name board
  acc.add(box(.5, .1, .02), RM.roof, at(.62, .36, .36)); acc.add(box(.44, .06, .022), RM.white, at(.62, .36, .362));
  [.42, .82].forEach(x => acc.add(box(.02, .3, .02), RM.green, at(x, .27, .36)));
  // benches + churns + tubs + lamps
  const bench = (x, z) => { acc.add(box(.3, .025, .08), RM.wood, at(x, .2, z)); acc.add(box(.3, .08, .02), RM.wood, at(x, .25, z - .04)); [-.12, .12].forEach(dx => acc.add(box(.02, .08, .07), RM.ink, at(x + dx, .16, z))); };
  bench(-.55, .5); bench(.12, .5);
  [[.9, .52],[.84, .44]].forEach(([x,z]) => { acc.add(new THREE.CylinderGeometry(.035, .04, .1, 10), RM.metal, at(x, .17, z)); acc.add(new THREE.CylinderGeometry(.02, .03, .03, 10), RM.metal, at(x, .235, z)); });
  acc.into(g);
  [[-.9,.46],[.62,.62]].forEach(([x,z],i) => { const t = new THREE.Group(); t.position.set(x, .12, z); g.add(t);
    const a2 = new Acc(); a2.add(new THREE.CylinderGeometry(.07, .055, .08, 10), RM.woodD, at(0, .04, 0)); a2.into(t);
    addModel(t, i ? 'Flower_3_Group' : 'Flower_4_Group', .18, 0, .06, 0, i, 'a'); });
  addModel(g, 'Bush_Common_Flowers', .32, .78, .04, -.72, 0, 'a'); addModel(g, 'Bush_Common', .28, -.86, .04, -.74, 1, 'a');
}
/* SIGNAL BOX: brick base, a glazed wooden upper floor, hip roof, stair on the side */
function buildSignalBox(g){
  const acc = new Acc();
  acc.add(box(.62, .3, .5), RM.brick, at(0, .15, 0)); acc.add(box(.66, .04, .54), RM.stoneD, at(0, .31, 0));
  acc.add(box(.62, .3, .5), RM.cream, at(0, .48, 0));
  for (let i=0;i<4;i++) acc.add(box(.12, .16, .02), RM.win, at(-.21 + i*.14, .5, .255));
  [-.12, .1].forEach(z => acc.add(box(.02, .16, .14), RM.win, at(.315, .5, z)));
  acc.add(box(.66, .03, .54), RM.green, at(0, .64, 0)); hipRoof(acc, RM.roofR, 0, .65, 0, .8, .66, .26);
  acc.add(box(.5, .02, .02), RM.white, at(0, .72, .26)); acc.add(box(.3, .06, .015), RM.white, at(0, .38, .258));
  for (let i=0;i<5;i++) acc.add(box(.12, .02, .07), RM.woodD, at(-.38 + 0, .06 + i*.06, .15 - i*.06));
  acc.add(box(.02, .34, .02), RM.woodD, at(-.44, .2, .02));
  [-.2, .0, .2].forEach(x => acc.add(box(.02, .12, .02), RM.metal, at(x, .06, .3)));      // lever rods
  acc.into(g);
}
/* ENGINE SHED: long brick shed with an arched door, a track into it and a tender of coal outside */
function buildShed(g){
  const acc = new Acc();
  layTrack(acc, 'n', 's');
  acc.add(box(.8, .44, .6), RM.brick, at(0, .22, -.14)); acc.add(box(.84, .04, .64), RM.brickD, at(0, .44, -.14));
  const s = new THREE.Shape(); s.moveTo(-.44, 0); s.lineTo(.44, 0); s.lineTo(0, .22); s.lineTo(-.44, 0);
  acc.add(new THREE.ExtrudeGeometry(s, { depth:.66, bevelEnabled:false }).translate(0, 0, -.33).rotateY(0), RM.roof, at(0, .46, -.14));
  acc.add(box(.2, .1, .5), RM.creamD, at(0, .62, -.14)); hipRoof(acc, RM.roofD, 0, .67, -.14, .26, .56, .07);
  acc.add(box(.3, .3, .02), RM.dark, at(0, .15, .165)); acc.add(new THREE.CylinderGeometry(.15, .15, .02, 16, 1, false, -Math.PI/2, Math.PI).rotateX(Math.PI/2), RM.dark, at(0, .3, .165));
  acc.add(new THREE.TorusGeometry(.17, .02, 6, 16, Math.PI), RM.cream, at(0, .3, .17));
  [-.3, .3].forEach(x => acc.add(box(.1, .14, .02), RM.win, at(x, .3, .166)));
  acc.add(box(.06, .22, .06), RM.brickD, at(.28, .62, -.3));
  acc.into(g);
}
/* GOODS SHED: a timber shed on a loading dock, crates and sacks, a lumber wagon on its siding */
function buildGoods(g){
  const acc = new Acc();
  layTrack(acc, 'w', 'e', 0);
  acc.add(box(.9, .12, .32), RM.stoneD, at(0, .06, -.2));
  acc.add(box(.72, .34, .3), RM.wood, at(-.04, .29, -.24)); acc.add(box(.76, .03, .02), RM.woodD, at(-.04, .3, -.085));
  for (let i=0;i<7;i++) acc.add(box(.012, .34, .012), RM.woodD, at(-.38 + i*.11, .29, -.088));
  acc.add(box(.22, .24, .02), RM.woodD, at(.05, .24, -.085)); acc.add(box(.02, .24, .026), RM.white, at(.05, .24, -.084, 0, 1, 1, 1, 0, .8));
  const s = new THREE.Shape(); s.moveTo(-.2, 0); s.lineTo(.2, 0); s.lineTo(0, .16); s.lineTo(-.2, 0);
  acc.add(new THREE.ExtrudeGeometry(s, { depth:.84, bevelEnabled:false }).translate(0, 0, -.42).rotateY(Math.PI/2), RM.roofR, at(-.04, .46, -.24));
  acc.into(g);
  fit(g, VK, 'crate_A_big', .13, .14, .32, .12, -.08, .3); fit(g, VK, 'crate_A_small', .09, .1, .38, .12, -.26, .9); fit(g, VK, 'sack', .1, .1, -.42, .12, -.1, 0);
  const w = tpl(RK, 'carriage-lumber'); if (w) addModel(g, 'carriage-lumber', TRAIN_K, -.08, .035, 0, Math.PI/2, RK);
}
/* WATER TOWER: the farm kit's tower on a brick plinth with a swinging spout toward the station line */
function buildWaterTower(g){
  const acc = new Acc(); acc.add(box(.5, .06, .5), RM.stoneD, at(0, .03, 0)); acc.into(g);
  const t = tpl('farm', 'WaterTower'); if (t) addModel(g, 'WaterTower', fitScale(t, 1.2, .78), 0, .05, 0, .3, 'farm');
  const a2 = new Acc(); a2.add(new THREE.CylinderGeometry(.025, .025, .34, 8).rotateX(Math.PI/2), RM.ink, at(-.14, .78, .28, 0, 1, 1, 1, -.35)); a2.into(g);
}
/* LAMP & BENCH: a green gas lamp, a slatted bench, milk churns and a flower tub */
function buildBench(g){
  const acc = new Acc();
  acc.add(box(.62, .02, .5), RM.stoneD, at(0, .01, .02));
  acc.add(new THREE.CylinderGeometry(.04, .05, .05, 10), RM.green, at(-.22, .035, -.14)); acc.add(new THREE.CylinderGeometry(.016, .02, .56, 8), RM.green, at(-.22, .32, -.14));
  acc.add(box(.1, .12, .1), RM.lamp, at(-.22, .64, -.14)); hipRoof(acc, RM.green, -.22, .7, -.14, .14, .14, .07); acc.add(box(.12, .015, .12), RM.green, at(-.22, .58, -.14));
  acc.add(box(.34, .025, .1), RM.wood, at(.08, .15, -.12)); acc.add(box(.34, .09, .02), RM.wood, at(.08, .21, -.17));
  [-.07, .23].forEach(x => acc.add(box(.02, .12, .1), RM.ink, at(x, .08, -.12)));
  [[.26, .14],[.14, .2]].forEach(([x,z]) => { acc.add(new THREE.CylinderGeometry(.04, .045, .11, 10), RM.metal, at(x, .065, z)); acc.add(new THREE.CylinderGeometry(.022, .034, .03, 10), RM.metal, at(x, .135, z)); });
  acc.into(g);
  addModel(g, 'Flower_4_Group', .2, -.24, .02, .2, 0, 'a');
}
/* SEMAPHORE SIGNAL: a white post with a ladder, the red arm raised, a lamp, and a relay cabinet */
function buildSignal(g, s){
  const acc = new Acc(), faceX = -1;         // arm reaches toward the track on the -x side
  acc.add(box(.14, .06, .14), RM.stoneD, at(0, .03, 0));
  acc.add(box(.045, .95, .045), RM.white, at(0, .5, 0)); acc.add(new THREE.ConeGeometry(.04, .08, 4), RM.ink, at(0, 1.01, 0, Math.PI/4));
  for (let i=0;i<8;i++) acc.add(box(.06, .01, .01), RM.ink, at(0, .1 + i*.1, .05));
  [-.028, .028].forEach(x => acc.add(box(.008, .82, .008), RM.ink, at(x, .47, .05)));
  acc.add(box(.3, .05, .015), RM.red, at(faceX*.15, .86, .03, 0, 1, 1, 1, 0, .5)); acc.add(box(.04, .052, .017), RM.white, at(faceX*.23, .9, .03, 0, 1, 1, 1, 0, .5));
  acc.add(box(.07, .07, .03), RM.ink, at(.02, .8, .03)); acc.add(new THREE.SphereGeometry(.018, 8, 6), RM.lamp, at(.02, .8, .05));
  acc.add(box(.12, .16, .1), RM.greenL, at(.24, .08, .22));
  acc.into(g);
  addModel(g, 'Bush_Common', .2, .28, 0, -.26, s.x, 'a'); addModel(g, 'Grass_Wispy_Tall', .16, -.3, 0, .3, 1, 'a');
}
/* COTTAGE: a village-kit house in a small garden with a picket and flowers */
function buildCottage(g, s){
  const m = fit(g, VK, s.model, 1.1, .82, 0, 0, 0, (s.rot||0)*Math.PI/180);
  addModel(g, 'Flower_3_Group', .16, .36, 0, .36, 1, 'a');
}
/* HEDGEROW: a clipped hawthorn hedge with blossom and a hedgerow oak */
function buildHedgerow(g, s){
  const acc = new Acc(), r = rngFrom(s.x*5 + s.z*11 + 3);
  for (let p=0;p<6;p++){ const t = -.42 + p*.17, h = .22 + r()*.06;
    acc.add(new THREE.IcosahedronGeometry(.12, 1), p%2 ? RM.hedge : RM.hedgeD, at(t, h*.55, .22, r()*3, 1.1, h/.2, .9));
    if (p%2) acc.add(new THREE.SphereGeometry(.022, 6, 5), p%4 === 1 ? RM.bloomW : RM.bloomP, at(t + .03, h*.9, .3)); }
  acc.into(g);
  const t = tpl('a', 'CommonTree_3'); if (t) addModel(g, 'CommonTree_3', fitScale(t, 1.05, .7), .05, 0, -.18, 1.3, 'a');
}
/* ── RIVER: grassy banks, water, rocks, reeds; pool (under the waterfall, flows south), ns, nw bend, and the stone bridge ── */
function buildRiver(g, s){
  const acc = new Acc(), r = rngFrom(s.x*17 + s.z*5 + 1), wy = .03, WID = .46;
  const bank = new Acc(); bank.add(box(.98, .03, .98), RM.bankD, at(0, .015, 0)); const bg = new THREE.Group(); bank.into(bg); bg.userData.ghostHide = true; g.add(bg);
  const rocks = (pts) => pts.forEach(([x, z]) => acc.add(new THREE.DodecahedronGeometry(.045 + r()*.035, 0), r() < .5 ? RM.rock : RM.rockL, at(x, .05, z, r()*3, 1, .6, 1)));
  if (s.shape === 'ns') {
    acc.add(box(WID, .02, 1), RM.water, at(0, wy + .01, 0));
    for (let i=0;i<5;i++) rocks([[-WID/2 - .02, -.42 + i*.21 + (r()-.5)*.06], [WID/2 + .02, -.4 + i*.2 + (r()-.5)*.06]]);
    acc.add(box(.1, .012, .04), RM.foam, at(.05, wy + .025, -.1)); acc.add(box(.07, .012, .03), RM.foam, at(-.08, wy + .025, .22));
  } else if (s.shape === 'nw') {       // bend from the north edge round to the west edge
    acc.add(new THREE.RingGeometry(.5 - WID/2, .5 + WID/2, 18, 1, 0, Math.PI/2).rotateX(-Math.PI/2).rotateY(Math.PI), RM.water, at(-.5, wy + .02, -.5, 0, 1, 1, 1));
    for (let i=0;i<=6;i++){ const q = i/6*Math.PI/2; rocks([[-.5 + Math.cos(q)*(.5 + WID/2 + .03), -.5 + Math.sin(q)*(.5 + WID/2 + .03)]]); if (i%2) rocks([[-.5 + Math.cos(q)*(.5 - WID/2 - .02), -.5 + Math.sin(q)*(.5 - WID/2 - .02)]]); }
  } else {                              // pool under the fall, out through the south edge
    acc.add(new THREE.CylinderGeometry(.4, .4, .02, 24), RM.water, at(0, wy + .01, -.08, 0, 1.1, 1, 1));
    acc.add(box(WID, .02, .5), RM.water, at(0, wy + .01, .25));
    for (let i=0;i<14;i++){ const q = i/14*Math.PI*2; if (q > 1.1 && q < 2.05) continue; rocks([[Math.cos(q)*.47, -.08 + Math.sin(q)*.44]]); }
    for (let i=0;i<6;i++) acc.add(new THREE.SphereGeometry(.035 + r()*.03, 7, 5), RM.foam, at((r()-.5)*.3, wy + .03, -.4 + r()*.12));
  }
  // reeds + cattails
  for (let i=0;i<3;i++){ const x = (s.shape === 'nw' ? .3 : .38) * (i%2 ? 1 : -1), z = -.3 + i*.3;
    for (let k=0;k<3;k++) acc.add(box(.014, .16 + r()*.06, .014), RM.reed, at(x + (k-1)*.025, .1, z + (r()-.5)*.03, 0, 1, 1, 1, (r()-.5)*.3, (r()-.5)*.3));
    acc.add(new THREE.CylinderGeometry(.013, .013, .05, 6), RM.cattail, at(x, .2, z)); }
  if (s.bridge) {          // a humped stone bridge carrying the footpath east–west
    const arch = new THREE.Shape(); arch.moveTo(-.44, 0); arch.lineTo(-.28, .12); arch.quadraticCurveTo(0, .22, .28, .12); arch.lineTo(.44, 0); arch.lineTo(.3, 0);
    arch.quadraticCurveTo(0, .16, -.3, 0); arch.lineTo(-.44, 0);
    const ex = new THREE.ExtrudeGeometry(arch, { depth:.26, bevelEnabled:false }).translate(0, 0, -.13);
    acc.add(ex, RM.stone, at(0, .03, 0));
    [-.14, .14].forEach(z => { const pw = new THREE.Shape(); pw.moveTo(-.44, 0); pw.lineTo(-.28, .12); pw.quadraticCurveTo(0, .22, .28, .12); pw.lineTo(.44, 0); pw.lineTo(.44, .06);
      pw.lineTo(.28, .18); pw.quadraticCurveTo(0, .28, -.28, .18); pw.lineTo(-.44, .06);
      acc.add(new THREE.ExtrudeGeometry(pw, { depth:.03, bevelEnabled:false }).translate(0, 0, -.015), RM.stoneD, at(0, .03, z)); });
  }
  acc.into(g);
}
/* LAKE: a round lake fed from the east by the river, lilies, a jetty and a little red rowing boat */
function buildLake(g){
  const acc = new Acc(), r = rngFrom(55);
  const bank = new Acc(); bank.add(box(.98, .03, .98), RM.bankD, at(0, .015, 0)); const bg = new THREE.Group(); bank.into(bg); bg.userData.ghostHide = true; g.add(bg);
  acc.add(new THREE.CylinderGeometry(.42, .42, .02, 28), RM.water, at(-.02, .04, 0, 0, 1, 1, .98)); acc.add(box(.2, .02, .46), RM.water, at(.4, .04, 0));
  for (let i=0;i<18;i++){ const a = i/18*Math.PI*2; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < .5) continue;
    acc.add(new THREE.DodecahedronGeometry(.05 + r()*.03, 0), i%3 ? RM.rockL : RM.rock, at(-.02 + Math.cos(a)*.45, .05, Math.sin(a)*.44, r()*3, 1, .55, 1)); }
  [[-.18,.16],[-.05,-.22],[.12,.2]].forEach(([x,z],i) => { acc.add(new THREE.CylinderGeometry(.05, .05, .01, 12), RM.bank, at(x, .055, z)); if (!i) acc.add(new THREE.SphereGeometry(.02, 8, 6), RM.bloomP, at(x, .065, z)); });
  acc.add(box(.3, .02, .1), RM.wood, at(-.25, .07, -.12, .4)); [-.36, -.14].forEach(x => acc.add(box(.02, .08, .02), RM.woodD, at(x, .04, -.12 + (x+.25)*-.4)));
  const bt = new THREE.Shape(); bt.moveTo(-.12, 0); bt.quadraticCurveTo(0, -.05, .12, 0); bt.lineTo(.1, .05); bt.lineTo(-.1, .05); bt.lineTo(-.12, 0);
  acc.add(new THREE.ExtrudeGeometry(bt, { depth:.08, bevelEnabled:false }).translate(0, 0, -.04), RM.red, at(.05, .06, -.02, .5));
  acc.add(box(.14, .01, .06), RM.wood, at(.05, .1, -.02, .5));
  acc.into(g);
  addModel(g, 'Grass_Wispy_Tall', .16, -.38, .03, .34, .3, 'a');
}
/* ── growing pieces ── */
function fillWheat(plants, s, stage){
  plants.clear(); const st = Math.min(5, stage), r = rngFrom(s.x*31 + s.z*7 + 9), acc = new Acc();
  const H = [0, .05, .11, .18, .24, .26][st], mat = [null, RM.sprout, RM.wheatG, RM.wheatY, RM.wheat, RM.wheat][st];
  for (let row=0; row<6; row++) for (let i=0;i<6;i++){
    const x = -.34 + i*.136 + (r()-.5)*.03, z = -.34 + row*.136 + (r()-.5)*.03, h = H*(.85 + r()*.3);
    acc.add(new THREE.ConeGeometry(.05, h, 5), mat, at(x, .07 + h/2, z, r()*3));
    if (st >= 4) acc.add(new THREE.SphereGeometry(.028, 6, 5), st === 5 ? RM.wheatD : RM.wheatY, at(x, .07 + h + .01, z, 0, 1, 1.6, 1));
  }
  if (st >= 5) { [[-.27,.37],[.29,.36]].forEach(([x,z]) => { acc.add(new THREE.CylinderGeometry(.05, .07, .16, 8), RM.wheatD, at(x, .15, z));
    acc.add(new THREE.ConeGeometry(.06, .08, 8), RM.wheat, at(x, .27, z)); acc.add(new THREE.CylinderGeometry(.062, .062, .02, 8), RM.woodD, at(x, .16, z)); }); }
  acc.into(plants); plants.userData.stage = stage;
}
function buildWheat(g, s, stage){
  const bed = new Acc(); bed.add(box(.92, .06, .92), RM.soil, at(0, .03, 0));
  for (let i=0;i<6;i++) bed.add(box(.9, .012, .05), RM.soilD, at(0, .062, -.34 + i*.136));
  const bg = new THREE.Group(); bed.into(bg); bg.userData.ghostHide = true; g.add(bg);
  const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillWheat(plants, s, st);
  fillWheat(plants, s, stage);
}
const ORCH = [null, ['Apple_1', .2], ['Apple_1', .3], ['Apple_2', .42], ['Apple_4', .52], ['Apple_4', .56]];
function fillOrchard(plants, s, stage){
  plants.clear(); const st = Math.min(5, stage), r = rngFrom(s.x*13 + s.z*3 + 2), [nm, h] = ORCH[st], t = tpl('farm', nm);
  [[-.22,-.22],[.22,-.22],[-.22,.22],[.22,.22]].forEach(([x,z]) => { if (t) addModel(plants, nm, fitScale(t, h*(.9 + r()*.2), .5), x, .03, z, r()*6.28, 'farm'); });
  if (st >= 5) { const acc = new Acc(); acc.add(box(.11, .06, .08), RM.wood, at(0, .06, .02)); acc.into(plants);
    const c = tpl('farm', 'Apple_Crop'); if (c) for (let i=0;i<3;i++) addModel(plants, 'Apple_Crop', fitScale(c, .05, .05), -.03 + i*.03, .09, .02, i, 'farm'); }
  plants.userData.stage = stage;
}
function buildOrchard(g, s, stage){
  const bed = new Acc(); bed.add(box(.92, .03, .92), RM.grassM, at(0, .015, 0));
  [[-.22,-.22],[.22,-.22],[-.22,.22],[.22,.22]].forEach(([x,z]) => bed.add(new THREE.CylinderGeometry(.1, .1, .012, 12), RM.mulch, at(x, .034, z)));
  const bg = new THREE.Group(); bed.into(bg); bg.userData.ghostHide = true; g.add(bg);
  const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillOrchard(plants, s, st);
  fillOrchard(plants, s, stage);
}
/* MOUNTAIN TUNNEL (Gita, 2×2 in the right corner): a snow-capped crag with pines, a waterfall pouring into the river's pool
   below, and a stone viaduct carrying a line out of a tunnel portal — a little blue engine just nosing out. */
function buildTunnel(g){
  const acc = new Acc(), r = rngFrom(707);
  const base = new Acc(); base.add(box(1.96, .04, 1.96), RM.grassMD, at(0, .02, 0)); const bg = new THREE.Group(); base.into(bg); bg.userData.ghostHide = true; g.add(bg);
  const crag = (x, y, z, rad, sy, mat) => { const geo = new THREE.IcosahedronGeometry(rad, 1), a = geo.attributes.position;
    for (let i=0;i<a.count;i++){ const k = 1 + (Math.sin(a.getX(i)*9 + a.getZ(i)*7)*.5 + .5)*.18 - .09; a.setXYZ(i, a.getX(i)*k, a.getY(i)*k, a.getZ(i)*k); }
    acc.add(geo, mat, at(x, y, z, r()*3, 1, sy, 1)); };
  /* a low-poly peak: rock cone + a snow cone sharing its apex (same slope, so the cap sits flush) */
  const peak = (x, z, R, H, seg, rot, mat, snowH) => {
    acc.add(new THREE.ConeGeometry(R, H, seg, 1), mat, at(x, H/2, z, rot));
    const k = snowH/H; acc.add(new THREE.ConeGeometry(R*k*1.06, snowH*1.02, seg, 1), RM.snow, at(x, H - snowH/2 + .005, z, rot)); };
  crag(.05, .02, -.3, .95, .32, RM.grassM);                 // green foothills
  crag(-.7, .02, .05, .38, .45, RM.grassMD);
  peak(.12, -.38, .78, 2.05, 7, .3, RM.rock, .62);          // main peak
  peak(-.5, -.62, .46, 1.35, 6, 1.1, RM.rockL, .36);        // second peak
  peak(.62, -.12, .42, 1.05, 6, .7, RM.rockL, .0001);       // right buttress: the fall comes off it
  crag(-.22, .35, -.05, .3, .9, RM.rock);
  // tunnel portal (faces +z) at x -.42, the viaduct runs out to the front edge
  const px = -.42, pz = .12, deck = .4;
  acc.add(box(.42, .5, .12), RM.stoneD, at(px, .27, pz)); acc.add(box(.46, .05, .14), RM.stoneDD, at(px, .54, pz));
  acc.add(box(.24, .2, .02), RM.dark, at(px, deck + .1, pz + .062)); acc.add(new THREE.CylinderGeometry(.12, .12, .02, 14, 1, false, -Math.PI/2, Math.PI).rotateX(Math.PI/2), RM.dark, at(px, deck + .2, pz + .062));
  acc.add(new THREE.TorusGeometry(.14, .025, 6, 14, Math.PI), RM.stone, at(px, deck + .2, pz + .066));
  // viaduct: deck + two arched piers from the portal to the front edge
  acc.add(box(.3, .06, .9), RM.stone, at(px, deck - .03, .56)); acc.add(box(.32, .025, .92), RM.stoneD, at(px, deck + .005, .56));
  [.4, .78].forEach(z => { acc.add(box(.26, deck - .06, .08), RM.stoneD, at(px, (deck - .06)/2, z)); });
  const archWall = new THREE.Shape(); archWall.moveTo(-.1, 0); archWall.lineTo(1.0, 0); archWall.lineTo(1.0, .38);
  // arches cut from the side wall: two semicircular openings
  archWall.lineTo(-.1, .38); archWall.lineTo(-.1, 0);
  const holes = [[.2, .13], [.59, .13]].map(([c, rad]) => { const h = new THREE.Path(); h.moveTo(c - rad, -.001); h.lineTo(c + rad, -.001); h.lineTo(c + rad, .16); h.absarc(c, .16, rad, 0, Math.PI, false); h.lineTo(c - rad, -.001); return h; });
  archWall.holes.push(...holes);
  const wallGeo = new THREE.ExtrudeGeometry(archWall, { depth:.22, bevelEnabled:false }).translate(0, 0, -.11).rotateY(-Math.PI/2);
  acc.add(wallGeo, RM.stone, at(px, 0, .02 + .0));
  const deckG = new Acc(); layTrack(deckG, 'n', 's', deck); const tg = new THREE.Group(); deckG.into(tg); tg.scale.set(.9, 1, .86); tg.position.set(px, 0, .58); g.add(tg);
  // waterfall off the right buttress into the pool at the front-right (continues in the river pool cell)
  const fx = .5;
  acc.add(box(.22, .86, .06), RM.water, at(fx, .47, .3, 0, 1, 1, 1, -.1)); acc.add(box(.28, .06, .16), RM.rock, at(fx, .92, .22));
  for (let i=0;i<4;i++) acc.add(box(.022, .7 - (i%2)*.2, .012), RM.foam, at(fx - .075 + i*.05, .5 - (i%2)*.1, .335, 0, 1, 1, 1, -.1));
  acc.add(new THREE.CylinderGeometry(.3, .3, .02, 20), RM.water, at(fx, .05, .74, 0, 1, 1, .8)); acc.add(box(.44, .02, .3), RM.water, at(fx, .05, .86));
  for (let i=0;i<7;i++) acc.add(new THREE.SphereGeometry(.035 + r()*.03, 7, 5), RM.foam, at(fx + (r()-.5)*.3, .07, .6 + r()*.1));
  [[.2,.62],[.8,.6],[.24,.9],[.82,.9]].forEach(([x,z]) => acc.add(new THREE.DodecahedronGeometry(.06 + r()*.03, 0), RM.rock, at(x, .06, z, r()*3, 1, .6, 1)));
  acc.into(g);
  [[-.85,.04,-.3,.34],[-.9,.04,.45,.3],[.88,.04,-.8,.3],[.2,.2,.1,.24],[-.05,.04,-.95,.28],[.92,.04,.3,.26]].forEach(([x,y,z,h],i) => {
    const t = tpl('a', i%2 ? 'Pine_1' : 'Pine_3'); if (t) addModel(g, i%2 ? 'Pine_1' : 'Pine_3', fitScale(t, h*1.4, .4), x, y, z, i, 'a'); });
  const e = tpl(RK, 'locomotive-c'); if (e) addModel(g, 'locomotive-c', TRAIN_K*.9, px, deck + .03, .38, LOCO_FWD, RK);
}

/* ── THE LINE IN MOTION ── */
const LOCO_FWD = 0;        // Kenney engines face +z
const cellLen = c => trackPath(c[2], c[3]).len;
function chainAt(chain, s){          // point on a chain of loop cells at arc length s
  for (const c of chain){ const P = trackPath(c[2], c[3]); if (s <= P.len || c === chain[chain.length-1]) { const q = P.at(Math.max(0, Math.min(1, s/P.len))), o = cellPos(c[0], c[1]);
      return { x:o.x + q.x, z:o.z + q.z, h:Math.atan2(q.dx, q.dz) }; } s -= P.len; }
}
const LOOP_LEN = LOOP.reduce((a, c) => a + cellLen(c), 0);
/* longest run of placed track in loop order (cyclic): the shuttle's line */
function connectedChain(){
  const on = LOOP.map(c => placed.includes(trackId(c[0], c[1])));
  if (on.every(Boolean)) return { loop:true, chain:LOOP };
  let best = [], start = on.findIndex(v => !v);
  if (start < 0) start = 0;
  let cur = [];
  for (let k=1; k<=LOOP.length; k++){ const i = (start + k) % LOOP.length; if (on[i]) { cur.push(LOOP[i]); if (cur.length > best.length) best = cur.slice(); } else cur = []; }
  return { loop:false, chain:best };
}
const complete = () => placed.length === RAIL.length;
function makeTrain(parts){
  const g = new THREE.Group(); g.userData.cars = parts.map(n => { const c = new THREE.Group(); if (tpl(RK, n)) addModel(c, n, TRAIN_K, 0, 0, 0, LOCO_FWD, RK); g.add(c); return c; });
  const puffs = []; for (let i=0;i<8;i++){ const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.07, 1), new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:1, transparent:true, opacity:.9, emissive:0xE8EDF2, emissiveIntensity:.55, depthWrite:false, flatShading:true }));
    m.castShadow = false; g.add(m); puffs.push(m); }
  g.userData.puffs = puffs; return g;
}
const CAR_GAP = .56, TRAIN_Y = .038, BOGIE = .16;
/* place a train at arc length s along a path fn; puffs trail from the chimney at earlier positions */
function poseTrain(tr, pathAt, s, back = false, sAt = null){
  // each car rides on two bogies (±BOGIE along the track) and sits on the chord between them, so on curves the body cuts inside
  // the bend instead of swinging its ends out over the ballast
  tr.userData.cars.forEach((c, i) => { const sc = s - i*CAR_GAP, a = pathAt(sc + BOGIE), b = pathAt(sc - BOGIE), dx = a.x - b.x, dz = a.z - b.z;
    const h = dx*dx + dz*dz > 1e-6 ? Math.atan2(dx, dz) : pathAt(sc).h;
    c.position.set((a.x + b.x)/2, TILE_TOP + TRAIN_Y, (a.z + b.z)/2); c.rotation.y = h + (back ? Math.PI : 0); });
  const n = tr.userData.puffs.length;
  tr.userData.puffs.forEach((p, i) => { const ph = ((tr.userData.t || 0)*1.25 + i/n) % 1, s0 = sAt ? sAt(ph) : s, q = pathAt(s0), f = back ? -1 : 1;
    p.position.set(q.x + Math.sin(q.h)*.17*f, TILE_TOP + .36 + ph*.5, q.z + Math.cos(q.h)*.17*f);
    p.scale.setScalar(.7 + ph*1.9); p.material.opacity = .92*(1 - ph*ph)*(ph < .08 ? ph/.08 : 1); p.visible = !S.night || true; });
}
function addLife(){
  V.rail = { shuttle:null, train:null, key:'' };
  if (!complete()) { const sh = makeTrain(['locomotive-a']); world.add(sh); V.life.push(sh); V.rail.shuttle = sh; }
  moveLife(2.1);
}
function ensureTrain(){
  if (V.rail.train) return V.rail.train;
  if (V.rail.shuttle) { world.remove(V.rail.shuttle); V.life = V.life.filter(o => o !== V.rail.shuttle); V.rail.shuttle = null; }
  const tr = makeTrain(['locomotive-b', 'locomotive-passenger-a', 'locomotive-passenger-b', 'locomotive-passenger-a']);
  world.add(tr); V.life.push(tr); V.rail.train = tr; return tr;
}
const loopAt = s => chainAt(LOOP, ((s % LOOP_LEN) + LOOP_LEN) % LOOP_LEN);
const TRAIN_S0 = 6.05, TRAIN_V = .42;          // at the frozen board time the train stands on the front row
function moveLife(t){
  const R = V && V.rail; if (!R) return;
  if (R.train) { R.train.userData.t = t; const s = TRAIN_S0 + (t - 2.1)*TRAIN_V; poseTrain(R.train, loopAt, s, false, ph => s - ph*.9); }
  const sh = R.shuttle; if (!sh) return;
  const { loop, chain } = connectedChain(), show = chain.length > 0;
  sh.children.forEach(c => c.visible = show); if (!show) return;
  sh.userData.t = t;
  if (loop) { const s = 1.5 + (t - 2.1)*.36; poseTrain(sh, loopAt, s, false, ph => s - ph*.8); return; }
  const L = chain.reduce((a, c) => a + cellLen(c), 0), m = .22, span = Math.max(0, L - 2*m);
  const u = ((t - 2.1)*.3 + span*.55) % (2*span || 1), fwd = u < span, s = m + (fwd ? u : 2*span - u);
  const pAt = x => chainAt(chain, Math.max(0, Math.min(L, x)));
  poseTrain(sh, pAt, s, !fwd, ph => s + (fwd ? -1 : 1)*ph*.6);
}

/* ── residents: the passenger train pulls in, then sheep and cows wander in from the lane ── */
const ANIMALS = [
  { id:'Sheep', name:'Sheep', h:.3, at:[0.15, 5.95], face:2.3, file:'assets/farm/Sheep.glb', walk:'Jump' },
  { id:'Sheep', name:'Sheep', h:.27, at:[0.5, 6.35], face:.8, file:'assets/farm/Sheep.glb', walk:'Jump', twin:true },
  { id:'Cow', name:'Cow', h:.4, at:[0.2, 1.05], face:1.1 },
  { id:'Cow', name:'Cow', h:.36, at:[1.15, 0.15], face:2.6, twin:true }
];
async function spawnRes(d){
  const gltf = await loadAnimal(d), obj = SkeletonUtils.clone(gltf.scene);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.metalness = 0; o.material.roughness = .85; } });
  const bx = modelBox(obj), s = d.h / (bx.max.y - bx.min.y); obj.scale.setScalar(s); obj.userData.y0 = TILE_TOP - bx.min.y*s; world.add(obj);
  const mixer = new THREE.AnimationMixer(obj), clips = {}; gltf.animations.forEach(c => clips[c.name.replace(/^.*\|/, '')] = c);
  const a = { def:d, obj, mixer, clips, cur:null }; V.animals.push(a); return a;
}
function playClip(a, name){ const c = a.clips[name] || a.clips.Idle || Object.values(a.clips)[0]; if (!c) return; const act = a.mixer.clipAction(c);
  if (a.cur === act) return; act.reset().play(); if (a.cur) a.cur.crossFadeTo(act, .3, false); a.cur = act; }
async function railMoveIn(walk){
  V.residentsIn = true;
  const tr = ensureTrain(); moveLife(2.1);
  ANIMALS.forEach(d => V.framePts.push(cellPos(d.at[0], d.at[1]).setY(TILE_TOP + d.h)));
  if (walk) { tr.scale.setScalar(.001); await new Promise(res => tween(S.rm ? 1 : 700, t => tr.scale.setScalar(Math.max(.001, 1 - Math.pow(1-t, 3))), () => { tr.scale.setScalar(1);
      sparkle(new THREE.Vector3(tr.userData.cars[0].position.x, TILE_TOP + .4, tr.userData.cars[0].position.z), 14, 0xFFF0B0, .6); res(); })); }
  V.arrived = 1; hooks.renderChrome();
  for (let i=0;i<ANIMALS.length;i++){
    const d = ANIMALS[i], a = await spawnRes(d), to = cellPos(d.at[0], d.at[1]);
    if (!walk) { a.obj.position.set(to.x, a.obj.userData.y0, to.z); a.obj.rotation.y = d.face; playClip(a, i%2 && a.clips.Eating ? 'Eating' : 'Idle'); a.mixer.update(.6 + i*.3); continue; }
    const from = cellPos(-1.3, d.at[1] + (d.at[1] > 3 ? -.4 : .8)), dir = to.clone().sub(from);
    a.obj.rotation.y = Math.atan2(dir.x, dir.z); playClip(a, d.walk || 'Walk');
    await new Promise(res => tween(S.rm ? 1 : 1500, t => { const e = 1 - Math.pow(1-t, 2.2); a.obj.position.set(from.x + dir.x*e, a.obj.userData.y0, from.z + dir.z*e); },
      () => { a.obj.rotation.y = d.face; playClip(a, a.clips.Eating ? 'Eating' : 'Idle'); sparkle(to.clone().setY(TILE_TOP + d.h*.7), 8, 0xFFF0B0, .4); res(); }));
    if (!d.twin) { V.arrived = V.arrived + 1; hooks.renderChrome(); }
    await new Promise(r => setTimeout(r, S.rm ? 0 : 140));
  }
  V.arrived = 3;
}

export default {
  id:'railway', name:'Railway valley', title:'Your railway',
  season:15, dates:'13–26 Apr', nextIn:14,
  kits:['a', RK, 'farm', VK],      // kit a first: meadow tufts + trees; trains pass kit 'railway', water tower + apples 'farm', cottages 'village'
  kitDefs:{ [RK]:{ file:'assets/railway/railway.glb' } },
  families:{
    water:   { label:'rivers & lakes',        tag:'Water' },
    building:{ label:'stations & cottages',   tag:'Building' },
    path:    { label:'track & signals',       tag:'Track' },
    crop:    { label:'wheat & orchards',      tag:'Grows' },
    tree:    { label:'trees & hedgerows',     tag:'Tree' },
    special: { label:'the mountain tunnel',   tag:'Special' }
  },
  slots:RAIL, order:RAIL_ORDER,
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 16.5h13v-5H4z" fill="#D9463B"/><path d="M11 11.5V7h6v4.5" fill="#D9463B"/><path d="M5 11.5V8.5h3.4v3" fill="#3A3F4B"/><path d="M4.4 8.6h4.6" stroke="#3A3F4B" stroke-width="1.4"/><path d="M12.2 8.2h3.6v2.2h-3.6z" fill="#BFE3F5"/><circle cx="7" cy="18" r="2" fill="#3A3F4B"/><circle cx="14.5" cy="18" r="2" fill="#3A3F4B"/><path d="M17 16.5l3 1.5" stroke="#3A3F4B" stroke-width="1.4" stroke-linecap="round"/><circle cx="6" cy="5" r="1.6" fill="#CFD6DE"/><circle cx="8.6" cy="3.4" r="1.2" fill="#CFD6DE"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M10 104h72V72H10z"/><path d="M50 72V46h32v26z"/><path d="M16 72V54h16v18z"/><path d="M12 52h24v6H12z"/><circle cx="26" cy="110" r="10"/><circle cx="66" cy="110" r="10"/><path d="M86 104h34V76H86z"/><circle cx="96" cy="110" r="7"/><circle cx="112" cy="110" r="7"/><circle cx="24" cy="38" r="8"/><circle cx="38" cy="26" r="6"/></g>',
  album:{ image:'assets/railway/album.jpg' },

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'track') buildTrack(g, s);
    else if (s.kind === 'station') buildStation(g);
    else if (s.kind === 'signalbox') buildSignalBox(g);
    else if (s.kind === 'shed') buildShed(g);
    else if (s.kind === 'goods') buildGoods(g);
    else if (s.kind === 'cottage') buildCottage(g, s);
    else if (s.kind === 'watertower') buildWaterTower(g);
    else if (s.kind === 'bench') buildBench(g);
    else if (s.kind === 'signal') buildSignal(g, s);
    else if (s.kind === 'hedgerow') buildHedgerow(g, s);
    else if (s.kind === 'river') buildRiver(g, s);
    else if (s.kind === 'lake') buildLake(g);
    else if (s.kind === 'wheat') buildWheat(g, s, stage);
    else if (s.kind === 'orchard') buildOrchard(g, s, stage);
    else if (s.kind === 'tunnel') buildTunnel(g);
    else if (s.kind === 'tree') { const t = tpl('a', s.model); if (t) addModel(g, s.model, fitScale(t, s.model.startsWith('Pine') ? 1.45 : 1.3, 1.02), 0, 0, 0, (s.rot||0)*Math.PI/180, 'a'); }
  },
  contact: s => ['station','signalbox','shed','goods','cottage','watertower','tree','hedgerow','signal','bench'].includes(s.kind),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.kind === 'bench' || s.kind === 'signal',
  decor(slots){ meadowDecor(slots, { tuft: r => { const q = r(); return q < .5 ? ['Grass_Common_Short', 0] : q < .86 ? ['Grass_Wispy_Short', 0] : [q < .93 ? 'Flower_3_Single' : 'Flower_4_Single', .16]; }, flowers:false }); },
  ambient(){ addLife(); },
  tick(t){ moveLife(t); },

  residents:[ { id:'train', name:'Steam train' }, { id:'Sheep', name:'Sheep', h:.3 }, { id:'Cow', name:'Cows', h:.4 } ],
  moveIn: railMoveIn,
  async preload(){ if (!ANIMCACHE.__sheep) ANIMCACHE.__sheep = await loadAnimal({ id:'Sheep', file:'assets/farm/Sheep.glb' }); },
  residentThumb(d, thumbFor){
    if (d.id === 'Cow') return 'assets/thumbs/Cow.png';
    if (d.id === 'Sheep') { const gltf = ANIMCACHE.__sheep; if (!gltf) return '';
      return thumbFor('anim:Sheep', () => { const o = SkeletonUtils.clone(gltf.scene); const mx = new THREE.AnimationMixer(o);
        const c = gltf.animations.find(x => /Idle/.test(x.name)); if (c) { mx.clipAction(c).play(); mx.update(.4); } o.rotation.y = -.35 + Math.PI/2; return o; }, 168); }
    return thumbFor('railway:train', () => { const o = new THREE.Group(); ['locomotive-b','locomotive-passenger-a'].forEach((n, i) => { if (tpl(RK, n)) addModel(o, n, TRAIN_K, 0, 0, -i*CAR_GAP, 0, RK); }); o.rotation.y = -.9; return o; }, 168);
  },
  residentRig(d){
    if (d.id === 'train') { const o = new THREE.Group(); ['locomotive-b','locomotive-passenger-a','locomotive-passenger-b'].forEach((n, i) => { if (tpl(RK, n)) addModel(o, n, TRAIN_K, 0, 0, -i*CAR_GAP, 0, RK); });
      return { obj:o, mixer:new THREE.AnimationMixer(o), clip:null, facing:0 }; }
    const gltf = d.id === 'Sheep' ? ANIMCACHE.__sheep : ANIMCACHE.Cow; if (!gltf || !gltf.scene) return null;
    const o = SkeletonUtils.clone(gltf.scene), mx = new THREE.AnimationMixer(o), c = gltf.animations.find(x => /Walk|Jump/.test(x.name));
    return { obj:o, mixer:mx, clip:c || null, facing:0 };
  }
};
