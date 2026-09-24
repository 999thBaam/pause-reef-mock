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

## Merged from `diwali/LICENSES.md`: Diwali lanes theme (`themes.html?theme=diwali`; the per-theme file stays next to its assets)

### assets/diwali — licences

No new third-party files. Everything in the Diwali lanes theme is procedural three.js geometry (themes/diwali.js), except
reused shared CC0 kit pieces already listed in assets/LICENSES.md:

| used for | file | source | licence |
|---|---|---|---|
| neem / mango trees (CommonTree_1/2/3) | assets/kit-a/kit-a.glb | Quaternius Stylized Nature MegaKit | CC0 |
| coconut palms (palm-detailed-bend/straight) | assets/pirate/pirate-kit.glb | Kenney Pirate Kit | CC0 |
| grass tufts + meadow flowers (Grass_1/2, Flower_3/4) | assets/farm/farm.glb | Quaternius Ultimate Crops / farm packs | CC0 |
| cows (recoloured at runtime) | assets/animals/Cow.glb | Quaternius Ultimate Animated Animals | CC0 |
| album.jpg | assets/diwali/album.jpg | rendered from this theme (album-thumbs.sh) | own render |

## Merged from `zen/LICENSES.md`: Zen garden theme (`themes.html?theme=zen`; the per-theme file stays next to its assets)

### zen — asset licences

| folder | what | source | licence | checked |
|---|---|---|---|---|
| (none new) | Cherry trees (TwistedTree_1/3/5, leaves recoloured sakura pink in code), Japanese maples (CommonTree_2/3, recoloured momiji scarlet), black pine (Pine_1/3), grass tufts | shared `assets/kit-a/kit-a.glb` = Quaternius Stylized Nature MegaKit, https://quaternius.com | CC0 1.0 | already listed in `assets/LICENSES.md` (kit-a row) |
| — | Tea house, pagoda, gate house, shrines, bell tower, torii, stone lanterns, raked gravel, bonsai, bamboo, koi + ponds, waterfall, shishi-odoshi, bridges, fences, cranes, tanuki, cat, petals | procedural three.js in `themes/zen.js` | original code, no third-party assets | — |

`album.jpg` is rendered from the theme itself (`bash album-thumbs.sh zen`).

Not used: Poly Pizza "Torii Gate" / "Temple" / "Japanese Door" by Quaternius (CC0 per Quaternius) were checked as candidates but not imported (procedural pieces kept one consistent style); "Pagoda" / "Gate" by Poly by Google are CC-BY — rejected.

## Merged from `camp/LICENSES.md`: Mountain camp theme (`themes.html?theme=camp`; the per-theme file stays next to its assets)

### Mountain camp theme: asset licences (checked 2026-09-24)

All 3D content is CC0 1.0. Credit is optional, and it's given here anyway.

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `camp.glb` | **Quaternius Survival Pack**, 10 of its 32 models: Tent, Bonfire, Wood Log, Axe, Backpack, Raft (packed, unused), Raft Paddle, Wooden Torch, Pot, Shovel | https://poly.pizza/bundle/Survival-Pack-XzvQPP0yWB (GLBs from each model page, e.g. https://poly.pizza/m/5Q7qIrfDxA Tent, https://poly.pizza/m/k1e0cOzi8A Bonfire) | CC0: the bundle page lists every one of the 32 models as "CC0 1.0", and each model page says "CC0 1.0". Quaternius' own licence page https://quaternius.com/license.html covers all packs (CC0). Poly Pizza downloads carry no License.txt, so none is copied here |
| `album.jpg` | A crop of this page's own render of the camp at 40/40 (`bash album-thumbs.sh camp`) | own render | CC0 (derivative) |
| (reused, not copied) | Pines (Pine_1/3/5), aspens (CommonTree_1/2), grass, flowers, rocks and pebbles = Quaternius Stylized Nature MegaKit (`assets/kit-a`); residents Stag / Deer / Fox / Wolf = Quaternius Ultimate Animated Animals (`assets/animals`) | see the shared `assets/LICENSES.md` | CC0 |
| (procedural) | Log cabin, woodshed, ranger lookout tower, boathouse, orange A-frame tent, waterfall, creek, mountain spring, lake + canoe with paddler, bonfire stages, firewood stacks, berry + veg patches, trails, signposts, benches, lanterns, fishing dock, split-rail fence, summit cairn with prayer flags + butter lamps, the snowy peak backdrop, meadow tile texture, smoke, hawks | written in `themes/camp.js` | own work |

#### Processing
- Blender 5 (`-b --python`): each Poly Pizza GLB imported, its meshes joined into one top-level node named after the model, exported as one GLB (366 KB). Colours are the pack's own material colours; nothing recoloured.
- glTF-Transform 4.5 `dedup` + `meshopt` → 120 KB. Total `assets/camp/` ≈ 0.18 MB.

#### Not used
- KayKit Forest Nature (`assets/kit-b`): its trees rendered as flat green blobs next to the MegaKit pines, so every conifer here is from the MegaKit instead.
- No CC0 animated bear was found within the time budget (the Quaternius Ultimate Animated Animals set has none), so the fourth resident is the Wolf.

## Merged from `castle/LICENSES.md`: Fantasy castle theme (`themes.html?theme=castle`; the per-theme file stays next to its assets)

### Fantasy castle (castle) theme: asset licences (checked 2026-09-24)

All 3D content is CC0 1.0. Credit is optional; given here anyway.

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `castle.glb` (`ck_*`) | **Kenney Castle Kit 2.0**, 66 models: square/hexagon/round tower modules, roofs, arches, walls, gates, door, flags + banners, drawbridge, bridges, stairs, rocks, pines. The 10 siege weapons were NOT packed (no weapons in a mindfulness app) | https://kenney.nl/assets/castle-kit (`kenney_castle-kit.zip`, GLB format + `colormap.png`) | CC0: the page says "Creative Commons CC0", and `License.txt` in the zip says "License: (Creative Commons Zero, CC0)". Copy: `Kenney-CastleKit-License.txt` |
| `Dragon.glb` | **Quaternius "Dragon"** (Ultimate Monsters bundle), animated (Flying_Idle, Fast_Flying, Yes, …) | https://poly.pizza/m/3rUm1cN3yp (bundle https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6) | CC0: the model page metadata says `"Licence":"CC0 1.0"`; Quaternius releases all packs CC0. Colours brightened at runtime |
| `Pigeon.glb` | **Quaternius "Pigeon"** (Ultimate Monsters bundle), animated; recoloured white at runtime → doves | https://poly.pizza/m/9NGlBTpDEr | CC0: model page `"Licence":"CC0 1.0"` |
| (reused, not copied) | Well, fountain basin, barrels, crates, sacks, cart, hedge, lilies, reeds, stone pile = KayKit Medieval Hexagon / Kenney Fantasy Town (`assets/village/village.glb`); oaks + meadow tufts = Quaternius Stylized Nature MegaKit (`assets/kit-a`); horses = Quaternius Ultimate Animated Animals (`assets/animals`) | see `assets/village/LICENSES.md` and the shared `assets/LICENSES.md` | CC0 |
| (procedural) | Growing castle walls (courses + scaffold), enchanted glowing flower beds, topiary, torches, stables, lily pool, moat channel + rim, crystal + shards, low ramparts, pennant posts, magic motes | `themes/castle.js` | own work |

#### Processing
- Blender 5 (`-b --python`): each Kenney GLB imported, meshes joined into one top-level node `ck_<name>` (`-` → `_`), one GLB (750 KB) → glTF-Transform 4.5 `dedup` + `meshopt` → 274 KB. Colormap kept as PNG.
- Dragon / Pigeon: glTF-Transform `meshopt` only (72 KB / 36 KB).
- Theme total ≈ 0.46 MB (+ album.jpg).

#### Not used
- Kenney siege kit (ballista, catapult, trebuchet, ram, siege tower): weapons.
- Quaternius Fantasy Props MegaKit / KayKit Dungeon: not needed; crystals and magic are procedural.

## Merged from `railway/LICENSES.md`: Railway valley theme (`themes.html?theme=railway`; the per-theme file stays next to its assets)

### Railway valley theme (`themes.html?theme=railway`): asset licences (checked 2026-09-24)

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `railway.glb` | Kenney **Train Kit 1.1**: steam locomotives a/b/c, passenger coaches (`locomotive-passenger-a/b`), coal, wood and lumber wagons (8 models) | https://kenney.nl/assets/train-kit | CC0: the page says "CC0 licensed!" / "Creative Commons CC0"; `License.txt` in the zip says "License: (Creative Commons Zero, CC0)" (copied here as `Kenney-TrainKit-License.txt`) |
| `album.jpg` | album card art | a screenshot of this theme at 40/40 (`bash album-thumbs.sh railway`) | original work |

Processing: no Blender needed (source is GLB). The 8 GLBs were merged with glTF-Transform 4.5 (`mergeDocuments`, one top-level node per model named after its file without `train-`), then `unpartition + dedup + prune + weld + meshopt`: 146 KB. The shared 64 px colormap stays PNG.

Reused shared assets (already in `assets/LICENSES.md`, not copied): MegaKit (kit `a`) oaks, pines, bushes, grass and flowers; the farm kit (Quaternius Farm Buildings + Ultimate Crops) water tower and apple trees `Apple_1/2/4` + `Apple_Crop`; the village kit (Kenney Fantasy Town / KayKit) cottages `building_home_A_red/_A_green/_B_yellow`, crates and sack; `assets/farm/Sheep.glb` and `assets/animals/Cow.glb` + `assets/thumbs/Cow.png` (residents).

Procedural (original, in `themes/railway.js`): the track (straight / curve / level crossing), the station, signal box, engine shed, goods shed, semaphore signals, lamp & bench, river / waterfall pool / stone bridge / lake, wheat fields (5 stages), hedgerow, the mountain tunnel with viaduct and waterfall, and the steam puffs.

Not used: the Kenney Train Kit's `railroad-*` and `track*` pieces (their curve radii don't match the 1-tile grid; the track is procedural in the same lavender-rail look), trams, diesel/electric sets. Quaternius Modular Train Pack was not needed (Kenney covers the trains; stations are procedural).

## Merged from `fairy/LICENSES.md`: Fairy wood theme (`themes.html?theme=fairy`; the per-theme file stays next to its assets)

### Fairy wood (`?theme=fairy`): asset licences

No new third-party files. Everything built in the theme is procedural (three.js geometry in `themes/fairy.js`).

| folder | what | source | licence | checked |
|---|---|---|---|---|
| assets/kit-a (shared) | twisted trees (leaves re-tinted teal/lilac in code), Fern_1, Plant_7, grass/clover/mushroom/flower tufts | Quaternius Stylized Nature MegaKit, quaternius.com | CC0 | shared kit, already recorded in assets/LICENSES.md |
| assets/animals (shared) | Fox, Deer (residents) | Quaternius Ultimate Animated Animal Pack, quaternius.com | CC0 | shared kit, already recorded in assets/LICENSES.md |
| assets/thumbs (shared) | Fox.png, Deer.png resident chips | rendered from the above | CC0 (derived) | n/a |
| assets/fairy/album.jpg | album card art | rendered by `album-thumbs.sh fairy` | own render | n/a |

Code-built (no asset): toadstool manor/cottage/inn, stump homes, acorn cottage, lantern tree house, mushroom tower, giant mushrooms,
flower rings, dewdrop fountain, waterfall, moonlit pond, lily brook, willow, stepping stones, lantern post, twig bridge/fences,
fairy lights, the Tree of Light, owl, rabbits, snails, butterflies, fireflies.

Not used: Quaternius Fantasy Props MegaKit and KayKit packs. They weren't needed, so nothing was downloaded.

## Merged from `pets/LICENSES.md`: Pet park theme (`themes.html?theme=pets`; the per-theme file stays next to its assets)

### Pet park (`?theme=pets`): asset licences (checked 2026-09-24)

All 3D content is CC0 1.0. Credit is optional; given here anyway.

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `pet-dog.glb`, `pet-cat.glb`, `pet-bunny.glb`, `pet-pig.glb`, `pet-chick.glb`, `pet-parrot.glb` | **Kenney Cube Pets 2.0** (6 of the pack's 24 animals), node-animated: static, idle, walk, run, eat, dance, gesture-positive/negative. Used for the residents, the ambient pets and the carousel riders. A `Hop` clip (walk legs + a bounce) is added at runtime | https://kenney.nl/assets/cube-pets (`kenney_cube-pets_1.0.zip`, GLB format + `Textures/colormap.png`) | CC0: the page says "Creative Commons CC0", and `License.txt` in the zip says "License: (Creative Commons Zero, CC0)". Copy: `Kenney-CubePets-License.txt` |
| (reused, not copied) | Round/parasol trees, pastel bushes, grass tufts = KayKit Forest Nature Pack (`assets/kit-b/kit-b.glb`), re-tinted at runtime with `assets/kit-b/forest_texture_tints.webp` (pink / lavender / gold / mint columns) | see the shared `assets/LICENSES.md` | CC0 |
| `album.jpg` | album card art | rendered by `bash album-thumbs.sh pets` | own render |
| (procedural) | Pet café, dog house, cat tower, bunny hutch, vet cottage, bird houses, sprinkler fountain, splash pool, splash pond, duck pond + rubber ducks, carrot patch / flower maze / agility course (5 growth stages), cream paths, food bowls, beach balls, toy pile, benches, swing, picket fences, rainbow carousel, kite, bubbles, ground tile texture | `themes/pets.js` | own work |

#### Processing
- Cube Pets GLBs: glTF-Transform 4.5 `dedup` + `meshopt` (the external colormap is embedded as PNG) → 51–66 KB each, 342 KB total. Theme total ≈ 0.42 MB with album.jpg.

#### Not used
- Kenney Cube Pets: the other 18 animals (zoo/wild ones: lion, tiger, giraffe, elephant, panda, koala, penguin, polar bear, monkey, fox, deer, cow, beaver, hog, crab, fish, bee, caterpillar). Only pet-like animals were packed.
- Kenney Mini Market / Furniture Kit / Nature Kit and KayKit Block Bits / Furniture Bits: checked (Kenney pages say CC0) but not downloaded. None of them has pet houses, and one procedural toy style for every prop read more consistent with the blocky Cube Pets inside the time box.

## Merged from `oasis/LICENSES.md`: Desert oasis theme (`themes.html?theme=oasis`; the per-theme file stays next to its assets)

### Desert oasis theme: asset licences (checked 2026-09-24)

No new 3D files. Everything in this theme is either procedural (own work) or reuses CC0 kits already in the repo.

| File / source | What | Licence, and where I checked it |
|---|---|---|
| `assets/dino/palms.glb` (reused, not copied) | Date palms: **Quaternius Ultimate Stylized Nature "Palm Trees"** (PalmTree_3, PalmTree_4) | CC0 1.0: https://poly.pizza/m/VYslw9DEi6, see `assets/dino/LICENSES.md` |
| `assets/kit-a/kit-a.glb` (reused) | Rocks (Rock_Medium_1–3), dry grass tufts: **Quaternius Stylized Nature MegaKit** | CC0, see the shared `assets/LICENSES.md` |
| `assets/animals/Fox.glb` (reused) | Fennec fox: **Quaternius Ultimate Animated Animals** Fox, recoloured sandy at runtime, ear bones scaled 1.6× | CC0, see the shared `assets/LICENSES.md` |
| `album.jpg` | Crop of this page's own render of the oasis at 40/40 (`bash album-thumbs.sh oasis`) | own render |
| (procedural, `themes/oasis.js`) | Haveli, houses, domed pavilion, caravanserai, tents, lantern bazaar, well, fountain, pools, reeds, acacias, cacti, agave, charbagh gardens, date nursery, rugs, pots, lanterns, mud walls, the sunset chhatri, camels, flamingos, hawk, sand motes, sand tile texture | own work |

#### Not used
- Camels on Poly Pizza (https://poly.pizza/search/camel): five are "Poly by Google" (CC-BY 3.0) and one by "jeremy" (also attribution-licensed). None are CC0, so the camels are built in code instead.

## Merged from `varanasi/LICENSES.md`: Ghat temple theme (`themes.html?theme=varanasi`; the per-theme file stays next to its assets)

### varanasi — asset licences

No new asset files. Every Varanasi piece (ghat steps, river, temples, havelis, pathshala, aarti platform, boats, kund, hand pump,
kites, ghat umbrellas, lanes, flower stall, bell ropes, diya trails, marigold beds, tulsi, banana, rowing boats, river dolphins,
pigeons) is procedural three.js geometry in `themes/varanasi.js`. album.jpg is a render of the theme.

Reused shared CC0 kits (already listed in assets/LICENSES.md):

| folder | what | source | licence |
|---|---|---|---|
| assets/kit-a | CommonTree_1/2/3/5 (peepal, neem, banyan) | Quaternius Stylized Nature MegaKit | CC0 |
| assets/farm | Grass_1/2 tufts | Quaternius Farm / Ultimate Crops | CC0 |

## Merged from `sky/LICENSES.md`: Windmill hall theme (`themes.html?theme=sky`; the per-theme file stays next to its assets)

### sky (Sky islands) — asset licences

No new asset files. Everything in `themes/sky.js` is procedural three.js geometry, except:

| what | source | licence | checked |
|---|---|---|---|
| sky oaks (CommonTree_1/2), sky pines (Pine_1/3), meadow grass/clover/flower tufts | shared kit `assets/kit-a/kit-a.glb` = Quaternius Stylized Nature MegaKit | CC0 | already recorded in `assets/LICENSES.md` (kit-a row) |

`album.jpg` is a render of this theme (album-thumbs.sh).

## Merged from `cricket/LICENSES.md`: Stand theme (`themes.html?theme=cricket`; the per-theme file stays next to its assets)

### cricket — asset licences

No new asset files. Everything is procedural three.js in `themes/cricket.js`; the oak/pine trees reuse the shared kit `a` (Quaternius Stylized Nature MegaKit, CC0, see `assets/LICENSES.md`). `album.jpg` is a render of this theme. No team names, logos, sponsor text or real players.

## Merged from `globe/LICENSES.md`: Carousel theme (`themes.html?theme=globe`; the per-theme file stays next to its assets)

### assets/globe

No third-party assets. Every piece, the globe, base, snow and residents are procedural three.js geometry in `themes/globe.js`. `album.jpg` is rendered from the theme itself (`bash album-thumbs.sh globe`).

## Merged from `phoenix/LICENSES.md`: Seed dome theme (`themes.html?theme=phoenix`; the per-theme file stays next to its assets)

### phoenix: asset licences
No new model files. The theme reuses assets already in this repo:
| what | file | source | licence |
|---|---|---|---|
| trees, grass, clover, ferns, flowers, bushes | assets/kit-a/kit-a.glb | Quaternius Stylized Nature MegaKit (quaternius.com) | CC0 (see assets/LICENSES.md) |
| coconut palms | assets/dino/palms.glb | Quaternius Ultimate Stylized Nature "Palm Trees" | CC0 (see assets/dino/LICENSES.md) |
Everything else (basalt columns, huts, seed dome, lookout, bird poles, rain clouds, pools, lava fields, phoenix spring, phoenix, parrots, hatchlings) is procedural three.js geometry in themes/phoenix.js.
album.jpg = rendered from the theme by album-thumbs.sh.

## Storybook theme (`themes.html?theme=book`; no per-theme file: nothing third-party)

| folder | what | source | licence | checked |
|---|---|---|---|---|
| assets/book | album.jpg | rendered from this theme (album-thumbs.sh) | own work | — |

Every piece, the page block, cover, ribbon, page-end curls and origami residents are procedural three.js (themes/book.js). Kit `a` is listed only so the primary-kit lookup resolves; nothing from it is drawn.

## Merged from `turtle/LICENSES.md`: Conch house theme (`themes.html?theme=turtle`; the per-theme file stays next to its assets)

### turtle (Turtle isle) — asset licences

No new model files. The turtle (shell, head, flippers, tail), the sea, the conch house, the lighthouse, the shell gardens,
pools, paths, driftwood fences and the hatchlings are procedural three.js geometry in `themes/turtle.js`. Reused shared kits:

| what | file | source | licence | checked |
|---|---|---|---|---|
| palms, thatched huts, row boats, barrels, rocks, grass | `assets/pirate/pirate-kit.glb` | Kenney Pirate Kit (kenney.nl) | CC0 | recorded in `assets/LICENSES.md` + `assets/pirate/Kenney-PirateKit-License.txt` |
| cottages, lookout tower, lanterns | `assets/village/village.glb` | KayKit Medieval Hexagon (kaylousberg.itch.io) | CC0 | recorded in `assets/LICENSES.md` + `assets/village/KayKit-MedievalHexagon-License.txt` |
| shade trees, flowers, bushes, meadow tufts | `assets/kit-a/kit-a.glb` | Quaternius Stylized Nature MegaKit | CC0 | recorded in `assets/LICENSES.md` (kit-a row) |
| blue tangs, clownfish, snapper, manta | `assets/reef/Fish1-3.glb`, `Manta.glb` | Quaternius Animated Fish | CC0 | recorded in `assets/LICENSES.md` + `assets/reef/Quaternius-AnimatedFish-License.txt` |

`album.jpg` is a render of this theme (album-thumbs.sh).

## Merged from `candy/LICENSES.md`: Layer-cake house theme (`themes.html?theme=candy`; the per-theme file stays next to its assets)

### candy — asset licences

No third-party assets. Every piece, the cake block (env), the ground texture and the residents (gummy bears, bees) are procedural three.js geometry and canvas textures written in `themes/candy.js`. `album.jpg` is a render of the theme itself (album-thumbs.sh). The kit id `a` (Quaternius Stylized Nature MegaKit, CC0, see assets/LICENSES.md) is declared as the primary kit but no model from it is placed.

## Merged from `dream/LICENSES.md`: Upside-down manor theme (`themes.html?theme=dream`; the per-theme file stays next to its assets)

### assets/dream — licences

No external assets. Every Dreamland piece, the cloud sea, the residents (dream sheep, sleepy stars) and the ground texture are
procedural three.js built in `themes/dream.js` (CC0-equivalent: our own code). `album.jpg` is a render of the theme itself
(`bash album-thumbs.sh dream`). The shared Quaternius kit `a` is listed in `kits` (engine default) but no model from it is used.

## Merged from `solar/LICENSES.md`: Home planet theme (`themes.html?theme=solar`; the per-theme file stays next to its assets)

### assets/solar — licences

| what | source | licence | checked |
|---|---|---|---|
| (no new files) every planet, moon base, station, dish, launch tower, the Sun, rocket, comets, satellites, tiles and orbit lines are procedural three.js geometry + canvas textures written for this mock | — | own work | — |
| home-planet and moon-cottage flowers (`Flower_3_Group`, `Flower_4_Group`) reused from the shared kit `assets/kit-a/` (Quaternius Stylized Nature MegaKit) | quaternius.com | CC0 | already recorded in assets/LICENSES.md |
| `album.jpg` rendered from the theme by `album-thumbs.sh` | — | own work | — |

## Merged from `kerala/LICENSES.md`: Tharavad theme (`themes.html?theme=kerala`; the per-theme file stays next to its assets)

### kerala — asset licences

No new third-party asset files. Everything in `themes/kerala.js` is procedural three.js geometry and canvas textures written for this mock: the canal, houses, houseboats, nets, snake boat, paddy, palms, elephants, kingfishers and ducks.

Reused shared kits (already in the repo, CC0, see `assets/LICENSES.md`):
- `assets/kit-a/kit-a.glb`: Quaternius Stylized Nature MegaKit (CC0). CommonTree_1 and CommonTree_2 are used for the mango and jackfruit trees.
- `assets/farm/farm.glb`: Quaternius farm kit (CC0). Grass_1 and Grass_2 are used for the decor tufts.

`album.jpg` is rendered from this theme by `album-thumbs.sh`.

## Merged from `ladakh/LICENSES.md`: Hillside houses theme (`themes.html?theme=ladakh`; the per-theme file stays next to its assets)

### ladakh — assets

No new asset files. Every piece, resident and ambient bird is procedural three.js geometry in `themes/ladakh.js`.

| folder | what | source | licence | checked |
|---|---|---|---|---|
| assets/kit-a (shared) | Rock_Medium_1–3, Pebble_Round_1–3 (decor, pond rims) | Quaternius Stylized Nature MegaKit | CC0 | already recorded in assets/LICENSES.md |
| assets/ladakh/album.jpg | album card art | rendered from the theme (`bash album-thumbs.sh ladakh`) | own render | — |

## Merged from `mumbai/LICENSES.md`: Chawl courtyard theme (`themes.html?theme=mumbai`; the per-theme file stays next to its assets)

### mumbai — asset licences

No new asset files. Every Mumbai piece (chawl courtyard, chawl rows, art-deco blocks, Irani café, old library, sea arch,
chai tapri, umbrella stall, snack cart, taxi, sea-wall lamps, train viaduct, fountain, water pots, coconut cart, rain barrel,
street tap, gulmohar, coconut palms, puddles + paper boats, the sea / tetrapods / foam env, rain bursts, local train, crows,
rainbow) is procedural three.js geometry in `themes/mumbai.js`. The sea arch is a generic design (no text, crest or replica
detailing). album.jpg is a render of the theme.

Reused shared CC0 kits (already listed in assets/LICENSES.md):

| folder | what | source | licence |
|---|---|---|---|
| assets/kit-a | CommonTree_1 (rain tree), CommonTree_5 (banyan) | Quaternius Stylized Nature MegaKit | CC0 |
| assets/farm | Grass_1/2 tufts | Quaternius Farm / Ultimate Crops | CC0 |

## Merged from `jungle/LICENSES.md`: Vine temple theme (`themes.html?theme=jungle`; the per-theme file stays next to its assets)

### Jungle kingdom theme: asset licences (checked 2026-09-24)

No new 3D files. Everything in this theme is either procedural (own work) or reuses CC0 kits already in the repo.

| File / source | What | Licence, and where I checked it |
|---|---|---|
| `assets/dino/palms.glb` (reused, not copied) | Palms: **Quaternius Ultimate Stylized Nature "Palm Trees"** (PalmTree_3, PalmTree_4) | CC0 1.0, see `assets/dino/LICENSES.md` |
| `assets/kit-a/kit-a.glb` (reused) | Ferns (Fern_1), big-leaf plants (Plant_1_Big), tall grass, mushrooms, rocks: **Quaternius Stylized Nature MegaKit** | CC0, see the shared `assets/LICENSES.md` |
| `album.jpg` | Crop of this page's own render of the jungle at 40/40 (`bash album-thumbs.sh jungle`) | own render |
| (procedural, `themes/jungle.js`) | Vine temple, ruined tower, tree house, thatched hut, stone archway, bamboo lookout, waterfall, lily pool, bamboo spout, lotus pond, rainforest / fig trees, banana groves, bamboo clumps, restoring shrines and stupas, trail props, bamboo fence, the giant banyan, tiger, sloth bear, monkeys, peacocks, fireflies, tiger-stripe / thatch / leaf-litter canvas textures | own work |

#### Not used
- No CC0 tiger, sloth bear, langur or peacock model was found in the CC0 kits already in use (Quaternius / KayKit / Kenney), so the residents are built in code.

## Merged from `robots/LICENSES.md`: Main workshop theme (`themes.html?theme=robots`; the per-theme file stays next to its assets)

### robots — asset licences

No third-party assets. Every piece (workshop, silo, control tower, garage, dome lab, parts shop, bubble tank, wind turbine, breeze fan, cooling pool, gear/lamp trees, spring bushes, robot assembly pads, paths, pipe railings, the giant robot), the block trim (env), the floor texture and the residents (little bots, hover drones) are procedural three.js geometry and canvas textures written in `themes/robots.js`. `album.jpg` is a render of the theme itself (album-thumbs.sh). The kit id `a` (Quaternius Stylized Nature MegaKit, CC0, see assets/LICENSES.md) is declared as the primary kit but no model from it is placed.

## Merged from `toys/LICENSES.md`: Dollhouse theme (`themes.html?theme=toys`; the per-theme file stays next to its assets)

### assets/toys — licences

No third-party assets. Every toy-room piece, resident and texture (floorboards, gingham, the crayon drawing) is procedural
three.js in `themes/toys.js`, drawn at load. `album.jpg` is a render of the theme itself (`bash album-thumbs.sh toys`).
Only shared engine code/textures are used. No brands, no letters or text on any toy.

## Merged from `bees/LICENSES.md`: Honeycomb hall theme (`themes.html?theme=bees`; the per-theme file stays next to its assets)

### Bee kingdom theme: asset licences (checked 2026-09-24)

No new 3D files. Everything in this theme is procedural (own work) or reuses a CC0 kit already in the repo.

| File / source | What | Licence, and where I checked it |
|---|---|---|
| `assets/kit-a/kit-a.glb` (reused, not copied) | Clover (Clover_1), flower groups (Flower_4_Group), flowering bush (Bush_Common_Flowers), short grass: **Quaternius Stylized Nature MegaKit** | CC0, see the shared `assets/LICENSES.md` |
| `album.jpg` | Crop of this page's own render of the hive at 40/40 (`bash album-thumbs.sh bees`) | own render |
| (procedural, `themes/bees.js`) | Honeycomb hall, wax tower, box hive, straw skep, beekeeper's hut, honey stall, bee bath, rain barrel, dew basin, lily pond, blossom / linden trees, sunflowers, hollyhocks, lavender, filling honey jars, capping comb frames, hex pavers / lantern / bench / wax steps, picket fence, the queen's hive, bees, honey bear, bee swarms, queen bee, honeycomb tile canvas texture | own work |

#### Not used
- No CC0 bee, beehive or bear model was found in the CC0 kits already in use (Quaternius / KayKit / Kenney), so these are built in code.

## Merged from `ants/LICENSES.md`: Colony hall theme (`themes.html?theme=ants`; the per-theme file stays next to its assets)

### assets/ants — licences

No new third-party files. The Ant farm theme (`themes/ants.js`) is procedural three.js geometry and canvas textures
written for this mock, plus tufts / flowers / fern / mushroom from the shared **Quaternius Stylized Nature MegaKit**
(`assets/kit-a/kit-a.glb`, CC0, already listed in `assets/LICENSES.md`).

| file | what | source | licence |
|---|---|---|---|
| album.jpg | album card art, rendered from this mock by `album-thumbs.sh ants` | own render | n/a (ours) |

## Merged from `aurora/LICENSES.md`: Longhouse theme (`themes.html?theme=aurora`; the per-theme file stays next to its assets)

### aurora — asset licences

No new third-party assets. Every piece, the aurora ribbons, stars, snowy owl and textures are procedural (themes/aurora.js).

| folder | what | source | licence | checked |
|---|---|---|---|---|
| assets/animals | Stag.glb, Deer.glb, Fox.glb (recoloured at runtime as reindeer, reindeer calf, arctic fox) | Quaternius Ultimate Animated Animals (already in the shared folder) | CC0 | see shared assets/LICENSES.md |
| assets/aurora | album.jpg | rendered from this theme (album-thumbs.sh) | own work | — |

## Merged from `atlantis/LICENSES.md`: Great dome theme (`themes.html?theme=atlantis`; the per-theme file stays next to its assets)

### Atlantis theme — assets (checked 2026-09-24)

| file | what | source | licence |
|---|---|---|---|
| (none new) | every city piece, coral tower, glow tree, submarine, whale, jellyfish, tile and water is procedural three.js in `themes/atlantis.js` | own code | n/a |
| `../reef/Fish1.glb`, `Fish2.glb`, `Dolphin.glb` (reused, not copied) | Quaternius Animated Fish Pack | https://quaternius.com/packs/animatedfish.html | CC0 1.0 (see `Quaternius-AnimatedFish-License.txt`, copied here; already verified in the reef row of `assets/LICENSES.md`) |
| `album.jpg` | own render of this theme (`album-thumbs.sh atlantis`) | own render | CC0 (derivative) |

## Merged from `galaxy/LICENSES.md`: Garden world theme (`themes.html?theme=galaxy`; the per-theme file stays next to its assets)

### galaxy — assets

No third-party assets. Every galaxy piece, resident (comets, space whales, star-minnows), tile texture, nebula shader and the
spiral-galaxy texture is procedural three.js / canvas code in `themes/galaxy.js` (original work, no licence constraints).
The theme lists the shared MegaKit (`kit a`, Quaternius, CC0 — see assets/LICENSES.md) in `kits` but builds nothing from it.
`album.jpg` is a render of the theme (album-thumbs.sh).

## Merged from `panda/LICENSES.md`: Keepers’ lodge theme (`themes.html?theme=panda`; the per-theme file stays next to its assets)

### assets/panda — licences

No new third-party files. Everything in the panda sanctuary is procedural three.js (themes/panda.js), except:

| what | source | licence | checked |
|---|---|---|---|
| Mountain pines (Pine_1/3/5), dove-tree canopies (CommonTree_1/2/3), ferns and grass tufts | shared kit `assets/kit-a/kit-a.glb` = Quaternius Stylized Nature MegaKit (quaternius.com) | CC0 1.0 | already listed in assets/LICENSES.md |
| album.jpg | rendered from this theme by album-thumbs.sh | own render | — |

## Merged from `mars/LICENSES.md`: Colony hub theme (`themes.html?theme=mars`; the per-theme file stays next to its assets)

### mars (Mars colony, season 40)

No third-party assets. Every piece, the ground texture, the mesas, the dust devils and the residents (lander, rovers, drones)
are procedural three.js geometry and canvas textures written for this theme in `themes/mars.js`.
`album.jpg` is a render of the theme (album-thumbs.sh). Kit `a` (Quaternius Stylized Nature MegaKit, CC0) is listed as the
primary kit only because the contract requires one; no model from it is placed.

## Merged from `clock/LICENSES.md`: Clockmaker’s shop theme (`themes.html?theme=clock`; the per-theme file stays next to its assets)

### clock — asset licences

No third-party assets. Every piece (clockmaker's shop, cuckoo house, music box, wind-up house, orrery, spring works, water clock, brass fountain, hourglass, cog pond, cog pines, pendulum trees, armillary trees, gear towers, cog ladders, paths, brass rails, the great clock tower), the block trim with its turning gears (env), the parquet texture and the residents (clockwork birds, wind-up robins) are procedural three.js geometry and canvas textures written in `themes/clock.js`. Clock faces carry tick marks only, no numerals or text. `album.jpg` is a render of the theme itself (album-thumbs.sh). The kit id `a` (Quaternius Stylized Nature MegaKit, CC0, see assets/LICENSES.md) is declared as the primary kit but no model from it is placed.

## Album card art (checked 2026-09-24)

| Folder | What | Source | Licence |
|---|---|---|---|
| `<id>/album.jpg` (all 42 themes, seasons 1–42: farm, forest, reef, village, pirate, space, dino, winter, halloween, town, diwali, zen, camp, castle, railway, fairy, pets, oasis, varanasi, sky, cricket, globe, phoenix, book, turtle, candy, dream, solar, kerala, ladakh, mumbai, jungle, robots, toys, bees, ants, aurora, atlantis, galaxy, panda, mars, clock) | the album card thumbnail: this page's own render of the theme at its album state (`themes.html?albumsnap=1&theme=<id>`, saved by `album-thumbs.sh`) | own render of the CC0 models above | CC0 (derivative) |
| `album/farm.jpg`, `album/forest.jpg` | older hand-cropped thumbnails, superseded by `farm/album.jpg` / `forest/album.jpg`, no longer referenced | own render | CC0 (derivative) |
