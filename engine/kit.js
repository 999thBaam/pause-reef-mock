/* Model kits: one GLB per kit, one top-level node per model. Loaded once, turned into templates (geometry + material list,
   origin at the bottom-centre), instanced with addModel(). Themes declare the kits they use (theme.kits) and may register their own. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { addSway } from './scene.js';
import { TH } from './state.js';

export const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
/* kit id → { file, sway (leafy materials get wind), flat (flat shading), stripSuffix ('.001' node names), post(templates) } */
export const KITS = {
  // Quaternius Stylized Nature MegaKit: shared (forest trees + grass, the farm's Gita peepal)
  a: { file:'assets/kit-a/kit-a.glb', sway:true, post: T => { if (T.Bush_Common) T.Bush_Common.parts.forEach(p => { if (p.mat.map) p.mat.map = greenSwap(p.mat.map); }); } }
};
/* Bounding box of a loaded model as it RENDERS. A skinned model gets a precise, bone-transformed box: some rigs (the Sheep,
   Armature ×100 over millimetre geometry) report a bind-pose AABB 100× off from what is drawn, which made the sheep ~5 px tall. */
export function modelBox(obj){
  let skinned = false; obj.traverse(o => { if (o.isSkinnedMesh) skinned = true; });
  if (!skinned) return new THREE.Box3().setFromObject(obj);
  obj.updateMatrixWorld(true); return new THREE.Box3().setFromObject(obj, true);
}
export function registerKits(defs){ for (const k in defs) if (!KITS[k]) KITS[k] = defs[k]; }
export const KITCACHE = {}, ANIMCACHE = {};

export function makeTemplate(root, def){
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const toOrigin = new THREE.Matrix4().makeTranslation(-ctr.x, -box.min.y, -ctr.z);
  const parts = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    const mat = o.material.clone();
    const leafy = def.sway && /leaf|leaves|grass|flower|bush|plant|clover|fern/i.test(o.material.name || '');
    mat.metalness = 0; mat.roughness = Math.max(.72, mat.roughness ?? 1);
    if (mat.alphaTest > 0 || mat.transparent) { mat.alphaTest = .5; mat.transparent = false; mat.side = THREE.DoubleSide; }
    if (mat.map) mat.map.anisotropy = 4;
    if (leafy) addSway(mat, size.y, size.y > 2 ? .018 : .03);
    if (def.flat) { mat.flatShading = true; mat.roughness = .82; }
    parts.push({ geo:o.geometry, mat, leafy: /leaf|leaves|foliage/i.test(o.material.name||'') || undefined, local: toOrigin.clone().multiply(o.matrixWorld) });
  });
  return { name:root.name, size, parts };
}
export function greenSwap(tex){
  if (tex.userData.green) return tex.userData.green;
  const im = tex.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0,0,c.width,c.height), a = d.data;
  for (let i=0;i<a.length;i+=4){ const r=a[i], gg=a[i+1], b=a[i+2]; a[i]=Math.min(255, gg*.9+r*.28); a[i+1]=Math.min(255, r*.92+22); a[i+2]=b*.7; }
  g.putImageData(d,0,0); const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  return tex.userData.green = t;
}
export async function loadKit(k){
  if (KITCACHE[k]) return KITCACHE[k];
  const def = KITS[k]; if (!def) throw new Error('unknown kit '+k);
  const gltf = await loader.loadAsync(def.file);
  const T = {}; for (const node of gltf.scene.children) T[def.stripSuffix ? node.name.replace(/\.?\d{3}$/,'') : node.name] = makeTemplate(node, def);
  if (def.post) def.post(T);
  return KITCACHE[k] = T;
}
/* animated residents: def.file overrides the default assets/animals/<id>.glb */
export function loadAnimal(d){ const id = typeof d === 'string' ? d : d.id, file = (typeof d === 'object' && d.file) || 'assets/animals/'+id+'.glb';
  return ANIMCACHE[id] || (ANIMCACHE[id] = loader.loadAsync(file)); }
export function fitScale(tpl, h, w){ const s=tpl.size; return Math.min(h / s.y, w / Math.max(s.x, s.z, 1e-3)); }

/* the active theme's primary kit (theme.kits[0]) */
export const T = () => KITCACHE[TH().kits[0]];
export function addModel(parent, name, k, x, y, z, rotY, kit){
  const tpl = (kit ? KITCACHE[kit] : T())[name]; if (!tpl) { console.warn('missing', name); return null; }
  const g = new THREE.Group();
  tpl.parts.forEach(pt => { const m = new THREE.Mesh(pt.geo, pt.mat); m.applyMatrix4(pt.local); m.castShadow = m.receiveShadow = true; g.add(m); });
  g.scale.setScalar(k); g.position.set(x, y, z); g.rotation.y = rotY || 0; parent.add(g); return g;
}
