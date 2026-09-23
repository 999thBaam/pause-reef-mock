# Little town theme (`themes.html?theme=town`): asset licences (checked 2026-09-24)

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
