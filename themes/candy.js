/* CANDY LAND (?theme=candy) — a strawberry-frosted land on a chocolate layer-cake block, on the farm's 7×7 ring blueprint
   (same cells, same ring counts 6 / 15 / 19, same order). As in bees and jungle, the hero (the candy castle) takes the LEFT
   corner (cells 0..1 × 5..6) so nothing stands in front of it, and the two farm slots it displaces move to the old peepal corner.
   Look, kept apart from the pet park (mint lawn, pastel toy plastic): glossy saturated sweets on pink sprinkle frosting, a
   chocolate sponge block with a cream filling stripe and white icing dripping over the rim (env), chocolate water, and candy
   in place of grass. No CC0 kit has sweets, so every piece and resident is procedural three.js merged per material (Acc);
   canvas textures (sprinkles, swirls, candy stripes, wafer grid) are drawn at load. No asset files, no brands, no text. */
import * as THREE from 'three';
import { rngFrom, TEX, addSway, world } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { G, Acc, seg, blob, _up } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { addButterflies, flyButterflies } from '../engine/life.js';
import { FARM, FARM_ORDER } from './farm.js';

/* ── canvas textures ── */
function canvasTex(w, h, draw, rep){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
/* spiral lollipop face: arms = list of colours laid as a thick spiral over the base colour */
function swirlTex(base, arms){ return canvasTex(256, 256, (g, W) => {
  g.fillStyle = base; g.fillRect(0, 0, W, W); const c = W/2;
  arms.forEach((col, k) => { g.strokeStyle = col; g.lineWidth = W*(arms.length > 2 ? .07 : .1); g.lineCap = 'round'; g.beginPath();
    for (let i=0;i<=240;i++){ const t = i/240, r = t*c*.98, a = t*Math.PI*6 + k*2*Math.PI/arms.length; g.lineTo(c + Math.cos(a)*r, c + Math.sin(a)*r); } g.stroke(); });
  const gr = g.createRadialGradient(c*.7, c*.65, 0, c, c, c); gr.addColorStop(0, 'rgba(255,255,255,.45)'); gr.addColorStop(.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.08)');
  g.fillStyle = gr; g.fillRect(0, 0, W, W); }); }
/* diagonal candy stripes: wraps round a cylinder as a helix */
function stripeTex(a, b){ return canvasTex(64, 64, (g, W) => { g.fillStyle = a; g.fillRect(0, 0, W, W); g.fillStyle = b;
  for (let k=-1;k<2;k++){ g.beginPath(); g.moveTo(k*W, 0); g.lineTo(k*W + W*.5, 0); g.lineTo(k*W + W, W); g.lineTo(k*W + W*.5, W); g.fill(); } }, true); }
const waferTex = canvasTex(64, 64, (g, W) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, W); g.strokeStyle = 'rgba(140,80,20,.35)'; g.lineWidth = 3;
  for (let i=0;i<4;i++){ const p = i*W/4 + W/8; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, W); g.moveTo(0, p); g.lineTo(W, p); g.stroke(); } }, true);

/* ── materials: glossy candy vs matte bakery ── */
const CM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.34, metalness:0, ...o });
const BM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.9, metalness:0, ...o });
const texMat = (tex, rx=1, ry=1, o = {}) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return CM(0xFFFFFF, { map:t, ...o }); };
const MAT = {
  icing:CM(0xFFFBF5, { roughness:.5 }), pinkI:CM(0xFF9EC4, { roughness:.45 }), mintI:CM(0x9DEBD0, { roughness:.45 }), lilacI:CM(0xCDB2FF, { roughness:.45 }),
  sponge:BM(0xF7D39A), spongeP:BM(0xFFB8CE), cookie:BM(0xDCA066), cookieD:BM(0xB87A44), crumb:BM(0xC98E58, { roughness:1 }), brownie:BM(0x9A5E3A, { roughness:1 }), chip:BM(0x4A2716),
  choc:CM(0x6B3A21, { roughness:.28 }), chocD:CM(0x4A2716, { roughness:.3 }), chocL:CM(0x8E5634, { roughness:.3 }),
  chocW:CM(0x7A4428, { roughness:.12, emissive:0x2A1206, emissiveIntensity:.25 }),
  red:CM(0xF0304E), cherry:CM(0xE8203F, { roughness:.18, emissive:0x5A0010, emissiveIntensity:.2 }), stem:CM(0x5C8A3A),
  pink:CM(0xFF7FAF), pinkL:CM(0xFFC2DA), mint:CM(0x6FE0B8), mintL:CM(0xBFF5E2), lemon:CM(0xFFE066), orange:CM(0xFFA24A),
  lilac:CM(0xB892FF), lilacL:CM(0xDCCBFF), sky:CM(0x7CC9FF), skyL:CM(0xC6E8FF), white:CM(0xFFFFFF), cream:CM(0xFFF1D6, { roughness:.6 }),
  gum:[CM(0xFF4F7B, { roughness:.55 }), CM(0xFFC93C, { roughness:.55 }), CM(0x4FD69C, { roughness:.55 }), CM(0x9F7BFF, { roughness:.55 }), CM(0xFF8A3D, { roughness:.55 }), CM(0x4FB8FF, { roughness:.55 })],
  paperP:BM(0xFFA8C8, { flatShading:true }), paperM:BM(0x9EE6CF, { flatShading:true }), paperL:BM(0xC9B5FF, { flatShading:true }), paperY:BM(0xFFDD80, { flatShading:true }),
  stick:BM(0xFFF8EE), wafer:BM(0xE9B872, { map:waferTex }), waferD:BM(0xC99450),
  glass:new THREE.MeshStandardMaterial({ color:0xFFF4FA, roughness:.06, metalness:0, transparent:true, opacity:.35, depthWrite:false }),
  soda:CM(0xFF8DB8, { roughness:.1, transparent:true, opacity:.8, emissive:0xC0306A, emissiveIntensity:.25, depthWrite:false }),
  bubble:CM(0xFFFFFF, { roughness:.05, transparent:true, opacity:.7, emissive:0xFFD6E8, emissiveIntensity:.3 }),
  glow:CM(0xFFE6A0, { emissive:0xFFB347, emissiveIntensity:1.25 }), glowP:CM(0xFFD2E6, { emissive:0xFF7FB0, emissiveIntensity:1.1 }),
  eye:CM(0x2A1A22), wing:CM(0xF4FAFF, { transparent:true, opacity:.8, side:THREE.DoubleSide, emissive:0xB8D8F0, emissiveIntensity:.25 }),
  beeY:CM(0xFFD03C), beeK:CM(0x2B2320)
};
const SWIRL = {
  pink:texMat(swirlTex('#FFFFFF', ['#FF5C93'])), mint:texMat(swirlTex('#FFFFFF', ['#35C996'])), lilac:texMat(swirlTex('#FFF6D6', ['#9C6BFF'])),
  rainbow:texMat(swirlTex('#FFFFFF', ['#FF4F7B', '#FFC93C', '#4FD69C', '#4FA8FF', '#A57BFF'])),
  mintDisc:texMat(swirlTex('#FFFFFF', ['#FF3B5C', '#FF3B5C', '#FF3B5C'])), choc:texMat(swirlTex('#8E5634', ['#FFE9C8']))
};
const CANE = {}; function cane(n, col='#F2304E', base='#FFFFFF'){ const k = n+col; return CANE[k] || (CANE[k] = texMat(stripeTex(base, col), 1, n)); }
const SWAYM = {}; function swayMat(hex, h, amp, rough=.6){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = CM(hex, { roughness:rough }); addSway(m, h, amp); return SWAYM[k] = m; }

/* ── helpers ── */
const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=16, ry=0){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z, ry)); }
function ball(acc, mat, x, y, z, r, sx=1, sy=1, sz=1){ acc.add(new THREE.SphereGeometry(r, 14, 10), mat, at(x, y, z, 0, sx, sy, sz)); }
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }
const FACE = Math.PI/4;   // toward the camera corner
/* icing band + drips hanging from a round edge */
function dripRing(acc, mat, r, y, n, rng, tube=.028){
  acc.add(new THREE.TorusGeometry(r, tube, 6, 36).rotateX(Math.PI/2), mat, at(0, y, 0));
  for (let i=0;i<n;i++){ const a = i/n*6.28 + rng()*.25, L = .03 + rng()*.09, rr = r + tube*.4;
    acc.add(new THREE.CapsuleGeometry(tube*.8, L, 3, 8), mat, at(Math.cos(a)*rr, y - L/2 - tube*.3, Math.sin(a)*rr)); }
}
/* soft-serve swirl: stacked tori shrinking to a tip */
function swirl(acc, mat, x, y, z, r, n=4){
  for (let i=0;i<n;i++){ const t = i/n, rr = r*(1 - t*.72); acc.add(new THREE.TorusGeometry(rr, r*.34*(1 - t*.45), 8, 22).rotateX(Math.PI/2), mat, at(x, y + i*r*.42, z, i*.8)); }
  acc.add(new THREE.ConeGeometry(r*.3, r*.5, 10), mat, at(x, y + n*r*.42 + r*.05, z));
}
function cherry(acc, x, y, z, s=1){ ball(acc, MAT.cherry, x, y + .03*s, z, .035*s); seg(acc, MAT.stem, V3(x, y + .06*s, z), V3(.35, 1, 0).normalize(), .06*s, .005*s, .004*s, 4); }
const GUM_PROFILE = s => [[0,0],[.06,0],[.064,.012],[.058,.05],[.04,.08],[.018,.092],[0,.095]].map(([x, y]) => new THREE.Vector2(x*s, y*s));
const GUMGEO = new THREE.LatheGeometry(GUM_PROFILE(1), 14);
function gumdrop(acc, x, y, z, s, k){ acc.add(GUMGEO, MAT.gum[k % MAT.gum.length], at(x, y, z, 0, s, s, s)); }
/* a flat lollipop disc on a stick, facing the camera */
function lolly(acc, mat, x, y, z, r, stickH, ry=FACE){
  cyl(acc, MAT.stick, .012*r/.1, .012*r/.1, stickH, x, y, z, 8);
  acc.add(new THREE.CylinderGeometry(r, r, r*.28, 32).rotateX(Math.PI/2), mat, at(x, y + stickH + r*.85, z, ry));
}
/* candy cane: striped staff + hook */
function candyCane(acc, x, y, z, h, r=.022, ry=0, col){
  const m = cane(Math.max(2, Math.round(h*10)), col); cyl(acc, m, r, r, h, x, y, z, 10);
  const hr = .055*h/.4 + .02; acc.add(new THREE.TorusGeometry(hr, r, 8, 14, Math.PI), cane(3, col), at(x + Math.cos(ry)*hr, y + h, z - Math.sin(ry)*hr, ry));
}
function sprinkles(acc, rng, cx, cz, rad, y, n){
  for (let i=0;i<n;i++){ const a = rng()*6.28, d = Math.sqrt(rng())*rad;
    acc.add(new THREE.CapsuleGeometry(.007, .022, 2, 5), MAT.gum[i % 6], at(cx + Math.cos(a)*d, y, cz + Math.sin(a)*d, rng()*6, 1, 1, 1, Math.PI/2, 0)); }
}
function sweetsPile(g, rng, x, z, s=1, y=0){ const a = new Acc();
  for (let i=0;i<4;i++){ const q = rng()*6.28, d = rng()*.08*s; gumdrop(a, x + Math.cos(q)*d, y, z + Math.sin(q)*d, (.5 + rng()*.35)*s, Math.floor(rng()*6)); }
  a.into(g); }
function peppermint(acc, x, y, z, r=.05, flat=true){ acc.add(new THREE.CylinderGeometry(r, r, r*.45, 22), SWIRL.mintDisc, flat ? at(x, y + r*.22, z) : at(x, y + r, z, FACE, 1, 1, 1, Math.PI/2)); }
function marsh(acc, x, y, z, s=1, mat=MAT.white){ acc.add(new THREE.CylinderGeometry(.04*s, .04*s, .06*s, 14), mat, at(x, y + .03*s, z)); }

/* ── the ground: pink sprinkle frosting ── */
const TILE = { top:['#FFB3CE', '#FFA9C7'], side:'#F58AB0', soilTop:'#8A5233', soilBot:'#5A321E' };
function tileMap(){ return canvasTex(256, 256, (g, N) => {
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N); const r = rngFrom(26);
  // soft frosting swirls
  for (let i=0;i<5;i++){ g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 5; g.beginPath(); const cx = r()*N, cy = r()*N; for (let k=0;k<30;k++){ const t = k/30, rr = 8 + t*26, a = t*9; g.lineTo(cx + Math.cos(a)*rr, cy + Math.sin(a)*rr); } g.stroke(); }
  const cols = ['#FF3F77', '#FFD23C', '#39D39A', '#4FA8FF', '#A57BFF', '#FFFFFF', '#FF8A3D'];
  for (let i=0;i<70;i++){ const x = r()*N, y = r()*N, a = r()*Math.PI; g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = cols[i % cols.length];
    g.beginPath(); g.roundRect(-7, -2.2, 14, 4.4, 2.2); g.fill(); g.restore(); }
}); }

/* ── env: the block becomes a chocolate layer cake — cream filling stripe + white icing dripping over the rim ── */
function buildEnv(){
  const L = V.L, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const a = new Acc(), r = rngFrom(L*7 + 3), half = (L + .04)/2, S2 = L + .06;
  // filling stripe (strawberry cream) half-way down
  for (const [x, z, w, d] of [[0, half, S2, .03], [0, -half, S2, .03], [half, 0, .03, S2], [-half, 0, .03, S2]]) a.add(bx(w, .07, d), MAT.pinkL, at(x, -.33, z));
  // icing lip just under the tiles + drips of different lengths on every side
  for (const [x, z, w, d] of [[0, half, S2, .035], [0, -half, S2, .035], [half, 0, .035, S2], [-half, 0, .035, S2]]) a.add(bx(w, .06, d), MAT.icing, at(x, -.025, z));
  const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [sx, sz] of sides){ const n = Math.round(L*2.4);
    for (let i=0;i<n;i++){ const u = -half + (i + .5 + (r()-.5)*.5)*(L/n), len = .03 + Math.pow(r(), 1.6)*.2, rad = .034 + r()*.02, x = sx ? sx*(half + .004) : u, z = sz ? sz*(half + .004) : u;
      a.add(new THREE.CapsuleGeometry(rad, len, 4, 10), MAT.icing, at(x, -.03 - len/2, z, 0, sx ? .6 : 1, 1, sz ? .6 : 1)); } }
  // a few sprinkles stuck on the drips (front faces)
  for (let i=0;i<L*4;i++){ const u = -half + r()*L, front = i%2, x = front ? half + .04 : u, z = front ? u : half + .04;
    a.add(new THREE.CapsuleGeometry(.008, .025, 2, 5), MAT.gum[i % 6], at(x, -.03 - r()*.05, z, 0, 1, 1, 1, 0, r()*3)); }
  a.into(env); env.traverse(o => { if (o.isMesh) o.castShadow = false; });
}

/* ── buildings (Reading) ── */
/* Layer-cake house (2×2): three round tiers with icing drips, lit arched windows, a door toward the camera, a swirl + cherry on top */
function hall(g){
  const a = new Acc(), r = rngFrom(21);
  cyl(a, MAT.cookieD, .9, .92, .05, 0, 0, 0, 36); cyl(a, MAT.cookie, .86, .86, .03, 0, .05, 0, 36);
  const tiers = [[.74, .4, MAT.spongeP, MAT.icing], [.54, .3, MAT.cream, MAT.pinkI], [.34, .26, MAT.chocL, MAT.icing]];
  let y = .08;
  tiers.forEach(([rr, h, wall, ice], i) => {
    cyl(a, wall, rr, rr, h, 0, y, 0, 36); cyl(a, ice, rr + .01, rr + .01, .03, 0, y + h - .03, 0, 36); dripRing(a, ice, rr, y + h - .01, 14 + i*2, r, .03);
    // windows round the tier (skip the door side on tier 0)
    const nw = [7, 6, 4][i];
    for (let k=0;k<nw;k++){ const q = k/nw*6.28 + .3 + i*.4; if (i === 0 && Math.abs(((q - FACE + 9.42) % 6.28) - 3.14) > 2.7) continue;
      const wx = Math.sin(q)*(rr + .004), wz = Math.cos(q)*(rr + .004), wy = y + h*.45;
      a.add(new THREE.CylinderGeometry(.05, .05, .02, 14).rotateX(Math.PI/2), MAT.glow, at(wx, wy, wz, q, 1, 1.25, 1));
      a.add(new THREE.TorusGeometry(.055, .012, 5, 16), MAT.white, at(wx, wy, wz, q, 1, 1.25, 1)); }
    // strawberries on the ledge
    if (i < 2) for (let k=0;k<5;k++){ const q = k/5*6.28 + 1; const px = Math.sin(q)*(rr - .08), pz = Math.cos(q)*(rr - .08), ny = tiers[i+1] ? tiers[i+1][0] : 0;
      if (Math.hypot(px, pz) > ny + .05) { ball(a, MAT.red, px, y + h + .035, pz, .035, 1, 1.15, 1); cyl(a, MAT.stem, .022, .005, .02, px, y + h + .07, pz, 5); } }
    y += h;
  });
  swirl(a, MAT.icing, 0, y + .03, 0, .16, 4); cherry(a, 0, y + .3, 0, 1.4);
  // door + candy-cane posts
  const dx = Math.sin(FACE)*.745, dz = Math.cos(FACE)*.745;
  a.add(bx(.2, .22, .03), MAT.chocD, at(dx, .19, dz, FACE)); a.add(new THREE.CylinderGeometry(.1, .1, .03, 16, 1, false, -Math.PI/2, Math.PI).rotateX(Math.PI/2), MAT.chocD, at(dx, .3, dz, FACE));
  ball(a, MAT.lemon, dx + .04, .2, dz + .02, .012);
  for (const s of [-1, 1]) candyCane(a, dx + Math.cos(FACE)*s*.17 + .05, .08, dz - Math.sin(FACE)*s*.17 + .05, .32, .02, s > 0 ? FACE + Math.PI : FACE);
  a.into(g);
  glowSprite(g, V3(dx + .08, .25, dz + .08), .55, 0xFFB347, .45);
  const f = rngFrom(23); sweetsPile(g, f, -.78, .78, 1); sweetsPile(g, f, .8, -.72, .9);
}
/* Candy-cane tower: a helix-striped round tower, gumdrop battlements, a pink cone roof */
function tower(g){
  const a = new Acc(), r = rngFrom(41);
  cyl(a, MAT.cookieD, .3, .32, .05, 0, 0, 0, 20);
  cyl(a, cane(6), .21, .21, .72, 0, .05, 0, 24);
  cyl(a, MAT.icing, .25, .25, .05, 0, .77, 0, 24); for (let i=0;i<8;i++){ const q = i/8*6.28; gumdrop(a, Math.cos(q)*.21, .82, Math.sin(q)*.21, .75, i); }
  a.add(new THREE.ConeGeometry(.2, .32, 20), MAT.pink, at(0, .98, 0)); ball(a, MAT.lemon, 0, 1.15, 0, .035);
  for (const [q, y] of [[FACE, .5], [FACE + 1.2, .3], [FACE - 1.1, .62]]) { a.add(new THREE.CylinderGeometry(.045, .045, .02, 14).rotateX(Math.PI/2), MAT.glow, at(Math.sin(q)*.212, y, Math.cos(q)*.212, q, 1, 1.3, 1)); }
  a.add(bx(.11, .17, .02), MAT.chocD, at(Math.sin(FACE)*.21, .135, Math.cos(FACE)*.21, FACE));
  a.into(g); glowSprite(g, V3(.15, .5, .15), .35, 0xFFB347, .4); sweetsPile(g, r, .32, .3, .8);
}
/* Macaron house: three macarons stacked, round lit windows, a door in the bottom one */
function macaron(acc, y, rr, shell, fill){
  acc.add(new THREE.SphereGeometry(rr, 24, 10, 0, 6.29, 0, Math.PI/2), shell, at(0, y + rr*.34, 0, 0, 1, .4, 1));
  acc.add(new THREE.SphereGeometry(rr, 24, 10, 0, 6.29, Math.PI/2, Math.PI/2), shell, at(0, y + rr*.18, 0, 0, 1, .32, 1));
  acc.add(new THREE.TorusGeometry(rr*.93, rr*.07, 6, 30).rotateX(Math.PI/2), shell, at(0, y + rr*.2, 0));
  cyl(acc, fill, rr*.9, rr*.9, rr*.14, 0, y + rr*.2, 0, 24); cyl(acc, shell, rr*.98, rr*.98, rr*.16, 0, y + rr*.34, 0, 24);
  return y + rr*.34 + rr*.4;
}
function macHouse(g){
  const a = new Acc(), r = rngFrom(51);
  let y = macaron(a, 0, .36, MAT.pink, MAT.cream); y = macaron(a, y - .01, .29, MAT.mint, MAT.chocL); y = macaron(a, y - .01, .21, MAT.lilac, MAT.pinkL);
  cherry(a, 0, y - .02, 0, 1.1);
  a.add(bx(.11, .12, .02), MAT.chocD, at(Math.sin(FACE)*.36, .08, Math.cos(FACE)*.36, FACE));
  a.add(new THREE.CylinderGeometry(.036, .036, .02, 14).rotateX(Math.PI/2), MAT.glow, at(Math.sin(FACE + .9)*.3, .28, Math.cos(FACE + .9)*.3, FACE + .9));
  a.add(new THREE.CylinderGeometry(.03, .03, .02, 14).rotateX(Math.PI/2), MAT.glow, at(Math.sin(FACE - .5)*.24, .5, Math.cos(FACE - .5)*.24, FACE - .5));
  a.into(g); glowSprite(g, V3(.2, .2, .2), .3, 0xFFB347, .4); sweetsPile(g, r, -.32, .3, .7);
}
/* Sundae hut: a waffle bowl house under three scoops, sauce and a cherry */
function sundae(g){
  const a = new Acc(), r = rngFrom(61);
  cyl(a, MAT.wafer, .28, .36, .3, 0, 0, 0, 20); cyl(a, MAT.waferD, .37, .37, .04, 0, .3, 0, 20);
  ball(a, MAT.pinkI, -.12, .42, -.06, .17); ball(a, MAT.cream, .13, .42, -.04, .17); ball(a, MAT.chocL, 0, .44, .12, .16); ball(a, MAT.mintI, 0, .6, 0, .15);
  dripRing(a, MAT.choc, .12, .7, 7, r, .02); cherry(a, 0, .72, 0, 1.3);
  sprinkles(a, r, 0, 0, .2, .64, 10);
  a.add(bx(.12, .16, .02), MAT.chocD, at(Math.sin(FACE)*.33, .08, Math.cos(FACE)*.33, FACE));
  a.add(new THREE.CylinderGeometry(.035, .035, .02, 14).rotateX(Math.PI/2), MAT.glow, at(Math.sin(FACE + 1)*.33, .18, Math.cos(FACE + 1)*.33, FACE + 1));
  a.into(g); glowSprite(g, V3(.2, .15, .2), .3, 0xFFB347, .4); sweetsPile(g, r, .33, -.28, .7);
}
/* Wafer cabin: wafer walls, a chocolate-bar roof, a rolled-wafer chimney */
function cabin(g){
  const a = new Acc(), r = rngFrom(71);
  slab(a, MAT.cookieD, .62, .04, .52);
  slab(a, MAT.wafer, .46, .3, .38, 0, .04); slab(a, MAT.icing, .48, .03, .4, 0, .04);
  for (const s of [-1, 1]) { const m = at(0, .44, s*.11, 0, 1, 1, 1, s*.62).clone(); a.add(bx(.56, .035, .3), MAT.choc, m);
    for (let i=0;i<4;i++) for (let j=0;j<2;j++) a.add(bx(.11, .02, .1), MAT.chocL, m.clone().multiply(new THREE.Matrix4().makeTranslation(-.195 + i*.13, .025, -.06 + j*.12))); }
  a.add(bx(.04, .06, .44), MAT.icing, at(0, .55, 0));
  cyl(a, cane(4, '#8E5634', '#E9B872'), .04, .04, .2, .14, .45, -.1, 10);
  slab(a, MAT.chocD, .12, .18, .02, -.08, .04, .19); ball(a, MAT.lemon, -.04, .13, .205, .01);
  a.add(bx(.1, .08, .02), MAT.glow, at(.12, .2, .195)); a.add(bx(.02, .08, .1), MAT.glow, at(.235, .2, 0));
  a.add(bx(.12, .015, .025), MAT.icing, at(.12, .155, .205));
  a.into(g); glowSprite(g, V3(.13, .2, .24), .3, 0xFFB347, .45); sweetsPile(g, r, -.3, .3, .7);
}
/* Sweet stall: a counter under a striped awning, jars of sweets, a lollipop sign */
function stall(g){
  const a = new Acc(), r = rngFrom(81);
  slab(a, MAT.mintL, .5, .2, .24, 0, 0, .06); slab(a, MAT.white, .54, .025, .28, 0, .2, .06);
  for (const [x, z] of [[-.25,-.08],[.25,-.08],[-.25,.2],[.25,.2]]) cyl(a, cane(5), .016, .016, .55, x, 0, z, 8);
  for (let i=0;i<6;i++) slab(a, i%2 ? MAT.white : MAT.pink, .1, .025, .38, -.25 + i*.1 + .05, .58 + .02*Math.sin(i), .05);
  for (let i=0;i<6;i++) a.add(new THREE.CylinderGeometry(.045, .045, .02, 10, 1, false, 0, Math.PI).rotateX(Math.PI/2), i%2 ? MAT.white : MAT.pink, at(-.25 + i*.1, .56, .26, 0, 1, 1, 1, 0, Math.PI));
  [[-.16, 0], [-.04, 2], [.08, 4], [.19, 1]].forEach(([x, k], i) => { const z = .1 + (i%2)*.06;
    cyl(a, MAT.glass, .045, .045, .12, x, .225, z, 12); for (let j=0;j<6;j++) ball(a, MAT.gum[(k + j) % 6], x + (r()-.5)*.04, .24 + j*.014, z + (r()-.5)*.04, .016);
    cyl(a, MAT.pinkL, .048, .048, .015, x, .345, z, 12); });
  lolly(a, SWIRL.rainbow, .31, 0, .34, .09, .22);
  peppermint(a, -.3, 0, .34, .05); a.into(g);
}

/* ── water (Breathe): chocolate & soda ── */
function fountain(g){
  const a = new Acc(), r = rngFrom(91);
  cyl(a, MAT.cookieD, .38, .4, .07, 0, 0, 0, 24); cyl(a, MAT.chocW, .34, .34, .01, 0, .07, 0, 24);
  cyl(a, MAT.white, .05, .06, .38, 0, .07, 0, 12);
  for (const [y, rr] of [[.22, .24], [.36, .16], [.47, .09]]) { cyl(a, MAT.white, rr*.6, rr, .04, 0, y, 0, 20); cyl(a, MAT.chocW, rr*.95, rr*.95, .01, 0, y + .04, 0, 20);
    a.add(new THREE.CylinderGeometry(rr*1.01, rr*1.01, .1, 20, 1, true), MAT.chocW, at(0, y - .03, 0)); }
  ball(a, MAT.chocW, 0, .56, 0, .05);
  for (let i=0;i<5;i++){ const q = i/5*6.28 + .3; seg(a, MAT.stick, V3(Math.cos(q)*.3, .05, Math.sin(q)*.3), V3(Math.cos(q)*.2, 1, Math.sin(q)*.2).normalize(), .22, .006, .006, 4);
    ball(a, MAT.red, Math.cos(q)*.3 + Math.cos(q)*.045, .28, Math.sin(q)*.3 + Math.sin(q)*.045, .03, 1, 1.2, 1); }
  marsh(a, .12, .07, .15); marsh(a, -.15, .07, .05, .9, MAT.pinkL);
  a.into(g);
}
function sodaSpring(g){
  const a = new Acc(), r = rngFrom(95);
  cyl(a, MAT.lilac, .34, .36, .1, 0, 0, 0, 24); dripRing(a, MAT.icing, .35, .1, 12, r, .02); cyl(a, MAT.soda, .3, .3, .01, 0, .1, 0, 24);
  // the fizz column: stacked soda bulbs narrowing upward, bubbles round it
  for (let i=0;i<6;i++){ const t = i/6; ball(a, MAT.soda, 0, .15 + i*.1, 0, .1*(1 - t*.55)); }
  for (let i=0;i<16;i++){ const q = r()*6.28, d = .05 + r()*.22; ball(a, MAT.bubble, Math.cos(q)*d, .14 + r()*.6, Math.sin(q)*d, .012 + r()*.02); }
  cherry(a, 0, .72, 0, 1.2);
  // a striped straw leaning in
  seg(a, cane(6, '#FF7FAF'), V3(.22, .1, -.1), V3(-.25, 1, .1).normalize(), .5, .018, .018, 10);
  a.into(g); glowSprite(g, V3(0, .45, 0), .6, 0xFF8FC0, .25);
}
function falls(g){
  const a = new Acc(), r = rngFrom(97);
  cyl(a, MAT.cookieD, .4, .42, .05, 0, 0, 0, 22); cyl(a, MAT.chocW, .36, .36, .01, .05, .05, .06, 22);
  for (let i=0;i<9;i++){ const q = r()*3 + 3.3, d = r()*.18; ball(a, i%3 ? MAT.chocD : MAT.choc, -.14 + Math.cos(q)*d, .1 + r()*.28, -.14 + Math.sin(q)*d, .1 + r()*.06, 1, .85, 1); }
  ball(a, MAT.chocD, -.14, .46, -.14, .1); swirl(a, MAT.icing, -.14, .52, -.14, .06, 3);
  // the falling ribbon of chocolate + a splash
  const curve = new THREE.CatmullRomCurve3([V3(-.1, .44, -.06), V3(-.02, .4, .0), V3(.04, .25, .06), V3(.06, .08, .1)]);
  a.add(new THREE.TubeGeometry(curve, 16, .035, 8), MAT.chocW); ball(a, MAT.chocW, .07, .06, .11, .06, 1.3, .35, 1.3);
  marsh(a, .2, .05, .12); marsh(a, .05, .05, .26, .9, MAT.pinkL); marsh(a, .25, .05, -.08, .8);
  a.into(g);
}
function river(g){
  const a = new Acc(), r = rngFrom(111);
  // a chocolate channel across the cell (x direction), cookie-crumb banks
  slab(a, MAT.crumb, .96, .04, .26, 0, 0, -.33); slab(a, MAT.crumb, .96, .04, .26, 0, 0, .33);
  slab(a, MAT.chocW, .98, .025, .42, 0, 0, 0);
  for (let i=0;i<8;i++){ const x = -.42 + i*.12 + (r()-.5)*.04; ball(a, MAT.cookieD, x, .04, -.21, .035, 1, .6, 1); ball(a, MAT.cookie, x + .05, .04, .21, .035, 1, .6, 1); }
  // wafer bridge with candy-cane rails
  const bz = 0; for (let i=0;i<5;i++) slab(a, MAT.wafer, .07, .025, .52, -.14 + i*.07, .06 + Math.sin(i/4*Math.PI)*.04, bz);
  for (const s of [-1, 1]) for (let i=0;i<3;i++) cyl(a, cane(2), .01, .01, .12, -.14 + i*.14, .08 + Math.sin(i/2*Math.PI)*.04, s*.25, 6);
  marsh(a, .3, .02, .05); marsh(a, -.34, .02, -.06, .8, MAT.pinkL);
  a.into(g); sweetsPile(g, r, .35, .38, .6, .04);
}

/* ── trees (Vocab): lollipops, cotton candy, gumdrop bushes ── */
function lollipopTree(g, s){
  const a = new Acc(), h = s.h || 1.2, mat = SWIRL[s.sw || 'pink'];
  cyl(a, MAT.stick, .03, .028, h*.62, 0, 0, 0, 10);
  a.add(new THREE.CylinderGeometry(.32, .32, .09, 40).rotateX(Math.PI/2), mat, at(0, h*.62 + .3, 0, FACE));
  a.add(new THREE.TorusGeometry(.32, .02, 6, 40), MAT.white, at(0, h*.62 + .3, 0, FACE));
  // a ribbon bow at the neck
  for (const sx of [-1, 1]) ball(a, MAT.pinkI, Math.cos(FACE)*sx*.05, h*.62 - .01, -Math.sin(FACE)*sx*.05, .04, 1.3, .7, .6);
  ball(a, MAT.pinkI, 0, h*.62 - .01, 0, .022);
  a.into(g); sweetsPile(g, rngFrom(s.x + 3*s.z), .26, .26, .7); const b = new Acc(); peppermint(b, -.28, 0, .2, .05); b.into(g);
}
function cottonTree(g, s){
  const a = new Acc(), r = rngFrom(s.x*5 + s.z*13 + 1), h = s.h || 1.3, cols = s.blue ? [0xA9DCFF, 0xC6E8FF, 0xD9CCFF] : [0xFFB6D5, 0xFFD0E4, 0xE6CCFF];
  cyl(a, cane(8, '#FF7FAF'), .035, .03, h*.55, 0, 0, 0, 10);
  for (let i=0;i<9;i++){ const ang = i/9*6.28 + r()*.5, d = i ? .16 + r()*.14 : 0, rr = i ? .16 + r()*.06 : .24;
    const geo = new THREE.IcosahedronGeometry(rr, 2), p = geo.attributes.position; for (let k=0;k<p.count;k++){ const f = 1 + (r()-.5)*.12; p.setXYZ(k, p.getX(k)*f, p.getY(k)*f, p.getZ(k)*f); }
    a.add(geo, swayMat(cols[i % 3], h, .014, .95), at(Math.cos(ang)*d, h*.72 + (i ? (r()-.4)*.18 : .06), Math.sin(ang)*d, r()*6, 1, .82, 1)); }
  a.into(g); sweetsPile(g, r, .27, .24, .7);
}
function gumBush(g, s){
  const a = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 2);
  for (let i=0;i<14;i++){ const ring = i < 8 ? 0 : i < 13 ? 1 : 2, q = i*2.4, d = [.26, .14, 0][ring] + r()*.04;
    gumdrop(a, Math.cos(q)*d, [0, .1, .2][ring] + r()*.02, Math.sin(q)*d, 1.5 + r()*.4 - ring*.1, Math.floor(r()*6)); }
  sprinkles(a, r, 0, 0, .3, .02, 12);
  a.into(g);
}

/* ── growing pieces (Sudoku / Math): cupcake mushrooms sprout, cap, get frosted, then sprinkles + cherries ── */
const CUP = [[-.2, -.18, 1], [.18, -.2, .85], [-.02, .08, 1.15], [.24, .2, .8], [-.25, .22, .75]];
function fillCupcakes(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 3), Y = .07, mint = s.kind === 'cupM';
  const paper = mint ? [MAT.paperM, MAT.paperY] : [MAT.paperP, MAT.paperL], frost = mint ? [MAT.mintI, MAT.chocL] : [MAT.pinkI, MAT.icing];
  const k = [0, .42, .72, 1.0, 1.2, 1.3][stage];
  CUP.forEach(([x, z, sc], i) => {
    const s0 = sc*k;
    if (stage <= 1) { ball(a, MAT.cream, x, Y, z, .045*sc, 1, .8, 1); ball(a, frost[i%2], x, Y + .03*sc, z, .03*sc); return; }
    // stem = fluted paper wrapper, cap = cake dome + frosting swirl
    a.add(new THREE.CylinderGeometry(.075*s0, .058*s0, .1*s0, 12), paper[i%2], at(x, Y + .05*s0, z));
    ball(a, MAT.sponge, x, Y + .1*s0, z, .08*s0, 1, .55, 1);
    if (stage >= 3) swirl(a, frost[i%2], x, Y + .125*s0, z, .07*s0, stage >= 4 ? 3 : 2);
    if (stage >= 5) { cherry(a, x, Y + .25*s0, z, s0); sprinkles(a, r, x, z, .05*s0, Y + .15*s0, 4); }
  });
  sprinkles(a, r, 0, 0, .38, Y + .004, stage*3);
  a.into(host);
  if (stage >= 5) glowSprite(host, V3(0, Y + .2, 0), .75, 0xFFB0D0, .35);
  host.userData.stage = stage;
}

/* ── To-dos: cookie stones, jellybean patch, gumball lamp, gumdrop border, chocolate bench, wafer steps; candy-cane fence ── */
function path(g, s){
  const sl = new THREE.Mesh(G.path, MAT.crumb); sl.position.y = .0175; sl.receiveShadow = true; sl.userData.ghostHide = true; g.add(sl);
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0, Y = .035; g.userData.ghostMode = 'marker';
  const cookie = (x, z, rr) => { cyl(a, MAT.cookie, rr, rr*.96, .03, x, Y, z, 20); for (let i=0;i<5;i++){ const q = r()*6.28, d = r()*rr*.7; ball(a, MAT.chip, x + Math.cos(q)*d, Y + .03, z + Math.sin(q)*d, .016, 1, .6, 1); } };
  if (v === 0) { cookie(-.2, -.2, .15); cookie(.17, -.12, .13); cookie(-.1, .19, .13); cookie(.24, .25, .11); a.into(g); return; }
  if (v === 1) { for (let i=0;i<22;i++){ const x = (r()-.5)*.72, z = (r()-.5)*.72; a.add(new THREE.CapsuleGeometry(.018, .025, 3, 8), MAT.gum[i % 6], at(x, Y + .02, z, r()*6, 1, 1, 1, Math.PI/2)); }
    a.into(g); return; }
  if (v === 2) { cyl(a, MAT.chocD, .08, .08, .04, 0, Y); cyl(a, cane(6), .016, .016, .36, 0, Y + .04, 0, 8);
    ball(a, MAT.glowP, 0, Y + .47, 0, .075); cyl(a, MAT.pink, .06, .05, .03, 0, Y + .39, 0, 14); ball(a, MAT.pink, 0, Y + .55, 0, .025);
    a.into(g); glowSprite(g, V3(0, Y + .47, 0), .45, 0xFF8FC0, .6); sweetsPile(g, r, -.24, .24, .6, Y); return; }
  if (v === 3) { for (let i=0;i<9;i++){ const u = -.36 + i*.09; gumdrop(a, u, Y, -.3, 1.2, i); gumdrop(a, -.3, Y, u + .05, 1.2, i + 3); } cookie(.15, .15, .13); a.into(g); return; }
  if (v === 4) { // a bench made of chocolate-bar squares
    const m = new THREE.Matrix4().makeRotationY(FACE);
    const put = (w, h, d, x, y, z, mat) => a.add(bx(w, h, d), mat, m.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z)));
    for (let i=0;i<4;i++) put(.11, .035, .14, -.165 + i*.11, Y + .17, 0, i%2 ? MAT.choc : MAT.chocL);
    for (let i=0;i<4;i++) put(.11, .1, .03, -.165 + i*.11, Y + .24, -.06, i%2 ? MAT.chocL : MAT.choc);
    for (const x of [-.18, .18]) put(.04, .15, .12, x, Y + .075, 0, MAT.chocD);
    a.into(g); const b = new Acc(); peppermint(b, .25, Y, .28, .05); b.into(g); return; }
  for (let i=0;i<3;i++) { cyl(a, i%2 ? MAT.wafer : MAT.waferD, .3 - i*.07, .3 - i*.07, .05, 0, Y + i*.05, 0, 4, Math.PI/4); }
  swirl(a, MAT.pinkI, 0, Y + .16, 0, .05, 2); a.into(g);
}
function fence(g, s){
  const a = new Acc(), L = s.len, r = rngFrom(s.x*3 + s.z*5 + 1);
  const run = u => s.edge === 'w' ? [ -.45, u, Math.PI/2 ] : [ u, .45, 0 ];
  for (let i=0;i<=L*3;i++){ const [x, z, ry] = run(i/3 - L/2); candyCane(a, x, 0, z, .3, .02, ry + (i%2 ? 0 : Math.PI)); }
  for (let i=0;i<L;i++){ const [x, z, ry] = run(i - (L-1)/2); a.add(bx(.98, .03, .012), MAT.pinkI, at(x, .2, z, ry)); a.add(bx(.98, .03, .012), MAT.mintI, at(x, .11, z, ry)); }
  for (let i=0;i<L*4;i++){ const [x, z] = run((i + .5)/4 - L/2 + (r()-.5)*.08); gumdrop(a, x + (s.edge === 'w' ? .06 : 0), 0, z + (s.edge === 'w' ? 0 : -.06), .9, i); }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}

/* ── the hero (Gita): the candy castle — a frosted keep, four striped towers with swirl roofs, a gate facing the camera ── */
const CASTLE_TOP = 1.55;
function castle(g){
  const a = new Acc(), r = rngFrom(5);
  cyl(a, MAT.cookieD, .94, .96, .06, 0, 0, 0, 40); cyl(a, MAT.cookie, .9, .9, .03, 0, .06, 0, 40);
  sprinkles(a, r, 0, 0, .88, .095, 40);
  const Y = .09;
  // keep: a pink frosted block with drips and gumdrop battlements
  slab(a, MAT.spongeP, .9, .52, .9, 0, Y); slab(a, MAT.icing, .96, .05, .96, 0, Y + .5);
  for (let i=0;i<20;i++){ const side = i % 4, u = -.4 + Math.floor(i/4)*.2, x = side === 0 ? u : side === 1 ? u : side === 2 ? .48 : -.48, z = side === 0 ? .48 : side === 1 ? -.48 : u;
    const L = .04 + r()*.1; a.add(new THREE.CapsuleGeometry(.024, L, 3, 8), MAT.icing, at(x, Y + .5 - L/2, z)); }
  for (let i=0;i<5;i++) for (const [sx, sz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const u = -.36 + i*.18; gumdrop(a, sx ? sx*.44 : u, Y + .55, sz ? sz*.44 : u, 1.1, i + sx + 2*sz + 4); }
  // gate on the front (+z) face, window on +x
  a.add(bx(.26, .3, .04), MAT.chocD, at(.0, Y + .15, .455)); a.add(new THREE.CylinderGeometry(.13, .13, .04, 20, 1, false, -Math.PI/2, Math.PI).rotateX(Math.PI/2), MAT.chocD, at(0, Y + .3, .455));
  a.add(new THREE.TorusGeometry(.15, .025, 6, 20, Math.PI), MAT.pinkI, at(0, Y + .3, .47)); for (const s of [-1, 1]) cyl(a, MAT.pinkI, .025, .025, .3, s*.15, Y, .47, 8);
  a.add(bx(.03, .3, .02), MAT.choc, at(0, Y + .15, .478));
  for (const [x, y] of [[-.28, .3], [.28, .3]]) { a.add(new THREE.CylinderGeometry(.05, .05, .02, 16).rotateX(Math.PI/2), MAT.glow, at(x, Y + y, .455, 0, 1, 1.3, 1)); }
  for (const [z, y] of [[-.2, .28], [.2, .28]]) { a.add(new THREE.CylinderGeometry(.05, .05, .02, 16).rotateX(Math.PI/2).rotateY(Math.PI/2), MAT.glow, at(.455, Y + y, z, 0, 1, 1.3, 1)); }
  // centre tower on the keep: mint, a big soft-serve roof and a cherry
  cyl(a, MAT.mint, .24, .24, .42, 0, Y + .55, 0, 28); dripRing(a, MAT.icing, .245, Y + .96, 12, r, .025);
  for (let i=0;i<4;i++){ const q = FACE + (i - 1.5)*.7; a.add(new THREE.CylinderGeometry(.04, .04, .02, 14).rotateX(Math.PI/2), MAT.glow, at(Math.sin(q)*.242, Y + .76, Math.cos(q)*.242, q, 1, 1.35, 1)); }
  swirl(a, MAT.pinkI, 0, Y + 1.0, 0, .2, 5); cherry(a, 0, Y + 1.43, 0, 1.6);
  // four corner towers: striped, a cone roof in a different sweet, a lollipop on top
  const TW = [[.5, .5, MAT.lemon, SWIRL.pink, .78], [-.5, .5, MAT.lilac, SWIRL.mint, .9], [.5, -.5, MAT.pink, SWIRL.lilac, .92], [-.5, -.5, MAT.mint, SWIRL.rainbow, 1.05]];
  TW.forEach(([x, z, roof, pop, h], i) => {
    cyl(a, cane(Math.round(h*8), ['#FF5C93', '#9C6BFF', '#35C996', '#FF8A3D'][i]), .16, .16, h, x, Y - .03, z, 22);
    cyl(a, MAT.icing, .19, .19, .04, x, Y + h - .04, z, 22);
    a.add(new THREE.ConeGeometry(.2, .3, 22), roof, at(x, Y + h + .15, z)); ball(a, MAT.white, x, Y + h + .31, z, .03);
    lolly(a, pop, x, Y + h + .32, z, .07, .08);
    const q = Math.atan2(x, z); a.add(new THREE.CylinderGeometry(.035, .035, .02, 14).rotateX(Math.PI/2), MAT.glow, at(x + Math.sin(q)*.16, Y + h*.6, z + Math.cos(q)*.16, q, 1, 1.3, 1));
  });
  // path of cookies to the gate + candy-cane lamps
  for (let i=0;i<2;i++) cyl(a, MAT.cookie, .09, .09, .02, 0, .095, .6 + i*.17, 18);
  for (const s of [-1, 1]) { candyCane(a, s*.24, .09, .68, .3, .018, s > 0 ? Math.PI : 0); ball(a, MAT.glowP, s*.24 + (s > 0 ? -.07 : .07), .33, .68, .03); }
  a.into(g);
  glowSprite(g, V3(0, Y + .2, .55), .6, 0xFFB347, .5); glowSprite(g, V3(0, 1, 0), 2.3, 0xFFD6EA, .14);
  const f = rngFrom(7); sweetsPile(g, f, .8, .78, 1.1); sweetsPile(g, f, -.82, .8, 1); const b = new Acc(); peppermint(b, .82, .06, -.3, .07); peppermint(b, -.8, .06, -.2, .06); b.into(g);
}

/* ── blueprint: the farm's cells with candy pieces; the castle takes the left corner ── */
const MAP = {
  bigbarn:{ name:'Layer-cake house', b:'hall' }, well:{ name:'Chocolate fountain', b:'fountain' }, apple1:{ name:'Lollipop tree', b:'lolly', sw:'pink', h:1.15 },
  silo:{ name:'Candy-cane tower', b:'tower' }, silohouse:{ name:'Macaron house', b:'mac' }, coop:{ name:'Sundae hut', b:'sundae' },
  watertower:{ name:'Fizzy spring', b:'soda' }, pump:{ name:'Chocolate falls', b:'falls' }, apple2:{ name:'Cotton-candy tree', b:'cotton', h:1.3 },
  berry1:{ name:'Gumdrop bush', b:'gum' }, peepal:{ name:'Candy castle', b:'hero' },
  smallbarn:{ name:'Wafer cabin', b:'cabin' }, openbarn:{ name:'Sweet stall', b:'stall' },
  pond:{ name:'Chocolate river', b:'river' }, orange1:{ name:'Rainbow lollipop', b:'lolly', sw:'rainbow', h:1.3 },
  apple3:{ name:'Cotton-candy tree', b:'cotton', blue:true, h:1.35 }, berry2:{ name:'Gumdrop bush', b:'gum' },
  orange2:{ name:'Mint lollipop', b:'lolly', sw:'mint', h:1.25 }, apple4:{ name:'Cotton-candy tree', b:'cotton', h:1.25 }
};
const MOVE = { peepal:{ x:0, z:5 }, field1_5:{ x:1, z:1 }, fence3:{ x:0, z:0, edge:'w' } };   // hero to the left corner
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:5, path2_6:4, path3_6:0 };
const PATH_NAME = ['Cookie stones', 'Jellybean patch', 'Gumball lamp', 'Gumdrop border', 'Chocolate bench', 'Wafer steps'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d, ...(MOVE[f.id] || {}) };
  if (f.kind === 'field') { const pink = f.crop === 'Corn' || f.crop === 'Beet';
    return pink ? { ...s, kind:'cupP', name:'Cupcake mushrooms', stages:5 } : { ...s, kind:'cupM', name:'Mint cupcake caps', stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'candy', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'candy', b:'fence', edge:s.edge || f.edge, len:f.len, name:'Candy-cane fence' };
  return { ...s, kind:'candy', ...MAP[f.id] };
});
const BUILD = { hall, tower, mac:macHouse, sundae, cabin, stall, fountain, soda:sodaSpring, falls, river,
  lolly:lollipopTree, cotton:cottonTree, gum:gumBush, path, fence, hero:castle };

/* decor: candy instead of grass — gumdrops, peppermints, tiny lollipops, marshmallows, sprinkles */
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
    if (!sl || sl === 'later') {
      for (let i=0;i<4;i++){ const [px, pz] = spot(); gumdrop(a, px, Y, pz, 1 + r()*.5, Math.floor(r()*6)); }
      { const [px, pz] = spot(); peppermint(a, px, Y, pz, .05 + r()*.02); }
      if (r() < .7) { const [px, pz] = spot(.3); lolly(a, [SWIRL.pink, SWIRL.mint, SWIRL.lilac, SWIRL.rainbow][Math.floor(r()*4)], px, Y, pz, .07, .14 + r()*.08); }
      if (r() < .6) { const [px, pz] = spot(); marsh(a, px, Y, pz, 1, r() < .5 ? MAT.white : MAT.pinkL); }
      sprinkles(a, r, p.x, p.z, .42, Y + .006, 10);
      grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { const [px, pz] = [p.x + .32, p.z + .32]; gumdrop(a, px, Y, pz, 1, Math.floor(r()*6)); gumdrop(a, p.x - .3, Y, p.z + .3, .9, Math.floor(r()*6)); gumdrop(a, p.x + .3, Y, p.z - .28, .8, Math.floor(r()*6));
      if (r() < .5) lolly(a, [SWIRL.pink, SWIRL.mint, SWIRL.lilac][Math.floor(r()*3)], p.x - .32, Y, p.z - .3, .05, .1); sprinkles(a, r, p.x, p.z, .4, Y + .006, 6);
      V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if ((Math.abs(x-3) === V.ring && x > 3) || (Math.abs(z-3) === V.ring && z > 3)) { gumdrop(a, p.x + .38, Y, p.z + .38, .9, Math.floor(r()*6)); grp.userData.decor = 'rim'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ── live bees + gummy bears ── */
function makeBee(){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.03, 10, 8), MAT.beeY, at(0, 0, 0, 0, .9, .9, 1.25));
  for (const [z, rr] of [[-.006, .026], [-.022, .02]]) a.add(new THREE.TorusGeometry(rr, .006, 4, 12), MAT.beeK, at(0, 0, z));
  a.add(new THREE.SphereGeometry(.019, 8, 6), MAT.beeK, at(0, .004, .038)); for (const sx of [-1, 1]) ball(a, MAT.white, sx*.009, .012, .052, .005);
  a.into(g);
  const wg = new THREE.SphereGeometry(.024, 8, 5).scale(.7, .15, 1).translate(.018, 0, -.004), w1 = new THREE.Mesh(wg, MAT.wing), w2 = new THREE.Mesh(wg, MAT.wing);
  w2.scale.x = -1; w1.position.y = w2.position.y = .026; g.add(w1, w2); g.userData.w1 = w1; g.userData.w2 = w2; return g;
}
const flap = (b, t) => { const f = .35 + Math.sin(t*48 + b.id)*.6; b.userData.w1.rotation.z = f; b.userData.w2.rotation.z = -f; };
const GUMMY = [0xFF3B5C, 0xFF9A2E, 0xFFD23C, 0x3FCF7F, 0xF7F0FF].map(c => CM(c, { roughness:.18, emissive:c, emissiveIntensity:.22 }));
function makeGummy(k=0){
  const g = new THREE.Group(), a = new Acc(), m = GUMMY[k % GUMMY.length];
  ball(a, m, 0, .1, 0, .075, 1, 1.12, .85);
  ball(a, m, 0, .215, 0, .064);
  for (const sx of [-1, 1]) { ball(a, m, sx*.044, .268, -.004, .024, 1, 1, .7); ball(a, m, sx*.072, .14, .025, .028, .9, 1.3, .9); ball(a, m, sx*.042, .032, .03, .032, 1, .9, 1.25);
    ball(a, MAT.eye, sx*.022, .228, .057, .0075); }
  ball(a, m, 0, .2, .055, .026, 1.2, .8, .8); ball(a, MAT.eye, 0, .208, .078, .008);
  a.into(g); return g;
}
function addAmbient(){ addButterflies(); moveAmbient(2.1); }
function moveAmbient(t){ if (!V) return; flyButterflies(t); (V.butterflies || []).forEach(b => b.visible = !S.night); }

const RES_SCALE = 1.7;
const GUMMY_AT = [[3, 4.35, .9], [3.35, 5.25, .5], [2.65, 5.55, .8], [3.2, 6.1, .6], [2.3, 6.15, .9]];
const BEE_SPOTS = () => { const c = cellPos(0.5, 5.5), h = cellPos(2.5, 2.5), t = cellPos(4, 3);
  return [V3(c.x + .3, TILE_TOP + 1.3, c.z + .2), V3(h.x + .2, TILE_TOP + 1.2, h.z + .1), V3(t.x, TILE_TOP + 1.4, t.z + .15)]; };
function moveResidents(t){
  (V && V.res || []).forEach((r, j) => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'bee') { const q = t*1.4 + j; r.obj.position.set(u.p.x + Math.cos(q)*.22, u.p.y + (1 - e)*2 + Math.sin(q*2.3)*.05, u.p.z + Math.sin(q)*.18); r.obj.rotation.y = -q; flap(r.obj, t); return; }
    const walking = r.arrive < 1, p = u.from.clone().lerp(u.at, walking ? 1 - Math.pow(1 - r.arrive, 2.2) : 1);
    const hop = walking ? Math.abs(Math.sin(t*7 + j))*.08 : Math.max(0, Math.sin(t*2.2 + j*1.3))*.025;
    r.obj.position.set(p.x, TILE_TOP + hop, p.z);
    r.obj.rotation.y = walking ? Math.atan2(u.at.x - u.from.x, u.at.z - u.from.z) : u.face;
    r.obj.scale.y = r.obj.scale.x*(1 - (walking ? 0 : Math.max(0, -Math.sin(t*2.2 + j*1.3))*.05));
  });
}
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.3 - j*.07))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(rs[0].obj.position.y + .3), 10, 0xFFB0D0, .6); res(); })); }
const MAKE = { gummy:() => makeGummy(0), bee:() => makeBee() };
async function candyMoveIn(walk){
  V.residentsIn = true; V.res = [];
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const gate = cellPos(3, 7.4);
  const groups = [
    async () => { const rs = GUMMY_AT.map(([x, z, f], i) => { const o = makeGummy(i); o.scale.setScalar(RES_SCALE); return addRes('gummy', o, { at:cellPos(x, z), from:gate.clone().add(V3((i - 2)*.2, 0, i*.15)), face:f }); });
      moveResidents(0); if (walk) await arrive(rs, 2600); },
    async () => { const rs = BEE_SPOTS().map(p => { const o = makeBee(); o.scale.setScalar(2.4); return addRes('bee', o, { p }); }); moveResidents(0); if (walk) await arrive(rs, 1600); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length;
}

export default {
  id:'candy', name:'Candy land', title:'Your candy land',
  season:26, dates:'28 Sep–11 Oct', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'chocolate fountains & fizzy springs', tag:'Water' },
    building:{ label:'cake houses, towers & sweet stalls',   tag:'House' },
    path:    { label:'cookie stones & candy-cane fences',    tag:'Path' },
    crop:    { label:'cupcake mushrooms',                    tag:'Cupcake' },
    tree:    { label:'lollipops & cotton-candy trees',       tag:'Tree' },
    special: { label:'the candy castle',                     tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:TILE, tileMap },
  ghost:{ color:'#FFFFFF', opacity:.44, emissive:.24, dash:'#FFFFFF', dashOpacity:.8 },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><rect x="11" y="12" width="2" height="10" rx="1" fill="#E9D8C4"/><circle cx="12" cy="9" r="7" fill="#FF7FAF"/><path d="M12 9m-4.5 0a4.5 4.5 0 1 0 9 0a3 3 0 1 0-6 0a1.6 1.6 0 1 0 3.2 0" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M20 118h88v-8H20z"/><path d="M34 110V62h60v48z"/><path d="M26 110V54h16v56zM86 110V54h16v56z"/><path d="M24 54l10-18 10 18zM84 54l10-18 10 18z"/><path d="M52 62V40h24v22z"/><path d="M50 40c0-12 6-18 14-22 8 4 14 10 14 22z"/><circle cx="64" cy="14" r="5"/><path d="M58 110v-20a6 6 0 0 1 12 0v20z" fill-opacity=".35"/></g>',
  album:{ image:'assets/candy/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#FFE3EE)' },
  css:'.phone[data-theme="candy"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#FFF0F6 58%,#FFD6E6 100%)}',
  env: buildEnv,

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'cupP' || s.kind === 'cupM') {
      const base = new THREE.Mesh(G.field, MAT.brownie); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      const host = new THREE.Group(); host.scale.setScalar(1.12); g.add(host); g.userData.plants = host;
      g.userData.regrow = st => fillCupcakes(host, s, st); fillCupcakes(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'candy' ? 1 : 1.12,
  contact: s => s.kind === 'candy' && !['path', 'fence', 'hero', 'river'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && s.v === 2),
  decor,
  ambient: addAmbient,
  tick(t){ moveAmbient(t); moveResidents(t); },

  residents:[ { id:'gummy', name:'Gummy bears', n:5 }, { id:'bee', name:'Bees', n:3 } ],
  moveIn: candyMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('candy:'+d.id, () => { const o = MAKE[d.id](); if (d.id === 'bee') o.scale.setScalar(4); o.rotation.y = .7; return o; }, 168); },
  residentRig(d){ const obj = MAKE[d.id](); obj.scale.setScalar(d.id === 'bee' ? 2.4 : RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
