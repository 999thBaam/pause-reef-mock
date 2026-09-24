/* KERALA BACKWATERS (?theme=kerala) — a green-teal canal winds across a lush plot: it enters at the right edge, S-bends round
   the tharavad, runs down past a footbridge, turns left along row 5 and opens into a lagoon in the front-left corner, where the
   Gita hero (a chundan vallam snake boat with golden muthukuda umbrellas) floats. Paddy fields, coconut groves and red-tile
   houses fill the banks; kettuvallam houseboats with curved thatch roofs, Chinese fishing nets and a duck-herder's canoe sit on
   the water. Own 7×7 blueprint (rings 6 / 15 / 19). The canal ribbon (a Catmull-Rom curve through the canal cells), its banks and
   the lagoon are one env layer, clipped to the current ring. Each canal piece carries its own clipped slice of water (hidden in
   the ghost) so its pick card and sprite read as water.
   Everything is procedural flat-shaded three.js merged per material (Acc). Reused CC0 kit pieces only: jackfruit / mango trees
   (Quaternius Stylized Nature MegaKit, kit a) and grass tufts (Quaternius farm kit). Residents (a temple elephant + calf,
   white-throated kingfishers, a duck flotilla) are procedural. No idols, no text. No new asset files. */
import * as THREE from 'three';
import { rngFrom, TEX, addSway, world, grassTileMap } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, OFF, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, seg, blob, _up } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { addButterflies, flyButterflies } from '../engine/life.js';

/* ── textures ── */
function canvasTex(N, draw, wrap=true){ const c = document.createElement('canvas'); c.width = c.height = N; draw(c.getContext('2d'), N);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const roofTex = canvasTex(128, (g, N) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  for (let j=0;j<4;j++){ g.fillStyle = 'rgba(80,25,10,.34)'; g.fillRect(0, j*N/4, N, 4);
    for (let i=0;i<8;i++){ g.fillStyle = 'rgba(80,25,10,.16)'; g.fillRect(i*N/8 + (j%2 ? N/16 : 0), j*N/4, 3, N/4); }
    g.fillStyle = 'rgba(255,230,210,.18)'; g.fillRect(0, j*N/4 + 5, N, 6); } });
const latTex = canvasTex(128, (g, N) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N); const r = rngFrom(61);
  for (let j=0;j<4;j++) for (let i=0;i<3;i++){ const ox = j%2 ? N/6 : 0; g.strokeStyle = 'rgba(110,40,20,.32)'; g.lineWidth = 2; g.strokeRect(i*N/3 + ox, j*N/4, N/3, N/4); }
  for (let i=0;i<160;i++){ g.fillStyle = r() < .6 ? 'rgba(100,35,15,.22)' : 'rgba(255,220,190,.35)'; g.beginPath(); g.arc(r()*N, r()*N, .8 + r()*1.6, 0, 6.3); g.fill(); } });
const rippleTex = canvasTex(256, (g, N) => { const r = rngFrom(8); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  for (let i=0;i<60;i++){ const x = r()*N, y = r()*N, w = 10 + r()*28; g.strokeStyle = `rgba(255,255,255,${.3 + r()*.4})`; g.lineWidth = 1.4 + r()*1.4;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w/2, y - 3, x + w, y); g.stroke(); }
  for (let i=0;i<40;i++){ g.fillStyle = 'rgba(40,90,60,.10)'; g.beginPath(); g.arc(r()*N, r()*N, 4 + r()*10, 0, 6.3); g.fill(); } });
const frondTex = canvasTex(64, (g, N) => { g.clearRect(0, 0, N, N); g.lineCap = 'round';
  for (let i=0;i<22;i++){ const t = i/22, y = N - 4 - t*(N - 8), L = Math.sin(Math.PI*Math.min(1, t*1.1 + .08))*N*.46;
    g.strokeStyle = i%2 ? '#56A843' : '#47983A'; g.lineWidth = 3.2;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(N/2, y); g.lineTo(N/2 + s*L, y - L*.55); g.stroke(); } }
  g.strokeStyle = '#8A9A42'; g.lineWidth = 3; g.beginPath(); g.moveTo(N/2, N); g.lineTo(N/2, 2); g.stroke(); }, false);
const netTex = canvasTex(64, (g, N) => { g.clearRect(0, 0, N, N); g.strokeStyle = 'rgba(250,240,220,1)'; g.lineWidth = 2.4;
  for (let i=0;i<=6;i++){ const p = Math.min(N - 1.2, Math.max(1.2, i*N/6)); g.beginPath(); g.moveTo(p, 0); g.lineTo(p, N); g.moveTo(0, p); g.lineTo(N, p); g.stroke(); } }, false);
const coirTex = canvasTex(64, (g, N) => { g.clearRect(0, 0, N, N); const r = rngFrom(5);
  for (let i=0;i<40;i++){ g.strokeStyle = r() < .5 ? '#C7934F' : '#A8763E'; g.lineWidth = 1.5; const x = r()*N; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r()-.5)*6, N*(.7 + r()*.3)); g.stroke(); } }, false);

/* ── materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.86, metalness:0, flatShading:true, ...o });
const MAT = {
  lat:FM(0xC8693F, { map:latTex, roughness:1 }), latD:FM(0x9E4B2C, { roughness:1 }), latL:FM(0xD98E62, { map:latTex, roughness:1 }),
  roof:FM(0xC2503A, { map:roofTex, side:THREE.DoubleSide }), roofD:FM(0x8C3322, { side:THREE.DoubleSide }),
  white:FM(0xF7F2E6), cream:FM(0xEFE0C0), yellow:FM(0xF1D27E), blue:FM(0x9CCBE3), mint:FM(0xB4DEC0), peach:FM(0xF4C6A6),
  wood:FM(0x7A4A2A), woodD:FM(0x4A2C18), woodL:FM(0xAE7A4A), bamboo:FM(0xC9A263), rope:FM(0xD9BE8A),
  thatch:FM(0xCFA85E, { side:THREE.DoubleSide }), thatchD:FM(0xA88242, { side:THREE.DoubleSide }), weave:FM(0xE0C184), hull:FM(0x2E2723, { side:THREE.DoubleSide }), hullB:FM(0x6E4527, { side:THREE.DoubleSide }),
  gold:FM(0xF0BE45, { emissive:0x6A4600, emissiveIntensity:.35, roughness:.4, metalness:.3 }), brass:FM(0xE0B04A, { roughness:.38, metalness:.3 }),
  glow:FM(0xFFD48C, { emissive:0xFF9A3C, emissiveIntensity:1.0 }), win:FM(0x3B2A20), shutG:FM(0x3F8A62), shutB:FM(0x3E6FA8),
  red:FM(0xCC3A34, { side:THREE.DoubleSide }), redD:FM(0x9E2A26), cloth:FM(0xF7F4EA, { side:THREE.DoubleSide }), clothY:FM(0xF4C63A, { side:THREE.DoubleSide }), clothG:FM(0x3FAE7A, { side:THREE.DoubleSide }),
  leaf:FM(0x4E9A3A), leafD:FM(0x357A2C), leafL:FM(0x79B84A), trunk:FM(0x8E6E4C), trunkD:FM(0x6E5236),
  coco:FM(0x8FA83A), cocoB:FM(0x7A5530), jack:FM(0xA8B43E), hib:FM(0xE3303E), hibY:FM(0xF7C62E),
  lotus:FM(0xF6A6C4), lotusD:FM(0xE77AA4), pad:FM(0x5FA844), reed:FM(0x6E9E3A),
  mud:FM(0x6E4E30, { roughness:1 }), bund:FM(0x78A646, { roughness:1 }), stone:FM(0xA9A39A), iron:FM(0x4A4E58, { roughness:.5, metalness:.3 }),
  skin:FM(0x8A5A3A), black:FM(0x2A2320), coir:FM(0xC7934F), husk:FM(0x9A6A3A), clay:FM(0xC4683A), steel:FM(0xC9CED6, { roughness:.35, metalness:.5 }),
  ele:FM(0x8E8993), eleD:FM(0x746F7A), eleP:FM(0xD8A7A5), tusk:FM(0xF4EEDF),
  duck:FM(0xFBF8F0), bill:FM(0xF29A38), kfBlue:FM(0x1F8FD6), kfBrown:FM(0x7A3B1E), kfWhite:FM(0xFFFFFF), kfBill:FM(0xE0302A)
};
const WATER = new THREE.MeshStandardMaterial({ color:0x4FA48F, roughness:.14, metalness:0, emissive:0x10392F, emissiveIntensity:.35, map:rippleTex, side:THREE.DoubleSide });
const WATER_SIDE = new THREE.MeshStandardMaterial({ color:0x4C9A89, roughness:.2, emissive:0x10392F, emissiveIntensity:.3 });
const PATCH = new THREE.MeshStandardMaterial({ color:0x4FA48F, roughness:.14, metalness:0, emissive:0x10392F, emissiveIntensity:.35, map:rippleTex, side:THREE.DoubleSide,
  polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-4 });
const BANK = FM(0x8C6B43, { roughness:1 });
const PADDY_W = new THREE.MeshStandardMaterial({ color:0x9CCFBE, roughness:.2, emissive:0x10392F, emissiveIntensity:.2, map:rippleTex });
const NET = new THREE.MeshStandardMaterial({ color:0xFFFFFF, map:netTex, alphaTest:.4, side:THREE.DoubleSide, roughness:.9 });
const COIR = new THREE.MeshStandardMaterial({ color:0xFFFFFF, map:coirTex, alphaTest:.4, side:THREE.DoubleSide, roughness:1 });
const FLAME = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ color:0xFFD36A, emissive:0xFF9A1F, emissiveIntensity:1.7, roughness:.6 }));
const GLOW = [0, 1, 2].map(() => new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFB450, transparent:true, opacity:.55, blending:THREE.AdditiveBlending, depthWrite:false }));
const SWAYM = {}; function swayMat(hex, h, amp, o = {}){ const k = hex+':'+h+':'+amp+':'+(o.map ? 'm' : ''); if (SWAYM[k]) return SWAYM[k];
  const m = FM(hex, { side:THREE.DoubleSide, ...o }); addSway(m, h, amp); return SWAYM[k] = m; }
const FROND = h => swayMat(0xFFFFFF, h, .03, { map:frondTex, alphaTest:.45 });

/* ── helpers ── */
const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const atY = (x, y, z, ry, rx, s=1) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, 0, 'YXZ')), new THREE.Vector3(s, s, s));
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=12){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z)); }
function glowAt(parent, x, y, z, s, k=0){ const sp = new THREE.Sprite(GLOW[k % 3]); sp.position.set(x, y, z); sp.scale.setScalar(s); sp.renderOrder = 9; parent.add(sp); return sp; }
/* rotate a local (u along the piece's own x, v along z) into the piece frame */
const rot2 = (u, v, ry) => [u*Math.cos(ry) + v*Math.sin(ry), -u*Math.sin(ry) + v*Math.cos(ry)];

/* Kerala hip roof: base W×D at y=0, top edge tw×td at H (td = 0 → a ridge). Winds outward, UVs give tile courses. */
function hipGeo(W, D, H, tw, td){
  const b = [[-W/2,0,D/2],[W/2,0,D/2],[W/2,0,-D/2],[-W/2,0,-D/2]], t = [[-tw/2,H,td/2],[tw/2,H,td/2],[tw/2,H,-td/2],[-tw/2,H,-td/2]];
  const pos = [], uv = [], U = (p, i) => [(i%2 ? p[2] : p[0])*2.2, p[1]*4.2];
  for (let i=0;i<4;i++){ const j = (i+1)%4, tri = [b[i], b[j], t[j], b[i], t[j], t[i]];
    tri.forEach(p => { pos.push(...p); uv.push(...U(p, i)); }); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); return g;
}
/* roof + ridge cap + the little wooden gablets (mukhappu) at the ridge ends. ry turns it; y = eave height */
function keralaRoof(a, W, D, H, y, x=0, z=0, ry=0, ridge=.4){
  const tw = W*ridge;
  a.add(hipGeo(W, D, H, tw, 0), MAT.roof, at(x, y, z, ry));
  a.add(bx(tw + .05, .026, .034), MAT.roofD, at(x, y + H + .004, z, ry));
  const tri = new THREE.Shape(); tri.moveTo(-D*.13, 0); tri.lineTo(D*.13, 0); tri.lineTo(0, H*.32); tri.lineTo(-D*.13, 0);
  const tg = new THREE.ExtrudeGeometry(tri, { depth:.012, bevelEnabled:false });
  for (const s of [-1, 1]) { const xo = s*(tw/2 + (W - tw)/2*.3), [dx, dz] = rot2(xo, 0, ry);
    a.add(tg, MAT.woodD, at(x + dx, y + H*.66, z + dz, ry + Math.PI/2 + (s < 0 ? Math.PI : 0), 1, 1, 1, 0, 0));
    const [fx, fz] = rot2(s*(tw/2 + .02), 0, ry); a.add(new THREE.ConeGeometry(.012, .07, 5), MAT.roofD, at(x + fx, y + H + .03, z + fz, 0, 1, 1, 1, 0, -s*.5)); }
}
function diya(acc, x, y, z, s=1, parent=null, glow=0, k=0){
  acc.add(new THREE.CylinderGeometry(.03*s, .02*s, .02*s, 8), MAT.clay, at(x, y + .01*s, z));
  acc.add(new THREE.SphereGeometry(.014*s, 6, 5), FLAME[k % 3], at(x, y + .032*s, z, 0, 1, 1.9, 1));
  if (parent && glow) glowAt(parent, x, y + .035*s, z, glow, k);
}
/* nilavilakku: a tall brass household lamp (no idol) */
function brassLamp(acc, x, y, z, s=1, parent=null){
  cyl(acc, MAT.brass, .05*s, .035*s, .02*s, x, y, z, 10); seg(acc, MAT.brass, V3(x, y + .02*s, z), _up, .2*s, .01*s, .008*s, 6);
  acc.add(new THREE.CylinderGeometry(.045*s, .02*s, .025*s, 10), MAT.brass, at(x, y + .22*s, z));
  for (let k=0;k<5;k++){ const ang = k/5*6.28; acc.add(new THREE.SphereGeometry(.011*s, 5, 4), FLAME[k % 3], at(x + Math.cos(ang)*.035*s, y + .245*s, z + Math.sin(ang)*.035*s, 0, 1, 1.9, 1)); }
  if (parent) glowAt(parent, x, y + .25*s, z, .32*s, 1);
}
function hibiscus(acc, x, y, z, s=1, rng){ blob(acc, MAT.leafD, V3(x, y + .06*s, z), .08*s, .9, 0, rng); blob(acc, MAT.leaf, V3(x + .02*s, y + .1*s, z - .01), .055*s, .9, 0, rng);
  for (let k=0;k<4;k++){ const ang = k*1.7; acc.add(new THREE.IcosahedronGeometry(.018*s, 0), k%3 ? MAT.hib : MAT.hibY, at(x + Math.cos(ang)*.06*s, y + (.09 + (k%2)*.04)*s, z + Math.sin(ang)*.06*s)); } }
function pot(acc, x, y, z, s=1, mat=MAT.clay){ acc.add(new THREE.SphereGeometry(.06*s, 9, 6), mat, at(x, y + .055*s, z, 0, 1, .85, 1)); acc.add(new THREE.CylinderGeometry(.03*s, .038*s, .03*s, 9), mat, at(x, y + .11*s, z)); }

/* ── the canal: a Catmull-Rom centreline through the canal cells, ending in the lagoon (front-left corner) ── */
const CANAL = [[6,1],[5,1],[5,2],[4,2],[4,3],[4,4],[4,5],[3,5],[2,5]];
const CANAL_SET = new Set([...CANAL.map(([x,z]) => x+','+z), '1,5']);
const LAGOON = { x0:0, z0:5, cx:.5 - OFF, cz:5.5 - OFF };
const CURVE = new THREE.CatmullRomCurve3([[7.4,1],...CANAL,[1.25,5.3],[.5,5.5]].map(([x,z]) => V3(x - OFF, 0, z - OFF)), false, 'centripetal');
const SAMPLES = CURVE.getSpacedPoints(700);
const HALF_W = .36, WATER_H = .02, WATER_Y = TILE_TOP + WATER_H;
function worldUV(geo, ox=0, oz=0){ const p = geo.attributes.position, uv = new Float32Array(p.count*2);
  for (let i=0;i<p.count;i++){ uv[i*2] = (p.getX(i) + ox)*.7; uv[i*2+1] = -(p.getZ(i) + oz)*.7; } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
/* a strip between lateral offsets w0..w1 of the centreline, clipped to the box b (world units), at height y */
function ribbonGeo(b, w0, w1, y){
  const P = SAMPLES, n = P.length, pos = [];
  const inside = p => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1;
  const cl = p => [Math.min(b.x1, Math.max(b.x0, p.x)), Math.min(b.z1, Math.max(b.z0, p.z))];
  let pl = null, pr = null;
  for (let i=0;i<n;i++){
    const ok = inside(P[i]) || (i > 0 && inside(P[i-1])) || (i < n-1 && inside(P[i+1]));
    if (!ok) { pl = pr = null; continue; }
    const A = P[Math.max(0, i-1)], C = P[Math.min(n-1, i+1)], tx = C.x - A.x, tz = C.z - A.z, tl = Math.hypot(tx, tz) || 1, nx = -tz/tl, nz = tx/tl;
    const L = cl(V3(P[i].x + nx*w0, 0, P[i].z + nz*w0)), R = cl(V3(P[i].x + nx*w1, 0, P[i].z + nz*w1));
    if (pl) pos.push(pl[0],y,pl[1], L[0],y,L[1], R[0],y,R[1], pl[0],y,pl[1], R[0],y,R[1], pr[0],y,pr[1]);
    pl = L; pr = R;
  }
  if (pos.length >= 9) { const ax = pos[3]-pos[0], az = pos[5]-pos[2], cx = pos[6]-pos[0], cz = pos[8]-pos[2];
    if (az*cx - ax*cz < 0) for (let i=0;i<pos.length;i+=9) for (let k=0;k<3;k++){ const t = pos[i+3+k]; pos[i+3+k] = pos[i+6+k]; pos[i+6+k] = t; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const nrm = new Float32Array(pos.length); for (let i=1;i<nrm.length;i+=3) nrm[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  worldUV(g); return g;
}
function lagoonGeo(size=1.72, r=.46){ const s = new THREE.Shape(), h = size/2;
  s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  return new THREE.ShapeGeometry(s, 6).rotateX(-Math.PI/2); }
/* a canal piece's own slice of water (cell-clipped ribbon, in the piece's local frame) */
function waterPatch(g, s){
  const c = cellPos(s.x, s.z), geo = ribbonGeo({ x0:c.x - .5, x1:c.x + .5, z0:c.z - .5, z1:c.z + .5 }, -HALF_W, HALF_W, 0);
  geo.translate(-c.x, WATER_H + .0005, -c.z); const m = new THREE.Mesh(geo, PATCH); m.receiveShadow = true; m.userData.ghostHide = true; g.add(m);
  const bk = ribbonGeo({ x0:c.x - .5, x1:c.x + .5, z0:c.z - .5, z1:c.z + .5 }, HALF_W - .02, HALF_W + .07, 0), bk2 = ribbonGeo({ x0:c.x - .5, x1:c.x + .5, z0:c.z - .5, z1:c.z + .5 }, -HALF_W + .02, -HALF_W - .07, 0);
  for (const bg of [bk, bk2]) { bg.translate(-c.x, WATER_H - .004, -c.z); const bm = new THREE.Mesh(bg, BANK); bm.receiveShadow = true; bm.userData.ghostHide = true; g.add(bm); }
}
function buildEnv(){
  const R = V.ring, h = R + .5, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const b = { x0:-h, x1:h, z0:-h, z1:h };
  const w = new THREE.Mesh(ribbonGeo(b, -HALF_W, HALF_W, WATER_Y), WATER); w.receiveShadow = true; env.add(w);
  for (const [w0, w1] of [[HALF_W - .02, HALF_W + .07], [-HALF_W + .02, -HALF_W - .07]]) { const m = new THREE.Mesh(ribbonGeo(b, w0, w1, WATER_Y - .004), BANK); m.receiveShadow = true; env.add(m); }
  if (R === 3) { const lg = lagoonGeo(); lg.translate(LAGOON.cx, WATER_Y, LAGOON.cz); worldUV(lg); const m = new THREE.Mesh(lg, WATER); m.receiveShadow = true; env.add(m);
    const rim = lagoonGeo(1.84, .5); rim.translate(LAGOON.cx, WATER_Y - .004, LAGOON.cz); env.add(new THREE.Mesh(rim, BANK)); }
  // where the canal leaves the block: its cross-section on the side face
  const P = SAMPLES, ins = p => Math.abs(p.x) <= h && Math.abs(p.z) <= h;
  for (let i=0;i<P.length-1;i++){ if (ins(P[i]) === ins(P[i+1])) continue; const p = ins(P[i]) ? P[i] : P[i+1];
    const face = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W*2 + .1, .3), WATER_SIDE);
    if (Math.abs(Math.abs(p.x) - h) < .05) { face.position.set(Math.sign(p.x)*(h + .021), WATER_Y - .15, p.z); face.rotation.y = Math.sign(p.x)*Math.PI/2; }
    else { face.position.set(p.x, WATER_Y - .15, Math.sign(p.z)*(h + .021)); face.rotation.y = p.z > 0 ? 0 : Math.PI; }
    env.add(face); }
  env.children.forEach(m => { if (m.isMesh) m.castShadow = false; });
}

/* ── buildings (Reading): tharavad, red-tile houses, tea stall, boat shed, coir shed, school ── */
function windowPair(a, face, half, us, y, lit, shut){
  for (const [u, l] of us.map((u, i) => [u, lit && i === 0])) {
    const m = l ? MAT.glow : MAT.win;
    if (face === 'z') { a.add(bx(.085, .1, .01), m, at(u, y + .05, half + .004)); a.add(bx(.03, .1, .012), shut, at(u - .058, y + .05, half + .006)); a.add(bx(.03, .1, .012), shut, at(u + .058, y + .05, half + .006)); }
    else { a.add(bx(.01, .1, .085), m, at(half + .004, y + .05, u)); a.add(bx(.012, .1, .03), shut, at(half + .006, y + .05, u - .058)); a.add(bx(.012, .1, .03), shut, at(half + .006, y + .05, u + .058)); }
  }
}
function house(g, s){
  const a = new Acc(), o = s.o || {}, W = o.w || .6, D = o.d || .46, H = .3, wall = MAT[o.wall || 'white'], sh = MAT[o.shut || 'shutG'], r = rngFrom(s.x*7 + s.z*13);
  slab(a, MAT.lat, W + .16, .07, D + .26, 0, 0, .04);
  slab(a, wall, W, H, D, 0, .07, -.04); slab(a, MAT.latD, W + .006, .05, D + .006, 0, .07, -.04);
  for (const x of [-W/2 + .02, -W/6, W/6, W/2 - .02]) seg(a, MAT.woodD, V3(x, .07, D/2 + .08), _up, H + .03, .016, .016, 6);
  slab(a, MAT.woodL, W + .02, .035, .02, 0, .07 + H - .005, D/2 + .08);
  slab(a, MAT.woodD, .14, .21, .012, -.12, .07, D/2 - .04 + .004);
  windowPair(a, 'z', D/2 - .04, [.14], .16, (o.seed||0) % 2 === 0, sh); windowPair(a, 'x', W/2, [-.1, .1], .16, (o.seed||0) % 2 === 1, sh);
  keralaRoof(a, W + .26, D + .38, .34, .07 + H, 0, .0, 0, .42);
  pot(a, W/2 + .02, .07, D/2 + .08, .6); hibiscus(a, -W/2 - .02, .0, D/2 + .15, .8, r);
  if (o.line) { seg(a, MAT.bamboo, V3(W/2 + .06, .07, -.2), _up, .3, .007, .007, 4); seg(a, MAT.bamboo, V3(W/2 + .06, .07, .15), _up, .3, .007, .007, 4);
    [MAT.cloth, MAT.clothY, MAT.red].forEach((m, i) => a.add(new THREE.PlaneGeometry(.08, .1), m, at(W/2 + .06, .31, -.13 + i*.1, Math.PI/2))); }
  diya(a, -.12 + .1, .07, D/2 + .14, .8, g, .16);
  a.into(g);
}
function tharavad(g){
  const a = new Acc(), r = rngFrom(301);
  // laterite courtyard platform + a kadavu (bathing steps) down to the canal on the +x edge
  slab(a, MAT.lat, 1.6, .06, 1.5, -.12, 0, -.06);
  for (let i=0;i<3;i++) slab(a, i%2 ? MAT.latL : MAT.lat, .08, .06 - i*.018, .5, .72 + i*.08, 0, -.45);
  // main house: laterite plinth, white walls, dark wooden front, veranda posts, two-tier roof
  const W = 1.02, D = .7, H = .34, X = -.2, Z = -.28;
  slab(a, MAT.latD, W + .12, .08, D + .3, X, .06, Z + .06);
  slab(a, MAT.white, W, H, D, X, .14, Z); slab(a, MAT.woodD, W*.5, H - .02, .012, X, .14, Z + D/2 + .004);
  for (let i=0;i<5;i++) slab(a, MAT.wood, .02, H - .04, .014, X - W*.22 + i*W*.11, .16, Z + D/2 + .01);
  slab(a, MAT.woodD, .14, .22, .014, X + .02, .14, Z + D/2 + .012);
  windowPair(a, 'z', Z + D/2, [X - .38, X + .38], .22, true, MAT.shutG);
  windowPair(a, 'x', X + W/2, [Z - .15, Z + .15], .22, false, MAT.shutG);
  for (let i=0;i<6;i++) seg(a, MAT.woodD, V3(X - W/2 + .04 + i*(W - .08)/5, .14, Z + D/2 + .12), _up, H + .04, .02, .02, 8);
  slab(a, MAT.woodL, W + .04, .04, .03, X, .14 + H, Z + D/2 + .12);
  const y1 = .14 + H + .02;
  a.add(hipGeo(W + .34, D + .46, .2, W*.78, D*.5), MAT.roof, at(X, y1, Z + .04));
  slab(a, MAT.woodD, W*.78 - .02, .09, D*.5 - .02, X, y1 + .2, Z + .04);
  for (let i=0;i<9;i++) slab(a, MAT.woodL, .012, .07, .012, X - W*.36 + i*W*.09, y1 + .21, Z + .04 + D*.25);
  keralaRoof(a, W*.9, D*.66, .32, y1 + .28, X, Z + .04, 0, .36);
  // padippura gatehouse at the front-left corner
  const gx = -.62, gz = .6;
  slab(a, MAT.lat, .36, .06, .3, gx, .06, gz);
  for (const [px, pz] of [[-.13,-.1],[.13,-.1],[-.13,.1],[.13,.1]]) seg(a, MAT.woodD, V3(gx + px, .12, gz + pz), _up, .22, .016, .016, 6);
  keralaRoof(a, .46, .4, .2, .34, gx, gz, 0, .35);
  // brass lamps on the veranda steps, hibiscus, a palm behind the house, pots
  brassLamp(a, X - .3, .14, Z + D/2 + .24, 1, g); brassLamp(a, X + .3, .14, Z + D/2 + .24, 1, g);
  hibiscus(a, .5, .06, .45, 1, r); hibiscus(a, .25, .06, .62, .8, r);
  pot(a, .55, .06, -.05, .8, MAT.brass); pot(a, .45, .06, .08, .7);
  const la = new Acc(); palm(a, la, .62, -.72, 1.35, .22, -2.2, r); la.into(g);
  a.into(g);
}
function teaStall(g){
  const a = new Acc(), r = rngFrom(77);
  slab(a, MAT.lat, .74, .05, .7);
  for (const [px, pz] of [[-.3,-.26],[.3,-.26],[-.3,.26],[.3,.26]]) seg(a, MAT.woodD, V3(px, .05, pz), _up, .36, .016, .016, 6);
  keralaRoof(a, .8, .74, .24, .41, 0, 0, 0, .4);
  slab(a, MAT.woodL, .56, .16, .16, 0, .05, -.14); slab(a, MAT.wood, .6, .02, .2, 0, .21, -.14);
  for (let i=0;i<4;i++) { const x = -.2 + i*.13; cyl(a, MAT.steel, .035, .035, .08, x, .23, -.16, 10); cyl(a, MAT.woodD, .036, .036, .012, x, .31, -.16, 10); }
  cyl(a, MAT.steel, .05, .045, .08, .18, .23, -.08, 10); seg(a, MAT.steel, V3(.23, .28, -.08), V3(1, .4, 0), .06, .008, .006, 4);
  // banana bunch hanging from the eave
  seg(a, MAT.rope, V3(-.22, .32, .18), V3(0, -1, 0), .06, .004, .004, 3);
  for (let i=0;i<9;i++){ const ang = i/9*6.28, yy = .2 + (i%3)*.03; a.add(new THREE.CapsuleGeometry(.011, .04, 2, 5), MAT.hibY, at(-.22 + Math.cos(ang)*.025, yy, .18 + Math.sin(ang)*.025, 0, 1, 1, 1, Math.cos(ang)*.5, Math.sin(ang)*.5)); }
  slab(a, MAT.wood, .44, .03, .1, 0, .12, .24); for (const x of [-.18, .18]) slab(a, MAT.woodD, .03, .12, .08, x, .0, .24);
  hibiscus(a, .3, .05, .3, .7, r); diya(a, .12, .23, -.08, .8, g, .15);
  a.into(g);
}
function boatShed(g){
  const a = new Acc();
  slab(a, MAT.lat, .8, .04, .8);
  for (const x of [-.32, .32]) for (const z of [-.3, .3]) seg(a, MAT.woodD, V3(x, .04, z), _up, .34, .016, .016, 6);
  keralaRoof(a, .84, .86, .26, .38, 0, 0, Math.PI/2, .5);
  // a half-built vallam: keel, ribs, a few planks
  seg(a, MAT.woodL, V3(-.02, .07, -.34), V3(0, 0, 1), .68, .012, .012, 4);
  for (let i=0;i<7;i++){ const z = -.28 + i*.093, w = .1*Math.sin(Math.PI*(i + .5)/7) + .03;
    a.add(new THREE.TorusGeometry(w, .008, 4, 10, Math.PI), MAT.woodL, at(-.02, .12, z, 0, 1, 1, 1, Math.PI)); }
  for (const s of [-1, 1]) a.add(bx(.012, .04, .5), MAT.wood, at(-.02 + s*.1, .09, 0, 0, 1, 1, 1, 0, s*.5));
  for (let i=0;i<4;i++) slab(a, i%2 ? MAT.woodL : MAT.wood, .5, .02, .06, .1, .04 + i*.02, .34);
  slab(a, MAT.woodD, .08, .1, .08, .3, .04, -.2); seg(a, MAT.iron, V3(.28, .14, -.2), V3(1, 1, 0), .06, .005, .005, 4);
  a.into(g);
}
function coirShed(g){
  const a = new Acc(), r = rngFrom(88);
  slab(a, MAT.lat, .8, .04, .8);
  for (const [px, pz] of [[-.3,-.3],[.3,-.3],[-.3,.08],[.3,.08]]) seg(a, MAT.woodD, V3(px, .04, pz), _up, .32, .016, .016, 6);
  keralaRoof(a, .76, .56, .22, .36, 0, -.11, 0, .4);
  for (let i=0;i<14;i++) blob(a, i%2 ? MAT.husk : MAT.coir, V3(-.2 + (r()-.5)*.28, .06 + (i%3)*.04, -.1 + (r()-.5)*.25), .05, .8, 0, r);
  for (let i=0;i<3;i++){ const x = .06 + i*.1; a.add(new THREE.CylinderGeometry(.045, .045, .07, 10), MAT.coir, at(x, .085, .28, 0, 1, 1, 1, Math.PI/2)); a.add(new THREE.CylinderGeometry(.018, .018, .075, 6), MAT.woodD, at(x, .085, .28, 0, 1, 1, 1, Math.PI/2)); }
  slab(a, MAT.woodL, .06, .2, .06, .3, .04, .3); seg(a, MAT.coir, V3(.3, .2, .3), V3(-1, -.2, -.3), .4, .006, .006, 4);
  a.into(g);
}
function school(g){
  const a = new Acc(), W = .72, D = .44, H = .32, r = rngFrom(66);
  slab(a, MAT.lat, W + .12, .06, D + .3, 0, 0, .05);
  slab(a, MAT.yellow, W, H, D, 0, .06, -.05); slab(a, MAT.latD, W + .006, .06, D + .006, 0, .06, -.05);
  for (let i=0;i<5;i++) seg(a, MAT.white, V3(-W/2 + .04 + i*(W - .08)/4, .06, D/2 + .08), _up, H + .03, .018, .018, 6);
  windowPair(a, 'z', D/2 - .05, [-.22, .22], .15, true, MAT.shutB); slab(a, MAT.woodD, .14, .22, .012, 0, .06, D/2 - .05 + .004);
  windowPair(a, 'x', W/2, [-.1, .1], .15, false, MAT.shutB);
  keralaRoof(a, W + .24, D + .4, .3, .06 + H + .02, 0, .0, 0, .5);
  // bell on a post + a slate board (blank)
  seg(a, MAT.woodD, V3(W/2 + .04, .06, D/2 + .14), _up, .34, .012, .012, 5); a.add(new THREE.CylinderGeometry(.02, .04, .05, 10, 1, true), MAT.brass, at(W/2 + .04, .37, D/2 + .14));
  slab(a, MAT.black, .16, .1, .01, -W/2 + .02, .2, D/2 - .045);
  hibiscus(a, -W/2 - .02, 0, D/2 + .16, .7, r);
  a.into(g);
}

/* ── water (Breathe): houseboats, Chinese fishing nets, duck-herder's canoe, lotus pads, laterite well ── */
function hullGeo(len, beam, depth){
  const gm = new THREE.CylinderGeometry(beam, beam, len, 12, 8, false, 0, Math.PI).rotateZ(-Math.PI/2), p = gm.attributes.position;
  for (let i=0;i<p.count;i++){ const x = p.getX(i), t = Math.min(1, Math.abs(x)/(len/2)); let y = p.getY(i), z = p.getZ(i);
    z *= 1 - Math.pow(t, 2.2)*.9; y = y*(depth/beam)*(1 - t*t*.5) + t*t*t*.09; p.setXYZ(i, x, y, z); }
  gm.computeVertexNormals(); return gm;
}
const HB_HULL = hullGeo(.9, .16, .1), CANOE = hullGeo(.52, .08, .05);
function houseboat(g, s){
  waterPatch(g, s);
  const a = new Acc(), host = new THREE.Group(); host.rotation.y = s.rot || 0; host.scale.setScalar(1.1); g.add(host);
  const L = .9, Y = -.02;
  a.add(HB_HULL, MAT.hullB, at(0, Y + .1, 0)); a.add(bx(L*.78, .014, .27), MAT.woodL, at(0, Y + .1, 0));
  // cabin: woven bamboo walls with windows; curved thatch roof over two bays with bamboo ribs
  const cy = Y + .107, cx0 = -.26, cx1 = .2, CH = .1;
  slab(a, MAT.weave, cx1 - cx0, CH, .24, (cx0 + cx1)/2, cy);
  for (let i=0;i<4;i++){ const x = cx0 + .06 + i*.11; for (const zs of [-1, 1]) a.add(bx(.06, .05, .006), i === 1 || i === 2 ? MAT.glow : MAT.win, at(x, cy + .055, zs*.123)); }
  const arch = (x0, x1, r, y, sy) => { const len = x1 - x0;
    a.add(new THREE.CylinderGeometry(r, r, len, 14, 1, true, 0, Math.PI).rotateZ(Math.PI/2), MAT.thatch, at((x0 + x1)/2, y, 0, 0, 1, sy, 1));
    for (let i=0;i<=Math.round(len/.07);i++) a.add(new THREE.TorusGeometry(r + .004, .005, 4, 12, Math.PI), MAT.thatchD, at(x0 + i*len/Math.round(len/.07), y, 0, Math.PI/2, 1, sy, 1)); };
  arch(cx0 - .02, cx1 + .02, .15, cy + CH, .9);
  arch(cx1 + .02, cx1 + .16, .13, cy + CH - .01, .8);
  for (const zs of [-1, 1]) seg(a, MAT.bamboo, V3(cx1 + .15, cy, zs*.11), _up, CH, .006, .006, 4);
  // open bow deck: two cane chairs; stern: steering post; a punting pole along the roof
  for (const zs of [-1, 1]) { slab(a, MAT.woodL, .06, .03, .06, .34, cy, zs*.05); slab(a, MAT.woodL, .012, .05, .06, .31, cy + .03, zs*.05); }
  seg(a, MAT.woodD, V3(-.34, cy, 0), _up, .1, .008, .008, 5);
  seg(a, MAT.bamboo, V3(-.3, cy + CH + .13, -.04), V3(1, .05, 0), .6, .006, .006, 4);
  diya(a, .38, cy, .09, .8, host, .15);
  a.into(host);
}
/* Chinese fishing net on a corner cell: the pivot stands on the land corner (−x,−z), the net swings out over the water (+x,+z) */
function chineseNet(g, s){
  waterPatch(g, s);
  const a = new Acc(), r = rngFrom(s.x*17 + s.z);
  const P = V3(-.3, .09, -.3);
  slab(a, MAT.lat, .3, .06, .3, -.33, 0, -.33); slab(a, MAT.woodL, .26, .02, .26, -.33, .06, -.33);
  const N = V3(.15, .16, .15), T = V3(.0, .8, .0), perp = V3(1, 0, -1).normalize();
  // A-frame boom (two poles) + a back counter-pole
  for (const s2 of [-1, 1]) { const b = P.clone().addScaledVector(perp, s2*.05), d = T.clone().sub(b); seg(a, MAT.bamboo, b, d, d.length(), .011, .008, 5); }
  const back = V3(-.46, .5, -.46); seg(a, MAT.bamboo, P, back.clone().sub(P), back.distanceTo(P), .01, .008, 5);
  seg(a, MAT.rope, T, back.clone().sub(T), back.distanceTo(T), .003, .003, 3);
  for (let i=0;i<4;i++){ const q = P.clone().lerp(back, .35 + i*.15); seg(a, MAT.rope, q, V3(0, -1, 0), .08 + i*.02, .003, .003, 3); blob(a, MAT.stone, q.clone().setY(q.y - .1 - i*.02), .03, .8, 0, r); }
  // four spars from the tip to the net corners, bowed
  const cs = [[-.24, -.24], [.24, -.24], [.24, .24], [-.24, .24]].map(([u, v]) => V3(N.x + u, N.y, N.z + v));
  for (const c of cs) { const out = c.clone().sub(N).normalize(), m1 = T.clone().lerp(c, .35), m2 = T.clone().lerp(c, .72);
    m1.addScaledVector(out, .1); m1.y += .08; m2.addScaledVector(out, .1); m2.y += .06;
    a.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([T, m1, m2, c]), 14, .007, 4), MAT.bamboo); }
  a.into(g);
  const ng = new THREE.PlaneGeometry(.48, .48, 8, 8).rotateX(-Math.PI/2), p = ng.attributes.position;
  for (let i=0;i<p.count;i++){ const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z)/.34; p.setY(i, -Math.max(0, 1 - d*d)*.15); }
  ng.computeVertexNormals(); const net = new THREE.Mesh(ng, NET); net.position.copy(N); net.castShadow = true; g.add(net);
  const lamp = new Acc(); seg(lamp, MAT.rope, T, V3(0, -1, 0), .06, .002, .002, 3); lamp.add(new THREE.OctahedronGeometry(.024, 0), MAT.glow, at(T.x, T.y - .08, T.z, 0, 1, 1.3, 1)); lamp.into(g);
  glowAt(g, T.x, T.y - .08, T.z, .22, 2);
  g.userData.tip = T.clone();
}
function duckCanoe(g, s){
  waterPatch(g, s);
  const a = new Acc(), host = new THREE.Group(); host.rotation.y = Math.PI/4; g.add(host); const r = rngFrom(41);
  a.add(CANOE, MAT.hull, at(0, .03, 0)); a.add(bx(.36, .01, .1), MAT.woodL, at(0, .03, 0));
  a.add(new THREE.CylinderGeometry(.022, .03, .07, 8), MAT.cloth, at(-.08, .065, 0)); a.add(new THREE.SphereGeometry(.022, 8, 6), MAT.skin, at(-.08, .12, 0));
  a.add(new THREE.ConeGeometry(.06, .035, 10), MAT.thatch, at(-.08, .15, 0));
  seg(a, MAT.bamboo, V3(-.06, .07, .01), V3(.8, .9, .1), .5, .006, .005, 4);
  a.into(host);
  const d = new Acc(); for (let i=0;i<8;i++){ const ang = i*.8 + r()*.3, rad = .16 + (i%3)*.07, x = .1 + Math.cos(ang)*rad*.8, z = Math.sin(ang)*rad*.5; duckInto(d, x, WATER_H, z, ang + Math.PI/2, .75); } d.into(host);
}
function duckInto(a, x, y, z, ry, s=1){
  a.add(new THREE.SphereGeometry(.035*s, 8, 6), MAT.duck, at(x, y + .02*s, z, ry, .8, .6, 1.25));
  const [hx, hz] = rot2(0, .035*s, ry); a.add(new THREE.SphereGeometry(.02*s, 7, 5), MAT.duck, at(x + hx, y + .055*s, z + hz));
  const [bxx, bzz] = rot2(0, .058*s, ry); a.add(new THREE.ConeGeometry(.008*s, .022*s, 5), MAT.bill, at(x + bxx, y + .052*s, z + bzz, ry, 1, 1, 1, Math.PI/2));
  const [tx, tz] = rot2(0, -.045*s, ry); a.add(new THREE.ConeGeometry(.012*s, .03*s, 4), MAT.duck, at(x + tx, y + .035*s, z + tz, ry, 1, 1, 1, -Math.PI/2 - .5));
}
function lotusPads(g, s){
  waterPatch(g, s);
  const a = new Acc(), r = rngFrom(s.x*3 + s.z*29);
  const spots = [[-.1,-.28],[.12,-.05],[-.25,-.02],[.02,.18],[-.12,.08],[.2,-.22],[-.3,-.22]];
  spots.forEach(([x, z], i) => { const rr = .05 + r()*.03;
    a.add(new THREE.CylinderGeometry(rr, rr, .006, 12, 1, false, 0, Math.PI*1.85), MAT.pad, at(x, WATER_H + .004, z, r()*6));
    if (i % 2 === 0) { for (let k=0;k<8;k++){ const ang = k/8*Math.PI*2; a.add(new THREE.SphereGeometry(.018, 6, 4), k%2 ? MAT.lotus : MAT.lotusD, at(x + Math.cos(ang)*.016, WATER_H + .03, z + Math.sin(ang)*.016, -ang, .6, 1.6, .8, 0, .5)); }
      a.add(new THREE.SphereGeometry(.012, 6, 4), MAT.hibY, at(x, WATER_H + .03, z)); } });
  for (let i=0;i<9;i++){ const x = .3 + (r()-.5)*.14, z = .3 + (r()-.5)*.14; seg(a, MAT.reed, V3(x, 0, z), V3((r()-.5)*.3, 1, (r()-.5)*.3), .16 + r()*.1, .008, .003, 3); }
  // an egret standing in the shallows
  const ex = -.36, ez = .3; a.add(new THREE.SphereGeometry(.03, 8, 6), MAT.duck, at(ex, .15, ez, .6, .8, .75, 1.4)); seg(a, MAT.duck, V3(ex + .01, .16, ez + .02), V3(.2, 1, .3), .07, .008, .007, 4);
  a.add(new THREE.SphereGeometry(.014, 6, 5), MAT.duck, at(ex + .025, .235, ez + .045)); a.add(new THREE.ConeGeometry(.005, .04, 4), MAT.hibY, at(ex + .035, .235, ez + .07, 0, 1, 1, 1, Math.PI/2));
  for (const d of [-.01, .01]) seg(a, MAT.black, V3(ex + d, 0, ez), _up, .13, .003, .003, 3);
  a.into(g);
}
function well(g){
  const a = new Acc(), r = rngFrom(12);
  slab(a, MAT.lat, .62, .04, .62);
  cyl(a, MAT.latL, .22, .22, .18, 0, .04, 0, 16); a.add(new THREE.TorusGeometry(.2, .03, 5, 16).rotateX(Math.PI/2), MAT.lat, at(0, .22, 0));
  a.add(new THREE.CylinderGeometry(.17, .17, .01, 16), WATER, at(0, .18, 0));
  for (const x of [-.2, .2]) seg(a, MAT.woodD, V3(x, .22, 0), _up, .24, .014, .012, 5);
  seg(a, MAT.woodD, V3(-.22, .44, 0), V3(1, 0, 0), .44, .012, .012, 5);
  a.add(new THREE.CylinderGeometry(.035, .035, .02, 10), MAT.woodL, at(0, .44, 0, 0, 1, 1, 1, 0, Math.PI/2));
  seg(a, MAT.rope, V3(0, .41, .03), V3(0, -1, 0), .12, .003, .003, 3); cyl(a, MAT.brass, .035, .03, .05, 0, .24, .03, 10);
  pot(a, .26, .04, .22, .8, MAT.brass); pot(a, -.24, .04, .24, .7); hibiscus(a, .25, .04, -.24, .8, r);
  a.into(g);
}

/* ── To-dos: footbridges, laterite lanes, coir racks, bamboo fences ── */
function bridge(g, s){
  waterPatch(g, s);
  const a = new Acc(), host = new THREE.Group(); host.rotation.y = s.rot || 0; g.add(host);
  const arcY = u => .06 + Math.cos(u*Math.PI/1.0)*.12;          // u in -.5..+.5
  for (const x of [-.44, .44]) slab(a, MAT.lat, .14, .05, .34, x, 0, 0);
  const n = 11; for (let i=0;i<n;i++){ const u = -.46 + i*.92/(n-1), u2 = u + .92/(n-1), y = (arcY(u) + arcY(Math.min(.46, u2)))/2;
    a.add(bx(.085, .018, .26), i%2 ? MAT.woodL : MAT.wood, at(u + .04, y + .04, 0, 0, 1, 1, 1, 0, -Math.atan2(arcY(Math.min(.46, u2)) - arcY(u), .092))); }
  for (const zs of [-1, 1]) { const pts = []; for (let i=0;i<=8;i++){ const u = -.44 + i*.11; pts.push(V3(u, arcY(u) + .2, zs*.12)); seg(a, MAT.bamboo, V3(u, arcY(u) + .04, zs*.12), _up, .16, .007, .007, 4); }
    a.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, .008, 4), MAT.bamboo); }
  pot(a, -.45, .05, .12, .5); diya(a, .45, .05, -.12, .8, host, .14);
  a.into(host);
}
function lane(g, s){
  const m = new THREE.Mesh(G.path, MAT.latL); m.position.y = .0175; m.receiveShadow = true; g.add(m);
  const a = new Acc(), v = s.v || 0, r = rngFrom(s.x*13 + s.z*29);
  if (v === 0) {             // lantern post + a bicycle with milk cans
    seg(a, MAT.woodD, V3(-.3, .035, -.28), _up, .55, .014, .012, 6); seg(a, MAT.woodD, V3(-.3, .56, -.28), V3(1, 0, 1), .08, .006, .006, 4);
    a.add(new THREE.OctahedronGeometry(.045, 0), MAT.glow, at(-.25, .51, -.23, .4, 1, 1.25, 1)); glowAt(g, -.25, .51, -.23, .3, 0);
    const B = new THREE.Group(), bb = new Acc();
    for (const x of [-.13, .13]) bb.add(new THREE.TorusGeometry(.075, .008, 5, 16), MAT.black, at(x, .075, 0));
    seg(bb, MAT.redD, V3(-.13, .075, 0), V3(1, .9, 0), .15, .006, .006, 4); seg(bb, MAT.redD, V3(-.03, .17, 0), V3(1, 0, 0), .13, .006, .006, 4);
    seg(bb, MAT.redD, V3(.13, .075, 0), V3(-.05, 1, 0), .13, .006, .006, 4); seg(bb, MAT.redD, V3(-.03, .17, 0), V3(.4, -1, 0), .11, .006, .006, 4);
    slab(bb, MAT.black, .05, .012, .03, -.05, .18, 0); seg(bb, MAT.steel, V3(.12, .2, -.05), V3(0, 0, 1), .1, .005, .005, 4);
    cyl(bb, MAT.steel, .03, .026, .07, -.16, .1, .05, 10); cyl(bb, MAT.steel, .03, .026, .07, -.16, .1, -.05, 10);
    bb.into(B); B.position.set(.12, .035, .1); B.rotation.y = -.5; B.rotation.z = .1; g.add(B);
  } else if (v === 1) {      // coir drying rack: golden fibre hanging over bamboo rails, a husk heap
    for (const x of [-.34, .34]) for (const z of [-.12, .12]) seg(a, MAT.bamboo, V3(x, .035, z), _up, .34, .01, .01, 5);
    for (const z of [-.12, .12]) seg(a, MAT.bamboo, V3(-.36, .36, z), V3(1, 0, 0), .72, .008, .008, 4);
    for (let i=0;i<2;i++) { const cm = new THREE.Mesh(new THREE.PlaneGeometry(.62, .24), COIR); cm.position.set(0, .24, -.12 + i*.24); cm.castShadow = true; g.add(cm); }
    for (let i=0;i<8;i++) blob(a, i%2 ? MAT.husk : MAT.coir, V3(.22 + (r()-.5)*.2, .06 + (i%3)*.03, .3 + (r()-.5)*.12), .045, .8, 0, r);
  } else {                   // lamp and pots at the lagoon edge, a woven mat drying
    brassLamp(a, -.2, .035, -.2, 1.1, g); pot(a, .2, .035, -.24, .9, MAT.brass); pot(a, .3, .035, -.08, .7);
    slab(a, MAT.weave, .34, .008, .26, .12, .035, .2, .2); for (let i=0;i<5;i++) a.add(bx(.3, .004, .012), MAT.thatchD, at(.12, .045, .1 + i*.05, .2));
    hibiscus(a, -.28, .035, .26, .7, r);
  }
  a.into(g); g.userData.ghostMode = 'marker';
}
function fence(g, s){
  const a = new Acc(), L = s.len;
  const pos = t => s.edge === 'w' ? V3(-.45, 0, t) : V3(t, 0, .45);
  const n = L*3 + 1;
  for (let i=0;i<n;i++){ const t = -L/2 + i*(L/(n-1)); seg(a, MAT.bamboo, pos(t), _up, .28 + (i%2)*.03, .014, .012, 6); }
  for (const h of [.1, .22]) { const p0 = pos(-L/2), p1 = pos(L/2); seg(a, MAT.bamboo, p0.clone().setY(h), p1.clone().sub(p0), L, .009, .009, 5); }
  for (let i=0;i<n;i++){ const t = -L/2 + i*(L/(n-1)), p = pos(t); if (i % 2) a.add(new THREE.TorusGeometry(.016, .004, 3, 8), MAT.coir, at(p.x, .22, p.z, 0, 1, 1, 1, Math.PI/2)); }
  const r = rngFrom(s.x*3 + s.z); for (let i=0;i<L*2;i++){ const t = -L/2 + .25 + i*.5, p = pos(t); hibiscus(a, p.x + (s.edge === 'w' ? .1 : 0), 0, p.z - (s.edge === 'w' ? 0 : .1), .6, r); }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
}

/* ── trees (Vocab): coconut palms, banana, jackfruit, mango ── */
function frondGeo(len, w, arch){
  const g = new THREE.PlaneGeometry(w, len, 1, 7).translate(0, len/2, 0), p = g.attributes.position;
  for (let i=0;i<p.count;i++){ const y = p.getY(i), t = y/len; p.setXYZ(i, p.getX(i), y*(1 - arch*t*.55), arch*t*t*len*.95); }
  g.computeVertexNormals(); return g;
}
function palm(a, lf, x, z, h, lean, dir, r){
  const n = 8, d0 = V3(Math.cos(dir), 0, Math.sin(dir)); let p = V3(x, .02, z), dv = _up;
  for (let i=0;i<n;i++){ const t = i/n; dv = V3(d0.x*lean*(.3 + t*1.1), 1, d0.z*lean*(.3 + t*1.1)).normalize();
    seg(a, i%2 ? MAT.trunk : MAT.trunkD, p, dv, h/n*1.03, .036 - t*.012, .033 - t*.012, 7); p = p.clone().addScaledVector(dv, h/n); }
  blob(a, MAT.trunkD, p.clone().setY(p.y - .01), .04, 1);
  for (let k=0;k<5;k++){ const ang = k/5*6.28 + r(); a.add(new THREE.SphereGeometry(.03, 7, 5), k%3 ? MAT.coco : MAT.cocoB, at(p.x + Math.cos(ang)*.04, p.y - .05, p.z + Math.sin(ang)*.04)); }
  const nf = 11, len = .42 + h*.1;
  for (let k=0;k<nf;k++){ const az = k/nf*6.28 + r()*.4, up = k % 3 === 0;
    lf.add(frondGeo(len*(up ? .8 : 1), .3, up ? .6 : 1.05), FROND(h), atY(p.x, p.y, p.z, az, up ? .55 : 1.0 + r()*.2)); }
}
function palms(g, s){
  const a = new Acc(), lf = new Acc(), r = rngFrom(s.x*11 + s.z*5);
  const set = s.v === 1 ? [[0, 0, 1.45, .25]] : s.v === 2 ? [[-.18, -.14, 1.5, .2], [.2, .16, 1.1, .45]] : [[-.2, -.18, 1.55, .15], [.22, -.05, 1.2, .5], [-.05, .24, .95, .35]];
  set.forEach(([x, z, h, lean], i) => { palm(a, lf, x, z, h, lean, r()*6.28, r); blob(a, MAT.leafD, V3(x, .02, z), .06, .4, 0, r); });
  for (let i=0;i<3;i++) blob(a, MAT.cocoB, V3(.3 - i*.06, .03, .32 - (i%2)*.05), .028, 1);
  a.into(g); lf.into(g);
}
function banana(g, s){
  const a = new Acc(), r = rngFrom(s.x*7 + s.z*3), lf = new Acc();
  for (const [x, z, k] of [[-.05, -.05, 1], [-.24, .16, .7], [.2, -.16, .6], [.22, .24, .45]]) {
    const H = .6*k; seg(a, MAT.leafD, V3(x, 0, z), _up, H, .05*k, .035*k, 7);
    for (let i=0;i<7;i++){ const ang = i/7*Math.PI*2 + r()*.5, L = (.42 + r()*.12)*k, pg = new THREE.PlaneGeometry(.17*k, L, 1, 5).translate(0, L/2, 0), p = pg.attributes.position;
      for (let j=0;j<p.count;j++){ const y = p.getY(j), t = y/L; p.setXYZ(j, p.getX(j)*(1 - .6*t*t), y, -t*t*L*.55 + Math.abs(p.getX(j))*.3); }
      lf.add(pg, swayMat(i%2 ? 0x5DAA3C : 0x74BD48, 1, .05), at(x, H - .02, z, ang, 1, 1, 1, .5)); }
    if (k === 1) { for (let i=0;i<8;i++){ const ang = i/8*6.28; a.add(new THREE.CapsuleGeometry(.012, .045, 2, 5), MAT.coco, at(x + .06 + Math.cos(ang)*.025, H*.72 - (i%2)*.025, z + Math.sin(ang)*.025)); }
      blob(a, MAT.redD, V3(x + .06, H*.6, z), .025, 1.5); }
  }
  a.into(g); lf.into(g);
}
function kitTree(g, s){
  const t = KITCACHE.a && KITCACHE.a[s.model]; if (t) addModel(g, s.model, fitScale(t, s.h || 1.25, s.wid || 1.0), 0, 0, 0, (s.rot||0)*Math.PI/180, 'a');
  const a = new Acc(), r = rngFrom(s.x*5 + s.z*9);
  if (s.fruit === 'jack') for (let i=0;i<6;i++){ const ang = i*1.9, y = .18 + (i%3)*.09; a.add(new THREE.SphereGeometry(.045, 8, 6), MAT.jack, at(Math.cos(ang)*.07, y, Math.sin(ang)*.07, 0, 1, 1.5, 1)); }
  hibiscus(a, .28, 0, .26, .6, r); blob(a, MAT.leafD, V3(-.26, .02, .22), .06, .5, 0, r);
  a.into(g);
}

/* ── Sudoku/Math: paddy fields — flooded mud → seedlings → green carpet → golden ripe ── */
const PADDY_H = [0, .05, .09, .15, .21, .23];
function fillPaddy(host, s, stage){
  host.clear(); const st = Math.min(5, stage), r = rngFrom(s.x*31 + s.z*7 + 5), H = PADDY_H[st];
  const hex = st >= 5 ? 0xE2BE4A : st >= 3 ? 0x5DB43E : 0x9ED35A, mat = swayMat(hex, .25, .05), lf = new Acc(), gr = new Acc();
  const n = 5, blades = st >= 3 ? 6 : st === 2 ? 4 : 3;
  for (let i=0;i<n;i++) for (let j=0;j<n;j++){
    const x = (i - 2)*.155 + (r()-.5)*.02, z = (j - 2)*.155 + (r()-.5)*.02, y = .07;
    for (let k=0;k<blades;k++){ const az = k/blades*6.28 + r(), tilt = .12 + r()*.25 + (st >= 5 ? .15 : 0), hh = H*(.8 + r()*.35);
      lf.add(new THREE.ConeGeometry(.011 + st*.001, hh, 3).translate(0, hh/2, 0), mat, atY(x, y, z, az, tilt));
      if (st >= 5 && k % 2 === 0) { const tx = x + Math.sin(az)*Math.sin(tilt)*hh*.95, tz = z + Math.cos(az)*Math.sin(tilt)*hh*.95;
        gr.add(new THREE.SphereGeometry(.013, 5, 4), MAT.gold, at(tx, y + hh*.9, tz, az, 1, 2.2, 1, .9)); } }
  }
  if (s.v === 1 && st >= 3) {       // a bird-scarer: pole, cross-arm, white shirt, clay-pot head (no face)
    seg(gr, MAT.woodD, V3(.3, .07, -.3), _up, .38, .008, .008, 4); seg(gr, MAT.woodD, V3(.22, .33, -.3), V3(1, 0, 0), .16, .006, .006, 4);
    gr.add(bx(.1, .1, .03), MAT.cloth, at(.3, .28, -.3)); gr.add(new THREE.SphereGeometry(.035, 8, 6), MAT.clay, at(.3, .38, -.3)); }
  if (lf.m.size) lf.into(host); if (gr.m.size) gr.into(host); host.userData.stage = stage;
}
function paddyBase(g){
  const base = new THREE.Mesh(G.field, MAT.mud); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
  const a = new Acc(); a.add(new THREE.PlaneGeometry(.78, .78).rotateX(-Math.PI/2), PADDY_W, at(0, .072, 0));
  for (const [w, d, x, z] of [[.9, .06, 0, .42], [.9, .06, 0, -.42], [.06, .9, .42, 0], [.06, .9, -.42, 0]]) slab(a, MAT.bund, w, .03, d, x, .06, z);
  const m = new THREE.Group(); a.into(m); m.children.forEach(c => c.userData.ghostHide = true); g.add(m);
}

/* ── the Gita hero: a chundan vallam (snake boat) on the lagoon, rowers in pairs, golden muthukuda umbrellas, a race pavilion ── */
function snakeHull(){
  const path = new THREE.CatmullRomCurve3([[-1.0,.8],[-1.05,.66],[-1.0,.46],[-.9,.26],[-.74,.12],[-.5,.07],[0,.06],[.5,.07],[.85,.09],[1.02,.13]].map(([x,y]) => V3(x, y, 0)));
  const N = 60, pos = [], rings = [];
  for (let i=0;i<=N;i++){ const u = i/N, p = path.getPoint(u), t = path.getTangent(u), nrm = V3(-t.y, t.x, 0);
    const hw = u < .22 ? .03 + (u/.22)*.05 : u > .85 ? .08*(1 - (u - .85)/.15) + .012 : .08, th = u < .22 ? .035 + u*.1 : .065;
    rings.push([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a, b]) => p.clone().addScaledVector(nrm, a*th).add(V3(0, 0, b*hw)))); }
  for (let i=0;i<N;i++) for (let k=0;k<4;k++){ const A = rings[i][k], B = rings[i][(k+1)%4], C = rings[i+1][(k+1)%4], D = rings[i+1][k];
    pos.push(A.x,A.y,A.z, B.x,B.y,B.z, C.x,C.y,C.z, A.x,A.y,A.z, C.x,C.y,C.z, D.x,D.y,D.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return { geo:g, path };
}
function muthukuda(a, x, y, z, s=1){
  seg(a, MAT.woodD, V3(x, y, z), _up, .34*s, .007, .007, 5);
  const t = y + .34*s;
  a.add(new THREE.ConeGeometry(.1*s, .05*s, 14), MAT.gold, at(x, t, z)); a.add(new THREE.CylinderGeometry(.1*s, .1*s, .035*s, 14, 1, true), MAT.red, at(x, t - .04*s, z));
  a.add(new THREE.CylinderGeometry(.102*s, .102*s, .012*s, 14, 1, true), MAT.gold, at(x, t - .063*s, z));
  for (let k=0;k<10;k++){ const ang = k/10*6.28; a.add(new THREE.SphereGeometry(.009*s, 5, 4), MAT.gold, at(x + Math.cos(ang)*.1*s, t - .08*s, z + Math.sin(ang)*.1*s)); }
  a.add(new THREE.SphereGeometry(.018*s, 6, 5), MAT.gold, at(x, t + .035*s, z));
}
function snakeBoat(g){
  const pg = lagoonGeo(); pg.translate(0, WATER_H + .0005, 0); worldUV(pg, LAGOON.cx, LAGOON.cz);
  const pm = new THREE.Mesh(pg, PATCH); pm.receiveShadow = true; pm.userData.ghostHide = true; g.add(pm);
  const rim = lagoonGeo(1.84, .5); rim.translate(0, WATER_H - .004, 0); const rm = new THREE.Mesh(rim, BANK); rm.userData.ghostHide = true; g.add(rm);
  const boat = new THREE.Group(); boat.rotation.y = Math.PI/4; boat.position.set(.08, WATER_H - .03, .08); g.add(boat);
  const a = new Acc(), { geo, path } = snakeHull(); a.add(geo, MAT.hull);
  // gold gunwale line and the stern's gold tip
  const top = []; for (let i=0;i<=30;i++){ const p = path.getPoint(i/30); top.push(p.clone().setY(p.y + (i < 7 ? .04 : .066))); }
  for (const zs of [-1, 1]) a.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top.map(p => p.clone().setZ(zs*(p.x < -.8 ? .03 : .075)))), 60, .006, 4), MAT.gold);
  a.add(new THREE.ConeGeometry(.02, .08, 6), MAT.gold, at(-.99, .88, 0, 0, 1, 1, 1, 0, .35));
  // rowers in pairs with oars; helmsmen standing at the stern
  for (let i=0;i<13;i++){ const x = -.5 + i*.105; for (const zs of [-1, 1]) { const z = zs*.04, y = .1;
    a.add(new THREE.CylinderGeometry(.016, .02, .05, 7), MAT.cloth, at(x, y + .025, z, 0, 1, 1, 1, 0, .25));
    a.add(new THREE.SphereGeometry(.015, 7, 5), MAT.skin, at(x - .01, y + .065, z)); a.add(new THREE.TorusGeometry(.014, .004, 3, 8).rotateX(Math.PI/2), i%2 ? MAT.red : MAT.clothY, at(x - .01, y + .07, z));
    seg(a, MAT.woodL, V3(x - .005, y + .04, z), V3(.35, -.7, zs*.45), .12, .004, .004, 3); a.add(bx(.035, .004, .016), MAT.woodL, at(x + .03, y - .045, z + zs*.075, 0, 1, 1, 1, 0, .6)); } }
  for (const [x, y] of [[-.66, .14], [-.76, .17], [-.58, .12]]) { a.add(new THREE.CylinderGeometry(.017, .02, .08, 7), MAT.cloth, at(x, y + .04, 0)); a.add(new THREE.SphereGeometry(.016, 7, 5), MAT.skin, at(x, y + .095, 0));
    a.add(new THREE.TorusGeometry(.015, .004, 3, 8).rotateX(Math.PI/2), MAT.red, at(x, y + .1, 0)); }
  seg(a, MAT.woodL, V3(-.72, .2, .02), V3(-.4, -1, .5), .36, .006, .006, 4);
  muthukuda(a, -.4, .1, 0, 1); muthukuda(a, .12, .09, 0, .85);
  a.add(new THREE.PlaneGeometry(.1, .06), MAT.clothG, at(1.0, .22, 0)); seg(a, MAT.woodD, V3(.96, .12, 0), _up, .14, .004, .004, 3);
  a.into(boat);
  // race pavilion on stilts at the back corner, palms, lamps, pots
  const b = new Acc(), px = -.66, pz = -.66, r = rngFrom(91);
  for (const [dx, dz] of [[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]]) seg(b, MAT.woodD, V3(px + dx, 0, pz + dz), _up, .42, .016, .016, 6);
  slab(b, MAT.woodL, .46, .03, .46, px, .12, pz); keralaRoof(b, .6, .6, .24, .42, px, pz, Math.PI/4, .25);
  for (let i=0;i<5;i++) seg(b, MAT.wood, V3(px - .2 + i*.1, .15, pz + .21), _up, .1, .005, .005, 3);
  brassLamp(b, px + .08, .15, pz + .1, .8, g);
  const lf = new Acc(); palm(b, lf, -.86, .22, 1.5, .35, Math.PI*.8, r); palm(b, lf, .3, -.88, 1.35, .3, -Math.PI/2, r);
  for (const [x, z] of [[-.86, .52], [-.2, -.86]]) hibiscus(b, x, 0, z, .8, r);
  b.into(g); lf.into(g);
  glowAt(g, .08, .45, .08, 1.2, 1);
}

/* ── BLUEPRINT (own layout). Canal cells: (6,1)(5,1)(5,2)(4,2)(4,3)(4,4)(4,5)(3,5)(2,5) → lagoon (0..1,5..6). Rings 6 / 15 / 19. ── */
const SLOTS = [
  // ring 1: the tharavad, a paddy field, palms, a houseboat, a Chinese net, a footbridge
  { id:'tharavad', cat:'building', gate:'lesson',  name:'Tharavad',           b:'tharavad', x:2, z:2, w:2, d:2 },
  { id:'paddy3_4', cat:'crop',  gate:'sudoku',     name:'Paddy field',        kind:'paddy', x:3, z:4, stages:5 },
  { id:'hb4_3',    cat:'water', gate:'breathe',    name:'Houseboat',          b:'houseboat', rot:Math.PI/2, x:4, z:3 },
  { id:'palms2_4', cat:'tree',  gate:'vocab',      name:'Coconut grove',      b:'palms', v:0, x:2, z:4 },
  { id:'net4_2',   cat:'water', gate:'breathe',    name:'Chinese fishing net', b:'net', x:4, z:2 },
  { id:'bridge4_4',cat:'path',  gate:'todos',      name:'Footbridge',         b:'bridge', rot:0, x:4, z:4 },
  // ring 2
  { id:'house1_1', cat:'building', gate:'lesson',  name:'Red-tile house',     b:'house', o:{ wall:'white', shut:'shutG', seed:0, line:true }, x:1, z:1 },
  { id:'palms2_1', cat:'tree',  gate:'vocab',      name:'Coconut palms',      b:'palms', v:2, x:2, z:1 },
  { id:'paddy3_1', cat:'crop',  gate:'mathtricks', name:'Paddy field',        kind:'paddy', x:3, z:1, stages:5 },
  { id:'tea',      cat:'building', gate:'lesson',  name:'Tea stall',          b:'tea', x:4, z:1 },
  { id:'net5_1',   cat:'water', gate:'breathe',    name:'Chinese fishing net', b:'net', x:5, z:1 },
  { id:'ducks',    cat:'water', gate:'breathe',    name:'Duck herder',        b:'ducks', x:5, z:2 },
  { id:'paddy1_2', cat:'crop',  gate:'sudoku',     name:'Paddy field',        kind:'paddy', v:1, x:1, z:2, stages:5 },
  { id:'banana1_3',cat:'tree',  gate:'chemistry',  name:'Banana grove',       b:'banana', x:1, z:3 },
  { id:'paddy1_4', cat:'crop',  gate:'mathtricks', name:'Paddy field',        kind:'paddy', x:1, z:4, stages:5 },
  { id:'paddy5_3', cat:'crop',  gate:'sudoku',     name:'Paddy field',        kind:'paddy', x:5, z:3, stages:5 },
  { id:'palm5_4',  cat:'tree',  gate:'vocab',      name:'Coconut palm',       b:'palms', v:1, x:5, z:4 },
  { id:'house5_5', cat:'building', gate:'lesson',  name:'Yellow house',       b:'house', o:{ wall:'yellow', shut:'shutB', seed:1 }, x:5, z:5 },
  { id:'lotus',    cat:'water', gate:'breathe',    name:'Lotus pads',         b:'lotus', x:4, z:5 },
  { id:'hb3_5',    cat:'water', gate:'breathe',    name:'Houseboat',          b:'houseboat', rot:Math.PI, x:3, z:5 },
  { id:'bridge2_5',cat:'path',  gate:'todos',      name:'Footbridge',         b:'bridge', rot:Math.PI/2, x:2, z:5 },
  // ring 3
  { id:'snakeboat',cat:'special', gate:'gita',     name:'Snake boat',         b:'snake', x:0, z:5, w:2, d:2 },
  { id:'house1_0', cat:'building', gate:'lesson',  name:'Blue house',         b:'house', o:{ wall:'blue', shut:'shutG', seed:1, line:true }, x:1, z:0 },
  { id:'paddy2_0', cat:'crop',  gate:'sudoku',     name:'Paddy field',        kind:'paddy', v:1, x:2, z:0, stages:5 },
  { id:'boatshed', cat:'building', gate:'lesson',  name:'Boat-builder shed',  b:'boatshed', x:3, z:0 },
  { id:'jack5_0',  cat:'tree',  gate:'vocab',      name:'Jackfruit tree',     b:'kitTree', model:'CommonTree_2', fruit:'jack', rot:40, h:1.2, x:5, z:0 },
  { id:'hb6_1',    cat:'water', gate:'breathe',    name:'Houseboat',          b:'houseboat', rot:0, x:6, z:1 },
  { id:'well',     cat:'water', gate:'breathe',    name:'Laterite well',      b:'well', x:6, z:2 },
  { id:'paddy6_3', cat:'crop',  gate:'mathtricks', name:'Paddy field',        kind:'paddy', x:6, z:3, stages:5 },
  { id:'school',   cat:'building', gate:'lesson',  name:'Village school',     b:'school', x:6, z:4 },
  { id:'mango6_5', cat:'tree',  gate:'chemistry',  name:'Mango tree',         b:'kitTree', model:'CommonTree_1', rot:200, h:1.2, x:6, z:5 },
  { id:'lane6_6',  cat:'path',  gate:'todos',      name:'Lantern lane',       b:'lane', v:0, x:6, z:6 },
  { id:'paddy5_6', cat:'crop',  gate:'sudoku',     name:'Paddy field',        kind:'paddy', x:5, z:6, stages:5 },
  { id:'coir4_6',  cat:'path',  gate:'todos',      name:'Coir drying rack',   b:'lane', v:1, x:4, z:6 },
  { id:'house3_6', cat:'building', gate:'lesson',  name:'Mint house',         b:'house', o:{ wall:'mint', shut:'shutB', seed:0 }, x:3, z:6 },
  { id:'lamp2_6',  cat:'path',  gate:'todos',      name:'Lagoon steps',       b:'lane', v:2, x:2, z:6 },
  { id:'coirshed', cat:'building', gate:'lesson',  name:'Coir shed',          b:'coirshed', x:0, z:2 },
  { id:'banana0_4',cat:'tree',  gate:'chemistry',  name:'Banana grove',       b:'banana', x:0, z:4 },
  { id:'fence1',   cat:'path',  gate:'todos',      name:'Bamboo fence',       b:'fence', x:0, z:2, edge:'w', len:2 },
  { id:'fence2',   cat:'path',  gate:'todos',      name:'Bamboo fence',       b:'fence', x:4, z:6, edge:'s', len:2 }
].map(s => ({ ...s, kind:s.kind || 'kl' }));
const ORDER = ['tharavad','paddy3_4','hb4_3','palms2_4','net4_2','bridge4_4',
  'house1_1','paddy3_1','net5_1','palms2_1','ducks','paddy1_2','tea','hb3_5','banana1_3','paddy5_3','lotus','house5_5','palm5_4','bridge2_5','paddy1_4',
  'snakeboat','hb6_1','paddy2_0','house1_0','jack5_0','well','fence1','paddy6_3','school','lane6_6','boatshed','mango6_5','paddy5_6','coir4_6','house3_6','lamp2_6','coirshed','banana0_4','fence2'];
const BUILD = { tharavad, house, tea:teaStall, boatshed:boatShed, coirshed:coirShed, school, houseboat, net:chineseNet, ducks:duckCanoe, lotus:lotusPads, well,
  bridge, lane, fence, palms, banana, kitTree, snake:snakeBoat };

/* ── ground: lush grass on red laterite soil ── */
const TILE = { top:['#6DBE48','#66B643'], side:'#5EA43C', soilTop:'#B8603A', soilBot:'#6B2C1C' };

/* decor: grass tufts, hibiscus and fallen coconuts on land cells; nothing on the water */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(23);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring || CANAL_SET.has(x+','+z)) continue;
    const sl = occ.get(x+','+z), key = x+','+z;
    if (sl && sl !== 'later' && sl.b === 'snake') continue;
    const grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    const tuft = n => { for (let j=0;j<n;j++){ const ang = r()*6.28, d = .12 + r()*.32; addModel(grp, r() < .55 ? 'Grass_1' : 'Grass_2', .22*(.7 + r()*.5), p.x + Math.cos(ang)*d, p.y, p.z + Math.sin(ang)*d, r()*6.28, 'farm'); } };
    if (!sl || sl === 'later') { tuft(4);
      if (r() < .6) hibiscus(a, p.x + (r()-.5)*.5, p.y, p.z + (r()-.5)*.5, .7, r);
      if (r() < .4) for (let i=0;i<2;i++) blob(a, MAT.cocoB, V3(p.x + (r()-.5)*.5, p.y + .02, p.z + (r()-.5)*.5), .028, 1);
      grp.userData.decor = 'meadow'; }
    else if (!placed.includes(sl.id) && AMBIENT()) { tuft(2); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ── life + residents: flickering lamps, drifting ripples, butterflies; on completion a temple elephant and her calf,
   white-throated kingfishers on the net booms, a duck flotilla paddling down the canal ── */
function flicker(t){
  FLAME.forEach((m, i) => { const k = Math.sin(t*9.1 + i*2.1)*.5 + Math.sin(t*14.3 + i*4.7)*.3 + Math.sin(t*23 + i)*.2; m.emissiveIntensity = 1.7 + k*.35; });
  GLOW.forEach((m, i) => { m.opacity = .5 + .12*Math.sin(t*8.3 + i*2.6) + .06*Math.sin(t*17 + i); });
  rippleTex.offset.set(t*.012, -t*.025);
}
function makeElephant(calf=false){
  const g = new THREE.Group(), a = new Acc(), M1 = MAT.ele, M2 = MAT.eleD;
  a.add(new THREE.SphereGeometry(.2, 12, 9), M1, at(0, .34, 0, 0, .9, .82, 1.2));
  const legs = [];
  for (const [x, z] of [[-.1, .13], [.1, .13], [-.1, -.13], [.1, -.13]]) { const L = new THREE.Group(), la = new Acc();
    la.add(new THREE.CylinderGeometry(.055, .06, .22, 9), M1, at(0, -.11, 0)); la.add(new THREE.CylinderGeometry(.063, .063, .02, 9), MAT.tusk, at(0, -.21, 0)); la.into(L);
    L.position.set(x, .22, z); g.add(L); legs.push(L); }
  a.add(new THREE.SphereGeometry(.14, 12, 9), M1, at(0, .46, .24, 0, 1, 1, .95));
  for (const s of [-1, 1]) { a.add(new THREE.SphereGeometry(.12, 10, 8), M2, at(s*.13, .47, .2, s*.35, .22, 1, .9)); a.add(new THREE.SphereGeometry(.085, 8, 6), MAT.eleP, at(s*.145, .47, .215, s*.35, .12, .8, .7));
    blob(a, MAT.black, V3(s*.075, .5, .345), .014); blob(a, MAT.kfWhite, V3(s*.078, .505, .352), .004); }
  if (!calf) { for (const s of [-1, 1]) a.add(new THREE.ConeGeometry(.018, .12, 6), MAT.tusk, at(s*.05, .34, .36, 0, 1, 1, 1, 1.9, 0));
    // gold forehead caparison (nettipattam) — decorative only
    a.add(new THREE.SphereGeometry(.09, 10, 8), MAT.gold, at(0, .53, .345, 0, .8, 1.05, .25));
    for (let k=0;k<5;k++) a.add(new THREE.SphereGeometry(.012, 5, 4), MAT.red, at(-.04 + k*.02, .48 + (k%2)*.05, .37));
  }
  const tail = new Acc(); seg(tail, M2, V3(0, .38, -.23), V3(0, -1, -.3), .16, .01, .008, 4); blob(tail, MAT.black, V3(0, .23, -.28), .014); tail.into(g);
  a.into(g);
  const trunk = new THREE.Group(), ta = new Acc(); ta.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, 0, 0), V3(0, -.1, .06), V3(0, -.22, .07), V3(0, -.3, .13)]), 12, .03, 7), M1);
  ta.into(trunk); trunk.position.set(0, .44, .35); g.add(trunk);
  g.userData = { legs, trunk };
  return g;
}
function makeKingfisher(){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.035, 8, 6), MAT.kfBlue, at(0, .04, 0, 0, .9, .95, 1.3, -.5));
  a.add(new THREE.SphereGeometry(.03, 8, 6), MAT.kfBrown, at(0, .075, .03)); a.add(new THREE.SphereGeometry(.02, 7, 5), MAT.kfWhite, at(0, .052, .045, 0, 1, 1.2, .6));
  a.add(new THREE.ConeGeometry(.009, .06, 5), MAT.kfBill, at(0, .075, .075, 0, 1, 1, 1, Math.PI/2));
  a.add(bx(.026, .006, .05), MAT.kfBlue, at(0, .02, -.05, 0, 1, 1, 1, .6));
  blob(a, MAT.black, V3(.018, .085, .045), .005); blob(a, MAT.black, V3(-.018, .085, .045), .005);
  a.into(g); return g;
}
function makeDuck(){ const g = new THREE.Group(), a = new Acc(); duckInto(a, 0, 0, 0, 0, 1); a.into(g); return g; }
const RES_SCALE = 1.5;
const EL_AT = [[5.85, 6.05, -Math.PI/2 + .25], [5.25, 6.3, -Math.PI/2 + .1]];
function netTip(x, z){ const c = cellPos(x, z); return V3(c.x, TILE_TOP + .8, c.z); }
function moveResidents(t){
  const L = CURVE.getLength();
  (V && V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'elephant') { const walk = e < 1, sway = Math.sin(t*1.1 + u.ph);
      r.obj.position.set(u.at.x + (1 - e)*1.6, TILE_TOP, u.at.z); r.obj.rotation.y = u.face;
      r.obj.userData.trunk.rotation.x = -.15 + sway*.18; r.obj.userData.trunk.rotation.z = Math.sin(t*.8 + u.ph)*.12;
      r.obj.userData.legs.forEach((lg, i) => lg.rotation.x = walk ? Math.sin(t*7 + i*Math.PI/2)*.35 : 0); }
    else if (r.kind === 'kingfisher') { const fly = 1 - e;
      r.obj.position.copy(u.at).add(V3(fly*1.5, fly*1.2, -fly*.6)); r.obj.rotation.y = u.face;
      r.obj.rotation.x = e >= 1 ? Math.max(0, Math.sin(t*1.6 + u.ph*3))*.35 : 0; }
    else if (r.kind === 'duck') { const span = .62, p = ((t*u.sp + u.ph) % 1 + 1) % 1, s = .16 + p*span;
      const q = CURVE.getPointAt(Math.min(.99, s)), q2 = CURVE.getPointAt(Math.min(.995, s + .004)), tx = q2.x - q.x, tz = q2.z - q.z, tl = Math.hypot(tx, tz) || 1;
      r.obj.position.set(q.x - tz/tl*u.off, WATER_Y + Math.sin(t*3 + u.ph*9)*.004, q.z + tx/tl*u.off); r.obj.rotation.y = Math.atan2(tx, tz);
      const fade = e < 1 ? e : Math.min(1, Math.min(p, 1 - p)*9); r.obj.scale.setScalar(RES_SCALE*Math.max(.001, fade)); }
  });
}
let _t = 0;
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.05))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(TILE_TOP + .5), 10, 0xFFF0B0, .6); res(); })); }
async function moveIn(walk){
  V.residentsIn = true; V.res = [];
  const add = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const groups = [
    async () => { const rs = EL_AT.map(([x, z, f], i) => { const o = makeElephant(i === 1); o.scale.setScalar(i ? .72 : 1.05); const c = cellPos(x, z); return add('elephant', o, { at:c, face:f, ph:i*1.7 }); });
      if (walk) await arrive(rs, 2400); },
    async () => { const spots = [[netTip(4, 2), .8], [netTip(5, 1), -.6], [V3(cellPos(4, 4).x, TILE_TOP + .28, cellPos(4, 4).z - .12), 2.2]];
      const rs = spots.map(([p, f], i) => { const o = makeKingfisher(); o.scale.setScalar(RES_SCALE); return add('kingfisher', o, { at:p, face:f, ph:i*1.3 }); });
      if (walk) await arrive(rs, 1400); },
    async () => { const rs = [0, 1, 2, 3, 4].map(i => { const o = makeDuck(); return add('duck', o, { sp:.018, ph:-i*.022, off:.2 + (i%2)*.06 }); });
      if (walk) await arrive(rs, 1500); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length; moveResidents(_t || 2.1);
}

export default {
  id:'kerala', name:'Kerala', title:'Your canals',
  season:29, dates:'23 Aug–5 Sep', nextIn:14,
  kits:['farm', 'a'],
  kitDefs:{ farm:{ file:'assets/farm/farm.glb', flat:true } },
  families:{
    water:   { label:'houseboats, nets & ducks',   tag:'Water' },
    building:{ label:'tharavad, houses & sheds',   tag:'House' },
    path:    { label:'bridges, lanes & fences',    tag:'Path' },
    crop:    { label:'paddy fields',               tag:'Paddy' },
    tree:    { label:'coconut, banana & jackfruit', tag:'Tree' },
    special: { label:'the snake boat',             tag:'Special' }
  },
  slots:SLOTS, order:ORDER,
  ground:{ tile:TILE, tileMap:grassTileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M2 19c3-1.4 6-1.4 9 0s6 1.4 11 0" fill="none" stroke="#3FA08C" stroke-width="2" stroke-linecap="round"/><path d="M4 15.5h15l-2 2.2H6z" fill="#6E4527"/><path d="M6.5 15.5c0-2.6 2.2-4 5-4s5 1.4 5 4z" fill="#CFA85E"/><path d="M19 15c.3-4 .8-7 2-9.5" fill="none" stroke="#8E6E4C" stroke-width="1.6" stroke-linecap="round"/><path d="M21 5.5c-1.8-1.5-4.2-1.2-5.4.4 1.9-.3 3.4.1 5.4-.4zM21 5.5c.9-1.9 3-2.4 3-1.4-1.1.3-2 .8-3 1.4z" fill="#3F9A3A"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M6 112c20-8 40-8 58 0s38 8 58 0v10H6z" opacity=".55"/><path d="M14 96h72l-8 10H22z"/><path d="M24 96c0-14 12-22 26-22s26 8 26 22z"/><path d="M98 104c2-26 6-50 14-70l5 2c-7 19-11 42-12 68z"/><path d="M113 34c-8-8-22-8-30 0 11-2 20 0 30 0zM113 34c4-10 16-15 26-10-10 1-18 4-26 10zM113 34c12-2 22 4 24 14-9-6-16-10-24-14z"/></g>',
  album:{ image:'assets/kerala/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E2F2E0)' },
  css:'.phone[data-theme="kerala"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#EAF5E6 56%,#D3EAD6 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'paddy') { paddyBase(g);
      const host = new THREE.Group(); host.scale.setScalar(1.12); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillPaddy(host, s, st); fillPaddy(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'paddy' ? 1.12 : 1,
  contact: s => s.kind === 'kl' && !['lane', 'fence', 'bridge', 'houseboat', 'net', 'ducks', 'lotus', 'snake'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.b === 'houseboat' || s.b === 'net' || (s.b === 'lane' && s.v !== 1),
  decor,
  env: buildEnv,
  ambient(){ addButterflies(); },
  tick(t){ _t = t; flicker(t); flyButterflies(t); moveResidents(t); },

  residents:[ { id:'elephant', name:'Temple elephants', n:2 }, { id:'kingfisher', name:'Kingfishers', n:3 }, { id:'duck', name:'Ducks', n:5 } ],
  moveIn,
  residentThumb(d, thumbFor){
    return thumbFor('kerala:'+d.id, () => { const o = d.id === 'elephant' ? makeElephant() : d.id === 'kingfisher' ? makeKingfisher() : makeDuck(); o.rotation.y = .7; return o; }, 168); },
  residentRig(d){
    const obj = d.id === 'elephant' ? makeElephant() : d.id === 'kingfisher' ? makeKingfisher() : makeDuck();
    if (d.id !== 'elephant') obj.scale.setScalar(RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
