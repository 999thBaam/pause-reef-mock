/* NORTHERN LIGHTS (?theme=aurora) — a Nordic village at blue hour under the aurora. Built on the farm's 7×7 ring blueprint
   (FARM_SLOTS: hero on the right, rings 6 / 15 / 19, FARM_ORDER), so pick-3, growth and expansion behave exactly like the farm.
   Everything is procedural flat-shaded geometry, merged per material (Acc): falu-red / ochre / fjord-blue board houses with
   turf roofs under snow, a stabbur on stilts, a sauna, a boathouse, deep-teal spruces and frosted birches, ice sculptures that
   get carved stage by stage, snow lanterns, roundpole fences and the aurora observatory.
   The star of the theme is env(): aurora ribbons hung behind the land that get brighter (and gain a 2nd and 3rd curtain) with
   every piece placed, over a night-blue backdrop with twinkling stars. The aurora is also reflected in the aurora pool.
   Residents: the shared CC0 Stag / Deer / Fox GLBs recoloured as reindeer, a reindeer calf and an arctic fox, plus a code-built
   snowy owl on a post. No new asset files. */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { rngFrom, world, fx, TEX } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { loadAnimal, modelBox } from '../engine/kit.js';
import { G, Acc, blob, seg } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { FARM_SLOTS, FARM_ORDER } from './farm.js';

/* ── materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.9, metalness:0, flatShading:true, ...o });
const GL = (hex, em, k) => new THREE.MeshStandardMaterial({ color:hex, emissive:em, emissiveIntensity:k, roughness:.5, metalness:0 });
const N = {
  snow:FM(0xF4F6FD, { roughness:1 }), snowB:FM(0xDCE3F5, { roughness:1 }), snowSh:FM(0xC3CDEA, { roughness:1 }), packed:FM(0xCDD5EC, { roughness:1 }),
  stone:FM(0x8D94B2), stoneD:FM(0x6A7192), rock:FM(0x777E9E),
  red:FM(0xA9392F), ochre:FM(0xD49A3A), blue:FM(0x3C6D8C), cream:FM(0xE4D8C0), char:FM(0x4B403D),
  trim:FM(0xF5F2EA), roof:FM(0x383D55), turf:FM(0x4F6E48), door:FM(0x2D384B), wood:FM(0x8A5A38), woodD:FM(0x5B3C27), woodL:FM(0xB98556),
  spruce:FM(0x2B5A55), spruceD:FM(0x21474A), birch:FM(0xEEEDE6), mark:FM(0x2D2D36), twig:FM(0x5D4636),
  ice:new THREE.MeshStandardMaterial({ color:0xC4ECF8, roughness:.14, metalness:0, flatShading:true, emissive:0x3DA3C9, emissiveIntensity:.24 }),
  iceLit:new THREE.MeshStandardMaterial({ color:0xD8FBF4, roughness:.14, metalness:0, flatShading:true, emissive:0x46E0C4, emissiveIntensity:.62 }),
  iceD:FM(0x9DCFE8, { roughness:.2 }),
  water:new THREE.MeshStandardMaterial({ color:0x1F2E58, roughness:.06, metalness:0, emissive:0x0B1A44, emissiveIntensity:.4 }),
  glow:GL(0xFFD27A, 0xFFA83A, 1.25), candle:GL(0xFFE2A0, 0xFFB347, 1.6),
  brass:FM(0xC9A45C, { roughness:.5, emissive:0x3A2A00, emissiveIntensity:.2 }), dome:FM(0xE6ECF7, { roughness:.5 }), slit:FM(0x1A2138),
  beacon:GL(0xA8FFE0, 0x3CF0B0, 1.4), wool:FM(0xC8463B), woolB:FM(0x3F7FD0), iron:FM(0x2C2E38),
  ski1:FM(0xD8443A), ski2:FM(0x3A8FD0)
};
const SHADE = new Map([[N.red, FM(0x8E2E26)], [N.ochre, FM(0xB88230)], [N.blue, FM(0x2F5872)], [N.cream, FM(0xC9BBA0)], [N.char, FM(0x3A3130)]]);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylG = (r0, r1, h, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n);
const SPH = new THREE.SphereGeometry(1, 10, 8), SPH_LO = new THREE.IcosahedronGeometry(1, 0);
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/* ── snow helpers ── */
function mound(a, x, z, r, h, rng, mat = N.snow, y = 0){ const g = new THREE.IcosahedronGeometry(1, 1);
  if (rng) { const p = g.attributes.position; for (let i=0;i<p.count;i++){ const k = 1 + (rng()-.5)*.18; p.setXYZ(i, p.getX(i)*k, p.getY(i)*k, p.getZ(i)*k); } }
  a.add(g, mat, at(x, y, z, rng ? rng()*3 : 0, r, h, r*(rng ? .8 + rng()*.3 : 1))); }
function skirt(a, rng, half, n = 8){ for (let i=0;i<n;i++){ const ang = rng()*6.28, d = half*(.82 + rng()*.18); mound(a, Math.cos(ang)*d, Math.sin(ang)*d, .07 + rng()*.06, .045 + rng()*.03, rng); } }
function icicles(a, x0, x1, y, z, rng, n){ for (let i=0;i<n;i++){ const x = x0 + (x1-x0)*(i+.5)/n, h = .035 + rng()*.06;
  a.add(new THREE.ConeGeometry(.011, h, 5).rotateX(Math.PI), N.iceD, at(x, y - h/2, z)); } }
/* a snow lantern (snölykta): a little pyramid of snowballs with a candle glowing inside */
function snowLantern(a, x, z, k = 1){ const r = .035*k;
  const rows = [[3, 0], [2, 1], [1, 2]];
  rows.forEach(([n, lv]) => { for (let i=0;i<n;i++) for (let j=0;j<n;j++){ if (lv === 0 && i === 1 && j === 1) continue;
    const off = (n - 1)/2; a.add(SPH, N.snow, at(x + (i - off)*r*1.9, r*.9 + lv*r*1.55, z + (j - off)*r*1.9, 0, r, r*.9, r)); } });
  a.add(SPH, N.candle, at(x, r*1.1, z, 0, r*.9, r*.9, r*.9)); }

/* ── NORDIC HOUSE: board walls with white corner trim, gable roof along x under a thick snow cap (turf showing at the eaves),
   warm windows with a cross mullion on the two faces the camera sees ── */
function house(a, o){
  const { w = .62, d = .5, h = .36, wall = N.red, cx = 0, cz = 0, y0 = .05, pitch = .72, turf = true, chimney = true, door = true, winZ = 1, winX = 1, rng } = o;
  if (y0 <= .06) a.add(box(w + .07, .05, d + .07), N.stoneD, at(cx, .025, cz));
  a.add(box(w, h, d), wall, at(cx, y0 + h/2, cz));
  const bat = SHADE.get(wall) || wall, nb = Math.max(4, Math.round(w/.075)), nz = Math.max(3, Math.round(d/.075));
  for (let i=0;i<nb;i++) a.add(box(.012, h, .01), bat, at(cx - w/2 + (i + .5)*w/nb, y0 + h/2, cz + d/2 + .004));
  for (let i=0;i<nz;i++) a.add(box(.01, h, .012), bat, at(cx + w/2 + .004, y0 + h/2, cz - d/2 + (i + .5)*d/nz));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.add(box(.035, h + .01, .035), N.trim, at(cx + sx*w/2, y0 + h/2, cz + sz*d/2));
  const top = y0 + h, rise = (d/2)*Math.tan(pitch), ov = .08, L = (d/2 + ov)/Math.cos(pitch);
  const gable = new THREE.Shape([new THREE.Vector2(-d/2, 0), new THREE.Vector2(d/2, 0), new THREE.Vector2(0, rise)]);
  const gg = new THREE.ExtrudeGeometry(gable, { depth:.04, bevelEnabled:false }).rotateY(Math.PI/2);
  for (const sx of [-1, 1]) a.add(gg, wall, at(cx + sx*(w/2 - .02) - .02, top, cz));
  for (const sz of [-1, 1]) {
    const mid = new THREE.Vector3(cx, top + rise - Math.sin(pitch)*L/2 + .015, cz + sz*Math.cos(pitch)*L/2);
    a.add(box(w + .16, .03, L), N.roof, at(mid.x, mid.y, mid.z, 0, 1, 1, 1, sz*pitch));
    if (turf) a.add(box(w + .17, .03, L - .02), N.turf, at(mid.x, mid.y + .028, mid.z, 0, 1, 1, 1, sz*pitch));
    a.add(box(w + .2, .055, L - .03), N.snow, at(mid.x, mid.y + (turf ? .065 : .04), mid.z - sz*.004, 0, 1, 1, 1, sz*pitch));
  }
  a.add(new THREE.CylinderGeometry(.04, .04, w + .2, 7).rotateZ(Math.PI/2), N.snow, at(cx, top + rise + .075, cz));
  if (rng) icicles(a, cx - w/2 - .06, cx + w/2 + .06, top + .01, cz + d/2 + ov*.85, rng, Math.round(w*11));
  // barge boards: white crossed ends at the gable peak (a Nordic touch)
  for (const sx of [1]) { const gx = cx + sx*(w/2 + .03);
    for (const sz of [-1, 1]) a.add(box(.02, .03, L*.95), N.trim, at(gx, top + rise/2 + .02, cz + sz*d/4, 0, 1, 1, 1, sz*pitch)); }
  if (chimney) { const chx = cx - w*.24, chz = cz - d*.16; a.add(box(.1, rise + .2, .1), N.stone, at(chx, top + (rise + .2)/2 + .04, chz));
    a.add(box(.13, .045, .13), N.snow, at(chx, top + rise + .26, chz)); }
  const win = (x, y, z, ry) => { a.add(box(.13, .14, .02), N.trim, at(x, y, z, ry)); a.add(box(.095, .105, .024), N.glow, at(x, y, z, ry));
    a.add(box(.012, .11, .028), N.trim, at(x, y, z, ry)); a.add(box(.1, .012, .028), N.trim, at(x, y, z, ry)); };
  const wy = y0 + h*.56;
  if (door) { const dx = cx - w*.22; a.add(box(.12, .21, .02), N.door, at(dx, y0 + .105, cz + d/2 + .01)); a.add(box(.15, .025, .03), N.trim, at(dx, y0 + .225, cz + d/2 + .012));
    a.add(SPH, N.glow, at(dx + .1, y0 + .2, cz + d/2 + .03, 0, .022, .022, .022)); }
  for (let i=0;i<winZ;i++) win(cx + (door ? w*.18 : 0) + (winZ > 1 ? (i - (winZ - 1)/2)*w*.3 : 0), wy, cz + d/2 + .012, 0);
  for (let i=0;i<winX;i++) win(cx + w/2 + .012, wy, cz + (winX > 1 ? (i - (winX - 1)/2)*d*.44 : 0), Math.PI/2);
  return { top, rise };
}
function woodpile(a, x, z, n = 3){ for (let i=0;i<n;i++) for (let j=0;j<n-i;j++) a.add(new THREE.CylinderGeometry(.032, .032, .24, 6).rotateX(Math.PI/2), (i + j)%2 ? N.woodL : N.wood, at(x + j*.066 + i*.033, .04 + i*.058, z));
  a.add(box(.06*n + .04, .03, .27), N.snow, at(x + (n - 1)*.033, .04 + (n - 1)*.058 + .045, z)); }
function kicksled(a, x, z, ry){ const c = Math.cos(ry), s = Math.sin(ry), p = (u, y, v) => at(x + u*c + v*s, y, z - u*s + v*c, ry);
  for (const u of [-.05, .05]) { a.add(box(.012, .012, .36), N.iron, p(u, .012, 0)); a.add(box(.012, .2, .012), N.woodD, p(u, .11, -.06)); a.add(box(.012, .14, .012), N.woodD, p(u, .2, -.16, 0)); }
  a.add(box(.12, .015, .1), N.wool, p(0, .14, -.02)); a.add(box(.12, .1, .015), N.woodD, p(0, .19, -.08)); a.add(box(.14, .015, .015), N.woodD, p(0, .29, -.17)); }
function lanternPost(a, x, z, hgt = .42){ a.add(box(.03, hgt, .03), N.iron, at(x, hgt/2, z)); a.add(box(.08, .02, .08), N.iron, at(x, hgt + .01, z));
  a.add(box(.06, .07, .06), N.glow, at(x, hgt + .055, z)); a.add(new THREE.ConeGeometry(.06, .05, 4), N.iron, at(x, hgt + .115, z, Math.PI/4)); a.add(new THREE.ConeGeometry(.055, .03, 4), N.snow, at(x, hgt + .13, z, Math.PI/4)); }

/* ── spruce (deep teal tiers, each carrying a snow load) and a frosted birch ── */
function spruce(a, x, z, hgt, rad, rng){
  a.add(cylG(.03*rad/.3, .04*rad/.3, hgt*.2, 6), N.woodD, at(x, hgt*.1, z));
  const tiers = 5;
  for (let i=0;i<tiers;i++){ const t = i/tiers, r = rad*(1 - t*.78), ht = hgt*.3, y = hgt*.14 + t*hgt*.7;
    a.add(new THREE.ConeGeometry(r, ht, 8), i%2 ? N.spruce : N.spruceD, at(x, y + ht/2, z, rng()*3));
    a.add(new THREE.ConeGeometry(r*.8, ht*.52, 8), N.snow, at(x - r*.04, y + ht*.62, z - r*.04, rng()*3)); }
  a.add(new THREE.ConeGeometry(rad*.16, hgt*.12, 6), N.snow, at(x, hgt*.97, z));
}
function birch(a, x, z, hgt, rng){
  const lean = (rng() - .5)*.12, top = new THREE.Vector3(x + lean, hgt, z + lean*.5);
  seg(a, N.birch, new THREE.Vector3(x, 0, z), top.clone().sub(new THREE.Vector3(x, 0, z)).normalize(), hgt, .028, .014, 6);
  for (let i=0;i<5;i++){ const t = .15 + i*.14; a.add(box(.034, .012, .01), N.mark, at(x + lean*t, hgt*t, z + lean*.5*t + .024, rng())); }
  for (let i=0;i<5;i++){ const t = .45 + i*.1, p = new THREE.Vector3(x + lean*t, hgt*t, z + lean*.5*t), ang = rng()*6.28;
    const dir = new THREE.Vector3(Math.cos(ang), .9 + rng()*.5, Math.sin(ang)).normalize(), len = .14 + rng()*.1;
    seg(a, N.twig, p, dir, len, .008, .003, 4); a.add(SPH, N.snow, at(p.x + dir.x*len*.7, p.y + dir.y*len*.7 + .012, p.z + dir.z*len*.7, 0, .025, .013, .025)); }
  a.add(SPH, N.snow, at(top.x, top.y, top.z, 0, .03, .018, .03));
}

/* ── ICE SCULPTURES (Sudoku/Math): blocks on a sledge → one tall block → roughed out → finished → lit from within ── */
function iceShape(a, kind, mat, rough, k = 1){
  const S2 = rough ? SPH_LO : SPH, y0 = .12;
  if (kind === 0) {           // swan
    a.add(S2, mat, at(0, y0 + .1*k, 0, .5, .15*k, .1*k, .22*k));
    for (const sx of [-1, 1]) a.add(S2, mat, at(sx*.09*k, y0 + .15*k, -.03*k, .5, .06*k, .07*k, .17*k, -.5, sx*.4));
    const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(0, y0 + .12*k, .14*k), new THREE.Vector3(0, y0 + .26*k, .2*k), new THREE.Vector3(0, y0 + .36*k, .12*k), new THREE.Vector3(0, y0 + .4*k, .16*k)]);
    a.add(new THREE.TubeGeometry(neck, rough ? 4 : 10, .028*k, rough ? 4 : 7), mat, at(0, 0, 0, .5));
    a.add(S2, mat, at(.16*k*Math.sin(.5), y0 + .41*k, .16*k*Math.cos(.5), .5, .04*k, .035*k, .05*k));
    if (!rough) a.add(new THREE.ConeGeometry(.014*k, .06*k, 5).rotateX(Math.PI/2), mat, at(.2*k*Math.sin(.5), y0 + .405*k, .2*k*Math.cos(.5), .5));
  } else if (kind === 1) {    // sitting bear
    a.add(S2, mat, at(0, y0 + .14*k, 0, 0, .15*k, .16*k, .13*k));
    a.add(S2, mat, at(0, y0 + .34*k, .03*k, 0, .1*k, .09*k, .095*k));
    a.add(S2, mat, at(0, y0 + .32*k, .12*k, 0, .045*k, .035*k, .04*k));
    for (const sx of [-1, 1]) { a.add(S2, mat, at(sx*.07*k, y0 + .42*k, .02*k, 0, .03*k, .03*k, .02*k));
      a.add(S2, mat, at(sx*.1*k, y0 + .04*k, .1*k, 0, .045*k, .04*k, .07*k)); a.add(S2, mat, at(sx*.12*k, y0 + .16*k, .07*k, 0, .035*k, .07*k, .04*k)); }
  } else {                    // crystal star on a spire
    a.add(new THREE.CylinderGeometry(.03*k, .08*k, .28*k, rough ? 4 : 6), mat, at(0, y0 + .14*k, 0));
    for (let i=0;i<4;i++){ const ang = i*Math.PI/2 + .4; a.add(new THREE.OctahedronGeometry(.05*k, 0), mat, at(Math.cos(ang)*.07*k, y0 + .06*k, Math.sin(ang)*.07*k, ang, .7, 1.6, .7)); }
    const pts = []; for (let i=0;i<10;i++){ const r = (i%2 ? .05 : .13)*k, ang = i/10*Math.PI*2 + Math.PI/2; pts.push(new THREE.Vector2(Math.cos(ang)*r, Math.sin(ang)*r)); }
    const star = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth:.035*k, bevelEnabled:!rough, bevelSize:.01*k, bevelThickness:.01*k, bevelSegments:1 }).translate(0, 0, -.0175*k);
    a.add(star, mat, at(0, y0 + .4*k, 0, .78));
  }
}
function fillSculpture(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 5), st = Math.min(5, stage), kind = s.v, k = 1.25;
  if (st <= 1) {             // ice blocks hauled in on a sledge, with the saw
    for (const u of [-.1, .1]) a.add(box(.02, .02, .5), N.woodD, at(u, .015, 0, .4));
    a.add(box(.26, .02, .36), N.wood, at(0, .035, 0, .4));
    [[-.05, .08, -.06], [.07, .08, .05], [0, .19, 0]].forEach(([x, y, z]) => a.add(box(.14, .11, .14), N.ice, at(x, y, z, .4 + r()*.2)));
    a.add(box(.2, .012, .05), N.iron, at(.24, .02, .26, 1.1));
  } else {
    a.add(box(.42, .12, .42), N.snowB, at(0, .06, 0, .1));                     // snow plinth
    a.add(box(.44, .02, .44), N.snow, at(0, .125, 0, .1));
    if (st === 2) { a.add(box(.24, .44, .2), N.ice, at(0, .34, 0, .5));
      a.add(box(.012, .14, .012), N.woodL, at(.26, .2, .24, 0, 1, 1, 1, .3)); a.add(box(.02, .03, .03), N.iron, at(.28, .28, .24)); }
    else { iceShape(a, kind, st >= 5 ? N.iceLit : N.ice, st === 3, k);
      if (st === 3) a.add(box(.2, .1, .18), N.ice, at(.02, .17, -.02, .5));            // the uncarved base still showing
      for (let i=0;i<(st === 3 ? 5 : 2);i++) a.add(new THREE.OctahedronGeometry(.018, 0), N.iceD, at((r()-.5)*.5, .14, (r()-.5)*.5, r()*3));   // chips
      if (st >= 5) { snowLantern(a, -.3, .3, .9); snowLantern(a, .3, .3, .9); } }
  }
  a.into(host);
  if (st >= 5) { const g = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0x7CF5D6, transparent:true, opacity:.45, blending:THREE.AdditiveBlending, depthWrite:false }));
    g.position.set(0, .45, 0); g.scale.setScalar(.8); g.userData.glow = true; host.add(g); }
  host.userData.stage = stage;
}

/* ── the aurora texture: green curtains at the base, teal → violet above, streaked, fading out at the top ── */
const AUR_TEX = (() => {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
  const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0)/(e1 - e0))); return t*t*(3 - 2*t); };
  for (let x=0;x<W;x++){ const u = x/W*Math.PI*2;
    const cur = .72 + .28*(.5*Math.sin(u*3) + .3*Math.sin(u*7 + 1) + .2*Math.sin(u*13 + 2)), streak = .7 + .3*Math.sin(u*41) * Math.sin(u*17 + .5);
    for (let y=0;y<H;y++){ const v = 1 - y/(H - 1), i = (y*W + x)*4;
      const cG = [110, 255, 175], cT = [80, 225, 220], cV = [175, 125, 255], m1 = sm(.25, .55, v), m2 = sm(.5, .85, v);
      const col = [0, 1, 2].map(k => cG[k]*(1 - m1) + cT[k]*m1*(1 - m2) + cV[k]*m2);
      const base = v < .06 ? 1 + (.06 - v)*6 : 1;
      const a = sm(0, .05, v) * (1 - sm(.3, 1, v)) * Math.max(0, cur) * streak;
      d[i] = Math.min(255, col[0]*base); d[i+1] = Math.min(255, col[1]*base); d[i+2] = Math.min(255, col[2]*base); d[i+3] = Math.min(255, a*255); } }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
})();
const AUR_MAT = () => new THREE.MeshBasicMaterial({ map:AUR_TEX, transparent:true, opacity:.6, side:THREE.DoubleSide, depthWrite:false, fog:false });

/* ── named pieces ── */
const B = {
  longhouse(g){                                             // ring-1 hero: a long red turf-roofed house, porch lantern, woodpile, kicksled
    const a = new Acc(), r = rngFrom(222);
    a.add(box(1.86, .03, 1.86), N.packed, at(0, .015, 0));
    const yard = new THREE.Group(); a.into(yard); yard.userData.ghostHide = true; g.add(yard);
    const b = new Acc();
    house(b, { w:1.3, d:.78, h:.5, wall:N.red, cx:-.08, cz:-.26, winZ:3, winX:2, rng:r });
    b.add(box(.6, .03, .26), N.woodD, at(-.08 - 1.3*.22 + .1, .06, .26));                  // porch step
    woodpile(b, .52, .48); kicksled(b, -.62, .5, .5);
    snowLantern(b, .2, .66); snowLantern(b, -.2, .72, .9); lanternPost(b, .76, .16, .5);
    b.add(box(.3, .1, .08), N.woodD, at(-.72, .09, .78, .2)); b.add(box(.32, .03, .1), N.snow, at(-.72, .155, .78, .2));    // bench
    skirt(b, r, .9, 12); b.into(g);
  },
  cottage(g, s){ const a = new Acc(), r = rngFrom(s.x*9 + s.z*5 + 1);
    house(a, { w:.62, d:.52, h:.36, wall:s.wall, cx:-.03, cz:-.06, winZ:1, winX:1, chimney:!s.nochim, turf:s.turf !== false, rng:r });
    if (s.logs) woodpile(a, .2, .34, 2); else snowLantern(a, .3, .34, .9);
    skirt(a, r, .44, 6); a.into(g); },
  stabbur(g){ const a = new Acc(), r = rngFrom(81);          // storehouse on stilts: the upper floor overhangs
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { a.add(box(.06, .18, .06), N.woodD, at(sx*.2, .09, sz*.16)); a.add(box(.1, .04, .1), N.stone, at(sx*.2, .2, sz*.16)); }
    house(a, { w:.5, d:.42, h:.24, wall:N.ochre, y0:.22, cx:0, cz:0, door:false, winZ:1, winX:0, chimney:false, rng:r });
    a.add(box(.62, .05, .52), N.woodD, at(0, .44, 0));                                     // the overhanging loft band
    for (let i=0;i<4;i++) a.add(box(.1, .018, .06), N.woodL, at(.05, .03 + i*.055, .32 + i*.02));   // steps up
    skirt(a, r, .45, 6); a.into(g); },
  sauna(g){ const a = new Acc(), r = rngFrom(91);
    house(a, { w:.52, d:.44, h:.3, wall:N.char, cx:-.05, cz:-.08, winZ:0, winX:1, turf:true, rng:r });
    a.add(box(.28, .03, .2), N.woodL, at(.18, .06, .3)); a.add(cylG(.05, .05, .08, 10), N.wood, at(.26, .1, .3)); a.add(cylG(.045, .045, .01, 10), N.water, at(.26, .142, .3));
    skirt(a, r, .44, 5); a.into(g); g.userData.steam = [[-.17, .72, -.13], [.26, .18, .3]]; },
  boathouse(g){ const a = new Acc(), r = rngFrom(61);
    house(a, { w:.56, d:.6, h:.34, wall:N.blue, cx:-.06, cz:-.1, door:false, winZ:0, winX:1, rng:r });
    a.add(box(.3, .26, .02), N.slit, at(-.06, .18, .205));                                 // the big dark doorway
    a.add(box(.34, .03, .025), N.trim, at(-.06, .32, .21));
    // an upturned rowboat beside
    const hull = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI*2, 0, Math.PI/2);
    a.add(hull, N.red, at(.3, .02, .22, .3, .08, .07, .2)); a.add(hull, N.snow, at(.3, .035, .22, .3, .07, .06, .18));
    skirt(a, r, .45, 5); a.into(g); },
  lake(g){ const a = new Acc(), r = rngFrom(33);           // a frozen lake with an ice-fishing hole that reflects the aurora
    a.add(cylG(.44, .46, .04, 28), N.snowSh, at(0, .02, 0, 0, 1.02, 1, .92)); a.add(cylG(.39, .39, .02, 28), N.ice, at(0, .045, 0, 0, 1.02, 1, .92));
    a.add(cylG(.09, .09, .022, 14), N.water, at(-.08, .048, .06));
    for (let i=0;i<14;i++){ const ang = i/14*6.28 + r()*.2; mound(a, Math.cos(ang)*.44, Math.sin(ang)*.4, .06 + r()*.04, .04 + r()*.03, r); }
    a.add(box(.1, .08, .1), N.wood, at(.12, .09, .14)); a.add(cylG(.03, .025, .06, 8), N.stoneD, at(.18, .08, .0));
    seg(a, N.woodD, new THREE.Vector3(.05, .13, .1), new THREE.Vector3(-.8, .5, -.3).normalize(), .2, .005, .004, 3);
    a.into(g); const rf = new THREE.Mesh(new THREE.CircleGeometry(.075, 14).rotateX(-Math.PI/2), AUR_MAT()); rf.material.opacity = .8; rf.position.set(-.08, .061, .06); rf.renderOrder = 1; g.add(rf);
    const lp = new Acc(); lanternPost(lp, .34, -.3, .4); lp.into(g); },
  falls(g){ const a = new Acc(), r = rngFrom(44);           // a frozen waterfall over blue rocks into an iced pool
    a.add(cylG(.36, .38, .03, 18), N.ice, at(.08, .03, .1, 0, 1, 1, .85));
    [[-.18, -.2, .26, 1.3], [.12, -.26, .22, 1], [-.28, .06, .18, .9], [-.02, -.3, .2, 1.6]].forEach(([x, z, rr, sy]) => { blob(a, N.rock, new THREE.Vector3(x, rr*sy*.5, z), rr, sy, 0, r); mound(a, x, z, rr*.7, .05, r, N.snow, rr*sy*.9 + .02); });
    for (let i=0;i<9;i++){ const x = -.14 + i*.035, hgt = .3 + r()*.14; a.add(cylG(.022, .03, hgt, 6), i%2 ? N.ice : N.iceD, at(x, .04 + hgt/2, -.08 + (i%3)*.012)); }
    for (let i=0;i<6;i++) a.add(new THREE.ConeGeometry(.02, .1, 5).rotateX(Math.PI), N.iceD, at(-.2 + i*.05, .5, -.14));
    for (let i=0;i<8;i++){ const ang = i/8*6.28; mound(a, .08 + Math.cos(ang)*.38, .1 + Math.sin(ang)*.32, .06, .035, r); }
    a.into(g); },
  pool(g){ const a = new Acc(), r = rngFrom(55);           // the aurora pool: open dark water that mirrors the lights
    a.add(cylG(.37, .39, .04, 22), N.water, at(0, .03, 0, 0, 1, 1, .9));
    for (let i=0;i<12;i++){ const ang = i/12*6.28 + r()*.2, dd = .4;
      blob(a, i%3 ? N.stone : N.stoneD, new THREE.Vector3(Math.cos(ang)*dd, .05, Math.sin(ang)*dd*.9), .075 + r()*.04, .75, 0, r);
      mound(a, Math.cos(ang)*dd, Math.sin(ang)*dd*.9, .055, .03, r, N.snow, .1); }
    a.into(g);
    const rf = new THREE.Mesh(new THREE.PlaneGeometry(.62, .5).rotateX(-Math.PI/2), AUR_MAT()); rf.material.opacity = .85; rf.position.y = .053; rf.rotation.y = .6; rf.renderOrder = 1; g.add(rf);
    const rs = new THREE.Mesh(new THREE.CircleGeometry(.33, 20).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color:0x9CFFD8, transparent:true, opacity:.12, depthWrite:false }));
    rs.position.y = .054; rs.scale.z = .9; g.add(rs); },
  inlet(g){ const a = new Acc(), r = rngFrom(66);          // a fjord inlet: dark water, ice floes, a moored rowboat
    a.add(box(.94, .03, .94), N.snowSh, at(0, .015, 0)); a.add(box(.78, .02, .78), N.water, at(0, .038, 0));
    for (let i=0;i<5;i++){ const pts = []; const n = 6, rr = .07 + r()*.06; for (let j=0;j<n;j++){ const ang = j/n*6.28; pts.push(new THREE.Vector2(Math.cos(ang)*rr*(.7 + r()*.5), Math.sin(ang)*rr*(.7 + r()*.5))); }
      a.add(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth:.025, bevelEnabled:false }).rotateX(-Math.PI/2), N.snow, at(-.25 + r()*.5, .045, -.25 + r()*.5)); }
    for (let i=0;i<16;i++){ const t = i/16*4, side = Math.floor(t), u = (t - side) - .5; const [x, z] = [[u, -.45], [.45, u], [-u, .45], [-.45, -u]][side];
      mound(a, x*.94, z*.94, .07 + r()*.04, .04, r); }
    const hull = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI*2, Math.PI/2, Math.PI/2);
    a.add(hull, N.ochre, at(.12, .06, .12, .7, .09, .06, .22)); a.add(box(.14, .01, .03), N.wood, at(.12, .06, .12, .7));
    a.into(g); const rf = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5).rotateX(-Math.PI/2), AUR_MAT()); rf.material.opacity = .55; rf.position.y = .05; rf.rotation.y = .8; g.add(rf); },
  tree(g, s){ const a = new Acc(), r = rngFrom(s.x*5 + s.z*11 + 3);
    if (s.t === 'spruce') spruce(a, 0, 0, s.h || 1.3, .36, r);
    else if (s.t === 'pair') { spruce(a, -.14, -.12, 1.05, .28, r); spruce(a, .2, .2, .7, .2, r); }
    else { birch(a, -.14, -.1, .95, r); birch(a, .16, -.04, .8, r); birch(a, -.02, .2, .68, r); }
    mound(a, .26, .26, .1, .05, r); mound(a, -.28, .2, .08, .04, r); a.into(g); },
  path(g, s){ const slab = new THREE.Mesh(G.path, N.packed); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
    const a = new Acc(), r = rngFrom(s.x*13 + s.z*29);
    [[-.2,-.18],[.18,-.2],[-.16,.2],[.21,.17]].forEach(([x,z]) => a.add(G.step, r() < .5 ? N.stone : N.stoneD, at(x + (r()-.5)*.08, .045, z + (r()-.5)*.08, r()*3, 1 + r()*.2, 1, .85 + r()*.3)));
    for (let i=0;i<5;i++){ const e = i%2 ? -1 : 1, t = (r()-.5)*.8; mound(a, i < 3 ? t : e*.44, i < 3 ? e*.44 : t, .08 + r()*.04, .04 + r()*.02, r); }
    const v = s.v;
    if (v === 'lamp') lanternPost(a, .33, -.33, .5);
    else if (v === 'snowl') { snowLantern(a, .28, -.26, 1.3); snowLantern(a, -.3, .28, 1); snowLantern(a, .3, .3, .8); }
    else if (v === 'skis') { a.add(box(.5, .03, .03), N.woodD, at(0, .3, -.34)); for (const sx of [-1, 1]) a.add(box(.03, .32, .03), N.woodD, at(sx*.24, .16, -.34));
      [-.16, -.08, .06, .14].forEach((x, i) => a.add(box(.035, .56, .012), i < 2 ? N.ski1 : N.ski2, at(x, .28, -.3, 0, 1, 1, 1, -.22, 0)));
      a.add(cylG(.008, .008, .5, 4), N.iron, at(.24, .25, -.27, 0, 1, 1, 1, -.2)); }
    else if (v === 'kick') kicksled(a, .22, -.2, -.6);
    else if (v === 'star') { a.add(box(.42, .04, .12), N.wood, at(-.04, .16, -.3)); for (const sx of [-1, 1]) a.add(box(.04, .14, .1), N.woodD, at(-.04 + sx*.17, .07, -.3));
      a.add(box(.4, .02, .1), N.wool, at(-.04, .19, -.3)); a.add(box(.1, .06, .08), N.woolB, at(.1, .22, -.3));
      for (let i=0;i<3;i++){ const ang = i/3*6.28; seg(a, N.iron, new THREE.Vector3(.32, .3, .02), new THREE.Vector3(Math.cos(ang)*.35, -1, Math.sin(ang)*.35).normalize(), .31, .006, .006, 3); }
      a.add(cylG(.025, .018, .22, 8), N.brass, at(.32, .36, .02, 0, 1, 1, 1, .9, .5)); }
    a.into(g);
    if (!v) g.userData.ghostMode = 'marker'; },
  fence(g, s){ const a = new Acc(), r = rngFrom(s.x*3 + s.z*7 + 2);
    // roundpole fence (skigard): paired posts with long poles laid slanting between them
    const n = s.len*3;
    for (let i=0;i<=n;i++){ const t = (i/n - .5)*s.len*.96;
      const P = (u, y, v2) => s.edge === 'w' ? [-.45 + v2, y, t + u] : [t + u, y, .45 + v2];
      for (const off of [-.03, .03]) { const [x, y, z] = P(0, .17, off); a.add(cylG(.012, .014, .34, 5), N.woodD, at(x, y, z)); }
      if (i < n) for (let k=0;k<4;k++){ const [x, y, z] = P(.16, .07 + k*.07, 0); const ang = .5;
        a.add(cylG(.011, .011, .42, 5), N.wood, s.edge === 'w' ? at(x, y, z, 0, 1, 1, 1, ang, 0) : at(x, y, z, 0, 1, 1, 1, 0, -ang)); } }
    for (let i=0;i<s.len*3;i++){ const t = (i + .5)/(s.len*3) - .5; s.edge === 'w' ? mound(a, -.38, t*s.len, .08, .045, r) : mound(a, t*s.len, .38, .08, .045, r); }
    a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz); },
  observatory(g){                                          // Gita: the aurora observatory on a snowy knoll
    const a = new Acc(), r = rngFrom(404);
    a.add(cylG(.93, .95, .05, 40), N.packed, at(0, .025, 0));
    for (let i=0;i<10;i++){ const ang = i/10*6.28 + .3, dd = .62 + r()*.1; blob(a, i%2 ? N.rock : N.stoneD, new THREE.Vector3(Math.cos(ang)*dd, .08, Math.sin(ang)*dd), .16 + r()*.06, .7, 0, r);
      mound(a, Math.cos(ang)*dd, Math.sin(ang)*dd, .13, .05, r, N.snow, .16); }
    a.add(cylG(.66, .74, .2, 24), N.stoneD, at(0, .12, 0)); a.add(cylG(.66, .66, .04, 24), N.snow, at(0, .24, 0));
    for (let i=0;i<5;i++) a.add(box(.2, .045, .14), N.stone, at(.3 + i*.02, .03 + i*.045, .56 - i*.07, -.5));    // stair up the knoll
    const y0 = .26, H = .74, R = .38;
    a.add(cylG(R, R + .03, H, 16), N.cream, at(0, y0 + H/2, 0));
    a.add(cylG(R + .04, R + .04, .04, 16), N.trim, at(0, y0 + .3, 0));
    a.add(cylG(R + .1, R + .1, .04, 18), N.woodD, at(0, y0 + H, 0));                          // balcony
    a.add(new THREE.TorusGeometry(R + .09, .01, 4, 28).rotateX(Math.PI/2), N.iron, at(0, y0 + H + .12, 0));
    for (let i=0;i<16;i++){ const ang = i/16*6.28; a.add(box(.012, .12, .012), N.iron, at(Math.cos(ang)*(R + .09), y0 + H + .06, Math.sin(ang)*(R + .09))); }
    a.add(new THREE.TorusGeometry(R + .1, .018, 4, 28).rotateX(Math.PI/2), N.snow, at(0, y0 + H + .03, 0));
    const win = (ang, y) => { const x = Math.cos(ang)*(R + .012), z = Math.sin(ang)*(R + .012), ry = Math.PI/2 - ang;
      a.add(box(.12, .17, .02), N.trim, at(x, y, z, ry)); a.add(box(.085, .13, .024), N.glow, at(x, y, z, ry)); };
    win(.25, y0 + .5); win(1.3, y0 + .5); win(.8, y0 + .16);
    a.add(box(.14, .22, .03), N.door, at(Math.cos(.78)*(R + .01), y0 + .11, Math.sin(.78)*(R + .01), Math.PI/2 - .78));
    // the dome, split by a dark slit, a brass telescope reaching out toward the lights
    const dy = y0 + H + .02;
    a.add(new THREE.SphereGeometry(R - .01, 18, 10, 0, Math.PI*2, 0, Math.PI/2), N.dome, at(0, dy, 0));
    a.add(new THREE.TorusGeometry(R - .005, .04, 4, 16, Math.PI*.55), N.slit, at(0, dy, 0, 2.6, 1, 1, 1, 0, Math.PI/2 - .05));
    a.add(new THREE.SphereGeometry(R + .005, 18, 4, 0, Math.PI*2, 0, Math.PI*.14), N.snow, at(0, dy + .01, 0));
    const tdir = new THREE.Vector3(-.75, .95, -.25).normalize(), tbase = new THREE.Vector3(-.08, dy + .2, -.02);
    seg(a, N.brass, tbase, tdir, .56, .055, .045, 10);
    seg(a, N.iron, tbase.clone().addScaledVector(tdir, .5), tdir, .08, .062, .062, 10);
    a.add(new THREE.OctahedronGeometry(.045, 0), N.beacon, at(0, dy + R + .05, 0, 0, 1, 1.6, 1));
    a.into(g);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0x8CFFD8, transparent:true, opacity:.7, blending:THREE.AdditiveBlending, depthWrite:false }));
    sp.position.set(0, dy + R + .06, 0); sp.scale.setScalar(.45); sp.userData.glow = true; sp.renderOrder = 9; g.add(sp);
    const b = new Acc(); [[-.72, .5], [.62, .66], [.8, -.3]].forEach(([x, z]) => lanternPost(b, x, z, .45)); snowLantern(b, .15, .82, 1.2); snowLantern(b, -.36, .78, 1);
    spruce(b, -.66, -.62, .9, .24, r); b.into(g);
  }
};

/* ── blueprint: every farm slot id → an aurora piece (same cells, same rings, same order; hero on the right) ── */
const MAP = {
  bigbarn:{ name:'Longhouse', b:'longhouse' },
  silo:{ name:'Red cottage', b:'cottage', wall:N.red }, silohouse:{ name:'Ochre cottage', b:'cottage', wall:N.ochre, logs:true }, coop:{ name:'Sauna hut', b:'sauna' },
  smallbarn:{ name:'Boathouse', b:'boathouse' }, openbarn:{ name:'Stabbur loft', b:'stabbur' },
  well:{ name:'Ice-fishing lake', b:'lake' }, watertower:{ name:'Frozen falls', b:'falls' }, pump:{ name:'Aurora pool', b:'pool' }, pond:{ name:'Fjord inlet', b:'inlet' },
  apple1:{ name:'Snow spruce', b:'tree', t:'spruce' }, apple2:{ name:'Birch grove', b:'tree', t:'birch' },
  berry1:{ name:'Young spruces', b:'tree', t:'pair' }, orange1:{ name:'Tall spruce', b:'tree', t:'spruce', h:1.45 },
  apple3:{ name:'Birch grove', b:'tree', t:'birch' }, berry2:{ name:'Young spruces', b:'tree', t:'pair' },
  orange2:{ name:'Snow spruce', b:'tree', t:'spruce', h:1.35 }, apple4:{ name:'Birch grove', b:'tree', t:'birch' },
  peepal:{ name:'Aurora observatory', b:'observatory' }
};
const PATH_V = { path3_4:[null, 'Snow path'], path3_5:['lamp', 'Lantern path'], path1_2:['snowl', 'Snow lanterns'], path5_2:['skis', 'Ski rack'],
  path3_6:['kick', 'Kicksled stop'], path2_6:['star', 'Stargazing bench'], path3_0:['lamp', 'Lantern path'] };
const SCULPT = ['Ice swan', 'Ice bear', 'Ice star'];
export const AURORA = FARM_SLOTS.map((f, i) => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') { const v = i % 3; return { ...s, kind:'ice', v, name:SCULPT[v], stages:5 }; }
  if (f.kind === 'path') { const [v, name] = PATH_V[f.id] || [null, 'Snow path']; return { ...s, kind:'n', b:'path', v, name }; }
  if (f.kind === 'fence') return { ...s, kind:'n', b:'fence', edge:f.edge, len:f.len, name:'Roundpole fence' };
  return { ...s, kind:'n', ...MAP[f.id] };
});

/* ── the look: blue-hour snow with faint green and violet aurora light lying on it ── */
const TILE = { top:['#C4CEEC', '#BCC7E8'], side:'#A7B3DC', soilTop:'#8391C4', soilBot:'#2C3464' };
function tileMap(){
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d'), r = rngFrom(37);
  g.fillStyle = '#FAFBFF'; g.fillRect(0, 0, W, W);
  for (let i=0;i<12;i++){ const x = r()*W, y = r()*W, rad = 26 + r()*50, gr = g.createRadialGradient(x, y, 0, x, y, rad), q = r();
    gr.addColorStop(0, q < .3 ? 'rgba(120,255,200,.16)' : q < .5 ? 'rgba(180,150,255,.14)' : 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, W); }
  for (let i=0;i<6;i++){ g.strokeStyle = 'rgba(150,170,225,.16)'; g.lineWidth = 2.5; g.beginPath();
    const y0 = r()*W, x0 = r()*W*.6; for (let x=0;x<=70;x+=5){ const y = y0 + Math.sin(x*.09 + i)*4; x ? g.lineTo(x0 + x, y) : g.moveTo(x0, y); } g.stroke(); }
  for (let i=0;i<170;i++){ g.fillStyle = r() < .65 ? 'rgba(255,255,255,.95)' : 'rgba(130,150,215,.25)'; g.beginPath(); g.arc(r()*W, r()*W, .6 + r()*1.2, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ── decor: drifts on empty cells with a sapling spruce, a boulder or a glowing snow lantern; a drift on waiting cells ── */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x, z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x, z]; world.add(grp);
    const p = cellPos(x, z), a = new Acc(), sub = new THREE.Group(); sub.position.copy(p); grp.add(sub);
    if (!sl || sl === 'later') {
      for (let i=0;i<4;i++) mound(a, (r()-.5)*.7, (r()-.5)*.7, .07 + r()*.08, .035 + r()*.035, r);
      if (AMBIENT()) { const q = r(), px = (r()-.5)*.4, pz = (r()-.5)*.4;
        if (q < .42) spruce(a, px, pz, .36 + r()*.16, .12, r);
        else if (q < .62) { blob(a, N.rock, new THREE.Vector3(px, .04, pz), .08, .7, 0, r); mound(a, px, pz, .06, .025, r, N.snow, .07); }
        else if (q < .82) snowLantern(a, px, pz, .9); }
      a.into(sub); grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { mound(a, .3, .3, .09, .045, r); mound(a, -.28, .3, .07, .035, r); a.into(sub); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else world.remove(grp);
  }
}

/* ── env: the aurora. Three curtains hung in an arc behind the land; the first is there from the start, the second and third
   fade in as the village grows, and all of them brighten with every piece. Stars twinkle behind them. ── */
const RIBBONS = [
  { th:[2.55, 5.35], y:0, H:1.0, R:.95, f:1.0, ph:0,   color:0xFFFFFF, from:0 },
  { th:[3.0, 5.0],   y:.55, H:.8, R:1.4, f:1.4, ph:2.1, color:0xE0C8FF, from:.25 },
  { th:[2.75, 4.4],  y:-.15, H:.6, R:.7, f:.8, ph:4.2, color:0xC8FFF0, from:.6 }
];
function shapeRibbon(m, t){
  const u = m.userData, p = m.geometry.attributes.position, b = u.base, rb = u.rb, h = V.L/2;
  const R0 = h*1.3 + rb.R, y0 = .35 + V.L*.06 + rb.y, H = (rb.H + V.L*.1);
  for (let i=0;i<p.count;i++){ const uu = b[i*2], vv = b[i*2 + 1];
    const th = rb.th[0] + uu*(rb.th[1] - rb.th[0]);
    const R = R0 + .32*Math.sin(uu*6.3*rb.f + t*.22 + rb.ph) + .12*Math.sin(uu*17 + t*.5) + vv*.35;
    const yb = y0 + .22*Math.sin(uu*8 + t*.3 + rb.ph), hh = H*(.72 + .28*Math.sin(uu*5 + rb.ph + t*.18));
    p.setXYZ(i, Math.cos(th)*R, yb + vv*hh, Math.sin(th)*R); }
  p.needsUpdate = true;
}
const STAR_MAT = new THREE.SpriteMaterial({ map:TEX.star, color:0xFFFFFF, transparent:true, opacity:.9, depthWrite:false });
function buildEnv(){
  const env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env; V.aur = []; V.stars = [];
  RIBBONS.forEach(rb => {
    const geo = new THREE.PlaneGeometry(1, 1, 120, 1), p = geo.attributes.position, base = new Float32Array(p.count*2);
    for (let i=0;i<p.count;i++){ base[i*2] = p.getX(i) + .5; base[i*2 + 1] = p.getY(i) + .5; }
    const mat = AUR_MAT(); mat.color.setHex(rb.color);
    const m = new THREE.Mesh(geo, mat); m.userData = { base, rb }; m.renderOrder = 0; m.frustumCulled = false; m.castShadow = m.receiveShadow = false;
    env.add(m); V.aur.push(m); shapeRibbon(m, 2.1);
  });
  const r = rngFrom(83), h = V.L/2;
  for (let i=0;i<34;i++){ const th = 2.4 + r()*3.1, R = h + 1.5 + r()*1.4, y = 1.3 + V.L*.2 + r()*(1.2 + V.L*.25);
    const s = new THREE.Sprite(STAR_MAT.clone()); s.position.set(Math.cos(th)*R, y, Math.sin(th)*R); s.userData = { sz:.05 + r()*.06, ph:r()*6.28 };
    s.scale.setScalar(s.userData.sz); s.renderOrder = 0; env.add(s); V.stars.push(s); }
  // keep the main curtain in frame (its bright lower half)
  const m0 = V.aur[0], p0 = m0.geometry.attributes.position;
  for (let i=0;i<p0.count;i+=20) if (m0.userData.base[i*2 + 1] > .5) V.framePts.push(new THREE.Vector3(p0.getX(i), TILE_TOP + (p0.getY(i) - TILE_TOP)*.8, p0.getZ(i)));
  moveAurora(2.1);
}
function moveAurora(t){
  if (!V || !V.aur) return;
  const frac = placed.length / TH().slots.length, night = S.night ? 1.15 : 1;
  V.aur.forEach((m, i) => { const rb = m.userData.rb, show = Math.min(1, Math.max(0, (frac - rb.from)/.15 + (rb.from === 0 ? 1 : 0)));
    m.visible = show > 0; m.material.opacity = Math.min(1, (.46 + .54*frac)*show*night*(i ? .85 : 1));
    if (t !== 2.1 || !m.userData.shaped) { shapeRibbon(m, t); m.userData.shaped = true; }
    m.material.map.offset.x = (t*.012*(i%2 ? -1 : 1)) % 1; });
  (V.stars || []).forEach(s => { const u = s.userData; s.material.opacity = .55 + .4*Math.sin(t*1.7 + u.ph); });
  (V.steam || []).forEach(s => { const u = s.userData, k = ((t*.22 + u.ph) % 1 + 1) % 1;
    s.position.set(u.p.x + Math.sin(t + u.ph*6)*.03, u.p.y + k*.5, u.p.z); s.scale.setScalar(.09 + k*.2); s.material.opacity = .4*Math.sin(k*Math.PI); });
}
const STEAM_MAT = () => new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFFFFF, transparent:true, opacity:.5, depthWrite:false });
function ambient(){
  V.steam = [];
  Object.values(V.pieces).forEach(g => (g.userData.steam || []).forEach((q, j) => { for (let i=0;i<3;i++){ const s = new THREE.Sprite(STEAM_MAT()); s.renderOrder = 10;
    s.userData = { p:new THREE.Vector3(...q).applyMatrix4(g.matrixWorld), ph:i/3 + j*.17 }; world.add(s); V.steam.push(s); V.life.push(s); } }));
  moveAurora(2.1);
}
function impact(pos, big){
  const n = big ? 16 : 11;
  for (let i=0;i<n;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xFFFFFF, transparent:true, opacity:.95, depthWrite:false })); s.renderOrder = 10;
    const a = i/n*6.28, d = .25 + Math.random()*.4, sz = .06 + Math.random()*.06, rise = .2 + Math.random()*.3; s.position.copy(pos); fx.add(s);
    tween(900 + Math.random()*400, t => { const e = 1 - Math.pow(1-t, 2); s.position.set(pos.x + Math.cos(a)*d*e, pos.y + .05 + Math.sin(t*Math.PI)*rise, pos.z + Math.sin(a)*d*e);
      s.scale.setScalar(sz*(1 - t*.5)); s.material.opacity = .95*(1 - t*t); }, () => { fx.remove(s); s.material.dispose(); }); }
  sparkle(pos.clone().setY(pos.y + .3), big ? 12 : 8, 0x9CFFD8, big ? 1.1 : .7);
}

/* ── residents: reindeer, a calf and an arctic fox (shared CC0 GLBs, recoloured) walk in; a snowy owl flies down to its post ── */
const RES = [
  { id:'reindeer', name:'Reindeer', file:'assets/animals/Stag.glb', h:1.05, at:[0.15, 2.6], face:.5,
    tint:{ 'Material':0xA08E7C, 'Material.003':0xF1ECE2, 'Material.010':0x5E4C3C } },
  { id:'calf', name:'Reindeer calf', file:'assets/animals/Deer.glb', h:.7, at:[0.25, 3.95], face:2.2,
    tint:{ Main:0x9C8A78, Main_Light:0xF1ECE2, Main_Dark:0x6E5C4C, Eye_Lighter:0x9C8A78 } },
  { id:'arcticfox', name:'Arctic fox', file:'assets/animals/Fox.glb', h:.5, at:[1.2, 6.1], face:2.3,
    tint:{ Main:0xF2F5FA, Main_Light:0xFFFFFF, Grey:0xA6AEC2 } },
  { id:'owl', name:'Snowy owl', h:.9, at:[5.2, 6.1], face:-.7, code:true }
];
const OW = { w:FM(0xF7F8FC), f:FM(0x3A3A44), eye:GL(0xFFD34A, 0xFFB000, .5), pupil:FM(0x151515), beak:FM(0x2C2C30) };
function makeOwl(){                                        // a snowy owl on a snow-capped post; feet at y = 0, about 1 unit tall
  const a = new Acc();
  a.add(cylG(.12, .14, .5, 7), N.woodD, at(0, .25, 0)); a.add(cylG(.14, .12, .06, 7), N.snow, at(0, .52, 0));
  const y = .55;
  a.add(SPH, OW.w, at(0, y + .17, 0, 0, .15, .2, .14)); a.add(SPH, OW.w, at(0, y + .4, .01, 0, .13, .11, .12));
  for (const sx of [-1, 1]) { a.add(SPH, OW.w, at(sx*.12, y + .17, -.02, 0, .05, .15, .1, 0, sx*.15));
    a.add(SPH, OW.eye, at(sx*.05, y + .42, .1, 0, .032, .032, .02)); a.add(SPH, OW.pupil, at(sx*.05, y + .42, .117, 0, .016, .016, .01)); }
  a.add(new THREE.ConeGeometry(.018, .04, 5).rotateX(Math.PI*.6), OW.beak, at(0, y + .38, .12));
  for (let i=0;i<7;i++) a.add(SPH, OW.f, at(-.07 + (i%4)*.045, y + .1 + Math.floor(i/4)*.08, .12, 0, .012, .008, .006));
  const g = new THREE.Group(), inner = new THREE.Group(); a.into(inner); g.add(inner); g.userData.inner = inner; return g;
}
const GLTF = {};
function tinted(d){
  const obj = SkeletonUtils.clone(GLTF[d.id].scene);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; const m = o.material.clone(); m.metalness = 0; m.roughness = .85;
    if (d.tint[m.name] != null) m.color.setHex(d.tint[m.name]); o.material = m; } });
  return obj;
}
function spawn(d){
  let obj, mixer, clips = {};
  if (d.code) { obj = makeOwl(); const box = new THREE.Box3().setFromObject(obj), k = d.h/(box.max.y - box.min.y); obj.scale.setScalar(k); obj.userData.y0 = TILE_TOP; }
  else { obj = tinted(d); const box = modelBox(obj), k = d.h/(box.max.y - box.min.y); obj.scale.setScalar(k); obj.userData.y0 = TILE_TOP - box.min.y*k;
    GLTF[d.id].animations.forEach(c => clips[c.name.replace(/^.*\|/, '')] = c); }
  mixer = new THREE.AnimationMixer(obj); world.add(obj);
  const a = { def:d, obj, mixer, clips, cur:null }; V.animals.push(a); if (d.code) (V.owls = V.owls || []).push(obj); return a;
}
function playClip(a, name){ const c = a.clips[name] || a.clips.Idle || Object.values(a.clips)[0]; if (!c) return; const act = a.mixer.clipAction(c);
  if (a.cur === act) return; act.reset().play(); if (a.cur) a.cur.crossFadeTo(act, .3, false); a.cur = act;
  act.time = (S.drop != null || S.celebrate) ? .4 : (a.def.at[0]*1.3 + a.def.at[1]) % c.duration; }
function settle(a){ const d = a.def, p = cellPos(d.at[0], d.at[1]); a.obj.position.set(p.x, a.obj.userData.y0, p.z); a.obj.rotation.y = d.face;
  if (!d.code) playClip(a, a.clips.Eating && d.id !== 'arcticfox' ? 'Eating' : 'Idle'); }
async function moveIn(walk){
  V.residentsIn = true; V.owls = [];
  RES.forEach(d => V.framePts.push(cellPos(d.at[0], d.at[1]).setY(TILE_TOP + d.h)));
  for (let i=0;i<RES.length;i++){
    const d = RES[i], a = spawn(d);
    if (!walk) { settle(a); continue; }
    const to = cellPos(d.at[0], d.at[1]), y0 = a.obj.userData.y0;
    if (!d.code) { const gate = cellPos(3, 7.3), dir = to.clone().sub(gate); a.obj.rotation.y = Math.atan2(dir.x, dir.z); playClip(a, 'Walk');
      await new Promise(res => tween(S.rm ? 1 : Math.max(900, dir.length()*700), t => { const e = 1 - Math.pow(1-t, 2.2); a.obj.position.set(gate.x + dir.x*e, y0, gate.z + dir.z*e); },
        () => { settle(a); sparkle(to.clone().setY(TILE_TOP + d.h*.7), 10, 0xC9FFE8, .6); res(); })); }
    else await new Promise(res => tween(S.rm ? 1 : 1300, t => { const e = 1 - Math.pow(1-t, 2.4); a.obj.position.set(to.x - (1-e)*1.2, y0 + (1-e)*2.4, to.z - (1-e)*.8); a.obj.rotation.y = d.face; },
      () => { settle(a); sparkle(to.clone().setY(TILE_TOP + d.h), 12, 0xC9FFE8, .5); res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 150));
  }
  V.arrived = RES.length;
}

export default {
  id:'aurora', name:'Northern lights', title:'Your aurora',
  season:37, dates:'8–21 Dec', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'frozen lakes & pools',    tag:'Ice' },
    building:{ label:'Nordic houses',           tag:'House' },
    path:    { label:'paths, lanterns & fences', tag:'Path' },
    crop:    { label:'ice sculptures',          tag:'Carve' },
    tree:    { label:'spruces & birches',       tag:'Tree' },
    special: { label:'the aurora observatory',  tag:'Special' }
  },
  slots:AURORA, order:FARM_ORDER,
  ground:{ tile:TILE, tileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M2 9c3-5 6 1 10-3s7-2 10 1v5c-3-3-6-3-10 1S5 10 2 14z" fill="#5FE3B0" opacity=".9"/><path d="M4 7.5c3-3 6 0 9-2.5s5-1.2 7 .3" stroke="#B592FF" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M6 21v-4.5l3.5-3 3.5 3V21z" fill="#A9392F"/><rect x="8.4" y="17.4" width="2.2" height="2.2" fill="#FFC45A"/><path d="M14 21h8v-1.2c-2-1.6-6-1.6-8 0z" fill="#EAF0FB"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M4 50c20-26 36 6 60-12s40-14 60 2v16c-20-14-38-14-60 4S22 44 4 62z" opacity=".55"/><path d="M14 118V84l24-20 24 20v34z"/><path d="M82 118V66h24v52z"/><path d="M78 66c0-14 8-22 16-22s16 8 16 22z"/><path d="M94 44 116 26l3 4-21 17z"/><rect x="30" y="94" width="14" height="12" fill="#fff" opacity=".55"/></g>',
  mood:'night',                                 // blue-hour rig + lit lamps in the day view (engine/scene.js MOODS)
  album:{ image:'assets/aurora/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 45%,#2A3A74,#141B3A)' },
  ghost:{ color:'#5A6A9E', opacity:.4, emissive:.08, dash:'#6C7BAE', dashOpacity:.72, night:{ opacity:.3, emissive:.22, dashOpacity:.5 } },
  css:'.phone[data-theme="aurora"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#3A4C8A 0,#26336A 58%,#18204A 100%)}' +
      '.phone[data-theme="aurora"] .garden{background:radial-gradient(82% 64% at 50% 40%, rgba(19,28,70,.97) 0, rgba(27,40,92,.9) 50%, rgba(40,56,116,.45) 76%, rgba(46,62,122,0) 94%);-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 13%);mask-image:linear-gradient(to bottom,transparent 0,#000 13%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'ice') {
      const slab = new THREE.Mesh(G.field, N.snowB); slab.position.y = .03; slab.scale.set(.96, .6, .96); slab.receiveShadow = true; slab.userData.ghostHide = true; g.add(slab);
      const host = new THREE.Group(); g.add(host); g.userData.plants = host;
      g.userData.regrow = st => fillSculpture(host, s, st); fillSculpture(host, s, stage);
    } else B[s.b](g, s);
  },
  scaleOf: () => 1,
  contact: s => s.kind === 'n' && !['path', 'fence', 'lake', 'pool', 'inlet'].includes(s.b),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.v === 'lamp' || s.v === 'snowl' || s.b === 'pool',
  decor,
  env: buildEnv,
  ambient,
  tick(t){ moveAurora(t); (V && V.owls || []).forEach(o => { o.userData.inner.rotation.y = Math.sin(t*.5)*.6; }); },
  onImpact: impact,
  async preload(){ await Promise.all(RES.filter(d => !d.code).map(async d => { GLTF[d.id] = await loadAnimal(d); })); },

  residents:RES,
  moveIn,
  residentThumb(d, thumbFor){
    return thumbFor('aurora:' + d.id, () => { const o = d.code ? makeOwl() : tinted(d); o.rotation.y = d.code ? .3 : .9; return o; }, 168); },
  residentRig(d){ if (!d.code) return null; const o = makeOwl(); o.scale.setScalar(d.h); return { obj:o, mixer:new THREE.AnimationMixer(o), clip:null, facing:d.face }; }
};
