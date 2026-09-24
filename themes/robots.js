/* ROBOT FACTORY (?theme=robots) — a friendly, pastel, toy-like factory on the farm's 7×7 ring blueprint (same cells, same ring
   counts 6 / 15 / 19, same order). As in candy, bees and jungle, the hero (a giant friendly robot) takes the LEFT corner
   (cells 0..1 × 5..6) so nothing stands in front of it; the two farm slots it displaces move to the old peepal corner.
   Look: glossy toy plastic in mint / peach / lilac / butter / sky on a mint rivet-panel floor, a lilac metal block with a rivet
   band and gears on its faces (env). Nothing dark or industrial, no weapons, no text, no logos.
   Sudoku/Math pads assemble little robots part by part (wheels → body → arms → head → eyes light up). The giant robot sits
   asleep on its platform all season; when the last piece lands it stands up, wakes and waves, then little bots scurry in and
   two hover drones float down. No CC0 kit fits, so every piece and resident is procedural three.js merged per material (Acc). */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rngFrom, TEX, world } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { G, Acc, seg } from '../engine/proc.js';
import { tween, sparkle, spring } from '../engine/motion.js';
import { addButterflies, flyButterflies } from '../engine/life.js';
import { FARM, FARM_ORDER } from './farm.js';

/* ── canvas textures ── */
function canvasTex(w, h, draw, rep){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
/* soft two-colour stripes (awnings, hazard-free pastel bands) */
function stripeTex(a, b, n=4){ return canvasTex(64, 64, (g, W) => { g.fillStyle = a; g.fillRect(0, 0, W, W); g.fillStyle = b; for (let i=0;i<n;i++) if (i%2) g.fillRect(i*W/n, 0, W/n, W); }, true); }

/* ── materials: glossy toy plastic + soft brushed pastel metal ── */
const PM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.38, metalness:0, ...o });
const MM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.5, metalness:.18, ...o });
const MAT = {
  mint:PM(0x7FDDBE), mintL:PM(0xC4F2E2), mintD:PM(0x4FBF9C), peach:PM(0xFFB08F), peachL:PM(0xFFD8C6), lilac:PM(0xB8A2F4), lilacL:PM(0xDCD1FF), lilacD:PM(0x8D7BD6),
  butter:PM(0xFFDC7A), butterL:PM(0xFFF0BE), sky:PM(0x86C8FF), skyL:PM(0xCBE6FF), pink:PM(0xFF9CBF), pinkL:PM(0xFFD0E0), cream:PM(0xFFF6E8, { roughness:.55 }),
  white:PM(0xFFFFFF), steel:MM(0xCACEE2), steelD:MM(0x9EA4C4), rubber:PM(0x5E6384, { roughness:.8 }), screen:PM(0x2F3760, { roughness:.25 }),
  wood:PM(0xE8C79A, { roughness:.8 }), box:PM(0xF1CF9E, { roughness:.85 }), leaf:PM(0x86D98A), leafD:PM(0x5FBF76),
  glass:new THREE.MeshStandardMaterial({ color:0xE8F6FF, roughness:.06, metalness:0, transparent:true, opacity:.35, depthWrite:false }),
  water:PM(0x6FC8F2, { roughness:.1, emissive:0x1E6FA0, emissiveIntensity:.3 }),
  liquid:PM(0x8EDCFF, { roughness:.08, transparent:true, opacity:.78, emissive:0x3AA6D8, emissiveIntensity:.3, depthWrite:false }),
  bubble:PM(0xFFFFFF, { roughness:.05, transparent:true, opacity:.7, emissive:0xCFF0FF, emissiveIntensity:.35 }),
  glow:PM(0xFFF0B8, { emissive:0xFFC857, emissiveIntensity:1.25 }), glowC:PM(0xC8FBFF, { emissive:0x59E3F5, emissiveIntensity:1.3 }),
  glowP:PM(0xFFD6E6, { emissive:0xFF7FB0, emissiveIntensity:1.15 }), glowG:PM(0xD8FFD8, { emissive:0x6BEA86, emissiveIntensity:1.1 }),
  eyeDim:PM(0x7FD6E6, { emissive:0x2A7F95, emissiveIntensity:.45 }), puff:PM(0xFFFFFF, { roughness:.95 }), duck:PM(0xFFD84A), beak:PM(0xFF9A3D)
};
const AWN = { mint:(() => { const t = stripeTex('#FFFFFF', '#7FDDBE'); return PM(0xFFFFFF, { map:t }); })(), peach:(() => { const t = stripeTex('#FFFFFF', '#FFB08F'); return PM(0xFFFFFF, { map:t }); })() };

/* ── helpers ── */
const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const RB = new Map();
function rgeo(w, h, d, r){ const k = [w, h, d, r].join(); return RB.get(k) || RB.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w/2 - .001, h/2 - .001, d/2 - .001))).get(k); }
/* rounded box standing on y (bottom at y) */
function rb(acc, mat, w, h, d, x=0, y=0, z=0, ry=0, r=.03){ acc.add(rgeo(w, h, d, r), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=18, ry=0){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z, ry)); }
function ball(acc, mat, x, y, z, r, sx=1, sy=1, sz=1){ acc.add(new THREE.SphereGeometry(r, 14, 10), mat, at(x, y, z, 0, sx, sy, sz)); }
/* a disc facing local +z of rotation ry (windows, portholes, eyes) */
function disc(acc, mat, x, y, z, r, ry=0, th=.02){ acc.add(new THREE.CylinderGeometry(r, r, th, 18).rotateX(Math.PI/2), mat, at(x, y, z, ry)); }
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }
const FACE = Math.PI/4;   // toward the camera corner
const onFace = (r, q=FACE) => [Math.sin(q)*r, Math.cos(q)*r];
/* gear: extruded toothed ring, axis along z (faces +z) */
const GEARS = new Map();
function gearGeo(R, teeth=10, th=.05){
  const k = R+':'+teeth+':'+th; if (GEARS.has(k)) return GEARS.get(k);
  const s = new THREE.Shape(), n = teeth*4, rIn = R*.8;
  for (let i=0;i<=n;i++){ const a = i/n*Math.PI*2, r = (i%4 === 1 || i%4 === 2) ? R : rIn; i ? s.lineTo(Math.cos(a)*r, Math.sin(a)*r) : s.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
  const h = new THREE.Path(); h.absarc(0, 0, R*.28, 0, Math.PI*2, true); s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth:th, bevelEnabled:true, bevelThickness:th*.25, bevelSize:R*.04, bevelSegments:1, curveSegments:4 }).translate(0, 0, -th/2);
  GEARS.set(k, g); return g;
}
function gear(acc, mat, x, y, z, R, ry=0, rx=0, teeth=10, th=.05, rz=0){ acc.add(gearGeo(R, teeth, th), mat, at(x, y, z, ry, 1, 1, 1, rx, rz)); }
/* hex nut lying flat */
function nut(acc, mat, x, y, z, r=.05, ry=0){ acc.add(new THREE.CylinderGeometry(r, r, r*.55, 6), mat, at(x, y + r*.27, z, ry));
  acc.add(new THREE.CylinderGeometry(r*.45, r*.45, r*.6, 12), MAT.steelD, at(x, y + r*.3, z)); }
function bolt(acc, x, y, z, s=1, ry=0){ cyl(acc, MAT.steel, .02*s, .02*s, .09*s, x, y, z, 8); acc.add(new THREE.CylinderGeometry(.038*s, .038*s, .025*s, 6), MAT.steelD, at(x, y + .09*s, z, ry)); }
function puff(acc, x, y, z, s=1){ ball(acc, MAT.puff, x, y, z, .07*s); ball(acc, MAT.puff, x + .06*s, y + .02*s, z, .055*s); ball(acc, MAT.puff, x - .05*s, y + .01*s, z + .02*s, .05*s); ball(acc, MAT.puff, x + .01*s, y + .06*s, z, .05*s); }
function crate(acc, x, y, z, s=1, ry=0, mat=MAT.box){ rb(acc, mat, .16*s, .14*s, .16*s, x, y, z, ry, .015*s);
  acc.add(new THREE.BoxGeometry(.165*s, .02*s, .03*s), MAT.pinkL, at(x, y + .07*s, z, ry)); }
function sprout(acc, x, y, z, s=1, pot=MAT.peach){ cyl(acc, pot, .04*s, .05*s, .06*s, x, y, z, 12); ball(acc, MAT.leaf, x - .02*s, y + .09*s, z, .03*s, 1.3, .7, 1); ball(acc, MAT.leafD, x + .02*s, y + .1*s, z, .028*s, 1.3, .7, 1); seg(acc, MAT.leafD, V3(x, y + .05*s, z), V3(0, 1, 0), .05*s, .005, .005, 4); }
function bits(g, rng, x, z, s=1){ const a = new Acc();
  for (let i=0;i<3;i++){ const q = rng()*6.28, d = rng()*.06*s, px = x + Math.cos(q)*d, pz = z + Math.sin(q)*d, k = Math.floor(rng()*3);
    if (k === 0) nut(a, [MAT.butter, MAT.pink, MAT.sky][i%3], px, 0, pz, .035*s, rng()*3); else if (k === 1) bolt(a, px, 0, pz, .8*s, rng()*3); else gear(a, [MAT.mint, MAT.lilac, MAT.peach][i%3], px, .012, pz, .045*s, rng()*3, -Math.PI/2, 8, .02); }
  a.into(g); }

/* ── the ground: mint rivet-panel factory floor ── */
const TILE = { top:['#BDEBDA', '#B4E5D2'], side:'#93D3BC', soilTop:'#C3B8EC', soilBot:'#8F83C4' };
function tileMap(){ return canvasTex(256, 256, (g, N) => {
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  // four soft panels with a light seam and a rivet in each corner
  g.strokeStyle = 'rgba(70,120,110,.16)'; g.lineWidth = 3;
  for (const [x, y] of [[0, 0], [N/2, 0], [0, N/2], [N/2, N/2]]) { g.beginPath(); g.roundRect(x + 6, y + 6, N/2 - 12, N/2 - 12, 10); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.roundRect(x + 10, y + 10, N/2 - 20, 10, 5); g.fill();
    for (const [dx, dy] of [[16, 16], [N/2 - 16, 16], [16, N/2 - 16], [N/2 - 16, N/2 - 16]]) { g.fillStyle = 'rgba(60,110,100,.2)'; g.beginPath(); g.arc(x + dx, y + dy + 1, 4.5, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(x + dx - .8, y + dy - .6, 3, 0, 6.3); g.fill(); } }
}); }

/* ── env: the block is a lilac metal base — a cream band with rivets under the tiles, gears on the front faces ── */
function buildEnv(){
  const L = V.L, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const a = new Acc(), half = (L + .04)/2 + .006, S2 = L + .07;
  for (const [x, z, w, d] of [[0, half, S2, .03], [0, -half, S2, .03], [half, 0, .03, S2], [-half, 0, .03, S2]]) { a.add(new THREE.BoxGeometry(w, .08, d), MAT.cream, at(x, -.11, z)); a.add(new THREE.BoxGeometry(w, .04, d), MAT.mint, at(x, -.52, z)); }
  const n = Math.round(L*3);
  for (let i=0;i<n;i++){ const u = -L/2 + (i + .5)*L/n;
    for (const [x, z, ry] of [[u, half + .016, 0], [half + .016, u, Math.PI/2]]) disc(a, MAT.steel, x, -.11, z, .018, ry, .016); }
  // two gears on each front face, half-sunk into the metal, in pastel plastic
  const gz = [[-L*.28, .15, MAT.butter, 12], [L*.18, .11, MAT.pink, 9]];
  for (const [u, R, m, t] of gz) { gear(a, m, u, -.34, half + .02, R, 0, 0, t, .035); gear(a, m, half + .02, -.34, -u*.8, R, Math.PI/2, 0, t, .035); }
  a.into(env); env.traverse(o => { if (o.isMesh) o.castShadow = false; });
  // the giant robot stands up at completion: keep its standing head in the frame from the start (the land never re-frames)
  if (V.ring >= 3) { const c = cellPos(.5, 5.5); V.framePts.push(V3(c.x, TILE_TOP + 2.3, c.z)); }
}

/* ── buildings (Reading) ── */
/* Main workshop (2×2): a peach hall with a sawtooth sky-blue roof of glowing windows, a mint roll-up door toward the camera,
   a conveyor carrying parcels out, two chimneys puffing white clouds */
function hall(g){
  const a = new Acc(), r = rngFrom(21);
  rb(a, MAT.steel, 1.72, .06, 1.72, 0, 0, 0, 0, .03);
  rb(a, MAT.peach, 1.34, .52, 1.14, -.08, .06, -.1, 0, .06);
  rb(a, MAT.peachL, 1.38, .05, 1.18, -.08, .56, -.1, 0, .02);
  // sawtooth roof: three teeth, glass faces toward +z glow
  for (let i=0;i<3;i++){ const z = -.48 + i*.38;
    const tri = new THREE.Shape(); tri.moveTo(-.19, 0); tri.lineTo(.19, 0); tri.lineTo(-.19, .26); tri.closePath();
    const geo = new THREE.ExtrudeGeometry(tri, { depth:1.3, bevelEnabled:false }).translate(0, 0, -.65).rotateY(Math.PI/2);
    a.add(geo, MAT.sky, at(-.08, .61, z));
    a.add(new THREE.BoxGeometry(1.24, .19, .02), MAT.glowC, at(-.08, .72, z + .19)); a.add(new THREE.BoxGeometry(1.3, .025, .03), MAT.white, at(-.08, .87, z + .19)); }
  // roll-up door (+z face) with slats, and round windows on the +x face
  rb(a, MAT.mintD, .5, .4, .03, -.14, .06, .47, 0, .02); for (let i=0;i<5;i++) a.add(new THREE.BoxGeometry(.46, .012, .01), MAT.mintL, at(-.14, .12 + i*.07, .49));
  rb(a, MAT.mint, .56, .05, .06, -.14, .46, .48, 0, .02);
  for (const z of [-.42, -.1, .22]) { disc(a, MAT.glow, .6, .34, z, .075, Math.PI/2); a.add(new THREE.TorusGeometry(.08, .016, 6, 18), MAT.white, at(.6, .34, z, Math.PI/2)); }
  // gear badge on the front
  gear(a, MAT.butter, .3, .38, .47, .1, 0, 0, 9, .03);
  // chimneys + puffs
  for (const [x, z, h] of [[-.55, -.5, .45], [-.28, -.55, .35]]) { cyl(a, MAT.lilac, .07, .07, h, x, .6, z, 14); cyl(a, MAT.lilacD, .085, .085, .04, x, .6 + h, z, 14); puff(a, x + .04, .6 + h + .14, z, .9); }
  // conveyor out of the door with parcels
  rb(a, MAT.steelD, .36, .07, .5, -.14, .06, .78, 0, .02); rb(a, MAT.rubber, .32, .02, .52, -.14, .13, .78, 0, .01);
  for (let i=0;i<4;i++) cyl(a, MAT.steel, .015, .015, .06, -.14 + (i%2 ? .15 : -.15), 0, .58 + Math.floor(i/2)*.36, 8);
  crate(a, -.14, .15, .7, .9, .2); crate(a, -.12, .15, .92, .8, -.3, MAT.butterL);
  a.into(g);
  glowSprite(g, V3(-.08, .78, .2), .9, 0x9BEFFF, .25);
  const f = rngFrom(23); bits(g, f, .72, .72, 1); const b = new Acc(); sprout(b, -.75, 0, .7, 1.3, MAT.lilac); sprout(b, .7, 0, -.72, 1.2); b.into(g);
}
/* Parts silo: a tall lilac capsule with bands, a porthole and a ladder */
function silo(g){
  const a = new Acc(), r = rngFrom(41);
  cyl(a, MAT.steelD, .3, .32, .05, 0, 0, 0, 22);
  cyl(a, MAT.lilac, .22, .22, .72, 0, .05, 0, 24); ball(a, MAT.lilacL, 0, .77, 0, .22, 1, .7, 1);
  for (const y of [.2, .45, .68]) cyl(a, MAT.butter, .228, .228, .04, 0, y, 0, 24);
  cyl(a, MAT.steel, .02, .02, .12, 0, .9, 0, 8); ball(a, MAT.glowP, 0, 1.03, 0, .035);
  const [dx, dz] = onFace(.215); disc(a, MAT.glow, dx, .56, dz, .06, FACE); a.add(new THREE.TorusGeometry(.065, .014, 6, 16), MAT.white, at(dx, .56, dz, FACE));
  const [lx, lz] = onFace(.225, FACE + 1.1); for (const s of [-1, 1]) seg(a, MAT.steel, V3(lx + Math.cos(FACE + 1.1)*s*.05, .05, lz - Math.sin(FACE + 1.1)*s*.05), V3(0, 1, 0), .62, .008, .008, 5);
  for (let i=0;i<7;i++) a.add(new THREE.BoxGeometry(.1, .01, .01), MAT.steel, at(lx, .1 + i*.08, lz, FACE + 1.1));
  a.into(g); glowSprite(g, V3(dx, .56, dz), .3, 0xFFC857, .35); bits(g, r, .3, .3, .8);
}
/* Control tower: a mint stalk with a glowing glass cab, a dish and a blinking antenna */
function control(g){
  const a = new Acc(), r = rngFrom(51);
  rb(a, MAT.steel, .5, .05, .5, 0, 0, 0, 0, .02);
  cyl(a, MAT.mint, .15, .18, .42, 0, .05, 0, 18);
  cyl(a, MAT.mintD, .27, .2, .06, 0, .47, 0, 22);
  cyl(a, MAT.glowC, .24, .24, .16, 0, .53, 0, 22); for (let i=0;i<8;i++){ const q = i/8*6.28; seg(a, MAT.white, V3(Math.cos(q)*.245, .53, Math.sin(q)*.245), V3(0, 1, 0), .16, .01, .01, 4); }
  cyl(a, MAT.peach, .27, .27, .04, 0, .69, 0, 22); ball(a, MAT.peachL, 0, .73, 0, .2, 1, .45, 1);
  cyl(a, MAT.steel, .012, .012, .18, .06, .78, 0, 6); ball(a, MAT.glowP, .06, .97, 0, .028);
  // dish on the side, facing the sky
  const dish = new THREE.SphereGeometry(.12, 16, 8, 0, Math.PI*2, 0, Math.PI*.35);
  a.add(dish, MAT.white, at(-.14, .92, -.04, 0, 1, 1, 1, -.6, .3)); seg(a, MAT.steel, V3(-.1, .78, -.02), V3(-.3, 1, -.2), .12, .01, .01, 4);
  const [dx, dz] = onFace(.17); rb(a, MAT.mintL, .1, .14, .02, dx, .05, dz, FACE, .01);
  a.into(g); glowSprite(g, V3(0, .6, 0), .55, 0x9BEFFF, .3); bits(g, r, -.3, .3, .8);
}
/* Bot garage: a butter box with a rounded arch door, a charging lamp and a battery on the roof */
function garage(g){
  const a = new Acc(), r = rngFrom(61);
  rb(a, MAT.butter, .6, .38, .5, 0, 0, -.04, 0, .05); rb(a, MAT.butterL, .64, .05, .54, 0, .38, -.04, 0, .02);
  const dz = .215; rb(a, MAT.lilacD, .28, .22, .03, 0, 0, dz, 0, .02); a.add(new THREE.CylinderGeometry(.14, .14, .03, 18, 1, false, -Math.PI/2, Math.PI).rotateX(Math.PI/2), MAT.lilacD, at(0, .22, dz));
  for (let i=0;i<4;i++) a.add(new THREE.BoxGeometry(.26, .01, .01), MAT.lilacL, at(0, .05 + i*.055, dz + .018));
  // battery on the roof: body + cap + a glowing charge band
  rb(a, MAT.white, .24, .12, .12, 0, .43, -.06, 0, .03); rb(a, MAT.steel, .05, .04, .06, .145, .47, -.06, 0, .01); rb(a, MAT.glowG, .14, .08, .125, -.035, .45, -.06, 0, .02);
  disc(a, MAT.glow, .25, .26, dz - .01, .04); a.add(new THREE.TorusGeometry(.045, .01, 5, 14), MAT.white, at(.25, .26, dz));
  a.into(g); glowSprite(g, V3(.25, .26, .3), .3, 0xFFC857, .45); bits(g, r, .33, .33, .8);
}
/* Dome lab: a round mint base under a glass dome with a glowing orb inside, antenna ring on top */
function lab(g){
  const a = new Acc(), r = rngFrom(71);
  cyl(a, MAT.steel, .38, .4, .05, 0, 0, 0, 24); cyl(a, MAT.mint, .34, .36, .16, 0, .05, 0, 24); cyl(a, MAT.mintL, .37, .37, .03, 0, .2, 0, 24);
  for (let i=0;i<6;i++){ const q = i/6*6.28 + .3; disc(a, MAT.glow, Math.sin(q)*.36, .13, Math.cos(q)*.36, .03, q); }
  cyl(a, MAT.steelD, .06, .1, .12, 0, .23, 0, 12); ball(a, MAT.glowP, 0, .42, 0, .1);
  for (let i=0;i<5;i++){ const q = i/5*6.28; ball(a, MAT.glowC, Math.cos(q)*.16, .32 + (i%2)*.12, Math.sin(q)*.16, .02); }
  a.add(new THREE.SphereGeometry(.31, 24, 12, 0, Math.PI*2, 0, Math.PI/2), MAT.glass, at(0, .23, 0));
  a.add(new THREE.TorusGeometry(.31, .015, 6, 30).rotateX(Math.PI/2), MAT.white, at(0, .235, 0));
  cyl(a, MAT.steel, .012, .012, .12, 0, .53, 0, 6); a.add(new THREE.TorusGeometry(.05, .01, 5, 14).rotateX(Math.PI/2), MAT.butter, at(0, .66, 0)); ball(a, MAT.butter, 0, .66, 0, .02);
  a.into(g); glowSprite(g, V3(0, .42, 0), .55, 0xFF9CC8, .4); bits(g, r, .33, -.3, .8);
}
/* Parts shop: a counter under a striped awning, shelves of gears and nuts */
function shop(g){
  const a = new Acc(), r = rngFrom(81);
  rb(a, MAT.lilacL, .56, .34, .3, 0, 0, -.1, 0, .03);
  rb(a, MAT.cream, .52, .22, .2, 0, 0, .16, 0, .03); rb(a, MAT.white, .56, .03, .24, 0, .22, .16, 0, .01);
  for (const [x, z] of [[-.26, .28], [.26, .28]]) cyl(a, MAT.steel, .015, .015, .56, x, 0, z, 8);
  for (let i=0;i<5;i++){ const t = i/4; a.add(new THREE.BoxGeometry(.6, .025, .14), AWN.mint, at(0, .6 - t*.02, -.2 + t*.48, 0, 1, 1, 1, .25)); }
  for (let i=0;i<6;i++) a.add(new THREE.CylinderGeometry(.05, .05, .02, 10, 1, false, 0, Math.PI).rotateX(Math.PI/2), i%2 ? MAT.white : MAT.mint, at(-.25 + i*.1, .54, .31, 0, 1, 1, 1, 0, Math.PI));
  // wares on the counter + wall
  gear(a, MAT.peach, -.14, .3, .13, .06, 0, -1.2, 8, .02); gear(a, MAT.sky, .02, .3, .18, .05, 0, -1.3, 8, .02);
  nut(a, MAT.butter, .15, .25, .15, .035); nut(a, MAT.pink, .2, .25, .1, .03);
  for (const [x, y, m] of [[-.16, .42, MAT.mint], [0, .44, MAT.pink], [.16, .41, MAT.butter]]) gear(a, m, x, y, .055, .055, 0, 0, 8, .02);
  a.into(g); bits(g, r, -.32, .33, .7);
}

/* ── water / air (Breathe) ── */
/* Bubble tank: a glass column of blue coolant, bubbles rising, a mint cap and pipes */
function tank(g){
  const a = new Acc(), r = rngFrom(91);
  cyl(a, MAT.mint, .3, .32, .08, 0, 0, 0, 22); cyl(a, MAT.mintL, .28, .28, .02, 0, .08, 0, 22);
  cyl(a, MAT.liquid, .19, .19, .42, 0, .1, 0, 22);
  for (let i=0;i<14;i++){ const q = r()*6.28, d = r()*.13; ball(a, MAT.bubble, Math.cos(q)*d, .14 + r()*.36, Math.sin(q)*d, .012 + r()*.02); }
  a.add(new THREE.CylinderGeometry(.22, .22, .5, 22, 1, true), MAT.glass, at(0, .34, 0));
  cyl(a, MAT.mint, .24, .22, .06, 0, .56, 0, 22); ball(a, MAT.mintL, 0, .62, 0, .12, 1, .5, 1);
  for (const q of [0, 2.1, 4.2]) cyl(a, MAT.white, .012, .012, .5, Math.cos(q)*.22, .08, Math.sin(q)*.22, 6);
  seg(a, MAT.sky, V3(.24, .12, -.05), V3(1, .2, 0), .14, .035, .035, 10); ball(a, MAT.sky, .38, .15, -.05, .045);
  a.into(g); glowSprite(g, V3(0, .32, 0), .55, 0x8EE6FF, .25); bits(g, r, .3, .3, .7);
}
/* Wind turbine: a pastel mast, three rounded blades facing the camera (they turn while the land is awake) */
function turbine(g){
  const a = new Acc(), r = rngFrom(93);
  cyl(a, MAT.steel, .2, .22, .05, 0, 0, 0, 18);
  cyl(a, MAT.white, .05, .08, 1.0, 0, .05, 0, 14); for (const y of [.3, .65]) cyl(a, MAT.sky, .075, .07, .04, 0, y, 0, 14);
  rb(a, MAT.skyL, .12, .12, .22, 0, 1.0, -.02, FACE, .05);
  a.into(g);
  const hub = new THREE.Group(), [hx, hz] = onFace(.1); hub.position.set(hx, 1.06, hz); hub.rotation.y = FACE; g.add(hub);
  const b = new Acc(); ball(b, MAT.peach, 0, 0, .02, .05);
  for (let i=0;i<3;i++){ const q = i/3*Math.PI*2; b.add(new THREE.CapsuleGeometry(.04, .32, 4, 10).translate(0, .2, 0), [MAT.peach, MAT.mint, MAT.lilac][i], at(0, 0, 0, 0, 1, 1, .45, 0, q)); }
  b.into(hub); g.userData.spin = { obj:hub, axis:'z', sp:1.4 };
  bits(g, r, .3, .3, .8);
}
/* Pinwheel fan: a round breeze fan on a stand */
function fan(g){
  const a = new Acc(), r = rngFrom(95);
  rb(a, MAT.lilac, .34, .06, .26, 0, 0, 0, FACE, .03);
  cyl(a, MAT.white, .03, .03, .38, 0, .06, 0, 10);
  const [cx, cz] = onFace(.02); a.add(new THREE.TorusGeometry(.26, .025, 8, 32), MAT.lilacL, at(cx, .66, cz, FACE));
  for (let i=0;i<6;i++){ const q = i/6*Math.PI*2; a.add(new THREE.BoxGeometry(.012, .52, .012), MAT.white, at(cx, .66, cz, FACE, 1, 1, 1, 0, q)); }
  a.into(g);
  const hub = new THREE.Group(); const [hx, hz] = onFace(.05); hub.position.set(hx, .66, hz); hub.rotation.y = FACE; g.add(hub);
  const b = new Acc(); ball(b, MAT.butter, 0, 0, .02, .045);
  for (let i=0;i<4;i++){ const q = i/4*Math.PI*2; b.add(new THREE.SphereGeometry(.1, 12, 8).translate(0, .12, 0), [MAT.pink, MAT.sky, MAT.butter, MAT.mint][i], at(0, 0, 0, 0, .7, 1, .2, 0, q)); }
  b.into(hub); g.userData.spin = { obj:hub, axis:'z', sp:2.4 };
  bits(g, r, .3, -.3, .7);
}
/* Cooling pool: a round pool in a mint rim, a pipe pouring in, a rubber duck */
function pool(g){
  const a = new Acc(), r = rngFrom(97);
  cyl(a, MAT.mint, .42, .43, .08, 0, 0, 0, 30); cyl(a, MAT.water, .36, .36, .01, 0, .075, 0, 30);
  a.add(new THREE.TorusGeometry(.39, .035, 8, 32).rotateX(Math.PI/2), MAT.mintL, at(0, .085, 0));
  // duck
  ball(a, MAT.duck, .08, .11, .06, .05, 1.2, .8, 1); ball(a, MAT.duck, .12, .16, .08, .032); a.add(new THREE.ConeGeometry(.012, .03, 6).rotateZ(-Math.PI/2), MAT.beak, at(.155, .158, .09, -FACE + .6));
  ball(a, MAT.screen, .135, .17, .105, .006);
  // pipe from the back
  seg(a, MAT.lilac, V3(-.3, .05, -.3), V3(0, 1, 0), .24, .04, .04, 10); seg(a, MAT.lilac, V3(-.3, .29, -.3), V3(1, 0, 1), .14, .04, .04, 10);
  const curve = new THREE.CatmullRomCurve3([V3(-.2, .28, -.2), V3(-.16, .2, -.16), V3(-.14, .09, -.14)]);
  a.add(new THREE.TubeGeometry(curve, 8, .025, 8), MAT.liquid); ball(a, MAT.bubble, -.13, .09, -.12, .04, 1.4, .3, 1.4);
  for (let i=0;i<4;i++) ball(a, MAT.bubble, (r()-.5)*.4, .085, (r()-.5)*.4, .015);
  a.into(g);
}

/* ── tall landmarks (Vocab): gear trees, lamp trees, spring bushes ── */
function gearTree(g, s){
  const a = new Acc(), r = rngFrom(s.x*5 + s.z*13 + 1), h = s.h || 1.15, pal = s.alt ? [MAT.lilac, MAT.sky, MAT.lilacL] : [MAT.mint, MAT.mintD, MAT.leaf];
  cyl(a, MAT.peach, .13, .15, .08, 0, 0, 0, 14);
  cyl(a, MAT.steel, .035, .045, h*.62, 0, .08, 0, 10);
  // canopy: gears standing at different angles, a leafy ball behind them
  const Y = h*.62 + .1;
  ball(a, pal[2], 0, Y + .12, -.04, .22, 1, .85, 1);
  const G3 = [[0, Y + .06, .1, .2, 0], [-.15, Y + .22, 0, .15, .9], [.16, Y + .2, .02, .14, -.7], [.02, Y + .34, -.02, .12, .3]];
  G3.forEach(([x, y, z, R, rot], i) => gear(a, pal[i%2], x, y, z, R, FACE + rot*.3, 0, 9 + (i%2)*2, .045, rot));
  for (let i=0;i<5;i++){ const q = r()*6.28; ball(a, MAT.glowG, Math.cos(q)*.2, Y + .05 + r()*.3, Math.sin(q)*.2, .018); }
  a.into(g); bits(g, r, .28, .26, .7);
}
function lampTree(g, s){
  const a = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 5), h = s.h || 1.2;
  cyl(a, MAT.lilac, .13, .15, .08, 0, 0, 0, 14);
  cyl(a, MAT.white, .035, .04, h*.55, 0, .08, 0, 10);
  const top = V3(0, h*.55 + .08, 0), bulbs = [];
  for (let i=0;i<5;i++){ const q = i/5*6.28 + .4, out = V3(Math.cos(q)*.26, .2 + (i%2)*.14, Math.sin(q)*.26);
    const c = new THREE.CatmullRomCurve3([top.clone(), top.clone().add(V3(out.x*.4, out.y*.9, out.z*.4)), top.clone().add(out)]);
    a.add(new THREE.TubeGeometry(c, 8, .022, 6), MAT.white); bulbs.push(top.clone().add(out)); }
  bulbs.forEach((p, i) => { ball(a, [MAT.glow, MAT.glowP, MAT.glowC][i%3], p.x, p.y + .05, p.z, .075); cyl(a, MAT.steel, .03, .03, .03, p.x, p.y - .02, p.z, 8); });
  ball(a, MAT.butter, 0, top.y + .02, 0, .04);
  a.into(g); glowSprite(g, V3(0, top.y + .25, 0), .9, 0xFFD27A, .25); bits(g, r, .28, .28, .7);
}
function springBush(g, s){
  const a = new Acc(), r = rngFrom(s.x*11 + s.z*5 + 2);
  const coil = (x, z, h, R, m) => { const pts = []; for (let i=0;i<=48;i++){ const t = i/48, q = t*Math.PI*2*5; pts.push(V3(x + Math.cos(q)*R, t*h, z + Math.sin(q)*R)); }
    a.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, .014, 5), m); return h; };
  [[0, 0, .42, .07, MAT.mint, MAT.glowP], [-.2, .12, .3, .06, MAT.lilac, MAT.glowC], [.2, .1, .34, .06, MAT.peach, MAT.glow], [.05, -.2, .26, .055, MAT.sky, MAT.glowG]]
    .forEach(([x, z, h, R, m, b]) => { cyl(a, MAT.steel, R + .02, R + .02, .03, x, 0, z, 12); coil(x, z, h, R, m); ball(a, b, x, h + .06, z, .06); });
  a.into(g);
}

/* ── growing pieces (Sudoku / Math): a pad where little robots are assembled part by part ── */
const BOTS = [[-.04, .04, 1.3]];
function botPart(a, kind, x, z, s, stage, i){
  const Y = .07, body = kind === 'botR' ? [MAT.sky, MAT.pink] : [MAT.butter, MAT.mint], head = kind === 'botR' ? [MAT.skyL, MAT.pinkL] : [MAT.butterL, MAT.mintL];
  // 1: wheels + base plate
  cyl(a, MAT.steelD, .09*s, .09*s, .02*s, x, Y, z, 14);
  for (const sx of [-1, 1]) a.add(new THREE.CylinderGeometry(.035*s, .035*s, .03*s, 12).rotateZ(Math.PI/2), MAT.rubber, at(x + sx*.065*s, Y + .045*s, z, FACE));
  if (stage <= 1) { ball(a, body[i%2], x + .07*s, Y + .02*s, z - .07*s, .03*s); return; }
  // 2: body
  if (kind === 'botR') ball(a, body[i%2], x, Y + .13*s, z, .09*s, 1, 1.05, 1); else rb(a, body[i%2], .16*s, .15*s, .13*s, x, Y + .05*s, z, FACE, .03*s);
  const [fx, fz] = onFace(.075*s); disc(a, stage >= 5 ? MAT.glowP : MAT.white, x + fx, Y + .13*s, z + fz, .022*s, FACE);
  if (stage <= 2) return;
  // 3: arms
  for (const sx of [-1, 1]) { const ox = Math.cos(FACE)*sx*.1*s, oz = -Math.sin(FACE)*sx*.1*s;
    a.add(new THREE.CapsuleGeometry(.018*s, .07*s, 3, 8), MAT.steel, at(x + ox, Y + .12*s, z + oz, 0, 1, 1, 1, 0, sx*.4 + (stage >= 5 && sx > 0 ? 2.2 : 0)));
    ball(a, head[i%2], x + ox*1.25 + (stage >= 5 && sx > 0 ? Math.cos(FACE)*.03*s : 0), Y + (stage >= 5 && sx > 0 ? .2 : .07)*s, z + oz*1.25 - (stage >= 5 && sx > 0 ? Math.sin(FACE)*.03*s : 0), .025*s); }
  if (stage <= 3) return;
  // 4: head with a screen face
  const hy = Y + .23*s + (kind === 'botR' ? .01*s : 0);
  rb(a, head[i%2], .15*s, .11*s, .12*s, x, hy, z, FACE, .04*s);
  const [sx2, sz2] = onFace(.058*s); rb(a, MAT.screen, .11*s, .07*s, .01*s, x + sx2, hy + .02*s, z + sz2, FACE, .02*s);
  // 5: eyes light up, antenna bulb
  const eyes = stage >= 5 ? MAT.glowC : MAT.eyeDim;
  for (const e of [-1, 1]) ball(a, eyes, x + sx2 + Math.cos(FACE)*e*.025*s, hy + .055*s, z + sz2 - Math.sin(FACE)*e*.025*s, .012*s, 1, stage >= 5 ? 1.3 : .5, 1);
  if (stage >= 5) { cyl(a, MAT.steel, .005*s, .005*s, .06*s, x, hy + .11*s, z, 5); ball(a, MAT.glowP, x, hy + .18*s, z, .02*s); }
}
function fillBots(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 3);
  // stage marks on the pad: a little gantry arm leaning over the first bot
  rb(a, MAT.steel, .05, .05, .05, .33, .07, -.33, 0, .01); seg(a, MAT.lilac, V3(.33, .12, -.33), V3(-.2, 1, .1), .32, .02, .02, 6);
  seg(a, MAT.lilac, V3(.27, .43, -.3), V3(-1, -.35, .5), .2, .018, .018, 6); ball(a, MAT.butter, .27, .43, -.3, .03);
  BOTS.forEach(([x, z, sc], i) => botPart(a, s.kind, x, z, sc*1.35, stage, i));
  // parts tray: shrinks as the bots take their parts
  const left = Math.max(0, 5 - stage);
  for (let i=0;i<left;i++) nut(a, [MAT.butter, MAT.pink, MAT.sky, MAT.mint][i%4], -.3 + (i%3)*.07, .07, .3 - Math.floor(i/3)*.07, .025);
  a.into(host);
  if (stage >= 5) glowSprite(host, V3(0, .35, 0), .6, 0x9BEFFF, .3);
  host.userData.stage = stage;
}

/* ── To-dos: conveyor, nut stones, beacon lamp, crate stack, toolbox bench, loading steps; pipe railings ── */
function path(g, s){
  const sl = new THREE.Mesh(G.path, MAT.steel); sl.position.y = .0175; sl.receiveShadow = true; sl.userData.ghostHide = true; g.add(sl);
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0, Y = .035; g.userData.ghostMode = 'marker';
  if (v === 0) { // conveyor belt running across the cell
    rb(a, MAT.lilac, .96, .06, .36, 0, Y, 0, 0, .02); rb(a, MAT.rubber, .94, .015, .3, 0, Y + .06, 0, 0, .006);
    for (let i=0;i<7;i++) a.add(new THREE.BoxGeometry(.012, .005, .3), MAT.steelD, at(-.42 + i*.14, Y + .077, 0));
    crate(a, -.22, Y + .075, 0, .9, .15); crate(a, .2, Y + .075, .02, .75, -.2, MAT.skyL);
    for (const z of [-.3, .3]) for (const x of [-.3, .3]) nut(a, MAT.butter, x, Y, z, .03);
    a.into(g); return; }
  if (v === 1) { const col = [MAT.butter, MAT.pink, MAT.sky, MAT.mint];
    [[-.22, -.2, .1], [.16, -.14, .09], [-.1, .18, .09], [.24, .24, .08]].forEach(([x, z, rr], i) => { a.add(new THREE.CylinderGeometry(rr, rr, .03, 6), col[i], at(x, Y, z, r())); cyl(a, MAT.steel, rr*.4, rr*.4, .035, x, Y, z, 12); });
    a.into(g); return; }
  if (v === 2) { cyl(a, MAT.lilac, .08, .09, .05, 0, Y); cyl(a, MAT.white, .018, .018, .38, 0, Y + .05, 0, 8);
    cyl(a, MAT.peach, .06, .05, .04, 0, Y + .42, 0, 14); ball(a, MAT.glowP, 0, Y + .5, 0, .07); ball(a, MAT.peach, 0, Y + .58, 0, .025);
    a.into(g); glowSprite(g, V3(0, Y + .5, 0), .45, 0xFF8FC0, .6); bits(g, r, -.24, .24, .6); return; }
  if (v === 3) { crate(a, -.12, Y, -.08, 1.3, .1); crate(a, .14, Y, -.05, 1.1, -.2, MAT.skyL); crate(a, -.02, Y + .18, -.06, 1.1, .4, MAT.pinkL); crate(a, .18, Y, .22, .9, .3, MAT.butterL); a.into(g); return; }
  if (v === 4) { // toolbox bench
    rb(a, MAT.mint, .4, .04, .16, 0, Y + .16, 0, FACE, .015); for (const s2 of [-1, 1]) { const ox = Math.cos(FACE)*s2*.16, oz = -Math.sin(FACE)*s2*.16; rb(a, MAT.steelD, .04, .16, .14, ox, Y, oz, FACE, .01); }
    rb(a, MAT.peach, .18, .08, .1, -.05, Y + .2, .03, FACE + .2, .02); a.add(new THREE.TorusGeometry(.04, .01, 5, 12, Math.PI), MAT.steel, at(-.05, Y + .28, .03, FACE + .2));
    a.into(g); const b = new Acc(); sprout(b, .26, Y, .26, 1.1); b.into(g); return; }
  for (let i=0;i<3;i++) rb(a, [MAT.lilacL, MAT.skyL, MAT.mintL][i], .6 - i*.15, .05, .6 - i*.15, 0, Y + i*.05, 0, Math.PI/4*0, .02);
  bolt(a, 0, Y + .15, 0, 1); a.into(g);
}
function fence(g, s){
  const a = new Acc(), L = s.len;
  const run = u => s.edge === 'w' ? [ -.45, u, Math.PI/2 ] : [ u, .45, 0 ];
  for (let i=0;i<=L*2;i++){ const [x, z] = run(i/2 - L/2); cyl(a, MAT.lilac, .025, .025, .26, x, 0, z, 10); ball(a, MAT.butter, x, .28, z, .035); cyl(a, MAT.steel, .04, .04, .03, x, 0, z, 10); }
  for (let i=0;i<L;i++){ const [x, z, ry] = run(i - (L-1)/2);
    a.add(new THREE.CylinderGeometry(.018, .018, 1, 8).rotateZ(Math.PI/2), MAT.mint, at(x, .22, z, ry)); a.add(new THREE.CylinderGeometry(.014, .014, 1, 8).rotateZ(Math.PI/2), MAT.pink, at(x, .12, z, ry)); }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}

/* ── the hero (Gita): a giant friendly robot on a round platform — asleep and sitting all season, stands up at completion ── */
function robotParts(){
  const P = {};
  const mk = build => { const grp = new THREE.Group(), a = new Acc(); build(a); a.into(grp); return grp; };
  P.legs = [-1, 1].map(sx => { const pv = new THREE.Group(); pv.position.set(sx*.17, 0, 0);
    pv.add(mk(a => { rb(a, MAT.steel, .2, .38, .22, 0, -.43, 0, 0, .07); rb(a, MAT.lilac, .23, .06, .25, 0, -.24, 0, 0, .02);
      rb(a, MAT.peach, .27, .11, .34, 0, -.54, .04, 0, .05); ball(a, MAT.steelD, 0, -.05, 0, .1); })); return pv; });
  P.torso = new THREE.Group();
  P.torso.add(mk(a => {
    rb(a, MAT.steelD, .44, .12, .3, 0, -.02, 0, 0, .05);
    rb(a, MAT.mint, .7, .52, .46, 0, .08, 0, 0, .12);
    rb(a, MAT.mintL, .72, .06, .48, 0, .5, 0, 0, .03);
    rb(a, MAT.screen, .36, .22, .02, 0, .2, .235, 0, .05);
    // heart light on the chest + three buttons
    const hs = new THREE.Shape(); hs.moveTo(0, -.05); hs.bezierCurveTo(-.09, .01, -.05, .08, 0, .035); hs.bezierCurveTo(.05, .08, .09, .01, 0, -.05);
    a.add(new THREE.ExtrudeGeometry(hs, { depth:.015, bevelEnabled:false }), MAT.glowP, at(0, .31, .245));
    [MAT.butter, MAT.sky, MAT.peach].forEach((m, i) => disc(a, m, -.1 + i*.1, .15, .245, .025));
    for (const sx of [-1, 1]) ball(a, MAT.lilac, sx*.37, .47, 0, .1);
    cyl(a, MAT.steel, .07, .07, .08, 0, .54, 0, 14);
  }));
  P.arms = [-1, 1].map(sx => { const pv = new THREE.Group(); pv.position.set(sx*.4, .47, 0);
    pv.add(mk(a => { a.add(new THREE.CapsuleGeometry(.07, .26, 4, 10), MAT.steel, at(0, -.2, 0)); rb(a, MAT.lilac, .17, .06, .17, 0, -.2, 0, 0, .02);
      ball(a, MAT.peach, 0, -.42, 0, .1); })); P.torso.add(pv); return pv; });
  P.head = new THREE.Group(); P.head.position.set(0, .6, 0); P.torso.add(P.head);
  P.head.add(mk(a => {
    rb(a, MAT.skyL, .6, .42, .46, 0, 0, 0, 0, .14);
    rb(a, MAT.screen, .46, .26, .02, 0, .08, .23, 0, .08);
    for (const sx of [-1, 1]) { disc(a, MAT.pinkL, sx*.2, .08, .238, .035); a.add(new THREE.CylinderGeometry(.08, .08, .08, 16).rotateZ(Math.PI/2), MAT.peach, at(sx*.32, .22, 0));
      a.add(new THREE.CylinderGeometry(.05, .05, .1, 14).rotateZ(Math.PI/2), MAT.butter, at(sx*.36, .22, 0)); }
    cyl(a, MAT.steel, .012, .012, .16, 0, .42, 0, 6); ball(a, MAT.peach, 0, .6, 0, .045);
    // smile
    a.add(new THREE.TorusGeometry(.045, .01, 5, 14, Math.PI), MAT.glowC, at(0, .16, .245, 0, 1, 1, 1, 0, Math.PI));
  }));
  P.eyesOpen = new THREE.Group(); P.eyesOpen.add(mk(a => { for (const sx of [-1, 1]) a.add(new THREE.CapsuleGeometry(.03, .04, 4, 10), MAT.glowC, at(sx*.1, .245, .245)); }));
  P.eyesShut = new THREE.Group(); P.eyesShut.add(mk(a => { for (const sx of [-1, 1]) a.add(new THREE.TorusGeometry(.035, .01, 5, 12, Math.PI), MAT.eyeDim, at(sx*.1, .23, .245, 0, 1, 1, 1, 0, Math.PI)); }));
  P.bulb = mk(a => ball(a, MAT.glowP, 0, .6, 0, .05)); P.bulb.position.y = 0;
  P.head.add(P.eyesOpen, P.eyesShut, P.bulb);
  return P;
}
/* pose p: 0 = sitting asleep (legs straight out, slumped, head nodding, eyes shut), 1 = standing awake */
function setPose(P, p){
  const L = (a, b) => a + (b - a)*p;
  P.rig.position.y = L(.26, .68)*1.22 - .03*(1 - p);
  P.legs.forEach(l => { l.rotation.x = L(-Math.PI/2, 0); });
  P.torso.rotation.x = L(.14, 0);
  P.head.rotation.x = L(.32, 0); P.head.rotation.z = L(.12, 0);
  P.arms.forEach((a, i) => { const sx = i ? 1 : -1; a.rotation.z = sx*L(.1, i ? 2.5 : .22); a.rotation.x = L(-.35, 0); });
  P.inner.position.z = L(-.12, 0);
  P.eyesOpen.visible = p > .55; P.eyesShut.visible = !P.eyesOpen.visible; P.bulb.visible = p > .55;
  P.p = p;
}
const HERO_BASE = .1;
function giantRobot(g){
  const a = new Acc(), r = rngFrom(5);
  cyl(a, MAT.lilacD, .92, .94, .05, 0, 0, 0, 40); cyl(a, MAT.lilac, .88, .88, .05, 0, .05, 0, 40);
  a.add(new THREE.TorusGeometry(.8, .02, 6, 48).rotateX(Math.PI/2), MAT.butter, at(0, .1, 0));
  for (let i=0;i<16;i++){ const q = i/16*6.28; ball(a, MAT.steel, Math.cos(q)*.86, .1, Math.sin(q)*.86, .02); }
  // steps toward the camera + lamp posts
  const [sx, sz] = onFace(.98); rb(a, MAT.lilacL, .4, .05, .14, sx, 0, sz, FACE, .02);
  for (const s of [-1, 1]) { const ox = Math.cos(FACE)*s*.52, oz = -Math.sin(FACE)*s*.52, [bx, bz] = onFace(.72);
    cyl(a, MAT.white, .018, .018, .3, bx + ox, .1, bz + oz, 8); ball(a, MAT.glow, bx + ox, .43, bz + oz, .04); }
  // a toolbox and a spare gear on the platform
  gear(a, MAT.butter, -.55, .12, -.35, .13, FACE + .4, -Math.PI/2 + .2, 10, .03);
  rb(a, MAT.pink, .2, .1, .12, .56, .1, -.4, FACE - .6, .03);
  a.into(g);
  const P = robotParts(), rig = new THREE.Group(); P.rig = rig;
  rig.rotation.y = FACE; g.add(rig);
  const inner = new THREE.Group(); inner.scale.setScalar(1.22); P.inner = inner; rig.add(inner);   // robot sits a little back so its legs fit
  P.legs.forEach(l => inner.add(l)); inner.add(P.torso);
  setPose(P, 0); g.userData.robot = P;
  glowSprite(g, V3(0, 1.2, 0), 2.2, 0xC8F4FF, .12);
  const [lx, lz] = onFace(.72); for (const s of [-1, 1]) glowSprite(g, V3(lx + Math.cos(FACE)*s*.52, .43, lz - Math.sin(FACE)*s*.52), .3, 0xFFC857, .45);
  const f = rngFrom(7); bits(g, f, .82, .72, 1); bits(g, f, -.8, .76, .9);
}

/* ── blueprint: the farm's cells with factory pieces; the robot takes the left corner ── */
const MAP = {
  bigbarn:{ name:'Main workshop', b:'hall' }, well:{ name:'Bubble tank', b:'tank' }, apple1:{ name:'Gear tree', b:'gearT', h:1.15 },
  silo:{ name:'Parts silo', b:'silo' }, silohouse:{ name:'Control tower', b:'control' }, coop:{ name:'Bot garage', b:'garage' },
  watertower:{ name:'Wind turbine', b:'turbine' }, pump:{ name:'Breeze fan', b:'fan' }, apple2:{ name:'Gear tree', b:'gearT', alt:true, h:1.25 },
  berry1:{ name:'Spring bush', b:'spring' }, peepal:{ name:'Giant robot', b:'hero' },
  smallbarn:{ name:'Dome lab', b:'lab' }, openbarn:{ name:'Parts shop', b:'shop' },
  pond:{ name:'Cooling pool', b:'pool' }, orange1:{ name:'Lamp tree', b:'lampT', h:1.25 },
  apple3:{ name:'Gear tree', b:'gearT', alt:true, h:1.3 }, berry2:{ name:'Spring bush', b:'spring' },
  orange2:{ name:'Lamp tree', b:'lampT', h:1.2 }, apple4:{ name:'Gear tree', b:'gearT', h:1.2 }
};
const MOVE = { peepal:{ x:0, z:5 }, field1_5:{ x:1, z:1 }, fence3:{ x:0, z:0, edge:'w' } };   // hero to the left corner
const PATH_V = { path3_4:1, path3_5:0, path1_2:2, path5_2:3, path3_0:5, path2_6:4, path3_6:1 };
const PATH_NAME = ['Conveyor belt', 'Nut stones', 'Beacon lamp', 'Crate stack', 'Toolbox bench', 'Loading steps'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d, ...(MOVE[f.id] || {}) };
  if (f.kind === 'field') { const round = f.crop === 'Corn' || f.crop === 'Beet';
    return round ? { ...s, kind:'botR', name:'Robot assembly', stages:5 } : { ...s, kind:'botS', name:'Bot workbench', stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 1; return { ...s, kind:'fac', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'fac', b:'fence', edge:s.edge || f.edge, len:f.len, name:'Pipe railing' };
  return { ...s, kind:'fac', ...MAP[f.id] };
});
const BUILD = { hall, silo, control, garage, lab, shop, tank, turbine, fan, pool, gearT:gearTree, lampT:lampTree, spring:springBush, path, fence, hero:giantRobot };

/* decor: no grass on a factory floor — nuts, bolts, loose gears, little potted sprouts, a traffic-free pastel cone */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc(), Y = p.y;
    const spot = (rad=.34) => { const q = r()*6.28, d = .08 + r()*rad; return [p.x + Math.cos(q)*d, p.z + Math.sin(q)*d]; };
    const COL = [MAT.butter, MAT.pink, MAT.sky, MAT.mint, MAT.lilac, MAT.peach];
    if (!sl || sl === 'later') {
      for (let i=0;i<3;i++){ const [px, pz] = spot(); nut(a, COL[Math.floor(r()*6)], px, Y, pz, .03 + r()*.015, r()*3); }
      { const [px, pz] = spot(); gear(a, COL[Math.floor(r()*6)], px, Y + .012, pz, .06 + r()*.03, r()*3, -Math.PI/2, 9, .02); }
      if (r() < .7) { const [px, pz] = spot(.3); sprout(a, px, Y, pz, 1.2 + r()*.4, COL[Math.floor(r()*6)]); }
      if (r() < .5) { const [px, pz] = spot(); bolt(a, px, Y, pz, 1, r()*3); }
      if (r() < .35) { const [px, pz] = spot(.25); crate(a, px, Y, pz, .8, r()*3, [MAT.box, MAT.skyL, MAT.pinkL][Math.floor(r()*3)]); }
      grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) {
      nut(a, COL[Math.floor(r()*6)], p.x + .32, Y, p.z + .32, .035); bolt(a, p.x - .3, Y, p.z + .3, .9); gear(a, COL[Math.floor(r()*6)], p.x + .3, Y + .012, p.z - .28, .05, 0, -Math.PI/2, 8, .02);
      if (r() < .5) sprout(a, p.x - .32, Y, p.z - .3, 1, COL[Math.floor(r()*6)]);
      V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if ((Math.abs(x-3) === V.ring && x > 3) || (Math.abs(z-3) === V.ring && z > 3)) { nut(a, COL[Math.floor(r()*6)], p.x + .38, Y, p.z + .38, .03); grp.userData.decor = 'rim'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ── residents: little bots that scurry, hover drones ── */
const BOT_COL = [[MAT.sky, MAT.skyL], [MAT.pink, MAT.pinkL], [MAT.butter, MAT.butterL], [MAT.mint, MAT.mintL], [MAT.peach, MAT.peachL]];
function makeBot(k=0){
  const g = new THREE.Group(), a = new Acc(), [b, h] = BOT_COL[k % BOT_COL.length];
  for (const sx of [-1, 1]) a.add(new THREE.CylinderGeometry(.035, .035, .03, 12).rotateZ(Math.PI/2), MAT.rubber, at(sx*.065, .035, 0));
  ball(a, b, 0, .11, 0, .075, 1, .95, 1);
  rb(a, h, .13, .09, .11, 0, .15, 0, 0, .035); rb(a, MAT.screen, .1, .055, .01, 0, .165, .053, 0, .02);
  for (const sx of [-1, 1]) { ball(a, MAT.glowC, sx*.024, .195, .06, .011, 1, 1.3, .6); a.add(new THREE.CapsuleGeometry(.014, .04, 3, 6), MAT.steel, at(sx*.085, .1, .01, 0, 1, 1, 1, 0, sx*.5)); }
  cyl(a, MAT.steel, .004, .004, .05, 0, .24, 0, 5); ball(a, MAT.glowP, 0, .295, 0, .016);
  a.into(g); return g;
}
function makeDrone(k=0){
  const g = new THREE.Group(), a = new Acc(), m = [MAT.lilac, MAT.mint][k%2];
  ball(a, m, 0, 0, 0, .07, 1, .6, 1); rb(a, MAT.screen, .07, .03, .01, 0, 0, .06, 0, .012); for (const sx of [-1, 1]) ball(a, MAT.glowC, sx*.016, .003, .066, .007);
  const rot = [];
  for (let i=0;i<4;i++){ const q = i/4*6.28 + Math.PI/4, x = Math.cos(q)*.11, z = Math.sin(q)*.11; seg(a, MAT.steel, V3(0, 0, 0), V3(x, 0, z), .11, .008, .008, 4); cyl(a, MAT.white, .012, .012, .03, x, 0, z, 8); rot.push([x, z]); }
  ball(a, MAT.glowP, 0, -.04, 0, .015);
  a.into(g);
  g.userData.props = rot.map(([x, z]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(.11, .006, .018), MAT.white); p.position.set(x, .033, z); g.add(p); return p; });
  return g;
}
function addAmbient(){ addButterflies(); moveAmbient(2.1); }
function moveAmbient(t){ if (!V) return; flyButterflies(t); (V.butterflies || []).forEach(b => b.visible = !S.night);
  for (const id in V.pieces) { const sp = V.pieces[id].userData.spin; if (sp) sp.obj.rotation.z = t*sp.sp; } }

const RES_SCALE = 1.9;
function botCells(){
  const occ = new Set(); SLOTS.forEach(sl => { if (isEdge(sl) || (sl.b === 'path' && sl.v === 1)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.add((sl.x+a)+','+(sl.z+b)); });
  const out = []; for (let z=1; z<GRID; z++) for (let x=1; x<GRID; x++) if (!occ.has(x+','+z)) out.push([x, z]);
  return out.sort((p, q) => (q[0] + q[1]) - (p[0] + p[1])).slice(0, 5);
}
function moveResidents(t){
  (V && V.res || []).forEach((r, j) => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'drone') { const q = t*.8 + j*2; r.obj.position.set(u.p.x + Math.cos(q)*.25, u.p.y + (1 - e)*1.8 + Math.sin(q*2.1)*.05, u.p.z + Math.sin(q)*.2); r.obj.rotation.y = -q*.5;
      r.obj.userData.props.forEach((p, i) => p.rotation.y = t*40 + i); return; }
    const walking = r.arrive < 1;
    if (walking) { const p = u.from.clone().lerp(u.at, 1 - Math.pow(1 - r.arrive, 2.2)); r.obj.position.set(p.x, TILE_TOP, p.z); r.obj.rotation.y = Math.atan2(u.at.x - u.from.x, u.at.z - u.from.z); return; }
    // scurry: a quick little loop round the spot, a stop, a turn, off again
    const q = t*u.sp + u.ph, go = Math.sin(q*.5) > -.3 ? q : q, rr = .16;
    r.obj.position.set(u.at.x + Math.cos(go)*rr, TILE_TOP + Math.abs(Math.sin(t*14 + j))*.012, u.at.z + Math.sin(go)*rr*.8);
    r.obj.rotation.y = -go + (u.sp > 0 ? 0 : Math.PI);
  });
}
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.3 - j*.07))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(rs[0].obj.position.y + .3), 10, 0x9BEFFF, .6); res(); })); }
const MAKE = { bot:() => makeBot(0), drone:() => makeDrone(0) };
async function robotsMoveIn(walk){
  V.residentsIn = true; V.res = [];
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const gate = cellPos(3, 7.4);
  const groups = [
    async () => { const hero = V.pieces.peepal, P = hero && hero.userData.robot; if (!P) return; V.robotUp = true;
      if (!walk) { setPose(P, 1); return; }
      await new Promise(res => tween(S.rm ? 1 : 1700, t => setPose(P, Math.min(1.04, spring(t, .55, 9))), () => { setPose(P, 1);
        sparkle(hero.position.clone().setY(TILE_TOP + 1.7), 16, 0x9BEFFF, .8); res(); })); },
    async () => { const cells = botCells(); const rs = cells.map(([x, z], i) => { const o = makeBot(i); o.scale.setScalar(RES_SCALE);
        return addRes('bot', o, { at:cellPos(x, z), from:gate.clone().add(V3((i - 2)*.2, 0, i*.15)), sp:(i%2 ? -1 : 1)*(1.1 + i*.15), ph:i*1.7 }); });
      moveResidents(0); if (walk) await arrive(rs, 2400); },
    async () => { const h = cellPos(2.5, 2.5), c = cellPos(.5, 5.5); const rs = [V3(h.x + .2, TILE_TOP + 1.25, h.z + .2), V3(c.x + .6, TILE_TOP + 1.25, c.z - .3)].map((p, i) => {
        const o = makeDrone(i); o.scale.setScalar(2.2); return addRes('drone', o, { p }); }); moveResidents(0); if (walk) await arrive(rs, 1600); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = 2;
}
function wave(t){ if (!V || !V.robotUp) return; const P = V.pieces.peepal && V.pieces.peepal.userData.robot; if (!P || P.p < 1) return;
  P.arms[1].rotation.z = 2.5 + Math.sin(t*5)*.3; P.head.rotation.z = Math.sin(t*1.3)*.06; }

export default {
  id:'robots', name:'Robot factory', title:'Your factory',
  season:33, dates:'19 Apr–2 May', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'bubble tanks, turbines & fans',     tag:'Air' },
    building:{ label:'workshops, towers & labs',          tag:'Workshop' },
    path:    { label:'conveyors, lamps & pipe railings',  tag:'Path' },
    crop:    { label:'robot assembly pads',               tag:'Robot' },
    tree:    { label:'gear trees & lamp trees',           tag:'Tree' },
    special: { label:'the giant robot',                   tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:TILE, tileMap },
  ghost:{ color:'#FFFFFF', opacity:.44, emissive:.22, dash:'#FFFFFF', dashOpacity:.8 },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><rect x="11.2" y="1.5" width="1.6" height="4" fill="#9EA4C4"/><circle cx="12" cy="2.5" r="1.8" fill="#FF9CBF"/><rect x="3.5" y="5.5" width="17" height="13" rx="4" fill="#86C8FF"/><rect x="6" y="8" width="12" height="7" rx="2.5" fill="#2F3760"/><rect x="8" y="10" width="2.2" height="3" rx="1.1" fill="#C8FBFF"/><rect x="13.8" y="10" width="2.2" height="3" rx="1.1" fill="#C8FBFF"/><rect x="1.5" y="10" width="2" height="4" rx="1" fill="#FFB08F"/><rect x="20.5" y="10" width="2" height="4" rx="1" fill="#FFB08F"/><rect x="7" y="19" width="10" height="3" rx="1.5" fill="#7FDDBE"/></svg>',
  silhouette:'<g fill="currentColor"><rect x="61" y="6" width="6" height="14"/><circle cx="64" cy="8" r="6"/><rect x="36" y="20" width="56" height="40" rx="12"/><rect x="28" y="32" width="10" height="16" rx="4"/><rect x="90" y="32" width="10" height="16" rx="4"/><rect x="58" y="60" width="12" height="6"/><rect x="34" y="66" width="60" height="38" rx="12"/><rect x="18" y="68" width="14" height="32" rx="7"/><rect x="96" y="68" width="14" height="32" rx="7"/><rect x="42" y="104" width="16" height="16" rx="4"/><rect x="70" y="104" width="16" height="16" rx="4"/><rect x="46" y="30" width="36" height="20" rx="6" fill-opacity=".35"/></g>',
  album:{ image:'assets/robots/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E3F6EF)' },
  css:'.phone[data-theme="robots"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#EFFAF6 58%,#D6F1E7 100%)}',
  env: buildEnv,

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'botR' || s.kind === 'botS') {
      const base = new THREE.Mesh(G.field, s.kind === 'botR' ? MAT.lilacL : MAT.skyL); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      const host = new THREE.Group(); host.scale.setScalar(1.1); g.add(host); g.userData.plants = host;
      g.userData.regrow = st => fillBots(host, s, st); fillBots(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'fac' ? 1 : 1.1,
  contact: s => s.kind === 'fac' && !['path', 'fence', 'hero', 'pool'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && s.v === 2),
  decor,
  ambient: addAmbient,
  tick(t){ moveAmbient(t); moveResidents(t); wave(t); },

  residents:[ { id:'bot', name:'Little bots', n:5 }, { id:'drone', name:'Hover drones', n:2 } ],
  moveIn: robotsMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('robots:'+d.id, () => { const o = MAKE[d.id](); o.scale.setScalar(3); o.rotation.y = .5; return o; }, 168); },
  residentRig(d){ const obj = MAKE[d.id](); obj.scale.setScalar(d.id === 'drone' ? 2.2 : RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
