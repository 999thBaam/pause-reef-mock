/* App hand-off exports (no node needed):
     ?export=spec&theme=<id>     → theme-spec-<id>.json   (slots, pieces, rules, motion, camera + lights per land size)
     ?export=sprites&theme=<id>  → sprites-<id>.zip       (every piece × growth stage, ghost, ground shadow, tiles, decor, residents;
                                                            transparent PNGs at 3× from the fixed camera + lights, per land size 3/5/7, + manifest.json)
   &save=0 skips the browser download (export.mjs pulls window.__export.files over CDP instead).
   Sprites are pixel-snapped to the land's hero frame: drawing each PNG at `pos` (top-left, hero px @3×) rebuilds the scene. */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RIG, rigFor, CAM_DIR, SUN_OFF, SHADOW_R, U, world as WORLD } from './scene.js';
import { S, TH, V, placed, setPlaced, RULES } from './state.js';
import { GRID, OFF, TILE_TOP, cellPos, ringOf, slotRing, footprint, edgeCentre, isEdge } from './grid.js';
import { MOTION } from './motion.js';
import { GATE, GATES_OF, FAMILIES } from './rules.js';
import { loadAnimal, modelBox } from './kit.js';

export const HERO = { w:390, h:322, scale:3 };             // the phone hero (CSS --hero: 322px on a 390 pt phone), exported at 3×
const LANDS = [1,2,3];                                      // ring → land size 2r+1
const Z_RULE = 'Draw: ground (layer 0) → every ground shadow, multiplied (layer 1) → decor, ghosts, pieces and residents sorted by depth ascending '+
  '(depth = world x + z of the anchor; bigger = nearer the camera; ties: decor < ghost < piece < resident) (layer 2) → env front (layer 3). '+
  'Place each sprite at pos (hero px @3×, top-left); anchor = the slot origin (footprint centre on the tile top) inside the sprite.';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const r3 = v => Math.round(v*1000)/1000;
const hex = c => '#'+c.toString(16).padStart(6,'0');
const spriteName = (s, stage) => s.stages ? s.id+'_s'+stage : s.id;
const stagesOf = s => s.stages ? Array.from({ length:s.stages }, (_, i) => i+1) : [1];
const anchorOf = g => new THREE.Vector3(g.position.x, TILE_TOP, g.position.z);

/* ───────────── camera: the page's fixed orthographic pose; frame = land-specific bounds in view space ───────────── */
const cam = new THREE.OrthographicCamera(-1,1,1,-1,1,140);
cam.position.copy(CAM_DIR).multiplyScalar(60); cam.up.set(0,1,0); cam.lookAt(0,0,0); cam.updateMatrixWorld();
const toView = p => p.clone().applyMatrix4(cam.matrixWorldInverse);
function toPx(p, land){ const v = toView(p); return [(v.x - land.view.l)*land.ppu, (land.view.t - v.y)*land.ppu]; }

async function buildLand(api, ring, ids){ S.forceRing = ring; setPlaced(ids); await api.buildView(); }
function measure(api, ring, complete){
  const f = api.computeFrame({ empty:false, w:HERO.w, h:HERO.h });
  const ppu = HERO.w*HERO.scale / (f.r - f.l);
  const land = { size:2*ring+1, ring, view:{ l:f.l, r:f.r, t:f.t, b:f.b }, ppu, px:[HERO.w*HERO.scale, HERO.h*HERO.scale], complete:!!complete };
  const cells = {}; for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++) if (ringOf(x,z) <= ring) cells[x+','+z] = toPx(cellPos(x,z), land).map(r3);
  land.cellsPx = cells; return land;
}
const landOut = l => ({ size:l.size, ring:l.ring, complete:l.complete, view:{ l:r3(l.view.l), r:r3(l.view.r), t:r3(l.view.t), b:r3(l.view.b) },
  pxPerUnit:r3(l.ppu), heroPx:l.px, cellCentresPx:l.cellsPx });

/* ───────────── SPEC ───────────── */
function lightsSpec(api){
  const sd = SUN_OFF.clone().normalize(), D = rigFor(TH(), false), N = rigFor(TH(), true);
  return {
    day:{ hemisphere:{ sky:hex(D.hemi.sky), ground:hex(D.hemi.ground), intensity:D.hemi.intensity },
          sun:{ color:hex(D.sun.color), intensity:D.sun.intensity, direction:[r3(sd.x), r3(sd.y), r3(sd.z)], distance:RIG.sun.dist,
                shadow:{ mapSize:RIG.sun.shadowMap, bias:RIG.sun.bias, normalBias:RIG.sun.normalBias, type:'PCF soft', orthoHalfExtent:r3(SHADOW_R), near:1, far:70 } },
          fill:{ color:hex(D.fill.color), intensity:D.fill.intensity, position:RIG.fill.pos } },
    night:{ hemisphere:{ sky:hex(N.hemi.sky), ground:hex(N.hemi.ground), intensity:N.hemi.intensity },
            sun:{ color:hex(N.sun.color), intensity:N.sun.intensity }, fill:{ color:hex(N.fill.color), intensity:N.fill.intensity },
            lamps:'warm point light (#FFA84A, 2.2 on 2×2 / 1.4 on 1×1, range 2.6) + glow in front of up to 6 placed lamp pieces (theme.nightLamp)', fireflies:24 },
    toneMapping:RIG.toneMapping, exposure:D.exposure, nightExposure:N.exposure, mood:TH().mood || null, outputColorSpace:'sRGB',
    ghost:api.ghostSpec,
    contactShadow:'radial dark plane under model pieces, opacity .5, colour #1f2a12, size = footprint bbox × 1.05 + .2 (≤ 2.2)'
  };
}
export async function buildSpec(api){
  const th = TH(), keep = saveState();
  try {
    const lands = {};
    for (const r of LANDS) { await buildLand(api, r, []); lands[2*r+1] = landOut(measure(api, r)); }
    await buildLand(api, 3, th.slots.map(s => s.id)); lands['7_complete'] = landOut(measure(api, 3, true));
    const scaleOf = th.scaleOf || (() => 1);
    const slots = th.slots.map(s => { const fp = isEdge(s) ? edgeCentre(s) : footprint(s);
      return { id:s.id, x:s.x, z:s.z, w:s.w||1, d:s.d||1, ...(isEdge(s) ? { edge:s.edge, len:s.len } : {}), ring:slotRing(s), landSizes:LANDS.filter(r => r >= slotRing(s)).map(r => 2*r+1),
        origin:[r3(fp.cx), TILE_TOP, r3(fp.cz)], family:s.cat, allowedGates:GATES_OF(s.cat), piece:s.id, order:th.order.indexOf(s.id) }; });
    const pieces = th.slots.map(s => ({ id:s.id, name:s.name || th.families[s.cat].label, gate:s.gate, family:s.cat, type:s.b || s.kind, model:s.model || null,
      growthStages:s.stages || 1, scale:r3(scaleOf(s)),
      sprites:{ stages:stagesOf(s).map(st => spriteName(s, st)), ghost:s.id+'_ghost', shadow:stagesOf(s).map(st => spriteName(s, st)+'_shadow') } }));
    return {
      format:'pause-theme-spec', version:1, generated:new Date().toISOString(),
      theme:{ id:th.id, name:th.name, title:th.title, season:th.season, dates:th.dates, nextThemeInDays:th.nextIn, icon:th.icon, kits:th.kits,
        families:th.families, ground:th.ground?.tile || 'grass (engine default)', alwaysAnimate:!!th.alwaysAnimate },
      rules:{
        minutesPerPiece:RULES.MIN_PER_PIECE, dailyCap:RULES.DAILY_CAP, slotsPerTheme:th.slots.length, expiry:'none: unfinished themes wait in the album',
        newThemeEveryDays:14,
        pick:{ choices:3, algorithm:'walk theme.order, skipping placed slots and slots outside the current land; take the first slot of each new family until 3, then fill with the next unplaced slots' },
        land:{ sizes:[3,5,7], rule:'land = the smallest ring whose slots are not all placed; the drop that fills a ring triggers the expansion ('+MOTION.expand.durationMs+' ms, after '+MOTION.expand.afterDropDelayMs+' ms)', pickOnlyOnCurrentLand:true },
        growth:{ stages:5, rule:'a growing piece is stage 1 when placed and +1 for every piece placed after it, ripe at 5; an unplaced ghost shows stage 4' },
        completion:'when the last slot is placed: confetti, banner "<Theme> complete · It’s in your album", residents move in one by one, "Moving in" becomes "Residents"',
        gates:Object.entries(GATE).map(([id, g]) => ({ gate:id, name:g.name, family:g.cat, plate:g.plate, builds:th.families[g.cat].label }))
      },
      grid:{ size:GRID, tileTop:TILE_TOP, cell:'cell (x,z) centre = world (x-'+OFF+', '+TILE_TOP+', z-'+OFF+')', ringOf:'max(|x-3|, |z-3|); a slot belongs to the outermost ring it touches; edge pieces (fences) are ring 3',
        tileColours:(th.ground?.tile || { top:['#88C052','#80B84C'] }).top, tileChecker:'(x+z) odd → top[0], even → top[1], ±0.6% hue / ±1.5% lightness jitter per cell' },
      order:th.order, slots, pieces,
      residents:th.residents.map(d => ({ ...d })),
      animation:MOTION,
      camera:{ projection:'orthographic', direction:CAM_DIR.toArray().map(r3), elevationDeg:r3(Math.asin(CAM_DIR.y)*180/Math.PI), lookAt:[0,0,0], distance:60, near:1, far:140,
        fit:'frame = the land block (tile tops + soil bottom at y=-.63) + every slot bbox of the current land (ghosts included), pad x 3.5%, top 4%, bottom 5% (20% on an empty land), aspect = hero',
        hero:HERO, lands },
      lights:lightsSpec(api)
    };
  } finally { await restoreState(api, keep); }
}

/* ───────────── SPRITES ───────────── */
function saveState(){ return { placed:placed.slice(), forceRing:S.forceRing, night:S.night, sway:U.sway.value }; }
async function restoreState(api, k){ S.forceRing = k.forceRing; S.night = k.night; U.sway.value = k.sway; setPlaced(k.placed); if (api.afterExport) await api.afterExport(); }

function makeRig(api){
  const xr = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true });
  const R = rigFor(TH(), false);                             // the theme's day rig (shared RIG unless theme.mood / theme.lights)
  xr.setPixelRatio(1); xr.outputColorSpace = THREE.SRGBColorSpace; xr.toneMapping = api.toneMapping; xr.toneMappingExposure = new URLSearchParams(location.search).get('exp') ? api.exposure : R.exposure;
  xr.shadowMap.enabled = true; xr.shadowMap.type = THREE.PCFSoftShadowMap; xr.setClearColor(0, 0);
  const xs = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(R.hemi.sky, R.hemi.ground, R.hemi.intensity);
  const sun = new THREE.DirectionalLight(R.sun.color, R.sun.intensity);
  sun.castShadow = true; sun.shadow.mapSize.set(RIG.sun.shadowMap, RIG.sun.shadowMap); sun.shadow.bias = RIG.sun.bias; sun.shadow.normalBias = RIG.sun.normalBias;
  sun.position.copy(SUN_OFF).normalize().multiplyScalar(RIG.sun.dist); sun.target.position.set(0,0,0);
  const sc = sun.shadow.camera; sc.left=-SHADOW_R; sc.right=SHADOW_R; sc.top=SHADOW_R; sc.bottom=-SHADOW_R; sc.near=1; sc.far=70; sc.updateProjectionMatrix();
  const fill = new THREE.DirectionalLight(R.fill.color, R.fill.intensity); fill.position.set(...RIG.fill.pos); fill.target.position.set(0,0,0);
  xs.add(hemi, sun, fill, sun.target, fill.target);
  // receiver for the ground-shadow layer (hidden for normal sprites; never casts)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI/2), new THREE.MeshStandardMaterial({ color:0x9A9A9A, roughness:1 }));
  ground.position.y = TILE_TOP; ground.receiveShadow = true; ground.visible = false; xs.add(ground);
  const c2 = document.createElement('canvas'), g2 = c2.getContext('2d', { willReadFrequently:true });
  return { xr, xs, sun, ground, c2, g2 };
}
function rectFor(pts, land, margin){
  let l=1e9, r=-1e9, t=1e9, b=-1e9;
  for (const p of pts) { const [x,y] = toPx(p, land); l = Math.min(l,x); r = Math.max(r,x); t = Math.min(t,y); b = Math.max(b,y); }
  return { x0:Math.floor(l) - margin, y0:Math.floor(t) - margin, x1:Math.ceil(r) + margin, y1:Math.ceil(b) + margin };
}
function shoot(rig, rect, land){
  const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0, u = 1/land.ppu, f = land.view;
  cam.left = f.l + rect.x0*u; cam.right = f.l + rect.x1*u; cam.top = f.t - rect.y0*u; cam.bottom = f.t - rect.y1*u; cam.updateProjectionMatrix();
  rig.xr.setSize(w, h, false); rig.xr.render(rig.xs, cam);
  rig.c2.width = w; rig.c2.height = h; rig.g2.clearRect(0,0,w,h); rig.g2.drawImage(rig.xr.domElement, 0, 0);
  return rig.g2.getImageData(0, 0, w, h);
}
function alphaBox(im, thr=2){
  const { width:w, height:h, data:d } = im; let l=w, r=-1, t=h, b=-1;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) if (d[(y*w+x)*4+3] > thr) { if (x<l) l=x; if (x>r) r=x; if (y<t) t=y; if (y>b) b=y; }
  return r < 0 ? null : { l, r, t, b, w, h };
}
function cropPNG(im, box, pad=2){
  const x0 = Math.max(0, box.l-pad), y0 = Math.max(0, box.t-pad), x1 = Math.min(im.width, box.r+1+pad), y1 = Math.min(im.height, box.b+1+pad);
  const c = document.createElement('canvas'); c.width = x1-x0; c.height = y1-y0;
  c.getContext('2d').putImageData(im, -x0, -y0, x0, y0, x1-x0, y1-y0);
  return { x0, y0, w:c.width, h:c.height, png:c.toDataURL('image/png') };
}
function worldPts(obj){ obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj, true); if (b.isEmpty()) return [];
  const out = []; for (const x of [b.min.x,b.max.x]) for (const y of [b.min.y,b.max.y]) for (const z of [b.min.z,b.max.z]) out.push(new THREE.Vector3(x,y,z)); return out; }
/* render obj alone (no ground) — grows the margin until nothing touches the border, then crops to the alpha bbox */
function spriteOf(rig, obj, land, pts){
  rig.xs.add(obj);
  let margin = 24, res = null;
  for (let k=0; k<4; k++) {
    const rect = rectFor(pts, land, margin), im = shoot(rig, rect, land), box = alphaBox(im);
    if (!box) { res = null; break; }
    const touches = box.l <= 0 || box.t <= 0 || box.r >= box.w-1 || box.b >= box.h-1;
    res = { rect, im, box, clipped:touches }; if (!touches) break; margin *= 2.5;
  }
  rig.xs.remove(obj);
  if (!res) return null;
  const c = cropPNG(res.im, res.box); return { pos:[res.rect.x0 + c.x0, res.rect.y0 + c.y0], size:[c.w, c.h], png:c.png, clipped:res.clipped };
}
/* ground shadow: (lit ground without the caster) vs (with it); alpha = 1 − with/without, drawn black = a multiply layer */
function shadowOf(rig, obj, land, pts){
  const sd = SUN_OFF.clone().normalize(), ext = pts.slice();
  pts.forEach(p => { if (p.y > TILE_TOP) { const k = (p.y - TILE_TOP)/sd.y; ext.push(new THREE.Vector3(p.x - sd.x*k, TILE_TOP, p.z - sd.z*k)); } });
  const rect = rectFor(ext, land, 16);
  // three's shadow pass follows object.visible + the camera's layers, so the caster stays in the scene and only stops writing colour/depth
  rig.ground.scale.setScalar(land.size / 40); rig.ground.visible = true; rig.xs.add(obj); obj.visible = false;   // receiver = this land's tile tops only
  const a = shoot(rig, rect, land); obj.visible = true;
  const mats = new Map();          // materials are shared (9 crop plants, template parts): save each one once
  obj.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!mats.has(m)) mats.set(m, [m.colorWrite, m.depthWrite]); }); });
  mats.forEach((_, m) => { m.colorWrite = false; m.depthWrite = false; });
  const b = shoot(rig, rect, land);
  mats.forEach(([c, d], m) => { m.colorWrite = c; m.depthWrite = d; });
  rig.xs.remove(obj); rig.ground.visible = false;
  const out = new ImageData(a.width, a.height), A = a.data, B = b.data, O = out.data;
  for (let i=0;i<A.length;i+=4){ const la = A[i]*.2126 + A[i+1]*.7152 + A[i+2]*.0722, lb = B[i]*.2126 + B[i+1]*.7152 + B[i+2]*.0722;
    const al = la > 1 ? Math.max(0, Math.min(1, 1 - lb/la)) : 0; O[i] = O[i+1] = O[i+2] = 0; O[i+3] = al < .015 ? 0 : Math.round(al*255); }
  const box = alphaBox(out, 3); if (!box) return null;
  const c = cropPNG(out, box); return { pos:[rect.x0 + c.x0, rect.y0 + c.y0], size:[c.w, c.h], png:c.png };
}

export async function buildSprites(api, onProgress = () => {}){
  const th = TH(), keep = saveState(), files = [], manifest = { format:'pause-theme-sprites', version:1, theme:th.id, scale:HERO.scale, hero:HERO,
    zOrder:Z_RULE, lighting:'day rig, sway at rest; shadow sprites are black with alpha = 1 − shadowed/lit luminance (multiply)', lands:{}, sprites:[] };
  const rig = makeRig(api);
  const add = (land, name, spr, meta) => { if (!spr) return; const file = 'L'+land.size+'/'+name+'.png';
    files.push({ name:file, data:spr.png.split(',')[1] }); const e = { file, land:land.size, pos:spr.pos, size:spr.size, ...meta };
    if (meta.anchorWorld) { const [ax, ay] = toPx(meta.anchorWorld, land); e.anchor = [r3(ax - spr.pos[0]), r3(ay - spr.pos[1])]; e.depth = r3(meta.anchorWorld.x + meta.anchorWorld.z); delete e.anchorWorld; }
    if (spr.clipped) e.warning = 'touches the render border'; manifest.sprites.push(e); };
  S.night = false; U.sway.value = 0;
  try {
    for (const ring of LANDS) {
      // A) nothing placed: frame, ground, waiting + meadow decor
      await buildLand(api, ring, []); const land = measure(api, ring); manifest.lands[land.size] = landOut(land);
      onProgress('L'+land.size+' ground');
      const groundObjs = world().filter(o => o.userData.ground), O = new THREE.Vector3(0, TILE_TOP, 0);
      // bounds from the block, tiles and blob only: the shadow catcher is a 200-unit plane that is transparent except where shadowed
      const group = objs => { const g = new THREE.Group(); objs.filter(o => o.userData.ground !== 'catcher').forEach(o => g.add(o)); const pts = worldPts(g);
        objs.filter(o => o.userData.ground === 'catcher').forEach(o => g.add(o)); return [g, pts]; };
      const [gAll, gPts] = group(groundObjs);
      add(land, 'ground', spriteOf(rig, gAll, land, gPts), { kind:'ground', layer:0, anchorWorld:O, note:'soil block + every tile (checker + jitter) + soft block shadow' });
      const [soil, sPts] = group(groundObjs.filter(o => !o.isInstancedMesh));
      add(land, 'soil', spriteOf(rig, soil, land, sPts), { kind:'soil', layer:0, anchorWorld:O, note:'block without tiles (the expansion scales it from the previous size)' });
      const caps = groundObjs.find(o => o.isInstancedMesh);
      if (caps) { const top = api.tileColours();
        top.forEach((col, i) => { const m = new THREE.Mesh(caps.geometry, caps.material.clone()); m.material.color.set(col); m.receiveShadow = true;
          add(land, 'tile_'+'ab'[i], spriteOf(rig, m, land, worldPts(m)), { kind:'tile', layer:0, anchorWorld:new THREE.Vector3(0, TILE_TOP, 0), note:'(x+z) '+(i ? 'even' : 'odd')+' cells; place at each cellCentresPx' }); }); }
      for (const g of world().filter(o => o.userData.decor)) { const [x,z] = g.userData.cell, p = cellPos(x,z);
        add(land, 'decor_'+g.userData.decor+'_'+x+'_'+z, spriteOf(rig, g, land, worldPts(g)), { kind:'decor', decor:g.userData.decor, cell:[x,z], layer:2, anchorWorld:p }); }
      if (V.env) { const back = new THREE.Group(), front = new THREE.Group();
        V.env.children.slice().forEach(o => (o.renderOrder < 5 ? back : front).add(o));   // back: rear water + caustics; front: front water, glass edges, rays, bubbles
        add(land, 'env_back', spriteOf(rig, back, land, worldPts(back)), { kind:'env', layer:0.5, anchorWorld:new THREE.Vector3(0, TILE_TOP, 0) });
        add(land, 'env_front', spriteOf(rig, front, land, worldPts(front)), { kind:'env', layer:3, anchorWorld:new THREE.Vector3(0, TILE_TOP, 0) }); }
      // B) every piece of this land: each growth stage, its ground shadow, its ghost
      const slots = th.slots.filter(s => slotRing(s) <= ring);
      for (const s of slots) {
        onProgress('L'+land.size+' '+s.id);
        for (const st of stagesOf(s)) {
          const g = api.buildPiece(s, { stage:st }); api.addContact(g, s); const aw = anchorOf(g), pts = worldPts(g), nm = spriteName(s, st);
          const meta = { slot:s.id, stage:st, footprint:{ x:s.x, z:s.z, w:s.w||1, d:s.d||1, ...(isEdge(s) ? { edge:s.edge, len:s.len } : {}) } };
          add(land, nm, spriteOf(rig, g, land, pts), { kind:'piece', layer:2, anchorWorld:aw, ...meta });
          add(land, nm+'_shadow', shadowOf(rig, g, land, pts), { kind:'shadow', layer:1, blend:'multiply', anchorWorld:aw, ...meta });
          await sleep(0);
        }
        const gh = api.ghostify(api.buildPiece(s, { stage:4 }), s);
        add(land, s.id+'_ghost', spriteOf(rig, gh, land, worldPts(gh)), { kind:'ghost', layer:2, slot:s.id, anchorWorld:anchorOf(gh) });
      }
      // C) everything placed: rim tufts (and at 7×7 the completed frame + residents)
      await buildLand(api, ring, slots.map(s => s.id));
      for (const g of world().filter(o => o.userData.decor === 'rim')) { const [x,z] = g.userData.cell;
        add(land, 'decor_rim_'+x+'_'+z, spriteOf(rig, g, land, worldPts(g)), { kind:'decor', decor:'rim', cell:[x,z], layer:2, anchorWorld:cellPos(x,z) }); }
      if (ring === 3) { const done = measure(api, 3, true); manifest.lands['7_complete'] = landOut(done);
        await residents(api, rig, th, land, add, onProgress); }
    }
  } finally { rig.xr.dispose(); rig.xr.forceContextLoss(); await restoreState(api, keep); }
  manifest.count = manifest.sprites.length;
  files.push({ name:'manifest.json', data:btoa(unescape(encodeURIComponent(JSON.stringify(manifest, null, 1)))) });
  return { files, manifest };
}
const world = () => WORLD.children.slice();

/* residents, 7×7 only (they arrive on completion): idle frames at their resting facing, walk/swim frames along the move-in path */
async function residents(api, rig, th, land, add, onProgress){
  const clipName = n => n.replace(/^.*\|/, '');
  for (const d of th.residents) {
    onProgress('resident '+d.id);
    let rig2 = th.residentRig ? th.residentRig(d) : null, sets;
    if (rig2) {
      const pos = cellPos(3, 3).setY(TILE_TOP + .9);
      sets = [{ tag:'swim', clip:rig2.clip, n:6, facing:rig2.facing, pos }];
    } else {
      const gltf = await loadAnimal(d), obj = SkeletonUtils.clone(gltf.scene);
      obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.material = o.material.clone(); o.material.metalness = 0; o.material.roughness = .85; } });
      const box = modelBox(obj); const k = d.h / (box.max.y - box.min.y); obj.scale.setScalar(k);
      const holder = new THREE.Group(); obj.position.y = -box.min.y*k; holder.add(obj);
      const mixer = new THREE.AnimationMixer(obj), clips = {}; gltf.animations.forEach(c => clips[clipName(c.name)] = c);
      const at = api.animalPos(d), gate = cellPos(3, 7.3), dir = at.clone().sub(gate);
      rig2 = { obj:holder, mixer };
      sets = [ { tag:'idle', clip:clips.Idle || Object.values(clips)[0], n:4, facing:d.face, pos:at },
               { tag:'walk', clip:clips[d.walk || 'Walk'] || clips.Idle, n:6, facing:Math.atan2(dir.x, dir.z), pos:at } ];
    }
    for (const set of sets) {
      rig2.obj.position.copy(set.pos); rig2.obj.rotation.y = set.facing;
      const act = set.clip ? rig2.mixer.clipAction(set.clip) : null; if (act) { rig2.mixer.stopAllAction(); act.reset().play(); }
      for (let i=0;i<set.n;i++){
        if (act) { act.time = set.clip.duration * i / set.n; rig2.mixer.update(0); }
        const aw = rig2.obj.position.clone(), pts = worldPts(rig2.obj);
        const nm = 'res_'+d.id+'_'+set.tag+'_'+i;
        add(land, nm, spriteOf(rig, rig2.obj, land, pts), { kind:'resident', layer:2, resident:d.id, clipFrame:i, frames:set.n, fps:Math.round(set.n / (set.clip ? set.clip.duration : 1) * 10)/10,
          facingRad:r3(set.facing), anchorWorld:aw });
        if (i === 0 && set.tag !== 'swim') add(land, 'res_'+d.id+'_'+set.tag+'_shadow', shadowOf(rig, rig2.obj, land, worldPts(rig2.obj)), { kind:'shadow', layer:1, blend:'multiply', resident:d.id, anchorWorld:aw });
        await sleep(0);
      }
    }
  }
}

/* ───────────── zip (STORE) + download ───────────── */
const CRC = (() => { const t = new Uint32Array(256); for (let n=0;n<256;n++){ let c = n; for (let k=0;k<8;k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8){ let c = 0xFFFFFFFF; for (let i=0;i<u8.length;i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
const b64u8 = b => Uint8Array.from(atob(b), ch => ch.charCodeAt(0));
export function zip(files){
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = b64u8(f.data), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type:'application/zip' });
}
export function download(blob, name){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
export const jsonFile = (name, obj) => ({ name, data:btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 1)))) });
