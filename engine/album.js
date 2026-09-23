/* Album = the registry as a timeline (sorted by theme.season). Themes before the active one are past (done, or waiting at
   album.progress), themes after it are locked "arrives in N days" cards; placeholder silhouettes fill the shelf until their module exists. */
import { LIST, TH } from './state.js';

export const PLACEHOLDERS = [
  { id:'village', name:'Village', silhouette:'<g fill="currentColor"><path d="M10 118V78l22-18 22 18v40z"/><path d="M50 118V68l26-22 26 22v50z"/><path d="M92 118V86l14-12 14 12v32z"/><rect x="70" y="30" width="8" height="18"/></g>' },
  { id:'space', name:'Space', silhouette:'<g fill="currentColor"><path d="M62 16c14 12 20 32 16 54l10 14-14-2-6 12-6-12-14 2 10-14c-4-22 2-42 4-54z"/><circle cx="62" cy="48" r="6" fill="#fff"/><circle cx="24" cy="36" r="10"/><path d="M8 40c10 4 24 2 34-6" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="100" cy="22" r="3"/><circle cx="110" cy="60" r="2"/><circle cx="16" cy="92" r="2.4"/></g>' },
  { id:'dino', name:'Dino valley', silhouette:'<g fill="currentColor"><path d="M14 100c10 0 20-4 28-12 6-6 12-10 22-10h16c8 0 12-6 14-16l2-14c2-8 8-12 16-10 6 2 8 8 6 14l-4 2 4 4c-2 4-6 6-12 6-2 10-4 18-8 24v22h-8l-2-16h-26l-4 16h-8v-18c-10 4-24 8-40 8z"/></g>' }
];
export const EVERY_DAYS = 14;

export function timeline(){
  const reg = [...LIST].sort((a,b) => (a.season||99) - (b.season||99));
  const all = [...reg, ...PLACEHOLDERS.filter(p => !reg.some(t => t.id === p.id || t.name === p.name))];
  const ai = all.indexOf(TH());
  const past = all.slice(0, ai).map(t => { const total = t.slots.length, prog = Math.min(total, t.album?.progress ?? total); return { t, total, prog, done: prog >= total }; });
  return { active:TH(), past, upcoming: all.slice(ai+1) };
}
/* short line on the Album entry card: "1 done · 1 building", "2 done · Reef next", "2 done · 1 waiting" */
export function albumLine(activeDone){
  const { past, upcoming } = timeline(), waiting = past.filter(p => !p.done).length, done = past.filter(p => p.done).length + (activeDone ? 1 : 0);
  return done + ' done · ' + (!activeDone ? (1 + waiting) + ' building' : waiting ? waiting + ' waiting' : (upcoming[0] ? upcoming[0].name + ' next' : 'all built'));
}
export function nextArrival(){ const { active, upcoming } = timeline(); return upcoming[0] ? upcoming[0].name + ' arrives in ' + active.nextIn + ' days' : 'more themes soon'; }
/* image for the back card of the album stack: the newest finished theme */
export function stackImage(){ const { active, past } = timeline(); const d = past.filter(p => p.done && p.t.album?.image).pop(); return (d ? d.t.album.image : active.album?.image) || ''; }

/* card art: the theme's album thumbnail (assets/<id>/album.jpg, rendered by album-thumbs.sh), else its silhouette, never a broken image */
const artOf = t => t.album?.image ? '<img alt="" src="'+t.album.image+'">' : '<svg viewBox="0 0 128 128" style="color:rgba(22,50,79,.18)">'+(t.silhouette||'')+'</svg>';
export function albumHTML(n, albumShot){
  const { active, past, upcoming } = timeline(), total = active.slots.length, done = n === total;
  const card = (cls, pic, title, sub, badge, bar) => '<div class="tcard '+cls+'"><div class="pic">'+pic+(badge||'')+'</div><div class="txt"><b>'+title+'</b><span>'+sub+'</span>'+(bar!=null ? '<div class="bar"><i style="width:'+bar+'%"></i></div>' : '')+'</div></div>';
  const tick = '<svg viewBox="0 0 12 12" width="11" height="11"><path d="m2.5 6.3 2.3 2.3 4.7-5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const doneBadge = '<span class="badge done">'+tick+' Done</span>';
  let html = '<div class="shelfh"><b>Your themes</b><span>'+(past.filter(p => p.done).length + (done ? 1 : 0))+' complete</span></div><div class="shelf">';
  // the one you're building, then the past ones, newest first
  html += card('', (albumShot || active.album.image) ? '<img alt="" src="'+(albumShot || active.album.image)+'"'+(active.album.liveBg ? ' style="background:'+active.album.liveBg+'"' : '')+'>' : artOf(active), active.name,
    done ? total+' of '+total+' · '+active.dates : n+' of '+total+' · building now', done ? doneBadge : '<span class="badge">'+n+'/'+total+'</span>', done ? null : (n/total*100).toFixed(0));
  [...past].reverse().forEach(p => {
    html += card('', artOf(p.t), p.t.name, p.done ? p.total+' of '+p.total+' · '+p.t.dates : p.prog+' of '+p.total+' · waiting, no rush',
      p.done ? doneBadge : '<span class="badge">'+p.prog+'/'+p.total+'</span>', p.done ? null : (p.prog/p.total*100).toFixed(0));
  });
  html += '</div>';
  if (!upcoming.length) return html;                       // the last season: no empty "Coming next" shelf
  html += '<div class="shelfh"><b>Coming next</b><span>one every 2 weeks</span></div><div class="shelf">';
  upcoming.forEach((u, i) => { html += card('locked', '<svg viewBox="0 0 128 128" style="color:rgba(22,50,79,.18)">'+(u.silhouette||'')+'</svg>', u.name, 'Arrives in '+(active.nextIn + i*EVERY_DAYS)+' days', ''); });
  return html + '</div>';
}
