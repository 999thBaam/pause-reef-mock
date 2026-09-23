/* PUMPKIN PATCH (?theme=halloween) — cosy autumn, cute not scary. Same 7×7 ring blueprint as the farm: every farm slot id maps
   to an autumn piece, so the farm's order, rings, pick-3, growth and expansion work unchanged.
   Pumpkins, jack-o'-lanterns, autumn pines, lanterns, lamp posts, stone paths, benches = KayKit Halloween Bits 1.0 (CC0);
   hay bales, wooden fences, fall firs, fire basket, candles, logs = Kenney Graveyard Kit 5.0 (CC0) → assets/halloween/halloween.glb.
   Barns + well reuse the farm kit (Quaternius Farm Buildings), cottages reuse the village kit (KayKit Medieval Hexagon), maples and
   oaks are the shared MegaKit trees with their leaf atlas re-tinted to autumn. The pumpkin carriage (Gita), witch-hat cottage,
   apple-bobbing barrel, misty ponds, scarecrow, candy basket, pumpkin vines and the residents (black cat, owl, bats, crows) are
   procedural flat-shaded geometry merged per material (Acc), so every piece stays pre-renderable. */
import * as THREE from 'three';
import { rngFrom, TEX, world } from '../engine/scene.js';
import { S, V, cropStage, hooks } from '../engine/state.js';
import { TILE_TOP, cellPos, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, M, Acc, seg, blob, _up, _q, _m, _s } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { meadowDecor } from '../engine/life.js';
import { FARM_SLOTS as FARM, FARM_ORDER } from './farm.js';   // the farm blueprint with its hero moved to the right corner (see farm.js)

const HK = 'halloween';
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _m.compose(V3(x, y, z), _q.setFromEuler(_E.set(rx, ry, rz)), V3(sx, sy, sz));
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.85, metalness:0, flatShading:true, ...o });
const MAT = {
  pumpkin:FM(0xF08A2C, { flatShading:false, roughness:.7 }), pumpkinD:FM(0xD9701E, { flatShading:false }), stem:FM(0x6E8B3A),
  vine:FM(0x5F9A3C), leaf:FM(0x6FAE45, { side:THREE.DoubleSide }), leafD:FM(0x558F37, { side:THREE.DoubleSide }), bloom:FM(0xF6C531),
  gold:FM(0xF4C04A, { emissive:0x6A4400, emissiveIntensity:.3, roughness:.45, flatShading:false }),
  window:new THREE.MeshStandardMaterial({ color:0xFFE08A, emissive:0xFFB23A, emissiveIntensity:1.25, roughness:.6 }),
  flame:new THREE.MeshStandardMaterial({ color:0xFFD27A, emissive:0xFF9A1F, emissiveIntensity:1.8 }),
  wood:FM(0x8A5A34), woodL:FM(0xB57C48), woodD:FM(0x5E3C22), iron:FM(0x4A4652), straw:FM(0xE8C25E), strawD:FM(0xC99B3E),
  cloth:FM(0xC8553D), clothB:FM(0x5B7FB5), hat:FM(0x6B4FA0), hatD:FM(0x4F3880), hatBand:FM(0xF2A93B),
  wall:FM(0xF1E3C8), wallD:FM(0xD8C4A0), stone:FM(0xB9AE9C), stoneD:FM(0x958A7A),
  water:new THREE.MeshStandardMaterial({ color:0x6A9FC8, roughness:.18, metalness:0, emissive:0x1B2F5A, emissiveIntensity:.35 }),
  mist:new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:1, transparent:true, opacity:.5, depthWrite:false }),
  apple:FM(0xD8382E, { flatShading:false, roughness:.5 }), appleG:FM(0x9CC34A, { flatShading:false, roughness:.5 }),
  candy:[FM(0xF25C8A), FM(0x8FD14F), FM(0xF6C531), FM(0x7EC8F0), FM(0xB184E8)], basket:FM(0xB98552), basketD:FM(0x94653A),
  lily:FM(0x6FAE45), cream:FM(0xFFF4E0), cob:FM(0xE2C99A, { roughness:1 }), cobD:FM(0xB99668),
  // residents
  cat:FM(0x2C2833), catD:FM(0x1F1C26), eye:new THREE.MeshStandardMaterial({ color:0xF6D24A, emissive:0xC89A10, emissiveIntensity:.5, roughness:.4 }),
  pupil:FM(0x141218), pink:FM(0xF29BB0), owl:FM(0x9A6B45), owlL:FM(0xE9D4B0), owlD:FM(0x6E4A2E), beak:FM(0xF2A93B),
  bat:FM(0x4B3F63), batW:FM(0x5E4E80, { side:THREE.DoubleSide }), crow:FM(0x33303D), crowD:FM(0x24222C), white:FM(0xFFFFFF)
};
const leafMat = [FM(0xE8742C, { side:THREE.DoubleSide }), FM(0xD9482E, { side:THREE.DoubleSide }), FM(0xF2B33D, { side:THREE.DoubleSide }), FM(0xB9582B, { side:THREE.DoubleSide })];

/* ── kit helpers ── */
const tplOf = (n, kit=HK) => KITCACHE[kit] && KITCACHE[kit][n];
function km(g, name, h, w, x=0, y=0, z=0, rot=0, kit=HK){ const t = tplOf(name, kit); if (!t) { console.warn('missing', kit, name); return null; }
  const o = addModel(g, name, fitScale(t, h, w), x, y, z, rot, kit); o.userData.top = y + t.size.y*fitScale(t, h, w); return o; }
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }

/* autumn leaf atlases: the MegaKit's green leaves re-tinted (luminance kept) → maple orange, oak gold, red maple */
const TINT = { orange:[246, 138, 44], gold:[255, 206, 72], red:[222, 76, 48] };   // target leaf colours; texture luminance → brightness
function autumnTex(tex, kind){
  const key = 'au_' + kind; if (tex.userData[key]) return tex.userData[key];
  const im = tex.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), a = d.data, [kr, kg, kb] = TINT[kind];
  for (let i=0;i<a.length;i+=4){ const l = a[i]*.3 + a[i+1]*.59 + a[i+2]*.11; const f = Math.min(1.25, .56 + l/180); a[i] = Math.min(255, kr*f); a[i+1] = Math.min(255, kg*f); a[i+2] = Math.min(255, kb*f); }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  return tex.userData[key] = t;
}
const AUMATS = new Map();
function autumnTree(g, name, kind, h, w, rot=0){
  const tpl = tplOf(name, 'a'); if (!tpl) return null;
  const k = fitScale(tpl, h, w), tree = new THREE.Group();
  tpl.parts.forEach(pt => { let mat = pt.mat;
    if (mat.map && !/bark|trunk|wood/i.test(mat.name||'') && pt.leafy !== false) { const key = mat.uuid + kind;
      if (!AUMATS.has(key)) { const m2 = mat.clone(); m2.onBeforeCompile = mat.onBeforeCompile; m2.customProgramCacheKey = mat.customProgramCacheKey; m2.map = autumnTex(mat.map, kind); AUMATS.set(key, m2); }
      mat = AUMATS.get(key); }
    const m = new THREE.Mesh(pt.geo, mat); m.applyMatrix4(pt.local); m.castShadow = m.receiveShadow = true; tree.add(m); });
  tree.scale.setScalar(k); tree.rotation.y = rot; g.add(tree); return tree;
}

/* ── little procedural bits ── */
function leafPile(acc, rng, n, rad, cx=0, cz=0, y=.012){
  for (let i=0;i<n;i++){ const a = rng()*6.28, d = rad*Math.sqrt(rng());
    acc.add(new THREE.CircleGeometry(.045, 5).rotateX(-Math.PI/2).scale(1, 1, .6), leafMat[Math.floor(rng()*4)], at(cx + Math.cos(a)*d, y + rng()*.006, cz + Math.sin(a)*d, rng()*6.28)); }
}
function pumpkinGeo(r, ribs=10, sy=.78){
  const g = new THREE.SphereGeometry(r, 20, 12), p = g.attributes.position, v = new THREE.Vector3();
  for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p, i); const phi = Math.atan2(v.z, v.x), k = 1 + .075*Math.cos(phi*ribs);
    const top = v.y / r; const dimple = 1 - .22*Math.pow(Math.max(0, Math.abs(top)), 6);
    p.setXYZ(i, v.x*k, v.y*sy*dimple, v.z*k); }
  g.computeVertexNormals(); return g;
}
function pumpkin(acc, x, y, z, r, rng, mat=MAT.pumpkin){
  acc.add(pumpkinGeo(r), mat, at(x, y + r*.74, z, rng ? rng()*6 : 0));
  seg(acc, MAT.stem, V3(x, y + r*1.4, z), V3(.25, 1, .1), r*.42, r*.12, r*.08, 5);
}
function vineCurl(acc, rng, cx, cz, len, a0){
  let p = V3(cx, .08, cz), a = a0;
  for (let i=0;i<5;i++){ const d = V3(Math.cos(a), 0, Math.sin(a)); seg(acc, MAT.vine, p, d, len/5, .014, .012, 4); p = p.clone().addScaledVector(d, len/5); a += (rng()-.5)*1.3; }
  return p;
}
function leafClump(acc, rng, x, z, s=1, y=.08){
  for (let i=0;i<3;i++){ const a = rng()*6.28;
    acc.add(new THREE.CircleGeometry(.075*s, 6).rotateX(-Math.PI/2), i%2 ? MAT.leaf : MAT.leafD, at(x + Math.cos(a)*.04*s, y + .02 + i*.012, z + Math.sin(a)*.04*s, rng()*6, 1, 1, 1, (rng()-.5)*.6, (rng()-.5)*.6)); }
}

/* PUMPKIN PATCH (Sudoku/Math): soil bed that grows vine → flowers → small pumpkins → big pumpkins → a glowing carved giant */
function fillPatch(host, s, stage){
  host.clear(); const acc = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 11), gold = s.variety === 'gold';
  const pm = gold ? 'kk_pumpkin_yellow' : 'kk_pumpkin_orange';
  if (stage <= 1) { for (const [x,z] of [[-.22,-.2],[.2,-.18],[0,.05],[-.2,.24],[.22,.22]]) { seg(acc, MAT.vine, V3(x, .07, z), V3(0,1,0), .06, .012, .01, 4); leafClump(acc, r, x, z, .8, .1); } }
  else {
    const ends = [];
    for (let i=0;i<4;i++){ ends.push(vineCurl(acc, r, (r()-.5)*.2, (r()-.5)*.2, .34 + stage*.04, i*1.57 + r()*.6)); }
    for (let i=0;i<5 + stage*2;i++){ leafClump(acc, r, (r()-.5)*.72, (r()-.5)*.72, .85 + r()*.3 + stage*.04); }
    if (stage === 2) for (const e of ends) acc.add(new THREE.ConeGeometry(.035, .05, 5).rotateX(Math.PI), MAT.bloom, at(e.x, .13, e.z));
  }
  acc.into(host);
  if (stage === 3) [[-.2,-.15],[.18,.12],[-.05,.26],[.24,-.2]].forEach(([x,z],i) => km(host, pm + '_small', .12 + r()*.03, .2, x, .06, z, r()*6));
  if (stage === 4) [[-.2,-.16],[.2,.14],[-.12,.24],[.24,-.2]].forEach(([x,z],i) => km(host, i%2 ? pm : pm + '_small', i%2 ? .22 : .15, .32, x, .06, z, r()*6));
  if (stage >= 5) {
    [[-.26,-.22],[.26,-.2],[-.26,.24]].forEach(([x,z],i) => km(host, i ? pm : pm + '_small', i ? .22 : .15, .3, x, .06, z, r()*6));
    km(host, pm + '_jackolantern', .38, .52, .1, .06, .1, Math.PI/4);
    glowSprite(host, V3(.26, .22, .26), .55, 0xFFB050, .6);
  }
  host.userData.stage = stage;
}

/* APPLE-BOBBING BARREL (Breathe) */
function buildBarrel(g){
  const acc = new Acc(), r = rngFrom(5);
  for (let i=0;i<14;i++){ const a = i/14*Math.PI*2; acc.add(new THREE.BoxGeometry(.1, .38, .04), i%2 ? MAT.wood : MAT.woodL, at(Math.cos(a)*.25, .19, Math.sin(a)*.25, -a + Math.PI/2)); }
  acc.add(new THREE.CylinderGeometry(.25, .25, .02, 20), MAT.woodD, at(0, .01, 0));
  for (const y of [.07, .31]) acc.add(new THREE.TorusGeometry(.27, .014, 5, 24).rotateX(Math.PI/2), MAT.iron, at(0, y, 0));
  acc.add(new THREE.CylinderGeometry(.24, .24, .01, 20), MAT.water, at(0, .33, 0));
  [[.08,.05,0],[-.09,.07,1],[.02,-.11,0],[-.05,-.03,0],[.12,-.08,1]].forEach(([x,z,gr]) => acc.add(new THREE.SphereGeometry(.05, 10, 8), gr ? MAT.appleG : MAT.apple, at(x, .345, z, 0, 1, .9, 1)));
  leafPile(acc, r, 14, .42);
  acc.add(new THREE.CylinderGeometry(.06, .05, .09, 10), MAT.woodL, at(.33, .045, .22));
  acc.add(new THREE.SphereGeometry(.045, 10, 8), MAT.apple, at(.33, .1, .22));
  acc.into(g);
  km(g, 'kk_pumpkin_orange_small', .12, .2, -.33, 0, .25, 1);
}
/* MISTY POND (Breathe): stone rim, water, lily pads, soft mist puffs */
function buildPond(g, big){
  const acc = new Acc(), r = rngFrom(big ? 77 : 41), R = big ? .42 : .36;
  acc.add(new THREE.CylinderGeometry(R + .04, R + .06, .04, 28), MAT.stoneD, at(0, .02, 0, 0, 1.08, 1, .92));
  acc.add(new THREE.CylinderGeometry(R, R, .02, 28), MAT.water, at(0, .045, 0, 0, 1.08, 1, .92));
  for (let i=0;i<18;i++){ const a = i/18*6.28; acc.add(new THREE.DodecahedronGeometry(.05, 0), i%3 ? MAT.stone : MAT.stoneD, at(Math.cos(a)*R*1.1, .05, Math.sin(a)*R*.97, r()*6, 1 + r()*.4, .6, 1)); }
  [[-.14,.06],[.12,-.12],[.16,.14]].forEach(([x,z]) => acc.add(new THREE.CylinderGeometry(.055, .055, .01, 12), MAT.lily, at(x, .058, z)));
  acc.add(new THREE.SphereGeometry(.018, 8, 6), MAT.pink, at(.12, .07, -.12));
  leafPile(acc, r, 8, .46);
  acc.into(g);
  const mist = new THREE.Group(), ma = new Acc();
  [[-.18,.12,.12],[.1,-.05,.1],[.22,.2,.08],[-.05,-.22,.09]].forEach(([x,z,s]) => blob(ma, MAT.mist, V3(x, .12, z), s, .45, 1));
  ma.into(mist); mist.children.forEach(m => { m.castShadow = false; m.receiveShadow = false; }); mist.userData.ghostHide = true; g.add(mist);
  if (big) { km(g, 'kk_pumpkin_yellow_jackolantern', .16, .22, -.4, 0, .36, .8); glowSprite(g, V3(-.4, .1, .36), .35, 0xFFB050, .5); }
  else km(g, 'kk_candle_triple', .12, .14, .36, 0, -.3, 0);
}
/* WITCH-HAT COTTAGE (Reading): round cream cottage, tall crooked purple cone roof, glowing windows */
function buildWitchHouse(g){
  const acc = new Acc();
  acc.add(new THREE.CylinderGeometry(.3, .33, .42, 12), MAT.wall, at(0, .21, 0));
  acc.add(new THREE.CylinderGeometry(.34, .34, .04, 12), MAT.wallD, at(0, .02, 0));
  acc.add(new THREE.CylinderGeometry(.46, .46, .03, 16), MAT.hatD, at(0, .44, 0));     // brim
  // crooked cone: stacked frusta, each nudged sideways
  let y = .45, rad = .36, x = 0, z = 0; const H = [.16, .15, .14, .13, .12];
  H.forEach((h, i) => { const r1 = rad*.72; acc.add(new THREE.CylinderGeometry(r1, rad, h, 12), i === 1 ? MAT.hatBand : MAT.hat, at(x, y + h/2, z));
    y += h; rad = r1; x += .025*i; z -= .012*i; });
  acc.add(new THREE.ConeGeometry(rad, .12, 12), MAT.hat, at(x + .03, y + .05, z, 0, 1, 1, 1, 0, -.35));
  // door + windows face +z/+x (the camera side)
  acc.add(new THREE.BoxGeometry(.14, .22, .03), MAT.woodD, at(.1, .11, .29, .35));
  acc.add(new THREE.SphereGeometry(.05, 10, 8), MAT.window, at(-.2, .27, .21, -.8, 1, 1, .35));
  acc.add(new THREE.SphereGeometry(.05, 10, 8), MAT.window, at(.29, .27, -.06, 1.35, 1, 1, .35));
  seg(acc, MAT.stoneD, V3(-.18, .3, -.14), _up, .38, .045, .04, 6);   // chimney
  acc.into(g);
  km(g, 'kk_pumpkin_orange_jackolantern', .14, .2, .3, 0, .36, .6);
  km(g, 'kn_candle_multiple', .1, .14, -.1, 0, .38, 0);
}
/* SCARECROW (To-dos) */
function buildScarecrow(g){
  const acc = new Acc(), r = rngFrom(8);
  seg(acc, MAT.woodD, V3(0, 0, 0), _up, .62, .02, .018, 6);
  acc.add(new THREE.BoxGeometry(.5, .03, .03), MAT.woodD, at(0, .44, 0, .7));
  acc.add(new THREE.CylinderGeometry(.09, .12, .24, 7), MAT.clothB, at(0, .38, 0, .7));
  for (const s of [-1, 1]) acc.add(new THREE.CylinderGeometry(.035, .05, .2, 6).rotateZ(Math.PI/2), MAT.cloth, at(Math.cos(.7)*s*.14, .44, -Math.sin(.7)*s*.14, .7));
  for (const s of [-1, 1]) acc.add(new THREE.ConeGeometry(.04, .07, 5), MAT.straw, at(Math.cos(.7)*s*.27, .44, -Math.sin(.7)*s*.27, .7, 1, 1, 1, 0, s*Math.PI/2));
  acc.add(new THREE.SphereGeometry(.085, 12, 10), MAT.straw, at(0, .58, 0));
  acc.add(new THREE.CylinderGeometry(.16, .16, .015, 14), MAT.strawD, at(0, .64, 0));
  acc.add(new THREE.CylinderGeometry(.07, .085, .09, 12), MAT.strawD, at(0, .69, 0));
  acc.add(new THREE.CylinderGeometry(.087, .087, .02, 12), MAT.cloth, at(0, .665, 0));
  for (const s of [-1, 1]) acc.add(new THREE.SphereGeometry(.013, 6, 5), MAT.pupil, at(Math.cos(.7)*s*.03 + .05, .6, -Math.sin(.7)*s*.03 + .06));
  leafPile(acc, r, 12, .38);
  acc.into(g);
  km(g, 'kk_pumpkin_yellow_small', .1, .16, .26, 0, .2, 1);
  km(g, 'kn_hay_bale', .14, .26, -.24, 0, .2, .4);
}
/* CANDY BASKET (To-dos) */
function buildCandy(g){
  const acc = new Acc(), r = rngFrom(21);
  acc.add(new THREE.CylinderGeometry(.2, .15, .16, 14, 1, true), MAT.basket, at(0, .08, 0));
  acc.add(new THREE.CylinderGeometry(.15, .15, .01, 14), MAT.basketD, at(0, .005, 0));
  acc.add(new THREE.TorusGeometry(.2, .016, 5, 20).rotateX(Math.PI/2), MAT.basketD, at(0, .16, 0));
  acc.add(new THREE.TorusGeometry(.19, .014, 5, 20, Math.PI), MAT.basketD, at(0, .16, 0, .7));
  for (let i=0;i<14;i++){ const a = r()*6.28, d = r()*.14;
    acc.add(new THREE.SphereGeometry(.035, 8, 6), MAT.candy[i%5], at(Math.cos(a)*d, .16 + r()*.03, Math.sin(a)*d, r()*6, 1.3, .8, .9)); }
  for (let i=0;i<5;i++){ const a = r()*6.28, d = .26 + r()*.14; acc.add(new THREE.SphereGeometry(.03, 8, 6), MAT.candy[(i+2)%5], at(Math.cos(a)*d, .025, Math.sin(a)*d, r()*6, 1.4, .7, .9)); }
  leafPile(acc, r, 10, .42);
  acc.into(g);
  km(g, 'kk_pumpkin_orange_small', .12, .2, -.26, 0, -.2, 2);
}

/* PUMPKIN CARRIAGE (Gita): a prize pumpkin turned into a coach, gold wheels, warm windows, lanterns on the corners */
function buildCarriage(g){
  const acc = new Acc(), r = rngFrom(99), rot = Math.PI/4;
  const P = (x, y, z) => V3(x*Math.cos(rot) + z*Math.sin(rot), y, -x*Math.sin(rot) + z*Math.cos(rot));   // carriage axis → world
  // cobbled round base with leaves
  acc.add(new THREE.CylinderGeometry(.86, .9, .05, 32), MAT.cobD, at(0, .025, 0));
  acc.add(new THREE.CylinderGeometry(.8, .8, .02, 32), MAT.cob, at(0, .055, 0));
  leafPile(acc, r, 26, .82, 0, 0, .07);
  // body
  const bodyY = .72;
  const body = new THREE.Mesh(pumpkinGeo(.5, 12, .82), MAT.pumpkin); body.position.y = bodyY; body.rotation.y = rot; body.scale.set(1.12, 1, .96);
  body.castShadow = body.receiveShadow = true; g.add(body);   // its own mesh: smooth normals (Acc re-computes them faceted)
  // door + windows (on the side facing the camera: +x/+z)
  const side = P(0, 0, .47); const face = rot;
  acc.add(new THREE.BoxGeometry(.26, .36, .03), MAT.pumpkinD, at(side.x, bodyY - .02, side.z, face));
  acc.add(new THREE.TorusGeometry(.15, .018, 5, 20), MAT.gold, at(side.x, bodyY + .06, side.z, face));
  acc.add(new THREE.CircleGeometry(.12, 16), MAT.window, at(side.x*1.02, bodyY + .07, side.z*1.02, face));
  for (const s of [-1, 1]) { const w = P(s*.38, 0, .34); acc.add(new THREE.SphereGeometry(.07, 12, 8), MAT.window, at(w.x, bodyY + .08, w.z, face + s*.7, 1, 1, .4)); }
  // crown + curly stem
  acc.add(new THREE.CylinderGeometry(.1, .14, .07, 8), MAT.gold, at(0, bodyY + .42, 0));
  for (let i=0;i<6;i++){ const a = i/6*6.28; acc.add(new THREE.ConeGeometry(.025, .09, 5), MAT.gold, at(Math.cos(a)*.1, bodyY + .5, Math.sin(a)*.1)); }
  acc.add(new THREE.SphereGeometry(.035, 8, 6), MAT.gold, at(0, bodyY + .52, 0));
  let p = V3(0, bodyY + .52, 0), a = 0;
  for (let i=0;i<7;i++){ const d = V3(Math.cos(a)*.6, 1 - i*.14, Math.sin(a)*.6).normalize(); seg(acc, MAT.vine, p, d, .07, .022 - i*.002, .02 - i*.002, 5); p = p.clone().addScaledVector(d, .07); a += .9; }
  for (let i=0;i<4;i++) leafClump(acc, r, Math.cos(i*1.6)*.2, Math.sin(i*1.6)*.2, 1.3, bodyY + .36);
  // wheels: big at the back, small at the front
  for (const [ax, rr] of [[-.42, .27], [.42, .21]]) for (const s of [-1, 1]) {
    const c = P(ax, 0, s*.5), y = rr + .06;
    const wq = _q.setFromEuler(_E.set(0, rot, 0));
    acc.add(new THREE.TorusGeometry(rr, .03, 6, 26), MAT.gold, _m.compose(V3(c.x, y, c.z), wq, _s));
    for (let k=0;k<6;k++){ const aa = k/6*Math.PI; const sp = new THREE.BoxGeometry(rr*2, .018, .018).rotateZ(aa);
      acc.add(sp, MAT.gold, _m.compose(V3(c.x, y, c.z), wq, _s)); }
    acc.add(new THREE.SphereGeometry(.045, 8, 6), MAT.gold, at(c.x, y, c.z));
  }
  // axles + curly gold trim
  for (const ax of [-.42, .42]) { const a0 = P(ax, 0, -.5), a1 = P(ax, 0, .5); const d = a1.clone().sub(a0);
    seg(acc, MAT.iron, V3(a0.x, ax < 0 ? .33 : .27, a0.z), d, d.length(), .018, .018, 5); }
  acc.into(g);
  // lanterns on the base corners + a pumpkin pile
  for (const s of [-1, 1]) { const q = P(s*.8, 0, .12); km(g, 'kk_lantern_standing', .36, .2, q.x, .06, q.z, rot); glowSprite(g, V3(q.x, .38, q.z), .5, 0xFFB050, .55); }
  const pp = P(-.2, 0, -.72); km(g, 'kk_pumpkin_yellow_small', .13, .2, pp.x, .06, pp.z, 1); km(g, 'kk_pumpkin_orange_small', .15, .22, pp.x + .2, .06, pp.z + .1, 2);
  glowSprite(g, V3(side.x*1.1, bodyY + .07, side.z*1.1), .7, 0xFFC060, .5);
}

/* ── BLUEPRINT: the farm's cells, pumpkin-patch pieces (FARM ids kept so FARM_ORDER fills ring 1, 2, 3 in turn) ── */
const B = (name, b, extra = {}) => ({ cat:'building', gate:'lesson', name, b, ...extra });
const W = (name, b, extra = {}) => ({ cat:'water', gate:'breathe', name, b, ...extra });
const T = (name, b, extra = {}) => ({ cat:'tree', gate:'vocab', name, b, ...extra });
const P = (name, b, extra = {}) => ({ cat:'path', gate:'todos', name, b, ...extra });
const MAP = {
  bigbarn:B('Harvest barn', 'bigbarn'), well:W('Apple barrel', 'barrel'), apple1:T('Maple tree', 'maple', { tint:'orange', model:'CommonTree_1', rot:20 }),
  path3_4:P('Lantern path', 'lanternpath', { v:0 }),
  silo:B('Witch-hat cottage', 'witch'), silohouse:B('Cosy cottage', 'village', { model:'building_home_A_red', rot:200, fit:[1.05, .95] }),
  coop:B('Lantern shop', 'shop'), watertower:W('Old well', 'well'), pump:W('Misty pond', 'pond'),
  apple2:T('Golden oak', 'maple', { tint:'gold', model:'CommonTree_2', rot:140 }), berry1:T('Autumn pine', 'pine', { model:'kk_tree_pine_orange_large', h:1.3 }),
  peepal:{ cat:'special', gate:'gita', name:'Pumpkin carriage', b:'carriage' },
  smallbarn:B('Red barn', 'smallbarn'), openbarn:B('Hay shed', 'hayshed'), pond:W('Moonlit pond', 'pond', { big:true }),
  orange1:T('Red maple', 'maple', { tint:'red', model:'CommonTree_3', rot:0 }), apple3:T('Larch', 'pine', { model:'kk_tree_pine_yellow_large', h:1.35 }),
  berry2:T('Fall fir', 'pine', { model:'kn_pine_fall', h:1.2, kn:true }), orange2:T('Maple tree', 'maple', { tint:'orange', model:'CommonTree_5', rot:200 }),
  apple4:T('Autumn pine', 'pine', { model:'kk_tree_pine_orange_medium', h:1.1 }),
  path1_2:P('Hay bales', 'hay'), path5_2:P('Lantern path', 'lanternpath', { v:1 }), path3_5:P('Stone path', 'lanternpath', { v:2 }),
  path3_6:P('Scarecrow', 'scarecrow'), path2_6:P('Candy basket', 'candy'), path3_0:P('Lamp post', 'lamppost'),
};
export const SLOTS = FARM.map(f => {
  const cell = { id:f.id, x:f.x, z:f.z, ...(f.w ? { w:f.w, d:f.d } : {}), ...(f.edge ? { edge:f.edge, len:f.len } : {}) };
  if (f.kind === 'field') { const gold = f.gate === 'mathtricks'; return { ...cell, cat:'crop', gate:f.gate, name: gold ? 'Gourd patch' : 'Pumpkin patch', b:'patch', kind:'field', stages:5, variety: gold ? 'gold' : 'orange' }; }
  if (f.kind === 'fence') return { ...cell, cat:'path', gate:'todos', name:'Picket fence', b:'fence' };
  return { ...cell, ...MAP[f.id] };
});

/* ── ground: warm ochre grass with leaf litter ── */
const AUTUMN_TILE = { top:['#D3B96A','#CCB163'], side:'#BFA256', soilTop:'#8E6039', soilBot:'#4E3222' };
function autumnTileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(31);
  g.fillStyle = '#F1EEE6'; g.fillRect(0,0,N,N);
  for (let i=0;i<12;i++){ const x=r()*N, y=r()*N, rad=18+r()*40, gr=g.createRadialGradient(x,y,0,x,y,rad);
    gr.addColorStop(0, r()<.5 ? 'rgba(255,250,235,.4)' : 'rgba(210,150,90,.16)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,N,N); }
  g.lineCap = 'round';
  for (let i=0;i<170;i++){ const x=r()*N, y=r()*N, len=4+r()*6, a=-Math.PI/2 + (r()-.5)*.9;
    g.strokeStyle = r()<.55 ? 'rgba(110,100,40,.13)' : 'rgba(255,252,238,.75)'; g.lineWidth = 1.4 + r();
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*len, y+Math.sin(a)*len); g.stroke(); }
  const LEAF = ['rgba(236,120,50,.55)','rgba(214,72,46,.5)','rgba(240,176,60,.55)','rgba(170,90,45,.45)'];
  for (let i=0;i<38;i++){ const x=r()*N, y=r()*N, s=3.5+r()*3.5; g.save(); g.translate(x,y); g.rotate(r()*6.28); g.fillStyle = LEAF[Math.floor(r()*4)];
    g.beginPath(); g.moveTo(-s,0); g.quadraticCurveTo(0,-s*.75,s,0); g.quadraticCurveTo(0,s*.75,-s,0); g.fill(); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ── ambient life: drifting leaves by day, fireflies at night ── */
const leafGeo = new THREE.PlaneGeometry(.075, .05);
function addDrift(){
  V.drift = []; const r = rngFrom(5);
  for (let i=0;i<7;i++){ const m = new THREE.Mesh(leafGeo, leafMat[i%4]); m.castShadow = true;
    m.userData = { ph:i/7, x:(r()-.5)*V.L*.8, z:(r()-.5)*V.L*.8, sp:.06 + r()*.03, sw:.25 + r()*.2, h:1.7 + r()*.8 };
    world.add(m); V.drift.push(m); V.life.push(m); }
  V.flies = [];
  const fm = new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFE27A, transparent:true, opacity:.9, blending:THREE.AdditiveBlending, depthWrite:false });
  for (let i=0;i<9;i++){ const s = new THREE.Sprite(fm); s.scale.setScalar(.16); s.renderOrder = 9;
    s.userData = { ph:i*.9, cx:(r()-.5)*V.L*.7, cz:(r()-.5)*V.L*.7, h:.35 + r()*.6 }; world.add(s); V.flies.push(s); V.life.push(s); }
  drift(2.1);
}
function drift(t){
  (V && V.drift || []).forEach(m => { const u = m.userData, k = (t*u.sp + u.ph) % 1;
    m.position.set(u.x + Math.sin(t*u.sw*3 + u.ph*9)*.35, TILE_TOP + u.h*(1 - k), u.z + Math.cos(t*u.sw*2 + u.ph*5)*.25 + k*.4);
    m.rotation.set(t*1.3 + u.ph*6, t*.7, Math.sin(t*2 + u.ph)*.8); m.visible = k < .96; });
  (V && V.flies || []).forEach(s => { const u = s.userData; s.visible = !!S.night;
    s.position.set(u.cx + Math.sin(t*.5 + u.ph)*.4, TILE_TOP + u.h + Math.sin(t*1.3 + u.ph*2)*.12, u.cz + Math.cos(t*.4 + u.ph*1.3)*.4);
    s.material.opacity = .55 + .4*Math.sin(t*3 + u.ph*4); });
}

/* ── residents: a black cat, an owl on the barn, three bats, two crows ── */
function makeCat(){ const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.1, 12, 10), MAT.cat, at(0, .1, 0, 0, .85, 1.1, 1));                 // sitting body
  a.add(new THREE.SphereGeometry(.075, 12, 10), MAT.cat, at(0, .23, .03));                            // head
  for (const s of [-1, 1]) { a.add(new THREE.ConeGeometry(.03, .06, 4), MAT.cat, at(s*.045, .3, .02, 0, 1, 1, .7, 0, -s*.25));
    a.add(new THREE.ConeGeometry(.016, .035, 4), MAT.pink, at(s*.045, .296, .028, 0, 1, 1, .5, 0, -s*.25));
    a.add(new THREE.SphereGeometry(.02, 10, 8), MAT.eye, at(s*.03, .24, .095, 0, 1, 1.15, .6));
    a.add(new THREE.SphereGeometry(.008, 6, 5), MAT.pupil, at(s*.03, .24, .106, 0, .6, 1.5, .5));
    a.add(new THREE.SphereGeometry(.03, 8, 6), MAT.catD, at(s*.045, .02, .07, 0, 1, .7, 1.3)); }
  a.add(new THREE.SphereGeometry(.009, 6, 5), MAT.pink, at(0, .222, .104));
  a.into(g);
  const tail = new THREE.Group(), ta = new Acc(); let p = V3(0, 0, 0), dir = V3(0, .2, -1);
  for (let i=0;i<6;i++){ const d = dir.clone().normalize(); seg(ta, MAT.cat, p, d, .04, .018, .016, 5); p = p.clone().addScaledVector(d, .04); dir.y += .45; dir.x += .12; }
  ta.into(tail); tail.position.set(0, .04, -.08); g.add(tail); g.userData.tail = tail; return g; }
function makeOwl(){ const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.09, 12, 10), MAT.owl, at(0, .1, 0, 0, 1, 1.2, .95));
  a.add(new THREE.SphereGeometry(.07, 12, 10), MAT.owlL, at(0, .09, .03, 0, .9, 1.1, .8));
  a.add(new THREE.SphereGeometry(.075, 12, 10), MAT.owl, at(0, .21, 0));
  for (const s of [-1, 1]) { a.add(new THREE.CylinderGeometry(.034, .034, .01, 14).rotateX(Math.PI/2), MAT.owlL, at(s*.033, .215, .066));
    a.add(new THREE.SphereGeometry(.018, 10, 8), MAT.eye, at(s*.033, .216, .07, 0, 1, 1, .5)); a.add(new THREE.SphereGeometry(.009, 6, 5), MAT.pupil, at(s*.033, .216, .078));
    a.add(new THREE.ConeGeometry(.02, .05, 4), MAT.owlD, at(s*.05, .285, 0, 0, 1, 1, 1, 0, -s*.3));
    a.add(new THREE.SphereGeometry(.05, 8, 6), MAT.owlD, at(s*.08, .1, -.01, 0, .35, 1, .8)); }
  a.add(new THREE.ConeGeometry(.012, .03, 4).rotateX(Math.PI), MAT.beak, at(0, .19, .08));
  a.into(g); return g; }
function makeBat(){ const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.05, 10, 8), MAT.bat, at(0, 0, 0, 0, .9, 1, 1.2));
  for (const s of [-1, 1]) { a.add(new THREE.ConeGeometry(.018, .04, 4), MAT.bat, at(s*.022, .055, .03, 0, 1, 1, 1, 0, -s*.2));
    a.add(new THREE.SphereGeometry(.01, 6, 5), MAT.white, at(s*.018, .015, .055)); a.add(new THREE.SphereGeometry(.005, 5, 4), MAT.pupil, at(s*.018, .015, .064)); }
  a.into(g);
  const sh = new THREE.Shape(); sh.moveTo(0, .02); sh.lineTo(.2, .05); sh.lineTo(.17, -.01); sh.lineTo(.12, 0); sh.lineTo(.09, -.03); sh.lineTo(.05, -.01); sh.lineTo(0, -.03);
  const wg = new THREE.ShapeGeometry(sh).rotateX(-Math.PI/2);
  const w1 = new THREE.Mesh(wg, MAT.batW), w2 = new THREE.Mesh(wg, MAT.batW); w2.scale.x = -1; w1.castShadow = w2.castShadow = true; g.add(w1, w2); g.userData.wings = [w1, w2]; return g; }
function makeCrow(){ const g = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.06, 10, 8), MAT.crow, at(0, .08, 0, 0, .85, .85, 1.35));
  a.add(new THREE.SphereGeometry(.042, 10, 8), MAT.crow, at(0, .14, .07));
  a.add(new THREE.ConeGeometry(.014, .05, 4).rotateX(Math.PI/2), MAT.beak, at(0, .135, .125));
  for (const s of [-1, 1]) { a.add(new THREE.SphereGeometry(.009, 6, 5), MAT.white, at(s*.025, .15, .1)); a.add(new THREE.SphereGeometry(.005, 5, 4), MAT.pupil, at(s*.027, .15, .106));
    seg(a, MAT.beak, V3(s*.02, 0, 0), _up, .045, .005, .005, 4);
    a.add(new THREE.SphereGeometry(.04, 8, 6), MAT.crowD, at(s*.045, .085, -.01, 0, .35, .8, 1.3)); }
  a.add(new THREE.BoxGeometry(.06, .01, .08), MAT.crowD, at(0, .07, -.1, 0, 1, 1, 1, .4));
  a.into(g); return g; }

const RES_SCALE = 1.5;
function residentPlan(){
  const top = V.boxOf && V.boxOf.bigbarn ? V.boxOf.bigbarn.max.y : 1.3, bp = cellPos(3, 3);
  return {
    cat:{ at:cellPos(3.05, 4.45), face:.6 },
    owl:{ at:V3(bp.x - .45, top - .06, bp.z - .35), face:.7 },
    bats:[0, 1, 2].map(i => ({ cx:-.4, cz:-.5, r:1.5 + i*.4, h:1.9 + i*.25, sp:.38 + i*.06, ph:i*2.1 })),
    crows:[[1.2, 5.25, .9], [5.2, 2.35, -.4]].map(([x,z,f]) => ({ at:cellPos(x, z), face:f }))
  };
}
function batPos(u, t, out){ const a = t*u.sp + u.ph; return out.set(u.cx + Math.cos(a)*u.r, TILE_TOP + u.h + Math.sin(a*2.3)*.12, u.cz + Math.sin(a)*u.r*.8); }
function addResident(kind, obj, u){ const r = { kind, obj, u, arrive:1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; }
function moveResidents(t){
  (V && V.res || []).forEach(r => { const u = r.u, e = 1 - Math.pow(1 - r.arrive, 3);
    if (r.kind === 'bat') { const p = batPos(u, t, V3(0,0,0)), q = batPos(u, t + .05, V3(0,0,0));
      if (e < 1) p.lerpVectors(p.clone().add(V3(4, 2.5, -3)), p, e);
      r.obj.position.copy(p); r.obj.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
      const f = Math.sin(t*11 + u.ph)*.7; r.obj.userData.wings[0].rotation.z = f; r.obj.userData.wings[1].rotation.z = -f; }
    else if (r.kind === 'cat') { r.obj.position.set(u.at.x + (1 - e)*1.6, TILE_TOP, u.at.z + (1 - e)*2.2);
      r.obj.userData.tail.rotation.y = Math.sin(t*1.6)*.5; r.obj.userData.tail.rotation.x = Math.sin(t*.9)*.12; }
    else if (r.kind === 'owl') { r.obj.position.copy(u.at).add(V3((1 - e)*2.2, (1 - e)*1.6, (1 - e)*-.8));
      r.obj.rotation.y = u.face + (e < 1 ? 0 : Math.sin(t*.45)*.55); }
    else if (r.kind === 'crow') { const hop = Math.max(0, Math.sin(t*2.2 + u.ph*3)); r.obj.position.set(u.at.x + (1 - e)*-1.4, TILE_TOP + hop*hop*.05 + (1 - e)*.8, u.at.z + (1 - e)*.6);
      r.obj.rotation.x = Math.max(0, Math.sin(t*1.1 + u.ph))*.35; }
  });
}
function spawnGroup(i, plan){
  if (i === 0) { const o = makeCat(); o.scale.setScalar(RES_SCALE); o.rotation.y = plan.cat.face; return [addResident('cat', o, plan.cat)]; }
  if (i === 1) { const o = makeOwl(); o.scale.setScalar(RES_SCALE); o.rotation.y = plan.owl.face; return [addResident('owl', o, plan.owl)]; }
  if (i === 2) return plan.crows.map((c, j) => { const o = makeCrow(); o.scale.setScalar(RES_SCALE); o.rotation.y = c.face; return addResident('crow', o, { ...c, ph:j*1.7 }); });
  return plan.bats.map(u => { const o = makeBat(); o.scale.setScalar(RES_SCALE); return addResident('bat', o, u); });
}
let _t = 2.1;
async function halloweenMoveIn(walk){
  const plan = residentPlan(); V.residentsIn = true; V.res = [];
  for (const p of plan.bats) V.framePts.push(V3(p.cx + p.r*.7, TILE_TOP + p.h, p.cz + p.r*.5));
  for (let i=0;i<4;i++){
    const rs = spawnGroup(i, plan);
    if (!walk) { rs.forEach(r => r.arrive = 1); continue; }
    rs.forEach(r => r.arrive = 0); moveResidents(_t);
    await new Promise(res => tween(S.rm ? 1 : 1500, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.15 - j*.06))),
      () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone().setY(rs[0].obj.position.y + .4), 10, 0xFFE08A, .6); res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  moveResidents(_t); V.arrived = 4;
}
const makeRes = id => id === 'cat' ? makeCat() : id === 'owl' ? makeOwl() : id === 'crow' ? makeCrow() : makeBat();

/* ── pieces ── */
const BUILD = {
  bigbarn(g){ addModel(g, 'BigBarn', .215*1.14, 0, 0, 0, 0, 'farm');
    km(g, 'kn_hay_bale', .16, .3, .78, 0, .55, .3); km(g, 'kk_pumpkin_orange', .2, .26, .55, 0, .82, .5); km(g, 'kk_pumpkin_yellow_small', .12, .18, .8, 0, .85, 1.3); },
  smallbarn(g){ addModel(g, 'SmallBarn', .15*1.3, 0, 0, 0, 0, 'farm'); km(g, 'kk_pumpkin_orange_small', .12, .18, .36, 0, .38, 1); },
  hayshed(g){ addModel(g, 'OpenBarn', .15*1.3, 0, 0, 0, 0, 'farm'); km(g, 'kn_hay_bale_bundled', .16, .26, .32, 0, .36, .4); },
  well(g){ addModel(g, 'Well', .28*1.3, 0, 0, 0, -30*Math.PI/180, 'farm'); const a = new Acc(); leafPile(a, rngFrom(3), 10, .45); a.into(g); km(g, 'kk_pumpkin_yellow_small', .1, .16, .34, 0, .3, 0); },
  village(g, s){ const t = tplOf(s.model, 'village'); if (!t) return; addModel(g, s.model, fitScale(t, s.fit[0], s.fit[1]), 0, 0, 0, s.rot*Math.PI/180, 'village');
    km(g, 'kk_pumpkin_orange_jackolantern', .14, .2, .34, 0, .38, .7); },
  shop(g){ const t = tplOf('stall_red', 'village'); if (t) addModel(g, 'stall_red', fitScale(t, .8, .95), 0, 0, -.04, Math.PI*.95 + .6, 'village');
    km(g, 'kk_lantern_hanging', .22, .14, .2, .5, .25, 0); km(g, 'kk_lantern_hanging', .22, .14, -.12, .5, .32, 0);
    glowSprite(g, V3(.2, .56, .25), .35, 0xFFB050, .5); glowSprite(g, V3(-.12, .56, .32), .35, 0xFFB050, .5);
    km(g, 'kk_pumpkin_yellow_jackolantern', .14, .2, .36, 0, -.3, .4); km(g, 'kn_lantern_candle', .14, .12, -.36, 0, .36, 0); },
  barrel:buildBarrel, witch:buildWitchHouse, scarecrow:buildScarecrow, candy:buildCandy, carriage:buildCarriage,
  pond(g, s){ buildPond(g, !!s.big); },
  maple(g, s){ autumnTree(g, s.model, s.tint, 1.35, 1.05, (s.rot||0)*Math.PI/180); const a = new Acc(); leafPile(a, rngFrom(s.x*5 + s.z), 16, .44); a.into(g); },
  pine(g, s){ km(g, s.model, s.h, .95, 0, 0, 0, (s.x + s.z)*.7); const a = new Acc(); leafPile(a, rngFrom(s.x*5 + s.z*3), 10, .42); a.into(g); },
  hay(g){ km(g, 'kn_hay_bale', .2, .44, -.12, 0, -.08, .3); km(g, 'kn_hay_bale', .2, .44, .2, 0, .2, -.2); km(g, 'kn_hay_bale_bundled', .18, .3, -.2, .2, -.1, .5);
    km(g, 'kk_pumpkin_orange_small', .12, .18, .28, 0, -.26, 1); },
  lamppost(g){ const a = new Acc(); leafPile(a, rngFrom(4), 12, .4); a.into(g); km(g, 'kn_lightpost_single', .62, .3, 0, 0, 0, .4);
    km(g, 'kk_pumpkin_orange_small', .12, .18, .22, 0, .2, 0); km(g, 'kk_pumpkin_yellow_small', .1, .16, -.2, 0, .24, 1); },
  lanternpath(g, s){
    const slab = new THREE.Mesh(G.path, M.sand); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
    const r = rngFrom(s.x*13 + s.z*29);
    [[-.2,-.18],[.18,-.2],[-.16,.2],[.21,.17]].forEach(([x,z]) => { const st = new THREE.Mesh(G.step, M.stone);
      st.position.set(x + (r()-.5)*.08, .045, z + (r()-.5)*.08); st.rotation.y = r()*3; st.scale.set(1 + r()*.25, 1, .85 + r()*.3); st.castShadow = st.receiveShadow = true; g.add(st); });
    const a = new Acc(); leafPile(a, r, 9, .45, 0, 0, .04); a.into(g);
    if (s.v === 0) { km(g, 'kk_lantern_standing', .3, .16, .36, 0, -.36, 0); glowSprite(g, V3(.36, .24, -.36), .4, 0xFFB050, .5); }
    if (s.v === 1) { km(g, 'kk_post_lantern', .5, .3, -.36, 0, .36, Math.PI/2); }
    if (s.v === 2) { km(g, 'kn_candle_multiple', .1, .14, .36, 0, .36, 0); }
    g.userData.ghostMode = 'marker';
  },
  fence(g, s){
    for (let i=0;i<s.len;i++){
      if (s.edge === 'w') km(g, 'kn_fence', .26, 1.0, -.45, 0, i - (s.len-1)/2, Math.PI/2);
      else km(g, 'kn_fence', .26, 1.0, i - (s.len-1)/2, 0, .45, 0);
    }
    const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz);
  }
};

export default {
  id:'halloween', name:'Pumpkin patch', title:'Your patch',
  season:9, dates:'5–18 Jan', nextIn:9,
  kits:[HK, 'a', 'farm', 'village'],
  kitDefs:{ [HK]:{ file:'assets/halloween/halloween.glb' } },
  families:{
    water:   { label:'ponds & barrels',        tag:'Water' },
    building:{ label:'barns & cottages',       tag:'Building' },
    path:    { label:'lanterns, hay & fences', tag:'Path' },
    crop:    { label:'pumpkin patches',        tag:'Patch' },
    tree:    { label:'maples & pines',         tag:'Tree' },
    special: { label:'the pumpkin carriage',   tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:AUTUMN_TILE, tileMap:autumnTileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 7c-5.2 0-8 2.9-8 6.6S6.8 20 12 20s8-2.7 8-6.4S17.2 7 12 7z" fill="#F08A2C"/><path d="M12 7c-2 0-3 2.9-3 6.6S10 20 12 20s3-2.7 3-6.4S14 7 12 7z" fill="#D9701E"/><path d="M12 7.4c0-1.8.4-3 1.8-3.8" fill="none" stroke="#5F8B3A" stroke-width="1.9" stroke-linecap="round"/><path d="M13.6 5.4c1.6-.9 3.3-.6 4.2.5-1.7.4-2.8.2-4.2-.5z" fill="#6FAE45"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M64 44c-30 0-46 17-46 38s16 36 46 36 46-15 46-36-16-38-46-38z"/><path d="M60 46c0-12 3-20 12-26l6 5c-7 5-9 12-9 21z"/><path d="M76 28c10-8 22-6 28 2-11 3-19 2-28-2z"/></g>',
  album:{ image:'assets/halloween/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#F6E6CF)' },
  css:'.phone[data-theme="halloween"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#FBF0DE 58%,#F2DDBD 100%)}',

  build(g, s, opt){
    if (s.b === 'patch') {
      const slab = new THREE.Mesh(G.field, M.soil); slab.position.y = .035; slab.castShadow = slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab);
      const host = new THREE.Group(); host.scale.setScalar(1.15); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillPatch(host, s, st);
      fillPatch(host, s, opt.stage ?? cropStage(s.id));
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.b === 'patch' ? 1.15 : ['bigbarn','smallbarn','hayshed','well'].includes(s.b) ? (s.b === 'bigbarn' ? 1.14 : 1.3) : 1,
  contact: s => !['patch', 'lanternpath', 'fence', 'pond'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || ['lanternpath', 'lamppost'].includes(s.b),
  decor(slots){
    meadowDecor(slots, { tuft: r => { const q = r(); return q < .6 ? ['au_grass', 0] : ['au_wispy', 0]; }, flowers:false });
    // leaf litter + the odd tiny pumpkin in the meadow
    const r = rngFrom(61);
    world.children.filter(c => c.userData.decor === 'meadow').forEach(grp => { const [x, z] = grp.userData.cell, p = cellPos(x, z), a = new Acc();
      leafPile(a, r, 7, .42, p.x, p.z, TILE_TOP + .008); a.into(grp);
      if (r() < .22) km(grp, r() < .5 ? 'kk_pumpkin_orange_small' : 'kk_pumpkin_yellow_small', .09, .14, p.x + (r()-.5)*.5, TILE_TOP, p.z + (r()-.5)*.5, r()*6); });
  },
  ambient(){ addDrift(); },
  tick(t){ _t = t; drift(t); moveResidents(t); },
  async preload(){
    // dry autumn tufts: the MegaKit grass re-tinted, registered in the primary kit so meadowDecor can find them
    const K = KITCACHE[HK], A = KITCACHE.a; if (!K || K.au_grass || !A) return;
    const dry = (src, tint) => ({ ...src, parts:src.parts.map(pt => { const m = pt.mat.clone(); m.onBeforeCompile = pt.mat.onBeforeCompile; m.customProgramCacheKey = pt.mat.customProgramCacheKey;
      if (m.map) m.map = autumnTex(pt.mat.map, tint); else m.color.multiply(new THREE.Color(1.1, .85, .45)); return { ...pt, mat:m }; }) });
    K.au_grass = dry(A.Grass_Common_Short, 'gold'); K.au_wispy = dry(A.Grass_Wispy_Short, 'orange');
  },

  residents:[ { id:'cat', name:'Black cat', n:1 }, { id:'owl', name:'Owl', n:1 }, { id:'crow', name:'Crows', n:2 }, { id:'bat', name:'Bats', n:3 } ],
  moveIn: halloweenMoveIn,
  residentThumb(d, thumbFor){ return thumbFor('halloween:' + d.id, () => { const o = makeRes(d.id); o.rotation.y = d.id === 'bat' ? 2.4 : .7; return o; }, 168); },
  residentRig(d){ const obj = makeRes(d.id); obj.scale.setScalar(RES_SCALE); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:0 }; }
};
