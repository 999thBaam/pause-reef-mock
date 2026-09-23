/* Gate → piece family. ONE table for every theme: what you did decides which family you can build.
   A theme only says what each family LOOKS like (theme.families[cat].label/tag) and which slots belong to it. */
export const FAMILIES = ['water','building','path','crop','tree','special'];
export const GATE = {
  breathe:   { name:'Breathe',     plate:'#1E7FA8', cat:'water' },
  lesson:    { name:'Reading',     plate:'#E85B4B', cat:'building' },
  todos:     { name:'To-dos',      plate:'#C77F00', cat:'path' },
  sudoku:    { name:'Sudoku',      plate:'#7B4BE0', cat:'crop' },
  mathtricks:{ name:'Math tricks', plate:'#7B4BE0', cat:'crop' },
  vocab:     { name:'Vocab',       plate:'#12684A', cat:'tree' },
  chemistry: { name:'Chemistry',   plate:'#12684A', cat:'tree' },
  gita:      { name:'Gita',        plate:'#9A7415', cat:'special' },
  quotes:    { name:'Guru quotes', plate:'#9A7415', cat:'special' }
};
export const GATES_OF = cat => Object.keys(GATE).filter(g => GATE[g].cat === cat);
/* Packs (ported verbatim from ../home-dash-mock) */
export const PACKS = [
  {id:'calm',      name:'Calm',      plate:'#1E7FA8', gates:['breathe']},
  {id:'brain',     name:'Brain',     plate:'#7B4BE0', gates:['sudoku','mathtricks']},
  {id:'life',      name:'Life',      plate:'#C77F00', gates:['todos']},
  {id:'reading',   name:'Reading',   plate:'#E85B4B', gates:['lesson']},
  {id:'student',   name:'Student',   plate:'#12684A', gates:['vocab','chemistry','mathtricks']},
  {id:'spiritual', name:'Spiritual', plate:'#9A7415', gates:['gita','quotes']}
];
export const GATE_NAME = { breathe:'Breathe', sudoku:'Sudoku', mathtricks:'Math tricks', todos:'To-dos', lesson:'Lesson',
  vocab:'Vocab', chemistry:'Chemistry', gita:'Bhagavad Gita', quotes:'Guru quotes' };
