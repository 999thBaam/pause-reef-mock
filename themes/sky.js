/* SKY ISLANDS (?theme=sky) — the land floats. The grass block rides on a rocky underside that tapers into a cloud bank, two
   springs gush out of the cliff and fall into cloud puffs, and two little satellite islets hover behind it, joined to the land by
   rope bridges (all in env()). Built on the farm's 7×7 ring blueprint (6 / 15 / 19, same order); the floating temple takes the
   LEFT corner (cells 0..1 × 5..6) so nothing stands in front of it, as in oasis/diwali.
   Everything is procedural three.js merged per material (Acc), so every piece stays pre-renderable, except the trees and the
   meadow tufts, which reuse the shared CC0 Quaternius Stylized Nature MegaKit (kit a). No new asset files. */
import * as THREE from 'three';
import { rngFrom, TEX, addSway, world } from '../engine/scene.js';
import { S, V, placed, cropStage, hooks } from '../engine/state.js';
import { TILE_TOP, cellPos, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, seg, blob, _up } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { meadowDecor } from '../engine/life.js';
import { FARM, FARM_ORDER } from './farm.js';

/* ── materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.86, metalness:0, flatShading:true, ...o });
function stripeTex(cols, n=8){
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  for (let i=0;i<n;i++){ g.fillStyle = cols[i % cols.length]; g.fillRect(i*64/n, 0, 64/n + 1, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const MAT = {
  plaster:FM(0xFBF6EE), plasterD:FM(0xEBE2D2), stone:FM(0xE9E2D6), stoneD:FM(0xC9BFAE), stoneL:FM(0xF7F3EA),
  blue:FM(0x6FA8DC), blueD:FM(0x4E86BF), coral:FM(0xF08A6E), coralD:FM(0xD66B52), lilac:FM(0xB9A3EA), mint:FM(0x8FD8B8),
  wood:FM(0xB57E4C), woodD:FM(0x7F5634), rope:FM(0xDCC596), sail:FM(0xFFF8EC, { side:THREE.DoubleSide }), dark:FM(0x3E4660),
  gold:FM(0xF3C451, { emissive:0x7A5200, emissiveIntensity:.28, roughness:.4, metalness:.3 }), brass:FM(0xE3B34A, { roughness:.45, metalness:.3 }),
  glass:FM(0xFFE2A0, { emissive:0xFFA844, emissiveIntensity:.75 }), flame:FM(0xFFC857, { emissive:0xFF8A1F, emissiveIntensity:1.6 }),
  crystal:new THREE.MeshStandardMaterial({ color:0xFFF1C2, emissive:0xFFC64A, emissiveIntensity:1.1, roughness:.25, flatShading:true }),
  water:new THREE.MeshStandardMaterial({ color:0x7FD3F2, roughness:.15, metalness:0, emissive:0x1C6E95, emissiveIntensity:.32 }),
  jet:new THREE.MeshStandardMaterial({ color:0xE3F7FF, roughness:.2, transparent:true, opacity:.75, emissive:0x7FD3F2, emissiveIntensity:.3, depthWrite:false }),
  rain:new THREE.MeshStandardMaterial({ color:0x9FD8F6, roughness:.25, emissive:0x4FA8DE, emissiveIntensity:.35 }),
  cloud:new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:1, emissive:0xDDE7F7, emissiveIntensity:.22 }),
  cloudP:new THREE.MeshStandardMaterial({ color:0xFFD9E6, roughness:1, emissive:0xF3C6D8, emissiveIntensity:.2 }),
  cloudL:new THREE.MeshStandardMaterial({ color:0xE4DAFF, roughness:1, emissive:0xCFC2F2, emissiveIntensity:.2 }),
  grass:FM(0x9CD064, { roughness:1 }), grassD:FM(0x80B84C, { roughness:1 }), soil:FM(0x9A6A45, { roughness:1, map:TEX.furrow }),
  sprout:FM(0x86C454), leaf:FM(0x6FB041), leafD:FM(0x4F8C34), trunk:FM(0x8C6A4A), pad:FM(0x7CC05A),
  pink:FM(0xF49AB8), yellow:FM(0xF7CF4A), white:FM(0xFFFBF4), red:FM(0xE8606A), rockL:FM(0xCDBFA8), rock:FM(0xA99A86),
  // residents
  whale:FM(0x86AEE6, { flatShading:false, roughness:.7 }), whaleD:FM(0x6A93D2, { flatShading:false, roughness:.7 }), belly:FM(0xEEF4FF, { flatShading:false, roughness:.8 }),
  eye:FM(0x1E2436), cheek:FM(0xF7A8BF, { flatShading:false }), wicker:FM(0xB98A52), bird:FM(0xFFFFFF, { side:THREE.DoubleSide })
};
const BALLOON = [stripeTex(['#F08A6E', '#FFF3E4']), stripeTex(['#6FA8DC', '#FFE38A']), stripeTex(['#B9A3EA', '#9FE3C6'])]
  .map(t => { t.repeat.set(2, 1); return new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.75, map:t, flatShading:true }); });
const AWNING = new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.9, map:stripeTex(['#6FA8DC', '#FFF8EC'], 6), side:THREE.DoubleSide });
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = FM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }

/* falling-water texture: soft vertical streaks, scrolled in tick */
const FALL_TEX = (() => { const W = 64, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = rngFrom(23);
  g.fillStyle = 'rgba(210,240,255,.78)'; g.fillRect(0,0,W,H);
  for (let i=0;i<34;i++){ const x = r()*W, y = r()*H, l = 18 + r()*40; g.strokeStyle = r() < .6 ? 'rgba(255,255,255,.95)' : 'rgba(120,190,235,.55)';
    g.lineWidth = 1.5 + r()*2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + l); g.stroke(); g.beginPath(); g.moveTo(x, y - H); g.lineTo(x, y - H + l); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
const FALL = new THREE.MeshStandardMaterial({ color:0xFFFFFF, map:FALL_TEX, transparent:true, opacity:.92, roughness:.3, emissive:0x9FDCF8, emissiveIntensity:.35,
  side:THREE.DoubleSide, depthWrite:false });

const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=12){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z)); }
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }
function archGeo(w, h, depth=.02){
  const s = new THREE.Shape(), r = w/2; s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled:false, curveSegments:8 });
}
/* door / window on the +z face (face 'z') or the +x face (face 'x') of a box whose half-depth is hd */
const onFace = (face, hd, u, y, off=0) => face === 'z' ? at(u, y, hd + off) : at(hd + off, y, -u, Math.PI/2);
function door(acc, face, hd, u, y, w=.12, h=.2, trim=MAT.woodD){ acc.add(archGeo(w + .04, h + .02, .012), trim, onFace(face, hd, u, y)); acc.add(archGeo(w, h, .016), MAT.wood, onFace(face, hd, u, y, .002)); }
function win(acc, face, hd, u, y, w=.09, h=.1, round=false){
  if (round) { acc.add(new THREE.CylinderGeometry(w/2 + .018, w/2 + .018, .014, 14).rotateX(Math.PI/2), MAT.woodD, onFace(face, hd, u, y, .004));
    acc.add(new THREE.CylinderGeometry(w/2, w/2, .016, 14).rotateX(Math.PI/2), MAT.glass, onFace(face, hd, u, y, .007)); return; }
  acc.add(bx(w + .03, h + .03, .012), MAT.woodD, onFace(face, hd, u, y, .004)); acc.add(bx(w, h, .014), MAT.glass, onFace(face, hd, u, y, .008));
  acc.add(bx(w + .05, .025, .05), MAT.woodD, onFace(face, hd, u, y - h/2 - .02, .02));
}
/* flower box under a window */
function flowerBox(acc, face, hd, u, y, rng){
  acc.add(bx(.12, .035, .045), MAT.wood, onFace(face, hd, u, y, .025));
  for (let i=0;i<4;i++) { const m = face === 'z' ? at(u - .045 + i*.03, y + .035, hd + .025) : at(hd + .025, y + .035, -(u - .045 + i*.03));
    const p = new THREE.Vector3().setFromMatrixPosition(m); blob(acc, [MAT.pink, MAT.yellow, MAT.white, MAT.coral][Math.floor(rng()*4)], p, .016, .9); }
}
/* gable roof: ridge along x, slopes to ±z */
function gable(acc, mat, w, d, rise, x, y, z, ry=0, over=.06){
  const s = new THREE.Shape(), hw = d/2 + over; s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(0, rise); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth:w + 2*over, bevelEnabled:false }).translate(0, 0, -(w + 2*over)/2).rotateY(Math.PI/2);
  acc.add(geo, mat, at(x, y, z, ry));
}
/* cloud puff: a cluster of soft spheres with a flattened underside */
function cloud(acc, x, y, z, s=1, rng=Math.random, mat=MAT.cloud, n=6){
  for (let i=0;i<n;i++){ const a = i/n*6.28 + rng()*.5, rr = (i ? .55 + rng()*.25 : 0)*s*.34, r = s*(i ? .17 + rng()*.07 : .26);
    acc.add(new THREE.IcosahedronGeometry(r, 2), mat, at(x + Math.cos(a)*rr*1.3, y + (i ? rng()*.06*s : .06*s), z + Math.sin(a)*rr, 0, 1, .82, 1)); }
}
function km(g, name, h, w, x=0, y=0, z=0, rot=0){ const tpl = KITCACHE.a && KITCACHE.a[name]; if (!tpl) return null;
  const k = fitScale(tpl, h, w); return addModel(g, name, k, x, y, z, rot, 'a'); }
function lantern(acc, g, x, y, z, s=1){
  acc.add(new THREE.CylinderGeometry(.028*s, .024*s, .06*s, 6), MAT.glass, at(x, y, z));
  acc.add(new THREE.ConeGeometry(.04*s, .035*s, 6), MAT.blueD, at(x, y + .046*s, z));
  acc.add(new THREE.CylinderGeometry(.03*s, .022*s, .012*s, 6), MAT.woodD, at(x, y - .036*s, z));
  glowSprite(g, new THREE.Vector3(x, y, z), .3*s, 0xFFC070, .55);
}
function bunting(acc, p0, p1, sag, cols){
  const c = new THREE.CatmullRomCurve3([p0, p0.clone().lerp(p1, .5).add(new THREE.Vector3(0, -sag, 0)), p1]);
  acc.add(new THREE.TubeGeometry(c, 10, .004, 4), MAT.rope);
  const n = Math.max(3, Math.round(p0.distanceTo(p1)/.09)), dir = p1.clone().sub(p0), ry = Math.atan2(-dir.z, dir.x);
  for (let i=1;i<n;i++){ const p = c.getPoint(i/n); acc.add(new THREE.ConeGeometry(.024, .05, 3).rotateX(Math.PI), cols[i % cols.length], at(p.x, p.y - .026, p.z, ry, 1, 1, .25)); }
}

/* ── buildings (Reading / Lesson) ── */
const SAILS = [];
function windmillHall(g){
  const a = new Acc(), r = rngFrom(4), HX = -.2, HZ = .16, TX = .42, TZ = -.3;
  slab(a, MAT.stoneD, 1.42, .06, 1.2, 0, 0, 0);
  // main hall (left-front)
  slab(a, MAT.plaster, .86, .46, .62, HX, .06, HZ); slab(a, MAT.plasterD, .88, .04, .64, HX, .06, HZ);
  gable(a, MAT.coral, .86, .62, .3, HX, .52, HZ);
  const fz = HZ + .31, fx = HX + .43;
  door(a, 'z', fz, HX + .08, .06, .14, .24); win(a, 'z', fz, HX - .22, .28); win(a, 'z', fz, HX + .3, .28); flowerBox(a, 'z', fz, HX - .22, .19, r); flowerBox(a, 'z', fz, HX + .3, .19, r);
  win(a, 'x', fx, -HZ, .3, .09, .1, true); flowerBox(a, 'x', fx, -HZ, .19, r);
  cyl(a, MAT.stone, .05, .05, .02, HX + .08, .06, fz + .04, 8);
  // the windmill tower (right-back), sails facing the camera with nothing in front of them
  cyl(a, MAT.stoneL, .25, .23, 1.0, TX, .06, TZ, 14); a.add(new THREE.TorusGeometry(.24, .018, 6, 20).rotateX(Math.PI/2), MAT.blue, at(TX, .5, TZ));
  a.add(new THREE.ConeGeometry(.31, .36, 14), MAT.blue, at(TX, 1.06 + .18, TZ)); blob(a, MAT.gold, new THREE.Vector3(TX, 1.44, TZ), .03);
  for (const y of [.28, .66]) win(a, 'z', TZ + .23, TX - .12, y, .07, .09, true);
  door(a, 'x', TX + .23, -TZ, .06, .1, .18, MAT.blueD);
  // bench + barrel + a few sacks
  slab(a, MAT.wood, .24, .03, .08, .42, .12, .5); for (const x of [.32, .52]) slab(a, MAT.woodD, .02, .06, .06, x, .06, .5);
  cyl(a, MAT.wood, .06, .06, .12, -.58, .06, -.38, 10); blob(a, MAT.plasterD, new THREE.Vector3(.18, .1, -.46), .06, .9); blob(a, MAT.plasterD, new THREE.Vector3(.26, .09, -.52), .05, .9);
  a.into(g);
  // sails: their own group so tick can turn them (at rest in exported sprites)
  const hub = new THREE.Group(), s = new Acc(); hub.position.set(TX + .18, .86, TZ + .18); hub.rotation.y = Math.PI/4;
  s.add(new THREE.CylinderGeometry(.045, .045, .08, 10).rotateX(Math.PI/2), MAT.woodD, at(0, 0, .02));
  for (let i=0;i<4;i++){ const ang = i*Math.PI/2 + .35, c = Math.cos(ang), sn = Math.sin(ang);
    s.add(bx(.02, .56, .016), MAT.woodD, at(-sn*.28, c*.28, .06, 0, 1, 1, 1, 0, ang));
    s.add(bx(.1, .4, .008), MAT.sail, at(-sn*.32 + c*.055, c*.32 + sn*.055, .066, 0, 1, 1, 1, 0, ang)); }
  s.into(hub); g.add(hub); SAILS.push(hub);
}
function observatory(g){
  const a = new Acc();
  cyl(a, MAT.stoneD, .3, .3, .05, 0, 0, 0, 12);
  cyl(a, MAT.stoneL, .22, .21, .52, 0, .05, 0, 14); a.add(new THREE.TorusGeometry(.215, .014, 6, 20).rotateX(Math.PI/2), MAT.blue, at(0, .33, 0));
  cyl(a, MAT.stone, .25, .25, .04, 0, .57, 0, 14);
  a.add(new THREE.SphereGeometry(.2, 16, 9, 0, Math.PI*2, 0, Math.PI/2), MAT.plaster, at(0, .61, 0));
  a.add(new THREE.BoxGeometry(.06, .2, .01), MAT.dark, at(.1, .72, .1, Math.PI/4, 1, 1, 1, -.5));
  seg(a, MAT.brass, new THREE.Vector3(.06, .72, .06), new THREE.Vector3(1, .9, 1).normalize(), .22, .028, .022, 8);
  door(a, 'z', .215, 0, .05, .1, .18); win(a, 'x', .215, 0, .38, .06, .08, true);
  seg(a, MAT.woodD, new THREE.Vector3(0, .8, 0), _up, .1, .006, .006, 4);
  a.add(new THREE.OctahedronGeometry(.03), MAT.gold, at(0, .92, 0));
  a.into(g);
}
function workshop(g){
  const a = new Acc(), r = rngFrom(8);
  slab(a, MAT.stoneD, .82, .04, .78, 0, 0, 0);
  slab(a, MAT.wood, .5, .34, .46, -.12, .04, .1); gable(a, MAT.blueD, .5, .46, .2, -.12, .38, .1);
  door(a, 'z', .33, -.12, .04, .16, .22, MAT.woodD); win(a, 'x', .13, .1, .24, .08, .08);
  // a half-filled balloon on its frame
  const env = new THREE.LatheGeometry([[0,0],[.08,.02],[.2,.12],[.25,.26],[.23,.4],[.14,.5],[0,.54]].map(([x,y]) => new THREE.Vector2(x, y)), 16);
  a.add(env, BALLOON[0], at(.2, .34, -.2, 0, .9, .95, .9, 0, -.12));
  for (const [x, z] of [[.06,-.34],[.34,-.34],[.06,-.06],[.34,-.06]]) seg(a, MAT.rope, new THREE.Vector3(x, .04, z), new THREE.Vector3(.2 - x, .32, -.2 - z).normalize(), .35, .004, .004, 3);
  slab(a, MAT.wicker, .12, .09, .12, .2, .04, -.2);
  cyl(a, MAT.wood, .05, .05, .1, .3, .04, .3, 8); cyl(a, MAT.rope, .05, .06, .06, .18, .04, .32, 10);
  void r; a.into(g);
}
function dovecote(g){
  const a = new Acc(), r = rngFrom(12);
  slab(a, MAT.stoneD, .72, .04, .72, 0, 0, 0);
  slab(a, MAT.plaster, .46, .36, .4, -.06, .04, -.04); gable(a, MAT.coral, .46, .4, .22, -.06, .4, -.04);
  door(a, 'z', .16, -.1, .04, .11, .2); win(a, 'z', .16, .08, .24, .07, .07, true); flowerBox(a, 'x', .17, -.04, .17, r);
  // dovecote on a post
  seg(a, MAT.woodD, new THREE.Vector3(.26, .04, .24), _up, .5, .018, .016, 6);
  slab(a, MAT.white, .16, .14, .14, .26, .52, .24); gable(a, MAT.blue, .16, .14, .08, .26, .66, .24, 0, .03);
  for (const u of [-.035, .035]) a.add(new THREE.CylinderGeometry(.018, .018, .01, 10).rotateX(Math.PI/2), MAT.dark, at(.26 + u, .6, .31 + .002));
  // doves
  for (const [x, y, z, ry] of [[.2, .66 + .06, .26, .5], [.32, .53 + .03, .33, 2.2]]) { a.add(new THREE.SphereGeometry(.026, 8, 6), MAT.white, at(x, y, z, ry, 1, .85, 1.5)); blob(a, MAT.white, new THREE.Vector3(x + Math.sin(ry)*.03, y + .025, z + Math.cos(ry)*.03), .016); }
  a.into(g);
}
function cloudCottage(g){
  const a = new Acc(), r = rngFrom(31);
  slab(a, MAT.stoneD, .7, .04, .7, 0, 0, 0);
  cyl(a, MAT.plaster, .24, .24, .34, 0, .04, 0, 16); a.add(new THREE.TorusGeometry(.24, .014, 6, 22).rotateX(Math.PI/2), MAT.lilac, at(0, .2, 0));
  door(a, 'z', .235, -.02, .04, .1, .19, MAT.lilac); win(a, 'x', .235, 0, .24, .07, .07, true);
  cloud(a, 0, .38, 0, 1.3, r, MAT.cloud, 7); cloud(a, .12, .5, -.06, .7, r, MAT.cloud, 5);
  cyl(a, MAT.stoneL, .03, .03, .14, -.12, .5, -.12, 8);
  for (let i=0;i<3;i++) blob(a, [MAT.pink, MAT.yellow, MAT.lilac][i], new THREE.Vector3(.22 + i*.04, .06, .2 - i*.05), .03, .8);
  a.into(g);
}
function airshipDock(g){
  const a = new Acc();
  slab(a, MAT.wood, .82, .05, .5, 0, .18, -.12);
  for (const [x, z] of [[-.36,-.33],[.36,-.33],[-.36,.1],[.36,.1]]) cyl(a, MAT.woodD, .03, .03, .2, x, 0, z, 6);
  for (let i=0;i<4;i++) slab(a, MAT.wood, .2, .03, .09, .22, i*.045, .2 + (3 - i)*.07*.0 + .03*i + .06);   // little steps up
  // mast + the moored airship
  seg(a, MAT.woodD, new THREE.Vector3(-.3, .23, -.3), _up, .5, .02, .016, 6); blob(a, MAT.gold, new THREE.Vector3(-.3, .75, -.3), .025);
  a.add(new THREE.SphereGeometry(.16, 18, 12), MAT.coral, at(.04, .72, -.14, .5, 2.1, 1, 1));
  a.add(new THREE.TorusGeometry(.16, .012, 5, 18).rotateY(Math.PI/2), MAT.plaster, at(.04, .72, -.14, .5, 1, 1, 1));
  for (const sgn of [-1, 1]) a.add(bx(.12, .012, .14), MAT.coralD, at(.04 - Math.cos(.5)*.3, .72 + sgn*.0, -.14 + Math.sin(.5)*.3, .5, 1, 1, 1, sgn > 0 ? 0 : Math.PI/2));
  slab(a, MAT.wood, .16, .07, .09, .04, .5, -.14, .5); win(a, 'z', -.14 + .045, .04, .54, .03, .03);
  for (const d of [-.05, .05]) seg(a, MAT.rope, new THREE.Vector3(.04 + d, .57, -.14), _up, .1, .003, .003, 3);
  seg(a, MAT.rope, new THREE.Vector3(-.3, .7, -.3), new THREE.Vector3(1.5, .1, .6).normalize(), .12, .003, .003, 3);
  cyl(a, MAT.wood, .04, .04, .08, -.2, .23, .02, 8); cyl(a, MAT.rope, .04, .05, .05, .3, .23, -.26, 10);
  a.into(g);
}

/* ── water (Breathe) ── */
function rainBasin(g){
  const a = new Acc(), r = rngFrom(41);
  slab(a, MAT.stoneD, .62, .03, .62, 0, 0, 0, .785);
  cyl(a, MAT.stone, .26, .24, .16, 0, .03, 0, 14); cyl(a, MAT.stoneL, .28, .28, .03, 0, .19, 0, 14); cyl(a, MAT.water, .22, .22, .01, 0, .18, 0, 14);
  for (let i=0;i<3;i++) a.add(new THREE.CylinderGeometry(.08, .1, .1, 3), MAT.pad, at(Math.cos(i*2.2)*.12, .19, Math.sin(i*2.2)*.12, i, 1, .06, 1));
  // the little rain cloud: hangs over the basin on a shepherd's crook
  seg(a, MAT.woodD, new THREE.Vector3(.3, .03, -.24), _up, .8, .018, .015, 6);
  seg(a, MAT.woodD, new THREE.Vector3(.3, .83, -.24), new THREE.Vector3(-1, .05, 1).normalize(), .26, .015, .013, 5);
  a.add(new THREE.TorusGeometry(.28, .014, 5, 22).rotateX(Math.PI/2), MAT.blue, at(0, .205, 0));
  cloud(a, .05, .74, 0, .95, r, MAT.cloud, 6);
  for (let i=0;i<12;i++){ const px = (r()-.5)*.3, pz = (r()-.5)*.24, h = .08 + r()*.14; a.add(new THREE.CapsuleGeometry(.011, h, 2, 5), MAT.rain, at(px, .64 - h/2 - r()*.3, pz)); }
  a.into(g);
}
function cloudFountain(g){
  const a = new Acc(), r = rngFrom(43);
  slab(a, MAT.blue, .86, .03, .86); slab(a, MAT.stoneL, .8, .01, .8, 0, .03);
  cyl(a, MAT.stone, .34, .34, .1, 0, .04, 0, 16); cyl(a, MAT.water, .3, .3, .01, 0, .12, 0, 16);
  a.add(new THREE.TorusGeometry(.34, .015, 5, 22).rotateX(Math.PI/2), MAT.blue, at(0, .14, 0));
  cyl(a, MAT.stoneL, .045, .04, .2, 0, .1, 0, 10); cyl(a, MAT.stone, .15, .11, .05, 0, .3, 0, 12); cyl(a, MAT.water, .12, .12, .008, 0, .345, 0, 12);
  a.add(new THREE.CylinderGeometry(.15, .12, .08, 14, 1, true), MAT.jet, at(0, .29, 0));
  cloud(a, 0, .4, 0, .55, r, MAT.cloud, 6); a.add(new THREE.ConeGeometry(.02, .12, 6), MAT.jet, at(0, .56, 0));
  for (const [sx, sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) blob(a, MAT.leaf, new THREE.Vector3(sx*.38, .07, sz*.38), .05, .8);
  a.into(g);
}
function mistSpring(g){
  const a = new Acc(), r = rngFrom(47);
  a.add(new THREE.CylinderGeometry(1, 1.05, .03, 22), MAT.stoneD, at(.04, 0, .06, 0, .36, 1, .3));
  a.add(new THREE.CylinderGeometry(1, 1, .02, 22), MAT.water, at(.04, .025, .06, 0, .33, 1, .27));
  for (let i=0;i<5;i++){ const ang = 3.6 + i*.45; blob(a, i%2 ? MAT.rock : MAT.rockL, new THREE.Vector3(Math.cos(ang)*.3, .06 + (i === 2 ? .14 : 0), Math.sin(ang)*.3), .11 - Math.abs(i-2)*.015, .9, 1, r); }
  blob(a, MAT.rockL, new THREE.Vector3(-.2, .26, -.2), .09, .9, 1, r);
  const fall = new THREE.PlaneGeometry(.1, .28); a.add(fall, FALL, at(-.14, .16, -.13, Math.PI/4));
  cloud(a, -.08, .03, -.06, .35, r, MAT.cloud, 5);
  for (let i=0;i<5;i++) { const p = new THREE.Vector3(.26 + (r()-.5)*.08, 0, .2 + (r()-.5)*.08), L = .16 + r()*.12;
    seg(a, swayMat(0x86C454, .3, .06), p, new THREE.Vector3((r()-.5)*.3, 1, (r()-.5)*.3).normalize(), L, .01, .002, 4); }
  a.into(g);
}
function skyPond(g){
  const a = new Acc(), r = rngFrom(53);
  a.add(new THREE.CylinderGeometry(1, 1.06, .04, 26), MAT.stoneD, at(0, 0, 0, 0, .42, 1, .38));
  a.add(new THREE.CylinderGeometry(1, 1, .02, 26), MAT.water, at(0, .03, 0, 0, .38, 1, .34));
  for (let i=0;i<4;i++) { const ang = r()*6.28, rad = .1 + r()*.16; a.add(new THREE.CylinderGeometry(.06, .06, .008, 10, 1, false, 0, 5.6), MAT.pad, at(Math.cos(ang)*rad, .045, Math.sin(ang)*rad, r()*6));
    if (i%2 === 0) blob(a, MAT.pink, new THREE.Vector3(Math.cos(ang)*rad, .06, Math.sin(ang)*rad), .02, .8); }
  for (let i=0;i<6;i++){ const ang = r()*6.28; blob(a, i%2 ? MAT.rock : MAT.rockL, new THREE.Vector3(Math.cos(ang)*.42, .02, Math.sin(ang)*.38), .045 + r()*.03, .7, 0, r); }
  // a little arched footbridge over one end
  const c = new THREE.CatmullRomCurve3([new THREE.Vector3(-.12, .03, .36), new THREE.Vector3(-.06, .12, .1), new THREE.Vector3(0, .03, -.16)]);
  for (let i=0;i<=6;i++){ const p = c.getPoint(i/6); a.add(bx(.16, .015, .05), MAT.wood, at(p.x, p.y, p.z, -.23)); }
  a.into(g);
}

/* ── trees (Vocab) ── */
function blossomTree(g, s){
  const a = new Acc(), r = rngFrom(s.x*5 + s.z*11), H = s.h || 1;
  const base = new THREE.Vector3(0, 0, 0), d0 = new THREE.Vector3(.1, 1, -.06).normalize();
  seg(a, MAT.trunk, base, d0, .45*H, .055, .035, 7);
  const fork = base.clone().addScaledVector(d0, .45*H), m1 = swayMat(0xF6AFC8, 1.2, .018), m2 = swayMat(0xF28DB2, 1.2, .018), m3 = swayMat(0xFFD6E3, 1.2, .018);
  [[.7, .5, -.4, .3], [-.6, .7, .4, .28], [.1, 1, .7, .24], [-.2, 1.2, -.5, .26]].forEach(([dx, dy, dz, L], i) => {
    const d = new THREE.Vector3(dx, dy, dz).normalize(); seg(a, MAT.trunk, fork, d, L*H, .032, .018, 6);
    const tip = fork.clone().addScaledVector(d, L*H), geo = new THREE.IcosahedronGeometry(.24*H*(1 - i*.06), 1), p = geo.attributes.position;
    for (let k=0;k<p.count;k++){ const f = 1 + (r()-.5)*.2; p.setXYZ(k, p.getX(k)*f, p.getY(k)*f, p.getZ(k)*f); }
    a.add(geo, [m1, m2, m3, m1][i], at(tip.x, tip.y + .05, tip.z, r()*6, 1, .8, 1)); });
  blob(a, MAT.pink, new THREE.Vector3(.2, .01, .22), .03, .3); blob(a, MAT.pink, new THREE.Vector3(-.18, .01, .12), .025, .3);
  blob(a, MAT.grass, new THREE.Vector3(0, -.02, 0), .22, .25); a.into(g);
}
function kitTree(g, s){ km(g, s.model, s.h || 1.3, s.w || 1.05, 0, 0, 0, (s.rot || 0)*Math.PI/180); }

/* ── growing (Sudoku / Math): cloud gardens. Sprouts → buds → puffs that swell and tint; ripe beds carry a tiny rainbow ── */
function fillCloudBed(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 3), dawn = s.v === 1, cm = dawn ? [MAT.cloudP, MAT.cloudL, MAT.cloud] : [MAT.cloud];
  for (let i=0;i<3;i++) for (let j=0;j<3;j++){
    const px = (i-1)*.27 + (r()-.5)*.03, pz = (j-1)*.27 + (r()-.5)*.03, y = .075;
    const stem = [0, .03, .07, .1, .12, .13][stage];
    seg(a, MAT.sprout, new THREE.Vector3(px, y, pz), _up, stem + .015, .009, .006, 4);
    for (const sx of [-1, 1]) a.add(new THREE.SphereGeometry(.022, 6, 4), MAT.sprout, at(px + sx*.02, y + stem*.45 + .01, pz, 0, 1.3, .35, .8, 0, sx*.4));
    if (stage >= 2) { const pr = [0, 0, .035, .055, .07, .082][stage], m = cm[(i + j) % cm.length], top = y + stem + pr*.6;
      blob(a, m, new THREE.Vector3(px, top, pz), pr, .85, 1, r);
      if (stage >= 3) for (let k=0;k<(stage >= 4 ? 4 : 2);k++){ const ang = k/4*6.28 + r(); blob(a, m, new THREE.Vector3(px + Math.cos(ang)*pr*.8, top - pr*.15, pz + Math.sin(ang)*pr*.8), pr*.62, .85, 1, r); }
      if (stage >= 5 && (i + j) % 2 === 0) blob(a, MAT.gold, new THREE.Vector3(px + pr*.5, top + pr*.8, pz + pr*.3), .012, 1); }
  }
  if (stage >= 5 && !dawn) [MAT.red, MAT.yellow, MAT.blue].forEach((m, i) =>
    a.add(new THREE.TorusGeometry(.3 - i*.025, .012, 5, 20, Math.PI), m, at(0, .09, -.04, .5)));
  a.into(host); host.userData.stage = stage;
}

/* ── To-dos: paths, posts, little props; rope railings on the edges ── */
function path(g, s){
  const sl = new THREE.Mesh(G.path, MAT.stoneL); sl.position.y = .0175; sl.receiveShadow = true; g.add(sl);
  const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0;
  if (v === 0) { [[-.2,-.2],[.18,-.2],[-.18,.2],[.2,.19]].forEach(([x,z]) => a.add(new THREE.CylinderGeometry(.13, .14, .03, 9), r() < .5 ? MAT.stone : MAT.stoneD, at(x + (r()-.5)*.05, .045, z + (r()-.5)*.05)));
    cloud(a, .36, .05, -.34, .28, r, MAT.cloud, 4);
    for (let i=0;i<6;i++) blob(a, [MAT.pink, MAT.yellow, MAT.white][i%3], new THREE.Vector3(-.38 + (i%3)*.05, .05, .3 + Math.floor(i/3)*.06 - (i%3)*.03), .022, .8);
    blob(a, MAT.leaf, new THREE.Vector3(-.33, .04, .34), .06, .5); g.userData.ghostMode = 'marker'; }
  else if (v === 1) {   // kite post: a kite flying on a string, tail bows
    seg(a, MAT.woodD, new THREE.Vector3(-.2, .035, .2), _up, .3, .02, .016, 6); cyl(a, MAT.rope, .035, .035, .04, -.2, .26, .2, 8);
    const k = new THREE.Vector3(.2, .8, -.22), kite = new THREE.Shape(); kite.moveTo(0, .12); kite.lineTo(.07, 0); kite.lineTo(0, -.1); kite.lineTo(-.07, 0); kite.closePath();
    const kg = new THREE.ShapeGeometry(kite); a.add(kg, MAT.coral, at(k.x, k.y, k.z, Math.PI/4, 1, 1, 1, -.25)); a.add(kg, MAT.coral, at(k.x - .002, k.y, k.z - .002, Math.PI/4 + Math.PI, 1, 1, 1, .25));
    a.add(bx(.14, .006, .006), MAT.yellow, at(k.x, k.y, k.z, Math.PI/4 + Math.PI/2*0, 1, 1, 1, 0, 0));
    const str = new THREE.CatmullRomCurve3([new THREE.Vector3(-.2, .3, .2), new THREE.Vector3(0, .5, 0), k.clone().add(new THREE.Vector3(0, -.08, 0))]); a.add(new THREE.TubeGeometry(str, 10, .003, 3), MAT.rope);
    for (let i=1;i<=3;i++) a.add(new THREE.ConeGeometry(.02, .04, 3), [MAT.yellow, MAT.blue, MAT.pink][i-1], at(k.x - i*.04, k.y - .1 - i*.07, k.z + i*.04, 0, 1, 1, .3, 0, 1.57));
    a.add(new THREE.BoxGeometry(.004, .3, .004), MAT.rope, at(k.x - .06, k.y - .22, k.z + .06, 0, 1, 1, 1, .2, .2)); }
  else if (v === 2) {   // lantern post + planter
    seg(a, MAT.woodD, new THREE.Vector3(.22, .035, -.2), _up, .52, .02, .017, 6); seg(a, MAT.woodD, new THREE.Vector3(.22, .55, -.2), new THREE.Vector3(-1, .1, 1).normalize(), .1, .01, .01, 4);
    lantern(a, g, .15, .49, -.13, 1.1);
    slab(a, MAT.wood, .26, .08, .12, -.16, .035, .16); for (let i=0;i<5;i++) blob(a, [MAT.pink, MAT.yellow, MAT.white, MAT.lilac, MAT.coral][i], new THREE.Vector3(-.26 + i*.05, .13, .16 + (i%2 - .5)*.04), .025, .9); }
  else if (v === 3) {   // weathervane + wind chimes
    seg(a, MAT.woodD, new THREE.Vector3(0, .035, 0), _up, .56, .018, .015, 6);
    for (const [dx, dz] of [[1,0],[0,1]]) a.add(bx(dx ? .2 : .008, .008, dz ? .2 : .008), MAT.woodD, at(0, .5, 0));
    a.add(bx(.26, .01, .01), MAT.brass, at(0, .6, 0, .7)); a.add(new THREE.ConeGeometry(.03, .06, 4).rotateZ(-Math.PI/2), MAT.brass, at(Math.cos(.7)*.14, .6, -Math.sin(.7)*.14, .7));
    a.add(bx(.06, .06, .006), MAT.brass, at(-Math.cos(.7)*.12, .6, Math.sin(.7)*.12, .7));
    seg(a, MAT.woodD, new THREE.Vector3(0, .38, 0), new THREE.Vector3(1, 0, 1).normalize(), .18, .008, .008, 4);
    for (let i=0;i<4;i++) cyl(a, [MAT.blue, MAT.mint, MAT.lilac, MAT.coral][i], .01, .01, .08 - i*.012, .1 + i*.012, .28 + i*.01, .1 + i*.012, 6);
    blob(a, MAT.rockL, new THREE.Vector3(.2, .05, .22), .06, .6, 0, r); }
  else if (v === 4) {   // bench + telescope on a tripod
    slab(a, MAT.wood, .34, .03, .11, -.08, .14, .1); slab(a, MAT.wood, .34, .1, .02, -.08, .17, .05);
    for (const x of [-.22, .06]) slab(a, MAT.woodD, .03, .1, .1, x, .035, .1);
    for (let i=0;i<3;i++){ const ang = i*2.1; seg(a, MAT.woodD, new THREE.Vector3(.22 + Math.cos(ang)*.08, .035, -.18 + Math.sin(ang)*.08), new THREE.Vector3(-Math.cos(ang)*.08, .3, -Math.sin(ang)*.08).normalize(), .31, .008, .008, 4); }
    seg(a, MAT.brass, new THREE.Vector3(.16, .33, -.24), new THREE.Vector3(1, .7, 1).normalize(), .18, .022, .015, 8); }
  else {                // planters + a birdbath
    for (const [x, z, m] of [[-.22, -.2, MAT.pink], [.22, .2, MAT.yellow]]) { cyl(a, MAT.stone, .09, .07, .1, x, .035, z, 10); blob(a, MAT.leaf, new THREE.Vector3(x, .17, z), .07, .8, 0, r);
      for (let i=0;i<4;i++) blob(a, m, new THREE.Vector3(x + Math.cos(i*1.6)*.05, .21, z + Math.sin(i*1.6)*.05), .018); }
    cyl(a, MAT.stoneL, .03, .04, .2, .2, .035, -.2, 8); cyl(a, MAT.stoneL, .1, .06, .04, .2, .23, -.2, 12); cyl(a, MAT.water, .08, .08, .006, .2, .265, -.2, 12);
    a.add(new THREE.SphereGeometry(.022, 8, 6), MAT.white, at(.26, .29, -.2, 1, 1, .85, 1.5)); }
  a.into(g);
}
function railing(g, s){
  const a = new Acc(), L = s.len;
  const pos = u => s.edge === 'w' ? new THREE.Vector3(-.45, 0, u) : new THREE.Vector3(u, 0, .45);
  const posts = []; for (let i=0;i<=L*2;i++){ const p = pos(i/2 - L/2); posts.push(p); seg(a, MAT.woodD, p, _up, .26, .02, .017, 6); blob(a, MAT.wood, p.clone().setY(.27), .024); }
  for (let i=0;i<posts.length-1;i++){ const p0 = posts[i].clone().setY(.23), p1 = posts[i+1].clone().setY(.23);
    a.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, p0.clone().lerp(p1, .5).setY(.18), p1]), 8, .006, 4), MAT.rope);
    if (i % 2 === 0) bunting(a, p0.clone().setY(.25), p1.clone().setY(.25), .03, [MAT.coral, MAT.yellow, MAT.blue, MAT.mint]); }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}

/* ── the hero (Gita): a floating temple. A round shrine of white columns and a gold dome on its own little floating islet,
   stepping stones rising to it, a thread of water falling from its lip into a pool on the mound below ── */
function floatingTemple(g0){
  const g = new THREE.Group(); g.scale.setScalar(1.14); g.position.set(.04, 0, .04); g0.add(g);
  const a = new Acc(), r = rngFrom(5), Y = .5;
  // ground: a grassy mound with a round pool that catches the falling thread of water
  blob(a, MAT.grass, new THREE.Vector3(0, -.12, 0), .92, .26, 2, r);
  a.add(new THREE.CylinderGeometry(.22, .24, .03, 20), MAT.stoneD, at(.32, .06, .38)); a.add(new THREE.CylinderGeometry(.19, .19, .02, 20), MAT.water, at(.32, .075, .38));
  cloud(a, .32, .06, .38, .36, r, MAT.cloud, 5);
  // stepping stones floating up toward the front of the islet
  [[.72, .12, .64], [.62, .26, .44], [.54, .4, .26]].forEach(([x, y, z], i) => { a.add(new THREE.CylinderGeometry(.1, .07, .05, 8), MAT.stone, at(x, y, z, i));
    a.add(new THREE.ConeGeometry(.07, .08, 7).rotateX(Math.PI), MAT.rock, at(x, y - .05, z)); });
  // the floating islet
  const rock = new THREE.ConeGeometry(.74, .62, 9, 3).rotateX(Math.PI), rp = rock.attributes.position;
  for (let i=0;i<rp.count;i++){ const y = rp.getY(i); if (y > .3) continue; const k = 1 + (r()-.5)*.28; rp.setXYZ(i, rp.getX(i)*k, y + (r()-.5)*.05, rp.getZ(i)*k); }
  a.add(rock, MAT.rock, at(0, Y - .31, 0)); a.add(new THREE.CylinderGeometry(.76, .72, .09, 18), MAT.grass, at(0, Y + .045 - .02, 0));
  a.add(new THREE.CylinderGeometry(.77, .77, .03, 18), MAT.grassD, at(0, Y - .03, 0));
  for (let i=0;i<6;i++){ const ang = i*1.05 + .3; seg(a, MAT.leafD, new THREE.Vector3(Math.cos(ang)*.66, Y - .05, Math.sin(ang)*.66), new THREE.Vector3(0, -1, 0), .12 + r()*.16, .008, .004, 3); }
  const T = Y + .07;
  cyl(a, MAT.stoneD, .56, .56, .06, 0, T, 0, 20); cyl(a, MAT.stoneL, .5, .5, .06, 0, T + .06, 0, 20);
  const P = T + .12, PH = .46;
  for (let i=0;i<10;i++){ const ang = i/10*6.28, x = Math.cos(ang)*.4, z = Math.sin(ang)*.4;
    cyl(a, MAT.white, .033, .03, PH, x, P, z, 10); cyl(a, MAT.stone, .05, .05, .03, x, P, z, 8); cyl(a, MAT.stone, .045, .052, .035, x, P + PH - .035, z, 8); }
  cyl(a, MAT.stoneL, .47, .47, .06, 0, P + PH, 0, 22); a.add(new THREE.TorusGeometry(.47, .016, 6, 28).rotateX(Math.PI/2), MAT.gold, at(0, P + PH + .03, 0));
  cyl(a, MAT.stone, .38, .36, .07, 0, P + PH + .06, 0, 20);
  a.add(new THREE.SphereGeometry(.36, 22, 12, 0, Math.PI*2, 0, Math.PI/2), MAT.gold, at(0, P + PH + .13, 0, 0, 1, .9, 1));
  cyl(a, MAT.gold, .04, .02, .1, 0, P + PH + .45, 0, 8); a.add(new THREE.OctahedronGeometry(.045), MAT.crystal, at(0, P + PH + .6, 0, .4));
  // the light inside: a glowing lotus-flame on a small pedestal
  cyl(a, MAT.stoneL, .1, .08, .14, 0, P, 0, 12);
  for (let i=0;i<8;i++){ const ang = i/8*6.28; a.add(new THREE.SphereGeometry(.05, 8, 5), MAT.white, at(Math.cos(ang)*.05, P + .17, Math.sin(ang)*.05, -ang, .55, .35, 1, 0, 0)); }
  a.add(new THREE.OctahedronGeometry(.07), MAT.crystal, at(0, P + .26, 0, .3, 1, 1.5, 1));
  // lanterns hanging from the eave, flower garlands at the steps
  for (let i=0;i<4;i++){ const ang = i/4*6.28 + .5, x = Math.cos(ang)*.47, z = Math.sin(ang)*.47; seg(a, MAT.brass, new THREE.Vector3(x, P + PH - .06, z), _up, .06, .003, .003, 3); lantern(a, g, x, P + PH - .1, z, .95); }
  for (let i=0;i<7;i++) { const ang = .2 + i*.18; blob(a, [MAT.yellow, MAT.coral, MAT.pink][i%3], new THREE.Vector3(Math.cos(ang)*.58, T + .02, Math.sin(ang)*.58), .03); }
  // the thread of water from the islet's lip
  a.add(new THREE.PlaneGeometry(.07, Y - .02), FALL, at(.32, (Y + .06)/2, .38 - .0, -.7));
  a.into(g);
  glowSprite(g, new THREE.Vector3(0, P + .26, 0), .9, 0xFFD27A, .55);
  glowSprite(g, new THREE.Vector3(0, P + PH + .3, 0), 2.0, 0xFFE3A6, .22);
}

/* ── blueprint: the farm's cells with sky pieces; the floating temple takes the left corner ── */
const MAP = {
  bigbarn:{ name:'Windmill hall', b:'hall' }, well:{ name:'Rain-cloud basin', b:'rain' },
  apple1:{ name:'Blossom tree', b:'blossom', h:1.05 }, silo:{ name:'Star observatory', b:'observatory' },
  silohouse:{ name:'Balloon workshop', b:'workshop' }, coop:{ name:'Dovecote cottage', b:'dovecote' },
  watertower:{ name:'Cloud fountain', b:'fountain' }, pump:{ name:'Mist spring', b:'spring' },
  apple2:{ name:'Sky oak', b:'kit', model:'CommonTree_1', h:1.3, rot:40 }, berry1:{ name:'Blossom tree', b:'blossom', h:.9 },
  peepal:{ name:'Floating temple', b:'hero' }, smallbarn:{ name:'Cloud cottage', b:'cottage' }, openbarn:{ name:'Airship dock', b:'dock' },
  pond:{ name:'Sky pond', b:'pond' }, orange1:{ name:'Sky pine', b:'kit', model:'Pine_3', h:1.45, w:.9 },
  apple3:{ name:'Sky oak', b:'kit', model:'CommonTree_2', h:1.3, rot:200 }, berry2:{ name:'Blossom tree', b:'blossom', h:1 },
  orange2:{ name:'Sky pine', b:'kit', model:'Pine_1', h:1.35, w:.9, rot:90 }, apple4:{ name:'Blossom tree', b:'blossom', h:1.1 }
};
const MOVE = { peepal:{ x:0, z:5 }, field1_5:{ x:1, z:1 }, fence3:{ x:0, z:0, edge:'w' } };   // hero to the left corner
const PATH_V = { path3_4:0, path3_5:1, path1_2:2, path5_2:3, path3_0:5, path2_6:4, path3_6:0 };
const PATH_NAME = ['Stepping stones', 'Kite post', 'Lantern post', 'Weathervane', 'Stargazing bench', 'Birdbath planters'];
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d, ...(MOVE[f.id] || {}) };
  if (f.kind === 'field') { const dawn = f.crop === 'Lettuce' || f.crop === 'Beet' || f.crop === 'Carrot';
    return { ...s, kind:'bed', v:dawn ? 1 : 0, name:dawn ? 'Dawn-cloud garden' : 'Cloud garden', stages:5 }; }
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'sky', b:'path', v, name:PATH_NAME[v] }; }
  if (f.kind === 'fence') return { ...s, kind:'sky', b:'rail', edge:s.edge || f.edge, len:f.len, name:'Rope railing' };
  return { ...s, kind:'sky', ...MAP[f.id] };
});
const BUILD = { hall:windmillHall, observatory, workshop, dovecote, cottage:cloudCottage, dock:airshipDock, rain:rainBasin, fountain:cloudFountain,
  spring:mistSpring, pond:skyPond, blossom:blossomTree, kit:kitTree, path, rail:railing, hero:floatingTemple };

/* ── ground: fresh grass on a sandstone cliff that fades to lavender rock ── */
const TILE = { top:['#A7D96F', '#9DD166'], side:'#8FC35A', soilTop:'#C4A27A', soilBot:'#A99BC4' };

/* ── env: the land floats. Rocky underside + cloud bank, two cliff springs, two satellite islets on rope bridges ── */
const UNDER = new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:.95, metalness:0 });
const UNDER_B = new THREE.MeshStandardMaterial({ color:0x8E84B4, flatShading:true, roughness:.95 });
function undersideGeo(R, H, seed, sides=4){
  const g = new THREE.ConeGeometry(R, H, sides*3, 5).rotateX(Math.PI).translate(0, -H/2, 0), p = g.attributes.position, r = rngFrom(seed);
  if (sides === 4) for (let i=0;i<p.count;i++){ const x = p.getX(i), z = p.getZ(i), ang = Math.atan2(z, x), k = 1/Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)))/Math.SQRT2;
    p.setXYZ(i, x*k*Math.SQRT2*.99, p.getY(i), z*k*Math.SQRT2*.99); }            // square top that matches the block
  const jit = new Map();
  for (let i=0;i<p.count;i++){ const y = p.getY(i); if (y > -1e-3) continue; const key = p.getX(i).toFixed(3)+','+y.toFixed(3)+','+p.getZ(i).toFixed(3);
    if (!jit.has(key)) jit.set(key, [1 + (r()-.5)*.34, (r()-.5)*H*.07]); const [k, dy] = jit.get(key); p.setXYZ(i, p.getX(i)*k, y + dy, p.getZ(i)*k); }
  const ng = g.toNonIndexed(), q = ng.attributes.position, col = new Float32Array(q.count*3);
  const top = new THREE.Color(0xA7825E), mid = new THREE.Color(0x8F7F78), bot = new THREE.Color(0x8C83B8), c = new THREE.Color();
  for (let f=0; f<q.count; f+=3){ const t = -(q.getY(f) + q.getY(f+1) + q.getY(f+2))/3/H;
    c.copy(top).lerp(mid, Math.min(1, t*1.8)).lerp(bot, Math.max(0, t*1.8 - .8)).offsetHSL(0, 0, (((f/3)*7)%5 - 2)*.018);
    for (let k=0;k<3;k++) col.set([c.r, c.g, c.b], (f + k)*3); }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3)); ng.computeVertexNormals(); return ng;
}
function islet(env, x, y, z, s, seed, withTree){
  const grp = new THREE.Group(); grp.position.set(x, y, z); env.add(grp); const a = new Acc(), r = rngFrom(seed);
  const m = new THREE.Mesh(undersideGeo(.5*s, .75*s, seed, 3), UNDER); m.castShadow = true; grp.add(m);
  a.add(new THREE.CylinderGeometry(.55*s, .5*s, .1*s, 12), MAT.grass, at(0, .05*s - .04, 0, .2));
  if (withTree) { blossomTree(grp, { x:seed, z:1, h:.75*s }); }
  else { cloud(a, .1*s, .06, -.05*s, .5*s, r, MAT.cloud, 5); cyl(a, MAT.stoneL, .08*s, .07*s, .22*s, -.18*s, .02, .1*s, 10); cyl(a, MAT.gold, .1*s, .02, .08*s, -.18*s, .24*s, .1*s, 10); }
  for (let i=0;i<3;i++) blob(a, [MAT.pink, MAT.yellow, MAT.white][i], new THREE.Vector3((r()-.5)*.6*s, .03, (r()-.5)*.6*s), .03, .8);
  a.into(grp); grp.userData.bob = { y, ph:seed*.7 }; (V.islets || (V.islets = [])).push(grp); return grp;
}
function ropeBridge(acc, p0, p1){
  const sag = p0.distanceTo(p1)*.14, mid = p0.clone().lerp(p1, .5).add(new THREE.Vector3(0, -sag, 0)), c = new THREE.QuadraticBezierCurve3(p0, mid, p1);
  const dir = p1.clone().sub(p0).setY(0).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x), n = Math.round(p0.distanceTo(p1)/.075), ry = Math.atan2(-dir.z, dir.x);
  for (let i=0;i<=n;i++){ const p = c.getPoint(i/n); acc.add(bx(.05, .014, .17), i%3 ? MAT.wood : MAT.woodD, at(p.x, p.y, p.z, ry)); }
  for (const k of [-1, 1]) { const o = side.clone().multiplyScalar(k*.09);
    const rail = new THREE.QuadraticBezierCurve3(p0.clone().add(o).setY(p0.y + .12), mid.clone().add(o).setY(mid.y + .1), p1.clone().add(o).setY(p1.y + .12));
    acc.add(new THREE.TubeGeometry(rail, 16, .006, 4), MAT.rope);
    for (const p of [p0, p1]) seg(acc, MAT.woodD, p.clone().add(o).setY(p.y - .02), _up, .16, .014, .012, 5); }
}
function fallCurtain(env, pos, face, len, w=.26){
  const grp = new THREE.Group(); grp.position.copy(pos); if (face === 'x') grp.rotation.y = Math.PI/2; env.add(grp);
  const a = new Acc();
  a.add(new THREE.CircleGeometry(.1, 12, 0, Math.PI), MAT.dark, at(0, -.02, .004, 0, w/.2*.9, 1.1, 1));   // the spring's mouth in the cliff
  a.add(new THREE.CylinderGeometry(w*.5, w*.55, .05, 10, 1, false, -Math.PI/2, Math.PI).rotateZ(0), FALL, at(0, -.02, .02, 0, 1, 1, .5));
  a.into(grp);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, len, 1, 6).translate(0, -len/2, 0), FALL), pp = pl.geometry.attributes.position;
  for (let i=0;i<pp.count;i++){ const t = -pp.getY(i)/len; pp.setZ(i, .06 + Math.sin(Math.min(1, t*3)*Math.PI/2)*.14); pp.setX(i, pp.getX(i)*(1 + t*.5)); }
  pl.geometry.computeVertexNormals(); pl.position.set(0, -.04, 0); pl.renderOrder = 6; grp.add(pl);
  const b = new Acc(), r = rngFrom(Math.round(len*100)); cloud(b, 0, -len - .1, .24, 1.05, r, MAT.cloud, 7); b.into(grp);
  glowSprite(grp, new THREE.Vector3(0, -len - .02, .25), .7, 0xFFFFFF, .5);
}
function buildEnv(){
  const L = V.L, h = L/2 + .02, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env; V.islets = [];
  world.children.forEach(o => { if (o.userData.ground === 'catcher' || o.userData.ground === 'blob') o.visible = false; });   // nothing below: it floats
  const H = 1.0 + L*.22, top = -.6, a = new Acc(), r = rngFrom(31 + L);
  // the underside: jagged rock teeth hanging from the two visible faces, the deepest under the front corner. (One cone under the
  // whole block hides behind it: from this camera only what hangs below the front edges shows.)
  let low = null; const tips = [];
  const tooth = (x, z, R, D, seed) => { const m = new THREE.Mesh(undersideGeo(R, D, seed, 3), UNDER); m.position.set(x, top + .02, z); m.rotation.y = seed; m.castShadow = true; env.add(m);
    const tp = new THREE.Vector3(x, top - D, z); tips.push(tp); if (!low || tp.x + tp.z - tp.y*1.2 > low.x + low.z - low.y*1.2) low = tp; };
  tooth(h - .5 - L*.06, h - .5 - L*.06, .55 + L*.08, H, 11);
  for (const face of [0, 1]) { const n = Math.max(2, Math.round(L*.75)); for (let i=0;i<n;i++){ const u = -h + .45 + (i + .2 + r()*.5)*(2*h - 1.4)/n, near = (u + h)/(2*h), R = .26 + near*.22 + r()*.08;
    const D = (.4 + near*.55 + r()*.25)*H*.75, inset = R*.6; if (face) tooth(u, h - inset, R, D, 20 + i); else tooth(h - inset, -u, R, D, 40 + i); } }
  // cloud puffs caught on some of the teeth
  tips.forEach((tp, i) => { if (i % 2) return; cloud(a, tp.x + .12, tp.y + .3 + r()*.15, tp.z + .12, .5 + L*.05 + r()*.15, r, MAT.cloud, 6); });
  // hanging roots / vines under the front edges
  for (let i=0;i<8;i++){ const u = (r() - .5)*L*.9, face = i % 2; const p = face ? new THREE.Vector3(h + .01, top + .02, u) : new THREE.Vector3(u, top + .02, h + .01);
    const len = .12 + r()*.28; seg(a, i % 3 ? MAT.leafD : MAT.trunk, p, new THREE.Vector3(face ? -.2 : 0, -1, face ? 0 : -.2).normalize(), len, .012, .005, 4); if (i % 3 === 0) blob(a, MAT.pink, p.clone().add(new THREE.Vector3(0, -len, 0)), .02); }
  a.into(env);
  // two springs gush out of the cliff faces and fall into cloud puffs
  fallCurtain(env, new THREE.Vector3(-h*.45, -.16, h + .01), 'z', H*.8, .36);
  fallCurtain(env, new THREE.Vector3(h + .01, -.22, -h*.3), 'x', H*.66, .3);
  // two satellite islets behind the land, on rope bridges
  const b = new Acc();
  const i1 = islet(env, -h - .65, .75 + L*.05, -h*.35, .8 + L*.04, 3, true), i2 = islet(env, -h*.2, 1.0 + L*.05, -h - .7, .7 + L*.04, 9, false);
  ropeBridge(b, new THREE.Vector3(-h + .05, TILE_TOP + .01, -h*.35), i1.position.clone().add(new THREE.Vector3(.38*(.8 + L*.04), .01, 0)));
  ropeBridge(b, new THREE.Vector3(-h*.2, TILE_TOP + .01, -h + .05), i2.position.clone().add(new THREE.Vector3(0, .01, .34*(.7 + L*.04))));
  b.into(env);
  env.traverse(o => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  V.framePts.push(low.clone().add(new THREE.Vector3(0, -.1, 0)), new THREE.Vector3(-h*.45, top - H*.8 - .45, h + .3), new THREE.Vector3(h + .3, top - H*.66 - .45, -h*.3),
    i1.position.clone().add(new THREE.Vector3(0, .8, 0)), i2.position.clone().add(new THREE.Vector3(0, .6, 0)), i1.position.clone().add(new THREE.Vector3(0, -.6, 0)));
}

/* ── decor: meadow tufts and clover on empty cells, plus the odd resting cloud puff ── */
function decor(slots){
  SAILS.length = 0;
  meadowDecor(slots, { tuft: r => { const q = r(); return q < .45 ? ['Grass_Common_Short', 0] : q < .75 ? ['Grass_Wispy_Short', 0] : q < .88 ? ['Clover_1', .18] : [q < .94 ? 'Flower_3_Single' : 'Flower_4_Single', .16]; }, flowers:false });
  const r = rngFrom(77);
  world.children.forEach(o => { if (o.userData.decor !== 'meadow' || r() > .45) return; const [x, z] = o.userData.cell, p = cellPos(x, z), a = new Acc();
    cloud(a, p.x + (r()-.5)*.3, p.y + .02, p.z + (r()-.5)*.3, .32 + r()*.12, r, MAT.cloud, 5); a.into(o); });
}

/* ── ambient: gulls wheeling, drifting cloudlets, the waterfalls running, windmill turning, islets bobbing ── */
const wingGeo = new THREE.PlaneGeometry(.16, .06).rotateX(-Math.PI/2).translate(.08, 0, 0);
function addAmbient(){
  V.birds = [];
  for (let i=0;i<3;i++){ const b = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), MAT.bird); body.scale.set(.8, .7, 1.8); b.add(body);
    const w1 = new THREE.Mesh(wingGeo, MAT.bird), w2 = new THREE.Mesh(wingGeo, MAT.bird); w2.scale.x = -1; b.add(w1, w2);
    b.userData = { w1, w2, ph:i*2.1, rad:1.1 + V.ring*.5 + i*.2, h:1.4 + i*.28 + V.ring*.12, sp:.28 + i*.05 }; world.add(b); V.birds.push(b); V.life.push(b); }
  moveAmbient(2.1);
}
function moveAmbient(t){
  if (!V) return;
  FALL_TEX.offset.y = t*.9;
  SAILS.forEach(s => { s.rotation.z = t*.7; });
  (V.islets || []).forEach(o => { const u = o.userData.bob; o.position.y = u.y + Math.sin(t*.6 + u.ph)*.035; });
  (V.birds || []).forEach(b => { const u = b.userData, a = t*u.sp + u.ph; b.visible = !S.night;
    b.position.set(Math.cos(a)*u.rad, TILE_TOP + u.h + Math.sin(a*2.1)*.1, Math.sin(a)*u.rad*.8); b.rotation.y = -a;
    const f = Math.sin(t*5 + u.ph)*.5; u.w1.rotation.z = f; u.w2.rotation.z = -f; });
}

/* ── residents: three hot-air balloons drift down, a sky whale glides in behind the land ── */
function makeBalloon(v=0){
  const g = new THREE.Group(), a = new Acc();
  const prof = [[0,0],[.1,.02],[.24,.12],[.36,.3],[.4,.5],[.37,.7],[.26,.86],[.12,.95],[0,.98]].map(([x,y]) => new THREE.Vector2(x, y));
  a.add(new THREE.LatheGeometry(prof, 16), BALLOON[v % 3], at(0, .42, 0));
  a.add(new THREE.CylinderGeometry(.11, .1, .04, 16, 1, true), MAT.woodD, at(0, .44, 0));
  cyl(a, MAT.wicker, .075, .065, .11, 0, 0, 0, 10); a.add(new THREE.TorusGeometry(.075, .012, 5, 14).rotateX(Math.PI/2), MAT.woodD, at(0, .11, 0));
  for (let i=0;i<4;i++){ const ang = i*Math.PI/2 + .78, b0 = new THREE.Vector3(Math.cos(ang)*.065, .11, Math.sin(ang)*.065), b1 = new THREE.Vector3(Math.cos(ang)*.1, .44, Math.sin(ang)*.1);
    seg(a, MAT.rope, b0, b1.clone().sub(b0).normalize(), b0.distanceTo(b1), .004, .004, 3); }
  a.add(new THREE.ConeGeometry(.02, .05, 6), MAT.flame, at(0, .2, 0));
  for (let i=0;i<2;i++) blob(a, MAT.wicker, new THREE.Vector3((i ? 1 : -1)*.08, .06, .02), .02, 1.4);
  a.into(g); return g;
}
function makeWhale(){
  const g = new THREE.Group(), body = new THREE.Group(), a = new Acc();
  a.add(new THREE.SphereGeometry(.3, 22, 16), MAT.whale, at(0, 0, 0, 0, 1, .78, 1.7));
  a.add(new THREE.SphereGeometry(.28, 20, 14, 0, Math.PI*2, Math.PI*.52, Math.PI*.48), MAT.belly, at(0, .02, .04, 0, 1.02, .8, 1.66));
  for (let i=0;i<5;i++) a.add(new THREE.TorusGeometry(.2, .006, 4, 16, Math.PI*.6), MAT.whaleD, at(0, -.12, .28 - i*.09, 0, 1, 1, 1, Math.PI/2, Math.PI*.2));
  for (const sx of [-1, 1]) { blob(a, MAT.eye, new THREE.Vector3(sx*.24, .03, .3), .026); blob(a, MAT.white, new THREE.Vector3(sx*.25, .045, .31), .009); blob(a, MAT.cheek, new THREE.Vector3(sx*.23, -.04, .36), .03, .5); }
  for (let i=0;i<5;i++){ const ang = r5(i); blob(a, MAT.belly, new THREE.Vector3(Math.cos(ang)*.2, .18 + (i%2)*.03, -.1 + i*.07), .025, .5); }
  // blowhole spray: a tiny cloud puff
  const rc = rngFrom(4); cloud(a, 0, .27, .12, .3, rc, MAT.cloud, 4);
  a.into(body); g.add(body);
  const tail = new THREE.Group(), ta = new Acc(); tail.position.set(0, .02, -.46);
  ta.add(new THREE.ConeGeometry(.13, .34, 12).rotateX(-Math.PI/2), MAT.whale, at(0, 0, -.12, 0, 1, .75, 1));
  for (const sx of [-1, 1]) ta.add(new THREE.SphereGeometry(.1, 10, 6), MAT.whaleD, at(sx*.1, 0, -.3, sx*.5, 1.4, .18, .7));
  ta.into(tail); g.add(tail);
  const fins = [];
  for (const sx of [-1, 1]) { const f = new THREE.Group(), fa = new Acc(); f.position.set(sx*.24, -.1, .12);
    fa.add(new THREE.SphereGeometry(.1, 10, 6), MAT.whaleD, at(sx*.1, 0, -.02, sx*.3, 1.5, .18, .7)); fa.into(f); g.add(f); fins.push(f); }
  g.userData.tail = tail; g.userData.fins = fins; return g;
}
function r5(i){ return 1.2 + i*.35; }
const BALLOONS = [ { at:[1.0, 2.2], lift:1.5, v:0, s:1.25 }, { at:[4.8, 0.3], lift:2.2, v:1, s:1.1 }, { at:[7.5, 2.3], lift:.9, v:2, s:1 } ];
const WHALE = { at:[1.4, -0.4], lift:2.35, face:1.9, s:1.35 };
function whalePos(t){ const c = cellPos(...WHALE.at), a = Math.sin(t*.12)*.9;
  return { p:new THREE.Vector3(c.x + Math.sin(a)*1.1, TILE_TOP + WHALE.lift + Math.sin(t*.7)*.06, c.z - Math.sin(a)*.5 + Math.cos(a)*.2), ry:WHALE.face + Math.cos(t*.12)*.35 }; }
function moveResidents(t){
  (V && V.res || []).forEach(r => { const e = 1 - Math.pow(1 - r.arrive, 3), u = r.u;
    if (r.kind === 'balloon') { r.obj.position.set(u.at.x - (1-e)*.6, TILE_TOP + u.lift + (1-e)*2.6 + Math.sin(t*.8 + u.ph)*.05, u.at.z + (1-e)*.6); r.obj.rotation.y = t*.08 + u.ph; }
    else { const w = whalePos(t), from = w.p.clone().add(new THREE.Vector3(3.2, .4, -1.8)); r.obj.position.copy(from.lerp(w.p, e)); r.obj.rotation.y = w.ry;
      r.obj.userData.tail.rotation.x = Math.sin(t*1.6)*.18; r.obj.userData.fins.forEach((f, i) => f.rotation.z = (i ? -1 : 1)*Math.sin(t*1.6 + .6)*.25); }
  });
}
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.2 - j*.1))),
  () => { rs.forEach(r => r.arrive = 1); sparkle(rs[0].obj.position.clone(), 10, 0xFFF0B0, .6); res(); })); }
async function skyMoveIn(walk){
  V.residentsIn = true; V.res = [];
  BALLOONS.forEach(b => { const c = cellPos(...b.at); V.framePts.push(c.clone().setY(TILE_TOP + b.lift + 1.0*b.s)); });
  { const c = cellPos(...WHALE.at); V.framePts.push(c.clone().add(new THREE.Vector3(0, WHALE.lift + .5, 0))); }
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  const groups = [
    async () => { const rs = BALLOONS.map((b, i) => { const o = makeBalloon(b.v); o.scale.setScalar(b.s); return addRes('balloon', o, { at:cellPos(...b.at), lift:b.lift, ph:i*2.3 }); });
      moveResidents(0); if (walk) await arrive(rs, 2200); },
    async () => { const o = makeWhale(); o.scale.setScalar(WHALE.s); const rs = [addRes('whale', o, {})]; moveResidents(0); if (walk) await arrive(rs, 2400); }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length;
}

export default {
  id:'sky', name:'Sky islands', title:'Your sky isles',
  season:20, dates:'22 Jun–5 Jul', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'springs, ponds & rain clouds', tag:'Water' },
    building:{ label:'windmills, cottages & docks',  tag:'Building' },
    path:    { label:'stones, kites & rope rails',   tag:'Path' },
    crop:    { label:'cloud gardens',                tag:'Grows' },
    tree:    { label:'blossoms, oaks & pines',       tag:'Tree' },
    special: { label:'the floating temple',          tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:TILE },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 11.5h16l-3.2 3.4-2.6 5.4-1.6-2.4-1.8 1.6-1.2-3.6z" fill="#B49A86"/><path d="M3.5 10.2h17v1.8h-17z" fill="#8FC35A"/><path d="M8.5 10.2V6.4M15.5 10.2V6.4" stroke="#FFFFFF" stroke-width="1.4"/><path d="M7.2 6.6C8 3.8 10 2.6 12 2.6s4 1.2 4.8 4z" fill="#F3C451"/><ellipse cx="18.6" cy="17.6" rx="3" ry="1.6" fill="#DCE8F8"/><ellipse cx="5" cy="19" rx="2.6" ry="1.4" fill="#DCE8F8"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M14 70h100l-18 20-12 24-8-10-10 8-8-12-10 8-10-16z"/><path d="M44 70V48h4v22zM80 70V48h4v22zM62 70V48h4v22z"/><path d="M40 48h48v-5H40z"/><path d="M44 43c2-14 10-22 20-22s18 8 20 22z"/><path d="M63 21v-8h2v8z"/><path d="M92 30c0-7 5-12 11-12s11 5 11 12c0 6-5 10-8 13h-6c-3-3-8-7-8-13z"/><path d="M100 46h6v5h-6z"/><circle cx="22" cy="28" r="7"/><circle cx="30" cy="26" r="9"/><circle cx="38" cy="29" r="6"/></g>',
  album:{ image:'assets/sky/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E4EFFC)' },
  css:'.phone[data-theme="sky"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#ECF3FD 58%,#D6E6F8 100%)}' +
      '.phone[data-theme="sky"]:not([data-night="1"]) .garden{background:radial-gradient(60% 50% at 50% 55%, rgba(206,228,252,.85), rgba(206,228,252,0) 72%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'bed') {
      const base = new THREE.Mesh(G.field, MAT.stoneL); base.position.y = .035; base.castShadow = base.receiveShadow = true; base.userData.ghostHide = true; g.add(base);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(.8, .01, .8), MAT.soil); soil.position.y = .072; soil.userData.ghostHide = true; g.add(soil);
      const host = new THREE.Group(); host.scale.setScalar(1.12); g.add(host); g.userData.plants = host;
      g.userData.regrow = st => fillCloudBed(host, s, st); fillCloudBed(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: s => s.kind === 'bed' ? 1.12 : 1,
  contact: s => s.kind === 'sky' && !['path', 'rail', 'hero', 'pond'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || (s.b === 'path' && s.v === 2) || s.b === 'fountain',
  decor,
  env: buildEnv,
  ambient: addAmbient,
  tick(t){ moveAmbient(t); moveResidents(t); },

  residents:[ { id:'balloon', name:'Hot-air balloons', h:1.2, at:BALLOONS[0].at, face:0, n:3 }, { id:'whale', name:'Sky whale', h:.9, at:WHALE.at, face:WHALE.face, n:1 } ],
  moveIn: skyMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('sky:' + d.id, () => { const o = d.id === 'whale' ? makeWhale() : makeBalloon(0); o.rotation.y = d.id === 'whale' ? 1.2 : .3; return o; }, 168); },
  residentRig(d){ const o = d.id === 'whale' ? makeWhale() : makeBalloon(0); o.scale.setScalar(d.id === 'whale' ? WHALE.s : 1.2); return { obj:o, mixer:new THREE.AnimationMixer(o), clip:null, facing:d.face }; }
};
