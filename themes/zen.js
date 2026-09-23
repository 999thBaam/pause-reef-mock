/* ZEN GARDEN (?theme=zen) — a Japanese cherry-blossom garden on the farm's 7×7 ring blueprint (every farm slot id maps to a
   zen piece, hero moved to the right-hand corner like the farm), so rings 6 / 15 / 19, order, pick-3, growth and expansion
   behave exactly like the farm.
   Cherry trees, maples and pines = the shared Quaternius Stylized Nature MegaKit (kit a, CC0), leaf atlases recoloured on a
   canvas (sakura pink, momiji scarlet). Everything Japanese is procedural low-poly flat-shaded three.js, merged per material
   (Acc) so every piece stays pre-renderable: tea house, pagoda, gate house, shrines, bell tower, torii, stone lanterns (tōrō),
   raked gravel (karesansui) that rakes itself in stages, bonsai that grow, bamboo, koi ponds, a waterfall, a shishi-odoshi,
   arched red bridges, stepping stones, bamboo fences. Residents (koi school, two cranes, a tanuki, a cat) are code-built too. */
import * as THREE from 'three';
import { rngFrom, TEX, world, fx, addSway } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { TILE_TOP, cellPos, edgeCentre } from '../engine/grid.js';
import { KITCACHE, fitScale } from '../engine/kit.js';
import { G, Acc, blob } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { meadowDecor } from '../engine/life.js';
import { FARM, FARM_ORDER, heroRight } from './farm.js';

const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.88, metalness:0, flatShading:true, ...o });
const Z = {
  red:FM(0xD6442E), redD:FM(0xA93322), black:FM(0x2E2A2B), roof:FM(0x4A5260), roofD:FM(0x363C47), roofL:FM(0x5E6776),
  wood:FM(0x8A5A38), woodD:FM(0x5E3C25), woodL:FM(0xB9895A), plaster:FM(0xF3EBDC), shoji:FM(0xFBF6EA, { emissive:0x3A3020, emissiveIntensity:.08 }),
  stone:FM(0xB8B3A8), stoneD:FM(0x938E84), stoneL:FM(0xCFCAC0), gravel:FM(0xE9E3D5, { roughness:1 }), gravelL:FM(0xF6F2E8, { roughness:1 }),
  gravelD:FM(0xD2CAB8, { roughness:1 }), moss:FM(0x6F9C45, { roughness:1 }), mossD:FM(0x557F36, { roughness:1 }),
  water:new THREE.MeshStandardMaterial({ color:0x5DB3C9, roughness:.15, metalness:0, emissive:0x0E4A5E, emissiveIntensity:.35 }),
  waterD:new THREE.MeshStandardMaterial({ color:0x3F93AE, roughness:.15, metalness:0, emissive:0x0B3A4C, emissiveIntensity:.3 }),
  fall:new THREE.MeshStandardMaterial({ color:0xCDEFF7, roughness:.2, emissive:0x6CC4DE, emissiveIntensity:.35, transparent:true, opacity:.85, flatShading:true }),
  foam:FM(0xFFFFFF, { roughness:.6 }),
  bamboo:FM(0x8DBB4E), bambooD:FM(0x6C9A37), bambooY:FM(0xC9B35E), rope:FM(0xE3CF95), paper:FM(0xFFFFFF),
  glow:new THREE.MeshStandardMaterial({ color:0xFFD98A, emissive:0xFFA83A, emissiveIntensity:1.2, roughness:.6, flatShading:true }),
  bronze:FM(0x5C8A76, { roughness:.6 }), pot:FM(0x3E6E9E, { roughness:.5 }), potB:FM(0x8A4B32, { roughness:.6 }),
  bark:FM(0x6B4A34), leaf:FM(0x4E8A3A), leafL:FM(0x6FA84A), pink:FM(0xF6A9C2), pinkL:FM(0xFFD3E0), iris:FM(0x7B5CC8), lily:FM(0xF5B5CC),
  pad:FM(0x5E9F43), parasol:FM(0xD8402E, { side:THREE.DoubleSide }), felt:FM(0xC8372A), gold:FM(0xE8C25A, { emissive:0x5A4000, emissiveIntensity:.3 })
};
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = FM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/* ── kit trees with recoloured leaves: sakura pink, momiji scarlet ── */
const LEAFMATS = new Map();
function recolour(tex, key, pal){
  const ck = key + tex.uuid; if (LEAFMATS.has(ck)) return LEAFMATS.get(ck);
  const im = tex.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), a = d.data, W = c.width;
  const cols = pal.map(h => new THREE.Color(h)), r = rngFrom(5), cell = 48, grid = {};
  for (let i=0;i<a.length;i+=4){ if (a[i+3] < 8) continue; const px = (i/4) % W, py = Math.floor(i/4/W), k = (px/cell|0)+','+(py/cell|0);
    const ci = grid[k] ?? (grid[k] = Math.floor(r()*cols.length)), cc = cols[ci], lum = Math.min(1.15, (a[i]*.5 + a[i+1] + a[i+2]*.3)/200 + .75);
    a[i] = Math.min(255, cc.r*255*lum); a[i+1] = Math.min(255, cc.g*255*lum); a[i+2] = Math.min(255, cc.b*255*lum); }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  LEAFMATS.set(ck, t); return t;
}
const PALS = { sakura:['#FFC2D5','#FFD4E2','#FBB2CA','#FFE4EC'], momiji:['#E0502E','#EE6A33','#C93A2A','#F08A3A'] };
const TREEMAT = new Map();
function kitTree(g, name, h, w, x=0, y=0, z=0, rot=0, pal=null){
  const tpl = KITCACHE.a && KITCACHE.a[name]; if (!tpl) { console.warn('missing', name); return null; }
  const k = fitScale(tpl, h, w), t = new THREE.Group();
  tpl.parts.forEach(pt => { let mat = pt.mat;
    if (pal && mat.map && /leaves/i.test(mat.name||'')) { const key = pal + mat.uuid;
      if (!TREEMAT.has(key)) { const m2 = mat.clone(); m2.map = recolour(mat.map, pal, PALS[pal]); m2.color.setHex(0xFFFFFF); if (pal === 'sakura') { m2.emissive = new THREE.Color(0xF7A6C0); m2.emissiveIntensity = .22; } addSway(m2, tpl.size.y, tpl.size.y > 2 ? .018 : .03); TREEMAT.set(key, m2); }
      mat = TREEMAT.get(key); }
    const m = new THREE.Mesh(pt.geo, mat); m.applyMatrix4(pt.local); m.castShadow = m.receiveShadow = true; t.add(m); });
  t.scale.setScalar(k); t.position.set(x, y, z); t.rotation.y = rot; g.add(t); return t;
}

/* ── building blocks ── */
function hipRoof(acc, mat, cx, y, cz, w, d, h, ridge = true, eave = Z.roofD){
  const g = new THREE.CylinderGeometry(.14, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI/4).translate(0, .5, 0);
  acc.add(new THREE.CylinderGeometry(Math.SQRT1_2*.98, Math.SQRT1_2*1.04, 1, 4, 1).rotateY(Math.PI/4).translate(0, .5, 0), eave, at(cx, y - .02, cz, 0, w*1.02, .035, d*1.02));
  acc.add(g, mat, at(cx, y, cz, 0, w, h, d));
  if (ridge) acc.add(box(w*.24, .03, .035), Z.roofD, at(cx, y + h + .005, cz));
}
function rock(acc, x, z, r, sy, rng, mat = Z.stone, y = 0){ blob(acc, mat, new THREE.Vector3(x, y + r*sy*.45, z), r, sy, 0, rng); }
function tuft(acc, x, z, rng, n = 4, y = 0, col = 0x6FA84A){ for (let i=0;i<n;i++){ const h = .07 + rng()*.07;
  acc.add(new THREE.PlaneGeometry(.018, h).translate(0, h/2, 0), swayMat(col, .2, .1), at(x + (rng()-.5)*.06, y, z + (rng()-.5)*.06, rng()*6, 1, 1, 1, (rng()-.5)*.5)); } }
/* kasuga-style stone lantern (tōrō), ~.52 tall at k = 1 */
function lantern(acc, x, z, k = 1, y = 0, rot = 0){
  const H = (h) => y + h*k;
  acc.add(new THREE.CylinderGeometry(.085*k, .11*k, .05*k, 6), Z.stoneD, at(x, H(.025), z, rot));
  acc.add(new THREE.CylinderGeometry(.032*k, .04*k, .2*k, 8), Z.stone, at(x, H(.15), z, rot));
  acc.add(new THREE.CylinderGeometry(.1*k, .06*k, .045*k, 6), Z.stone, at(x, H(.27), z, rot));
  acc.add(box(.1*k, .09*k, .1*k), Z.stoneL, at(x, H(.337), z, rot));
  acc.add(box(.064*k, .06*k, .104*k), Z.glow, at(x, H(.34), z, rot)); acc.add(box(.104*k, .06*k, .064*k), Z.glow, at(x, H(.34), z, rot));
  acc.add(new THREE.ConeGeometry(.15*k, .09*k, 6), Z.stoneD, at(x, H(.425), z, rot));
  acc.add(new THREE.SphereGeometry(.025*k, 6, 5), Z.stone, at(x, H(.485), z));
}
/* torii: vermilion posts, black-capped kasagi with upturned ends */
function torii(acc, x, z, k = 1, rot = 0, y = 0){
  const R = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(k, k, k));
  const add = (geo, mat, m) => acc.add(geo, mat, R.clone().multiply(m.clone()));
  for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(.03, .038, .62, 8), Z.red, at(sx*.25, .31, 0));
    add(new THREE.CylinderGeometry(.045, .045, .05, 8), Z.black, at(sx*.25, .025, 0)); }
  add(box(.64, .04, .04), Z.red, at(0, .47, 0));                                                // nuki
  add(box(.05, .1, .035), Z.red, at(0, .54, 0));                                                // gakuzuka
  add(box(.72, .045, .06), Z.red, at(0, .6, 0));                                                // shimaki
  add(box(.6, .045, .075), Z.black, at(0, .645, 0));                                            // kasagi
  for (const sx of [-1, 1]) add(box(.16, .045, .075), Z.black, at(sx*.37, .66, 0, 0, 1, 1, 1, 0, sx*.28));
}

/* ── RAKED GRAVEL (Sudoku/Math): the rake draws its own lines stage by stage, then stones, moss and an azalea arrive ── */
function rakeLines(acc, circles, n, rng){
  const L = .84, sp = L/14;
  for (let i=0;i<n;i++){ const z = -L/2 + sp*(i + .5);
    let xs = [[-L/2, L/2]];
    for (const [cx, cz, cr] of circles) { if (Math.abs(z - cz) >= cr) continue; const dx = Math.sqrt(cr*cr - (z-cz)*(z-cz)), nx = [];
      for (const [a, b] of xs) { if (b <= cx - dx || a >= cx + dx) nx.push([a, b]); else { if (a < cx - dx) nx.push([a, cx - dx]); if (b > cx + dx) nx.push([cx + dx, b]); } } xs = nx; }
    for (const [a, b] of xs) if (b - a > .02) acc.add(box(b - a, .012, .016), Z.gravelL, at((a + b)/2, .075, z));
  }
  for (const [cx, cz, cr] of circles) for (let j=1;j<=3;j++){ const rr = cr - (j-1)*.04*(cr/.18); if (rr < .06) break;
    acc.add(new THREE.TorusGeometry(rr - .02, .009, 3, 26).rotateX(Math.PI/2), Z.gravelL, at(cx, .072, cz)); }
}
function fillGravel(host, s, stage){
  host.clear(); const acc = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 5), st = Math.min(5, stage), flip = s.v ? -1 : 1;
  const rocks = st >= 3 ? [[.14*flip, -.1, .2]] : []; if (st >= 4) rocks.push([-.22*flip, .22, .15]);
  rakeLines(acc, rocks, st === 1 ? 5 : 14, r);
  if (st >= 3) { rock(acc, .14*flip, -.1, .11, .85, r, Z.stoneD, .06); rock(acc, .21*flip, -.03, .06, .8, r, Z.stone, .06); }
  if (st >= 4) { rock(acc, -.22*flip, .22, .08, .9, r, Z.stone, .06);
    acc.add(new THREE.CylinderGeometry(.13, .14, .02, 12), Z.moss, at(.14*flip, .07, -.1)); acc.add(new THREE.CylinderGeometry(.09, .1, .02, 10), Z.moss, at(-.22*flip, .07, .22)); }
  if (st >= 5) { blob(acc, Z.leaf, new THREE.Vector3(-.3*flip, .13, -.3), .09, .7, 0, r);
    for (let i=0;i<7;i++) acc.add(new THREE.IcosahedronGeometry(.022, 0), Z.pink, at(-.3*flip + (r()-.5)*.15, .15 + r()*.06, -.3 + (r()-.5)*.14)); }
  if (st <= 2) { // the rake (kumade), lying where it stopped
    const rx = st === 1 ? -.02 : .3*flip, rz = st === 1 ? .12 : .34;
    acc.add(box(.024, .024, .5), Z.woodL, at(rx, .1, rz, .9*flip, 1, 1, 1, .12));
    acc.add(box(.2, .03, .03), Z.wood, at(rx - .2*Math.sin(.9*flip), .09, rz - .2*Math.cos(.9*flip), .9*flip)); }
  acc.into(host); host.userData.stage = stage;
}
/* ── BONSAI (Sudoku/Math): a pot on a stone stand; the trunk thickens and foliage pads multiply, blossom at 5 ── */
function fillBonsai(host, s, stage){
  host.clear(); const acc = new Acc(), r = rngFrom(s.x*17 + s.z*5 + 9), st = Math.min(5, stage);
  acc.add(box(.5, .1, .34), Z.stoneD, at(0, .12, 0)); acc.add(box(.56, .03, .4), Z.stone, at(0, .185, 0));
  const potM = s.v ? Z.potB : Z.pot; acc.add(new THREE.CylinderGeometry(.19, .15, .08, 6).scale(1, 1, .7), potM, at(0, .24, 0, Math.PI/6));
  acc.add(new THREE.CylinderGeometry(.17, .17, .012, 6).scale(1, 1, .7), Z.moss, at(0, .28, 0, Math.PI/6));
  const top = .285;
  if (st === 1) { acc.add(new THREE.CylinderGeometry(.006, .009, .08, 4), Z.bark, at(0, top + .04, 0)); blob(acc, Z.leafL, new THREE.Vector3(0, top + .09, 0), .03, .7, 0, r); acc.into(host); host.userData.stage = stage; return; }
  const k = [0, 0, .55, .75, .9, 1][st];
  const pts = [[0, 0], [.05, .1], [-.02, .2], [.06, .3], [.0, .38]].map(([x, y]) => new THREE.Vector3(x*k, top + y*k, 0));
  const nSeg = Math.min(pts.length - 1, st);
  for (let i=0;i<nSeg;i++){ const a = pts[i], b = pts[i+1], d = b.clone().sub(a), len = d.length();
    const geo = new THREE.CylinderGeometry(.018*k*(1 - i*.15), .03*k*(1 - i*.15), len, 6).translate(0, len/2, 0);
    acc.add(geo, Z.bark, new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), d.normalize()), new THREE.Vector3(1,1,1))); }
  const pads = [[.14, .17, .05], [-.13, .24, -.02], [.1, .31, .04], [-.06, .36, .03], [.02, .43, 0], [.17, .27, -.05]].slice(0, [0, 0, 1, 3, 5, 6][st]);
  pads.forEach(([x, y, z], i) => { const p = new THREE.Vector3(x*k, top + y*k, z);
    acc.add(new THREE.CylinderGeometry(.012, .016, Math.abs(x*k)*.9, 4).rotateZ(Math.PI/2), Z.bark, at(x*k*.5, p.y - .02, z));
    blob(acc, i%2 ? Z.leaf : Z.leafL, p, .075*k + .01, .45, 1, r);
    if (st >= 5) for (let j=0;j<4;j++) acc.add(new THREE.IcosahedronGeometry(.016, 0), Z.pinkL, at(p.x + (r()-.5)*.12, p.y + .025, p.z + (r()-.5)*.1)); });
  acc.into(host); host.userData.stage = stage;
}

/* ── named pieces ── */
const ZB = {
  teahouse(g){                                          // ring-1 hero: tea house with an engawa, raked yard, lantern and a cherry
    const a = new Acc(), r = rngFrom(222);
    a.add(box(1.86, .03, 1.86), Z.gravel, at(0, .015, 0));
    for (let i=0;i<9;i++) a.add(box(1.7, .008, .014), Z.gravelL, at(.05, .033, .45 + i*.05));
    const yard = new THREE.Group(); a.into(yard); yard.userData.ghostHide = true; g.add(yard);
    const b = new Acc(), cx = -.12, cz = -.2, w = 1.02, d = .76;
    for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) b.add(box(.08, .09, .08), Z.stoneD, at(cx + sx*w/2, .045, cz + sz*d/2));
    b.add(box(w + .06, .05, d + .3), Z.woodL, at(cx, .115, cz + .12));                              // raised floor + engawa
    b.add(box(w, .4, d), Z.plaster, at(cx, .34, cz));
    for (const sx of [-1, -.33, .33, 1]) for (const sz of [-1, 1]) b.add(box(.045, .42, .045), Z.woodD, at(cx + sx*w/2, .35, cz + sz*d/2));
    for (const sx of [-1, 1]) b.add(box(.045, .42, .045), Z.woodD, at(cx + sx*w/2, .35, cz));
    b.add(box(w + .02, .04, d + .02), Z.woodD, at(cx, .54, cz));
    // shoji front (+z) and side (+x): paper panels with a dark lattice
    for (let i=0;i<3;i++){ const px = cx - w/3 + i*w/3; b.add(box(w/3 - .06, .3, .012), Z.shoji, at(px, .31, cz + d/2 + .006));
      for (let j=1;j<4;j++) b.add(box(w/3 - .06, .008, .016), Z.woodD, at(px, .16 + j*.075, cz + d/2 + .008));
      b.add(box(.008, .3, .016), Z.woodD, at(px, .31, cz + d/2 + .008)); }
    for (let i=0;i<2;i++){ const pz = cz - d/4 + i*d/2; b.add(box(.012, .3, d/2 - .06), i ? Z.shoji : Z.glow, at(cx + w/2 + .006, .31, pz));
      for (let j=1;j<4;j++) b.add(box(.016, .008, d/2 - .06), Z.woodD, at(cx + w/2 + .008, .16 + j*.075, pz)); }
    hipRoof(b, Z.roof, cx, .56, cz, w + .38, d + .44, .36);
    for (let i=0;i<4;i++) b.add(new THREE.CylinderGeometry(.075, .085, .025, 7), Z.stone, at(cx + .1 + i*.12, .04, cz + .46 + i*.14));   // stepping stones
    lantern(b, .62, .42, 1.25);
    b.add(new THREE.CylinderGeometry(.09, .11, .09, 9), Z.stoneD, at(.35, .07, .72)); b.add(new THREE.CylinderGeometry(.065, .065, .01, 9), Z.water, at(.35, .116, .72));   // tsukubai
    b.add(new THREE.CylinderGeometry(.012, .012, .2, 5).rotateZ(Math.PI/2), Z.bamboo, at(.46, .14, .72));
    // nodate: a red bench under a red parasol
    b.add(box(.32, .03, .14), Z.felt, at(-.62, .15, .66, .3)); for (const sx of [-1, 1]) b.add(box(.03, .13, .12), Z.woodD, at(-.62 + sx*.13*Math.cos(.3), .07, .66 - sx*.13*Math.sin(.3), .3));
    b.add(new THREE.CylinderGeometry(.008, .008, .6, 4), Z.woodD, at(-.72, .3, .5));
    b.add(new THREE.ConeGeometry(.3, .12, 12, 1, true), Z.parasol, at(-.72, .6, .5));
    for (let i=0;i<6;i++) rock(b, -.85 + r()*.25, -.78 + r()*.2, .05 + r()*.04, .8, r, Z.stoneD, .03);
    b.add(new THREE.CylinderGeometry(.22, .24, .02, 12), Z.moss, at(.66, .035, -.66));
    b.into(g);
    kitTree(g, 'TwistedTree_1', .95, .7, .66, .03, -.66, .8, 'sakura');
  },
  pagoda(g){ const a = new Acc();
    a.add(box(.66, .06, .66), Z.stoneD, at(0, .03, 0)); a.add(box(.56, .05, .56), Z.stone, at(0, .085, 0));
    let y = .11; [[.36, .17, .74], [.3, .15, .64], [.25, .14, .54]].forEach(([bw, bh, rw]) => {
      a.add(box(bw, bh, bw), Z.plaster, at(0, y + bh/2, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(box(.035, bh, .035), Z.red, at(sx*bw/2, y + bh/2, sz*bw/2));
      a.add(box(bw*.4, bh*.6, .01), Z.red, at(0, y + bh*.45, bw/2 + .004)); a.add(box(.01, bh*.6, bw*.4), Z.red, at(bw/2 + .004, y + bh*.45, 0));
      y += bh; hipRoof(a, Z.roof, 0, y, 0, rw, rw, .09, false); y += .08; });
    a.add(new THREE.CylinderGeometry(.012, .016, .34, 6), Z.gold, at(0, y + .17, 0));
    for (let i=0;i<5;i++) a.add(new THREE.TorusGeometry(.03 - i*.003, .007, 4, 10).rotateX(Math.PI/2), Z.gold, at(0, y + .1 + i*.045, 0));
    a.into(g); },
  gatehouse(g){ const a = new Acc();
    a.add(box(.9, .04, .5), Z.stoneD, at(0, .02, 0));
    for (const sx of [-1, 1]) { a.add(box(.2, .3, .12), Z.plaster, at(sx*.36, .19, -.02)); a.add(box(.24, .04, .18), Z.roof, at(sx*.36, .36, -.02)); }   // wall stubs
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(new THREE.CylinderGeometry(.03, .03, .5, 7), Z.red, at(sx*.2, .29, sz*.12));
    a.add(box(.18, .38, .03), Z.woodD, at(-.1, .25, .01, .5)); a.add(box(.18, .38, .03), Z.woodD, at(.1, .25, .01, -.5));    // doors ajar
    a.add(box(.5, .05, .32), Z.red, at(0, .55, 0));
    hipRoof(a, Z.roof, 0, .575, 0, .72, .5, .2);
    a.into(g); },
  hokora(g){ const a = new Acc(), r = rngFrom(33);           // small wayside shrine with its own little torii
    a.add(box(.34, .12, .3), Z.stoneD, at(-.1, .06, -.1)); a.add(box(.28, .04, .24), Z.stone, at(-.1, .14, -.1));
    a.add(box(.2, .18, .16), Z.woodL, at(-.1, .25, -.1)); a.add(box(.12, .12, .01), Z.woodD, at(-.1, .24, -.015));
    for (const sz of [-1, 1]) a.add(box(.3, .02, .16), Z.roof, at(-.1, .38 + .0, -.1 + sz*.06, 0, 1, 1, 1, sz*.55));
    a.add(new THREE.TorusGeometry(.07, .012, 4, 12, Math.PI).rotateZ(Math.PI), Z.rope, at(-.1, .34, -.005));
    torii(a, .2, .22, .5, Math.PI/4);
    for (const sx of [-1, 1]) { const px = -.1 + sx*.2, pz = .12;                     // two white fox guardians
      a.add(box(.06, .05, .06), Z.stoneL, at(px, .025, pz)); blob(a, Z.paper, new THREE.Vector3(px, .09, pz), .03, 1.4, 0, null);
      blob(a, Z.paper, new THREE.Vector3(px, .14, pz + .01), .022, 1, 0, null); a.add(new THREE.ConeGeometry(.008, .025, 4), Z.paper, at(px - .01, .165, pz + .01)); a.add(new THREE.ConeGeometry(.008, .025, 4), Z.paper, at(px + .01, .165, pz + .01)); }
    for (let i=0;i<4;i++) rock(a, .3 - r()*.1, -.3 + r()*.1, .04 + r()*.03, .8, r);
    a.into(g); kitTree(g, 'TwistedTree_5', .6, .4, .28, 0, -.3, 2, 'momiji'); },
  shrine(g){ const a = new Acc();                           // shrine hall (haiden)
    a.add(box(.84, .08, .74), Z.stoneD, at(0, .04, -.04)); a.add(box(.74, .06, .64), Z.stone, at(0, .11, -.06));
    for (let i=0;i<3;i++) a.add(box(.26, .03, .06), Z.stoneL, at(0, .015 + i*.035, .36 - i*.05));
    a.add(box(.6, .3, .44), Z.plaster, at(0, .29, -.1));
    for (const sx of [-1, -.33, .33, 1]) a.add(new THREE.CylinderGeometry(.024, .024, .34, 6), Z.red, at(sx*.3, .31, .14));
    for (const sx of [-1, 1]) a.add(new THREE.CylinderGeometry(.024, .024, .34, 6), Z.red, at(sx*.3, .31, -.32));
    a.add(box(.64, .035, .5), Z.red, at(0, .47, -.09));
    a.add(box(.2, .1, .08), Z.woodD, at(0, .19, .1));                                      // offering box
    a.add(new THREE.CylinderGeometry(.006, .006, .2, 4), Z.rope, at(0, .36, .16)); a.add(new THREE.SphereGeometry(.025, 6, 5), Z.gold, at(0, .45, .16));
    a.add(new THREE.TorusGeometry(.2, .014, 4, 16, Math.PI).rotateZ(Math.PI), Z.rope, at(0, .44, .165));
    for (let i=0;i<4;i++) a.add(box(.02, .05, .004), Z.paper, at(-.15 + i*.1, .38 + Math.abs(i - 1.5)*.02, .17));
    hipRoof(a, Z.roof, 0, .49, -.09, .92, .74, .3);
    a.into(g); },
  belltower(g){ const a = new Acc();
    a.add(box(.62, .12, .62), Z.stoneD, at(0, .06, 0)); a.add(box(.56, .03, .56), Z.stone, at(0, .135, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(new THREE.CylinderGeometry(.025, .03, .44, 6), Z.red, at(sx*.2, .37, sz*.2));
    a.add(box(.46, .04, .46), Z.red, at(0, .6, 0));
    a.add(new THREE.CylinderGeometry(.09, .11, .2, 12), Z.bronze, at(0, .44, 0)); a.add(new THREE.SphereGeometry(.09, 12, 6, 0, Math.PI*2, 0, Math.PI/2), Z.bronze, at(0, .54, 0));
    a.add(new THREE.CylinderGeometry(.016, .016, .34, 5).rotateZ(Math.PI/2), Z.woodL, at(.1, .43, .14));
    hipRoof(a, Z.roof, 0, .62, 0, .72, .72, .22);
    a.into(g); },
  // ── water (Breathe) ──
  shishi(g){ const a = new Acc(), r = rngFrom(44);           // shishi-odoshi over a stone basin, moss and rocks
    a.add(new THREE.CylinderGeometry(.34, .36, .02, 14), Z.gravel, at(0, .01, 0));
    a.add(new THREE.CylinderGeometry(.13, .15, .1, 9), Z.stoneD, at(.02, .06, .08)); a.add(new THREE.CylinderGeometry(.1, .1, .01, 9), Z.water, at(.02, .105, .08));
    for (const sx of [-1, 1]) a.add(new THREE.CylinderGeometry(.014, .014, .26, 5), Z.bambooD, at(-.14, .13, -.12 + sx*.06));
    a.add(new THREE.CylinderGeometry(.022, .022, .3, 7).rotateZ(Math.PI/2), Z.bamboo, at(-.06, .2, -.12, 0, 1, 1, 1, 0, -.35));   // the rocker
    a.add(new THREE.CylinderGeometry(.01, .01, .14, 5).rotateX(Math.PI/2), Z.woodD, at(-.14, .2, -.12));
    a.add(new THREE.CylinderGeometry(.016, .016, .36, 6), Z.bambooD, at(-.3, .18, -.24)); a.add(new THREE.CylinderGeometry(.012, .012, .2, 6).rotateZ(Math.PI/2), Z.bamboo, at(-.2, .33, -.24, -.6));   // spout
    for (let i=0;i<7;i++){ const ang = i/7*6.28 + r(); rock(a, Math.cos(ang)*.3, Math.sin(ang)*.28, .05 + r()*.04, .8, r, i%2 ? Z.stone : Z.stoneD); }
    a.add(new THREE.CylinderGeometry(.12, .13, .02, 10), Z.moss, at(.2, .02, -.2)); tuft(a, .24, -.22, r, 6, .02); tuft(a, -.28, .22, r, 5, .02);
    a.into(g); },
  waterfall(g){ const a = new Acc(), r = rngFrom(55);
    for (const [x, z, s, y] of [[-.24, -.24, .2, 0], [.05, -.3, .17, 0], [-.3, .02, .15, 0], [-.18, -.22, .15, .22], [.02, -.26, .12, .2], [-.12, -.2, .1, .4]])
      rock(a, x, z, s, 1.1, r, y ? Z.stone : Z.stoneD, y);
    a.add(box(.1, .5, .02), Z.fall, at(-.07, .3, -.1, -.4)); a.add(box(.14, .02, .08), Z.fall, at(-.07, .55, -.14, -.4));
    a.add(new THREE.CylinderGeometry(.26, .27, .02, 16), Z.water, at(.1, .045, .12, 0, 1.1, 1, 1));
    for (let i=0;i<5;i++) blob(a, Z.foam, new THREE.Vector3(-.06 + (r()-.5)*.1, .06, -.02 + (r()-.5)*.06), .03, .5, 0, r);
    for (let i=0;i<9;i++){ const ang = -.6 + i/8*3.2; rock(a, .1 + Math.cos(ang)*.3, .12 + Math.sin(ang)*.27, .04 + r()*.03, .7, r); }
    tuft(a, .38, .36, r, 5); a.into(g);
    kitTree(g, 'Pine_3', .5, .3, -.28, .32, -.3, 1); g.userData.koi = [[.1, .12, .16]]; },
  koipond(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 11);
    a.add(new THREE.CylinderGeometry(.44, .46, .03, 22), Z.gravelD, at(0, .015, 0, 0, 1, 1, .9));
    a.add(new THREE.CylinderGeometry(.38, .38, .02, 22), Z.waterD, at(0, .04, 0, 0, 1, 1, .88));
    for (let i=0;i<13;i++){ const ang = i/13*6.28 + r()*.2; rock(a, Math.cos(ang)*.42, Math.sin(ang)*.39, .05 + r()*.035, .7, r, i%3 ? Z.stone : Z.stoneD, .02); }
    [[-.2, .12], [.16, -.18], [.22, .14]].forEach(([x, z], i) => { a.add(G.pad, Z.pad, at(x, .053, z, i)); if (i !== 1) a.add(new THREE.IcosahedronGeometry(.022, 0), Z.lily, at(x, .07, z)); });
    if (s.iris) { for (let i=0;i<3;i++){ tuft(a, -.32 + i*.06, -.28 + i*.03, r, 5, .02, 0x4E8A3A); a.add(new THREE.IcosahedronGeometry(.02, 0), Z.iris, at(-.32 + i*.06, .15, -.28 + i*.03)); } lantern(a, .34, -.3, .8); }
    else { a.add(box(.34, .025, .1), Z.woodL, at(.12, .08, .3, .5)); tuft(a, -.35, .2, r, 6); }
    a.into(g); g.userData.koi = [[0, 0, .22], [.02, .02, .14]]; },
  // ── trees (Vocab) ──
  tree(g, s){ kitTree(g, s.model, s.h || 1.3, s.w || .98, 0, 0, 0, (s.rot||0)*Math.PI/180, s.pal || null);
    const a = new Acc(), r = rngFrom(s.x*5 + s.z*11); a.add(new THREE.CylinderGeometry(.24, .26, .015, 10), Z.moss, at(.02, .008, .02));
    if (s.pal === 'sakura') petals(a, r, 10, .42); a.into(g); },
  bamboo(g, s){ const a = new Acc(), r = rngFrom(s.x*9 + s.z*13 + 4), lm = swayMat(0x7DB84A, 1.2, .03), lm2 = swayMat(0x5E9A3A, 1.2, .03);
    a.add(new THREE.CylinderGeometry(.34, .36, .02, 12), Z.moss, at(0, .01, 0));
    for (let i=0;i<9;i++){ const ang = i*2.4 + r()*.4, d = .06 + (i/9)*.26, x = Math.cos(ang)*d, z = Math.sin(ang)*d, H = 1.0 + r()*.45, rad = .02 + r()*.008, lean = (r()-.5)*.12;
      const nseg = 6; for (let j=0;j<nseg;j++){ const y0 = j*H/nseg, sl = H/nseg;
        a.add(new THREE.CylinderGeometry(rad*.95, rad, sl*.96, 6).translate(0, sl/2, 0), j%2 ? Z.bamboo : Z.bambooD, at(x + lean*y0, y0, z, 0, 1, 1, 1, 0, -lean));
        a.add(new THREE.CylinderGeometry(rad*1.18, rad*1.18, .012, 6), Z.bambooY, at(x + lean*(y0 + sl), y0 + sl, z)); }
      for (let j=0;j<7;j++){ const y = H*(.45 + r()*.55), la = r()*6.28, ll = .16 + r()*.06;
        a.add(new THREE.PlaneGeometry(.045, ll).translate(0, ll/2, 0), j%2 ? lm : lm2, at(x + lean*y, y, z, la, 1, 1, 1, 1.05 + r()*.35)); } }
    a.into(g); },
  // ── paths (To-dos) ──
  path(g, s){ const slab = new THREE.Mesh(G.path, Z.gravel); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
    const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 'plain';
    if (v === 'bridge') {
      a.add(box(.97, .02, .38), Z.water, at(0, .04, 0)); for (const sz of [-1, 1]) for (let i=0;i<6;i++) rock(a, -.42 + i*.17, sz*(.21 + r()*.03), .04 + r()*.02, .7, r, Z.stone, .03);
      const n = 9, H = .18, L = .9;
      for (let i=0;i<n;i++){ const t0 = i/n, t1 = (i+1)/n, x0 = -L/2 + L*t0, x1 = -L/2 + L*t1, y0 = .05 + Math.sin(Math.PI*t0)*H, y1 = .05 + Math.sin(Math.PI*t1)*H;
        const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
        a.add(box(len + .01, .03, .24), Z.woodL, at((x0 + x1)/2, (y0 + y1)/2, 0, 0, 1, 1, 1, 0, ang));
        for (const sz of [-1, 1]) a.add(box(len + .01, .022, .022), Z.red, at((x0 + x1)/2, (y0 + y1)/2 + .15, sz*.12, 0, 1, 1, 1, 0, ang)); }
      for (let i=0;i<=n;i+=3){ const t = i/n, x = -L/2 + L*t, y = .05 + Math.sin(Math.PI*t)*H; for (const sz of [-1, 1]) {
        a.add(box(.026, .17, .026), Z.red, at(x, y + .075, sz*.12)); a.add(new THREE.SphereGeometry(.018, 6, 4), Z.gold, at(x, y + .17, sz*.12)); } }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(box(.04, .1, .04), Z.redD, at(sx*.36, .05, sz*.12));
    } else {
      [[-.3, .28], [-.08, .06], [.16, -.14], [.33, -.34]].forEach(([x, z]) => a.add(new THREE.CylinderGeometry(.1 + r()*.03, .11, .03, 7), r() < .5 ? Z.stone : Z.stoneL, at(x + (r()-.5)*.05, .045, z + (r()-.5)*.05, r()*3, 1, 1, .85 + r()*.25)));
      a.add(new THREE.CylinderGeometry(.14, .15, .012, 9), Z.moss, at(.3, .038, .3)); a.add(new THREE.CylinderGeometry(.1, .11, .012, 9), Z.moss, at(-.32, .038, -.3));
      if (v === 'lantern') lantern(a, .27, .28, 1.15, .03);
      else if (v === 'lanterns') { lantern(a, .3, .3, .85, .03); lantern(a, -.3, -.3, .85, .03); }
      else if (v === 'parasol') { a.add(box(.34, .03, .14), Z.felt, at(-.22, .15, .26, .78)); for (const sx of [-1, 1]) a.add(box(.03, .13, .12), Z.woodD, at(-.22 + sx*.12*Math.cos(.78), .08, .26 - sx*.12*Math.sin(.78), .78));
        a.add(new THREE.CylinderGeometry(.008, .008, .62, 4), Z.woodD, at(-.33, .33, .1)); a.add(new THREE.ConeGeometry(.3, .12, 12, 1, true), Z.parasol, at(-.33, .64, .1));
        a.add(new THREE.CylinderGeometry(.03, .025, .04, 8), Z.plaster, at(-.1, .185, .3)); }
      else tuft(a, .32, .32, r, 5, .03);
    }
    a.into(g); if (v === 'plain') g.userData.ghostMode = 'marker'; },
  fence(g, s){ const a = new Acc(), r = rngFrom(s.x*3 + s.z*7 + 2), L = s.len;
    const P = (u, y, len, geo, mat) => s.edge === 'w' ? a.add(geo, mat, at(-.45, y, u)) : a.add(geo, mat, at(u, y, .45));
    for (let i=0;i<=L*3;i++){ const u = -L/2 + i/3 + .0; P(u, .15, 0, new THREE.CylinderGeometry(.018, .02, .3, 6), i%3 ? Z.bamboo : Z.woodD); }
    for (const y of [.1, .2, .27]) { const geo = new THREE.CylinderGeometry(.013, .013, L, 6).rotateZ(Math.PI/2); s.edge === 'w' ? a.add(geo, Z.bambooD, at(-.45, y, 0, Math.PI/2)) : a.add(geo, Z.bambooD, at(0, y, .45)); }
    for (let i=0;i<L*3;i++){ const u = -L/2 + (i + .5)/3; P(u, .2, 0, box(.03, .012, .03), Z.rope); }
    a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz); },
  // ── Gita: the grand cherry on a mossy mound, a torii and lanterns before it ──
  grandcherry(g){ const a = new Acc(), r = rngFrom(404);
    a.add(new THREE.CylinderGeometry(.9, .94, .05, 36), Z.gravel, at(0, .025, 0));
    a.add(new THREE.CylinderGeometry(.62, .84, .16, 30), Z.moss, at(-.08, .13, -.08)); a.add(new THREE.CylinderGeometry(.38, .6, .1, 26), Z.mossD, at(-.12, .26, -.12));
    for (let i=0;i<22;i++){ const ang = i/22*6.28 + r()*.1; rock(a, -.08 + Math.cos(ang)*.84, -.08 + Math.sin(ang)*.84, .045 + r()*.025, .7, r, i%2 ? Z.stone : Z.stoneD, .04); }
    for (let i=0;i<3;i++) a.add(box(.2, .04, .08), Z.stoneL, at(.34 - i*.1, .08 + i*.08, .34 - i*.1, Math.PI/4));
    torii(a, .5, .5, 1.25, Math.PI/4, .05);
    lantern(a, .8, .08, 1.1, .05); lantern(a, .08, .8, 1.1, .05);
    petals(a, r, 40, .85, .31, -.12);
    a.add(new THREE.TorusGeometry(.13, .02, 5, 16).rotateX(Math.PI/2), Z.rope, at(-.17, .52, -.17));
    for (let i=0;i<4;i++) a.add(box(.022, .06, .004), Z.paper, at(-.17 + Math.cos(i*1.6 + .8)*.14, .47, -.17 + Math.sin(i*1.6 + .8)*.14, -(i*1.6 + .8)));
    a.into(g);
    kitTree(g, 'TwistedTree_3', 2.05, 1.9, -.14, .31, -.14, 2.2, 'sakura');
  }
};
function petals(acc, r, n, rad, y = .02, c = 0){ for (let i=0;i<n;i++){ const ang = r()*6.28, d = Math.sqrt(r())*rad;
  acc.add(new THREE.CircleGeometry(.014 + r()*.008, 5).rotateX(-Math.PI/2), r() < .6 ? Z.pink : Z.pinkL, at(c + Math.cos(ang)*d, y + .004, c + Math.sin(ang)*d, r()*6)); } }

/* blueprint: every farm slot id → a zen piece (same cells, same rings, same order), hero in the right-hand corner */
const MAP = {
  bigbarn:{ name:'Tea house', b:'teahouse' },
  silo:{ name:'Pagoda', b:'pagoda' }, silohouse:{ name:'Gate house', b:'gatehouse' }, coop:{ name:'Wayside shrine', b:'hokora' },
  smallbarn:{ name:'Shrine hall', b:'shrine' }, openbarn:{ name:'Bell tower', b:'belltower' },
  well:{ name:'Bamboo fountain', b:'shishi' }, watertower:{ name:'Waterfall', b:'waterfall' }, pump:{ name:'Koi pond', b:'koipond' }, pond:{ name:'Iris koi pond', b:'koipond', iris:true },
  apple1:{ name:'Cherry tree', b:'tree', model:'TwistedTree_1', pal:'sakura', rot:20, h:1.25, w:1 }, apple2:{ name:'Cherry tree', b:'tree', model:'TwistedTree_5', pal:'sakura', rot:140, h:1.3, w:1 },
  berry1:{ name:'Bamboo grove', b:'bamboo' }, orange1:{ name:'Black pine', b:'tree', model:'Pine_1', rot:0, h:1.45, w:.9 },
  apple3:{ name:'Japanese maple', b:'tree', model:'CommonTree_2', pal:'momiji', rot:260, h:1.25, w:.95 }, berry2:{ name:'Bamboo grove', b:'bamboo' },
  orange2:{ name:'Japanese maple', b:'tree', model:'CommonTree_3', pal:'momiji', rot:200, h:1.3, w:.95 }, apple4:{ name:'Cherry tree', b:'tree', model:'TwistedTree_1', pal:'sakura', rot:60, h:1.25, w:1 },
  peepal:{ name:'Grand cherry', b:'grandcherry' }
};
const PATH_V = { path3_4:['plain','Stepping stones'], path3_5:['lantern','Stone lantern'], path1_2:['bridge','Red bridge'], path5_2:['parasol','Tea bench'],
  path3_6:['lanterns','Lantern pair'], path2_6:['bridge','Red bridge'], path3_0:['lantern','Stone lantern'] };
const BONSAI = new Set(['field1_4', 'field6_3', 'field4_6']);
export const ZEN = heroRight(FARM).map((f, i) => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') return BONSAI.has(f.id) ? { ...s, kind:'bonsai', name:'Bonsai', v:i%2, stages:5 } : { ...s, kind:'gravel', name:'Raked gravel', v:i%2, stages:5 };
  if (f.kind === 'path') { const [v, name] = PATH_V[f.id] || ['plain', 'Stepping stones']; return { ...s, kind:'z', b:'path', v, name }; }
  if (f.kind === 'fence') return { ...s, kind:'z', b:'fence', edge:f.edge, len:f.len, name:'Bamboo fence' };
  return { ...s, kind:'z', ...MAP[f.id] };
});

/* ── ambient: drifting cherry petals + koi circling every placed pond ── */
const PETAL_GEO = new THREE.CircleGeometry(.024, 5).scale(1, .7, 1);
const PETAL_MATS = [0xF7B3C9, 0xFFD3E0, 0xF29DBA].map(c => new THREE.MeshBasicMaterial({ color:c, side:THREE.DoubleSide }));
function koiFish(pal, len = .12){
  const g = new THREE.Group(), a = new Acc(), [c1, c2] = pal;
  a.add(new THREE.IcosahedronGeometry(1, 1), c1, at(0, 0, 0, 0, len*.22, len*.12, len*.5));
  a.add(new THREE.IcosahedronGeometry(1, 0), c2, at(0, len*.05, len*.08, 0, len*.15, len*.08, len*.22));
  a.add(new THREE.IcosahedronGeometry(1, 0), c2, at(len*.02, len*.05, -len*.2, 0, len*.1, len*.07, len*.12));
  a.into(g); const tail = new THREE.Mesh(new THREE.ConeGeometry(len*.2, len*.3, 3).rotateX(-Math.PI/2).scale(1, .25, 1), c2 === Z.foam ? c1 : c2);
  tail.position.z = -len*.55; tail.castShadow = true; g.add(tail); g.userData.tail = tail; return g;
}
const KOI_M = { orange:FM(0xF2742B), white:FM(0xFFF8EE), gold:FM(0xF4B83A), black:FM(0x2F2A2A), red:FM(0xD8402E) };
const KOI_PALS = [[KOI_M.white, KOI_M.orange], [KOI_M.orange, KOI_M.white], [KOI_M.gold, KOI_M.gold], [KOI_M.white, KOI_M.red], [KOI_M.white, KOI_M.black]];
function addKoi(extra){
  V.koi = V.koi || [];
  Object.values(V.pieces).forEach(g => (g.userData.koi || []).forEach(([x, z, rr], j) => {
    const n = extra ? 2 : 1;
    for (let i=0;i<n;i++){ const f = koiFish(KOI_PALS[(V.koi.length + j) % KOI_PALS.length], .13 + (V.koi.length%3)*.015);
      const c = new THREE.Vector3(x, .065, z).applyMatrix4(g.matrixWorld);
      f.userData.u = { c, r:rr*(extra ? .75 + i*.25 : 1), sp:(j%2 ? -1 : 1)*(.5 + (V.koi.length%3)*.12), ph:V.koi.length*1.9, arrive:extra ? 0 : 1 };
      world.add(f); V.koi.push(f); V.life.push(f); } }));
}
function zenAmbient(){
  V.koi = []; V.petals = [];
  addKoi(false);
  const R = V.ring + .6, r = rngFrom(88), n = 18 + V.ring*12;
  for (let i=0;i<n;i++){ const p = new THREE.Mesh(PETAL_GEO, PETAL_MATS[i%3]); p.renderOrder = 10;
    p.userData = { x:(r()*2-1)*R, z:(r()*2-1)*R, ph:r(), sp:.05 + r()*.04, top:2 + V.ring*.3, wob:r()*6, spin:1 + r()*2 };
    world.add(p); V.petals.push(p); V.life.push(p); }
  moveLife(2.1, 0);
}
function moveLife(t, dt){
  if (!V) return;
  (V.petals || []).forEach(p => { const u = p.userData, k = ((t*u.sp + u.ph) % 1 + 1) % 1, y = u.top - k*(u.top - TILE_TOP - .02);
    p.position.set(u.x + k*1.2 - .6 + Math.sin(t*.8 + u.wob)*.18, y, u.z + k*.6 - .3 + Math.cos(t*.6 + u.wob)*.12);
    p.rotation.set(t*u.spin + u.wob, t*.7*u.spin, u.wob); });
  (V.koi || []).forEach(f => { const u = f.userData.u, a = t*u.sp + u.ph;
    f.position.set(u.c.x + Math.cos(a)*u.r, u.c.y, u.c.z + Math.sin(a)*u.r*.9); f.rotation.y = -a + (u.sp > 0 ? Math.PI : 0);
    f.scale.setScalar(Math.max(.001, u.arrive)); f.userData.tail.rotation.y = Math.sin(t*9 + u.ph)*.45; });
  (V.zenRes || []).forEach(o => { const u = o.userData;
    if (u.kind === 'crane' && u.flyT == null) { u.neck.rotation.x = Math.sin(t*.9 + u.ph)*.12; }
    if (u.kind === 'tanuki' || u.kind === 'cat') o.children[0].scale.y = 1 + Math.sin(t*2.4 + u.ph)*.025; });
}

/* ── residents: code-built cranes, a tanuki and a cat; the koi school joins the ponds ── */
function crane(){
  const o = new THREE.Group(), body = new THREE.Group(), a = new Acc(); o.add(body);
  a.add(new THREE.IcosahedronGeometry(1, 1), Z.paper, at(0, .34, 0, 0, .075, .07, .15));
  a.add(new THREE.ConeGeometry(.06, .12, 5).rotateX(-Math.PI/2 - .5), Z.black, at(0, .34, -.15));
  for (const sx of [-1, 1]) { a.add(new THREE.CylinderGeometry(.006, .006, .3, 4), Z.black, at(sx*.03, .15, 0)); a.add(box(.012, .006, .06), Z.black, at(sx*.03, .003, .02)); }
  a.into(body);
  const neck = new THREE.Group(); neck.position.set(0, .38, .1); body.add(neck); const n = new Acc();
  n.add(new THREE.CylinderGeometry(.018, .026, .2, 6).translate(0, .1, 0), Z.black, at(0, 0, 0, 0, 1, 1, 1, .35));
  n.add(new THREE.SphereGeometry(.032, 8, 6), Z.paper, at(0, .2, .07)); n.add(new THREE.SphereGeometry(.018, 6, 4), Z.felt, at(0, .225, .07));
  n.add(new THREE.ConeGeometry(.01, .09, 4).rotateX(Math.PI/2), Z.gold, at(0, .2, .14)); n.into(neck);
  const wings = []; for (const sx of [-1, 1]) { const w = new THREE.Group(); w.position.set(sx*.06, .38, 0); body.add(w);
    const m = new THREE.Mesh(new THREE.BoxGeometry(.3, .012, .14).translate(sx*.15, 0, 0), Z.paper); m.castShadow = true; w.add(m);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(.08, .014, .14).translate(sx*.34, 0, 0), Z.black); w.add(tip); w.rotation.z = -sx*1.25; w.userData.sx = sx; wings.push(w); }
  o.userData = { kind:'crane', neck, wings }; return o;
}
function tanuki(){
  const o = new THREE.Group(), body = new THREE.Group(), a = new Acc(), brown = FM(0x8A6746), dark = FM(0x3B2E26), cream = FM(0xE8D6B5); o.add(body);
  a.add(new THREE.IcosahedronGeometry(1, 1), brown, at(0, .12, 0, 0, .09, .08, .13));
  a.add(new THREE.IcosahedronGeometry(1, 1), cream, at(0, .1, .04, 0, .06, .05, .08));
  a.add(new THREE.IcosahedronGeometry(1, 1), brown, at(0, .18, .13, 0, .065, .06, .06));
  for (const sx of [-1, 1]) { a.add(new THREE.IcosahedronGeometry(1, 0), dark, at(sx*.03, .185, .175, 0, .026, .018, .012)); a.add(new THREE.SphereGeometry(.006, 5, 4), Z.foam, at(sx*.03, .19, .188));
    a.add(new THREE.ConeGeometry(.02, .035, 4), dark, at(sx*.04, .24, .12)); a.add(new THREE.CylinderGeometry(.018, .02, .07, 5), dark, at(sx*.05, .035, .06)); a.add(new THREE.CylinderGeometry(.018, .02, .07, 5), dark, at(sx*.05, .035, -.07)); }
  a.add(new THREE.SphereGeometry(.012, 5, 4), dark, at(0, .175, .19));
  for (let i=0;i<3;i++) a.add(new THREE.IcosahedronGeometry(1, 0), i%2 ? dark : brown, at(0, .1 - i*.02, -.14 - i*.04, 0, .04, .04, .035));
  a.into(body); o.userData = { kind:'tanuki' }; return o;
}
function cat(){
  const o = new THREE.Group(), body = new THREE.Group(), a = new Acc(), orange = FM(0xE8923A), dark = FM(0x2F2A2A); o.add(body);
  a.add(new THREE.IcosahedronGeometry(1, 1), Z.foam, at(0, .08, 0, 0, .065, .08, .07));
  a.add(new THREE.IcosahedronGeometry(1, 0), orange, at(.03, .11, -.03, 0, .04, .04, .04)); a.add(new THREE.IcosahedronGeometry(1, 0), dark, at(-.035, .07, -.03, 0, .03, .03, .03));
  a.add(new THREE.IcosahedronGeometry(1, 1), Z.foam, at(0, .18, .02, 0, .052, .048, .048));
  a.add(new THREE.IcosahedronGeometry(1, 0), orange, at(.025, .205, .01, 0, .03, .025, .03));
  for (const sx of [-1, 1]) { a.add(new THREE.ConeGeometry(.016, .035, 4), sx > 0 ? orange : dark, at(sx*.03, .23, .015)); a.add(new THREE.SphereGeometry(.006, 5, 4), dark, at(sx*.018, .185, .066)); }
  a.add(new THREE.TorusGeometry(.06, .012, 4, 10, Math.PI*.9), orange, at(-.02, .03, -.03, 1.2, 1, 1, 1, Math.PI/2));
  a.add(new THREE.TorusGeometry(.028, .006, 4, 10), Z.felt, at(0, .145, .02, 0, 1, 1, 1, Math.PI/2 - .2)); a.add(new THREE.SphereGeometry(.009, 5, 4), Z.gold, at(0, .13, .05));
  a.into(body); o.userData = { kind:'cat' }; return o;
}
const RES_BUILD = { Cranes:crane, Tanuki:tanuki, Cat:cat };
const RES_K = { Cranes:1.15, Tanuki:1.75, Cat:1.75 };
const RES_SPOTS = { Cranes:[[[0.15, 2.9], .9], [[0.45, 4.25], 2.2]], Tanuki:[[[1.1, 6.1], 2.3]], Cat:[[[5.2, 6.15], -.6]] };
function placeRes(id, walk){
  return RES_SPOTS[id].map(([[x, z], face], i) => { const o = RES_BUILD[id](); const to = cellPos(x, z);
    o.userData.ph = i*1.3; o.userData.to = to; o.scale.setScalar(RES_K[id]); o.rotation.y = face; o.position.copy(to); o.position.y = TILE_TOP;
    o.traverse(m => { if (m.isMesh) m.castShadow = true; }); world.add(o); (V.zenRes = V.zenRes || []).push(o); return o; });
}
async function zenMoveIn(walk){
  V.residentsIn = true; V.zenRes = [];
  const ids = ['Koi', 'Cranes', 'Tanuki', 'Cat'];
  for (let i=0;i<ids.length;i++){
    const id = ids[i];
    if (id === 'Koi') { const n0 = (V.koi || []).length; addKoi(true); const school = V.koi.slice(n0);
      if (walk) await new Promise(res => tween(S.rm ? 1 : 1200, t => school.forEach((f, j) => f.userData.u.arrive = Math.min(1, Math.max(0, t*1.3 - j*.05))),
        () => { school.forEach(f => f.userData.u.arrive = 1); if (school[0]) sparkle(school[0].position.clone(), 8, 0xFFE3C0, .5); res(); }));
      else school.forEach(f => f.userData.u.arrive = 1);
    } else {
      const objs = placeRes(id, walk);
      if (walk) await new Promise(res => {
        const from = objs.map(o => id === 'Cranes' ? o.userData.to.clone().add(new THREE.Vector3(2.5, 3, 1.5)) : cellPos(3, 7.3));
        objs.forEach((o, j) => { if (id !== 'Cranes') { const d = o.userData.to.clone().sub(from[j]); o.rotation.y = Math.atan2(d.x, d.z); } o.userData.flyT = 0; });
        const face = objs.map(o => o.rotation.y), finalFace = RES_SPOTS[id].map(s => s[1]);
        tween(S.rm ? 1 : (id === 'Cranes' ? 1800 : 1300), t => objs.forEach((o, j) => { const e = 1 - Math.pow(1 - t, 2.2), to = o.userData.to;
          o.position.lerpVectors(from[j], to, e); if (id !== 'Cranes') o.position.y = TILE_TOP + Math.abs(Math.sin(t*20))*.02;
          if (id === 'Cranes') { o.rotation.y = Math.atan2(to.x - from[j].x, to.z - from[j].z); o.userData.wings.forEach(w => w.rotation.z = -w.userData.sx*(t < .85 ? Math.sin(t*28)*.6 : 1.25*(t - .85)/.15)); } }),
          () => { objs.forEach((o, j) => { o.position.copy(o.userData.to); o.rotation.y = finalFace[j]; o.userData.flyT = null; if (o.userData.wings) o.userData.wings.forEach(w => w.rotation.z = -w.userData.sx*1.25);
            sparkle(o.userData.to.clone().setY(TILE_TOP + .3), 8, 0xFFF0B0, .5); }); res(); });
      });
    }
    V.arrived = i + 1; hooks.renderChrome();
    if (walk) await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = ids.length;
}
function petalPuff(pos, n = 14){
  for (let i=0;i<n;i++){ const m = new THREE.Mesh(PETAL_GEO, PETAL_MATS[i%3]); m.renderOrder = 10;
    const a = i/n*6.28, d = .3 + Math.random()*.45, rise = .3 + Math.random()*.4; m.position.copy(pos); fx.add(m);
    tween(1000 + Math.random()*400, t => { const e = 1 - Math.pow(1-t, 2); m.position.set(pos.x + Math.cos(a)*d*e, pos.y + .05 + Math.sin(t*Math.PI)*rise, pos.z + Math.sin(a)*d*e);
      m.rotation.set(t*9 + a, t*6, a); m.scale.setScalar(1 - t*.6); }, () => fx.remove(m));
  }
}

export default {
  id:'zen', name:'Zen garden', title:'Your zen garden',
  season:12, dates:'2–15 Mar', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'koi ponds & fountains',  tag:'Water' },
    building:{ label:'tea house & shrines',    tag:'Building' },
    path:    { label:'stones, lanterns & bridges', tag:'Path' },
    crop:    { label:'raked gravel & bonsai',  tag:'Garden' },
    tree:    { label:'cherry, maple & bamboo', tag:'Tree' },
    special: { label:'the grand cherry',       tag:'Special' }
  },
  slots:ZEN, order:FARM_ORDER,
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M3 5.5c3 .9 15 .9 18 0l-.6 2.2c-3 .6-13.8.6-16.8 0z" fill="#2E2A2B"/><path d="M4.4 9h15.2v1.8H4.4z" fill="#D6442E"/><path d="M6.6 7.6h2.2V21H6.6zM15.2 7.6h2.2V21h-2.2z" fill="#D6442E"/><circle cx="12" cy="15.5" r="2.4" fill="#F6A9C2"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M8 30c14 5 58 5 72 0l-3 9c-14 3-52 3-66 0z"/><path d="M14 46h60v7H14z"/><path d="M22 36h8v82h-8zM58 36h8v82h-8z"/><path d="M96 20l-16 14h32zM86 40h20v12H86zM78 56l18-10 18 10zM88 60h16v12H88zM80 76l16-8 16 8zM90 80h12v38H90z"/></g>',
  album:{ image:'assets/zen/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#FBEAF0)' },
  css:'.phone[data-theme="zen"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#FBEFF3 58%,#F2DCE4 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'gravel' || s.kind === 'bonsai') {
      const slab = new THREE.Mesh(G.field, s.kind === 'gravel' ? Z.gravel : Z.gravelD); slab.position.y = .035; slab.receiveShadow = true; slab.castShadow = true; slab.userData.ghostHide = true; g.add(slab);
      const host = new THREE.Group(); g.add(host); g.userData.plants = host;
      const fill = s.kind === 'gravel' ? fillGravel : fillBonsai; g.userData.regrow = st => fill(host, s, st); fill(host, s, stage);
    } else ZB[s.b](g, s);
  },
  scaleOf: () => 1,
  contact: s => s.kind === 'bonsai' || (s.kind === 'z' && !['path', 'fence'].includes(s.b)),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.v === 'lantern' || s.v === 'lanterns' || s.b === 'koipond',
  decor(slots){ meadowDecor(slots, { tuft: r => [r() < .5 ? 'Grass_Common_Short' : 'Grass_Wispy_Short', 0], flowers:false }); },
  ambient: zenAmbient,
  tick(t, dt){ moveLife(t, dt); },
  onImpact(pos, big){ petalPuff(pos, big ? 20 : 12); },

  residents:[ { id:'Koi', name:'Koi school' }, { id:'Cranes', name:'Cranes' }, { id:'Tanuki', name:'Tanuki' }, { id:'Cat', name:'Cat' } ],
  moveIn: zenMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('zen:'+d.id, () => { if (d.id === 'Koi') { const g = new THREE.Group(); [[0, 0, 0], [.1, .02, .08], [-.08, -.01, .1]].forEach(([x, y, z], i) => { const f = koiFish(KOI_PALS[i], .2); f.position.set(x, y, z); f.rotation.y = 1.2 + i*.3; g.add(f); }); return g; }
      const o = RES_BUILD[d.id](); o.rotation.y = .5; return o; }, 168); },
  residentRig(d){ let obj; if (d.id === 'Koi') obj = koiFish(KOI_PALS[0], .2); else obj = RES_BUILD[d.id]();
    return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:.5 }; }
};
