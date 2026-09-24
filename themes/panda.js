/* PANDA SANCTUARY (?theme=panda) — misty green bamboo hills on the farm's 7×7 ring blueprint (every farm slot id maps to a
   sanctuary piece, hero moved to the right-hand corner like farm and zen), so rings 6 / 15 / 19, order, pick-3, growth and
   expansion behave exactly like the farm.
   Deliberately NOT zen (no pagodas, torii, lanterns or raked gravel) and NOT jungle (no ruins, no thatch): cool jade ground,
   terraced earth slopes, mountain streams with sagging rope bridges, keepers' huts with plank-shingle roofs, soft mist puffs.
   Trees = the shared Quaternius Stylized Nature MegaKit (kit a, CC0): mountain pines and dove trees (white bracts added in
   code). Everything else — huts, terraces, bamboo groves that grow in stages (Sudoku/Math), streams, waterfalls, rope bridges,
   the panda house (Gita), and the residents (giant pandas that roll in, a cub, red pandas) — is procedural low-poly three.js,
   merged per material (Acc). No new asset files. */
import * as THREE from 'three';
import { rngFrom, TEX, world, fx, addSway } from '../engine/scene.js';
import { S, V, placed, cropStage, hooks } from '../engine/state.js';
import { TILE_TOP, cellPos, edgeCentre } from '../engine/grid.js';
import { KITCACHE, fitScale } from '../engine/kit.js';
import { G, Acc, blob } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { meadowDecor, addButterflies, flyButterflies } from '../engine/life.js';
import { FARM, FARM_ORDER, heroRight } from './farm.js';

const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.88, metalness:0, flatShading:true, ...o });
function shingleTex(){
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(31);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  for (let row=0; row<8; row++){ const y = row*8, off = row%2 ? 4 : 0;
    g.fillStyle = 'rgba(40,25,15,.28)'; g.fillRect(0, y + 7, N, 1);
    for (let x=off; x<N + 8; x+=8){ g.fillStyle = 'rgba(40,25,15,.2)'; g.fillRect(x, y, 1, 8); g.fillStyle = `rgba(255,245,230,${.05 + r()*.12})`; g.fillRect(x + 1, y, 6, 7); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}
const P = {
  wood:FM(0x9A6A42), woodD:FM(0x6B4529), woodL:FM(0xC49A66), log:FM(0x8A6446), cut:FM(0xE2C28E),
  shingle:new THREE.MeshStandardMaterial({ color:0x7C6656, roughness:.95, map:shingleTex(), flatShading:true }), shingleD:FM(0x5A483C),
  wall:FM(0xEDE2CB), wallD:FM(0xD6C8AC),
  stone:FM(0xA7AEA2), stoneD:FM(0x858D84), stoneL:FM(0xC4CAC0),
  moss:FM(0x86BC62, { roughness:1 }), mossD:FM(0x68A14C, { roughness:1 }), earth:FM(0x9B7552, { roughness:1 }), earthD:FM(0x7B5A3E, { roughness:1 }),
  water:new THREE.MeshStandardMaterial({ color:0x62C2C4, roughness:.15, metalness:0, emissive:0x0E5058, emissiveIntensity:.35 }),
  waterD:new THREE.MeshStandardMaterial({ color:0x47A6AE, roughness:.15, metalness:0, emissive:0x0B4048, emissiveIntensity:.3 }),
  fall:new THREE.MeshStandardMaterial({ color:0xDDF6F6, roughness:.2, emissive:0x7ACFD6, emissiveIntensity:.35, transparent:true, opacity:.85, flatShading:true }),
  foam:FM(0xFFFFFF, { roughness:.6 }),
  mist:new THREE.MeshStandardMaterial({ color:0xFFFFFF, emissive:0xFFFFFF, emissiveIntensity:.25, roughness:1, transparent:true, opacity:.5, depthWrite:false }),
  bamboo:FM(0x9CC75A), bambooD:FM(0x74A43E), bambooN:FM(0xD3D07A), shoot:FM(0xB59A58), shootT:FM(0x8FB54E), cane:FM(0xC9B56A),
  rope:FM(0xD9C08A), basket:FM(0xB98A4E), cloth:FM(0xE7B15A), clothR:FM(0xD0664A),
  glow:new THREE.MeshStandardMaterial({ color:0xFFE2A0, emissive:0xFFA83A, emissiveIntensity:1.1, roughness:.6, flatShading:true }),
  leaf:FM(0x5E9A44), leafL:FM(0x7CB456), rhodo:FM(0xE0679A), rhodoL:FM(0xF4A3C4), bract:FM(0xFFFFFF, { emissive:0xFFFFFF, emissiveIntensity:.12 }),
  pad:FM(0x5E9F43), lily:FM(0xF7F2E6), reed:FM(0x6E9A4A),
  // residents
  white:FM(0xF7F4EC), black:FM(0x2B2828), eye:FM(0x141212), rp:FM(0xC8552A), rpD:FM(0x7A2E1A), rpL:FM(0xF4E6D2), nose:FM(0x1E1A1A)
};
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = FM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* ── kit trees; dove trees get white hanging bracts ── */
function kitTree(g, name, h, w, x=0, y=0, z=0, rot=0){
  const tpl = KITCACHE.a && KITCACHE.a[name]; if (!tpl) { console.warn('missing', name); return null; }
  const k = fitScale(tpl, h, w), t = new THREE.Group();
  tpl.parts.forEach(pt => { const m = new THREE.Mesh(pt.geo, pt.mat); m.applyMatrix4(pt.local); m.castShadow = m.receiveShadow = true; t.add(m); });
  t.scale.setScalar(k); t.position.set(x, y, z); t.rotation.y = rot; g.add(t); return t;
}

/* ── building blocks ── */
/* gable roof, ridge along x: two shingle slabs, gable-end triangles in `endMat`, a ridge beam */
function gable(acc, cx, y, cz, w, d, h, over = .07, endMat = P.woodD){
  const half = d/2 + over, a = Math.atan2(h, d/2), L = half/Math.cos(a) + .02, yc = y + h - half/2*Math.tan(a);
  for (const sz of [-1, 1]) acc.add(box(w + over*2, .035, L), P.shingle, at(cx, yc + .018, cz + sz*half/2, 0, 1, 1, 1, sz*a));
  for (const sz of [-1, 1]) acc.add(box(w + over*2 + .01, .03, .03), P.shingleD, at(cx, y + h - half*Math.tan(a) + .005, cz + sz*half, 0, 1, 1, 1, sz*a));
  const sh = new THREE.Shape(); sh.moveTo(-d/2, 0); sh.lineTo(d/2, 0); sh.lineTo(0, h); sh.closePath();
  for (const sx of [-1, 1]) acc.add(new THREE.ExtrudeGeometry(sh, { depth:.02, bevelEnabled:false }).rotateY(Math.PI/2), endMat, at(cx + sx*(w/2 - .01), y, cz));
  acc.add(box(w + over*2 + .04, .045, .05), P.shingleD, at(cx, y + h + .01, cz));
}
/* log cabin body: cream walls with dark timber corners and sill, returns the top y */
function cabin(acc, cx, cz, w, d, h, y0 = 0){
  acc.add(box(w, h, d), P.wall, at(cx, y0 + h/2, cz));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) acc.add(box(.05, h + .01, .05), P.woodD, at(cx + sx*w/2, y0 + h/2, cz + sz*d/2));
  acc.add(box(w + .03, .04, d + .03), P.woodD, at(cx, y0 + .02, cz)); acc.add(box(w + .03, .035, d + .03), P.woodD, at(cx, y0 + h - .015, cz));
  return y0 + h;
}
function windowLit(acc, x, y, z, face = 'z', s = 1){
  if (face === 'z') { acc.add(box(.1*s, .09*s, .012), P.glow, at(x, y, z)); acc.add(box(.13*s, .018, .02), P.woodD, at(x, y - .055*s, z + .004)); acc.add(box(.012, .09*s, .016), P.woodD, at(x, y, z + .004)); }
  else { acc.add(box(.012, .09*s, .1*s), P.glow, at(x, y, z)); acc.add(box(.02, .018, .13*s), P.woodD, at(x + .004, y - .055*s, z)); acc.add(box(.016, .09*s, .012), P.woodD, at(x + .004, y, z)); }
}
function rock(acc, x, z, r, sy, rng, mat = P.stone, y = 0){ blob(acc, mat, V3(x, y + r*sy*.45, z), r, sy, 0, rng); }
function tuft(acc, x, z, rng, n = 4, y = 0, col = 0x74AE4E){ for (let i=0;i<n;i++){ const h = .07 + rng()*.08;
  acc.add(new THREE.PlaneGeometry(.02, h).translate(0, h/2, 0), swayMat(col, .2, .1), at(x + (rng()-.5)*.07, y, z + (rng()-.5)*.07, rng()*6, 1, 1, 1, (rng()-.5)*.5)); } }
function fern(acc, x, z, rng, y = 0, k = 1){ const m = swayMat(0x5E9C46, .25, .08);
  for (let i=0;i<6;i++){ const a = i/6*6.28 + rng()*.4; acc.add(new THREE.PlaneGeometry(.045*k, .17*k).translate(0, .085*k, 0), m, at(x, y, z, a, 1, 1, 1, 1.0)); } }
/* soft mist: translucent white blobs, never cast or receive shadows, dropped from ghosts */
function mist(g, puffs, seed = 1){ const a = new Acc(), r = rngFrom(seed);
  puffs.forEach(([x, y, z, s]) => { for (let i=0;i<3;i++) blob(a, P.mist, V3(x + (i - 1)*s*.9, y + (i === 1 ? s*.25 : 0), z + (r()-.5)*s*.4), s*(i === 1 ? 1 : .72), .55, 1); });
  const grp = new THREE.Group(); a.into(grp); grp.children.forEach(m => { m.castShadow = m.receiveShadow = false; m.renderOrder = 8; }); grp.userData.ghostHide = true; g.add(grp); }
/* bamboo culm: segmented, with node rings and swaying leaf sprays near the top */
function culm(acc, x, z, H, rad, lean, rng, y0 = 0, leaves = 6){
  const nseg = Math.max(2, Math.round(H/.16));
  for (let j=0;j<nseg;j++){ const y = j*H/nseg, sl = H/nseg;
    acc.add(new THREE.CylinderGeometry(rad*.95, rad, sl*.96, 6).translate(0, sl/2, 0), j%2 ? P.bamboo : P.bambooD, at(x + lean*y, y0 + y, z, 0, 1, 1, 1, 0, -lean));
    acc.add(new THREE.CylinderGeometry(rad*1.15, rad*1.15, .012, 6), P.bambooD, at(x + lean*(y + sl), y0 + y + sl, z)); }
  const lm = swayMat(0x86C04E, 1, .035), lm2 = swayMat(0x64A43C, 1, .035);
  for (let j=0;j<leaves;j++){ const y = H*(.55 + rng()*.47), la = rng()*6.28, ll = .11 + rng()*.07 + H*.04;
    acc.add(new THREE.PlaneGeometry(.05, ll).translate(0, ll/2, 0), j%2 ? lm : lm2, at(x + lean*y, y0 + y, z, la, 1, 1, 1, 1.25 + rng()*.6)); }
  if (leaves >= 8) for (let j=0;j<3;j++){ const y = H*(.62 + j*.16), la = j*2.1 + rng(), o = .05 + rng()*.03;   // leafy sprays give the grove volume
    blob(acc, j%2 ? lm : lm2, V3(x + lean*y + Math.cos(la)*o, y0 + y, z + Math.sin(la)*o), .065 + rng()*.025, .5, 0, rng); }
}
/* stepped terrace: tiers of earth walls with mossy tops. tiers = [[x, z, w, d, h], …] (h = top height) */
function terrace(acc, tiers, rng){
  tiers.forEach(([x, z, w, d, h], i) => {
    acc.add(box(w, h - .012, d), i%2 ? P.earthD : P.earth, at(x, (h - .012)/2, z));
    acc.add(box(w + .01, .024, d + .01), i%2 ? P.mossD : P.moss, at(x, h - .006, z));
    for (let k=0;k<Math.round(w*6);k++) if (rng() < .5) rock(acc, x - w/2 + (k + .5)/6, z + d/2 + .005, .022 + rng()*.012, .7, rng, P.stoneD, h*.3);
  });
}

/* ── BAMBOO TERRACE (Sudoku/Math): shoots on a two-step earth terrace thicken into a grove, stage by stage ── */
function fillGrove(host, s, stage){
  host.clear(); const acc = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 5), st = Math.min(5, stage), flip = s.v ? -1 : 1;
  const H = [0, 0, .24, .44, .62, .8][st], n = [0, 4, 4, 6, 8, 10][st];
  const clumps = [[-.16*flip, -.22, .09], [.2*flip, .16, .08]];                            // two clumps: back tier (raised) and front
  for (let i=0;i<n;i++){ const [cx, cz, cr] = clumps[i%2], ang = i*2.4 + r()*.6, d = cr*(.3 + r()*.7), x = cx + Math.cos(ang)*d, z = cz + Math.sin(ang)*d;
    const y0 = .07 + (i%2 ? 0 : .09);
    if (st === 1) { acc.add(new THREE.ConeGeometry(.03, .09 + r()*.04, 6).translate(0, .05, 0), P.shoot, at(x, y0, z, r()*3));
      acc.add(new THREE.ConeGeometry(.013, .045, 5).translate(0, .115, 0), P.shootT, at(x, y0, z)); continue; }
    culm(acc, x, z, H*(.78 + r()*.36)*(i%2 ? 1 : .92), .02 + st*.0016 + r()*.004, (Math.cos(ang))*.08*flip, r, y0, st >= 3 ? 12 : 5); }
  if (st >= 2 && st <= 4) for (let i=0;i<3;i++) acc.add(new THREE.ConeGeometry(.024, .075, 6).translate(0, .037, 0), P.shoot, at((-.3 + i*.1)*flip, .07, .34 + (i%2)*.05, r()*3));
  if (st >= 5) { // a keeper's bundle of cut canes, ready for the pandas
    for (let i=0;i<5;i++) acc.add(new THREE.CylinderGeometry(.014, .014, .34, 6).rotateZ(Math.PI/2), P.cane, at(-.14*flip, .085 + (i%2)*.022, .36 + (i - 2)*.018, .3*flip));
    acc.add(new THREE.TorusGeometry(.04, .008, 4, 10).rotateY(Math.PI/2), P.rope, at(-.14*flip, .1, .36, .3*flip)); }
  acc.into(host); host.userData.stage = stage;
}
function groveBase(g, s){
  const a = new Acc(), r = rngFrom(s.x*3 + s.z*17), flip = s.v ? -1 : 1;
  a.add(new THREE.BoxGeometry(.92, .07, .92), P.earth, at(0, .035, 0)); a.add(box(.93, .014, .93), P.moss, at(0, .07, 0));
  terrace(a, [[0, -.21, .92, .5, .16]], r);                                              // back step: a raised tier
  for (let i=0;i<4;i++) rock(a, (-.38 + i*.25)*flip, .44, .03, .7, r, P.stone, .07);
  const grp = new THREE.Group(); a.into(grp); grp.userData.ghostHide = true; g.add(grp);
}

/* ── named pieces ── */
const PB = {
  // Reading → buildings
  lodge(g){                                              // ring-1 hero: the keepers' lodge, a porch, a cub munching bamboo, a feeding rack
    const y = new Acc(), r = rngFrom(222);
    y.add(new THREE.CylinderGeometry(.9, .92, .03, 30), P.moss, at(0, .015, 0, 0, 1, 1, 1));
    const yard = new THREE.Group(); y.into(yard); yard.userData.ghostHide = true; g.add(yard);
    const b = new Acc(), cx = -.14, cz = -.2, w = 1.0, d = .66;
    b.add(box(w + .14, .08, d + .14), P.stoneD, at(cx, .04, cz));
    const top = cabin(b, cx, cz, w, d, .36, .08);
    b.add(box(.16, .26, .02), P.woodD, at(cx - .18, .21, cz + d/2 + .01)); b.add(box(.02, .02, .02), P.rope, at(cx - .13, .21, cz + d/2 + .025));
    windowLit(b, cx + .16, .28, cz + d/2 + .007); windowLit(b, cx + .36, .28, cz + d/2 + .007); windowLit(b, cx + w/2 + .007, .28, cz, 'x');
    gable(b, cx, top, cz, w, d, .3, .1);
    // porch: plank deck + two posts + a lean-to strip of roof
    b.add(box(w + .1, .04, .3), P.woodL, at(cx, .1, cz + d/2 + .15));
    for (const sx of [-1, 1]) b.add(box(.04, .36, .04), P.woodD, at(cx + sx*(w/2 + .02), .28, cz + d/2 + .28));
    b.add(box(w + .16, .03, .34), P.shingle, at(cx, .47, cz + d/2 + .16, 0, 1, 1, 1, .28));
    // stone chimney
    b.add(box(.13, .5, .13), P.stone, at(cx - .36, .55, cz - .16)); b.add(box(.15, .04, .15), P.stoneD, at(cx - .36, .81, cz - .16));
    // feeding rack with cut canes, a basket and a woodpile
    for (const sx of [-1, 1]) b.add(box(.035, .28, .035), P.woodD, at(.62 + sx*.16, .14, .5));
    b.add(box(.38, .03, .04), P.woodD, at(.62, .27, .5));
    for (let i=0;i<7;i++) b.add(new THREE.CylinderGeometry(.012, .012, .3, 5), P.cane, at(.5 + i*.04, .15, .53, 0, 1, 1, 1, -.25, 0));
    b.add(new THREE.CylinderGeometry(.085, .065, .1, 10), P.basket, at(-.66, .05, .58)); for (let i=0;i<5;i++) b.add(new THREE.CylinderGeometry(.01, .01, .16, 5), P.cane, at(-.66 + (r()-.5)*.08, .12, .58 + (r()-.5)*.06, 0, 1, 1, 1, (r()-.5)*.5, (r()-.5)*.5));
    for (let i=0;i<3;i++) for (let j=0;j<3 - i;j++) b.add(new THREE.CylinderGeometry(.035, .035, .26, 7).rotateX(Math.PI/2), P.log, at(.66 + j*.07 + i*.035, .035 + i*.06, -.5));
    for (let i=0;i<5;i++) b.add(new THREE.CylinderGeometry(.075, .085, .02, 7), P.stoneL, at(.05 + i*.04, .035, .2 + i*.15, r()*3));   // stepping stones to the porch
    fern(b, .78, -.1, r, .03); fern(b, -.8, .1, r, .03, 1.2); tuft(b, .3, .8, r, 5, .03);
    b.into(g);
    const cub = pandaSit(.62); cub.position.set(.2, .03, .6); cub.rotation.y = .5; g.add(cub);
    kitTree(g, 'Pine_3', 1.05, .6, .7, .03, -.7, .8);
    mist(g, [[-.75, .1, -.72, .1]], 7);
  },
  watchtower(g){ const a = new Acc();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(new THREE.CylinderGeometry(.022, .03, .78, 6), P.log, at(sx*.19, .39, sz*.19, 0, 1, 1, 1, sz*-.05, sx*.05));
    for (const y of [.22, .48]) { a.add(box(.42, .025, .025), P.woodD, at(0, y, .2)); a.add(box(.42, .025, .025), P.woodD, at(0, y, -.2)); a.add(box(.025, .025, .42), P.woodD, at(.2, y, 0)); a.add(box(.025, .025, .42), P.woodD, at(-.2, y, 0)); }
    a.add(box(.5, .04, .5), P.woodL, at(0, .74, 0));
    for (const [x, z, ry] of [[0, .24, 0], [0, -.24, 0], [.24, 0, Math.PI/2], [-.24, 0, Math.PI/2]]) a.add(box(.5, .1, .015), P.wood, at(x, .81, z, ry));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(box(.03, .28, .03), P.woodD, at(sx*.22, .9, sz*.22));
    a.add(new THREE.ConeGeometry(.42, .2, 4).rotateY(Math.PI/4), P.shingle, at(0, 1.13, 0)); a.add(new THREE.ConeGeometry(.44, .03, 4).rotateY(Math.PI/4), P.shingleD, at(0, 1.035, 0));
    for (let i=0;i<7;i++) a.add(box(.12, .015, .02), P.woodL, at(.28, .08 + i*.1, .12, 0, 1, 1, 1, 0, 0));   // ladder rungs
    for (const sz of [-1, 1]) a.add(box(.02, .74, .02), P.woodD, at(.28, .37, .12 + sz*.06));
    a.into(g); },
  storehouse(g){ const a = new Acc(), r = rngFrom(61);   // stilted bamboo store with bundles stacked underneath
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(new THREE.CylinderGeometry(.03, .035, .2, 6), P.log, at(sx*.25, .1, sz*.18));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(new THREE.CylinderGeometry(.05, .05, .015, 8), P.stoneD, at(sx*.25, .2, sz*.18));   // rat-guard caps
    a.add(box(.62, .04, .46), P.woodL, at(0, .22, 0));
    const top = cabin(a, 0, 0, .54, .38, .24, .24);
    for (let i=0;i<5;i++) a.add(box(.012, .22, .012), P.woodD, at(-.2 + i*.1, .36, .192));
    gable(a, 0, top, 0, .54, .38, .2, .07);
    for (let i=0;i<9;i++) a.add(new THREE.CylinderGeometry(.013, .013, .46, 5).rotateZ(Math.PI/2), P.cane, at(0, .03 + (i%3)*.026, -.07 + Math.floor(i/3)*.03));
    for (let i=0;i<5;i++) a.add(new THREE.CylinderGeometry(.012, .012, .5, 5), P.bamboo, at(.34, .24, -.2 + i*.05, 0, 1, 1, 1, 0, .22 + r()*.08));
    a.into(g); },
  nursery(g){ const a = new Acc(), r = rngFrom(71);      // round nursery hut, cradle basket with a sleeping cub
    a.add(new THREE.CylinderGeometry(.3, .32, .06, 14), P.stoneD, at(-.05, .03, -.08));
    a.add(new THREE.CylinderGeometry(.25, .26, .3, 14), P.wall, at(-.05, .21, -.08));
    for (const y of [.08, .34]) a.add(new THREE.CylinderGeometry(.262, .262, .03, 14), P.woodD, at(-.05, y, -.08));
    a.add(new THREE.CylinderGeometry(.075, .075, .02, 14).rotateX(Math.PI/2), P.woodD, at(-.05, .19, .17)); a.add(box(.15, .08, .02), P.woodD, at(-.05, .12, .17));  // round-top door
    windowLit(a, .19, .23, -.02, 'x', .8);
    a.add(new THREE.ConeGeometry(.36, .26, 14), P.shingle, at(-.05, .49, -.08)); a.add(new THREE.CylinderGeometry(.36, .36, .03, 14), P.shingleD, at(-.05, .365, -.08));
    a.add(new THREE.SphereGeometry(.035, 8, 6), P.woodD, at(-.05, .63, -.08));
    a.add(new THREE.CylinderGeometry(.11, .08, .07, 12), P.basket, at(.24, .05, .26)); a.add(new THREE.TorusGeometry(.105, .012, 4, 14).rotateX(Math.PI/2), P.woodD, at(.24, .085, .26));
    tuft(a, -.3, .3, r, 5); fern(a, .32, -.3, r);
    a.into(g);
    const cub = pandaSleep(.5); cub.position.set(.24, .075, .26); cub.rotation.y = .6; g.add(cub); },
  hut(g){ const a = new Acc(), r = rngFrom(81);          // keeper's hut: stone footing, drying rack
    a.add(box(.6, .06, .46), P.stoneD, at(-.04, .03, -.06));
    const top = cabin(a, -.04, -.06, .52, .38, .3, .06);
    a.add(box(.12, .22, .015), P.woodD, at(-.14, .17, .135)); windowLit(a, .1, .24, .133);
    gable(a, -.04, top, -.06, .52, .38, .22, .08);
    for (const sx of [-1, 1]) a.add(box(.025, .3, .025), P.woodD, at(.34, .15, .2 + sx*.13));
    a.add(new THREE.CylinderGeometry(.01, .01, .3, 4).rotateX(Math.PI/2), P.woodD, at(.34, .29, .2));
    for (let i=0;i<4;i++) a.add(box(.012, .15, .06), i%2 ? P.cloth : P.clothR, at(.34, .21, .1 + i*.07));
    for (let i=0;i<3;i++) rock(a, -.35 + r()*.1, .32 + r()*.06, .04, .8, r);
    a.into(g); },
  climb(g){ const a = new Acc();                         // climbing frame: two decks, a rope net, a log ramp and a hammock
    for (const [x, z, h] of [[-.3, -.3, .62], [.12, -.3, .62], [-.3, .08, .62], [.12, .08, .62], [.34, .3, .36], [.1, .3, .36]]) a.add(new THREE.CylinderGeometry(.024, .03, h, 6), P.log, at(x, h/2, z));
    a.add(box(.5, .035, .46), P.woodL, at(-.09, .56, -.11)); a.add(box(.32, .03, .12), P.woodL, at(.22, .33, .3));
    a.add(new THREE.CylinderGeometry(.03, .03, .62, 7).rotateZ(Math.PI/2), P.log, at(.02, .43, .2, -.55, 1, 1, 1, 0, -.35));
    for (let i=0;i<5;i++) a.add(box(.008, .52, .008), P.rope, at(-.3 + i*.1, .3, .085)); for (let j=0;j<4;j++) a.add(box(.42, .008, .008), P.rope, at(-.09, .1 + j*.13, .085));
    const cloth = new THREE.CylinderGeometry(.09, .09, .3, 10, 1, true, Math.PI*.6, Math.PI*.8).rotateZ(Math.PI/2);
    a.add(cloth, P.cloth, at(-.09, .34, -.3 + .0));
    a.add(new THREE.CylinderGeometry(.012, .012, .8, 5).rotateZ(Math.PI/2), P.rope, at(-.09, .5, -.3, 0, .6));
    a.into(g); },
  // Breathe → water
  spring(g){ const a = new Acc(), r = rngFrom(44);       // a mossy rock pool with mist lifting off it
    a.add(new THREE.CylinderGeometry(.4, .42, .03, 16), P.moss, at(0, .015, 0));
    a.add(new THREE.CylinderGeometry(.3, .3, .02, 16), P.water, at(.02, .04, .03, 0, 1, 1, .9));
    for (let i=0;i<11;i++){ const ang = i/11*6.28 + r()*.3; rock(a, .02 + Math.cos(ang)*.33, .03 + Math.sin(ang)*.3, .05 + r()*.04, .75, r, i%3 ? P.stone : P.stoneD, .02); }
    rock(a, -.2, -.22, .13, 1.1, r, P.stoneD); rock(a, -.08, -.28, .09, 1, r, P.stone);
    a.add(box(.06, .16, .015), P.fall, at(-.1, .13, -.16, .4)); blob(a, P.foam, V3(-.08, .06, -.1), .035, .5, 0, r);
    fern(a, .3, -.3, r, .02); tuft(a, -.34, .3, r, 5, .02);
    a.into(g); mist(g, [[.05, .14, .06, .11], [.16, .2, -.05, .07]], 44); },
  waterfall(g){ const a = new Acc(), r = rngFrom(55);    // a spill down stepped terraces into a pool
    terrace(a, [[-.12, -.22, .7, .5, .48], [-.2, -.34, .54, .3, .72]], r);
    a.add(box(.14, .02, .12), P.water, at(-.08, .485, -.02)); a.add(box(.12, .02, .1), P.water, at(-.1, .725, -.22));
    a.add(box(.1, .26, .02), P.fall, at(-.1, .6, -.18)); a.add(box(.12, .45, .02), P.fall, at(-.08, .25, .04));
    a.add(new THREE.CylinderGeometry(.26, .27, .02, 16), P.water, at(.08, .045, .2, 0, 1.15, 1, .8));
    for (let i=0;i<5;i++) blob(a, P.foam, V3(-.08 + (r()-.5)*.1, .06, .1 + (r()-.5)*.05), .03, .5, 0, r);
    for (let i=0;i<9;i++){ const ang = -.2 + i/8*3.2; rock(a, .08 + Math.cos(ang)*.32, .2 + Math.sin(ang)*.22, .04 + r()*.03, .7, r); }
    a.into(g); kitTree(g, 'Pine_1', .55, .3, .28, .48, -.3, 1);
    mist(g, [[-.02, .12, .18, .1], [-.2, .66, -.05, .07]], 55); },
  stream(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 11);   // a mountain stream running across the tile, stepping stones
    a.add(box(.97, .02, .97), P.moss, at(0, .01, 0));
    a.add(box(.34, .02, .98), P.water, at(0, .03, 0, .12));
    for (const sx of [-1, 1]) for (let i=0;i<6;i++) rock(a, sx*(.2 + r()*.04) + (-.42 + i*.17)*.12, -.42 + i*.17, .035 + r()*.025, .7, r, i%2 ? P.stone : P.stoneD, .02);
    for (const [x, z] of [[-.05, -.14], [.06, .02], [-.02, .18]]) a.add(new THREE.CylinderGeometry(.06, .065, .04, 7), P.stoneL, at(x, .04, z, r()*3));
    for (let i=0;i<3;i++) blob(a, P.foam, V3(.02 + (r()-.5)*.1, .045, -.3 + i*.26), .022, .4, 0, r);
    for (let i=0;i<4;i++) a.add(new THREE.CylinderGeometry(.006, .006, .22, 4), P.reed, at(-.38 + (r()-.5)*.06, .12, .3 + (r()-.5)*.1, 0, 1, 1, 1, (r()-.5)*.3));
    fern(a, .36, -.32, r, .02); tuft(a, .36, .34, r, 5, .02); tuft(a, -.36, -.3, r, 4, .02);
    a.into(g); mist(g, [[.02, .1, .3, .07]], s.x*5 + s.z); },
  pool(g){ const a = new Acc(), r = rngFrom(66);          // a still mountain pool: lilies, reeds, a mossy boulder
    a.add(new THREE.CylinderGeometry(.44, .46, .03, 22), P.mossD, at(0, .015, 0, 0, 1, 1, .92));
    a.add(new THREE.CylinderGeometry(.37, .37, .02, 22), P.waterD, at(0, .04, 0, 0, 1, 1, .88));
    for (let i=0;i<13;i++){ const ang = i/13*6.28 + r()*.2; rock(a, Math.cos(ang)*.41, Math.sin(ang)*.38, .045 + r()*.03, .7, r, i%3 ? P.stone : P.stoneD, .02); }
    [[-.18, .1], [.14, -.16], [.2, .16]].forEach(([x, z], i) => { a.add(G.pad, P.pad, at(x, .053, z, i)); if (i !== 1) a.add(new THREE.IcosahedronGeometry(.022, 0), P.lily, at(x, .07, z)); });
    rock(a, -.14, -.16, .09, .9, r, P.stoneD, .04); a.add(new THREE.CylinderGeometry(.07, .08, .02, 8), P.moss, at(-.14, .12, -.16));
    for (let i=0;i<6;i++) a.add(new THREE.CylinderGeometry(.005, .006, .24, 4), P.reed, at(.3 + (r()-.5)*.1, .13, -.28 + (r()-.5)*.1, 0, 1, 1, 1, (r()-.5)*.3, (r()-.5)*.3));
    a.into(g); mist(g, [[.05, .1, .12, .09]], 66); },
  // Vocab → trees
  tree(g, s){ kitTree(g, s.model, s.h || 1.3, s.w || .98, 0, 0, 0, (s.rot||0)*Math.PI/180);
    const a = new Acc(), r = rngFrom(s.x*5 + s.z*11); a.add(new THREE.CylinderGeometry(.24, .26, .015, 10), P.mossD, at(.02, .008, .02));
    if (s.dove) for (let i=0;i<30;i++){ const ang = r()*6.28, d = .16 + r()*.24, y = (s.h || 1.3)*(.48 + r()*.38);   // dove-tree bracts, hanging like handkerchiefs
      a.add(new THREE.PlaneGeometry(.06, .08), P.bract, at(Math.cos(ang)*d, y, Math.sin(ang)*d, ang, 1, 1, 1, .2)); }
    fern(a, .3, .28, r, .01, .9); a.into(g); },
  rhodo(g, s){ const a = new Acc(), r = rngFrom(s.x*9 + s.z*13 + 4);   // rhododendron shrubs, pink-flowered
    a.add(new THREE.CylinderGeometry(.34, .36, .02, 12), P.mossD, at(0, .01, 0));
    for (const [x, z, k] of [[-.12, -.1, 1], [.16, .06, .85], [-.05, .2, .7], [.2, -.22, .6]]) {
      blob(a, r() < .5 ? P.leaf : P.leafL, V3(x, .2*k, z), .2*k, .8, 1, r); blob(a, P.leaf, V3(x + .05, .33*k, z - .04), .13*k, .8, 1, r);
      for (let i=0;i<9;i++){ const ang = r()*6.28, e = r()*1.2; a.add(new THREE.IcosahedronGeometry(.03*k + .01, 0), r() < .5 ? P.rhodo : P.rhodoL,
        at(x + Math.cos(ang)*Math.cos(e)*.19*k, .22*k + Math.sin(e)*.17*k, z + Math.sin(ang)*Math.cos(e)*.19*k)); } }
    a.into(g); },
  // To-dos → paths
  path(g, s){ const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 'plain';
    const slab = new THREE.Mesh(G.path, P.moss); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
    if (v === 'bridge') { // a stream crossing under a sagging rope bridge
      a.add(box(.97, .02, .4), P.water, at(0, .04, 0)); for (const sz of [-1, 1]) for (let i=0;i<6;i++) rock(a, -.42 + i*.17, sz*(.22 + r()*.03), .04 + r()*.02, .7, r, P.stone, .03);
      for (let i=0;i<3;i++) blob(a, P.foam, V3(-.3 + i*.3, .052, (r()-.5)*.1), .02, .4, 0, r);
      const n = 11, L = .96, top = .22, sag = .08, Y = t => top - Math.sin(Math.PI*t)*sag;
      for (let i=0;i<n;i++){ const t = (i + .5)/n; a.add(box(.024, .016, .2), i%3 ? P.woodL : P.wood, at(-L/2 + L*t, Y(t), 0, 0, 1, 1, 1, 0, 0)); }
      for (const sz of [-1, 1]) { const m = 12; for (let i=0;i<m;i++){ const t0 = i/m, t1 = (i + 1)/m, x0 = -L/2 + L*t0, x1 = -L/2 + L*t1, y0 = Y(t0) + .16 - Math.sin(Math.PI*t0)*.02, y1 = Y(t1) + .16 - Math.sin(Math.PI*t1)*.02;
          a.add(new THREE.CylinderGeometry(.006, .006, Math.hypot(x1 - x0, y1 - y0), 4).rotateZ(Math.PI/2), P.rope, at((x0 + x1)/2, (y0 + y1)/2, sz*.11, 0, 1, 1, 1, 0, Math.atan2(y1 - y0, x1 - x0)));
          a.add(new THREE.CylinderGeometry(.004, .004, .16, 3), P.rope, at(x0, Y(t0) + .08, sz*.11)); } }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { a.add(new THREE.CylinderGeometry(.025, .03, .44, 6), P.log, at(sx*.46, .22, sz*.12)); a.add(new THREE.SphereGeometry(.028, 6, 4), P.woodD, at(sx*.46, .45, sz*.12)); }
    } else {
      for (let i=0;i<4;i++) a.add(box(.2, .025, .56), i%2 ? P.woodL : P.wood, at(-.3 + i*.2, .045, (r()-.5)*.04, (r()-.5)*.06));   // plank boardwalk
      for (const sz of [-1, 1]) a.add(box(.9, .02, .03), P.woodD, at(0, .03, sz*.24));
      if (v === 'basket') { a.add(new THREE.CylinderGeometry(.1, .075, .12, 10), P.basket, at(.3, .12, .36)); for (let i=0;i<6;i++) a.add(new THREE.CylinderGeometry(.01, .01, .2, 5), P.cane, at(.3 + (r()-.5)*.08, .19, .36 + (r()-.5)*.06, 0, 1, 1, 1, (r()-.5)*.5, (r()-.5)*.5)); fern(a, -.34, -.36, r, .02); }
      else if (v === 'steps') { terrace(a, [[0, -.37, .97, .22, .12]], r); for (let i=0;i<3;i++) a.add(box(.26, .04, .08), P.stoneL, at(.3, .03 + i*.045, -.2 - i*.07)); }
      else if (v === 'bench') { for (const sx of [-1, 1]) a.add(new THREE.CylinderGeometry(.04, .04, .1, 7), P.log, at(-.26 + sx*.14, .1, .36)); a.add(new THREE.CylinderGeometry(.045, .045, .38, 8).rotateZ(Math.PI/2), P.log, at(-.26, .17, .36)); a.add(new THREE.CircleGeometry(.045, 8).rotateY(Math.PI/2), P.cut, at(-.07, .17, .36)); tuft(a, .34, -.36, r, 5, .02); }
      else { tuft(a, .36, .36, r, 5, .02); tuft(a, -.36, -.36, r, 4, .02); }
    }
    a.into(g); if (v === 'plain') g.userData.ghostMode = 'marker'; },
  fence(g, s){ const a = new Acc(), r = rngFrom(s.x*3 + s.z*7 + 2), L = s.len;   // split-rail log fence, rope lashings, tall grass
    const P1 = (u, y, geo, mat, ry = 0) => s.edge === 'w' ? a.add(geo, mat, at(-.45, y, u, ry)) : a.add(geo, mat, at(u, y, .45, ry));
    for (let i=0;i<=L*2;i++){ const u = -L/2 + i/2; P1(u, .15, new THREE.CylinderGeometry(.026, .03, .3, 6), P.log); P1(u, .305, new THREE.ConeGeometry(.03, .03, 6), P.woodD);
      for (const y of [.12, .23]) P1(u, y, new THREE.CylinderGeometry(.033, .033, .02, 6), P.rope); }
    for (const y of [.12, .23]) { const geo = new THREE.CylinderGeometry(.017, .017, L, 6).rotateZ(Math.PI/2); s.edge === 'w' ? a.add(geo, P.log, at(-.45, y, 0, Math.PI/2)) : a.add(geo, P.log, at(0, y, .45)); }
    for (let i=0;i<L*3;i++){ const u = -L/2 + (i + .5)/3; s.edge === 'w' ? tuft(a, -.42, u, r, 3, 0, 0x7CB456) : tuft(a, u, .42, r, 3, 0, 0x7CB456); }
    a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz); },
  // Gita → the panda house on a terraced hill
  house(g){ const a = new Acc(), r = rngFrom(404);
    a.add(new THREE.CylinderGeometry(.92, .95, .04, 32), P.moss, at(0, .02, 0));
    terrace(a, [[-.12, -.12, 1.5, 1.5, .14], [-.2, -.2, 1.22, 1.22, .28]], r);
    for (let i=0;i<4;i++) a.add(box(.24, .04, .1), P.stoneL, at(.48 - i*.04, .03 + i*.07, .66 - i*.12, 0));   // steps up the terraces
    const cx = -.22, cz = -.26, w = 1.0, d = .72, y0 = .28;
    const top = cabin(a, cx, cz, w, d, .4, y0);
    // big round moon door and a carved panda face above it (no text)
    a.add(new THREE.CylinderGeometry(.14, .14, .02, 20).rotateX(Math.PI/2), P.woodD, at(cx, y0 + .17, cz + d/2 + .012));
    a.add(new THREE.CylinderGeometry(.115, .115, .02, 20).rotateX(Math.PI/2), P.glow, at(cx, y0 + .17, cz + d/2 + .016));
    a.add(box(.24, .03, .02), P.wall, at(cx, y0 + .015, cz + d/2 + .02));
    windowLit(a, cx - .34, y0 + .22, cz + d/2 + .007); windowLit(a, cx + .34, y0 + .22, cz + d/2 + .007); windowLit(a, cx + w/2 + .007, y0 + .22, cz + .1, 'x'); windowLit(a, cx + w/2 + .007, y0 + .22, cz - .18, 'x');
    gable(a, cx, top, cz, w, d, .36, .12);
    // panda-face gable plaque + round "ear" finials on the ridge ends
    const py = top + .13, pz = cz + d/2 + .105;
    a.add(new THREE.CylinderGeometry(.1, .1, .02, 18).rotateX(Math.PI/2), P.white, at(cx, py, pz));
    for (const sx of [-1, 1]) { a.add(new THREE.CylinderGeometry(.042, .042, .02, 12).rotateX(Math.PI/2), P.black, at(cx + sx*.075, py + .075, pz - .005));
      a.add(new THREE.CylinderGeometry(.026, .026, .012, 10).rotateX(Math.PI/2), P.black, at(cx + sx*.038, py + .01, pz + .012, 0, 1, 1, 1.3, 0, sx*.5));
      a.add(new THREE.SphereGeometry(.007, 6, 4), P.white, at(cx + sx*.036, py + .016, pz + .02)); }
    a.add(new THREE.SphereGeometry(.014, 6, 4), P.black, at(cx, py - .03, pz + .012));
    for (const sx of [-1, 1]) { a.add(new THREE.SphereGeometry(.06, 10, 8), P.black, at(cx + sx*(w/2 + .15), top + .38, cz)); }
    // wide front deck with a big feeding trough of fresh bamboo
    a.add(box(w + .2, .04, .34), P.woodL, at(cx, y0 + .02, cz + d/2 + .18));
    for (const sx of [-1, 0, 1]) a.add(box(.04, .06, .04), P.woodD, at(cx + sx*(w/2 + .08), y0 - .01, cz + d/2 + .33));
    a.add(box(.4, .08, .12), P.wood, at(cx + .26, y0 + .08, cz + d/2 + .22)); for (let i=0;i<8;i++) a.add(new THREE.CylinderGeometry(.011, .011, .36, 5).rotateZ(Math.PI/2), P.bamboo, at(cx + .26, y0 + .13 + (i%2)*.015, cz + d/2 + .18 + (i%4)*.022, (r()-.5)*.2));
    // a waterfall spilling off the terraces into a small pool on the right
    a.add(box(.14, .26, .02), P.fall, at(.62, .15, -.52, Math.PI/2)); a.add(new THREE.CylinderGeometry(.18, .19, .02, 14), P.water, at(.72, .04, -.3, 0, 1, 1, 1.3));
    for (let i=0;i<7;i++){ const ang = i/7*6.28; rock(a, .72 + Math.cos(ang)*.2, -.3 + Math.sin(ang)*.26, .035 + r()*.02, .7, r, P.stone, .02); }
    // bamboo stands flanking the house
    for (let i=0;i<6;i++) culm(a, -.8 + r()*.12, -.4 + i*.14, .75 + r()*.3, .02, (r()-.5)*.08, r, .28);
    for (let i=0;i<5;i++) culm(a, .15 + i*.12, -.84 + r()*.08, .6 + r()*.25, .019, (r()-.5)*.08, r, .28);
    fern(a, .7, .6, r, .03, 1.2); fern(a, -.7, .72, r, .03); rock(a, .1, .78, .07, .8, r, P.stoneD, .03);
    a.into(g);
    const cub = pandaSit(.66); cub.position.set(cx - .3, y0 + .04, cz + d/2 + .2); cub.rotation.y = .3; g.add(cub);
    kitTree(g, 'CommonTree_2', 1.3, .8, -.74, .28, -.8, 2.2);
    mist(g, [[-.8, .5, .6, .12], [.7, .16, -.3, .1], [.2, .35, -.95, .1]], 404);
  }
};

/* blueprint: every farm slot id → a sanctuary piece (same cells, same rings, same order), hero in the right-hand corner */
const MAP = {
  bigbarn:{ name:'Keepers’ lodge', b:'lodge' },
  silo:{ name:'Watchtower', b:'watchtower' }, silohouse:{ name:'Bamboo store', b:'storehouse' }, coop:{ name:'Cub nursery', b:'nursery' },
  smallbarn:{ name:'Keeper’s hut', b:'hut' }, openbarn:{ name:'Climbing frame', b:'climb' },
  well:{ name:'Misty spring', b:'spring' }, watertower:{ name:'Terrace falls', b:'waterfall' }, pump:{ name:'Mountain stream', b:'stream' }, pond:{ name:'Lily pool', b:'pool' },
  apple1:{ name:'Dove tree', b:'tree', model:'CommonTree_1', dove:true, rot:20, h:1.25, w:.95 }, apple2:{ name:'Mountain pine', b:'tree', model:'Pine_3', rot:140, h:1.4, w:.85 },
  berry1:{ name:'Rhododendron', b:'rhodo' }, orange1:{ name:'Mountain pine', b:'tree', model:'Pine_1', rot:0, h:1.45, w:.9 },
  apple3:{ name:'Dove tree', b:'tree', model:'CommonTree_2', dove:true, rot:260, h:1.25, w:.95 }, berry2:{ name:'Rhododendron', b:'rhodo' },
  orange2:{ name:'Mountain pine', b:'tree', model:'Pine_5', rot:200, h:1.4, w:.9 }, apple4:{ name:'Dove tree', b:'tree', model:'CommonTree_3', dove:true, rot:60, h:1.25, w:.95 },
  peepal:{ name:'Panda house', b:'house' }
};
const PATH_V = { path3_4:['plain','Plank walk'], path3_5:['basket','Shoot basket'], path1_2:['bridge','Rope bridge'], path5_2:['steps','Terrace steps'],
  path3_6:['bench','Log bench'], path2_6:['bridge','Rope bridge'], path3_0:['basket','Shoot basket'] };
export const PANDA = heroRight(FARM).map((f, i) => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') return { ...s, kind:'grove', name:i%3 === 1 ? 'Bamboo terrace' : 'Bamboo grove', v:i%2, stages:5 };
  if (f.kind === 'path') { const [v, name] = PATH_V[f.id] || ['plain', 'Plank walk']; return { ...s, kind:'p', b:'path', v, name }; }
  if (f.kind === 'fence') return { ...s, kind:'p', b:'fence', edge:f.edge, len:f.len, name:'Log fence' };
  return { ...s, kind:'p', ...MAP[f.id] };
});

/* ── ground: cool jade grass with dew-pale patches and clover, on layered hill earth ── */
const TILE = { top:['#8CC47C','#85BD75'], side:'#77AC68', soilTop:'#94775A', soilBot:'#4E4238' };
function tileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(139);
  g.fillStyle = '#EEF2EC'; g.fillRect(0, 0, N, N);
  for (let i=0;i<16;i++){ const x = r()*N, y = r()*N, rad = 20 + r()*44, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, r() < .6 ? 'rgba(250,255,252,.42)' : 'rgba(40,90,60,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); }
  g.lineCap = 'round';
  for (let i=0;i<220;i++){ const x = r()*N, y = r()*N, len = 4 + r()*6, a = -Math.PI/2 + (r()-.5)*.9;
    g.strokeStyle = r() < .55 ? 'rgba(40,95,65,.13)' : 'rgba(250,255,250,.75)'; g.lineWidth = 1.3 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a)*len, y + Math.sin(a)*len); g.stroke(); }
  for (let i=0;i<14;i++){ const x = 16 + r()*(N - 32), y = 16 + r()*(N - 32);                  // clover trios
    for (let k=0;k<3;k++){ g.fillStyle = 'rgba(70,130,80,.3)'; g.beginPath(); g.arc(x + Math.cos(k*2.1)*2.6, y + Math.sin(k*2.1)*2.6, 2.4, 0, 6.3); g.fill(); } }
  for (let i=0;i<12;i++){ g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(16 + r()*(N - 32), 16 + r()*(N - 32), 1.3 + r()*.8, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ── ambient: drifting mist puffs + butterflies ── */
const MIST_GEO = new THREE.IcosahedronGeometry(1, 1);
const MIST_AMB = new THREE.MeshStandardMaterial({ color:0xFFFFFF, emissive:0xFFFFFF, emissiveIntensity:.3, roughness:1, transparent:true, opacity:.34, depthWrite:false });
function mistBank(k){ const grp = new THREE.Group();
  [[0, 0, 0, 1], [.9, -.1, .15, .75], [-.85, -.12, -.1, .7], [.35, .28, -.05, .6]].forEach(([x, y, z, s]) => { const m = new THREE.Mesh(MIST_GEO, MIST_AMB);
    m.position.set(x*k, y*k, z*k); m.scale.set(s*k, s*k*.5, s*k*.8); m.renderOrder = 9; grp.add(m); });
  return grp; }
function pandaAmbient(){
  V.mist = []; addButterflies();
  const R = V.ring + .1, r = rngFrom(88), n = 2 + V.ring*2;
  for (let i=0;i<n;i++){ const b = mistBank(.2 + r()*.12);
    b.userData = { x0:0, z:(r()*2 - 1)*R, span:2*R, sp:.035 + r()*.03, ph:r(), y:TILE_TOP + .12 + r()*.25, bob:r()*6 };
    world.add(b); V.mist.push(b); V.life.push(b); }
  moveLife(2.1);
}
function moveLife(t){
  if (!V) return; flyButterflies(t);
  (V.mist || []).forEach(b => { const u = b.userData, k = ((t*u.sp + u.ph) % 1 + 1) % 1;
    b.position.set(-u.span/2 + k*u.span, u.y + Math.sin(t*.5 + u.bob)*.04, u.z + Math.sin(t*.3 + u.bob)*.1);
    const fade = Math.min(1, Math.min(k, 1 - k)*6); b.scale.setScalar(Math.max(.001, fade)); });
  (V.pandaRes || []).forEach(o => { const u = o.userData; if (u.rolling) return;
    if (u.head) u.head.rotation.x = Math.sin(t*2.2 + u.ph)*.07;
    if (u.tail) u.tail.rotation.y = Math.sin(t*1.6 + u.ph)*.35; });
}

/* ── residents: code-built giant pandas (sitting, munching), a cub, red pandas ── */
function ell(acc, mat, x, y, z, sx, sy, sz, rx = 0, rz = 0, det = 1){ acc.add(new THREE.IcosahedronGeometry(1, det), mat, at(x, y, z, 0, sx, sy, sz, rx, rz)); }
function pandaFace(acc, y, z, k){
  ell(acc, P.white, 0, y, z, .105*k, .095*k, .095*k, 0, 0, 2);
  for (const sx of [-1, 1]) { ell(acc, P.black, sx*.08*k, y + .075*k, z - .01*k, .036*k, .036*k, .026*k);            // ears
    ell(acc, P.black, sx*.042*k, y + .008*k, z + .08*k, .026*k, .034*k, .014*k, 0, sx*.6);                         // eye patches
    acc.add(new THREE.SphereGeometry(.009*k, 6, 4), P.white, at(sx*.04*k, y + .015*k, z + .092*k)); }
  ell(acc, P.white, 0, y - .03*k, z + .075*k, .04*k, .03*k, .03*k);
  ell(acc, P.nose, 0, y - .018*k, z + .1*k, .014*k, .01*k, .01*k, 0, 0, 0);
}
/* sitting panda holding a bamboo stalk. k = 1 → ~.4 tiles tall */
function pandaSit(k = 1){
  const o = new THREE.Group(), body = new THREE.Group(), a = new Acc(); o.add(body);
  ell(a, P.white, 0, .15*k, 0, .135*k, .15*k, .12*k, 0, 0, 2);
  ell(a, P.black, 0, .22*k, -.005*k, .142*k, .06*k, .126*k, 0, 0, 2);                          // shoulder band
  for (const sx of [-1, 1]) { ell(a, P.black, sx*.1*k, .045*k, .1*k, .05*k, .045*k, .07*k);      // feet
    ell(a, P.black, sx*.115*k, .17*k, .07*k, .042*k, .09*k, .045*k, .5, sx*.3); }                 // arms
  a.add(new THREE.CylinderGeometry(.01*k, .01*k, .3*k, 5), P.bamboo, at(.03*k, .24*k, .12*k, 0, 1, 1, 1, .1, -.35));
  for (let i=0;i<3;i++) a.add(new THREE.PlaneGeometry(.03*k, .09*k).translate(0, .045*k, 0), P.leafL, at(.08*k, .37*k, .13*k, i*2, 1, 1, 1, .9));
  a.into(body);
  const head = new THREE.Group(); head.position.set(0, .31*k, .02*k); body.add(head); const h = new Acc(); pandaFace(h, 0, 0, k); h.into(head);
  o.userData = { kind:'panda', head, body, r:.17*k }; return o;
}
/* curled-up sleeping cub */
function pandaSleep(k = 1){
  const o = new THREE.Group(), a = new Acc();
  ell(a, P.white, 0, .08*k, 0, .13*k, .08*k, .1*k, 0, 0, 2); ell(a, P.black, .02*k, .09*k, 0, .06*k, .08*k, .105*k, 0, 0, 2);
  ell(a, P.black, -.1*k, .04*k, .06*k, .04*k, .035*k, .045*k); ell(a, P.black, .12*k, .04*k, .05*k, .04*k, .035*k, .045*k);
  const hg = new Acc(); pandaFace(hg, 0, 0, k*.9); const head = new THREE.Group(); hg.into(head); head.position.set(-.1*k, .09*k, .05*k); head.rotation.set(.3, -.9, .5); o.add(head);
  a.into(o); return o;
}
/* red panda, standing on all fours with a ringed bushy tail. ~.2 tiles tall */
function redPanda(k = 1){
  const o = new THREE.Group(), body = new THREE.Group(), a = new Acc(); o.add(body);
  ell(a, P.rp, 0, .11*k, 0, .07*k, .06*k, .12*k, 0, 0, 2);
  ell(a, P.rpD, 0, .085*k, 0, .066*k, .04*k, .11*k, 0, 0, 1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(new THREE.CylinderGeometry(.02*k, .018*k, .08*k, 6), P.rpD, at(sx*.04*k, .04*k, sz*.075*k));
  a.into(body);
  const head = new THREE.Group(); head.position.set(0, .16*k, .12*k); body.add(head); const h = new Acc();
  ell(h, P.rp, 0, 0, 0, .062*k, .055*k, .058*k, 0, 0, 2);
  ell(h, P.rpL, 0, -.012*k, .045*k, .038*k, .026*k, .028*k);
  for (const sx of [-1, 1]) { ell(h, P.rpL, sx*.035*k, .012*k, .045*k, .016*k, .014*k, .01*k); h.add(new THREE.SphereGeometry(.008*k, 6, 4), P.eye, at(sx*.024*k, .01*k, .055*k));
    h.add(new THREE.ConeGeometry(.02*k, .035*k, 5), P.rpL, at(sx*.042*k, .055*k, -.005*k, 0, 1, 1, 1, 0, -sx*.3)); h.add(new THREE.ConeGeometry(.013*k, .025*k, 5), P.rpD, at(sx*.042*k, .052*k, .0, 0, 1, 1, 1, 0, -sx*.3)); }
  h.add(new THREE.SphereGeometry(.009*k, 6, 4), P.nose, at(0, -.008*k, .08*k)); h.into(head);
  const tail = new THREE.Group(); tail.position.set(0, .12*k, -.11*k); body.add(tail); const t = new Acc();
  for (let i=0;i<6;i++) ell(t, i%2 ? P.rpL : P.rp, 0, .01*k - i*.012*k, -.03*k - i*.028*k, .034*k, .034*k, .02*k, .6, 0, 1);
  t.into(tail);
  o.userData = { kind:'redpanda', head, tail }; return o;
}
const RES_BUILD = { Pandas:() => pandaSit(1.4), Cub:() => pandaSit(.85), RedPandas:() => redPanda(1.6) };
const RES_SPOTS = { Pandas:[[[0.2, 2.7], .9], [[0.35, 4.05], 1.9]], Cub:[[[0.8, 4.75], 1.2]], RedPandas:[[[1.15, 6.1], 2.4], [[5.2, 6.15], -.6]] };
function placeRes(id){
  return RES_SPOTS[id].map(([[x, z], face], i) => { const o = RES_BUILD[id](); const to = cellPos(x, z);
    o.userData.ph = i*1.3 + id.length; o.userData.to = to; o.rotation.y = face; o.position.copy(to); o.position.y = TILE_TOP;
    o.traverse(m => { if (m.isMesh) m.castShadow = true; }); world.add(o); (V.pandaRes = V.pandaRes || []).push(o); return o; });
}
async function pandaMoveIn(walk){
  V.residentsIn = true; V.pandaRes = [];
  const ids = ['Pandas', 'Cub', 'RedPandas'];
  for (let i=0;i<ids.length;i++){
    const id = ids[i], objs = placeRes(id), roll = id !== 'RedPandas';
    if (walk) await new Promise(res => {
      const from = objs.map((o, j) => cellPos(3 + (j - .5)*.4, 7.3)), finalFace = RES_SPOTS[id].map(s => s[1]);
      objs.forEach((o, j) => { const d = o.userData.to.clone().sub(from[j]); o.rotation.y = Math.atan2(d.x, d.z); o.userData.rolling = roll; });
      const dist = objs.map((o, j) => o.userData.to.distanceTo(from[j]));
      tween(S.rm ? 1 : (roll ? 1700 : 1300), t => objs.forEach((o, j) => { const e = 1 - Math.pow(1 - t, 2.2), to = o.userData.to;
        o.position.lerpVectors(from[j], to, e);
        if (roll) { const b = o.userData.body, rr = o.userData.r; b.rotation.x = e*dist[j]/rr*.5; b.position.set(0, rr - Math.cos(b.rotation.x)*rr + 0, Math.sin(b.rotation.x)*rr*.2); o.position.y = TILE_TOP; }
        else o.position.y = TILE_TOP + Math.abs(Math.sin(t*22))*.02; }),
        () => { objs.forEach((o, j) => { o.position.copy(o.userData.to); o.rotation.y = finalFace[j]; o.userData.rolling = false;
          if (o.userData.body) { o.userData.body.rotation.x = 0; o.userData.body.position.set(0, 0, 0); }
          sparkle(o.userData.to.clone().setY(TILE_TOP + .3), 8, 0xFFF0B0, .5); }); res(); });
    });
    V.arrived = i + 1; hooks.renderChrome();
    if (walk) await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = ids.length;
}
/* landing fx: a soft puff of mist rolls out from the piece */
function mistPuff(pos, big){
  const n = big ? 12 : 8;
  for (let i=0;i<n;i++){ const m = new THREE.Mesh(MIST_GEO, P.mist.clone()); m.renderOrder = 9;
    const a = i/n*6.28 + Math.random()*.3, d = (big ? .75 : .45) + Math.random()*.25, s = .07 + Math.random()*.05; m.position.copy(pos); fx.add(m);
    tween(1100 + Math.random()*300, t => { const e = 1 - Math.pow(1 - t, 3); m.position.set(pos.x + Math.cos(a)*d*e, pos.y + .06 + e*.14, pos.z + Math.sin(a)*d*e);
      m.scale.set(s*(1 + e*1.4), s*(1 + e*1.4)*.55, s*(1 + e*1.4)); m.material.opacity = .55*(1 - t); }, () => { fx.remove(m); m.material.dispose(); });
  }
}

export default {
  id:'panda', name:'Pandas', title:'Your sanctuary',
  season:39, dates:'28 Jun–11 Jul', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'springs, streams & falls', tag:'Water' },
    building:{ label:'keepers’ huts & lodge',  tag:'Building' },
    path:    { label:'boardwalks & rope bridges',  tag:'Path' },
    crop:    { label:'bamboo groves',            tag:'Grove' },
    tree:    { label:'pines, dove trees & rhododendrons', tag:'Tree' },
    special: { label:'the panda house',          tag:'Special' }
  },
  slots:PANDA, order:FARM_ORDER,
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><circle cx="6.2" cy="6.4" r="3" fill="#2B2828"/><circle cx="17.8" cy="6.4" r="3" fill="#2B2828"/><circle cx="12" cy="13" r="8" fill="#F7F4EC" stroke="#2B2828" stroke-width="1.2"/><ellipse cx="8.9" cy="12.4" rx="1.9" ry="2.5" transform="rotate(-30 8.9 12.4)" fill="#2B2828"/><ellipse cx="15.1" cy="12.4" rx="1.9" ry="2.5" transform="rotate(30 15.1 12.4)" fill="#2B2828"/><ellipse cx="12" cy="16.2" rx="1.4" ry="1" fill="#2B2828"/></svg>',
  silhouette:'<g fill="currentColor"><circle cx="40" cy="44" r="12"/><circle cx="88" cy="44" r="12"/><ellipse cx="64" cy="66" rx="30" ry="27"/><ellipse cx="64" cy="104" rx="36" ry="22"/><path d="M104 118V30h4v88zM114 118V40h4v78zM20 118V36h4v82z"/><path d="M106 34l10-6-2 6zM116 44l8-4-2 5zM22 40l-9-5 2 6z"/></g>',
  album:{ image:'assets/panda/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E6F2E6)' },
  css:'.phone[data-theme="panda"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#EEF6EC 58%,#D9EAD6 100%)}',
  ground:{ tile:TILE, tileMap },

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'grove') {
      groveBase(g, s);
      const host = new THREE.Group(); g.add(host); g.userData.plants = host;
      g.userData.regrow = st => fillGrove(host, s, st); fillGrove(host, s, stage);
    } else PB[s.b](g, s);
  },
  scaleOf: () => 1,
  contact: s => s.kind === 'grove' || (s.kind === 'p' && !['path', 'fence'].includes(s.b)),
  nightLamp: s => s.cat === 'building' || s.cat === 'special',
  decor(slots){ meadowDecor(slots, { tuft: r => r() < .3 ? ['Fern_1', 0] : [r() < .5 ? 'Grass_Wispy_Short' : 'Grass_Common_Short', 0], flowers:false }); },
  ambient: pandaAmbient,
  tick(t){ moveLife(t); },
  onImpact(pos, big){ mistPuff(pos, big); },

  residents:[ { id:'Pandas', name:'Giant pandas' }, { id:'Cub', name:'Panda cub' }, { id:'RedPandas', name:'Red pandas' } ],
  moveIn: pandaMoveIn,
  residentThumb(d, thumbFor){ return thumbFor('panda:'+d.id, () => { const o = RES_BUILD[d.id](); o.rotation.y = .5; return o; }, 168); },
  residentRig(d){ const obj = RES_BUILD[d.id](); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:.5 }; }
};
