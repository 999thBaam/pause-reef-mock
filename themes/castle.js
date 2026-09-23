/* CASTLE (?theme=castle): a storybook fantasy castle on the village's 7×7 ring blueprint (same cells, rings 6 / 15 / 19,
   hero in the front-left corner so it is never hidden).
   Towers, gatehouse, walls, flags, drawbridge, tall pine = Kenney Castle Kit 2.0 (CC0), packed to assets/castle/castle.glb
   (siege weapons left out). Well, fountain basin, barrels, crates, cart, hedge, lilies = KayKit Medieval Hexagon / Kenney
   Fantasy Town (CC0, reused from assets/village/village.glb). Oaks + meadow tufts = Quaternius Stylized Nature MegaKit (kit a).
   Residents: Quaternius Ultimate Monsters "Dragon" + "Pigeon" (recoloured to doves) (CC0, Poly Pizza), Quaternius horses (shared).
   Growing walls, enchanted flower beds, topiary, torches, the crystal, the moat rim and the fireflies are procedural (Acc). */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { rngFrom, world, TEX } from '../engine/scene.js';
import { S, V, cropStage, hooks, AMBIENT } from '../engine/state.js';
import { edgeCentre, cellPos, TILE_TOP } from '../engine/grid.js';
import { KITCACHE, ANIMCACHE, addModel, fitScale, loadAnimal, modelBox } from '../engine/kit.js';
import { Acc } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { meadowDecor } from '../engine/life.js';

const CK = 'castle', VK = 'village';
const tpl = (n, kit = CK) => KITCACHE[kit] && KITCACHE[kit][kit === CK ? 'ck_' + n : n];
const ck = (g, n, k, x=0, y=0, z=0, rot=0) => addModel(g, 'ck_' + n, k, x, y, z, rot, CK);
/* a village-kit prop fitted to [h, w] tiles */
function vm(g, name, h, w, x=0, y=0, z=0, rot=0){ const t = tpl(name, VK); if (!t) { console.warn('missing', name); return null; }
  return addModel(g, name, fitScale(t, h, w), x, y, z, rot, VK); }
/* stack Kenney modules bottom-up (each template's origin is its bottom centre); returns the top y */
function stack(g, names, k, x=0, z=0, rot=0, y0=0){ let y = y0;
  for (const n of names) { const t = tpl(n); if (!t) { console.warn('missing', n); continue; } ck(g, n, k, x, y, z, rot); y += t.size.y*k; }
  return y; }

const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.9, metalness:0, flatShading:true, ...o });
const CM = {
  slab:FM(0xD9C7AC, { roughness:1 }), cob1:FM(0xC9B79C), cob2:FM(0xDDCDB3), cob3:FM(0xB9A58A),
  st1:FM(0xF1D6B8), st2:FM(0xE2C3A2), st3:FM(0xD2B08E), mortar:FM(0xBFA487, { roughness:1 }),
  roof:FM(0x5A66D8), roofD:FM(0x4450B8), wood:FM(0x9A6437), woodD:FM(0x6E4428), hay:FM(0xEDC55A),
  soil:FM(0x6E4A30, { roughness:1 }), moss:FM(0x4F7F3A, { roughness:1 }), leaf:FM(0x4E9A3E), leafD:FM(0x3F8233), leafL:FM(0x66B24A), pot:FM(0xC9774A),
  water:new THREE.MeshStandardMaterial({ color:0x5CB7D8, roughness:.18, metalness:0, emissive:0x0E3C55, emissiveIntensity:.35 }),
  flame:new THREE.MeshStandardMaterial({ color:0xFFC857, emissive:0xFF8A1F, emissiveIntensity:1.6, roughness:.6 }),
  gold:FM(0xF4C84A, { emissive:0x6A4A00, emissiveIntensity:.3 }),
  crystal:new THREE.MeshStandardMaterial({ color:0x9FE8FF, emissive:0x4FB8FF, emissiveIntensity:.9, roughness:.15, metalness:0, flatShading:true }),
  crystal2:new THREE.MeshStandardMaterial({ color:0xD9B8FF, emissive:0x9A5CFF, emissiveIntensity:.8, roughness:.15, metalness:0, flatShading:true })
};
const GLOW = [0x8FE3FF, 0xD7A6FF, 0xFF9FD0, 0xFFE38A];
const GLOW_MATS = GLOW.map(c => new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:1.1, roughness:.5, flatShading:true }));
const rbox = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

/* ── BLUEPRINT (the village's cells). kind: keep | tower | model | wall | bloom | path | torch | banner | cart | well | fountain | pool | bridge | topiary | tree | rampart | hedge | pennants | stables | crystal ── */
const T = (id, name, kind, x, z, extra = {}) => ({ id, cat:'building', gate:'lesson', name, kind, x, z, ...extra });
const Tr = (id, name, kind, x, z, extra = {}) => ({ id, cat:'tree', gate:'vocab', name, kind, x, z, ...extra });
const P = (id, name, kind, x, z, extra = {}) => ({ id, cat:'path', gate:'todos', name, kind, x, z, ...extra });
export const CASTLE = [
  // ── ring 1: the keep + wishing well + oak + path + a wall and a flower bed ──
  { id:'keep', cat:'building', gate:'lesson', name:'The keep', kind:'keep', x:2, z:2, w:2, d:2 },
  { id:'well', cat:'water', gate:'breathe', name:'Wishing well', kind:'well', x:4, z:2 },
  Tr('oak1', 'Oak tree', 'tree', 4, 3, { model:'CommonTree_1', h:1.35, rot:20 }),
  P('path3_4', 'Cobble path', 'path', 3, 4),
  // ── ring 2 ──
  T('rtower', 'Round tower', 'tower', 2, 1, { parts:['tower_base', 'tower_hexagon_roof'], k:.66, flag:'flag' }),
  T('library', 'Library tower', 'tower', 3, 1, { parts:['tower_hexagon_base', 'tower_hexagon_mid', 'tower_hexagon_roof_secondary'], k:.78, books:true }),
  T('gatehouse', 'Gatehouse', 'tower', 4, 1, { parts:['tower_square_arch', 'tower_square_top'], k:.86, flag:'flag_wide', flagY:.1 }),
  { id:'fountain', cat:'water', gate:'breathe', name:'Fountain', kind:'fountain', x:5, z:1 },
  { id:'pool', cat:'water', gate:'breathe', name:'Lily pool', kind:'pool', x:5, z:4 },
  Tr('topiary1', 'Topiary', 'topiary', 5, 3, { style:'cone' }),
  Tr('oak2', 'Tall oak', 'tree', 5, 5, { model:'CommonTree_3', h:1.5, rot:40 }),
  // ── ring 3 ──
  { id:'crystal', cat:'special', gate:'gita', name:'Crystal tower', kind:'crystal', x:0, z:5, w:2, d:2 },    // front-left: never occluded
  T('stables', 'Stables', 'stables', 2, 0),
  T('talltower', 'Tall tower', 'tower', 4, 0, { parts:['tower_square_base', 'tower_square_mid_windows', 'tower_square_top_roof_high'], k:.7, flag:'flag_pennant' }),
  T('turret', 'Watch turret', 'tower', 6, 0, { parts:['tower_hexagon_base', 'tower_hexagon_top_wood'], k:.8 }),
  T('belltower', 'Bell tower', 'tower', 6, 1, { parts:['tower_slant_roof'], k:.8 }),
  { id:'bridge', cat:'water', gate:'breathe', name:'Moat bridge', kind:'bridge', x:6, z:2 },
  Tr('pine', 'Tall pine', 'ckpine', 5, 0),
  Tr('topiary2', 'Topiary pair', 'topiary', 6, 5, { style:'balls' }),
  Tr('oak3', 'Oak tree', 'tree', 6, 6, { model:'CommonTree_2', h:1.3, rot:120 }),
  // Sudoku / Math → things that grow: castle walls rise course by course, enchanted beds bloom
  ...[[1,1],[1,3],[1,4],[6,3],[6,4]].map(([x,z],i) => ({ id:'wall'+x+'_'+z, cat:'crop', gate:i%2 ? 'mathtricks' : 'sudoku', name:'Castle wall', kind:'wall', x, z, stages:5 })),
  ...[[2,4],[4,4],[2,5],[4,5],[4,6]].map(([x,z],i) => ({ id:'bloom'+x+'_'+z, cat:'crop', gate:i===2 ? 'mathtricks' : 'sudoku', name:'Enchanted garden', kind:'bloom', x, z, stages:5, hue:i })),
  // To-dos → paths, banners, torches, carts, low ramparts
  P('banner', 'Banner stand', 'banner', 1, 2),
  P('torch5_2', 'Torch path', 'path', 5, 2, { torch:true }),
  P('path3_5', 'Cobble path', 'path', 3, 5),
  P('cart', 'Supply cart', 'cart', 3, 0),
  P('path2_6', 'Barrel path', 'path', 2, 6, { barrels:true }),
  P('torch3_6', 'Torch path', 'path', 3, 6, { torch:true }),
  { id:'rampart1', cat:'path', gate:'todos', name:'Low rampart', kind:'rampart', x:0, z:0, edge:'w', len:2 },
  { id:'rampart2', cat:'path', gate:'todos', name:'Low rampart', kind:'rampart', x:0, z:2, edge:'w', len:2 },
  { id:'hedge', cat:'path', gate:'todos', name:'Hedge', kind:'hedge', x:0, z:4, edge:'w', len:1 },
  { id:'pennants', cat:'path', gate:'todos', name:'Pennant line', kind:'pennants', x:5, z:6, edge:'s', len:2 }
];
export const CASTLE_ORDER = ['keep','bloom2_4','oak1','well','path3_4','bloom4_4',
  'path3_5','gatehouse','wall1_3','rtower','oak2','banner','bloom4_5','fountain','topiary1','wall1_4','library','torch5_2','wall1_1','pool','bloom2_5',
  'crystal','torch3_6','bridge','rampart1','pine','stables','wall6_3','belltower','rampart2','talltower','path2_6','topiary2','wall6_4','oak3','hedge','bloom4_6','turret','cart','pennants'];

/* ── cobbles: a pale slab with a loose mosaic of rounded setts ── */
function cobbles(acc, r, half, n, y){
  const mats = [CM.cob1, CM.cob2, CM.cob3], step = 2*half/n;
  for (let i=0;i<n;i++) for (let j=0;j<n;j++){ if (r() < .1) continue;
    const x = -half + (i+.5)*step + (j%2 ? step*.35 : 0) + (r()-.5)*.02, z = -half + (j+.5)*step + (r()-.5)*.02, s = step*.44*(.85 + r()*.25);
    if (Math.abs(x) > half) continue;
    acc.add(new THREE.CylinderGeometry(s, s*1.1, .022, 6), mats[Math.floor(r()*3)], at(x, y, z, r()*3, 1, 1, .85 + r()*.3)); }
}
function slab(g, s, size = .97, n = 6){
  const acc = new Acc(), r = rngFrom(s.x*13 + s.z*29 + 3);
  acc.add(rbox(size, .035, size), CM.slab, at(0, .0175, 0)); cobbles(acc, r, size/2 - .05, n, .044);
  const grp = new THREE.Group(); acc.into(grp); g.add(grp); return grp;
}
/* torch: a post with an iron bowl and a flame (glows at night) */
function torch(g, x, z, h = .5){
  const acc = new Acc();
  acc.add(new THREE.CylinderGeometry(.025, .032, h, 6).translate(0, h/2, 0), CM.woodD, at(x, .03, z));
  acc.add(new THREE.CylinderGeometry(.065, .035, .06, 8).translate(0, .03, 0), CM.mortar, at(x, .03 + h, z));
  acc.add(new THREE.ConeGeometry(.045, .13, 7).translate(0, .065, 0), CM.flame, at(x, .03 + h + .04, z));
  acc.add(new THREE.SphereGeometry(.04, 8, 6), CM.flame, at(x, .03 + h + .06, z));
  acc.into(g);
}
function buildPath(g, s){
  slab(g, s);
  if (s.torch) { torch(g, .32, -.32); torch(g, -.32, .32, .42); }
  if (s.barrels) { vm(g, 'barrel', .2, .2, -.3, .03, -.28, .4); vm(g, 'barrel', .19, .19, -.1, .03, -.34, 1.4); vm(g, 'crate_A_small', .14, .16, -.3, .03, -.02, .7); }
  if (!s.torch && !s.barrels) g.userData.ghostMode = 'marker';
}

/* ── CASTLE WALL (grows): stone courses rise one per stage; 4 = crenellated, 5 = a banner and ivy ── */
const COURSE = .15;
function fillWall(plants, s, stage){
  plants.clear();
  const st = Math.min(5, stage), r = rngFrom(s.x*31 + s.z*7 + 5), acc = new Acc(), mats = [CM.st1, CM.st2, CM.st3];
  const L = .94, TH = .3, courses = Math.min(4, st);
  for (let c=0;c<courses;c++){ const n = c%2 ? 4 : 3, bl = L/(n + (c%2 ? 0 : .5)); let z = -L/2;
    const blocks = c%2 ? Array(4).fill(L/4) : [L/7, 2*L/7, 2*L/7, 2*L/7];
    blocks.forEach(len => { acc.add(rbox(TH*(.96 + r()*.04), COURSE - .012, len - .012), mats[Math.floor(r()*3)], at((r()-.5)*.01, .04 + c*COURSE + COURSE/2, z + len/2)); z += len; }); }
  acc.add(rbox(TH*.9, courses*COURSE, L - .02), CM.mortar, at(0, .04 + courses*COURSE/2, 0));
  if (st >= 4) for (let i=0;i<4;i++){ const z = -L/2 + L/8 + i*L/4; acc.add(rbox(TH*1.04, .11, L/8), mats[i%3], at(0, .04 + courses*COURSE + .055, z)); }
  if (st >= 2 && st <= 3) {   // scaffold while it is being built
    [-.36, .36].forEach(z => acc.add(rbox(.03, .75, .03), CM.wood, at(.24, .415, z)));
    acc.add(rbox(.03, .03, .8), CM.wood, at(.24, .04 + courses*COURSE + .05, 0));
    acc.add(rbox(.14, .025, .8), CM.woodD, at(.3, .04 + courses*COURSE - .02, 0));
  }
  if (st >= 5) for (let i=0;i<9;i++){ const z = (r()-.5)*.8, y = .08 + r()*.4; acc.add(new THREE.IcosahedronGeometry(.045 + r()*.03, 0), i%2 ? CM.leaf : CM.leafL, at(TH/2 + .01, y, z, r()*3, .6, 1, 1)); }
  if (st <= 1) acc.add(rbox(.34, .03, .98), CM.soil, at(0, .015, 0));
  acc.into(plants);
  if (st >= 5) { const f = ck(plants, 'flag_banner_short', fitScale(tpl('flag_banner_short'), .42, .3), TH/2 + .01, .04 + courses*COURSE - .5, 0, 0); if (f) f.userData.flutter = true; }
  if (st <= 1) { vm(plants, 'resource_stone', .12, .2, .28, .03, .2, .5); }
  if (st === 2) vm(plants, 'resource_stone', .1, .18, .3, .03, -.18, 1.2);
  plants.userData.stage = stage;
}
function buildWall(g, s, stage){
  const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillWall(plants, s, st);
  fillWall(plants, s, stage);
}

/* ── ENCHANTED GARDEN (grows): a stone-ringed bed; sprouts → stems → glowing buds → full blooms → blooms + floating motes ── */
const PETAL = new THREE.IcosahedronGeometry(1, 0);
function fillBloom(plants, s, stage){
  plants.clear();
  const st = Math.min(5, stage), r = rngFrom(s.x*17 + s.z*5 + 9), acc = new Acc();
  const pts = []; for (let i=0;i<10;i++){ const a = i/9*6.28 + r()*.4, d = i ? (i%2 ? .27 : .15) + r()*.05 : 0; pts.push([Math.cos(a)*d, Math.sin(a)*d]); }
  pts.forEach(([x,z], i) => {
    const hue = GLOW_MATS[(s.hue + i) % GLOW_MATS.length];
    if (st === 1) { acc.add(new THREE.ConeGeometry(.025, .07, 5).translate(0, .035, 0), CM.leafL, at(x, .09, z, r()*3)); return; }
    const h = [0, 0, .1, .18, .26, .3][st]*(.8 + r()*.4);
    acc.add(new THREE.CylinderGeometry(.008, .012, h, 5).translate(0, h/2, 0), CM.leafD, at(x, .09, z));
    acc.add(new THREE.IcosahedronGeometry(.035, 0), CM.leafL, at(x + .03, .09 + h*.4, z, r()*3, 1, .4, 1.6));
    const b = st === 2 ? .03 : st === 3 ? .05 : .08;
    acc.add(PETAL, st === 2 ? CM.leafL : hue, at(x, .09 + h + b*.5, z, r()*3, b, b*(st >= 4 ? .75 : 1.2), b));
    if (st >= 4) acc.add(PETAL, CM.gold, at(x, .09 + h + b*.95, z, 0, b*.35, b*.35, b*.35));
  });
  if (st >= 5) for (let i=0;i<5;i++){ const a = r()*6.28, d = r()*.35; acc.add(new THREE.OctahedronGeometry(.022, 0), GLOW_MATS[i%4], at(Math.cos(a)*d, .55 + r()*.25, Math.sin(a)*d, r()*3)); }
  acc.into(plants); plants.userData.stage = stage;
}
function buildBloom(g, s, stage){
  const acc = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 11);
  acc.add(new THREE.CylinderGeometry(.4, .42, .07, 20), CM.moss, at(0, .045, 0));
  for (let i=0;i<14;i++){ const a = i/14*Math.PI*2; acc.add(new THREE.DodecahedronGeometry(.07 + r()*.015, 0), [CM.st1, CM.st2, CM.st3][i%3], at(Math.cos(a)*.42, .05, Math.sin(a)*.42, r()*3, 1, .75, 1)); }
  const bed = new THREE.Group(); acc.into(bed); bed.userData.ghostHide = true; g.add(bed);
  const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillBloom(plants, s, st);
  fillBloom(plants, s, stage);
}

/* ── THE KEEP (ring-1 hero): a square keep, two hexagon turrets, a curtain wall with its gate, on a cobbled courtyard ── */
function buildKeep(g, s){
  const yard = slab(g, s, 1.92, 12); yard.userData.ghostHide = true;
  stack(g, ['tower_square_base', 'tower_square_mid_windows', 'tower_square_top_roof_high'], .66, -.28, -.28);
  stack(g, ['tower_hexagon_base', 'tower_hexagon_roof'], .5, .58, -.58);
  stack(g, ['tower_hexagon_base', 'tower_hexagon_roof'], .5, -.58, .58);
  const f1 = ck(g, 'flag_banner_long', fitScale(tpl('flag_banner_long'), .95, .5), .06, .5, -.28, 0); if (f1) f1.userData.flutter = true;
  const f2 = ck(g, 'flag_banner_long', fitScale(tpl('flag_banner_long'), .95, .5), -.28, .5, .06, -Math.PI/2); if (f2) f2.userData.flutter = true;
  const p = ck(g, 'flag', .55, -.28, 2.26, -.28, .6); if (p) p.userData.flutter = true;
  torch(g, .5, .72, .42); torch(g, .72, .5, .42);
  vm(g, 'barrel', .18, .18, .74, .03, -.08, .3); vm(g, 'crate_A_big', .18, .18, -.1, .03, .76, .8);
}
/* ── towers: stacked Kenney modules, optional flag / books ── */
function buildTower(g, s){
  const top = stack(g, s.parts, s.k, 0, 0, 0);
  if (s.flag) { const f = ck(g, s.flag, .5, s.flagX ?? 0, top - .02 + (s.flagY || 0), 0, .6); if (f) f.userData.flutter = true; }
  if (s.books) { vm(g, 'crate_open', .14, .2, .34, 0, .3, .4); const acc = new Acc();
    [[0xC9523B],[0x3E7CC9],[0x6FB041]].forEach(([c], i) => acc.add(rbox(.07, .025, .1), FM(c), at(.34, .15 + i*.026, .3, i*.4)));
    acc.into(g); }
}
/* ── stables: an open timber shed with a blue roof, a hay rack and a water trough ── */
function buildStables(g){
  const acc = new Acc();
  acc.add(rbox(.9, .03, .78), CM.hay, at(0, .015, 0));
  [[-.42,-.36],[.42,-.36],[-.42,.36],[.42,.36],[0,.36]].forEach(([x,z]) => acc.add(rbox(.06, .6, .06), CM.wood, at(x, .3, z)));
  acc.add(rbox(.9, .5, .05), CM.woodD, at(0, .25, -.36));                                   // back wall
  [-.42, .42].forEach(x => acc.add(rbox(.05, .32, .74), CM.wood, at(x, .16, 0)));              // side boards
  acc.add(rbox(.9, .06, .06), CM.wood, at(0, .6, .36)); acc.add(rbox(.9, .06, .06), CM.wood, at(0, .6, -.36));
  [1, -1].forEach(sg => { const g2 = new THREE.BoxGeometry(1.08, .05, .6); g2.rotateX(sg*.62); acc.add(g2, CM.roof, at(0, .77, sg*.24)); });
  acc.add(new THREE.CylinderGeometry(.035, .035, 1.1, 6).rotateZ(Math.PI/2), CM.roofD, at(0, .95, 0));
  acc.add(rbox(.34, .1, .12), CM.wood, at(.1, .08, .3)); acc.add(rbox(.3, .02, .08), CM.water, at(.1, .125, .3));
  acc.add(new THREE.CylinderGeometry(.12, .13, .13, 10), CM.hay, at(-.22, .08, -.12, 0, 1, 1, 1));
  acc.into(g);
  const f = ck(g, 'flag_pennant', .42, .42, .6, .36, .6); if (f) f.userData.flutter = true;
}
/* ── water ── */
function buildWell(g){
  vm(g, 'building_well_blue', 1.02, .9, 0, 0, 0, -.4);
  const acc = new Acc(); [[.3,.32],[-.34,.26],[.32,-.3]].forEach(([x,z],i) => acc.add(new THREE.OctahedronGeometry(.035, 0), GLOW_MATS[i], at(x, .75 + i*.08, z, i)));
  acc.into(g);
}
function buildFountain(g){
  const acc = new Acc();
  const col = (y, h, r0, r1, m = CM.st1, seg = 10) => acc.add(new THREE.CylinderGeometry(r1, r0, h, seg).translate(0, h/2, 0), m, at(0, y, 0));
  col(.05, .24, .08, .06); col(.28, .05, .07, .18); col(.33, .015, .16, .16, CM.water, 16); col(.32, .14, .04, .03);
  acc.add(new THREE.OctahedronGeometry(.07, 0), CM.crystal, at(0, .52, 0, .4, 1, 1.5, 1));
  for (let i=0;i<6;i++){ const a = i/6*Math.PI*2; for (let j=0;j<3;j++){ const d = .19 + j*.05, y = .31 - j*j*.04;
    acc.add(new THREE.SphereGeometry(.013 - j*.002, 6, 5), CM.water, at(Math.cos(a)*d, y, Math.sin(a)*d)); } }
  acc.into(g);
  const basin = vm(g, 'fountain_round_detail', .22, .9, 0, 0, 0); if (basin) basin.scale.y *= 1.2;
}
function buildPool(g, s){
  const acc = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 21);
  acc.add(rbox(.86, .04, .86), CM.slab, at(0, .02, 0));
  acc.add(rbox(.7, .02, .7), CM.water, at(0, .045, 0));
  for (let i=0;i<4;i++){ const a = i*Math.PI/2; [[.4, 0]].forEach(() => acc.add(rbox(.86, .08, .08), [CM.st1, CM.st2][i%2], at(Math.cos(a)*.39, .05, Math.sin(a)*.39, a + Math.PI/2))); }
  acc.into(g);
  vm(g, 'waterlily_A', .02, .16, -.12, .05, .1, 1); vm(g, 'waterlily_B', .02, .2, .14, .05, -.12, 2.2);
  vm(g, 'waterplant_C', .3, .26, -.28, .04, -.26, .3);
  const c = new Acc(); c.add(new THREE.OctahedronGeometry(.05, 0), CM.crystal2, at(.25, .1, .25, .3, 1, 1.6, 1)); c.into(g);
}
function buildBridge(g){
  const acc = new Acc();
  acc.add(rbox(.5, .03, .98), CM.water, at(0, .03, 0));
  [-.28, .28].forEach(x => acc.add(rbox(.07, .09, .98), CM.st2, at(x, .045, 0)));
  const water = new THREE.Group(); acc.into(water); g.add(water);
  const b = tpl('bridge_draw'); if (b) { const k = .78 / Math.max(b.size.x, b.size.z); ck(g, 'bridge_draw', k, 0, .06, 0, 0); }
  vm(g, 'waterlily_A', .02, .12, .08, .05, .36, 1);
  torch(g, .38, -.38, .38); torch(g, -.38, .38, .38);
}
/* ── trees ── */
function buildTopiary(g, s){
  const acc = new Acc();
  const pot = (x, z) => { acc.add(new THREE.CylinderGeometry(.12, .09, .16, 10).translate(0, .08, 0), CM.pot, at(x, 0, z)); acc.add(new THREE.CylinderGeometry(.11, .11, .02, 10), CM.soil, at(x, .16, z)); };
  if (s.style === 'cone') { pot(0, 0); acc.add(new THREE.CylinderGeometry(.025, .025, .2, 6).translate(0, .1, 0), CM.woodD, at(0, .16, 0));
    [[.3, .2, .34],[.22, .16, .56],[.14, .11, .74]].forEach(([r0, h, y]) => acc.add(new THREE.ConeGeometry(r0, h*1.6, 9).translate(0, 0, 0), CM.leaf, at(0, y, 0)));
    acc.add(new THREE.SphereGeometry(.05, 8, 6), CM.gold, at(0, .95, 0)); }
  else { [[-.2,-.18,.8],[.22,.2,1]].forEach(([x,z,k]) => { pot(x, z);
      acc.add(new THREE.CylinderGeometry(.02, .02, .3*k, 6).translate(0, .15*k, 0), CM.woodD, at(x, .16, z));
      acc.add(new THREE.IcosahedronGeometry(.15*k, 1), CM.leaf, at(x, .16 + .22*k, z));
      acc.add(new THREE.IcosahedronGeometry(.12*k, 1), CM.leafL, at(x, .16 + .48*k, z)); }); }
  acc.into(g);
}
/* ── path props ── */
function buildBanner(g, s){
  const sl = slab(g, s); sl.userData.ghostHide = true;
  const f = ck(g, 'flag_banner_long', fitScale(tpl('flag_banner_long'), 1.0, .5), -.05, .03, 0, 0); if (f) f.userData.flutter = true;
  const acc = new Acc(); acc.add(new THREE.CylinderGeometry(.025, .03, 1.02, 6).translate(0, .51, 0), CM.woodD, at(-.09, .03, 0)); acc.into(g);
  vm(g, 'crate_A_big', .18, .18, .28, .03, .3, .3); vm(g, 'crate_A_small', .13, .14, .3, .21, .3, .9); vm(g, 'sack', .09, .16, .3, .03, -.28, .5);
}
function buildCart(g){ vm(g, 'cart_high', .5, .82, 0, 0, 0, .7); vm(g, 'sack', .08, .18, .34, .02, .32, 1.1); vm(g, 'crate_A_small', .13, .15, -.32, .02, .32, .3); }
function buildRampart(g, s){
  const acc = new Acc(), r = rngFrom(s.z*11 + 3), mats = [CM.st1, CM.st2, CM.st3];
  for (let i=0;i<s.len;i++){ const o = i - (s.len-1)/2;
    acc.add(rbox(.16, .26, .98), mats[i%3], at(-.45, .13, o));
    for (let j=0;j<4;j++) acc.add(rbox(.18, .1, .13), mats[Math.floor(r()*3)], at(-.45, .31, o - .37 + j*.245));
    for (let j=0;j<3;j++) acc.add(rbox(.165, .01, .96), CM.mortar, at(-.45, .06 + j*.08, o)); }
  acc.into(g);
  const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}
function buildHedge(g, s){ const t = tpl('hedge', VK), k = t ? 1.0 / Math.max(t.size.x, t.size.z) : 1;
  addModel(g, 'hedge', k, -.45, 0, 0, 0, VK); const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz); }
function buildPennants(g, s){
  const acc = new Acc();
  for (let i=0;i<=s.len*2;i++){ const x = -s.len/2 + i*.5; acc.add(new THREE.CylinderGeometry(.022, .028, .5, 6).translate(0, .25, 0), CM.woodD, at(x, 0, .45)); }
  acc.into(g);
  for (let i=0;i<s.len*2;i++){ const f = ck(g, i%2 ? 'flag_wide' : 'flag_pennant', .38, -s.len/2 + .25 + i*.5, .12, .45, Math.PI/2); if (f) f.userData.flutter = true; }
  const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}

/* ── CRYSTAL TOWER (Gita): a pale hexagon tower on a round cobbled plinth, open at the top, holding a great glowing crystal
   with two shards orbiting it; small crystals, torches and banners round the foot. ── */
function buildCrystal(g){
  const acc = new Acc(), r = rngFrom(404);
  acc.add(new THREE.CylinderGeometry(.93, .96, .06, 40), CM.slab, at(0, .03, 0));
  for (let i=0;i<80;i++){ const a = r()*6.28, d = .3 + r()*.58, s = .06*(.8 + r()*.4);
    acc.add(new THREE.CylinderGeometry(s, s*1.06, .02, 6), [CM.cob1, CM.cob2, CM.cob3][i%3], at(Math.cos(a)*d, .065, Math.sin(a)*d, r()*3)); }
  // three steps round the foot
  acc.add(new THREE.CylinderGeometry(.5, .54, .08, 12), CM.st2, at(0, .1, 0));
  acc.into(g);
  const top = stack(g, ['tower_hexagon_base', 'tower_hexagon_mid', 'tower_hexagon_mid', 'tower_hexagon_top'], .92, 0, 0, 0, .14);
  const cr = new Acc();
  cr.add(new THREE.OctahedronGeometry(.26, 0), CM.crystal, at(0, top + .42, 0, .3, 1, 1.9, 1));
  cr.add(new THREE.OctahedronGeometry(.11, 0), CM.crystal2, at(.34, top + .3, .1, .8, 1, 1.7, 1));
  cr.add(new THREE.OctahedronGeometry(.09, 0), CM.crystal2, at(-.3, top + .5, -.12, .2, 1, 1.7, 1));
  // gold ring under the crystal
  cr.add(new THREE.TorusGeometry(.2, .025, 6, 18).rotateX(Math.PI/2), CM.gold, at(0, top + .07, 0));
  [[.66,.3],[.4,.66],[-.7,-.2],[.72,-.35]].forEach(([x,z], i) => cr.add(new THREE.OctahedronGeometry(.06 + i*.012, 0), i%2 ? CM.crystal2 : CM.crystal, at(x, .1 + .06, z, i, 1, 1.8, 1)));
  const crystal = new THREE.Group(); cr.into(crystal); g.add(crystal); crystal.userData.crystal = true;
  torch(g, .78, .1, .5); torch(g, .1, .78, .5);
  [[-.62,.56],[.56,-.62]].forEach(([x,z]) => { const f = ck(g, 'flag_banner_long', fitScale(tpl('flag_banner_long'), .8, .45), x, .06, z, Math.atan2(x, z)); if (f) f.userData.flutter = true;
    const a = new Acc(); a.add(new THREE.CylinderGeometry(.022, .026, .82, 6).translate(0, .41, 0), CM.woodD, at(x, .06, z)); a.into(g); });
}

/* ── the moat rim: a thin water channel with a stone curb round the tile block (scales with the land) ── */
function buildMoat(){
  const env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const L = V.L, h = L/2, W = .24, C = .08, y0 = -.63;
  const acc = new Acc(), SIDE = FM(0x8FA7B8, { roughness:1 }), CURB = FM(0xE6CFB0), CURB2 = CURB;
  for (let i=0;i<4;i++){ const ry = i*Math.PI/2, run = L + 2*W;
    const rot = (x, z) => { const c = Math.cos(ry), s = Math.sin(ry); return [x*c + z*s, -x*s + z*c]; };
    // water strip, channel floor/body, curb
    let [x, z] = rot(0, h + W/2); acc.add(rbox(run, .02, W), CM.water, at(x, -.02, z, ry));
    [x, z] = rot(0, h + W/2); acc.add(rbox(run, .6, W), SIDE, at(x, -.33, z, ry));
    [x, z] = rot(0, h + W + C/2); acc.add(rbox(run + 2*C, .72, C), i%2 ? CURB : CURB2, at(x, y0 + .36 + .04, z, ry));
  }
  acc.into(env);
  env.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  const e = h + W + C; for (const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) V.framePts.push(new THREE.Vector3(sx*e, .1, sz*e), new THREE.Vector3(sx*e, y0, sz*e));
}

/* ── ambient: fireflies of magic drifting over the land, banners that flutter ── */
function addMagic(){
  V.motes = []; const r = rngFrom(88);
  for (let i=0;i<9;i++){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:i%3 ? TEX.glow : TEX.star, color:GLOW[i%4], transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
    s.scale.setScalar(i%3 ? .16 : .13);
    s.userData = { ph:r()*6.28, rad:.6 + r()*V.ring*.8, h:.35 + r()*1.1, sp:.18 + r()*.2, cx:(r()-.5)*1.5, cz:(r()-.5)*1.5 };
    world.add(s); V.motes.push(s); V.life.push(s);
  }
  V.flags = []; world.traverse(o => { if (o.userData.flutter) { o.userData.ry0 = o.rotation.y; V.flags.push(o); } });
  moveMagic(2.1);
}
function moveMagic(t){
  (V && V.motes || []).forEach(s => { const u = s.userData, a = t*u.sp + u.ph;
    s.position.set(u.cx + Math.cos(a)*u.rad, TILE_TOP + u.h + Math.sin(a*2.3)*.15, u.cz + Math.sin(a*1.3)*u.rad*.8);
    s.material.opacity = .55 + .45*Math.sin(t*2.4 + u.ph); });
  (V && V.flags || []).forEach((f, i) => { if (!f.parent) return; f.rotation.y = f.userData.ry0 + Math.sin(t*2.6 + i*1.7)*.16 + Math.sin(t*5.1 + i)*.05; });
}

/* ── residents: a friendly dragon circles the castle and settles, two horses by the stables, three white doves ── */
const RES = [
  { id:'Dragon', name:'Dragon', h:1.05, at:[5.35,6.05], face:-2.35, file:'assets/castle/Dragon.glb', fly:true },
  { id:'Horse', name:'Horse', h:.8, at:[0.25,0.75], face:.4 },
  { id:'Horse_White', name:'White horse', h:.8, at:[0.3,1.9], face:.9 },
  { id:'Dove', name:'Doves', h:.2, at:[3.1,4.2], face:.8, file:'assets/castle/Pigeon.glb', dove:true },
  { id:'Dove2', name:'Dove', h:.2, at:[3.35,4.45], face:-.4, file:'assets/castle/Pigeon.glb', dove:true },
  { id:'Dove3', name:'Dove', h:.2, at:[1.1,0.3], face:1.2, file:'assets/castle/Pigeon.glb', dove:true }
];
const DOVE_COL = { Pigeon_Main:0xF6F3EC, Pigeon_Secondary:0xF2A65A };
function recolour(obj, d){
  obj.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.metalness = 0; o.material.roughness = .85;
    if (d.dove && DOVE_COL[o.material.name] != null) o.material.color.setHex(DOVE_COL[o.material.name]);
    if (d.fly && /Dragon_(Main|Secondary)/.test(o.material.name)) o.material.color.multiplyScalar(1.7); });   // the source orange reads muddy under our lights
}
async function spawnRes(d){
  const gltf = await loadAnimal(d.dove ? { id:'Dove', file:d.file } : d);
  const obj = SkeletonUtils.clone(gltf.scene); recolour(obj, d);
  const box = modelBox(obj), s = d.h / (box.max.y - box.min.y); obj.scale.setScalar(s);
  obj.userData.y0 = TILE_TOP - box.min.y*s; world.add(obj);
  const mixer = new THREE.AnimationMixer(obj), clips = {}; gltf.animations.forEach(c => clips[c.name.replace(/^.*\|/, '')] = c);
  const a = { def:d, obj, mixer, clips, cur:null }; V.animals.push(a); return a;
}
function playClip(a, name, speed = 1){ const c = a.clips[name] || a.clips.Idle || Object.values(a.clips)[0]; if (!c) return; const act = a.mixer.clipAction(c);
  act.timeScale = speed; if (a.cur === act) return; act.reset().play(); if (a.cur) a.cur.crossFadeTo(act, .3, false); a.cur = act;
  act.time = (S.drop != null || S.celebrate) ? .4 : (a.def.at[0]*1.3) % c.duration; }
const HOVER = .16;     // the dragon has no ground idle: it settles with a slow flutter just above the grass
function settle(a){ const d = a.def, p = cellPos(d.at[0], d.at[1]);
  a.obj.position.set(p.x, a.obj.userData.y0 + (d.fly ? HOVER : 0), p.z); a.obj.rotation.y = d.face;
  playClip(a, d.fly ? 'Flying_Idle' : 'Idle', d.fly ? .55 : 1); }
async function castleMoveIn(walk){
  V.residentsIn = true;
  RES.forEach(d => V.framePts.push(cellPos(d.at[0], d.at[1]).setY(TILE_TOP + d.h + (d.fly ? HOVER : 0))));
  for (let i=0;i<RES.length;i++){
    const d = RES[i], a = await spawnRes(d);
    if (!walk) { settle(a); continue; }
    const to = cellPos(d.at[0], d.at[1]), y0 = a.obj.userData.y0;
    if (d.fly) {          // two wide circles round the castle, spiralling down to its spot
      playClip(a, 'Fast_Flying');
      const R0 = 3.6, a0 = Math.atan2(to.z, to.x) + Math.PI*4, dur = S.rm ? 1 : 4200;
      await new Promise(res => tween(dur, t => { const e = 1 - Math.pow(1-t, 2), ang = a0 - e*Math.PI*4, R = R0 + (Math.hypot(to.x, to.z) - R0)*e;
          const x = Math.cos(ang)*R, z = Math.sin(ang)*R, y = y0 + HOVER + (1-e)*2.6 + Math.sin(t*Math.PI)*.4;
          a.obj.position.set(x, y, z); a.obj.rotation.y = Math.atan2(-Math.sin(ang), Math.cos(ang)) + Math.PI;
          if (t > .8) playClip(a, 'Flying_Idle', .8); },
        () => { settle(a); sparkle(to.clone().setY(TILE_TOP + d.h*.7), 16, 0xFFD27A, .8); res(); }));
    } else if (d.dove) {   // flutter down from above
      playClip(a, 'Jump');
      const from = to.clone().add(new THREE.Vector3(1.2, 0, -1.4));
      await new Promise(res => tween(S.rm ? 1 : 1100, t => { const e = 1 - Math.pow(1-t, 2.4);
          a.obj.position.set(from.x + (to.x - from.x)*e, y0 + (1-e)*2.2, from.z + (to.z - from.z)*e); a.obj.rotation.y = Math.atan2(to.x - from.x, to.z - from.z); },
        () => { settle(a); sparkle(to.clone().setY(TILE_TOP + .2), 6, 0xFFFFFF, .35); res(); }));
    } else {               // horses walk in through the front
      const gate = cellPos(3, 7.3), dir = to.clone().sub(gate); a.obj.rotation.y = Math.atan2(dir.x, dir.z); playClip(a, 'Walk');
      const dur = S.rm ? 1 : Math.max(900, dir.length()*700);
      await new Promise(res => tween(dur, t => { const e = 1 - Math.pow(1-t, 2.2); a.obj.position.set(gate.x + dir.x*e, y0, gate.z + dir.z*e); },
        () => { settle(a); sparkle(to.clone().setY(TILE_TOP + d.h*.7), 10, 0xFFF0B0, .6); res(); }));
    }
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = RES.length;
}

export default {
  id:'castle', name:'Fantasy castle', title:'Your castle',
  season:14, dates:'30 Mar–12 Apr', nextIn:14,
  kits:['a', CK, VK],      // kit a first: meadow tufts + oaks; castle modules pass kit 'castle', props kit 'village'
  kitDefs:{ [CK]:{ file:'assets/castle/castle.glb' } },
  families:{
    water:   { label:'wells & moat',          tag:'Water' },
    building:{ label:'towers & the keep',     tag:'Tower' },
    path:    { label:'paths & banners',       tag:'Path' },
    crop:    { label:'walls & magic gardens', tag:'Grows' },
    tree:    { label:'oaks & topiary',        tag:'Tree' },
    special: { label:'the crystal tower',     tag:'Special' }
  },
  slots:CASTLE, order:CASTLE_ORDER,
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 20v-9h3v2h2v-2h2v2h2v-2h2v2h2v-2h3v9z" fill="#EFD3B4"/><path d="M9 20v-3.2a3 3 0 0 1 6 0V20z" fill="#8C5A3A"/><path d="M10.2 11V5.5h3.6V11z" fill="#EFD3B4"/><path d="M9.6 5.8 12 2l2.4 3.8z" fill="#5A66D8"/><path d="M12 2v-.6" stroke="#5A66D8"/><path d="M4 11 5.5 7.6 7 11z" fill="#5A66D8"/><path d="M17 11l1.5-3.4L20 11z" fill="#5A66D8"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M14 118V70h8v8h8v-8h8v8h8v-8h8v48z"/><path d="M52 118V44h8v8h8v-8h8v8h8v-8h8v74z"/><path d="M60 44l16-26 16 26z" transform="translate(-4 0)"/><path d="M92 118V74h8v6h8v-6h8v44z"/><path d="M70 12l6-10 6 10z"/></g>',
  album:{ image:'assets/castle/album.jpg' },

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    switch (s.kind) {
      case 'keep': return buildKeep(g, s);
      case 'tower': return buildTower(g, s);
      case 'stables': return buildStables(g);
      case 'well': return buildWell(g);
      case 'fountain': return buildFountain(g);
      case 'pool': return buildPool(g, s);
      case 'bridge': return buildBridge(g);
      case 'tree': { const t = tpl(s.model, 'a'); if (t) addModel(g, s.model, fitScale(t, s.h, 1.05), 0, 0, 0, (s.rot||0)*Math.PI/180, 'a'); return; }
      case 'ckpine': ck(g, 'tree_large', fitScale(tpl('tree_large'), 1.5, .95)); return;
      case 'topiary': return buildTopiary(g, s);
      case 'wall': return buildWall(g, s, stage);
      case 'bloom': return buildBloom(g, s, stage);
      case 'path': return buildPath(g, s);
      case 'banner': return buildBanner(g, s);
      case 'cart': return buildCart(g);
      case 'rampart': return buildRampart(g, s);
      case 'hedge': return buildHedge(g, s);
      case 'pennants': return buildPennants(g, s);
      case 'crystal': return buildCrystal(g);
    }
  },
  contact: s => !['path', 'rampart', 'hedge', 'pennants', 'bloom', 'wall', 'pool', 'bridge'].includes(s.kind),
  nightLamp: s => s.cat === 'special' || s.kind === 'keep' || !!s.torch || ['library', 'gatehouse', 'stables'].includes(s.id),   // all glow at night; the special (the crystal) gets a real light first
  decor(slots){ meadowDecor(slots, { tuft: r => { const q = r(); return q < .5 ? ['Grass_Common_Short', 0] : q < .88 ? ['Grass_Wispy_Short', 0] : [q < .94 ? 'Flower_3_Single' : 'Flower_4_Single', .16]; }, flowers:false }); },
  env: buildMoat,
  ambient(){ addMagic(); },
  tick(t){ moveMagic(t); },

  residents: RES,
  moveIn: castleMoveIn,
  async preload(){
    if (!ANIMCACHE.__dragon) ANIMCACHE.__dragon = await loadAnimal(RES[0]);
    if (!ANIMCACHE.__dove) ANIMCACHE.__dove = await loadAnimal({ id:'Dove', file:'assets/castle/Pigeon.glb' });
  },
  residentThumb(d, thumbFor){
    if (!d.fly && !d.dove) return 'assets/thumbs/' + d.id + '.png';
    const gltf = d.fly ? ANIMCACHE.__dragon : ANIMCACHE.__dove; if (!gltf) return '';
    return thumbFor('castle:' + (d.fly ? 'dragon' : 'dove'), () => { const o = SkeletonUtils.clone(gltf.scene); recolour(o, d); const mx = new THREE.AnimationMixer(o);
      const c = gltf.animations.find(x => /Flying_Idle|Idle/.test(x.name)); if (c) { mx.clipAction(c).play(); mx.update(.4); } o.rotation.y = -.5; return o; }, 168);
  },
  residentRig(d){
    const gltf = d.fly ? ANIMCACHE.__dragon : d.dove ? ANIMCACHE.__dove : null; if (!gltf) return null;
    const o = SkeletonUtils.clone(gltf.scene); recolour(o, d); const mx = new THREE.AnimationMixer(o);
    const c = gltf.animations.find(x => (d.fly ? /Flying_Idle/ : /Idle/).test(x.name)); return { obj:o, mixer:mx, clip:c || null, facing:0 };
  }
};
