# Asset licences — home-forest-mock (checked 2026-09-23)

All 3D content is CC0 1.0 (public domain). Credit is optional; it's given here anyway.

| Folder | What | Source (downloaded from) | Licence, and where I checked it |
|---|---|---|---|
| `kit-a/kit-a.glb` | 37 models from **Quaternius Stylized Nature MegaKit, Standard (free) tier**: `Stylized Nature MegaKit[Standard].zip` (99 MB, 68 of 116 models) | https://quaternius.itch.io/stylized-nature-megakit (linked from https://quaternius.com/packs/stylizednaturemegakit.html) | CC0: the pack page says "Free to use in personal, educational and commercial projects. (CC0 License)", the itch field reads "Asset license: Creative Commons Zero v1.0 Universal", and `License_Standard.txt` in the zip says CC0 1.0 |
| `kit-b/kit-b.glb` | 93 models from **KayKit Forest Nature Pack 1.0, FREE tier** (`KayKit_Forest_Nature_Pack_1.0_FREE`, 6.1 MB) | https://kaylousberg.itch.io/kaykit-forest | CC0: the itch page says "CC0 Licensed" and "Creative Commons Zero v1", and `License.txt` in the zip says "License: (Creative Commons Zero, CC0)". Kay Lousberg asks for credit but doesn't require it |
| `kit-b/forest_texture_tints.webp` | KayKit's `forest_texture.png` gradient atlas with four extra leaf colours (pink, lavender, gold, mint) painted into the reserved columns | derived from the KayKit file above | CC0 (derivative). The atlas itself says "you can add your own colors if you'd like" |
| `animals/*.glb` (12) | **Quaternius Ultimate Animated Animals**: Alpaca, Bull, Cow, Deer, Donkey, Fox, Horse, Horse_White, Husky, ShibaInu, Stag, Wolf (official glTF). Trimmed to 5 clips each (Idle, Idle_2, Idle_Headlow/Idle_2_HeadLow, Eating, Walk) | Google Drive folder linked from https://quaternius.com/packs/ultimateanimatedanimals.html (`glTF/` subfolder). The same models are mirrored on Poly Pizza as CC0 1.0 | CC0: the pack page reads "License CC0", and `License.txt` in the Drive folder says "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication" |
| `thumbs/*.png` | Chip and collection portraits of the 12 animals, rendered by this page (`?bake=animals`) | own render of the CC0 animals | CC0 (derivative) |
| `vendor/three/` | three.js r180 (`three.module.js`, `three.core.js`, GLTFLoader, meshopt decoder, SkeletonUtils, BufferGeometryUtils, RoundedBoxGeometry), vendored so the page works offline | npm `three@0.180.0` (same files as https://cdn.jsdelivr.net/npm/three@0.180.0/) | MIT, see `vendor/three/LICENSE` |
| `nunito-subset.woff` | Nunito variable, subset | copied from `../home-garden-mock/assets/` | SIL OFL 1.1 |

## Processing (no content changes besides these)
- Converted to GLB with glTF-Transform 4.5, deduplicated textures, WebP textures (kit A 512 px, kit B 256 px, animals 256 px), meshopt compression. Normal maps and metalness were dropped, since they're invisible at this scale.
- The kits are packed one file per kit, with one top-level node per model, named after the source file.
- At runtime, Quaternius `Bush_Common` gets a red→green channel swap on its leaf atlas, because stock it uses the red maple leaves.

## Rejected / not used
- Quaternius rabbits and birds on Poly Pizza: CC0, but they're a different, anthropomorphic style. Mixing them in would break "one consistent style".
- Poly-by-Google animals on Poly Pizza: CC-BY 3.0, so they're out.
- Synty (games-only EULA), OpenMoji/LPC (share-alike): avoided, per research NOTES.

## Added for `themes.html` (checked 2026-09-23)

| Folder | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `farm/farm.glb` | **Quaternius Farm Buildings Pack**, all 13 models (Barn, BigBarn, SmallBarn, OpenBarn, Silo, Silo_House, ChickenCoop, Well, WaterTower, Windmill [the wind pump], TowerWindmill [the Dutch windmill], Fence, Fence2), from `Blend/` | Google Drive folder linked from https://quaternius.com/packs/farmbuildings.html | CC0: the pack page says "License CC0" and links creativecommons.org/publicdomain/zero/1.0, and `License.txt` in the folder says "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication" |
| `farm/farm.glb` (same file) | **Quaternius Ultimate Crops Pack**, a subset: Corn/Carrot/Lettuce 1–4 + Crop, Beet 2–4 + Crop, Apple, Orange_3, BushBerries, Flower, Grass stages | Google Drive folder linked from https://quaternius.com/packs/ultimatecrops.html. Only 60 of the ~100 blends came down: gdown stalled on the folder, so no Wheat, Pumpkin or Tomato | CC0: the pack page says "License CC0" (same CC0 link) |
| `farm/Sheep.glb` | Quaternius **Sheep** (faceted low-poly, Idle + Jump clips) | https://poly.pizza/m/C39AUXUUes, a direct GLB | CC0: the Poly Pizza page lists the author as Quaternius and the licence as "CC0 1.0" |
| `album/forest.jpg` | Crop of the garden mock's own render (`index.html?kit=a&pauses=16`), used as the finished "Forest glade" album card | own render | CC0 (derivative) |

Processing: the blends were packed with Blender 5 (`-b --python`), joining each file into one node named after it. The blends keep their colours in node setups that the glTF exporter drops, so every material was re-coloured by name from the packs' preview renders (e.g. LightRed `#C9523B`, RoofBlack `#8A806E`, Green_Tree `#6FB041`) and written as `baseColorFactor`. Then glTF-Transform `dedup` + `meshopt`: 2.9 MB → 636 KB.
Not used: every farm pig, chicken, hen and rooster found on Poly Pizza is CC-BY 3.0 (Poly by Google), not CC0, so pigs and chickens are missing. The farm residents are Cow, Horse, Donkey and Alpaca (Ultimate Animated Animals, already here) plus the Quaternius sheep.
| (round 2) Peepal tree | `TwistedTree_3` from the Quaternius Stylized Nature MegaKit already in `kit-a/`, with its leaf atlas swapped red→green at runtime. The chabutra platform, diyas and red thread are procedural three.js geometry | see the kit-a row above | CC0 |

## Added for the Reef theme (`themes.html?theme=reef`, checked 2026-09-23)

| Folder | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `reef/reef-kit.glb` | **Kenney Pirate Kit 2.1**, 18 models: ship-wreck, chest, barrel, crate, bottle, cannon, cannon-ball, mast, hole, castle-wall, castle-gate, tower-base, rocks-a/b/c, rocks-sand-a/b/c | https://kenney.nl/assets/pirate-kit (`kenney_pirate-kit.zip`, GLB format + `colormap.png`) | CC0: the page says "Creative Commons CC0", and `License.txt` in the zip says "License: (Creative Commons Zero, CC0)". Copy at `reef/Kenney-PirateKit-License.txt` |
| `reef/Fish1.glb`, `Fish2.glb`, `Fish3.glb`, `Manta.glb`, `Dolphin.glb` (Dolphin not used yet) | **Quaternius Animated Fish Pack**, FBX (Swim clip each) | Google Drive folder linked from https://quaternius.com/packs/animatedfish.html | CC0: the pack page links creativecommons.org/publicdomain/zero/1.0 as the licence, and `License.txt` in the folder says "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication". Copy at `reef/Quaternius-AnimatedFish-License.txt` |
| `album/farm.jpg` | Crop of this page's own farm render at 31/40, used as the "waiting" Farm album card | own render | CC0 (derivative) |
| (procedural) | Coral beds (staghorn/brain/tube/table, 5 growth stages), sea fans, coral trees, kelp, seagrass, anemones, shells, starfish, giant clam + pearl, water cube, caustics, god rays, bubbles | written in `themes.html` | own work |

Processing: Kenney GLBs packed into one file with Blender 5 (`-b --python`), one top-level node per model; glTF-Transform 4.5 `dedup` → `webp` → `meshopt` (499 KB → 158 KB). Fish: FBX → GLB in Blender, then `optimize --compress meshopt` (~28–41 KB each). The FBX export leaves baseColor alpha at 0, so opacity is forced to 1 at runtime.
Not used: no CC0 sea turtle was verified in time, so there is no turtle; the ray is the Quaternius manta.
