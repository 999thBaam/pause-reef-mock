/* MARS COLONY (?theme=mars) — a young colony on rusty red dust, on the farm's 7×7 ring blueprint (same cells, same ring counts
   6 / 15 / 19, same order) except the hero: the "first life" dome takes the LEFT corner (cells 0..1 × 5..6) so nothing stands in
   front of it, and the two farm slots it displaces move to the old peepal corner (as oasis / diwali do).
   Deliberately NOT the moon base (space): no Kenney kit, no grey-lavender regolith. Red-orange dust with ripples and pebbles,
   striped red mesas behind the land (env), buttes and craters on empty cells, dust devils wandering, cream habitats with teal
   trim and warm windows, and green life only under glass (greenhouses, algae spires, moss) — so the one tree in the hero dome
   reads as the first tree on Mars. Everything is procedural three.js merged per material (Acc), including the hero tree and the
   residents (lander, rovers, drones). No model assets at all; kit a is listed only because a primary kit is required. */
import * as THREE from 'three';
import { rngFrom, TEX, addSway, world } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { G, Acc, seg, blob, _up } from '../engine/proc.js';
import { tween, sparkle, dust } from '../engine/motion.js';
import { FARM, FARM_ORDER } from './farm.js';

/* ── materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.86, metalness:0, flatShading:true, ...o });
const SM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.55, metalness:0, ...o });   // smooth (hab shells)
function panelTex(){
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#26406E'; g.fillRect(0,0,N,N); g.strokeStyle = '#8FB2E0'; g.lineWidth = 1.5;
  for (let i=0;i<=4;i++){ g.beginPath(); g.moveTo(i*N/4, 0); g.lineTo(i*N/4, N); g.stroke(); g.beginPath(); g.moveTo(0, i*N/4); g.lineTo(N, i*N/4); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, N*.45, N);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function stripeTex(a, b, n=6){
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  for (let i=0;i<n;i++){ g.fillStyle = i%2 ? b : a; g.save(); g.translate(32, 32); g.rotate(Math.PI/4); g.fillRect(-64 + i*128/n, -64, 128/n + 1, 128); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const MAT = {
  rock:FM(0xB9573A, { roughness:1 }), rockD:FM(0x8C3D29, { roughness:1 }), rockL:FM(0xD8804F, { roughness:1 }), band:FM(0xE9A77A, { roughness:1 }),
  dust:FM(0xD9784A, { roughness:1 }), dustL:FM(0xE9965F, { roughness:1 }), dustD:FM(0xB0512F, { roughness:1 }),
  hab:SM(0xF4EFE6), habD:SM(0xDCD4C6), teal:SM(0x2EA69C), tealD:SM(0x1C7C75), trim:FM(0xF09A3A), dark:FM(0x3A3634), grey:FM(0x8E8A86), greyL:FM(0xBDB8B0),
  metal:FM(0xC9CCD0, { roughness:.5, metalness:.25 }),
  win:FM(0xFFE3A0, { emissive:0xFFAA40, emissiveIntensity:1.1 }), beacon:FM(0xFF7A5A, { emissive:0xFF3A20, emissiveIntensity:1.4 }), beaconG:FM(0x9CF5C0, { emissive:0x2ED67A, emissiveIntensity:1.4 }),
  glass:new THREE.MeshStandardMaterial({ color:0xE6FBFF, roughness:.06, metalness:0, transparent:true, opacity:.22, depthWrite:false, side:THREE.DoubleSide }),
  frame:FM(0xEDE7DC, { roughness:.6 }),
  panel:new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.35, metalness:.1, map:panelTex() }),
  hazard:new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.8, map:stripeTex('#F2B233', '#3A3634') }),
  water:new THREE.MeshStandardMaterial({ color:0x6FD3E6, roughness:.12, metalness:0, emissive:0x146A80, emissiveIntensity:.35 }),
  ice:FM(0xE4F7FF, { roughness:.3, emissive:0x3B8FB0, emissiveIntensity:.15 }),
  algae:new THREE.MeshStandardMaterial({ color:0x6FD27A, roughness:.3, transparent:true, opacity:.82, emissive:0x1F8A3A, emissiveIntensity:.35 }),
  soil:FM(0x5A3A28, { roughness:1, map:TEX.furrow }), sprout:FM(0x8BD05A), leaf:FM(0x5FB548), leafD:FM(0x3F9540), moss:FM(0x7CC255), mossD:FM(0x5AA044),
  tomato:FM(0xE8483A), bloom:FM(0xFFE06A), lettuce:FM(0x9EDB6A), lettuceD:FM(0x6FBE4E),
  crate:FM(0xE9DDC6), crateD:FM(0xC7A77A), tyre:FM(0x2E2B2A), flame:FM(0xFFD07A, { emissive:0xFF8A2A, emissiveIntensity:1.6 })
};

const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=14){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z)); }
function dome(acc, mat, r, x=0, y=0, z=0, sy=1, n=18){ acc.add(new THREE.SphereGeometry(r, n, Math.round(n/2), 0, Math.PI*2, 0, Math.PI/2), mat, at(x, y, z, 0, 1, sy, 1)); }
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }
/* a glass mesh added straight to the group (not merged) so it draws after the plants inside it */
function glassMesh(parent, geo, mx){ const m = new THREE.Mesh(geo, MAT.glass); m.applyMatrix4(mx); m.renderOrder = 6; parent.add(m); return m; }
/* round porthole windows on a cylinder/dome face */
function port(acc, x, y, z, r=.035, ry=0){ acc.add(new THREE.CylinderGeometry(r*1.35, r*1.35, .012, 12).rotateX(Math.PI/2), MAT.teal, at(x, y, z, ry));
  acc.add(new THREE.CylinderGeometry(r, r, .016, 12).rotateX(Math.PI/2), MAT.win, at(x, y, z, ry)); }
function beacon(acc, g, x, y, z, green=false){ cyl(acc, MAT.grey, .008, .008, .05, x, y, z, 5); blob(acc, green ? MAT.beaconG : MAT.beacon, new THREE.Vector3(x, y + .06, z), .018);
  const s = glowSprite(g, new THREE.Vector3(x, y + .06, z), .16, green ? 0x6BFFB0 : 0xFF7050, .6); (g.userData.blink = g.userData.blink || []).push(s); }
function solarWing(acc, x, y, z, w=.3, d=.16, tilt=.45, ry=0){ acc.add(bx(w, .012, d), MAT.panel, at(x, y, z, ry, 1, 1, 1, tilt)); acc.add(bx(w + .02, .008, d + .02), MAT.greyL, at(x, y - .008, z, ry, 1, 1, 1, tilt)); }
function pebbleAt(acc, x, z, s, rng, mat=MAT.rock, y=0){ blob(acc, mat, new THREE.Vector3(x, y + s*.35, z), s, .6, 0, rng); }
/* a flat-topped striped butte: stacked jittered cylinders, bands alternate rust / sand */
function butte(acc, x, z, r, h, rng, y=0){
  const bands = 4, hs = h/bands;
  for (let i=0;i<bands;i++){ const rr = r*(1 - i*.1), g = new THREE.CylinderGeometry(rr*.94, rr, hs*1.02, 7, 1); const p = g.attributes.position;
    for (let k=0;k<p.count;k++){ const f = 1 + (rngFrom(k*7 + i*31 + Math.floor(x*100))() - .5)*.2; p.setX(k, p.getX(k)*f); p.setZ(k, p.getZ(k)*f); }
    acc.add(g, i%2 ? MAT.band : (i === bands-1 ? MAT.rockL : MAT.rock), at(x, y + hs*i + hs/2, z, rng()*6)); }
}
function crater(acc, x, z, r, y=0){ acc.add(new THREE.TorusGeometry(r, r*.22, 5, 14).rotateX(Math.PI/2), MAT.dustL, at(x, y + .005, z, 0, 1, .5, 1)); cyl(acc, MAT.dustD, r*.95, r*.95, .008, x, y, z, 14); }

/* ── growing pieces (Sudoku / Math): greenhouse tunnels and grow domes; plants inside grow in 5 stages ── */
function tomatoPlant(a, x, z, st, r, y){
  if (st === 1) { for (let k=0;k<3;k++) seg(a, MAT.sprout, new THREE.Vector3(x + (k-1)*.01, y, z), new THREE.Vector3((k-1)*.4, 1, 0), .035, .006, .002, 3); return; }
  const h = [0, 0, .07, .13, .2, .24][st], rr = [0, 0, .035, .045, .055, .06][st];
  seg(a, MAT.leafD, new THREE.Vector3(x, y, z), _up, h, .007, .005, 4);
  if (st >= 4) seg(a, MAT.crateD, new THREE.Vector3(x + .03, y, z), _up, h + .03, .004, .004, 3);
  blob(a, MAT.leaf, new THREE.Vector3(x, y + h*.55, z), rr, 1.1, 0, r); blob(a, MAT.leafD, new THREE.Vector3(x, y + h*.95, z), rr*.8, .9, 0, r);
  if (st === 4) for (let k=0;k<3;k++) blob(a, MAT.bloom, new THREE.Vector3(x + Math.cos(k*2.1)*rr, y + h*.8, z + Math.sin(k*2.1)*rr), .01);
  if (st >= 5) for (let k=0;k<4;k++) blob(a, MAT.tomato, new THREE.Vector3(x + Math.cos(k*1.6 + .3)*rr*1.05, y + h*(.45 + (k%2)*.35), z + Math.sin(k*1.6 + .3)*rr*1.05), .02);
}
function lettuceHead(a, x, z, st, r, y){
  if (st === 1) { for (let k=0;k<3;k++) seg(a, MAT.sprout, new THREE.Vector3(x + (k-1)*.01, y, z), new THREE.Vector3((k-1)*.5, 1, (k%2)*.3), .03, .005, .002, 3); return; }
  const rr = [0, 0, .028, .04, .05, .058][st];
  blob(a, MAT.lettuceD, new THREE.Vector3(x, y + rr*.5, z), rr, .75, 1, r); blob(a, MAT.lettuce, new THREE.Vector3(x, y + rr*.8, z), rr*.72, .8, 0, r);
  if (st >= 5) blob(a, MAT.bloom, new THREE.Vector3(x, y + rr*1.3, z), .012);
}
function fillTunnel(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 3);
  for (const zz of [-.15, .15]) { slab(a, MAT.soil, .72, .03, .14, 0, .07, zz); for (let i=0;i<4;i++) tomatoPlant(a, -.27 + i*.18 + (r()-.5)*.02, zz, stage, r, .1); }
  a.into(host); host.userData.stage = stage;
}
function fillGrowDome(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*17 + s.z*5 + 9);
  a.add(new THREE.TorusGeometry(.26, .03, 5, 20).rotateX(Math.PI/2), MAT.greyL, at(0, .09, 0)); cyl(a, MAT.soil, .25, .25, .03, 0, .07, 0, 20); cyl(a, MAT.soil, .1, .1, .04, 0, .08, 0, 12);
  for (let i=0;i<7;i++){ const ang = i/7*6.28; lettuceHead(a, Math.cos(ang)*.18, Math.sin(ang)*.18, stage, r, .1); }
  tomatoPlant(a, 0, 0, stage, r, .12);
  a.into(host); host.userData.stage = stage;
}
function tunnelShell(g){
  const L = .8, R = .34, geo = new THREE.CylinderGeometry(R, R, L, 18, 1, true, 0, Math.PI).rotateZ(Math.PI/2);
  glassMesh(g, geo, at(0, .07, 0));
  const a = new Acc();
  for (const x of [-.4, -.2, 0, .2, .4]) a.add(new THREE.TorusGeometry(R, .012, 4, 14, Math.PI).rotateY(Math.PI/2), MAT.frame, at(x, .07, 0));
  a.add(new THREE.CylinderGeometry(.012, .012, L, 5).rotateZ(Math.PI/2), MAT.frame, at(0, .07 + R, 0));
  slab(a, MAT.teal, .1, .1, .03, .3, .07, .36);
  a.into(g);
}
function growDomeShell(g){
  glassMesh(g, new THREE.SphereGeometry(.38, 20, 10, 0, Math.PI*2, 0, Math.PI/2), at(0, .08, 0, 0, 1, .95, 1));
  const a = new Acc(); a.add(new THREE.TorusGeometry(.385, .02, 5, 22).rotateX(Math.PI/2), MAT.teal, at(0, .085, 0));
  for (let i=0;i<3;i++) a.add(new THREE.TorusGeometry(.38, .009, 4, 16, Math.PI), MAT.frame, at(0, .08, 0, i*Math.PI/3, 1, .95, 1));
  a.into(g);
}

/* ── named pieces ── */
/* the colony hub: a big cream dome, two pods on tubes, an airlock toward the camera, a glass greenhouse wing, a mast */
function hub(g){
  const a = new Acc(), r = rngFrom(4);
  cyl(a, MAT.greyL, .8, .82, .05, 0, 0, 0, 10);
  cyl(a, MAT.hab, .46, .46, .14, -.1, .05, -.1, 24); dome(a, MAT.hab, .46, -.1, .19, -.1, .82, 24);
  a.add(new THREE.TorusGeometry(.465, .022, 5, 30).rotateX(Math.PI/2), MAT.teal, at(-.1, .19, -.1));
  for (let i=0;i<5;i++){ const ang = .1 + i*.36; port(a, -.1 + Math.sin(ang)*.465, .12, -.1 + Math.cos(ang)*.465, .03, ang); }
  cyl(a, MAT.habD, .09, .1, .05, -.1, .56, -.1, 12); dome(a, MAT.teal, .08, -.1, .61, -.1, .6, 12);
  // airlock tunnel toward +z
  a.add(new THREE.CylinderGeometry(.1, .1, .3, 14).rotateX(Math.PI/2), MAT.habD, at(-.02, .13, .45)); slab(a, MAT.hab, .26, .26, .08, -.02, .03, .6);
  slab(a, MAT.tealD, .13, .17, .015, -.02, .04, .645); slab(a, MAT.hazard, .26, .03, .085, -.02, .29, .6); beacon(a, g, -.02, .32, .6);
  // side pod on +x
  a.add(new THREE.CylinderGeometry(.07, .07, .22, 12).rotateZ(Math.PI/2), MAT.habD, at(.43, .13, -.12));
  cyl(a, MAT.hab, .2, .2, .1, .58, .05, -.2, 18); dome(a, MAT.hab, .2, .58, .15, -.2, .9, 18); port(a, .58, .14, -.0, .03); port(a, .78, .14, -.2, .03, Math.PI/2);
  a.add(new THREE.TorusGeometry(.205, .016, 5, 22).rotateX(Math.PI/2), MAT.trim, at(.58, .15, -.2));
  // glass greenhouse wing on +x/+z with green inside
  a.add(new THREE.CylinderGeometry(.06, .06, .2, 10).rotateX(Math.PI/2), MAT.habD, at(.3, .1, .22));
  cyl(a, MAT.greyL, .25, .25, .04, .5, .05, .44, 18); cyl(a, MAT.soil, .22, .22, .02, .5, .09, .44, 18);
  for (let i=0;i<6;i++){ const ang = i/6*6.28, x = .5 + Math.cos(ang)*.13, z = .44 + Math.sin(ang)*.13; blob(a, i%2 ? MAT.leaf : MAT.leafD, new THREE.Vector3(x, .14, z), .05, 1, 0, r); }
  blob(a, MAT.moss, new THREE.Vector3(.5, .17, .44), .065, 1.1, 0, r); blob(a, MAT.tomato, new THREE.Vector3(.44, .19, .47), .016); blob(a, MAT.tomato, new THREE.Vector3(.55, .2, .4), .016);
  a.add(new THREE.TorusGeometry(.245, .014, 4, 18, Math.PI), MAT.frame, at(.5, .11, .44, .4));
  // back: solar array + mast
  solarWing(a, -.45, .35, -.62, .36, .2, -.5, .3); seg(a, MAT.grey, new THREE.Vector3(-.45, .05, -.6), _up, .3, .012, .012, 5);
  seg(a, MAT.greyL, new THREE.Vector3(.2, .05, -.55), _up, .78, .014, .01, 5); a.add(new THREE.SphereGeometry(.1, 12, 6, 0, Math.PI*2, 0, Math.PI/2).rotateX(-2.2), MAT.hab, at(.2, .74, -.55));
  beacon(a, g, .2, .83, -.55, true);
  // doorstep: crates and a pebble
  slab(a, MAT.crate, .1, .08, .1, .28, .05, .66, .3); slab(a, MAT.crateD, .08, .06, .08, .32, .13, .66, .5);
  a.into(g);
  glassMesh(g, new THREE.SphereGeometry(.25, 18, 9, 0, Math.PI*2, 0, Math.PI/2), at(.5, .09, .44));
}
function habPod(g){
  const a = new Acc();
  for (const [x, z] of [[-.2,-.2],[.2,-.2],[.2,.2],[-.2,.2]]) { seg(a, MAT.grey, new THREE.Vector3(x, 0, z), new THREE.Vector3(-x, 2.5, -z).normalize(), .2, .018, .014, 5); cyl(a, MAT.dark, .04, .04, .015, x, 0, z, 8); }
  cyl(a, MAT.hab, .27, .27, .26, 0, .17, 0, 20); dome(a, MAT.hab, .27, 0, .43, 0, .55, 20); cyl(a, MAT.habD, .28, .28, .03, 0, .17, 0, 20);
  a.add(new THREE.TorusGeometry(.275, .02, 5, 26).rotateX(Math.PI/2), MAT.teal, at(0, .33, 0));
  port(a, 0, .27, .27, .04); port(a, .27, .27, 0, .04, Math.PI/2); port(a, .19, .27, .19, .03, Math.PI/4);
  for (let i=0;i<5;i++) slab(a, MAT.greyL, .12, .012, .04, .08, .02 + i*.035, .31 + i*.0);
  seg(a, MAT.grey, new THREE.Vector3(.02, 0, .31), _up, .19, .006, .006, 3); seg(a, MAT.grey, new THREE.Vector3(.14, 0, .31), _up, .19, .006, .006, 3);
  solarWing(a, -.2, .6, -.05, .26, .14, .5, .6); seg(a, MAT.grey, new THREE.Vector3(-.12, .5, -.02), _up, .1, .01, .01, 4);
  beacon(a, g, .1, .56, -.08);
  a.into(g);
}
function lab(g){
  const a = new Acc();
  slab(a, MAT.greyL, .74, .05, .5, 0, 0, 0);
  a.add(new THREE.CapsuleGeometry(.17, .38, 4, 16).rotateZ(Math.PI/2), MAT.hab, at(0, .23, 0));
  a.add(new THREE.TorusGeometry(.172, .018, 5, 20).rotateY(Math.PI/2), MAT.teal, at(-.12, .23, 0)); a.add(new THREE.TorusGeometry(.172, .018, 5, 20).rotateY(Math.PI/2), MAT.teal, at(.12, .23, 0));
  for (const x of [-.22, 0, .22]) port(a, x, .25, .17, .03);
  slab(a, MAT.tealD, .1, .16, .02, .36, .05, 0, Math.PI/2); for (let i=0;i<3;i++) slab(a, MAT.greyL, .08, .012, .06, .44 + i*0, .02 + i*.04, 0);
  solarWing(a, 0, .5, -.05, .5, .2, -.35);
  seg(a, MAT.grey, new THREE.Vector3(0, .38, -.03), _up, .1, .012, .012, 4);
  a.add(new THREE.SphereGeometry(.07, 12, 6, 0, Math.PI*2, 0, Math.PI/2).rotateX(-2.4), MAT.hab, at(-.28, .45, .05)); seg(a, MAT.grey, new THREE.Vector3(-.28, .38, .05), _up, .06, .008, .008, 4);
  beacon(a, g, .28, .4, .02, true); slab(a, MAT.crate, .08, .07, .08, -.3, .05, .2, .4);
  a.into(g);
}
function commsTower(g){
  const a = new Acc(), H = .95;
  slab(a, MAT.greyL, .4, .04, .4);
  for (const [x, z] of [[-1,-1],[1,-1],[1,1],[-1,1]]) seg(a, MAT.hab, new THREE.Vector3(x*.13, .04, z*.13), new THREE.Vector3(-x*.09, H, -z*.09).normalize(), H, .015, .012, 5);
  for (let i=1;i<5;i++){ const y = .04 + i*H/5.2, w = .26 - i*.035; slab(a, i%2 ? MAT.trim : MAT.teal, w, .018, w, 0, y); }
  a.add(new THREE.SphereGeometry(.2, 16, 8, 0, Math.PI*2, 0, Math.PI/2.4).rotateX(Math.PI - .9), MAT.hab, at(0, H - .05, .05));
  seg(a, MAT.grey, new THREE.Vector3(0, H - .12, .1), new THREE.Vector3(0, .5, 1).normalize(), .18, .008, .006, 4); blob(a, MAT.teal, new THREE.Vector3(0, H - .04, .26), .02);
  seg(a, MAT.greyL, new THREE.Vector3(0, H - .05, -.05), _up, .25, .008, .005, 4); beacon(a, g, 0, H + .2, -.05);
  slab(a, MAT.hab, .16, .12, .12, .12, .04, .12); slab(a, MAT.win, .06, .04, .005, .12, .1, .183);
  a.into(g);
}
function garage(g){
  const a = new Acc(), R = .34, L = .72;
  slab(a, MAT.greyL, .86, .04, .82, 0, 0, 0);
  a.add(new THREE.CylinderGeometry(R, R, L, 18, 1, false, 0, Math.PI).rotateX(Math.PI/2).rotateZ(-Math.PI/2).rotateY(Math.PI/2), MAT.hab, at(0, .04, -.04));
  for (const z of [-.3, -.1, .1, .3]) a.add(new THREE.TorusGeometry(R + .005, .014, 4, 16, Math.PI), MAT.habD, at(0, .04, z - .04));
  a.add(new THREE.CircleGeometry(R, 18, 0, Math.PI), MAT.hab, at(0, .04, L/2 - .04));
  slab(a, MAT.dark, .38, .24, .012, 0, .04, L/2 - .035); slab(a, MAT.hazard, .44, .04, .02, 0, .28, L/2 - .03);
  for (let i=0;i<4;i++) slab(a, MAT.greyL, .36, .006, .014, 0, .08 + i*.05, L/2 - .026);
  beacon(a, g, -.24, .32, L/2 - .04); beacon(a, g, .24, .32, L/2 - .04);
  slab(a, MAT.dustD, .4, .006, .12, 0, .04, .42); solarWing(a, .1, .43, -.15, .3, .16, -.2);
  a.into(g);
}
function drillRig(g){
  const a = new Acc(), H = .82;
  slab(a, MAT.greyL, .7, .05, .6, 0, 0, 0);
  for (const [x, z] of [[-1,-1],[1,-1],[1,1],[-1,1]]) seg(a, MAT.trim, new THREE.Vector3(x*.16, .05, z*.16), new THREE.Vector3(-x*.13, H, -z*.13).normalize(), H, .016, .013, 5);
  for (let i=1;i<4;i++){ const y = .05 + i*H/4.2, w = .3 - i*.06; a.add(new THREE.TorusGeometry(w*.7, .01, 4, 4).rotateX(Math.PI/2).rotateY(Math.PI/4), MAT.trim, at(0, y, 0)); }
  seg(a, MAT.metal, new THREE.Vector3(0, -.02, 0), _up, H + .02, .03, .03, 8); cyl(a, MAT.dark, .06, .06, .06, 0, H - .05, 0, 8);
  cyl(a, MAT.hab, .12, .12, .22, .2, .05, .18, 14); dome(a, MAT.hab, .12, .2, .27, .18, .5, 14); a.add(new THREE.TorusGeometry(.122, .012, 4, 16).rotateX(Math.PI/2), MAT.teal, at(.2, .16, .18));
  cyl(a, MAT.ice, .09, .09, .02, -.18, .05, .2, 12); for (let i=0;i<4;i++) blob(a, MAT.ice, new THREE.Vector3(-.18 + (i-1.5)*.05, .08, .2 + (i%2)*.04), .03, .8);
  beacon(a, g, 0, H, 0);
  a.into(g);
}
/* Breathe: water and air */
function iceWell(g){
  const a = new Acc(), r = rngFrom(12);
  crater(a, 0, 0, .3, 0); cyl(a, MAT.ice, .22, .22, .03, 0, 0, 0, 16); cyl(a, MAT.water, .17, .17, .01, 0, .03, 0, 16);
  for (let i=0;i<6;i++){ const ang = i/6*6.28 + .3; blob(a, MAT.ice, new THREE.Vector3(Math.cos(ang)*.21, .04, Math.sin(ang)*.21), .04 + r()*.02, .8, 0, r); }
  for (const x of [-.2, .2]) seg(a, MAT.grey, new THREE.Vector3(x, 0, -.02), _up, .4, .014, .012, 5);
  a.add(new THREE.CylinderGeometry(.015, .015, .44, 6).rotateZ(Math.PI/2), MAT.greyL, at(0, .4, -.02)); cyl(a, MAT.teal, .04, .04, .08, 0, .3, -.02, 10);
  seg(a, MAT.dark, new THREE.Vector3(0, .07, -.02), _up, .23, .006, .006, 3);
  cyl(a, MAT.hab, .08, .08, .16, .3, 0, .22, 12); dome(a, MAT.teal, .08, .3, .16, .22, .5, 12);
  a.add(new THREE.TorusGeometry(.08, .008, 4, 10, Math.PI).rotateY(Math.PI/2), MAT.greyL, at(.3, .16, .22));
  a.into(g);
}
function waterTank(g){
  const a = new Acc(), Y = .42;
  for (const [x, z] of [[-1,-1],[1,-1],[1,1],[-1,1]]) { seg(a, MAT.hab, new THREE.Vector3(x*.2, 0, z*.2), new THREE.Vector3(-x*.05, 1, -z*.05).normalize(), Y, .018, .015, 5); cyl(a, MAT.dark, .035, .035, .012, x*.2, 0, z*.2, 8); }
  slab(a, MAT.greyL, .3, .012, .3, 0, Y*.5); a.add(new THREE.SphereGeometry(.24, 20, 14), MAT.teal, at(0, Y + .2, 0));
  a.add(new THREE.TorusGeometry(.243, .015, 5, 24).rotateX(Math.PI/2), MAT.hab, at(0, Y + .2, 0)); cyl(a, MAT.hab, .05, .05, .05, 0, Y + .42, 0, 10);
  seg(a, MAT.greyL, new THREE.Vector3(.16, 0, .16), _up, Y + .08, .012, .012, 5); beacon(a, g, 0, Y + .47, 0);
  a.into(g);
}
function airMaker(g){
  const a = new Acc();
  slab(a, MAT.greyL, .56, .04, .5);
  slab(a, MAT.hab, .4, .24, .3, 0, .04, .02); slab(a, MAT.teal, .41, .03, .31, 0, .2, .02);
  for (const x of [-.1, .1]) { cyl(a, MAT.dark, .07, .07, .015, x, .28, .02, 14); a.add(new THREE.TorusGeometry(.07, .01, 4, 14).rotateX(Math.PI/2), MAT.greyL, at(x, .295, .02));
    for (let i=0;i<4;i++) slab(a, MAT.greyL, .12, .006, .018, x, .288, .02, i*Math.PI/4); }
  slab(a, MAT.win, .08, .05, .005, -.08, .1, .172); slab(a, MAT.beaconG, .03, .03, .005, .1, .12, .172);
  // a tall vertical-axis wind turbine
  seg(a, MAT.greyL, new THREE.Vector3(.2, .04, -.16), _up, .7, .012, .01, 5);
  for (let i=0;i<3;i++){ const ang = i/3*6.28; const c = new THREE.CatmullRomCurve3([new THREE.Vector3(.2, .38, -.16), new THREE.Vector3(.2 + Math.cos(ang)*.08, .54, -.16 + Math.sin(ang)*.08), new THREE.Vector3(.2, .7, -.16)]);
    a.add(new THREE.TubeGeometry(c, 8, .01, 4), MAT.hab); }
  for (const x of [-.22, -.12]) { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x, .04, .22), new THREE.Vector3(x, .12, .2), new THREE.Vector3(x + .04, .14, .17)]); a.add(new THREE.TubeGeometry(c, 6, .012, 5), MAT.tealD); }
  a.into(g);
}
function meltPool(g){
  const a = new Acc(), r = rngFrom(71);
  a.add(new THREE.TorusGeometry(.4, .08, 6, 22).rotateX(Math.PI/2), MAT.dustL, at(0, .02, 0, 0, 1, .55, .9));
  cyl(a, MAT.ice, .4, .4, .02, 0, 0, 0, 22); a.add(new THREE.CylinderGeometry(.34, .34, .012, 22), MAT.water, at(0, .03, 0, 0, 1, 1, .88));
  for (let i=0;i<5;i++){ const ang = r()*6.28, rad = .1 + r()*.2; a.add(new THREE.OctahedronGeometry(.04 + r()*.03, 0), MAT.ice, at(Math.cos(ang)*rad, .04, Math.sin(ang)*rad*.8, r()*3, 1, .5, 1)); }
  for (let i=0;i<5;i++){ const ang = i/5*6.28 + .5; pebbleAt(a, Math.cos(ang)*.45, Math.sin(ang)*.4, .04 + r()*.02, r, MAT.rockD); }
  cyl(a, MAT.hab, .04, .04, .12, .38, 0, -.3, 8); a.add(new THREE.CylinderGeometry(.012, .012, .2, 5).rotateX(Math.PI/2).rotateY(.7), MAT.greyL, at(.31, .1, -.23));
  a.into(g);
  g.userData.steam = [[-.1, .1, .05], [.12, .08, -.08]];
}
/* Vocab: tall organic — algae spires (glass columns of green), lichen hoodoos (red rock pillars furred with moss), moss gardens */
function algaeSpire(g, s){
  const a = new Acc(), h = s.h || .95, r = rngFrom(s.x*3 + s.z*11);
  cyl(a, MAT.greyL, .2, .22, .06); cyl(a, MAT.hab, .15, .15, .06, 0, .06, 0, 16);
  a.add(new THREE.CylinderGeometry(.11, .11, h - .2, 16), MAT.algae, at(0, .12 + (h - .2)/2, 0));
  for (let i=0;i<7;i++) blob(a, MAT.hab, new THREE.Vector3((r()-.5)*.12, .16 + r()*(h - .3), (r()-.5)*.12), .012 + r()*.01);
  cyl(a, MAT.hab, .14, .12, .08, 0, h - .08, 0, 16); a.add(new THREE.TorusGeometry(.135, .012, 4, 18).rotateX(Math.PI/2), MAT.teal, at(0, h - .04, 0));
  for (let i=0;i<4;i++){ const ang = i/4*6.28 + .4; seg(a, MAT.frame, new THREE.Vector3(Math.cos(ang)*.12, .12, Math.sin(ang)*.12), _up, h - .2, .008, .008, 4); }
  seg(a, MAT.grey, new THREE.Vector3(0, h, 0), _up, .08, .006, .006, 3); beacon(a, g, 0, h + .06, 0, true);
  pebbleAt(a, .26, .22, .05, r); pebbleAt(a, -.24, .26, .035, r, MAT.rockD);
  glassMesh(g, new THREE.CylinderGeometry(.125, .125, h - .2, 16, 1, true), at(0, .12 + (h - .2)/2, 0));
  a.into(g);
}
function hoodoo(g, s){
  const a = new Acc(), h = s.h || 1, r = rngFrom(s.x*5 + s.z*13);
  const segs = 4; let y = 0;
  for (let i=0;i<segs;i++){ const sh = h/segs, rr = .2 - i*.03 + (i === segs-1 ? .07 : 0), geo = new THREE.CylinderGeometry(rr*.85, rr, sh, 7);
    const p = geo.attributes.position; for (let k=0;k<p.count;k++){ const f = 1 + (r()-.5)*.25; p.setX(k, p.getX(k)*f); p.setZ(k, p.getZ(k)*f); }
    a.add(geo, i%2 ? MAT.band : MAT.rock, at(0, y + sh/2, 0, r()*6)); y += sh; }
  // moss: green clumps climbing the pillar and a cap of moss on top
  for (let i=0;i<9;i++){ const ang = r()*6.28, yy = r()*h*.9, rr = .19 - (yy/h)*.08; blob(a, i%2 ? MAT.moss : MAT.mossD, new THREE.Vector3(Math.cos(ang)*rr, yy, Math.sin(ang)*rr), .04 + r()*.025, .8, 0, r); }
  blob(a, MAT.moss, new THREE.Vector3(0, h + .02, 0), .17, .35, 1, r); blob(a, MAT.mossD, new THREE.Vector3(.06, h + .05, -.04), .09, .5, 0, r);
  for (let i=0;i<3;i++) blob(a, MAT.bloom, new THREE.Vector3((r()-.5)*.2, h + .07, (r()-.5)*.2), .015);
  pebbleAt(a, .26, .24, .06, r); pebbleAt(a, -.25, .2, .04, r, MAT.rockD);
  a.into(g);
}
function mossGarden(g, s){
  const a = new Acc(), r = rngFrom(s.x*9 + s.z*2);
  blob(a, MAT.rock, new THREE.Vector3(-.08, .12, -.06), .22, .75, 1, r); blob(a, MAT.rockL, new THREE.Vector3(.2, .08, .16), .13, .7, 0, r);
  blob(a, MAT.moss, new THREE.Vector3(-.08, .25, -.06), .16, .45, 1, r); blob(a, MAT.mossD, new THREE.Vector3(.2, .15, .16), .09, .45, 0, r);
  for (let i=0;i<7;i++){ const ang = r()*6.28, rad = .22 + r()*.12; blob(a, i%2 ? MAT.moss : MAT.mossD, new THREE.Vector3(Math.cos(ang)*rad, .03, Math.sin(ang)*rad), .045, .6, 0, r); }
  // little round succulents
  for (let i=0;i<3;i++){ const x = -.26 + i*.1, z = .26 - i*.05; for (let k=0;k<6;k++){ const ang = k/6*6.28; seg(a, MAT.leaf, new THREE.Vector3(x, 0, z), new THREE.Vector3(Math.cos(ang), 1.4, Math.sin(ang)).normalize(), .06, .012, .003, 4); } }
  for (let i=0;i<4;i++) blob(a, MAT.bloom, new THREE.Vector3(-.08 + (r()-.5)*.2, .3, -.06 + (r()-.5)*.2), .014);
  a.into(g);
}
/* To-dos: ground props */
function path(g, s){
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0;
  if (v === 0) { for (let i=0;i<5;i++){ const t = i/4; a.add(new THREE.CylinderGeometry(.1, .11, .025, 8), MAT.greyL, at(-.3 + t*.6 + (r()-.5)*.04, .012, .28 - t*.56 + (r()-.5)*.04, r())); }
    for (let i=0;i<8;i++){ const t = (i + .5)/8, side = i%2 ? .05 : -.05; a.add(new THREE.CapsuleGeometry(.018, .03, 2, 6).rotateX(Math.PI/2), MAT.dustD, at(-.34 + t*.68 + side, .006, .34 - t*.68 + side, .78, 1, .25, 1)); }
    for (let i=0;i<3;i++) blob(a, i ? MAT.rock : MAT.rockD, new THREE.Vector3(-.28 + (i ? .03 : 0), .04 + i*.055, -.26), .06 - i*.014, .7, 0, r);
    pebbleAt(a, .3, -.2, .04, r); pebbleAt(a, -.2, .3, .035, r, MAT.rockL);
    seg(a, MAT.hab, new THREE.Vector3(.3, 0, .3), _up, .28, .01, .01, 4); slab(a, MAT.hazard, .03, .06, .03, .3, .12, .3); beacon(a, g, .3, .28, .3, true); g.userData.ghostMode = 'marker'; }
  else if (v === 1) { cyl(a, MAT.grey, .44, .45, .03, 0, 0, 0, 6); cyl(a, MAT.greyL, .38, .38, .01, 0, .03, 0, 6);
    a.add(new THREE.TorusGeometry(.24, .02, 4, 24).rotateX(Math.PI/2), MAT.trim, at(0, .04, 0)); slab(a, MAT.trim, .2, .006, .04, 0, .04, 0); slab(a, MAT.trim, .04, .006, .2, 0, .04, 0);
    for (let i=0;i<6;i++){ const ang = i/6*6.28; blob(a, i%2 ? MAT.beacon : MAT.win, new THREE.Vector3(Math.cos(ang)*.4, .04, Math.sin(ang)*.4), .02); } }
  else if (v === 2) { for (const [x, z] of [[-.2, -.18], [.2, -.18], [-.2, .18], [.2, .18]]) { seg(a, MAT.grey, new THREE.Vector3(x, 0, z), _up, .12, .01, .01, 4); solarWing(a, x, .14, z, .34, .28, .45); } }
  else if (v === 3) { slab(a, MAT.crate, .24, .18, .2, -.12, 0, -.1, .2); slab(a, MAT.crateD, .25, .02, .21, -.12, .09, -.1, .2); slab(a, MAT.crate, .16, .14, .16, -.1, .18, -.12, .5);
    cyl(a, MAT.teal, .08, .08, .2, .2, 0, .06, 12); cyl(a, MAT.hab, .06, .06, .16, .22, 0, -.2, 12); slab(a, MAT.hazard, .2, .02, .2, .15, 0, .26, .3); pebbleAt(a, -.28, .28, .04, r); }
  else if (v === 4) { for (const [x, z] of [[-.28, .26], [.26, -.28]]) { seg(a, MAT.hab, new THREE.Vector3(x, 0, z), _up, .4, .015, .012, 5); cyl(a, MAT.hab, .045, .035, .05, x, .4, z, 8);
      blob(a, MAT.win, new THREE.Vector3(x, .47, z), .028); glowSprite(g, new THREE.Vector3(x, .47, z), .3, 0xFFC070, .55); }
    for (let i=0;i<4;i++) a.add(new THREE.CylinderGeometry(.06, .07, .018, 8), MAT.greyL, at(-.15 + i*.1, .01, .15 - i*.1)); }
  else { a.add(new THREE.CylinderGeometry(.05, .05, .7, 12).rotateZ(Math.PI/2), MAT.habD, at(0, .12, 0, .78)); a.add(new THREE.CylinderGeometry(.065, .065, .7, 12, 1, true).rotateZ(Math.PI/2), MAT.glass, at(0, .12, 0, .78));
    for (const t of [-.25, .25]) { const x = t*Math.cos(.78), z = -t*Math.sin(.78); seg(a, MAT.grey, new THREE.Vector3(x, 0, z), _up, .07, .012, .012, 4); a.add(new THREE.TorusGeometry(.066, .01, 4, 12).rotateY(Math.PI/2), MAT.teal, at(x, .12, z, .78)); } }
  a.into(g);
}
/* edge: a low striped red ridge with little rover-light posts */
function ridge(g, s){
  const a = new Acc(), L = s.len, r = rngFrom(s.x*7 + s.z*17 + L);
  const run = u => s.edge === 'w' ? [-.45, u] : [u, .45];
  for (let i=0;i<L*3;i++){ const [x, z] = run(-L/2 + (i + .5)/3), hh = .12 + r()*.12, rr = .12 + r()*.05;
    const geo = new THREE.CylinderGeometry(rr*.7, rr, hh, 6); const p = geo.attributes.position; for (let k=0;k<p.count;k++){ const f = 1 + (r()-.5)*.3; p.setX(k, p.getX(k)*f); p.setZ(k, p.getZ(k)*f); }
    a.add(geo, i%2 ? MAT.rock : MAT.rockD, at(x, hh/2, z, r()*6)); a.add(new THREE.CylinderGeometry(rr*.66, rr*.72, .03, 6), MAT.band, at(x, hh*.6, z, r()*6)); }
  for (let i=0;i<=L;i+=2){ const [x, z] = run(-L/2 + i + (i ? -.12 : .12)); seg(a, MAT.hab, new THREE.Vector3(x, 0, z), _up, .3, .01, .01, 4); blob(a, MAT.beaconG, new THREE.Vector3(x, .32, z), .02); }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}
/* the first tree: a bright round-crowned tree, leaves sway (procedural so it can be big and luminous under the glass) */
const TREE_L = (() => { const m = FM(0x7CD04E, { emissive:0x2E6A10, emissiveIntensity:.25 }); addSway(m, 1, .02); return m; })();
const TREE_D = (() => { const m = FM(0x57B03E, { emissive:0x1E500C, emissiveIntensity:.2 }); addSway(m, 1, .02); return m; })();
function firstTree(g, r){
  const a = new Acc(), base = new THREE.Vector3(0, .15, 0);
  seg(a, MAT.crateD, base, new THREE.Vector3(.05, 1, 0).normalize(), .42, .055, .035, 7);
  const fork = new THREE.Vector3(.02, .55, 0);
  for (const [dx, dz, L] of [[.8, .3, .18], [-.7, .4, .16], [.1, -.9, .15]]) seg(a, MAT.crateD, fork, new THREE.Vector3(dx, 1.2, dz).normalize(), L, .03, .018, 5);
  const crowns = [[0, .78, 0, .3], [.2, .68, .12, .2], [-.2, .66, .1, .2], [.05, .66, -.2, .2], [-.08, .92, .02, .18], [.14, .86, -.08, .15]];
  crowns.forEach(([x, y, z, rr], i) => blob(a, i%2 ? TREE_D : TREE_L, new THREE.Vector3(x, y, z), rr, .85, 1, r));
  for (let i=0;i<7;i++){ const ang = i/7*6.28, y = .62 + r()*.3; blob(a, MAT.tomato, new THREE.Vector3(Math.cos(ang)*.28, y, Math.sin(ang)*.28), .022); }
  a.into(g);
}
/* the hero (Gita): the first tree on Mars — one green tree on a patch of real soil under a big ribbed glass dome */
function lifeDome(g){
  const a = new Acc(), r = rngFrom(5), R = .8, DY = 1.2;
  cyl(a, MAT.greyL, .9, .93, .06, 0, 0, 0, 12); cyl(a, MAT.hab, .86, .86, .06, 0, .06, 0, 36);
  a.add(new THREE.TorusGeometry(.86, .03, 6, 40).rotateX(Math.PI/2), MAT.teal, at(0, .12, 0));
  for (let i=0;i<12;i++){ const ang = i/12*6.28; blob(a, i%3 ? MAT.win : MAT.beaconG, new THREE.Vector3(Math.cos(ang)*.88, .09, Math.sin(ang)*.88), .018); }
  // inside: dark soil, grass, a ring of tiny flowers, two small shrubs
  cyl(a, MAT.dustL, .74, .74, .025, 0, .12, 0, 32); blob(a, MAT.soil, new THREE.Vector3(0, .13, 0), .3, .2, 1, r); a.add(new THREE.TorusGeometry(.32, .03, 5, 20).rotateX(Math.PI/2), MAT.greyL, at(0, .15, 0));
  for (let i=0;i<9;i++){ const ang = i/9*6.28 + .3, rad = .5 + r()*.12; blob(a, i%2 ? MAT.moss : MAT.mossD, new THREE.Vector3(Math.cos(ang)*rad, .15, Math.sin(ang)*rad), .05, .5, 0, r); }
  for (let i=0;i<14;i++){ const ang = i/14*6.28 + r()*.2, rad = .45 + r()*.15; blob(a, [MAT.bloom, MAT.tomato, MAT.hab][i%3], new THREE.Vector3(Math.cos(ang)*rad, .18, Math.sin(ang)*rad), .018); }
  blob(a, MAT.leaf, new THREE.Vector3(.4, .2, -.3), .08, .9, 0, r); blob(a, MAT.leafD, new THREE.Vector3(-.42, .2, .1), .07, .9, 0, r);
  // ribs: the dome's frame
  for (let i=0;i<4;i++) a.add(new THREE.TorusGeometry(R, .014, 4, 24, Math.PI), MAT.frame, at(0, .12, 0, i*Math.PI/4, 1, DY, 1));
  a.add(new THREE.TorusGeometry(R*Math.cos(.55), .012, 4, 32).rotateX(Math.PI/2), MAT.frame, at(0, .12 + R*Math.sin(.55)*DY, 0));
  cyl(a, MAT.hab, .06, .06, .04, 0, .12 + R*DY - .01, 0, 12); beacon(a, g, 0, .12 + R*DY + .03, 0, true);
  // airlock + steps toward the camera, lamps
  slab(a, MAT.hab, .26, .22, .12, .5, .06, .62, -.78); slab(a, MAT.tealD, .12, .15, .02, .54, .07, .67, -.78);
  for (let i=0;i<3;i++) slab(a, MAT.greyL, .24, .03, .08, .62 + i*.06, 0, .72 + i*.07, -.78);
  for (const [x, z] of [[.9, .2], [.15, .92]]) { seg(a, MAT.hab, new THREE.Vector3(x, .0, z), _up, .34, .012, .01, 5); blob(a, MAT.win, new THREE.Vector3(x, .36, z), .026); glowSprite(g, new THREE.Vector3(x, .36, z), .28, 0xFFC070, .5); }
  a.into(g);
  firstTree(g, r);
  glassMesh(g, new THREE.SphereGeometry(R, 32, 16, 0, Math.PI*2, 0, Math.PI/2), at(0, .12, 0, 0, 1, DY, 1));
  glowSprite(g, new THREE.Vector3(0, .55, 0), 1.9, 0x9CFFB0, .22);
}

/* ── blueprint: the farm's cells with colony pieces; the first-life dome takes the left corner ── */
const MAP = {
  bigbarn:{ name:'Colony hub', b:'hub' }, well:{ name:'Ice well', b:'iceWell' }, apple1:{ name:'Algae spire', b:'algae', h:.95 },
  silo:{ name:'Comms tower', b:'comms' }, silohouse:{ name:'Hab pod', b:'pod' }, coop:{ name:'Science lab', b:'lab' },
  watertower:{ name:'Water tank', b:'tank' }, pump:{ name:'Air maker', b:'air' }, apple2:{ name:'Lichen hoodoo', b:'hoodoo', h:.9 },
  berry1:{ name:'Moss garden', b:'moss' }, peepal:{ name:'First tree', b:'hero' },
  smallbarn:{ name:'Rover garage', b:'garage' }, openbarn:{ name:'Ice drill', b:'drill' },
  pond:{ name:'Melt pool', b:'pool' }, orange1:{ name:'Lichen hoodoo', b:'hoodoo', h:1.1 },
  apple3:{ name:'Algae spire', b:'algae', h:1.1 }, berry2:{ name:'Moss garden', b:'moss' },
  orange2:{ name:'Algae spire', b:'algae', h:.85 }, apple4:{ name:'Lichen hoodoo', b:'hoodoo', h:.95 }
};
const MOVE = { peepal:{ x:0, z:5 }, field1_5:{ x:1, z:1 }, fence3:{ x:0, z:0, edge:'w' } };
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:2, path2_6:4, path3_6:5 };
const PATH_NAME = ['Boot trail', 'Landing pad', 'Solar array', 'Supply crates', 'Lamp posts', 'Walk tube'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d, ...(MOVE[f.id] || {}) };
  if (f.kind === 'field') { const dome = f.crop === 'Lettuce' || f.crop === 'Beet';
    return dome ? { ...s, kind:'growdome', name:'Grow dome', stages:5 } : { ...s, kind:'tunnel', name:'Greenhouse', stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'mars', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'mars', b:'ridge', edge:s.edge || f.edge, len:f.len, name:'Red ridge' };
  return { ...s, kind:'mars', ...MAP[f.id] };
});
const BUILD = { hub, pod:habPod, lab, comms:commsTower, garage, drill:drillRig, iceWell, tank:waterTank, air:airMaker, pool:meltPool,
  algae:algaeSpire, hoodoo, moss:mossGarden, path, ridge, hero:lifeDome };

/* ── the ground: rusty dust with wind streaks, pebbles and tiny craters on a deep red block ── */
const TILE = { top:['#D9794B', '#D17146'], side:'#B45A36', soilTop:'#9A4629', soilBot:'#5A2718' };
function tileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(61);
  g.fillStyle = '#FBF1EA'; g.fillRect(0,0,N,N);
  for (let i=0;i<7;i++){ const y0 = (i + .5)*N/7;
    g.strokeStyle = 'rgba(140,50,20,.13)'; g.lineWidth = 3; g.beginPath();
    for (let x=0;x<=N;x+=4){ const y = y0 + Math.sin(x*.028 + i*2.1)*6; x ? g.lineTo(x,y) : g.moveTo(x,y); } g.stroke(); }
  for (let i=0;i<5;i++){ const x = r()*N, y = r()*N, rr = 5 + r()*7;
    g.strokeStyle = 'rgba(255,235,220,.45)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.stroke();
    g.fillStyle = 'rgba(120,40,15,.14)'; g.beginPath(); g.arc(x + 1, y + 1, rr*.8, 0, 6.3); g.fill(); }
  for (let i=0;i<300;i++){ g.fillStyle = r()<.45 ? 'rgba(255,240,230,.5)' : 'rgba(110,35,12,.16)'; g.beginPath(); g.arc(r()*N, r()*N, .6 + r()*1.3, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/* decor: buttes in the back corner, craters and rocks on other empty cells, a pebble on waiting cells */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    if (!sl || sl === 'later') {
      if (x + z <= 1 && !sl) butte(a, p.x - .05, p.z - .05, .3, .55 + r()*.2, r, p.y);
      else if (x + z <= 2 && !sl) { butte(a, p.x - .15, p.z - .1, .2, .3 + r()*.1, r, p.y); crater(a, p.x + .22, p.z + .2, .12, p.y); }
      else { crater(a, p.x + (r()-.5)*.3, p.z + (r()-.5)*.3, .14 + r()*.06, p.y); pebbleAt(a, p.x + .28, p.z - .25, .05 + r()*.03, r, MAT.rockD, p.y); }
      pebbleAt(a, p.x - .3, p.z + .28, .04 + r()*.03, r, MAT.rock, p.y); if (AMBIENT()) pebbleAt(a, p.x + .3, p.z + .3, .03, r, MAT.rockL, p.y);
      grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { pebbleAt(a, p.x + .32, p.z + .3, .035, r, MAT.rockD, p.y); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if ((Math.abs(x-3) === V.ring && x > 3) || (Math.abs(z-3) === V.ring && z > 3)) { pebbleAt(a, p.x + .4, p.z + .4, .035, r, MAT.rockD, p.y); grp.userData.decor = 'rim'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ── env: layered red mesas behind the back corner (flat tops, striped strata) ── */
function mesaGeo(R, H, seed){
  const bands = 5, r = rngFrom(seed), geos = [];
  let y = 0;
  for (let i=0;i<bands;i++){ const hs = H/bands*(i === bands-1 ? .7 : 1), rr = R*(1 - i*.07) , g = new THREE.CylinderGeometry(rr*.93, rr, hs, 9, 1);
    const p = g.attributes.position; for (let k=0;k<p.count;k++){ const f = 1 + (rngFrom(seed*13 + k*3 + i)() - .5)*.22; p.setX(k, p.getX(k)*f); p.setZ(k, p.getZ(k)*f); }
    g.translate(0, y + hs/2, 0); const ng = g.toNonIndexed(), col = new Float32Array(ng.attributes.position.count*3), c = new THREE.Color(['#B9573A', '#E0A06E', '#A64A30', '#D27A4A', '#C4643F'][i]);
    for (let k=0;k<col.length;k+=3){ col[k] = c.r; col[k+1] = c.g; col[k+2] = c.b; } ng.setAttribute('color', new THREE.BufferAttribute(col, 3)); ng.deleteAttribute('uv'); geos.push(ng); y += hs; void r; }
  const out = geos.reduce((acc, gg) => { if (!acc) return gg; const m = new THREE.BufferGeometry(); const n = acc.attributes.position.count + gg.attributes.position.count;
    for (const key of ['position', 'normal', 'color']) { const arr = new Float32Array(n*3); arr.set(acc.attributes[key].array, 0); arr.set(gg.attributes[key].array, acc.attributes[key].count*3); m.setAttribute(key, new THREE.BufferAttribute(arr, 3)); } return m; }, null);
  out.computeVertexNormals(); return out;
}
const MESA_MAT = new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:.95, metalness:0 });
function buildEnv(){
  const L = V.L, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const R0 = .32 + L*.06, c = -L/2 - .35 - R0*.55, base = -.63, H = .5 + L*.13;
  const add = (R, h, x, z, seed) => { const m = new THREE.Mesh(mesaGeo(R, h, seed), MESA_MAT); m.position.set(x, base, z); m.castShadow = m.receiveShadow = true; m.renderOrder = 0; env.add(m); };
  add(R0, H, c, c, 5); add(R0*.72, H*.72, c + .9 + L*.12, c - .15, 9); add(R0*.68, H*.6, c - .15, c + .95 + L*.12, 13);
  if (L >= 5) { add(.3, H*.42, c + 1.9 + L*.12, c + .05, 21); add(.28, H*.4, c + .05, c + 2 + L*.12, 23); }
  V.framePts.push(new THREE.Vector3(c, base + H, c));
}

/* ── ambient: dust devils wander the plot, fine dust drifts, beacons blink, the melt pool steams, one drone patrols ── */
const DUST_MAT = () => new THREE.SpriteMaterial({ map:TEX.glow, color:0xE3A47C, transparent:true, opacity:.6, depthWrite:false });
function devilTex(){ const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(0,0,128,128); for (let i=0;i<7;i++){ g.strokeStyle = `rgba(255,255,255,${.6 + (i%3)*.2})`; g.lineWidth = 5 + (i%2)*5; g.beginPath(); g.moveTo(i*128/7 - 40, 128); g.lineTo(i*128/7 + 40, 0); g.stroke();
    g.beginPath(); g.moveTo(i*128/7 + 88, 128); g.lineTo(i*128/7 + 168, 0); g.stroke(); }
  const fade = g.createLinearGradient(0,0,0,128); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(.75, 'rgba(0,0,0,.7)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = fade; g.fillRect(0,0,128,128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t; }
const DEVIL_TEX = devilTex();
function makeDevil(){ const g = new THREE.Group(), h = .75;
  const m = new THREE.MeshBasicMaterial({ color:0xFFE2C8, map:DEVIL_TEX, transparent:true, opacity:.95, depthWrite:false, side:THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(.27, .04, h, 18, 1, true).translate(0, h/2, 0), m); cone.renderOrder = 8; g.add(cone);
  const m2 = m.clone(); m2.color.setHex(0xA4522E); m2.opacity = .7; const inner = new THREE.Mesh(new THREE.CylinderGeometry(.13, .025, h*.85, 14, 1, true).translate(0, h*.425, 0), m2); inner.renderOrder = 8; g.add(inner);
  for (let i=0;i<6;i++){ const s = new THREE.Sprite(DUST_MAT()); s.userData = { ph:i*1.05 }; s.scale.setScalar(.16); s.renderOrder = 8; g.add(s); }
  g.userData.cone = cone; g.userData.inner = inner; return g; }
function makeDrone(){ const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.06, 12, 8), MAT.hab, at(0, 0, 0, 0, 1, .55, 1)); blob(a, MAT.win, new THREE.Vector3(0, -.005, .055), .018);
  for (const [x, z] of [[-1,-1],[1,-1],[1,1],[-1,1]]) { seg(a, MAT.grey, new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, 0, z).normalize(), .1, .007, .007, 4);
    cyl(a, MAT.teal, .025, .025, .012, x*.072, .004, z*.072, 8); a.add(new THREE.CylinderGeometry(.045, .045, .003, 14), MAT.glass, at(x*.072, .02, z*.072)); }
  a.into(g); return g; }
function addAmbient(){
  V.devils = []; const nd = V.ring >= 2 ? 2 : 1;
  for (let i=0;i<nd;i++){ const d = makeDevil(); d.userData.u = { ph:i*2.7, rad:.6 + V.ring*.55 - i*.35, sp:.09 + i*.03, h:.55 + V.ring*.08 }; world.add(d); V.devils.push(d); V.life.push(d); }
  V.motes = []; const r = rngFrom(88), R = V.L/2 + .3;
  for (let i=0;i<14;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xF2C09A, transparent:true, opacity:.7, depthWrite:false }));
    s.scale.setScalar(.04 + r()*.05); s.userData.u = { x0:(r()*2 - 1)*R, z:(r()*2 - 1)*R, y:.1 + r()*.6, sp:.1 + r()*.12, ph:r()*6, R }; s.renderOrder = 8; world.add(s); V.motes.push(s); V.life.push(s); }
  V.blinks = []; V.steam = [];
  Object.values(V.pieces).forEach(g => { (g.userData.blink || []).forEach((s, j) => V.blinks.push({ s, ph:j*1.3 + g.position.x }));
    (g.userData.steam || []).forEach((q, j) => { for (let i=0;i<3;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xF4F8FA, transparent:true, opacity:.4, depthWrite:false }));
      g.updateMatrixWorld(true); s.userData = { p:new THREE.Vector3(...q).applyMatrix4(g.matrixWorld), ph:i/3 + j*.2 }; s.renderOrder = 10; world.add(s); V.steam.push(s); V.life.push(s); } }); });
  if (V.ring >= 2) { const d = makeDrone(); d.scale.setScalar(1.4); d.userData.u = { rad:1.1 + V.ring*.3, h:1.1 + V.ring*.15, sp:.28 }; world.add(d); V.life.push(d); V.patrol = d; }
  moveAmbient(2.1);
}
function moveAmbient(t){
  if (!V) return;
  (V.devils || []).forEach(d => { const u = d.userData.u, ang = t*u.sp + u.ph, x = Math.cos(ang)*u.rad + Math.sin(ang*2.3)*.3, z = Math.sin(ang*.8)*u.rad*.9;
    d.position.set(x, TILE_TOP, z); d.visible = !S.night;
    const k = d.userData.u.h/.75; d.scale.setScalar(k); d.userData.cone.rotation.y = -t*4; d.userData.inner.rotation.y = -t*6.5;
    d.userData.cone.rotation.z = Math.sin(t*1.3 + u.ph)*.08;
    d.children.forEach(s => { if (!s.isSprite) return; const q = s.userData, a = t*3 + q.ph; s.position.set(Math.cos(a)*.14, .03 + Math.abs(Math.sin(t*2 + q.ph))*.06, Math.sin(a)*.14); s.material.opacity = .6; }); });
  (V.motes || []).forEach(s => { const u = s.userData.u, span = u.R*2, x = ((u.x0 + t*u.sp + u.R) % span + span) % span - u.R;
    s.position.set(x, TILE_TOP + u.y + Math.sin(t*1.3 + u.ph)*.05, u.z + Math.sin(t*.8 + u.ph)*.1); s.material.opacity = .65*Math.min(1, (u.R - Math.abs(x))*2); });
  (V.blinks || []).forEach(b => { b.s.material.opacity = .25 + .5*Math.max(0, Math.sin(t*2.4 + b.ph)); });
  (V.steam || []).forEach(s => { const q = s.userData, k = (t*.35 + q.ph) % 1; s.position.set(q.p.x + Math.sin(k*5)*.04, q.p.y + k*.5, q.p.z); s.scale.setScalar(.12 + k*.25); s.material.opacity = .4*(1 - k); });
  if (V.patrol) { const u = V.patrol.userData.u, ang = t*u.sp; V.patrol.position.set(Math.cos(ang)*u.rad, TILE_TOP + u.h + Math.sin(t*2)*.04, Math.sin(ang)*u.rad*.7); V.patrol.rotation.y = -ang; }
}

/* ── residents: a lander touches down, two rovers trundle in, a drone flight arrives ── */
const RES_SCALE = 1.5;
function makeRover(v=0){
  const g = new THREE.Group(), a = new Acc(), body = v ? MAT.trim : MAT.hab;
  slab(a, MAT.greyL, .3, .03, .2, 0, .08, 0); a.add(new THREE.CapsuleGeometry(.07, .16, 3, 10).rotateZ(Math.PI/2), body, at(0, .14, 0, 0, 1, .8, 1.2));
  slab(a, MAT.teal, .26, .015, .17, 0, .19, 0); slab(a, MAT.panel, .24, .01, .15, -.02, .2, 0);
  seg(a, MAT.grey, new THREE.Vector3(.1, .2, .04), _up, .12, .008, .008, 4); slab(a, MAT.hab, .06, .04, .05, .1, .32, .04); blob(a, MAT.dark, new THREE.Vector3(.135, .34, .04), .014); blob(a, MAT.dark, new THREE.Vector3(.135, .34, .07), .014);
  seg(a, MAT.grey, new THREE.Vector3(-.1, .2, -.05), _up, .14, .005, .004, 3); blob(a, MAT.beaconG, new THREE.Vector3(-.1, .35, -.05), .012);
  a.into(g);
  const wheels = [];
  for (const x of [-.11, 0, .11]) for (const z of [-.11, .11]) { const w = new THREE.Group(), wa = new Acc(); w.position.set(x, .045, z);
    wa.add(new THREE.CylinderGeometry(.045, .045, .035, 12).rotateX(Math.PI/2), MAT.tyre); wa.add(new THREE.CylinderGeometry(.022, .022, .038, 8).rotateX(Math.PI/2), MAT.greyL); wa.into(w); g.add(w); wheels.push(w); }
  g.userData.wheels = wheels; return g;
}
function makeLander(){
  const g = new THREE.Group(), a = new Acc();
  for (const [x, z] of [[-1,-1],[1,-1],[1,1],[-1,1]]) { seg(a, MAT.grey, new THREE.Vector3(x*.1, .16, z*.1), new THREE.Vector3(x, -1.2, z).normalize(), .2, .012, .01, 5); cyl(a, MAT.greyL, .03, .035, .012, x*.19, 0, z*.19, 8); }
  cyl(a, MAT.hab, .16, .14, .16, 0, .12, 0, 16); a.add(new THREE.ConeGeometry(.14, .16, 16), MAT.hab, at(0, .36, 0));
  a.add(new THREE.TorusGeometry(.155, .015, 5, 20).rotateX(Math.PI/2), MAT.trim, at(0, .2, 0)); port(a, 0, .2, .15, .03); port(a, .15, .2, 0, .025, Math.PI/2);
  cyl(a, MAT.dark, .06, .08, .05, 0, .07, 0, 10); blob(a, MAT.beacon, new THREE.Vector3(0, .46, 0), .018);
  solarWing(a, -.25, .22, 0, .16, .1, 0, 0); solarWing(a, .25, .22, 0, .16, .1, 0, 0);
  a.into(g);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.05, .16, 8).rotateX(Math.PI), MAT.flame); flame.position.y = -.02; g.add(flame); g.userData.flame = flame;
  return g;
}
const LANDER_AT = [0.15, 1.35], ROVERS = [ { at:[0.2, 3.3], axis:[0, 1], span:.45, face:0 }, { at:[5.1, 6.05], axis:[1, 0], span:.2, face:Math.PI/2, v:1 } ];
const DRONES = [ [2.5, 4.6, .9], [4.5, 1.7, 1.15], [1.2, 2.6, 1.3] ];
function moveResidents(t){
  (V && V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 2.4);
    if (r.kind === 'lander') { r.obj.position.set(u.at.x, TILE_TOP + (1 - e)*4.5, u.at.z); r.obj.userData.flame.visible = r.arrive < 1; r.obj.userData.flame.scale.y = .8 + Math.sin(t*30)*.2; }
    else if (r.kind === 'rover') { const along = r.arrive < 1 ? 0 : Math.sin(t*.45 + u.ph)*u.span, from = u.from, dest = u.at.clone().add(new THREE.Vector3(u.axis[0], 0, u.axis[1]).multiplyScalar(along));
      const p = from.clone().lerp(dest, r.arrive < 1 ? e : 1); r.obj.position.set(p.x, TILE_TOP, p.z);
      const vel = r.arrive < 1 ? 1 : Math.cos(t*.45 + u.ph);
      r.obj.rotation.y = r.arrive < 1 ? Math.atan2(u.at.x - from.x, u.at.z - from.z) - Math.PI/2 : u.face + (vel < 0 ? Math.PI : 0);
      r.obj.userData.wheels.forEach(w => w.rotation.z = -t*3); }
    else if (r.kind === 'drone') { const fly = 1 - e; r.obj.position.set(u.at.x + fly*2.5, TILE_TOP + u.h + fly*2 + Math.sin(t*2.2 + u.ph)*.05, u.at.z - fly*1.5); r.obj.rotation.y = Math.sin(t*.4 + u.ph)*.6; }
  });
}
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.07))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(TILE_TOP + .5), 10, 0xFFE0B0, .6); res(); })); }
async function marsMoveIn(walk){
  V.residentsIn = true; V.res = [];
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const groups = [
    async () => { const o = makeLander(); o.scale.setScalar(RES_SCALE); const r = addRes('lander', o, { at:cellPos(...LANDER_AT) }); moveResidents(0);
      if (walk) { await arrive([r], 2200); dust(cellPos(...LANDER_AT), .7, 14); } },
    async () => { const rs = ROVERS.map((c, i) => { const o = makeRover(c.v); o.scale.setScalar(RES_SCALE); const at0 = cellPos(...c.at);
        return addRes('rover', o, { at:at0, from:cellPos(3, 7.4).add(new THREE.Vector3(i ? .9 : -.9, 0, 0)), axis:c.axis, span:c.span, face:c.face, ph:i*2 }); });
      moveResidents(0); if (walk) await arrive(rs, 2400); },
    async () => { const rs = DRONES.map(([x, z, h], i) => { const o = makeDrone(); o.scale.setScalar(RES_SCALE); return addRes('drone', o, { at:cellPos(x, z), h, ph:i*1.4 }); });
      moveResidents(0); if (walk) await arrive(rs, 1800); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length;
}

export default {
  id:'mars', name:'Mars colony', title:'Your colony',
  season:40, dates:'12–25 Jul', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'ice wells, tanks & air makers', tag:'Water' },
    building:{ label:'habs, labs & the rover garage', tag:'Base' },
    path:    { label:'pads, solar arrays & ridges',   tag:'Outpost' },
    crop:    { label:'greenhouses & grow domes',      tag:'Greenhouse' },
    tree:    { label:'algae spires & lichen hoodoos', tag:'Life' },
    special: { label:'the first tree',                tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:TILE, tileMap },
  ghost:{ color:'#FFF6F0', opacity:.42, emissive:.22, dash:'#FFFFFF', dashOpacity:.72 },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M1.5 20.5l3-6h3l1.5-3h4l1.5 3h3l3 6z" fill="#C45A36"/><path d="M4.5 14.5h3l1.5-3h4l1.5 3" fill="none" stroke="#E9A77A" stroke-width="1.2"/><path d="M8 20.5a4 4 0 0 1 8 0z" fill="#E6FBFF" stroke="#2EA69C" stroke-width="1.1"/><path d="M12 20.3v-2.6" stroke="#7A4A2A" stroke-width="1"/><circle cx="12" cy="17" r="1.6" fill="#5FB548"/><circle cx="18.5" cy="5.5" r="2.4" fill="#F09A3A"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M4 118l10-34h16l6-14h22l6 14h14l6 12v22z"/><path d="M60 118a26 26 0 0 1 52 0z" opacity=".55"/><path d="M85 118V96h2v22z"/><circle cx="86" cy="94" r="9"/><path d="M28 50h30v-4H28z"/><circle cx="100" cy="28" r="10"/></g>',
  album:{ image:'assets/mars/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#F9E2D4)' },
  css:'.phone[data-theme="mars"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#FCEBDF 58%,#F4D2BC 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'tunnel' || s.kind === 'growdome') {
      const base = new THREE.Mesh(G.field, MAT.greyL); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      const host = new THREE.Group(); host.scale.setScalar(1.12); g.add(host); g.userData.plants = host;
      const fill = s.kind === 'tunnel' ? fillTunnel : fillGrowDome; g.userData.regrow = st => fill(host, s, st); fill(host, s, stage);
      (s.kind === 'tunnel' ? tunnelShell : growDomeShell)(g);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'mars' ? 1 : 1.12,
  contact: s => s.kind === 'mars' && !['path', 'ridge', 'hero'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && (s.v === 1 || s.v === 4)) || s.b === 'algae',
  decor,
  env: buildEnv,
  ambient: addAmbient,
  tick(t){ moveAmbient(t); moveResidents(t); },

  residents:[ { id:'lander', name:'Landing craft', n:1 }, { id:'rover', name:'Rovers', n:2 }, { id:'drone', name:'Drones', n:3 } ],
  moveIn: marsMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('mars:'+d.id, () => { const o = d.id === 'lander' ? makeLander() : d.id === 'rover' ? makeRover(0) : makeDrone();
      if (o.userData.flame) o.userData.flame.visible = false; o.rotation.y = .6; return o; }, 168); },
  residentRig(d){ const obj = d.id === 'lander' ? makeLander() : d.id === 'rover' ? makeRover(0) : makeDrone();
    if (obj.userData.flame) obj.userData.flame.visible = false; obj.scale.setScalar(RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
