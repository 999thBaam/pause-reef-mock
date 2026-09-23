/* FOREST GLADE — the garden you already finished, as a 40-slot blueprint on the same 7×7 plot (shared MegaKit, kit a).
   Opens complete (startComplete) and keeps the loop awake for leaf sway (alwaysAnimate). */
import { rngFrom } from '../engine/scene.js';
import { T, addModel, fitScale } from '../engine/kit.js';
import { meadowDecor, addButterflies, flyButterflies } from '../engine/life.js';

const SPECIES = {
  water:['Flower_3_Group','Flower_4_Group','Bush_Common_Flowers'], building:['Mushroom_Common','Fern_1','Mushroom_Laetiporus'],
  path:['Rock_Medium_2','Rock_Medium_1','Grass_Common_Tall','Rock_Medium_3'], crop:['Bush_Common','Plant_1_Big','Clover_2'],
  tree:['CommonTree_1','CommonTree_2','Pine_5','CommonTree_5','Pine_1'], special:['TwistedTree_1','TwistedTree_3']
};
const FIT = { water:[.62,.9], building:[.36,.84], path:[.42,.84], crop:[.54,.86], tree:[1.3,1.1], special:[1.45,1.2] };   // [height, width] in tiles
const GATE_OF = { water:'breathe', building:'lesson', path:'todos', crop:'sudoku', tree:'vocab', special:'gita' };
function forestSlots(){
  const r = rngFrom(707), cells = [];
  for (let z=0; z<7; z++) for (let x=0; x<7; x++) cells.push({x,z});
  const free = new Set(['0,6','6,0','3,3','1,5','5,1','2,6','6,4','4,6','0,2']);
  const bag = []; const mix = { tree:9, water:9, crop:7, building:6, path:7, special:2 };
  for (const c in mix) for (let i=0;i<mix[c];i++) bag.push(c);
  for (let i=bag.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; }
  const out = []; let n = 0;
  cells.filter(c => !free.has(c.x+','+c.z)).forEach(c => { const cat = bag[n++]; const pool = SPECIES[cat];
    out.push({ id:'f'+c.x+'_'+c.z, cat, gate:GATE_OF[cat], name:'', kind:'kit', model:pool[Math.floor(r()*pool.length)], x:c.x, z:c.z, rot:r()*360 }); });
  return out;
}
const SLOTS = forestSlots();

export default {
  id:'forest', name:'Forest glade', title:'Forest glade',
  season:1, dates:'1–14 Sep', nextIn:9,
  startComplete:true, alwaysAnimate:true,
  kits:['a'],
  families:{
    water:   { label:'flowers',      tag:'Water' },
    building:{ label:'forest floor', tag:'Building' },
    path:    { label:'stones',       tag:'Path' },
    crop:    { label:'bushes',       tag:'Field' },
    tree:    { label:'trees',        tag:'Tree' },
    special: { label:'rare trees',   tag:'Special' }
  },
  slots:SLOTS, order:SLOTS.map(s => s.id),
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 3 6 13h3.5L6.5 18h11l-3-5H18z" fill="#2FA36B"/><rect x="11" y="17.5" width="2" height="3.5" rx=".6" fill="#8C5A3A"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M40 20 18 62h12L14 90h52L50 62h12z"/><rect x="36" y="88" width="8" height="30"/><path d="M90 36 72 70h10L68 96h44L98 70h10z"/><rect x="86" y="94" width="8" height="24"/></g>',
  album:{ image:'assets/forest/album.jpg' },

  build(g, s){ const tpl = T()[s.model]; if (tpl) { const [h,w] = FIT[s.cat]; addModel(g, s.model, fitScale(tpl, h, w), 0, 0, 0, (s.rot||0)*Math.PI/180); } },
  contact: s => s.kind === 'kit',
  decor(slots){ meadowDecor(slots, { tuft: r => [r()<.5 ? 'Grass_Common_Short' : 'Grass_Wispy_Short', 0], flowers:false }); },
  ambient(){ addButterflies(); },
  tick(t){ flyButterflies(t); },

  residents:[ {id:'ShibaInu',name:'Shiba',h:.6,at:[0.2,6.1],face:.4}, {id:'Fox',name:'Fox',h:.58,at:[3.1,3.1],face:2.4},
              {id:'Deer',name:'Deer',h:.95,at:[4.2,6.1],face:-.6}, {id:'Stag',name:'Stag',h:1.1,at:[6.1,0.2],face:2.2} ],
  residentThumb: d => 'assets/thumbs/' + d.id + '.png'
};
