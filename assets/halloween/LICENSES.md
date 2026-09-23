# Pumpkin patch (halloween) theme: asset licences (checked 2026-09-24)

All 3D content is CC0 1.0. Credit is optional, and it's given here anyway.

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `halloween.glb` (KayKit part, `kk_*`) | **KayKit Halloween Bits 1.0 (free tier)**, 29 models: pumpkins orange/yellow (normal, small, jack-o'-lantern), orange + yellow autumn pines (S/M/L), lantern standing/hanging, lantern post, post, benches, stone paths A–D, candles, fence pieces, dirt floor | https://kaylousberg.itch.io/halloween-bits (`KayKit_HalloweenBits_1.0_FREE.zip`, glTF folder + `halloweenbits_texture.png`) | CC0: the itch page says "Creative Commons Zero v1.0 Universal", and `License.txt` in the zip says "License: (Creative Commons Zero, CC0)". Copy: `KayKit-HalloweenBits-License.txt` |
| `halloween.glb` (Kenney part, `kn_*`) | **Kenney Graveyard Kit 5.0**, 26 models: pumpkins (round/tall, carved), hay bales, wooden fence/gate, lanterns, lamp posts, fire basket, bench, fall pines, trunks, candles, rocks, keeper, debris, shovel. No gravestones/coffins were packed (cute, not scary) | https://kenney.nl/assets/graveyard-kit (`kenney_graveyard-kit_5.0.zip`, GLB format + `colormap.png`) | CC0: the page says "Creative Commons CC0", and `License.txt` says "License: (Creative Commons Zero, CC0)". Copy: `Kenney-GraveyardKit-License.txt` |
| (reused, not copied) | Barns + well = Quaternius Farm Buildings (`assets/farm/farm.glb`); cottage + market stall = KayKit Medieval Hexagon (`assets/village/village.glb`); maples/oaks + grass tufts = Quaternius Stylized Nature MegaKit (`assets/kit-a`), leaf atlas re-tinted to autumn at runtime | see the shared `assets/LICENSES.md` and `assets/village/LICENSES.md` | CC0 |
| (procedural) | Pumpkin carriage (Gita), witch-hat cottage, apple barrel, misty ponds, scarecrow, candy basket, pumpkin vines/leaves, leaf litter, ground tile texture, drifting leaves, fireflies, residents (black cat, owl, crows, bats) | written in `themes/halloween.js` | own work |

## Processing
- Blender 5 (`-b --python`): each source file imported, meshes joined into one top-level node (`kk_<name>` / `kn_<name>`, `-` → `_`), exported as one GLB (1.08 MB).
- glTF-Transform 4.5 `dedup` + `meshopt` → 376 KB. Atlases kept as PNG (swatch atlases bleed under lossy WebP). Colours are the packs' own; nothing recoloured in the file.

## Not used
- Gravestones, coffins, skulls, bones, crypts, dead trees from both packs: too spooky for a mindfulness app.
- No CC0 animated cat/owl/bat/crow was found in the time budget, so residents are procedural.
