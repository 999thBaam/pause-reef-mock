/* MINI SOLAR SYSTEM (?theme=solar) — the land is a brass orrery on a night-blue block. Every piece is a tiny world on a brass
   stand: ocean and ice planets (Breathe), moons whose bases grow a module per later piece (Sudoku/Math), ringed and banded
   giants held high on tall rods (Vocab), little-prince planets with a cottage, an observatory, a space station, a dish and a
   launch tower (Reading), star paths and asteroid belts (To-dos), and the Sun itself as the Gita hero in the right-hand corner.
   Dotted orbit lines on the tiles all circle the Sun's corner, so even at 3×3 the pieces already sit on orbits around it.
   Same ring blueprint, camera and light rig as the farm (hero-right: every farm slot id maps to a solar piece, so order, rings,
   pick-3, growth and expansion work unchanged). Everything is procedural three.js geometry with canvas textures, merged per
   material; the only model kit is the shared Quaternius MegaKit (kit a, CC0) for a tree and flowers on the home planet. */
import * as THREE from 'three';
import { rngFrom, TEX, world, CAM_DIR } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre, footprint } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { Acc, seg, blob, _up, _q, _m, _s } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { tintedFlower } from '../engine/life.js';
import { FARM_SLOTS as FARM, FARM_ORDER } from './farm.js';

const PM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.8, metalness:0, flatShading:true, ...o });
const SM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.6, metalness:0, ...o });
const LEAF = PM(0x6FC24A);
const DISH_MAT = SM(0xF6F3EE, { side:THREE.DoubleSide, emissive:0x8A8FA8, emissiveIntensity:.35 });
const MAT = {
  brass:SM(0xE0AE4E, { roughness:.4, metalness:.35 }), brassD:SM(0xB9853A, { roughness:.45, metalness:.35 }),
  rock:PM(0xA59DB8), rockD:PM(0x7F7896), rockL:PM(0xC9C2DA),
  white:SM(0xF6F3EE), whiteD:SM(0xD9D6E2), red:SM(0xEE5A4E), redD:SM(0xC1433A), blue:SM(0x5B8FE0), teal:SM(0x4FC1B8),
  panel:SM(0x3A5BB8, { roughness:.3, metalness:.2 }), dark:SM(0x2E3148), wood:PM(0x9A6A45), roof:PM(0xE8735A), roofB:PM(0x6A8FE0),
  win:new THREE.MeshStandardMaterial({ color:0xFFE6A8, emissive:0xFFB54A, emissiveIntensity:1, roughness:.4 }),
  glass:new THREE.MeshStandardMaterial({ color:0xBFE8FF, emissive:0x5AA8E0, emissiveIntensity:.5, roughness:.2 }),
  gold:new THREE.MeshStandardMaterial({ color:0xFFD86A, emissive:0xFFB02A, emissiveIntensity:.9, roughness:.4 }),
  starL:new THREE.MeshStandardMaterial({ color:0xFFF3C8, emissive:0xFFD27A, emissiveIntensity:.8, roughness:.5 }),
  crystal:PM(0xB9A4F5, { roughness:.35, emissive:0x5A3EB0, emissiveIntensity:.45 }), crystalB:PM(0x8FE3F2, { roughness:.35, emissive:0x1C7E96, emissiveIntensity:.45 }),
  beacon:new THREE.MeshStandardMaterial({ color:0xFF6A5A, emissive:0xFF3B2B, emissiveIntensity:1.6 }),
  flame:new THREE.MeshBasicMaterial({ color:0xFFB347, transparent:true, opacity:.9, depthWrite:false }),
  sun:new THREE.MeshStandardMaterial({ color:0xFFD460, emissive:0xFF9E22, emissiveIntensity:1.05, roughness:.7 }),
  rays:new THREE.MeshStandardMaterial({ color:0xFFC23A, emissive:0xFF8A1A, emissiveIntensity:.95, roughness:.7, side:THREE.DoubleSide })
};

/* ── canvas textures: planets (equirect 256×128), rings, tiles ── */
function canvasTex(w, h, draw, repeat){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) t.wrapS = THREE.RepeatWrapping; return t; }
function bands(g, W, H, cols, seed, wob=2){ const r = rngFrom(seed); let y = 0;
  while (y < H) { const h = 5 + r()*14, col = cols[Math.floor(r()*cols.length)], ph = r()*6;
    g.fillStyle = col; g.beginPath(); g.moveTo(0, y); for (let x=0;x<=W;x+=8) g.lineTo(x, y + Math.sin(x*.05 + ph)*wob);
    g.lineTo(W, y + h + 2); for (let x=W;x>=0;x-=8) g.lineTo(x, y + h + 2 + Math.sin(x*.05 + ph + 1)*wob); g.fill(); y += h; } }
function craters(g, W, H, n, dark, light, seed){ const r = rngFrom(seed);
  for (let i=0;i<n;i++){ const x = r()*W, y = H*.15 + r()*H*.7, rad = 3 + r()*11;
    g.fillStyle = dark; g.beginPath(); g.ellipse(x, y, rad, rad*.8, 0, 0, 6.3); g.fill();
    g.strokeStyle = light; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, rad, rad*.8, 0, .3, 2.8); g.stroke(); } }
function blobs(g, W, H, n, col, seed, rmin=8, rmax=22){ const r = rngFrom(seed); g.fillStyle = col;
  for (let i=0;i<n;i++){ const x = r()*W, y = H*.2 + r()*H*.6, k = 3 + Math.floor(r()*4);
    for (let j=0;j<k;j++){ const rr = rmin + r()*(rmax - rmin); g.beginPath(); g.ellipse(x + (r()-.5)*rr*1.6, y + (r()-.5)*rr, rr, rr*.7, r(), 0, 6.3); g.fill(); } } }
function clouds(g, W, H, seed, a=.75){ const r = rngFrom(seed); g.strokeStyle = 'rgba(255,255,255,'+a+')'; g.lineCap = 'round';
  for (let i=0;i<16;i++){ const y = H*.12 + r()*H*.76, x = r()*W, l = 20 + r()*60; g.lineWidth = 2 + r()*4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l*.5, y - 4 + r()*8, x + l, y + (r()-.5)*6); g.stroke(); } }
const PDEF = {
  ocean:  (g,W,H) => { g.fillStyle = '#3D8FDC'; g.fillRect(0,0,W,H); blobs(g,W,H,6,'#6CC46A',3); blobs(g,W,H,3,'#E9D48E',8,5,9); clouds(g,W,H,4);
                       g.fillStyle = '#F4FBFF'; g.fillRect(0,0,W,9); g.fillRect(0,H-9,W,9); },
  home:   (g,W,H) => { g.fillStyle = '#4A9BE0'; g.fillRect(0,0,W,H); blobs(g,W,H,7,'#78C45A',11,10,26); blobs(g,W,H,4,'#5BAF4A',12,6,14); clouds(g,W,H,5,.65);
                       g.fillStyle = '#F4FBFF'; g.fillRect(0,0,W,10); g.fillRect(0,H-8,W,8); },
  ice:    (g,W,H) => { g.fillStyle = '#CDEEFF'; g.fillRect(0,0,W,H); const r = rngFrom(21); g.strokeStyle = 'rgba(80,150,200,.45)'; g.lineWidth = 1.4;
                       for (let i=0;i<22;i++){ const x = r()*W, y = r()*H; g.beginPath(); g.moveTo(x,y); g.lineTo(x + (r()-.5)*50, y + (r()-.5)*24); g.lineTo(x + (r()-.5)*70, y + (r()-.5)*30); g.stroke(); }
                       g.fillStyle = '#FFFFFF'; g.fillRect(0,0,W,18); g.fillRect(0,H-14,W,14); },
  neptune:(g,W,H) => { bands(g,W,H,['#3E6FD8','#4F86E6','#5E9BF0','#3A62C4','#6FB0F4'],31,3); g.fillStyle = 'rgba(30,50,140,.55)'; g.beginPath(); g.ellipse(160,70,16,8,0,0,6.3); g.fill(); clouds(g,W,H,32,.5); },
  saturn: (g,W,H) => bands(g,W,H,['#F6DDA8','#EDC98A','#F9E9C8','#E3B879','#F2D59C'],41,1.5),
  jupiter:(g,W,H) => { bands(g,W,H,['#F2C99A','#E3A06C','#F8E2C4','#D9895A','#EDB887','#F6D8B4'],51,3); g.fillStyle = '#D6614A'; g.beginPath(); g.ellipse(170,80,15,9,0,0,6.3); g.fill();
                       g.fillStyle = '#E98A6E'; g.beginPath(); g.ellipse(170,80,9,5,0,0,6.3); g.fill(); },
  rose:   (g,W,H) => bands(g,W,H,['#F4B6CF','#E99AC0','#F9D3E2','#D98CC0','#F2C3DA','#C9A0E8'],61,2.5),
  mint:   (g,W,H) => bands(g,W,H,['#9FE3C9','#7FD1B8','#C6F0DE','#6BC3B0','#B1E8D2','#8ED0E6'],71,2.5),
  moonGrey:(g,W,H) => { g.fillStyle = '#CFCAD9'; g.fillRect(0,0,W,H); craters(g,W,H,26,'rgba(110,100,135,.35)','rgba(255,255,255,.7)',81); },
  moonRust:(g,W,H) => { g.fillStyle = '#E8A27A'; g.fillRect(0,0,W,H); craters(g,W,H,24,'rgba(150,70,40,.35)','rgba(255,225,200,.7)',82); },
  moonLilac:(g,W,H) => { g.fillStyle = '#C8B4EE'; g.fillRect(0,0,W,H); craters(g,W,H,24,'rgba(100,70,160,.33)','rgba(255,245,255,.7)',83); },
  rockL:  (g,W,H) => { g.fillStyle = '#B9B1CC'; g.fillRect(0,0,W,H); craters(g,W,H,18,'rgba(95,85,125,.35)','rgba(255,255,255,.6)',84); },
  sun:    (g,W,H) => { g.fillStyle = '#FFFFFF'; g.fillRect(0,0,W,H); const r = rngFrom(91);
                       for (let i=0;i<220;i++){ g.fillStyle = r() < .5 ? 'rgba(255,140,40,.16)' : 'rgba(255,255,220,.35)'; g.beginPath(); g.arc(r()*W, r()*H, 2 + r()*6, 0, 6.3); g.fill(); } }
};
const PMAT = {};
function pmat(key){ if (PMAT[key]) return PMAT[key];
  const map = canvasTex(256, 128, PDEF[key], true);
  return PMAT[key] = new THREE.MeshStandardMaterial({ map, roughness:.78, metalness:0, emissive:0xffffff, emissiveMap:map, emissiveIntensity:.1 }); }
const RINGTEX = {};
function ringMat(key, cols){ if (RINGTEX[key]) return RINGTEX[key];
  const map = canvasTex(256, 4, (g, W) => { const gr = g.createLinearGradient(0,0,W,0); cols.forEach(([o,c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0,0,W,4); });
  return RINGTEX[key] = new THREE.MeshStandardMaterial({ map, transparent:true, side:THREE.DoubleSide, depthWrite:false, roughness:.8, emissive:0xffffff, emissiveMap:map, emissiveIntensity:.05 }); }
const RING_COLS = {
  saturn:[[0,'rgba(240,220,180,0)'],[.08,'rgba(240,220,180,.9)'],[.35,'rgba(214,180,130,.7)'],[.45,'rgba(255,240,210,.95)'],[.55,'rgba(200,170,130,.25)'],[.72,'rgba(240,222,190,.85)'],[1,'rgba(240,222,190,0)']],
  rose:[[0,'rgba(245,200,230,0)'],[.1,'rgba(245,200,230,.8)'],[.4,'rgba(210,170,240,.6)'],[.6,'rgba(255,225,240,.9)'],[1,'rgba(255,225,240,0)']]
};
function ringGeo(r0, r1){ const geo = new THREE.RingGeometry(r0, r1, 64, 1), p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i=0;i<p.count;i++){ const d = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (d - r0)/(r1 - r0), .5); } return geo; }

/* ── building blocks ── */
const SPIN = new Set();                                   // planets that turn slowly in tick (ghost swap keeps them turning, harmless)
function planet(g, key, R, x, y, z, spin=.25, tilt=.3){
  const m = new THREE.Mesh(new THREE.SphereGeometry(R, 36, 22), pmat(key)); m.position.set(x, y, z); m.rotation.z = tilt; m.rotation.y = (x*3 + z*5)%6;
  m.castShadow = m.receiveShadow = true; m.userData.spin = spin; g.add(m); if (spin) SPIN.add(m); return m; }
function addRing(g, key, R, x, y, z, tiltX=.34, tiltZ=.3, r0=1.3, r1=1.9){
  const m = new THREE.Mesh(ringGeo(R*r0, R*r1), ringMat(key, RING_COLS[key])); m.position.set(x, y, z);
  // nearly edge-on to the fixed camera and tilted on screen, Saturn-style (tiltX = how open, tiltZ = screen tilt)
  const up = new THREE.Vector3(-CAM_DIR.x*CAM_DIR.y, 1 - CAM_DIR.y*CAM_DIR.y, -CAM_DIR.z*CAM_DIR.y).normalize();
  const n = up.multiplyScalar(Math.cos(tiltX)).addScaledVector(CAM_DIR, Math.sin(tiltX)).normalize().applyAxisAngle(CAM_DIR, -tiltZ);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  m.renderOrder = 5; m.castShadow = false; g.add(m); return m; }
/* an orrery stand: brass foot on the tile, a rod up to the planet */
function stand(acc, h, x=0, z=0, foot=.16){
  acc.add(new THREE.CylinderGeometry(foot*.8, foot, .04, 22).translate(x, .02, z), MAT.brassD);
  acc.add(new THREE.CylinderGeometry(foot*.45, foot*.6, .03, 18).translate(x, .055, z), MAT.brass);
  seg(acc, MAT.brass, new THREE.Vector3(x, .06, z), _up, Math.max(.01, h - .06), .018, .014, 8);
  acc.add(new THREE.SphereGeometry(.026, 10, 8).translate(x, h, z), MAT.brass); }
function glowSprite(parent, pos, scale, color, opacity=.8, map=TEX.glow){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; s.userData.glow = true; parent.add(s); return s; }
const STAR_GEO = (() => { const sh = new THREE.Shape(); for (let i=0;i<10;i++){ const a = i/10*Math.PI*2 - Math.PI/2, r = i%2 ? .04 : .1; i ? sh.lineTo(Math.cos(a)*r, Math.sin(a)*r) : sh.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
  return new THREE.ExtrudeGeometry(sh, { depth:.02, bevelEnabled:true, bevelSize:.01, bevelThickness:.01, bevelSegments:1 }).rotateX(-Math.PI/2); })();
function star(acc, p, s, rot, mat=MAT.gold){ acc.add(STAR_GEO, mat, _m.compose(p, _q.setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(s, s, s))); }
function rocks(acc, n, rng, rad=.4, y=.03, cx=0, cz=0, size=.03){
  for (let i=0;i<n;i++){ const a = rng()*6.28, d = rad*(.3 + rng()*.7); blob(acc, [MAT.rock, MAT.rockD, MAT.rockL][i%3], new THREE.Vector3(cx + Math.cos(a)*d, y, cz + Math.sin(a)*d), size*(.7 + rng()*.8), .7, 0, rng); } }
/* place something on a sphere's surface: returns a matrix whose +y is the surface normal at (theta from top, phi around) */
function onSphere(c, R, th, ph, lift=0){ const n = new THREE.Vector3(Math.sin(th)*Math.cos(ph), Math.cos(th), Math.sin(th)*Math.sin(ph));
  return { p:c.clone().addScaledVector(n, R + lift), q:new THREE.Quaternion().setFromUnitVectors(_up, n) }; }
function put(acc, geo, mat, at, off=new THREE.Vector3()){ const o = off.clone().applyQuaternion(at.q).add(at.p); acc.add(geo, mat, _m.compose(o, at.q, _s)); }
function cottage(acc, at, k=1, roof=MAT.roof){
  put(acc, new THREE.BoxGeometry(.16*k, .13*k, .14*k).translate(0, .065*k, 0), MAT.white, at);
  put(acc, new THREE.ConeGeometry(.13*k, .1*k, 4).rotateY(Math.PI/4).translate(0, .18*k, 0), roof, at);
  put(acc, new THREE.BoxGeometry(.045*k, .07*k, .01).translate(0, .035*k, .071*k), MAT.wood, at);
  put(acc, new THREE.BoxGeometry(.035*k, .035*k, .01).translate(.052*k, .08*k, .071*k), MAT.win, at);
  put(acc, new THREE.BoxGeometry(.01, .035*k, .035*k).translate(.081*k, .08*k, 0), MAT.win, at);
  put(acc, new THREE.BoxGeometry(.03*k, .07*k, .03*k).translate(-.04*k, .2*k, -.02*k), MAT.redD, at); }
function dome(acc, at, r, win=true){
  put(acc, new THREE.SphereGeometry(r, 16, 8, 0, Math.PI*2, 0, Math.PI/2), MAT.white, at);
  put(acc, new THREE.CylinderGeometry(r*1.04, r*1.06, r*.18, 16).translate(0, r*.09, 0), MAT.whiteD, at);
  if (win) put(acc, new THREE.BoxGeometry(r*.5, r*.34, r*.2).translate(0, r*.42, r*.86), MAT.win, at); }

/* ── Sudoku / Math → moon bases: a moon on a stand, and a base that gains a module with every later piece ── */
const MOON = { Corn:'moonGrey', Carrot:'moonRust', Lettuce:'moonLilac', Beet:'moonGrey' };
const MOON_NAME = { moonGrey:'Moon base', moonRust:'Red moon base', moonLilac:'Lilac moon base' };
const MR = .27, MY = .44;
function fillBase(host, s, stage){
  host.clear();
  const a = new Acc(), st = Math.min(stage, 5), c = new THREE.Vector3(0, 0, 0), flagMat = [MAT.red, MAT.teal, MAT.blue][(s.x + s.z) % 3];
  // 1: a flag on the top
  { const at = onSphere(c, MR, .55, 2.4); put(a, new THREE.CylinderGeometry(.006, .006, .16, 5).translate(0, .08, 0), MAT.whiteD, at);
    put(a, new THREE.BoxGeometry(.07, .045, .006).translate(.035, .14, 0), flagMat, at); }
  if (st >= 2) dome(a, onSphere(c, MR, .08, 0, -.012), .1);
  if (st >= 3) { const at = onSphere(c, MR, .62, -.6, -.01); put(a, new THREE.CylinderGeometry(.01, .014, .2, 6).translate(0, .1, 0), MAT.whiteD, at);
    put(a, new THREE.SphereGeometry(.018, 8, 6).translate(0, .21, 0), MAT.beacon, at); put(a, new THREE.ConeGeometry(.04, .025, 10, 1, true).rotateX(Math.PI).translate(0, .17, 0), MAT.whiteD, at); }
  if (st >= 4) { dome(a, onSphere(c, MR, .62, .9, -.012), .075);
    const at = onSphere(c, MR, .7, 3.6, 0); put(a, new THREE.CylinderGeometry(.008, .008, .06, 5).translate(0, .03, 0), MAT.whiteD, at);
    put(a, new THREE.BoxGeometry(.13, .006, .07).translate(0, .065, 0), MAT.panel, at); }
  if (st >= 5) { const at = onSphere(c, MR, .72, 1.8, -.005); put(a, new THREE.CylinderGeometry(.05, .05, .012, 14).translate(0, .006, 0), MAT.whiteD, at);
    put(a, new THREE.CylinderGeometry(.018, .022, .09, 10).translate(0, .06, 0), MAT.white, at); put(a, new THREE.ConeGeometry(.018, .04, 10).translate(0, .125, 0), MAT.red, at);
    glowSprite(host, c.clone().add(new THREE.Vector3(0, MR + .1, 0)), .38, 0xFFD58A, .55); }
  a.into(host); host.userData.stage = stage;
}

/* ── the Sun (Gita): a glowing sun on a stepped brass orrery hub, a sunburst behind it, a brass orbit hoop ── */
function buildSun(g, s, opt){
  const a = new Acc(), R = .66, cy = 1.12, c = new THREE.Vector3(0, cy, 0);
  a.add(new THREE.CylinderGeometry(.62, .7, .06, 32).translate(0, .03, 0), MAT.brassD);
  a.add(new THREE.CylinderGeometry(.46, .54, .06, 32).translate(0, .09, 0), MAT.brass);
  a.add(new THREE.CylinderGeometry(.26, .32, .06, 24).translate(0, .15, 0), MAT.brassD);
  for (let i=0;i<12;i++){ const ang = i/12*6.28; star(a, new THREE.Vector3(Math.cos(ang)*.58, .065, Math.sin(ang)*.58), .38, ang, MAT.starL); }
  seg(a, MAT.brass, new THREE.Vector3(0, .18, 0), _up, cy - R - .1, .05, .035, 10);
  a.add(new THREE.TorusGeometry(R*1.32, .016, 6, 64), MAT.brass, _m.compose(c, _q.setFromEuler(new THREE.Euler(Math.PI/2 - .38, 0, .22)), _s));
  a.add(new THREE.SphereGeometry(.05, 10, 8), MAT.brass, _m.compose(new THREE.Vector3(R*1.32, 0, 0).applyEuler(new THREE.Euler(Math.PI/2 - .38, 0, .22)).add(c), _q.identity(), _s));
  a.into(g);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 26), (() => { const m = MAT.sun; if (!m.map) { m.map = canvasTex(256, 128, PDEF.sun, true); } return m; })());
  sun.position.copy(c); sun.castShadow = false; sun.receiveShadow = false; sun.userData.spin = .12; SPIN.add(sun); g.add(sun);
  // sunburst: a flat 16-point star facing the camera, just behind the ball
  const sh = new THREE.Shape(); for (let i=0;i<32;i++){ const an = i/32*Math.PI*2, r = i%2 ? R*1.08 : R*1.42; i ? sh.lineTo(Math.cos(an)*r, Math.sin(an)*r) : sh.moveTo(Math.cos(an)*r, Math.sin(an)*r); }
  const rays = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth:.04, bevelEnabled:false }), MAT.rays);
  rays.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), CAM_DIR); rays.position.copy(c).addScaledVector(CAM_DIR, -.3); rays.userData.rays = true; g.add(rays);
  glowSprite(g, c, 3.0, 0xFFC45A, .55); glowSprite(g, c, 1.7, 0xFFE9B0, .5);
}

/* ── named pieces ── */
const B = {
  sun: buildSun,
  home(g){                                   // ring-1 hero: a little-prince home planet with a cottage, a tree and a moon on a brass arm
    const a = new Acc(), R = .56, c = new THREE.Vector3(-.05, .82, -.05);
    for (const [x, z] of [[-.5, -.35], [.35, -.5], [.3, .45]]) { a.add(new THREE.CylinderGeometry(.09, .11, .035, 16).translate(x, .018, z), MAT.brassD);
      const top = c.clone().add(new THREE.Vector3(x, 0, z).setLength(R*.55)).setY(c.y - R*.8), d = top.clone().sub(new THREE.Vector3(x, .03, z)); seg(a, MAT.brass, new THREE.Vector3(x, .03, z), d, d.length(), .02, .016, 7); }
    a.add(new THREE.TorusGeometry(R*.62, .02, 6, 32).rotateX(Math.PI/2).translate(c.x, c.y - R*.78, c.z), MAT.brass);
    cottage(a, onSphere(c, R, .12, .8, -.01), 1.5);
    cottage(a, onSphere(c, R, .62, 1.3, -.01), 1.05, MAT.roofB);
    const lamp = onSphere(c, R, .55, -.1, -.005); put(a, new THREE.CylinderGeometry(.008, .01, .16, 6).translate(0, .08, 0), MAT.dark, lamp); put(a, new THREE.SphereGeometry(.025, 8, 6).translate(0, .17, 0), MAT.win, lamp);
    // moon on an arm
    const mp = c.clone().add(new THREE.Vector3(.72, .38, .42)); seg(a, MAT.brass, c.clone().add(new THREE.Vector3(.3, .05, .18)), mp.clone().sub(c.clone().add(new THREE.Vector3(.3, .05, .18))), mp.distanceTo(c.clone().add(new THREE.Vector3(.3, .05, .18))) - .1, .012, .01, 6);
    a.into(g);
    planet(g, 'home', R, c.x, c.y, c.z, 0, 0);
    planet(g, 'moonGrey', .12, mp.x, mp.y, mp.z, .4);
    { const t2 = new Acc(); for (const [th, ph, k] of [[.5, 2.7, 1], [.72, 2.2, .75], [.4, -2.2, .85]]) { const at = onSphere(c, R, th, ph, -.02);
        put(t2, new THREE.CylinderGeometry(.014*k, .02*k, .12*k, 6).translate(0, .06*k, 0), MAT.wood, at);
        put(t2, new THREE.IcosahedronGeometry(.075*k, 1).translate(0, .15*k, 0), LEAF, at); put(t2, new THREE.IcosahedronGeometry(.05*k, 1).translate(.04*k, .2*k, .02*k), LEAF, at); }
      t2.into(g); }
    const f1 = onSphere(c, R, .35, -1.4, -.01), f2 = onSphere(c, R, .7, .3, -.01);
    for (const [f, tint] of [[f1, 0xF59BB8], [f2, 0xF4C84A]]) { const fl = tintedFlower(g, 'Flower_3_Group', .12, f.p.x, f.p.y, f.p.z, 0, tint); if (fl) fl.quaternion.premultiply(f.q); }
    glowSprite(g, c.clone().add(new THREE.Vector3(.2, R + .15, .2)), .6, 0xFFD58A, .35);
  },
  planet(g, s){ const a = new Acc(), R = s.R || .3, h = s.h || .52; stand(a, h - R*.95); a.into(g);
    planet(g, s.key, R, 0, h, 0, .3, .25);
    if (s.key === 'ice') { const a2 = new Acc(), r = rngFrom(s.x*3 + s.z); for (let i=0;i<4;i++) { const ang = i*1.6 + r(); const p = new THREE.Vector3(Math.cos(ang)*.33, .04, Math.sin(ang)*.33);
      a2.add(new THREE.OctahedronGeometry(.05 + r()*.03, 0).scale(.7, 1.5, .7).translate(0, .04, 0), MAT.crystalB, _m.makeTranslation(p.x, p.y, p.z)); } a2.into(g); }
    if (s.key === 'neptune') { planet(g, 'rockL', .07, R + .12, h + .12, -.05, .5); }
    if (s.key === 'ocean') addRing(g, 'rose', R, 0, h, 0, .45, -.35, 1.35, 1.6); },
  nebula(g, s){                            // Breathe: a swirl pool of star-gas on a brass dish, a small moon hovering over it
    const a = new Acc(); a.add(new THREE.CylinderGeometry(.44, .46, .04, 32).translate(0, .02, 0), MAT.brassD); a.add(new THREE.TorusGeometry(.42, .02, 6, 40).rotateX(Math.PI/2).translate(0, .045, 0), MAT.brass);
    stand(a, .5, 0, 0, .06); a.into(g);
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(.4, 48).rotateX(-Math.PI/2), NEB_MAT); swirl.position.y = .045; swirl.userData.spin = -.3; swirl.userData.spinAxis = 'y'; SPIN.add(swirl); g.add(swirl);
    planet(g, 'moonLilac', .12, 0, .6, 0, .5);
    const r = rngFrom(s.x*7 + s.z); for (let i=0;i<5;i++){ const an = r()*6.28, d = .1 + r()*.26; glowSprite(g, new THREE.Vector3(Math.cos(an)*d, .1 + r()*.15, Math.sin(an)*d), .12, 0xE9E0FF, .8, TEX.star); } },
  giant(g, s){ const a = new Acc(), R = s.R || .36, h = s.h || 1.12; stand(a, h - R*.95, 0, 0, .17); a.into(g);
    planet(g, s.key, R, 0, h, 0, .18, .2); if (s.ring) addRing(g, s.key === 'rose' ? 'rose' : 'saturn', R, 0, h, 0);
    if (s.key === 'jupiter' || s.key === 'mint') { planet(g, 'moonGrey', .07, R + .14, h - .1, .1, .5); planet(g, 'rockL', .055, -.1, h + R + .06, -R - .06, .5); } },
  twins(g, s){ const a = new Acc(), r = rngFrom(s.x + s.z*9);
    stand(a, .5, 0, 0, .15); const f = new THREE.Vector3(0, .5, 0);
    const p1 = new THREE.Vector3(-.2, .92, -.08), p2 = new THREE.Vector3(.2, .74, .12);
    for (const p of [p1, p2]) { const d = p.clone().sub(f); seg(a, MAT.brass, f, d, d.length() - .1, .014, .012, 6); }
    a.into(g); planet(g, s.alt ? 'mint' : 'rose', .2, p1.x, p1.y, p1.z, .35); planet(g, s.alt ? 'moonRust' : 'ice', .15, p2.x, p2.y, p2.z, .45); },
  observatory(g){ const a = new Acc(), c = new THREE.Vector3(0, .34, 0), R = .27; stand(a, c.y - R*.9);
    const top = onSphere(c, R, 0, 0, -.02);
    put(a, new THREE.CylinderGeometry(.15, .16, .09, 18).translate(0, .045, 0), MAT.whiteD, top);
    put(a, new THREE.SphereGeometry(.15, 18, 10, 0, Math.PI*2, 0, Math.PI/2).translate(0, .09, 0), MAT.white, top);
    put(a, new THREE.BoxGeometry(.05, .16, .12).translate(0, .16, .06), MAT.dark, top);
    put(a, new THREE.CylinderGeometry(.03, .035, .26, 10).rotateX(-.75).translate(0, .24, .1), MAT.blue, top);
    put(a, new THREE.BoxGeometry(.03, .03, .01).translate(.1, .05, .135), MAT.win, top);
    a.into(g); planet(g, 'rockL', R, c.x, c.y, c.z, 0, 0); },
  station(g){ const a = new Acc(); stand(a, .5); a.into(g);
    const st = new THREE.Group(); st.position.set(0, .58, 0); st.rotation.set(.35, 0, .2); g.add(st); const b = new Acc();
    b.add(new THREE.TorusGeometry(.3, .045, 10, 36).rotateX(Math.PI/2), MAT.white);
    for (let i=0;i<8;i++){ const an = i/8*6.28; b.add(new THREE.BoxGeometry(.028, .03, .018), MAT.win, _m.compose(new THREE.Vector3(Math.cos(an)*.3, .03, Math.sin(an)*.3), _q.setFromEuler(new THREE.Euler(0, -an, 0)), _s)); }
    for (let i=0;i<4;i++){ const an = i/4*6.28 + .4; b.add(new THREE.CylinderGeometry(.012, .012, .3, 5).rotateZ(Math.PI/2).translate(.15, 0, 0), MAT.whiteD, _m.makeRotationY(an)); }
    b.add(new THREE.SphereGeometry(.08, 14, 10), MAT.whiteD); b.add(new THREE.CylinderGeometry(.04, .04, .32, 10), MAT.white);
    for (const sy of [-1, 1]) b.add(new THREE.BoxGeometry(.2, .006, .09).translate(0, 0, 0), MAT.panel, _m.makeTranslation(0, sy*.2, 0));
    b.into(st); st.userData.spin = .35; st.userData.spinAxis = 'y'; SPIN.add(st);
    glowSprite(g, new THREE.Vector3(0, .58, 0), .5, 0xFFD58A, .3); },
  dish(g){ const a = new Acc(), c = new THREE.Vector3(0, .3, 0), R = .24; stand(a, c.y - R*.9);
    const top = onSphere(c, R, .2, .8, -.02);
    put(a, new THREE.CylinderGeometry(.02, .03, .14, 8).translate(0, .07, 0), MAT.whiteD, top);
    const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.7, .6, 0));
    const dg = new THREE.CylinderGeometry(.2, .035, .08, 22, 1, true).applyQuaternion(dq).translate(0, .22, 0);
    put(a, dg, DISH_MAT, top); put(a, new THREE.CylinderGeometry(.006, .006, .16, 4).applyQuaternion(dq).translate(0, .28, 0), MAT.dark, top);
    put(a, new THREE.SphereGeometry(.016, 8, 6).translate(0, 0, 0), MAT.beacon, { p:top.p.clone().add(new THREE.Vector3(0, .34, 0).applyQuaternion(top.q)), q:top.q });
    const hut = onSphere(c, R, .75, 2.6, -.01); dome(a, hut, .07);
    a.into(g); planet(g, 'moonGrey', R, c.x, c.y, c.z, 0, 0); },
  launch(g){ const a = new Acc();
    a.add(new THREE.CylinderGeometry(.38, .42, .06, 24).translate(0, .03, 0), MAT.whiteD); a.add(new THREE.CylinderGeometry(.26, .26, .02, 24).translate(0, .07, 0), MAT.rockL); a.add(new THREE.TorusGeometry(.18, .018, 4, 32).rotateX(Math.PI/2).translate(0, .08, 0), MAT.gold);
    for (const [x, z] of [[-.3, -.14], [-.3, .06]]) seg(a, MAT.redD, new THREE.Vector3(x, .06, z), _up, 1.1, .02, .02, 5);
    for (let i=0;i<7;i++){ const y = .16 + i*.14; a.add(new THREE.BoxGeometry(.02, .02, .22).translate(-.3, y, -.04), MAT.redD); a.add(new THREE.BoxGeometry(.018, .16, .018).rotateX(.9).translate(-.3, y + .07, -.04), MAT.red); }
    for (const y of [.45, .8]) a.add(new THREE.BoxGeometry(.2, .018, .03).translate(-.2, y, -.04), MAT.redD);
    a.add(new THREE.SphereGeometry(.022, 8, 6).translate(-.3, 1.18, -.04), MAT.beacon);
    a.into(g);
    const r = makeRocket(.95); r.position.set(.02, .07, -.02); g.add(r); },
  cottage(g){ const a = new Acc(), c = new THREE.Vector3(0, .42, 0), R = .3; stand(a, c.y - R*.9);
    cottage(a, onSphere(c, R, .1, .6, -.01), 1.25, MAT.roofB);
    const lamp = onSphere(c, R, .7, 2.2, -.005); put(a, new THREE.CylinderGeometry(.008, .01, .15, 6).translate(0, .075, 0), MAT.dark, lamp); put(a, new THREE.SphereGeometry(.024, 8, 6).translate(0, .16, 0), MAT.win, lamp);
    const fence = onSphere(c, R, .8, -.8, -.005); for (let i=0;i<3;i++) put(a, new THREE.BoxGeometry(.012, .05, .012).translate((i - 1)*.04, .025, 0), MAT.wood, fence);
    put(a, new THREE.BoxGeometry(.1, .01, .01).translate(0, .04, 0), MAT.wood, fence);
    a.into(g); planet(g, 'moonRust', R, c.x, c.y, c.z, 0, 0);
    const f = onSphere(c, R, .55, -2.2, -.01), fl = tintedFlower(g, 'Flower_4_Group', .1, f.p.x, f.p.y, f.p.z, 0, 0xF59BB8); if (fl) fl.quaternion.premultiply(f.q); },
  path(g, s){ const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0;
    if (v === 0) { for (let i=0;i<4;i++) star(a, new THREE.Vector3((i%2 ? .12 : -.12) + (r()-.5)*.04, .012, -.33 + i*.22), 1.25, r()*6); rocks(a, 3, r, .42, .03); }
    else if (v === 1) { for (let i=0;i<9;i++){ const z = -.4 + i*.1; blob(a, [MAT.rock, MAT.rockD, MAT.rockL][i%3], new THREE.Vector3((r()-.5)*.36, .035, z), .045 + r()*.035, .6, 0, r); } }
    else if (v === 2) { for (let i=0;i<26;i++){ const z = -.44 + r()*.88, x = Math.sin(z*5)*.12 + (r()-.5)*.16; a.add(new THREE.SphereGeometry(.012 + r()*.014, 6, 4), i%3 ? MAT.starL : MAT.crystal, _m.makeTranslation(x, .02, z)); }
      star(a, new THREE.Vector3(.2, .012, .2), .8, 1); star(a, new THREE.Vector3(-.22, .012, -.18), .6, 2); }
    else if (v === 3) { for (const [x, z] of [[-.28, -.28], [.28, .28]]) { a.add(new THREE.CylinderGeometry(.05, .06, .03, 12).translate(x, .015, z), MAT.brassD); seg(a, MAT.brass, new THREE.Vector3(x, .03, z), _up, .26, .012, .01, 6);
        a.add(new THREE.SphereGeometry(.045, 12, 8).translate(x, .31, z), MAT.win); }
      for (let i=0;i<3;i++) star(a, new THREE.Vector3(-.1 + i*.1, .012, .1 - i*.1), .7, i); }
    else { for (const [x, z, rr] of [[-.15, -.12, .14], [.2, .15, .1], [-.18, .25, .07]]) { a.add(new THREE.TorusGeometry(rr, .025, 5, 18).rotateX(Math.PI/2).scale(1, .5, 1).translate(x, .012, z), MAT.rockL);
        a.add(new THREE.CircleGeometry(rr*.9, 18).rotateX(-Math.PI/2).translate(x, .006, z), MAT.rockD); }
      a.add(new THREE.OctahedronGeometry(.06, 0).scale(.7, 1.6, .7).translate(.22, .09, -.22), MAT.crystal); }
    a.into(g); g.userData.ghostMode = v === 3 ? undefined : 'marker'; },
  belt(g, s){ const a = new Acc(), r = rngFrom(s.x*5 + s.z*11 + (s.edge === 'w' ? 3 : 7)), L = s.len, n = L*6;
    for (let i=0;i<n;i++){ const t = -L/2 + (i + .5)*(L/n), y = .14 + Math.sin(i*1.7)*.07 + r()*.06, off = (r()-.5)*.14;
      const p = s.edge === 'w' ? new THREE.Vector3(-.45 + off, y, t) : new THREE.Vector3(t, y, .45 + off);
      blob(a, [MAT.rock, MAT.rockD, MAT.rockL][i%3], p, .045 + r()*.04, .75, 0, r); }
    for (let i=0;i<L;i++){ const t = -L/2 + (i + .5); const p = s.edge === 'w' ? new THREE.Vector3(-.45, 0, t) : new THREE.Vector3(t, 0, .45);
      a.add(new THREE.CylinderGeometry(.04, .05, .025, 10).translate(p.x, .012, p.z), MAT.brassD); seg(a, MAT.brass, p.clone().setY(.02), _up, .1, .008, .008, 5); }
    a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz); }
};
const NEB_MAT = (() => { const map = canvasTex(256, 256, (g, W) => { const c = W/2, r = rngFrom(5);
    g.fillStyle = '#0000'; g.clearRect(0,0,W,W);
    for (let k=0;k<3;k++){ const col = ['rgba(150,120,255,', 'rgba(90,200,255,', 'rgba(255,140,220,'][k];
      for (let i=0;i<260;i++){ const t = i/260, an = t*9 + k*2.1, d = t*W*.45; g.fillStyle = col + (.22*(1 - t*.6)) + ')';
        g.beginPath(); g.arc(c + Math.cos(an)*d, c + Math.sin(an)*d, 6 + t*14, 0, 6.3); g.fill(); } }
    const gr = g.createRadialGradient(c, c, 0, c, c, W*.18); gr.addColorStop(0, 'rgba(255,250,240,.95)'); gr.addColorStop(1, 'rgba(255,250,240,0)'); g.fillStyle = gr; g.fillRect(0,0,W,W);
    for (let i=0;i<40;i++){ g.fillStyle = 'rgba(255,255,255,'+(.5 + r()*.5)+')'; g.beginPath(); g.arc(c + (r()-.5)*W*.8, c + (r()-.5)*W*.8, .8 + r()*1.8, 0, 6.3); g.fill(); } });
  return new THREE.MeshBasicMaterial({ map, transparent:true, depthWrite:false, color:0xffffff }); })();

/* a cute rocket (the launch tower's, and the resident that lifts off) */
function makeRocket(H=1){
  const g = new THREE.Group(), a = new Acc();
  const prof = [[0, 0], [.07, .01], [.1, .08], [.11, .25], [.1, .42], [.07, .56], [.035, .64], [0, .68]].map(([r, y]) => new THREE.Vector2(r*H, y*H + .04*H));
  a.add(new THREE.LatheGeometry(prof, 20), MAT.white);
  a.add(new THREE.ConeGeometry(.072*H, .15*H, 20).translate(0, .64*H, 0), MAT.red);
  a.add(new THREE.CylinderGeometry(.075*H, .06*H, .06*H, 16).translate(0, .03*H, 0), MAT.dark);
  a.add(new THREE.CircleGeometry(.045*H, 16).translate(0, .38*H, .108*H), MAT.glass); a.add(new THREE.TorusGeometry(.046*H, .012*H, 6, 16).translate(0, .38*H, .106*H), MAT.redD);
  for (let i=0;i<3;i++){ const an = i/3*6.28; a.add(new THREE.BoxGeometry(.012*H, .16*H, .09*H).translate(0, .1*H, .12*H), MAT.red, _m.makeRotationY(an)); }
  a.into(g);
  const flame = new THREE.Group(); g.add(flame);
  flame.add(new THREE.Mesh(new THREE.ConeGeometry(.06*H, .26*H, 12).rotateX(Math.PI).translate(0, -.12*H, 0), MAT.flame));
  glowSprite(flame, new THREE.Vector3(0, -.08*H, 0), .5*H, 0xFFB060, .9); flame.visible = false; g.userData.flame = flame; return g;
}

/* blueprint: every farm slot id → a solar piece (same cells, rings and order; the Sun in the right-hand corner) */
const MAP = {
  bigbarn:{ name:'Home planet', b:'home' }, well:{ name:'Ocean world', b:'planet', key:'ocean', R:.29, h:.5 },
  apple1:{ name:'Ringed giant', b:'giant', key:'saturn', ring:true },
  silo:{ name:'Observatory', b:'observatory' }, silohouse:{ name:'Space station', b:'station' }, coop:{ name:'Radio dish', b:'dish' },
  watertower:{ name:'Ice moon', b:'planet', key:'ice', R:.26, h:.5 }, pump:{ name:'Nebula pool', b:'nebula' },
  apple2:{ name:'Banded giant', b:'giant', key:'jupiter', R:.38, h:1.05 }, berry1:{ name:'Twin moons', b:'twins' },
  peepal:{ name:'The Sun', b:'sun' }, smallbarn:{ name:'Launch tower', b:'launch' }, openbarn:{ name:'Moon cottage', b:'cottage' },
  pond:{ name:'Blue giant', b:'planet', key:'neptune', R:.34, h:.58 },
  orange1:{ name:'Rose giant', b:'giant', key:'rose', ring:true, R:.32, h:1.12 }, apple3:{ name:'Mint giant', b:'giant', key:'mint', R:.34, h:1.0 },
  berry2:{ name:'Twin moons', b:'twins', alt:true }, orange2:{ name:'Ringed giant', b:'giant', key:'saturn', ring:true, R:.33, h:1.1 },
  apple4:{ name:'Banded giant', b:'giant', key:'jupiter', R:.36, h:1.0 }
};
const PATH_V = { path3_4:0, path3_5:2, path1_2:1, path5_2:3, path3_0:4, path2_6:0, path3_6:3 };
const PATH_NAME = ['Star path', 'Asteroid trail', 'Stardust lane', 'Lamp lane', 'Crater garden'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') { const key = MOON[f.crop]; return { ...s, kind:'moon', crop:f.crop, key, name:MOON_NAME[key], stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'orb', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'orb', b:'belt', edge:f.edge, len:f.len, name:'Asteroid belt' };
  return { ...s, kind:'orb', ...MAP[f.id] };
});
const SUN_C = (() => { const s = SLOTS.find(x => x.id === 'peepal'), f = footprint(s); return new THREE.Vector3(f.cx, 0, f.cz); })();

/* ── the look: night-blue tiles with stars and faint nebula, a deep blue block ── */
const SOLAR_TILE = { top:['#E4E2FF','#DAD8F7'], side:'#2A2F66', soilTop:'#2B3068', soilBot:'#10132E' };
function solarTileMap(){
  return canvasTex(256, 256, (g, N) => { const r = rngFrom(28);
    g.fillStyle = '#39407F'; g.fillRect(0,0,N,N);
    for (let i=0;i<7;i++){ const x = r()*N, y = r()*N, rad = 30 + r()*50, gr = g.createRadialGradient(x,y,0,x,y,rad);
      gr.addColorStop(0, ['rgba(120,90,190,.35)','rgba(70,120,190,.3)','rgba(170,100,170,.22)'][i%3]); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0,0,N,N); }
    for (let i=0;i<150;i++){ g.fillStyle = 'rgba(255,255,255,'+(.25 + r()*.6)+')'; g.beginPath(); g.arc(r()*N, r()*N, .5 + r()*1.2, 0, 6.3); g.fill(); }
    for (let i=0;i<5;i++){ const x = 20 + r()*(N-40), y = 20 + r()*(N-40), s = 4 + r()*4; g.fillStyle = 'rgba(255,248,225,.95)'; g.beginPath();
      for (let k=0;k<8;k++){ const an = k*Math.PI/4, rr = k%2 ? s*.22 : s; g.lineTo(x + Math.cos(an)*rr, y + Math.sin(an)*rr); } g.fill(); } });
}

/* ── env: dotted orbit lines on the tiles, all circling the Sun's corner ── */
const ORBIT_MAT = new THREE.MeshBasicMaterial({ color:0xF6D98C, transparent:true, opacity:.5, depthWrite:false });
function buildEnv(){
  const env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const h = V.L/2 - .04, pos = [], y = TILE_TOP + .004, w = .018;
  for (const R of [1.55, 2.6, 3.65, 4.7, 5.75, 6.8]) {
    const step = .07/R, n = Math.ceil(Math.PI*2/step);
    for (let i=0;i<n;i++){ if (i % 3 === 2) continue;
      const a0 = i*step, a1 = a0 + step*.9;
      const p0 = [SUN_C.x + Math.cos(a0)*R, SUN_C.z + Math.sin(a0)*R], p1 = [SUN_C.x + Math.cos(a1)*R, SUN_C.z + Math.sin(a1)*R];
      if ([p0, p1].some(p => Math.abs(p[0]) > h || Math.abs(p[1]) > h)) continue;
      const nx = [Math.cos(a0)*w, Math.sin(a0)*w];
      pos.push(p0[0]-nx[0], y, p0[1]-nx[1], p0[0]+nx[0], y, p0[1]+nx[1], p1[0]+nx[0], y, p1[1]+nx[1],
               p0[0]-nx[0], y, p0[1]-nx[1], p1[0]+nx[0], y, p1[1]+nx[1], p1[0]-nx[0], y, p1[1]-nx[1]); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(geo, ORBIT_MAT); m.renderOrder = 1; m.material.side = THREE.DoubleSide; env.add(m);
  ORBIT_MAT.opacity = S.night ? .35 : .5;
}

/* decor: little craters, crystals and fallen stars on cells nothing will use; stardust on waiting cells */
function solarDecor(slots){
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
      if (pick < .4) { const cx = p.x + (r()-.5)*.2, cz = p.z + (r()-.5)*.2, rr = .1 + r()*.06;
        a.add(new THREE.TorusGeometry(rr, .022, 5, 18).rotateX(Math.PI/2).scale(1, .5, 1).translate(cx, TILE_TOP + .008, cz), MAT.rockL); }
      else if (pick < .7) a.add(new THREE.OctahedronGeometry(.05 + r()*.03, 0).scale(.7, 1.7, .7).translate(p.x + (r()-.5)*.3, TILE_TOP + .06, p.z + (r()-.5)*.3), r() < .5 ? MAT.crystal : MAT.crystalB);
      star(a, new THREE.Vector3(p.x + (r()-.5)*.5, TILE_TOP + .006, p.z + (r()-.5)*.5), .6 + r()*.4, r()*6, MAT.starL);
      rocks(a, 2, r, .4, TILE_TOP + .015, p.x, p.z, .025); a.into(grp); grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { rocks(a, 2, r, .4, TILE_TOP + .012, p.x, p.z, .02);
      a.add(new THREE.SphereGeometry(.014, 6, 4), MAT.starL, _m.makeTranslation(p.x + (r()-.5)*.6, TILE_TOP + .01, p.z + (r()-.5)*.6));
      a.into(grp); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else world.remove(grp);
  }
}

/* ══════════ life: planets turn, stars twinkle, a satellite circles; on completion comets, the rocket and satellites arrive ══════════ */
function makeSat(){ const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.BoxGeometry(.09, .09, .12), MAT.brass); a.add(new THREE.BoxGeometry(.3, .006, .08).translate(-.2, 0, 0), MAT.panel); a.add(new THREE.BoxGeometry(.3, .006, .08).translate(.2, 0, 0), MAT.panel);
  a.add(new THREE.SphereGeometry(.05, 12, 6, 0, Math.PI*2, 0, Math.PI/2).rotateX(Math.PI/2).translate(0, 0, .07), MAT.white);
  a.add(new THREE.SphereGeometry(.014, 8, 6).translate(0, .06, 0), MAT.beacon); a.into(g); return g; }
const COMET_COL = [0xBFE8FF, 0xFFE0B0, 0xE6D4FF];
function makeComet(i){ const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.IcosahedronGeometry(.08, 1), MAT.crystalB); a.into(g);
  glowSprite(g, new THREE.Vector3(), .55, COMET_COL[i%3], .9);
  const tail = []; for (let k=0;k<9;k++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:COMET_COL[i%3], transparent:true, opacity:.55*(1 - k/9), blending:THREE.AdditiveBlending, depthWrite:false }));
    s.scale.setScalar(.36*(1 - k/11)); s.renderOrder = 9; tail.push(s); }
  g.userData.tail = tail; return g; }
function orbitPos(u, t, out){ const a = t*u.sp + u.ph; return out.set(u.cx + Math.cos(a)*u.rx, TILE_TOP + u.h + Math.sin(a*1.3 + u.ph)*u.bob, u.cz + Math.sin(a)*u.rz); }
function addLife(kind, obj, u, resident){ const r = { kind, obj, u, arrive:1, resident }; world.add(obj); (V.res || (V.res = [])).push(r); V.life.push(obj);
  if (obj.userData.tail) obj.userData.tail.forEach(s => { world.add(s); V.life.push(s); }); return r; }
const _p = new THREE.Vector3(), _q2 = new THREE.Vector3();
function inScene(o){ while (o) { if (o.isScene) return true; o = o.parent; } return false; }
function moveLife(t){
  SPIN.forEach(m => { if (!inScene(m)) { SPIN.delete(m); return; } m.rotation.y = t*m.userData.spin + (m.userData.ph0 ?? (m.userData.ph0 = m.rotation.y)); });
  if (!V) return;
  (V.twinkles || []).forEach((s, i) => { const k = .5 + .5*Math.sin(t*2.2 + i*1.9); s.material.opacity = .25 + .7*k*k; });
  (V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'rocket') {
      if (r.arrive < 1) { const k = r.arrive; const lift = u.at.clone().setY(u.at.y + k*k*2.4), orb = orbitPos(u, t, _p.clone()); const b = Math.max(0, (k - .55)/.45);
        r.obj.position.lerpVectors(lift, orb, b*b*(3 - 2*b)); r.obj.rotation.set(0, 0, 0); r.obj.rotation.z = -b*1.2; }
      else { orbitPos(u, t, _p); orbitPos(u, t + .06, _q2); r.obj.position.copy(_p);
        const d = _q2.sub(_p).normalize(); r.obj.quaternion.setFromUnitVectors(_up, d); }
      const fl = r.obj.userData.flame; fl.visible = true; fl.scale.set(1, .8 + Math.sin(t*40)*.2, 1); return; }
    orbitPos(u, t, _p); if (e < 1) _p.lerpVectors(_p.clone().add(new THREE.Vector3(5, 3, -4)), _p.clone(), e);
    r.obj.position.copy(_p);
    if (r.kind === 'sat') { r.obj.rotation.y = t*.6 + u.ph; r.obj.rotation.x = .3; }
    if (r.kind === 'comet') { r.obj.userData.tail.forEach((s, k) => { orbitPos(u, t - (k + 1)*.07/Math.abs(u.sp)*.35, s.position); if (e < 1) s.position.lerpVectors(s.position.clone().add(new THREE.Vector3(5, 3, -4)), s.position.clone(), e); }); }
  });
}
let _t = 2.1;
function solarAmbient(){
  V.res = []; V.twinkles = [];
  const r = rngFrom(7), h = V.L/2;
  for (let i=0;i<5 + V.ring*3;i++){ const p = new THREE.Vector3((r()-.5)*V.L*1.2, TILE_TOP + .9 + r()*(1 + V.ring*.3), (r()-.5)*V.L*1.2);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.star, color:0xFFF1C8, transparent:true, opacity:.8, blending:THREE.AdditiveBlending, depthWrite:false }));
    s.position.copy(p); s.scale.setScalar(.14 + r()*.12); s.renderOrder = 9; world.add(s); V.twinkles.push(s); V.life.push(s); }
  const sat = makeSat(); addLife('sat', sat, { cx:0, cz:0, rx:h + .3, rz:h + .1, h:1.1 + V.ring*.15, sp:.35, ph:.9, bob:.08 }, false);
  moveLife(_t);
}
function residentPlan(){ const h = GRID/2;
  return {
    comets:[0,1,2].map(i => ({ cx:SUN_C.x*.4, cz:SUN_C.z*.4, rx:h + .4 + i*.35, rz:h*.7 + i*.3, h:1.7 + i*.35, sp:.32 - i*.05, ph:1.2 + i*2.1, bob:.25 })),
    rocket:{ at:cellPos(2, 0).add(new THREE.Vector3(.02, .07, -.02)), cx:0, cz:0, rx:h - .6, rz:h - .9, h:2.3, sp:.4, ph:3.6, bob:.15 },
    sats:[0,1].map(i => ({ cx:0, cz:0, rx:h - .2 + i*.5, rz:h - .5 + i*.4, h:1.4 + i*.5, sp:-.28 - i*.06, ph:i*3, bob:.06 }))
  };
}
function spawnGroup(i, plan){
  if (i === 0) return plan.comets.map((u, k) => addLife('comet', makeComet(k), u, true));
  if (i === 1) { const lt = V.pieces.smallbarn; if (lt) lt.children.filter(c => c.userData.flame).forEach(c => c.visible = false);
    const o = makeRocket(1.1); return [addLife('rocket', o, plan.rocket, true)]; }
  return plan.sats.map(u => { const o = makeSat(); o.scale.setScalar(1.3); return addLife('sat', o, u, true); });
}
async function solarMoveIn(walk){
  const plan = residentPlan(); V.residentsIn = true; V.res = V.res || [];
  for (let i=0;i<3;i++){
    const rs = spawnGroup(i, plan);
    if (!walk) { rs.forEach(r => r.arrive = 1); moveLife(_t); continue; }
    rs.forEach(r => r.arrive = 0); moveLife(_t);
    await new Promise(res => tween(S.rm ? 1 : (i === 1 ? 2600 : 1500), t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.08))),
      () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone(), 12, i === 1 ? 0xFFE0A8 : 0xE9F0FF, .6); res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = 3;
}
const RES_THUMB = { comet:() => { const c = makeComet(0); c.userData.tail.forEach((s, k) => { s.position.set(-(k + 1)*.09, (k + 1)*.03, 0); c.add(s); }); return c; },
  rocket:() => { const r = makeRocket(1); r.userData.flame.visible = true; r.rotation.z = -.5; return r; }, sat:() => { const s = makeSat(); s.rotation.set(.4, .6, 0); return s; } };

export default {
  id:'solar', name:'Solar system', title:'Your planets',
  season:28, dates:'26 Oct–8 Nov', nextIn:14,
  kits:['a'],                                 // kit a: a tree + flowers on the home planet and the moon cottage; everything else is procedural
  families:{
    water:   { label:'ocean & ice worlds',        tag:'World' },
    building:{ label:'observatories & stations',  tag:'Station' },
    path:    { label:'star paths & asteroid belts', tag:'Path' },
    crop:    { label:'moon bases',                tag:'Moon base' },
    tree:    { label:'ringed & banded giants',    tag:'Giant' },
    special: { label:'the Sun',                   tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:SOLAR_TILE, tileMap:solarTileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><ellipse cx="12" cy="12" rx="10" ry="5" fill="none" stroke="#C9A04A" stroke-width="1.3" stroke-dasharray="2 1.6" transform="rotate(-18 12 12)"/><circle cx="12" cy="12" r="4.4" fill="#FFB73A"/><circle cx="12" cy="12" r="2.6" fill="#FFD66A"/><circle cx="20.5" cy="8.6" r="2" fill="#5B8FE0"/><circle cx="4" cy="15.2" r="1.5" fill="#E99AC0"/></svg>',
  silhouette:'<g fill="currentColor"><circle cx="64" cy="58" r="20"/><path d="M64 26l4 10h-8zM64 90l4-10h-8zM32 58l10 4v-8zM96 58l-10 4v-8zM41 35l9 6-6 6zM87 81l-9-6 6-6zM87 35l-6 12-6-6zM41 81l6-12 6 6z"/><rect x="61" y="80" width="6" height="30"/><path d="M40 118c0-6 10-10 24-10s24 4 24 10z"/><circle cx="18" cy="30" r="8"/><circle cx="110" cy="92" r="10"/><ellipse cx="110" cy="92" rx="18" ry="4" fill="none" stroke="currentColor" stroke-width="3" transform="rotate(-18 110 92)"/><circle cx="104" cy="22" r="5"/></g>',
  album:{ image:'assets/solar/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E8E6F6)' },
  css:'.phone[data-theme="solar"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#ECEAF8 58%,#D8D5EE 100%)}',

  build(g, s, opt){
    if (s.kind === 'moon') {
      const a = new Acc(); stand(a, MY - MR*.92); a.into(g);
      planet(g, s.key, MR, 0, MY, 0, 0, 0);
      const host = new THREE.Group(); host.position.y = MY; g.add(host); g.userData.plants = host; g.userData.regrow = st => fillBase(host, s, st);
      fillBase(host, s, opt.stage ?? cropStage(s.id));
    } else B[s.b](g, s, opt);
  },
  scaleOf: () => 1,
  contact: s => !(s.kind === 'orb' && ['path','belt','sun','nebula'].includes(s.b)),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && s.v === 3),
  decor: solarDecor,
  env: buildEnv,
  ambient: solarAmbient,
  tick(t, dt){ _t = t; moveLife(t); },

  residents:[ { id:'comet', name:'Comets', n:3 }, { id:'rocket', name:'Little rocket', n:1 }, { id:'sat', name:'Satellites', n:2 } ],
  moveIn: solarMoveIn,
  residentThumb(d, thumbFor){ return thumbFor('solar:'+d.id, RES_THUMB[d.id], 168); },
  residentRig(d){ const obj = RES_THUMB[d.id](); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
