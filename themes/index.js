/* Theme registry. Adding a theme = a new themes/<id>.js + one line here. List order = HUD order;
   album order comes from each theme's `season`. The first entry is the default theme. See themes/README.md. */
import farm from './farm.js';
import forest from './forest.js';
import reef from './reef.js';
import village from './village.js';
import pirate from './pirate.js';
import space from './space.js';
import dino from './dino.js';
import winter from './winter.js';
import halloween from './halloween.js';
import town from './town.js';

export const THEMES = [
  farm,
  forest,
  reef,
  village,
  pirate,
  space,
  dino,
  winter,
  halloween,
  town,
];
