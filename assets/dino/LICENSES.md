# Dino valley theme: asset licences (checked 2026-09-23)

All 3D content is CC0 1.0. Credit is optional, and it's given here anyway.

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `TRex.glb`, `Triceratops.glb`, `Stegosaurus.glb`, `Parasaurolophus.glb`, `Velociraptor.glb`, `Apatosaurus.glb` | **Quaternius Animated Dinosaur Pack**: 6 rigged dinos, each with Idle / Walk / Run / Jump / Attack / Death | https://poly.pizza/bundle/Animated-Dinosaur-Bundle-SmoLdBLO2K (GLBs from each model page, e.g. https://poly.pizza/m/UYtneO5FpF), pack page https://quaternius.com/packs/animateddinosaurs.html | CC0: every model page and the bundle JSON say "CC0 1.0". The Quaternius pack page says "CC0", and https://quaternius.com/license.html covers all packs |
| `palms.glb` | **Quaternius Ultimate Stylized Nature, "Palm Trees"** (PalmTree_1–5) | https://poly.pizza/m/VYslw9DEi6 (from the bundle https://poly.pizza/bundle/Ultimate-Stylized-Nature-Pack-zyIyYd9yGr) | CC0: the model page says "CC0 1.0", and so do all 12 models in the bundle |
| `album.jpg` | A crop of this page's own render of the valley at 40/40 | own render | CC0 (derivative) |
| (reused, not copied) | Ferns, conifers (Pine_1/Pine_5), grass, clover, mushrooms and flowers = Quaternius Stylized Nature MegaKit (`assets/kit-a`) | see the shared `assets/LICENSES.md` | CC0 |
| (procedural) | The volcano (cone, crater, lava, smoke), the cave home, stone arch, fossil dig, nest cliff, standing stones, bone hut, the nests, eggs and shells, the hot spring, waterfall and lakes, stepping stones, bones, torches, logs, boulders and all 3 fence kinds | written in `themes/dino.js` | own work |

## Processing
- Dinos: a Node script rewrote each GLB's JSON chunk. It renamed the clips from `Armature|TRex_Walk` to `Walk` (the engine plays `Idle`/`Walk` by name) and replaced the near-black material colours with a storybook palette by material name (T. rex orange, Apatosaurus blue, Parasaurolophus gold, Triceratops lilac, Stegosaurus amber, Velociraptor tan). Then glTF-Transform 4.5 `meshopt`: about 330 KB → about 105 KB each.
- Palms: the RootNode children were promoted to scene roots (one template per tree). Then glTF-Transform `dedup` + `webp` + `meshopt`: 1.1 MB → 103 KB.
- Total `assets/dino/` is about 0.8 MB.

## Not used
- The Quaternius "Rocks" model (3.2 MB) was too heavy. The rocks here are procedural instead.
