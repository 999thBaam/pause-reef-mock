/* CRICKET STADIUM (?theme=cricket) — a toy cricket ground. The plot is a mown outfield (striped tile map) with a dashed inner
   circle; the pitch (with stumps) is the ring-1 hero, tiered stands wrap the two BACK sides (they face the field, so the camera
   sees the crowd's faces) and fill with fans section by section as the "growing" pieces, low things line the front boundary,
   two floodlight towers stand in the side/back corners and the trophy on its podium takes the RIGHT corner (cells 5..6 × 0..1).
   Own 40-slot blueprint, rings 6 / 15 / 19. Everything is procedural three.js merged per material (Acc), except a few trees from
   the shared CC0 Quaternius Stylized Nature MegaKit (kit a). No new asset files. No team names, logos, sponsor text or real players:
   the scoreboard is a grid of lamps, the big screen shows a ball, the boards are plain colour. */
import * as THREE from 'three';
import { rngFrom, TEX, addSway, world } from '../engine/scene.js';
import { S, V, cropStage, hooks } from '../engine/state.js';
import { TILE_TOP, cellPos, edgeCentre } from '../engine/grid.js';
import { KITCACHE, addModel, fitScale } from '../engine/kit.js';
import { Acc, seg, blob, _up } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';

/* ── materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.86, metalness:0, flatShading:true, ...o });
const SM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.8, metalness:0, ...o });
function stripeTex(cols, n=8){
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  for (let i=0;i<n;i++){ g.fillStyle = cols[i % cols.length]; g.fillRect(i*64/n, 0, 64/n + 1, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const MAT = {
  concrete:FM(0xEDE8DF), concreteD:FM(0xD2CBBF), concreteL:FM(0xF8F5EF), white:FM(0xFFFBF4), cream:FM(0xF6ECD8),
  clay:FM(0xE6C58A, { roughness:1 }), clayD:FM(0xC9A56C, { roughness:1 }), clayW:FM(0xD8B478, { roughness:1 }), square:FM(0xA6DB72, { roughness:1 }), crease:FM(0xFFFFFF, { roughness:.6 }),
  stump:FM(0xF4E2B8), wood:FM(0xC08A55), woodD:FM(0x86603C), bat:FM(0xEBCB91), ball:SM(0xD8433B, { roughness:.5 }),
  teal:FM(0x3FB7A8), tealD:FM(0x2E8F84), coral:FM(0xF08A6E), coralD:FM(0xD66B52), sun:FM(0xF7C948), sky:FM(0x6FA8DC), skyD:FM(0x4E86BF),
  lilac:FM(0xB9A3EA), mint:FM(0x8FD8B8), navy:FM(0x34406A), green:FM(0x5DA84A), greenD:FM(0x3F7E36), steel:FM(0xB9C1CB, { roughness:.5, metalness:.25 }),
  steelD:FM(0x7F8894, { roughness:.5, metalness:.25 }), dark:FM(0x3A4052), rubber:FM(0x4A4A52),
  gold:FM(0xF3C451, { emissive:0x7A5200, emissiveIntensity:.3, roughness:.35, metalness:.45 }), goldS:SM(0xF5C84E, { emissive:0x7A5200, emissiveIntensity:.32, roughness:.28, metalness:.55 }),
  glass:FM(0xBFE6F5, { emissive:0x5AA9CC, emissiveIntensity:.25, roughness:.2 }), glassW:FM(0xFFE2A0, { emissive:0xFFA844, emissiveIntensity:.7 }),
  lamp:FM(0xFFFBE8, { emissive:0xFFF1C2, emissiveIntensity:1.2 }), lampOff:FM(0x59606E), lampOn:FM(0xFFD27A, { emissive:0xFFB23A, emissiveIntensity:1.3 }),
  screen:new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.5, emissive:0xFFFFFF, emissiveIntensity:.35, map:null }),
  water:new THREE.MeshStandardMaterial({ color:0x7FD3F2, roughness:.15, metalness:0, emissive:0x1C6E95, emissiveIntensity:.32 }),
  spray:new THREE.MeshStandardMaterial({ color:0xE3F7FF, roughness:.2, transparent:true, opacity:.7, emissive:0x7FD3F2, emissiveIntensity:.35, depthWrite:false }),
  tarp:FM(0x6FB6E8), tarpD:FM(0x4E93C8), net:new THREE.MeshStandardMaterial({ color:0x2F4A3A, roughness:1, transparent:true, opacity:.55, side:THREE.DoubleSide, depthWrite:false }),
  mat:FM(0x6CB45A), rope:FM(0xF6F1E4), leaf:FM(0x6FB041), leafD:FM(0x4F8C34), trunk:FM(0x8C6A4A), pad:FM(0x7CC05A),
  pink:FM(0xF49AB8), yellow:FM(0xF7CF4A), red:FM(0xE8606A), rock:FM(0xC9BFAE), rockL:FM(0xE3DACB),
  // people
  shirtW:FM(0xFBF8F1), trouserW:FM(0xF1ECE0), coat:FM(0xFFFFFF), black:FM(0x2E3140), hat:FM(0xF4EEDF), capN:FM(0x3C4F8C), capT:FM(0x2E8F84),
  padW:FM(0xFFFFFF), glove:FM(0xF4F0E6), hair:FM(0x3A2A20), eye:FM(0x22242E), bird:FM(0xB7BCC8, { side:THREE.DoubleSide }), birdD:FM(0x8E93A3)
};
const SKIN = [0xF1C7A3, 0xE0AE86, 0xC98F66, 0xA9714C, 0x8A5A3C].map(h => FM(h, { flatShading:false }));
const SHIRT = [0xF08A6E, 0x3FB7A8, 0xF7C948, 0x6FA8DC, 0xB9A3EA, 0xF49AB8, 0xFFFBF4, 0x8FD8B8, 0xE8606A, 0x4E86BF].map(h => FM(h));
const AWNING = new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.9, map:stripeTex(['#F08A6E', '#FFF8EC'], 6), side:THREE.DoubleSide });
const AWNING_T = new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:.9, map:stripeTex(['#3FB7A8', '#FFF8EC'], 6), side:THREE.DoubleSide });
/* big screen: a friendly cricket ball on a sky gradient (no text) */
MAT.screen.map = (() => { const W = 128, H = 80, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#8FD0F4'); gr.addColorStop(1, '#D8F0FB'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#9BD36A'; g.fillRect(0, H*.74, W, H*.26);
  g.fillStyle = '#D8433B'; g.beginPath(); g.arc(W/2, H*.44, 20, 0, 6.3); g.fill();
  g.strokeStyle = '#FFF3E0'; g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); g.arc(W/2 - 30, H*.44, 30, -.62, .62); g.stroke(); g.beginPath(); g.arc(W/2 + 30, H*.44, 30, Math.PI - .62, Math.PI + .62); g.stroke();
  g.setLineDash([]); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(W/2 - 7, H*.44 - 8, 5, 0, 6.3); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = FM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }

const _E = new THREE.Euler(), _V = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _M2 = new THREE.Matrix4();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M2.compose(_V.set(x, y, z), _Q2.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function slab(acc, mat, w, h, d, x=0, y=0, z=0, ry=0){ acc.add(bx(w, h, d), mat, at(x, y + h/2, z, ry)); }
function cyl(acc, mat, r0, r1, h, x=0, y=0, z=0, n=12){ acc.add(new THREE.CylinderGeometry(r1, r0, h, n), mat, at(x, y + h/2, z)); }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function glowSprite(parent, pos, scale, color, opacity=.7){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false }));
  s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 9; parent.add(s); return s; }
function gable(acc, mat, w, d, rise, x, y, z, ry=0, over=.05){
  const s = new THREE.Shape(), hw = d/2 + over; s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(0, rise); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth:w + 2*over, bevelEnabled:false }).translate(0, 0, -(w + 2*over)/2).rotateY(Math.PI/2);
  acc.add(geo, mat, at(x, y, z, ry));
}
/* windows / doors on the +z face of a box whose half-depth is hd */
function win(acc, hd, u, y, w=.08, h=.09, glass=MAT.glassW){ acc.add(bx(w + .026, h + .026, .012), MAT.woodD, at(u, y, hd + .004)); acc.add(bx(w, h, .014), glass, at(u, y, hd + .008)); }
function door(acc, hd, u, y, w=.1, h=.17, mat=MAT.skyD){ acc.add(bx(w + .024, h + .012, .012), MAT.woodD, at(u, y + h/2, hd + .004)); acc.add(bx(w, h, .016), mat, at(u, y + h/2, hd + .007)); }
function flag(acc, x, y, z, mat, H=.36, ry=0){
  seg(acc, MAT.steelD, V3(x, y, z), _up, H, .008, .006, 5); blob(acc, MAT.gold, V3(x, y + H + .01, z), .012);
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(.12, -.035); s.lineTo(0, -.07); s.closePath();
  const gg = new THREE.ShapeGeometry(s); acc.add(gg, mat, at(x, y + H - .01, z, ry)); acc.add(gg, mat, at(x, y + H - .01, z, ry + Math.PI, -1, 1, 1));
}
function km(g, name, h, w, x=0, y=0, z=0, rot=0){ const tpl = KITCACHE.a && KITCACHE.a[name]; if (!tpl) return null;
  const k = fitScale(tpl, h, w); return addModel(g, name, k, x, y, z, rot, 'a'); }
/* face the group toward the field: 'z' = +z (front row at +z), 'x' = +x, 'd' = diagonal */
const FACE = { z:0, x:Math.PI/2, d:Math.PI/4 };

/* ── little people: a seated or standing fan (merged into an Acc) ── */
function fan(acc, x, y, z, r, up=false, ry=0){
  const sh = SHIRT[Math.floor(r()*SHIRT.length)], sk = SKIN[Math.floor(r()*SKIN.length)];
  acc.add(new THREE.CylinderGeometry(.026, .032, .07, 8), sh, at(x, y + .035, z));
  acc.add(new THREE.SphereGeometry(.027, 10, 8), sk, at(x, y + .098, z));
  const hq = r();
  if (hq < .35) acc.add(new THREE.SphereGeometry(.029, 10, 6, 0, 6.3, 0, 1.4), SHIRT[Math.floor(r()*SHIRT.length)], at(x, y + .1, z));
  else if (hq < .75) acc.add(new THREE.SphereGeometry(.0285, 10, 6, 0, 6.3, 0, 1.25), MAT.hair, at(x, y + .101, z - .002));
  if (up) for (const sx of [-1, 1]) { seg(acc, sh, V3(x + sx*.024, y + .06, z), V3(sx*.35, 1, .1).normalize(), .06, .009, .008, 5);
    blob(acc, sk, V3(x + sx*.046, y + .118, z + .006), .011); }
  void ry;
}

/* ── STANDS (Sudoku / Math): tiered seating that fills with fans stage by stage ── */
function standFrame(g, s){
  const a = new Acc(), n = s.tiers, dz = .84/n, h = s.tierH, seat = SEATS[s.seat];
  slab(a, MAT.concreteD, .94, .04, .92);
  for (let i=0;i<n;i++){ const z = .42 - (i + .5)*dz, top = .04 + (i + 1)*h;
    slab(a, MAT.concrete, .9, top - .04, dz, 0, .04, z); slab(a, MAT.concreteL, .9, .012, dz*.3, 0, top - .012, z + dz*.35);
    for (let k=0;k<5;k++){ const x = -.36 + k*.18; slab(a, seat, .13, .026, .07, x, top, z - dz*.06); slab(a, seat, .13, .07, .016, x, top, z - dz*.06 - .038); } }
  const back = .04 + n*h;
  slab(a, MAT.concreteD, .94, back + .05 - .04, .05, 0, .04, -.445);
  for (const sx of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(-.44, 0); sh.lineTo(.44, 0); sh.lineTo(.44, .06); sh.lineTo(-.44, back + .05); sh.closePath();
    a.add(new THREE.ExtrudeGeometry(sh, { depth:.03, bevelEnabled:false }).rotateY(-Math.PI/2), MAT.concreteD, at(sx*.465 + (sx < 0 ? .03 : 0), .0, 0)); }
  // a railing along the front
  for (let k=0;k<=4;k++) seg(a, MAT.steelD, V3(-.44 + k*.22, .04, .45), _up, .09, .006, .006, 4);
  a.add(new THREE.CylinderGeometry(.007, .007, .9, 5).rotateZ(Math.PI/2), MAT.steel, at(0, .13, .45));
  if (s.roof) {   // a light canopy over the top rows, on two masts at the back
    const y = back + .32;
    for (const sx of [-.38, .38]) seg(a, MAT.steel, V3(sx, .04, -.44), _up, y - .04 + .02, .014, .012, 6);
    a.add(bx(.98, .025, .42), MAT.white, at(0, y, -.26, 0, 1, 1, 1, -.22));
    a.add(bx(.98, .02, .03), seat, at(0, y - .045, -.05, 0, 1, 1, 1, -.22));
  }
  a.into(g);
}
const SEATS = { teal:MAT.teal, coral:MAT.coral, sun:MAT.sun, sky:MAT.sky, lilac:MAT.lilac, mint:MAT.mint };
const FILL = [0, .1, .32, .58, .82, 1];
function fillStand(host, s, stage){
  host.clear(); const r = rngFrom(s.x*31 + s.z*7 + 11), n = s.tiers, dz = .84/n, h = s.tierH;
  const seats = []; for (let i=0;i<n;i++) for (let k=0;k<5;k++) seats.push([i, k, r()]);
  const order = seats.slice().sort((p, q) => p[2] - q[2]), take = Math.max(stage >= 1 ? 2 : 0, Math.round(FILL[stage]*seats.length));
  const cols = [0,1,2,3,4].map(() => new Acc()), used = [0,0,0,0,0];
  order.slice(0, take).forEach(([i, k]) => { const z = .42 - (i + .5)*dz, top = .04 + (i + 1)*h, x = -.36 + k*.18 + (r() - .5)*.02;
    fan(cols[k], x, top + .012, z - dz*.02, r, stage >= 5 && r() < .45); used[k]++; });
  cols.forEach((c, k) => { if (!used[k]) return; const grp = new THREE.Group(); grp.userData.waveCol = true; c.into(grp); host.add(grp); });
  if (stage >= 5) { const f = new Acc(); flag(f, -.44, .04 + n*h + .04, -.44, SEATS[s.seat], .3); flag(f, .44, .04 + n*h + .04, -.44, MAT.white, .3); f.into(host); }
  host.userData.stage = stage;
}

/* ── the PITCH (To-dos, the ring-1 hero): a clay strip with creases and two sets of stumps, laid across the 2×2 ── */
const PITCH_LEN = 1.9, PITCH_W = .36;
function stumps(acc, x, bail=true){
  for (const dz of [-.042, 0, .042]) cyl(acc, MAT.stump, .016, .015, .22, x, .02, dz, 8);
  if (bail) for (const dz of [-.021, .021]) acc.add(new THREE.CylinderGeometry(.008, .008, .046, 6).rotateX(Math.PI/2), MAT.stump, at(x, .245, dz));
}
function pitch(g){
  const strip = new THREE.Group(); strip.userData.ghostHide = true; strip.rotation.y = FACE.d; g.add(strip);
  const a = new Acc(), L = PITCH_LEN, W = PITCH_W, hl = L/2;
  slab(a, MAT.square, L + .3, .006, W + .62, 0, -.004); slab(a, MAT.clayD, L + .05, .018, W + .05); slab(a, MAT.clay, L, .022, W, 0, .002); slab(a, MAT.clayW, L*.62, .002, W*.5, 0, .024);
  for (const sx of [-1, 1]) {
    slab(a, MAT.crease, .014, .003, W + .02, sx*(hl - .16), .025);        // popping crease
    slab(a, MAT.crease, .012, .003, .26, sx*(hl - .05), .025);             // bowling crease
    for (const sz of [-1, 1]) slab(a, MAT.crease, .2, .003, .012, sx*(hl - .12), .025, sz*.13);   // return creases
  }
  a.into(strip);
  const st = new THREE.Group(); st.rotation.y = FACE.d; g.add(st); const b = new Acc();
  stumps(b, -(hl - .05)); stumps(b, hl - .05);
  // a bat and a ball resting by the far stumps, a cap on the grass
  b.add(bx(.035, .012, .2), MAT.bat, at(hl - .2, .02, .26, .5)); b.add(new THREE.CylinderGeometry(.009, .009, .09, 6).rotateX(Math.PI/2), MAT.navy, at(hl - .2 + Math.sin(.5)*.14, .022, .26 + Math.cos(.5)*.14, .5));
  b.add(new THREE.SphereGeometry(.028, 12, 9), MAT.ball, at(-(hl - .26), .045, -.24));
  b.add(new THREE.SphereGeometry(.05, 12, 6, 0, 6.3, 0, 1.4), MAT.capN, at(-(hl - .5), .012, .3, 0, 1, .7, 1)); b.add(bx(.05, .006, .05), MAT.capN, at(-(hl - .5) + .05, .014, .3));
  b.into(st);
}

/* ── BUILDINGS (Reading / Lesson) ── */
function pavilion(g){
  const a = new Acc();
  slab(a, MAT.concreteD, .9, .04, .88);
  slab(a, MAT.white, .74, .56, .48, 0, .04, -.12); slab(a, MAT.cream, .76, .03, .5, 0, .3, -.12);
  gable(a, MAT.coral, .74, .48, .24, 0, .6, -.12); gable(a, MAT.coral, .22, .2, .14, 0, .6, .12, Math.PI/2, .03);
  a.add(new THREE.CylinderGeometry(.05, .05, .02, 16).rotateX(Math.PI/2), MAT.cream, at(0, .67, .135)); a.add(new THREE.CylinderGeometry(.036, .036, .022, 16).rotateX(Math.PI/2), MAT.glassW, at(0, .67, .137));
  const hd = .12;
  door(a, hd, 0, .04, .14, .2, MAT.skyD); for (const u of [-.24, .24]) win(a, hd, u, .16);
  for (const u of [-.24, 0, .24]) win(a, hd, u, .44, .1, .11);
  // the balcony: a deck on posts with a white railing, right in front of the upper windows
  slab(a, MAT.wood, .76, .025, .18, 0, .33, .2);
  for (const u of [-.36, -.12, .12, .36]) seg(a, MAT.white, V3(u, .04, .28), _up, .29, .014, .014, 6);
  for (let k=0;k<=12;k++) seg(a, MAT.white, V3(-.36 + k*.06, .355, .285), _up, .08, .005, .005, 4);
  slab(a, MAT.white, .76, .014, .02, 0, .435, .285);
  // steps down to the field + a plant each side
  for (let i=0;i<3;i++) slab(a, MAT.concreteL, .3, .02, .06, 0, .04 + i*.0 , .33 + (2 - i)*.0 + i*.035);
  for (const sx of [-1, 1]) { cyl(a, MAT.coralD, .045, .035, .07, sx*.32, .04, .38, 8); blob(a, MAT.leaf, V3(sx*.32, .15, .38), .05, .9); }
  flag(a, 0, .84, -.12, MAT.teal, .24);
  a.into(g);
}
function scoreboard(g){
  const a = new Acc(), r = rngFrom(21);
  slab(a, MAT.concreteD, .82, .04, .7);
  slab(a, MAT.cream, .44, .3, .34, -.14, .04, .12); gable(a, MAT.skyD, .44, .34, .16, -.14, .34, .12);
  door(a, .29, -.2, .04, .1, .17); win(a, .29, -.02, .2, .07, .07);
  // the board: a green panel of lamp dots on two legs, facing the field (no digits)
  for (const sx of [-.3, .3]) seg(a, MAT.steelD, V3(sx + .08, .04, -.2), _up, .44, .02, .018, 6);
  slab(a, MAT.greenD, .74, .38, .06, .08, .42, -.2); slab(a, MAT.woodD, .78, .03, .08, .08, .8, -.2);
  for (let row=0; row<4; row++) for (let col=0; col<9; col++) {
    const on = r() < .45; a.add(new THREE.CylinderGeometry(.018, .018, .012, 8).rotateX(Math.PI/2), on ? MAT.lampOn : MAT.lampOff, at(.08 - .3 + col*.075, .49 + row*.075, -.165)); }
  a.into(g);
}
function commentary(g){
  const a = new Acc();
  slab(a, MAT.concreteD, .78, .04, .78);
  for (const [x, z] of [[-.28,-.26],[.28,-.26],[-.28,.18],[.28,.18]]) seg(a, MAT.steelD, V3(x, .04, z), _up, .4, .02, .02, 6);
  slab(a, MAT.white, .7, .06, .56, 0, .44, -.04); slab(a, MAT.white, .7, .26, .5, 0, .5, -.07);
  slab(a, MAT.glass, .62, .15, .02, 0, .56, .185); for (const u of [-.155, 0, .155]) slab(a, MAT.white, .014, .15, .025, u, .56, .19);
  slab(a, MAT.teal, .76, .04, .6, 0, .76, -.05); slab(a, MAT.tealD, .5, .03, .4, 0, .8, -.08);
  seg(a, MAT.steel, V3(.2, .83, -.14), _up, .12, .006, .006, 4); blob(a, MAT.white, V3(.2, .96, -.14), .03);   // antenna dish
  a.add(new THREE.CylinderGeometry(.05, .05, .01, 12), MAT.steelD, at(.2, .98, -.14, 0, 1, 1, 1, .5));
  // stairs up the side
  for (let i=0;i<7;i++) slab(a, MAT.steel, .1, .015, .06, .3, .05 + i*.058, .34 - i*.055);
  seg(a, MAT.steelD, V3(.35, .05, .36), V3(0, .058, -.055).normalize(), .52, .006, .006, 4);
  a.into(g);
}
function dressingRoom(g){
  const a = new Acc(), W = .7;
  slab(a, MAT.concreteD, .86, .04, .86);
  slab(a, MAT.cream, .5, .34, W, -.1, .04, 0); slab(a, MAT.white, .52, .03, W + .02, -.1, .38, 0);
  slab(a, MAT.skyD, .56, .06, W + .06, -.1, .41, 0);
  // front faces +x (toward the field when the slot faces x): windows + door on +x
  const face = new THREE.Group(); const b = new Acc();
  door(b, .15, 0, .04, .12, .2, MAT.teal); for (const u of [-.21, .21]) win(b, .15, u, .22, .09, .1);
  b.into(face); face.rotation.y = Math.PI/2; face.position.x = -.1 + .1; g.add(face);
  // striped awning + a bench and kit bags under it
  a.add(bx(.2, .012, W - .04), AWNING_T, at(.26, .33, 0, 0, 1, 1, 1, 0, -.35));
  slab(a, MAT.wood, .08, .025, .32, .3, .12, .05); for (const z of [-.08, .18]) slab(a, MAT.woodD, .06, .08, .02, .3, .04, z);
  slab(a, MAT.navy, .1, .06, .07, .32, .04, -.24); slab(a, MAT.coral, .08, .05, .06, .36, .04, -.33);
  a.into(g);
}
function floodlight(g0, s){
  const g = new THREE.Group(); g.rotation.y = s.face || 0; g0.add(g);
  const a = new Acc(), H = 1.85, B = .05, wAt = y => .15 - (y - B)/(H - B)*.1;
  slab(a, MAT.concreteD, .5, .05, .5);
  const C4 = [[-1,-1],[1,-1],[1,1],[-1,1]], P4 = y => C4.map(([x, z]) => V3(x*wAt(y), y, z*wAt(y)));
  const line = (p0, p1, r) => seg(a, r > .008 ? MAT.steel : MAT.steelD, p0, p1.clone().sub(p0).normalize(), p0.distanceTo(p1), r, r*.8, 4);
  { const lo = P4(B), hi = P4(H); for (let i=0;i<4;i++) line(lo[i], hi[i], .014); }
  for (let k=0;k<7;k++){ const y0 = B + k*(H - B)/7, y1 = y0 + (H - B)/7, lo = P4(y0), hi = P4(y1);
    for (let i=0;i<4;i++){ const j = (i + 1) % 4; line(k % 2 ? lo[i] : lo[j], k % 2 ? hi[j] : hi[i], .005); line(hi[i], hi[j], .005); } }
  a.into(g);
  const head = new THREE.Group(), h = new Acc(); head.position.set(0, H + .04, 0); head.rotation.x = .5; g.add(head);
  slab(h, MAT.steelD, .54, .34, .05, 0, -.17, -.02);
  for (let r=0;r<3;r++) for (let c=0;c<4;c++) { h.add(new THREE.CylinderGeometry(.045, .05, .03, 12).rotateX(Math.PI/2), MAT.steel, at(-.195 + c*.13, -.07 - r*.1, .015));
    h.add(new THREE.CylinderGeometry(.04, .04, .012, 12).rotateX(Math.PI/2), MAT.lamp, at(-.195 + c*.13, -.07 - r*.1, .032)); }
  h.into(head); glowSprite(head, V3(0, -.17, .1), .9, 0xFFF4D0, .45);
}
function ticketBooth(g){
  const a = new Acc();
  slab(a, MAT.concreteD, .78, .04, .66);
  slab(a, MAT.cream, .42, .34, .34, -.08, .04, -.06); slab(a, MAT.coral, .46, .05, .38, -.08, .38, -.06);
  a.add(bx(.46, .012, .2), AWNING, at(-.08, .34, .18, 0, 1, 1, 1, .4));
  slab(a, MAT.woodD, .3, .12, .02, -.08, .16, .115); slab(a, MAT.glassW, .24, .1, .02, -.08, .19, .118);   // counter window
  slab(a, MAT.wood, .34, .02, .06, -.08, .14, .15);
  // turnstiles + a rope queue line
  for (const x of [.2, .32]) { cyl(a, MAT.steelD, .03, .03, .16, x, .04, .18, 8); for (let k=0;k<3;k++) { const ang = k*2.1;
    a.add(bx(.1, .008, .008), MAT.steel, at(x + Math.cos(ang)*.05, .17, .18 + Math.sin(ang)*.05, -ang)); } }
  for (const [x, z] of [[-.3, .28], [-.08, .28], [.14, .28]]) { cyl(a, MAT.goldS, .014, .012, .14, x, .04, z, 6); blob(a, MAT.goldS, V3(x, .19, z), .018); }
  for (const [x0, x1] of [[-.3, -.08], [-.08, .14]]) a.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(x0, .17, .28), V3((x0 + x1)/2, .13, .28), V3(x1, .17, .28)]), 8, .007, 4), MAT.coralD);
  a.into(g);
}
function bigScreen(g){
  const a = new Acc();
  slab(a, MAT.concreteD, .6, .04, .8);
  for (const u of [-.25, .25]) seg(a, MAT.steelD, V3(-.1, .04, u), _up, .38, .022, .02, 6);
  slab(a, MAT.dark, .06, .44, .84, -.1, .4, 0);
  a.into(g);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.76, .38), MAT.screen); scr.position.set(-.066, .62, 0); scr.rotation.y = Math.PI/2; g.add(scr);
  const b = new Acc(); for (const sx of [-1, 1]) cyl(b, MAT.dark, .03, .03, .06, -.1, .84, sx*.3, 8); slab(b, MAT.dark, .04, .03, .7, -.1, .84, 0); b.into(g);
}

/* ── WATER (Breathe) ── */
const SPRINKLERS = [];
function sprinkler(g){
  const a = new Acc(), r = rngFrom(41);
  // a damp dark-green patch + the sprinkler on a little stand
  a.add(new THREE.CylinderGeometry(.4, .4, .004, 24), MAT.greenD, at(0, .002, 0, 0, 1, 1, .9));
  cyl(a, MAT.steelD, .05, .06, .03, 0, .004, 0, 10); cyl(a, MAT.steel, .012, .012, .1, 0, .03, 0, 6);
  // the garden hose snaking away
  a.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, .02, 0), V3(-.14, .015, .12), V3(-.3, .015, .05), V3(-.42, .015, .22)]), 16, .012, 5), MAT.sun);
  for (let i=0;i<10;i++){ const ang = r()*6.28, rad = .1 + r()*.28; blob(a, MAT.water, V3(Math.cos(ang)*rad, .006, Math.sin(ang)*rad), .012 + r()*.012, .25); }
  a.into(g);
  const rot = new THREE.Group(); rot.position.set(0, .13, 0); g.add(rot); const b = new Acc();
  cyl(b, MAT.coral, .022, .022, .03, 0, -.015, 0, 8);
  for (const sx of [-1, 1]) { b.add(new THREE.CylinderGeometry(.007, .007, .12, 5).rotateZ(Math.PI/2), MAT.steel, at(sx*.06, 0, 0));
    const arc = new THREE.QuadraticBezierCurve3(V3(sx*.12, 0, 0), V3(sx*.3, .26, 0), V3(sx*.42, -.12, 0));
    b.add(new THREE.TubeGeometry(arc, 14, .016, 5), MAT.spray);
    for (let k=1;k<6;k++){ const p = arc.getPoint(k/6); blob(b, MAT.spray, V3(p.x, p.y + (k%2 ? .02 : -.02), (k%2 ? .03 : -.03)), .014); } }
  b.into(rot); SPRINKLERS.push(rot);
}
function drinksCart(g){
  const a = new Acc();
  slab(a, MAT.white, .5, .18, .3, 0, .08, 0); slab(a, MAT.sky, .52, .03, .32, 0, .26, 0);
  for (const [x, z] of [[-.18,-.16],[.18,-.16],[-.18,.16],[.18,.16]]) a.add(new THREE.CylinderGeometry(.05, .05, .025, 12).rotateX(Math.PI/2), MAT.rubber, at(x, .05, z + (z > 0 ? .01 : -.01)));
  // bottles + a big blue cooler with a tap
  for (let i=0;i<6;i++){ const x = -.19 + i*.055; cyl(a, MAT.glass, .016, .016, .08, x, .29, .07, 8); cyl(a, [MAT.sky, MAT.teal, MAT.coral][i%3], .01, .01, .015, x, .37, .07, 8); }
  cyl(a, MAT.skyD, .075, .075, .14, .12, .29, -.06, 14); cyl(a, MAT.white, .078, .078, .02, .12, .43, -.06, 14);
  a.add(bx(.03, .02, .03), MAT.coral, at(.12, .33, .02));
  // umbrella
  seg(a, MAT.white, V3(-.12, .29, -.08), _up, .42, .008, .008, 5);
  a.add(new THREE.ConeGeometry(.3, .1, 8, 1, true), AWNING, at(-.12, .72, -.08));
  // handle
  seg(a, MAT.steelD, V3(.25, .22, 0), V3(1, .6, 0).normalize(), .14, .008, .008, 4);
  a.into(g);
}
function rainCovers(g){
  const a = new Acc(), r = rngFrom(47);
  // two domed tarp covers (a rolled one too), rain beading on top, a puddle
  a.add(new THREE.SphereGeometry(.36, 16, 8, 0, 6.3, 0, Math.PI/2), MAT.tarp, at(-.06, 0, -.06, .5, 1, .22, .72));
  for (let i=0;i<5;i++) a.add(new THREE.TorusGeometry(.2 + i*.0, .006, 4, 16, Math.PI), MAT.tarpD, at(-.06 + (i - 2)*.1*Math.cos(.5), .0, -.06 - (i - 2)*.1*Math.sin(.5), .5 + Math.PI/2, 1, .38, 1));
  a.add(new THREE.CylinderGeometry(.06, .06, .5, 12).rotateZ(Math.PI/2), MAT.tarpD, at(.2, .06, .3, -.5));
  for (const sx of [-1, 1]) a.add(new THREE.CylinderGeometry(.062, .062, .02, 12).rotateZ(Math.PI/2), MAT.white, at(.2 + sx*.25*Math.cos(.5), .06, .3 - sx*.25*Math.sin(.5), -.5));
  a.add(new THREE.CylinderGeometry(1, 1, .004, 20), MAT.water, at(.28, .003, -.26, 0, .14, 1, .1));
  for (let i=0;i<9;i++){ const ang = r()*6.28, rr = r()*.26; blob(a, MAT.spray, V3(-.06 + Math.cos(ang)*rr, .065 - rr*rr*.4, -.06 + Math.sin(ang)*rr*.72), .012, .7); }
  a.into(g);
}
function lilyPond(g){
  const a = new Acc(), r = rngFrom(53);
  a.add(new THREE.CylinderGeometry(1, 1.06, .04, 26), MAT.rock, at(0, 0, 0, 0, .42, 1, .38));
  a.add(new THREE.CylinderGeometry(1, 1, .02, 26), MAT.water, at(0, .03, 0, 0, .38, 1, .34));
  for (let i=0;i<4;i++) { const ang = r()*6.28, rad = .1 + r()*.16; a.add(new THREE.CylinderGeometry(.06, .06, .008, 10, 1, false, 0, 5.6), MAT.pad, at(Math.cos(ang)*rad, .045, Math.sin(ang)*rad, r()*6));
    if (i%2 === 0) blob(a, MAT.pink, V3(Math.cos(ang)*rad, .06, Math.sin(ang)*rad), .02, .8); }
  for (let i=0;i<7;i++){ const ang = r()*6.28; blob(a, i%2 ? MAT.rock : MAT.rockL, V3(Math.cos(ang)*.42, .02, Math.sin(ang)*.38), .045 + r()*.03, .7, 0, r); }
  for (let i=0;i<5;i++) { const p = V3(-.3 + (r()-.5)*.08, 0, -.26 + (r()-.5)*.08), L = .16 + r()*.12;
    seg(a, swayMat(0x86C454, .3, .06), p, V3((r()-.5)*.3, 1, (r()-.5)*.3).normalize(), L, .01, .002, 4); }
  // a duck
  a.add(new THREE.SphereGeometry(.04, 10, 8), MAT.white, at(.1, .06, .08, .6, 1.3, .8, 1)); blob(a, MAT.white, V3(.13, .1, .1), .025); blob(a, MAT.sun, V3(.155, .098, .115), .01);
  a.into(g);
}
function fountain(g){
  const a = new Acc();
  slab(a, MAT.concreteD, .7, .03, .7, 0, 0, 0, .785);
  cyl(a, MAT.concrete, .3, .3, .1, 0, .03, 0, 16); cyl(a, MAT.water, .26, .26, .01, 0, .12, 0, 16);
  a.add(new THREE.TorusGeometry(.3, .015, 5, 22).rotateX(Math.PI/2), MAT.teal, at(0, .135, 0));
  cyl(a, MAT.concreteL, .045, .04, .2, 0, .1, 0, 10); cyl(a, MAT.concrete, .14, .1, .05, 0, .3, 0, 12); cyl(a, MAT.water, .11, .11, .008, 0, .345, 0, 12);
  a.add(new THREE.CylinderGeometry(.14, .11, .08, 14, 1, true), MAT.spray, at(0, .29, 0));
  a.add(new THREE.ConeGeometry(.025, .16, 6), MAT.spray, at(0, .43, 0)); blob(a, MAT.spray, V3(0, .52, 0), .03);
  for (const [sx, sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) blob(a, MAT.leaf, V3(sx*.3, .07, sz*.3), .05, .8);
  a.into(g);
}

/* ── TREES (Vocab): gulmohar (flame trees) + a few MegaKit oaks and pines around the ground ── */
function gulmohar(g, s){
  const a = new Acc(), r = rngFrom(s.x*5 + s.z*11), H = s.h || 1;
  const base = V3(0, 0, 0), d0 = V3(.08, 1, -.05).normalize();
  seg(a, MAT.trunk, base, d0, .42*H, .05, .032, 7);
  const fork = base.clone().addScaledVector(d0, .42*H), m1 = swayMat(0xEF6A3E, 1.1, .016), m2 = swayMat(0xF58C4A, 1.1, .016), m3 = swayMat(0x7DB84A, 1.1, .016);
  [[.8, .45, -.3, .3], [-.7, .5, .35, .28], [.2, .6, .8, .26], [-.25, .7, -.7, .26], [0, 1, 0, .16]].forEach(([dx, dy, dz, L], i) => {
    const d = V3(dx, dy, dz).normalize(); seg(a, MAT.trunk, fork, d, L*H, .028, .016, 6);
    const tip = fork.clone().addScaledVector(d, L*H), geo = new THREE.IcosahedronGeometry(.23*H*(1 - i*.05), 1), p = geo.attributes.position;
    for (let k=0;k<p.count;k++){ const f = 1 + (r()-.5)*.22; p.setXYZ(k, p.getX(k)*f, p.getY(k)*f, p.getZ(k)*f); }
    a.add(geo, [m1, m2, m1, m2, m3][i], at(tip.x, tip.y + .05, tip.z, r()*6, 1.1, .6, 1.1)); });
  for (let i=0;i<5;i++) blob(a, MAT.red, V3((r()-.5)*.5, .01, (r()-.5)*.5), .018, .3);
  a.into(g);
}
function kitTree(g, s){ km(g, s.model, s.h || 1.25, s.w || 1.0, 0, 0, 0, (s.rot || 0)*Math.PI/180); }

/* ── PATHS & PROPS (To-dos) ── */
function nets(g){
  const a = new Acc();
  slab(a, MAT.mat, .34, .012, .86, 0, 0, 0); slab(a, MAT.crease, .3, .003, .012, 0, .012, .2);
  stumps(a, 0); // stumps sit across x here: rotate so they face +z
  a.into(g);
  const cage = new THREE.Group(), c = new Acc();
  for (const [x, z] of [[-.3,-.42],[.3,-.42],[-.3,.1],[.3,.1],[-.3,.42],[.3,.42]]) seg(c, MAT.steelD, V3(x, 0, z), _up, .42, .01, .01, 5);
  for (const sx of [-1, 1]) c.add(new THREE.PlaneGeometry(.84, .4).rotateY(Math.PI/2), MAT.net, at(sx*.3, .21, 0));
  c.add(new THREE.PlaneGeometry(.6, .4), MAT.net, at(0, .21, -.42)); c.add(new THREE.PlaneGeometry(.6, .84).rotateX(-Math.PI/2), MAT.net, at(0, .42, 0));
  for (const sx of [-1, 1]) c.add(new THREE.CylinderGeometry(.006, .006, .84, 4).rotateX(Math.PI/2), MAT.steel, at(sx*.3, .42, 0));
  c.into(cage); g.add(cage);
  const b = new Acc(); b.add(new THREE.SphereGeometry(.028, 10, 8), MAT.ball, at(.12, .03, .3)); b.add(new THREE.SphereGeometry(.028, 10, 8), MAT.ball, at(-.2, .03, -.3)); b.into(g);
}
function sightScreen(g){
  const a = new Acc();
  for (const u of [-.3, .3]) { slab(a, MAT.steelD, .06, .04, .24, u, .03, 0); for (const w of [-.1, .1]) a.add(new THREE.CylinderGeometry(.03, .03, .02, 10).rotateZ(Math.PI/2), MAT.rubber, at(u, .03, w)); }
  for (const u of [-.3, .3]) seg(a, MAT.steelD, V3(u, .07, -.05), V3(0, 1, -.25).normalize(), .4, .012, .01, 5);
  slab(a, MAT.white, .82, .42, .035, 0, .08, .0); slab(a, MAT.concreteD, .84, .025, .045, 0, .5, 0);
  const inner = new THREE.Group(); inner.rotation.y = -FACE.d; a.into(inner); g.add(inner);
}
function roller(g){
  const a = new Acc();
  a.add(new THREE.CylinderGeometry(.13, .13, .44, 18).rotateZ(Math.PI/2), MAT.green, at(0, .13, .05));
  for (const sx of [-1, 1]) a.add(new THREE.CylinderGeometry(.135, .135, .02, 18).rotateZ(Math.PI/2), MAT.greenD, at(sx*.225, .13, .05));
  a.add(new THREE.CylinderGeometry(.02, .02, .5, 8).rotateZ(Math.PI/2), MAT.steelD, at(0, .13, .05));
  for (const sx of [-1, 1]) seg(a, MAT.steelD, V3(sx*.2, .13, .05), V3(-sx*.35, .55, -1).normalize(), .4, .012, .012, 5);
  a.add(new THREE.CylinderGeometry(.014, .014, .2, 6).rotateZ(Math.PI/2), MAT.coral, at(0, .33, -.3));
  blob(a, MAT.greenD, V3(0, .004, .05), .2, .02);
  a.into(g);
}
function bench(g){
  const a = new Acc();
  slab(a, MAT.wood, .6, .03, .14, 0, .14, -.08); slab(a, MAT.wood, .6, .12, .02, 0, .17, -.16);
  for (const x of [-.26, .26]) slab(a, MAT.woodD, .03, .14, .14, x, 0, -.08);
  // helmets + bats + a kit bag (all plain)
  for (const [x, m] of [[-.16, MAT.capN], [.04, MAT.capT]]) { a.add(new THREE.SphereGeometry(.045, 12, 8, 0, 6.3, 0, 1.6), m, at(x, .17, -.06));
    for (let k=0;k<3;k++) a.add(bx(.075, .005, .005), MAT.steel, at(x, .165 - k*.014, -.02)); }
  for (const x of [.2, .26]) a.add(bx(.035, .22, .012), MAT.bat, at(x, .13, .02, 0, 1, 1, 1, -.25, .1));
  a.add(new THREE.CapsuleGeometry(.06, .22, 3, 8).rotateZ(Math.PI/2), MAT.navy, at(-.05, .06, .16, .15));
  a.add(new THREE.SphereGeometry(.03, 10, 8), MAT.ball, at(.26, .03, .2));
  cyl(a, MAT.sky, .03, .03, .1, .12, .17, -.04, 8);
  a.into(g);
}
/* boundary rope along a front edge, with little plain-colour cushions (no text) */
function boundary(g, s){
  const a = new Acc(), L = s.len;
  const pos = u => s.edge === 'w' ? V3(-.46, 0, u) : V3(u, 0, .46);
  const p0 = pos(-L/2 + .02), p1 = pos(L/2 - .02);
  a.add(new THREE.CylinderGeometry(.018, .018, p0.distanceTo(p1), 8).rotateZ(Math.PI/2), MAT.rope, at((p0.x + p1.x)/2, .02, (p0.z + p1.z)/2, s.edge === 'w' ? Math.PI/2 : 0));
  const n = L*3; for (let i=0;i<n;i++){ const p = pos(-L/2 + (i + .5)/n*L), m = [MAT.teal, MAT.white, MAT.sun][i % 3];
    const sh = new THREE.Shape(); sh.moveTo(-.1, 0); sh.lineTo(.02, 0); sh.lineTo(-.1, .09); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth:L/n*.9, bevelEnabled:true, bevelSize:.01, bevelThickness:.01, bevelSegments:1 }).translate(0, 0, -L/n*.45);
    a.add(geo, m, at(p.x + (s.edge === 'w' ? .08 : 0), .0, p.z - (s.edge === 'w' ? 0 : .08), s.edge === 'w' ? 0 : Math.PI/2)); }
  a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz);
}

/* ── the hero (Gita): the trophy on a podium ── */
function trophy(g0){
  const g = new THREE.Group(); g.scale.setScalar(1.14); g0.add(g);
  const a = new Acc(), r = rngFrom(5);
  // round tiered podium with a gold trim, steps toward the field
  cyl(a, MAT.concreteD, .82, .84, .06, 0, 0, 0, 32); cyl(a, MAT.white, .66, .68, .12, 0, .06, 0, 32);
  a.add(new THREE.TorusGeometry(.67, .014, 6, 36).rotateX(Math.PI/2), MAT.gold, at(0, .18, 0));
  cyl(a, MAT.teal, .44, .46, .12, 0, .18, 0, 28); a.add(new THREE.TorusGeometry(.45, .012, 6, 30).rotateX(Math.PI/2), MAT.gold, at(0, .3, 0));
  cyl(a, MAT.white, .28, .3, .08, 0, .3, 0, 24);
  for (let i=0;i<3;i++) slab(a, MAT.concreteL, .36, .06, .14, 0, i*.06, .72 - i*.1, 0);   // steps (toward +z, rotated below)
  // laurel ring on the podium face
  for (let i=0;i<18;i++){ const ang = i/18*6.28; a.add(new THREE.SphereGeometry(.03, 6, 4), MAT.greenD, at(Math.cos(ang)*.47, .24, Math.sin(ang)*.47, -ang, 1.6, .6, .8)); }
  // the cup: a lathe body, two handles, a lid with a ball on top
  const Y = .38, prof = [[0,0],[.13,0],[.13,.03],[.06,.05],[.045,.12],[.05,.16],[.1,.17],[.2,.24],[.25,.36],[.26,.5],[.24,.56],[.26,.58],[0,.58]].map(([x, y]) => new THREE.Vector2(x, y));
  a.add(new THREE.LatheGeometry(prof, 28), MAT.goldS, at(0, Y, 0));
  cyl(a, MAT.woodD, .16, .17, .05, 0, Y - .05, 0, 20);
  for (const sx of [-1, 1]) a.add(new THREE.TorusGeometry(.1, .022, 8, 18, Math.PI*1.2), MAT.goldS, at(sx*.27, Y + .42, 0, 0, 1, 1, 1, 0, sx > 0 ? -Math.PI*.6 : Math.PI*.4));
  a.add(new THREE.SphereGeometry(.2, 20, 10, 0, 6.3, 0, Math.PI/2), MAT.goldS, at(0, Y + .58, 0, 0, 1, .35, 1));
  cyl(a, MAT.goldS, .03, .02, .08, 0, Y + .64, 0, 10);
  a.add(new THREE.SphereGeometry(.07, 16, 12), MAT.ball, at(0, Y + .78, 0));
  a.add(new THREE.TorusGeometry(.07, .005, 4, 24), MAT.white, at(0, Y + .78, 0, .8));
  // stars + confetti on the podium, two pennant flags at the back
  for (let i=0;i<22;i++){ const ang = r()*6.28, rad = .5 + r()*.28; a.add(bx(.03, .004, .018), [MAT.coral, MAT.sun, MAT.teal, MAT.sky, MAT.pink][i%5], at(Math.cos(ang)*rad, .062, Math.sin(ang)*rad, r()*6)); }
  flag(a, -.55, .06, -.55, MAT.coral, .62, .6); flag(a, .55, .06, -.55, MAT.teal, .62, .6); flag(a, -.72, .06, .1, MAT.sun, .5, .6);
  a.into(g);
  g.rotation.y = -Math.PI/4 + .15;   // steps face the pitch
  glowSprite(g0, V3(0, (Y + .45)*1.14, 0), 1.6, 0xFFE3A6, .35);
  glowSprite(g0, V3(0, (Y + .78)*1.14, 0), .6, 0xFFFFFF, .4);
}

/* ── BLUEPRINT: own 7×7 plan. Stands on the two BACK sides face the field; the front stays low; hero in the right corner ── */
const P = (id, cat, gate, name, x, z, b, o = {}) => ({ id, cat, gate, name, x, z, b, kind:'stadium', ...o });
const STAND = (id, x, z, face, ring, seat, gate) => ({ id, cat:'crop', gate, name:'Stand', kind:'stand', x, z, face, seat, stages:5,
  tiers:ring === 1 ? 2 : ring === 2 ? 3 : 4, tierH:ring === 1 ? .09 : ring === 2 ? .1 : .11, roof:ring === 3 });
const SLOTS = [
  // ── ring 1 ──
  P('pitch', 'path', 'todos', 'Centre pitch', 3, 3, 'pitch', { w:2, d:2 }),
  STAND('stand3_2', 3, 2, 'z', 1, 'teal', 'sudoku'),
  STAND('stand2_3', 2, 3, 'x', 1, 'coral', 'mathtricks'),
  P('score', 'building', 'lesson', 'Scoreboard', 2, 2, 'score'),
  P('sprinkler', 'water', 'breathe', 'Lawn sprinkler', 4, 2, 'sprinkler'),
  P('gul1', 'tree', 'vocab', 'Gulmohar tree', 2, 4, 'gul', { h:1.0 }),
  // ── ring 2 ──
  P('pavilion', 'building', 'lesson', 'Pavilion', 1, 1, 'pavilion'),
  STAND('stand2_1', 2, 1, 'z', 2, 'sun', 'sudoku'),
  P('commentary', 'building', 'lesson', 'Commentary box', 3, 1, 'commentary'),
  STAND('stand4_1', 4, 1, 'z', 2, 'sky', 'mathtricks'),
  STAND('stand1_2', 1, 2, 'x', 2, 'lilac', 'sudoku'),
  P('dressing', 'building', 'lesson', 'Dressing room', 1, 3, 'dressing'),
  STAND('stand1_4', 1, 4, 'x', 2, 'mint', 'sudoku'),
  P('drinks', 'water', 'breathe', 'Drinks cart', 5, 2, 'drinks'),
  P('oak1', 'tree', 'vocab', 'Shade oak', 5, 3, 'kit', { model:'CommonTree_1', h:1.2, rot:40 }),
  P('nets', 'path', 'todos', 'Practice nets', 5, 4, 'nets'),
  P('gul2', 'tree', 'vocab', 'Gulmohar tree', 1, 5, 'gul', { h:1.05 }),
  P('sight', 'path', 'todos', 'Sight screen', 2, 5, 'sight'),
  P('covers', 'water', 'breathe', 'Rain covers', 3, 5, 'covers'),
  P('roller', 'path', 'todos', 'Heavy roller', 4, 5, 'roller'),
  P('pine1', 'tree', 'vocab', 'Boundary pine', 5, 5, 'kit', { model:'Pine_3', h:1.25, w:.85 }),
  // ── ring 3 ──
  P('trophy', 'special', 'gita', 'The trophy', 5, 0, 'trophy', { w:2, d:2 }),
  P('flood1', 'building', 'lesson', 'Floodlight tower', 0, 0, 'flood', { face:Math.PI/4 }),
  STAND('stand1_0', 1, 0, 'z', 3, 'coral', 'sudoku'),
  STAND('stand2_0', 2, 0, 'z', 3, 'teal', 'mathtricks'),
  P('tickets', 'building', 'lesson', 'Ticket booth', 3, 0, 'tickets'),
  STAND('stand4_0', 4, 0, 'z', 3, 'sun', 'sudoku'),
  STAND('stand0_1', 0, 1, 'x', 3, 'sky', 'sudoku'),
  P('screen', 'building', 'lesson', 'Big screen', 0, 2, 'screen'),
  STAND('stand0_3', 0, 3, 'x', 3, 'lilac', 'mathtricks'),
  P('pond', 'water', 'breathe', 'Lily pond', 0, 4, 'pond'),
  P('flood2', 'building', 'lesson', 'Floodlight tower', 0, 6, 'flood', { face:Math.PI*3/4 }),
  P('gul3', 'tree', 'vocab', 'Gulmohar tree', 6, 2, 'gul', { h:1.1 }),
  P('fountain', 'water', 'breathe', 'Fountain', 6, 3, 'fountain'),
  P('oak2', 'tree', 'vocab', 'Shade oak', 6, 4, 'kit', { model:'CommonTree_2', h:1.2, rot:200 }),
  P('bench', 'path', 'todos', "Players' bench", 3, 6, 'bench'),
  P('pine2', 'tree', 'vocab', 'Boundary pine', 4, 6, 'kit', { model:'Pine_1', h:1.2, w:.85, rot:90 }),
  P('rope1', 'path', 'todos', 'Boundary rope', 0, 6, 'rope', { edge:'s', len:2 }),
  P('rope2', 'path', 'todos', 'Boundary rope', 2, 6, 'rope', { edge:'s', len:3 }),
  P('rope3', 'path', 'todos', 'Boundary rope', 5, 6, 'rope', { edge:'s', len:2 })
];
const ORDER = ['pitch', 'stand3_2', 'gul1', 'score', 'sprinkler', 'stand2_3',
  'pavilion', 'stand2_1', 'drinks', 'commentary', 'oak1', 'sight', 'stand1_2', 'covers', 'dressing', 'nets', 'stand4_1', 'gul2', 'roller', 'stand1_4', 'pine1',
  'trophy', 'stand2_0', 'flood1', 'rope2', 'tickets', 'gul3', 'stand0_1', 'fountain', 'screen', 'stand1_0', 'bench', 'oak2', 'flood2', 'stand4_0', 'rope1', 'pond', 'stand0_3', 'pine2', 'rope3'];
const BUILD = { pitch, score:scoreboard, pavilion, commentary, dressing:dressingRoom, flood:floodlight, tickets:ticketBooth, screen:bigScreen,
  sprinkler, drinks:drinksCart, covers:rainCovers, pond:lilyPond, fountain, gul:gulmohar, kit:kitTree, nets, sight:sightScreen, roller, bench, rope:boundary, trophy };

/* ── ground: a mown outfield. Each tile carries two stripes, so the stripes run unbroken across the whole plot ── */
const TILE = { top:['#8CCB58', '#88C755'], side:'#79B548', soilTop:'#A8784A', soilBot:'#6B4A2C' };
function outfieldMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(12);
  g.fillStyle = '#F2F6EA'; g.fillRect(0, 0, N, N);
  g.fillStyle = 'rgba(40,80,20,.16)'; g.fillRect(0, 0, N/2, N);
  g.lineCap = 'round';
  for (let i=0;i<160;i++){ const x = r()*N, y = r()*N, len = 3 + r()*4, a = -Math.PI/2 + (r()-.5)*.6;
    g.strokeStyle = r() < .5 ? 'rgba(70,110,40,.10)' : 'rgba(255,255,240,.5)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a)*len, y + Math.sin(a)*len); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ── env: the dashed inner circle around the pitch (a decal on the grass, sized to the land) ── */
function buildEnv(){
  const L = V.L, env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  const C = cellPos(3.5, 3.5), R = L === 3 ? .95 : L === 5 ? 1.65 : 2.35, n = Math.round(R*26);
  const m = new THREE.MeshBasicMaterial({ color:0xFFFFFF, transparent:true, opacity:.75, depthWrite:false });
  const geos = [];
  for (let i=0;i<n;i++){ const a0 = i/n*6.283; const gg = new THREE.PlaneGeometry(.1, .026).rotateX(-Math.PI/2).rotateY(-a0 - Math.PI/2)
      .translate(C.x + Math.cos(a0)*R, TILE_TOP + .004, C.z + Math.sin(a0)*R);
    const cx = C.x + Math.cos(a0)*R, cz = C.z + Math.sin(a0)*R; if (Math.abs(cx) > L/2 - .08 || Math.abs(cz) > L/2 - .08) continue; geos.push(gg); }
  const acc = new Acc(); geos.forEach(gg => acc.add(gg, m)); acc.into(env);
  env.traverse(o => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 1; } });
}

/* ── decor: a mown outfield has no tufts; empty cells get the odd pigeon pair, a stray ball or a few daisies ── */
function decor(slots){
  SPRINKLERS.length = 0;
  const occ = new Set(); slots.forEach(sl => { if (sl.edge) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.add((sl.x+a)+','+(sl.z+b)); });
  const r = rngFrom(77);
  for (let z=0; z<7; z++) for (let x=0; x<7; x++){
    if (Math.max(Math.abs(x-3), Math.abs(z-3)) > V.ring || occ.has(x+','+z)) continue;
    const p = cellPos(x, z), grp = new THREE.Group(), a = new Acc(); grp.userData.decor = 'meadow'; grp.userData.cell = [x, z]; world.add(grp);
    const q = r();
    if (q < .45) for (let i=0;i<2;i++){ const px = p.x + (r()-.5)*.5, pz = p.z + (r()-.5)*.5, ry = r()*6;
      a.add(new THREE.SphereGeometry(.035, 8, 6), MAT.bird, at(px, p.y + .035, pz, ry, 1, .85, 1.4)); blob(a, MAT.birdD, V3(px + Math.sin(ry)*.035, p.y + .07, pz + Math.cos(ry)*.035), .02); }
    else if (q < .7) a.add(new THREE.SphereGeometry(.028, 10, 8), MAT.ball, at(p.x + (r()-.5)*.4, p.y + .028, p.z + (r()-.5)*.4));
    for (let i=0;i<4;i++) blob(a, i%2 ? MAT.white : MAT.sun, V3(p.x + (r()-.5)*.7, p.y + .008, p.z + (r()-.5)*.7), .014, .5);
    a.into(grp);
  }
}

/* ── ambient: pigeons wheeling, the sprinkler turning ── */
const wingGeo = new THREE.PlaneGeometry(.14, .055).rotateX(-Math.PI/2).translate(.07, 0, 0);
function addAmbient(){
  V.birds = [];
  for (let i=0;i<3;i++){ const b = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), MAT.bird); body.scale.set(.8, .7, 1.8); b.add(body);
    const w1 = new THREE.Mesh(wingGeo, MAT.bird), w2 = new THREE.Mesh(wingGeo, MAT.bird); w2.scale.x = -1; b.add(w1, w2);
    b.userData = { w1, w2, ph:i*2.1, rad:.9 + V.ring*.45 + i*.2, h:1.3 + i*.25 + V.ring*.1, sp:.3 + i*.05 }; world.add(b); V.birds.push(b); V.life.push(b); }
  moveAmbient(2.1);
}
function moveAmbient(t){
  if (!V) return;
  SPRINKLERS.forEach(s => { s.rotation.y = t*.9; });
  (V.birds || []).forEach(b => { const u = b.userData, a = t*u.sp + u.ph; b.visible = !S.night;
    b.position.set(Math.cos(a)*u.rad, TILE_TOP + u.h + Math.sin(a*2.1)*.1, Math.sin(a)*u.rad*.8); b.rotation.y = -a;
    const f = Math.sin(t*5 + u.ph)*.5; u.w1.rotation.z = f; u.w2.rotation.z = -f; });
}

/* ── RESIDENTS: the players walk out of the pavilion to the pitch, the crowd does a Mexican wave, fireworks go up ── */
function person(kind){
  // kind: 'bat' (pads, helmet, bat), 'bowl' (cap, ball), 'ump' (white coat, black trousers, wide hat)
  const g = new THREE.Group(), body = new THREE.Group(), a = new Acc(), sk = SKIN[kind === 'ump' ? 1 : kind === 'bowl' ? 3 : 2];
  const trouser = kind === 'ump' ? MAT.black : MAT.trouserW, top = kind === 'ump' ? MAT.coat : MAT.shirtW;
  a.add(new THREE.CapsuleGeometry(.07, .12, 4, 10), top, at(0, .31, 0, 0, 1, 1, .8));
  if (kind === 'ump') a.add(new THREE.CylinderGeometry(.075, .085, .08, 10), MAT.coat, at(0, .22, 0));
  a.add(new THREE.SphereGeometry(.07, 14, 12), sk, at(0, .47, 0));
  blob(a, MAT.eye, V3(-.028, .48, .062), .009); blob(a, MAT.eye, V3(.028, .48, .062), .009); blob(a, MAT.pink, V3(-.045, .46, .055), .012, .5); blob(a, MAT.pink, V3(.045, .46, .055), .012, .5);
  if (kind === 'bat') { a.add(new THREE.SphereGeometry(.078, 14, 10, 0, 6.3, 0, 1.7), MAT.capN, at(0, .48, -.005));
    for (let k=0;k<3;k++) a.add(bx(.1, .006, .006), MAT.steel, at(0, .455 - k*.018, .075));
    a.add(bx(.06, .006, .07), MAT.capN, at(0, .5, .07)); }
  else if (kind === 'bowl') { a.add(new THREE.SphereGeometry(.074, 14, 8, 0, 6.3, 0, 1.4), MAT.capT, at(0, .49, 0)); a.add(bx(.08, .008, .07), MAT.capT, at(0, .5, .07)); }
  else { a.add(new THREE.CylinderGeometry(.13, .13, .01, 16), MAT.hat, at(0, .51, 0)); a.add(new THREE.CylinderGeometry(.06, .07, .06, 14), MAT.hat, at(0, .54, 0)); }
  a.into(body); g.add(body);
  const legs = [];
  for (const sx of [-1, 1]) { const leg = new THREE.Group(), l = new Acc(); leg.position.set(sx*.035, .2, 0);
    l.add(new THREE.CapsuleGeometry(.028, .12, 3, 8), trouser, at(0, -.1, 0));
    if (kind === 'bat') l.add(new THREE.BoxGeometry(.06, .12, .035), MAT.padW, at(0, -.12, .025));
    l.add(new THREE.SphereGeometry(.032, 8, 6), MAT.white, at(0, -.19, .015, 0, 1, .6, 1.4)); l.into(leg); g.add(leg); legs.push(leg); }
  const arms = [];
  for (const sx of [-1, 1]) { const arm = new THREE.Group(), l = new Acc(); arm.position.set(sx*.085, .38, 0);
    l.add(new THREE.CapsuleGeometry(.022, .1, 3, 6), top, at(0, -.07, 0)); l.add(new THREE.SphereGeometry(.026, 8, 6), kind === 'bat' ? MAT.glove : sk, at(0, -.14, 0));
    if (kind === 'bat' && sx > 0) { l.add(bx(.05, .22, .014), MAT.bat, at(0, -.26, .02)); l.add(new THREE.CylinderGeometry(.012, .012, .08, 6), MAT.navy, at(0, -.14, .02)); }
    if (kind === 'bowl' && sx > 0) l.add(new THREE.SphereGeometry(.024, 10, 8), MAT.ball, at(0, -.16, .02));
    l.into(arm); g.add(arm); arms.push(arm); }
  g.userData.legs = legs; g.userData.arms = arms; g.userData.body = body; return g;
}
const PC = cellPos(3.5, 3.5), AX = V3(Math.SQRT1_2, 0, -Math.SQRT1_2);
const PLAYERS = [
  { kind:'bat',  off:-.72, side:.1,  s:1 },    // striker at the near end
  { kind:'bat',  off:.62,  side:-.16, s:1 },   // non-striker at the far end
  { kind:'bowl', off:1.12, side:.12, s:1 },    // bowler on the run-up
  { kind:'ump',  off:.84,  side:.22, s:1 }     // umpire behind the far stumps
];
const PERP = V3(Math.SQRT1_2, 0, Math.SQRT1_2);
const spotOf = p => PC.clone().addScaledVector(AX, p.off).addScaledVector(PERP, p.side).setY(TILE_TOP + .016);
const GATE_IN = cellPos(1, 1.6);   // they come out of the pavilion
/* fireworks: three bursts above the back stands, looping (at rest in a frozen frame: mid-burst) */
const FW_COLS = [0xFFD27A, 0xF49AB8, 0x8FE3D6, 0xB9A3EA, 0xFFF1C2];
function makeBurst(col, seed){
  const g = new THREE.Group(), r = rngFrom(seed), n = 22, pts = [];
  const mat = new THREE.SpriteMaterial({ map:TEX.star, color:col, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false });
  const matG = new THREE.SpriteMaterial({ map:TEX.glow, color:col, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false });
  for (let i=0;i<n;i++){ const th = r()*6.28, ph = Math.acos(2*r() - 1), d = V3(Math.sin(ph)*Math.cos(th), Math.cos(ph), Math.sin(ph)*Math.sin(th));
    for (let k=0;k<3;k++){ const s = new THREE.Sprite(k ? matG : mat); s.userData.d = d; s.userData.k = k; s.renderOrder = 9; g.add(s); pts.push(s); } }
  const core = new THREE.Sprite(matG); core.userData.core = true; g.add(core);
  g.userData = { pts, mat, matG, core }; return g;
}
function setBurst(b, p, R){
  const u = b.userData, e = 1 - Math.pow(1 - Math.min(1, p/.8), 3), fade = p < .6 ? 1 : Math.max(0, 1 - (p - .6)/.4);
  u.pts.forEach(s => { const d = s.userData.d, k = s.userData.k; s.position.copy(d).multiplyScalar(R*e*(1 - k*.14)); s.position.y -= p*p*.25*R;
    s.scale.setScalar(k ? .09 : .16); });
  u.mat.opacity = fade; u.matG.opacity = fade*.7; u.core.scale.setScalar(.6*(1 - e) + .05); u.core.material.opacity = fade*.6;
  b.visible = p < 1;
}
const FIREWORKS = [ { at:[1.5, 0.2], lift:2.5, off:.9, R:.55 }, { at:[0.2, 2.2], lift:2.2, off:.2, R:.5 }, { at:[3.6, -0.1], lift:2.9, off:1.6, R:.6 } ];
const FW_PERIOD = 2.6;
function moveResidents(t){
  if (!V || !V.res) return;
  V.res.forEach(r => {
    if (r.kind === 'player') { const e = r.arrive, u = r.u, from = GATE_IN, to = u.spot;
      const walking = e < 1, p = from.clone().lerp(to, 1 - Math.pow(1 - e, 1.6));
      r.obj.position.copy(p); const sw = walking ? Math.sin(t*9 + u.ph)*.5 : 0;
      r.obj.rotation.y = walking ? Math.atan2(to.x - from.x, to.z - from.z) : u.face;
      r.obj.userData.legs.forEach((l, i) => l.rotation.x = (i ? -1 : 1)*sw); r.obj.userData.arms.forEach((a, i) => a.rotation.x = (i ? 1 : -1)*sw*.8);
      r.obj.userData.body.position.y = walking ? Math.abs(Math.sin(t*9 + u.ph))*.012 : Math.sin(t*1.5 + u.ph)*.004;
      if (!walking && u.kind === 'bat' && u.off < 0) { r.obj.userData.arms[1].rotation.x = -.35 + Math.sin(t*1.2)*.08; }   // striker: bat grounded, tapping
    } else if (r.kind === 'fw') { const u = r.u; r.obj.visible = r.arrive >= 1;
      r.obj.children.forEach((b, i) => { const p = ((t + u.off + i*.87) % FW_PERIOD)/FW_PERIOD; setBurst(b, p, u.R); }); }
  });
  if (V.waveOn) { const k = V.waveOn;
    if (!V.waveCols) { V.waveCols = []; world.traverse(o => { if (o.userData.waveCol) { const w = o.getWorldPosition(new THREE.Vector3()); o.userData.ang = Math.atan2(w.z - PC.z, w.x - PC.x); V.waveCols.push(o); } }); }
    V.waveCols.forEach(o => { const ph = t*2.2 - o.userData.ang*2.4; const s = Math.max(0, Math.sin(ph)); o.position.y = Math.pow(s, 6)*.06*k; });
  }
}
function arrive(rs, ms){ return new Promise(res => tween(S.rm ? 1 : ms, t => rs.forEach((r, j) => r.arrive = Math.min(1, Math.max(0, t*1.3 - j*.1))),
  () => { rs.forEach(r => r.arrive = 1); res(); })); }
async function cricketMoveIn(walk){
  V.residentsIn = true; V.res = []; V.waveCols = null;
  const addRes = (kind, obj, u) => { const r = { kind, obj, u, arrive:walk ? 0 : 1 }; world.add(obj); V.res.push(r); V.life.push(obj); return r; };
  PLAYERS.forEach(p => V.framePts.push(spotOf(p).clone().setY(TILE_TOP + .6)));
  FIREWORKS.forEach(f => { const c = cellPos(...f.at); V.framePts.push(c.clone().setY(TILE_TOP + f.lift + f.R + .15)); });
  const groups = [
    async () => { const rs = PLAYERS.map((p, i) => { const o = person(p.kind); o.scale.setScalar(p.s);
        const spot = spotOf(p), face = p.off < 0 ? Math.atan2(AX.x, AX.z) : Math.atan2(-AX.x, -AX.z);
        return addRes('player', o, { spot, face, kind:p.kind, off:p.off, ph:i*1.3 }); });
      moveResidents(2.1); if (walk) { await arrive(rs, 2600); sparkle(PC.clone().setY(TILE_TOP + .5), 10, 0xFFF0B0, .6); } },
    async () => { V.waveOn = 1; if (walk) { await new Promise(res => tween(S.rm ? 1 : 2200, () => {}, res)); } },
    async () => { const o = new THREE.Group(); const rs = [];
      FIREWORKS.forEach((f, i) => { const grp = new THREE.Group(), c = cellPos(...f.at); grp.position.copy(c).setY(TILE_TOP + f.lift);
        for (let k=0;k<2;k++) { const b = makeBurst(FW_COLS[(i*2 + k) % FW_COLS.length], 7 + i*5 + k); b.position.set(k ? .35 : -.2, k ? .25 : 0, k ? -.2 : .15); grp.add(b); }
        o.add(grp); rs.push(grp); });
      const r = addRes('fwAll', o, {});
      o.children.forEach((grp, i) => V.res.push({ kind:'fw', obj:grp, u:{ off:FIREWORKS[i].off, R:FIREWORKS[i].R }, arrive:1 }));
      moveResidents(2.1); if (walk) await new Promise(res => tween(S.rm ? 1 : 1600, () => {}, res)); void r; }
  ];
  for (let i=0;i<groups.length;i++){ await groups[i](); if (walk) { V.arrived = i + 1; hooks.renderChrome(); await new Promise(r => setTimeout(r, S.rm ? 0 : 160)); } }
  V.arrived = groups.length;
}
function fansThumb(){
  const g = new THREE.Group(), a = new Acc(), r = rngFrom(9);
  slab(a, MAT.concrete, .6, .08, .2, 0, 0, .08); slab(a, MAT.concrete, .6, .16, .2, 0, 0, -.12);
  for (let k=0;k<4;k++) fan(a, -.22 + k*.15, .08, .1, r, true);
  for (let k=0;k<4;k++) fan(a, -.15 + k*.15, .16, -.1, r, k % 2 === 0);
  a.into(g); return g;
}
function fwThumb(){ const b = makeBurst(0xFFB23A, 3); setBurst(b, .45, .5); const g = new THREE.Group(); g.add(b);
  const b2 = makeBurst(0xF49AB8, 4); setBurst(b2, .3, .35); b2.position.set(.3, -.2, 0); g.add(b2); return g; }

export default {
  id:'cricket', name:'Cricket stadium', title:'Your stadium',
  season:21, dates:'6–19 Jul', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'sprinklers, fountains & ponds', tag:'Water' },
    building:{ label:'pavilion, boxes & floodlights', tag:'Building' },
    path:    { label:'pitch, nets & boundary rope',   tag:'Ground' },
    crop:    { label:'stands that fill with fans',    tag:'Crowd' },
    tree:    { label:'gulmohars, oaks & pines',       tag:'Tree' },
    special: { label:'the trophy',                    tag:'Special' }
  },
  slots:SLOTS, order:ORDER,
  ground:{ tile:TILE, tileMap:outfieldMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><ellipse cx="12" cy="15" rx="10" ry="6" fill="#8CCB58"/><path d="M2 15c0-3.3 4.5-6 10-6s10 2.7 10 6l-2-.4C19 12.3 15.9 11 12 11s-7 1.3-8 3.6z" fill="#3FB7A8"/><rect x="10.6" y="12.6" width="2.8" height="5" rx=".6" fill="#E3C995"/><path d="M8.2 3.5h7.6l-.6 3.2a3.2 3.2 0 0 1-6.4 0z" fill="#F3C451"/><path d="M11.2 9.3h1.6v1.4h-1.6z" fill="#F3C451"/><circle cx="18.5" cy="5.5" r="1.8" fill="#D8433B"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M8 96c0-14 25-26 56-26s56 12 56 26c0 10-25 18-56 18S8 106 8 96z"/><path d="M14 88l-4-26 22-6 4 26zM114 88l4-26-22-6-4 26zM40 74l-2-20h52l-2 20z"/><path d="M48 12h32l-3 18a13 13 0 0 1-26 0z"/><path d="M60 42h8v8h-8zM54 50h20v5H54z"/><path d="M40 16c-8 0-8 12 6 14l1-4c-6-1-6-6-2-6zM88 16c8 0 8 12-6 14l-1-4c6-1 6-6 2-6z"/><circle cx="104" cy="22" r="7"/></g>',
  album:{ image:'assets/cricket/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E6F2DC)' },
  css:'.phone[data-theme="cricket"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#F1F7EA 58%,#DDEBD0 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'stand') {
      const inner = new THREE.Group(); inner.rotation.y = FACE[s.face]; g.add(inner); standFrame(inner, s);
      const host = new THREE.Group(); inner.add(host); g.userData.plants = host;
      g.userData.regrow = st => { fillStand(host, s, st); V && (V.waveCols = null); }; fillStand(host, s, stage);
    } else BUILD[s.b](g, s);
  },
  scaleOf: () => 1,
  contact: s => !['pitch', 'rope', 'sprinkler', 'covers', 'pond', 'trophy'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.b === 'fountain',
  ghost:{ color:'#FFFFFF', opacity:.4 },
  decor,
  env: buildEnv,
  ambient: addAmbient,
  tick(t){ moveAmbient(t); moveResidents(t); },

  residents:[ { id:'players', name:'Players', h:.6, at:[3.5, 3.5], face:0, n:4 }, { id:'wave', name:'Mexican wave', h:.3, at:[2, 1], face:0, n:1 },
    { id:'fireworks', name:'Fireworks', h:.6, at:[1.5, 0.2], face:0, n:1 } ],
  moveIn: cricketMoveIn,
  residentThumb(d, thumbFor){
    return thumbFor('cricket:' + d.id, () => { if (d.id === 'wave') return fansThumb(); if (d.id === 'fireworks') return fwThumb();
      const o = person('bat'); o.rotation.y = .5; return o; }, 168); },
  residentRig(d){ const o = d.id === 'wave' ? fansThumb() : d.id === 'fireworks' ? fwThumb() : person('bat'); return { obj:o, mixer:new THREE.AnimationMixer(o), clip:null, facing:d.face }; }
};
