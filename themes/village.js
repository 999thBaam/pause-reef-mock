/* VILLAGE (?theme=village) — a medieval village on the same 7×7 ring blueprint as the farm (same cells, same ring counts
   6 / 15 / 19), so rings, pick-3, growth and expansion behave exactly like the farm.
   Houses, tavern, chapel, mills, well, trees, rocks, reeds, lilies, props = KayKit Medieval Hexagon Pack 1.0 (CC0);
   lanterns, market stalls, carts, benches, picket fence, hedge, fountain basin = Kenney Fantasy Town Kit 2.0 (CC0);
   packed to assets/village/village.glb. Vegetable beds grow the Quaternius Ultimate Crops already in the farm kit;
   meadow tufts come from the shared MegaKit (kit a). Cobbles, garden beds, haystacks, ponds and the fountain spire are
   procedural flat-shaded geometry, merged per material (Acc) so every piece stays pre-renderable. */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { rngFrom } from '../engine/scene.js';
import { S, cropStage } from '../engine/state.js';
import { edgeCentre } from '../engine/grid.js';
import { KITCACHE, ANIMCACHE, addModel, fitScale, loadAnimal } from '../engine/kit.js';
import { Acc } from '../engine/proc.js';
import { meadowDecor, addButterflies, flyButterflies } from '../engine/life.js';

const VK = 'village';
const tplOf = n => KITCACHE[VK] && KITCACHE[VK][n];
/* place a village-kit model fitted to [h, w] tiles (fit, not a fixed k: KayKit and Kenney use different units) */
function vm(g, name, h, w, x=0, y=0, z=0, rot=0){ const t = tplOf(name); if (!t) { console.warn('missing', name); return null; }
  return addModel(g, name, fitScale(t, h, w), x, y, z, rot, VK); }

const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.9, metalness:0, flatShading:true, ...o });
const VMAT = {
  lane:FM(0xCBBFA6, { roughness:1 }), cob1:FM(0xB4AA99), cob2:FM(0xC7BDAB), cob3:FM(0xA29684),
  plaza:FM(0xCFC6D9, { roughness:1 }), stoneL:FM(0xC4BFD3), stoneD:FM(0x9F99B3),
  water:new THREE.MeshStandardMaterial({ color:0x5CB7D8, roughness:.18, metalness:0, emissive:0x0E3C55, emissiveIntensity:.35 }),
  plank:FM(0x9A6437), plankD:FM(0x7A4C2A), bedSoil:FM(0x6E4428, { roughness:1 }),
  stubble:FM(0xD8C27C, { roughness:1 }), hay:FM(0xEDC55A), hayD:FM(0xCFA43E), gold:FM(0xF4C84A, { emissive:0x6A4A00, emissiveIntensity:.25 }),
  rim:FM(0xB9B09E), pondBed:FM(0x7FA35A, { roughness:1 })
};
const rbox = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

/* ── BLUEPRINT: the farm's cells, village pieces. kind: model | lane | stall | cart | garden | hay | pond | mill | fountain | fence ── */
const B = (id, name, model, x, z, rot, extra = {}) => ({ id, cat:'building', gate:'lesson', name, kind:'model', model, x, z, rot, ...extra });
const Tr = (id, name, model, x, z, rot, h = 1.25) => ({ id, cat:'tree', gate:'vocab', name, kind:'model', model, x, z, rot, h, w:1 });
export const VILLAGE = [
  // ── ring 1 (centre 3×3): tavern + well + oak + lane + two vegetable beds ──
  { id:'tavern', cat:'building', gate:'lesson', name:'Tavern', kind:'tavern', model:'building_tavern_red', x:2, z:2, w:2, d:2, rot:20 },
  { id:'well', cat:'water', gate:'breathe', name:'Village well', kind:'model', model:'building_well_blue', x:4, z:2, rot:-25, fit:[1.05, .9] },
  Tr('oak1', 'Oak tree', 'tree_single_B', 4, 3, 20),
  { id:'lane3_4', cat:'path', gate:'todos', name:'Cobbled lane', kind:'lane', x:3, z:4 },
  // ── ring 2 ──
  B('cottage1', 'Cottage', 'building_home_A_red', 2, 1, 200),
  B('bakery', 'Bakery', 'building_home_B_yellow', 3, 1, 180),
  B('chapel', 'Chapel', 'building_church_blue', 4, 1, 210, { fit:[1.7, 1.02] }),
  { id:'watermill', cat:'water', gate:'breathe', name:'Water mill', kind:'mill', model:'building_watermill_blue', x:5, z:1, rot:90 },
  { id:'pond', cat:'water', gate:'breathe', name:'Reed pond', kind:'pond', x:5, z:4, reeds:true },
  Tr('pine1', 'Pine', 'tree_single_A', 5, 3, 0, 1.35),
  Tr('grove1', 'Fir grove', 'trees_B_small', 5, 5, 40, 1.05),
  // ── ring 3 ──
  { id:'fountain', cat:'special', gate:'gita', name:'Town fountain', kind:'fountain', x:0, z:5, w:2, d:2 },   // front-left corner: the hero stays in view
  B('windmill', 'Windmill', 'building_windmill_red', 2, 0, 160, { fit:[1.6, 1.0] }),
  B('tower', 'Watchtower', 'building_tower_A_blue', 4, 0, 200, { fit:[2.0, .95] }),
  B('smithy', 'Blacksmith', 'building_blacksmith_yellow', 6, 0, 230, { fit:[1.3, 1.05] }),
  B('townhouse', 'Townhouse', 'building_home_B_red', 6, 1, 250),
  { id:'lily', cat:'water', gate:'breathe', name:'Lily pond', kind:'pond', x:6, z:2 },
  Tr('poplar', 'Poplar', 'tree_high_round', 5, 0, 0, 1.5),
  Tr('grove2', 'Pine grove', 'trees_A_small', 6, 5, 10, 1.2),
  Tr('oak2', 'Oak tree', 'tree_single_B', 6, 6, 120),
  // Sudoku / Math → things that grow: vegetable beds (Quaternius crops) and hay meadows (haystacks pile up)
  ...[[2,4,'Lettuce'],[4,4,'Carrot'],[1,3,'Beet'],[1,4,'Lettuce'],[2,5,'Carrot'],[4,5,'Beet'],[6,3,'Lettuce']]
    .map(([x,z,c],i) => ({ id:'bed'+x+'_'+z, cat:'crop', gate:i%3===2?'mathtricks':'sudoku', name:({Lettuce:'Cabbage bed',Carrot:'Carrot bed',Beet:'Beet bed'})[c], kind:'garden', crop:c, x, z, stages:5 })),
  ...[[1,1],[6,4],[4,6]].map(([x,z],i) => ({ id:'hay'+x+'_'+z, cat:'crop', gate:i===1?'mathtricks':'sudoku', name:'Hay meadow', kind:'hay', x, z, stages:5 })),
  // To-dos → lanes, stalls, carts, lanterns, fences
  { id:'stall', cat:'path', gate:'todos', name:'Market stall', kind:'stall', x:1, z:2 },
  { id:'lantern5_2', cat:'path', gate:'todos', name:'Lantern lane', kind:'lane', lantern:true, x:5, z:2 },
  { id:'lane3_5', cat:'path', gate:'todos', name:'Cobbled lane', kind:'lane', x:3, z:5 },
  { id:'cart', cat:'path', gate:'todos', name:'Hay cart', kind:'cart', x:3, z:0 },
  { id:'lane2_6', cat:'path', gate:'todos', name:'Cobbled lane', kind:'lane', barrels:true, x:2, z:6 },
  { id:'lantern3_6', cat:'path', gate:'todos', name:'Lantern lane', kind:'lane', lantern:true, x:3, z:6 },
  { id:'fence1', cat:'path', gate:'todos', name:'Picket fence', kind:'fence', model:'fence', x:0, z:0, edge:'w', len:2 },
  { id:'fence2', cat:'path', gate:'todos', name:'Picket fence', kind:'fence', model:'fence', x:0, z:2, edge:'w', len:2 },
  { id:'hedge', cat:'path', gate:'todos', name:'Hedge', kind:'fence', model:'hedge', x:0, z:4, edge:'w', len:1 },
  { id:'wall', cat:'path', gate:'todos', name:'Stone wall', kind:'fence', model:'fence_stone_straight', x:5, z:6, edge:'s', len:2 }
];
export const VILLAGE_ORDER = ['tavern','bed2_4','oak1','well','lane3_4','bed4_4',
  'lane3_5','chapel','bed1_3','cottage1','grove1','stall','bed4_5','watermill','pine1','bed1_4','bakery','lantern5_2','hay1_1','pond','bed2_5',
  'fountain','lantern3_6','lily','fence1','poplar','windmill','bed6_3','townhouse','fence2','tower','lane2_6','grove2','hay6_4','oak2','hedge','hay4_6','smithy','cart','wall'];

/* pieces are fitted to their footprint (not true scale); the Animal-Crossing bump is a light 1.12× on 1×1 buildings, ?grow=a = 1× */
const pieceScale = s => S.grow !== 'c' || (s.w||1) > 1 || s.cat !== 'building' ? 1 : 1.12;

/* ── cobbled lane: a pale slab with a loose mosaic of rounded setts ── */
function cobbles(acc, r, half, n, y){
  const mats = [VMAT.cob1, VMAT.cob2, VMAT.cob3], step = 2*half/n;
  for (let i=0;i<n;i++) for (let j=0;j<n;j++){ if (r() < .12) continue;
    const x = -half + (i+.5)*step + (j%2 ? step*.35 : 0) + (r()-.5)*.02, z = -half + (j+.5)*step + (r()-.5)*.02, s = step*.44*(.85 + r()*.25);
    if (Math.abs(x) > half) continue;
    acc.add(new THREE.CylinderGeometry(s, s*1.1, .022, 6), mats[Math.floor(r()*3)], at(x, y, z, r()*3, 1, 1, .85 + r()*.3)); }
}
function buildLane(g, s){
  const acc = new Acc(), r = rngFrom(s.x*13 + s.z*29 + 3);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(.97, .035, .97), VMAT.lane); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
  cobbles(acc, r, .43, 6, .044);
  acc.into(g);
  if (s.lantern) vm(g, 'lantern', .62, .2, .33, .03, -.33);
  if (s.barrels) { vm(g, 'barrel', .2, .2, -.3, .03, -.28, .4); vm(g, 'crate_A_small', .14, .16, -.28, .03, -.06, .7); }
  if (!s.lantern && !s.barrels) g.userData.ghostMode = 'marker';
}
/* ── vegetable bed: plank-edged raised bed of soil, 3×3 crops from the farm kit ── */
const CROP = { Carrot:{k:.25}, Lettuce:{k:.28}, Beet:{k:.26, no1:true} };
/* stage → crop model: seedling, sprout, then the full plant filling out (3 = the pick-card look, so it reads at thumbnail size) */
function cropModel(crop, stage){ const st = Math.min(5, stage);
  if (st === 1 && CROP[crop].no1) return { name: crop+'_2', mul:.55 };
  return { name: crop+'_'+[0,1,2,4,4,4][st], mul:[0,1,1,.85,1,1.12][st] }; }
function fillGarden(plants, s, stage){
  plants.clear();
  const r = rngFrom(s.x*31 + s.z*7 + 5), c = CROP[s.crop], cm = cropModel(s.crop, stage);
  for (let i=0;i<3;i++) for (let j=0;j<3;j++){
    addModel(plants, cm.name, c.k*cm.mul*(S.grow==='c' ? 1.15 : 1)*(.92 + r()*.16), (i-1)*.25 + (r()-.5)*.03, .1, (j-1)*.25 + (r()-.5)*.03, r()*6.28, 'farm'); }
  if (stage >= 5) { vm(plants, 'crate_open', .16, .24, .36, .03, .36, -.6); }
  plants.userData.stage = stage;
}
function buildGarden(g, s, stage){
  const acc = new Acc();
  acc.add(rbox(.84, .07, .84), VMAT.bedSoil, at(0, .055, 0));
  [[0,-.42,0],[0,.42,0],[-.42,0,1],[.42,0,1]].forEach(([x,z,rot]) => acc.add(rbox(.9, .1, .06), VMAT.plank, at(x, .06, z, rot*Math.PI/2)));
  [[-.42,-.42],[.42,-.42],[-.42,.42],[.42,.42]].forEach(([x,z]) => acc.add(rbox(.08, .14, .08), VMAT.plankD, at(x, .07, z)));
  const bed = new THREE.Group(); acc.into(bed); bed.userData.ghostHide = true; g.add(bed);
  const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillGarden(plants, s, st);
  fillGarden(plants, s, stage);
}
/* ── hay meadow: mown stubble; haystacks pile up with each stage (1 tufts → 5 three stacks + a sack) ── */
const STACK_GEO = (() => { const pts = [[0,0],[.5,0],[.53,.3],[.46,.6],[.3,.85],[.1,.98],[0,1]].map(([x,y]) => new THREE.Vector2(x, y)); return new THREE.LatheGeometry(pts, 9); })();
function stack(acc, x, z, h, r, rot){ acc.add(STACK_GEO, VMAT.hay, at(x, .04, z, rot, r*2, h, r*2));
  acc.add(new THREE.CylinderGeometry(r*1.03, r*1.07, h*.1, 9), VMAT.hayD, at(x, .04 + h*.33, z, rot)); }
function fillHay(plants, s, stage){
  plants.clear(); const acc = new Acc(), r = rngFrom(s.x*17 + s.z*5 + 9), st = Math.min(5, stage);
  for (let i=0;i<(st === 1 ? 9 : 5);i++){ const x = (r()-.5)*.7, z = (r()-.5)*.7, h = .05 + r()*.04;
    acc.add(new THREE.ConeGeometry(.035, h, 5), VMAT.hay, at(x, .04 + h/2, z, r()*3)); }
  const H = [0, 0, .2, .3, .38, .44][st], R = [0, 0, .13, .17, .2, .22][st];
  if (st >= 2) stack(acc, -.12, .06, H, R, r()*3);
  if (st >= 3) stack(acc, .2, -.2, H*.82, R*.85, r()*3);
  if (st >= 5) stack(acc, .22, .26, H*.62, R*.7, r()*3);
  acc.into(plants);
  if (st >= 4) vm(plants, 'sack', .08, .16, -.32, .04, -.3, .6);
  plants.userData.stage = stage;
}
function buildHay(g, s, stage){
  const slab = new THREE.Mesh(new THREE.BoxGeometry(.9, .06, .9), VMAT.stubble); slab.position.y = .03; slab.castShadow = slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab);
  const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillHay(plants, s, st);
  fillHay(plants, s, stage);
}
/* ── ponds: stone rim, water, lilies, reeds (KayKit water plants) ── */
function buildPond(g, s){
  const acc = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 11);
  acc.add(new THREE.CylinderGeometry(.44, .46, .04, 28), VMAT.pondBed, at(0, .02, 0, 0, 1.05, 1, .95));
  acc.add(new THREE.CylinderGeometry(.37, .37, .02, 28), VMAT.water, at(0, .045, 0, 0, 1.05, 1, .95));
  for (let i=0;i<16;i++){ const a = i/16*Math.PI*2 + r()*.2, k = .065 + r()*.03;
    acc.add(new THREE.DodecahedronGeometry(k, 0), i%3 ? VMAT.rim : VMAT.cob3, at(Math.cos(a)*.41*1.05, .045, Math.sin(a)*.41*.95, r()*3, 1, .55, 1)); }
  acc.into(g);
  vm(g, 'waterlily_A', .02, .16, -.1, .05, .08, 1); vm(g, 'waterlily_B', .02, .2, .14, .05, -.1, 2.2);
  if (s.reeds) { vm(g, 'waterplant_C', .34, .3, -.26, .04, -.22, .3); vm(g, 'waterplant_B', .3, .2, .27, .04, .18, 1.2); vm(g, 'waterplant_B', .24, .18, .2, .04, .3, 2.6); }
  else { vm(g, 'waterplant_A', .18, .2, .3, .04, -.2, .5); vm(g, 'waterlily_A', .02, .14, .02, .05, -.16, 3); vm(g, 'rock_single_C', .1, .18, -.34, .03, .24, 1); }
}
/* ── water mill: the KayKit mill with its wheel dipping in a short stone-lined race ── */
function buildMill(g, s){
  const acc = new Acc();
  acc.add(rbox(.3, .04, .96), VMAT.water, at(.3, .03, 0));
  acc.add(rbox(.06, .08, .96), VMAT.rim, at(.47, .04, 0)); acc.add(rbox(.06, .08, .96), VMAT.rim, at(.13, .04, 0));
  const race = new THREE.Group(); acc.into(race); race.userData.ghostHide = true; g.add(race);
  vm(g, s.model, 1.5, .95, -.02, 0, 0, (s.rot||0)*Math.PI/180);
}
/* ── TAVERN (ring-1 hero): KayKit's barrel tavern on a cobbled yard with a bench, a lantern and a stack of kegs ── */
function buildTavern(g, s){
  const acc = new Acc(), r = rngFrom(222);
  acc.add(rbox(1.9, .035, 1.9), VMAT.lane, at(0, .0175, 0)); cobbles(acc, r, .92, 12, .044);
  const yard = new THREE.Group(); acc.into(yard); yard.userData.ghostHide = true; g.add(yard);
  vm(g, s.model, 1.75, 1.35, -.12, .03, -.12, (s.rot||0)*Math.PI/180);
  vm(g, 'lantern', .72, .2, .74, .03, -.62);
  vm(g, 'stall_bench', .15, .5, .72, .03, .2, 0);
  vm(g, 'barrel', .2, .2, -.66, .03, .7); vm(g, 'barrel', .2, .2, -.44, .03, .76, .5); vm(g, 'barrel', .19, .19, -.55, .23, .72, 1);
  vm(g, 'crate_A_big', .2, .2, .7, .03, .74, .3); vm(g, 'flag_red', .45, .2, .78, .03, -.2, -.3);
}
/* ── TOWN FOUNTAIN (Gita): the heart of the square. A cobbled plaza, Kenney's round basin, a two-tier stone spire with
   water in both bowls and a gold finial, four lanterns, two benches and flower tubs. ── */
function buildFountain(g){
  const acc = new Acc(), r = rngFrom(404);
  acc.add(new THREE.CylinderGeometry(.93, .95, .05, 40), VMAT.plaza, at(0, .025, 0));
  for (let i=0;i<70;i++){ const a = r()*6.28, d = .66 + r()*.24; const s = .06*(.8 + r()*.4);
    acc.add(new THREE.CylinderGeometry(s, s*1.06, .02, 6), r()<.5 ? VMAT.stoneL : VMAT.stoneD, at(Math.cos(a)*d, .055, Math.sin(a)*d, r()*3)); }
  // spire: pedestal → lower bowl → column → upper bowl → finial
  const col = (y, h, r0, r1, m = VMAT.stoneL, seg = 10) => acc.add(new THREE.CylinderGeometry(r1, r0, h, seg).translate(0, h/2, 0), m, at(0, y, 0));
  col(.05, .34, .13, .1); col(.36, .07, .12, .3); col(.43, .02, .27, .27, VMAT.water, 20);
  col(.43, .26, .07, .055); col(.66, .05, .06, .17); col(.71, .015, .15, .15, VMAT.water, 16);
  col(.7, .16, .045, .035); acc.add(new THREE.SphereGeometry(.055, 10, 8), VMAT.gold, at(0, .9, 0));
  acc.add(new THREE.ConeGeometry(.035, .1, 8), VMAT.gold, at(0, .98, 0));
  // spouts: little arcs of water drops falling from the lower bowl
  for (let i=0;i<8;i++){ const a = i/8*Math.PI*2; for (let j=0;j<3;j++){ const d = .31 + j*.07, y = .41 - j*j*.05;
    acc.add(new THREE.SphereGeometry(.018 - j*.003, 6, 5), VMAT.water, at(Math.cos(a)*d, y, Math.sin(a)*d)); } }
  acc.into(g);
  const basin = vm(g, 'fountain_round_detail', .3, 1.3, 0, .05, 0); if (basin) basin.scale.y *= 1.25;
  [[-.72,-.72],[.72,-.72],[-.72,.72],[.72,.72]].forEach(([x,z]) => vm(g, 'lantern', .72, .2, x, .05, z));
  vm(g, 'stall_bench', .15, .5, 0, .05, -.82, Math.PI/2); vm(g, 'stall_bench', .15, .5, -.82, .05, 0, 0);
  [[.62,.82],[.82,.6]].forEach(([x,z],i) => { const t = new THREE.Group(); t.position.set(x, .05, z); g.add(t);
    vm(t, 'barrel', .12, .15, 0, 0, 0); addModel(t, i ? 'Flower_3_Group' : 'Flower_4_Group', .22, 0, .1, 0, i, 'a'); });
  vm(g, 'flag_blue', .45, .2, .05, .05, .86, -.4);
}

export default {
  id:'village', name:'Village', title:'Your village',
  season:4, dates:'13–26 Oct', nextIn:9,
  kits:['a', VK, 'farm'],      // kit a first: meadow tufts come from the shared MegaKit; village pieces pass kit 'village'
  kitDefs:{ [VK]:{ file:'assets/village/village.glb' } },
  families:{
    water:   { label:'wells & ponds',        tag:'Water' },
    building:{ label:'houses',               tag:'Building' },
    path:    { label:'lanes & stalls',       tag:'Path' },
    crop:    { label:'gardens & hay',        tag:'Field' },
    tree:    { label:'oaks & pines',         tag:'Tree' },
    special: { label:'the town fountain',    tag:'Special' }
  },
  slots:VILLAGE, order:VILLAGE_ORDER,
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M4.5 12h9v7.5h-9z" fill="#F3E9D8"/><path d="M3 12.6 9 6.4l6 6.2z" fill="#D9463B"/><path d="M15.5 9h4.5v10.5h-4.5z" fill="#A9A2B6"/><path d="M15 9.4 17.75 5l2.75 4.4z" fill="#3E7CC9"/><path d="M7.6 19.5v-3.6h2.8v3.6" fill="#8C5A3A"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M10 118V78l22-18 22 18v40z"/><path d="M50 118V68l26-22 26 22v50z"/><path d="M92 118V86l14-12 14 12v32z"/><rect x="70" y="30" width="8" height="18"/></g>',
  album:{ image:'assets/village/album.jpg' },

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'model') {
      const [h, w] = s.fit || (s.cat === 'tree' ? [s.h, s.w] : [1.5, .82]);
      const m = vm(g, s.model, h, w, 0, 0, 0, (s.rot||0)*Math.PI/180); if (m) m.scale.multiplyScalar(pieceScale(s));
    }
    else if (s.kind === 'lane') buildLane(g, s);
    else if (s.kind === 'garden') buildGarden(g, s, stage);
    else if (s.kind === 'hay') buildHay(g, s, stage);
    else if (s.kind === 'pond') buildPond(g, s);
    else if (s.kind === 'mill') buildMill(g, s);
    else if (s.kind === 'fountain') buildFountain(g);
    else if (s.kind === 'tavern') buildTavern(g, s);
    else if (s.kind === 'stall') {
      const slab = new THREE.Group(); buildLane(slab, { x:s.x, z:s.z }); slab.userData.ghostHide = true; g.add(slab);
      vm(g, 'stall_red', .85, .78, -.04, .03, .02, Math.PI/2 + .25);
      vm(g, 'crate_open', .15, .22, .3, .03, .32, .3); vm(g, 'barrel', .19, .19, -.33, .03, .34, 0);
    } else if (s.kind === 'cart') {
      vm(g, 'cart_high', .5, .82, 0, 0, 0, .7); vm(g, 'sack', .08, .18, .34, .02, .32, 1.1); vm(g, 'resource_lumber', .1, .3, -.3, .02, .34, .3);
    } else if (s.kind === 'fence') {
      const t = tplOf(s.model), k = t ? 1.02 / Math.max(t.size.x, t.size.z) : 1;
      for (let i=0;i<s.len;i++){
        const o = i - (s.len-1)/2;
        if (s.edge === 'w') addModel(g, s.model, k, -.45, 0, o, 0, VK);
        else addModel(g, s.model, k, o, 0, .45, Math.PI/2, VK);
      }
      const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
    }
  },
  scaleOf: s => S.grow !== 'c' ? 1 : s.kind === 'garden' ? 1.15 : pieceScale(s),
  contact: s => ['model', 'stall', 'cart', 'mill', 'tavern'].includes(s.kind),
  nightLamp: s => s.cat === 'building' || s.kind === 'tavern' || s.cat === 'special' || !!s.lantern || s.id === 'well' || s.id === 'watermill',
  decor(slots){ meadowDecor(slots, { tuft: r => { const q = r(); return q < .5 ? ['Grass_Common_Short', 0] : q < .88 ? ['Grass_Wispy_Short', 0] : [q < .94 ? 'Flower_3_Single' : 'Flower_4_Single', .16]; }, flowers:false }); },
  ambient(){ addButterflies(); },
  tick(t){ flyButterflies(t); },

  // no villagers (out of scope): the animals a village keeps move in — horses, a donkey, a sheep, the village dog
  residents:[ {id:'Horse',name:'Horse',h:.8,at:[0.2,0.5],face:.5}, {id:'Sheep',name:'Sheep',h:.45,at:[0.25,2.6],face:2.5,walk:'Jump',file:'assets/farm/Sheep.glb'},
              {id:'Donkey',name:'Donkey',h:.62,at:[0.15,3.75],face:.6}, {id:'ShibaInu',name:'Village dog',h:.5,at:[1.05,0.15],face:2.4},
              {id:'Horse_White',name:'White horse',h:.8,at:[5.15,6.2],face:-.7} ],
  async preload(){ if (!ANIMCACHE.__sheep) ANIMCACHE.__sheep = await loadAnimal(this.residents[1]); },
  residentThumb(d, thumbFor){
    if (d.id !== 'Sheep') return 'assets/thumbs/' + d.id + '.png';
    const gltf = ANIMCACHE.__sheep; if (!gltf) return '';
    return thumbFor('anim:Sheep', () => { const o = SkeletonUtils.clone(gltf.scene); const mx = new THREE.AnimationMixer(o);
      const c = gltf.animations.find(x => /Idle/.test(x.name)); if (c) { mx.clipAction(c).play(); mx.update(.4); } o.rotation.y = -.35 + Math.PI/2; return o; }, 168);
  }
};
