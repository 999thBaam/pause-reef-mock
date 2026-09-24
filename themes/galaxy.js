/* GALAXY AQUARIUM (?theme=galaxy) — the land sits inside a glass cube filled with deep space: a violet-to-teal volume with
   magenta and teal nebula clouds drifting through it (a noise shader on the glass + soft wisps inside), stars on the far walls
   and motes twinkling in the water. Pieces don't stand on stands (that's the solar orrery) — they FLOAT inside the glass at
   different heights, each casting a soft glow onto the dark-glass floor: tiny glowing worlds with a lighthouse, a cottage,
   crystals or a glass dome (Reading), soft nebula puffs (Breathe), star clusters that gather a few more stars with every later
   piece (Sudoku/Math), tall nebula pillars rising from the floor (Vocab), stardust trails and crystal ridges (To-dos), and a
   luminous spiral galaxy core hovering over a crystal dais in the right-hand corner (Gita). Residents: comets and space whales.
   Same ring blueprint, camera and light rig as the farm (hero-right, every farm slot id maps to a galaxy piece, so order, rings,
   pick-3, growth and expansion work unchanged). Everything is procedural three.js + canvas textures, merged per material. */
import * as THREE from 'three';
import { rngFrom, TEX, world, CAM_DIR } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { G, Acc, seg, blob, _up, _q, _m, _s } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { FARM_SLOTS as FARM, FARM_ORDER } from './farm.js';

const PM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.8, metalness:0, flatShading:true, ...o });
const SM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.6, metalness:0, ...o });
const EM = (hex, em, ei, o = {}) => PM(hex, { emissive:em, emissiveIntensity:ei, ...o });
const MAT = {
  glass:SM(0x8C74C8, { roughness:.25, metalness:.1, emissive:0x3A2470, emissiveIntensity:.35 }), glassD:SM(0x5A4494, { roughness:.3, metalness:.1, emissive:0x241450, emissiveIntensity:.3 }),
  rock:PM(0x5E4E86), rockD:PM(0x44376A), rockL:PM(0x8A7CB4),
  white:SM(0xF6F1FA), whiteD:SM(0xD8D0E6), red:SM(0xEE6A7E), wood:PM(0x8E6247), roof:PM(0xF07AA0), roofB:PM(0x6FB7E8),
  win:new THREE.MeshStandardMaterial({ color:0xFFE6A8, emissive:0xFFB54A, emissiveIntensity:1, roughness:.4 }),
  gold:new THREE.MeshStandardMaterial({ color:0xFFE08A, emissive:0xFFB02A, emissiveIntensity:.95, roughness:.4 }),
  starW:new THREE.MeshStandardMaterial({ color:0xFFFFFF, emissive:0xFFF4E0, emissiveIntensity:1.2, roughness:.5 }),
  dome:new THREE.MeshStandardMaterial({ color:0xCFF6FF, emissive:0x4AB8D8, emissiveIntensity:.35, roughness:.1, transparent:true, opacity:.45, depthWrite:false }),
  leafP:PM(0xF59BC8, { emissive:0x8A2E6A, emissiveIntensity:.25 }), leafM:PM(0x7FE0C2, { emissive:0x1E7A6A, emissiveIntensity:.25 }),
  crV:EM(0xC6A4FF, 0x6A3ED0, .6, { roughness:.3 }), crT:EM(0x8FF0EC, 0x1A9AA0, .6, { roughness:.3 }), crP:EM(0xFFA6DA, 0xC03C8E, .55, { roughness:.3 }),
  pool:new THREE.MeshStandardMaterial({ color:0x9FF4F0, emissive:0x2FC4C8, emissiveIntensity:.9, roughness:.15 }),
  core:new THREE.MeshStandardMaterial({ color:0xFFF6E4, emissive:0xFFE2B0, emissiveIntensity:1.4, roughness:.5 })
};
/* palettes: body / emissive / tip — rose, teal, violet, gold, coral */
const PAL = {
  rose:  [0xF27AB8, 0xB0306E, 0xFFD3EA], teal:[0x5ED8D0, 0x16807E, 0xCFFFF8], violet:[0xA07CF0, 0x5530B8, 0xE8DCFF],
  gold:  [0xF6C35A, 0xB06A10, 0xFFF0C0], coral:[0xFF9478, 0xC0402E, 0xFFD8C8]
};
const PMATS = {};
const pm = (pal, k) => { const key = pal+k; if (PMATS[key]) return PMATS[key]; const p = PAL[pal];
  return PMATS[key] = k === 'tip' ? EM(p[2], p[1], .7) : k === 'dark' ? EM(new THREE.Color(p[0]).multiplyScalar(.45).getHex(), p[1], .25) : EM(p[0], p[1], .38); };
const GLOWC = { rose:0xFF8AD0, teal:0x7FF2EA, violet:0xB89CFF, gold:0xFFD27A, coral:0xFFA890 };

/* ── canvas textures ── */
function canvasTex(w, h, draw, repeat){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) t.wrapS = THREE.RepeatWrapping; return t; }
function bands(g, W, H, cols, seed, wob=2){ const r = rngFrom(seed); let y = 0;
  while (y < H) { const h = 5 + r()*14, col = cols[Math.floor(r()*cols.length)], ph = r()*6;
    g.fillStyle = col; g.beginPath(); g.moveTo(0, y); for (let x=0;x<=W;x+=8) g.lineTo(x, y + Math.sin(x*.05 + ph)*wob);
    g.lineTo(W, y + h + 2); for (let x=W;x>=0;x-=8) g.lineTo(x, y + h + 2 + Math.sin(x*.05 + ph + 1)*wob); g.fill(); y += h; } }
function blobs(g, W, H, n, col, seed, rmin=8, rmax=22){ const r = rngFrom(seed); g.fillStyle = col;
  for (let i=0;i<n;i++){ const x = r()*W, y = H*.2 + r()*H*.6, k = 3 + Math.floor(r()*4);
    for (let j=0;j<k;j++){ const rr = rmin + r()*(rmax - rmin); g.beginPath(); g.ellipse(x + (r()-.5)*rr*1.6, y + (r()-.5)*rr, rr, rr*.7, r(), 0, 6.3); g.fill(); } } }
function craters(g, W, H, n, dark, light, seed){ const r = rngFrom(seed);
  for (let i=0;i<n;i++){ const x = r()*W, y = H*.15 + r()*H*.7, rad = 3 + r()*10;
    g.fillStyle = dark; g.beginPath(); g.ellipse(x, y, rad, rad*.8, 0, 0, 6.3); g.fill();
    g.strokeStyle = light; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, rad, rad*.8, 0, .3, 2.8); g.stroke(); } }
function swirls(g, W, H, seed, col){ const r = rngFrom(seed); g.strokeStyle = col; g.lineCap = 'round';
  for (let i=0;i<14;i++){ const y = H*.12 + r()*H*.76, x = r()*W, l = 20 + r()*60; g.lineWidth = 2 + r()*4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l*.5, y - 5 + r()*10, x + l, y + (r()-.5)*6); g.stroke(); } }
const PDEF = {
  garden:(g,W,H) => { g.fillStyle = '#7C8CF0'; g.fillRect(0,0,W,H); blobs(g,W,H,7,'#8FE3B8',11,10,26); blobs(g,W,H,4,'#6CCB9E',12,6,14); swirls(g,W,H,5,'rgba(255,255,255,.6)');
                      g.fillStyle = '#F6F2FF'; g.fillRect(0,0,W,10); g.fillRect(0,H-8,W,8); },
  teal:  (g,W,H) => { g.fillStyle = '#3FC2C4'; g.fillRect(0,0,W,H); blobs(g,W,H,5,'#9EF0D0',3); swirls(g,W,H,4,'rgba(255,255,255,.55)'); g.fillStyle = '#F2FFFF'; g.fillRect(0,0,W,9); g.fillRect(0,H-9,W,9); },
  coral: (g,W,H) => bands(g,W,H,['#FF9C84','#FFB89C','#F57E7E','#FFD0B4','#F59BB8'],41,2.5),
  lilac: (g,W,H) => { g.fillStyle = '#B7A0F2'; g.fillRect(0,0,W,H); craters(g,W,H,24,'rgba(90,60,170,.33)','rgba(255,245,255,.7)',83); },
  ice:   (g,W,H) => { g.fillStyle = '#CFF1FF'; g.fillRect(0,0,W,H); const r = rngFrom(21); g.strokeStyle = 'rgba(90,150,220,.45)'; g.lineWidth = 1.4;
                      for (let i=0;i<22;i++){ const x = r()*W, y = r()*H; g.beginPath(); g.moveTo(x,y); g.lineTo(x + (r()-.5)*50, y + (r()-.5)*24); g.lineTo(x + (r()-.5)*70, y + (r()-.5)*30); g.stroke(); }
                      g.fillStyle = '#FFFFFF'; g.fillRect(0,0,W,16); g.fillRect(0,H-12,W,12); },
  gold:  (g,W,H) => bands(g,W,H,['#F8D488','#F2C06A','#FBE6B4','#E9A95A','#F6CF8E'],51,3),
  rose:  (g,W,H) => bands(g,W,H,['#F4A6D0','#E98AC2','#F9CDE4','#D98CD0','#C9A0F0'],61,2.5),
  moon:  (g,W,H) => { g.fillStyle = '#D6CCE8'; g.fillRect(0,0,W,H); craters(g,W,H,22,'rgba(110,90,150,.35)','rgba(255,255,255,.7)',84); }
};
const PMAT = {};
function pmat(key){ if (PMAT[key]) return PMAT[key]; const map = canvasTex(256, 128, PDEF[key], true);
  return PMAT[key] = new THREE.MeshStandardMaterial({ map, roughness:.75, metalness:0, emissive:0xffffff, emissiveMap:map, emissiveIntensity:.22 }); }
const RINGM = (() => { const map = canvasTex(256, 4, (g, W) => { const gr = g.createLinearGradient(0,0,W,0);
    [[0,'rgba(255,190,235,0)'],[.12,'rgba(255,190,235,.85)'],[.4,'rgba(190,160,255,.6)'],[.62,'rgba(160,250,240,.85)'],[1,'rgba(160,250,240,0)']].forEach(([o,c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0,0,W,4); });
  return new THREE.MeshStandardMaterial({ map, transparent:true, side:THREE.DoubleSide, depthWrite:false, roughness:.8, emissive:0xffffff, emissiveMap:map, emissiveIntensity:.35 }); })();
function ringGeo(r0, r1){ const geo = new THREE.RingGeometry(r0, r1, 64, 1), p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i=0;i<p.count;i++){ const d = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (d - r0)/(r1 - r0), .5); } return geo; }

/* ── building blocks ── */
const SPIN = new Set(), FLOAT = new Set();
function glowSprite(parent, pos, scale, color, opacity=.8, map=TEX.glow){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; s.userData.glow = true; parent.add(s); return s; }
/* a floating group: bobs gently in tick; a soft coloured glow on the floor below it says "suspended" */
function floater(g, y, color, spread=.9, ph=0){
  const f = new THREE.Group(); f.position.y = y; f.userData.y0 = y; f.userData.ph = ph; g.add(f); FLOAT.add(f);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(spread, spread).rotateX(-Math.PI/2),
    new THREE.MeshBasicMaterial({ map:TEX.glow, color, transparent:true, opacity:.55, blending:THREE.AdditiveBlending, depthWrite:false }));
  pool.position.y = .008; pool.renderOrder = 2; pool.userData.ghostHide = true; g.add(pool);
  return f; }
function onSphere(c, R, th, ph, lift=0){ const n = new THREE.Vector3(Math.sin(th)*Math.cos(ph), Math.cos(th), Math.sin(th)*Math.sin(ph));
  return { p:c.clone().addScaledVector(n, R + lift), q:new THREE.Quaternion().setFromUnitVectors(_up, n) }; }
function put(acc, geo, mat, at, off=new THREE.Vector3()){ const o = off.clone().applyQuaternion(at.q).add(at.p); acc.add(geo, mat, _m.compose(o, at.q, _s)); }
function cottage(acc, at, k=1, roof=MAT.roof){
  put(acc, new THREE.BoxGeometry(.16*k, .13*k, .14*k).translate(0, .065*k, 0), MAT.white, at);
  put(acc, new THREE.ConeGeometry(.13*k, .1*k, 4).rotateY(Math.PI/4).translate(0, .18*k, 0), roof, at);
  put(acc, new THREE.BoxGeometry(.045*k, .07*k, .01).translate(0, .035*k, .071*k), MAT.wood, at);
  put(acc, new THREE.BoxGeometry(.035*k, .035*k, .01).translate(.052*k, .08*k, .071*k), MAT.win, at);
  put(acc, new THREE.BoxGeometry(.01, .035*k, .035*k).translate(.081*k, .08*k, 0), MAT.win, at); }
function tree(acc, at, k=1, leaf=MAT.leafP){
  put(acc, new THREE.CylinderGeometry(.014*k, .022*k, .13*k, 6).translate(0, .065*k, 0), MAT.wood, at);
  put(acc, new THREE.IcosahedronGeometry(.08*k, 1).translate(0, .17*k, 0), leaf, at); put(acc, new THREE.IcosahedronGeometry(.055*k, 1).translate(.045*k, .22*k, .02*k), leaf, at); }
function crystal(acc, p, h, mat, tilt=0, rot=0){
  acc.add(new THREE.OctahedronGeometry(1, 0).scale(.32*h, h, .32*h).translate(0, h*.7, 0), mat, _m.compose(p, _q.setFromEuler(new THREE.Euler(tilt, rot, tilt*.6)), _s)); }
function rocks(acc, n, rng, rad=.4, y=.03, cx=0, cz=0, size=.03){
  for (let i=0;i<n;i++){ const a = rng()*6.28, d = rad*(.3 + rng()*.7); blob(acc, [MAT.rock, MAT.rockD, MAT.rockL][i%3], new THREE.Vector3(cx + Math.cos(a)*d, y, cz + Math.sin(a)*d), size*(.7 + rng()*.8), .7, 0, rng); } }
const STAR_GEO = (() => { const sh = new THREE.Shape(); for (let i=0;i<10;i++){ const a = i/10*Math.PI*2 - Math.PI/2, r = i%2 ? .04 : .1; i ? sh.lineTo(Math.cos(a)*r, Math.sin(a)*r) : sh.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
  return new THREE.ExtrudeGeometry(sh, { depth:.02, bevelEnabled:true, bevelSize:.01, bevelThickness:.01, bevelSegments:1 }).rotateX(-Math.PI/2); })();
function flatStar(acc, p, s, rot, mat=MAT.gold){ acc.add(STAR_GEO, mat, _m.compose(p, _q.setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(s, s, s))); }
function planet(parent, key, R, pos, spin=.25, tilt=.3){
  const m = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), pmat(key)); m.position.copy(pos); m.rotation.z = tilt;
  m.castShadow = true; m.receiveShadow = true; m.userData.spin = spin; parent.add(m); if (spin) SPIN.add(m); return m; }
/* a moonlet on an invisible pivot that turns around its world */
function moonlet(parent, R, dist, h, key='moon', sp=.5){ const pv = new THREE.Group(); pv.userData.spin = sp; parent.add(pv); SPIN.add(pv);
  planet(pv, key, R, new THREE.Vector3(dist, h, 0), 0, 0); return pv; }

/* ── tiny worlds (Reading): a glowing world floating in the glass, something built on top ── */
const ATMO = { teal:0x7FF2EA, coral:0xFFA890, lilac:0xB89CFF, ice:0xBFEFFF, gold:0xFFD27A, rose:0xFF9AD6, garden:0xA9B8FF };
function world_(g, s){
  const R = s.R || .27, y = s.y || .62, fl = floater(g, y, ATMO[s.key], .95, s.x*.7 + s.z), c = new THREE.Vector3(), a = new Acc();
  planet(fl, s.key, R, c, 0, 0);
  glowSprite(fl, c, R*3.4, ATMO[s.key], .32);
  if (s.st === 'lighthouse') { const at = onSphere(c, R, .08, .6, -.02);
    for (let i=0;i<4;i++) put(a, new THREE.CylinderGeometry(.05 - i*.005, .055 - i*.005, .06, 12).translate(0, .03 + i*.06, 0), i%2 ? MAT.red : MAT.white, at);
    put(a, new THREE.CylinderGeometry(.045, .045, .05, 10).translate(0, .265, 0), MAT.win, at); put(a, new THREE.ConeGeometry(.055, .06, 10).translate(0, .32, 0), MAT.red, at);
    glowSprite(fl, at.p.clone().add(new THREE.Vector3(0, .27, 0).applyQuaternion(at.q)), .42, 0xFFE0A0, .8);
    const d = onSphere(c, R, .75, 2.2, -.01); put(a, new THREE.BoxGeometry(.1, .06, .08).translate(0, .03, 0), MAT.white, d); put(a, new THREE.ConeGeometry(.07, .05, 4).rotateY(Math.PI/4).translate(0, .085, 0), MAT.roofB, d); }
  else if (s.st === 'cottage') { cottage(a, onSphere(c, R, .1, .7, -.01), 1.25); tree(a, onSphere(c, R, .7, 2.6, -.01), .9, MAT.leafM);
    const lamp = onSphere(c, R, .6, -.3, -.005); put(a, new THREE.CylinderGeometry(.008, .01, .15, 6).translate(0, .075, 0), MAT.wood, lamp); put(a, new THREE.SphereGeometry(.024, 8, 6).translate(0, .16, 0), MAT.win, lamp); }
  else if (s.st === 'crystals') { for (const [th, ph, h, m] of [[.05, 0, .16, MAT.crV], [.5, 1.2, .11, MAT.crT], [.55, 3, .12, MAT.crP], [.45, -1.6, .09, MAT.crV], [.8, 2.1, .08, MAT.crT]]) {
      const at = onSphere(c, R, th, ph, -.03); put(a, new THREE.OctahedronGeometry(1, 0).scale(.3*h, h, .3*h).translate(0, h*.7, 0), m, at); }
    glowSprite(fl, new THREE.Vector3(0, R + .12, 0), .5, 0xC6A4FF, .6); }
  else if (s.st === 'dome') { const at = onSphere(c, R, .05, 0, -.03);
    put(a, new THREE.CylinderGeometry(.17, .18, .03, 20).translate(0, .015, 0), MAT.whiteD, at);
    tree(a, { p:at.p.clone().add(new THREE.Vector3(-.04, .02, 0)), q:at.q }, .95, MAT.leafM); tree(a, { p:at.p.clone().add(new THREE.Vector3(.06, .02, .04)), q:at.q }, .7, MAT.leafP);
    const dm = new THREE.Mesh(new THREE.SphereGeometry(.16, 20, 10, 0, Math.PI*2, 0, Math.PI/2), MAT.dome); dm.position.copy(at.p).add(new THREE.Vector3(0, .02, 0)); dm.renderOrder = 6; fl.add(dm);
    for (let i=0;i<3;i++){ const d = onSphere(c, R, .8, i*2.1 + .4, -.005); put(a, new THREE.SphereGeometry(.018, 8, 6).translate(0, .02, 0), MAT.win, d); } }
  else if (s.st === 'tree') { tree(a, onSphere(c, R, .05, 0, -.01), 1.6, MAT.leafP); tree(a, onSphere(c, R, .6, 1.8, -.01), 1, MAT.leafM); tree(a, onSphere(c, R, .65, -2.2, -.01), .8, MAT.leafP);
    const sw = onSphere(c, R, .55, .5, -.01); put(a, new THREE.BoxGeometry(.09, .07, .07).translate(0, .035, 0), MAT.white, sw); put(a, new THREE.BoxGeometry(.03, .03, .01).translate(0, .04, .036), MAT.win, sw); }
  a.into(fl);
  moonlet(fl, .055, R + .16, .06, s.key === 'lilac' ? 'teal' : 'moon', .6);
}

/* ── Garden world (ring-1 2×2): a big home world with cottages and blossom trees, a stardust ring, two moons ── */
function homeWorld(g){
  const R = .5, fl = floater(g, 1.0, 0xA9B8FF, 1.9, 1.3), c = new THREE.Vector3(), a = new Acc();
  planet(fl, 'garden', R, c, 0, 0);
  glowSprite(fl, c, 1.55, 0xA9B8FF, .3);
  cottage(a, onSphere(c, R, .1, .8, -.01), 1.6); cottage(a, onSphere(c, R, .62, 1.2, -.01), 1.1, MAT.roofB);
  tree(a, onSphere(c, R, .5, 2.7, -.02), 1.3); tree(a, onSphere(c, R, .7, 2.2, -.02), 1, MAT.leafM); tree(a, onSphere(c, R, .4, -2.1, -.02), 1.1); tree(a, onSphere(c, R, .72, -.5, -.02), .9, MAT.leafM);
  const lamp = onSphere(c, R, .5, -.1, -.005); put(a, new THREE.CylinderGeometry(.008, .01, .16, 6).translate(0, .08, 0), MAT.wood, lamp); put(a, new THREE.SphereGeometry(.025, 8, 6).translate(0, .17, 0), MAT.win, lamp);
  a.into(fl);
  const ring = new THREE.Mesh(ringGeo(R*1.3, R*1.75), RINGM); ring.rotation.set(-Math.PI/2 + .32, 0, .25); ring.renderOrder = 5; ring.castShadow = false; fl.add(ring);
  moonlet(fl, .1, R + .42, .12, 'moon', .35); moonlet(fl, .07, R + .3, -.18, 'rose', -.5);
  // a crystal garden on the floor under it
  const b = new Acc(), r = rngFrom(77);
  for (let i=0;i<7;i++){ const an = i/7*6.28 + .3, d = .55 + r()*.25; crystal(b, new THREE.Vector3(Math.cos(an)*d, 0, Math.sin(an)*d), .08 + r()*.1, [MAT.crV, MAT.crT, MAT.crP][i%3], (r()-.5)*.4, r()*6); }
  rocks(b, 6, r, .85, .03); b.into(g);
}

/* ── Breathe: nebula puffs (soft glowing clouds hovering in the glass) and a stardust spring ── */
function puffInto(acc, pal, c, k, r){
  const pts = [[0,0,0,.2],[.15,-.03,.05,.15],[-.15,-.02,-.03,.16],[.04,.1,-.08,.14],[-.06,.08,.1,.13],[.1,-.07,-.12,.12],[-.1,-.08,.12,.12],[0,.17,0,.1]];
  pts.forEach(([x,y,z,rr], i) => blob(acc, i%3 === 2 ? pm(pal,'tip') : pm(pal,'body'), c.clone().add(new THREE.Vector3(x*k, y*k, z*k)), rr*k*(.9 + r()*.2), .85, 1, r));
}
function puff(g, s){
  const pal = s.pal || 'rose', r = rngFrom(s.x*7 + s.z*3), fl = floater(g, s.y || .62, GLOWC[pal], .75, s.x + s.z*.5), a = new Acc();
  puffInto(a, pal, new THREE.Vector3(), 1.4, r);
  for (let i=0;i<5;i++){ const an = r()*6.28, d = .24 + r()*.12; blob(a, MAT.starW, new THREE.Vector3(Math.cos(an)*d, (r()-.5)*.3, Math.sin(an)*d), .016, 1); }
  a.into(fl);
  glowSprite(fl, new THREE.Vector3(0, .02, 0), .95, GLOWC[pal], .5); glowSprite(fl, new THREE.Vector3(.05, .08, .1), .22, 0xFFFFFF, .95, TEX.star);
}
function puff2(g, s){
  const r = rngFrom(19), f1 = floater(g, .45, GLOWC.teal, 1, .4), a1 = new Acc(), f2 = new THREE.Group();
  puffInto(a1, 'teal', new THREE.Vector3(), 1.1, r); a1.into(f1); glowSprite(f1, new THREE.Vector3(), .8, GLOWC.teal, .45);
  f2.position.y = 1.02; f2.userData.y0 = 1.02; f2.userData.ph = 2.1; g.add(f2); FLOAT.add(f2);
  const a2 = new Acc(); puffInto(a2, 'violet', new THREE.Vector3(), .8, r); a2.into(f2); glowSprite(f2, new THREE.Vector3(), .6, GLOWC.violet, .5);
  for (let i=0;i<5;i++) glowSprite(g, new THREE.Vector3(Math.sin(i*1.3)*.08, .62 + i*.07, Math.cos(i*1.7)*.08), .1, 0xFFFFFF, .9, TEX.star);
}
function spring(g){
  const a = new Acc(), r = rngFrom(53);
  a.add(new THREE.CylinderGeometry(.4, .43, .05, 7).translate(0, .025, 0), MAT.glassD);
  a.add(new THREE.CylinderGeometry(.33, .33, .012, 28).translate(0, .056, 0), MAT.pool);
  for (let i=0;i<7;i++){ const an = i/7*6.28, d = .38; crystal(a, new THREE.Vector3(Math.cos(an)*d, .03, Math.sin(an)*d), .07 + r()*.07, i%2 ? MAT.crT : MAT.crV, (r()-.5)*.5, r()*6); }
  a.into(g);
  const fl = floater(g, .62, GLOWC.teal, .1, .9); planet(fl, 'teal', .1, new THREE.Vector3(), .4, .2); glowSprite(fl, new THREE.Vector3(), .55, GLOWC.teal, .6);
  for (let i=0;i<6;i++) glowSprite(g, new THREE.Vector3(Math.cos(i*2.4)*.16, .14 + i*.07, Math.sin(i*2.4)*.16), .09, 0xCFFFF8, .9, TEX.star);
  glowSprite(g, new THREE.Vector3(0, .07, 0), .9, GLOWC.teal, .45);
}

/* ── Sudoku / Math → star clusters: a few stars hover over a stardust patch and gather more with every later piece ── */
const CLUSTER = { Corn:'gold', Carrot:'rose', Lettuce:'teal', Beet:'violet' };
const CLUSTER_NAME = { gold:'Gold star cluster', rose:'Rose star cluster', teal:'Teal star cluster', violet:'Violet star cluster' };
function fillCluster(host, s, stage){
  host.clear();
  const pal = s.pal, st = Math.min(stage, 5), r = rngFrom(s.x*31 + s.z*7 + 5), a = new Acc();
  const n = [4, 7, 11, 16, 22][st - 1], R = .1 + st*.045, cy = .3 + st*.07;
  for (let i=0;i<n;i++){ const u = r(), th = Math.acos(2*r() - 1), ph = r()*6.28, d = R*Math.cbrt(u);
    const p = new THREE.Vector3(Math.sin(th)*Math.cos(ph)*d, cy + Math.cos(th)*d*.8, Math.sin(th)*Math.sin(ph)*d);
    const big = i < 2 + st*.6;
    a.add(new THREE.OctahedronGeometry(big ? .035 + st*.004 : .022, 0), i%3 ? pm(pal,'tip') : MAT.starW, _m.compose(p, _q.setFromEuler(new THREE.Euler(r()*3, r()*3, 0)), _s));
    if (big) glowSprite(host, p, .16 + st*.02, i%2 ? 0xFFFFFF : GLOWC[pal], .9, TEX.star); }
  a.into(host);
  glowSprite(host, new THREE.Vector3(0, cy, 0), .45 + st*.16, GLOWC[pal], .28 + st*.05);
  if (st >= 5) { const c = new THREE.Mesh(new THREE.SphereGeometry(.05, 14, 10), MAT.core); c.position.set(0, cy, 0); host.add(c); glowSprite(host, c.position, .5, 0xFFF4E0, .7); }
  host.userData.stage = stage;
}

/* ── Vocab → nebula pillars: tall soft columns of star-gas rising from the floor, stars being born at the tips ── */
function pillar(g, s){
  const pal = s.pal || 'rose', r = rngFrom(s.x*11 + s.z*5), a = new Acc(), H = s.H || 1.3;
  const col = (x, z, H, k) => { const n = 9; let px = x, pz = z;
    for (let i=0;i<n;i++){ const t = i/(n-1), rr = (.19 - t*.1)*k*(.9 + r()*.2); px += (r()-.5)*.03; pz += (r()-.5)*.03;
      blob(a, t < .3 ? pm(pal,'dark') : t > .8 ? pm(pal,'tip') : pm(pal,'body'), new THREE.Vector3(px, .05 + t*H, pz), rr, .9, 1, r);
      if (i%2 && t > .25) blob(a, pm(pal,'body'), new THREE.Vector3(px + (r()-.5)*.14*k, .05 + t*H - .04, pz + (r()-.5)*.14*k), rr*.6, .9, 1, r); }
    for (let i=0;i<3;i++) blob(a, MAT.starW, new THREE.Vector3(px + (r()-.5)*.12, .05 + H + .02 + r()*.06, pz + (r()-.5)*.12), .018, 1);
    glowSprite(g, new THREE.Vector3(px, .1 + H, pz), .5*k, GLOWC[pal], .55); glowSprite(g, new THREE.Vector3(px + .03, .12 + H, pz), .2*k, 0xFFFFFF, .95, TEX.star); };
  if (s.twin) { col(-.13, -.08, H*.95, .85); col(.16, .12, H*.62, .75); } else { col(0, 0, H, 1); col(.24, .2, H*.4, .6); }
  rocks(a, 4, r, .38, .03); a.into(g);
}

/* ── To-dos: stardust trails, crystal steps, a meteor garden; crystal ridges on the edges ── */
function path(g, s){
  const slab = new THREE.Mesh(G.path, MAT.glassD); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0;
  if (v === 0) { for (let i=0;i<24;i++){ const z = -.44 + i*.038, x = Math.sin(z*6)*.14 + (r()-.5)*.08; a.add(new THREE.SphereGeometry(.012 + r()*.012, 6, 4), i%3 ? MAT.starW : MAT.crP, _m.makeTranslation(x, .045, z)); }
    flatStar(a, new THREE.Vector3(.24, .04, .22), .7, 1); flatStar(a, new THREE.Vector3(-.24, .04, -.2), .55, 2, MAT.crT); }
  else if (v === 1) { for (const [x, z] of [[-.2, -.22], [.16, -.12], [-.1, .1], [.2, .24]]) { a.add(new THREE.CylinderGeometry(.12, .13, .03, 6).translate(x, .05, z), [MAT.crV, MAT.crT][Math.floor(r()*2)]); } }
  else { for (let i=0;i<5;i++) blob(a, [MAT.rock, MAT.rockD, MAT.rockL][i%3], new THREE.Vector3((r()-.5)*.6, .06, (r()-.5)*.6), .05 + r()*.04, .7, 0, r);
    a.add(new THREE.TorusGeometry(.13, .03, 5, 18).rotateX(Math.PI/2).scale(1, .5, 1).translate(.1, .045, .1), MAT.rockL);
    crystal(a, new THREE.Vector3(-.2, .03, .2), .1, MAT.crP, .2, 1); }
  a.into(g); g.userData.ghostMode = 'marker';
}
function ridge(g, s){
  const a = new Acc(), r = rngFrom(s.x*5 + s.z*11 + (s.edge === 'w' ? 3 : 7)), L = s.len;
  for (let i=0;i<L*4;i++){ const t = -L/2 + (i + .5)*(L/(L*4)), off = (r()-.5)*.1;
    const p = s.edge === 'w' ? new THREE.Vector3(-.43 + off, 0, t) : new THREE.Vector3(t, 0, .43 + off);
    crystal(a, p, .1 + r()*.14, [MAT.crV, MAT.crT, MAT.crP][i%3], (r()-.5)*.5, r()*6);
    blob(a, MAT.rockD, p.clone().setY(.03), .04, .6, 0, r); }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}

/* ── Gita → the spiral galaxy core: a luminous spiral, tilted toward you, turning slowly over a crystal dais ── */
const GALAXY_TEX = canvasTex(512, 512, (g, W) => {
  const c = W/2, r = rngFrom(42); g.clearRect(0,0,W,W);
  const col = t => t < .18 ? [255,236,200] : t < .45 ? [255,130,210] : t < .72 ? [180,130,255] : [110,235,235];
  { const hz = g.createRadialGradient(c, c, 0, c, c, W*.5); hz.addColorStop(0,'rgba(200,120,255,.35)'); hz.addColorStop(.6,'rgba(120,80,200,.16)'); hz.addColorStop(1,'rgba(80,60,160,0)'); g.fillStyle = hz; g.fillRect(0,0,W,W); }
  for (let arm=0; arm<2; arm++) for (let i=0;i<1400;i++){ const t = Math.pow(i/1400, .8), an = arm*Math.PI + t*8.6, d = (.05 + t*.9)*W*.48;
    const j = (r()-.5)*W*.05*(.4 + t), x = c + Math.cos(an)*d + j, y = c + Math.sin(an)*d + (r()-.5)*W*.05*(.4 + t);
    const [R, Gc, B] = col(t); g.fillStyle = `rgba(${R},${Gc},${B},${.3*(1 - t*.5)})`; g.beginPath(); g.arc(x, y, 3 + (1 - t)*9 + r()*4, 0, 6.3); g.fill(); }
  for (let i=0;i<320;i++){ const an = r()*6.28, d = Math.pow(r(), .7)*W*.46; g.fillStyle = `rgba(255,255,255,${.35 + r()*.6})`; g.beginPath(); g.arc(c + Math.cos(an)*d, c + Math.sin(an)*d, .6 + r()*1.5, 0, 6.3); g.fill(); }
  const gr = g.createRadialGradient(c, c, 0, c, c, W*.2); gr.addColorStop(0,'rgba(255,250,235,1)'); gr.addColorStop(.35,'rgba(255,215,170,.75)'); gr.addColorStop(1,'rgba(255,160,220,0)');
  g.fillStyle = gr; g.fillRect(0,0,W,W); });
const GALAXY_MAT = new THREE.MeshBasicMaterial({ map:GALAXY_TEX, transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending });
const BEAM_MAT = new THREE.MeshBasicMaterial({ map:TEX.beam, color:0xFFA6E0, transparent:true, opacity:.55, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });
function core(g){
  const a = new Acc(), r = rngFrom(99), cy = 1.36;
  a.add(new THREE.CylinderGeometry(.8, .88, .08, 6).translate(0, .04, 0), MAT.glassD);
  a.add(new THREE.CylinderGeometry(.6, .66, .07, 6).translate(0, .115, 0), MAT.glass);
  a.add(new THREE.TorusGeometry(.63, .018, 4, 6).rotateX(Math.PI/2).rotateY(Math.PI/6).translate(0, .15, 0), MAT.crP);
  a.add(new THREE.CylinderGeometry(.26, .3, .03, 24).translate(0, .165, 0), MAT.pool);
  for (let i=0;i<6;i++){ const an = i/6*6.28 + Math.PI/6, d = .78; crystal(a, new THREE.Vector3(Math.cos(an)*d, .05, Math.sin(an)*d), .16 + r()*.12, [MAT.crV, MAT.crT, MAT.crP][i%3], (r()-.5)*.3, r()*6); }
  for (let i=0;i<6;i++){ const an = i/6*6.28, d = .44; flatStar(a, new THREE.Vector3(Math.cos(an)*d, .152, Math.sin(an)*d), .5, an, MAT.starW); }
  a.into(g);
  // a soft beam of light from the dais up into the core
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.07, .24, cy - .2, 16, 1, true).translate(0, (cy - .2)/2 + .17, 0), BEAM_MAT); beam.renderOrder = 7; beam.castShadow = false; beam.userData.ghostHide = true; g.add(beam);
  // the spiral: disc tilted toward the camera, turning about its own axis
  const fl = new THREE.Group(); fl.position.y = cy; fl.userData.y0 = cy; fl.userData.ph = .3; g.add(fl); FLOAT.add(fl);
  const n = new THREE.Vector3(0, .45, 0).add(CAM_DIR).normalize();
  const tilt = new THREE.Group(); tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); fl.add(tilt);
  const spin = new THREE.Group(); spin.userData.spin = -.18; spin.userData.axis = 'z'; tilt.add(spin); SPIN.add(spin);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.22, 64), GALAXY_MAT); disc.renderOrder = 7; disc.castShadow = false; spin.add(disc);
  const disc2 = new THREE.Mesh(new THREE.CircleGeometry(.7, 48), GALAXY_MAT); disc2.rotation.z = 1.1; disc2.position.z = .004; disc2.renderOrder = 7; disc2.castShadow = false; spin.add(disc2);
  const cs = new Acc(); for (let i=0;i<14;i++){ const an = r()*6.28, d = .25 + r()*.65; cs.add(new THREE.OctahedronGeometry(.02 + r()*.015, 0), i%2 ? MAT.starW : MAT.crT, _m.makeTranslation(Math.cos(an)*d, Math.sin(an)*d, (r()-.5)*.06)); }
  cs.into(spin);
  // two tiny worlds riding the arms
  planet(spin, 'rose', .07, new THREE.Vector3(.62, .3, .05), .5); planet(spin, 'teal', .055, new THREE.Vector3(-.45, -.55, .05), .5);
  const bulge = new THREE.Mesh(new THREE.SphereGeometry(.15, 24, 16).scale(1, 1, .7), MAT.core); bulge.castShadow = false; tilt.add(bulge);
  glowSprite(fl, new THREE.Vector3(), 1.6, 0xFF9AD6, .45); glowSprite(fl, new THREE.Vector3(), .8, 0xFFF0D8, .9); glowSprite(fl, new THREE.Vector3(.06, .05, .06), .35, 0xFFFFFF, 1, TEX.star);
  glowSprite(g, new THREE.Vector3(0, .2, 0), 1.3, 0xFF9AD6, .35);
  g.userData.core = fl;
}

/* blueprint: every farm slot id → a galaxy piece (same cells, rings and order; the core in the right-hand corner) */
const MAP = {
  bigbarn:{ name:'Garden world', b:'home' }, well:{ name:'Rose nebula', b:'puff', pal:'rose', y:.6 }, apple1:{ name:'Rose pillar', b:'pillar', pal:'rose' },
  silo:{ name:'Lighthouse world', b:'world', key:'teal', st:'lighthouse', y:.55 }, silohouse:{ name:'Cottage world', b:'world', key:'coral', st:'cottage', y:.74 },
  coop:{ name:'Crystal world', b:'world', key:'lilac', st:'crystals', y:.6 },
  watertower:{ name:'Twin nebula', b:'puff2' }, pump:{ name:'Violet nebula', b:'puff', pal:'violet', y:.72 },
  apple2:{ name:'Teal pillar', b:'pillar', pal:'teal', H:1.2 }, berry1:{ name:'Twin pillars', b:'pillar', pal:'violet', twin:true },
  peepal:{ name:'Galaxy core', b:'core' }, smallbarn:{ name:'Glass-dome world', b:'world', key:'ice', st:'dome', y:.66 },
  openbarn:{ name:'Blossom world', b:'world', key:'gold', st:'tree', y:.5 }, pond:{ name:'Stardust spring', b:'spring' },
  orange1:{ name:'Gold pillar', b:'pillar', pal:'gold', H:1.25 }, apple3:{ name:'Coral pillar', b:'pillar', pal:'coral', H:1.4 },
  berry2:{ name:'Twin pillars', b:'pillar', pal:'teal', twin:true }, orange2:{ name:'Violet pillar', b:'pillar', pal:'violet', H:1.3 },
  apple4:{ name:'Rose pillar', b:'pillar', pal:'rose', H:1.2 }
};
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:0, path3_0:1, path2_6:2, path3_6:0 };
const PATH_NAME = ['Stardust trail', 'Crystal steps', 'Meteor garden'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') { const pal = CLUSTER[f.crop]; return { ...s, kind:'cluster', crop:f.crop, pal, name:CLUSTER_NAME[pal], stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'gx', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'gx', b:'ridge', edge:f.edge, len:f.len, name:'Crystal ridge' };
  return { ...s, kind:'gx', ...MAP[f.id] };
});
const B = { home:homeWorld, world:world_, puff, puff2, spring, pillar, path, ridge, core };

/* ── the look: dark violet glass tiles with nebula swirls, a plum block ── */
const GX_TILE = { top:['#7A5BB8','#7055AE'], side:'#3A2560', soilTop:'#3A2463', soilBot:'#120A24' };
function gxTileMap(){
  return canvasTex(256, 256, (g, N) => { const r = rngFrom(28);
    g.fillStyle = '#9C94B8'; g.fillRect(0,0,N,N);
    for (let i=0;i<8;i++){ const x = r()*N, y = r()*N, rad = 34 + r()*60, gr = g.createRadialGradient(x,y,0,x,y,rad);
      gr.addColorStop(0, ['rgba(255,120,220,.55)','rgba(90,240,235,.45)','rgba(190,150,255,.5)'][i%3]); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0,0,N,N); }
    for (let i=0;i<170;i++){ g.fillStyle = 'rgba(255,255,255,'+(.35 + r()*.6)+')'; g.beginPath(); g.arc(r()*N, r()*N, .5 + r()*1.3, 0, 6.3); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 3; g.strokeRect(3, 3, N-6, N-6); });
}

/* ── env: the glass cube full of deep space — a nebula shader on the glass, soft wisps inside, stars on the far walls ── */
const NEB = { uYb:{ value:0 }, uYt:{ value:2 }, uT:{ value:0 } };
function nebulaMat(back){
  return new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side: back ? THREE.BackSide : THREE.FrontSide, uniforms:NEB,
    vertexShader:'varying vec2 vUv; varying vec3 vW; varying vec3 vN; void main(){ vUv = uv; vN = normal; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader:`uniform float uYb; uniform float uYt; uniform float uT; varying vec2 vUv; varying vec3 vW; varying vec3 vN;
      float h3(vec3 p){ p = fract(p*.3183099 + .1); p *= 17.; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
      float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3. - 2.*f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm(vec3 p){ float a = .5, s = 0.; for (int i=0;i<4;i++){ s += a*n3(p); p *= 2.03; a *= .5; } return s; }
      void main(){ float h = clamp((vW.y - uYb)/(uYt - uYb), 0., 1.);
        vec3 p = vW*.75 + vec3(uT*.02, 0., uT*.015);
        float m = smoothstep(.42, .78, fbm(p));
        float c = smoothstep(.48, .8, fbm(p*1.35 + 7.1));
        vec3 col = mix(vec3(.13,.06,.30), vec3(.30,.16,.52), h);
        col = mix(col, vec3(.96,.36,.80), m*.8);
        col = mix(col, vec3(.28,.86,.88), c*.7);
        float e = max(abs(vUv.x - .5), abs(vUv.y - .5))*2., rim = smoothstep(.93, 1., e);
        float top = step(.5, vN.y);
        ${back ? `float st = step(.975, h3(floor(vW*30.))) * (.5 + .5*h3(floor(vW*30.) + 3.));
        col += st*.9; float a = .8 - .22*h + rim*.1;` : `float a = .10 + m*.16 + c*.12 + rim*.34;`}
        if (top > .5) { col = mix(col, vec3(1.), .3); a = ${back ? '.1' : '.12'} + rim*.3; }
        col = mix(col, vec3(1.), rim*.5);
        gl_FragColor = vec4(col, a); }` });
}
function wispTex(seed, cols){ return canvasTex(256, 256, (g, W) => { const r = rngFrom(seed); g.clearRect(0,0,W,W);
  for (let i=0;i<26;i++){ const x = W*.2 + r()*W*.6, y = W*.3 + r()*W*.4, rad = 20 + r()*50, gr = g.createRadialGradient(x,y,0,x,y,rad);
    gr.addColorStop(0, cols[i%cols.length]); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0,0,W,W); } }); }
const WISPS = [wispTex(3, ['rgba(255,110,210,.28)','rgba(190,140,255,.22)']), wispTex(8, ['rgba(90,240,230,.26)','rgba(160,200,255,.2)']), wispTex(13, ['rgba(255,150,200,.24)','rgba(110,230,240,.22)'])];
function buildEnv(){
  const L = V.L, top = Math.max(1.75 + (V.ring-1)*.25, Math.max(...V.boxes.map(b => b.max.y)) + .12), yb = -.1;
  NEB.uYb.value = yb; NEB.uYt.value = top;
  const env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env; V.gxTop = top;
  const h = L/2 + .02; for (const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) V.framePts.push(new THREE.Vector3(sx*(h+.04), top, sz*(h+.04)));
  const box = new THREE.BoxGeometry(L + .08, top - yb, L + .08).translate(0, (top + yb)/2, 0);
  const back = new THREE.Mesh(box, nebulaMat(true)); back.renderOrder = -1;
  const front = new THREE.Mesh(box, nebulaMat(false)); front.renderOrder = 8;
  env.add(back, front);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color:0xF4E8FF, transparent:true, opacity:.6, depthWrite:false }));
  edges.renderOrder = 9; env.add(edges);
  // soft nebula wisps drifting inside the glass, kept near the back walls so they never wash the pieces
  V.wisps = []; const r = rngFrom(11), m0 = L/2 - .5;
  for (let i=0;i<4 + V.ring*2;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:WISPS[i%3], transparent:true, opacity:.9, blending:THREE.AdditiveBlending, depthWrite:false }));
    const along = -m0 + r()*2*m0, back2 = i%2 ? new THREE.Vector3(-m0, 0, along) : new THREE.Vector3(along, 0, -m0);
    s.position.set(back2.x, TILE_TOP + .5 + r()*(top - 1), back2.z); s.scale.set(1.6 + r()*1.4 + V.ring*.3, 1.1 + r()*.8, 1); s.material.rotation = r()*6;
    s.userData.base = s.position.clone(); s.userData.ph = i*1.3; s.renderOrder = 6; env.add(s); V.wisps.push(s); }
}

/* decor: crystals, fallen stars and glints on cells nothing will use; stardust on waiting cells */
function gxDecor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    if (!sl || sl === 'later') {
      for (let i=0;i<2 + Math.floor(r()*2);i++) crystal(a, new THREE.Vector3(p.x + (r()-.5)*.55, TILE_TOP, p.z + (r()-.5)*.55), .06 + r()*.08, [MAT.crV, MAT.crT, MAT.crP][Math.floor(r()*3)], (r()-.5)*.5, r()*6);
      flatStar(a, new THREE.Vector3(p.x + (r()-.5)*.5, TILE_TOP + .006, p.z + (r()-.5)*.5), .5 + r()*.4, r()*6, MAT.starW);
      rocks(a, 2, r, .4, TILE_TOP + .015, p.x, p.z, .025); a.into(grp);
      if (AMBIENT()) glowSprite(grp, new THREE.Vector3(p.x + (r()-.5)*.4, TILE_TOP + .35 + r()*.5, p.z + (r()-.5)*.4), .12, 0xFFFFFF, .85, TEX.star);
      grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { rocks(a, 2, r, .4, TILE_TOP + .012, p.x, p.z, .02);
      for (let i=0;i<3;i++) a.add(new THREE.SphereGeometry(.013, 6, 4), i%2 ? MAT.starW : MAT.crP, _m.makeTranslation(p.x + (r()-.5)*.6, TILE_TOP + .01, p.z + (r()-.5)*.6));
      a.into(grp); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else world.remove(grp);
  }
}

/* ══════════ life: worlds turn and bob, the core spins, motes twinkle, star-minnows swim; on completion comets and space whales ══════════ */
function makeMinnow(col){ const g = new THREE.Group(), a = new Acc(), m = EM(col, col, .6);
  a.add(new THREE.SphereGeometry(.05, 10, 8).scale(.7, .8, 1.5), m); a.add(new THREE.ConeGeometry(.04, .06, 4).rotateX(-Math.PI/2).scale(.3, 1, 1).translate(0, 0, -.1), m);
  a.into(g); glowSprite(g, new THREE.Vector3(), .22, col, .6); return g; }
const COMET_COL = [0xFFA6E0, 0x9FF4F0, 0xFFE0A8];
function makeComet(i){ const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.IcosahedronGeometry(.08, 1), [MAT.crP, MAT.crT, MAT.gold][i%3]); a.into(g);
  glowSprite(g, new THREE.Vector3(), .55, COMET_COL[i%3], .9);
  const tail = []; for (let k=0;k<9;k++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:COMET_COL[i%3], transparent:true, opacity:.55*(1 - k/9), blending:THREE.AdditiveBlending, depthWrite:false }));
    s.scale.setScalar(.34*(1 - k/11)); s.renderOrder = 9; tail.push(s); }
  g.userData.tail = tail; return g; }
const WHALE = { body:SM(0x7478E8, { emissive:0x2C2690, emissiveIntensity:.45, roughness:.55 }), belly:SM(0xE6DCFF, { emissive:0x6A5AB0, emissiveIntensity:.2 }),
  spot:new THREE.MeshStandardMaterial({ color:0xB8FFF6, emissive:0x5EEAE0, emissiveIntensity:1.2 }), eye:SM(0x1A1433) };
function makeWhale(Lz=1){
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const a = new Acc();
  const prof = [[0,0],[.05,.04],[.09,.15],[.15,.38],[.19,.6],[.2,.74],[.17,.88],[.1,.97],[0,1]].map(([r, y]) => new THREE.Vector2(r*Lz, y*Lz));
  a.add(new THREE.LatheGeometry(prof, 18).rotateX(Math.PI/2).scale(1.1, .82, 1).translate(0, 0, -.5*Lz), WHALE.body);
  a.add(new THREE.SphereGeometry(.16*Lz, 16, 10).scale(1, .45, 2.2).translate(0, -.08*Lz, .14*Lz), WHALE.belly);
  for (const sx of [-1, 1]) { a.add(new THREE.SphereGeometry(.1*Lz, 10, 6).scale(1.8, .18, .8).rotateZ(sx*.5).translate(sx*.22*Lz, -.07*Lz, .12*Lz), WHALE.body);
    a.add(new THREE.SphereGeometry(.018*Lz, 8, 6).translate(sx*.155*Lz, .03*Lz, .33*Lz), WHALE.eye); }
  for (let i=0;i<7;i++) a.add(new THREE.SphereGeometry(.016*Lz, 6, 4).translate(Math.sin(i*1.9)*.06*Lz, .15*Lz, (.25 - i*.09)*Lz), WHALE.spot);
  a.into(body);
  const tail = new THREE.Group(); tail.position.z = -.48*Lz; body.add(tail); const t = new Acc();
  for (const sx of [-1, 1]) t.add(new THREE.SphereGeometry(.1*Lz, 10, 6).scale(1.5, .15, .7).rotateY(sx*.5).translate(sx*.12*Lz, 0, -.05*Lz), WHALE.body);
  t.into(tail); g.userData.tail = tail; glowSprite(g, new THREE.Vector3(0, .15*Lz, 0), .5*Lz, 0x7FF2EA, .25); return g; }
function orbitPos(u, t, out){ const a = t*u.sp + u.ph; return out.set(u.cx + Math.cos(a)*u.rx, TILE_TOP + u.h + Math.sin(a*1.3 + u.ph)*u.bob, u.cz + Math.sin(a)*u.rz); }
function addLife(kind, obj, u, resident){ const r = { kind, obj, u, arrive:1, resident }; world.add(obj); (V.res || (V.res = [])).push(r); V.life.push(obj);
  if (obj.userData.tail && Array.isArray(obj.userData.tail)) obj.userData.tail.forEach(s => { world.add(s); V.life.push(s); }); return r; }
const _p = new THREE.Vector3(), _p2 = new THREE.Vector3();
function inScene(o){ while (o) { if (o.isScene) return true; o = o.parent; } return false; }
function moveLife(t){
  SPIN.forEach(m => { if (!inScene(m)) { SPIN.delete(m); return; } const b = m.userData.ph0 ?? (m.userData.ph0 = m.userData.axis === 'z' ? m.rotation.z : m.rotation.y);
    if (m.userData.axis === 'z') m.rotation.z = b + t*m.userData.spin; else m.rotation.y = b + t*m.userData.spin; });
  FLOAT.forEach(f => { if (!inScene(f)) { FLOAT.delete(f); return; } f.position.y = f.userData.y0 + Math.sin(t*.9 + f.userData.ph)*.035; });
  NEB.uT.value = t;
  if (!V) return;
  (V.twinkles || []).forEach((s, i) => { const k = .5 + .5*Math.sin(t*2.2 + i*1.9); s.material.opacity = .2 + .75*k*k; });
  (V.wisps || []).forEach(s => { s.position.x = s.userData.base.x + Math.sin(t*.1 + s.userData.ph)*.15; s.material.rotation += 0; });
  (V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    orbitPos(u, t, _p); orbitPos(u, t + .05*Math.sign(u.sp), _p2);
    if (e < 1) { const from = _p.clone().add(new THREE.Vector3(5, 2.5, -4)); _p.lerpVectors(from, _p, e); }
    r.obj.position.copy(_p);
    if (r.kind !== 'comet') { const d = _p2.sub(orbitPos(u, t, new THREE.Vector3())); r.obj.rotation.y = Math.atan2(d.x, d.z); }
    if (r.kind === 'whale') { r.obj.userData.tail.rotation.x = Math.sin(t*2.4 + u.ph)*.35; r.obj.rotation.z = Math.sin(t*.7 + u.ph)*.08; }
    if (r.kind === 'comet') r.obj.userData.tail.forEach((s, k) => { orbitPos(u, t - (k + 1)*.07/Math.abs(u.sp)*.35, s.position); if (e < 1) s.position.lerpVectors(s.position.clone().add(new THREE.Vector3(5, 2.5, -4)), s.position.clone(), e); });
  });
}
let _t = 2.1;
function gxAmbient(){
  V.res = []; V.twinkles = [];
  const r = rngFrom(7), top = V.gxTop || 2, m = V.L/2 - .15;
  for (let i=0;i<10 + V.ring*8;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:i%3 ? TEX.star : TEX.glow, color:[0xFFFFFF, 0xFFD6F0, 0xCFFFF8][i%3], transparent:true, opacity:.8, blending:THREE.AdditiveBlending, depthWrite:false }));
    s.position.set((r()*2 - 1)*m, TILE_TOP + .3 + r()*(top - .5), (r()*2 - 1)*m); s.scale.setScalar(i%3 ? .09 + r()*.08 : .05 + r()*.04); s.renderOrder = 9; world.add(s); V.twinkles.push(s); V.life.push(s); }
  const R = V.ring;
  [0xFF9AD6, 0x7FF2EA, 0xC6A4FF].forEach((c, i) => addLife('minnow', makeMinnow(c), { cx:.2, cz:.3, rx:.5 + R*.35, rz:.45 + R*.3, h:.9 + i*.07, sp:.5, ph:i*.18, bob:.05 }, false));
  if (R >= 2) [0xFFE0A8, 0xFF9AD6].forEach((c, i) => addLife('minnow', makeMinnow(c), { cx:-.3, cz:-.2, rx:.6 + R*.4, rz:.7 + R*.3, h:1.3 + i*.06, sp:-.42, ph:2.4 + i*.2, bob:.06 }, false));
  moveLife(_t);
}
function residentPlan(){ const h = GRID/2, top = V.gxTop || 2.3;
  return {
    comets:[0,1,2].map(i => ({ cx:0, cz:0, rx:h - 1 - i*.4, rz:h - 1.3 - i*.3, h:top*.72 - i*.2, sp:.34 - i*.05, ph:1.2 + i*2.1, bob:.2 })),
    // phases put both whales on the far-left side at the frozen frame (t 2.1), clear of the galaxy core in the right-hand corner
    whales:[{ cx:0, cz:0, rx:h - 1.1, rz:h - 1.5, h:top*.6, sp:.16, ph:2.2, bob:.1, L:1.6 }, { cx:0, cz:0, rx:h - 1.1, rz:h - 1.5, h:top*.6 - .3, sp:.16, ph:2.75, bob:.08, L:.9 }]
  };
}
function spawnGroup(i, plan){
  if (i === 0) return plan.comets.map((u, k) => addLife('comet', makeComet(k), u, true));
  return plan.whales.map(u => addLife('whale', makeWhale(u.L), u, true));
}
async function gxMoveIn(walk){
  const plan = residentPlan(); V.residentsIn = true; V.res = V.res || [];
  for (let i=0;i<2;i++){
    const rs = spawnGroup(i, plan);
    if (!walk) { rs.forEach(r => r.arrive = 1); moveLife(_t); continue; }
    rs.forEach(r => r.arrive = 0); moveLife(_t);
    await new Promise(res => tween(S.rm ? 1 : (i === 1 ? 2400 : 1500), t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.08))),
      () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone(), 12, i ? 0xCFFFF8 : 0xFFD6F0, .6); res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = 2;
}
const RES_THUMB = { comet:() => { const c = makeComet(0); c.userData.tail.forEach((s, k) => { s.position.set(-(k + 1)*.09, (k + 1)*.03, 0); c.add(s); }); return c; },
  whale:() => { const w = makeWhale(1); w.rotation.y = Math.PI/2 + .5; return w; } };

export default {
  id:'galaxy', name:'Galaxy', title:'Your galaxy',
  season:42, dates:'9–22 Aug', nextIn:14,
  kits:['a'],                                 // shared kit only for the engine's defaults; every galaxy piece is procedural
  families:{
    water:   { label:'nebula clouds',        tag:'Nebula' },
    building:{ label:'tiny worlds',          tag:'World' },
    path:    { label:'stardust & crystals',  tag:'Stardust' },
    crop:    { label:'star clusters',        tag:'Cluster' },
    tree:    { label:'nebula pillars',       tag:'Pillar' },
    special: { label:'the galaxy core',      tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  // a dimmer, violet rig: the stars, nebula and core are emissive, so less white key light lets them glow instead of washing out
  lights:{ hemi:{ sky:0xD8CCFF, ground:0x2A1F52, intensity:1.3 }, sun:{ color:0xF2E4FF, intensity:1.8 }, fill:{ color:0xA88CFF, intensity:.6 } },
  ground:{ tile:GX_TILE, tileMap:gxTileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 12c0-2 2.6-2.6 3.8-1 1.8 2.3-.6 5.8-3.8 5.8-4 0-6.2-4.4-4.2-7.8C10 5.6 15.8 5 18.6 8.4" fill="none" stroke="#D65BB0" stroke-width="2" stroke-linecap="round"/><path d="M12 12c0 2-2.6 2.6-3.8 1-1.8-2.3.6-5.8 3.8-5.8" fill="none" stroke="#3FC2C4" stroke-width="2" stroke-linecap="round" opacity=".9"/><circle cx="12" cy="12" r="1.8" fill="#FFE2B0"/><circle cx="19.5" cy="17.5" r="1.4" fill="#A07CF0"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M14 40 64 18l50 22v58l-50 22-50-22z" opacity=".35"/><path d="M64 70c0-8 10-10 15-4 7 9-2 22-15 22-16 0-24-17-16-30 8-13 30-15 41-2" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><circle cx="64" cy="70" r="7"/><circle cx="30" cy="54" r="5"/><circle cx="98" cy="90" r="6"/><circle cx="92" cy="40" r="3"/></g>',
  album:{ image:'assets/galaxy/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#EEE6F8)' },
  css:'.phone[data-theme="galaxy"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#F0E8FA 58%,#DDD0F2 100%)}',

  build(g, s, opt){
    if (s.kind === 'cluster') {
      const slab = new THREE.Mesh(new THREE.CylinderGeometry(.4, .43, .04, 7), MAT.glass); slab.position.y = .02; slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ map:TEX.glow, color:GLOWC[s.pal], transparent:true, opacity:.55, blending:THREE.AdditiveBlending, depthWrite:false }));
      pool.position.y = .045; pool.renderOrder = 2; pool.userData.ghostHide = true; g.add(pool);
      const host = new THREE.Group(); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillCluster(host, s, st);
      fillCluster(host, s, opt.stage ?? cropStage(s.id));
    } else B[s.b](g, s, opt);
  },
  scaleOf: () => 1,
  contact: s => s.kind === 'gx' && ['pillar','spring','core'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.b === 'spring',
  decor: gxDecor,
  env: buildEnv,
  ambient: gxAmbient,
  tick(t){ _t = t; moveLife(t); },
  onImpact(pos, big){ sparkle(pos.clone().setY(pos.y + .3), big ? 20 : 12, 0xF3C8FF, big ? .9 : .6); sparkle(pos.clone().setY(pos.y + .3), big ? 10 : 6, 0x9FF4F0, .5); },

  residents:[ { id:'comet', name:'Comets', n:3 }, { id:'whale', name:'Space whales', n:2 } ],
  moveIn: gxMoveIn,
  residentThumb(d, thumbFor){ return thumbFor('galaxy:'+d.id, RES_THUMB[d.id], 168); },
  residentRig(d){ const obj = RES_THUMB[d.id](); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
