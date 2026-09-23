# Fantasy castle (castle) theme: asset licences (checked 2026-09-24)

All 3D content is CC0 1.0. Credit is optional; given here anyway.

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `castle.glb` (`ck_*`) | **Kenney Castle Kit 2.0**, 66 models: square/hexagon/round tower modules, roofs, arches, walls, gates, door, flags + banners, drawbridge, bridges, stairs, rocks, pines. The 10 siege weapons were NOT packed (no weapons in a mindfulness app) | https://kenney.nl/assets/castle-kit (`kenney_castle-kit.zip`, GLB format + `colormap.png`) | CC0: the page says "Creative Commons CC0", and `License.txt` in the zip says "License: (Creative Commons Zero, CC0)". Copy: `Kenney-CastleKit-License.txt` |
| `Dragon.glb` | **Quaternius "Dragon"** (Ultimate Monsters bundle), animated (Flying_Idle, Fast_Flying, Yes, …) | https://poly.pizza/m/3rUm1cN3yp (bundle https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6) | CC0: the model page metadata says `"Licence":"CC0 1.0"`; Quaternius releases all packs CC0. Colours brightened at runtime |
| `Pigeon.glb` | **Quaternius "Pigeon"** (Ultimate Monsters bundle), animated; recoloured white at runtime → doves | https://poly.pizza/m/9NGlBTpDEr | CC0: model page `"Licence":"CC0 1.0"` |
| (reused, not copied) | Well, fountain basin, barrels, crates, sacks, cart, hedge, lilies, reeds, stone pile = KayKit Medieval Hexagon / Kenney Fantasy Town (`assets/village/village.glb`); oaks + meadow tufts = Quaternius Stylized Nature MegaKit (`assets/kit-a`); horses = Quaternius Ultimate Animated Animals (`assets/animals`) | see `assets/village/LICENSES.md` and the shared `assets/LICENSES.md` | CC0 |
| (procedural) | Growing castle walls (courses + scaffold), enchanted glowing flower beds, topiary, torches, stables, lily pool, moat channel + rim, crystal + shards, low ramparts, pennant posts, magic motes | `themes/castle.js` | own work |

## Processing
- Blender 5 (`-b --python`): each Kenney GLB imported, meshes joined into one top-level node `ck_<name>` (`-` → `_`), one GLB (750 KB) → glTF-Transform 4.5 `dedup` + `meshopt` → 274 KB. Colormap kept as PNG.
- Dragon / Pigeon: glTF-Transform `meshopt` only (72 KB / 36 KB).
- Theme total ≈ 0.46 MB (+ album.jpg).

## Not used
- Kenney siege kit (ballista, catapult, trebuchet, ram, siege tower): weapons.
- Quaternius Fantasy Props MegaKit / KayKit Dungeon: not needed; crystals and magic are procedural.
