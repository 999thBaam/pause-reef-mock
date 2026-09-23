/* FARM — the default theme. Quaternius Farm Buildings + Ultimate Crops (assets/farm/farm.glb), Gita peepal from the shared
   MegaKit (kit a), residents = Quaternius Ultimate Animated Animals + Sheep. All CC0, see assets/LICENSES.md. */
import * as THREE from 'three';
import { rngFrom } from '../engine/scene.js';
import { S, cropStage } from '../engine/state.js';
import { edgeCentre } from '../engine/grid.js';
import { KITCACHE, ANIMCACHE, addModel, fitScale, greenSwap, loadAnimal } from '../engine/kit.js';
import { G, M } from '../engine/proc.js';
import { meadowDecor, addButterflies, flyButterflies } from '../engine/life.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/* ── BLUEPRINT: 7×7 plot, 40 fixed slots. x,z = min cell; w,d = footprint; k = scale of the source model
   (Blender units → tiles, one scale per building family so sizes stay honest); rot in degrees. ── */
export const FARM = [
  // ── ring 1 (centre 3×3): the first six pieces ──
  { id:'bigbarn',   cat:'building', gate:'lesson',  name:'Big barn',    kind:'model', model:'BigBarn',  x:2, z:2, w:2, d:2, k:.215, rot:0 },
  { id:'well',      cat:'water',    gate:'breathe', name:'Well',        kind:'model', model:'Well',     x:4, z:2, k:.28, rot:-30 },
  { id:'apple1',    cat:'tree',     gate:'vocab',   name:'Apple tree',  kind:'model', model:'Apple_4',  x:4, z:3, k:.38, rot:20 },
  { id:'path3_4',   cat:'path',     gate:'todos',   name:'Stone path',  kind:'path', x:3, z:4 },
  // ── ring 2 (5×5) ──
  { id:'silo',      cat:'building', gate:'lesson',  name:'Silo',        kind:'model', model:'Silo',        x:2, z:1, k:.2,  rot:0 },
  { id:'silohouse', cat:'building', gate:'lesson',  name:'Grain store', kind:'model', model:'Silo_House',  x:3, z:1, k:.165, rot:0 },
  { id:'coop',      cat:'building', gate:'lesson',  name:'Chicken coop',kind:'model', model:'ChickenCoop', x:4, z:1, k:.22, rot:0 },
  { id:'watertower',cat:'water',    gate:'breathe', name:'Water tower', kind:'model', model:'WaterTower',  x:5, z:1, k:.19, rot:0 },
  { id:'pump',      cat:'water',    gate:'breathe', name:'Wind pump',   kind:'model', model:'Windmill',    x:5, z:4, k:.15, rot:0 },
  { id:'apple2',    cat:'tree',     gate:'vocab',   name:'Apple tree',  kind:'model', model:'Apple_4',     x:5, z:3, k:.38, rot:140 },
  { id:'berry1',    cat:'tree',     gate:'vocab',   name:'Berry bush',  kind:'model', model:'BushBerries_4', x:5, z:5, k:.4, rot:0 },
  // ── ring 3 (7×7) ──
  { id:'peepal',    cat:'special',  gate:'gita',    name:'Peepal tree', kind:'peepal', x:0, z:0, w:2, d:2 },
  { id:'smallbarn', cat:'building', gate:'lesson',  name:'Small barn',  kind:'model', model:'SmallBarn', x:2, z:0, k:.15, rot:0 },
  { id:'openbarn',  cat:'building', gate:'lesson',  name:'Hay shed',    kind:'model', model:'OpenBarn',  x:4, z:0, k:.15, rot:0 },
  { id:'pond',      cat:'water',    gate:'breathe', name:'Duck pond',   kind:'pond', x:6, z:2 },
  { id:'orange1',   cat:'tree',     gate:'vocab',   name:'Orange tree', kind:'model', model:'Orange_3',      x:5, z:0, k:.5,  rot:0 },
  { id:'apple3',    cat:'tree',     gate:'vocab',   name:'Apple tree',  kind:'model', model:'Apple_4',       x:6, z:0, k:.38, rot:260 },
  { id:'berry2',    cat:'tree',     gate:'vocab',   name:'Berry bush',  kind:'model', model:'BushBerries_4', x:6, z:1, k:.4,  rot:90 },
  { id:'orange2',   cat:'tree',     gate:'vocab',   name:'Orange tree', kind:'model', model:'Orange_3',      x:6, z:5, k:.5,  rot:200 },
  { id:'apple4',    cat:'tree',     gate:'vocab',   name:'Apple tree',  kind:'model', model:'Apple_4',       x:6, z:6, k:.38, rot:60 },
  // Sudoku / Math → crop fields (grow a stage with every later piece)
  ...[[2,4,'Corn'],[4,4,'Carrot'],[1,3,'Corn'],[1,4,'Carrot'],[1,5,'Lettuce'],[2,5,'Beet'],[4,5,'Corn'],[6,3,'Lettuce'],[6,4,'Carrot'],[4,6,'Corn']]
    .map(([x,z,c],i) => ({ id:'field'+x+'_'+z, cat:'crop', gate:i%3===2?'mathtricks':'sudoku', name:c+(c==='Lettuce'?' patch':' field'), kind:'field', crop:c, x, z, stages:5 })),
  // To-dos → paths + fences
  ...[[1,2],[5,2],[3,5],[3,0],[2,6],[3,6]].map(([x,z]) => ({ id:'path'+x+'_'+z, cat:'path', gate:'todos', name:'Stone path', kind:'path', x, z })),
  { id:'fence1', cat:'path', gate:'todos', name:'Fence', kind:'fence', x:0, z:2, edge:'w', len:2 },
  { id:'fence2', cat:'path', gate:'todos', name:'Fence', kind:'fence', x:0, z:4, edge:'w', len:2 },
  { id:'fence3', cat:'path', gate:'todos', name:'Fence', kind:'fence', x:0, z:6, edge:'s', len:2 },
  { id:'fence4', cat:'path', gate:'todos', name:'Fence', kind:'fence', x:5, z:6, edge:'s', len:2 }
];
/* Hero in view. At (0,0) the 2×2 hero sits in the BACK corner, behind the barn row, and is half hidden at 7×7. Themes on this
   blueprint whose hero gets occluded (farm, pirate, halloween) move it to the RIGHT-hand corner (cells 5–6 × 0–1: nothing stands
   in front of it), and the four pieces there take its old corner. Rings stay valid: the hero and the three trees stay ring 3,
   the water tower (ring 2) moves to (1,1), also ring 2, so FARM_ORDER still fills ring 1, 2, 3 in turn. */
export const HERO_RIGHT = { peepal:[5,0], watertower:[1,1], orange1:[0,0], apple3:[1,0], berry2:[0,1] };
export const heroRight = slots => slots.map(s => HERO_RIGHT[s.id] ? { ...s, x:HERO_RIGHT[s.id][0], z:HERO_RIGHT[s.id][1] } : s);
export const FARM_SLOTS = heroRight(FARM);

/* Placement order for the boards (pieces=N = first N). Rings fill before the land grows; a real user picks within the current ring. */
export const FARM_ORDER = ['bigbarn','field2_4','apple1','well','path3_4','field4_4',
  'path3_5','coop','field1_3','silo','berry1','path1_2','field4_5','watertower','apple2','field1_4','silohouse','path5_2','field1_5','pump','field2_5',
  'peepal','path3_6','pond','fence1','orange1','smallbarn','field6_3','apple3','fence2','openbarn','path2_6','berry2','field6_4','orange2','fence3','field4_6','apple4','path3_0','fence4'];

/* Blender material colours (the blends keep colour in node setups the glTF exporter drops): used when the GLB was packed, kept for reference */
export const PALETTE = { White:'#F3E9D8', LightRed:'#C9523B', DarkRed:'#9C3A2B', RoofBlack:'#8A806E', Brown:'#A4673C', LightBrown:'#C9A06A',
  Grey:'#B9B1A3', DarkGrey:'#7E776B', Black:'#403A33', Green_Tree:'#6FB041', DarkGreen_Tree:'#4F8C34', Wood:'#7A5234', DarkBrown:'#5C3B22',
  Green:'#7EC24B', DarkGreen:'#3F8C3A', DarkGreen2:'#4F9B3D', Yellow:'#F4C84A', LightOrange:'#F08B37', Cyan:'#6EC6E0', Pink:'#F28DB2',
  Green_Bush:'#5FA93F', Berry:'#C62F5C', Green_Grass:'#7DBB4A', Red:'#D9463B', Mushroom1:'#F1E4CC' };

/* Animal-Crossing proportions: 1×1 models 1.3×, 2×2 buildings 1.14× (1.3× overlapped their neighbours); ?grow=a = 1× */
export const pieceScale = s => S.grow !== 'c' ? 1 : (s.kind === 'model' ? ((s.w||1) > 1 ? 1.14 : 1.3) : 1);
const CROP = { Corn:{k:.17}, Carrot:{k:.21}, Lettuce:{k:.25}, Beet:{k:.22, no1:true} };
function cropModel(crop, stage){
  const st = stage >= 4 ? 4 : stage;
  if (st === 1 && CROP[crop].no1) return { name: crop+'_2', mul:.55 };
  return { name: crop+'_'+st, mul: stage >= 5 ? 1.1 : 1 };
}
function fillField(plants, s, stage){
  plants.clear();
  const r = rngFrom(s.x*31 + s.z*7 + 5), c = CROP[s.crop], cm = cropModel(s.crop, stage);
  for (let i=0;i<3;i++) for (let j=0;j<3;j++){
    const px = (i-1)*.28 + (r()-.5)*.03, pz = (j-1)*.28 + (r()-.5)*.03;
    addModel(plants, cm.name, c.k * cm.mul * (S.grow==='c' ? 1.22 : 1) * (.92 + r()*.16), px, .07, pz, r()*6.28);   // crop plants 1.22×
  }
  if (stage >= 5) for (let i=0;i<3;i++) addModel(plants, s.crop+'_Crop', c.k*.9, .3 + (i%2)*.08, .07, -.34 + i*.07, r()*6.28);
  plants.userData.stage = stage;
}
function buildPond(g){
  const rim = new THREE.Mesh(G.rim, M.sand); rim.position.y = .025; rim.receiveShadow = true; g.add(rim);
  const wat = new THREE.Mesh(G.water, M.water); wat.position.y = .055; wat.scale.set(1.12, 1, .98); wat.receiveShadow = true; g.add(wat);
  const r = rngFrom(77);
  for (let i=0;i<22;i++){ const a = i/22*Math.PI*2; const p = new THREE.Mesh(G.pebble, M.stone);
    p.position.set(Math.cos(a)*.86*1.1, .06, Math.sin(a)*.86*.97); p.scale.set(1 + r()*.5, .55, 1 + r()*.4); p.castShadow = p.receiveShadow = true; g.add(p); }
  [[-.25,.1],[.2,-.28],[.32,.22]].forEach(([x,z]) => { const pd = new THREE.Mesh(G.pad, M.pad); pd.position.set(x, .068, z); g.add(pd); });
  addModel(g, 'Grass_3', .2, -.78, .05, -.62, .3); addModel(g, 'Grass_4', .18, -.62, .05, -.8, 1.3);
  addModel(g, 'Grass_3', .19, .82, .05, .66, 2);   addModel(g, 'Flower_4', .2, -.84, .05, .5, 0);
  addModel(g, 'Flower_3', .22, .7, .05, -.8, 1);
}
/* PEEPAL (Gita): a broad, gnarled tree on a round stone chabutra with diyas, the heart of an Indian village.
   Tree = Quaternius MegaKit TwistedTree_3 with its red maple atlas swapped to green. */
const PEEPAL_MATS = new Map();
const M_CHAB = new THREE.MeshStandardMaterial({ color:0xE3D6BE, roughness:.95 });
const M_CHAB2 = new THREE.MeshStandardMaterial({ color:0xCDBB9A, roughness:.95 });
const M_DIYA = new THREE.MeshStandardMaterial({ color:0xB8612E, roughness:.8 });
const M_FLAME = new THREE.MeshStandardMaterial({ color:0xFFC857, emissive:0xFF9A1F, emissiveIntensity:1.6 });
const M_THREAD = new THREE.MeshStandardMaterial({ color:0xD9362B, roughness:.7 });
function buildPeepal(g){
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.86, .92, .12, 36), M_CHAB2); base.position.y = .06; base.castShadow = base.receiveShadow = true; g.add(base);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.66, .7, .12, 36), M_CHAB); top.position.y = .18; top.castShadow = top.receiveShadow = true; g.add(top);
  const tpl = KITCACHE.a && KITCACHE.a.TwistedTree_3; if (!tpl) return;
  const k = fitScale(tpl, 2.25, 2.35), tree = new THREE.Group();
  tpl.parts.forEach(pt => { let mat = pt.mat;
    if (mat.map && !/bark|trunk|wood/i.test(mat.name||'') && pt.leafy !== false) { if (!PEEPAL_MATS.has(mat)) { const m2 = mat.clone(); m2.map = greenSwap(mat.map); PEEPAL_MATS.set(mat, m2); } mat = PEEPAL_MATS.get(mat); }
    const m = new THREE.Mesh(pt.geo, mat); m.applyMatrix4(pt.local); m.castShadow = m.receiveShadow = true; tree.add(m); });
  tree.scale.setScalar(k); tree.position.y = .24; tree.rotation.y = 2.4; g.add(tree);
  const thread = new THREE.Mesh(new THREE.TorusGeometry(.16, .018, 8, 28).rotateX(Math.PI/2), M_THREAD); thread.position.y = .5; g.add(thread);
  for (let i=0;i<6;i++){ const a = i/6*Math.PI*2 + .3; const d = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.045, .03, .03, 12), M_DIYA); d.add(cup);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), M_FLAME); fl.scale.set(1, 1.8, 1); fl.position.y = .04; d.add(fl);
    d.position.set(Math.cos(a)*.56, .255, Math.sin(a)*.56); g.add(d); }
}

export default {
  id:'farm', name:'Farm', title:'Your farm',
  season:2, dates:'15–28 Sep', nextIn:9,
  kits:['farm','a'],
  kitDefs:{ farm:{ file:'assets/farm/farm.glb', flat:true } },
  families:{
    water:   { label:'water',           tag:'Water' },
    building:{ label:'buildings',       tag:'Building' },
    path:    { label:'paths & fences',  tag:'Path' },
    crop:    { label:'crop fields',     tag:'Field' },
    tree:    { label:'orchard trees',   tag:'Tree' },
    special: { label:'the peepal tree', tag:'Special' }
  },
  slots:FARM_SLOTS, order:FARM_ORDER,
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 11 12 5l8 6v8.5H4z" fill="#E85B4B"/><path d="M9.5 19.5v-5h5v5" fill="#fff"/><path d="M3 11.6 12 4.8l9 6.8" fill="none" stroke="#8C5A3A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M14 118V66l34-26 34 26v52z"/><path d="M84 118V54h22v64z"/><path d="M82 54c0-8 5-13 13-13s13 5 13 13z"/><path d="M36 118V88h24v30z" fill="#fff" opacity=".5"/></g>',
  album:{ image:'assets/farm/album.jpg', progress:31 },

  build(g, s, opt){
    if (s.kind === 'model') addModel(g, s.model, s.k * pieceScale(s), 0, 0, 0, (s.rot||0) * Math.PI/180);
    else if (s.kind === 'peepal') buildPeepal(g);
    else if (s.kind === 'field') {
      const slab = new THREE.Mesh(G.field, M.soil); slab.position.y = .035; slab.castShadow = slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab);
      const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillField(plants, s, st);
      fillField(plants, s, opt.stage ?? cropStage(s.id));
    } else if (s.kind === 'path') {
      const slab = new THREE.Mesh(G.path, M.sand); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
      const r = rngFrom(s.x*13 + s.z*29);
      [[-.2,-.18],[.18,-.2],[-.16,.2],[.21,.17]].forEach(([x,z]) => { const st = new THREE.Mesh(G.step, M.stone);
        st.position.set(x + (r()-.5)*.08, .045, z + (r()-.5)*.08); st.rotation.y = r()*3; st.scale.set(1 + r()*.25, 1, .85 + r()*.3); st.receiveShadow = true; st.castShadow = true; g.add(st); });
      g.userData.ghostMode = 'marker';
    } else if (s.kind === 'pond') {
      const inner = new THREE.Group(); inner.scale.setScalar(.52); g.add(inner); buildPond(inner);
    } else if (s.kind === 'fence') {
      for (let i=0;i<s.len;i++){
        if (s.edge === 'w') addModel(g, 'Fence', .165, -.45, 0, 0, Math.PI/2).position.z = i - (s.len-1)/2;
        else addModel(g, 'Fence', .165, 0, 0, .45, 0).position.x = i - (s.len-1)/2;
      }
      const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
    }
  },
  scaleOf: s => S.grow !== 'c' ? 1 : s.kind === 'field' ? 1.22 : pieceScale(s),   // for the spec: crop plants 1.22×
  contact: s => s.kind === 'model',
  nightLamp: s => s.cat==='building' || s.cat==='special' || s.id==='well',
  decor(slots){ meadowDecor(slots, { tuft: r => r()<.55 ? ['Grass_1',.34] : ['Grass_2',.26], flowers:true }); },
  ambient(){ addButterflies(); },
  tick(t){ flyButterflies(t); },

  residents:[ {id:'Cow',name:'Cow',h:.69,at:[0.05,2.55],face:.3}, {id:'Sheep',name:'Sheep',h:.45,at:[0.25,3.75],face:2.5,walk:'Jump',file:'assets/farm/Sheep.glb'},
              {id:'Horse',name:'Horse',h:.8,at:[0.1,5.1],face:.4}, {id:'Donkey',name:'Donkey',h:.62,at:[1.2,6.15],face:2.2},
              {id:'Alpaca',name:'Alpaca',h:.72,at:[5.15,6.2],face:-.7} ],
  async preload(){ if (!ANIMCACHE.__sheep) ANIMCACHE.__sheep = await loadAnimal(this.residents[1]); },
  residentThumb(d, thumbFor){
    if (d.id !== 'Sheep') return 'assets/thumbs/' + d.id + '.png';
    const gltf = ANIMCACHE.__sheep; if (!gltf) return '';
    return thumbFor('anim:Sheep', () => { const o = SkeletonUtils.clone(gltf.scene); const mx = new THREE.AnimationMixer(o);
      const c = gltf.animations.find(x => /Idle/.test(x.name)); if (c) { mx.clipAction(c).play(); mx.update(.4); } o.rotation.y = -.35 + Math.PI/2; return o; }, 168);
  }
};
