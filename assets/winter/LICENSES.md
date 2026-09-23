# Winter village theme (`themes.html?theme=winter`): asset licences (checked 2026-09-24)

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `winter.glb` | 68 of the models from the **Kenney Holiday Kit 2.0** (`kenney_holiday-kit.zip`, `Models/GLB format/`): snowy trees (tree-snow-a/b/c, tree, tree-decorated(-snow)), lanterns, presents, sleds, benches, cabin fence, reindeer, candy canes, wreaths, rocks, snow piles, string-light models and the modular cabin pieces (packed, currently unused). Skipped: hanukkah / kwanzaa / festivus / socks / train / snowflakes / gingerbread / nutcracker | https://kenney.nl/assets/holiday-kit (direct zip `kenney.nl/media/pages/assets/holiday-kit/3976a6496a-1733923970/kenney_holiday-kit.zip`) | CC0: the page says "Creative Commons CC0" / "CC0 licensed!", and `License.txt` in the zip (copied here as `Kenney-HolidayKit-License.txt`) says "License: (Creative Commons Zero, CC0)" |
| `album.jpg` | album card art | a screenshot of this theme at 40/40 | original work |

Processing: Blender 5 (`-b --python`) packed one top-level node per model, named after the file (the loader strips the `.001` suffix). WebP texture (one shared 512 colormap), then glTF-Transform `dedup` + `meshopt`: 1.19 MB → 404 KB.

Residents (Stag, Deer, Fox, Husky) reuse the shared `assets/animals/` GLBs and `assets/thumbs/` (already listed in `assets/LICENSES.md`).

Everything else is procedural three.js in `themes/winter.js`: log cabins, the mountain lodge, cocoa stall, sled shed, snowmen (5 stages), igloos (5 stages), skating pond, ice-fishing hole, hot spring, ice fountain, shovelled paths, string-light bulbs, snowbanks, icicles, the snow tile texture, falling snow and steam. Original work, no licence encumbrance.

Not used: KayKit Holiday Bits (itch.io download needs the browser flow; Kenney alone covered every piece in one style inside the time box).
