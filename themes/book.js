/* STORYBOOK (?theme=book) — the land is a giant open book: the tile block is a stack of printed pages (faint "text" lines, no
   real words) lying on a cloth hard cover with a gutter crease and a red ribbon bookmark (env()). Every piece is paper craft,
   as if it popped up from the page: folded paper houses and a pop-up castle, crossed cut-out trees, paper waves and boats,
   pencil fences, word-sprouts whose leaves are single letter cards, and the Gita hero, a giant quill standing in an inkwell.
   Built on the farm's 7×7 ring blueprint (6 / 15 / 19, same order), hero in the right-hand corner (heroRight) so nothing
   stands in front of it. Residents are code-built origami: paper cranes, paper birds that fly loops, an origami fox, and each
   one folds itself from a flat sheet when it moves in.
   Everything is procedural three.js merged per material (Acc); cut-outs are extruded shapes with a paper-white edge. No asset
   files, no kits beyond the shared MegaKit id (kit a is listed first only so T() resolves; nothing from it is drawn). */
import * as THREE from 'three';
import { rngFrom, TEX, world, fx } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, edgeCentre, ringOf, slotRing, isEdge } from '../engine/grid.js';
import { G, Acc, blob } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { FARM, FARM_ORDER, heroRight } from './farm.js';

/* ── paper materials ── */
const FM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.92, metalness:0, flatShading:true, ...o });
const P = {
  edge:FM(0xFFFBF1), white:FM(0xFBF6EA), cream:FM(0xF3E7CF), kraft:FM(0xD2A878), kraftD:FM(0xB08256),
  coral:FM(0xF08A74), coralD:FM(0xD9695A), rose:FM(0xF6A9BC), yellow:FM(0xF6CD5A), mustard:FM(0xE3A93C),
  mint:FM(0x9ED9B8), green:FM(0x86C46A), greenD:FM(0x5FA253), greenL:FM(0xB5DC8A), teal:FM(0x5FB5B0), tealD:FM(0x3F8E8E),
  sky:FM(0x9FD3F0), blue:FM(0x6BAEE0), blueD:FM(0x4A86C5), navy:FM(0x34466E), lilac:FM(0xB9A6E8), lilacD:FM(0x9580CF),
  peach:FM(0xF8C49A), orange:FM(0xF09A4A), brown:FM(0x9C6B45), brownD:FM(0x6E4A30), ink:FM(0x2B3350), grey:FM(0xC9C2B6),
  gold:FM(0xF1C04E, { emissive:0x6A4A00, emissiveIntensity:.25, roughness:.5, metalness:.25 }),
  glow:FM(0xFFE7A8, { emissive:0xFFB347, emissiveIntensity:1.05 }), flame:FM(0xFFD36A, { emissive:0xFF9A2A, emissiveIntensity:1.6 }),
  inkGlass:new THREE.MeshStandardMaterial({ color:0x27335A, roughness:.18, metalness:.1, emissive:0x1B2B66, emissiveIntensity:.35, flatShading:true }),
  inkPool:new THREE.MeshStandardMaterial({ color:0x2A3A78, roughness:.12, metalness:0, emissive:0x2440A0, emissiveIntensity:.35 }),
  water:new THREE.MeshStandardMaterial({ color:0x86C9EE, roughness:.35, metalness:0, emissive:0x2A78A8, emissiveIntensity:.18, flatShading:true }),
  cloth:FM(0x2F6275, { roughness:1 }), clothD:FM(0x234B5A, { roughness:1 }), ribbon:FM(0xD8434E, { roughness:.55 })
};
const DS = m => { const c = m.clone(); c.side = THREE.DoubleSide; return c; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler();
const at = (x, y, z, ry=0, sx=1, sy=1, sz=1, rx=0, rz=0) => _M.compose(new THREE.Vector3(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/* ── cut-outs: an extruded 2D shape; face gets the colour, the cut edge stays paper-white ── */
const CUTCACHE = new Map();
function extrudeSplit(shape, depth, key){
  if (key && CUTCACHE.has(key + depth)) return CUTCACHE.get(key + depth);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled:false, curveSegments:10 }); geo.translate(0, 0, -depth/2);
  const src = geo.index ? geo.toNonIndexed() : geo, out = [];
  const groups = src.groups.length ? src.groups : [{ start:0, count:src.attributes.position.count, materialIndex:0 }];
  for (const mi of [0, 1]) {
    const parts = groups.filter(gr => gr.materialIndex === mi); const n = parts.reduce((s, gr) => s + gr.count, 0);
    const pos = new Float32Array(n*3), nor = new Float32Array(n*3), uv = new Float32Array(n*2); let o = 0;
    for (const gr of parts) { pos.set(src.attributes.position.array.subarray(gr.start*3, (gr.start + gr.count)*3), o*3);
      nor.set(src.attributes.normal.array.subarray(gr.start*3, (gr.start + gr.count)*3), o*3);
      uv.set(src.attributes.uv.array.subarray(gr.start*2, (gr.start + gr.count)*2), o*2); o += gr.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.push(g);
  }
  if (key) CUTCACHE.set(key + depth, out); return out;
}
function cut(acc, shape, depth, face, mx, edge = P.edge, key){ const [c, s] = extrudeSplit(shape, depth, key); if (c.attributes.position.count) acc.add(c, face, mx); if (s.attributes.position.count) acc.add(s, edge, mx); }
const poly = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; };
function lumpy(R, ry, n, amp, seed, cy = 0){ const r = rngFrom(seed), pts = [];
  for (let i=0;i<n;i++){ const a = i/n*Math.PI*2, k = 1 + amp*Math.abs(Math.sin(a*5 + seed)) + (r()-.5)*.04; pts.push([Math.cos(a)*R*k, cy + Math.sin(a)*ry*k]); } return poly(pts); }
const tri = (w, h) => poly([[-w/2, 0], [w/2, 0], [0, h]]);

/* ── letter cards: an atlas of A–Z on little paper squares; leaves are single letters, never words ── */
const LCOLS = 6, LROWS = 5;
const ATLAS = (() => { const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), cw = N/LCOLS, ch = N/LROWS;
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i=0;i<26;i++){ const cx = (i % LCOLS)*cw, cy = Math.floor(i / LCOLS)*ch;
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(cx + 6, cy + 6, cw - 12, ch - 12, 14); g.fill();
    g.fillStyle = 'rgba(40,50,80,.72)'; g.font = `700 ${Math.round(ch*.5)}px Georgia, 'Times New Roman', serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(L[i], cx + cw/2, cy + ch/2 + 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
const LEAFM = [0xB5E08E, 0x8FD39A, 0xF7D66E, 0xF6B0C4, 0xA9D8F2, 0xC9B8F2].map(c => new THREE.MeshStandardMaterial({ color:c, map:ATLAS, roughness:1, side:THREE.DoubleSide, alphaTest:.5 }));
function letterGeo(i, size){ const g = new THREE.PlaneGeometry(size, size*LCOLS/LROWS), uv = g.attributes.uv, c = i % LCOLS, r = Math.floor(i / LCOLS);
  for (let k=0;k<uv.count;k++) uv.setXY(k, (c + uv.getX(k))/LCOLS, 1 - (r + 1)/LROWS + uv.getY(k)/LROWS); return g; }
function letter(acc, rng, x, y, z, size = .1, ry = null, tilt = null, mat = null){
  acc.add(letterGeo(Math.floor(rng()*26), size), mat || LEAFM[Math.floor(rng()*LEAFM.length)], at(x, y, z, ry ?? rng()*6.28, 1, 1, 1, tilt ?? (rng()-.5)*.6, (rng()-.5)*.5)); }

/* ── paper parts ── */
function tuft(acc, x, z, rng, n = 3, y = 0){ for (let i=0;i<n;i++){ const h = .07 + rng()*.07;
  cut(acc, tri(.05, h), .006, i%2 ? P.green : P.greenL, at(x + (rng()-.5)*.08, y, z + (rng()-.5)*.08, rng()*6.28, 1, 1, 1, 0, (rng()-.5)*.4)); } }
function flower(acc, x, z, rng, y = 0){ const h = .1 + rng()*.06, col = [P.rose, P.yellow, P.lilac, P.coral][Math.floor(rng()*4)];
  acc.add(box(.008, h, .008), P.greenD, at(x, y + h/2, z));
  const s = new THREE.Shape(); for (let i=0;i<10;i++){ const a = i/10*6.28, rr = i%2 ? .022 : .04; i ? s.lineTo(Math.cos(a)*rr, Math.sin(a)*rr) : s.moveTo(rr, 0); }
  cut(acc, s, .006, col, at(x, y + h, z, rng()*6, 1, 1, 1, -.9), P.edge, 'flower'); acc.add(new THREE.CircleGeometry(.012, 6), P.yellow, at(x, y + h + .005, z, 0, 1, 1, 1, -Math.PI/2 + .6)); }
/* folded paper house: box body, prism roof (gable ends in wall colour), glowing windows, door */
function house(acc, o){
  const { x = 0, z = 0, w = .42, d = .34, h = .3, wall = P.white, roof = P.coral, ry = 0, rh = .2, door = P.brown, chim = true } = o;
  const R = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
  const add = (geo, mat, m) => acc.add(geo, mat, R.clone().multiply(m.clone()));
  add(box(w, h, d), wall, at(0, h/2, 0));
  const [ends, slopes] = extrudeSplit(tri(w + .1, rh), d + .08, 'roof' + w + rh);
  add(ends, wall, at(0, h, 0)); add(slopes, roof, at(0, h, 0));
  add(box(.1, .15, .012), door, at(-w*.18, .075, d/2 + .006)); add(new THREE.CircleGeometry(.05, 10, 0, Math.PI), door, at(-w*.18, .15, d/2 + .007));
  add(box(.09, .08, .012), P.glow, at(w*.2, h*.55, d/2 + .006)); add(box(.1, .012, .016), P.edge, at(w*.2, h*.55, d/2 + .008)); add(box(.012, .09, .016), P.edge, at(w*.2, h*.55, d/2 + .008));
  add(box(.012, .08, .09), P.glow, at(w/2 + .006, h*.55, 0));
  if (chim) add(box(.06, .14, .06), P.kraftD, at(w*.26, h + rh*.55, -d*.15));
}
function paperBoat(acc, x, y, z, k = 1, ry = 0, col = P.white){
  const R = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(k, k, k));
  const [c, s] = extrudeSplit(poly([[-.13, .05], [.13, .05], [.08, 0], [-.08, 0]]), .07, 'hull');
  acc.add(c, col, R.clone().multiply(at(0, 0, 0))); acc.add(s, P.edge, R.clone().multiply(at(0, 0, 0)));
  const [c2, s2] = extrudeSplit(tri(.16, .13), .012, 'sail'); acc.add(c2, col, R.clone().multiply(at(0, .05, 0))); acc.add(s2, P.edge, R.clone().multiply(at(0, .05, 0)));
}
function wave(w, h, a, n, seed){ const pts = [[-w/2, 0], [w/2, 0]]; for (let i=0;i<=24;i++){ const u = 1 - i/24, xx = -w/2 + w*u; pts.push([xx, h + Math.sin(u*Math.PI*2*n + seed)*a]); } return poly(pts); }
function pencil(acc, x, z, h, col, ry = 0, lean = 0){
  acc.add(new THREE.CylinderGeometry(.032, .032, h, 6), col, at(x, h/2, z, ry, 1, 1, 1, lean));
  acc.add(new THREE.ConeGeometry(.032, .07, 6), P.peach, at(x, h + .035, z, ry)); acc.add(new THREE.ConeGeometry(.011, .025, 6), P.ink, at(x, h + .058, z, ry));
  acc.add(new THREE.CylinderGeometry(.034, .034, .03, 6), P.grey, at(x, .05, z, ry)); acc.add(new THREE.CylinderGeometry(.034, .034, .04, 6), P.rose, at(x, .02, z, ry));
}

/* ── WORD SPROUT (Sudoku/Math): a sapling in a paper tray; every stage adds branches and letter leaves; ripe = a letter tree ── */
function fillSprout(host, s, stage){
  host.clear(); const a = new Acc(), r = rngFrom(s.x*31 + s.z*7 + 5), st = Math.min(5, stage);
  const H = [0, .12, .26, .4, .5, .58][st], N = [0, 2, 5, 8, 12, 16][st];
  a.add(new THREE.CylinderGeometry(.022, .036, H, 5).translate(0, H/2, 0), P.brown, at(0, .07, 0, 0, 1, 1, 1, 0, .06));
  if (st >= 3) for (const [sx, y] of [[-1, .55], [1, .7]]) a.add(new THREE.CylinderGeometry(.008, .012, H*.35, 4).translate(0, H*.175, 0), P.brown, at(0, .07 + H*y, 0, 0, 1, 1, 1, 0, sx*.9));
  const cy = .07 + H*(st === 1 ? .9 : .8), R = st === 1 ? .04 : .08 + st*.04;
  for (let i=0;i<N;i++){ const u = (i + .5)/N, phi = Math.acos(1 - 1.6*u), th = i*2.39996;
    const lx = Math.sin(phi)*Math.cos(th)*R, lz = Math.sin(phi)*Math.sin(th)*R, ly = Math.cos(phi)*R*.85;
    letter(a, r, lx, cy + ly, lz, st === 1 ? .085 : .1 + (st >= 4 ? .02 : 0), th + Math.PI/2); }
  if (st >= 5) for (let i=0;i<3;i++) letter(a, r, (r()-.5)*.6, .075, (r()-.5)*.6, .075, r()*6, -Math.PI/2);
  if (st <= 2) { tuft(a, .28, .25, r, 3, .07); }
  a.into(host); host.userData.stage = stage;
}

/* ── named pieces ── */
const B = {
  castle(g){                                       // ring-1 hero: a pop-up castle on a paper hill with a layered backdrop
    const a = new Acc(), r = rngFrom(222);
    const sheet = new Acc(); sheet.add(box(1.86, .02, 1.86), P.cream, at(0, .01, 0)); const sh = new THREE.Group(); sheet.into(sh); sh.userData.ghostHide = true; g.add(sh);
    // backdrop: two layered hills and a sun, standing like a pop-up page
    cut(a, lumpy(.95, .5, 36, .05, 3), .02, P.greenL, at(-.05, .02, -.78));
    cut(a, lumpy(.7, .32, 30, .06, 7), .02, P.green, at(.45, .02, -.64));
    cut(a, lumpy(.6, .28, 30, .06, 9), .02, P.mint, at(-.55, .02, -.6));
    // keep + tall tower
    a.add(box(.62, .42, .46), P.lilac, at(-.05, .23, -.18));
    for (let i=0;i<5;i++) a.add(box(.08, .07, .08), P.lilac, at(-.3 + i*.125, .475, .03));
    a.add(new THREE.CylinderGeometry(.13, .14, .9, 8), P.white, at(-.05, .47, -.26)); a.add(new THREE.ConeGeometry(.19, .34, 8), P.coral, at(-.05, 1.09, -.26));
    a.add(box(.006, .2, .006), P.brownD, at(-.05, 1.35, -.26)); cut(a, tri(.08, .16), .008, P.yellow, at(.0, 1.37, -.26, 0, 1, 1, 1, 0, -Math.PI/2));
    a.add(box(.07, .1, .02), P.glow, at(-.05, .72, -.12));
    // corner towers
    for (const [x, z, h] of [[-.5, .3, .56], [.4, .3, .56], [-.5, -.45, .66], [.42, -.45, .66]]) {
      a.add(new THREE.CylinderGeometry(.12, .13, h, 8), P.white, at(x, h/2 + .02, z)); a.add(new THREE.ConeGeometry(.17, .28, 8), P.blue, at(x, h + .16, z));
      a.add(box(.05, .07, .02), P.glow, at(x, h*.62, z + .12)); }
    // front wall + gate
    a.add(box(.8, .3, .1), P.lilacD, at(-.05, .17, .3));
    for (let i=0;i<6;i++) a.add(box(.07, .06, .1), P.lilacD, at(-.36 + i*.125, .35, .3));
    const arch = new THREE.Shape(); arch.moveTo(-.08, 0); arch.lineTo(.08, 0); arch.lineTo(.08, .12); arch.absarc(0, .12, .08, 0, Math.PI, false); arch.closePath();
    cut(a, arch, .02, P.brownD, at(-.05, .02, .355), P.brown, 'arch');
    // paper path out of the gate + flowers
    for (let i=0;i<4;i++) a.add(box(.2, .012, .12), P.kraft, at(-.05 + i*.1, .026, .5 + i*.12, .5));
    for (let i=0;i<7;i++) flower(a, .6 + (r()-.5)*.35, .55 + (r()-.5)*.35, r, .02);
    for (let i=0;i<5;i++) tuft(a, -.75 + r()*.3, .45 + r()*.4, r, 3, .02);
    a.add(new THREE.SphereGeometry(.13, 8, 6), P.greenD, at(.75, .12, -.1, 0, 1, .8, 1)); a.add(new THREE.SphereGeometry(.1, 8, 6), P.green, at(-.8, .1, .05, 0, 1, .8, 1));
    a.into(g); },
  tower(g){ const a = new Acc();                    // star tower
    a.add(new THREE.CylinderGeometry(.2, .22, .06, 10), P.kraft, at(0, .03, 0));
    a.add(new THREE.CylinderGeometry(.14, .16, .78, 8), P.navy, at(0, .45, 0)); a.add(new THREE.ConeGeometry(.22, .38, 8), P.lilac, at(0, 1.03, 0));
    for (let i=0;i<3;i++) a.add(box(.06, .09, .02), P.glow, at(Math.sin(i*1.3)*.05, .35 + i*.2, .15));
    const st = new THREE.Shape(); for (let i=0;i<10;i++){ const an = i/10*6.28 + Math.PI/2, rr = i%2 ? .04 : .09; i ? st.lineTo(Math.cos(an)*rr, Math.sin(an)*rr) : st.moveTo(Math.cos(an)*rr, Math.sin(an)*rr); }
    cut(a, st, .015, P.gold, at(0, 1.3, 0), P.gold, 'star');
    for (const [x, y] of [[-.1, .7], [.08, .55], [-.06, .3]]) a.add(new THREE.OctahedronGeometry(.018, 0), P.yellow, at(x, y, .16));
    a.into(g); },
  cottage(g, s){ const a = new Acc(); a.add(box(.7, .02, .6), P.cream, at(0, .01, 0));
    house(a, { w:.5, d:.36, h:.3, wall:s.wall || P.peach, roof:s.roof || P.teal, rh:.22, z:-.04 });
    const r = rngFrom(s.x*3 + s.z); for (let i=0;i<3;i++) flower(a, -.28 + i*.08, .26, r, .02); tuft(a, .28, .24, r, 3, .02);
    a.into(g); },
  windmill(g){ const a = new Acc();
    a.add(new THREE.CylinderGeometry(.24, .26, .04, 10), P.kraft, at(0, .02, 0));
    a.add(new THREE.CylinderGeometry(.12, .2, .6, 8), P.white, at(0, .34, 0)); a.add(new THREE.ConeGeometry(.17, .2, 8), P.coral, at(0, .74, 0));
    a.add(box(.08, .13, .02), P.brown, at(0, .1, .17)); a.add(box(.05, .06, .02), P.glow, at(0, .44, .14));
    const hub = new THREE.Vector3(0, .62, .17); a.add(new THREE.CylinderGeometry(.025, .025, .05, 6).rotateX(Math.PI/2), P.brownD, at(hub.x, hub.y, hub.z));
    for (let i=0;i<4;i++){ const an = i*Math.PI/2 + .4; a.add(box(.035, .3, .006), P.brownD, at(hub.x + Math.sin(an)*.15, hub.y + Math.cos(an)*.15, hub.z + .02, 0, 1, 1, 1, 0, -an));
      a.add(box(.09, .24, .008), i%2 ? P.yellow : P.white, at(hub.x + Math.sin(an)*.17 + Math.cos(an)*.05, hub.y + Math.cos(an)*.17 - Math.sin(an)*.05, hub.z + .025, 0, 1, 1, 1, 0, -an)); }
    a.into(g); },
  lighthouse(g){ const a = new Acc();
    for (let i=0;i<5;i++) blob(a, i%2 ? P.grey : P.cream, new THREE.Vector3(Math.cos(i*1.3)*.24, .04, Math.sin(i*1.3)*.24), .09, .6, 0, null);
    for (let i=0;i<5;i++){ const r0 = .15 - i*.016, r1 = .15 - (i+1)*.016; a.add(new THREE.CylinderGeometry(r1, r0, .15, 8), i%2 ? P.white : P.coral, at(0, .075 + i*.15, 0)); }
    a.add(new THREE.CylinderGeometry(.11, .11, .03, 8), P.navy, at(0, .77, 0)); a.add(new THREE.CylinderGeometry(.075, .075, .12, 8), P.glow, at(0, .845, 0));
    a.add(new THREE.ConeGeometry(.11, .14, 8), P.coralD, at(0, .975, 0)); a.add(box(.06, .1, .02), P.brownD, at(0, .1, .145));
    a.into(g); },
  bookshop(g){ const a = new Acc(), r = rngFrom(71); a.add(box(.8, .02, .6), P.cream, at(0, .01, 0));
    house(a, { w:.6, d:.38, h:.34, wall:P.mint, roof:P.navy, rh:.18, z:-.06, chim:false });
    a.add(box(.64, .04, .12), P.coral, at(0, .3, .2, 0, 1, 1, 1, .5));                       // awning
    for (let k=0;k<2;k++) for (let i=0;i<5;i++){ const bw = .05 + r()*.02, col = [P.coral, P.teal, P.yellow, P.lilac, P.blue][(i + k*2) % 5];     // book stacks by the door
      a.add(box(.16, bw*.6, .11), col, at(.34 + k*.12 - .06, .03 + i*bw*.6, .28 + k*.02, r()*.4)); }
    a.into(g); },
  // ── water (Breathe) ──
  pondp(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z*3 + 11);
    a.add(new THREE.CylinderGeometry(.42, .44, .02, 18), P.blueD, at(0, .01, 0, 0, 1, 1, .9));
    a.add(new THREE.CylinderGeometry(.34, .34, .02, 18), P.sky, at(0, .03, 0, 0, 1, 1, .9));
    for (const [x, z] of [[-.2, .12], [.2, -.14]]) { a.add(new THREE.CircleGeometry(.07, 8, .4, 5.6), P.green, at(x, .045, z, 0, 1, 1, 1, -Math.PI/2)); }
    flower(a, -.2, .12, r, .0); paperBoat(a, .05, .04, .04, 1.05, .6, s.iris ? P.yellow : P.white);
    for (let i=0;i<5;i++) tuft(a, Math.cos(i*1.25)*.43, Math.sin(i*1.25)*.38, r, 3);
    a.into(g); },
  waves(g){ const a = new Acc(), cols = [P.blueD, P.blue, P.sky, P.white];
    a.add(box(.9, .02, .8), P.blueD, at(0, .01, 0));
    cols.forEach((c, i) => cut(a, wave(.92, .16 + (3 - i)*.05, .035, 2, i*1.7), .02, c, at(0, .02, -.3 + i*.2)));
    paperBoat(a, .12, .12, .05, 1.2, .2, P.coral);
    a.into(g); },
  fall(g){ const a = new Acc(), r = rngFrom(55);
    for (const [x, z, w, h] of [[-.2, -.22, .5, .62], [.15, -.3, .4, .42], [-.32, .05, .26, .3]]) { a.add(box(w, h, .3), P.kraft, at(x, h/2, z)); a.add(box(w + .02, .025, .32), P.greenL, at(x, h + .012, z)); }
    for (let i=0;i<4;i++) a.add(box(.06, .6 - i*.04, .01), [P.sky, P.white, P.blue, P.sky][i], at(-.14 + i*.05, .31 - i*.02, -.06 + i*.004));
    a.add(new THREE.CylinderGeometry(.3, .31, .02, 14), P.blue, at(.08, .02, .18, 0, 1.15, 1, .9)); a.add(new THREE.CylinderGeometry(.22, .22, .02, 14), P.sky, at(.08, .035, .18, 0, 1.15, 1, .9));
    for (let i=0;i<5;i++) a.add(new THREE.CircleGeometry(.025, 6), P.white, at(-.06 + (r()-.5)*.18, .05, .02 + (r()-.5)*.08, 0, 1, 1, 1, -Math.PI/2));
    tuft(a, .38, .38, r, 4); tuft(a, -.4, .36, r, 3); a.into(g); },
  // ── trees (Vocab): crossed cut-outs ──
  tree(g, s){ const a = new Acc(), r = rngFrom(s.x*5 + s.z*11), H = s.h || 1.25, ry = (s.rot || 0)*Math.PI/180, v = s.v;   // papercraft: faceted folds
    a.add(new THREE.CylinderGeometry(.22, .24, .02, 10), P.greenL, at(0, .01, 0));
    a.add(new THREE.CylinderGeometry(.035, .06, H*.55, 5), P.brown, at(0, .02 + H*.275, 0, ry));
    if (v === 'pine') { [[.34, .46, .3], [.27, .4, .52], [.19, .34, .72]].forEach(([rr, hh, y], i) => a.add(new THREE.ConeGeometry(rr, hh, 6), i%2 ? P.greenD : P.teal, at(0, H*y + hh/2, 0, ry + i*.5))); }
    else { const col = { blossom:P.rose, autumn:P.orange, round:P.green }[v], col2 = { blossom:P.white, autumn:P.yellow, round:P.greenL }[v], col3 = { blossom:P.coral, autumn:P.coralD, round:P.greenD }[v];
      blob(a, col, new THREE.Vector3(0, H*.68, 0), .33, .95, 0, r);
      blob(a, col2, new THREE.Vector3(Math.cos(ry)*.2, H*.8, Math.sin(ry)*.2), .19, .9, 0, r);
      blob(a, col3, new THREE.Vector3(-Math.sin(ry)*.22, H*.56, Math.cos(ry)*.22), .16, .9, 0, r);
      if (v !== 'blossom') for (let i=0;i<4;i++) a.add(new THREE.OctahedronGeometry(.04, 0), v === 'autumn' ? P.coral : P.coralD, at(Math.cos(i*1.6 + ry)*.3, H*.62 + Math.sin(i*2.1)*.12, Math.sin(i*1.6 + ry)*.3)); }
    if (v === 'blossom') for (let i=0;i<7;i++) a.add(new THREE.CircleGeometry(.02, 5), P.rose, at((r()-.5)*.5, .025, (r()-.5)*.5, 0, 1, 1, 1, -Math.PI/2));
    a.into(g); },
  booktree(g, s){ const a = new Acc(), r = rngFrom(s.x*9 + s.z*13), cols = [P.coral, P.teal, P.yellow, P.lilac, P.blue, P.mint, P.rose];
    a.add(new THREE.CylinderGeometry(.22, .24, .02, 10), P.greenL, at(0, .01, 0));
    let y = .02; for (let i=0;i<7;i++){ const th = .07 + r()*.03, w = .3 - i*.012; a.add(box(w, th, w*.72), cols[i % cols.length], at((r()-.5)*.03, y + th/2, 0, (r()-.5)*.5)); a.add(box(w - .02, th*.8, w*.72 + .004), P.edge, at(0, y + th/2, 0, 0, 1, 1, .98)); y += th; }
    for (const k of [0, 1]) cut(a, lumpy(.34, .3, 30, .09, 11 + k), .025, P.greenD, at(0, y + .26, 0, k*Math.PI/2 + .3), P.edge, 'bt' + k);
    for (let i=0;i<6;i++) letter(a, r, (r()-.5)*.5, y + .12 + r()*.3, (r()-.5)*.5, .08);
    a.into(g); },
  // ── paths (To-dos) ──
  path(g, s){ const v = s.v || 'plain', a = new Acc(), r = rngFrom(s.x*13 + s.z*29);
    const pts = []; for (let i=0;i<16;i++){ const an = i/16*6.28, rr = .43 + (r()-.5)*.05; pts.push([Math.cos(an)*rr*1.05, Math.sin(an)*rr]); }
    const slab = new THREE.Group(), sa = new Acc(); cut(sa, poly(pts), .012, P.kraft, at(0, .006, 0, 0, 1, 1, 1, -Math.PI/2), P.cream);
    for (let i=0;i<7;i++) sa.add(box(.07, .004, .014), P.kraftD, at(-.33 + i*.11, .014, .26 - i*.08, .6));          // stitched dashes
    sa.into(slab); g.add(slab);
    if (v === 'sign') { a.add(box(.035, .5, .035), P.brown, at(.22, .25, .22));
      cut(a, poly([[-.14, -.04], [.08, -.04], [.14, 0], [.08, .04], [-.14, .04]]), .02, P.yellow, at(.22, .42, .24, .6), P.edge, 'arrow');
      cut(a, poly([[-.14, -.04], [.08, -.04], [.14, 0], [.08, .04], [-.14, .04]]), .02, P.teal, at(.22, .32, .24, 2.6), P.edge, 'arrow'); }
    else if (v === 'lamp') { a.add(box(.03, .48, .03), P.navy, at(.25, .24, .25)); a.add(box(.14, .02, .02), P.navy, at(.2, .48, .25));
      a.add(new THREE.SphereGeometry(.07, 8, 6), P.glow, at(.14, .41, .25, 0, 1, 1.2, 1)); a.add(new THREE.CylinderGeometry(.03, .03, .02, 6), P.navy, at(.14, .49, .25)); }
    else if (v === 'bench') { a.add(box(.34, .03, .12), P.coral, at(-.2, .13, .22, .78)); a.add(box(.34, .12, .02), P.coral, at(-.24, .2, .18, .78, 1, 1, 1, -.2));
      for (const sx of [-1, 1]) a.add(box(.025, .12, .1), P.brownD, at(-.2 + sx*.13*Math.cos(.78), .06, .22 - sx*.13*Math.sin(.78), .78)); flower(a, .25, .25, r, .02); }
    else if (v === 'shrooms') { for (const [x, z, k] of [[.24, .22, 1], [.32, .08, .7], [-.28, -.26, .8]]) {
      a.add(new THREE.CylinderGeometry(.025*k, .03*k, .12*k, 6), P.white, at(x, .06*k, z)); a.add(new THREE.SphereGeometry(.08*k, 8, 5, 0, 6.3, 0, 1.6), P.coral, at(x, .11*k, z));
      for (let i=0;i<3;i++) a.add(new THREE.SphereGeometry(.014*k, 5, 4), P.white, at(x + Math.cos(i*2)*.045*k, .155*k, z + Math.sin(i*2)*.045*k)); } }
    else if (v === 'bridge') { a.add(box(.97, .02, .34), P.blue, at(0, .02, 0)); a.add(box(.97, .022, .2), P.sky, at(0, .022, 0));
      const n = 7, L = .8; for (let i=0;i<n;i++){ const t = (i + .5)/n, x = -L/2 + L*t, y = .06 + Math.sin(Math.PI*t)*.12; a.add(box(L/n + .01, .03, .26), i%2 ? P.kraft : P.peach, at(x, y, 0, 0, 1, 1, 1, 0, Math.cos(Math.PI*t)*.4)); }
      for (const sz of [-1, 1]) for (const x of [-.36, 0, .36]) a.add(box(.022, .14, .022), P.coral, at(x, .1 + (x ? .02 : .12), sz*.12)); }
    else tuft(a, .3, .3, r, 3, .012);
    a.into(g); if (v === 'plain') g.userData.ghostMode = 'marker'; },
  fence(g, s){ const a = new Acc(), L = s.len, cols = [P.coral, P.yellow, P.teal, P.lilac, P.blue, P.mint, P.rose, P.orange], r = rngFrom(s.x*3 + s.z*7);
    const n = L*5; for (let i=0;i<n;i++){ const u = -L/2 + (i + .5)/5, h = .24 + r()*.08;
      s.edge === 'w' ? pencil(a, -.45, u, h, cols[i % cols.length], r()*6) : pencil(a, u, .45, h, cols[i % cols.length], r()*6); }
    const rail = box(L, .025, .02); s.edge === 'w' ? a.add(rail, P.kraftD, at(-.45, .16, 0, Math.PI/2)) : a.add(rail, P.kraftD, at(0, .16, .45));
    a.into(g); const fp = edgeCentre(s); g.position.set(fp.cx, g.position.y, fp.cz); },
  // ── Gita: a giant quill standing in an inkwell, on a stack of books, with an ink pool and written pages ──
  quill(g){ const a = new Acc(), r = rngFrom(404);
    const sheet = new Acc(); sheet.add(new THREE.CylinderGeometry(.9, .92, .02, 36), P.cream, at(0, .01, 0)); const sh = new THREE.Group(); sheet.into(sh); sh.userData.ghostHide = true; g.add(sh);
    // ink pool
    cut(a, lumpy(.36, .3, 24, .12, 17), .01, P.inkPool, at(.35, .026, .42, 0, 1, 1, 1, -Math.PI/2), P.inkPool);
    // two written pages
    for (const [x, z, ry] of [[-.5, .42, .3], [-.3, .58, -.2]]) { a.add(box(.42, .008, .54), P.white, at(x, .028 + (x > -.4 ? .008 : 0), z, ry));
      for (let i=0;i<7;i++) a.add(box(.12 + r()*.18, .004, .014), P.ink, at(x + Math.cos(ry)*(-.08 + r()*.04) , .036 + (x > -.4 ? .008 : 0), z - .2 + i*.06, ry)); }
    // book stack
    let y = .02; [[.9, .12, P.teal], [.8, .1, P.coral], [.72, .1, P.lilac]].forEach(([w, th, col], i) => {
      a.add(box(w, th, w*.72), col, at(-.12, y + th/2, -.12, .25 + i*.12)); a.add(box(w - .04, th*.78, w*.72 + .006), P.edge, at(-.12 + .012, y + th/2, -.12, .25 + i*.12, 1, 1, .99)); y += th; });
    // inkwell
    const ix = -.12, iz = -.12, iy = y;
    a.add(new THREE.CylinderGeometry(.24, .28, .22, 10), P.inkGlass, at(ix, iy + .11, iz));
    a.add(new THREE.CylinderGeometry(.18, .24, .07, 10), P.inkGlass, at(ix, iy + .255, iz));
    a.add(new THREE.CylinderGeometry(.13, .13, .08, 10), P.gold, at(ix, iy + .32, iz)); a.add(new THREE.CylinderGeometry(.1, .1, .01, 10), P.inkPool, at(ix, iy + .362, iz));
    a.add(new THREE.TorusGeometry(.26, .02, 5, 20).rotateX(Math.PI/2), P.gold, at(ix, iy + .02, iz));
    // candle
    a.add(new THREE.CylinderGeometry(.05, .05, .2, 8), P.white, at(.55, .12, -.45)); a.add(new THREE.CylinderGeometry(.09, .1, .02, 10), P.gold, at(.55, .02, -.45));
    a.add(new THREE.ConeGeometry(.03, .08, 6), P.flame, at(.55, .26, -.45));
    // the quill: shaft + a curved two-tone vane, tilted out of the well
    const tip = new THREE.Vector3(ix, iy + .3, iz), dir = new THREE.Vector3(.3, 1, -.3).normalize(), L = 2.15;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const Q = (m) => new THREE.Matrix4().compose(tip, q, new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().makeRotationY(Math.PI/4)).multiply(m.clone());
    a.add(new THREE.CylinderGeometry(.012, .02, L, 6).translate(0, L/2, 0), P.white, Q(at(0, 0, 0)));
    a.add(new THREE.ConeGeometry(.02, .12, 6).rotateX(Math.PI), P.ink, Q(at(0, -.06, 0)));
    const vane = (side) => { const pts = []; const n = 14;
      for (let i=0;i<=n;i++){ const t = i/n, w = Math.sin(Math.PI*Math.pow(t, .8))*.3*(1 - t*.25), notch = (i % 3 === 1 && t > .15 && t < .85) ? .03 : 0; pts.push([side*(w - notch), .3 + t*(L - .25)]); }
      pts.push([0, L + .02]); pts.push([0, .3]); return poly(pts); };
    cut(a, vane(1), .014, P.lilac, Q(at(.012, 0, 0, 0, 1, 1, 1, 0, 0)), P.cream, 'vaneR');
    cut(a, vane(-1), .014, P.blue, Q(at(-.012, 0, 0)), P.cream, 'vaneL');
    for (let i=0;i<7;i++){ const yy = .55 + i*.22, w = .2 - i*.018; for (const sd of [-1, 1]) a.add(box(w, .012, .02), sd < 0 ? P.sky : P.white, Q(at(sd*w*.5, yy + w*.25, 0, 0, 1, 1, 1, 0, sd*.45))); }
    // letters rising from the ink like sparks
    for (let i=0;i<6;i++) letter(a, r, .35 + (r()-.5)*.4, .12 + r()*.35, .42 + (r()-.5)*.3, .08, null, null, LEAFM[i % LEAFM.length]);
    for (let i=0;i<6;i++) flower(a, -.75 + r()*.25, -.7 + r()*.35, r, .02);
    a.into(g); }
};

/* blueprint: every farm slot id → a storybook piece (same cells, same rings, same order), hero in the right-hand corner */
const MAP = {
  bigbarn:{ name:'Pop-up castle', b:'castle' },
  silo:{ name:'Star tower', b:'tower' }, silohouse:{ name:'Paper cottage', b:'cottage' }, coop:{ name:'Windmill', b:'windmill' },
  smallbarn:{ name:'Lighthouse', b:'lighthouse' }, openbarn:{ name:'Little bookshop', b:'bookshop' },
  well:{ name:'Boat pond', b:'pondp' }, watertower:{ name:'Paper waterfall', b:'fall' }, pump:{ name:'Paper waves', b:'waves' }, pond:{ name:'Lily pond', b:'pondp', iris:true },
  apple1:{ name:'Paper tree', b:'tree', v:'round', rot:20, h:1.25 }, apple2:{ name:'Blossom tree', b:'tree', v:'blossom', rot:70, h:1.3 },
  berry1:{ name:'Book tree', b:'booktree' }, orange1:{ name:'Paper pine', b:'tree', v:'pine', rot:10, h:1.45 },
  apple3:{ name:'Autumn tree', b:'tree', v:'autumn', rot:35, h:1.25 }, berry2:{ name:'Book tree', b:'booktree' },
  orange2:{ name:'Paper pine', b:'tree', v:'pine', rot:40, h:1.4 }, apple4:{ name:'Blossom tree', b:'tree', v:'blossom', rot:10, h:1.25 },
  peepal:{ name:'Quill & inkwell', b:'quill' }
};
const PATH_V = { path3_4:['plain','Paper path'], path3_5:['lamp','Paper lantern'], path1_2:['bridge','Paper bridge'], path5_2:['bench','Reading bench'],
  path3_6:['sign','Signpost'], path2_6:['shrooms','Toadstools'], path3_0:['lamp','Paper lantern'] };
export const BOOK = heroRight(FARM).map((f, i) => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') return { ...s, kind:'sprout', name:'Word sprout', v:i%2, stages:5 };
  if (f.kind === 'path') { const [v, name] = PATH_V[f.id] || ['plain', 'Paper path']; return { ...s, kind:'p', b:'path', v, name }; }
  if (f.kind === 'fence') return { ...s, kind:'p', b:'fence', edge:f.edge, len:f.len, name:'Pencil fence' };
  return { ...s, kind:'p', ...MAP[f.id] };
});

/* ── ground: printed pages (faint lines of "text", no words) on page-edge soil ── */
const PAGE_TILE = { top:['#FBF5E7', '#F7EFDD'], side:'#EFE3CB', soilTop:'#F7EFDF', soilBot:'#E4D4B4' };
function pageTileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(24);
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, N, N);
  for (let i=0;i<160;i++){ g.fillStyle = r() < .5 ? 'rgba(180,150,110,.06)' : 'rgba(255,255,255,.5)'; g.fillRect(r()*N, r()*N, 1 + r()*3, 1); }
  g.fillStyle = 'rgba(70,60,50,.085)';
  for (let li=0; li<8; li++){ const y = 34 + li*26; let x = 30 + (li === 0 ? 22 : 0);
    const end = li === 7 ? 120 + r()*60 : N - 30;
    while (x < end - 8){ const w = Math.min(end - x, 10 + r()*30); g.beginPath(); g.roundRect(x, y, w, 6, 3); g.fill(); x += w + 7; } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function pageEdgeTex(){
  const W = 64, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
  for (let y=0; y<H; y+=4){ g.fillStyle = `rgba(150,112,70,${.2 + ((y*7) % 5)*.035})`; g.fillRect(0, y, W, 1.4); }   // page-edge stripes
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 1); return t;
}
const PAGE_EDGE = pageEdgeTex();
const gutterTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 4; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(90,60,30,0)'); gr.addColorStop(.44, 'rgba(90,60,30,.24)'); gr.addColorStop(.5, 'rgba(70,45,20,.5)'); gr.addColorStop(.56, 'rgba(90,60,30,.24)'); gr.addColorStop(1, 'rgba(90,60,30,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 4); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

/* the open-book silhouette on the two end faces (front +z, back −z): each page block is a stack of paper layers whose top edge
   curls up toward the spine and dips into a crease, so from the iso camera the block reads ⌒V⌒ like an open book. Layers
   alternate paper white / cream so the page edges show as stripes that follow the curve. Only the end faces rise; the tile
   tops (where pieces stand) stay flat. */
const END_MATS = [FM(0xFFFBF1, { side:THREE.DoubleSide }), FM(0xE6D3B0, { side:THREE.DoubleSide })];
const SPINE_W = .035, RISE = .24, BOT = -.6, LAYERS = 9;
function pageTop(u, h){                                       // u = distance from the spine
  if (u < .16) return TILE_TOP + RISE*Math.sin(Math.min(1, (u - SPINE_W)/(.16 - SPINE_W))*Math.PI/2);     // curl down into the crease
  const t = Math.min(1, (u - .16)/(h*.85 - .16)); return TILE_TOP + RISE*(1 - t)*(1 - t);                // sweep down to the fore-edge
}
function pageEnds(acc, h){
  const N = 28;
  for (const side of [-1, 1]) for (let k=0; k<LAYERS; k++){
    const lo = u => BOT + (pageTop(u, h) - BOT)*k/LAYERS, hi = u => BOT + (pageTop(u, h) - BOT)*(k + 1)/LAYERS;
    const sh = new THREE.Shape(), us = []; for (let i=0;i<=N;i++) us.push(SPINE_W + (h + .02 - SPINE_W)*i/N);
    sh.moveTo(us[0], lo(us[0])); us.forEach(u => sh.lineTo(u, lo(u))); [...us].reverse().forEach(u => sh.lineTo(u, hi(u))); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth:.03, bevelEnabled:false, curveSegments:1 });
    if (side < 0) geo.scale(-1, 1, 1);
    const mat = END_MATS[k % 2];
    for (const zs of [-1, 1]) acc.add(geo.clone(), mat, at(0, 0, zs > 0 ? h + .005 : -h - .035));
  }
  // the crease itself: a dark fold line where the two page blocks meet on each end face
  for (const zs of [-1, 1]) acc.add(box(SPINE_W*2 + .01, TILE_TOP - BOT + .01, .03), P.clothD, at(0, (TILE_TOP + BOT)/2, zs > 0 ? h + .02 : -h - .02));
}

/* env: the page block becomes a book — page-edge sides, a cloth cover underneath with gold tooling, a gutter crease, a ribbon */
function buildEnv(){
  const env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env;
  if (V.soil) { V.soil.material.map = PAGE_EDGE; PAGE_EDGE.repeat.set(Math.max(2, V.L*1.2), 1); V.soil.material.needsUpdate = true; }
  const L = V.L, h = L/2, M = .24, y0 = -.63, T = .08, a = new Acc();
  a.add(box(L + 2*M, T, L + 2*M*.7), P.cloth, at(0, y0 - T/2 + .02, 0));
  a.add(new THREE.CylinderGeometry(.2, .2, L + 2*M*.7, 10, 1, false, Math.PI/2, Math.PI).rotateX(Math.PI/2), P.clothD, at(0, y0 - .03, 0, 0, 1, .35, 1));   // spine hump
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {                                        // gold corner tooling
    a.add(box(.34, .006, .025), P.gold, at(sx*(h + M - .1) - sx*.13, y0 + .024, sz*(h + M*.7 - .07))); a.add(box(.025, .006, .3), P.gold, at(sx*(h + M - .1), y0 + .024, sz*(h + M*.7 - .07) - sz*.14)); }
  a.add(box(L + 2*M - .1, .006, .02), P.gold, at(0, y0 + .024, h + M*.7 - .04));
  // ribbon bookmark: lies across the top page, runs down the front face, ends in a V
  const rx = .72;
  a.add(box(.12, .006, .9), P.ribbon, at(rx, TILE_TOP + .004, h - .45));
  const lip = pageTop(rx, h) + .004;                                   // the ribbon climbs over the curled page end, then hangs down
  a.add(box(.12, .006, .06), P.ribbon, at(rx, lip, h + .02));
  a.add(box(.12, lip + .64, .006), P.ribbon, at(rx, (lip - .64)/2, h + .045));
  a.add(new THREE.CylinderGeometry(.06, .06, .15, 3, 1).rotateZ(Math.PI/2).scale(1, 1, .05), P.ribbon, at(rx, -.7, h + .045, 0, 1, 1, 1, 0, -Math.PI/2));
  pageEnds(a, h);
  a.into(env);
  env.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
  const gut = new THREE.Mesh(new THREE.PlaneGeometry(.55, L).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ map:gutterTex, transparent:true, depthWrite:false }));
  gut.position.set(0, TILE_TOP + .003, 0); gut.renderOrder = 1; env.add(gut);
  const e = h + M; for (const [sx, sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) V.framePts.push(new THREE.Vector3(sx*e, y0, sz*(h + M*.7)));
  V.framePts.push(new THREE.Vector3(rx, -.78, h + .03));
}

/* decor: paper grass and paper flowers on empty cells, a little on waiting ones */
function decor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z];
    const p = cellPos(x,z), a = new Acc(); let n = 0, fl = 0;
    if (!sl || sl === 'later') { n = 3; fl = AMBIENT() ? 2 : 1; grp.userData.decor = 'meadow'; }
    else if (!placed.includes(sl.id) && AMBIENT()) { n = 1; fl = sl.b === 'path' ? 0 : 1; V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else continue;
    for (let i=0;i<n;i++){ const an = r()*6.28, d = .12 + r()*.3; tuft(a, p.x + Math.cos(an)*d, p.z + Math.sin(an)*d, r, 3, TILE_TOP); }
    for (let i=0;i<fl;i++){ const an = r()*6.28, d = .1 + r()*.3; flower(a, p.x + Math.cos(an)*d, p.z + Math.sin(an)*d, r, TILE_TOP); }
    if (grp.userData.decor === 'meadow' && r() < .45) letter(a, r, p.x + (r()-.5)*.5, TILE_TOP + .004, p.z + (r()-.5)*.5, .09, r()*6, -Math.PI/2);
    a.into(grp); grp.traverse(o => { if (o.isMesh) o.castShadow = false; }); world.add(grp);
  }
}

/* ── origami residents ── */
const RCOL = { crane:[P.coral, P.white, P.yellow], bird:[P.teal, P.rose, P.lilac] };
function triGeo(pts){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flat()), 3)); g.computeVertexNormals(); return g; }
function origamiBird(col, flying){
  const o = new THREE.Group(), body = new THREE.Group(); o.add(body); const a = new Acc(), m = DS(col);
  a.add(new THREE.OctahedronGeometry(1, 0), col, at(0, .14, 0, 0, .055, .06, .12));
  a.add(new THREE.ConeGeometry(.018, .22, 3), col, at(0, .24, .12, 0, 1, 1, 1, .55));                 // neck
  a.add(new THREE.ConeGeometry(.014, .08, 3), col, at(0, .33, .2, 0, 1, 1, 1, 1.9));                   // head / beak
  a.add(new THREE.ConeGeometry(.02, .22, 3), col, at(0, .22, -.13, 0, 1, 1, 1, -.6));                 // tail
  if (!flying) { a.add(new THREE.CylinderGeometry(.006, .006, .1, 3), P.ink, at(-.025, .05, 0)); a.add(new THREE.CylinderGeometry(.006, .006, .1, 3), P.ink, at(.025, .05, 0)); }
  a.into(body);
  const wings = []; for (const sx of [-1, 1]) { const w = new THREE.Group(); w.position.set(0, .18, 0); body.add(w);
    const mesh = new THREE.Mesh(triGeo([[0, 0, -.09], [0, 0, .08], [sx*.26, .03, -.06]]), m); mesh.castShadow = true; w.add(mesh);
    w.rotation.z = sx*(flying ? .1 : .7); w.userData.sx = sx; wings.push(w); }
  body.userData.wings = wings; o.userData.body = body; return o;
}
function origamiFox(){
  const o = new THREE.Group(), body = new THREE.Group(); o.add(body); const a = new Acc();
  a.add(new THREE.ConeGeometry(.1, .24, 4), P.orange, at(0, .12, 0, Math.PI/4));                         // sitting body
  a.add(new THREE.ConeGeometry(.018, .02, 4), P.white, at(0, .06, .07));
  a.add(new THREE.OctahedronGeometry(1, 0), P.orange, at(0, .27, .03, 0, .075, .06, .07));               // head
  a.add(new THREE.ConeGeometry(.03, .09, 4), P.white, at(0, .25, .11, Math.PI/4, 1, 1, 1, Math.PI/2));   // muzzle
  a.add(new THREE.SphereGeometry(.012, 5, 4), P.ink, at(0, .25, .16));
  for (const sx of [-1, 1]) { a.add(new THREE.ConeGeometry(.03, .08, 4), P.orange, at(sx*.045, .35, .02, Math.PI/4)); a.add(new THREE.SphereGeometry(.009, 5, 4), P.ink, at(sx*.03, .285, .085)); }
  a.add(new THREE.ConeGeometry(.045, .22, 4), P.orange, at(.09, .06, -.08, 0, 1, 1, 1, Math.PI/2 + .3, -.9));   // tail
  a.add(new THREE.ConeGeometry(.02, .05, 4), P.white, at(.19, .09, -.14, 0, 1, 1, 1, 0, -1.2));
  a.into(body); o.userData.body = body; return o;
}
const RES_K = { Cranes:1.6, Birds:1.5, Fox:1.7 };
const RES_SPOTS = { Cranes:[[[0.15, 2.9], .9], [[0.45, 4.3], 1.8], [[5.2, 6.15], -.4]], Birds:[[[3, 3], 0], [[3, 3], 2.1], [[3, 3], 4.2]], Fox:[[[1.1, 6.1], 2.4]] };
function makeRes(id, i){ if (id === 'Fox') return origamiFox(); return origamiBird(RCOL[id === 'Cranes' ? 'crane' : 'bird'][i % 3], id === 'Birds'); }
const SHEET_GEO = new THREE.PlaneGeometry(.34, .34);
function placeRes(id){
  return RES_SPOTS[id].map(([[x, z], face], i) => { const o = makeRes(id, i), to = cellPos(x, z);
    o.userData.kind = id; o.userData.ph = face + i*1.3; o.userData.to = to; o.scale.setScalar(RES_K[id]); o.rotation.y = face; o.position.copy(to);
    o.traverse(m => { if (m.isMesh) m.castShadow = true; }); world.add(o); (V.bookRes = V.bookRes || []).push(o); V.life.push(o); return o; });
}
function birdPos(o, t, out){ const u = o.userData, a = t*.35 + u.ph, R = 1.45 + (u.ph % 1)*.4;
  return out.set(Math.cos(a)*R, TILE_TOP + 1.25 + Math.sin(t*1.3 + u.ph)*.12, Math.sin(a)*R*.85); }
function moveLife(t, dt){
  if (!V) return;
  (V.letters || []).forEach(p => { const u = p.userData, k = ((t*u.sp + u.ph) % 1 + 1) % 1, y = u.top - k*(u.top - TILE_TOP - .02);
    p.position.set(u.x + Math.sin(t*.7 + u.wob)*.22, y, u.z + Math.cos(t*.5 + u.wob)*.16); p.rotation.set(t*u.spin*.6 + u.wob, t*.5*u.spin, u.wob); });
  (V.bookRes || []).forEach(o => { const u = o.userData, b = u.body;
    if (u.kind === 'Birds') { const p = birdPos(o, t, new THREE.Vector3()), q = birdPos(o, t + .05, new THREE.Vector3()); o.position.copy(p); o.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
      b.rotation.z = -.25; b.userData.wings.forEach(w => w.rotation.z = w.userData.sx*Math.sin(t*9 + u.ph)*.7); }
    else if (u.kind === 'Cranes') b.rotation.x = Math.sin(t*.9 + u.ph)*.05;
    else b.rotation.z = Math.sin(t*1.4)*.03; });
}
function bookAmbient(){
  V.letters = []; const R = V.ring + .6, r = rngFrom(88), n = 6 + V.ring*5;
  for (let i=0;i<n;i++){ const acc = new Acc(); letter(acc, r, 0, 0, 0, .085); const g = new THREE.Group(); acc.into(g); g.traverse(m => { if (m.isMesh) m.castShadow = false; });
    g.userData = { x:(r()*2-1)*R, z:(r()*2-1)*R, ph:r(), sp:.035 + r()*.03, top:2 + V.ring*.3, wob:r()*6, spin:.6 + r() }; world.add(g); V.letters.push(g); V.life.push(g); }
  moveLife(2.1, 0);
}
/* move-in: each resident folds itself out of a flat square sheet, then settles (birds take off into their loop) */
async function bookMoveIn(walk){
  V.residentsIn = true; V.bookRes = [];
  const ids = ['Cranes', 'Birds', 'Fox'];
  for (let i=0;i<ids.length;i++){
    const id = ids[i], objs = placeRes(id); moveLife(S.rm || !walk ? 2.1 : performance.now()/1000, 0);
    if (walk && !S.rm) await new Promise(res => {
      const sheets = objs.map((o, j) => { const m = new THREE.Mesh(SHEET_GEO, DS(RCOL[id === 'Birds' ? 'bird' : 'crane'][j % 3] || P.orange)); m.position.set(0, .25, 0); o.add(m); o.userData.body.scale.setScalar(.001); return m; });
      tween(1300, t => objs.forEach((o, j) => { const u = Math.min(1, Math.max(0, t*1.25 - j*.12)), sh = sheets[j];
        sh.rotation.set(-Math.PI/2 + u*Math.PI*1.5, u*4, u*Math.PI*.5); sh.scale.set(Math.max(.001, 1 - u), Math.max(.001, 1 - u*u), 1);
        const k = u < .35 ? 0 : Math.min(1.08, (u - .35)/.55); o.userData.body.scale.set(Math.max(.001, k), Math.max(.001, Math.min(1, k*1.1)), Math.max(.001, k)); }),
        () => { objs.forEach((o, j) => { o.remove(sheets[j]); o.userData.body.scale.setScalar(1); sparkle(o.position.clone().setY(o.position.y + .35), 8, 0xFFF0B0, .5); }); res(); });
    });
    V.arrived = i + 1; hooks.renderChrome();
    if (walk) await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = ids.length;
}
function paperPuff(pos, n = 12){
  const r = rngFrom(Math.floor(pos.x*100 + pos.z*37) >>> 0);
  for (let i=0;i<n;i++){ const acc = new Acc(); letter(acc, r, 0, 0, 0, .07); const m = new THREE.Group(); acc.into(m); m.position.copy(pos); fx.add(m);
    const an = i/n*6.28, d = .3 + r()*.45, rise = .3 + r()*.4;
    tween(1000 + r()*400, t => { const e = 1 - Math.pow(1-t, 2); m.position.set(pos.x + Math.cos(an)*d*e, pos.y + .05 + Math.sin(t*Math.PI)*rise, pos.z + Math.sin(an)*d*e);
      m.rotation.set(t*8 + an, t*5, an); m.scale.setScalar(Math.max(.001, 1 - t*.6)); }, () => fx.remove(m)); }
}

export default {
  id:'book', name:'Storybook', title:'Your storybook',
  season:24, dates:'17–30 Aug', nextIn:14,
  kits:['a'],
  families:{
    water:   { label:'paper ponds & waves',     tag:'Water' },
    building:{ label:'pop-up houses & towers',  tag:'Pop-up' },
    path:    { label:'paper paths & pencils',   tag:'Path' },
    crop:    { label:'word sprouts',            tag:'Sprout' },
    tree:    { label:'paper & book trees',      tag:'Tree' },
    special: { label:'the quill & inkwell',     tag:'Special' }
  },
  slots:BOOK, order:FARM_ORDER,
  ground:{ tile:PAGE_TILE, tileMap:pageTileMap },
  ghost:{ color:'#6F84B0', opacity:.4, emissive:.12, dash:'#6F84B0', dashOpacity:.7, night:{ opacity:.3, emissive:.3, dashOpacity:.5 } },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M2.5 6.5C6 5 9.5 5.2 12 7c2.5-1.8 6-2 9.5-.5V19c-3.5-1.4-7-1.2-9.5.6-2.5-1.8-6-2-9.5-.6z" fill="#FBF5E7" stroke="#2F6275" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 7v12.6" stroke="#2F6275" stroke-width="1.4"/><path d="M17.5 2.5c-2.2 1.6-3.6 4.4-3.9 8.2l1 .2c.9-3.6 2.2-6 2.9-8.4z" fill="#6BAEE0"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M8 58c18-8 38-8 56 2 18-10 38-10 56-2v56c-18-8-38-8-56 2-18-10-38-10-56-2z"/><path d="M92 8c-10 8-18 24-22 44l6 2c6-18 12-32 16-46z"/><rect x="62" y="46" width="16" height="14" rx="3"/></g>',
  album:{ image:'assets/book/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#F6EEDD)' },
  css:'.phone[data-theme="book"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#F8F1E3 58%,#EDE0C6 100%)}',

  build(g, s, opt){
    const stage = opt.stage ?? cropStage(s.id);
    if (s.kind === 'sprout') {
      const tray = new THREE.Group(), ta = new Acc(); ta.add(box(.86, .06, .86), s.v ? P.kraft : P.peach, at(0, .03, 0)); ta.add(box(.78, .012, .78), s.v ? P.mint : P.greenL, at(0, .062, 0));
      ta.into(tray); tray.userData.ghostHide = true; g.add(tray);
      const host = new THREE.Group(); host.scale.setScalar(1.25); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillSprout(host, s, st); fillSprout(host, s, stage);
    } else B[s.b](g, s);
  },
  scaleOf: () => 1,
  contact: s => s.kind === 'sprout' || (s.kind === 'p' && !['path', 'fence'].includes(s.b)),
  nightLamp: s => s.cat === 'building' || s.cat === 'special' || s.v === 'lamp',
  decor,
  env: buildEnv,
  ambient: bookAmbient,
  tick(t, dt){ moveLife(t, dt); },
  onImpact(pos, big){ paperPuff(pos, big ? 18 : 10); },

  residents:[ { id:'Cranes', name:'Paper cranes' }, { id:'Birds', name:'Paper birds' }, { id:'Fox', name:'Origami fox' } ],
  moveIn: bookMoveIn,
  residentThumb(d, thumbFor){ return thumbFor('book:'+d.id, () => { const o = makeRes(d.id, 0); o.rotation.y = .6; return o; }, 168); },
  residentRig(d){ const obj = makeRes(d.id, 0); return { obj, mixer:new THREE.AnimationMixer(obj), clip:null, facing:.6 }; }
};
