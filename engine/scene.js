/* Scene, fixed camera direction, light rig, shared canvas textures and the sway shader. Same for every theme. */
import * as THREE from 'three';

export const QS = new URLSearchParams(location.search);
export function rngFrom(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

/* light + camera parameters in one table (the spec export reads this too) */
export const RIG = {
  camDir:[1, parseFloat(QS.get('el')||'1.2'), 1],        // orthographic, looking at the origin from +x,+y,+z
  hemi:{ sky:0xE8F2FF, ground:0xB39B74, intensity:1.7 },
  sun:{ color:0xFFE6C4, intensity:2.25, offset:[-3.2, 9, 5.5], dist:30, shadowMap:2048, bias:-0.0004, normalBias:0.025 },
  fill:{ color:0xC7DCFF, intensity:0.55, pos:[6, 4, -5] },
  night:{ hemi:{ sky:0x5570A8, ground:0x1A2233, intensity:.9 }, sun:{ color:0xA9C1FF, intensity:.9 }, fill:{ intensity:.25 } },
  toneMapping:'neutral', exposure:1
};

/* Per-theme light rig. A theme may set `mood` (a preset below) and/or `lights` = { hemi:{sky,ground,intensity}, sun:{color,intensity},
   fill:{color,intensity}, exposure, lamps, night:{ hemi, sun, fill, exposure } }; lamps:true lights the night lamps (warm pools + halos, no
   fireflies) in the day view too, for themes that live at night. Every key is optional and overrides the shared RIG
   (day: RIG → mood → lights; night: RIG.night → lights.night). Direction, shadows and camera never change, so sprites stay aligned. */
export const MOODS = {
  night:{ hemi:{ sky:0x7C93CC, ground:0x1C2440, intensity:1.25 }, sun:{ color:0xAFC2FF, intensity:1.3 }, fill:{ color:0x8FA6FF, intensity:.5 }, exposure:.95, lamps:true },
  dusk: { hemi:{ sky:0xC7B6E6, ground:0x5A4668, intensity:1.45 }, sun:{ color:0xFFC9A8, intensity:1.9 }, fill:{ color:0xB3A6FF, intensity:.5 } }
};
const pick = (o, k) => (o && o[k]) || {};
export function rigFor(th, night){
  const L = (th && th.lights) || {}, mood = (th && MOODS[th.mood]) || {};
  const layers = night ? [{ hemi:RIG.night.hemi, sun:RIG.night.sun, fill:RIG.night.fill }, L.night || {}]
                       : [{ hemi:RIG.hemi, sun:RIG.sun, fill:RIG.fill }, mood, L];
  const out = { hemi:{ ...RIG.hemi }, sun:{ color:RIG.sun.color, intensity:RIG.sun.intensity }, fill:{ color:RIG.fill.color, intensity:RIG.fill.intensity }, exposure:RIG.exposure, lamps:!!night };
  for (const l of layers) { for (const k of ['hemi','sun','fill']) Object.assign(out[k], pick(l, k)); if (l.exposure != null) out.exposure = l.exposure; if (l.lamps != null) out.lamps = l.lamps; }
  return out;
}

export const scene = new THREE.Scene();
export const CAM_DIR = new THREE.Vector3(...RIG.camDir).normalize();
export const hemi = new THREE.HemisphereLight(RIG.hemi.sky, RIG.hemi.ground, RIG.hemi.intensity); scene.add(hemi);
export const sun = new THREE.DirectionalLight(RIG.sun.color, RIG.sun.intensity);
sun.castShadow = true; sun.shadow.mapSize.set(RIG.sun.shadowMap, RIG.sun.shadowMap); sun.shadow.bias = RIG.sun.bias; sun.shadow.normalBias = RIG.sun.normalBias;
scene.add(sun, sun.target);
export const fill = new THREE.DirectionalLight(RIG.fill.color, RIG.fill.intensity); scene.add(fill, fill.target);
export const SUN_OFF = new THREE.Vector3(...RIG.sun.offset);
export const SHADOW_R = 7 * .78 + 1.5;                    // sun shadow camera half-extent: covers the whole 7×7 plot at every land size
export const world = new THREE.Group(); scene.add(world);
export const fx = new THREE.Group(); scene.add(fx);
export const U = { time:{ value:0 }, sway:{ value:1 } };

export function radialTex(stops, size=128){
  const c=document.createElement('canvas'); c.width=c.height=size; const g=c.getContext('2d');
  const gr=g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  stops.forEach(([o,col])=>gr.addColorStop(o,col)); g.fillStyle=gr; g.fillRect(0,0,size,size);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
export const TEX = {
  contact: radialTex([[0,'rgba(0,0,0,.55)'],[.45,'rgba(0,0,0,.28)'],[1,'rgba(0,0,0,0)']]),
  blob:    radialTex([[0,'rgba(0,0,0,1)'],[.55,'rgba(0,0,0,.55)'],[1,'rgba(0,0,0,0)']], 256),
  glow:    radialTex([[0,'rgba(255,255,255,1)'],[.25,'rgba(255,255,255,.55)'],[1,'rgba(255,255,255,0)']]),
  beam: (()=>{ const c=document.createElement('canvas'); c.width=64; c.height=256; const g=c.getContext('2d');
    const v=g.createLinearGradient(0,0,0,256); v.addColorStop(0,'rgba(255,255,255,0)'); v.addColorStop(.55,'rgba(255,255,255,.55)'); v.addColorStop(1,'rgba(255,255,255,1)');
    g.fillStyle=v; g.fillRect(0,0,64,256); g.globalCompositeOperation='destination-in';
    const h=g.createLinearGradient(0,0,64,0); h.addColorStop(0,'rgba(0,0,0,0)'); h.addColorStop(.5,'rgba(0,0,0,1)'); h.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=h; g.fillRect(0,0,64,256); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })(),
  star: (()=>{ const s=64,c=document.createElement('canvas'); c.width=c.height=s; const g=c.getContext('2d');
    g.translate(s/2,s/2); g.fillStyle='#fff'; g.beginPath();
    for(let i=0;i<8;i++){ const a=i*Math.PI/4, r=i%2?6:30; g.lineTo(Math.cos(a)*r,Math.sin(a)*r); } g.closePath(); g.fill();
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })(),
  dash: (()=>{ const s=256,c=document.createElement('canvas'); c.width=c.height=s; const g=c.getContext('2d');
    g.strokeStyle='#fff'; g.lineWidth=9; g.setLineDash([22,16]); g.lineCap='round';
    const r=38, m=14; g.beginPath(); g.roundRect(m,m,s-2*m,s-2*m,r); g.stroke();
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t; })(),
  furrow: (()=>{ const W=128,c=document.createElement('canvas'); c.width=c.height=W; const g=c.getContext('2d'), r=rngFrom(3);
    g.fillStyle='#fff'; g.fillRect(0,0,W,W);
    for (let i=0;i<4;i++){ const y=W*(i+.5)/4; const gr=g.createLinearGradient(0,y-14,0,y+14);
      gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(.5,'rgba(40,18,4,.34)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,y-14,W,28); }
    for (let i=0;i<70;i++){ g.fillStyle = r()<.5 ? 'rgba(255,235,200,.25)' : 'rgba(40,18,4,.2)'; g.beginPath(); g.arc(r()*W, r()*W, .8+r()*1.6, 0, 6.3); g.fill(); }
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t; })()
};

/* wind sway on leafy materials (vertex shader); U.sway = 0 under reduced motion */
export function addSway(mat, localH, amp){
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time; sh.uniforms.uSway = U.sway; sh.uniforms.uH = { value: localH }; sh.uniforms.uAmp = { value: amp };
    sh.vertexShader = 'uniform float uTime; uniform float uSway; uniform float uH; uniform float uAmp;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 org = vec4(0.,0.,0.,1.);
          #ifdef USE_INSTANCING
            org = instanceMatrix * org;
          #endif
          org = modelMatrix * org;
          float hh = clamp(position.y / uH, 0.0, 1.4); float ph = org.x * 1.7 + org.z * 1.3;
          float s = (sin(uTime * 1.6 + ph) + 0.35 * sin(uTime * 2.9 + ph * 1.9)) * uAmp * hh * hh * uSway;
          transformed.x += s * uH; transformed.z += s * 0.55 * uH; }`);
  };
  mat.customProgramCacheKey = () => 'sway' + localH.toFixed(3) + amp;
}

/* default ground tile look (grass). A theme may replace it with ground.tile + ground.tileMap. */
export const GRASS_TILE = { top:['#88C052','#80B84C'], side:'#79AE43', soilTop:'#9C6A3E', soilBot:'#5E3A22' };
export function grassTileMap(){
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), r = rngFrom(4);
  g.fillStyle = '#EEF1EA'; g.fillRect(0,0,N,N);
  for (let i=0;i<14;i++){ const x=r()*N, y=r()*N, rad=18+r()*40, gr=g.createRadialGradient(x,y,0,x,y,rad);
    const l = r()<.5; gr.addColorStop(0, l ? 'rgba(255,255,240,.4)' : 'rgba(255,255,240,.2)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,N,N); }
  g.lineCap = 'round';
  for (let i=0;i<230;i++){ const x=r()*N, y=r()*N, len=4+r()*6, a=-Math.PI/2 + (r()-.5)*.9;
    g.strokeStyle = r()<.55 ? 'rgba(90,120,60,.12)' : 'rgba(255,255,240,.8)'; g.lineWidth = 1.4 + r();
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*len, y+Math.sin(a)*len); g.stroke(); }
  const e = g.createRadialGradient(N/2,N/2,N*.36,N/2,N/2,N*.72); e.addColorStop(0,'rgba(0,0,0,0)'); e.addColorStop(1,'rgba(60,90,30,.05)'); g.fillStyle=e; g.fillRect(0,0,N,N);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
