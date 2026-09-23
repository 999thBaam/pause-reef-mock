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

## Merged from `village/LICENSES.md`: Village theme (`themes.html?theme=village`; the per-theme file stays next to its assets)

### Village theme: asset licences (checked 2026-09-23)

All 3D content is CC0 1.0. Credit is optional, and it's given here anyway.

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `village.glb` (KayKit part) | **KayKit Medieval Hexagon Pack 1.0**, 51 models from the official glTF folder. Buildings: home_A (red/blue/green), home_B (yellow/red), tavern, church, blacksmith, market, windmill, watermill, well, tower_A/B, lumbermill, castle, grain, stages A–C, dirt, bridge, wood/stone fences. Nature: trees, rocks, water lilies and plants, hill. Props: barrel, crates, sack, wheelbarrow, bucket, flags, tent, lumber, pallet, stone | https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 (Kay Lousberg's official repo; the same pack is at https://kaylousberg.itch.io/kaykit-medieval-hexagon) | CC0: the repo's `LICENSE.txt` says "License: (Creative Commons Zero, CC0)". A copy is at `KayKit-MedievalHexagon-License.txt` |
| `village.glb` (Kenney part) | **Kenney Fantasy Town Kit 2.0**, 16 models: lantern, cart, cart-high, stall-red, stall-green, stall-bench, fountain-round, fountain-round-detail, fountain-center, hedge, fence, fence-gate, tree-high-round, tree, wheel, planks | https://kenney.nl/assets/fantasy-town-kit (`kenney_fantasy-town-kit_2.0.zip`, GLB format + `colormap.png`) | CC0: the page says "Creative Commons CC0", and `License.txt` in the zip says "License: (Creative Commons Zero, CC0)". A copy is at `Kenney-FantasyTownKit-License.txt` |
| `album.jpg` | A crop of this page's own render of the village at 40/40 | own render | CC0 (derivative) |
| (reused, not copied) | Vegetable-bed crops = Quaternius Ultimate Crops (`assets/farm/farm.glb`). Meadow grass and flowers, and the fountain's flower tubs = Quaternius Stylized Nature MegaKit (`assets/kit-a`). Residents = Quaternius Ultimate Animated Animals (Horse, Horse_White, Donkey, ShibaInu in `assets/animals`) plus the Quaternius sheep (`assets/farm/Sheep.glb`) | see the shared `assets/LICENSES.md` | CC0 |
| (procedural) | Cobbled lanes, the tavern yard, the plank garden beds, the hay meadows and haystacks, the pond rims and water, the watermill race, and the fountain plaza, spire, bowls and water drops | written in `themes/village.js` | own work |

#### Processing
- Blender 5 (`-b --python`): each source file was imported, its meshes joined into one top-level node named after the file (with `-` turned into `_`), then exported as one GLB.
- glTF-Transform 4.5: `dedup` + `meshopt`, 3.0 MB → 857 KB. The two tiny gradient atlases (KayKit 1024² and Kenney 512²) were kept as PNG, because lossy WebP would bleed the colour swatches.
- The colours are the packs' own atlases. Nothing was recoloured.

#### Not used
- The Quaternius Medieval Village MegaKit is modular (walls and roofs you assemble), and its free tier sits behind the itch download flow. The KayKit pack ships whole buildings and is CC0 on GitHub, so it was used instead.
- No villagers: people were out of scope.

## Merged from `pirate/LICENSES.md`: Island (pirate) theme (`themes.html?theme=pirate`; the per-theme file stays next to its assets)

### assets/pirate — licences

| file | what | source | licence | checked |
|---|---|---|---|---|
| `pirate-kit.glb` | 45 models from Kenney Pirate Kit 2.1 (palms, huts/roof, deck, dock, towers, castle gate, barrels, crates, cannons, chest, flags, rowboats, pirate ship, grass, rocks), packed with glTF-Transform (dedup + meshopt, WebP 512) | https://kenney.nl/assets/pirate-kit | CC0 1.0 | pack page + `Kenney-PirateKit-License.txt` in the zip (copied here) |

Everything else in the pirate theme (tide pools, waterfall, banana / pineapple beds, rope fences, tiki torches, pearl hoard, parrot, crabs, seagulls, turquoise water rim) is procedural three.js geometry in `themes/pirate.js` — no third-party assets.

## Merged from `space/LICENSES.md`: Moon base (space) theme (`themes.html?theme=space`; the per-theme file stays next to its assets)

### Moon base theme (`themes.html?theme=space`): asset licences (checked 2026-09-23)

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `space-kit.glb` | 72 of the 150+ models from the **Kenney Space Kit 2.0** (`kenney_space-kit.zip`, `Models/GLTF format/`): hangars (largeA/B, roundA/B/Glass, smallA/B), structures, supports, satellite dishes, machines (barrel, barrelLarge, generator, generatorLarge, wireless), barrels, rocks, crystals, craters, meteors, rover, rocket parts (base/fuel/sides/fins/top, A+B), platforms, rails, pipes, chimneys, craft, turret, gates, desk_computer | https://kenney.nl/assets/space-kit (direct zip `kenney.nl/media/pages/assets/space-kit/20874c75ac-1677698978/kenney_space-kit.zip`) | CC0: the page says "Creative Commons CC0" / "CC0 licensed!", and `License.txt` in the zip (copied here as `Kenney-SpaceKit-License.txt`) says "License: (Creative Commons Zero, CC0)" |

Processing: Blender 5 (`-b --python`) packed one top-level node per model, named after the file. Then glTF-Transform `dedup` + `meshopt`: 997 KB → 605 KB. No textures (Kenney uses flat baseColorFactors). At runtime the kit's Mars-orange `rock` / `rockDark` / `rockTrack` materials are recoloured to grey-lavender regolith, and `crystal` to lavender with a soft emissive.

Everything else in the theme is procedural three.js built in `themes/space.js`: the greenhouse domes and their plants, the crystals, antenna arrays, solar panels, lamps, the ice pool, the observatory, drones, the ringed planet and the regolith tile texture. It is original work, with no licence encumbrance.

Not used: Quaternius Ultimate Space Kit and KayKit Space Base Bits. Kenney alone covered every piece in one consistent style, inside the time box.

## Merged from `dino/LICENSES.md`: Dino valley theme (`themes.html?theme=dino`; the per-theme file stays next to its assets)

### Dino valley theme: asset licences (checked 2026-09-23)

All 3D content is CC0 1.0. Credit is optional, and it's given here anyway.

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `TRex.glb`, `Triceratops.glb`, `Stegosaurus.glb`, `Parasaurolophus.glb`, `Velociraptor.glb`, `Apatosaurus.glb` | **Quaternius Animated Dinosaur Pack**: 6 rigged dinos, each with Idle / Walk / Run / Jump / Attack / Death | https://poly.pizza/bundle/Animated-Dinosaur-Bundle-SmoLdBLO2K (GLBs from each model page, e.g. https://poly.pizza/m/UYtneO5FpF), pack page https://quaternius.com/packs/animateddinosaurs.html | CC0: every model page and the bundle JSON say "CC0 1.0". The Quaternius pack page says "CC0", and https://quaternius.com/license.html covers all packs |
| `palms.glb` | **Quaternius Ultimate Stylized Nature, "Palm Trees"** (PalmTree_1–5) | https://poly.pizza/m/VYslw9DEi6 (from the bundle https://poly.pizza/bundle/Ultimate-Stylized-Nature-Pack-zyIyYd9yGr) | CC0: the model page says "CC0 1.0", and so do all 12 models in the bundle |
| `album.jpg` | A crop of this page's own render of the valley at 40/40 | own render | CC0 (derivative) |
| (reused, not copied) | Ferns, conifers (Pine_1/Pine_5), grass, clover, mushrooms and flowers = Quaternius Stylized Nature MegaKit (`assets/kit-a`) | see the shared `assets/LICENSES.md` | CC0 |
| (procedural) | The volcano (cone, crater, lava, smoke), the cave home, stone arch, fossil dig, nest cliff, standing stones, bone hut, the nests, eggs and shells, the hot spring, waterfall and lakes, stepping stones, bones, torches, logs, boulders and all 3 fence kinds | written in `themes/dino.js` | own work |

#### Processing
- Dinos: a Node script rewrote each GLB's JSON chunk. It renamed the clips from `Armature|TRex_Walk` to `Walk` (the engine plays `Idle`/`Walk` by name) and replaced the near-black material colours with a storybook palette by material name (T. rex orange, Apatosaurus blue, Parasaurolophus gold, Triceratops lilac, Stegosaurus amber, Velociraptor tan). Then glTF-Transform 4.5 `meshopt`: about 330 KB → about 105 KB each.
- Palms: the RootNode children were promoted to scene roots (one template per tree). Then glTF-Transform `dedup` + `webp` + `meshopt`: 1.1 MB → 103 KB.
- Total `assets/dino/` is about 0.8 MB.

#### Not used
- The Quaternius "Rocks" model (3.2 MB) was too heavy. The rocks here are procedural instead.

## Merged from `winter/LICENSES.md`: Winter village theme (`themes.html?theme=winter`; the per-theme file stays next to its assets)

### Winter village theme (`themes.html?theme=winter`): asset licences (checked 2026-09-24)

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `winter.glb` | 68 of the models from the **Kenney Holiday Kit 2.0** (`kenney_holiday-kit.zip`, `Models/GLB format/`): snowy trees (tree-snow-a/b/c, tree, tree-decorated(-snow)), lanterns, presents, sleds, benches, cabin fence, reindeer, candy canes, wreaths, rocks, snow piles, string-light models and the modular cabin pieces (packed, currently unused). Skipped: hanukkah / kwanzaa / festivus / socks / train / snowflakes / gingerbread / nutcracker | https://kenney.nl/assets/holiday-kit (direct zip `kenney.nl/media/pages/assets/holiday-kit/3976a6496a-1733923970/kenney_holiday-kit.zip`) | CC0: the page says "Creative Commons CC0" / "CC0 licensed!", and `License.txt` in the zip (copied here as `Kenney-HolidayKit-License.txt`) says "License: (Creative Commons Zero, CC0)" |
| `album.jpg` | album card art | a screenshot of this theme at 40/40 | original work |

Processing: Blender 5 (`-b --python`) packed one top-level node per model, named after the file (the loader strips the `.001` suffix). WebP texture (one shared 512 colormap), then glTF-Transform `dedup` + `meshopt`: 1.19 MB → 404 KB.

Residents (Stag, Deer, Fox, Husky) reuse the shared `assets/animals/` GLBs and `assets/thumbs/` (already listed in `assets/LICENSES.md`).

Everything else is procedural three.js in `themes/winter.js`: log cabins, the mountain lodge, cocoa stall, sled shed, snowmen (5 stages), igloos (5 stages), skating pond, ice-fishing hole, hot spring, ice fountain, shovelled paths, string-light bulbs, snowbanks, icicles, the snow tile texture, falling snow and steam. Original work, no licence encumbrance.

Not used: KayKit Holiday Bits (itch.io download needs the browser flow; Kenney alone covered every piece in one style inside the time box).

## Merged from `halloween/LICENSES.md`: Pumpkin patch (halloween) theme (`themes.html?theme=halloween`; the per-theme file stays next to its assets)

### Pumpkin patch (halloween) theme: asset licences (checked 2026-09-24)

All 3D content is CC0 1.0. Credit is optional, and it's given here anyway.

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `halloween.glb` (KayKit part, `kk_*`) | **KayKit Halloween Bits 1.0 (free tier)**, 29 models: pumpkins orange/yellow (normal, small, jack-o'-lantern), orange + yellow autumn pines (S/M/L), lantern standing/hanging, lantern post, post, benches, stone paths A–D, candles, fence pieces, dirt floor | https://kaylousberg.itch.io/halloween-bits (`KayKit_HalloweenBits_1.0_FREE.zip`, glTF folder + `halloweenbits_texture.png`) | CC0: the itch page says "Creative Commons Zero v1.0 Universal", and `License.txt` in the zip says "License: (Creative Commons Zero, CC0)". Copy: `KayKit-HalloweenBits-License.txt` |
| `halloween.glb` (Kenney part, `kn_*`) | **Kenney Graveyard Kit 5.0**, 26 models: pumpkins (round/tall, carved), hay bales, wooden fence/gate, lanterns, lamp posts, fire basket, bench, fall pines, trunks, candles, rocks, keeper, debris, shovel. No gravestones/coffins were packed (cute, not scary) | https://kenney.nl/assets/graveyard-kit (`kenney_graveyard-kit_5.0.zip`, GLB format + `colormap.png`) | CC0: the page says "Creative Commons CC0", and `License.txt` says "License: (Creative Commons Zero, CC0)". Copy: `Kenney-GraveyardKit-License.txt` |
| (reused, not copied) | Barns + well = Quaternius Farm Buildings (`assets/farm/farm.glb`); cottage + market stall = KayKit Medieval Hexagon (`assets/village/village.glb`); maples/oaks + grass tufts = Quaternius Stylized Nature MegaKit (`assets/kit-a`), leaf atlas re-tinted to autumn at runtime | see the shared `assets/LICENSES.md` and `assets/village/LICENSES.md` | CC0 |
| (procedural) | Pumpkin carriage (Gita), witch-hat cottage, apple barrel, misty ponds, scarecrow, candy basket, pumpkin vines/leaves, leaf litter, ground tile texture, drifting leaves, fireflies, residents (black cat, owl, crows, bats) | written in `themes/halloween.js` | own work |

#### Processing
- Blender 5 (`-b --python`): each source file imported, meshes joined into one top-level node (`kk_<name>` / `kn_<name>`, `-` → `_`), exported as one GLB (1.08 MB).
- glTF-Transform 4.5 `dedup` + `meshopt` → 376 KB. Atlases kept as PNG (swatch atlases bleed under lossy WebP). Colours are the packs' own; nothing recoloured in the file.

#### Not used
- Gravestones, coffins, skulls, bones, crypts, dead trees from both packs: too spooky for a mindfulness app.
- No CC0 animated cat/owl/bat/crow was found in the time budget, so residents are procedural.

## Merged from `town/LICENSES.md`: Little town theme (`themes.html?theme=town`; the per-theme file stays next to its assets)

### Little town theme (`themes.html?theme=town`): asset licences (checked 2026-09-24)

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `town.glb` (`kk_*` nodes) | KayKit **City Builder Bits 1.0**: 8 city buildings (`building_A..H_withoutBase`), paving base, bench, bush, fire hydrant, street light, traffic light, bin, water tower, box, road tiles (straight, crossing, junction), 4 cars | https://kaylousberg.itch.io/city-builder-bits (the author's official mirror https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0, `addons/kaykit_city_builder_bits/Assets/gltf/`) | CC0: the itch page says "CC0 Licensed", the repo's `LICENSE.txt` says "License: (Creative Commons Zero, CC0)" (copied here as `KayKit-CityBuilderBits-License.txt`) |
| `town.glb` (`sub_*`) | Kenney **City Kit (Suburban) 2.0**: houses type a/c/k/m/r/t, fences, planter, tree-large/small, stone path | https://kenney.nl/assets/city-kit-suburban | CC0: page says "CC0 licensed!"; `License.txt` in the zip "(Creative Commons Zero, CC0)" → `Kenney-city-kit-suburban-License.txt` |
| `town.glb` (`car_*`) | Kenney **Car Kit**: van, delivery, taxi, sedan, suv, cone, wheel | https://kenney.nl/assets/car-kit | CC0: page + `License.txt` → `Kenney-car-kit-License.txt` |
| `town.glb` (`rd_*`) | Kenney **City Kit (Roads)**: construction barrier/cone/fence/light, street sign | https://kenney.nl/assets/city-kit-roads | CC0: page + `License.txt` → `Kenney-city-kit-roads-License.txt` |
| `town.glb` (`com_*`) | Kenney **City Kit (Commercial) 2.1**: awning, café parasols a/b | https://kenney.nl/assets/city-kit-commercial | CC0: page + `License.txt` → `Kenney-city-kit-commercial-License.txt` |
| `album.jpg` | album card art | a screenshot of this theme at 40/40 | original work |

Processing: no Blender needed (all sources already glTF/GLB). One top-level node per model, prefixed by kit (`kk_`, `sub_`, `car_`, `rd_`, `com_`; glTF-Transform de-duplicates clashing names with a `_1` suffix, e.g. `car_taxi_1`), then `unpartition + prune + dedup + weld`, WebP textures at 512, `meshopt`: 480 KB for 51 models.

Reused shared assets (already in `assets/LICENSES.md`): MegaKit (kit a) park trees, grass and flowers; Quaternius Ultimate Crops (farm kit) in the garden beds; `assets/animals/ShibaInu.glb` + `assets/thumbs/ShibaInu.png` (town dog).

Procedural (original, in `themes/town.js`): sidewalks, building sites (5 stages + little crane), park fountain, duck + lily ponds, ducks, bus stop, mailbox, bike racks + bikes, picket fences, hedges, the clock tower plaza, the town bus, the cyclist and the birds. Kenney house roofs are recoloured per house at runtime (canvas swap of the roof swatch).

Not used: the rest of both Kenney city kits (grey commercial towers read too cold for a cozy town).

## Album card art (checked 2026-09-24)

| Folder | What | Source | Licence |
|---|---|---|---|
| `<id>/album.jpg` (all 10 themes: farm, forest, reef, village, pirate, space, dino, winter, halloween, town) | the album card thumbnail: this page's own render of the theme at its album state (`themes.html?albumsnap=1&theme=<id>`, saved by `album-thumbs.sh`) | own render of the CC0 models above | CC0 (derivative) |
| `album/farm.jpg`, `album/forest.jpg` | older hand-cropped thumbnails, superseded by `farm/album.jpg` / `forest/album.jpg`, no longer referenced | own render | CC0 (derivative) |
