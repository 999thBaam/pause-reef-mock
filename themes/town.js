/* LITTLE TOWN (?theme=town) — a cozy modern small town on the farm's 7×7 ring blueprint (same cells, same ring counts
   6 / 15 / 19), so rings, pick-3, growth and expansion behave exactly like the farm.
   Shops, library, school, water tower, road tiles, benches, street lamps, hydrants = KayKit City Builder Bits 1.0 (CC0);
   houses, street trees = Kenney City Kit Suburban; taxi/van/sedan + wheels = Kenney Car Kit; cones, barriers, site lamp =
   Kenney City Kit Roads; café parasols = Kenney City Kit Commercial (all CC0), packed to assets/town/town.glb.
   Garden beds grow the Quaternius crops in the farm kit; park trees + meadow tufts are the shared MegaKit (kit a).
   Sidewalks, the construction sites (rise floor by floor), fountain, ponds, ducks, bus stop, picket fences, hedges,
   the clock tower, the bus and the cyclist are procedural flat-shaded geometry, merged per material (Acc). */
import * as THREE from 'three';
import { rngFrom } from '../engine/scene.js';
import { S, V, placed, cropStage, hooks, AMBIENT } from '../engine/state.js';
import { edgeCentre, cellPos, TILE_TOP } from '../engine/grid.js';
import { KITCACHE, ANIMCACHE, addModel, fitScale, loadAnimal } from '../engine/kit.js';
import { Acc } from '../engine/proc.js';
import { world } from '../engine/scene.js';
import { tween, sparkle } from '../engine/motion.js';
import { meadowDecor } from '../engine/life.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const TK = 'town';
const tplOf = n => KITCACHE[TK] && KITCACHE[TK][n];
/* place a town-kit model fitted to [h, w] tiles (KayKit and the Kenney kits use different units) */
function tm(g, name, h, w, x=0, y=0, z=0, rot=0){ const t = tplOf(name); if (!t) { console.warn('missing', name); return null; }
  return addModel(g, name, fitScale(t, h, w), x, y, z, rot, TK); }
/* fixed-k placement for families that must stay the same size (roads, cars) */
const km = (g, name, k, x=0, y=0, z=0, rot=0) => tplOf(name) ? addModel(g, name, k, x, y, z, rot, TK) : null;
const KK = .485;          // KayKit: one road tile = 2 units → just under one plot tile
const CAR_K = .17;        // Kenney car kit: a 2.75-unit car ≈ .47 tiles, same as KayKit's cars at KK

const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.9, metalness:0, flatShading:true, ...o });
const TMAT = {
  walk:FM(0xE4DCCD, { roughness:1 }), walkD:FM(0xCFC5B3, { roughness:1 }), curb:FM(0xBDB4A6),
  water:new THREE.MeshStandardMaterial({ color:0x5CC3E6, roughness:.15, metalness:0, emissive:0x0E4660, emissiveIntensity:.35 }),
  stone:FM(0xF1ECE2), stoneD:FM(0xC9C1B2), rim:FM(0xD8D0C0), pondBed:FM(0x7FAF5A, { roughness:1 }),
  plank:FM(0xB0764A), plankD:FM(0x8A5634), soil:FM(0x6E4428, { roughness:1 }), dirt:FM(0xB98E5E, { roughness:1 }),
  conc:FM(0xD7D3CB), concD:FM(0xAFA99F), scaf:FM(0xF2A93B), scafD:FM(0xD9822B), glass:FM(0x9FD4EE, { roughness:.3 }),
  white:FM(0xFFFFFF), picket:FM(0xFBF7EE), hedge:FM(0x5DAA4A), hedgeD:FM(0x4A9140),
  brick:FM(0xE07A5F), brickD:FM(0xC4654D), roofT:FM(0x3FA7A0), roofTD:FM(0x2F8C86), gold:FM(0xF4C84A, { emissive:0x6A4A00, emissiveIntensity:.25 }),
  face:FM(0xFFF8E7, { emissive:0x5A4A20, emissiveIntensity:.12 }), ink:FM(0x2E3440), metal:FM(0x8E9AAB), blue:FM(0x3E7CC9), red:FM(0xE2574C),
  duck:FM(0xFFFFFF), beak:FM(0xF39A2B), lily:FM(0x6FB84A), bloom:FM(0xF7A1C4),
  bus:FM(0xF6C544), busD:FM(0xE0A92E), busWin:FM(0x2F4A63, { roughness:.4 }), tyre:FM(0x33363D),
  shirt:FM(0x49A7E8), skin:FM(0xF2C5A0), hair:FM(0x5A3A26), bird:FM(0x5B6472), birdW:FM(0xF2F2F2)
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/* Kenney suburban houses all have the same mint roof: give each one its own roof colour (toy-town variety) */
const ROOF_GREEN = [97, 203, 139], ROOFTEX = new Map(), ROOFMAT = new Map();
function roofTex(tex, hex){
  const key = tex.uuid + hex; if (ROOFTEX.has(key)) return ROOFTEX.get(key);
  const im = tex.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  const T = new THREE.Color(hex); const tr = T.r*255, tg = T.g*255, tb = T.b*255;
  for (let i=0;i<a.length;i+=4){ const dr = a[i]-ROOF_GREEN[0], dg = a[i+1]-ROOF_GREEN[1], db = a[i+2]-ROOF_GREEN[2];
    if (dr*dr + dg*dg + db*db < 1600) { const k = (a[i]+a[i+1]+a[i+2]) / (ROOF_GREEN[0]+ROOF_GREEN[1]+ROOF_GREEN[2]); a[i] = Math.min(255, tr*k); a[i+1] = Math.min(255, tg*k); a[i+2] = Math.min(255, tb*k); } }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  t.magFilter = tex.magFilter; t.minFilter = tex.minFilter;
  ROOFTEX.set(key, t); return t;
}
function tintRoof(g, hex){ if (!g) return; g.traverse(o => { if (!o.isMesh || !o.material.map) return; const key = o.material.uuid + hex;
  if (!ROOFMAT.has(key)) { const m2 = o.material.clone(); m2.map = roofTex(o.material.map, hex); ROOFMAT.set(key, m2); } o.material = ROOFMAT.get(key); }); }

/* ── BLUEPRINT: the farm's cells, town pieces ── */
const B = (id, name, model, x, z, rot, extra = {}) => ({ id, cat:'building', gate:'lesson', name, kind:'model', model, x, z, rot, ...extra });
const Tr = (id, name, x, z, rot, extra = {}) => ({ id, cat:'tree', gate:'vocab', name, kind:'tree', x, z, rot, ...extra });
export const TOWN = [
  // ── ring 1 (centre 3×3): corner café + fountain + street tree + road + a garden bed + a building site ──
  { id:'cafe', cat:'building', gate:'lesson', name:'Corner café', kind:'cafe', x:2, z:2, w:2, d:2 },
  { id:'fountain', cat:'water', gate:'breathe', name:'Park fountain', kind:'fountain', x:4, z:2 },
  Tr('tree4_3', 'Street tree', 4, 3, 0, { street:true }),
  { id:'road3_4', cat:'path', gate:'todos', name:'Main street', kind:'road', x:3, z:4 },
  // ── ring 2 ──
  B('bakery', 'Bakery', 'kk_building_A_withoutBase', 2, 1, 0, { fit:[1.2, .9] }),
  B('bookshop', 'Bookshop', 'kk_building_G_withoutBase', 3, 1, 0),
  B('library', 'Library', 'kk_building_H_withoutBase', 4, 1, 0),
  { id:'watertower', cat:'water', gate:'breathe', name:'Water tower', kind:'model', model:'kk_watertower', x:5, z:1, rot:20, fit:[1.35, .8] },
  { id:'duckpond', cat:'water', gate:'breathe', name:'Duck pond', kind:'pond', ducks:true, x:5, z:4 },
  Tr('tree5_3', 'Park tree', 5, 3, 30, { model:'CommonTree_1' }),
  Tr('tree5_5', 'Park tree', 5, 5, 200, { model:'CommonTree_2' }),
  // ── ring 3 ──
  { id:'clock', cat:'special', gate:'gita', name:'Clock tower', kind:'clock', x:0, z:5, w:2, d:2 },   // front-left corner: the hero stays in view
  B('school', 'School', 'kk_building_C_withoutBase', 2, 0, 0),
  { id:'house4_0', cat:'building', gate:'lesson', name:'Blue house', kind:'house', model:'sub_building-type-a', roof:0x5B8FE0, x:4, z:0, rot:0 },
  { id:'house6_1', cat:'building', gate:'lesson', name:'Yellow house', kind:'house', model:'sub_building-type-c', roof:0xF2B33D, x:6, z:1, rot:-90 },
  { id:'lily', cat:'water', gate:'breathe', name:'Lily pond', kind:'pond', x:6, z:2 },
  Tr('tree5_0', 'Street tree', 5, 0, 0, { street:true }),
  Tr('tree6_0', 'Park tree', 6, 0, 120, { model:'CommonTree_5' }),
  Tr('tree6_5', 'Park tree', 6, 5, 60, { model:'CommonTree_1' }),
  Tr('tree6_6', 'Street tree', 6, 6, 0, { street:true, small:true }),
  // Sudoku / Math → things that grow: community garden beds (Quaternius crops) and building sites that rise floor by floor
  ...[[2,4,'Lettuce'],[1,3,'Carrot'],[1,1,'Beet'],[2,5,'Lettuce'],[4,5,'Carrot'],[6,4,'Beet'],[4,6,'Lettuce']]
    .map(([x,z,c],i) => ({ id:'garden'+x+'_'+z, cat:'crop', gate:i%3===2?'mathtricks':'sudoku', name:'Community garden', kind:'garden', crop:c, x, z, stages:5 })),
  ...[[4,4,'kk_building_D_withoutBase'],[1,4,'kk_building_B_withoutBase'],[6,3,'kk_building_F_withoutBase']]
    .map(([x,z,m],i) => ({ id:'build'+x+'_'+z, cat:'crop', gate:i===1?'mathtricks':'sudoku', name:'Building site', kind:'site', model:m, x, z, stages:5 })),
  // To-dos → roads, crossings, bus stop, lamps & benches, bike racks, picket fences, hedges
  { id:'road3_5', cat:'path', gate:'todos', name:'Zebra crossing', kind:'road', crossing:true, x:3, z:5 },
  { id:'road3_6', cat:'path', gate:'todos', name:'Main street', kind:'road', x:3, z:6 },
  { id:'road3_0', cat:'path', gate:'todos', name:'Back street', kind:'road', sign:true, x:3, z:0 },
  { id:'busstop', cat:'path', gate:'todos', name:'Bus stop', kind:'busstop', x:1, z:2 },
  { id:'lamps5_2', cat:'path', gate:'todos', name:'Lamp & bench', kind:'lamps', x:5, z:2 },
  { id:'bikes2_6', cat:'path', gate:'todos', name:'Bike rack', kind:'bikes', x:2, z:6 },
  { id:'fence1', cat:'path', gate:'todos', name:'Picket fence', kind:'fence', x:0, z:2, edge:'w', len:2 },
  { id:'fence2', cat:'path', gate:'todos', name:'Hedge', kind:'hedge', x:0, z:4, edge:'w', len:2 },
  { id:'fence3', cat:'path', gate:'todos', name:'Picket fence', kind:'fence', x:0, z:0, edge:'w', len:2 },
  { id:'fence4', cat:'path', gate:'todos', name:'Hedge', kind:'hedge', x:5, z:6, edge:'s', len:2 }
];
export const TOWN_ORDER = ['cafe','garden2_4','tree4_3','fountain','road3_4','build4_4',
  'road3_5','bakery','garden1_3','bookshop','tree5_5','busstop','garden4_5','watertower','tree5_3','build1_4','library','lamps5_2','garden1_1','duckpond','garden2_5',
  'clock','road3_6','lily','fence1','tree5_0','school','build6_3','tree6_0','fence2','house4_0','bikes2_6','tree6_5','garden6_4','house6_1','fence3','garden4_6','tree6_6','road3_0','fence4'];

/* 1×1 buildings get a light Animal-Crossing bump (1.1×), ?grow=a = 1× */
const pieceScale = s => S.grow !== 'c' || (s.w||1) > 1 || s.cat !== 'building' ? 1 : 1.1;

/* ── sidewalk slab: warm pavers with a curb ── */
function sidewalk(acc, half = .485, y = 0, r = rngFrom(3)){
  acc.add(box(half*2, .04, half*2), TMAT.curb, at(0, y + .02, 0));
  const n = Math.round(half*2/.24), step = (half*2 - .04)/n;
  for (let i=0;i<n;i++) for (let j=0;j<n;j++)
    acc.add(box(step - .018, .012, step - .018), r() < .22 ? TMAT.walkD : TMAT.walk, at(-half + .02 + (i+.5)*step, y + .046, -half + .02 + (j+.5)*step));
}
/* ── road: KayKit tile, lines along z (the main street runs toward the viewer) ── */
function buildRoad(g, s){
  km(g, s.crossing ? 'kk_road_straight_crossing' : 'kk_road_straight', KK, 0, 0, 0, Math.PI/2);
  if (s.sign) { tm(g, 'rd_road-sign-street', .42, .2, -.4, 0, .38, Math.PI/2); tm(g, 'rd_construction-cone', .09, .08, .38, .05, -.36); }
  g.userData.ghostMode = 'marker';
}
/* ── community garden: plank-edged raised bed, 3×3 crops from the farm kit, a watering can when ripe ── */
const CROP = { Carrot:{k:.25}, Lettuce:{k:.28}, Beet:{k:.26, no1:true} };
function cropModel(crop, stage){ const st = Math.min(5, stage);
  if (st === 1 && CROP[crop].no1) return { name: crop+'_2', mul:.55 };
  return { name: crop+'_'+[0,1,2,4,4,4][st], mul:[0,1,1,.85,1,1.12][st] }; }
function fillGarden(plants, s, stage){
  plants.clear();
  const r = rngFrom(s.x*31 + s.z*7 + 5), c = CROP[s.crop], cm = cropModel(s.crop, stage);
  for (let i=0;i<3;i++) for (let j=0;j<3;j++)
    addModel(plants, cm.name, c.k*cm.mul*(S.grow==='c' ? 1.15 : 1)*(.92 + r()*.16), (i-1)*.25 + (r()-.5)*.03, .1, (j-1)*.25 + (r()-.5)*.03, r()*6.28, 'farm');
  if (stage >= 5) { const acc = new Acc(); acc.add(new THREE.CylinderGeometry(.045, .05, .08, 10), TMAT.blue, at(.36, .1, .38));
    acc.add(new THREE.CylinderGeometry(.008, .012, .09, 6), TMAT.blue, at(.41, .14, .38, 0, 1, 1, 1, 0, -1)); acc.into(plants); }
  plants.userData.stage = stage;
}
function buildGarden(g, s, stage){
  const acc = new Acc();
  acc.add(box(.84, .07, .84), TMAT.soil, at(0, .055, 0));
  [[0,-.42,0],[0,.42,0],[-.42,0,1],[.42,0,1]].forEach(([x,z,rot]) => acc.add(box(.9, .1, .06), TMAT.plank, at(x, .06, z, rot*Math.PI/2)));
  [[-.42,-.42],[.42,-.42],[-.42,.42],[.42,.42]].forEach(([x,z]) => acc.add(box(.08, .14, .08), TMAT.plankD, at(x, .07, z)));
  const bed = new THREE.Group(); acc.into(bed); bed.userData.ghostHide = true; g.add(bed);
  const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillGarden(plants, s, st);
  fillGarden(plants, s, stage);
}
/* ── building site (grows): 1 fenced dirt lot → 2 foundation + scaffold → 3/4 floors rise in concrete + scaffold → 5 the finished KayKit building ── */
function fillSite(plants, s, stage){
  plants.clear(); const st = Math.min(5, stage), acc = new Acc(), r = rngFrom(s.x*19 + s.z*3);
  if (st >= 5) {
    const m = tm(plants, s.model, 1.3, .9, 0, 0, 0, 0); if (m) m.scale.multiplyScalar(pieceScale({ cat:'building' }));
    plants.userData.stage = stage; return;
  }
  acc.add(box(.9, .04, .9), TMAT.dirt, at(0, .02, 0));
  if (st === 1) { for (let i=0;i<4;i++) acc.add(new THREE.DodecahedronGeometry(.06 + r()*.03, 0), TMAT.dirt, at((r()-.5)*.5, .05, (r()-.5)*.5, r()*3, 1, .6, 1));
    acc.into(plants);
    tm(plants, 'rd_construction-barrier', .12, .34, 0, .04, .36, 0); tm(plants, 'rd_construction-cone', .1, .08, -.34, .04, .34);
    tm(plants, 'rd_construction-cone', .1, .08, .34, .04, -.3); tm(plants, 'kk_box_A', .1, .12, -.2, .04, -.25, .5);
    plants.userData.stage = stage; return; }
  const floors = st - 1, FH = .26, W = .66, D = .6;       // 1, 2, 3 floors
  acc.add(box(W + .06, .06, D + .06), TMAT.concD, at(0, .07, 0));
  for (let f=0; f<floors; f++){ const y = .1 + f*FH;
    acc.add(box(W, .035, D), TMAT.conc, at(0, y + FH - .02, 0));
    [[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1]].forEach(([a,b]) => acc.add(box(.05, FH, .05), TMAT.conc, at(a*(W/2 - .03), y + FH/2, b*(D/2 - .03))));
    if (f < floors - 1) acc.add(box(W - .08, FH - .05, D - .08), TMAT.glass, at(0, y + FH/2, 0));
  }
  // orange scaffold on the front (+z) and side (+x): poles + boards per floor
  const top = .1 + floors*FH + .08;
  [-.36, 0, .36].forEach(x => acc.add(box(.018, top, .018), TMAT.scaf, at(x, top/2, D/2 + .08)));
  [-.33, 0, .33].forEach(z => acc.add(box(.018, top, .018), TMAT.scaf, at(W/2 + .08, top/2, z)));
  for (let f=1; f<=floors; f++){ const y = .1 + f*FH - .03;
    acc.add(box(.76, .02, .08), TMAT.scafD, at(0, y, D/2 + .08)); acc.add(box(.08, .02, .7), TMAT.scafD, at(W/2 + .08, y, 0)); }
  acc.into(plants);
  tm(plants, 'rd_construction-cone', .1, .08, -.38, .04, .4); tm(plants, 'rd_construction-light', .16, .08, .4, .04, .42);
  if (st >= 3) { const c = new THREE.Group(); const a2 = new Acc(); const H = top + .25;          // little tower crane
    a2.add(box(.05, H, .05), TMAT.scaf, at(-.36, H/2, -.34)); a2.add(box(.62, .04, .04), TMAT.scaf, at(-.1, H, -.34));
    a2.add(box(.1, .08, .08), TMAT.concD, at(-.44, H - .02, -.34)); a2.add(box(.006, .2, .006), TMAT.ink, at(.16, H - .1, -.34));
    a2.add(box(.06, .04, .06), TMAT.scafD, at(.16, H - .21, -.34)); a2.into(c); plants.add(c); }
  plants.userData.stage = stage;
}
function buildSite(g, s, stage){
  const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillSite(plants, s, st);
  fillSite(plants, s, stage);
}
/* ── ponds: grassy rim, stones, water, lilies (and a pair of ducks on the duck pond) ── */
function duck(acc, x, z, rot, k = 1){
  acc.add(new THREE.SphereGeometry(.05*k, 10, 8), TMAT.duck, at(x, .085, z, rot, 1.35, .8, 1));
  acc.add(new THREE.SphereGeometry(.028*k, 8, 6), TMAT.duck, at(x + Math.sin(rot)*.045*k, .13, z + Math.cos(rot)*.045*k));
  acc.add(new THREE.ConeGeometry(.012*k, .03*k, 6).rotateX(Math.PI/2), TMAT.beak, at(x + Math.sin(rot)*.075*k, .128, z + Math.cos(rot)*.075*k, rot));
}
function buildPond(g, s){
  const acc = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 11);
  acc.add(new THREE.CylinderGeometry(.45, .47, .04, 28), TMAT.pondBed, at(0, .02, 0, 0, 1.03, 1, .95));
  acc.add(new THREE.CylinderGeometry(.38, .38, .02, 28), TMAT.water, at(0, .045, 0, 0, 1.03, 1, .95));
  for (let i=0;i<16;i++){ const a = i/16*Math.PI*2 + r()*.2, k = .06 + r()*.03;
    acc.add(new THREE.DodecahedronGeometry(k, 0), i%3 ? TMAT.rim : TMAT.stoneD, at(Math.cos(a)*.42*1.03, .045, Math.sin(a)*.42*.95, r()*3, 1, .55, 1)); }
  const pads = s.ducks ? [[-.18,.15],[.2,-.2]] : [[-.15,.1],[.14,-.14],[.2,.16],[-.05,-.2]];
  pads.forEach(([x,z],i) => { acc.add(new THREE.CylinderGeometry(.06, .06, .01, 12), TMAT.lily, at(x, .058, z, i));
    if (i%2 === 0) acc.add(new THREE.SphereGeometry(.022, 8, 6), TMAT.bloom, at(x, .07, z)); });
  if (s.ducks) { duck(acc, .05, .06, .8, 1.25); duck(acc, -.12, -.12, 2.2, 1); }
  acc.into(g);
  addModel(g, 'Grass_Wispy_Tall', .16, -.34, .04, -.26, .3, 'a'); addModel(g, 'Grass_Wispy_Tall', .13, .36, .04, .2, 1.2, 'a');
}
/* ── park fountain: a round white basin, water, a column with a bowl and a spray ── */
function buildFountain(g, k = 1){
  const acc = new Acc();
  const col = (y, h, r0, r1, m = TMAT.stone, seg = 16) => acc.add(new THREE.CylinderGeometry(r1*k, r0*k, h*k, seg).translate(0, h*k/2, 0), m, at(0, y*k, 0));
  col(0, .04, .46, .46, TMAT.walkD, 24);
  col(.04, .12, .4, .4, TMAT.stone, 28); col(.14, .02, .35, .35, TMAT.water, 28);
  col(.04, .34, .07, .055); col(.36, .05, .06, .17); col(.4, .012, .15, .15, TMAT.water, 16);
  col(.4, .1, .03, .02, TMAT.water, 8);
  for (let i=0;i<8;i++){ const a = i/8*Math.PI*2; for (let j=0;j<3;j++){ const d = (.18 + j*.05)*k, y = (.38 - j*j*.045)*k;
    acc.add(new THREE.SphereGeometry((.016 - j*.003)*k, 6, 5), TMAT.water, at(Math.cos(a)*d, y, Math.sin(a)*d)); } }
  acc.into(g);
}
/* ── bus stop: sidewalk, a glass shelter with a teal roof, a bench and the stop sign ── */
function buildBusStop(g){
  const acc = new Acc(); sidewalk(acc, .485, 0, rngFrom(8));
  acc.add(box(.62, .03, .3), TMAT.roofT, at(0, .5, -.1)); acc.add(box(.62, .36, .012), TMAT.glass, at(0, .28, -.25));
  [[-.3,-.24],[.3,-.24],[-.3,.04],[.3,.04]].forEach(([x,z]) => acc.add(box(.03, .46, .03), TMAT.metal, at(x, .28, z)));
  acc.add(box(.5, .03, .1), TMAT.plank, at(0, .17, -.17)); acc.add(box(.03, .12, .03), TMAT.metal, at(-.2, .1, -.17)); acc.add(box(.03, .12, .03), TMAT.metal, at(.2, .1, -.17));
  acc.add(new THREE.CylinderGeometry(.012, .012, .5, 6), TMAT.metal, at(.4, .3, .32));
  acc.add(new THREE.CylinderGeometry(.075, .075, .015, 16).rotateX(Math.PI/2), TMAT.red, at(.4, .56, .32, Math.PI/4));
  acc.add(box(.07, .02, .006), TMAT.white, at(.4, .56, .32, Math.PI/4));
  acc.into(g);
}
/* ── lamp & bench corner: sidewalk, KayKit streetlight + bench + bin, a blue mailbox ── */
function buildLamps(g){
  const acc = new Acc(); sidewalk(acc, .485, 0, rngFrom(9));
  acc.add(box(.1, .16, .08), TMAT.blue, at(.3, .13, .32)); acc.add(new THREE.CylinderGeometry(.05, .05, .08, 12, 1, false, 0, Math.PI).rotateZ(Math.PI/2).rotateY(Math.PI/2), TMAT.blue, at(.3, .21, .32));
  acc.add(box(.02, .1, .02), TMAT.ink, at(.3, .03, .32));
  acc.into(g);
  km(g, 'kk_streetlight', KK*1.1, -.32, .05, -.32, Math.PI/4);
  km(g, 'kk_bench', KK*1.1, -.05, .05, -.3, 0); km(g, 'kk_trash_A', KK*1.2, .3, .05, -.3, 0);
}
/* ── bike rack: sidewalk, three hoops, two parked bikes, a hydrant ── */
function buildBikes(g){
  const acc = new Acc(); sidewalk(acc, .485, 0, rngFrom(10));
  for (let i=0;i<3;i++) acc.add(new THREE.TorusGeometry(.07, .01, 6, 16, Math.PI), TMAT.metal, at(-.25 + i*.2, .05, -.1));
  acc.into(g);
  const b1 = makeBike(false); b1.position.set(-.15, .05, -.1); b1.rotation.y = Math.PI/2; g.add(b1);
  const b2 = makeBike(false, 0xE2574C); b2.position.set(.05, .05, -.1); b2.rotation.y = Math.PI/2; g.add(b2);
  km(g, 'kk_firehydrant', KK*1.3, .33, .05, .3, .4);
  addModel(g, 'Flower_3_Group', .2, -.3, .05, .3, 0, 'a');
}
/* ── picket fence + hedge (edge pieces) ── */
function buildFence(g, s){
  const acc = new Acc();
  for (let i=0;i<s.len;i++){ const o = i - (s.len-1)/2;
    for (let p=0;p<8;p++){ const t = o - .44 + p*.126, y = .14;
      const post = box(.035, .2, .02), tip = new THREE.ConeGeometry(.025, .05, 4);
      if (s.edge === 'w') { acc.add(post, TMAT.picket, at(-.45, y, t, Math.PI/2)); acc.add(tip, TMAT.picket, at(-.45, .265, t, Math.PI/4)); }
      else { acc.add(post, TMAT.picket, at(t, y, .45)); acc.add(tip, TMAT.picket, at(t, .265, .45, Math.PI/4)); } }
    [.08, .19].forEach(y => { if (s.edge === 'w') acc.add(box(.018, .03, .98), TMAT.picket, at(-.43, y + .04, o)); else acc.add(box(.98, .03, .018), TMAT.picket, at(o, y + .04, .43)); });
  }
  acc.into(g);
  const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}
function buildHedge(g, s){
  const acc = new Acc(), r = rngFrom(s.x*5 + s.z*11 + 3);
  for (let i=0;i<s.len;i++){ const o = i - (s.len-1)/2;
    for (let p=0;p<5;p++){ const t = o - .4 + p*.2, h = .22 + r()*.05;
      const geo = new THREE.IcosahedronGeometry(.13, 1);
      if (s.edge === 'w') acc.add(geo, p%2 ? TMAT.hedge : TMAT.hedgeD, at(-.43, h*.55, t, r()*3, .9, h/.2, 1.05));
      else acc.add(geo, p%2 ? TMAT.hedge : TMAT.hedgeD, at(t, h*.55, .43, r()*3, 1.05, h/.2, .9)); } }
  acc.into(g);
  const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}
/* ── CORNER CAFÉ (ring-1 hero): a paved corner, KayKit's red-awning shop at the back, parasol tables out front,
   a bench, a lamp, planters and a bike ── */
function buildCafe(g){
  const acc = new Acc(), r = rngFrom(222);
  acc.add(box(1.94, .04, 1.94), TMAT.curb, at(0, .02, 0));
  for (let i=0;i<8;i++) for (let j=0;j<8;j++) acc.add(box(.222, .012, .222), r() < .2 ? TMAT.walkD : TMAT.walk, at(-.84 + i*.24, .046, -.84 + j*.24));
  const yard = new THREE.Group(); acc.into(yard); yard.userData.ghostHide = true; g.add(yard);
  tm(g, 'kk_building_E_withoutBase', 1.7, 1.5, -.12, .05, -.38, 0);
  tm(g, 'kk_building_A_withoutBase', 1.35, .8, -.55, .05, .5, Math.PI/2);
  [[.35,.35],[.72,-.05],[.72,.62]].forEach(([x,z],i) => {
    tm(g, i%2 ? 'com_detail-parasol-b' : 'com_detail-parasol-a', .36, .34, x, .05, z, i); });
  km(g, 'kk_streetlight', KK*1.1, .82, .05, -.78, -Math.PI/4);
  km(g, 'kk_bench', KK*1.1, .05, .05, .82, Math.PI/2);
  km(g, 'kk_bush', KK*1.4, .85, .05, .85, 0); km(g, 'kk_bush', KK*1.4, -.85, .05, -.85, 0);
  const b = makeBike(false, 0x3FA7A0); b.position.set(.3, .05, .86); b.rotation.y = .1; g.add(b);
}
/* ── CLOCK TOWER (Gita): the heart of the town square. A round paved plaza, a brick tower with four clock faces,
   a teal spire with a gold finial, lamps, benches and flower tubs. ── */
function buildClock(g){
  const acc = new Acc(), r = rngFrom(404);
  acc.add(new THREE.CylinderGeometry(.95, .97, .05, 40), TMAT.walkD, at(0, .025, 0));
  for (let i=0;i<64;i++){ const a = i/64*Math.PI*2, d = .82; acc.add(box(.07, .015, .035), i%2 ? TMAT.walk : TMAT.stone, at(Math.cos(a)*d, .055, Math.sin(a)*d, -a)); }
  acc.add(new THREE.CylinderGeometry(.62, .62, .014, 40), TMAT.walk, at(0, .056, 0));
  // tower
  acc.add(box(.5, .12, .5), TMAT.stoneD, at(0, .11, 0));
  acc.add(box(.4, 1.05, .4), TMAT.brick, at(0, .17 + .525, 0));
  for (let k=0;k<4;k++) acc.add(box(.42, .03, .42), TMAT.stone, at(0, .45 + k*.22, 0));
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b]) => acc.add(box(.06, 1.05, .06), TMAT.brickD, at(a*.19, .17 + .525, b*.19)));
  acc.add(box(.5, .34, .5), TMAT.stone, at(0, 1.39, 0));
  // clock faces (+z, +x, -z, -x)
  for (let k=0;k<4;k++){ const a = k*Math.PI/2, sx = Math.sin(a), cz = Math.cos(a), d = .255;
    acc.add(new THREE.CylinderGeometry(.13, .13, .02, 24).rotateX(Math.PI/2), TMAT.face, at(sx*d, 1.39, cz*d, a));
    acc.add(new THREE.TorusGeometry(.13, .012, 6, 24), TMAT.gold, at(sx*(d+.004), 1.39, cz*(d+.004), a));
    acc.add(box(.014, .09, .01), TMAT.ink, at(sx*(d+.014) + cz*.0, 1.39 + .04, cz*(d+.014), a));                  // hour hand ↑ (12)
    acc.add(box(.07, .012, .01), TMAT.ink, at(sx*(d+.016) + cz*.03, 1.39, cz*(d+.016) - sx*.03, a)); }            // minute hand → (3)
  acc.add(box(.56, .04, .56), TMAT.stoneD, at(0, 1.58, 0));
  acc.add(new THREE.ConeGeometry(.4, .52, 4), TMAT.roofT, at(0, 1.6 + .26, 0, Math.PI/4));
  acc.add(new THREE.SphereGeometry(.04, 10, 8), TMAT.gold, at(0, 2.14, 0)); acc.add(new THREE.ConeGeometry(.018, .12, 8), TMAT.gold, at(0, 2.22, 0));
  // door
  acc.add(box(.14, .22, .02), TMAT.plankD, at(0, .28, .205)); acc.add(new THREE.CylinderGeometry(.07, .07, .02, 12, 1, false, -Math.PI/2, Math.PI).rotateX(Math.PI/2), TMAT.plankD, at(0, .39, .205));
  acc.into(g);
  [[-.7,-.4],[.4,-.7],[.7,.4],[-.4,.7]].forEach(([x,z]) => km(g, 'kk_streetlight', KK*1.1, x, .06, z, Math.atan2(x, z) + Math.PI));
  km(g, 'kk_bench', KK*1.1, .7, .06, -.25, Math.PI/2); km(g, 'kk_bench', KK*1.1, -.25, .06, .7, 0);
  [[.62,.62],[-.62,-.62],[.66,-.62]].forEach(([x,z],i) => { const t = new THREE.Group(); t.position.set(x, .06, z); g.add(t);
    const a2 = new Acc(); a2.add(new THREE.CylinderGeometry(.09, .07, .1, 12), TMAT.brickD, at(0, .05, 0)); a2.into(t);
    addModel(t, i%2 ? 'Flower_3_Group' : 'Flower_4_Group', .22, 0, .08, 0, i, 'a'); });
}

/* ── procedural vehicles for life + residents ── */
function makeBike(rider = true, frameHex = 0x2E6FD8){
  const g = new THREE.Group(), acc = new Acc(), fr = FM(frameHex);
  [-.065, .065].forEach(z => acc.add(new THREE.TorusGeometry(.042, .008, 6, 16), TMAT.tyre, at(0, .05, z, Math.PI/2)));
  acc.add(box(.012, .012, .13), fr, at(0, .085, 0)); acc.add(box(.012, .06, .012), fr, at(0, .075, -.03)); acc.add(box(.012, .06, .012), fr, at(0, .08, .055));
  acc.add(box(.05, .01, .012), TMAT.ink, at(0, .115, .055)); acc.add(box(.02, .01, .035), TMAT.ink, at(0, .11, -.03));
  if (rider) { acc.add(box(.05, .075, .04), TMAT.shirt, at(0, .16, -.01, 0, 1, 1, 1, .25)); acc.add(new THREE.SphereGeometry(.024, 10, 8), TMAT.skin, at(0, .22, .005));
    acc.add(new THREE.SphereGeometry(.026, 10, 8, 0, 6.3, 0, 1.4), TMAT.hair, at(0, .225, 0)); acc.add(box(.014, .06, .014), TMAT.ink, at(.012, .1, 0)); acc.add(box(.014, .06, .014), TMAT.ink, at(-.012, .1, 0)); }
  acc.into(g); return g;
}
function makeBus(){
  const g = new THREE.Group(), acc = new Acc(), L = .86, W = .28, H = .26;
  acc.add(box(W, H*.72, L), TMAT.bus, at(0, .05 + H*.36 + .02, 0));
  acc.add(box(W + .004, H*.26, L - .06), TMAT.busWin, at(0, .05 + H*.72 + .02 + H*.1, -.01));
  acc.add(box(W - .01, .03, L - .02), TMAT.white, at(0, .05 + H + .04, 0));
  acc.add(box(W - .04, H*.3, .01), TMAT.busWin, at(0, .05 + H*.82, L/2 + .002));
  acc.add(box(W + .006, .03, L + .006), TMAT.busD, at(0, .085, 0));
  [[.1,.3],[-.1,.3],[.1,-.28],[-.1,-.28]].forEach(([x,z]) => acc.add(new THREE.CylinderGeometry(.05, .05, .04, 12).rotateZ(Math.PI/2), TMAT.tyre, at(Math.sign(x)*(W/2 - .005), .06, z)));
  [-.09, .09].forEach(x => acc.add(new THREE.SphereGeometry(.018, 8, 6), TMAT.face, at(x, .11, L/2)));
  acc.into(g); return g;
}
function makeCar(name){ const g = new THREE.Group(); const t = tplOf(name); if (t) addModel(g, name, CAR_K, 0, 0, 0, 0, TK); else console.warn('missing', name); return g; }
function makeBird(){
  const g = new THREE.Group(), acc = new Acc();
  acc.add(new THREE.SphereGeometry(.03, 8, 6), TMAT.bird, at(0, 0, 0, 0, .8, .8, 1.5)); acc.into(g);
  const wg = new THREE.PlaneGeometry(.09, .045).rotateX(-Math.PI/2).translate(.045, 0, 0);
  const w1 = new THREE.Mesh(wg, TMAT.birdW), w2 = new THREE.Mesh(wg, TMAT.birdW); w2.scale.x = -1; w1.material.side = THREE.DoubleSide; g.add(w1, w2);
  g.userData.w1 = w1; g.userData.w2 = w2; return g;
}

/* ── ambient life: a little car looping on the placed main street, and birds circling ── */
const complete = () => placed.length === TOWN.length;
function streetChain(){ let z = 4; const zs = []; while (z <= 6 && placed.includes('road3_'+z)) { zs.push(z); z++; } return zs; }
function loopPath(zs){
  const O = cellPos(3, 0), x0 = O.x, lane = .19, z0 = zs[0] - .2 + O.z, z1 = zs[zs.length-1] + (zs[zs.length-1] === 6 ? .38 : .22) + O.z;
  const S1 = z1 - z0, C = Math.PI*lane; return { x0, lane, z0, z1, S1, C, L: 2*S1 + 2*C };
}
function loopAt(p, s){
  s = ((s % p.L) + p.L) % p.L;
  if (s < p.S1) return { x:p.x0 - p.lane, z:p.z0 + s, h:0 };                                           // down the near lane (+z)
  s -= p.S1; if (s < p.C) { const a = s/p.C*Math.PI; return { x:p.x0 - p.lane*Math.cos(a), z:p.z1 + p.lane*Math.sin(a), h:a }; }
  s -= p.C; if (s < p.S1) return { x:p.x0 + p.lane, z:p.z1 - s, h:Math.PI };
  s -= p.S1; const a = s/p.C*Math.PI; return { x:p.x0 + p.lane*Math.cos(a), z:p.z0 - p.lane*Math.sin(a), h:Math.PI + a };
}
function addLife(){
  V.town = { birds:[], car:null };
  const zs = streetChain();
  if (zs.length && !complete()) { const car = makeCar('car_sedan_1'); world.add(car); V.life.push(car); V.town.car = { obj:car, path:loopPath(zs) }; }
  for (let i=0;i<3;i++){ const b = makeBird(); b.scale.setScalar(1.7); b.userData.ph = i*2.1; b.userData.rad = .8 + V.ring*.4 + i*.22; b.userData.h = 1.35 + i*.2; b.userData.sp = .28 + i*.05;
    world.add(b); V.life.push(b); V.town.birds.push(b); }
  moveLife(2.1);
}
function moveLife(t){
  const T = V && V.town; if (!T) return;
  if (T.car) { const p = T.car.path, s = t*.32 + .3, q = loopAt(p, s); T.car.obj.position.set(q.x, TILE_TOP + .055, q.z); T.car.obj.rotation.y = q.h; }
  T.birds.forEach(b => { const u = b.userData, a = t*u.sp + u.ph;
    b.position.set(Math.cos(a)*u.rad, TILE_TOP + u.h + Math.sin(a*2.3)*.1, Math.sin(a)*u.rad*.8);
    b.rotation.y = -a + Math.PI; const f = Math.sin(t*14 + u.ph)*.7; u.w1.rotation.z = f; u.w2.rotation.z = -f; });
}

/* ── residents: a taxi and the town bus drive in along main street, a cyclist rides to the park, the town dog trots after ── */
const RES_PLAN = {
  taxi: { make:() => makeCar('car_taxi_1'),   path:[[2.81,7.6],[2.81,4.25]], face:0, y:.055 },
  bus:  { make:() => makeBus(),             path:[[3.19,7.8],[3.19,5.75]], face:Math.PI, y:.055, turnIn:true },
  bike: { make:() => makeBike(true),        path:[[3.19,7.6],[3.19,4.45]], face:Math.PI, y:0 },
  dog:  { path:[[2.9,7.6],[2.62,6.9],[2.05,6.36]], face:.9 }
};
function spawnVehicle(id){ const pl = RES_PLAN[id], o = pl.make(); world.add(o); return o; }
function pathPoint(pl, t){
  const P = pl.path.map(([x,z]) => cellPos(x, z)); let L = 0; const seg = [];
  for (let i=1;i<P.length;i++){ const d = P[i].distanceTo(P[i-1]); seg.push(d); L += d; }
  let s = t*L; for (let i=0;i<seg.length;i++){ if (s <= seg[i] || i === seg.length-1) { const k = Math.min(1, s/seg[i]);
    const p = P[i].clone().lerp(P[i+1], k); const dir = P[i+1].clone().sub(P[i]); return { p, h:Math.atan2(dir.x, dir.z) }; } s -= seg[i]; }
}
async function spawnDog(){
  const d = { id:'ShibaInu', h:.26 }; const gltf = await loadAnimal(d);
  const obj = SkeletonUtils.clone(gltf.scene);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.metalness = 0; o.material.roughness = .85; } });
  const bx = new THREE.Box3().setFromObject(obj); const s = d.h / (bx.max.y - bx.min.y); obj.scale.setScalar(s);
  obj.userData.y0 = TILE_TOP - bx.min.y*s; world.add(obj);
  const mixer = new THREE.AnimationMixer(obj), clips = {}; gltf.animations.forEach(c => clips[c.name.replace(/^.*\|/, '')] = c);
  const a = { def:d, obj, mixer, clips, cur:null }; V.animals.push(a); return a;
}
function playClip(a, name){ const c = a.clips[name] || a.clips.Idle || Object.values(a.clips)[0]; if (!c) return; const act = a.mixer.clipAction(c);
  if (a.cur === act) return; act.reset().play(); if (a.cur) a.cur.crossFadeTo(act, .3, false); a.cur = act; }
async function townMoveIn(walk){
  V.residentsIn = true;
  const ids = ['taxi', 'bus', 'bike', 'dog'];
  ['taxi','bus','bike','dog'].forEach(id => { const pl = RES_PLAN[id]; const e = pathPoint(pl, 1).p; V.framePts.push(e.clone().setY(TILE_TOP + .4)); });
  for (let i=0;i<ids.length;i++){
    const id = ids[i], pl = RES_PLAN[id];
    let o, dog = null;
    if (id === 'dog') { dog = await spawnDog(); o = dog.obj; } else o = spawnVehicle(id);
    const y = id === 'dog' ? o.userData.y0 : TILE_TOP + pl.y;
    const place = t => { const q = pathPoint(pl, t); o.position.set(q.p.x, y, q.p.z); o.rotation.y = q.h; };
    if (!walk) { place(1); o.rotation.y = pl.face; if (dog) { playClip(dog, 'Idle'); dog.mixer.update(.6); } continue; }
    if (dog) playClip(dog, 'Walk');
    place(0);
    await new Promise(res => tween(S.rm ? 1 : (id === 'dog' ? 2600 : 2000), t => place(1 - Math.pow(1-t, 2.2)),
      () => { place(1); o.rotation.y = pl.face; if (dog) playClip(dog, 'Idle');
        sparkle(o.position.clone().setY(TILE_TOP + .3), 10, 0xFFF0B0, .5); res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = ids.length;
}

export default {
  id:'town', name:'Little town', title:'Your town',
  season:10, dates:'2–15 Feb', nextIn:9,
  kits:['a', TK, 'farm'],      // kit a first: meadow tufts + park trees come from the shared MegaKit; town pieces pass kit 'town'
  kitDefs:{ [TK]:{ file:'assets/town/town.glb' } },
  families:{
    water:   { label:'fountains & ponds',   tag:'Water' },
    building:{ label:'shops & houses',      tag:'Building' },
    path:    { label:'streets & benches',   tag:'Path' },
    crop:    { label:'gardens & new builds',tag:'Grows' },
    tree:    { label:'street & park trees', tag:'Tree' },
    special: { label:'the clock tower',     tag:'Special' }
  },
  slots:TOWN, order:TOWN_ORDER,
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M3.5 10.5h7v9h-7z" fill="#F6C544"/><path d="M2.6 11 7 6.6l4.4 4.4z" fill="#5B8FE0"/><path d="M12.5 7h8v12.5h-8z" fill="#E07A5F"/><path d="M14.2 9.2h1.8v1.8h-1.8zM17 9.2h1.8v1.8H17zM14.2 12.6h1.8v1.8h-1.8zM17 12.6h1.8v1.8H17z" fill="#FFF8E7"/><path d="M6 19.5v-3.4h2v3.4" fill="#8A5634"/><path d="M15.4 19.5v-2.6h2.2v2.6" fill="#2F4A63"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M8 118V74h30v44z"/><path d="M4 76 23 58l19 18z"/><path d="M44 118V58h34v60z"/><path d="M84 118V50h14V26l8-14 8 14v24h6v68z"/></g>',
  album:{ image:'assets/town/album.jpg' },

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'model') {
      const [h, w] = s.fit || [1.45, .9];
      const m = tm(g, s.model, h, w, 0, 0, 0, (s.rot||0)*Math.PI/180); if (m) m.scale.multiplyScalar(pieceScale(s));
    }
    else if (s.kind === 'house') { const m = tm(g, s.model, .95, .92, 0, 0, 0, (s.rot||0)*Math.PI/180); if (m) m.scale.multiplyScalar(pieceScale(s)); tintRoof(m, s.roof); }
    else if (s.kind === 'tree') {
      if (s.street) { const acc = new Acc(); acc.add(box(.34, .03, .34), TMAT.stoneD, at(0, .015, 0)); acc.add(box(.26, .032, .26), TMAT.soil, at(0, .017, 0)); acc.into(g);
        tm(g, s.small ? 'sub_tree-small' : 'sub_tree-large', s.small ? 1.0 : 1.3, .55, 0, .02, 0, 0); km(g, 'kk_bush', KK*1.1, .3, .02, .3, 0); }
      else { const t = KITCACHE.a && KITCACHE.a[s.model]; if (t) addModel(g, s.model, fitScale(t, 1.3, 1.02), 0, 0, 0, (s.rot||0)*Math.PI/180, 'a'); }
    }
    else if (s.kind === 'road') buildRoad(g, s);
    else if (s.kind === 'garden') buildGarden(g, s, stage);
    else if (s.kind === 'site') buildSite(g, s, stage);
    else if (s.kind === 'pond') buildPond(g, s);
    else if (s.kind === 'fountain') { const acc = new Acc(); sidewalk(acc, .485, 0, rngFrom(5)); acc.into(g); const f = new THREE.Group(); f.position.y = .05; g.add(f); buildFountain(f, 1.05);
      addModel(g, 'Flower_4_Group', .2, .38, .05, .38, 0, 'a'); addModel(g, 'Flower_3_Group', .2, -.38, .05, .38, 1, 'a'); }
    else if (s.kind === 'busstop') buildBusStop(g);
    else if (s.kind === 'lamps') buildLamps(g);
    else if (s.kind === 'bikes') buildBikes(g);
    else if (s.kind === 'fence') buildFence(g, s);
    else if (s.kind === 'hedge') buildHedge(g, s);
    else if (s.kind === 'cafe') buildCafe(g);
    else if (s.kind === 'clock') buildClock(g);
  },
  scaleOf: s => S.grow !== 'c' ? 1 : s.kind === 'garden' ? 1.15 : pieceScale(s),
  contact: s => ['model', 'house', 'tree', 'cafe', 'site'].includes(s.kind),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.kind === 'lamps' || s.kind === 'busstop',
  decor(slots){ meadowDecor(slots, { tuft: r => { const q = r(); return q < .5 ? ['Grass_Common_Short', 0] : q < .88 ? ['Grass_Wispy_Short', 0] : [q < .94 ? 'Flower_3_Single' : 'Flower_4_Single', .16]; }, flowers:false }); },
  ambient(){ addLife(); },
  tick(t){ moveLife(t); },

  residents:[ { id:'taxi', name:'Taxi' }, { id:'bus', name:'Town bus' }, { id:'bike', name:'Cyclist' }, { id:'dog', name:'Town dog' } ],
  moveIn: townMoveIn,
  residentThumb(d, thumbFor){
    if (d.id === 'dog') return 'assets/thumbs/ShibaInu.png';
    return thumbFor('town:'+d.id, () => { const o = RES_PLAN[d.id].make(); o.rotation.y = -.6; return o; }, 168);
  },
  residentRig(d){
    if (d.id === 'dog') { const gltf = ANIMCACHE.__dog; if (!gltf) return null; const o = SkeletonUtils.clone(gltf.scene); const mx = new THREE.AnimationMixer(o);
      const c = gltf.animations.find(x => /Walk/.test(x.name)); return { obj:o, mixer:mx, clip:c || null, facing:0 }; }
    const obj = RES_PLAN[d.id].make(); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; },
  async preload(){ if (!ANIMCACHE.__dog) ANIMCACHE.__dog = await loadAnimal({ id:'ShibaInu' }); }
};
