/* Ambient life shared by land themes: meadow tufts/flowers on empty and waiting cells, and 3 butterflies.
   Anything that moves on its own goes in V.life (hidden during the land expansion) and only animates while the loop is awake. */
import * as THREE from 'three';
import { world, rngFrom } from './scene.js';
import { GRID, OFF, TILE_TOP, cellPos, ringOf, slotRing, isEdge } from './grid.js';
import { V, TH, placed, AMBIENT } from './state.js';
import { T, addModel, fitScale } from './kit.js';

const FLOWER_TINTS = [0xF59BB8, 0xF4C84A, 0xFFF4E0, 0xB7A2F0];
const TINTED = new Map();
export function tintedFlower(parent, name, k, x, y, z, rot, tint){
  if (!T()[name]) return;                     // Flower_3/4 live in the farm kit; kit-a-primary themes simply get none (no console noise)
  const g = addModel(parent, name, k, x, y, z, rot); if (!g) return;
  g.traverse(o => { if (o.isMesh && /Cyan|Yellow/.test(o.material.name||'')) { const key = o.material.uuid + tint;
    if (!TINTED.has(key)) { const m2 = o.material.clone(); m2.color.setHex(tint); TINTED.set(key, m2); } o.material = TINTED.get(key); } });
  return g;
}
/* cfg.tuft(r) → [modelName, scale or 0 = fit to .18 tall]; cfg.flowers = tinted Flower_3/4 from the primary kit.
   Per cell: meadow (no slot ever / slot of a later ring), waiting ground (unplaced slot, cleared at impact), or a rim tuft. */
export function meadowDecor(slots, cfg){
  const occ = new Map();
  slots.forEach(sl => { if (isEdge(sl)) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), sl); });
  TH().slots.forEach(sl => { if (isEdge(sl) || slotRing(sl) <= V.ring) return; for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) occ.set((sl.x+a)+','+(sl.z+b), 'later'); });
  const r = rngFrom(19);
  const put = (grp, x, z, n, flowers, rim) => {
    for (let j=0;j<n;j++){ const [nm,k] = cfg.tuft(r); const tpl = T()[nm]; if (!tpl) continue;
      const a = r()*6.28, rad = rim ? .44 : .12 + r()*.34, p = cellPos(x,z); p.x += Math.cos(a)*rad; p.z += Math.sin(a)*rad;
      if (rim) { if (z-OFF === V.ring) p.z = z-OFF+.45; else p.x = x-OFF+.45; }
      addModel(grp, nm, (k || fitScale(tpl, .18, .4))*(.7+r()*.6), p.x, p.y, p.z, r()*6.28); }
    for (let j=0;j<flowers;j++){ if (!cfg.flowers) break; const a = r()*6.28, rad = .1 + r()*.34, p = cellPos(x,z); p.x += Math.cos(a)*rad; p.z += Math.sin(a)*rad;
      tintedFlower(grp, r()<.5 ? 'Flower_3' : 'Flower_4', .2 + r()*.08, p.x, p.y, p.z, r()*6.28, FLOWER_TINTS[Math.floor(r()*FLOWER_TINTS.length)]); }
  };
  for (let z=0; z<GRID; z++) for (let x=0; x<GRID; x++){
    const rg = ringOf(x,z); if (rg > V.ring) continue;
    const sl = occ.get(x+','+z), key = x+','+z;
    const grp = new THREE.Group(); grp.userData.rg = rg; grp.userData.cell = [x,z]; world.add(grp);
    const rimCell = (Math.abs(x-3) === V.ring && x > 3) || (Math.abs(z-3) === V.ring && z > 3);
    if (!sl || sl === 'later') { put(grp, x, z, 5, AMBIENT() ? 3 : 1, false); grp.userData.decor = 'meadow'; }
    else if (!placed.includes(sl.id) && AMBIENT()) { put(grp, x, z, 2, sl.kind==='path' ? 0 : 2, false); V.cellDecor[key] = grp; grp.userData.decor = 'waiting'; }
    else if (rimCell) { put(grp, x, z, 1, 0, true); grp.userData.decor = 'rim'; }
  }
}
export function clearCellDecor(sl){ for (let a=0;a<(sl.w||1);a++) for (let b=0;b<(sl.d||1);b++) { const k = (sl.x+a)+','+(sl.z+b), g = V.cellDecor[k]; if (g) { world.remove(g); delete V.cellDecor[k]; } } }

/* Butterflies: 3 little two-wing sprites tracing slow loops over the land. */
const BUTTER = [0xFFB020, 0xFFFFFF, 0xFF7A9A];
const wingGeo = new THREE.PlaneGeometry(.12, .1).rotateX(-Math.PI/2).translate(.06, 0, 0);
export function addButterflies(){
  V.butterflies = [];
  for (let i=0;i<3;i++){
    const b = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color:BUTTER[i], side:THREE.DoubleSide });
    const w1 = new THREE.Mesh(wingGeo, mat), w2 = new THREE.Mesh(wingGeo, mat); w2.scale.x = -1; b.add(w1, w2);
    b.userData = { w1, w2, ph:i*2.1, rad:.55 + V.ring*.45 + i*.18, h:.55 + i*.22, sp:.33 + i*.07 };
    world.add(b); V.butterflies.push(b); V.life.push(b);
  }
  flyButterflies(2.1);
}
export function flyButterflies(t){
  (V && V.butterflies || []).forEach(b => { const u = b.userData, a = t*u.sp + u.ph;
    b.position.set(Math.cos(a)*u.rad + Math.sin(a*2.3)*.25, TILE_TOP + u.h + Math.sin(a*3.1)*.12, Math.sin(a)*u.rad*.8 + Math.cos(a*1.7)*.2);
    b.rotation.y = -a; const f = .25 + Math.sin(t*22 + u.ph)*.75; u.w1.rotation.z = f; u.w2.rotation.z = -f; });
}
