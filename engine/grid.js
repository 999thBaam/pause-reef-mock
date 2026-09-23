/* The plot: a 7×7 grid of 1-unit tiles, centred on the origin. Rings: 1 = centre 3×3, 2 = 5×5, 3 = 7×7. */
import * as THREE from 'three';

export const GRID = 7, OFF = (GRID-1)/2, TILE_TOP = 0.07;
export const cellPos = (x,z) => new THREE.Vector3(x - OFF, TILE_TOP, z - OFF);
export const ringOf = (x,z) => Math.max(Math.abs(x-3), Math.abs(z-3));
/* edge pieces (fences, ridges) sit on a tile edge, not a cell: they carry edge:'w'|'s' + len and always belong to the outer ring */
export const isEdge = s => !!s.edge;
/* A slot belongs to the outermost ring it touches. */
export function slotRing(s){ if (isEdge(s)) return 3; let r = 0; for (let a=0;a<(s.w||1);a++) for (let b=0;b<(s.d||1);b++) r = Math.max(r, ringOf(s.x+a, s.z+b)); return Math.max(1, r); }
/* footprint centre in world units (the piece origin) */
export function footprint(s){ const w = s.w||1, d = s.d||1; return { cx: s.x + (w-1)/2 - OFF, cz: s.z + (d-1)/2 - OFF, w, d }; }
/* edge pieces: origin at the middle of the run */
export function edgeCentre(s){ return s.edge === 'w' ? { cx: s.x - OFF, cz: s.z + (s.len-1)/2 - OFF } : { cx: s.x + (s.len-1)/2 - OFF, cz: s.z - OFF }; }
