/* DESERT OASIS (?theme=oasis) — a warm Rajasthan / Arabian-nights oasis on the farm's 7×7 ring blueprint (same cells, same ring
   counts 6 / 15 / 19, same order) except the hero: the sunset chhatri takes the LEFT corner (cells 0..1 × 5..6) so nothing
   stands in front of it, and the two farm slots it displaces move to the old peepal corner (as diwali does).
   Golden dune-rippled sand, terracotta and sandstone, a turquoise oasis pool. No CC0 kit has this architecture, so the houses,
   haveli, domed pavilion, caravanserai, tents, bazaar, wells, fountain, pools, reeds, acacias, cacti, agave, rugs, pots,
   lanterns, mud walls, the charbagh gardens, the date-palm nursery, the camels, flamingos and the hawk are procedural three.js
   geometry merged per material (Acc), so every piece stays pre-renderable. Reused CC0 kit pieces (no new asset files):
   date palms = Quaternius Ultimate Stylized Nature "Palm Trees" (assets/dino/palms.glb, leaves sway in the breeze), rocks +
   dry grass = Quaternius Stylized Nature MegaKit (kit a), the fennec fox = Quaternius animated Fox recoloured sandy. */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { rngFrom, TEX, addSway, world } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, ANIMCACHE, addModel, fitScale, loadAnimal, modelBox } from '../engine/kit.js';
import { G, Acc, seg, blob, _up } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { FARM, FARM_ORDER } from './farm.js';

/* ── materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.86, metalness:0, flatShading:true, ...o });
function stripeTex(a, b, n=8, vertical=true){
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  for (let i=0;i<n;i++){ g.fillStyle = i%2 ? b : a; vertical ? g.fillRect(i*64/n, 0, 64/n + 1, 64) : g.fillRect(0, i*64/n, 64, 64/n + 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function rugTex(base, border, motif){
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.fillStyle = border; g.fillRect(0,0,N,N); g.fillStyle = base; g.fillRect(7,7,N-14,N-14);
  g.strokeStyle = motif; g.lineWidth = 2; g.strokeRect(11,11,N-22,N-22);
  g.fillStyle = motif; g.beginPath(); g.moveTo(N/2, 18); g.lineTo(N-18, N/2); g.lineTo(N/2, N-18); g.lineTo(18, N/2); g.closePath(); g.fill();
  g.fillStyle = border; g.beginPath(); g.arc(N/2, N/2, 5, 0, 6.3); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const MAT = {
  sand:FM(0xE9C07E, { roughness:1 }), sandL:FM(0xF2D49A, { roughness:1 }), wetSand:FM(0xCF9E62, { roughness:1 }),
  stone:FM(0xE6B77F), stoneD:FM(0xC99260), stoneL:FM(0xF3D6A8), plaster:FM(0xFAF0DC), plasterD:FM(0xE9D8B8),
  terra:FM(0xD0714A), terraD:FM(0xA8522F), blue:FM(0x5B8FD0), blueD:FM(0x3D6DB0), turq:FM(0x3FBFBB), turqD:FM(0x238F92),
  dark:FM(0x5A3A2A), wood:FM(0x8A5530), woodD:FM(0x5E3820), rope:FM(0xD9BE8A), cloth:FM(0xE9E0CC, { side:THREE.DoubleSide }),
  brass:FM(0xE3B34A, { roughness:.4, metalness:.3 }), gold:FM(0xF1C24E, { emissive:0x6A4A00, emissiveIntensity:.25, roughness:.4, metalness:.3 }),
  red:FM(0xC8383A), indigo:FM(0x3E4F9E), saffron:FM(0xF2A23A), maroon:FM(0x8E2B3A), cream:FM(0xF6EAD2), black:FM(0x2A2320),
  water:new THREE.MeshStandardMaterial({ color:0x3ED3D2, roughness:.15, metalness:0, emissive:0x0B6670, emissiveIntensity:.35 }),
  jet:new THREE.MeshStandardMaterial({ color:0xBFF6F4, roughness:.2, transparent:true, opacity:.7, emissive:0x3ED3D2, emissiveIntensity:.3, depthWrite:false }),
  glass:FM(0xFFD27A, { emissive:0xFF9A2E, emissiveIntensity:1.3 }), flame:FM(0xFFC857, { emissive:0xFF8A1F, emissiveIntensity:1.7 }),
  cactus:FM(0x6E9E5A), cactusD:FM(0x557F45), agave:FM(0x86AE98), agaveD:FM(0x6A9480), trunk:FM(0x8C6A4A), trunkD:FM(0x6E5038),
  soil:FM(0x9A6038, { roughness:1, map:TEX.furrow }), sprout:FM(0x7DBA4E), shrub:FM(0x5E9C48), shrubD:FM(0x46803A), cypress:FM(0x3E7A48),
  rose:FM(0xE8546E), roseP:FM(0xF49AB4), marigold:FM(0xF7A21E), jasmine:FM(0xFFF6E6), date:FM(0xB5561F), dateD:FM(0x8A3A16),
  cattail:FM(0x7A4A2A),
  // residents
  camel:FM(0xD2A36A), camelD:FM(0xB0824C), camelL:FM(0xE8C79A), flamingo:FM(0xF7A0B4), flamingoD:FM(0xE56F8E), bill:FM(0x2E2A2A),
  hawk:FM(0x8B6444), hawkL:FM(0xE9D8BC), eye:FM(0x1E1A18), leg:FM(0xE88AA0)
};
const TENT_R = new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.9, map:stripeTex('#C8383A', '#F6EAD2', 8) });
const TENT_B = new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.9, map:stripeTex('#3E4F9E', '#F6EAD2', 8) });
const TENT_S = new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.9, map:stripeTex('#E08A2E', '#FBEBD0', 8), side:THREE.DoubleSide });
const CANOPY = new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.9, map:stripeTex('#C8383A', '#F6EAD2', 6), side:THREE.DoubleSide });
const RUGS = [rugTex('#B8323A', '#2F3E86', '#F2C24E'), rugTex('#2F3E86', '#C8383A', '#F6EAD2'), rugTex('#D9772E', '#7A2A30', '#F6EAD2')]
  .map(t => new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.95, map:t }));
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = FM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }

const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=12){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z)); }
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }

/* arches: a semicircular-topped opening facing +z; placed on a wall face ('z' = +z face, 'x' = +x face) */
function archGeo(w, h, depth=.02){
  const s = new THREE.Shape(), r = w/2; s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled:false, curveSegments:8 });
}
const onFace = (face, halfD, u, y, off=0) => face === 'z' ? at(u, y, halfD + off) : at(halfD + off, y, -u, Math.PI/2);
function arch(acc, face, halfD, u, y0, w, h, frame, fill=MAT.dark){
  acc.add(archGeo(w + .045, h + .03, .012), frame, onFace(face, halfD, u, y0, 0));
  acc.add(archGeo(w, h, .016), fill, onFace(face, halfD, u, y0, .003));
}
/* jharokha: a projecting arched balcony window with a little domed canopy */
function jharokha(acc, face, halfD, u, y0, s=1, mat=MAT.stoneL, trim=MAT.terra){
  const box = (w, h, d, y, off) => acc.add(bx(w*s, h*s, d*s), mat, onFace(face, halfD, u, y0 + y*s, off*s));
  box(.2, .025, .09, 0, .045);                             // bracket shelf
  acc.add(new THREE.ConeGeometry(.05*s, .07*s, 4).rotateX(Math.PI).rotateY(Math.PI/4), trim, onFace(face, halfD, u, y0 - .035*s, .03*s));
  box(.17, .15, .07, .09, .04);                            // window box
  acc.add(archGeo(.1*s, .12*s, .012), MAT.dark, onFace(face, halfD, u, y0 + .025*s, .075*s));
  box(.23, .022, .11, .175, .05);                          // chhajja
  acc.add(new THREE.SphereGeometry(.07*s, 10, 6, 0, Math.PI*2, 0, Math.PI/2), trim, onFace(face, halfD, u, y0 + .186*s, .045*s));
}
/* onion dome (lathe) with a brass finial */
const ONION = (() => { const p = [[0,0],[1,0],[1.1,.33],[1.02,.66],[.76,.98],[.4,1.26],[.14,1.44],[0,1.55]].map(([x,y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(p, 14); })();
function onion(acc, mat, r, x, y, z, finial=MAT.brass){
  acc.add(ONION, mat, at(x, y, z, 0, r, r, r));
  acc.add(new THREE.SphereGeometry(.028*r/.2, 8, 6), finial, at(x, y + r*1.55 + .01, z));
  acc.add(new THREE.ConeGeometry(.012*r/.2, .07*r/.2, 6), finial, at(x, y + r*1.55 + .05*r/.2, z));
}
function halfDome(acc, mat, r, x, y, z){ acc.add(new THREE.SphereGeometry(r, 12, 7, 0, Math.PI*2, 0, Math.PI/2), mat, at(x, y, z)); }
/* a small open chhatri: 4 posts, a cap, a dome */
function chhatri(acc, x, y, z, s=1, dome=MAT.plaster){
  for (const [a, b] of [[-1,-1],[1,-1],[1,1],[-1,1]]) slab(acc, MAT.stoneL, .025*s, .12*s, .025*s, x + a*.055*s, y, z + b*.055*s);
  slab(acc, MAT.stone, .16*s, .025*s, .16*s, x, y + .12*s, z); onion(acc, dome, .07*s, x, y + .145*s, z);
}
/* parapet with rounded merlons along a roof edge (w × d roof at height y) */
function parapet(acc, w, d, y, mat, n=4){
  slab(acc, mat, w, .05, .03, 0, y, d/2 - .015); slab(acc, mat, w, .05, .03, 0, y, -d/2 + .015);
  slab(acc, mat, .03, .05, d, w/2 - .015, y, 0); slab(acc, mat, .03, .05, d, -w/2 + .015, y, 0);
  for (let i=0;i<n;i++){ const u = -w/2 + (i + .5)*w/n;
    acc.add(new THREE.SphereGeometry(.022, 7, 4, 0, Math.PI*2, 0, Math.PI/2), mat, at(u, y + .05, d/2 - .015));
    acc.add(new THREE.SphereGeometry(.022, 7, 4, 0, Math.PI*2, 0, Math.PI/2), mat, at(w/2 - .015, y + .05, -d/2 + (i + .5)*d/n)); }
}
/* clay pot (lathe), cached */
const POT = (() => { const p = [[0,0],[.55,0],[.9,.25],[1,.5],[.8,.8],[.45,.92],[.5,1]].map(([x,y]) => new THREE.Vector2(x, y)); return new THREE.LatheGeometry(p, 10); })();
function pot(acc, x, y, z, s=.06, mat=MAT.terra, tilt=0){ acc.add(POT, mat, at(x, y, z, 0, s, s*1.25, s, tilt)); }
/* hanging / standing lantern: brass cap, glowing glass, glow sprite (sprites vanish in ghosts) */
function lantern(acc, g, x, y, z, s=1){
  acc.add(new THREE.CylinderGeometry(.028*s, .022*s, .06*s, 6), MAT.glass, at(x, y, z));
  acc.add(new THREE.ConeGeometry(.036*s, .035*s, 6), MAT.brass, at(x, y + .045*s, z));
  acc.add(new THREE.CylinderGeometry(.03*s, .02*s, .012*s, 6), MAT.brass, at(x, y - .036*s, z));
  glowSprite(g, new THREE.Vector3(x, y, z), .3*s, 0xFFB050, .6);
}
function rug(acc, w, d, x, z, ry=0, v=0, y=0){ acc.add(bx(w, .012, d), RUGS[v % RUGS.length], at(x, y + .006, z, ry)); }
function leafGeo(len, w, arch){ const g = new THREE.PlaneGeometry(w, len, 1, 5).translate(0, len/2, 0), p = g.attributes.position;
  for (let i=0;i<p.count;i++){ const y = p.getY(i), t = y/len, ww = Math.sin(Math.PI*Math.min(1, t*1.05 + .05));
    p.setXYZ(i, p.getX(i)*ww, y*(1 - arch*t*.5), arch*t*t*len*.9); } g.computeVertexNormals(); return g; }
/* kit model helper: fit to h tall / w wide */
function km(g, kit, name, h, w, x=0, y=0, z=0, rot=0){ const tpl = KITCACHE[kit] && KITCACHE[kit][name]; if (!tpl) return null;
  const k = fitScale(tpl, h, w), o = addModel(g, name, k, x, y, z, rot, kit); if (o) o.userData.top = y + tpl.size.y*k; return o; }

/* ── desert plants ── */
function agave(acc, x, z, s=1, y=0){
  for (let i=0;i<11;i++){ const a = i/11*6.28 + (i%2)*.3, tilt = i < 5 ? .5 : 1.0, L = (.13 - (i<5 ? 0 : .03))*s;
    const d = new THREE.Vector3(Math.cos(a)*Math.sin(tilt), Math.cos(tilt), Math.sin(a)*Math.sin(tilt));
    seg(acc, i%2 ? MAT.agave : MAT.agaveD, new THREE.Vector3(x, y, z), d, L, .018*s, .002, 4); }
}
function saguaro(acc, x, z, h, rng, flowers=false){
  const r = .05 + h*.03, p = new THREE.Vector3(x, 0, z);
  acc.add(new THREE.CapsuleGeometry(r, h - 2*r, 3, 9), MAT.cactus, at(x, h/2, z));
  const arms = h > .45 ? 2 : 1;
  for (let i=0;i<arms;i++){ const sx = i ? -1 : 1, ay = h*(.38 + i*.14 + rng()*.06), ax = .1 + r, ah = h*(.28 + rng()*.1), rot = rng()*.6 - .3;
    const c = Math.cos(rot), s = Math.sin(rot);
    acc.add(new THREE.CapsuleGeometry(r*.72, ax - r, 3, 8).rotateZ(Math.PI/2), MAT.cactus, at(x + sx*ax/2*c, ay, z - sx*ax/2*s, rot));
    acc.add(new THREE.CapsuleGeometry(r*.72, ah, 3, 8), MAT.cactus, at(x + sx*ax*c, ay + ah/2, z - sx*ax*s));
    if (flowers) blob(acc, MAT.roseP, new THREE.Vector3(x + sx*ax*c, ay + ah + r*.8, z - sx*ax*s), .022, .7); }
  if (flowers) for (let i=0;i<3;i++){ const a = i*2.1; blob(acc, i%2 ? MAT.jasmine : MAT.roseP, new THREE.Vector3(x + Math.cos(a)*r*.6, h - r*.2, z + Math.sin(a)*r*.6), .022, .7); }
  void p;
}
function barrel(acc, x, z, s=1){ acc.add(new THREE.SphereGeometry(.07*s, 10, 7), MAT.cactusD, at(x, .06*s, z, 0, 1, 1.1, 1)); blob(acc, MAT.saffron, new THREE.Vector3(x, .14*s, z), .02*s, .6); }
function acacia(g, acc, rng, h=1, x=0, z=0){
  const base = new THREE.Vector3(x, 0, z), lean = new THREE.Vector3(.12, 1, -.05).normalize();
  seg(acc, MAT.trunk, base, lean, .42*h, .05*h, .035*h, 7);
  const fork = base.clone().addScaledVector(lean, .42*h), canopy = swayMat(0x86A845, 1.1*h, .02), canopyD = swayMat(0x6C8E36, 1.1*h, .02);
  const branches = [[.9, -.4, .36], [-.8, .5, .3], [.2, .9, .28]];
  branches.forEach(([dx, dz, L], i) => { const d = new THREE.Vector3(dx, 1.1, dz).normalize(); seg(acc, MAT.trunkD, fork, d, L*h, .03*h, .018*h, 6);
    const tip = fork.clone().addScaledVector(d, L*h);
    const geo = new THREE.IcosahedronGeometry(.22*h*(1 - i*.12), 1); const a = geo.attributes.position;
    for (let k=0;k<a.count;k++){ const f = 1 + (rng()-.5)*.25; a.setXYZ(k, a.getX(k)*f, a.getY(k)*f, a.getZ(k)*f); }
    acc.add(geo, i%2 ? canopyD : canopy, at(tip.x, tip.y + .03*h, tip.z, rng()*6, 1.25, .34, 1.25)); });
  void g;
}
function reeds(acc, x, z, n, rng, h=.28){
  const m = swayMat(0x86A845, h, .06), m2 = swayMat(0x6C9A3A, h, .06);
  for (let i=0;i<n;i++){ const px = x + (rng()-.5)*.1, pz = z + (rng()-.5)*.1, L = h*(.6 + rng()*.5), d = new THREE.Vector3((rng()-.5)*.35, 1, (rng()-.5)*.35).normalize();
    acc.add(new THREE.ConeGeometry(.011, L, 4).translate(0, L/2, 0), i%2 ? m : m2, _M2.compose(_V.set(px, 0, pz), _Q2.setFromUnitVectors(_up, d), new THREE.Vector3(1,1,1)));
    if (i%3 === 0) { const tp = new THREE.Vector3(px, 0, pz).addScaledVector(d, L*.8); acc.add(new THREE.CapsuleGeometry(.012, .045, 2, 5), MAT.cattail, at(tp.x, tp.y, tp.z)); } }
}
/* organic pool: turquoise water with a wet-sand bank, a few rocks */
function pool(acc, g, rng, rx, rz, x=0, z=0, rocks=6){
  acc.add(new THREE.CylinderGeometry(1, 1.06, .04, 28), MAT.wetSand, at(x, .0, z, 0, rx + .07, 1, rz + .07));
  acc.add(new THREE.CylinderGeometry(1, 1, .02, 28), MAT.water, at(x, .035, z, 0, rx, 1, rz));
  for (let i=0;i<rocks;i++){ const a = rng()*6.28; const rk = ['Rock_Medium_1','Rock_Medium_2','Rock_Medium_3'][i%3];
    km(g, 'a', rk, .06 + rng()*.05, .12 + rng()*.06, x + Math.cos(a)*(rx + .04), .0, z + Math.sin(a)*(rz + .04), rng()*6); }
}

/* ── growing pieces (Sudoku / Math) ── */
/* charbagh: a four-quadrant garden split by water channels, a tiny fountain in the middle; the beds grow in 5 stages */
function fillCharbagh(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 3);
  slab(a, MAT.turq, .78, .012, .07, 0, .07, 0); slab(a, MAT.turq, .07, .012, .78, 0, .07, 0);
  cyl(a, MAT.stoneL, .09, .08, .04, 0, .07, 0, 8); cyl(a, MAT.water, .06, .06, .012, 0, .1, 0, 8);
  if (stage >= 3) { cyl(a, MAT.stoneL, .016, .016, .06, 0, .1, 0, 6); cyl(a, MAT.stoneL, .035, .02, .015, 0, .16, 0, 8); }
  if (stage >= 5) a.add(new THREE.ConeGeometry(.02, .08, 6), MAT.jet, at(0, .21, 0));
  for (const [qx, qz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
    const cx = qx*.21, cz = qz*.21;
    for (let i=0;i<4;i++){ const px = cx + ((i%2) - .5)*.17 + (r()-.5)*.02, pz = cz + (Math.floor(i/2) - .5)*.17 + (r()-.5)*.02, y = .07;
      if (stage === 1) { for (let k=0;k<3;k++) seg(a, MAT.sprout, new THREE.Vector3(px + (k-1)*.012, y, pz), new THREE.Vector3((k-1)*.4, 1, 0), .035, .006, .002, 3); }
      else { const rr = [0, 0, .035, .05, .058, .062][stage]; blob(a, i%2 ? MAT.shrub : MAT.shrubD, new THREE.Vector3(px, y + rr*.8, pz), rr, .9, 0, r);
        if (stage >= 4) { const fl = stage === 4 ? [MAT.sprout] : [MAT.rose, MAT.roseP, MAT.marigold, MAT.jasmine];
          for (let k=0;k<(stage === 4 ? 3 : 5);k++){ const aa = r()*6.28, rad = rr*.75;
            blob(a, fl[(k + i) % fl.length], new THREE.Vector3(px + Math.cos(aa)*rad, y + rr*1.2 + r()*.02, pz + Math.sin(aa)*rad), stage === 4 ? .011 : .018, 1); } } } }
    if (stage >= 3) { const ch = .08 + stage*.05; a.add(new THREE.ConeGeometry(.035, ch, 7), MAT.cypress, at(qx*.4, .07 + ch/2, qz*.4)); }
  }
  a.into(host); host.userData.stage = stage;
}
/* date nursery: four young date palms in a furrowed bed with a channel; fronds + trunk grow, dates hang at stage 5 */
function miniPalm(acc, p, st, rng){
  const h = .03 + st*.075, lm = swayMat(0x6FA646, .5, .05), lm2 = swayMat(0x8CBF58, .5, .05);
  seg(acc, MAT.trunk, p, _up, h, .018 + st*.005, .014 + st*.003, 6);
  const n = Math.min(9, 2 + st), top = new THREE.Vector3(p.x, p.y + h, p.z);
  for (let i=0;i<n;i++){ const a = i/n*6.28 + rng()*.4, len = .06 + st*.036;
    acc.add(leafGeo(len, .05 + st*.012, .9), i%2 ? lm : lm2, new THREE.Matrix4().compose(top, new THREE.Quaternion().setFromEuler(new THREE.Euler(.55, a, 0, 'YXZ')), new THREE.Vector3(1,1,1))); }
  if (st >= 5) for (let i=0;i<3;i++){ const a = i*2.1 + .4;
    for (let k=0;k<5;k++) blob(acc, k%2 ? MAT.date : MAT.dateD, top.clone().add(new THREE.Vector3(Math.cos(a)*.035 + (rng()-.5)*.02, -.03 - k*.01, Math.sin(a)*.035 + (rng()-.5)*.02)), .013); }
}
function fillNursery(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*17 + s.z*5 + 9);
  slab(a, MAT.turq, .06, .012, .8, 0, .07, 0);
  [[-.22,-.22],[.22,-.2],[-.2,.22],[.22,.22]].forEach(([x,z]) => { const p = new THREE.Vector3(x + (r()-.5)*.03, .07, z + (r()-.5)*.03);
    cyl(a, MAT.wetSand, .09, .08, .02, p.x, .065, p.z, 10); miniPalm(a, p, stage, r); });
  a.into(host); host.userData.stage = stage;
}

/* ── named pieces ── */
function haveli(g){
  const a = new Acc(), W = 1.3, D = 1.24, H = .62;
  slab(a, MAT.stoneD, W + .12, .06, D + .12); slab(a, MAT.stone, W, H, D, 0, .06);
  slab(a, MAT.terra, W + .03, .05, D + .03, 0, .06 + H*.52); slab(a, MAT.stoneL, W + .06, .04, D + .06, 0, .06 + H);
  parapet(a, W, D, .1 + H, MAT.stoneL, 6);
  // front (+z) and side (+x) faces: a grand arched door, jharokhas, small windows
  arch(a, 'z', D/2, .12, .06, .22, .34, MAT.terraD); slab(a, MAT.terra, .34, .05, .06, .12, .06 + .38, D/2 + .02);
  jharokha(a, 'z', D/2, -.34, .42, 1.25); jharokha(a, 'z', D/2, .42, .42, 1.1);
  arch(a, 'z', D/2, -.34, .14, .1, .16, MAT.stoneL); arch(a, 'z', D/2, .44, .14, .1, .16, MAT.stoneL);
  jharokha(a, 'x', W/2, -.3, .42, 1.25); jharokha(a, 'x', W/2, .3, .42, 1.25);
  for (const u of [-.42, 0, .42]) arch(a, 'x', W/2, u, .14, .1, .16, MAT.stoneL);
  // roof: a central dome on a drum, chhatris at the front corners
  cyl(a, MAT.stoneL, .3, .28, .12, -.12, .1 + H, -.12, 12);
  a.add(new THREE.TorusGeometry(.28, .018, 6, 20).rotateX(Math.PI/2), MAT.turq, at(-.12, .22 + H, -.12));
  onion(a, MAT.plaster, .27, -.12, .22 + H, -.12, MAT.gold);
  chhatri(a, W/2 - .12, .15 + H, D/2 - .12, 1.1); chhatri(a, -W/2 + .12, .15 + H, D/2 - .12, 1.1); chhatri(a, W/2 - .12, .15 + H, -D/2 + .12, 1.1);
  // doorstep life: pots, a rug, a lantern
  rug(a, .34, .22, .12, D/2 + .2, 0, 0, .06); pot(a, -.08, .06, D/2 + .12, .06); pot(a, .34, .06, D/2 + .12, .05, MAT.turqD);
  lantern(a, g, .12, .06 + .47, D/2 + .08, .9);
  a.into(g);
}
function house(g, s){
  const o = s.o || {}, a = new Acc(), wall = MAT[o.wall || 'stone'], trim = MAT[o.trim || 'terra'], W = .64, D = .6, H = .46;
  slab(a, MAT.stoneD, W + .08, .05, D + .08); slab(a, wall, W, H, D, 0, .05);
  slab(a, trim, W + .02, .035, D + .02, 0, .05 + H*.55); slab(a, MAT.stoneL, W + .04, .03, D + .04, 0, .05 + H);
  parapet(a, W, D, .08 + H, o.wall === 'blue' ? MAT.plaster : MAT.stoneL, 4);
  arch(a, 'z', D/2, -.1, .05, .15, .25, trim); jharokha(a, 'z', D/2, .15, .3, .95, MAT.stoneL, trim);
  jharokha(a, 'x', W/2, 0, .3, .95, MAT.stoneL, trim); arch(a, 'x', W/2, -.18, .12, .08, .12, MAT.stoneL); arch(a, 'x', W/2, .18, .12, .08, .12, MAT.stoneL);
  if (o.dome) { cyl(a, MAT.stoneL, .17, .16, .07, -.08, .08 + H, -.06, 10); onion(a, MAT.plaster, .15, -.08, .15 + H, -.06); }
  else chhatri(a, -.14, .11 + H, -.12, 1.15, MAT.plaster);
  pot(a, .06, .05, D/2 + .06, .045); pot(a, .1, .05, D/2 + .12, .035, MAT.turqD); if (o.rug) rug(a, .14, .3, -.02 + W/2, D/2 + .1, 1.57, 2, .05);
  a.into(g);
}
function pavilion(g){
  const a = new Acc(), W = .66, H = .38;
  slab(a, MAT.stoneD, W + .1, .06, W + .1); slab(a, MAT.stoneL, W, H, W, 0, .06);
  for (const u of [-.2, 0, .2]) { arch(a, 'z', W/2, u, .06, .13, .27, MAT.stone); arch(a, 'x', W/2, u, .06, .13, .27, MAT.stone); }
  slab(a, MAT.terra, W + .08, .04, W + .08, 0, .06 + H); slab(a, MAT.stoneL, W + .02, .03, W + .02, 0, .1 + H);
  cyl(a, MAT.stoneL, .22, .2, .08, 0, .13 + H, 0, 12);
  a.add(new THREE.TorusGeometry(.2, .016, 6, 20).rotateX(Math.PI/2), MAT.turq, at(0, .21 + H, 0));
  onion(a, MAT.plaster, .2, 0, .21 + H, 0, MAT.gold);
  for (const [sx, sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) { cyl(a, MAT.stoneL, .045, .045, .04, sx*.27, .13 + H, sz*.27, 8); halfDome(a, MAT.plaster, .045, sx*.27, .17 + H, sz*.27); }
  a.into(g);
}
function bazaar(g){
  const a = new Acc();
  slab(a, MAT.stoneD, .82, .04, .7, 0, 0, -.02);
  for (const [x, z] of [[-.36,-.3],[.36,-.3],[-.36,.28],[.36,.28]]) seg(a, MAT.wood, new THREE.Vector3(x, .04, z), _up, z < 0 ? .62 : .5, .02, .018, 6);
  const c = new THREE.PlaneGeometry(.86, .74).rotateX(-Math.PI/2 + .2); a.add(c, CANOPY, at(0, .6, -.01));
  for (let i=0;i<7;i++) a.add(new THREE.ConeGeometry(.03, .06, 3).rotateX(Math.PI), CANOPY, at(-.37 + i*.123, .5, .34));
  slab(a, MAT.wood, .66, .2, .26, 0, .04, -.08); a.add(bx(.7, .012, .3), RUGS[1], at(0, .245, -.08)); a.add(bx(.3, .14, .012), RUGS[0], at(-.14, .17, .05));
  // spice cones + pots on the counter
  [[MAT.saffron, -.22], [MAT.red, -.08], [MAT.marigold, .06]].forEach(([m, x]) => { cyl(a, MAT.woodD, .045, .05, .03, x, .25, -.1, 10); a.add(new THREE.ConeGeometry(.042, .06, 10), m, at(x, .31, -.1)); });
  pot(a, .2, .25, -.12, .045, MAT.turqD); pot(a, .28, .25, -.04, .035);
  pot(a, .3, .04, .18, .06); pot(a, .22, .04, .26, .045, MAT.terraD); pot(a, .31, .12, .2, .035, MAT.turqD);
  for (const x of [-.26, 0, .26]) { seg(a, MAT.rope, new THREE.Vector3(x, .49, .3), _up, .04, .003, .003, 3); lantern(a, g, x, .45, .3, .8); }
  a.into(g);
}
function caravanserai(g){
  const a = new Acc(), W = .8, T = .06, H = .26;
  slab(a, MAT.sandL, W, .02, W);
  slab(a, MAT.stone, W, H, T, 0, 0, -W/2 + T/2); slab(a, MAT.stone, T, H, W, -W/2 + T/2, 0, 0); slab(a, MAT.stone, T, H, W, W/2 - T/2, 0, 0);
  slab(a, MAT.stone, .25, H, T, -.275, 0, W/2 - T/2); slab(a, MAT.stone, .25, H, T, .275, 0, W/2 - T/2);
  slab(a, MAT.stoneL, .3, .44, .1, 0, 0, W/2 - .05); arch(a, 'z', W/2, 0, 0, .15, .3, MAT.terra); slab(a, MAT.terra, .32, .03, .12, 0, .44, W/2 - .05);
  for (const x of [-.1, .1]) halfDome(a, MAT.plaster, .045, x, .47, W/2 - .05);
  for (const [sx, sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) { cyl(a, MAT.stoneL, .075, .07, .36, sx*(W/2 - .04), 0, sz*(W/2 - .04), 10); halfDome(a, MAT.terra, .07, sx*(W/2 - .04), .36, sz*(W/2 - .04)); }
  for (let i=0;i<3;i++) arch(a, 'x', W/2, -.22 + i*.22, .1, .06, .1, MAT.stoneL);
  rug(a, .3, .2, -.08, -.1, .3, 2, .02); pot(a, .18, .02, -.2, .05); pot(a, .24, .02, -.12, .04, MAT.turqD);
  seg(a, MAT.wood, new THREE.Vector3(-.2, .02, .15), _up, .08, .06, .06, 8); blob(a, MAT.cream, new THREE.Vector3(-.2, .12, .15), .055, .7);   // a sack of grain
  a.into(g);
}
function tent(a, mat, r, h, x, z, ry=0){
  a.add(new THREE.ConeGeometry(r, h, 4, 1, true).rotateY(Math.PI/4), mat, at(x, h/2, z, ry));
  a.add(new THREE.ConeGeometry(r*.2, h*.35, 4, 1).rotateY(Math.PI/4), MAT.dark, at(x + Math.sin(ry)*r*.45, h*.17, z + Math.cos(ry)*r*.45, ry));
  seg(a, MAT.wood, new THREE.Vector3(x, h*.95, z), _up, .07, .008, .006, 4); blob(a, MAT.brass, new THREE.Vector3(x, h + .07, z), .014);
}
function tentCamp(g){
  const a = new Acc();
  tent(a, TENT_R, .3, .42, -.12, -.12, .5); tent(a, TENT_B, .22, .32, .26, -.22, .2);
  rug(a, .32, .22, -.02, .22, .3, 1, 0);
  for (let i=0;i<7;i++){ const aa = i/7*6.28; blob(a, MAT.stoneD, new THREE.Vector3(.27 + Math.cos(aa)*.07, .015, .22 + Math.sin(aa)*.07), .022, .7); }
  for (let i=0;i<3;i++) seg(a, MAT.woodD, new THREE.Vector3(.27 + Math.cos(i*2.1)*.05, .01, .22 + Math.sin(i*2.1)*.05), new THREE.Vector3(-Math.cos(i*2.1), .9, -Math.sin(i*2.1)), .09, .01, .008, 4);
  a.add(new THREE.ConeGeometry(.035, .1, 6), MAT.flame, at(.27, .06, .22)); glowSprite(g, new THREE.Vector3(.27, .1, .22), .45, 0xFF9A3C, .6);
  pot(a, -.34, 0, .3, .045); a.into(g);
}
function well(g){
  const a = new Acc();
  slab(a, MAT.stoneD, .6, .03, .6, 0, 0, 0, .785);
  cyl(a, MAT.stone, .23, .23, .2, 0, .03, 0, 14); cyl(a, MAT.stoneL, .25, .25, .03, 0, .23, 0, 14); cyl(a, MAT.water, .18, .18, .01, 0, .19, 0, 14);
  a.add(new THREE.TorusGeometry(.23, .012, 5, 20).rotateX(Math.PI/2), MAT.terra, at(0, .12, 0));
  for (const x of [-.22, .22]) seg(a, MAT.wood, new THREE.Vector3(x, .03, 0), _up, .5, .022, .018, 6);
  seg(a, MAT.woodD, new THREE.Vector3(-.25, .5, 0), new THREE.Vector3(1, 0, 0), .5, .016, .016, 6);
  a.add(new THREE.TorusGeometry(.04, .012, 5, 12), MAT.woodD, at(0, .5, 0, Math.PI/2));
  seg(a, MAT.rope, new THREE.Vector3(.03, .31, 0), _up, .19, .004, .004, 3);
  cyl(a, MAT.wood, .035, .045, .06, .03, .26, 0, 8); a.add(new THREE.TorusGeometry(.04, .005, 4, 10).rotateX(Math.PI/2), MAT.brass, at(.03, .32, 0));
  pot(a, .28, .03, .2, .055); pot(a, .2, .03, .28, .04, MAT.turqD); agave(a, -.26, .24, .8, .03);
  a.into(g);
}
function fountain(g){
  const a = new Acc();
  slab(a, MAT.terra, .88, .03, .88); slab(a, MAT.stoneL, .8, .01, .8, 0, .03);
  cyl(a, MAT.stone, .34, .34, .1, 0, .04, 0, 8); cyl(a, MAT.water, .3, .3, .01, 0, .12, 0, 8);
  a.add(new THREE.TorusGeometry(.34, .015, 4, 8).rotateX(Math.PI/2).rotateY(Math.PI/8), MAT.turq, at(0, .14, 0));
  cyl(a, MAT.stoneL, .04, .035, .18, 0, .1, 0, 8); cyl(a, MAT.stone, .13, .1, .04, 0, .27, 0, 8); cyl(a, MAT.water, .1, .1, .008, 0, .305, 0, 8);
  a.add(new THREE.ConeGeometry(.02, .13, 6), MAT.jet, at(0, .37, 0)); a.add(new THREE.CylinderGeometry(.13, .11, .06, 12, 1, true), MAT.jet, at(0, .27, 0));
  for (const [sx, sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) { pot(a, sx*.37, .04, sz*.37, .05, sx*sz > 0 ? MAT.terraD : MAT.turqD); blob(a, MAT.shrub, new THREE.Vector3(sx*.37, .13, sz*.37), .045, .8); }
  a.into(g);
}
function spring(g, s){
  const a = new Acc(), r = rngFrom(s.x*7 + s.z*3);
  pool(a, g, r, .28, .24, .02, .04, 5); reeds(a, -.28, -.16, 8, r); reeds(a, .28, -.26, 5, r, .22);
  pot(a, .3, 0, .3, .05, MAT.terra, 1.3); agave(a, -.3, .3, .9);
  a.into(g);
}
function oasisPool(g, s){
  const a = new Acc(), r = rngFrom(71);
  pool(a, g, r, .4, .36, 0, .02, 7); reeds(a, -.34, .26, 7, r); reeds(a, .36, -.3, 9, r, .3); reeds(a, -.1, -.38, 4, r, .2);
  km(g, 'dino', 'PalmTree_3', .95, .7, -.36, 0, -.34, 2.4); a.into(g);
}
function datePalm(g, s){
  km(g, 'dino', s.model, s.h || 1.35, s.w || 1.2, 0, 0, 0, (s.rot||0)*Math.PI/180);
  const a = new Acc(), r = rngFrom(s.x*3 + s.z*11);
  blob(a, MAT.sand, new THREE.Vector3(0, -.02, 0), .26, .25); agave(a, .26, .2, .7); if (r() < .6) barrel(a, -.24, .24, .8);
  a.into(g);
}
function acaciaPiece(g, s){ const a = new Acc(), r = rngFrom(s.x*5 + s.z*13); acacia(g, a, r, s.h || 1, 0, 0); agave(a, .28, .26, .7); a.into(g); }
function cacti(g, s){
  const a = new Acc(), r = rngFrom(s.x*9 + s.z*2), v = s.v || 0;
  if (v === 0) { saguaro(a, -.08, -.06, .78, r, true); saguaro(a, .24, .16, .45, r); barrel(a, -.26, .24); agave(a, .26, -.26, .8); }
  else { saguaro(a, .06, -.1, .9, r, true); saguaro(a, -.22, .18, .55, r); barrel(a, .22, .22, 1.1); barrel(a, .3, .06, .7); agave(a, -.28, -.26, .9); }
  blob(a, MAT.sand, new THREE.Vector3(0, -.02, 0), .3, .2); a.into(g);
}
/* To-dos: paths and small props */
function path(g, s){
  const sl = new THREE.Mesh(G.path, MAT.sandL); sl.position.y = .0175; sl.receiveShadow = true; g.add(sl);
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0;
  if (v === 0) { [[-.2,-.2],[.18,-.2],[-.18,.2],[.2,.19]].forEach(([x,z]) => a.add(new THREE.BoxGeometry(.28, .03, .26), r() < .5 ? MAT.stone : MAT.stoneL, at(x + (r()-.5)*.05, .045, z + (r()-.5)*.05, (r()-.5)*.3)));
    lantern(a, g, .38, .1, -.38, .9); g.userData.ghostMode = 'marker'; }
  else if (v === 1) { rug(a, .7, .5, 0, 0, .2, 0, .035);
    [[MAT.red, -.2, -.12], [MAT.indigo, .22, -.18], [MAT.saffron, -.2, .17]].forEach(([m, x, z]) => a.add(new THREE.CapsuleGeometry(.05, .08, 3, 8).rotateZ(Math.PI/2), m, at(x, .085, z, .2 + x*2, 1, .8, 1)));
    cyl(a, MAT.brass, .1, .1, .015, .04, .047, .04, 14); a.add(new THREE.SphereGeometry(.035, 8, 6), MAT.brass, at(.04, .09, .04)); seg(a, MAT.brass, new THREE.Vector3(.07, .08, .04), new THREE.Vector3(1, .6, 0), .05, .007, .004, 4);
    for (let i=0;i<2;i++) cyl(a, MAT.jasmine, .015, .012, .03, -.03 + i*.04, .062, .1, 8); }
  else if (v === 2) { [[-.12,-.1,.08],[.08,-.14,.07],[-.02,.08,.075],[.2,.06,.055],[-.2,.14,.05]].forEach(([x,z,sc], i) => pot(a, x, .035, z, sc, [MAT.terra, MAT.terraD, MAT.turqD][i%3]));
    pot(a, -.03, .035 + .1*1.25, -.1, .055, MAT.terra); pot(a, .02, .035 + .1*1.25 + .07*1.25, -.1, .04, MAT.turqD);
    cyl(a, MAT.rope, .08, .1, .1, .26, .035, -.22, 10); agave(a, .3, .3, .7, .035); }
  else if (v === 3) { for (const [x, z] of [[-.28,-.24],[.28,.24]]) { seg(a, MAT.woodD, new THREE.Vector3(x, .035, z), _up, .56, .02, .016, 6);
      seg(a, MAT.brass, new THREE.Vector3(x, .58, z), new THREE.Vector3(1, .2, 1).normalize(), .1, .008, .008, 4);
      seg(a, MAT.rope, new THREE.Vector3(x + .07, .55, z + .07), _up, .05, .003, .003, 3); lantern(a, g, x + .07, .5, z + .07, 1.1); }
    blob(a, MAT.stoneD, new THREE.Vector3(.2, .05, -.2), .06, .6, 0, r); agave(a, -.2, .26, .7, .035); }
  else if (v === 4) { const p0 = new THREE.Vector3(-.36, 0, -.1), p1 = new THREE.Vector3(.36, 0, .1);
    for (const p of [p0, p1]) seg(a, MAT.wood, p.clone().setY(.035), _up, .46, .02, .017, 6);
    const c = new THREE.CatmullRomCurve3([p0.clone().setY(.46), p0.clone().lerp(p1, .5).setY(.4), p1.clone().setY(.46)]); a.add(new THREE.TubeGeometry(c, 10, .005, 4), MAT.rope);
    [[.25, TENT_S], [.5, RUGS[2]], [.75, TENT_S]].forEach(([t, m]) => { const p = c.getPoint(t); a.add(new THREE.PlaneGeometry(.14, .2), m, at(p.x, p.y - .1, p.z, -.27)); });
    pot(a, .2, .035, .28, .05); }
  else { const m = MAT.wetSand;
    slab(a, m, .7, .22, .08, 0, .035, -.34); slab(a, m, .08, .22, .6, -.34, .035, -.02);
    for (const x of [-.2, 0, .2]) halfDome(a, m, .04, x, .255, -.34);
    slab(a, MAT.terra, .7, .03, .085, 0, .035, -.34);
    a.add(archGeo(.1, .12, .01), MAT.dark, at(.12, .09, -.295)); pot(a, .12, .09, -.33, .03, MAT.turqD);
    pot(a, -.18, .035, -.14, .055); agave(a, .2, .15, .8, .035); }
  a.into(g);
}
function mudWall(g, s){
  const a = new Acc(), L = s.len;
  const run = (u, len) => s.edge === 'w' ? [ -.45, u, 0, len ] : [ u, .45, Math.PI/2, len ];
  for (let i=0;i<L;i++){ const [x, z, ry, len] = run(i - (L-1)/2, .96);
    a.add(bx(.08, .2, len), MAT.wetSand, at(x, .1, z, ry)); a.add(new THREE.CylinderGeometry(.04, .04, len, 8, 1).rotateX(Math.PI/2), MAT.wetSand, at(x, .2, z, ry));
    a.add(bx(.085, .03, len), MAT.terra, at(x, .015, z, ry)); }
  for (let i=0;i<=L;i++){ const [x, z] = run(i - L/2, 0); cyl(a, MAT.stone, .06, .055, .26, x, 0, z, 8); halfDome(a, MAT.stoneL, .055, x, .26, z); }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}
/* the hero (Gita): a grand sunset chhatri on a dune top, lanterns on its eaves */
function chhatriHero(g){
  const a = new Acc(), r = rngFrom(5);
  blob(a, MAT.sand, new THREE.Vector3(-.05, -.12, -.08), .98, .32, 2, r); blob(a, MAT.sandL, new THREE.Vector3(.38, -.08, .3), .5, .3, 1, r);
  const Y = .22;
  for (let i=0;i<4;i++) slab(a, MAT.stoneL, .3, .05, .12, .3 + i*.02, Y - .2 + i*.05, .62 - i*.1, 0);          // steps up the dune, toward the camera
  cyl(a, MAT.stoneD, .66, .62, .12, 0, Y - .06, 0, 8); cyl(a, MAT.stone, .56, .54, .1, 0, Y + .06, 0, 8);
  const P = Y + .16, PH = .52;
  for (let i=0;i<8;i++){ const ang = i/8*6.28 + Math.PI/8, x = Math.cos(ang)*.44, z = Math.sin(ang)*.44;
    cyl(a, MAT.stoneL, .04, .035, PH, x, P, z, 8); cyl(a, MAT.stone, .055, .055, .04, x, P, z, 8); cyl(a, MAT.stone, .05, .06, .05, x, P + PH - .05, z, 8); }
  a.add(new THREE.TorusGeometry(.44, .03, 5, 8, Math.PI*2).rotateX(Math.PI/2).rotateY(Math.PI/8), MAT.stoneL, at(0, P + PH - .02, 0));
  cyl(a, MAT.terra, .64, .52, .06, 0, P + PH, 0, 8); cyl(a, MAT.stoneL, .5, .5, .05, 0, P + PH + .06, 0, 8);
  cyl(a, MAT.stoneL, .36, .34, .12, 0, P + PH + .11, 0, 12);
  a.add(new THREE.TorusGeometry(.34, .022, 6, 22).rotateX(Math.PI/2), MAT.turq, at(0, P + PH + .23, 0));
  onion(a, MAT.plaster, .34, 0, P + PH + .23, 0, MAT.gold);
  for (let i=0;i<4;i++){ const ang = i/4*6.28 + Math.PI/4; halfDome(a, MAT.plaster, .07, Math.cos(ang)*.47, P + PH + .11, Math.sin(ang)*.47); }
  rug(a, .5, .38, 0, 0, .4, 0, P);
  for (let i=0;i<4;i++){ const ang = i/4*6.28 + Math.PI/8 + .4; const x = Math.cos(ang)*.56, z = Math.sin(ang)*.56;
    seg(a, MAT.brass, new THREE.Vector3(x, P + PH - .08, z), _up, .08, .003, .003, 3); lantern(a, g, x, P + PH - .12, z, 1.05); }
  for (const [x, z] of [[.78, .5], [.52, .8]]) { seg(a, MAT.woodD, new THREE.Vector3(x, .02, z), _up, .3, .014, .012, 5); lantern(a, g, x, .36, z, .9); }
  pot(a, -.62, .06, .42, .06); agave(a, -.5, .68, .9, .02); barrel(a, .72, -.5);
  a.into(g);
  glowSprite(g, new THREE.Vector3(0, P + PH + .4, 0), 1.7, 0xFFB070, .26);   // warm sunset halo around the dome
}

/* ── blueprint: the farm's cells with oasis pieces; the sunset chhatri takes the left corner ── */
const MAP = {
  bigbarn:{ name:'Sandstone haveli', b:'haveli' }, well:{ name:'Rope well', b:'well' }, apple1:{ name:'Date palm', b:'palm', model:'PalmTree_3', rot:20, h:1.3 },
  silo:{ name:'Domed pavilion', b:'pavilion' }, silohouse:{ name:'Lantern bazaar', b:'bazaar' },
  coop:{ name:'Blue house', b:'house', o:{ wall:'blue', trim:'plaster', dome:true, rug:true } },
  watertower:{ name:'Fountain court', b:'fountain' }, pump:{ name:'Reed spring', b:'spring' }, apple2:{ name:'Acacia', b:'acacia' },
  berry1:{ name:'Tall cacti', b:'cacti', v:0 }, peepal:{ name:'Sunset chhatri', b:'hero' },
  smallbarn:{ name:'Caravanserai', b:'serai' }, openbarn:{ name:'Tent camp', b:'tents' },
  pond:{ name:'Oasis pool', b:'oasis' }, orange1:{ name:'Date palm', b:'palm', model:'PalmTree_4', rot:200, h:1.5 },
  apple3:{ name:'Acacia', b:'acacia', h:1.1 }, berry2:{ name:'Tall cacti', b:'cacti', v:1 },
  orange2:{ name:'Date palm', b:'palm', model:'PalmTree_3', rot:130, h:1.25 }, apple4:{ name:'Date palm', b:'palm', model:'PalmTree_3', rot:60, h:1.4 }
};
const MOVE = { peepal:{ x:0, z:5 }, field1_5:{ x:1, z:1 }, fence3:{ x:0, z:0, edge:'w' } };   // hero to the left corner
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:0, path2_6:5, path3_6:4 };
const PATH_NAME = ['Lantern walk', 'Rug & cushions', 'Pottery stack', 'Brass lanterns', 'Rope line', 'Mud-wall nook'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d, ...(MOVE[f.id] || {}) };
  if (f.kind === 'field') { const garden = f.crop === 'Lettuce' || f.crop === 'Beet' || f.crop === 'Carrot';
    return garden ? { ...s, kind:'charbagh', name:'Charbagh garden', stages:5 } : { ...s, kind:'nursery', name:'Date nursery', stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'oasis', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'oasis', b:'wall', edge:s.edge || f.edge, len:f.len, name:'Low mud wall' };
  return { ...s, kind:'oasis', ...MAP[f.id] };
});
const BUILD = { haveli, house, pavilion, bazaar, serai:caravanserai, tents:tentCamp, well, fountain, spring, oasis:oasisPool,
  palm:datePalm, acacia:acaciaPiece, cacti, path, wall:mudWall, hero:chhatriHero };

/* ── the ground: golden sand with dune ripples on a terracotta block ── */
const TILE = { top:['#EBC586', '#E4BA78'], side:'#D39060', soilTop:'#BE7A48', soilBot:'#6E3F22' };
function tileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(61);
  g.fillStyle = '#FBF3E6'; g.fillRect(0,0,N,N);
  for (let i=0;i<9;i++){ const y0 = (i + .5)*N/9;
    g.strokeStyle = 'rgba(170,100,40,.16)'; g.lineWidth = 2.5; g.beginPath();
    for (let x=0;x<=N;x+=4){ const y = y0 + Math.sin(x*.035 + i*1.7)*7 + Math.sin(x*.09 + i)*2; x ? g.lineTo(x,y) : g.moveTo(x,y); } g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5; g.beginPath();
    for (let x=0;x<=N;x+=4){ const y = y0 + 3.5 + Math.sin(x*.035 + i*1.7)*7 + Math.sin(x*.09 + i)*2; x ? g.lineTo(x,y) : g.moveTo(x,y); } g.stroke(); }
  for (let i=0;i<260;i++){ g.fillStyle = r()<.5 ? 'rgba(255,255,255,.55)' : 'rgba(150,85,30,.13)'; g.beginPath(); g.arc(r()*N, r()*N, .6 + r()*1.2, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/* decor: little dunes, agave, rocks and dry grass on empty cells; a hint on waiting cells */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    const grass = (px, pz, k=1) => km(grp, 'a', r() < .5 ? 'Grass_Wispy_Short' : 'Grass_Common_Short', .13*k, .25*k, px, p.y, pz, r()*6);
    const rock = (px, pz, k=1) => km(grp, 'a', ['Rock_Medium_1','Rock_Medium_2','Rock_Medium_3'][Math.floor(r()*3)], .08*k, .16*k, px, p.y, pz, r()*6);
    if (!sl || sl === 'later') {
      blob(a, MAT.sand, new THREE.Vector3(p.x + (r()-.5)*.3, p.y - .03, p.z + (r()-.5)*.3), .3 + r()*.1, .28, 1, r);
      if (r() < .6) agave(a, p.x + .25, p.z - .2, .7 + r()*.3, p.y); else barrel(a, p.x + .22, p.z - .22, .8);
      rock(p.x - .28, p.z + .24); grass(p.x + .26, p.z + .28); if (AMBIENT()) grass(p.x - .3, p.z - .26, .8);
      grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { grass(p.x + .3, p.z + .3, .8); if (r() < .5) rock(p.x - .3, p.z + .28, .7); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if ((Math.abs(x-3) === V.ring && x > 3) || (Math.abs(z-3) === V.ring && z > 3)) { grass(p.x + .38, p.z + .38, .7); grp.userData.decor = 'rim'; }
    if (a.m.size) a.into(grp);
    if (!grp.children.length) world.remove(grp);
  }
}

/* ── ambient: drifting sand motes and a hawk wheeling high (palm fronds sway via the kit's sway shader) ── */
function makeHawk(){ const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.05, 8, 6), MAT.hawk, at(0, 0, -.02, 0, .8, .7, 2)); blob(a, MAT.hawkL, new THREE.Vector3(0, .02, .09), .035, 1);
  a.add(new THREE.ConeGeometry(.012, .04, 5).rotateX(Math.PI/2), MAT.saffron, at(0, .015, .13));
  a.add(new THREE.ConeGeometry(.05, .1, 4).rotateX(-Math.PI/2).scale(1, .25, 1), MAT.hawk, at(0, 0, -.15)); a.into(g);
  const wg = new THREE.PlaneGeometry(.3, .09).rotateX(-Math.PI/2).translate(.15, 0, 0), wm = FM(0x7A5638, { side:THREE.DoubleSide });
  const w1 = new THREE.Mesh(wg, wm), w2 = new THREE.Mesh(wg, wm); w2.scale.x = -1;
  const tip = new THREE.PlaneGeometry(.08, .1).rotateX(-Math.PI/2).translate(.27, .001, 0), tm = FM(0x4A3424, { side:THREE.DoubleSide }); w1.add(new THREE.Mesh(tip, tm)); w2.add(new THREE.Mesh(tip, tm));
  g.add(w1, w2); g.userData.wings = [w1, w2]; return g; }
function addAmbient(){
  const hk = makeHawk(); hk.scale.setScalar(.9 + V.ring*.15); hk.userData.u = { r:1.3 + V.ring*.55, h:1.5 + V.ring*.35, sp:.22 }; world.add(hk); V.life.push(hk); V.hawk = hk;
  V.motes = []; const r = rngFrom(88), R = V.L/2 + .3;
  for (let i=0;i<16;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xF6DDAE, transparent:true, opacity:.75, depthWrite:false }));
    s.scale.setScalar(.05 + r()*.05); s.userData.u = { x0:(r()*2 - 1)*R, z:(r()*2 - 1)*R, y:.12 + r()*.7, sp:.12 + r()*.12, ph:r()*6, R }; s.renderOrder = 8;
    world.add(s); V.motes.push(s); V.life.push(s); }
  moveAmbient(2.1);
}
function moveAmbient(t){
  if (!V) return; const hk = V.hawk;
  if (hk) { const u = hk.userData.u, ang = t*u.sp, p = new THREE.Vector3(Math.cos(ang)*u.r, TILE_TOP + u.h + Math.sin(ang*2)*.12, Math.sin(ang)*u.r*.8);
    hk.visible = !S.night; hk.position.copy(p); hk.rotation.set(0, -ang, .3); const f = Math.sin(t*2.2)*.12 + (Math.sin(t*.7) > .6 ? Math.sin(t*9)*.4 : 0);
    hk.userData.wings[0].rotation.z = f; hk.userData.wings[1].rotation.z = -f; }
  (V.motes || []).forEach(s => { const u = s.userData.u, span = u.R*2, x = ((u.x0 + t*u.sp + u.R) % span + span) % span - u.R;
    s.position.set(x, TILE_TOP + u.y + Math.sin(t*1.3 + u.ph)*.06, u.z + Math.sin(t*.8 + u.ph)*.1);
    s.material.opacity = .7*Math.min(1, (u.R - Math.abs(x))*2); });
}

/* ── residents: two camels plod in, a fennec fox trots to the front, flamingos glide down to the oasis pool ── */
const RES_SCALE = 1.5;
function makeCamel(v=0){
  const g = new THREE.Group(), a = new Acc(), body = v ? MAT.camelL : MAT.camel, dark = MAT.camelD;
  a.add(new THREE.SphereGeometry(.13, 12, 9), body, at(0, .4, 0, 0, .95, .8, 1.5));
  blob(a, body, new THREE.Vector3(0, .5, -.02), .1, 1.05, 1);
  const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .42, .16), new THREE.Vector3(0, .43, .27), new THREE.Vector3(0, .54, .33), new THREE.Vector3(0, .6, .33)]);
  a.add(new THREE.TubeGeometry(neck, 8, .045, 7), body);
  a.add(new THREE.SphereGeometry(.05, 9, 7), body, at(0, .62, .37, 0, .85, .8, 1.5)); blob(a, dark, new THREE.Vector3(0, .6, .43), .03, .8);
  for (const sx of [-1, 1]) { blob(a, MAT.eye, new THREE.Vector3(sx*.036, .64, .38), .009); a.add(new THREE.ConeGeometry(.012, .035, 4), dark, at(sx*.03, .67, .33, 0, 1, 1, 1, 0, -sx*.4)); }
  // saddle blanket with tassels
  a.add(new THREE.CylinderGeometry(.115, .115, .16, 12, 1, true, -Math.PI/2 - 1.2, 2.4), MAT.red, at(0, .47, -.02, 0, 1.05, 1, 1, Math.PI/2, 0));
  a.add(bx(.25, .015, .1), MAT.indigo, at(0, .42, -.02)); for (const sx of [-1, 1]) for (let i=0;i<3;i++) blob(a, MAT.saffron, new THREE.Vector3(sx*.125, .36, -.07 + i*.05), .012, 1.3);
  seg(a, dark, new THREE.Vector3(0, .42, -.19), new THREE.Vector3(0, -1, -.3), .12, .012, .006, 4);
  a.into(g);
  const legs = [];
  for (const [x, z] of [[-.06, .13], [.06, .13], [-.06, -.14], [.06, -.14]]) {
    const L = new THREE.Group(), la = new Acc(); L.position.set(x, .36, z);
    seg(la, body, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0), .18, .03, .022, 6); blob(la, dark, new THREE.Vector3(0, -.18, 0), .024, 1);
    seg(la, body, new THREE.Vector3(0, -.18, 0), new THREE.Vector3(0, -1, 0), .17, .018, .016, 6); la.add(new THREE.CylinderGeometry(.03, .034, .02, 8), dark, at(0, -.35, .005));
    la.into(L); g.add(L); legs.push(L); }
  g.userData.legs = legs; return g;
}
function makeFlamingo(pose=0){
  const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.05, 10, 8), MAT.flamingo, at(0, .24, 0, 0, .85, .75, 1.4, -.15));
  a.add(new THREE.ConeGeometry(.035, .07, 5).rotateX(-Math.PI/2), MAT.flamingoD, at(0, .25, -.075, 0, 1, .5, 1));
  for (const sx of [-1, 1]) a.add(new THREE.SphereGeometry(.035, 7, 5), MAT.flamingoD, at(sx*.035, .25, -.01, 0, .3, .6, 1.3));
  const neck = pose ? new THREE.CatmullRomCurve3([new THREE.Vector3(0, .26, .05), new THREE.Vector3(0, .3, .1), new THREE.Vector3(0, .26, .14), new THREE.Vector3(0, .2, .16)])
    : new THREE.CatmullRomCurve3([new THREE.Vector3(0, .26, .05), new THREE.Vector3(0, .34, .06), new THREE.Vector3(0, .38, .02), new THREE.Vector3(0, .44, .04)]);
  a.add(new THREE.TubeGeometry(neck, 10, .012, 6), MAT.flamingo);
  const hp = neck.getPoint(1); blob(a, MAT.flamingo, hp, .022, 1);
  a.add(new THREE.ConeGeometry(.01, .04, 5).rotateX(Math.PI*.8), MAT.bill, at(hp.x, hp.y - .01, hp.z + .025));
  blob(a, MAT.eye, new THREE.Vector3(.015, hp.y + .005, hp.z + .006), .004); blob(a, MAT.eye, new THREE.Vector3(-.015, hp.y + .005, hp.z + .006), .004);
  seg(a, MAT.leg, new THREE.Vector3(.012, 0, 0), _up, .21, .005, .005, 4);
  if (pose) seg(a, MAT.leg, new THREE.Vector3(-.012, .2, 0), new THREE.Vector3(0, -.4, -1), .07, .005, .005, 4);   // one leg tucked
  else seg(a, MAT.leg, new THREE.Vector3(-.012, 0, 0), _up, .21, .005, .005, 4);
  a.into(g); return g;
}
function recolourFox(obj){ obj.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.metalness = 0; o.material.roughness = .85;
  const n = o.material.name || ''; if (n === 'Main') o.material.color.setHex(0xE0B27A); else if (n === 'Main_Light') o.material.color.setHex(0xF8EBD6); });
  obj.traverse(o => { if (o.isBone && /ear/i.test(o.name)) o.scale.multiplyScalar(1.6); });   // fennec ears
  return obj; }
const FOX = { id:'Fox', h:.36, at:[5.25, 6.0], face:-.6 };
async function spawnFox(){
  const gltf = ANIMCACHE.__fox || await loadAnimal({ id:'Fox' }), obj = recolourFox(SkeletonUtils.clone(gltf.scene));
  const b = modelBox(obj), k = FOX.h / (b.max.y - b.min.y); obj.scale.setScalar(k); obj.userData.y0 = TILE_TOP - b.min.y*k; world.add(obj);
  const mixer = new THREE.AnimationMixer(obj), clips = {}; gltf.animations.forEach(c => clips[c.name.replace(/^.*\|/, '')] = c);
  const rec = { def:FOX, obj, mixer, clips, cur:null }; V.animals.push(rec); return rec;
}
function playClip(a, name){ const c = a.clips[name] || a.clips.Idle || Object.values(a.clips)[0]; if (!c) return; const act = a.mixer.clipAction(c);
  if (a.cur === act) return; act.reset().play(); if (a.cur) a.cur.crossFadeTo(act, .3, false); a.cur = act; }
const CAMELS = [ { at:[0.32, 2.55], face:2.2, v:0 }, { at:[0.3, 3.75], face:1.3, v:1 } ];
const FLAMINGOS = [ [5.85, 1.85, .6, 0], [6.15, 2.2, -1.9, 1], [5.95, 2.35, 2.6, 0] ];
function moveResidents(t){
  (V && V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'camel') { const walking = r.arrive < 1, p = u.from.clone().lerp(u.at, walking ? 1 - Math.pow(1 - r.arrive, 2.2) : 1);
      r.obj.position.set(p.x, TILE_TOP + (walking ? Math.abs(Math.sin(t*6))*.01 : 0), p.z);
      if (walking) r.obj.rotation.y = Math.atan2(u.at.x - u.from.x, u.at.z - u.from.z); else r.obj.rotation.y = u.face;
      r.obj.userData.legs.forEach((L, i) => L.rotation.x = walking ? Math.sin(t*6 + (i === 0 || i === 3 ? 0 : Math.PI))*.35 : 0);
      r.obj.children[0].rotation.x = walking ? 0 : Math.sin(t*.9 + u.ph)*.015; }
    else if (r.kind === 'flamingo') { const fly = 1 - e;
      r.obj.position.set(u.at.x + fly*2.2, TILE_TOP + .02 + fly*2.4 + (fly > 0 ? 0 : Math.sin(t*1.1 + u.ph)*.004), u.at.z - fly*1.2);
      r.obj.rotation.y = u.face + Math.sin(t*.5 + u.ph)*.12; }
  });
}
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.07))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(TILE_TOP + .5), 10, 0xFFF0B0, .6); res(); })); }
async function oasisMoveIn(walk){
  V.residentsIn = true; V.res = [];
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const gate = cellPos(3, 7.3);
  const groups = [
    async () => { const rs = CAMELS.map((c, i) => { const o = makeCamel(c.v); o.scale.setScalar(RES_SCALE*(i ? .92 : 1));
        return addRes('camel', o, { at:cellPos(...c.at), from:gate.clone().add(new THREE.Vector3(-.4*i, 0, .3*i)), face:c.face, ph:i*1.9 }); });
      moveResidents(0); if (walk) await arrive(rs, 2600); },
    async () => { const f = await spawnFox(), to = cellPos(...FOX.at); f.obj.position.set(to.x, f.obj.userData.y0, to.z); f.obj.rotation.y = FOX.face;
      if (!walk) { playClip(f, 'Idle'); f.mixer.update(.6); return; }
      playClip(f, 'Walk'); const from = gate.clone().add(new THREE.Vector3(1.2, 0, 0)), dir = to.clone().sub(from); f.obj.rotation.y = Math.atan2(dir.x, dir.z);
      await new Promise(res => tween(S.rm ? 1 : Math.max(900, dir.length()*700), t => { const e = 1 - Math.pow(1 - t, 2.2); f.obj.position.set(from.x + dir.x*e, f.obj.userData.y0, from.z + dir.z*e); },
        () => { f.obj.rotation.y = FOX.face; playClip(f, 'Idle'); sparkle(to.clone().setY(TILE_TOP + .4), 10, 0xFFF0B0, .6); res(); })); },
    async () => { const rs = FLAMINGOS.map(([x, z, f, pose], i) => { const o = makeFlamingo(pose); o.scale.setScalar(RES_SCALE); return addRes('flamingo', o, { at:cellPos(x, z), face:f, ph:i*1.4 }); });
      moveResidents(0); if (walk) await arrive(rs, 1800); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length;
}

export default {
  id:'oasis', name:'Desert oasis', title:'Your oasis',
  season:18, dates:'25 May–7 Jun', nextIn:14,
  kits:['a', 'dino'],
  kitDefs:{ dino:{ file:'assets/dino/palms.glb', sway:true } },
  families:{
    water:   { label:'wells, pools & fountains',    tag:'Water' },
    building:{ label:'havelis, tents & the bazaar', tag:'Building' },
    path:    { label:'rugs, pots, lanterns & walls', tag:'Camp' },
    crop:    { label:'charbagh & date nurseries',   tag:'Garden' },
    tree:    { label:'date palms, acacias & cacti', tag:'Palm' },
    special: { label:'the sunset chhatri',          tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:TILE, tileMap },
  ghost:{ color:'#FFFDF6', opacity:.42, emissive:.2, dash:'#FFFFFF', dashOpacity:.72 },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><circle cx="16.5" cy="8" r="3.4" fill="#F6A63A"/><path d="M2.5 19c3.5-4 8-5.2 12-3.4 2.3 1 4.6 1.2 7-.2V21h-19z" fill="#E3B06A"/><path d="M7 17.5V9.8" stroke="#9A6436" stroke-width="1.7" stroke-linecap="round"/><path d="M7 9.8C5.6 8.2 3.4 8.2 2.3 9.6 4 9.3 5.4 9.6 7 9.8zM7 9.8c.6-1.9 2.8-2.7 4.5-1.8-1.7.4-3 1-4.5 1.8zM7 9.8c1.8-.2 3.6.9 4 2.6-1.4-.9-2.6-1.6-4-2.6z" fill="#3FA36B"/><ellipse cx="17" cy="18.4" rx="2.6" ry=".9" fill="#3FC1C0"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M4 118c20-18 44-22 64-14 18 7 36 6 56-6v20z"/><path d="M52 92h36v-6H52z"/><path d="M56 86V64h4v22zM80 86V64h4v22z"/><path d="M50 64h40v-6H50z"/><path d="M52 58c0-14 8-24 18-30 10 6 18 16 18 30z"/><path d="M69 28V16h2v12z"/><path d="M22 106c0-20 2-38 8-54l4 1c-5 15-7 33-7 53z"/><path d="M31 52c-8-8-20-8-26 0 9-1 17 0 26 0zM31 52c3-10 14-14 24-9-9 1-16 4-24 9zM31 52c10-2 20 3 22 13-8-6-14-9-22-13z"/></g>',
  album:{ image:'assets/oasis/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#FBE9D2)' },
  css:'.phone[data-theme="oasis"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#FDF0DE 58%,#F7DDBA 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'charbagh' || s.kind === 'nursery') {
      const base = new THREE.Mesh(G.field, s.kind === 'charbagh' ? MAT.stoneL : MAT.wetSand); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      if (s.kind === 'charbagh') { const soil = new THREE.Mesh(new THREE.BoxGeometry(.8, .01, .8), MAT.soil); soil.position.y = .072; soil.userData.ghostHide = true; g.add(soil); }
      const host = new THREE.Group(); host.scale.setScalar(1.12); g.add(host); g.userData.plants = host;
      const fill = s.kind === 'charbagh' ? fillCharbagh : fillNursery; g.userData.regrow = st => fill(host, s, st); fill(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'oasis' ? 1 : 1.12,
  contact: s => s.kind === 'oasis' && !['path', 'wall', 'hero'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && (s.v === 0 || s.v === 3)) || s.b === 'fountain',
  decor,
  ambient: addAmbient,
  tick(t){ moveAmbient(t); moveResidents(t); },

  residents:[ { id:'camel', name:'Camels', n:2 }, { id:'Fox', name:'Fennec fox', h:FOX.h, at:FOX.at, face:FOX.face, n:1 }, { id:'flamingo', name:'Flamingos', n:3 } ],
  moveIn: oasisMoveIn,
  async preload(){ if (!ANIMCACHE.__fox) ANIMCACHE.__fox = await loadAnimal({ id:'Fox' }); },
  residentThumb(d, thumbFor){
    return thumbFor('oasis:'+d.id, () => {
      if (d.id === 'Fox') { const o = recolourFox(SkeletonUtils.clone(ANIMCACHE.__fox.scene)); const mx = new THREE.AnimationMixer(o);
        const c = ANIMCACHE.__fox.animations.find(x => /Idle/.test(x.name)); if (c) { mx.clipAction(c).play(); mx.update(.4); } o.rotation.y = -.35 + Math.PI/2; return o; }
      const o = d.id === 'camel' ? makeCamel(0) : makeFlamingo(0); o.rotation.y = d.id === 'camel' ? 1.0 : .7; return o; }, 168); },
  /* sprite export: static rigs for the code-built residents (the app animates legs / bobbing); the fox with its Walk clip */
  residentRig(d){
    if (d.id === 'Fox') { const gltf = ANIMCACHE.__fox, o = recolourFox(SkeletonUtils.clone(gltf.scene)), b = modelBox(o), k = FOX.h/(b.max.y - b.min.y);
      o.scale.setScalar(k); o.position.y = -b.min.y*k; const holder = new THREE.Group(); holder.add(o); const mixer = new THREE.AnimationMixer(o);
      return { obj:holder, mixer, clip:gltf.animations.find(c => /Walk/.test(c.name)) || gltf.animations[0], facing:FOX.face }; }
    const obj = d.id === 'camel' ? makeCamel(0) : makeFlamingo(0); obj.scale.setScalar(RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
