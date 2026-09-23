/* Shared mutable state + the theme registry. No imports: every other module may import this one.
   V and placed are live ES-module bindings: read them anywhere, change them only through setV / setPlaced. */
export const RULES = { MIN_PER_PIECE:5, DAILY_CAP:12, SLOTS_PER_THEME:40 };

export const S = { grow:'c', forceRing:null, expand:null, theme:'farm', pieces:14, mins:38, today:5, night:false, sheet:'0',
  compact:false, rm:false, drop:null, dp:null, complete:false, celebrate:false };

/* registry: filled once at boot from themes/index.js */
export const REG = {}; export const LIST = [];
export function registerThemes(list){ for (const t of list) { if (REG[t.id]) throw new Error('duplicate theme id '+t.id); REG[t.id] = t; LIST.push(t); } }
export const TH = () => REG[S.theme];

export let V = null;          export const setV = v => (V = v);
export let placed = [];       export const setPlaced = p => (placed = p);

/* functions the page provides (render loop + DOM chrome) */
export const hooks = { kick(){}, renderChrome(){} };

export const AMBIENT = () => S.grow === 'c';
export const slotById = id => TH().slots.find(s => s.id === id);
/* Growing pieces (crops, coral beds): stage 1 when placed, +1 for every piece placed after it, ripe at 5. Unplaced = 4 (ghost shape). */
export function cropStage(id){ const i = placed.indexOf(id); return i < 0 ? 4 : Math.min(5, 1 + (placed.length - 1 - i)); }
