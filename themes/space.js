/* MOON BASE (?theme=space): the same 7×7 ring blueprint, camera and light rig as the farm. Every farm slot id maps to a
   moon-base piece, so the farm's order, rings, pick-3, growth and expansion work unchanged. Habitats, labs, hangars, comms
   masts, tanks, walkways, rails, the rover and the rocket all come from the Kenney Space Kit 2.0 (CC0, assets/space/); its
   Mars-orange rock is recoloured to grey-lavender regolith at load. The greenhouse domes (they grow in 5 stages), crystals,
   antenna arrays, solar panels, lamps, the ice pool, the observatory, the drones and the ringed planet are procedural three.js
   geometry, merged per material so every piece stays pre-renderable. The page stays Cream: there's no starfield. The only
   space cues are a small ringed planet floating over the back corner and beacon lights that blink. */
import * as THREE from 'three';
import { rngFrom, TEX, world, CAM_DIR } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, seg, blob, _up, _q, _m, _s } from '../engine/proc.js';
import { tween, sparkle, dust } from '../engine/motion.js';
import { FARM, FARM_ORDER } from './farm.js';

/* Kenney's colours are linear baseColorFactors; our procedural materials use the same linear values so everything matches */
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b);
const PM = (col, o = {}) => new THREE.MeshStandardMaterial({ color:col, roughness:.72, metalness:0, flatShading:true, ...o });
const MAT = {
  metal:PM(lin(.84,.87,.91)), metalD:PM(lin(.68,.71,.77)), dark:PM(lin(.27,.3,.34)), orange:PM(lin(1,.63,.2)),
  rock:PM(new THREE.Color('#B7B0C8'), { roughness:.95 }), rockD:PM(new THREE.Color('#948CA8'), { roughness:.95 }),
  soil:PM(new THREE.Color('#6B5646'), { roughness:1 }), tray:PM(new THREE.Color('#5E6672')),
  glass:new THREE.MeshStandardMaterial({ color:0xD8F1FF, roughness:.08, metalness:0, transparent:true, opacity:.26, depthWrite:false, side:THREE.DoubleSide }),
  panel:new THREE.MeshStandardMaterial({ color:0xffffff, roughness:.35, metalness:.1 }),
  ice:new THREE.MeshStandardMaterial({ color:0xCDEFFA, roughness:.15, metalness:0, emissive:0x3A8FB0, emissiveIntensity:.25 }),
  iceChunk:PM(new THREE.Color('#EAF8FF'), { roughness:.3, emissive:0x2C7FA0, emissiveIntensity:.12 }),
  crystalA:PM(new THREE.Color('#B9A4F5'), { roughness:.35, emissive:0x4A2E9A, emissiveIntensity:.3 }),
  crystalB:PM(new THREE.Color('#8FE3F2'), { roughness:.35, emissive:0x1C6E86, emissiveIntensity:.3 }),
  crystalC:PM(new THREE.Color('#F4B3E0'), { roughness:.35, emissive:0x8A2E6E, emissiveIntensity:.25 }),
  leaf:PM(new THREE.Color('#6FBF4A')), leafD:PM(new THREE.Color('#4E9A3A')), leafL:PM(new THREE.Color('#A6DB6A')),
  tomato:PM(new THREE.Color('#E8453B'), { roughness:.45 }), berry:PM(new THREE.Color('#E0314F'), { roughness:.45 }),
  flower:PM(new THREE.Color('#FFF6E8')), purple:PM(new THREE.Color('#8E5BC4')),
  lamp:new THREE.MeshStandardMaterial({ color:0xFFE3A8, emissive:0xFFB957, emissiveIntensity:1.5 }),
  flame:new THREE.MeshBasicMaterial({ color:0xFFB347, transparent:true, opacity:.9, depthWrite:false }),
  rotor:new THREE.MeshBasicMaterial({ color:0x9AA3B0, transparent:true, opacity:.45, depthWrite:false, side:THREE.DoubleSide })
};
/* beacons: ONE shared material per colour, pulsed in tick (the ghost pass swaps materials, so ghosts never blink) */
const BEACON = { red:new THREE.MeshStandardMaterial({ color:0xFF5A4E, emissive:0xFF2B1F, emissiveIntensity:1.6 }),
                 green:new THREE.MeshStandardMaterial({ color:0x7CF29A, emissive:0x2BD65A, emissiveIntensity:1.6 }) };
const BEACON_GLOWS = new Set();

/* one kit model, fitted to h (height) and w (width) in tiles; returns it with .userData.top */
function kp(g, name, h, w, x=0, y=0, z=0, rot=0){ const tpl = KITCACHE.space && KITCACHE.space[name]; if (!tpl) { console.warn('space: missing', name); return null; }
  const k = fitScale(tpl, h, w), o = addModel(g, name, k, x, y, z, rot, 'space'); if (o) o.userData.top = y + tpl.size.y*k; return o; }
function glowSprite(parent, pos, scale, color, opacity=.8){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; s.userData.glow = true; parent.add(s); return s; }
function beacon(g, acc, p, col='red', r=.028){
  acc.add(new THREE.SphereGeometry(r, 10, 8), BEACON[col], _m.makeTranslation(p.x, p.y, p.z));
  const s = glowSprite(g, p, r*9, col === 'red' ? 0xFF6A5A : 0x8CFFB0, .7); s.userData.beacon = col; s.userData.ph = (p.x*3.1 + p.z*1.7) % 6.28; BEACON_GLOWS.add(s); }
function pebbles(acc, n, rng, rad=.4, y=.03, cx=0, cz=0){
  for (let i=0;i<n;i++){ const a = rng()*6.28, d = rad*(.3 + rng()*.7); blob(acc, rng()<.6 ? MAT.rock : MAT.rockD, new THREE.Vector3(cx + Math.cos(a)*d, y, cz + Math.sin(a)*d), .022 + rng()*.025, .6, 0, rng); } }

/* ── crystals + antennas (Vocab: tall landmarks) ── */
function crystal(acc, mat, p, h, r, tilt=0, yaw=0){
  const geo = new THREE.CylinderGeometry(r*.85, r, h, 6).translate(0, h/2, 0), cap = new THREE.ConeGeometry(r*.85, r*2.2, 6).translate(0, h + r*1.1, 0);
  _q.setFromEuler(new THREE.Euler(tilt*Math.cos(yaw), 0, tilt*Math.sin(yaw))); acc.add(geo, mat, _m.compose(p, _q, _s)); acc.add(cap, mat, _m.compose(p, _q, _s)); }
function crystals(g, s){
  const a = new Acc(), r = rngFrom(s.x*11 + s.z*7), tall = s.v === 'spire', main = s.pal === 'b' ? MAT.crystalB : s.pal === 'c' ? MAT.crystalC : MAT.crystalA, alt = main === MAT.crystalB ? MAT.crystalA : MAT.crystalB;
  blob(a, MAT.rock, new THREE.Vector3(0, .01, 0), .3, .35, 1, r); blob(a, MAT.rockD, new THREE.Vector3(.2, .01, -.12), .13, .5, 0, r);
  if (tall) crystal(a, main, new THREE.Vector3(0, .03, 0), .95, .1, .05, r()*6);
  const n = tall ? 6 : 8;
  for (let i=0;i<n;i++){ const ang = i/n*6.28 + r()*.4, d = .1 + r()*.14, h = tall ? .22 + r()*.34 : .26 + r()*.42;
    crystal(a, i%3 === 2 ? alt : main, new THREE.Vector3(Math.cos(ang)*d, .02, Math.sin(ang)*d), h, .045 + r()*.03, .35 + r()*.35, ang); }
  pebbles(a, 4, r, .42); a.into(g); }
function antenna(g, s){
  const a = new Acc(), r = rngFrom(s.x*5 + s.z*13);
  if (s.v === 'mast') {                                   // Kenney lattice support + a whip + a dish
    const sup = kp(g, 'supports_high', .78, .42, 0, 0, 0, .3); const y = sup ? sup.userData.top : .78;
    seg(a, MAT.metalD, new THREE.Vector3(0, y - .02, 0), _up, .5, .018, .01, 6); a.add(new THREE.CylinderGeometry(.06, .06, .025, 10).translate(0, y + .02, 0), MAT.orange, _m.identity());
    beacon(g, a, new THREE.Vector3(0, y + .52, 0), 'red', .03);
    kp(g, 'satelliteDish_detailed', .36, .36, .26, 0, .22, -.6);
  } else {                                                // an array: three whip masts on a plinth, beacons at the tips
    a.add(new THREE.CylinderGeometry(.3, .33, .06, 8).translate(0, .03, 0), MAT.metalD, _m.identity());
    a.add(new THREE.CylinderGeometry(.31, .31, .015, 8).translate(0, .065, 0), MAT.orange, _m.identity());
    [[0, 0, 1.15], [-.17, .12, .78], [.15, -.14, .92], [.14, .16, .6]].forEach(([x, z, h], i) => {
      seg(a, MAT.dark, new THREE.Vector3(x, .06, z), _up, .12, .04, .035, 6);
      seg(a, MAT.metal, new THREE.Vector3(x, .18, z), _up, h - .18, .02, .01, 6);
      for (let k=1;k<3;k++) a.add(new THREE.CylinderGeometry(.05 - k*.012, .05 - k*.012, .012, 8).translate(x, .18 + (h - .18)*k/3, z), MAT.metalD, _m.identity());
      beacon(g, a, new THREE.Vector3(x, h + .02, z), i === 0 ? 'red' : 'green', i === 0 ? .03 : .022); });
  }
  pebbles(a, 3, r, .42); a.into(g); }

/* ── greenhouse domes (Sudoku / Math): plants inside grow a stage with every later piece ── */
const DOME_R = .4;
const DOME_GEO = new THREE.SphereGeometry(DOME_R, 28, 12, 0, Math.PI*2, 0, Math.PI/2);
function domeShell(g){
  const a = new Acc();
  a.add(new THREE.CylinderGeometry(DOME_R + .05, DOME_R + .07, .08, 24).translate(0, .04, 0), MAT.metal, _m.identity());
  a.add(new THREE.CylinderGeometry(DOME_R + .052, DOME_R + .052, .02, 24).translate(0, .07, 0), MAT.orange, _m.identity());
  a.add(new THREE.CylinderGeometry(DOME_R - .02, DOME_R - .02, .012, 24).translate(0, .086, 0), MAT.soil, _m.identity());
  for (let i=0;i<3;i++) a.add(new THREE.TorusGeometry(DOME_R, .011, 4, 28, Math.PI).rotateY(i*Math.PI/3).translate(0, .08, 0), MAT.metalD, _m.identity());
  a.add(new THREE.TorusGeometry(DOME_R*.72, .01, 4, 28).rotateX(Math.PI/2).translate(0, .08 + DOME_R*.69, 0), MAT.metalD, _m.identity());
  a.add(new THREE.BoxGeometry(.16, .18, .12).translate(0, .09, 0), MAT.metal, _m.compose(new THREE.Vector3(.3, 0, .3), _q.setFromEuler(new THREE.Euler(0, Math.PI/4, 0)), _s));   // airlock
  a.add(new THREE.BoxGeometry(.09, .12, .02).translate(0, .08, .061), MAT.dark, _m.compose(new THREE.Vector3(.3, 0, .3), _q.setFromEuler(new THREE.Euler(0, Math.PI/4, 0)), _s));
  a.into(g);
  const glass = new THREE.Mesh(DOME_GEO, MAT.glass); glass.position.y = .08; glass.renderOrder = 6; g.add(glass);
}
const PLANT = { Corn:'tomato', Carrot:'lettuce', Lettuce:'herb', Beet:'strawberry' };
const DOME_NAME = { tomato:'Tomato dome', lettuce:'Lettuce dome', herb:'Herb dome', strawberry:'Strawberry dome' };
function plant(acc, kind, p, st, rng){
  if (st <= 1) { for (let i=0;i<2;i++) blob(acc, MAT.leafL, p.clone().add(new THREE.Vector3((i ? 1 : -1)*.014, .012, 0)), .016, .5); return; }
  if (kind === 'lettuce') {
    const n = 3 + st*2, R = .02 + st*.012;
    for (let i=0;i<n;i++){ const a = i*2.4, d = R*(.3 + (i/n)*.7); blob(acc, i%3 ? MAT.leafL : MAT.leaf, p.clone().add(new THREE.Vector3(Math.cos(a)*d, .014 + (1 - i/n)*st*.008, Math.sin(a)*d)), .018 + st*.006, .6, 0, rng); }
    if (st >= 5) blob(acc, MAT.purple, p.clone().setY(p.y + .05), .02, .8);
    return;
  }
  const h = (kind === 'herb' ? .05 : .035) + st*(kind === 'herb' ? .042 : .036);
  seg(acc, MAT.leafD, p, _up, h, .007, .005, 5);
  const levels = Math.min(4, st);
  for (let l=1;l<=levels;l++){ const y = p.y + h*l/levels*.95;
    for (let k=0;k<2;k++){ const a = l*1.9 + k*Math.PI, lp = new THREE.Vector3(p.x + Math.cos(a)*.022, y, p.z + Math.sin(a)*.022);
      blob(acc, l%2 ? MAT.leaf : MAT.leafL, lp, .018 + st*.004, .55); } }
  if (st >= 4 && kind !== 'herb') { const fm = kind === 'tomato' ? MAT.tomato : MAT.berry;
    for (let i=0;i<(st >= 5 ? 3 : 1);i++){ const a = i*2.2 + .5; blob(acc, st >= 5 ? fm : MAT.leafL, new THREE.Vector3(p.x + Math.cos(a)*.03, p.y + h*(.45 + i*.15), p.z + Math.sin(a)*.03), kind === 'tomato' ? .02 : .014); } }
  if (kind === 'herb' && st >= 5) for (let i=0;i<3;i++) blob(acc, MAT.flower, new THREE.Vector3(p.x + (i-1)*.015, p.y + h + .01, p.z), .01);
  if (kind === 'strawberry' && st === 4) blob(acc, MAT.flower, new THREE.Vector3(p.x, p.y + h + .006, p.z), .012);
}
function fillDome(host, s, stage){
  host.clear();
  const r = rngFrom(s.x*31 + s.z*7 + 5), kind = PLANT[s.crop], acc = new Acc();
  const spots = [[0,0],[-.15,-.13],[.16,-.12],[-.14,.15],[.15,.14],[0,-.23],[0,.23]];
  spots.forEach(([x,z]) => plant(acc, kind, new THREE.Vector3(x + (r()-.5)*.02, .092, z + (r()-.5)*.02), stage, r));
  acc.into(host);
  if (stage >= 5) glowSprite(host, new THREE.Vector3(0, .34, 0), .5, 0xF2A8FF, .45);         // ripe: the grow-lights come on
  host.userData.stage = stage;
}

/* ── named pieces ── */
const SOLAR_TEX = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = '#2E4A8E'; g.fillRect(0,0,128,96); g.strokeStyle = 'rgba(190,215,255,.55)'; g.lineWidth = 2;
  for (let x=0;x<=128;x+=21.3){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,96); g.stroke(); } for (let y=0;y<=96;y+=24){ g.beginPath(); g.moveTo(0,y); g.lineTo(128,y); g.stroke(); }
  const gr = g.createLinearGradient(0,0,128,96); gr.addColorStop(0,'rgba(255,255,255,.28)'); gr.addColorStop(.5,'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0,0,128,96);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
MAT.panel.map = SOLAR_TEX;
function solar(acc, x, z, w=.44, d=.3, h=.2){
  seg(acc, MAT.metalD, new THREE.Vector3(x, 0, z), _up, h, .018, .016, 6);
  const rot = _q.setFromEuler(new THREE.Euler(-.55, -Math.PI/4 + Math.PI, 0, 'YXZ')), p = new THREE.Vector3(x, h + .02, z);
  acc.add(new THREE.BoxGeometry(w + .03, .018, d + .03), MAT.metal, _m.compose(p, rot, _s));
  acc.add(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI/2).translate(0, .0101, 0), MAT.panel, _m.compose(p, rot, _s));
}
function lampPost(g, acc, x, z, h=.55){
  seg(acc, MAT.dark, new THREE.Vector3(x, 0, z), _up, h, .02, .016, 6);
  acc.add(new THREE.CylinderGeometry(.05, .06, .03, 8).translate(x, .015, z), MAT.metalD, _m.identity());
  acc.add(new THREE.BoxGeometry(.1, .05, .1).translate(x, h + .02, z), MAT.metal, _m.identity());
  acc.add(new THREE.BoxGeometry(.08, .02, .08).translate(x, h - .01, z), MAT.lamp, _m.identity());
  glowSprite(g, new THREE.Vector3(x, h - .03, z), .34, 0xFFD08A, .5);
  beacon(g, acc, new THREE.Vector3(x, h + .07, z), 'red', .018);
}
function crate(acc, x, z, s=.2, rot=0, y=0, mat=MAT.orange){
  const p = new THREE.Vector3(x, y + s/2, z); _q.setFromEuler(new THREE.Euler(0, rot, 0));
  acc.add(new THREE.BoxGeometry(s, s, s), mat, _m.compose(p, _q, _s));
  acc.add(new THREE.BoxGeometry(s*1.02, s*.18, s*1.02), MAT.dark, _m.compose(p, _q, _s)); }

const B = {
  habitat(g){                                             // 2×2 hero: the main habitat dome, with a comms whip and a crate stack
    kp(g, 'hangar_roundA', 1.25, 1.9, 0, 0, 0, Math.PI/4);
    const a = new Acc(); crate(a, .72, .68, .2, .3); crate(a, .52, .78, .16, .9, 0, MAT.metalD); crate(a, .7, .66, .15, .6, .2, MAT.metal);
    seg(a, MAT.metalD, new THREE.Vector3(.62, 0, -.66), _up, 1.1, .02, .012, 6); beacon(g, a, new THREE.Vector3(.62, 1.12, -.66), 'red', .032);
    a.into(g); },
  lab(g){ kp(g, 'hangar_roundGlass', .8, .98, 0, 0, 0, Math.PI/4); },
  hangar(g){ kp(g, 'hangar_largeA', .7, .98, 0, 0, 0, Math.PI/4 + Math.PI/2); },
  workshop(g){ kp(g, 'hangar_smallA', .66, .96, 0, 0, 0, Math.PI/4 + Math.PI/2); const a = new Acc(); crate(a, .34, .36, .14, .4); a.into(g); },
  garage(g){ kp(g, 'hangar_smallB', .66, .96, 0, 0, 0, Math.PI/4 + Math.PI/2); },
  comms(g){                                               // comms tower: two lattice stages + a big dish + a beacon
    const s1 = kp(g, 'supports_high', .62, .58, 0, 0, 0, 0); const y1 = s1 ? s1.userData.top : .62;
    const s2 = kp(g, 'supports_low', .32, .5, 0, y1, 0, 0); const y2 = s2 ? s2.userData.top : y1 + .32;
    kp(g, 'satelliteDish_large', .52, .6, 0, y2 - .02, 0, -Math.PI/4 - .4);
    const a = new Acc(); beacon(g, a, new THREE.Vector3(.25, y2 + .02, -.2), 'red', .028); a.into(g); },
  tanks(g){ kp(g, 'machine_barrelLarge', .62, .86, 0, 0, 0, Math.PI/4); },
  o2(g){ kp(g, 'machine_barrel', .6, .86, 0, 0, 0, Math.PI/4 + .2); const a = new Acc(); beacon(g, a, new THREE.Vector3(-.3, .5, -.2), 'green', .02); a.into(g); },
  recycler(g){ kp(g, 'machine_generatorLarge', .62, .9, 0, 0, 0, Math.PI/4);
    const a = new Acc(); seg(a, MAT.metalD, new THREE.Vector3(-.3, 0, -.3), _up, .75, .035, .03, 8); beacon(g, a, new THREE.Vector3(-.3, .78, -.3), 'green', .022); a.into(g); },
  icepool(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z*3);
    a.add(new THREE.CylinderGeometry(.34, .34, .02, 28).translate(0, .035, 0), MAT.ice, _m.identity());
    for (let i=0;i<14;i++){ const ang = i/14*6.28 + r()*.2; blob(a, r()<.6 ? MAT.rock : MAT.rockD, new THREE.Vector3(Math.cos(ang)*.37, .04, Math.sin(ang)*.37), .06 + r()*.03, .7, 0, r); }
    for (let i=0;i<5;i++){ const ang = r()*6.28, d = r()*.2; blob(a, MAT.iceChunk, new THREE.Vector3(Math.cos(ang)*d, .05, Math.sin(ang)*d), .03 + r()*.035, .7, 0, r); }
    kp(g, 'pipe_end', .22, .3, -.3, 0, -.3, Math.PI/4); a.into(g); },
  crystals, antenna,
  walk(g, s){ const v = s.v || 0, a = new Acc(), r = rngFrom(s.x*13 + s.z*29);
    if (v === 0) { kp(g, 'platform_straight', .07, .98, 0, 0, 0, 0); g.userData.ghostMode = 'marker'; }
    else if (v === 1) { solar(a, -.16, -.14); solar(a, .18, .16); }
    else if (v === 2) { kp(g, 'barrels', .3, .44, -.14, 0, -.12, .4); crate(a, .2, .16, .2, .3); crate(a, .22, .14, .15, .8, .2, MAT.metal); crate(a, -.2, .26, .15, 1.2, 0, MAT.metalD); }
    else if (v === 3) { lampPost(g, a, 0, 0, .62); pebbles(a, 3, r, .4); }
    else if (v === 4) { solar(a, -.18, .1, .36, .26, .18); lampPost(g, a, .24, -.2, .5); }
    else { kp(g, 'platform_straight', .07, .98, 0, 0, 0, Math.PI/2); lampPost(g, a, -.36, -.36, .5); }
    a.m.size && a.into(g); },
  rail(g, s){ for (let i=0;i<s.len;i++){ const o = i - (s.len-1)/2;
      s.edge === 'w' ? kp(g, 'rail_middle', .26, 1.0, -.45, 0, o, Math.PI/2) : kp(g, 'rail_middle', .26, 1.0, o, 0, .45, 0); }
    const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz); },
  observatory: buildObservatory
};

/* ── the hero (Gita): an observatory dome on a pad; its shutter slides open when it lands and a telescope points at the planet ── */
function buildObservatory(g, s, opt){
  kp(g, 'platform_large', .08, 1.96, 0, 0, 0, 0);
  const a = new Acc(), y0 = .07, R = .6;
  a.add(new THREE.CylinderGeometry(R, R + .02, .55, 24).translate(0, y0 + .275, 0), MAT.metal, _m.identity());
  a.add(new THREE.CylinderGeometry(R + .025, R + .025, .06, 24).translate(0, y0 + .48, 0), MAT.orange, _m.identity());
  a.add(new THREE.BoxGeometry(.2, .3, .06).translate(0, y0 + .15, 0), MAT.dark, _m.compose(new THREE.Vector3(R*.72, 0, R*.72), _q.setFromEuler(new THREE.Euler(0, Math.PI/4, 0)), _s));
  for (const [x,z] of [[.78,-.78],[-.78,.78],[.8,.62]]) crate(a, x, z, .16, .4, y0, MAT.metalD);
  seg(a, MAT.metalD, new THREE.Vector3(-.78, y0, -.78), _up, 1.0, .025, .015, 6); a.into(g);
  const b = new Acc(); beacon(g, b, new THREE.Vector3(-.78, y0 + 1.02, -.78), 'red', .03); b.into(g);
  // the dome: two quarter-shells about the vertical axis; open = rotated apart, leaving a slit that faces the back corner (the planet)
  const top = y0 + .55, dome = new THREE.Group(); dome.position.y = top; dome.rotation.y = Math.PI*.75; g.add(dome);
  const h1 = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 10, 0, Math.PI, 0, Math.PI/2), MAT.metal),
        h2 = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 10, Math.PI, Math.PI, 0, Math.PI/2), MAT.metal);
  [h1, h2].forEach(h => { h.castShadow = h.receiveShadow = true; dome.add(h); });
  const rib = new THREE.Mesh(new THREE.TorusGeometry(R + .005, .02, 4, 32, Math.PI).rotateY(Math.PI/2), MAT.orange); h1.add(rib);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(R - .03, 20, 8, 0, Math.PI*2, 0, Math.PI/2), MAT.dark); dome.add(inner);
  // telescope: a fat tube on a pier, tilting out of the slit (local -x = phi 0 = the slit, which faces the camera)
  const scope = new THREE.Group(); scope.position.y = .05; dome.add(scope); const t = new Acc();
  t.add(new THREE.CylinderGeometry(.06, .08, .22, 10), MAT.dark, _m.identity());
  t.add(new THREE.CylinderGeometry(.13, .1, 1.0, 16).translate(0, .45, 0), MAT.metal, _m.identity());
  t.add(new THREE.CylinderGeometry(.145, .145, .08, 16).translate(0, .88, 0), MAT.orange, _m.identity());
  t.add(new THREE.CylinderGeometry(.1, .1, .02, 14).translate(0, .93, 0), MAT.dark, _m.identity());
  t.add(new THREE.CylinderGeometry(.03, .03, .3, 8).translate(.14, .3, 0), MAT.metalD, _m.identity());
  t.into(scope);
  const open = v => { h1.rotation.y = v*.6; h2.rotation.y = -v*.6; scope.rotation.z = v*.85; inner.visible = scope.visible = v > .05; };
  g.userData.openDome = open; open(opt && opt.stage === 4 ? 0 : 1);
}

/* blueprint: every farm slot id → a moon-base piece (same cells, same rings, same order) */
const MAP = {
  bigbarn:{ name:'Habitat dome', b:'habitat' }, well:{ name:'Oxygen tanks', b:'tanks' }, apple1:{ name:'Crystal spire', b:'crystals', v:'spire' },
  silo:{ name:'Comms tower', b:'comms' }, silohouse:{ name:'Glass lab', b:'lab' }, coop:{ name:'Hangar', b:'hangar' },
  watertower:{ name:'Air recycler', b:'recycler' }, pump:{ name:'O₂ canisters', b:'o2' }, apple2:{ name:'Antenna array', b:'antenna', v:'array' },
  berry1:{ name:'Crystal cluster', b:'crystals', pal:'b' }, peepal:{ name:'Observatory', b:'observatory' }, smallbarn:{ name:'Workshop', b:'workshop' },
  openbarn:{ name:'Rover garage', b:'garage' }, pond:{ name:'Ice pool', b:'icepool' }, orange1:{ name:'Antenna mast', b:'antenna', v:'mast' },
  apple3:{ name:'Crystal spire', b:'crystals', v:'spire', pal:'c' }, berry2:{ name:'Crystal cluster', b:'crystals' },
  orange2:{ name:'Antenna mast', b:'antenna', v:'mast' }, apple4:{ name:'Crystal spire', b:'crystals', v:'spire', pal:'b' }
};
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:5, path2_6:4, path3_6:1 };
const PATH_NAME = ['Walkway','Solar panels','Cargo crates','Beacon lamp','Solar + lamp','Lit walkway'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') { const kind = PLANT[f.crop]; return { ...s, kind:'dome', crop:f.crop, name:DOME_NAME[kind], stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'base', b:'walk', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'base', b:'rail', edge:f.edge, len:f.len, name:'Safety rail' };
  return { ...s, kind:'base', ...MAP[f.id] };
});

/* ── the look: grey-lavender regolith tiles with small craters ── */
const MOON_TILE = { top:['#D2CCDD','#CAC4D6'], side:'#BAB3CB', soilTop:'#A39CB6', soilBot:'#5F5874' };
function moonTileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(47);
  g.fillStyle = '#F5F3F8'; g.fillRect(0,0,N,N);
  for (let i=0;i<10;i++){ const x = r()*N, y = r()*N, rad = 20 + r()*40, gr = g.createRadialGradient(x,y,0,x,y,rad);
    gr.addColorStop(0, r()<.5 ? 'rgba(255,255,255,.35)' : 'rgba(110,95,140,.07)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0,0,N,N); }
  for (let i=0;i<340;i++){ g.fillStyle = r()<.5 ? 'rgba(255,255,255,.6)' : 'rgba(90,75,120,.14)'; g.beginPath(); g.arc(r()*N, r()*N, .5 + r()*1.3, 0, 6.3); g.fill(); }
  const craters = [[60,70,15],[190,60,9],[150,180,19],[50,200,7],[215,205,6],[112,118,5]];
  for (const [x,y,rad] of craters){
    g.fillStyle = 'rgba(95,80,130,.16)'; g.beginPath(); g.ellipse(x, y, rad, rad*.9, 0, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(95,80,130,.14)'; g.beginPath(); g.ellipse(x - rad*.12, y - rad*.14, rad*.78, rad*.68, 0, 0, 6.3); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.2 + rad*.1; g.beginPath(); g.arc(x, y, rad, .2, 2.6); g.stroke();
    g.strokeStyle = 'rgba(90,75,120,.2)'; g.lineWidth = 1 + rad*.06; g.beginPath(); g.arc(x, y, rad, 3.4, 5.9); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/* the ringed planet (+ a little moon) floating over the back corner: ambient decor, framed by the camera */
const PLANET_TEX = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'), r = rngFrom(12);
  const bands = ['#F7C9A8','#F2B38F','#E8A7B8','#F6D7B8','#D9A3C6','#F4BE9A','#EFC6CF'];
  let y = 0; while (y < 128) { const h = 6 + r()*16; g.fillStyle = bands[Math.floor(r()*bands.length)]; g.fillRect(0, y, 256, h + 1); y += h; }
  for (let i=0;i<40;i++){ g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(r()*256, r()*128, 20 + r()*50, 1.5); }
  g.fillStyle = 'rgba(220,120,110,.55)'; g.beginPath(); g.ellipse(170, 78, 14, 7, 0, 0, 6.3); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const RING_TEX = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 4; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0,0,256,0); [[0,'rgba(233,221,255,0)'],[.08,'rgba(233,221,255,.85)'],[.3,'rgba(214,196,245,.55)'],[.42,'rgba(255,236,214,.95)'],[.55,'rgba(214,196,245,.2)'],[.7,'rgba(236,222,255,.8)'],[1,'rgba(236,222,255,0)']].forEach(([o,cc]) => gr.addColorStop(o, cc));
  g.fillStyle = gr; g.fillRect(0,0,256,4); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
function ringGeo(r0, r1){ const geo = new THREE.RingGeometry(r0, r1, 72, 1), p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i=0;i<p.count;i++){ const d = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (d - r0)/(r1 - r0), .5); } return geo; }
function makePlanet(R){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 24), new THREE.MeshStandardMaterial({ map:PLANET_TEX, roughness:.9, emissive:0x3A2440, emissiveIntensity:.15 }));
  body.rotation.z = .35; g.add(body);
  const ring = new THREE.Mesh(ringGeo(R*1.3, R*2.1), new THREE.MeshBasicMaterial({ map:RING_TEX, transparent:true, side:THREE.DoubleSide, depthWrite:false }));
  // lay the ring almost edge-on to the fixed camera, tilted ~18° on screen: it reads as a thin ellipse, Saturn-style
  const up = new THREE.Vector3(-CAM_DIR.x*CAM_DIR.y, 1 - CAM_DIR.y*CAM_DIR.y, -CAM_DIR.z*CAM_DIR.y).normalize();
  const n = up.multiplyScalar(Math.cos(.32)).addScaledVector(CAM_DIR, Math.sin(.32)).normalize().applyAxisAngle(CAM_DIR, -.32);
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); ring.renderOrder = 5; g.add(ring);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(R*.24, 20, 14), PM(new THREE.Color('#D8D2E4'), { flatShading:false, roughness:1 }));
  moon.position.set(R*2.5, R*.9, R*.4); g.add(moon);
  g.userData = { body, moon }; return g;
}
function buildEnv(){
  const env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const R = .3 + V.ring*.07, h = V.L/2, p = new THREE.Vector3(-h + .15, TILE_TOP + 1.05 + V.ring*.3, -h*.05);
  const planet = makePlanet(R); planet.position.copy(p); env.add(planet); V.planet = planet;
  V.framePts.push(p.clone().add(new THREE.Vector3(-R*2, R*1.4, -R*2)), p.clone().add(new THREE.Vector3(R*2.6, R*1.4, R*.6)));
}
/* decor: moon rocks, little craters and a crystal or two on cells nothing will use; pebbles on waiting cells */
function moonDecor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    if (!sl || sl === 'later') {
      const pick = r();
      if (pick < .4) kp(grp, 'crater', .08, .62, p.x + (r()-.5)*.2, TILE_TOP - .015, p.z + (r()-.5)*.2, r()*6);
      else kp(grp, r()<.5 ? 'rocks_smallA' : 'rocks_smallB', .12, .55, p.x + (r()-.5)*.2, TILE_TOP, p.z + (r()-.5)*.2, r()*6);
      if (r() < .5) blob(a, MAT.rock, new THREE.Vector3(p.x + .28*(r() < .5 ? 1 : -1), TILE_TOP + .02, p.z + (r()-.5)*.5), .07 + r()*.04, .65, 0, r);
      if (r() < .35) crystal(a, r() < .5 ? MAT.crystalA : MAT.crystalB, new THREE.Vector3(p.x - .25, TILE_TOP, p.z + .25), .12 + r()*.1, .03, .3, r()*6);
      pebbles(a, 3, r, .42, TILE_TOP + .01, p.x, p.z); a.into(grp); grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { pebbles(a, 4, r, .4, TILE_TOP + .01, p.x, p.z);
      a.into(grp); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else world.remove(grp);
  }
}

/* ── life: beacons blink, the planet turns, one little scout drone patrols; on completion a rocket lands,
      two rovers trundle in and a drone flight arrives ── */
function makeDrone(){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.CylinderGeometry(.08, .09, .05, 10), MAT.metal, _m.identity());
  a.add(new THREE.CylinderGeometry(.092, .092, .014, 10), MAT.orange, _m.identity());
  a.add(new THREE.SphereGeometry(.045, 10, 6, 0, Math.PI*2, 0, Math.PI/2).translate(0, .024, 0), MAT.dark, _m.identity());
  const rotors = [];
  for (let i=0;i<4;i++){ const ang = Math.PI/4 + i*Math.PI/2, x = Math.cos(ang)*.15, z = Math.sin(ang)*.15;
    a.add(new THREE.BoxGeometry(.13, .016, .022).translate(.065, 0, 0), MAT.metalD, _m.compose(new THREE.Vector3(Math.cos(ang)*.04, .01, Math.sin(ang)*.04), _q.setFromEuler(new THREE.Euler(0, -ang, 0)), _s));
    a.add(new THREE.CylinderGeometry(.018, .018, .03, 8).translate(x, .025, z), MAT.dark, _m.identity());
    const rt = new THREE.Mesh(new THREE.CircleGeometry(.07, 16).rotateX(-Math.PI/2), MAT.rotor); rt.position.set(x, .042, z); g.add(rt); rotors.push(rt); }
  a.add(new THREE.SphereGeometry(.018, 8, 6).translate(0, -.03, 0), BEACON.green, _m.identity());
  a.into(g); const gl = glowSprite(g, new THREE.Vector3(0, -.035, 0), .2, 0x8CFFB0, .6); gl.userData.beacon = 'green'; gl.userData.ph = 1.3; BEACON_GLOWS.add(gl);
  g.userData.rotors = rotors; return g;
}
function makeRover(){ const g = new THREE.Group(); kp(g, 'rover', .6, .7, 0, 0, 0, 0); return g; }
function makeRocket(){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); let y = 0;
  for (const nm of ['rocket_finsA','rocket_fuelA','rocket_sidesA','rocket_topA']) { const tpl = KITCACHE.space && KITCACHE.space[nm]; if (!tpl) continue;
    const o = addModel(body, nm, 1, 0, y, 0, 0, 'space'); y += tpl.size.y; }
  const k = 2.0 / Math.max(y, 1e-3); body.scale.setScalar(k);
  const flame = new THREE.Group(); flame.position.y = .02; g.add(flame);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.14, .55, 14).rotateX(Math.PI).translate(0, -.26, 0), MAT.flame); flame.add(cone);
  const core = new THREE.Mesh(new THREE.ConeGeometry(.07, .3, 12).rotateX(Math.PI).translate(0, -.14, 0), new THREE.MeshBasicMaterial({ color:0xFFF4D6, transparent:true, opacity:.95, depthWrite:false })); flame.add(core);
  glowSprite(flame, new THREE.Vector3(0, -.2, 0), 1.1, 0xFFB060, .9);
  g.userData.flame = flame; flame.visible = false; return g;
}
const RES_SCALE = 1.5;
const ROCKET_CELL = [0, 5];
function residentPlan(){
  return {
    rocket:{ at:cellPos(...ROCKET_CELL), from:cellPos(...ROCKET_CELL).add(new THREE.Vector3(0, 5.5, 0)) },
    rovers:[{ at:cellPos(0, 3), axis:new THREE.Vector3(0, 0, 1), span:.28, face:0, ph:0 }, { at:cellPos(1.05, 6.1), axis:new THREE.Vector3(1, 0, 0), span:.3, face:Math.PI/2, ph:2 }],
    drones:[0, 1, 2].map(i => ({ cx:.3, cz:.2, r:1.6 + i*.55, h:1.35 + i*.3, sp:.28 + i*.06, ph:i*2.1 }))
  };
}
function dronePos(u, t, out){ const a = t*u.sp + u.ph; return out.set(u.cx + Math.cos(a)*u.r, TILE_TOP + u.h + Math.sin(a*2.3)*.08, u.cz + Math.sin(a)*u.r*.85); }
function addLife(kind, obj, u, resident){ const r = { kind, obj, u, arrive:1, resident }; world.add(obj); (V.res || (V.res = [])).push(r); V.life.push(obj); return r; }
function moveLife(t){
  if (!V) return;
  (V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'rocket') { const k = 1 - Math.pow(1 - r.arrive, 2.2); r.obj.position.lerpVectors(u.from, u.at, k);
      const fl = r.obj.userData.flame; fl.visible = r.arrive < .999; fl.scale.set(1, .8 + Math.sin(t*40)*.15 + (1 - r.arrive)*.5, 1); }
    else if (r.kind === 'drone') { const p = dronePos(u, t, new THREE.Vector3()), q = dronePos(u, t + .05, new THREE.Vector3());
      if (e < 1) p.lerpVectors(p.clone().add(new THREE.Vector3(4, 2.2, -2.5)), p, e);
      r.obj.position.copy(p); r.obj.rotation.y = Math.atan2(q.x - p.x, q.z - p.z); r.obj.rotation.x = .12;
      r.obj.userData.rotors.forEach((rt, i) => rt.rotation.y = t*30 + i); }
    else if (r.kind === 'rover') { const s = Math.sin(t*.5 + u.ph)*u.span, p = u.at.clone().addScaledVector(u.axis, s);
      if (e < 1) p.add(new THREE.Vector3(2.4, 0, 1.4).multiplyScalar(1 - e));
      r.obj.position.copy(p); r.obj.position.y = TILE_TOP + Math.abs(Math.sin(t*9 + u.ph))*.006;
      r.obj.rotation.y = u.face + (Math.cos(t*.5 + u.ph) < 0 ? Math.PI : 0); }
  });
  BEACON_GLOWS.forEach(s => { if (!s.parent) { BEACON_GLOWS.delete(s); return; } const on = .5 + .5*Math.sin(t*(s.userData.beacon === 'red' ? 3.2 : 2.1) + s.userData.ph); s.material.opacity = .15 + .75*on*on; });
  const pr = .5 + .5*Math.sin(t*3.2); BEACON.red.emissiveIntensity = .6 + 1.6*pr*pr; BEACON.green.emissiveIntensity = .9 + .9*(.5 + .5*Math.sin(t*2.1));
  if (V.planet) { V.planet.userData.body.rotation.y = t*.12; const m = V.planet.userData.moon, R = V.planet.userData.body.geometry.parameters.radius, a = t*.25 + .4;
    m.position.set(Math.cos(a)*R*2.5, R*.9 + Math.sin(a)*R*.35, Math.sin(a)*R*1.2); }
}
function spaceAmbient(){
  V.res = [];
  const d = makeDrone(); d.scale.setScalar(RES_SCALE*.8); addLife('drone', d, { cx:0, cz:0, r:.7 + V.ring*.45, h:.9 + V.ring*.12, sp:.4, ph:.6 }, false);
  moveLife(2.1);
}
function spawnGroup(i, plan){
  if (i === 0) { const o = makeRocket(); return [addLife('rocket', o, plan.rocket, true)]; }
  if (i === 1) return plan.rovers.map(u => { const o = makeRover(); o.scale.setScalar(1); return addLife('rover', o, u, true); });
  return plan.drones.map(u => { const o = makeDrone(); o.scale.setScalar(RES_SCALE*1.35); return addLife('drone', o, u, true); });
}
async function spaceMoveIn(walk){
  const plan = residentPlan(); V.residentsIn = true; V.res = V.res || [];
  V.framePts.push(plan.rocket.at.clone().setY(TILE_TOP + 2.1));
  for (const u of plan.drones) V.framePts.push(new THREE.Vector3(u.cx + u.r*.7, TILE_TOP + u.h, u.cz + u.r*.6));
  for (let i=0;i<3;i++){
    const rs = spawnGroup(i, plan);
    if (!walk) { rs.forEach(r => r.arrive = 1); moveLife(_t); continue; }
    rs.forEach(r => r.arrive = 0); moveLife(_t);
    await new Promise(res => tween(S.rm ? 1 : (i === 0 ? 2600 : 1400), t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.08))),
      () => { rs.forEach(r => r.arrive = 1); const p = rs[0].obj.position.clone();
        if (i === 0) { dust(p.clone().setY(TILE_TOP), .7, 16); sparkle(p.clone().setY(TILE_TOP + .6), 14, 0xFFE0A8, .7); }
        else sparkle(p.clone().setY(p.y + .3), 10, 0xE9F0FF, .6);
        res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = 3;
}
let _t = 0;

export default {
  id:'space', name:'Moon base', title:'Your moon base',
  season:6, dates:'10–23 Nov', nextIn:14,
  kits:['space'],
  kitDefs:{ space:{ file:'assets/space/space-kit.glb', stripSuffix:true, post:T => {
    const REC = { rock:'#B7B0C8', rockDark:'#948CA8', rockTrack:'#C3BCD2', crystal:'#B9A4F5' };
    for (const k in T) T[k].parts.forEach(p => { const nm = (p.mat.name||'').replace(/\.\d+$/,''), c = REC[nm]; if (c) p.mat.color.set(c); if (nm === 'crystal') { p.mat.emissive = new THREE.Color(0x4A2E9A); p.mat.emissiveIntensity = .3; } });
  } } },
  families:{
    water:   { label:'oxygen, air & ice',          tag:'Life support' },
    building:{ label:'habitats, labs & hangars',   tag:'Module' },
    path:    { label:'walkways, solar & cargo',    tag:'Base' },
    crop:    { label:'greenhouse domes',           tag:'Greenhouse' },
    tree:    { label:'crystals & antennas',        tag:'Landmark' },
    special: { label:'the observatory',            tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:MOON_TILE, tileMap:moonTileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><circle cx="12" cy="12" r="5.6" fill="#F2B38F"/><path d="M6.4 11.2c5.4-1.4 10.2-1.4 11.2.4" fill="none" stroke="#fff" stroke-width="1.2" opacity=".7"/><ellipse cx="12" cy="12.6" rx="10" ry="3" fill="none" stroke="#8E7BD6" stroke-width="1.8" transform="rotate(-18 12 12.6)"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M8 118c4-22 22-34 40-34s36 12 40 34z"/><path d="M92 118V70h8v48z"/><path d="M84 70c0-10 8-16 12-16s12 6 12 16z"/><circle cx="96" cy="46" r="4"/><circle cx="36" cy="30" r="13"/><ellipse cx="36" cy="30" rx="24" ry="6" fill="none" stroke="currentColor" stroke-width="4" transform="rotate(-18 36 30)"/><path d="M104 118v-8h18v8z"/></g>',
  album:{ image:'assets/space/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#ECE8F4)' },
  css:'.phone[data-theme="space"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#EEEAF6 58%,#DCD6EA 100%)}',

  build(g, s, opt){
    if (s.kind === 'dome') {            // Sudoku/Math → a greenhouse dome whose plants grow like a crop
      domeShell(g);
      const host = new THREE.Group(); host.scale.setScalar(1.15); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillDome(host, s, st);
      fillDome(host, s, opt.stage ?? cropStage(s.id));
    } else B[s.b](g, s, opt);
  },
  scaleOf: s => s.kind === 'dome' ? 1.15 : 1,
  contact: s => s.kind === 'dome' || (s.kind === 'base' && !['walk','rail'].includes(s.b)),
  nightLamp: s => s.cat==='building' || s.cat==='special' || (s.b === 'walk' && s.v >= 3),
  decor: moonDecor,
  env: buildEnv,
  ambient: spaceAmbient,
  tick(t, dt){ _t = t; moveLife(t); },
  onImpact(pos, big){                   // the observatory's shutter slides open as it lands
    const obs = V && V.pieces && V.pieces.peepal;
    if (big && obs && obs.userData.openDome && !obs.userData.opened) { obs.userData.opened = true; obs.userData.openDome(0);
      tween(S.rm ? 1 : 1500, t => obs.userData.openDome(1 - Math.pow(1 - t, 3)), () => sparkle(pos.clone().setY(pos.y + 1.2), 12, 0xE9DFFF, .6)); }
  },

  residents:[ { id:'rocket', name:'Supply rocket', n:1 }, { id:'rover', name:'Rovers', n:2 }, { id:'drone', name:'Drones', n:3 } ],
  moveIn: spaceMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('space:'+d.id, () => { const o = d.id === 'rocket' ? makeRocket() : d.id === 'rover' ? makeRover() : makeDrone();
      o.rotation.y = d.id === 'drone' ? .6 : -.5; if (d.id === 'drone') o.rotation.x = .5; return o; }, 168); },
  /* sprite export: a static rig per resident (no skeletal clips; the app animates them procedurally) */
  residentRig(d){ const obj = d.id === 'rocket' ? makeRocket() : d.id === 'rover' ? makeRover() : makeDrone();
    if (d.id === 'drone') obj.scale.setScalar(RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
