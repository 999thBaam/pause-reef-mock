/* Event-only motion: tweens run the render loop, nothing animates while idle. MOTION is the one table of timings/easings
   (the page reads it, the spec export ships it to the app). t is always 0..1 of the tween's duration unless noted. */
import * as THREE from 'three';
import { fx, TEX, rngFrom } from './scene.js';
import { GRID } from './grid.js';
import { hooks } from './state.js';

export const MOTION = {
  drop: {
    durationMs:1500, impactAt:.26, heightSingle:2.6, heightTwoTile:3.2,
    fall:'y = base + (1 - u*u) * height, u = t / impactAt (gravity, ease-in quad)',
    fallTilt:{ z:.12, x:-.08, note:'rotation = (1-u) * tilt, rights itself on landing' }, fallScale:[.96, 1.06, .96],
    squash:{ spring:{ zeta:.32, omega:20 }, xz:.22, y:.34, note:'k = spring((ms - impact)/1000) - 1; scale = (1 - k*xz, 1 + k*y, 1 - k*xz)' },
    beam:{ peakOpacity:.8, fadeAfterImpact:.35, height:3.6, width:{ single:1, twoTile:1.9 } },
    landingRing:{ start:'impactAt', span:.38, grow:1.4, radius:[.42,.5] },
    fallShadow:{ maxOpacity:.55, fadeAfterImpact:.25 },
    countTag:{ start:.4, rise:.45, fadeOutFrom:.65 },
    sparkleAt:.42, cropGrowAt:.5, ghostHiddenAt:'impactAt'
  },
  dust:{ durationMs:620, motes:{ single:12, twoTile:16 }, radius:{ single:.55, twoTile:1.05 }, ease:'cubic out', color:0xE6D2AE },
  neighbours:{ reach:2.4, delayMsPerUnit:55, amp:.16, freq:26, decay:7.5,
    note:'k = sin(st*freq) * exp(-st*decay) * amp * (1 - d/reach); scale = (1 - k*.35, 1 + k, 1 - k*.35); y += max(0,k)*.25' },
  sparkle:{ durationMs:[900,1200], n:{ single:12, twoTile:18 }, spread:{ single:.8, twoTile:1.2 }, color:0xFFE08A },
  cropGrow:{ durationMs:700, spring:{ zeta:.35, omega:16 }, from:[.7,.5,.7] },
  expand:{ durationMs:1700, afterDropDelayMs:450,
    camera:{ ease:'cubic in-out', start:.08, span:.78 },
    tiles:{ delay:'.22 + (angle around centre / 2π) * .3', span:.5, spring:{ zeta:.42, omega:13, timeScale:.55 }, riseFrom:-.9, scaleFrom:.4, overshootCap:1.08 },
    newObjects:{ delay:'.42 + (angle / 2π) * .3', span:.35, spring:{ zeta:.45, omega:14, timeScale:.5 } },
    banner:[.2,.95], finalSparkle:16 },
  complete:{ confetti:{ n:80, durationMs:[2600,3500] }, bannerMs:4200,
    residentWalk:{ msPerUnit:700, minMs:900, ease:'1 - (1-t)^2.2', gapMs:160, from:'gap in the front fence, cell (3, 7.3)' },
    swimIn:{ durationMs:1400 } },
  pick:{ cardPressMs:110, closeToDropMs:280 },
  ambient:{ keepAliveMs:12000, note:'after any event the loop runs 12 s for butterflies/fish, then sleeps' },
  spring:'1 - exp(-zeta*omega*t) * (cos(wd*t) + zeta*omega/wd * sin(wd*t)), wd = omega*sqrt(1-zeta²)'
};

export const anims = [];
export function tween(dur, step, done){ const a = { t0: performance.now(), dur, step, done }; anims.push(a); hooks.kick(); return a; }
export function spring(t, zeta=.5, w=14){ if (t<=0) return 0; const wd = w*Math.sqrt(1-zeta*zeta); return 1 - Math.exp(-zeta*w*t) * (Math.cos(wd*t) + zeta*w/wd*Math.sin(wd*t)); }
export function sparkle(pos, n=14, color=0xFFE08A, spread=.9){
  for (let i=0;i<n;i++){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: i%3 ? TEX.star : TEX.glow, color, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
    const a = i/n*Math.PI*2 + Math.random()*.4, v = new THREE.Vector3(Math.cos(a)*spread*(.5+Math.random()*.6), 1.1 + Math.random()*1.1, Math.sin(a)*spread*(.5+Math.random()*.6));
    s.position.copy(pos); s.scale.setScalar(.14); fx.add(s);
    tween(900 + Math.random()*300, t => { s.position.copy(pos).addScaledVector(v, t*.9).add(new THREE.Vector3(0, -t*t*.9, 0));
      s.material.opacity = 1 - t*t; s.material.rotation = t*3; s.scale.setScalar(.16*(1-t*.5)); }, () => { fx.remove(s); s.material.dispose(); });
  }
}
/* dust puff: a ring of soft motes thrown out along the ground, sized to the footprint */
export function dust(pos, radius=.5, n=12){
  for (let i=0;i<n;i++){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:TEX.glow, color:0xE6D2AE, transparent:true, opacity:.85, depthWrite:false }));
    const a = i/n*Math.PI*2 + (i%2)*.2; s.position.copy(pos); fx.add(s);
    tween(MOTION.dust.durationMs, t => { const e = 1-Math.pow(1-t,3); s.position.set(pos.x+Math.cos(a)*radius*(.55+e*.75), pos.y+.05+e*.16, pos.z+Math.sin(a)*radius*(.55+e*.75));
      s.scale.setScalar(.14 + e*.3*radius/.5); s.material.opacity = .8*(1-t); }, () => { fx.remove(s); s.material.dispose(); });
  }
}
const CONF = [0xFF6B81, 0xFFD166, 0x39E6A3, 0x7B4BE0, 0x1E7FA8, 0xFFB020];
export function confetti(n=70, freezeAt){
  const geo = new THREE.PlaneGeometry(.08,.13), r = rngFrom(11);
  for (let i=0;i<n;i++){
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color:CONF[i%CONF.length], side:THREE.DoubleSide, transparent:true }));
    const p0 = new THREE.Vector3((r()-.5)*GRID*1.1, 3.4 + r()*1.8, (r()-.5)*GRID*1.1), sp = .6 + r()*.9, ph = r()*6, rot = new THREE.Vector3(r()*6, r()*6, r()*6);
    fx.add(m);
    const step = t => { m.position.set(p0.x + Math.sin(ph + t*9)*.25, p0.y - t*(4.2 + sp), p0.z + Math.cos(ph + t*7)*.25);
      m.rotation.set(rot.x + t*12*sp, rot.y + t*9, rot.z + t*7); m.material.opacity = t > .8 ? (1-t)/.2 : 1; };
    if (freezeAt != null) step(freezeAt * (.7 + r()*.5)); else tween(2600 + r()*900, step, () => { fx.remove(m); m.material.dispose(); });
  }
}
