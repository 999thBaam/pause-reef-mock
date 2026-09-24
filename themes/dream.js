/* DREAMLAND (?theme=dream) — surreal pastel dream logic. The land is a lavender-and-peach quilt that rests in a sea of soft clouds
   (no rock, no grass, no floating-island teeth: that is `sky`), and things do what they do in dreams: trees grow upside down or
   hang from little clouds, stairs spiral up to a door that opens onto night, a manor stands on its roof, rain falls UP, bubbles
   ripen in cloud-cushion beds, and the hero is a sleeping crescent moon in a nightcap that you can climb by ladder.
   Built on the farm's 7×7 ring blueprint (6 / 15 / 19, same order), hero in the right-hand corner (heroRight) so nothing stands
   in front of it. Everything is procedural three.js merged per material (Acc). No asset files, no licences to track. */
import * as THREE from 'three';
import { rngFrom, TEX, world } from '../engine/scene.js';
import { S, V, TH, placed, cropStage, hooks, AMBIENT } from '../engine/state.js';
import { GRID, OFF, TILE_TOP, cellPos, edgeCentre, ringOf, slotRing, isEdge } from '../engine/grid.js';
import { G, Acc, seg, blob, _up } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { FARM, FARM_ORDER, heroRight } from './farm.js';

/* ── materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.82, metalness:0, flatShading:true, ...o });
const SM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.7, metalness:0, ...o });
function stripeTex(cols, n=8, horiz=false){
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  for (let i=0;i<n;i++){ g.fillStyle = cols[i % cols.length]; if (horiz) g.fillRect(0, i*64/n, 64, 64/n + 1); else g.fillRect(i*64/n, 0, 64/n + 1, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const MAT = {
  lav:FM(0xB39AEA), lavD:FM(0x8468CC), lavL:FM(0xDCCDF8), pink:FM(0xF29CC1), pinkD:FM(0xD46E9E), peach:FM(0xFFBC92), peachD:FM(0xE48E63),
  mint:FM(0x98DEC4), mintD:FM(0x5EBB99), sky:FM(0x96C2F2), skyD:FM(0x6096DA), butter:FM(0xFFDF86), cream:FM(0xFFF7EE), creamD:FM(0xE8D3C0),
  night:FM(0x3E3F7E, { roughness:.6 }), soilClod:FM(0xB98A72), ink:FM(0x4A3F6B), wood:FM(0xCF9C72), woodD:FM(0xA06F4C), rope:FM(0xF3E3C6),
  gold:FM(0xFFD66B, { emissive:0xC28A10, emissiveIntensity:.35, roughness:.4, metalness:.2 }),
  star:SM(0xFFE89A, { emissive:0xFFC44A, emissiveIntensity:.9, flatShading:true }),
  glass:FM(0xFFE3B0, { emissive:0xFFB35C, emissiveIntensity:.8 }), glassN:FM(0x5A5CA8, { emissive:0x2A2C6E, emissiveIntensity:.5 }),
  bulb:SM(0xFFF3C8, { emissive:0xFFD27A, emissiveIntensity:1.2 }), bulbP:SM(0xFFD6EA, { emissive:0xFF9CC8, emissiveIntensity:1 }),
  moon:SM(0xFFF1BE, { emissive:0xF7D57A, emissiveIntensity:.32, roughness:.55 }), cheek:SM(0xF7A6BE),
  water:new THREE.MeshStandardMaterial({ color:0xB9C8FA, roughness:.15, emissive:0x6E78C8, emissiveIntensity:.3 }),
  pond:new THREE.MeshStandardMaterial({ color:0x6E6AC0, roughness:.12, emissive:0x33307A, emissiveIntensity:.45 }),
  jet:new THREE.MeshStandardMaterial({ color:0xE6EEFF, roughness:.2, transparent:true, opacity:.72, emissive:0xAFC3FF, emissiveIntensity:.35, depthWrite:false }),
  drop:SM(0xC9D8FF, { emissive:0x8FA8F2, emissiveIntensity:.4, roughness:.2 }),
  cloud:SM(0xFFFFFF, { roughness:1, emissive:0xEDE4FA, emissiveIntensity:.25 }), cloudP:SM(0xFFE3EE, { roughness:1, emissive:0xF7D0E0, emissiveIntensity:.22 }),
  cloudL:SM(0xEAE2FF, { roughness:1, emissive:0xD6CAF6, emissiveIntensity:.22 }),
  bubble:new THREE.MeshStandardMaterial({ color:0xF2B8E6, roughness:.08, transparent:true, opacity:.62, emissive:0xE08CD0, emissiveIntensity:.3, depthWrite:false }),
  bubbleB:new THREE.MeshStandardMaterial({ color:0xA9D8FF, roughness:.08, transparent:true, opacity:.62, emissive:0x6FB4F0, emissiveIntensity:.3, depthWrite:false }),
  shine:SM(0xFFFFFF, { emissive:0xFFFFFF, emissiveIntensity:.6 }),
  wool:SM(0xFFFFFF, { roughness:1, emissive:0xEEE6FA, emissiveIntensity:.18, flatShading:true }), face:SM(0x8C7FA8, { roughness:.8 })
};
const CAP = new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.85, map:(() => { const t = stripeTex(['#8FA8EE', '#FFF3F8'], 6, true); t.repeat.set(1, 1); return t; })(), flatShading:true });
const PILLOW_STRIPE = new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.9, map:stripeTex(['#F7C6DA', '#FFF4F8'], 8) });

const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbx = (w, h, d, r=.04) => new (G.path.constructor)(w, h, d, 2, r);          // RoundedBoxGeometry, via the shared geometry's class
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=12){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z)); }
function into(acc, g){ acc.into(g); g.children.forEach(o => { if (o.isMesh && o.material.transparent) { o.castShadow = false; o.renderOrder = 6; } }); return g; }
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }
/* soft cloud puff: a cluster of spheres with a flattened underside */
function cloud(acc, x, y, z, s=1, rng=Math.random, mat=MAT.cloud, n=6){
  for (let i=0;i<n;i++){ const a = i/n*6.28 + rng()*.5, rr = (i ? .55 + rng()*.25 : 0)*s*.34, r = s*(i ? .17 + rng()*.07 : .26);
    acc.add(new THREE.IcosahedronGeometry(r, 2), mat, at(x + Math.cos(a)*rr*1.3, y + (i ? rng()*.06*s : .06*s), z + Math.sin(a)*rr, 0, 1, .8, 1)); }
}
function starGeo(ro, ri, depth=.02, n=5){
  const s = new THREE.Shape(); for (let i=0;i<n*2;i++){ const a = Math.PI/2 + i*Math.PI/n, r = i%2 ? ri : ro; i ? s.lineTo(Math.cos(a)*r, Math.sin(a)*r) : s.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
  s.closePath(); return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled:true, bevelThickness:depth*.6, bevelSize:ro*.12, bevelSegments:2 }).translate(0, 0, -depth/2);
}
/* a crescent (opens to -x), extruded along z and centred */
function crescentGeo(R, r, d, depth, bevel=.04){
  const x = (R*R - r*r + d*d)/(2*d), y = Math.sqrt(Math.max(0, R*R - x*x)), t1 = Math.atan2(y, x), p1 = Math.atan2(y, x - d), s = new THREE.Shape(), N = 40;
  for (let i=0;i<=N;i++){ const a = t1 + (2*Math.PI - 2*t1)*i/N, px = Math.cos(a)*R, py = Math.sin(a)*R; i ? s.lineTo(px, py) : s.moveTo(px, py); }
  for (let i=1;i<N;i++){ const a = (2*Math.PI - p1) - (2*Math.PI - 2*p1)*i/N; s.lineTo(d + Math.cos(a)*r, Math.sin(a)*r); }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled:true, bevelThickness:bevel, bevelSize:bevel, bevelSegments:3, curveSegments:24 }).translate(0, 0, -depth/2).rotateZ(Math.PI);
}
function archGeo(w, h, depth=.02){
  const s = new THREE.Shape(), r = w/2; s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled:false, curveSegments:8 });
}
/* door / window on the +z face ('z') or the +x face ('x') of a box with half-depth hd; flip = upside down */
const onFace = (face, hd, u, y, off=0, flip=false) => face === 'z' ? at(u, y, hd + off, 0, 1, 1, 1, 0, flip ? Math.PI : 0) : at(hd + off, y, -u, Math.PI/2, 1, 1, 1, 0, flip ? Math.PI : 0);
function door(acc, face, hd, u, y, w=.12, h=.2, col=MAT.lavD, flip=false){
  acc.add(archGeo(w + .04, h + .02, .012), MAT.cream, onFace(face, hd, u, y, 0, flip)); acc.add(archGeo(w, h, .016), col, onFace(face, hd, u, y, .002, flip)); }
function win(acc, face, hd, u, y, w=.08, round=true){
  if (round) { acc.add(new THREE.CylinderGeometry(w/2 + .016, w/2 + .016, .012, 14).rotateX(Math.PI/2), MAT.cream, onFace(face, hd, u, y, .004));
    acc.add(new THREE.CylinderGeometry(w/2, w/2, .014, 14).rotateX(Math.PI/2), MAT.glass, onFace(face, hd, u, y, .007)); return; }
  acc.add(bx(w + .03, w*1.15 + .03, .012), MAT.cream, onFace(face, hd, u, y, .004)); acc.add(bx(w, w*1.15, .014), MAT.glass, onFace(face, hd, u, y, .008));
}
function gable(acc, mat, w, d, rise, x, y, z, ry=0, over=.05, rx=0){
  const s = new THREE.Shape(), hw = d/2 + over; s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(0, rise); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth:w + 2*over, bevelEnabled:false }).translate(0, 0, -(w + 2*over)/2).rotateY(Math.PI/2);
  acc.add(geo, mat, at(x, y, z, ry, 1, 1, 1, rx));
}
/* a run of floating stair steps along a curve; each step has a little cloud tuft under it */
function steps(acc, pts, w=.16, d=.09, cols=[MAT.lavL, MAT.peach, MAT.pink, MAT.mint], rng=null){
  pts.forEach((p, i) => { const q = pts[Math.min(pts.length - 1, i + 1)], pr = pts[Math.max(0, i - 1)], ry = Math.atan2(-(q.z - pr.z), q.x - pr.x) + Math.PI/2;
    acc.add(rbx(w, .04, d, .012), cols[i % cols.length], at(p.x, p.y, p.z, ry));
    if (rng && i % 2 === 0) blob(acc, MAT.cloud, V3(p.x, p.y - .04, p.z), .045, .6, 1, rng); });
}
function hangStar(acc, g, x, y, z, len, s=1){
  seg(acc, MAT.rope, V3(x, y - len, z), _up, len, .003, .003, 3);
  acc.add(starGeo(.05*s, .022*s, .02*s), MAT.star, at(x, y - len - .04*s, z, Math.PI/4));
  glowSprite(g, V3(x, y - len - .04*s, z), .28*s, 0xFFD98A, .5);
}
function bubbleAt(acc, p, r, mat=MAT.bubble){ acc.add(new THREE.SphereGeometry(r, 16, 12), mat, at(p.x, p.y, p.z)); acc.add(new THREE.SphereGeometry(r*.22, 8, 6), MAT.shine, at(p.x - r*.4, p.y + r*.45, p.z + r*.35, 0, 1, .6, 1)); }

const BOBS = [];      // groups that bob / swing in tick: { o, y, ph, amp, kind }

/* ── buildings (Reading / Lesson) ── */
function upsideManor(g){
  const a = new Acc(), r = rngFrom(4), HX = -.18, HZ = .12;
  cloud(a, HX, .0, HZ, 1.0, r, MAT.cloud, 7); cloud(a, HX + .42, .0, HZ + .34, .7, r, MAT.cloudP, 5); cloud(a, HX - .4, .0, HZ - .2, .6, r, MAT.cloudL, 4);
  // the house stands on its roof: an inverted gable nests in the cloud, the walls above, the floor (and a tiny garden) on top
  gable(a, MAT.pinkD, .8, .62, .3, HX, .44, HZ, 0, .05, Math.PI);
  slab(a, MAT.peach, .74, .44, .56, HX, .44, HZ); slab(a, MAT.peachD, .76, .03, .58, HX, .44, HZ);
  slab(a, MAT.creamD, .84, .06, .66, HX, .88, HZ); slab(a, MAT.mint, .78, .02, .6, HX, .94, HZ);
  const fz = HZ + .28, fx = HX + .37;
  door(a, 'z', fz, HX + .14, .86, .13, .24, MAT.lavD, true);                                   // the door hangs from the top
  win(a, 'z', fz, HX - .18, .62, .1); win(a, 'x', fx, -HZ, .66, .1); win(a, 'x', fx, -HZ + .18, .56, .07);
  // the chimney points down into the cloud and puffs a little cloud sideways
  slab(a, MAT.pinkD, .09, .2, .09, HX - .24, .16, HZ + .1); slab(a, MAT.creamD, .12, .03, .12, HX - .24, .14, HZ + .1); cloud(a, HX - .24, .02, HZ + .36, .32, r, MAT.cloudL, 4);
  // garden upstairs: a lollipop-round tree, a bench and a lamp on the floor slab
  seg(a, MAT.woodD, V3(HX - .18, .95, HZ - .1), _up, .2, .025, .02, 6); blob(a, MAT.lav, V3(HX - .18, 1.2, HZ - .1), .14, .9, 1, r);
  slab(a, MAT.wood, .18, .03, .07, HX + .12, 1.0, HZ + .1); for (const x of [.05, .19]) slab(a, MAT.woodD, .02, .05, .05, HX + x, .95, HZ + .1);
  seg(a, MAT.ink, V3(HX + .3, .95, HZ - .18), _up, .22, .01, .01, 5); blob(a, MAT.bulb, V3(HX + .3, 1.19, HZ - .18), .035);
  // floating steps climb from the ground to the upside-down door
  const st = []; for (let i=0;i<8;i++){ const t = i/7; st.push(V3(.62 - t*.5, .06 + t*.72, .66 - t*.14)); } steps(a, st, .16, .09, undefined, r);
  // a tipsy tower behind: three wobbly drums stacked off-true, a cone roof, a crescent vane
  const TX = .5, TZ = -.42; let y = .02;
  [[.2, .3, MAT.mint, .03], [.17, .26, MAT.lavL, -.05], [.14, .22, MAT.sky, .06]].forEach(([rad, h, m, lean], i) => {
    a.add(new THREE.CylinderGeometry(rad*.94, rad, h, 14), m, at(TX + lean, y + h/2, TZ - lean*.5, i, 1, 1, 1, 0, lean*1.6)); win(a, 'z', TZ + rad - lean*.5 - .01, TX + lean, y + h*.55, .06); y += h; });
  a.add(new THREE.ConeGeometry(.19, .3, 14), MAT.pink, at(TX + .08, y + .14, TZ - .04, 0, 1, 1, 1, 0, .12));
  a.add(crescentGeo(.06, .05, .03, .012, .006), MAT.gold, at(TX + .12, y + .38, TZ - .04, Math.PI/4));
  into(a, g);
  glowSprite(g, V3(HX + .3, 1.19, HZ - .18), .3, 0xFFD98A, .5);
}
function stairsNowhere(g){
  const a = new Acc(), r = rngFrom(9), pts = [];
  cloud(a, 0, 0, 0, .7, r, MAT.cloud, 5);
  for (let i=0;i<13;i++){ const ang = .8 + i*.52, t = i/12; pts.push(V3(Math.cos(ang)*.2, .08 + t*.78, Math.sin(ang)*.2)); }
  steps(a, pts, .15, .09, [MAT.lavL, MAT.pink, MAT.peach, MAT.mint, MAT.sky]);
  // ...to a lone door frame, open onto the night
  const top = pts[pts.length - 1], dy = top.y + .02;
  a.add(rbx(.22, .03, .14, .01), MAT.creamD, at(top.x, dy, top.z, Math.PI/4));
  const face = at(top.x, dy + .015, top.z, Math.PI/4);
  a.add(archGeo(.2, .3, .03).translate(0, 0, -.015), MAT.cream, face); a.add(archGeo(.15, .26, .036).translate(0, 0, -.018), MAT.night, at(top.x, dy + .02, top.z, Math.PI/4));
  for (let i=0;i<4;i++) blob(a, MAT.star, V3(top.x + Math.cos(Math.PI/4)*.02*(i-1.5) + .005*i, dy + .07 + (i%2)*.1 + i*.02, top.z - Math.sin(Math.PI/4)*.02*(i-1.5) + .026), .01);
  into(a, g);
  glowSprite(g, V3(top.x + .02, dy + .15, top.z + .02), .45, 0xB9B2FF, .5);
}
function teacupCottage(g){
  const a = new Acc(), r = rngFrom(12);
  a.add(new THREE.CylinderGeometry(.36, .3, .04, 22), MAT.cream, at(0, .02, 0)); a.add(new THREE.TorusGeometry(.35, .015, 6, 26).rotateX(Math.PI/2), MAT.sky, at(0, .045, 0));
  const prof = [[0,0],[.16,0],[.2,.02],[.27,.12],[.3,.26],[.31,.38],[.3,.4]].map(([x, y]) => new THREE.Vector2(x, y));
  a.add(new THREE.LatheGeometry(prof, 24), MAT.pink, at(0, .045, 0)); a.add(new THREE.TorusGeometry(.305, .018, 6, 26).rotateX(Math.PI/2), MAT.cream, at(0, .445, 0));
  a.add(new THREE.CylinderGeometry(.29, .29, .01, 24), MAT.peachD, at(0, .42, 0));
  for (let i=0;i<5;i++){ const ang = i/5*6.28 + .3; blob(a, MAT.cream, V3(Math.cos(ang)*.29, .26, Math.sin(ang)*.29), .03, .7); }
  a.add(new THREE.TorusGeometry(.1, .026, 8, 16, Math.PI*1.2), MAT.pinkD, at(-.3, .26, -.1, Math.PI/2 + .3, 1, 1, 1, 0, Math.PI*.4));
  door(a, 'z', .27, .04, .045, .11, .19); win(a, 'x', .285, .06, .28, .07);
  // a roof of steam: a curl of cloud rising like a chimney plume
  cloud(a, 0, .46, 0, .55, r, MAT.cloud, 5); cloud(a, .05, .6, -.06, .38, r, MAT.cloudL, 4); cloud(a, -.04, .72, -.1, .24, r, MAT.cloud, 3);
  // a spoon leaning on the saucer, sugar cubes
  seg(a, MAT.gold, V3(.34, .03, .22), V3(-.3, 1, -.1).normalize(), .4, .012, .012, 5); a.add(new THREE.SphereGeometry(.05, 10, 8), MAT.gold, at(.36, .02, .24, 0, .8, .3, 1.2));
  for (const [x, z] of [[-.34, .26], [-.28, .32]]) a.add(bx(.05, .05, .05), MAT.cream, at(x, .025, z, .4));
  into(a, g);
}
function pillowTower(g){
  const a = new Acc(), r = rngFrom(17); let y = 0;
  const cols = [MAT.lav, PILLOW_STRIPE, MAT.mint, MAT.peach, MAT.pink];
  [[.58, .16], [.52, .15], [.46, .14], [.4, .13], [.33, .12]].forEach(([w, h], i) => {
    const ry = (r() - .5)*.6, m = cols[i]; a.add(rbx(w, h, w*.8, .06), m, at((r() - .5)*.04, y + h/2, (r() - .5)*.04, ry));
    for (const [sx, sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) blob(a, m === PILLOW_STRIPE ? MAT.pink : m, V3(sx*w*.46*Math.cos(ry) + sz*w*.37*Math.sin(ry), y + h/2, -sx*w*.46*Math.sin(ry) + sz*w*.37*Math.cos(ry)), .03, 1.2);
    y += h - .015; });
  door(a, 'z', .23, .06, .01, .1, .13); win(a, 'z', .19, -.08, .4, .07); win(a, 'x', .21, .02, .54, .06);
  // nightcap roof with a pom-pom
  a.add(new THREE.ConeGeometry(.16, .34, 16), CAP, at(0, y + .12, 0, 0, 1, 1, 1, 0, -.35)); blob(a, MAT.cream, V3(.12, y + .26, 0), .045, 1, 1);
  a.add(new THREE.TorusGeometry(.15, .03, 6, 16).rotateX(Math.PI/2), MAT.cream, at(0, y - .03, 0));
  into(a, g);
}
function nightDoor(g){
  const a = new Acc(), r = rngFrom(21), RY = Math.PI/4;
  cloud(a, 0, 0, 0, .75, r, MAT.cloudL, 5);
  for (let i=0;i<3;i++) a.add(rbx(.36 - i*.06, .05, .22 - i*.03, .015), [MAT.creamD, MAT.cream, MAT.lavL][i], at(.1 - i*.02, .02 + i*.05, .1 - i*.02, RY));
  const fx = -.02, fz = -.02, base = .16, M0 = at(fx, base, fz, RY);
  a.add(archGeo(.34, .52, .06).translate(0, 0, -.03), MAT.lav, M0);
  a.add(archGeo(.26, .46, .066).translate(0, 0, -.033), MAT.night, at(fx, base + .01, fz, RY));
  // the door leaf swung open (hinged on the left edge)
  const hx = fx - Math.cos(RY)*.13, hz = fz + Math.sin(RY)*.13;
  a.add(archGeo(.25, .45, .02).translate(.125, 0, 0), MAT.pinkD, at(hx + .02, base + .01, hz + .03, RY + 1.9));
  blob(a, MAT.gold, V3(hx - .14, base + .2, hz + .18), .016);
  // stars and a tiny crescent visible through the doorway
  for (let i=0;i<5;i++){ const u = (r() - .5)*.16, v = .1 + r()*.3; blob(a, MAT.star, V3(fx + Math.cos(RY)*u + .03, base + v, fz - Math.sin(RY)*u + .03), .008 + r()*.006); }
  a.add(crescentGeo(.04, .033, .018, .01, .004), MAT.moon, at(fx + .06, base + .34, fz + .0, RY));
  // a doormat and a star lantern on a crook
  a.add(rbx(.2, .01, .1, .004), MAT.peachD, at(.24, .05, .22, RY));
  seg(a, MAT.ink, V3(-.3, .02, .26), _up, .44, .012, .01, 5); seg(a, MAT.ink, V3(-.3, .46, .26), V3(1, -.2, 0).normalize(), .1, .008, .008, 4);
  hangStar(a, g, -.21, .45, .26, .06, 1);
  into(a, g);
  glowSprite(g, V3(fx + .04, base + .24, fz + .04), .6, 0xAEA6FF, .45);
}
function lampHouse(g){
  const a = new Acc(), r = rngFrom(26);
  cyl(a, MAT.lavD, .3, .28, .06, 0, 0, 0, 20); cyl(a, MAT.lav, .26, .22, .05, 0, .06, 0, 20);
  cyl(a, MAT.cream, .13, .12, .42, 0, .11, 0, 16); a.add(new THREE.TorusGeometry(.13, .012, 6, 18).rotateX(Math.PI/2), MAT.gold, at(0, .3, 0));
  door(a, 'z', .125, 0, .11, .1, .16, MAT.peachD); win(a, 'x', .125, 0, .38, .06);
  // the lampshade roof glows from under
  const shade = new THREE.CylinderGeometry(.18, .36, .3, 20, 1, true);
  a.add(shade, MAT.glass, at(0, .66, 0)); a.add(new THREE.CylinderGeometry(.18, .18, .01, 20), MAT.peach, at(0, .81, 0));
  a.add(new THREE.TorusGeometry(.36, .018, 6, 26).rotateX(Math.PI/2), MAT.peachD, at(0, .51, 0)); a.add(new THREE.TorusGeometry(.18, .014, 6, 20).rotateX(Math.PI/2), MAT.peachD, at(0, .81, 0));
  blob(a, MAT.bulb, V3(0, .55, 0), .07);
  // pull chain + a tiny moth-star hovering, a cushion to sit on
  seg(a, MAT.gold, V3(.24, .38, .1), _up, .14, .004, .004, 3); blob(a, MAT.gold, V3(.24, .37, .1), .014);
  a.add(rbx(.16, .05, .16, .02), MAT.pink, at(.3, .025, .3, .4));
  into(a, g);
  glowSprite(g, V3(0, .6, 0), .9, 0xFFC98A, .5);
}

/* ── water (Breathe) ── */
function risingRain(g){
  const a = new Acc(), r = rngFrom(41);
  a.add(new THREE.CylinderGeometry(1, 1.05, .03, 22), MAT.lavL, at(0, 0, 0, 0, .36, 1, .32)); a.add(new THREE.CylinderGeometry(1, 1, .02, 22), MAT.water, at(0, .025, 0, 0, .33, 1, .29));
  // rain falls UP out of the puddle into a little cloud that floats above
  for (let i=0;i<14;i++){ const px = (r() - .5)*.36, pz = (r() - .5)*.3, h = .05 + r()*.08, y = .12 + r()*.52;
    a.add(new THREE.SphereGeometry(.018, 8, 6), MAT.drop, at(px, y, pz, 0, 1, 1.6, 1)); a.add(new THREE.ConeGeometry(.018, .04, 8), MAT.drop, at(px, y + .04, pz)); void h; }
  for (let i=0;i<3;i++) a.add(new THREE.TorusGeometry(.06 + i*.05, .005, 4, 20).rotateX(Math.PI/2), MAT.shine, at(.02, .04, .02));
  cloud(a, 0, .78, 0, .9, r, MAT.cloud, 6);
  into(a, g);
}
function upsideFountain(g){
  const a = new Acc(), r = rngFrom(43);
  cyl(a, MAT.lavL, .36, .36, .03, 0, 0, 0, 20); cyl(a, MAT.cream, .32, .32, .1, 0, .03, 0, 20); cyl(a, MAT.water, .28, .28, .01, 0, .12, 0, 20);
  a.add(new THREE.TorusGeometry(.32, .018, 6, 24).rotateX(Math.PI/2), MAT.lav, at(0, .13, 0));
  // an upturned bowl floats overhead; the water climbs to it
  a.add(new THREE.SphereGeometry(.2, 18, 10, 0, Math.PI*2, 0, Math.PI/2), MAT.pink, at(0, .7, 0, 0, 1, .6, 1, Math.PI));
  a.add(new THREE.TorusGeometry(.2, .018, 6, 20).rotateX(Math.PI/2), MAT.cream, at(0, .7, 0)); a.add(new THREE.CylinderGeometry(.19, .19, .01, 20), MAT.water, at(0, .7, 0));
  a.add(new THREE.CylinderGeometry(.035, .06, .58, 10, 1, true), MAT.jet, at(0, .41, 0));
  for (let i=0;i<6;i++){ const ang = i/6*6.28; a.add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(V3(Math.cos(ang)*.24, .13, Math.sin(ang)*.24), V3(Math.cos(ang)*.3, .45, Math.sin(ang)*.3), V3(Math.cos(ang)*.19, .68, Math.sin(ang)*.19)), 10, .008, 4), MAT.jet); }
  cloud(a, 0, .82, 0, .5, r, MAT.cloudL, 5);
  into(a, g);
}
function bubbleSpring(g, s){
  const a = new Acc(), r = rngFrom(47);
  a.add(new THREE.CylinderGeometry(1, 1.05, .03, 20), MAT.creamD, at(0, 0, 0, 0, .3, 1, .3)); a.add(new THREE.CylinderGeometry(1, 1, .02, 20), MAT.water, at(0, .025, 0, 0, .27, 1, .27));
  for (let i=0;i<7;i++){ const ang = i/7*6.28; blob(a, [MAT.lavL, MAT.pink, MAT.mint][i%3], V3(Math.cos(ang)*.3, .03, Math.sin(ang)*.3), .05, .7, 1, r); }
  blob(a, MAT.lav, V3(.3, .07, -.28), .08, .9, 1, r); blob(a, MAT.mint, V3(-.3, .05, .26), .06, .9, 1, r);
  into(a, g);
  const bg = new THREE.Group(), b = new Acc(); g.add(bg);
  for (let i=0;i<7;i++){ const t = i/6; bubbleAt(b, V3(Math.sin(i*2.1)*.07*(1 + t), .12 + t*.72, Math.cos(i*2.1)*.07*(1 + t)), .035 + t*.045, i%2 ? MAT.bubble : MAT.bubbleB); }
  into(b, bg); BOBS.push({ o:bg, y:0, ph:(s.x + s.z)*.9, amp:.04, kind:'bob' });
}
function starPond(g){
  const a = new Acc(), r = rngFrom(53);
  a.add(new THREE.CylinderGeometry(1, 1.06, .04, 26), MAT.lavL, at(0, 0, 0, 0, .42, 1, .38));
  a.add(new THREE.CylinderGeometry(1, 1, .02, 26), MAT.pond, at(0, .03, 0, 0, .38, 1, .34));
  for (let i=0;i<9;i++){ const ang = r()*6.28, rad = .05 + r()*.24; a.add(starGeo(.022, .01, .004), MAT.star, at(Math.cos(ang)*rad, .046, Math.sin(ang)*rad*.85, r()*6, 1, 1, 1, -Math.PI/2)); }
  a.add(crescentGeo(.07, .06, .03, .004, .002), MAT.moon, at(-.1, .046, .06, 0, 1, 1, 1, -Math.PI/2));
  // cloud stepping pads across it
  for (const [x, z, s] of [[.22, -.14, .22], [.08, -.26, .2], [.3, .1, .18]]) cloud(a, x, .04, z, s, r, MAT.cloud, 4);
  for (let i=0;i<6;i++){ const ang = r()*6.28; blob(a, i%2 ? MAT.pink : MAT.peach, V3(Math.cos(ang)*.43, .03, Math.sin(ang)*.39), .04 + r()*.02, .7, 1, r); }
  into(a, g);
  glowSprite(g, V3(0, .08, 0), .9, 0xB8B0FF, .3);
}

/* ── trees (Vocab): upside-down trees, trees that hang from a cloud, swirl trees, moon-fruit trees ── */
const FLOWER = [MAT.pink, MAT.lav, MAT.peach, MAT.mint, MAT.butter];
const CANOPY = [MAT.pink, MAT.lav, MAT.mint, MAT.peach, MAT.sky];
function puff(acc, mat, p, r, rng, n=5){ for (let i=0;i<n;i++){ const a = i/n*6.28 + rng(), d = i ? r*.55 : 0; acc.add(new THREE.IcosahedronGeometry(r*(i ? .62 : .85), 1), mat, at(p.x + Math.cos(a)*d, p.y + (i ? (rng() - .5)*r*.5 : 0), p.z + Math.sin(a)*d, rng()*6)); } }
function upsideTree(g, s){
  const a = new Acc(), r = rngFrom(s.x*5 + s.z*11), H = s.h || 1, m = CANOPY[s.c || 0];
  // the canopy sits on the ground, the trunk rises from it and ends in roots reaching into the air, lit at the tips
  puff(a, m, V3(0, .2*H, 0), .3*H, r, 6);
  seg(a, MAT.woodD, V3(0, .3*H, 0), _up, .4*H, .06, .045, 7);
  const top = V3(0, .7*H, 0);
  for (let i=0;i<6;i++){ const ang = i/6*6.28 + r()*.4, d = V3(Math.cos(ang)*.9, .55 + r()*.5, Math.sin(ang)*.9).normalize(), L = (.18 + r()*.12)*H;
    seg(a, MAT.woodD, top, d, L, .025, .008, 5); const tip = top.clone().addScaledVector(d, L);
    const d2 = V3(-d.x*.5, 1, -d.z*.5).normalize(); seg(a, MAT.woodD, tip, d2, Math.max(.05, .96*H - tip.y), .012, .008, 4); blob(a, i%2 ? MAT.bulb : MAT.bulbP, tip.clone().add(V3(0, -.015, 0)), .024); }
  // the ground is up there: a floating disc of lawn the roots grip, flowers growing DOWN from its underside
  blob(a, MAT.soilClod, V3(0, .98*H, 0), .15*H, .75, 1, r);
  for (let i=0;i<7;i++){ const ang = i/7*6.28 + .2, p = V3(Math.cos(ang)*.12*H, 1.06*H, Math.sin(ang)*.12*H); a.add(new THREE.ConeGeometry(.018, .07, 4), MAT.mintD, at(p.x, p.y + .03, p.z, ang, 1, 1, 1, Math.cos(ang)*.3, -Math.sin(ang)*.3)); }
  blob(a, FLOWER[0], V3(.05, 1.1*H, .03), .02); blob(a, FLOWER[4], V3(-.06, 1.09*H, -.02), .018);
  for (let i=0;i<4;i++){ const ang = r()*6.28; blob(a, MAT.cloud, V3(Math.cos(ang)*.3, .02, Math.sin(ang)*.3), .06, .6, 1, r); }
  into(a, g);
}
function hangingTree(g, s){
  const a = new Acc(), r = rngFrom(s.x*7 + s.z*13), H = s.h || 1, m = CANOPY[s.c || 1], cy = 1.02*H;
  // a little cloud floats up high; the tree hangs from it, canopy down, not touching the ground
  cloud(a, 0, cy, 0, .75*H, r, MAT.cloud, 6);
  seg(a, MAT.woodD, V3(0, cy - .02, 0), V3(0, -1, 0), .36*H, .05, .035, 7);
  const low = V3(0, cy - .38*H, 0);
  for (let i=0;i<3;i++){ const ang = i*2.1 + .4, d = V3(Math.cos(ang)*.7, -1, Math.sin(ang)*.7).normalize(); seg(a, MAT.woodD, V3(0, cy - .25*H, 0), d, .16*H, .02, .012, 5); }
  puff(a, m, low.clone().add(V3(0, -.08*H, 0)), .26*H, r, 6);
  for (let i=0;i<5;i++){ const ang = i*1.26; blob(a, MAT.butter, V3(Math.cos(ang)*.2*H, low.y - .22*H, Math.sin(ang)*.2*H), .02); }
  // a tiny sprout pool of shadow-flowers on the ground below, so it reads as hovering
  for (let i=0;i<4;i++){ const ang = i*1.6 + .3; seg(a, MAT.mintD, V3(Math.cos(ang)*.12, 0, Math.sin(ang)*.12), _up, .06, .006, .004, 3); blob(a, MAT.pink, V3(Math.cos(ang)*.12, .07, Math.sin(ang)*.12), .016); }
  into(a, g);
}
function swirlTree(g, s){
  const a = new Acc(), r = rngFrom(s.x*3 + s.z*17), H = s.h || .85, m = CANOPY[s.c || 2];
  const pts = []; for (let i=0;i<=14;i++){ const t = i/14; pts.push(V3(Math.cos(t*9)*.06*(1 - t*.5), t*.55*H, Math.sin(t*9)*.06*(1 - t*.5))); }
  a.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .035, 6), MAT.peachD);
  const c = V3(0, .7*H, 0);
  a.add(new THREE.IcosahedronGeometry(.26*H, 2), m, at(c.x, c.y, c.z, 0, 1, .9, 1));
  for (let i=0;i<3;i++) a.add(new THREE.TorusGeometry(.2*H - i*.05*H, .018, 6, 22, Math.PI*1.3), MAT.cream, at(c.x, c.y + (i - 1)*.07*H, c.z, i*1.4, 1, 1, 1, Math.PI/2 + .3, 0));
  a.add(starGeo(.07, .03, .025), MAT.star, at(c.x, c.y + .32*H, c.z, Math.PI/4));
  for (let i=0;i<3;i++){ const ang = i*2 + r(); blob(a, MAT.cloud, V3(Math.cos(ang)*.22, .02, Math.sin(ang)*.22), .05, .6, 1, r); }
  into(a, g);
  glowSprite(g, V3(c.x, c.y + .32*H, c.z), .4, 0xFFD98A, .45);
}
function moonfruitTree(g, s){
  const a = new Acc(), r = rngFrom(s.x*11 + s.z*5), H = s.h || 1.15, m = CANOPY[s.c || 1];
  seg(a, MAT.woodD, V3(0, 0, 0), V3(.06, 1, -.04).normalize(), .5*H, .06, .04, 7);
  const f = V3(.03, .5*H, -.02);
  [[.6, .6, -.3], [-.5, .7, .4], [0, 1, 0], [-.3, .8, -.6]].forEach(([dx, dy, dz], i) => { const d = V3(dx, dy, dz).normalize(); seg(a, MAT.woodD, f, d, .22*H, .03, .018, 5);
    const tip = f.clone().addScaledVector(d, .22*H); puff(a, i === 2 ? MAT.lavL : m, tip.clone().add(V3(0, .06, 0)), .22*H, r, 4); });
  // crescent moons and stars hang from the canopy like fruit
  for (let i=0;i<5;i++){ const ang = i/5*6.28 + .5, p = V3(Math.cos(ang)*.27*H, .62*H + (i%2)*.12, Math.sin(ang)*.27*H);
    seg(a, MAT.rope, p.clone().add(V3(0, -.08, 0)), _up, .08, .003, .003, 3);
    if (i%2) a.add(crescentGeo(.045, .038, .02, .012, .005), MAT.moon, at(p.x, p.y - .12, p.z, Math.PI/4)); else a.add(starGeo(.04, .018, .014), MAT.star, at(p.x, p.y - .12, p.z, Math.PI/4)); }
  into(a, g);
}

/* ── growing (Sudoku / Math): dream bubbles. Wands sprout from a cloud cushion, blow tiny bubbles, bubbles swell and lift; ripe
   bubbles each carry a little star ── */
function fillBubbleBed(host, s, stage){
  host.clear(); const a = new Acc(), b = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 3), bm = s.v ? MAT.bubbleB : MAT.bubble, ring = s.v ? MAT.skyD : MAT.pinkD;
  for (let i=0;i<3;i++) for (let j=0;j<3;j++){
    const px = (i-1)*.27 + (r()-.5)*.03, pz = (j-1)*.27 + (r()-.5)*.03, y = .075;
    const stem = [0, .04, .06, .07, .08, .08][stage];
    seg(a, MAT.mintD, V3(px, y, pz), _up, stem + .015, .008, .006, 4);
    a.add(new THREE.TorusGeometry(.028, .006, 5, 12), ring, at(px, y + stem + .04, pz, Math.PI/4));
    if (stage >= 2) { const br = [0, 0, .04, .058, .074, .086][stage], lift = [0, 0, .03, .08, .14, .18][stage] + (i*3 + j)%3*.03;
      bubbleAt(b, V3(px, y + stem + .04 + lift + br, pz), br, bm);
      if (stage >= 3 && (i + j) % 2) bubbleAt(b, V3(px + .05, y + stem + lift*.6 + .06, pz - .03), br*.45, bm);
      if (stage >= 5) a.add(starGeo(.022, .01, .008), MAT.star, at(px, y + stem + .04 + lift + br, pz, Math.PI/4)); }
  }
  into(a, host); into(b, host); host.userData.stage = stage;
}

/* ── To-dos: cloud paths, floating steps, star lamps, a moon swing, a mobile, pillows; dream-ribbon fences on the edges ── */
function path(g, s){
  const sl = new THREE.Mesh(G.path, MAT.lavL); sl.position.y = .0175; sl.receiveShadow = true; g.add(sl);
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0;
  if (v === 0) { [[-.2,-.2],[.18,-.2],[-.18,.2],[.2,.19]].forEach(([x, z], i) => cloud(a, x + (r()-.5)*.05, .03, z + (r()-.5)*.05, .3, r, [MAT.cloud, MAT.cloudP, MAT.cloud, MAT.cloudL][i], 4));
    for (let i=0;i<3;i++) a.add(starGeo(.03, .013, .006), MAT.star, at(-.36 + i*.07, .045, .34 - i*.05, r()*6, 1, 1, 1, -Math.PI/2)); g.userData.ghostMode = 'marker'; }
  else if (v === 1) {   // a short stair to nowhere
    const st = []; for (let i=0;i<5;i++) st.push(V3(-.24 + i*.1, .05 + i*.1, .2 - i*.1)); steps(a, st, .18, .1, undefined, r);
    blob(a, MAT.star, V3(.24, .6, -.24), .02); a.add(starGeo(.05, .022, .018), MAT.star, at(.2, .66, -.22, Math.PI/4)); }
  else if (v === 2) {   // star lamp on a curled post
    seg(a, MAT.ink, V3(-.1, .035, .1), _up, .5, .016, .012, 6);
    a.add(new THREE.TorusGeometry(.07, .01, 5, 14, Math.PI*1.4), MAT.ink, at(-.03, .56, .1, Math.PI/4, 1, 1, 1, 0, -.4));
    hangStar(a, g, .04, .6, .03, .08, 1.3);
    for (let i=0;i<4;i++) blob(a, [MAT.pink, MAT.lav, MAT.peach, MAT.mint][i], V3(.2 + (i%2)*.06, .05, .22 - i*.05), .03, .8); }
  else if (v === 3) {   // a swing hanging from a cloud with no tree
    cloud(a, 0, .86, 0, .7, r, MAT.cloud, 6);
    for (const dx of [-.1, .1]) seg(a, MAT.rope, V3(dx, .3, 0), _up, .54, .004, .004, 3);
    const sw = new THREE.Group(), sa = new Acc(); g.add(sw); sa.add(rbx(.26, .025, .09, .01), MAT.pink, at(0, .3, 0)); into(sa, sw);
    BOBS.push({ o:sw, y:0, ph:s.x + s.z, amp:.02, kind:'bob' }); }
  else if (v === 4) {   // a paper-moon mobile on a stand
    seg(a, MAT.woodD, V3(-.2, .035, .2), _up, .62, .016, .013, 6); seg(a, MAT.woodD, V3(-.2, .64, .2), V3(1, .05, -1).normalize(), .4, .01, .01, 4);
    const mob = new THREE.Group(), ma = new Acc(); mob.position.set(.06, .66, -.06); g.add(mob);
    seg(ma, MAT.rope, V3(0, -.08, 0), _up, .08, .003, .003, 3); seg(ma, MAT.woodD, V3(-.14, -.08, 0), V3(1, 0, 0), .28, .006, .006, 4);
    ma.add(crescentGeo(.06, .05, .025, .016, .006), MAT.moon, at(-.13, -.2, 0, Math.PI/4)); seg(ma, MAT.rope, V3(-.13, -.14, 0), _up, .06, .003, .003, 3);
    ma.add(starGeo(.045, .02, .014), MAT.star, at(.13, -.18, 0, Math.PI/4)); seg(ma, MAT.rope, V3(.13, -.14, 0), _up, .06, .003, .003, 3);
    into(ma, mob); BOBS.push({ o:mob, y:.66, ph:s.x*2, amp:0, kind:'spin' }); }
  else {                // a pile of pillows
    a.add(rbx(.3, .08, .22, .04), MAT.lav, at(-.08, .075, .06, .3)); a.add(rbx(.26, .07, .2, .035), PILLOW_STRIPE, at(.02, .145, .02, -.2));
    a.add(rbx(.2, .06, .16, .03), MAT.peach, at(-.04, .205, .04, .6)); a.add(rbx(.18, .07, .18, .035), MAT.mint, at(.24, .07, -.2, .1)); }
  into(a, g);
}
function ribbon(g, s){
  const a = new Acc(), L = s.len;
  const pos = u => s.edge === 'w' ? V3(-.45, 0, u) : V3(u, 0, .45);
  const posts = []; for (let i=0;i<=L*2;i++){ const p = pos(i/2 - L/2); posts.push(p); seg(a, MAT.cream, p, _up, .24, .014, .012, 6);
    a.add(starGeo(.04, .018, .014), i%2 ? MAT.star : MAT.gold, at(p.x, .28, p.z, s.edge === 'w' ? Math.PI/2 : 0)); }
  const n = 40, pts = []; for (let i=0;i<=n;i++){ const u = i/n; const p = pos(u*L - L/2); pts.push(p.setY(.15 + Math.sin(u*L*2*Math.PI*2)*.035)); }
  a.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, .014, 5), MAT.pink, at(0, 0, 0, 0, 1, 1, 1));
  const pts2 = pts.map((p, i) => p.clone().setY(.1 + Math.sin(i/n*L*2*Math.PI*2 + 1.6)*.03));
  a.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), 80, .01, 5), MAT.sky);
  into(a, g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}

/* ── the hero (Gita): a sleeping crescent moon in a nightcap, resting on a cloud pillow, with a ladder to climb it and stars on
   threads. The moon is the one thing in the dream that is awake-asleep: it rocks very slightly ── */
function sleepingMoon(g0){
  const g = new THREE.Group(); g.scale.setScalar(1.14); g0.add(g);
  const a = new Acc(), r = rngFrom(5);
  // the cloud bed
  cloud(a, 0, .02, 0, 2.0, r, MAT.cloud, 8); cloud(a, .35, .02, .4, 1.0, r, MAT.cloudP, 5); cloud(a, -.45, .04, -.3, .9, r, MAT.cloudL, 5);
  a.add(rbx(.5, .12, .3, .06), PILLOW_STRIPE, at(-.1, .32, -.05, Math.PI/4, 1, 1, 1, 0, .1));
  into(a, g);
  // the moon itself: its own group, facing the camera
  const mg = new THREE.Group(); mg.position.set(0, .88, 0); mg.rotation.y = Math.PI/4; g.add(mg); g0.userData.moon = mg;
  const m = new Acc(), R = .64;
  m.add(crescentGeo(R, .52, .3, .24, .05), MAT.moon, at(0, 0, 0, 0, 1, 1, 1, 0, -.2));
  const F = .18, rz = -.2, rot = (x, y) => [x*Math.cos(rz) - y*Math.sin(rz), x*Math.sin(rz) + y*Math.cos(rz)];
  { const [ex, ey] = rot(.35, .1); m.add(new THREE.TorusGeometry(.055, .012, 6, 14, Math.PI), MAT.ink, at(ex, ey, F, 0, 1, 1, 1, 0, Math.PI + rz));
    const [cx, cy] = rot(.43, -.05); m.add(new THREE.CircleGeometry(.05, 16), MAT.cheek, at(cx, cy, F + .002, 0, 1, .7, 1));
    const [mx, my] = rot(.27, -.14); m.add(new THREE.TorusGeometry(.03, .009, 6, 12, Math.PI), MAT.ink, at(mx, my, F, 0, 1, 1, 1, 0, Math.PI + rz)); }
  // the nightcap droops over the top toward the upper horn, pom-pom at the tip
  { const [hx, hy] = rot(.08, .58); m.add(new THREE.ConeGeometry(.2, .52, 18), CAP, at(hx - .06, hy + .18, 0, 0, 1, 1, 1, 0, .75));
    m.add(new THREE.TorusGeometry(.19, .045, 8, 20).rotateX(Math.PI/2), MAT.cream, at(hx + .02, hy + .03, 0, 0, 1, 1, 1, 0, .75));
    blob(m, MAT.cream, V3(hx - .3, hy + .3, 0), .07, 1, 1); }
  into(m, mg);
  // a ladder leans on the moon's outer curve (climb up and sit in the crook)
  const L = new Acc(), b0 = V3(.95, -.86, .34), b1 = V3(.5, .18, .16), side = V3(0, 0, 1).cross(b1.clone().sub(b0)).normalize().multiplyScalar(.08);
  const dir = b1.clone().sub(b0), len = dir.length(); dir.normalize();
  for (const k of [-1, 1]) seg(L, MAT.wood, b0.clone().addScaledVector(side, k), dir, len, .016, .014, 5);
  for (let i=1;i<8;i++){ const p = b0.clone().addScaledVector(dir, len*i/8); seg(L, MAT.woodD, p.clone().addScaledVector(side, -1.05), side.clone().normalize(), .17, .01, .01, 4); }
  // stars on threads from the upper horn, a lantern at the lower
  const hu = rot(-.33, .5), hl = rot(-.33, -.5);
  hangStar(L, mg, hu[0] - .02, hu[1] - .02, .02, .22, 1.3); hangStar(L, mg, hu[0] + .12, hu[1] + .02, -.02, .4, 1);
  blob(L, MAT.bulb, V3(hl[0] - .04, hl[1] - .04, .02), .04);
  into(L, mg);
  glowSprite(mg, V3(0, 0, .1), 2.4, 0xFFE6A8, .26);
  // free stars floating round it
  const s = new Acc(); [[-.75, 1.55, .2, 1.1], [.7, 1.75, -.3, .8], [-.2, 2.0, -.6, .7], [.85, 1.2, .55, .6]].forEach(([x, y, z, k]) => s.add(starGeo(.07*k, .03*k, .025*k), MAT.star, at(x, y, z, Math.PI/4, 1, 1, 1, 0, x)));
  into(s, g);
}

/* ── blueprint: the farm's cells with dream pieces; the moon takes the right-hand corner ── */
const MAP = {
  bigbarn:{ name:'Upside-down manor', b:'manor' }, well:{ name:'Rising rain', b:'rain' },
  apple1:{ name:'Upside-down tree', b:'upside', c:0 }, silo:{ name:'Stairs to nowhere', b:'stairs' },
  silohouse:{ name:'Teacup cottage', b:'teacup' }, coop:{ name:'Pillow tower', b:'pillow' },
  watertower:{ name:'Upturned fountain', b:'fountain' }, pump:{ name:'Bubble spring', b:'bubbles' },
  apple2:{ name:'Hanging tree', b:'hanging', c:1 }, berry1:{ name:'Swirl tree', b:'swirl', c:2, h:.8 },
  peepal:{ name:'Sleeping moon', b:'hero' }, smallbarn:{ name:'Door to the night', b:'door' }, openbarn:{ name:'Lamp house', b:'lamp' },
  pond:{ name:'Star pond', b:'pond' }, orange1:{ name:'Moon-fruit tree', b:'moonfruit', c:1 },
  apple3:{ name:'Upside-down tree', b:'upside', c:3, h:1.1 }, berry2:{ name:'Swirl tree', b:'swirl', c:4, h:.78 },
  orange2:{ name:'Moon-fruit tree', b:'moonfruit', c:0, h:1.05 }, apple4:{ name:'Hanging tree', b:'hanging', c:3, h:.95 }
};
const PATH_V = { path3_4:0, path3_5:2, path1_2:1, path5_2:3, path3_0:5, path2_6:4, path3_6:0 };
const PATH_NAME = ['Cloud stepping stones', 'Floating steps', 'Star lamp', 'Cloud swing', 'Moon mobile', 'Pillow pile'];
const SLOTS = heroRight(FARM).map((f, i) => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') return { ...s, kind:'bed', v:i % 2, name:'Dream bubbles', stages:5 };
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'dr', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'dr', b:'ribbon', edge:f.edge, len:f.len, name:'Dream ribbon' };
  return { ...s, kind:'dr', ...MAP[f.id] };
});
const BUILD = { manor:upsideManor, stairs:stairsNowhere, teacup:teacupCottage, pillow:pillowTower, door:nightDoor, lamp:lampHouse,
  rain:risingRain, fountain:upsideFountain, bubbles:bubbleSpring, pond:starPond,
  upside:upsideTree, hanging:hangingTree, swirl:swirlTree, moonfruit:moonfruitTree, path, ribbon, hero:sleepingMoon };

/* ── ground: a quilt of lavender and peach with soft cloud bloom and faint star stitches, on lavender-to-rose sides ── */
const TILE = { top:['#C9B0F0', '#F4BFA8'], side:'#B79CE4', soilTop:'#A889DC', soilBot:'#E7A0BE' };   // deeper lilac / peach quilt
function tileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(27);
  g.fillStyle = '#F6F2F8'; g.fillRect(0, 0, N, N);
  for (let i=0;i<12;i++){ const x = r()*N, y = r()*N, rad = 22 + r()*44, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); }
  g.strokeStyle = 'rgba(110,80,160,.26)'; g.lineWidth = 3; g.setLineDash([9, 8]); g.beginPath(); g.roundRect(16, 16, N - 32, N - 32, 26); g.stroke(); g.setLineDash([]);
  for (let i=0;i<9;i++){ const x = 30 + r()*(N - 60), y = 30 + r()*(N - 60), s = 3 + r()*3; g.fillStyle = r() < .5 ? 'rgba(255,255,255,.9)' : 'rgba(255,214,120,.45)';
    g.beginPath(); for (let k=0;k<8;k++){ const a = k*Math.PI/4, rr = k%2 ? s*.4 : s; g.lineTo(x + Math.cos(a)*rr, y + Math.sin(a)*rr); } g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ── env: the land rests in a sea of cloud. Puffs bank up against the two visible faces and round the front corner; a stair to
   nowhere drifts off behind, and a few loose stars hang in the air ── */
function buildEnv(){
  const L = V.L, h = L/2 + .02, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  world.children.forEach(o => { if (o.userData.ground === 'blob') o.visible = false; });
  const a = new Acc(), r = rngFrom(61 + L), mats = [MAT.cloud, MAT.cloud, MAT.cloudP, MAT.cloudL];
  const n = Math.max(4, Math.round(L*1.6));
  for (let face=0; face<2; face++) for (let i=0;i<n;i++){ const u = -h - .2 + (i + .5)*(2*h + .4)/n, s = .7 + r()*.4 + L*.07, off = .06 + r()*.14, y = -.62 + r()*.1;
    if (face) cloud(a, u, y, h + off, s, r, mats[i % 4], 7); else cloud(a, h + off, y, -u, s, r, mats[(i + 2) % 4], 7); }
  cloud(a, h + .2, -.6, h + .2, 1.1 + L*.09, r, MAT.cloud, 8);
  for (let i=0;i<n;i++){ const u = -h + (i + .5)*2*h/n; cloud(a, -h - .1, -.6, u, .8 + L*.04, r, mats[i % 4], 6); cloud(a, u, -.6, -h - .1, .8 + L*.04, r, mats[(i + 1) % 4], 6); }
  a.into(env); env.children.forEach(o => { o.castShadow = false; });
  // drifting pieces behind the land: a little flight of stairs to nowhere, and stars
  const b = new Acc(), st = []; for (let i=0;i<7;i++) st.push(V3(-h - .5 + i*.12, .5 + L*.05 + i*.1, -h*.2 - i*.08)); steps(b, st, .2, .11, undefined, r);
  cloud(b, st[0].x - .05, st[0].y - .12, st[0].z, .5, r, MAT.cloud, 5);
  const stars = [[-h*.6, 1.2 + L*.05, -h - .1, 1.2], [h*.3, 1.4 + L*.04, -h - .05, .9], [-h - .1, 1.0 + L*.05, h*.3, .8], [h - .1, 1.1 + L*.05, -h*.7, 1]];
  stars.forEach(([x, y, z, k]) => b.add(starGeo(.08*k, .034*k, .03*k), MAT.star, at(x, y, z, Math.PI/4, 1, 1, 1, 0, x)));
  into(b, env);
  V.framePts.push(V3(h + .5, -.8, h + .5), V3(-h, -.8, h + .55), V3(h + .55, -.8, -h), V3(st[6].x, st[6].y + .15, st[6].z));
}

/* ── decor: tiny cloud tufts, star-flowers and fallen star glints on empty cells ── */
function decor(slots){
  BOBS.length = 0;
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  const put = (grp, x, z, n, rim) => { const a = new Acc(), c = cellPos(x, z);
    for (let j=0;j<n;j++){ const ang = r()*6.28, rad = rim ? .42 : .1 + r()*.32, p = c.clone(); p.x += Math.cos(ang)*rad; p.z += Math.sin(ang)*rad; const q = r();
      if (q < .38) cloud(a, p.x, p.y + .01, p.z, .2 + r()*.1, r, r() < .7 ? MAT.cloud : MAT.cloudP, 4);
      else if (q < .8) { const hh = .06 + r()*.07; seg(a, MAT.mintD, p, _up, hh, .006, .004, 3); const m = FLOWER[Math.floor(r()*FLOWER.length)];
        if (r() < .5) blob(a, m, p.clone().setY(p.y + hh + .012), .022, 1); else a.add(starGeo(.026, .012, .008), m, at(p.x, p.y + hh + .01, p.z, r()*6)); }
      else a.add(starGeo(.03, .013, .006), MAT.star, at(p.x, p.y + .006, p.z, r()*6, 1, 1, 1, -Math.PI/2)); }
    into(a, grp); };
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x, z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z;
    const grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x, z]; world.add(grp);
    const rimCell = (Math.abs(x-3) === V.ring && x > 3) || (Math.abs(z-3) === V.ring && z > 3);
    if (!sl || sl === 'later') { put(grp, x, z, AMBIENT() ? 6 : 3, false); grp.userData.decor = 'meadow'; }
    else if (!placed.includes(sl.id) && AMBIENT()) { put(grp, x, z, 2, false); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if (rimCell) { put(grp, x, z, 1, true); grp.userData.decor = 'rim'; }
  }
}

/* ── ambient: star motes drifting up, bubbles bobbing, the moon rocking in its sleep, mobiles turning ── */
function addAmbient(){
  V.motes = [];
  const mat = new THREE.SpriteMaterial({ map:TEX.star, color:0xFFE6A0, transparent:true, opacity:.9, depthWrite:false, blending:THREE.AdditiveBlending });
  for (let i=0;i<9;i++){ const s = new THREE.Sprite(mat); s.scale.setScalar(.12 + (i%3)*.04); s.renderOrder = 9;
    s.userData = { ph:i*1.7, rad:.6 + (i%4)*.5 + V.ring*.25, sp:.08 + (i%3)*.03, h:.3 + (i%5)*.3 }; world.add(s); V.motes.push(s); V.life.push(s); }
  moveAmbient(2.1);
}
function moveAmbient(t){
  if (!V) return;
  BOBS.forEach(b => { if (b.kind === 'spin') b.o.rotation.y = Math.sin(t*.5 + b.ph)*.8; else b.o.position.y = b.y + Math.sin(t*1.1 + b.ph)*b.amp; });
  const hero = V.pieces && V.pieces.peepal, mg = hero && hero.userData.moon; if (mg) mg.rotation.z = Math.sin(t*.5)*.04;
  (V.motes || []).forEach(s => { const u = s.userData, a = t*u.sp + u.ph, k = ((t*.05 + u.ph*.13) % 1);
    s.position.set(Math.cos(a)*u.rad, TILE_TOP + u.h + k*1.4, Math.sin(a)*u.rad*.8); s.material.opacity = .9; s.scale.setScalar((.1 + (u.ph%3)*.04)*(.7 + .3*Math.sin(t*3 + u.ph))); });
}

/* ── residents: dream sheep float down and drift, sleepy stars come out ── */
function makeSheep(){
  const g = new THREE.Group(), a = new Acc(), r = rngFrom(8);
  for (let i=0;i<9;i++){ const ang = i/9*6.28; a.add(new THREE.IcosahedronGeometry(.075, 1), MAT.wool, at(Math.cos(ang)*.1, Math.sin(ang*2)*.02 + (i%2)*.03, Math.sin(ang)*.14)); }
  a.add(new THREE.IcosahedronGeometry(.12, 2), MAT.wool, at(0, .03, 0, 0, 1, .85, 1.25));
  a.add(new THREE.SphereGeometry(.065, 14, 10), MAT.face, at(0, .02, .17, 0, .9, 1, 1.05));
  blob(a, MAT.wool, V3(0, .08, .15), .045, .8, 1, r);
  for (const sx of [-1, 1]) { a.add(new THREE.SphereGeometry(.03, 8, 6), MAT.face, at(sx*.07, .05, .15, 0, 1.4, .5, .8, 0, sx*.5));
    a.add(new THREE.TorusGeometry(.014, .004, 4, 8, Math.PI), MAT.ink, at(sx*.028, .03, .226, 0, 1, 1, 1, 0, Math.PI)); a.add(new THREE.CircleGeometry(.012, 10), MAT.cheek, at(sx*.045, .005, .222)); }
  for (const [x, z] of [[-.06, -.08], [.06, -.08], [-.06, .08], [.06, .08]]) seg(a, MAT.face, V3(x, -.05, z), V3(0, -1, 0), .07, .014, .012, 5);
  a.into(g); return g;
}
function makeStar(){
  const g = new THREE.Group(), a = new Acc();
  a.add(starGeo(.13, .062, .05), MAT.star, at(0, 0, 0));
  for (const sx of [-1, 1]) { a.add(new THREE.TorusGeometry(.014, .005, 4, 8, Math.PI), MAT.ink, at(sx*.03, .015, .052, 0, 1, 1, 1, 0, Math.PI)); a.add(new THREE.CircleGeometry(.012, 10), MAT.cheek, at(sx*.05, -.01, .051)); }
  a.add(new THREE.TorusGeometry(.012, .004, 4, 8, Math.PI), MAT.ink, at(0, -.015, .052, 0, 1, 1, 1, 0, Math.PI));
  a.into(g); glowSprite(g, V3(0, 0, 0), .55, 0xFFD98A, .45); return g;
}
const SHEEP = [ { at:[1.6, 3.4], lift:1.1, s:1.7, ph:0 }, { at:[3.4, 1.4], lift:1.35, s:1.55, ph:2.1 }, { at:[4.2, 5.0], lift:.95, s:1.6, ph:4.2 } ];
const STARS = [ { at:[0.6, 1.6], lift:1.6, s:1.4 }, { at:[2.8, 0.2], lift:1.8, s:1.2 }, { at:[6.0, 3.6], lift:1.5, s:1.3 }, { at:[3.4, 3.2], lift:2.0, s:1.1 } ];
function moveResidents(t){
  (V && V.res || []).forEach(r => { const e = 1 - Math.pow(1 - r.arrive, 3), u = r.u;
    if (r.kind === 'sheep') { const a = t*.12 + u.ph; r.obj.position.set(u.at.x + Math.sin(a)*.25, TILE_TOP + u.lift + (1 - e)*2.4 + Math.sin(t*.9 + u.ph)*.06, u.at.z + Math.cos(a)*.18);
      r.obj.rotation.y = .9 + Math.sin(a)*.4; r.obj.rotation.z = Math.sin(t*.7 + u.ph)*.08; }
    else { r.obj.position.set(u.at.x, TILE_TOP + u.lift + (1 - e)*1.2 + Math.sin(t*.8 + u.ph)*.05, u.at.z); r.obj.rotation.y = Math.PI/4 + Math.sin(t*.4 + u.ph)*.25;
      r.obj.scale.setScalar(u.s*Math.max(.01, e)*(1 + Math.sin(t*2.4 + u.ph)*.04)); }
  });
}
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.3 - j*.12))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone(), 10, 0xFFF0B0, .6); res(); })); }
async function dreamMoveIn(walk){
  V.residentsIn = true; V.res = [];
  SHEEP.forEach(b => { const c = cellPos(...b.at); V.framePts.push(c.clone().setY(TILE_TOP + b.lift + .35)); });
  STARS.forEach(b => { const c = cellPos(...b.at); V.framePts.push(c.clone().setY(TILE_TOP + b.lift + .3)); });
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const groups = [
    async () => { const rs = SHEEP.map(b => { const o = makeSheep(); o.scale.setScalar(b.s); return addRes('sheep', o, { at:cellPos(...b.at), lift:b.lift, ph:b.ph }); });
      moveResidents(0); if (walk) await arrive(rs, 2300); },
    async () => { const rs = STARS.map((b, i) => addRes('star', makeStar(), { at:cellPos(...b.at), lift:b.lift, s:b.s, ph:i*1.9 })); moveResidents(0); if (walk) await arrive(rs, 1800); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length;
}

export default {
  id:'dream', name:'Dreamland', title:'Your dreamland',
  season:27, dates:'7–20 Sep', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'rising rain & star ponds',     tag:'Water' },
    building:{ label:'upside-down houses & stairs',  tag:'Building' },
    path:    { label:'clouds, steps & ribbons',      tag:'Path' },
    crop:    { label:'dream bubbles',                tag:'Grows' },
    tree:    { label:'upside-down & hanging trees',  tag:'Tree' },
    special: { label:'the sleeping moon',            tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  // a firmer rig than the shared one: less sky fill, a stronger key and plum-tinted shade, so pale pieces keep their edges
  lights:{ hemi:{ sky:0xE6E0FF, ground:0x6E5690, intensity:1.25 }, sun:{ color:0xFFE2CC, intensity:2.7 }, fill:{ color:0xB9A8F0, intensity:.4 } },
  ground:{ tile:TILE, tileMap },
  ghost:{ color:'#8C78C4', opacity:.34, emissive:.14, dash:'#9A86CF', dashOpacity:.6, night:{ opacity:.26, emissive:.3, dashOpacity:.45 } },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M15.5 3.2a8.6 8.6 0 1 0 5.3 13.3A7 7 0 0 1 15.5 3.2z" fill="#F7D57A"/><path d="M14 3.4 9.5 1.6l-1 3.2z" fill="#8FA8EE"/><circle cx="8.6" cy="4.9" r="1.2" fill="#FFF3F8"/><path d="M11.5 12.6q1.2 1 2.4 0" stroke="#4A3F6B" stroke-width="1.1" fill="none" stroke-linecap="round"/><ellipse cx="6" cy="20" rx="4.6" ry="2" fill="#E6DBFA"/><ellipse cx="17.6" cy="20.6" rx="3.8" ry="1.7" fill="#FFE3EE"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M78 16a42 42 0 1 0 26 66A34 34 0 0 1 78 16z"/><path d="M70 17 48 6l-6 16z"/><circle cx="41" cy="23" r="6"/><path d="M96 88l10 26h4l-10-26zM88 90l10 26"/><circle cx="30" cy="112" r="10"/><circle cx="46" cy="108" r="13"/><circle cx="64" cy="112" r="10"/><circle cx="84" cy="114" r="8"/><path d="M104 30l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z"/></g>',
  album:{ image:'assets/dream/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#EDE3FA)' },
  css:'.phone[data-theme="dream"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#F3ECFC 58%,#F6DDE8 100%)}' +
      '.phone[data-theme="dream"]:not([data-night="1"]) .garden{background:radial-gradient(60% 50% at 50% 55%, rgba(226,210,248,.8), rgba(248,220,232,.35) 55%, rgba(248,220,232,0) 74%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'bed') {
      const base = new THREE.Mesh(rbx(.9, .07, .9, .035), MAT.lav); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      const top = new THREE.Mesh(rbx(.82, .02, .82, .01), MAT.cloudL); top.position.y = .07; top.userData.ghostHide = true; g.add(top);
      const host = new THREE.Group(); host.scale.setScalar(1.12); g.add(host); g.userData.plants = host;
      g.userData.regrow = st => fillBubbleBed(host, s, st); fillBubbleBed(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'bed' ? 1.12 : 1,
  contact: s => s.kind === 'dr' && !['path', 'ribbon', 'hero', 'pond', 'rain', 'bubbles'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && s.v === 2) || s.b === 'pond' || s.b === 'swirl',
  decor,
  env: buildEnv,
  ambient: addAmbient,
  tick(t){ moveAmbient(t); moveResidents(t); },

  residents:[ { id:'sheep', name:'Dream sheep', h:.5, at:SHEEP[0].at, face:.9, n:3 }, { id:'star', name:'Sleepy stars', h:.35, at:STARS[0].at, face:0, n:4 } ],
  moveIn: dreamMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('dream:' + d.id, () => { const o = d.id === 'sheep' ? makeSheep() : makeStar(); o.rotation.y = d.id === 'sheep' ? .7 : 0; return o; }, 168); },
  residentRig(d){ const o = d.id === 'sheep' ? makeSheep() : makeStar(); o.scale.setScalar(d.id === 'sheep' ? 1.4 : 1.2); return { obj:o, mixer:new THREE.AnimationMixer(o), clip:null, facing:d.face }; }
};
