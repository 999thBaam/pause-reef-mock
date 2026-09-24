/* SNOW GLOBE (?theme=globe) — the whole land lives inside a souvenir snow globe: a glass ball on a turned walnut base with a
   brass collar, a painted holly band, a blank brass plaque and a music-box wind-up key. Snow drifts inside the glass; when the
   last piece lands the globe gets a shake and the snow swirls.
   Built on the farm's 7×7 ring blueprint (FARM_SLOTS: hero on the right, rings 6 / 15 / 19, FARM_ORDER), so pick-3, growth
   and expansion behave exactly like the farm. The engine's soil block is swapped (in env) for a round snow mound that meets
   the glass; the glass, base and snow scale with the land (3 → 5 → 7) through V.env.
   Look = a vintage "Christmas village" figurine set, not a real winter: pastel gabled shops with snowy roofs and glowing
   windows, a carousel, a bandstand, bottle-brush trees on wooden spools, gingerbread cottages and snowmen that are built stage
   by stage, candy-stripe lamp posts and garland rails, the little chapel with a clock tower (Gita).
   Everything is procedural flat-shaded three.js geometry merged per material (Acc). No asset files, nothing to license. */
import * as THREE from 'three';
import { rngFrom, TEX, world, fx } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { G, Acc, seg, blob, _up, _q, _m, _s } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { FARM_SLOTS as FARM, FARM_ORDER } from './farm.js';

const PM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.8, metalness:0, flatShading:true, ...o });
const SM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.7, metalness:0, ...o });
const GLOWM = (hex, e, k = 1.1) => new THREE.MeshStandardMaterial({ color:hex, emissive:e, emissiveIntensity:k, roughness:.45 });
const MAT = {
  snow:PM(0xFFFFFF, { roughness:.95 }), snowS:SM(0xFBF8FA, { roughness:.95 }), snowBed:PM(0xF3EEF2, { roughness:1 }), snowPath:PM(0xE9E2E8, { roughness:1 }),
  cobble:PM(0xB9B0C4), cobbleD:PM(0x9D94AB), stone:PM(0xCFC6D2), rock:PM(0xA9A2B8), rockD:PM(0x8C859E),
  wood:PM(0x8A5A36), woodL:PM(0xB98552), woodD:PM(0x5E3A22), iron:PM(0x2F3440), gold:SM(0xE2B04A, { metalness:.25, roughness:.4 }), brass:SM(0xD8AE55, { metalness:.3, roughness:.35 }),
  red:PM(0xD8453E), redD:PM(0xA8342F), cream:PM(0xFFF4E2), white:PM(0xFFFFFF), green:PM(0x2F7D5B), greenD:PM(0x23654A),
  mint:PM(0xA7DCC8), pink:PM(0xF4B3C2), butter:PM(0xF7DD8E), sky:PM(0xAFCFEF), lilac:PM(0xC9B6E8), peach:PM(0xF6C3A0),
  roofR:PM(0xC4524A), roofB:PM(0x5F7FB0), roofG:PM(0x4F8E73), roofP:PM(0x9B6BB0),
  door:PM(0x7A3B2E), doorG:PM(0x2F6F57), trim:PM(0xFFFFFF),
  win:GLOWM(0xFFE7A8, 0xFFB44A, 1.05), lamp:GLOWM(0xFFF1C4, 0xFFC24A, 1.6), bulbR:GLOWM(0xFF7A70, 0xFF3B30, 1.2), bulbY:GLOWM(0xFFE27A, 0xFFB800, 1.2),
  bulbG:GLOWM(0x9CF0B5, 0x2FCB64, 1.1), bulbB:GLOWM(0xA8D4FF, 0x3B8BFF, 1.1),
  ice:new THREE.MeshStandardMaterial({ color:0xCFEFFC, emissive:0x5AA9CF, emissiveIntensity:.25, roughness:.15, metalness:0, flatShading:true }),
  iceD:new THREE.MeshStandardMaterial({ color:0x9ED8F2, emissive:0x3E8DB8, emissiveIntensity:.25, roughness:.2, metalness:0, flatShading:true }),
  ginger:PM(0xB8773F), gingerD:PM(0x8E5528), icing:SM(0xFFFFFF, { roughness:.5 }), candyR:PM(0xE8484F), candyG:PM(0x5DBB7A), candyY:PM(0xF6C94C), candyP:PM(0xE98BD0), candyB:PM(0x6FB6F0),
  coal:PM(0x2A2A30), carrot:PM(0xF08A2C), skin:SM(0xF4C9A8), cheek:SM(0xF29A9A),
  pengB:SM(0x2B3444), pengW:SM(0xFFFFFF), beak:SM(0xF5A623),
  glass:new THREE.MeshStandardMaterial({ color:0xFFF3C4, emissive:0xFFC24A, emissiveIntensity:1.3, roughness:.3 })
};
const PASTEL = [MAT.mint, MAT.pink, MAT.butter, MAT.sky, MAT.lilac, MAT.peach];
const BRUSH = { mint:[0x8FD3B6, 0x6DBF9C], pink:[0xF3A9BC, 0xE58AA3], white:[0xF4F7F2, 0xDCE6E0], green:[0x3F9A70, 0x2F8260], sage:[0x9FC39A, 0x7FAA7A], lilac:[0xC7B4EA, 0xA994D8] };
const BRUSHM = {}; const brushMat = hex => BRUSHM[hex] || (BRUSHM[hex] = PM(hex, { roughness:.95 }));

function glowSprite(parent, pos, scale, color, opacity = .8){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; s.userData.glow = true; parent.add(s); return s; }
const box = (acc, mat, w, h, d, x, y, z, ry = 0) => acc.add(new THREE.BoxGeometry(w, h, d).translate(0, h/2, 0), mat, _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(new THREE.Euler(0, ry, 0)), _s));
const cyl = (acc, mat, r0, r1, h, x, y, z, n = 14) => acc.add(new THREE.CylinderGeometry(r1, r0, h, n).translate(x, y + h/2, z), mat);
const ball = (acc, mat, r, x, y, z, sy = 1, n = 10) => acc.add(new THREE.SphereGeometry(r, n, Math.max(6, n*.7|0)).scale(1, sy, 1).translate(x, y, z), mat);
function snowLumps(acc, rng, n, rad = .4, cx = 0, cz = 0, y = .02, sz = .06){
  for (let i=0;i<n;i++){ const a = rng()*6.28, d = rad*(.4 + rng()*.6); blob(acc, MAT.snowS, new THREE.Vector3(cx + Math.cos(a)*d, y, cz + Math.sin(a)*d), sz*(.6 + rng()*.7), .45, 1, rng); } }

/* ── a window: glowing pane in a white frame with a snowy sill, on the +z face (face 'z') or the +x face (face 'x') ── */
function win(acc, face, x, y, z, w = .1, h = .13, sill = true){
  const fz = face === 'z';
  const fr = fz ? new THREE.BoxGeometry(w + .04, h + .04, .02) : new THREE.BoxGeometry(.02, h + .04, w + .04);
  acc.add(fr.translate(x, y, z), MAT.trim);
  const pn = fz ? new THREE.BoxGeometry(w, h, .025) : new THREE.BoxGeometry(.025, h, w);
  acc.add(pn.translate(fz ? x : x + .004, y, fz ? z + .004 : z), MAT.win);
  const mu = fz ? new THREE.BoxGeometry(.012, h, .03) : new THREE.BoxGeometry(.03, h, .012); acc.add(mu.translate(fz ? x : x + .006, y, fz ? z + .006 : z), MAT.trim);
  const mh = fz ? new THREE.BoxGeometry(w, .012, .03) : new THREE.BoxGeometry(.03, .012, w); acc.add(mh.translate(fz ? x : x + .006, y, fz ? z + .006 : z), MAT.trim);
  if (sill) { const sl = fz ? new THREE.BoxGeometry(w + .07, .025, .06) : new THREE.BoxGeometry(.06, .025, w + .07); acc.add(sl.translate(fz ? x : x + .02, y - h/2 - .03, fz ? z + .02 : z), MAT.snow); }
}
/* ── a gabled house: walls w×d×h, ridge along z, snowy roof with an overhang, gable ends filled; front = +z ── */
function house(acc, o){
  const { w, d, h, rh, wall, roof, x = 0, z = 0, oh = .07, snowT = .045 } = o;
  box(acc, wall, w, h, d, x, 0, z);
  const tri = new THREE.Shape(); tri.moveTo(-w/2, 0); tri.lineTo(w/2, 0); tri.lineTo(0, rh); tri.closePath();
  acc.add(new THREE.ExtrudeGeometry(tri, { depth:d, bevelEnabled:false }).translate(x, h, z - d/2), wall);
  const hw = w/2 + oh, a = Math.atan2(rh, w/2), len = hw/Math.cos(a) + .02, t = .05;
  for (const s of [-1, 1]) {
    const cx = x + s*(hw/2 - .01), cy = h + rh - Math.tan(a)*hw/2 + .01;
    acc.add(new THREE.BoxGeometry(len, t, d + 2*oh), roof, _m.compose(new THREE.Vector3(cx, cy, z), _q.setFromEuler(new THREE.Euler(0, 0, -s*a)), _s));
    acc.add(new THREE.BoxGeometry(len*.97, snowT, d + 2*oh - .02), MAT.snow, _m.compose(new THREE.Vector3(cx + s*Math.sin(a)*(t/2 + snowT/2), cy + Math.cos(a)*(t/2 + snowT/2), z), _q.setFromEuler(new THREE.Euler(0, 0, -s*a)), _s));
  }
  // snow drips along the front eaves
  for (let i=0;i<5;i++) ball(acc, MAT.snow, .03, x + (i - 2)*w*.22, h + rh*.02, z + d/2 + oh*.8, 1.3, 6);
  return { top:h + rh + .05 };
}
function chimney(acc, x, y, z){ box(acc, MAT.cobbleD, .1, .2, .1, x, y, z); box(acc, MAT.snow, .13, .04, .13, x, y + .2, z); }
function door(acc, x, z, mat = MAT.door, face = 'z', wreath = false){
  if (face === 'z') { box(acc, mat, .13, .2, .03, x, 0, z); ball(acc, MAT.gold, .012, x + .04, .1, z + .02, 1, 6);
    if (wreath) acc.add(new THREE.TorusGeometry(.04, .014, 5, 12).translate(x, .15, z + .025), MAT.green);
    box(acc, MAT.stone, .2, .03, .1, x, 0, z + .05); }
  else { box(acc, mat, .03, .2, .13, x, 0, z); ball(acc, MAT.gold, .012, x + .02, .1, z + .04, 1, 6); box(acc, MAT.stone, .1, .03, .2, x + .05, 0, z); }
}
/* candy-stripe lamp post with a glowing lantern and a red bow */
function lampPost(acc, host, x, z, h = .5){
  const n = 6; for (let i=0;i<n;i++) cyl(acc, i%2 ? MAT.white : MAT.red, .018, .018, h/n, x, i*h/n, z, 8);
  cyl(acc, MAT.iron, .045, .035, .04, x, h, z, 8); box(acc, MAT.lamp, .07, .08, .07, x, h + .04, z);
  acc.add(new THREE.ConeGeometry(.065, .06, 4).rotateY(Math.PI/4).translate(x, h + .15, z), MAT.iron); ball(acc, MAT.snow, .035, x, h + .17, z, .6, 6);
  ball(acc, MAT.red, .018, x + .02, h - .06, z + .02, 1, 6);
  if (host) glowSprite(host, new THREE.Vector3(x, h + .08, z), .38, 0xFFD890, .55);
}

/* ── bottle-brush tree on a wooden spool: three jagged tiers, flocked tips, beads and a gold star ── */
function brushTier(r, h){
  const g = new THREE.ConeGeometry(r, h, 16, 1), p = g.attributes.position;
  for (let i=0;i<p.count;i++){ const y = p.getY(i); if (y > -h/2 + 1e-4) continue; const a = Math.atan2(p.getZ(i), p.getX(i)), k = Math.round(a/(Math.PI/8)) % 2 ? .74 : 1; p.setX(i, p.getX(i)*k); p.setZ(i, p.getZ(i)*k); }
  g.computeVertexNormals(); return g;
}
function brushTree(acc, rng, x, z, H, kind = 'mint', o = {}){
  const [c0, c1] = BRUSH[kind], R = H*.36;
  cyl(acc, MAT.woodL, .07*H/1.1 + .02, .07*H/1.1 + .02, .03, x, 0, z, 12); cyl(acc, MAT.wood, .05*H/1.1 + .015, .05*H/1.1 + .015, .06, x, .03, z, 12); cyl(acc, MAT.woodL, .07*H/1.1 + .02, .07*H/1.1 + .02, .03, x, .09, z, 12);
  seg(acc, MAT.woodD, new THREE.Vector3(x, .1, z), _up, H*.2, .025, .02, 6);
  const tiers = [[.13, .5, 1], [.4, .42, .76], [.64, .36, .5]];
  tiers.forEach(([y0, hh, rr], i) => { const r = R*rr, h = H*hh, y = .1 + H*y0*.9;
    acc.add(brushTier(r, h), brushMat(i%2 ? c1 : c0), _m.compose(new THREE.Vector3(x, y + h/2, z), _q.setFromEuler(new THREE.Euler(0, rng()*1.5, 0)), _s));
    if (o.flock !== false) for (let j=0;j<8;j++){ const a = j/8*6.28 + rng()*.3; ball(acc, MAT.snowS, r*.13, x + Math.cos(a)*r*.82, y + h*.08, z + Math.sin(a)*r*.82, .6, 6); }
    if (o.beads !== false) for (let j=0;j<5;j++){ const a = j/5*6.28 + i + rng()*.4; ball(acc, [MAT.candyR, MAT.gold, MAT.candyB, MAT.candyP][(j + i)%4], .022, x + Math.cos(a)*r*.62, y + h*.32, z + Math.sin(a)*r*.62, 1, 6); }
  });
  const top = .1 + H*.64*.9 + H*.36;
  if (o.star !== false) { const st = new THREE.Shape(); for (let i=0;i<10;i++){ const a = i/10*Math.PI*2 + Math.PI/2, r = i%2 ? .022 : .055; i ? st.lineTo(Math.cos(a)*r, Math.sin(a)*r) : st.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
    acc.add(new THREE.ExtrudeGeometry(st, { depth:.015, bevelEnabled:false }).translate(0, 0, -.0075), MAT.gold, _m.compose(new THREE.Vector3(x, top + .03, z), _q.setFromEuler(new THREE.Euler(0, Math.PI/4, 0)), _s)); }
  return top;
}

/* ── gingerbread cottage (Sudoku / Math): walls → roof → icing snow → gumdrops & candy canes → lit windows + lollipops ── */
function gingerCottage(acc, host, rng, st, tint){
  const w = .42, d = .4, h = .26, rh = .2;
  if (st >= 1) { box(acc, MAT.ginger, w, h, d, 0, .07, 0); box(acc, MAT.gingerD, .11, .16, .02, 0, .07, d/2);
    for (const sx of [-1, 1]) box(acc, MAT.gingerD, .08, .08, .02, sx*.13, .19, d/2);
    box(acc, MAT.gingerD, .02, .08, .08, w/2, .19, 0); }
  if (st >= 2) { const tri = new THREE.Shape(); tri.moveTo(-w/2, 0); tri.lineTo(w/2, 0); tri.lineTo(0, rh); tri.closePath();
    acc.add(new THREE.ExtrudeGeometry(tri, { depth:d, bevelEnabled:false }).translate(0, .07 + h, -d/2), MAT.ginger);
    const hw = w/2 + .05, a = Math.atan2(rh, w/2), len = hw/Math.cos(a) + .02;
    for (const s of [-1, 1]) { const cx = s*(hw/2 - .01), cy = .07 + h + rh - Math.tan(a)*hw/2 + .01;
      acc.add(new THREE.BoxGeometry(len, .04, d + .1), MAT.gingerD, _m.compose(new THREE.Vector3(cx, cy, 0), _q.setFromEuler(new THREE.Euler(0, 0, -s*a)), _s));
      if (st >= 3) acc.add(new THREE.BoxGeometry(len*.98, .035, d + .08), MAT.icing, _m.compose(new THREE.Vector3(cx + s*Math.sin(a)*.04, cy + Math.cos(a)*.04, 0), _q.setFromEuler(new THREE.Euler(0, 0, -s*a)), _s)); } }
  if (st >= 3) { for (let i=0;i<6;i++) ball(acc, MAT.icing, .022, -w/2 + .03 + i*(w - .06)/5, .07 + h + .01, d/2 + .04, 1.5, 6);            // icing drips
    for (const sx of [-1, 1]) acc.add(new THREE.BoxGeometry(.1, .014, .02).translate(sx*.13, .19, d/2 + .012), MAT.icing), acc.add(new THREE.BoxGeometry(.014, .1, .02).translate(sx*.13, .19, d/2 + .012), MAT.icing); }
  if (st >= 4) { for (let i=0;i<5;i++) ball(acc, [MAT.candyR, MAT.candyG, MAT.candyY, MAT.candyP, MAT.candyB][(i + tint)%5], .03, 0, .07 + h + rh + .03, -d/2 + .04 + i*(d - .08)/4, .8, 8);   // gumdrops on the ridge
    for (const sx of [-1, 1]) { const x = sx*.25, z = d/2 + .1;                                                                              // candy canes by the door
      for (let i=0;i<5;i++) cyl(acc, i%2 ? MAT.white : MAT.candyR, .014, .014, .045, x, .07 + i*.045, z, 6);
      acc.add(new THREE.TorusGeometry(.035, .014, 5, 10, Math.PI).translate(x - sx*.035, .07 + .225, z), MAT.candyR); } }
  if (st >= 5) { for (const sx of [-1, 1]) box(acc, MAT.win, .06, .06, .01, sx*.13, .2, d/2 + .014); box(acc, MAT.win, .01, .06, .06, w/2 + .012, .2, 0);
    for (const [x, z, c] of [[-.3, -.15, MAT.candyP], [.3, -.2, MAT.candyB]]) { seg(acc, MAT.white, new THREE.Vector3(x, .07, z), _up, .2, .008, .008, 4);
      acc.add(new THREE.CylinderGeometry(.06, .06, .02, 14).rotateX(Math.PI/2).rotateY(Math.PI/4).translate(x, .3, z), c); }
    glowSprite(host, new THREE.Vector3(.1, .22, .25), .35, 0xFFC878, .45); }
}
/* ── snowman family (Sudoku / Math): a snowball → two → a face → scarf & twig arms → knit hat + a snow-baby ── */
function snowman(acc, rng, st, x, z, s = 1, hatMat = MAT.red, scarfMat = MAT.green){
  const r1 = .13*s, r2 = .095*s, r3 = .07*s;
  if (st >= 1) ball(acc, MAT.snowS, r1, x, .07 + r1*.9, z, .95, 12);
  if (st >= 2) ball(acc, MAT.snowS, r2, x, .07 + r1*1.75 + r2*.8, z, .95, 12);
  const hy = .07 + r1*1.75 + r2*1.6 + r3*.85;
  if (st >= 3) { ball(acc, MAT.snowS, r3, x, hy, z, 1, 12);
    for (const sx of [-1, 1]) ball(acc, MAT.coal, .011*s, x + sx*r3*.35 + r3*.25, hy + r3*.25, z + r3*.8, 1, 6);
    acc.add(new THREE.ConeGeometry(.016*s, .09*s, 6).rotateX(Math.PI/2).translate(x + r3*.3, hy, z + r3 + .03*s), MAT.carrot);
    for (let i=0;i<3;i++) ball(acc, MAT.coal, .012*s, x + r2*.3, .07 + r1*1.75 + r2*(1.1 - i*.35), z + r2*.93, 1, 6); }
  if (st >= 4) { acc.add(new THREE.TorusGeometry(r3*.95, .025*s, 6, 14).rotateX(Math.PI/2).translate(x, hy - r3*.72, z), scarfMat);
    box(acc, scarfMat, .04*s, .1*s, .02*s, x + r3*.5, hy - r3*.72 - .1*s, z + r3*.8);
    for (const sx of [-1, 1]) seg(acc, MAT.woodD, new THREE.Vector3(x + sx*r2*.9, .07 + r1*1.75 + r2*.9, z), new THREE.Vector3(sx, .7, .1), .15*s, .01*s, .007*s, 4); }
  if (st >= 5) { cyl(acc, hatMat, r3*.95, r3*.5, r3*1.1, x, hy + r3*.6, z, 12); ball(acc, MAT.white, .03*s, x, hy + r3*1.8, z, 1, 8);
    cyl(acc, MAT.white, r3*1.02, r3*1.02, .03*s, x, hy + r3*.58, z, 12); }
}
const BED = { Corn:'ginger', Carrot:'snowman', Lettuce:'ginger', Beet:'snowman' };
const BED_NAME = { ginger:'Gingerbread cottage', snowman:'Snowman family' };
function fillBed(host, s, stage){
  host.clear();
  const r = rngFrom(s.x*31 + s.z*7 + 5), acc = new Acc(), st = Math.min(stage, 5), kind = BED[s.crop], tint = s.x + s.z;
  if (kind === 'ginger') { gingerCottage(acc, host, r, st, tint); if (st >= 2) snowLumps(acc, r, 3, .38, 0, 0, .07, .05); }
  else { const hats = [MAT.red, MAT.roofB, MAT.candyP, MAT.roofG], scarves = [MAT.green, MAT.candyY, MAT.red, MAT.candyB];
    snowman(acc, r, st, -.08, -.02, 1.15, hats[tint%4], scarves[tint%4]);
    if (st >= 5) snowman(acc, r, 5, .24, .22, .6, hats[(tint + 1)%4], scarves[(tint + 2)%4]);
    else if (st >= 2) ball(acc, MAT.snowS, .06, .25, .12, .2, .9, 10);
    for (let i=0;i<4;i++) ball(acc, MAT.snowPath, .02, -.3 + i*.12, .075, .32 - (i%2)*.05, .4, 6); }                              // footprints
  acc.m.size && acc.into(host); host.userData.stage = stage;
}

/* ── pieces ── */
const B = {
  carousel(g){
    const a = new Acc(), r = rngFrom(3);
    cyl(a, MAT.red, .88, .88, .06, 0, 0, 0, 32); cyl(a, MAT.cream, .84, .84, .06, 0, .06, 0, 32);
    for (let i=0;i<24;i++){ const an = i/24*6.28; ball(a, MAT.gold, .015, Math.cos(an)*.87, .04, Math.sin(an)*.87, 1, 6); }
    cyl(a, MAT.gold, .13, .11, 1.0, 0, .12, 0, 16); cyl(a, MAT.pink, .2, .2, .22, 0, .12, 0, 16);
    for (let i=0;i<8;i++) box(a, MAT.win, .06, .1, .01, Math.cos(i/8*6.28)*.2, .18, Math.sin(i/8*6.28)*.2, -i/8*6.28 + Math.PI/2);
    const Y0 = 1.1, CH = .42, RB = .95, RT = .12;
    for (let i=0;i<16;i++) a.add(new THREE.CylinderGeometry(RT, RB, CH, 2, 1, false, i/16*Math.PI*2, Math.PI*2/16).translate(0, Y0 + CH/2, 0), i%2 ? MAT.cream : MAT.red);
    const rAt = y => RB - (y - Y0)/CH*(RB - RT), yS = Y0 + CH*.42, apex = Y0 + CH*RB/(RB - RT);
    a.add(new THREE.ConeGeometry(rAt(yS) + .02, apex - yS, 32).translate(0, yS + (apex - yS)/2 + .015, 0), MAT.snow);
    for (let i=0;i<16;i++){ const an = i/16*6.28 + .2; ball(a, MAT.snow, .04, Math.cos(an)*(rAt(yS) - .01), yS + .01, Math.sin(an)*(rAt(yS) - .01), 1.3, 6); }
    for (let i=0;i<24;i++){ const an = i/24*6.28; ball(a, i%2 ? MAT.red : MAT.cream, .055, Math.cos(an)*RB, Y0 - .01, Math.sin(an)*RB, .8, 8);        // scalloped valance
      ball(a, [MAT.bulbY, MAT.bulbR, MAT.bulbG, MAT.bulbB][i%4], .022, Math.cos(an)*(RB - .03), Y0 + .07, Math.sin(an)*(RB - .03), 1, 6); }
    cyl(a, MAT.gold, .1, .08, .08, 0, apex - .05, 0, 12); ball(a, MAT.gold, .06, 0, apex + .08, 0, 1, 10);
    seg(a, MAT.gold, new THREE.Vector3(0, apex + .1, 0), _up, .18, .008, .008, 4); a.add(new THREE.BoxGeometry(.1, .06, .008).translate(.05, apex + .24, 0), MAT.red);
    const HC = [MAT.white, MAT.pink, MAT.mint, MAT.butter, MAT.sky, MAT.lilac];
    for (let i=0;i<6;i++){ const an = i/6*6.28 + .3, px = Math.cos(an)*.6, pz = Math.sin(an)*.6, hy = .34 + (i%2)*.14;
      cyl(a, MAT.gold, .02, .02, Y0 - .12, px, .12, pz, 6);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -an - Math.PI/2, 0)), M = new THREE.Matrix4(), P = new THREE.Vector3(px, hy, pz), hc = HC[i];
      const add = (geo, mat) => a.add(geo, mat, M.compose(P, q, _s));
      add(new THREE.SphereGeometry(.1, 10, 7).scale(1.55, .75, .7), hc);
      add(new THREE.BoxGeometry(.06, .16, .07).translate(.12, .1, 0).rotateZ(-.35), hc);
      add(new THREE.BoxGeometry(.13, .065, .065).translate(.19, .19, 0), hc);
      add(new THREE.BoxGeometry(.03, .1, .02).translate(.1, .18, 0).rotateZ(.3), MAT.gold);                         // mane
      add(new THREE.SphereGeometry(.012, 6, 4).translate(.22, .2, .035), MAT.coal); add(new THREE.SphereGeometry(.012, 6, 4).translate(.22, .2, -.035), MAT.coal);
      add(new THREE.BoxGeometry(.11, .03, .09).translate(0, .075, 0), MAT.red);                                          // saddle
      for (const [lx, lz, rz] of [[.1, .04, -.7], [.1, -.04, -.5], [-.1, .04, .6], [-.1, -.04, .8]]) add(new THREE.BoxGeometry(.028, .13, .028).translate(0, -.06, 0).rotateZ(rz).translate(lx, -.03, lz), hc);
      add(new THREE.ConeGeometry(.03, .12, 5).rotateZ(1.9).translate(-.17, .02, 0), MAT.gold); }
    snowLumps(a, r, 4, .95, 0, 0, .02, .06);
    a.into(g); glowSprite(g, new THREE.Vector3(0, Y0 + .05, 0), 1.3, 0xFFD890, .3);
  },
  townhouse(g){ const a = new Acc(); house(a, { w:.5, d:.46, h:.95, rh:.3, wall:MAT.mint, roof:MAT.roofB });
    for (const y of [.35, .62]) { win(a, 'z', -.12, y, .23); win(a, 'z', .12, y, .23); win(a, 'x', .25, y, 0); }
    win(a, 'z', 0, 1.06, .23, .08, .09, false); door(a, 0, .23, MAT.doorG, 'z', true); chimney(a, -.14, 1.02, -.08);
    a.into(g); },
  bakery(g){ const a = new Acc(); house(a, { w:.62, d:.5, h:.6, rh:.26, wall:MAT.butter, roof:MAT.roofR });
    for (let i=0;i<6;i++) a.add(new THREE.BoxGeometry(.1, .025, .2), i%2 ? MAT.white : MAT.candyR, _m.compose(new THREE.Vector3(-.25 + i*.1, .47, .33), _q.setFromEuler(new THREE.Euler(.45, 0, 0)), _s));
    win(a, 'z', -.16, .3, .25, .16, .16); win(a, 'x', .31, .33, 0, .14, .14); door(a, .16, .25, MAT.door, 'z');
    box(a, MAT.wood, .2, .03, .07, -.18, .11, .38); for (const sx of [-1, 1]) box(a, MAT.woodD, .02, .11, .02, -.18 + sx*.08, 0, .38);     // bench
    chimney(a, .15, .7, -.1); a.into(g); },
  toyshop(g){ const a = new Acc(); house(a, { w:.58, d:.52, h:.66, rh:.28, wall:MAT.pink, roof:MAT.roofP });
    cyl(a, MAT.trim, .15, .15, .3, -.1, .14, .24, 10); cyl(a, MAT.win, .13, .13, .26, -.1, .16, .26, 10); cyl(a, MAT.roofP, .17, .02, .1, -.1, .44, .24, 10);
    ball(a, MAT.snow, .1, -.1, .5, .24, .35, 8); win(a, 'x', .29, .42, -.1); door(a, .17, .26, MAT.doorG, 'z', true);
    // a little rocking horse and a toy drum out front
    box(a, MAT.candyR, .12, .06, .04, .26, .08, .42); a.add(new THREE.TorusGeometry(.08, .01, 4, 12, Math.PI).rotateZ(Math.PI).translate(.26, .09, .42), MAT.wood);
    cyl(a, MAT.candyB, .045, .045, .06, -.3, 0, .38, 10); a.into(g); },
  cottage(g, s){ const a = new Acc(), wall = PASTEL[s.tint || 0], roof = [MAT.roofR, MAT.roofG, MAT.roofB][s.tint%3];
    house(a, { w:.56, d:.5, h:.5, rh:.3, wall, roof }); win(a, 'z', -.14, .28, .25); win(a, 'x', .28, .28, 0); door(a, .12, .25, MAT.door, 'z', true);
    chimney(a, -.13, .63, -.1); const r = rngFrom(s.x*3 + s.z); brushTree(a, r, .34, .36, .32, 'white', { star:false }); a.into(g); },
  bandstand(g){ const a = new Acc(), r = rngFrom(12);
    cyl(a, MAT.cream, .42, .42, .1, 0, 0, 0, 8); cyl(a, MAT.stone, .44, .44, .03, 0, 0, 0, 8);
    for (let i=0;i<8;i++){ const an = i/8*6.28 + Math.PI/8; cyl(a, MAT.white, .02, .02, .48, Math.cos(an)*.36, .1, Math.sin(an)*.36, 6);
      a.add(new THREE.CylinderGeometry(.005, .005, .28, 4).rotateZ(Math.PI/2).rotateY(-an - Math.PI/8 + Math.PI/2).translate(Math.cos(an + Math.PI/8)*.33, .26, Math.sin(an + Math.PI/8)*.33), MAT.white); }
    a.add(new THREE.ConeGeometry(.5, .32, 8).rotateY(Math.PI/8).translate(0, .74, 0), MAT.roofG);
    a.add(new THREE.ConeGeometry(.4, .24, 8).rotateY(Math.PI/8).translate(0, .8, 0), MAT.snow);
    for (let i=0;i<16;i++){ const an = i/16*6.28; ball(a, [MAT.bulbY, MAT.bulbR, MAT.bulbG, MAT.bulbB][i%4], .02, Math.cos(an)*.46, .58, Math.sin(an)*.46, 1, 6); }
    ball(a, MAT.gold, .04, 0, .96, 0, 1, 8); cyl(a, MAT.gold, .04, .04, .06, -.08, .1, .02, 10);                                    // a little drum on the floor
    snowLumps(a, r, 3, .5, 0, 0, .02, .05); a.into(g); glowSprite(g, new THREE.Vector3(0, .45, 0), .7, 0xFFD890, .3); },
  chapel(g){
    const a = new Acc(), r = rngFrom(88);
    blob(a, MAT.snowS, new THREE.Vector3(0, 0, 0), .92, .12, 2, r);
    const Y = .08;
    // nave (ridge along z), cream walls, deep red roof under snow
    const nave = new Acc(); house(nave, { w:.62, d:.9, h:.62, rh:.34, wall:MAT.cream, roof:MAT.roofR, z:-.22 });
    for (const z of [-.5, -.22, .06]) { box(nave, MAT.trim, .02, .26, .14, .31, .2, z); box(nave, MAT.win, .025, .22, .1, .314, .22, z);
      nave.add(new THREE.CylinderGeometry(.05, .05, .025, 10, 1, false, 0, Math.PI).rotateZ(Math.PI/2).translate(.316, .44, z), MAT.win); }
    // tower at the front (+z) with a clock on two faces, a belfry and a spire
    const TZ = .36, TW = .38, TH = 1.12;
    box(nave, MAT.cream, TW, TH, TW, 0, 0, TZ); box(nave, MAT.trim, TW + .04, .04, TW + .04, 0, TH, TZ); box(nave, MAT.trim, TW + .03, .03, TW + .03, 0, .62, TZ);
    for (const f of ['z', 'x']) { const cx = f === 'x' ? TW/2 + .012 : 0, cz = f === 'x' ? TZ : TZ + TW/2 + .012, rot = f === 'x' ? Math.PI/2 : 0, cy = .86;
      const P = new THREE.Vector3(cx, cy, cz), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0));
      nave.add(new THREE.CircleGeometry(.12, 24), MAT.white, _m.compose(P, q, _s)); nave.add(new THREE.TorusGeometry(.12, .018, 6, 24), MAT.gold, _m.compose(P, q, _s));
      for (let i=0;i<12;i++){ const an = i/12*6.28; nave.add(new THREE.BoxGeometry(.012, .012, .01).translate(Math.cos(an)*.095, Math.sin(an)*.095, .006), MAT.iron, _m.compose(P, q, _s)); }
      nave.add(new THREE.BoxGeometry(.014, .08, .01).translate(0, .035, .01), MAT.iron, _m.compose(P, q, _s));
      nave.add(new THREE.BoxGeometry(.06, .012, .01).translate(.026, 0, .012).rotateZ(-.5), MAT.iron, _m.compose(P, q, _s));
      // belfry arch with a bell
      const bx = f === 'x' ? TW/2 + .006 : 0, bz = f === 'x' ? TZ : TZ + TW/2 + .006;
      nave.add((f === 'x' ? new THREE.BoxGeometry(.02, .16, .12) : new THREE.BoxGeometry(.12, .16, .02)).translate(bx, 1.02 - .08 + .04, bz), MAT.woodD); }
    ball(nave, MAT.gold, .05, 0, .97, TZ, 1.1, 10);
    // arched door with a wreath, steps
    box(nave, MAT.door, .16, .26, .03, 0, 0, TZ + TW/2); nave.add(new THREE.CylinderGeometry(.08, .08, .03, 12, 1, false, 0, Math.PI).rotateZ(Math.PI/2).rotateY(Math.PI/2).translate(0, .26, TZ + TW/2), MAT.door);
    nave.add(new THREE.TorusGeometry(.05, .016, 5, 14).translate(0, .23, TZ + TW/2 + .03), MAT.green); ball(nave, MAT.red, .018, 0, .185, TZ + TW/2 + .04, 1, 6);
    box(nave, MAT.stone, .3, .04, .12, 0, 0, TZ + TW/2 + .06); box(nave, MAT.stone, .24, .04, .08, 0, .04, TZ + TW/2 + .04);
    win(nave, 'x', TW/2, .42, TZ, .08, .14);
    // spire: a 4-sided red pyramid, snow on it, a gold star
    const SY = TH + .04; nave.add(new THREE.ConeGeometry(.3, .58, 4).rotateY(Math.PI/4).translate(0, SY + .29, TZ), MAT.roofR);
    nave.add(new THREE.ConeGeometry(.22, .32, 4).rotateY(Math.PI/4).translate(0, SY + .44, TZ), MAT.snow);
    const st = new THREE.Shape(); for (let i=0;i<10;i++){ const an = i/10*Math.PI*2 + Math.PI/2, rr = i%2 ? .035 : .085; i ? st.lineTo(Math.cos(an)*rr, Math.sin(an)*rr) : st.moveTo(Math.cos(an)*rr, Math.sin(an)*rr); }
    seg(nave, MAT.gold, new THREE.Vector3(0, SY + .56, TZ), _up, .1, .01, .01, 4);
    nave.add(new THREE.ExtrudeGeometry(st, { depth:.02, bevelEnabled:false }).translate(0, 0, -.01), MAT.gold, _m.compose(new THREE.Vector3(0, SY + .72, TZ), _q.setFromEuler(new THREE.Euler(0, Math.PI/4, 0)), _s));
    const ng = new THREE.Group(); ng.position.set(.05, Y, -.02); ng.rotation.y = 0; nave.into(ng); g.add(ng);
    // lamps, trees, a bench, snow
    lampPost(a, g, .55, .62, .5); lampPost(a, g, -.3, .75, .5);
    brushTree(a, r, -.66, -.45, .7, 'green'); brushTree(a, r, -.7, .2, .5, 'white'); brushTree(a, r, .6, -.72, .55, 'mint');
    box(a, MAT.wood, .24, .03, .08, .62, .12, .1, Math.PI/2); for (const sz of [-1, 1]) box(a, MAT.woodD, .07, .12, .02, .62, 0, .1 + sz*.09, Math.PI/2);
    snowLumps(a, r, 6, .85, 0, 0, .06, .07);
    a.into(g);
    glowSprite(g, new THREE.Vector3(.36, .38, -.2), .9, 0xFFC878, .45); glowSprite(g, new THREE.Vector3(.05, SY + .78, TZ - .02), .45, 0xFFE9A0, .7);
  },
  fountain(g){ const a = new Acc(), r = rngFrom(21);
    cyl(a, MAT.stone, .4, .38, .12, 0, 0, 0, 16); a.add(new THREE.CylinderGeometry(.34, .34, .02, 24).translate(0, .12, 0), MAT.ice);
    cyl(a, MAT.stone, .06, .05, .32, 0, .12, 0, 10); cyl(a, MAT.stone, .1, .2, .06, 0, .42, 0, 16); a.add(new THREE.CylinderGeometry(.17, .17, .015, 16).translate(0, .48, 0), MAT.ice);
    for (let i=0;i<12;i++){ const an = i/12*6.28; a.add(new THREE.ConeGeometry(.018, .07 + r()*.06, 5).rotateX(Math.PI).translate(Math.cos(an)*.2, .4, Math.sin(an)*.2), MAT.ice); }
    for (let i=0;i<16;i++){ const an = i/16*6.28; a.add(new THREE.ConeGeometry(.02, .06 + r()*.05, 5).rotateX(Math.PI).translate(Math.cos(an)*.4, .08, Math.sin(an)*.4), MAT.ice); }
    a.add(new THREE.ConeGeometry(.06, .22, 7).translate(0, .6, 0), MAT.iceD); ball(a, MAT.ice, .05, 0, .72, 0, 1.2, 8);
    for (let i=0;i<10;i++){ const an = i/10*6.28; ball(a, MAT.snow, .045, Math.cos(an)*.39, .12, Math.sin(an)*.39, .5, 6); }
    a.into(g); },
  pond(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z);
    const ice = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .02, 32), ICE_TEX_MAT); ice.position.y = .02; ice.receiveShadow = true; g.add(ice);
    for (let i=0;i<18;i++){ const an = i/18*6.28; blob(a, MAT.snowS, new THREE.Vector3(Math.cos(an)*.44, .02, Math.sin(an)*.44), .05 + r()*.03, .5, 1, r); }
    lampPost(a, g, -.36, -.36, .42); a.into(g); },
  falls(g){ const a = new Acc(), r = rngFrom(33);
    for (const [x, z, rr, sy] of [[-.2, -.2, .26, 1.5], [.05, -.28, .2, 1.1], [-.3, .05, .18, 1], [.2, -.1, .13, .8]]) blob(a, r() < .5 ? MAT.rock : MAT.rockD, new THREE.Vector3(x, .05, z), rr, sy, 1, r);
    ball(a, MAT.snow, .16, -.22, .38, -.2, .35, 8); ball(a, MAT.snow, .12, .04, .22, -.28, .4, 8);
    a.add(new THREE.CylinderGeometry(.26, .26, .02, 20).translate(.12, .03, .14), MAT.ice);
    const fall = new THREE.BoxGeometry(.2, .36, .06).translate(0, .18, 0); a.add(fall, MAT.iceD, _m.compose(new THREE.Vector3(-.02, .04, -.02), _q.setFromEuler(new THREE.Euler(-.12, Math.PI/4, 0)), _s));
    for (let i=0;i<7;i++) a.add(new THREE.ConeGeometry(.02, .1 + r()*.1, 5).rotateX(Math.PI).translate(-.12 + i*.04, .36, .06 + i*.01), MAT.ice);
    for (let i=0;i<8;i++){ const an = i/8*6.28; ball(a, MAT.snow, .04, .12 + Math.cos(an)*.27, .03, .14 + Math.sin(an)*.27, .5, 6); }
    a.into(g); },
  brush(g, s){ const a = new Acc(), r = rngFrom(s.x*5 + s.z*3);
    if (s.v === 'one') brushTree(a, r, 0, 0, s.h || 1.15, s.c);
    else if (s.v === 'pair') { brushTree(a, r, -.14, -.12, s.h || 1.05, s.c); brushTree(a, r, .2, .18, (s.h || 1.05)*.62, s.c2 || 'white'); }
    else { brushTree(a, r, -.16, -.14, .95, s.c); brushTree(a, r, .2, -.08, .7, s.c2 || 'pink'); brushTree(a, r, .02, .22, .55, 'white'); }
    snowLumps(a, r, 3, .42, 0, 0, .02, .05); a.into(g); },
  path(g, s){ const slab = new THREE.Mesh(G.path, MAT.snowPath); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
    const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0;
    if (v === 0) { for (let i=0;i<4;i++) for (let j=0;j<3;j++) a.add(new THREE.CylinderGeometry(.075, .08, .025, 7), (i + j)%2 ? MAT.cobble : MAT.cobbleD, _m.makeTranslation(-.2 + j*.2 + (i%2)*.08 - .04, .045, -.33 + i*.22));
      snowLumps(a, r, 4, .44, 0, 0, .04, .05); g.userData.ghostMode = 'marker'; }
    else if (v === 1) { for (let i=0;i<4;i++) a.add(new THREE.CylinderGeometry(.12, .13, .03, 9), MAT.stone, _m.makeTranslation((i%2 ? .09 : -.09) + (r()-.5)*.04, .045, -.33 + i*.22)); snowLumps(a, r, 3, .44, 0, 0, .04, .05); g.userData.ghostMode = 'marker'; }
    else if (v === 2) { lampPost(a, g, -.3, -.28, .52); lampPost(a, g, .3, .28, .52); for (let i=0;i<3;i++) a.add(new THREE.CylinderGeometry(.08, .08, .02, 7), MAT.cobble, _m.makeTranslation(-.1 + i*.1, .045, .1 - i*.1)); }
    else if (v === 3) { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, .6, 0)), M = new THREE.Matrix4().compose(new THREE.Vector3(-.02, .035, .02), q, _s);   // sled with presents
      const add = (geo, mat) => a.add(geo, mat, M);
      for (const sz of [-.1, .1]) { add(new THREE.BoxGeometry(.5, .02, .02).translate(0, .01, sz), MAT.candyR); add(new THREE.TorusGeometry(.05, .01, 4, 8, Math.PI/2).translate(.25, .06, sz), MAT.candyR); for (const sx of [-.15, .1]) add(new THREE.BoxGeometry(.02, .07, .02).translate(sx, .045, sz), MAT.woodD); }
      add(new THREE.BoxGeometry(.44, .025, .26).translate(-.02, .09, 0), MAT.woodL);
      [[-.12, 0, .14, MAT.candyB, MAT.gold], [.05, .02, .11, MAT.candyP, MAT.white], [-.06, -.02, .09, MAT.candyY, MAT.red]].forEach(([x, z, sz, m1, m2], i) => {
        add(new THREE.BoxGeometry(sz, sz, sz).translate(x, .1 + sz/2 + (i === 2 ? .14 : 0), z), m1); add(new THREE.BoxGeometry(sz + .005, sz + .005, .02).translate(x, .1 + sz/2 + (i === 2 ? .14 : 0), z), m2); add(new THREE.BoxGeometry(.02, sz + .005, sz + .005).translate(x, .1 + sz/2 + (i === 2 ? .14 : 0), z), m2); }); }
    else { box(a, MAT.woodL, .3, .03, .1, 0, .15, -.1); box(a, MAT.woodL, .3, .08, .02, 0, .2, -.15); for (const sx of [-1, 1]) box(a, MAT.iron, .02, .15, .1, sx*.13, .035, -.1);   // bench + lamp
      ball(a, MAT.snow, .06, -.05, .19, -.1, .35, 6); lampPost(a, g, .3, .2, .5); snowLumps(a, r, 2, .4, 0, 0, .04, .05); }
    a.into(g); },
  fence(g, s){ const a = new Acc(), n = s.len*2 + 1, L = s.len;
    const pos = i => { const t = -L/2 + i*(L/(n-1)); return s.edge === 'w' ? new THREE.Vector3(-.45, 0, t) : new THREE.Vector3(t, 0, .45); };
    for (let i=0;i<n;i++){ const p = pos(i); cyl(a, MAT.white, .03, .028, .3, p.x, 0, p.z, 8); ball(a, MAT.snow, .04, p.x, .31, p.z, .6, 6);
      box(a, MAT.red, .07, .03, .03, p.x, .22, p.z, s.edge === 'w' ? Math.PI/2 : 0); }
    for (let i=0;i<n-1;i++){ const p0 = pos(i), p1 = pos(i+1), c = new THREE.CatmullRomCurve3([p0.clone().setY(.24), p0.clone().lerp(p1, .5).setY(.16), p1.clone().setY(.24)]);
      a.add(new THREE.TubeGeometry(c, 10, .026, 6), MAT.green);
      for (let k=1;k<4;k++){ const q = c.getPoint(k/4); ball(a, [MAT.bulbR, MAT.bulbY, MAT.bulbB][(i + k)%3], .02, q.x, q.y - .025, q.z, 1, 6); } }
    a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz); }
};
/* skate-scratched ice for the ponds */
const ICE_TEX_MAT = (() => { const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(17);
  const gr = g.createRadialGradient(N/2, N/2, 10, N/2, N/2, N/2); gr.addColorStop(0, '#E3F6FF'); gr.addColorStop(1, '#A9DDF3'); g.fillStyle = gr; g.fillRect(0, 0, N, N);
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; for (let i=0;i<9;i++){ g.beginPath(); g.ellipse(N/2 + (r()-.5)*40, N/2 + (r()-.5)*40, 40 + r()*70, 30 + r()*50, r()*3, 0, 5.5); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return [new THREE.MeshStandardMaterial({ color:0xFFFFFF, map:t, roughness:.2, emissive:0x3E8DB8, emissiveIntensity:.12 })]; })()[0];

/* blueprint: every farm slot id → a globe piece (same cells, same rings, same order; the chapel in the right-hand corner) */
const MAP = {
  bigbarn:{ name:'Carousel', b:'carousel' }, well:{ name:'Frozen fountain', b:'fountain' },
  apple1:{ name:'Mint brush tree', b:'brush', v:'one', c:'mint', h:1.2 },
  silo:{ name:'Tall townhouse', b:'townhouse' }, silohouse:{ name:'Bakery', b:'bakery' }, coop:{ name:'Toy shop', b:'toyshop' },
  watertower:{ name:'Skating pond', b:'pond' }, pump:{ name:'Icicle falls', b:'falls' },
  apple2:{ name:'Pink brush tree', b:'brush', v:'one', c:'pink', h:1.1 }, berry1:{ name:'Brush-tree trio', b:'brush', v:'trio', c:'green', c2:'pink' },
  peepal:{ name:'Little chapel', b:'chapel' }, smallbarn:{ name:'Sky cottage', b:'cottage', tint:3 },
  openbarn:{ name:'Bandstand', b:'bandstand' }, pond:{ name:'Skating pond', b:'pond' },
  orange1:{ name:'Flocked fir', b:'brush', v:'pair', c:'white', c2:'mint', h:1.25 }, apple3:{ name:'Lilac brush tree', b:'brush', v:'one', c:'lilac', h:1.1 },
  berry2:{ name:'Brush-tree trio', b:'brush', v:'trio', c:'sage', c2:'lilac' }, orange2:{ name:'Evergreen pair', b:'brush', v:'pair', c:'green', c2:'pink', h:1.2 },
  apple4:{ name:'Mint brush tree', b:'brush', v:'one', c:'mint', h:1.1 }
};
const PATH_V = { path3_4:0, path3_5:2, path1_2:1, path5_2:3, path3_0:4, path2_6:0, path3_6:2 };
const PATH_NAME = ['Cobble lane', 'Stepping stones', 'Lamp-lit lane', 'Sled & presents', 'Bench & lamp'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') return { ...s, kind:'bed', crop:f.crop, name:BED_NAME[BED[f.crop]], stages:5 };
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'gp', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'gp', b:'fence', edge:f.edge, len:f.len, name:'Garland rail' };
  return { ...s, kind:'gp', ...MAP[f.id] };
});

/* ══════════ the globe: turned walnut base + brass collar, round snow mound under the tiles, the glass, drifting snow ══════════ */
function globeDims(L){ const h = L/2, rc = h*Math.SQRT2 + .06, sv = .55 + .45*L/7, yc = .13*L, R = Math.hypot(rc + .14, yc + .07), yb = -.5*sv;
  const rs = y => Math.sqrt(Math.max(0, R*R - (y - yc)*(y - yc)));
  return { h, rc, sv, yc, R, yb, rs, rN:rs(yb), top:yc + R }; }
const GLASS_U = { uNight:{ value:0 } };
const glassFront = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side:THREE.FrontSide, uniforms:GLASS_U,
  vertexShader:'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader:`uniform float uNight; varying vec3 vN;
    void main(){ vec3 n = normalize(vN); float f = 1. - clamp(n.z, 0., 1.); float fres = pow(f, 3.2);
      float spot = smoothstep(.972, .992, dot(n, normalize(vec3(-.52, .6, .6))));
      float spot2 = smoothstep(.994, .998, dot(n, normalize(vec3(.42, .5, .76))));
      float band = smoothstep(.05, .0, abs(n.x + .74 + n.y*.12)) * smoothstep(.0, .25, n.y) * smoothstep(.72, .45, n.y);
      float band2 = smoothstep(.025, .0, abs(n.x + .6 + n.y*.1)) * smoothstep(.12, .3, n.y) * smoothstep(.62, .45, n.y);
      float hi = clamp(spot + band*.85 + band2*.7 + spot2*.9, 0., 1.);
      vec3 rim = mix(vec3(.72, .84, .97), vec3(.45, .6, .9), uNight);
      vec3 col = mix(rim, vec3(1.), hi);
      float low = mix(.22, 1., smoothstep(-.55, .25, n.y));
      float a = .012 + fres*mix(.55, .5, uNight)*low + hi*mix(.75, .45, uNight);
      gl_FragColor = vec4(col, clamp(a, 0., .95)); }` });
const glassBack = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side:THREE.BackSide, uniforms:GLASS_U,
  vertexShader:'varying vec3 vN; varying float vY; void main(){ vN = normalize(normalMatrix * normal); vY = normal.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader:`uniform float uNight; varying vec3 vN; varying float vY;
    void main(){ float f = 1. - abs(normalize(vN).z); vec3 day = mix(vec3(.80, .89, .99), vec3(.93, .96, 1.), clamp(vY*.5 + .5, 0., 1.));
      vec3 col = mix(day, vec3(.22, .3, .52), uNight); float a = mix(.13, .45, uNight) + pow(f, 2.)*.14; gl_FragColor = vec4(col, a); }` });
const WOOD_TEX = (() => { const W = 512, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = rngFrom(41);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  for (let i=0;i<60;i++){ g.strokeStyle = r() < .5 ? 'rgba(60,30,10,.18)' : 'rgba(255,230,200,.14)'; g.lineWidth = 1 + r()*2.5; g.beginPath(); const y = r()*H; g.moveTo(0, y); for (let x=0;x<=W;x+=16) g.lineTo(x, y + Math.sin(x*.02 + i)*3); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); return t; })();
const WOOD = new THREE.MeshStandardMaterial({ color:0x7A4A2A, map:WOOD_TEX, roughness:.55, metalness:0 });
const WOODL = new THREE.MeshStandardMaterial({ color:0x9A6038, map:WOOD_TEX, roughness:.55, metalness:0 });
const BAND = new THREE.MeshStandardMaterial({ color:0xF6EBDD, roughness:.6 });
const BRASS = new THREE.MeshStandardMaterial({ color:0xE0B45A, roughness:.3, metalness:.35, emissive:0x3A2A08, emissiveIntensity:.25 });
const lathe = (pts, mat, n = 96) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)).reverse(), n), mat); m.castShadow = m.receiveShadow = true; return m; };
function buildGlobe(L, opt = {}){
  const D = globeDims(L), grp = new THREE.Group(), { yb, sv, rN, rs } = D;
  // snow mound under the tiles: flat top just under the tile caps, rounding down to meet the glass at the collar
  const tY = -.068, rT = rs(tY) - .05;
  grp.add(lathe([[0, tY], [rT - .25, tY], [rT - .06, tY - .02], [rs(tY - .15) - .03, tY - .15], [rN - .02, yb + .01], [0, yb + .01]], MAT.snowS, 96));
  // brass collar
  grp.add(lathe([[rN + .02, yb + .03], [rN + .09, yb], [rN + .1, yb - .1*sv], [rN + .07, yb - .13*sv], [0, yb - .13*sv]], BRASS));
  const y1 = yb - .13*sv, k = sv;
  grp.add(lathe([[rN + .04, y1], [rN - .06*k, y1 - .12*k], [rN - .02*k, y1 - .24*k], [rN + .08*k, y1 - .32*k], [0, y1 - .32*k]], WOOD));           // cove
  const y2 = y1 - .32*k;
  grp.add(lathe([[rN + .08*k, y2], [rN + .2*k, y2 - .14*k], [rN + .28*k, y2 - .3*k], [0, y2 - .3*k]], BAND));                                      // painted band
  const y3 = y2 - .3*k;
  grp.add(lathe([[rN + .27*k, y3 + .005], [rN + .36*k, y3 - .03*k], [rN + .4*k, y3 - .16*k], [rN + .36*k, y3 - .26*k], [rN + .42*k, y3 - .36*k], [rN + .44*k, y3 - .46*k], [rN + .38*k, y3 - .52*k], [0, y3 - .52*k]], WOODL));
  const yBot = y3 - .52*k;
  // holly on the painted band: leaf pairs + berries all the way round
  const hb = new Acc(), yH = y2 - .15*k, rH = rN + .2*k + .012;
  for (let i=0;i<40;i++){ const an = i/40*Math.PI*2, c = Math.cos(an), s = Math.sin(an);
    for (const d of [-1, 1]) hb.add(new THREE.SphereGeometry(.05*k, 6, 4).scale(1.6, .55, .3), MAT.green, _m.compose(new THREE.Vector3(c*rH, yH, s*rH), _q.setFromEuler(new THREE.Euler(0, -an + Math.PI/2, d*.5, 'YXZ')).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0)), _s).multiply(new THREE.Matrix4().makeTranslation(d*.06*k, 0, 0)));
    ball(hb, MAT.red, .025*k, c*(rH + .01), yH + .02*k, s*(rH + .01), 1, 6); }
  // brass plaque (blank, a little star) facing the viewer, and a wind-up key on the right-hand side
  const pa = Math.PI/4, pr = rN + .37*k, pq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, pa, 0)), pp = new THREE.Vector3(Math.sin(pa)*pr, y3 - .24*k, Math.cos(pa)*pr);
  hb.add(new THREE.BoxGeometry(.9*k, .2*k, .04), BRASS, _m.compose(pp, pq, _s));
  hb.add(new THREE.BoxGeometry(.82*k, .14*k, .045), WOOD, _m.compose(pp, pq, _s));
  const st = new THREE.Shape(); for (let i=0;i<10;i++){ const an = i/10*Math.PI*2 + Math.PI/2, rr = (i%2 ? .022 : .052)*k; i ? st.lineTo(Math.cos(an)*rr, Math.sin(an)*rr) : st.moveTo(Math.cos(an)*rr, Math.sin(an)*rr); }
  hb.add(new THREE.ExtrudeGeometry(st, { depth:.02, bevelEnabled:false }), BRASS, _m.compose(pp.clone().add(new THREE.Vector3(Math.sin(pa)*.03, 0, Math.cos(pa)*.03)), pq, _s));
  const ka = -Math.PI/4 + .15, kr = rN + .44*k, kp = new THREE.Vector3(Math.sin(ka + Math.PI/2)*kr, y3 - .3*k, Math.cos(ka + Math.PI/2)*kr), kd = kp.clone().setY(0).normalize();
  seg(hb, BRASS, kp, kd, .28*k, .035*k, .035*k, 8);
  const kq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), kd);
  for (const d of [-1, 1]) hb.add(new THREE.TorusGeometry(.1*k, .03*k, 6, 14).translate(0, d*.1*k, 0), BRASS, _m.compose(kp.clone().addScaledVector(kd, .34*k), kq, _s));
  hb.into(grp);
  if (!opt.noGlass) {
    const thMax = Math.acos(THREE.MathUtils.clamp((yb - D.yc)/D.R, -1, 1));
    const sg = new THREE.SphereGeometry(D.R, 96, 64, 0, Math.PI*2, 0, thMax).translate(0, D.yc, 0);
    const back = new THREE.Mesh(sg, glassBack); back.renderOrder = -1; grp.add(back);
    const front = new THREE.Mesh(sg, glassFront); front.renderOrder = 30; grp.add(front);
  }
  return { grp, D, yBot };
}
/* snow inside the glass: THREE.Points with a tiny shader (size in CSS px, soft round flake with a lilac edge) */
const NF = 260;
const flakeMat = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, uniforms:{ uPx:{ value:Math.min(window.devicePixelRatio || 1, 2) } },
  vertexShader:'attribute float sz; uniform float uPx; void main(){ gl_PointSize = sz * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader:'void main(){ vec2 p = gl_PointCoord - .5; float d = length(p); if (d > .5) discard; float a = smoothstep(.5, .3, d); vec3 c = mix(vec3(1.), vec3(.78,.78,.92), smoothstep(.18, .5, d)); gl_FragColor = vec4(c, a*.95); }' });
function makeSnow(D){
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(NF*3), sz = new Float32Array(NF), r = rngFrom(77), P = [];
  for (let i=0;i<NF;i++){ P.push({ a:r()*6.28, rr:Math.sqrt(r()), y:r(), sp:.5 + r(), ph:r()*6.28 }); sz[i] = 2.6 + r()*3.4; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const pts = new THREE.Points(geo, flakeMat); pts.frustumCulled = false; pts.renderOrder = 20; pts.userData.P = P; pts.userData.D = D; return pts;
}
function moveSnow(t){
  const pts = V && V.snow; if (!pts) return; const { P, D } = pts.userData, arr = pts.geometry.attributes.position.array;
  const sw = V.swirl || 0, g0 = TILE_TOP + .12, top = D.yc + D.R*.86, H = top - g0;
  for (let i=0;i<NF;i++){ const p = P[i];
    const yf = ((p.y - t*.035*p.sp) % 1 + 1) % 1, y1 = g0 + yf*H, a1 = p.a + Math.sin(t*.4 + p.ph)*.12;             // gentle fall
    const a2 = p.a + t*(.9 + p.sp*.6)*(1.25 - p.rr*.6), y2 = g0 + H*(.12 + .8*(((p.y + .08*Math.sin(t*1.1 + p.ph)) % 1 + 1) % 1));   // swirl
    const y = y1 + (y2 - y1)*sw, a = a1 + (a2 - a1)*sw, rm = Math.sqrt(Math.max(0, D.R*D.R - (y - D.yc)*(y - D.yc)))*.9, rr = p.rr*rm;
    arr[i*3] = Math.cos(a)*rr; arr[i*3 + 1] = y; arr[i*3 + 2] = Math.sin(a)*rr; }
  pts.geometry.attributes.position.needsUpdate = true;
  pts.geometry.setDrawRange(0, Math.round(80 + (NF - 80)*Math.min(1, sw*1.4)));
}
function buildEnv(){
  const L = V.L, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  V.soil.visible = false;                                                  // the globe's snow mound + base replace the soil block
  const gl = buildGlobe(L), D = gl.D; env.add(gl.grp); V.globe = D;
  world.children.forEach(o => { if (o.userData.ground === 'catcher') o.position.y = gl.yBot; });
  V.blob.position.set(.15, gl.yBot - .005, -.1); V.blob.material.opacity = S.night ? .45 : .3;
  GLASS_U.uNight.value = S.night ? 1 : 0;
  const snow = makeSnow(D); env.add(snow); V.snow = snow; V.life.push(snow); if (V.swirl == null) V.swirl = 0; moveSnow(2.1);
  // frame: the glass circle (it is a sphere: its outline is a circle of radius R around the centre) + the base's foot
  const d = new THREE.Vector3(1, 1.2, 1).normalize(), right = new THREE.Vector3().crossVectors(_up, d).normalize(), up = new THREE.Vector3().crossVectors(d, right).normalize();
  const C = new THREE.Vector3(0, D.yc, 0);
  for (const v of [right, up]) for (const k of [-1, 1]) V.framePts.push(C.clone().addScaledVector(v, k*D.R*1.01));
  const rB = D.rN + .44*D.sv; for (let i=0;i<16;i++){ const an = i/16*Math.PI*2; V.framePts.push(new THREE.Vector3(Math.cos(an)*rB, gl.yBot, Math.sin(an)*rB)); }
}

/* decor: snow drifts, tiny brush saplings and candy stakes on empty cells; a couple of drifts on waiting cells */
function globeDecor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, p = cellPos(x,z), a = new Acc();
    const grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    if (!sl || sl === 'later') { snowLumps(a, r, 3, .38, p.x, p.z, p.y + .01, .07);
      if (AMBIENT()) { const k = r(); if (k < .45) brushTree(a, r, p.x + (r()-.5)*.4, p.z + (r()-.5)*.4, .32 + r()*.16, ['mint','pink','white','green','lilac'][Math.floor(r()*5)], { star:false });
        else if (k < .7) { const sx = p.x + (r()-.5)*.4, sz = p.z + (r()-.5)*.4; for (let i=0;i<4;i++) cyl(a, i%2 ? MAT.white : MAT.candyR, .012, .012, .05, sx, p.y + i*.05, sz, 6); }
        else { const sx = p.x + (r()-.5)*.4, sz = p.z + (r()-.5)*.4, s = .07 + r()*.03; box(a, [MAT.candyB, MAT.candyP, MAT.candyY][Math.floor(r()*3)], s, s, s, sx, p.y, sz, r()); box(a, MAT.gold, s + .005, s + .005, .015, sx, p.y, sz, 0); } }
      grp.userData.decor = 'meadow'; }
    else if (!placed.includes(sl.id) && AMBIENT()) { snowLumps(a, r, 2, .36, p.x, p.z, p.y + .01, .06); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    a.m.size && a.into(grp);
  }
}

/* ══════════ residents: the globe gets a shake (the snow swirls), then skaters glide on the ponds and penguins waddle in ══════════ */
function makeSkater(i){
  const g = new THREE.Group(), a = new Acc(), coat = [MAT.candyR, MAT.candyB, MAT.roofG][i%3], hat = [MAT.butter, MAT.pink, MAT.white][i%3], sc = [MAT.white, MAT.butter, MAT.candyR][i%3];
  for (const sx of [-1, 1]) { seg(a, MAT.coal, new THREE.Vector3(sx*.03, .03, 0), _up, .13, .016, .016, 5); box(a, MAT.white, .035, .03, .08, sx*.03, .015, .01); box(a, MAT.iron, .006, .015, .1, sx*.03, 0, .01); }
  a.add(new THREE.ConeGeometry(.085, .18, 10).translate(0, .24, 0), coat); ball(a, MAT.skin, .06, 0, .38, 0, 1, 10);
  for (const sx of [-1, 1]) { ball(a, MAT.coal, .008, sx*.022, .39, .053, 1, 5); ball(a, MAT.cheek, .012, sx*.035, .37, .045, .6, 5);
    seg(a, coat, new THREE.Vector3(sx*.06, .29, 0), new THREE.Vector3(sx, -.3, .2), .11, .018, .015, 5); ball(a, sc, .02, sx*.155, .26, .03, 1, 5); }
  a.add(new THREE.TorusGeometry(.045, .016, 5, 12).rotateX(Math.PI/2).translate(0, .33, 0), sc); box(a, sc, .03, .07, .012, .025, .25, .05);
  a.add(new THREE.SphereGeometry(.063, 10, 6, 0, Math.PI*2, 0, Math.PI*.55).translate(0, .39, 0), hat); ball(a, MAT.white, .022, 0, .46, 0, 1, 6);
  a.into(g); return g;
}
function makePenguin(i){
  const g = new THREE.Group(), a = new Acc(), sc = [MAT.candyR, MAT.candyG, MAT.candyB][i%3];
  ball(a, MAT.pengB, .1, 0, .12, 0, 1.25, 12); a.add(new THREE.SphereGeometry(.082, 12, 8).scale(.9, 1.2, .6).translate(0, .11, .045), MAT.pengW);
  ball(a, MAT.pengB, .07, 0, .27, 0, 1, 12); for (const sx of [-1, 1]) { ball(a, MAT.pengW, .022, sx*.025, .285, .055, 1, 6); ball(a, MAT.coal, .01, sx*.025, .287, .073, 1, 5);
    a.add(new THREE.SphereGeometry(.035, 8, 5).scale(.35, 1.1, .8).translate(sx*.1, .12, 0), MAT.pengB); box(a, MAT.beak, .04, .012, .05, sx*.035, 0, .04); }
  a.add(new THREE.ConeGeometry(.018, .045, 6).rotateX(Math.PI/2).translate(0, .27, .085), MAT.beak);
  a.add(new THREE.TorusGeometry(.055, .018, 5, 12).rotateX(Math.PI/2).translate(0, .21, 0), sc); box(a, sc, .03, .07, .012, .03, .13, .08);
  a.into(g); return g;
}
const RES_SCALE = 1.35;
function freeCells(){ const occ = new Set(); SLOTS.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.add((sl.x+a)+','+(sl.z+b)); });
  const out = []; for (let z=1; z<GRID; z++) for (let x=1; x<GRID; x++) if (!occ.has(x+','+z)) out.push([x, z]); return out; }
function moveResidents(t){
  (V && V.movers || []).forEach(m => { const u = m.userData;
    if (u.kind === 'skater') { const an = t*u.sp + u.ph, P = cellPos(u.c[0], u.c[1]); m.position.set(P.x + Math.cos(an)*u.r, TILE_TOP + .035, P.z + Math.sin(an)*u.r*.85);
      m.rotation.set(0, -an + (u.sp > 0 ? 0 : Math.PI), (u.sp > 0 ? -1 : 1)*.18); }
    else { const w = Math.sin(t*6 + u.ph); m.rotation.set(0, u.face + w*.12, w*.1); m.position.y = TILE_TOP + Math.abs(Math.sin(t*6 + u.ph))*.025; }
  });
}
function residentGroups(){
  const cells = freeCells();
  return [
    walk => { V.residentsIn = true;
      if (!walk) { V.swirl = 1; return []; }
      return new Promise(res => tween(S.rm ? 1 : 1700, t => { const k = (1 - t)*(1 - t);
        world.rotation.z = Math.sin(t*Math.PI*7)*.045*k; world.rotation.x = Math.sin(t*Math.PI*5 + 1)*.025*k; world.position.x = Math.sin(t*Math.PI*7 + .6)*.12*k;
        V.swirl = Math.min(1, t*2.2); }, () => { world.rotation.set(0, 0, 0); world.position.set(0, 0, 0); V.swirl = 1; res([]); })); },
    () => [[6, 2, 1, .9, 0], [6, 2, -1, .7, 2.6], [1, 1, 1, .8, 1.2]].map(([cx, cz, dir, sp, ph], i) => { const m = makeSkater(i); m.scale.setScalar(RES_SCALE);
      m.userData = { kind:'skater', c:[cx, cz], r:.24 - i*.02, sp:dir*sp, ph }; return m; }),
    () => { const pc = cells.filter(([x, z]) => ringOf(x, z) >= 2).slice(0, 3); return pc.map(([x, z], i) => { const m = makePenguin(i); m.scale.setScalar(RES_SCALE*(i === 2 ? .7 : 1));
      const P = cellPos(x, z); m.position.set(P.x + (i%2 ? .15 : -.1), TILE_TOP, P.z + .05); m.userData = { kind:'penguin', face:.8 + i*.4, ph:i*1.3, small:i === 2 }; return m; }); }
  ];
}
async function globeMoveIn(walk){
  const groups = residentGroups(); V.movers = V.movers || []; V.residentsIn = true;
  for (let i=0;i<groups.length;i++){
    const rs = (await groups[i](walk)) || [];
    rs.forEach(m => { world.add(m); V.movers.push(m); V.life.push(m); if (walk) { m.userData.arrive = 0; m.scale.setScalar(.001); } });
    moveResidents(2.1);
    if (i === 0) moveSnow(2.1);
    if (walk && rs.length) await new Promise(res => tween(S.rm ? 1 : 900, t => { rs.forEach((m, j) => { const k = Math.min(1, Math.max(0, t*1.3 - j*.12)); m.userData.arrive = k; m.scale.setScalar(RES_SCALE*(m.userData.small ? .7 : 1)*Math.max(.001, k)); }); },
      () => { rs.forEach(m => { m.userData.arrive = 1; m.scale.setScalar(RES_SCALE*(m.userData.small ? .7 : 1)); }); sparkle(rs[0].position.clone().setY(TILE_TOP + .5), 10, 0xE9F4FF, .6); res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    if (walk) await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = groups.length;
}
/* a pocket snow globe for the Residents chip / sprite rig */
function miniGlobe(){
  const g = new THREE.Group(), a = new Acc(), r = rngFrom(5);
  a.add(new THREE.CylinderGeometry(.62, .7, .3, 28).translate(0, .15, 0), MAT.wood); a.add(new THREE.CylinderGeometry(.56, .6, .06, 28).translate(0, .33, 0), MAT.gold);
  a.add(new THREE.SphereGeometry(.5, 20, 10, 0, Math.PI*2, Math.PI*.55, Math.PI*.45).translate(0, .66, 0), MAT.snowS);
  brushTree(a, r, -.12, 0, .45, 'green'); brushTree(a, r, .16, .1, .3, 'pink', { star:false }); snowman(a, r, 5, .1, -.18, .7);
  a.into(g);
  const gl = new THREE.Mesh(new THREE.SphereGeometry(.56, 28, 18, 0, Math.PI*2, 0, Math.PI*.8), new THREE.MeshStandardMaterial({ color:0xDDEEFF, transparent:true, opacity:.28, roughness:.1, depthWrite:false }));
  gl.position.y = .78; g.add(gl);
  const fl = new Acc(); for (let i=0;i<14;i++){ const an = r()*6.28, rr = r()*.4; ball(fl, MAT.white, .025, Math.cos(an)*rr, .7 + r()*.4, Math.sin(an)*rr, 1, 5); } fl.into(g);
  return g;
}

export default {
  id:'globe', name:'Snow globe', title:'Your globe',
  season:22, dates:'20 Jul–2 Aug', nextIn:14,
  kits:['a'],                                   // shared kit only for the engine defaults; every globe piece is procedural
  families:{
    water:   { label:'frozen ponds & fountains', tag:'Ice' },
    building:{ label:'shops & the carousel',     tag:'Building' },
    path:    { label:'lanes, lamps & garlands',  tag:'Path' },
    crop:    { label:'snowmen & gingerbread',    tag:'Snow' },
    tree:    { label:'bottle-brush trees',       tag:'Tree' },
    special: { label:'the little chapel',        tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:{ top:['#FFFDFB', '#F4EEF3'], side:'#E6DEE8', soilTop:'#F2ECF1', soilBot:'#D9CFDC' }, tileMap:snowTileMap },
  ghost:{ color:'#6E6390', opacity:.36, emissive:.05, dash:'#7F74A0', dashOpacity:.7, night:{ opacity:.3, emissive:.2, dashOpacity:.5 } },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><circle cx="12" cy="10" r="8" fill="#DCEBFA" stroke="#9FB7D8" stroke-width="1.2"/><path d="M7.5 14.5 10 9l2 3 1.5-2 3 4.5z" fill="#4F9B74"/><circle cx="9" cy="6.5" r=".9" fill="#fff"/><circle cx="14.5" cy="5.5" r=".8" fill="#fff"/><path d="M5 17.5h14l1.2 4.5H3.8z" fill="#8A5433"/><rect x="5.4" y="16.4" width="13.2" height="1.6" rx=".6" fill="#E0B45A"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M64 10a46 46 0 0 1 36 74.6H28A46 46 0 0 1 64 10z" opacity=".55"/><path d="M40 78l12-26 8 12 8-18 16 32z"/><rect x="60" y="30" width="8" height="10" rx="1"/><path d="M26 86h76l10 30H16z"/><rect x="24" y="82" width="80" height="8" rx="3"/></g>',
  album:{ image:'assets/globe/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#EEE8F4)' },
  css:'.phone[data-theme="globe"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#F1EDF7 58%,#DED6EC 100%)}',

  build(g, s, opt){
    if (s.kind === 'bed') {
      const slab = new THREE.Mesh(G.field, MAT.snowBed); slab.position.y = .035; slab.castShadow = slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab);
      const host = new THREE.Group(); host.scale.setScalar(1.2); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillBed(host, s, st);
      fillBed(host, s, opt.stage ?? cropStage(s.id));
    } else B[s.b](g, s, opt);
  },
  scaleOf: s => s.kind === 'bed' ? 1.2 : 1,
  contact: s => s.kind === 'gp' && !['path', 'fence', 'pond'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && (s.v === 2 || s.v === 4)) || s.b === 'pond' || s.b === 'fence',
  decor: globeDecor,
  env: buildEnv,
  tick(t){ moveSnow(t); moveResidents(t); GLASS_U.uNight.value = S.night ? 1 : 0; },
  onImpact(pos, big){
    for (let i=0;i<(big ? 16 : 10);i++){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFFFFF, transparent:true, opacity:.95, depthWrite:false })); sp.renderOrder = 10;
      const a = i/(big ? 16 : 10)*6.28, d = (big ? .5 : .3) + Math.random()*.3, rise = .3 + Math.random()*.4; fx.add(sp);
      tween(1000 + Math.random()*400, t => { const e = 1 - Math.pow(1 - t, 2); sp.position.set(pos.x + Math.cos(a)*d*e, pos.y + .05 + Math.sin(t*Math.PI)*rise, pos.z + Math.sin(a)*d*e);
        sp.scale.setScalar(.12*(1 - t*.5)); sp.material.opacity = .95*(1 - t*t); }, () => { fx.remove(sp); sp.material.dispose(); }); } },

  residents:[ { id:'swirl', name:'Snow swirl' }, { id:'skaters', name:'Skaters' }, { id:'penguins', name:'Penguins' } ],
  moveIn: globeMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('globe:'+d.id, () => { if (d.id === 'swirl') return miniGlobe();
      const g = d.id === 'skaters' ? makeSkater(0) : makePenguin(0); g.rotation.y = .5; return g; }, 168); },
  residentRig(d){
    const o = d.id === 'swirl' ? miniGlobe() : d.id === 'skaters' ? makeSkater(0) : makePenguin(0); if (d.id !== 'swirl') o.scale.setScalar(RES_SCALE);
    return { obj:o, mixer:new THREE.AnimationMixer(o), clip:null, facing:0 }; }
};

/* snow tiles: warm white with lilac hollows and a little sparkle (winter's are cool blue-grey; this is a figurine-shop white) */
function snowTileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(63);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  for (let i=0;i<12;i++){ const x = r()*N, y = r()*N, rad = 24 + r()*50, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, r() < .5 ? 'rgba(190,170,215,.14)' : 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); }
  for (let i=0;i<60;i++){ g.fillStyle = r() < .6 ? 'rgba(255,255,255,.95)' : 'rgba(170,160,210,.25)'; g.beginPath(); g.arc(r()*N, r()*N, .8 + r()*1.4, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
