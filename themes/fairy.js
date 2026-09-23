/* FAIRY WOOD (?theme=fairy): a mushroom fairy forest on the castle/village 7×7 ring blueprint (rings 6 / 15 / 19,
   the hero in the front-left corner so it is never hidden).
   Everything built is procedural (Acc, merged per material): toadstool houses with round doors and glowing windows, a stump
   home, an acorn cottage, a lantern tree house, giant mushrooms that grow button → glowing spotted giant, fairy rings,
   a dewdrop fountain, a tiny waterfall, a moonlit lily pond, twig bridges/fences, fairy lights and the Tree of Light.
   Enchanted trees, ferns and meadow tufts = Quaternius Stylized Nature MegaKit (kit a, CC0, shared), leaves re-tinted.
   Residents: Quaternius fox + deer (shared, CC0) walk in; the owl, rabbits, snails, butterflies and fireflies are code-built. */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { rngFrom, world, TEX } from '../engine/scene.js';
import { S, V, cropStage, hooks } from '../engine/state.js';
import { edgeCentre, cellPos, TILE_TOP } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale, loadAnimal, modelBox } from '../engine/kit.js';
import { Acc } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { meadowDecor } from '../engine/life.js';

const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.88, metalness:0, flatShading:true, ...o });
const SM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.8, metalness:0, ...o });      // smooth (caps, stems)
const GL = (hex, em, k = 1.1, o = {}) => new THREE.MeshStandardMaterial({ color:hex, emissive:em, emissiveIntensity:k, roughness:.5, metalness:0, ...o });
const C = {
  stem:SM(0xF4E9D6), stemD:SM(0xE2D2B8), gill:SM(0xE9D3C0),
  capRed:SM(0xE0503F), capLilac:SM(0xB592E6), capTeal:SM(0x4FB7A8), capPink:SM(0xF08DB0), capGold:SM(0xE9B04A), spot:SM(0xFFF8EE),
  wood:FM(0x9A6437), woodD:FM(0x6E4428), woodL:FM(0xC99A62), bark:FM(0x7A5638), barkD:FM(0x5C3F28), ring:FM(0xD8B27A),
  acorn:SM(0xC98A4B), acornCap:FM(0x7A5230), acornCapL:FM(0x946640),
  moss:FM(0x4E8C47, { roughness:1 }), mossL:FM(0x6BAA52, { roughness:1 }), leaf:FM(0x3F8F6A), leafL:FM(0x58AE7C), leafT:FM(0x3E9C8E),
  stone:FM(0xB7B0C4), stoneD:FM(0x99A0AE), stoneL:FM(0xD2CCDA), pebble:FM(0xC9C1D6),
  roofL:FM(0x8C6CC8), roofT:FM(0x3F8F86), soil:FM(0x5E4636, { roughness:1 }),
  water:new THREE.MeshStandardMaterial({ color:0x4FB8C8, roughness:.15, metalness:0, emissive:0x10505E, emissiveIntensity:.45 }),
  waterN:new THREE.MeshStandardMaterial({ color:0x3E7FB0, roughness:.12, metalness:0, emissive:0x1C3E7A, emissiveIntensity:.5 }),     // moonlit
  foam:SM(0xF2FBFF, { emissive:0x9FD8E8, emissiveIntensity:.3 }),
  dew:new THREE.MeshStandardMaterial({ color:0xBFF2F4, emissive:0x5FD3E0, emissiveIntensity:.55, roughness:.05, metalness:0, transparent:true, opacity:.82 }),
  pad:FM(0x5FA84A), lotus:GL(0xFFC7E4, 0xFF7FB8, .55, { flatShading:true }),
  shell:SM(0xE8A8C8), shellD:SM(0xB47AA8), snailB:SM(0xDCE6C0),
  window:GL(0xFFE08A, 0xFFB347, 1.25, { flatShading:true }), knob:FM(0xF4C84A, { emissive:0x6A4A00, emissiveIntensity:.3 })
};
/* glowing things pulse softly (tick); three phases so the wood never breathes in unison */
const GLOWS = [
  GL(0xC9F6EC, 0x3FE0C8, 1.0), GL(0xE8D6FF, 0xB07CFF, 1.0), GL(0xFFF1B8, 0xFFC857, 1.1),
  GL(0xFFD2E8, 0xFF7FB8, .9), GL(0xD6F0FF, 0x6FB8FF, 1.0)
];
const LANTERN = GL(0xFFE6A0, 0xFFB347, 1.4, { flatShading:true });
const CAPS = { red:C.capRed, lilac:C.capLilac, teal:C.capTeal, pink:C.capPink, gold:C.capGold };
const GCAP = { red:GL(0xF36A58, 0xFF4A3A, .45), lilac:GL(0xC9A6FF, 0xA06CFF, .7), teal:GL(0x6FD8C6, 0x2FD0B8, .7), pink:GL(0xFFA6C8, 0xFF6FA8, .6), gold:GL(0xFFD27A, 0xFFB030, .6) };
const PULSE = [...GLOWS, LANTERN, ...Object.values(GCAP), C.dew, C.lotus];
PULSE.forEach((m, i) => { m.userData.k0 = m.emissiveIntensity; m.userData.ph = i*1.37; });

const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
const atR = (x, y, z, rx, ry, rz, sx=1, sy=1, sz=1) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
const cyl = (r0, r1, h, n=12) => new THREE.CylinderGeometry(r1, r0, h, n).translate(0, h/2, 0);      // r0 bottom, r1 top, origin at the base
const HEMI = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI*2, 0, Math.PI/2);
const SPH = new THREE.SphereGeometry(1, 12, 9);
const ICO = new THREE.IcosahedronGeometry(1, 1);
const DOD = new THREE.DodecahedronGeometry(1, 0);

/* ── toadstool parts ── */
function cap(acc, mat, x, y, z, r, sy=.62, spots=0, rng=null, spotMat=C.spot){
  acc.add(HEMI, mat, at(x, y, z, 0, r, r*sy, r));
  acc.add(new THREE.CircleGeometry(r*.98, 20).rotateX(Math.PI/2), C.gill, at(x, y + .002, z));
  for (let i=0;i<spots;i++){ const th = .35 + (rng ? rng() : (i*.37)%1)*1.0, ph = (rng ? rng() : i/spots)*6.28;
    const p = new THREE.Vector3(Math.sin(th)*Math.cos(ph)*r, Math.cos(th)*r*sy, Math.sin(th)*Math.sin(ph)*r), s = r*(.1 + (rng ? rng() : .5)*.07);
    acc.add(SPH, spotMat, at(x + p.x, y + p.y, z + p.z, 0, s, s*.55, s)); }
}
function mushroom(acc, x, z, h, r, capMat, rng, spots=5, y0=0, lean=0){
  const top = new THREE.Vector3(x + lean, y0 + h, z);
  acc.add(cyl(r*.3, r*.2, h, 10), C.stem, atR(x, y0, z, 0, 0, -lean/h));
  cap(acc, capMat, top.x, top.y, top.z, r, .6, spots, rng);
}
/* a disc sat on a cylinder wall (doors, windows), facing out at angle phi */
function onWall(acc, mat, R, y, phi, r, depth=.03, sy=1){
  acc.add(new THREE.CylinderGeometry(r, r, depth, 16).rotateX(Math.PI/2), mat, at(Math.sin(phi)*R, y, Math.cos(phi)*R, phi, 1, sy, 1));
}
function roundDoor(acc, R, phi, r=.085, y0=0){
  onWall(acc, C.woodD, R + .006, y0 + r*1.05, phi, r*1.18, .03);
  onWall(acc, C.wood, R + .014, y0 + r*1.05, phi, r, .03);
  acc.add(SPH, C.knob, at(Math.sin(phi + .35)*(R + .03), y0 + r*1.0, Math.cos(phi + .35)*(R + .03), 0, .014, .014, .014));
  acc.add(cyl(r*1.4, r*1.3, .025, 12), C.stoneL, at(Math.sin(phi)*(R + .07), y0, Math.cos(phi)*(R + .07)));            // doorstep
}
function roundWindow(acc, R, y, phi, r=.05){ onWall(acc, C.woodD, R + .004, y, phi, r*1.3, .025); onWall(acc, C.window, R + .012, y, phi, r, .025); }
function lantern(acc, x, y, z, s=1){
  acc.add(cyl(.028*s, .028*s, .05*s, 6), LANTERN, at(x, y - .05*s, z));
  acc.add(new THREE.ConeGeometry(.04*s, .03*s, 6).translate(0, .015*s, 0), C.woodD, at(x, y, z));
  acc.add(cyl(.004, .004, .05*s, 4), C.woodD, at(x, y + .02*s, z));
}
function mossPatch(acc, r, rad, n=7, y=.01){ for (let i=0;i<n;i++){ const a = r()*6.28, d = r()*rad, s = .06 + r()*.07;
  acc.add(ICO, i%2 ? C.moss : C.mossL, at(Math.cos(a)*d, y, Math.sin(a)*d, r()*3, s, s*.35, s)); } }
function tinyShrooms(acc, r, n, rad, mats){ for (let i=0;i<n;i++){ const a = r()*6.28, d = rad*(.5 + r()*.5), x = Math.cos(a)*d, z = Math.sin(a)*d, h = .03 + r()*.04;
  acc.add(cyl(.008, .006, h, 5), C.stem, at(x, 0, z)); acc.add(HEMI, mats[i % mats.length], at(x, h, z, 0, .025 + r()*.012, .02, .025 + r()*.012)); } }

/* ── BLUEPRINT (the castle/village cells) ── */
const B = (id, name, kind, x, z, extra = {}) => ({ id, cat:'building', gate:'lesson', name, kind, x, z, ...extra });
const Tr = (id, name, kind, x, z, extra = {}) => ({ id, cat:'tree', gate:'vocab', name, kind, x, z, ...extra });
const P = (id, name, kind, x, z, extra = {}) => ({ id, cat:'path', gate:'todos', name, kind, x, z, ...extra });
const Wt = (id, name, kind, x, z, extra = {}) => ({ id, cat:'water', gate:'breathe', name, kind, x, z, ...extra });
export const FAIRY = [
  // ── ring 1: the toadstool manor, a dewdrop fountain, an enchanted tree, stepping stones, a giant mushroom + a fairy ring ──
  B('manor', 'Toadstool manor', 'manor', 2, 2, { w:2, d:2 }),
  Wt('dewfount', 'Dewdrop fountain', 'fountain', 4, 2),
  Tr('twist1', 'Enchanted tree', 'kittree', 4, 3, { model:'TwistedTree_1', h:1.3, tint:'teal', rot:20 }),
  P('stones3_4', 'Stepping stones', 'stones', 3, 4),
  // ── ring 2 ──
  B('stump', 'Stump home', 'stump', 2, 1),
  B('acorn', 'Acorn cottage', 'acorn', 3, 1),
  B('treehouse', 'Lantern tree house', 'treehouse', 4, 1),
  Wt('waterfall', 'Tiny waterfall', 'waterfall', 5, 1),
  Wt('pond', 'Moonlit pond', 'pond', 5, 4),
  Tr('fern1', 'Giant ferns', 'ferns', 5, 3),
  Tr('willow', 'Weeping willow', 'willow', 5, 5),
  // ── ring 3 ──
  { id:'treeoflight', cat:'special', gate:'gita', name:'Tree of Light', kind:'lighttree', x:0, z:5, w:2, d:2 },    // front-left: never occluded
  B('cottage', 'Toadstool cottage', 'toadstool', 2, 0, { capC:'lilac', rot:.5 }),
  B('tower', 'Mushroom tower', 'mtower', 4, 0),
  B('stump2', 'Hollow stump', 'stump', 6, 0, { v:1 }),
  B('inn', 'Toadstool inn', 'toadstool', 6, 1, { capC:'teal', rot:-.3, big:true }),
  Wt('brook', 'Lily brook', 'brook', 6, 2),
  Tr('twist2', 'Tall enchanted tree', 'kittree', 5, 0, { model:'TwistedTree_5', h:1.5, tint:'lilac', rot:70 }),
  Tr('fern2', 'Fern grove', 'ferns', 6, 5, { v:1 }),
  Tr('twist3', 'Twisted oak', 'kittree', 6, 6, { model:'TwistedTree_3', h:1.25, tint:'teal', rot:140 }),
  // Sudoku / Math → giant mushrooms that grow (button → tall cap → glowing spotted giant) and fairy rings
  ...[[1,1,'red'],[1,3,'lilac'],[1,4,'red'],[6,3,'teal'],[6,4,'pink']].map(([x,z,c],i) => ({ id:'shroom'+x+'_'+z, cat:'crop', gate:i%2 ? 'mathtricks' : 'sudoku', name:'Giant mushroom', kind:'shroom', x, z, stages:5, capC:c })),
  ...[[2,4],[4,4],[2,5],[4,5],[4,6]].map(([x,z],i) => ({ id:'ring'+x+'_'+z, cat:'crop', gate:i===2 ? 'mathtricks' : 'sudoku', name:'Flower ring', kind:'ring', x, z, stages:5, hue:i })),
  // To-dos → stepping stones, lantern posts, tiny bridges, twig fences, snail shells
  P('lampost', 'Lantern post', 'lampost', 1, 2),
  P('lampstones', 'Lantern stones', 'stones', 5, 2, { lamps:true }),
  P('stones3_5', 'Stepping stones', 'stones', 3, 5, { v:1 }),
  P('bridge', 'Twig bridge', 'twigbridge', 3, 0),
  P('shells', 'Snail-shell path', 'stones', 2, 6, { shells:true }),
  P('glowstones', 'Glow-cap path', 'stones', 3, 6, { glowcaps:true }),
  { id:'fence1', cat:'path', gate:'todos', name:'Twig fence', kind:'fence', x:0, z:0, edge:'w', len:2 },
  { id:'fence2', cat:'path', gate:'todos', name:'Twig fence', kind:'fence', x:0, z:2, edge:'w', len:2 },
  { id:'fernhedge', cat:'path', gate:'todos', name:'Fern hedge', kind:'fernhedge', x:0, z:4, edge:'w', len:1 },
  { id:'lights', cat:'path', gate:'todos', name:'Fairy lights', kind:'lights', x:5, z:6, edge:'s', len:2 }
];
export const FAIRY_ORDER = ['manor','ring2_4','twist1','dewfount','stones3_4','ring4_4',
  'stones3_5','treehouse','shroom1_3','stump','willow','lampost','ring4_5','waterfall','fern1','shroom1_4','acorn','lampstones','shroom1_1','pond','ring2_5',
  'treeoflight','glowstones','brook','fence1','twist2','cottage','shroom6_3','inn','fence2','tower','shells','fern2','shroom6_4','twist3','fernhedge','ring4_6','stump2','bridge','lights'];

/* ── TOADSTOOL MANOR (ring-1 hero, 2×2): a fat spotted-red toadstool house with a round door and glowing windows, a lilac
   annexe, a chimney, a lantern, a garden of glow-caps on a moss yard ── */
function buildManor(g){
  const r = rngFrom(211), yard = new Acc();
  yard.add(new THREE.CylinderGeometry(.9, .93, .04, 32), C.moss, at(0, .02, 0));
  mossPatch(yard, r, .8, 10, .04);
  const yg = new THREE.Group(); yard.into(yg); yg.userData.ghostHide = true; g.add(yg);
  const h = new THREE.Group(); h.rotation.y = Math.PI/4; g.add(h);
  const a = new Acc();
  // main house: bulging stem + big cap
  a.add(new THREE.LatheGeometry([[.3,0],[.36,.1],[.37,.3],[.33,.55],[.27,.72],[0,.72]].map(([x,y]) => new THREE.Vector2(x, y)), 18), C.stem, at(-.1, 0, -.12));
  roundDoorAt(a, -.1, -.12, .36, 0, .1);
  roundWindowAt(a, -.1, -.12, .36, .47, .55, .055); roundWindowAt(a, -.1, -.12, .35, .44, -.6, .05); roundWindowAt(a, -.1, -.12, .35, .5, 1.5, .045);
  cap(a, C.capRed, -.1, .66, -.12, .6, .62, 0);
  const spots = [[.15,0],[.5,.8],[.55,-.7],[.6,2.2],[.45,1.6],[.7,-1.7],[.35,3],[.75,.2],[.7,1.2],[.72,-.3]];
  spots.forEach(([th, ph], i) => { const R = .6, p = new THREE.Vector3(Math.sin(th)*Math.sin(ph)*R, Math.cos(th)*R*.62, Math.sin(th)*Math.cos(ph)*R), s = .07 + (i%3)*.02;
    a.add(SPH, C.spot, at(-.1 + p.x, .66 + p.y, -.12 + p.z, 0, s, s*.5, s)); });
  // chimney poking through the cap
  a.add(cyl(.05, .045, .3, 8), C.stoneD, at(-.34, .8, -.3)); a.add(cyl(.06, .06, .04, 8), C.stone, at(-.34, 1.1, -.3));
  // annexe: a smaller lilac toadstool joined on the right
  a.add(cyl(.2, .17, .42, 14), C.stem, at(.44, 0, .02));
  roundWindowAt(a, .44, .02, .2, .24, .3, .045);
  cap(a, C.capLilac, .44, .4, .02, .32, .6, 0);
  [[.3,.5],[.55,-.4],[.6,1.4],[.4,2.5]].forEach(([th,ph]) => { const R = .32, p = new THREE.Vector3(Math.sin(th)*Math.sin(ph)*R, Math.cos(th)*R*.6, Math.sin(th)*Math.cos(ph)*R);
    a.add(SPH, C.spot, at(.44 + p.x, .4 + p.y, .02 + p.z, 0, .045, .022, .045)); });
  // a tiny third toadstool (pantry) at the back left
  a.add(cyl(.11, .09, .24, 10), C.stem, at(-.55, 0, .35)); cap(a, C.capGold, -.55, .23, .35, .17, .6, 3, r);
  // lantern post, path stones to the door, glow-caps
  a.add(cyl(.018, .014, .5, 6), C.woodD, at(.22, 0, .58)); a.add(new THREE.BoxGeometry(.12, .015, .015), C.woodD, at(.17, .49, .58)); lantern(a, .12, .47, .58, 1.1);
  [[-.1,.35],[-.05,.52],[.02,.7]].forEach(([x,z], i) => a.add(cyl(.075, .07, .02, 9), i%2 ? C.stone : C.stoneL, at(x, .02, z, i)));
  a.into(h);
  const gl = new Acc(); tinyGlow(gl, r, [[.55,.45],[.62,.3],[-.5,.55],[-.62,.4],[.6,-.5]]); gl.into(h);
}
/* wall helpers for houses whose stem is not at the origin */
function roundDoorAt(acc, cx, cz, R, y0, r){ const t = new Acc(); roundDoor(t, R, 0, r, y0); for (const [m, list] of t.m) list.forEach(gg => acc.add(gg, m, at(cx, 0, cz))); }
function roundWindowAt(acc, cx, cz, R, y, phi, r){ const t = new Acc(); roundWindow(t, R, y, phi, r); for (const [m, list] of t.m) list.forEach(gg => acc.add(gg, m, at(cx, 0, cz))); }
function tinyGlow(acc, r, spots){ spots.forEach(([x,z], i) => { const h = .06 + r()*.06; acc.add(cyl(.012, .01, h, 6), C.stem, at(x, .03, z));
  acc.add(HEMI, GLOWS[i % 3], at(x, .03 + h, z, 0, .045, .035, .045)); }); }

/* ── small toadstool house (cottage / inn) ── */
function buildToadstool(g, s){
  const r = rngFrom(s.x*13 + s.z*7), h = new THREE.Group(); h.rotation.y = Math.PI/4 + (s.rot || 0); g.add(h);
  const a = new Acc(), k = s.big ? 1.12 : 1;
  a.add(new THREE.CylinderGeometry(.36*k, .38*k, .03, 20), C.moss, at(0, .015, 0));
  a.add(new THREE.LatheGeometry([[.2,0],[.24,.08],[.25,.26],[.21,.44],[0,.44]].map(([x,y]) => new THREE.Vector2(x*k, y*k)), 16), C.stem, at(0, 0, 0));
  roundDoor(a, .245*k, 0, .075*k, 0); roundWindow(a, .235*k, .32*k, .9, .04*k); roundWindow(a, .23*k, .34*k, -.8, .036*k);
  cap(a, CAPS[s.capC], 0, .4*k, 0, .42*k, .62, 7, r);
  if (s.big) { a.add(new THREE.BoxGeometry(.16, .015, .015), C.woodD, at(.28, .5, .12)); lantern(a, .34, .48, .14); }
  else lantern(a, .27, .3, .18, .9);
  a.into(h);
  const gl = new Acc(); tinyGlow(gl, r, [[.3,-.2],[-.28,.25]]); gl.into(h);
}
/* ── STUMP HOME: a fat tree stump with bark ribs, roots, a round door, a mossy cone roof + chimney, shelf fungi ── */
function buildStump(g, s){
  const r = rngFrom(s.x*31 + s.z*3 + 5), h = new THREE.Group(); h.rotation.y = Math.PI/4 + (s.v ? -.5 : 0); g.add(h);
  const a = new Acc(), R = .3, H = s.v ? .42 : .5;
  a.add(cyl(.34, .29, H, 14), C.bark, at(0, 0, 0));
  for (let i=0;i<14;i++){ const ph = i/14*6.28 + .2; a.add(new THREE.BoxGeometry(.035, H*.95, .04), C.barkD, at(Math.sin(ph)*.31, H*.47, Math.cos(ph)*.31, ph)); }
  for (let i=0;i<5;i++){ const ph = i/5*6.28 + .6; a.add(new THREE.ConeGeometry(.07, .3, 5).rotateZ(Math.PI/2).translate(.15, 0, 0), C.bark, atR(Math.sin(ph)*.28, .04, Math.cos(ph)*.28, 0, ph - Math.PI/2, .25)); }
  roundDoor(a, .31, 0, .085, 0); roundWindow(a, .3, .34, 1.1, .045); roundWindow(a, .3, .3, -1.2, .04);
  if (s.v) {         // hollow stump: open top with rings, a little ladder and a glow-cap garden on top
    a.add(cyl(.27, .27, .02, 14), C.ring, at(0, H, 0)); a.add(cyl(.18, .18, .022, 14), C.woodL, at(0, H, 0)); a.add(cyl(.08, .08, .024, 12), C.ring, at(0, H, 0));
    tinyGlowAcc(a, r, H);
  } else {
    a.add(new THREE.ConeGeometry(.4, .34, 12).translate(0, .17, 0), C.roofT, at(0, H - .02, 0));
    for (let i=0;i<9;i++){ const ph = i/9*6.28; a.add(ICO, C.mossL, at(Math.sin(ph)*.36, H + .01, Math.cos(ph)*.36, ph, .06, .04, .06)); }
    a.add(cyl(.045, .04, .22, 7), C.stoneD, at(-.12, H + .1, -.1)); a.add(cyl(.055, .055, .03, 7), C.stone, at(-.12, H + .32, -.1));
  }
  // shelf fungi on the side
  [[1.9,.18],[2.2,.28],[-2.3,.22]].forEach(([ph,y]) => a.add(HEMI, C.capGold, at(Math.sin(ph)*.32, y, Math.cos(ph)*.32, ph, .08, .03, .06)));
  a.add(cyl(.02, .016, .36, 6), C.woodD, at(.33, 0, .2)); lantern(a, .33, .4, .2, .9);
  a.into(h);
}
function tinyGlowAcc(a, r, y){ [[.1,.05],[-.08,.12],[.02,-.12]].forEach(([x,z], i) => { const h = .05 + r()*.05; a.add(cyl(.012, .01, h, 6), C.stem, at(x, y, z)); a.add(HEMI, GLOWS[i], at(x, y + h, z, 0, .05, .04, .05)); }); }
/* ── ACORN COTTAGE: a golden acorn with a bumpy cap and stalk, a round door and window, a flower box ── */
function buildAcorn(g, s){
  const r = rngFrom(77), h = new THREE.Group(); h.rotation.y = Math.PI/4; g.add(h);
  const a = new Acc();
  a.add(new THREE.CylinderGeometry(.34, .36, .03, 18), C.moss, at(0, .015, 0));
  a.add(SPH, C.acorn, at(0, .32, 0, 0, .3, .34, .3));
  a.add(HEMI, C.acornCap, at(0, .43, 0, 0, .34, .22, .34));
  for (let i=0;i<22;i++){ const th = .4 + r()*1.0, ph = r()*6.28; a.add(ICO, i%2 ? C.acornCapL : C.acornCap, at(Math.sin(th)*Math.cos(ph)*.33, .43 + Math.cos(th)*.21, Math.sin(th)*Math.sin(ph)*.33, r()*3, .05, .035, .05)); }
  a.add(new THREE.TorusGeometry(.33, .035, 6, 22).rotateX(Math.PI/2), C.acornCapL, at(0, .44, 0));
  a.add(cyl(.03, .02, .14, 6), C.woodD, atR(0, .62, 0, 0, 0, -.35));
  roundDoor(a, .285, 0, .08, .02); roundWindow(a, .26, .36, .95, .045);
  a.add(new THREE.BoxGeometry(.14, .04, .05), C.wood, at(Math.sin(.95)*.3, .3, Math.cos(.95)*.3, .95));
  [0xFF8FB8, 0xFFE07A, 0xB7A2F0].forEach((c, i) => a.add(SPH, [C.capPink, C.capGold, C.capLilac][i], at(Math.sin(.95)*.31 + Math.cos(.95)*(i-1)*.04, .33, Math.cos(.95)*.31 - Math.sin(.95)*(i-1)*.04, 0, .022, .022, .022)));
  a.add(cyl(.018, .014, .4, 6), C.woodD, at(.3, 0, .22)); lantern(a, .3, .44, .22, .9);
  a.into(h);
}
/* ── LANTERN TREE HOUSE: a trunk with a teal canopy, a ringed platform holding a tiny lilac-roofed hut, ladder, lanterns ── */
function buildTreehouse(g){
  const r = rngFrom(515), h = new THREE.Group(); h.rotation.y = Math.PI/4; g.add(h);
  const a = new Acc();
  a.add(cyl(.12, .085, 1.05, 9), C.bark, at(-.08, 0, -.08));
  for (let i=0;i<4;i++){ const ph = i/4*6.28 + .4; a.add(new THREE.ConeGeometry(.05, .24, 5).rotateZ(Math.PI/2).translate(.1, 0, 0), C.bark, atR(-.08 + Math.sin(ph)*.1, .03, -.08 + Math.cos(ph)*.1, 0, ph - Math.PI/2, .3)); }
  [[-.25,1.0,-.2,.28,C.leaf],[.12,1.08,-.14,.26,C.leafT],[-.1,1.24,-.08,.26,C.leafL],[-.26,.95,.1,.2,C.leafT],[.05,.98,.14,.2,C.leaf]].forEach(([x,y,z,s,m]) => a.add(ICO, m, at(x, y, z, r()*3, s, s*.8, s)));
  a.add(cyl(.33, .33, .04, 14), C.woodL, at(0, .5, 0));
  for (let i=0;i<12;i++){ const ph = i/12*6.28; a.add(cyl(.012, .012, .1, 4), C.woodD, at(Math.sin(ph)*.32, .54, Math.cos(ph)*.32)); }
  a.add(new THREE.TorusGeometry(.32, .01, 4, 24).rotateX(Math.PI/2), C.woodD, at(0, .64, 0));
  [[.28,.28],[-.28,.28],[.28,-.28]].forEach(([x,z]) => a.add(cyl(.018, .015, .5, 5), C.woodD, at(x*.9, 0, z*.9)));
  // hut
  a.add(new THREE.BoxGeometry(.24, .2, .22), C.woodL, at(.06, .64, .06));
  a.add(new THREE.ConeGeometry(.22, .2, 4).rotateY(Math.PI/4).translate(0, .1, 0), C.roofL, at(.06, .74, .06));
  a.add(new THREE.CylinderGeometry(.045, .045, .02, 12).rotateX(Math.PI/2), C.window, at(.06, .66, .175));
  a.add(new THREE.BoxGeometry(.07, .12, .02), C.woodD, at(.19, .6, .06, Math.PI/2));
  // ladder
  [-.05, .05].forEach(dx => a.add(new THREE.BoxGeometry(.015, .52, .015), C.woodD, atR(.1 + dx, .25, .36, -.18, 0, 0)));
  for (let i=0;i<5;i++) a.add(new THREE.BoxGeometry(.11, .012, .012), C.wood, at(.1, .06 + i*.1, .36 - i*.018));
  // lanterns hanging from the canopy
  [[.2,.86,.12],[-.28,.8,.16],[.14,.84,-.28]].forEach(([x,y,z]) => { a.add(cyl(.003, .003, .12, 3), C.woodD, at(x, y, z)); lantern(a, x, y, z, .9); });
  a.into(h);
}
/* ── MUSHROOM TOWER: a tall stem with a spiral of windows, two shelf caps and a big teal cap with a spire ── */
function buildTower(g){
  const r = rngFrom(88), h = new THREE.Group(); h.rotation.y = Math.PI/4; g.add(h);
  const a = new Acc();
  a.add(new THREE.CylinderGeometry(.34, .36, .03, 18), C.moss, at(0, .015, 0));
  a.add(new THREE.LatheGeometry([[.2,0],[.22,.1],[.17,.5],[.15,.95],[0,.95]].map(([x,y]) => new THREE.Vector2(x, y)), 14), C.stem, at(0, 0, 0));
  roundDoor(a, .215, 0, .07, 0);
  for (let i=0;i<4;i++) roundWindow(a, .19 - i*.012, .3 + i*.16, .9 + i*1.5, .035);
  a.add(HEMI, C.capGold, at(.14, .36, -.08, 0, .14, .05, .1)); a.add(HEMI, C.capLilac, at(-.12, .6, .1, 0, .12, .045, .1));
  cap(a, C.capTeal, 0, .9, 0, .36, .7, 7, r);
  a.add(new THREE.ConeGeometry(.04, .2, 6).translate(0, .1, 0), C.stemD, at(0, .9 + .36*.7 - .02, 0)); a.add(SPH, GLOWS[2], at(0, 1.35, 0, 0, .035, .035, .035));
  a.into(h);
}

/* ── GIANT MUSHROOM (grows): buttons → short cap → tall cap → tall spotted → glowing spotted giant with glow-caps + spores ── */
function fillShroom(plants, s, stage){
  plants.clear();
  const st = Math.min(5, stage), r = rngFrom(s.x*31 + s.z*7 + 5), acc = new Acc(), capM = st >= 5 ? GCAP[s.capC] : CAPS[s.capC];
  if (st === 1) { [[0,0,.06],[.12,.1,.045],[-.1,.12,.04]].forEach(([x,z,k]) => { acc.add(SPH, C.stem, at(x, .02, z, 0, k*.6, k*.5, k*.6)); acc.add(HEMI, CAPS[s.capC], at(x, .04, z, 0, k, k*.8, k)); }); }
  else {
    const H = [0, 0, .14, .32, .5, .62][st], R = [0, 0, .14, .24, .32, .38][st];
    mushroom(acc, 0, 0, H, R, capM, r, st >= 4 ? 8 : st === 3 ? 4 : 0, 0, st >= 4 ? .03 : 0);
    if (st >= 3) mushroom(acc, .25, .18, H*.4, R*.42, CAPS[s.capC], r, 2);
    if (st >= 4) mushroom(acc, -.22, .24, H*.28, R*.32, CAPS[s.capC], r, 0);
    if (st >= 5) { mushroom(acc, .2, -.25, .12, .09, GLOWS[s.x % 3], r, 0);
      for (let i=0;i<6;i++){ const a = r()*6.28, d = .15 + r()*.3; acc.add(new THREE.OctahedronGeometry(.018, 0), GLOWS[i % 3], at(Math.cos(a)*d, .7 + r()*.35, Math.sin(a)*d, r()*3)); } }
  }
  acc.into(plants); plants.userData.stage = stage;
}
function buildShroom(g, s, stage){
  const acc = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 11);
  acc.add(new THREE.CylinderGeometry(.4, .42, .035, 18), C.moss, at(0, .018, 0)); mossPatch(acc, r, .34, 6, .03);
  const bed = new THREE.Group(); acc.into(bed); bed.userData.ghostHide = true; g.add(bed);
  const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillShroom(plants, s, st);
  fillShroom(plants, s, stage);
}
/* ── FLOWER RING (grows): a fairy ring on moss — sprouts → buttons → a ring of toadstools → bells between → glowing heart + motes ── */
const BELLS = [C.capPink, C.capLilac, GLOWS[0], C.capGold, GLOWS[1]];
function fillRing(plants, s, stage){
  plants.clear();
  const st = Math.min(5, stage), r = rngFrom(s.x*17 + s.z*5 + 9), acc = new Acc(), n = 9, cm = [C.capRed, C.capLilac, C.capPink, C.capTeal, C.capGold][s.hue % 5];
  for (let i=0;i<n;i++){ const a = i/n*6.28 + r()*.2, d = .3 + r()*.03, x = Math.cos(a)*d, z = Math.sin(a)*d;
    if (st === 1) { acc.add(new THREE.ConeGeometry(.018, .06, 5).translate(0, .03, 0), C.leafL, at(x, .03, z)); continue; }
    const hh = [0, 0, .03, .07, .09, .1][st]*(.8 + r()*.4), rr = [0, 0, .035, .055, .065, .07][st];
    acc.add(cyl(rr*.3, rr*.22, hh, 6), C.stem, at(x, .03, z)); acc.add(HEMI, st >= 5 && i%2 ? GCAP[['red','lilac','pink','teal','gold'][s.hue % 5]] : cm, at(x, .03 + hh, z, 0, rr, rr*.7, rr));
    if (st >= 4) { const a2 = a + Math.PI/n, x2 = Math.cos(a2)*.33, z2 = Math.sin(a2)*.33, fh = .1 + r()*.06;
      acc.add(cyl(.006, .005, fh, 4), C.leaf, at(x2, .03, z2)); acc.add(new THREE.ConeGeometry(.03, .045, 6).rotateX(Math.PI).translate(0, .02, 0), BELLS[(s.hue + i) % BELLS.length], at(x2, .03 + fh - .02, z2)); }
  }
  if (st >= 3) { acc.add(new THREE.CylinderGeometry(.14, .15, .012, 16), C.mossL, at(0, .03, 0)); }
  if (st >= 5) { acc.add(SPH, GLOWS[(s.hue + 2) % 3], at(0, .07, 0, 0, .05, .05, .05));
    for (let i=0;i<5;i++){ const a = r()*6.28, d = r()*.25; acc.add(new THREE.OctahedronGeometry(.02, 0), GLOWS[i % 3], at(Math.cos(a)*d, .35 + r()*.25, Math.sin(a)*d, r()*3)); } }
  acc.into(plants); plants.userData.stage = stage;
}
function buildRing(g, s, stage){
  const acc = new Acc(), r = rngFrom(s.x*5 + s.z*13 + 3);
  acc.add(new THREE.CylinderGeometry(.42, .44, .03, 20), C.moss, at(0, .015, 0)); mossPatch(acc, r, .4, 5, .025);
  const bed = new THREE.Group(); acc.into(bed); bed.userData.ghostHide = true; g.add(bed);
  const plants = new THREE.Group(); g.add(plants); g.userData.plants = plants; g.userData.regrow = st => fillRing(plants, s, st);
  fillRing(plants, s, stage);
}

/* ── water ── */
function rockRing(acc, r, R, n, y=.03, k=1){ for (let i=0;i<n;i++){ const a = i/n*6.28 + r()*.2, s = (.06 + r()*.03)*k;
  acc.add(DOD, [C.stone, C.stoneD, C.stoneL][i%3], at(Math.cos(a)*R, y, Math.sin(a)*R, r()*3, s, s*.7, s)); if (i%3 === 0) acc.add(ICO, C.mossL, at(Math.cos(a)*R, y + s*.55, Math.sin(a)*R, 0, s*.8, s*.3, s*.8)); } }
function buildFountain(g){
  const r = rngFrom(301), a = new Acc();
  a.add(cyl(.36, .34, .1, 18), C.stoneD, at(0, 0, 0)); a.add(cyl(.3, .3, .012, 18), C.water, at(0, .09, 0));
  rockRing(a, r, .34, 11, .1);
  a.add(cyl(.07, .05, .26, 8), C.stone, at(0, .09, 0));
  // a leaf cup holding a great dewdrop
  a.add(new THREE.SphereGeometry(1, 14, 6, 0, Math.PI*2, Math.PI/2, Math.PI/2), C.leafL, at(0, .44, 0, 0, .19, .1, .19));
  for (let i=0;i<5;i++){ const ph = i/5*6.28; a.add(new THREE.ConeGeometry(.07, .16, 4).rotateX(-Math.PI/2 - .6).translate(0, 0, .12), C.leaf, at(0, .38, 0, ph)); }
  a.add(SPH, C.dew, at(0, .5, 0, 0, .13, .12, .13)); a.add(SPH, C.foam, at(-.04, .56, .05, 0, .025, .02, .025));
  for (let i=0;i<5;i++){ const ph = i/5*6.28 + .3; for (let j=0;j<3;j++){ const d = .12 + j*.055, y = .44 - j*j*.05; a.add(SPH, C.dew, at(Math.cos(ph)*d, y, Math.sin(ph)*d, 0, .016, .02, .016)); } }
  [[-.18,.2],[.2,-.16]].forEach(([x,z]) => a.add(new THREE.CylinderGeometry(.05, .05, .006, 10), C.pad, at(x, .1, z)));
  a.into(g);
}
function buildWaterfall(g){
  const r = rngFrom(404), a = new Acc();
  a.add(new THREE.CylinderGeometry(.4, .42, .04, 18), C.moss, at(0, .02, 0));
  a.add(new THREE.CylinderGeometry(.24, .24, .012, 16), C.water, at(.08, .05, .1));
  rockRing(a, r, .27, 10, .04);
  // the rock stack at the back
  [[-.2,.1,-.18,.2],[-.02,.1,-.26,.18],[-.24,.3,-.08,.16],[-.1,.32,-.2,.16],[-.18,.5,-.18,.13],[-.28,.18,.08,.13]].forEach(([x,y,z,s], i) =>
    a.add(DOD, [C.stoneD, C.stone, C.stoneL][i%3], at(x, y, z, i, s, s*.9, s)));
  [[-.18,.62,-.18],[-.26,.4,-.02],[.0,.2,-.3]].forEach(([x,y,z]) => a.add(ICO, C.mossL, at(x, y, z, 0, .1, .04, .1)));
  // the falling sheet + foam
  a.add(new THREE.BoxGeometry(.13, .5, .02), C.water, atR(-.06, .32, -.04, -.12, Math.PI/4, 0));
  a.add(new THREE.BoxGeometry(.1, .02, .12), C.water, at(-.1, .56, -.1, Math.PI/4));
  for (let i=0;i<6;i++) a.add(SPH, C.foam, at(-.02 + r()*.12, .07, r()*.1, 0, .03 + r()*.02, .02, .03 + r()*.02));
  a.add(SPH, GLOWS[0], at(.2, .1, .22, 0, .03, .03, .03));
  a.into(g);
  const f = KITCACHE.a.Fern_1; if (f) addModel(g, 'Fern_1', fitScale(f, .34, .34), .26, 0, -.22, 1, 'a');
}
function buildPond(g){
  const r = rngFrom(505), a = new Acc();
  a.add(new THREE.CylinderGeometry(.44, .46, .03, 24), C.moss, at(0, .015, 0));
  a.add(new THREE.CylinderGeometry(.36, .36, .012, 24), C.waterN, at(0, .035, 0));
  rockRing(a, r, .39, 13, .04, .9);
  [[-.12,.08,.07],[.12,-.1,.06],[.1,.16,.05],[-.14,-.14,.045]].forEach(([x,z,s], i) => {
    const pad = new THREE.CylinderGeometry(s, s, .006, 14, 1, false, .4, 5.6); a.add(pad, C.pad, at(x, .045, z, i));
    if (i < 3) { a.add(new THREE.ConeGeometry(.03, .04, 6).translate(0, .02, 0), C.lotus, at(x, .048, z)); a.add(SPH, GLOWS[2], at(x, .06, z, 0, .012, .012, .012)); } });
  for (let i=0;i<5;i++){ const x = -.3 + i*.03, z = .22 + (i%2)*.04, hh = .22 + r()*.12; a.add(cyl(.006, .004, hh, 4), C.leaf, at(x, .03, z)); if (i%2) a.add(cyl(.014, .014, .06, 6), C.woodD, at(x, .03 + hh - .07, z)); }
  a.add(new THREE.CircleGeometry(.1, 16).rotateX(-Math.PI/2), GLOWS[4], at(.05, .043, -.02));      // the moon's reflection
  a.into(g);
}
function buildBrook(g){
  const r = rngFrom(606), a = new Acc();
  a.add(new THREE.BoxGeometry(.42, .012, .98), C.water, at(0, .04, 0));
  [-.25, .25].forEach(x => { for (let i=0;i<6;i++) a.add(DOD, [C.stone, C.stoneD, C.stoneL][i%3], at(x + (r()-.5)*.04, .04, -.42 + i*.17, r()*3, .06, .045, .07)); });
  [[-.08,-.3],[.1,.25]].forEach(([x,z], i) => { a.add(new THREE.CylinderGeometry(.055, .055, .006, 14, 1, false, .4, 5.6), C.pad, at(x, .05, z, i)); a.add(new THREE.ConeGeometry(.025, .035, 6).translate(0, .017, 0), C.lotus, at(x, .053, z)); });
  // an arched twig footbridge across
  for (let i=0;i<7;i++){ const t = i/6, x = -.3 + t*.6, y = .06 + Math.sin(t*Math.PI)*.1; a.add(new THREE.BoxGeometry(.08, .02, .22), i%2 ? C.wood : C.woodL, atR(x, y, 0, 0, 0, Math.cos(t*Math.PI)*.45)); }
  [-.12, .12].forEach(z => { for (let i=0;i<3;i++){ const x = -.26 + i*.26, y = .06 + Math.sin((i/2)*Math.PI*.8 + .3)*.1; a.add(cyl(.01, .008, .14, 4), C.woodD, at(x, y, z)); }
    a.add(new THREE.TorusGeometry(.3, .008, 4, 12, Math.PI).rotateY(0), C.woodD, at(0, .02, z, 0, 1, .62, 1)); });
  a.into(g);
}

/* ── trees ── */
/* the MegaKit twisted trees ship autumn-red: re-colour the leaf texture by luminance into teal / lilac */
const TINT = { teal:[70, 196, 168], lilac:[184, 146, 236] };
const TINTED = new Map();
function lumaTint(tex, rgb){
  const im = tex.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i=0;i<a.length;i+=4){ const l = (a[i]*.3 + a[i+1]*.59 + a[i+2]*.11)/255, k = .45 + l*1.25;
    a[i] = Math.min(255, rgb[0]*k); a[i+1] = Math.min(255, rgb[1]*k); a[i+2] = Math.min(255, rgb[2]*k); }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; return t;
}
function kitTree(g, s){
  const t = KITCACHE.a[s.model]; if (!t) return;
  const m = addModel(g, s.model, fitScale(t, s.h, 1.05), 0, 0, 0, (s.rot||0)*Math.PI/180, 'a');
  if (m && s.tint) m.traverse(o => { if (o.isMesh && /Leaves/.test(o.material.name||'')) { const key = o.material.uuid + s.tint;
    if (!TINTED.has(key)) { const m2 = o.material.clone(); m2.onBeforeCompile = o.material.onBeforeCompile; m2.customProgramCacheKey = o.material.customProgramCacheKey;
      if (m2.map && m2.map.image) { m2.map = lumaTint(m2.map, TINT[s.tint]); m2.color.setHex(0xFFFFFF); } else m2.color.setRGB(...TINT[s.tint].map(v => v/255)).convertSRGBToLinear();
      TINTED.set(key, m2); }
    o.material = TINTED.get(key); } });
}
function buildFerns(g, s){
  const f = KITCACHE.a.Fern_1, p = KITCACHE.a.Plant_7; if (!f) return;
  const spots = s.v ? [[-.12,-.1,.72,0],[.2,.14,.52,2],[-.2,.24,.44,4]] : [[0,-.05,.85,.5],[.24,.2,.5,2.2],[-.24,.18,.46,3.8]];
  spots.forEach(([x,z,h,rot]) => addModel(g, 'Fern_1', fitScale(f, h, h*1.1), x, 0, z, rot, 'a'));
  if (p) addModel(g, 'Plant_7', fitScale(p, .3, .3), .25, 0, -.25, 1, 'a');
  const a = new Acc(); tinyGlow(a, rngFrom(s.x*3 + s.z), [[.3,.32],[-.33,-.2]]); a.into(g);
}
function buildWillow(g){
  const r = rngFrom(707), a = new Acc();
  a.add(cyl(.1, .07, .8, 8), C.bark, atR(0, 0, 0, 0, 0, .08));
  a.add(cyl(.05, .03, .3, 6), C.bark, atR(-.05, .6, 0, 0, 0, .6)); a.add(cyl(.05, .03, .3, 6), C.bark, atR(.02, .62, 0, 0, 1.2, -.6));
  [[0,.92,0,.36,C.leafT],[-.18,.85,.1,.22,C.leaf],[.16,.86,-.1,.24,C.leafL],[.05,1.08,.02,.24,C.leafL]].forEach(([x,y,z,s,m]) => a.add(ICO, m, at(x, y, z, r()*3, s, s*.7, s)));
  for (let i=0;i<30;i++){ const ph = i/30*6.28 + r()*.15, R = .3 + r()*.1, len = .35 + r()*.3, top = .88 + r()*.1;
    a.add(new THREE.BoxGeometry(.035, len, .03), i%3 ? C.leafT : C.leafL, atR(Math.cos(ph)*R, top - len/2, Math.sin(ph)*R, 0, -ph, .06)); }
  a.into(g);
}

/* ── path pieces ── */
function stonesAcc(a, r, v){
  const line = v ? [[-.3,.25],[-.08,.12],[.14,-.02],[.32,-.2]] : [[-.28,-.28],[-.06,-.08],[.12,.12],[.3,.3]];
  line.forEach(([x,z], i) => { const s = .1 + r()*.03; a.add(cyl(s, s*1.05, .025, 9), i%2 ? C.stone : C.stoneL, at(x, .005, z, r()*3, 1, 1, .85 + r()*.3)); });
  for (let i=0;i<5;i++){ const x = (r()-.5)*.8, z = (r()-.5)*.8; a.add(DOD, C.pebble, at(x, .01, z, r()*3, .025, .018, .025)); }
}
function buildStones(g, s){
  const r = rngFrom(s.x*19 + s.z*23), a = new Acc();
  stonesAcc(a, r, s.v || s.lamps || s.shells);
  tinyShrooms(a, r, 3, .42, [C.capRed, C.capLilac]);
  if (s.lamps) { [[.32,-.32,.5],[-.32,.32,.4]].forEach(([x,z,hh]) => { a.add(cyl(.018, .014, hh, 6), C.woodD, atR(x, 0, z, 0, 0, .06));
    a.add(new THREE.BoxGeometry(.1, .014, .014), C.woodD, at(x - .04, hh - .02, z)); lantern(a, x - .08, hh - .03, z); }); }
  if (s.shells) { [[-.26,-.22,1],[.24,.26,.8],[.3,-.2,.6]].forEach(([x,z,k], i) => snailShell(a, x, z, k*.08, i)); }
  if (s.glowcaps) { [[.3,-.28],[-.3,.3],[.32,.32],[-.28,-.3]].forEach(([x,z], i) => { const h = .12 + (i%2)*.06; a.add(cyl(.014, .011, h, 6), C.stem, at(x, 0, z)); a.add(HEMI, GLOWS[i % 3], at(x, h, z, 0, .07, .05, .07)); }); }
  a.into(g);
  if (!s.lamps && !s.shells && !s.glowcaps) g.userData.ghostMode = 'marker';
}
function snailShell(a, x, z, s, i){
  const mat = [C.shell, C.shellD, C.capGold][i % 3];
  for (let k=0;k<4;k++){ const rr = s*(1 - k*.22); a.add(new THREE.TorusGeometry(rr*.62, rr*.38, 8, 16), k%2 ? mat : C.shell, at(x + k*s*.08, s*.62 + k*s*.02, z, .6, 1, 1, 1)); }
}
function buildLampost(g, s){
  const r = rngFrom(33), a = new Acc();
  stonesAcc(a, r, 1);
  // a crooked twig post with a curl and a hanging lantern
  a.add(cyl(.028, .022, .45, 6), C.woodD, atR(-.05, 0, -.05, 0, 0, .06)); a.add(cyl(.022, .016, .28, 6), C.woodD, atR(-.03, .44, -.05, 0, 0, -.25));
  a.add(new THREE.TorusGeometry(.05, .012, 5, 10, Math.PI*1.3), C.woodD, at(.07, .72, -.05));
  a.add(cyl(.003, .003, .08, 3), C.woodD, at(.12, .62, -.05)); lantern(a, .12, .62, -.05, 1.3);
  tinyShrooms(a, r, 4, .3, [C.capGold, C.capPink]);
  a.into(g);
}
function buildTwigBridge(g){
  const r = rngFrom(44), a = new Acc();
  a.add(new THREE.BoxGeometry(.98, .012, .3), C.water, at(0, .035, 0));
  for (let i=0;i<8;i++) a.add(DOD, C.pebble, at(-.45 + i*.13, .035, (i%2 ? .17 : -.17), r()*3, .04, .03, .05));
  for (let i=0;i<7;i++){ const t = i/6, z = -.3 + t*.6, y = .05 + Math.sin(t*Math.PI)*.12; a.add(new THREE.BoxGeometry(.3, .02, .085), i%2 ? C.wood : C.woodL, atR(0, y, z, Math.cos(t*Math.PI)*-.5, 0, 0)); }
  [-.14, .14].forEach(x => a.add(new THREE.TorusGeometry(.32, .01, 4, 12, Math.PI), C.woodD, at(x, .03, 0, Math.PI/2, 1, .7, 1)));
  a.add(cyl(.012, .01, .2, 4), C.woodD, at(.14, .05, .32)); lantern(a, .14, .26, .32, .8);
  a.into(g);
}
function buildFence(g, s){
  const a = new Acc(), r = rngFrom(s.z*11 + 3);
  for (let i=0;i<s.len;i++){ const o = i - (s.len-1)/2;
    for (let j=0;j<4;j++){ const z = o - .375 + j*.25, hh = .26 + r()*.08; a.add(cyl(.018, .012, hh, 5), C.woodD, atR(-.45, 0, z, (r()-.5)*.15, 0, (r()-.5)*.15)); }
    [.1, .19].forEach(y => a.add(new THREE.CylinderGeometry(.009, .009, 1, 4).rotateX(Math.PI/2), C.wood, atR(-.45, y + (r()-.5)*.02, o, (r()-.5)*.06, 0, 0)));
    for (let j=0;j<3;j++){ const z = o - .25 + j*.25; a.add(SPH, [C.capPink, C.capLilac, C.capGold][j], at(-.43, .22, z, 0, .02, .02, .02)); }
    a.add(HEMI, GLOWS[i % 3], at(-.4, 0, o + .3, 0, .04, .035, .04)); }
  a.into(g);
  const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}
function buildFernHedge(g, s){
  const f = KITCACHE.a.Fern_1; if (f) [-.32, 0, .32].forEach((z, i) => addModel(g, 'Fern_1', fitScale(f, .36 + (i%2)*.08, .4), -.43, 0, z, i*1.7, 'a'));
  const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}
function buildLights(g, s){
  const a = new Acc(), n = s.len*2;
  for (let i=0;i<=n;i++){ const x = -s.len/2 + i*.5; a.add(cyl(.018, .014, .46, 5), C.woodD, at(x, 0, .45)); a.add(SPH, GLOWS[i % 3], at(x, .47, .45, 0, .02, .02, .02)); }
  for (let i=0;i<n;i++){ const x0 = -s.len/2 + i*.5;
    for (let j=1;j<6;j++){ const t = j/6, x = x0 + t*.5, y = .44 - Math.sin(t*Math.PI)*.1; a.add(SPH, [LANTERN, GLOWS[0], GLOWS[1], GLOWS[3]][(i + j) % 4], at(x, y, .45, 0, .022, .026, .022)); }
    for (let j=0;j<24;j++){ const t = j/24, x = x0 + t*.5, y = .445 - Math.sin(t*Math.PI)*.1; a.add(new THREE.BoxGeometry(.022, .004, .004), C.woodD, at(x, y, .45)); } }
  a.into(g);
  const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}

/* ── THE TREE OF LIGHT (Gita, 2×2): a fairy ring of standing stones round a luminous pool; three roots twist up into one
   trunk and a lilac-and-teal canopy that glows, hung with light orbs ── */
function buildLightTree(g){
  const r = rngFrom(909), a = new Acc();
  a.add(new THREE.CylinderGeometry(.92, .95, .05, 36), C.moss, at(0, .025, 0)); mossPatch(a, r, .85, 12, .05);
  // standing stones
  for (let i=0;i<9;i++){ const ph = i/9*6.28 + .35, R = .78, hh = .26 + (i%2)*.08 + r()*.05;
    a.add(new THREE.CylinderGeometry(.05, .075, hh, 5).translate(0, hh/2, 0), [C.stone, C.stoneL, C.stoneD][i%3], atR(Math.cos(ph)*R, .03, Math.sin(ph)*R, (r()-.5)*.1, r()*3, (r()-.5)*.1));
    a.add(ICO, C.mossL, at(Math.cos(ph)*R, .03 + hh, Math.sin(ph)*R, 0, .06, .03, .06));
    a.add(new THREE.CylinderGeometry(.012, .012, .08, 4).rotateX(Math.PI/2), GLOWS[i % 3], at(Math.cos(ph)*(R + .066), .03 + hh*.55, Math.sin(ph)*(R + .066), -ph + Math.PI/2)); }
  // the owl's stone: a flat-topped one at the front (the owl perches here on completion)
  a.add(new THREE.CylinderGeometry(.09, .1, .34, 6).translate(0, .17, 0), C.stoneL, at(OWL_STONE[0], .03, OWL_STONE[1]));
  // luminous pool at the centre
  a.add(new THREE.CylinderGeometry(.46, .46, .02, 32), C.stoneL, at(0, .05, 0));
  a.add(new THREE.CylinderGeometry(.4, .4, .02, 32), GLOWS[0], at(0, .06, 0));
  a.add(new THREE.TorusGeometry(.43, .03, 6, 32).rotateX(Math.PI/2), GLOWS[2], at(0, .07, 0));
  // twisted trunk: three strands spiralling round each other
  for (let k=0;k<3;k++){ let prev = null;
    for (let i=0;i<=10;i++){ const t = i/10, ang = k*2.09 + t*4.4, rad = .1*(1 - t*.55), p = new THREE.Vector3(Math.cos(ang)*rad, .06 + t*1.2, Math.sin(ang)*rad);
      if (prev) { const d = p.clone().sub(prev), len = d.length(); const geo = new THREE.CylinderGeometry(.075*(1 - t*.45), .085*(1 - (t-.1)*.45), len*1.12, 7).translate(0, len/2, 0);
        _Q.setFromUnitVectors(new THREE.Vector3(0,1,0), d.normalize()); a.add(geo, C.bark, _M.compose(prev, _Q, new THREE.Vector3(1,1,1))); }
      prev = p; } }
  // roots spreading into the pool
  for (let i=0;i<5;i++){ const ph = i/5*6.28 + .5; a.add(new THREE.ConeGeometry(.05, .34, 5).rotateZ(Math.PI/2).translate(.17, 0, 0), C.barkD, atR(Math.cos(ph)*.1, .08, Math.sin(ph)*.1, 0, -ph, .15)); }
  // branches + glowing canopy
  const BR = [[.9,.5],[2.9,.45],[5,.5],[1.9,.4],[4,.42]];
  BR.forEach(([ph, l]) => { const d = new THREE.Vector3(Math.cos(ph), .8, Math.sin(ph)).normalize(); _Q.setFromUnitVectors(new THREE.Vector3(0,1,0), d);
    a.add(new THREE.CylinderGeometry(.018, .035, l, 5).translate(0, l/2, 0), C.bark, _M.compose(new THREE.Vector3(0, 1.15, 0), _Q, new THREE.Vector3(1,1,1))); });
  const canopy = [[0,1.5,0,.34,1],[.3,1.36,.1,.26,0],[-.28,1.38,.14,.26,2],[.1,1.34,-.3,.24,0],[-.12,1.32,-.26,.22,1],[.18,1.62,-.08,.2,2],[-.16,1.62,.1,.2,0],[.34,1.3,-.2,.18,1],[-.34,1.28,-.1,.18,2]];
  canopy.forEach(([x,y,z,s,gi]) => a.add(ICO, GLOWS[gi], at(x*1.3, y*1.12, z*1.3, r()*3, s*1.3, s*1.02, s*1.3)));
  // hanging light orbs
  [[.46,1.18,.28],[-.4,1.2,.38],[.34,1.22,-.46],[-.5,1.15,-.26],[.06,1.12,.5]].forEach(([x,y,z], i) => { a.add(cyl(.003, .003, .16, 3), C.woodD, at(x, y, z)); a.add(SPH, [GLOWS[2], LANTERN][i%2], at(x, y - .02, z, 0, .04, .04, .04)); });
  // motes rising from the pool
  for (let i=0;i<10;i++){ const ph = r()*6.28, d = r()*.35; a.add(new THREE.OctahedronGeometry(.02, 0), GLOWS[i % 3], at(Math.cos(ph)*d, .25 + r()*.7, Math.sin(ph)*d, r()*3)); }
  a.into(g);
}
const OWL_STONE = [.62, .58];     // hero-local (the hero's centre is cell 0.5, 5.5)

/* ── ground: deep mossy green with teal and lilac speckle; lilac-plum soil ── */
const MOSS_TILE = { top:['#5F9C58','#58934F'], side:'#4E8747', soilTop:'#7C6A86', soilBot:'#3B2E48' };
function mossTileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(161);
  g.fillStyle = '#EEF3EC'; g.fillRect(0,0,N,N);
  for (let i=0;i<16;i++){ const x = r()*N, y = r()*N, rad = 20 + r()*42, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const k = r(); gr.addColorStop(0, k < .35 ? 'rgba(140,235,215,.28)' : k < .6 ? 'rgba(210,190,255,.24)' : 'rgba(255,255,240,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0,0,N,N); }
  for (let i=0;i<260;i++){ const x = r()*N, y = r()*N, rr = 1 + r()*2.2; g.fillStyle = r() < .5 ? 'rgba(60,110,60,.14)' : 'rgba(250,255,240,.55)'; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.fill(); }
  for (let i=0;i<18;i++){ g.fillStyle = r() < .5 ? 'rgba(190,160,255,.5)' : 'rgba(255,240,170,.55)'; g.beginPath(); g.arc(r()*N, r()*N, 1.4, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ── ambient: drifting glowing spores and fireflies; the glow-caps breathe ── */
const SPORE = [0x9FF2E0, 0xD7B8FF, 0xFFE38A, 0xFFB8DA];
function addSpores(){
  V.spores = []; const r = rngFrom(58);
  for (let i=0;i<12;i++){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:SPORE[i%4], transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
    s.scale.setScalar(i%3 ? .12 : .17);
    s.userData = { ph:r()*6.28, rad:.4 + r()*V.ring*.75, h:.25 + r()*1.1, sp:.12 + r()*.16, cx:(r()-.5)*1.6, cz:(r()-.5)*1.6 };
    world.add(s); V.spores.push(s); V.life.push(s);
  }
  moveSpores(2.1);
}
function moveSpores(t){
  (V && V.spores || []).forEach(s => { const u = s.userData, a = t*u.sp + u.ph;
    s.position.set(u.cx + Math.cos(a)*u.rad, TILE_TOP + u.h + Math.sin(a*1.7)*.18 + ((t*.05 + u.ph) % 1)*.2, u.cz + Math.sin(a*1.3)*u.rad*.8);
    s.material.opacity = .45 + .45*Math.sin(t*2.1 + u.ph); });
  PULSE.forEach(m => { m.emissiveIntensity = m.userData.k0*(.78 + .22*Math.sin(t*1.6 + m.userData.ph)); });
}

/* ── residents: a fox and a deer (animated GLBs) walk in; code-built owl, rabbits, snails, butterflies and a firefly swarm ── */
const RES = [
  { id:'Deer', name:'Deer', h:.85, at:[5.3,6.0], face:-.7 },
  { id:'Fox', name:'Fox', h:.5, at:[3.2,4.95], face:.5 },
  { id:'owl', name:'Owl', h:.36, at:[.5 + OWL_STONE[0], 5.5 + OWL_STONE[1]], face:.8, lift:.37, code:true },
  { id:'rabbits', name:'Rabbits', h:.28, at:[.45,3.25], face:1.2, n:2, code:true },
  { id:'snails', name:'Snails', h:.16, at:[2.75,4.15], face:.4, n:2, code:true },
  { id:'butterflies', name:'Butterflies', h:.2, at:[4.0,4.3], face:0, n:3, code:true, fly:.45 },
  { id:'fireflies', name:'Fireflies', h:.3, at:[5.45,3.55], face:0, code:true, fly:.35 }
];
const RM = { fur:SM(0xC9B29A), furL:SM(0xF4EADF), furD:SM(0x9C8470), eye:SM(0x2A2230), owl:FM(0x8A6A4A), owlL:FM(0xE8D6B8), owlD:FM(0x5E4630), beak:FM(0xE8A640),
  eyeW:SM(0xFFF6D8), eyeA:GL(0xFFC857, 0xFF9A1F, .4), wingA:SM(0xC9A6FF, { side:THREE.DoubleSide }), wingB:SM(0x7FE0D0, { side:THREE.DoubleSide }), wingC:SM(0xFFB8D6, { side:THREE.DoubleSide }),
  body:SM(0x3E3450), fly:GL(0xF4FF9A, 0xD8FF5A, 1.6) };
function makeRabbit(){ const a = new Acc();
  a.add(SPH, RM.fur, at(0, .38, -.05, 0, .3, .3, .42)); a.add(SPH, RM.furL, at(0, .33, .12, 0, .2, .22, .22));
  a.add(SPH, RM.fur, at(0, .66, .28, 0, .2, .19, .21));
  [-1, 1].forEach(sd => { a.add(SPH, RM.fur, atR(sd*.08, .95, .22, -.25, 0, sd*.18, .055, .22, .04)); a.add(SPH, RM.furL, atR(sd*.08, .95, .245, -.25, 0, sd*.18, .03, .17, .02));
    a.add(SPH, RM.eye, at(sd*.11, .7, .43, 0, .03, .035, .03)); a.add(SPH, RM.fur, at(sd*.14, .1, .15, 0, .08, .08, .14)); a.add(SPH, RM.fur, at(sd*.2, .16, -.2, 0, .1, .12, .2)); });
  a.add(SPH, C.capPink, at(0, .64, .48, 0, .025, .02, .02)); a.add(SPH, RM.furL, at(0, .42, -.46, 0, .1, .1, .1));
  const g = new THREE.Group(); a.into(g); return g; }
function makeOwl(){ const a = new Acc();
  a.add(SPH, RM.owl, at(0, .45, 0, 0, .34, .45, .32)); a.add(SPH, RM.owlL, at(0, .4, .15, 0, .24, .32, .2));
  a.add(SPH, RM.owl, at(0, .88, 0, 0, .3, .26, .28));
  [-1, 1].forEach(sd => { a.add(SPH, RM.owlL, at(sd*.12, .9, .19, 0, .12, .12, .07)); a.add(SPH, RM.eyeA, at(sd*.12, .9, .24, 0, .075, .075, .04)); a.add(SPH, RM.eye, at(sd*.12, .9, .27, 0, .04, .04, .02));
    a.add(new THREE.ConeGeometry(.06, .16, 5).translate(0, .08, 0), RM.owlD, atR(sd*.2, 1.05, 0, 0, 0, -sd*.35));
    a.add(SPH, RM.owlD, atR(sd*.3, .45, -.02, 0, 0, sd*.12, .08, .3, .22)); a.add(SPH, RM.beak, at(sd*.08, .02, .12, 0, .05, .03, .08)); });
  a.add(new THREE.ConeGeometry(.035, .09, 5).rotateX(Math.PI*.6), RM.beak, at(0, .82, .28));
  for (let i=0;i<5;i++) a.add(SPH, RM.owlD, at(-.08 + (i%3)*.08, .3 + Math.floor(i/3)*.12, .33, 0, .03, .02, .015));
  const g = new THREE.Group(); a.into(g); return g; }
function makeSnail(i){ const a = new Acc();
  a.add(SPH, C.snailB, at(0, .12, .1, 0, .16, .12, .55)); a.add(SPH, C.snailB, at(0, .3, .5, 0, .13, .2, .13));
  [-1, 1].forEach(sd => { a.add(cyl(.018, .014, .22, 4), C.snailB, atR(sd*.06, .44, .52, .3, 0, sd*.25)); a.add(SPH, RM.eye, at(sd*.12, .65, .6, 0, .035, .035, .035)); });
  const m = [C.shell, C.capLilac, C.capGold][i % 3];
  for (let k=0;k<4;k++){ const rr = .46*(1 - k*.22); a.add(new THREE.TorusGeometry(rr*.6, rr*.4, 10, 18).rotateY(Math.PI/2), k%2 ? m : C.shellD, at(k*.03, .5 + k*.02, -.05 - k*.02)); }
  const g = new THREE.Group(); a.into(g); return g; }
const WING = new THREE.CircleGeometry(.5, 12).rotateX(-Math.PI/2).scale(1, 1, .75).translate(.45, 0, -.08);
const WING2 = new THREE.CircleGeometry(.34, 10).rotateX(-Math.PI/2).translate(.3, 0, .3);
function makeButterfly(i){ const g = new THREE.Group(), mat = [RM.wingA, RM.wingB, RM.wingC][i % 3];
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.05, .6, 3, 6).rotateX(Math.PI/2), RM.body); body.position.y = .5; g.add(body);
  const w = []; [-1, 1].forEach(sd => { const p = new THREE.Group(); p.position.y = .5; const m1 = new THREE.Mesh(WING, mat), m2 = new THREE.Mesh(WING2, mat);
    p.add(m1, m2); p.scale.x = sd; g.add(p); w.push(p); });
  g.userData.wings = w; return g; }
function makeFireflies(){ const g = new THREE.Group(), r = rngFrom(31), bugs = [];
  for (let i=0;i<14;i++){ const b = new THREE.Group(); const m = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), RM.fly); b.add(m);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xE8FF8A, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); s.scale.setScalar(.5); b.add(s);
    b.userData = { ph:r()*6.28, rad:.2 + r()*.8, h:.3 + r()*1.2, sp:.6 + r()*.8 }; g.add(b); bugs.push(b); }
  g.userData.bugs = bugs; moveFlies(g, 2.1); return g; }
function moveFlies(g, t){ g.userData.bugs.forEach(b => { const u = b.userData, a = t*u.sp + u.ph; b.position.set(Math.cos(a)*u.rad, u.h + Math.sin(a*2.1)*.15, Math.sin(a*1.4)*u.rad*.8); }); }
/* one resident entry → a Group with its feet at y = 0, d.h tall (n creatures side by side) */
function makeCreature(d, scale = d.h){
  const holder = new THREE.Group(), n = d.n || 1, off = [[0,0],[.9,-.6],[-.7,.8]];
  for (let i=0;i<n;i++){
    const c = d.id === 'rabbits' ? makeRabbit() : d.id === 'owl' ? makeOwl() : d.id === 'snails' ? makeSnail(i) : d.id === 'butterflies' ? makeButterfly(i) : makeFireflies();
    const box = new THREE.Box3().setFromObject(c), hh = box.max.y - box.min.y || 1, k = (d.id === 'butterflies' || d.id === 'fireflies') ? 1 : 1/hh;
    const w = new THREE.Group(); c.position.y = -box.min.y*(d.id === 'butterflies' || d.id === 'fireflies' ? 0 : 1); c.scale.setScalar(1); w.add(c); w.scale.setScalar(k);
    w.position.set(off[i][0], 0, off[i][1]); w.rotation.y = i*.7; w.userData.kind = d.id; w.userData.ph = i*1.9; w.userData.c = c; holder.add(w);
  }
  holder.traverse(o => { if (o.isMesh) { o.castShadow = !(d.id === 'fireflies'); o.receiveShadow = false; o.frustumCulled = false; } });
  const sc = new THREE.Group(); sc.add(holder); sc.scale.setScalar(scale); sc.userData.parts = holder.children; return sc;
}
function animCreatures(t){
  (V && V.fairyRes || []).forEach(o => { const d = o.userData.def, base = o.userData.base; if (!base) return;
    o.userData.parts.forEach((w, i) => { const c = w.userData.c, ph = w.userData.ph;
      if (d.id === 'butterflies') { const a = t*.7 + ph; w.position.set(Math.cos(a)*1.4 + [0,.9,-.7][i], Math.sin(a*1.9)*.6, Math.sin(a)*1.1 + [0,-.6,.8][i]); w.rotation.y = -a;
        const f = .2 + Math.sin(t*16 + ph)*.9; c.userData.wings.forEach((p, j) => p.rotation.z = j ? -f : f); }
      else if (d.id === 'fireflies') moveFlies(c, t);
      else if (d.id === 'rabbits') { const hop = Math.max(0, Math.sin(t*2.2 + ph*2)); w.position.y = (hop > .96 ? (hop - .96)*6 : 0); c.rotation.x = -hop*.04; }
      else if (d.id === 'owl') { c.rotation.y = Math.sin(t*.6)*.5; }
      else if (d.id === 'snails') { c.position.z = ((t*.03 + ph) % 1)*.1; } });
  });
}
async function spawnGLB(d){
  const gltf = await loadAnimal(d), obj = SkeletonUtils.clone(gltf.scene);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.material = o.material.clone(); o.material.metalness = 0; o.material.roughness = .85; } });
  const box = modelBox(obj), s = d.h / (box.max.y - box.min.y); obj.scale.setScalar(s); obj.userData.y0 = TILE_TOP - box.min.y*s; world.add(obj);
  const mixer = new THREE.AnimationMixer(obj), clips = {}; gltf.animations.forEach(c => clips[c.name.replace(/^.*\|/, '')] = c);
  const a = { def:d, obj, mixer, clips, cur:null }; V.animals.push(a); return a;
}
function spawnCode(d){
  const obj = makeCreature(d); obj.userData.def = d; obj.userData.y0 = TILE_TOP + (d.lift || 0) + (d.fly || 0); world.add(obj);
  (V.fairyRes || (V.fairyRes = [])).push(obj);
  const a = { def:d, obj, mixer:new THREE.AnimationMixer(obj), clips:{}, cur:null }; V.animals.push(a); return a;
}
function playClip(a, name){ const c = a.clips[name] || a.clips.Idle || Object.values(a.clips)[0]; if (!c) return; const act = a.mixer.clipAction(c);
  if (a.cur === act) return; act.reset().play(); if (a.cur) a.cur.crossFadeTo(act, .3, false); a.cur = act;
  act.time = (S.drop != null || S.celebrate) ? .4 : (a.def.at[0]*1.3) % c.duration; }
function settle(a){ const d = a.def, p = cellPos(d.at[0], d.at[1]);
  a.obj.position.set(p.x, a.obj.userData.y0, p.z); a.obj.rotation.y = d.face; a.obj.userData.base = a.obj.position.clone();
  if (!d.code) playClip(a, a.clips.Eating ? 'Eating' : 'Idle'); }
async function fairyMoveIn(walk){
  V.residentsIn = true; V.fairyRes = [];
  RES.forEach(d => V.framePts.push(cellPos(d.at[0], d.at[1]).setY(TILE_TOP + d.h + (d.lift || 0) + (d.fly || 0))));
  for (let i=0;i<RES.length;i++){
    const d = RES[i], a = d.code ? spawnCode(d) : await spawnGLB(d);
    if (!walk) { settle(a); continue; }
    const to = cellPos(d.at[0], d.at[1]), y0 = a.obj.userData.y0;
    if (!d.code) {             // walk in through the front
      const gate = cellPos(3, 7.3), dir = to.clone().sub(gate); a.obj.rotation.y = Math.atan2(dir.x, dir.z); playClip(a, 'Walk');
      await new Promise(res => tween(S.rm ? 1 : Math.max(900, dir.length()*700), t => { const e = 1 - Math.pow(1-t, 2.2); a.obj.position.set(gate.x + dir.x*e, y0, gate.z + dir.z*e); },
        () => { settle(a); sparkle(to.clone().setY(TILE_TOP + d.h*.7), 10, 0xFFF0B0, .6); res(); }));
    } else if (d.id === 'rabbits' || d.id === 'snails') {   // hop (or glide) in from the edge
      const from = to.clone().add(new THREE.Vector3(d.id === 'rabbits' ? -1.2 : -.35, 0, d.id === 'rabbits' ? .6 : .2)), dir = to.clone().sub(from);
      a.obj.rotation.y = Math.atan2(dir.x, dir.z);
      await new Promise(res => tween(S.rm ? 1 : (d.id === 'rabbits' ? 1300 : 1100), t => { const e = 1 - Math.pow(1-t, 2);
          a.obj.position.set(from.x + dir.x*e, y0 + (d.id === 'rabbits' ? Math.abs(Math.sin(t*Math.PI*4))*.18*(1-t) : 0), from.z + dir.z*e); },
        () => { settle(a); sparkle(to.clone().setY(TILE_TOP + .2), 8, 0xE8D6FF, .4); res(); }));
    } else {                   // the owl, butterflies and fireflies drift down from above
      await new Promise(res => tween(S.rm ? 1 : 1200, t => { const e = 1 - Math.pow(1-t, 2.4);
          a.obj.position.set(to.x + (1-e)*.8, y0 + (1-e)*2.2, to.z - (1-e)*.8); a.obj.rotation.y = d.face; },
        () => { settle(a); sparkle(to.clone().setY(y0 + d.h*.5), 12, 0xC9F6EC, .6); res(); }));
    }
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 140));
  }
  V.arrived = RES.length;
}

export default {
  id:'fairy', name:'Fairy wood', title:'Your fairy wood',
  season:16, dates:'27 Apr–10 May', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'ponds & dewdrops',       tag:'Water' },
    building:{ label:'toadstool homes',        tag:'Home' },
    path:    { label:'stones & lanterns',      tag:'Path' },
    crop:    { label:'giant mushrooms',        tag:'Grows' },
    tree:    { label:'enchanted trees',        tag:'Tree' },
    special: { label:'the Tree of Light',      tag:'Special' }
  },
  slots:FAIRY, order:FAIRY_ORDER,
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M10 13.5h4l.6 6.5H9.4z" fill="#F4E9D6"/><path d="M2.8 13.6C3.4 7.8 7.4 4.5 12 4.5s8.6 3.3 9.2 9.1z" fill="#E0503F"/><circle cx="8.4" cy="9.6" r="1.5" fill="#FFF8EE"/><circle cx="14.6" cy="8.2" r="1.2" fill="#FFF8EE"/><circle cx="17.2" cy="11.6" r="1" fill="#FFF8EE"/><circle cx="12" cy="17.6" r="1.2" fill="#FFB347"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M40 118l3-40h22l3 40z"/><path d="M10 80c2-30 22-48 44-48s42 18 44 48z"/><path d="M90 118l2-22h12l2 22z"/><path d="M76 98c1-16 12-25 22-25s21 9 22 25z"/><circle cx="104" cy="30" r="4"/><circle cx="20" cy="22" r="3"/><circle cx="116" cy="54" r="2.5"/></g>',
  album:{ image:'assets/fairy/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#EEE8F6)' },
  ghost:{ color:'#F4EEFF', opacity:.36, emissive:.2, dash:'#F2ECFF', dashOpacity:.6 },
  css:'.phone[data-theme="fairy"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#F1ECF8 58%,#E0D8EE 100%)}',
  ground:{ tile:MOSS_TILE, tileMap:mossTileMap },

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    switch (s.kind) {
      case 'manor': return buildManor(g);
      case 'toadstool': return buildToadstool(g, s);
      case 'stump': return buildStump(g, s);
      case 'acorn': return buildAcorn(g, s);
      case 'treehouse': return buildTreehouse(g);
      case 'mtower': return buildTower(g);
      case 'fountain': return buildFountain(g);
      case 'waterfall': return buildWaterfall(g);
      case 'pond': return buildPond(g);
      case 'brook': return buildBrook(g);
      case 'kittree': return kitTree(g, s);
      case 'ferns': return buildFerns(g, s);
      case 'willow': return buildWillow(g);
      case 'shroom': return buildShroom(g, s, stage);
      case 'ring': return buildRing(g, s, stage);
      case 'stones': return buildStones(g, s);
      case 'lampost': return buildLampost(g, s);
      case 'twigbridge': return buildTwigBridge(g);
      case 'fence': return buildFence(g, s);
      case 'fernhedge': return buildFernHedge(g, s);
      case 'lights': return buildLights(g, s);
      case 'lighttree': return buildLightTree(g);
    }
  },
  contact: s => !['stones', 'fence', 'fernhedge', 'lights', 'ring', 'shroom', 'pond', 'brook', 'twigbridge', 'lampost'].includes(s.kind),
  nightLamp: s => s.cat === 'special' || s.cat === 'building',
  decor(slots){ meadowDecor(slots, { tuft: r => { const q = r(); return q < .42 ? ['Grass_Common_Short', 0] : q < .74 ? ['Grass_Wispy_Short', 0] : q < .86 ? ['Clover_1', .18] : q < .93 ? ['Mushroom_Common', .12] : [q < .97 ? 'Flower_3_Single' : 'Flower_4_Single', .16]; }, flowers:false }); },
  ambient(){ addSpores(); },
  tick(t){ moveSpores(t); animCreatures(t); },

  residents:RES,
  moveIn:fairyMoveIn,
  residentThumb(d, thumbFor){
    if (!d.code) return 'assets/thumbs/' + d.id + '.png';
    return thumbFor('fairy:' + d.id, () => { const o = makeCreature(d, 1); o.userData.def = d; o.rotation.y = d.id === 'owl' ? .2 : -.5; return o; }, 168);
  },
  residentRig(d){ if (!d.code) return null; const o = makeCreature(d, d.h); return { obj:o, mixer:new THREE.AnimationMixer(o), clip:null, facing:d.face }; }
};
