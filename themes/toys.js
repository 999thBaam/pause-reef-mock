/* TOY ROOM (?theme=toys) — a kid's bedroom floor seen as land, on the farm's 7×7 ring blueprint (same cells, same ring counts
   6 / 15 / 19, same order). As in candy, the hero (the toy chest) takes the LEFT corner (cells 0..1 × 5..6) so nothing stands
   in front of it, and the two farm slots it displaces move to the old peepal corner.
   Look, kept apart from the pet park (mint lawn, pastel plastic) and candy land (glossy pink sweets): honey-oak floorboards,
   woven rugs and foam play mats, MATT painted-wood toys in primary colours (red, blue, mustard, green) and soft felt plushies.
   The block is a slice of plank floor. No CC0 kit has toys, so every piece and resident is procedural three.js merged per
   material (Acc); canvas textures (planks, gingham, a child's drawing) are drawn at load. No asset files, no brands, no letters. */
import * as THREE from 'three';
import { rngFrom, TEX, world } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { G, Acc, seg } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { FARM, FARM_ORDER } from './farm.js';

/* ── canvas textures ── */
function canvasTex(w, h, draw, rep){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
/* gingham: two soft stripes crossing */
function ginghamTex(base, ink, n=6){ return canvasTex(128, 128, (g, W) => { g.fillStyle = base; g.fillRect(0, 0, W, W); const s = W/n;
  g.fillStyle = ink; g.globalAlpha = .45; for (let i=0;i<n;i+=2){ g.fillRect(i*s, 0, s, W); g.fillRect(0, i*s, W, s); } g.globalAlpha = 1; }, true); }
/* a child's crayon drawing: sun, house, grass, a cloud — no text */
const drawingTex = canvasTex(256, 192, (g, W, H) => {
  g.fillStyle = '#FFFDF6'; g.fillRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';
  const r = rngFrom(12), scrib = (col, pts, lw=5) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x + (r()-.5)*3, y + (r()-.5)*3) : g.moveTo(x, y)); g.stroke(); };
  g.fillStyle = '#FFC93C'; g.beginPath(); g.arc(205, 42, 22, 0, 6.3); g.fill();
  for (let i=0;i<8;i++){ const a = i/8*6.28; scrib('#FFB020', [[205 + Math.cos(a)*28, 42 + Math.sin(a)*28], [205 + Math.cos(a)*40, 42 + Math.sin(a)*40]], 4); }
  scrib('#7FB7E8', [[20, 40], [45, 30], [70, 42], [95, 32]], 8);
  g.fillStyle = '#E4553F'; g.fillRect(70, 100, 70, 60); g.fillStyle = '#3F7CC4'; g.beginPath(); g.moveTo(62, 102); g.lineTo(105, 66); g.lineTo(148, 102); g.fill();
  g.fillStyle = '#FFE08A'; g.fillRect(84, 114, 16, 16); g.fillStyle = '#8A5A33'; g.fillRect(112, 124, 16, 36);
  for (let x=6;x<W;x+=9) scrib('#4FAE5A', [[x, H - 8], [x + 3, H - 26 - r()*10]], 4);
});
/* floorboards: planks with seams and grain; the tile colour tints it */
function tileMap(){ return canvasTex(256, 256, (g, N) => {
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N); const r = rngFrom(34), rows = 4, h = N/rows;
  for (let i=0;i<rows;i++){ const y = i*h;
    g.fillStyle = `rgba(${r() < .5 ? '255,245,225' : '120,70,30'},${.05 + r()*.07})`; g.fillRect(0, y, N, h);
    g.strokeStyle = 'rgba(120,70,30,.14)'; g.lineWidth = 1.2;
    for (let k=0;k<5;k++){ const yy = y + 6 + r()*(h - 12); g.beginPath(); g.moveTo(0, yy); for (let x=0;x<=N;x+=16) g.lineTo(x, yy + Math.sin(x*.03 + k + i)*2.2); g.stroke(); }
    if (r() < .7) { const x = r()*N*.8 + 20; g.strokeStyle = 'rgba(110,60,25,.18)'; g.beginPath(); g.ellipse(x, y + h*.5, 9, 4, 0, 0, 6.3); g.stroke(); }
    g.fillStyle = 'rgba(90,50,20,.45)'; g.fillRect(0, y, N, 2.5);
    const jx = ((i*97) % 180) + 40; g.fillRect(jx, y, 2.5, h);
    g.fillStyle = 'rgba(90,50,20,.35)'; for (const x of [jx - 8, jx + 10]) { g.beginPath(); g.arc(x, y + 8, 1.6, 0, 6.3); g.fill(); g.beginPath(); g.arc(x, y + h - 8, 1.6, 0, 6.3); g.fill(); }
  }
}); }

/* ── materials: matt painted wood, bare wood, felt ── */
const PM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.62, metalness:0, ...o });
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:1, metalness:0, ...o });
const tex = (t, rx=1, ry=1) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; };
const MAT = {
  red:PM(0xD9483B), blue:PM(0x3F7CC4), yellow:PM(0xF2B940), green:PM(0x4E9E57), orange:PM(0xEE8A3C), teal:PM(0x3AA6A0), purple:PM(0x8A67C2),
  pink:PM(0xF08BA6), sky:PM(0x8CC4EC), cream:PM(0xFFF4DE), white:PM(0xFBF7EE), navy:PM(0x2E4A7A), mint:PM(0x9ED9B8),
  wood:PM(0xE2BA86), woodL:PM(0xF0D2A2), woodD:PM(0xA96F3F), woodDD:PM(0x7A4E2C), brass:PM(0xE0B04A, { metalness:.35, roughness:.4 }),
  feltB:FM(0xB07A4E), feltBL:FM(0xE3C09A), feltW:FM(0xF6EEE4), feltP:FM(0xF4B3C2), feltG:FM(0x9DB0C8), feltGL:FM(0xC9D6E6), feltY:FM(0xF1C95B), feltR:FM(0xE06A5A),
  eye:PM(0x2A2220, { roughness:.3 }), nose:PM(0x4A3025, { roughness:.4 }),
  rugT:FM(0xFFFFFF, { map:tex(ginghamTex('#F5EAD6', '#3AA6A0'), 2, 2) }), rugR:FM(0xFFFFFF, { map:tex(ginghamTex('#F7E6D0', '#D9483B'), 2, 2) }),
  rugY:FM(0xFFFFFF, { map:tex(ginghamTex('#FBF1DA', '#E8A93A'), 2, 2) }),
  fringe:FM(0xF3E6CF), paper:new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.95, map:drawingTex }),
  foam:[FM(0xEE9C8C), FM(0x93BCE2), FM(0xF3D284), FM(0x9FCF98), FM(0xF2B786), FM(0xBCA7DE)],
  water:new THREE.MeshStandardMaterial({ color:0x7CC6E8, roughness:.15, emissive:0x1E5A78, emissiveIntensity:.3 }),
  bubble:new THREE.MeshStandardMaterial({ color:0xEAF7FF, roughness:.05, transparent:true, opacity:.5, emissive:0xBFE4FF, emissiveIntensity:.35, depthWrite:false }),
  bubbleB:new THREE.MeshStandardMaterial({ color:0xD7F0FF, roughness:.05, transparent:true, opacity:.62, emissive:0xA8D8FF, emissiveIntensity:.45, depthWrite:false }),
  glass:new THREE.MeshStandardMaterial({ color:0xDFF3FF, roughness:.08, transparent:true, opacity:.4, depthWrite:false }),
  glow:PM(0xFFE6A8, { emissive:0xFFB54A, emissiveIntensity:1.25 }), glowS:PM(0xFFF3C0, { emissive:0xFFD25A, emissiveIntensity:1.4 }),
  dark:PM(0x3A2A22, { roughness:.9 })
};
const PAINT = [MAT.red, MAT.blue, MAT.yellow, MAT.green, MAT.orange, MAT.teal, MAT.purple];

/* ── helpers ── */
const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rb = (w, h, d, r=.012) => new THREE.BoxGeometry(w, h, d);   // toy blocks: crisp boxes read better than rounded at this size
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=16, ry=0){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z, ry)); }
function ball(acc, mat, x, y, z, r, sx=1, sy=1, sz=1){ acc.add(new THREE.SphereGeometry(r, 14, 10), mat, at(x, y, z, 0, sx, sy, sz)); }
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }
const FACE = Math.PI/4;   // toward the camera corner
/* star plate (appliqué) */
function starGeo(ro, ri, depth=.012){ const sh = new THREE.Shape(); for (let i=0;i<10;i++){ const a = Math.PI/2 + i*Math.PI/5, rr = i%2 ? ri : ro; i ? sh.lineTo(Math.cos(a)*rr, Math.sin(a)*rr) : sh.moveTo(Math.cos(a)*rr, Math.sin(a)*rr); }
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled:false }).translate(0, 0, -depth/2); }
const STAR = starGeo(.05, .022);
/* toy blocks */
function block(acc, mat, x, y, z, s=.1, ry=0){ acc.add(rb(s, s, s), mat, at(x, y + s/2, z, ry)); }
function cylBlock(acc, mat, x, y, z, s=.1){ cyl(acc, mat, s*.48, s*.48, s, x, y, z, 14); }
function prism(acc, mat, x, y, z, s=.1, ry=0){ acc.add(new THREE.CylinderGeometry(s*.62, s*.62, s, 3).rotateZ(Math.PI/2).rotateY(Math.PI/2), mat, at(x, y + s*.31, z, ry + Math.PI/2, 1, 1, 1)); }
function arch(acc, mat, x, y, z, w=.3, h=.1, d=.1, ry=0){ // a bridge block with a half-round cut, as two legs + a lintel + the curve
  const m = at(x, y, z, ry).clone(), put = (geo, mx) => acc.add(geo, mat, m.clone().multiply(mx));
  put(bx(w*.28, h*.6, d), new THREE.Matrix4().makeTranslation(-w*.36, h*.3, 0)); put(bx(w*.28, h*.6, d), new THREE.Matrix4().makeTranslation(w*.36, h*.3, 0));
  put(bx(w, h*.4, d), new THREE.Matrix4().makeTranslation(0, h*.8, 0)); }
function marble(acc, x, y, z, k){ ball(acc, [MAT.blue, MAT.red, MAT.green, MAT.yellow, MAT.purple][k % 5], x, y + .025, z, .025); }
function crayon(acc, mat, x, y, z, len=.2, ry=0, lying=true){
  const m = lying ? at(x, y + .018, z, ry, 1, 1, 1, 0, Math.PI/2) : at(x, y, z, ry);
  const mm = m.clone();
  acc.add(new THREE.CylinderGeometry(.018, .018, len*.82, 8).translate(0, len*.41, 0), mat, mm);
  acc.add(new THREE.ConeGeometry(.018, len*.18, 8).translate(0, len*.82 + len*.09, 0), mat, mm);
  acc.add(new THREE.CylinderGeometry(.0185, .0185, len*.34, 8).translate(0, len*.34, 0), MAT.white, mm); }
function braidRug(acc, r, y=0, cols=[MAT.teal, MAT.cream, MAT.orange, MAT.cream]){ // round braided rug: concentric flattened rings
  const n = Math.max(3, Math.round(r/.06)); for (let i=0;i<n;i++){ const rr = (i + .5)*r/n; acc.add(new THREE.TorusGeometry(rr, r/n*.55, 5, Math.max(12, Math.round(rr*60))).rotateX(Math.PI/2), cols[i % cols.length], at(0, y + .012, 0, 0, 1, .45, 1)); } }
function toyCar(acc, x, y, z, ry, mat){
  const m = at(x, y, z, ry).clone(), put = (geo, mt, tx, ty, tz, ex) => acc.add(geo, mt, m.clone().multiply(new THREE.Matrix4().makeTranslation(tx, ty, tz)).multiply(ex || new THREE.Matrix4()));
  put(bx(.1, .035, .17), mat, 0, .04, 0); put(bx(.08, .035, .08), mat, 0, .075, -.01); put(bx(.082, .025, .05), MAT.sky, 0, .075, .02);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(new THREE.CylinderGeometry(.024, .024, .02, 12), MAT.woodDD, sx*.055, .024, sz*.055, new THREE.Matrix4().makeRotationZ(Math.PI/2));
}

/* ── the ground: honey-oak floorboards ── */
const TILE = { top:['#E6B67C', '#DDAA6E'], side:'#C8915A', soilTop:'#B47C48', soilBot:'#7A4E2C' };

/* ── env: the block is a slice of plank floor — three boards per side, with nail heads, so no dirt shows ── */
function buildEnv(){
  const L = V.L, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const a = new Acc(), r = rngFrom(L*11 + 5), half = (L + .04)/2 + .006, S2 = L + .06;
  const boards = [[-.02, .2, MAT.wood], [-.23, .19, MAT.woodL], [-.43, .19, MAT.wood]];
  const nail = PM(0x8C6A4A, { metalness:.3, roughness:.5 });
  for (const [x, z, w, d, sx, sz] of [[0, half, S2, .02, 0, 1], [0, -half, S2, .02, 0, -1], [half, 0, .02, S2, 1, 0], [-half, 0, .02, S2, -1, 0]]) {
    boards.forEach(([top, h, m], i) => { a.add(bx(w, h - .012, d), i === 1 ? MAT.woodL : r() < .5 ? MAT.wood : PM(0xDDB27C), at(x, top - h/2, z)); });
    const n = Math.round(L*1.2); for (let i=0;i<n;i++){ const u = -L/2 + (i + .5)*L/n; for (const [top, h] of boards) {
      a.add(new THREE.CylinderGeometry(.012, .012, .01, 8).rotateX(Math.PI/2).rotateY(sx ? Math.PI/2 : 0), nail, at(sx ? x + sx*.012 : u, top - h/2, sz ? z + sz*.012 : u)); } } }
  a.into(env); env.traverse(o => { if (o.isMesh) o.castShadow = false; });
}

/* ════════════ buildings (Reading) ════════════ */
/* Dollhouse (2×2): an open-fronted two-storey house — four lit rooms with tiny furniture, a gabled roof, on a braided rug */
function dollhouse(g){
  const a = new Acc(), r = rngFrom(21);
  braidRug(a, .92, 0, [MAT.teal, MAT.cream, MAT.orange, MAT.cream]);
  const y0 = .07, W = 1.24, D = .78, zc = -.12, H1 = .4, H2 = .38, t = .04, wall = MAT.cream;
  slab(a, MAT.white, W + .08, .05, D + .1, 0, .025, zc + .02);                                 // plinth
  slab(a, MAT.woodL, W - .02, .02, D - .02, 0, y0, zc);                                       // ground floor
  slab(a, wall, W, H1 + H2 + t, t, 0, y0, zc - D/2 + t/2);                                     // back wall
  for (const s of [-1, 1]) slab(a, s > 0 ? MAT.pink : wall, t, H1 + H2 + t, D, s*(W/2 - t/2), y0, zc);   // side walls (the right one is painted)
  slab(a, MAT.woodL, W, t, D, 0, y0 + H1, zc); slab(a, MAT.white, W + .02, t*.9, .03, 0, y0 + H1, zc + D/2);     // mid floor + white trim
  slab(a, MAT.white, t*.7, H1 + H2 + t, D - .04, .08, y0, zc - .02);                           // partition
  // wallpapers on the back wall, one per room
  [[-.28, 0, MAT.mint], [.36, 0, PM(0xFBE0B0)], [-.28, 1, PM(0xCFE3F7)], [.36, 1, PM(0xF8D3DC)]].forEach(([x, fl, m]) => slab(a, m, x < 0 ? .6 : .44, fl ? H2 - .01 : H1 - .02, .01, x, y0 + .02 + fl*(H1 + t), zc - D/2 + t + .006));
  // ground left: sofa + lamp; ground right: table + chairs; up left: bed; up right: wardrobe + teddy
  const Y1 = y0 + .02, Y2 = y0 + H1 + t;
  slab(a, MAT.red, .3, .08, .12, -.3, Y1, zc - .2); slab(a, MAT.red, .3, .12, .04, -.3, Y1, zc - .27); for (const s of [-1, 1]) slab(a, MAT.red, .04, .1, .12, -.3 + s*.15, Y1, zc - .2);
  cyl(a, MAT.woodD, .012, .012, .22, -.52, Y1, zc - .22, 6); cyl(a, MAT.glow, .05, .035, .06, -.52, Y1 + .22, zc - .22, 12);
  cyl(a, MAT.woodD, .08, .08, .015, .36, Y1 + .12, zc - .12, 16); cyl(a, MAT.woodD, .015, .015, .12, .36, Y1, zc - .12, 6);
  for (const s of [-1, 1]) { slab(a, MAT.blue, .07, .06, .07, .36 + s*.14, Y1, zc - .12); slab(a, MAT.blue, .07, .1, .015, .36 + s*.14 + s*.03, Y1 + .06, zc - .12, Math.PI/2); }
  slab(a, MAT.woodD, .34, .06, .2, -.3, Y2, zc - .16); slab(a, MAT.blue, .3, .03, .18, -.28, Y2 + .06, zc - .16); slab(a, MAT.white, .08, .03, .14, -.42, Y2 + .07, zc - .16);
  slab(a, MAT.woodD, .05, .16, .2, -.48, Y2, zc - .16);
  slab(a, MAT.yellow, .18, .28, .1, .44, Y2, zc - .26); slab(a, MAT.woodDD, .005, .24, .006, .44, Y2 + .02, zc - .208);
  ball(a, MAT.feltB, .22, Y2 + .05, zc - .1, .045); ball(a, MAT.feltB, .22, Y2 + .12, zc - .1, .035); for (const s of [-1, 1]) ball(a, MAT.feltB, .22 + s*.025, Y2 + .15, zc - .1, .013);
  // windows on the right wall (lit), a round one in the gable
  for (const [z, y] of [[zc - .16, Y1 + .18], [zc + .14, Y1 + .18], [zc - .16, Y2 + .17], [zc + .14, Y2 + .17]]) {
    a.add(bx(.012, .13, .11), MAT.glow, at(W/2 + .002, y, z)); a.add(bx(.016, .15, .016), MAT.white, at(W/2 + .004, y, z)); a.add(bx(.016, .016, .13), MAT.white, at(W/2 + .004, y, z)); }
  // gabled roof running along x
  const RH = .36, run = D/2 + .06, ang = Math.atan2(RH, run), sl = Math.hypot(RH, run) + .02, yT = y0 + H1 + H2 + t;
  for (const s of [-1, 1]) a.add(bx(W + .14, .045, sl), MAT.red, at(0, yT + RH/2 + .01, zc + s*run/2, 0, 1, 1, 1, s*ang));
  a.add(bx(W + .16, .05, .06), MAT.woodD, at(0, yT + RH + .02, zc));
  const tri = new THREE.Shape(); tri.moveTo(-D/2, 0); tri.lineTo(D/2, 0); tri.lineTo(0, RH); tri.closePath();
  const gab = new THREE.ExtrudeGeometry(tri, { depth:t, bevelEnabled:false }).translate(0, 0, -t/2).rotateY(Math.PI/2);
  for (const s of [-1, 1]) a.add(gab, s > 0 ? MAT.pink : wall, at(s*(W/2 - t/2), yT, zc));
  a.add(new THREE.CylinderGeometry(.06, .06, .015, 18).rotateZ(Math.PI/2), MAT.glow, at(W/2 + .004, yT + .13, zc)); a.add(new THREE.TorusGeometry(.065, .012, 6, 18).rotateY(Math.PI/2), MAT.white, at(W/2 + .006, yT + .13, zc));
  slab(a, MAT.woodD, .1, .22, .1, -.36, yT + .12, zc - .18); slab(a, MAT.dark, .12, .03, .12, -.36, yT + .34, zc - .18);
  // front edge frame posts
  for (const s of [-1, 1]) slab(a, MAT.white, .04, H1 + H2 + t, .04, s*(W/2 - .02), y0, zc + D/2 - .02);
  // loose toys on the rug
  const b = new Acc(); toyCar(b, .5, .02, .62, -.6, MAT.yellow); block(b, MAT.red, -.62, .02, .56, .1, .3); block(b, MAT.blue, -.52, .02, .64, .09, .9); block(b, MAT.yellow, -.58, .12, .59, .08, .5);
  a.into(g); b.into(g);
  glowSprite(g, V3(-.1, y0 + .25, zc + .15), .9, 0xFFC56A, .3); glowSprite(g, V3(.1, y0 + .6, zc + .15), .8, 0xFFC56A, .25);
}
/* Block castle: square keep, two round towers with cone roofs, an arch gate and a pennant */
function castle(g){
  const a = new Acc();
  slab(a, MAT.woodL, .7, .03, .6, 0, 0, 0);
  block(a, MAT.yellow, -.14, .03, .04, .22); block(a, MAT.yellow, .1, .03, .04, .22); block(a, MAT.blue, -.02, .25, .04, .2);
  arch(a, MAT.red, -.02, .03, .2, .26, .16, .08, 0);
  for (const [x, z, roof] of [[-.27, -.02, MAT.red], [.25, -.06, MAT.blue]]) { cylBlock(a, MAT.cream, x, .03, z, .16); cylBlock(a, MAT.green, x, .19, z, .15); cylBlock(a, MAT.cream, x, .34, z, .14);
    a.add(new THREE.ConeGeometry(.1, .2, 14), roof, at(x, .58, z)); ball(a, MAT.yellow, x, .69, z, .02); }
  for (let i=0;i<3;i++) block(a, i%2 ? MAT.red : MAT.green, -.1 + i*.08, .45, .04, .06);
  cyl(a, MAT.woodD, .008, .008, .22, -.02, .45, .04, 6);
  a.add(new THREE.CylinderGeometry(.05, .05, .006, 3).rotateX(Math.PI/2).rotateZ(Math.PI/2), MAT.red, at(.025, .63, .04, 0, 1, .8, 1));
  a.add(new THREE.CylinderGeometry(.035, .035, .02, 12).rotateX(Math.PI/2), MAT.glow, at(-.27, .26, .06)); a.add(new THREE.CylinderGeometry(.035, .035, .02, 12).rotateX(Math.PI/2).rotateZ(0), MAT.glow, at(.25, .26, .02));
  a.into(g); glowSprite(g, V3(0, .15, .3), .4, 0xFFC56A, .35);
}
/* Play teepee: a striped canvas tent on wooden poles, bunting, a door flap, a floor cushion and a little lantern */
function teepee(g){
  const a = new Acc(), stripe = FM(0xFFFFFF, { map:tex(canvasTex(64, 64, (c, W) => { c.fillStyle = '#F7EEDC'; c.fillRect(0, 0, W, W); c.fillStyle = '#3AA6A0'; c.fillRect(0, W*.35, W, W*.14); c.fillStyle = '#E8A93A'; c.fillRect(0, W*.58, W, W*.06); }, true), 6, 1) });
  braidRug(a, .4, 0, [MAT.yellow, MAT.cream]);
  const H = .74, R = .34;
  a.add(new THREE.ConeGeometry(R, H, 6, 1, true), stripe, at(0, .02 + H/2, 0, FACE + Math.PI/6));
  a.add(new THREE.ConeGeometry(R*.985, H*.985, 6, 1, true), MAT.cream, at(0, .02 + H/2, 0, FACE + Math.PI/6, -1, 1, 1));
  for (let i=0;i<5;i++){ const q = i/5*6.28 + .4; seg(a, MAT.woodD, V3(Math.cos(q)*.02, H*.82, Math.sin(q)*.02), V3(-Math.cos(q)*.4, 1, -Math.sin(q)*.4).normalize(), .2, .01, .008, 5); }
  // door opening: a dark triangle and two tied-back flaps
  const d = new THREE.Shape(); d.moveTo(-.13, 0); d.lineTo(.13, 0); d.lineTo(0, .38); d.closePath();
  a.add(new THREE.ShapeGeometry(d), MAT.dark, at(Math.sin(FACE)*R*.9, .025, Math.cos(FACE)*R*.9, FACE, 1, 1, 1, -.42));
  for (const s of [-1, 1]) ball(a, MAT.teal, Math.sin(FACE)*R*.9 + Math.cos(FACE)*s*.14, .15, Math.cos(FACE)*R*.9 - Math.sin(FACE)*s*.14, .045, .7, 1.6, .7);
  for (let i=0;i<7;i++){ const q = FACE - 1.1 + i*.37; a.add(new THREE.ConeGeometry(.025, .05, 3), PAINT[i % 5], at(Math.sin(q)*R*.6, .44, Math.cos(q)*R*.6, q, 1, 1, 1, Math.PI)); }
  ball(a, MAT.pink, .28, .05, .12, .07, 1.2, .5, 1.2); cyl(a, MAT.woodD, .03, .03, .06, -.3, .02, .2, 8); ball(a, MAT.glowS, -.3, .11, .2, .035);
  a.into(g); glowSprite(g, V3(-.3, .12, .2), .35, 0xFFD25A, .5); glowSprite(g, V3(.12, .14, .12), .35, 0xFFC56A, .3);
}
/* Toy garage: a two-level wooden garage with a ramp and little cars */
function garage(g){
  const a = new Acc();
  slab(a, MAT.woodL, .72, .04, .56, 0, 0, 0); slab(a, MAT.blue, .7, .02, .54, 0, .04, 0);
  for (const [x, z] of [[-.32, -.24], [.32, -.24], [-.32, .24], [.32, .24]]) slab(a, MAT.yellow, .05, .26, .05, x, .06, z);
  slab(a, MAT.red, .72, .03, .56, 0, .32, 0); slab(a, MAT.woodL, .72, .12, .04, 0, .06, -.26);
  slab(a, MAT.green, .2, .2, .2, .22, .35, -.16); a.add(new THREE.ConeGeometry(.17, .12, 4), MAT.red, at(.22, .61, -.16, Math.PI/4));
  a.add(bx(.012, .08, .1), MAT.glow, at(.325, .47, -.16));
  // ramp down the front-left
  a.add(bx(.2, .025, .5), MAT.yellow, at(-.22, .19, .1, 0, 1, 1, 1, .6));
  for (let i=0;i<5;i++) a.add(bx(.2, .006, .02), MAT.white, at(-.22, .12 + i*.055, .26 - i*.075, 0, 1, 1, 1, .6));
  toyCar(a, .12, .06, .08, .2, MAT.red); toyCar(a, -.05, .35, -.05, 1.2, MAT.teal); toyCar(a, .26, .02, .38, -.3, MAT.orange);
  a.into(g);
}
/* Puppet theatre: a tall painted frame, red curtains, a striped valance, one felt puppet peeping out */
function theatre(g){
  const a = new Acc(), Z = -.02;
  slab(a, MAT.woodL, .6, .03, .36, 0, 0, Z);
  slab(a, MAT.blue, .56, .4, .1, 0, .03, Z); slab(a, MAT.yellow, .6, .03, .14, 0, .43, Z);
  for (const s of [-1, 1]) slab(a, MAT.blue, .1, .4, .1, s*.23, .43, Z);
  slab(a, MAT.blue, .58, .12, .1, 0, .83, Z); a.add(new THREE.CylinderGeometry(.29, .29, .1, 24, 1, false, -Math.PI/2, Math.PI).rotateX(Math.PI/2), MAT.blue, at(0, .95, Z));
  a.add(STAR, MAT.yellow, at(0, 1.07, Z + .052)); a.add(STAR, MAT.yellow, at(-.2, .23, Z + .052, 0, .8, .8, 1)); a.add(STAR, MAT.yellow, at(.2, .23, Z + .052, 0, .8, .8, 1));
  slab(a, MAT.glow, .36, .39, .01, 0, .44, Z - .04);   // lit backdrop
  for (const s of [-1, 1]) for (let i=0;i<3;i++) cyl(a, MAT.red, .028, .036, .38, s*(.155 - i*.035), .45, Z + .03, 8);
  for (let i=0;i<6;i++) a.add(new THREE.CylinderGeometry(.033, .033, .06, 10, 1, false, 0, Math.PI).rotateX(Math.PI/2).rotateZ(Math.PI), i%2 ? MAT.white : MAT.red, at(-.15 + i*.06, .81, Z + .055));
  ball(a, MAT.feltY, .04, .56, Z + .01, .06); ball(a, MAT.feltR, .04, .46, Z + .01, .055, 1, 1.2, 1); ball(a, MAT.eye, .02, .57, Z + .065, .01); ball(a, MAT.eye, .06, .57, Z + .065, .01); ball(a, MAT.orange, .04, .54, Z + .07, .014);
  a.into(g); glowSprite(g, V3(0, .6, .15), .5, 0xFFC56A, .35);
}
/* Train station: a wooden platform under a canopy, a clock face with hands (no numerals), a bench and a parked carriage */
function station(g){
  const a = new Acc();
  slab(a, MAT.woodL, .8, .025, .8);
  trackRun(a, 'x', .22, .8);
  slab(a, MAT.cream, .72, .08, .3, 0, .025, -.18); slab(a, MAT.white, .74, .015, .32, 0, .105, -.18);
  for (const x of [-.3, .3]) cyl(a, MAT.red, .018, .018, .36, x, .12, -.1, 8);
  slab(a, MAT.green, .82, .03, .4, 0, .48, -.2); slab(a, MAT.green, .84, .04, .04, 0, .44, .0);
  slab(a, MAT.blue, .36, .26, .16, -.08, .12, -.26); a.add(bx(.1, .1, .01), MAT.glow, at(-.16, .26, -.178)); a.add(bx(.1, .1, .01), MAT.glow, at(.0, .26, -.178));
  cyl(a, MAT.white, .07, .07, .02, .22, .32, -.2, 20); a.add(new THREE.CylinderGeometry(.07, .07, .02, 20).rotateX(Math.PI/2), MAT.white, at(.22, .36, -.13));
  a.add(new THREE.TorusGeometry(.07, .012, 6, 20), MAT.red, at(.22, .36, -.12)); a.add(bx(.008, .05, .006), MAT.eye, at(.22, .38, -.115)); a.add(bx(.035, .008, .006), MAT.eye, at(.235, .36, -.115));
  cyl(a, MAT.red, .01, .01, .2, .22, .12, -.2, 6);
  slab(a, MAT.woodD, .2, .02, .06, .14, .15, -.1); slab(a, MAT.woodD, .2, .06, .015, .14, .17, -.13);
  // parked carriage on the track
  slab(a, MAT.yellow, .34, .14, .15, .02, .06, .22); slab(a, MAT.red, .38, .025, .19, .02, .2, .22);
  for (const x of [-.08, .04, .12]) a.add(bx(.06, .06, .01), MAT.glow, at(x, .14, .298));
  for (const x of [-.1, .14]) for (const s of [-1, 1]) a.add(new THREE.CylinderGeometry(.035, .035, .02, 12).rotateX(Math.PI/2), MAT.woodDD, at(x, .055, .22 + s*.08));
  a.into(g); glowSprite(g, V3(-.08, .26, -.1), .4, 0xFFC56A, .35);
}

/* ════════════ wooden train track (fences + path + station) ════════════ */
const TRACK = PM(0xEBC792), TRACKG = PM(0xC9A06A);
function trackRun(acc, axis, off, len, y=0){ // a straight toy track along axis x or z at offset `off`, length `len`
  const L = (w, d, x, z, m, h=.03) => acc.add(bx(axis === 'x' ? w : d, h, axis === 'x' ? d : w), m, at(axis === 'x' ? x : z, y + h/2, axis === 'x' ? z : x));
  L(len, .15, 0, off, TRACK); for (const s of [-1, 1]) L(len, .016, 0, off + s*.035, TRACKG, .032);
  const n = Math.max(1, Math.round(len/.25)); for (let i=0;i<n;i++) L(.008, .15, -len/2 + (i + .5)*len/n + .12, off, TRACKG, .031);
}
function fence(g, s){
  const a = new Acc(), L = s.len;
  if (s.edge === 'w') trackRun(a, 'z', -.4, L); else trackRun(a, 'x', .4, L);
  // pegs joining track pieces
  for (let i=1;i<L;i++){ const u = i - L/2; cyl(a, TRACKG, .02, .02, .034, s.edge === 'w' ? -.4 : u, 0, s.edge === 'w' ? u : .4, 10); }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}

/* ════════════ water / calm (Breathe) ════════════ */
function duckTub(g){
  const a = new Acc(), r = rngFrom(91);
  const tub = new THREE.LatheGeometry([[0,0],[.25,0],[.3,.03],[.33,.16],[.34,.22],[.3,.22],[.28,.08],[0,.08]].map(([x, y]) => new THREE.Vector2(x, y)), 32);
  a.add(tub, MAT.white, at(0, .06, 0, 0, 1.2, 1, .85));
  for (const [x, z] of [[-.28, -.18], [.28, -.18], [-.28, .18], [.28, .18]]) ball(a, MAT.brass, x, .04, z, .04);
  a.add(new THREE.CylinderGeometry(.3, .3, .01, 32), MAT.water, at(0, .23, 0, 0, 1.2, 1, .85));
  for (let i=0;i<14;i++){ const q = r()*6.28, d = .15 + r()*.18; ball(a, MAT.bubble, Math.cos(q)*d*1.1, .25 + r()*.06, Math.sin(q)*d*.75, .02 + r()*.03); }
  // rubber duck
  ball(a, MAT.yellow, .05, .27, .04, .07, 1.25, .8, 1); ball(a, MAT.yellow, .1, .35, .04, .05); a.add(new THREE.ConeGeometry(.02, .05, 8).rotateZ(-Math.PI/2), MAT.orange, at(.16, .345, .04));
  ball(a, MAT.eye, .13, .37, .075, .009); ball(a, MAT.eye, .13, .37, .005, .009);
  cyl(a, MAT.brass, .015, .015, .22, -.3, .22, 0, 8); a.add(new THREE.TorusGeometry(.05, .014, 6, 12, Math.PI), MAT.brass, at(-.25, .44, 0));
  a.into(g);
}
function bubblePot(g){
  const a = new Acc(), r = rngFrom(95);
  braidRug(a, .36, 0, [MAT.sky, MAT.cream]);
  cyl(a, MAT.blue, .09, .1, .2, 0, .02, 0, 16); cyl(a, MAT.white, .1, .1, .03, 0, .22, 0, 16);
  cyl(a, MAT.pink, .006, .006, .34, .05, .2, 0, 6); a.add(new THREE.TorusGeometry(.06, .01, 6, 18), MAT.pink, at(.05, .6, 0, FACE));
  for (let i=0;i<14;i++){ const t = i/13, q = t*9 + r(), d = .06 + t*.18; ball(a, MAT.bubbleB, Math.cos(q)*d + .05, .4 + t*.7, Math.sin(q)*d, .045 + r()*.05); }
  a.into(g); glowSprite(g, V3(.05, .7, 0), .8, 0xCFEFFF, .18);
}
function cloudMobile(g){
  const a = new Acc(), r = rngFrom(97);
  slab(a, MAT.woodL, .36, .04, .36); cyl(a, MAT.woodD, .02, .02, .9, -.12, .04, -.12, 8);
  seg(a, MAT.woodD, V3(-.12, .92, -.12), V3(1, 0, 1).normalize(), .34, .016, .016, 6);
  const cx = .12, cz = .12, cy = .64;
  for (const [x, y, rr] of [[-.1, 0, .09], [0, .04, .12], [.11, .01, .09], [.05, -.03, .08], [-.05, -.03, .08]]) ball(a, MAT.white, cx + x*.72, cy + y, cz - x*.72, rr);
  cyl(a, MAT.woodD, .003, .003, .2, cx, cy + .1, cz, 4);
  for (let i=0;i<5;i++){ const u = (i - 2)*.06, len = .12 + r()*.14, x = cx + u*.72, z = cz - u*.72; cyl(a, MAT.white, .002, .002, len, x, cy - .03 - len, z, 4);
    a.add(new THREE.SphereGeometry(.025, 10, 8).scale(1, 1.3, 1), MAT.sky, at(x, cy - .06 - len, z)); a.add(new THREE.ConeGeometry(.018, .03, 8), MAT.sky, at(x, cy - .03 - len, z)); }
  a.into(g);
}
function paddlePool(g){
  const a = new Acc(), r = rngFrom(111);
  a.add(new THREE.TorusGeometry(.36, .07, 10, 36).rotateX(Math.PI/2), MAT.sky, at(0, .07, 0));
  a.add(new THREE.TorusGeometry(.36, .06, 10, 36).rotateX(Math.PI/2), MAT.white, at(0, .17, 0, 0, 1.01, 1, 1.01));
  cyl(a, MAT.blue, .38, .38, .02, 0, 0, 0, 32); cyl(a, MAT.water, .34, .34, .01, 0, .13, 0, 32);
  // a paper boat and a beach ball
  const boat = new THREE.Shape(); boat.moveTo(-.1, 0); boat.lineTo(.1, 0); boat.lineTo(.14, .05); boat.lineTo(-.14, .05); boat.closePath();
  const bg = new THREE.ExtrudeGeometry(boat, { depth:.06, bevelEnabled:false }).translate(0, 0, -.03);
  a.add(bg, MAT.white, at(-.08, .13, .06, FACE + .3)); a.add(new THREE.ConeGeometry(.06, .1, 4), MAT.white, at(-.08, .23, .06, FACE + .3, 1, 1, .3));
  for (let i=0;i<6;i++) a.add(new THREE.SphereGeometry(.07, 12, 8, i*Math.PI/3, Math.PI/3), [MAT.red, MAT.white, MAT.yellow, MAT.white, MAT.blue, MAT.white][i], at(.14, .19, -.1));
  a.into(g);
}

/* ════════════ tall things (Vocab): wooden toy trees, stacking rings, a plush giraffe, a crayon cup ════════════ */
function ballTree(g, s){
  const a = new Acc(), crown = s.c === 'o' ? MAT.orange : s.c === 'm' ? MAT.teal : MAT.green, h = s.h || 1;
  cyl(a, MAT.woodL, .2, .22, .05, 0, 0, 0, 20); cyl(a, MAT.woodD, .04, .045, .5*h, 0, .05, 0, 10);
  ball(a, crown, 0, .5*h + .24, 0, .27); ball(a, crown, .12, .5*h + .08, .08, .12);
  ball(a, MAT.red, .14, .5*h + .3, .2, .04); ball(a, MAT.red, -.15, .5*h + .2, .2, .04); ball(a, MAT.red, .22, .5*h + .12, -.04, .04);
  a.into(g);
}
function pineTree(g, s){
  const a = new Acc(), h = s.h || 1, m = s.c === 'b' ? MAT.teal : MAT.green;
  cyl(a, MAT.woodL, .2, .22, .05, 0, 0, 0, 20); cyl(a, MAT.woodD, .04, .045, .2, 0, .05, 0, 10);
  for (let i=0;i<3;i++){ const rr = .3 - i*.07; a.add(new THREE.ConeGeometry(rr, .34*h, 16), m, at(0, .22 + i*.22*h + .17*h, 0)); }
  a.add(STAR, MAT.yellow, at(0, .22 + .66*h + .36*h, 0, FACE, 1.2, 1.2, 1.2));
  a.into(g);
}
function stacker(g, s){
  const a = new Acc(), cols = s.alt ? [MAT.purple, MAT.blue, MAT.teal, MAT.green, MAT.yellow, MAT.orange] : [MAT.red, MAT.orange, MAT.yellow, MAT.green, MAT.blue, MAT.purple];
  cyl(a, MAT.woodL, .26, .27, .06, 0, 0, 0, 24); cyl(a, MAT.woodD, .03, .03, .78, 0, .06, 0, 10);
  let y = .06; cols.forEach((m, i) => { const rr = .22 - i*.026, th = .06 + .008*(5 - i); a.add(new THREE.TorusGeometry(rr*.7, th, 12, 26).rotateX(Math.PI/2), m, at(0, y + th, 0, 0, 1, .95, 1)); y += th*1.9; });
  ball(a, MAT.red, 0, y + .06, 0, .075);
  a.into(g);
}
function giraffe(g){
  const a = new Acc(), f = MAT.feltY, spot = FM(0xC6813E);
  slab(a, MAT.woodL, .36, .03, .3);
  ball(a, f, 0, .3, 0, .13, 1.2, .9, .9);
  for (const [x, z] of [[-.1, -.06], [.1, -.06], [-.1, .06], [.1, .06]]) cyl(a, f, .035, .03, .24, x, .03, z, 8);
  seg(a, f, V3(.08, .34, 0), V3(.4, 1, 0).normalize(), .5, .05, .04, 10);
  const hx = .08 + .4*.5/Math.hypot(.4, 1), hy = .34 + .5/Math.hypot(.4, 1);
  ball(a, f, hx + .03, hy + .03, 0, .075, 1.35, .9, .9); ball(a, MAT.feltBL, hx + .12, hy + .01, 0, .05);
  for (const s of [-1, 1]) { cyl(a, spot, .012, .012, .07, hx, hy + .07, s*.03, 6); ball(a, spot, hx, hy + .15, s*.03, .02); ball(a, MAT.eye, hx + .07, hy + .06, s*.05, .012); ball(a, f, hx - .03, hy + .07, s*.07, .025, 1, .5, 1.6); }
  for (const [x, y, z] of [[-.05, .38, .09], [.07, .3, .1], [-.1, .27, .08], [.02, .4, -.1], [.12, .5, .04], [.17, .64, .03], [.1, .3, -.1]]) ball(a, spot, x, y, z, .03, 1, 1, .4);
  seg(a, f, V3(-.15, .32, 0), V3(-1, -.6, 0).normalize(), .12, .012, .008, 5); ball(a, spot, -.25, .25, 0, .02);
  a.into(g);
}
function crayonCup(g){
  const a = new Acc(), cols = [MAT.red, MAT.blue, MAT.yellow, MAT.green, MAT.orange, MAT.purple, MAT.pink];
  cyl(a, MAT.teal, .15, .16, .3, 0, 0, 0, 20); cyl(a, MAT.white, .165, .165, .03, 0, .22, 0, 20);
  cols.forEach((m, i) => { const q = i/cols.length*6.28, d = i ? .07 : 0, tilt = i ? .14 : 0;
    const len = .62 + (i*37 % 11)/40; const base = V3(Math.cos(q)*d, .04, Math.sin(q)*d), dir = V3(Math.cos(q)*tilt, 1, Math.sin(q)*tilt).normalize();
    seg(a, m, base, dir, len*.82, .032, .032, 10); seg(a, MAT.white, base.clone().addScaledVector(dir, len*.4), dir, len*.22, .033, .033, 10);
    seg(a, m, base.clone().addScaledVector(dir, len*.82), dir, len*.16, .032, .004, 10); });
  const b = new Acc(); crayon(b, MAT.green, .2, 0, .24, .22, 2.2); crayon(b, MAT.red, -.24, 0, .2, .2, .7); b.into(g);
  a.into(g);
}

/* ════════════ growing (Sudoku / Math): block towers, cup pyramids — built up piece by piece ════════════ */
function foamMat(g, s){ // a 2×2 jigsaw foam play mat: the crop base
  const base = new THREE.Group(), a = new Acc(), k = (s.x*3 + s.z) % 6;
  for (let i=0;i<4;i++){ const sx = i%2 ? 1 : -1, sz = i < 2 ? -1 : 1; a.add(bx(.44, .05, .44), MAT.foam[(k + (i === 0 || i === 3 ? 0 : 1)*3) % 6], at(sx*.225, .025, sz*.225)); }
  for (let i=0;i<4;i++){ const q = i*Math.PI/2; cyl(a, MAT.foam[(k + (i%2)*3) % 6], .045, .045, .05, Math.cos(q)*.2, 0, Math.sin(q)*.2, 12); }
  a.into(base); base.traverse(o => { if (o.isMesh) { o.userData.ghostHide = true; o.castShadow = false; } }); g.add(base);
}
const TOWERS = [[-.2, -.18], [.2, -.14], [-.02, .2]];
function fillBlocks(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 3), Y = .05, sz = .11;
  if (stage <= 1) { for (let i=0;i<5;i++){ const q = r()*6.28, d = .1 + r()*.25; (i%2 ? cylBlock : block)(a, PAINT[Math.floor(r()*7)], Math.cos(q)*d, Y, Math.sin(q)*d, .09); } a.into(host); host.userData.stage = stage; return; }
  const hts = [[1, 1, 0], [2, 1, 1], [3, 2, 2], [4, 3, 2]][stage - 2];
  TOWERS.forEach(([x, z], ti) => { const n = hts[ti]; for (let i=0;i<n;i++){ const m = PAINT[(ti*3 + i + s.x) % 7], ry = (r()-.5)*.25;
      (i % 3 === 2 ? cylBlock : block)(a, m, x + (r()-.5)*.012, Y + i*sz, z + (r()-.5)*.012, sz, ry); }
    if (stage >= 5 && n) (ti%2 ? prism : (acc, m, x, y, z) => { acc.add(new THREE.ConeGeometry(.07, .12, 12), m, at(x, y + .06, z)); })(a, [MAT.red, MAT.blue][ti%2], x, Y + n*sz, z, sz, FACE); });
  if (stage >= 4) arch(a, MAT.yellow, -.13, Y + (stage >= 5 ? 2 : 1)*sz, 0, .36, .1, .1, -FACE + .25);
  if (stage >= 5) { cyl(a, MAT.woodD, .006, .006, .14, -.2, Y + 4*sz + .1, -.2, 5); a.add(new THREE.CylinderGeometry(.04, .04, .005, 3).rotateX(Math.PI/2).rotateZ(Math.PI/2), MAT.green, at(-.17, Y + 4*sz + .21, -.2, 0, 1, .7, 1)); }
  a.into(host); host.userData.stage = stage;
}
function fillCups(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*17 + s.z*5 + 9), Y = .05, cr = .085, ch = .14;
  const cup = (x, y, z, m) => { a.add(new THREE.CylinderGeometry(cr*.72, cr, ch, 18), m, at(x, y + ch/2, z)); a.add(new THREE.TorusGeometry(cr*.98, .008, 5, 18).rotateX(Math.PI/2), m, at(x, y + .01, z)); };
  const COL = [MAT.red, MAT.orange, MAT.yellow, MAT.green, MAT.teal, MAT.blue, MAT.purple, MAT.pink];
  if (stage <= 1) { for (let i=0;i<3;i++){ const q = i*2.1 + r(), d = .18; a.add(new THREE.CylinderGeometry(cr*.72, cr, ch, 18), COL[i*2], at(Math.cos(q)*d, Y + cr, Math.sin(q)*d, q, 1, 1, 1, Math.PI/2)); } a.into(host); host.userData.stage = stage; return; }
  // a pyramid laid out across the camera's view (along x = -z)
  const ux = Math.cos(FACE), uz = -Math.sin(FACE), rows = Math.min(stage - 1, 3); let k = 0;
  for (let row=0; row<rows; row++){ const n = 3 - row; for (let i=0;i<n;i++){ const u = (i - (n - 1)/2)*cr*2.05; cup(u*ux - .06, Y + row*ch, u*uz - .06, COL[k++ % 8]); } }
  if (stage >= 5) { ball(a, MAT.red, -.06, Y + 3*ch + .05, -.06, .05); for (let i=0;i<2;i++) cup(.26 - i*.02, Y, .22 + i*.0, COL[(i + 5) % 8]); cup(.25, Y + ch, .22, COL[7]); }
  else if (stage >= 3) cup(.26, Y, .22, COL[5]);
  a.into(host); host.userData.stage = stage;
}

/* ════════════ To-dos: rugs, a track, a night-light, a play mat, a drawing, a spinning top ════════════ */
function path(g, s){
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0, Y = 0; g.userData.ghostMode = 'marker';
  const flat = (geo, mat, mx) => { const m = new THREE.Mesh(geo, mat); m.applyMatrix4(mx); m.receiveShadow = true; m.userData.ghostHide = true; g.add(m); return m; };
  if (v === 0) { // gingham rug square with fringe
    flat(new THREE.BoxGeometry(.86, .014, .78), s.rug === 'r' ? MAT.rugR : MAT.rugT, at(0, .007, 0));
    for (const sz of [-1, 1]) for (let i=0;i<14;i++) a.add(bx(.012, .006, .06), MAT.fringe, at(-.4 + i*.0615, .004, sz*.42));
    a.into(g); return; }
  if (v === 1) { trackRun(a, 'x', 0, .98); trackRun(a, 'z', 0, .98); cyl(a, TRACKG, .09, .09, .034, 0, 0, 0, 20);
    a.add(STAR, MAT.red, at(.3, .15, -.28, FACE, 1, 1, 1)); cyl(a, MAT.woodD, .01, .01, .13, .3, 0, -.28, 6); a.into(g); return; }
  if (v === 2) { // a star night-light on a round rug
    braidRug(a, .36, 0, [MAT.navy, MAT.cream, MAT.sky, MAT.cream]);
    cyl(a, MAT.white, .08, .1, .06, 0, .02, 0, 16); a.add(STAR, MAT.glowS, at(0, .24, 0, FACE, 2.8, 2.8, 5));
    a.into(g); glowSprite(g, V3(0, .24, 0), .8, 0xFFD25A, .55); const b = new Acc(); marble(b, .28, 0, .2, 1); marble(b, -.26, 0, .24, 3); b.into(g); return; }
  if (v === 3) { // foam play mat with a ball
    for (let i=0;i<4;i++){ const sx = i%2 ? 1 : -1, sz = i < 2 ? -1 : 1; flat(new THREE.BoxGeometry(.4, .03, .4), MAT.foam[(i + 2) % 6], at(sx*.205, .015, sz*.205)); }
    for (let i=0;i<6;i++) a.add(new THREE.SphereGeometry(.1, 12, 8, i*Math.PI/3, Math.PI/3), [MAT.red, MAT.white, MAT.blue, MAT.white, MAT.yellow, MAT.white][i], at(.15, .13, .12));
    a.into(g); return; }
  if (v === 4) { // a drawing and crayons
    flat(new THREE.PlaneGeometry(.5, .375).rotateX(-Math.PI/2), MAT.paper, at(-.05, .006, -.02, .25));
    crayon(a, MAT.red, .2, 0, .2, .2, 1.6); crayon(a, MAT.blue, .26, 0, .06, .18, 2.4); crayon(a, MAT.green, -.2, 0, .3, .2, .3); a.into(g); return; }
  // v5: spinning top (it spins in tick) + marbles + jacks
  const top = new THREE.Group(), t = new Acc(); top.position.set(0, 0, 0);
  t.add(new THREE.ConeGeometry(.02, .07, 12).rotateX(Math.PI), MAT.woodD, at(0, .035, 0));
  t.add(new THREE.SphereGeometry(.17, 20, 12, 0, 6.29, Math.PI*.3, Math.PI*.45), MAT.red, at(0, .16, 0, 0, 1, .7, 1));
  t.add(new THREE.CylinderGeometry(.162, .162, .02, 24), MAT.yellow, at(0, .15, 0));
  for (let i=0;i<6;i++) t.add(bx(.06, .015, .03), i%2 ? MAT.blue : MAT.white, at(Math.cos(i*1.05)*.13, .165, Math.sin(i*1.05)*.13, -i*1.05));
  cyl(t, MAT.woodD, .018, .018, .1, 0, .2, 0, 8); ball(t, MAT.woodD, 0, .3, 0, .025);
  t.into(top); top.rotation.z = .08; g.add(top); g.userData.spin = top;
  for (let i=0;i<5;i++){ const q = r()*6.28, d = .28 + r()*.1; marble(a, Math.cos(q)*d, 0, Math.sin(q)*d, i); }
  a.into(g);
}

/* ════════════ the hero (Gita): the toy chest — lid thrown open, a warm glow inside, toys spilling out ════════════ */
function toyChest(g){
  const a = new Acc(), r = rngFrom(5);
  braidRug(a, .95, 0, [MAT.red, MAT.cream, MAT.yellow, MAT.cream, MAT.teal, MAT.cream]);
  const W = 1.16, D = .66, H = .5, y0 = .03, ry = .25;
  const T = new THREE.Group(); T.rotation.y = ry; T.position.set(-.04, 0, -.12); g.add(T); const c = new Acc();
  // box: blue panels in a wooden frame, star appliqués, a brass clasp
  slab(c, MAT.woodD, W + .04, .05, D + .04, 0, y0); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ball(c, MAT.woodDD, x*(W/2 - .02), y0, z*(D/2 - .02), .04);
  slab(c, MAT.blue, W, H, D, 0, y0 + .05);
  slab(c, MAT.cream, W*.97, .02, D*.97, 0, y0 + .05 + H - .06);   // inner lip
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) slab(c, MAT.woodL, .06, H + .02, .06, x*(W/2 - .02), y0 + .04, z*(D/2 - .02));
  slab(c, MAT.woodL, W + .02, .05, .03, 0, y0 + .06, D/2 + .004); slab(c, MAT.woodL, W + .02, .05, .03, 0, y0 + H - .02, D/2 + .004);
  slab(c, MAT.woodL, .03, .05, D + .02, W/2 + .004, y0 + .06, 0); slab(c, MAT.woodL, .03, .05, D + .02, W/2 + .004, y0 + H - .02, 0);
  [[-.3, .3, MAT.yellow], [0, .3, MAT.red], [.3, .3, MAT.yellow]].forEach(([x, y, m]) => c.add(STAR, m, at(x, y0 + y, D/2 + .012, 0, 1.4, 1.4, 1)));
  c.add(STAR, MAT.yellow, at(W/2 + .012, y0 + .3, -.1, Math.PI/2, 1.3, 1.3, 1)); ball(c, MAT.red, W/2 + .01, y0 + .3, .16, .035, .4, 1, 1);
  slab(c, MAT.brass, .08, .1, .02, 0, y0 + H - .09, D/2 + .016);
  // warm glow plane inside
  slab(c, MAT.glow, W*.9, .01, D*.85, 0, y0 + H - .1, 0);
  // the lid, hinged at the back, thrown open past vertical
  const lid = new THREE.Group(); lid.position.set(0, y0 + .05 + H, -D/2); lid.rotation.x = -1.95; T.add(lid); const l = new Acc();
  slab(l, MAT.blue, W + .02, .06, D + .02, 0, 0, D/2); l.add(bx(W + .04, .05, .03), MAT.woodL, at(0, .03, D + .01));
  for (const x of [-1, 1]) l.add(bx(.03, .05, D + .04), MAT.woodL, at(x*(W/2 + .01), .03, D/2));
  l.add(STAR, MAT.yellow, at(0, .064, D/2, 0, 1.8, 1.8, 1, -Math.PI/2)); for (const x of [-.34, .34]) l.add(STAR, MAT.red, at(x, .064, D/2, 0, 1.1, 1.1, 1, -Math.PI/2));
  l.into(lid);
  // toys inside, poking out of the top: a teddy, a pinwheel, blocks, a drum stick, a ball
  const Yt = y0 + H;
  ball(c, MAT.feltB, -.28, Yt + .02, .02, .12, 1, .9, .9); ball(c, MAT.feltB, -.28, Yt + .16, .04, .1); for (const s of [-1, 1]) { ball(c, MAT.feltB, -.28 + s*.075, Yt + .24, .04, .038); ball(c, MAT.feltBL, -.28 + s*.075, Yt + .24, .06, .02); }
  ball(c, MAT.feltBL, -.28, Yt + .14, .12, .04, 1.2, .9, 1); ball(c, MAT.nose, -.28, Yt + .16, .16, .014); for (const s of [-1, 1]) ball(c, MAT.eye, -.28 + s*.035, Yt + .2, .125, .012);
  ball(c, MAT.feltB, -.14, Yt + .05, .14, .035, 1, 1.6, 1);   // a waving paw on the rim
  seg(c, MAT.woodD, V3(.3, Yt - .1, -.05), V3(.15, 1, .1).normalize(), .5, .01, .01, 6);
  for (let i=0;i<4;i++) c.add(new THREE.ConeGeometry(.07, .12, 3), [MAT.red, MAT.yellow, MAT.blue, MAT.green][i], at(.37 + Math.cos(i*1.57)*.05, Yt + .38 + Math.sin(i*1.57)*.05, .0, 0, 1, 1, .15, 0, i*1.57 + .8));
  block(c, MAT.red, .1, Yt - .06, .12, .12, .4); block(c, MAT.yellow, .2, Yt - .06, -.08, .12, .9); cylBlock(c, MAT.green, .02, Yt - .08, -.1, .12);
  ball(c, MAT.orange, .42, Yt + .0, .12, .08);
  c.into(T);
  // spilled on the rug in front: a drum, blocks, a ball, a toy car
  const b = new Acc();
  cyl(b, MAT.red, .12, .12, .14, .52, 0, .56, 20); cyl(b, MAT.white, .122, .122, .015, .52, .14, .56, 20); for (let i=0;i<8;i++){ const q = i/8*6.28; seg(b, MAT.yellow, V3(.52 + Math.cos(q)*.122, .005, .56 + Math.sin(q)*.122), V3(Math.cos(q + .8)*.5, 1, Math.sin(q + .8)*.5).normalize(), .15, .005, .005, 4); }
  block(b, MAT.blue, -.38, .01, .52, .12, .3); block(b, MAT.green, -.22, .01, .6, .11, 1.1); prism(b, MAT.yellow, -.36, .13, .52, .1, .3);
  for (let i=0;i<6;i++) b.add(new THREE.SphereGeometry(.09, 12, 8, i*Math.PI/3, Math.PI/3), [MAT.red, MAT.white, MAT.teal, MAT.white, MAT.yellow, MAT.white][i], at(.72, .1, .02));
  toyCar(b, .06, .02, .72, .4, MAT.orange); marble(b, .3, .02, .78, 2); marble(b, .36, .02, .7, 4);
  b.into(g);
  glowSprite(g, V3(-.04, y0 + H + .15, -.12), 1.5, 0xFFC56A, .45); glowSprite(g, V3(0, .8, 0), 2.4, 0xFFE3B0, .12);
}

/* ── blueprint: the farm's cells with toys; the chest takes the left corner ── */
const MAP = {
  bigbarn:{ name:'Dollhouse', b:'doll' }, well:{ name:'Duck tub', b:'tub' }, apple1:{ name:'Wooden tree', b:'ballTree', h:1 },
  silo:{ name:'Block castle', b:'castle' }, silohouse:{ name:'Play teepee', b:'teepee' }, coop:{ name:'Toy garage', b:'garage' },
  watertower:{ name:'Bubble pot', b:'bubbles' }, pump:{ name:'Rain-cloud mobile', b:'cloud' }, apple2:{ name:'Wooden pine', b:'pine', h:1.05 },
  berry1:{ name:'Stacking rings', b:'stacker' }, peepal:{ name:'Toy chest', b:'hero' },
  smallbarn:{ name:'Puppet theatre', b:'theatre' }, openbarn:{ name:'Toy station', b:'station' },
  pond:{ name:'Paddling pool', b:'pool' }, orange1:{ name:'Plush giraffe', b:'giraffe' },
  apple3:{ name:'Wooden tree', b:'ballTree', c:'o', h:.9 }, berry2:{ name:'Stacking rings', b:'stacker', alt:true },
  orange2:{ name:'Crayon cup', b:'crayons' }, apple4:{ name:'Wooden pine', b:'pine', c:'b', h:.95 }
};
const MOVE = { peepal:{ x:0, z:5 }, field1_5:{ x:1, z:1 }, fence3:{ x:0, z:0, edge:'w' } };   // hero to the left corner
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:5, path2_6:4, path3_6:0 };
const PATH_NAME = ['Gingham rug', 'Track crossing', 'Star night-light', 'Foam play mat', 'Crayon drawing', 'Spinning top'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d, ...(MOVE[f.id] || {}) };
  if (f.kind === 'field') { const blocks = f.crop === 'Corn' || f.crop === 'Beet' || f.crop === 'Lettuce';
    return blocks ? { ...s, kind:'blocks', name:'Block towers', stages:5 } : { ...s, kind:'cups', name:'Stacking cups', stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'toy', b:'path', v, rug:f.id === 'path3_6' ? 'r' : 't', name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'toy', b:'fence', edge:s.edge || f.edge, len:f.len, name:'Train track' };
  return { ...s, kind:'toy', ...MAP[f.id] };
});
const BUILD = { doll:dollhouse, castle, teepee, garage, theatre, station, tub:duckTub, bubbles:bubblePot, cloud:cloudMobile, pool:paddlePool,
  ballTree, pine:pineTree, stacker, giraffe, crayons:crayonCup, path, fence, hero:toyChest };

/* decor: odds and ends on the floorboards — marbles, a lone block, a crayon, a small ball */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc(), Y = p.y;
    const spot = (rad=.32) => { const q = r()*6.28, d = .1 + r()*rad; return [p.x + Math.cos(q)*d, p.z + Math.sin(q)*d]; };
    if (!sl || sl === 'later') {
      { const [px, pz] = spot(); marble(a, px, Y, pz, Math.floor(r()*5)); }
      { const [px, pz] = spot(.25); block(a, PAINT[Math.floor(r()*7)], px, Y, pz, .09, r()*3); }
      if (r() < .6) { const [px, pz] = spot(.25); crayon(a, PAINT[Math.floor(r()*7)], px, Y, pz, .18, r()*6); }
      if (r() < .35) { const [px, pz] = spot(.2); ball(a, [MAT.red, MAT.teal, MAT.yellow][Math.floor(r()*3)], px, Y + .06, pz, .06); }
      grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { if (r() < .5) marble(a, p.x + .34, Y, p.z + .34, Math.floor(r()*5));
      if (r() < .35) block(a, PAINT[Math.floor(r()*7)], p.x + .3, Y, p.z - .3, .07, r()*3);
      V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if ((Math.abs(x-3) === V.ring && x > 3) || (Math.abs(z-3) === V.ring && z > 3)) { marble(a, p.x + .4, Y, p.z + .4, Math.floor(r()*5)); grp.userData.decor = 'rim'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ════════════ residents: plushies that wave, a toy train on the track, a paper plane ════════════ */
function makePlush(kind){
  const g = new THREE.Group(), a = new Acc();
  const P = { teddy:[MAT.feltB, MAT.feltBL], pink:[MAT.feltP, MAT.feltW], bunny:[MAT.feltW, MAT.feltP], ele:[MAT.feltG, MAT.feltGL] }[kind], f = P[0], f2 = P[1];
  ball(a, f, 0, .1, 0, .085, 1, 1.05, .9); ball(a, f2, 0, .1, .055, .05, 1, 1.1, .5);
  for (const sx of [-1, 1]) ball(a, f, sx*.05, .025, .04, .035, 1, .8, 1.3);
  ball(a, f, 0, .23, 0, .075);
  for (const sx of [-1, 1]) ball(a, MAT.eye, sx*.026, .245, .066, .009);
  if (kind === 'bunny') { for (const sx of [-1, 1]) { a.add(new THREE.CapsuleGeometry(.022, .1, 4, 8), f, at(sx*.03, .34, -.01, 0, 1, 1, .6, 0, -sx*.15)); a.add(new THREE.CapsuleGeometry(.012, .08, 4, 8), f2, at(sx*.03, .34, .004, 0, 1, 1, .5, 0, -sx*.15)); }
    ball(a, f2, 0, .22, .07, .01); ball(a, f, 0, .09, -.08, .03); }
  else if (kind === 'ele') { for (const sx of [-1, 1]) a.add(new THREE.CylinderGeometry(.065, .065, .012, 16).rotateZ(Math.PI/2), f2, at(sx*.08, .24, -.01, sx*.35, 1, 1.1, 1));
    const cv = new THREE.CatmullRomCurve3([V3(0, .22, .06), V3(0, .18, .1), V3(0, .14, .11), V3(0, .12, .135)]); a.add(new THREE.TubeGeometry(cv, 8, .02, 8), f); }
  else { for (const sx of [-1, 1]) { ball(a, f, sx*.058, .29, 0, .026); ball(a, f2, sx*.058, .29, .012, .014); }
    ball(a, f2, 0, .215, .06, .03, 1.2, .9, 1); ball(a, MAT.nose, 0, .225, .088, .01); }
  if (kind === 'pink') { a.add(new THREE.TorusGeometry(.02, .01, 5, 10), MAT.red, at(-.03, .3, .0, 0, 1, 1, .6)); ball(a, MAT.red, 0, .165, .06, .016); }
  a.into(g);
  const arm = sx => { const p = new THREE.Group(); p.position.set(sx*.07, .145, 0); const m = new THREE.Mesh(new THREE.CapsuleGeometry(.024, .05, 4, 8), f); m.position.set(sx*.03, -.035, 0); m.rotation.z = sx*.5; m.castShadow = true; p.add(m); g.add(p); return p; };
  g.userData.armL = arm(-1); g.userData.armR = arm(1); return g;
}
function makeTrain(){
  const g = new THREE.Group(), a = new Acc();
  const car = (z0, body, top) => { for (const x of [-1, 1]) for (const dz of [-.05, .05]) a.add(new THREE.CylinderGeometry(.03, .03, .018, 12).rotateZ(Math.PI/2), MAT.woodDD, at(x*.055, .03, z0 + dz)); slab(a, MAT.woodL, .1, .02, .16, 0, .03, z0); if (body) body(z0); };
  car(.14, z => { slab(a, MAT.red, .1, .06, .16, 0, .05, z); a.add(new THREE.CylinderGeometry(.045, .045, .1, 14).rotateX(Math.PI/2), MAT.blue, at(0, .13, z + .03)); slab(a, MAT.blue, .1, .1, .06, 0, .1, z - .05); slab(a, MAT.yellow, .12, .02, .08, 0, .2, z - .05);
    cyl(a, MAT.dark, .018, .024, .06, 0, .17, z + .06, 10); ball(a, MAT.glowS, 0, .13, z + .085, .018); });
  car(-.06, z => { slab(a, MAT.yellow, .1, .05, .14, 0, .05, z); block(a, MAT.green, -.02, .1, z - .03, .045); block(a, MAT.red, .02, .1, z + .03, .045); cylBlock(a, MAT.blue, -.02, .1, z + .035, .04); });
  car(-.25, z => { slab(a, MAT.green, .1, .08, .14, 0, .05, z); slab(a, MAT.orange, .12, .02, .16, 0, .13, z); a.add(bx(.102, .03, .08), MAT.glow, at(0, .1, z)); });
  for (const z of [.04, -.16]) cyl(a, MAT.woodDD, .01, .01, .02, 0, .04, z, 6);
  a.into(g); return g;
}
function makePlane(){
  const g = new THREE.Group(), a = new Acc(), p = new THREE.Shape(); p.moveTo(0, .18); p.lineTo(.1, -.08); p.lineTo(0, -.04); p.lineTo(-.1, -.08); p.closePath();
  a.add(new THREE.ShapeGeometry(p).rotateX(-Math.PI/2), PM(0xFFFFFF, { side:THREE.DoubleSide }), at(0, 0, 0, 0, 1, 1, 1, 0, 0));
  a.add(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, .18), new THREE.Vector2(0, -.04), new THREE.Vector2(-.04, -.06)])).rotateY(Math.PI/2), PM(0xF4F0E6, { side:THREE.DoubleSide }), at(0, -.001, 0, 0, 1, 1, 1, Math.PI/2, 0));
  a.into(g); g.children.forEach(m => { m.rotation.x = 0; }); return g;
}

const RES_SCALE = 2.1;
const PLUSH_AT = [['teddy', 3, 4.35, .9], ['bunny', 3.35, 5.25, .5], ['ele', 2.65, 5.6, .8], ['pink', 3.2, 6.15, .6]];
const TRACK_X = () => cellPos(0, 0).x - .4, TRACK_Z = [-3.1, 2.1];
function moveResidents(t){
  (V && V.res || []).forEach((r, j) => { const u = r.u, e = r.arrive;
    if (r.kind === 'train') { const mid = (TRACK_Z[0] + TRACK_Z[1])/2, amp = (TRACK_Z[1] - TRACK_Z[0])/2, zt = mid + Math.sin(t*.32)*amp;
      r.obj.position.set(TRACK_X(), TILE_TOP + .03, THREE.MathUtils.lerp(4.4, zt, 1 - Math.pow(1 - e, 2))); r.obj.rotation.y = 0; return; }
    if (r.kind === 'plane') { const q = t*.45 + 1, rad = 2.3; r.obj.position.set(Math.cos(q)*rad*.9 + .3, TILE_TOP + 1.7 + Math.sin(t*1.1)*.08 + (1 - e)*2.5, Math.sin(q)*rad*.9 + .3);
      r.obj.rotation.set(0, -q + Math.PI, 0); r.obj.rotateZ(.35); return; }
    const walking = r.arrive < 1, p = u.from.clone().lerp(u.at, walking ? 1 - Math.pow(1 - r.arrive, 2.2) : 1);
    const hop = walking ? Math.abs(Math.sin(t*7 + j))*.08 : 0;
    r.obj.position.set(p.x, TILE_TOP + hop, p.z);
    r.obj.rotation.y = walking ? Math.atan2(u.at.x - u.from.x, u.at.z - u.from.z) : u.face;
    const w = walking ? 0 : Math.sin(t*5 + j*1.7);
    r.obj.userData.armR.rotation.z = walking ? 0 : 2.3 + w*.45; r.obj.userData.armL.rotation.z = walking ? 0 : -.2 - Math.max(0, -w)*.2;
    r.obj.rotation.z = walking ? 0 : Math.sin(t*2.5 + j)*.04;
  });
}
function spinTops(t){ if (!V) return; for (const id in V.pieces) { const s = V.pieces[id].userData.spin; if (s) { s.rotation.y = t*7; s.rotation.z = .07 + Math.sin(t*1.3)*.03; s.rotation.x = Math.cos(t*1.3)*.03; } } }
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.3 - j*.07))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(rs[0].obj.position.y + .3), 10, 0xFFD58A, .6); res(); })); }
const MAKE = { plush:() => makePlush('teddy'), train:() => makeTrain(), plane:() => makePlane() };
async function toysMoveIn(walk){
  V.residentsIn = true; V.res = [];
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const gate = cellPos(3, 7.4);
  const groups = [
    async () => { const rs = PLUSH_AT.map(([k, x, z, f], i) => { const o = makePlush(k); o.scale.setScalar(RES_SCALE); return addRes('plush', o, { at:cellPos(x, z), from:gate.clone().add(V3((i - 1.5)*.25, 0, i*.12)), face:f }); });
      moveResidents(0); if (walk) await arrive(rs, 2600); },
    async () => { const o = makeTrain(); o.scale.setScalar(2.6); const rs = [addRes('train', o, {})]; moveResidents(0); if (walk) await arrive(rs, 2000); },
    async () => { const o = makePlane(); o.scale.setScalar(2.2); const rs = [addRes('plane', o, {})]; moveResidents(0); if (walk) await arrive(rs, 1400); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length;
}

export default {
  id:'toys', name:'Toy room', title:'Your toy room',
  season:34, dates:'15–28 Feb', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'bath tubs, bubbles & paddling pools', tag:'Splash' },
    building:{ label:'dollhouses, castles & teepees',       tag:'House' },
    path:    { label:'rugs, play mats & train track',       tag:'Floor' },
    crop:    { label:'block towers & stacking cups',        tag:'Blocks' },
    tree:    { label:'wooden trees & stacking rings',       tag:'Tall toy' },
    special: { label:'the toy chest',                       tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:TILE, tileMap },
  ghost:{ color:'#FFFFFF', opacity:.42, emissive:.22, dash:'#FFFFFF', dashOpacity:.75 },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><rect x="3" y="11" width="18" height="10" rx="1.5" fill="#3F7CC4"/><rect x="3" y="11" width="18" height="2.2" fill="#E2BA86"/><path d="M3.5 10.5 5 3.5h14l1.5 7z" fill="#5B93D2"/><path d="M12 13.8l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="#F2B940"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M14 118h100v-6H14z"/><path d="M22 112V64h84v48z"/><path d="M22 64l6-40h72l6 40z" fill-opacity=".55"/><circle cx="46" cy="52" r="13"/><circle cx="36" cy="40" r="6"/><circle cx="56" cy="40" r="6"/><path d="M78 64V44h14v20z"/><path d="M76 44l8-10 8 10z"/><path d="M64 96l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill-opacity=".35"/></g>',
  album:{ image:'assets/toys/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#F6E6CF)' },
  css:'.phone[data-theme="toys"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#FBF1E2 58%,#F0DDC0 100%)}',
  env: buildEnv,

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'blocks' || s.kind === 'cups') {
      foamMat(g, s);
      const host = new THREE.Group(); host.scale.setScalar(1.15); g.add(host); g.userData.plants = host;
      const fill = s.kind === 'blocks' ? fillBlocks : fillCups;
      g.userData.regrow = st => fill(host, s, st); fill(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'toy' ? 1 : 1.15,
  contact: s => s.kind === 'toy' && !['path', 'fence', 'hero', 'doll', 'pool'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && s.v === 2),
  decor,
  tick(t){ spinTops(t); moveResidents(t); },

  residents:[ { id:'plush', name:'Plush friends', n:4 }, { id:'train', name:'Toy train', n:1 }, { id:'plane', name:'Paper plane', n:1 } ],
  moveIn: toysMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('toys:'+d.id, () => { const o = MAKE[d.id](); o.scale.setScalar(4); o.rotation.y = d.id === 'train' ? 1.2 : .5; return o; }, 168); },
  residentRig(d){ const obj = MAKE[d.id](); obj.scale.setScalar(d.id === 'plush' ? RES_SCALE : 2.2); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
