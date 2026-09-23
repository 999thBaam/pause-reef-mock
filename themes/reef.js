/* REEF (?theme=reef) — same 7×7 ring blueprint, camera and light rig as the farm; every farm slot id maps to an underwater
   piece, so the farm's order, rings, pick-3, growth and expansion work unchanged. Wrecks/ruins/rocks = Kenney Pirate Kit (CC0);
   fish + manta = Quaternius Animated Fish (CC0); coral, sea fans, kelp, anemones, shells and the giant clam are procedural
   flat-shaded three.js geometry (merged per material, one mesh per material per piece, so every piece stays pre-renderable). */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { rngFrom, TEX, addSway, CAM_DIR, world, fx } from '../engine/scene.js';
import { S, V, TH, placed, AMBIENT, cropStage, hooks } from '../engine/state.js';
import { GRID, TILE_TOP, cellPos, ringOf, slotRing, isEdge, edgeCentre } from '../engine/grid.js';
import { KITCACHE, ANIMCACHE, loader, addModel, fitScale } from '../engine/kit.js';
import { G, Acc, seg, blob, perp, _up, _q, _m, _s } from '../engine/proc.js';
import { tween, sparkle } from '../engine/motion.js';
import { FARM, FARM_ORDER } from './farm.js';

const RM = (hex, o = {}) => new THREE.MeshStandardMaterial({ color:hex, roughness:.78, metalness:0, flatShading:true, ...o });
const RMAT = {
  rubble:RM(0xD9C7A2), rock:RM(0x9C9189), rockD:RM(0x7C7278), sand:RM(0xF1E0BB, { roughness:1 }), pebble:RM(0xC9B8A0),
  shellA:RM(0xFFE6D2), shellB:RM(0xF7B7A3), shellC:RM(0xF9D48B), star:RM(0xF2784B), starB:RM(0xE5484D),
  gold:RM(0xF6C544, { emissive:0x7A5200, emissiveIntensity:.35, roughness:.45 }),
  clamShell:RM(0xEDE4F4, { side:THREE.DoubleSide }), clamRib:RM(0xD8CBEA, { side:THREE.DoubleSide }),
  mantle:RM(0x2FB3D0, { emissive:0x0C5A7A, emissiveIntensity:.35 }), mantleDot:RM(0x9EF0FF, { emissive:0x3FC6E6, emissiveIntensity:.5 }),
  pearl:new THREE.MeshStandardMaterial({ color:0xFFFBF4, emissive:0xEDE3FF, emissiveIntensity:.55, roughness:.22, metalness:.05 })
};
/* coral palette: body / tip pairs */
const CORAL = {
  pink:[0xFF7F95, 0xFFD0DA], orange:[0xFF9448, 0xFFD39A], purple:[0xA070E0, 0xE3CCFF], yellow:[0xF4C63D, 0xFFF0A8],
  teal:[0x3CC4A8, 0xB8F5E6], red:[0xE24A55, 0xFFB0A8], lilac:[0xC49BF2, 0xF6E8FF], coralRed:[0xF0605A, 0xFFC4A0]
};
const CMAT = {}; function cm(hex, extra){ const k = hex+(extra||''); return CMAT[k] || (CMAT[k] = RM(hex, extra==='d' ? { side:THREE.DoubleSide } : {})); }
const SWAYM = {}; function swayMat(hex, h, amp){ const k = hex+':'+h+':'+amp; if (SWAYM[k]) return SWAYM[k];
  const m = RM(hex, { side:THREE.DoubleSide }); addSway(m, h, amp); return SWAYM[k] = m; }

/* 3-D branching coral (staghorn / coral tree) */
function branch3(acc, body, tip, p, dir, len, r, depth, rng, spread=.62, lift=.3){
  const end = p.clone().addScaledVector(dir, len);
  seg(acc, body, p, dir, len, r, r*.74);
  if (depth <= 0) { blob(acc, tip, end, r*1.25); return; }
  const n = depth > 1 && rng() < .35 ? 3 : 2;
  for (let i=0;i<n;i++){ const ax = perp(dir, rng); const nd = dir.clone().applyAxisAngle(ax, spread*(.6 + rng()*.6)).lerp(_up, lift).normalize();
    branch3(acc, body, tip, end, nd, len*(.72 + rng()*.14), r*.72, depth-1, rng, spread, lift); }
}
/* flat fan (sea fan): branching inside one plane */
function branch2(acc, mat, p, ang, len, r, depth, rng){
  const dir = new THREE.Vector3(Math.sin(ang), Math.cos(ang), 0), end = p.clone().addScaledVector(dir, len);
  seg(acc, mat, p, dir, len, r, r*.8, 4);
  if (depth <= 0) return;
  const n = rng() < .3 ? 3 : 2;
  for (let i=0;i<n;i++){ const a = ang + (n===2 ? (i ? 1 : -1) : (i-1)) * (.3 + rng()*.22);
    branch2(acc, mat, end, a*.9, len*(.8 + rng()*.12), r*.82, depth-1, rng); }
}

/* ── coral colonies, sized by growth stage 1..5 (a stage-5 bed is "ripe": taller, brighter, a second species) ── */
function colony(acc, sp, stage, p, rng, pal){
  const [bc, tc] = CORAL[pal], body = cm(bc), tip = cm(tc), s = Math.min(stage, 5), g = .55 + s*.13;
  if (sp === 'Staghorn') {
    if (s === 1) { for (let i=0;i<4;i++){ const a = i*1.7 + rng(); blob(acc, tip, p.clone().add(new THREE.Vector3(Math.cos(a)*.05, .03, Math.sin(a)*.05)), .028); } return; }
    for (let i=0;i<(s>3?3:2);i++){ const a = rng()*6.28, d = new THREE.Vector3(Math.cos(a)*.35, 1, Math.sin(a)*.35).normalize();
      branch3(acc, body, tip, p.clone().add(new THREE.Vector3(Math.cos(a)*.03, 0, Math.sin(a)*.03)), d, .07 + s*.018, .024 + s*.003, Math.min(3, s-1), rng, .6, .35); }
  } else if (sp === 'Brain') {
    blob(acc, body, p.clone().setY(p.y + .02), (.05 + s*.028), .72, 1, rng);
    if (s >= 3) blob(acc, tip, p.clone().add(new THREE.Vector3(.05*g, .04 + s*.012, -.03)), .02 + s*.006, .7);
  } else if (sp === 'Tube') {
    const n = 1 + s;
    for (let i=0;i<n;i++){ const a = i*2.4 + rng(), rr = i ? .035 + rng()*.04 : 0, h = (.05 + s*.035) * (.55 + rng()*.6);
      const q = p.clone().add(new THREE.Vector3(Math.cos(a)*rr, 0, Math.sin(a)*rr));
      acc.add(new THREE.CylinderGeometry(.026, .02, h, 7, 1, true).translate(0, h/2, 0), cm(bc,'d'), _m.makeTranslation(q.x, q.y, q.z));
      acc.add(new THREE.CircleGeometry(.022, 7).rotateX(-Math.PI/2).translate(0, h - .012, 0), cm(0x7A2E2E), _m.makeTranslation(q.x, q.y, q.z));
      acc.add(new THREE.TorusGeometry(.024, .006, 4, 7).rotateX(Math.PI/2).translate(0, h, 0), tip, _m.makeTranslation(q.x, q.y, q.z)); }
  } else if (sp === 'Table') {
    const h = .03 + s*.03, r = .05 + s*.035;
    seg(acc, body, p, _up, h, .02, .016);
    acc.add(new THREE.CylinderGeometry(r, r*.7, .025, 9).translate(0, h, 0), tip, _m.makeTranslation(p.x, p.y, p.z));
    if (s >= 4) acc.add(new THREE.CylinderGeometry(r*.62, r*.45, .02, 8).translate(.02, h*.55, -.015), body, _m.makeTranslation(p.x, p.y, p.z));
  }
}
const BED = { Corn:['Staghorn','pink'], Carrot:['Tube','orange'], Lettuce:['Brain','teal'], Beet:['Table','purple'] };
const BED_NAME = { Corn:'Staghorn bed', Carrot:'Tube coral bed', Lettuce:'Brain coral bed', Beet:'Table coral bed' };
const BED_PALS = ['pink','orange','purple','yellow','teal','red','lilac','coralRed'];
function fillBed(host, s, stage){
  host.clear();
  const r = rngFrom(s.x*31 + s.z*7 + 5), [sp, pal0] = BED[s.crop], acc = new Acc();
  const pal = [pal0, BED_PALS[(s.x*3 + s.z) % BED_PALS.length]];
  const spots = [[-.2,-.16],[.19,-.12],[-.05,.2],[.24,.22],[-.26,.16]];
  const n = stage >= 3 ? 4 : 3;
  for (let i=0;i<n;i++){ const [x,z] = spots[i]; colony(acc, i===3 ? 'Brain' : sp, stage, new THREE.Vector3(x + (r()-.5)*.05, .05, z + (r()-.5)*.05), r, i===3 ? 'yellow' : pal[i%2]); }
  if (stage >= 5) colony(acc, sp==='Brain' ? 'Tube' : 'Brain', 4, new THREE.Vector3(.02, .05, -.02), r, 'lilac');
  acc.into(host); host.userData.stage = stage;
}

/* ── named pieces ── */
function shells(acc, n, rng, rad=.34, y=.035, cx=0, cz=0){
  for (let i=0;i<n;i++){ const a = rng()*6.28, d = rad*(.35 + rng()*.65), p = new THREE.Vector3(cx + Math.cos(a)*d, y, cz + Math.sin(a)*d);
    const g = new THREE.ConeGeometry(.055, .03, 8, 1).translate(0, .015, 0);
    acc.add(g, [RMAT.shellA, RMAT.shellB, RMAT.shellC][i%3], _m.compose(p, _q.setFromEuler(new THREE.Euler(0, rng()*6, 0)), new THREE.Vector3(1, .8, .78))); }
}
const STAR_GEO = (() => { const sh = new THREE.Shape(); for (let i=0;i<10;i++){ const a = i/10*Math.PI*2 - Math.PI/2, r = i%2 ? .028 : .085; i ? sh.lineTo(Math.cos(a)*r, Math.sin(a)*r) : sh.moveTo(Math.cos(a)*r, Math.sin(a)*r); }
  return new THREE.ExtrudeGeometry(sh, { depth:.018, bevelEnabled:true, bevelSize:.01, bevelThickness:.01, bevelSegments:1 }).rotateX(-Math.PI/2); })();
function starfish(acc, p, rot, mat){ acc.add(STAR_GEO, mat, _m.compose(p, _q.setFromEuler(new THREE.Euler(0, rot, 0)), _s)); }
function kitPart(g, name, h, w, x=0, y=0, z=0, rot=0, tilt=0){ const tpl = KITCACHE.reef && KITCACHE.reef[name]; if (!tpl) return null;
  const o = addModel(g, name, fitScale(tpl, h, w), x, y, z, rot, 'reef'); if (o && tilt) o.rotation.z = tilt; return o; }

const REEF_BUILD = {
  wreck(g){ kitPart(g, 'ship-wreck', 1.55, 2.75, 0, -.02, 0, -.6);
    const a = new Acc(), r = rngFrom(21);
    colony(a, 'Brain', 4, new THREE.Vector3(.7, .02, .62), r, 'teal'); colony(a, 'Staghorn', 3, new THREE.Vector3(-.72, .02, .55), r, 'pink');
    colony(a, 'Tube', 3, new THREE.Vector3(.55, .02, -.7), r, 'orange'); shells(a, 3, r, .9, .02); a.into(g); },
  anemone(g, s){ const a = new Acc(), r = rngFrom(s.x*5 + s.z), pal = s.v === 2 ? [0xB06BE0, 0xF4D2FF] : [0xF07B5A, 0xFFC0D6];
    blob(a, RMAT.rock, new THREE.Vector3(0, .02, 0), .2, .45, 0, r);
    seg(a, cm(pal[0]), new THREE.Vector3(0, .04, 0), _up, .14, .1, .13, 9);
    const t = new Acc(), tm = swayMat(pal[1], .45, .09);
    for (let ring=0; ring<2; ring++) for (let i=0;i<(ring?14:10);i++){ const ang = i/(ring?14:10)*6.28 + ring*.2, rr = ring ? .115 : .06;
      const d = new THREE.Vector3(Math.cos(ang)*(ring ? .75 : .35), 1, Math.sin(ang)*(ring ? .75 : .35)).normalize(), len = ring ? .22 : .26;
      const p = new THREE.Vector3(Math.cos(ang)*rr, .17, Math.sin(ang)*rr);
      const cg = new THREE.CylinderGeometry(.008, .024, len, 5, 3).translate(0, len/2, 0);
      _q.setFromUnitVectors(_up, d); t.add(cg, tm, _m.compose(p, _q, _s)); blob(t, cm(0xFFFFFF), p.clone().addScaledVector(d, len), .016); }
    shells(a, 2, r, .38); a.into(g); t.into(g); },
  seafan(g, s){ const a = new Acc(), r = rngFrom(s.x*11 + s.z*3), pal = s.pal || 'red';
    blob(a, RMAT.rock, new THREE.Vector3(0, .02, 0), .17, .5, 0, r);
    const fan = new Acc(); branch2(fan, cm(CORAL[pal][0]), new THREE.Vector3(0, .05, 0), 0, .2, .04, 5, r);
    const fg = new THREE.Group(); fan.into(fg); fg.scale.setScalar(1.12); fg.rotation.y = s.rot ? s.rot*Math.PI/180 : .7; g.add(fg);
    const small = new Acc(); branch2(small, cm(CORAL[pal][1]), new THREE.Vector3(0, .02, 0), 0, .12, .025, 4, r);
    const sg = new THREE.Group(); small.into(sg); sg.position.set(.24, 0, .18); sg.rotation.y = 1.5; g.add(sg);
    a.into(g); },
  coraltree(g, s){ const a = new Acc(), r = rngFrom(s.x*7 + s.z*13), pal = s.pal || 'orange';
    blob(a, RMAT.rock, new THREE.Vector3(0, .02, 0), .22, .45, 0, r);
    branch3(a, cm(CORAL[pal][0]), cm(CORAL[pal][1]), new THREE.Vector3(0, .05, 0), _up.clone(), .3, .065, 4, r, .55, .3);
    colony(a, 'Brain', 3, new THREE.Vector3(.26, .03, .2), r, 'teal'); a.into(g); },
  kelp(g, s){ const a = new Acc(), r = rngFrom(s.x*17 + s.z*5), H = s.tall ? 1.45 : 1.15;
    blob(a, RMAT.rockD, new THREE.Vector3(0, .02, 0), .2, .4, 0, r);
    const cols = [0x5E9B3A, 0x86B544, 0x6FA83D];
    for (let k=0;k<(s.tall?5:4);k++){ const h = H*(.62 + r()*.38), ph = r()*6, bx = (r()-.5)*.28, bz = (r()-.5)*.28;
      const pg = new THREE.PlaneGeometry(.1, h, 1, 12), pos = pg.attributes.position;
      for (let i=0;i<pos.count;i++){ const y = pos.getY(i) + h/2, w = 1 - .5*(y/h); pos.setXYZ(i, pos.getX(i)*w + Math.sin(y*5 + ph)*.045, y, Math.sin(y*3 + ph)*.03 + pos.getX(i)*.4); }
      a.add(pg, swayMat(cols[k%3], H, .06), _m.compose(new THREE.Vector3(bx, .04, bz), _q.setFromEuler(new THREE.Euler(0, r()*3, 0)), _s));
      for (let b=1;b<4;b++) blob(a, cm(0xA6B84A), new THREE.Vector3(bx + Math.sin(h*b/4*5 + ph)*.045, .04 + h*b/4.2, bz), .022); }
    a.into(g); },
  seagrass(g, s){ const a = new Acc(), r = rngFrom(s.x*9 + s.z*23);
    for (let i=0;i<34;i++){ const ang = r()*6.28, d = Math.sqrt(r())*.4, h = .16 + r()*.2;
      const pg = new THREE.PlaneGeometry(.028, h, 1, 3).translate(0, h/2, 0), pos = pg.attributes.position;
      for (let j=0;j<pos.count;j++){ const y = pos.getY(j); pos.setX(j, pos.getX(j) + (y/h)*(y/h)*.05); }
      a.add(pg, swayMat([0x6DB04A, 0x8BC653, 0x5A9A3C][i%3], .36, .12), _m.compose(new THREE.Vector3(Math.cos(ang)*d, .02, Math.sin(ang)*d), _q.setFromEuler(new THREE.Euler(0, r()*6, 0)), _s)); }
    const b = new Acc(); REEF_BUILD.anemone(g.add(new THREE.Group()).children.at(-1), { x:s.x, z:s.z, v:2 }); g.children.at(-1).scale.setScalar(.6); g.children.at(-1).position.set(.22, 0, .2);
    shells(b, 2, r, .4); starfish(b, new THREE.Vector3(-.25, .03, .22), 1, RMAT.star); a.into(g); b.into(g); },
  sandpath(g, s){ const slab = new THREE.Mesh(G.path, RMAT.sand); slab.position.y = .0175; slab.receiveShadow = true; g.add(slab);
    const a = new Acc(), r = rngFrom(s.x*13 + s.z*29), v = s.v || 0;
    if (v === 1) { starfish(a, new THREE.Vector3(-.14, .045, .08), r()*6, RMAT.star); starfish(a, new THREE.Vector3(.16, .045, -.12), r()*6, RMAT.starB); shells(a, 3, r, .38, .04); }
    else if (v === 2) { kitPart(g, 'rocks-sand-a', .34, .72, 0, .03, 0, r()*6); shells(a, 2, r, .42, .04); }
    else { shells(a, 5, r, .38, .04); starfish(a, new THREE.Vector3(.2, .045, .18), r()*6, RMAT.star); }
    for (let i=0;i<5;i++) blob(a, RMAT.pebble, new THREE.Vector3((r()-.5)*.8, .04, (r()-.5)*.8), .025 + r()*.02, .6);
    a.into(g); g.userData.ghostMode = 'marker'; },
  ridge(g, s){ for (let i=0;i<s.len;i++){ const nm = ['rocks-a','rocks-sand-b','rocks-c'][(i + s.x) % 3];
      s.edge === 'w' ? kitPart(g, nm, .4, .6, -.4, 0, i - (s.len-1)/2, i*1.3) : kitPart(g, nm, .4, .6, i - (s.len-1)/2, 0, .4, i*1.3); }
    const fp = edgeCentre(s); g.position.set(fp.cx, TILE_TOP, fp.cz); },
  tower(g){ kitPart(g, 'castle-wall', 1.15, .8, 0, -.02, 0, -.5, .06); const a = new Acc(), r = rngFrom(4);
    colony(a, 'Brain', 3, new THREE.Vector3(.3, .02, .3), r, 'yellow'); colony(a, 'Staghorn', 2, new THREE.Vector3(-.3, .02, .3), r, 'purple'); a.into(g);
    REEF_BUILD.kelp(g.add(new THREE.Group()).children.at(-1), { x:1, z:9 }); g.children.at(-1).scale.setScalar(.5); g.children.at(-1).position.set(-.3, 0, -.25); },
  chest(g){ kitPart(g, 'chest', .42, .56, 0, 0, 0, -.5, -.08); const a = new Acc(), r = rngFrom(12);
    for (let i=0;i<9;i++){ const ang = -.2 + r()*1.6, d = .26 + r()*.16; a.add(new THREE.CylinderGeometry(.035, .035, .012, 10), RMAT.gold,
      _m.compose(new THREE.Vector3(Math.cos(ang)*d, .03 + (i%3)*.012, Math.sin(ang)*d), _q.setFromEuler(new THREE.Euler(r()*.5, 0, r()*.5)), _s)); }
    shells(a, 2, r, .4); a.into(g); },
  cargo(g){ kitPart(g, 'barrel', .3, .3, -.18, 0, -.12, .4, Math.PI/2); kitPart(g, 'crate', .26, .34, .18, 0, .1, .5, .12); kitPart(g, 'bottle', .2, .1, -.2, 0, .26, 0, 1.2);
    const a = new Acc(), r = rngFrom(33); colony(a, 'Tube', 2, new THREE.Vector3(.25, .02, -.24), r, 'yellow'); a.into(g); },
  cannon(g){ kitPart(g, 'cannon', .34, .62, 0, 0, 0, .9, .1); kitPart(g, 'cannon-ball', .1, .1, .3, 0, .25); kitPart(g, 'cannon-ball', .1, .1, .36, 0, .14);
    const a = new Acc(), r = rngFrom(8); colony(a, 'Brain', 2, new THREE.Vector3(-.26, .02, .26), r, 'pink'); a.into(g); },
  arch(g){ kitPart(g, 'castle-gate', 1.0, .95, 0, -.02, 0, .6); const a = new Acc(), r = rngFrom(19);
    colony(a, 'Table', 3, new THREE.Vector3(.35, .02, .32), r, 'teal'); a.into(g); },
  clam(g){                                           // the hero: a giant clam, lid open, a glowing pearl on a blue mantle
    const a = new Acc(), r = rngFrom(99);
    blob(a, RMAT.rock, new THREE.Vector3(0, .02, 0), .92, .26, 1, r);
    const R = .6, shellGeo = (() => { const gg = new THREE.SphereGeometry(R, 28, 7, 0, Math.PI*2, Math.PI/2, Math.PI/2), p = gg.attributes.position, v = new THREE.Vector3();
      for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p, i); const az = Math.atan2(v.z, v.x), k = 1 + .09*Math.abs(Math.cos(az*4.5)); p.setXYZ(i, v.x*k, v.y*.55*k, v.z*k*.82); }
      gg.computeVertexNormals(); return gg; })();
    const base = new THREE.Group(); base.position.y = .52; g.add(base);
    const low = new THREE.Mesh(shellGeo, RMAT.clamShell); low.castShadow = low.receiveShadow = true; base.add(low);
    const mantle = new THREE.Mesh(new THREE.SphereGeometry(R*.9, 24, 6).scale(1, .12, .8), RMAT.mantle); mantle.position.y = -.03; base.add(mantle);
    const dots = new Acc(); for (let i=0;i<16;i++){ const ang = i*2.4, d = .2 + (i%4)*.1; blob(dots, RMAT.mantleDot, new THREE.Vector3(Math.cos(ang)*d, .03, Math.sin(ang)*d*.8), .022, .5); } dots.into(base);
    const hinge = new THREE.Group(); hinge.position.set(0, 0, -R*.8); hinge.rotation.x = -.95; base.add(hinge);
    const lid = new THREE.Mesh(shellGeo, RMAT.clamRib); lid.rotation.x = Math.PI; lid.position.z = R*.8; lid.castShadow = true; hinge.add(lid);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(.17, 24, 16), RMAT.pearl); pearl.position.set(0, .12, .02); base.add(pearl);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xE9DFFF, transparent:true, opacity:.85, blending:THREE.AdditiveBlending, depthWrite:false }));
    glow.position.copy(pearl.position); glow.scale.setScalar(.95); glow.userData.glow = true; glow.renderOrder = 9; base.add(glow);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.star, color:0xFFFFFF, transparent:true, opacity:.9, blending:THREE.AdditiveBlending, depthWrite:false }));
    sp.position.set(.08, .22, .1); sp.scale.setScalar(.14); sp.userData.glow = true; sp.renderOrder = 9; base.add(sp);
    colony(a, 'Staghorn', 4, new THREE.Vector3(.72, .12, .45), r, 'pink'); colony(a, 'Brain', 4, new THREE.Vector3(-.7, .1, .5), r, 'yellow');
    colony(a, 'Tube', 3, new THREE.Vector3(.65, .1, -.55), r, 'orange'); shells(a, 4, r, .95, .12); starfish(a, new THREE.Vector3(-.35, .2, .78), .4, RMAT.star);
    a.into(g); g.userData.pearl = pearl;
  }
};

/* blueprint: every farm slot id → an underwater piece (same cells, same rings, same order) */
const REEF_MAP = {
  bigbarn:{ name:'Shipwreck', b:'wreck' }, well:{ name:'Anemone', b:'anemone' }, apple1:{ name:'Red sea fan', b:'seafan', pal:'red' },
  silo:{ name:'Sunken tower', b:'tower' }, silohouse:{ name:'Treasure chest', b:'chest' }, coop:{ name:'Lost cargo', b:'cargo' },
  watertower:{ name:'Kelp forest', b:'kelp', tall:true }, pump:{ name:'Kelp', b:'kelp' }, apple2:{ name:'Coral tree', b:'coraltree', pal:'orange' },
  berry1:{ name:'Purple sea fan', b:'seafan', pal:'purple' }, peepal:{ name:'Giant clam', b:'clam' }, smallbarn:{ name:'Old cannon', b:'cannon' },
  openbarn:{ name:'Sunken arch', b:'arch' }, pond:{ name:'Seagrass meadow', b:'seagrass' }, orange1:{ name:'Coral tree', b:'coraltree', pal:'yellow' },
  apple3:{ name:'Sea fan', b:'seafan', pal:'coralRed' }, berry2:{ name:'Lilac sea fan', b:'seafan', pal:'lilac' }, orange2:{ name:'Coral tree', b:'coraltree', pal:'red' },
  apple4:{ name:'Sea fan', b:'seafan', pal:'purple' }
};
const PATH_V = { path3_4:0, path1_2:1, path5_2:2, path3_5:1, path3_0:0, path2_6:2, path3_6:0 };
const SLOTS = FARM.map(f => {
  const s = { id:f.id, cat:f.cat, gate:f.gate, x:f.x, z:f.z, w:f.w, d:f.d };
  if (f.kind === 'field') return { ...s, kind:'bed', crop:f.crop, name:BED_NAME[f.crop], stages:5 };
  if (f.kind === 'path') { const v = PATH_V[f.id] ?? 0; return { ...s, kind:'reef', b:'sandpath', v, name:['Shell path','Starfish sand','Rock garden'][v] }; }
  if (f.kind === 'fence') return { ...s, kind:'reef', b:'ridge', edge:f.edge, len:f.len, name:'Rock ridge' };
  const m = REEF_MAP[f.id]; return { ...s, kind:'reef', ...m };
});

/* ── the look: sand tiles on a rock block, a glass water cube, caustics, god rays, bubble streams ── */
const REEF_TILE = { top:['#EFD9AA','#E8D09E'], side:'#D9BF8E', soilTop:'#A89C8C', soilBot:'#4E4B5E' };
function reefTileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(41);
  g.fillStyle = '#F4EFE6'; g.fillRect(0,0,N,N);
  for (let i=0;i<9;i++){ g.strokeStyle = 'rgba(150,115,60,.13)'; g.lineWidth = 3; g.beginPath();
    for (let x=0;x<=N;x+=6){ const y = (i+.5)*N/9 + Math.sin(x*.05 + i)*5; x ? g.lineTo(x,y) : g.moveTo(x,y); } g.stroke(); }
  for (let i=0;i<260;i++){ g.fillStyle = r()<.5 ? 'rgba(255,255,255,.55)' : 'rgba(140,100,50,.14)'; g.beginPath(); g.arc(r()*N, r()*N, .6 + r()*1.3, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const causticTex = (() => {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N), r = rngFrom(58);
  const P = Array.from({ length:18 }, () => [r()*N, r()*N]);
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){ let d1 = 1e9, d2 = 1e9;
    for (const [px,py] of P) for (let ox=-1;ox<=1;ox++) for (let oy=-1;oy<=1;oy++){ const dx = x - px - ox*N, dy = y - py - oy*N, d = dx*dx + dy*dy; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    const e = Math.sqrt(d2) - Math.sqrt(d1), v = Math.pow(Math.max(0, 1 - e/6), 2.6), i = (y*N + x)*4;
    im.data[i] = im.data[i+1] = im.data[i+2] = 255; im.data[i+3] = v*255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
const rayTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const v = g.createLinearGradient(0,0,0,256); v.addColorStop(0,'rgba(255,255,255,0)'); v.addColorStop(.25,'rgba(255,255,255,.55)'); v.addColorStop(.7,'rgba(255,255,255,1)'); v.addColorStop(1,'rgba(255,255,255,.6)');
  g.fillStyle = v; g.fillRect(0,0,64,256); g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0,0,64,0); h.addColorStop(0,'rgba(0,0,0,0)'); h.addColorStop(.5,'rgba(0,0,0,1)'); h.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle = h; g.fillRect(0,0,64,256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const bubbleTex = (() => { const s = 64, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  const gr = g.createRadialGradient(s/2, s/2, s*.2, s/2, s/2, s*.46); gr.addColorStop(0,'rgba(255,255,255,.08)'); gr.addColorStop(.8,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(s/2, s/2, s*.46, 0, 6.3); g.fill();
  g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(s*.38, s*.36, s*.08, s*.05, -.6, 0, 6.3); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const WATER_UNI = { uYb:{ value:0 }, uYt:{ value:2 } };
function waterMat(back){
  return new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side: back ? THREE.BackSide : THREE.FrontSide, uniforms:WATER_UNI,
    vertexShader:'varying vec2 vUv; varying float vY; varying vec3 vN; void main(){ vUv = uv; vN = normal; vec4 w = modelMatrix * vec4(position,1.); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader:`uniform float uYb; uniform float uYt; varying vec2 vUv; varying float vY; varying vec3 vN;
      void main(){ float h = clamp((vY - uYb)/(uYt - uYb), 0., 1.);
        vec3 deep = vec3(.05,.40,.70), shallow = vec3(.30,.74,.92);
        vec3 col = mix(deep, shallow, pow(h, .8));
        float e = max(abs(vUv.x - .5), abs(vUv.y - .5)) * 2.;
        float rim = smoothstep(.93, 1., e);
        float top = step(.5, vN.y);
        float a = ${back ? '.16 + .06*(1.-h)' : '.20 + .12*(1.-h)'} + rim*${back ? '.10' : '.34'};
        if (top > .5) { col = mix(shallow, vec3(1.), .25); a = ${back ? '.06' : '.16'} + rim*.3; }
        col = mix(col, vec3(1.), rim*.55);
        gl_FragColor = vec4(col, a); }` });
}
function buildReefEnv(){
  const L = V.L, top = Math.max(1.3 + (V.ring-1)*.3, Math.max(...V.boxes.map(b => b.max.y)) + .1), yb = -.1;
  WATER_UNI.uYb.value = yb; WATER_UNI.uYt.value = top;
  const env = new THREE.Group(); env.userData.env = true; world.add(env); V.env = env; V.waterTop = top;
  const h = L/2 + .02; for (const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) V.framePts.push(new THREE.Vector3(sx*(h+.04), top, sz*(h+.04)));   // the camera frames the water cube
  const box = new THREE.BoxGeometry(L + .08, top - yb, L + .08).translate(0, (top + yb)/2, 0);
  const back = new THREE.Mesh(box, waterMat(true)); back.renderOrder = -1;
  const front = new THREE.Mesh(box, waterMat(false)); front.renderOrder = 8;
  env.add(back, front);
  // glass edges: thin bright lines on the 4 vertical edges + the rim
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color:0xFFFFFF, transparent:true, opacity:.55, depthWrite:false }));
  edges.renderOrder = 9; env.add(edges);
  // caustics on the sand
  const cm2 = new THREE.MeshBasicMaterial({ map:causticTex, color:0xE6FBFF, transparent:true, opacity:.22, blending:THREE.AdditiveBlending, depthWrite:false });
  causticTex.repeat.set(L/1.1, L/1.1);
  const caus = new THREE.Mesh(new THREE.PlaneGeometry(L - .04, L - .04).rotateX(-Math.PI/2), cm2); caus.position.y = TILE_TOP + .004; caus.renderOrder = 1; env.add(caus); V.caustic = cm2;
  // god rays: slanted soft shafts from the surface
  V.rays = [];
  const rr = rngFrom(3);
  for (let i=0;i<4;i++){ const w = .38 + rr()*.3, hh = (top - TILE_TOP)*.95;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, hh).translate(0, -hh/2, 0), new THREE.MeshBasicMaterial({ map:rayTex, color:0xFFFFFF, transparent:true, opacity:.8 + rr()*.2, depthWrite:false, side:THREE.DoubleSide }));
    s.rotation.set(0, Math.atan2(CAM_DIR.x, CAM_DIR.z), 0); s.rotateZ(.3); const m0 = L/2 - .45;
    s.position.set(-m0 + (i/3)*2*m0 + .15, top - .02, m0*(i%2 ? .5 : -.6)); s.renderOrder = 10;
    s.userData.base = s.material.opacity; s.userData.ph = i*1.7; env.add(s); V.rays.push(s); }
  // bubble streams: from the clam / a rock vent / the wreck, whichever cells are on the land
  V.bubbles = [];
  const srcs = [[.7,.9],[4.3,2.3],[2.3,3.6],[3.7,2.1],[5.6,5.2],[1.2,5.4]].filter(([x,z]) => Math.max(Math.abs(x-3), Math.abs(z-3)) <= V.ring + .4);
  srcs.forEach(([x,z], si) => { const p = cellPos(x, z);
    for (let i=0;i<7;i++){ const b = new THREE.Sprite(new THREE.SpriteMaterial({ map:bubbleTex, transparent:true, opacity:.9, depthWrite:false }));
      b.userData = { x:p.x, z:p.z, ph:i/7 + si*.13, sz:.08 + ((i*37)%5)*.016, sp:.12 + (si%3)*.02, wob:i*1.3 }; b.renderOrder = 10; env.add(b); V.bubbles.push(b); } });
  moveBubbles(2.1);
}
function moveBubbles(t){
  if (!V || !V.bubbles) return; const top = V.waterTop;
  V.bubbles.forEach(b => { const u = b.userData, f = ((t*u.sp + u.ph) % 1 + 1) % 1, y = TILE_TOP + .15 + f*(top - TILE_TOP - .2);
    b.position.set(u.x + Math.sin(t*2 + u.wob + f*6)*.05, y, u.z + Math.cos(t*1.6 + u.wob)*.04); b.scale.setScalar(u.sz*(.7 + f*.6)); b.material.opacity = f > .9 ? (1-f)*9 : Math.min(1, f*8)*.9; });
  (V.rays || []).forEach(s => s.material.opacity = s.userData.base * (.75 + .25*Math.sin(t*.6 + s.userData.ph)));
  if (V.caustic) { V.caustic.map.offset.set(Math.sin(t*.13)*.4 + t*.012, Math.cos(t*.11)*.35); }
}
function bubbleBurst(pos, n=10){
  for (let i=0;i<n;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:bubbleTex, transparent:true, opacity:.95, depthWrite:false })); s.renderOrder = 10;
    const a = i/n*6.28, d = .15 + Math.random()*.35, sz = .05 + Math.random()*.06, rise = 1 + Math.random()*.8; s.position.copy(pos); fx.add(s);
    tween(1300 + Math.random()*500, t => { const e = 1 - Math.pow(1-t, 2); s.position.set(pos.x + Math.cos(a)*d*e + Math.sin(t*9+i)*.04, pos.y + .1 + t*rise, pos.z + Math.sin(a)*d*e);
      s.scale.setScalar(sz*(.6 + t*.6)); s.material.opacity = .95*(1 - t*t); }, () => { fx.remove(s); s.material.dispose(); });
  }
}
/* decor: small shells, pebbles and seagrass tufts on waiting cells; a little coral garden on cells nothing will use */
function reefDecor(slots){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z, grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const p = cellPos(x,z), a = new Acc();
    const tuft = (px, pz, n) => { for (let i=0;i<n;i++){ const h = .1 + r()*.12, pg = new THREE.PlaneGeometry(.022, h, 1, 2).translate(0, h/2, 0);
      a.add(pg, swayMat([0x7DBB4A, 0x5FA24A][i%2], .3, .12), _m.compose(new THREE.Vector3(px + (r()-.5)*.08, TILE_TOP, pz + (r()-.5)*.08), _q.setFromEuler(new THREE.Euler((r()-.5)*.4, r()*6, 0)), _s)); } };
    if (!sl || sl === 'later') {
      tuft(p.x - .2, p.z + .15, 6); tuft(p.x + .22, p.z - .2, 5);
      colony(a, ['Brain','Staghorn','Tube'][Math.floor(r()*3)], 2, new THREE.Vector3(p.x + (r()-.5)*.3, TILE_TOP, p.z + (r()-.5)*.3), r, BED_PALS[Math.floor(r()*BED_PALS.length)]);
      shells(a, 2, r, .4, TILE_TOP + .01, p.x, p.z); a.into(grp); grp.userData.decor = 'meadow';
    } else if (!placed.includes(sl.id) && AMBIENT()) { tuft(p.x + .3, p.z + .3, 3); shells(a, 1, r, .35, TILE_TOP + .01, p.x, p.z);
      if (sl.b !== 'sandpath') colony(a, ['Staghorn','Brain','Tube'][Math.floor(r()*3)], 1, new THREE.Vector3(p.x - .28, TILE_TOP, p.z + .26), r, BED_PALS[Math.floor(r()*BED_PALS.length)]);
      a.into(grp); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else world.remove(grp);
  }
}
/* fish: ambient 3 from the start; residents (a school, clownfish, snapper, a manta) swim in on completion */
const FISH_YAW = 0;
const FISHLEN = { Fish1:.46, Fish2:.4, Fish3:.34, Manta:1.3 };
export function makeFish(id, len){
  const gltf = ANIMCACHE['_'+id]; if (!gltf) return null;
  const obj = SkeletonUtils.clone(gltf.scene);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.opacity = 1; o.material.transparent = false;
    o.material.metalness = 0; o.material.roughness = .7; } });
  const holder = new THREE.Group(); obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = len / Math.max(sz.x, sz.z); obj.scale.setScalar(k); obj.position.set(-c.x*k, -c.y*k, -c.z*k); holder.add(obj);
  const mixer = new THREE.AnimationMixer(obj); if (gltf.animations[0]) { const act = mixer.clipAction(gltf.animations[0]); act.play(); act.time = Math.random(); mixer.update(0); }
  return { holder, mixer, clip:gltf.animations[0] };
}
async function loadFish(){ await Promise.all(['Fish1','Fish2','Fish3','Manta'].map(async id => { if (!ANIMCACHE['_'+id]) ANIMCACHE['_'+id] = await loader.loadAsync('assets/reef/'+id+'.glb'); })); }
function swimPos(u, t, out){
  const a = t*u.sp + u.ph;
  out.set(u.cx + Math.cos(a)*u.rx + u.ox, u.h + Math.sin(a*1.7 + u.ph)*u.bob, u.cz + Math.sin(a)*u.rz + u.oz); return out;
}
function addSwimmer(id, u, resident){
  const f = makeFish(id, (u.len || FISHLEN[id]) * (1 + (V.ring-1)*.3)); if (!f) return null;
  f.u = { cx:0, cz:0, rx:1, rz:1, ox:0, oz:0, h:1, bob:.06, sp:.4, ph:0, ...u }; f.resident = resident; f.arrive = resident ? 0 : 1;
  world.add(f.holder); (V.fish || (V.fish = [])).push(f); V.life.push(f.holder); return f;
}
function reefAmbient(){
  V.fish = [];
  const R = V.ring, top = V.waterTop;
  addSwimmer('Fish3', { cx:.55, cz:.6, rx:.35 + R*.18, rz:.3 + R*.15, h:.5, sp:.55, ph:.4 });
  addSwimmer('Fish1', { cx:0, cz:0, rx:.8 + R*.45, rz:.6 + R*.4, h:top*.55, sp:-.3, ph:2.2 });
  addSwimmer('Fish2', { cx:-.2, cz:.3, rx:.6 + R*.35, rz:.7 + R*.3, h:top*.72, sp:.36, ph:4.4 });
  swimFish(2.1, 0);
}
function residentGroups(){
  const top = V.waterTop;
  return [
    () => { const g = []; for (let i=0;i<7;i++) g.push(addSwimmer('Fish2', { cx:0, cz:0, rx:2.2, rz:1.9, h:top*.7, sp:.28, ph:1 + i*.11, ox:Math.sin(i*2.1)*.22, oz:Math.cos(i*1.7)*.2, bob:.04, len:.26 + (i%3)*.03 }, true)); return g; },
    () => [addSwimmer('Fish3', { cx:1.1, cz:-.9, rx:.34, rz:.3, h:.62, sp:.7, ph:0 }, true), addSwimmer('Fish3', { cx:1.1, cz:-.9, rx:.34, rz:.3, h:.7, sp:.7, ph:2.4 }, true)],
    () => [0,1,2].map(i => addSwimmer('Fish1', { cx:-.6, cz:.8, rx:1.4, rz:1.1, h:top*.4 + i*.08, sp:-.34, ph:i*.35, ox:i*.12, oz:-i*.1 }, true)),
    () => [addSwimmer('Manta', { cx:0, cz:0, rx:2.4, rz:2.2, h:top*.8, sp:.16, ph:-1.2, bob:.1 }, true)]
  ];
}
function swimFish(t, dt){
  (V && V.fish || []).forEach(f => { const u = f.u; const p = swimPos(u, t, new THREE.Vector3()), q = swimPos(u, t + .05*Math.sign(u.sp || 1), new THREE.Vector3());
    if (f.arrive < 1) { const from = f.from || (f.from = p.clone().add(new THREE.Vector3(4.5, .6, 3.5))); const e = 1 - Math.pow(1 - f.arrive, 3); p.lerpVectors(from, p, e); }
    f.holder.position.copy(p); const d = q.sub(swimPos(u, t, new THREE.Vector3())); f.holder.rotation.y = Math.atan2(d.x, d.z) + FISH_YAW;
    if (u.id === 'Manta') f.holder.rotation.z = Math.sin(t*.8)*.12;
    f.mixer.update(dt); });
}
async function reefMoveIn(walk){
  const groups = residentGroups(); V.residentsIn = true;
  for (let i=0;i<groups.length;i++){
    const fish = groups[i]().filter(Boolean);
    if (!walk) { fish.forEach(f => f.arrive = 1); continue; }
    await new Promise(res => tween(S.rm ? 1 : 1400, t => fish.forEach((f, j) => f.arrive = Math.min(1, Math.max(0, t*1.15 - j*.02))),
      () => { fish.forEach(f => f.arrive = 1); const p = fish[0].holder.position.clone(); sparkle(p, 10, 0xE9F8FF, .6); bubbleBurst(p, 8); res(); }));
    V.arrived = i + 1; hooks.renderChrome();
    await new Promise(r => setTimeout(r, S.rm ? 0 : 160));
  }
  V.arrived = groups.length;
}

export default {
  id:'reef', name:'Reef', title:'Your reef',
  season:3, dates:'29 Sep–12 Oct', nextIn:14,
  kits:['reef'],
  kitDefs:{ reef:{ file:'assets/reef/reef-kit.glb', stripSuffix:true } },
  families:{
    water:   { label:'kelp & anemones',        tag:'Sea garden' },
    building:{ label:'wrecks & ruins',         tag:'Wreck' },
    path:    { label:'sand, shells & rocks',   tag:'Seabed' },
    crop:    { label:'coral beds',             tag:'Coral' },
    tree:    { label:'sea fans & coral trees', tag:'Sea fan' },
    special: { label:'the giant clam',         tag:'Special' }
  },
  slots:SLOTS, order:FARM_ORDER,
  ground:{ tile:REEF_TILE, tileMap:reefTileMap },
  icon:'<svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 20V11M12 14l-4-4V6M12 12l4-4V5M8 10 5.5 8M16 8l2.5-1.5" fill="none" stroke="#FF7F95" stroke-width="2.4" stroke-linecap="round"/><circle cx="17.5" cy="17" r="2.4" fill="#E9DFFF" stroke="#B7A6E8"/></svg>',
  silhouette:'<g fill="currentColor"><path d="M20 70c6-12 18-18 30-18 9 0 17 4 22 10l10-8v26l-10-8c-5 6-13 10-22 10-12 0-24-6-30-12z"/><circle cx="36" cy="66" r="2.6" fill="#fff"/><path d="M60 118c0-16 4-26 10-34 2 10 0 18-4 24 6-4 10-12 10-20 6 10 6 22-2 30zM20 118c0-10 2-18 8-24 0 8 2 12 6 16 0-8 2-14 8-18-2 10 2 18-2 26z"/><path d="M88 118c0-12 2-22 8-28 2 8 0 14-2 20 4-4 8-10 8-16 4 8 4 16-2 24z"/></g>',
  album:{ image:'assets/reef/album.jpg', liveBg:'radial-gradient(80% 70% at 50% 50%,#FFFFFF,#E6F4F4)' },
  css:'.phone[data-theme="reef"] .card .art{background:radial-gradient(90% 80% at 50% 34%,#FFFFFF 0,#E3F5F8 58%,#C9E9F0 100%)}',

  async preload(){ await loadFish(); },
  build(g, s, opt){
    if (s.kind === 'bed') {             // Sudoku/Math → a coral bed on a rubble plate, grows like a crop
      const slab = new THREE.Mesh(G.field, RMAT.rubble); slab.position.y = .035; slab.scale.set(.96, .7, .96); slab.castShadow = slab.receiveShadow = true; g.add(slab);
      const host = new THREE.Group(); host.scale.setScalar(1.4); g.add(host); g.userData.plants = host; g.userData.regrow = st => fillBed(host, s, st);
      fillBed(host, s, opt.stage ?? cropStage(s.id));
    } else REEF_BUILD[s.b](g, s);
  },
  contact: s => s.kind === 'reef' && !['sandpath','ridge','seagrass'].includes(s.b),
  nightLamp: s => s.cat==='building' || s.cat==='special' || s.id==='well',
  decor: reefDecor,
  env: buildReefEnv,
  ambient: reefAmbient,
  tick(t, dt){ swimFish(t, dt); moveBubbles(t); },
  onImpact(pos, big){ bubbleBurst(pos, big ? 16 : 10); },

  residents:[ { id:'Fish2', name:'Blue tangs', n:7 }, { id:'Fish3', name:'Clownfish', n:2 }, { id:'Fish1', name:'Snapper', n:3 }, { id:'Manta', name:'Manta ray', n:1 } ],
  moveIn: reefMoveIn,
  residentThumb(d, thumbFor){ if (!ANIMCACHE['_'+d.id]) return '';
    return thumbFor('fish:'+d.id, () => { const f = makeFish(d.id, 1); f.mixer.update(.3); f.holder.rotation.y = Math.PI/2 + FISH_YAW + .5; return f.holder; }, 168); },
  /* sprite export: a swim cycle per species, at the ambient length */
  residentRig(d){ const f = makeFish(d.id, FISHLEN[d.id]*1.6); if (!f) return null; if (f.clip) f.mixer.clipAction(f.clip).time = 0; return { obj:f.holder, mixer:f.mixer, clip:f.clip, facing:Math.PI/2 }; }
};
