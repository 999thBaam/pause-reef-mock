# Moon base theme (`themes.html?theme=space`): asset licences (checked 2026-09-23)

| File | What | Source | Licence, and where I checked it |
|---|---|---|---|
| `space-kit.glb` | 72 of the 150+ models from the **Kenney Space Kit 2.0** (`kenney_space-kit.zip`, `Models/GLTF format/`): hangars (largeA/B, roundA/B/Glass, smallA/B), structures, supports, satellite dishes, machines (barrel, barrelLarge, generator, generatorLarge, wireless), barrels, rocks, crystals, craters, meteors, rover, rocket parts (base/fuel/sides/fins/top, A+B), platforms, rails, pipes, chimneys, craft, turret, gates, desk_computer | https://kenney.nl/assets/space-kit (direct zip `kenney.nl/media/pages/assets/space-kit/20874c75ac-1677698978/kenney_space-kit.zip`) | CC0: the page says "Creative Commons CC0" / "CC0 licensed!", and `License.txt` in the zip (copied here as `Kenney-SpaceKit-License.txt`) says "License: (Creative Commons Zero, CC0)" |

Processing: Blender 5 (`-b --python`) packed one top-level node per model, named after the file. Then glTF-Transform `dedup` + `meshopt`: 997 KB → 605 KB. No textures (Kenney uses flat baseColorFactors). At runtime the kit's Mars-orange `rock` / `rockDark` / `rockTrack` materials are recoloured to grey-lavender regolith, and `crystal` to lavender with a soft emissive.

Everything else in the theme is procedural three.js built in `themes/space.js`: the greenhouse domes and their plants, the crystals, antenna arrays, solar panels, lamps, the ice pool, the observatory, drones, the ringed planet and the regolith tile texture. It is original work, with no licence encumbrance.

Not used: Quaternius Ultimate Space Kit and KayKit Space Base Bits. Kenney alone covered every piece in one consistent style, inside the time box.
